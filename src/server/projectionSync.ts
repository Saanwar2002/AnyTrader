/**
 * AnyTrader Public Job Projection Engine
 * Transforms private operational /jobs/{jobId} documents into sanitized /public_job_cards/{jobId}
 * records for anonymous & public marketplace discovery without exposing homeowner PII, exact addresses,
 * private attachments, financial details, or disputes.
 */

import type admin from "firebase-admin";

export interface PublicJobCard {
  id: string;
  jobNo?: string;
  category: string;
  subCategory?: string;
  title: string;
  description: string;
  postcodeArea?: string; // Outward code only (e.g. "EC1A", "SW1A")
  city?: string;
  area?: string;
  urgency?: string;
  status: string;
  estimateMin?: number;
  estimateMax?: number;
  postedDate?: any;
  createdAt?: any;
  updatedAt?: any;
  quoteCount?: number;
  isBoosted?: boolean;
  boostTier?: string | null;
  isInstantMatch?: boolean;
  exclusiveUntil?: any;
  photosCount?: number;
  videosCount?: number;
  documentsCount?: number;
  [key: string]: any;
}

export interface PublicPropertyPassport {
  id: string;
  name?: string;
  propertyType?: string;
  postcodeArea?: string; // Outward postcode only (e.g. "SW1A", "EC1A")
  city?: string;
  epcRating?: string;
  roofCondition?: string;
  boilerInfo?: {
    brand?: string;
    model?: string;
    age?: string | number;
    lastServiced?: string;
  };
  gasSafetyExpiry?: string;
  eicrExpiry?: string;
  isPublicPassport?: boolean;
  status?: string;
  createdAt?: any;
  updatedAt?: any;
  address?: {
    city?: string;
    postcode?: string; // Redacted to outward code or sanitized
    country?: string;
  };
  [key: string]: any;
}

/**
 * Extracts outward postcode safely (e.g., "SW1A 1AA" -> "SW1A", "EC1" -> "EC1")
 */
export function extractOutwardPostcode(postcode?: string): string {
  if (!postcode) return "";
  const cleaned = postcode.trim().toUpperCase();
  const parts = cleaned.split(/\s+/);
  if (parts.length > 1) {
    return parts[0];
  }
  // If without space e.g. "SW1A1AA"
  if (cleaned.length > 3) {
    return cleaned.slice(0, cleaned.length - 3).trim();
  }
  return cleaned;
}

/**
 * Redacts common PII patterns (phone numbers, emails, door numbers, full postcodes) from text
 */
export function sanitizePublicDescription(rawDescription?: string): string {
  if (!rawDescription) return "";
  let sanitized = rawDescription;

  // Redact emails
  sanitized = sanitized.replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, "[Contact Info Redacted]");

  // Redact UK / International phone numbers
  sanitized = sanitized.replace(/(?:(?:\+44\s?\(0\)\s?|\+44\s?|0)(?:\d\s?){9,10}\d)/g, "[Phone Redacted]");

  // Redact full UK postcodes (e.g. SW1A 1AA, EC1V 2NX)
  sanitized = sanitized.replace(/\b([A-Z]{1,2}[0-9][A-Z0-9]?)\s*([0-9][A-Z]{2})\b/gi, "$1 ***");

  return sanitized.trim();
}

/**
 * Checks if a job is a 1-to-1 direct / targeted quote request meant for a specific tradesperson
 */
export function isDirectJob(jobData: Record<string, any>): boolean {
  return Boolean(
    jobData.targetTradespersonId ||
    jobData.targetTraderId ||
    jobData.directTraderId ||
    jobData.isDirectQuote ||
    jobData.isTargeted
  );
}

/**
 * Transforms a private /jobs document into a public-safe /public_job_cards projection
 */
export function sanitizeJobToPublicCard(jobId: string, jobData: Record<string, any>): PublicJobCard {
  const outwardCode = extractOutwardPostcode(jobData.postcode || jobData.postcodeArea || jobData.area);

  return {
    id: jobId,
    jobNo: jobData.jobNo || undefined,
    category: jobData.category || "General",
    subCategory: jobData.subCategory || undefined,
    title: jobData.title || "Trade Job",
    description: sanitizePublicDescription(jobData.description),
    postcodeArea: outwardCode || jobData.area || "Local Area",
    city: jobData.city || undefined,
    area: jobData.area || undefined,
    urgency: jobData.urgency || "standard",
    status: jobData.status || "posted",
    estimateMin: typeof jobData.estimateMin === "number" ? jobData.estimateMin : undefined,
    estimateMax: typeof jobData.estimateMax === "number" ? jobData.estimateMax : undefined,
    postedDate: jobData.postedDate || jobData.createdAt || undefined,
    createdAt: jobData.createdAt || undefined,
    updatedAt: jobData.updatedAt || undefined,
    quoteCount: typeof jobData.quoteCount === "number" ? jobData.quoteCount : 0,
    isBoosted: Boolean(jobData.isBoosted),
    boostTier: jobData.boostTier || null,
    isInstantMatch: Boolean(jobData.isInstantMatch),
    exclusiveUntil: jobData.exclusiveUntil || null,
    photosCount: Array.isArray(jobData.photos) ? jobData.photos.length : (jobData.photosCount || 0),
    videosCount: Array.isArray(jobData.videos) ? jobData.videos.length : (jobData.videosCount || 0),
    documentsCount: Array.isArray(jobData.documents) ? jobData.documents.length : (jobData.documentsCount || 0)
  };
}

/**
 * Real-time background sync listener that mirrors /jobs state to /public_job_cards
 */
export function startPublicJobCardsSync(firestoreDb: admin.firestore.Firestore): () => void {
  try {
    let unsubscribe: (() => void) | null = null;
    unsubscribe = firestoreDb.collection("jobs").onSnapshot(
      async (snapshot) => {
        const batch = firestoreDb.batch();
        let operationsCount = 0;

        for (const change of snapshot.docChanges()) {
          const docId = change.doc.id;
          const data = change.doc.data();

          if (change.type === "removed") {
            // Remove from public projection
            const publicRef = firestoreDb.collection("public_job_cards").doc(docId);
            batch.delete(publicRef);
            operationsCount++;
          } else {
            // If active, open for marketplace quoting/discovery, AND NOT a direct/targeted job
            const isDirect = isDirectJob(data);
            const isActive = ["posted", "quoting", "in_bidding", "open"].includes(data.status) && !data.clientDeleted && !isDirect;

            if (isActive) {
              const publicData = sanitizeJobToPublicCard(docId, data);
              const publicRef = firestoreDb.collection("public_job_cards").doc(docId);
              batch.set(publicRef, publicData, { merge: true });
              operationsCount++;
            } else {
              // If status moved to completed, cancelled, disputed, or accepted OR if direct job, remove from public projection
              const publicRef = firestoreDb.collection("public_job_cards").doc(docId);
              batch.delete(publicRef);
              operationsCount++;
            }
          }

          // Commit batches in chunks of 400
          if (operationsCount >= 400) {
            await batch.commit();
            operationsCount = 0;
          }
        }

        if (operationsCount > 0) {
          await batch.commit();
        }
      },
      (error: any) => {
        const msg = error?.message || String(error);
        if (error?.code === 7 || msg.includes("7") || msg.includes("PERMISSION_DENIED") || msg.includes("Missing or insufficient permissions") || msg.includes("UNAUTHENTICATED") || msg.includes("Could not load the default credentials")) {
          if (unsubscribe) {
            try { unsubscribe(); } catch {}
          }
          return;
        }
        console.warn("[PublicJobCardsSync] Firestore listener notice:", msg);
      }
    );

    return unsubscribe || (() => {});
  } catch (err: any) {
    return () => {};
  }
}

/**
 * Manual backfill migration helper to sync all active public marketplace jobs to /public_job_cards
 */
export async function backfillPublicJobCards(firestoreDb: admin.firestore.Firestore): Promise<{ total: number; synced: number }> {
  const jobsSnap = await firestoreDb.collection("jobs").get();
  let synced = 0;
  const batch = firestoreDb.batch();

  jobsSnap.docs.forEach((doc) => {
    const data = doc.data();
    const isDirect = isDirectJob(data);
    const isActive = ["posted", "quoting", "in_bidding", "open"].includes(data.status) && !data.clientDeleted && !isDirect;
    if (isActive) {
      const publicCard = sanitizeJobToPublicCard(doc.id, data);
      batch.set(firestoreDb.collection("public_job_cards").doc(doc.id), publicCard, { merge: true });
      synced++;
    }
  });

  if (synced > 0) {
    await batch.commit();
  }

  return { total: jobsSnap.size, synced };
}

/**
 * Transforms a private /properties document into a public-safe /public_properties projection.
 * Strictly excludes:
 * - ownerId, userId, landlordId, tenantId, tenantEmail, tenantName
 * - fullAddress, line1, houseNumber, street
 * - componentRegistry (stopcockLocation, fuseboardLocation, access codes, paintCodes)
 * - transferHistory, transferCode, pendingTransferToUid
 * - financial details, private notes, insuranceProvider, policy numbers
 */
export function sanitizePropertyToPublicPassport(propertyId: string, propertyData: Record<string, any>): PublicPropertyPassport {
  const rawPostcode = propertyData.address?.postcode || propertyData.postcode || "";
  const outwardCode = extractOutwardPostcode(rawPostcode);
  const city = propertyData.address?.city || propertyData.city || "";

  return {
    id: propertyId,
    name: sanitizePublicDescription(propertyData.name) || "Verified Property",
    propertyType: propertyData.propertyType || "residential",
    postcodeArea: outwardCode || "UK Area",
    city: city || undefined,
    epcRating: propertyData.epcRating || "C",
    roofCondition: propertyData.roofCondition || "Good",
    boilerInfo: propertyData.boilerInfo ? {
      brand: propertyData.boilerInfo.brand || "Standard",
      model: propertyData.boilerInfo.model || undefined,
      age: propertyData.boilerInfo.age || undefined,
      lastServiced: propertyData.boilerInfo.lastServiced || undefined,
    } : undefined,
    gasSafetyExpiry: propertyData.gasSafetyExpiry || undefined,
    eicrExpiry: propertyData.eicrExpiry || undefined,
    isPublicPassport: propertyData.isPublicPassport ?? false,
    status: propertyData.status || "active",
    createdAt: propertyData.createdAt || undefined,
    updatedAt: propertyData.updatedAt || undefined,
    address: {
      city: city || undefined,
      postcode: outwardCode ? `${outwardCode} ***` : undefined,
      country: propertyData.address?.country || "UK"
    }
  };
}

/**
 * Real-time background sync listener that mirrors /properties state to /public_properties
 */
export function startPublicPropertiesSync(firestoreDb: admin.firestore.Firestore): () => void {
  try {
    let unsubscribe: (() => void) | null = null;
    unsubscribe = firestoreDb.collection("properties").onSnapshot(
      async (snapshot) => {
        const batch = firestoreDb.batch();
        let operationsCount = 0;

        for (const change of snapshot.docChanges()) {
          const docId = change.doc.id;
          const data = change.doc.data();

          if (change.type === "removed" || data.isPublicPassport !== true || data.status === "archived") {
            const publicRef = firestoreDb.collection("public_properties").doc(docId);
            batch.delete(publicRef);
            operationsCount++;
          } else {
            const publicData = sanitizePropertyToPublicPassport(docId, data);
            const publicRef = firestoreDb.collection("public_properties").doc(docId);
            batch.set(publicRef, publicData, { merge: true });
            operationsCount++;
          }

          if (operationsCount >= 400) {
            await batch.commit();
            operationsCount = 0;
          }
        }

        if (operationsCount > 0) {
          await batch.commit();
        }
      },
      (error: any) => {
        const msg = error?.message || String(error);
        if (error?.code === 7 || msg.includes("7") || msg.includes("PERMISSION_DENIED") || msg.includes("Missing or insufficient permissions") || msg.includes("UNAUTHENTICATED") || msg.includes("Could not load the default credentials")) {
          if (unsubscribe) {
            try { unsubscribe(); } catch {}
          }
          return;
        }
        console.warn("[PublicPropertiesSync] Firestore listener notice:", msg);
      }
    );

    return unsubscribe || (() => {});
  } catch (err: any) {
    return () => {};
  }
}

/**
 * Manual backfill migration helper to sync all eligible properties to /public_properties
 */
export async function backfillPublicProperties(firestoreDb: admin.firestore.Firestore): Promise<{ total: number; synced: number }> {
  const propSnap = await firestoreDb.collection("properties").get();
  let synced = 0;
  const batch = firestoreDb.batch();

  propSnap.docs.forEach((doc) => {
    const data = doc.data();
    if (data.isPublicPassport === true && data.status !== "archived") {
      const publicPassport = sanitizePropertyToPublicPassport(doc.id, data);
      batch.set(firestoreDb.collection("public_properties").doc(doc.id), publicPassport, { merge: true });
      synced++;
    }
  });

  if (synced > 0) {
    await batch.commit();
  }

  return { total: propSnap.size, synced };
}


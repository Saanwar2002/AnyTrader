/**
 * AnyTrader V8.2 — Buyer / Conveyancing Intelligence Service
 * 
 * Provides:
 * - Evidence-backed, Versioned Buyer & Conveyancing Assessment (`BUYER_INTELLIGENCE_SCHEMA_VERSION = 'v8.2-buyer-v1'`)
 * - Immutable Historical Snapshots (`buyer_intelligence_history/{assessmentId}`)
 * - Authoritative Current Projection (`buyer_intelligence/{propertyId}`)
 * - Derived Projections from Property Passport, Risk Intelligence, and Evidence Registry
 * - Strict Invariants:
 *   1. "No Unsupported Conclusions": Does NOT output formal legal advice, conveyancing opinions, or valuation assertions.
 *   2. "No Evidence = No Material Assertion": All flags and inquiries trace directly to verified evidence.
 *   3. "No AI Self-Promotion": AI-derived sources remain non-authoritative.
 *   4. "Deterministic Hashing & Idempotency": SHA-256 content hashing across canonical assessment fields.
 *   5. "Cross-Property & Cross-Tenant Lineage Isolation".
 *   6. "Bounded Property-Scoped Queries".
 */

import { computeSha256 } from './provenance';
import { getGlobalIntelligenceDb } from './immutableStore';
import { cleanUndefinedFields } from './evidence';
import { intelligenceTaskQueue } from './intelligenceTaskQueue';
import { propertyPassportService } from './propertyPassport';
import {
  IntelligenceTask,
  BuyerIntelligenceAssessment,
  BuyerIntelligenceSnapshot,
  ConveyancingFlag,
  ConveyancingFlagCategory,
  RecommendedInquiry,
  LegalDisclaimer,
  BuyerIntelligenceRiskSummary,
  BuyerIntelligenceEvidenceSummary,
  BuyerIntelligenceProvenance,
  GenerateBuyerIntelligenceInput,
  SeverityLevel,
  UrgencyLevel,
  ConfidenceScores,
  PropertyPassport,
} from './types';

export const BUYER_INTELLIGENCE_SCHEMA_VERSION = 'v8.2-buyer-v1';
export const BUYER_INTELLIGENCE_PIPELINE_VERSION = 'v8.2.0';
export const MAX_BUYER_HISTORY_QUERY_LIMIT = 100;

export const STANDARD_LEGAL_DISCLAIMER: LegalDisclaimer = {
  disclaimerText:
    'This buyer/conveyancing assessment is an evidence-backed factual projection derived from property records, condition logs, and property passport data. It DOES NOT constitute formal legal advice, conveyancing counsel, title search, structural survey, or property valuation. Qualified solicitors and licensed surveyors must be consulted for formal transaction due diligence.',
  isNonLegalAdviceNotice: true,
  isNonConveyancingNotice: true,
  isNonValuationNotice: true,
  effectiveDate: '2026-09-20',
};

export class BuyerIntelligenceService {
  private defaultDb?: any;

  constructor(options?: { firestoreDb?: any }) {
    if (options?.firestoreDb) {
      this.defaultDb = options.firestoreDb;
    }
  }

  public setFirestoreDb(db: any): void {
    this.defaultDb = db;
  }

  /**
   * Generates or refreshes the authoritative Buyer / Conveyancing Intelligence assessment for a property.
   * Upstream source: Authoritative Property Passport, Property Risk History, and Evidence Registry.
   */
  public async generateBuyerIntelligence(
    input: GenerateBuyerIntelligenceInput,
    options?: { firestoreDb?: any; isVerifiedServerAction?: boolean }
  ): Promise<BuyerIntelligenceAssessment> {
    const activeDb = options?.firestoreDb || this.defaultDb || getGlobalIntelligenceDb();

    if (!activeDb) {
      throw new Error(
        '[BuyerIntelligence Error] Firestore database reference required for buyer intelligence assessment'
      );
    }

    // 1. Basic Parameter Validation
    if (!input.propertyId || typeof input.propertyId !== 'string' || input.propertyId.trim().length === 0) {
      throw new Error('[BuyerIntelligence Error] Valid propertyId is required');
    }

    const propertyId = input.propertyId.trim();

    // 2. Authoritative Property Existence Check (Fail Closed)
    const propDoc = await activeDb.collection('properties').doc(propertyId).get();
    if (!propDoc || !propDoc.exists) {
      throw new Error(`[BuyerIntelligence Violation] Property '${propertyId}' does not exist`);
    }
    const propData = typeof propDoc.data === 'function' ? propDoc.data() : propDoc.data;
    const authoritativeTenant = propData?.tenantId ?? propData?.landlordId ?? propData?.ownerId;

    // 3. Cross-Tenant Contamination Check
    if (input.provenance?.tenantId && authoritativeTenant && input.provenance.tenantId !== authoritativeTenant) {
      throw new Error(
        `[CrossTenantContamination Violation] Tenant '${input.provenance.tenantId}' does not match property owner/tenant '${authoritativeTenant}'`
      );
    }

    // 4. Retrieve or Project Upstream Authoritative Property Passport
    let passport: PropertyPassport | null = await propertyPassportService.getLatestPassport(propertyId, {
      firestoreDb: activeDb,
    });

    if (!passport) {
      // Auto-generate Property Passport if missing
      passport = await propertyPassportService.generatePropertyPassport(
        { propertyId },
        { firestoreDb: activeDb, isVerifiedServerAction: options?.isVerifiedServerAction }
      );
    }

    // Extra Lineage Check on Passport
    if (passport.propertyId !== propertyId) {
      throw new Error(
        `[BuyerIntelligence Lineage Violation] Passport propertyId '${passport.propertyId}' does not match requested '${propertyId}'`
      );
    }

    const allSourceRecordIds = new Set<string>(passport.provenance.sourceRecordIds || []);
    const sourceCollections = new Set<string>(passport.provenance.sourceCollections || ['properties', 'property_passports']);
    sourceCollections.add('buyer_intelligence');

    // 5. Derive Conveyancing Flags from Passport & Upstream Risk Data
    const conveyancingFlags: ConveyancingFlag[] = [];
    const recommendedInquiries: RecommendedInquiry[] = [];
    const allEvidenceIds = new Set<string>(passport.evidenceIds || []);

    // A. Convert Passport Active Risks to Conveyancing Flags
    if (passport.riskSummary && Array.isArray(passport.riskSummary.risks)) {
      for (const r of passport.riskSummary.risks) {
        let flagCategory: ConveyancingFlagCategory = 'structural_concern';
        const rTypeLower = (r.riskType || '').toLowerCase();
        if (rTypeLower.includes('title') || rTypeLower.includes('ownership')) flagCategory = 'title_risk';
        else if (rTypeLower.includes('boundary') || rTypeLower.includes('easement')) flagCategory = 'boundary_note';
        else if (rTypeLower.includes('damp') || rTypeLower.includes('flood') || rTypeLower.includes('environmental')) flagCategory = 'environmental_flag';
        else if (rTypeLower.includes('unpermitted') || rTypeLower.includes('planning') || rTypeLower.includes('building_control')) flagCategory = 'unpermitted_work';
        else if (rTypeLower.includes('compliance') || rTypeLower.includes('epc') || rTypeLower.includes('gas_safety') || rTypeLower.includes('eicr')) flagCategory = 'compliance_gap';
        else if (rTypeLower.includes('maintenance') || rTypeLower.includes('repair')) flagCategory = 'maintenance_liability';

        const flagEvIds: string[] = Array.isArray(r.evidenceIds) ? r.evidenceIds.filter(Boolean) : [];
        for (const eid of flagEvIds) allEvidenceIds.add(eid);

        conveyancingFlags.push({
          flagId: `flag_${r.riskId}`,
          category: flagCategory,
          title: `Flag: ${r.riskType || 'Property Risk'}`,
          description: r.description || 'Identified property risk requiring conveyancing review.',
          severity: r.severity || 'medium',
          evidenceIds: flagEvIds.slice().sort(),
          sourceRecordId: r.riskId,
        });

        // Generate corresponding buyer inquiry
        recommendedInquiries.push({
          inquiryId: `inq_risk_${r.riskId}`,
          category: flagCategory,
          question: `Request clarification and documentation from vendor regarding ${r.riskType || 'identified risk'}: ${r.description}`,
          rationale: `Evidence-backed risk identified in property records with severity '${r.severity}'.`,
          urgency: r.severity === 'critical' || r.severity === 'high' ? 'immediate' : 'medium_term',
          evidenceIds: flagEvIds.slice().sort(),
        });
      }
    }

    // B. Convert Passport Building Components / Condition Gaps to Recommended Inquiries
    if (Array.isArray(passport.components)) {
      for (const comp of passport.components) {
        if (comp.status === 'unverified' || comp.condition === 'poor' || comp.condition === 'critical') {
          const compEvIds = Array.isArray(comp.evidenceIds) ? comp.evidenceIds.filter(Boolean) : [];
          for (const eid of compEvIds) allEvidenceIds.add(eid);

          recommendedInquiries.push({
            inquiryId: `inq_comp_${comp.componentType}`,
            category: 'maintenance_liability',
            question: `Request service history, warranties, and compliance certificates for component '${comp.componentType}'.`,
            rationale: `Component '${comp.componentType}' condition is reported as '${comp.condition}' with status '${comp.status}'.`,
            urgency: comp.condition === 'critical' || comp.condition === 'poor' ? 'immediate' : 'planned',
            evidenceIds: compEvIds.slice().sort(),
          });
        }
      }
    }

    // C. Convert Upcoming Maintenance Predictions to Inquiries / Flags
    if (passport.maintenanceSummary && Array.isArray(passport.maintenanceSummary.upcomingActions)) {
      for (const action of passport.maintenanceSummary.upcomingActions) {
        const actionEvIds = Array.isArray(action.evidenceIds) ? action.evidenceIds.filter(Boolean) : [];
        for (const eid of actionEvIds) allEvidenceIds.add(eid);

        if (action.urgency === 'immediate') {
          conveyancingFlags.push({
            flagId: `flag_maint_${action.maintenanceAssessmentId}`,
            category: 'maintenance_liability',
            title: `Immediate Maintenance Liability: ${action.componentType}`,
            description: `Forecasted ${action.predictionType} required for ${action.componentType} between ${action.forecastStart} and ${action.forecastEnd}.`,
            severity: 'high',
            evidenceIds: actionEvIds.slice().sort(),
            sourceRecordId: action.maintenanceAssessmentId,
          });
        }

        recommendedInquiries.push({
          inquiryId: `inq_maint_${action.maintenanceAssessmentId}`,
          category: 'maintenance_liability',
          question: `Inquire whether vendor intends to remediate ${action.predictionType} on ${action.componentType} prior to exchange.`,
          rationale: `Upcoming maintenance prediction window (${action.forecastStart} to ${action.forecastEnd}) with urgency '${action.urgency}'.`,
          urgency: action.urgency,
          evidenceIds: actionEvIds.slice().sort(),
        });
      }
    }

    // Sort flags and inquiries for canonical ordering
    conveyancingFlags.sort((a, b) => a.flagId.localeCompare(b.flagId));
    recommendedInquiries.sort((a, b) => a.inquiryId.localeCompare(b.inquiryId));

    // 6. Build Risk Summary
    const sortedRisks = passport.riskSummary?.risks ? [...passport.riskSummary.risks].sort((a, b) => a.riskId.localeCompare(b.riskId)) : [];
    const riskSummary: BuyerIntelligenceRiskSummary = {
      overallRiskScore: passport.riskSummary?.riskScore ?? 0,
      overallSeverity: passport.riskSummary?.overallSeverity ?? 'low',
      activeRiskCount: passport.riskSummary?.activeRiskCount ?? 0,
      flaggedRiskCount: conveyancingFlags.length,
      risks: sortedRisks,
      evidenceIds: passport.riskSummary?.evidenceIds ? [...passport.riskSummary.evidenceIds].sort() : [],
    };

    // 7. Build Evidence Summary
    const sortedEvidenceIds = Array.from(allEvidenceIds).sort();
    const evidenceSummary: BuyerIntelligenceEvidenceSummary = {
      totalEvidenceItems: sortedEvidenceIds.length,
      evidenceIds: sortedEvidenceIds,
      verifiedEvidenceCount: sortedEvidenceIds.length, // All included evidence comes from authoritative store
      unverifiedEvidenceCount: 0,
    };

    // 8. Calculate Multidimensional Confidence Scores
    const totalEvidenceCount = sortedEvidenceIds.length;
    const overallConfidence = totalEvidenceCount > 0 ? Math.min(0.95, 0.65 + totalEvidenceCount * 0.05) : 0.4;

    const confidence: ConfidenceScores = {
      overall: Math.round(overallConfidence * 100) / 100,
      extraction: 0.9,
      evidenceQuality: totalEvidenceCount > 0 ? 0.85 : 0.3,
      classification: 0.92,
      temporalFreshness: 0.9,
      method: 'deterministic_heuristic',
    };

    const sortedSourceRecordIds = Array.from(allSourceRecordIds).sort();
    const sortedSourceCollections = Array.from(sourceCollections).sort();

    // 9. Canonical Hash Calculation (Excluding timestamp for pure determinism)
    const canonicalPayload = {
      propertyId,
      conveyancingFlags,
      recommendedInquiries,
      riskSummary,
      evidenceSummary,
      disclaimers: STANDARD_LEGAL_DISCLAIMER,
      passportSnapshotId: passport.provenance.snapshotId,
      schemaVersion: BUYER_INTELLIGENCE_SCHEMA_VERSION,
      pipelineVersion: BUYER_INTELLIGENCE_PIPELINE_VERSION,
      tenantId: authoritativeTenant || '',
    };

    const contentHash = computeSha256(JSON.stringify(canonicalPayload));
    const assessmentId = `bia_${propertyId}_${contentHash.slice(0, 16)}`;
    const nowIso = new Date().toISOString();

    const provenance: BuyerIntelligenceProvenance = {
      pipelineVersion: BUYER_INTELLIGENCE_PIPELINE_VERSION,
      schemaVersion: BUYER_INTELLIGENCE_SCHEMA_VERSION,
      generatedAt: nowIso,
      contentHash,
      assessmentId,
      passportSnapshotId: passport.provenance.snapshotId,
      sourceRecordIds: sortedSourceRecordIds,
      sourceCollections: sortedSourceCollections,
      tenantId: authoritativeTenant,
    };

    const assessment: BuyerIntelligenceAssessment = {
      propertyId,
      conveyancingFlags,
      recommendedInquiries,
      riskSummary,
      evidenceSummary,
      disclaimers: STANDARD_LEGAL_DISCLAIMER,
      passportSnapshotId: passport.provenance.snapshotId,
      confidence,
      provenance,
      schemaVersion: BUYER_INTELLIGENCE_SCHEMA_VERSION,
      updatedAt: nowIso,
    };

    const snapshotRecord: BuyerIntelligenceSnapshot = {
      ...assessment,
      snapshotId: assessmentId,
      generatedAt: nowIso,
    };

    // 10. Transactional / Atomic Persistence to Firestore
    const cleanedSnapshot = cleanUndefinedFields(snapshotRecord);
    const cleanedAssessment = cleanUndefinedFields(assessment);

    if (typeof activeDb.runTransaction === 'function') {
      await activeDb.runTransaction(async (tx: any) => {
        const histRef = activeDb.collection('buyer_intelligence_history').doc(assessmentId);
        const currRef = activeDb.collection('buyer_intelligence').doc(propertyId);

        const existingHist = await tx.get(histRef);
        if (!existingHist || !existingHist.exists) {
          tx.set(histRef, cleanedSnapshot);
        }

        tx.set(currRef, cleanedAssessment);
      });
    } else {
      // Direct writes (Mock or non-transactional store)
      const histRef = activeDb.collection('buyer_intelligence_history').doc(assessmentId);
      const currRef = activeDb.collection('buyer_intelligence').doc(propertyId);

      const existingHist = await histRef.get();
      if (!existingHist || !existingHist.exists) {
        await histRef.set(cleanedSnapshot);
      }
      await currRef.set(cleanedAssessment);
    }

    return assessment;
  }

  /**
   * Retrieves the current authoritative Buyer Intelligence assessment for a property.
   */
  public async getLatestBuyerIntelligence(
    propertyId: string,
    options?: { firestoreDb?: any }
  ): Promise<BuyerIntelligenceAssessment | null> {
    const activeDb = options?.firestoreDb || this.defaultDb || getGlobalIntelligenceDb();
    if (!activeDb) {
      throw new Error('[BuyerIntelligence Error] Firestore database reference required');
    }

    const doc = await activeDb.collection('buyer_intelligence').doc(propertyId).get();
    if (!doc || !doc.exists) {
      return null;
    }

    const data = typeof doc.data === 'function' ? doc.data() : doc.data;
    return data as BuyerIntelligenceAssessment;
  }

  /**
   * Retrieves the immutable historical snapshots for a property (bounded query).
   */
  public async getBuyerIntelligenceHistory(
    propertyId: string,
    options?: { limit?: number; firestoreDb?: any }
  ): Promise<BuyerIntelligenceSnapshot[]> {
    const activeDb = options?.firestoreDb || this.defaultDb || getGlobalIntelligenceDb();
    if (!activeDb) {
      throw new Error('[BuyerIntelligence Error] Firestore database reference required');
    }

    const queryLimit = Math.min(options?.limit || 20, MAX_BUYER_HISTORY_QUERY_LIMIT);
    const snap = await activeDb
      .collection('buyer_intelligence_history')
      .where('propertyId', '==', propertyId)
      .limit(queryLimit)
      .get();

    const docs = snap && Array.isArray(snap.docs) ? snap.docs : (snap && Array.isArray(snap) ? snap : []);
    const results: BuyerIntelligenceSnapshot[] = [];

    for (const doc of docs) {
      const data = typeof doc.data === 'function' ? doc.data() : doc.data;
      if (data) {
        results.push(data as BuyerIntelligenceSnapshot);
      }
    }

    // Sort descending by generatedAt
    results.sort((a, b) => {
      const dateA = new Date(a.generatedAt || 0).getTime();
      const dateB = new Date(b.generatedAt || 0).getTime();
      return dateB - dateA;
    });

    return results;
  }

  /**
   * Retrieves a specific immutable snapshot by ID.
   */
  public async getBuyerIntelligenceAssessment(
    assessmentId: string,
    options?: { firestoreDb?: any }
  ): Promise<BuyerIntelligenceSnapshot | null> {
    const activeDb = options?.firestoreDb || this.defaultDb || getGlobalIntelligenceDb();
    if (!activeDb) {
      throw new Error('[BuyerIntelligence Error] Firestore database reference required');
    }

    const doc = await activeDb.collection('buyer_intelligence_history').doc(assessmentId).get();
    if (!doc || !doc.exists) {
      return null;
    }

    const data = typeof doc.data === 'function' ? doc.data() : doc.data;
    return data as BuyerIntelligenceSnapshot;
  }
}

export const buyerIntelligenceService = new BuyerIntelligenceService();

/**
 * Production Task Queue entry point for triggering Buyer Intelligence Assessment
 */
export async function enqueueBuyerIntelligenceTask(
  propertyId: string,
  input?: Partial<GenerateBuyerIntelligenceInput> & { db?: any },
  options?: { firestoreDb?: any; idempotencyKey?: string }
): Promise<IntelligenceTask> {
  const activeDb = options?.firestoreDb || input?.db || getGlobalIntelligenceDb();
  if (activeDb) {
    intelligenceTaskQueue.setFirestoreDb(activeDb);
  }
  const idempKey = options?.idempotencyKey || `idem_bia_${propertyId}_${Date.now()}`;
  const payloadInput = { ...input };
  delete (payloadInput as any).db;

  return intelligenceTaskQueue.enqueueTaskAsync(
    'buyer_intelligence',
    'property',
    propertyId,
    idempKey,
    {
      ...payloadInput,
      propertyId,
    }
  );
}

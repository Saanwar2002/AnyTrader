import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Simple check for common temporary email providers.
// In production, this should be replaced by a more robust solution or API.
const TEMP_EMAIL_DOMAINS = [
  "mailinator.com",
  "guerrillamail.com",
  "temp-mail.org",
  "10minutemail.com",
  "yopmail.com",
  "trashmail.com"
];

export function isTemporaryEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return TEMP_EMAIL_DOMAINS.includes(domain);
}

export function generateJobNumber(): string {
  const prefix = "AT";
  const random = Math.floor(100000 + Math.random() * 900000); // 6 digits
  return `${prefix}-${random}`;
}

/**
 * Safely extracts the outward part (first part) of a UK postcode.
 * Handles cases with or without spaces, embedded in addresses, and different outcode lengths.
 * Enforces valid UK outward patterns ([A-Z]{1,2}[0-9][A-Z0-9]?) to prevent non-postcode strings (e.g. "HOME", "Property") from displaying as postcodes.
 */
export function getOutwardPostcode(postcode: string | null | undefined): string {
  if (!postcode) return "Area Hidden";
  const str = String(postcode).trim();
  if (!str || str.toLowerCase() === "area hidden" || str.toLowerCase() === "undefined" || str.toLowerCase() === "null") {
    return "Area Hidden";
  }
  
  // 1. Try to match a standard UK postcode format within the string (e.g., SW1A 1AA, HD5 9BW, M1 1AE, 12 High St Huddersfield HD5 9BW)
  const fullMatch = str.match(/\b([A-Z]{1,2}[0-9][A-Z0-9]?)\s*([0-9][A-Z]{2})\b/i);
  if (fullMatch && fullMatch[1]) {
    return fullMatch[1].toUpperCase();
  }

  // 2. Try to match a standalone UK outcode pattern (e.g., "HD5", "SW1A", "M1", "EC1A")
  const outcodeMatch = str.match(/\b([A-Z]{1,2}[0-9][A-Z0-9]?)\b/i);
  if (outcodeMatch && outcodeMatch[1]) {
    return outcodeMatch[1].toUpperCase();
  }

  // 3. If it has a space, check if the first part is a valid UK outcode
  if (str.includes(" ")) {
    const firstPart = str.split(" ")[0].trim().toUpperCase();
    if (/^[A-Z]{1,2}[0-9][A-Z0-9]?$/i.test(firstPart)) {
      return firstPart;
    }
  }
  
  // 4. Clean non-alphanumeric characters
  const cleaned = str.toUpperCase().replace(/[^A-Z0-9]/g, "");

  // If it's a full compacted postcode (e.g., "HD59BW" -> 6 chars, "SW1A1AA" -> 7 chars, "M11AA" -> 5 chars)
  if (cleaned.length >= 5 && cleaned.length <= 7 && /[0-9][A-Z]{2}$/i.test(cleaned)) {
    const candidate = cleaned.slice(0, -3);
    if (/^[A-Z]{1,2}[0-9][A-Z0-9]?$/i.test(candidate)) {
      return candidate;
    }
  }
  
  // If the entire cleaned string is a valid outward code
  if (/^[A-Z]{1,2}[0-9][A-Z0-9]?$/i.test(cleaned)) {
    return cleaned;
  }
  
  return "Area Hidden";
}

/**
 * Formats a job's outward postcode and city for clean, privacy-preserving display across cards, feeds, and dashboards.
 * E.g., "HD5 • HUDDERSFIELD" or "HD5" or "HUDDERSFIELD".
 */
export function formatJobLocation(job: any): string {
  if (!job) return "Area on Request";
  
  // Extract postcode candidate from multiple possible properties
  const pcCandidate = 
    job.postcode || 
    job.address?.postcode || 
    job.area || 
    job.fullAddress || 
    (typeof job.address === "string" ? job.address : "");

  const outcode = getOutwardPostcode(pcCandidate);
  
  // Extract city
  const rawCity = 
    job.city || 
    job.address?.city || 
    job.address?.town || 
    "";
    
  const city = rawCity && 
    rawCity !== "Area Hidden" && 
    rawCity.toLowerCase() !== "home" && 
    rawCity.toLowerCase() !== "property" && 
    rawCity.toUpperCase() !== outcode
      ? rawCity.toUpperCase()
      : "";

  if (outcode && outcode !== "Area Hidden") {
    return city ? `${outcode} • ${city}` : outcode;
  }

  // If no outcode, check if area is already formatted like "HD5 • HUDDERSFIELD" or "Huddersfield"
  if (job.area && job.area !== "Area Hidden" && job.area !== "Area on Request") {
    return job.area.toUpperCase();
  }

  return city || "Area on Request";
}

/**
 * Calculates distance in miles between two latitude/longitude points using Haversine formula
 */
export function calculateDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 3958.8; // Radius of the Earth in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Normalizes deal pricing to return both original price and discounted price with savings.
 */
export function getDealPricing(deal: any) {
  if (!deal) {
    return { origPrice: null, discPrice: 0, discountPct: 0, savings: 0 };
  }
  const discPrice = Math.round(Number(deal.discountedPrice || deal.price || deal.discountedRate || 0));
  let origPrice = Math.round(Number(deal.originalPrice || deal.normalPrice || 0));
  const discountPct = Math.round(Number(deal.discountPercentage || 0));

  if (!origPrice && discPrice > 0 && discountPct > 0 && discountPct < 100) {
    origPrice = Math.round(discPrice / (1 - discountPct / 100));
  }

  const savings = origPrice > discPrice ? origPrice - discPrice : 0;

  return {
    origPrice: origPrice > discPrice ? origPrice : null,
    discPrice,
    discountPct,
    savings
  };
}


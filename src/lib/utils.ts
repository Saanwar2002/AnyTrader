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
 * Handles cases with or without spaces and different outcode lengths.
 */
export function getOutwardPostcode(postcode: string | null | undefined): string {
  if (!postcode) return "Area Hidden";
  const trimmed = postcode.trim();
  
  // If it has a space, the part before the space is the outcode
  if (trimmed.includes(" ")) {
    return trimmed.split(" ")[0].toUpperCase();
  }
  
  // If no space, the inward part is always the last 3 characters
  // A full UK postcode is at least 5 characters (e.g., S1 1AA)
  const cleaned = trimmed.toUpperCase();
  if (cleaned.length >= 5) {
    return cleaned.slice(0, -3);
  }
  
  // If it's shorter than 5 chars and has no space, it's likely already an outcode
  return cleaned;
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


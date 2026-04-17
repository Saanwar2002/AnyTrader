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

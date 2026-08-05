/**
 * TradeOS / AnyTrader Privacy Share Utility (Strategy 1)
 * Enables secure sharing of Jobs, Quotes, Invoices, and Property Passports
 * via WhatsApp, Email, or Web Link without exposing personal contact details.
 */

export type ShareType = 'job' | 'quote' | 'invoice' | 'passport';

export interface ShareOptions {
  type: ShareType;
  id: string;
  title: string;
  subtitle?: string;
  amount?: number;
  postcode?: string;
}

/**
 * Masks personal phone numbers and email addresses in text to enforce in-app privacy.
 */
export function maskSensitiveInfo(text: string): string {
  if (!text) return "";
  // Mask UK phone numbers (e.g. 07123456789 or +447123456789)
  let cleaned = text.replace(/(\+?44\s?7\d{3}|\b07\d{3})\s?(\d{3})\s?(\d{3})/g, "$1 *** ***");
  // Mask emails (e.g. john.doe@gmail.com -> j***e@gmail.com)
  cleaned = cleaned.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, (match, p1, p2) => {
    if (p1.length <= 2) return `**@${p2}`;
    return `${p1[0]}***${p1[p1.length - 1]}@${p2}`;
  });
  return cleaned;
}

/**
 * Builds an in-app privacy URL for a given resource.
 * Adheres strictly to Strategy 1 (opens strictly inside our application domain).
 */
export function getPrivacyShareUrl(type: ShareType, id: string): string {
  const origin = window.location.origin + window.location.pathname;
  return `${origin}?shareType=${type}&shareId=${encodeURIComponent(id)}`;
}

/**
 * Prepares formatted WhatsApp share text and triggers opening WhatsApp.
 */
export function shareToWhatsApp(options: ShareOptions): void {
  const shareUrl = getPrivacyShareUrl(options.type, options.id);
  
  let message = "";
  switch (options.type) {
    case "job":
      message = `📋 *AnyTrader Job Details*\n*${options.title}*\nLocation: ${options.postcode || 'UK'}\n\nView details & quote securely in-app:\n${shareUrl}`;
      break;
    case "quote":
      message = `💰 *Trade Quote Estimate*\n*${options.title}*\n${options.amount ? `Estimated Total: £${options.amount.toLocaleString()}` : ''}\n\nReview quote & respond securely in-app:\n${shareUrl}`;
      break;
    case "invoice":
      message = `🧾 *AnyTrader Invoice*\n*${options.title}*\n${options.amount ? `Amount Due: £${options.amount.toLocaleString()}` : ''}\n\nView invoice & pay securely in-app:\n${shareUrl}`;
      break;
    case "passport":
      message = `🏡 *TradeOS Property Passport*\n*${options.title}*\nLocation: ${options.postcode || 'UK'}\n\nView verified property maintenance history, EPC & certificates:\n${shareUrl}`;
      break;
  }

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(whatsappUrl, "_blank", "noopener,noreferrer");
}

/**
 * Copies the privacy share URL to the system clipboard.
 */
export async function copyPrivacyShareLink(type: ShareType, id: string): Promise<boolean> {
  const url = getPrivacyShareUrl(type, id);
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch (err) {
    console.error("Failed to copy share link:", err);
    return false;
  }
}

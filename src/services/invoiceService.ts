import { db, sendNotification } from "@/src/firebase";
import { collection, doc, setDoc, getDoc, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import jsPDF from "jspdf";
import { calculatePayoutBreakdown } from "./stripeIntegrationService";
import { exportInvoicesToSheets } from "./googleSheetsService";

export interface InvoiceData {
  id?: string;
  invoiceNumber: string;
  jobId: string;
  jobTitle: string;
  category: string;
  postcode: string;
  homeownerId: string;
  homeownerName: string;
  homeownerEmail?: string;
  homeownerAddress?: string;
  tradespersonId: string;
  tradespersonName: string;
  tradespersonBusinessName?: string;
  tradespersonVatNumber?: string;
  tradespersonLogoUrl?: string;
  tradespersonPhone?: string;
  tradespersonBankDetails?: {
    bankName?: string;
    sortCode?: string;
    accountNumber?: string;
  };
  tier: "free" | "pro";
  status: "paid" | "unpaid" | "pending";
  createdAt: any;
  dueDate: string;
  laborAmount: number;
  materialsAmount: number;
  platformFee: number;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  isBrandedPro: boolean;
  notes?: string;
}

/**
 * Checks tradesperson profile to determine if they qualify for Pro Branded Invoicing.
 */
export function isProInvoiceUser(tradespersonProfile: any): boolean {
  if (!tradespersonProfile) return false;
  return Boolean(
    tradespersonProfile.tier === "gold" ||
    tradespersonProfile.tier === "platinum" ||
    tradespersonProfile.tier === "pro" ||
    tradespersonProfile.hasVerifiedVideoProSubscription ||
    tradespersonProfile.isProInvoiceSubscriber
  );
}

/**
 * Automatically creates or retrieves an official invoice when a job is completed.
 */
export async function createOrGetJobInvoice(
  job: any,
  acceptedQuote: any,
  tradespersonProfile: any,
  homeownerProfile: any
): Promise<InvoiceData> {
  const jobId = job.id || job.jobId;
  const invoiceDocId = `INV_${jobId}`;
  const invoiceRef = doc(db, "invoices", invoiceDocId);

  // Check if invoice already exists
  try {
    const existingSnap = await getDoc(invoiceRef);
    if (existingSnap.exists()) {
      return { id: existingSnap.id, ...existingSnap.data() } as InvoiceData;
    }
  } catch (err) {
    console.warn("Error reading existing invoice, generating fresh:", err);
  }

  // Determine tier & calculations
  const isPro = isProInvoiceUser(tradespersonProfile);
  const payoutBreakdown = calculatePayoutBreakdown(acceptedQuote.amount || 0, tradespersonProfile?.tier || "payg");

  const laborAmount = acceptedQuote.amount || 0;
  const materialsAmount = job.materialsCost || acceptedQuote.materialsCost || 0;
  const subtotal = laborAmount + materialsAmount;

  // Calculate VAT if VAT registered
  const vatRate = tradespersonProfile?.vatNumber ? 0.20 : 0;
  const vatAmount = subtotal * vatRate;
  const totalAmount = subtotal + vatAmount;

  const invoiceNumber = `INV-${new Date().getFullYear()}-${jobId.slice(-6).toUpperCase()}`;
  const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const invoiceData: InvoiceData = {
    invoiceNumber,
    jobId,
    jobTitle: job.title || "Trade Service",
    category: job.category || "General Trade",
    postcode: job.postcode || "UK",
    homeownerId: job.homeownerId,
    homeownerName: homeownerProfile?.name || job.homeownerName || "Homeowner",
    homeownerEmail: homeownerProfile?.email || job.homeownerEmail || "",
    homeownerAddress: job.address || job.postcode || "",
    tradespersonId: acceptedQuote.tradespersonId,
    tradespersonName: tradespersonProfile?.name || tradespersonProfile?.businessName || "Tradesperson",
    tradespersonBusinessName: tradespersonProfile?.businessName || tradespersonProfile?.companyName || tradespersonProfile?.name || "Independent Tradesperson",
    tradespersonVatNumber: tradespersonProfile?.vatNumber || "",
    tradespersonLogoUrl: tradespersonProfile?.photoURL || tradespersonProfile?.logoUrl || "",
    tradespersonPhone: tradespersonProfile?.phone || tradespersonProfile?.phoneNumber || "",
    tradespersonBankDetails: isPro ? {
      bankName: tradespersonProfile?.bankName || "Barclays Bank UK",
      sortCode: tradespersonProfile?.sortCode || "20-00-00",
      accountNumber: tradespersonProfile?.accountNumber || "12345678"
    } : undefined,
    tier: isPro ? "pro" : "free",
    status: job.isPaid || job.paymentStatus === "paid" || job.paymentStatus === "handshake_complete" ? "paid" : "unpaid",
    createdAt: new Date().toISOString(),
    dueDate,
    laborAmount,
    materialsAmount,
    platformFee: payoutBreakdown.platformCommission,
    subtotal,
    vatAmount,
    totalAmount,
    isBrandedPro: isPro,
    notes: isPro
      ? (tradespersonProfile?.customInvoiceNotes || "Thank you for choosing a Verified AnyTrader Pro! Payment due within 14 days.")
      : "Automated standard invoice generated via AnyTrader Platform."
  };

  try {
    await setDoc(invoiceRef, { ...invoiceData, createdAt: serverTimestamp() });
  } catch (err) {
    console.error("Failed to store invoice doc:", err);
  }

  // Trigger Notifications
  try {
    if (job.homeownerId) {
      await sendNotification(
        job.homeownerId,
        `🧾 Invoice Ready: ${invoiceNumber}`,
        `Your invoice for "${job.title}" (£${totalAmount.toFixed(2)}) is now available to download.`,
        "invoice",
        `/job/${jobId}`
      );
    }
    if (acceptedQuote.tradespersonId) {
      await sendNotification(
        acceptedQuote.tradespersonId,
        `🧾 Invoice Generated: ${invoiceNumber}`,
        `An official ${isPro ? "Pro Branded" : "Free Standard"} invoice for "${job.title}" (£${totalAmount.toFixed(2)}) was generated.`,
        "invoice",
        `/job/${jobId}`
      );
    }

    // Auto-sync for Pro users if configured
    if (isPro && tradespersonProfile?.autoSyncGoogleSheets) {
      await exportInvoicesToSheets([{
        id: invoiceNumber,
        date: new Date().toLocaleDateString("en-GB"),
        client: invoiceData.homeownerName,
        service: invoiceData.jobTitle,
        amount: totalAmount,
        status: invoiceData.status,
        type: "Invoice"
      }]);
    }
  } catch (notifErr) {
    console.warn("Invoice notification failed non-blockingly:", notifErr);
  }

  return { id: invoiceDocId, ...invoiceData };
}

/**
 * Downloads a high-quality PDF invoice using jsPDF.
 */
export function downloadInvoicePDF(invoice: InvoiceData): void {
  const doc = new jsPDF();
  const isPro = invoice.isBrandedPro;

  // Header Background
  if (isPro) {
    // Elegant Dark Slate Header for Pro
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 45, "F");

    // Gold Accent Stripe
    doc.setFillColor(251, 191, 36); // amber-400
    doc.rect(0, 43, 210, 2, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text((invoice.tradespersonBusinessName || invoice.tradespersonName || "INDEPENDENT TRADER").toUpperCase(), 15, 20);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(226, 232, 240);
    doc.text(`⚡ Verified Trader • Powered by AnyTrader`, 15, 28);
    if (invoice.tradespersonVatNumber) {
      doc.text(`VAT Reg No: ${invoice.tradespersonVatNumber}`, 15, 34);
    } else if (invoice.tradespersonPhone) {
      doc.text(`Contact: ${invoice.tradespersonPhone}`, 15, 34);
    }

    // Right Align Invoice Number
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(251, 191, 36);
    doc.text(invoice.invoiceNumber, 195, 20, { align: "right" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(226, 232, 240);
    doc.text(`Date: ${new Date().toLocaleDateString("en-GB")}`, 195, 28, { align: "right" });
    doc.text(`Status: ${invoice.status.toUpperCase()}`, 195, 34, { align: "right" });
  } else {
    // Clean Standard Header for Free
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(0, 0, 210, 42, "F");

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text((invoice.tradespersonBusinessName || invoice.tradespersonName || "INDEPENDENT TRADER").toUpperCase(), 15, 20);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text("Official Trade Invoice • Powered by AnyTrader", 15, 28);
    if (invoice.tradespersonPhone) {
      doc.text(`Contact: ${invoice.tradespersonPhone}`, 15, 34);
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(invoice.invoiceNumber, 195, 20, { align: "right" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${new Date().toLocaleDateString("en-GB")}`, 195, 28, { align: "right" });
    doc.text(`Status: ${invoice.status.toUpperCase()}`, 195, 34, { align: "right" });
  }

  let y = 58;

  // Billed To & Trader Info
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("BILLED TO:", 15, y);
  doc.text("TRADESPERSON / SERVICE PROVIDER:", 110, y);

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  doc.text(invoice.homeownerName, 15, y);
  doc.text(invoice.tradespersonName, 110, y);

  y += 5;
  if (invoice.homeownerAddress) doc.text(invoice.homeownerAddress, 15, y);
  doc.text(invoice.tradespersonBusinessName || "Independent Trader", 110, y);

  y += 5;
  if (invoice.homeownerEmail) doc.text(invoice.homeownerEmail, 15, y);
  if (invoice.tradespersonPhone) doc.text(`Phone: ${invoice.tradespersonPhone}`, 110, y);

  y += 15;

  // Job Reference Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, y, 180, 16, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`Job Description: ${invoice.jobTitle}`, 20, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Category: ${invoice.category} • Location: ${invoice.postcode}`, 20, y + 12);

  y += 26;

  // Table Header
  doc.setFillColor(15, 23, 42);
  doc.rect(15, y, 180, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("ITEM DESCRIPTION", 20, y + 5.5);
  doc.text("AMOUNT (£)", 185, y + 5.5, { align: "right" });

  y += 8;

  // Table Items
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);

  // Line 1: Labor
  doc.text("Trade Labour & Professional Works", 20, y + 6);
  doc.text(`£${invoice.laborAmount.toFixed(2)}`, 185, y + 6, { align: "right" });
  doc.line(15, y + 9, 195, y + 9);
  y += 9;

  // Line 2: Materials (if any)
  if (invoice.materialsAmount > 0) {
    doc.text("Materials & Parts Procurement", 20, y + 6);
    doc.text(`£${invoice.materialsAmount.toFixed(2)}`, 185, y + 6, { align: "right" });
    doc.line(15, y + 9, 195, y + 9);
    y += 9;
  }

  // Line 3: AnyTrader Service Fee
  doc.text("AnyTrader Platform Processing & Guarantee Service Fee", 20, y + 6);
  doc.text(`£${invoice.platformFee.toFixed(2)}`, 185, y + 6, { align: "right" });
  doc.line(15, y + 9, 195, y + 9);
  y += 12;

  // Totals Section (Right Aligned)
  const totalX = 130;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Subtotal:", totalX, y);
  doc.text(`£${invoice.subtotal.toFixed(2)}`, 185, y, { align: "right" });

  if (invoice.vatAmount > 0) {
    y += 5;
    doc.text("VAT (20%):", totalX, y);
    doc.text(`£${invoice.vatAmount.toFixed(2)}`, 185, y, { align: "right" });
  }

  y += 7;
  doc.setFillColor(15, 23, 42);
  doc.rect(totalX - 5, y - 4, 70, 10, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL DUE:", totalX, y + 3);
  doc.text(`£${invoice.totalAmount.toFixed(2)}`, 185, y + 3, { align: "right" });

  y += 20;

  // Pro Bank Details & Notes
  if (isPro && invoice.tradespersonBankDetails) {
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(15, y, 180, 22, 2, 2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text("DIRECT BANK TRANSFER PAYMENT DETAILS (PRO BRANDED):", 20, y + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(`Bank: ${invoice.tradespersonBankDetails.bankName || "Barclays Bank UK"}`, 20, y + 12);
    doc.text(`Sort Code: ${invoice.tradespersonBankDetails.sortCode || "20-00-00"}`, 80, y + 12);
    doc.text(`Account No: ${invoice.tradespersonBankDetails.accountNumber || "12345678"}`, 140, y + 12);
    doc.text(`Reference: ${invoice.invoiceNumber}`, 20, y + 17);

    y += 28;
  }

  // Footer Notes
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(invoice.notes || "Thank you for using AnyTrader.", 15, y);

  y += 12;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(148, 163, 184);
  doc.text(`Powered by AnyTrader • Issued on behalf of ${invoice.tradespersonBusinessName || invoice.tradespersonName}`, 105, 285, { align: "center" });

  // Save PDF file
  doc.save(`${invoice.invoiceNumber}.pdf`);
}

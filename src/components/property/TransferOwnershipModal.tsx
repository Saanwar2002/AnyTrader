import React, { useState } from "react";
import { db, doc, updateDoc, handleFirestoreError, OperationType } from "@/src/firebase";
import { useAuth } from "../AuthProvider";
import { QRCodeSVG } from "qrcode.react";
import { X, ArrowRight, ShieldCheck, Copy, Check, Share2, AlertTriangle, Clock, RefreshCw, KeyRound, UserCheck, Trash2, Mail, ExternalLink, Printer } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { generateTransferCode } from "./propertyUtils";

interface TransferOwnershipModalProps {
  property: any;
  onClose: () => void;
  onUpdated?: () => void;
}

export function TransferOwnershipModal({ property, onClose, onUpdated }: TransferOwnershipModalProps) {
  const { user } = useAuth();
  const [buyerName, setBuyerName] = useState(property.transferTargetName || "");
  const [buyerEmail, setBuyerEmail] = useState(property.transferTargetEmail || "");
  const [validityDays, setValidityDays] = useState<number>(30);
  const [generatedCode, setGeneratedCode] = useState<string>(property.transferCode || generateTransferCode());
  const [submitting, setSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [confirmedTerms, setConfirmedTerms] = useState(false);

  const isPending = property.transferStatus === "pending" && property.transferCode;
  const expiryDate = property.transferExpiresAt ? new Date(property.transferExpiresAt) : null;
  const isExpired = expiryDate ? expiryDate.getTime() < Date.now() : false;

  const claimUrl = `${window.location.origin}/claim-passport?code=${encodeURIComponent(isPending ? property.transferCode : generatedCode)}`;

  const handleInitiateTransfer = async () => {
    if (!user || !property?.id) return;
    if (!confirmedTerms) {
      toast.error("Please confirm the ownership handover terms before generating the code.");
      return;
    }

    setSubmitting(true);
    try {
      const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString();
      const code = generatedCode || generateTransferCode();

      await updateDoc(doc(db, "properties", property.id), {
        transferStatus: "pending",
        transferCode: code,
        transferExpiresAt: expiresAt,
        transferTargetName: buyerName.trim() || null,
        transferTargetEmail: buyerEmail.trim() || null,
        transferInitiatedAt: new Date().toISOString(),
        transferInitiatorUid: user.uid,
        updatedAt: new Date().toISOString()
      });

      toast.success("🔑 Ownership Transfer Code active! Share it with the buyer or solicitor.");
      if (onUpdated) onUpdated();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `properties/${property.id}`);
      toast.error("Failed to generate transfer code.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelTransfer = async () => {
    if (!property?.id) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, "properties", property.id), {
        transferStatus: "none",
        transferCode: null,
        transferExpiresAt: null,
        transferTargetName: null,
        transferTargetEmail: null,
        updatedAt: new Date().toISOString()
      });
      toast.success("Transfer code revoked. Property remains securely in your account.");
      if (onUpdated) onUpdated();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `properties/${property.id}`);
      toast.error("Failed to cancel transfer.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = async () => {
    const codeToCopy = isPending ? property.transferCode : generatedCode;
    try {
      await navigator.clipboard.writeText(codeToCopy);
      setCopiedCode(true);
      toast.success("Transfer Code copied to clipboard!");
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (e) {
      toast.error("Could not copy code");
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(claimUrl);
      setCopiedLink(true);
      toast.success("Direct Claim Link copied to clipboard!");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (e) {
      toast.error("Could not copy link");
    }
  };

  const handleShareWhatsApp = () => {
    const code = isPending ? property.transferCode : generatedCode;
    const propName = property.name || property.address?.line1 || "Property Passport";
    const msg = `🏡 *AnyTrader Property Passport Handover*\n` +
      `Property: *${propName}*\n` +
      `Transfer Claim Code: *${code}*\n\n` +
      `To claim this property's verified digital maintenance twin, appliance specs, warranties, and compliance records upon completion, open this link:\n` +
      `${claimUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  };

  const handlePrintHandover = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className="relative w-full max-w-xl bg-white rounded-3xl border border-black shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 rounded-2xl text-white shadow-md">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-lg tracking-tight">Transfer Property Passport</h3>
                  <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] uppercase font-black px-2 py-0.5 rounded-full">
                    Conveyancing Handover
                  </span>
                </div>
                <p className="text-xs text-slate-400">{property.name || property.address?.line1 || "Digital Twin Asset"}</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            {/* Active Transfer State */}
            {isPending && !isExpired ? (
              <div className="space-y-5">
                <div className="p-5 bg-emerald-50 border-2 border-emerald-600 rounded-2xl space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="bg-emerald-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                        Active Transfer Code
                      </span>
                      <h4 className="font-black text-slate-900 text-base mt-2">Ready for Buyer Claim</h4>
                      <p className="text-xs text-slate-600 font-medium mt-0.5">
                        Expires on {expiryDate?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-emerald-300 shadow-sm">
                      <QRCodeSVG value={claimUrl} size={64} />
                    </div>
                  </div>

                  {/* Big Code Display */}
                  <div className="p-4 bg-white rounded-xl border-2 border-dashed border-emerald-500 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Transfer Code</p>
                      <p className="text-2xl font-black text-slate-900 tracking-widest font-mono">
                        {property.transferCode}
                      </p>
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition"
                    >
                      {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedCode ? "Copied" : "Copy Code"}
                    </button>
                  </div>

                  {/* Target Buyer Info if defined */}
                  {(property.transferTargetName || property.transferTargetEmail) && (
                    <div className="text-xs text-slate-700 bg-white/80 p-3 rounded-xl border border-emerald-200">
                      <p className="font-bold text-slate-900">Designated Recipient:</p>
                      <p>{property.transferTargetName || 'Prospective Buyer'} {property.transferTargetEmail && `(${property.transferTargetEmail})`}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={handleCopyLink}
                      className="py-2.5 px-3 bg-white hover:bg-slate-100 text-slate-900 border border-black rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition"
                    >
                      {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      {copiedLink ? "Link Copied!" : "Copy Direct Claim Link"}
                    </button>

                    <button
                      onClick={handleShareWhatsApp}
                      className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition"
                    >
                      <Share2 className="w-4 h-4" />
                      Send via WhatsApp
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-black rounded-2xl flex items-center justify-between">
                  <div>
                    <h5 className="font-black text-slate-900 text-xs">Need to cancel this transfer?</h5>
                    <p className="text-[11px] text-slate-500">You can revoke this code anytime before the buyer claims it.</p>
                  </div>
                  <button
                    onClick={handleCancelTransfer}
                    disabled={submitting}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-300 rounded-xl text-xs font-bold flex items-center gap-1 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Revoke Code
                  </button>
                </div>
              </div>
            ) : (
              /* Generate New Code Form */
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-950 space-y-1.5">
                  <div className="flex items-center gap-2 font-black text-blue-900 text-sm">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    Transfer Protocol Protection
                  </div>
                  <p className="leading-relaxed">
                    When the buyer claims this code, all verified <strong>maintenance history, appliance specs, warranties, and compliance records</strong> transfer seamlessly to their AnyTrader account. Your private billing records, payment methods, and personal notes remain securely separated and are never shared.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-black text-slate-900 block mb-1">
                      Buyer Full Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sarah Jenkins"
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      className="w-full p-3 rounded-xl border border-black text-xs font-bold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black text-slate-900 block mb-1">
                      Buyer or Conveyancer Email (Optional)
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. buyer@example.com or solicitor@lawfirm.co.uk"
                      value={buyerEmail}
                      onChange={(e) => setBuyerEmail(e.target.value)}
                      className="w-full p-3 rounded-xl border border-black text-xs font-bold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-black text-slate-900 block mb-1">
                        Code Validity Window
                      </label>
                      <select
                        value={validityDays}
                        onChange={(e) => setValidityDays(Number(e.target.value))}
                        className="w-full p-3 rounded-xl border border-black text-xs font-bold bg-slate-50 focus:bg-white shadow-sm"
                      >
                        <option value={14}>14 Days (Standard)</option>
                        <option value={30}>30 Days (Recommended)</option>
                        <option value={60}>60 Days (Extended)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-black text-slate-900 block mb-1">
                        Generated Transfer Code
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          readOnly
                          value={generatedCode}
                          className="w-full p-3 rounded-xl border border-black text-xs font-black bg-slate-100 text-slate-900 tracking-wider font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setGeneratedCode(generateTransferCode())}
                          className="p-3 bg-slate-100 hover:bg-slate-200 border border-black rounded-xl text-slate-700 transition"
                          title="Generate new code"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Handover Agreement Checkbox */}
                <div className="p-3.5 bg-slate-50 border border-black rounded-2xl">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmedTerms}
                      onChange={(e) => setConfirmedTerms(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-black text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-[11px] text-slate-700 leading-snug font-medium">
                      I confirm that ownership of <strong>{property.name || property.address?.line1 || "this property"}</strong> is being legally transferred upon sale/completion, and agree to transfer the verified digital passport to the purchaser.
                    </span>
                  </label>
                </div>

                {/* Submit Action */}
                <button
                  type="button"
                  disabled={submitting || !confirmedTerms}
                  onClick={handleInitiateTransfer}
                  className={`w-full py-3.5 px-4 rounded-xl border border-black text-xs font-black text-white shadow-md flex items-center justify-center gap-2 transition ${
                    confirmedTerms && !submitting ? "bg-blue-600 hover:bg-blue-700 active:scale-98" : "bg-slate-400 cursor-not-allowed"
                  }`}
                >
                  <KeyRound className="w-4 h-4" />
                  {submitting ? "Generating Code..." : "Activate Ownership Transfer Code"}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

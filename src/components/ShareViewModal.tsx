import React, { useState, useEffect } from "react";
import { db, doc, getDoc } from "@/src/firebase";
import { ShareType, maskSensitiveInfo } from "@/src/utils/shareUtils";
import { X, ShieldCheck, MessageSquare, ExternalLink, Copy, Check, FileText, Home, DollarSign, Building2, Wrench, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ShareViewModalProps {
  shareType: ShareType;
  shareId: string;
  onClose: () => void;
  onOpenChat?: (recipientId?: string, jobTitle?: string) => void;
}

export function ShareViewModal({ shareType, shareId, onClose, onOpenChat }: ShareViewModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSharedResource() {
      setLoading(true);
      setError(null);
      try {
        let collectionName = "jobs";
        if (shareType === "quote") collectionName = "quotes";
        else if (shareType === "invoice") collectionName = "invoices";
        else if (shareType === "passport") collectionName = "properties";

        const docRef = doc(db, collectionName, shareId);
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
          setData({ id: snapshot.id, ...snapshot.data() });
        } else {
          setError(`Shared ${shareType} record not found or link has expired.`);
        }
      } catch (err) {
        console.error("Error fetching shared link:", err);
        setError("Failed to load shared details. Please check your network connection.");
      } finally {
        setLoading(false);
      }
    }

    if (shareId && shareType) {
      fetchSharedResource();
    }
  }, [shareType, shareId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-lg bg-white rounded-3xl border border-black shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-black/10 bg-slate-900 text-white">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-600/30 text-blue-400 rounded-xl border border-blue-500/30">
                {shareType === "passport" && <Home className="w-5 h-5" />}
                {shareType === "job" && <Wrench className="w-5 h-5" />}
                {shareType === "quote" && <FileText className="w-5 h-5" />}
                {shareType === "invoice" && <DollarSign className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-extrabold capitalize tracking-tight flex items-center gap-1.5">
                  Shared TradeOS {shareType}
                  <span className="bg-emerald-500/20 text-emerald-400 text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Privacy Verified
                  </span>
                </h3>
                <p className="text-xs text-slate-400">Direct In-App Contact Bridge</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            {loading ? (
              <div className="py-12 text-center text-slate-500 space-y-3">
                <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-bold">Decrypting privacy link...</p>
              </div>
            ) : error ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs font-medium flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-900">Record Unavailable</p>
                  <p>{error}</p>
                </div>
              </div>
            ) : data ? (
              <div className="space-y-4">
                {/* Privacy Badge */}
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-xs text-emerald-900">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <p className="font-medium">
                    <span className="font-bold">Privacy Guaranteed:</span> Personal phone numbers and emails are masked. All communications happen securely inside TradeOS in-app messaging.
                  </p>
                </div>

                {/* Details Card */}
                <div className="p-5 rounded-2xl border border-black bg-slate-50 space-y-3">
                  <h4 className="font-black text-slate-900 text-lg leading-snug">
                    {data.title || data.name || `${shareType.toUpperCase()} #${data.id.slice(0, 8)}`}
                  </h4>

                  {data.description && (
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                      {maskSensitiveInfo(data.description)}
                    </p>
                  )}

                  {/* Specific Fields */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200">
                    {data.amount && (
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <p className="text-[10px] text-slate-500 uppercase font-extrabold">Amount</p>
                        <p className="font-black text-slate-900 text-sm">£{Number(data.amount).toLocaleString()}</p>
                      </div>
                    )}

                    {data.propertyType && (
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <p className="text-[10px] text-slate-500 uppercase font-extrabold">Property Type</p>
                        <p className="font-bold text-slate-900 capitalize">{data.propertyType}</p>
                      </div>
                    )}

                    {data.address?.line1 && (
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 col-span-2">
                        <p className="text-[10px] text-slate-500 uppercase font-extrabold">Address / Location</p>
                        <p className="font-bold text-slate-900">{maskSensitiveInfo(data.address.line1)}</p>
                      </div>
                    )}

                    {data.epcRating && (
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <p className="text-[10px] text-slate-500 uppercase font-extrabold">EPC Rating</p>
                        <p className="font-black text-blue-600">{data.epcRating}</p>
                      </div>
                    )}

                    {data.boilerInfo?.model && (
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <p className="text-[10px] text-slate-500 uppercase font-extrabold">Boiler Specs</p>
                        <p className="font-bold text-slate-900">{data.boilerInfo.model}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => {
                      onClose();
                      if (onOpenChat) {
                        onOpenChat(data.ownerId || data.traderId || data.userId, data.title || `${shareType} #${shareId}`);
                      }
                    }}
                    className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl border border-black shadow-md flex items-center justify-center gap-2 active:scale-98 transition"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Contact via In-App Chat
                  </button>

                  <button
                    onClick={handleCopy}
                    className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-xl border border-black flex items-center justify-center gap-2 transition"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Link Copied to Clipboard!" : "Copy Link to Re-Share"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

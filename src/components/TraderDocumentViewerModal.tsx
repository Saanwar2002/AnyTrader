import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, ShieldCheck, Flame, UserCheck, Video, Building, AlertTriangle, 
  CheckCircle2, FileText, ExternalLink, Download, Lock, RefreshCw, Calendar, Sparkles, Check
} from "lucide-react";
import { UnifiedTrustBadge, getTraderUnifiedTrustBadges } from "@/src/lib/trustBadges";
import { cn } from "@/src/lib/utils";

interface TraderDocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  trader: any;
  initialBadgeId?: string;
}

export const TraderDocumentViewerModal: React.FC<TraderDocumentViewerModalProps> = ({
  isOpen,
  onClose,
  trader,
  initialBadgeId
}) => {
  if (!isOpen || !trader) return null;

  const badges = getTraderUnifiedTrustBadges(trader);
  const [selectedBadgeId, setSelectedBadgeId] = useState<string>(
    initialBadgeId && badges.some(b => b.id === initialBadgeId) ? initialBadgeId : badges[0]?.id || "liability_insurance"
  );
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const activeBadge = badges.find(b => b.id === selectedBadgeId) || badges[0];

  const getBadgeIcon = (iconName: string, className: string = "w-4 h-4") => {
    switch (iconName) {
      case "ShieldCheck": return <ShieldCheck className={className} />;
      case "Flame": return <Flame className={className} />;
      case "UserCheck": return <UserCheck className={className} />;
      case "Video": return <Video className={className} />;
      case "Building": return <Building className={className} />;
      default: return <CheckCircle2 className={className} />;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-white rounded-3xl border-2 border-black shadow-2xl w-full max-w-3xl overflow-hidden my-auto flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-slate-900 text-white p-5 sm:p-6 relative border-b-2 border-black shrink-0">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 border-2 border-white/20 overflow-hidden flex items-center justify-center text-white text-2xl font-black shrink-0">
                {trader.avatarUrl ? (
                  <img src={trader.avatarUrl} alt={trader.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  trader.name?.charAt(0) || "T"
                )}
              </div>
              <div className="min-w-0 pr-8">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black text-white truncate">{trader.name}</h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Trust Verified
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium truncate mt-0.5">
                  {trader.businessName || trader.trades?.[0] || "Verified AnyTrader Professional"}
                </p>
              </div>
            </div>

            {/* Overall Live Expiry Status Banner */}
            <div className="mt-4 p-3 bg-slate-800/90 rounded-2xl border border-slate-700/80 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                <span className="font-bold text-slate-200">
                  5-Point Live Audit Engine
                </span>
              </div>
              <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest bg-blue-950/60 px-2.5 py-1 rounded-full border border-blue-800">
                Live Auto-Checked
              </span>
            </div>
          </div>

          {/* 5 Unified Checkmark Tab Bar */}
          <div className="bg-slate-100 p-2 sm:p-3 border-b border-slate-200 overflow-x-auto no-scrollbar flex items-center gap-2 shrink-0">
            {badges.map((badge) => {
              const isSelected = badge.id === selectedBadgeId;
              const isApproved = badge.status === "approved";
              const isExpired = badge.status === "expired";

              return (
                <button
                  key={badge.id}
                  onClick={() => setSelectedBadgeId(badge.id)}
                  className={cn(
                    "px-3 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border cursor-pointer relative",
                    isSelected
                      ? "bg-white text-slate-900 border-black shadow-md scale-102"
                      : "bg-slate-200/70 text-slate-700 border-transparent hover:bg-slate-200 hover:text-slate-900",
                    isExpired && "border-red-400 bg-red-50 text-red-900"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-white font-bold",
                    isApproved ? "bg-emerald-600" : isExpired ? "bg-red-600" : "bg-slate-400"
                  )}>
                    {isApproved ? (
                      <Check className="w-3 h-3 stroke-[3]" />
                    ) : isExpired ? (
                      <AlertTriangle className="w-3 h-3" />
                    ) : (
                      <Lock className="w-3 h-3" />
                    )}
                  </div>

                  <div className="text-left min-w-0">
                    <p className="text-[11px] font-black leading-tight truncate">{badge.shortLabel}</p>
                    <p className={cn(
                      "text-[9px] font-bold uppercase tracking-wider truncate",
                      isApproved ? "text-emerald-700" : isExpired ? "text-red-700" : "text-slate-500"
                    )}>
                      {isApproved ? "Active" : isExpired ? "Expired!" : "Unverified"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Badge Detailed Document Panel */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
            {activeBadge && (
              <div className="space-y-4">
                {/* Status Callout Banner */}
                <div className={cn(
                  "p-4 rounded-2xl border-2 flex items-start gap-3.5",
                  activeBadge.status === "approved"
                    ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                    : activeBadge.status === "expired"
                    ? "bg-red-50 border-red-300 text-red-900"
                    : "bg-slate-50 border-slate-300 text-slate-800"
                )}>
                  <div className={cn(
                    "p-2.5 rounded-xl shrink-0 text-white",
                    activeBadge.status === "approved" ? "bg-emerald-600" : activeBadge.status === "expired" ? "bg-red-600" : "bg-slate-600"
                  )}>
                    {getBadgeIcon(activeBadge.iconName, "w-6 h-6")}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                        {activeBadge.categorySpecificName}
                      </h3>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border",
                        activeBadge.status === "approved"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : activeBadge.status === "expired"
                          ? "bg-red-100 text-red-800 border-red-300"
                          : "bg-slate-200 text-slate-700 border-slate-300"
                      )}>
                        {activeBadge.status === "approved" ? "✅ Live & Verified" : activeBadge.status === "expired" ? "⚠️ EXPIRED CERTIFICATE" : "⏳ Pending Review"}
                      </span>
                    </div>

                    <p className="text-xs font-medium mt-1 opacity-90 leading-relaxed">
                      {activeBadge.status === "approved"
                        ? "This document has been audited and matched against official UK public registers and insurance databases."
                        : activeBadge.status === "expired"
                        ? `This certification expired on ${activeBadge.expiryDate || "recently"}. AnyTrader has requested an updated copy from the tradesperson.`
                        : "Verification is pending document upload and automated registry cross-reference."}
                    </p>
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-black/10">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Verification Register / Body</p>
                    <p className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                      {activeBadge.verifiedProvider}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-black/10">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Policy / Registration Number</p>
                    <p className="text-sm font-mono font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-slate-600 shrink-0" />
                      {activeBadge.policyOrRegNumber}
                    </p>
                  </div>

                  {activeBadge.expiryDate && (
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-black/10 sm:col-span-2">
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Expiration & Renewal Status</p>
                      <p className={cn(
                        "text-sm font-bold mt-1 flex items-center gap-2",
                        activeBadge.isExpired ? "text-red-700 font-extrabold" : "text-slate-900"
                      )}>
                        <Calendar className="w-4 h-4 text-slate-600 shrink-0" />
                        {activeBadge.isExpired ? (
                          <>EXPIRED on {new Date(activeBadge.expiryDate).toLocaleDateString()}</>
                        ) : (
                          <>Valid until {new Date(activeBadge.expiryDate).toLocaleDateString()} (Auto-monitored)</>
                        )}
                      </p>
                    </div>
                  )}
                </div>

                {/* Automated Check Output */}
                {activeBadge.autoCheckMessage && (
                  <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-blue-900 uppercase tracking-wider text-[10px]">
                      <RefreshCw className="w-3.5 h-3.5 text-blue-600" /> Auto-Cross-Reference Log
                    </div>
                    <p className="text-slate-700 font-medium leading-normal">{activeBadge.autoCheckMessage}</p>
                  </div>
                )}

                {/* Actual Document Proof Preview Card / Video Player */}
                <div className="p-4 bg-slate-900 text-white rounded-2xl border-2 border-black space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" /> Official Document Proof & Attachment
                    </h4>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                      {activeBadge.id === "video_credentials" ? "MP4 Video" : "PDF / JPEG Proof"}
                    </span>
                  </div>

                  {activeBadge.id === "video_credentials" ? (
                    <div className="w-full rounded-xl overflow-hidden bg-black border border-slate-700 aspect-video relative">
                      {activeBadge.docUrl ? (
                        <video
                          src={activeBadge.docUrl}
                          controls
                          className="w-full h-full object-cover"
                          poster={trader.avatarUrl}
                        >
                          Your browser does not support the video tag.
                        </video>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
                          <Video className="w-8 h-8 text-slate-600 mb-2" />
                          <p className="text-xs font-bold">No video recording uploaded yet</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative group rounded-xl overflow-hidden border border-slate-700 bg-slate-800 min-h-[180px] flex items-center justify-center">
                      <img
                        src={activeBadge.docUrl}
                        alt={activeBadge.docName}
                        className="w-full max-h-56 object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => window.open(activeBadge.docUrl, "_blank")}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg transition-transform active:scale-95"
                        >
                          <ExternalLink className="w-4 h-4" /> View Full Certificate
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span className="truncate">{activeBadge.docName || "Proof_Document.pdf"}</span>
                    <a
                      href={activeBadge.docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 underline cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Download Proof
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Close */}
          <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between shrink-0">
            <p className="text-[11px] text-slate-500 font-medium">
              🛡️ AnyTrader Trust Engine automatically validates credentials every 24 hours.
            </p>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

import React from "react";
import { Shield, ChevronDown, AlertCircle, Zap, Loader2, Upload } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AiProfileOptimizerSection } from "../AiProfileOptimizerSection";
import { TraderVideoVerificationCard } from "../TraderVideoVerificationCard";
import { TRADE_CATEGORIES } from "@/src/constants";
import { cn } from "@/src/lib/utils";

interface TrustVerificationCardProps {
  profile: any;
  user: any;
  onUpdateProfile: (updates: any) => void;
  isVerificationExpanded: boolean;
  setIsVerificationExpanded: (val: boolean) => void;
  verificationError: string | null;
  expiryDates: Record<string, string>;
  setExpiryDates: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  privacyConsent: Record<string, boolean>;
  setPrivacyConsent: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  handleVerificationUpload: (e: React.ChangeEvent<HTMLInputElement>, certType: string) => void;
  isUploading: boolean;
}

export const TrustVerificationCard: React.FC<TrustVerificationCardProps> = ({
  profile,
  user,
  onUpdateProfile,
  isVerificationExpanded,
  setIsVerificationExpanded,
  verificationError,
  expiryDates,
  setExpiryDates,
  privacyConsent,
  setPrivacyConsent,
  handleVerificationUpload,
  isUploading,
}) => {
  return (
    <div className="space-y-4">
      {/* ✨ AI Profile Optimization & Readiness Coach */}
      <AiProfileOptimizerSection 
        profile={profile} 
        onUpdateProfile={onUpdateProfile} 
      />

      {/* 📹 Trader Video Credential Verification */}
      <TraderVideoVerificationCard 
        profile={profile} 
        onUpdateProfile={onUpdateProfile} 
      />

      {/* 📜 Verification Center Card */}
      <div id="verification" className="bg-white rounded-[2rem] border border-black shadow-md bg-gradient-to-b from-white to-slate-50/50 overflow-hidden">
        <button 
          onClick={() => setIsVerificationExpanded(!isVerificationExpanded)}
          className="w-full p-5 sm:p-6 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-blue-50 rounded-2xl border border-black flex items-center justify-center text-blue-600 shadow-xs shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-black leading-tight">Verification Center</h3>
              <p className="text-xs text-black font-medium">Manage professional certificates & insurance</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn(
              "text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-wider shadow-xs border border-black",
              profile.verificationStatus === "verified" ? "bg-green-100 text-black" :
              profile.verificationStatus === "pending" ? "bg-amber-100 text-black" : "bg-slate-100 text-black"
            )}>
              {profile.verificationStatus || "Unverified"}
            </span>
            <motion.div
              animate={{ rotate: isVerificationExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-5 h-5 text-black" />
            </motion.div>
          </div>
        </button>

        <AnimatePresence>
          {isVerificationExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="p-5 sm:p-6 pt-0 border-t border-black">
                {user?.isAnonymous && (
                  <div className="mb-4 p-3.5 bg-amber-50 border border-black rounded-2xl flex items-start gap-2.5 mt-4">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-black text-black">Guest Account</p>
                      <p className="text-[11px] text-black leading-relaxed font-medium">
                        You are currently in guest preview. Sign up to permanently save your verified status.
                      </p>
                    </div>
                  </div>
                )}

                {verificationError && (
                  <div className="mb-4 p-3 bg-red-50 border border-black rounded-2xl text-red-600 text-xs font-bold flex items-center gap-2 mt-4">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {verificationError}
                  </div>
                )}

                <div className="space-y-3.5 mt-4">
                  {/* Base Requirements */}
                  {["Identity Verification (Passport/Driving License)", "Public Liability Insurance"].map((cert, idx) => {
                    const existingDoc = profile.verificationDocs?.find((d: any) => d.type === cert);
                    return (
                      <div key={`base-${idx}`} className="p-4 rounded-2xl border border-black bg-blue-50/30 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-black text-black">{cert}</p>
                            <p className="text-[10px] text-slate-600 font-medium">Required for all platform tradespeople</p>
                            {existingDoc?.rejectionReason && (
                              <p className="text-[10px] text-red-600 font-bold mt-1">Rejected: {existingDoc.rejectionReason}</p>
                            )}
                            {existingDoc?.autoCheck && existingDoc.status !== "rejected" && (
                              <div className="mt-1.5 p-2 bg-white rounded-lg border border-black">
                                <div className="flex items-center gap-1 mb-0.5">
                                  <Zap className="w-3 h-3 text-blue-500" />
                                  <span className="text-[9px] font-black text-blue-600 uppercase tracking-wider">Auto-Check Result</span>
                                </div>
                                <p className="text-[10px] text-black font-medium">{existingDoc.autoCheck.message}</p>
                              </div>
                            )}
                            {existingDoc?.expiryDate && (
                              <p className={cn(
                                "text-[10px] font-bold mt-1",
                                new Date(existingDoc.expiryDate) < new Date() ? "text-red-600 font-black" : "text-black font-medium"
                              )}>
                                Expires: {new Date(existingDoc.expiryDate).toLocaleDateString()}
                                {new Date(existingDoc.expiryDate) < new Date() && " (EXPIRED)"}
                              </p>
                            )}
                          </div>
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border border-black",
                            existingDoc?.status === "approved" ? "bg-green-100 text-black" :
                            existingDoc?.status === "rejected" ? "bg-red-100 text-black" :
                            existingDoc?.status === "pending" ? "bg-amber-100 text-black" : "bg-slate-200 text-black"
                          )}>
                            {existingDoc?.status || "Required"}
                          </span>
                        </div>
                        
                        {(existingDoc?.status !== "approved" || (existingDoc?.expiryDate && new Date(existingDoc.expiryDate) < new Date())) && (
                          <div className="space-y-2.5">
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-black uppercase">Expiry Date</p>
                              <input 
                                type="date" 
                                className="w-full p-2 bg-white rounded-xl border border-black text-xs font-bold text-black focus:ring-2 focus:ring-blue-500 outline-none"
                                value={expiryDates[cert] || ""}
                                onChange={(e) => setExpiryDates(prev => ({ ...prev, [cert]: e.target.value }))}
                                min={new Date().toISOString().split('T')[0]}
                              />
                            </div>

                            <div className="flex items-start gap-2 p-2 bg-white/70 rounded-xl border border-black">
                              <input 
                                type="checkbox" 
                                id={`consent-base-${idx}`}
                                className="mt-0.5 rounded border-black text-blue-600 focus:ring-blue-500"
                                checked={privacyConsent[cert] || false}
                                onChange={(e) => setPrivacyConsent(prev => ({ ...prev, [cert]: e.target.checked }))}
                              />
                              <label htmlFor={`consent-base-${idx}`} className="text-[10px] text-black leading-tight font-medium cursor-pointer">
                                I consent to secure processing of this document in accordance with UK GDPR.
                              </label>
                            </div>

                            <div className="relative">
                              <input 
                                type="file" 
                                id={`file-base-${idx}`}
                                className="sr-only" 
                                accept=".pdf,image/*" 
                                onChange={(e) => handleVerificationUpload(e, cert)} 
                                disabled={isUploading || !privacyConsent[cert]} 
                              />
                              <label 
                                htmlFor={`file-base-${idx}`}
                                className={cn(
                                  "w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed text-xs font-bold transition-all cursor-pointer",
                                  isUploading ? "bg-slate-50 border-black text-black cursor-wait" :
                                  privacyConsent[cert] 
                                    ? "border-black bg-white text-black hover:border-blue-500 hover:text-blue-600" 
                                    : "border-black text-slate-400 cursor-not-allowed bg-slate-50"
                                )}
                              >
                                {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                {isUploading ? "Uploading..." : existingDoc ? "Update Document" : "Upload Document"}
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Trade-specific requirements */}
                  {TRADE_CATEGORIES
                    .filter(t => profile.trades?.includes(t.name) && t.requiredCertifications)
                    .flatMap(t => t.requiredCertifications || [])
                    .map((cert, idx) => {
                      const existingDoc = profile.verificationDocs?.find((d: any) => d.type === cert);
                      return (
                        <div key={idx} className="p-4 rounded-2xl border border-black bg-slate-50 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-black text-black">{cert}</p>
                              {existingDoc?.rejectionReason && (
                                <p className="text-[10px] text-red-600 font-bold mt-1">Rejected: {existingDoc.rejectionReason}</p>
                              )}
                              {existingDoc?.expiryDate && (
                                <p className={cn(
                                  "text-[10px] font-bold mt-1",
                                  new Date(existingDoc.expiryDate) < new Date() ? "text-red-600 font-black" : "text-black font-medium"
                                )}>
                                  Expires: {new Date(existingDoc.expiryDate).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border border-black",
                              existingDoc?.status === "approved" ? "bg-green-100 text-black" :
                              existingDoc?.status === "pending" ? "bg-amber-100 text-black" : "bg-slate-200 text-black"
                            )}>
                              {existingDoc?.status || "Required"}
                            </span>
                          </div>
                          
                          {(existingDoc?.status !== "approved") && (
                            <div className="space-y-2.5">
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-black uppercase">Expiry Date</p>
                                <input 
                                  type="date" 
                                  className="w-full p-2 bg-white rounded-xl border border-black text-xs font-bold text-black focus:ring-2 focus:ring-blue-500 outline-none"
                                  value={expiryDates[cert] || ""}
                                  onChange={(e) => setExpiryDates(prev => ({ ...prev, [cert]: e.target.value }))}
                                  min={new Date().toISOString().split('T')[0]}
                                								/>
                              </div>
                              
                              <div className="flex items-start gap-2 p-2 bg-white rounded-xl border border-black">
                                <input 
                                  type="checkbox" 
                                  id={`consent-${cert}`}
                                  className="mt-0.5 rounded border-black text-blue-600 focus:ring-blue-500"
                                  checked={privacyConsent[cert] || false}
                                  onChange={(e) => setPrivacyConsent(prev => ({ ...prev, [cert]: e.target.checked }))}
                                />
                                <label htmlFor={`consent-${cert}`} className="text-[10px] text-black leading-tight font-medium cursor-pointer">
                                  I consent to secure processing of this document in accordance with UK GDPR.
                                </label>
                              </div>

                              <div className="relative">
                                <input 
                                  type="file" 
                                  id={`file-${cert}`}
                                  className="sr-only" 
                                  accept=".pdf,image/*" 
                                  onChange={(e) => handleVerificationUpload(e, cert)} 
                                  disabled={isUploading || !privacyConsent[cert]} 
                                />
                                <label 
                                  htmlFor={`file-${cert}`}
                                  className={cn(
                                    "w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed text-xs font-bold transition-all cursor-pointer",
                                    isUploading ? "bg-slate-50 border-black text-black cursor-wait" :
                                    privacyConsent[cert] 
                                      ? "border-black bg-white text-black hover:border-blue-500 hover:text-blue-600" 
                                      : "border-black text-slate-400 cursor-not-allowed bg-slate-50"
                                  )}
                                >
                                  {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                  {isUploading ? "Uploading..." : existingDoc ? "Update Document" : "Upload Document"}
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

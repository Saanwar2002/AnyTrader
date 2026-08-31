import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  AlertCircle, 
  RotateCw, 
  ShieldCheck, 
  Zap, 
  CreditCard, 
  Settings, 
  UserCheck, 
  FileText,
  PlusCircle,
  Video,
  Camera,
  Crown,
  Award
} from "lucide-react";
import { 
  auditProfileAndAccountReadiness, 
  ProfileAuditResult, 
  ProfileAuditSuggestion 
} from "@/src/services/aiProfileOptimizationService";
import { updateDoc, doc, db } from "@/src/firebase";

interface AiProfileOptimizerSectionProps {
  profile: any;
  onUpdateProfile: (updates: any) => void;
}

export function AiProfileOptimizerSection({ profile, onUpdateProfile }: AiProfileOptimizerSectionProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [auditResult, setAuditResult] = useState<ProfileAuditResult | null>(profile?.aiProfileAudit || null);
  const [appliedSuggestionIds, setAppliedSuggestionIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Initial auto-audit on mount if no audit exists
  useEffect(() => {
    let isMounted = true;
    async function initAudit() {
      if (!profile?.aiProfileAudit && profile?.uid) {
        setIsAuditing(true);
        try {
          const res = await auditProfileAndAccountReadiness(profile, false);
          if (isMounted) {
            setAuditResult(res);
          }
        } catch (e) {
          console.warn("Auto-audit failed:", e);
        } finally {
          if (isMounted) setIsAuditing(false);
        }
      }
    }
    initAudit();
    return () => { isMounted = false; };
  }, [profile?.uid]);

  const handleRunFreshAudit = async () => {
    setIsAuditing(true);
    try {
      const freshRes = await auditProfileAndAccountReadiness(profile, true);
      setAuditResult(freshRes);
      setToastMessage("✨ Fresh AI Profile Audit completed!");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (e) {
      console.error("Fresh audit failed:", e);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleApplySuggestion = async (sug: ProfileAuditSuggestion) => {
    if (!profile?.uid) return;

    try {
      const updates: any = {};

      if (sug.actionType === "apply_bio" && sug.suggestedValue) {
        const newBio = typeof sug.suggestedValue === "string" ? sug.suggestedValue : sug.suggestedValue[0];
        updates.bio = newBio;
        updates.description = newBio;
      } else if (sug.actionType === "add_skill" && sug.suggestedValue) {
        const skillsToAdd = Array.isArray(sug.suggestedValue) ? sug.suggestedValue : [sug.suggestedValue];
        const existingServices = profile.services || profile.skills || [];
        const mergedServices = Array.from(new Set([...existingServices, ...skillsToAdd]));
        updates.services = mergedServices;
        updates.skills = mergedServices;
      } else if (sug.actionType === "activate_priority_alerts") {
        updates.priorityAlertsEnabled = true;
      } else if (sug.actionType === "upgrade_subscription") {
        setAppliedSuggestionIds(prev => [...prev, sug.id]);
        const billingEl = document.getElementById("billing") || document.getElementById("subscription");
        if (billingEl) {
          billingEl.scrollIntoView({ behavior: "smooth" });
        } else {
          window.location.hash = "billing";
        }
        setToastMessage("🚀 Navigating to TradeOS PRO Plans & Billing...");
        setTimeout(() => setToastMessage(null), 3000);
        return;
      } else if (sug.actionType === "explore_ads") {
        setAppliedSuggestionIds(prev => [...prev, sug.id]);
        window.location.href = "/ad-studio";
        return;
      } else if (sug.actionType === "upload_media") {
        setAppliedSuggestionIds(prev => [...prev, sug.id]);
        const videoEl = document.getElementById("trader-video-verification");
        if (videoEl) videoEl.scrollIntoView({ behavior: "smooth" });
        return;
      } else if (sug.actionType === "setup_payment" || sug.actionType === "update_setting") {
        setAppliedSuggestionIds(prev => [...prev, sug.id]);
        const settingEl = document.getElementById("account-settings") || document.getElementById("notifications");
        if (settingEl) settingEl.scrollIntoView({ behavior: "smooth" });
        return;
      }

      if (Object.keys(updates).length > 0) {
        // Update local profile state
        onUpdateProfile(updates);

        // Update Firestore doc
        const userRef = doc(db, "users", profile.uid);
        await updateDoc(userRef, updates);

        // Update local applied state
        setAppliedSuggestionIds(prev => [...prev, sug.id]);
        setToastMessage(`✅ Applied: ${sug.title}`);
        setTimeout(() => setToastMessage(null), 3000);

        // Re-run background lightweight audit update
        setTimeout(async () => {
          const updatedAudit = await auditProfileAndAccountReadiness({ ...profile, ...updates }, true);
          setAuditResult(updatedAudit);
        }, 500);
      }
    } catch (err) {
      console.error("Failed to apply suggestion:", err);
    }
  };

  const healthScore = auditResult?.healthScore ?? 75;
  const suggestions = auditResult?.suggestions ?? [];
  const unappliedSuggestions = suggestions.filter(s => !appliedSuggestionIds.includes(s.id));
  const hasUnread = unappliedSuggestions.length > 0;

  // Score status colors
  const healthBadgeBg = 
    healthScore >= 85 ? "bg-emerald-100 text-emerald-900 border-emerald-300" :
    healthScore >= 60 ? "bg-amber-100 text-amber-900 border-amber-300" :
    "bg-red-100 text-red-900 border-red-300";

  return (
    <div id="ai-profile-optimizer" className="bg-white rounded-[2rem] border border-black shadow-[0_8px_30px_rgb(0,0,0,0.08)] bg-gradient-to-b from-slate-900 via-slate-900 to-black text-white overflow-hidden mb-8 transition-all">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="bg-emerald-500 text-black px-4 py-2 font-black text-xs text-center flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header Bar (Collapsible Toggle) */}
      <div 
        className="p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 via-emerald-400 to-blue-500 p-0.5 shadow-lg">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-amber-300">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
            </div>
            {/* Live Pulsing Dot */}
            {hasUnread && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-slate-900"></span>
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                ✨ AI Profile Optimization & Readiness Coach
              </h2>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${healthBadgeBg}`}>
                {healthScore}% Health Score
              </span>
            </div>
            <p className="text-xs text-slate-300 truncate mt-0.5">
              {auditResult?.summary || "Auto-auditing profile completeness & category match parity..."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-auto" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleRunFreshAudit}
            disabled={isAuditing}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-white/20 transition-all active:scale-95 disabled:opacity-50"
            title="Run Fresh AI Profile Audit"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isAuditing ? "animate-spin text-amber-400" : ""}`} />
            <span className="hidden sm:inline">{isAuditing ? "Auditing..." : "Re-Audit"}</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 bg-emerald-400 text-black font-black text-xs px-3.5 py-1.5 rounded-xl hover:bg-emerald-300 transition-all shadow-md active:scale-95"
          >
            <span>{isExpanded ? "Auto-Close" : unappliedSuggestions.length > 0 ? `Suggestions (${unappliedSuggestions.length})` : "View Readiness"}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Collapsed Compact Readiness Indicator Bar */}
      {!isExpanded && (
        <div className="px-6 pb-4 pt-0 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 text-xs text-slate-400">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Bio & Keywords: <strong className="text-white">{profile?.bio ? "Configured" : "Needs Intro"}</strong></span>
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Video Verification: <strong className="text-white">{profile?.isVideoVerified || profile?.videoVerificationUrl ? "Verified (+35 pts)" : "Pending"}</strong></span>
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <CreditCard className="w-4 h-4 text-blue-400" />
              <span>Payouts Setup: <strong className="text-white">{profile?.stripeAccountId || profile?.payoutsEnabled ? "Connected" : "Pending Setup"}</strong></span>
            </span>
          </div>

          <button 
            onClick={() => setIsExpanded(true)}
            className="text-amber-300 hover:underline font-bold text-xs"
          >
            Expand Coach Suggestions &rarr;
          </button>
        </div>
      )}

      {/* Expanded Drawer Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t border-white/10 p-5 sm:p-6 bg-slate-950/80 space-y-6"
          >
            {/* Overview Banner */}
            <div className="bg-gradient-to-r from-blue-900/40 via-purple-900/40 to-slate-900 p-4 rounded-2xl border border-blue-500/30 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-200 leading-relaxed">
                <p className="font-bold text-white text-sm">
                  Why Profile Readiness Matters
                </p>
                <p className="mt-1 text-slate-300">
                  Profiles with clear professional bios, complete trade keywords, and video credentials receive <strong className="text-emerald-300">3x more local job matches</strong> and <strong className="text-emerald-300">45% higher quote acceptance</strong> from homeowners.
                </p>
              </div>
            </div>

            {/* Suggestions Feed */}
            {suggestions.length === 0 ? (
              <div className="text-center py-8 bg-white/5 rounded-2xl border border-white/10">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
                <h3 className="text-base font-bold text-white">Profile & Account 100% Optimized</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Your profile wording, trade keywords, credentials, and payment readiness are fully configured to maximize job matches across your region.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>AI Suggestions ({suggestions.length})</span>
                  <span>Click to auto-implement</span>
                </h3>

                <div className="grid grid-cols-1 gap-4">
                  {suggestions.map((sug) => {
                    const isApplied = appliedSuggestionIds.includes(sug.id);

                    return (
                      <div 
                        key={sug.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          isApplied 
                            ? "bg-emerald-950/20 border-emerald-500/40 opacity-70" 
                            : "bg-white/5 hover:bg-white/[0.08] border-white/15"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="mt-0.5 shrink-0">
                              {sug.category === "bio" && <FileText className="w-5 h-5 text-amber-400" />}
                              {sug.category === "skills" && <PlusCircle className="w-5 h-5 text-emerald-400" />}
                              {sug.category === "credentials" && <ShieldCheck className="w-5 h-5 text-purple-400" />}
                              {sug.category === "payments" && <CreditCard className="w-5 h-5 text-blue-400" />}
                              {sug.category === "settings" && <Settings className="w-5 h-5 text-slate-300" />}
                              {sug.category === "subscriptions" && <Crown className="w-5 h-5 text-amber-300 animate-pulse" />}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-bold text-white">{sug.title}</h4>
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                                  sug.impact === "high" ? "bg-red-500/20 text-red-300 border border-red-500/30" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                }`}>
                                  {sug.impact} impact
                                </span>
                              </div>
                              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                {sug.description}
                              </p>

                              {/* Preview suggested values if bio or skills */}
                              {sug.category === "bio" && sug.suggestedValue && !isApplied && (
                                <div className="mt-3 p-3 bg-black/50 rounded-xl border border-white/10 text-xs text-slate-200">
                                  <span className="text-[10px] uppercase font-black text-amber-300 block mb-1">
                                    ✨ Suggested Professional Bio Draft:
                                  </span>
                                  <p className="italic text-slate-300">"{sug.suggestedValue}"</p>
                                </div>
                              )}

                              {sug.category === "skills" && Array.isArray(sug.suggestedValue) && !isApplied && (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                  {sug.suggestedValue.map((sk, idx) => (
                                    <span key={idx} className="text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                                      + {sk}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0 self-center">
                            {isApplied ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/20 px-3 py-1.5 rounded-xl border border-emerald-500/30">
                                <CheckCircle2 className="w-4 h-4" />
                                Applied
                              </span>
                            ) : (
                              <button
                                onClick={() => handleApplySuggestion(sug)}
                                className="bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-black px-4 py-2 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                              >
                                <span>{sug.actionLabel}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

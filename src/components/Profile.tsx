import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { BiometricService } from "@/src/services/biometricService";
import { Fingerprint, ScanFace } from "lucide-react";
import { auth, logout, db, doc, updateDoc, handleFirestoreError, OperationType, storage, ref, uploadBytes, getDownloadURL, uploadStorageFile, collection, query, where, or, and, orderBy, getDocs, onSnapshot, sendNotification } from "@/src/firebase";
import { 
  LogOut, User, Mail, MapPin, Calendar, Shield, Edit2, Check, X, Loader2, Download, FileCheck, Upload, Clock, Star, Image as ImageIcon, Trash2, Briefcase, ChevronRight, Plus,
  Bell, Layout, Home, CreditCard, Bot, BarChart3, Search, History, Zap, HelpCircle, FileText, Pencil, Camera, GripVertical, Info, BookOpen, AlertCircle, Users, ChevronDown,
  ShieldCheck, CheckCircle, CheckCircle2, Heart, Moon, Award, RefreshCw, Pause, Play, XCircle, Sparkles, ShieldAlert, Phone,
  Settings, Gift, MessageSquare, Repeat, Ticket, Locate, Accessibility, Percent, Lock, Globe, Building, PoundSterling, ClipboardList, CalendarClock, Smartphone, Monitor
} from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { polishBio } from "@/src/services/gemini";
import { motion, AnimatePresence } from "motion/react";
import { usePWAInstall } from "@/src/hooks/usePWAInstall";
import { usePortal } from "@/src/lib/PortalContext";
import { CURRENT_APP_VERSION, checkUpdateNeeded, requestStoreReview } from "@/src/lib/version";
import { AppUpdateModal } from "./common/AppUpdateModal";
import { TraderVideoVerificationCard } from "./TraderVideoVerificationCard";
import { AiProfileOptimizerSection } from "./AiProfileOptimizerSection";
import { TraderIdentityCard } from "./profile/TraderIdentityCard";
import { TrustVerificationCard } from "./profile/TrustVerificationCard";
import { BioOfferingsCard } from "./profile/BioOfferingsCard";
import { RatesFaqsCard, FAQ_PRESETS } from "./profile/RatesFaqsCard";
import { GrowthNotificationsCard } from "./profile/GrowthNotificationsCard";
import { HomeownerIdentityCard } from "./profile/HomeownerIdentityCard";
import { SafetyEmergencyCard } from "./profile/SafetyEmergencyCard";
import TraderNotificationPreferencesModal from "./TraderNotificationPreferencesModal";
import { cn } from "@/src/lib/utils";
import { normalizeTraderTier } from "@/src/services/stripeIntegrationService";
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  TouchSensor
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { TRADE_CATEGORIES, PROFESSIONAL_BADGES } from "@/src/constants";
import { TermsModal } from "./TermsModal";
import { CURRENT_TERMS_VERSION } from "../constants/termsAndPrivacy";
import { getTraderBadges, BadgeOverlay } from "@/src/lib/badges";
import { lookupPostcode } from "@/src/services/postcodeService";
import { performInitialPublicRecordCheck } from "../services/verificationService";

function SortablePortfolioItem({ url, onRemove }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: url });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={cn(
        "group relative aspect-square rounded-2xl overflow-hidden border border-black shadow-sm bg-slate-50 cursor-grab active:cursor-grabbing",
        isDragging && "shadow-xl ring-2 ring-blue-600 scale-105"
      )}
    >
      <div className="w-full h-full" {...attributes} {...listeners}>
        <img 
          src={url} 
          alt="Portfolio" 
          className="w-full h-full object-cover transition-transform group-hover:scale-110" 
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur-sm rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-sm text-slate-400">
          <GripVertical className="w-4 h-4" />
        </div>
      </div>
      
      <div className="absolute inset-0 bg-black/40 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
        <button 
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(url);
          }}
          className="p-2 bg-white rounded-full text-red-600 hover:bg-red-50 transition-colors shadow-lg pointer-events-auto active:scale-90"
          title="Delete Image"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function ReferralCard({ profile }: { profile: any }) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const referralLink = `${window.location.origin}/onboarding?ref=${profile.referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isBoosted = profile.referralBoostUntil && new Date(profile.referralBoostUntil) > new Date();

  return (
    <div className={cn(
      "bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 rounded-[2rem] text-white shadow-2xl shadow-blue-600/20 relative overflow-hidden group transition-all duration-500 border border-black/10",
      isExpanded ? "p-5" : "p-5"
    )}>
      {/* Animated background elements */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-white/20 transition-all duration-700" />
      <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-400/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
      
      <div className="relative z-10 space-y-5">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-4">
            <div className={cn(
              "rounded-2xl bg-white/10 backdrop-blur-xl border border-black/20 flex items-center justify-center transition-all duration-500 shadow-lg",
              isExpanded ? "w-14 h-14" : "w-12 h-12"
            )}>
              <Zap className={cn("text-yellow-300 fill-yellow-300 drop-shadow-[0_0_8px_rgba(253,224,71,0.6)]", isExpanded ? "w-7 h-7" : "w-6 h-6")} />
            </div>
            <div>
              <h3 className={cn("font-black uppercase tracking-tighter leading-none mb-1", isExpanded ? "text-2xl" : "text-lg")}>Refer a Trade</h3>
              <p className={cn("text-blue-100/80 font-bold uppercase tracking-[0.2em]", isExpanded ? "text-xs" : "text-[10px]")}>
                Get Boosted & Priority Access
              </p>
            </div>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className={cn(
              "rounded-full bg-white/10 backdrop-blur-md border border-black/20 flex items-center justify-center hover:bg-white/20 transition-colors shadow-sm",
              isExpanded ? "w-12 h-12" : "w-10 h-10"
            )}
          >
            <ChevronDown className={isExpanded ? "w-7 h-7" : "w-6 h-6"} />
          </motion.div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden space-y-6 pt-2"
            >
              <div className="space-y-2">
                <p className="text-sm leading-relaxed text-blue-50">
                  Invite other tradespeople to join AnyTrader. Once they register and get verified, you'll receive:
                </p>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2 text-xs font-bold">
                    <Check className="w-4 h-4 text-green-400" />
                    Profile pushed to top search results
                  </li>
                  <li className="flex items-center gap-2 text-xs font-bold">
                    <Check className="w-4 h-4 text-green-400" />
                    Priority job offers
                  </li>
                </ul>
              </div>

              {isBoosted && (
                <div className="bg-white/20 backdrop-blur-md border border-black/30 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-yellow-400 flex items-center justify-center shadow-lg shadow-yellow-400/20">
                      <Zap className="w-5 h-5 text-slate-900 fill-slate-900" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider">Active Boost</p>
                      <p className="text-[10px] text-blue-100 font-bold">Expires: {new Date(profile.referralBoostUntil).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="px-3 py-1 bg-white text-blue-600 rounded-full text-[10px] font-black uppercase">Live</div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-blue-200">Your Referral Link</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-white/10 backdrop-blur-md border border-black/20 rounded-xl px-4 py-3 text-sm font-mono truncate">
                    {referralLink}
                  </div>
                  <button 
                    onClick={handleCopy}
                    className={cn(
                      "px-6 py-3 rounded-xl font-black uppercase text-xs transition-all active:scale-95 shadow-lg",
                      copied ? "bg-green-500 text-white" : "bg-white text-blue-600 hover:bg-blue-50"
                    )}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, '0');
  return `${hour}:00`;
});

const BiometricSettings: React.FC<{ user: any }> = ({ user }) => {
  const [available, setAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<"face" | "fingerprint" | "none" | "biometric">("biometric");
  const [enabled, setEnabled] = useState(false);
  const [password, setPassword] = useState("");
  const [showEnrollForm, setShowEnrollForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function checkSupport() {
      const status = await BiometricService.checkAvailability();
      setAvailable(status.available);
      setBiometricType(status.type);
      setEnabled(BiometricService.isEnabled());
    }
    checkSupport();
  }, []);

  const handleToggle = async () => {
    setError(null);
    setSuccess(null);
    if (enabled) {
      BiometricService.disable();
      setEnabled(false);
      setSuccess("Biometric sign-in successfully disabled.");
    } else {
      setShowEnrollForm(true);
    }
  };

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const email = user?.email;
    if (!email) {
      setError("Please ensure you are signed in with a valid email account.");
      return;
    }
    if (!password.trim()) {
      setError("Please enter your account password to confirm enrollment.");
      return;
    }

    setLoading(true);
    try {
      // First, prompt biometric authorization gesture
      const verified = await BiometricService.authenticate("Confirm biometric signature to enable secure biometric login");
      if (verified) {
        const enrolled = await BiometricService.enroll(email, password);
        if (enrolled) {
          setEnabled(true);
          setShowEnrollForm(false);
          setPassword("");
          setSuccess("Biometric sign-in configured successfully!");
        } else {
          setError("Failed to enroll credentials locally.");
        }
      } else {
        setError("Biometric validation cancelled or failed.");
      }
    } catch (err: any) {
      setError(err?.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-5 bg-slate-50/50 font-sans">
      <div className="p-6 bg-white border border-black rounded-2xl shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0 border border-black/10">
              {biometricType === "face" ? (
                <ScanFace className="w-6 h-6 text-blue-600" />
              ) : (
                <Fingerprint className="w-6 h-6 text-blue-600" />
              )}
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 leading-tight">Biometric Authentication</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm font-bold">
                {!available
                  ? "Biometrics are not supported or configured on this device."
                  : `Enable rapid ${biometricType === "face" ? "FaceID" : "Fingerprint"} sign-in on your next app launch.`}
              </p>
            </div>
          </div>
          {available && (
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={handleToggle}
              className={cn(
                "relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full border border-black transition-colors duration-200 ease-in-out focus:outline-none",
                enabled ? "bg-emerald-600" : "bg-slate-200"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs border border-black transition duration-200 ease-in-out",
                  enabled ? "translate-x-5" : "translate-x-0.5"
                )}
              />
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs font-bold rounded-xl flex items-center gap-2">
            <p className="flex-1">{error}</p>
          </div>
        )}

        {success && (
          <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
            <p className="flex-1">{success}</p>
          </div>
        )}

        {showEnrollForm && (
          <form onSubmit={handleEnroll} className="mt-6 pt-5 border-t border-slate-100 flex flex-col gap-4 text-left">
            <div>
              <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-2">
                Verify Account Password
              </label>
              <input
                type="password"
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-xs font-medium text-slate-900"
                required
              />
              <p className="text-[10px] text-slate-400 mt-2 font-bold">
                Please enter your account password to secure biometric key setup on this client device.
              </p>
            </div>
            
            <div className="flex gap-2.5">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-5 py-3 bg-black text-white text-[11px] font-black uppercase tracking-wider rounded-xl hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Verify & Enable"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEnrollForm(false);
                  setPassword("");
                  setError(null);
                }}
                className="px-5 py-3 bg-slate-100 border border-black/10 text-slate-700 text-[11px] font-black uppercase tracking-wider rounded-xl hover:bg-slate-200 active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default function Profile() {
  const { user, profile, setProfile, setIsTradeBotOpen } = useAuth();
  const isBusinessProfile = profile?.role === 'business' || profile?.role === 'tradesperson';
  const { activePortal, switchPortal } = usePortal();
  const navigate = useNavigate();
  const location = useLocation();
  const { isInstallable, installApp } = usePWAInstall();

  const [showManualUpdateModal, setShowManualUpdateModal] = useState(false);
  const [uiMode, setUiMode] = useState<"classic" | "mobile">(
    profile?.uiMode || (localStorage.getItem("app_ui_mode") as "classic" | "mobile") || "mobile"
  );

  useEffect(() => {
    if (profile?.uiMode && profile.uiMode !== uiMode) {
      setUiMode(profile.uiMode);
      localStorage.setItem("app_ui_mode", profile.uiMode);
    }
  }, [profile?.uiMode]);

  const handleUiModeChange = async (mode: "classic" | "mobile") => {
    setUiMode(mode);
    localStorage.setItem("app_ui_mode", mode);
    if (user?.uid) {
      try {
        await updateDoc(doc(db, "users", user.uid), { uiMode: mode });
      } catch (e) {
        console.error("Error updating UI mode in Firestore:", e);
      }
    }
    setProfile((prev: any) => ({ ...prev, uiMode: mode }));
  };

  const renderUiModeSelector = () => (
    <div className="p-4 sm:p-5 bg-slate-50 border-t border-black rounded-b-3xl space-y-3">
      <div className="bg-white p-4 rounded-2xl border border-black shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-black text-slate-900 leading-tight">Display Layout Mode</h4>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Choose your preferred layout experience for mobile and desktop screens.</p>
          </div>
          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider rounded-full border border-blue-100 shrink-0">
            {uiMode === "mobile" ? "Mobile Friendly" : "Classic"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={() => handleUiModeChange("mobile")}
            className={cn(
              "p-3.5 rounded-xl border-2 text-left transition-all flex items-start gap-3 relative overflow-hidden",
              uiMode === "mobile" 
                ? "bg-slate-900 text-white border-black shadow-md" 
                : "bg-white text-slate-800 border-slate-200 hover:border-slate-400"
            )}
          >
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5", uiMode === "mobile" ? "bg-blue-500/20 text-blue-400" : "bg-slate-100 text-slate-600")}>
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs">Mobile Friendly</span>
                {uiMode === "mobile" && <Check className="w-3.5 h-3.5 text-blue-400" />}
              </div>
              <p className={cn("text-[10px] leading-tight mt-1", uiMode === "mobile" ? "text-slate-300" : "text-slate-500")}>
                Bottom sticky action bars, 48px touch targets, swipe sheets & haptic feedback.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleUiModeChange("classic")}
            className={cn(
              "p-3.5 rounded-xl border-2 text-left transition-all flex items-start gap-3 relative overflow-hidden",
              uiMode === "classic" 
                ? "bg-slate-900 text-white border-black shadow-md" 
                : "bg-white text-slate-800 border-slate-200 hover:border-slate-400"
            )}
          >
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5", uiMode === "classic" ? "bg-blue-500/20 text-blue-400" : "bg-slate-100 text-slate-600")}>
              <Monitor className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs">Classic</span>
                {uiMode === "classic" && <Check className="w-3.5 h-3.5 text-blue-400" />}
              </div>
              <p className={cn("text-[10px] leading-tight mt-1", uiMode === "classic" ? "text-slate-300" : "text-slate-500")}>
                Standard desktop layout with classic top controls & traditional modals.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* App Version & OTA Updates Section */}
      <div className="bg-white p-4 rounded-2xl border border-black shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
              <Sparkles className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900 leading-tight">App Information & Version</h4>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Installed Version: <span className="font-mono font-bold text-slate-800">v{CURRENT_APP_VERSION}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => requestStoreReview()}
              className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-black text-[11px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-sm flex items-center gap-1.5"
            >
              <Star className="w-3.5 h-3.5 fill-black" />
              <span>Rate App</span>
            </button>

            <button
              onClick={() => setShowManualUpdateModal(true)}
              className="px-3 py-2 bg-black hover:bg-slate-800 text-white text-[11px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-sm flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Check for Updates</span>
            </button>
          </div>
        </div>

        <AppUpdateModal
          platformConfig={platformConfig}
          isOpenOverride={showManualUpdateModal}
          onCloseOverride={() => setShowManualUpdateModal(false)}
          isManualCheck={true}
        />
      </div>
    </div>
  );

  const [isEditing, setIsEditing] = useState(false);
  const [isEditingMiniProfile, setIsEditingMiniProfile] = useState(false);
  const [expandedMenuId, setExpandedMenuId] = useState<string | null>(null);
  const [expandedMenuGroups, setExpandedMenuGroups] = useState<string[]>([]);
  const [isEditingNotifications, setIsEditingNotifications] = useState(false);
  const [isEditingIM, setIsEditingIM] = useState(false);
  const [showBioInfo, setShowBioInfo] = useState(false);
  const [showBadgeInfo, setShowBadgeInfo] = useState(false);
  const [showUserGuide, setShowUserGuide] = useState(false);
  const [showProfileTermsModal, setShowProfileTermsModal] = useState(false);
  const [isAchievementsExpanded, setIsAchievementsExpanded] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isVerificationExpanded, setIsVerificationExpanded] = useState(false);
  const [isNotificationsExpanded, setIsNotificationsExpanded] = useState(false);
  const [showMatchTimingModal, setShowMatchTimingModal] = useState(false);
  const [isBannerAdsEnabled, setIsBannerAdsEnabled] = useState(true);
  const [isEditingServices, setIsEditingServices] = useState(false);
  const [tempServices, setTempServices] = useState<string[]>([]);
  const [newService, setNewService] = useState("");
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});
  const [privacyConsent, setPrivacyConsent] = useState<Record<string, boolean>>({});
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isAIPolishing, setIsAIPolishing] = useState(false);
  const [editData, setEditData] = useState({
    name: profile?.name || "",
    postcode: profile?.postcode || "",
    city: profile?.city || "",
    county: profile?.county || "",
    bio: profile?.bio || "",
    trades: (profile?.trades || []).join(", "),
    tags: (profile?.tags || []).join(", "),
    services: profile?.services || [],
    badges: profile?.badges || [],
    searchFeedBadges: profile?.searchFeedBadges || [],
    miniProfileSettings: profile?.miniProfileSettings || { hourlyRate: 0, callOutFee: 0, extraInfo: "" }
  });
  const [notificationSettings, setNotificationSettings] = useState(profile?.notificationSettings || {
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
    pushEnabled: true,
    emailEnabled: true
  });
  const [newEmergencyContact, setNewEmergencyContact] = useState({ name: "", phone: "" });
  const [isAddingEmergency, setIsAddingEmergency] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [platformConfig, setPlatformConfig] = useState<any>(null);
  const [globalTiers, setGlobalTiers] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [visibleReviewsCount, setVisibleReviewsCount] = useState<number>(5);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [isUploadingPortfolio, setIsUploadingPortfolio] = useState(false);
  const [usage, setUsage] = useState({ quotes: 0, acceptedQuotes: 0 });
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [showCheckoutForTier, setShowCheckoutForTier] = useState<any | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [savedCards, setSavedCards] = useState<any[]>([]);
  const [isProcessingSetup, setIsProcessingSetup] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [cvc, setCvc] = useState("");
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeTiers = React.useMemo(() => {
    if (!platformConfig) return [];
    if (profile?.role === "homeowner") {
      if (globalTiers?.providerModels?.homeowners?.tiers) {
        return Object.entries(globalTiers.providerModels.homeowners.tiers).map(([k, v]: [string, any]) => ({
          name: k,
          price: v.price || 0,
          description: v.description,
          maxQuotes: v.maxQuotes || 0,
          maxAcceptedQuotes: v.maxAcceptedQuotes || 0,
          commission: (v.commission || 0) * 100,
          limitPeriod: "monthly",
          leadFee: v.leadFee || 0,
          includesRecommendation: k.toLowerCase() === "business"
        })).sort((a,b) => a.price - b.price);
      }
      return platformConfig.businessTiers || [];
    } else if (profile?.role === "driver") {
      if (globalTiers?.providerModels?.on_demand_transport?.tiers) {
        return Object.entries(globalTiers.providerModels.on_demand_transport.tiers).map(([k, v]: [string, any]) => ({
          name: k,
          price: v.price || 0,
          description: v.description,
          maxQuotes: v.maxQuotes || 9999,
          maxAcceptedQuotes: v.maxAcceptedQuotes || 9999,
          commission: (v.commission || 0) * 100,
          limitPeriod: "monthly",
          leadFee: v.leadFee || 0,
          includesRecommendation: false
        })).sort((a,b) => a.price - b.price);
      }
      return [];
    } else {
      if (globalTiers?.providerModels?.one_off_trades?.tiers) {
        return Object.entries(globalTiers.providerModels.one_off_trades.tiers).map(([k, v]: [string, any]) => ({
          name: k,
          price: v.price || 0,
          description: v.description,
          maxQuotes: v.maxQuotes || 10,
          maxAcceptedQuotes: v.maxAcceptedQuotes || 2,
          commission: (v.commission || 0) * 100, // ui expects whole numbers
          limitPeriod: "monthly",
          leadFee: v.leadFee || 0,
          includesRecommendation: k.toLowerCase() === "pro"
        })).sort((a,b) => a.price - b.price);
      }
      return platformConfig.feeTiers || [];
    }
  }, [profile?.role, platformConfig, globalTiers]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id && user) {
      const oldIndex = (profile.portfolio || []).indexOf(active.id as string);
      const newIndex = (profile.portfolio || []).indexOf(over?.id as string);
      
      const newPortfolio = arrayMove(profile.portfolio || [], oldIndex, newIndex);
      setProfile((prev: any) => ({ ...prev, portfolio: newPortfolio }));
      
      try {
        await updateDoc(doc(db, "users", user.uid), {
          portfolio: newPortfolio
        });
      } catch (err) {
        console.error("Error reordering portfolio:", err);
      }
    }
  };

  useEffect(() => {
    if ((isEditing || isEditingIM) && profile) {
      setEditData({
        name: profile.name || "",
        postcode: profile.postcode || "",
        city: profile.city || "",
        county: profile.county || "",
        bio: profile.bio || "",
        trades: (profile.trades || []).join(", "),
        tags: (profile.tags || []).join(", "),
        services: profile.services || [],
        badges: profile.badges || [],
        searchFeedBadges: profile.searchFeedBadges || [],
        miniProfileSettings: profile.miniProfileSettings || { hourlyRate: 0, callOutFee: 0, extraInfo: "" },
        isAvailableForInstantMatch: profile.isAvailableForInstantMatch || false,
        instantMatchPricing: profile.instantMatchPricing || { callOutFee: 0, hourlyRate: 0, terms: "" }
      });
    }
  }, [isEditing, isEditingIM, isEditingMiniProfile, profile]);

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, "platform_config", "advertising"), (docSnapshot) => {
      if (docSnapshot.exists()) {
        setIsBannerAdsEnabled(docSnapshot.data().isBannerAdsEnabled !== false);
      }
    });
    return () => unsubConfig();
  }, []);

  useEffect(() => {
    if (profile?.role === "tradesperson" && user?.uid) {
      setLoadingReviews(true);
      const q = query(
        collection(db, "reviews"),
        where("revieweeId", "==", user.uid),
        orderBy("createdAt", "desc")
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedReviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Only show published reviews or reviews without a status (legacy)
        setReviews(fetchedReviews.filter((r: any) => r.status !== "cooling_off"));
        setLoadingReviews(false);
      }, (error) => {
        console.error("Error fetching reviews:", error);
        handleFirestoreError(error, OperationType.LIST, "reviews");
        setLoadingReviews(false);
      });

      return () => unsubscribe();
    }
  }, [user?.uid, profile?.role]);

  useEffect(() => {
    if (user?.uid) {
      fetchPaymentMethods(user.uid);
    }
  }, [user?.uid]);

  const fetchPaymentMethods = async (userId: string) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/payment-methods/${userId}`, {
        headers: {
           ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) {
        console.warn(`Fetch payment methods failed with status ${res.status}`);
        return;
      }
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.warn("Fetch payment methods response was not JSON:", await res.text());
        return;
      }
      const data = await res.json();
      if (data && Array.isArray(data.paymentMethods)) {
        setSavedCards(data.paymentMethods);
      }
    } catch (err) {
      console.error("Error fetching payment methods:", err);
    }
  };

  const handleAddPaymentMethod = async () => {
    if (!user) return;
    setIsProcessingSetup(true);
    try {
      const response = await fetch("/api/create-setup-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          successUrl: `${window.location.origin}/profile?setup=success`,
          cancelUrl: `${window.location.origin}/profile`
        })
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Setup Error:", err);
    } finally {
      setIsProcessingSetup(false);
    }
  };

  const handleDeletePaymentMethod = async (paymentMethodId: string) => {
    if (!user) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      await fetch(`/api/payment-methods/${user.uid}/${paymentMethodId}`, {
        method: "DELETE",
        headers: {
           ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      setSavedCards(cards => cards.filter(c => c.id !== paymentMethodId));
    } catch (err) {
      console.error("Delete Error:", err);
    }
  };

  const handleSubscribeToAppointments = async () => {
    if (!user) return;
    setIsProcessingSetup(true);
    try {
      // Simulate Stripe checkout or backend logic
      await new Promise(r => setTimeout(r, 1500));
      await updateDoc(doc(db, "users", user.uid), {
        "appointmentSettings.enabled": true,
        "appointmentSettings.subscriptionStatus": "active"
      });
      alert("Successfully enabled Appointment Add-on! (Simulated)");
    } catch(err) {
      handleFirestoreError(err, OperationType.UPDATE, "users");
    } finally {
      setIsProcessingSetup(false);
    }
  };

  const handleCancelAppointments = async () => {
    if (!user || !confirm("Are you sure you want to cancel the Appointment Add-on? Customers will no longer be able to book slots.")) return;
    setIsProcessingSetup(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        "appointmentSettings.enabled": false,
        "appointmentSettings.subscriptionStatus": "canceled"
      });
    } catch(err) {
      handleFirestoreError(err, OperationType.UPDATE, "users");
    } finally {
      setIsProcessingSetup(false);
    }
  };

  useEffect(() => {
    if (profile?.role === "tradesperson" && user?.uid && platformConfig) {
      setLoadingUsage(true);
      const tier = platformConfig.feeTiers?.find((t: any) => t.name === (profile.tierId || "Free Trial"));
      const isLifetime = tier?.limitPeriod === "lifetime";
      
      const q = query(
        collection(db, "quotes"),
        where("tradespersonId", "==", user.uid)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        let quotesCount = 0;
        let acceptedCount = 0;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const createdAt = data.createdAt?.toMillis?.() || 0;
          
          if (isLifetime || createdAt >= startOfMonth) {
            quotesCount++;
            if (data.status === "accepted") {
              acceptedCount++;
            }
          }
        });

        setUsage({ quotes: quotesCount, acceptedQuotes: acceptedCount });
        setLoadingUsage(false);
      }, (error) => {
        console.error("Error fetching usage:", error);
        setLoadingUsage(false);
      });

      return () => unsubscribe();
    }
  }, [user?.uid, profile?.role, profile?.tierId, platformConfig]);

  const [homeownerJobs, setHomeownerJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [recurringSchedules, setRecurringSchedules] = useState<any[]>([]);
  const [loadingRecurring, setLoadingRecurring] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      setLoadingRecurring(true);
      const q = query(
        collection(db, "recurring_schedules"),
        or(
          where("participants", "array-contains", user.uid),
          where("homeownerId", "==", user.uid),
          where("tradespersonId", "==", user.uid)
        )
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const schedules = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRecurringSchedules(schedules);
        setLoadingRecurring(false);
      }, (err) => {
        console.error("Error fetching recurring schedules:", err);
        setLoadingRecurring(false);
      });

      return () => unsubscribe();
    }
  }, [user?.uid, profile?.role]);

  useEffect(() => {
    if (profile?.role === "homeowner" && user?.uid) {
      setLoadingJobs(true);
      const q = query(
        collection(db, "jobs"),
        where("homeownerId", "==", user.uid),
        orderBy("createdAt", "desc")
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        setHomeownerJobs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoadingJobs(false);
      }, (error) => {
        console.error("Error fetching homeowner jobs:", error);
        handleFirestoreError(error, OperationType.LIST, "jobs");
        setLoadingJobs(false);
      });

      return () => unsubscribe();
    }
  }, [user?.uid, profile?.role]);

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, "platform_config", "global"), (doc) => {
      if (doc.exists()) {
        setPlatformConfig(doc.data());
      }
    });
    const unsubTiers = onSnapshot(doc(db, "platform_config", "global_tiers"), (doc) => {
      if (doc.exists()) {
        setGlobalTiers(doc.data());
      }
    });
    return () => {
      unsubConfig();
      unsubTiers();
    };
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    setError(null);
    try {
      let downloadUrl = "";
      if (user.isAnonymous) {
        // Simulate upload for guest accounts to allow testing without storage restrictions
        await new Promise(resolve => setTimeout(resolve, 1000));
        downloadUrl = `https://placehold.co/200x200?text=Guest+Avatar`;
      } else {
        downloadUrl = await uploadStorageFile(file, `avatars/${user.uid}/${Date.now()}_${file.name}`, { contentType: file.type });
      }
      
      await updateDoc(doc(db, "users", user.uid), {
        photoURL: downloadUrl
      });
      
      setProfile((prev: any) => ({ ...prev, photoURL: downloadUrl }));
    } catch (err) {
      console.error("Error uploading photo:", err);
      setError("Failed to upload photo.");
    } finally {
      setIsUploading(false);
    }
  };

  const handlePortfolioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploadingPortfolio(true);
    setError(null);
    try {
      let downloadUrl = "";
      if (user.isAnonymous) {
        // Simulate upload for guest accounts to allow testing without storage restrictions
        await new Promise(resolve => setTimeout(resolve, 1000));
        downloadUrl = `https://placehold.co/600x400?text=Portfolio+Item`;
      } else {
        downloadUrl = await uploadStorageFile(file, `portfolio/${user.uid}/${Date.now()}_${file.name}`, { contentType: file.type });
      }
      
      const currentPortfolio = (profile.portfolio && profile.portfolio.length > 0)
        ? profile.portfolio
        : (profile.portfolioPhotos && profile.portfolioPhotos.length > 0)
        ? profile.portfolioPhotos
        : (profile.workPhotos && profile.workPhotos.length > 0)
        ? profile.workPhotos
        : (profile.images && profile.images.length > 0)
        ? profile.images
        : [];

      const newPortfolioUpdated = [...currentPortfolio, downloadUrl];
      await updateDoc(doc(db, "users", user.uid), {
        portfolio: newPortfolioUpdated,
        portfolioPhotos: newPortfolioUpdated
      });
      
      setProfile((prev: any) => ({ ...prev, portfolio: newPortfolioUpdated, portfolioPhotos: newPortfolioUpdated }));
    } catch (err) {
      console.error("Error uploading portfolio image:", err);
      setError("Failed to upload portfolio image.");
    } finally {
      setIsUploadingPortfolio(false);
    }
  };

  const removePortfolioImage = async (url: string) => {
    if (!user) return;
    try {
      const currentPortfolio = (profile.portfolio && profile.portfolio.length > 0)
        ? profile.portfolio
        : (profile.portfolioPhotos && profile.portfolioPhotos.length > 0)
        ? profile.portfolioPhotos
        : (profile.workPhotos && profile.workPhotos.length > 0)
        ? profile.workPhotos
        : (profile.images && profile.images.length > 0)
        ? profile.images
        : [];

      const newPortfolio = currentPortfolio.filter((item: string) => item !== url);
      await updateDoc(doc(db, "users", user.uid), {
        portfolio: newPortfolio,
        portfolioPhotos: newPortfolio
      });
      setProfile((prev: any) => ({ ...prev, portfolio: newPortfolio, portfolioPhotos: newPortfolio }));
    } catch (err) {
      console.error("Error removing portfolio image:", err);
    }
  };

  const handleVerificationUpload = async (e: React.ChangeEvent<HTMLInputElement>, certType: string) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    setError(null);
    setVerificationError(null);
    console.log("Starting upload for:", certType, "isAnonymous:", user.isAnonymous);
    
    try {
      if (!privacyConsent[certType]) {
        setVerificationError(`Please consent to data processing for ${certType}.`);
        setIsUploading(false);
        return;
      }

      const expiryDate = expiryDates[certType];
      if (!expiryDate) {
        setVerificationError(`Please select an expiry date for ${certType}.`);
        setIsUploading(false);
        return;
      }

      let downloadUrlFinal = "";

      if (user.isAnonymous) {
        // Simulate upload for guest accounts to allow testing without storage restrictions
        console.log("Simulating upload for guest account...");
        await new Promise(resolve => setTimeout(resolve, 1500)); // Artificial delay
        downloadUrlFinal = `https://placehold.co/600x400?text=${certType.replace(/\s/g, '+')}+Verified`;
      } else {
        downloadUrlFinal = await uploadStorageFile(
          file, 
          `verifications/${user.uid}/${certType.replace(/\s/g, '_')}_${Date.now()}_${file.name}`, 
          { contentType: file.type }
        );
      }

      console.log("Upload successful, URL:", downloadUrlFinal);
      
      const currentDocs = profile.verificationDocs || [];
      const updatedDocs = [
        ...currentDocs.filter((d: any) => d.type !== certType),
        {
          type: certType,
          status: "pending",
          fileUrl: downloadUrlFinal,
          createdAt: new Date().toISOString(),
          expiryDate: expiryDate
        }
      ];

      await updateDoc(doc(db, "users", user.uid), {
        verificationDocs: updatedDocs,
        verificationStatus: "pending"
      });
      
      setProfile((prev: any) => ({ 
        ...prev, 
        verificationDocs: updatedDocs,
        verificationStatus: "pending"
      }));

      // Trigger automated public record check
      performInitialPublicRecordCheck(user.uid, certType);
    } catch (err) {
      console.error("Error uploading verification doc:", err);
      setError("Failed to upload document. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.substring(1);
      const element = document.getElementById(id);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [location.hash]);

  const handleSaveNotifications = async (settings: any) => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        notificationSettings: settings
      });
      setProfile((prev: any) => ({ ...prev, notificationSettings: settings }));
    } catch (err) {
      console.error("Error saving notification settings:", err);
      try {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      } catch (e: any) {
        setError(e.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = "/";
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const handleAIPolish = async () => {
    if (!editData.bio) return;
    setIsAIPolishing(true);
    try {
      const polished = await polishBio(editData.bio, editData.trades, editData.tags);
      if (polished) {
        setEditData({ ...editData, bio: polished.substring(0, 300) });
      }
    } catch (err) {
      console.error("Error polishing bio:", err);
    } finally {
      setIsAIPolishing(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    setError(null);
    try {
      const tradesArray = editData.trades.split(",").map(t => t.trim()).filter(t => t !== "").slice(0, 15);
      const tagsArray = editData.tags.split(",").map(t => t.trim()).filter(t => t !== "").slice(0, 15);
      
      const finalData: any = {
        ...editData,
        trades: tradesArray,
        tags: tagsArray,
        services: editData.services,
        productsAndServices: editData.services,
        badges: editData.badges?.includes('local_business') 
          ? editData.badges 
          : [...(editData.badges || []), 'local_business'],
        searchFeedBadges: editData.searchFeedBadges || []
      };

      if (editData.miniProfileSettings) {
        finalData.miniProfilePricing = editData.miniProfileSettings;
        if (editData.miniProfileSettings.hourlyRate !== undefined) finalData.hourlyRate = editData.miniProfileSettings.hourlyRate;
        if (editData.miniProfileSettings.callOutFee !== undefined) finalData.callOutFee = editData.miniProfileSettings.callOutFee;
        if (editData.miniProfileSettings.extraInfo !== undefined) finalData.extraInfo = editData.miniProfileSettings.extraInfo;
      }
      if (editData.instantMatchPricing) {
        finalData.instantMatchSettings = editData.instantMatchPricing;
        if (editData.instantMatchPricing.callOutFee !== undefined) finalData.emergencyCallOutFee = editData.instantMatchPricing.callOutFee;
        if (editData.instantMatchPricing.hourlyRate !== undefined) finalData.emergencyHourlyRate = editData.instantMatchPricing.hourlyRate;
        if (editData.instantMatchPricing.terms !== undefined) finalData.emergencyTerms = editData.instantMatchPricing.terms;
        if (editData.instantMatchPricing.enabled !== undefined) {
          finalData.isAvailableForEmergency = editData.instantMatchPricing.enabled;
          finalData.isAvailableForInstantMatch = editData.instantMatchPricing.enabled;
        }
      }
      
      await updateDoc(doc(db, "users", user.uid), finalData);
      setProfile((prev: any) => ({ ...prev, ...finalData }));
      setIsEditing(false);
    } catch (err) {
      console.error("Error updating profile:", err);
      try {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      } catch (e: any) {
        setError(e.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveServices = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const cleaned = tempServices
        .map((s: any) => (typeof s === "string" ? s.trim() : (s?.name || s?.title || s?.label || s?.service || "").trim()))
        .filter((s: string) => s.length > 0)
        .slice(0, 15);

      await updateDoc(doc(db, "users", user.uid), {
        services: cleaned,
        productsAndServices: cleaned
      });
      setProfile((prev: any) => ({ ...prev, services: cleaned, productsAndServices: cleaned }));
      setIsEditingServices(false);
    } catch (err) {
      console.error("Error saving services:", err);
      try {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      } catch (e: any) {
        setError(e.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveTradeOrSkill = async (itemToRemove: string) => {
    if (!user) return;
    try {
      const currentTrades = (Array.isArray(profile.trades) ? profile.trades : typeof profile.trades === "string" ? profile.trades.split(",") : [])
        .map((t: any) => (typeof t === "string" ? t.trim() : (t?.name || t?.title || "").trim()))
        .filter((t: string) => t.length > 0 && t.toLowerCase() !== itemToRemove.toLowerCase());

      const currentSkills = (Array.isArray(profile.skills) ? profile.skills : [])
        .map((s: any) => (typeof s === "string" ? s.trim() : (s?.name || s?.title || "").trim()))
        .filter((s: string) => s.length > 0 && s.toLowerCase() !== itemToRemove.toLowerCase());

      const currentCategories = (Array.isArray(profile.categories) ? profile.categories : [])
        .map((c: any) => (typeof c === "string" ? c.trim() : (c?.name || c?.title || "").trim()))
        .filter((c: string) => c.length > 0 && c.toLowerCase() !== itemToRemove.toLowerCase());

      const currentServices = (Array.isArray(profile.services) ? profile.services : [])
        .map((s: any) => (typeof s === "string" ? s.trim() : (s?.name || s?.title || "").trim()))
        .filter((s: string) => s.length > 0 && s.toLowerCase() !== itemToRemove.toLowerCase());

      const currentProductsAndServices = (Array.isArray(profile.productsAndServices) ? profile.productsAndServices : [])
        .map((s: any) => (typeof s === "string" ? s.trim() : (s?.name || s?.title || "").trim()))
        .filter((s: string) => s.length > 0 && s.toLowerCase() !== itemToRemove.toLowerCase());

      const updates: any = {
        trades: currentTrades,
        skills: currentSkills,
        categories: currentCategories,
        services: currentServices,
        productsAndServices: currentProductsAndServices
      };

      if (profile.primaryTrade && profile.primaryTrade.toLowerCase() === itemToRemove.toLowerCase()) {
        updates.primaryTrade = currentTrades[0] || "";
      }
      if (profile.category && profile.category.toLowerCase() === itemToRemove.toLowerCase()) {
        updates.category = currentTrades[0] || "";
      }

      await updateDoc(doc(db, "users", user.uid), updates);
      setProfile((prev: any) => ({ ...prev, ...updates }));
    } catch (err) {
      console.error("Error removing trade/skill:", err);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!user) return;
    try {
      const cleanTagVal = tagToRemove.replace(/^#+/, "").trim().toLowerCase();
      const currentTags = (Array.isArray(profile.tags) ? profile.tags : typeof profile.tags === "string" ? profile.tags.split(",") : [])
        .map((t: any) => (typeof t === "string" ? t.trim().replace(/^#+/, "") : (t?.name || t?.title || "").trim()))
        .filter((t: string) => t.length > 0 && t.toLowerCase() !== cleanTagVal);

      const currentSpecialisms = (Array.isArray(profile.specialisms) ? profile.specialisms : [])
        .map((t: any) => (typeof t === "string" ? t.trim().replace(/^#+/, "") : (t?.name || t?.title || "").trim()))
        .filter((t: string) => t.length > 0 && t.toLowerCase() !== cleanTagVal);

      const updates: any = {
        tags: currentTags,
        specialisms: currentSpecialisms,
        specialistTags: currentTags
      };

      await updateDoc(doc(db, "users", user.uid), updates);
      setProfile((prev: any) => ({ ...prev, ...updates }));
    } catch (err) {
      console.error("Error removing tag:", err);
    }
  };

  const handleAddEmergencyContact = async () => {
    if (!user || !newEmergencyContact.name || !newEmergencyContact.phone) return;
    setIsSaving(true);
    try {
      const updatedContacts = [...(profile.emergencyContacts || []), newEmergencyContact];
      await updateDoc(doc(db, "users", user.uid), {
        emergencyContacts: updatedContacts
      });
      setProfile((prev: any) => ({ ...prev, emergencyContacts: updatedContacts }));
      setNewEmergencyContact({ name: "", phone: "" });
      setIsAddingEmergency(false);
    } catch (err) {
      console.error("Error adding emergency contact:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveEmergencyContact = async (index: number) => {
    if (!user) return;
    try {
      const updatedContacts = (profile.emergencyContacts || []).filter((_: any, i: number) => i !== index);
      await updateDoc(doc(db, "users", user.uid), {
        emergencyContacts: updatedContacts
      });
      setProfile((prev: any) => ({ ...prev, emergencyContacts: updatedContacts }));
    } catch (err) {
      console.error("Error removing emergency contact:", err);
    }
  };

  const handleUpdateRecurringStatus = async (scheduleId: string, newStatus: string, otherPartyId: string, title: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "recurring_schedules", scheduleId), {
        status: newStatus
      });
      
      let notificationMessage = "";
      if (newStatus === "active") notificationMessage = `Your recurring schedule for "${title}" was accepted.`;
      else if (newStatus === "cancelled") notificationMessage = `The recurring schedule for "${title}" was cancelled.`;
      else if (newStatus === "paused") notificationMessage = `The recurring schedule for "${title}" was paused.`;
      
      if (notificationMessage) {
        await sendNotification(
          otherPartyId,
          "Schedule Update",
          notificationMessage,
          "status",
          "/profile"
        );
      }
    } catch (err) {
      console.error("Error updating recurring schedule:", err);
    }
  };

  const startEditingServices = () => {
    const raw = (Array.isArray(profile?.services) && profile.services.length > 0)
      ? profile.services
      : (Array.isArray(profile?.productsAndServices) && profile.productsAndServices.length > 0)
      ? profile.productsAndServices
      : (Array.isArray(profile?.offeredServices) && profile.offeredServices.length > 0)
      ? profile.offeredServices
      : (Array.isArray(profile?.specialistServices) && profile.specialistServices.length > 0)
      ? profile.specialistServices
      : [];

    const stringList = raw
      .map((s: any) => (typeof s === "string" ? s.trim() : (s?.name || s?.title || s?.label || s?.service || "").trim()))
      .filter((s: string) => s.length > 0);

    setTempServices(stringList);
    setIsEditingServices(true);
  };

  const cancelEditingServices = () => {
    setIsEditingServices(false);
    setNewService("");
  };

  // FAQ Manager State & Logic
  const FAQ_PRESETS = [
    {
      question: "Do you offer emergency callouts?",
      answer: "Yes, we offer 24/7 emergency callout services across our local coverage area with rapid response times."
    },
    {
      question: "Do you provide free estimates?",
      answer: "Yes, we provide free, no-obligation written estimates and quotes for all standard jobs and consultations."
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept debit/credit cards, direct bank transfer, cash, and instant scan-to-pay card payments via AnyTrader."
    },
    {
      question: "Are you fully insured & certified?",
      answer: "Yes, we carry comprehensive £2M+ public liability insurance and all required industry trade accreditations."
    },
    {
      question: "Do you guarantee your work?",
      answer: "Yes, all our workmanship comes with a 12-month guarantee in addition to standard manufacturer warranties."
    }
  ];

  const [faqs, setFaqs] = useState<Array<{ id: string; question: string; answer: string }>>(
    profile?.faqs || []
  );
  const [isEditingFaqs, setIsEditingFaqs] = useState(false);
  const [isSavingFaqs, setIsSavingFaqs] = useState(false);

  useEffect(() => {
    if (profile?.faqs) {
      setFaqs(profile.faqs);
    }
  }, [profile?.faqs]);

  const handleAddPresetFaq = (preset: { question: string; answer: string }) => {
    const exists = faqs.some(f => f.question.toLowerCase().trim() === preset.question.toLowerCase().trim());
    if (exists) {
      toast.info("That question is already in your FAQ list.");
      return;
    }
    const newFaq = {
      id: `faq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      question: preset.question,
      answer: preset.answer
    };
    setFaqs(prev => [...prev, newFaq]);
    setIsEditingFaqs(true);
    toast.success("Added preset question! You can now customize or save it.");
  };

  const handleAddCustomFaq = () => {
    const newFaq = {
      id: `faq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      question: "",
      answer: ""
    };
    setFaqs(prev => [...prev, newFaq]);
    setIsEditingFaqs(true);
  };

  const handleUpdateFaq = (id: string, field: "question" | "answer", value: string) => {
    setFaqs(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const handleDeleteFaq = (id: string) => {
    setFaqs(prev => prev.filter(f => f.id !== id));
    setIsEditingFaqs(true);
  };

  const handleSaveFaqs = async () => {
    if (!user) return;
    setIsSavingFaqs(true);
    try {
      const cleanedFaqs = faqs
        .filter(f => f.question.trim() !== "" && f.answer.trim() !== "")
        .map(f => ({
          id: f.id || `faq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          question: f.question.trim(),
          answer: f.answer.trim()
        }));

      await updateDoc(doc(db, "users", user.uid), {
        faqs: cleanedFaqs
      });
      setProfile((prev: any) => ({ ...prev, faqs: cleanedFaqs }));
      setFaqs(cleanedFaqs);
      setIsEditingFaqs(false);
      toast.success("Profile FAQs saved successfully!");
    } catch (err) {
      console.error("Error saving FAQs:", err);
      try {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      } catch (e: any) {
        setError(e.message);
      }
    } finally {
      setIsSavingFaqs(false);
    }
  };

  const handleToggleBadge = async (badgeId: string) => {
    if (!user) return;
    const currentBadges = profile?.professionalBadges || profile?.badges || [];
    const updatedBadgesnest = currentBadges.includes(badgeId)
      ? currentBadges.filter((b: string) => b !== badgeId)
      : [...currentBadges, badgeId];

    setProfile((prev: any) => ({
      ...prev,
      professionalBadges: updatedBadgesnest,
      badges: updatedBadgesnest,
    }));
    setEditData((prev: any) => ({
      ...prev,
      badges: updatedBadgesnest,
    }));

    try {
      await updateDoc(doc(db, "users", user.uid), {
        professionalBadges: updatedBadgesnest,
        badges: updatedBadgesnest,
      });
      toast.success("Guarantees updated successfully!");
    } catch (err) {
      console.error("Error updating badges:", err);
    }
  };

  if (!user || !profile) return null;

  const homeownerMenuGroups = [
    {
      title: "Account",
      items: [
        { icon: User, label: "Account Details", path: "#account" },
        { icon: Fingerprint, label: "Enable Biometric Quick-Login", path: "#biometrics" },
        { icon: Smartphone, label: "Classic / Mobile Friendly", path: "#uimode" },
        { icon: CreditCard, label: "Payment Methods", path: "#payments" },
        { icon: Shield, label: "Privacy & Legal Compliance", path: "#terms" },
      ]
    },
    {
      title: "Properties & Jobs",
      items: [
        { icon: Home, label: "My Properties", path: "/profile" },
        { icon: Briefcase, label: "My Jobs History", path: "/my-jobs?history=true" },
      ]
    },
    {
      title: "Tools",
      items: [
        { icon: BookOpen, label: "📖 Platform User Guide", path: "#userguide" },
        { icon: Bot, label: "AI Price Chatbot", path: "#tradebot" },
        { icon: Search, label: "Find Tradespeople", path: "/find-trades" },
        { icon: Zap, label: "Emergency Alerts", path: "/profile" },
      ]
    },
    {
      title: "Support",
      items: [
        { icon: Bell, label: "Notifications", path: "/notifications" },
        { icon: HelpCircle, label: "Help & Support", path: "/profile" },
        { icon: FileText, label: "Terms & Conditions", path: "#terms" },
      ]
    }
  ];

  const passengerMenuGroups = [
    {
      title: "Account",
      items: [
        { icon: CreditCard, label: "Payment Methods", path: "/billing" },
        { icon: Ticket, label: "Promotions & Promo Codes", path: "#promotions" },
        { icon: Gift, label: "Refer a Friend — Earn £5", path: "#referrals" },
        { icon: Briefcase, label: "Business Profile", path: "#business" },
        { icon: FileText, label: "Ride Receipts", path: "/my-rides" },
      ]
    },
    {
      title: "Ride Preferences",
      items: [
        { icon: ShieldCheck, label: "Passcode Verification", path: "#passcode" },
        { icon: Accessibility, label: "Accessibility Settings", path: "#accessibility" },
        { icon: Users, label: "Ride for Someone Else", path: "#rideforself" },
        { icon: MapPin, label: "Saved Places", path: "/saved-journeys" },
      ]
    },
    {
      title: "Safety",
      items: [
        { icon: ShieldAlert, label: "Emergency Contacts", path: "#emergency" },
        { icon: Users, label: "Trusted Contacts", path: "#trusted" },
      ]
    },
    {
      title: "Support",
      items: [
        { icon: HelpCircle, label: "Help Centre", path: "#help" },
        { icon: Ticket, label: "My Support Tickets", path: "#tickets" },
        { icon: MessageSquare, label: "Live Chat", path: "#chat" },
      ]
    },
    {
      title: "App Settings",
      items: [
        { icon: Fingerprint, label: "Enable Biometric Quick-Login", path: "#biometrics" },
        { icon: Smartphone, label: "Classic / Mobile Friendly", path: "#uimode" },
        { icon: Repeat, label: "Switch to AnyTrader", path: "#switch_portal" },
        { icon: Bell, label: "Notifications", path: "/notifications" },
        { icon: Settings, label: "App Settings", path: "#settings" },
        { icon: Shield, label: "Legal & Privacy", path: "#terms" },
      ]
    }
  ];

  const tradespersonMenuGroups = [
    {
      title: "Account",
      items: [
        { icon: User, label: "Account Details", path: "#account" },
        { icon: Fingerprint, label: "Enable Biometric Quick-Login", path: "#biometrics" },
        { icon: Smartphone, label: "Classic / Mobile Friendly", path: "#uimode" },
        { icon: Bell, label: "Notification Preferences", path: "#notifications" },
        { icon: CreditCard, label: "Payment Methods", path: "#payments" },
        { icon: PoundSterling, label: "Billing & Pricing Tiers", path: "/billing" },
        { icon: Shield, label: "Privacy & Legal Compliance", path: "#terms" },
      ]
    },
    {
      title: "Business",
      items: [
        { icon: Layout, label: "My Dashboard", path: "/" },
        { icon: PoundSterling, label: "My Quotes", path: "/my-quotes" },
        { icon: Briefcase, label: "My Jobs", path: "/trade-jobs" },
        { icon: BarChart3, label: "Job Analytics", path: "/analytics" },
        { icon: Calendar, label: "Availability Calendar", path: "/availability" },
        { icon: CalendarClock, label: "Booking Appointments", path: "#appointments" },
        { icon: HelpCircle, label: "Profile FAQs", path: "#faqs" },
        ...(isBannerAdsEnabled ? [{ icon: Zap, label: "Traders Banner Ad Studio", path: "/trader/banner-ads" }] : []),
      ]
    },
    {
      title: "Tools",
      items: [
        { icon: BookOpen, label: "📖 Platform User Guide", path: "#userguide" },
        { icon: Bot, label: "AI Price Chatbot", path: "#tradebot" },
        { icon: Search, label: "Find Tradespeople", path: "/find-trades" },
        { icon: History, label: "Search History", path: "/job-feed" },
      ]
    },
    {
      title: "Support",
      items: [
        { icon: Bell, label: "Notifications", path: "/notifications" },
        { icon: HelpCircle, label: "Help & Support", path: "/profile" },
        { icon: FileText, label: "Terms & Conditions", path: "#terms" },
      ]
    }
  ];

  const menuGroups = activePortal === "anyroller" 
    ? passengerMenuGroups 
    : (isBusinessProfile ? tradespersonMenuGroups : homeownerMenuGroups);

  const handleSubscribe = async () => {
    if (!user || !showCheckoutForTier) return;
    setIsProcessingPayment(true);
    
    try {
      if (showCheckoutForTier.price > 0) {
        // Redirect to Stripe checkout for paid plans
        const response = await fetch("/api/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.uid,
            tierName: showCheckoutForTier.name,
            mode: "subscription",
            price_data: {
              currency: 'gbp',
              unit_amount: Math.round(showCheckoutForTier.price * 100),
              recurring: { interval: 'month' },
              product_data: {
                name: `${showCheckoutForTier.name} Membership`,
                description: `Monthly subscription to ${showCheckoutForTier.name}`
              }
            },
            priceId: "price_mock_" + showCheckoutForTier.name.toLowerCase().replace(/\s/g, "_"),
            successUrl: `${window.location.origin}/profile?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${window.location.origin}/profile`,
            metadata: {
              tierName: showCheckoutForTier.name,
              userId: user.uid
            }
          }),
        });

        const data = await response.json();
        if (data.url) {
          window.location.href = data.url;
          return; // Do not clear loading state as we are redirecting
        } else {
          throw new Error(data.error || "Failed to initiate checkout");
        }
      } else {
        // Auto-subscribe for free tiers
        const nextBillingDate = new Date();
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

        const isHomeowner = profile.role === "homeowner";
        const tierField = isHomeowner ? "homeownerTierId" : "tierId";
        const statusField = isHomeowner ? "homeownerSubscriptionStatus" : "subscriptionStatus";
        const periodEndField = isHomeowner ? "homeownerCurrentPeriodEnd" : "currentPeriodEnd";
        const cancelField = isHomeowner ? "homeownerCancelAtPeriodEnd" : "cancelAtPeriodEnd";

        const updatePayload: any = { 
          [tierField]: showCheckoutForTier.name,
          [statusField]: 'trialing',
          [periodEndField]: nextBillingDate.toISOString(),
          [cancelField]: false
        };

        if (!isHomeowner) {
          const canonical = normalizeTraderTier(showCheckoutForTier.name);
          updatePayload.tier = canonical;
          updatePayload.isPro = canonical !== 'payg';
          updatePayload.isProInvoiceSubscriber = canonical !== 'payg';
        }

        await updateDoc(doc(db, "users", user.uid), updatePayload);
        
        setProfile((prev: any) => ({ 
          ...prev, 
          ...updatePayload
        }));
        
        setShowCheckoutForTier(null);
        setIsProcessingPayment(false);
      }
    } catch (err: any) {
      console.error("Error updating tier:", err);
      alert(err.message || "Payment init failed. Please try again.");
      setIsProcessingPayment(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!user || !confirm("Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing cycle.")) return;
    
    const cancelField = profile.role === "homeowner" ? "homeownerCancelAtPeriodEnd" : "cancelAtPeriodEnd";

    try {
      await updateDoc(doc(db, "users", user.uid), { 
        [cancelField]: true
      });
      setProfile((prev: any) => ({ ...prev, [cancelField]: true }));
    } catch (err) {
      console.error("Error canceling subscription:", err);
    }
  };

  const currentRoleTierId = profile.role === "homeowner" ? (profile.homeownerTierId || "Standard Homeowner") : (profile.tierId || "Free Explorer");
  const currentRoleSubscriptionStatus = profile.role === "homeowner" ? profile.homeownerSubscriptionStatus : profile.subscriptionStatus;
  const currentRoleCancelAtPeriodEnd = profile.role === "homeowner" ? profile.homeownerCancelAtPeriodEnd : profile.cancelAtPeriodEnd;
  const currentRoleCurrentPeriodEnd = profile.role === "homeowner" ? profile.homeownerCurrentPeriodEnd : profile.currentPeriodEnd;

  if (activePortal === "anyroller" && profile.role !== "driver") {
    const passengerGroups = [
      {
        title: "Account",
        bg: "bg-white",
        items: [
          { icon: CreditCard, label: "Payment Methods", path: "/billing" },
          { icon: Star, label: "Promotions & Promo Codes", path: "#promotions" }, 
          { icon: Users, label: "Refer a Friend - Earn £5", path: "#referrals" },
        ]
      },
      {
        title: "Ride Preferences",
        bg: "bg-white",
        items: [
          { icon: Accessibility, label: "Accessibility Settings", path: "#accessibility" },
          { icon: MapPin, label: "Saved Places", path: "/saved-journeys" },
          { icon: Lock, label: "Passcode Verification", path: "#passcode" },
        ]
      },
      {
        title: "Safety & Support",
        bg: "bg-[#e8f4fc]", // blue tint matching screenshot
        items: [
           { 
             icon: User, 
             label: "Emergency Contacts", 
             path: "#emergency", 
             rightElem: (
               <div 
                 onClick={(e) => { e.stopPropagation(); setIsAddingEmergency(true); setExpandedMenuId("#emergency"); }} 
                 className="text-[11px] font-black bg-blue-200/50 text-blue-900 px-3 py-1.5 rounded-full hover:bg-blue-200 transition-colors cursor-pointer"
               >
                 Add Contact
               </div>
             ) 
           },
           { icon: HelpCircle, label: "Help Centre", path: "#help" },
           { icon: MessageSquare, label: "Live Chat", path: "#chat" },
        ]
      },
      {
        title: "App Settings",
        bg: "bg-white",
        items: [
          { icon: Bell, label: "Notifications", path: "/notifications" },
          { icon: Globe, label: "App Language", path: "#language" },
          { icon: Shield, label: "Privacy & Legal", path: "#privacy" },
        ]
      }
    ];

    const renderPassengerMenuContent = (path: string) => {
      switch(path) {
        case "#passcode":
          return (
            <div className="p-4 bg-slate-50 border-t border border-black0">
              <div className="p-4 bg-white border border-black rounded-2xl shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">PIN Verification</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">Driver will ask for a PIN (last 4 digits) before trip.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={profile?.requirePasscode === true}
                    onClick={async () => {
                      if (user?.uid) {
                        const newStatus = profile?.requirePasscode !== true;
                        await updateDoc(doc(db, "users", user.uid), { requirePasscode: newStatus });
                        setProfile((prev: any) => ({ ...prev, requirePasscode: newStatus }));
                      }
                    }}
                    className={cn(
                      "relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full border border-black transition-colors duration-200 ease-in-out focus:outline-none",
                      profile?.requirePasscode === true ? "bg-emerald-600" : "bg-slate-200"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs border border-black transition duration-200 ease-in-out",
                        profile?.requirePasscode === true ? "translate-x-5" : "translate-x-0.5"
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>
          );
        case "#emergency":
          return (
            <div className="p-4 bg-slate-50 border-t border-black rounded-b-3xl">
              {isAddingEmergency && (
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-3 mb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input 
                      type="text" 
                      placeholder="Contact Name"
                      className="p-3 bg-white border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={newEmergencyContact.name}
                      onChange={(e) => setNewEmergencyContact({ ...newEmergencyContact, name: e.target.value })}
                    />
                    <input 
                      type="tel" 
                      placeholder="Phone Number"
                      className="p-3 bg-white border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={newEmergencyContact.phone}
                      onChange={(e) => setNewEmergencyContact({ ...newEmergencyContact, phone: e.target.value })}
                    />
                  </div>
                  <button 
                    onClick={handleAddEmergencyContact}
                    disabled={isSaving || !newEmergencyContact.name || !newEmergencyContact.phone}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-600/20 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Save Contact"}
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3">
                {(profile.emergencyContacts || []).length === 0 ? (
                  <div className="py-6 text-center bg-white rounded-2xl border border-dashed border-black">
                    <p className="text-slate-500 text-sm font-medium">No emergency contacts listed.</p>
                  </div>
                ) : (
                  profile.emergencyContacts.map((contact: any, index: number) => (
                    <div key={index} className="p-3 bg-white rounded-xl border border-black flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
                          <Phone className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-xs">{contact.name}</p>
                          <p className="text-[10px] text-slate-500 font-bold">{contact.phone}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRemoveEmergencyContact(index)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        case "#uimode":
        case "#settings":
          return renderUiModeSelector();
        default:
          return (
            <div className="p-6 text-center bg-slate-50 border-t border-black rounded-b-3xl">
              <p className="text-slate-500 font-medium text-sm">Settings coming soon.</p>
            </div>
          );
      }
    };

    return (
      <div className="min-h-screen bg-[#f3f7fb] relative font-sans overflow-x-hidden pb-12">
        {/* Wavy background top effect - light blue */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180%] h-[280px] sm:h-[320px] bg-[#bae0ff]/90 rounded-b-[100%] shadow-[0_4px_30px_rgba(186,224,255,0.4)] z-0" />
        
        {/* Close Button Top Right */}
        <button 
          onClick={() => navigate("/")} 
          className="fixed top-5 right-5 z-50 w-11 h-11 bg-white/40 hover:bg-white/70 backdrop-blur-md border border-black/50 rounded-full flex items-center justify-center transition-all shadow-sm active:scale-95"
          aria-label="Close Profile"
        >
          <X className="w-6 h-6 text-slate-800" strokeWidth={2.5} />
        </button>

        <div className="relative z-10 max-w-[420px] mx-auto pt-16 px-5">
          
          {/* Main User Card */}
          <div className="bg-white rounded-[2rem] pt-14 pb-6 px-6 shadow-sm border border-black/50 flex flex-col items-center mb-8 relative">
            
            {/* Avatar overlapping top */}
            <div className="absolute -top-12">
               <div className="w-[104px] h-[104px] rounded-full bg-[#8ccaf5] p-1.5 relative shadow-md">
                 <img src={profile.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || "User")}&background=0D8ABC&color=fff`} className="w-full h-full rounded-full object-cover" />
                 <div className="absolute bottom-1 right-2 w-5 h-5 bg-green-500 rounded-full border-[3px] border-black" />
               </div>
            </div>
            
            {/* Rating pill overlapping top right */}
            <div className="absolute -top-4 right-2 flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-md border border-slate-50 z-20">
               <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
               <div className="flex flex-col">
                 <span className="text-[12px] font-black text-slate-800 leading-tight">{profile.rating?.toFixed(1) || "5.0"} Star</span>
                 <span className="text-[9px] uppercase text-slate-500 font-bold tracking-tight">Rider Rating</span>
               </div>
            </div>

            <div className="text-center mt-2">
              <h2 className="text-2xl font-black text-[#0f172a] mb-2">{profile.name}</h2>
              <div className="inline-flex items-center justify-center px-4 py-1 rounded-full bg-[#fdf3c7]">
                 <span className="text-[11px] font-black text-[#926c15] tracking-wide">Gold Member</span>
              </div>
            </div>
          </div>

          {/* Menu Card Sections */}
          <div className="space-y-5">
            {passengerGroups.map((group, idx) => (
              <div key={idx} className="space-y-2">
                <h3 className="px-1 text-[15px] font-black text-slate-900">{group.title}</h3>
                <div className={cn("rounded-3xl shadow-sm overflow-hidden", group.bg)}>
                  {group.items.map((item, i) => {
                    const isExpanded = expandedMenuId === item.path;
                    const isLast = i === group.items.length - 1;
                    return (
                      <div key={i} className={cn("flex flex-col", !isLast && "border-b border-black/[0.04]")}>
                        <button 
                          onClick={() => {
                            if (item.path.startsWith('/')) navigate(item.path);
                            else setExpandedMenuId(isExpanded ? null : item.path);
                          }}
                          className="w-full flex items-center justify-between p-4 hover:bg-black/[0.02] transition-colors group"
                        >
                          <div className="flex items-center gap-4">
                             <item.icon className="w-5 h-5 text-[#0f172a] opacity-80" strokeWidth={2.5} />
                             <span className="font-bold text-[#0f172a] text-[15px]">{item.label}</span>
                          </div>
                          <div className="flex items-center gap-3">
                             {item.rightElem}
                             <ChevronRight className="w-5 h-5 text-black group-hover:text-black transition-colors" strokeWidth={2.5} />
                          </div>
                        </button>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              className="overflow-hidden"
                            >
                              {renderPassengerMenuContent(item.path)}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          
          {/* Log Out Button */}
          <div className="mt-8 px-2">
            <button 
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full py-4 bg-[#0b1b3d] text-white rounded-full font-bold shadow-sm shadow-[#0b1b3d]/20 hover:bg-[#152a5c] active:scale-95 transition-all text-[15px] border-b-4 border-red-800 flex justify-center cursor-pointer"
            >
              Log Out
            </button>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div id="account" className="max-w-2xl mx-auto pb-24 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4">
        <div className="flex flex-col">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Profile</h1>
          <button 
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            id="profile-logout-btn"
            className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-black shadow-xs text-xs font-black uppercase text-red-600 hover:bg-red-50 active:scale-95 transition-all self-start cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-red-600" />
            <span>Log Out</span>
          </button>
        </div>
        <button 
          onClick={() => navigate("/")} 
          className="w-12 h-12 bg-white border border-black hover:bg-slate-50 border-black rounded-full flex items-center justify-center transition-all shadow-sm text-slate-600 hover:text-slate-900 focus:ring-2 focus:ring-slate-200"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Referral Program */}
      {/* Subscription Plan Card */}
      {activePortal === 'rides' && profile.role === "homeowner" && (
        <div className="bg-gradient-to-br from-amber-300 via-amber-400 to-yellow-500 rounded-[2rem] shadow-[0_8px_30px_rgb(251,191,36,0.25)] overflow-hidden p-5 mb-8 relative">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/30 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-amber-600/20 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div>
              <h3 className="text-2xl font-black text-amber-950 flex items-center gap-2">
                <Star className="w-6 h-6 outline-amber-900 fill-amber-200" />
                Rider Plus
              </h3>
              <p className="text-sm font-bold text-amber-900/80 mt-1">Unlock the ultimate AnyRoller experience.</p>
            </div>
            {profile.tierId === "rider_plus" && (
               <div className="px-3 py-1.5 bg-amber-950 text-amber-300 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                 <CheckCircle2 className="w-4 h-4" /> Active
               </div>
            )}
          </div>

          <div className="space-y-4 mb-8 relative z-10 bg-white/20 backdrop-blur-sm p-4 rounded-3xl border border-black/30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/40 flex items-center justify-center shrink-0 shadow-sm border border-black/50">
                <Zap className="w-4 h-4 text-amber-950 fill-amber-950" />
              </div>
              <p className="text-sm font-bold text-amber-950">Priority Matching during peak hours</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/40 flex items-center justify-center shrink-0 shadow-sm border border-black/50">
                <Percent className="w-4 h-4 text-amber-950" />
              </div>
              <p className="text-sm font-bold text-amber-950">10% discount on every journey</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/40 flex items-center justify-center shrink-0 shadow-sm border border-black/50">
                <Award className="w-4 h-4 text-amber-950" />
              </div>
              <p className="text-sm font-bold text-amber-950">Exclusive Rider Plus badge on your profile</p>
            </div>
          </div>

          <div className="relative z-10">
            {profile.tierId !== "rider_plus" ? (
              <button 
                onClick={() => {
                  setShowCheckoutForTier({ 
                    name: "rider_plus", 
                    price: 9.99, 
                    limitPeriod: "monthly", 
                    description: "Premium privileges for AnyRoller passengers." 
                  });
                }}
                className="w-full py-4 bg-amber-950 text-amber-300 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-amber-900 transition-colors shadow-xl active:scale-95 flex justify-center items-center gap-2"
              >
                Subscribe for £9.99 <span className="text-[10px] text-amber-500">/ month</span>
              </button>
            ) : (
              <button
                onClick={handleCancelSubscription}
                className="w-full py-3 bg-white/30 border border-black/50 text-amber-950 rounded-2xl font-bold text-sm hover:bg-white/40 transition-colors"
              >
                Cancel Subscription
              </button>
            )}
          </div>
        </div>
      )}

      {(isBusinessProfile || (profile.role === "homeowner" && profile.subscriptionType === "business")) && platformConfig && (
        <div className="bg-white rounded-[2rem] border border-black shadow-[0_8px_30px_rgb(0,0,0,0.08)] bg-gradient-to-b from-white to-slate-50/50 overflow-hidden p-5 mb-8">
          {platformConfig.paywallEnabled === false && (
            <div className="mb-6 p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-black text-amber-900 leading-none mb-1 uppercase tracking-tight">Beta Mode Active</p>
                <p className="text-xs text-amber-700 font-medium">Subscription fees and limits are currently waived. Enjoy unlimited access!</p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Subscription Plan</h3>
                <p className="text-xs text-slate-500">Manage your platform structure</p>
              </div>
            </div>
            <div id="tier-badge" className="px-3 py-1 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              {currentRoleTierId}
              {currentRoleSubscriptionStatus === 'active' && !currentRoleCancelAtPeriodEnd && (
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" title="Active Subscription" />
              )}
            </div>
          </div>

          {currentRoleSubscriptionStatus === 'active' && currentRoleCurrentPeriodEnd && (
            <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-blue-900">Next Billing Date</p>
                <p className="text-[10px] text-blue-700">
                  {new Date(currentRoleCurrentPeriodEnd).toLocaleDateString()}
                  {currentRoleCancelAtPeriodEnd && " (Cancels at end of period)"}
                </p>
              </div>
              {!currentRoleCancelAtPeriodEnd && (
                <button 
                  onClick={handleCancelSubscription}
                  className="text-[10px] font-bold text-red-600 hover:text-red-700 underline"
                >
                  Cancel Subscription
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3">
            {activeTiers.map((tier: any) => (
              <button
                key={tier.name}
                onClick={() => {
                  if (currentRoleTierId === tier.name) return;
                  if (tier.price > 0) {
                    setShowCheckoutForTier(tier);
                  } else {
                    if (confirm(`Switch to the ${tier.name} plan?`)) {
                      setShowCheckoutForTier(tier);
                      // In a real app we'd call handleSubscribe directly here if price is 0
                      // or show a simplified checkout
                    }
                  }
                }}
                className={cn(
                  "w-full p-4 rounded-2xl border text-left transition-all relative group",
                  currentRoleTierId === tier.name ? "border-blue-600 bg-blue-50 ring-2 ring-blue-600/10" : "border border-black hover:border-black bg-white"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-900">{tier.name}</span>
                  <div className="text-right">
                    <span className="text-lg font-black text-blue-600">
                      {tier.price === 0 ? "Free" : `£${tier.price}`}
                    </span>
                    {tier.price > 0 && (
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">
                        {tier.limitPeriod === "monthly" ? "Per Month" : "Lifetime"}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mb-2">{tier.description}</p>
                
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  {isBusinessProfile ? (
                    <>
                      <div className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-600">
                        {tier.maxQuotes} Quotes / {tier.limitPeriod === "lifetime" ? "Lifetime" : "Month"}
                      </div>
                      <div className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-600">
                        {tier.maxAcceptedQuotes} Accepted / {tier.limitPeriod === "lifetime" ? "Lifetime" : "Month"}
                      </div>
                      {tier.includesRecommendation && (
                        <div className="px-2 py-0.5 bg-orange-100 rounded text-[9px] font-bold text-orange-700 flex items-center gap-1">
                          <Award className="w-3 h-3" /> Includes Recommended Status
                        </div>
                      )}
                      <div className="px-2 py-0.5 bg-blue-100 rounded text-[9px] font-bold text-blue-700">
                        {tier.commission || 0}% Comm
                      </div>
                      <div className="px-2 py-0.5 bg-emerald-100 rounded text-[9px] font-bold text-emerald-700">
                        £{tier.leadFee || 0} Lead Fee
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-600">
                        {tier.jobPostsLimit === 9999 ? "Unlimited" : tier.jobPostsLimit} Job Posts
                      </div>
                      <div className="px-2 py-0.5 bg-blue-100 rounded text-[9px] font-bold text-blue-700">
                        {tier.commission || 0}% Comm
                      </div>
                    </div>
                  )}
                </div>
                
                {isBusinessProfile && currentRoleTierId === tier.name && (
                  <div className="space-y-3 pt-4 border-t border border-black">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-500">Quotes Used</span>
                        <span className={cn(usage.quotes >= tier.maxQuotes ? "text-red-600" : "text-blue-600")}>
                          {usage.quotes} / {tier.maxQuotes}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full transition-all", usage.quotes >= tier.maxQuotes ? "bg-red-500" : "bg-blue-500")}
                          style={{ width: `${Math.min((usage.quotes / tier.maxQuotes) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-500">Accepted Quotes</span>
                        <span className={cn(usage.acceptedQuotes >= tier.maxAcceptedQuotes ? "text-red-600" : "text-green-600")}>
                          {usage.acceptedQuotes} / {tier.maxAcceptedQuotes}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full transition-all", usage.acceptedQuotes >= tier.maxAcceptedQuotes ? "bg-red-500" : "bg-green-500")}
                          style={{ width: `${Math.min((usage.acceptedQuotes / tier.maxAcceptedQuotes) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {currentRoleTierId === tier.name && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {isBusinessProfile ? (
        <TraderIdentityCard
          profile={profile}
          onEditClick={() => setIsEditing(true)}
          onPhotoUpload={handlePhotoUpload}
          isUploading={isUploading}
        />
      ) : (
        <HomeownerIdentityCard
          profile={profile}
          onEditClick={() => setIsEditing(true)}
          onPhotoUpload={handlePhotoUpload}
          isUploading={isUploading}
          activePortal={activePortal}
        />
      )}

      {/* Card 2: Trust, Video Verification & AI Coach */}
      {isBusinessProfile && (
        <TrustVerificationCard
          profile={profile}
          user={user}
          onUpdateProfile={(updates) => {
            setProfile((prev: any) => ({ ...prev, ...updates }));
            setEditData((prev: any) => ({ ...prev, ...updates }));
          }}
          isVerificationExpanded={isVerificationExpanded}
          setIsVerificationExpanded={setIsVerificationExpanded}
          verificationError={verificationError}
          expiryDates={expiryDates}
          setExpiryDates={setExpiryDates}
          privacyConsent={privacyConsent}
          setPrivacyConsent={setPrivacyConsent}
          handleVerificationUpload={handleVerificationUpload}
          isUploading={isUploading}
        />
      )}

      {/* Card 3: Bio, Specialist Skills, Services & Work Portfolio */}
      {isBusinessProfile && (
        <BioOfferingsCard
          profile={profile}
          onEditProfile={() => setIsEditing(true)}
          onOpenBioInfo={() => setShowBioInfo(true)}
          onToggleBadge={handleToggleBadge}
          onRemoveTrade={handleRemoveTradeOrSkill}
          onRemoveTag={handleRemoveTag}
          isEditingServices={isEditingServices}
          servicesList={tempServices}
          newServiceInput={newService}
          setNewServiceInput={setNewService}
          handleAddService={() => {
            if (tempServices.length >= 15) {
              alert("Maximum 15 skills & services allowed per trader profile.");
              return;
            }
            if (newService.trim()) {
              setTempServices([...tempServices, newService.trim()]);
              setNewService("");
            }
          }}
          handleRemoveService={(index) => {
            setTempServices(tempServices.filter((_: any, i: number) => i !== index));
          }}
          handleClearAllServices={() => {
            if (window.confirm("Are you sure you want to clear all services?")) {
              setTempServices([]);
            }
          }}
          startEditingServices={startEditingServices}
          saveServices={handleSaveServices}
          cancelEditingServices={cancelEditingServices}
          portfolioImages={profile.portfolio || []}
          handlePortfolioUpload={handlePortfolioUpload}
          handleRemovePortfolioImage={removePortfolioImage}
          handleDragEnd={handleDragEnd}
          isUploadingPortfolio={isUploadingPortfolio}
        />
      )}

      {/* Card 4: Standard Rates, Instant Match & Customer FAQs */}
      {isBusinessProfile && (
        <RatesFaqsCard
          profile={profile}
          onEditMiniProfile={() => setIsEditingMiniProfile(true)}
          onEditInstantMatch={() => setIsEditingIM(true)}
          faqs={faqs}
          isEditingFaqs={isEditingFaqs}
          setIsEditingFaqs={setIsEditingFaqs}
          isSavingFaqs={isSavingFaqs}
          handleSaveFaqs={handleSaveFaqs}
          handleAddPresetFaq={handleAddPresetFaq}
          handleUpdateFaq={handleUpdateFaq}
          handleDeleteFaq={handleDeleteFaq}
          handleAddCustomFaq={handleAddCustomFaq}
        />
      )}

      {/* Homeowner Safety & Emergency Card */}
      {profile.role === "homeowner" && (
        <SafetyEmergencyCard
          profile={profile}
          isAddingEmergency={isAddingEmergency}
          setIsAddingEmergency={setIsAddingEmergency}
          newEmergencyContact={newEmergencyContact}
          setNewEmergencyContact={setNewEmergencyContact}
          handleAddEmergencyContact={handleAddEmergencyContact}
          handleRemoveEmergencyContact={handleRemoveEmergencyContact}
          isSaving={isSaving}
        />
      )}

      {/* Card 5: Growth, Native Ads, Notifications & Recurring Services (Traders) */}
      {isBusinessProfile && (
        <GrowthNotificationsCard
          isBusinessProfile={isBusinessProfile}
          isBannerAdsEnabled={isBannerAdsEnabled}
          traderProfile={profile}
          onOpenTimingModal={() => setShowMatchTimingModal(true)}
          notificationSettings={notificationSettings}
          setNotificationSettings={setNotificationSettings}
          handleSaveNotifications={handleSaveNotifications}
          loadingRecurring={loadingRecurring}
          recurringSchedules={recurringSchedules}
          currentUserId={user?.uid}
          userRole={profile.role}
          handleUpdateRecurringStatus={handleUpdateRecurringStatus}
        />
      )}

      {/* Phase 3: Grouped Menu List */}
      <>
        {menuGroups.map((group) => {
          return (
          <div key={group.title} className="break-inside-avoid mb-3">
            <h3 className="text-[10px] font-black text-black uppercase tracking-wider mb-2 px-1">{group.title}</h3>
            <div className="bg-white rounded-3xl border border-black shadow-md overflow-hidden flex flex-col">
                    {group.items.map((item, index) => {
                      if (item.path === "#tradebot") {
                        return (
                          <button
                            key={index}
                            onClick={() => setIsTradeBotOpen(true)}
                            className="w-full flex items-center gap-3 p-3 border-b border border-black last:border-0 hover:bg-slate-50 transition-all group text-left"
                          >
                            <div className="w-8 h-8 md:w-10 md:h-10 shrink-0 bg-slate-50 rounded-[10px] flex items-center justify-center text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                              <item.icon className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} />
                            </div>
                            <span className="flex-1 font-bold text-black group-hover:text-black transition-colors text-xs md:text-[15px] leading-tight">
                              {item.label}
                            </span>
                            <ChevronRight className="w-5 h-5 text-black group-hover:text-black transition-colors shrink-0" />
                          </button>
                        );
                      } else if (item.path === "#userguide") {
                        return (
                          <button
                            key={index}
                            onClick={() => setShowUserGuide(true)}
                            className="w-full flex items-center gap-3 p-3 border-b border border-black last:border-0 hover:bg-slate-50 transition-all group text-left"
                          >
                            <div className="w-8 h-8 md:w-10 md:h-10 shrink-0 bg-slate-50 rounded-[10px] flex items-center justify-center text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                              <item.icon className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} />
                            </div>
                            <span className="flex-1 font-bold text-black group-hover:text-black transition-colors text-xs md:text-[15px] leading-tight">
                              {item.label}
                            </span>
                            <ChevronRight className="w-5 h-5 text-black group-hover:text-black transition-colors shrink-0" />
                          </button>
                        );
                      } else if (item.path === "#terms") {
                        return (
                          <button
                            key={index}
                            onClick={() => setShowProfileTermsModal(true)}
                            className="w-full flex items-center gap-3 p-3 border-b border border-black last:border-0 hover:bg-slate-50 transition-all group text-left"
                          >
                            <div className="w-8 h-8 md:w-10 md:h-10 shrink-0 bg-emerald-50 rounded-[10px] flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                              <item.icon className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} />
                            </div>
                            <span className="flex-1 font-bold text-black group-hover:text-black transition-colors text-xs md:text-[15px] leading-tight flex items-center justify-between pr-2">
                              <span>{item.label}</span>
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-200">
                                Agreed v{profile?.termsAcceptedVersion || CURRENT_TERMS_VERSION}
                              </span>
                            </span>
                            <ChevronRight className="w-5 h-5 text-black group-hover:text-black transition-colors shrink-0" />
                          </button>
                        );
                      } else if (item.path === "#switch_portal") {
                        return (
                          <button
                            key={index}
                            onClick={() => switchPortal('anytrader')}
                            className="w-full flex items-center gap-3 p-3 border-b border border-black last:border-0 hover:bg-slate-50 transition-all group text-left"
                          >
                            <div className="w-8 h-8 md:w-10 md:h-10 shrink-0 bg-slate-50 rounded-[10px] flex items-center justify-center text-amber-500 hover:bg-amber-50 group-hover:bg-amber-100 group-hover:text-amber-600 transition-colors">
                              <item.icon className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} />
                            </div>
                            <span className="flex-1 font-bold text-black group-hover:text-black transition-colors text-xs md:text-[15px] leading-tight">
                              {item.label}
                            </span>
                            <ChevronRight className="w-5 h-5 text-black group-hover:text-black transition-colors shrink-0" />
                          </button>
                        );
                      } else if (item.path?.startsWith("#")) {
                        const isExpanded = expandedMenuId === item.path;
                        return (
                          <div key={index} className="border-b border border-black last:border-0 overflow-hidden transition-all">
                            <button
                              onClick={() => setExpandedMenuId(isExpanded ? null : item.path)}
                              className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 transition-all group text-left"
                            >
                              <div className="w-8 h-8 md:w-10 md:h-10 shrink-0 bg-slate-50 rounded-[10px] flex items-center justify-center text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors shrink-0">
                                <item.icon className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} />
                              </div>
                              <span className="flex-1 font-bold text-black group-hover:text-black transition-colors text-xs md:text-[15px] leading-tight">
                                {item.label}
                              </span>
                              <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                                <ChevronDown className="w-5 h-5 text-black group-hover:text-black transition-colors shrink-0" />
                              </motion.div>
                            </button>
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="border-t border border-black"
                                >
                                  {item.path === "#payments" ? (
                                    isBusinessProfile || profile.role === "business" ? (
                                      <div className="p-6 md:p-5 bg-slate-50/50 space-y-8">
                                        {/* Receiving Section */}
                                        <div>
                                          <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                              <PoundSterling className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-900">AnyTrader Payouts (Receiving)</h3>
                                          </div>
                                          <p className="text-sm text-slate-500 mb-2">Connect your bank account securely via Stripe to receive payouts for your AnyTrader jobs.</p>
                                          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-xl mb-4 font-medium flex items-start gap-2">
                                            <Info className="w-4 h-4 mt-0.5 shrink-0" />
                                            <p><strong>Note:</strong> AnyTrader and AnyRoller are independent platforms. If you are also an AnyRoller taxi driver, you must set up a separate Stripe account inside your Driver Terminal to receive taxi fares.</p>
                                          </div>
                                          
                                          {profile?.stripeConnectId ? (
                                             <div className="bg-white border text-left border-emerald-200 rounded-2xl p-5 flex items-center justify-between shadow-sm relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                                                <div className="flex items-center gap-4 relative z-10">
                                                  <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center shadow-sm border border-black">
                                                    <Building className="w-6 h-6 text-slate-400" />
                                                  </div>
                                                  <div>
                                                    <h4 className="text-sm font-bold text-slate-900">Stripe Connected Account</h4>
                                                    <p className="text-xs text-emerald-600 font-bold flex items-center gap-1"><Check className="w-3 h-3" /> Active & Receiving Payouts</p>
                                                  </div>
                                                </div>
                                                <button onClick={() => window.open("https://connect.stripe.com/express/dashboard", "_blank")} className="relative z-10 text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors border border-blue-200 bg-white shadow-sm">
                                                  Stripe Dashboard
                                                </button>
                                             </div>
                                          ) : (
                                             <div className="bg-white rounded-2xl border border-black p-6 text-center">
                                               <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-blue-100">
                                                 <PoundSterling className="w-5 h-5 text-blue-600" />
                                               </div>
                                               <h3 className="text-sm font-bold text-slate-900 mb-1">Set up AnyTrader Payouts</h3>
                                               <p className="text-xs text-slate-500 mb-4">Connect with Stripe to receive secure payouts directly to your bank account.</p>
                                               <button 
                                                 onClick={() => {
                                                   alert("Redirecting to Stripe Connect onboarding...");
                                                 }}
                                                 className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-blue-700 active:scale-95 transition-all"
                                               >
                                                 Set up Payouts
                                               </button>
                                             </div>
                                          )}
                                        </div>

                                        {/* Paying Out Section */}
                                        <div className="pt-8 border-t border-black">
                                          <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                              <CreditCard className="w-5 h-5 text-slate-600" />
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-900">My Payment Method (Paying Out)</h3>
                                          </div>
                                          <p className="text-sm text-slate-500 mb-4">Add a card to securely pay other tradespeople for projects. This card can also be used to automatically pay for your AnyRoller taxi journeys.</p>
                                          
                                          {savedCards.length > 0 ? (
                                             <div className="space-y-3">
                                               {savedCards.map((card: any) => (
                                                 <div key={card.id} className="bg-white border text-left border-blue-200 rounded-2xl p-5 flex items-center justify-between shadow-sm relative overflow-hidden">
                                                   <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                                                   <div className="flex items-center gap-4 relative z-10">
                                                     <div className="w-12 h-8 rounded bg-slate-800 text-white flex items-center justify-center font-black text-xs tracking-widest shadow-sm uppercase">
                                                       {card.brand || "CARD"}
                                                     </div>
                                                     <div>
                                                       <h4 className="text-sm font-bold text-slate-900">•••• •••• •••• {card.last4}</h4>
                                                       <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">Expires {card.expMonth}/{card.expYear} • <span className="text-indigo-600 font-bold flex items-center gap-0.5"><Lock className="w-3 h-3 inline" /> Stripe Vaulted</span></p>
                                                     </div>
                                                   </div>
                                                   <button 
                                                     onClick={() => handleDeletePaymentMethod(card.id)}
                                                     className="relative z-10 text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                                                   >
                                                     Remove Card
                                                   </button>
                                                 </div>
                                               ))}
                                               <button 
                                                 onClick={handleAddPaymentMethod}
                                                 disabled={isProcessingSetup}
                                                 className="w-full py-3 bg-white border border-black rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                                               >
                                                 {isProcessingSetup ? "Processing..." : "Add Another Card"}
                                               </button>
                                             </div>
                                          ) : (
                                             <div className="bg-white rounded-2xl border border-black p-6 md:p-8 text-center shadow-sm relative overflow-hidden">
                                               <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-[11px] font-bold text-indigo-700 mb-4">
                                                 <Lock className="w-3.5 h-3.5 text-indigo-600" />
                                                 <span>Secured & Processed directly by Stripe</span>
                                               </div>

                                               <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md border border-indigo-700">
                                                 <CreditCard className="w-7 h-7" />
                                               </div>

                                               <h3 className="text-base font-black text-slate-900 mb-1">Link Payment Card via Stripe</h3>
                                               <p className="text-xs text-slate-600 max-w-md mx-auto mb-4 font-medium leading-relaxed">
                                                 You will be redirected securely to <strong>Stripe's PCI-DSS Level 1 Vault</strong> to link your credit or debit card. AnyTrader <strong>never sees, handles, or stores</strong> your payment card numbers.
                                               </p>

                                               <div className="bg-slate-50 border border-black rounded-xl p-3.5 mb-5 max-w-md mx-auto text-left space-y-2">
                                                 <div className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                                                   <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                                   <span><strong>Direct Stripe Vaulting:</strong> Card details are encrypted directly inside Stripe's bank-grade vault.</span>
                                                 </div>
                                                 <div className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                                                   <Shield className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                                                   <span><strong>Zero Local Storage:</strong> AnyTrader holds £0 card data — only a secure token to charge for pre-approved jobs.</span>
                                                 </div>
                                               </div>

                                               <button 
                                                 onClick={handleAddPaymentMethod}
                                                 disabled={isProcessingSetup}
                                                 className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-7 py-3 rounded-xl text-sm font-black shadow-md active:scale-95 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2 border border-black cursor-pointer"
                                               >
                                                 {isProcessingSetup ? (
                                                   <>
                                                     <Loader2 className="w-4 h-4 animate-spin" />
                                                     <span>Connecting to Stripe...</span>
                                                   </>
                                                 ) : (
                                                   <>
                                                     <Lock className="w-4 h-4" />
                                                     <span>Link Card via Stripe (PCI-1 Secure)</span>
                                                   </>
                                                 )}
                                               </button>

                                               <p className="text-[11px] text-slate-400 font-medium mt-3">
                                                 Supports Visa, Mastercard, American Express & Apple Pay
                                               </p>
                                             </div>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                    <div className="p-6 md:p-5 bg-slate-50/50">
                                      {/* How it Works Banner */}
                                      <details className="bg-blue-50/50 border border-blue-100 rounded-2xl mb-8 group [&_summary::-webkit-details-marker]:hidden">
                                        <summary className="flex items-center justify-between p-4 cursor-pointer list-none select-none">
                                          <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                              <ShieldCheck className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <h4 className="text-sm font-bold text-slate-900">How Automated Payments Work</h4>
                                          </div>
                                          <ChevronDown className="w-5 h-5 text-slate-400 transition-transform group-open:rotate-180" />
                                        </summary>
                                        
                                        <div className="p-4 pt-1 border-t border-blue-100/30">
                                          <p className="text-xs text-slate-600 leading-relaxed mb-3">
                                            Add your card securely once to pay tradespeople for home repairs or projects. This card will also be used to automatically process payments for your AnyRoller taxi journeys. 
                                          </p>
                                          <div className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-wider text-slate-400 bg-white inline-flex px-2 py-1 rounded-md border border-black shadow-sm">
                                            <Shield className="w-3 h-3 text-emerald-500" />
                                            Zero Data Stored Locally
                                          </div>
                                          <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-blue-100/50">
                                            <strong>Security Note:</strong> We do not store or process your credit card details on our servers. 
                                            Your confidential data is transmitted directly to <strong>Stripe's PCI-compliant vault</strong>. 
                                            We only hold a secure token used exclusively to charge you for completed work or journeys.
                                          </p>
                                        </div>
                                      </details>

                                      {/* Saved Cards / Add Card */}
                                      {savedCards.length > 0 ? (
                                        <div className="space-y-3">
                                          {savedCards.map((card: any) => (
                                            <div key={card.id} className="bg-white border text-left border-emerald-200 rounded-2xl p-5 flex items-center justify-between shadow-sm relative overflow-hidden">
                                              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                                              <div className="flex items-center gap-4 relative z-10">
                                                <div className="w-12 h-8 rounded bg-slate-800 text-white flex items-center justify-center font-black text-xs tracking-widest shadow-sm uppercase">
                                                  {card.brand || "CARD"}
                                                </div>
                                                <div>
                                                  <h4 className="text-sm font-bold text-slate-900">•••• •••• •••• {card.last4}</h4>
                                                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">Expires {card.expMonth}/{card.expYear} • <span className="text-indigo-600 font-bold flex items-center gap-0.5"><Lock className="w-3 h-3 inline" /> Stripe Vaulted</span></p>
                                                </div>
                                              </div>
                                              <button 
                                                onClick={() => handleDeletePaymentMethod(card.id)}
                                                className="relative z-10 text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                                              >
                                                Remove Card
                                              </button>
                                            </div>
                                          ))}
                                          <button 
                                            onClick={handleAddPaymentMethod}
                                            disabled={isProcessingSetup}
                                            className="w-full py-3 bg-white border border-black rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                                          >
                                            {isProcessingSetup ? "Processing..." : "Add Another Card"}
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="space-y-4">
                                          <div className="bg-white rounded-2xl border border-black p-6 md:p-8 text-center shadow-sm relative overflow-hidden">
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-[11px] font-bold text-indigo-700 mb-4">
                                              <Lock className="w-3.5 h-3.5 text-indigo-600" />
                                              <span>Secured & Processed directly by Stripe</span>
                                            </div>

                                            <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md border border-indigo-700">
                                              <CreditCard className="w-7 h-7" />
                                            </div>

                                            <h3 className="text-base font-black text-slate-900 mb-1">Link Payment Card via Stripe</h3>
                                            <p className="text-xs text-slate-600 max-w-md mx-auto mb-4 font-medium leading-relaxed">
                                              Add a card to quickly and securely pay for home repairs or AnyRoller taxi rides. You will link your card directly inside <strong>Stripe's PCI-DSS Level 1 Vault</strong> — AnyTrader <strong>never sees or stores your card details</strong>.
                                            </p>

                                            <div className="bg-slate-50 border border-black rounded-xl p-3.5 mb-5 max-w-md mx-auto text-left space-y-2">
                                              <div className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                                                <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                                <span><strong>Direct Stripe Vaulting:</strong> Card details are transmitted and encrypted directly by Stripe.</span>
                                              </div>
                                              <div className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                                                <Shield className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                                                <span><strong>Zero Local Storage:</strong> We store zero card numbers on AnyTrader servers.</span>
                                              </div>
                                            </div>

                                            <button 
                                              onClick={handleAddPaymentMethod}
                                              disabled={isProcessingSetup}
                                              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-7 py-3 rounded-xl text-sm font-black shadow-md active:scale-95 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2 border border-black cursor-pointer"
                                            >
                                              {isProcessingSetup ? (
                                                <>
                                                  <Loader2 className="w-4 h-4 animate-spin" />
                                                  <span>Connecting to Stripe...</span>
                                                </>
                                              ) : (
                                                <>
                                                  <Lock className="w-4 h-4" />
                                                  <span>Link Card via Stripe (PCI-1 Secure)</span>
                                                </>
                                              )}
                                            </button>

                                            <p className="text-[11px] text-slate-400 font-medium mt-3">
                                              Supports Visa, Mastercard, American Express & Apple Pay
                                            </p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    )
                                  ) : item.path === "#appointments" ? (
                                    <div className="p-6 md:p-5 bg-slate-50/50 space-y-6">
                                      <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                          <CalendarClock className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                          <h3 className="text-lg font-bold text-slate-900">Appointment System (Add-on)</h3>
                                          <p className="text-sm text-slate-500">Allow customers to book real-time appointments for your services.</p>
                                        </div>
                                      </div>

                                      {profile?.appointmentSettings?.enabled ? (
                                        <div className="space-y-4">
                                          <div className="bg-white rounded-xl border-2 border-blue-600 shadow-sm p-5 flex items-center justify-between">
                                            <div>
                                              <p className="font-bold text-slate-900">Add-on Active</p>
                                              <p className="text-xs text-slate-500">You are currently subscribed to the Appointment system.</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <span className="bg-green-100 text-green-700 font-black text-[10px] uppercase px-2 py-1 rounded">£9.99/mo</span>
                                              <button 
                                                onClick={handleCancelAppointments}
                                                className="text-xs font-bold text-red-600 hover:underline ml-2"
                                                disabled={isProcessingSetup}
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          </div>
                                          <div className="bg-white rounded-xl border-2 border-blue-600 shadow-sm p-5">
                                            <h4 className="font-bold text-slate-900 mb-2">Services & Working Hours</h4>
                                            <p className="text-sm text-slate-600 mb-4">Go to your Dashboard or Availability Calendar to manage your provided services, prices, and available appointment slots.</p>
                                            <button 
                                              onClick={() => navigate('/availability')}
                                              className="w-full sm:w-auto px-4 py-2 bg-slate-900 text-white font-bold rounded-lg text-sm hover:bg-slate-800 transition-colors"
                                            >
                                              Manage Availability
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="bg-white rounded-xl border-2 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)] p-6 text-center">
                                          <Sparkles className="w-8 h-8 text-amber-500 mx-auto mb-3" />
                                          <h4 className="text-lg font-bold text-slate-900 mb-2">Unlock Automated Bookings</h4>
                                          <p className="text-sm text-slate-600 mb-6">Reduce back-and-forth messaging. Let customers see your availability and request appointments directly from your profile. Only for £9.99/month.</p>
                                          <button 
                                            onClick={handleSubscribeToAppointments}
                                            disabled={isProcessingSetup}
                                            className="bg-black text-white px-6 py-3 rounded-xl font-bold shadow-md hover:bg-slate-800 active:scale-95 transition-all text-sm w-full md:w-auto"
                                          >
                                            {isProcessingSetup ? <Loader2 className="w-5 h-5 animate-spin mx-auto"/> : "Enable £9.99/mo Add-on"}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ) : item.path === "#business" ? (
                                     <div className="p-6 md:p-5 bg-slate-50/50">
                                       {profile.corporateAccountId ? (
                                          <div className="p-6 bg-white border border-black rounded-2xl shadow-sm text-center">
                                            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                              <Briefcase className="w-8 h-8 text-blue-600" />
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-900 mb-1">Business Profile Linked</h3>
                                            <p className="text-sm text-slate-500 mb-6">Your account is linked to your corporate account.</p>
                                            
                                            <div className="flex flex-col gap-3 max-w-sm mx-auto">
                                              <button 
                                                onClick={() => window.location.href = '/corporate'}
                                                className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors"
                                              >
                                                <span>Go to Corporate Portal</span>
                                              </button>
                                              <button 
                                                className="text-sm font-bold text-slate-400 hover:text-red-500 transition-colors"
                                              >
                                                Unlink Business Profile
                                              </button>
                                            </div>
                                          </div>
                                       ) : (
                                          <div className="p-6 bg-white border border-black rounded-2xl shadow-sm text-center">
                                            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                              <Briefcase className="w-8 h-8 text-slate-400" />
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-900 mb-1">Set up a Business Profile</h3>
                                            <p className="text-sm text-slate-500 mb-6">Add a business email to keep work rides and receipts separate. If your company uses AnyRoller Corporate, this will link your account.</p>
                                            
                                            <div className="flex flex-col sm:flex-row items-center gap-3 max-w-lg mx-auto">
                                              <div className="relative flex-1 w-full">
                                                <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                                                <input 
                                                  type="email" 
                                                  placeholder="Work email address" 
                                                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-slate-900 placeholder:text-slate-400"
                                                />
                                              </div>
                                              <button 
                                                className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 active:scale-95 transition-all whitespace-nowrap shadow-sm shadow-blue-500/20"
                                              >
                                                Link Account
                                              </button>
                                            </div>
                                            
                                            <div className="mt-8 pt-6 border-t border border-black inline-block w-full">
                                              <p className="text-xs text-slate-500 mb-3">Does your company need an AnyRoller Corporate account?</p>
                                              <button 
                                                onClick={() => window.location.href = '/corporate'}
                                                className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors"
                                              >
                                                Learn about AnyRoller Corporate &rarr;
                                              </button>
                                            </div>
                                          </div>
                                       )}
                                     </div>
                                  ) : item.path === "#passcode" ? (
                                    <div className="p-6 md:p-5 bg-slate-50/50">
                                      <div className="p-6 bg-white border border-black rounded-2xl shadow-sm">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                                              <ShieldCheck className="w-6 h-6 text-emerald-600" />
                                            </div>
                                            <div>
                                              <h3 className="font-bold text-slate-900 leading-tight">PIN Verification</h3>
                                              <p className="text-xs text-slate-500 mt-1">Driver will ask for a PIN (last 4 digits of your phone number) before starting the trip.</p>
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            role="switch"
                                            aria-checked={profile?.requirePasscode === true}
                                            onClick={async () => {
                                              if (user?.uid) {
                                                const newStatus = profile?.requirePasscode !== true;
                                                await updateDoc(doc(db, "users", user.uid), { requirePasscode: newStatus });
                                              }
                                            }}
                                            className={cn(
                                              "relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full border border-black transition-colors duration-200 ease-in-out focus:outline-none",
                                              profile?.requirePasscode === true ? "bg-emerald-600" : "bg-slate-200"
                                            )}
                                          >
                                            <span
                                              className={cn(
                                                "pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs border border-black transition duration-200 ease-in-out",
                                                profile?.requirePasscode === true ? "translate-x-5" : "translate-x-0.5"
                                              )}
                                            />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ) : item.path === "#biometrics" || item.path === "#privacy" ? (
                                    <BiometricSettings user={user} />
                                  ) : item.path === "#uimode" || item.path === "#settings" ? (
                                    renderUiModeSelector()
                                  ) : (
                                    <div className="p-5 text-center bg-slate-50">
                                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-black">
                                        <item.icon className="w-5 h-5 text-slate-400" />
                                      </div>
                                      <p className="text-slate-500 font-medium">Settings for {item.label} coming soon.</p>
                                    </div>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      } else {
                        return (
                          <Link 
                            key={index}
                            to={item.path}
                            className="flex items-center gap-3 p-3 border-b border border-black last:border-0 hover:bg-slate-50 transition-all group"
                          >
                            <div className="w-8 h-8 md:w-10 md:h-10 shrink-0 bg-slate-50 rounded-[10px] flex items-center justify-center text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                              <item.icon className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} />
                            </div>
                            <span className="flex-1 font-bold text-black group-hover:text-black transition-colors text-xs md:text-[15px] leading-tight">
                              {item.label}
                            </span>
                            <ChevronRight className="w-5 h-5 text-black group-hover:text-black transition-colors shrink-0" />
                          </Link>
                        );
                      }
                    })}
            </div>
          </div>
        );
      })}
      {/* Grouped Menu List End */}
      </>

      {/* Log Out Button */}
      <button 
        type="button"
        onClick={() => setShowLogoutConfirm(true)}
        className="w-full bg-red-50 text-red-600 p-5 rounded-[2rem] border border-black font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-all mb-8 cursor-pointer"
      >
        <LogOut className="w-5 h-5" />
        Log Out
      </button>

      {/* Tradesperson specific sections - Reviews */}
      {isBusinessProfile && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">Client Reviews</h3>
            <div className="flex items-center gap-1 text-orange-500">
              <Star className="w-4 h-4 fill-current" />
              <span className="font-bold">{profile.rating?.toFixed(1) || "5.0"}</span>
              <span className="text-slate-400 text-sm font-medium">({profile.totalReviews || 0})</span>
            </div>
          </div>

          {loadingReviews ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.slice(0, visibleReviewsCount).map((review) => (
                <div key={review.id} className="bg-white p-6 rounded-[2rem] border border-black shadow-[0_4px_20px_rgb(0,0,0,0.05)] bg-gradient-to-b from-white to-slate-50/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          className={cn(
                            "w-3.5 h-3.5",
                            i < review.rating ? "text-orange-500 fill-current" : "text-slate-200"
                          )} 
                        />
                      ))}
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(review.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed italic">"{review.comment}"</p>
                </div>
              ))}

              {reviews.length > visibleReviewsCount ? (
                <button
                  onClick={() => setVisibleReviewsCount(prev => prev + 5)}
                  className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-2xl text-xs font-bold transition-all border border-black flex items-center justify-center gap-2 mt-4 cursor-pointer shadow-sm active:scale-[0.99]"
                >
                  <ChevronDown className="w-4 h-4 text-slate-700" />
                  <span>Show More Reviews (+5 of {reviews.length - visibleReviewsCount} remaining)</span>
                </button>
              ) : reviews.length > 5 ? (
                <button
                  onClick={() => setVisibleReviewsCount(5)}
                  className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-2xl text-xs font-semibold transition-all border border-slate-300 flex items-center justify-center gap-1.5 mt-4 cursor-pointer"
                >
                  <span>Show Fewer Reviews</span>
                </button>
              ) : null}
            </div>
          ) : (
            <div className="bg-white p-5 rounded-[2rem] border border-black shadow-[0_4px_20px_rgb(0,0,0,0.05)] bg-gradient-to-b from-white to-slate-50/30 text-center">
              <p className="text-slate-500 text-sm">No reviews yet.</p>
            </div>
          )}
        </div>
      )}

      <p className="text-center text-slate-400 text-sm font-medium mt-12">
        AnyTrader v1.0
      </p>
      <AnimatePresence>
        {isEditing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2rem] w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-5 pb-4 flex items-center justify-between shrink-0 border-b border-slate-50">
                <h3 className="text-xl font-bold text-slate-900">Edit Profile</h3>
                <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Full Name</label>
                  <input 
                    type="text"
                    className="w-full p-3 rounded-xl border border-black focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all"
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Postcode</label>
                  <input 
                    type="text"
                    className="w-full p-3 rounded-xl border border-black focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all uppercase"
                    value={editData.postcode}
                    onChange={(e) => setEditData({ ...editData, postcode: e.target.value })}
                    onBlur={async (e) => {
                      const val = e.target.value;
                      if (!val) return;
                      try {
                        const data = await lookupPostcode(val);
                        if (data) {
                          setEditData(prev => ({ 
                            ...prev, 
                            city: data.city,
                            county: data.county,
                            postcode: data.postcode
                          }));
                        }
                      } catch (err) {
                        console.error("Error looking up postcode:", err);
                      }
                    }}
                  />
                </div>
                {editData.city && (
                  <div className="mt-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-black flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs text-slate-600 font-medium">
                      {editData.city}{editData.county ? `, ${editData.county}` : ""}
                    </span>
                  </div>
                )}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Bio</label>
                    {isBusinessProfile && (
                      <button
                        type="button"
                        onClick={handleAIPolish}
                        disabled={!editData.bio || isAIPolishing}
                        className="flex items-center gap-1 text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition-colors"
                      >
                        <Sparkles className="w-3 h-3" />
                        {isAIPolishing ? "Polishing..." : "AI Polish"}
                      </button>
                    )}
                  </div>
                  <textarea 
                    className="w-full p-3 rounded-xl border border-black focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all resize-none"
                    rows={4}
                    maxLength={300}
                    value={editData.bio || ''}
                    onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                  />
                  <div className="text-right mt-1">
                    <span className="text-[10px] font-bold text-slate-400">{(editData.bio || '').length}/300</span>
                  </div>
                </div>
                {isBusinessProfile && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Trades (comma separated)</label>
                        <span className="text-[10px] font-bold text-slate-400">{editData.trades.split(',').filter(t => t.trim() !== '').length}/15</span>
                      </div>
                      <input 
                        type="text"
                        className="w-full p-3 rounded-xl border border-black focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all"
                        value={editData.trades}
                        onChange={(e) => setEditData({ ...editData, trades: e.target.value })}
                        placeholder="Plumbing, Electrical, etc."
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Tags (comma separated)</label>
                        <span className="text-[10px] font-bold text-slate-400">
                          {editData.tags ? editData.tags.split(',').filter((t: string) => t.trim() !== '').length : 0}/15
                        </span>
                      </div>
                      <input 
                        type="text"
                        className="w-full p-3 rounded-xl border border-black focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all"
                        value={editData.tags}
                        onChange={(e) => setEditData({ ...editData, tags: e.target.value })}
                        placeholder="Reliable, Fast, Expert, etc. (Max 15 tags)"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-3 mt-4">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Professional Badges</label>
                          <button 
                            type="button" 
                            onClick={() => setShowBadgeInfo(!showBadgeInfo)}
                            onBlur={() => setShowBadgeInfo(false)}
                            className="relative group focus:outline-none"
                          >
                            <Info className="w-4 h-4 text-slate-400 cursor-help" />
                            <div className={cn(
                              "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-xl shadow-xl transition-all z-50 pointer-events-none text-left",
                              showBadgeInfo ? "opacity-100 visible" : "opacity-0 invisible md:group-hover:opacity-100 md:group-hover:visible"
                            )}>
                              <p className="font-bold mb-1">How to use badges:</p>
                              <ul className="list-disc pl-4 space-y-1 text-slate-300">
                                <li><strong>Profile:</strong> Shows on your main profile page (unlimited).</li>
                                <li><strong>Search Feed:</strong> Shows on your small card in search results (max 4).</li>
                              </ul>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                            </div>
                          </button>
                        </div>
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                          Search Card: {editData.searchFeedBadges?.length || 0}/4
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-3 mb-6">
                        {PROFESSIONAL_BADGES.map((badge) => {
                          const Icon = { ShieldCheck, Clock, FileText, Shield, CheckCircle, MapPin, Heart, Star }[badge.icon] as any;
                          const isSelected = editData.badges?.includes(badge.id) || badge.id === 'local_business';
                          const isSearchFeed = editData.searchFeedBadges?.includes(badge.id);
                          const isSearchFeedDisabled = !isSearchFeed && (editData.searchFeedBadges?.length || 0) >= 4;

                          return (
                            <div
                              key={badge.id}
                              className={cn(
                                "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border transition-all",
                                isSelected
                                  ? "bg-blue-50/50 border-blue-200" 
                                  : "bg-white border border-black"
                              )}
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                  isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
                                )}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                <span className={cn("text-sm font-bold", isSelected ? "text-blue-900" : "text-slate-600")}>{badge.name}</span>
                              </div>
                              
                              <div className="flex items-center gap-2 sm:gap-4 pl-11 sm:pl-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (badge.id === 'local_business') return;
                                    const newBadges = isSelected
                                      ? editData.badges.filter(b => b !== badge.id)
                                      : [...(editData.badges || []), badge.id];

                                    setEditData({ ...editData, badges: newBadges });
                                  }}
                                  className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                                    isSelected 
                                      ? "bg-blue-600 text-white" 
                                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                  )}
                                >
                                  {isSelected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                  Profile
                                </button>
                                
                                <button
                                  type="button"
                                  disabled={isSearchFeedDisabled}
                                  onClick={() => {
                                    const newSearchFeedBadges = isSearchFeed
                                      ? editData.searchFeedBadges.filter(b => b !== badge.id)
                                      : [...(editData.searchFeedBadges || []), badge.id];
                                    setEditData({ ...editData, searchFeedBadges: newSearchFeedBadges });
                                  }}
                                  className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed",
                                    isSearchFeed 
                                      ? "bg-indigo-600 text-white" 
                                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                  )}
                                  title={isSearchFeedDisabled ? "Max 4 search feed badges allowed" : ""}
                                >
                                  {isSearchFeed ? <Check className="w-3 h-3" /> : <Star className="w-3 h-3" />}
                                  Search Feed
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="p-5 pt-4 flex gap-3 shrink-0 border-t border border-black bg-slate-50/50">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="flex-1 p-4 rounded-2xl font-bold text-slate-600 bg-white border border-black hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 p-4 rounded-2xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                >
                  {isSaving && <Loader2 className="w-5 h-5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditingMiniProfile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col justify-end sm:items-center sm:justify-center"
          >
            <motion.div 
              initial={{ y: "100%", sm: { scale: 0.9, opacity: 0 } }}
              animate={{ y: 0, sm: { scale: 1, opacity: 1 } }}
              exit={{ y: "100%", sm: { scale: 0.9, opacity: 0 } }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white rounded-t-[2rem] sm:rounded-[2rem] w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-5 pb-4 flex items-center justify-between shrink-0 border-b border-slate-50">
                <h3 className="text-xl font-bold text-slate-900">Mini Profile Card Settings</h3>
                <button onClick={() => setIsEditingMiniProfile(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-black">
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block uppercase tracking-wide">Call-Out Fee (£)</label>
                    <input 
                      type="number"
                      className="w-full p-3 rounded-xl border border-black focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all text-sm font-bold"
                      value={editData.miniProfileSettings?.callOutFee || ''}
                      onChange={(e) => setEditData({ 
                        ...editData, 
                        miniProfileSettings: { ...(editData.miniProfileSettings || {} as any), callOutFee: Number(e.target.value) } 
                      })}
                      placeholder="e.g. 50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block uppercase tracking-wide">Hourly Rate (£/hr)</label>
                    <input 
                      type="number"
                      className="w-full p-3 rounded-xl border border-black focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all text-sm font-bold"
                      value={editData.miniProfileSettings?.hourlyRate || ''}
                      onChange={(e) => setEditData({ 
                        ...editData, 
                        miniProfileSettings: { ...(editData.miniProfileSettings || {} as any), hourlyRate: Number(e.target.value) } 
                      })}
                      placeholder="e.g. 80"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block uppercase tracking-wide">Extra Info</label>
                    <textarea 
                      className="w-full p-3 rounded-xl border border-black focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all text-sm resize-y"
                      value={editData.miniProfileSettings?.extraInfo || ''}
                      onChange={(e) => setEditData({ 
                        ...editData, 
                        miniProfileSettings: { ...(editData.miniProfileSettings || {} as any), extraInfo: e.target.value } 
                      })}
                      maxLength={120}
                      placeholder="e.g. Rate excludes materials."
                      rows={3}
                    />
                    <div className="text-right mt-1">
                      <span className="text-[10px] font-bold text-slate-400">{(editData.miniProfileSettings?.extraInfo || '').length}/120</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 pt-4 flex gap-3 shrink-0 border-t border border-black bg-white">
                <button 
                  onClick={() => setIsEditingMiniProfile(false)}
                  className="flex-1 p-4 rounded-2xl font-bold text-slate-600 bg-slate-50 border border-black hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    await handleSave();
                    setIsEditingMiniProfile(false);
                  }}
                  disabled={isSaving}
                  className="flex-1 p-4 rounded-2xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                >
                  {isSaving && <Loader2 className="w-5 h-5 animate-spin" />}
                  Save Settings
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditingIM && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col justify-end sm:items-center sm:justify-center"
          >
            <motion.div 
              initial={{ y: "100%", sm: { scale: 0.9, opacity: 0 } }}
              animate={{ y: 0, sm: { scale: 1, opacity: 1 } }}
              exit={{ y: "100%", sm: { scale: 0.9, opacity: 0 } }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white rounded-t-[2rem] sm:rounded-[2rem] w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-5 pb-4 flex items-center justify-between shrink-0 border-b border-slate-50">
                <h3 className="text-xl font-bold text-slate-900">Instant Match Settings</h3>
                <button onClick={() => setIsEditingIM(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                <label className="flex items-center justify-between p-3 border border-black rounded-xl mb-4 hover:bg-slate-50 cursor-pointer transition-colors">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                    <span className="text-sm font-bold text-slate-700">Available for Instant Match</span>
                  </div>
                  <input
                    type="checkbox"
                    className="w-5 h-5 accent-blue-600"
                    checked={editData.isAvailableForInstantMatch || false}
                    onChange={(e) => setEditData({...editData, isAvailableForInstantMatch: e.target.checked})}
                  />
                </label>
                
                {editData.isAvailableForInstantMatch && (
                  <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-black">
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block uppercase tracking-wide">Call-Out Fee (£)</label>
                      <input 
                        type="number"
                        className="w-full p-3 rounded-xl border border-black focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all text-sm font-bold"
                        value={editData.instantMatchPricing?.callOutFee || ''}
                        onChange={(e) => setEditData({ 
                          ...editData, 
                          instantMatchPricing: { ...(editData.instantMatchPricing || {} as any), callOutFee: Number(e.target.value) } 
                        })}
                        placeholder="e.g. 50"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block uppercase tracking-wide">Hourly Rate (£/hr)</label>
                      <input 
                        type="number"
                        className="w-full p-3 rounded-xl border border-black focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all text-sm font-bold"
                        value={editData.instantMatchPricing?.hourlyRate || ''}
                        onChange={(e) => setEditData({ 
                          ...editData, 
                          instantMatchPricing: { ...(editData.instantMatchPricing || {} as any), hourlyRate: Number(e.target.value) } 
                        })}
                        placeholder="e.g. 80"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block uppercase tracking-wide">Terms & Conditions</label>
                      <textarea 
                        className="w-full p-3 rounded-xl border border-black focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all text-sm resize-y"
                        value={editData.instantMatchPricing?.terms || ''}
                        onChange={(e) => setEditData({ 
                          ...editData, 
                          instantMatchPricing: { ...(editData.instantMatchPricing || {} as any), terms: e.target.value } 
                        })}
                        placeholder="e.g. Rate excludes materials. Client must be present to provide access."
                        rows={3}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5 pt-4 flex gap-3 shrink-0 border-t border border-black bg-white">
                <button 
                  onClick={() => setIsEditingIM(false)}
                  className="flex-1 p-4 rounded-2xl font-bold text-slate-600 bg-slate-50 border border-black hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    await handleSave();
                    setIsEditingIM(false);
                  }}
                  disabled={isSaving}
                  className="flex-1 p-4 rounded-2xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                >
                  {isSaving && <Loader2 className="w-5 h-5 animate-spin" />}
                  Save Settings
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bio Info Modal */}
      <AnimatePresence>
        {showBioInfo && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Info className="w-6 h-6 text-blue-600" />
                  How We Use Your Bio
                </h3>
                <button 
                  onClick={() => setShowBioInfo(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <Search className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 mb-1">Smart Matching</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Our AI analyzes your bio to match you with highly relevant job leads. The more specific you are about your skills and experience, the better the matches.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                    <Briefcase className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 mb-1">Highlight Experience</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Mention specific tools you use, years of experience, and types of projects you specialize in (e.g., "10 years experience in Victorian home renovations").
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                    <Star className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 mb-1">Stand Out</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Homeowners read your bio when deciding who to hire. A professional, detailed bio builds trust and increases your chances of winning the job.
                    </p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowBioInfo(false)}
                className="w-full mt-8 bg-slate-100 text-slate-700 p-4 rounded-2xl font-bold hover:bg-slate-200 transition-colors"
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Guide Modal */}
      <AnimatePresence>
        {showUserGuide && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl max-h-[80vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between mb-6 sticky top-0 bg-white pt-2 pb-4 border-b border border-black z-10">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-blue-600" />
                  Platform User Guide
                </h3>
                <button 
                  onClick={() => setShowUserGuide(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <span>🤖</span> AI Price Chatbot
                  </h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Use our smart chatbot to get instant, accurate price estimates for various jobs based on current market rates.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <span>📅</span> Availability Calendar
                  </h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Set your standard working hours and block out days when you're busy. This helps homeowners know when you're free to take on new jobs.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <span>💼</span> Job Management
                  </h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Track all your active, completed, and cancelled jobs in the "My Jobs" section. Keep your workflow organized and efficient.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <span>📸</span> Portfolio & Profile
                  </h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Upload high-quality photos of your past work and write a detailed bio. A strong profile builds trust and wins more jobs!
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <span>🛡️</span> Verification Center
                  </h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Upload your certifications and ID to get the "Verified" badge. Verified tradespeople get significantly more job offers.
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setShowUserGuide(false)}
                className="w-full mt-8 bg-blue-600 text-white p-4 rounded-2xl font-bold hover:bg-blue-700 transition-colors"
              >
                Awesome, got it!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mock Checkout Modal */}
      <AnimatePresence>
        {showCheckoutForTier && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-black"
            >
              <div className="p-6 border-b border border-black bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Secure Checkout</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Powered by Stripe (Mock)</p>
                  </div>
                </div>
                <button 
                  onClick={() => !isProcessingPayment && setShowCheckoutForTier(null)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                  disabled={isProcessingPayment}
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <div className="p-5 space-y-6">
                <div className="bg-slate-50 p-4 rounded-2xl border border-black flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Selected Plan</p>
                    <p className="text-lg font-black text-slate-900">{showCheckoutForTier.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-500 uppercase">Monthly</p>
                    <p className="text-xl font-black text-blue-600">£{showCheckoutForTier.price}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Card Information</label>
                    <div className="relative">
                      <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input 
                        type="text"
                        placeholder="4242 4242 4242 4242"
                        className="w-full pl-12 pr-4 py-4 rounded-2xl border border-black focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all font-mono text-sm"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expiry</label>
                      <input 
                        type="text"
                        placeholder="MM / YY"
                        className="w-full p-4 rounded-2xl border border-black focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all font-mono text-sm"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value.replace(/\D/g, '').replace(/(.{2})/g, '$1 / ').trim().slice(0, 7))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CVC</label>
                      <input 
                        type="text"
                        placeholder="123"
                        className="w-full p-4 rounded-2xl border border-black focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all font-mono text-sm"
                        value={cvc}
                        onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 3))}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-2xl flex gap-3">
                  <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
                  <p className="text-[10px] text-blue-700 leading-relaxed">
                    Your payment information is encrypted and processed securely. This is a simulation environment; no real funds will be moved.
                  </p>
                </div>

                <button
                  onClick={handleSubscribe}
                  disabled={isProcessingPayment || !cardNumber || !expiryDate || !cvc}
                  className="w-full bg-blue-600 text-white p-5 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessingPayment ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5" /> Pay £{showCheckoutForTier.price} & Subscribe
                    </>
                  )}
                </button>
                <p className="text-center text-[10px] text-slate-400">
                  By subscribing, you agree to our Terms of Service and Privacy Policy.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Master Platform Terms & Legal Modal */}
      <TermsModal 
        isOpen={showProfileTermsModal} 
        onClose={() => setShowProfileTermsModal(false)} 
      />

      {/* Trader Notification Timing & Radius Preferences Modal */}
      <TraderNotificationPreferencesModal
        isOpen={showMatchTimingModal}
        onClose={() => setShowMatchTimingModal(false)}
        traderProfile={profile}
        onSaved={(updated) => {
          setProfile((prev: any) => ({
            ...prev,
            matchNotificationSettings: updated,
          }));
        }}
      />

      {/* Double Confirmation Logout Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-black">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center border border-black/10">
                <LogOut className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Log Out</h3>
                <p className="text-slate-500 mt-2 text-sm">Are you sure you want to log out of your account?</p>
              </div>
              <div className="flex gap-3 w-full pt-4">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 p-3 rounded-xl border border-black text-slate-700 font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex-1 p-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20 cursor-pointer"
                >
                  Log Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

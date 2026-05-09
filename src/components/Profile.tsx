import { TradeBot } from "./TradeBot";
import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { logout, db, doc, updateDoc, handleFirestoreError, OperationType, storage, ref, uploadBytes, getDownloadURL, collection, query, where, or, and, orderBy, getDocs, onSnapshot, sendNotification } from "@/src/firebase";
import { 
  LogOut, User, Mail, MapPin, Calendar, Shield, Edit2, Check, X, Loader2, Download, FileCheck, Upload, Clock, Star, Image as ImageIcon, Trash2, Briefcase, ChevronRight, Plus,
  Bell, Layout, Home, CreditCard, Bot, BarChart3, Search, History, Zap, HelpCircle, FileText, Pencil, Camera, GripVertical, Info, BookOpen, AlertCircle, Users, ChevronDown,
  ShieldCheck, CheckCircle, CheckCircle2, Heart, Moon, Award, RefreshCw, Pause, Play, XCircle, Sparkles, ShieldAlert, Phone,
  Settings, Gift, MessageSquare, Repeat, Ticket, Locate, Accessibility, Percent, Lock, Globe, Building, PoundSterling
} from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { usePWAInstall } from "@/src/hooks/usePWAInstall";
import { usePortal } from "@/src/lib/PortalContext";
import { cn } from "@/src/lib/utils";
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
      "bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 rounded-[2rem] text-white shadow-2xl shadow-blue-600/20 relative overflow-hidden group transition-all duration-500 border border-white/10",
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
              "rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center transition-all duration-500 shadow-lg",
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
              "rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors shadow-sm",
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
                <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl p-4 flex items-center justify-between">
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
                  <div className="flex-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-4 py-3 text-sm font-mono truncate">
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

export default function Profile() {
  const { user, profile, setProfile } = useAuth();
  const { activePortal, switchPortal } = usePortal();
  const navigate = useNavigate();
  const location = useLocation();
  const { isInstallable, installApp } = usePWAInstall();
  const [isEditing, setIsEditing] = useState(false);
  const [expandedMenuId, setExpandedMenuId] = useState<string | null>(null);
  const [expandedMenuGroups, setExpandedMenuGroups] = useState<string[]>([]);
  const [isEditingNotifications, setIsEditingNotifications] = useState(false);
  const [isEditingIM, setIsEditingIM] = useState(false);
  const [showBioInfo, setShowBioInfo] = useState(false);
  const [showBadgeInfo, setShowBadgeInfo] = useState(false);
  const [showUserGuide, setShowUserGuide] = useState(false);
  const [isTradeBotOpen, setIsTradeBotOpen] = useState(false);
  const [isAchievementsExpanded, setIsAchievementsExpanded] = useState(false);
  const [isVerificationExpanded, setIsVerificationExpanded] = useState(false);
  const [isNotificationsExpanded, setIsNotificationsExpanded] = useState(false);
  const [isBannerAdsEnabled, setIsBannerAdsEnabled] = useState(true);
  const [isEditingServices, setIsEditingServices] = useState(false);
  const [tempServices, setTempServices] = useState<string[]>([]);
  const [newService, setNewService] = useState("");
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});
  const [privacyConsent, setPrivacyConsent] = useState<Record<string, boolean>>({});
  const [verificationError, setVerificationError] = useState<string | null>(null);
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
    searchFeedBadges: profile?.searchFeedBadges || []
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
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [isUploadingPortfolio, setIsUploadingPortfolio] = useState(false);
  const [usage, setUsage] = useState({ quotes: 0, acceptedQuotes: 0 });
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [showCheckoutForTier, setShowCheckoutForTier] = useState<any | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
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
        isAvailableForInstantMatch: profile.isAvailableForInstantMatch || false,
        instantMatchPricing: profile.instantMatchPricing || { callOutFee: 0, hourlyRate: 0, terms: "" }
      });
    }
  }, [isEditing, isEditingIM, profile]);

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
        const storageRef = ref(storage, `avatars/${user.uid}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        downloadUrl = await getDownloadURL(storageRef);
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
        const storageRef = ref(storage, `portfolio/${user.uid}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        downloadUrl = await getDownloadURL(storageRef);
      }
      
      const newPortfolio = [...(profile.portfolio || []), downloadUrl];
      await updateDoc(doc(db, "users", user.uid), {
        portfolio: newPortfolio
      });
      
      setProfile((prev: any) => ({ ...prev, portfolio: newPortfolio }));
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
      const newPortfolio = (profile.portfolio || []).filter((item: string) => item !== url);
      await updateDoc(doc(db, "users", user.uid), {
        portfolio: newPortfolio
      });
      setProfile((prev: any) => ({ ...prev, portfolio: newPortfolio }));
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
        const storageRef = ref(storage, `verifications/${user.uid}/${certType.replace(/\s/g, '_')}_${Date.now()}_${file.name}`);
        console.log("Uploading to:", storageRef.fullPath);
        
        const uploadResult = await uploadBytes(storageRef, file);
        downloadUrlFinal = await getDownloadURL(uploadResult.ref);
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

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    setError(null);
    try {
      const tradesArray = editData.trades.split(",").map(t => t.trim()).filter(t => t !== "");
      const tagsArray = editData.tags.split(",").map(t => t.trim()).filter(t => t !== "");
      
      const finalData = {
        ...editData,
        trades: tradesArray,
        tags: tagsArray,
        services: editData.services,
        badges: editData.badges?.includes('local_business') 
          ? editData.badges 
          : [...(editData.badges || []), 'local_business'],
        searchFeedBadges: editData.searchFeedBadges || []
      };
      
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
      await updateDoc(doc(db, "users", user.uid), {
        services: tempServices
      });
      setProfile((prev: any) => ({ ...prev, services: tempServices }));
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
    setTempServices(profile?.services || []);
    setIsEditingServices(true);
  };

  const cancelEditingServices = () => {
    setIsEditingServices(false);
    setNewService("");
  };

  if (!user || !profile) return null;

  const homeownerMenuGroups = [
    {
      title: "Account",
      items: [
        { icon: User, label: "Account Details", path: "#account" },
        { icon: CreditCard, label: "Payment Methods", path: "#payments" },
        { icon: Shield, label: "Privacy & Security", path: "#privacy" },
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
        { icon: FileText, label: "Terms & Conditions", path: "/profile" },
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
      title: "App",
      items: [
        { icon: Repeat, label: "Switch to AnyTrader", path: "#switch_portal" },
        { icon: Bell, label: "Notifications", path: "/notifications" },
        { icon: Settings, label: "App Settings", path: "#settings" },
        { icon: Shield, label: "Legal & Privacy", path: "#privacy" },
      ]
    }
  ];

  const tradespersonMenuGroups = [
    {
      title: "Account",
      items: [
        { icon: User, label: "Account Details", path: "#account" },
        { icon: Bell, label: "Notification Preferences", path: "#notifications" },
        { icon: CreditCard, label: "Payment Methods", path: "#payments" },
        { icon: Shield, label: "Privacy & Security", path: "#privacy" },
      ]
    },
    {
      title: "Business",
      items: [
        { icon: Layout, label: "My Dashboard", path: "/" },
        { icon: Briefcase, label: "My Jobs", path: "/my-jobs" },
        { icon: CreditCard, label: "My Completed Quotes/Jobs", path: "/my-quotes?mode=completed" },
        { icon: BarChart3, label: "Job Analytics", path: "/analytics" },
        { icon: Calendar, label: "Availability Calendar", path: "/availability" },
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
        { icon: FileText, label: "Terms & Conditions", path: "/profile" },
      ]
    }
  ];

  const menuGroups = activePortal === "anyroller" 
    ? passengerMenuGroups 
    : (profile.role === "tradesperson" ? tradespersonMenuGroups : homeownerMenuGroups);

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
            priceId: "price_mock_" + showCheckoutForTier.name.toLowerCase().replace(/\s/g, "_"), // Replace with actual price ID in future
            successUrl: `${window.location.origin}/profile?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${window.location.origin}/profile`
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

        const tierField = profile.role === "homeowner" ? "homeownerTierId" : "tierId";
        const statusField = profile.role === "homeowner" ? "homeownerSubscriptionStatus" : "subscriptionStatus";
        const periodEndField = profile.role === "homeowner" ? "homeownerCurrentPeriodEnd" : "currentPeriodEnd";
        const cancelField = profile.role === "homeowner" ? "homeownerCancelAtPeriodEnd" : "cancelAtPeriodEnd";

        await updateDoc(doc(db, "users", user.uid), { 
          [tierField]: showCheckoutForTier.name,
          [statusField]: 'trialing',
          [periodEndField]: nextBillingDate.toISOString(),
          [cancelField]: false
        });
        
        setProfile((prev: any) => ({ 
          ...prev, 
          [tierField]: showCheckoutForTier.name,
          [statusField]: 'trialing',
          [periodEndField]: nextBillingDate.toISOString(),
          [cancelField]: false
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
                    onClick={async () => {
                      if (user?.uid) {
                        const newStatus = profile?.requirePasscode !== true;
                        await updateDoc(doc(db, "users", user.uid), { requirePasscode: newStatus });
                        setProfile((prev: any) => ({ ...prev, requirePasscode: newStatus }));
                      }
                    }}
                    className={cn(
                      "w-12 h-7 rounded-full transition-colors relative flex-shrink-0",
                      profile?.requirePasscode === true ? "bg-emerald-500" : "bg-slate-200"
                    )}
                  >
                    <span className={cn(
                      "absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm",
                      profile?.requirePasscode === true ? "translate-x-5" : "translate-x-0"
                    )} />
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
          className="fixed top-5 right-5 z-50 w-11 h-11 bg-white/40 hover:bg-white/70 backdrop-blur-md border border-white/50 rounded-full flex items-center justify-center transition-all shadow-sm active:scale-95"
          aria-label="Close Profile"
        >
          <X className="w-6 h-6 text-slate-800" strokeWidth={2.5} />
        </button>

        <div className="relative z-10 max-w-[420px] mx-auto pt-16 px-5">
          
          {/* Main User Card */}
          <div className="bg-white rounded-[2rem] pt-14 pb-6 px-6 shadow-sm border border-white/50 flex flex-col items-center mb-8 relative">
            
            {/* Avatar overlapping top */}
            <div className="absolute -top-12">
               <div className="w-[104px] h-[104px] rounded-full bg-[#8ccaf5] p-1.5 relative shadow-md">
                 <img src={profile.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || "User")}&background=0D8ABC&color=fff`} className="w-full h-full rounded-full object-cover" />
                 <div className="absolute bottom-1 right-2 w-5 h-5 bg-green-500 rounded-full border-[3px] border-white" />
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
          
          {/* Sign Out Button */}
          <div className="mt-8 px-2">
            <button 
              onClick={handleLogout}
              className="w-full py-4 bg-[#0b1b3d] text-white rounded-full font-bold shadow-sm shadow-[#0b1b3d]/20 hover:bg-[#152a5c] active:scale-95 transition-all text-[15px] border-b-4 border-red-800 flex justify-center"
            >
              Sign Out
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
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Profile</h1>
        <button 
          onClick={() => navigate("/")} 
          className="w-12 h-12 bg-white border border-slate-200 hover:bg-slate-50 border-slate-300 rounded-full flex items-center justify-center transition-all shadow-sm text-slate-600 hover:text-slate-900 focus:ring-2 focus:ring-slate-200"
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

          <div className="space-y-4 mb-8 relative z-10 bg-white/20 backdrop-blur-sm p-4 rounded-3xl border border-white/30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/40 flex items-center justify-center shrink-0 shadow-sm border border-white/50">
                <Zap className="w-4 h-4 text-amber-950 fill-amber-950" />
              </div>
              <p className="text-sm font-bold text-amber-950">Priority Matching during peak hours</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/40 flex items-center justify-center shrink-0 shadow-sm border border-white/50">
                <Percent className="w-4 h-4 text-amber-950" />
              </div>
              <p className="text-sm font-bold text-amber-950">10% discount on every journey</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/40 flex items-center justify-center shrink-0 shadow-sm border border-white/50">
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
                className="w-full py-3 bg-white/30 border border-white/50 text-amber-950 rounded-2xl font-bold text-sm hover:bg-white/40 transition-colors"
              >
                Cancel Subscription
              </button>
            )}
          </div>
        </div>
      )}

      {(profile.role === "tradesperson" || (profile.role === "homeowner" && profile.subscriptionType === "business")) && platformConfig && (
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
                  {profile.role === "tradesperson" ? (
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
                
                {profile.role === "tradesperson" && currentRoleTierId === tier.name && (
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

      <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 [&>div]:break-inside-avoid">
      {/* Profile Card */}
      <div className="bg-white rounded-[2rem] border border-black shadow-md bg-gradient-to-b from-white to-slate-50/50 overflow-hidden p-4 sm:p-6 mb-3 relative">
        <div className="flex flex-col items-center">
          <div className="relative mb-4">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-slate-900 flex items-center justify-center text-white text-2xl md:text-3xl font-bold overflow-hidden border-4 border-white shadow-lg relative">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt={profile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                profile.name?.charAt(0).toUpperCase() || "U"
              )}
              <BadgeOverlay 
                badges={getTraderBadges(profile)} 
                className="absolute -bottom-2 -left-2 -right-2 justify-center z-10" 
              />
            </div>
            <label className="absolute bottom-0 right-0 w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors border border-black">
              <Camera className="w-5 h-5 text-orange-500" />
              <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={isUploading} />
            </label>
          </div>
          
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-1 flex items-center justify-center gap-2">
              {profile.name}
              {profile.referralBoostUntil && new Date(profile.referralBoostUntil) > new Date() && (
                <div className="w-6 h-6 bg-yellow-400 rounded-lg flex items-center justify-center shadow-lg shadow-yellow-400/20" title="Profile Boost Active">
                  <Zap className="w-4 h-4 text-slate-900 fill-slate-900" />
                </div>
              )}
            </h2>
            {profile.role === "tradesperson" && (
              <div className="flex flex-col items-center gap-3 mb-8 mt-2">
                <div className="flex items-stretch gap-3 bg-white p-2 rounded-[1.5rem] border border-black shadow-xl shadow-slate-200/50 w-full max-w-sm">
                  <div className="flex-1 flex items-center justify-center gap-2 px-3 py-3 bg-slate-900 rounded-2xl shadow-lg">
                    <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                    <div className="flex flex-col items-start">
                      <span className="font-black text-white text-lg leading-none">{profile.rating?.toFixed(1) || "5.0"}</span>
                      <span className="text-slate-400 text-[9px] font-black uppercase tracking-tighter mt-0.5">{profile.totalReviews || 0} reviews</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 flex items-center justify-center gap-2 px-3 py-3 bg-green-100/50 rounded-2xl border border-green-200/50">
                    <div className="w-7 h-7 rounded-lg bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/20 shrink-0">
                      <Users className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-[9px] font-black text-green-700 uppercase tracking-widest leading-none mb-0.5">Recommended</span>
                      <span className="text-lg font-black text-green-900 leading-none">{profile.totalRecommendations || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activePortal === "anyroller" && profile.role !== "driver" && (
              <div className="flex justify-center mt-3 mb-6">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 rounded-2xl border border-black shadow-md">
                  <Star className="w-5 h-5 text-slate-800 fill-slate-800" />
                  <span className="font-black text-slate-900 text-lg">{profile.rating?.toFixed(1) || "5.0"}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300 mx-1" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Rider Rating</span>
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
              {profile.role === "tradesperson" ? (
                <>
                  <p className="text-slate-500 text-sm font-medium">Professional Tradesperson</p>
                  <span className="text-slate-300">•</span>
                  <p className="text-slate-500 text-sm flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {profile.postcode || profile.location || "Location not set"}
                  </p>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <p className="text-slate-500 text-[11px] sm:text-xs md:text-sm truncate w-full max-w-[200px] sm:max-w-xs">{profile.email}</p>
                  {profile.homeownerRating && (
                    <div className="flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                      <Star className="w-3 h-3 text-blue-600 fill-blue-600" />
                      <span className="text-[10px] font-bold text-blue-700">
                        Homeowner Rating: {profile.homeownerRating.toFixed(1)} ({profile.totalHomeownerReviews || 0})
                      </span>
                    </div>
                  )}
                </div>
              )}
              <span className="text-slate-300">•</span>
              <p className="text-slate-500 text-sm font-medium flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Member since {new Date(profile.createdAt?.seconds * 1000 || Date.now()).getFullYear()}
              </p>
            </div>
            <button 
              onClick={() => setIsEditing(true)}
              className="absolute top-5 right-8 p-2 rounded-full bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
            >
              <Pencil className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Phase 1: Performance Stats */}
        {profile.role === "tradesperson" && (
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto bg-slate-50 rounded-full flex items-center justify-center mb-2">
                <Briefcase className="w-5 h-5 text-slate-600" />
              </div>
              <p className="text-xl font-bold text-slate-900">{profile.totalJobsDone || 0}</p>
              <p className="text-xs text-slate-500 font-medium">Jobs</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto bg-slate-50 rounded-full flex items-center justify-center mb-2">
                <Clock className="w-5 h-5 text-slate-600" />
              </div>
              <p className="text-xl font-bold text-slate-900">{profile.acceptanceRate || 100}%</p>
              <p className="text-xs text-slate-500 font-medium">Response</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto bg-slate-50 rounded-full flex items-center justify-center mb-2">
                <Shield className="w-5 h-5 text-slate-600" />
              </div>
              <p className="text-xl font-bold text-slate-900">{profile.trustScore || 95}</p>
              <p className="text-xs text-slate-500 font-medium">Trust</p>
            </div>
          </div>
        )}

        {/* Badges & Achievements Section */}
        {profile.role === "tradesperson" && (
          <div className="mt-8">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Award className="w-4 h-4" />
              Badges & Milestones
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {getTraderBadges(profile).map((badge) => (
                <div 
                  key={badge.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-2xl border transition-all hover:shadow-md",
                    badge.bgColor,
                    badge.color,
                    "border-current/10"
                  )}
                >
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0">
                    {badge.icon}
                  </div>
                  <div>
                    <p className="font-black text-xs uppercase tracking-tight">{badge.label}</p>
                    <p className="text-[10px] opacity-70 font-medium leading-tight">{badge.description}</p>
                  </div>
                </div>
              ))}
              {getTraderBadges(profile).length === 0 && (
                <div className="col-span-full py-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                  <p className="text-xs text-slate-400 font-medium italic">Complete more jobs to earn badges!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {profile.role === "tradesperson" && isBannerAdsEnabled && (
          <div className="mt-8 mb-2">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Promotion & Advertising
            </h3>
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="relative z-10">
                <h4 className="text-xl font-bold mb-1">Traders Banner Ad Studio</h4>
                <p className="text-blue-100 text-sm max-w-sm">Promote your profile natively across the platform. Set a budget, reach more homeowners, and track your ad performance down to the penny.</p>
              </div>
              <div className="relative z-10 shrink-0 w-full md:w-auto">
                <Link to="/trader/banner-ads" className="w-full md:w-auto bg-white text-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-slate-50 transition-colors inline-block text-center shadow-lg">
                  Open Ad Studio
                </Link>
              </div>
              <div className="absolute top-0 right-0 opacity-10 pointer-events-none transform translate-x-1/3 -translate-y-1/4">
                <Zap className="w-64 h-64" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Phase 1: Certifications/Achievements */}
      {profile.role === "tradesperson" && (
        <div className="bg-white rounded-[2rem] border border-black shadow-[0_8px_30px_rgb(0,0,0,0.08)] bg-gradient-to-b from-white to-slate-50/50 overflow-hidden p-4 mb-8">
          <div 
            className="flex items-center justify-between cursor-pointer px-2"
            onClick={() => setIsAchievementsExpanded(!isAchievementsExpanded)}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
                <Star className="w-5 h-5 fill-current" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Achievements</h3>
            </div>
            <motion.div
              animate={{ rotate: isAchievementsExpanded ? 180 : 0 }}
              transition={{ duration: 0.3 }}
              className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-colors"
            >
              <ChevronDown className="w-5 h-5 text-slate-500" />
            </motion.div>
          </div>

          <AnimatePresence>
            {isAchievementsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-4 pt-6">
                  <div className="bg-blue-50 p-4 rounded-2xl flex items-center gap-3 border border-blue-100">
                    <Shield className="w-8 h-8 text-blue-600" />
                    <div>
                      <p className="font-bold text-slate-900 text-lg">{profile.trustScore || 95} Trust Score</p>
                      <p className="text-xs text-slate-600">Highly reliable professional</p>
                    </div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-2xl flex items-center gap-3 border border-orange-100">
                    <Star className="w-8 h-8 text-orange-500 fill-orange-500" />
                    <div>
                      <p className="font-bold text-slate-900 text-lg">Top Rated</p>
                      <p className="text-xs text-slate-600">5.0 average rating</p>
                    </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-2xl flex items-center gap-3 border border-green-100">
                    <Check className="w-8 h-8 text-green-600" />
                    <div>
                      <p className="font-bold text-slate-900 text-lg">Verified</p>
                      <p className="text-xs text-slate-600">Identity & Trade checked</p>
                    </div>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-2xl flex items-center gap-3 border border-amber-100">
                    <Zap className="w-8 h-8 text-amber-600" />
                    <div>
                      <p className="font-bold text-slate-900 text-lg">Responsive</p>
                      <p className="text-xs text-slate-600">100% response rate</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Products and Services Section */}
      {profile.role === "tradesperson" && (
        <div className="bg-white rounded-[2rem] border border-black shadow-[0_8px_30px_rgb(0,0,0,0.08)] bg-gradient-to-b from-white to-slate-50/50 overflow-hidden p-5 mb-8 relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                <Briefcase className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Products and Services</h3>
            </div>
            
            {!isEditingServices ? (
              <div className="flex gap-2">
                <button 
                  onClick={startEditingServices}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all text-[11px] font-black uppercase tracking-wider border border-blue-100"
                >
                  <Pencil className="w-3 h-3" />
                  Edit List
                </button>
              </div>
            ) : (
              <div className="flex gap-2 w-full sm:w-auto">
                <button 
                  onClick={handleSaveServices}
                  disabled={isSaving}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-all text-[11px] font-black uppercase tracking-wider shadow-sm disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Save
                </button>
                <button 
                  onClick={cancelEditingServices}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all text-[11px] font-black uppercase tracking-wider border border-black"
                >
                  <X className="w-3 h-3" />
                  Cancel
                </button>
              </div>
            )}
          </div>

          {!isEditingServices ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(profile.services && profile.services.length > 0) ? (
                profile.services.map((service: string, index: number) => (
                  <div key={index} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-black hover:border-blue-200 hover:bg-blue-50/50 transition-all">
                    <div className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                    <span className="text-sm font-bold text-slate-700 leading-relaxed">{service}</span>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-black">
                  <p className="text-sm text-slate-400 italic mb-4">No services added yet. Add your services to attract more homeowners.</p>
                  <button 
                    onClick={startEditingServices}
                    className="px-4 py-2 bg-white border border-black text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
                  >
                    Add Services
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Add all the specific services and products you offer. These will be visible on your public profile.
              </p>
              
              <div className="flex gap-2 sticky top-0 bg-white/90 backdrop-blur-sm py-2 z-20 border-b border-slate-50">
                <input 
                  type="text"
                  placeholder="e.g. Boiler cleaning, servicing & repair"
                  className="flex-1 min-w-0 p-3 rounded-xl border border-black focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-sm"
                  value={newService}
                  onChange={(e) => setNewService(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newService.trim()) {
                      e.preventDefault();
                      setTempServices([...tempServices, newService.trim()]);
                      setNewService("");
                    }
                  }}
                  autoFocus
                />
                <button 
                  onClick={() => {
                    if (newService.trim()) {
                      setTempServices([...tempServices, newService.trim()]);
                      setNewService("");
                    }
                  }}
                  className="px-4 sm:px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm font-bold text-sm flex items-center justify-center gap-2 shrink-0"
                >
                  <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {tempServices.map((service: string, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-black group">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                      <span className="text-sm font-medium text-slate-700">{service}</span>
                    </div>
                    <button 
                      onClick={() => {
                        const updatedServices = tempServices.filter((_: any, i: number) => i !== index);
                        setTempServices(updatedServices);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                
                {tempServices.length === 0 && (
                  <div className="col-span-full text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-black">
                    <p className="text-sm text-slate-400 italic">No services added yet.</p>
                  </div>
                )}
              </div>
              
              {tempServices.length > 0 && (
                <div className="flex justify-end pt-2">
                  <button 
                    onClick={() => {
                      if (window.confirm("Are you sure you want to clear all services?")) {
                        setTempServices([]);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-all text-[11px] font-black uppercase tracking-wider border border-red-100"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear All
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Phase 2: About & Specializations */}
      <div className="bg-white rounded-[2rem] border border-black shadow-md bg-gradient-to-b from-white to-slate-50/50 overflow-hidden p-4 sm:p-6 mb-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-slate-900">About</h3>
            {profile.role === "tradesperson" && (
              <button 
                onClick={() => setShowBioInfo(true)}
                className="p-1 rounded-full text-blue-500 hover:bg-blue-50 transition-colors"
                title="How we use your bio"
              >
                <Info className="w-4 h-4" />
              </button>
            )}
          </div>
          <button 
            onClick={() => setIsEditing(true)}
            className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
        <p className="text-slate-600 text-sm leading-relaxed mb-6">{profile.bio || "No bio provided."}</p>
        
        {profile.role === "tradesperson" && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-slate-900">Specializations</h4>
              <button 
                onClick={() => setIsEditing(true)}
                className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" />
                Add/Edit Skills
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.trades?.map((trade: string) => (
                <span key={trade} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                  {trade}
                </span>
              ))}
              {profile.tags?.map((tag: string) => (
                <span key={tag} className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-slate-900">Professional Badges</h4>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1 text-blue-600 text-xs font-bold hover:underline cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                  Edit prof badges
                </button>
              </div>
              {(!profile.badges || profile.badges.length === 0) ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                  <Award className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 font-medium">No professional badges selected yet.</p>
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-700"
                  >
                    Add badges to stand out
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {profile.badges.map((badgeId: string) => {
                    const badge = PROFESSIONAL_BADGES.find(b => b.id === badgeId);
                    if (!badge) return null;
                    const Icon = { ShieldCheck, Clock, FileText, Shield, CheckCircle, MapPin, Heart, Star }[badge.icon] as any;
                    
                    const colorClasses: Record<string, string> = {
                      blue: "bg-blue-50 text-blue-700 border-blue-100",
                      red: "bg-red-50 text-red-700 border-red-100",
                      green: "bg-green-50 text-green-700 border-green-100",
                      indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
                      amber: "bg-amber-50 text-amber-700 border-amber-100",
                      slate: "bg-slate-50 text-slate-700 border border-slate-200",
                      rose: "bg-rose-50 text-rose-700 border-rose-100"
                    };

                    return (
                      <div 
                        key={badgeId} 
                        className={cn(
                          "flex items-center gap-2.5 p-3 rounded-2xl border transition-all hover:shadow-md hover:shadow-slate-200/50",
                          colorClasses[badge.color] || colorClasses.slate
                        )}
                      >
                        <div className="shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-black leading-tight">{badge.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-slate-900">Instant Match Settings</h4>
                <button 
                  onClick={() => setIsEditingIM(true)}
                  className="flex items-center gap-1 text-blue-600 text-xs font-bold hover:underline cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                  Edit Settings
                </button>
              </div>
              
              {!profile.isAvailableForInstantMatch ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                  <Zap className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 font-medium">Instant Match is currently disabled.</p>
                  <button 
                    onClick={() => setIsEditingIM(true)}
                    className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-700"
                  >
                    Enable Instant Match
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col items-center justify-center">
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Call-Out Fee</p>
                      <p className="text-2xl font-black text-slate-900 leading-none">£{profile.instantMatchPricing?.callOutFee || 0}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col items-center justify-center">
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Hourly Rate</p>
                      <p className="text-2xl font-black text-slate-900 leading-none">£{profile.instantMatchPricing?.hourlyRate || 0}</p>
                    </div>
                  </div>
                  {profile.instantMatchPricing?.terms && (
                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl">
                      <p className="text-[10px] text-amber-700/70 font-black uppercase tracking-widest mb-1">Terms & Conditions</p>
                      <p className="text-sm font-bold text-amber-900">{profile.instantMatchPricing.terms}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Portfolio Section (Tradespeople only) */}
      {profile.role === "tradesperson" && (
        <div className="bg-white rounded-[2rem] border border-black shadow-[0_8px_30px_rgb(0,0,0,0.08)] bg-gradient-to-b from-white to-slate-50/50 overflow-hidden p-5 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600">
                <ImageIcon className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Work Portfolio</h3>
            </div>
            <label className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer hover:bg-blue-700 transition-all active:scale-95">
              {isUploadingPortfolio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Upload Image
              <input 
                type="file" 
                className="hidden" 
                accept="image/*" 
                onChange={handlePortfolioUpload} 
                disabled={isUploadingPortfolio} 
              />
            </label>
          </div>

          {profile.portfolio && profile.portfolio.length > 0 ? (
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={profile.portfolio}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {profile.portfolio.map((url: string) => (
                    <SortablePortfolioItem 
                      key={url} 
                      url={url} 
                      onRemove={removePortfolioImage} 
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-black">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                <ImageIcon className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-slate-500 text-sm font-medium">No portfolio images yet.</p>
              <p className="text-slate-400 text-xs mt-1">Upload photos of your past work to build trust.</p>
            </div>
          )}
        </div>
      )}

      {/* Safety & Emergency Section */}
      {profile.role === "homeowner" && (
        <div className="bg-white rounded-[2rem] border border-black shadow-[0_8px_30px_rgb(0,0,0,0.08)] bg-gradient-to-b from-white to-slate-50/50 overflow-hidden p-5 mb-8" id="safety">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Safety & Emergency Contacts</h3>
            </div>
            {!isAddingEmergency ? (
              <button 
                onClick={() => setIsAddingEmergency(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 transition-all text-[11px] font-black uppercase tracking-wider border border-orange-100"
              >
                <Plus className="w-3 h-3" />
                Add Contact
              </button>
            ) : (
              <button 
                onClick={() => setIsAddingEmergency(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all text-[11px] font-black uppercase tracking-wider border border-black"
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
            )}
          </div>

          <div className="space-y-4">
            {isAddingEmergency && (
              <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input 
                    type="text" 
                    placeholder="Contact Name"
                    className="p-3 bg-white border border-orange-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    value={newEmergencyContact.name}
                    onChange={(e) => setNewEmergencyContact({ ...newEmergencyContact, name: e.target.value })}
                  />
                  <input 
                    type="tel" 
                    placeholder="Phone Number"
                    className="p-3 bg-white border border-orange-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    value={newEmergencyContact.phone}
                    onChange={(e) => setNewEmergencyContact({ ...newEmergencyContact, phone: e.target.value })}
                  />
                </div>
                <button 
                  onClick={handleAddEmergencyContact}
                  disabled={isSaving || !newEmergencyContact.name || !newEmergencyContact.phone}
                  className="w-full py-3 bg-orange-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-orange-600/20 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Save Emergency Contact"}
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(profile.emergencyContacts || []).length === 0 ? (
                <div className="col-span-full py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-black">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                    <Phone className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-slate-500 text-sm font-medium">No emergency contacts listed.</p>
                  <p className="text-slate-400 text-xs mt-1">Add trusted contacts for emergency dispatch shared with drivers.</p>
                </div>
              ) : (
                profile.emergencyContacts.map((contact: any, index: number) => (
                  <div key={index} className="p-4 bg-slate-50 rounded-2xl border border-black flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-orange-500">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{contact.name}</p>
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
        </div>
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
                                    profile.role === "tradesperson" || profile.role === "business" ? (
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
                                          
                                          {profile?.stripeCustomerId ? (
                                             <div className="bg-white border text-left border-blue-200 rounded-2xl p-5 flex items-center justify-between shadow-sm relative overflow-hidden">
                                               <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                                               <div className="flex items-center gap-4 relative z-10">
                                                 <div className="w-12 h-8 rounded bg-slate-800 text-white flex items-center justify-center font-black text-xs tracking-widest shadow-sm">
                                                   VISA
                                                 </div>
                                                 <div>
                                                   <h4 className="text-sm font-bold text-slate-900">•••• •••• •••• 4242</h4>
                                                   <p className="text-xs text-slate-500">Expires 12/28</p>
                                                 </div>
                                               </div>
                                               <button className="relative z-10 text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">
                                                 Remove Card
                                               </button>
                                             </div>
                                          ) : (
                                             <div className="bg-white rounded-2xl border border-black p-6 text-center">
                                               <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-black">
                                                 <CreditCard className="w-5 h-5 text-slate-400" />
                                               </div>
                                               <h3 className="text-sm font-bold text-slate-900 mb-1">No payment method added</h3>
                                               <p className="text-xs text-slate-500 mb-4">Add a credit or debit card securely via Stripe.</p>
                                               
                                               <button 
                                                 onClick={() => {
                                                   alert("Stripe Checkout Modal would open here to securely tokenize card.");
                                                 }}
                                                 className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-slate-800 active:scale-95 transition-all"
                                               >
                                                 Add Credit or Debit Card
                                               </button>
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
                                      {profile?.stripeCustomerId ? (
                                        <div className="bg-white border text-left border-emerald-200 rounded-2xl p-5 flex items-center justify-between shadow-sm relative overflow-hidden">
                                          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                                          <div className="flex items-center gap-4 relative z-10">
                                            <div className="w-12 h-8 rounded bg-slate-800 text-white flex items-center justify-center font-black text-xs tracking-widest shadow-sm">
                                              VISA
                                            </div>
                                            <div>
                                              <h4 className="text-sm font-bold text-slate-900">•••• •••• •••• 4242</h4>
                                              <p className="text-xs text-slate-500">Expires 12/28</p>
                                            </div>
                                          </div>
                                          <button className="relative z-10 text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">
                                            Remove Card
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="space-y-4">
                                          <div className="bg-white rounded-2xl border border-black p-6 text-center">
                                            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-black">
                                              <CreditCard className="w-5 h-5 text-slate-400" />
                                            </div>
                                            <h3 className="text-sm font-bold text-slate-900 mb-1">No payment method added</h3>
                                            <p className="text-xs text-slate-500 mb-4">Add a card to quickly and securely pay for home repairs or taxi rides.</p>
                                            
                                            <button 
                                              onClick={() => {
                                                alert("Stripe Checkout Modal would open here to securely tokenize card.");
                                              }}
                                              className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-slate-800 active:scale-95 transition-all"
                                            >
                                              Add Credit or Debit Card
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    )
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
                                            onClick={async () => {
                                              if (user?.uid) {
                                                const newStatus = profile?.requirePasscode !== true;
                                                await updateDoc(doc(db, "users", user.uid), { requirePasscode: newStatus });
                                              }
                                            }}
                                            className={cn(
                                              "w-14 h-8 rounded-full transition-colors relative flex-shrink-0",
                                              profile?.requirePasscode === true ? "bg-emerald-500" : "bg-slate-200"
                                            )}
                                          >
                                            <span className={cn(
                                              "absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform shadow-sm",
                                              profile?.requirePasscode === true ? "translate-x-6" : "translate-x-0"
                                            )} />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
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
        )})}
      {/* Grouped Menu List End */}
      </>

        {/* Notification Settings Section */}
        {profile.role === "tradesperson" && (
          <div id="notifications" className="bg-white rounded-[2rem] border border-black shadow-md bg-gradient-to-b from-white to-slate-50/50 overflow-hidden mb-3 break-inside-avoid">
            <button 
              onClick={() => setIsNotificationsExpanded(!isNotificationsExpanded)}
              className="w-full p-6 border-b border-slate-50 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
            >
              <div>
                <h2 className="text-lg font-bold text-slate-900">Set your Notification preferences</h2>
                <p className="text-sm text-slate-500">Manage how and when you receive job lead alerts.</p>
              </div>
              <div className="flex items-center gap-4">
                {isSaving && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs font-bold">Saving...</span>
                  </div>
                )}
                <motion.div
                  animate={{ rotate: isNotificationsExpanded ? 180 : 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                >
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                </motion.div>
              </div>
            </button>
            
            <AnimatePresence>
              {isNotificationsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
                >
                  <div className="p-6 space-y-6">
                    {/* Quiet Hours Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
                          <Moon className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900">Quiet Hours (Do Not Disturb)</h3>
                          <p className="text-xs text-slate-500">Mute lead notifications during specific times.</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const newSettings = { ...notificationSettings, quietHoursEnabled: !notificationSettings.quietHoursEnabled };
                          setNotificationSettings(newSettings);
                          handleSaveNotifications(newSettings);
                        }}
                        className={cn(
                          "w-12 h-6 rounded-full transition-colors relative",
                          notificationSettings.quietHoursEnabled ? "bg-blue-600" : "bg-slate-200"
                        )}
                      >
                        <span className={cn(
                          "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform",
                          notificationSettings.quietHoursEnabled ? "translate-x-6" : "translate-x-0"
                        )} />
                      </button>
                    </div>

                    {/* Quiet Hours Time Range */}
                    {notificationSettings.quietHoursEnabled && (
                      <div className="grid grid-cols-2 gap-4 pl-13">
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 text-center">Start Time</label>
                          <div className="relative">
                            <select
                              value={notificationSettings.quietHoursStart}
                              onChange={(e) => {
                                const newSettings = { ...notificationSettings, quietHoursStart: e.target.value };
                                setNotificationSettings(newSettings);
                                handleSaveNotifications(newSettings);
                              }}
                              className="w-full p-4 bg-slate-50 border border-black rounded-2xl text-lg font-black text-slate-900 appearance-none focus:outline-none focus:ring-4 focus:ring-blue-600/10 transition-all text-center cursor-pointer"
                            >
                              {TIME_OPTIONS.map(time => (
                                <option key={time} value={time}>{time}</option>
                              ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                              <ChevronDown className="w-5 h-5" />
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 text-center">End Time</label>
                          <div className="relative">
                            <select
                              value={notificationSettings.quietHoursEnd}
                              onChange={(e) => {
                                const newSettings = { ...notificationSettings, quietHoursEnd: e.target.value };
                                setNotificationSettings(newSettings);
                                handleSaveNotifications(newSettings);
                              }}
                              className="w-full p-4 bg-slate-50 border border-black rounded-2xl text-lg font-black text-slate-900 appearance-none focus:outline-none focus:ring-4 focus:ring-blue-600/10 transition-all text-center cursor-pointer"
                            >
                              {TIME_OPTIONS.map(time => (
                                <option key={time} value={time}>{time}</option>
                              ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                              <ChevronDown className="w-5 h-5" />
                            </div>
                          </div>
                        </div>
                        <p className="col-span-2 text-[10px] text-slate-400 italic">
                          * Notifications received during these hours will still be visible in your "Find Work" feed when you wake up.
                        </p>
                      </div>
                    )}

                    {/* Other Channels */}
                    <div className="space-y-4 pt-4 border-t border-slate-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                            <Bell className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900">Push Notifications</h3>
                            <p className="text-xs text-slate-500">Receive alerts on your device.</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const newSettings = { ...notificationSettings, pushEnabled: !notificationSettings.pushEnabled };
                            setNotificationSettings(newSettings);
                            handleSaveNotifications(newSettings);
                          }}
                          className={cn(
                            "w-12 h-6 rounded-full transition-colors relative",
                            notificationSettings.pushEnabled ? "bg-blue-600" : "bg-slate-200"
                          )}
                        >
                          <span className={cn(
                            "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform",
                            notificationSettings.pushEnabled ? "translate-x-6" : "translate-x-0"
                          )} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
                            <Mail className="w-5 h-5 text-slate-600" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900">Email Alerts</h3>
                            <p className="text-xs text-slate-500">Get lead summaries via email.</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const newSettings = { ...notificationSettings, emailEnabled: !notificationSettings.emailEnabled };
                            setNotificationSettings(newSettings);
                            handleSaveNotifications(newSettings);
                          }}
                          className={cn(
                            "w-12 h-6 rounded-full transition-colors relative",
                            notificationSettings.emailEnabled ? "bg-blue-600" : "bg-slate-200"
                          )}
                        >
                          <span className={cn(
                            "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform",
                            notificationSettings.emailEnabled ? "translate-x-6" : "translate-x-0"
                          )} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Payment Methods (AnyRoller Rider Only) */}

      {/* Verification Center (Tradespeople only) */}
      {profile.role === "tradesperson" && (
        <div id="verification" className="bg-white rounded-[2rem] border border-black shadow-md bg-gradient-to-b from-white to-slate-50/50 overflow-hidden mb-3 break-inside-avoid">
          <button 
            onClick={() => setIsVerificationExpanded(!isVerificationExpanded)}
            className="w-full p-5 flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-4 text-left">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 leading-tight">Verification Center</h3>
                <p className="text-xs text-slate-500 font-medium">Manage your professional credentials</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className={cn(
                "text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-wider shadow-sm",
                profile.verificationStatus === "verified" ? "bg-green-100 text-green-700 border border-green-200" :
                profile.verificationStatus === "pending" ? "bg-amber-100 text-amber-700 border border-amber-200" : "bg-slate-100 text-slate-500 border border-black"
              )}>
                {profile.verificationStatus || "Unverified"}
              </span>
              <motion.div
                animate={{ rotate: isVerificationExpanded ? 180 : 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <ChevronDown className="w-6 h-6 text-slate-400" />
              </motion.div>
            </div>
          </button>

          <AnimatePresence>
            {isVerificationExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
              >
                <div className="p-5 pt-0 border-t border border-black">
                  {user?.isAnonymous && (
                    <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3 mt-6">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-amber-900">Guest Account</p>
                        <p className="text-xs text-amber-700 leading-relaxed">
                          You are currently using a guest account. While you can test the verification process, we recommend signing up to save your verified status permanently.
                        </p>
                      </div>
                    </div>
                  )}

                  {verificationError && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold flex items-center gap-2 mt-6">
                      <AlertCircle className="w-4 h-4" />
                      {verificationError}
                    </div>
                  )}

                  <div className="space-y-4 mt-6">
                    {/* Base Requirements for all trades */}
            {["Identity Verification (Passport/Driving License)", "Public Liability Insurance"].map((cert, idx) => {
              const existingDoc = profile.verificationDocs?.find((d: any) => d.type === cert);
              return (
                <div key={`base-${idx}`} className="p-4 rounded-2xl border border-blue-100 bg-blue-50/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-700">{cert}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Required for all platform tradespeople</p>
                      {existingDoc?.rejectionReason && (
                        <p className="text-[10px] text-red-600 font-medium italic mt-1">Rejected: {existingDoc.rejectionReason}</p>
                      )}
                      {existingDoc?.autoCheck && existingDoc.status !== "rejected" && (
                        <div className="mt-2 p-2 bg-white/50 rounded-lg border border-blue-100/50">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Zap className="w-3 h-3 text-blue-500" />
                            <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">Auto-Check Result</span>
                          </div>
                          <p className="text-[10px] text-slate-600 leading-tight">{existingDoc.autoCheck.message}</p>
                        </div>
                      )}
                      {existingDoc?.expiryDate && (
                        <p className={cn(
                          "text-[10px] font-bold mt-1",
                          new Date(existingDoc.expiryDate) < new Date() ? "text-red-600" : "text-slate-500"
                        )}>
                          Expires: {new Date(existingDoc.expiryDate).toLocaleDateString()}
                          {new Date(existingDoc.expiryDate) < new Date() && " (EXPIRED)"}
                        </p>
                      )}
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                      existingDoc?.status === "approved" ? "bg-green-100 text-green-700" :
                      existingDoc?.status === "rejected" ? "bg-red-100 text-red-700" :
                      existingDoc?.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-500"
                    )}>
                      {existingDoc?.status || "Required"}
                    </span>
                  </div>
                  
                  {(existingDoc?.status !== "approved" || (existingDoc?.expiryDate && new Date(existingDoc.expiryDate) < new Date())) && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Expiry Date</p>
                        <input 
                          type="date" 
                          className="w-full p-2 rounded-xl border border-black text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                          value={expiryDates[cert] || ""}
                          onChange={(e) => setExpiryDates(prev => ({ ...prev, [cert]: e.target.value }))}
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </div>

                      <div className="flex items-start gap-2 p-2 bg-slate-100/50 rounded-xl">
                        <input 
                          type="checkbox" 
                          id={`consent-base-${idx}`}
                          className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={privacyConsent[cert] || false}
                          onChange={(e) => setPrivacyConsent(prev => ({ ...prev, [cert]: e.target.checked }))}
                        />
                        <label htmlFor={`consent-base-${idx}`} className="text-[10px] text-slate-500 leading-tight">
                          I consent to the secure storage and processing of this document for verification purposes in accordance with UK GDPR.
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
                            "w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed text-xs font-bold transition-all cursor-pointer",
                            isUploading ? "bg-slate-50 border-black text-slate-400 cursor-wait" :
                            privacyConsent[cert] 
                              ? "border-slate-300 text-slate-500 hover:bg-white hover:border-blue-400 hover:text-blue-600" 
                              : "border-black text-slate-300 cursor-not-allowed bg-slate-50"
                          )}
                        >
                          {isUploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                          {isUploading ? "Uploading..." : existingDoc ? "Update Document" : "Upload Document"}
                          {user.isAnonymous && !isUploading && (
                            <span className="ml-auto text-[8px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full uppercase">Test Mode</span>
                          )}
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Trade-specific Requirements */}
            {TRADE_CATEGORIES
              .filter(t => profile.trades?.includes(t.name) && t.requiredCertifications)
              .flatMap(t => t.requiredCertifications || [])
              .map((cert, idx) => {
                const existingDoc = profile.verificationDocs?.find((d: any) => d.type === cert);
                return (
                  <div key={idx} className="p-4 rounded-2xl border border-black bg-slate-50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-700">{cert}</p>
                        {existingDoc?.rejectionReason && (
                          <p className="text-[10px] text-red-600 font-medium italic mt-1">Rejected: {existingDoc.rejectionReason}</p>
                        )}
                        {existingDoc?.autoCheck && existingDoc.status !== "rejected" && (
                          <div className="mt-2 p-2 bg-white/50 rounded-lg border border-blue-100/50">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <Zap className="w-3 h-3 text-blue-500" />
                              <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">Auto-Check Result</span>
                            </div>
                            <p className="text-[10px] text-slate-600 leading-tight">{existingDoc.autoCheck.message}</p>
                          </div>
                        )}
                        {existingDoc?.expiryDate && (
                          <p className={cn(
                            "text-[10px] font-bold mt-1",
                            new Date(existingDoc.expiryDate) < new Date() ? "text-red-600" : "text-slate-500"
                          )}>
                            Expires: {new Date(existingDoc.expiryDate).toLocaleDateString()}
                            {new Date(existingDoc.expiryDate) < new Date() && " (EXPIRED)"}
                          </p>
                        )}
                      </div>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                        existingDoc?.status === "approved" ? "bg-green-100 text-green-700" :
                        existingDoc?.status === "rejected" ? "bg-red-100 text-red-700" :
                        existingDoc?.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-500"
                      )}>
                        {existingDoc?.status || "Required"}
                      </span>
                    </div>
                    
                    {(existingDoc?.status !== "approved" || (existingDoc?.expiryDate && new Date(existingDoc.expiryDate) < new Date())) && (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Expiry Date</p>
                          <input 
                            type="date" 
                            className="w-full p-2 rounded-xl border border-black text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                            value={expiryDates[cert] || ""}
                            onChange={(e) => setExpiryDates(prev => ({ ...prev, [cert]: e.target.value }))}
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                        
                        <div className="flex items-start gap-2 p-2 bg-slate-100/50 rounded-xl">
                          <input 
                            type="checkbox" 
                            id={`consent-${cert}`}
                            className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            checked={privacyConsent[cert] || false}
                            onChange={(e) => setPrivacyConsent(prev => ({ ...prev, [cert]: e.target.checked }))}
                          />
                          <label htmlFor={`consent-${cert}`} className="text-[10px] text-slate-500 leading-tight">
                            I consent to the secure storage and processing of this document for verification purposes in accordance with UK GDPR.
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
                              "w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed text-xs font-bold transition-all cursor-pointer",
                              isUploading ? "bg-slate-50 border-black text-slate-400 cursor-wait" :
                              privacyConsent[cert] 
                                ? "border-slate-300 text-slate-500 hover:bg-white hover:border-blue-400 hover:text-blue-600" 
                                : "border-black text-slate-300 cursor-not-allowed bg-slate-50"
                            )}
                          >
                            {isUploading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4" />
                            )}
                            {isUploading ? "Uploading..." : existingDoc ? "Update Document" : "Upload Document"}
                            {user.isAnonymous && !isUploading && (
                              <span className="ml-auto text-[8px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full uppercase">Test Mode</span>
                            )}
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            
            {(!profile.trades || profile.trades.length === 0) && (
              <p className="text-sm text-slate-500 text-center py-4 italic">Select your trades to see verification requirements.</p>
            )}

            {/* Data Privacy Info */}
            <div className="mt-8 p-4 bg-slate-900 rounded-2xl text-white space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider">Data Security & Privacy</h4>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Your identity documents are encrypted at rest and in transit. Access is strictly limited to authorized verification staff. We comply with UK GDPR and the Data Protection Act 2018. Documents are retained only as long as necessary to maintain your verified status.
              </p>
              <div className="flex gap-4 pt-1">
                <button className="text-[10px] font-bold text-blue-400 hover:underline">Privacy Policy</button>
                <button className="text-[10px] font-bold text-blue-400 hover:underline">Data Rights Request</button>
              </div>
            </div>
          </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Recurring Services Section */}
      <div className="bg-white rounded-[2rem] border border-black shadow-md bg-gradient-to-b from-white to-slate-50/50 overflow-hidden p-6 mb-3 break-inside-avoid">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Recurring Services</h3>
            <p className="text-xs text-slate-500">Manage your scheduled regular jobs</p>
          </div>
        </div>

        {loadingRecurring ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        ) : recurringSchedules.length > 0 ? (
          <div className="space-y-4">
            {recurringSchedules.map((schedule) => {
              const otherPartyId = profile?.role === "homeowner" ? schedule.tradespersonId : schedule.homeownerId;
              const isProposer = schedule.proposedBy === user?.uid;
              const needsApproval = schedule.status === "pending_approval" && !isProposer;

              return (
                <div key={schedule.id} className="p-4 rounded-2xl border border-black bg-slate-50/50 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{schedule.title}</h4>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                        {schedule.frequency} • £{schedule.amount}/visit
                      </p>
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                      schedule.status === "active" ? "bg-green-100 text-green-700" :
                      schedule.status === "pending_approval" ? "bg-amber-100 text-amber-700" :
                      schedule.status === "paused" ? "bg-slate-200 text-slate-600" : "bg-red-100 text-red-700"
                    )}>
                      {schedule.status.replace("_", " ")}
                    </span>
                  </div>

                  {needsApproval ? (
                    <div className="flex gap-2 pt-1">
                      <button 
                        onClick={() => handleUpdateRecurringStatus(schedule.id, "active", otherPartyId, schedule.title)}
                        className="flex-1 bg-green-600 text-white py-2 rounded-xl text-xs font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Accept
                      </button>
                      <button 
                        onClick={() => handleUpdateRecurringStatus(schedule.id, "cancelled", otherPartyId, schedule.title)}
                        className="flex-1 bg-white border border-red-200 text-red-600 py-2 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-1"
                      >
                        <XCircle className="w-3 h-3" />
                        Decline
                      </button>
                    </div>
                  ) : schedule.status === "active" ? (
                    <div className="flex gap-2 pt-1">
                      <button 
                        onClick={() => handleUpdateRecurringStatus(schedule.id, "paused", otherPartyId, schedule.title)}
                        className="flex-1 bg-white border border-black text-slate-600 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-1"
                      >
                        <Pause className="w-3 h-3" />
                        Pause
                      </button>
                      <button 
                        onClick={() => handleUpdateRecurringStatus(schedule.id, "cancelled", otherPartyId, schedule.title)}
                        className="flex-1 bg-white border border-red-100 text-red-500 py-2 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Cancel
                      </button>
                    </div>
                  ) : schedule.status === "paused" ? (
                    <button 
                      onClick={() => handleUpdateRecurringStatus(schedule.id, "active", otherPartyId, schedule.title)}
                      className="w-full bg-indigo-600 text-white py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1"
                    >
                      <Play className="w-3 h-3" />
                      Resume Service
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-black">
            <RefreshCw className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No recurring services scheduled yet.</p>
            <p className="text-[10px] text-slate-400 mt-1">Complete a job in a recurring category to see suggestions.</p>
          </div>
        )}
      </div>
      </div> {/* End masonry wrapper */}

      {/* Sign Out Button */}
      <button 
        onClick={handleLogout}
        className="w-full bg-red-50 text-red-600 p-5 rounded-[2rem] border border-black font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-all mb-8"
      >
        <LogOut className="w-5 h-5" />
        Sign Out
      </button>

      <TradeBot isOpen={isTradeBotOpen} onClose={() => setIsTradeBotOpen(false)} />

      {/* Tradesperson specific sections - Reviews */}
      {profile.role === "tradesperson" && (
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
              {reviews.map((review) => (
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
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Bio</label>
                  <textarea 
                    className="w-full p-3 rounded-xl border border-black focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all resize-none"
                    rows={3}
                    value={editData.bio}
                    onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                  />
                </div>
                {profile.role === "tradesperson" && (
                  <>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Trades (comma separated)</label>
                      <input 
                        type="text"
                        className="w-full p-3 rounded-xl border border-black focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all"
                        value={editData.trades}
                        onChange={(e) => setEditData({ ...editData, trades: e.target.value })}
                        placeholder="Plumbing, Electrical, etc."
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Tags (comma separated)</label>
                      <input 
                        type="text"
                        className="w-full p-3 rounded-xl border border-black focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all"
                        value={editData.tags}
                        onChange={(e) => setEditData({ ...editData, tags: e.target.value })}
                        placeholder="Reliable, Fast, Expert, etc."
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
                <label className="flex items-center justify-between p-3 border border-slate-300 rounded-xl mb-4 hover:bg-slate-50 cursor-pointer transition-colors">
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
                  <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block uppercase tracking-wide">Call-Out Fee (£)</label>
                      <input 
                        type="number"
                        className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all text-sm font-bold"
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
                        className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all text-sm font-bold"
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
                        className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all text-sm resize-y"
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

              <div className="p-5 pt-4 flex gap-3 shrink-0 border-t border border-slate-100 bg-white">
                <button 
                  onClick={() => setIsEditingIM(false)}
                  className="flex-1 p-4 rounded-2xl font-bold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors"
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
    </div>
  );
}

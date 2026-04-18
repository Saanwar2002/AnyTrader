import { TradeBot } from "./TradeBot";
import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { logout, db, doc, updateDoc, handleFirestoreError, OperationType, storage, ref, uploadBytes, getDownloadURL, collection, query, where, or, and, orderBy, getDocs, onSnapshot, sendNotification } from "@/src/firebase";
import { 
  LogOut, User, Mail, MapPin, Calendar, Shield, Edit2, Check, X, Loader2, Download, FileCheck, Upload, Clock, Star, Image as ImageIcon, Trash2, Briefcase, ChevronRight, Plus,
  Bell, Layout, Home, CreditCard, Bot, BarChart3, Search, History, Zap, HelpCircle, FileText, Pencil, Camera, GripVertical, Info, BookOpen, AlertCircle, Users, ChevronDown,
  ShieldCheck, CheckCircle, CheckCircle2, Heart, Moon, Award, RefreshCw, Pause, Play, XCircle, Sparkles
} from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { usePWAInstall } from "@/src/hooks/usePWAInstall";
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
        "group relative aspect-square rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-slate-50 cursor-grab active:cursor-grabbing",
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
        <div className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
          <GripVertical className="w-4 h-4 text-slate-400" />
        </div>
      </div>
      
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
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
      isExpanded ? "p-8" : "p-5"
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
  const navigate = useNavigate();
  const location = useLocation();
  const { isInstallable, installApp } = usePWAInstall();
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingNotifications, setIsEditingNotifications] = useState(false);
  const [showBioInfo, setShowBioInfo] = useState(false);
  const [showBadgeInfo, setShowBadgeInfo] = useState(false);
  const [showUserGuide, setShowUserGuide] = useState(false);
  const [isTradeBotOpen, setIsTradeBotOpen] = useState(false);
  const [isAchievementsExpanded, setIsAchievementsExpanded] = useState(false);
  const [isVerificationExpanded, setIsVerificationExpanded] = useState(false);
  const [isNotificationsExpanded, setIsNotificationsExpanded] = useState(false);
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
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [platformConfig, setPlatformConfig] = useState<any>(null);
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
    if (isEditing && profile) {
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
        searchFeedBadges: profile.searchFeedBadges || []
      });
    }
  }, [isEditing, profile]);

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
    return () => unsubConfig();
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

  const menuGroups = profile.role === "tradesperson" ? tradespersonMenuGroups : homeownerMenuGroups;

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

        await updateDoc(doc(db, "users", user.uid), { 
          tierId: showCheckoutForTier.name,
          subscriptionStatus: 'trialing',
          currentPeriodEnd: nextBillingDate.toISOString(),
          cancelAtPeriodEnd: false
        });
        
        setProfile((prev: any) => ({ 
          ...prev, 
          tierId: showCheckoutForTier.name,
          subscriptionStatus: 'trialing',
          currentPeriodEnd: nextBillingDate.toISOString(),
          cancelAtPeriodEnd: false
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
    
    try {
      await updateDoc(doc(db, "users", user.uid), { 
        cancelAtPeriodEnd: true
      });
      setProfile((prev: any) => ({ ...prev, cancelAtPeriodEnd: true }));
    } catch (err) {
      console.error("Error canceling subscription:", err);
    }
  };

  return (
    <div id="account" className="max-w-2xl mx-auto pb-24 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Profile</h1>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Referral Program */}
      {profile.role === "tradesperson" && (
        <div className="mb-8">
          <ReferralCard profile={profile} />
        </div>
      )}

      {/* Subscription Plan Card */}
      {(profile.role === "tradesperson" || (profile.role === "homeowner" && profile.subscriptionType === "business")) && platformConfig && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 mb-8">
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
              {profile.tierId || (profile.role === "homeowner" ? "Standard Homeowner" : "Free Explorer")}
              {profile.subscriptionStatus === 'active' && !profile.cancelAtPeriodEnd && (
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" title="Active Subscription" />
              )}
            </div>
          </div>

          {profile.subscriptionStatus === 'active' && profile.currentPeriodEnd && (
            <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-blue-900">Next Billing Date</p>
                <p className="text-[10px] text-blue-700">
                  {new Date(profile.currentPeriodEnd).toLocaleDateString()}
                  {profile.cancelAtPeriodEnd && " (Cancels at end of period)"}
                </p>
              </div>
              {!profile.cancelAtPeriodEnd && (
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
            {(profile.role === "homeowner" ? (platformConfig.businessTiers || []) : (platformConfig.feeTiers || [])).map((tier: any) => (
              <button
                key={tier.name}
                onClick={() => {
                  if (profile.tierId === tier.name) return;
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
                  profile.tierId === tier.name ? "border-blue-600 bg-blue-50 ring-2 ring-blue-600/10" : "border-slate-100 hover:border-slate-200 bg-white"
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
                
                {profile.role === "tradesperson" && profile.tierId === tier.name && (
                  <div className="space-y-3 pt-4 border-t border-slate-100">
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

                {profile.tierId === tier.name && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 mb-8 relative">
        <div className="flex flex-col items-center">
          <div className="relative mb-4">
            <div className="w-28 h-28 rounded-full bg-slate-900 flex items-center justify-center text-white text-4xl font-bold overflow-hidden border-4 border-white shadow-lg relative">
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
            <label className="absolute bottom-0 right-0 w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors border border-slate-100">
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
              <div className="flex flex-col items-center gap-3 mb-8">
                <div className="flex items-stretch gap-3 bg-white p-2 rounded-[1.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 w-full max-w-sm">
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
                  <p className="text-slate-500 text-sm">{profile.email}</p>
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
              className="absolute top-8 right-8 p-2 rounded-full bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
            >
              <Pencil className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Badges & Achievements Section */}
        {profile.role === "tradesperson" && (
          <div className="mt-8 border-t border-slate-100 pt-8">
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
                <div className="col-span-full py-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-400 font-medium italic">Complete more jobs to earn badges!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Phase 1: Performance Stats */}
        {profile.role === "tradesperson" && (
          <div className="grid grid-cols-3 gap-4 mt-8 border-t border-slate-100 pt-8">
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
      </div>

      {/* Phase 1: Certifications/Achievements */}
      {profile.role === "tradesperson" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 mb-8">
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
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 mb-8 relative">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
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
              <div className="flex gap-2">
                <button 
                  onClick={handleSaveServices}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-all text-[11px] font-black uppercase tracking-wider shadow-sm disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Save
                </button>
                <button 
                  onClick={cancelEditingServices}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all text-[11px] font-black uppercase tracking-wider border border-slate-200"
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
                  <div key={index} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all">
                    <div className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                    <span className="text-sm font-bold text-slate-700 leading-relaxed">{service}</span>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-sm text-slate-400 italic mb-4">No services added yet. Add your services to attract more homeowners.</p>
                  <button 
                    onClick={startEditingServices}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
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
                  className="flex-1 p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-sm"
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
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm font-bold text-sm flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {tempServices.map((service: string, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
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
                  <div className="col-span-full text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
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
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 mb-8">
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

            <div className="mt-6 pt-6 border-t border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-slate-900">Professional Badges</h4>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1 text-blue-600 text-xs font-bold hover:underline"
                >
                  <Pencil className="w-3 h-3" />
                  Edit prof badges
                </button>
              </div>
              {(!profile.badges || profile.badges.length === 0) ? (
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
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
                      slate: "bg-slate-50 text-slate-700 border-slate-100",
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
          </>
        )}
      </div>

      {/* Portfolio Section (Tradespeople only) */}
      {profile.role === "tradesperson" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 mb-8">
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
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                <ImageIcon className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-slate-500 text-sm font-medium">No portfolio images yet.</p>
              <p className="text-slate-400 text-xs mt-1">Upload photos of your past work to build trust.</p>
            </div>
          )}
        </div>
      )}

      {/* Phase 3: Grouped Menu List */}
      <div className="space-y-6 mb-8">
        {menuGroups.map((group) => (
          <div key={group.title} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider p-5 pb-2">{group.title}</h3>
            <div className="divide-y divide-slate-100">
              {group.items.map((item, index) => (
                item.path === "#tradebot" ? (
                  <button
                    key={index}
                    onClick={() => setIsTradeBotOpen(true)}
                    className="w-full flex items-center gap-4 p-5 hover:bg-slate-50 transition-colors group text-left"
                  >
                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <span className="flex-1 font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
                      {item.label}
                    </span>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-colors" />
                  </button>
                ) : item.path === "#userguide" ? (
                  <button
                    key={index}
                    onClick={() => setShowUserGuide(true)}
                    className="w-full flex items-center gap-4 p-5 hover:bg-slate-50 transition-colors group text-left"
                  >
                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <span className="flex-1 font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
                      {item.label}
                    </span>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-colors" />
                  </button>
                ) : (
                  <Link 
                    key={index}
                    to={item.path}
                    className="flex items-center gap-4 p-5 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <span className="flex-1 font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
                      {item.label}
                    </span>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-colors" />
                  </Link>
                )
              ))}
            </div>
          </div>
        ))}
      </div>

        {/* Notification Settings Section */}
        {profile.role === "tradesperson" && (
          <div id="notifications" className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mb-6">
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
                              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-lg font-black text-slate-900 appearance-none focus:outline-none focus:ring-4 focus:ring-blue-600/10 transition-all text-center cursor-pointer"
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
                              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-lg font-black text-slate-900 appearance-none focus:outline-none focus:ring-4 focus:ring-blue-600/10 transition-all text-center cursor-pointer"
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

        {/* Payment Methods Placeholder */}
        <div id="payments" className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mb-6">
          <div className="p-6 border-b border-slate-50">
            <h2 className="text-lg font-bold text-slate-900">Payment Methods</h2>
            <p className="text-sm text-slate-500">Manage your payout methods and billing information.</p>
          </div>
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">Payment settings coming soon.</p>
          </div>
        </div>

        {/* Privacy & Security Placeholder */}
        <div id="privacy" className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mb-6">
          <div className="p-6 border-b border-slate-50">
            <h2 className="text-lg font-bold text-slate-900">Privacy & Security</h2>
            <p className="text-sm text-slate-500">Manage your account security and data privacy.</p>
          </div>
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">Security settings coming soon.</p>
          </div>
        </div>

      {/* Verification Center (Tradespeople only) */}
      {profile.role === "tradesperson" && (
        <div id="verification" className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-8">
          <button 
            onClick={() => setIsVerificationExpanded(!isVerificationExpanded)}
            className="w-full p-8 flex items-center justify-between hover:bg-slate-50 transition-colors"
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
                profile.verificationStatus === "pending" ? "bg-amber-100 text-amber-700 border border-amber-200" : "bg-slate-100 text-slate-500 border border-slate-200"
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
                <div className="p-8 pt-0 border-t border-slate-100">
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
                          className="w-full p-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
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
                            isUploading ? "bg-slate-50 border-slate-200 text-slate-400 cursor-wait" :
                            privacyConsent[cert] 
                              ? "border-slate-300 text-slate-500 hover:bg-white hover:border-blue-400 hover:text-blue-600" 
                              : "border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50"
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
                  <div key={idx} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 space-y-3">
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
                            className="w-full p-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
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
                              isUploading ? "bg-slate-50 border-slate-200 text-slate-400 cursor-wait" :
                              privacyConsent[cert] 
                                ? "border-slate-300 text-slate-500 hover:bg-white hover:border-blue-400 hover:text-blue-600" 
                                : "border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50"
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
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mb-8">
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
                <div key={schedule.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-3">
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
                        className="flex-1 bg-white border border-slate-200 text-slate-600 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-1"
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
          <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <RefreshCw className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No recurring services scheduled yet.</p>
            <p className="text-[10px] text-slate-400 mt-1">Complete a job in a recurring category to see suggestions.</p>
          </div>
        )}
      </div>

      {/* Sign Out Button */}
      <button 
        onClick={handleLogout}
        className="w-full bg-red-50 text-red-600 p-5 rounded-3xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-all mb-8"
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
                <div key={review.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
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
            <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center">
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
              className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-8 pb-4 flex items-center justify-between shrink-0 border-b border-slate-50">
                <h3 className="text-xl font-bold text-slate-900">Edit Profile</h3>
                <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Full Name</label>
                  <input 
                    type="text"
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all"
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Postcode</label>
                  <input 
                    type="text"
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all uppercase"
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
                  <div className="mt-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs text-slate-600 font-medium">
                      {editData.city}{editData.county ? `, ${editData.county}` : ""}
                    </span>
                  </div>
                )}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Bio</label>
                  <textarea 
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all resize-none"
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
                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all"
                        value={editData.trades}
                        onChange={(e) => setEditData({ ...editData, trades: e.target.value })}
                        placeholder="Plumbing, Electrical, etc."
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Tags (comma separated)</label>
                      <input 
                        type="text"
                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all"
                        value={editData.tags}
                        onChange={(e) => setEditData({ ...editData, tags: e.target.value })}
                        placeholder="Reliable, Fast, Expert, etc."
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-3">
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
                              showBadgeInfo ? "opacity-100 visible" : "opacity-0 invisible group-hover:opacity-100 group-hover:visible"
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
                      <div className="grid grid-cols-1 gap-3">
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
                                  : "bg-white border-slate-100"
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

              <div className="p-8 pt-4 flex gap-3 shrink-0 border-t border-slate-100 bg-slate-50/50">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="flex-1 p-4 rounded-2xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
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
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl"
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
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl max-h-[80vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between mb-6 sticky top-0 bg-white pt-2 pb-4 border-b border-slate-100 z-10">
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
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100"
            >
              <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
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
              
              <div className="p-8 space-y-6">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
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
                        className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all font-mono text-sm"
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
                        className="w-full p-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all font-mono text-sm"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value.replace(/\D/g, '').replace(/(.{2})/g, '$1 / ').trim().slice(0, 7))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CVC</label>
                      <input 
                        type="text"
                        placeholder="123"
                        className="w-full p-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all font-mono text-sm"
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

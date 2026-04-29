import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { db, collection, query, onSnapshot, doc, updateDoc, deleteDoc, setDoc, serverTimestamp, orderBy, limit, sendNotification, getDoc, addDoc, getDocs, handleFirestoreError as handleGlobalFirestoreError, OperationType } from "@/src/firebase";
import { useAuth } from "./AuthProvider";
import { useCategories } from "../lib/CategoryProvider";
import { TRADE_CATEGORIES } from "@/src/constants";
import { motion, AnimatePresence } from "motion/react";
import { assignFoundingId } from "../services/memberIdService";
import { 
  Users, Briefcase, AlertTriangle, Shield, Search, Filter, 
  CheckCircle2, XCircle, MoreVertical, Trash2, Eye, 
  TrendingUp, Activity, FileText, ChevronRight, ChevronUp, ChevronDown, Loader2,
  UserCheck, UserX, MessageSquare, Star, UserPlus, Mail,
  Lock, Unlock, CheckSquare, Square, X, Megaphone, Send, Tag, Tags, Gift,
  Settings, Settings2, BarChart3, PieChart, DollarSign, Percent, Clock, MapPin, CreditCard,
  AlertCircle, Zap, Sparkles, ShieldAlert, ShieldCheck, RefreshCw, Medal,
  Plus, Edit2, Calendar, Award, Info, Key, Building2, Globe, Database, Download,
  Command, ChevronRightSquare, MousePointer2, Ghost, ArrowRight, ShoppingBag, Car
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import AdminTierManager from "./AdminTierManager";
import GuestJobs from "./GuestJobs";
import {  
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  Cell, PieChart as RePieChart, Pie
} from "recharts";

import { performInitialPublicRecordCheck } from "../services/verificationService";
import { getPlatformHealthInsights, PlatformHealthInsights, generateBroadcastDraft, summarizeDisputeChat, analyzeFraudRisk, RiskAlert, analyzeDocument, suggestNewCategories, CategorySuggestion, getAiModelRecommendations, AiModelRecommendation } from "../services/gemini";

export default function AnyTraderAdmin() {
  const { user, profile } = useAuth();
  const { categories } = useCategories();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const tabFromUrl = searchParams.get("tab") as any;
  const initialTab = ["users", "jobs", "disputes", "logs", "team", "broadcast", "analytics", "settings", "verifications", "insights", "risk", "trends", "categories", "monetization"].includes(tabFromUrl) ? tabFromUrl : "users";
  
  const [activeTab, setActiveTab] = useState<"users" | "jobs" | "disputes" | "logs" | "team" | "broadcast" | "analytics" | "settings" | "verifications" | "insights" | "risk" | "trends" | "categories" | "security" | "guest_jobs" | "monetization">(initialTab as any);
  
  useEffect(() => {
    const validTab = ["users", "jobs", "disputes", "logs", "team", "broadcast", "analytics", "settings", "verifications", "insights", "risk", "trends", "categories", "security", "guest_jobs", "monetization"].includes(tabFromUrl) ? tabFromUrl : "users";
    if (validTab !== activeTab) {
      setActiveTab(validTab);
      setFilter(validTab === "jobs" ? "emergency" : "all");
    }
  }, [tabFromUrl]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as any);
    setSearchParams({ tab });
    setIsUsersExpanded(false);
    setIsJobsExpanded(false);
    setSelectedUserIds([]);
    setFilter(tab === "jobs" ? "emergency" : "all");
  };

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [searchLogs, setSearchLogs] = useState<any[]>([]);
  const [platformConfig, setPlatformConfig] = useState<any>(null);
  const [aiRecommendations, setAiRecommendations] = useState<AiModelRecommendation[]>([]);
  const [isGeneratingAiRecs, setIsGeneratingAiRecs] = useState(false);
  const [showAiRecsModal, setShowAiRecsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState(initialTab === "jobs" ? "emergency" : "all");
  const [isUsersExpanded, setIsUsersExpanded] = useState(false);
  const [isJobsExpanded, setIsJobsExpanded] = useState(false);
  const [isDisputesExpanded, setIsDisputesExpanded] = useState(false);
  const [isLogsExpanded, setIsLogsExpanded] = useState(false);
  const [isSubscribersExpanded, setIsSubscribersExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showGuestDeleteModal, setShowGuestDeleteModal] = useState(false);
  const [showFlushLogsModal, setShowFlushLogsModal] = useState(false);

  // Settings State
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [tempConfig, setTempConfig] = useState<any>(null);
  const [showMaintenanceConfirm, setShowMaintenanceConfirm] = useState(false);
  const [editingTiers, setEditingTiers] = useState<number[]>([]);
  const [deleteTierConfirm, setDeleteTierConfirm] = useState<number | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showPaywallConfirm, setShowPaywallConfirm] = useState(false);

  // Broadcast Form State
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastContent, setBroadcastContent] = useState("");
  const [broadcastType, setBroadcastType] = useState<"announcement" | "offer" | "greeting" | "update">("announcement");
  const [broadcastSegments, setBroadcastSegments] = useState<string[]>(["homeowners", "tradespeople"]);
  const [broadcastTrades, setBroadcastTrades] = useState<string[]>([]);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isDraftingBroadcast, setIsDraftingBroadcast] = useState(false);

  // Invitation Form State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePermissions, setInvitePermissions] = useState<string[]>([]);
  const [isInviting, setIsInviting] = useState(false);
  const [newPostcode, setNewPostcode] = useState("");

  // AI Insights State
  const [platformInsights, setPlatformInsights] = useState<PlatformHealthInsights | null>(null);
  const [isFetchingInsights, setIsFetchingInsights] = useState(false);

  // AI Dispute Summarizer State
  const [disputeSummaries, setDisputeSummaries] = useState<Record<string, { summary: string; timeline: string[]; faultAnalysis: string }>>({});
  const [isSummarizingDispute, setIsSummarizingDispute] = useState<Record<string, boolean>>({});

  // AI Fraud & Risk Monitor State
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<any[]>([]);
  const [isAnalyzingRisk, setIsAnalyzingRisk] = useState(false);
  const [lastRiskAnalysis, setLastRiskAnalysis] = useState<Date | null>(null);

  // AI Smart KYC State
  const [isAnalyzingDoc, setIsAnalyzingDoc] = useState<Record<string, boolean>>({});

  // AI Category Trends State
  const [categorySuggestions, setCategorySuggestions] = useState<CategorySuggestion[]>([]);
  const [isGeneratingCategories, setIsGeneratingCategories] = useState(false);
  const [lastCategoryAnalysis, setLastCategoryAnalysis] = useState<Date | null>(null);

  // API Key Management State
  const [platformSecrets, setPlatformSecrets] = useState<any>(null);
  const [isSavingSecrets, setIsSavingSecrets] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [editingKey, setEditingKey] = useState<{ id: string, label: string, value: string } | null>(null);

  // Category Management State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [catName, setCatName] = useState("");
  const [catIcon, setCatIcon] = useState("");
  const [catSubcategories, setCatSubcategories] = useState<string[]>([]);
  const [newSubcategory, setNewSubcategory] = useState("");
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, name: string } | null>(null);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [deleteSubcategoryConfirm, setDeleteSubcategoryConfirm] = useState<number | null>(null);
  const [syncConfirmText, setSyncConfirmText] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  // Feature Search Logic
  const [featureSearchTerm, setFeatureSearchTerm] = useState("");

  // Export State
  const [exportRole, setExportRole] = useState("homeowner");
  const [exportCategory, setExportCategory] = useState("Plumbing");

  const ADMIN_FEATURES = [
    { title: "User Management", tab: "users", keywords: ["people", "homeowner", "trader", "delete", "suspend"], icon: <Users className="w-4 h-4" /> },
    { title: "Job Oversight", tab: "jobs", keywords: ["projects", "status", "cancel", "refund"], icon: <Briefcase className="w-4 h-4" /> },
    { title: "Dispute Mediation", tab: "disputes", keywords: ["trouble", "argument", "refund", "court"], icon: <AlertTriangle className="w-4 h-4" /> },
    { title: "Administrative Staff", tab: "team", keywords: ["admin", "invites", "permissions", "team"], icon: <Shield className="w-4 h-4" /> },
    { title: "Verification & KYC", tab: "verifications", keywords: ["docs", "id check", "license", "approve"], icon: <CheckCircle2 className="w-4 h-4" /> },
    { title: "Platform Broadcasts", tab: "broadcast", keywords: ["push", "email", "notify all", "marketing"], icon: <Megaphone className="w-4 h-4" /> },
    { title: "System Configuration", tab: "settings", keywords: ["configs", "setup", "toggle", "maintenance"], icon: <Settings className="w-4 h-4" /> },
    { title: "Category Management", tab: "categories", keywords: ["trades", "specialties", "tags"], icon: <Tags className="w-4 h-4" /> },
    { title: "Audit & Logs", tab: "logs", keywords: ["history", "actions", "security", "who did what"], icon: <FileText className="w-4 h-4" /> },
    { title: "Security & API Keys", tab: "security", keywords: ["gemini", "stripe", "secrets", "env"], icon: <Key className="w-4 h-4" /> },
    { title: "Growth Stats", tab: "analytics", keywords: ["data", "report", "revenue", "charts"], icon: <BarChart3 className="w-4 h-4" /> },
    { title: "Monetization Mode", tab: "settings", elementId: "monetization-control", keywords: ["paywall", "beta", "free", "charging"], icon: <DollarSign className="w-4 h-4" /> },
    { title: "Maintenance Mode", tab: "settings", elementId: "maintenance-control", keywords: ["offline", "killswitch", "update"], icon: <Lock className="w-4 h-4" /> },
    { title: "Scheduled Maintenance", tab: "settings", elementId: "scheduled-maintenance", keywords: ["banner", "warning", "timer"], icon: <Calendar className="w-4 h-4" /> },
    { title: "Subscription Tiers", tab: "settings", elementId: "fee-tiers", keywords: ["pricing", "fees", "silver", "gold"], icon: <CreditCard className="w-4 h-4" /> },
    { title: "Trust & Fairness Engine", tab: "settings", elementId: "fairness-engine", keywords: ["complainer", "newcomer", "boost"], icon: <ShieldCheck className="w-4 h-4" /> },
    { title: "Export All Users", tab: "settings", elementId: "quick-actions", keywords: ["csv", "download", "backup"], icon: <FileText className="w-4 h-4" /> },
    { title: "Flush Audit Logs", tab: "settings", elementId: "quick-actions", keywords: ["delete logs", "purge", "clear history"], icon: <Trash2 className="w-4 h-4" /> },
    { title: "Platform Health (AI)", tab: "insights", keywords: ["gemini", "smart", "advice"], icon: <Sparkles className="w-4 h-4" /> },
    { title: "Risk Monitor (AI)", tab: "risk", keywords: ["fraud", "suspicious", "safety"], icon: <ShieldAlert className="w-4 h-4" /> },
    { title: "Guest Job Control", tab: "guest_jobs", keywords: ["unregistered", "anonymous"], icon: <Ghost className="w-4 h-4" /> },
  ];

  const filteredFeatures = featureSearchTerm.trim() === "" 
    ? [] 
    : ADMIN_FEATURES.filter(f => 
        f.title.toLowerCase().includes(featureSearchTerm.toLowerCase()) || 
        f.keywords.some(k => k.toLowerCase().includes(featureSearchTerm.toLowerCase()))
      ).slice(0, 5);

  const navigateToFeature = (feature: any) => {
    handleTabChange(feature.tab);
    setFeatureSearchTerm("");
    
    if (feature.elementId) {
      setTimeout(() => {
        document.getElementById(feature.elementId)?.scrollIntoView({ behavior: 'smooth' });
        // Flash effect
        const el = document.getElementById(feature.elementId);
        if (el) {
          el.classList.add('ring-4', 'ring-blue-500', 'ring-offset-4');
          setTimeout(() => el.classList.remove('ring-4', 'ring-blue-500', 'ring-offset-4'), 2000);
        }
      }, 300);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('admin-global-search')?.focus();
      }
      if (e.key === 'Escape') {
        setFeatureSearchTerm("");
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const PERMISSIONS = [
    { id: "manage_users", label: "Manage Users", description: "Verify tradespeople and delete accounts" },
    { id: "manage_jobs", label: "Manage Jobs", description: "Edit job details and statuses" },
    { id: "manage_disputes", label: "Manage Disputes", description: "Mediate and resolve job disputes" },
    { id: "view_logs", label: "View Audit Logs", description: "Access platform activity history" },
    { id: "manage_team", label: "Manage Team", description: "Invite and manage other staff members" }
  ];

  useEffect(() => {
    if (profile?.role !== "admin") return;

    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleGlobalFirestoreError(error, OperationType.GET, "users"));

    const unsubJobs = onSnapshot(collection(db, "jobs"), (snapshot) => {
      setJobs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleGlobalFirestoreError(error, OperationType.GET, "jobs"));

    const unsubLogs = onSnapshot(
      query(collection(db, "audit_logs"), orderBy("createdAt", "desc"), limit(50)), 
      (snapshot) => {
        setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (error) => handleGlobalFirestoreError(error, OperationType.GET, "audit_logs")
    );

    const unsubInvites = onSnapshot(collection(db, "invitations"), (snapshot) => {
      setInvitations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleGlobalFirestoreError(error, OperationType.GET, "invitations"));

    const unsubBroadcasts = onSnapshot(
      query(collection(db, "broadcasts"), orderBy("createdAt", "desc"), limit(20)), 
      (snapshot) => {
        setBroadcasts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (error) => handleGlobalFirestoreError(error, OperationType.GET, "broadcasts")
    );

    const unsubReviews = onSnapshot(collection(db, "reviews"), (snapshot) => {
      setReviews(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleGlobalFirestoreError(error, OperationType.GET, "reviews"));

    const unsubSearchLogs = onSnapshot(collection(db, "search_logs"), (snapshot) => {
      setSearchLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleGlobalFirestoreError(error, OperationType.GET, "search_logs"));

    const unsubSecurityAlerts = onSnapshot(
      collection(db, "security_alerts"),
      (snapshot) => {
        setSecurityAlerts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (error) => handleGlobalFirestoreError(error, OperationType.GET, "security_alerts")
    );

    const unsubSecrets = onSnapshot(doc(db, "platform_config", "secrets"), (doc) => {
      if (doc.exists()) {
        setPlatformSecrets(doc.data());
      } else {
        setPlatformSecrets({});
      }
    }, (error) => handleGlobalFirestoreError(error, OperationType.GET, "platform_config/secrets"));

    const unsubConfig = onSnapshot(doc(db, "platform_config", "global"), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setPlatformConfig(data);
        setTempConfig(data);
      } else {
        // Initialize default config if it doesn't exist
        const defaultConfig = {
          maintenanceMode: false,
          paywallEnabled: true,
          scheduledMaintenance: {
            enabled: false,
            time: "",
            message: "Scheduled maintenance will occur on [Date] at [Time]. The platform will be temporarily offline."
          },
          feeTiers: [
            { name: "Free Explorer", price: 0, maxQuotes: 5, maxAcceptedQuotes: 2, limitPeriod: "monthly", description: "Start risk-free and test the platform", includesRecommendation: false },
            { name: "Silver Professional", price: 45, maxQuotes: 30, maxAcceptedQuotes: 10, limitPeriod: "monthly", description: "Perfect for active tradespeople", includesRecommendation: false },
            { name: "Gold Elite", price: 95, maxQuotes: 9999, maxAcceptedQuotes: 9999, limitPeriod: "monthly", description: "For top professionals with priority alerts", includesRecommendation: true },
            { name: "Platinum Enterprise", price: 245, maxQuotes: 9999, maxAcceptedQuotes: 9999, limitPeriod: "monthly", description: "Multi-seat management for teams", includesRecommendation: true }
          ],
          businessTiers: [
            { name: "Standard Homeowner", price: 0, jobPostsLimit: 9999, limitPeriod: "lifetime", description: "Free for individual homeowners" },
            { name: "Premium Landlord", price: 19, jobPostsLimit: 50, limitPeriod: "monthly", description: "Asset tracking and priority support" },
            { name: "Business Professional", price: 125, jobPostsLimit: 200, limitPeriod: "monthly", description: "For active management firms & teams" },
            { name: "Enterprise Powerhouse", price: 595, jobPostsLimit: 9999, limitPeriod: "monthly", description: "Unlimited scale for large enterprises" }
          ]
        };
        setPlatformConfig(defaultConfig);
        setTempConfig(defaultConfig);
      }
    }, (error) => handleGlobalFirestoreError(error, OperationType.GET, "platform_config/global"));

    setLoading(false);

    return () => {
      unsubUsers();
      unsubJobs();
      unsubLogs();
      unsubInvites();
      unsubBroadcasts();
      unsubReviews();
      unsubSearchLogs();
      unsubSecurityAlerts();
      unsubSecrets();
      unsubConfig();
    };
  }, [profile]);

  useEffect(() => {
    if (activeTab === "insights" && !platformInsights && !isFetchingInsights && users.length > 0) {
      fetchInsights();
    }
  }, [activeTab, users.length]);

  const fetchInsights = async () => {
    setIsFetchingInsights(true);
    try {
      const disputesCount = jobs.filter(j => j.status === "disputed").length;
      const insights = await getPlatformHealthInsights(
        users.length,
        jobs.length,
        disputesCount,
        logs
      );
      setPlatformInsights(insights);
    } catch (err) {
      console.error("Error fetching AI insights:", err);
    } finally {
      setIsFetchingInsights(false);
    }
  };

  const handleApproveDoc = async (userId: string, docType: string) => {
    try {
      const userRef = doc(db, "users", userId);
      const userDoc = users.find(u => u.id === userId);
      if (!userDoc) return;

      const updatedDocs = userDoc.verificationDocs.map((d: any) => 
        d.type === docType ? { ...d, status: "approved" } : d
      );

      const allApproved = updatedDocs.every((d: any) => d.status === "approved");

      await updateDoc(userRef, {
        verificationDocs: updatedDocs,
        verificationStatus: allApproved ? "verified" : "pending"
      });

      await createAuditLog("approve_document", userId, "user", `Approved ${docType} for ${userDoc.name}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectDoc = async (userId: string, docType: string, reason: string) => {
    try {
      const userRef = doc(db, "users", userId);
      const userDoc = users.find(u => u.id === userId);
      if (!userDoc) return;

      const updatedDocs = userDoc.verificationDocs.map((d: any) => 
        d.type === docType ? { ...d, status: "rejected", rejectionReason: reason } : d
      );

      await updateDoc(userRef, {
        verificationDocs: updatedDocs,
        verificationStatus: "rejected"
      });

      await createAuditLog("reject_document", userId, "user", `Rejected ${docType} for ${userDoc.name}: ${reason}`);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (platformConfig?.maintenanceMode && platformConfig.maintenanceModeStartedAt) {
      const startedAt = new Date(platformConfig.maintenanceModeStartedAt.seconds * 1000);
      const now = new Date();
      const diffHours = Math.floor((now.getTime() - startedAt.getTime()) / (1000 * 60 * 60));
      
      if (diffHours >= 1) {
        showToast(
          "Maintenance Reminder", 
          `Platform has been offline for ${diffHours} hour${diffHours > 1 ? "s" : ""}. Remember to bring it back online once work is complete.`,
          "error"
        );
      }
    }
  }, [platformConfig?.maintenanceMode, activeTab]);

  const handleToggleMaintenance = () => {
    setShowMaintenanceConfirm(true);
  };

  const confirmToggleMaintenance = async () => {
    const newStatus = !tempConfig.maintenanceMode;
    const updatedConfig = {
      ...tempConfig,
      maintenanceMode: newStatus,
      maintenanceModeStartedAt: newStatus ? serverTimestamp() : null,
      maintenanceModeUpdatedBy: profile?.name || user?.email || "Admin"
    };
    
    setTempConfig(updatedConfig);
    setShowMaintenanceConfirm(false);
    
    try {
      await setDoc(doc(db, "platform_config", "global"), {
        ...updatedConfig,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid
      });
      await createAuditLog("toggle_maintenance", "global", "config", `Turned maintenance mode ${newStatus ? "ON" : "OFF"}`);
      showToast("System Updated", `Maintenance mode is now ${newStatus ? "ON" : "OFF"}`, newStatus ? "error" : "success");
    } catch (err) {
      console.error("Error saving maintenance status:", err);
      showToast("Error", "Failed to update maintenance status", "error");
    }
  };

  const handleTogglePaywall = () => {
    setShowPaywallConfirm(true);
  };

  const confirmTogglePaywall = async () => {
    const newStatus = tempConfig.paywallEnabled === false ? true : false;
    const updatedConfig = {
      ...tempConfig,
      paywallEnabled: newStatus,
      paywallStatusUpdatedBy: profile?.name || user?.email || "Admin"
    };
    
    setTempConfig(updatedConfig);
    setShowPaywallConfirm(false);
    
    try {
      await setDoc(doc(db, "platform_config", "global"), {
        ...updatedConfig,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid
      });
      await createAuditLog("toggle_paywall", "global", "config", `Turned monetization ${newStatus ? "ON" : "OFF (BETA MODE)"}`);
      showToast(
        newStatus ? "Monetization Live" : "Beta Mode Active",
        newStatus ? "Subscription tiers and job limits are now active." : "Paywall disabled. All users have unlimited free access.",
        "success"
      );
    } catch (err) {
      console.error("Error saving paywall status:", err);
      showToast("Error", "Failed to update monetization status", "error");
    }
  };

  const handleSaveSecret = async () => {
    if (!editingKey) return;
    setIsSavingSecrets(true);
    try {
      await setDoc(doc(db, "platform_config", "secrets"), {
        ...platformSecrets,
        [editingKey.id]: editingKey.value,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid
      });
      await createAuditLog("update_api_key", editingKey.id, "config", `Updated API key for ${editingKey.label}`);
      showToast("Success", `${editingKey.label} updated successfully.`);
      setShowKeyModal(false);
      setEditingKey(null);
    } catch (err) {
      console.error(err);
      showToast("Error", "Failed to save API key.", "error");
    } finally {
      setIsSavingSecrets(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!user || !tempConfig) return;
    
    // Safety check for arrays
    const feeTiers = tempConfig.feeTiers || [];
    const businessTiers = tempConfig.businessTiers || [];

    // Validation
    if (feeTiers.length === 0) {
      alert("At least one provider fee tier is required.");
      return;
    }

    for (const tier of feeTiers) {
      if (!tier.name?.trim()) {
        alert("All provider tiers must have a name.");
        return;
      }
      const price = parseFloat(String(tier.price));
      if (isNaN(price) || price < 0) {
        alert(`Invalid price for tier: ${tier.name}`);
        return;
      }
    }

    for (const tier of businessTiers) {
      if (!tier.name?.trim()) {
        alert("All business tiers must have a name.");
        return;
      }
      const price = parseFloat(String(tier.price));
      if (isNaN(price) || price < 0) {
        alert(`Invalid price for business tier: ${tier.name}`);
        return;
      }
    }

    setIsSavingSettings(true);
    try {
      await setDoc(doc(db, "platform_config", "global"), {
        ...tempConfig,
        feeTiers,
        businessTiers,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
      });
      await createAuditLog("update_settings", "global", "config", "Updated platform settings and fee structures");
      setHasUnsavedChanges(false);
      showToast("Success", "Settings saved successfully.");
    } catch (err) {
      console.error(err);
      showToast("Error", "Failed to save settings. Please check your connection.", "error");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleGenerateBroadcastDraft = async () => {
    if (!broadcastTitle) {
      alert("Please enter a rough idea or topic in the Message Title field first.");
      return;
    }
    setIsDraftingBroadcast(true);
    try {
      const audience = broadcastSegments.join(" and ") + 
        (broadcastTrades.length > 0 ? ` (specifically: ${broadcastTrades.join(", ")})` : "");
      const draft = await generateBroadcastDraft(broadcastTitle, broadcastType, audience);
      setBroadcastContent(draft);
    } catch (err) {
      console.error(err);
      alert("Failed to generate draft. Please try again.");
    } finally {
      setIsDraftingBroadcast(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (!user || !broadcastTitle || !broadcastContent || broadcastSegments.length === 0) return;
    setIsBroadcasting(true);
    try {
      const broadcastRef = doc(collection(db, "broadcasts"));
      const targetUsers = users.filter(u => {
        const segmentMatch = broadcastSegments.includes(u.role);
        if (!segmentMatch) return false;
        
        // If targeting tradespeople and specific trades are selected, filter by them
        if (u.role === "tradesperson" && broadcastTrades.length > 0) {
          return u.trades?.some((t: string) => broadcastTrades.includes(t));
        }
        
        return true;
      });

      await setDoc(broadcastRef, {
        id: broadcastRef.id,
        title: broadcastTitle,
        content: broadcastContent,
        type: broadcastType,
        targetSegments: broadcastSegments,
        targetTrades: broadcastTrades,
        sentBy: user.uid,
        recipientCount: targetUsers.length,
        createdAt: serverTimestamp()
      });

      // Send in-app notifications to all target users
      const notificationPromises = targetUsers.map(u => 
        sendNotification(u.id, broadcastTitle, broadcastContent, "system")
      );
      await Promise.all(notificationPromises);

      const targetDesc = `${broadcastSegments.join(", ")}${broadcastTrades.length > 0 ? ` (${broadcastTrades.join(", ")})` : ""}`;
      await createAuditLog("send_broadcast", broadcastRef.id, "broadcast", `Sent ${broadcastType} to ${targetDesc} (${targetUsers.length} recipients)`);
      
      setShowBroadcastModal(false);
      setBroadcastTitle("");
      setBroadcastContent("");
      setBroadcastSegments(["homeowners", "tradespeople"]);
      setBroadcastTrades([]);
      alert(`Broadcast sent to ${targetUsers.length} users! In production, this would also trigger Email/SMS.`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleSendInvite = async () => {
    if (!user || !inviteEmail || invitePermissions.length === 0) return;
    setIsInviting(true);
    try {
      const inviteRef = doc(collection(db, "invitations"));
      await setDoc(inviteRef, {
        id: inviteRef.id,
        email: inviteEmail.toLowerCase(),
        role: "admin",
        permissions: invitePermissions,
        status: "pending",
        invitedBy: user.uid,
        createdAt: serverTimestamp()
      });

      await createAuditLog("send_invitation", inviteRef.id, "user", `Invited ${inviteEmail} with ${invitePermissions.length} permissions`);
      
      setShowInviteModal(false);
      setInviteEmail("");
      setInvitePermissions([]);
      alert(`Invitation link for ${inviteEmail} created! In production, an email would be sent.`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsInviting(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      await deleteDoc(doc(db, "invitations", inviteId));
      await createAuditLog("cancel_invitation", inviteId, "user", "Invitation cancelled");
    } catch (err) {
      console.error(err);
    }
  };

  const [toastMessage, setToastMessage] = useState<{title: string, message: string, type: "success" | "error"} | null>(null);

  const showToast = (title: string, message: string, type: "success" | "error" = "success") => {
    setToastMessage({ title, message, type });
  };

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleToggleStaffStatus = async (userId: string, currentStatus: boolean) => {
    console.log(`Attempting to toggle status for user ${userId}. Current isDisabled: ${currentStatus}`);
    try {
      await updateDoc(doc(db, "users", userId), {
        isDisabled: !currentStatus,
        updatedAt: serverTimestamp()
      });
      console.log("User document updated successfully");
      
      try {
        await createAuditLog(
          !currentStatus ? "restrict_staff" : "reinstate_staff", 
          userId, 
          "user", 
          !currentStatus ? "Account restricted" : "Account reinstated"
        );
        console.log("Audit log created successfully");
      } catch (auditErr) {
        console.error("Failed to create audit log:", auditErr);
        // We don't fail the whole operation if just the audit log fails, 
        // but we should know about it.
      }

      showToast(
        !currentStatus ? "User Suspended" : "User Allowed",
        !currentStatus ? "The user account has been successfully suspended." : "The user account has been successfully reinstated."
      );
    } catch (err) {
      console.error("Error in handleToggleStaffStatus:", err);
      showToast("Error", "Failed to update user status. Check console for details.", "error");
    }
  };

  const createAuditLog = async (action: string, targetId: string, targetType: string, details: string) => {
    if (!user) return;
    try {
      const logRef = doc(collection(db, "audit_logs"));
      await setDoc(logRef, {
        id: logRef.id,
        adminId: user.uid,
        action,
        targetId,
        targetType,
        details,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, "create", `audit_logs`);
      throw err;
    }
  };

  const handleVerifyTradesperson = async (userId: string, status: "verified" | "rejected" | "vetted" | "auditioned") => {
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      
      await updateDoc(userRef, {
        verificationStatus: status,
        updatedAt: serverTimestamp()
      });

      // Handle Founding Member ID Assignment if upgraded to at least verified
      if (status !== "rejected" && userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.role === "tradesperson" && !userData.isFoundingMember) {
          const foundingId = await assignFoundingId(userId);
          if (foundingId) {
            console.log(`Assigned Founding ID ${foundingId} to ${userData.name}`);
            // Also notify the user about their prestigious status
            await addDoc(collection(db, "notifications"), {
              userId,
              title: "🎉 Founding Member Status!",
              message: `Congratulations! You have been verified as one of our first 100 traders. Your new Elite Member ID is ${foundingId}.`,
              type: "system",
              read: false,
              createdAt: serverTimestamp(),
              link: "/profile"
            });
          }
        }
      }

      // Handle Referral Reward if verified
      if (status === "verified" && userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.role === "tradesperson" && userData.referredBy && !userData.referralRewardProcessed) {
          try {
            // Get platform config for boost duration
            const configRef = doc(db, "platform_config", "global");
            const configSnap = await getDoc(configRef);
            const boostDays = configSnap.exists() ? (configSnap.data().referralBoostDays || 7) : 7;
            
            const referrerRef = doc(db, "users", userData.referredBy);
            const referrerSnap = await getDoc(referrerRef);
            
            if (referrerSnap.exists()) {
              const now = new Date();
              const boostUntil = new Date(now.getTime() + boostDays * 24 * 60 * 60 * 1000);
              
              await updateDoc(referrerRef, {
                referralBoostUntil: boostUntil.toISOString()
              });
              
              await updateDoc(userRef, {
                referralRewardProcessed: true
              });

              // Notify referrer
              await addDoc(collection(db, "notifications"), {
                userId: userData.referredBy,
                title: "Referral Reward Granted!",
                message: `Your referral ${userData.name} has been verified. You've received a ${boostDays}-day profile boost!`,
                type: "system",
                read: false,
                createdAt: new Date().toISOString()
              });
            }
          } catch (err) {
            console.error("Error processing referral reward:", err);
          }
        }
      }

      await createAuditLog(`verify_tradesperson_${status}`, userId, "user", `Verification status set to ${status}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveDispute = async (jobId: string, resolution: "resolved" | "mediated") => {
    try {
      await updateDoc(doc(db, "jobs", jobId), {
        "dispute.status": resolution,
        status: resolution === "resolved" ? "completed" : "cancelled",
        hasReview: resolution === "resolved" ? false : false, // Default to false for consistency
        updatedAt: serverTimestamp()
      });
      await createAuditLog(`resolve_dispute_${resolution}`, jobId, "job", `Dispute resolved as ${resolution}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSummarizeDispute = async (job: any) => {
    setIsSummarizingDispute(prev => ({ ...prev, [job.id]: true }));
    try {
      // Find the accepted quote to get the tradesperson ID
      const quotesSnapshot = await getDocs(collection(db, "jobs", job.id, "quotes"));
      const acceptedQuote = quotesSnapshot.docs.map(d => d.data()).find(q => q.status === "accepted");
      
      if (!acceptedQuote) {
        throw new Error("No accepted quote found for this job.");
      }

      const conversationId = `${job.id}_${acceptedQuote.tradespersonId}`;
      const messagesSnapshot = await getDocs(collection(db, "conversations", conversationId, "messages"));
      const messages = messagesSnapshot.docs.map(d => d.data());

      const summary = await summarizeDisputeChat(messages, job.dispute?.reason || "No reason provided");
      setDisputeSummaries(prev => ({ ...prev, [job.id]: summary }));
    } catch (err) {
      console.error("Error summarizing dispute:", err);
      alert("Failed to summarize dispute chat. " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsSummarizingDispute(prev => ({ ...prev, [job.id]: false }));
    }
  };

  const handleAnalyzeRisk = async () => {
    setIsAnalyzingRisk(true);
    try {
      const alerts = await analyzeFraudRisk(users, jobs, logs);
      setRiskAlerts(alerts);
      setLastRiskAnalysis(new Date());
      await createAuditLog("analyze_risk", "platform", "system", "Ran AI Fraud & Risk Monitor");
    } catch (err) {
      console.error("Error analyzing risk:", err);
      alert("Failed to analyze risk. Please try again.");
    } finally {
      setIsAnalyzingRisk(false);
    }
  };

  const handleSuggestCategories = async () => {
    setIsGeneratingCategories(true);
    try {
      const suggestions = await suggestNewCategories(
        TRADE_CATEGORIES.map(c => c.name),
        searchLogs
      );
      setCategorySuggestions(suggestions);
      setLastCategoryAnalysis(new Date());
      await createAuditLog("analyze_trends", "platform", "system", "Ran AI Category Trends Analysis (Google + Internal)");
    } catch (err) {
      console.error("Error suggesting categories:", err);
      alert("Failed to generate category suggestions. Please try again.");
    } finally {
      setIsGeneratingCategories(false);
    }
  };

  const handleSaveCategory = async () => {
    if (!catName || !catIcon) {
      showToast("Error", "Category name and icon are required.", "error");
      return;
    }

    setIsSavingCategory(true);
    try {
      const safeName = catName.replace(/\s*\/\s*/g, '-');
      const categoryData = {
        id: editingCategory?.id || Date.now(),
        name: safeName,
        originalName: catName,
        icon: catIcon,
        subcategories: catSubcategories,
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, "platform_categories", safeName), categoryData);
      
      await createAuditLog(
        editingCategory ? "edit_category" : "add_category",
        safeName,
        "category",
        `${editingCategory ? "Updated" : "Added"} category: ${catName}`
      );

      showToast("Success", `Category ${editingCategory ? "updated" : "added"} successfully!`);
      setShowCategoryModal(false);
      setEditingCategory(null);
      setCatName("");
      setCatIcon("");
      setCatSubcategories([]);
    } catch (err) {
      console.error(err);
      showToast("Error", "Failed to save category.", "error");
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (catId: string, catName: string) => {
    try {
      await deleteDoc(doc(db, "platform_categories", catId));
      await createAuditLog("delete_category", catId, "category", `Deleted category: ${catName}`);
      showToast("Success", "Category deleted successfully.");
      setDeleteConfirm(null);
    } catch (err) {
      console.error(err);
      showToast("Error", "Failed to delete category.", "error");
    }
  };

  useEffect(() => {
    if (activeTab === "risk" && riskAlerts.length === 0 && !isAnalyzingRisk && users.length > 0) {
      handleAnalyzeRisk();
    }
  }, [activeTab, users.length]);

  useEffect(() => {
    if (activeTab === "trends" && categorySuggestions.length === 0 && !isGeneratingCategories) {
      handleSuggestCategories();
    }
  }, [activeTab]);

  const handleSyncCategories = async () => {
    if (syncConfirmText.toUpperCase() !== "SYNC") return;
    
    setIsGeneratingCategories(true);
    try {
      const { migrateCategories } = await import("../lib/migrateCategories");
      const result = await migrateCategories();
      if (result) {
        showToast("Success", "Migration complete!", "success");
        setShowSyncConfirm(false);
        setSyncConfirmText("");
      } else {
        showToast("Error", "Migration failed.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error", "Migration failed.", "error");
    } finally {
      setIsGeneratingCategories(false);
    }
  };

  const handleAnalyzeDocument = async (userId: string, docType: string, fileUrl: string, userName: string) => {
    setIsAnalyzingDoc(prev => ({ ...prev, [`${userId}_${docType}`]: true }));
    try {
      const result = await analyzeDocument(fileUrl, docType, userName);
      
      // Update the user's document with the AI result
      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const updatedDocs = userData.verificationDocs?.map((d: any) => {
          if (d.type === docType) {
            return {
              ...d,
              aiVerification: {
                ...result,
                timestamp: new Date().toISOString()
              }
            };
          }
          return d;
        });
        
        await updateDoc(userRef, { verificationDocs: updatedDocs });
        await createAuditLog("ai_verify_doc", userId, "user", `Ran AI Smart KYC on ${docType}`);
      }
    } catch (err) {
      console.error("Error analyzing document:", err);
      alert("Failed to analyze document. " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsAnalyzingDoc(prev => ({ ...prev, [`${userId}_${docType}`]: false }));
    }
  };

  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [userToRecommend, setUserToRecommend] = useState<any | null>(null);

  const handleToggleRecommendation = async (userId: string, categoryName: string) => {
    const userToUpdate = users.find(u => u.id === userId);
    if (!userToUpdate) return;

    const currentRecs = userToUpdate.recommendedCategories || [];
    const isRecommended = currentRecs.includes(categoryName);
    
    const newRecs = isRecommended 
      ? currentRecs.filter((c: string) => c !== categoryName)
      : [...currentRecs, categoryName];

    try {
      await updateDoc(doc(db, "users", userId), {
        recommendedCategories: newRecs
      });
      showToast("Success", `Updated recommendations for ${userToUpdate.name}`);
    } catch (err) {
      console.error(err);
      showToast("Error", "Failed to update recommendations", "error");
    }
  };

  const handleFirestoreError = (error: any, operation: string, path: string) => {
    console.error(`Firestore Error [${operation}] on [${path}]:`, error);
    const message = error?.message || String(error);
    if (message.includes("permission")) {
      showToast("Permission Denied", `You don't have permission to ${operation} at ${path}`, "error");
    } else {
      showToast("Error", `Failed to ${operation}: ${message}`, "error");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUserIds.length === 0) return;
    console.log("Current User Email:", user?.email);
    setIsSubmitting(true);
    let deletedCount = 0;
    try {
      // Filter out protected accounts just in case
      const protectedEmails = ["saanwar2002@gmail.com"];
      const idsToDelete = selectedUserIds.filter(id => {
        const u = users.find(userObj => userObj.id === id);
        if (id === user?.uid) return false;
        if (u?.email && protectedEmails.includes(u.email.toLowerCase())) return false;
        if (u?.role === "admin" || u?.role === "ecosystem_manager") return false; // Protect all staff from deletion
        return true;
      });

      if (idsToDelete.length === 0) {
        showToast("Action Cancelled", "Protected accounts cannot be deleted.", "error");
        setSelectedUserIds([]);
        setShowBulkDeleteModal(false);
        return;
      }

      for (const id of idsToDelete) {
        try {
          await deleteDoc(doc(db, "users", id));
          deletedCount++;
          // Try to create audit log, but don't fail the whole operation if it fails
          try {
            await createAuditLog("delete_user", id, "user", "User account deleted via bulk action");
          } catch (auditErr) {
            console.error("Failed to create audit log for", id, auditErr);
          }
        } catch (err) {
          handleFirestoreError(err, "delete", `users/${id}`);
          // If we've deleted some, show partial success
          if (deletedCount > 0) {
            showToast("Partial Success", `Deleted ${deletedCount} users before encountering an error.`, "error");
          }
          throw err;
        }
      }
      showToast("Success", `Successfully deleted ${deletedCount} users`);
      setSelectedUserIds([]);
      setShowBulkDeleteModal(false);
    } catch (err) {
      console.error("Bulk delete error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAllGuests = async () => {
    setIsSubmitting(true);
    try {
      let count = 0;
      for (const u of filteredGuestUsers) {
        // Double check it's not a protected account
        if (u.id === user?.uid || (u.email && ["saanwar2002@gmail.com"].includes(u.email.toLowerCase())) || u.role === "admin" || u.role === "ecosystem_manager") continue;
        
        await deleteDoc(doc(db, "users", u.id));
        count++;
      }
      showToast("Success", `Successfully deleted ${count} guest users`);
      setShowGuestDeleteModal(false);
    } catch (err) {
      console.error("Delete all guests error:", err);
      showToast("Error", "Failed to delete some guest users", "error");
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleFlushAuditLogs = async () => {
    setIsSubmitting(true);
    try {
      const q = query(collection(db, "audit_logs"));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      showToast("Success", `Flushed ${snapshot.docs.length} audit logs`);
      setShowFlushLogsModal(false);
    } catch (err) {
      console.error("Flush logs error:", err);
      showToast("Error", "Failed to flush audit logs", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportUsersCSV = (roleFilter?: string) => {
    const filteredUsers = roleFilter ? users.filter(u => u.role === roleFilter) : users;
    const headers = ["Name", "Email", "Role", "Tier", "Status", "Joined"];
    const rows = filteredUsers.map(u => [
      u.name || "N/A",
      u.email || "N/A",
      u.role || "N/A",
      u.tierId || "Basic",
      u.verificationStatus || "unverified",
      u.createdAt ? (u.createdAt.seconds ? new Date(u.createdAt.seconds * 1000).toLocaleDateString() : new Date(u.createdAt).toLocaleDateString()) : "N/A"
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${roleFilter ? roleFilter + '_' : ''}users_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Export Ready", `User data (${roleFilter || 'all'}) has been prepared and downloaded.`, "success");
  };

  const exportUserPerformanceReport = (u: any) => {
    // Collect specific data for this user
    const userJobs = jobs.filter(j => j.homeownerId === u.id || j.assignedTraderId === u.id);
    
    let csvContent = `USER PERFORMANCE REPORT: ${u.name}\n`;
    csvContent += `Email: ${u.email || 'N/A'}\n`;
    csvContent += `Role: ${u.role}\n`;
    csvContent += `Joined: ${u.createdAt ? (u.createdAt.seconds ? new Date(u.createdAt.seconds * 1000).toLocaleDateString() : new Date(u.createdAt).toLocaleDateString()) : 'N/A'}\n\n`;
    
    // Activity Section
    csvContent += `ACTIVITY HISTORY\n`;
    csvContent += `Job ID,Title,Role,Status,Date\n`;
    userJobs.forEach(j => {
      const userRole = j.homeownerId === u.id ? 'Customer' : 'Trader';
      const date = j.createdAt ? (j.createdAt.seconds ? new Date(j.createdAt.seconds * 1000).toLocaleDateString() : new Date(j.createdAt).toLocaleDateString()) : 'N/A';
      csvContent += `"${j.id}","${j.title}","${userRole}","${j.status}","${date}"\n`;
    });
    
    if (userJobs.length === 0) csvContent += "No job activity recorded.\n";

    // Reviews Section
    const userReviews = reviews.filter(r => r.revieweeId === u.id || r.reviewerId === u.id);
    csvContent += `\nREVIEWS & FEEDBACK\n`;
    csvContent += `Reviewer ID,Reviewee ID,Rating,Comment,Date\n`;
    userReviews.forEach(r => {
      const date = r.createdAt ? (r.createdAt.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleDateString() : new Date(r.createdAt).toLocaleDateString()) : 'N/A';
      csvContent += `"${r.reviewerId}","${r.revieweeId}","${r.rating}","${r.comment?.replace(/"/g, '""')}","${date}"\n`;
    });
    
    if (userReviews.length === 0) csvContent += "No reviews documented.\n";

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `performance_report_${u.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    showToast("Report Ready", `Individual performance report for ${u.name} downloaded.`, "success");
  };

  const exportJobsCSV = (categoryFilter?: string) => {
    const filteredJobs = categoryFilter ? jobs.filter(j => j.category === categoryFilter) : jobs;
    const headers = ["Job ID", "Title", "Category", "Status", "Budget", "Created At"];
    const rows = filteredJobs.map(j => [
      j.id || "N/A",
      j.title || "N/A",
      j.category || "N/A",
      j.status || "N/A",
      j.budget ? `£${j.budget}` : "N/A",
      j.createdAt ? (j.createdAt.seconds ? new Date(j.createdAt.seconds * 1000).toLocaleDateString() : new Date(j.createdAt).toLocaleDateString()) : "N/A"
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${categoryFilter ? categoryFilter.replace(/\s+/g, '_') + '_' : ''}jobs_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Export Ready", `Job data (${categoryFilter || 'all'}) has been prepared and downloaded.`, "success");
  };

  const exportDisputesCSV = (statusFilter?: string) => {
    const disputedJobs = jobs.filter(j => j.status === "disputed");
    const filtered = statusFilter ? disputedJobs.filter(j => j.disputeStatus === statusFilter) : disputedJobs;
    const headers = ["Job ID", "Title", "Category", "Customer", "Trader", "Dispute Reason", "Created At"];
    const rows = filtered.map(j => [
      j.id || "N/A",
      j.title || "N/A",
      j.category || "N/A",
      j.ownerName || "N/A",
      j.assignedTraderName || "Unassigned",
      j.disputeReason || "N/A",
      j.createdAt ? (j.createdAt.seconds ? new Date(j.createdAt.seconds * 1000).toLocaleDateString() : new Date(j.createdAt).toLocaleDateString()) : "N/A"
    ]);

    const csvContent = [headers.join(","), ...rows.map(row => row.map(cell => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `disputes_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    showToast("Disputes Exported", "Legal and dispute data has been extracted.", "success");
  };

  const exportEcosystemCSV = () => {
    const headers = ["User", "Email", "Role", "Referral Code", "Referred By", "Verification"];
    const rows = users.map(u => [
      u.name || "N/A",
      u.email || "N/A",
      u.role || "N/A",
      u.referralCode || "N/A",
      u.referredBy || "N/A",
      u.verificationStatus || "N/A"
    ]);

    const csvContent = [headers.join(","), ...rows.map(row => row.map(cell => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `ecosystem_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    showToast("Ecosystem Stats Ready", "Referral and growth data downloaded.", "success");
  };

  const handleDeleteUser = async (userId: string) => {
    const u = users.find(userObj => userObj.id === userId);
    const protectedEmails = ["saanwar2002@gmail.com"];
    
    if (userId === user?.uid) {
      showToast("Action Denied", "You cannot delete your own account.", "error");
      return;
    }
    
    if (u?.email && protectedEmails.includes(u.email.toLowerCase())) {
      showToast("Action Denied", "This administrator account is protected.", "error");
      return;
    }

    if ((u?.role === "admin" || u?.role === "ecosystem_manager") && u.email !== user?.email && !protectedEmails.includes(user?.email?.toLowerCase() || "")) {
      showToast("Action Denied", "Only the super admin can delete other staff members.", "error");
      return;
    }
    
    setUserToDelete(userId);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await deleteDoc(doc(db, "users", userToDelete));
      await createAuditLog("delete_user", userToDelete, "user", "User account deleted");
      showToast("User Deleted", "The user account has been permanently deleted.");
    } catch (err) {
      handleFirestoreError(err, "delete", `users/${userToDelete}`);
    } finally {
      setUserToDelete(null);
    }
  };

  const dismissAiBudgetAlert = async () => {
    if (!platformConfig) return;
    try {
      await updateDoc(doc(db, "platform_config", "global"), {
        aiBudgetAlertDismissedAt: serverTimestamp()
      });
    } catch(err) {
      console.error("Error dismissing AI budget alert:", err);
    }
  };

  const handleGenerateAiRecommendations = async () => {
    setIsGeneratingAiRecs(true);
    setShowAiRecsModal(true);
    try {
      const recs = await getAiModelRecommendations();
      setAiRecommendations(recs);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate AI recommendations");
    } finally {
      setIsGeneratingAiRecs(false);
    }
  };

  const applyAiModel = async (modelId: string) => {
    setTempConfig({...tempConfig, aiModel: modelId});
    setShowAiRecsModal(false);
    toast.success("AI Model Selected. Don't forget to save platform configuration!");
  };

  const syncWithUnifiedPricing = () => {
    if (!tempConfig) return;
    const unifiedConfig = {
      ...tempConfig,
      feeTiers: [
        { 
          name: "Free Explorer", 
          price: 0, 
          maxQuotes: 5, 
          maxAcceptedQuotes: 2, 
          commission: 15,
          leadFee: 0,
          shopDiscount: 0,
          limitPeriod: "monthly", 
          description: "Start risk-free. 15% Platform Commission. Standard Lead Priority. Basic AI Insights.", 
          includesRecommendation: false 
        },
        { 
          name: "Silver Professional", 
          price: 45, 
          maxQuotes: 30, 
          maxAcceptedQuotes: 10, 
          commission: 10,
          leadFee: 0,
          shopDiscount: 5,
          limitPeriod: "monthly", 
          description: "For active pros. 10% Platform Commission. Priority Support. Performance Badge (5% Shop Discount).", 
          includesRecommendation: false 
        },
        { 
          name: "Gold Elite", 
          price: 95, 
          maxQuotes: 9999, 
          maxAcceptedQuotes: 9999, 
          commission: 5,
          leadFee: 0,
          shopDiscount: 10,
          limitPeriod: "monthly", 
          description: "Top Tier. 5% Platform Commission. Instant Lead Alerts. High-Trust Badge (10% Shop Discount).", 
          includesRecommendation: true 
        },
        { 
          name: "Platinum Enterprise", 
          price: 245, 
          maxQuotes: 9999, 
          maxAcceptedQuotes: 9999, 
          commission: 2.5,
          leadFee: 0,
          shopDiscount: 15,
          limitPeriod: "monthly", 
          description: "Teams & Scale. 2.5% Platform Commission. Multi-seat Dashboard (15% Shop Discount).", 
          includesRecommendation: true 
        }
      ],
      businessTiers: [
        { 
          name: "Standard Homeowner", 
          price: 0, 
          jobPostsLimit: 3, 
          commission: 0, 
          shopDiscount: 0,
          hasTeamManagement: false,
          limitPeriod: "monthly", 
          description: "Regular homeowners. 3 Active Job Posts per month. Standard support. AI Scope Refiner included." 
        },
        { 
          name: "Premium Landlord", 
          price: 19, 
          jobPostsLimit: 20, 
          commission: 1, 
          shopDiscount: 2,
          hasTeamManagement: false,
          limitPeriod: "monthly", 
          description: "Asset management. 20 Job Posts per month. 1% Service Fee. Priority Trader Matching. Property Portfolio tools." 
        },
        { 
          name: "Business Professional", 
          price: 125, 
          jobPostsLimit: 9999, 
          commission: 0.5, 
          shopDiscount: 5,
          hasTeamManagement: true,
          limitPeriod: "monthly", 
          description: "Property PM Firms. Unlimited Job Posts. 0.5% Service Fee. Multi-user accounts. Team coordination dashboard." 
        },
        { 
          name: "Enterprise Powerhouse", 
          price: 595, 
          jobPostsLimit: 9999, 
          commission: 0.1, 
          shopDiscount: 10,
          hasTeamManagement: true,
          limitPeriod: "monthly", 
          description: "Large Scale Operations. 0.1% Service Fee. Custom API Ingestion. Dedicated scale-up manager. White-label reports." 
        }
      ]
    };
    setTempConfig(unifiedConfig);
    setHasUnsavedChanges(true);
    showToast("Sync Successful", "Tiers updated to Unified Pricing Model. Click 'Save Changes' to push to database.");
  };

  if (profile?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Shield className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold text-slate-900">Access Denied</h1>
          <p className="text-slate-500">You do not have administrative privileges.</p>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter(u => 
    u.role !== "admin" && u.role !== "ecosystem_manager" &&
    (u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filter === "all" || u.role === filter || u.verificationStatus === filter)
  );

  const filteredJobs = jobs.filter(j => {
    const searchLower = searchTerm.toLowerCase();
    const normalizedSearch = searchLower.replace(/[^a-z0-9]/g, '');
    const jobNoNormalized = j.jobNo?.toLowerCase().replace(/[^a-z0-9]/g, '') || "";
    
    const matchesTitle = j.title?.toLowerCase().includes(searchLower);
    const matchesJobNo = normalizedSearch !== "" && jobNoNormalized.includes(normalizedSearch);
    
    if (filter === "emergency") {
      return (matchesTitle || matchesJobNo) && j.urgency === "emergency";
    }
    
    return (matchesTitle || matchesJobNo) && (filter === "all" || j.status === filter);
  });

  const filteredGuestJobs = jobs.filter(j => {
    const homeowner = users.find(u => u.id === j.homeownerId);
    return !homeowner || homeowner.isAnonymous || !homeowner.email;
  });

  const filteredGuestUsers = users.filter(u => u.isAnonymous || !u.email);

  const stats = {
    totalUsers: users.filter(u => u.role !== "admin" && u.role !== "ecosystem_manager").length,
    totalJobs: jobs.length,
    activeDisputes: jobs.filter(j => j.status === "disputed").length,
    pendingVerifications: users.filter(u => u.verificationStatus === "pending").length,
    staffCount: users.filter(u => u.role === "admin" || u.role === "ecosystem_manager").length
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 sm:pb-8">
      <div className="max-w-7xl mx-auto p-3 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
        
        {/* AI Budget Alert Banner */}
        {platformConfig?.aiBudgetEnabled && platformConfig?.aiCurrentSpend >= platformConfig?.aiBudgetLimit * 0.9 && !platformConfig?.aiBudgetAlertDismissedAt && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-600 text-white p-4 rounded-[2rem] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl shadow-red-200 border-2 border-red-500/50"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="text-center sm:text-left">
                <p className="font-black text-lg">AI Budget Limit Warning</p>
                <p className="text-xs opacity-90 font-medium">
                  We have reached {((platformConfig?.aiCurrentSpend / platformConfig?.aiBudgetLimit) * 100).toFixed(1)}% of the AI platform monthly budget (£{platformConfig?.aiBudgetLimit}). Service may be degraded if limit is exceeded.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <button 
                onClick={() => {
                  setActiveTab("settings");
                  setTimeout(() => {
                    document.getElementById('ai-model-control')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
                className="bg-white text-red-600 px-6 py-3 rounded-2xl font-black text-xs hover:bg-red-50 transition-all shadow-md active:scale-95 text-center"
              >
                Manage AI Settings
              </button>
              <button 
                onClick={dismissAiBudgetAlert}
                className="bg-red-700 text-white px-6 py-3 rounded-2xl font-black text-xs hover:bg-red-800 transition-all shadow-md active:scale-95 text-center"
              >
                Dismiss Notice
              </button>
            </div>
          </motion.div>
        )}

        {/* Marketplace Beta Mode Banner (Paywall Off) */}
        {platformConfig?.paywallEnabled === false && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-amber-500 text-white p-4 rounded-[2rem] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl shadow-amber-200"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="text-center sm:text-left">
                <p className="font-black text-lg">Marketplace Beta Mode Active</p>
                <p className="text-xs opacity-90 font-medium">
                  The paywall is currently DISABLED. All users have free, unlimited access to post and quote.
                </p>
              </div>
            </div>
            <button 
              onClick={() => {
                setActiveTab("settings");
                // Smooth scroll to monetization section
                setTimeout(() => {
                  const el = document.getElementById('monetization-control');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              className="px-6 py-3 rounded-2xl bg-white text-amber-600 font-black text-sm hover:bg-amber-50 transition-colors shadow-lg"
            >
              Configure Monetization
            </button>
          </motion.div>
        )}

        {/* Maintenance Banner */}
        {platformConfig?.maintenanceMode && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-600 text-white p-4 rounded-[2rem] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl shadow-red-200"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <Lock className="w-6 h-6" />
              </div>
              <div className="text-center sm:text-left">
                <p className="font-black text-lg">Maintenance Mode Active</p>
                <p className="text-xs opacity-90 font-medium">
                  The platform is offline for non-admin users. 
                  Started {platformConfig.maintenanceModeStartedAt ? (platformConfig.maintenanceModeStartedAt.seconds ? new Date(platformConfig.maintenanceModeStartedAt.seconds * 1000).toLocaleString() : new Date(platformConfig.maintenanceModeStartedAt).toLocaleString()) : "recently"}.
                </p>
              </div>
            </div>
            <button 
              onClick={() => handleTabChange("settings")}
              className="bg-white text-red-600 px-6 py-3 rounded-2xl font-black text-xs hover:bg-red-50 transition-all shadow-md active:scale-95 w-full sm:w-auto"
            >
              System Settings
            </button>
          </motion.div>
        )}

        {/* Marketplace Beta Mode Banner (Paywall Off) */}
        {/* Header Section */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[28px] bg-blue-600 flex items-center justify-center shadow-2xl shadow-blue-200 shrink-0 transform -rotate-3">
              <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[10px] font-black rounded-full uppercase tracking-widest">Control Center</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-200" />
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                AnyTrader <span className="text-blue-600">Admin</span>
              </h1>
              <p className="text-sm sm:text-base text-slate-500 font-medium">Platform oversight, security & growth analytics.</p>
            </div>
          </div>

          {/* Persistent Search Bar Area - Positioned exactly where requested */}
          <div className="relative w-full max-w-4xl z-[100]">
            <div className="relative group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
              <input 
                id="admin-global-search"
                type="text" 
                placeholder="Search features, settings or help (⌘K)..." 
                className="w-full pl-16 pr-20 py-5 rounded-[30px] bg-white border-2 border-slate-100 focus:outline-none focus:ring-8 focus:ring-blue-600/5 focus:border-blue-600 transition-all text-lg font-bold text-slate-900 shadow-xl shadow-slate-200/50"
                value={featureSearchTerm}
                onChange={(e) => setFeatureSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredFeatures.length > 0) {
                    navigateToFeature(filteredFeatures[0]);
                  }
                }}
              />
              <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <kbd className="hidden sm:flex px-2 py-1 bg-slate-50 rounded-lg text-[10px] font-black text-slate-400 border border-slate-100">⌘K</kbd>
                {featureSearchTerm && (
                  <button 
                    onClick={() => setFeatureSearchTerm("")}
                    className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Results Popover */}
            <AnimatePresence>
              {featureSearchTerm.trim() !== "" && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  className="absolute top-full left-0 right-0 mt-4 bg-white rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] border border-slate-100 overflow-hidden"
                >
                  <div className="p-4 max-h-[60vh] overflow-y-auto elegant-scrollbar">
                    <div className="space-y-1">
                      {filteredFeatures.map((f) => (
                        <button 
                          key={`${f.tab}-${f.title}`}
                          onClick={() => navigateToFeature(f)}
                          className="w-full p-4 rounded-2xl flex items-center justify-between hover:bg-blue-50/50 transition-all text-left group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all shadow-sm">
                              {f.icon}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{f.title}</p>
                              <p className="text-xs text-slate-400 font-medium">In {f.tab === 'settings' ? 'Global Configs' : f.tab}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Jump to</span>
                            <ArrowRight className="w-4 h-4 text-blue-600" />
                          </div>
                        </button>
                      ))}
                      {filteredFeatures.length === 0 && (
                        <div className="p-12 text-center text-slate-500 italic flex flex-col items-center gap-4">
                          <Search className="w-12 h-12 text-slate-100" />
                          <p>No matching features found for "{featureSearchTerm}"</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between px-8">
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Tip: Press ESC to clear search</p>
                     <div className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-lg border border-slate-200 text-[10px] font-black text-slate-500 uppercase">
                        Administrative Console
                      </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Navigation Tabs - Moved below search as per screenshot context */}
          <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md p-2 rounded-[28px] border border-slate-100 shadow-xl shadow-slate-100/50 overflow-x-auto no-scrollbar snap-x touch-pan-x max-w-full">
            <div className="flex items-center gap-2 pr-4">
              <TabButton active={activeTab === "users"} onClick={() => handleTabChange("users")} icon={<Users className="w-4 h-4" />} label="Users" />
              <TabButton active={activeTab === "jobs"} onClick={() => handleTabChange("jobs")} icon={<Briefcase className="w-4 h-4" />} label="Jobs" />
              <TabButton active={activeTab === "disputes"} onClick={() => handleTabChange("disputes")} icon={<AlertTriangle className="w-4 h-4" />} label="Disputes" />
              <TabButton active={activeTab === "team"} onClick={() => handleTabChange("team")} icon={<Shield className="w-4 h-4" />} label="Staff" />
              <TabButton active={activeTab === "verifications"} onClick={() => handleTabChange("verifications")} icon={<CheckCircle2 className="w-4 h-4" />} label="KYC" />
              <TabButton active={activeTab === "broadcast"} onClick={() => handleTabChange("broadcast")} icon={<Megaphone className="w-4 h-4" />} label="Broadcast" />
              <TabButton active={activeTab === "settings"} onClick={() => handleTabChange("settings")} icon={<Settings className="w-4 h-4" />} label="Configs" />
              <TabButton active={activeTab === "categories"} onClick={() => handleTabChange("categories")} icon={<Tags className="w-4 h-4" />} label="Categories" />
              <TabButton active={activeTab === "logs"} onClick={() => handleTabChange("logs")} icon={<FileText className="w-4 h-4" />} label="Audit" />
              <TabButton active={activeTab === "security"} onClick={() => handleTabChange("security")} icon={<Key className="w-4 h-4" />} label="API Keys" />
              <TabButton active={activeTab === "analytics"} onClick={() => handleTabChange("analytics")} icon={<BarChart3 className="w-4 h-4" />} label="Stats" />
              <TabButton active={activeTab === "insights"} onClick={() => handleTabChange("insights")} icon={<Sparkles className="w-4 h-4" />} label="Insights" />
              <TabButton active={activeTab === "monetization"} onClick={() => handleTabChange("monetization")} icon={<DollarSign className="w-4 h-4" />} label="Tiers" />
            </div>
          </div>
        </div>

        {/* Stats Grid - Optimized for Mobile Viewport */}
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6">
          <StatCard label="Total Users" value={stats.totalUsers} icon={<Users className="w-5 h-5 text-blue-500" />} color="blue" />
          <StatCard label="Live Jobs" value={stats.totalJobs} icon={<Briefcase className="w-5 h-5 text-purple-500" />} color="purple" />
          <StatCard label="Hot Disputes" value={stats.activeDisputes} icon={<AlertTriangle className="w-5 h-5 text-red-500" />} color="red" />
          <StatCard label="Pending KYC" value={stats.pendingVerifications} icon={<ShieldCheck className="w-5 h-5 text-amber-500" />} color="amber" />
          <div className="hidden xl:block">
            <StatCard label="System Staff" value={stats.staffCount} icon={<Lock className="w-5 h-5 text-slate-500" />} color="indigo" />
          </div>
        </div>

        {/* Dynamic Interface Container */}
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden flex flex-col min-h-[700px]">
          {/* Action & Filter Bar */}
          <div className="p-5 sm:p-8 border-b border-slate-50 flex flex-col md:flex-row gap-5 items-stretch md:items-center bg-slate-50/30">
            <div className="relative flex-1 group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text" 
                placeholder={activeTab === 'jobs' ? "Search title or Job ID..." : `Find in ${activeTab}...`}
                className="w-full pl-14 pr-6 py-4 rounded-[22px] bg-white border border-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all text-base font-bold text-slate-700 shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-white p-1 rounded-[22px] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <Filter className="w-4 h-4 text-slate-500" />
                  <select 
                    className="text-sm font-black text-slate-900 bg-transparent border-none focus:ring-0 cursor-pointer min-w-[120px]"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">ALL DATA</option>
                    {activeTab === "users" && (
                      <>
                        <option value="homeowner">HOMEOWNERS</option>
                        <option value="tradesperson">TRADERS</option>
                        <option value="business">BUSINESS</option>
                        <option value="pending">PENDING KYC</option>
                        <option value="verified">VERIFIED</option>
                      </>
                    )}
                    {activeTab === "jobs" && (
                      <>
                        <option value="posted">NEW POSTS</option>
                        <option value="emergency">EMERGENCY</option>
                        <option value="quoting">QUOTING</option>
                        <option value="in_progress">ACTIVE</option>
                        <option value="disputed">DISPUTES</option>
                        <option value="completed">COMPLETED</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {activeTab === "users" && filteredGuestUsers.length > 0 && (
                <button 
                  onClick={() => setShowGuestDeleteModal(true)}
                  disabled={isSubmitting}
                  className="bg-red-50 text-red-600 p-4 rounded-[22px] hover:bg-red-100 transition-all disabled:opacity-50 border border-red-100 active:scale-95"
                  title="Purge Guest Accounts"
                >
                  {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Trash2 className="w-6 h-6" />}
                </button>
              )}
            </div>
          </div>

          {/* Table Surface */}
          <div className="flex-1 relative overflow-x-auto elegant-scrollbar">
          {/* Bulk Action Bar */}
          <AnimatePresence>
            {activeTab === "users" && selectedUserIds.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="sticky top-0 left-0 right-0 z-[60] bg-blue-600 text-white p-4 flex items-center justify-between shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedUserIds([]);
                    }}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold leading-none">{selectedUserIds.length} selected</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const visibleUsers = isUsersExpanded ? filteredUsers : filteredUsers.slice(0, 3);
                        const allVisibleIds = visibleUsers.map(u => u.id);
                        setSelectedUserIds(Array.from(new Set([...selectedUserIds, ...allVisibleIds])));
                      }}
                      className="text-[10px] text-blue-100 hover:text-white transition-colors font-bold uppercase mt-1 text-left"
                    >
                      Select All Visible
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowBulkDeleteModal(true);
                    }}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 bg-white text-red-600 px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-red-50 transition-all disabled:opacity-50 shadow-sm active:scale-95"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Delete Selected
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="overflow-x-auto">
            {activeTab === "guest_jobs" && (
              <GuestJobs jobs={jobs} users={users} showToast={showToast} />
            )}

            {activeTab === "users" && (
              <div className="flex flex-col">
                {/* Desktop View Table */}
                <table className="w-full text-left border-collapse hidden md:table">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="p-4 w-10">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                          checked={selectedUserIds.length > 0 && (isUsersExpanded ? filteredUsers : filteredUsers.slice(0, 3)).every(u => selectedUserIds.includes(u.id))}
                          onChange={(e) => {
                            const visibleUsers = isUsersExpanded ? filteredUsers : filteredUsers.slice(0, 3);
                            if (e.target.checked) {
                              const newSelected = Array.from(new Set([...selectedUserIds, ...visibleUsers.map(u => u.id)]));
                              setSelectedUserIds(newSelected);
                            } else {
                              const visibleIds = visibleUsers.map(u => u.id);
                              setSelectedUserIds(selectedUserIds.filter(id => !visibleIds.includes(id)));
                            }
                          }}
                        />
                      </th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">User Details</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Platform Role</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Tier</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Status</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Joined</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right flex items-center justify-end gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setIsUsersExpanded(!isUsersExpanded); }}
                          className="hover:text-blue-600 transition-colors p-1"
                          title={isUsersExpanded ? "Show Top 3 Only" : "Show All Users"}
                        >
                          {isUsersExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/50">
                    {(isUsersExpanded ? filteredUsers : filteredUsers.slice(0, 3)).map(u => (
                  <tr key={`desktop-${u.id}`} className={cn(
                    "hover:bg-slate-50/30 transition-colors cursor-pointer",
                    selectedUserIds.includes(u.id) && "bg-blue-50/50"
                  )} onClick={() => window.open(`/profile/${u.id}`, '_blank')}>
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const isProtected = u.id === user?.uid || 
                                          (u.email && ["saanwar2002@gmail.com"].includes(u.email.toLowerCase())) ||
                                          u.role === "admin";
                        
                        if (isProtected) return (
                          <div className="flex justify-center">
                            <Lock className="w-4 h-4 text-slate-300" title={u.role === "admin" ? "Staff Account (Protected from Bulk Delete)" : "Protected Account"} />
                          </div>
                        );
                        
                        return (
                          <input 
                            type="checkbox" 
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                            checked={selectedUserIds.includes(u.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUserIds([...selectedUserIds, u.id]);
                              } else {
                                setSelectedUserIds(selectedUserIds.filter(id => id !== u.id));
                              }
                            }}
                          />
                        );
                      })()}
                    </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 overflow-hidden shadow-sm border border-white">
                              {u.avatarUrl ? (
                                <img src={u.avatarUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400 font-black text-lg">
                                  {u.name?.charAt(0)}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <p className="font-black text-slate-900 text-sm group-hover:text-blue-600 transition-colors uppercase tracking-tight">{u.name}</p>
                                {(u.isAnonymous || !u.email) && (
                                  <span className="text-[7px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">Guest</span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 font-medium">{u.email || "No email provided"}</p>
                            </div>
                          </div>
                        </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span className={cn(
                          "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full w-fit",
                          u.role === "admin" ? "bg-red-50 text-red-600" : 
                          u.role === "tradesperson" ? "bg-blue-50 text-blue-600" : 
                          "bg-slate-50 text-slate-600"
                        )}>
                          {u.role}
                        </span>
                        {u.memberId && (
                          <span className="text-[9px] font-black tracking-widest text-[#1e3a5f] bg-[#1e3a5f]/5 px-1.5 py-0.5 rounded border border-[#1e3a5f]/10 w-fit">
                            {u.memberId}
                          </span>
                        )}
                        {u.isFoundingMember && (
                          <span className="text-[9px] font-black uppercase text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100 flex items-center gap-1 w-fit">
                            <Award className="w-2.5 h-2.5 fill-current" />
                            Founding
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      {u.role === "tradesperson" ? (
                        <div className="flex flex-col gap-1.5">
                          <select
                            value={u.tierId || "Basic"}
                            onClick={(e) => e.stopPropagation()}
                            onChange={async (e) => {
                              const newTier = e.target.value;
                              try {
                                await updateDoc(doc(db, "users", u.id), { tierId: newTier });
                                await createAuditLog("update_user_tier", u.id, "user", `Changed tier to ${newTier}`);
                                showToast("Success", `Updated ${u.name}'s tier to ${newTier}`);
                              } catch (err) {
                                console.error(err);
                                showToast("Error", "Failed to update tier", "error");
                              }
                            }}
                            className="text-[10px] font-bold text-blue-600 bg-blue-50 border-none rounded-lg focus:ring-0 py-1"
                          >
                            {(platformConfig?.feeTiers || []).map((t: any) => (
                              <option key={t.name} value={t.name}>{t.name}</option>
                            ))}
                            {!(platformConfig?.feeTiers || []).find((t: any) => t.name === (u.tierId || "Basic")) && (
                              <option value={u.tierId || "Basic"}>{u.tierId || "Basic"}</option>
                            )}
                          </select>
                          {u.phantomFeesSaved > 0 && (
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 w-fit">
                              ROI: £{u.phantomFeesSaved.toFixed(2)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-4">
                      {u.role === "tradesperson" && (
                        <span className={cn(
                          "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                          u.verificationStatus === "auditioned" ? "bg-amber-100 text-amber-700 border border-amber-200" :
                          u.verificationStatus === "vetted" ? "bg-emerald-100 text-emerald-700 border border-emerald-200" :
                          u.verificationStatus === "verified" ? "bg-indigo-50 text-indigo-600 border border-indigo-100" : 
                          u.verificationStatus === "pending" ? "bg-orange-50 text-orange-600 border border-orange-100" : 
                          "bg-slate-50 text-slate-400"
                        )}>
                          {u.verificationStatus || "unverified"}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-xs text-slate-500">
                      {u.createdAt ? (
                        u.createdAt.seconds ? new Date(u.createdAt.seconds * 1000).toLocaleDateString() : 
                        new Date(u.createdAt).toLocaleDateString() === "Invalid Date" ? "N/A" : new Date(u.createdAt).toLocaleDateString()
                      ) : "N/A"}
                    </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {u.role === "tradesperson" && (
                              <div className="flex items-center gap-1 border-r border-slate-100 pr-2 mr-2">
                                {u.verificationStatus === "pending" && (
                                  <>
                                    <button onClick={(e) => { e.stopPropagation(); handleVerifyTradesperson(u.id, "verified"); }} className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-all shadow-sm" title="Approve Identity">
                                      <UserCheck className="w-4 h-4" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleVerifyTradesperson(u.id, "rejected"); }} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all shadow-sm" title="Reject Identity">
                                      <UserX className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                                {(u.verificationStatus === "verified" || u.verificationStatus === "pending") && (
                                  <button onClick={(e) => { e.stopPropagation(); handleVerifyTradesperson(u.id, "vetted"); }} className="p-2 text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-xl transition-all shadow-sm" title="Mark as Vetted">
                                    <ShieldCheck className="w-4 h-4" />
                                  </button>
                                )}
                                {(u.verificationStatus === "vetted" || u.verificationStatus === "verified" || u.verificationStatus === "pending") && (
                                  <button onClick={(e) => { e.stopPropagation(); handleVerifyTradesperson(u.id, "auditioned"); }} className="p-2 text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-xl transition-all shadow-sm" title="Mark as Auditioned">
                                    <Medal className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            )}
                            
                            <button 
                              onClick={async (e) => { 
                                e.stopPropagation(); 
                                const isCurrentlyFounding = u.isFoundingMember || false;
                                try {
                                  await updateDoc(doc(db, "users", u.id), { isFoundingMember: !isCurrentlyFounding });
                                  showToast("Success", `${isCurrentlyFounding ? 'Removed' : 'Added'} Founding Member status for ${u.name}`);
                                } catch (err) {
                                  console.error(err);
                                  showToast("Error", "Failed to update Founding status", "error");
                                }
                              }} 
                              className={cn(
                                "p-2 rounded-xl transition-all shadow-sm",
                                u.isFoundingMember ? "text-orange-600 bg-orange-50 hover:bg-orange-100" : "text-slate-400 bg-slate-50 hover:bg-slate-100"
                              )}
                              title={u.isFoundingMember ? "Remove Founding Status" : "Make Founding Member"}
                            >
                              <Award className="w-4 h-4" />
                            </button>

                            <button 
                              onClick={(e) => { e.stopPropagation(); exportUserPerformanceReport(u); }}
                              className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all shadow-sm"
                              title="Download Activity Report"
                            >
                              <BarChart3 className="w-4 h-4" />
                            </button>

                            <button 
                              onClick={(e) => { e.stopPropagation(); handleToggleStaffStatus(u.id, u.isDisabled || false); }}
                              className={cn(
                                "p-2 rounded-xl transition-all shadow-sm",
                                u.isDisabled ? "text-emerald-600 bg-emerald-50 hover:bg-emerald-100" : "text-amber-600 bg-amber-50 hover:bg-amber-100"
                              )}
                              title={u.isDisabled ? "Resume Access" : "Suspend Access"}
                            >
                              {u.isDisabled ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                            </button>

                            <button onClick={(e) => { e.stopPropagation(); handleDeleteUser(u.id); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all shadow-sm">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile View Cards */}
                <div className="md:hidden">
                  <div className="p-4 flex justify-between items-center bg-white border-b border-slate-100">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">User Directory</h3>
                    {filteredUsers.length > 3 && (
                      <button 
                        onClick={() => setIsUsersExpanded(!isUsersExpanded)}
                        className="flex items-center gap-2 text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition-all tracking-widest"
                      >
                        {isUsersExpanded ? (
                          <>HIDE <ChevronUp className="w-3 h-3" /></>
                        ) : (
                          <>SHOW ALL ({filteredUsers.length}) <ChevronDown className="w-3 h-3" /></>
                        )}
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {(isUsersExpanded ? filteredUsers : filteredUsers.slice(0, 3)).map(u => (
                    <div key={`mobile-${u.id}`} className="p-5 space-y-4 hover:bg-slate-50/50 transition-colors active:bg-slate-100">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-white shadow-xl shadow-slate-200 overflow-hidden border border-slate-100">
                            {u.avatarUrl ? (
                              <img src={u.avatarUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400 font-black text-xl">
                                {u.name?.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-black text-slate-900 text-base leading-none tracking-tight uppercase">{u.name}</p>
                              <span className={cn(
                                "text-[8px] font-black uppercase px-2 py-0.5 rounded-full",
                                u.role === "admin" ? "bg-red-100 text-red-600" : 
                                u.role === "tradesperson" ? "bg-blue-100 text-blue-600" : 
                                "bg-slate-100 text-slate-600"
                              )}>
                                {u.role}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 font-bold truncate max-w-[180px]">{u.email || "No Email (Guest Account)"}</p>
                          </div>
                        </div>
                        <input 
                          type="checkbox" 
                          className="rounded-[8px] w-6 h-6 border-slate-300 text-blue-600 focus:ring-blue-600 shadow-sm"
                          checked={selectedUserIds.includes(u.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUserIds([...selectedUserIds, u.id]);
                            } else {
                              setSelectedUserIds(selectedUserIds.filter(id => id !== u.id));
                            }
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                        <div>
                          <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Plan Tier</p>
                          {u.role === "tradesperson" ? (
                            <p className="text-[13px] font-black text-blue-600 uppercase">{u.tierId || "Basic"}</p>
                          ) : <p className="text-[13px] font-black text-slate-400">Regular</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">KYC STATUS</p>
                          <p className={cn(
                            "text-[13px] font-black uppercase",
                            u.verificationStatus === "auditioned" ? "text-amber-500" :
                            u.verificationStatus === "vetted" ? "text-emerald-500" :
                            u.verificationStatus === "verified" ? "text-indigo-500" : 
                            u.verificationStatus === "pending" ? "text-orange-500" : "text-slate-400"
                          )}>
                            {u.verificationStatus || "Pending"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {u.role === "tradesperson" && (
                          <div className="flex-1 flex gap-2">
                            {u.verificationStatus === "pending" && (
                              <>
                                <button onClick={() => handleVerifyTradesperson(u.id, "verified")} className="flex-1 bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-100 active:scale-95 transition-all text-xs uppercase tracking-widest">Verify</button>
                                <button onClick={() => handleVerifyTradesperson(u.id, "rejected")} className="px-4 bg-red-50 text-red-600 font-black py-4 rounded-2xl border border-red-100 active:scale-95 transition-all text-xs uppercase tracking-widest">Deny</button>
                              </>
                            )}
                            {(u.verificationStatus === "verified" || u.verificationStatus === "pending") && (
                              <button onClick={() => handleVerifyTradesperson(u.id, "vetted")} className="flex-1 bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-100 active:scale-95 transition-all text-[10px] uppercase tracking-widest">Vet Pro</button>
                            )}
                            {(u.verificationStatus === "vetted" || u.verificationStatus === "verified" || u.verificationStatus === "pending") && (
                              <button onClick={() => handleVerifyTradesperson(u.id, "auditioned")} className="flex-1 bg-amber-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-amber-100 active:scale-95 transition-all text-[10px] uppercase tracking-widest">Audition</button>
                            )}
                          </div>
                        )}
                        {u.role !== "tradesperson" && (
                          <>
                            <button 
                              onClick={() => { exportUserPerformanceReport(u); }}
                              className="w-14 h-14 flex items-center justify-center bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 active:scale-90 transition-all shadow-sm"
                            >
                              <BarChart3 className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleToggleStaffStatus(u.id, u.isDisabled || false)}
                              className={cn(
                                "flex-1 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all tracking-widest",
                                u.isDisabled ? "bg-emerald-600 text-white shadow-emerald-100" : "bg-amber-500 text-white shadow-amber-100"
                              )}
                            >
                              {u.isDisabled ? "Restore Access" : "Revoke Access"}
                            </button>
                            <button 
                              onClick={() => handleDeleteUser(u.id)}
                              className="w-14 h-14 bg-red-50 text-red-600 flex items-center justify-center rounded-2xl border border-red-100 active:scale-95 transition-all shadow-sm"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
              </div>
            )}

          {activeTab === "jobs" && (
            <div className="flex flex-col">
              <table className="w-full text-left border-collapse hidden md:table">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Job Title</th>
                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Category</th>
                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Posted</th>
                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right flex items-center justify-end gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsJobsExpanded(!isJobsExpanded); }}
                      className="hover:text-blue-600 transition-colors p-1"
                      title={isJobsExpanded ? "Show Top 3 Only" : "Show All Jobs"}
                    >
                      {isJobsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    Actions
                  </th>
                </tr>
              </thead>
                <tbody className="divide-y divide-slate-100/50">
                  {(isJobsExpanded ? filteredJobs : filteredJobs.slice(0, 3)).map(j => (
                    <tr key={`desktop-job-${j.id}`} className="hover:bg-slate-50/50 transition-colors group cursor-pointer" onClick={() => window.open(`/job/${j.id}`, '_blank')}>
                      <td className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-black text-slate-900 text-sm group-hover:text-blue-600 transition-colors">{j.title}</p>
                          {(() => {
                            const homeowner = users.find(u => u.id === j.homeownerId);
                            if (!homeowner || homeowner.isAnonymous || !homeowner.email) {
                              return (
                                <span className="text-[7px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">Guest Post</span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100">{j.jobNo || "NO ID"}</span>
                          <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">{j.postcode}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-bold text-slate-600">{j.category}</span>
                      </td>
                      <td className="p-4">
                        <span className={cn(
                          "text-[10px] font-black uppercase px-3 py-1 rounded-xl shadow-sm",
                          j.status === "disputed" ? "bg-red-100 text-red-600" : 
                          j.status === "in_progress" ? "bg-blue-100 text-blue-600" : 
                          j.status === "completed" ? "bg-emerald-100 text-emerald-600" : 
                          "bg-slate-100 text-slate-600"
                        )}>
                          {j.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className="text-[11px] font-bold text-slate-500">
                          {j.createdAt ? (j.createdAt.seconds ? new Date(j.createdAt.seconds * 1000).toLocaleDateString() : new Date(j.createdAt).toLocaleDateString()) : "N/A"}
                        </p>
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all shadow-sm active:scale-95"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile View Cards */}
              <div className="md:hidden">
                <div className="p-4 flex justify-between items-center bg-white border-b border-slate-100">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jobs Directory</h3>
                  {filteredJobs.length > 3 && (
                    <button 
                      onClick={() => setIsJobsExpanded(!isJobsExpanded)}
                      className="flex items-center gap-2 text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition-all tracking-widest"
                    >
                      {isJobsExpanded ? (
                        <>HIDE <ChevronUp className="w-3 h-3" /></>
                      ) : (
                        <>SHOW ALL ({filteredJobs.length}) <ChevronDown className="w-3 h-3" /></>
                      )}
                    </button>
                  )}
                </div>
                <div className="divide-y divide-slate-100">
                  {(isJobsExpanded ? filteredJobs : filteredJobs.slice(0, 3)).map(j => (
                  <div key={`mobile-job-${j.id}`} className="p-5 space-y-4 hover:bg-slate-50/50 transition-colors active:bg-slate-100" onClick={() => window.open(`/job/${j.id}`, '_blank')}>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-black text-slate-900 text-sm leading-tight tracking-tight">{j.title}</p>
                          {j.urgency === "emergency" && <Zap className="w-4 h-4 text-orange-500 fill-orange-500" />}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md uppercase tracking-widest">{j.jobNo || "NO ID"}</span>
                          <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">{j.postcode}</span>
                        </div>
                      </div>
                      <span className={cn(
                        "text-[9px] font-black uppercase px-2.5 py-1 rounded-xl shadow-sm",
                        j.status === "disputed" ? "bg-red-100 text-red-600" : 
                        j.status === "in_progress" ? "bg-blue-100 text-blue-600" : 
                        j.status === "completed" ? "bg-emerald-100 text-emerald-600" : 
                        "bg-slate-100 text-slate-600"
                      )}>
                        {j.status?.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100/50">
                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Category</p>
                        <p className="text-[11px] font-black text-slate-700 truncate">{j.category}</p>
                      </div>
                      <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100/50">
                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Posted On</p>
                        <p className="text-[11px] font-black text-slate-700">
                           {j.createdAt ? (j.createdAt.seconds ? new Date(j.createdAt.seconds * 1000).toLocaleDateString() : new Date(j.createdAt).toLocaleDateString()) : "N/A"}
                        </p>
                      </div>
                    </div>

                    <button className="w-full py-4 rounded-2xl bg-white border border-slate-100 text-blue-600 font-black text-[10px] uppercase tracking-widest shadow-sm flex items-center justify-center gap-2">
                      <Eye className="w-4 h-4" />
                      Review Details
                    </button>
                  </div>
                ))}
                </div>
              </div>
            </div>
          )}

            {activeTab === "disputes" && (
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Active Disputes</h3>
                  {jobs.filter(j => j.status === "disputed").length > 3 && (
                    <button 
                      onClick={() => setIsDisputesExpanded(!isDisputesExpanded)}
                      className="flex items-center gap-2 text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition-all tracking-widest"
                    >
                      {isDisputesExpanded ? (
                        <>HIDE DISPUTES <ChevronUp className="w-3 h-3" /></>
                      ) : (
                        <>SHOW ALL DISPUTES <ChevronDown className="w-3 h-3" /></>
                      )}
                    </button>
                  )}
                </div>
                {(isDisputesExpanded ? jobs.filter(j => j.status === "disputed") : jobs.filter(j => j.status === "disputed").slice(0, 3)).map(j => (
                  <div key={`dispute-${j.id}`} className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-6 h-6 text-red-500" />
                      <div>
                        <h4 className="font-bold text-slate-900">{j.title}</h4>
                        <p className="text-xs text-slate-500">Raised on {new Date(j.dispute?.createdAt?.seconds * 1000).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleResolveDispute(j.id, "resolved")} className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-green-700 transition-colors">
                        Mark Resolved
                      </button>
                      <button onClick={() => handleResolveDispute(j.id, "mediated")} className="bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-amber-700 transition-colors">
                        Force Cancel
                      </button>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <p className="text-sm text-slate-700 italic">"{j.dispute?.reason}"</p>
                  </div>
                  {j.dispute?.photos && (
                    <div className="flex gap-2">
                      {j.dispute.photos.map((url: string, i: number) => (
                        <img key={i} src={url} className="w-20 h-20 rounded-lg object-cover border border-slate-200" referrerPolicy="no-referrer" />
                      ))}
                    </div>
                  )}
                  
                  {/* AI Dispute Summarizer */}
                  <div className="pt-4 border-t border-slate-200">
                    {!disputeSummaries[j.id] && !isSummarizingDispute[j.id] && (
                      <button 
                        onClick={() => handleSummarizeDispute(j)}
                        className="text-xs font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors flex items-center gap-2"
                      >
                        <Zap className="w-4 h-4" />
                        AI Summarize Chat History
                      </button>
                    )}
                    
                    {isSummarizingDispute[j.id] && (
                      <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing chat history...
                      </div>
                    )}

                    {disputeSummaries[j.id] && (
                      <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-4 h-4 text-indigo-600" />
                          <h5 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">AI Chat Summary</h5>
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-bold text-indigo-800 mb-1">Core Disagreement</p>
                            <p className="text-sm text-slate-700 bg-white p-3 rounded-lg border border-indigo-50">{disputeSummaries[j.id].summary}</p>
                          </div>
                          
                          <div>
                            <p className="text-xs font-bold text-indigo-800 mb-1">Timeline of Events</p>
                            <ul className="space-y-1 bg-white p-3 rounded-lg border border-indigo-50">
                              {disputeSummaries[j.id].timeline.map((event, idx) => (
                                <li key={idx} className="text-xs text-slate-700 flex items-start gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                                  {event}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <p className="text-xs font-bold text-indigo-800 mb-1">Fault Analysis</p>
                            <p className="text-sm text-slate-700 bg-white p-3 rounded-lg border border-indigo-50 font-medium">{disputeSummaries[j.id].faultAnalysis}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {jobs.filter(j => j.status === "disputed").length === 0 && (
                <div className="py-12 text-center space-y-2">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
                  <p className="text-slate-500 font-medium">No active disputes. Everything is running smoothly!</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "risk" && (
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-red-600" />
                    AI Fraud & Risk Monitor
                  </h3>
                  <p className="text-sm text-slate-500">
                    Automatically analyze platform data to identify suspicious activities and high-risk accounts.
                  </p>
                </div>
                <button 
                  onClick={handleAnalyzeRisk}
                  disabled={isAnalyzingRisk}
                  className="bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-red-100"
                >
                  {isAnalyzingRisk ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {isAnalyzingRisk ? "Analyzing Data..." : "Run Risk Analysis"}
                </button>
              </div>

              {lastRiskAnalysis && (
                <p className="text-xs text-slate-400 font-medium">
                  Last analysis run: {lastRiskAnalysis.toLocaleString()}
                </p>
              )}

              {riskAlerts.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {riskAlerts.map((alert, idx) => (
                    <div key={`risk-alert-${alert.targetId}-${idx}`} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row gap-5">
                      <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl min-w-[100px]">
                        <div className={cn(
                          "text-2xl font-black",
                          alert.riskLevel === "High" ? "text-red-600" :
                          alert.riskLevel === "Medium" ? "text-amber-600" : "text-blue-600"
                        )}>
                          {alert.riskScore}
                        </div>
                        <div className={cn(
                          "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full mt-1",
                          alert.riskLevel === "High" ? "bg-red-100 text-red-700" :
                          alert.riskLevel === "Medium" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                        )}>
                          {alert.riskLevel} Risk
                        </div>
                      </div>
                      
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                              {alert.type}
                            </span>
                            <h4 className="font-bold text-slate-900">{alert.targetName}</h4>
                            <span className="text-xs text-slate-400 font-mono">({alert.targetId.substring(0, 8)}...)</span>
                          </div>
                        </div>
                        
                        <div className="bg-red-50/50 border border-red-100 p-3 rounded-xl">
                          <p className="text-sm text-slate-700 leading-relaxed">
                            <span className="font-bold text-red-900 mr-2">Flag Reason:</span>
                            {alert.reason}
                          </p>
                        </div>
                        
                        <div className="flex items-center justify-between pt-2">
                          <p className="text-xs font-bold text-slate-600">
                            <span className="text-slate-400 mr-2 uppercase tracking-wider">Recommended Action:</span>
                            {alert.recommendedAction}
                          </p>
                          <div className="flex gap-2">
                            {alert.type === "user" && (
                              <button 
                                onClick={() => handleToggleStaffStatus(alert.targetId, false)}
                                className="text-[10px] font-bold bg-red-50 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors"
                              >
                                Suspend User
                              </button>
                            )}
                            <button className="text-[10px] font-bold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors">
                              View Details
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <ShieldCheck className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-slate-900">Platform is Secure</h3>
                  <p className="text-slate-500 text-sm max-w-md mx-auto mt-2">
                    Run the AI Risk Analysis to scan the platform for suspicious activity, fake accounts, or potential fraud.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "logs" && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Admin</th>
                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Action</th>
                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Target</th>
                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Details</th>
                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {logs.map(log => (
                  <tr key={log.id} className="text-xs">
                    <td className="p-4 font-bold text-slate-700">{log.adminId.substring(0, 8)}...</td>
                    <td className="p-4">
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase font-bold text-[8px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500">{log.targetType}: {log.targetId.substring(0, 8)}...</td>
                    <td className="p-4 text-slate-600">{log.details}</td>
                    <td className="p-4 text-slate-400">
                      {log.createdAt ? new Date(log.createdAt?.seconds * 1000).toLocaleString() : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "security" && (
            <div className="p-6 space-y-8">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-600" />
                  Security Alerts
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {securityAlerts.map(alert => (
                    <div key={alert.id} className={cn(
                      "p-4 rounded-2xl border flex items-center justify-between",
                      alert.resolved ? "bg-slate-50 border-slate-100" : "bg-red-50 border-red-100"
                    )}>
                      <div>
                        <p className="font-bold text-slate-900">{alert.threatType.toUpperCase()}</p>
                        <p className="text-sm text-slate-600">{alert.details}</p>
                        <p className="text-xs text-slate-400">Target: {alert.targetType} ({alert.targetId})</p>
                      </div>
                      {!alert.resolved && (
                        <button 
                          onClick={async () => {
                            await updateDoc(doc(db, "security_alerts", alert.id), { resolved: true });
                            showToast("Success", "Alert resolved.");
                          }}
                          className="bg-white text-slate-900 px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-50"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  ))}
                  {securityAlerts.length === 0 && (
                    <p className="text-slate-500 text-sm italic">No security alerts.</p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Key className="w-5 h-5 text-blue-600" />
                    Platform API Keys
                  </h3>
                  <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-lg">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span className="text-[10px] font-bold text-blue-700 uppercase">Encrypted at rest</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { id: "GEMINI_API_KEY", label: "Gemini AI API Key", description: "Powers all AI features, estimates, and mediation." },
                    { id: "GOOGLE_MAPS_API_KEY", label: "Google Maps API Key", description: "Used for address lookup and job mapping." },
                    { id: "STRIPE_SECRET_KEY", label: "Stripe Secret Key", description: "Handles secure payments and payouts." },
                    { id: "STRIPE_WEBHOOK_SECRET", label: "Stripe Webhook Secret", description: "Verifies payment events from Stripe." },
                    { id: "SENDGRID_API_KEY", label: "SendGrid API Key", description: "Sends transactional emails and notifications." }
                  ].map(key => (
                    <div key={key.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{key.label}</h4>
                          <p className="text-[10px] text-slate-500">{key.description}</p>
                        </div>
                        <button 
                          onClick={() => {
                            setEditingKey({ id: key.id, label: key.label, value: platformSecrets?.[key.id] || "" });
                            setShowKeyModal(true);
                          }}
                          className="p-2 hover:bg-slate-50 rounded-xl text-blue-600 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                        <code className="text-[10px] font-mono text-slate-400">
                          {platformSecrets?.[key.id] ? "••••••••••••••••" : "Not Configured"}
                        </code>
                        {platformSecrets?.[key.id] && (
                          <CheckCircle2 className="w-3 h-3 text-green-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-600" />
                  Duplicate Account Detector
                </h3>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                  {(() => {
                    const duplicates = users.reduce((acc: any, user: any) => {
                      if (user.deviceId) {
                        if (!acc[user.deviceId]) acc[user.deviceId] = [];
                        acc[user.deviceId].push(user);
                      }
                      return acc;
                    }, {});
                    const duplicateGroups = Object.entries(duplicates).filter(([, users]: any) => users.length > 1);
                    
                    return duplicateGroups.length > 0 ? (
                      <div className="space-y-4">
                        {duplicateGroups.map(([deviceId, users]: any) => (
                          <div key={deviceId} className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                            <p className="text-xs font-bold text-amber-800 mb-2">Device ID: {deviceId}</p>
                            <div className="space-y-1">
                              {users.map((u: any) => (
                                <div key={u.id} className="flex justify-between text-sm">
                                  <span className="font-medium text-slate-700">{u.name}</span>
                                  <span className="text-slate-500">{u.email}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm italic">No duplicate accounts detected.</p>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {activeTab === "team" && (
            <div className="p-6 space-y-8">
              {/* ... existing team content ... */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Staff & Moderators</h3>
                  <p className="text-sm text-slate-500">Manage internal team access and permissions.</p>
                </div>
                <button 
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  <UserPlus className="w-4 h-4" />
                  Invite Staff
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Team</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {users.filter(u => u.role === "admin" || u.role === "ecosystem_manager").map(u => (
                      <div key={u.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-900 text-sm">
                                {u.name}
                                <span className={cn(
                                  "ml-2 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full",
                                  u.role === "admin" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
                                )}>
                                  {u.role?.replace("_", " ")}
                                </span>
                              </p>
                              {u.isDisabled && (
                                <span className="bg-red-100 text-red-600 text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider border border-red-200">
                                  Suspended
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {u.permissions?.map((p: string) => (
                            <div key={p} className="w-2 h-2 rounded-full bg-blue-400" title={p} />
                          ))}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button 
                            onClick={() => handleToggleStaffStatus(u.id, u.isDisabled || false)}
                            className={cn(
                              "p-2 rounded-lg transition-colors",
                              u.isDisabled ? "text-green-600 hover:bg-green-50" : "text-amber-600 hover:bg-amber-50"
                            )}
                            title={u.isDisabled ? "Reinstate Access" : "Restrict Access"}
                          >
                            {u.isDisabled ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Staff"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Invitations</h4>
                  <div className="space-y-2">
                    {invitations.filter(i => i.status === "pending").map(invite => (
                      <div key={invite.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                            <Mail className="w-5 h-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{invite.email}</p>
                            <p className="text-[10px] text-slate-400 uppercase font-bold">
                              Invited on {new Date(invite.createdAt?.seconds * 1000).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Permissions</p>
                            <p className="text-xs text-slate-600">{invite.permissions.length} granted</p>
                          </div>
                          <button 
                            onClick={() => handleCancelInvite(invite.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {invitations.filter(i => i.status === "pending").length === 0 && (
                      <p className="text-sm text-slate-400 italic py-4">No pending invitations.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "broadcast" && (
            <div className="p-6 space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Broadcast Center</h3>
                  <p className="text-sm text-slate-500">Send mass messages, offers, and updates to users.</p>
                </div>
                <button 
                  onClick={() => setShowBroadcastModal(true)}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-green-700 transition-all shadow-lg shadow-green-100"
                >
                  <Megaphone className="w-4 h-4" />
                  New Broadcast
                </button>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recent Broadcasts</h4>
                <div className="grid grid-cols-1 gap-4">
                  {broadcasts.map(b => (
                    <div key={b.id} className="bg-white p-6 rounded-2xl border border-slate-100 space-y-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center",
                            b.type === "offer" ? "bg-amber-50 text-amber-600" : 
                            b.type === "announcement" ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-600"
                          )}>
                            {b.type === "offer" ? <Tag className="w-5 h-5" /> : 
                             b.type === "greeting" ? <Gift className="w-5 h-5" /> : <Megaphone className="w-5 h-5" />}
                          </div>
                          <div>
                            <h5 className="font-bold text-slate-900">{b.title}</h5>
                            <p className="text-[10px] text-slate-400 uppercase font-bold">
                              Sent to {b.targetSegments?.join(", ") || b.targetSegment}
                              {b.targetTrades?.length > 0 && ` (${b.targetTrades.join(", ")})`} • {b.recipientCount} Recipients
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold">
                          {b.createdAt ? new Date(b.createdAt?.seconds * 1000).toLocaleDateString() : "N/A"}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2">{b.content}</p>
                    </div>
                  ))}
                  {broadcasts.length === 0 && (
                    <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                      <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500 font-medium">No broadcasts sent yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "insights" && (
            <div className="p-6 space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Zap className="w-6 h-6 text-blue-600" />
                    AI Platform Insights
                  </h3>
                  <p className="text-sm text-slate-500">Real-time analysis of platform health and performance.</p>
                </div>
                <button 
                  onClick={fetchInsights}
                  disabled={isFetchingInsights}
                  className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isFetchingInsights ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Refresh Insights
                </button>
              </div>

              {isFetchingInsights && !platformInsights ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-4 bg-white rounded-3xl border border-slate-100">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  <p className="text-slate-500 font-medium">Analyzing platform data...</p>
                </div>
              ) : platformInsights ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="col-span-1 md:col-span-2 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-lg">
                      <h4 className="text-blue-100 font-bold uppercase tracking-wider text-xs mb-2">Platform Health Summary</h4>
                      <p className="text-xl font-medium leading-relaxed mb-6">{platformInsights.summary}</p>
                      <div className="flex items-center gap-4">
                        <div className="bg-white/20 px-4 py-2 rounded-xl backdrop-blur-sm">
                          <span className="text-3xl font-black">{platformInsights.healthScore}</span>
                          <span className="text-blue-100 text-sm ml-1">/ 100</span>
                        </div>
                        <p className="text-sm text-blue-100">Overall Health Score</p>
                      </div>
                    </div>
                    <div className="col-span-1 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                      <h4 className="text-slate-400 font-bold uppercase tracking-wider text-xs">Suggested Improvements</h4>
                      <ul className="space-y-3">
                        {platformInsights.improvements.map((imp, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                            {imp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {platformInsights.performanceData.map((data, idx) => (
                      <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{data.metric}</h5>
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            data.status === "good" ? "bg-green-500" :
                            data.status === "warning" ? "bg-amber-500" : "bg-red-500"
                          )} />
                        </div>
                        <div className="flex items-end gap-2">
                          <span className="text-2xl font-black text-slate-900">{data.value}</span>
                          {data.trend === "up" ? <TrendingUp className="w-4 h-4 text-green-500 mb-1" /> :
                           data.trend === "down" ? <TrendingUp className="w-4 h-4 text-red-500 mb-1 rotate-180" /> :
                           <span className="text-slate-400 text-xs font-bold mb-1">-</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="pt-8 border-t border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 mb-2">High Demand Trade Categories</h3>
                <p className="text-sm text-slate-500 mb-6">Categories with 10+ searches that don't have a direct match.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(searchLogs.reduce((acc: any, log) => {
                    acc[log.query] = (acc[log.query] || 0) + 1;
                    return acc;
                  }, {})).filter(([_, count]) => (count as number) >= 10).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([query, count]) => (
                    <div key={query} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                      <span className="font-bold text-slate-900 capitalize">{query}</span>
                      <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-bold text-xs">{count as number} searches</span>
                    </div>
                  ))}
                  {Object.entries(searchLogs.reduce((acc: any, log) => {
                    acc[log.query] = (acc[log.query] || 0) + 1;
                    return acc;
                  }, {})).filter(([_, count]) => (count as number) >= 10).length === 0 && (
                    <p className="text-sm text-slate-400 italic">No high demand categories found yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "verifications" && (
            <div className="p-6 space-y-8">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Verification Queue</h3>
                <p className="text-sm text-slate-500">Review and approve trade certifications and identity documents.</p>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {users.filter(u => u.verificationStatus === "pending" || (u.verificationDocs && u.verificationDocs.some((d: any) => d.status === "pending"))).map(u => (
                  <div key={u.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-xl font-bold text-slate-400">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900">{u.name}</h4>
                          <p className="text-xs text-slate-500">{u.email} • {u.trades?.join(", ")}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-3 py-1 rounded-full uppercase tracking-wider">
                        Pending Review
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {u.verificationDocs?.map((doc: any, idx: number) => (
                        <div key={idx} className="p-4 rounded-2xl border border-slate-50 bg-slate-50 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-slate-400" />
                              <span className="text-xs font-bold text-slate-700">{doc.type}</span>
                            </div>
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                              doc.status === "approved" ? "bg-green-100 text-green-700" :
                              doc.status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                            )}>
                              {doc.status}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <a 
                              href={doc.fileUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex-1 flex items-center justify-center gap-2 bg-white border border-slate-200 p-2 rounded-xl text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-all"
                            >
                              <Eye className="w-3 h-3" /> View Document
                            </a>
                            {doc.status === "pending" && (
                              <>
                                <button 
                                  onClick={() => handleAnalyzeDocument(u.id, doc.type, doc.fileUrl, u.name)}
                                  disabled={isAnalyzingDoc[`${u.id}_${doc.type}`]}
                                  className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all disabled:opacity-50"
                                  title="Run AI Smart KYC"
                                >
                                  {isAnalyzingDoc[`${u.id}_${doc.type}`] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                </button>
                                <button 
                                  onClick={() => handleApproveDoc(u.id, doc.type)}
                                  className="p-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all"
                                  title="Approve"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => {
                                    const reason = prompt("Enter rejection reason:");
                                    if (reason) handleRejectDoc(u.id, doc.type, reason);
                                  }}
                                  className="p-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all"
                                  title="Reject"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                          {doc.rejectionReason && (
                            <p className="text-[10px] text-red-600 font-medium italic">Reason: {doc.rejectionReason}</p>
                          )}

                          {/* AI Verification Result */}
                          {doc.aiVerification && (
                            <div className={cn(
                              "mt-2 p-3 rounded-xl border flex gap-3 items-start",
                              doc.aiVerification.isValid ? "bg-green-50/50 border-green-100" : "bg-red-50/50 border-red-100"
                            )}>
                              <div className={cn(
                                "mt-0.5 p-1 rounded-lg",
                                doc.aiVerification.isValid ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                              )}>
                                {doc.aiVerification.isValid ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                              </div>
                              <div className="space-y-1.5 flex-1">
                                <div className="flex items-center justify-between">
                                  <p className="text-[10px] font-bold text-slate-700 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-indigo-500" />
                                    AI Smart KYC
                                  </p>
                                  <span className={cn(
                                    "text-[9px] font-bold px-1.5 py-0.5 rounded",
                                    doc.aiVerification.confidence > 80 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                                  )}>
                                    {doc.aiVerification.confidence}% Match
                                  </span>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2 text-[9px] bg-white p-2 rounded-lg border border-slate-100">
                                  <div>
                                    <span className="text-slate-400 block mb-0.5">Extracted Name</span>
                                    <span className="font-medium text-slate-700">{doc.aiVerification.extractedData?.name || "N/A"}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block mb-0.5">Expiry Date</span>
                                    <span className="font-medium text-slate-700">{doc.aiVerification.extractedData?.expiryDate || "N/A"}</span>
                                  </div>
                                </div>

                                {doc.aiVerification.flags?.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {doc.aiVerification.flags.map((flag: string, i: number) => (
                                      <span key={i} className="text-[8px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase">
                                        {flag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                
                                <p className="text-[9px] text-slate-500 italic leading-tight">{doc.aiVerification.reasoning}</p>
                              </div>
                            </div>
                          )}

                          {/* Automated Check Result (Legacy) */}
                          {doc.autoCheck && (
                            <div className={cn(
                              "mt-2 p-3 rounded-xl border flex gap-3 items-start",
                              doc.autoCheck.status === "passed" ? "bg-green-50/50 border-green-100" :
                              doc.autoCheck.status === "failed" ? "bg-red-50/50 border-red-100" : "bg-amber-50/50 border-amber-100"
                            )}>
                              <div className={cn(
                                "mt-0.5 p-1 rounded-lg",
                                doc.autoCheck.status === "passed" ? "bg-green-100 text-green-600" :
                                doc.autoCheck.status === "failed" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                              )}>
                                {doc.autoCheck.status === "passed" ? <CheckCircle2 className="w-3 h-3" /> :
                                 doc.autoCheck.status === "failed" ? <XCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-700">Initial Check: {doc.autoCheck.status.toUpperCase().replace("_", " ")}</p>
                                <p className="text-[9px] text-slate-500 leading-tight">{doc.autoCheck.message}</p>
                                <p className="text-[8px] text-slate-400 font-medium">Source: {doc.autoCheck.provider} • {new Date(doc.autoCheck.timestamp).toLocaleString()}</p>
                              </div>
                            </div>
                          )}

                          {!doc.autoCheck && doc.status === "pending" && (
                            <button 
                              onClick={() => performInitialPublicRecordCheck(u.id, doc.type)}
                              className="w-full mt-2 py-2 rounded-xl border border-dashed border-slate-200 text-[10px] font-bold text-slate-400 hover:bg-white hover:border-blue-400 hover:text-blue-600 transition-all flex items-center justify-center gap-2"
                            >
                              <Zap className="w-3 h-3" /> Run Initial Check
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {users.filter(u => u.verificationStatus === "pending" || (u.verificationDocs && u.verificationDocs.some((d: any) => d.status === "pending"))).length === 0 && (
                  <div className="text-center py-20 bg-slate-50 rounded-[40px] border border-dashed border-slate-200">
                    <CheckCircle2 className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <h4 className="text-slate-900 font-bold">Queue is Empty</h4>
                    <p className="text-slate-500 text-sm">All pending verifications have been processed.</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Trends Tab */}
        {activeTab === "trends" && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  AI Category & Trade Suggestions
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  AI analyzes live Google Search trends and platform internal search data to suggest high-demand trade categories.
                </p>
              </div>
              <button
                onClick={handleSuggestCategories}
                disabled={isGeneratingCategories}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isGeneratingCategories ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {categorySuggestions.length > 0 ? "Refresh Suggestions" : "Generate Suggestions"}
              </button>
            </div>

            {isGeneratingCategories ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-500 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="font-medium animate-pulse">Analyzing Google Trends & Internal Searches...</p>
              </div>
            ) : categorySuggestions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categorySuggestions.map((suggestion) => (
                  <div key={`suggestion-${suggestion.category}`} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col h-full hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-slate-900 text-lg leading-tight">{suggestion.category}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                            suggestion.trend === "rising" ? "bg-green-100 text-green-700" :
                            suggestion.trend === "falling" ? "bg-red-100 text-red-700" :
                            "bg-blue-100 text-blue-700"
                          )}>
                            {suggestion.trend}
                          </span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                            suggestion.source === "google_trends" ? "bg-orange-100 text-orange-700" :
                            suggestion.source === "internal_search" ? "bg-purple-100 text-purple-700" :
                            "bg-indigo-100 text-indigo-700"
                          )}>
                            {suggestion.source.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 flex-1">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Reasoning</p>
                        <p className="text-sm text-slate-600 leading-relaxed">{suggestion.reason}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Scope of Work</p>
                        <p className="text-xs text-slate-500 italic leading-relaxed">{suggestion.scope}</p>
                      </div>

                      {suggestion.topKeywords && suggestion.topKeywords.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Top Search Terms</p>
                          <div className="flex flex-wrap gap-1.5">
                            {suggestion.topKeywords.map((keyword, kIndex) => (
                              <span key={kIndex} className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-medium border border-slate-200">
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Demand Score</span>
                        <span className="text-sm font-black text-slate-900">{suggestion.demandScore}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${suggestion.demandScore}%` }}
                          className={cn(
                            "h-full rounded-full",
                            suggestion.demandScore >= 80 ? "bg-green-500" :
                            suggestion.demandScore >= 50 ? "bg-blue-500" : "bg-amber-500"
                          )}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-3xl">
                <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-900 mb-1">No Suggestions Yet</h3>
                <p className="text-slate-500 text-sm max-w-md mx-auto mb-4">
                  Generate AI-powered suggestions to discover new trade categories based on what users are searching for on Google and our platform.
                </p>
                <button
                  onClick={handleSuggestCategories}
                  className="px-6 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors"
                >
                  Generate Now
                </button>
              </div>
            )}
            
            {lastCategoryAnalysis && (
              <p className="text-xs text-slate-400 text-right">
                Last analyzed: {lastCategoryAnalysis.toLocaleString()}
              </p>
            )}
          </div>
        )}
        
        {activeTab === "monetization" && tempConfig && (
          <div className="p-6 space-y-12">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Monetization & Tier Matrix</h3>
                <p className="text-sm text-slate-500">Manage pricing tiers, commissions, and platform monetization status.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button 
                  onClick={syncWithUnifiedPricing}
                  className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-blue-100 transition-all border border-blue-100 whitespace-nowrap"
                >
                  <RefreshCw className="w-3 h-3" />
                  Sync with Unified Pricing
                </button>
                <button 
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg disabled:opacity-50"
                >
                  {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            </div>

            {/* Comparison Grid */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-blue-600" />
                  </div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Global Paywall Control</h4>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center", 
                    tempConfig.paywallEnabled === false ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
                  )}>
                    {tempConfig.paywallEnabled === false ? <Sparkles className="w-6 h-6" /> : <DollarSign className="w-6 h-6" />}
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-900">Platform Monetization Mode</p>
                    <p className="text-xs text-slate-500">
                      {tempConfig.paywallEnabled === false 
                        ? "Beta Mode enabled: All tiers are free and paywalls are bypassed." 
                        : "Monetization enabled: Users must subscribe and pay commission as per their tier."}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={handleTogglePaywall}
                  className={cn(
                    "px-8 py-3 rounded-2xl font-black text-sm transition-all shadow-lg active:scale-95",
                    tempConfig.paywallEnabled === false 
                      ? "bg-amber-500 text-white hover:bg-amber-600 shadow-amber-200" 
                      : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200"
                  )}
                >
                  {tempConfig.paywallEnabled === false ? "Switch to Monetized Mode" : "Return to Beta Mode"}
                </button>
              </div>
            </section>

            <section className="space-y-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-slate-600" />
                </div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Tier Perks & Privilege Matrix</h4>
              </div>

              <div className="w-full">
                <AdminTierManager modelsToShow={["one_off_trades"]} />
              </div>
            </section>

            <div className="pt-12 border-t border-slate-100 space-y-12">
               {/* PROVIDER TIERS MANAGEMENT */}
               <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Trade Provider Tier Management</h4>
                    <p className="text-xs text-slate-500">Edit core parameters and quote limits for tradespeople.</p>
                  </div>
                  <button 
                    onClick={() => {
                      const newTiers = [...tempConfig.feeTiers, { 
                        name: "New Tier", 
                        price: 0, 
                        maxQuotes: 10, 
                        maxAcceptedQuotes: 5,
                        limitPeriod: "monthly",
                        description: "Description here", 
                        includesRecommendation: false,
                        commission: 10,
                        leadFee: 0
                      }];
                      setTempConfig({ ...tempConfig, feeTiers: newTiers });
                    }}
                    className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Add Provider Tier
                  </button>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {tempConfig.feeTiers.map((tier: any, index: number) => {
                    const isEditing = editingTiers.includes(index);
                    return (
                      <div key={`provider-tier-${tier.name}-${index}`} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 font-bold text-slate-900">
                            {isEditing ? (
                              <input 
                                className="px-2 py-1 rounded bg-slate-50 border-none focus:ring-2 focus:ring-blue-600 text-lg w-full"
                                value={tier.name}
                                onChange={(e) => {
                                  const newTiers = [...tempConfig.feeTiers];
                                  newTiers[index].name = e.target.value;
                                  setTempConfig({ ...tempConfig, feeTiers: newTiers });
                                }}
                              />
                            ) : <span className="text-lg">{tier.name}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => setEditingTiers(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index])}
                              className={cn("p-2 rounded-lg transition-colors", isEditing ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-50")}
                            >
                              {isEditing ? <CheckCircle2 className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                            </button>
                            <button 
                              onClick={() => {
                                const newTiers = tempConfig.feeTiers.filter((_: any, i: number) => i !== index);
                                setTempConfig({ ...tempConfig, feeTiers: newTiers });
                              }}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monthly Price</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">£</span>
                              <input 
                                type="number" 
                                className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-100 bg-slate-50 text-sm font-bold"
                                value={tier.price}
                                onChange={(e) => {
                                  const newTiers = [...tempConfig.feeTiers];
                                  newTiers[index].price = parseFloat(e.target.value);
                                  setTempConfig({ ...tempConfig, feeTiers: newTiers });
                                }}
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Max Quotes</label>
                            <input 
                              type="number" 
                              className="w-full px-3 py-2 rounded-xl border border-slate-100 bg-slate-50 text-sm font-bold"
                              value={tier.maxQuotes}
                              onChange={(e) => {
                                const newTiers = [...tempConfig.feeTiers];
                                newTiers[index].maxQuotes = parseInt(e.target.value);
                                setTempConfig({ ...tempConfig, feeTiers: newTiers });
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comm (%)</label>
                            <input 
                              type="number" 
                              className="w-full px-3 py-2 rounded-xl border border-slate-100 bg-slate-50 text-sm font-bold"
                              value={tier.commission || 0}
                              onChange={(e) => {
                                const newTiers = [...tempConfig.feeTiers];
                                newTiers[index].commission = parseFloat(e.target.value);
                                setTempConfig({ ...tempConfig, feeTiers: newTiers });
                              }}
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description / Perks List</label>
                          <textarea 
                            className="w-full px-3 py-2 rounded-xl border border-slate-100 bg-slate-50 text-xs font-medium h-20 resize-none"
                            value={tier.description || ""}
                            onChange={(e) => {
                              const newTiers = [...tempConfig.feeTiers];
                              newTiers[index].description = e.target.value;
                              setTempConfig({ ...tempConfig, feeTiers: newTiers });
                            }}
                            placeholder="List perks separated by commas or on new lines..."
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
               </div>

               {/* BUSINESS TIERS MANAGEMENT */}
               <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Business Hirer Tier Management</h4>
                    <p className="text-xs text-slate-500">Configure professional tiers for property managers and large businesses.</p>
                  </div>
                  <button 
                    onClick={() => {
                      const newTiers = [...(tempConfig.businessTiers || []), { 
                        name: "New Business Tier", 
                        price: 99, 
                        jobPostsLimit: 20,
                        limitPeriod: "monthly",
                        description: "Description here",
                        commission: 5
                      }];
                      setTempConfig({ ...tempConfig, businessTiers: newTiers });
                    }}
                    className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Add Business Tier
                  </button>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {(tempConfig.businessTiers || []).map((tier: any, index: number) => {
                    const tierId = index + 100;
                    const isEditing = editingTiers.includes(tierId);
                    return (
                      <div key={`business-tier-${tier.name}-${index}`} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 font-bold text-slate-900">
                            {isEditing ? (
                              <input 
                                className="px-2 py-1 rounded bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-lg w-full"
                                value={tier.name}
                                onChange={(e) => {
                                  const newTiers = [...tempConfig.businessTiers];
                                  newTiers[index].name = e.target.value;
                                  setTempConfig({ ...tempConfig, businessTiers: newTiers });
                                }}
                              />
                            ) : <span className="text-lg">{tier.name}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => setEditingTiers(prev => prev.includes(tierId) ? prev.filter(i => i !== tierId) : [...prev, tierId])}
                              className={cn("p-2 rounded-lg transition-colors", isEditing ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-50")}
                            >
                              {isEditing ? <CheckCircle2 className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                            </button>
                            <button 
                              onClick={() => {
                                const newTiers = tempConfig.businessTiers.filter((_: any, i: number) => i !== index);
                                setTempConfig({ ...tempConfig, businessTiers: newTiers });
                              }}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monthly Price</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">£</span>
                              <input 
                                type="number" 
                                className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-100 bg-slate-50 text-sm font-bold"
                                value={tier.price}
                                onChange={(e) => {
                                  const newTiers = [...tempConfig.businessTiers];
                                  newTiers[index].price = parseFloat(e.target.value);
                                  setTempConfig({ ...tempConfig, businessTiers: newTiers });
                                }}
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Post Limit</label>
                            <input 
                              type="number" 
                              className="w-full px-3 py-2 rounded-xl border border-slate-100 bg-slate-50 text-sm font-bold"
                              value={tier.jobPostsLimit}
                              onChange={(e) => {
                                const newTiers = [...tempConfig.businessTiers];
                                newTiers[index].jobPostsLimit = parseInt(e.target.value);
                                setTempConfig({ ...tempConfig, businessTiers: newTiers });
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comm (%)</label>
                            <input 
                              type="number" 
                              className="w-full px-3 py-2 rounded-xl border border-slate-100 bg-slate-50 text-sm font-bold"
                              value={tier.commission || 0}
                              onChange={(e) => {
                                const newTiers = [...tempConfig.businessTiers];
                                newTiers[index].commission = parseFloat(e.target.value);
                                setTempConfig({ ...tempConfig, businessTiers: newTiers });
                              }}
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description / Perks List</label>
                          <textarea 
                            className="w-full px-3 py-2 rounded-xl border border-slate-100 bg-slate-50 text-xs font-medium h-20 resize-none"
                            value={tier.description || ""}
                            onChange={(e) => {
                              const newTiers = [...tempConfig.businessTiers];
                              newTiers[index].description = e.target.value;
                              setTempConfig({ ...tempConfig, businessTiers: newTiers });
                            }}
                            placeholder="Describe the target business and specific perks..."
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === "subscriptions" && (() => {
          const tradespeople = users.filter(u => u.role === "tradesperson");
          const activeSubscribers = tradespeople.filter(u => u.subscriptionStatus === "active");
          const trialingUsers = tradespeople.filter(u => u.subscriptionStatus === "trialing" || (!u.subscriptionStatus && u.tierId === "Free Trial"));
          
          const mrr = activeSubscribers.reduce((total, user) => {
            const tier = platformConfig?.feeTiers?.find((t: any) => t.name === user.tierId);
            return total + (tier?.price || 0);
          }, 0);

          const homeowners = users.filter(u => u.role === "homeowner");
          const proHomeowners = homeowners.filter(u => u.subscriptionType === "landlord");

          const tierBreakdown = platformConfig?.feeTiers?.map((tier: any) => ({
            name: tier.name,
            count: tradespeople.filter(u => u.tierId === tier.name).length,
            revenue: tradespeople.filter(u => u.tierId === tier.name && u.subscriptionStatus === "active").length * (tier.price || 0)
          })) || [];

          const exportSubscriptionsCSV = () => {
            const headers = ["Name", "Email", "Tier", "Status", "Next Billing Date", "Cancel at Period End"];
            const rows = tradespeople.map(u => [
              u.name || "N/A",
              u.email || "N/A",
              u.tierId || "Free Trial",
              u.subscriptionStatus || "trialing",
              u.currentPeriodEnd ? new Date(u.currentPeriodEnd).toLocaleDateString() : "N/A",
              u.cancelAtPeriodEnd ? "Yes" : "No"
            ]);

            const csvContent = [
              headers.join(","),
              ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
            ].join("\n");

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `subscriptions_report_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          };

          const filteredTradespeople = tradespeople.filter(u => {
            if (filter === "all") return true;
            if (filter === "active") return u.subscriptionStatus === "active";
            if (filter === "trialing") return u.subscriptionStatus === "trialing" || (!u.subscriptionStatus && u.tierId === "Free Trial");
            if (filter === "canceled") return u.cancelAtPeriodEnd === true;
            return true;
          }).filter(u => 
            searchTerm === "" || 
            u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
            u.email?.toLowerCase().includes(searchTerm.toLowerCase())
          );

          return (
            <div className="p-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-slate-500 text-sm font-bold uppercase tracking-tight">Trades MRR</p>
                  <p className="text-3xl font-black text-slate-900 mt-1">£{mrr.toFixed(2)}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-slate-500 text-sm font-bold uppercase tracking-tight">Active Trade Subs</p>
                  <p className="text-3xl font-black text-slate-900 mt-1">{activeSubscribers.length}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-slate-500 text-sm font-bold uppercase tracking-tight">Pro Landlords</p>
                  <p className="text-3xl font-black text-slate-900 mt-1">{proHomeowners.length}</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-lg text-slate-900 mb-4">Homeowner/Landlord Tiers</h3>
                <div className="space-y-2">
                  <div className="flex justify-between p-3 bg-slate-50 rounded-lg font-bold text-sm">
                    <span>Tier</span>
                    <span>Subscribers</span>
                  </div>
                  {[
                    { name: "Standard Homeowner", count: homeowners.filter(u => u.subscriptionType === "standard").length },
                    { name: "Premium Landlord", count: homeowners.filter(u => u.subscriptionType === "landlord" && u.tierId === "Premium Landlord").length },
                    { name: "Business Professional", count: homeowners.filter(u => u.subscriptionType === "landlord" && u.tierId === "Business Professional").length },
                    { name: "Enterprise Powerhouse", count: homeowners.filter(u => u.subscriptionType === "landlord" && u.tierId === "Enterprise Powerhouse").length },
                  ].map(tier => (
                    <div key={tier.name} className="flex justify-between p-3 border-b border-slate-100 text-sm">
                      <span className="font-medium text-slate-700">{tier.name}</span>
                      <span className="font-bold text-slate-900">{tier.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Subscriptions & Revenue</h3>
                  <p className="text-sm text-slate-500">Manage tradesperson subscriptions and track MRR.</p>
                </div>
                <button 
                  onClick={exportSubscriptionsCSV}
                  className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Export CSV
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-bold text-slate-500 uppercase">Total MRR</p>
                  </div>
                  <p className="text-3xl font-black text-slate-900">£{mrr.toLocaleString()}</p>
                  <p className="text-xs text-slate-400 mt-2">Monthly Recurring Revenue</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-bold text-slate-500 uppercase">Active Subscribers</p>
                  </div>
                  <p className="text-3xl font-black text-slate-900">{activeSubscribers.length}</p>
                  <p className="text-xs text-slate-400 mt-2">Paying tradespeople</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                      <Users className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-bold text-slate-500 uppercase">Trialing Users</p>
                  </div>
                  <p className="text-3xl font-black text-slate-900">{trialingUsers.length}</p>
                  <p className="text-xs text-slate-400 mt-2">On Free Trial tier</p>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h4 className="font-bold text-slate-900">Subscribers List</h4>
                  {filteredTradespeople.length > 5 && (
                    <button 
                      onClick={() => setIsSubscribersExpanded(!isSubscribersExpanded)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      {isSubscribersExpanded ? (
                        <>See Less <ChevronUp className="w-3 h-3" /></>
                      ) : (
                        <>See All ({filteredTradespeople.length}) <ChevronDown className="w-3 h-3" /></>
                      )}
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                        <th className="p-4 font-bold">Tradesperson</th>
                        <th className="p-4 font-bold">Tier</th>
                        <th className="p-4 font-bold">Status</th>
                        <th className="p-4 font-bold">Next Billing</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(isSubscribersExpanded ? filteredTradespeople : filteredTradespeople.slice(0, 5)).map(user => (
                        <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
                                {user.photoURL ? (
                                  <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-500">
                                    {user.name?.charAt(0) || "U"}
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-sm text-slate-900">{user.name}</p>
                                <p className="text-[10px] text-slate-500">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold">
                              {user.tierId || "Free Trial"}
                            </span>
                          </td>
                          <td className="p-4">
                            {user.subscriptionStatus === "active" ? (
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold flex items-center gap-1 w-max">
                                <CheckCircle2 className="w-3 h-3" /> Active
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold w-max">
                                {user.subscriptionStatus || "Trialing"}
                              </span>
                            )}
                            {user.cancelAtPeriodEnd && (
                              <p className="text-[10px] text-red-500 mt-1 font-bold">Cancels at period end</p>
                            )}
                          </td>
                          <td className="p-4 text-xs text-slate-600 font-medium">
                            {user.currentPeriodEnd ? new Date(user.currentPeriodEnd).toLocaleDateString() : "-"}
                          </td>
                        </tr>
                      ))}
                      {filteredTradespeople.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-slate-500">
                            No tradespeople found matching your filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {activeTab === "analytics" && (
            <div className="p-6 space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Platform Analytics</h3>
                  <p className="text-sm text-slate-500">Track growth, revenue, and marketplace activity.</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                  {["7D", "30D", "90D", "1Y"].map(d => (
                    <button key={d} className={cn("px-3 py-1 text-[10px] font-bold rounded-lg transition-all", d === "30D" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      User Growth
                    </h4>
                    <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">+12% vs last month</span>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[
                        { name: 'Week 1', users: 400 },
                        { name: 'Week 2', users: 600 },
                        { name: 'Week 3', users: 800 },
                        { name: 'Week 4', users: 1200 },
                      ]}>
                        <defs>
                          <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Area type="monotone" dataKey="users" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-purple-600" />
                      Job Volume
                    </h4>
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">84 Total Jobs</span>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { name: 'Mon', jobs: 12 },
                        { name: 'Tue', jobs: 19 },
                        { name: 'Wed', jobs: 15 },
                        { name: 'Thu', jobs: 22 },
                        { name: 'Fri', jobs: 30 },
                        { name: 'Sat', jobs: 25 },
                        { name: 'Sun', jobs: 18 },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <Tooltip 
                          cursor={{ fill: '#f8fafc' }}
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="jobs" fill="#9333ea" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                  <h4 className="text-sm font-bold text-slate-900">Top Trade Categories</h4>
                  <div className="space-y-3">
                    {[
                      { name: "Plumbing", count: 24, color: "bg-blue-500" },
                      { name: "Electrical", count: 18, color: "bg-amber-500" },
                      { name: "Carpentry", count: 15, color: "bg-green-500" },
                      { name: "Roofing", count: 12, color: "bg-red-500" },
                    ].map(c => (
                      <div key={c.name} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-700">{c.name}</span>
                          <span className="text-slate-400">{c.count} jobs</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", c.color)} style={{ width: `${(c.count / 24) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                  <h4 className="text-sm font-bold text-slate-900">Revenue Breakdown</h4>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie
                          data={[
                            { name: 'Commission', value: 65, color: '#2563eb' },
                            { name: 'Lead Fees', value: 25, color: '#9333ea' },
                            { name: 'Subscriptions', value: 10, color: '#10b981' },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={60}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {[
                            { name: 'Commission', value: 65, color: '#2563eb' },
                            { name: 'Lead Fees', value: 25, color: '#9333ea' },
                            { name: 'Subscriptions', value: 10, color: '#10b981' },
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RePieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-4">
                    {["Commission", "Lead Fees", "Subs"].map((l, i) => (
                      <div key={l} className="flex items-center gap-1.5">
                        <div className={cn("w-2 h-2 rounded-full", i === 0 ? "bg-blue-600" : i === 1 ? "bg-purple-600" : "bg-green-600")} />
                        <span className="text-[10px] font-bold text-slate-500">{l}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                  <h4 className="text-sm font-bold text-slate-900">Marketplace Health</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Avg. Quote Time</p>
                      <p className="text-xl font-black text-slate-900">4.2h</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Hire Rate</p>
                      <p className="text-xl font-black text-slate-900">72%</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Dispute Rate</p>
                      <p className="text-xl font-black text-slate-900 text-green-600">0.8%</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Active Trades</p>
                      <p className="text-xl font-black text-slate-900">142</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "categories" && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Manage Trade Categories</h3>
                  <p className="text-sm text-slate-500">Add, edit or remove trade categories and subcategories.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      setEditingCategory(null);
                      setCatName("");
                      setCatIcon("");
                      setCatSubcategories([]);
                      setShowCategoryModal(true);
                    }}
                    className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-slate-800 transition-all"
                  >
                    <Plus className="w-4 h-4" /> Add Category
                  </button>
                  <button 
                    onClick={() => setShowSyncConfirm(true)}
                    disabled={isGeneratingCategories}
                    className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isGeneratingCategories ? "Migrating..." : "Sync from Constants"}
                  </button>
                </div>
              </div>

              {categories.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <Tag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">No categories found in Firestore.</p>
                  <p className="text-xs text-slate-400 mt-1">Click "Sync from Constants" to populate the database.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories.map((cat: any) => (
                    <div key={cat.docId || cat.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-2xl">
                          {cat.icon}
                        </div>
                        <div className="flex items-center gap-1 transition-opacity">
                          <button 
                            onClick={() => {
                              setEditingCategory(cat);
                              setCatName(cat.name);
                              setCatIcon(cat.icon);
                              setCatSubcategories(cat.subcategories || []);
                              setShowCategoryModal(true);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => setDeleteConfirm({ id: cat.docId, name: cat.name })}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      <h4 className="font-bold text-slate-900 text-lg">{cat.name}</h4>
                      <p className="text-xs text-slate-500 mt-1 font-medium">{cat.subcategories?.length || 0} subcategories</p>
                      
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {(expandedCategories.includes(cat.docId) ? cat.subcategories : cat.subcategories?.slice(0, 5)).map((sub: string, i: number) => (
                          <span key={`${cat.docId}-sub-${i}`} className="text-[10px] px-2 py-0.5 bg-slate-50 text-slate-600 rounded-md border border-slate-100">
                            {sub}
                          </span>
                        ))}
                        {cat.subcategories?.length > 5 && (
                          <button 
                            onClick={() => {
                              if (expandedCategories.includes(cat.docId)) {
                                setExpandedCategories(expandedCategories.filter(id => id !== cat.docId));
                              } else {
                                setExpandedCategories([...expandedCategories, cat.docId]);
                              }
                            }}
                            className="text-[10px] px-2 py-0.5 bg-slate-50 hover:bg-slate-100 text-slate-500 font-bold rounded-md border border-slate-100 transition-colors"
                          >
                            {expandedCategories.includes(cat.docId) ? "Show Less" : `+${cat.subcategories.length - 5} more`}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "settings" && tempConfig && (
            <div className="p-6 space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Platform Configuration</h3>
                  <p className="text-sm text-slate-500">Manage fees, tiers, and global system settings.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button 
                    onClick={syncWithUnifiedPricing}
                    className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-blue-100 transition-all border border-blue-100 whitespace-nowrap"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Sync with Unified Pricing
                  </button>
                  <button 
                    onClick={handleSaveSettings}
                    disabled={isSavingSettings}
                    className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg disabled:opacity-50"
                  >
                    {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                    Save Changes
                  </button>
                </div>
              </div>

              <div className="p-8 bg-blue-50/30 rounded-[32px] border border-blue-100 border-dashed flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-6 text-left">
                  <div className="w-16 h-16 rounded-3xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xl shadow-blue-100">
                    <DollarSign className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-900 mb-1">Monetization Settings Moved</h4>
                    <p className="text-sm text-slate-500 max-w-lg">To provide a more comprehensive overview and easier management, all subscription tiers and paywall controls have been relocated.</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleTabChange("monetization")}
                  className="shrink-0 inline-flex items-center gap-2 bg-white px-6 py-3 rounded-2xl border border-slate-200 text-slate-900 font-bold text-sm hover:border-blue-600 hover:text-blue-600 transition-all shadow-sm group"
                >
                  Open Tiers Tab
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  {/* Referral Program */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Referral Program</h4>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Referral Boost Duration (Days)</label>
                        <div className="relative">
                          <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            type="number"
                            value={tempConfig.referralBoostDays || 7}
                            onChange={(e) => setTempConfig({ ...tempConfig, referralBoostDays: parseInt(e.target.value) })}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white transition-all font-bold text-slate-900"
                          />
                        </div>
                        <p className="text-[10px] text-slate-500">Duration of profile boost and priority job offers for referrers.</p>
                      </div>
                    </div>
                  </div>

                  {/* Onboarding Restrictions */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Onboarding Restrictions</h4>
                      <button 
                        onClick={() => setTempConfig({ ...tempConfig, onboardingRestrictionsEnabled: !tempConfig.onboardingRestrictionsEnabled })}
                        className={cn(
                          "w-12 h-6 rounded-full relative transition-all",
                          tempConfig.onboardingRestrictionsEnabled ? "bg-blue-600" : "bg-slate-200"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                          tempConfig.onboardingRestrictionsEnabled ? "right-1" : "left-1"
                        )} />
                      </button>
                    </div>
                    
                    {tempConfig.onboardingRestrictionsEnabled && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Allowed Postcodes</label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {(tempConfig.allowedPostcodes || []).map((p: string, pIdx: number) => (
                              <div key={`${p}-${pIdx}`} className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-xs font-bold">
                                {p}
                                <button onClick={() => setTempConfig({ ...tempConfig, allowedPostcodes: tempConfig.allowedPostcodes.filter((pc: string) => pc !== p) })}>
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              value={newPostcode}
                              onChange={(e) => setNewPostcode(e.target.value.toUpperCase())}
                              className="flex-1 p-3 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white transition-all font-mono text-sm text-slate-900"
                              placeholder="e.g. SW1A"
                            />
                            <button 
                              onClick={() => {
                                if (newPostcode && !tempConfig.allowedPostcodes?.includes(newPostcode)) {
                                  setTempConfig({ ...tempConfig, allowedPostcodes: [...(tempConfig.allowedPostcodes || []), newPostcode] });
                                  setNewPostcode("");
                                }
                              }}
                              className="bg-blue-600 text-white px-4 rounded-xl font-bold text-sm hover:bg-blue-700"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Enter letters only (e.g. <span className="font-bold text-slate-700">B</span>) for a whole city, or letters + numbers (e.g. <span className="font-bold text-slate-700">B1</span>) for a specific district.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Trust & Fairness Engine */}
                  <div id="fairness-engine" className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6 scroll-mt-20">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-500" />
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Trust & Fairness Engine</h4>
                    </div>

                    <div className="space-y-6">
                      {/* Serial Complainer Protection */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-slate-900">Serial Complainer Protection</p>
                            <p className="text-[10px] text-slate-500">Reduce the weight of reviews from users who consistently leave low ratings.</p>
                          </div>
                          <button 
                            onClick={() => setTempConfig({ ...tempConfig, fairness_serialComplainerProtection: tempConfig.fairness_serialComplainerProtection === false ? true : false })}
                            className={cn(
                              "w-12 h-6 rounded-full relative transition-all shrink-0",
                              tempConfig.fairness_serialComplainerProtection !== false ? "bg-emerald-500" : "bg-slate-200"
                            )}
                          >
                            <div className={cn(
                              "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                              tempConfig.fairness_serialComplainerProtection !== false ? "right-1" : "left-1"
                            )} />
                          </button>
                        </div>
                        {tempConfig.fairness_serialComplainerProtection !== false && (
                          <div className="bg-slate-50 p-4 rounded-xl space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Average Rating Threshold</label>
                            <div className="flex items-center gap-3">
                              <input 
                                type="number"
                                step="0.1"
                                min="1"
                                max="5"
                                value={tempConfig.fairness_complainerThreshold || 2.5}
                                onChange={(e) => setTempConfig({ ...tempConfig, fairness_complainerThreshold: parseFloat(e.target.value) })}
                                className="w-24 px-4 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 text-sm font-bold text-slate-900"
                              />
                              <span className="text-xs text-slate-500">stars or lower</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Newcomer Boost */}
                      <div className="space-y-3 pt-4 border-t border-slate-100">
                        <div>
                          <p className="text-sm font-bold text-slate-900">Newcomer Boost</p>
                          <p className="text-[10px] text-slate-500">Give new tradespeople a temporary visibility boost to help them win their first jobs.</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Boost Duration (Days)</label>
                          <input 
                            type="number"
                            min="0"
                            value={tempConfig.fairness_newcomerBoostDays || 30}
                            onChange={(e) => setTempConfig({ ...tempConfig, fairness_newcomerBoostDays: parseInt(e.target.value) })}
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 text-sm font-bold text-slate-900"
                          />
                        </div>
                      </div>

                      {/* Fair Job Distribution */}
                      <div className="space-y-3 pt-4 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-slate-900">Fair Job Distribution</p>
                            <p className="text-[10px] text-slate-500">Prioritize tradespeople in AI recommendations who haven't won a job recently.</p>
                          </div>
                          <button 
                            onClick={() => setTempConfig({ ...tempConfig, fairness_jobDistribution: tempConfig.fairness_jobDistribution === false ? true : false })}
                            className={cn(
                              "w-12 h-6 rounded-full relative transition-all shrink-0",
                              tempConfig.fairness_jobDistribution !== false ? "bg-emerald-500" : "bg-slate-200"
                            )}
                          >
                            <div className={cn(
                              "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                              tempConfig.fairness_jobDistribution !== false ? "right-1" : "left-1"
                            )} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* System Status & Maintenance */}
                  <div id="maintenance-control" className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6 scroll-mt-20">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">System Status & Maintenance</h4>
                    
                    <div className="space-y-4">
                      {/* Maintenance Mode */}
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", tempConfig.maintenanceMode ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600")}>
                            <Lock className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">Maintenance Mode</p>
                            <p className="text-[10px] text-slate-500">{tempConfig.maintenanceMode ? "Platform is offline" : "Platform is live"}</p>
                          </div>
                        </div>
                        <button 
                          onClick={handleToggleMaintenance}
                          className={cn(
                            "w-12 h-6 rounded-full relative transition-all",
                            tempConfig.maintenanceMode ? "bg-red-600" : "bg-slate-200"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                            tempConfig.maintenanceMode ? "right-1" : "left-1"
                          )} />
                        </button>
                      </div>

                      {/* Scheduled Maintenance Toggle */}
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", tempConfig.scheduledMaintenance?.enabled ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-400")}>
                            <Calendar className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">Scheduled Maintenance</p>
                            <p className="text-[10px] text-slate-500">{tempConfig.scheduledMaintenance?.enabled ? "Scheduled ahead" : "Not scheduled"}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setTempConfig({ 
                            ...tempConfig, 
                            scheduledMaintenance: { 
                              ...tempConfig.scheduledMaintenance, 
                              enabled: !tempConfig.scheduledMaintenance?.enabled 
                            } 
                          })}
                          className={cn(
                            "w-12 h-6 rounded-full relative transition-all",
                            tempConfig.scheduledMaintenance?.enabled ? "bg-amber-500" : "bg-slate-200"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                            tempConfig.scheduledMaintenance?.enabled ? "right-1" : "left-1"
                          )} />
                        </button>
                      </div>

                      {tempConfig.scheduledMaintenance?.enabled && (
                        <div className="pt-4 space-y-4 border-t border-slate-100">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Maintenance Time</label>
                            <div className="relative">
                              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input 
                                type="text"
                                value={tempConfig.scheduledMaintenance?.time || ""}
                                onChange={(e) => setTempConfig({
                                  ...tempConfig,
                                  scheduledMaintenance: { ...tempConfig.scheduledMaintenance, time: e.target.value }
                                })}
                                placeholder="e.g. Monday 14th April, 2:00 PM"
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-600/10 focus:border-amber-600 transition-all text-sm font-medium bg-slate-50 focus:bg-white"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Announcement Message</label>
                            <textarea 
                              value={tempConfig.scheduledMaintenance?.message || ""}
                              onChange={(e) => setTempConfig({
                                ...tempConfig,
                                scheduledMaintenance: { ...tempConfig.scheduledMaintenance, message: e.target.value }
                              })}
                              rows={3}
                              placeholder="Message to show to users..."
                              className="w-full px-4 py-3 rounded-xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-600/10 focus:border-amber-600 transition-all text-sm font-medium bg-slate-50 focus:bg-white resize-none"
                            />
                            <p className="text-[10px] text-slate-500 italic mt-1">
                              This will show a dismissible banner to all users on their dashboard.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Last Updated</span>
                        <span className="font-bold text-slate-900">
                          {platformConfig?.updatedAt ? new Date(platformConfig.updatedAt.seconds * 1000).toLocaleString() : "Never"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Updated By</span>
                        <span className="font-bold text-slate-900">
                          {platformConfig?.maintenanceModeUpdatedBy || "System"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* AI Global Settings */}
                  <div id="ai-model-control" className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6 scroll-mt-20">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 px-1">
                        <Cpu className="w-4 h-4" /> AI Platform Configuration
                      </h4>
                      <button
                        onClick={handleGenerateAiRecommendations}
                        disabled={isGeneratingAiRecs}
                        className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isGeneratingAiRecs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Ask AI for Model Suggestions
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50 space-y-4">
                        <div>
                          <label className="text-sm font-bold text-slate-900 block mb-2">Default Gemini Model</label>
                          <select 
                            value={tempConfig.aiModel || "gemini-2.5-flash"}
                            onChange={(e) => setTempConfig({...tempConfig, aiModel: e.target.value})}
                            className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-colors"
                          >
                            <option value="gemini-1.5-flash">Gemini 1.5 Flash (Legacy Fast)</option>
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash (Current Fast)</option>
                            <option value="gemini-2.5-pro">Gemini 2.5 Pro (Advanced)</option>
                            <option value="gemini-3-flash-preview">Gemini 3 Flash Preview (Beta)</option>
                          </select>
                          <p className="text-[10px] text-slate-500 mt-2">
                            Controls the master language model for quoting, parsing, and moderation.
                          </p>
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-slate-900">AI Budget Tracker</p>
                            <p className="text-[10px] text-slate-500">Alert admins when approaching cost limits</p>
                          </div>
                          <button 
                            onClick={() => setTempConfig({...tempConfig, aiBudgetEnabled: !tempConfig.aiBudgetEnabled})}
                            className={cn(
                              "w-10 h-5 rounded-full relative transition-all",
                              tempConfig.aiBudgetEnabled ? "bg-blue-600" : "bg-slate-200"
                            )}
                          >
                            <div className={cn(
                              "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all",
                              tempConfig.aiBudgetEnabled ? "right-0.5" : "left-0.5"
                            )} />
                          </button>
                        </div>

                        {tempConfig.aiBudgetEnabled && (
                          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/50">
                            <div>
                              <label className="text-xs font-bold text-slate-700 block mb-1">Monthly Limit (£)</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">£</span>
                                <input 
                                  type="number"
                                  placeholder="200"
                                  value={tempConfig.aiBudgetLimit || ""}
                                  onChange={(e) => setTempConfig({...tempConfig, aiBudgetLimit: Number(e.target.value)})}
                                  className="w-full bg-white border-2 border-slate-200 rounded-xl py-2 pl-7 pr-3 text-sm focus:border-blue-500 outline-none transition-colors"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-700 block mb-1">Current Spend (£)</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">£</span>
                                <input 
                                  type="number"
                                  placeholder="0"
                                  value={tempConfig.aiCurrentSpend || ""}
                                  onChange={(e) => setTempConfig({...tempConfig, aiCurrentSpend: Number(e.target.value)})}
                                  className="w-full bg-white border-2 border-slate-200 rounded-xl py-2 pl-7 pr-3 text-sm focus:border-blue-500 outline-none transition-colors"
                                />
                              </div>
                              <p className="text-[9px] text-slate-400 mt-1 pl-1">For demo: Sync manual API billing here.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

              </div>
              
              {/* Global Master Command Center */}
                  <div id="quick-actions" className="bg-white/95 backdrop-blur-2xl p-8 sm:p-10 rounded-[48px] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.1)] space-y-10 scroll-mt-20 border border-slate-200/60 overflow-hidden relative group">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">Master Command Center</h4>
                        </div>
                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">Administrative Data oversight & specialized global exports</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="px-4 py-2 bg-slate-100 rounded-2xl border border-slate-200/50 flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span className="text-[10px] font-black text-slate-600 uppercase">Superuser Mode</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 relative z-10">
                      {/* Left Column: System & Compliance */}
                      <div className="space-y-8">
                        <div className="space-y-5">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-2">
                            <Settings2 className="w-3 h-3" /> System Health
                          </p>
                          <div className="grid grid-cols-2 gap-4">
                            <button 
                              onClick={() => {
                                showToast("Cache Cleared", "Platform data has been force-refreshed.", "success");
                                setTimeout(() => window.location.reload(), 1500);
                              }}
                              className="flex flex-col items-center gap-3 p-6 bg-slate-50 hover:bg-white hover:shadow-xl hover:shadow-blue-500/10 rounded-3xl transition-all group border border-slate-100"
                            >
                              <div className="w-12 h-12 rounded-[20px] bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                                <RefreshCw className="w-6 h-6" />
                              </div>
                              <span className="text-xs font-black text-slate-700">Purge Cache</span>
                            </button>

                            <button 
                              onClick={() => setShowFlushLogsModal(true)}
                              className="flex flex-col items-center gap-3 p-6 bg-slate-50 hover:bg-white hover:shadow-xl hover:shadow-red-500/10 rounded-3xl transition-all group border border-slate-100"
                            >
                              <div className="w-12 h-12 rounded-[20px] bg-red-50 flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform">
                                <Trash2 className="w-6 h-6" />
                              </div>
                              <span className="text-xs font-black text-slate-700">Flush Logs</span>
                            </button>
                          </div>
                        </div>

                        <div className="space-y-5">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-2">
                            <BarChart3 className="w-3 h-3" /> Specialized Reporting
                          </p>
                          <div className="space-y-3">
                            <button 
                              onClick={() => exportDisputesCSV()}
                              className="w-full flex items-center justify-between p-5 bg-indigo-50 hover:bg-white hover:shadow-xl hover:shadow-indigo-500/10 rounded-3xl transition-all group border border-indigo-100/50"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-50">
                                  <AlertTriangle className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                  <p className="text-sm font-black text-indigo-900">Legal & Disputes</p>
                                  <p className="text-[9px] text-indigo-500 font-bold uppercase">Mediation outcomes & case history</p>
                                </div>
                              </div>
                              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white scale-0 group-hover:scale-100 transition-all shadow-lg shadow-indigo-200">
                                <Download className="w-4 h-4" />
                              </div>
                            </button>

                            <button 
                              onClick={() => exportEcosystemCSV()}
                              className="w-full flex items-center justify-between p-5 bg-emerald-50 hover:bg-white hover:shadow-xl hover:shadow-emerald-500/10 rounded-3xl transition-all group border border-emerald-100/50"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-50">
                                  <Globe className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                  <p className="text-sm font-black text-emerald-900">Ecosystem Growth</p>
                                  <p className="text-[9px] text-emerald-500 font-bold uppercase">Referral metrics & verified users</p>
                                </div>
                              </div>
                              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white scale-0 group-hover:scale-100 transition-all shadow-lg shadow-emerald-200">
                                <Download className="w-4 h-4" />
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Dynamic Data Hub */}
                      <div className="space-y-8">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-2">
                          <Database className="w-3 h-3" /> Database Extraction (CSV)
                        </p>
                        
                        <div className="space-y-6">
                          {/* Export Users Segment */}
                          <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 space-y-5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-slate-900 uppercase tracking-widest">User Database</span>
                              <button 
                                onClick={() => exportUsersCSV()}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black rounded-xl transition-all shadow-lg shadow-blue-200 active:scale-95"
                              >
                                Export Full DB
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <select 
                                value={exportRole}
                                onChange={(e) => setExportRole(e.target.value)}
                                className="flex-1 bg-white border border-slate-200 text-slate-900 text-xs font-bold rounded-2xl px-5 py-3 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-600 outline-none appearance-none cursor-pointer shadow-sm"
                              >
                                <option value="homeowner">🏡 Homeowners</option>
                                <option value="tradesperson">🛠️ Tradespeople</option>
                                <option value="business">🏢 Business Partners</option>
                                <option value="admin">👮 Staff Members</option>
                              </select>
                              <button 
                                onClick={() => exportUsersCSV(exportRole)}
                                className="w-12 h-12 flex items-center justify-center bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-2xl transition-all border border-blue-100 active:scale-90"
                              >
                                <Download className="w-5 h-5" />
                              </button>
                            </div>
                          </div>

                          {/* Export Jobs Segment */}
                          <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 space-y-5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Marketplace History</span>
                              <button 
                                onClick={() => exportJobsCSV()}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black rounded-xl transition-all shadow-lg shadow-purple-200 active:scale-95"
                              >
                                Export Jobs
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <select 
                                value={exportCategory}
                                onChange={(e) => setExportCategory(e.target.value)}
                                className="flex-1 bg-white border border-slate-200 text-slate-900 text-xs font-bold rounded-2xl px-5 py-3 focus:ring-4 focus:ring-purple-500/5 focus:border-purple-600 outline-none appearance-none cursor-pointer shadow-sm"
                              >
                                {TRADE_CATEGORIES.map(cat => (
                                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                                ))}
                              </select>
                              <button 
                                onClick={() => exportJobsCSV(exportCategory)}
                                className="w-12 h-12 flex items-center justify-center bg-purple-50 hover:bg-purple-600 text-purple-600 hover:text-white rounded-2xl transition-all border border-purple-100 active:scale-90"
                              >
                                <Download className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
                       <div className="flex items-center gap-3">
                         <div className="flex -space-x-2">
                            {[1,2,3].map(i => (
                              <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-200" />
                            ))}
                         </div>
                         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Auto-purging inactive accounts</p>
                       </div>
                       
                       <div className="flex items-center gap-6">
                         <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                           <Shield className="w-4 h-4 text-slate-300" /> Secure Protocol v4.2
                         </div>
                         <div className="px-4 py-2 bg-slate-900 rounded-2xl text-[10px] font-black text-white uppercase tracking-[0.2em] shadow-lg shadow-slate-200">
                           System Active
                         </div>
                       </div>
                    </div>

                    {/* Background Decorative Gradient to fix overlapping & improve focus */}
                    <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500/5 blur-[120px] rounded-full pointer-events-none group-hover:bg-blue-500/10 transition-colors" />
                    <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-500/5 blur-[120px] rounded-full pointer-events-none group-hover:bg-purple-500/10 transition-colors" />
                  </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Bulk Delete Confirmation Modal */}
    <AnimatePresence>
      {showBulkDeleteModal && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-100"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Bulk Delete Users</h3>
                <p className="text-sm text-slate-500">This action is irreversible.</p>
              </div>
            </div>
            
            <p className="text-slate-600 mb-8">
              Are you sure you want to permanently delete <span className="font-bold text-slate-900">{selectedUserIds.length}</span> selected user accounts? All associated data will be removed.
            </p>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleBulkDelete}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete {selectedUserIds.length} Users
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Guest Delete Confirmation Modal */}
    <AnimatePresence>
      {showGuestDeleteModal && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-100"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Delete All Guests</h3>
                <p className="text-sm text-slate-500">This action is irreversible.</p>
              </div>
            </div>
            
            <p className="text-slate-600 mb-8">
              Are you sure you want to permanently delete <span className="font-bold text-slate-900">{filteredGuestUsers.length}</span> guest accounts? All associated data will be removed.
            </p>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowGuestDeleteModal(false)}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteAllGuests}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete {filteredGuestUsers.length} Guests
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Flush Logs Confirmation Modal */}
    <AnimatePresence>
      {showFlushLogsModal && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-100"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Flush Audit Logs</h3>
                <p className="text-sm text-slate-500">This action is irreversible.</p>
              </div>
            </div>
            
            <p className="text-slate-600 mb-8">
              Are you sure you want to permanently delete <span className="font-bold text-slate-900">ALL</span> audit logs? This will remove the entire history of administrative actions.
            </p>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowFlushLogsModal(false)}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleFlushAuditLogs}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Flush All Logs
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] px-4 w-full max-w-sm"
          >
            <div className={cn(
              "flex items-center gap-3 p-4 rounded-2xl shadow-xl border",
              toastMessage.type === "success" ? "bg-green-50 border-green-100 text-green-800" : "bg-red-50 border-red-100 text-red-800"
            )}>
              {toastMessage.type === "success" ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <AlertTriangle className="w-5 h-5 text-red-600" />}
              <div>
                <h4 className="text-sm font-bold">{toastMessage.title}</h4>
                <p className="text-xs opacity-80">{toastMessage.message}</p>
              </div>
              <button 
                onClick={() => setToastMessage(null)}
                className="ml-auto p-1 hover:bg-black/5 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Recommendations Modal */}
      <AnimatePresence>
        {showAiRecsModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">AI Model Recommendations</h3>
                    <p className="text-sm text-slate-500">Suggested configuration based on platform usage</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAiRecsModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              {isGeneratingAiRecs ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  <p className="text-slate-500 text-sm font-bold animate-pulse">Analyzing platform workflows and AI usage patterns...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  {aiRecommendations.map((rec) => (
                    <div key={rec.id} className={cn(
                      "p-5 rounded-2xl border-2 flex flex-col h-full",
                      rec.isRecommended ? "border-blue-500 bg-blue-50/30" : "border-slate-100 bg-white"
                    )}>
                      {rec.isRecommended && (
                        <div className="bg-blue-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full self-start mb-3 inline-block">
                          Recommended
                        </div>
                      )}
                      <h4 className="text-lg font-bold text-slate-900 mb-1">{rec.name}</h4>
                      <p className="text-xs text-slate-500 font-mono mb-4">{rec.id}</p>
                      
                      <div className="space-y-4 flex-1">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Capabilities</p>
                          <p className="text-sm text-slate-700">{rec.capabilities}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cost Profile</p>
                          <p className="text-sm text-slate-700">{rec.costEstimate}</p>
                        </div>
                        <div className="pt-4 border-t border-slate-100/50">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Why this model</p>
                          <p className="text-sm text-slate-600 italic">"{rec.reason}"</p>
                        </div>
                      </div>
                      
                      <div className="mt-6 pt-4 border-t border-slate-100 flex items-end">
                        <button 
                          onClick={() => applyAiModel(rec.id)}
                          className={cn(
                            "w-full py-3 rounded-xl font-bold transition-all",
                            rec.id === tempConfig.aiModel 
                              ? "bg-emerald-100 text-emerald-700 pointer-events-none" 
                              : rec.isRecommended 
                                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200" 
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          )}
                        >
                          {rec.id === tempConfig.aiModel ? "Currently Active" : "Select this model"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete User Modal */}
      <AnimatePresence>
        {userToDelete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-100"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Delete User</h3>
                  <p className="text-sm text-slate-500">This action is irreversible.</p>
                </div>
              </div>
              
              <p className="text-slate-600 mb-8">
                Are you sure you want to permanently delete this user account? All associated data will be removed.
              </p>

              <div className="flex gap-3">
                <button 
                  onClick={() => setUserToDelete(null)}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDeleteUser}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                >
                  Delete User
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Maintenance Confirmation Modal */}
      <AnimatePresence>
        {showMaintenanceConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMaintenanceConfirm(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6"
            >
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto",
                tempConfig.maintenanceMode ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
              )}>
                {tempConfig.maintenanceMode ? <Unlock className="w-8 h-8" /> : <Lock className="w-8 h-8" />}
              </div>
              
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-slate-900">
                  {tempConfig.maintenanceMode ? "Disable Maintenance Mode?" : "Enable Maintenance Mode?"}
                </h3>
                <p className="text-sm text-slate-500">
                  {tempConfig.maintenanceMode 
                    ? "This will bring the platform back online for all users. Are you sure?" 
                    : "This will take the platform offline for all non-admin users. Active sessions may be interrupted."}
                </p>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowMaintenanceConfirm(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmToggleMaintenance}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-bold text-white transition-colors shadow-lg",
                    tempConfig.maintenanceMode ? "bg-green-600 hover:bg-green-700 shadow-green-200" : "bg-red-600 hover:bg-red-700 shadow-red-200"
                  )}
                >
                  {tempConfig.maintenanceMode ? "Bring Online" : "Go Offline"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Monetization Confirmation Modal */}
      <AnimatePresence>
        {showPaywallConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPaywallConfirm(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6"
            >
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto",
                tempConfig.paywallEnabled === false ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
              )}>
                {tempConfig.paywallEnabled === false ? <DollarSign className="w-8 h-8" /> : <Sparkles className="w-8 h-8" />}
              </div>
              
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-slate-900">
                  {tempConfig.paywallEnabled === false ? "Enable Monetization?" : "Switch to BETA Mode?"}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {tempConfig.paywallEnabled === false 
                    ? "Enabling monetization will enforce subscription tiers and job posting limits. Users without active plans will be prompted to upgrade." 
                    : "Switching to BETA mode will disable ALL payment requirements. Every user will have unlimited free access until you re-enable monetization."}
                </p>
                <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Impact Analysis</p>
                  <ul className="text-[11px] text-slate-600 text-left space-y-1 list-disc pl-4">
                    {tempConfig.paywallEnabled === false ? (
                      <>
                        <li>Active subscriptions will be required to post/quote.</li>
                        <li>Job limits and pricing tiers will be strictly enforced.</li>
                        <li>Stripe checkout will be activated for all upgrade actions.</li>
                      </>
                    ) : (
                      <>
                        <li>ALL paywalls will be bypassed globally.</li>
                        <li>Subscription tiers will be visually ignored.</li>
                        <li>Users can post and quote without any lifetime or monthly limits.</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <button 
                  onClick={confirmTogglePaywall}
                  className={cn(
                    "w-full py-4 rounded-2xl font-black text-white transition-colors shadow-lg",
                    tempConfig.paywallEnabled === false ? "bg-blue-600 hover:bg-blue-700 shadow-blue-200" : "bg-amber-500 hover:bg-amber-600 shadow-amber-200"
                  )}
                >
                  {tempConfig.paywallEnabled === false ? "Enable Monetization Now" : "Switch to Free Beta Mode"}
                </button>
                <button 
                  onClick={() => setShowPaywallConfirm(false)}
                  className="w-full py-4 rounded-2xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel & Keep Current Mode
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Management Modal */}
      <AnimatePresence>
        {showCategoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (catName && catIcon) {
                  handleSaveCategory();
                } else {
                  setShowCategoryModal(false);
                }
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-white rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-2xl font-black text-slate-900">
                    {editingCategory ? "Edit Category" : "Add New Category"}
                  </h3>
                  <p className="text-sm text-slate-500">Define trade category and its sub-specialties.</p>
                </div>
                <button 
                  onClick={() => {
                    if (catName && catIcon) {
                      handleSaveCategory();
                    } else {
                      setShowCategoryModal(false);
                    }
                  }} 
                  className="p-2 hover:bg-white rounded-xl transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-3 space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Category Name</label>
                    <input 
                      type="text" 
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
                      placeholder="e.g. Plumbing"
                      className="w-full px-4 py-3 rounded-xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Icon</label>
                    <input 
                      type="text" 
                      value={catIcon}
                      onChange={(e) => setCatIcon(e.target.value)}
                      placeholder="🔧"
                      className="w-full px-4 py-3 rounded-xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 transition-all text-center text-xl"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    Subcategories
                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">{catSubcategories.length} Total</span>
                  </label>
                  
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newSubcategory}
                      onChange={(e) => setNewSubcategory(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), newSubcategory && (setCatSubcategories([...catSubcategories, newSubcategory]), setNewSubcategory("")))}
                      placeholder="Add subcategory..."
                      className="flex-1 px-4 py-2 rounded-xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 transition-all text-sm"
                    />
                    <button 
                      onClick={() => newSubcategory && (setCatSubcategories([...catSubcategories, newSubcategory]), setNewSubcategory(""))}
                      className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {catSubcategories.map((sub, index) => (
                      <span key={index} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-700 rounded-xl border border-slate-100 text-sm group">
                        {sub}
                        {deleteSubcategoryConfirm === index ? (
                          <div className="flex items-center gap-2 ml-2 border-l border-slate-200 pl-2">
                            <button 
                              onClick={() => {
                                setCatSubcategories(catSubcategories.filter((_, i) => i !== index));
                                setDeleteSubcategoryConfirm(null);
                              }}
                              className="text-xs font-bold text-red-600 hover:text-red-700"
                            >
                              Delete
                            </button>
                            <button 
                              onClick={() => setDeleteSubcategoryConfirm(null)}
                              className="text-xs text-slate-400 hover:text-slate-600"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setDeleteSubcategoryConfirm(index)}
                            className="text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    ))}
                    {catSubcategories.length === 0 && (
                      <p className="text-xs text-slate-400 italic py-2">No subcategories added yet.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-50 flex items-center justify-end gap-3">
                <button 
                  onClick={() => setShowCategoryModal(false)}
                  className="px-6 py-3 rounded-xl font-bold text-sm text-slate-500 hover:bg-white transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveCategory}
                  disabled={isSavingCategory}
                  className="flex items-center gap-2 bg-slate-900 text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg disabled:opacity-50"
                >
                  {isSavingCategory ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {editingCategory ? "Update Category" : "Create Category"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-white rounded-[32px] overflow-hidden shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Delete Category?</h3>
              <p className="text-slate-500 text-sm mb-8">
                Are you sure you want to delete <span className="font-bold text-slate-900">"{deleteConfirm.name}"</span>? This action cannot be undone.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => handleDeleteCategory(deleteConfirm.id, deleteConfirm.name)}
                  className="w-full py-4 rounded-2xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                >
                  Yes, Delete Category
                </button>
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="w-full py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sync Confirmation Modal */}
      <AnimatePresence>
        {showSyncConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isGeneratingCategories) {
                  setShowSyncConfirm(false);
                  setSyncConfirmText("");
                }
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-2xl p-8"
            >
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2 text-center">Sync Categories?</h3>
              <p className="text-slate-500 text-sm mb-6 text-center">
                This will synchronize all <span className="font-bold text-slate-900">64 default categories</span> from the system constants. It will update existing ones and add any missing ones.
              </p>
              
              <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">To confirm, type "SYNC" below:</p>
                <input 
                  type="text"
                  value={syncConfirmText}
                  onChange={(e) => setSyncConfirmText(e.target.value)}
                  placeholder="Type SYNC here"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleSyncCategories}
                  disabled={syncConfirmText.toUpperCase() !== "SYNC" || isGeneratingCategories}
                  className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                >
                  {isGeneratingCategories ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  {isGeneratingCategories ? "Synchronizing..." : "Confirm Sync"}
                </button>
                <button 
                  onClick={() => {
                    setShowSyncConfirm(false);
                    setSyncConfirmText("");
                  }}
                  disabled={isGeneratingCategories}
                  className="w-full py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Broadcast Modal */}
      <AnimatePresence>
        {showBroadcastModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBroadcastModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl bg-white rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="p-8 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center">
                      <Megaphone className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900">Create Broadcast</h3>
                      <p className="text-sm text-slate-500">Reach your users with a mass message.</p>
                    </div>
                  </div>
                  <button onClick={() => setShowBroadcastModal(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Broadcast Type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {["announcement", "offer", "greeting", "update"].map(t => (
                          <button 
                            key={t}
                            onClick={() => setBroadcastType(t as any)}
                            className={cn(
                              "p-3 rounded-xl border text-xs font-bold capitalize transition-all",
                              broadcastType === t ? "bg-green-50 border-green-200 text-green-700" : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
                            )}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target Segments</label>
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { id: "homeowners", label: "Homeowners" },
                          { id: "tradespeople", label: "Tradespeople" }
                        ].map(s => (
                          <button 
                            key={s.id}
                            onClick={() => {
                              setBroadcastSegments(prev => {
                                const newSegments = prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id];
                                // Clear trades if tradespeople is deselected
                                if (!newSegments.includes("tradespeople")) {
                                  setBroadcastTrades([]);
                                }
                                return newSegments;
                              });
                            }}
                            className={cn(
                              "p-3 rounded-xl border text-xs font-bold transition-all text-left flex items-center justify-between group",
                              broadcastSegments.includes(s.id) ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-5 h-5 rounded flex items-center justify-center transition-colors",
                                broadcastSegments.includes(s.id) ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-300 group-hover:bg-slate-200"
                              )}>
                                {broadcastSegments.includes(s.id) ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                              </div>
                              {s.label}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {broadcastSegments.includes("tradespeople") && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Specific Trades (Optional)</label>
                        <div className="max-h-48 overflow-y-auto pr-2 space-y-1 custom-scrollbar">
                          {TRADE_CATEGORIES.map(t => (
                            <button 
                              key={t.id}
                              onClick={() => {
                                setBroadcastTrades(prev => 
                                  prev.includes(t.name) ? prev.filter(name => name !== t.name) : [...prev, t.name]
                                );
                              }}
                              className={cn(
                                "w-full p-2 rounded-lg border text-[10px] font-bold transition-all text-left flex items-center justify-between group",
                                broadcastTrades.includes(t.name) ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "w-4 h-4 rounded flex items-center justify-center transition-colors",
                                  broadcastTrades.includes(t.name) ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-300 group-hover:bg-slate-200"
                                )}>
                                  {broadcastTrades.includes(t.name) ? <CheckSquare className="w-2.5 h-2.5" /> : <Square className="w-2.5 h-2.5" />}
                                </div>
                                {t.icon} {t.name}
                              </div>
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-slate-400 italic">Leave empty to target all tradespeople.</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Message Title</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Spring Discount Code!"
                        className="w-full p-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all font-medium"
                        value={broadcastTitle}
                        onChange={(e) => setBroadcastTitle(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Message Content</label>
                        <button 
                          onClick={handleGenerateBroadcastDraft}
                          disabled={isDraftingBroadcast || !broadcastTitle}
                          className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          {isDraftingBroadcast ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                          AI Draft
                        </button>
                      </div>
                      <textarea 
                        placeholder="Write your message here or use AI Draft..."
                        rows={5}
                        className="w-full p-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all font-medium resize-none"
                        value={broadcastContent}
                        onChange={(e) => setBroadcastContent(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={handleSendBroadcast}
                    disabled={!broadcastTitle || !broadcastContent || isBroadcasting}
                    className="w-full bg-green-600 text-white p-5 rounded-2xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-100 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isBroadcasting ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Send className="w-5 h-5" /> Launch Broadcast</>}
                  </button>
                  <p className="text-[10px] text-center text-slate-400">
                    This will send a real-time notification to approximately {
                      users.filter(u => {
                        const segmentMatch = broadcastSegments.includes(u.role);
                        if (!segmentMatch) return false;
                        if (u.role === "tradesperson" && broadcastTrades.length > 0) {
                          return u.trades?.some((t: string) => broadcastTrades.includes(t));
                        }
                        return true;
                      }).length
                    } users.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invite Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInviteModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-white rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="p-8 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                      <UserPlus className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900">Invite Team Member</h3>
                      <p className="text-sm text-slate-500">Grant specific access to platform tools.</p>
                    </div>
                  </div>
                  <button onClick={() => setShowInviteModal(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input 
                        type="email" 
                        placeholder="colleague@tradequote.co.uk"
                        className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all font-medium"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Grant Access To</label>
                    <div className="grid grid-cols-1 gap-3">
                      {PERMISSIONS.map(p => (
                        <button 
                          key={p.id}
                          onClick={() => {
                            setInvitePermissions(prev => 
                              prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                            );
                          }}
                          className={cn(
                            "flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group",
                            invitePermissions.includes(p.id) 
                              ? "bg-blue-50 border-blue-200" 
                              : "bg-white border-slate-100 hover:border-slate-200"
                          )}
                        >
                          <div className={cn(
                            "w-6 h-6 rounded-lg flex items-center justify-center transition-colors",
                            invitePermissions.includes(p.id) ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-300 group-hover:bg-slate-200"
                          )}>
                            {invitePermissions.includes(p.id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                          </div>
                          <div className="flex-1">
                            <p className={cn("text-sm font-bold", invitePermissions.includes(p.id) ? "text-blue-900" : "text-slate-700")}>{p.label}</p>
                            <p className="text-[10px] text-slate-500">{p.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={handleSendInvite}
                    disabled={!inviteEmail || invitePermissions.length === 0 || isInviting}
                    className="w-full bg-blue-600 text-white p-5 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isInviting ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Mail className="w-5 h-5" /> Send Invitation</>}
                  </button>
                  <p className="text-[10px] text-center text-slate-400">
                    The recipient will receive an email to create their account with these permissions.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Key Modal */}
      <AnimatePresence>
        {showKeyModal && editingKey && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                      <Key className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900">Update API Key</h3>
                      <p className="text-xs text-slate-500">{editingKey.label}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowKeyModal(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">API Key Value</label>
                    <input 
                      type="password"
                      placeholder="Enter new key value..."
                      className="w-full p-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all font-mono text-sm"
                      value={editingKey.value}
                      onChange={(e) => setEditingKey({ ...editingKey, value: e.target.value })}
                    />
                  </div>
                  <div className="bg-amber-50 p-4 rounded-2xl flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <p className="text-[10px] text-amber-700 leading-relaxed">
                      Updating this key will affect all platform operations immediately. Ensure the key is valid before saving. Keys are stored securely in Firestore and only accessible to verified administrators.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowKeyModal(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveSecret}
                    disabled={isSavingSecrets}
                    className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                  >
                    {isSavingSecrets ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Key"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Recommendation Modal */}
      <AnimatePresence>
        {userToRecommend && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600">
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900">Manage Recommendations</h3>
                      <p className="text-xs text-slate-500">Promote {userToRecommend.name} in specific categories</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setUserToRecommend(null)}
                    className="p-2 hover:bg-slate-50 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Categories</p>
                  <div className="grid grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                    {categories.map(cat => {
                      const isRecommended = userToRecommend.recommendedCategories?.includes(cat.name);
                      return (
                        <button
                          key={cat.docId || cat.id}
                          onClick={() => handleToggleRecommendation(userToRecommend.id, cat.name)}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-2xl border transition-all text-left",
                            isRecommended 
                              ? "bg-orange-50 border-orange-200 text-orange-700 ring-1 ring-orange-200" 
                              : "bg-slate-50 border-slate-100 text-slate-600 hover:border-slate-200"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{cat.icon}</span>
                            <span className="text-xs font-bold">{cat.name}</span>
                          </div>
                          {isRecommended && <CheckCircle2 className="w-4 h-4" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-2xl flex gap-3">
                  <Info className="w-5 h-5 text-blue-600 shrink-0" />
                  <p className="text-[10px] text-blue-700 leading-relaxed">
                    Recommended tradespeople appear at the top of search results for their selected categories and display a <strong>"Recommended"</strong> badge to homeowners.
                  </p>
                </div>

                <button 
                  onClick={() => setUserToRecommend(null)}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Tier Confirmation Modal */}
      <AnimatePresence>
        {deleteTierConfirm !== null && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100"
            >
              <div className="p-6 border-b border-slate-100 bg-red-50 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Delete Tier</h3>
                  <p className="text-xs text-slate-500">This action cannot be undone.</p>
                </div>
              </div>
              <div className="p-6 space-y-6">
                <p className="text-sm text-slate-600">
                  Are you sure you want to delete the <span className="font-bold text-slate-900">"{tempConfig?.feeTiers[deleteTierConfirm]?.name}"</span> tier?
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setDeleteTierConfirm(null)}
                    className="flex-1 bg-slate-100 text-slate-700 p-4 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      const newTiers = tempConfig.feeTiers.filter((_: any, i: number) => i !== deleteTierConfirm);
                      setTempConfig({ ...tempConfig, feeTiers: newTiers });
                      setEditingTiers(editingTiers.filter(i => i !== deleteTierConfirm).map(i => i > deleteTierConfirm ? i - 1 : i));
                      setDeleteTierConfirm(null);
                    }}
                    className="flex-1 bg-red-600 text-white p-4 rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                  >
                    Delete Tier
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Unsaved Changes Sticky Reminder */}
      <AnimatePresence>
        {hasUnsavedChanges && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 z-50 border border-slate-700"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              <div>
                <p className="font-bold text-sm">Unsaved Tier Changes</p>
                <p className="text-xs text-slate-400">Click "Save Changes" at the top to apply.</p>
              </div>
            </div>
            <button 
              onClick={() => {
                setEditingTiers([]);
                handleSaveSettings();
              }}
              disabled={isSavingSettings}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              Save Now
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </div>
);
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-5 py-3 rounded-2xl text-[13px] font-black transition-all shrink-0 snap-center whitespace-nowrap",
        active 
          ? "bg-slate-900 text-white shadow-xl shadow-slate-200 scale-105" 
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
      )}
    >
      <span className={cn("transition-colors", active ? "text-blue-400" : "text-slate-400")}>{icon}</span>
      {label}
    </button>
  );
}

function StatCard({ label, value, icon, color, onClick }: { 
  label: string, 
  value: string | number, 
  icon: React.ReactNode, 
  color: "blue" | "purple" | "red" | "amber" | "green" | "emerald" | "orange" | "indigo",
  onClick?: () => void
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
    green: "bg-green-50 text-green-600",
    emerald: "bg-emerald-50 text-emerald-600",
    orange: "bg-orange-50 text-orange-600",
    indigo: "bg-indigo-50 text-indigo-600"
  };

  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 transition-all",
        onClick && "cursor-pointer hover:border-blue-200 hover:shadow-md active:scale-95"
      )}
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", colors[color])}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className={cn(
          "font-black text-slate-900",
          typeof value === "string" && value.length > 10 ? "text-xl" : "text-3xl"
        )}>{value}</p>
      </div>
    </div>
  );
}

// Side-by-side comparison card for Monetization Tiers
const TierComparisonCard = ({ tier, type }: { tier: any, type: 'provider' | 'business', key?: any }) => {
  return (
    <div className={cn(
      "p-6 rounded-[32px] border-2 bg-white flex flex-col h-full transition-all hover:shadow-2xl hover:-translate-y-1 group",
      type === 'provider' ? "border-blue-50/50 hover:border-blue-100" : "border-indigo-50/50 hover:border-indigo-100"
    )}>
      <div className="mb-6">
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110",
          type === 'provider' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
        )}>
          {type === 'provider' ? <Star className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
        </div>
        <h4 className="text-xl font-black text-slate-900 leading-tight">{tier.name}</h4>
        <div className="flex items-center gap-2 mt-2">
          <span className={cn(
            "text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter",
            type === 'provider' ? "bg-blue-50 text-blue-600" : "bg-indigo-50 text-indigo-600"
          )}>
            {type === 'provider' ? 'Trade Provider' : 'Business Hirer'}
          </span>
          {tier.price === 0 && (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 uppercase tracking-tighter">
              Free Tier
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-6">
        <div className="space-y-1">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Base Pricing</p>
           <div className="flex items-baseline gap-1">
             <span className="text-2xl font-black text-slate-900">£{tier.price}</span>
             <span className="text-xs font-bold text-slate-400 lowercase">/ {tier.limitPeriod || 'monthly'}</span>
           </div>
        </div>

        <div className="space-y-3">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Key Limits & Perks</p>
           <ul className="space-y-2.5">
             <li className="flex items-start gap-2 text-xs font-bold text-slate-600">
               <div className="w-4 h-4 rounded-full bg-slate-50 flex items-center justify-center shrink-0 mt-0.5">
                 <CheckCircle2 className="w-2.5 h-2.5 text-slate-400" />
               </div>
               {type === 'provider' ? `${tier.maxQuotes} Quotes per cycle` : `${tier.jobPostsLimit} Job posts per cycle`}
             </li>
             {type === 'provider' && (
               <li className="flex items-start gap-2 text-xs font-bold text-slate-600">
                 <div className="w-4 h-4 rounded-full bg-slate-50 flex items-center justify-center shrink-0 mt-0.5">
                   <CheckCircle2 className="w-2.5 h-2.5 text-slate-400" />
                 </div>
                 {tier.maxAcceptedQuotes} Accepted Quotes
               </li>
             )}
             <li className="flex items-start gap-2 text-xs font-bold text-slate-600">
               <div className="w-4 h-4 rounded-full bg-blue-50/50 flex items-center justify-center shrink-0 mt-0.5">
                 <Percent className="w-2.5 h-2.5 text-blue-600" />
               </div>
               {tier.commission}% Platform Commission
             </li>
             {(tier.shopDiscount || 0) > 0 && (
               <li className="flex items-start gap-2 text-xs font-bold text-slate-600">
                 <div className="w-4 h-4 rounded-full bg-orange-50/50 flex items-center justify-center shrink-0 mt-0.5">
                   <ShoppingBag className="w-2.5 h-2.5 text-orange-600" />
                 </div>
                 {tier.shopDiscount}% Shop Discount
               </li>
             )}
             {type === 'business' && tier.hasTeamManagement && (
               <li className="flex items-start gap-2 text-xs font-bold text-slate-600">
                 <div className="w-4 h-4 rounded-full bg-purple-50/50 flex items-center justify-center shrink-0 mt-0.5">
                   <Users className="w-2.5 h-2.5 text-purple-600" />
                 </div>
                 Multi-seat Team Management
               </li>
             )}
             {type === 'provider' && (tier.leadFee || 0) > 0 && (
               <li className="flex items-start gap-2 text-xs font-bold text-slate-600">
                 <div className="w-4 h-4 rounded-full bg-emerald-50/50 flex items-center justify-center shrink-0 mt-0.5">
                   <DollarSign className="w-2.5 h-2.5 text-emerald-600" />
                 </div>
                 £{tier.leadFee} Lead Fee
               </li>
             )}
           </ul>
        </div>

        {tier.description && (
          <div className="pt-4 border-t border-slate-50">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Privileges & Description</p>
             <p className="text-[11px] font-medium text-slate-500 italic leading-relaxed">
               "{tier.description}"
             </p>
          </div>
        )}
      </div>
    </div>
  );
};

function UserIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

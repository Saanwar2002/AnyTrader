import React, { useState, useEffect, lazy, Suspense } from "react";
const AnyTraderAdmin = lazy(() => import("./AnyTraderAdmin"));
const AnyRollerAdmin = lazy(() => import("./AnyRollerAdmin"));
import { useAuth } from "./AuthProvider";
import { cn } from "../lib/utils";
import { Building2, Car, Shield, LogOut, Users, Activity, PoundSterling, Briefcase, Lock, KeyRound, AlertCircle, ArrowLeft, CheckCircle2, Settings, X, Save, Mail, Bell, Plus, Trash2, Globe, Clock, ShieldCheck, Send, Smartphone } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { auth, db, handleFirestoreError, OperationType } from "@/src/firebase";
import { signOut, EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup } from "firebase/auth";
import { collection, doc, onSnapshot, setDoc, getDoc, query, orderBy, limit } from "firebase/firestore";
import {
  MasterAdminAuthConfig,
  DEFAULT_MASTER_ADMIN_CONFIG,
  isAuthorizedAdminEmail,
  dispatchAdminLoginAlert,
  AdminLoginAudit
} from "../services/adminAuthSecurityService";

export default function MasterAdminLayout() {
  const { user, profile } = useAuth();
  
  // Admin auth config state
  const [adminConfig, setAdminConfig] = useState<MasterAdminAuthConfig>(() => {
    try {
      const cached = localStorage.getItem("master_admin_auth_config");
      return cached ? JSON.parse(cached) : DEFAULT_MASTER_ADMIN_CONFIG;
    } catch {
      return DEFAULT_MASTER_ADMIN_CONFIG;
    }
  });

  // Strict admin authorization and custom claim check
  const [hasAdminClaim, setHasAdminClaim] = useState<boolean>(false);
  const [authFresh, setAuthFresh] = useState<boolean>(false);
  const [authTime, setAuthTime] = useState<number>(0);
  const [isCheckingClaims, setIsCheckingClaims] = useState<boolean>(true);

  // Session unlock state based strictly on recent Firebase Auth verification (< 10 minutes)
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [reauthPassword, setReauthPassword] = useState<string>("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isReauthing, setIsReauthing] = useState(false);
  const [shake, setShake] = useState(false);

  // Admin Settings & Security Modal State
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<"emails" | "security_policy" | "alerts" | "audits" | "launch">("launch");

  // Platform Config (Launch Controls) State
  const [platformConfig, setPlatformConfig] = useState<any>({
    taxiPortalMode: "coming_soon",
    taxiComingSoon: true,
    showBookTaxiButton: "coming_soon",
    taxiComingSoonTitle: "Focusing on AnyTrader at Launch",
    taxiComingSoonMessage: "We are currently dedicating 100% of our capacity to onboarding top verified UK tradespeople, homeowners, and landlords on AnyTrader. AnyRoller passenger rides and bulky appliance courier dispatch will unlock in our upcoming phase!"
  });
  const [isSavingPlatformConfig, setIsSavingPlatformConfig] = useState(false);

  // Email management states
  const [primaryEmail, setPrimaryEmail] = useState<string>(adminConfig.primaryAdminEmail || "");
  const [additionalEmails, setAdditionalEmails] = useState<string[]>(adminConfig.additionalAdminEmails || []);
  const [newAdditionalEmail, setNewAdditionalEmail] = useState("");
  const [enableLoginEmailAlert, setEnableLoginEmailAlert] = useState<boolean>(adminConfig.enableLoginEmailAlert ?? true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSaveSuccess, setConfigSaveSuccess] = useState<string | null>(null);
  const [configSaveError, setConfigSaveError] = useState<string | null>(null);

  // Test Alert state
  const [isSendingTestAlert, setIsSendingTestAlert] = useState(false);
  const [testAlertMessage, setTestAlertMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Recent Admin Login Audits state
  const [loginAudits, setLoginAudits] = useState<AdminLoginAudit[]>([]);

  // Tabs: 'super_admin', 'anytrader', 'anyroller'
  const [activePortal, setActivePortal] = useState<"super_admin" | "anytrader" | "anyroller">("anytrader");

  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    totalTraders: 0,
    totalDrivers: 0,
    totalJobs: 0,
    totalRides: 0,
    platformRevenue: 0
  });

  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Check admin claims and session freshness (< 10 minutes)
  useEffect(() => {
    if (!user) {
      setHasAdminClaim(false);
      setIsUnlocked(false);
      setIsCheckingClaims(false);
      return;
    }
    const checkClaimsAndFreshness = async () => {
      try {
        const tokenResult = await user.getIdTokenResult();
        const isAdmin = tokenResult.claims.admin === true || tokenResult.claims.role === "admin" || tokenResult.claims.role === "ecosystem_manager";
        setHasAdminClaim(isAdmin);

        const authTimeSec = Number(tokenResult.claims.auth_time || 0);
        setAuthTime(authTimeSec);
        const nowSec = Math.floor(Date.now() / 1000);
        // Fresh if authenticated in the last 10 minutes (600s)
        const isFresh = authTimeSec > 0 && (nowSec - authTimeSec) < 600;
        setAuthFresh(isFresh);
        if (isFresh && (isAdmin || isAuthorizedAdminEmail(user.email, adminConfig))) {
          setIsUnlocked(true);
        }
      } catch (err) {
        console.warn("Failed to verify admin claims & session freshness:", err);
      } finally {
        setIsCheckingClaims(false);
      }
    };
    checkClaimsAndFreshness();
  }, [user, adminConfig]);

  const isAuthorizedAdmin = (hasAdminClaim || profile?.role === "admin" || profile?.role === "ecosystem_manager" || isAuthorizedAdminEmail(user?.email, adminConfig));

  // Load configured Admin Auth from Firestore or local fallback
  useEffect(() => {
    if (!user) return;

    const unsubAdminConfig = onSnapshot(doc(db, "system_settings", "master_admin_auth"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Partial<MasterAdminAuthConfig>;
        const merged: MasterAdminAuthConfig = {
          primaryAdminEmail: data.primaryAdminEmail || "",
          additionalAdminEmails: Array.isArray(data.additionalAdminEmails) ? data.additionalAdminEmails : [],
          masterPin: "",
          enableLoginEmailAlert: data.enableLoginEmailAlert ?? true,
          alertEmailRecipients: Array.isArray(data.alertEmailRecipients) && data.alertEmailRecipients.length > 0
            ? data.alertEmailRecipients
            : (data.primaryAdminEmail ? [data.primaryAdminEmail] : []),
          lastUpdated: data.lastUpdated,
          updatedBy: data.updatedBy
        };
        setAdminConfig(merged);
        setPrimaryEmail(merged.primaryAdminEmail);
        setAdditionalEmails(merged.additionalAdminEmails);
        setEnableLoginEmailAlert(merged.enableLoginEmailAlert);
        localStorage.setItem("master_admin_auth_config", JSON.stringify(merged));
      }
    }, (err) => {
      console.debug("Admin config listener fallback note:", err);
    });

    return () => unsubAdminConfig();
  }, [user]);

  // Load platform_config / global settings
  useEffect(() => {
    const unsubPlatform = onSnapshot(doc(db, "platform_config", "global"), (docSnap) => {
      if (docSnap.exists()) {
        setPlatformConfig(docSnap.data());
      }
    }, (err) => {
      console.debug("Platform config snapshot note:", err);
    });
    return () => unsubPlatform();
  }, []);

  const handleSavePlatformLaunchConfig = async (newConfig: any) => {
    setIsSavingPlatformConfig(true);
    try {
      await setDoc(doc(db, "platform_config", "global"), newConfig, { merge: true });
      setPlatformConfig(newConfig);
      setConfigSaveSuccess("Taxi launch & 'Coming Soon' settings successfully updated across the platform!");
      setTimeout(() => setConfigSaveSuccess(null), 4000);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, "platform_config/global");
      setConfigSaveError("Failed to update platform launch settings: " + (err.message || "Unknown error"));
    } finally {
      setIsSavingPlatformConfig(false);
    }
  };

  // Load Recent Login Audits
  useEffect(() => {
    if (!isAuthorizedAdmin || !isUnlocked) return;

    try {
      const auditsQuery = query(
        collection(db, "admin_login_audits"),
        orderBy("createdAt", "desc"),
        limit(20)
      );

      const unsubAudits = onSnapshot(auditsQuery, (snapshot) => {
        const docs = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        })) as AdminLoginAudit[];
        setLoginAudits(docs);
      }, (err) => {
        console.debug("Login audits listener note:", err);
      });

      return () => unsubAudits();
    } catch (e) {
      console.debug("Could not query login audits:", e);
    }
  }, [isAuthorizedAdmin, isUnlocked]);

  // Load Super Admin Metrics
  useEffect(() => {
    if (!isAuthorizedAdmin || !isUnlocked || activePortal !== "super_admin") return;

    setLoadingMetrics(true);

    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const users = snapshot.docs.map(d => d.data());
      setMetrics(prev => ({
        ...prev,
        totalUsers: users.length,
        totalTraders: users.filter(u => u.role === "tradesperson").length,
        totalDrivers: users.filter(u => u.services?.includes("Taxi & Transport")).length
      }));
    }, (error) => handleFirestoreError(error, OperationType.GET, "users"));

    const unsubJobs = onSnapshot(collection(db, "jobs"), (snapshot) => {
      setMetrics(prev => ({ ...prev, totalJobs: snapshot.docs.length }));
    }, (error) => handleFirestoreError(error, OperationType.GET, "jobs"));

    const unsubRides = onSnapshot(collection(db, "ride_requests"), (snapshot) => {
      setMetrics(prev => ({ ...prev, totalRides: snapshot.docs.length }));
    }, (error) => handleFirestoreError(error, OperationType.GET, "ride_requests"));

    setLoadingMetrics(false);

    return () => {
      unsubUsers();
      unsubJobs();
      unsubRides();
    };
  }, [activePortal, isAuthorizedAdmin, isUnlocked]);

  const handleLogout = () => {
    sessionStorage.removeItem("admin_login_alert_sent");
    signOut(auth).then(() => {
      window.location.href = "/";
    });
  };

  const handleLockConsole = () => {
    sessionStorage.removeItem("admin_login_alert_sent");
    setIsUnlocked(false);
    setAuthFresh(false);
  };

  const triggerLoginAlertIfNeeded = (emailToAlert: string) => {
    const alertSentForSession = sessionStorage.getItem("admin_login_alert_sent");
    if (!alertSentForSession) {
      sessionStorage.setItem("admin_login_alert_sent", "true");
      if (adminConfig.enableLoginEmailAlert) {
        dispatchAdminLoginAlert({
          adminEmail: emailToAlert,
          pinVerified: true,
          status: "success",
          config: adminConfig
        });
      }
    }
  };

  const handleReauthPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user || !user.email) return;
    if (!reauthPassword.trim()) {
      setAuthError("Please enter your account password to verify your session.");
      return;
    }

    setIsReauthing(true);
    setAuthError(null);
    try {
      const cred = EmailAuthProvider.credential(user.email, reauthPassword.trim());
      await reauthenticateWithCredential(user, cred);
      const tokenResult = await user.getIdTokenResult(true);
      const authTimeSec = Number(tokenResult.claims.auth_time || Math.floor(Date.now() / 1000));
      setAuthTime(authTimeSec);
      setAuthFresh(true);
      setIsUnlocked(true);
      setReauthPassword("");
      triggerLoginAlertIfNeeded(user.email);
    } catch (err: any) {
      if (err?.code === "auth/wrong-password" || err?.code === "auth/invalid-credential") {
        setAuthError("Incorrect password. Re-authentication denied.");
      } else {
        setAuthError(err?.message?.replace(/^Firebase:\s*/, "") || "Re-authentication failed.");
      }
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setIsReauthing(false);
    }
  };

  const handleReauthGoogle = async () => {
    if (!user) return;
    setIsReauthing(true);
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      await reauthenticateWithPopup(user, provider);
      const tokenResult = await user.getIdTokenResult(true);
      const authTimeSec = Number(tokenResult.claims.auth_time || Math.floor(Date.now() / 1000));
      setAuthTime(authTimeSec);
      setAuthFresh(true);
      setIsUnlocked(true);
      if (user.email) {
        triggerLoginAlertIfNeeded(user.email);
      }
    } catch (err: any) {
      setAuthError(err?.message?.replace(/^Firebase:\s*/, "") || "Google re-authentication failed.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setIsReauthing(false);
    }
  };

  const handleSaveAdminEmails = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSaveError(null);
    setConfigSaveSuccess(null);

    const cleanPrimary = primaryEmail.trim().toLowerCase();
    if (!cleanPrimary || !cleanPrimary.includes("@")) {
      setConfigSaveError("Please enter a valid primary admin email address.");
      return;
    }

    setIsSavingConfig(true);
    try {
      const updatedConfig: MasterAdminAuthConfig = {
        ...adminConfig,
        primaryAdminEmail: cleanPrimary,
        additionalAdminEmails: additionalEmails.map(e => e.trim().toLowerCase()).filter(Boolean),
        enableLoginEmailAlert,
        alertEmailRecipients: [cleanPrimary, ...additionalEmails.map(e => e.trim().toLowerCase()).filter(Boolean)],
        lastUpdated: new Date().toISOString(),
        updatedBy: user?.email || cleanPrimary
      };

      await setDoc(doc(db, "system_settings", "master_admin_auth"), updatedConfig, { merge: true });
      localStorage.setItem("master_admin_auth_config", JSON.stringify(updatedConfig));
      setAdminConfig(updatedConfig);
      setConfigSaveSuccess("Admin emails and notification preferences saved successfully!");
      setTimeout(() => setConfigSaveSuccess(null), 4000);
    } catch (err: any) {
      console.error("Failed to save admin config in cloud:", err);
      // Fallback local update
      const updatedConfig: MasterAdminAuthConfig = {
        ...adminConfig,
        primaryAdminEmail: cleanPrimary,
        additionalAdminEmails: additionalEmails.map(e => e.trim().toLowerCase()).filter(Boolean),
        enableLoginEmailAlert,
        alertEmailRecipients: [cleanPrimary, ...additionalEmails.map(e => e.trim().toLowerCase()).filter(Boolean)],
        lastUpdated: new Date().toISOString(),
        updatedBy: user?.email || cleanPrimary
      };
      localStorage.setItem("master_admin_auth_config", JSON.stringify(updatedConfig));
      setAdminConfig(updatedConfig);
      setConfigSaveSuccess("Admin settings updated locally!");
      setTimeout(() => setConfigSaveSuccess(null), 4000);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleAddAdditionalEmail = () => {
    const clean = newAdditionalEmail.trim().toLowerCase();
    if (!clean || !clean.includes("@")) return;
    if (clean === primaryEmail.toLowerCase() || additionalEmails.includes(clean)) {
      setConfigSaveError("This email address is already added.");
      return;
    }
    setAdditionalEmails([...additionalEmails, clean]);
    setNewAdditionalEmail("");
    setConfigSaveError(null);
  };

  const handleRemoveAdditionalEmail = (emailToRemove: string) => {
    setAdditionalEmails(additionalEmails.filter(e => e !== emailToRemove));
  };

  const handleRevokeSession = () => {
    setIsUnlocked(false);
    setAuthFresh(false);
    setShowSecurityModal(false);
  };

  const handleSendTestLoginAlert = async () => {
    setIsSendingTestAlert(true);
    setTestAlertMessage(null);
    try {
      const res = await dispatchAdminLoginAlert({
        adminEmail: user?.email || adminConfig.primaryAdminEmail,
        pinVerified: true,
        status: "success",
        config: adminConfig
      });

      if (res.success) {
        setTestAlertMessage({
          type: "success",
          text: `✓ Test login alert email dispatched to ${adminConfig.primaryAdminEmail} (IP: ${res.clientIp})`
        });
      } else {
        setTestAlertMessage({
          type: "error",
          text: res.error || "Failed to dispatch test alert email"
        });
      }
    } catch (err: any) {
      setTestAlertMessage({
        type: "error",
        text: err.message || "Failed to send test alert"
      });
    } finally {
      setIsSendingTestAlert(false);
      setTimeout(() => setTestAlertMessage(null), 6000);
    }
  };

  // 1. Block unauthorized users completely
  if (!isAuthorizedAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-black shadow-2xl space-y-6">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto text-red-600 border border-red-200">
            <Shield className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Access Restricted</h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              This administrative terminal is restricted exclusively to authorized Master System Administrators.
            </p>
          </div>
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs text-slate-600 space-y-1">
            <p className="font-bold text-slate-800">Current Session:</p>
            <p className="truncate font-mono">{user?.email || "Unauthenticated User"}</p>
          </div>
          <button
            onClick={() => { window.location.href = "/"; }}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-black transition-colors border border-black cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Platform
          </button>
        </div>
      </div>
    );
  }

  // 2. Master Admin Re-Authentication Gate (< 10 minutes session requirement)
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`max-w-md w-full bg-white rounded-3xl p-8 border border-black shadow-2xl space-y-6 relative ${
            shake ? "animate-shake" : ""
          }`}
        >
          <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mx-auto text-white shadow-md">
            <Lock className="w-8 h-8 text-white" />
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Security Gate</span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Admin Re-Authentication</h2>
            <p className="text-slate-500 text-xs font-medium">
              Master admin operations require fresh session authentication (&lt; 10 minutes). Please verify your identity to proceed.
            </p>
          </div>

          {authError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleReauthPassword} className="space-y-4 text-left">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Account Password</label>
              <input
                type="password"
                value={reauthPassword}
                autoFocus
                onChange={(e) => {
                  setReauthPassword(e.target.value);
                  setAuthError(null);
                }}
                placeholder="Enter your account password"
                className="w-full px-4 py-3 bg-slate-50 border border-black rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-black transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isReauthing || !reauthPassword.trim()}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-black transition-colors border border-black disabled:opacity-50 cursor-pointer text-sm"
            >
              <KeyRound className="w-4 h-4" /> {isReauthing ? "Verifying..." : "Verify & Unlock Console"}
            </button>

            <div className="relative my-4 text-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
              <span className="relative bg-white px-2 text-[10px] uppercase font-bold text-slate-400">or</span>
            </div>

            <button
              type="button"
              onClick={handleReauthGoogle}
              disabled={isReauthing}
              className="w-full flex items-center justify-center gap-2 bg-white text-slate-800 font-bold py-3 px-4 rounded-xl hover:bg-slate-50 transition-colors border border-slate-300 disabled:opacity-50 cursor-pointer text-xs"
            >
              <ShieldCheck className="w-4 h-4 text-blue-600" /> Re-Authenticate with Google
            </button>
          </form>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Admin: {user?.email}</span>
            <button onClick={handleLogout} className="text-red-500 hover:underline font-bold cursor-pointer">
              Sign Out
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // 3. Fully Authenticated & Unlocked Master Admin Console
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Universal Top Nav for Portals */}
      <div className="bg-white border-b border-black px-4 h-[calc(4rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] flex items-center justify-between shadow-sm z-50 sticky top-0">
        <div className="flex items-center gap-4 lg:gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-lg tracking-tight text-slate-900 hidden sm:inline-block">AnyEcosystem <span className="font-normal text-slate-500">Admin</span></span>
          </div>

          <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

          {/* Portal Switcher Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setActivePortal("super_admin")}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activePortal === "super_admin" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Super Admin</span>
            </button>
            <button
              onClick={() => setActivePortal("anytrader")}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activePortal === "anytrader" ? "bg-white text-orange-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">AnyTrader Control</span>
            </button>
            <button
              onClick={() => setActivePortal("anyroller")}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activePortal === "anyroller" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Car className="w-4 h-4" />
              <span className="hidden sm:inline">AnyRoller Control</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-right hidden xl:block">
            <p className="text-xs font-bold text-slate-900">{profile?.name || "Master Admin"}</p>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{adminConfig.primaryAdminEmail}</p>
          </div>

          <button 
            onClick={() => {
              setPrimaryEmail(adminConfig.primaryAdminEmail);
              setAdditionalEmails(adminConfig.additionalAdminEmails || []);
              setEnableLoginEmailAlert(adminConfig.enableLoginEmailAlert ?? true);
              setShowSecurityModal(true);
            }} 
            title="Admin Security & Email Settings"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl border border-black shadow-sm transition-all cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-blue-400" />
            <span>Admin Settings</span>
          </button>

          <button 
            onClick={handleLockConsole} 
            title="Lock Console"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <Lock className="w-5 h-5" />
          </button>
          <button 
            onClick={handleLogout} 
            title="Sign Out"
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative flex flex-col">
          {activePortal === "super_admin" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 p-6 lg:p-12 overflow-y-auto"
            >
              <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Super Admin Overview</h2>
                    <p className="text-slate-500 font-medium mt-1">Cross-platform metrics and security controls for AnyTrader and AnyRoller.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setActiveModalTab("emails");
                        setShowSecurityModal(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl border border-black shadow-sm transition-all cursor-pointer"
                    >
                      <Mail className="w-4 h-4 text-blue-600" />
                      <span>Admin Emails ({1 + (adminConfig.additionalAdminEmails?.length || 0)})</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveModalTab("audits");
                        setShowSecurityModal(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl border border-black shadow-sm transition-all cursor-pointer"
                    >
                      <Bell className="w-4 h-4 text-emerald-600" />
                      <span>Login Audits</span>
                    </button>
                  </div>
                </div>

                {loadingMetrics ? (
                  <div className="p-12 text-center text-slate-500 font-medium">Aggregating platform data...</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl border border-black shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Network Users</p>
                        <p className="text-4xl font-black text-slate-900">{metrics.totalUsers}</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                        <Users className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-black shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black text-orange-400 uppercase tracking-widest mb-1">AnyTrader Providers</p>
                        <p className="text-4xl font-black text-orange-600">{metrics.totalTraders}</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                        <Building2 className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-black shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-1">AnyRoller Drivers</p>
                        <p className="text-4xl font-black text-emerald-600">{metrics.totalDrivers}</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <Car className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-black shadow-sm flex items-center justify-between mt-4">
                      <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Jobs Created</p>
                        <p className="text-3xl font-black text-slate-900">{metrics.totalJobs}</p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                        <Briefcase className="w-5 h-5" />
                      </div>
                    </div>
                    
                    <div className="bg-white p-6 rounded-2xl border border-black shadow-sm flex items-center justify-between mt-4">
                      <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Ride Requests</p>
                        <p className="text-3xl font-black text-slate-900">{metrics.totalRides}</p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                        <Activity className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="bg-slate-900 p-6 rounded-2xl shadow-sm flex items-center justify-between mt-4 relative overflow-hidden border border-black">
                      <div className="relative z-10">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Live Platforms</p>
                        <p className="text-3xl font-black text-white">2 Active</p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white relative z-10">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-500/20 rounded-full blur-xl"></div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
          {activePortal === "anytrader" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col"
            >
              <Suspense fallback={<div className="p-12 text-center font-bold text-slate-500">Loading AnyTrader Admin...</div>}>
                <AnyTraderAdmin />
              </Suspense>
            </motion.div>
          )}
          {activePortal === "anyroller" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col h-full bg-slate-50"
            >
              <Suspense fallback={<div className="p-12 text-center font-bold text-slate-500">Loading AnyRoller Admin...</div>}>
                <AnyRollerAdmin />
              </Suspense>
            </motion.div>
          )}
      </div>

      {/* Comprehensive Admin Security & Email Settings Modal */}
      <AnimatePresence>
        {showSecurityModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl rounded-3xl p-6 md:p-8 border-2 border-black shadow-2xl space-y-6 max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 leading-tight">Master Admin Security & Settings</h3>
                    <p className="text-xs text-slate-500">Manage administrator emails, cryptographic re-authentication policies, and login alert notifications</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSecurityModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tab Navigation */}
              <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 shrink-0">
                <button
                  onClick={() => setActiveModalTab("emails")}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeModalTab === "emails"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  <span>Admin Emails</span>
                </button>
                <button
                  onClick={() => setActiveModalTab("security_policy")}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeModalTab === "security_policy"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Session Security</span>
                </button>
                <button
                  onClick={() => setActiveModalTab("alerts")}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeModalTab === "alerts"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Bell className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Login Alerts</span>
                </button>
                <button
                  onClick={() => setActiveModalTab("audits")}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeModalTab === "audits"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-purple-600" />
                  <span>Login Audits ({loginAudits.length})</span>
                </button>
                <button
                  onClick={() => setActiveModalTab("launch")}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeModalTab === "launch"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Car className="w-3.5 h-3.5 text-amber-600" />
                  <span>Launch Controls</span>
                </button>
              </div>

              {/* Status Feedbacks */}
              {configSaveError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{configSaveError}</span>
                </div>
              )}

              {configSaveSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{configSaveSuccess}</span>
                </div>
              )}

              {/* Scrollable Tab Content */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-5">
                {/* TAB 1: ADMIN EMAILS */}
                {activeModalTab === "emails" && (
                  <form onSubmit={handleSaveAdminEmails} className="space-y-5">
                    <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-1">
                      <p className="text-xs font-black text-blue-900">Admin Email Access Control</p>
                      <p className="text-xs text-blue-700 leading-relaxed">
                        Authorized admin emails can authenticate into the Master Admin Console and receive security login alerts. Changes sync across cloud and local storage.
                      </p>
                    </div>

                    {/* Primary Admin Email */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                        <span>Primary Admin Email Address</span>
                        <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Main Recipient</span>
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          value={primaryEmail}
                          onChange={(e) => setPrimaryEmail(e.target.value)}
                          placeholder="e.g. admin@tradequote.uk"
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-black rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-black"
                        />
                      </div>
                    </div>

                    {/* Additional Admin Emails */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-800">
                        Additional Authorized Admin Emails (Optional)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={newAdditionalEmail}
                          onChange={(e) => setNewAdditionalEmail(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddAdditionalEmail();
                            }
                          }}
                          placeholder="Add secondary admin email..."
                          className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-black/30 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-black"
                        />
                        <button
                          type="button"
                          onClick={handleAddAdditionalEmail}
                          className="px-3.5 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl border border-black flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                      </div>

                      {/* List of Additional Emails */}
                      {additionalEmails.length > 0 ? (
                        <div className="space-y-1.5 pt-1">
                          {additionalEmails.map((email) => (
                            <div
                              key={email}
                              className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <Mail className="w-3.5 h-3.5 text-slate-500" />
                                <span className="font-bold text-slate-800 font-mono">{email}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveAdditionalEmail(email)}
                                className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">No secondary admin emails configured.</p>
                      )}
                    </div>

                    {/* Email Login Alert Toggle */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-900">Admin Login Email Alert</p>
                        <p className="text-[11px] text-slate-500">Send an instant alert email each time admin credentials unlock the console.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={enableLoginEmailAlert}
                        onChange={(e) => setEnableLoginEmailAlert(e.target.checked)}
                        className="w-5 h-5 rounded accent-slate-900 cursor-pointer"
                      />
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setShowSecurityModal(false)}
                        className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-200 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingConfig}
                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-black transition-colors border border-black disabled:opacity-50 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {isSavingConfig ? "Saving Changes..." : "Save Admin Settings"}
                      </button>
                    </div>
                  </form>
                )}

                {/* TAB 2: SESSION SECURITY & RE-AUTH POLICIES */}
                {activeModalTab === "security_policy" && (
                  <div className="space-y-5">
                    <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-1">
                      <p className="text-xs font-black text-amber-900">Cryptographic Session Re-Authentication</p>
                      <p className="text-xs text-amber-700 leading-relaxed">
                        Static numeric PINs have been permanently decommissioned. Sensitive administrative actions enforce cryptographic Firebase Auth ID token verification and require fresh re-authentication every 10 minutes.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700">Re-Authentication Policy:</span>
                          <span className="font-bold text-slate-900">10 Minutes (600s) Max Inactivity</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700">Firebase Custom Claim:</span>
                          <span className="font-mono text-emerald-700 font-bold">{hasAdminClaim ? "admin: true (Verified)" : "Pending / Role Fallback"}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700">Token Auth Time:</span>
                          <span className="font-mono text-slate-600">{authTime > 0 ? new Date(authTime * 1000).toLocaleTimeString() : "Recent"}</span>
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-slate-900">Lock Session Immediately</p>
                          <p className="text-[11px] text-slate-500">Forces immediate re-authentication before any further admin actions can be executed.</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleRevokeSession}
                          className="px-3.5 py-2 bg-red-600 text-white font-bold rounded-xl text-xs hover:bg-red-700 transition-colors cursor-pointer"
                        >
                          Lock Session
                        </button>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setShowSecurityModal(false)}
                        className="px-4 py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-black transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 3: LOGIN ALERTS */}
                {activeModalTab === "alerts" && (
                  <div className="space-y-5">
                    <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-1">
                      <p className="text-xs font-black text-emerald-900">Real-Time Admin Login Email Alerts</p>
                      <p className="text-xs text-emerald-700 leading-relaxed">
                        Whenever an administrator signs in or unlocks the Master Admin Console, an instant notification is dispatched containing the login timestamp, device/browser signature, and IP location.
                      </p>
                    </div>

                    {testAlertMessage && (
                      <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                        testAlertMessage.type === "success"
                          ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                          : "bg-red-50 border border-red-200 text-red-600"
                      }`}>
                        {testAlertMessage.type === "success" ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                        )}
                        <span>{testAlertMessage.text}</span>
                      </div>
                    )}

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                        <div>
                          <p className="text-xs font-bold text-slate-900">Alert Destination</p>
                          <p className="text-xs text-slate-500 font-mono">{adminConfig.primaryAdminEmail}</p>
                        </div>
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase rounded-lg">
                          Active Recipient
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <p className="text-xs font-bold text-slate-800">Dispatch Status</p>
                          <p className="text-[11px] text-slate-500">
                            {adminConfig.enableLoginEmailAlert ? "Enabled (Dispatches on each unlock)" : "Muted"}
                          </p>
                        </div>
                        <button
                          onClick={handleSendTestLoginAlert}
                          disabled={isSendingTestAlert}
                          className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl border border-black disabled:opacity-50 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {isSendingTestAlert ? "Dispatching..." : "Send Test Login Alert Email"}
                        </button>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-100 rounded-2xl space-y-2 text-xs text-slate-600">
                      <p className="font-bold text-slate-800">What is included in each email alert:</p>
                      <ul className="list-disc pl-5 space-y-1 text-[11px]">
                        <li>Admin account email address & authenticated session status</li>
                        <li>Exact timestamp (UTC and local device timezone)</li>
                        <li>Client IP address and geographic location lookup</li>
                        <li>Browser user-agent, operating system, and platform signature</li>
                        <li>Cryptographic Firebase Auth token verification status</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* TAB 4: LOGIN AUDITS */}
                {activeModalTab === "audits" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-800">Recent Admin Logins</p>
                        <p className="text-[11px] text-slate-500">Recorded sessions from the audit ledger</p>
                      </div>
                      <span className="text-[10px] font-black bg-slate-100 px-2.5 py-1 rounded-lg text-slate-700">
                        {loginAudits.length} Records
                      </span>
                    </div>

                    {loginAudits.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl">
                        <Shield className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-700">No previous login audits recorded yet</p>
                        <p className="text-[11px] text-slate-500 mt-1">Audit logs will appear here automatically on each session.</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[360px] overflow-y-auto">
                        {loginAudits.map((audit) => (
                          <div
                            key={audit.id || audit.timestamp}
                            className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                <span className="font-bold text-slate-900">{audit.adminEmail}</span>
                              </div>
                              <span className="text-[10px] font-mono text-slate-400">
                                {new Date(audit.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-white p-2 rounded-xl border border-slate-100">
                              <div>
                                <span className="text-slate-400">IP Address: </span>
                                <span className="font-mono font-bold text-blue-600">{audit.ipAddress || "Protected IP"}</span>
                              </div>
                              <div>
                                <span className="text-slate-400">Session Auth: </span>
                                <span className="font-bold text-emerald-600">
                                  {audit.pinVerified ? "✓ Verified" : "Pending"}
                                </span>
                              </div>
                              <div className="col-span-2 truncate">
                                <span className="text-slate-400">Device: </span>
                                <span className="font-mono text-[10px] text-slate-700">{audit.userAgent}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 5: LAUNCH CONTROLS & TAXI TOGGLE */}
                {activeModalTab === "launch" && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <p className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                          <Car className="w-4 h-4 text-amber-500" />
                          "Book Taxi" Tab & AnyRoller Launch Controls
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Configure whether the AnyRoller Taxi tab is visible, active, or greyed out with a "Coming Soon" overlay to concentrate on AnyTrader at launch.
                        </p>
                      </div>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide border",
                        (platformConfig?.taxiPortalMode === "coming_soon" || platformConfig?.taxiComingSoon === true || platformConfig?.showBookTaxiButton === "coming_soon")
                          ? "bg-amber-100 border-amber-300 text-amber-900"
                          : platformConfig?.showBookTaxiButton === false || platformConfig?.taxiPortalMode === "hidden"
                          ? "bg-slate-100 border-slate-300 text-slate-700"
                          : "bg-emerald-100 border-emerald-300 text-emerald-900"
                      )}>
                        {(platformConfig?.taxiPortalMode === "coming_soon" || platformConfig?.taxiComingSoon === true || platformConfig?.showBookTaxiButton === "coming_soon")
                          ? "Coming Soon Mode"
                          : platformConfig?.showBookTaxiButton === false || platformConfig?.taxiPortalMode === "hidden"
                          ? "Hidden"
                          : "Live & Active"}
                      </span>
                    </div>

                    {/* Quick Mode Switcher */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Option 1: Coming Soon (Greyed Out) */}
                      <button
                        type="button"
                        onClick={() => handleSavePlatformLaunchConfig({
                          ...platformConfig,
                          taxiPortalMode: "coming_soon",
                          taxiComingSoon: true,
                          showBookTaxiButton: "coming_soon"
                        })}
                        disabled={isSavingPlatformConfig}
                        className={cn(
                          "p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer",
                          (platformConfig?.taxiPortalMode === "coming_soon" || platformConfig?.taxiComingSoon === true || platformConfig?.showBookTaxiButton === "coming_soon")
                            ? "bg-amber-50 border-black shadow-md ring-2 ring-amber-400/40"
                            : "bg-slate-50 border-slate-200 hover:border-black/50"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-2 py-0.5 bg-amber-500 text-black text-[9px] font-black uppercase rounded-md">
                            Recommended for Launch
                          </span>
                          {(platformConfig?.taxiPortalMode === "coming_soon" || platformConfig?.taxiComingSoon === true || platformConfig?.showBookTaxiButton === "coming_soon") && (
                            <CheckCircle2 className="w-4 h-4 text-amber-700" />
                          )}
                        </div>
                        <p className="text-xs font-black text-black">Coming Soon (Greyed Out)</p>
                        <p className="text-[11px] text-slate-600 mt-1 leading-tight">
                          Button stays visible in header with a "SOON" badge. Clicking opens the "Coming Soon" modal to focus on AnyTrader.
                        </p>
                      </button>

                      {/* Option 2: Live & Active */}
                      <button
                        type="button"
                        onClick={() => handleSavePlatformLaunchConfig({
                          ...platformConfig,
                          taxiPortalMode: "active",
                          taxiComingSoon: false,
                          showBookTaxiButton: true
                        })}
                        disabled={isSavingPlatformConfig}
                        className={cn(
                          "p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer",
                          platformConfig?.taxiPortalMode === "active" || (platformConfig?.showBookTaxiButton === true && !platformConfig?.taxiComingSoon && platformConfig?.taxiPortalMode !== "coming_soon")
                            ? "bg-emerald-50 border-black shadow-md ring-2 ring-emerald-400/40"
                            : "bg-slate-50 border-slate-200 hover:border-black/50"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-2 py-0.5 bg-emerald-600 text-white text-[9px] font-black uppercase rounded-md">
                            Full Ecosystem
                          </span>
                          {(platformConfig?.taxiPortalMode === "active" || (platformConfig?.showBookTaxiButton === true && !platformConfig?.taxiComingSoon && platformConfig?.taxiPortalMode !== "coming_soon")) && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                          )}
                        </div>
                        <p className="text-xs font-black text-black">Live & Active</p>
                        <p className="text-[11px] text-slate-600 mt-1 leading-tight">
                          Full on-demand passenger taxi dispatch and driver terminal active.
                        </p>
                      </button>

                      {/* Option 3: Completely Hidden */}
                      <button
                        type="button"
                        onClick={() => handleSavePlatformLaunchConfig({
                          ...platformConfig,
                          taxiPortalMode: "hidden",
                          taxiComingSoon: false,
                          showBookTaxiButton: false
                        })}
                        disabled={isSavingPlatformConfig}
                        className={cn(
                          "p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer",
                          platformConfig?.taxiPortalMode === "hidden" || (platformConfig?.showBookTaxiButton === false && platformConfig?.taxiPortalMode !== "coming_soon")
                            ? "bg-slate-200 border-black shadow-md ring-2 ring-slate-400/40"
                            : "bg-slate-50 border-slate-200 hover:border-black/50"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-2 py-0.5 bg-slate-700 text-white text-[9px] font-black uppercase rounded-md">
                            Disabled
                          </span>
                          {(platformConfig?.taxiPortalMode === "hidden" || (platformConfig?.showBookTaxiButton === false && platformConfig?.taxiPortalMode !== "coming_soon")) && (
                            <CheckCircle2 className="w-4 h-4 text-slate-800" />
                          )}
                        </div>
                        <p className="text-xs font-black text-black">Completely Hidden</p>
                        <p className="text-[11px] text-slate-600 mt-1 leading-tight">
                          Removes button entirely from header, shows static AnyTrader badge.
                        </p>
                      </button>
                    </div>

                    {/* Custom Coming Soon Text Customizer */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-black flex items-center gap-1.5">
                          <Settings className="w-3.5 h-3.5 text-amber-600" />
                          Custom Coming Soon Overlay Headline & Message
                        </p>
                        <button
                          type="button"
                          onClick={() => handleSavePlatformLaunchConfig(platformConfig)}
                          disabled={isSavingPlatformConfig}
                          className="px-3 py-1 bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-slate-800 cursor-pointer transition-all"
                        >
                          <Save className="w-3.5 h-3.5" />
                          Save Message
                        </button>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">Overlay Headline Title</label>
                        <input
                          type="text"
                          value={platformConfig?.taxiComingSoonTitle || ""}
                          placeholder="Focusing on AnyTrader at Launch"
                          onChange={(e) => setPlatformConfig({ ...platformConfig, taxiComingSoonTitle: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-black/30 rounded-xl text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-black"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">Overlay Description Text</label>
                        <textarea
                          rows={2}
                          value={platformConfig?.taxiComingSoonMessage || ""}
                          placeholder="We are currently dedicating 100% of our capacity to onboarding top verified UK tradespeople, homeowners, and landlords on AnyTrader. AnyRoller passenger rides and bulky appliance courier dispatch will unlock in our upcoming phase!"
                          onChange={(e) => setPlatformConfig({ ...platformConfig, taxiComingSoonMessage: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-black/30 rounded-xl text-xs font-medium text-black focus:outline-none focus:ring-2 focus:ring-black resize-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Suspense } from "react";
import { BrowserRouter, Routes, Route, useNavigate, Navigate, Link } from "react-router-dom";
import { CategoryProvider } from "./lib/CategoryProvider";
import Layout from "./components/Layout";
import { useAuth } from "./components/AuthProvider";
import Login from "./components/Login";
import Onboarding from "./components/Onboarding";
import { Toaster } from "sonner";
import { ReviewReminder } from "./components/ReviewReminder";
import { PlusCircle, Briefcase, MessageSquare, User as UserIcon, Bell, ChevronRight, PoundSterling, Search, Lock, Loader2 } from "lucide-react";
import { db, collection, query, where, onSnapshot, collectionGroup, doc } from "@/src/firebase";

import { registerForPushNotifications } from "./lib/pushNotifications";
import { PortalProvider, usePortal } from "./lib/PortalContext";
import PlatformSwitcher from "./components/shared/PlatformSwitcher";
import { AppUpdateModal } from "./components/common/AppUpdateModal";
import { ShareViewModal } from "./components/ShareViewModal";
import { ShareType } from "./utils/shareUtils";
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Camera } from '@capacitor/camera';
import { initCapacitorKeyboard } from './lib/capacitor';

import Dashboard from "./components/Dashboard";
import TradesDashboard from "./components/TradesDashboard";
import BusinessDashboard from "./components/BusinessDashboard";
import Profile from "./components/Profile";
import FindTrades from "./components/FindTrades";
import PostJobWizard from "./components/PostJobWizard";
import EmergencyJobWizard from "./components/EmergencyJobWizard";
import MyJobs from "./components/MyJobs";
import TradeJobs from "./components/TradeJobs";
import MyQuotes from "./components/MyQuotes";
import Conversations from "./components/Conversations";
import Notifications from "./components/Notifications";
import JobFeed from "./components/JobFeed";
import TraderCalendar from "./components/TraderCalendar";
import Chat from "./components/Chat";
import DriverTerminal from "./components/driver/DriverTerminal";
import PassengerBooking from "./components/passenger/PassengerBooking";

// Lazy loading helper with auto-retry for resilient chunk fetching
function lazyWithRetry<T extends React.ComponentType<any>>(componentImport: () => Promise<{ default: T } | any>) {
  return React.lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      console.warn("Failed to load component dynamically, retrying...", error);
      // Retry once after short delay or force clean reload if module chunk failed
      const key = "vite_lazy_reload";
      const lastReload = sessionStorage.getItem(key);
      if (!lastReload || Date.now() - parseInt(lastReload, 10) > 8000) {
        sessionStorage.setItem(key, Date.now().toString());
        window.location.reload();
      }
      throw error;
    }
  });
}

// Lazy loaded secondary components
const PassengerRideHistory = lazyWithRetry(() => import("./components/passenger/PassengerRideHistory"));
const DriverEarnings = lazyWithRetry(() => import("./components/driver/DriverEarnings"));
const DriverInbox = lazyWithRetry(() => import("./components/driver/DriverInbox"));
const PlatformFeeSuccess = lazyWithRetry(() => import("./components/driver/PlatformFeeSuccess"));
const CorporatePortal = lazyWithRetry(() => import("./components/anyroller/CorporatePortal"));
const GothamHousingPortal = lazyWithRetry(() => import("./components/anytrader/GothamHousingPortal"));
const EcosystemAdmin = lazyWithRetry(() => import("./components/EcosystemAdmin"));
const MasterAdminLayout = lazyWithRetry(() => import("./components/MasterAdminLayout"));
const ReferralTracker = lazyWithRetry(() => import("./components/shared/ReferralTracker"));
const RefRedirect = lazyWithRetry(() => import("./components/shared/ReferralTracker").then(m => ({ default: m.RefRedirect })));
const JobDetails = lazyWithRetry(() => import("./components/JobDetails"));
const JobTimeline = lazyWithRetry(() => import("./components/JobTimeline"));
const PublicProfile = lazyWithRetry(() => import("./components/PublicProfile"));
const Analytics = lazyWithRetry(() => import("./components/Analytics"));
const Availability = lazyWithRetry(() => import("./components/Availability"));
const Portfolio = lazyWithRetry(() => import("./components/Portfolio"));
const TradesBannerAdStudio = lazyWithRetry(() => import("./components/TradesBannerAdStudio"));
const BusinessTeamManagement = lazyWithRetry(() => import("./components/BusinessTeamManagement"));
const BillingManager = lazyWithRetry(() => import("./components/BillingManager"));
const SavedJourneys = lazyWithRetry(() => import("./components/SavedJourneys"));
const RecurringJobManager = lazyWithRetry(() => import("./components/RecurringJobManager").then(m => ({ default: m.RecurringJobManager })));
const AdReport = lazyWithRetry(() => import("./components/AdReport"));
const TraderAdStudio = lazyWithRetry(() => import("./components/TraderAdStudio"));
const TenantReportPortal = lazyWithRetry(() => import("./components/TenantReportPortal").then(m => ({ default: m.TenantReportPortal })));
const PublicPropertyPassportView = lazyWithRetry(() => import("./components/property/PublicPropertyPassportView"));

import SplashScreen from "./components/SplashScreen";

const PageSkeleton = () => (
  <div className="flex h-[50vh] items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
  </div>
);

function IndexRoute() {
  const { activePortal, activeRole } = usePortal();

  if (activeRole === "admin") {
    return <Navigate to="/admin" replace />;
  }

  if (activeRole === "ecosystem_manager") {
    return <Navigate to="/ecosystem" replace />;
  }

  if (activePortal === "anyroller") {
    return activeRole === "driver" ? <Navigate to="/driver-terminal" replace /> : <Navigate to="/book-ride" replace />;
  }

  // AnyTrader context
  if (activeRole === "business") {
    return <BusinessDashboard />;
  }

  if (activeRole === "trader") {
    return <TradesDashboard />;
  }

  return <Dashboard />;
}

function DeepLinkListener() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let isSubscribed = true;

    const setupListener = async () => {
      try {
        const appPkg = '@capacitor/app';
        const { App: CapacitorApp } = (await import(/* @vite-ignore */ appPkg)) as any;

        CapacitorApp.addListener('appUrlOpen', (data: { url: string }) => {
          if (!isSubscribed || !data?.url) return;
          console.log('[DeepLink] App opened with URL:', data.url);

          try {
            let path = '';
            if (data.url.includes('://')) {
              if (data.url.startsWith('anytrader://')) {
                const raw = data.url.replace('anytrader://', '');
                path = raw.startsWith('/') ? raw : '/' + raw;
              } else {
                const urlObj = new URL(data.url);
                path = urlObj.pathname + urlObj.search + urlObj.hash;
              }
            } else {
              path = data.url;
            }

            if (path) {
              console.log('[DeepLink] Navigating directly to path:', path);
              navigate(path);
            }
          } catch (err) {
            console.error('[DeepLink] Error handling deep link URL:', err);
          }
        });
      } catch (err) {
        console.error('[DeepLink] Error registering appUrlOpen listener:', err);
      }
    };

    setupListener();

    return () => {
      isSubscribed = false;
    };
  }, [navigate]);

  return null;
}

function ShareGlobalContainer() {
  const navigate = useNavigate();
  const [shared, setShared] = useState<{ type: ShareType; id: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareType = params.get("shareType") as ShareType | null;
    const shareId = params.get("shareId");

    if (shareType && shareId) {
      setShared({ type: shareType, id: shareId });
    }
  }, []);

  const handleClose = () => {
    setShared(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("shareType");
    url.searchParams.delete("shareId");
    window.history.replaceState({}, "", url.pathname + url.search);
  };

  const handleOpenChat = (recipientId?: string, jobTitle?: string) => {
    if (recipientId) {
      navigate(`/chat?recipientId=${recipientId}&jobTitle=${encodeURIComponent(jobTitle || 'Shared Trade')}`);
    } else {
      navigate('/chat');
    }
  };

  if (!shared) return null;

  return (
    <ShareViewModal
      shareType={shared.type}
      shareId={shared.id}
      onClose={handleClose}
      onOpenChat={handleOpenChat}
    />
  );
}

export default function App() {
  const { user, profile, isAuthReady } = useAuth();
  const [platformConfig, setPlatformConfig] = useState<any>(null);

  useEffect(() => {
    if (!isAuthReady) return;
    const unsub = onSnapshot(doc(db, "platform_config", "global"), (doc) => {
      if (doc.exists()) {
        setPlatformConfig(doc.data());
      }
    }, (error) => {
      console.error("Firestore Platform Config Error:", error);
    });
    
    // Register Push Notification on Auth
    if (user && Capacitor.isNativePlatform()) {
      registerForPushNotifications(user.uid);
    }

    return () => unsub();
  }, [isAuthReady, user]);

  // Native Capacitor plugin initializations (Keyboard, Geolocation, Camera, Microphones)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      // Initialize Capacitor Keyboard resize and scroll behavior
      initCapacitorKeyboard();

      const requestNativePermissions = async () => {
        try {
          // Request Location permission
          await Geolocation.requestPermissions();
        } catch (e) {
          console.error("Error requesting geolocation permission at startup:", e);
        }

        try {
          // Request Camera permission
          await Camera.requestPermissions();
        } catch (e) {
          console.error("Error requesting camera permission at startup:", e);
        }

        try {
          // Request Microphone permission via standard Web API inside WebView
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
          }
        } catch (e) {
          console.error("Error requesting microphone permission at startup:", e);
        }
      };
      // Delay it slightly so it doesn't interrupt immediate rendering
      setTimeout(requestNativePermissions, 1500);
    }
  }, []);

  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        const type = (target as HTMLInputElement).type;
        if (type !== 'checkbox' && type !== 'radio' && type !== 'file' && type !== 'range') {
          // Wait for virtual keyboard to appear and viewport to resize
          setTimeout(() => {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 300);
        }
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, []);

  if (!isAuthReady) return null;

  // Maintenance Mode Check
  const isMaintenanceMode = platformConfig?.maintenanceMode;
  const isAdmin = profile?.role === "admin";

  if (isMaintenanceMode && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-[32px] border border-black shadow-xl text-center space-y-6">
          <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto">
            <Lock className="w-10 h-10 text-red-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-slate-900">System Maintenance</h1>
            <p className="text-slate-500">
              AnyTrader is currently undergoing scheduled maintenance to improve our services. 
              We'll be back online shortly.
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-black">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
            <p className="text-sm font-bold text-slate-700">Offline for Improvements</p>
          </div>
          <p className="text-[10px] text-slate-400">Thank you for your patience.</p>
        </div>
      </div>
    );
  }

  return (
    <CategoryProvider>
      <Toaster 
        position="top-center" 
        richColors 
        style={{ marginTop: 'max(env(safe-area-inset-top), 48px)' }}
      />
      <BrowserRouter>
        <SplashScreen />
        <AppUpdateModal platformConfig={platformConfig} />
        <DeepLinkListener />
        <ShareGlobalContainer />
        <ReferralTracker />
        <PortalProvider>
          <PlatformSwitcher />
          <RecurringJobManager />
          <ReviewReminder />
          <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/ref/:code" element={<RefRedirect />} />
            <Route path="/ad-report/:id" element={<AdReport />} />
            <Route path="/ad-studio" element={<TraderAdStudio />} />
            <Route path="/tenant-report" element={<TenantReportPortal />} />
            <Route path="/passport/view/:id" element={<PublicPropertyPassportView />} />
          {!user ? (
            <>
              <Route path="/profile/:id" element={<PublicProfile />} />
              <Route path="*" element={<Login />} />
            </>
          ) : !profile ? (
            <Route path="*" element={<Onboarding />} />
          ) : (
            <>
              <Route path="/" element={<Layout />}>
                <Route index element={<IndexRoute />} />
                <Route path="dashboard" element={profile.subscriptionType === "business" ? <BusinessDashboard /> : <Dashboard />} />
                <Route path="trades-dashboard" element={<TradesDashboard />} />
                <Route path="job-feed" element={<JobFeed />} />
                <Route path="my-jobs" element={<MyJobs />} />
                <Route path="trade-jobs" element={<TradeJobs />} />
                <Route path="trader/calendar" element={<TraderCalendar />} />
                <Route path="consultancy/calendar" element={<BusinessDashboard />} />
                <Route path="consultancy/projects" element={<BusinessDashboard />} />
                <Route path="consultancy/clients" element={<BusinessDashboard />} />
                <Route path="consultancy/billing" element={<BusinessDashboard />} />
                <Route path="consultancy/portfolio" element={<BusinessDashboard />} />
                <Route path="consultancy/new" element={<BusinessDashboard />} />
                <Route path="portfolio" element={<Portfolio />} />
                <Route path="passport/view/:id" element={<PublicPropertyPassportView />} />
                <Route path="trader/banner-ads" element={<TradesBannerAdStudio />} />
                <Route path="post-job" element={<PostJobWizard />} />
                <Route path="post-emergency-job" element={<EmergencyJobWizard />} />
                <Route path="my-quotes" element={<MyQuotes />} />
                <Route path="messages" element={<Conversations />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="chat/:conversationId" element={<Chat />} />
                <Route path="profile" element={<Profile />} />
                <Route path="profile/:id" element={<PublicProfile />} />
                <Route path="availability" element={<Availability />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="billing" element={profile?.role === "driver" ? <DriverEarnings /> : <BillingManager />} />
                <Route path="team" element={<BusinessTeamManagement />} />
                <Route path="find-trades" element={<FindTrades />} />
                <Route path="admin" element={<MasterAdminLayout />} />
                <Route path="ecosystem" element={<EcosystemAdmin />} />
                <Route path="corporate" element={<CorporatePortal />} />
                <Route path="social-housing" element={<GothamHousingPortal />} />
                <Route path="gotham-portal" element={<GothamHousingPortal />} />
                <Route path="job/:id" element={<JobDetails />} />
                <Route path="job/:id/timeline" element={<JobTimeline />} />
                
                {/* AnyRoller specific routes inside Layout */}
                <Route path="driver-terminal" element={<DriverTerminal />} />
                <Route path="book-ride" element={<PassengerBooking />} />
                <Route path="my-rides" element={<PassengerRideHistory />} />
                <Route path="saved-journeys" element={<SavedJourneys />} />
                <Route path="platform-fee-success" element={<PlatformFeeSuccess />} />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </>
          )}
        </Routes>
        </Suspense>
        </PortalProvider>
      </BrowserRouter>
    </CategoryProvider>
  );
}






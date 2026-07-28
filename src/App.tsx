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
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Camera } from '@capacitor/camera';

// Lazy loaded large components
const DriverTerminal = React.lazy(() => import("./components/driver/DriverTerminal"));
const PassengerBooking = React.lazy(() => import("./components/passenger/PassengerBooking"));
const PassengerRideHistory = React.lazy(() => import("./components/passenger/PassengerRideHistory"));
const DriverEarnings = React.lazy(() => import("./components/driver/DriverEarnings"));
const DriverInbox = React.lazy(() => import("./components/driver/DriverInbox"));
const PlatformFeeSuccess = React.lazy(() => import("./components/driver/PlatformFeeSuccess"));
const CorporatePortal = React.lazy(() => import("./components/anyroller/CorporatePortal"));
const EcosystemAdmin = React.lazy(() => import("./components/EcosystemAdmin"));
const MasterAdminLayout = React.lazy(() => import("./components/MasterAdminLayout"));
const EmergencyJobWizard = React.lazy(() => import("./components/EmergencyJobWizard"));
const PostJobWizard = React.lazy(() => import("./components/PostJobWizard"));
const MyJobs = React.lazy(() => import("./components/MyJobs"));
const TradeJobs = React.lazy(() => import("./components/TradeJobs"));
const MyQuotes = React.lazy(() => import("./components/MyQuotes"));
const Conversations = React.lazy(() => import("./components/Conversations"));
const Notifications = React.lazy(() => import("./components/Notifications"));
const Dashboard = React.lazy(() => import("./components/Dashboard"));
const TradesDashboard = React.lazy(() => import("./components/TradesDashboard"));
const ReferralTracker = React.lazy(() => import("./components/shared/ReferralTracker"));
const RefRedirect = React.lazy(() => import("./components/shared/ReferralTracker").then(m => ({ default: m.RefRedirect })));
const BusinessDashboard = React.lazy(() => import("./components/BusinessDashboard"));
const JobFeed = React.lazy(() => import("./components/JobFeed"));
const JobDetails = React.lazy(() => import("./components/JobDetails"));
const JobTimeline = React.lazy(() => import("./components/JobTimeline"));
const TraderCalendar = React.lazy(() => import("./components/TraderCalendar"));
const Profile = React.lazy(() => import("./components/Profile"));
const PublicProfile = React.lazy(() => import("./components/PublicProfile"));
const Chat = React.lazy(() => import("./components/Chat"));
const Analytics = React.lazy(() => import("./components/Analytics"));
const Availability = React.lazy(() => import("./components/Availability"));
const FindTrades = React.lazy(() => import("./components/FindTrades"));
const Portfolio = React.lazy(() => import("./components/Portfolio"));
const TradesBannerAdStudio = React.lazy(() => import("./components/TradesBannerAdStudio"));
const BusinessTeamManagement = React.lazy(() => import("./components/BusinessTeamManagement"));
const BillingManager = React.lazy(() => import("./components/BillingManager"));
const SavedJourneys = React.lazy(() => import("./components/SavedJourneys"));
const RecurringJobManager = React.lazy(() => import("./components/RecurringJobManager").then(m => ({ default: m.RecurringJobManager })));
const AdReport = React.lazy(() => import("./components/AdReport"));
const TraderAdStudio = React.lazy(() => import("./components/TraderAdStudio"));

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
        const { App: CapacitorApp } = await import('@capacitor/app');

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

  // Global auto-scroll for inputs to keep them in view, especially on mobile
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
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
        <AppUpdateModal platformConfig={platformConfig} />
        <DeepLinkListener />
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






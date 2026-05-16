/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate, Navigate, Link } from "react-router-dom";
import { CategoryProvider } from "./lib/CategoryProvider";
import Layout from "./components/Layout";
import EmergencyJobWizard from "./components/EmergencyJobWizard";
import PostJobWizard from "./components/PostJobWizard";
import { useAuth } from "./components/AuthProvider";
import Login from "./components/Login";
import Onboarding from "./components/Onboarding";
import MyJobs from "./components/MyJobs";
import TradeJobs from "./components/TradeJobs";
import MyQuotes from "./components/MyQuotes";
import Conversations from "./components/Conversations";
import Notifications from "./components/Notifications";
import Dashboard from "./components/Dashboard";
import TradesDashboard from "./components/TradesDashboard";
import ReferralTracker, { RefRedirect } from "./components/shared/ReferralTracker";
import BusinessDashboard from "./components/BusinessDashboard";
import JobFeed from "./components/JobFeed";
import JobDetails from "./components/JobDetails";
import JobTimeline from "./components/JobTimeline";
import TraderCalendar from "./components/TraderCalendar";
import Profile from "./components/Profile";
import PublicProfile from "./components/PublicProfile";
import Chat from "./components/Chat";
import Analytics from "./components/Analytics";
import Availability from "./components/Availability";
import FindTrades from "./components/FindTrades";
import Portfolio from "./components/Portfolio";
import TradesBannerAdStudio from "./components/TradesBannerAdStudio";
import BusinessTeamManagement from "./components/BusinessTeamManagement";
import BillingManager from "./components/BillingManager";
import MasterAdminLayout from "./components/MasterAdminLayout";
import EcosystemAdmin from "./components/EcosystemAdmin";
import SavedJourneys from "./components/SavedJourneys";
import { RecurringJobManager } from "./components/RecurringJobManager";
import { Toaster } from "sonner";
import { ReviewReminder } from "./components/ReviewReminder";
import { PlusCircle, Briefcase, MessageSquare, User as UserIcon, Bell, ChevronRight, PoundSterling, Search, Lock } from "lucide-react";
import { db, collection, query, where, onSnapshot, collectionGroup, doc } from "@/src/firebase";

import DriverTerminal from "./components/driver/DriverTerminal";
import PassengerBooking from "./components/passenger/PassengerBooking";

import DriverEarnings from "./components/driver/DriverEarnings";
import DriverInbox from "./components/driver/DriverInbox";
import PassengerRideHistory from "./components/passenger/PassengerRideHistory";
import { PortalProvider, usePortal } from "./lib/PortalContext";
import PlatformSwitcher from "./components/shared/PlatformSwitcher";
import CorporatePortal from "./components/anyroller/CorporatePortal";
import AdReport from "./components/AdReport";
import TraderAdStudio from "./components/TraderAdStudio";

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
    return () => unsub();
  }, [isAuthReady]);

  // Global auto-scroll for inputs to keep them in view, especially on mobile
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
      <Toaster position="top-center" richColors />
      <BrowserRouter>
        <ReferralTracker />
        <PortalProvider>
          <PlatformSwitcher />
          <RecurringJobManager />
          <ReviewReminder />
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

                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </>
          )}
        </Routes>
        </PortalProvider>
      </BrowserRouter>
    </CategoryProvider>
  );
}






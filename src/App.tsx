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
import MyQuotes from "./components/MyQuotes";
import Conversations from "./components/Conversations";
import Notifications from "./components/Notifications";
import Dashboard from "./components/Dashboard";
import TradesDashboard from "./components/TradesDashboard";
import BusinessDashboard from "./components/BusinessDashboard";
import JobFeed from "./components/JobFeed";
import JobDetails from "./components/JobDetails";
import JobTimeline from "./components/JobTimeline";
import Profile from "./components/Profile";
import PublicProfile from "./components/PublicProfile";
import Chat from "./components/Chat";
import Analytics from "./components/Analytics";
import Availability from "./components/Availability";
import FindTrades from "./components/FindTrades";
import Portfolio from "./components/Portfolio";
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
import RideDashboardLayout from "./components/driver/RideDashboardLayout";
import DriverEarnings from "./components/driver/DriverEarnings";
import DriverInbox from "./components/driver/DriverInbox";
import MyRides from "./components/MyRides";
import { PortalProvider, usePortal } from "./lib/PortalContext";
import PlatformSwitcher from "./components/shared/PlatformSwitcher";

function IndexRoute() {
  const { activePortal, activeRole } = usePortal();

  if (activePortal === "anyride") {
    return activeRole === "driver" ? <DriverTerminal /> : <RideDashboardLayout />;
  }

  // AnyTrader context
  if (activeRole === "driver") {
    return <DriverTerminal />; // Fallback 
  }
  
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

  if (!isAuthReady) return null;

  // Maintenance Mode Check
  const isMaintenanceMode = platformConfig?.maintenanceMode;
  const isAdmin = profile?.role === "admin";

  if (isMaintenanceMode && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-[32px] border border-slate-200 shadow-xl text-center space-y-6">
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
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
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
        <PortalProvider>
          <PlatformSwitcher />
          <RecurringJobManager />
          <ReviewReminder />
          <Routes>
          <Route path="/profile/:id" element={<PublicProfile />} />
          {!user ? (
            <Route path="*" element={<Login />} />
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
                <Route path="portfolio" element={<Portfolio />} />
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
                <Route path="job/:id" element={<JobDetails />} />
                <Route path="job/:id/timeline" element={<JobTimeline />} />
                
                {/* AnyRide specific routes inside Layout */}
                <Route path="driver-terminal" element={<DriverTerminal />} />
                <Route path="book-ride" element={<RideDashboardLayout />} />
                <Route path="my-rides" element={<MyRides />} />
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






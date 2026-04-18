import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { 
  collection, collectionGroup, doc, getDoc, getDocs, onSnapshot, query, where, orderBy, limit,
  db, handleFirestoreError, OperationType
} from "@/src/firebase";
import { motion } from "motion/react";
import { 
  Briefcase, Clock, ChevronRight, Plus, Loader2, 
  Search, BarChart3, Zap, Bot,
  MapPin, ShieldCheck, Building2, LayoutGrid,
  TrendingUp, Users2, FileText, Activity,
  CreditCard, ArrowUpCircle, Users
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/src/lib/utils";
import { SEO } from "./SEO";

export default function BusinessDashboard() {
  const { user, profile, setIsTradeBotOpen } = useAuth();
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentQuotes, setRecentQuotes] = useState<any[]>([]);

  useEffect(() => {
    if (!user || !profile) return;

    // Fetch recent quotes across all business jobs
    const quotesQuery = query(
      collectionGroup(db, "quotes"),
      where("homeownerId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(5)
    );

    const unsubscribeQuotes = onSnapshot(quotesQuery, (snapshot) => {
      const quotesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentQuotes(quotesData);
    }, (error) => {
      console.error("Error fetching recent quotes:", error);
    });

    // Fetch all jobs for business stats
    const allJobsQuery = query(
      collection(db, "jobs"),
      where("homeownerId", "==", user.uid),
      orderBy("postedDate", "desc")
    );

    const unsubscribeAllJobs = onSnapshot(allJobsQuery, (snapshot) => {
      const jobsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setAllJobs(jobsData);
      setActiveJobs(jobsData.filter(j => ["posted", "quoting", "accepted", "in_progress"].includes(j.status)));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching business jobs:", error);
      handleFirestoreError(error, OperationType.LIST, "jobs");
      setLoading(false);
    });

    return () => {
      unsubscribeAllJobs();
      unsubscribeQuotes();
    };
  }, [user, profile]);

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="animate-spin" /></div>;

  const stats = {
    total: allJobs.length,
    active: activeJobs.length,
    completed: allJobs.filter(j => j.status === "completed").length,
    spend: allJobs.reduce((acc, j) => acc + (j.finalPrice || 0), 0)
  };

  const isSubscribed = profile?.subscriptionId && profile?.subscriptionStatus === "active";
  const jobLimit = isSubscribed ? (profile?.jobLimit || 50) : 10; // Default limits if not in profile
  const usagePercent = Math.min(100, (stats.total / jobLimit) * 100);

  return (
    <div className="space-y-8 pb-24">
      <SEO 
        title="Business Dashboard" 
        description="Manage your property portfolio and professional trade services on AnyTrader."
      />
      
      {/* Business Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className={cn(
              "text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider",
              (!profile?.subscriptionId || profile?.subscriptionStatus !== "active") ? "bg-orange-500" : "bg-blue-600"
            )}>
              {(!profile?.subscriptionId || profile?.subscriptionStatus !== "active") ? "Standard" : "Professional"}
            </div>
            <span className="text-slate-400 text-xs font-bold">• {profile?.businessCategory || "General Business"}</span>
          </div>
          <h1 className="text-4xl font-display font-black text-slate-900 tracking-tight">
            {profile?.name} <span className="text-slate-400 font-normal">HQ</span>
          </h1>
          <p className="text-slate-500 font-medium">Portfolio overview and maintenance tracking.</p>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Plan</p>
            <p className="text-sm font-bold text-blue-600">
              {(!profile?.subscriptionId || profile?.subscriptionStatus !== "active") ? "Homeowner/Standard" : (profile?.tierId || "Business Professional")}
            </p>
          </div>
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Plan Status Banner */}
      {!isSubscribed ? (
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 rounded-[32px] text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg shadow-orange-500/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Business Trial Active</h3>
              <p className="text-orange-50 text-sm">You have {Math.max(0, 10 - stats.total)} free posts remaining. Upgrade to a professional plan for unlimited access.</p>
            </div>
          </div>
          <Link 
            to="/settings?tab=subscription" 
            className="bg-white text-orange-600 px-6 py-3 rounded-2xl font-bold text-sm hover:bg-orange-50 transition-colors whitespace-nowrap"
          >
            Upgrade Now
          </Link>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center shrink-0 border border-blue-100">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900">{profile?.tierId || "Business Professional"} Plan</h3>
                <span className="bg-green-100 text-green-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Active</span>
              </div>
              <div className="mt-2 w-full md:w-64">
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-1">
                  <span>Usage</span>
                  <span>{stats.total} / {jobLimit} Posts</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${usagePercent}%` }}
                    className={cn(
                      "h-full rounded-full",
                      usagePercent > 90 ? "bg-red-500" : usagePercent > 70 ? "bg-orange-500" : "bg-blue-600"
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
          <Link 
            to="/settings?tab=subscription" 
            className="flex items-center gap-2 text-blue-600 font-bold text-sm hover:bg-blue-50 px-4 py-2 rounded-xl transition-colors"
          >
            <ArrowUpCircle className="w-4 h-4" />
            Manage Plan
          </Link>
        </div>
      )}

      {/* Business Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Active Projects", value: stats.active, icon: Activity, color: "blue" },
          { label: "Total Sites", value: stats.total, icon: MapPin, color: "indigo" },
          { label: "Completed", value: stats.completed, icon: ShieldCheck, color: "green" },
          { label: "Total Spend", value: `£${stats.spend.toLocaleString()}`, icon: TrendingUp, color: "orange" }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center mb-4 border",
              stat.color === "blue" ? "bg-blue-50 text-blue-600 border-blue-100" :
              stat.color === "indigo" ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
              stat.color === "green" ? "bg-green-50 text-green-600 border-green-100" :
              "bg-orange-50 text-orange-600 border-orange-100"
            )}>
              <stat.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-display font-black text-slate-900">{stat.value}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/post-job" className="bg-blue-600 p-6 rounded-[32px] text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all group">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Plus className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-xl mb-1">Post New Project</h3>
          <p className="text-blue-100 text-sm">Add a job to your portfolio</p>
        </Link>
        
        <Link to="/analytics" className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:border-blue-600 transition-all group">
          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-50 transition-colors">
            <BarChart3 className="w-6 h-6 text-slate-400 group-hover:text-blue-600" />
          </div>
          <h3 className="font-bold text-xl text-slate-900 mb-1">Business Analytics</h3>
          <p className="text-slate-500 text-sm">Track spend and performance</p>
        </Link>

        {(profile?.subscriptionType === 'Business Professional' || profile?.subscriptionType === 'Enterprise Powerhouse') ? (
          <Link to="/team" className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:border-indigo-600 transition-all group">
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-indigo-50 transition-colors">
              <Users className="w-6 h-6 text-slate-400 group-hover:text-indigo-600" />
            </div>
            <h3 className="font-bold text-xl text-slate-900 mb-1">Team Management</h3>
            <p className="text-slate-500 text-sm">Manage seats and members</p>
          </Link>
        ) : (
          <button 
            onClick={() => setIsTradeBotOpen(true)}
            className="bg-indigo-600 p-6 rounded-[32px] text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all group text-left"
          >
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-xl mb-1">AI Project Planner</h3>
            <p className="text-indigo-100 text-sm">Get professional scope advice</p>
          </button>
        )}
      </div>

      {/* Active Portfolio Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
              <LayoutGrid className="w-5 h-5 text-slate-600" />
            </div>
            Active Portfolio
          </h2>
          <Link to="/my-jobs" className="text-sm font-bold text-blue-600 hover:underline">View All Sites</Link>
        </div>

        {activeJobs.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-100 rounded-[40px] p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto">
              <Briefcase className="w-8 h-8 text-slate-300" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-900">No active projects</h3>
              <p className="text-slate-500 max-w-xs mx-auto">Your portfolio is currently quiet. Post a new job to find professional tradespeople.</p>
            </div>
            <Link to="/post-job" className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all">
              <Plus className="w-5 h-5" /> Post First Business Job
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeJobs.slice(0, 4).map((job) => (
              <Link 
                key={job.id} 
                to={`/job/${job.id}`}
                className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:border-blue-600 transition-all group relative overflow-hidden"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase tracking-tighter">
                        {job.category}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">• {job.city}</span>
                    </div>
                    <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{job.title}</h3>
                  </div>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                    job.status === "posted" ? "bg-green-100 text-green-700" :
                    job.status === "quoting" ? "bg-blue-100 text-blue-700" :
                    "bg-orange-100 text-orange-700"
                  )}>
                    {job.status.replace("_", " ")}
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center">
                      <FileText className="w-4 h-4 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Quotes</p>
                      <p className="text-xs font-black text-slate-900">{job.quoteCount || 0}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Business Support Banner */}
      <div className="bg-slate-900 rounded-[40px] p-8 text-white relative overflow-hidden">
        <div className="relative z-10 space-y-4 max-w-md">
          <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full border border-white/10">
            <Users2 className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold">Priority Business Support</span>
          </div>
          <h2 className="text-3xl font-display font-black">Dedicated Account Management</h2>
          <p className="text-slate-400 text-sm">
            As a professional client, you have access to our priority support team for large-scale project coordination and dispute mediation.
          </p>
          <button className="bg-white text-slate-900 px-6 py-3 rounded-2xl font-bold hover:bg-slate-100 transition-all active:scale-95">
            Contact My Manager
          </button>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
          <Building2 className="w-64 h-64 -mr-12 -mb-12" />
        </div>
      </div>
    </div>
  );
}

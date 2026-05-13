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
import { PropertyManager } from "./PropertyManager";
import { FieldServicesManager } from "./FieldServicesManager";
import { useBusinessTab } from "@/src/store/businessTabStore";

export default function BusinessDashboard() {
  const { user, profile, setIsTradeBotOpen } = useAuth();
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentQuotes, setRecentQuotes] = useState<any[]>([]);

  const { activeTab, setActiveTab } = useBusinessTab();

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
    <div className="pb-24">
      <SEO 
        title="Business Dashboard" 
        description="Manage your property portfolio and professional trade services on AnyTrader."
      />
      
      {/* Conditional Content Output Block */}
      {activeTab === "properties" && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          
          {/* Plan Status Banner (Only visible if not subscribed) */}
          {!isSubscribed && (
            <div className="bg-gradient-to-r from-orange-400 to-amber-500 p-3 rounded-xl text-white flex flex-col shadow-sm">
              <div className="flex items-start gap-3 mb-3">
                <Zap className="w-6 h-6 text-white shrink-0 mt-0.5 fill-white" />
                <p className="text-[13px] leading-snug">
                  <span className="font-bold">Business Trial Active</span> - You have {Math.max(0, 10 - stats.total)} free posts remaining. Upgrade to a professional plan for unlimited access.
                </p>
              </div>
              <Link 
                to="/settings?tab=subscription" 
                className="bg-white text-orange-600 w-full py-2 rounded-lg font-bold text-[14px] hover:bg-orange-50 transition-colors shadow-sm text-center"
              >
                Upgrade Now
              </Link>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Active Projects", value: stats.active, icon: Activity, color: "text-blue-500" },
              { label: "Total Sites", value: stats.total, icon: MapPin, color: "text-purple-500" },
              { label: "Completed", value: stats.completed, icon: ShieldCheck, color: "text-green-500" },
              { label: "Total Spend", value: `£${stats.spend.toLocaleString()}`, icon: TrendingUp, color: "text-orange-500" }
            ].map((stat, i) => (
              <div key={i} className="bg-white rounded-xl border border-black p-2 text-center flex flex-col justify-center items-center shadow-sm">
                 <stat.icon className={cn("w-5 h-5 mb-1", stat.color)} />
                 <div className="text-lg font-bold text-slate-900 leading-none mb-1">{stat.value}</div>
                 <div className="text-[9px] uppercase font-bold text-slate-500 leading-[1.1] whitespace-pre-line">
                   {stat.label.split(' ').join('\n')}
                 </div>
              </div>
            ))}
          </div>

          {/* Action Grid */}
          <div className="grid grid-cols-2 gap-2">
            <Link to="/post-job" className="bg-blue-600 rounded-xl border border-black p-3 flex flex-col items-center justify-center text-center shadow-sm text-white row-span-2 hover:bg-blue-700 transition">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mb-2">
                <Plus className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-[15px] mb-1 leading-tight">Post New Project</h3>
              <p className="text-blue-100 text-[11px] leading-tight">Add a job to your portfolio.</p>
            </Link>
            
            <Link to="/analytics" className="bg-white rounded-xl border border-black p-3 flex items-center gap-2 shadow-sm hover:bg-slate-50 transition">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4 text-slate-600" />
              </div>
              <div>
                <h4 className="font-bold text-[12px] text-slate-900 leading-tight mb-0.5">Business Analytics</h4>
                <p className="text-[10px] text-slate-500 leading-tight">Track spend and performance.</p>
              </div>
            </Link>

            <button onClick={() => setIsTradeBotOpen(true)} className="bg-purple-50 rounded-xl border border-black p-3 flex items-center gap-2 shadow-sm hover:bg-purple-100 transition text-left">
              <div className="w-8 h-8 rounded-lg bg-purple-200 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-purple-700" />
              </div>
              <div>
                <h4 className="font-bold text-[12px] text-purple-900 leading-tight mb-0.5">AI Project Planner</h4>
                <p className="text-[10px] text-purple-600 leading-tight">Get professional scope advice.</p>
              </div>
            </button>
          </div>

          {/* Active Portfolio Section */}
          <PropertyManager />
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            Active Projects
          </h2>
          <Link to="/my-jobs" className="text-[12px] font-bold text-blue-600 hover:underline">View All Projects</Link>
        </div>

        {activeJobs.length === 0 ? (
          <div className="bg-white border border-black shadow-sm rounded-xl p-8 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mx-auto">
              <Briefcase className="w-6 h-6 text-slate-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-[16px] font-bold text-slate-900">No active projects</h3>
              <p className="text-slate-500 text-[12px] max-w-xs mx-auto">Your portfolio is currently quiet. Post a new job to find professional tradespeople.</p>
            </div>
            <Link to="/post-job" className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-blue-700 transition-all shadow-sm">
              <Plus className="w-4 h-4" /> Post First Business Job
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeJobs.slice(0, 5).map((job) => (
              <Link 
                key={job.id} 
                to={`/job/${job.id}`}
                className="bg-white p-4 rounded-xl border border-black shadow-sm hover:border-blue-600 transition-all group relative overflow-hidden flex flex-col justify-between"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[9px] font-black uppercase tracking-tighter">
                        {job.category}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">• {job.city || "Pending"}</span>
                    </div>
                    <h3 className="font-bold text-[14px] text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{job.title}</h3>
                  </div>
                  <div className={cn(
                    "px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider shrink-0",
                    job.status === "posted" ? "bg-green-100 text-green-700" :
                    job.status === "quoting" ? "bg-blue-100 text-blue-700" :
                    "bg-orange-100 text-orange-700"
                  )}>
                    {job.status.replace("_", " ")}
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-auto">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-slate-50 rounded-md flex items-center justify-center">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Quotes</p>
                      <p className="text-[11px] font-black text-slate-900 leading-none mt-0.5">{job.quoteCount || 0}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Business Support Banner */}
      <div className="bg-slate-900 rounded-xl p-3 border border-black shadow-sm text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
            <Users2 className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h2 className="font-bold text-[12px] leading-tight">Priority Support</h2>
            <p className="text-[10px] text-slate-400 leading-tight block">Dedicated Acc. Manager</p>
          </div>
        </div>
        <button className="bg-white text-slate-900 px-3 py-1.5 rounded-lg font-bold hover:bg-slate-100 transition-all active:scale-95 text-[11px] whitespace-nowrap shadow-sm">
          Contact Manager
        </button>
      </div>
     </div>
    )}

      {/* Field Services Content */}
      {activeTab === "field_services" && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
           <FieldServicesManager />
        </div>
      )}

      {/* Consultancy Content */}
      {activeTab === "consultancy" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
           <div className="bg-white p-12 rounded-[40px] border border-slate-100 shadow-sm text-center">
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Consultancy Services</h2>
              <p className="text-slate-500 max-w-md mx-auto">Track virtual consultations, advisory bookings, and specialized project overviews. Coming soon in Phase 19.</p>
           </div>
        </div>
      )}
    </div>
  );
}

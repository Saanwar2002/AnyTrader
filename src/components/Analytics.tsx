import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { db, collection, query, where, onSnapshot, collectionGroup, handleFirestoreError, OperationType } from "@/src/firebase";
import { motion } from "motion/react";
import { 
  BarChart3, TrendingUp, Briefcase, PoundSterling, Clock, 
  ChevronLeft, Receipt, PiggyBank, Lightbulb, Plus, Search,
  Zap, ArrowUpRight
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell
} from "recharts";
import { cn } from "@/src/lib/utils";

export default function Analytics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"spend" | "quotes" | "response">("spend");

  useEffect(() => {
    if (!user) return;

    const jobsQuery = query(
      collection(db, "jobs"),
      where("homeownerId", "==", user.uid)
    );

    const unsubscribeJobs = onSnapshot(jobsQuery, (snapshot) => {
      setJobs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error("Error listening to jobs in analytics:", err);
      handleFirestoreError(err, OperationType.LIST, "jobs");
    });

    /*
    const quotesQuery = query(
      collectionGroup(db, "quotes"),
      where("homeownerId", "==", user.uid)
    );

    const unsubscribeQuotes = onSnapshot(quotesQuery, (snapshot) => {
      setQuotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Error listening to quotes in analytics:", err);
      setLoading(false);
    });
    */
    setLoading(false);

    return () => {
      unsubscribeJobs();
      // unsubscribeQuotes();
    };
  }, [user]);

  // Calculations
  const completedJobs = jobs.filter(j => j.status === "completed");
  const totalSpent = completedJobs.reduce((acc, j) => acc + (j.estimateMin + j.estimateMax) / 2, 0);
  const savedVsMarket = completedJobs.length * 45; // Mock calculation for demo
  
  const statusCounts = {
    completed: jobs.filter(j => j.status === "completed").length,
    inProgress: jobs.filter(j => ["accepted", "quoting"].includes(j.status)).length,
    pending: jobs.filter(j => j.status === "posted").length
  };

  const monthlyData = [
    { name: "Oct", spend: 1200 },
    { name: "Nov", spend: 1800 },
    { name: "Dec", spend: 2100 },
    { name: "Jan", spend: 0 },
    { name: "Feb", spend: 3200 },
    { name: "Mar", spend: 5400 },
    { name: "Apr", spend: 2400 },
  ];

  const categoryData = [
    { name: "Heating", amount: 4100, count: 2, color: "bg-red-500" },
    { name: "Plumbing", amount: 1800, count: 3, color: "bg-blue-500" },
    { name: "Electrical", amount: 900, count: 1, color: "bg-orange-500" },
    { name: "Landscaping", amount: 900, count: 1, color: "bg-green-500" },
  ];

  if (loading) return <div className="py-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-24">
      {/* Header */}
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-white/10 border border-black/20 rounded-xl flex items-center justify-center hover:bg-white/20 hover:scale-105 transition-all group"
          >
            <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold">Job Analytics</h1>
            <p className="text-slate-400 text-sm">Your spending insights & patterns</p>
          </div>
          <div className="bg-orange-500/20 text-orange-500 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 border border-orange-500/30">
            <Zap className="w-3 h-3 fill-orange-500" />
            Live
          </div>
        </div>
      </div>

      <div className="bg-white rounded-t-[40px] p-6 space-y-8 min-h-screen text-slate-900">
        {/* Overview Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 space-y-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
              <Receipt className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase">Total Spent</p>
            <p className="text-2xl font-bold text-slate-900">£{totalSpent.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400">Last 6 months</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 space-y-2">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
              <Briefcase className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase">Jobs Posted</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-slate-900">{jobs.length}</p>
              <ArrowUpRight className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-[10px] text-slate-400">{statusCounts.completed} completed</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 space-y-2">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
              <PiggyBank className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase">Saved vs Market</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-green-600">£{savedVsMarket}</p>
              <ArrowUpRight className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-[10px] text-slate-400">vs avg market price</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 space-y-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
              <Clock className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase">Avg Response</p>
            <p className="text-2xl font-bold text-blue-600">4.2h</p>
            <p className="text-[10px] text-slate-400">from tradespeople</p>
          </div>
        </div>

        {/* Job Status Breakdown */}
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
          <h3 className="font-bold text-slate-900">Job Status Breakdown</h3>
          <div className="flex justify-between items-center px-2">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-xl font-bold">{statusCounts.completed}</span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Completed</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span className="text-xl font-bold">{statusCounts.inProgress}</span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">In Progress</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className="w-2 h-2 bg-orange-500 rounded-full" />
                <span className="text-xl font-bold">{statusCounts.pending}</span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Pending</p>
            </div>
          </div>
          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden flex">
            <div className="h-full bg-green-500" style={{ width: `${(statusCounts.completed / jobs.length) * 100}%` }} />
            <div className="h-full bg-blue-500" style={{ width: `${(statusCounts.inProgress / jobs.length) * 100}%` }} />
            <div className="h-full bg-orange-500" style={{ width: `${(statusCounts.pending / jobs.length) * 100}%` }} />
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-slate-100 p-1 rounded-2xl flex gap-1">
          <button 
            onClick={() => setActiveTab("spend")}
            className={cn(
              "flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all",
              activeTab === "spend" ? "bg-white text-orange-600 shadow-sm" : "text-slate-500"
            )}
          >
            <Receipt className="w-3 h-3" />
            Spend
          </button>
          <button 
            onClick={() => setActiveTab("quotes")}
            className={cn(
              "flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all",
              activeTab === "quotes" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
            )}
          >
            <Receipt className="w-3 h-3" />
            Quotes
          </button>
          <button 
            onClick={() => setActiveTab("response")}
            className={cn(
              "flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all",
              activeTab === "response" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            )}
          >
            <Clock className="w-3 h-3" />
            Response
          </button>
        </div>

        {/* Monthly Spend Chart */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-slate-900">Monthly Spend (£)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: "#94a3b8", fontWeight: 600 }} 
                />
                <Tooltip 
                  cursor={{ fill: "transparent" }}
                  contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                />
                <Bar dataKey="spend" radius={[6, 6, 0, 0]}>
                  {monthlyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.name === "Mar" ? "#1e293b" : "#334155"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-slate-100">
            <span className="text-slate-500 font-bold">Total this period</span>
            <span className="text-xl font-bold text-slate-900">£9,700</span>
          </div>
        </div>

        {/* Spend by Category */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-slate-900">Spend by Category</h3>
          <div className="space-y-6">
            {categoryData.map((cat) => (
              <div key={cat.name} className="space-y-2">
                <div className="flex justify-between items-end">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", cat.color)} />
                      <span className="font-bold text-slate-900">{cat.name}</span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{cat.count} jobs</p>
                  </div>
                  <span className="font-bold text-slate-900">£{cat.amount.toLocaleString()}</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full", cat.color)} style={{ width: `${(cat.amount / 5000) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Insight */}
        <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100 flex gap-4">
          <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
            <Lightbulb className="w-5 h-5 text-orange-500" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-orange-900">AI Insight</h4>
            <p className="text-sm text-orange-800 leading-relaxed">
              You post most jobs in the Plumbing and Heating categories. Getting 4+ quotes per job could save you an average of £240 more per job.
            </p>
          </div>
        </div>

        {/* Bottom Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <Link to="/post-job" className="bg-white border border-black p-4 rounded-3xl flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-colors shadow-sm">
            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
              <Plus className="w-4 h-4 text-slate-600" />
            </div>
            <span className="font-bold text-slate-900 text-sm">Post New Job</span>
          </Link>
          <button className="bg-white border border-black p-4 rounded-3xl flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-colors shadow-sm">
            <div className="w-8 h-8 bg-orange-50 rounded-full flex items-center justify-center">
              <Lightbulb className="w-4 h-4 text-orange-500" />
            </div>
            <span className="font-bold text-slate-900 text-sm">AI Price Check</span>
          </button>
        </div>
      </div>
    </div>
  );
}

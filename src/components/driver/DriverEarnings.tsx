import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  PoundSterling,
  TrendingUp,
  Calendar,
  ChevronRight,
  Activity,
  ArrowUpRight,
  Zap,
  Target,
  Star,
  History,
  CreditCard,
  ShieldCheck,
  Loader2,
  Car,
  X,
  Edit2,
  Check,
} from "lucide-react";
import {
  db,
  doc,
  setDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "@/src/firebase";
import { useAuth } from "../AuthProvider";
import { cn } from "@/src/lib/utils";
import { toast } from "sonner";

export default function DriverEarnings({ onClose }: { onClose?: () => void }) {
  const { user, profile } = useAuth();
  const [fareConfig, setFareConfig] = useState<{
    baseFare: number;
    distanceRate: number;
    minFare: number;
    commissionRate: number;
  }>({ baseFare: 3.5, distanceRate: 1.3, minFare: 5.0, commissionRate: 0.12 });
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
  const [metrics, setMetrics] = useState({
    today: { earnings: 0, jobs: 0, goal: 200 },
    week: { earnings: 0, jobs: 0, goal: 1000 },
    month: { earnings: 0, jobs: 0, goal: 4000 },
  });
  const [stripeBalance, setStripeBalance] = useState({
    available: 0,
    pending: 0,
    loading: true,
  });
  const [recentTrips, setRecentTrips] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [editingGoalValue, setEditingGoalValue] = useState("");
  const [showEarningStatements, setShowEarningStatements] = useState(false);
  const [statementPeriod, setStatementPeriod] = useState<"daily" | "weekly" | "monthly" | "yearly">("daily");
  const [showFullTripHistory, setShowFullTripHistory] = useState(false);
  const [fullTrips, setFullTrips] = useState<any[]>([]);
  const [loadingFullTrips, setLoadingFullTrips] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [statementData, setStatementData] = useState({
    daily: [] as { range: string; total: number; jobs: number; rank: number }[],
    weekly: [] as { range: string; total: number; jobs: number; rank: number }[],
    monthly: [] as { range: string; total: number; jobs: number; rank: number }[],
    yearly: [] as { range: string; total: number; jobs: number; rank: number }[],
  });


  const handleEditGoal = () => {
    setEditingGoalValue(metrics[period].goal.toString());
    setIsEditingGoal(true);
  };

  const handleOpenFullHistory = async () => {
    setShowFullTripHistory(true);
    setLoadingFullTrips(true);
    if (!user) return;
    try {
      const q = query(
        collection(db, "ride_requests"),
        where("driverId", "==", user.uid),
        where("status", "==", "completed"),
        orderBy("completedAt", "desc"),
        limit(50)
      );
      const snap = await getDocs(q);
      setFullTrips(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error("Error fetching full history:", e);
    } finally {
      setLoadingFullTrips(false);
    }
  };

  const handleSaveGoal = async () => {
    const newGoal = parseInt(editingGoalValue, 10);
    if (!isNaN(newGoal) && newGoal > 0) {
      setMetrics((prev) => ({
        ...prev,
        [period]: {
          ...prev[period as keyof typeof prev],
          goal: newGoal
        }
      }));
      setIsEditingGoal(false);

      if (user) {
        try {
          await setDoc(doc(db, "users", user.uid), {
            earningsGoals: {
              [period]: newGoal
            }
          }, { merge: true });
          toast.success("Goal updated");
        } catch (e) {
          console.error("Failed to save goal", e);
        }
      }
    } else {
       toast.error("Please enter a valid amount");
    }
  };

  useEffect(() => {
    if (profile?.earningsGoals) {
      setMetrics((prev) => ({
        ...prev,
        today: { ...prev.today, goal: profile.earningsGoals.today || prev.today.goal },
        week: { ...prev.week, goal: profile.earningsGoals.week || prev.week.goal },
        month: { ...prev.month, goal: profile.earningsGoals.month || prev.month.goal },
      }));
    }
  }, [profile?.earningsGoals]);

  useEffect(() => {
    if (!user) return;

    // Listen to Global Tiers for Commission
    const unsubGlobalTiers = onSnapshot(
      doc(db, "platform_config", "global_tiers"),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const taxiTier = data?.providerModels?.on_demand_transport?.tiers?.STANDARD;
          if (taxiTier?.commission !== undefined) {
             setFareConfig(prev => ({
               ...prev,
               commissionRate: taxiTier.commission
             }));
          }
        }
      }
    );

    // Listen to Taxi Command Settings for fares
    const unsubConfig = onSnapshot(
      doc(db, "platform_config", "rides"),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFareConfig(prev => ({
            ...prev,
            baseFare: Number(data.baseFare) || 3.5,
            distanceRate: Number(data.distanceRate) || 1.3,
            minFare: Number(data.minFare) || 5.0,
            // Keep commission from global_tiers if loaded, or fallback
            commissionRate: prev.commissionRate || (data.commission ? Number(data.commission) / 100 : 0.12)
          }));
        }
      },
    );

    // 1. Listen to Driver Metrics from Firestore (for Today)
    const unsubMetrics = onSnapshot(
      doc(db, "driver_metrics", user.uid),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const today = new Date().toISOString().split("T")[0];

          // Only count if it's for today
          if (data.date === today) {
            setMetrics((prev) => ({
              ...prev,
              today: {
                earnings: data.dailyEarnings || 0,
                jobs: data.jobsDoneToday || 0,
                goal: 200,
              },
            }));
          }
        }
      },
    );

    // Fetch historical trips to calculate week and month earnings manually
    const fetchHistoricalMetrics = async () => {
      try {
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const weekStart = new Date();
        weekStart.setDate(
          weekStart.getDate() -
            weekStart.getDay() +
            (weekStart.getDay() === 0 ? -6 : 1),
        ); // Start of week (Monday)
        weekStart.setHours(0, 0, 0, 0);

        // Fetch all completed rides for this driver
        const hq = query(
          collection(db, "ride_requests"),
          where("driverId", "==", user.uid),
          where("status", "==", "completed"),
        );
        const snapshot = await getDocs(hq);

        let monthEarnings = 0;
        let monthJobs = 0;
        let weekEarnings = 0;
        let weekJobs = 0;

        const yearGroups: Record<string, { total: number; jobs: number; rank: number }> = {};
        const monthGroups: Record<string, { total: number; jobs: number; rank: number }> = {};
        const weekGroups: Record<string, { total: number; jobs: number; rank: number }> = {};
        const dailyGroups: Record<string, { total: number; jobs: number; rank: number }> = {};

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const createdAt =
            data.completedAt?.toDate() || data.createdAt?.toDate();
          if (!createdAt) return;

          const fare = data.finalFare || 0;

          if (createdAt >= monthStart) {
            monthEarnings += fare;
            monthJobs++;
          }
          if (createdAt >= weekStart) {
            weekEarnings += fare;
            weekJobs++;
          }

          // 0. Daily Grouping
          const dLabel = createdAt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
          const dRank = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate()).getTime();
          if (!dailyGroups[dLabel]) dailyGroups[dLabel] = { total: 0, jobs: 0, rank: dRank };
          dailyGroups[dLabel].total += fare;
          dailyGroups[dLabel].jobs++;

          // 1. Weekly Grouping
          const wD = new Date(createdAt);
          wD.setHours(0, 0, 0, 0);
          const wDay = wD.getDay();
          const wStart = new Date(wD.setDate(wD.getDate() - wDay + (wDay === 0 ? -6 : 1)));
          const wEnd = new Date(wStart);
          wEnd.setDate(wStart.getDate() + 6);
          const formatOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
          const wLabel = `${wStart.toLocaleDateString('en-GB', formatOptions)} - ${wEnd.toLocaleDateString('en-GB', formatOptions)}`;
          const wRank = wStart.getTime();

          if (!weekGroups[wLabel]) weekGroups[wLabel] = { total: 0, jobs: 0, rank: wRank };
          weekGroups[wLabel].total += fare;
          weekGroups[wLabel].jobs++;

          // 2. Monthly Grouping
          const mLabel = createdAt.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
          const mRank = createdAt.getFullYear() * 100 + createdAt.getMonth();
          if (!monthGroups[mLabel]) monthGroups[mLabel] = { total: 0, jobs: 0, rank: mRank };
          monthGroups[mLabel].total += fare;
          monthGroups[mLabel].jobs++;

          // 3. Yearly Grouping
          const yYear = createdAt.getFullYear();
          const yFiscalYearStart = new Date(yYear, 3, 5); // April 5th
          const yFiscalYearId = createdAt >= yFiscalYearStart ? yYear : yYear - 1;

          const cyStart = new Date(new Date().getFullYear(), 3, 5);
          const cyFiscalYearId = new Date() >= cyStart ? new Date().getFullYear() : new Date().getFullYear() - 1;

          let yLabel = '';
          if (yFiscalYearId === cyFiscalYearId) {
            yLabel = `Apr 5, ${yFiscalYearId} - Present`;
          } else {
            yLabel = `Apr 5, ${yFiscalYearId} - Apr 4, ${yFiscalYearId + 1}`;
          }
          
          if (!yearGroups[yLabel]) yearGroups[yLabel] = { total: 0, jobs: 0, rank: yFiscalYearId };
          yearGroups[yLabel].total += fare;
          yearGroups[yLabel].jobs++;
        });

        const dailyStatements = Object.entries(dailyGroups)
           .map(([range, d]) => ({ range, total: d.total, jobs: d.jobs, rank: d.rank }))
           .sort((a,b) => b.rank - a.rank).slice(0, 14);

        const weeklyStatements = Object.entries(weekGroups)
           .map(([range, d]) => ({ range, total: d.total, jobs: d.jobs, rank: d.rank }))
           .sort((a,b) => b.rank - a.rank).slice(0, 10);
           
        const monthlyStatements = Object.entries(monthGroups)
           .map(([range, d]) => ({ range, total: d.total, jobs: d.jobs, rank: d.rank }))
           .sort((a,b) => b.rank - a.rank).slice(0, 12);
           
        const yearlyStatements = Object.entries(yearGroups)
           .map(([range, d]) => ({ range, total: d.total, jobs: d.jobs, rank: d.rank }))
           .sort((a,b) => b.rank - a.rank);

        setStatementData({
           daily: dailyStatements,
           weekly: weeklyStatements,
           monthly: monthlyStatements,
           yearly: yearlyStatements
        });

        setMetrics((prev) => ({
          ...prev,
          month: { ...prev.month, earnings: monthEarnings, jobs: monthJobs },
          week: { ...prev.week, earnings: weekEarnings, jobs: weekJobs },
        }));
      } catch (err) {
        console.error("Failed to fetch historical metrics:", err);
      }
    };

    // 2. Fetch Recent Trips via onSnapshot for real-time updates
    const q = query(
      collection(db, "ride_requests"),
      where("driverId", "==", user.uid),
      where("status", "==", "completed"),
      orderBy("completedAt", "desc"),
      limit(3),
    );
    const unsubTrips = onSnapshot(
      q,
      (snap) => {
        setRecentTrips(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        // Refresh historical metrics on new trip completion
        fetchHistoricalMetrics();
      },
      (err) => {
        console.error("Error fetching trips:", err);
      },
    );

    // 3. Fetch Stripe Balance
    const fetchBalance = async () => {
      try {
        const res = await fetch(`/api/driver/stripe-balance/${user.uid}`);
        if (res.ok) {
          const data = await res.json();
          setStripeBalance({ ...data, loading: false });
        }
      } catch (err) {
        console.error("Error fetching balance:", err);
        setStripeBalance((prev) => ({ ...prev, loading: false }));
      }
    };
    fetchBalance();

    return () => {
      unsubGlobalTiers();
      unsubConfig();
      unsubMetrics();
      unsubTrips();
    };
  }, [user]);

  const handleRefresh = async () => {
    if (isRefreshing || !user) return;
    setIsRefreshing(true);

    try {
      const res = await fetch(`/api/driver/stripe-balance/${user.uid}`);
      if (res.ok) {
        const data = await res.json();
        setStripeBalance({ ...data, loading: false });
        toast.success("Balance updated");
      }
    } catch (e) {}

    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleWithdrawal = async () => {
    if (isWithdrawing || !user) return;
    if (stripeBalance.available <= 0) {
      toast.error("No available funds to withdraw.");
      return;
    }

    setIsWithdrawing(true);
    try {
      const res = await fetch(`/api/driver/stripe-payout/${user.uid}`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Withdrawal of £${stripeBalance.available.toFixed(2)} initiated.`);
        handleRefresh();
      } else {
        toast.error(data.error || "Withdrawal failed.");
      }
    } catch (e: any) {
      toast.error(e.message || "An error occurred.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Display logic
  const displayEarnings = metrics[period].earnings || 0;
  const displayGoal = metrics[period].goal;
  const displayJobs = metrics[period].jobs || 0;
  const progress = Math.min(
    100,
    displayGoal > 0 ? Math.round((displayEarnings / displayGoal) * 100) : 0,
  );

  return (
    <div className="flex-1 bg-[#0D0D0F] text-white overflow-y-auto px-4 py-6 font-sans pb-24 min-h-0">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black tracking-tight">Analytics Hub</h1>
        <div className="flex items-center gap-2">
          <div className="bg-[#1A1A1E] rounded-full p-1 flex">
            {(["today", "week"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest leading-none ${period === p ? "bg-[#252529] text-[#00D26A] shadow-sm" : "text-[#E4E4E7]"}`}
              >
                {p}
              </button>
            ))}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center bg-[#1A1A1E] rounded-full border border-[#2C2C30] text-[#A1A1AA] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {/* Stripe Balance Card */}
        <div className="bg-gradient-to-br from-[#AF52DE] to-[#5856D6] rounded-2xl p-4 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/20 rounded-full blur-2xl"></div>
          <div>
            <div className="flex justify-between items-start mb-1">
              <p className="text-[9px] font-black uppercase text-white/70 tracking-widest">
                Stripe Balance
              </p>
              <button
                onClick={handleRefresh}
                className={cn(
                  "opacity-70 hover:opacity-100 transition-opacity",
                  isRefreshing && "animate-spin"
                )}
              >
                <Activity className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tighter">
              {stripeBalance.loading
                ? "..."
                : `£${stripeBalance.available.toFixed(2)}`}
            </h2>
            <p className="text-[8px] font-bold text-white/60 uppercase mt-0.5 tracking-wider">
              Ready for withdrawal
            </p>
          </div>
          <div className="mt-4 bg-white/10 p-2 rounded-xl flex items-center justify-between border border-white/5">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase">
                Pending
              </p>
              <p className="text-xs font-black text-white">
                £{stripeBalance.pending.toFixed(2)}
              </p>
            </div>
            <button
               onClick={handleWithdrawal}
               disabled={isWithdrawing || stripeBalance.available <= 0}
               className={cn(
                 "bg-white text-black px-3 py-1.5 rounded-[0.5rem] text-[9px] font-black uppercase tracking-wider active:scale-95 transition-all",
                 (isWithdrawing || stripeBalance.available <= 0) && "opacity-50 cursor-not-allowed"
               )}
            >
               {isWithdrawing ? "Processing..." : "Withdraw"}
            </button>
          </div>
        </div>

        {/* Main Stat Card - Performance Hub */}
        <motion.div
          key={period}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#1A1A1E] rounded-2xl p-4 border border-[#2C2C30] shadow-xl relative overflow-hidden flex flex-col justify-between"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#00D26A]/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>

          <div>
            <div className="flex justify-between items-start mb-1">
              <p className="text-[8px] font-black uppercase text-[#E4E4E7] tracking-[0.1em]">
                {period === 'today' ? "Today's Net" : "Week's Net"}
              </p>
              <div className="bg-[#00D26A]/10 border border-[#00D26A]/20 px-1 py-0.5 rounded flex items-center">
                <TrendingUp className="w-2.5 h-2.5 text-[#00D26A] mr-0.5" />
                <span className="text-[8px] font-black text-[#00D26A] tracking-tighter">+12%</span>
              </div>
            </div>
            <h1 className="text-2xl font-black tracking-tighter text-white">
              £
              {displayEarnings.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </h1>
          </div>

          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between items-end px-0.5">
              <div className="flex items-center gap-1">
                <p className="text-[8px] font-black text-[#A1A1AA] uppercase tracking-wider">
                  Goal
                </p>
                {!isEditingGoal && (
                  <button onClick={handleEditGoal} className="text-[#A1A1AA] hover:text-[#00D26A] transition-colors p-0.5">
                    <Edit2 className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
              <span className="text-[10px] font-black text-[#00D26A] tracking-tighter">
                {progress}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-[#0D0D0F] rounded-full p-[1px] border border-[#2C2C30]">
              <motion.div
                className="h-full bg-gradient-to-r from-emerald-600 to-[#00D26A] rounded-full shadow-[0_0_8px_rgba(0,210,106,0.3)]"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1, ease: "circOut" }}
              />
            </div>
            {isEditingGoal ? (
              <div className="flex items-center pt-0.5">
                <span className="text-[10px] font-black text-white mr-0.5">£</span>
                <input 
                  type="number"
                  value={editingGoalValue}
                  onChange={(e) => setEditingGoalValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveGoal(); }}
                  className="w-12 bg-transparent border-b border-[#00D26A] text-[10px] font-black text-white outline-none px-0.5 mr-1"
                  autoFocus
                />
                <button onClick={handleSaveGoal} className="text-[#00D26A] hover:bg-[#00D26A]/20 rounded p-0.5 mr-1"><Check className="w-3 h-3" /></button>
                <button onClick={() => setIsEditingGoal(false)} className="text-[#FF3B30] hover:bg-[#FF3B30]/20 rounded p-0.5"><X className="w-3 h-3" /></button>
              </div>
            ) : (
              <p className="text-[9px] font-black text-white px-0.5 leading-none">
                £{displayGoal}
              </p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Real-Time Breakdown Grid */}
      <h2 className="text-[11px] font-black text-white uppercase tracking-[0.25em] mb-4 px-2 flex items-center gap-2">
        <Activity className="w-4 h-4 text-[#00D26A]" /> Session Dynamics
      </h2>

      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-3xl p-5">
          <Zap className="w-5 h-5 text-[#00D26A] mb-3" />
          <p className="text-2xl font-black text-[#00D26A] -mt-1 leading-none">
            {displayJobs}
          </p>
          <p className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider mt-2">
            Trips Done
          </p>
        </div>
        <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-3xl p-5">
          <Star className="w-5 h-5 text-[#FF9500] mb-3" />
          <p className="text-2xl font-black text-[#FF9500] -mt-1 leading-none">
            {/* Hardcoded for now? It was 4.9 */}
            4.9
          </p>
          <p className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider mt-2">
            Driver Rating
          </p>
        </div>
        <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-3xl p-5">
          <ArrowUpRight className="w-5 h-5 text-[#E4E4E7] mb-3" />
          <p className="text-2xl font-black text-white -mt-1 leading-none">
            £{(displayEarnings / (1 - fareConfig.commissionRate)).toFixed(2)}
          </p>
          <p className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider mt-2">
            Gross Fares
          </p>
        </div>
        <div className="bg-[#FF3B30]/5 border border-[#FF3B30]/10 rounded-3xl p-5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-[#FF3B30]/0 to-[#FF3B30]/[0.05] pointer-events-none group-active:opacity-50 transition-opacity"></div>
          <CreditCard className="w-5 h-5 text-[#FF3B30] mb-3 relative z-10" />
          <p className="text-2xl font-black text-[#FF3B30] -mt-1 leading-none relative z-10 flex items-baseline gap-1">
            £{(profile?.pendingPlatformFees || 0).toFixed(2)}
          </p>
          <p className="text-[10px] font-bold text-[#FF3B30]/60 uppercase tracking-wider mt-2 relative z-10">
            Fees Owed
          </p>
          {profile?.pendingPlatformFees > 0 && (
            <button
              onClick={async () => {
                toast.loading("Preparing settlement...");
                try {
                  const res = await fetch("/api/driver/settle-fees", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ driverId: user?.uid }),
                  });
                  const data = await res.json();
                  if (data.url) {
                    window.location.href = data.url;
                  } else {
                    toast.error(data.error || "Failed to initiate settlement");
                  }
                } catch (e) {
                  toast.error("An error occurred");
                }
              }}
              className="absolute top-4 right-4 text-[9px] font-black uppercase text-white bg-[#FF3B30] px-2 py-1 rounded shadow-lg active:scale-95 transition-transform z-20"
            >
              Settle
            </button>
          )}
        </div>
      </div>

      {/* Recent Activity Feed */}
      <h2 className="text-[11px] font-black text-white uppercase tracking-[0.25em] mb-4 px-2 flex items-center gap-2">
        <History className="w-4 h-4 text-[#E4E4E7]" /> Recent Trip Log
      </h2>
      <div className="space-y-3 mb-8">
        {recentTrips.length > 0 ? (
          recentTrips.map((trip) => (
            <div
              key={trip.id}
              className="bg-[#1A1A1E] border border-[#2C2C30] p-4 rounded-3xl flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#252529] flex items-center justify-center">
                  <Car className="w-5 h-5 text-[#E4E4E7]" />
                </div>
                <div className="max-w-[140px]">
                  <p className="text-sm font-bold text-white truncate">
                    {trip.dropoffAddress?.split(",")[0] || "Unknown"}
                  </p>
                  <p className="text-[10px] text-[#A1A1AA] font-bold uppercase mt-0.5">
                    {trip.rideType || "Standard"} •{" "}
                    {new Date(
                      trip.createdAt?.seconds * 1000,
                    ).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-[#00D26A]">
                  £{(trip.fareEstimate || 0).toFixed(2)}
                </p>
                <div className="flex items-center gap-1 justify-end mt-0.5">
                  <ShieldCheck className="w-2.5 h-2.5 text-[#00D26A]" />
                  <span className="text-[9px] font-black text-[#00D26A] uppercase">
                    Paid
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 bg-[#1A1A1E]/50 rounded-3xl border border-dashed border-[#2C2C30]">
            <Activity className="w-8 h-8 text-[#2C2C30] mx-auto mb-2" />
            <p className="text-xs text-[#A1A1AA] font-bold">
              No trips recorded {period === 'today' ? 'today' : `this ${period}`} yet.
            </p>
          </div>
        )}
      </div>

      {/* Advanced Insights */}
      <h2 className="text-[11px] font-black text-white uppercase tracking-[0.25em] mb-4 px-2">
        History & Payouts
      </h2>
      <div className="space-y-2">
        <button onClick={() => setShowEarningStatements(true)} className="w-full bg-[#1A1A1E] border border-[#2C2C30] p-5 rounded-3xl flex items-center justify-between active:scale-[0.98] transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#252529] flex items-center justify-center">
              <Calendar className="w-6 h-6 text-[#00D26A]" />
            </div>
            <div className="text-left">
              <p className="text-sm font-black text-white">Earning Analytics Hub</p>
              <p className="text-[10px] text-[#E4E4E7] font-bold uppercase tracking-wider mt-0.5">
                Daily, Weekly, Monthly, Yearly Overview
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#333338]" />
        </button>
        <button onClick={handleOpenFullHistory} className="w-full bg-[#1A1A1E] border border-[#2C2C30] p-5 rounded-3xl flex items-center justify-between active:scale-[0.98] transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#252529] flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-[#E4E4E7]" />
            </div>
            <div className="text-left">
              <p className="text-sm font-black text-white">Full Trip History</p>
              <p className="text-[10px] text-[#E4E4E7] font-bold uppercase tracking-wider mt-0.5">
                View all completed jobs
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#333338]" />
        </button>
      </div>

      <AnimatePresence>
        {showEarningStatements && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="fixed inset-0 z-50 bg-[#0A0A0B] flex flex-col pt-16"
          >
            <div className="flex-1 overflow-y-auto px-4 pb-24">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">Earning Analytics Hub</h2>
                  <p className="text-[#A1A1AA] text-xs font-bold uppercase tracking-wider mt-1">Daily, Weekly, Monthly, Yearly Overview</p>
                </div>
                <button
                  onClick={() => setShowEarningStatements(false)}
                  className="w-10 h-10 bg-[#1A1A1E] rounded-full flex items-center justify-center border border-[#2C2C30] active:scale-95 transition-all text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-[#1A1A1E] p-1 rounded-2xl flex gap-1 mb-6 border border-[#2C2C30]">
                {['daily', 'weekly', 'monthly', 'yearly'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setStatementPeriod(p as any)}
                    className={`flex-1 py-2 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all ${
                      statementPeriod === p 
                        ? 'bg-[#2C2C30] text-white shadow-sm' 
                        : 'text-[#A1A1AA] hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              
              {/* Overview Cards */}
              <div className="mb-6">
                <div className="flex items-end gap-3 mb-2">
                  <h1 className="text-4xl font-black text-[#00D26A]">
                    £{(statementData[statementPeriod]?.[0]?.total || 0).toFixed(2)}
                  </h1>
                </div>
                <p className="text-xs text-[#A1A1AA] font-bold uppercase tracking-wider mb-6">
                  {statementPeriod === 'daily' ? "Today's Earnings" : `Current ${statementPeriod.charAt(0).toUpperCase() + statementPeriod.slice(1)} Earnings`}
                </p>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-[#1A1A1E] border border-[#2C2C30] p-4 rounded-3xl">
                    <div className="flex items-center gap-2 mb-2">
                       <Car className="w-4 h-4 text-[#E4E4E7]" />
                       <p className="text-[#A1A1AA] text-[10px] font-bold uppercase">Total Trips</p>
                    </div>
                    <p className="text-2xl font-black text-white">{statementData[statementPeriod]?.[0]?.jobs || 0}</p>
                  </div>
                  <div className="bg-[#1A1A1E] border border-[#2C2C30] p-4 rounded-3xl">
                    <div className="flex items-center gap-2 mb-2">
                       <TrendingUp className="w-4 h-4 text-[#00D26A]" />
                       <p className="text-[#A1A1AA] text-[10px] font-bold uppercase">Avg/Trip</p>
                    </div>
                    <p className="text-2xl font-black text-white">
                      £{statementData[statementPeriod]?.[0]?.jobs ? (statementData[statementPeriod][0].total / statementData[statementPeriod][0].jobs).toFixed(2) : "0.00"}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Chart */}
              {statementData[statementPeriod]?.length > 0 && (
                <div className="bg-[#1A1A1E] border border-[#2C2C30] p-4 rounded-3xl mb-6">
                  <p className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider mb-4 px-2">Earnings Trend</p>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      {statementPeriod === 'weekly' || statementPeriod === 'daily' ? (
                        <BarChart data={[...statementData[statementPeriod]].slice(0, 7).reverse().map(d => ({ name: statementPeriod === 'daily' ? d.range.split(',')[0] : d.range.split('-')[0].trim().substring(0, 6), value: d.total }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2C2C30" vertical={false} />
                          <XAxis dataKey="name" stroke="#A1A1AA" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip 
                            cursor={{ fill: '#252529' }}
                            contentStyle={{ backgroundColor: '#1A1A1E', borderColor: '#2C2C30', borderRadius: '12px' }}
                            itemStyle={{ color: '#00D26A', fontWeight: 'bold' }}
                            formatter={(value: number) => [`£${value.toFixed(2)}`, 'Earnings']}
                          />
                          <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      ) : (
                        <AreaChart data={[...statementData[statementPeriod]].slice(0, 6).reverse().map(d => ({ name: statementPeriod === 'monthly' ? d.range.split(' ')[0] : d.range.match(/\d{4}/)?.[0] || d.range, value: d.total }))}>
                          <defs>
                            <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#00D26A" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#00D26A" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2C2C30" vertical={false} />
                          <XAxis dataKey="name" stroke="#A1A1AA" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1A1A1E', borderColor: '#2C2C30', borderRadius: '12px' }}
                            itemStyle={{ color: '#00D26A', fontWeight: 'bold' }}
                            formatter={(value: number) => [`£${value.toFixed(2)}`, 'Earnings']}
                          />
                          <Area type="monotone" dataKey="value" stroke="#00D26A" strokeWidth={3} fillOpacity={1} fill="url(#colorEarnings)" />
                        </AreaChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <p className="text-[11px] font-black text-white uppercase tracking-[0.25em] mb-2 px-2">History List</p>
                {statementData[statementPeriod]?.length === 0 && (
                   <p className="text-center text-[#A1A1AA] text-sm py-4">No data available for this period.</p>
                )}
                {statementData[statementPeriod]?.map((item, idx) => (
                  <button key={idx} className="w-full text-left bg-[#1A1A1E] border border-[#2C2C30] p-5 rounded-3xl active:scale-[0.98] transition-all flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-white">{item.range}</p>
                      <p className="text-[10px] text-[#A1A1AA] font-bold uppercase tracking-wider mt-1">{item.jobs} Trips</p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <p className="text-lg font-black text-[#00D26A]">£{item.total.toFixed(2)}</p>
                      <ChevronRight className="w-5 h-5 text-[#333338]" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {showFullTripHistory && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="fixed inset-0 z-50 bg-[#0A0A0B] flex flex-col pt-16"
          >
            <div className="flex-1 overflow-y-auto px-4 pb-24">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">Full History</h2>
                  <p className="text-[#A1A1AA] text-xs font-bold uppercase tracking-wider mt-1">Recently completed jobs</p>
                </div>
                <button
                  onClick={() => setShowFullTripHistory(false)}
                  className="w-10 h-10 bg-[#1A1A1E] rounded-full flex items-center justify-center border border-[#2C2C30] active:scale-95 transition-all text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {loadingFullTrips ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-[#00D26A] animate-spin mb-4" />
                  <p className="text-sm text-[#A1A1AA] font-medium">Loading history...</p>
                </div>
              ) : fullTrips.length === 0 ? (
                <div className="text-center py-12 bg-[#1A1A1E]/50 rounded-3xl border border-dashed border-[#2C2C30]">
                  <History className="w-10 h-10 text-[#2C2C30] mx-auto mb-3" />
                  <p className="text-sm text-[#E4E4E7] font-bold">No trips found.</p>
                  <p className="text-xs text-[#A1A1AA] font-medium mt-1">Your completed trips will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {fullTrips.map((trip) => (
                    <div
                      key={trip.id}
                      className="bg-[#1A1A1E] border border-[#2C2C30] p-4 rounded-3xl flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#252529] flex items-center justify-center">
                          <Car className="w-5 h-5 text-[#E4E4E7]" />
                        </div>
                        <div className="max-w-[150px]">
                          <p className="text-sm font-bold text-white truncate">
                            {trip.dropoffAddress?.split(",")[0] || "Unknown"}
                          </p>
                          <p className="text-[10px] text-[#A1A1AA] font-bold uppercase mt-0.5">
                            {trip.rideType || "Standard"} •{" "}
                            {new Date(
                              trip.completedAt?.seconds * 1000 || trip.createdAt?.seconds * 1000 || Date.now()
                            ).toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                            {new Date(
                              trip.completedAt?.seconds * 1000 || trip.createdAt?.seconds * 1000 || Date.now()
                            ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-[#00D26A]">
                          £{(trip.fareEstimate || 0).toFixed(2)}
                        </p>
                        <div className="flex items-center gap-1 justify-end mt-0.5">
                          <ShieldCheck className="w-2.5 h-2.5 text-[#00D26A]" />
                          <span className="text-[9px] font-black text-[#00D26A] uppercase">
                            Paid
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

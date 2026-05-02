import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
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

  const handleEditGoal = () => {
    setEditingGoalValue(metrics[period].goal.toString());
    setIsEditingGoal(true);
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

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const createdAt =
            data.completedAt?.toDate() || data.createdAt?.toDate();
          if (!createdAt) return;

          if (createdAt >= monthStart) {
            monthEarnings += data.finalFare || 0;
            monthJobs++;
          }
          if (createdAt >= weekStart) {
            weekEarnings += data.finalFare || 0;
            weekJobs++;
          }
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

    fetchHistoricalMetrics();

    // 2. Fetch Recent Trips via onSnapshot for real-time updates
    const q = query(
      collection(db, "ride_requests"),
      where("driverId", "==", user.uid),
      where("status", "==", "completed"),
      orderBy("completedAt", "desc"),
      limit(5),
    );
    const unsubTrips = onSnapshot(
      q,
      (snap) => {
        setRecentTrips(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
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
            {(["today", "week", "month"] as const).map((p) => (
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

      {/* Stripe Balance Card */}
      <div className="bg-gradient-to-br from-[#AF52DE] to-[#5856D6] rounded-[2.5rem] p-6 mb-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/20 rounded-full blur-2xl"></div>
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-[10px] font-black uppercase text-white/70 tracking-widest mb-1">
              Stripe Balance
            </p>
            <h2 className="text-3xl font-black text-white">
              {stripeBalance.loading
                ? "..."
                : `£${stripeBalance.available.toFixed(2)}`}
            </h2>
            <p className="text-[10px] font-bold text-white/50 uppercase mt-1">
              Ready for withdrawal
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className={cn(
              "bg-white/20 p-2 rounded-xl backdrop-blur-md transition-transform",
              isRefreshing && "animate-spin",
            )}
          >
            <Activity className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="flex gap-4">
          <div className="flex gap-4">
            <p className="text-[10px] text-white/60 font-bold italic">
              * Payouts are managed automatically via Stripe Connect.
            </p>
          </div>
          <div className="bg-white/10 px-4 py-2 rounded-2xl flex flex-col justify-center">
            <p className="text-[8px] font-black text-white/60 uppercase">
              Pending
            </p>
            <p className="text-xs font-black text-white">
              £{stripeBalance.pending.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Main Stat Card - Performance Hub */}
      <motion.div
        key={period}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#1A1A1E] rounded-[2.5rem] p-8 border border-[#2C2C30] shadow-[0_20px_50px_rgba(0,0,0,0.5)] mb-6 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>

        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-[10px] font-black uppercase text-[#E4E4E7] tracking-[0.2em] mb-2 px-1">
              Net Revenue
            </p>
            <h1 className="text-[56px] leading-[0.9] font-black tracking-tighter text-white">
              £
              {displayEarnings.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </h1>
          </div>
          <div className="bg-[#00D26A]/10 border border-[#00D26A]/20 px-3 py-1.5 rounded-full">
            <p className="text-[10px] font-black text-[#00D26A] tracking-tighter flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +12%
            </p>
          </div>
        </div>

        {/* Goal Indicator */}
        <div className="space-y-3">
          <div className="flex justify-between items-end px-1">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[9px] font-black text-[#A1A1AA] uppercase tracking-widest">
                  Progress to {period === 'today' ? 'Daily' : period === 'week' ? 'Weekly' : 'Monthly'} Goal
                </p>
                {!isEditingGoal && (
                  <button onClick={handleEditGoal} className="text-[#A1A1AA] hover:text-[#00D26A] transition-colors p-0.5 rounded-sm outline-none">
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-[#00D26A]" />
                {isEditingGoal ? (
                  <div className="flex items-center">
                    <span className="text-sm font-black text-white mr-0.5">£</span>
                    <input 
                      type="number"
                      value={editingGoalValue}
                      onChange={(e) => setEditingGoalValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveGoal(); }}
                      className="w-16 bg-transparent border-b border-[#00D26A] text-sm font-black text-white outline-none px-0.5 mr-2"
                      autoFocus
                    />
                    <button onClick={handleSaveGoal} className="bg-[#00D26A] text-[#1A1A1E] rounded-full p-1 active:scale-95 transition-transform flex items-center justify-center w-5 h-5 mr-1.5">
                      <Check className="w-3 h-3" />
                    </button>
                    <button onClick={() => setIsEditingGoal(false)} className="bg-[#FF3B30]/20 text-[#FF3B30] rounded-full p-1 active:scale-95 transition-transform flex items-center justify-center w-5 h-5">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <span className="text-sm font-black text-white px-0.5">
                    £{displayGoal}
                  </span>
                )}
              </div>
            </div>
            <span className="text-xl font-black text-[#00D26A] tracking-tighter">
              {progress}%
            </span>
          </div>
          <div className="h-3 w-full bg-[#0D0D0F] rounded-full p-0.5 border border-[#2C2C30]">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-600 to-[#00D26A] rounded-full shadow-[0_0_10px_rgba(0,210,106,0.3)]"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1.5, ease: "circOut" }}
            />
          </div>
        </div>
      </motion.div>

      {/* Real-Time Breakdown Grid */}
      <h2 className="text-[11px] font-black text-white uppercase tracking-[0.25em] mb-4 px-2 flex items-center gap-2">
        <Activity className="w-4 h-4 text-[#00D26A]" /> Session Dynamics
      </h2>

      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-3xl p-5">
          <ArrowUpRight className="w-5 h-5 text-[#E4E4E7] mb-3" />
          <p className="text-2xl font-black text-white -mt-1 leading-none">
            £{(displayEarnings / (1 - fareConfig.commissionRate)).toFixed(2)}
          </p>
          <p className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider mt-2">
            Gross Fares
          </p>
        </div>
        <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-3xl p-5">
          <Star className="w-5 h-5 text-[#FF9500] mb-3" />
          <p className="text-2xl font-black text-[#FF9500] -mt-1 leading-none">
            4.9
          </p>
          <p className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider mt-2">
            Driver Rating
          </p>
        </div>
        <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-3xl p-5">
          <Zap className="w-5 h-5 text-[#00D26A] mb-3" />
          <p className="text-2xl font-black text-[#00D26A] -mt-1 leading-none">
            {displayJobs}
          </p>
          <p className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider mt-2">
            Trips Done
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
        <button className="w-full bg-[#1A1A1E] border border-[#2C2C30] p-5 rounded-3xl flex items-center justify-between active:scale-[0.98] transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#252529] flex items-center justify-center">
              <Calendar className="w-6 h-6 text-[#00D26A]" />
            </div>
            <div className="text-left">
              <p className="text-sm font-black text-white">Weekly Statements</p>
              <p className="text-[10px] text-[#E4E4E7] font-bold uppercase tracking-wider mt-0.5">
                APR 14 - APR 21
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#333338]" />
        </button>
        <button className="w-full bg-[#1A1A1E] border border-[#2C2C30] p-5 rounded-3xl flex items-center justify-between active:scale-[0.98] transition-all">
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
    </div>
  );
}

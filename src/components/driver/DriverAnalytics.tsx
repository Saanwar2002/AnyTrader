import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  BarChart3,
  X,
  Star,
  Activity,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Award,
  Zap,
  Loader2,
  Sparkles
} from "lucide-react";
import { useAuth } from "../AuthProvider";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { name: "6am", demand: 20 },
  { name: "9am", demand: 80 },
  { name: "12pm", demand: 45 },
  { name: "3pm", demand: 40 },
  { name: "6pm", demand: 90 },
  { name: "9pm", demand: 75 },
  { name: "12am", demand: 30 },
];

export default function DriverAnalytics({ onClose }: { onClose?: () => void }) {
  const { profile } = useAuth();
  const [pulseTip, setPulseTip] = useState<string | null>(null);
  const [loadingPulse, setLoadingPulse] = useState(false);
  
  // Safely fallback stats
  const rating = profile?.rating?.toFixed(2) || "4.92";
  const acceptance = profile?.acceptanceRate || "94%";
  const cancellation = profile?.cancellationRate || "2%";
  const responseTime = profile?.avgResponseTime || "8s";

  useEffect(() => {
    const fetchPulse = async () => {
      setLoadingPulse(true);
      try {
        const res = await fetch("/api/driver/analytics-pulse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            driverStats: { rating, acceptance, cancellation, responseTime }
          })
        });
        const d = await res.json();
        if (d.insight) {
          setPulseTip(d.insight);
        }
      } catch (err) {
        setPulseTip("Drive near the city center during rush hours for higher payout.");
      }
      setLoadingPulse(false);
    };
    fetchPulse();
  }, [rating, acceptance, cancellation, responseTime]);

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[150] bg-[#0D0D0F] overflow-y-auto pb-32"
    >
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0D0D0F]/90 backdrop-blur-md pt-12 pb-4 px-6 border-b border-[#2C2C30] flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#00D26A]" />
            Analytics Hub
          </h1>
          <p className="text-[#A1A1AA] text-xs font-bold uppercase tracking-widest mt-1">Live Performance Data</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center bg-[#1A1A1E] rounded-full border border-[#2C2C30] text-[#A1A1AA] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="p-6">
        
        {/* Gamification Callout */}
        <div className="bg-gradient-to-r from-[#00D26A]/20 to-transparent border border-[#00D26A]/30 p-4 rounded-3xl mb-8 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#00D26A]/20 flex items-center justify-center flex-shrink-0">
            <Award className="w-6 h-6 text-[#00D26A]" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white">Top 15% Earner</h3>
            <p className="text-xs text-[#00D26A] font-bold">You are in the top tier of drivers in your zone this week.</p>
          </div>
        </div>

        <h2 className="text-[11px] font-black text-white uppercase tracking-[0.25em] mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#A1A1AA]" /> Operational Stats
        </h2>

        {/* 2x2 Grid of KPIs */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-[#1A1A1E] border border-[#2C2C30] p-5 rounded-[2rem] flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-[#00D26A]" />
              <p className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-widest">Acceptance</p>
            </div>
            <p className="text-3xl font-black text-white">{acceptance}</p>
          </div>

          <div className="bg-[#1A1A1E] border border-[#2C2C30] p-5 rounded-[2rem] flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-4 h-4 text-[#FF3B30]" />
              <p className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-widest">Cancellations</p>
            </div>
            <p className="text-3xl font-black text-white">{cancellation}</p>
          </div>

          <div className="bg-[#1A1A1E] border border-[#2C2C30] p-5 rounded-[2rem] flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-[#FF9500]" />
              <p className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-widest">Rating</p>
            </div>
            <p className="text-3xl font-black text-white">{rating}</p>
          </div>

          <div className="bg-[#1A1A1E] border border-[#2C2C30] p-5 rounded-[2rem] flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-[#007AFF]" />
              <p className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-widest">Avg Response</p>
            </div>
            <p className="text-3xl font-black text-white">{responseTime}</p>
          </div>
        </div>

        <h2 className="text-[11px] font-black text-white uppercase tracking-[0.25em] mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#A1A1AA]" /> Peak Demand Heatmap
        </h2>

        {/* Heatmap/Chart */}
        <div className="bg-[#1A1A1E] border border-[#2C2C30] p-6 rounded-[2rem] h-64 mb-6 relative">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis dataKey="name" stroke="#A1A1AA" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1A1A1E', borderColor: '#2C2C30', borderRadius: '1rem', color: '#fff', fontSize: '12px', fontWeight: 'bold' }} 
                itemStyle={{ color: '#00D26A' }}
              />
              <Line type="monotone" dataKey="demand" stroke="#00D26A" strokeWidth={4} dot={{ r: 4, fill: '#00D26A', strokeWidth: 2 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* AI Insight Pulse */}
        <div className="w-full bg-[#AF52DE]/10 border border-[#AF52DE]/20 rounded-2xl p-4 flex gap-3 mt-4 items-start relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#AF52DE]/10 blur-3xl rounded-full"></div>
          <div className="bg-[#AF52DE]/20 p-2 rounded-full shrink-0">
            <Sparkles className="w-4 h-4 text-[#AF52DE]" />
          </div>
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#AF52DE] mb-1">AI Smart Pulse</h4>
            {loadingPulse ? (
               <div className="flex items-center gap-2">
                 <Loader2 className="w-3 h-3 text-[#E4E4E7] animate-spin" />
                 <p className="text-xs text-[#E4E4E7] font-medium leading-relaxed">Analyzing your trends...</p>
               </div>
            ) : (
               <p className="text-sm text-white font-medium leading-relaxed">
                 {pulseTip || "💡 Next peak starts around 5:00 PM today"}
               </p>
            )}
          </div>
        </div>

      </div>
    </motion.div>
  );
}

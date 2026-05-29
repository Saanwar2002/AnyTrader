import React from "react";
import { 
  BarChart, 
  Bar, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Activity, 
  DollarSign, 
  Download, 
  HelpCircle,
  Award,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";

interface HourlyDistribution {
  hourCode: string;
  onDemandTrips: number;
}

interface FinancialMilestone {
  dayStr: string;
  platformSplitMoney: number;
  totalDriverPayout: number;
}

const hourlySample: HourlyDistribution[] = [
  { hourCode: "06:00", onDemandTrips: 12 },
  { hourCode: "08:00", onDemandTrips: 45 },
  { hourCode: "10:00", onDemandTrips: 28 },
  { hourCode: "12:00", onDemandTrips: 35 },
  { hourCode: "14:00", onDemandTrips: 22 },
  { hourCode: "16:00", onDemandTrips: 58 },
  { hourCode: "18:00", onDemandTrips: 79 },
  { hourCode: "20:00", onDemandTrips: 50 },
  { hourCode: "22:00", onDemandTrips: 31 }
];

const dailyFinanceTrend: FinancialMilestone[] = [
  { dayStr: "Mon", platformSplitMoney: 145, totalDriverPayout: 1060 },
  { dayStr: "Tue", platformSplitMoney: 180, totalDriverPayout: 1320 },
  { dayStr: "Wed", platformSplitMoney: 154, totalDriverPayout: 1130 },
  { dayStr: "Thu", platformSplitMoney: 220, totalDriverPayout: 1610 },
  { dayStr: "Fri", platformSplitMoney: 310, totalDriverPayout: 2270 },
  { dayStr: "Sat", platformSplitMoney: 380, totalDriverPayout: 2780 },
  { dayStr: "Sun", platformSplitMoney: 290, totalDriverPayout: 2125 }
];

export default function Analytics() {
  
  const handleExportCSV = () => {
    // Simulate formatting CSV and triggering download safely
    const customCSV = `Date,TotalRides,GrossCommissions,DriverPayout,AverageWaitSeconds\n2026-05-25,124,145.00,1060.00,185\n2026-05-26,145,180.00,1320.00,165\n2026-05-27,132,154.00,1130.00,192\n2026-05-28,198,220.00,1610.00,154`;
    const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(customCSV);
    
    const clickLink = document.createElement('a');
    clickLink.setAttribute('href', dataUri);
    clickLink.setAttribute('download', 'AnyRoller_Business_Performance.csv');
    document.body.appendChild(clickLink);
    clickLink.click();
    document.body.removeChild(clickLink);

    toast.success("Business logs exported in CSV format successfully.");
  };

  return (
    <div className="space-y-6">
      {/* Intro Header HUD */}
      <div className="p-5 bg-white border border-black rounded-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#AF52DE] font-bold">EXECUTIVE INTELLIGENCE HUD</span>
          </div>
          <h2 className="text-xl font-bold text-black font-sans">Enterprise Business Analytics</h2>
          <p className="text-xs text-slate-500 mt-1">
            Audit peak riding timelines, track performance coefficient metrics of the dispatch matching grids, and extract CSV ledger sheets.
          </p>
        </div>

        {/* CSV Extract Button */}
        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-black hover:bg-slate-900 border border-black text-white text-xs font-mono font-black uppercase rounded tracking-wider transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <Download className="w-4 h-4 text-emerald-400" /> Export performance sheets
        </button>
      </div>

      {/* Analytics KPI counters row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* KPI 1 */}
        <div className="bg-white border border-black rounded-lg p-4 shadow-sm flex items-center gap-3 font-sans">
          <div className="p-2.5 bg-slate-50 border border-black/10 rounded">
            <Activity className="w-5 h-5 text-emerald-600 animate-pulse" />
          </div>
          <div>
            <span className="text-[9.5px] uppercase font-mono text-slate-400 block font-bold">Platform Health</span>
            <span className="text-lg font-black text-black font-mono">99.2%</span>
            <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">Optimal response time</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white border border-black rounded-lg p-4 shadow-sm flex items-center gap-3 font-sans">
          <div className="p-2.5 bg-slate-50 border border-black/10 rounded">
            <Clock className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <span className="text-[9.5px] uppercase font-mono text-slate-400 block font-bold">Avg Wait Timer</span>
            <span className="text-lg font-black text-black font-mono">2.8 min</span>
            <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">▼ 12s on last week</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white border border-black rounded-lg p-4 shadow-sm flex items-center gap-3 font-sans">
          <div className="p-2.5 bg-slate-50 border border-black/10 rounded">
            <DollarSign className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <span className="text-[9.5px] uppercase font-mono text-slate-400 block font-bold">Average Quote</span>
            <span className="text-lg font-black text-black font-mono">£18.40</span>
            <span className="text-[10px] text-indigo-600 font-bold block mt-0.5">▲ 5.5% peak density</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white border border-black rounded-lg p-4 shadow-sm flex items-center gap-3 font-sans">
          <div className="p-2.5 bg-slate-50 border border-black/10 rounded">
            <TrendingUp className="w-5 h-5 text-[#AF52DE]" />
          </div>
          <div>
            <span className="text-[9.5px] uppercase font-mono text-slate-400 block font-bold">Completed rides</span>
            <span className="text-lg font-black text-black font-mono">2,340</span>
            <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">▲ 22.4% monthly scale</span>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Hourly Distribution (BarChart) */}
        <div className="bg-white border border-black rounded-lg p-5 shadow-sm space-y-4">
          <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider border-b border-slate-100 pb-2.5 flex items-center gap-1">
            <Sparkles className="w-4 h-4 text-amber-500" /> Ride Frequency Hourly Distribution
          </h3>

          <div className="h-60 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlySample} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="hourCode" stroke="#94A3B8" fontSize={11} fontStyle="italic" />
                <YAxis stroke="#94A3B8" fontSize={11} />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.03)' }} 
                  contentStyle={{ background: '#fff', border: '1px solid black', fontFamily: 'sans-serif', fontSize: '12px' }}
                />
                <Bar dataKey="onDemandTrips" fill="black" name="Daily completed dispatches" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Daily split revenues (AreaChart) */}
        <div className="bg-white border border-black rounded-lg p-5 shadow-sm space-y-4">
          <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider border-b border-slate-100 pb-2.5 flex items-center gap-1">
            <TrendingUp className="w-4 h-4 text-[#AF52DE]" /> Financial Platform Commissions Split Trends (£)
          </h3>

          <div className="h-60 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyFinanceTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSplit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="dayStr" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid black', fontFamily: 'sans-serif', fontSize: '12px' }} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="platformSplitMoney" name="Platform split commissions (12%)" stroke="#10b981" fillOpacity={1} fill="url(#colorSplit)" strokeWidth={2} />
                <Area type="monotone" dataKey="totalDriverPayout" name="Direct-to-driver split payouts (88%)" stroke="#2563eb" fillOpacity={0} strokeWidth={1} strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}

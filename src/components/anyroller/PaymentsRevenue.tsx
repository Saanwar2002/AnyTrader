import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  DollarSign, ArrowUpRight, ArrowDownRight, CreditCard, 
  Download, Filter, Search, TrendingUp, Wallet, Banknote, RefreshCcw, Loader2
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/src/firebase";
import { format, subDays, startOfDay } from "date-fns";

const StatCard = ({ title, value, subtitle, icon: Icon, trend, trendUp }: any) => (
  <div className="bg-white p-6 border border-black rounded-xl shadow-sm flex flex-col justify-between">
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-black">{value}</h3>
      </div>
      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-black">
        <Icon size={24} />
      </div>
    </div>
    <div className="flex items-center text-sm">
      <span className={`flex items-center font-bold ${trendUp ? 'text-green-600' : 'text-red-500'}`}>
        {trendUp ? <ArrowUpRight size={16} className="mr-1" /> : <ArrowDownRight size={16} className="mr-1" />}
        {trend}
      </span>
      <span className="text-gray-400 ml-2 font-medium">{subtitle}</span>
    </div>
  </div>
);

const PaymentsRevenue = () => {
  const [timeRange, setTimeRange] = useState("7D");
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState({
    grossVolume: 0,
    platformRevenue: 0,
    routedToDrivers: 0,
    avgTxSize: 0,
    grossToday: 0,
    platformToday: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "ride_requests"),
          where("status", "==", "completed"),
          orderBy("completedAt", "desc"),
          limit(100)
        );
        const snapshot = await getDocs(q);
        const txs: any[] = [];
        let totalGross = 0;
        let todayGross = 0;
        let todayPlatform = 0;

        const now = new Date();
        const startOfToday = startOfDay(now);
        
        // Group by day for the last 7 days
        const daysMap = new Map();
        for (let i = 6; i >= 0; i--) {
          const d = subDays(now, i);
          daysMap.set(format(d, 'EEE'), { name: format(d, 'EEE'), revenue: 0, fee: 0 });
        }

        snapshot.forEach(doc => {
          const data = doc.data();
          const fare = data.finalFare || data.fareEstimate || 0;
          const fee = fare * 0.12;
          
          let completedDate = now;
          if (data.completedAt) {
            completedDate = data.completedAt.toDate ? data.completedAt.toDate() : new Date(data.completedAt.seconds * 1000);
          } else if (data.createdAt) {
            completedDate = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt.seconds * 1000);
          }
          
          txs.push({
            id: `TRX-${doc.id.slice(-6).toUpperCase()}`,
            date: format(completedDate, "yyyy-MM-dd HH:mm"),
            type: "Ride Payment",
            amount: `£${fare.toFixed(2)}`,
            fee: `£${fee.toFixed(2)}`,
            status: "Completed",
            method: data.paymentMethod === "cash" ? "Cash" : "Stripe QR",
            rawFare: fare
          });

          totalGross += fare;

          if (completedDate >= startOfToday) {
            todayGross += fare;
            todayPlatform += fee;
          }

          const dayName = format(completedDate, 'EEE');
          if (daysMap.has(dayName)) {
            const dayData = daysMap.get(dayName);
            dayData.revenue += fare;
            dayData.fee += fee;
          }
        });

        setTransactions(txs);
        setChartData(Array.from(daysMap.values()));

        const platformRev = totalGross * 0.12;
        setStats({
          grossVolume: totalGross,
          platformRevenue: platformRev,
          routedToDrivers: totalGross - platformRev,
          avgTxSize: txs.length ? totalGross / txs.length : 0,
          grossToday: todayGross,
          platformToday: todayPlatform
        });
      } catch (err) {
        console.error("Error fetching revenue data:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [timeRange]);

  const filteredTx = transactions.filter(t => t.id.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black flex items-center">
            <DollarSign className="mr-2 text-green-600" />
            Financial Center
          </h1>
          <p className="text-gray-500 text-sm mt-1">Monitor platform revenue and Stripe Connect split transactions.</p>
        </div>
        
        <div className="flex gap-3">
          <button className="flex items-center gap-2 bg-white border border-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors shadow-sm">
            <RefreshCcw size={16} />
            Sync Stripe
          </button>
          <button className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg text-sm font-bold shadow-[0_2px_0_rgb(100,100,100)] active:translate-y-[1px] active:shadow-none transition-all">
            <Download size={16} />
            Export Report
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-black" />
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              title={`Gross Volume (${timeRange})`} 
              value={`£${stats.grossVolume.toFixed(2)}`} 
              subtitle="vs previous period"
              icon={Wallet} 
              trend="+8.4%" 
              trendUp={true} 
            />
            <StatCard 
              title="Platform Revenue (12%)" 
              value={`£${stats.platformRevenue.toFixed(2)}`} 
              subtitle="vs previous period"
              icon={TrendingUp} 
              trend="+8.4%" 
              trendUp={true} 
            />
            <StatCard 
              title={`Routed to Drivers (${timeRange})`} 
              value={`£${stats.routedToDrivers.toFixed(2)}`} 
              subtitle="Direct via Stripe Connect"
              icon={Banknote} 
              trend="+8.4%" 
              trendUp={true} 
            />
            <StatCard 
              title="Avg. Transaction Size" 
              value={`£${stats.avgTxSize.toFixed(2)}`} 
              subtitle="vs previous period"
              icon={CreditCard} 
              trend="+1.2%" 
              trendUp={true} 
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Charts Column */}
            <div className="xl:col-span-2 space-y-6">
              <div className="bg-white border border-black rounded-xl shadow-sm p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-black">Revenue Breakdown</h2>
                  <div className="flex bg-gray-100 p-1 rounded-lg">
                    {["1D", "7D", "1M", "3M", "1Y"].map((range) => (
                      <button 
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${timeRange === range ? 'bg-white text-black shadow-sm border border-gray-200' : 'text-gray-500 hover:text-black'}`}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 500 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 500 }} dx={-10} tickFormatter={(val) => `£${val}`} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: '1px solid black', boxShadow: '4px 4px 0px rgba(0,0,0,1)', padding: '12px' }}
                        itemStyle={{ fontWeight: 600 }}
                        cursor={{ fill: '#F3F4F6' }}
                      />
                      <Bar dataKey="revenue" name="Total Gross" fill="#000000" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      <Bar dataKey="fee" name="Platform Fee (12%)" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Quick Actions & Summaries */}
            <div className="space-y-6">
              <div className="bg-white border border-black rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-bold text-black mb-4">Stripe Connect Activity</h2>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <span className="font-bold text-sm">Directly Routed Today</span>
                    </div>
                    <span className="font-bold">£{(stats.grossToday - stats.platformToday).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className="font-bold text-sm">Platform Comm. Today</span>
                    </div>
                    <span className="font-bold">£{stats.platformToday.toFixed(2)}</span>
                  </div>
                  <button className="w-full mt-2 py-2 bg-black text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-colors">
                    Open Stripe Dashboard
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white border border-black rounded-xl shadow-sm overflow-hidden mt-6">
            <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
              <h2 className="text-lg font-bold text-black w-full md:w-auto">Recent Transactions</h2>
              <div className="flex gap-2 w-full md:w-auto">
                <div className="relative group flex-1 md:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search ID..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all"
                  />
                </div>
                <button className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center">
                  <Filter size={16} />
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <th className="px-6 py-3 font-bold">Transaction ID / Date</th>
                    <th className="px-6 py-3 font-bold">Type</th>
                    <th className="px-6 py-3 font-bold">Method</th>
                    <th className="px-6 py-3 font-bold text-right">Gross Amount</th>
                    <th className="px-6 py-3 font-bold text-right">Platform Fee</th>
                    <th className="px-6 py-3 font-bold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredTx.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500 font-medium">
                        No transactions found
                      </td>
                    </tr>
                  ) : filteredTx.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50 transition-colors text-sm">
                      <td className="px-6 py-4">
                        <div className="font-bold text-black">{tx.id}</div>
                        <div className="text-xs text-gray-500 mt-1">{tx.date}</div>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-700">{tx.type}</td>
                      <td className="px-6 py-4 text-gray-600">{tx.method}</td>
                      <td className={`px-6 py-4 text-right font-bold ${tx.amount.startsWith('-') ? 'text-red-600' : 'text-black'}`}>
                        {tx.amount}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-green-700">{tx.fee}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${
                          tx.status === 'Completed' ? 'bg-green-100 text-green-700 border-green-200' :
                          tx.status === 'Processing' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                          'bg-gray-100 text-gray-700 border-gray-200'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PaymentsRevenue;

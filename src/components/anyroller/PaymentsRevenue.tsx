import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
  DollarSign, ArrowUpRight, ArrowDownRight, CreditCard, 
  Download, Filter, Search, TrendingUp, Wallet, Banknote, RefreshCcw
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";

// Mock Data
const revenueData = [
  { name: 'Mon', revenue: 4200, fee: 504 },
  { name: 'Tue', revenue: 3800, fee: 456 },
  { name: 'Wed', revenue: 5100, fee: 612 },
  { name: 'Thu', revenue: 4900, fee: 588 },
  { name: 'Fri', revenue: 7500, fee: 900 },
  { name: 'Sat', revenue: 9200, fee: 1104 },
  { name: 'Sun', revenue: 8400, fee: 1008 },
];

const recentTransactions = [
  { id: "TRX-94812", date: "2026-06-01 14:22", type: "Ride Payment", amount: "£45.00", fee: "£5.40", status: "Completed", method: "Apple Pay" },
  { id: "TRX-94811", date: "2026-06-01 14:15", type: "Ride Payment", amount: "£32.50", fee: "£3.90", status: "Completed", method: "Apple Pay" },
  { id: "TRX-94810", date: "2026-06-01 13:45", type: "Ride Payment", amount: "£18.50", fee: "£2.22", status: "Completed", method: "Visa •••• 4242" },
  { id: "TRX-94809", date: "2026-06-01 12:30", type: "Refund", amount: "-£12.50", fee: "-£1.50", status: "Completed", method: "Mastercard •••• 1121" },
  { id: "TRX-94808", date: "2026-06-01 11:20", type: "Ride Payment", amount: "£85.00", fee: "£10.20", status: "Completed", method: "Stripe QR" },
];

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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Gross Volume (7d)" 
          value="£43,100" 
          subtitle="vs previous 7 days"
          icon={Wallet} 
          trend="+14.2%" 
          trendUp={true} 
        />
        <StatCard 
          title="Platform Revenue (12%)" 
          value="£5,172" 
          subtitle="vs previous 7 days"
          icon={TrendingUp} 
          trend="+14.2%" 
          trendUp={true} 
        />
        <StatCard 
          title="Routed to Drivers (7d)" 
          value="£37,928" 
          subtitle="Direct via Stripe Connect"
          icon={Banknote} 
          trend="+14.2%" 
          trendUp={true} 
        />
        <StatCard 
          title="Avg. Transaction Size" 
          value="£24.50" 
          subtitle="vs previous 7 days"
          icon={CreditCard} 
          trend="+1.5%" 
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
                <BarChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                <span className="font-bold">£4,250.00</span>
              </div>
              <div className="flex justify-between items-center p-3 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="font-bold text-sm">Platform Comm. Today</span>
                </div>
                <span className="font-bold">£510.00</span>
              </div>
              <button className="w-full mt-2 py-2 bg-black text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-colors">
                Open Stripe Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white border border-black rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-lg font-bold text-black w-full md:w-auto">Recent Transactions</h2>
          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative group flex-1 md:w-64">
              <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search ID..." 
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
              {recentTransactions.map((tx) => (
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
    </div>
  );
};

export default PaymentsRevenue;


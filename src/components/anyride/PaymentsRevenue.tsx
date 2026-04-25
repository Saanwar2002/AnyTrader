import React, { useState } from "react";
import { DollarSign, Upload, Search, Download, CreditCard, PieChart, TrendingUp } from "lucide-react";
import { cn } from "@/src/lib/utils";

export default function PaymentsRevenue() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Payments & Revenue
          </h2>
          <p className="text-slate-500 font-medium">Stripe Connect overview, platform revenue, and QR payment funnel.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* KPI Cards */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm col-span-1">
           <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <DollarSign className="w-5 h-5 text-emerald-600" />
           </div>
           <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Platform Revenue (30d)</p>
           <h3 className="text-3xl font-black text-slate-900">£18,420.50</h3>
           <p className="text-sm font-bold text-emerald-500 mt-2 flex items-center gap-1">
             <TrendingUp className="w-4 h-4" /> +14.2% vs last month
           </p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm col-span-1">
           <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
              <PieChart className="w-5 h-5 text-indigo-600" />
           </div>
           <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">QR Scan-to-Pay Adoption</p>
           <h3 className="text-3xl font-black text-slate-900">92.4%</h3>
           <div className="w-full bg-slate-100 h-2 rounded-full mt-4 overflow-hidden">
              <div className="bg-indigo-500 w-[92.4%] h-full rounded-full"></div>
           </div>
           <p className="text-xs text-slate-500 mt-2">Target: 95%</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm col-span-1">
           <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mb-4">
              <CreditCard className="w-5 h-5 text-blue-600" />
           </div>
           <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Stripe Connect Balance</p>
           <h3 className="text-3xl font-black text-slate-900">£4,250.00</h3>
           <p className="text-sm font-bold text-slate-500 mt-2">Available to payout</p>
           <button className="mt-4 w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors">
              Initiate Payout
           </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <h3 className="text-sm font-black text-slate-900">Recent Transactions</h3>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search TxID or Driver..." 
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                />
              </div>
              <button className="p-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors shrink-0 flex items-center gap-2">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline text-xs font-bold">Export CSV</span>
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto min-w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4 whitespace-nowrap">Date / Time</th>
                  <th className="px-6 py-4 whitespace-nowrap">TxID</th>
                  <th className="px-6 py-4 whitespace-nowrap">Driver</th>
                  <th className="px-6 py-4 whitespace-nowrap">Gross Fare</th>
                  <th className="px-6 py-4 whitespace-nowrap">Platform Fee (12%)</th>
                  <th className="px-6 py-4 whitespace-nowrap">Driver Payout</th>
                  <th className="px-6 py-4 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[
                  { id: "pi_3P...", date: "18 Apr, 14:32", driver: "Ahmed K.", gross: 12.50, fee: 1.50, net: 11.00, status: "succeeded" },
                  { id: "pi_4X...", date: "18 Apr, 14:15", driver: "Sarah M.", gross: 24.00, fee: 2.88, net: 21.12, status: "succeeded" },
                  { id: "pi_2A...", date: "18 Apr, 13:50", driver: "Mike T.", gross: 8.50, fee: 1.02, net: 7.48, status: "pending" },
                  { id: "pi_9C...", date: "18 Apr, 13:20", driver: "Ahmed K.", gross: 45.00, fee: 5.40, net: 39.60, status: "succeeded" },
                  { id: "pi_1Z...", date: "18 Apr, 12:45", driver: "Raj P.", gross: 15.20, fee: 1.82, net: 13.38, status: "failed" },
                ].map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 font-medium">{tx.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-mono font-bold text-slate-500">{tx.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-900">{tx.driver}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-black text-slate-900">£{tx.gross.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-emerald-600">£{tx.fee.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-600">£{tx.net.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <span className={cn(
                         "px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest",
                         tx.status === "succeeded" ? "bg-emerald-50 text-emerald-600" : 
                         tx.status === "pending" ? "bg-amber-50 text-amber-600" :
                         "bg-rose-50 text-rose-600"
                       )}>
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
}

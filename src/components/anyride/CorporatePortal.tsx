import React, { useState } from "react";
import { Users, Building2, CreditCard, Download, Search, Plus, MapPin, Calendar, Clock, DollarSign, Settings, Bell, ChevronRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/src/lib/utils";

export default function CorporatePortal() {
  const [activeTab, setActiveTab] = useState<"overview" | "employees" | "rides" | "billing">("overview");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg">
              AC
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Acme Corp Ltd.</h1>
              <p className="text-slate-500 font-medium flex items-center gap-2">
                <Building2 className="w-4 h-4" /> AnyRide Corporate Account
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md text-[10px] font-black uppercase tracking-wider ml-2">Active</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50 flex items-center gap-2 shadow-sm transition-all">
              <Download className="w-4 h-4" /> Export Report
            </button>
            <button className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 flex items-center gap-2 shadow-sm transition-all shadow-blue-600/20">
              <Plus className="w-4 h-4" /> Invite Employee
            </button>
          </div>
        </header>

        {/* Navigation */}
        <nav className="flex gap-2 p-1 bg-slate-200/50 rounded-xl w-fit overflow-x-auto">
          {[
            { id: "overview", label: "Overview", icon: Building2 },
            { id: "employees", label: "Employees", icon: Users },
            { id: "rides", label: "Ride History", icon: MapPin },
            { id: "billing", label: "Billing & Invoices", icon: CreditCard },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap",
                activeTab === tab.id 
                  ? "bg-white text-blue-900 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
              {[
                { label: "Total Spend (This Month)", value: "£2,150", icon: DollarSign, trend: "+12%" },
                { label: "Active Employees", value: "42", icon: Users, trend: "+3" },
                { label: "Total Rides Taken", value: "128", icon: MapPin, trend: "Steady" },
                { label: "Credit Available", value: "£2,850", icon: CreditCard, trend: "of £5,000 limit" },
              ].map((stat, i) => (
                <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                    <stat.icon className="w-4 h-4 text-slate-400" />
                  </div>
                  <h3 className="text-3xl font-black text-slate-900">{stat.value}</h3>
                  <p className="text-xs font-medium text-emerald-600 mt-2 bg-emerald-50 w-fit px-2 py-0.5 rounded-md">{stat.trend}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-900">Recent Employee Rides</h3>
                  <button className="text-blue-600 text-sm font-bold flex items-center hover:text-blue-700">
                    View all <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-4">
                  {[
                    { emp: "Sarah Jenkins", route: "Paddington to Canary Wharf", cost: "£24.50", time: "Today, 08:30 AM", status: "completed" },
                    { emp: "David Miller", route: "Heathrow T5 to Shoreditch", cost: "£68.00", time: "Yesterday, 14:15 PM", status: "completed" },
                    { emp: "Emma Watson", route: "King's Cross to Soho", cost: "£12.20", time: "Yesterday, 18:45 PM", status: "completed" },
                  ].map((ride, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold shrink-0">
                          {ride.emp.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{ride.emp}</p>
                          <p className="text-xs font-medium text-slate-500 line-clamp-1">{ride.route}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-slate-900">{ride.cost}</p>
                        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-1">{ride.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-6">Company Rules</h3>
                
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-bold text-slate-900">Per-Employee Limit</p>
                      <button className="text-blue-600 font-bold text-[10px] uppercase tracking-wider">Edit</button>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed mb-2">Employees can spend up to this amount per month without approval.</p>
                    <p className="text-lg font-black text-slate-900">£200 / mo</p>
                  </div>
                  
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-bold text-slate-900">Time Restrictions</p>
                      <button className="text-blue-600 font-bold text-[10px] uppercase tracking-wider">Edit</button>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed mb-2">When corporate rides can be booked.</p>
                    <div className="flex flex-wrap gap-2">
                       <span className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[10px] font-black uppercase">Mon-Fri</span>
                       <span className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[10px] font-black uppercase">06:00 - 20:00</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "employees" && (
           <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                 <div className="relative max-w-sm w-full">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Search employees..." className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                 </div>
                 <button className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 flex items-center justify-center gap-2">
                   <Plus className="w-4 h-4" /> Add Employee
                 </button>
              </div>

              <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-100 text-xs uppercase text-slate-500 font-black tracking-widest">
                       <tr>
                          <th className="px-4 py-4 rounded-tl-xl">Employee</th>
                          <th className="px-4 py-4">Status</th>
                          <th className="px-4 py-4">Role</th>
                          <th className="px-4 py-4">Spend (Month)</th>
                          <th className="px-4 py-4 rounded-tr-xl text-right">Actions</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {[
                         { name: "Sarah Jenkins", email: "sarah.j@acmecorp.com", status: "Active", role: "Employee", spend: "£142.50" },
                         { name: "David Miller", email: "david.m@acmecorp.com", status: "Active", role: "Executive", spend: "£320.00" },
                         { name: "Emma Watson", email: "emma.w@acmecorp.com", status: "Active", role: "Employee", spend: "£45.20" },
                         { name: "Marcus Johnson", email: "marcus.j@acmecorp.com", status: "Pending Invite", role: "Employee", spend: "£0.00" },
                       ].map((emp, i) => (
                         <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3">
                               <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs shrink-0">
                                     {emp.name.split(' ').map(n => n[0]).join('')}
                                  </div>
                                  <div>
                                     <p className="font-bold text-slate-900">{emp.name}</p>
                                     <p className="text-xs font-medium text-slate-500">{emp.email}</p>
                                  </div>
                               </div>
                            </td>
                            <td className="px-4 py-3">
                               {emp.status === "Active" ? (
                                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider rounded-md">Active</span>
                               ) : (
                                  <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-wider rounded-md">Pending</span>
                               )}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-600">{emp.role}</td>
                            <td className="px-4 py-3 font-black text-slate-900">{emp.spend}</td>
                            <td className="px-4 py-3 text-right">
                               <button className="text-blue-600 hover:text-blue-800 text-xs font-bold uppercase tracking-wider">Edit</button>
                            </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        )}
        {activeTab === "rides" && (
           <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                 <h3 className="text-xl font-bold text-slate-900">Ride History</h3>
                 <div className="flex items-center gap-2">
                   <button className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-200 transition-colors">
                     Filter
                   </button>
                   <button className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-2">
                     <Download className="w-4 h-4" /> Download CSV
                   </button>
                 </div>
              </div>

              <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-100 text-xs uppercase text-slate-500 font-black tracking-widest">
                       <tr>
                          <th className="px-4 py-4 rounded-tl-xl">Date & Time</th>
                          <th className="px-4 py-4">Employee</th>
                          <th className="px-4 py-4">Route</th>
                          <th className="px-4 py-4">Class</th>
                          <th className="px-4 py-4 text-right rounded-tr-xl">Total Price</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {[
                         { date: "Oct 24, 08:30 AM", emp: "Sarah Jenkins", route: "Paddington to Canary Wharf", class: "Standard Car", price: "£24.50" },
                         { date: "Oct 23, 14:15 PM", emp: "David Miller", route: "Heathrow T5 to Shoreditch", class: "Premium Car", price: "£68.00" },
                         { date: "Oct 23, 18:45 PM", emp: "Emma Watson", route: "King's Cross to Soho", class: "Standard Car", price: "£12.20" },
                         { date: "Oct 22, 09:00 AM", emp: "David Miller", route: "Euston to The Shard", class: "Premium Car", price: "£32.00" },
                         { date: "Oct 20, 17:30 PM", emp: "Sarah Jenkins", route: "Canary Wharf to Victoria", class: "Standard Car", price: "£18.50" },
                       ].map((ride, i) => (
                         <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-4 font-bold text-slate-900">{ride.date}</td>
                            <td className="px-4 py-4">
                               <p className="font-bold text-slate-900">{ride.emp}</p>
                            </td>
                            <td className="px-4 py-4">
                               <p className="text-sm font-medium text-slate-600 line-clamp-1">{ride.route}</p>
                            </td>
                            <td className="px-4 py-4 text-slate-500 font-medium">{ride.class}</td>
                            <td className="px-4 py-4 font-black text-slate-900 text-right">{ride.price}</td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        )}

        {activeTab === "billing" && (
           <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {/* Billing Summary & Method */}
                 <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                       <h3 className="text-lg font-bold text-slate-900 mb-4">Current Cycle</h3>
                       <div className="mb-4">
                          <p className="text-3xl font-black text-slate-900 mb-1">£2,150.00</p>
                          <p className="text-xs font-medium text-slate-500">October 1 - October 31</p>
                       </div>
                       
                       <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                          <div className="h-full bg-blue-600 rounded-full" style={{ width: '43%' }}></div>
                       </div>
                       <p className="text-xs font-bold text-slate-500 mb-6">43% of £5,000 monthly limit used</p>

                       <button className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors">
                          Pay Now (Mid-cycle)
                       </button>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                       <div className="flex justify-between items-center mb-4">
                         <h3 className="text-lg font-bold text-slate-900">Payment Method</h3>
                         <button className="text-blue-600 font-bold text-[10px] uppercase tracking-wider">Update</button>
                       </div>
                       <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                          <div className="w-10 h-6 bg-slate-200 rounded flex items-center justify-center shrink-0">
                            <CreditCard className="w-4 h-4 text-slate-500" />
                          </div>
                          <div>
                             <p className="font-bold text-slate-900 text-sm">•••• •••• •••• 4242</p>
                             <p className="text-xs text-slate-500">Expires 12/28</p>
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Invoices */}
                 <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-6">Past Invoices</h3>
                    
                    <div className="space-y-4">
                       {[
                         { period: "Sep 1 - Sep 30, 2026", amount: "£3,450.20", status: "Paid", date: "Oct 1, 2026" },
                         { period: "Aug 1 - Aug 31, 2026", amount: "£4,120.00", status: "Paid", date: "Sep 1, 2026" },
                         { period: "Jul 1 - Jul 31, 2026", amount: "£2,890.50", status: "Paid", date: "Aug 1, 2026" },
                       ].map((invoice, i) => (
                          <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-slate-100 rounded-xl hover:border-slate-200 transition-colors">
                             <div>
                                <p className="font-bold text-slate-900 mb-1">{invoice.period}</p>
                                <div className="flex items-center gap-2">
                                   <p className="text-sm font-black text-slate-900">{invoice.amount}</p>
                                   <span className="text-slate-300">•</span>
                                   <p className="text-xs font-medium text-slate-500">Billed {invoice.date}</p>
                                   <span className="text-slate-300">•</span>
                                   <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                                     <CheckCircle2 className="w-3 h-3" /> {invoice.status}
                                   </span>
                                </div>
                             </div>
                             <div className="flex items-center gap-2">
                                <button className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
                                   <Download className="w-4 h-4" />
                                </button>
                                <button className="px-4 py-2 bg-slate-50 text-slate-900 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-slate-100 transition-colors">
                                   View PDF
                                </button>
                             </div>
                          </div>
                       ))}
                    </div>
                 </div>
              </div>
           </div>
        )}
      </div>
    </div>
  );
}

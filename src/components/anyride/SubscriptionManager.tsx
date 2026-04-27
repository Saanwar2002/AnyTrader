import React, { useState, useEffect } from "react";
import { CreditCard, Building2, Star, Users, Plus, Edit2, ShieldCheck, ChevronRight, Zap, CheckCircle2, AlertTriangle, Settings } from "lucide-react";
import { cn } from "@/src/lib/utils";

export default function SubscriptionManager() {
  const [activeTab, setActiveTab] = useState<"riders" | "corporate">("riders");
  const [riderTiers, setRiderTiers] = useState([
    { id: "free", name: "Free Rider", price: 0, perks: ["Standard Dispatch", "Base Fare"], color: "bg-slate-100 text-slate-800" },
    { id: "rider_plus", name: "Rider Plus", price: 9.99, perks: ["Priority Matching", "10% Off All Rides", "Golden Badge"], color: "bg-amber-100 text-amber-800" }
  ]);

  const [corporateAccounts, setCorporateAccounts] = useState([
    { id: "corp_1", name: "Acme Corp Ltd.", status: "active", employees: 42, monthlyLimit: 5000, currentSpend: 2150, overdue: 0 },
    { id: "corp_2", name: "Global Logistics", status: "suspended", employees: 18, monthlyLimit: 2000, currentSpend: 2450, overdue: 2450 },
    { id: "corp_3", name: "TechNova Inc", status: "pending", employees: 12, monthlyLimit: 1000, currentSpend: 0, overdue: 0 }
  ]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          Subscription & Corporate Accounts
        </h2>
        <p className="text-slate-500 font-medium">Manage Rider Plus pricing, tiers, and B2B corporate billing.</p>
      </div>

      <div className="flex gap-2 p-1 bg-slate-200/50 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("riders")}
          className={cn(
            "px-6 py-2 rounded-lg text-sm font-bold transition-all",
            activeTab === "riders" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Consumer Subscriptions
        </button>
        <button
          onClick={() => setActiveTab("corporate")}
          className={cn(
            "px-6 py-2 rounded-lg text-sm font-bold transition-all inline-flex items-center gap-2",
            activeTab === "corporate" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Building2 className="w-4 h-4" />
          Corporate Accounts
        </button>
      </div>

      {activeTab === "riders" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">Rider Subscription Tiers</h3>
            <button className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Tier
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {riderTiers.map(tier => (
              <div key={tier.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative">
                <div className="flex justify-between items-start mb-4">
                  <div className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", tier.color)}>
                    {tier.name}
                  </div>
                  <button className="text-slate-400 hover:text-slate-600">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
                
                <h4 className="text-3xl font-black text-slate-900 mb-1">
                  £{tier.price.toFixed(2)}<span className="text-sm text-slate-500 font-bold">/mo</span>
                </h4>
                
                <div className="text-xs text-slate-500 font-medium mb-6">Manage features & pricing</div>
                
                <div className="space-y-3">
                  {tier.perks.map((perk, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      {perk}
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>Subscribers</span>
                  <span className="text-slate-900">12,450</span>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
            <h4 className="text-sm font-bold text-blue-900 mb-2">Discount Subsidies</h4>
            <p className="text-xs text-blue-700 max-w-2xl">
              When a Rider Plus member receives a 10% discount on a journey, the platform absorbs the cost automatically through the Driver Payment clearing process. Adjust pricing here carefully to maintain healthy margins.
            </p>
          </div>
        </div>
      )}

      {activeTab === "corporate" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">B2B Corporate Billing</h3>
            <button className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Onboard Company
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs uppercase text-slate-500 font-black tracking-widest">
                <tr>
                  <th className="px-6 py-4">Company</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Employees</th>
                  <th className="px-6 py-4">Monthly Spend</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {corporateAccounts.map(account => (
                  <tr key={account.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {account.name}
                    </td>
                    <td className="px-6 py-4">
                      {account.status === "active" ? (
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-wider">Active</span>
                      ) : account.status === "suspended" ? (
                        <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-[10px] font-black uppercase tracking-wider">Suspended</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black uppercase tracking-wider">Pending setup</span>
                      )}
                      
                      {account.overdue > 0 && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-red-600 uppercase tracking-widest">
                          <AlertTriangle className="w-3 h-3" /> Overdue
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-600">
                      {account.employees}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className={cn("font-bold text-sm", account.overdue > 0 ? "text-red-600" : "text-slate-900")}>
                          £{account.currentSpend} <span className="text-slate-400 font-medium text-xs">/ £{account.monthlyLimit}</span>
                        </div>
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full max-w-[100px] overflow-hidden">
                          <div 
                            className={cn("h-full rounded-full", (account.currentSpend/account.monthlyLimit)*100 > 80 ? "bg-red-500" : "bg-indigo-500")}
                            style={{ width: `${Math.min((account.currentSpend/account.monthlyLimit)*100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right flex gap-3 justify-end items-center">
                      <button className="text-slate-400 hover:text-slate-900 transition-colors" title="Settings">
                        <Settings className="w-4 h-4" />
                      </button>
                      {account.status === "active" ? (
                        <button className="px-3 py-1 bg-red-50 text-red-600 font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-red-100 transition-colors">
                          Suspend
                        </button>
                      ) : account.status === "suspended" ? (
                        <button className="px-3 py-1 bg-emerald-50 text-emerald-600 font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-emerald-100 transition-colors">
                          Restore
                        </button>
                      ) : (
                         <button className="px-3 py-1 bg-indigo-50 text-indigo-600 font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-indigo-100 transition-colors">
                          Approve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mb-4 text-indigo-600">
                <Users className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-2">Employee Sync</h4>
              <p className="text-xs text-slate-500 font-medium mb-4">
                Administrators can invite employees via email or link. Approved employees charge rides directly to the corporate account.
              </p>
              <button className="text-indigo-600 text-xs font-bold hover:text-indigo-700">Review onboarding flow &rarr;</button>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-4 text-emerald-600">
                <CreditCard className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-2">Invoicing & Payouts</h4>
              <p className="text-xs text-slate-500 font-medium mb-4">
                Corporate invoices are generated on the 1st of every month automatically via Stripe. Drivers are still paid out instantly directly from the platform wallet.
              </p>
              <button className="text-emerald-600 text-xs font-bold hover:text-emerald-700">View Stripe Settings &rarr;</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

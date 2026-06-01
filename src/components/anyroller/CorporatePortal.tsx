import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, Users, Receipt, Briefcase, Plus, Filter, 
  Search, ArrowRight, Settings, CheckCircle2
} from "lucide-react";

// Mock Data
const mockCompanies = [
  { id: "C-1001", name: "Global Tech Inc.", employees: 45, monthlyBudget: "£5,000", spent: "£2,450", status: "Active" },
  { id: "C-1002", name: "Stark Industries", employees: 120, monthlyBudget: "£15,000", spent: "£14,800", status: "Active" },
  { id: "C-1003", name: "Wayne Enterprises", employees: 8, monthlyBudget: "£2,000", spent: "£450", status: "Active" },
  { id: "C-1004", name: "Initech", employees: 25, monthlyBudget: "£3,500", spent: "£3,500", status: "Limit Reached" },
];

const mockRecentInvoices = [
  { id: "INV-2026-05", company: "Stark Industries", amount: "£12,400", date: "2026-05-01", status: "Paid" },
  { id: "INV-2026-05", company: "Global Tech Inc.", amount: "£4,200", date: "2026-05-01", status: "Paid" },
  { id: "INV-2026-04", company: "Initech", amount: "£3,450", date: "2026-04-01", status: "Overdue" },
];

const StatCard = ({ title, value, subtitle, icon: Icon }: any) => (
  <div className="bg-white p-6 border border-black rounded-xl shadow-sm flex items-start justify-between">
    <div>
      <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
      <h3 className="text-3xl font-bold text-black">{value}</h3>
      <p className="text-sm font-medium text-gray-400 mt-2">{subtitle}</p>
    </div>
    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-black">
      <Icon size={24} />
    </div>
  </div>
);

const CorporatePortal = () => {
  const [activeTab, setActiveTab] = useState("accounts");

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black flex items-center">
            <Building2 className="mr-2 text-indigo-600" />
            AnyRoller for Business (B2B)
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage corporate accounts, employee ride limits, and consolidated billing.</p>
        </div>
        
        <button className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg text-sm font-bold shadow-[0_2px_0_rgb(100,100,100)] active:translate-y-[1px] active:shadow-none transition-all">
          <Plus size={16} />
          Onboard Company
        </button>
      </div>

      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Active Corporate Accounts" 
          value="42" 
          subtitle="+3 this month"
          icon={Briefcase} 
        />
        <StatCard 
          title="Total B2B Employees" 
          value="1,240" 
          subtitle="Registered riders"
          icon={Users} 
        />
        <StatCard 
          title="Consolidated B2B Draft (MTD)" 
          value="£42,500" 
          subtitle="To be invoiced end of month"
          icon={Receipt} 
        />
      </div>

      <div className="flex gap-4 border-b border-gray-200">
        <button 
          onClick={() => setActiveTab("accounts")}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === "accounts" ? "border-black text-black" : "border-transparent text-gray-500 hover:text-black"}`}
        >
          Company Accounts
        </button>
        <button 
          onClick={() => setActiveTab("invoices")}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === "invoices" ? "border-black text-black" : "border-transparent text-gray-500 hover:text-black"}`}
        >
          Invoices & Billing
        </button>
      </div>

      {activeTab === "accounts" && (
        <div className="bg-white border border-black rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="relative group flex-1 md:w-64">
              <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search company..." 
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all"
              />
            </div>
            <button className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center">
              <Filter size={16} />
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-black text-sm">
                  <th className="px-6 py-4 font-bold text-gray-700">Company Name</th>
                  <th className="px-6 py-4 font-bold text-gray-700">Employees</th>
                  <th className="px-6 py-4 font-bold text-gray-700">Budget (Monthly)</th>
                  <th className="px-6 py-4 font-bold text-gray-700">Status</th>
                  <th className="px-6 py-4 font-bold text-center text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {mockCompanies.map((company) => (
                  <tr key={company.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-black">{company.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{company.id}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-700">{company.employees}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 w-48">
                        <div className="flex justify-between text-xs font-bold text-black">
                          <span>{company.spent}</span>
                          <span className="text-gray-400">{company.monthlyBudget}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full ${company.status === 'Limit Reached' ? 'bg-red-500' : 'bg-black'}`} 
                            style={{ width: `${Math.min(100, (parseInt(company.spent.replace(/\D/g, '')) / parseInt(company.monthlyBudget.replace(/\D/g, ''))) * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                        company.status === 'Active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'
                      }`}>
                        {company.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded-lg transition-colors inline-flex items-center" title="Manage Company">
                        <Settings size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "invoices" && (
        <div className="bg-white border border-black rounded-xl shadow-sm overflow-hidden text-center py-16">
           <Receipt size={48} className="mx-auto text-gray-300 mb-4" />
           <h3 className="text-lg font-bold text-black mb-2">Automated Billing Enabled</h3>
           <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">Invoices are automatically generated and sent to assigned company administrators on the 1st of every month via Stripe Invoicing.</p>
           
           <div className="max-w-2xl mx-auto text-left mt-8 border border-gray-200 rounded-xl overflow-hidden">
             <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 font-bold text-sm text-gray-700">Recent Invoices</div>
             <div className="divide-y divide-gray-100">
               {mockRecentInvoices.map((inv) => (
                 <div key={`${inv.id}-${inv.company}`} className="flex items-center justify-between p-4 hover:bg-gray-50">
                    <div>
                      <p className="font-bold text-black text-sm">{inv.company}</p>
                      <p className="text-xs text-gray-500">{inv.id} • {inv.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-black text-sm">{inv.amount}</p>
                      <p className={`text-xs font-bold ${inv.status === 'Paid' ? 'text-emerald-600' : 'text-red-500'}`}>{inv.status}</p>
                    </div>
                 </div>
               ))}
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default CorporatePortal;

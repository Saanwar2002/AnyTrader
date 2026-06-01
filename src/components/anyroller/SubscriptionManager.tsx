import React, { useState } from "react";
import { 
  CreditCard, Plus, CheckCircle2, XCircle, Users, Activity,
  Settings, ArrowRight, Wallet
} from "lucide-react";
import { motion } from "framer-motion";

// Mock Data
const mockPlans = [
  {
    id: "p-01",
    name: "Driver Pro Monthly",
    type: "Driver",
    price: "£149",
    billingCycle: "Monthly",
    status: "Active",
    subscribers: 245,
    features: ["0% Commission", "Priority Dispatch", "Premium Support"],
  },
  {
    id: "p-02",
    name: "Rider VIP Basic",
    type: "Passenger",
    price: "£9.99",
    billingCycle: "Monthly",
    status: "Active",
    subscribers: 1205,
    features: ["10% Off All Rides", "Priority Booking", "Zero Cancel Fees"],
  },
  {
    id: "p-03",
    name: "Student Commuter",
    type: "Passenger",
    price: "£4.99",
    billingCycle: "Monthly",
    status: "Inactive",
    subscribers: 0,
    features: ["Fixed Price University Routes", "Free Shared Rides"],
  }
];

const mockSubscribers = [
  { id: "S-9912", user: "John Doe", type: "Driver", plan: "Driver Pro Monthly", joined: "2026-05-10", status: "Active" },
  { id: "S-9913", user: "Sarah Smith", type: "Passenger", plan: "Rider VIP Basic", joined: "2026-05-15", status: "Active" },
  { id: "S-9914", user: "Mike Johnson", type: "Passenger", plan: "Rider VIP Basic", joined: "2026-05-20", status: "Past Due" },
];

const SubscriptionManager = () => {
  const [activeTab, setActiveTab] = useState("plans");

  const Toggle = ({ enabled, onClick }: { enabled: boolean, onClick: () => void }) => (
    <button 
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black flex items-center">
            <CreditCard className="mr-2 text-purple-600" />
            Subscription Manager
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage recurring revenue plans for drivers and passengers.</p>
        </div>
        
        <button className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg text-sm font-bold shadow-[0_2px_0_rgb(100,100,100)] active:translate-y-[1px] active:shadow-none transition-all">
          <Plus size={16} />
          Create New Plan
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button 
          onClick={() => setActiveTab("plans")}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === "plans" ? "border-black text-black" : "border-transparent text-gray-500 hover:text-black"}`}
        >
          Subscription Plans
        </button>
        <button 
          onClick={() => setActiveTab("subscribers")}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === "subscribers" ? "border-black text-black" : "border-transparent text-gray-500 hover:text-black"}`}
        >
          Active Subscribers
        </button>
      </div>

      {activeTab === "plans" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockPlans.map((plan) => (
            <motion.div 
              key={plan.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-black rounded-xl p-6 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className={`px-2 py-1 text-xs font-bold rounded-md border ${
                    plan.type === 'Driver' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                  }`}>
                    {plan.type} Plan
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500">Active</span>
                    <Toggle enabled={plan.status === 'Active'} onClick={() => {}} />
                  </div>
                </div>
                
                <h3 className="text-xl font-bold text-black mb-1">{plan.name}</h3>
                <div className="flex items-baseline mb-4">
                  <span className="text-2xl font-black text-black">{plan.price}</span>
                  <span className="text-sm font-medium text-gray-500 ml-1">/{plan.billingCycle.toLowerCase()}</span>
                </div>

                <div className="space-y-2 mb-6">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                      <span className="text-sm text-gray-700 font-medium">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center text-sm font-bold text-gray-700">
                  <Users size={16} className="mr-2 text-gray-400" />
                  {plan.subscribers} Subscribers
                </div>
                <button className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded-lg transition-colors">
                  <Settings size={18} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {activeTab === "subscribers" && (
        <div className="bg-white border border-black rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-4 font-bold">Subscriber ID</th>
                  <th className="px-6 py-4 font-bold">User</th>
                  <th className="px-6 py-4 font-bold">Plan</th>
                  <th className="px-6 py-4 font-bold">Joined</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {mockSubscribers.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-black">{sub.id}</td>
                    <td className="px-6 py-4 font-medium text-gray-700">{sub.user} <span className="text-xs text-gray-400 ml-2">({sub.type})</span></td>
                    <td className="px-6 py-4 text-gray-600">{sub.plan}</td>
                    <td className="px-6 py-4 text-gray-600">{sub.joined}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                        sub.status === 'Active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'
                      }`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button className="text-blue-600 hover:underline text-sm font-bold">Manage</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionManager;

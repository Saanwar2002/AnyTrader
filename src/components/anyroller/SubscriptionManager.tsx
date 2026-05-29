import React, { useState, useEffect } from "react";
import { 
  Award, 
  Building2, 
  Coins, 
  Plus, 
  Users, 
  Briefcase, 
  FileText, 
  Send, 
  Save, 
  Sparkles,
  Search,
  CheckCircle2
} from "lucide-react";
import { db, collection, onSnapshot, addDoc } from "../../firebase";
import { toast } from "sonner";

interface CorporateClient {
  id: string;
  name: string;
  contactEmail: string;
  employeeCount: number;
  availableCredits: number;
  planLevel: "Basic" | "Silver Tier" | "Diamond VIP";
}

const initialCorporatesSeed: CorporateClient[] = [
  { id: "corp_1", name: "Apex Global Consulting", contactEmail: "finance@apexcorp.com", employeeCount: 145, availableCredits: 2450.00, planLevel: "Diamond VIP" },
  { id: "corp_2", name: "Vertex Tech Ltd", contactEmail: "travel@vertex.io", employeeCount: 68, availableCredits: 890.50, planLevel: "Silver Tier" },
  { id: "corp_3", name: "London Creative Studio", contactEmail: "accounts@londoncreative.co", employeeCount: 22, availableCredits: 150.00, planLevel: "Basic" }
];

export default function SubscriptionManager() {
  const [corporates, setCorporates] = useState<CorporateClient[]>(initialCorporatesSeed);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // New Corp form state
  const [newCorpName, setNewCorpName] = useState("");
  const [newCorpEmail, setNewCorpEmail] = useState("");
  const [newCorpPlan, setNewCorpPlan] = useState<"Basic" | "Silver Tier" | "Diamond VIP">("Silver Tier");
  const [newCorpEmployees, setNewCorpEmployees] = useState(10);
  const [initialCredits, setInitialCredits] = useState(500);

  // Credit modification state
  const [selectedCorpId, setSelectedCorpId] = useState<string | null>(null);
  const [creditsToAdd, setCreditsToAdd] = useState(250);

  // Match search filter
  const filteredCorporates = corporates.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contactEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateCorp = () => {
    if (!newCorpName.trim() || !newCorpEmail.trim()) {
      toast.error("Please fill in corporate name and booking billing contact email.");
      return;
    }
    const newCorp: CorporateClient = {
      id: "corp_" + Math.floor(Math.random() * 9000 + 1000),
      name: newCorpName,
      contactEmail: newCorpEmail,
      employeeCount: Number(newCorpEmployees),
      availableCredits: Number(initialCredits),
      planLevel: newCorpPlan
    };

    setCorporates([newCorp, ...corporates]);
    setNewCorpName("");
    setNewCorpEmail("");
    setShowAddForm(false);
    toast.success(`B2B client '${newCorp.name}' onboarded. Issued credit balance.`);
  };

  const handleAddCredits = (id: string) => {
    setCorporates(prev => prev.map(c => {
      if (c.id === id) {
        toast.success(`Added £${creditsToAdd} trade credit to ${c.name}.`);
        return { ...c, availableCredits: c.availableCredits + creditsToAdd };
      }
      return c;
    }));
  };

  return (
    <div className="space-y-6">
      {/* Upper HUD Header */}
      <div className="p-5 bg-white border border-black rounded-lg shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-4 h-4 text-[#AF52DE]" />
          <span className="text-[10px] uppercase font-mono tracking-widest text-[#AF52DE] font-bold">B2B ENTERPRISE CONTROL</span>
        </div>
        <h2 className="text-xl font-bold text-black font-sans">Subscriptions & B2B Billing</h2>
        <p className="text-xs text-slate-500 mt-1">
          Issue corporate ride credits, manage fleet discount plans, and onboard business accounts to streamline physical employee dispatching.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* left column: business list inside a compact card with black border */}
        <div className="lg:col-span-2 bg-white border border-black rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-700" /> Managed B2B Fleet Clients
            </h3>

            {/* Search filter bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Find contract accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-100 border-none rounded text-xs text-black font-sans outline-none w-48 focus:ring-1 focus:ring-black"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredCorporates.map(corp => (
              <div 
                key={corp.id} 
                className={`p-4 rounded border transition ${
                  selectedCorpId === corp.id ? "bg-emerald-500/5 border-emerald-400" : "bg-slate-50 border-black"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-black text-[#AF52DE]">{corp.id}</span>
                      <h4 className="text-sm font-extrabold text-black font-sans">{corp.name}</h4>
                      <span className="text-[9px] uppercase font-mono font-bold bg-slate-200 border border-black/10 px-1.5 py-0.5 rounded text-slate-800">
                        {corp.planLevel}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 mt-1.5">
                      <span>Email: <strong className="text-slate-700">{corp.contactEmail}</strong></span>
                      <span>Staff pool: <strong className="text-slate-705">{corp.employeeCount} accounts</strong></span>
                    </div>
                  </div>

                  <div className="text-right sm:text-right flex flex-row sm:flex-col items-center justify-between sm:justify-center gap-x-4">
                    <div>
                      <span className="text-[9px] text-slate-400 block font-sans">Active Ride Budget</span>
                      <span className="text-lg font-black font-mono text-black">£{corp.availableCredits.toFixed(2)}</span>
                    </div>
                    <button
                      onClick={() => setSelectedCorpId(corp.id)}
                      className="mt-1 px-2.5 py-1 border border-black hover:bg-slate-100 text-[10px] font-bold rounded cursor-pointer transition select-none"
                    >
                      Refill budget
                    </button>
                  </div>
                </div>

                {selectedCorpId === corp.id && (
                  <div className="mt-3.5 pt-3 border-t border-dashed border-slate-200 flex items-center justify-between gap-3 bg-white p-3 rounded">
                    <div className="flex items-center gap-2.5">
                      <Coins className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-slate-700">Budget top amount:</span>
                      <input 
                        type="number" 
                        value={creditsToAdd} 
                        onChange={(e) => setCreditsToAdd(Number(e.target.value) || 0)}
                        className="w-20 px-2 py-0.5 bg-slate-100 border border-black text-xs text-black font-mono rounded"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setSelectedCorpId(null)}
                        className="px-2.5 py-1 text-xs border border-slate-350 hover:bg-slate-50 rounded"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => {
                          handleAddCredits(corp.id);
                          setSelectedCorpId(null);
                        }}
                        className="px-3 py-1 bg-black text-white text-xs font-bold rounded hover:bg-slate-900"
                      >
                        Commit Credits
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right column: add corporation business client */}
        <div className="bg-white border border-black rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-emerald-555" /> Onboard B2B Partner
            </h3>
            <span className="text-[9px] uppercase font-mono text-emerald-800 bg-emerald-50 border border-emerald-250 px-1.5 py-0.5 rounded">
              Contract Account
            </span>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-black block">Corporate Client Name</label>
              <input 
                type="text" 
                placeholder="e.g. Sterling Real Estate" 
                value={newCorpName}
                onChange={(e) => setNewCorpName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-black text-xs rounded text-black font-sans font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-black block">Corporate Travel Contact Email</label>
              <input 
                type="email" 
                placeholder="billing@sterlingcorp.com" 
                value={newCorpEmail}
                onChange={(e) => setNewCorpEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-black text-xs rounded text-slate-800 font-sans"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-black block font-sans">Employees pool</label>
                <input 
                  type="number" 
                  value={newCorpEmployees}
                  onChange={(e) => setNewCorpEmployees(Number(e.target.value) || 1)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-black text-xs rounded text-black font-mono font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-black block font-sans">Corporate Credits</label>
                <input 
                  type="number" 
                  value={initialCredits}
                  onChange={(e) => setInitialCredits(Number(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-black text-xs rounded text-[#10b981] font-mono font-extrabold"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-black block">Fare Discount Contract Level</label>
              <select
                value={newCorpPlan}
                onChange={(e) => setNewCorpPlan(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-black text-xs rounded text-black font-medium outline-none"
              >
                <option value="Basic">Basic Plan (No discounts)</option>
                <option value="Silver Tier">Silver Tier Plan (3% corporate discount)</option>
                <option value="Diamond VIP">Diamond VIP Plan (8% corporate discount & priority dispatch)</option>
              </select>
            </div>

            <button
              onClick={handleCreateCorp}
              className="w-full text-center py-2.5 bg-black hover:bg-slate-900 border border-black text-white text-xs font-mono font-black tracking-wider uppercase cursor-pointer rounded transition flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5 text-emerald-400" /> Assign & Onboard Client
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

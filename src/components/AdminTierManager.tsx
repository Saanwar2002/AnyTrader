import React, { useState, useEffect } from "react";
import { db, doc, updateDoc, setDoc, onSnapshot } from "@/src/firebase";
import { Loader2, Plus, Trash2, Save, AlertCircle, Edit2, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";

interface Tier {
  price: number;
  commission: number;
  description: string;
  features: string[];
  color: string;
  
  // Trade specific
  maxQuotes?: number;
  maxAcceptedQuotes?: number;
  leadFee?: number;

  // Ride specific
  destinationFilters?: number;
  priorityDispatch?: number;
  advanceBookingDays?: number;
}

interface EditingState {
  model: string;
  tierKey: string;
  data: Tier;
}

interface AdminTierManagerProps {
  modelsToShow?: string[];
}

export default function AdminTierManager({ modelsToShow }: AdminTierManagerProps) {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "platform_config", "global_tiers"), (snapshot) => {
      if (snapshot.exists()) {
        setConfig(snapshot.data());
        setHasUnsavedChanges(false);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleTierUpdate = () => {
    if (!editing) return;
    
    setConfig((prev: any) => {
      const newConfig = { ...prev };
      newConfig.providerModels[editing.model].tiers[editing.tierKey] = editing.data;
      return newConfig;
    });
    setEditing(null);
    setHasUnsavedChanges(true); // Mark as unsaved
  };

  const handleDeleteTier = (model: string, tierKey: string) => {
    if (!window.confirm(`Are you sure you want to delete the ${tierKey} tier?`)) return;
    
    setConfig((prev: any) => {
      const newConfig = { ...prev };
      delete newConfig.providerModels[model].tiers[tierKey];
      return newConfig;
    });
    setHasUnsavedChanges(true); // Mark as unsaved
  };

  const handleAddTier = (model: string) => {
    const tierKey = prompt("Enter a unique ID for this tier (e.g., 'premium', 'gold'):");
    if (!tierKey) return;
    if (config.providerModels[model].tiers[tierKey]) {
      alert("A tier with this ID already exists.");
      return;
    }

    const newTier: Tier = {
      price: 0,
      commission: 0.1,
      description: "New tier description",
      features: ["Feature 1"],
      color: "bg-white border-black"
    };

    if (model === 'one_off_trades') {
      newTier.maxQuotes = 10;
      newTier.maxAcceptedQuotes = 2;
      newTier.leadFee = 0;
    } else if (model === 'on_demand_transport') {
      newTier.destinationFilters = 2;
      newTier.advanceBookingDays = 7;
      newTier.priorityDispatch = 0;
    }

    setConfig((prev: any) => ({
      ...prev,
      providerModels: {
        ...prev.providerModels,
        [model]: {
          ...prev.providerModels[model],
          tiers: {
            ...prev.providerModels[model].tiers,
            [tierKey]: newTier
          }
        }
      }
    }));

    setEditing({ model, tierKey, data: newTier });
    setHasUnsavedChanges(true); // Mark as unsaved
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "platform_config", "global_tiers"), config);
      
      // Auto-sync Commission down to Rides Command Center
      const taxiCommission = config?.providerModels?.on_demand_transport?.tiers?.standard?.commission;
      if (typeof taxiCommission === 'number') {
        await setDoc(doc(db, "platform_config", "ride_fees"), {
          fees: { platformCommission: taxiCommission * 100 }
        }, { merge: true });
      }

      // Auto-sync Trade Tiers to platform_config/global feeTiers so both admin panels stay in perfect sync!
      const oneOffTiers = config?.providerModels?.one_off_trades?.tiers;
      if (oneOffTiers) {
        const syncedFeeTiers = Object.entries(oneOffTiers).map(([tierKey, data]: [string, any]) => {
          let name = "Free Explorer";
          const lower = tierKey.toLowerCase();
          if (lower === 'pro' || lower.includes('silver')) name = "Silver Professional";
          else if (lower === 'premium' || lower === 'gold' || lower.includes('elite')) name = "Gold Elite";
          else if (lower === 'platinum' || lower.includes('enterprise')) name = "Platinum Enterprise";
          else if (lower === 'payg' || lower.includes('free')) name = "Free Explorer";
          else name = tierKey.charAt(0).toUpperCase() + tierKey.slice(1);

          return {
            name,
            price: Number(data.price) || 0,
            commission: (Number(data.commission) || 0) * 100, // stored as % in feeTiers
            maxQuotes: Number(data.maxQuotes) || 9999,
            maxAcceptedQuotes: Number(data.maxAcceptedQuotes) || 9999,
            leadFee: Number(data.leadFee) || 0,
            description: data.description || "",
            features: data.features || [],
            limitPeriod: "monthly"
          };
        });

        await setDoc(doc(db, "platform_config", "global"), {
          feeTiers: syncedFeeTiers
        }, { merge: true });
      }

      setHasUnsavedChanges(false); // Reset unsaved changes
      alert("Tiers updated successfully and synced with global platform config!");
    } catch (error) {
      console.error("Error saving tiers:", error);
      alert("Failed to save tiers");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  if (!config) {
    return (
      <div className="p-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-black">
        <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-700 mb-2">Tier Configuration Not Found</h3>
        <p className="text-slate-500 mb-6 max-w-md mx-auto">
          The global tier configuration has not been initialized yet. Click the button below to create the initial configuration with canonical platform tiers.
        </p>
        <button 
          onClick={async () => {
            const initialConfig = {
              providerModels: {
                one_off_trades: {
                  tiers: {
                    payg: {
                      price: 0,
                      commission: 0.05,
                      maxQuotes: 5,
                      maxAcceptedQuotes: 2,
                      leadFee: 0,
                      description: "Start risk-free. 5% Platform Commission. Standard Visibility.",
                      features: ["5 Quotes/month", "5% Platform Commission", "Standard Profile Visibility"],
                      color: "bg-slate-50 border-black"
                    },
                    pro: {
                      price: 19.99,
                      commission: 0.035,
                      maxQuotes: 30,
                      maxAcceptedQuotes: 10,
                      leadFee: 0,
                      description: "For active tradespeople. 3.5% Platform Commission. Priority Alerts.",
                      features: ["30 Quotes/month", "3.5% Commission", "Instant Lead Alerts", "Priority Support", "Branded Invoicing"],
                      color: "bg-blue-50 border-black"
                    },
                    premium: {
                      price: 49.99,
                      commission: 0.025,
                      maxQuotes: 9999,
                      maxAcceptedQuotes: 9999,
                      leadFee: 0,
                      description: "Top tier for established trades. 2.5% Commission. Highest trust rank.",
                      features: ["Unlimited Quotes", "2.5% Commission", "Gold Trust Badge", "Instant Match Priority", "AI Material List Assistant"],
                      color: "bg-amber-50 border-black"
                    },
                    platinum: {
                      price: 99.99,
                      commission: 0.015,
                      maxQuotes: 9999,
                      maxAcceptedQuotes: 9999,
                      leadFee: 0,
                      description: "Enterprise scale for multi-seat trade crews. 1.5% Commission.",
                      features: ["Unlimited Quotes", "1.5% Commission", "Multi-seat Crew Dispatch", "Dedicated Account Manager", "Custom TradeOS Reports"],
                      color: "bg-purple-50 border-black"
                    }
                  }
                },
                on_demand_transport: {
                  tiers: {
                    standard: { price: 0, commission: 0.12, description: "Standard Driver", destinationFilters: 2, advanceBookingDays: 7, priorityDispatch: 0, features: ["Unlimited trips", "Standard Dispatch", "12% Platform Commission"], color: "bg-green-50 border-black" },
                    gold: { price: 49.99, commission: 0.10, description: "Priority Driver", destinationFilters: 4, advanceBookingDays: 14, priorityDispatch: 50, features: ["Priority Airport Queue", "Higher Earning Potential", "10% Platform Commission"], color: "bg-amber-50 border-black" },
                  }
                },
                homeowners: {
                  tiers: {
                    standard: { price: 0, maxQuotes: 0, maxAcceptedQuotes: 0, commission: 0, leadFee: 0, description: "Standard Homeowner", features: ["Post unlimited jobs", "Compare quotes", "Direct messaging"], color: "bg-slate-50 border-black" },
                    landlord: { price: 19, maxQuotes: 0, maxAcceptedQuotes: 0, commission: 0, leadFee: 0, description: "Premium Landlord Portfolio", features: ["Multi-property dashboard", "CP12 & EICR automated compliance", "Tenant repair reporting bridge"], color: "bg-blue-50 border-black" }
                  }
                }
              }
            };
            setConfig(initialConfig);
            await setDoc(doc(db, "platform_config", "global_tiers"), initialConfig);
          }}
          className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700"
        >
          Initialize Canonical Tiers
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {Object.entries(config.providerModels || {})
        .filter(([model]) => !modelsToShow || modelsToShow.includes(model))
        .map(([model, modelData]: [string, any]) => (
        <div key={model} className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">{model.replace(/_/g, " ")}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Object.entries(modelData.tiers || {}).map(([tierKey, tier]: [string, any]) => {
              const isEditing = editing?.model === model && editing?.tierKey === tierKey;
              
              if (isEditing) {
                return (
                  <div key={tierKey} className="p-6 rounded-2xl border shadow-lg bg-white border-blue-500 ring-2 ring-blue-500/20">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="font-bold text-lg uppercase">{tierKey}</h4>
                      <div className="flex gap-2">
                        <button onClick={() => setEditing(null)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                        <button onClick={handleTierUpdate} className="p-1 text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Description</label>
                        <input 
                          type="text" 
                          value={editing.data.description ?? ""} 
                          onChange={(e) => setEditing({...editing, data: {...editing.data, description: e.target.value}})}
                          className="w-full text-sm border-b border-black py-1 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400">Price (£)</label>
                          <input 
                            type="number" 
                            step="0.01"
                            value={editing.data.price ?? 0} 
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setEditing({...editing, data: {...editing.data, price: isNaN(val) ? 0 : val}});
                            }}
                            className="w-full text-sm border-b border-black py-1 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400">Comm (%)</label>
                          <input 
                            type="number" 
                            step="0.1"
                            value={(editing.data.commission ?? 0) * 100} 
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setEditing({...editing, data: {...editing.data, commission: isNaN(val) ? 0 : val / 100}});
                            }}
                            className="w-full text-sm border-b border-black py-1 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                      
                      {model === 'one_off_trades' && (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-bold uppercase text-slate-400">Max Quotes</label>
                              <input 
                                type="number" 
                                value={editing.data.maxQuotes ?? 0} 
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  setEditing({...editing, data: {...editing.data, maxQuotes: isNaN(val) ? 0 : val}});
                                }}
                                className="w-full text-sm border-b border-black py-1 focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold uppercase text-slate-400">Lead Fee (£)</label>
                              <input 
                                type="number" 
                                step="0.1"
                                value={editing.data.leadFee ?? 0} 
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setEditing({...editing, data: {...editing.data, leadFee: isNaN(val) ? 0 : val}});
                                }}
                                className="w-full text-sm border-b border-black py-1 focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>
                        </>
                      )}

                      {model === 'on_demand_transport' && (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-bold uppercase text-slate-400">Dest. Filters / Day</label>
                              <input 
                                type="number" 
                                value={editing.data.destinationFilters ?? 0} 
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  setEditing({...editing, data: {...editing.data, destinationFilters: isNaN(val) ? 0 : val}});
                                }}
                                className="w-full text-sm border-b border-black py-1 focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold uppercase text-slate-400">Adv. Booking (Days)</label>
                              <input 
                                type="number" 
                                value={editing.data.advanceBookingDays ?? 0} 
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  setEditing({...editing, data: {...editing.data, advanceBookingDays: isNaN(val) ? 0 : val}});
                                }}
                                className="w-full text-sm border-b border-black py-1 focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase text-slate-400">Priority Dispatch Level (0-100)</label>
                            <input 
                              type="number" 
                              value={editing.data.priorityDispatch ?? 0} 
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setEditing({...editing, data: {...editing.data, priorityDispatch: isNaN(val) ? 0 : val}});
                              }}
                              className="w-full text-sm border-b border-black py-1 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Features (comma separated)</label>
                        <textarea 
                          value={(editing.data.features || []).join(", ")} 
                          onChange={(e) => setEditing({...editing, data: {...editing.data, features: e.target.value.split(",").map(f => f.trim())}})}
                          className="w-full text-sm border-b border-black py-1 focus:outline-none focus:border-blue-500 h-16"
                        />
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={tierKey} className={cn("group flex flex-col p-6 rounded-[24px] border shadow-sm transition-all hover:shadow-lg relative overflow-hidden bg-white/50 backdrop-blur-sm", tier.color || "bg-white border-black")}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-extrabold text-xl text-slate-900 uppercase tracking-tight">{tierKey}</h4>
                    </div>
                    <div className="flex gap-2 transition-opacity">
                      <button 
                        onClick={() => setEditing({ model, tierKey, data: { ...tier } })}
                        className="p-1.5 bg-white text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-black shadow-sm"
                        title="Edit Tier"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteTier(model, tierKey)}
                        className="p-1.5 bg-white text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-black shadow-sm"
                        title="Delete Tier"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-slate-500 text-sm font-medium mb-4 min-h-[40px]">{tier.description}</p>
                  
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-slate-900">£{tier.price}</span>
                      <span className="text-sm font-bold text-slate-400">/ mo</span>
                    </div>
                  </div>

                  <div className="space-y-1 mb-6 flex-1">
                    <div className="flex justify-between items-center py-2.5 border-b border-black/50">
                      <span className="text-sm font-medium text-slate-500">Commission</span>
                      <span className="text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-full">{tier.commission * 100}%</span>
                    </div>

                    {model === 'one_off_trades' && (
                      <>
                        <div className="flex justify-between items-center py-2.5 border-b border-black/50">
                          <span className="text-sm font-medium text-slate-500">Job Quotes</span>
                          <span className="text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-full">{(tier.maxQuotes ?? 0) >= 9999 ? 'Unlimited' : tier.maxQuotes}</span>
                        </div>
                        {tier.leadFee !== undefined && tier.leadFee > 0 && (
                          <div className="flex justify-between items-center py-2.5 border-b border-black/50">
                            <span className="text-sm font-medium text-slate-500">Lead Fee</span>
                            <span className="text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-full">£{tier.leadFee}</span>
                          </div>
                        )}
                      </>
                    )}

                    {model === 'on_demand_transport' && (
                      <>
                        <div className="flex justify-between items-center py-2.5 border-b border-black/50">
                          <span className="text-sm font-medium text-slate-500">Dest. Filters</span>
                          <span className="text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-full">{tier.destinationFilters ?? 0} / Day</span>
                        </div>
                        <div className="flex justify-between items-center py-2.5 border-b border-black/50">
                          <span className="text-sm font-medium text-slate-500">Adv. Booking</span>
                          <span className="text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-full">{tier.advanceBookingDays ?? 0} Days</span>
                        </div>
                        <div className="flex justify-between items-center py-2.5 border-b border-black/50">
                          <span className="text-sm font-medium text-slate-500">Priority Dispatch</span>
                          <span className="text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-full">Lvl {tier.priorityDispatch ?? 0}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="mt-auto bg-slate-50/80 p-4 rounded-xl border border-black/50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Included Features</p>
                    <ul className="space-y-2.5">
                      {tier.features?.map((f: string) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700 font-medium">
                          <div className="p-0.5 bg-emerald-100 rounded-full mt-0.5 shrink-0">
                            <Check className="w-3 h-3 text-emerald-600" />
                          </div>
                          <span className="leading-tight">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
            <button 
              onClick={() => handleAddTier(model)}
              className="flex flex-col items-center justify-center border-2 border-dashed border-black bg-slate-50/50 rounded-[24px] hover:bg-slate-50 hover:border-black hover:shadow-inner text-slate-400 hover:text-slate-600 p-6 min-h-[420px] transition-all group"
            >
              <div className="w-12 h-12 bg-white rounded-full shadow-sm border border-black flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Plus className="w-5 h-5" />
              </div>
              <span className="font-bold uppercase tracking-widest text-xs">Add Tier</span>
            </button>
          </div>
        </div>
      ))}
      <AnimatePresence>
        {(hasUnsavedChanges || editing) && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex justify-center"
          >
            <div className="bg-orange-600 shadow-2xl shadow-orange-600/30 text-white rounded-full p-2 pr-6 pl-4 flex items-center gap-4">
              <div className="bg-white/20 p-2 rounded-full">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-sm">Unsaved Changes</p>
                <p className="text-orange-100 text-xs">Don't forget to deploy your tier updates</p>
              </div>
              <button 
                onClick={handleSave}
                disabled={saving || editing !== null}
                className="ml-4 flex items-center gap-2 bg-white text-orange-600 px-5 py-2 rounded-full font-bold shadow-sm hover:bg-orange-50 disabled:opacity-50 transition-all active:scale-95 whitespace-nowrap"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editing ? "Finish Editing..." : "Deploy Now"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

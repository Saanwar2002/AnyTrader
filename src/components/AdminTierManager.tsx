import React, { useState, useEffect } from "react";
import { db, doc, updateDoc, setDoc, onSnapshot } from "@/src/firebase";
import { Loader2, Plus, Trash2, Save, AlertCircle, Edit2, X, Check } from "lucide-react";
import { cn } from "@/src/lib/utils";

interface Tier {
  price: number;
  maxQuotes: number;
  maxAcceptedQuotes: number;
  commission: number;
  leadFee: number;
  description: string;
  features: string[];
  color: string;
}

interface EditingState {
  model: string;
  tierKey: string;
  data: Tier;
}

export default function AdminTierManager() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "platform_config", "global_tiers"), (snapshot) => {
      if (snapshot.exists()) {
        setConfig(snapshot.data());
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
  };

  const handleDeleteTier = (model: string, tierKey: string) => {
    if (!window.confirm(`Are you sure you want to delete the ${tierKey} tier?`)) return;
    
    setConfig((prev: any) => {
      const newConfig = { ...prev };
      delete newConfig.providerModels[model].tiers[tierKey];
      return newConfig;
    });
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
      maxQuotes: 10,
      maxAcceptedQuotes: 2,
      commission: 0.1,
      leadFee: 0,
      description: "New tier description",
      features: ["Feature 1"],
      color: "bg-white border-slate-200"
    };

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
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "platform_config", "global_tiers"), config);
      alert("Tiers updated successfully");
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
      <div className="p-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
        <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-700 mb-2">Tier Configuration Not Found</h3>
        <p className="text-slate-500 mb-6 max-w-md mx-auto">
          The global tier configuration has not been initialized yet. Click the button below to create the initial configuration with sample data.
        </p>
        <button 
          onClick={async () => {
            const initialConfig = {
              providerModels: {
                one_off_trades: {
                  tiers: {
                    basic: { price: 29.99, maxQuotes: 10, maxAcceptedQuotes: 2, commission: 0.1, leadFee: 2, description: "Small traders", features: ["10 Quotes/mo"], color: "bg-blue-50 border-blue-200" },
                    pro: { price: 59.99, maxQuotes: 50, maxAcceptedQuotes: 10, commission: 0.08, leadFee: 0, description: "Professional trades", features: ["50 Quotes/mo", "Priority Support"], color: "bg-purple-50 border-purple-200" }
                  }
                },
                on_demand_transport: {
                  tiers: {
                    standard: { price: 0, maxQuotes: 9999, maxAcceptedQuotes: 9999, commission: 0.2, leadFee: 0, description: "Standard Taxi", features: ["Unlimited work"], color: "bg-green-50 border-green-200" }
                  }
                }
              }
            };
            setConfig(initialConfig);
            await setDoc(doc(db, "platform_config", "global_tiers"), initialConfig);
          }}
          className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700"
        >
          Initialize Tiers
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {Object.entries(config.providerModels || {}).map(([model, modelData]: [string, any]) => (
        <div key={model} className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">{model.replace(/_/g, " ")}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                          value={editing.data.description} 
                          onChange={(e) => setEditing({...editing, data: {...editing.data, description: e.target.value}})}
                          className="w-full text-sm border-b border-slate-200 py-1 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400">Price (£)</label>
                          <input 
                            type="number" 
                            value={editing.data.price} 
                            onChange={(e) => setEditing({...editing, data: {...editing.data, price: parseFloat(e.target.value)}})}
                            className="w-full text-sm border-b border-slate-200 py-1 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400">Comm (%)</label>
                          <input 
                            type="number" 
                            value={editing.data.commission * 100} 
                            onChange={(e) => setEditing({...editing, data: {...editing.data, commission: parseFloat(e.target.value) / 100}})}
                            className="w-full text-sm border-b border-slate-200 py-1 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Max Quotes</label>
                        <input 
                          type="number" 
                          value={editing.data.maxQuotes} 
                          onChange={(e) => setEditing({...editing, data: {...editing.data, maxQuotes: parseInt(e.target.value)}})}
                          className="w-full text-sm border-b border-slate-200 py-1 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Features (comma separated)</label>
                        <textarea 
                          value={editing.data.features.join(", ")} 
                          onChange={(e) => setEditing({...editing, data: {...editing.data, features: e.target.value.split(",").map(f => f.trim())}})}
                          className="w-full text-sm border-b border-slate-200 py-1 focus:outline-none focus:border-blue-500 h-16"
                        />
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={tierKey} className={cn("group p-6 rounded-2xl border shadow-sm transition-all hover:shadow-md relative", tier.color || "bg-white border-slate-200")}>
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-bold text-lg">{tierKey.toUpperCase()}</h4>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setEditing({ model, tierKey, data: { ...tier } })}
                        className="p-1 text-slate-400 hover:text-blue-500"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteTier(model, tierKey)}
                        className="p-1 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="text-slate-600 italic mb-2">{tier.description}</p>
                    <p className="font-bold">£{tier.price} / month</p>
                    <p>Commission: {tier.commission * 100}%</p>
                    <p>Quotes: {tier.maxQuotes}</p>
                    <div className="mt-4 pt-4 border-t border-slate-200/50">
                      <p className="font-semibold mb-1">Features:</p>
                      <ul className="list-disc list-inside text-xs space-y-1">
                        {tier.features?.map((f: string) => <li key={f}>{f}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
            <button 
              onClick={() => handleAddTier(model)}
              className="flex items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl hover:bg-slate-50 text-slate-500 py-6 min-h-[280px] transition-colors"
            >
              <Plus className="w-6 h-6 mr-2" /> Add Tier
            </button>
          </div>
        </div>
      ))}
      <div className="sticky bottom-6 flex justify-center">
        <button 
          onClick={handleSave}
          disabled={saving || editing !== null}
          className="flex items-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold shadow-xl hover:bg-slate-800 disabled:opacity-50 transition-all active:scale-95"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {editing ? "Save Changes First" : "Deploy Tier Updates to Platform"}
        </button>
      </div>
    </div>
  );
}

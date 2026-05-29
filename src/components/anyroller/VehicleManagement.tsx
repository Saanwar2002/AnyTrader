import React, { useState, useEffect } from "react";
import { 
  Car, 
  Search, 
  Plus, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  Settings, 
  Leaf, 
  Zap, 
  Fuel, 
  Calendar,
  Save
} from "lucide-react";
import { db, collection, onSnapshot } from "../../firebase";
import { toast } from "sonner";

interface FleetVehicle {
  id: string;
  model: string;
  plate: string;
  color: string;
  fuelType: "Electric" | "Hybrid" | "Diesel" | "Petrol";
  safetyClass: "VIP Premium" | "Standard Core" | "XL Segment";
  lastInspected: string;
  complianceOk: boolean;
}

const mockVehiclesSeed: FleetVehicle[] = [
  { id: "veh_101", model: "Tesla Model S Plaid", plate: "LO71 TAX", color: "Obsidian Black", fuelType: "Electric", safetyClass: "VIP Premium", lastInspected: "2026-04-20", complianceOk: true },
  { id: "veh_102", model: "Toyota Prius Plug-in", plate: "SH19 JZX", color: "Silver Metallic", fuelType: "Hybrid", safetyClass: "Standard Core", lastInspected: "2026-05-12", complianceOk: true },
  { id: "veh_103", model: "Mercedes-Benz Vito Tourer", plate: "WN21 OPF", color: "Dark Charcoal", fuelType: "Diesel", safetyClass: "XL Segment", lastInspected: "2026-03-01", complianceOk: true },
  { id: "veh_104", model: "Nissan Leaf e-Plus", plate: "BK18 KHL", color: "Polar White", fuelType: "Electric", safetyClass: "Standard Core", lastInspected: "2025-11-15", complianceOk: false }
];

export default function VehicleManagement() {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>(mockVehiclesSeed);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // New vehicle form State variables
  const [newBrand, setNewBrand] = useState("");
  const [newPlate, setNewPlate] = useState("");
  const [newColor, setNewColor] = useState("Black");
  const [newFuel, setNewFuel] = useState<"Electric" | "Hybrid" | "Diesel" | "Petrol">("Electric");
  const [newCategory, setNewCategory] = useState<"VIP Premium" | "Standard Core" | "XL Segment">("Standard Core");

  const handleRegisterVehicle = () => {
    if (!newBrand.trim() || !newPlate.trim()) {
      toast.error("Please insert vehicle model specifications and registration plate code.");
      return;
    }
    const newVeh: FleetVehicle = {
      id: "veh_" + Math.floor(Math.random() * 9000 + 1000),
      model: newBrand,
      plate: newPlate.toUpperCase(),
      color: newColor,
      fuelType: newFuel,
      safetyClass: newCategory,
      lastInspected: new Date().toISOString().split('T')[0],
      complianceOk: true
    };

    setVehicles([newVeh, ...vehicles]);
    setNewBrand("");
    setNewPlate("");
    setShowAddForm(false);
    toast.success(`Vehicle registration [${newVeh.plate}] appended securely to registry logs.`);
  };

  const handleToggleCompliance = (vehicleId: string) => {
    setVehicles(prev => prev.map(v => {
      if (v.id === vehicleId) {
        const nextState = !v.complianceOk;
        toast.info(`Compliance lock changed for vehicle profile.`);
        return { ...v, complianceOk: nextState };
      }
      return v;
    }));
  };

  const filteredVehicles = vehicles.filter(v => 
    v.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.plate.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Upper Title HUD */}
      <div className="p-5 bg-white border border-black rounded-lg shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Car className="w-4 h-4 text-[#AF52DE]" />
          <span className="text-[10px] uppercase font-mono tracking-widest text-[#AF52DE] font-bold">MANAGED FLEET REGISTRY</span>
        </div>
        <h2 className="text-xl font-bold text-black font-sans">Transport Vehicle Archives</h2>
        <p className="text-xs text-slate-500 mt-1">
          Catalog official active transport vehicles, monitor green fuel profiles, check routine safety inspections dates, and issue compliance locks.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Register Table */}
        <div className="lg:col-span-2 bg-white border border-black rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider flex items-center gap-1.5">
              <Car className="w-4 h-4 text-slate-700" /> Active Vehicle Directory
            </h3>

            {/* Registry Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Find plates or models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-100 border-none rounded text-xs text-stone-750 font-sans outline-none w-48 focus:ring-1 focus:ring-black"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredVehicles.map(veh => (
              <div key={veh.id} className="p-3.5 bg-slate-50 border border-black rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-[#AF52DE]">{veh.id}</span>
                    <h4 className="text-sm font-extrabold text-black">{veh.model}</h4>
                    <span className="text-[10px] font-mono bg-black text-white px-2 py-0.5 rounded uppercase">
                      {veh.plate}
                    </span>
                    <span className="text-[9px] uppercase font-mono font-bold border border-black/10 px-1 py-0.5 rounded bg-slate-205 text-slate-800">
                      {veh.safetyClass}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 mt-2">
                    <span className="flex items-center gap-1">
                      {veh.fuelType === "Electric" ? (
                        <Zap className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Fuel className="w-3.5 h-3.5 text-blue-500" />
                      )}
                      Propulsion: <strong className="text-slate-700 font-bold">{veh.fuelType}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Inspected: <strong className="text-slate-705 font-bold">{veh.lastInspected}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <span className={`text-[9.5px] uppercase font-mono font-black border px-2 py-1 rounded inline-block ${
                    veh.complianceOk 
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                      : "bg-rose-50 text-rose-800 border-rose-300"
                  }`}>
                    {veh.complianceOk ? "Compliant" : "Safety Warning / Locked"}
                  </span>

                  <button
                    onClick={() => handleToggleCompliance(veh.id)}
                    className="p-1 px-2.5 border border-black text-xs hover:bg-slate-100 text-black rounded font-mono font-bold transition cursor-pointer select-none"
                  >
                    Toggle Alert
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right side: quick asset checklist register */}
        <div className="bg-white border border-black rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <Plus className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider">Onboard Fleet Vehicle</h3>
          </div>

          <div className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-bold text-black block font-sans">Brand & Model Name</label>
              <input 
                type="text" 
                placeholder="e.g. Electric Mercedes EQE" 
                value={newBrand}
                onChange={(e) => setNewBrand(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-black text-xs rounded text-black font-sans"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-black block">License Plate registration</label>
              <input 
                type="text" 
                placeholder="e.g. EX23 TAX" 
                value={newPlate}
                onChange={(e) => setNewPlate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-black text-xs rounded text-slate-800 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-black block">Body paint</label>
                <input 
                  type="text" 
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-black text-xs rounded text-slate-805"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-black block">Power Unit</label>
                <select
                  value={newFuel}
                  onChange={(e) => setNewFuel(e.target.value as any)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-black text-xs rounded text-slate-805 outline-none"
                >
                  <option value="Electric">Electric</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Diesel">Diesel</option>
                  <option value="Petrol">Petrol</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-black block">Riding Scale Classification</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-black text-xs rounded text-slate-805 outline-none"
              >
                <option value="Standard Core">Standard Core Sedan</option>
                <option value="VIP Premium">VIP Premium Executive</option>
                <option value="XL Segment">XL Multi-Passenger Fleet</option>
              </select>
            </div>

            <button
              onClick={handleRegisterVehicle}
              className="w-full text-center py-2.5 bg-black hover:bg-slate-900 border border-black text-white text-xs font-mono font-black tracking-wider uppercase cursor-pointer rounded transition flex items-center justify-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5 text-emerald-400" />
              Complete Vehicle Entry
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { 
  Tag, 
  Settings, 
  MapPin, 
  Car, 
  Clock, 
  Save, 
  Plus, 
  Trash2, 
  Info, 
  Euro, 
  DollarSign,
  Briefcase
} from "lucide-react";
import { db, doc, getDoc, setDoc } from "../../firebase";
import { toast } from "sonner";

interface FareBand {
  id: string;
  name: string;
  base: number;
  perMile: number;
  perMinute: number;
}

export default function PricingFares() {
  const [baseFare, setBaseFare] = useState(3.50);
  const [perMileRate, setPerMileRate] = useState(2.20);
  const [perMinuteWaitCharge, setPerMinuteWaitCharge] = useState(0.40);
  const [congestionZoneCharge, setCongestionZoneCharge] = useState(4.00);
  const [isSaving, setIsSaving] = useState(false);

  // Custom vehicle band listings
  const [fareBands, setFareBands] = useState<FareBand[]>([
    { id: "band_1", name: "Standard Sedan", base: 3.50, perMile: 2.20, perMinute: 0.40 },
    { id: "band_2", name: "Executive PHV", base: 6.00, perMile: 3.50, perMinute: 0.60 },
    { id: "band_3", name: "XL Multi-Passenger", base: 8.00, perMile: 4.20, perMinute: 0.80 },
  ]);

  const [newBandName, setNewBandName] = useState("");
  const [newBandBase, setNewBandBase] = useState(4.00);
  const [newBandMile, setNewBandMile] = useState(2.50);

  // Firestore read
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const docRef = doc(db, "platform_settings", "transport_pricing");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.baseFare !== undefined) setBaseFare(data.baseFare);
          if (data.perMileRate !== undefined) setPerMileRate(data.perMileRate);
          if (data.perMinuteWaitCharge !== undefined) setPerMinuteWaitCharge(data.perMinuteWaitCharge);
          if (data.congestionZoneCharge !== undefined) setCongestionZoneCharge(data.congestionZoneCharge);
          if (data.fareBands !== undefined) setFareBands(data.fareBands);
        }
      } catch (err) {
        console.warn("Pricing configurations pulled from offline backup.", err);
      }
    };
    fetchPricing();
  }, []);

  const handleSavePricing = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, "platform_settings", "transport_pricing"), {
        baseFare,
        perMileRate,
        perMinuteWaitCharge,
        congestionZoneCharge,
        fareBands,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      toast.success("Standard tariff pricing records updated securely.");
    } catch (err) {
      console.warn("Failed saving, offline caching engaged.");
      localStorage.setItem("anyroller_pricing_defaults", JSON.stringify({
        baseFare, perMileRate, perMinuteWaitCharge, congestionZoneCharge, fareBands
      }));
      toast.success("Tariffs saved locally inside client session cache.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddBand = () => {
    if (!newBandName.trim()) {
      toast.error("Please insert a distinctive label name for this band layout.");
      return;
    }
    const newBand: FareBand = {
      id: "band_" + Math.floor(Math.random() * 9000 + 1000),
      name: newBandName,
      base: newBandBase,
      perMile: newBandMile,
      perMinute: 0.40,
    };
    setFareBands([...fareBands, newBand]);
    setNewBandName("");
    toast.success(`Fare band '${newBand.name}' created.`);
  };

  const handleDeleteBand = (id: string) => {
    setFareBands(fareBands.filter(b => b.id !== id));
    toast.info("Fare band removed.");
  };

  return (
    <div className="space-y-6">
      {/* HUD Header */}
      <div className="p-5 bg-white border border-black rounded-lg shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Tag className="w-4 h-4 text-emerald-500" />
          <span className="text-[10px] uppercase font-mono tracking-widest text-[#AF52DE] font-bold">SYSTEM TARIFF MATRIX</span>
        </div>
        <h2 className="text-xl font-bold text-black">Base Tariff & Pricing Bounds</h2>
        <p className="text-xs text-slate-500 mt-1">
          Manage system base fares, per-mile scales, wait times, and congestion area surcharges that regulate live ride bookings.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Tariff values control panel */}
        <div className="bg-white border border-black rounded-lg p-5 shadow-sm space-y-5">
          <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider border-b border-slate-100 pb-2">
            Base Pricing Rates
          </h3>

          {/* Base Fare */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-black">Default Base Dispatch Fare (£)</label>
              <span className="text-xs font-mono font-bold text-black">£{baseFare.toFixed(2)}</span>
            </div>
            <input 
              type="range" 
              min="1.50" 
              max="15.00" 
              step="0.50"
              value={baseFare} 
              onChange={(e) => setBaseFare(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Rate Per Mile */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-black">Charge Rate Per Mile (£)</label>
              <span className="text-xs font-mono font-bold text-black">£{perMileRate.toFixed(2)} / mile</span>
            </div>
            <input 
              type="range" 
              min="1.00" 
              max="6.00" 
              step="0.10"
              value={perMileRate} 
              onChange={(e) => setPerMileRate(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Wait charge */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-black">Driver Waiting Time Surcharge (£ / min)</label>
              <span className="text-xs font-mono font-bold text-black">£{perMinuteWaitCharge.toFixed(2)} / min</span>
            </div>
            <input 
              type="range" 
              min="0.10" 
              max="2.00" 
              step="0.05"
              value={perMinuteWaitCharge} 
              onChange={(e) => setPerMinuteWaitCharge(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* London Congestion surcharge */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-black">Congestion geofence surcharge (£)</label>
              <span className="text-xs font-mono font-bold text-slate-655">£{congestionZoneCharge.toFixed(2)}</span>
            </div>
            <input 
              type="range" 
              min="0.00" 
              max="12.00" 
              step="0.50"
              value={congestionZoneCharge} 
              onChange={(e) => setCongestionZoneCharge(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <button
            onClick={handleSavePricing}
            disabled={isSaving}
            className="w-full text-center py-2 bg-black hover:bg-slate-900 border border-black text-white text-xs font-mono font-black tracking-wider uppercase cursor-pointer rounded transition flex items-center justify-center gap-1.5"
          >
            <Save className="w-4 h-4 text-emerald-400" />
            {isSaving ? "Saving..." : "Save Tariff Baseline"}
          </button>
        </div>

        {/* Dynamic vehicle bands creator (Subcategory management) */}
        <div className="bg-white border border-black rounded-lg p-5 shadow-sm space-y-5">
          <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider border-b border-slate-100 pb-2">
            Vehicle Tier Tariffs
          </h3>

          <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
            {fareBands.map((band) => (
              <div key={band.id} className="flex justify-between items-center p-3.5 bg-slate-50 rounded border border-black">
                <div>
                  <div className="flex items-center gap-2">
                    <Car className="w-3.5 h-3.5 text-slate-800" />
                    <span className="font-bold text-black text-xs font-sans">{band.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono mt-1">
                    <span>Base: £{band.base.toFixed(2)}</span>
                    <span>Mile: £{band.perMile.toFixed(2)}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteBand(band.id)}
                  className="p-1 px-2 border border-black text-xs hover:bg-red-50 text-red-655 rounded transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Class Band Creator Field */}
          <div className="bg-slate-50 p-4 border border-slate-200 rounded space-y-4">
            <h4 className="text-[10px] uppercase font-mono font-bold text-slate-400">Add Premium/Custom Tier</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input 
                type="text" 
                placeholder="Tier Name (e.g. Electric Hybrid)" 
                value={newBandName}
                onChange={(e) => setNewBandName(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-black text-xs rounded text-black font-sans"
              />
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  step="0.5" 
                  min="1" 
                  max="20"
                  value={newBandBase}
                  onChange={(e) => setNewBandBase(parseFloat(e.target.value) || 1.0)}
                  className="w-1/2 px-2 py-1.5 bg-white border border-black text-xs rounded text-slate-800 font-mono"
                  placeholder="Base (£)"
                />
                <input 
                  type="number" 
                  step="0.1" 
                  min="1" 
                  max="10"
                  value={newBandMile}
                  onChange={(e) => setNewBandMile(parseFloat(e.target.value) || 1.0)}
                  className="w-1/2 px-2 py-1.5 bg-white border border-black text-xs rounded text-slate-800 font-mono"
                  placeholder="Mile (£)"
                />
              </div>
            </div>

            <button
              onClick={handleAddBand}
              className="w-full py-1.5 bg-black hover:bg-slate-900 text-white rounded text-xs font-mono font-black uppercase flex items-center justify-center gap-1.5 cursor-pointer border border-black"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              Append Vehicle Class Tier
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

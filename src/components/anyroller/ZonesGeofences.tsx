import React, { useState, useEffect } from "react";
import { 
  MapPin, 
  Map, 
  Settings, 
  Save, 
  Plus, 
  Trash2, 
  AlertOctagon, 
  Info,
  DollarSign,
  Compass
} from "lucide-react";
import { db, doc, getDoc, setDoc } from "../../firebase";
import { toast } from "sonner";

interface OperationalZone {
  id: string;
  name: string;
  baseMarkPremium: number;
  lookupRadiusLimit: number; // in meters
  restrictEntry: boolean;
  status: "Active Operational" | "Maintenance Dormant";
}

const initialZonesSeed: OperationalZone[] = [
  { id: "zone_1", name: "Central London Congestion Ring", baseMarkPremium: 5.50, lookupRadiusLimit: 2000, restrictEntry: false, status: "Active Operational" },
  { id: "zone_2", name: "Heathrow Hub Dispatch Depot", baseMarkPremium: 7.00, lookupRadiusLimit: 4000, restrictEntry: false, status: "Active Operational" },
  { id: "zone_3", name: "City Airport Restricted Slip", baseMarkPremium: 10.00, lookupRadiusLimit: 1500, restrictEntry: true, status: "Active Operational" },
  { id: "zone_4", name: "Croydon Suburb Overlay", baseMarkPremium: 0.00, lookupRadiusLimit: 3500, restrictEntry: false, status: "Maintenance Dormant" }
];

export default function ZonesGeofences() {
  const [zones, setZones] = useState<OperationalZone[]>(initialZonesSeed);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Form states for zone creation
  const [newZoneName, setNewZoneName] = useState("");
  const [newZonePremium, setNewZonePremium] = useState(3.00);
  const [newZoneRadius, setNewZoneRadius] = useState(2500);

  // Firestore transport load if exists
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const docRef = doc(db, "platform_settings", "geofence_zones");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().zonesList) {
          setZones(docSnap.data().zonesList);
        }
      } catch (err) {
        console.warn("Geofence zones pulling from offline store.", err);
      }
    };
    fetchZones();
  }, []);

  const handleSaveZonesGroup = async (updatedList: OperationalZone[]) => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, "platform_settings", "geofence_zones"), {
        zonesList: updatedList,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      toast.success("Operational geofences registry updated globally.");
    } catch {
      localStorage.setItem("anyroller_geofence_registry", JSON.stringify(updatedList));
      toast.success("Geofences saved temporarily in client session cache.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateZone = () => {
    if (!newZoneName.trim()) {
      toast.error("Please provide a distinct zone name label descriptor.");
      return;
    }
    const newZone: OperationalZone = {
      id: "zone_" + Math.floor(Math.random() * 9000 + 1000),
      name: newZoneName,
      baseMarkPremium: Number(newZonePremium),
      lookupRadiusLimit: Number(newZoneRadius),
      restrictEntry: false,
      status: "Active Operational"
    };

    const nextList = [newZone, ...zones];
    setZones(nextList);
    setNewZoneName("");
    handleSaveZonesGroup(nextList);
  };

  const handleToggleEntry = (id: string) => {
    const nextList = zones.map(z => {
      if (z.id === id) {
        const nextRestrict = !z.restrictEntry;
        toast.info(`Restrict entry updated for ${z.name}`);
        return { ...z, restrictEntry: nextRestrict };
      }
      return z;
    });
    setZones(nextList);
    handleSaveZonesGroup(nextList);
  };

  const handleDeleteZone = (id: string) => {
    const nextList = zones.filter(z => z.id !== id);
    setZones(nextList);
    handleSaveZonesGroup(nextList);
    toast.info("Geofenced sector deleted.");
  };

  const filteredZones = zones.filter(z => 
    z.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="p-5 bg-white border border-black rounded-lg shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Map className="w-4 h-4 text-emerald-500" />
          <span className="text-[10px] uppercase font-mono tracking-widest text-[#AF52DE] font-bold">OPERATIONAL BOUNDARIES MATRIX</span>
        </div>
        <h2 className="text-xl font-bold text-black font-sans">Geofence Zones & Regional Surcharges</h2>
        <p className="text-xs text-slate-500 mt-1">
          Enforce localized blockages, auto-calculate entry gate surcharges, and adjust maximum dispatch limits per municipal geo-sector.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Zones Listings */}
        <div className="lg:col-span-2 bg-white border border-black rounded-lg p-5 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-slate-700 animate-spin-slow" /> Registered Operative Sectors
            </h3>

            {/* Local lookup finder */}
            <input 
              type="text" 
              placeholder="Filter geofences..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-2.5 py-1-5 bg-slate-50 border border-black text-xs rounded text-black font-medium"
            />
          </div>

          <div className="space-y-3.5">
            {filteredZones.map(zone => (
              <div key={zone.id} className="p-4 bg-slate-50 border border-black rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-black text-[#AF52DE]">{zone.id}</span>
                    <h4 className="text-sm font-extrabold text-black">{zone.name}</h4>
                    <span className={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded ${
                      zone.status === "Active Operational" 
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-350"
                        : "bg-slate-200 text-slate-655 border border-slate-350"
                    }`}>
                      {zone.status}
                    </span>
                  </div>

                  <div className="flex gap-x-4 gap-y-1 text-[11px] text-slate-500 mt-2 font-mono">
                    <span>Base Premium: <strong className="text-stone-850">£{zone.baseMarkPremium.toFixed(2)}</strong></span>
                    <span>Dispatch Cap: <strong className="text-stone-850">{(zone.lookupRadiusLimit / 1000).toFixed(1)} km</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-end sm:self-center">
                  <button
                    onClick={() => handleToggleEntry(zone.id)}
                    className={`px-2.5 py-1 text-[10px] uppercase font-mono font-bold rounded border cursor-pointer transition ${
                      zone.restrictEntry 
                        ? "bg-rose-50 text-rose-800 border-rose-350" 
                        : "bg-white text-slate-700 border-black hover:bg-slate-100"
                    }`}
                  >
                    {zone.restrictEntry ? "Blocked Sector Entry" : "Permit Dispatch Entrance"}
                  </button>

                  <button
                    onClick={() => handleDeleteZone(zone.id)}
                    className="p-1.5 border border-black text-xs hover:bg-red-50 text-red-655 rounded transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Create Geofence Block */}
        <div className="bg-white border border-black rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <Plus className="w-4 h-4 text-emerald-555" />
            <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider">Deploy Geofence Area</h3>
          </div>

          <div className="space-y-4 font-sans">
            <div className="space-y-1">
              <label className="text-xs font-bold text-black block">Municipality / Area Description</label>
              <input 
                type="text" 
                placeholder="e.g. Manchester Airport Terminal 1" 
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-black text-xs text-black rounded"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-black block">Local Zone Fare Surcharge (£)</label>
              <div className="relative">
                <input 
                  type="number" 
                  step="0.5" 
                  min="0"
                  max="50"
                  value={newZonePremium}
                  onChange={(e) => setNewZonePremium(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 pl-8 bg-slate-50 border border-black text-xs text-black font-mono font-bold rounded"
                />
                <DollarSign className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-black block">Lookup GPS Radius range limit (meters)</label>
              <input 
                type="number" 
                step="250" 
                min="500"
                max="10000"
                value={newZoneRadius}
                onChange={(e) => setNewZoneRadius(parseInt(e.target.value) || 1000)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-black text-xs text-black font-mono rounded"
              />
            </div>

            <button
              onClick={handleCreateZone}
              className="w-full text-center py-2 bg-black hover:bg-slate-900 border border-black text-white text-xs font-mono font-black tracking-wider uppercase cursor-pointer rounded transition flex items-center justify-center gap-1"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              Add Geofenced Sector
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

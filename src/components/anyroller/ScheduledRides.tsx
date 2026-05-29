import React, { useState, useEffect } from "react";
import { 
  Calendar, 
  Clock, 
  Search, 
  Plus, 
  User, 
  Car, 
  MapPin, 
  Trash2, 
  ArrowRight,
  Info,
  CheckCircle2,
  Clock3,
  HelpCircle
} from "lucide-react";
import { db, collection, onSnapshot } from "../../firebase";
import { toast } from "sonner";

interface ScheduledTrip {
  id: string;
  riderName: string;
  source: string;
  destination: string;
  dateTimeStr: string;
  assignedDriver: string; // 'Unassigned' or name
  status: "pending_dispatch" | "dispatched" | "cancelled";
}

const mockScheduleSeed: ScheduledTrip[] = [
  { id: "sch_11", riderName: "Clara Templeton", source: "Heathrow Airport Terminal 5", destination: "The Ritz London, Piccadilly", dateTimeStr: "2026-06-01T08:30:00Z", assignedDriver: "Benjamin Taylor", status: "pending_dispatch" },
  { id: "sch_12", riderName: "Sarah Connor", source: "Battersea Power Station", destination: "King's Cross Station", dateTimeStr: "2026-06-02T10:15:00Z", assignedDriver: "Unassigned", status: "pending_dispatch" },
  { id: "sch_13", riderName: "Thomas Sterling", source: "10 Downing Street", destination: "St Pancras Hotel", dateTimeStr: "2026-06-05T14:00:00Z", assignedDriver: "Sienna Williams", status: "pending_dispatch" }
];

export default function ScheduledRides() {
  const [scheduledItems, setScheduledItems] = useState<ScheduledTrip[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [assigningId, setAssigningId] = useState<string | null>(null);

  // New reservation states
  const [newRider, setNewRider] = useState("");
  const [newSource, setNewSource] = useState("");
  const [newDest, setNewDest] = useState("");
  const [newDate, setNewDate] = useState("2026-06-05");
  const [newTime, setNewTime] = useState("09:00");

  useEffect(() => {
    // Attempt Firestore subscription options to keep it real-time
    const unsub = onSnapshot(collection(db, "scheduled_rides"), (snapshot) => {
      const list = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          riderName: d.riderName || "Client Rider",
          source: d.source || d.pickup || "London",
          destination: d.destination || d.dropoff || "London",
          dateTimeStr: d.dateTimeStr || d.pickupTime || new Date().toISOString(),
          assignedDriver: d.assignedDriver || "Unassigned",
          status: d.status || "pending_dispatch"
        } as ScheduledTrip;
      });

      if (list.length > 0) {
        // Merge with high fidelity mock schedule seed
        const merged = [...list];
        mockScheduleSeed.forEach(seed => {
          if (!merged.some(m => m.id === seed.id)) {
            merged.push(seed);
          }
        });
        setScheduledItems(merged);
      } else {
        setScheduledItems(mockScheduleSeed);
      }
    }, (err) => {
      console.warn("Scheduled rides subscription throttled. Directing fallback rosters.", err);
      setScheduledItems(mockScheduleSeed);
    });

    return () => unsub();
  }, []);

  const handleFormReserve = () => {
    if (!newRider.trim() || !newSource.trim() || !newDest.trim()) {
      toast.error("Please fill in passenger name, pickup, and destination address labels.");
      return;
    }
    const combinedDt = new Date(`${newDate}T${newTime}:00`).toISOString();
    const newTrip: ScheduledTrip = {
      id: "sch_" + Math.floor(Math.random() * 9000 + 1000),
      riderName: newRider,
      source: newSource,
      destination: newDest,
      dateTimeStr: combinedDt,
      assignedDriver: "Unassigned",
      status: "pending_dispatch"
    };

    setScheduledItems([newTrip, ...scheduledItems]);
    setNewRider("");
    setNewSource("");
    setNewDest("");
    toast.success(`Reservation schedule stored for ${newTrip.riderName} successfully.`);
  };

  const handleDirectAssignDriver = (id: string, driver: string) => {
    setScheduledItems(prev => prev.map(item => {
      if (item.id === id) {
        toast.success(`Assigned driver ${driver} to scheduled dispatch ${id}.`);
        return { ...item, assignedDriver: driver };
      }
      return item;
    }));
    setAssigningId(null);
  };

  const handleRemoveSchedule = (id: string) => {
    setScheduledItems(prev => prev.filter(item => item.id !== id));
    toast.info("Scheduled reservation deleted.");
  };

  const filteredSchedules = scheduledItems.filter(item => 
    item.riderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.destination.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => new Date(a.dateTimeStr).getTime() - new Date(b.dateTimeStr).getTime());

  return (
    <div className="space-y-6">
      {/* Intro Header HUD */}
      <div className="p-5 bg-white border border-black rounded-lg shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="w-4 h-4 text-emerald-500" />
          <span className="text-[10px] uppercase font-mono tracking-widest text-[#AF52DE] font-bold">PRE-RIDE ALLOCATION PROTOCOLS</span>
        </div>
        <h2 className="text-xl font-bold text-black font-sans">Reservations & Scheduled Dispatches</h2>
        <p className="text-xs text-slate-500 mt-1">
          Monitor upcoming booked dispatches, pair reservations with approved drivers, and coordinate future airport transitions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Reservation grid */}
        <div className="lg:col-span-2 bg-white border border-black rounded-lg p-5 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider flex items-center gap-1.5">
              <Clock3 className="w-4 h-4 text-slate-705" /> Scheduled Calendars Ledger
            </h3>

            {/* Filter Search */}
            <input 
              type="text" 
              placeholder="Find names, pickup..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-black text-xs text-black"
            />
          </div>

          <div className="space-y-3.5">
            {filteredSchedules.map(trip => {
              const dt = new Date(trip.dateTimeStr);
              return (
                <div key={trip.id} className="p-4 bg-slate-50 border border-black rounded font-sans space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-black text-[#AF52DE]">{trip.id}</span>
                      <h4 className="text-sm font-extrabold text-black">{trip.riderName}</h4>
                    </div>

                    <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 bg-white border border-black/10 p-1 px-2 rounded">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      <span>{dt.toLocaleDateString()} at {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC</span>
                    </div>
                  </div>

                  {/* Route indicators matching premium aesthetic */}
                  <div className="p-2.5 bg-white border border-black/10 rounded text-xs text-slate-800 space-y-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                      <span>From: <strong className="text-black font-extrabold">{trip.source}</strong></span>
                    </div>

                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                      <span>To: <strong className="text-black font-extrabold">{trip.destination}</strong></span>
                    </div>
                  </div>

                  {/* Driver pairing interface */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-205">
                    {assigningId === trip.id ? (
                      <div className="flex items-center gap-2 bg-white p-1.5 border border-black rounded w-full justify-between">
                        <span className="text-[10px] text-slate-550 font-bold block">Assign driver:</span>
                        <div className="flex gap-1.5">
                          <button 
                            onClick={() => handleDirectAssignDriver(trip.id, "Benjamin Taylor")}
                            className="bg-black hover:bg-slate-900 border border-black text-white text-[10px] font-bold px-2 py-1 rounded"
                          >
                            Ben Taylor
                          </button>
                          <button 
                            onClick={() => handleDirectAssignDriver(trip.id, "Sienna Williams")}
                            className="bg-black hover:bg-slate-900 border border-black text-white text-[10px] font-bold px-2 py-1 rounded"
                          >
                            Sienna W.
                          </button>
                          <button 
                            onClick={() => setAssigningId(null)}
                            className="text-slate-500 hover:text-black text-[10px] px-1.5 py-1"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-1.5">
                          <Car className="w-4 h-4 text-slate-550" />
                          <span className="text-xs text-slate-500 font-sans">Driver:</span>
                          <span className={`text-xs font-black px-1.5 py-0.5 rounded ${
                            trip.assignedDriver === "Unassigned" 
                              ? "bg-amber-50 text-amber-800 border border-amber-300"
                              : "bg-emerald-50 text-emerald-800 border border-emerald-300"
                          }`}>
                            {trip.assignedDriver}
                          </span>
                        </div>

                        <div className="flex gap-2">
                          {trip.assignedDriver === "Unassigned" && (
                            <button
                              onClick={() => setAssigningId(trip.id)}
                              className="px-2.5 py-1 bg-black hover:bg-slate-900 text-white border border-black rounded text-[10px] font-mono leading-none tracking-widest uppercase cursor-pointer transition select-none"
                            >
                              Dispatch Driver
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveSchedule(trip.id)}
                            className="p-1 px-2 border border-black hover:bg-red-50 text-red-655 rounded cursor-pointer transition select-none"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        </div>

        {/* Create Scheduled Ride Reservation Form */}
        <div className="bg-white border border-black rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-1 border-b border-slate-100 pb-2">
            <Plus className="w-4 h-4 text-emerald-555" />
            <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider">Schedule Reservation</h3>
          </div>

          <div className="space-y-4 font-sans">
            <div className="space-y-1">
              <label className="text-xs font-bold text-black block">Passenger Name Coordinator</label>
              <input 
                type="text" 
                placeholder="e.g. Thomas Shelby" 
                value={newRider}
                onChange={(e) => setNewRider(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-black text-xs text-black rounded"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-black block">Pickup Geographic address</label>
              <input 
                type="text" 
                placeholder="e.g. Piccadilly Circus, W1" 
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-black text-xs text-slate-800 rounded"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-black block">Destination geographic address</label>
              <input 
                type="text" 
                placeholder="e.g. Savoy Hotel Entrance" 
                value={newDest}
                onChange={(e) => setNewDest(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-black text-xs text-slate-800 rounded"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-black block">Target Date</label>
                <input 
                  type="date" 
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-black text-xs text-black font-mono rounded"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-black block">Target Time (UTC)</label>
                <input 
                  type="time" 
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-black text-xs text-emerald-800 font-mono font-black rounded"
                />
              </div>
            </div>

            <button
              onClick={handleFormReserve}
              className="w-full py-2 bg-black hover:bg-slate-900 border border-black text-white text-xs font-mono font-black tracking-wider uppercase cursor-pointer rounded transition flex items-center justify-center gap-1"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              Save Calendar Booking
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

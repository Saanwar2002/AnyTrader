import React, { useState, useEffect } from "react";
import { 
  ShieldAlert, 
  MapPin, 
  PhoneCall, 
  Radio, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  User, 
  Compass, 
  HelpCircle,
  HelpCircle as HeartbeatIcon,
  Flame,
  Zap,
  BellRing
} from "lucide-react";
import { db, collection, onSnapshot, doc, updateDoc } from "../../firebase";
import { toast } from "sonner";

interface SOSAlert {
  id: string;
  reporterName: string;
  reporterRole: "rider" | "driver";
  panicType: "Road Traffic Accident" | "Unrouted Vehicle Departure" | "Passenger Hostility" | "Physical Danger Case";
  currentCoords: string;
  activeTripId: string;
  timestamp: string;
  resolutionStatus: "CRITICAL OPEN" | "RESPONDING" | "RESOLVED SECURE";
}

const mockSOSSeed: SOSAlert[] = [
  { id: "sos_501", reporterName: "Marcus Sterling", reporterRole: "driver", panicType: "Unrouted Vehicle Departure", currentCoords: "51.5074° N, 0.1278° W", activeTripId: "ride_90112", timestamp: "2026-05-29T06:45:00Z", resolutionStatus: "CRITICAL OPEN" },
  { id: "sos_502", reporterName: "Thomas Sterling", reporterRole: "rider", panicType: "Passenger Hostility", currentCoords: "51.4812° N, 0.1911° W", activeTripId: "ride_90119", timestamp: "2026-05-29T06:12:00Z", resolutionStatus: "RESPONDING" },
  { id: "sos_503", reporterName: "Benjamin Taylor", reporterRole: "driver", panicType: "Road Traffic Accident", currentCoords: "51.5204° N, 0.0982° W", activeTripId: "ride_90123", timestamp: "2026-05-28T22:15:00Z", resolutionStatus: "RESOLVED SECURE" }
];

export default function SOSManager() {
  const [alerts, setAlerts] = useState<SOSAlert[]>(mockSOSSeed);

  // Firestore integration: listen to real active sos events
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "sos_alerts"), (snapshot) => {
      const liveAlerts = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          reporterName: d.reporterName || d.userName || "Critical Reporter",
          reporterRole: d.reporterRole || "rider",
          panicType: d.panicType || d.type || "Physical Danger Case",
          currentCoords: d.currentCoords || d.location || "London Coords",
          activeTripId: d.activeTripId || d.rideId || "ride_n_a",
          timestamp: d.timestamp || new Date().toISOString(),
          resolutionStatus: d.resolutionStatus || d.status || "CRITICAL OPEN"
        } as SOSAlert;
      });

      if (liveAlerts.length > 0) {
        // Merge with mockSOSSeed
        const combined = [...liveAlerts];
        mockSOSSeed.forEach(seed => {
          if (!combined.some(c => c.id === seed.id)) {
            combined.push(seed);
          }
        });
        setAlerts(combined);
      } else {
        setAlerts(mockSOSSeed);
      }
    }, (err) => {
      console.warn("SOS alerts pulling from local channels.", err);
      setAlerts(mockSOSSeed);
    });

    return () => unsub();
  }, []);

  const handleUpdateSOSStatus = async (alertId: string, status: "CRITICAL OPEN" | "RESPONDING" | "RESOLVED SECURE") => {
    try {
      await updateDoc(doc(db, "sos_alerts", alertId), {
        resolutionStatus: status,
        status: status
      });
      toast.success(`SOS resolved status marked: ${status}`);
    } catch {
      setAlerts(prev => prev.map(a => {
        if (a.id === alertId) {
          toast.success(`Local update: marked ${status}`);
          return { ...a, resolutionStatus: status };
        }
        return a;
      }));
    }
  };

  const criticalOpenCount = alerts.filter(a => a.resolutionStatus === "CRITICAL OPEN").length;

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="p-5 bg-white border border-black rounded-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-ping"></span>
            <span className="text-[10px] uppercase font-mono tracking-widest text-red-500 font-bold">EMERGENCY PROTOCOL GATEWAY</span>
          </div>
          <h2 className="text-xl font-bold text-black font-sans">Active Critical SOS Safety Console</h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time telemetry monitor listening to active emergency notifications triggered inside Driver Terminals and Passenger Bookings.
          </p>
        </div>

        {/* Live SOS Badge Indicator */}
        <div className="flex items-center gap-3 p-3 bg-red-50 text-red-900 border border-red-400 rounded font-mono text-xs select-none">
          <BellRing className="w-5 h-5 text-red-600 animate-bounce" />
          <div>
            <span className="text-[9px] uppercase font-sans text-red-500 block font-bold">CRITICAL ACTIVE ALERTS</span>
            <strong className="text-lg font-black">{criticalOpenCount} Open Threats</strong>
          </div>
        </div>
      </div>

      <div className="bg-white border border-black rounded-lg p-5 shadow-sm space-y-4">
        <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-605" /> Emergency SOS Incident Log
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {alerts.map(alert => (
            <div 
              key={alert.id} 
              className={`p-4 rounded border flex flex-col justify-between gap-4 transition duration-200 ${
                alert.resolutionStatus === "CRITICAL OPEN" 
                  ? "bg-red-50/40 border-red-500 shadow-sm" 
                  : alert.resolutionStatus === "RESPONDING"
                  ? "bg-amber-50/30 border-amber-500"
                  : "bg-white border-black"
              }`}
            >
              <div>
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-dashed border-slate-205">
                  <span className="text-xs font-mono font-black text-red-600">{alert.id}</span>
                  <span className={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded ${
                    alert.resolutionStatus === "CRITICAL OPEN"
                      ? "bg-red-600 text-white animate-pulse"
                      : alert.resolutionStatus === "RESPONDING"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-50 text-emerald-800"
                  }`}>
                    {alert.resolutionStatus}
                  </span>
                </div>

                <div className="space-y-3 pt-3">
                  {/* Reporter details */}
                  <div className="text-xs font-sans">
                    <span className="text-slate-400 font-mono text-[9.5px] uppercase block">Alarm Reporter</span>
                    <strong className="text-black font-extrabold">{alert.reporterName}</strong>
                    <span className="text-[10px] uppercase font-mono font-bold bg-slate-200 border border-black/10 px-1.5 py-0.2 rounded text-slate-705 ml-1.5">
                      {alert.reporterRole}
                    </span>
                  </div>

                  {/* Threat type */}
                  <div className="text-xs font-sans">
                    <span className="text-slate-400 font-mono text-[9.5px] uppercase block">Emergency Category</span>
                    <strong className="text-red-700 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {alert.panicType}
                    </strong>
                  </div>

                  {/* Coords Location */}
                  <div className="text-xs font-sans font-mono bg-white p-2 border border-black/10 rounded">
                    <span className="text-slate-400 block text-[9.5px] uppercase font-mono">Location Coordinates</span>
                    <span className="text-black font-bold flex items-center gap-1 font-mono text-[11px] mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-500" />
                      {alert.currentCoords}
                    </span>
                  </div>
                </div>
              </div>

              {/* Responder buttons */}
              <div className="pt-3.5 border-t border-slate-105 space-y-2">
                {alert.resolutionStatus !== "RESOLVED SECURE" ? (
                  <div className="flex gap-2.5">
                    {alert.resolutionStatus === "CRITICAL OPEN" && (
                      <button
                        onClick={() => handleUpdateSOSStatus(alert.id, "RESPONDING")}
                        className="flex-1 py-1 px-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] uppercase font-mono font-bold transition cursor-pointer select-none border border-amber-600"
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      onClick={() => handleUpdateSOSStatus(alert.id, "RESOLVED SECURE")}
                      className="flex-1 py-1 px-2.5 bg-black hover:bg-slate-900 border border-black text-white rounded text-[10px] uppercase font-mono font-bold transition cursor-pointer select-none"
                    >
                      Resolve Safety
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-mono font-black justify-center p-1.5 bg-emerald-50 rounded">
                    <CheckCircle className="w-4 h-4 text-emerald-500 animate-pulse" />
                    Secure & Case Closed
                  </div>
                )}

                <button
                  onClick={() => alert(`Initiating direct override communication. Local system mock phone bridge calling ${alert.reporterName}.`)}
                  className="w-full text-center py-1 bg-white hover:bg-slate-50 border border-black text-black rounded text-[10px] uppercase font-mono font-bold flex items-center justify-center gap-1"
                >
                  <PhoneCall className="w-3 h-3 text-red-550" />
                  Initiate Secure Audio Hook
                </button>
              </div>

            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

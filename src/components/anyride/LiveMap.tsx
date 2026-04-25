import React, { useState, useEffect } from "react";
import { Search, Layers, Filter, Crosshair, CheckCircle2, Car, MapPin, AlertCircle, Maximize2 } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { db } from "@/src/firebase";
import { collection, query, onSnapshot } from "firebase/firestore";

export default function LiveMap() {
  const [activeLayer, setActiveLayer] = useState<"all" | "available" | "in-ride">("all");
  const [drivers, setDrivers] = useState<any[]>([]);

  useEffect(() => {
    // Fetch real-time driver locations
    const q = query(collection(db, "live_tracking"));
    const unsub = onSnapshot(q, (snapshot) => {
      const activeDrivers = snapshot.docs.map(doc => {
        const data = doc.data();
        let status = "offline";
        if (data.isOnline) status = "available";
        // If an active ride exists for this driver, we update it below manually, or if data.status is present
        if (data.status === "in-ride") status = "in-ride"; 
        
        return {
          id: doc.id,
          name: data.name || doc.id.substring(0, 6),
          plate: data.plate || "ANY-TRD",
          status,
          lat: data.lat,
          lng: data.lng,
          // Generate a fake CSS position based on Lat/Lng since we don't have a real map canvas engine here
          position: {
            top: `${Math.abs((data.lat || 0) * 100) % 80 + 10}%`,
            left: `${Math.abs((data.lng || 0) * 100) % 80 + 10}%`,
          }
        };
      });
      setDrivers(activeDrivers);
    });
    return () => unsub();
  }, []);

  // Use dummy data if no live drivers are found so the map isn't completely empty during testing
  const displayDrivers = drivers.length > 0 ? drivers : [
    { id: "D-142", name: "Ahmed K.", plate: "AB12 CDE", status: "in-ride", position: { top: "30%", left: "45%" } },
    { id: "D-089", name: "Sarah M.", plate: "WX89 YZK", status: "available", position: { top: "50%", left: "60%" } },
    { id: "D-234", name: "Mike T.", plate: "LD11 PQM", status: "available", position: { top: "65%", left: "35%" } },
  ];

  const filteredDrivers = displayDrivers.filter(d => activeLayer === "all" || d.status === activeLayer);
  
  const onlineCount = displayDrivers.filter(d => d.status === 'available').length;
  const inRideCount = displayDrivers.filter(d => d.status === 'in-ride').length;
  const offlineCount = displayDrivers.filter(d => d.status === 'offline').length;

  return (
    <div className="h-[calc(100vh-10rem)] flex flex-col md:flex-row gap-6 relative">
      {/* Map Area */}
      <div className="flex-1 bg-slate-100 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col">
         {/* Fake Map Grid */}
         <div className="absolute inset-0 z-0 bg-slate-50" style={{ backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)", backgroundSize: "30px 30px" }}></div>
         
         {/* Map Elements (Simulated) */}
         <div className="absolute inset-0 z-10 p-8">
            {/* GeoZone */}
            <div className="absolute top-[20%] left-[25%] w-[40%] h-[40%] bg-emerald-500/10 border-2 border-emerald-500/30 rounded-[4rem] backdrop-blur-[1px] flex items-center justify-center">
              <span className="text-emerald-700/50 font-black tracking-widest uppercase text-2xl rotate-[-15deg]">City Center</span>
            </div>

            {/* Drivers */}
            {filteredDrivers.map(driver => (
              <div 
                key={driver.id} 
                className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                style={{ top: driver.position.top, left: driver.position.left }}
              >
                 <div className={cn(
                   "w-8 h-8 rounded-full border-2 border-white flex items-center justify-center shadow-lg relative z-20 transition-transform group-hover:scale-110",
                   driver.status === "available" ? "bg-emerald-500" : 
                   driver.status === "in-ride" ? "bg-blue-500" : "bg-slate-400"
                 )}>
                   <Car className="w-4 h-4 text-white" />
                   {driver.status === "in-ride" && (
                     <span className="absolute -top-1 -right-1 flex h-3 w-3">
                       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                       <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500 border-2 border-white"></span>
                     </span>
                   )}
                 </div>
                 
                 {/* Tooltip */}
                 <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap shadow-xl pointer-events-none z-30">
                   <div className="flex items-center gap-2">
                     <span>{driver.name}</span>
                     <span className="text-slate-400">•</span>
                     <span className={
                       driver.status === "available" ? "text-emerald-400" : 
                       driver.status === "in-ride" ? "text-blue-400" : "text-slate-400"
                     }>{driver.status}</span>
                   </div>
                   <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                 </div>
              </div>
            ))}
         </div>

         {/* Map Controls */}
         <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-start pointer-events-none">
            <div className="bg-white/90 backdrop-blur pointer-events-auto rounded-xl shadow-lg border border-slate-200 p-2 flex gap-1">
               <button 
                 onClick={() => setActiveLayer("all")}
                 className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-colors", activeLayer === "all" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}
               >
                 All Vehicles
               </button>
               <button 
                 onClick={() => setActiveLayer("available")}
                 className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-colors", activeLayer === "available" ? "bg-emerald-500 text-white" : "text-slate-600 hover:bg-slate-100")}
               >
                 Available
               </button>
               <button 
                 onClick={() => setActiveLayer("in-ride")}
                 className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-colors", activeLayer === "in-ride" ? "bg-blue-500 text-white" : "text-slate-600 hover:bg-slate-100")}
               >
                 In Ride
               </button>
            </div>
            
            <div className="flex flex-col gap-2 pointer-events-auto">
               <button className="bg-white p-2.5 rounded-xl shadow-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors">
                 <Layers className="w-5 h-5" />
               </button>
               <button className="bg-white p-2.5 rounded-xl shadow-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors">
                 <Crosshair className="w-5 h-5" />
               </button>
               <button className="bg-white p-2.5 rounded-xl shadow-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors">
                 <Maximize2 className="w-5 h-5" />
               </button>
            </div>
         </div>

         {/* Status Footer */}
         <div className="absolute bottom-4 left-4 z-20 pointer-events-auto bg-white/90 backdrop-blur px-4 py-2 rounded-xl shadow-lg border border-slate-200 flex items-center gap-6">
            <div className="flex items-center gap-2">
               <div className="w-3 h-3 rounded-full bg-emerald-500 border border-white shadow-sm"></div>
               <span className="text-xs font-bold text-slate-700">{onlineCount} Online</span>
            </div>
            <div className="flex items-center gap-2">
               <div className="w-3 h-3 rounded-full bg-blue-500 border border-white shadow-sm"></div>
               <span className="text-xs font-bold text-slate-700">{inRideCount} In-Ride</span>
            </div>
            <div className="flex items-center gap-2">
               <div className="w-3 h-3 rounded-full bg-slate-400 border border-white shadow-sm"></div>
               <span className="text-xs font-bold text-slate-700">{offlineCount} Offline</span>
            </div>
         </div>
      </div>

      {/* Sidebar List */}
      <div className="w-full md:w-80 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col shrink-0 overflow-hidden">
         <div className="p-4 border-b border-slate-100">
           <h3 className="text-sm font-black text-slate-900 mb-3">Live Dispatch</h3>
           <div className="relative">
             <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
             <input type="text" placeholder="Search driver or plate..." className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
           </div>
         </div>
         
         <div className="flex-1 overflow-y-auto no-scrollbar">
           <div className="divide-y divide-slate-100">
             {displayDrivers.map(driver => (
                <div key={driver.id} className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold text-slate-900">{driver.name}</span>
                    <span className={cn(
                      "text-[10px] uppercase tracking-widest font-black px-2 py-0.5 rounded",
                      driver.status === "available" ? "bg-emerald-50 text-emerald-600" :
                      driver.status === "in-ride" ? "bg-blue-50 text-blue-600" :
                      "bg-slate-100 text-slate-500"
                    )}>
                      {driver.status.replace('-', ' ')}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-slate-500 font-medium">ID: {driver.id} • Plate: {driver.plate}</span>
                    {driver.status === "in-ride" && (
                      <span className="text-[10px] font-bold text-blue-600 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" /> En route to destination (ETA 4m)
                      </span>
                    )}
                  </div>
                </div>
             ))}
           </div>
         </div>
      </div>
    </div>
  );
}

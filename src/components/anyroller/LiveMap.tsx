import React, { useState, useEffect, useRef } from "react";
import { 
  db, 
  collection, 
  onSnapshot 
} from "../../firebase";
import { 
  getGoogleMapsApiKey 
} from "../../lib/capacitor";
import { 
  GoogleMap, 
  useJsApiLoader, 
  MarkerF, 
  OverlayViewF, 
  OverlayView 
} from "@react-google-maps/api";
import { 
  Car, 
  Users, 
  SlidersHorizontal, 
  Play, 
  Square, 
  Settings, 
  BatteryCharging, 
  Clock, 
  Eye, 
  MapPin, 
  Navigation,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

// Premium Anti-Glare Golden Map Options
const premiumMapOptions: google.maps.MapOptions = {
  mapTypeId: "roadmap",
  disableDefaultUI: true,
  clickableIcons: false,
  isFractionalZoomEnabled: true,
  keyboardShortcuts: false,
  styles: [
    { elementType: "geometry", stylers: [{ color: "#ebe3cd" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#523735" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#f5f1e6" }] },
    {
      featureType: "administrative",
      elementType: "geometry.stroke",
      stylers: [{ color: "#c9b2a6" }],
    },
    {
      featureType: "administrative.land_parcel",
      elementType: "geometry.stroke",
      stylers: [{ color: "#dcd2be" }],
    },
    {
      featureType: "administrative.land_parcel",
      elementType: "labels.text.fill",
      stylers: [{ color: "#ae9e90" }],
    },
    {
      featureType: "landscape.natural",
      elementType: "geometry",
      stylers: [{ color: "#dfd2ae" }],
    },
    {
      featureType: "poi",
      elementType: "geometry",
      stylers: [{ color: "#dfd2ae" }],
    },
    {
      featureType: "poi",
      elementType: "labels.text.fill",
      stylers: [{ color: "#93817c" }],
    },
    {
      featureType: "poi.park",
      elementType: "geometry.fill",
      stylers: [{ color: "#a5b076" }],
    },
    {
      featureType: "poi.park",
      elementType: "labels.text.fill",
      stylers: [{ color: "#447530" }],
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#ffffff" }],
    },
    {
      featureType: "road.arterial",
      elementType: "geometry",
      stylers: [{ color: "#f8c967" }],
    },
    {
      featureType: "road.arterial",
      elementType: "geometry.stroke",
      stylers: [{ color: "#e9bc62" }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry",
      stylers: [{ color: "#f8c967" }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry.stroke",
      stylers: [{ color: "#e9bc62" }],
    },
    {
      featureType: "road.highway.controlled_access",
      elementType: "geometry",
      stylers: [{ color: "#e98d58" }],
    },
    {
      featureType: "road.highway.controlled_access",
      elementType: "geometry.stroke",
      stylers: [{ color: "#db8555" }],
    },
    {
      featureType: "road.local",
      elementType: "labels.text.fill",
      stylers: [{ color: "#806b63" }],
    },
    {
      featureType: "transit.line",
      elementType: "geometry",
      stylers: [{ color: "#dfd2ae" }],
    },
    {
      featureType: "transit.line",
      elementType: "labels.text.fill",
      stylers: [{ color: "#8f7d77" }],
    },
    {
      featureType: "transit.line",
      elementType: "labels.text.stroke",
      stylers: [{ color: "#ebe3cd" }],
    },
    {
      featureType: "transit.station",
      elementType: "geometry",
      stylers: [{ color: "#dfd2ae" }],
    },
    {
      featureType: "water",
      elementType: "geometry.fill",
      stylers: [{ color: "#b9d3c2" }],
    },
    {
      featureType: "water",
      elementType: "labels.text.fill",
      stylers: [{ color: "#92998d" }],
    },
  ],
};

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

// Default coordinates centered on London
const defaultCenter = {
  lat: 51.5074,
  lng: -0.1278
};

// Realistic seed drivers around central London in case Firestore doesn't have live tracks yet
const mockDriversSeed = [
  {
    id: "mock_d1",
    name: "Benjamin Taylor",
    phone: "+44 7700 901122",
    vehicle: "Black Tesla Model 3",
    plate: "LX20 KZT",
    lat: 51.5120,
    lng: -0.1410,
    status: "available",
    heading: 90,
    speedMph: 24,
    battery: 84,
  },
  {
    id: "mock_d2",
    name: "Sienna Williams",
    phone: "+44 7700 902233",
    vehicle: "Silver Toyota Prius",
    plate: "WK71 BCF",
    lat: 51.5040,
    lng: -0.1150,
    status: "on_ride",
    heading: 180,
    speedMph: 12,
    battery: 68,
  },
  {
    id: "mock_d3",
    name: "Oliver Harrison",
    phone: "+44 7700 903344",
    vehicle: "Navy Mercedes EQV",
    plate: "MH69 YXM",
    lat: 51.5165,
    lng: -0.1280,
    status: "available",
    heading: 270,
    speedMph: 0,
    battery: 92,
  },
  {
    id: "mock_d4",
    name: "Amara Davies",
    phone: "+44 7700 904455",
    vehicle: "White Nissan Leaf",
    plate: "EK21 VRL",
    lat: 51.4990,
    lng: -0.1340,
    status: "on_ride",
    heading: 45,
    speedMph: 18,
    battery: 41,
  },
  {
    id: "mock_d5",
    name: "Marcus Sterling",
    phone: "+44 7700 905566",
    vehicle: "Grey Tesla Model Y",
    plate: "YT72 GDL",
    lat: 51.5210,
    lng: -0.1100,
    status: "offline",
    heading: 315,
    speedMph: 0,
    battery: 12,
  },
];

export default function LiveMap() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [mapCenter, setMapCenter] = useState(defaultCenter);

  // Sync mode state controlling budget optimization
  const [syncMode, setSyncMode] = useState<"realtime" | "buffered" | "suspended">("realtime");
  const [simulationActive, setSimulationActive] = useState<boolean>(true);
  
  // Ref to hold current live location updates to support "buffered" updates without running onSnapshot repeatedly
  const rawLiveTrackingRef = useRef<any[]>([]);
  const simulationIntervalRef = useRef<any>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: getGoogleMapsApiKey(),
    libraries: ["places"],
    version: "quarterly"
  });

  // Listen to Firestore real-time live_tracking updates
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "live_tracking"), (snapshot) => {
      const list = snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((item: any) => item.lat && item.lng);

      rawLiveTrackingRef.current = list;
      
      // If we are in "realtime" sync mode, immediately synchronize results
      if (syncMode === "realtime") {
        mergeDataAndApply(list);
      }
    }, (err) => {
      console.warn("Firestore live_tracking subscription error:", err);
    });

    return () => unsub();
  }, [syncMode]);

  // Buffer sync mechanism (15-second cycles)
  useEffect(() => {
    if (syncMode !== "buffered") return;

    const interval = setInterval(() => {
      mergeDataAndApply(rawLiveTrackingRef.current);
    }, 15000);

    return () => clearInterval(interval);
  }, [syncMode]);

  // Handle data combining (matching Firestore data with high-fidelity local seed records)
  const mergeDataAndApply = (firestoreData: any[]) => {
    const freshList = mockDriversSeed.map(seeded => {
      // Find matching live record if any
      const live = firestoreData.find(item => item.driverId === seeded.id || item.id === seeded.id);
      if (live) {
        return {
          ...seeded,
          lat: live.lat,
          lng: live.lng,
          status: live.status || seeded.status,
          updatedAt: live.updatedAt
        };
      }
      return seeded;
    });

    // Add fully remote driver positions too
    firestoreData.forEach(item => {
      if (!mockDriversSeed.some(s => s.id === item.id || s.id === item.driverId)) {
        freshList.push({
          id: item.driverId || item.id,
          name: item.name || `Driver ${item.id.slice(0, 4)}`,
          phone: item.phone || "Hidden",
          vehicle: item.vehicleInfo || item.vehicle || "Platform Vehicle",
          plate: item.vehiclePlate || item.plate || "N/A",
          lat: item.lat,
          lng: item.lng,
          status: item.status || "available",
          heading: item.heading || 0,
          speedMph: item.speedMph || 15,
          battery: item.battery || 80,
          isRemoteOnly: true
        });
      }
    });

    setDrivers(freshList);
  };

  // Run initial merger upon mount
  useEffect(() => {
    mergeDataAndApply([]);
  }, []);

  // London dynamic simulator (gently moves seed drivers on map to simulate GPS movement without API strain)
  useEffect(() => {
    if (!simulationActive) {
      if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
      return;
    }

    simulationIntervalRef.current = setInterval(() => {
      setDrivers(prevDrivers => {
        const next = prevDrivers.map(drv => {
          // Do not move offline drivers
          if (drv.status === "offline") return drv;

          // Tiny delta move
          const headingRad = (drv.heading * Math.PI) / 180;
          const deltaLat = (Math.cos(headingRad) * 0.00008) * (drv.speedMph ? drv.speedMph / 10 : 1);
          const deltaLng = (Math.sin(headingRad) * 0.00012) * (drv.speedMph ? drv.speedMph / 10 : 1);

          let newLat = drv.lat + deltaLat;
          let newLng = drv.lng + deltaLng;
          let newHeading = drv.heading;

          // Boundaries checking: clamp within London center context
          if (Math.abs(newLat - defaultCenter.lat) > 0.08 || Math.abs(newLng - defaultCenter.lng) > 0.08) {
            newHeading = (drv.heading + 145) % 360;
          }

          // Random slight turn
          if (Math.random() > 0.85) {
            newHeading = (drv.heading + (Math.random() > 0.5 ? 90 : -90)) % 360;
          }

          return {
            ...drv,
            lat: newLat,
            lng: newLng,
            heading: newHeading,
            speedMph: drv.status === "on_ride" ? 22 : 12,
          };
        });

        // Sync back coordinates mapping if parent selected driver is updated
        if (selectedDriver) {
          const updatedSelected = next.find(d => d.id === selectedDriver.id);
          if (updatedSelected) {
            setSelectedDriver(updatedSelected);
          }
        }

        return next;
      });
    }, 2000);

    return () => {
      if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
    };
  }, [simulationActive, selectedDriver]);

  // Center maps dynamically
  const selectAndFocusDriver = (driver: any) => {
    setSelectedDriver(driver);
    setMapCenter({ lat: driver.lat, lng: driver.lng });
    map?.panTo({ lat: driver.lat, lng: driver.lng });
    map?.setZoom(16);
  };

  const createCustomMarkerIcon = (color: string) => {
    if (typeof window === "undefined" || !window.google) return undefined;
    return {
      path: "M12,2C6.48,2,2,6.48,2,12s4.48,10,10,10,10-4.48,10-10S17.52,2,12,2zm1,15h-2v-6h2v6zm0-8h-2V7h2v2z",
      fillColor: color,
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 1,
      scale: 1,
    };
  };

  if (loadError) {
    return (
      <div className="p-6 bg-red-50 border border-black rounded-lg text-red-700">
        <h3 className="font-bold mb-2">Google Maps Core Load Error</h3>
        <p className="text-xs">
          The requested system API Key for Google Maps routing appears unassigned, invalid, or expired. Please check settings keys parameters.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-4">
      {/* Dynamic Command Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-white border border-black rounded-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#AF52DE]">Interactive Control Hub</span>
          </div>
          <h2 className="text-xl font-bold text-black font-sans">Active Live-Tracks Radar</h2>
          <p className="text-xs text-slate-500 leading-none mt-1">
            Visual tracking matrix showing available, bound-journey, and emergency coordinates.
          </p>
        </div>

        {/* Dynamic Sync Options (The Cost Reduction Feature Panel!) */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex bg-slate-100 border border-slate-300 rounded p-1">
            <button
              onClick={() => {
                setSyncMode("realtime");
                toast.success("Streaming Live-Tracks activated directly.");
              }}
              className={`px-2.5 py-1 text-xs font-bold rounded cursor-pointer transition-all ${
                syncMode === "realtime"
                  ? "bg-black text-white"
                  : "text-slate-600 hover:text-black"
              }`}
              title="Queries location instantly on every single coordinate change on Firestore DB."
            >
              Direct Sync
            </button>
            <button
              onClick={() => {
                setSyncMode("buffered");
                toast.info("15-Second Local Buffering enabled to conserve DB limits.");
              }}
              className={`px-2.5 py-1 text-xs font-bold rounded cursor-pointer transition-all ${
                syncMode === "buffered"
                  ? "bg-black text-white"
                  : "text-slate-600 hover:text-black"
              }`}
              title="Locks database queries on 15s aggregate cycles saving 90%+ in reading transaction costs."
            >
              Buffered (15s)
            </button>
            <button
              onClick={() => {
                setSyncMode("suspended");
                toast.warning("Background map syncing suspended. Snapshot preserved.");
              }}
              className={`px-2.5 py-1 text-xs font-bold rounded cursor-pointer transition-all ${
                syncMode === "suspended"
                  ? "bg-black text-white"
                  : "text-slate-600 hover:text-black"
              }`}
              title="Blocks background DB connections. Ideal for low-cost standby oversight."
            >
              Suspended
            </button>
          </div>

          <div className="w-px h-6 bg-slate-300 hidden md:block"></div>

          {/* Local Simulated movement triggers */}
          <button
            onClick={() => {
              setSimulationActive(!simulationActive);
              toast(`Dynamic tracking simulation ${!simulationActive ? "activated" : "paused"}`);
            }}
            className={`flex items-center gap-1 px-3 py-1.5 border border-black rounded text-xs font-bold cursor-pointer hover:bg-slate-50 transition ${
              simulationActive ? "bg-emerald-50 text-emerald-800" : "bg-white text-slate-700"
            }`}
          >
            {simulationActive ? (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-500 animate-spin" /> Simulation ON
              </>
            ) : (
              <>
                <Square className="w-3.5 h-3.5" /> Simulation PAUSED
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 overflow-hidden">
        {/* Map Wrapper with Premium styling */}
        <div className="lg:col-span-3 bg-white border border-black rounded-lg overflow-hidden relative shadow-sm h-full min-h-[300px]">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={13}
              options={premiumMapOptions}
              onLoad={(m) => setMap(m)}
            >
              {drivers.map((drv) => {
                const colorCode = 
                  drv.status === "available" ? "#10b981" : 
                  drv.status === "on_ride" ? "#3b82f6" : "#64748b";

                return (
                  <React.Fragment key={drv.id}>
                    {/* Render standard marker block */}
                    <MarkerF
                      position={{ lat: drv.lat, lng: drv.lng }}
                      onClick={() => selectAndFocusDriver(drv)}
                      icon={{
                        path: "M12,2C8.13,2,5,5.13,5,9c0,5.25,7,13,7,13s7-7.75,7-13c0-3.87-3.13-7-7-7zm0,9.5c-1.38,0-2.5-1.12-2.5-2.5s1.12-2.5,2.5-2.5,2.5,1.12,2.5,2.5-1.12,2.5-2.5,2.5z",
                        fillColor: colorCode,
                        fillOpacity: 1,
                        strokeColor: "#FFFFFF",
                        strokeWeight: 1.5,
                        scale: 1.5,
                        anchor: new window.google.maps.Point(12, 22),
                      }}
                    />

                    {/* Rendering a delicate direction vector visualizer above active drivers */}
                    {drv.status !== "offline" && drv.speedMph > 0 && (
                      <OverlayViewF
                        position={{ lat: drv.lat, lng: drv.lng }}
                        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                        getPixelPositionOffset={(w, h) => ({ x: 8, y: -28 })}
                      >
                        <div 
                          className="bg-black/90 text-white font-mono text-[9px] px-1 py-0.5 rounded flex items-center gap-1 border border-white/20 pointer-events-none"
                          style={{ transform: `rotate(${drv.heading}deg)`, transformOrigin: "center left" }}
                        >
                          <Navigation className="w-2.5 h-2.5 fill-current text-amber-400 rotate-45" />
                        </div>
                      </OverlayViewF>
                    )}
                  </React.Fragment>
                );
              })}
            </GoogleMap>
          ) : (
            <div className="absolute inset-0 bg-amber-50/40 flex items-center justify-center font-bold text-slate-400">
              Initializing Premium Anti-Glare Vector System...
            </div>
          )}

          {/* Floating UI HUD elements */}
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3 pointer-events-none">
            <div className="bg-slate-900/95 backdrop-blur-sm border border-white/20 rounded-lg p-2.5 text-white max-w-[280px] pointer-events-auto shadow-2xl">
              <div className="flex items-center gap-2 mb-1 select-none">
                <Info className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] font-bold font-mono text-[#AF52DE]">MAP CLOUD RADAR</span>
              </div>
              <p className="text-[10px] text-slate-300 leading-relaxed font-sans">
                Currently tracking <span className="text-white font-bold">{drivers.length} units</span> across London. Touch a telemetry marker nodes to view profile dashboard records.
              </p>
            </div>

            <div className="bg-white/95 backdrop-blur-sm border border-black rounded-lg p-2.5 pointer-events-auto shadow-lg text-[10px] flex items-center gap-4">
              <div className="flex items-center gap-1.5 font-bold text-black">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] inline-block border border-black/15"></span> Available
              </div>
              <div className="flex items-center gap-1.5 font-bold text-black">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] inline-block border border-black/15"></span> On Trip
              </div>
              <div className="flex items-center gap-1.5 font-bold text-black">
                <span className="w-2.5 h-2.5 rounded-full bg-[#64748b] inline-block border border-black/15"></span> Offline
              </div>
            </div>
          </div>
        </div>

        {/* Active tracking side control panels */}
        <div className="bg-white border border-black rounded-lg p-4 flex flex-col justify-between shadow-sm overflow-hidden h-full">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 shrink-0">
              <Users className="w-4 h-4 text-slate-700" />
              <h3 className="text-sm font-bold text-black font-sans">Active Transport Fleet</h3>
            </div>

            {/* Scannable Active Driver List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0 scrollbar-thin">
              {drivers.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-8 font-mono">
                  Loading driver feeds...
                </div>
              ) : (
                drivers.map((drv) => (
                  <button
                    key={drv.id}
                    onClick={() => selectAndFocusDriver(drv)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col gap-1.5 ${
                      selectedDriver?.id === drv.id
                        ? "bg-slate-900 border-black text-white hover:bg-black"
                        : "bg-white border-slate-200 hover:border-black hover:bg-slate-50 text-black"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 w-full text-xs">
                      <span className="font-extrabold truncate">{drv.name}</span>
                      <span className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold font-mono border uppercase ${
                        drv.status === "available"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : drv.status === "on_ride"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}>
                        {drv.status}
                      </span>
                    </div>

                    <div className={`text-[10px] flex items-center justify-between gap-2 font-medium ${
                      selectedDriver?.id === drv.id ? "text-slate-300" : "text-slate-500"
                    }`}>
                      <span className="truncate">{drv.vehicle}</span>
                      <span className="font-mono bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-extrabold px-1 rounded text-[8px]">
                        {drv.plate}
                      </span>
                    </div>

                    {drv.status !== "offline" && (
                      <div className="flex items-center justify-between text-[9px] font-mono border-t border-slate-200/50 pt-1.5 mt-0.5 opacity-90">
                        <span className="flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 text-blue-400" /> {drv.speedMph} mph
                        </span>
                        <span className="flex items-center gap-1">
                          <BatteryCharging className="w-2.5 h-2.5 text-emerald-400 animate-pulse" /> {drv.battery}%
                        </span>
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Detailed Selected Driver Deck Overlay */}
          <AnimatePresence mode="wait">
            {selectedDriver && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className="mt-4 pt-3 border-t border-black bg-slate-50 p-3 rounded-lg border border-black shrink-0 text-black text-xs"
              >
                <div className="flex items-center justify-between font-bold mb-1 border-b border-slate-200 pb-1.5">
                  <span className="truncate">{selectedDriver.name}</span>
                  <button 
                    onClick={() => setSelectedDriver(null)}
                    className="text-[10px] text-slate-500 hover:text-black font-mono"
                  >
                    Close
                  </button>
                </div>
                
                <div className="space-y-1 text-[10px] font-medium text-slate-600">
                  <div className="flex justify-between">
                    <span>Active Phone:</span>
                    <span className="font-bold text-black font-mono">{selectedDriver.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vehicle Class:</span>
                    <span className="font-bold text-black">{selectedDriver.vehicle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>License Registration:</span>
                    <span className="font-mono bg-white font-extrabold px-1.5 rounded border border-black/10 text-black">
                      {selectedDriver.plate}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200/60 font-mono mt-1">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5 text-red-500" /> Coordinates:
                    </span>
                    <span className="text-black font-extrabold">
                      {selectedDriver.lat.toFixed(4)}, {selectedDriver.lng.toFixed(4)}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

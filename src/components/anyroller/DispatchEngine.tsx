import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Map, Settings, Users, CarFront, AlertCircle, CheckCircle2, 
  MapPin, Clock, ArrowRight, UserPlus, Zap, Filter, Sliders,
  Navigation, Check, RotateCcw, RefreshCw, Star, Info,
  Search, Play, ShieldAlert, SlidersHorizontal, Eye, ShieldCheck, ChevronRight
} from "lucide-react";
import { db, collection, doc, onSnapshot, getDoc, setDoc, updateDoc, serverTimestamp, query, where, deleteField } from "@/src/firebase";
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF, PolylineF } from "@react-google-maps/api";
import { getGoogleMapsApiKey } from "@/src/lib/capacitor";
import { toast } from "sonner";
import { cn } from "@/src/lib/utils";

// Premium Anti-Glare Golden Map Options
const premiumMapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  gestureHandling: "greedy",
  styles: [
    { "elementType": "geometry", "stylers": [{ "color": "#ebe3cd" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#523735" }] },
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f1e6" }] },
    { "featureType": "administrative", "elementType": "geometry.stroke", "stylers": [{ "color": "#c9b2a6" }] },
    { "featureType": "administrative.land_parcel", "elementType": "geometry.stroke", "stylers": [{ "color": "#dcd2be" }] },
    { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#ae9e90" }] },
    { "featureType": "landscape.natural", "elementType": "geometry", "stylers": [{ "color": "#dfd2ae" }] },
    { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#dfd2ae" }] },
    { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#93817c" }] },
    { "featureType": "poi.park", "elementType": "geometry.fill", "stylers": [{ "color": "#a5b076" }] },
    { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#447530" }] },
    { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#f5f1e6" }] },
    { "featureType": "road.arterial", "elementType": "geometry", "stylers": [{ "color": "#fdfcf8" }] },
    { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#f8c967" }] },
    { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#e9bc62" }] },
    { "featureType": "road.highway.controlled_access", "elementType": "geometry", "stylers": [{ "color": "#e98d58" }] },
    { "featureType": "road.highway.controlled_access", "elementType": "geometry.stroke", "stylers": [{ "color": "#db8555" }] },
    { "featureType": "road.local", "elementType": "labels.text.fill", "stylers": [{ "color": "#806b63" }] },
    { "featureType": "transit.line", "elementType": "geometry", "stylers": [{ "color": "#dfd2ae" }] },
    { "featureType": "transit.line", "elementType": "labels.text.fill", "stylers": [{ "color": "#8f7d77" }] },
    { "featureType": "transit.line", "elementType": "labels.text.stroke", "stylers": [{ "color": "#ebe3cd" }] },
    { "featureType": "transit.station", "elementType": "geometry", "stylers": [{ "color": "#dfd2ae" }] },
    { "featureType": "water", "elementType": "geometry.fill", "stylers": [{ "color": "#b9d3c2" }] },
    { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#92998d" }] }
  ]
};

const mapLibraries: ("places" | "geometry")[] = ["places", "geometry"];

// Fallback high-fidelity simulation data when Firestore collections are empty
const defaultSimulatedBookings = [
  { id: "B-sim-1", passengerName: "Sarah Jenkins", pickup: "Central Station, London", pickupLat: 53.6498, pickupLng: -1.7820, dropoff: "Heathrow Airport T2", dropoffLat: 53.6210, dropoffLng: -1.8250, carCategory: "standard", fareEstimate: 45.00, createdAt: new Date(Date.now() - 300000), status: "pending", distanceMiles: 14.2 },
  { id: "B-sim-2", passengerName: "Mike Ross", pickup: "12 King Street, Leeds", pickupLat: 53.6420, pickupLng: -1.7710, dropoff: "Westfield Stadium", dropoffLat: 53.6650, dropoffLng: -1.7920, carCategory: "mpv", fareEstimate: 18.50, createdAt: new Date(Date.now() - 120000), status: "pending", distanceMiles: 3.8 },
  { id: "B-sim-3", passengerName: "Emma Watson", pickup: "University Campus Road", pickupLat: 53.6550, pickupLng: -1.7980, dropoff: "City Center Square", dropoffLat: 53.6410, dropoffLng: -1.7890, carCategory: "executive", fareEstimate: 12.00, createdAt: new Date(Date.now() - 15000), status: "pending", distanceMiles: 1.5 },
];

const defaultSimulatedDrivers = [
  { id: "D-sim-101", name: "David Chen", vehicle: "Toyota Prius (Silver)", isOnline: true, lat: 53.6440, lng: -1.7890, status: "Available", rating: 4.9, phone: "+447700900101", isBusy: true },
  { id: "D-sim-102", name: "Sam Wilson", vehicle: "Mercedes E-Class (Black)", isOnline: true, lat: 53.6520, lng: -1.7780, status: "Available", rating: 4.8, phone: "+447700900102", isBusy: true },
  { id: "D-sim-103", name: "Linda Lee", vehicle: "Kia Niro EV (Blue)", isOnline: true, lat: 53.6390, lng: -1.8020, status: "Available", rating: 4.7, phone: "+447700900103", isBusy: false },
];

const defaultSimulatedRides = [
  { id: "R-sim-992", passengerName: "Alex Turner", pickup: "O2 Arena, Greenwich", pickupLat: 53.6610, pickupLng: -1.7650, dropoff: "Victoria Station", dropoffLat: 53.6300, dropoffLng: -1.7950, status: "in_progress", fareEstimate: 24.50, driverName: "David Chen", carCategory: "standard" },
  { id: "R-sim-993", passengerName: "Tom Hardy", pickup: "Hyde Park Central Gate", pickupLat: 53.6450, pickupLng: -1.8100, dropoff: "Oxford Street East", dropoffLat: 53.6490, dropoffLng: -1.7900, status: "accepted", fareEstimate: 14.00, driverName: "Sam Wilson", carCategory: "executive" },
];

// Haversine formula to compute distances accurately
function getDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 99.9;
  const R = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Number((R * c).toFixed(1));
}

export default function DispatchEngine() {
  const [dbRides, setDbRides] = useState<any[]>([]);
  const [dbDrivers, setDbDrivers] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({
    autoDispatchEnabled: true,
    dispatchRadiusMiles: 15,
    dispatchTimeoutSeconds: 15,
    staggeredPriorityMatching: true,
    biddingFallbackEnabled: true,
  });

  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isSavingRules, setIsSavingRules] = useState(false);

  // Focus and details matching state
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);
  const [isManualAssignDrawerOpen, setIsManualAssignDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Map settings
  const [mapCenter, setMapCenter] = useState({ lat: 53.6458, lng: -1.7850 });
  const [mapZoom, setMapZoom] = useState(13);
  const [mapRef, setMapRef] = useState<any>(null);
  const [selectedPin, setSelectedPin] = useState<any>(null);

  // 1. Fetch real-time live ride requests and available drivers from Firestore
  useEffect(() => {
    const unsubRides = onSnapshot(collection(db, "ride_requests"), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDbRides(list);
    });

    const unsubDrivers = onSnapshot(collection(db, "live_tracking"), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDbDrivers(list);
    });

    const unsubConfig = onSnapshot(doc(db, "platform_config", "rides"), (docSnap) => {
      setIsLoadingConfig(false);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConfig(prev => ({
          ...prev,
          autoDispatchEnabled: data.autoDispatchEnabled ?? prev.autoDispatchEnabled,
          dispatchRadiusMiles: data.dispatchRadiusMiles ?? data.dispatchMaxRadius ?? prev.dispatchRadiusMiles ?? 15,
          dispatchTimeoutSeconds: data.dispatchTimeoutSeconds ?? data.offerTimeoutSeconds ?? prev.dispatchTimeoutSeconds ?? 15,
          staggeredPriorityMatching: data.staggeredPriorityMatching ?? prev.staggeredPriorityMatching ?? true,
          biddingFallbackEnabled: data.biddingFallbackEnabled ?? prev.biddingFallbackEnabled ?? true,
        }));
      }
    });

    return () => {
      unsubRides();
      unsubDrivers();
      unsubConfig();
    };
  }, []);

  // Compute merged rosters prioritizing real live items, but elegantly backfilling mock data when quiet
  const activePendingBookings = useMemo(() => {
    const realPending = dbRides.filter(r => r.status === "pending" || r.status === "searching" || r.status === "draft");
    if (realPending.length > 0) return realPending;
    return defaultSimulatedBookings;
  }, [dbRides]);

  const activeLiveRides = useMemo(() => {
    const realLive = dbRides.filter(r => r.status === "accepted" || r.status === "driver_arrived" || r.status === "in_progress" || r.status === "offered");
    if (realLive.length > 0) return realLive;
    return defaultSimulatedRides;
  }, [dbRides]);

  const activeDriversOnline = useMemo(() => {
    const realOnlineAndBusy = dbDrivers.filter(d => d.isOnline);
    if (realOnlineAndBusy.length > 0) return realOnlineAndBusy;
    return defaultSimulatedDrivers;
  }, [dbDrivers]);

  // Retrieve current active ride object for pathing & center highlighting
  const currentFocusedRide = useMemo(() => {
    if (!selectedRideId) return null;
    return [...activePendingBookings, ...activeLiveRides].find(r => r.id === selectedRideId);
  }, [selectedRideId, activePendingBookings, activeLiveRides]);

  // Center maps when focusing items
  useEffect(() => {
    if (currentFocusedRide) {
      const lat = currentFocusedRide.pickupLat;
      const lng = currentFocusedRide.pickupLng;
      if (lat && lng) {
        setMapCenter({ lat, lng });
        setMapZoom(14);
      }
    }
  }, [currentFocusedRide]);

  // Initialize Maps engine smoothly
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: getGoogleMapsApiKey() || "",
    libraries: mapLibraries,
    version: "quarterly"
  });

  // Calculate sorted nearest online drivers for the active booking match allocation list
  const sortedDistanceDrivers = useMemo(() => {
    if (!currentFocusedRide) return [];
    
    return activeDriversOnline
      .map(driver => {
        const dMiles = getDistanceMiles(
          currentFocusedRide.pickupLat, 
          currentFocusedRide.pickupLng, 
          driver.lat, 
          driver.lng
        );
        return {
          ...driver,
          distanceMiles: dMiles
        };
      })
      .sort((a, b) => a.distanceMiles - b.distanceMiles);
  }, [currentFocusedRide, activeDriversOnline]);

  // Toggle Automated Dispatch rules easily
  const handleToggleAutoDispatch = async () => {
    const newVal = !config.autoDispatchEnabled;
    setConfig(prev => ({ ...prev, autoDispatchEnabled: newVal }));
    try {
      await setDoc(doc(db, "platform_config", "rides"), {
        autoDispatchEnabled: newVal,
      }, { merge: true });
      toast.success(newVal ? "Auto-matching Dispatch System Active" : "Operational Manual Allocation Lock Engaged");
    } catch (e) {
      toast.error("Failed to update remote config parameters");
    }
  };

  // Save general parameters to /platform_config/rides
  const handleSaveOperationalPolicies = async () => {
    setIsSavingRules(true);
    try {
      await setDoc(doc(db, "platform_config", "rides"), {
        dispatchRadiusMiles: Number(config.dispatchRadiusMiles),
        dispatchMaxRadius: Number(config.dispatchRadiusMiles),
        dispatchTimeoutSeconds: Number(config.dispatchTimeoutSeconds),
        offerTimeoutSeconds: Number(config.dispatchTimeoutSeconds),
        staggeredPriorityMatching: !!config.staggeredPriorityMatching,
        biddingFallbackEnabled: !!config.biddingFallbackEnabled
      }, { merge: true });
      toast.success("Dispatch algorithms and bidding policies synchronized successfully");
    } catch (e) {
      toast.error("Failure updating operational rules parameters");
    } finally {
      setIsSavingRules(false);
    }
  };

  // Confirm manual assignment triggering
  const executeManualDispatchAllocation = async (driver: any) => {
    if (!currentFocusedRide) return;
    
    const isMock = currentFocusedRide.id.includes("sim") || driver.id.includes("sim");
    
    if (isMock) {
      // Simulate action locally when previewing placeholder data
      toast.success("Manual Assignment Simulated", {
        description: `Offered trip request to ${driver.name} with standard 60s accept timer.`
      });
      // Move candidate locally to simulation accepted state
      const rideIndex = defaultSimulatedBookings.findIndex(b => b.id === currentFocusedRide.id);
      if (rideIndex !== -1) {
        const target = defaultSimulatedBookings[rideIndex];
        defaultSimulatedBookings.splice(rideIndex, 1);
        defaultSimulatedRides.unshift({
          ...target,
          status: "accepted",
          driverName: driver.name,
        });
      }
      setIsManualAssignDrawerOpen(false);
      setSelectedRideId(null);
      return;
    }

    try {
      // Form the real Firestore offered payload so terminal and driver-sides sync instantly
      const offerExpiresAt = new Date(Date.now() + (config.offerTimeoutSeconds * 1000)).toISOString();
      const ref = doc(db, "ride_requests", currentFocusedRide.id);
      
      await updateDoc(ref, {
        status: "offered",
        assignedDriverId: driver.id,
        assignedDriverName: driver.name || "AnyTrader Driver",
        assignedDriverPhone: driver.phone || driver.phoneNumber || "",
        offerExpiresAt: offerExpiresAt,
        manualAllocationDispatchedAt: serverTimestamp(),
        automatedMatchingSkipped: true
      });

      // Trigger remote FCM push notification to driver for new ride offer from admin
      fetch("/api/chat-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: driver.id,
          title: "New Ride Offer",
          body: "You have a new incoming ride request from Dispatch",
          rideId: currentFocusedRide.id,
          type: "ride_offer",
          channelId: "ride_offers"
        })
      }).catch(err => console.error("FCM API error:", err));

      // Update driver status busy indicator to prevent overlapping automatic offers
      await updateDoc(doc(db, "live_tracking", driver.id), {
        isBusy: true,
        allocatedRideId: currentFocusedRide.id
      }).catch(err => console.log("live_tracking busier update skipped:", err));

      toast.success("Direct Allocation Route Dispatched!", {
        description: `Assigned ride invitation sent directly to ${driver.name}. Remaining offer bounds: ${config.offerTimeoutSeconds}s.`
      });
      
      setIsManualAssignDrawerOpen(false);
      setSelectedRideId(null);
    } catch (e) {
      toast.error("Critical failure assigning candidate drivers manual request blocks.");
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 pb-32">
      
      {/* Upper Title HUD */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-black tracking-tight flex items-center">
            <Zap className="mr-2.5 text-yellow-500 fill-yellow-500 w-6 h-6 animate-pulse" />
            Dispatch Flight Control Center
          </h1>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mt-1">
            Real-Time Carrier Orchestration • Multi-Agent Matching Engine
          </p>
        </div>
        
        {/* Toggle Panel Container */}
        <div className="flex items-center gap-3 bg-white border border-black p-3 rounded-xl shadow-sm">
          <div className="text-left">
            <p className="text-xs font-black text-black uppercase tracking-wider">Automated Matcher</p>
            <p className="text-[10px] text-slate-400 font-medium">Auto-pilot routing rules</p>
          </div>
          <button 
            onClick={handleToggleAutoDispatch}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 ${
              config.autoDispatchEnabled ? "bg-[#00D26A]" : "bg-slate-200"
            }`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              config.autoDispatchEnabled ? "translate-x-6 animate-pulse" : "translate-x-1"
            }`} />
          </button>
        </div>
      </div>

      {/* Platform Performance HUD Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-black p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Queue</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-black">{activePendingBookings.length}</span>
            <span className="text-[10px] font-bold py-0.5 px-2 bg-amber-50 text-amber-600 rounded-full border border-amber-100 animate-pulse">
              Awaiting
            </span>
          </div>
        </div>

        <div className="bg-white border border-black p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Car Trips</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-black">{activeLiveRides.length}</span>
            <span className="text-[10px] font-bold py-0.5 px-2 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
              In Transit
            </span>
          </div>
        </div>

        <div className="bg-white border border-black p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Standby Fleet</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-black">{activeDriversOnline.length}</span>
            <span className="text-[10px] font-bold py-0.5 px-2 bg-blue-50 text-blue-600 rounded-full border border-blue-100">
              Online
            </span>
          </div>
        </div>

        <div className="bg-white border border-black p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dispatch Health</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-black">98.4%</span>
            <span className="text-[10px] font-bold py-0.5 px-2 bg-purple-50 text-purple-600 rounded-full border border-purple-100">
              Optimal
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Interactive Panel */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Real Golden Styled Google Map */}
          <div className="bg-white border border-black rounded-xl shadow-sm h-[420px] relative overflow-hidden group">
            {isLoaded ? (
              <GoogleMap
                mapContainerClassName="w-full h-full"
                center={mapCenter}
                zoom={mapZoom}
                options={premiumMapOptions}
                onLoad={(map) => setMapRef(map)}
              >
                {/* Active Drivers Pins */}
                {activeDriversOnline.map((driver) => {
                  const isDriverFocused = selectedPin?.type === "driver" && selectedPin?.id === driver.id;

                  // Find if there is an active ride matching this driver.
                  const activeRide = activeLiveRides.find(r => 
                    r.assignedDriverId === driver.id || 
                    r.driverId === driver.id ||
                    (driver.name && r.driverName === driver.name)
                  );

                  let driverState: "free" | "accepted" | "onboard" = "free";
                  if (activeRide) {
                    if (activeRide.status === "in_progress") {
                      driverState = "onboard";
                    } else {
                      driverState = "accepted";
                    }
                  } else if (driver.isBusy) {
                    driverState = "onboard"; // fallback for busy flags
                  }

                  // Establish color: green (free), yellow (accepted), red (onboard)
                  let fillColor = "#10B981"; // Free/Awaiting Trip
                  if (driverState === "accepted") fillColor = "#F59E0B"; // Ride Accepted/Passenger not on board
                  if (driverState === "onboard") fillColor = "#EF4444"; // Passenger OnBoard

                  return (
                    <React.Fragment key={`dr-${driver.id}`}>
                      <MarkerF
                        position={{ lat: driver.lat, lng: driver.lng }}
                        onClick={() => setSelectedPin({ type: "driver", id: driver.id, data: driver })}
                        icon={{
                          path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
                          fillColor: fillColor,
                          fillOpacity: 0.9,
                          strokeColor: "#ffffff",
                          strokeWeight: 1.5,
                          scale: 1.5,
                          anchor: new google.maps.Point(12, 22)
                        }}
                      />
                      {isDriverFocused && (
                        <InfoWindowF
                          position={{ lat: driver.lat, lng: driver.lng }}
                          onCloseClick={() => setSelectedPin(null)}
                        >
                          <div className="p-2 max-w-xs text-xs font-sans text-black">
                            <p className="font-black text-sm">{driver.name}</p>
                            <p className="text-slate-500 font-semibold mt-1">{driver.vehicle}</p>
                            <div className="flex items-center gap-2 mt-2 pt-1 border-t border-slate-100">
                              <span className="font-bold flex items-center text-yellow-600">⭐ {driver.rating}</span>
                              <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold text-white uppercase tracking-wider", 
                                driverState === "free" ? "bg-emerald-600" : driverState === "accepted" ? "bg-amber-500" : "bg-red-500"
                              )}>
                                {driverState === "free" ? "Free" : driverState === "accepted" ? "Accepted" : "OnBoard"}
                              </span>
                            </div>
                          </div>
                        </InfoWindowF>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Active and Pending Passenger Pins */}
                {activePendingBookings.map((booking) => {
                  const isBookingFocused = selectedPin?.type === "booking" && selectedPin?.id === booking.id;
                  return (
                    <React.Fragment key={`bk-${booking.id}`}>
                      <MarkerF
                        position={{ lat: booking.pickupLat, lng: booking.pickupLng }}
                        onClick={() => {
                          setSelectedPin({ type: "booking", id: booking.id, data: booking });
                          setSelectedRideId(booking.id);
                        }}
                        icon={{
                          path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
                          fillColor: "#F59E0B",
                          fillOpacity: 1.0,
                          strokeColor: "#ffffff",
                          strokeWeight: 1.5,
                          scale: 1.4,
                          anchor: new google.maps.Point(12, 22)
                        }}
                      />
                      {isBookingFocused && (
                        <InfoWindowF
                          position={{ lat: booking.pickupLat, lng: booking.pickupLng }}
                          onCloseClick={() => setSelectedPin(null)}
                        >
                          <div className="p-2 max-w-xs text-xs font-sans text-black">
                            <p className="font-black text-sm text-[13px]">{booking.passengerName}</p>
                            <p className="text-slate-500 font-semibold mt-1 truncate">Pickup: {booking.pickup}</p>
                            <p className="text-slate-500 font-semibold truncate">Dropoff: {booking.dropoff}</p>
                            <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100">
                              <span className="font-black text-emerald-600">Estimate: £{Number(booking.fareEstimate).toFixed(2)}</span>
                              <span className="px-1.5 py-0.5 bg-yellow-500 text-white rounded text-[9px] font-black uppercase">
                                {booking.status}
                              </span>
                            </div>
                          </div>
                        </InfoWindowF>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Render Direction Vector line for active filtered booking */}
                {currentFocusedRide && currentFocusedRide.pickupLat && currentFocusedRide.dropoffLat && (
                  <PolylineF
                    path={[
                      { lat: currentFocusedRide.pickupLat, lng: currentFocusedRide.pickupLng },
                      { lat: currentFocusedRide.dropoffLat, lng: currentFocusedRide.dropoffLng }
                    ]}
                    options={{
                      strokeColor: "#F59E0B",
                      strokeOpacity: 0.8,
                      strokeWeight: 2.5,
                      geodesic: true,
                      icons: [{
                        icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 2 },
                        offset: "0",
                        repeat: "10px"
                      }]
                    }}
                  />
                )}
              </GoogleMap>
            ) : (
              <div className="absolute inset-0 bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                <RefreshCw className="animate-spin w-8 h-8 text-black mb-3" />
                <p className="text-slate-800 font-bold text-sm">Downloading maps coordinates overlays...</p>
                <p className="text-slate-400 text-xs mt-1">Downloading premium layout grids securely.</p>
              </div>
            )}

            {/* Map Custom Floating HUD Controls */}
            <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm border border-black rounded-lg p-2.5 shadow-sm space-y-1.5 z-10 pointer-events-none select-none max-w-[260px] md:max-w-xs">
              <p className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Map Legend</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shrink-0"></span>
                <span className="text-[10px] font-bold text-black">Green - Free/Awaiting Trip</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shrink-0 mt-0.5"></span>
                <span className="text-[10px] font-bold text-black leading-tight">Yellow - Ride Accepted/ Passenger not on board yet</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block shrink-0 mt-0.5"></span>
                <span className="text-[10px] font-bold text-black leading-tight">Red - Passenger OnBoard heading to destination</span>
              </div>
            </div>
          </div>

          {/* Core Table Grid - Live Active & In-Transit Rides */}
          <div className="bg-white border border-black rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-black text-black border-b border-slate-100 pb-3 mb-4 flex justify-between items-center uppercase tracking-wider">
              <span>On-Road Live Journeys</span>
              <span className="bg-blue-50 text-blue-700 text-xs py-1 px-3.5 rounded-full font-black uppercase tracking-wider border border-blue-100 shadow-sm">
                {activeLiveRides.length} Active
              </span>
            </h2>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
              {activeLiveRides.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <CarFront className="w-8 h-8 mx-auto stroke-1 opacity-40 mb-2" />
                  <p className="text-xs font-bold">No active passenger trips on route currently.</p>
                </div>
              ) : (
                activeLiveRides.map((ride) => {
                  const isChosen = selectedRideId === ride.id;
                  return (
                    <div 
                      key={ride.id} 
                      onClick={() => {
                        setSelectedRideId(isChosen ? null : ride.id);
                        if (ride.pickupLat) setMapCenter({ lat: ride.pickupLat, lng: ride.pickupLng });
                      }}
                      className={cn(
                        "flex flex-col sm:flex-row justify-between items-center sm:items-start p-4 border rounded-lg cursor-pointer transition-all duration-200",
                        isChosen 
                          ? "bg-slate-50 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" 
                          : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300"
                      )}
                    >
                      <div className="flex flex-col w-full sm:w-auto text-left">
                        <span className="font-black text-sm text-black flex items-center gap-2">
                          <CarFront size={15} className="text-blue-600" />
                          {ride.driverName || "Allocated Driver"}
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-500 font-medium text-xs">{ride.passengerName}</span>
                        </span>
                        <div className="mt-2 space-y-1">
                          <div className="text-xs text-slate-600 flex items-center font-medium gap-1.5">
                            <span className="font-extrabold text-[10px] text-slate-400 uppercase tracking-widest bg-slate-100 px-1 rounded">From</span> 
                            <span className="truncate max-w-sm">{ride.pickup}</span>
                          </div>
                          <div className="text-xs text-slate-600 flex items-center font-medium gap-1.5">
                            <span className="font-extrabold text-[10px] text-slate-400 uppercase tracking-widest bg-slate-100 px-1 rounded">To</span> 
                            <span className="truncate max-w-sm">{ride.dropoff}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto mt-4 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-0 border-slate-100">
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded",
                          ride.status === "in_progress" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-blue-100 text-blue-800 border border-blue-200"
                        )}>
                          {ride.status === "in_progress" ? "In Transit" : ride.status === "offered" ? "Dispatch Timer" : "Accepted"}
                        </span>
                        <span className="text-xs font-bold text-emerald-700 mt-2 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">
                          £{Number(ride.fareEstimate || ride.totalFare).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Dispatch Queue & Actions Panel */}
        <div className="space-y-6">
          
          {/* Queued Pending Allocations Block */}
          <div className="bg-white border border-black rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-black text-black border-b border-slate-100 pb-3 mb-4 flex justify-between items-center uppercase tracking-wider">
              <span>Pending Allocations</span>
              <span className="bg-amber-50 text-amber-700 text-xs py-1 px-3.5 rounded-full font-black uppercase tracking-wider border border-amber-100 animate-pulse shadow-sm">
                {activePendingBookings.length} Wait
              </span>
            </h2>
            <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
              {activePendingBookings.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2 stroke-1" />
                  <p className="text-xs font-bold">Matching queue cleared perfectly!</p>
                  <p className="text-[10px] text-slate-400 mt-1">Waiting for incoming passenger requests.</p>
                </div>
              ) : (
                activePendingBookings.map((booking) => {
                  const isChosen = selectedRideId === booking.id;
                  return (
                    <div 
                      key={booking.id} 
                      onClick={() => setSelectedRideId(isChosen ? null : booking.id)}
                      className={cn(
                        "p-4 border rounded-lg transition-all duration-200 text-left cursor-pointer",
                        isChosen 
                          ? "bg-amber-50/50 border-amber-500 shadow-[2px_2px_0px_0px_rgba(245,158,11,1)]" 
                          : "border-slate-200 hover:border-black"
                      )}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-col">
                          <span className="font-bold text-black text-sm">{booking.passengerName}</span>
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mt-0.5">
                            Tier: {booking.carCategory || "Standard"}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                          £{Number(booking.fareEstimate).toFixed(2)}
                        </span>
                      </div>
                      
                      <div className="text-xs text-slate-600 font-medium space-y-1 mb-3.5 pt-1 border-t border-slate-50">
                        <div className="truncate"><span className="text-slate-400 font-bold">P:</span> {booking.pickup}</div>
                        <div className="truncate"><span className="text-slate-400 font-bold">D:</span> {booking.dropoff}</div>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-slate-100/60">
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-100 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Waiting Now
                        </span>
                        
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRideId(booking.id);
                            setIsManualAssignDrawerOpen(true);
                          }}
                          className="text-xs font-black uppercase tracking-widest bg-black text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors shadow-sm cursor-pointer flex items-center gap-1 active:scale-95 duration-100"
                        >
                          <UserPlus className="w-3.5 h-3.5" /> Assign
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Standby Available Drivers List HUD */}
          <div className="bg-white border border-black rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-black text-black border-b border-slate-100 pb-3 mb-4 flex justify-between items-center uppercase tracking-wider">
              <span>Standby Active Drivers</span>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nearest Top</span>
            </h2>
            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {activeDriversOnline.map((driver) => {
                // Determine same state for consistency
                const activeRide = activeLiveRides.find(r => 
                  r.assignedDriverId === driver.id || 
                  r.driverId === driver.id ||
                  (driver.name && r.driverName === driver.name)
                );
                
                let driverState: "free" | "accepted" | "onboard" = "free";
                if (activeRide) {
                  if (activeRide.status === "in_progress") {
                    driverState = "onboard";
                  } else {
                    driverState = "accepted";
                  }
                } else if (driver.isBusy) {
                  driverState = "onboard";
                }

                return (
                  <div 
                    key={driver.id} 
                    onClick={() => {
                      if (driver.lat) {
                        setMapCenter({ lat: driver.lat, lng: driver.lng });
                        setMapZoom(14);
                      }
                    }}
                    className="flex justify-between items-center p-3 border border-slate-200 rounded-lg hover:border-black cursor-pointer transition-colors bg-slate-50/30"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={cn("w-2 h-2 rounded-full",
                        driverState === "free" ? "bg-emerald-500 animate-ping" : driverState === "accepted" ? "bg-amber-500" : "bg-red-500"
                      )}></div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-black">{driver.name}</p>
                        <p className="text-[10px] text-slate-500 font-semibold">{driver.vehicle || "Toyota Camry"} • ⭐ {driver.rating || 4.8}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={cn("text-[9px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded border",
                        driverState === "free" ? "text-emerald-700 bg-emerald-50 border-emerald-100" : driverState === "accepted" ? "text-amber-700 bg-amber-50 border-amber-100" : "text-red-700 bg-red-50 border-red-100"
                      )}>
                        {driverState === "free" ? "Free" : driverState === "accepted" ? "Accepted" : "OnBoard"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Manual Allocation Matching Modal/Drawer */}
      <AnimatePresence>
        {isManualAssignDrawerOpen && currentFocusedRide && (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full max-w-md h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col justify-between"
            >
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-lg font-black text-black">Direct Manual Allocation</h3>
                    <p className="text-xs text-slate-400 font-medium">Bypass auto-routers and assign immediately.</p>
                  </div>
                  <button 
                    onClick={() => setIsManualAssignDrawerOpen(false)}
                    className="p-1 px-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 font-black text-xs uppercase"
                  >
                    Close
                  </button>
                </div>

                {/* Ride Summary Block */}
                <div className="p-4 bg-amber-50/30 border border-yellow-300 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-sm text-black">{currentFocusedRide.passengerName}</span>
                    <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                      £{Number(currentFocusedRide.fareEstimate).toFixed(2)}
                    </span>
                  </div>
                  <div className="space-y-1 pt-1.5 border-t border-yellow-200/40 text-xs text-slate-700">
                    <div><span className="font-black text-slate-400">Pickup:</span> {currentFocusedRide.pickup}</div>
                    <div><span className="font-black text-slate-400">Dropoff:</span> {currentFocusedRide.dropoff}</div>
                  </div>
                </div>

                {/* Candidate Search Box */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search candidate by name or class..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-black transition-all"
                  />
                </div>

                {/* Nearest Grid List */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    Available Standby Fleet (Ordered by Proximity)
                  </h4>
                  {sortedDistanceDrivers.length === 0 ? (
                    <div className="text-center py-6 text-slate-400">
                      <ShieldAlert className="w-8 h-8 mx-auto text-amber-500 stroke-1 mb-2" />
                      <p className="text-xs font-extrabold">No standby drivers located.</p>
                    </div>
                  ) : (
                    sortedDistanceDrivers
                      .filter(d => d.name?.toLowerCase().includes(searchTerm.toLowerCase()) || d.vehicle?.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((driver) => {
                        return (
                          <div 
                            key={driver.id}
                            className="p-3 border border-slate-100 hover:border-black rounded-lg bg-slate-50/50 hover:bg-white transition-all flex justify-between items-center"
                          >
                            <div className="text-left space-y-0.5">
                              <p className="text-xs font-black text-black">{driver.name}</p>
                              <p className="text-[10px] text-slate-400 font-semibold">{driver.vehicle || "Standard Hatch"}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="font-bold text-[9px] text-yellow-600 bg-yellow-50 px-1 py-0.2 rounded border border-yellow-100 flex items-center">
                                  ⭐ {driver.rating || "4.8"}
                                </span>
                                <span className="text-[9px] font-black text-slate-400 uppercase">
                                  Distance: {driver.distanceMiles} mi
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => executeManualDispatchAllocation(driver)}
                              disabled={driver.isBusy}
                              className={cn(
                                "text-[10px] font-black uppercase tracking-wider py-1.5 px-3 rounded-lg shadow-sm border cursor-pointer",
                                driver.isBusy 
                                  ? "bg-slate-100 text-slate-400 border-slate-100 pointer-events-none" 
                                  : "bg-black text-white border-black hover:bg-gray-800"
                              )}
                            >
                              Dispatch
                            </button>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
              
              <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
                <p className="text-[10px] text-slate-400 font-medium leading-normal">
                  Manual allocation bypasses all automated matching loops. Candidate drivers receive prioritized trip popups immediately with custom push ring tones.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Advanced Matching & Dispatching Policies Card */}
      <div className="bg-white border border-black rounded-xl p-6 shadow-sm">
        <h2 className="text-sm font-black text-black border-b border-slate-100 pb-3 mb-6 flex items-center uppercase tracking-wider">
          <Sliders className="w-4 h-4 mr-2 text-slate-700" />
          Advanced Allocation & Dispatching Policies
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
          
          <div className="space-y-2">
            <label className="text-xs font-black text-black uppercase tracking-wider">
              Allocation Radius Cap (Miles)
            </label>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5 leading-snug">
              Maximum dispatch ring distance before ignoring standby drivers. Keep low to maintain short ETAs.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <input 
                type="range" 
                min="2" 
                max="25" 
                value={config.dispatchRadiusMiles}
                onChange={(e) => setConfig(prev => ({ ...prev, dispatchRadiusMiles: Number(e.target.value) }))}
                className="flex-1 accent-black h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer"
              />
              <span className="font-black text-xs text-black border border-black rounded px-2 py-0.5 bg-slate-50 w-12 text-center">
                {config.dispatchRadiusMiles} mi
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-black uppercase tracking-wider">
              Offer Acceptance Window (Seconds)
            </label>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5 leading-snug">
              Acceptance deadline countdown timer given to nominated drivers before re-routing trip.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <input 
                type="range" 
                min="15" 
                max="120" 
                step="5"
                value={config.dispatchTimeoutSeconds}
                onChange={(e) => setConfig(prev => ({ ...prev, dispatchTimeoutSeconds: Number(e.target.value) }))}
                className="flex-1 accent-black h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer"
              />
              <span className="font-black text-xs text-black border border-black rounded px-2 py-0.5 bg-slate-50 w-12 text-center">
                {config.dispatchTimeoutSeconds}s
              </span>
            </div>
          </div>

          {/* Staggered preference checkboxes */}
          <div className="flex flex-col gap-3 py-1">
            <div className="flex items-start gap-2">
              <input 
                id="policy-staggered"
                type="checkbox" 
                checked={config.staggeredPriorityMatching}
                onChange={(e) => setConfig(prev => ({ ...prev, staggeredPriorityMatching: e.target.checked }))}
                className="w-4 h-4 text-black border-slate-300 rounded accent-black mt-0.5 cursor-pointer"
              />
              <div className="flex flex-col leading-tight cursor-pointer" onClick={() => setConfig(prev => ({ ...prev, staggeredPriorityMatching: !prev.staggeredPriorityMatching }))}>
                <label className="text-xs font-black text-black uppercase tracking-wider">
                  Tier-Preferential Priority
                </label>
                <span className="text-[9px] text-slate-400 font-bold mt-0.5">
                  Prioritize top-tier or eco-drivers before standard classes.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 pt-1 border-t border-slate-50">
              <input 
                id="policy-bidding"
                type="checkbox" 
                checked={config.biddingFallbackEnabled}
                onChange={(e) => setConfig(prev => ({ ...prev, biddingFallbackEnabled: e.target.checked }))}
                className="w-4 h-4 text-black border-slate-300 rounded accent-black mt-0.5 cursor-pointer"
              />
              <div className="flex flex-col leading-tight cursor-pointer" onClick={() => setConfig(prev => ({ ...prev, biddingFallbackEnabled: !prev.biddingFallbackEnabled }))}>
                <label className="text-xs font-black text-black uppercase tracking-wider">
                  Open Bidding Fallback Loop
                </label>
                <span className="text-[9px] text-slate-400 font-bold mt-0.5">
                  Route to bid feed if no matching drivers accept after 2 rounds.
                </span>
              </div>
            </div>
          </div>

        </div>

        <div className="mt-8 pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            disabled={isSavingRules}
            onClick={handleSaveOperationalPolicies}
            className="px-5 py-2.5 bg-black text-white hover:bg-gray-800 disabled:opacity-50 text-xs font-black uppercase tracking-widest rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            {isSavingRules ? (
              <>
                <RefreshCw className="animate-spin w-3.5 h-3.5" />
                Updating Database Policies...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Commit Allocation Policies
              </>
            )}
          </button>
        </div>
      </div>

    </div>
  );
}

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MapPin, Sliders, Users, Car, Zap, RefreshCw, 
  Map as MapIcon, Compass, AlertCircle, Save, Check,
  Target, ShieldCheck, HelpCircle, Edit2, CheckCircle, Search
} from "lucide-react";
import { db, collection, doc, onSnapshot, getDoc, setDoc, updateDoc } from "@/src/firebase";
import { GoogleMap, useJsApiLoader, MarkerF, CircleF, InfoWindowF, OverlayViewF, OverlayView } from "@react-google-maps/api";
import { getGoogleMapsApiKey } from "@/src/lib/capacitor";
import { toast } from "sonner";
import { cn } from "@/src/lib/utils";
import { fetchLiveDemandZones } from "@/src/services/surgeHeatmapService";

// Premium Anti-Glare Golden Map Options (exactly as requested)
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

const libraries: ("places" | "geometry")[] = ["places", "geometry"];

interface OnlineDriver {
  id: string;
  name?: string;
  isOnline: boolean;
  lat?: number;
  lng?: number;
  status?: string;
  vehicle?: string;
}

interface DriverProfile {
  id: string;
  name: string;
  email?: string;
  memberId?: string;
  zoneEnabled?: boolean;
  zoneMaxDistance?: number;
  homeLat?: number;
  homeLng?: number;
  homeAddress?: string;
}

export default function ZonesGeofences() {
  const [activeTab, setActiveTab] = useState<"drivers" | "rules">("drivers");
  const [onlineDrivers, setOnlineDrivers] = useState<OnlineDriver[]>([]);
  const [driverProfiles, setDriverProfiles] = useState<DriverProfile[]>([]);
  const [rideRequests, setRideRequests] = useState<any[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  
  // Search query for filter
  const [searchQuery, setSearchQuery] = useState("");
  
  // Custom overriding state for details drawer
  const [isOverriding, setIsOverriding] = useState(false);
  const [overrideRadius, setOverrideRadius] = useState<number>(5);
  const [overrideAddress, setOverrideAddress] = useState("");
  const [overrideLat, setOverrideLat] = useState<number | null>(null);
  const [overrideLng, setOverrideLng] = useState<number | null>(null);

  // Address search suggestions inside drawer
  const [subSuggestions, setSubSuggestions] = useState<any[]>([]);
  const [drawerSearchQuery, setDrawerSearchQuery] = useState("");

  // Platform surge/congestions options
  const [isSavingRules, setIsSavingRules] = useState(false);
  const [surgeConfig, setSurgeConfig] = useState({
    surgeEnabled: true,
    surgeModel: "fixed", // "fixed" or "multiplier"
    surgeRules: {
      lowWaitMins: 5,
      mediumWaitMins: 10,
      highWaitMins: 20,
      lowRatioThreshold: 1.0,
      mediumRatioThreshold: 2.0,
      highRatioThreshold: 3.0,
      lowFee: 1.00,
      mediumFee: 2.00,
      highFee: 3.50,
      lowMultiplier: 1.1,
      mediumMultiplier: 1.3,
      highMultiplier: 1.6,
      lowColor: "green",
      mediumColor: "amber",
      highColor: "red",
      surgeOpacity: 40
    }
  });

  // Map state
  const [mapCenter, setMapCenter] = useState({ lat: 53.6458, lng: -1.7850 });
  const [mapZoom, setMapZoom] = useState(11);
  const [selectedPin, setSelectedPin] = useState<any | null>(null);
  const [demandZones, setDemandZones] = useState<any[]>([]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (surgeConfig.surgeEnabled) {
      const loadSurge = async () => {
        const zones = await fetchLiveDemandZones();
        setDemandZones(zones);
      };
      loadSurge();
      interval = setInterval(loadSurge, 30000); // 30 sec refresh
    } else {
      setDemandZones([]);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [surgeConfig.surgeEnabled]);

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: getGoogleMapsApiKey(),
    libraries,
    version: "quarterly"
  });

  // 1. Fetch online tracking drivers
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "live_tracking"), (snapshot) => {
      const live: OnlineDriver[] = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        if (d.isOnline) {
          live.push({
            id: doc.id,
            ...d
          } as OnlineDriver);
        }
      });
      setOnlineDrivers(live);
    });
    return () => unsub();
  }, []);

  // 2. Fetch driver profiles
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
      const profiles: DriverProfile[] = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        const isDriver = d.role === "driver" || (d.memberId && d.memberId.startsWith("D-")) || d.isDriver;
        if (isDriver) {
          profiles.push({
            id: doc.id,
            name: d.name || "Unnamed Driver",
            email: d.email || "",
            memberId: d.memberId || "",
            zoneEnabled: d.zoneEnabled || false,
            zoneMaxDistance: d.zoneMaxDistance || 0,
            homeLat: d.homeLat || null,
            homeLng: d.homeLng || null,
            homeAddress: d.homeAddress || ""
          } as DriverProfile);
        }
      });
      setDriverProfiles(profiles);
    });
    return () => unsub();
  }, []);

  // 2b. Fetch ride requests for dynamic supply/demand checking
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "ride_requests"), (snapshot) => {
      const rides: any[] = [];
      snapshot.forEach(doc => {
        rides.push({ id: doc.id, ...doc.data() });
      });
      setRideRequests(rides);
    });
    return () => unsub();
  }, []);

  // 3. Fetch surge thresholds and general operations configurations
  useEffect(() => {
    const fetchSg = async () => {
      try {
        const docSnap = await getDoc(doc(db, "platform_config", "rides"));
        if (docSnap.exists()) {
          const cd = docSnap.data();
          setSurgeConfig(prev => ({
            surgeEnabled: cd.surgeEnabled !== undefined ? cd.surgeEnabled : prev.surgeEnabled,
            surgeModel: cd.surgeModel || prev.surgeModel,
            surgeRules: {
              ...prev.surgeRules,
              ...(cd.surgeRules || {})
            }
          }));
        }
      } catch (err) {
        console.error("Failed to load rules", err);
      }
    };
    fetchSg();
  }, []);

  // Auto-complete address handler inside override panel
  useEffect(() => {
    if (drawerSearchQuery.length < 3) {
      setSubSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        if (!window.google) return;
        const classicService = new google.maps.places.AutocompleteService();
        const request = {
          input: drawerSearchQuery,
          componentRestrictions: { country: "gb" }
        };
        classicService.getPlacePredictions(request, (predictions, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            setSubSuggestions(predictions.map((p: any) => ({
              description: p.description,
              place_id: p.place_id
            })));
          } else {
            setSubSuggestions([]);
          }
        });
      } catch (e) {}
    }, 500);
    return () => clearTimeout(timer);
  }, [drawerSearchQuery]);

  const selectOverridePlace = async (placeId: string, description: string) => {
    if (!window.google) return;
    try {
      const geocoder = new window.google.maps.Geocoder();
      const result = await geocoder.geocode({ placeId });
      if (result.results[0]) {
        const { lat, lng } = result.results[0].geometry.location;
        setOverrideLat(lat());
        setOverrideLng(lng());
        setOverrideAddress(description);
        setDrawerSearchQuery("");
        setSubSuggestions([]);
      }
    } catch (err) {
      toast.error("Failed to resolve coordinates");
    }
  };

  // Synchronize correlated drivers object list
  const correlatedDrivers = useMemo(() => {
    return driverProfiles.map(profile => {
      const tracking = onlineDrivers.find(d => d.id === profile.id);
      return {
        ...profile,
        isOnline: !!tracking,
        liveLat: tracking?.lat || null,
        liveLng: tracking?.lng || null,
        liveStatus: tracking?.status || "offline",
        vehicle: tracking?.vehicle || ""
      };
    });
  }, [driverProfiles, onlineDrivers]);

  // Handle selected driver selection with coordinates centring
  const handleSelectDriver = (driver: any) => {
    setSelectedDriverId(driver.id);
    setOverrideRadius(driver.zoneMaxDistance || 5);
    setOverrideAddress(driver.homeAddress || "");
    setOverrideLat(driver.homeLat || null);
    setOverrideLng(driver.homeLng || null);
    setIsOverriding(false);

    // Center map
    if (driver.liveLat && driver.liveLng) {
      setMapCenter({ lat: driver.liveLat, lng: driver.liveLng });
      setMapZoom(12);
    } else if (driver.homeLat && driver.homeLng) {
      setMapCenter({ lat: driver.homeLat, lng: driver.homeLng });
      setMapZoom(12);
    }
  };

  // Override / Save specific driver zone preference (writes to /users)
  const saveDriverZoneOverride = async (driverId: string, enabled: boolean) => {
    try {
      const updates: any = {
        zoneEnabled: enabled,
        zoneMaxDistance: overrideRadius
      };
      if (overrideLat && overrideLng) {
        updates.homeLat = overrideLat;
        updates.homeLng = overrideLng;
        updates.homeAddress = overrideAddress;
      }
      await updateDoc(doc(db, "users", driverId), updates);
      toast.success("Driver working zone updated successfully");
      setIsOverriding(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to override driver zone");
    }
  };

  // Save Surge thresholds (writes to /platform_config/rides)
  const handleSaveRules = async () => {
    setIsSavingRules(true);
    try {
      await setDoc(doc(db, "platform_config", "rides"), {
        surgeRules: surgeConfig.surgeRules,
        surgeEnabled: surgeConfig.surgeEnabled,
        surgeModel: surgeConfig.surgeModel
      }, { merge: true });
      toast.success("Platform surge thresholds synchronized successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update general rules");
    } finally {
      setIsSavingRules(false);
    }
  };

  // Haversine formula to compute distance in miles
  const getDistanceInMiles = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3958.8; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Checks regional supply/demand stats and wait-time triggers within a 3-mile cluster
  const getClusterMetrics = (lat: number | null, lng: number | null) => {
    if (!lat || !lng) {
      return {
        jobsCount: 0,
        driversCount: 0,
        ratio: 0.0,
        maxWaitTime: 0.0,
        intensity: "standard" as const,
        clusterJobs: [],
        clusterDrivers: []
      };
    }

    const radiusMiles = 3.0;

    // Filter pending/draft jobs
    const clusterJobs = rideRequests.filter(r => {
      if (r.status !== "pending" && r.status !== "draft" && r.status !== "searching") return false;
      const jobLat = r.pickupLat || r.pickupLocation?.latitude || r.pickup?.lat || r.lat;
      const jobLng = r.pickupLng || r.pickupLocation?.longitude || r.pickup?.lng || r.lng;
      if (!jobLat || !jobLng) return false;

      const dist = getDistanceInMiles(lat, lng, jobLat, jobLng);
      return dist <= radiusMiles;
    });

    // Filter active online drivers
    const clusterDrivers = onlineDrivers.filter(d => {
      const dLat = d.lat;
      const dLng = d.lng;
      if (!dLat || !dLng) return false;

      const dist = getDistanceInMiles(lat, lng, dLat, dLng);
      return dist <= radiusMiles;
    });

    const jobsCount = clusterJobs.length;
    const driversCount = clusterDrivers.length;

    // Demand / Supply ratio
    const ratio = driversCount > 0 ? (jobsCount / driversCount) : jobsCount;

    // Max wait time (oldest pending/draft request)
    let maxWaitTime = 0.0;
    clusterJobs.forEach(job => {
      const createdAt = job.createdAt;
      if (!createdAt) return;

      let createdMs = 0;
      if (typeof createdAt === "object" && createdAt.seconds) {
        createdMs = createdAt.seconds * 1000;
      } else if (typeof createdAt === "number") {
        createdMs = createdAt;
      } else if (typeof createdAt === "string") {
        createdMs = Date.parse(createdAt);
      }

      if (createdMs > 0) {
        const ageMins = (Date.now() - createdMs) / 60000;
        if (ageMins > maxWaitTime) {
          maxWaitTime = ageMins;
        }
      }
    });

    // Check thresholds to identify Intensity Tier
    let intensity: "high" | "medium" | "low" | "standard" = "standard";

    const {
      lowWaitMins,
      mediumWaitMins,
      highWaitMins,
      lowRatioThreshold,
      mediumRatioThreshold,
      highRatioThreshold
    } = surgeConfig.surgeRules;

    const lowWait = lowWaitMins || 5;
    const medWait = mediumWaitMins || 10;
    const highWait = highWaitMins || 20;

    const lowRatio = lowRatioThreshold !== undefined ? lowRatioThreshold : 1.0;
    const medRatio = mediumRatioThreshold !== undefined ? mediumRatioThreshold : 2.0;
    const highRatio = highRatioThreshold !== undefined ? highRatioThreshold : 3.0;

    if (maxWaitTime > highWait || ratio > highRatio) {
      intensity = "high";
    } else if (maxWaitTime > medWait || ratio > medRatio) {
      intensity = "medium";
    } else if (maxWaitTime > lowWait || ratio >= lowRatio) {
      intensity = "low";
    }

    return {
      jobsCount,
      driversCount,
      ratio,
      maxWaitTime,
      intensity,
      clusterJobs,
      clusterDrivers
    };
  };

  // Filter accounts
  const filteredDrivers = correlatedDrivers.filter(d => {
    const query = searchQuery.toLowerCase();
    return (
      d.name.toLowerCase().includes(query) ||
      (d.memberId && d.memberId.toLowerCase().includes(query)) ||
      (d.homeAddress && d.homeAddress.toLowerCase().includes(query))
    );
  });

  const selectedDriverDetail = correlatedDrivers.find(d => d.id === selectedDriverId);

  return (
    <div className="space-y-6">
      {/* Upper Statistics HUD Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-black rounded-xl">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Duty Drivers</p>
          <div className="flex items-center gap-2 mt-1">
            <Users className="w-5 h-5 text-emerald-600" />
            <h3 className="text-xl font-black text-black">{onlineDrivers.length} Live</h3>
          </div>
        </div>

        <div className="p-4 bg-white border border-black rounded-xl">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Geofenced Drivers</p>
          <div className="flex items-center gap-2 mt-1">
            <Compass className="w-5 h-5 text-indigo-600" />
            <h3 className="text-xl font-black text-black">
              {correlatedDrivers.filter(d => d.zoneEnabled).length} Drivers
            </h3>
          </div>
        </div>

        <div className="p-4 bg-white border border-black rounded-xl">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Surge Engine</p>
          <div className="flex items-center gap-2 mt-1">
            <Zap className={`w-5 h-5 ${surgeConfig.surgeEnabled ? "text-amber-500" : "text-slate-400"}`} />
            <h3 className="text-xl font-black text-black">
              {surgeConfig.surgeEnabled ? "ACTIVE (AUTO)" : "OFF"}
            </h3>
          </div>
        </div>

        <div className="p-4 bg-white border border-black rounded-xl">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Coverage Efficiency</p>
          <div className="flex items-center gap-2 mt-1">
            <Target className="w-5 h-5 text-blue-600" />
            <h3 className="text-xl font-black text-black">
              {correlatedDrivers.length > 0 
                ? `${Math.round((correlatedDrivers.filter(d => d.zoneEnabled && d.isOnline).length / Math.max(onlineDrivers.length, 1)) * 100)}%`
                : "0%"
              }
            </h3>
          </div>
        </div>
      </div>

      {/* Main Dual Row Workspace */}
      <div className="flex flex-col xl:flex-row gap-6">

        {/* Left Side Panel: Geofence and Rules configuration */}
        <div className="w-full xl:w-2/5 flex flex-col gap-6">
          <div className="p-6 bg-white border border-black rounded-xl space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h2 className="text-lg font-black text-black tracking-tight uppercase flex items-center gap-2">
                <Sliders className="w-4 h-4 text-slate-500" />
                Operations Station
              </h2>
              <div className="flex gap-1.5 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveTab("drivers")}
                  className={`px-3 py-1 text-[10px] uppercase font-black tracking-tighter rounded transition-all ${
                    activeTab === "drivers" ? "bg-white text-black shadow-sm" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Driver Zones
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("rules")}
                  className={`px-3 py-1 text-[10px] uppercase font-black tracking-tighter rounded transition-all ${
                    activeTab === "rules" ? "bg-white text-black shadow-sm" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Surge Dial Rules
                </button>
              </div>
            </div>

            {/* Drivers Tab View */}
            {activeTab === "drivers" && (
              <div className="space-y-4">
                {/* Search Bar */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search driver profiles, home centers..."
                    className="w-full p-2.5 pl-10 border border-black rounded-xl text-slate-800 text-xs font-bold bg-slate-50 outline-none"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>

                {/* Queue of Drivers showing Geofence rules */}
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {filteredDrivers.map(driver => (
                    <div
                      key={driver.id}
                      onClick={() => handleSelectDriver(driver)}
                      className={`p-3.5 border rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                        selectedDriverId === driver.id
                          ? "border-black bg-slate-50 shadow-[inset_0_0_0_1px_rgba(0,0,0,1)]"
                          : "border-black/5 bg-white hover:border-black/20"
                      }`}
                    >
                      <div className="space-y-1.5 flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black text-black tracking-tight truncate">{driver.name}</p>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            driver.isOnline ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                          }`}>
                            {driver.isOnline ? "Duty" : "Offline"}
                          </span>
                        </div>
                        {driver.homeAddress ? (
                          <p className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400 inline" />
                            {driver.homeAddress}
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic">No home address declared.</p>
                        )}
                        {driver.zoneEnabled && driver.zoneMaxDistance && (
                          <p className="text-[9px] font-black text-indigo-600 block">
                            Zone Enabled: ±{driver.zoneMaxDistance} miles radius
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1.5">
                        <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md border ${
                          driver.zoneEnabled
                            ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                            : "bg-gray-50 border-gray-200 text-gray-500"
                        }`}>
                          {driver.zoneEnabled ? "On" : "Off"}
                        </span>
                      </div>
                    </div>
                  ))}

                  {filteredDrivers.length === 0 && (
                    <div className="p-8 text-center border border-dashed border-gray-200 rounded-lg">
                      <p className="text-slate-400 text-xs italic">No matching drivers found.</p>
                    </div>
                  )}
                </div>

                {/* Selected Driver Detailed Control Center */}
                {selectedDriverDetail && (
                  <div className="p-4 bg-slate-50 border border-black rounded-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-200 pb-2.5">
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Active Selector</p>
                        <h4 className="text-sm font-black text-black">{selectedDriverDetail.name}</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setOverrideRadius(selectedDriverDetail.zoneMaxDistance || 5);
                          setOverrideAddress(selectedDriverDetail.homeAddress || "");
                          setOverrideLat(selectedDriverDetail.homeLat || null);
                          setOverrideLng(selectedDriverDetail.homeLng || null);
                          setIsOverriding(!isOverriding);
                        }}
                        className="text-[10px] font-black text-indigo-600 border border-indigo-200 bg-white px-2.5 py-1.5 rounded-lg hover:bg-slate-50"
                      >
                        {isOverriding ? "Cancel Override" : "Adjust / Override Zone"}
                      </button>
                    </div>
                    {!isOverriding ? (
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-slate-400 block font-bold text-[9px] uppercase">Zone Constraint</span>
                          <span className="font-black text-black uppercase">
                            {selectedDriverDetail.zoneEnabled ? "Active & Enforced" : "Disabled (Global Duty)"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-bold text-[9px] uppercase">Max Range Limit</span>
                          <span className="font-black text-black">
                            {selectedDriverDetail.zoneMaxDistance ? `${selectedDriverDetail.zoneMaxDistance} miles` : "unlimited"}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-400 block font-bold text-[9px] uppercase">Declared Center Coordination</span>
                          <span className="text-[10px] font-bold text-black leading-relaxed">
                            {selectedDriverDetail.homeAddress || "None"}
                          </span>
                        </div>

                        {/* 🔴 Real-Time Zone Intensity Assessment (3-Mile Cluster) */}
                        {(() => {
                          const driverLat = selectedDriverDetail.liveLat || selectedDriverDetail.homeLat;
                          const driverLng = selectedDriverDetail.liveLng || selectedDriverDetail.homeLng;
                          const metrics = getClusterMetrics(driverLat ?? null, driverLng ?? null);
                          return (
                            <div className="col-span-2 mt-1 pt-3 border-t border-dashed border-gray-200">
                              <p className="text-[10px] font-black text-black uppercase tracking-widest mb-2 flex items-center justify-between">
                                <span>Live Cluster Intensity (3mi)</span>
                                {metrics.intensity === "high" && (
                                  <span className="px-2 py-0.5 bg-red-100 text-red-700 border border-red-300 rounded text-[8px] font-extrabold uppercase">
                                    🔴 High Intensity Active
                                  </span>
                                )}
                                {metrics.intensity === "medium" && (
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-300 rounded text-[8px] font-extrabold uppercase">
                                    🟡 Medium Intensity
                                  </span>
                                )}
                                {metrics.intensity === "low" && (
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 border border-blue-300 rounded text-[8px] font-extrabold uppercase">
                                    🔵 Low Intensity
                                  </span>
                                )}
                                {metrics.intensity === "standard" && (
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-300 rounded text-[8px] font-extrabold uppercase">
                                    ⚪ Standard (Normal)
                                  </span>
                                )}
                              </p>

                              <div className="grid grid-cols-2 gap-2 text-[10px] bg-white p-2.5 rounded-lg border border-black/10">
                                <div>
                                  <span className="text-slate-400 block font-bold text-[8.5px] uppercase">Demand/Supply Ratio</span>
                                  <span className="font-extrabold text-black">
                                    {metrics.jobsCount} jobs : {metrics.driversCount} drivers ({metrics.ratio.toFixed(1)}:1)
                                  </span>
                                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full ${
                                        metrics.ratio > (surgeConfig.surgeRules.highRatioThreshold || 3.0) 
                                          ? "bg-red-500" 
                                          : metrics.ratio > (surgeConfig.surgeRules.mediumRatioThreshold || 2.0) 
                                          ? "bg-amber-500" 
                                          : "bg-emerald-500"
                                      }`}
                                      style={{ width: `${Math.min(metrics.ratio * 25, 100)}%` }}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <span className="text-slate-400 block font-bold text-[8.5px] uppercase">Max Wait Time</span>
                                  <span className="font-extrabold text-black">
                                    {metrics.maxWaitTime > 0 ? `${metrics.maxWaitTime.toFixed(1)} mins` : "No pending jobs"}
                                  </span>
                                  <div className="text-[7.5px] text-slate-400 italic mt-1 font-semibold leading-tight">
                                    {metrics.maxWaitTime > (surgeConfig.surgeRules.highWaitMins || 20) 
                                      ? "Exceeds High Limit threshold" 
                                      : metrics.maxWaitTime > (surgeConfig.surgeRules.mediumWaitMins || 10)
                                      ? "Exceeds Medium Limit threshold"
                                      : "Within regular wait times"
                                    }
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Force Toggle Zone in Database */}
                        <div className="col-span-2 pt-2">
                          <button
                            type="button"
                            onClick={() => saveDriverZoneOverride(selectedDriverDetail.id, !selectedDriverDetail.zoneEnabled)}
                            className={`w-full py-2 px-4 rounded-xl text-xs font-black uppercase text-center border-2 transition-all ${
                              selectedDriverDetail.zoneEnabled
                                ? "bg-red-50 border-red-500 text-red-700 hover:bg-red-100"
                                : "bg-emerald-50 border-emerald-500 text-emerald-700 hover:bg-emerald-100"
                            }`}
                          >
                            {selectedDriverDetail.zoneEnabled ? "Force Disable Zone Preference" : "Force Enable Zone Preference"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-[9px] font-medium text-slate-500 italic">Adjust values below to override the driver's target center or maximum distance constraints directly.</p>
                        
                        {/* 1. Radius Adjustment */}
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Zone Radius (miles): {overrideRadius} mi</label>
                          <input
                            type="range"
                            min="2"
                            max="30"
                            step="1"
                            value={overrideRadius}
                            onChange={(e) => setOverrideRadius(parseInt(e.target.value, 10))}
                            className="w-full accent-indigo-600"
                          />
                        </div>

                        {/* 2. Custom Center Search */}
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Change Center Address</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={drawerSearchQuery}
                              onChange={(e) => setDrawerSearchQuery(e.target.value)}
                              placeholder={overrideAddress || "Search address..."}
                              className="w-full bg-white text-slate-800 p-2 border border-black rounded-xl text-xs"
                            />
                            {overrideLat && overrideLng && (
                              <span className="absolute right-2.5 top-2.5 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                              </span>
                            )}
                          </div>

                          {subSuggestions.length > 0 && (
                            <div className="bg-white border border-black rounded-xl max-h-36 overflow-y-auto shadow-md">
                              {subSuggestions.map((s, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => selectOverridePlace(s.place_id, s.description)}
                                  className="w-full text-left p-2.5 text-xs text-slate-800 hover:bg-slate-50 border-b border-gray-100"
                                >
                                  {s.description}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setIsOverriding(false)}
                            className="flex-1 bg-white border border-gray-300 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => saveDriverZoneOverride(selectedDriverDetail.id, true)}
                            className="flex-1 bg-black text-white py-2 rounded-xl text-xs font-black uppercase tracking-wider"
                          >
                            Save Override
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* General Rules Selection View */}
            {activeTab === "rules" && (
              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-black">Enable Automated Surge</p>
                      <p className="text-[10px] text-slate-400">Triggers pricing surge organically based on supply-to-demand ratio.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSurgeConfig({ ...surgeConfig, surgeEnabled: !surgeConfig.surgeEnabled })}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                        surgeConfig.surgeEnabled ? 'bg-[#00D26A]' : 'bg-gray-200'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        surgeConfig.surgeEnabled ? 'translate-x-[1.5rem]' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                </div>

                {/* Everything below Automated Surge toggle is wrapped in a dynamic fading highlight container */}
                <div className={`transition-all duration-300 space-y-5 ${
                  surgeConfig.surgeEnabled 
                    ? "opacity-100 ring-1 ring-emerald-500/5 shadow-[0_0_12px_rgba(16,185,129,0.03)]" 
                    : "opacity-40 select-none pointer-events-none filter grayscale-[40%] blur-[0.2px]"
                }`}>
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-black">Surge Model Format</p>
                      <p className="text-[10px] text-slate-400">Either flat-rate surcharge premiums or dynamic percentage multipliers.</p>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-lg border border-black/10">
                      <button
                        type="button"
                        onClick={() => setSurgeConfig({ ...surgeConfig, surgeModel: "fixed" })}
                        className={`px-3 py-1.5 text-[9px] font-black uppercase transition-all tracking-tight ${
                          surgeConfig.surgeModel === "fixed"
                            ? "bg-black text-white rounded-md shadow-sm"
                            : "text-slate-500 hover:text-slate-950"
                        }`}
                      >
                        Fixed Fee
                      </button>
                      <button
                        type="button"
                        onClick={() => setSurgeConfig({ ...surgeConfig, surgeModel: "multiplier" })}
                        className={`px-3 py-1.5 text-[9px] font-black uppercase transition-all tracking-tight ${
                          surgeConfig.surgeModel === "multiplier"
                            ? "bg-black text-white rounded-md shadow-sm"
                            : "text-slate-500 hover:text-slate-950"
                        }`}
                      >
                        Multiplier
                      </button>
                    </div>
                  </div>

                {/* Surcharges thresholds editing inputs */}
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dynamic Intensity Thresholds</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Wait Time Thresholds Card */}
                    <div className="p-4 bg-slate-50 border border-black rounded-lg space-y-3 col-span-2">
                    <p className="text-[10px] font-black text-black uppercase tracking-widest flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-indigo-600" />
                      Passenger Wait Time Limits (Minutes)
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold text-slate-500 uppercase">Low Intensity</label>
                        <input
                          type="number"
                          value={surgeConfig.surgeRules.lowWaitMins || 5}
                          onChange={(e) => setSurgeConfig({
                            ...surgeConfig,
                            surgeRules: { ...surgeConfig.surgeRules, lowWaitMins: parseInt(e.target.value, 10) || 0 }
                          })}
                          className="w-full bg-white border border-black rounded-lg p-2 font-bold text-xs text-black"
                        />
                        <span className="text-[7.5px] text-slate-400 block font-semibold leading-none mt-1">Default: 5m</span>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold text-slate-500 uppercase">Medium Intensity</label>
                        <input
                          type="number"
                          value={surgeConfig.surgeRules.mediumWaitMins || 10}
                          onChange={(e) => setSurgeConfig({
                            ...surgeConfig,
                            surgeRules: { ...surgeConfig.surgeRules, mediumWaitMins: parseInt(e.target.value, 10) || 0 }
                          })}
                          className="w-full bg-white border border-black rounded-lg p-2 font-bold text-xs text-black"
                        />
                        <span className="text-[7.5px] text-slate-400 block font-semibold leading-none mt-1">Default: 10m</span>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold text-slate-500 uppercase">High Intensity</label>
                        <input
                          type="number"
                          value={surgeConfig.surgeRules.highWaitMins || 20}
                          onChange={(e) => setSurgeConfig({
                            ...surgeConfig,
                            surgeRules: { ...surgeConfig.surgeRules, highWaitMins: parseInt(e.target.value, 10) || 0 }
                          })}
                          className="w-full bg-white border border-black rounded-lg p-2 font-bold text-xs text-black"
                        />
                        <span className="text-[7.5px] text-slate-400 block font-semibold leading-none mt-1">Default: 20m</span>
                      </div>
                    </div>
                  </div>

                  {/* Demand-to-Supply Ratio Thresholds Card */}
                  <div className="p-4 bg-slate-50 border border-black rounded-lg space-y-3 col-span-2">
                    <p className="text-[10px] font-black text-black uppercase tracking-widest flex items-center gap-1">
                      <Target className="w-3.5 h-3.5 text-indigo-600" />
                      Demand-to-Supply Ratio Triggers (Jobs : Driver)
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold text-slate-500 uppercase">Low Intensity</label>
                        <input
                          type="number"
                          step="0.1"
                          value={surgeConfig.surgeRules.lowRatioThreshold !== undefined ? surgeConfig.surgeRules.lowRatioThreshold : 1.0}
                          onChange={(e) => setSurgeConfig({
                            ...surgeConfig,
                            surgeRules: { ...surgeConfig.surgeRules, lowRatioThreshold: parseFloat(e.target.value) || 0 }
                          })}
                          className="w-full bg-white border border-black rounded-lg p-2 font-bold text-xs text-black"
                        />
                        <span className="text-[7.5px] text-slate-400 block font-semibold leading-none mt-1">Default: 1.0 (1:1)</span>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold text-slate-500 uppercase">Medium Intensity</label>
                        <input
                          type="number"
                          step="0.1"
                          value={surgeConfig.surgeRules.mediumRatioThreshold !== undefined ? surgeConfig.surgeRules.mediumRatioThreshold : 2.0}
                          onChange={(e) => setSurgeConfig({
                            ...surgeConfig,
                            surgeRules: { ...surgeConfig.surgeRules, mediumRatioThreshold: parseFloat(e.target.value) || 0 }
                          })}
                          className="w-full bg-white border border-black rounded-lg p-2 font-bold text-xs text-black"
                        />
                        <span className="text-[7.5px] text-slate-400 block font-semibold leading-none mt-1">Default: 2.0 (2:1)</span>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold text-slate-500 uppercase">High Intensity</label>
                        <input
                          type="number"
                          step="0.1"
                          value={surgeConfig.surgeRules.highRatioThreshold !== undefined ? surgeConfig.surgeRules.highRatioThreshold : 3.0}
                          onChange={(e) => setSurgeConfig({
                            ...surgeConfig,
                            surgeRules: { ...surgeConfig.surgeRules, highRatioThreshold: parseFloat(e.target.value) || 0 }
                          })}
                          className="w-full bg-white border border-black rounded-lg p-2 font-bold text-xs text-black"
                        />
                        <span className="text-[7.5px] text-slate-400 block font-semibold leading-none mt-1">Default: 3.0 (3:1)</span>
                      </div>
                    </div>
                  </div>

                    {/* Box 1: Fixed Fee Setup Card */}
                    <div className={`col-span-2 p-3 bg-white border border-black rounded-xl transition-all duration-300 ${
                      surgeConfig.surgeModel === "fixed"
                        ? "opacity-100 shadow-[2px_2px_0px_rgba(0,0,0,1)] ring-1 ring-black"
                        : "opacity-45 select-none pointer-events-none grayscale"
                    }`}>
                      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-dashed border-gray-100">
                        <span className="text-[9px] font-black text-black uppercase tracking-wider block">
                          Fixed Fee Surcharges
                        </span>
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border transition-colors ${
                          surgeConfig.surgeModel === "fixed"
                            ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                            : "bg-slate-100 border-slate-200 text-slate-500"
                        }`}>
                          {surgeConfig.surgeModel === "fixed" ? "● Active" : "✖ Inactive"}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <span className="text-[8px] font-black text-slate-500 block uppercase">Low (£)</span>
                          <input
                            type="number"
                            step="0.5"
                            disabled={surgeConfig.surgeModel !== "fixed"}
                            value={surgeConfig.surgeRules.lowFee}
                            onChange={(e) => setSurgeConfig({
                              ...surgeConfig,
                              surgeRules: { ...surgeConfig.surgeRules, lowFee: parseFloat(e.target.value) }
                            })}
                            className="w-full bg-slate-50 border border-black rounded p-1 font-bold text-xs text-black"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[8px] font-black text-slate-500 block uppercase">Medium (£)</span>
                          <input
                            type="number"
                            step="0.5"
                            disabled={surgeConfig.surgeModel !== "fixed"}
                            value={surgeConfig.surgeRules.mediumFee}
                            onChange={(e) => setSurgeConfig({
                              ...surgeConfig,
                              surgeRules: { ...surgeConfig.surgeRules, mediumFee: parseFloat(e.target.value) }
                            })}
                            className="w-full bg-slate-50 border border-black rounded p-1 font-bold text-xs text-black"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[8px] font-black text-slate-500 block uppercase">High (£)</span>
                          <input
                            type="number"
                            step="0.5"
                            disabled={surgeConfig.surgeModel !== "fixed"}
                            value={surgeConfig.surgeRules.highFee}
                            onChange={(e) => setSurgeConfig({
                              ...surgeConfig,
                              surgeRules: { ...surgeConfig.surgeRules, highFee: parseFloat(e.target.value) }
                            })}
                            className="w-full bg-slate-50 border border-black rounded p-1 font-bold text-xs text-black"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Box 2: Multiplier Scheme Card */}
                    <div className={`col-span-2 p-3 bg-white border border-black rounded-xl transition-all duration-300 ${
                      surgeConfig.surgeModel === "multiplier"
                        ? "opacity-100 shadow-[2px_2px_0px_rgba(0,0,0,1)] ring-1 ring-black"
                        : "opacity-45 select-none pointer-events-none grayscale"
                    }`}>
                      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-dashed border-gray-100">
                        <span className="text-[9px] font-black text-black uppercase tracking-wider block">
                          Multiplier Surcharges
                        </span>
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border transition-colors ${
                          surgeConfig.surgeModel === "multiplier"
                            ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                            : "bg-slate-100 border-slate-200 text-slate-500"
                        }`}>
                          {surgeConfig.surgeModel === "multiplier" ? "● Active" : "✖ Inactive"}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <span className="text-[8px] font-black text-slate-500 block uppercase">Low (x)</span>
                          <input
                            type="number"
                            step="0.1"
                            disabled={surgeConfig.surgeModel !== "multiplier"}
                            value={surgeConfig.surgeRules.lowMultiplier}
                            onChange={(e) => setSurgeConfig({
                              ...surgeConfig,
                              surgeRules: { ...surgeConfig.surgeRules, lowMultiplier: parseFloat(e.target.value) }
                            })}
                            className="w-full bg-slate-50 border border-black rounded p-1 font-bold text-xs text-black"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[8px] font-black text-slate-500 block uppercase">Medium (x)</span>
                          <input
                            type="number"
                            step="0.1"
                            disabled={surgeConfig.surgeModel !== "multiplier"}
                            value={surgeConfig.surgeRules.mediumMultiplier}
                            onChange={(e) => setSurgeConfig({
                              ...surgeConfig,
                              surgeRules: { ...surgeConfig.surgeRules, mediumMultiplier: parseFloat(e.target.value) }
                            })}
                            className="w-full bg-slate-50 border border-black rounded p-1 font-bold text-xs text-black"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[8px] font-black text-slate-500 block uppercase">High (x)</span>
                          <input
                            type="number"
                            step="0.1"
                            disabled={surgeConfig.surgeModel !== "multiplier"}
                            value={surgeConfig.surgeRules.highMultiplier}
                            onChange={(e) => setSurgeConfig({
                              ...surgeConfig,
                              surgeRules: { ...surgeConfig.surgeRules, highMultiplier: parseFloat(e.target.value) }
                            })}
                            className="w-full bg-slate-50 border border-black rounded p-1 font-bold text-xs text-black"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Box 3: Surge Map UI Colors Card */}
                    <div className="col-span-2 p-3 bg-white border border-black rounded-xl">
                      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-dashed border-gray-100">
                        <span className="text-[9px] font-black text-black uppercase tracking-wider block">
                          Surge Map UI Colors
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <span className="text-[8px] font-black text-slate-500 block uppercase">Low Intensity</span>
                          <select
                            value={surgeConfig.surgeRules.lowColor || "green"}
                            onChange={(e) => setSurgeConfig({
                              ...surgeConfig,
                              surgeRules: { ...surgeConfig.surgeRules, lowColor: e.target.value }
                            })}
                            className="w-full bg-slate-50 border border-black rounded p-1 font-bold text-xs text-black focus:outline-none"
                          >
                            <option value="blue">Blue</option>
                            <option value="green">Green</option>
                            <option value="amber">Orange/Yellow</option>
                            <option value="red">Red</option>
                            <option value="purple">Purple</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[8px] font-black text-slate-500 block uppercase">Med Intensity</span>
                          <select
                            value={surgeConfig.surgeRules.mediumColor || "amber"}
                            onChange={(e) => setSurgeConfig({
                              ...surgeConfig,
                              surgeRules: { ...surgeConfig.surgeRules, mediumColor: e.target.value }
                            })}
                            className="w-full bg-slate-50 border border-black rounded p-1 font-bold text-xs text-black focus:outline-none"
                          >
                            <option value="blue">Blue</option>
                            <option value="green">Green</option>
                            <option value="amber">Orange/Yellow</option>
                            <option value="red">Red</option>
                            <option value="purple">Purple</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[8px] font-black text-slate-500 block uppercase">High Intensity</span>
                          <select
                            value={surgeConfig.surgeRules.highColor || "red"}
                            onChange={(e) => setSurgeConfig({
                              ...surgeConfig,
                              surgeRules: { ...surgeConfig.surgeRules, highColor: e.target.value }
                            })}
                            className="w-full bg-slate-50 border border-black rounded p-1 font-bold text-xs text-black focus:outline-none"
                          >
                            <option value="blue">Blue</option>
                            <option value="green">Green</option>
                            <option value="amber">Orange/Yellow</option>
                            <option value="red">Red</option>
                            <option value="purple">Purple</option>
                          </select>
                        </div>
                      </div>
                      <div className="mt-3 pt-2 border-t border-dashed border-gray-100 flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <label className="text-[8px] font-black text-slate-500 block uppercase">Overlay Opacity: {surgeConfig.surgeRules.surgeOpacity || 40}%</label>
                          <input
                            type="range"
                            min="5"
                            max="80"
                            step="5"
                            value={surgeConfig.surgeRules.surgeOpacity || 40}
                            onChange={(e) => setSurgeConfig({
                              ...surgeConfig,
                              surgeRules: { ...surgeConfig.surgeRules, surgeOpacity: parseInt(e.target.value) }
                            })}
                            className="w-full accent-black h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer mt-1"
                          />
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                </div>

                <button
                  type="button"
                  disabled={isSavingRules}
                  onClick={handleSaveRules}
                  className="w-full bg-black text-white hover:bg-slate-900 transition-colors py-3 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2"
                >
                  {isSavingRules ? (
                    <RefreshCw className="animate-spin w-4 h-4" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSavingRules ? "Syncing configs..." : "Save Pricing Dials"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Side Panel: Interactive Map Area */}
        <div className="flex-1 h-[650px] relative">
          <div className="absolute inset-0 bg-slate-100 rounded-xl border border-black overflow-hidden shadow-sm flex flex-col">
            <div className="bg-slate-50 border-b border-black px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapIcon className="text-indigo-600 w-5 h-5" />
                <h2 className="font-bold text-black text-sm">Interactive Coverage Room</h2>
              </div>
              <p className="text-slate-500 text-xs italic">Pins depict live positions of online duty drivers, colored circles display range.</p>
            </div>
            
            <div className="flex-1 relative">
              {isLoaded ? (
                <GoogleMap
                  mapContainerClassName="w-full h-full"
                  center={mapCenter}
                  zoom={mapZoom}
                  options={premiumMapOptions}
                >
                  {/* Render standard online driver pins */}
                  {correlatedDrivers.map(d => {
                    // Determine coordinates to render pin on
                    const lat = d.liveLat || d.homeLat;
                    const lng = d.liveLng || d.homeLng;
                    if (!lat || !lng) return null;

                    return (
                      <React.Fragment key={d.id}>
                        <MarkerF
                          position={{ lat, lng }}
                          onClick={() => {
                            setSelectedPin(d);
                            setSelectedDriverId(d.id);
                          }}
                          icon={{
                            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                            scale: 5,
                            fillColor: d.isOnline ? "#10B981" : "#6B7280", // Green if online, gray otherwise
                            fillOpacity: 1.0,
                            strokeWeight: 2,
                            strokeColor: "#000000",
                            rotation: 0
                          }}
                        />

                        {/* If they have an enabled zone, draw their visual coverage boundaries circle */}
                        {d.zoneEnabled && d.homeLat && d.homeLng && d.zoneMaxDistance && (
                          <CircleF
                            center={{ lat: d.homeLat, lng: d.homeLng }}
                            radius={d.zoneMaxDistance * 1609.34} // Convert miles to meters
                            options={{
                              fillColor: selectedDriverId === d.id ? "#6366F1" : "#4F46E5",
                              fillOpacity: 0.08,
                              strokeColor: selectedDriverId === d.id ? "#6366F1" : "#4F46E5",
                              strokeOpacity: 0.4,
                              strokeWeight: selectedDriverId === d.id ? 3 : 1
                            }}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* Render Info Window when driver pin is chosen */}
                  {selectedPin && (
                    <InfoWindowF
                      position={{
                        lat: selectedPin.liveLat || selectedPin.homeLat || mapCenter.lat,
                        lng: selectedPin.liveLng || selectedPin.homeLng || mapCenter.lng
                      }}
                      onCloseClick={() => setSelectedPin(null)}
                    >
                      <div className="p-2 min-w-56 text-xs text-black">
                        <div className="font-black text-sm mb-1">{selectedPin.name}</div>
                        <div className="text-[10px] text-slate-500 mb-2">Member ID: {selectedPin.memberId || "N/A"}</div>
                        
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Status:</span>
                            <span className={`font-bold uppercase ${selectedPin.isOnline ? "text-green-600" : "text-slate-500"}`}>
                              {selectedPin.isOnline ? `Duty (${selectedPin.liveStatus})` : "Offline"}
                            </span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-slate-400">Working Zone:</span>
                            <span className="font-bold text-black uppercase">
                              {selectedPin.zoneEnabled ? "Enforced" : "Disabled (Global)"}
                            </span>
                          </div>

                          {selectedPin.zoneEnabled && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Radius:</span>
                              <span className="font-bold text-indigo-600">
                                {selectedPin.zoneMaxDistance} miles
                              </span>
                            </div>
                          )}

                          {selectedPin.homeAddress && (
                            <div className="pt-1 text-[10px] text-slate-500 border-t border-gray-100 italic">
                              Center: {selectedPin.homeAddress}
                            </div>
                          )}
                        </div>
                      </div>
                    </InfoWindowF>
                  )}

                  {/* AI Predictive Surge Heatmap */}
                  {demandZones.map((zone, idx) => {
                    const rawIntensity = (zone.intensity || zone.type || "low").toLowerCase();
                    const intensity = rawIntensity === "moderate" ? "medium" : rawIntensity;

                    let uiColor = (zone as any).uiColor;
                    if (!uiColor) {
                      if (intensity === "high") uiColor = "red";
                      else if (intensity === "medium" || intensity === "moderate") uiColor = "amber";
                      else uiColor = "green";
                    }
                    
                    let rawOpacity = (zone as any).uiOpacity;
                    let parsedOpacity = typeof rawOpacity === 'number' ? rawOpacity 
                      : (typeof rawOpacity === 'string' ? parseFloat(rawOpacity) : 40);
                    let uiOpacity = (!isNaN(parsedOpacity) ? parsedOpacity : 40) / 100;

                    // Define theme values based on selected uiColor
                    let circleColor = "#34C759"; // Default green
                    let strokeColor = "#16A34A"; // Darker green
                    let glowBg = "bg-emerald-500";
                    
                    if (uiColor === "red") {
                      circleColor = "#FF3B30";
                      strokeColor = "#DC2626";
                      glowBg = "bg-red-500";
                    } else if (uiColor === "amber") {
                      circleColor = "#FF9500";
                      strokeColor = "#D97706";
                      glowBg = "bg-amber-500";
                    } else if (uiColor === "blue") {
                      circleColor = "#3B82F6";
                      strokeColor = "#2563EB";
                      glowBg = "bg-blue-500";
                    } else if (uiColor === "purple") {
                      circleColor = "#AF52DE";
                      strokeColor = "#9333EA";
                      glowBg = "bg-purple-500";
                    }

                    return (
                      <React.Fragment key={`surge-${idx}-${uiOpacity}`}>
                        <CircleF
                          key={`circle-${idx}-${uiOpacity}`}
                          center={{ lat: zone.lat, lng: zone.lng }}
                          radius={zone.radius}
                          options={{
                            strokeColor: strokeColor,
                            strokeOpacity: 0.8,
                            strokeWeight: 1,
                            fillColor: circleColor,
                            fillOpacity: uiOpacity,
                            clickable: false,
                          }}
                        />
                        <OverlayViewF
                          position={{ lat: zone.lat, lng: zone.lng }}
                          mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                        >
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                            {/* Simple Pulsing Color-Coded Flash Icon */}
                            <div className="relative flex flex-col items-center justify-center">
                              {/* Pulse ripple circle */}
                              <span className={cn(
                                "absolute top-0 inline-flex h-8 w-8 rounded-full animate-ping",
                                glowBg
                              )} style={{ marginTop: "-2px", opacity: uiOpacity }}></span>
                              {/* Bare Zap Icon */}
                              <Zap className="w-6 h-6 fill-current animate-pulse relative z-10 drop-shadow-md" style={{ color: strokeColor }} />
                              {/* Price Label */}
                              <span className="text-[14px] font-black mt-0.5 tracking-widest relative z-10 text-center drop-shadow-md bg-white/40 px-1.5 py-0.5 rounded backdrop-blur-sm shadow-sm" style={{ color: strokeColor }}>
                                {zone.label ? zone.label.replace(" Surge", "") : ""}
                              </span>
                            </div>
                          </div>
                        </OverlayViewF>
                      </React.Fragment>
                    );
                  })}
                </GoogleMap>
              ) : (
                <div className="absolute inset-0 bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                  <RefreshCw className="animate-spin w-8 h-8 text-black mb-3" />
                  <p className="text-slate-800 font-bold text-sm">Synchronizing Google Maps Engine...</p>
                  <p className="text-slate-400 text-xs mt-1">Downloading maps overlay scripts from library securely.</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

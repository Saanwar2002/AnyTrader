import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MapContainer, TileLayer, Circle, Marker, useMap, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../AuthProvider";
import { cn } from "@/src/lib/utils";
import { toast } from "sonner";
import { triggerHaptic, ImpactStyle } from "@/src/lib/capacitor";
import { Navigation, Power, Zap, ChevronDown, Check, X, Phone, MessageSquare, AlertCircle, MapPin, Grid, Inbox, Menu as MenuIcon, PoundSterling, Star, Target, TrendingUp, Calendar, Clock, Eye, EyeOff } from "lucide-react";
import { GoogleMap, useJsApiLoader, MarkerF, PolylineF, OverlayViewF, OverlayView } from "@react-google-maps/api";
import { db, doc, onSnapshot, collection, query, where, updateDoc, setDoc, serverTimestamp, deleteField, increment } from "@/src/firebase";
import DriverEarnings from "./DriverEarnings";
import DriverInbox from "./DriverInbox";
import DriverMenu from "./DriverMenu";
import DriverDocuments from "./DriverDocuments";

// Custom pulsing blue dot for driver
const driverIcon = new L.DivIcon({
  html: `<div class="relative flex items-center justify-center w-8 h-8">
           <div class="absolute inset-0 bg-[#007AFF] rounded-full opacity-30 animate-ping"></div>
           <div class="bg-[#007AFF] border-2 border-white w-4 h-4 rounded-full shadow-lg z-10"></div>
         </div>`,
  className: "bg-transparent",
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

function SetupMapControls({ isOnline }: { isOnline: boolean }) {
  const map = useMap();
  useEffect(() => {
    map.zoomControl?.remove();
  }, [map]);
  return null;
}

type RideState = 'idle' | 'incoming' | 'en_route_pickup' | 'waiting' | 'in_progress' | 'completed' | 'review';

const libraries: any[] = ['places'];

export default function DriverTerminal() {
  const { user, profile } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [onlineStartTime, setOnlineStartTime] = useState<Date | null>(null);
  const [onlineDurationText, setOnlineDurationText] = useState("0 min");
  const [mapCenter, setMapCenter] = useState<[number, number]>([53.6458, -1.7850]); // Default to Huddersfield from spec
  const [demandZones, setDemandZones] = useState<any[]>([]);
  
  // Ride Simulation State
  const [rideState, setRideState] = useState<RideState>('idle');
  const [showFareBreakdown, setShowFareBreakdown] = useState(false);
  const [incomingTimer, setIncomingTimer] = useState(15);
  
  // Rating State
  const [passengerRating, setPassengerRating] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  
  // Stats Card state
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);
  const [isEarningsVisible, setIsEarningsVisible] = useState(false);
  const [isEmergencyVisible, setIsEmergencyVisible] = useState(false);

  // Auto-close stats after 5 seconds
  useEffect(() => {
    if (isStatsExpanded) {
      const timer = setTimeout(() => {
        setIsStatsExpanded(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isStatsExpanded]);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
    version: "weekly"
  });

  // Dynamic Fare & Live Ride Tracking
  const [fareConfig, setFareConfig] = useState<{baseFare: number, distanceRate: number, minFare: number, commissionRate: number}>({ baseFare: 3.5, distanceRate: 1.3, minFare: 5.0, commissionRate: 0.12 });
  const [activeRide, setActiveRide] = useState<any>(null); // Stores live or simulated ride data

  // Listen to Taxi Command Settings (platform_config/rides)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "platform_config", "rides"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFareConfig({
          baseFare: Number(data.baseFare) || 3.5,
          distanceRate: Number(data.distanceRate) || 1.3,
          minFare: Number(data.minFare) || 5.0,
          commissionRate: data.commission ? Number(data.commission) / 100 : 0.12,
        });
      }
    }, (error) => {
      console.error("Firestore Rides Config Error:", error);
    });
    return () => unsub();
  }, []);

  // Listen for REAL incoming live ride requests (offered to this driver)
  useEffect(() => {
    if (!isOnline || rideState !== 'idle' || !user) return;

    const q = query(
      collection(db, "ride_requests"), 
      where("status", "==", "offered"),
      where("assignedDriverId", "==", user.uid)
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const rideDoc = snapshot.docs[0];
        const data = rideDoc.data();
        
        setActiveRide({
          id: rideDoc.id,
          userId: data.riderId,
          name: data.passengerName || "Live Passenger",
          pickupAddress: data.pickup,
          dropoffAddress: data.dropoff,
          pickupLat: data.pickupLat,
          pickupLng: data.pickupLng,
          dropoffLat: data.dropoffLat,
          dropoffLng: data.dropoffLng,
          stops: data.stops || [],
          fareEstimate: data.totalFare,
          distanceMiles: data.distanceMiles || 0,
          durationMinutes: data.durationMinutes || 0,
          isReal: true,
          offerExpiresAt: data.offerExpiresAt
        });
        
        // Calculate remaining time for the offer
        const expiresAt = new Date(data.offerExpiresAt).getTime();
        const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
        
        setIncomingTimer(remaining);
        setRideState('incoming');
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]);
      }
    });
    
    return () => unsub();
  }, [isOnline, rideState, user]);

  // Simulation: Add fake demand zones
  useEffect(() => {
    setDemandZones([
      { lat: 53.6458, lng: -1.7850, radius: 1200, type: "high", multiplier: "1.4x" },
      { lat: 53.6550, lng: -1.8000, radius: 1800, type: "moderate", multiplier: "1.2x" },
    ]);
  }, []);

  // Timer simulation for Incoming request
  useEffect(() => {
    let interval: any;
    if (rideState === 'incoming' && incomingTimer > 0) {
      interval = setInterval(() => setIncomingTimer(prev => prev - 1), 1000);
    } else if (rideState === 'incoming' && incomingTimer === 0) {
      handleDeclineRide();
    }
    return () => clearInterval(interval);
  }, [rideState, incomingTimer]);

  const handleToggleOnline = () => {
    if (rideState !== 'idle') return; // Cannot toggle while riding
    
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    setActiveTab('home');
    
    if (newStatus) {
      setOnlineStartTime(new Date());
      setOnlineDurationText("0 min");
    } else {
      setOnlineStartTime(null);
    }
    
    if (navigator.vibrate) navigator.vibrate(100);
  };

  // Update session duration timer
  useEffect(() => {
    if (!isOnline || !onlineStartTime) return;

    const interval = setInterval(() => {
      const diffMs = new Date().getTime() - onlineStartTime.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      
      if (diffMin < 60) {
        setOnlineDurationText(`${diffMin} min`);
      } else {
        const hrs = Math.floor(diffMin / 60);
        const mins = diffMin % 60;
        setOnlineDurationText(`${hrs}h ${mins}m`);
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [isOnline, onlineStartTime]);

  // Real-time GPS Tracking & Status Sync
  useEffect(() => {
    if (!isOnline || !user) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setMapCenter([latitude, longitude]);
        
        // Sync to Firestore for dispatcher
        try {
          await setDoc(doc(db, "live_tracking", user.uid), {
            driverId: user.uid,
            lat: latitude,
            lng: longitude,
            updatedAt: serverTimestamp(),
            isOnline: true
          }, { merge: true });
          
          await setDoc(doc(db, "driver_status", user.uid), {
            online: true,
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (err) {
          console.error("Failed to sync location:", err);
        }
      },
      (err) => console.warn("GPS tracking error:", err),
      { enableHighAccuracy: true, maximumAge: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      // When effect cleans up (offline), we should update status
      if (user) {
        updateDoc(doc(db, "driver_status", user.uid), { online: false }).catch(console.error);
        updateDoc(doc(db, "live_tracking", user.uid), { isOnline: false }).catch(console.error);
      }
    };
  }, [isOnline, user]);

  const simulateIncomingRide = () => {
    if (!isOnline) {
      setIsOnline(true);
    }
    
    // Create a dynamic simulation using real live fare configs
    const simulatedDist = Math.floor(Math.random() * 15) + 3; // 3 to 18 miles
    const simulatedTime = simulatedDist * 2.5; // Rough time
    const calcFare = Math.max(fareConfig.minFare, fareConfig.baseFare + (simulatedDist * fareConfig.distanceRate));
    
    // Add surge for the simulation (just for UI visuals)
    const surge = 1.4;
    const finalFare = calcFare * surge;
    
    setActiveRide({
      id: "simulated_ride_123",
      name: "Sarah T.",
      pickupAddress: "12 Elm Street, SE15",
      dropoffAddress: "Bristol Temple Meads",
      pickupLat: mapCenter[0] + 0.01,
      pickupLng: mapCenter[1] + 0.01,
      dropoffLat: mapCenter[0] - 0.02,
      dropoffLng: mapCenter[1] - 0.02,
      stops: [],
      fareEstimate: finalFare,
      baseCalc: calcFare,
      surgeMultiplier: surge,
      distanceMiles: simulatedDist,
      durationMinutes: simulatedTime,
      isReal: false
    });

    setIncomingTimer(15);
    setRideState('incoming');
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]); // Custom ride tone haptic
  };

  const handleAcceptRide = async () => {
    // If it's a real ride from Firestore, claim it!
    if (activeRide?.isReal && activeRide?.id && user) {
      try {
        await updateDoc(doc(db, "ride_requests", activeRide.id), {
          status: "accepted",
          driverId: user.uid,
          acceptedAt: serverTimestamp()
        });
        
        await updateDoc(doc(db, "driver_status", user.uid), {
          isBusy: true,
          pendingRideId: deleteField()
        } as any);

      } catch (err) {
        console.error("Failed to claim ride:", err);
        toast.error("Failed to accept ride. It might have expired.");
        setRideState('idle');
        return;
      }
    }

    setRideState('en_route_pickup');
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const handleDeclineRide = async () => {
    if (activeRide?.id && activeRide?.isReal && user) {
      try {
        // Penalty logic: consecutive declines
        await updateDoc(doc(db, "driver_status", user.uid), {
          pendingRideId: deleteField(),
          consecutiveDeclines: increment(1)
        } as any);

        // Put ride back into search pool
        await updateDoc(doc(db, "ride_requests", activeRide.id), {
          status: "pending",
          assignedDriverId: deleteField(),
          offerExpiresAt: deleteField()
        } as any);

      } catch (err) {
        console.error("Error declining ride:", err);
      }
    }

    setActiveRide(null);
    setRideState('idle');
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const currentTabParam = searchParams.get("tab") || "home";
  
  const [activeTab, setActiveTabState] = useState<'home' | 'earnings' | 'inbox' | 'menu' | 'documents'>(currentTabParam as any);

  useEffect(() => {
    setActiveTabState((searchParams.get("tab") as any) || "home");
  }, [searchParams]);

  const setActiveTab = (tab: string) => {
    if (tab === 'home') {
      searchParams.delete('tab');
    } else {
      searchParams.set('tab', tab);
    }
    setSearchParams(searchParams);
  };
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [isGeneratingPayment, setIsGeneratingPayment] = useState(false);

  const handleArrived = async () => {
    setRideState('waiting');
    if (activeRide?.id && activeRide?.isReal) {
      await updateDoc(doc(db, "ride_requests", activeRide.id), {
        status: "arrived",
        arrivedAt: serverTimestamp()
      });
    }
    if (navigator.vibrate) navigator.vibrate(100);
  };

  const handleStartRide = async () => {
    setRideState('in_progress');
    if (activeRide?.id && activeRide?.isReal) {
      await updateDoc(doc(db, "ride_requests", activeRide.id), {
        status: "in_progress",
        startedAt: serverTimestamp()
      });
    }
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  };

  const handleCompleteRide = async () => {
    setIsGeneratingPayment(true);
    setRideState('completed');
    
    // Generate the Direct-to-Driver QR Payment Link
    try {
      const response = await fetch("/api/rides/create-trip-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideId: activeRide?.id || "sim_123",
          driverId: user?.uid,
          amount: activeRide?.fareEstimate || 38.50
        })
      });
      
      const data = await response.json();
      if (data.url) {
        setPaymentUrl(data.url);
      }
    } catch (err) {
      console.error("Payment generation failed:", err);
    } finally {
      setIsGeneratingPayment(false);
    }

    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  };

  const handleClosePayment = () => {
    setRideState('review');
    setPaymentUrl(null);
  };

  return (
    <div className="flex-1 bg-[#0D0D0F] text-white overflow-hidden relative flex flex-col font-sans -mx-4 -mt-6 min-h-0"> {/* Full bleed container */}
      
      {activeTab === 'home' && (
      <>
      {/* Simulation Trigger (Dev Only) */}
      <button 
        onClick={simulateIncomingRide}
        className="absolute top-2 left-1/2 -translate-x-1/2 z-[100] bg-purple-600 text-xs px-3 py-1 rounded-full font-bold opacity-50 hover:opacity-100"
      >
        Simulate Ride
      </button>

      {/* 1. Map Layer (Background) */}
      <div className="absolute inset-0 z-0 h-full w-full">
        <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <SetupMapControls isOnline={isOnline} />
          {/* Switched to Voyager theme for much better visibility and clarity */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
          />
          {isOnline && <Marker position={mapCenter} icon={driverIcon} />}
        </MapContainer>
        
        {/* Lighter, softer gradient overlays to preserve map visibility */}
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-[#0D0D0F]/40 to-transparent pointer-events-none z-[5]"></div>
        <div className="absolute bottom-0 left-0 right-0 h-56 bg-gradient-to-t from-[#0D0D0F]/40 to-transparent pointer-events-none z-[5]"></div>
      </div>

      {/* Floating Map Controls & SOS */}
      <div className="absolute top-[32%] right-4 z-40 flex flex-col items-end gap-3">
        <button 
          onClick={() => setIsEmergencyVisible(!isEmergencyVisible)}
          className="w-10 h-10 bg-[#1A1A1E]/90 backdrop-blur-md border border-[#2C2C30] rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        >
          <Zap className={cn("w-4 h-4", isEmergencyVisible ? "text-[#FF3B30]" : "text-[#A0A0A8]")} />
        </button>

        <AnimatePresence>
          {isEmergencyVisible && (
            <motion.div 
              initial={{ opacity: 0, x: 20, height: 0, overflow: 'hidden' }}
              animate={{ opacity: 1, x: 0, height: 'auto', overflow: 'visible' }}
              exit={{ opacity: 0, x: 20, height: 0, overflow: 'hidden' }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-end"
            >
              <button 
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate([100, 30, 100, 30, 500]);
                  alert("EMERGENCY SOS: Dispatch has been alerted to your high-accuracy location. Recorded audio and video ingestion starting...");
                }}
                className="w-12 h-12 bg-[#FF3B30] rounded-full flex items-center justify-center shadow-[0_4px_20px_rgba(255,59,48,0.4)] active:scale-95 transition-transform border border-red-400/20"
              >
                <AlertCircle className="w-6 h-6 text-white" />
              </button>
              <div className="mt-1.5 px-2 py-0.5 bg-[#FF3B30]/10 backdrop-blur-md border border-red-500/20 rounded-full shadow-sm mb-2">
                <span className="text-[8px] font-black uppercase text-[#FF3B30] tracking-widest leading-none">SOS</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button 
          onClick={() => setMapCenter([53.6458, -1.7850])}
          className="w-12 h-12 bg-[#1A1A1E]/80 backdrop-blur-md border border-[#2C2C30] rounded-full flex items-center justify-center text-white shadow-xl active:scale-95 transition-transform"
        >
          <Target className="w-5 h-5 text-[#A0A0A8]" />
        </button>
      </div>

      {/* 2. Top UI: Privacy Drawer (Earning Bar & Gamification) */}
      <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
        
        {/* Status Header (Sticky) */}
        <div className="absolute top-12 left-4 right-4 z-40 flex items-center justify-between pointer-events-none">
          <div className="bg-[#1A1A1E]/95 backdrop-blur-md pl-4 pr-2 py-2 flex items-center gap-2 rounded-full border border-[#2C2C30] shadow-lg pointer-events-auto">
            <button 
              onClick={() => setActiveTab('earnings')}
              className="flex items-center gap-3 active:scale-95 transition-transform outline-none"
            >
              {isOnline ? (
                <span className="w-2 h-2 rounded-full bg-[#00D26A] animate-pulse shadow-[0_0_5px_#00D26A]"></span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-[#FF3B30]"></span>
              )}
              <span className="text-white font-black leading-none tracking-tight">
                 {isEarningsVisible ? '£142.60' : '••••••'}
              </span>
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsEarningsVisible(!isEarningsVisible);
              }}
              className="p-1.5 text-[#A0A0A8] hover:text-white hover:bg-white/10 rounded-full transition-colors outline-none"
            >
              {isEarningsVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          
          <button 
            onClick={() => setActiveTab('menu')} 
            className="w-10 h-10 bg-[#1A1A1E]/95 backdrop-blur-md rounded-full border border-[#2C2C30] text-white flex items-center justify-center shadow-lg pointer-events-auto active:scale-95 transition-transform"
          >
            <MenuIcon className="w-5 h-5" />
          </button>
        </div>

      </div>

      <div className="flex-1 pointer-events-none"></div>

      {/* Screen 7: Payment QR Handshake (z-[60]) */}
      <AnimatePresence>
        {rideState === 'completed' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-[#0D0D0F]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 pointer-events-auto"
          >
            <div className="w-full max-w-sm bg-[#1A1A1E] border border-[#2C2C30] rounded-[2.5rem] p-8 text-center shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-[#00D26A] to-emerald-500"></div>
              
              <h2 className="text-[13px] font-black text-[#A0A0A8] mb-1 tracking-[0.2em] uppercase">Total Fare</h2>
              <h1 className="text-[52px] leading-tight font-black text-white mb-8">£{activeRide?.fareEstimate?.toFixed(2) || '38.50'}</h1>
              
              <div className="relative mb-8 bg-white p-4 rounded-3xl inline-block shadow-[0_0_50px_rgba(255,255,255,0.05)] border-4 border-white/10 min-w-[212px] min-h-[212px]">
                {isGeneratingPayment || !paymentUrl ? (
                  <div className="w-[180px] h-[180px] flex flex-col items-center justify-center gap-4">
                    <div className="w-10 h-10 border-4 border-[#00D26A] border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-[10px] font-black text-[#0D0D0F] uppercase tracking-widest">
                      {isGeneratingPayment ? "Securing QR..." : "Finalizing..."}
                    </p>
                  </div>
                ) : (
                  <div className="relative group">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(paymentUrl)}`}
                      alt="Payment QR"
                      className="w-[180px] h-[180px] rounded-lg"
                      referrerPolicy="no-referrer"
                      loading="eager"
                      onError={(e) => {
                         // Fallback UI or retry if QR fails
                         (e.target as HTMLImageElement).src = `https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=${encodeURIComponent(paymentUrl)}`;
                      }}
                    />
                    <div className="absolute inset-0 border-2 border-emerald-500/20 rounded-lg pointer-events-none"></div>
                  </div>
                )}
              </div>

              <div className="space-y-4 mb-10">
                <p className="text-sm text-white font-bold px-4">
                  "Please scan to pay directly to my account."
                </p>
                <div className="flex items-center justify-center gap-2 text-[10px] font-black text-[#A0A0A8] uppercase tracking-widest bg-[#252529] md:w-max mx-auto px-3 py-1.5 rounded-full border border-[#333338]">
                  <Zap className="w-3 h-3 text-emerald-500 fill-emerald-500" />
                  Stripe Direct Handshake
                </div>
              </div>

              <button 
                onClick={handleClosePayment}
                className="w-full h-12 bg-[#00D26A] text-[#0D0D0F] rounded-2xl font-black text-sm shadow-[0_4px_25px_rgba(0,210,106,0.3)] active:scale-95 transition-transform"
              >
                PAYMENT RECEIVED
              </button>
              
              <button 
                onClick={() => setRideState('idle')}
                className="mt-6 text-xs font-bold text-[#6B6B73] uppercase tracking-widest hover:text-white transition-colors"
              >
                Skip / Cash Received
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screen 3: Incoming Ride Request Overlay (z-50) */}
      <AnimatePresence>
        {rideState === 'incoming' && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute bottom-0 left-0 right-0 z-50 flex flex-col justify-end px-3 pb-[calc(4rem+env(safe-area-inset-bottom)+0.25rem)] pointer-events-none"
          >
            {/* Same content as before */}
            <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-3xl p-3 shadow-2xl relative overflow-hidden pointer-events-auto flex flex-col w-full">
              
              {/* Highlight header */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#00D26A] to-transparent shrink-0"></div>

              <div className="flex items-center justify-between mb-4 shrink-0">
                <div>
                  <h2 className="text-base font-black text-white px-1 tracking-tight flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-[#FF3B30] rounded-full animate-pulse shadow-[0_0_8px_#FF3B30]"></span>
                    NEW RIDE REQUEST
                  </h2>
                </div>
                
                {/* Circular Timer Ring */}
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="24" cy="24" r="22" className="stroke-[#2C2C30] fill-none" strokeWidth="4" />
                    <motion.circle 
                      cx="24" cy="24" r="22" 
                      className={cn("fill-none", incomingTimer > 5 ? "stroke-[#00D26A]" : "stroke-[#FF3B30]")}
                      strokeWidth="4" 
                      strokeDasharray="138" 
                      strokeLinecap="round"
                      initial={{ strokeDashoffset: 0 }}
                      animate={{ strokeDashoffset: 138 - (138 * (incomingTimer / 15)) }}
                      transition={{ duration: 1, ease: 'linear' }}
                    />
                  </svg>
                  <span className="absolute text-xs font-black text-white">{incomingTimer}s</span>
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto scrollbar-hide -mx-2 px-2 pb-2">
                {/* Fare Section */}
                <div className="bg-[#252529] rounded-xl p-3 mb-3 relative overflow-hidden group/fare cursor-pointer" onClick={() => setShowFareBreakdown(!showFareBreakdown)}>
                  <div className="flex justify-between items-end mb-1">
                    <h1 className="text-3xl leading-[1] font-black text-white w-full">£{activeRide?.fareEstimate?.toFixed(2) || '38.50'}</h1>
                    <span className="bg-[#FF9500]/20 text-[#FF9500] border border-[#FF9500]/30 px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider whitespace-nowrap">🔥 {activeRide?.surgeMultiplier || '1.4'}x</span>
                  </div>
                  <p className="text-[#00D26A] text-[12px] font-bold mt-1">You earn: £{((activeRide?.fareEstimate || 38.50) * (1 - fareConfig.commissionRate)).toFixed(2)}</p>

                  {/* Collapsible Breakdown */}
                  <AnimatePresence>
                    {showFareBreakdown && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-[#333338] mt-3 pt-3 flex flex-col gap-1.5"
                      >
                        <div className="flex justify-between text-xs text-[#A0A0A8]"><span>Base:</span><span>£{fareConfig.baseFare.toFixed(2)}</span></div>
                        <div className="flex justify-between text-xs text-[#A0A0A8]"><span>Distance ({activeRide?.distanceMiles?.toFixed(1) || '22'}mi):</span><span>£{((activeRide?.distanceMiles || 22) * fareConfig.distanceRate).toFixed(2)}</span></div>
                        <div className="flex justify-between text-xs text-[#A0A0A8]"><span>Time (~{activeRide?.durationMinutes || 45}m):</span><span>£---</span></div>
                        <div className="flex justify-between text-xs text-[#FF9500]"><span>Surge:</span><span>+£{((activeRide?.fareEstimate || 38.50) - (activeRide?.baseCalc || 30)).toFixed(2)}</span></div>
                        <div className="flex justify-between text-[11px] font-bold text-[#FF3B30] mt-1 p-1 bg-[#FF3B30]/10 rounded border border-[#FF3B30]/20">
                          <span>Commission ({(fareConfig.commissionRate * 100).toFixed(0)}%):</span><span>-£{((activeRide?.fareEstimate || 38.50) * fareConfig.commissionRate).toFixed(2)}</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  {!showFareBreakdown && (
                    <div className="w-full text-center mt-1.5 group-hover/fare:bg-white/5 py-0.5 rounded transition-colors">
                      <ChevronDown className="w-4 h-4 text-[#6B6B73] mx-auto" />
                    </div>
                  )}
                </div>

                {/* Rider Details */}
                <div className="border-t border-[#2C2C30] pt-4 pb-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-800 text-base border border-white">
                      {(activeRide?.name || "S")[0]}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-white leading-tight">{activeRide?.name || "Sarah T."}</h3>
                      <p className="text-xs text-[#FF9500] font-bold">⭐ 4.7 <span className="text-[#A0A0A8] font-normal">(124 trips)</span></p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    {isLoaded && activeRide?.pickupLat && activeRide?.dropoffLat && (
                      <div className="w-full h-[120px] rounded-xl overflow-hidden relative border border-[#2C2C30] shrink-0">
                        <div className="absolute inset-0 pointer-events-none z-10 rounded-xl ring-1 ring-inset ring-white/10" />
                        <GoogleMap
                          mapContainerStyle={{ width: '100%', height: '100%' }}
                          center={{
                            lat: (activeRide.pickupLat + activeRide.dropoffLat) / 2,
                            lng: (activeRide.pickupLng + activeRide.dropoffLng) / 2,
                          }}
                          zoom={11}
                          options={{
                            disableDefaultUI: true,
                            keyboardShortcuts: false,
                            mapId: "a1b2c3d4e5f6g7h8",
                          }}
                        >
                          {activeRide.pickupLat && (
                            <MarkerF position={{ lat: activeRide.pickupLat, lng: activeRide.pickupLng }} label="P" />
                          )}
                          {activeRide.dropoffLat && (
                            <MarkerF position={{ lat: activeRide.dropoffLat, lng: activeRide.dropoffLng }} label="D" />
                          )}
                          {(activeRide.stops || []).map((s: any, i: number) => s.coords && (
                            <React.Fragment key={i}>
                              <MarkerF position={s.coords} label={`${i+1}`} />
                            </React.Fragment>
                          ))}
                        </GoogleMap>
                      </div>
                    )}

                    <div className="relative pl-5 space-y-3 pb-1">
                      {/* Route Line indicator */}
                      <div className="absolute left-2 top-1.5 bottom-1.5 w-[3px] bg-[#2C2C30] rounded-full"></div>
                      
                      <div className="relative">
                        <div className="absolute w-3.5 h-3.5 rounded-full bg-[#00D26A] border-2 border-[#1A1A1E] -left-[23.5px] top-0.5 z-10"></div>
                        <p className="text-[10px] font-black uppercase text-[#00D26A] tracking-wider leading-none mb-0.5">Pickup</p>
                        <p className="text-[13px] font-bold text-white leading-tight line-clamp-2">{activeRide?.pickupAddress || "12 Elm Street, SE15"}</p>
                        <p className="text-[12px] text-white font-bold mt-0.5">3 min • 1.2 miles</p>
                      </div>

                      <div className="relative">
                        <div className="absolute w-3.5 h-3.5 bg-[#FF9500] border-2 border-[#1A1A1E] -left-[23.5px] top-0.5 z-10"></div>
                        <p className="text-[10px] font-black uppercase text-[#FF9500] tracking-wider leading-none mb-0.5">Drop-off</p>
                        <p className="text-[13px] font-bold text-white leading-tight line-clamp-2">{activeRide?.dropoffAddress || "Bristol Temple Meads"}</p>
                        <p className="text-[12px] text-white font-bold mt-0.5">~{activeRide?.durationMinutes || 45} min • {activeRide?.distanceMiles?.toFixed(1) || 22} miles</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5 mt-3 shrink-0 relative z-20">
                <button 
                  onClick={handleAcceptRide}
                  className="w-full h-12 bg-[#00D26A] text-[#0D0D0F] rounded-xl font-black text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] shadow-[0_4px_20px_rgba(0,210,106,0.2)] transition-transform"
                >
                  <Check className="w-5 h-5 stroke-[3]" /> ACCEPT
                </button>
                <button 
                  onClick={handleDeclineRide}
                  className="w-full py-2 text-xs font-bold text-[#A0A0A8] uppercase tracking-wider hover:text-white transition-colors"
                >
                  Decline
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screen 4 & 5 & 6: Active Ride States (z-40) */}
      <AnimatePresence>
        {(rideState === 'en_route_pickup' || rideState === 'waiting' || rideState === 'in_progress') && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute bottom-0 left-0 right-0 z-40 bg-[#1A1A1E] rounded-t-3xl border-t border-[#2C2C30] p-4 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] pointer-events-auto"
          >
            {rideState === 'en_route_pickup' && (
              <>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-[10px] font-black uppercase text-[#A0A0A8] tracking-widest mb-1">Picking up {activeRide?.name || "Sarah T."}</p>
                    <p className="text-xl font-black text-white">3 min <span className="text-sm font-bold text-[#6B6B73] ml-1">· 1.2 mi</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#00D26A] font-bold">£{activeRide?.fareEstimate?.toFixed(2) || '38.50'}</p>
                  </div>
                </div>
                <div className="flex justify-center mt-2">
                  <button 
                    onClick={handleArrived}
                    className="w-[80%] h-11 bg-[#FF9500] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-orange-950/20"
                  >
                    <MapPin className="w-4 h-4" /> ARRIVED AT PICKUP
                  </button>
                </div>
              </>
            )}

            {rideState === 'waiting' && (
              <>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-[10px] font-black uppercase text-[#FF9500] tracking-widest mb-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Waiting for Rider</p>
                    <p className="text-xl font-black text-white px-0.5">2:34</p>
                    <p className="text-xs text-[#A0A0A8] font-bold mt-0.5">Free cancel in: 2:26</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#00D26A] font-bold">£{activeRide?.fareEstimate?.toFixed(2) || '38.50'}</p>
                  </div>
                </div>
                <div className="flex justify-center mt-2">
                  <button 
                    onClick={handleStartRide}
                    className="w-[80%] h-11 bg-[#00D26A] text-[#0D0D0F] rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-emerald-950/20"
                  >
                    <Zap className="w-4 h-4 fill-[#0D0D0F]" /> START TRIP
                  </button>
                </div>
              </>
            )}

            {rideState === 'in_progress' && (
              <>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-[10px] font-black uppercase text-[#00D26A] tracking-widest mb-1 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#00D26A] animate-pulse"></span> Trip in Progress
                    </p>
                    <p className="text-xl font-black text-white truncate max-w-[200px]">{activeRide?.dropoffAddress?.split(',')[0] || "Bristol"} <span className="text-sm font-bold text-[#6B6B73] ml-1">· {activeRide?.durationMinutes || 38} min left</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#00D26A] font-bold">£{activeRide?.fareEstimate?.toFixed(2) || '38.50'}</p>
                  </div>
                </div>
                <div className="flex justify-center mt-2">
                  <button 
                    onClick={handleCompleteRide}
                    className="w-[80%] h-11 bg-[#FF3B30] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-red-950/30"
                  >
                    <Check className="w-4 h-4 stroke-[3]" /> COMPLETE TRIP
                  </button>
                </div>
              </>
            )}

            {/* Cancel fallback */}
            {(rideState === 'en_route_pickup' || rideState === 'waiting') && (
              <button onClick={handleDeclineRide} className="w-full py-4 text-xs font-bold text-[#A0A0A8] uppercase tracking-wide hover:text-[#FF3B30] transition-colors mt-1">
                {rideState === 'waiting' ? 'Cancel (Free in 2:26)' : 'Cancel Ride'}
              </button>
            )}
            
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screen 7: Trip Completed / Review (z-50) */}
      <AnimatePresence>
        {rideState === 'review' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 z-50 bg-[#0D0D0F]/95 backdrop-blur-xl flex flex-col justify-center p-4 pointer-events-auto"
          >
            <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-3xl p-6 shadow-2xl relative overflow-hidden text-center max-h-[90vh] overflow-y-auto w-full">
              
              <div className="w-16 h-16 bg-[#00D26A]/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#00D26A]/30">
                <Check className="w-8 h-8 text-[#00D26A] stroke-[3]" />
              </div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight mb-6">Trip Complete</h2>
              
              <div className="mb-8">
                <motion.h1 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", damping: 15 }}
                  className="text-[56px] leading-[1] font-black text-white tracking-tighter"
                >
                  £{activeRide?.fareEstimate?.toFixed(2) || '38.50'}
                </motion.h1>
                <div className="mt-4 bg-[#00D26A]/10 border border-[#00D26A]/20 py-2.5 px-4 rounded-xl inline-block">
                  <p className="text-[10px] font-black uppercase text-[#00D26A] tracking-wider mb-0.5">You Earned</p>
                  <p className="text-2xl font-black text-[#00D26A]">£{((activeRide?.fareEstimate || 38.50) * (1 - fareConfig.commissionRate)).toFixed(2)}</p>
                </div>
              </div>

              <div className="bg-[#252529] rounded-2xl p-4 text-left mb-6">
                <p className="text-[10px] font-black uppercase text-[#A0A0A8] tracking-widest mb-3 border-b border-[#333338] pb-2">Fare Breakdown</p>
                <div className="space-y-1.5 mb-3">
                  <div className="flex justify-between text-xs text-[#A0A0A8]"><span>Base fare:</span><span className="text-white">£{fareConfig.baseFare.toFixed(2)}</span></div>
                  <div className="flex justify-between text-xs text-[#A0A0A8]"><span>Distance ({activeRide?.distanceMiles?.toFixed(1) || '22'}mi):</span><span className="text-white">£{((activeRide?.distanceMiles || 22) * fareConfig.distanceRate).toFixed(2)}</span></div>
                  <div className="flex justify-between text-xs text-[#A0A0A8]"><span>Time (~{activeRide?.durationMinutes || 45}min):</span><span className="text-white">£---</span></div>
                  <div className="flex justify-between text-xs text-[#FF9500]"><span>Surge ({activeRide?.surgeMultiplier || '1.4'}x):</span><span className="font-bold">+£{((activeRide?.fareEstimate || 38.50) - (activeRide?.baseCalc || 30)).toFixed(2)}</span></div>
                </div>
                <div className="border-t border-[#333338] pt-2 mb-2 flex justify-between text-sm font-bold text-white">
                  <span>Total fare:</span><span>£{activeRide?.fareEstimate?.toFixed(2) || '38.50'}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-[#FF3B30] p-1.5 bg-[#FF3B30]/10 rounded border border-[#FF3B30]/20 mb-3">
                  <span>Commission ({(fareConfig.commissionRate * 100).toFixed(0)}%):</span><span>-£{((activeRide?.fareEstimate || 38.50) * fareConfig.commissionRate).toFixed(2)}</span>
                </div>
                <div className="border-t border-[#333338] pt-2 flex justify-between text-[15px] font-black text-[#00D26A]">
                  <span>YOUR EARNINGS:</span><span>£{((activeRide?.fareEstimate || 38.50) * (1 - fareConfig.commissionRate)).toFixed(2)}</span>
                </div>
              </div>

              {/* Passenger Rating Block */}
              <div className="bg-[#1A1A1E] rounded-2xl p-5 mb-6 border border-[#2C2C30] text-center shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#FF9500] to-[#FFCC00]"></div>
                <h3 className="text-[13px] font-black uppercase text-white tracking-widest mb-4">Rate Passenger</h3>
                
                <div className="flex justify-center gap-2 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setPassengerRating(star)}
                      className="p-1.5 focus:outline-none active:scale-90 transition-transform"
                    >
                      <Star 
                        className={cn(
                          "w-10 h-10 transition-colors drop-shadow-sm", 
                          passengerRating >= star 
                             ? "fill-[#FF9500] text-[#FF9500]" 
                             : "text-[#333338] fill-transparent"
                        )} 
                      />
                    </button>
                  ))}
                </div>
                
                <AnimatePresence>
                  {passengerRating < 5 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      className="overflow-hidden"
                    >
                      <textarea
                        value={ratingComment}
                        onChange={(e) => setRatingComment(e.target.value)}
                        placeholder="Please provide details about your rating (Required)"
                        className="w-full bg-[#0D0D0F] border border-[#333338] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FF9500] transition-colors resize-none placeholder:text-[#6B6B73]"
                        rows={3}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button 
                onClick={() => {
                  setRideState('idle');
                  setIsOnline(true);
                  setPassengerRating(5);
                  setRatingComment("");
                  setActiveRide(null);
                }}
                disabled={passengerRating < 5 && ratingComment.trim() === ""}
                className="disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed w-full h-12 bg-white text-[#0D0D0F] rounded-2xl font-black text-sm flex items-center justify-center gap-2 uppercase tracking-widest active:scale-[0.98] transition-all shadow-xl shadow-white/5"
              >
                DONE — BACK TO MAP
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Bottom UI: Details and Call to Action */}
      <div className={cn("relative z-20 w-full px-4 pb-24 flex flex-col gap-3 transition-opacity", rideState !== 'idle' ? "opacity-0 pointer-events-none" : "opacity-100")}>
        
        {/* Primary Action Button moved to Menu - only map controls or status might remain here if needed */}
      </div>
      </>
      )}

      {/* Render Other Tabs */}
      {activeTab === 'earnings' && <DriverEarnings fareConfig={fareConfig} />}
      {activeTab === 'inbox' && <DriverInbox />}
      {activeTab === 'menu' && (
        <DriverMenu 
          onNavigate={(tab) => setActiveTab(tab as any)} 
          commissionRate={fareConfig.commissionRate}
          isOnline={isOnline}
          onToggleOnline={handleToggleOnline}
        />
      )}
      <AnimatePresence>
         {activeTab === 'documents' && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute inset-0 z-50">
               <DriverDocuments onBack={() => setActiveTab('menu')} />
            </motion.div>
         )}
      </AnimatePresence>

      {/* Bottom Status Widget (Sticky Floating above global nav) */}
      {rideState === 'idle' && (
        <div className="fixed bottom-[80px] left-0 right-0 px-4 z-50 pointer-events-none flex flex-col items-center">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "w-full max-w-sm h-7 px-4 rounded-xl flex items-center justify-between border backdrop-blur-md transition-all pointer-events-auto shadow-lg",
              isOnline 
                ? "bg-[#064e3b]/80 border-emerald-500/30 shadow-emerald-900/20" 
                : "bg-[#1A1A1E]/90 border-[#2C2C30]"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-[#00D26A] animate-pulse" : "bg-[#6B6B73]")} />
              <span className={cn("text-[8px] font-black uppercase tracking-widest", isOnline ? "text-white" : "text-[#6B6B73]")}>
                {isOnline ? "Waiting for Jobs" : "Offline"}
              </span>
            </div>
            <span className={cn("text-[7px]", isOnline ? "font-black text-[#00D26A] drop-shadow-[0_0_2px_rgba(0,210,106,1)] brightness-150" : "font-bold text-[#6B6B73]")}>
              {isOnline ? "ACTIVE" : "STANDBY"}
            </span>
          </motion.div>
        </div>
      )}

    </div>
  );
}

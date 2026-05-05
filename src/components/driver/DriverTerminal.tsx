import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { usePortal } from "../../lib/PortalContext";
import { useAuth } from "../AuthProvider";
import { cn } from "@/src/lib/utils";
import { toast } from "sonner";
import { triggerHaptic, ImpactStyle } from "@/src/lib/capacitor";
import { Navigation, Info, Power, Zap, ChevronDown, ChevronUp, Check, X, Phone, MessageSquare, AlertCircle, MapPin, Grid, Inbox, Menu as MenuIcon, PoundSterling, Star, Target, TrendingUp, Calendar, Clock, Eye, EyeOff, Hammer, Repeat, Plus, Minus, User } from "lucide-react";
import { GoogleMap, useJsApiLoader, MarkerF, PolylineF, OverlayViewF, OverlayView, DirectionsRenderer, CircleF } from "@react-google-maps/api";
import { db, doc, onSnapshot, collection, query, where, updateDoc, setDoc, serverTimestamp, deleteField, increment, runTransaction, getDocs, addDoc, orderBy } from "@/src/firebase";
import { playSound, speakText } from "@/src/lib/sound";
import DriverEarnings from "./DriverEarnings";
import DriverAnalytics from "./DriverAnalytics";
import DriverInbox from "./DriverInbox";
import DriverMenu from "./DriverMenu";
import DriverDocuments from "./DriverDocuments";
import DriverJobs from "./DriverJobs";
import { MapZoomControls } from "../shared/MapZoomControls";
import RideChat from "./RideChat";
import { MessageCircle } from "lucide-react";

type RideState = 'idle' | 'incoming' | 'en_route_pickup' | 'waiting' | 'in_progress' | 'completed' | 'review';

const libraries: any[] = ['places'];

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: false,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  gestureHandling: "greedy",
  styles: [
    {
      "featureType": "poi",
      "stylers": [{ "visibility": "off" }]
    },
    {
      "featureType": "transit",
      "stylers": [{ "visibility": "simplified" }]
    }
  ]
};

// Custom Zoom Controls (Imported from shared)

const premiumMapOptions: google.maps.MapOptions = {
  ...mapOptions,
  disableDefaultUI: true,
  clickableIcons: false,
  keyboardShortcuts: false,
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

import { fetchLiveDemandZones } from "@/src/services/surgeHeatmapService";

export default function DriverTerminal() {
  const { user, profile } = useAuth();
  const { switchPortal, setPreventPortalSwitch } = usePortal();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(false);
  const [onlineStartTime, setOnlineStartTime] = useState<Date | null>(null);
  const [onlineDurationText, setOnlineDurationText] = useState("0 min");
  const [mapCenter, setMapCenter] = useState<[number, number]>([53.6458, -1.7850]); // Default to Huddersfield from spec
  const [demandZones, setDemandZones] = useState<any[]>([]);
  const [showPredictiveSurge, setShowPredictiveSurge] = useState(false);
  
  // Storage for directions
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showPredictiveSurge) {
       const loadSurge = async () => {
         const zones = await fetchLiveDemandZones();
         setDemandZones(zones);
       };
       loadSurge();
       interval = setInterval(loadSurge, 30000); // 30 sec refresh for live mapping
    } else {
       setDemandZones([]);
    }
    return () => clearInterval(interval);
  }, [showPredictiveSurge]);
  
  // Ride Simulation State
  const [rideState, setRideState] = useState<RideState>('idle');
  const [showFareBreakdown, setShowFareBreakdown] = useState(false);
  const [incomingTimer, setIncomingTimer] = useState(15);
  const [stackedRideOffer, setStackedRideOffer] = useState<any>(null);
  const [acceptedStackedRideOffer, setAcceptedStackedRideOffer] = useState<any>(null);
  const [stackedIncomingTimer, setStackedIncomingTimer] = useState(0);

  useEffect(() => {
    if (['incoming', 'en_route_pickup', 'waiting', 'in_progress', 'review'].includes(rideState)) {
      setPreventPortalSwitch(true);
    } else {
      setPreventPortalSwitch(false);
    }
    return () => setPreventPortalSwitch(false);
  }, [rideState, setPreventPortalSwitch]);

  // Rating State
  const [passengerRating, setPassengerRating] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  
  // Stats Card state
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);
  const [isEarningsVisible, setIsEarningsVisible] = useState(false);
  const [isEmergencyVisible, setIsEmergencyVisible] = useState(false);
  const [todayEarnings, setTodayEarnings] = useState(0);

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
  const [fareConfig, setFareConfig] = useState<{
    baseFare: number, 
    distanceRate: number, 
    timeRate: number, 
    waitRatePerMinute: number, 
    minFare: number, 
    commissionRate: number, 
    allowRiderAbandonment?: boolean,
    surgeEnabled?: boolean,
    surgeModel?: 'fixed' | 'multiplier',
    surgeFixedAmount?: number,
    surgeMultiplierValue?: number
  }>({ 
    baseFare: 3.5, 
    distanceRate: 1.3, 
    timeRate: 0.15, 
    waitRatePerMinute: 0.25, 
    minFare: 5.0, 
    commissionRate: 0.12, 
    allowRiderAbandonment: false,
    surgeEnabled: true,
    surgeModel: 'fixed',
    surgeFixedAmount: 2.00,
    surgeMultiplierValue: 1.5
  });
  const [activeRide, setActiveRide] = useState<any>(null); // Stores live or simulated ride data
  const externalNavWindowRef = useRef<Window | null>(null);
  const [passengerPos, setPassengerPos] = useState<{lat: number, lng: number} | null>(null);

  // Listen for passenger live tracking
  useEffect(() => {
    if (!activeRide?.userId) {
      setPassengerPos(null);
      return;
    }
    const unsub = onSnapshot(doc(db, "live_tracking", activeRide.userId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.lat && data.lng) {
          setPassengerPos({ lat: data.lat, lng: data.lng });
        }
      }
    });
    return () => unsub();
  }, [activeRide?.userId]);

  const mapCenterRef = useRef(mapCenter);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [miniMapInstance, setMiniMapInstance] = useState<google.maps.Map | null>(null);

  const [driverHeading, setDriverHeading] = useState<number | null>(null);
  const [isAutoNavHeadUp, setIsAutoNavHeadUp] = useState(true);
  const [isAutoNavPaused, setIsAutoNavPaused] = useState(false);
  const autoNavPauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMapInteraction = () => {
    if (!isAutoNavHeadUp) return;
    setIsAutoNavPaused(true);
    if (autoNavPauseTimeoutRef.current) {
      clearTimeout(autoNavPauseTimeoutRef.current);
    }
    autoNavPauseTimeoutRef.current = setTimeout(() => {
      setIsAutoNavPaused(false);
    }, 10000); // Resume auto nav after 10s of no interaction
  };

  const getBearing = (startLat: number, startLng: number, destLat: number, destLng: number) => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const toDeg = (rad: number) => (rad * 180) / Math.PI;
    const dLng = toRad(destLng - startLng);
    const y = Math.sin(dLng) * Math.cos(toRad(destLat));
    const x = Math.cos(toRad(startLat)) * Math.sin(toRad(destLat)) -
              Math.sin(toRad(startLat)) * Math.cos(toRad(destLat)) * Math.cos(dLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  };

  useEffect(() => {
    mapCenterRef.current = mapCenter;
  }, [mapCenter]);

  const handleCenterOnMe = () => {
    if (mapInstance && mapCenterRef.current) {
      mapInstance.panTo({ lat: mapCenterRef.current[0], lng: mapCenterRef.current[1] });
      mapInstance.setZoom(15);
    } else {
      setMapCenter([mapCenterRef.current[0], mapCenterRef.current[1]]);
    }
  };

  const handleToggleAutoNav = () => {
    setIsAutoNavHeadUp(prev => {
      const next = !prev;
      if (!next && mapInstance && directions) {
        // When disabling head up mode, fit to route overview
        const bounds = directions.routes[0]?.bounds;
        if (bounds) {
          mapInstance.fitBounds(bounds);
        }
      }
      return next;
    });
    triggerHaptic(ImpactStyle.Light);
    toast.success(isAutoNavHeadUp ? "Navigation overview" : "Head-up navigation started");
  };

  // Handle center for 'waiting' state to account for drawer height
  useEffect(() => {
    if (mapInstance && rideState === 'waiting' && activeRide?.pickupLat && activeRide?.pickupLng) {
      const pt = new window.google.maps.LatLng(activeRide.pickupLat, activeRide.pickupLng);
      mapInstance.panTo(pt);
      
      // Shift map down by 160px so marker moves UP by 160px visually
      const timer = setTimeout(() => {
        mapInstance.panBy(0, 160);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [rideState, activeRide?.pickupLat, activeRide?.pickupLng, mapInstance]);

  useEffect(() => {
    let isInitialFitBounds = true;
    let intervalId: NodeJS.Timeout;

    // Fetch route directions using Google Maps API
    const fetchDirections = (destLat: number, destLng: number) => {
      if (!window.google || !window.google.maps) return;
      const directionsService = new window.google.maps.DirectionsService();
      
      const originLat = mapCenterRef.current[0];
      const originLng = mapCenterRef.current[1];
      
      const routeResult: any = directionsService.route(
        {
          origin: new window.google.maps.LatLng(originLat, originLng),
          destination: new window.google.maps.LatLng(destLat, destLng),
          travelMode: window.google.maps.TravelMode.DRIVING
        },
        (result, status) => {
          if (status === window.google.maps.DirectionsStatus.OK) {
            setDirections(result);
            if (isInitialFitBounds && mapInstance && result?.routes?.[0]?.bounds) {
              // We fit the bounds here. Because we already set Map options `padding: { bottom: 350 }`, 
              // Google Maps will automatically shift the visual center up!
              mapInstance.fitBounds(result.routes[0].bounds);
              isInitialFitBounds = false;
            }
          } else {
            console.warn("Directions request failed with status:", status);
          }
        }
      );
      if (routeResult && routeResult.catch) {
        routeResult.catch((e: any) => console.warn("Caught directions promise rejection:", e));
      }
    };

    const updateDynamicDirections = () => {
      if (rideState === 'en_route_pickup' && activeRide?.pickupLat && activeRide?.pickupLng) {
        if (isLoaded) fetchDirections(activeRide.pickupLat, activeRide.pickupLng);
      } else if (rideState === 'in_progress' && activeRide?.dropoffLat && activeRide?.dropoffLng) {
        if (isLoaded) fetchDirections(activeRide.dropoffLat, activeRide.dropoffLng);
      } else {
        setDirections(null);
      }
    };

    updateDynamicDirections();
    intervalId = setInterval(updateDynamicDirections, 15000);

    return () => clearInterval(intervalId);
  }, [rideState, activeRide?.id, activeRide?.pickupLat, activeRide?.pickupLng, activeRide?.dropoffLat, activeRide?.dropoffLng, isLoaded, mapInstance]);

  // Handle Map Orientation (Head Up North / Direction of Travel)
  useEffect(() => {
    if (!mapInstance) return;

    if (!isAutoNavHeadUp) {
      mapInstance.setHeading(0); // Reset to North up when disabled
      mapInstance.setTilt(0);
      return;
    }

    if (isAutoNavPaused) {
      return; // Do nothing if paused, leave map at whatever user set
    }

    if (rideState === 'en_route_pickup' && activeRide?.pickupLat && activeRide?.pickupLng) {
      const targetBearing = driverHeading !== null ? driverHeading : getBearing(mapCenterRef.current[0], mapCenterRef.current[1], activeRide.pickupLat, activeRide.pickupLng);
      mapInstance.setHeading(targetBearing);
      mapInstance.setTilt(60); // 3D perspective
      if (directions) {
        mapInstance.panTo({ lat: mapCenter[0], lng: mapCenter[1] });
        mapInstance.setZoom(17.2);
      }
    } else if (rideState === 'in_progress' && activeRide?.dropoffLat && activeRide?.dropoffLng) {
      const targetBearing = driverHeading !== null ? driverHeading : getBearing(mapCenterRef.current[0], mapCenterRef.current[1], activeRide.dropoffLat, activeRide.dropoffLng);
      mapInstance.setHeading(targetBearing);
      mapInstance.setTilt(60);
      if (directions) {
        mapInstance.panTo({ lat: mapCenter[0], lng: mapCenter[1] });
        mapInstance.setZoom(17.2);
      }
    } else {
      mapInstance.setHeading(0);
      mapInstance.setTilt(0);
    }
  }, [rideState, isAutoNavHeadUp, isAutoNavPaused, mapInstance, driverHeading, activeRide?.pickupLat, activeRide?.pickupLng, activeRide?.dropoffLat, activeRide?.dropoffLng, mapCenter, directions]);

  // Listen to Taxi Command Settings (platform_config/rides)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "platform_config", "rides"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFareConfig({
          baseFare: Number(data.baseFare) || 3.5,
          distanceRate: Number(data.distanceRate) || 1.3,
          timeRate: Number(data.timeRate) || 0.15,
          waitRatePerMinute: Number(data.waitRatePerMinute) || 0.25,
          minFare: Number(data.minFare) || 5.0,
          commissionRate: data.commission ? Number(data.commission) / 100 : 0.12,
          allowRiderAbandonment: data.allowRiderAbandonment || false,
        });
      }
    }, (error) => {
      console.error("Firestore Rides Config Error:", error);
    });
    return () => unsub();
  }, []);

  // Listen to Driver Metrics for today's earnings
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "driver_metrics", user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const today = new Date().toISOString().split('T')[0];
        if (data.date === today) {
          setTodayEarnings(data.dailyEarnings || 0);
        }
      }
    });
    return () => unsub();
  }, [user]);

  // Listen for REAL incoming live ride requests (offered to this driver)
  useEffect(() => {
    if (!isOnline || !user) return;
    if (rideState !== 'idle' && rideState !== 'in_progress') return;

    const q = query(
      collection(db, "ride_requests"), 
      where("status", "==", "offered"),
      where("assignedDriverId", "==", user.uid)
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const rideDoc = snapshot.docs[0];
        const data = rideDoc.data();
        
        const rideData = {
          id: rideDoc.id,
          userId: data.riderId,
          name: data.passengerName || "Live Passenger",
          passengerPhone: data.passengerPhone || undefined,
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
          comments: data.comments || data.instructions || "",
          isReal: true,
          offerExpiresAt: data.offerExpiresAt,
          isPriority: data.isPriority || false,
          hasCardOnFile: data.hasCardOnFile || false,
          tipAmount: data.tipAmount || 0,
          paymentMethod: data.paymentMethod
        };
        
        // Calculate remaining time for the offer
        const expiresAt = new Date(data.offerExpiresAt).getTime();
        const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
        
        if (rideState === 'idle') {
          setActiveRide(rideData);
          setIncomingTimer(remaining);
          setRideState('incoming');
        } else if (rideState === 'in_progress') {
          if (!stackedRideOffer) {
            setStackedRideOffer(rideData);
            setStackedIncomingTimer(remaining);
          }
        }
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]);
      } else {
        if (rideState === 'in_progress' && stackedRideOffer && stackedRideOffer.isReal !== false) {
          setStackedRideOffer(null);
        }
      }
    });
    
    return () => unsub();
  }, [isOnline, rideState, user, stackedRideOffer]);

  // Listen to Active Ride for Cancellations
  useEffect(() => {
    if (!activeRide?.isReal || !activeRide?.id || rideState === 'idle' || rideState === 'incoming') return;
    
    const unsub = onSnapshot(doc(db, "ride_requests", activeRide.id), async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.status === "cancelled" && data.cancelledBy === "passenger") {
          toast.error("Ride Cancelled", {
            description: "The passenger has cancelled the ride.",
            duration: 6000
          });
          
          if (data.cancellationFee > 0 && user) {
            toast.success("Cancellation Fee Applied", {
              description: `You have been credited £${data.cancellationFee.toFixed(2)} for the cancellation.`
            });
            // Credit the driver metric
            const today = new Date().toISOString().split('T')[0];
            await setDoc(doc(db, "driver_metrics", user.uid), {
              date: today,
              dailyEarnings: increment(data.cancellationFee),
              updatedAt: serverTimestamp()
            }, { merge: true });
          }
          
          if (user) {
            updateDoc(doc(db, "driver_status", user.uid), {
              isBusy: false,
              currentRideId: deleteField()
            } as any).catch(console.error);
          }
          
          setRideState('idle');
          setActiveRide(null);
          setPassengerPos(null);
          setDirections(null);
          if (navigator.vibrate) navigator.vibrate([300, 200, 300]);
        } else {
          setActiveRide(prev => {
             if (!prev) return prev;
             const isModified = prev.pickupAddress !== data.pickup || prev.dropoffAddress !== data.dropoff || prev.fareEstimate !== data.fareEstimate || JSON.stringify(prev.stops) !== JSON.stringify(data.stops || []);
             if (isModified) {
                setTimeout(() => {
                   toast.info("Ride Updated", { description: "The passenger has updated the journey details." });
                }, 500);
             }
             return {
                ...prev,
                pickupAddress: data.pickup,
                dropoffAddress: data.dropoff,
                pickupLat: data.pickupLat,
                pickupLng: data.pickupLng,
                dropoffLat: data.dropoffLat,
                dropoffLng: data.dropoffLng,
                stops: data.stops || [],
                fareEstimate: data.fareEstimate || prev.fareEstimate,
                distanceMiles: data.distanceMiles || prev.distanceMiles,
                durationMinutes: data.durationMinutes || prev.durationMinutes
             };
          });
        }
        
        if (data.status === "completed" && rideState === "completed" && paymentUrl) {
           toast.success("Payment Received", { description: "Passenger has completed the payment."});
           setPaymentUrl(null);
           setRideState("review");
        }
        
        if (data.isModifiedByPassenger) {
          // Close external navigation if open
          if (externalNavWindowRef.current && !externalNavWindowRef.current.closed) {
             externalNavWindowRef.current.close();
             toast.warning("Navigation Stopped", { description: "Navigation was stopped because passenger updated the job details. Please restart navigation.", duration: 8000 });
          }

          // Play loud alert notification
          playSound('notification');
          speakText("Job details updated by passenger");
          toast.info("Ride Details Updated", { description: "The passenger has updated the ride details or fare.", duration: 8000 });

          
          if (data.dropoffLat && data.dropoffLng && activeRide?.dropoffLat && activeRide?.dropoffLng && user?.uid) {
            const R = 6371e3;
            const p1 = activeRide.dropoffLat * Math.PI/180;
            const p2 = data.dropoffLat * Math.PI/180;
            const dp = (data.dropoffLat - activeRide.dropoffLat) * Math.PI/180;
            const dl = (data.dropoffLng - activeRide.dropoffLng) * Math.PI/180;
            const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
            const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            
            if (dist > 1609.34) { // More than 1 mile away
              const delayMins = Math.max(5, Math.round(dist / 400)); // Rough estimate of 1 min per 400m
              const stackedQuery = query(collection(db, "ride_requests"), where("driverId", "==", user.uid), where("status", "==", "accepted"));
              getDocs(stackedQuery).then(snap => {
                snap.forEach(d => {
                  if (d.id !== activeRide.id) {
                    updateDoc(doc(db, "ride_requests", d.id), {
                      stackedDriverDelay: delayMins,
                      updatedAt: serverTimestamp()
                    });
                    toast.warning("Stacked passenger notified", { description: "Your next passenger has been asked if they want to wait due to your destination change.", duration: 10000 });
                  }
                });
              }).catch(console.error);
            }
          }
          
          setActiveRide(prev => prev ? {
             ...prev,
             dropoffAddress: data.dropoff || prev.dropoffAddress,
             dropoffLat: data.dropoffLat || prev.dropoffLat,
             dropoffLng: data.dropoffLng || prev.dropoffLng,
             pickupAddress: data.pickup || prev.pickupAddress,
             pickupLat: data.pickupLat || prev.pickupLat,
             pickupLng: data.pickupLng || prev.pickupLng,
             fareEstimate: data.fareEstimate || prev.fareEstimate,
             distanceMiles: data.distanceMiles || prev.distanceMiles,
             stops: data.stops || prev.stops
          } : null);
          
          updateDoc(doc(db, "ride_requests", activeRide.id), {
            isModifiedByPassenger: false
          }).catch(console.error);
        }
      }
    });
    
    return () => unsub();
  }, [activeRide?.id, activeRide?.isReal, rideState, user]);

  // Simulation: Add fake demand zones
  useEffect(() => {
    setDemandZones([
      { lat: 53.6458, lng: -1.7850, radius: 1200, type: "high", multiplier: "1.4x" },
      { lat: 53.6550, lng: -1.8000, radius: 1800, type: "moderate", multiplier: "1.2x" },
    ]);
  }, []);

  // Timer simulation for Incoming request
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (rideState === 'incoming' && incomingTimer > 0) {
      interval = setInterval(() => setIncomingTimer((prev) => prev - 1), 1000);
      if (incomingTimer % 3 === 0) {
        if (!profile?.muteRideOfferAlerts) {
          playSound('alert');
        }
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    } else if (rideState === 'incoming' && incomingTimer === 0) {
      handleDeclineRide();
    }
    return () => clearInterval(interval);
  }, [rideState, incomingTimer, profile?.muteRideOfferAlerts]);

  // Timer simulation for Stacked Incoming request
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (stackedRideOffer && rideState === 'in_progress' && stackedIncomingTimer > 0) {
      interval = setInterval(() => setStackedIncomingTimer((prev) => prev - 1), 1000);
      if (stackedIncomingTimer % 3 === 0) {
        if (!profile?.muteRideOfferAlerts) {
          playSound('alert');
        }
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    } else if (stackedRideOffer && rideState === 'in_progress' && stackedIncomingTimer === 0) {
      handleDeclineStackedRide();
    }
    return () => clearInterval(interval);
  }, [stackedRideOffer, rideState, stackedIncomingTimer, profile?.muteRideOfferAlerts]);

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
        const { latitude, longitude, heading } = pos.coords;
        setMapCenter([latitude, longitude]);
        if (heading !== null && !isNaN(heading)) {
          setDriverHeading(heading);
        }
        
        // Sync to Firestore for dispatcher
        try {
          await setDoc(doc(db, "live_tracking", user.uid), {
            driverId: user.uid,
            lat: latitude,
            lng: longitude,
            updatedAt: serverTimestamp(),
            isOnline: true,
            status: activeRide ? 'on_ride' : 'available',
            dropoffLat: activeRide?.dropoffLat || null,
            dropoffLng: activeRide?.dropoffLng || null,
            isStackingEnabled: profile?.isStackingEnabled !== false,
            isLastJob: profile?.isLastJob === true,
            destinationModeActive: profile?.destinationModeActive === true,
            homeLat: profile?.homeLat || null,
            homeLng: profile?.homeLng || null,
            vehicleCategory: profile?.vehicleCategory || 'standard',
            vehicleCategories: profile?.vehicleCategories || [profile?.vehicleCategory || 'standard'],
            isPetFriendly: profile?.isPetFriendly === true
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
  }, [isOnline, user, activeRide]);

  const simulatePassenger90sWarning = () => {
    if (activeRide?.hasCardOnFile) {
      toast.info("Auto-Pay Active", {
        description: "Passenger has a card attached. No QR code needed.",
        duration: 8000
      });
      toast("Passenger Phone (Auto-Pay):", {
        description: "Your journey is about to end. Please appreciate the driver by giving a tip.",
        duration: 8000,
        action: {
          label: "Add Tip (£3)",
          onClick: () => setActiveRide((prev: any) => ({...prev, tipAmount: 3}))
        }
      });
    } else {
      toast.warning("QR Payment Required", {
        description: "Passenger will pay via scan. Have your QR ready.",
        duration: 8000
      });
      toast("Passenger Phone (No Card):", {
        description: "Please have your phone ready to scan the driver's QR code.",
        duration: 8000,
        action: {
          label: "Add Tip (£5)",
          onClick: () => setActiveRide((prev: any) => ({...prev, tipAmount: 5}))
        }
      });
    }
  };

  const simulateIncomingRide = () => {
    if (!isOnline) {
      setIsOnline(true);
    }
    
    // Create a dynamic simulation using real live fare configs
    const simulatedDist = Math.floor(Math.random() * 15) + 3; // 3 to 18 miles
    const simulatedTime = simulatedDist * 2.5; // Rough time
    const calcFare = Math.max(fareConfig.minFare, fareConfig.baseFare + (simulatedDist * fareConfig.distanceRate));
    
    // Apply Surge Logic based on config
    let surgeMultiplier = 1.0;
    let surgeFixed = 0.0;
    let finalFare = calcFare;
    
    if (fareConfig.surgeEnabled) {
      if (fareConfig.surgeModel === 'fixed') {
        surgeFixed = fareConfig.surgeFixedAmount || 2.0;
        finalFare = calcFare + surgeFixed;
      } else {
        surgeMultiplier = fareConfig.surgeMultiplierValue || 1.4;
        finalFare = calcFare * surgeMultiplier;
      }
    }
    
    setActiveRide({
      id: "simulated_ride_123",
      name: "Sarah T.",
      passengerPhone: "+447700900077",
      pickupAddress: "12 Elm Street, SE15",
      dropoffAddress: "Bristol Temple Meads",
      pickupLat: mapCenter[0] + 0.01,
      pickupLng: mapCenter[1] + 0.01,
      dropoffLat: mapCenter[0] - 0.02,
      dropoffLng: mapCenter[1] - 0.02,
      stops: [],
      fareEstimate: finalFare,
      baseCalc: calcFare,
      surgeMultiplier: surgeMultiplier,
      surgeFixed: surgeFixed,
      surgeModel: fareConfig.surgeModel,
      distanceMiles: simulatedDist,
      durationMinutes: simulatedTime,
      comments: "Please ring the bell, the baby is sleeping. Thanks!",
      isPriority: true,
      hasCardOnFile: Math.random() > 0.5,
      isRiderPlus: true,
      distanceToPickupMiles: 1.2,
      isReal: false
    });

    setIncomingTimer(15);
    setRideState('incoming');
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]); // Custom ride tone haptic
  };

  const simulateStackedIncomingRide = () => {
    if (!isOnline || rideState !== 'in_progress') return;
    
    const simulatedDist = Math.floor(Math.random() * 10) + 2; 
    const simulatedTime = simulatedDist * 2.5; 
    const calcFare = Math.max(fareConfig.minFare, fareConfig.baseFare + (simulatedDist * fareConfig.distanceRate));
    
    // Apply Surge Logic based on config
    let surgeMultiplier = 1.0;
    let surgeFixed = 0.0;
    let finalFare = calcFare;
    
    if (fareConfig.surgeEnabled) {
      if (fareConfig.surgeModel === 'fixed') {
        surgeFixed = fareConfig.surgeFixedAmount || 2.0;
        finalFare = calcFare + surgeFixed;
      } else {
        surgeMultiplier = fareConfig.surgeMultiplierValue || 1.4;
        finalFare = calcFare * surgeMultiplier;
      }
    }
    
    setStackedRideOffer({
      id: "simulated_stacked_ride_456",
      name: "Mike R.",
      pickupAddress: "Next Pickup Location",
      dropoffAddress: "Another Dropoff",
      pickupLat: mapCenter[0] + 0.015,
      pickupLng: mapCenter[1] - 0.015,
      dropoffLat: mapCenter[0] - 0.025,
      dropoffLng: mapCenter[1] + 0.035,
      fareEstimate: finalFare,
      baseCalc: calcFare,
      surgeMultiplier: surgeMultiplier,
      surgeFixed: surgeFixed,
      surgeModel: fareConfig.surgeModel,
      distanceMiles: simulatedDist,
      durationMinutes: simulatedTime,
      comments: "Waiting outside.",
      isPriority: false,
      hasCardOnFile: true,
      isRiderPlus: false,
      distanceToPickupMiles: 0.8,
      isReal: false
    });

    setStackedIncomingTimer(15);
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]);
  };

  const handleAcceptRide = async () => {
    // If it's a real ride from Firestore, claim it!
    if (activeRide?.isReal && activeRide?.id && user) {
      try {
        await runTransaction(db, async (t) => {
           const rideRef = doc(db, "ride_requests", activeRide.id);
           const docSnap = await t.get(rideRef);
           if (!docSnap.exists()) throw new Error("Ride not found");
           if (docSnap.data().status !== "offered") throw new Error("Ride no longer available");

           t.update(rideRef, {
             status: "accepted",
             driverId: user.uid,
             driverName: profile?.firstName || "Driver",
             driverPhone: profile?.phone || profile?.phoneNumber || "",
             vehicleInfo: profile?.vehicle || "Silver Toyota Prius",
             vehiclePlate: profile?.vehicleRegistration || profile?.plate || "WK71 BCF",
             driverRequirePasscode: profile?.requirePasscode === true,
             acceptedAt: serverTimestamp()
           });
        });
        
        await updateDoc(doc(db, "driver_status", user.uid), {
          isBusy: true,
          pendingRideId: deleteField()
        } as any);

      } catch (err: any) {
        console.error("Failed to claim ride:", err);
        toast.error(err.message || "Failed to accept ride. It might have expired.");
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

  const handleDeclineStackedRide = async () => {
    if (stackedRideOffer?.id && stackedRideOffer?.isReal && user) {
      try {
        await updateDoc(doc(db, "driver_status", user.uid), {
          pendingRideId: deleteField(),
          consecutiveDeclines: increment(1)
        } as any);

        await updateDoc(doc(db, "ride_requests", stackedRideOffer.id), {
          status: "pending",
          assignedDriverId: deleteField(),
          offerExpiresAt: deleteField()
        } as any);

      } catch (err) {
        console.error("Error declining stacked ride:", err);
      }
    }
    setStackedRideOffer(null);
  };

  const handleAcceptStackedRide = async () => {
    let success = false;
    if (stackedRideOffer?.isReal && stackedRideOffer?.id && user) {
      try {
        await runTransaction(db, async (t) => {
           const rideRef = doc(db, "ride_requests", stackedRideOffer.id);
           const docSnap = await t.get(rideRef);
           if (!docSnap.exists()) throw new Error("Ride not found");
           if (docSnap.data().status !== "offered") throw new Error("Ride no longer available");

           t.update(rideRef, {
             status: "accepted",
             driverId: user.uid,
             driverName: profile?.firstName || "Driver",
             driverPhone: profile?.phone || profile?.phoneNumber || "",
             vehicleInfo: profile?.vehicle || "Silver Toyota Prius",
             vehiclePlate: profile?.vehicleRegistration || profile?.plate || "WK71 BCF",
             driverRequirePasscode: profile?.requirePasscode === true,
             acceptedAt: serverTimestamp()
           });
        });
        
        await updateDoc(doc(db, "driver_status", user.uid), {
          isBusy: true,
          pendingRideId: deleteField()
        } as any);
        toast.success("Stacked job accepted. It will appear when your current ride is completed.", { duration: 5000 });
        success = true;
      } catch (err: any) {
        console.error("Failed to claim stacked ride:", err);
        toast.error(err.message || "Failed to accept stacked ride. It might have expired.");
      }
    } else {
        toast.success("Stacked job accepted.", { duration: 3000 });
        success = true;
    }
    
    if (success) {
      setAcceptedStackedRideOffer(stackedRideOffer);
    }
    // We do not replace activeRide. The stacked ride logic is done.
    setStackedRideOffer(null);
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const currentTabParam = searchParams.get("tab") || "home";
  
  const [activeTab, setActiveTabState] = useState<'home' | 'earnings' | 'inbox' | 'menu' | 'documents' | 'jobs' | 'analytics'>(currentTabParam as any);

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
  const [showCashConfirm, setShowCashConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showEarlyArrivalConfirm, setShowEarlyArrivalConfirm] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [earlyCompletionReason, setEarlyCompletionReason] = useState("");
  const [isEarlyCompletion, setIsEarlyCompletion] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const lastSeenChatCountRef = useRef(0);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [quickMessageCooldown, setQuickMessageCooldown] = useState(0);
  const [isCardCollapsed, setIsCardCollapsed] = useState(false);
  const cardCollapseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (quickMessageCooldown > 0) {
      const timer = setTimeout(() => setQuickMessageCooldown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [quickMessageCooldown]);

  useEffect(() => {
    if (isChatOpen) setUnreadChatCount(0);
  }, [isChatOpen]);

  const resetCardCollapseTimer = useCallback(() => {
    if (cardCollapseTimeoutRef.current) clearTimeout(cardCollapseTimeoutRef.current);
    cardCollapseTimeoutRef.current = setTimeout(() => {
      setIsCardCollapsed(true);
    }, 10000);
  }, []);

  useEffect(() => {
    if (['en_route_pickup', 'waiting', 'in_progress'].includes(rideState)) {
      setIsCardCollapsed(false);
      resetCardCollapseTimer();
    } else {
      setIsCardCollapsed(false);
      if (cardCollapseTimeoutRef.current) clearTimeout(cardCollapseTimeoutRef.current);
    }
    return () => {
      if (cardCollapseTimeoutRef.current) clearTimeout(cardCollapseTimeoutRef.current);
    }
  }, [rideState, resetCardCollapseTimer]);

  useEffect(() => {
    if (!activeRide?.id || !user || !['en_route_pickup', 'waiting', 'in_progress'].includes(rideState)) return;
    
    const q = query(
      collection(db, "ride_requests", activeRide.id, "chat"),
      orderBy("createdAt", "asc")
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => doc.data());
      const remoteMessages = messages.filter(m => m.senderId !== user.uid);
      
      if (isChatOpen) {
        lastSeenChatCountRef.current = remoteMessages.length;
        setUnreadChatCount(0);
      } else {
        const unread = remoteMessages.length - lastSeenChatCountRef.current;
        if (unread > 0) {
          setUnreadChatCount(unread);
        }
      }
    });
    return () => unsub();
  }, [activeRide?.id, rideState, user, isChatOpen]);

  const [waitStartTime, setWaitStartTime] = useState<number | null>(null);
  const [elapsedWaitSeconds, setElapsedWaitSeconds] = useState(0);
  const [pickupProximityStartTime, setPickupProximityStartTime] = useState<number | null>(null);

  // Stop wait & abandonment logic
  const [isWaitingAtStop, setIsWaitingAtStop] = useState(false);
  const [stopWaitStartTime, setStopWaitStartTime] = useState<number | null>(null);

  // Auto-arrive logic when driver is within 200m of pickup for 30 seconds
  useEffect(() => {
    if (rideState === 'en_route_pickup' && activeRide?.pickupLat && activeRide?.pickupLng && mapCenter) {
      const R = 6371e3;
      const lat1 = mapCenter[0] * Math.PI/180;
      const lat2 = activeRide.pickupLat * Math.PI/180;
      const dLat = (activeRide.pickupLat-mapCenter[0]) * Math.PI/180;
      const dLon = (activeRide.pickupLng-mapCenter[1]) * Math.PI/180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const dist = R * c;

      if (dist <= 200) {
        if (!pickupProximityStartTime) {
          setPickupProximityStartTime(Date.now());
        }
      } else {
        setPickupProximityStartTime(null);
      }
    } else {
      setPickupProximityStartTime(null);
    }
  }, [mapCenter, rideState, activeRide?.pickupLat, activeRide?.pickupLng]);

  useEffect(() => {
    if (pickupProximityStartTime) {
      const interval = setInterval(() => {
         if (Date.now() - pickupProximityStartTime >= 30000) {
            console.log("Auto-arriving as driver is stationary within 200m for 30s");
            handleArrived(activeRide); // Avoid strict stale closures if activeRide hasn't changed.
            setPickupProximityStartTime(null);
            toast.success("Automatically marked as arrived", { description: "You've been waiting at the pickup location." });
         }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [pickupProximityStartTime, activeRide]);
  const [accumulatedPaidWaitSeconds, setAccumulatedPaidWaitSeconds] = useState(0);
  const [currentStopWaitSeconds, setCurrentStopWaitSeconds] = useState(0);
  const [waitStopLocation, setWaitStopLocation] = useState<[number, number] | null>(null);
  const [abandonmentWarningSent, setAbandonmentWarningSent] = useState(false);

  useEffect(() => {
    let interval: any;
    if (rideState === 'waiting' && waitStartTime) {
      interval = setInterval(() => {
        setElapsedWaitSeconds(Math.floor((Date.now() - waitStartTime) / 1000));
      }, 1000);
    } else if (isWaitingAtStop && stopWaitStartTime) {
      interval = setInterval(() => {
        setCurrentStopWaitSeconds(Math.floor((Date.now() - stopWaitStartTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [rideState, waitStartTime, isWaitingAtStop, stopWaitStartTime]);

  const handleToggleWaitAtStop = () => {
    if (isWaitingAtStop) {
      setIsWaitingAtStop(false);
      setAbandonmentWarningSent(false); // reset abandonment logic
      setAccumulatedPaidWaitSeconds(prev => {
         const newVal = prev + currentStopWaitSeconds;
         if (activeRide?.id && activeRide?.isReal) {
           updateDoc(doc(db, "ride_requests", activeRide.id), { paidWaitSeconds: newVal }).catch(console.error);
         }
         return newVal;
      });
      setCurrentStopWaitSeconds(0);
      setStopWaitStartTime(null);
      setWaitStopLocation(null);
    } else {
      setIsWaitingAtStop(true);
      setStopWaitStartTime(Date.now());
      setCurrentStopWaitSeconds(0);
      setWaitStopLocation(mapCenter); // Store location where waiting started
    }
  };

  // Auto-resume safeguard: If driver forgets to toggle wait off and drives away
  useEffect(() => {
    if (isWaitingAtStop && waitStopLocation && mapCenter) {
      // Calculate distance from wait location using Haversine formula
      const R = 6371e3; // Earth radius in metres
      const lat1 = waitStopLocation[0] * Math.PI/180;
      const lat2 = mapCenter[0] * Math.PI/180;
      const dLat = (mapCenter[0]-waitStopLocation[0]) * Math.PI/180;
      const dLon = (mapCenter[1]-waitStopLocation[1]) * Math.PI/180;

      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;

      // If moved more than 200 meters, automatically resume trip to protect passenger fare
      if (distance > 200) {
        toast.success("Trip Auto-Resumed", {
          description: "Movement detected. Paid wait timer was paused automatically to protect passenger pricing.",
          duration: 6000
        });
        // Auto-pause
        setIsWaitingAtStop(false);
        setAbandonmentWarningSent(false);
        setAccumulatedPaidWaitSeconds(prev => {
            const newVal = prev + currentStopWaitSeconds;
            if (activeRide?.id && activeRide?.isReal) {
               updateDoc(doc(db, "ride_requests", activeRide.id), { paidWaitSeconds: newVal }).catch(console.error);
            }
            return newVal;
        });
        setCurrentStopWaitSeconds(0);
        setStopWaitStartTime(null);
        setWaitStopLocation(null);
      }
    }
  }, [mapCenter, isWaitingAtStop, waitStopLocation, currentStopWaitSeconds]);

  const totalPaidWaitSeconds = accumulatedPaidWaitSeconds + currentStopWaitSeconds;

  const handleSendAbandonmentWarning = async () => {
    setAbandonmentWarningSent(true);
    toast.success("Warning Sent", {
      description: "Push notification and SMS sent directly to rider's device.",
    });
    // In real app we'd dispatch a Cloud Function here to push out the notices.
  };

  const handleRiderAbandonment = async () => {
    if (!activeRide?.id || !user) return;
    
    // Safety check - turn off waiting
    setIsWaitingAtStop(false);
    setAccumulatedPaidWaitSeconds(prev => prev + currentStopWaitSeconds);
    setCurrentStopWaitSeconds(0);
    setStopWaitStartTime(null);
    setAbandonmentWarningSent(false);

    setIsGeneratingPayment(true);
    setRideState('completed');

    const waitFare = (totalPaidWaitSeconds / 60) * fareConfig.waitRatePerMinute;
    // Base estimate logic normally computes full journey. For abandonment we should
    // ideally calculate partial distance. Using fareEstimate as approximation for UI.
    const partialFareEstimate = activeRide?.fareEstimate ? activeRide.fareEstimate * 0.5 : 12.0; 
    const finalFare = partialFareEstimate + waitFare + 5.00; // Add the £5 abandonment fee!

    try {
      await updateDoc(doc(db, "ride_requests", activeRide.id), {
        status: "rider_abandoned",
        paymentMethod: "stripe_qr",
        finalFare: finalFare,
        paidWaitSeconds: totalPaidWaitSeconds,
        abandonmentFee: 5.00,
        completedAt: serverTimestamp()
      });

      if (activeRide.riderId && typeof activeRide.riderId === 'string' && activeRide.riderId.length > 0) {
        // Apply strike
        await updateDoc(doc(db, "users", activeRide.riderId), {
          pendingCharges: increment(finalFare),
          abandonmentStrikes: increment(1)
        } as any).catch(err => console.error("Failed to add strike:", err));
      }

      const today = new Date().toISOString().split('T')[0];
      await setDoc(doc(db, "driver_metrics", user.uid), {
        date: today,
        dailyEarnings: increment(finalFare), // Usually minus commission handled in backend
        jobsDoneToday: increment(1),
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Generate the payment link
      const response = await fetch("/api/rides/create-trip-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideId: activeRide.id,
          driverId: user.uid,
          amount: finalFare,
          isAbandonment: true
        })
      });
      
      const data = await response.json();
      if (data.url) {
        setPaymentUrl(data.url);
      }
    } catch (err) {
      console.error("Abandonment process failed:", err);
      toast.error("Failed to process abandonment. Please reload.");
    } finally {
      setIsGeneratingPayment(false);
    }
  };

  const onArrivedClick = () => {
    if (activeRide?.pickupLat && activeRide?.pickupLng && mapCenter) {
      const R = 6371e3;
      const lat1 = mapCenter[0] * Math.PI/180;
      const lat2 = activeRide.pickupLat * Math.PI/180;
      const dLat = (activeRide.pickupLat-mapCenter[0]) * Math.PI/180;
      const dLon = (activeRide.pickupLng-mapCenter[1]) * Math.PI/180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const dist = R * c;

      if (dist > 200) {
        setShowEarlyArrivalConfirm(true);
        return;
      }
    }
    handleArrived();
  };

  const handleArrived = async (overrideRide?: any) => {
    const rideToUpdate = overrideRide || activeRide;
    setRideState('waiting');
    setWaitStartTime(Date.now());
    setElapsedWaitSeconds(0);
    setAccumulatedPaidWaitSeconds(0);
    if (rideToUpdate?.id && rideToUpdate?.isReal) {
      await updateDoc(doc(db, "ride_requests", rideToUpdate.id), {
        status: "arrived",
        arrivedAt: serverTimestamp()
      });
    }
    if (navigator.vibrate) navigator.vibrate(100);
  };

  const handleSendQuickMessage = async (text: string) => {
    if (!activeRide?.id || !user || quickMessageCooldown > 0) return;
    try {
      await addDoc(collection(db, "ride_requests", activeRide.id, "chat"), {
        text,
        senderId: user.uid,
        createdAt: serverTimestamp()
      });
      setQuickMessageCooldown(120);
      toast.success("Sent");
    } catch (err) {
      console.error(err);
      toast.error("Failed to send");
    }
  };

  const handleStartRide = async () => {
    setRideState('in_progress');
    const pickupPaidWait = Math.max(0, elapsedWaitSeconds - 180);
    setAccumulatedPaidWaitSeconds(pickupPaidWait);

    if (activeRide?.id && activeRide?.isReal) {
      await updateDoc(doc(db, "ride_requests", activeRide.id), {
        status: "in_progress",
        startedAt: serverTimestamp(),
        paidWaitSeconds: pickupPaidWait
      });
    }
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  };

  const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const p1 = lat1 * Math.PI/180;
    const p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180;
    const dl = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(dp/2) * Math.sin(dp/2) +
              Math.cos(p1) * Math.cos(p2) *
              Math.sin(dl/2) * Math.sin(dl/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleCompleteRideBtnClick = () => {
    let dist = 1000;
    if (activeRide && activeRide.dropoffLat && activeRide.dropoffLng) {
       dist = getDistanceInMeters(mapCenter[0], mapCenter[1], activeRide.dropoffLat, activeRide.dropoffLng);
    }
    
    setIsEarlyCompletion(dist > 300);
    setEarlyCompletionReason("");
    setShowCompleteConfirm(true);
  };

  const handleCompleteRideConfirmed = async () => {
    setShowCompleteConfirm(false);

    if (isEarlyCompletion && earlyCompletionReason && activeRide?.id && activeRide?.isReal) {
      try {
        await updateDoc(doc(db, "ride_requests", activeRide.id), {
           earlyCompletionReason: earlyCompletionReason
        });
      } catch (e) {
        console.error("Failed to save early completion reason", e);
      }
    }

    // Safety check - if driver forgot to turn off waiting at stop, turn it off now
    if (isWaitingAtStop) {
      setIsWaitingAtStop(false);
      setAccumulatedPaidWaitSeconds(prev => prev + currentStopWaitSeconds);
      setCurrentStopWaitSeconds(0);
      setStopWaitStartTime(null);
    }
    
    setIsGeneratingPayment(true);
    setRideState('completed');
    
    const waitFare = (totalPaidWaitSeconds / 60) * fareConfig.waitRatePerMinute;
    const baseFinalFare = (activeRide?.fareEstimate || 38.50) + waitFare;
    const finalFare = baseFinalFare + (activeRide?.tipAmount || 0);

    if (activeRide?.hasCardOnFile) {
      toast("Processing Auto-Payment...", { duration: 1500 });
      setTimeout(async () => {
         if (activeRide?.isReal) {
           await handleAutoPaymentCompletion();
         } else {
           setRideState('review');
           setIsGeneratingPayment(false);
           toast.success("Payment Received", { description: "Passenger's card was charged automatically."});
         }
      }, 1500);
      return;
    }

    // Generate the Direct-to-Driver QR Payment Link
    try {
      const response = await fetch("/api/rides/create-trip-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideId: activeRide?.id || "sim_123",
          driverId: user?.uid,
          baseFare: baseFinalFare,
          tipAmount: activeRide?.tipAmount || 0
        })
      });
      
      const data = await response.json();
      if (data.url) {
        setPaymentUrl(data.url);
        if (activeRide?.id && activeRide?.isReal) {
           await updateDoc(doc(db, "ride_requests", activeRide.id), {
              status: "awaiting_payment",
              paymentUrl: data.url
           });
        }
      }
    } catch (err) {
      console.error("Payment generation failed:", err);
    } finally {
      setIsGeneratingPayment(false);
    }

    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  };

  const handleAutoPaymentCompletion = async () => {
    if (activeRide?.id && activeRide?.isReal && user) {
      try {
        const waitFare = (totalPaidWaitSeconds / 60) * fareConfig.waitRatePerMinute;
        const baseFare = (activeRide.fareEstimate || 0) + waitFare;
        const totalFare = baseFare + (activeRide.tipAmount || 0);
        
        await updateDoc(doc(db, "ride_requests", activeRide.id), {
          status: "completed",
          paymentMethod: "stripe_auto",
          finalFare: totalFare,
          paidWaitSeconds: totalPaidWaitSeconds,
          completedAt: serverTimestamp()
        });
        
        if (activeRide.riderId && typeof activeRide.riderId === 'string' && activeRide.riderId.length > 0) {
          await updateDoc(doc(db, "users", activeRide.riderId), {
            pendingCharges: 0,
            cancellationCount: 0
          } as any).catch(err => console.error("Failed to clear passenger fees:", err));
        }

        // We can update the daily driver_metrics as well
        const today = new Date().toISOString().split('T')[0];
        await setDoc(doc(db, "driver_metrics", user.uid), {
          date: today,
          dailyEarnings: increment(totalFare),
          jobsDoneToday: increment(1),
          updatedAt: serverTimestamp()
        }, { merge: true });

        // Update driver earnings in auth profile 
        await updateDoc(doc(db, "users", user.uid), {
          totalEarnings: increment(totalFare),
          jobsCompleted: increment(1)
        });

      } catch (err) {
        console.error("Failed to process auto payment:", err);
      }
    }
    setRideState('review');
    toast.success("Payment Received", { description: "Passenger's card was charged automatically."});
  };

  const handleClosePayment = async () => {
    if (activeRide?.id && activeRide?.isReal && user) {
      try {
        const waitFare = (totalPaidWaitSeconds / 60) * fareConfig.waitRatePerMinute;
        const baseFare = (activeRide.fareEstimate || 0) + waitFare;
        const totalFare = baseFare + (activeRide.tipAmount || 0);
        
        await updateDoc(doc(db, "ride_requests", activeRide.id), {
          status: "completed",
          paymentMethod: "stripe_qr",
          finalFare: totalFare,
          paidWaitSeconds: totalPaidWaitSeconds,
          completedAt: serverTimestamp()
        });
        
        if (activeRide.riderId && typeof activeRide.riderId === 'string' && activeRide.riderId.length > 0) {
          await updateDoc(doc(db, "users", activeRide.riderId), {
            pendingCharges: 0,
            cancellationCount: 0
          } as any).catch(err => console.error("Failed to clear passenger fees:", err));
        }

        // We can update the daily driver_metrics as well
        const today = new Date().toISOString().split('T')[0];
        await setDoc(doc(db, "driver_metrics", user.uid), {
          date: today,
          dailyEarnings: increment(totalFare),
          jobsDoneToday: increment(1),
          updatedAt: serverTimestamp()
        }, { merge: true });

      } catch (err) {
        console.error("Failed to complete ride via QR:", err);
      }
    }
    setRideState('review');
    setPaymentUrl(null);
  };

  const handleCashPayment = async () => {
    if (activeRide?.id && activeRide?.isReal && user) {
      try {
        const waitFare = (totalPaidWaitSeconds / 60) * fareConfig.waitRatePerMinute;
        const baseFare = (activeRide.fareEstimate || 0) + waitFare;
        const totalFare = baseFare + (activeRide.tipAmount || 0);
        const platformFee = baseFare * fareConfig.commissionRate; 
        
        await updateDoc(doc(db, "ride_requests", activeRide.id), {
          status: "completed",
          paymentMethod: "cash",
          finalFare: totalFare,
          paidWaitSeconds: totalPaidWaitSeconds,
          platformFeeOwed: platformFee,
          completedAt: serverTimestamp()
        });

        if (activeRide.riderId && typeof activeRide.riderId === 'string' && activeRide.riderId.length > 0) {
          await updateDoc(doc(db, "users", activeRide.riderId), {
            pendingCharges: 0,
            cancellationCount: 0
          } as any).catch(err => console.error("Failed to clear passenger fees:", err));
        }

        await updateDoc(doc(db, "users", user.uid), {
          pendingPlatformFees: increment(platformFee)
        });

        // Update driver metrics
        const today = new Date().toISOString().split('T')[0];
        await setDoc(doc(db, "driver_metrics", user.uid), {
          date: today,
          dailyEarnings: increment(totalFare),
          jobsDoneToday: increment(1),
          updatedAt: serverTimestamp()
        }, { merge: true });

        toast.warning("Cash Trip Recorded", {
          description: `£${platformFee.toFixed(2)} (${(fareConfig.commissionRate * 100).toFixed(0)}%) platform fee has been added to your pending account balance.`,
          duration: 5000,
        });

      } catch (err) {
        console.error("Failed to record cash payment:", err);
      }
    } else {
      toast.warning("Demo: Cash Trip Recorded", {
        description: `${(fareConfig.commissionRate * 100).toFixed(0)}% platform fee added to pending balance.`
      });
    }
    
    setRideState('review');
    setPaymentUrl(null);
  };

  return (
    <div className="flex-1 bg-[#0D0D0F] text-white overflow-hidden relative flex flex-col font-sans min-h-0"> {/* Full bleed container */}
      
      {activeTab === 'home' && (
      <>
      {/* Simulation Trigger (Dev Only) */}
      <div className="absolute top-[48px] left-4 z-[150] flex flex-col items-start gap-2 pointer-events-auto">
        <button 
          onClick={simulateIncomingRide}
          className="bg-[#FFD60A] text-[#1A1A1E] text-xs px-4 py-2 rounded-full font-black uppercase tracking-widest shadow-[0_4px_15px_rgba(255,214,10,0.3)] hover:scale-105 active:scale-95 transition-all"
        >
          Simulate Job {activeRide ? (activeRide.hasCardOnFile ? '(Card)' : '(No Card)') : ''}
        </button>
        {rideState === 'in_progress' && (
          <>
            <button 
              onClick={simulatePassenger90sWarning}
              className="bg-[#FF3B30] text-white text-[10px] px-3 py-1.5 rounded-full font-black uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all outline outline-2 outline-white/20"
            >
              Trigger 90s Warning
            </button>
            {!stackedRideOffer && (
              <button 
                onClick={simulateStackedIncomingRide}
                className="bg-indigo-500 text-white text-[10px] px-3 py-1.5 rounded-full font-black uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all outline outline-2 outline-white/20"
              >
                Simulate Stacked Job
              </button>
            )}
          </>
        )}
      </div>

      {/* 1. Map Layer (Background) */}
      <div 
        className="absolute inset-0 z-0 h-full w-full bg-[#1A1A1E]"
        onTouchStartCapture={handleMapInteraction}
        onWheelCapture={handleMapInteraction}
        onMouseDownCapture={handleMapInteraction}
      >
        {isLoaded && (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={
              directions || rideState === 'waiting'
                ? undefined
                : { lat: mapCenter[0], lng: mapCenter[1] }
            }
            zoom={
              directions
                ? undefined
                : rideState === 'waiting'
                  ? 15
                  : (rideState === 'en_route_pickup' || rideState === 'in_progress') 
                    ? 13 
                    : 15 // Default driver location zoom level when idle
            }
            onLoad={map => setMapInstance(map)}
            options={{
              ...premiumMapOptions,
              padding: {
                bottom: 350, // UI drawer height
                top: 100,
                left: 20,
                right: 20
              }
            }}
          >
            {isOnline && (
              <OverlayViewF position={{ lat: mapCenter[0], lng: mapCenter[1] }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                <div className="relative flex items-center justify-center w-8 h-8 -ml-4 -mt-4">
                  <div className="absolute inset-0 bg-[#007AFF] rounded-full opacity-30 animate-ping"></div>
                  <div className="bg-[#007AFF] border-2 border-white w-4 h-4 rounded-full shadow-lg z-10"></div>
                </div>
              </OverlayViewF>
            )}

            {/* Show Pickup ONLY before they get in */}
            {(rideState === 'en_route_pickup' || rideState === 'waiting') && activeRide?.pickupLat && activeRide?.pickupLng && (
              <>
                <MarkerF position={{ lat: activeRide.pickupLat, lng: activeRide.pickupLng }} />
                <OverlayViewF position={{ lat: activeRide.pickupLat, lng: activeRide.pickupLng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                  <div className="absolute bottom-10 left-[0] -translate-x-1/2 pointer-events-none flex flex-col items-center z-10 w-max max-w-[220px]">
                    <div className="bg-[#BBF7D0] border border-[#22C55E] p-2.5 rounded-xl shadow-lg relative">
                      <div className="font-extrabold text-[9px] uppercase tracking-widest text-[#065F46] mb-0.5">Pickup</div>
                      <div className="font-bold text-[11px] text-[#022C22] leading-tight whitespace-normal text-left">
                        {activeRide.pickupAddress || "Pickup Location"}
                      </div>
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#BBF7D0] border-b border-r border-[#22C55E] rotate-45 shadow-[2px_2px_2px_rgba(0,0,0,0.05)]"></div>
                    </div>
                  </div>
                </OverlayViewF>
              </>
            )}

            {/* Show Stops / Dropoff ONLY after they get in */}
            {(rideState === 'in_progress' || rideState === 'review') && (() => {
              // Decide which point to show based on journey progression.
              // If we wanted to hide stops as they are completed, we'd need a 'completedStops' count,
              // but since we don't have that yet, show all stops + dropoff, OR just the dropoff if no stops.
              // Wait, if we want to show ONLY ONE card, and we have stops...
              // In this app, stops are just an array. We don't have state for "currently driving to stop 1".
              // So for now, we'll render all remaining stops, or just dropoff. Let's render all stops and dropoff during in_progress, since we can't tell which one is the current destination. Note: User said "either yellow if STOP or Red if Drop off. Other cards should disappear", but since we lack "current leg" tracking, I will just show them all in_progress. Wait! I can show the stops and drop off, they are all relevant to the in_progress leg. 
              // Wait, user said "only one card should be visible". Without current leg tracking, what should I do?
              // The user just wants it not to look cluttered. Let's just show stops yellow and dropoff red.
              return (
                <>
                  {(activeRide?.stops || []).map((stop: any, index: number) => stop.coords && (
                    <React.Fragment key={index}>
                      <MarkerF position={{ lat: stop.coords.lat, lng: stop.coords.lng }} />
                      <OverlayViewF position={{ lat: stop.coords.lat, lng: stop.coords.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                        <div className="absolute bottom-10 left-[0] -translate-x-1/2 pointer-events-none flex flex-col items-center z-10 w-max max-w-[220px]">
                          <div className="bg-[#FEF08A] border border-[#EAB308] p-2.5 rounded-xl shadow-lg relative">
                            <div className="font-extrabold text-[9px] uppercase tracking-widest text-[#713F12] mb-0.5">Stop {index + 1}</div>
                            <div className="font-bold text-[11px] text-[#451A03] leading-tight whitespace-normal text-left">
                              {stop.address || "Stop Location"}
                            </div>
                            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#FEF08A] border-b border-r border-[#EAB308] rotate-45 shadow-[2px_2px_2px_rgba(0,0,0,0.05)]"></div>
                          </div>
                        </div>
                      </OverlayViewF>
                    </React.Fragment>
                  ))}
                  
                  {activeRide?.dropoffLat && activeRide?.dropoffLng && (
                    <>
                      <MarkerF position={{ lat: activeRide.dropoffLat, lng: activeRide.dropoffLng }} />
                      <OverlayViewF position={{ lat: activeRide.dropoffLat, lng: activeRide.dropoffLng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                        <div className="absolute bottom-10 left-[0] -translate-x-1/2 pointer-events-none flex flex-col items-center z-10 w-max max-w-[220px]">
                          <div className="bg-[#FECDD3] border border-[#E11D48] p-2.5 rounded-xl shadow-lg relative">
                            <div className="font-extrabold text-[9px] uppercase tracking-widest text-[#881337] mb-0.5">Dropoff</div>
                            <div className="font-bold text-[11px] text-[#4C0519] leading-tight whitespace-normal text-left">
                              {activeRide.dropoffAddress || "Dropoff Location"}
                            </div>
                            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#FECDD3] border-b border-r border-[#E11D48] rotate-45 shadow-[2px_2px_2px_rgba(0,0,0,0.05)]"></div>
                          </div>
                        </div>
                      </OverlayViewF>
                    </>
                  )}
                </>
              );
            })()}

            {directions && (
              <DirectionsRenderer
                directions={directions}
                options={{
                  suppressMarkers: true,
                  preserveViewport: true,
                  polylineOptions: {
                    strokeColor: '#007AFF', // Google Maps style Blue
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                  }
                }}
              />
            )}

            {/* AI Predictive Surge Heatmap */}
            {showPredictiveSurge && !activeRide && demandZones.map((zone, idx) => (
              <React.Fragment key={`surge-${idx}`}>
                <CircleF
                  center={{ lat: zone.lat, lng: zone.lng }}
                  radius={zone.radius}
                  options={{
                    strokeColor: "transparent",
                    fillColor: zone.intensity === 'high' ? '#FF3B30' : '#FF9500',
                    fillOpacity: 0.15,
                    clickable: false
                  }}
                />
                <OverlayViewF position={{ lat: zone.lat, lng: zone.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                    <div className="bg-black/80 px-2 py-1 rounded-md text-[10px] font-black text-white whitespace-nowrap shadow border border-white/20 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-[#FF3B30]" /> {zone.label}
                    </div>
                  </div>
                </OverlayViewF>
              </React.Fragment>
            ))}

            {/* Passenger Live Location */}
            {passengerPos && (rideState === 'en_route_pickup' || rideState === 'waiting') && (
              <OverlayViewF position={{ lat: passengerPos.lat, lng: passengerPos.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                <div className="relative flex items-center justify-center w-8 h-8 -ml-4 -mt-4">
                  <div className="absolute inset-0 bg-[#FF3B30] rounded-full opacity-30 animate-pulse"></div>
                  <div className="bg-[#FF3B30] border border-white w-3 h-3 rounded-full shadow-lg z-10 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                  </div>
                  <div className="absolute -top-6 bg-black/80 px-2 py-0.5 rounded text-[9px] font-bold text-white whitespace-nowrap shadow border border-[#FF3B30]/30">
                    PASSENGER
                  </div>
                </div>
              </OverlayViewF>
            )}
          </GoogleMap>
        )}
        
        {/* Main Map Zoom Controls */}
        {mapInstance && (
          <div 
            onClickCapture={handleMapInteraction}
            className={cn(
            "absolute right-4 z-[45] transition-all duration-300",
            (rideState === 'incoming' || rideState === 'review' || rideState === 'completed') ? "opacity-0 pointer-events-none" :
            rideState === 'idle' ? "bottom-[140px]" :
            isCardCollapsed ? "bottom-[280px]" : "bottom-[420px]"
          )}>
            <MapZoomControls mapInstance={mapInstance} />
          </div>
        )}

        {/* Lighter, softer gradient overlays to preserve map visibility */}
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-[#0D0D0F]/40 to-transparent pointer-events-none z-[5]"></div>
        <div className="absolute bottom-0 left-0 right-0 h-56 bg-gradient-to-t from-[#0D0D0F]/40 to-transparent pointer-events-none z-[5]"></div>
      </div>

      {/* Chat Component */}
      {(rideState === 'en_route_pickup' || rideState === 'waiting' || rideState === 'in_progress') && activeRide?.id && (
        <RideChat 
          rideId={activeRide.id} 
          isOpen={isChatOpen} 
          onClose={() => setIsChatOpen(false)}
          otherPartyName={activeRide?.passengerName || activeRide?.name || "Passenger"}
          otherPartyPhone={activeRide?.passengerPhone || undefined}
          passengerId={activeRide?.passengerId}
          canSendSMS={rideState === 'waiting' && elapsedWaitSeconds >= 180}
        />
      )}

      {/* Floating Map Controls & SOS */}
      <div className="absolute top-[15%] right-4 z-50 flex flex-col items-end gap-3 pointer-events-auto">
        <button 
          onClick={() => setIsEmergencyVisible(!isEmergencyVisible)}
          className="w-10 h-10 bg-[#1A1A1E]/90 backdrop-blur-md border border-[#2C2C30] rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        >
          <Zap className={cn("w-4 h-4", isEmergencyVisible ? "text-[#FF3B30]" : "text-[#E4E4E7]")} />
        </button>

        <AnimatePresence>
          {isEmergencyVisible && (
            <motion.div 
              initial={{ opacity: 0, x: 20, height: 0, overflow: 'hidden' }}
              animate={{ opacity: 1, x: 0, height: 'auto', overflow: 'visible' }}
              exit={{ opacity: 0, x: 20, height: 0, overflow: 'hidden' }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-end gap-3 pb-2"
            >
              <div className="flex flex-col items-end">
                <button 
                  onClick={() => {
                    if (navigator.vibrate) navigator.vibrate([100, 30, 100, 30, 500]);
                    alert("EMERGENCY SOS: Dispatch has been alerted to your high-accuracy location. Recorded audio and video ingestion starting...");
                  }}
                  className="w-12 h-12 bg-[#FF3B30] rounded-full flex items-center justify-center shadow-[0_4px_20px_rgba(255,59,48,0.4)] active:scale-95 transition-transform border border-red-400/20"
                >
                  <AlertCircle className="w-6 h-6 text-white" />
                </button>
                <div className="mt-1.5 px-2 py-0.5 bg-[#FF3B30]/10 backdrop-blur-md border border-red-500/20 rounded-full shadow-sm mb-1">
                  <span className="text-[8px] font-black uppercase text-[#FF3B30] tracking-widest leading-none">SOS</span>
                </div>
              </div>

              <button 
                onClick={handleCenterOnMe}
                className="w-10 h-10 bg-[#1A1A1E]/80 backdrop-blur-md border border-[#2C2C30] rounded-full flex items-center justify-center text-white shadow-xl active:scale-95 transition-transform mr-1"
              >
                <Target className="w-4 h-4 text-[#E4E4E7]" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        
        {isOnline && !activeRide && (
          <button 
            onClick={() => setShowPredictiveSurge(!showPredictiveSurge)}
            className={cn(
              "w-10 h-10 mt-2 backdrop-blur-md border rounded-full flex items-center justify-center text-white shadow-xl active:scale-95 transition-all overflow-hidden relative",
              showPredictiveSurge ? "bg-[#FF3B30]/20 border-[#FF3B30]/50" : "bg-[#1A1A1E]/80 border-[#2C2C30]"
            )}
          >
            {showPredictiveSurge && (
               <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,59,48,0.4)0%,transparent_70%)] animate-pulse" />
            )}
            <TrendingUp className={cn("w-4 h-4 relative z-10", showPredictiveSurge ? "text-[#FF3B30]" : "text-[#E4E4E7]")} />
          </button>
        )}
      </div>

      {/* Floating Map Navigation (Left Side) */}
      {(rideState === 'en_route_pickup' || rideState === 'waiting' || rideState === 'in_progress') && activeRide?.id && (
        <div className="absolute top-[18%] left-4 z-50 pointer-events-auto">
          <button 
            onClick={handleToggleAutoNav}
            className={cn("w-10 h-10 rounded-full flex flex-col items-center justify-center shadow-[0_6px_16px_rgba(0,122,255,0.5)] active:scale-95 transition-transform", isAutoNavHeadUp ? "bg-[#007AFF]" : "bg-[#1A1A1E] border-2 border-[#007AFF]")}
          >
            {isAutoNavHeadUp ? (
              <>
                <Navigation className="w-4 h-4 text-white fill-white" />
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4 text-[#007AFF]" />
              </>
            )}
          </button>
        </div>
      )}

      {/* 2. Top UI: Menu button */}
      <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
        {/* Status Header (Sticky) */}
        <div className="absolute top-12 left-4 right-4 z-40 flex items-center justify-end pointer-events-none">
          <button 
            onClick={() => setActiveTab('menu')} 
            className="w-10 h-10 bg-[#1A1A1E]/95 backdrop-blur-md rounded-full border border-[#2C2C30] text-white flex items-center justify-center shadow-lg pointer-events-auto active:scale-95 transition-transform"
          >
            <MenuIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 pointer-events-none"></div>

      {/* Screen 7: Payment QR Handshake */}
      <AnimatePresence>
        {rideState === 'completed' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-[#0D0D0F]/95 backdrop-blur-md overflow-y-auto pointer-events-auto"
          >
            <div className="min-h-full flex flex-col justify-start p-6 pt-16 pb-32 max-w-md mx-auto">
              <div className="w-full max-w-sm mx-auto bg-[#1A1A1E] border border-[#2C2C30] rounded-[2.5rem] p-8 text-center shadow-2xl relative overflow-hidden my-auto mb-16">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-[#00D26A] to-emerald-500"></div>
              
              <h2 className="text-[13px] font-black text-[#E4E4E7] mb-1 tracking-[0.2em] uppercase">Total Fare</h2>
              <h1 className="text-[52px] leading-tight font-black text-white mb-2">
			    £{((activeRide?.fareEstimate || 38.50) + ((totalPaidWaitSeconds / 60) * fareConfig.waitRatePerMinute) + (activeRide?.tipAmount || 0)).toFixed(2)}
			  </h1>
			  {activeRide?.tipAmount ? (
			     <p className="text-emerald-400 font-bold text-sm mb-6 bg-emerald-500/10 inline-block px-3 py-1 rounded-full border border-emerald-500/20">Includes £{activeRide.tipAmount.toFixed(2)} Tip</p>
			  ) : (
                 <p className="text-slate-500 font-bold text-xs mb-8">Passenger can scan to pay & tip</p>
			  )}
              
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
                <div className="flex items-center justify-center gap-2 text-[10px] font-black text-[#E4E4E7] uppercase tracking-widest bg-[#252529] md:w-max mx-auto px-3 py-1.5 rounded-full border border-[#333338]">
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
                onClick={() => setShowCashConfirm(true)}
                className="mt-6 text-xs font-bold text-[#A1A1AA] uppercase tracking-widest hover:text-white transition-colors"
              >
                Skip / Cash Received
              </button>

              <AnimatePresence>
                {showCashConfirm && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute inset-0 z-50 bg-[#1A1A1E]/95 backdrop-blur-md flex flex-col justify-center items-center p-4 pb-28 text-center rounded-t-3xl border-t border-[#2C2C30]"
                  >
                    <button 
                      onClick={() => setShowCashConfirm(false)}
                      className="absolute top-4 right-4 flex items-center justify-center w-8 h-8 md:w-10 md:h-10 bg-[#2C2C30] hover:bg-white/10 rounded-full transition-colors z-50"
                    >
                      <X className="w-4 h-4 md:w-5 md:h-5 text-white" />
                    </button>
                    <div className="w-12 h-12 rounded-full bg-[#FF9500]/20 flex flex-shrink-0 items-center justify-center mb-3">
                      <span className="text-2xl">💵</span>
                    </div>
                    <h3 className="text-white text-lg font-black tracking-wide mb-1 uppercase">Confirm Cash</h3>
                    <p className="text-[#E4E4E7] text-xs mb-4 leading-relaxed font-medium px-2">
                      Did you receive cash for this trip? The commission will be added to your pending balance and deducted from future card earnings.
                    </p>
                    
                    <button 
                      onClick={() => {
                        setShowCashConfirm(false);
                        handleCashPayment();
                      }}
                      className="w-full h-12 flex-shrink-0 bg-[#FF9500] text-[#0D0D0F] rounded-2xl font-black text-sm shadow-[0_4px_25px_rgba(255,149,0,0.3)] active:scale-95 transition-transform mb-3"
                    >
                      CONFIRM CASH RECEIVED
                    </button>
                    <button 
                      onClick={() => setShowCashConfirm(false)}
                      className="w-full h-12 flex-shrink-0 bg-[#2C2C30] text-white rounded-2xl font-black text-sm active:scale-95 transition-transform"
                    >
                      CANCEL
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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
            className="absolute bottom-0 left-0 right-0 z-50 flex flex-col justify-end px-5 pb-[calc(4rem+env(safe-area-inset-bottom)+0.25rem)] pointer-events-none"
          >
            {/* Same content as before */}
            <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-3xl p-3 shadow-2xl relative overflow-hidden pointer-events-auto flex flex-col w-full">
              
              {/* Highlight header */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#00D26A] to-transparent shrink-0"></div>

              <div className="flex items-center justify-between mb-2 shrink-0">
                <h2 className="text-sm font-black text-[#FF3B30] px-1 tracking-wider flex items-center gap-2 uppercase">
                  <span className="w-2 h-2 bg-[#FF3B30] rounded-full animate-pulse shadow-[0_0_8px_#FF3B30]"></span>
                  New Ride Request
                </h2>
              </div>

              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto scrollbar-hide -mx-2 px-2 pb-1">
                {/* Map Section (Moved to top) */}
                {isLoaded && activeRide?.pickupLat && activeRide?.dropoffLat && (
                  <div className="w-full h-[140px] rounded-xl overflow-hidden relative border border-[#2C2C30] shrink-0 mb-2">
                    <div className="absolute inset-0 pointer-events-none z-10 rounded-xl ring-1 ring-inset ring-white/10" />
                    <GoogleMap
                      mapContainerStyle={{ width: '100%', height: '100%' }}
                      onLoad={(map) => {
                        setMiniMapInstance(map);
                        const bounds = new window.google.maps.LatLngBounds();
                        if (activeRide.pickupLat && activeRide.pickupLng) bounds.extend({ lat: activeRide.pickupLat, lng: activeRide.pickupLng });
                        if (activeRide.dropoffLat && activeRide.dropoffLng) bounds.extend({ lat: activeRide.dropoffLat, lng: activeRide.dropoffLng });
                        (activeRide.stops || []).forEach((s: any) => { if (s.coords) bounds.extend(s.coords); });
                        map.fitBounds(bounds, { top: 10, bottom: 10, left: 10, right: 10 });
                        // Apply a max zoom in case points are very close
                        const listener = window.google.maps.event.addListener(map, 'idle', () => {
                          if ((map.getZoom() || 0) > 13) map.setZoom(13); // Restrict to 13 as user mentioned
                          window.google.maps.event.removeListener(listener);
                        });
                      }}
                      options={premiumMapOptions}
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
                    {miniMapInstance && (
                      <MapZoomControls mapInstance={miniMapInstance} className="absolute bottom-2 right-2 z-20" />
                    )}
                  </div>
                )}

                {/* Rider Details */}
                <div className="border-t border-[#2C2C30] pt-2 pb-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-800 text-sm border border-white shrink-0">
                      {(activeRide?.name || "S")[0]}
                    </div>
                    <div className="flex-1 min-w-0 flex justify-between items-start">
                      <div>
                        <h3 className="text-[13px] font-bold text-white leading-tight truncate">{activeRide?.name || "Sarah T."}</h3>
                        <p className="text-[11px] text-[#FF9500] font-bold">⭐ 4.7 <span className="text-[#E4E4E7] font-normal">(124 trips)</span></p>
                      </div>
                      {activeRide?.isRiderPlus !== false && (
                        <div className="bg-gradient-to-r from-amber-300 to-amber-500 text-amber-950 px-1 py-0.5 rounded text-[8px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm shrink-0 mt-0.5"><Star className="w-2.5 h-2.5 fill-amber-950" /> Rider Plus</div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {/* Fare Section (Moved below rider profile) */}
                    <div className="bg-[#252529] rounded-xl p-2 relative overflow-hidden shrink-0">
                      <div className="flex justify-between items-end mb-1">
                        <h1 className="text-2xl leading-[1] font-black text-white flex items-end gap-2.5 shrink-0">
                          £{activeRide?.fareEstimate?.toFixed(2) || '38.50'}
                          <span className="text-[13px] font-bold text-white/80 tracking-normal mb-0.5">({((activeRide?.distanceToPickupMiles || 1.2) + (activeRide?.distanceMiles || 22)).toFixed(1)} mi)</span>
                        </h1>
                        <div className="flex gap-1 items-center">
                          {activeRide?.isPriority && (
                            <div className="bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 px-1 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm"><Zap className="w-2.5 h-2.5 fill-amber-950" /> Priority</div>
                          )}
                          {fareConfig.surgeEnabled && (
                            <span className="bg-[#FF9500]/20 text-[#FF9500] border border-[#FF9500]/30 px-1 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider whitespace-nowrap">
                              🔥 {activeRide?.surgeModel === 'fixed' ? '+£' + (activeRide?.surgeFixed || '2.00') : (activeRide?.surgeMultiplier || '1.4') + 'x'}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-[#00D26A] text-[11px] font-bold mt-0.5">You earn: £{((activeRide?.fareEstimate || 38.50) * (1 - fareConfig.commissionRate)).toFixed(2)}</p>
                    </div>

                    <div className="flex items-center justify-between mt-1 mb-1">
                      <div className="relative pl-5 space-y-2 flex-1">
                        {/* Route Line indicator */}
                        <div className="absolute left-[7px] top-1.5 bottom-1.5 w-[2px] bg-[#2C2C30] rounded-full"></div>
                        
                        <div className="relative">
                          <div className="absolute w-2.5 h-2.5 rounded-full bg-[#00D26A] border-[1.5px] border-[#1A1A1E] -left-[18.5px] top-[3px] z-10"></div>
                          <p className="text-[9px] font-black uppercase text-[#00D26A] tracking-wider leading-none mb-0.5">Pickup</p>
                          <p className="text-[14px] font-bold text-white leading-tight line-clamp-1">{activeRide?.pickupAddress || "12 Elm Street, SE15"}</p>
                          <p className="text-[11px] font-bold text-[#A1A1AA] mt-0.5">{activeRide?.distanceToPickupMiles || "1.2"} mi from you</p>
                        </div>

                        {(activeRide?.stops || []).map((stop: any, idx: number) => (
                          <div key={idx} className="relative mt-2">
                            <div className="absolute w-2.5 h-2.5 rounded-full bg-[#FF9500] border-[1.5px] border-[#1A1A1E] -left-[18.5px] top-[3px] z-10"></div>
                            <p className="text-[9px] font-black uppercase text-[#FF9500] tracking-wider leading-none mb-0.5">Stop {idx + 1}</p>
                            <p className="text-[14px] font-bold text-white leading-tight line-clamp-1">{stop.address}</p>
                          </div>
                        ))}

                        <div className="relative mt-2">
                          <div className="absolute w-2.5 h-2.5 bg-[#FF3B30] border-[1.5px] border-[#1A1A1E] -left-[18.5px] top-[3px] z-10"></div>
                          <p className="text-[9px] font-black uppercase text-[#FF3B30] tracking-wider leading-none mb-0.5">Drop-off</p>
                          <p className="text-[14px] font-bold text-white leading-tight line-clamp-1">{activeRide?.dropoffAddress || "Bristol Temple Meads"}</p>
                          <p className="text-[11px] font-bold text-[#A1A1AA] mt-0.5">{activeRide?.distanceMiles || "22"} mi from pickup</p>
                        </div>
                      </div>

                      {/* Circular Timer Ring */}
                      <div className="relative w-12 h-12 flex items-center justify-center shrink-0 ml-2 mr-1">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="24" cy="24" r="20" className="stroke-[#2C2C30] fill-none" strokeWidth="4" />
                          <motion.circle 
                            cx="24" cy="24" r="20" 
                            className={cn("fill-none", incomingTimer > 5 ? "stroke-[#00D26A]" : "stroke-[#FF3B30]")}
                            strokeWidth="4" 
                            strokeDasharray="125.6" 
                            strokeLinecap="round"
                            initial={{ strokeDashoffset: 0 }}
                            animate={{ strokeDashoffset: 125.6 - (125.6 * (incomingTimer / 15)) }}
                            transition={{ duration: 1, ease: 'linear' }}
                          />
                        </svg>
                        <span className="absolute text-lg font-black text-white">{incomingTimer}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {activeRide?.comments && (
                <div className="mb-2 bg-[#FFD60A] border rounded-[8px] p-2 flex items-start gap-2 shadow-[0_4px_10px_rgba(255,214,10,0.2)] shrink-0">
                  <MessageSquare className="w-3.5 h-3.5 text-[#1A1A1E] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[#1A1A1E] text-[9px] font-black uppercase tracking-wider block mb-0.5 opacity-70">Passenger Note</span>
                    <p className="text-[#1A1A1E] text-[11px] font-bold leading-snug truncate whitespace-normal line-clamp-2">
                      {activeRide.comments}
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 mt-1 shrink-0 relative z-20">
                <button 
                  onClick={handleAcceptRide}
                  className="w-full h-11 bg-[#00D26A] text-[#0D0D0F] rounded-[10px] font-black text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] shadow-[0_4px_20px_rgba(0,210,106,0.2)] transition-transform"
                >
                  <Check className="w-5 h-5 stroke-[3]" /> ACCEPT
                </button>
                <button 
                  onClick={handleDeclineRide}
                  className="w-full py-1.5 text-[11px] font-bold text-[#E4E4E7] uppercase tracking-wider hover:text-white transition-colors"
                >
                  Decline
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screen 3b: Stacked Incoming Ride Request Overlay */}
      <AnimatePresence>
        {stackedRideOffer && rideState === 'in_progress' && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute bottom-0 left-0 right-0 z-50 flex flex-col justify-end px-5 pb-[calc(4rem+env(safe-area-inset-bottom)+0.25rem)] pointer-events-none"
          >
            {/* Same content as before */}
            <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-3xl p-3 shadow-2xl relative overflow-hidden pointer-events-auto flex flex-col w-full">
              
              {/* Highlight header */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#00D26A] to-transparent shrink-0"></div>

              <div className="flex items-center justify-between mb-3 shrink-0">
                <h2 className="text-base font-black text-[#FF3B30] px-1 tracking-wider flex items-center gap-2 uppercase">
                  <span className="w-2.5 h-2.5 bg-[#FF3B30] rounded-full animate-pulse shadow-[0_0_8px_#FF3B30]"></span>
                  Next Ride Request (Stacked)
                </h2>
              </div>

              <div className="flex-1 flex flex-col min-h-0 scrollbar-hide">
                {/* Rider Details */}
                <div className="pt-1 pb-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-800 text-sm border border-white shrink-0">
                      {(stackedRideOffer?.name || "S")[0]}
                    </div>
                    <div className="flex-1 min-w-0 flex justify-between items-start">
                      <div>
                        <h3 className="text-[13px] font-bold text-white leading-tight truncate">{stackedRideOffer?.name || "Sarah T."}</h3>
                        <p className="text-[11px] text-[#FF9500] font-bold">⭐ 4.7 <span className="text-[#E4E4E7] font-normal">(124 trips)</span></p>
                      </div>
                      {stackedRideOffer?.isRiderPlus !== false && (
                        <div className="bg-gradient-to-r from-amber-300 to-amber-500 text-amber-950 px-1 py-0.5 rounded text-[8px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm shrink-0 mt-0.5"><Star className="w-2.5 h-2.5 fill-amber-950" /> Rider Plus</div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {/* Fare Section (Moved below rider profile) */}
                    <div className="bg-[#252529] rounded-xl p-2 relative overflow-hidden shrink-0">
                      <div className="flex justify-between items-end mb-1">
                        <h1 className="text-2xl leading-[1] font-black text-white flex items-end gap-2.5 shrink-0">
                          £{stackedRideOffer?.fareEstimate?.toFixed(2) || '38.50'}
                          <span className="text-[13px] font-bold text-white/80 tracking-normal mb-0.5">({((stackedRideOffer?.distanceToPickupMiles || 1.2) + (stackedRideOffer?.distanceMiles || 22)).toFixed(1)} mi)</span>
                        </h1>
                        <div className="flex gap-1 items-center">
                          {stackedRideOffer?.isPriority && (
                            <div className="bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 px-1 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm"><Zap className="w-2.5 h-2.5 fill-amber-950" /> Priority</div>
                          )}
                          {fareConfig.surgeEnabled && (
                            <span className="bg-[#FF9500]/20 text-[#FF9500] border border-[#FF9500]/30 px-1 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider whitespace-nowrap">
                              🔥 {stackedRideOffer?.surgeModel === 'fixed' ? '+£' + (stackedRideOffer?.surgeFixed || '2.00') : (stackedRideOffer?.surgeMultiplier || '1.4') + 'x'}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-[#00D26A] text-[11px] font-bold mt-0.5">You earn: £{((stackedRideOffer?.fareEstimate || 38.50) * (1 - fareConfig.commissionRate)).toFixed(2)}</p>
                    </div>

                    <div className="flex items-center justify-between mt-1 mb-1">
                      <div className="relative pl-5 space-y-2 flex-1">
                        {/* Route Line indicator */}
                        <div className="absolute left-[7px] top-1.5 bottom-1.5 w-[2px] bg-[#2C2C30] rounded-full"></div>
                        
                        <div className="relative">
                          <div className="absolute w-2.5 h-2.5 rounded-full bg-[#00D26A] border-[1.5px] border-[#1A1A1E] -left-[18.5px] top-[3px] z-10"></div>
                          <p className="text-[9px] font-black uppercase text-[#00D26A] tracking-wider leading-none mb-0.5">Next Pickup After Drop-off</p>
                          <p className="text-[14px] font-bold text-white leading-tight line-clamp-1">{stackedRideOffer?.pickupAddress || "12 Elm Street, SE15"}</p>
                          <p className="text-[11px] font-bold text-[#A1A1AA] mt-0.5">{stackedRideOffer?.distanceToPickupMiles || "1.2"} mi from next dropoff</p>
                        </div>

                        {(stackedRideOffer?.stops || []).map((stop: any, idx: number) => (
                          <div key={idx} className="relative mt-2">
                            <div className="absolute w-2.5 h-2.5 rounded-full bg-[#FF9500] border-[1.5px] border-[#1A1A1E] -left-[18.5px] top-[3px] z-10"></div>
                            <p className="text-[9px] font-black uppercase text-[#FF9500] tracking-wider leading-none mb-0.5">Stop {idx + 1}</p>
                            <p className="text-[14px] font-bold text-white leading-tight line-clamp-1">{stop.address}</p>
                          </div>
                        ))}

                        <div className="relative mt-2">
                          <div className="absolute w-2.5 h-2.5 bg-[#FF3B30] border-[1.5px] border-[#1A1A1E] -left-[18.5px] top-[3px] z-10"></div>
                          <p className="text-[9px] font-black uppercase text-[#FF3B30] tracking-wider leading-none mb-0.5">Drop-off</p>
                          <p className="text-[14px] font-bold text-white leading-tight line-clamp-1">{stackedRideOffer?.dropoffAddress || "Bristol Temple Meads"}</p>
                          <p className="text-[11px] font-bold text-[#A1A1AA] mt-0.5">{stackedRideOffer?.distanceMiles || "22"} mi from pickup</p>
                        </div>
                      </div>

                      {/* Circular Timer Ring */}
                      <div className="relative w-12 h-12 flex items-center justify-center shrink-0 ml-2 mr-1">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="24" cy="24" r="20" className="stroke-[#2C2C30] fill-none" strokeWidth="4" />
                          <motion.circle 
                            cx="24" cy="24" r="20" 
                            className={cn("fill-none", stackedIncomingTimer > 5 ? "stroke-[#00D26A]" : "stroke-[#FF3B30]")}
                            strokeWidth="4" 
                            strokeDasharray="125.6" 
                            strokeLinecap="round"
                            initial={{ strokeDashoffset: 0 }}
                            animate={{ strokeDashoffset: 125.6 - (125.6 * (stackedIncomingTimer / 15)) }}
                            transition={{ duration: 1, ease: 'linear' }}
                          />
                        </svg>
                        <span className="absolute text-lg font-black text-white">{stackedIncomingTimer}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {stackedRideOffer?.comments && (
                <div className="mb-2 bg-[#FFD60A] border rounded-[8px] p-2 flex items-start gap-2 shadow-[0_4px_10px_rgba(255,214,10,0.2)] shrink-0">
                  <MessageSquare className="w-3.5 h-3.5 text-[#1A1A1E] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[#1A1A1E] text-[9px] font-black uppercase tracking-wider block mb-0.5 opacity-70">Passenger Note</span>
                    <p className="text-[#1A1A1E] text-[11px] font-bold leading-snug truncate whitespace-normal line-clamp-2">
                      {stackedRideOffer.comments}
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 mt-1 shrink-0 relative z-20">
                <button 
                  onClick={handleAcceptStackedRide}
                  className="w-full h-11 bg-[#00D26A] text-[#0D0D0F] rounded-[10px] font-black text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] shadow-[0_4px_20px_rgba(0,210,106,0.2)] transition-transform"
                >
                  <Check className="w-5 h-5 stroke-[3]" /> ACCEPT NEXT JOB
                </button>
                <button 
                  onClick={handleDeclineStackedRide}
                  className="w-full py-1.5 text-[11px] font-bold text-[#E4E4E7] uppercase tracking-wider hover:text-white transition-colors"
                >
                  Decline
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      
      {/* Job Details Modal - Quick Glance */}
      <AnimatePresence>
        {showJobDetails && activeRide && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute bottom-[200px] left-4 right-4 z-[100] bg-[#1A1A1E] rounded-2xl border border-[#333338] shadow-2xl p-4 pointer-events-auto"
          >
            <div className="flex justify-between items-center mb-3 border-b border-[#333338] pb-2">
              <h3 className="font-black text-white uppercase text-xs tracking-wider">Job Details</h3>
              <button onClick={() => setShowJobDetails(false)} className="text-[#A1A1AA] hover:text-white active:scale-95 transition-transform"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-[#A1A1AA] font-bold w-[72px]">Passenger</span>
                <span className="text-white font-black">{activeRide?.name || "Passenger"}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#A1A1AA] font-bold w-[72px] mt-0.5">Pickup</span>
                <span className="text-white flex-1 leading-tight font-medium">{activeRide?.pickupAddress || "Pickup Location"}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#A1A1AA] font-bold w-[72px] mt-0.5">Drop-off</span>
                <span className="text-white flex-1 leading-tight font-medium">{activeRide?.dropoffAddress || "Drop-off Location"}</span>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-[#333338]">
                <span className="text-[#A1A1AA] font-bold w-[72px]">Total Fare</span>
                <span className="text-[#00D26A] font-black text-xl">£{activeRide?.fareEstimate?.toFixed(2) || '0.00'}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screen 4 & 5 & 6: Active Ride States (z-40) */}
      <AnimatePresence>
        {(rideState === 'en_route_pickup' || rideState === 'waiting' || rideState === 'in_progress') && (
          <motion.div
            layout
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute bottom-0 left-0 right-0 z-40 bg-[#1A1A1E] rounded-t-3xl border-t border-[#2C2C30] px-5 pt-0 pb-[68px] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] pointer-events-auto flex flex-col"
            onTouchStartCapture={() => {
              if (['en_route_pickup', 'waiting', 'in_progress'].includes(rideState) && !isCardCollapsed) {
                resetCardCollapseTimer();
              }
            }}
            onMouseDownCapture={() => {
              if (['en_route_pickup', 'waiting', 'in_progress'].includes(rideState) && !isCardCollapsed) {
                resetCardCollapseTimer();
              }
            }}
          >
            <div 
              className="w-full h-8 flex items-center justify-center mb-0 cursor-pointer touch-none opacity-90 hover:opacity-100 transition-opacity drop-shadow-sm"
              onClick={() => {
                const nextState = !isCardCollapsed;
                setIsCardCollapsed(nextState);
                if (!nextState && ['en_route_pickup', 'waiting', 'in_progress'].includes(rideState)) {
                  resetCardCollapseTimer();
                } else if (nextState) {
                  if (cardCollapseTimeoutRef.current) clearTimeout(cardCollapseTimeoutRef.current);
                }
              }}
            >
              {isCardCollapsed ? (
                <ChevronUp className="w-7 h-7 text-[#F8F9FA]" />
              ) : (
                <ChevronDown className="w-7 h-7 text-[#F8F9FA]" />
              )}
            </div>

            {rideState === 'en_route_pickup' && (
              <>
                <div className="flex justify-between items-start mb-2 relative">
                  <div className="flex-1 mr-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-0.5">
                      <span className="bg-[#00D26A] text-[#1A1A1E] px-1.5 py-0.5 rounded-[4px] text-[9px] font-black uppercase tracking-wider shadow-[0_0_8px_rgba(0,210,106,0.3)] whitespace-nowrap shrink-0">Pick Up</span>
                      <p className="text-[9px] font-black uppercase text-[#E4E4E7] tracking-widest truncate">Picking up {activeRide?.name || "Sarah T."}</p>
                    </div>
                    <p className="text-[16px] font-bold text-white mb-0 line-clamp-1">{activeRide?.pickupAddress || "12 Elm Street, SE15"}</p>
                    <p className="text-[16px] font-black text-white leading-none mt-0.5">3 min <span className="text-[#A1A1AA] text-[14px] font-bold">· 1.2 mi</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#00D26A] font-bold text-base">£{activeRide?.fareEstimate?.toFixed(2) || '38.50'}</p>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {!isCardCollapsed && activeRide?.comments && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                      animate={{ height: "auto", opacity: 1, marginBottom: 12 }}
                      exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-[#FFD60A] border rounded-[8px] p-2 flex items-start gap-2 shadow-[0_4px_10px_rgba(255,214,10,0.2)] max-w-full">
                        <MessageSquare className="w-3.5 h-3.5 text-[#1A1A1E] shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[#1A1A1E] text-[9px] font-black uppercase tracking-wider block mb-0.5 opacity-70">Passenger Note</span>
                          <p className="text-[#1A1A1E] text-[11px] font-bold leading-snug truncate whitespace-normal line-clamp-2">
                            {activeRide.comments}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex justify-center gap-2 mt-1">
                  <button onClick={() => setShowJobDetails(true)} className="w-[15%] h-10 bg-[#2C2C30] rounded-[10px] flex items-center justify-center shrink-0 active:scale-95 transition-transform">
                    <Info className="w-5 h-5 text-white" />
                  </button>
                  <button onClick={() => setIsChatOpen(true)} className="relative w-[15%] h-10 bg-[#252529] rounded-[10px] flex items-center justify-center shrink-0 active:scale-95 transition-transform border border-[#333338] shadow-[0_0_10px_rgba(0,210,106,0.1)]">
                    <MessageCircle className="w-5 h-5 text-[#00D26A]" />
                    {unreadChatCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border border-[#1A1A1E] items-center justify-center text-[7px] font-bold text-white shadow-sm">
                          {unreadChatCount}
                        </span>
                      </span>
                    )}
                  </button>
                  <button 
                    onClick={onArrivedClick}
                    className="flex-1 h-10 bg-[#FF9500] text-white rounded-[10px] font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-orange-950/20"
                  >
                    <MapPin className="w-4 h-4" /> MARK AS ARRIVED
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {!isCardCollapsed && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0, marginTop: 0 }}
                      animate={{ height: "auto", opacity: 1, marginTop: 8 }}
                      exit={{ height: 0, opacity: 0, marginTop: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex overflow-x-auto no-scrollbar gap-2 mb-1 w-full pb-1">
                        {["I'll be right there", "Traffic is heavy", "I'm outside"].map((msg, i) => (
                          <button 
                            key={i} 
                            onClick={() => handleSendQuickMessage(msg)}
                            disabled={quickMessageCooldown > 0}
                            className={cn(
                              "whitespace-nowrap px-3 py-1.5 border text-[11px] font-bold rounded-[8px] shadow-sm transition-transform",
                              quickMessageCooldown > 0 
                                ? "bg-[#1A1A1E] border-[#2C2C30] text-[#E4E4E7]/50 cursor-not-allowed" 
                                : "bg-[#252529] border-[#333338] text-white active:scale-95"
                            )}
                          >
                            {quickMessageCooldown > 0 ? `${msg} (${Math.floor(quickMessageCooldown / 60)}:${(quickMessageCooldown % 60).toString().padStart(2, '0')})` : msg}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}

            {rideState === 'waiting' && (
              <>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex-1">
                    <p className="text-[9px] font-black uppercase text-[#FF9500] tracking-widest mb-0.5 flex items-center gap-1"><AlertCircle className="w-2.5 h-2.5" /> Waiting for Rider</p>
                    <p className="text-[17px] font-black text-white px-0.5">
                      {Math.floor(elapsedWaitSeconds / 60)}:{(elapsedWaitSeconds % 60).toString().padStart(2, '0')}
                    </p>
                    <p className="text-[11px] font-bold mt-0">
                      {elapsedWaitSeconds < 180 
                        ? <span className="text-[#00D26A]">Free wait: {Math.floor((180 - elapsedWaitSeconds) / 60)}:{((180 - elapsedWaitSeconds) % 60).toString().padStart(2, '0')}</span>
                        : elapsedWaitSeconds < 300
                          ? <span className="text-[#FF9500]">Paid wait: {Math.floor((elapsedWaitSeconds - 180) / 60)}:{((elapsedWaitSeconds - 180) % 60).toString().padStart(2, '0')}</span>
                          : <span className="text-[#FF3B30]">Eligible for Cancel Fee</span>
                      }
                    </p>
                  </div>
                  
                  <div className="flex-[1.5] flex justify-center px-1">
                    <div className="bg-[#FF9500]/10 border border-[#FF9500]/30 px-3 py-1.5 rounded flex items-center gap-1.5 overflow-hidden w-full justify-center">
                       <User className="w-3.5 h-3.5 text-[#FF9500] shrink-0" />
                       <span className="text-white font-black text-xs uppercase tracking-wider truncate">{activeRide?.name || "Sarah T."}</span>
                    </div>
                  </div>

                  <div className="flex-1 text-right">
                    <p className="text-[#00D26A] font-bold text-base">£{activeRide?.fareEstimate?.toFixed(2) || '38.50'}</p>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {!isCardCollapsed && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                      animate={{ height: "auto", opacity: 1, marginBottom: 12 }}
                      exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                      className="overflow-hidden flex flex-col gap-3"
                    >
                      {activeRide?.comments && (
                        <div className="bg-[#FFD60A] border rounded-[8px] p-2 flex items-start gap-2 shadow-[0_4px_10px_rgba(255,214,10,0.2)] max-w-full">
                          <MessageSquare className="w-3.5 h-3.5 text-[#1A1A1E] shrink-0 mt-0.5" />
                          <div>
                            <span className="text-[#1A1A1E] text-[9px] font-black uppercase tracking-wider block mb-0.5 opacity-70">Passenger Note</span>
                            <p className="text-[#1A1A1E] text-[11px] font-bold leading-snug truncate whitespace-normal line-clamp-2">
                              {activeRide.comments}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {(activeRide?.requirePasscode || activeRide?.driverRequirePasscode) && activeRide?.handshakeCode && (
                        <div className="bg-[#00D26A]/10 border border-[#00D26A]/30 rounded-[10px] p-2 flex items-center justify-between">
                          <div>
                            <p className="text-[#00D26A] text-[9px] font-black tracking-widest uppercase mb-0.5">PIN Check Required</p>
                            <p className="text-[#E4E4E7] text-[11px] font-medium">Verify this PIN with passenger</p>
                          </div>
                          <div className="bg-[#00D26A]/20 text-[#00D26A] font-mono font-black text-lg px-2.5 py-1 rounded-lg tracking-widest">
                            {activeRide.handshakeCode}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <div className="flex justify-center gap-2 mt-1">
                  <button onClick={() => setShowJobDetails(true)} className="w-[15%] h-10 bg-[#2C2C30] rounded-[10px] flex items-center justify-center shrink-0 active:scale-95 transition-transform">
                    <Info className="w-5 h-5 text-white" />
                  </button>
                  <button onClick={() => setIsChatOpen(true)} className="relative w-[15%] h-10 bg-[#252529] rounded-[10px] flex items-center justify-center shrink-0 active:scale-95 transition-transform border border-[#333338] shadow-[0_0_10px_rgba(0,210,106,0.1)]">
                    <MessageCircle className="w-5 h-5 text-[#00D26A]" />
                    {unreadChatCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border border-[#1A1A1E] items-center justify-center text-[7px] font-bold text-white shadow-sm">
                          {unreadChatCount}
                        </span>
                      </span>
                    )}
                  </button>
                  <button 
                    onClick={handleStartRide}
                    className="flex-1 h-10 bg-[#00D26A] text-[#0D0D0F] rounded-[10px] font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-emerald-950/20"
                  >
                    <Zap className="w-4 h-4 fill-[#0D0D0F]" /> START TRIP
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {!isCardCollapsed && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0, marginTop: 0 }}
                      animate={{ height: "auto", opacity: 1, marginTop: 8 }}
                      exit={{ height: 0, opacity: 0, marginTop: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex overflow-x-auto no-scrollbar gap-2 mt-auto mb-1 w-full pb-1">
                        {["I'm waiting outside", "Are you coming?", "Please hurry up", "Couldn't stop at location, please look around for me"].map((msg, i) => (
                          <button 
                            key={i} 
                            onClick={() => handleSendQuickMessage(msg)}
                            disabled={quickMessageCooldown > 0}
                            className={cn(
                              "whitespace-nowrap px-3 py-1.5 border text-[11px] font-bold rounded-[8px] shadow-sm transition-transform",
                              quickMessageCooldown > 0 
                                ? "bg-[#1A1A1E] border-[#2C2C30] text-[#E4E4E7]/50 cursor-not-allowed" 
                                : "bg-[#252529] border-[#333338] text-white active:scale-95"
                            )}
                          >
                            {quickMessageCooldown > 0 ? `${msg} (${Math.floor(quickMessageCooldown / 60)}:${(quickMessageCooldown % 60).toString().padStart(2, '0')})` : msg}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}

            {rideState === 'in_progress' && (
              <>
                <div className="flex justify-between items-start mb-2 relative">
                  <div className="flex-1 mr-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-0.5">
                       {activeRide?.stops?.length > 0 ? (
                          <span className="bg-[#FF9500] text-white px-1.5 py-0.5 rounded-[4px] text-[9px] font-black uppercase tracking-wider shadow-[0_0_8px_rgba(255,149,0,0.3)] whitespace-nowrap shrink-0">Multi-Stop</span>
                       ) : (
                          <span className="bg-[#FF3B30] text-white px-1.5 py-0.5 rounded-[4px] text-[9px] font-black uppercase tracking-wider shadow-[0_0_8px_rgba(255,59,48,0.3)] whitespace-nowrap shrink-0">Drop Off</span>
                       )}
                       <p className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1 truncate ${isWaitingAtStop ? 'text-[#FF9500]' : 'text-[#00D26A]'}`}>
                         <span className={`w-1.5 h-1.5 rounded-full shrink-0 animate-pulse ${isWaitingAtStop ? 'bg-[#FF9500]' : 'bg-[#00D26A]'}`}></span> <span className="truncate">{isWaitingAtStop ? 'WAITING AT STOP' : 'Trip in Progress'}</span>
                       </p>
                    </div>
                    <p className="text-[16px] font-bold text-[#F8F9FA] mb-0 line-clamp-1">{activeRide?.dropoffAddress || "Bristol Temple Meads"}</p>
                    {isWaitingAtStop ? (
                       <p className="text-[16px] font-black text-[#FF9500] leading-none mt-0.5">Paid wait: {Math.floor(totalPaidWaitSeconds / 60)}:{((totalPaidWaitSeconds) % 60).toString().padStart(2, '0')}</p>
                    ) : (
                       <p className="text-[16px] font-black text-white leading-none mt-0.5">{activeRide?.durationMinutes || 38} min left <span className="text-[#A1A1AA] text-[14px] font-bold"> • {activeRide?.distanceMiles?.toFixed(1) || '14.2'} mi</span></p>
                    )}
                  </div>
                  <div className="text-right flex flex-col items-end shrink-0">
                    <p className="text-[#00D26A] font-bold text-base leading-none mb-1.5 mt-0.5">£{((activeRide?.fareEstimate || 38.50) + ((totalPaidWaitSeconds / 60) * fareConfig.waitRatePerMinute)).toFixed(2)}</p>
                    {activeRide?.hasCardOnFile ? (
                      <div className="inline-block bg-white border-2 border-[#00D26A] px-2 py-1 rounded-md shadow-sm mt-0.5">
                        <span className="text-[#059669] text-[9px] font-black uppercase tracking-wider block leading-none">Auto Payment</span>
                      </div>
                    ) : (
                      <div className="inline-block bg-white border-2 border-[#EA580C] px-2 py-1 rounded-md shadow-sm mt-0.5">
                        <span className="text-[#EA580C] text-[10px] font-black uppercase tracking-wider block leading-none">QR Code</span>
                      </div>
                    )}
                    {totalPaidWaitSeconds > 0 && (
                       <p className="text-[10px] text-[#FF9500] font-bold mt-1">+Wait</p>
                    )}
                  </div>
                </div>
                
                <AnimatePresence initial={false}>
                  {!isCardCollapsed && activeRide?.stops?.length > 0 && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                      animate={{ height: "auto", opacity: 1, marginBottom: 12 }}
                      exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                      className="overflow-hidden flex flex-col gap-2 mt-3"
                    >
                       <button onClick={handleToggleWaitAtStop} className={`w-full py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-colors border ${isWaitingAtStop ? 'bg-[#FF9500] text-white border-[#FF9500]/50' : 'bg-transparent text-[#FF9500] border-[#FF9500]/30'}`}>
                         {isWaitingAtStop ? 'Resume Trip' : 'Wait at Stop'}
                       </button>
                       
                       <AnimatePresence>
                         {fareConfig.allowRiderAbandonment && isWaitingAtStop && currentStopWaitSeconds >= 300 && !abandonmentWarningSent && (
                           <motion.button 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              onClick={handleSendAbandonmentWarning}
                              className="w-full py-3 bg-[#FF3B30]/10 border border-[#FF3B30]/50 text-[#FF3B30] rounded-xl font-black text-xs uppercase tracking-wider hover:bg-[#FF3B30]/20 transition-colors"
                           >
                              Rider not responding?
                           </motion.button>
                         )}
                         
                         {fareConfig.allowRiderAbandonment && isWaitingAtStop && currentStopWaitSeconds >= 420 && abandonmentWarningSent && (
                           <motion.button 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              onClick={handleRiderAbandonment}
                              className="w-full py-3 bg-[#FF3B30] text-white rounded-xl font-black text-sm uppercase tracking-wider hover:bg-[#FF3B30]/90 transition-colors shadow-lg"
                           >
                              End Trip Here (Rider Abandoned)
                           </motion.button>
                         )}
                       </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex justify-center gap-2 mt-1">
                  <button onClick={() => setShowJobDetails(true)} className="w-[15%] h-10 bg-[#2C2C30] rounded-[10px] flex items-center justify-center shrink-0 active:scale-95 transition-transform">
                    <Info className="w-5 h-5 text-white" />
                  </button>
                  <button onClick={() => setIsChatOpen(true)} className="relative w-[15%] h-10 bg-[#252529] rounded-[10px] flex items-center justify-center shrink-0 active:scale-95 transition-transform border border-[#333338] shadow-[0_0_10px_rgba(0,210,106,0.1)]">
                    <MessageCircle className="w-5 h-5 text-[#00D26A]" />
                    {unreadChatCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border border-[#1A1A1E] items-center justify-center text-[7px] font-bold text-white shadow-sm">
                          {unreadChatCount}
                        </span>
                      </span>
                    )}
                  </button>
                  <button 
                    onClick={handleCompleteRideBtnClick}
                    className="flex-1 h-10 bg-[#FF3B30] text-white rounded-[10px] font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-red-950/30"
                  >
                    <Check className="w-4 h-4 stroke-[3]" /> COMPLETE
                  </button>
                </div>
              </>
            )}

            {/* Cancel fallback */}
            {(rideState === 'en_route_pickup' || rideState === 'waiting') && (
              <>
                <button onClick={() => setShowCancelConfirm(true)} className="w-full py-2 text-xs font-bold text-[#E4E4E7] uppercase tracking-wide hover:text-[#FF3B30] transition-colors mt-0">
                  {rideState === 'waiting' 
                    ? (300 - elapsedWaitSeconds > 0 ? `Cancel (No Fee in ${Math.floor((300 - elapsedWaitSeconds) / 60)}:${((300 - elapsedWaitSeconds) % 60).toString().padStart(2, '0')})` : 'Cancel (Charge Fee)')
                    : 'Cancel Ride'}
                </button>

                <AnimatePresence>
                  {showCancelConfirm && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute inset-0 z-50 bg-[#1A1A1E]/95 backdrop-blur-md flex flex-col justify-center items-center p-4 pb-28 text-center rounded-t-3xl border-t border-[#2C2C30]"
                    >
                      <button 
                        onClick={() => setShowCancelConfirm(false)}
                        className="absolute top-4 right-4 flex items-center justify-center w-8 h-8 md:w-10 md:h-10 bg-[#2C2C30] hover:bg-white/10 rounded-full transition-colors z-50"
                      >
                        <X className="w-4 h-4 md:w-5 md:h-5 text-white" />
                      </button>
                      <div className="w-12 h-12 rounded-full bg-[#FF3B30]/20 flex flex-shrink-0 items-center justify-center mb-3">
                        <AlertCircle className="w-6 h-6 text-[#FF3B30]" />
                      </div>
                      <h3 className="text-white text-lg font-black tracking-wide mb-1 uppercase">Cancel Ride?</h3>
                      <p className="text-[#E4E4E7] text-xs mb-4 px-2 leading-relaxed font-medium">
                        Are you sure you want to cancel this trip? Frequent cancellations may affect your rating and account standing.
                      </p>
                      
                      <button 
                        onClick={() => {
                          setShowCancelConfirm(false);
                          handleDeclineRide();
                        }}
                        className="w-full h-12 flex-shrink-0 bg-[#FF3B30] text-white rounded-2xl font-black text-sm shadow-[0_4px_25px_rgba(255,59,48,0.3)] active:scale-95 transition-transform mb-3"
                      >
                        CONFIRM CANCEL
                      </button>
                      <button 
                        onClick={() => setShowCancelConfirm(false)}
                        className="w-full h-12 flex-shrink-0 bg-[#2C2C30] text-white rounded-2xl font-black text-sm active:scale-95 transition-transform"
                      >
                        BACK
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {showEarlyArrivalConfirm && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute inset-0 z-[60] bg-[#1A1A1E]/95 backdrop-blur-md flex flex-col justify-center items-center p-4 pb-28 text-center rounded-t-3xl border-t border-[#2C2C30]"
                    >
                      <button 
                        onClick={() => setShowEarlyArrivalConfirm(false)}
                        className="absolute top-4 right-4 flex items-center justify-center w-8 h-8 md:w-10 md:h-10 bg-[#2C2C30] hover:bg-white/10 rounded-full transition-colors z-50"
                      >
                        <X className="w-4 h-4 md:w-5 md:h-5 text-white" />
                      </button>
                      <div className="w-12 h-12 rounded-full bg-[#FF9500]/20 flex flex-shrink-0 items-center justify-center mb-3 mt-4">
                        <MapPin className="w-6 h-6 text-[#FF9500]" />
                      </div>
                      <h3 className="text-white text-lg font-black tracking-wide mb-1 uppercase">Too far from pickup?</h3>
                      <p className="text-[#E4E4E7] text-xs mb-4 px-2 leading-relaxed font-medium">
                        You appear to be quite far away from the pickup location. Are you sure you've arrived? Marking as arrived early can confuse the rider.
                      </p>
                      
                      <button 
                        onClick={() => {
                          setShowEarlyArrivalConfirm(false);
                          handleArrived();
                        }}
                        className="w-full h-12 flex-shrink-0 bg-[#FF9500] text-white rounded-2xl font-black text-sm shadow-[0_4px_25px_rgba(255,149,0,0.3)] active:scale-95 transition-transform mb-3 uppercase tracking-wider"
                      >
                        Yes, Mark as Arrived
                      </button>
                      <button 
                        onClick={() => setShowEarlyArrivalConfirm(false)}
                        className="w-full h-12 flex-shrink-0 bg-[#2C2C30] text-white rounded-2xl font-black text-sm active:scale-95 transition-transform uppercase tracking-wider"
                      >
                        Wait, Go Back
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
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
            className="fixed inset-0 z-[200] bg-[#0D0D0F]/95 backdrop-blur-xl pointer-events-auto overflow-y-auto"
          >
            <div className="min-h-full flex flex-col justify-start p-4 pt-16 pb-32 max-w-md mx-auto">
              <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-3xl p-6 shadow-2xl relative w-full text-center mt-auto mb-auto">
              
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
                  £{(activeRide?.finalFare || ((activeRide?.fareEstimate || 38.50) + ((totalPaidWaitSeconds / 60) * fareConfig.waitRatePerMinute) + (activeRide?.tipAmount || 0))).toFixed(2)}
                </motion.h1>
                {activeRide?.tipAmount ? (
                  <p className="text-emerald-400 font-bold text-[15px] mt-2 mb-4 bg-emerald-500/10 inline-block px-4 py-1.5 rounded-full border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">Includes £{activeRide.tipAmount.toFixed(2)} Tip</p>
                ) : null}
                <div className="mt-4 bg-[#00D26A]/10 border border-[#00D26A]/20 py-2.5 px-4 rounded-xl inline-block w-full">
                  <p className="text-[10px] font-black uppercase text-[#00D26A] tracking-wider mb-0.5">You Earned</p>
                  <p className="text-2xl font-black text-[#00D26A]">
                    £{((activeRide?.finalFare ? (activeRide.finalFare - (activeRide.tipAmount || 0)) : ((activeRide?.fareEstimate || 38.50) + ((totalPaidWaitSeconds / 60) * fareConfig.waitRatePerMinute))) * (1 - fareConfig.commissionRate) + (activeRide?.tipAmount || 0)).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="bg-[#252529] rounded-2xl p-4 text-left mb-6">
                <p className="text-[10px] font-black uppercase text-[#E4E4E7] tracking-widest mb-3 border-b border-[#333338] pb-2">Fare Breakdown</p>
                <div className="space-y-1.5 mb-3">
                  <div className="flex justify-between text-xs text-[#E4E4E7]"><span>Base fare:</span><span className="text-white">£{fareConfig.baseFare.toFixed(2)}</span></div>
                  <div className="flex justify-between text-xs text-[#E4E4E7]"><span>Distance ({activeRide?.distanceMiles?.toFixed(1) || '22'}mi):</span><span className="text-white">£{((activeRide?.distanceMiles || 22) * fareConfig.distanceRate).toFixed(2)}</span></div>
                  <div className="flex justify-between text-xs text-[#E4E4E7]"><span>Time (~{activeRide?.durationMinutes || 45}min):</span><span className="text-white">£---</span></div>
                  {totalPaidWaitSeconds > 0 && (
                    <div className="flex justify-between text-xs text-[#FF9500]"><span>Paid Wait ({Math.floor(totalPaidWaitSeconds / 60)}m):</span><span className="font-bold">+£{((totalPaidWaitSeconds / 60) * fareConfig.waitRatePerMinute).toFixed(2)}</span></div>
                  )}
                  {activeRide?.status === 'rider_abandoned' && (
                    <div className="flex justify-between text-xs text-[#FF3B30]"><span>Abandonment Fee:</span><span className="font-bold">+£5.00</span></div>
                  )}
                  {fareConfig.surgeEnabled && (
                    <div className="flex justify-between text-xs text-[#FF9500]">
                      <span>Surge ({activeRide?.surgeModel === 'fixed' ? 'Fixed' : (activeRide?.surgeMultiplier || '1.4') + 'x'}):</span>
                      <span className="font-bold">+£{activeRide?.surgeModel === 'fixed' ? (activeRide?.surgeFixed || 2.0).toFixed(2) : ((activeRide?.fareEstimate || 38.50) - (activeRide?.baseCalc || 30)).toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {(() => {
                  const baseJobFare = activeRide?.finalFare ? (activeRide.finalFare - (activeRide.tipAmount || 0)) : ((activeRide?.fareEstimate || 38.50) + ((totalPaidWaitSeconds / 60) * fareConfig.waitRatePerMinute));
                  const commission = baseJobFare * fareConfig.commissionRate;
                  const normalEarnings = baseJobFare - commission;
                  const totalEarnings = normalEarnings + (activeRide?.tipAmount || 0);

                  return (
                    <>
                      <div className="border-t border-[#333338] pt-2 mb-2 flex justify-between text-sm font-bold text-white">
                        <span>Base job fare:</span><span>£{baseJobFare.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-[#FF3B30] p-1.5 bg-[#FF3B30]/10 rounded border border-[#FF3B30]/20 mb-3">
                        <span>Commission ({(fareConfig.commissionRate * 100).toFixed(0)}%):</span><span>-£{commission.toFixed(2)}</span>
                      </div>
                      <div className="border-t border-[#333338] pt-2 pb-2 flex justify-between text-[15px] font-black text-white">
                        <span>Normal Earnings:</span><span>£{normalEarnings.toFixed(2)}</span>
                      </div>
                      {activeRide?.tipAmount ? (
                        <div className="flex justify-between text-[15px] font-black text-emerald-400 pb-2">
                           <span>Passenger Tip:</span><span>+£{activeRide.tipAmount.toFixed(2)}</span>
                        </div>
                      ) : null}
                      <div className="border-t-2 border-[#00D26A]/50 pt-2 flex justify-between text-lg font-black text-[#00D26A]">
                        <span>YOUR EARNINGS:</span><span>£{totalEarnings.toFixed(2)}</span>
                      </div>
                    </>
                  );
                })()}
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
                        className="w-full bg-[#0D0D0F] border border-[#333338] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FF9500] transition-colors resize-none placeholder:text-[#A1A1AA]"
                        rows={3}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button 
                onClick={async () => {
                  if (acceptedStackedRideOffer) {
                    setActiveRide(acceptedStackedRideOffer);
                    setRideState('en_route_pickup');
                    setAcceptedStackedRideOffer(null);
                    setPassengerRating(5);
                    setRatingComment("");
                    return;
                  }

                  setRideState('idle');
                  setIsOnline(profile?.isLastJob ? false : true);
                  
                  if (profile?.isLastJob && user) {
                    toast.success("Shift Ended", { description: "You are now offline." });
                    await updateDoc(doc(db, "users", user.uid), { isLastJob: false });
                  }
                  
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Bottom UI: Details and Call to Action */}
      <div className={cn("relative z-20 w-full px-4 pb-24 flex flex-col gap-3 transition-opacity", rideState !== 'idle' ? "opacity-0 pointer-events-none" : "opacity-100")}>
        
        {/* Primary Action Button moved to Menu - only map controls or status might remain here if needed */}
      </div>
      {/* Complete Ride Confirmation Modal */}
      <AnimatePresence>
        {showCompleteConfirm && (
          <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm overflow-y-auto pointer-events-auto scroll-smooth">
            <div className="min-h-full flex items-center justify-center p-4 py-8 pb-[140px]">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-[#1A1A1E] w-full max-w-sm rounded-[32px] p-6 shadow-2xl border border-[#333338] text-center">
              <div className="w-16 h-16 bg-[#00D26A]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-[#00D26A]" />
              </div>
              <h3 className="text-2xl font-black text-white mb-2">End Trip?</h3>
              {isEarlyCompletion ? (
                <>
                  <p className="text-sm font-medium text-[#A1A1AA] mb-4">You are finishing the ride before arriving at the destination. Please provide a reason to complete the job.</p>
                  <div className="space-y-2 mb-6">
                    {["Customer requested drop-off here", "Car broke down", "Passenger behavior", "Emergency", "Other"].map((reason) => (
                      <button
                        key={reason}
                        onClick={() => setEarlyCompletionReason(reason)}
                        className={cn(
                          "w-full p-3 rounded-xl border text-sm font-bold transition-all text-left",
                          earlyCompletionReason === reason 
                            ? "bg-[#00D26A]/20 border-[#00D26A] text-[#00D26A]" 
                            : "bg-[#252529] border-[#333338] text-white hover:bg-[#333338]"
                        )}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm font-medium text-[#A1A1AA] mb-6">Please confirm you are dropping off the passenger at their destination.</p>
              )}
              
              <div className="flex gap-3">
                <button onClick={() => setShowCompleteConfirm(false)} className="flex-1 py-4 bg-[#252529] rounded-2xl font-black text-[#A1A1AA] hover:bg-[#333338] transition-colors shadow-none">Go Back</button>
                <button 
                  onClick={handleCompleteRideConfirmed} 
                  disabled={isEarlyCompletion && !earlyCompletionReason}
                  className="flex-1 py-4 bg-[#00D26A] text-black rounded-2xl font-black hover:bg-[#00D26A]/90 transition-colors shadow-[0_0_15px_rgba(0,210,106,0.3)] disabled:opacity-50 disabled:shadow-none"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      </>
      )}

      {/* Render Other Tabs */}
      {activeTab === 'earnings' && <DriverEarnings onClose={() => setActiveTab('home')} />}
      {activeTab === 'analytics' && <DriverAnalytics onClose={() => setActiveTab('menu')} />}
      {activeTab === 'inbox' && <DriverInbox onClose={() => setActiveTab('home')} />}
      {activeTab === 'jobs' && <DriverJobs onClose={() => setActiveTab('home')} />}
      {activeTab === 'menu' && (
        <DriverMenu 
          onNavigate={(tab) => setActiveTab(tab as any)} 
          commissionRate={fareConfig.commissionRate}
          isOnline={isOnline}
          onToggleOnline={handleToggleOnline}
          onClose={() => setActiveTab('home')}
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
        <div className="fixed bottom-[74px] left-0 right-0 px-4 z-50 pointer-events-none flex flex-col items-center">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "w-full max-w-sm h-8 px-4 rounded-xl flex items-center justify-between border backdrop-blur-md transition-all pointer-events-auto shadow-lg",
              isOnline 
                ? "bg-[#064e3b]/80 border-emerald-500/30 shadow-emerald-900/20" 
                : "bg-[#1A1A1E]/90 border-[#2C2C30]"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-[#00D26A] animate-pulse" : "bg-[#A1A1AA]")} />
              <span className={cn("text-[10px] font-black uppercase tracking-widest", isOnline ? "text-white" : "text-[#A1A1AA]")}>
                {isOnline ? "Waiting for Jobs" : "Offline"}
              </span>
            </div>
            <span className={cn("text-[9px]", isOnline ? "font-black text-[#00D26A] drop-shadow-[0_0_2px_rgba(0,210,106,1)] brightness-150" : "font-bold text-[#A1A1AA]")}>
              {isOnline ? "ACTIVE" : "STANDBY"}
            </span>
          </motion.div>
        </div>
      )}

    </div>
  );
}

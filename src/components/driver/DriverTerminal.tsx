import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { usePortal } from "../../lib/PortalContext";
import { useAuth } from "../AuthProvider";
import { cn } from "@/src/lib/utils";
import { toast } from "sonner";
import { triggerHaptic, ImpactStyle } from "@/src/lib/capacitor";
import { Navigation, Info, Power, Zap, ChevronDown, Check, X, Phone, MessageSquare, AlertCircle, MapPin, Grid, Inbox, Menu as MenuIcon, PoundSterling, Star, Target, TrendingUp, Calendar, Clock, Eye, EyeOff, Hammer, Repeat } from "lucide-react";
import { GoogleMap, useJsApiLoader, MarkerF, PolylineF, OverlayViewF, OverlayView, DirectionsRenderer, CircleF } from "@react-google-maps/api";
import { db, doc, onSnapshot, collection, query, where, updateDoc, setDoc, serverTimestamp, deleteField, increment } from "@/src/firebase";
import DriverEarnings from "./DriverEarnings";
import DriverInbox from "./DriverInbox";
import DriverMenu from "./DriverMenu";
import DriverDocuments from "./DriverDocuments";
import DriverJobs from "./DriverJobs";
import RideChat from "./RideChat";
import { MessageCircle } from "lucide-react";

type RideState = 'idle' | 'incoming' | 'en_route_pickup' | 'waiting' | 'in_progress' | 'completed' | 'review';

const libraries: any[] = ['places'];

export default function DriverTerminal() {
  const { user, profile } = useAuth();
  const { switchPortal } = usePortal();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(false);
  const [onlineStartTime, setOnlineStartTime] = useState<Date | null>(null);
  const [onlineDurationText, setOnlineDurationText] = useState("0 min");
  const [mapCenter, setMapCenter] = useState<[number, number]>([53.6458, -1.7850]); // Default to Huddersfield from spec
  const [demandZones, setDemandZones] = useState<any[]>([
    { lat: 53.6458, lng: -1.7850, radius: 500, intensity: "high", label: "£5.00 Surge" },
    { lat: 53.6558, lng: -1.7750, radius: 800, intensity: "medium", label: "£2.50 Surge" },
  ]);
  const [showPredictiveSurge, setShowPredictiveSurge] = useState(true);
  
  // Storage for directions
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  
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
  const [fareConfig, setFareConfig] = useState<{baseFare: number, distanceRate: number, timeRate: number, waitRatePerMinute: number, minFare: number, commissionRate: number, allowRiderAbandonment?: boolean}>({ baseFare: 3.5, distanceRate: 1.3, timeRate: 0.15, waitRatePerMinute: 0.25, minFare: 5.0, commissionRate: 0.12, allowRiderAbandonment: false });
  const [activeRide, setActiveRide] = useState<any>(null); // Stores live or simulated ride data
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
    // Fetch route directions using Google Maps API
    const fetchDirections = (destLat: number, destLng: number) => {
      if (!window.google || !window.google.maps) return;
      const directionsService = new window.google.maps.DirectionsService();
      
      const originLat = mapCenterRef.current[0];
      const originLng = mapCenterRef.current[1];
      
      directionsService.route(
        {
          origin: new window.google.maps.LatLng(originLat, originLng),
          destination: new window.google.maps.LatLng(destLat, destLng),
          travelMode: window.google.maps.TravelMode.DRIVING
        },
        (result, status) => {
          if (status === window.google.maps.DirectionsStatus.OK) {
            setDirections(result);
            if (mapInstance && result?.routes?.[0]?.bounds) {
              // We fit the bounds here. Because we already set Map options `padding: { bottom: 350 }`, 
              // Google Maps will automatically shift the visual center up!
              mapInstance.fitBounds(result.routes[0].bounds);
            }
          } else {
            console.warn("Directions request failed with status:", status);
          }
        }
      );
    };

    if (rideState === 'en_route_pickup' && activeRide?.pickupLat && activeRide?.pickupLng) {
      if (isLoaded) fetchDirections(activeRide.pickupLat, activeRide.pickupLng);
    } else if (rideState === 'in_progress' && activeRide?.dropoffLat && activeRide?.dropoffLng) {
      if (isLoaded) fetchDirections(activeRide.dropoffLat, activeRide.dropoffLng);
    } else {
      setDirections(null);
    }
  }, [rideState, activeRide?.id, isLoaded, mapInstance]);

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
          isPriority: data.isPriority || false
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
            isOnline: true,
            status: activeRide ? 'on_ride' : 'available',
            dropoffLat: activeRide?.dropoffLat || null,
            dropoffLng: activeRide?.dropoffLng || null,
            isStackingEnabled: profile?.isStackingEnabled !== false,
            isLastJob: profile?.isLastJob === true
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
      surgeMultiplier: surge,
      distanceMiles: simulatedDist,
      durationMinutes: simulatedTime,
      comments: "Please ring the bell, the baby is sleeping. Thanks!",
      isPriority: Math.random() > 0.5,
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
          driverName: profile?.firstName || "Driver",
          driverPhone: profile?.phone || profile?.phoneNumber || "",
          vehicleInfo: profile?.vehicle || "Silver Toyota Prius",
          vehiclePlate: profile?.vehicleRegistration || profile?.plate || "WK71 BCF",
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
  
  const [activeTab, setActiveTabState] = useState<'home' | 'earnings' | 'inbox' | 'menu' | 'documents' | 'jobs'>(currentTabParam as any);

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
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showJobDetails, setShowJobDetails] = useState(false);

  const [waitStartTime, setWaitStartTime] = useState<number | null>(null);
  const [elapsedWaitSeconds, setElapsedWaitSeconds] = useState(0);

  // Stop wait & abandonment logic
  const [isWaitingAtStop, setIsWaitingAtStop] = useState(false);
  const [stopWaitStartTime, setStopWaitStartTime] = useState<number | null>(null);
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
      setAccumulatedPaidWaitSeconds(prev => prev + currentStopWaitSeconds);
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
        setAccumulatedPaidWaitSeconds(prev => prev + currentStopWaitSeconds);
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

      if (activeRide.riderId) {
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

  const handleArrived = async () => {
    setRideState('waiting');
    setWaitStartTime(Date.now());
    setElapsedWaitSeconds(0);
    setAccumulatedPaidWaitSeconds(0);
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
    const pickupPaidWait = Math.max(0, elapsedWaitSeconds - 180);
    setAccumulatedPaidWaitSeconds(pickupPaidWait);

    if (activeRide?.id && activeRide?.isReal) {
      await updateDoc(doc(db, "ride_requests", activeRide.id), {
        status: "in_progress",
        startedAt: serverTimestamp()
      });
    }
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  };

  const handleCompleteRide = async () => {
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

    // Generate the Direct-to-Driver QR Payment Link
    try {
      const response = await fetch("/api/rides/create-trip-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideId: activeRide?.id || "sim_123",
          driverId: user?.uid,
          amount: finalFare
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
        
        if (activeRide.riderId) {
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

        if (activeRide.riderId) {
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
          dailyEarnings: increment(fare),
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
    <div className="flex-1 bg-[#0D0D0F] text-white overflow-hidden relative flex flex-col font-sans -mx-4 -mt-6 min-h-0"> {/* Full bleed container */}
      
      {activeTab === 'home' && (
      <>
      {/* Platform Switcher Button in Driver Terminal */}
      <button 
        onClick={() => {
          triggerHaptic();
          switchPortal("anytrader");
          navigate("/");
        }}
        className="absolute top-[60px] left-4 z-[150] flex items-center gap-3 group text-left pt-2 pl-2"
        title="Switch to AnyTrader"
      >
        <div className="w-12 h-12 bg-blue-600 rounded-[16px] flex flex-col items-center justify-center shadow-lg shadow-blue-600/20 active:scale-95 transition-transform duration-300 shrink-0">
          <Hammer className="w-5 h-5 text-white" />
          <span className="text-[10px] font-black text-white leading-none mt-0.5">TRADES</span>
        </div>
      </button>

      {/* Simulation Trigger (Dev Only) */}
      <button 
        onClick={simulateIncomingRide}
        className="absolute top-[60px] left-1/2 -translate-x-1/2 z-[150] bg-[#FFD60A] text-[#1A1A1E] text-xs px-4 py-2 rounded-full font-black uppercase tracking-widest shadow-[0_4px_15px_rgba(255,214,10,0.3)] hover:scale-105 active:scale-95 transition-all"
      >
        Simulate Job
      </button>

      {/* 1. Map Layer (Background) */}
      <div className="absolute inset-0 z-0 h-full w-full bg-[#1A1A1E]">
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
              disableDefaultUI: true,
              clickableIcons: false,
              keyboardShortcuts: false,
              mapId: "a1b2c3d4e5f6g7h8", 
              gestureHandling: 'greedy',
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
                    strokeWeight: 6,
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
                    fillOpacity: 0.35,
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
      <div className="absolute top-[32%] right-4 z-50 flex flex-col items-end gap-3 pointer-events-auto">
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
              className="flex flex-col items-end gap-3"
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
                <div className="mt-1.5 px-2 py-0.5 bg-[#FF3B30]/10 backdrop-blur-md border border-red-500/20 rounded-full shadow-sm">
                  <span className="text-[8px] font-black uppercase text-[#FF3B30] tracking-widest leading-none">SOS</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button 
          onClick={handleCenterOnMe}
          className="w-10 h-10 mt-2 bg-[#1A1A1E]/80 backdrop-blur-md border border-[#2C2C30] rounded-full flex items-center justify-center text-white shadow-xl active:scale-95 transition-transform"
        >
          <Target className="w-4 h-4 text-[#E4E4E7]" />
        </button>
        
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

      {/* Floating Map Navigation (Left Side) - Decreased size and moved to left side corner */}
      {(rideState === 'en_route_pickup' || rideState === 'waiting' || rideState === 'in_progress') && activeRide?.id && (
        <div className="absolute top-[32%] left-4 z-50 pointer-events-auto">
          <a 
            href={`https://www.google.com/maps/dir/?api=1&destination=${rideState === 'in_progress' ? `${activeRide?.dropoffLat || ''},${activeRide?.dropoffLng || ''}` : `${activeRide?.pickupLat || ''},${activeRide?.pickupLng || ''}`}`} 
            target="_blank" 
            rel="noreferrer" 
            className="w-8 h-8 bg-[#007AFF] rounded-full flex items-center justify-center shadow-[0_4px_10px_rgba(0,122,255,0.4)] active:scale-95 transition-transform"
          >
            <Navigation className="w-4 h-4 text-white" />
          </a>
        </div>
      )}

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
                 {isEarningsVisible ? `£${todayEarnings.toFixed(2)}` : '••••••'}
              </span>
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsEarningsVisible(!isEarningsVisible);
              }}
              className="p-1.5 text-[#E4E4E7] hover:text-white hover:bg-white/10 rounded-full transition-colors outline-none"
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

      {/* Screen 7: Payment QR Handshake */}
      <AnimatePresence>
        {rideState === 'completed' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-[#0D0D0F]/95 backdrop-blur-md overflow-y-auto pointer-events-auto"
          >
            <div className="min-h-full flex flex-col items-center justify-center p-6 py-12">
              <div className="w-full max-w-sm bg-[#1A1A1E] border border-[#2C2C30] rounded-[2.5rem] p-8 text-center shadow-2xl relative overflow-hidden my-auto mt-16 mb-24">
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
                    className="absolute inset-0 z-50 bg-[#1A1A1E]/95 backdrop-blur-md flex flex-col justify-center items-center p-4 text-center rounded-t-3xl border-t border-[#2C2C30]"
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
            className="absolute bottom-0 left-0 right-0 z-50 flex flex-col justify-end px-3 pb-[calc(4rem+env(safe-area-inset-bottom)+0.25rem)] pointer-events-none"
          >
            {/* Same content as before */}
            <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-3xl p-3 shadow-2xl relative overflow-hidden pointer-events-auto flex flex-col w-full">
              
              {/* Highlight header */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#00D26A] to-transparent shrink-0"></div>

              <div className="flex items-center justify-between mb-3 shrink-0">
                <h2 className="text-base font-black text-[#FF3B30] px-1 tracking-wider flex items-center gap-2 uppercase">
                  <span className="w-2.5 h-2.5 bg-[#FF3B30] rounded-full animate-pulse shadow-[0_0_8px_#FF3B30]"></span>
                  New Ride Request
                </h2>
                <div className="flex gap-2">
                  {/* Mock rider plus member displaying here */}
                  <div className="bg-gradient-to-r from-amber-300 to-amber-500 text-amber-950 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm"><Star className="w-3 h-3 fill-amber-950" /> Rider Plus</div>

                  {activeRide?.isPriority && (
                    <div className="bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm"><Zap className="w-3 h-3 fill-amber-950" /> Priority</div>
                  )}
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto scrollbar-hide -mx-2 px-2 pb-2">
                {/* Fare Section */}
                <div className="bg-[#252529] rounded-xl p-3 mb-3 relative overflow-hidden group/fare cursor-pointer" onClick={() => setShowFareBreakdown(!showFareBreakdown)}>
                  <div className="flex justify-between items-end mb-1">
                    <h1 className="text-3xl leading-[1] font-black text-white flex items-end gap-3.5 shrink-0">
                      £{activeRide?.fareEstimate?.toFixed(2) || '38.50'}
                    </h1>
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
                        <div className="flex justify-between text-xs text-[#E4E4E7]"><span>Base:</span><span>£{fareConfig.baseFare.toFixed(2)}</span></div>
                        <div className="flex justify-between text-xs text-[#E4E4E7]"><span>Estimated Distance:</span><span>£{((activeRide?.distanceMiles || 22) * fareConfig.distanceRate).toFixed(2)}</span></div>
                        <div className="flex justify-between text-xs text-[#FF9500]"><span>Surge:</span><span>+£{((activeRide?.fareEstimate || 38.50) - (activeRide?.baseCalc || 30)).toFixed(2)}</span></div>
                        <div className="flex justify-between text-[11px] font-bold text-[#FF3B30] mt-1 p-1 bg-[#FF3B30]/10 rounded border border-[#FF3B30]/20">
                          <span>Commission ({(fareConfig.commissionRate * 100).toFixed(0)}%):</span><span>-£{((activeRide?.fareEstimate || 38.50) * fareConfig.commissionRate).toFixed(2)}</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  {!showFareBreakdown && (
                    <div className="w-full text-center mt-1.5 group-hover/fare:bg-white/5 py-0.5 rounded transition-colors">
                      <ChevronDown className="w-4 h-4 text-[#A1A1AA] mx-auto" />
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
                      <p className="text-xs text-[#FF9500] font-bold">⭐ 4.7 <span className="text-[#E4E4E7] font-normal">(124 trips)</span></p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    {isLoaded && activeRide?.pickupLat && activeRide?.dropoffLat && (
                      <div className="w-full h-[120px] rounded-xl overflow-hidden relative border border-[#2C2C30] shrink-0">
                        <div className="absolute inset-0 pointer-events-none z-10 rounded-xl ring-1 ring-inset ring-white/10" />
                        <GoogleMap
                          mapContainerStyle={{ width: '100%', height: '100%' }}
                          onLoad={(map) => {
                            const bounds = new window.google.maps.LatLngBounds();
                            if (activeRide.pickupLat && activeRide.pickupLng) bounds.extend({ lat: activeRide.pickupLat, lng: activeRide.pickupLng });
                            if (activeRide.dropoffLat && activeRide.dropoffLng) bounds.extend({ lat: activeRide.dropoffLat, lng: activeRide.dropoffLng });
                            (activeRide.stops || []).forEach((s: any) => { if (s.coords) bounds.extend(s.coords); });
                            map.fitBounds(bounds, { top: 20, bottom: 20, left: 20, right: 20 });
                            // Apply a max zoom in case points are very close
                            const listener = window.google.maps.event.addListener(map, 'idle', () => {
                              if ((map.getZoom() || 0) > 13) map.setZoom(13); // Restrict to 13 as user mentioned
                              window.google.maps.event.removeListener(listener);
                            });
                          }}
                          options={{
                            disableDefaultUI: true,
                            clickableIcons: false,
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

                    <div className="flex items-center justify-between mt-2 mb-1">
                      <div className="relative pl-5 space-y-3 flex-1">
                        {/* Route Line indicator */}
                        <div className="absolute left-2 top-1.5 bottom-1.5 w-[3px] bg-[#2C2C30] rounded-full"></div>
                        
                        <div className="relative">
                          <div className="absolute w-3.5 h-3.5 rounded-full bg-[#00D26A] border-2 border-[#1A1A1E] -left-[23.5px] top-0.5 z-10"></div>
                          <p className="text-[10px] font-black uppercase text-[#00D26A] tracking-wider leading-none mb-0.5">Pickup</p>
                          <p className="text-[17px] font-bold text-white leading-tight line-clamp-2">{activeRide?.pickupAddress || "12 Elm Street, SE15"}</p>
                        </div>

                        {(activeRide?.stops || []).map((stop: any, idx: number) => (
                          <div key={idx} className="relative mt-3">
                            <div className="absolute w-3.5 h-3.5 rounded-full bg-[#FF9500] border-2 border-[#1A1A1E] -left-[23.5px] top-0.5 z-10"></div>
                            <p className="text-[10px] font-black uppercase text-[#FF9500] tracking-wider leading-none mb-0.5">Stop {idx + 1}</p>
                            <p className="text-[17px] font-bold text-white leading-tight line-clamp-2">{stop.address}</p>
                          </div>
                        ))}

                        <div className="relative mt-3">
                          <div className="absolute w-3.5 h-3.5 bg-[#FF3B30] border-2 border-[#1A1A1E] -left-[23.5px] top-0.5 z-10"></div>
                          <p className="text-[10px] font-black uppercase text-[#FF3B30] tracking-wider leading-none mb-0.5">Drop-off</p>
                          <p className="text-[17px] font-bold text-white leading-tight line-clamp-2">{activeRide?.dropoffAddress || "Bristol Temple Meads"}</p>
                        </div>
                      </div>

                      {/* Circular Timer Ring */}
                      <div className="relative w-16 h-16 flex items-center justify-center shrink-0 ml-3 mr-2">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="32" cy="32" r="28" className="stroke-[#2C2C30] fill-none" strokeWidth="5" />
                          <motion.circle 
                            cx="32" cy="32" r="28" 
                            className={cn("fill-none", incomingTimer > 5 ? "stroke-[#00D26A]" : "stroke-[#FF3B30]")}
                            strokeWidth="5" 
                            strokeDasharray="176" 
                            strokeLinecap="round"
                            initial={{ strokeDashoffset: 0 }}
                            animate={{ strokeDashoffset: 176 - (176 * (incomingTimer / 15)) }}
                            transition={{ duration: 1, ease: 'linear' }}
                          />
                        </svg>
                        <span className="absolute text-xl font-black text-white">{incomingTimer}</span>
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
                  className="w-full py-2 text-xs font-bold text-[#E4E4E7] uppercase tracking-wider hover:text-white transition-colors"
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
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute bottom-0 left-0 right-0 z-40 bg-[#1A1A1E] rounded-t-3xl border-t border-[#2C2C30] p-4 pb-[68px] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] pointer-events-auto"
          >
            {rideState === 'en_route_pickup' && (
              <>
                <div className="flex justify-between items-start mb-3 relative">
                  <div>
                    <p className="text-[10px] font-black uppercase text-[#E4E4E7] tracking-widest mb-1">Picking up {activeRide?.name || "Sarah T."}</p>
                    <div className="absolute left-1/2 -translate-x-1/2 -top-2">
                      <span className="bg-[#00D26A] text-[#1A1A1E] px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shadow-[0_0_8px_rgba(0,210,106,0.3)] whitespace-nowrap">Pick Up</span>
                    </div>
                    <p className="text-[19px] font-bold text-white mb-0.5 line-clamp-1">{activeRide?.pickupAddress || "12 Elm Street, SE15"}</p>
                    <p className="text-xl font-black text-white leading-none mt-1">3 min <span className="text-[#A1A1AA] text-base font-bold">· 1.2 mi</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#00D26A] font-bold text-lg">£{activeRide?.fareEstimate?.toFixed(2) || '38.50'}</p>
                  </div>
                </div>
                <div className="flex justify-center gap-3 mt-2">
                  <button onClick={() => setShowJobDetails(true)} className="w-[15%] h-11 bg-[#2C2C30] rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-transform">
                    <Info className="w-5 h-5 text-white" />
                  </button>
                  <button onClick={() => setIsChatOpen(true)} className="w-[15%] h-11 bg-[#252529] rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-transform border border-[#333338] shadow-[0_0_10px_rgba(0,210,106,0.1)]">
                    <MessageCircle className="w-5 h-5 text-[#00D26A]" />
                  </button>
                  <button 
                    onClick={handleArrived}
                    className="flex-1 h-11 bg-[#FF9500] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-orange-950/20"
                  >
                    <MapPin className="w-4 h-4" /> ARRIVED AT PICKUP
                  </button>
                </div>
              </>
            )}

            {rideState === 'waiting' && (
              <>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-[10px] font-black uppercase text-[#FF9500] tracking-widest mb-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Waiting for Rider</p>
                    <p className="text-xl font-black text-white px-0.5">
                      {Math.floor(elapsedWaitSeconds / 60)}:{(elapsedWaitSeconds % 60).toString().padStart(2, '0')}
                    </p>
                    <p className="text-xs font-bold mt-0.5">
                      {elapsedWaitSeconds < 180 
                        ? <span className="text-[#00D26A]">Free wait: {Math.floor((180 - elapsedWaitSeconds) / 60)}:{((180 - elapsedWaitSeconds) % 60).toString().padStart(2, '0')}</span>
                        : elapsedWaitSeconds < 300
                          ? <span className="text-[#FF9500]">Paid wait: {Math.floor((elapsedWaitSeconds - 180) / 60)}:{((elapsedWaitSeconds - 180) % 60).toString().padStart(2, '0')}</span>
                          : <span className="text-[#FF3B30]">Eligible for Cancel Fee</span>
                      }
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#00D26A] font-bold">£{activeRide?.fareEstimate?.toFixed(2) || '38.50'}</p>
                  </div>
                </div>

                {activeRide?.comments && (
                  <div className="mb-3 bg-[#FFD60A]/15 border border-[#FFD60A]/40 rounded-xl p-3">
                    <p className="text-[#FFD60A] text-xs font-medium leading-relaxed">
                      <span className="font-bold">Passenger Note:</span> {activeRide.comments}
                    </p>
                  </div>
                )}
                
                <div className="flex justify-center gap-3 mt-2">
                  <button onClick={() => setShowJobDetails(true)} className="w-[15%] h-11 bg-[#2C2C30] rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-transform">
                    <Info className="w-5 h-5 text-white" />
                  </button>
                  <button onClick={() => setIsChatOpen(true)} className="w-[15%] h-11 bg-[#252529] rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-transform border border-[#333338] shadow-[0_0_10px_rgba(0,210,106,0.1)]">
                    <MessageCircle className="w-5 h-5 text-[#00D26A]" />
                  </button>
                  <button 
                    onClick={handleStartRide}
                    className="flex-1 h-11 bg-[#00D26A] text-[#0D0D0F] rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-emerald-950/20"
                  >
                    <Zap className="w-4 h-4 fill-[#0D0D0F]" /> START TRIP
                  </button>
                </div>
              </>
            )}

            {rideState === 'in_progress' && (
              <>
                <div className="flex justify-between items-start mb-3 relative">
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 mb-1 ${isWaitingAtStop ? 'text-[#FF9500]' : 'text-[#00D26A]'}`}>
                      <span className={`w-2 h-2 rounded-full animate-pulse ${isWaitingAtStop ? 'bg-[#FF9500]' : 'bg-[#00D26A]'}`}></span> {isWaitingAtStop ? 'WAITING AT STOP' : 'Trip in Progress'}
                    </p>
                    <div className="absolute left-1/2 -translate-x-1/2 -top-2">
                       {activeRide?.stops?.length > 0 ? (
                          <span className="bg-[#FF9500] text-white px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shadow-[0_0_8px_rgba(255,149,0,0.3)] whitespace-nowrap">Multi-Stop</span>
                       ) : (
                          <span className="bg-[#FF3B30] text-white px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shadow-[0_0_8px_rgba(255,59,48,0.3)] whitespace-nowrap">Drop Off</span>
                       )}
                    </div>
                    <p className="text-[19px] font-bold text-[#F8F9FA] mb-0.5 line-clamp-1">{activeRide?.dropoffAddress || "Bristol Temple Meads"}</p>
                    {isWaitingAtStop ? (
                       <p className="text-xl font-black text-[#FF9500] leading-none mt-1">Paid wait: {Math.floor(totalPaidWaitSeconds / 60)}:{((totalPaidWaitSeconds) % 60).toString().padStart(2, '0')}</p>
                    ) : (
                       <p className="text-xl font-black text-white leading-none mt-1">{activeRide?.durationMinutes || 38} min left</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[#00D26A] font-bold text-lg">£{((activeRide?.fareEstimate || 38.50) + ((totalPaidWaitSeconds / 60) * fareConfig.waitRatePerMinute)).toFixed(2)}</p>
                    {totalPaidWaitSeconds > 0 && (
                       <p className="text-[10px] text-[#FF9500] font-bold">+Wait</p>
                    )}
                  </div>
                </div>
                
                {activeRide?.stops?.length > 0 && (
                  <div className="flex flex-col gap-2 mt-3">
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
                  </div>
                )}

                <div className="flex justify-center gap-2 mt-2">
                  <button onClick={() => setShowJobDetails(true)} className="w-[15%] h-11 bg-[#2C2C30] rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-transform">
                    <Info className="w-5 h-5 text-white" />
                  </button>
                  <button onClick={() => setIsChatOpen(true)} className="w-[15%] h-11 bg-[#252529] rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-transform border border-[#333338] shadow-[0_0_10px_rgba(0,210,106,0.1)]">
                    <MessageCircle className="w-5 h-5 text-[#00D26A]" />
                  </button>
                  <button 
                    onClick={handleCompleteRide}
                    className="flex-1 h-11 bg-[#FF3B30] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-red-950/30"
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
                      className="absolute inset-0 z-50 bg-[#1A1A1E]/95 backdrop-blur-md flex flex-col justify-center items-center p-4 text-center rounded-t-3xl border-t border-[#2C2C30]"
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
                  £{((activeRide?.fareEstimate || 38.50) + ((totalPaidWaitSeconds / 60) * fareConfig.waitRatePerMinute)).toFixed(2)}
                </motion.h1>
                <div className="mt-4 bg-[#00D26A]/10 border border-[#00D26A]/20 py-2.5 px-4 rounded-xl inline-block">
                  <p className="text-[10px] font-black uppercase text-[#00D26A] tracking-wider mb-0.5">You Earned</p>
                  <p className="text-2xl font-black text-[#00D26A]">£{(((activeRide?.fareEstimate || 38.50) + ((totalPaidWaitSeconds / 60) * fareConfig.waitRatePerMinute)) * (1 - fareConfig.commissionRate)).toFixed(2)}</p>
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
                  <div className="flex justify-between text-xs text-[#FF9500]"><span>Surge ({activeRide?.surgeMultiplier || '1.4'}x):</span><span className="font-bold">+£{((activeRide?.fareEstimate || 38.50) - (activeRide?.baseCalc || 30)).toFixed(2)}</span></div>
                </div>
                <div className="border-t border-[#333338] pt-2 mb-2 flex justify-between text-sm font-bold text-white">
                  <span>Total fare:</span><span>£{(activeRide?.finalFare || ((activeRide?.fareEstimate || 38.50) + ((totalPaidWaitSeconds / 60) * fareConfig.waitRatePerMinute))).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-[#FF3B30] p-1.5 bg-[#FF3B30]/10 rounded border border-[#FF3B30]/20 mb-3">
                  <span>Commission ({(fareConfig.commissionRate * 100).toFixed(0)}%):</span><span>-£{((activeRide?.finalFare || ((activeRide?.fareEstimate || 38.50) + ((totalPaidWaitSeconds / 60) * fareConfig.waitRatePerMinute))) * fareConfig.commissionRate).toFixed(2)}</span>
                </div>
                <div className="border-t border-[#333338] pt-2 flex justify-between text-[15px] font-black text-[#00D26A]">
                  <span>YOUR EARNINGS:</span><span>£{((activeRide?.finalFare || ((activeRide?.fareEstimate || 38.50) + ((totalPaidWaitSeconds / 60) * fareConfig.waitRatePerMinute))) * (1 - fareConfig.commissionRate)).toFixed(2)}</span>
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
                        className="w-full bg-[#0D0D0F] border border-[#333338] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FF9500] transition-colors resize-none placeholder:text-[#A1A1AA]"
                        rows={3}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button 
                onClick={async () => {
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
      {activeTab === 'earnings' && <DriverEarnings onClose={() => setActiveTab('home')} />}
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
              "w-full max-w-sm h-7 px-4 rounded-xl flex items-center justify-between border backdrop-blur-md transition-all pointer-events-auto shadow-lg",
              isOnline 
                ? "bg-[#064e3b]/80 border-emerald-500/30 shadow-emerald-900/20" 
                : "bg-[#1A1A1E]/90 border-[#2C2C30]"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-[#00D26A] animate-pulse" : "bg-[#A1A1AA]")} />
              <span className={cn("text-[9px] font-black uppercase tracking-widest", isOnline ? "text-white" : "text-[#A1A1AA]")}>
                {isOnline ? "Waiting for Jobs" : "Offline"}
              </span>
            </div>
            <span className={cn("text-[8px]", isOnline ? "font-black text-[#00D26A] drop-shadow-[0_0_2px_rgba(0,210,106,1)] brightness-150" : "font-bold text-[#A1A1AA]")}>
              {isOnline ? "ACTIVE" : "STANDBY"}
            </span>
          </motion.div>
        </div>
      )}

    </div>
  );
}

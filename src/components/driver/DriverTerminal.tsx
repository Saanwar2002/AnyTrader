import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { usePortal } from "../../lib/PortalContext";
import { useAuth } from "../AuthProvider";
import { cn } from "@/src/lib/utils";
import { toast } from "sonner";
import { QRCodeSVG } from 'qrcode.react';
import { triggerHaptic, ImpactStyle, getGoogleMapsApiKey, isCapacitor, speakText } from "@/src/lib/capacitor";
import { Capacitor } from '@capacitor/core';
import {
  Navigation,
  Info,
  Power,
  Zap,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Phone,
  MessageSquare,
  AlertCircle,
  MapPin,
  Grid,
  Inbox,
  Menu as MenuIcon,
  PoundSterling,
  Star,
  Target,
  TrendingUp,
  Calendar,
  Clock,
  Eye,
  EyeOff,
  Hammer,
  Repeat,
  Plus,
  Minus,
  User,
  Compass,
  AlertTriangle,
  Car,
  HardHat,
  MinusCircle,
  Camera,
  MapPinOff,
  PhoneCall,
  Volume2,
  Volume1,
  VolumeX,
} from "lucide-react";
import {
  GoogleMap,
  useJsApiLoader,
  MarkerF,
  PolylineF,
  OverlayViewF,
  OverlayView,
  DirectionsRenderer,
  CircleF,
} from "@react-google-maps/api";
import {
  db,
  doc,
  onSnapshot,
  collection,
  query,
  where,
  updateDoc,
  setDoc,
  serverTimestamp,
  deleteField,
  increment,
  runTransaction,
  getDocs,
  getDoc,
  addDoc,
  orderBy,
} from "@/src/firebase";
import { playSound } from "@/src/lib/sound";
import DriverEarnings from "./DriverEarnings";
import DriverAnalytics from "./DriverAnalytics";
import DriverInbox from "./DriverInbox";
import DriverMenu from "./DriverMenu";
import DriverDocuments from "./DriverDocuments";
import DriverJobs from "./DriverJobs";
import DriverZones from "./DriverZones";
import DriverAvailability from "./DriverAvailability";
import { MapZoomControls } from "../shared/MapZoomControls";
import { SwipeButton } from "../shared/SwipeButton";
import RideChat from "./RideChat";
import { MessageCircle } from "lucide-react";

type RideState =
  | "idle"
  | "incoming"
  | "en_route_pickup"
  | "waiting"
  | "in_progress"
  | "completed"
  | "review";

const libraries: any[] = ["places"];

const MAP_CONTAINER_STYLE: React.CSSProperties = {
  width: "100%",
  height: "100%",
};

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: false,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  gestureHandling: "greedy",
  styles: [
    {
      featureType: "poi",
      stylers: [{ visibility: "off" }],
    },
    {
      featureType: "transit",
      stylers: [{ visibility: "simplified" }],
    },
  ],
};

// Custom Zoom Controls (Imported from shared)

const premiumMapOptions: google.maps.MapOptions = {
  ...mapOptions,
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

import { fetchLiveDemandZones } from "@/src/services/surgeHeatmapService";

const getDistanceInMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getRemainingStepDistance = (
  mapCenter: [number, number],
  step: google.maps.DirectionsStep,
) => {
  if (!step?.path || step.path.length === 0) return step?.distance?.value || 0;

  let minDistance = Infinity;
  let closestIdx = 0;
  for (let i = 0; i < step.path.length; i++) {
    const p = step.path[i];
    const plat = typeof p.lat === "function" ? p.lat() : (p.lat as unknown as number);
    const plng = typeof p.lng === "function" ? p.lng() : (p.lng as unknown as number);
    const d = getDistanceInMeters(mapCenter[0], mapCenter[1], plat, plng);
    if (d < minDistance) {
      minDistance = d;
      closestIdx = i;
    }
  }

  let remainingDist = 0;
  for (let i = closestIdx; i < step.path.length - 1; i++) {
    const p1 = step.path[i];
    const p2 = step.path[i + 1];
    const p1lat = typeof p1.lat === "function" ? p1.lat() : (p1.lat as unknown as number);
    const p1lng = typeof p1.lng === "function" ? p1.lng() : (p1.lng as unknown as number);
    const p2lat = typeof p2.lat === "function" ? p2.lat() : (p2.lat as unknown as number);
    const p2lng = typeof p2.lng === "function" ? p2.lng() : (p2.lng as unknown as number);
    remainingDist += getDistanceInMeters(p1lat, p1lng, p2lat, p2lng);
  }
  
  return remainingDist;
};

const getCurrentStepIndex = (
  mapCenter: [number, number],
  steps: google.maps.DirectionsStep[]
): number => {
  if (!steps || steps.length === 0) return 0;
  
  let minDist = Infinity;
  let closestStepIdx = 0;
  
  for (let s = 0; s < steps.length; s++) {
    const step = steps[s];
    if (!step?.path) continue;
    
    for (let i = 0; i < step.path.length; i++) {
      const p = step.path[i];
      const plat = typeof p.lat === "function" ? p.lat() : (p.lat as unknown as number);
      const plng = typeof p.lng === "function" ? p.lng() : (p.lng as unknown as number);
      
      const dist = getDistanceInMeters(mapCenter[0], mapCenter[1], plat, plng);
      if (dist < minDist) {
        minDist = dist;
        closestStepIdx = s;
      }
    }
  }
  
  return closestStepIdx;
};

const getRemainingLegDistance = (
  mapCenter: [number, number],
  steps: google.maps.DirectionsStep[],
  currentStepIndex: number
): number => {
  if (!steps || steps.length === 0) return 0;
  let total = getRemainingStepDistance(mapCenter, steps[currentStepIndex]);
  for (let i = currentStepIndex + 1; i < steps.length; i++) {
    total += steps[i].distance?.value || 0;
  }
  return total;
};

const formatNavigateDistance = (meters: number | undefined): string => {
  if (meters === undefined) return "";
  if (meters < 482.8) { // less than 0.3 miles -> show meters
    return `${Math.round(meters)} METERS`;
  }
  const miles = meters * 0.000621371;
  return `${miles.toFixed(1)} MILES`;
};

export default function DriverTerminal() {
  const { user, profile } = useAuth();
  const { switchPortal, setPreventPortalSwitch } = usePortal();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(false);
  const [onlineStartTime, setOnlineStartTime] = useState<Date | null>(null);
  const [onlineDurationText, setOnlineDurationText] = useState("0 min");
  const [mapCenter, setMapCenter] = useState<[number, number]>([
    53.6458, -1.785,
  ]); // Default to Huddersfield from spec
  const [driverLocation, setDriverLocation] = useState<[number, number]>([
    53.6458, -1.785,
  ]);
  const driverLocationRef = useRef(driverLocation);
  
  useEffect(() => {
    driverLocationRef.current = driverLocation;
  }, [driverLocation]);
  const [isMapTilesLoaded, setIsMapTilesLoaded] = useState(false);
  const [isSyncingMap, setIsSyncingMap] = useState(false);
  const [demandZones, setDemandZones] = useState<any[]>([]);
  const [showPredictiveSurge, setShowPredictiveSurge] = useState(false);

  // Storage for directions
  const [directions, setDirectionsState] =
    useState<google.maps.DirectionsResult | null>(null);
  const currentDirectionsRef = useRef<google.maps.DirectionsResult | null>(
    null,
  );
  const setDirections = (val: google.maps.DirectionsResult | null) => {
    currentDirectionsRef.current = val;
    setDirectionsState(val);
  };

  const [currentLegIndex, setCurrentLegIndex] = useState(0);
  const [showLeaveStopReminder, setShowLeaveStopReminder] = useState(false);
  const [hasReachedCurrentStop, setHasReachedCurrentStop] = useState(false);

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
  const [rideState, setRideState] = useState<RideState>("idle");
  const [declineConfirmActive, setDeclineConfirmActive] = useState(false);
  const [declineConfirmStacked, setDeclineConfirmStacked] = useState(false);
  const [showFareBreakdown, setShowFareBreakdown] = useState(false);
  const [incomingTimer, setIncomingTimer] = useState(15);
  const [stackedRideOffer, setStackedRideOffer] = useState<any>(null);
  const [acceptedStackedRideOffer, setAcceptedStackedRideOffer] =
    useState<any>(null);
  const [stackedIncomingTimer, setStackedIncomingTimer] = useState(0);

  const [showStartJobReminder, setShowStartJobReminder] = useState(false);
  const [hasDismissedStartJobReminder, setHasDismissedStartJobReminder] =
    useState(false);

  useEffect(() => {
    if (
      [
        "incoming",
        "en_route_pickup",
        "waiting",
        "in_progress",
        "review",
      ].includes(rideState)
    ) {
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
  const [showHazardModal, setShowHazardModal] = useState(false);
  const [reportingHazardType, setReportingHazardType] = useState<string | null>(
    null,
  );
  const [hazardCountdown, setHazardCountdown] = useState<number>(0);
  const [activeHazards, setActiveHazards] = useState<any[]>([]);
  const [todayEarnings, setTodayEarnings] = useState(0);

  // Fetch active hazards
  useEffect(() => {
    if (!user) return;
    const today = new Date();
    // Only display hazards not yet expired
    const q = query(
      collection(db, "reported_hazards"),
      where("expiresAt", ">", today),
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const results: any[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          results.push({ id: doc.id, ...data });
        });
        setActiveHazards(results);
      },
      (error) => {
        console.error("Error in active hazards listener:", error);
      },
    );
    return () => unsub();
  }, [user]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (reportingHazardType) {
      if (hazardCountdown > 0) {
        timer = setTimeout(() => setHazardCountdown((c) => c - 1), 1000);
      } else {
        reportHazard(reportingHazardType);
      }
    }
    return () => clearTimeout(timer);
  }, [reportingHazardType, hazardCountdown]);

  const reportHazard = async (type: string) => {
    setReportingHazardType(null);
    setShowHazardModal(false);
    if (!user || !mapCenter) return;

    // Add 2 hours expiration
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 2);

    try {
      await addDoc(collection(db, "reported_hazards"), {
        type,
        lat: mapCenter[0],
        lng: mapCenter[1],
        reporterId: user.uid,
        createdAt: serverTimestamp(),
        expiresAt: expiry,
      });
      toast.success(`${type} reported on your route.`);
    } catch (e) {
      console.error("Failed to report hazard", e);
    }
  };

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
    id: "google-map-script",
    googleMapsApiKey: getGoogleMapsApiKey(),
    libraries,
    version: "quarterly",
  });

  // Dynamic Fare & Live Ride Tracking
  const [fareConfig, setFareConfig] = useState<{
    baseFare: number;
    distanceRate: number;
    timeRate: number;
    waitRatePerMinute: number;
    minFare: number;
    priorityFee: number;
    commissionRate: number;
    fixedTripFee?: number;
    allowRiderAbandonment?: boolean;
    surgeEnabled?: boolean;
    surgeModel?: "fixed" | "multiplier";
    surgeFixedAmount?: number;
    surgeMultiplierValue?: number;
    maxDailyDriverHours?: number;
  }>({
    baseFare: 3.5,
    distanceRate: 1.3,
    timeRate: 0.15,
    waitRatePerMinute: 0.25,
    minFare: 5,
    priorityFee: 2.5,
    commissionRate: 0.12,
    maxDailyDriverHours: 12,
  });
  const [activeRide, setActiveRide] = useState<any>(null); // Stores live or simulated ride data
  const externalNavWindowRef = useRef<Window | null>(null);
  const [passengerPos, setPassengerPos] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Listen for passenger live tracking
  useEffect(() => {
    if (!activeRide?.userId) {
      setPassengerPos(null);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "live_tracking", activeRide.userId),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.lat && data.lng) {
            setPassengerPos({ lat: data.lat, lng: data.lng });
          }
        }
      },
    );
    return () => unsub();
  }, [activeRide?.userId]);

  const mapCenterRef = useRef(mapCenter);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [miniMapInstance, setMiniMapInstance] =
    useState<google.maps.Map | null>(null);
  const [mapHeading, setMapHeading] = useState(0);
  const [mapTilt, setMapTilt] = useState(0);
  const [mapZoom, setMapZoom] = useState<number>(15);

  const [driverHeading, setDriverHeading] = useState<number | null>(null);
  const [isAutoNavHeadUp, setIsAutoNavHeadUp] = useState(true);
  const [isAutoNavPaused, setIsAutoNavPaused] = useState(false);
  const isAutoNavPausedRef = useRef(false);

  useEffect(() => {
    isAutoNavPausedRef.current = isAutoNavPaused;
  }, [isAutoNavPaused]);

  const [windowSize, setWindowSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 360,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMuted = profile?.muteHeadsUpVolume === true;
  const navVoiceVolume = isMuted ? 0.0 : 1.0;
  const autoNavPauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const spokenDistancesRef = useRef(new Set<number>());
  const lastZoomResetRef = useRef<{
    rideId: string | null;
    rideState: string | null;
    legIndex: number | null;
  }>({ rideId: null, rideState: null, legIndex: null });
  const lastDirectionsFetchRef = useRef<{
    originLat: number;
    originLng: number;
    destLat: number;
    destLng: number;
    time: number;
  } | null>(null);
  const [recalcCount, setRecalcCount] = useState<number>(0);
  const recalcCountRef = useRef<number>(0);
  const updateRecalcCount = (val: number) => {
    recalcCountRef.current = val;
    setRecalcCount(val);
  };

  useEffect(() => {
    updateRecalcCount(0);
  }, [rideState, activeRide?.id]);
  const [lastSpokenInstruction, setLastSpokenInstruction] =
    useState<string>("");
  const [lastSpokenUpcomingStep, setLastSpokenUpcomingStep] =
    useState<string>("");
  const [hasAnnouncedArrival, setHasAnnouncedArrival] = useState(false);

  const customDragActiveRef = useRef(false);
  const customDragPrevPosRef = useRef({ x: 0, y: 0 });
  const customPinchPrevDistRef = useRef<number | null>(null);

  const handleMapInteraction = () => {
    setIsAutoNavPaused(true);
    if (autoNavPauseTimeoutRef.current) {
      clearTimeout(autoNavPauseTimeoutRef.current);
    }
    autoNavPauseTimeoutRef.current = setTimeout(() => {
      setIsAutoNavPaused(false);
      setDriverLocation(d => {
        setMapCenter(d);
        return d;
      });
    }, 3000); // Resume auto nav after 3s of no interaction per user request
  };

  const handleCustomDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isAutoNavHeadUp || !mapInstance) return;
    
    // Call existing handleMapInteraction to pause auto center/nav
    handleMapInteraction();

    if ("touches" in e && e.touches.length === 2) {
      if (e.cancelable) e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      customPinchPrevDistRef.current = dist;
      customDragActiveRef.current = false;
      return;
    }

    if (e.cancelable) e.preventDefault();
    customDragActiveRef.current = true;
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    customDragPrevPosRef.current = { x: clientX, y: clientY };
  };

  const handleCustomDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!mapInstance) return;

    if ("touches" in e && e.touches.length === 2) {
      if (e.cancelable) e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

      if (customPinchPrevDistRef.current !== null) {
        const diff = dist - customPinchPrevDistRef.current;
        const currentZoom = mapInstance.getZoom() || 15;
        // Continuous fractional zoom increment
        const zoomChange = diff * 0.02; // Increased sensitivity
        const newZoom = Math.max(3, Math.min(21, currentZoom + zoomChange));
        mapInstance.setZoom(newZoom);
      }
      customPinchPrevDistRef.current = dist;
      return;
    }

    if (!customDragActiveRef.current) return;
    if (e.cancelable) e.preventDefault();

    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const dx = clientX - customDragPrevPosRef.current.x;
    const dy = clientY - customDragPrevPosRef.current.y;

    customDragPrevPosRef.current = { x: clientX, y: clientY };

    // Since the Google Map now handles rotation internally via the heading option,
    // panBy operates directly in screen coordinates relative to the user's touch movement.
    const panX = -dx;
    const panY = -dy;

    mapInstance.panBy(panX, panY);
  };

  const handleCustomDragEnd = () => {
    customDragActiveRef.current = false;
    customPinchPrevDistRef.current = null;
  };

  const getBearing = (
    startLat: number,
    startLng: number,
    destLat: number,
    destLng: number,
  ) => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const toDeg = (rad: number) => (rad * 180) / Math.PI;
    const dLng = toRad(destLng - startLng);
    const y = Math.sin(dLng) * Math.cos(toRad(destLat));
    const x =
      Math.cos(toRad(startLat)) * Math.sin(toRad(destLat)) -
      Math.sin(toRad(startLat)) * Math.cos(toRad(destLat)) * Math.cos(dLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  };

  const getOffsetLatLng = (
    lat: number,
    lng: number,
    offsetAheadMeters: number,
    offsetRightMeters: number,
    bearingDegrees: number,
  ): [number, number] => {
    const bearingRad = (bearingDegrees * Math.PI) / 180;
    const metersToLatitude = 1 / 111111;
    const metersToLongitude = 1 / (111111 * Math.cos((lat * Math.PI) / 180));

    // Shift ahead is positive along the travel heading
    const dLatAhead = offsetAheadMeters * Math.cos(bearingRad) * metersToLatitude;
    const dLngAhead = offsetAheadMeters * Math.sin(bearingRad) * metersToLongitude;

    // Shift right is positive to the right of travel heading (bearing + 90 degrees)
    const rightRad = bearingRad + Math.PI / 2;
    const dLatRight = offsetRightMeters * Math.cos(rightRad) * metersToLatitude;
    const dLngRight = offsetRightMeters * Math.sin(rightRad) * metersToLongitude;

    return [lat + dLatAhead + dLatRight, lng + dLngAhead + dLngRight];
  };

  const getDynamicZoomForDistance = (distanceMeters: number): number => {
    if (distanceMeters <= 80) {
      return 18.5; // Very close, highly detailed junction view
    } else if (distanceMeters <= 200) {
      return 18.0; // Close maneuver view
    } else if (distanceMeters <= 500) {
      return 17.5; // Approach view
    } else if (distanceMeters <= 1000) {
      return 16.5; // Normal city driving view
    } else if (distanceMeters <= 2500) {
      return 15.5; // Regional route view
    } else {
      return 14.5; // Large scale preview for highways/long drives
    }
  };

  const getDynamicOffsetLatLng = (
    lat: number,
    lng: number,
    bearingDegrees: number,
    zoomLevel: number
  ): [number, number] => {
    // Since the map is standard 2D Raster (always North-Up due to WebGL limitations of custom JSON styling),
    // we must offset the camera center relative to the physical screen boundaries.
    // Horizontal: The car marker should be centered (0px horizontal offset).
    // Vertical: To avoid the bottom card/sheet (which obscures the bottom ~210px) and top control panel (~110px),
    // we offset the camera Southwards, which visually pushes the car marker UP/Northward on the screen so it is
    // centered in the remaining visible space.
    // Centering the marker vertically in the visible window of a standard 800px screen corresponds to
    // shifting the marker UP by ~75px, meaning we pan the camera center DOWN (South) by 75px.
    const metersPerPixel = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoomLevel);
    
    // We shift the camera center Southwards to move the marker Northwards on the screen.
    const offsetSouthMeters = 80 * metersPerPixel; // Optimal 80px shift to stay clear of bottom sheet/HUD
    const metersToLatitude = 1 / 111111;
    const latOffset = -offsetSouthMeters * metersToLatitude;

    return [lat + latOffset, lng];
  };

  useEffect(() => {
    mapCenterRef.current = mapCenter;
  }, [mapCenter]);

  const handleCenterOnMe = () => {
    if (mapInstance && mapCenterRef.current) {
      let lat = mapCenterRef.current[0];
      let lng = mapCenterRef.current[1];
      if (isAutoNavHeadUp) {
        const [offsetLat, offsetLng] = getDynamicOffsetLatLng(
          lat,
          lng,
          mapHeading || 0,
          15
        );
        lat = offsetLat;
        lng = offsetLng;
      }
      mapInstance.panTo({ lat, lng });
      mapInstance.setZoom(15);
      setMapZoom(15);
    } else {
      setMapCenter([mapCenterRef.current[0], mapCenterRef.current[1]]);
    }
  };

  const handleToggleAutoNav = () => {
    setIsAutoNavHeadUp((prev) => {
      const next = !prev;
      if (!next && mapInstance && directions) {
        // When disabling head up mode, fit to route overview
        const bounds = directions.routes[0]?.bounds;
        if (bounds) {
          const maxDim = Math.max(window.innerWidth, window.innerHeight);
          const mapSize = maxDim * 1.45;
          const overflowX = (mapSize - window.innerWidth) / 2;
          const overflowY = (mapSize - window.innerHeight) / 2;
          
          // Analytical calculation to place the driver's live location marker and route optimally on screen
          const leg = directions.routes[0]?.legs?.[currentLegIndex || 0] || directions.routes[0]?.legs?.[0];
          if (leg && leg.end_location) {
            const destLoc = leg.end_location;
            const destLat = typeof destLoc.lat === "function" ? destLoc.lat() : destLoc.lat;
            const destLng = typeof destLoc.lng === "function" ? destLoc.lng() : destLoc.lng;
            const driverLat = driverLocationRef.current[0];
            const driverLng = driverLocationRef.current[1];
            
            // Calculate lat/lng bounds differences with minimum threshold protection to prevent division by zero
            const latDiff = Math.max(0.001, Math.abs(destLat - driverLat));
            const lngDiff = Math.max(0.0012, Math.abs(destLng - driverLng));
            
            // Convert differences to approximate physical meters
            const latMeters = latDiff * 111111;
            const lngMeters = lngDiff * 111111 * Math.cos((driverLat * Math.PI) / 180);
            
            const width = window.innerWidth;
            const height = window.innerHeight;
            
            // Limit pixel boundaries to keep destination fully within the screen area
            const pixelWidthLimit = Math.max(150, width - 160);
            const pixelHeightLimit = Math.max(150, height - 360); // leaves 220px on one end and 140px on the other
            
            // Calculate required Meters Per Pixel on each axis
            const mppX = lngMeters / pixelWidthLimit;
            const mppY = latMeters / pixelHeightLimit;
            const requiredMpp = Math.max(mppX, mppY, 0.1);
            
            // Calculate target zoom level using the exact Mercator scale relationship
            let zoom = Math.log2((156543.03392 * Math.cos((driverLat * Math.PI) / 180)) / requiredMpp);
            zoom = Math.max(12, Math.min(18, zoom)) - 0.45; // Safe margin subtraction for padding comfort
            
            // Determine relative direction of destination to dynamically position driver screen coordinates
            const isDestNorth = destLat > driverLat;
            const heading = isDestNorth ? 0 : 180;
            
            // Apply the map heading dynamically in overview mode so that travel is always oriented upwards!
            setMapHeading(heading);
            mapInstance.setHeading(heading);
            
            // Since the route direction is rotated to always point UPWARD on screen,
            // the destination (regardless of physically North/South) will visually be in front (UP),
            // and the driver marker will visually be in the rear (DOWN).
            // So we always position the driver marker at the bottom of the screen!
            const targetX = width / 2; // Clean horizontal centering
            const targetY = height - 220; // leaves 220px of negative space for bottom sheet interaction
            
            const centerX = width / 2;
            const centerY = height / 2;
            
            // Pixel offsets from screen center
            const shiftX_pixels = centerX - targetX; 
            const shiftY_pixels = centerY - targetY; 
            
            const metersPerPixel = (156543.03392 * Math.cos((driverLat * Math.PI) / 180)) / Math.pow(2, zoom);
            
            const shiftX_meters = shiftX_pixels * metersPerPixel;
            const shiftY_meters = -shiftY_pixels * metersPerPixel; // Negated due to inverse screen/geo Y coordinate flow
            
            // Apply 2D rotation of the camera shift vector based on the map's compass heading
            const rad = (heading * Math.PI) / 180;
            const cosVal = Math.cos(rad);
            const sinVal = Math.sin(rad);
            
            const rotX = shiftX_meters * cosVal - shiftY_meters * sinVal;
            const rotY = shiftX_meters * sinVal + shiftY_meters * cosVal;
            
            const metersToLatitude = 1 / 111111;
            const metersToLongitude = 1 / (111111 * Math.cos((driverLat * Math.PI) / 180));
            
            const latOffset = rotY * metersToLatitude;
            const lngOffset = rotX * metersToLongitude;
            
            const targetCenterLat = driverLat + latOffset;
            const targetCenterLng = driverLng + lngOffset;
            
            // Apply zoom and center atomically
            mapInstance.setZoom(zoom);
            setMapZoom(zoom);
            setMapCenter([targetCenterLat, targetCenterLng]);
            mapInstance.panTo({ lat: targetCenterLat, lng: targetCenterLng });
          } else {
            // Fallback to standard bounds adjustment if legs are not ready
            mapInstance.fitBounds(bounds, {
              top: 100 + overflowY,
              bottom: 350 + overflowY,
              left: 20 + overflowX,
              right: 20 + overflowX,
            });
          }
          
          setIsAutoNavPaused(true);
          if (autoNavPauseTimeoutRef.current) {
            clearTimeout(autoNavPauseTimeoutRef.current);
          }
        }
      } else {
        setIsAutoNavPaused(false);
        setDriverLocation(d => {
          setMapCenter(d);
          return d;
        });
        if (autoNavPauseTimeoutRef.current) {
          clearTimeout(autoNavPauseTimeoutRef.current);
        }
      }
      return next;
    });
    triggerHaptic(ImpactStyle.Light);
    toast.success(
      isAutoNavHeadUp ? "Navigation overview" : "Head-up navigation started",
    );
  };



  const formatInstructionForDisplay = (htmlInstruction: string) => {
    let formatted = htmlInstruction;

    const isGoingStraight = /^\s*(?:<[^>]*>)?\s*(?:Head|Proceed)\b/i.test(formatted);

    // Terminology adjustments with HTML tags supported
    // Matches "Head <b>east</b>" or "Head east" or "Proceed <b>north</b>"
    formatted = formatted.replace(
      /(?:Head|Proceed)\s*(?:<[^>]*>)?\s*(?:north|south|east|west)(?:[\s-]*(?:east|west))?(?:ward)?\s*(?:<[^>]*>)?/ig,
      'Go straight ahead'
    );
    
    if (isGoingStraight) {
       // Remove "toward" and everything after it for straight instructions
       // Covers " <b>toward</b> Destination"
       formatted = formatted.replace(/\s*(?:<[^>]*>)?\s*\b(?:toward|towards)\b.*$/ig, "");
    }

    formatted = formatted.replace(/\bMerge onto\b/ig, 'Join');
    formatted = formatted.replace(/\bTraffic circle\b/ig, 'Roundabout');
    
    // Change exit numbers to text
    formatted = formatted.replace(/1st exit/ig, 'first exit');
    formatted = formatted.replace(/2nd exit/ig, 'second exit');
    formatted = formatted.replace(/3rd exit/ig, 'third exit');
    formatted = formatted.replace(/4th exit/ig, 'fourth exit');
    formatted = formatted.replace(/5th exit/ig, 'fifth exit');

    // Common UK abbreviations
    const abbreviations: Record<string, string> = {
      'St': 'Street',
      'Rd': 'Road',
      'Dr': 'Drive',
      'Ave': 'Avenue',
      'Ln': 'Lane',
      'Blvd': 'Boulevard',
      'Ct': 'Court',
      'Pl': 'Place',
      'Sq': 'Square',
      'Terr': 'Terrace',
      'Wy': 'Way',
      'Apts': 'Apartments',
      'Bldg': 'Building',
      'Hwy': 'Highway',
      'Cl': 'Close',
      'N': 'North',
      'S': 'South',
      'E': 'East',
      'W': 'West',
      'NE': 'Northeast',
      'NW': 'Northwest',
      'SE': 'Southeast',
      'SW': 'Southwest'
    };

    // Replace abbreviations with full words, ensuring word boundaries
    // We add an optional dot in case Maps returns 'Rd.' and use ignore case
    // We use a negative lookahead to ensure we don't accidentally replace inside HTML tags
    Object.entries(abbreviations).forEach(([abbr, full]) => {
      // The word to replace, maybe with a dot
      const regex = new RegExp(`\\b${abbr}\\b\\.?(?![^<]*>)`, 'gi');
      
      // Preserve the original casing of the first letter if possible, 
      // but simplistic replacement works fine here since routes are usually Title Case.
      formatted = formatted.replace(regex, (match) => {
        // If it was all caps, return all caps
        if (match.toUpperCase() === match) return full.toUpperCase();
        // If it was lowercase, return lowercase
        if (match.toLowerCase() === match) return full.toLowerCase();
        // Default to the full string (typically Title Case)
        return full;
      });
    });

    return formatted;
  };

  const formatInstructionForTTS = (htmlInstruction: string) => {
    let plainText = htmlInstruction.replace(/<[^>]*>?/gm, "");

    const isGoingStraight = /^\s*(?:Head|Proceed)\b/i.test(plainText);

    // Common UK abbreviations
    const abbreviations: Record<string, string> = {
      'St': 'Street',
      'Rd': 'Road',
      'Dr': 'Drive',
      'Ave': 'Avenue',
      'Ln': 'Lane',
      'Blvd': 'Boulevard',
      'Ct': 'Court',
      'Pl': 'Place',
      'Sq': 'Square',
      'Terr': 'Terrace',
      'Wy': 'Way',
      'Apts': 'Apartments',
      'Bldg': 'Building',
      'Hwy': 'Highway',
      'Cl': 'Close',
      'N': 'North',
      'S': 'South',
      'E': 'East',
      'W': 'West',
      'NE': 'Northeast',
      'NW': 'Northwest',
      'SE': 'Southeast',
      'SW': 'Southwest'
    };

    // Replace abbreviations with full words, ensuring word boundaries and ignoring casing where appropriate
    Object.entries(abbreviations).forEach(([abbr, full]) => {
      const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
      plainText = plainText.replace(regex, full);
    });

    // Terminology adjustments
    plainText = plainText.replace(/(?:Head|Proceed)\s+(?:north|south|east|west)(?:[\s-]*(?:east|west))?(?:ward)?/gi, 'Go straight ahead');
    
    if (isGoingStraight) {
      plainText = plainText.replace(/\b(?:toward|towards)\b.*/i, "");
    }

    plainText = plainText.replace(/Merge onto/gi, 'Join');
    plainText = plainText.replace(/Traffic circle/gi, 'Roundabout');
    
    // Change exit numbers to spoken text for better TTS
    plainText = plainText.replace(/1st exit/gi, 'first exit');
    plainText = plainText.replace(/2nd exit/gi, 'second exit');
    plainText = plainText.replace(/3rd exit/gi, 'third exit');
    plainText = plainText.replace(/4th exit/gi, 'fourth exit');
    plainText = plainText.replace(/5th exit/gi, 'fifth exit');

    return plainText;
  };

  // TTS Interruption Recovery (Resume if interrupted by OS/Phone call)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isCapacitor() && window.speechSynthesis && window.speechSynthesis.paused) {
         window.speechSynthesis.resume();
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    const resumeInterval = setInterval(() => {
      if (!isCapacitor() && window.speechSynthesis && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }, 5000);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(resumeInterval);
    };
  }, []);

  useEffect(() => {
    if (
      isAutoNavHeadUp &&
      directions?.routes?.[0]?.legs?.[0]?.steps?.[0]?.instructions
    ) {
      const steps = directions.routes[0].legs[0].steps;
      const currentStepIndex = mapCenter ? getCurrentStepIndex(mapCenter, steps) : 0;
      
      if (currentStepIndex >= steps.length) return;
      
      const step0 = steps[currentStepIndex];
      const htmlInstruction = step0.instructions;
      const plainText = formatInstructionForTTS(htmlInstruction);

      // Lookahead logic using live distance mapped to polyline
      let liveDistanceToTurn = step0.distance?.value || 0;
      if (mapCenter) {
        liveDistanceToTurn = getRemainingStepDistance(mapCenter, step0);
      }

      let initialSpokenText = plainText;
      if (liveDistanceToTurn <= 50 && currentStepIndex < steps.length - 1) {
        const nextPlain = formatInstructionForTTS(steps[currentStepIndex + 1].instructions);
        initialSpokenText = `${plainText} then ${nextPlain}`;
      }

      if (initialSpokenText && initialSpokenText !== lastSpokenInstruction) {
        setLastSpokenInstruction(initialSpokenText);
        spokenDistancesRef.current.clear();

        if (navVoiceVolume > 0) {
          // Speak the initial step instruction
          speakText(initialSpokenText, navVoiceVolume);
        }
      }

      // Mark thresholds as passed if user starts closer than them
      if (liveDistanceToTurn < 950) spokenDistancesRef.current.add(1000);
      if (liveDistanceToTurn < 350) spokenDistancesRef.current.add(400);
      if (liveDistanceToTurn < 80) spokenDistancesRef.current.add(100);

      const checkAndSpeak = (threshold: number, distString: string, distanceMargin: number) => {
        if (!spokenDistancesRef.current.has(threshold) && liveDistanceToTurn <= threshold) {
          spokenDistancesRef.current.add(threshold); // mark as passed
          
          if (liveDistanceToTurn > (threshold - distanceMargin)) {
            let nextPlain = "arriving at destination";
            let doubleTurnPlain = "";
            
            if (currentStepIndex < steps.length - 1) {
              const nextHtmlInstruction = steps[currentStepIndex + 1].instructions;
              nextPlain = formatInstructionForTTS(nextHtmlInstruction);
              
              if (currentStepIndex < steps.length - 2) {
                const step2Dist = steps[currentStepIndex + 1].distance?.value || 0;
                if (step2Dist <= 50) {
                  doubleTurnPlain = " then " + formatInstructionForTTS(steps[currentStepIndex + 2].instructions);
                }
              }
            }

            if (navVoiceVolume > 0) {
              const prepPhrase = `In ${distString}`;
              speakText(`${prepPhrase}, ${nextPlain}${doubleTurnPlain}`, navVoiceVolume);
            }
          }
        }
      };

      checkAndSpeak(1000, "1000 meters", 150);
      checkAndSpeak(400, "400 meters", 100);
      checkAndSpeak(100, "100 meters", 40);
    }
  }, [
    directions,
    mapCenter,
    currentLegIndex,
    isAutoNavHeadUp,
    lastSpokenInstruction,
    navVoiceVolume,
  ]);

  // Reset hasAnnouncedArrival on new ride or leg
  useEffect(() => {
    setHasAnnouncedArrival(false);
  }, [rideState, currentLegIndex, activeRide?.id]);

  useEffect(() => {
    if (
      directions?.routes?.[0]?.legs?.[0] &&
      isAutoNavHeadUp &&
      (rideState === "en_route_pickup" || rideState === "in_progress")
    ) {
      const leg = directions.routes[0].legs[0];
      let remainingDistance = leg.distance?.value || 0;
      if (mapCenter && leg.steps) {
        const curIdx = getCurrentStepIndex(mapCenter, leg.steps);
        remainingDistance = getRemainingLegDistance(mapCenter, leg.steps, curIdx);
      }

      if (
        remainingDistance > 0 &&
        remainingDistance <= 100 &&
        !hasAnnouncedArrival
      ) {
        setHasAnnouncedArrival(true);
        if (navVoiceVolume > 0) {
          const text =
            rideState === "en_route_pickup"
              ? "You have arrived at the pickup location."
              : "You have arrived at your destination.";
          speakText(text, navVoiceVolume);
        }
        if (mapInstance && (mapInstance.getZoom() || 0) < 18) {
          mapInstance.setZoom(18);
          setMapZoom(18);
        }
      }
    }
  }, [
    directions,
    mapCenter,
    rideState,
    hasAnnouncedArrival,
    navVoiceVolume,
    mapInstance,
    isAutoNavHeadUp,
  ]);

  const handleStartExternalNavigation = () => {
    if (!activeRide) return;

    const navApp = profile?.defaultNavApp || "Google Maps";
    let url = "";

    const destLat = rideState === "en_route_pickup" ? activeRide.pickupLat : activeRide.dropoffLat;
    const destLng = rideState === "en_route_pickup" ? activeRide.pickupLng : activeRide.dropoffLng;
    
    if (!destLat || !destLng) return;

    if (navApp === "Waze") {
      url = `https://waze.com/ul?ll=${destLat},${destLng}&navigate=yes`;
    } else if (navApp === "Apple Maps") {
      url = `http://maps.apple.com/?daddr=${destLat},${destLng}&dirflg=d`;
    } else {
      url = "https://www.google.com/maps/dir/?api=1";
      if (rideState === "en_route_pickup") {
        url += `&destination=${activeRide.pickupLat},${activeRide.pickupLng}`;
      } else if (rideState === "in_progress") {
        url += `&destination=${activeRide.dropoffLat},${activeRide.dropoffLng}`;
        // Add waypoints if there are stops and we haven't passed them
        if (
          activeRide.stops &&
          activeRide.stops.length > 0 &&
          currentLegIndex < activeRide.stops.length
        ) {
          const remainingStops = activeRide.stops.slice(currentLegIndex);
          const waypoints = remainingStops
            .map((stop: any) =>
              stop.coords ? `${stop.coords.lat},${stop.coords.lng}` : "",
            )
            .filter(Boolean)
            .join("|");
          if (waypoints) {
            url += `&waypoints=${waypoints}`;
          }
        }
      } else {
        return;
      }
      url += "&travelmode=driving";
    }

    externalNavWindowRef.current = window.open(url, "_blank");
    toast.success(`Starting ${navApp}...`);
  };

  // Handle center for 'waiting' state to account for drawer height
  useEffect(() => {
    if (
      mapInstance &&
      rideState === "waiting" &&
      activeRide?.pickupLat &&
      activeRide?.pickupLng
    ) {
      const pt = new window.google.maps.LatLng(
        activeRide.pickupLat,
        activeRide.pickupLng,
      );
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
    const fetchDirections = async (destLat: number, destLng: number) => {
      if (!window.google || !window.google.maps) return;

      const originLat = driverLocationRef.current[0];
      const originLng = driverLocationRef.current[1];

      if (
        typeof originLat !== "number" ||
        isNaN(originLat) ||
        typeof originLng !== "number" ||
        isNaN(originLng) ||
        typeof destLat !== "number" ||
        isNaN(destLat) ||
        typeof destLng !== "number" ||
        isNaN(destLng) ||
        (Math.abs(originLat) < 0.1 && Math.abs(originLng) < 0.1) ||
        (Math.abs(destLat) < 0.1 && Math.abs(destLng) < 0.1)
      ) {
        console.warn("Invalid coordinates for directions:", {
          originLat,
          originLng,
          destLat,
          destLng,
        });
        return;
      }

      if (
        Math.abs(originLat - destLat) < 0.0001 &&
        Math.abs(originLng - destLng) < 0.0001
      )
        return;

      // Smart API call reduction logic
      const now = Date.now();
      let isRecalculation = false;
      if (lastDirectionsFetchRef.current) {
        const last = lastDirectionsFetchRef.current;
        const originMoved = getDistanceInMeters(
          last.originLat,
          last.originLng,
          originLat,
          originLng,
        );
        const destMoved = getDistanceInMeters(
          last.destLat,
          last.destLng,
          destLat,
          destLng,
        );
        const timeSinceLastFetch = now - last.time;

        let isOffRoute = false;

        // Calculate distance from current driver location to the defined route polyline
        if (currentDirectionsRef.current?.routes?.[0]?.overview_path) {
          let minDistanceToRoute = Infinity;
          const path = currentDirectionsRef.current.routes[0].overview_path;
          
          if (path.length > 0) {
            const toRad = Math.PI / 180;
            const R = 6371e3; // Earth radius in meters
            const lat0 = originLat * toRad;
            const lng0 = originLng * toRad;

            for (let i = 0; i < path.length - 1; i++) {
              const p1 = path[i];
              const p2 = path[i + 1];
              const lat1 = (typeof p1.lat === "function" ? p1.lat() : p1.lat as unknown as number) * toRad;
              const lng1 = (typeof p1.lng === "function" ? p1.lng() : p1.lng as unknown as number) * toRad;
              const lat2 = (typeof p2.lat === "function" ? p2.lat() : p2.lat as unknown as number) * toRad;
              const lng2 = (typeof p2.lng === "function" ? p2.lng() : p2.lng as unknown as number) * toRad;

              const x0 = lng0 * Math.cos(lat1);
              const y0 = lat0;
              const x1 = lng1 * Math.cos(lat1);
              const y1 = lat1;
              const x2 = lng2 * Math.cos(lat2);
              const y2 = lat2;

              const dx = x2 - x1;
              const dy = y2 - y1;
              const l2 = dx * dx + dy * dy;

              let t = 0;
              if (l2 > 0) {
                t = Math.max(0, Math.min(1, ((x0 - x1) * dx + (y0 - y1) * dy) / l2));
              }
              const px = x1 + t * dx;
              const py = y1 + t * dy;

              const dRad = Math.sqrt((x0 - px) ** 2 + (y0 - py) ** 2);
              const dist = dRad * R;

              if (dist < minDistanceToRoute) {
                minDistanceToRoute = dist;
              }
            }
            
            // Handle edge case of 1 waypoint only path
            if (path.length === 1) {
              const p = path[0];
              const plat = typeof p.lat === "function" ? p.lat() : p.lat as unknown as number;
              const plng = typeof p.lng === "function" ? p.lng() : p.lng as unknown as number;
              minDistanceToRoute = getDistanceInMeters(plat, plng, originLat, originLng);
            }
          }

          // If the minimum distance to the polyline is > 50 meters, they are "off route"
          if (minDistanceToRoute > 50) {
            isOffRoute = true;
          }
        } else {
          isOffRoute = true;
        }

        // Smart API call reduction logic to save $$$
        // We SKIP fetching new directions IF:
        // 1. Destination hasn't changed (destMoved < 50m)
        // AND 2. Less than 60 seconds have passed since last fetch (prevents spamming API for traffic/ETA updates)
        // AND 3. The driver is ON ROUTE (not off route)
        if (destMoved < 50) {
          if (isOffRoute) {
            isRecalculation = true;
          }

          if (isRecalculation && recalcCountRef.current >= 3) {
            console.log("Recalculation limit reached (3/3). Skipping directions API fetch to save costs.");
            return;
          }

          if (!isOffRoute && timeSinceLastFetch < 60000) {
            return; // Skip fetch, they are on route and data is fresh enough (saves MASSIVE costs)
          }
          if (isOffRoute && timeSinceLastFetch < 5000) {
            return; // Throttle off-route recalculations to max once every 5 seconds to prevent spam
          }
        }
      }

      const directionsService = new window.google.maps.DirectionsService();

      directionsService.route(
        {
          origin: new window.google.maps.LatLng(originLat, originLng),
          destination: new window.google.maps.LatLng(destLat, destLng),
          travelMode: window.google.maps.TravelMode.DRIVING,
          region: "GB",
          language: "en-GB",
        },
        (result, status) => {
          if (status === window.google.maps.DirectionsStatus.OK && result) {
            setDirections(result);
            if (isInitialFitBounds && mapInstance && result?.routes?.[0]?.bounds) {
              const maxDim = Math.max(window.innerWidth, window.innerHeight);
              const mapSize = maxDim * 1.45;
              const overflowX = (mapSize - window.innerWidth) / 2;
              const overflowY = (mapSize - window.innerHeight) / 2;
              mapInstance.fitBounds(result.routes[0].bounds, {
                top: 100 + overflowY,
                bottom: 350 + overflowY,
                left: 20 + overflowX,
                right: 20 + overflowX,
              });
              isInitialFitBounds = false;
            }

            if (isRecalculation) {
              updateRecalcCount(recalcCountRef.current + 1);
            }

            lastDirectionsFetchRef.current = {
              originLat,
              originLng,
              destLat,
              destLng,
              time: now,
            };
          } else {
            if (status !== window.google.maps.DirectionsStatus.UNKNOWN_ERROR) {
              console.warn(
                "DirectionsService failed:",
                status,
                "Origin:",
                originLat,
                originLng,
                "Dest:",
                destLat,
                destLng
              );
            }
          }
        }
      ).catch(() => {
        // Silently catch the unhandled promise rejection that Maps API throws for UNKNOWN_ERROR
      });
    };

    const updateDynamicDirections = () => {
      if (
        rideState === "en_route_pickup" &&
        activeRide?.pickupLat &&
        activeRide?.pickupLng
      ) {
        if (isLoaded)
          fetchDirections(activeRide.pickupLat, activeRide.pickupLng);
      } else if (
        rideState === "in_progress" &&
        activeRide?.dropoffLat &&
        activeRide?.dropoffLng
      ) {
        let destLat = activeRide.dropoffLat;
        let destLng = activeRide.dropoffLng;

        if (
          activeRide.stops &&
          activeRide.stops.length > 0 &&
          currentLegIndex < activeRide.stops.length
        ) {
          const currentStop = activeRide.stops[currentLegIndex];
          if (currentStop?.coords) {
            destLat = currentStop.coords.lat;
            destLng = currentStop.coords.lng;
          }
        }

        if (isLoaded) fetchDirections(destLat, destLng);
      } else {
        setDirections(null);
      }
    };

    updateDynamicDirections();
    intervalId = setInterval(updateDynamicDirections, 5000);

    return () => clearInterval(intervalId);
  }, [
    rideState,
    activeRide?.id,
    activeRide?.pickupLat,
    activeRide?.pickupLng,
    activeRide?.dropoffLat,
    activeRide?.dropoffLng,
    isLoaded,
    mapInstance,
    currentLegIndex,
  ]);

  // Handle Map Orientation (Head Up North / Direction of Travel)
  useEffect(() => {
    if (!mapInstance) return;

    if (!isAutoNavHeadUp) {
      let overviewHeading = 0;
      const leg = directions?.routes?.[0]?.legs?.[currentLegIndex || 0] || directions?.routes?.[0]?.legs?.[0];
      if (leg && leg.end_location) {
        const destLoc = leg.end_location;
        const destLat = typeof destLoc.lat === "function" ? destLoc.lat() : destLoc.lat;
        const driverLat = driverLocationRef.current[0];
        const isDestNorth = destLat > driverLat;
        overviewHeading = isDestNorth ? 0 : 180;
      }
      setMapHeading(overviewHeading);
      setMapTilt(0);
      return;
    }

    if (isAutoNavPaused) {
      return; // Do nothing if paused, leave map at whatever user set
    }

    if (
      rideState === "en_route_pickup" &&
      activeRide?.pickupLat &&
      activeRide?.pickupLng
    ) {
      let targetBearing = null;
      const legSteps = directions?.routes?.[0]?.legs?.[0]?.steps;
      if (legSteps && legSteps.length > 0) {
        const curStepIdx = mapCenter ? getCurrentStepIndex(mapCenter, legSteps) : 0;
        const step = legSteps[curStepIdx] || legSteps[0];
        const p1 = step.start_location;
        const p2 = step.end_location;
        if (p1 && p2) {
          targetBearing = getBearing(p1.lat(), p1.lng(), p2.lat(), p2.lng());
        }
      }
      if (targetBearing === null || isNaN(targetBearing)) {
        targetBearing = driverHeading;
      }
      if (targetBearing === null || isNaN(targetBearing)) {
        if (
          directions &&
          directions.routes &&
          directions.routes[0] &&
          directions.routes[0].overview_path.length > 1
        ) {
          const path = directions.routes[0].overview_path;
          targetBearing = getBearing(
            path[0].lat(),
            path[0].lng(),
            path[1].lat(),
            path[1].lng(),
          );
        } else {
          targetBearing = getBearing(
            mapCenterRef.current[0],
            mapCenterRef.current[1],
            activeRide.pickupLat,
            activeRide.pickupLng,
          );
        }
      }
      setMapHeading(targetBearing);
      setMapTilt(0); 
      if (directions) {
        const remainingDistance = directions.routes?.[0]?.legs?.[0]?.distance?.value || 1000;
        const desiredZoom = getDynamicZoomForDistance(remainingDistance);
        
        if (mapZoom !== desiredZoom) {
          setMapZoom(desiredZoom);
        }
      }
    } else if (
      rideState === "in_progress" &&
      activeRide?.dropoffLat &&
      activeRide?.dropoffLng
    ) {
      let targetLat = activeRide.dropoffLat;
      let targetLng = activeRide.dropoffLng;

      if (
        activeRide.stops &&
        activeRide.stops.length > 0 &&
        currentLegIndex < activeRide.stops.length
      ) {
        const currentStop = activeRide.stops[currentLegIndex];
        if (currentStop?.coords) {
          targetLat = currentStop.coords.lat;
          targetLng = currentStop.coords.lng;
        }
      }

      let targetBearing = null;
      const legSteps = directions?.routes?.[0]?.legs?.[0]?.steps;
      if (legSteps && legSteps.length > 0) {
        const curStepIdx = mapCenter ? getCurrentStepIndex(mapCenter, legSteps) : 0;
        const step = legSteps[curStepIdx] || legSteps[0];
        const p1 = step.start_location;
        const p2 = step.end_location;
        if (p1 && p2) {
          targetBearing = getBearing(p1.lat(), p1.lng(), p2.lat(), p2.lng());
        }
      }
      if (targetBearing === null || isNaN(targetBearing)) {
        targetBearing = driverHeading;
      }
      if (targetBearing === null || isNaN(targetBearing)) {
        // Try getting path bearing from directions
        if (directions && directions.routes && directions.routes[0]) {
          const leg = directions.routes[0].legs[0];
          if (leg && leg.steps && leg.steps.length > 0) {
            const curStepIdx = mapCenter ? getCurrentStepIndex(mapCenter, leg.steps) : 0;
            const step = leg.steps[curStepIdx] || leg.steps[0];
            const p1 = step.start_location;
            const p2 = step.end_location;
            targetBearing = getBearing(p1.lat(), p1.lng(), p2.lat(), p2.lng());
          } else {
            targetBearing = getBearing(
              mapCenterRef.current[0],
              mapCenterRef.current[1],
              targetLat,
              targetLng,
            );
          }
        } else {
          targetBearing = getBearing(
            mapCenterRef.current[0],
            mapCenterRef.current[1],
            targetLat,
            targetLng,
          );
        }
      }

      setMapHeading(targetBearing);
      setMapTilt(0);
      if (directions) {
        const remainingDistance = directions.routes?.[0]?.legs?.[0]?.distance?.value || 1000;
        const desiredZoom = getDynamicZoomForDistance(remainingDistance);
        
        if (mapZoom !== desiredZoom) {
          setMapZoom(desiredZoom);
        }
      }
    } else {
      if (driverHeading !== null && driverHeading !== undefined) {
        setMapHeading(driverHeading);
        setMapTilt(0);
        
        const desiredZoom = rideState === "waiting" ? 17 : 15;
        if (mapZoom !== desiredZoom) {
          setMapZoom(desiredZoom);
        }
      } else {
        setMapHeading(0);
        setMapTilt(0);
        
        const desiredZoom = rideState === "waiting" ? 17 : 15;
        if (mapZoom !== desiredZoom) {
          setMapZoom(desiredZoom);
        }
      }
    }
  }, [
    rideState,
    isAutoNavHeadUp,
    isAutoNavPaused,
    mapInstance,
    driverHeading,
    activeRide?.pickupLat,
    activeRide?.pickupLng,
    activeRide?.dropoffLat,
    activeRide?.dropoffLng,
    mapCenter,
    directions,
    currentLegIndex,
    mapZoom,
  ]);

  // Listen to Taxi Command Settings (platform_config/rides)
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "platform_config", "rides"),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFareConfig((prev) => ({
            ...prev,
            baseFare: Number(data.baseFare) || 3.5,
            distanceRate: Number(data.distanceRate) || 1.3,
            timeRate: Number(data.timeRate) || 0.15,
            waitRatePerMinute: Number(data.waitRatePerMinute) || 0.25,
            minFare: Number(data.minFare) || 5.0,
            priorityFee: Number(data.priorityFee) || 3.0,
            commissionRate:
              data.commissionRate !== undefined
                ? Number(data.commissionRate)
                : 0.12,
            fixedTripFee: data.fixedTripFee !== undefined ? Number(data.fixedTripFee) : 0,
            allowRiderAbandonment: data.allowRiderAbandonment || false,
            surgeEnabled:
              data.surgeEnabled !== undefined
                ? data.surgeEnabled
                : prev.surgeEnabled,
            surgeModel: data.surgeModel || prev.surgeModel,
            surgeFixedAmount: data.surgeFixedAmount
              ? Number(data.surgeFixedAmount)
              : prev.surgeFixedAmount,
            surgeMultiplierValue: data.surgeMultiplierValue
              ? Number(data.surgeMultiplierValue)
              : prev.surgeMultiplierValue,
          }));
        }
      },
      (error) => {
        console.error("Firestore Rides Config Error:", error);
      },
    );
    return () => unsub();
  }, []);

  // Listen to Driver Metrics for today's earnings
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      doc(db, "driver_metrics", user.uid),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const today = new Date().toISOString().split("T")[0];
          if (data.date === today) {
            setTodayEarnings(data.dailyEarnings || 0);
          }
        }
      },
    );
    return () => unsub();
  }, [user]);

  // Listen for REAL incoming live ride requests (offered to this driver)
  useEffect(() => {
    if (!isOnline || !user) return;
    if (rideState !== "idle" && rideState !== "in_progress") return;

    const q = query(
      collection(db, "ride_requests"),
      where("status", "==", "offered"),
      where("assignedDriverId", "==", user.uid),
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
          paymentMethod: data.paymentMethod,
        };

        // Calculate remaining time for the offer
        const expiresAt = new Date(data.offerExpiresAt).getTime();
        const remaining = Math.max(
          0,
          Math.floor((expiresAt - Date.now()) / 1000),
        );

        if (rideState === "idle") {
          setActiveRide(rideData);
          setIncomingTimer(remaining);
          setRideState("incoming");
        } else if (rideState === "in_progress") {
          if (!stackedRideOffer) {
            setStackedRideOffer(rideData);
            setStackedIncomingTimer(remaining);
          }
        }
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]);
      } else {
        if (
          rideState === "in_progress" &&
          stackedRideOffer &&
          stackedRideOffer.isReal !== false
        ) {
          setStackedRideOffer(null);
        }
      }
    });

    return () => unsub();
  }, [isOnline, rideState, user, stackedRideOffer]);

  // Listen to Active Ride for Cancellations
  useEffect(() => {
    if (
      !activeRide?.isReal ||
      !activeRide?.id ||
      rideState === "idle" ||
      rideState === "incoming"
    )
      return;

    const unsub = onSnapshot(
      doc(db, "ride_requests", activeRide.id),
      async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.status === "cancelled" && data.cancelledBy === "passenger") {
            toast.error("Ride Cancelled", {
              description: "The passenger has cancelled the ride.",
              duration: 6000,
            });

            if (data.cancellationFee > 0 && user) {
              toast.success("Cancellation Fee Applied", {
                description: `You have been credited £${data.cancellationFee.toFixed(2)} for the cancellation.`,
              });
              // Credit the driver metric
              const today = new Date().toISOString().split("T")[0];
              await setDoc(
                doc(db, "driver_metrics", user.uid),
                {
                  date: today,
                  dailyEarnings: increment(data.cancellationFee),
                  updatedAt: serverTimestamp(),
                },
                { merge: true },
              );
            }

            if (user) {
              updateDoc(doc(db, "driver_status", user.uid), {
                isBusy: false,
                currentRideId: deleteField(),
              } as any).catch(console.error);
            }

            setRideState("idle");
            setActiveRide(null);
            setPassengerPos(null);
            setDirections(null);
            if (navigator.vibrate) navigator.vibrate([300, 200, 300]);
          } else {
            setActiveRide((prev) => {
              if (!prev) return prev;
              const isModified =
                prev.pickupAddress !== data.pickup ||
                prev.dropoffAddress !== data.dropoff ||
                prev.fareEstimate !== data.fareEstimate ||
                JSON.stringify(prev.stops) !== JSON.stringify(data.stops || []);
              if (isModified) {
                setTimeout(() => {
                  toast.info("Ride Updated", {
                    description:
                      "The passenger has updated the journey details.",
                  });
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
                durationMinutes: data.durationMinutes || prev.durationMinutes,
              };
            });
          }

          if (
            data.status === "completed" &&
            rideState === "completed" &&
            paymentUrl
          ) {
            toast.success("Payment Received", {
              description: "Passenger has completed the payment.",
            });
            setPaymentUrl(null);
            setRideState("review");
          }

          if (data.isModifiedByPassenger) {
            // Close external navigation if open
            if (
              externalNavWindowRef.current &&
              !externalNavWindowRef.current.closed
            ) {
              externalNavWindowRef.current.close();
              toast.warning("Navigation Stopped", {
                description:
                  "Navigation was stopped because passenger updated the job details. Please restart navigation.",
                duration: 8000,
              });
            }

            // Play loud alert notification
            playSound("notification");
            speakText("Job details updated by passenger");
            toast.info("Ride Details Updated", {
              description:
                "The passenger has updated the ride details or fare.",
              duration: 8000,
            });

            if (
              data.dropoffLat &&
              data.dropoffLng &&
              activeRide?.dropoffLat &&
              activeRide?.dropoffLng &&
              user?.uid
            ) {
              const R = 6371e3;
              const p1 = (activeRide.dropoffLat * Math.PI) / 180;
              const p2 = (data.dropoffLat * Math.PI) / 180;
              const dp =
                ((data.dropoffLat - activeRide.dropoffLat) * Math.PI) / 180;
              const dl =
                ((data.dropoffLng - activeRide.dropoffLng) * Math.PI) / 180;
              const a =
                Math.sin(dp / 2) * Math.sin(dp / 2) +
                Math.cos(p1) *
                  Math.cos(p2) *
                  Math.sin(dl / 2) *
                  Math.sin(dl / 2);
              const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

              if (dist > 1609.34) {
                // More than 1 mile away
                const delayMins = Math.max(5, Math.round(dist / 400)); // Rough estimate of 1 min per 400m
                const stackedQuery = query(
                  collection(db, "ride_requests"),
                  where("driverId", "==", user.uid),
                  where("status", "==", "accepted"),
                );
                getDocs(stackedQuery)
                  .then((snap) => {
                    snap.forEach((d) => {
                      if (d.id !== activeRide.id) {
                        updateDoc(doc(db, "ride_requests", d.id), {
                          stackedDriverDelay: delayMins,
                          updatedAt: serverTimestamp(),
                        });
                        toast.warning("Stacked passenger notified", {
                          description:
                            "Your next passenger has been asked if they want to wait due to your destination change.",
                          duration: 10000,
                        });
                      }
                    });
                  })
                  .catch(console.error);
              }
            }

            setActiveRide((prev) =>
              prev
                ? {
                    ...prev,
                    dropoffAddress: data.dropoff || prev.dropoffAddress,
                    dropoffLat: data.dropoffLat || prev.dropoffLat,
                    dropoffLng: data.dropoffLng || prev.dropoffLng,
                    pickupAddress: data.pickup || prev.pickupAddress,
                    pickupLat: data.pickupLat || prev.pickupLat,
                    pickupLng: data.pickupLng || prev.pickupLng,
                    fareEstimate: data.fareEstimate || prev.fareEstimate,
                    distanceMiles: data.distanceMiles || prev.distanceMiles,
                    stops: data.stops || prev.stops,
                  }
                : null,
            );

            updateDoc(doc(db, "ride_requests", activeRide.id), {
              isModifiedByPassenger: false,
            }).catch(console.error);
          }
        }
      },
    );

    return () => unsub();
  }, [activeRide?.id, activeRide?.isReal, rideState, user]);

  // Simulation: Add fake demand zones
  useEffect(() => {
    setDemandZones([
      {
        lat: 53.6458,
        lng: -1.785,
        radius: 1200,
        type: "high",
        multiplier: "1.4x",
      },
      {
        lat: 53.655,
        lng: -1.8,
        radius: 1800,
        type: "moderate",
        multiplier: "1.2x",
      },
    ]);
  }, []);

  // Timer simulation for Incoming request
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (rideState === "incoming" && incomingTimer > 0) {
      interval = setInterval(() => setIncomingTimer((prev) => prev - 1), 1000);
      if (incomingTimer % 3 === 0) {
        if (!profile?.muteRideOfferAlerts) {
          playSound("alert");
        }
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    } else if (rideState === "incoming" && incomingTimer === 0) {
      handleDeclineRide();
    }
    return () => clearInterval(interval);
  }, [rideState, incomingTimer, profile?.muteRideOfferAlerts]);

  // Timer simulation for Stacked Incoming request
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (
      stackedRideOffer &&
      rideState === "in_progress" &&
      stackedIncomingTimer > 0
    ) {
      interval = setInterval(
        () => setStackedIncomingTimer((prev) => prev - 1),
        1000,
      );
      if (stackedIncomingTimer % 3 === 0) {
        if (!profile?.muteRideOfferAlerts) {
          playSound("alert");
        }
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    } else if (
      stackedRideOffer &&
      rideState === "in_progress" &&
      stackedIncomingTimer === 0
    ) {
      handleDeclineStackedRide();
    }
    return () => clearInterval(interval);
  }, [
    stackedRideOffer,
    rideState,
    stackedIncomingTimer,
    profile?.muteRideOfferAlerts,
  ]);

  const handleToggleOnline = async () => {
    if (rideState !== "idle") return; // Cannot toggle while riding

    if (!isOnline && user) {
      // Check limits before going online
      const mDoc = await getDoc(doc(db, "driver_metrics", user.uid));
      if (mDoc.exists()) {
        const secs = mDoc.data().onlineSecondsToday || 0;
        const max = fareConfig.maxDailyDriverHours || 12;
        if (secs / 3600 >= max) {
          toast.error("Safety Limit Reached", {
            description: `You cannot go online. You have reached your daily maximum of ${max} hours.`,
          });
          return;
        }
      }
    }

    const newStatus = !isOnline;
    setIsOnline(newStatus);
    setIsSyncingMap(true);
    setTimeout(() => {
      setIsSyncingMap(false);
    }, 1500);
    setActiveTab("home");

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

      // Sync online time to Firestore every 60 seconds (6 ticks)
      if (Math.floor(diffMs / 1000) % 60 < 10) {
        const today = new Date().toISOString().split("T")[0];
        if (user) {
          updateDoc(doc(db, "driver_metrics", user.uid), {
            date: today,
            onlineSecondsToday: increment(60),
          })
            .then(() => {
              // Verify limits
              getDoc(doc(db, "driver_metrics", user.uid)).then((metricsDoc) => {
                if (metricsDoc.exists()) {
                  const secs = metricsDoc.data().onlineSecondsToday || 0;
                  if (secs / 3600 >= (fareConfig.maxDailyDriverHours || 12)) {
                    toast.error("Safety Limit Reached", {
                      description: `You have reached the maximum allowed driving time of ${fareConfig.maxDailyDriverHours || 12} hours.`,
                    });
                    setIsOnline(false);
                    updateDoc(doc(db, "live_tracking", user.uid), {
                      isOnline: false,
                    }).catch(console.error);
                  }
                }
              });
            })
            .catch(() => {
              // Fallback: create if not exists
              setDoc(
                doc(db, "driver_metrics", user.uid),
                {
                  date: today,
                  onlineSecondsToday: 60,
                  dailyEarnings: 0,
                },
                { merge: true },
              );
            });
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [isOnline, onlineStartTime]);

  // Real-time GPS Tracking & Status Sync
  const lastStateUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (!isOnline || !user) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, heading } = pos.coords;
        const nowMs = Date.now();
        
        // Fast-path Firestore sync logic without rate limiting for vital dispatches
        const timeSinceLastSync = nowMs - lastLocationSyncRef.current;
        const distToLastSync = lastSyncCoordsRef.current
          ? Math.sqrt(
              Math.pow(latitude - lastSyncCoordsRef.current.lat, 2) +
                Math.pow(longitude - lastSyncCoordsRef.current.lng, 2),
            )
          : 999;
          
        const shouldSync =
          timeSinceLastSync >= 60000 ||
          (timeSinceLastSync >= 10000 && distToLastSync > 0.00015) ||
          !lastSyncCoordsRef.current;
          
        // Limit high-frequency React State re-renders to save battery (max 1Hz)
        if (nowMs - lastStateUpdateRef.current < 1000) {
          if (!shouldSync) return; // Completely skip if nothing vital to sync
        } else {
            lastStateUpdateRef.current = nowMs;
            if (heading !== null && !isNaN(heading)) {
              setDriverHeading((prev) => 
                prev !== null && Math.abs(prev - heading) < 2 ? prev : Math.round(heading)
              );
            } else if (mapCenterRef.current) {
              const prevLat = mapCenterRef.current[0];
              const prevLng = mapCenterRef.current[1];
              // Only update heading if moved a minimum distance to avoid jitter
              const dist = Math.sqrt(
                Math.pow(latitude - prevLat, 2) + Math.pow(longitude - prevLng, 2),
              );
              if (dist > 0.00005) {
                const newHeading = Math.round(getBearing(prevLat, prevLng, latitude, longitude));
                setDriverHeading((prev) => 
                  prev !== null && Math.abs(prev - newHeading) < 2 ? prev : newHeading
                );
              }
            }
    
            setDriverLocation([latitude, longitude]);
            
            if (!isAutoNavPausedRef.current) {
              if (mapCenterRef.current) {
                const distCenter = Math.sqrt(
                  Math.pow(latitude - mapCenterRef.current[0], 2) + Math.pow(longitude - mapCenterRef.current[1], 2),
                );
                if (distCenter > 0.00005) { // ~5.5 meters to prevent jitter
                  setMapCenter([latitude, longitude]);
                }
              } else {
                setMapCenter([latitude, longitude]);
              }
            }
        }

        // Sync to Firestore for dispatcher / passenger (hybrid throttled: 10s + distance, or 60s max)
        if (shouldSync) {
          lastLocationSyncRef.current = nowMs;
          lastSyncCoordsRef.current = { lat: latitude, lng: longitude };
          try {
            await setDoc(
              doc(db, "live_tracking", user.uid),
              {
                driverId: user.uid,
                lat: latitude,
                lng: longitude,
                updatedAt: serverTimestamp(),
                isOnline: true,
                status: activeRide ? "on_ride" : "available",
                dropoffLat: activeRide?.dropoffLat || null,
                dropoffLng: activeRide?.dropoffLng || null,
                isStackingEnabled: profile?.isStackingEnabled !== false,
                isLastJob: profile?.isLastJob === true,
                destinationModeActive: profile?.destinationModeActive === true,
                homeLat: profile?.homeLat || null,
                homeLng: profile?.homeLng || null,
                zoneEnabled: profile?.zoneEnabled === true,
                zoneMaxDistance: profile?.zoneMaxDistance || 0,
                vehicleCategory: profile?.vehicleCategory || "standard",
                vehicleCategories: profile?.vehicleCategories || [
                  profile?.vehicleCategory || "standard",
                ],
                isPetFriendly: profile?.isPetFriendly === true,
              },
              { merge: true },
            );

            await setDoc(
              doc(db, "driver_status", user.uid),
              {
                online: true,
                updatedAt: serverTimestamp(),
              },
              { merge: true },
            );
          } catch (err) {
            console.error("Failed to sync location:", err);
          }
        }
      },
      (err) => console.warn("GPS tracking error:", err),
      { enableHighAccuracy: true, maximumAge: 10000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      // When effect cleans up (offline), we should update status
      if (user) {
        updateDoc(doc(db, "driver_status", user.uid), { online: false }).catch(
          console.error,
        );
        updateDoc(doc(db, "live_tracking", user.uid), {
          isOnline: false,
        }).catch(console.error);
      }
    };
  }, [isOnline, user, activeRide]);

  const simulatePassenger90sWarning = () => {
    if (activeRide?.hasCardOnFile) {
      toast.info("Auto-Pay Active", {
        description: "Passenger has a card attached. No QR code needed.",
        duration: 8000,
      });
      toast("Passenger Phone (Auto-Pay):", {
        description:
          "Your journey is about to end. Please appreciate the driver by giving a tip.",
        duration: 8000,
        action: {
          label: "Add Tip (£3)",
          onClick: () =>
            setActiveRide((prev: any) => ({ ...prev, tipAmount: 3 })),
        },
      });
    } else {
      toast.warning("QR Payment Required", {
        description: "Passenger will pay via scan. Have your QR ready.",
        duration: 8000,
      });
      toast("Passenger Phone (No Card):", {
        description:
          "Please have your phone ready to scan the driver's QR code.",
        duration: 8000,
        action: {
          label: "Add Tip (£5)",
          onClick: () =>
            setActiveRide((prev: any) => ({ ...prev, tipAmount: 5 })),
        },
      });
    }
  };

  const simulateIncomingRide = () => {
    if (!isOnline) {
      setIsOnline(true);
      setIsSyncingMap(true);
      setTimeout(() => {
        setIsSyncingMap(false);
      }, 1500);
    }

    // Pick a random simulated job profile
    const jobProfiles = [
      {
        id: "simulated_ride_" + Math.floor(Math.random() * 1000000),
        name: "Sarah T.",
        passengerPhone: "+447700900077",
        pickupAddress: "12 Elm Street, SE15",
        dropoffAddress: "Bristol Temple Meads",
        comments: "Please ring the bell, the baby is sleeping. Thanks!",
        isPriority: true,
        isRiderPlus: true,
        stops: [],
      },
      {
        id: "simulated_ride_" + Math.floor(Math.random() * 1000000),
        name: "Jonathan D.",
        passengerPhone: "+447700900088",
        pickupAddress: "142 Longbridge Road, Ground Floor Flat, Barking, IG11",
        dropoffAddress: "Terminal 5, London Heathrow Airport, Hounslow",
        comments: "Large suitcase. Please call when outside.",
        isPriority: false,
        isRiderPlus: false,
        stops: [],
      },
      {
        id: "simulated_ride_" + Math.floor(Math.random() * 1000000),
        name: "Maria S.",
        passengerPhone: "+447700900099",
        pickupAddress:
          "Victoria Station, Buckingham Palace Road entrance, SW1W",
        dropoffAddress: "72 Oxford Street, Westminster, W1D 1AA",
        comments: "I will be waiting near the main entrance.",
        isPriority: true,
        isRiderPlus: false,
        stops: [
          {
            address: "Waitrose & Partners, 16-19 Canada Square, Canary Wharf",
            coords: { lat: mapCenter[0] + 0.005, lng: mapCenter[1] - 0.005 },
          },
        ],
      },
    ];

    const randomProfile =
      jobProfiles[Math.floor(Math.random() * jobProfiles.length)];

    // Create a dynamic simulation using real live fare configs
    const simulatedDist = Math.floor(Math.random() * 15) + 3; // 3 to 18 miles
    const simulatedTime = simulatedDist * 2.5; // Rough time
    const calcFare = Math.max(
      fareConfig.minFare,
      fareConfig.baseFare + simulatedDist * fareConfig.distanceRate,
    );

    // Apply Surge Logic based on config
    let surgeMultiplier = 1.0;
    let surgeFixed = 0.0;
    let finalFare = calcFare;

    if (fareConfig.surgeEnabled) {
      if (fareConfig.surgeModel === "fixed") {
        surgeFixed = fareConfig.surgeFixedAmount || 2.0;
        finalFare = calcFare + surgeFixed;
      } else {
        surgeMultiplier = fareConfig.surgeMultiplierValue || 1.4;
        finalFare = calcFare * surgeMultiplier;
      }
    }

    const priorityFeeAmount = randomProfile.isPriority
      ? fareConfig.priorityFee
      : 0;
    finalFare += priorityFeeAmount;

    setActiveRide({
      ...randomProfile,
      pickupLat: mapCenter[0] + 0.01,
      pickupLng: mapCenter[1] + 0.01,
      dropoffLat: mapCenter[0] - 0.02,
      dropoffLng: mapCenter[1] - 0.02,
      fareEstimate: finalFare,
      baseCalc: calcFare,
      surgeMultiplier: surgeMultiplier,
      surgeFixed: surgeFixed,
      surgeModel: fareConfig.surgeModel || "multiplier",
      distanceMiles: simulatedDist,
      durationMinutes: simulatedTime,
      hasCardOnFile: Math.random() > 0.5,
      distanceToPickupMiles: 1.2,
      isReal: false,
    });

    setIncomingTimer(15);
    setRideState("incoming");
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]); // Custom ride tone haptic
  };

  const simulateStackedIncomingRide = () => {
    if (!isOnline || rideState !== "in_progress") return;

    const simulatedDist = Math.floor(Math.random() * 10) + 2;
    const simulatedTime = simulatedDist * 2.5;
    const calcFare = Math.max(
      fareConfig.minFare,
      fareConfig.baseFare + simulatedDist * fareConfig.distanceRate,
    );

    // Apply Surge Logic based on config
    let surgeMultiplier = 1.0;
    let surgeFixed = 0.0;
    let finalFare = calcFare;

    if (fareConfig.surgeEnabled) {
      if (fareConfig.surgeModel === "fixed") {
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
      surgeModel: fareConfig.surgeModel || "multiplier",
      distanceMiles: simulatedDist,
      durationMinutes: simulatedTime,
      comments: "Waiting outside.",
      isPriority: false,
      hasCardOnFile: true,
      isRiderPlus: false,
      distanceToPickupMiles: 0.8,
      isReal: false,
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
          if (docSnap.data().status !== "offered")
            throw new Error("Ride no longer available");

          t.update(rideRef, {
            status: "accepted",
            driverId: user.uid,
            driverName: profile?.firstName || "Driver",
            driverPhone: profile?.phone || profile?.phoneNumber || "",
            vehicleInfo: profile?.vehicle || "Silver Toyota Prius",
            vehiclePlate:
              profile?.vehicleRegistration || profile?.plate || "WK71 BCF",
            driverRequirePasscode: profile?.requirePasscode === true,
            acceptedAt: serverTimestamp(),
          });
        });

        // Instant availability switch so other passengers don't receive confusing ETAs
        await updateDoc(doc(db, "live_tracking", user.uid), {
          status: "on_ride",
          dropoffLat: activeRide?.dropoffLat || null,
          dropoffLng: activeRide?.dropoffLng || null,
          updatedAt: serverTimestamp(),
        }).catch(console.error);

        await updateDoc(doc(db, "driver_status", user.uid), {
          isBusy: true,
          pendingRideId: deleteField(),
        } as any);
      } catch (err: any) {
        console.error("Failed to claim ride:", err);
        toast.error(
          err.message || "Failed to accept ride. It might have expired.",
        );
        setRideState("idle");
        return;
      }
    }

    setRideState("en_route_pickup");
    setIsAutoNavHeadUp(true);
    setIsAutoNavPaused(false);
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const handleDeclineRide = async () => {
    if (activeRide?.id && activeRide?.isReal && user) {
      try {
        // Penalty logic: consecutive declines
        await updateDoc(doc(db, "driver_status", user.uid), {
          pendingRideId: deleteField(),
          consecutiveDeclines: increment(1),
        } as any);

        // Put ride back into search pool
        await updateDoc(doc(db, "ride_requests", activeRide.id), {
          status: "pending",
          assignedDriverId: deleteField(),
          offerExpiresAt: deleteField(),
        } as any);
      } catch (err) {
        console.error("Error declining ride:", err);
      }
    }

    setActiveRide(null);
    setRideState("idle");
  };

  const handleDeclineStackedRide = async () => {
    if (stackedRideOffer?.id && stackedRideOffer?.isReal && user) {
      try {
        await updateDoc(doc(db, "driver_status", user.uid), {
          pendingRideId: deleteField(),
          consecutiveDeclines: increment(1),
        } as any);

        await updateDoc(doc(db, "ride_requests", stackedRideOffer.id), {
          status: "pending",
          assignedDriverId: deleteField(),
          offerExpiresAt: deleteField(),
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
          if (docSnap.data().status !== "offered")
            throw new Error("Ride no longer available");

          t.update(rideRef, {
            status: "accepted",
            driverId: user.uid,
            driverName: profile?.firstName || "Driver",
            driverPhone: profile?.phone || profile?.phoneNumber || "",
            vehicleInfo: profile?.vehicle || "Silver Toyota Prius",
            vehiclePlate:
              profile?.vehicleRegistration || profile?.plate || "WK71 BCF",
            driverRequirePasscode: profile?.requirePasscode === true,
            acceptedAt: serverTimestamp(),
          });
        });

        // Instant availability switch for the stacked ride (forces them invisible until current is done)
        await updateDoc(doc(db, "live_tracking", user.uid), {
          dropoffLat: stackedRideOffer?.dropoffLat || null,
          dropoffLng: stackedRideOffer?.dropoffLng || null,
          isStackingEnabled: false, // temporarily disable stacking until this ride is active
          updatedAt: serverTimestamp(),
        }).catch(console.error);

        await updateDoc(doc(db, "driver_status", user.uid), {
          isBusy: true,
          pendingRideId: deleteField(),
        } as any);
        toast.success(
          "Stacked job accepted. It will appear when your current ride is completed.",
          { duration: 5000 },
        );
        success = true;
      } catch (err: any) {
        console.error("Failed to claim stacked ride:", err);
        toast.error(
          err.message ||
            "Failed to accept stacked ride. It might have expired.",
        );
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

  const [activeTab, setActiveTabState] = useState<
    | "home"
    | "earnings"
    | "inbox"
    | "menu"
    | "documents"
    | "jobs"
    | "analytics"
    | "zones"
    | "availability"
  >(currentTabParam as any);

  useEffect(() => {
    setActiveTabState((searchParams.get("tab") as any) || "home");
  }, [searchParams]);

  const setActiveTab = (tab: string) => {
    if (tab === "home") {
      searchParams.delete("tab");
    } else {
      searchParams.set("tab", tab);
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
  const [incomingPopupMessage, setIncomingPopupMessage] = useState<{
    id: string;
    text: string;
  } | null>(null);
  const lastPopupMessageIdRef = useRef<string | null>(null);
  const lastLocationSyncRef = useRef(0);
  const lastSyncCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [quickMessageCooldown, setQuickMessageCooldown] = useState(0);
  const [isCardCollapsed, setIsCardCollapsed] = useState(true);
  const cardCollapseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (incomingPopupMessage) {
      const timer = setTimeout(() => {
        setIncomingPopupMessage(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [incomingPopupMessage]);

  const handleQuickReply = async (replyText: string) => {
    if (!activeRide?.id || !user) return;
    try {
      await addDoc(collection(db, "ride_requests", activeRide.id, "chat"), {
        text: replyText,
        senderId: user.uid,
        createdAt: serverTimestamp(),
      });
      setIncomingPopupMessage(null);
    } catch (err) {
      console.error("Failed to send quick reply", err);
    }
  };

  useEffect(() => {
    if (quickMessageCooldown > 0) {
      const timer = setTimeout(
        () => setQuickMessageCooldown((prev) => prev - 1),
        1000,
      );
      return () => clearTimeout(timer);
    }
  }, [quickMessageCooldown]);

  useEffect(() => {
    if (isChatOpen) setUnreadChatCount(0);
  }, [isChatOpen]);

  const resetCardCollapseTimer = useCallback(() => {
    if (cardCollapseTimeoutRef.current)
      clearTimeout(cardCollapseTimeoutRef.current);
    cardCollapseTimeoutRef.current = setTimeout(() => {
      setIsCardCollapsed(true);
    }, 10000);
  }, []);

  useEffect(() => {
    if (["en_route_pickup", "waiting", "in_progress"].includes(rideState)) {
      setIsCardCollapsed(false);
      resetCardCollapseTimer();
    } else {
      setIsCardCollapsed(true);
      if (cardCollapseTimeoutRef.current)
        clearTimeout(cardCollapseTimeoutRef.current);
    }
    return () => {
      if (cardCollapseTimeoutRef.current)
        clearTimeout(cardCollapseTimeoutRef.current);
    };
  }, [rideState, currentLegIndex, resetCardCollapseTimer]);

  useEffect(() => {
    // Hide Layout's bottom nav when card is collapsed and we have an active job
    if (["en_route_pickup", "waiting", "in_progress"].includes(rideState)) {
      if (isCardCollapsed) {
        document.body.classList.add("hide-driver-bottom-nav");
      } else {
        document.body.classList.remove("hide-driver-bottom-nav");
      }
    } else {
      document.body.classList.remove("hide-driver-bottom-nav");
    }

    return () => {
      document.body.classList.remove("hide-driver-bottom-nav");
    };
  }, [rideState, isCardCollapsed]);

  useEffect(() => {
    if (
      !activeRide?.id ||
      !user ||
      !["en_route_pickup", "waiting", "in_progress"].includes(rideState)
    )
      return;

    const q = query(
      collection(db, "ride_requests", activeRide.id, "chat"),
      orderBy("createdAt", "asc"),
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as any),
      }));
      const remoteMessages = messages.filter((m) => m.senderId !== user.uid);

      if (isChatOpen) {
        lastSeenChatCountRef.current = remoteMessages.length;
        setUnreadChatCount(0);
        setIncomingPopupMessage(null);
      } else {
        const unread = remoteMessages.length - lastSeenChatCountRef.current;
        if (unread > 0) {
          setUnreadChatCount(unread);

          const latestMsg = remoteMessages[remoteMessages.length - 1];
          if (latestMsg && latestMsg.id !== lastPopupMessageIdRef.current) {
            lastPopupMessageIdRef.current = latestMsg.id;
            setIncomingPopupMessage({ id: latestMsg.id, text: latestMsg.text });
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          }
        }
      }
    });
    return () => unsub();
  }, [activeRide?.id, rideState, user, isChatOpen]);

  const [waitStartTime, setWaitStartTime] = useState<number | null>(null);
  const [elapsedWaitSeconds, setElapsedWaitSeconds] = useState(0);
  const [pickupProximityStartTime, setPickupProximityStartTime] = useState<
    number | null
  >(null);

  const [hasAutoResetOverview, setHasAutoResetOverview] = useState(false);

  useEffect(() => {
    if (rideState !== "en_route_pickup") {
      setHasAutoResetOverview(false);
    }
  }, [rideState]);

  // Stop wait & abandonment logic
  const [isWaitingAtStop, setIsWaitingAtStop] = useState(false);
  const [stopWaitStartTime, setStopWaitStartTime] = useState<number | null>(
    null,
  );

  // Auto-arrive logic when driver is within 200m of pickup for 30 seconds
  useEffect(() => {
    if (
      rideState === "en_route_pickup" &&
      activeRide?.pickupLat &&
      activeRide?.pickupLng &&
      mapCenter
    ) {
      const R = 6371e3;
      const lat1 = (mapCenter[0] * Math.PI) / 180;
      const lat2 = (activeRide.pickupLat * Math.PI) / 180;
      const dLat = ((activeRide.pickupLat - mapCenter[0]) * Math.PI) / 180;
      const dLon = ((activeRide.pickupLng - mapCenter[1]) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) *
          Math.cos(lat2) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const dist = R * c;

      if (dist <= 200) {
        if (!pickupProximityStartTime) {
          setPickupProximityStartTime(Date.now());
        }
        
        // Auto reset head-up navigation and zoom in to street-level (zoom 18) to find exact passenger location
        if (!hasAutoResetOverview) {
          setHasAutoResetOverview(true);
          setIsAutoNavHeadUp(true);
          setIsAutoNavPaused(false);
          setMapZoom(18);
          if (mapInstance) {
            mapInstance.setZoom(18);
            mapInstance.panTo({ lat: activeRide.pickupLat, lng: activeRide.pickupLng });
          }
          toast.success("Approaching pickup. Camera reset to street-level (zoom 18) to find passenger exact location.");
        }
      } else {
        setPickupProximityStartTime(null);
      }
    } else {
      setPickupProximityStartTime(null);
    }
  }, [mapCenter, rideState, activeRide?.pickupLat, activeRide?.pickupLng, hasAutoResetOverview, mapInstance]);

  useEffect(() => {
    if (pickupProximityStartTime) {
      const interval = setInterval(() => {
        if (Date.now() - pickupProximityStartTime >= 30000) {
          console.log(
            "Auto-arriving as driver is stationary within 200m for 30s",
          );
          handleArrived(activeRide); // Avoid strict stale closures if activeRide hasn't changed.
          setPickupProximityStartTime(null);
          toast.success("Automatically marked as arrived", {
            description: "You've been waiting at the pickup location.",
          });
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [pickupProximityStartTime, activeRide]);
  const [accumulatedPaidWaitSeconds, setAccumulatedPaidWaitSeconds] =
    useState(0);
  const [currentStopWaitSeconds, setCurrentStopWaitSeconds] = useState(0);
  const [waitStopLocation, setWaitStopLocation] = useState<
    [number, number] | null
  >(null);
  const [abandonmentWarningSent, setAbandonmentWarningSent] = useState(false);

  useEffect(() => {
    let interval: any;
    if (rideState === "waiting" && waitStartTime) {
      interval = setInterval(() => {
        setElapsedWaitSeconds(Math.floor((Date.now() - waitStartTime) / 1000));
      }, 1000);
    } else if (isWaitingAtStop && stopWaitStartTime) {
      interval = setInterval(() => {
        setCurrentStopWaitSeconds(
          Math.floor((Date.now() - stopWaitStartTime) / 1000),
        );
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [rideState, waitStartTime, isWaitingAtStop, stopWaitStartTime]);

  const handleToggleWaitAtStop = () => {
    if (isWaitingAtStop) {
      setIsWaitingAtStop(false);
      setAbandonmentWarningSent(false); // reset abandonment logic
      setAccumulatedPaidWaitSeconds((prev) => {
        const newVal = prev + currentStopWaitSeconds;
        if (activeRide?.id && activeRide?.isReal) {
          updateDoc(doc(db, "ride_requests", activeRide.id), {
            paidWaitSeconds: newVal,
          }).catch(console.error);
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
      const lat1 = (waitStopLocation[0] * Math.PI) / 180;
      const lat2 = (mapCenter[0] * Math.PI) / 180;
      const dLat = ((mapCenter[0] - waitStopLocation[0]) * Math.PI) / 180;
      const dLon = ((mapCenter[1] - waitStopLocation[1]) * Math.PI) / 180;

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) *
          Math.cos(lat2) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      // If moved more than 200 meters, automatically resume trip to protect passenger fare
      if (distance > 200) {
        toast.success("Trip Auto-Resumed", {
          description:
            "Movement detected. Paid wait timer was paused automatically to protect passenger pricing.",
          duration: 6000,
        });
        // Auto-pause
        setIsWaitingAtStop(false);
        setAbandonmentWarningSent(false);
        setAccumulatedPaidWaitSeconds((prev) => {
          const newVal = prev + currentStopWaitSeconds;
          if (activeRide?.id && activeRide?.isReal) {
            updateDoc(doc(db, "ride_requests", activeRide.id), {
              paidWaitSeconds: newVal,
            }).catch(console.error);
          }
          return newVal;
        });
        setCurrentStopWaitSeconds(0);
        setStopWaitStartTime(null);
        setWaitStopLocation(null);
      }
    }
  }, [mapCenter, isWaitingAtStop, waitStopLocation, currentStopWaitSeconds]);

  // Start job reminder if driving away from pickup (>300m)
  useEffect(() => {
    if (
      rideState !== "waiting" ||
      hasDismissedStartJobReminder ||
      !activeRide?.pickupLat ||
      !activeRide?.pickupLng ||
      !mapCenter
    ) {
      setShowStartJobReminder(false);
      return;
    }

    const dist = getDistanceInMeters(
      mapCenter[0],
      mapCenter[1],
      activeRide.pickupLat,
      activeRide.pickupLng,
    );

    if (dist > 300) {
      setShowStartJobReminder(true);
    } else {
      setShowStartJobReminder(false);
    }
  }, [
    rideState,
    mapCenter,
    activeRide?.pickupLat,
    activeRide?.pickupLng,
    hasDismissedStartJobReminder,
  ]);

  // Leave stop reminder if driving away from a stop (>300m) without pressing Go Next
  useEffect(() => {
    if (rideState !== "in_progress" || !activeRide || !mapCenter) return;

    if (currentLegIndex >= (activeRide.stops?.length || 0)) {
      // It's driving to drop-off. We don't need "Go to next" reminder for drop-off.
      return;
    }

    const currentStop = activeRide.stops[currentLegIndex];
    if (!currentStop?.coords?.lat || !currentStop?.coords?.lng) return;

    const dist = getDistanceInMeters(
      mapCenter[0],
      mapCenter[1],
      currentStop.coords.lat,
      currentStop.coords.lng,
    );

    if (dist <= 200) {
      // Driver has reached the stop!
      if (!hasReachedCurrentStop) {
        setHasReachedCurrentStop(true);
      }
      if (showLeaveStopReminder) {
        setShowLeaveStopReminder(false);
      }
    } else if (dist > 300 && hasReachedCurrentStop) {
      // Driver was at the stop, now left, but hasn't pressed Go to Next
      if (!showLeaveStopReminder) {
        setShowLeaveStopReminder(true);
      }
    }
  }, [
    rideState,
    activeRide,
    mapCenter,
    currentLegIndex,
    hasReachedCurrentStop,
    showLeaveStopReminder,
  ]);

  useEffect(() => {
    if (rideState !== "waiting") {
      setHasDismissedStartJobReminder(false);
    }
  }, [rideState]);

  const totalPaidWaitSeconds =
    accumulatedPaidWaitSeconds + currentStopWaitSeconds;

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
    setAccumulatedPaidWaitSeconds((prev) => prev + currentStopWaitSeconds);
    setCurrentStopWaitSeconds(0);
    setStopWaitStartTime(null);
    setAbandonmentWarningSent(false);

    setIsGeneratingPayment(true);
    setRideState("completed");

    const waitFare = (totalPaidWaitSeconds / 60) * fareConfig.waitRatePerMinute;
    // Base estimate logic normally computes full journey. For abandonment we should
    // ideally calculate partial distance. Using fareEstimate as approximation for UI.
    const partialFareEstimate = activeRide?.fareEstimate
      ? activeRide.fareEstimate * 0.5
      : 12.0;
    const finalFare = partialFareEstimate + waitFare + 5.0; // Add the £5 abandonment fee!

    try {
      await updateDoc(doc(db, "ride_requests", activeRide.id), {
        status: "rider_abandoned",
        paymentMethod: "stripe_qr",
        finalFare: finalFare,
        paidWaitSeconds: totalPaidWaitSeconds,
        abandonmentFee: 5.0,
        completedAt: serverTimestamp(),
      });

      if (
        activeRide.riderId &&
        typeof activeRide.riderId === "string" &&
        activeRide.riderId.length > 0
      ) {
        // Apply strike
        await updateDoc(doc(db, "users", activeRide.riderId), {
          pendingCharges: increment(finalFare),
          abandonmentStrikes: increment(1),
        } as any).catch((err) => console.error("Failed to add strike:", err));
      }

      const today = new Date().toISOString().split("T")[0];
      await setDoc(
        doc(db, "driver_metrics", user.uid),
        {
          date: today,
          dailyEarnings: increment(finalFare), // Usually minus commission handled in backend
          jobsDoneToday: increment(1),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      // Generate the payment link
      const response = await fetch("/api/rides/create-trip-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideId: activeRide.id,
          driverId: user.uid,
          amount: finalFare,
          isAbandonment: true,
        }),
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
      const lat1 = (mapCenter[0] * Math.PI) / 180;
      const lat2 = (activeRide.pickupLat * Math.PI) / 180;
      const dLat = ((activeRide.pickupLat - mapCenter[0]) * Math.PI) / 180;
      const dLon = ((activeRide.pickupLng - mapCenter[1]) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) *
          Math.cos(lat2) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
    setRideState("waiting");
    setWaitStartTime(Date.now());
    setElapsedWaitSeconds(0);
    setAccumulatedPaidWaitSeconds(0);

    // Reset green button (auto-nav head-up) and set to street level zoom (18) to find exact passenger location
    setIsAutoNavHeadUp(true);
    setIsAutoNavPaused(false);
    setMapZoom(18);
    if (mapInstance && rideToUpdate?.pickupLat && rideToUpdate?.pickupLng) {
      mapInstance.setZoom(18);
      mapInstance.panTo({ lat: rideToUpdate.pickupLat, lng: rideToUpdate.pickupLng });
    }

    if (rideToUpdate?.id && rideToUpdate?.isReal) {
      await updateDoc(doc(db, "ride_requests", rideToUpdate.id), {
        status: "arrived",
        arrivedAt: serverTimestamp(),
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
        createdAt: serverTimestamp(),
      });
      setQuickMessageCooldown(120);
      toast.success("Sent");
    } catch (err) {
      console.error(err);
      toast.error("Failed to send");
    }
  };

  const handleStartRide = async () => {
    setRideState("in_progress");
    setCurrentLegIndex(0);
    setHasReachedCurrentStop(false);
    setShowLeaveStopReminder(false);
    setIsWaitingAtStop(false); // just in case
    const pickupPaidWait = Math.max(0, elapsedWaitSeconds - 180);
    setAccumulatedPaidWaitSeconds(pickupPaidWait);

    if (activeRide?.id && activeRide?.isReal) {
      await updateDoc(doc(db, "ride_requests", activeRide.id), {
        status: "in_progress",
        startedAt: serverTimestamp(),
        paidWaitSeconds: pickupPaidWait,
      });
    }
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  };

  const handleCompleteRideBtnClick = () => {
    let dist = 1000;
    if (activeRide && activeRide.dropoffLat && activeRide.dropoffLng) {
      dist = getDistanceInMeters(
        mapCenter[0],
        mapCenter[1],
        activeRide.dropoffLat,
        activeRide.dropoffLng,
      );
    }

    setIsEarlyCompletion(dist > 300);
    setEarlyCompletionReason("");
    setShowCompleteConfirm(true);
  };

  const handleGoToNextLeg = () => {
    if (isWaitingAtStop) {
      // Safety: turn off waiting if they forgot
      setIsWaitingAtStop(false);
      setAbandonmentWarningSent(false);
      setAccumulatedPaidWaitSeconds((prev) => prev + currentStopWaitSeconds);
      setCurrentStopWaitSeconds(0);
      setStopWaitStartTime(null);
    }

    setCurrentLegIndex((prev) => prev + 1);
    setHasReachedCurrentStop(false);
    setShowLeaveStopReminder(false);
    toast.success("Navigating to next location", { duration: 3000 });
  };

  const handleCompleteRideConfirmed = async () => {
    setShowCompleteConfirm(false);

    // Reset the green button (head-up navigation overview) for any upcoming/future rides
    setIsAutoNavHeadUp(true);
    setIsAutoNavPaused(false);

    if (
      isEarlyCompletion &&
      earlyCompletionReason &&
      activeRide?.id &&
      activeRide?.isReal
    ) {
      try {
        await updateDoc(doc(db, "ride_requests", activeRide.id), {
          earlyCompletionReason: earlyCompletionReason,
        });
      } catch (e) {
        console.error("Failed to save early completion reason", e);
      }
    }

    // Safety check - if driver forgot to turn off waiting at stop, turn it off now
    if (isWaitingAtStop) {
      setIsWaitingAtStop(false);
      setAccumulatedPaidWaitSeconds((prev) => prev + currentStopWaitSeconds);
      setCurrentStopWaitSeconds(0);
      setStopWaitStartTime(null);
    }

    setIsGeneratingPayment(true);
    setRideState("completed");

    const waitFare = (totalPaidWaitSeconds / 60) * fareConfig.waitRatePerMinute;
    const baseFinalFare = (activeRide?.fareEstimate || 38.5) + waitFare;
    const finalFare = baseFinalFare + (activeRide?.tipAmount || 0);

    if (activeRide?.hasCardOnFile) {
      toast("Processing Auto-Payment...", { duration: 1500 });
      setTimeout(async () => {
        if (activeRide?.isReal) {
          await handleAutoPaymentCompletion();
        } else {
          setRideState("review");
          setIsGeneratingPayment(false);
          toast.success("Payment Received", {
            description: "Passenger's card was charged automatically.",
          });
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
          tipAmount: activeRide?.tipAmount || 0,
        }),
      });

      const data = await response.json();
      if (data.url) {
        setPaymentUrl(data.url);
        if (activeRide?.id && activeRide?.isReal) {
          await updateDoc(doc(db, "ride_requests", activeRide.id), {
            status: "awaiting_payment",
            paymentUrl: data.url,
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
        const waitFare =
          (totalPaidWaitSeconds / 60) * fareConfig.waitRatePerMinute;
        const baseFare = (activeRide.fareEstimate || 0) + waitFare;
        const totalFare = baseFare + (activeRide.tipAmount || 0);

        await updateDoc(doc(db, "ride_requests", activeRide.id), {
          status: "completed",
          paymentMethod: "stripe_auto",
          finalFare: totalFare,
          paidWaitSeconds: totalPaidWaitSeconds,
          completedAt: serverTimestamp(),
        });

        if (
          activeRide.riderId &&
          typeof activeRide.riderId === "string" &&
          activeRide.riderId.length > 0
        ) {
          await updateDoc(doc(db, "users", activeRide.riderId), {
            pendingCharges: 0,
            cancellationCount: 0,
          } as any).catch((err) =>
            console.error("Failed to clear passenger fees:", err),
          );
        }

        // We can update the daily driver_metrics as well
        const today = new Date().toISOString().split("T")[0];
        await setDoc(
          doc(db, "driver_metrics", user.uid),
          {
            date: today,
            dailyEarnings: increment(totalFare),
            jobsDoneToday: increment(1),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );

        // Update driver earnings in auth profile
        await updateDoc(doc(db, "users", user.uid), {
          totalEarnings: increment(totalFare),
          jobsCompleted: increment(1),
          totalBusinessMileage: increment(
            (activeRide?.distanceToPickupMiles || 0) +
              (activeRide?.distanceMiles || 0),
          ),
        });
      } catch (err) {
        console.error("Failed to process auto payment:", err);
      }
    }
    setRideState("review");
    toast.success("Payment Received", {
      description: "Passenger's card was charged automatically.",
    });
  };

  const handleClosePayment = async () => {
    if (activeRide?.id && activeRide?.isReal && user) {
      try {
        const waitFare =
          (totalPaidWaitSeconds / 60) * fareConfig.waitRatePerMinute;
        const baseFare = (activeRide.fareEstimate || 0) + waitFare;
        const totalFare = baseFare + (activeRide.tipAmount || 0);

        await updateDoc(doc(db, "ride_requests", activeRide.id), {
          status: "completed",
          paymentMethod: "stripe_qr",
          finalFare: totalFare,
          paidWaitSeconds: totalPaidWaitSeconds,
          completedAt: serverTimestamp(),
        });

        if (
          activeRide.riderId &&
          typeof activeRide.riderId === "string" &&
          activeRide.riderId.length > 0
        ) {
          await updateDoc(doc(db, "users", activeRide.riderId), {
            pendingCharges: 0,
            cancellationCount: 0,
          } as any).catch((err) =>
            console.error("Failed to clear passenger fees:", err),
          );
        }

        // We can update the daily driver_metrics as well
        const today = new Date().toISOString().split("T")[0];
        await setDoc(
          doc(db, "driver_metrics", user.uid),
          {
            date: today,
            dailyEarnings: increment(totalFare),
            jobsDoneToday: increment(1),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      } catch (err) {
        console.error("Failed to complete ride via QR:", err);
      }
    }
    setRideState("review");
    setPaymentUrl(null);
  };

  const handleCashPayment = async () => {
    if (activeRide?.id && activeRide?.isReal && user) {
      try {
        const waitFare =
          (totalPaidWaitSeconds / 60) * fareConfig.waitRatePerMinute;
        const baseFare = (activeRide.fareEstimate || 0) + waitFare;
        const totalFare = baseFare + (activeRide.tipAmount || 0);
        const platformFee = (baseFare * fareConfig.commissionRate) + (fareConfig.fixedTripFee || 0);

        await updateDoc(doc(db, "ride_requests", activeRide.id), {
          status: "completed",
          paymentMethod: "cash",
          finalFare: totalFare,
          paidWaitSeconds: totalPaidWaitSeconds,
          platformFeeOwed: platformFee,
          completedAt: serverTimestamp(),
        });

        if (
          activeRide.riderId &&
          typeof activeRide.riderId === "string" &&
          activeRide.riderId.length > 0
        ) {
          await updateDoc(doc(db, "users", activeRide.riderId), {
            pendingCharges: 0,
            cancellationCount: 0,
          } as any).catch((err) =>
            console.error("Failed to clear passenger fees:", err),
          );
        }

        await updateDoc(doc(db, "users", user.uid), {
          pendingPlatformFees: increment(platformFee),
          totalBusinessMileage: increment(
            (activeRide?.distanceToPickupMiles || 0) +
              (activeRide?.distanceMiles || 0),
          ),
        });

        // Update driver metrics
        const today = new Date().toISOString().split("T")[0];
        await setDoc(
          doc(db, "driver_metrics", user.uid),
          {
            date: today,
            dailyEarnings: increment(totalFare),
            jobsDoneToday: increment(1),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );

        toast.warning("Cash Trip Recorded", {
          description: `£${platformFee.toFixed(2)} (${(fareConfig.commissionRate * 100).toFixed(0)}%${fareConfig.fixedTripFee ? ` + £${fareConfig.fixedTripFee.toFixed(2)}` : ''}) platform fee has been added to your pending account balance.`,
          duration: 5000,
        });
      } catch (err) {
        console.error("Failed to record cash payment:", err);
      }
    } else {
      setActiveRide((prev) =>
        prev
          ? {
              ...prev,
              paymentMethod: "cash",
              finalFare:
                (prev.fareEstimate || 0) +
                (totalPaidWaitSeconds / 60) * fareConfig.waitRatePerMinute +
                (prev.tipAmount || 0),
            }
          : null,
      );
      toast.warning("Demo: Cash Trip Recorded", {
        description: `${(fareConfig.commissionRate * 100).toFixed(0)}%${fareConfig.fixedTripFee ? ` + £${fareConfig.fixedTripFee.toFixed(2)}` : ''} platform fee added to pending balance.`,
      });
    }

    setRideState("review");
    setPaymentUrl(null);
  };

  const maxDim = Math.max(windowSize.width, windowSize.height);
  const mapSize = maxDim * 1.45; // slightly larger than sqrt(2) diagonal
  const overflowX = (mapSize - windowSize.width) / 2;
  const overflowY = (mapSize - windowSize.height) / 2;

  const mapPadding = useMemo(() => ({
    top: 100 + overflowY,
    bottom: 350 + overflowY,
    left: 20 + overflowX,
    right: 20 + overflowX,
  }), [overflowY, overflowX]);

  // Stabilize map props to completely eliminate flickering/redraw triggers
  const stabilizedCenter = useMemo(() => {
    let lat: number;
    let lng: number;
    if (!isAutoNavPaused) {
      if (isAutoNavHeadUp) {
        const [offsetLat, offsetLng] = getDynamicOffsetLatLng(
          driverLocation[0],
          driverLocation[1],
          mapHeading || 0,
          mapZoom
        );
        lat = offsetLat;
        lng = offsetLng;
      } else {
        lat = driverLocation[0];
        lng = driverLocation[1];
      }
    } else {
      lat = mapCenter[0];
      lng = mapCenter[1];
    }
    return { lat, lng };
  }, [
    isAutoNavPaused,
    isAutoNavHeadUp,
    driverLocation[0],
    driverLocation[1],
    mapHeading,
    mapZoom,
    mapCenter[0],
    mapCenter[1],
  ]);

  const stabilizedMapOptions = useMemo(() => ({
    ...premiumMapOptions,
    heading: mapHeading || 0,
    gestureHandling: "greedy" as google.maps.GestureHandling,
    draggable: true,
    padding: mapPadding,
  }), [mapHeading, mapPadding]);

  const stabilizedDriverPosition = useMemo(() => ({
    lat: driverLocation[0],
    lng: driverLocation[1]
  }), [driverLocation[0], driverLocation[1]]);

  return (
    <div className="flex-1 bg-[#0D0D0F] text-white overflow-hidden relative flex flex-col font-sans min-h-0">
      {" "}
      {/* Full bleed container */}
      {activeTab === "home" && (
        <>
          {/* Simulation Trigger (Dev Only) */}
          <div className="absolute top-[calc(48px+env(safe-area-inset-top))] left-4 z-[150] flex flex-col items-start gap-2 pointer-events-auto">
            <button
              onClick={simulateIncomingRide}
              className="bg-[#FFD60A] text-[#1A1A1E] text-xs px-4 py-2 rounded-full font-black uppercase tracking-widest shadow-[0_4px_15px_rgba(255,214,10,0.3)] hover:scale-105 active:scale-95 transition-all"
            >
              Simulate Job{" "}
              {activeRide
                ? activeRide.hasCardOnFile
                  ? "(Card)"
                  : "(No Card)"
                : ""}
            </button>
            {rideState === "in_progress" && (
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
          >
            <AnimatePresence>
              {isAutoNavHeadUp &&
                directions?.routes?.[0]?.legs?.[currentLegIndex]
                  ?.steps?.[0] && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute bottom-[210px] left-0 right-0 z-[60] flex flex-col items-center justify-center pointer-events-none text-center px-4 p-4 drop-shadow-[0_4px_4px_rgba(0,0,0,0.4)]"
                  >
                    <div className="flex-1 w-full max-w-sm flex flex-col items-center">
                      {/* !!! USER REQUESTED DESIGN LOCK !!! */}
                      {/* The styling for this heads-up instruction text is explicitly locked by the user. */}
                      {/* IT MUST REMAIN: transparent background, #2563EB text color, white drop shadow, no webkit text stroke, no black box. */}
                      <p
                        className="text-[22px] text-[#2563EB] font-black leading-tight px-2 mb-2 drop-shadow-[0_2px_4px_rgba(255,255,255,0.9)]"
                        dangerouslySetInnerHTML={{
                          __html: (() => {
                            const leg = directions.routes[0].legs[currentLegIndex || 0];
                            const steps = leg?.steps || [];
                            const currentStepIndex = mapCenter ? getCurrentStepIndex(mapCenter, steps) : 0;
                            if (currentStepIndex >= steps.length) return "";
                            
                            const step0 = steps[currentStepIndex];
                            const remainingDist = mapCenter ? getRemainingStepDistance(mapCenter, step0) : step0.distance?.value || 0;
                            let html = formatInstructionForDisplay(step0.instructions);
                            if (remainingDist <= 50 && currentStepIndex < steps.length - 1) {
                              const step1 = steps[currentStepIndex + 1];
                              html += ' <span style="opacity: 0.8; font-size: 0.85em;">then</span> <br/> ' + formatInstructionForDisplay(step1.instructions);
                            }
                            return html;
                          })()
                        }}
                      />
                      <div className="inline-flex bg-slate-900/90 backdrop-blur-sm px-4 py-1.5 rounded-lg shadow-lg border border-white/20">
                        <p className="text-[14px] text-[#00D26A] font-bold tracking-wider uppercase">
                          {(() => {
                            const leg = directions.routes[0].legs[currentLegIndex || 0];
                            const steps = leg?.steps || [];
                            const currentStepIndex = mapCenter ? getCurrentStepIndex(mapCenter, steps) : 0;
                            if (currentStepIndex >= steps.length) return "";
                            const step0 = steps[currentStepIndex];
                            return formatNavigateDistance(
                              mapCenter ? getRemainingStepDistance(mapCenter, step0) : step0.distance?.value
                            );
                          })()}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
            </AnimatePresence>

            {/* Premium Map Loader Overlay */}
            <AnimatePresence>
              {(!isLoaded || !isMapTilesLoaded || isSyncingMap) && (
                <motion.div
                  key="premium-map-loader"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                  className="absolute inset-0 bg-[#0D0D0F] z-[120] flex flex-col items-center justify-center gap-5 pointer-events-auto"
                >
                  <div className="relative flex items-center justify-center">
                    <div className="w-16 h-16 border border-[#2563EB]/45 rounded-full animate-ping absolute"></div>
                    <div className="w-10 h-10 border-[3px] border-t-[#2563EB] border-[#2563EB]/20 rounded-full animate-spin"></div>
                  </div>
                  <div className="flex flex-col items-center gap-1 text-center px-4">
                    <p className="text-[15.5px] font-bold text-white tracking-wide font-sans">
                      {isOnline ? "Syncing Driver Terminal" : "Positioning Driver"}
                    </p>
                    <p className="text-xs text-[#A1A1AA] max-w-xs leading-relaxed font-sans">
                      {isOnline 
                        ? "Connecting to high-precision GPS telemetry and loading real-time route optimization layers..."
                        : "Optimizing regional dispatch standby rules and routing nodes..."
                      }
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {isLoaded && (
              <div
                style={{
                  position: "absolute",
                  width: `${mapSize}px`,
                  height: `${mapSize}px`,
                  left: "50%",
                  top: "50%",
                  transform: `translate(-50%, -50%)`,
                  transformOrigin: "50% 50%",
                  transition: "transform 0.5s ease-out",
                }}
              >
                <GoogleMap
                  mapContainerStyle={MAP_CONTAINER_STYLE}
                  onDragStart={handleMapInteraction}
                  onDragEnd={() => {
                    if (mapInstance) {
                      const c = mapInstance.getCenter();
                      if (c) {
                        setMapCenter([c.lat(), c.lng()]);
                      }
                    }
                  }}
                  center={stabilizedCenter}
                  zoom={mapZoom}
                  onZoomChanged={() => {
                    if (mapInstance) {
                      const z = mapInstance.getZoom();
                      if (z !== undefined && z !== mapZoom) {
                        setMapZoom(z);
                        handleMapInteraction();
                      }
                    }
                  }}
                  onTilesLoaded={() => setIsMapTilesLoaded(true)}
                  onLoad={(map) => {
                    setMapInstance(map);
                    setIsMapTilesLoaded(true);
                  }}
                  options={stabilizedMapOptions}
                >
                  {isOnline && (
                    <OverlayViewF
                      position={stabilizedDriverPosition}
                      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                    >
                      <div
                        style={{
                          transform: `rotate(0deg)`,
                          transformOrigin: "18px 54px",
                          transition: "transform 0.5s ease-out",
                        }}
                        className="relative flex flex-col items-center justify-start -ml-[18px] -mt-[56px] z-50"
                      >
                      <div className="absolute top-[54px] w-6 h-2 bg-black/30 rounded-full blur-[1px]"></div>
                      {(!activeRide ||
                        rideState === "en_route_pickup" ||
                        rideState === "waiting") && (
                        <div className="absolute top-0 left-0 w-[36px] h-[36px] bg-[#FACC15] rounded-full animate-[ping_2s_ease-in-out_infinite] opacity-30"></div>
                      )}
                      <div className="bg-[#FACC15] w-[36px] h-[36px] rounded-full border-2 border-black flex items-center justify-center relative shadow-[0_0_15px_rgba(250,204,21,0.5)] z-20">
                        <Car
                          className="w-[20px] h-[20px] text-black"
                          fill="currentColor"
                        />
                        {/* The leg */}
                        <div className="absolute top-[100%] left-1/2 -translate-x-1/2 w-[3px] h-[16px] bg-black flex justify-center">
                          <div className="w-[1px] h-full bg-[#FACC15]"></div>
                        </div>
                        {/* The base dot */}
                        <div className="absolute top-[calc(100%+14px)] left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-[#FACC15] border-2 border-black rounded-full shadow-[0_0_10px_rgba(250,204,21,0.8)]"></div>
                      </div>
                    </div>
                  </OverlayViewF>
                )}

                {/* Show Pickup ONLY before they get in */}
                {(rideState === "en_route_pickup" || rideState === "waiting") &&
                  activeRide?.pickupLat &&
                  activeRide?.pickupLng && (
                    <>
                      <MarkerF
                        position={{
                          lat: activeRide.pickupLat,
                          lng: activeRide.pickupLng,
                        }}
                      />
                      <OverlayViewF
                        position={{
                          lat: activeRide.pickupLat,
                          lng: activeRide.pickupLng,
                        }}
                        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                      >
                        <div className="absolute bottom-10 left-[0] -translate-x-1/2 pointer-events-none flex flex-col items-center z-10 w-max max-w-[220px]">
                          <div className="bg-[#BBF7D0] border border-[#22C55E] p-2.5 rounded-xl shadow-lg relative">
                            <div className="font-extrabold text-[9px] uppercase tracking-widest text-[#065F46] mb-0.5">
                              Pickup
                            </div>
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
                {(rideState === "in_progress" || rideState === "review") &&
                  (() => {
                    // Decide which point to show based on journey progression.
                    // If we wanted to hide stops as they are completed, we'd need a 'completedStops' count,
                    // but since we don't have that yet, show all stops + dropoff, OR just the dropoff if no stops.
                    // Wait, if we want to show ONLY ONE card, and we have stops...
                    // We only show the card and marker for the currently active leg to avoid clutter.
                    const isDropoffLeg =
                      currentLegIndex >= (activeRide?.stops?.length || 0);

                    if (!isDropoffLeg) {
                      const stop = activeRide.stops[currentLegIndex];
                      if (!stop || !stop.coords) return null;
                      return (
                        <React.Fragment>
                          <MarkerF
                            position={{
                              lat: stop.coords.lat,
                              lng: stop.coords.lng,
                            }}
                          />
                          <OverlayViewF
                            position={{
                              lat: stop.coords.lat,
                              lng: stop.coords.lng,
                            }}
                            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                          >
                            <div className="absolute bottom-10 left-[0] -translate-x-1/2 pointer-events-none flex flex-col items-center z-10 w-max max-w-[220px]">
                              <div className="bg-[#FEF08A] border border-[#EAB308] p-2.5 rounded-xl shadow-lg relative">
                                <div className="font-extrabold text-[9px] uppercase tracking-widest text-[#713F12] mb-0.5">
                                  Stop {currentLegIndex + 1}
                                </div>
                                <div className="font-bold text-[11px] text-[#451A03] leading-tight whitespace-normal text-left">
                                  {stop.address || "Stop Location"}
                                </div>
                                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#FEF08A] border-b border-r border-[#EAB308] rotate-45 shadow-[2px_2px_2px_rgba(0,0,0,0.05)]"></div>
                              </div>
                            </div>
                          </OverlayViewF>
                        </React.Fragment>
                      );
                    }

                    // Dropoff leg
                    return (
                      <>
                        {activeRide?.dropoffLat && activeRide?.dropoffLng && (
                          <>
                            <MarkerF
                              position={{
                                lat: activeRide.dropoffLat,
                                lng: activeRide.dropoffLng,
                              }}
                            />
                            <OverlayViewF
                              position={{
                                lat: activeRide.dropoffLat,
                                lng: activeRide.dropoffLng,
                              }}
                              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                            >
                              <div className="absolute bottom-10 left-[0] -translate-x-1/2 pointer-events-none flex flex-col items-center z-10 w-max max-w-[220px]">
                                <div className="bg-[#FECDD3] border border-[#E11D48] p-2.5 rounded-xl shadow-lg relative">
                                  <div className="font-extrabold text-[9px] uppercase tracking-widest text-[#881337] mb-0.5">
                                    Dropoff
                                  </div>
                                  <div className="font-bold text-[11px] text-[#4C0519] leading-tight whitespace-normal text-left">
                                    {activeRide.dropoffAddress ||
                                      "Dropoff Location"}
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
                        strokeColor: "#007AFF", // Google Maps style Blue
                        strokeOpacity: 0.5,
                        strokeWeight: 4,
                      },
                    }}
                  />
                )}

                {!!activeRide &&
                  directions?.routes?.[0]?.overview_path &&
                  activeHazards.map((hazard) => {
                    const path = directions.routes[0].overview_path;
                    let isOnRoute = false;
                    for (let i = 0; i < path.length; i++) {
                      const point = path[i];
                      const pLat =
                        typeof point.lat === "function"
                          ? point.lat()
                          : (point.lat as unknown as number);
                      const pLng =
                        typeof point.lng === "function"
                          ? point.lng()
                          : (point.lng as unknown as number);
                      const diffLat = pLat - hazard.lat;
                      const diffLng =
                        (pLng - hazard.lng) * Math.cos((pLat * Math.PI) / 180);
                      const dist =
                        Math.sqrt(Math.pow(diffLat, 2) + Math.pow(diffLng, 2)) *
                        111320;
                      if (dist < 150) {
                        // 150 meters tolerance to the route path
                        isOnRoute = true;
                        break;
                      }
                    }
                    if (!isOnRoute) return null;

                    let HazardIcon = AlertTriangle;

                    if (hazard.type === "Traffic") {
                      HazardIcon = Car;
                    } else if (hazard.type === "Construction") {
                      HazardIcon = HardHat;
                    } else if (hazard.type === "Road Closure") {
                      HazardIcon = MinusCircle;
                    } else if (hazard.type === "Speed Trap") {
                      HazardIcon = Camera;
                    } else if (hazard.type === "Incorrect Route") {
                      HazardIcon = MapPinOff;
                    }

                    // Changed background to yellow and text to black
                    const textColor = "text-black";
                    const iconBg = "bg-[#FFCC00]";
                    const borderColor = "border-[#E5B800]";

                    return (
                      <OverlayViewF
                        key={hazard.id}
                        position={{ lat: hazard.lat, lng: hazard.lng }}
                        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                      >
                        <div className="absolute -translate-x-1/2 -translate-y-[100%] pointer-events-none flex flex-col justify-end items-center z-10 w-max pb-[22px]">
                          <div
                            className={cn(
                              "bg-[#FFCC00] border px-3 py-1.5 rounded-xl shadow-md relative flex items-center justify-center mb-1",
                              borderColor,
                            )}
                          >
                            <span
                              className={cn(
                                "font-black text-[11px] uppercase tracking-wider",
                                textColor,
                              )}
                            >
                              {hazard.type}
                            </span>
                            <div
                              className={cn(
                                "absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#FFCC00] border-b border-r rotate-45",
                                borderColor,
                              )}
                            ></div>
                          </div>
                        </div>
                        <div className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                          <div
                            className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-[2px]",
                              iconBg,
                              borderColor,
                            )}
                          >
                            <HazardIcon className={cn("w-4 h-4", textColor)} />
                          </div>
                        </div>
                      </OverlayViewF>
                    );
                  })}

                {/* AI Predictive Surge Heatmap */}
                {showPredictiveSurge &&
                  !activeRide &&
                  demandZones.map((zone, idx) => {
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

                {/* Passenger Live Location */}
                {passengerPos &&
                  (rideState === "en_route_pickup" ||
                    rideState === "waiting" ||
                    rideState === "in_progress" ||
                    rideState === "en_route_dropoff") && (
                    <OverlayViewF
                      position={{
                        lat: passengerPos.lat,
                        lng: passengerPos.lng,
                      }}
                      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                    >
                      <div
                        style={{
                          transform: "none",
                          transformOrigin: "13px 38px",
                        }}
                        className="relative flex flex-col items-center justify-start -ml-[13px] -mt-[38px] z-50"
                      >
                        <div className="absolute top-[36px] w-5 h-1.5 bg-black/30 rounded-full blur-[1px]"></div>

                        {/* Pulsing ring */}
                        <div className="absolute top-0 left-0 w-[26px] h-[26px] bg-[#761eb9] rounded-full animate-[ping_2s_ease-in-out_infinite] opacity-60"></div>

                        <div className="bg-[#761eb9] w-[26px] h-[26px] rounded-full border-2 border-white flex items-center justify-center relative shadow-[0_0_12px_rgba(118,30,185,0.5)] z-20">
                          <svg viewBox="0 0 24 24" className="w-[13px] h-[13px]" fill="white">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                          </svg>
                          {/* The leg */}
                          <div className="absolute top-[100%] left-1/2 -translate-x-1/2 w-[3px] h-[6px] bg-white flex justify-center">
                            <div className="w-[1px] h-full bg-[#761eb9]"></div>
                          </div>
                          {/* The base dot */}
                          <div className="absolute top-[calc(100%+4px)] left-1/2 -translate-x-1/2 w-[11px] h-[11px] bg-[#761eb9] border-2 border-white rounded-full shadow-[0_0_8px_rgba(118,30,185,0.8)]"></div>
                        </div>
                        <div className="absolute -top-[24px] bg-black/80 px-2 py-0.5 rounded text-[10px] font-bold text-[#761eb9] whitespace-nowrap shadow border border-[#761eb9]/50 z-30">
                          PASSENGER
                        </div>
                      </div>
                    </OverlayViewF>
                  )}
              </GoogleMap>
            </div>
          )}

            {/* Main Map Zoom Controls & Overview Nav */}
            {mapInstance && (
              <div
                className={cn(
                  "absolute right-4 z-[45] transition-all duration-300 flex flex-col gap-3 items-end",
                  rideState === "incoming" ||
                    rideState === "review" ||
                    rideState === "completed"
                    ? "opacity-0 pointer-events-none"
                    : rideState === "idle"
                      ? "bottom-[calc(140px+env(safe-area-inset-bottom,0px))]"
                      : isCardCollapsed
                        ? "bottom-[280px]"
                        : "bottom-[420px]",
                )}
              >
                <div className="flex flex-col items-center">
                  <MapZoomControls mapInstance={mapInstance} />

                  {(rideState === "en_route_pickup" ||
                    rideState === "waiting" ||
                    rideState === "in_progress") &&
                    activeRide?.id && (
                      <>
                        <button
                          onClick={handleToggleAutoNav}
                          className={cn(
                            "w-[34px] h-[34px] rounded-full flex items-center justify-center shadow-[0_6px_16px_rgba(0,210,106,0.4)] active:scale-95 transition-transform shrink-0 mt-8",
                            isAutoNavHeadUp
                              ? "bg-[#00D26A]"
                              : "bg-[#1A1A1E] border border-[#00D26A]",
                          )}
                        >
                          <Compass
                            style={{
                              transform: mapHeading ? `rotate(${-mapHeading}deg)` : "none",
                              transition: "transform 0.5s ease-out",
                            }}
                            className={cn(
                              "w-[18px] h-[18px]",
                              isAutoNavHeadUp
                                ? "text-[#1A1A1E]"
                                : "text-[#00D26A]",
                            )}
                          />
                        </button>
                      </>
                    )}
                </div>
              </div>
            )}

            {/* Lighter, softer gradient overlays to preserve map visibility */}
            <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-[#0D0D0F]/40 to-transparent pointer-events-none z-[5]"></div>
            <div className="absolute bottom-0 left-0 right-0 h-56 bg-gradient-to-t from-[#0D0D0F]/40 to-transparent pointer-events-none z-[5]"></div>
          </div>

          {/* Incoming Message Quick Reply Popup */}
          <AnimatePresence>
            {incomingPopupMessage && !isChatOpen && (
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="absolute left-4 right-4 z-[60] bg-[#1A1A1E]/95 backdrop-blur-md rounded-2xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-[#333338]"
                style={{
                  bottom:
                    rideState === "idle"
                      ? "140px"
                      : isCardCollapsed
                        ? "280px"
                        : "420px",
                }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-[#00D26A]/20 flex items-center justify-center shrink-0">
                    <MessageCircle className="w-5 h-5 text-[#00D26A]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-bold text-[14px] truncate mb-1">
                      {activeRide?.passengerName ||
                        activeRide?.name ||
                        "Passenger"}
                    </h3>
                    <p className="text-[#E4E4E7] text-[13px] leading-snug line-clamp-2 break-words">
                      "{incomingPopupMessage.text}"
                    </p>
                  </div>
                  <button
                    onClick={() => setIncomingPopupMessage(null)}
                    className="w-8 h-8 rounded-full bg-[#252529] flex items-center justify-center shrink-0 active:scale-95 transition-transform"
                  >
                    <X className="w-4 h-4 text-[#8E8E93]" />
                  </button>
                </div>

                <div className="flex overflow-x-auto no-scrollbar gap-2 pb-1 w-full">
                  {[
                    "OK, got it!",
                    "I'll be right there",
                    "Traffic is heavy",
                    "I'll be outside shortly",
                    "I'm at location but can not find you."
                  ].map((msg, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuickReply(msg)}
                      className="whitespace-nowrap px-4 py-2 bg-[#252529] border border-[#333338] text-white text-[13px] font-bold rounded-[10px] active:scale-95 transition-transform shrink-0 shadow-sm"
                    >
                      {msg}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Chat Component */}
          {(rideState === "en_route_pickup" ||
            rideState === "waiting" ||
            rideState === "in_progress") &&
            activeRide?.id && (
              <RideChat
                rideId={activeRide.id}
                isOpen={isChatOpen}
                onClose={() => setIsChatOpen(false)}
                otherPartyName={
                  activeRide?.passengerName || activeRide?.name || "Passenger"
                }
                otherPartyPhone={activeRide?.passengerPhone || undefined}
                passengerId={activeRide?.passengerId}
                canSendSMS={
                  rideState === "waiting" && elapsedWaitSeconds >= 180
                }
              />
            )}

          {/* Floating Map Controls & SOS */}
          <div className="absolute top-[calc(100px+env(safe-area-inset-top))] right-4 z-50 flex flex-col items-end gap-3 pointer-events-auto">
            <button
              onClick={() => setShowHazardModal(true)}
              className="w-10 h-10 bg-[#1A1A1E]/90 backdrop-blur-md border border-[#2C2C30] rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
            >
              <Zap
                className={cn(
                  "w-4 h-4",
                  showHazardModal ? "text-[#FF3B30]" : "text-[#E4E4E7]",
                )}
              />
            </button>

            {/* AI Predictive Surge Heatmap Control */}
            <button
              onClick={() => {
                setShowPredictiveSurge(!showPredictiveSurge);
                toast.success(
                  !showPredictiveSurge
                    ? "AI Predictive Surge Heatmap active"
                    : "AI Predictive Surge Heatmap hidden"
                );
              }}
              className={cn(
                "w-10 h-10 backdrop-blur-md border rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-all",
                showPredictiveSurge
                  ? "bg-[#D97706]/90 border-[#B45309] text-white shadow-amber-500/20"
                  : "bg-[#1A1A1E]/90 border-[#2C2C30] text-[#E4E4E7] hover:border-white/30"
              )}
              title="Toggle AI Predictive Surge Heatmap"
            >
              <TrendingUp className="w-4 h-4" />
            </button>

            {/* Navigation Button */}
            {(rideState === "en_route_pickup" ||
              rideState === "waiting" ||
              rideState === "in_progress") &&
              activeRide?.id && (
                <button
                  onClick={handleStartExternalNavigation}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-[#007AFF] shadow-[0_6px_16px_rgba(0,122,255,0.5)] active:scale-95 transition-transform"
                >
                  <Navigation className="w-5 h-5 text-white fill-white" />
                </button>
              )}
          </div>

          {/* Recalculation Limit Warning Banner */}
          {recalcCount >= 3 &&
            (rideState === "en_route_pickup" ||
              rideState === "waiting" ||
              rideState === "in_progress") &&
            activeRide?.id && (
              <div className="absolute top-[calc(12px+env(safe-area-inset-top))] left-4 right-16 z-40 pointer-events-none flex justify-start animate-fade-in">
                <div
                  id="recalc-limit-warning"
                  className="bg-slate-900 border border-white/20 p-3 rounded-lg shadow-2xl flex items-start gap-2.5 max-w-xs pointer-events-auto"
                >
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-amber-500 font-bold leading-normal mb-0.5">
                      Recalculation Limit Reached
                    </p>
                    <p className="text-[10px] text-slate-300 leading-normal font-sans">
                      Live rerouting is paused. Press the blue <b className="text-white">Navigation 🚀</b> button for full external turn-by-turn.
                    </p>
                  </div>
                </div>
              </div>
            )}

          {/* 2. Top UI: Menu button */}
          <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
            {/* Status Header (Sticky) */}
            <div className="absolute top-[calc(3rem+env(safe-area-inset-top))] left-4 right-4 z-40 flex items-center justify-end pointer-events-none">
              <button
                onClick={() => setActiveTab("menu")}
                className="w-10 h-10 bg-[#1A1A1E]/95 backdrop-blur-md rounded-full border border-[#2C2C30] text-white flex items-center justify-center shadow-lg pointer-events-auto active:scale-95 transition-transform"
              >
                <MenuIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 pointer-events-none"></div>

          {/* Screen 7: Payment QR Handshake */}
          <AnimatePresence>
            {rideState === "completed" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] bg-[#0D0D0F]/95 backdrop-blur-md overflow-y-auto pointer-events-auto"
              >
                <div className="min-h-full flex flex-col justify-start p-6 pt-16 pb-32 max-w-md mx-auto">
                  <div className="w-full max-w-sm mx-auto bg-[#1A1A1E] border border-[#2C2C30] rounded-[2.5rem] p-8 text-center shadow-2xl relative overflow-hidden my-auto mb-16">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-[#00D26A] to-emerald-500"></div>

                    <h2 className="text-[13px] font-black text-[#E4E4E7] mb-1 tracking-[0.2em] uppercase">
                      Total Fare
                    </h2>
                    <h1 className="text-[52px] leading-tight font-black text-white mb-2">
                      £
                      {(
                        (activeRide?.fareEstimate || 38.5) +
                        (totalPaidWaitSeconds / 60) *
                          fareConfig.waitRatePerMinute +
                        (activeRide?.tipAmount || 0)
                      ).toFixed(2)}
                    </h1>
                    {activeRide?.tipAmount ? (
                      <p className="text-emerald-400 font-bold text-sm mb-6 bg-emerald-500/10 inline-block px-3 py-1 rounded-full border border-emerald-500/20">
                        Includes £{activeRide.tipAmount.toFixed(2)} Tip
                      </p>
                    ) : (
                      <p className="text-slate-500 font-bold text-xs mb-8">
                        Passenger can scan to pay & tip
                      </p>
                    )}

                    <div className="relative mb-8 bg-white p-4 rounded-3xl inline-block shadow-[0_0_50px_rgba(255,255,255,0.05)] border-4 border-white/10 min-w-[212px] min-h-[212px]">
                      {isGeneratingPayment || !paymentUrl ? (
                        <div className="w-[180px] h-[180px] flex flex-col items-center justify-center gap-4">
                          <div className="w-10 h-10 border-4 border-[#00D26A] border-t-transparent rounded-full animate-spin"></div>
                          <p className="text-[10px] font-black text-[#0D0D0F] uppercase tracking-widest">
                            {isGeneratingPayment
                              ? "Securing QR..."
                              : "Finalizing..."}
                          </p>
                        </div>
                      ) : (
                        <div className="relative group">
                          <QRCodeSVG 
                            value={paymentUrl}
                            size={180}
                            level="H"
                            className="w-[180px] h-[180px] rounded-lg bg-white"
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
                          <h3 className="text-white text-lg font-black tracking-wide mb-1 uppercase">
                            Confirm Cash
                          </h3>
                          <p className="text-[#E4E4E7] text-xs mb-4 leading-relaxed font-medium px-2">
                            Did you receive cash for this trip? The commission
                            will be added to your pending balance and deducted
                            from future card earnings.
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
            {rideState === "incoming" && (
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="absolute bottom-0 left-0 right-0 z-50 flex flex-col justify-end px-2 sm:px-4 md:px-0 md:max-w-[440px] md:left-1/2 md:-translate-x-1/2 pb-[calc(4rem+env(safe-area-inset-bottom,0px)+0.25rem)] pointer-events-none"
              >
                {/* Same content as before */}
                <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-3xl p-3 shadow-2xl relative overflow-hidden pointer-events-auto flex flex-col w-full max-h-[calc(100vh-8.5rem-env(safe-area-inset-top,0px))]">
                  {/* Highlight header */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#00D26A] to-transparent shrink-0"></div>

                  <div className="flex items-center justify-between mb-2 shrink-0">
                    <h2 className="text-sm font-black text-[#FF3B30] px-1 tracking-wider flex items-center gap-2 uppercase">
                      <span className="w-2 h-2 bg-[#FF3B30] rounded-full animate-pulse shadow-[0_0_8px_#FF3B30]"></span>
                      New Ride Request
                    </h2>
                  </div>

                  <div className="flex-1 flex flex-col min-h-0 overflow-y-auto scrollbar-hide -mx-2 px-2 pb-1">
                    {/* Rider Details */}
                    <div className="pt-2 pb-1 relative">
                      {/* Circular Timer Ring */}
                      <div className="absolute top-1 right-0 w-9 h-9 flex items-center justify-center shrink-0">
                        <svg className="w-full h-full transform -rotate-90 filter drop-shadow-[0_0_4px_rgba(255,255,255,0.1)]">
                          <circle
                            cx="18"
                            cy="18"
                            r="14"
                            className="stroke-[#2C2C30] fill-none"
                            strokeWidth="3"
                          />
                          <motion.circle
                            cx="18"
                            cy="18"
                            r="14"
                            className={cn(
                              "fill-none",
                              incomingTimer > 5
                                ? "stroke-[#00D26A]"
                                : "stroke-[#FF3B30]",
                            )}
                            strokeWidth="3"
                            strokeDasharray="88"
                            strokeLinecap="round"
                            initial={{ strokeDashoffset: 0 }}
                            animate={{
                              strokeDashoffset: 88 - 88 * (incomingTimer / 15),
                            }}
                            transition={{ duration: 1, ease: "linear" }}
                          />
                        </svg>
                        <span
                          className={cn(
                            "absolute text-[15px] font-medium tabular-nums font-mono drop-shadow-[0_0_6px_currentColor]",
                            incomingTimer > 5
                              ? "text-[#00D26A]"
                              : "text-[#FF3B30]",
                          )}
                        >
                          {incomingTimer}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mb-2 pr-10">
                        <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-800 text-sm border border-white shrink-0">
                          {(activeRide?.name || "S")[0]}
                        </div>
                        <div className="flex-1 min-w-0 flex justify-between items-start">
                          <div>
                            <h3 className="text-[13px] font-bold text-white leading-tight truncate">
                              {activeRide?.name || "Sarah T."}
                            </h3>
                            <p className="text-[11px] text-[#FF9500] font-bold">
                              ⭐ 4.7{" "}
                              <span className="text-[#E4E4E7] font-normal">
                                (124 trips)
                              </span>
                            </p>
                          </div>
                          {activeRide?.isRiderPlus !== false && (
                            <div className="bg-white text-black px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider flex items-center gap-1 shadow-[0_0_10px_rgba(255,255,255,0.2)] shrink-0 mt-0.5 border border-white">
                              <Star className="w-2.5 h-2.5 fill-black text-black" />{" "}
                              Rider Plus
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        {/* Fare Section (Moved below rider profile) */}
                        <div className="bg-[#252529] rounded-xl p-2 relative overflow-hidden shrink-0">
                          <div className="flex justify-between items-end mb-1">
                            <h1 className="text-2xl leading-[1] font-black text-white flex items-end gap-2.5 shrink-0">
                              £{activeRide?.fareEstimate?.toFixed(2) || "38.50"}
                              <div className="flex flex-col items-center justify-end leading-none mb-0.5">
                                <span className="text-[15px] font-black text-yellow-400">
                                  {activeRide?.distanceToPickupMiles || 1.2} +{" "}
                                  {activeRide?.distanceMiles || 22}
                                </span>
                                <span className="text-[16px] font-bold text-yellow-400">
                                  (
                                  {(
                                    (activeRide?.distanceToPickupMiles || 1.2) +
                                    (activeRide?.distanceMiles || 22)
                                  ).toFixed(1)}{" "}
                                  mi)
                                </span>
                              </div>
                            </h1>
                            <div className="flex gap-1 items-center">
                              {activeRide?.isPriority && (
                                <div className="bg-white text-black px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-[0_0_10px_rgba(255,255,255,0.2)] border border-white">
                                  <Zap className="w-2.5 h-2.5 fill-black text-black" />{" "}
                                  Priority
                                </div>
                              )}
                              {fareConfig.surgeEnabled && (
                                <span className="bg-white text-black border border-white px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider whitespace-nowrap shadow-[0_0_10px_rgba(255,255,255,0.2)] flex items-center gap-1">
                                  <span className="text-[10px]">🔥</span>{" "}
                                  {activeRide?.surgeModel === "fixed"
                                    ? "+£" + (activeRide?.surgeFixed || "2.00")
                                    : (activeRide?.surgeMultiplier || "1.4") +
                                      "x"}
                                </span>
                              )}
                            </div>
                          </div>
                          {(() => {
                            let finalPayout =
                              (activeRide?.fareEstimate || 38.5) *
                              (1 - fareConfig.commissionRate) - (fareConfig.fixedTripFee || 0);
                            if (
                              fareConfig.surgeEnabled &&
                              !activeRide?.isSimulated
                            ) {
                              // Note: simulated already bundles it in fareEstimate
                              // Absorb surge cost for driver payout if the passenger fare didn't include it explicitly
                              // If baseCalc exists and it roughly matches fareEstimate, it means surge wasn't applied on the passenger side
                              // We dynamically inject it into the driver payout here.
                              const hasNoSurgeApplied = activeRide?.baseCalc
                                ? Math.abs(
                                    activeRide.fareEstimate -
                                      activeRide.baseCalc,
                                  ) < 2.0
                                : true;
                              if (
                                hasNoSurgeApplied ||
                                activeRide?.surgeMultiplier === 1.0
                              ) {
                                if (fareConfig.surgeModel === "fixed") {
                                  finalPayout +=
                                    fareConfig.surgeFixedAmount || 2.0;
                                } else {
                                  // Multiplier style
                                  finalPayout +=
                                    (activeRide?.fareEstimate || 38.5) *
                                    ((fareConfig.surgeMultiplierValue || 1.4) -
                                      1.0);
                                }
                              }
                            }
                            return (
                              <p className="text-[#00D26A] text-[13px] font-bold mt-0.5">
                                You earn: £{finalPayout.toFixed(2)}
                              </p>
                            );
                          })()}
                        </div>

                        <div className="mt-1 mb-1">
                          <div className="relative pl-5 space-y-2 flex-1">
                            {/* Route Line indicator */}
                            <div className="absolute left-[7px] top-1.5 bottom-1.5 w-[2px] bg-[#2C2C30] rounded-full"></div>

                            <div className="relative">
                              <div className="absolute w-2.5 h-2.5 rounded-full bg-[#00D26A] border-[1.5px] border-[#1A1A1E] -left-[18.5px] top-[3px] z-10"></div>
                              <p className="text-[9px] font-black uppercase text-[#00D26A] tracking-wider leading-none mb-0.5">
                                Pickup
                              </p>
                              <p className="text-[16px] font-semibold text-white drop-shadow-sm leading-tight line-clamp-2">
                                {activeRide?.pickupAddress ||
                                  "12 Elm Street, SE15"}
                              </p>
                              <p className="text-[15px] font-bold text-yellow-400 mt-0.5">
                                {activeRide?.distanceToPickupMiles || "1.2"} mi
                                from you
                              </p>
                            </div>

                            {(activeRide?.stops || []).map(
                              (stop: any, idx: number) => (
                                <div key={idx} className="relative mt-2">
                                  <div className="absolute w-2.5 h-2.5 rounded-full bg-[#FF9500] border-[1.5px] border-[#1A1A1E] -left-[18.5px] top-[3px] z-10"></div>
                                  <p className="text-[9px] font-black uppercase text-[#FF9500] tracking-wider leading-none mb-0.5">
                                    Stop {idx + 1}
                                  </p>
                                  <p className="text-[16px] font-semibold text-white drop-shadow-sm leading-tight line-clamp-2">
                                    {stop.address}
                                  </p>
                                </div>
                              ),
                            )}

                            <div className="relative mt-2">
                              <div className="absolute w-2.5 h-2.5 bg-[#FF3B30] border-[1.5px] border-[#1A1A1E] -left-[18.5px] top-[3px] z-10"></div>
                              <p className="text-[9px] font-black uppercase text-[#FF3B30] tracking-wider leading-none mb-0.5">
                                Drop-off
                              </p>
                              <p className="text-[16px] font-semibold text-white drop-shadow-sm leading-tight line-clamp-2">
                                {activeRide?.dropoffAddress ||
                                  "Bristol Temple Meads"}
                              </p>
                              <p className="text-[15px] font-bold text-yellow-400 mt-0.5">
                                {activeRide?.distanceMiles || "22"} mi from
                                pickup
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                    {/* Map Section (Moved to bottom) */}
                    {isLoaded &&
                      activeRide?.pickupLat &&
                      activeRide?.dropoffLat && (
                        <div className="w-full h-[140px] rounded-xl overflow-hidden relative border border-[#2C2C30] shrink-0 mb-2">
                          <div className="absolute inset-0 pointer-events-none z-10 rounded-xl ring-1 ring-inset ring-white/10" />
                          <GoogleMap
                            mapContainerStyle={{
                              width: "100%",
                              height: "100%",
                            }}
                            onLoad={(map) => {
                              setMiniMapInstance(map);
                              const bounds =
                                new window.google.maps.LatLngBounds();
                              if (activeRide.pickupLat && activeRide.pickupLng)
                                bounds.extend({
                                  lat: activeRide.pickupLat,
                                  lng: activeRide.pickupLng,
                                });
                              if (
                                activeRide.dropoffLat &&
                                activeRide.dropoffLng
                              )
                                bounds.extend({
                                  lat: activeRide.dropoffLat,
                                  lng: activeRide.dropoffLng,
                                });
                              (activeRide.stops || []).forEach((s: any) => {
                                if (s.coords) bounds.extend(s.coords);
                              });
                              map.fitBounds(bounds, {
                                top: 10,
                                bottom: 10,
                                left: 10,
                                right: 10,
                              });
                              // Apply a max zoom in case points are very close
                              const listener =
                                window.google.maps.event.addListener(
                                  map,
                                  "idle",
                                  () => {
                                    if ((map.getZoom() || 0) > 15)
                                      map.setZoom(15); // Restrict to 15 as user mentioned
                                    window.google.maps.event.removeListener(
                                      listener,
                                    );
                                  },
                                );
                            }}
                            options={premiumMapOptions}
                          >
                            {activeRide.pickupLat && (
                              <MarkerF
                                position={{
                                  lat: activeRide.pickupLat,
                                  lng: activeRide.pickupLng,
                                }}
                                label="P"
                              />
                            )}
                            {activeRide.dropoffLat && (
                              <MarkerF
                                position={{
                                  lat: activeRide.dropoffLat,
                                  lng: activeRide.dropoffLng,
                                }}
                                label="D"
                              />
                            )}
                            {(activeRide.stops || []).map(
                              (s: any, i: number) =>
                                s.coords && (
                                  <React.Fragment key={i}>
                                    <MarkerF
                                      position={s.coords}
                                      label={`${i + 1}`}
                                    />
                                  </React.Fragment>
                                ),
                            )}
                          </GoogleMap>
                          {miniMapInstance && (
                            <MapZoomControls
                              mapInstance={miniMapInstance}
                              className="absolute bottom-2 right-2 z-20"
                            />
                          )}
                        </div>
                      )}

                    
                    </div>
                  </div>

                  {activeRide?.comments && (
                    <div className="mb-1.5 bg-[#FFD60A] border rounded-[8px] px-2 py-1.5 flex items-start gap-2 shadow-[0_4px_10px_rgba(255,214,10,0.2)] shrink-0">
                      <MessageSquare className="w-3 h-3 text-[#1A1A1E] shrink-0 mt-[3px]" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[#1A1A1E] text-[8px] font-black uppercase tracking-wider block mb-0 opacity-70 leading-none">
                          Passenger Note
                        </span>
                        <p className="text-[#1A1A1E] text-[10px] font-bold leading-tight mt-[1px]">
                          {activeRide.comments}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-0 shrink-0 relative z-20">
                    {declineConfirmActive ? (
                      <button
                        onClick={() => { setDeclineConfirmActive(false); handleDeclineRide(); }}
                        className="w-[100px] h-10 bg-[#FF3B30] text-white rounded-[10px] font-black text-[12px] flex items-center justify-center active:scale-[0.98] shadow-sm transition-transform shrink-0"
                      >
                        CONFIRM
                      </button>
                    ) : (
                      <button
                        onClick={() => setDeclineConfirmActive(true)}
                        className="w-10 h-10 bg-slate-900 border border-[#2C2C30] text-[#E4E4E7] rounded-[10px] flex items-center justify-center active:scale-[0.98] shadow-sm transition-transform shrink-0 hover:bg-slate-800"
                      >
                        <X className="w-5 h-5 stroke-[3]" />
                      </button>
                    )}
                    <button
                      onClick={() => { setDeclineConfirmActive(false); handleAcceptRide(); }}
                      className="flex-1 h-10 bg-[#00D26A] text-[#0D0D0F] rounded-[10px] font-black text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] shadow-[0_4px_20px_rgba(0,210,106,0.2)] transition-transform"
                    >
                      <Check className="w-5 h-5 stroke-[3]" /> ACCEPT
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Screen 3b: Stacked Incoming Ride Request Overlay */}
          <AnimatePresence>
            {stackedRideOffer && rideState === "in_progress" && (
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="absolute bottom-0 left-0 right-0 z-50 flex flex-col justify-end px-2 sm:px-4 md:px-0 md:max-w-[440px] md:left-1/2 md:-translate-x-1/2 pb-[calc(4rem+env(safe-area-inset-bottom,0px)+0.25rem)] pointer-events-none"
              >
                {/* Same content as before */}
                <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-3xl p-3 shadow-2xl relative overflow-hidden pointer-events-auto flex flex-col w-full max-h-[calc(100vh-8.5rem-env(safe-area-inset-top,0px))]">
                  {/* Highlight header */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#00D26A] to-transparent shrink-0"></div>

                  <div className="flex items-center justify-between mb-2 shrink-0">
                    <h2 className="text-sm font-black text-[#FF3B30] px-1 tracking-wider flex items-center gap-2 uppercase">
                      <span className="w-2 h-2 bg-[#FF3B30] rounded-full animate-pulse shadow-[0_0_8px_#FF3B30]"></span>
                      Next Ride Request (Stacked)
                    </h2>
                  </div>

                  <div className="flex-1 flex flex-col min-h-0 overflow-y-auto scrollbar-hide -mx-2 px-2 pb-1">
                    {/* Rider Details */}
                    <div className="pt-2 pb-1 relative">
                      {/* Circular Timer Ring */}
                      <div className="absolute top-1 right-0 w-9 h-9 flex items-center justify-center shrink-0">
                        <svg className="w-full h-full transform -rotate-90 filter drop-shadow-[0_0_4px_rgba(255,255,255,0.1)]">
                          <circle
                            cx="18"
                            cy="18"
                            r="14"
                            className="stroke-[#2C2C30] fill-none"
                            strokeWidth="3"
                          />
                          <motion.circle
                            cx="18"
                            cy="18"
                            r="14"
                            className={cn(
                              "fill-none",
                              stackedIncomingTimer > 5
                                ? "stroke-[#00D26A]"
                                : "stroke-[#FF3B30]",
                            )}
                            strokeWidth="3"
                            strokeDasharray="88"
                            strokeLinecap="round"
                            initial={{ strokeDashoffset: 0 }}
                            animate={{
                              strokeDashoffset:
                                88 - 88 * (stackedIncomingTimer / 15),
                            }}
                            transition={{ duration: 1, ease: "linear" }}
                          />
                        </svg>
                        <span
                          className={cn(
                            "absolute text-[15px] font-medium tabular-nums font-mono drop-shadow-[0_0_6px_currentColor]",
                            stackedIncomingTimer > 5
                              ? "text-[#00D26A]"
                              : "text-[#FF3B30]",
                          )}
                        >
                          {stackedIncomingTimer}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mb-2 pr-10">
                        <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-800 text-sm border border-white shrink-0">
                          {(stackedRideOffer?.name || "S")[0]}
                        </div>
                        <div className="flex-1 min-w-0 flex justify-between items-start">
                          <div>
                            <h3 className="text-[13px] font-bold text-white leading-tight truncate">
                              {stackedRideOffer?.name || "Sarah T."}
                            </h3>
                            <p className="text-[11px] text-[#FF9500] font-bold">
                              ⭐ 4.7{" "}
                              <span className="text-[#E4E4E7] font-normal">
                                (124 trips)
                              </span>
                            </p>
                          </div>
                          {stackedRideOffer?.isRiderPlus !== false && (
                            <div className="bg-white text-black px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider flex items-center gap-1 shadow-[0_0_10px_rgba(255,255,255,0.2)] shrink-0 mt-0.5 border border-white">
                              <Star className="w-2.5 h-2.5 fill-black text-black" />{" "}
                              Rider Plus
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        {/* Fare Section (Moved below rider profile) */}
                        <div className="bg-[#252529] rounded-xl p-2 relative overflow-hidden shrink-0">
                          <div className="flex justify-between items-end mb-1">
                            <h1 className="text-2xl leading-[1] font-black text-white flex items-end gap-2.5 shrink-0">
                              £
                              {stackedRideOffer?.fareEstimate?.toFixed(2) ||
                                "38.50"}
                              <div className="flex flex-col items-center justify-end leading-none mb-0.5">
                                <span className="text-[15px] font-black text-yellow-400">
                                  {stackedRideOffer?.distanceToPickupMiles ||
                                    1.2}{" "}
                                  + {stackedRideOffer?.distanceMiles || 22}
                                </span>
                                <span className="text-[16px] font-bold text-yellow-400">
                                  (
                                  {(
                                    (stackedRideOffer?.distanceToPickupMiles ||
                                      1.2) +
                                    (stackedRideOffer?.distanceMiles || 22)
                                  ).toFixed(1)}{" "}
                                  mi)
                                </span>
                              </div>
                            </h1>
                            <div className="flex gap-1 items-center">
                              {stackedRideOffer?.isPriority && (
                                <div className="bg-white text-black px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-[0_0_10px_rgba(255,255,255,0.2)] border border-white">
                                  <Zap className="w-2.5 h-2.5 fill-black text-black" />{" "}
                                  Priority
                                </div>
                              )}
                              {fareConfig.surgeEnabled && (
                                <span className="bg-white text-black border border-white px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider whitespace-nowrap shadow-[0_0_10px_rgba(255,255,255,0.2)] flex items-center gap-1">
                                  <span className="text-[10px]">🔥</span>{" "}
                                  {stackedRideOffer?.surgeModel === "fixed"
                                    ? "+£" +
                                      (stackedRideOffer?.surgeFixed || "2.00")
                                    : (stackedRideOffer?.surgeMultiplier ||
                                        "1.4") + "x"}
                                </span>
                              )}
                            </div>
                          </div>
                          {(() => {
                            let finalPayout =
                              (stackedRideOffer?.fareEstimate || 38.5) *
                              (1 - fareConfig.commissionRate) - (fareConfig.fixedTripFee || 0);
                            if (
                              fareConfig.surgeEnabled &&
                              !stackedRideOffer?.isSimulated
                            ) {
                              // Note: simulated already bundles it in fareEstimate
                              // Absorb surge cost for driver payout if the passenger fare didn't include it explicitly
                              // If baseCalc exists and it roughly matches fareEstimate, it means surge wasn't applied on the passenger side
                              // We dynamically inject it into the driver payout here.
                              const hasNoSurgeApplied =
                                stackedRideOffer?.baseCalc
                                  ? Math.abs(
                                      stackedRideOffer.fareEstimate -
                                        stackedRideOffer.baseCalc,
                                    ) < 2.0
                                  : true;
                              if (
                                hasNoSurgeApplied ||
                                stackedRideOffer?.surgeMultiplier === 1.0
                              ) {
                                if (fareConfig.surgeModel === "fixed") {
                                  finalPayout +=
                                    fareConfig.surgeFixedAmount || 2.0;
                                } else {
                                  // Multiplier style
                                  finalPayout +=
                                    (stackedRideOffer?.fareEstimate || 38.5) *
                                    ((fareConfig.surgeMultiplierValue || 1.4) -
                                      1.0);
                                }
                              }
                            }
                            return (
                              <p className="text-[#00D26A] text-[13px] font-bold mt-0.5">
                                You earn: £{finalPayout.toFixed(2)}
                              </p>
                            );
                          })()}
                        </div>

                        <div className="mt-1 mb-1">
                          <div className="relative pl-5 space-y-2 flex-1">
                            {/* Route Line indicator */}
                            <div className="absolute left-[7px] top-1.5 bottom-1.5 w-[2px] bg-[#2C2C30] rounded-full"></div>

                            <div className="relative">
                              <div className="absolute w-2.5 h-2.5 rounded-full bg-[#00D26A] border-[1.5px] border-[#1A1A1E] -left-[18.5px] top-[3px] z-10"></div>
                              <p className="text-[9px] font-black uppercase text-[#00D26A] tracking-wider leading-none mb-0.5">
                                Pickup
                              </p>
                              <p className="text-[16px] font-semibold text-white drop-shadow-sm leading-tight line-clamp-2">
                                {stackedRideOffer?.pickupAddress ||
                                  "12 Elm Street, SE15"}
                              </p>
                              <p className="text-[15px] font-bold text-yellow-400 mt-0.5">
                                {stackedRideOffer?.distanceToPickupMiles ||
                                  "1.2"}{" "}
                                mi from you
                              </p>
                            </div>

                            {(stackedRideOffer?.stops || []).map(
                              (stop: any, idx: number) => (
                                <div key={idx} className="relative mt-2">
                                  <div className="absolute w-2.5 h-2.5 rounded-full bg-[#FF9500] border-[1.5px] border-[#1A1A1E] -left-[18.5px] top-[3px] z-10"></div>
                                  <p className="text-[9px] font-black uppercase text-[#FF9500] tracking-wider leading-none mb-0.5">
                                    Stop {idx + 1}
                                  </p>
                                  <p className="text-[16px] font-semibold text-white drop-shadow-sm leading-tight line-clamp-2">
                                    {stop.address}
                                  </p>
                                </div>
                              ),
                            )}

                            <div className="relative mt-2">
                              <div className="absolute w-2.5 h-2.5 bg-[#FF3B30] border-[1.5px] border-[#1A1A1E] -left-[18.5px] top-[3px] z-10"></div>
                              <p className="text-[9px] font-black uppercase text-[#FF3B30] tracking-wider leading-none mb-0.5">
                                Drop-off
                              </p>
                              <p className="text-[16px] font-semibold text-white drop-shadow-sm leading-tight line-clamp-2">
                                {stackedRideOffer?.dropoffAddress ||
                                  "Bristol Temple Meads"}
                              </p>
                              <p className="text-[15px] font-bold text-yellow-400 mt-0.5">
                                {stackedRideOffer?.distanceMiles || "22"} mi
                                from pickup
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                    {/* Map Section (Moved to bottom) */}
                    {isLoaded &&
                      stackedRideOffer?.pickupLat &&
                      stackedRideOffer?.dropoffLat && (
                        <div className="w-full h-[140px] rounded-xl overflow-hidden relative border border-[#2C2C30] shrink-0 mb-2">
                          <div className="absolute inset-0 pointer-events-none z-10 rounded-xl ring-1 ring-inset ring-white/10" />
                          <GoogleMap
                            mapContainerStyle={{
                              width: "100%",
                              height: "100%",
                            }}
                            onLoad={(map) => {
                              setMiniMapInstance(map);
                              const bounds =
                                new window.google.maps.LatLngBounds();
                              if (
                                stackedRideOffer.pickupLat &&
                                stackedRideOffer.pickupLng
                              )
                                bounds.extend({
                                  lat: stackedRideOffer.pickupLat,
                                  lng: stackedRideOffer.pickupLng,
                                });
                              if (
                                stackedRideOffer.dropoffLat &&
                                stackedRideOffer.dropoffLng
                              )
                                bounds.extend({
                                  lat: stackedRideOffer.dropoffLat,
                                  lng: stackedRideOffer.dropoffLng,
                                });
                              (stackedRideOffer.stops || []).forEach(
                                (s: any) => {
                                  if (s.coords) bounds.extend(s.coords);
                                },
                              );
                              map.fitBounds(bounds, {
                                top: 10,
                                bottom: 10,
                                left: 10,
                                right: 10,
                              });
                              // Apply a max zoom in case points are very close
                              const listener =
                                window.google.maps.event.addListener(
                                  map,
                                  "idle",
                                  () => {
                                    if ((map.getZoom() || 0) > 15)
                                      map.setZoom(15); // Restrict to 15 as user mentioned
                                    window.google.maps.event.removeListener(
                                      listener,
                                    );
                                  },
                                );
                            }}
                            options={premiumMapOptions}
                          >
                            {stackedRideOffer.pickupLat && (
                              <MarkerF
                                position={{
                                  lat: stackedRideOffer.pickupLat,
                                  lng: stackedRideOffer.pickupLng,
                                }}
                                label="P"
                              />
                            )}
                            {stackedRideOffer.dropoffLat && (
                              <MarkerF
                                position={{
                                  lat: stackedRideOffer.dropoffLat,
                                  lng: stackedRideOffer.dropoffLng,
                                }}
                                label="D"
                              />
                            )}
                            {(stackedRideOffer.stops || []).map(
                              (s: any, i: number) =>
                                s.coords && (
                                  <React.Fragment key={i}>
                                    <MarkerF
                                      position={s.coords}
                                      label={`${i + 1}`}
                                    />
                                  </React.Fragment>
                                ),
                            )}
                          </GoogleMap>
                          {miniMapInstance && (
                            <MapZoomControls
                              mapInstance={miniMapInstance}
                              className="absolute bottom-2 right-2 z-20"
                            />
                          )}
                        </div>
                      )}

                    
                    </div>
                  </div>

                  {stackedRideOffer?.comments && (
                    <div className="mb-1.5 bg-[#FFD60A] border rounded-[8px] px-2 py-1.5 flex items-start gap-2 shadow-[0_4px_10px_rgba(255,214,10,0.2)] shrink-0">
                      <MessageSquare className="w-3 h-3 text-[#1A1A1E] shrink-0 mt-[3px]" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[#1A1A1E] text-[8px] font-black uppercase tracking-wider block mb-0 opacity-70 leading-none">
                          Passenger Note
                        </span>
                        <p className="text-[#1A1A1E] text-[10px] font-bold leading-tight mt-[1px]">
                          {stackedRideOffer.comments}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-0 shrink-0 relative z-20">
                    {declineConfirmStacked ? (
                      <button
                        onClick={() => { setDeclineConfirmStacked(false); handleDeclineStackedRide(); }}
                        className="w-[100px] h-10 bg-[#FF3B30] text-white rounded-[10px] font-black text-[12px] flex items-center justify-center active:scale-[0.98] shadow-sm transition-transform shrink-0"
                      >
                        CONFIRM
                      </button>
                    ) : (
                      <button
                        onClick={() => setDeclineConfirmStacked(true)}
                        className="w-10 h-10 bg-slate-900 border border-[#2C2C30] text-[#E4E4E7] rounded-[10px] flex items-center justify-center active:scale-[0.98] shadow-sm transition-transform shrink-0 hover:bg-slate-800"
                      >
                        <X className="w-5 h-5 stroke-[3]" />
                      </button>
                    )}
                    <button
                      onClick={() => { setDeclineConfirmStacked(false); handleAcceptStackedRide(); }}
                      className="flex-1 h-10 bg-[#00D26A] text-[#0D0D0F] rounded-[10px] font-black text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] shadow-[0_4px_20px_rgba(0,210,106,0.2)] transition-transform"
                    >
                      <Check className="w-5 h-5 stroke-[3]" /> ACCEPT
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
                  <h3 className="font-black text-white uppercase text-xs tracking-wider">
                    Job Details
                  </h3>
                  <button
                    onClick={() => setShowJobDetails(false)}
                    className="text-[#A1A1AA] hover:text-white active:scale-95 transition-transform"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-[#A1A1AA] font-bold w-[72px]">
                      Passenger
                    </span>
                    <span className="text-white font-black">
                      {activeRide?.name || "Passenger"}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#A1A1AA] font-bold w-[72px] mt-0.5">
                      Pickup
                    </span>
                    <span className="text-white drop-shadow-sm flex-1 leading-tight font-semibold text-[16px]">
                      {activeRide?.pickupAddress || "Pickup Location"}
                    </span>
                  </div>
                  {(activeRide?.stops || []).map((stop: any, idx: number) => (
                    <div
                      key={`stop-modal-${idx}`}
                      className="flex items-start gap-2"
                    >
                      <span className="text-[#A1A1AA] font-bold w-[72px] mt-0.5">
                        Stop {idx + 1}
                      </span>
                      <span className="text-white drop-shadow-sm flex-1 leading-tight font-semibold text-[16px]">
                        {stop.address}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-start gap-2">
                    <span className="text-[#A1A1AA] font-bold w-[72px] mt-0.5">
                      Drop-off
                    </span>
                    <span className="text-white drop-shadow-sm flex-1 leading-tight font-semibold text-[16px]">
                      {activeRide?.dropoffAddress || "Drop-off Location"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-[#333338]">
                    <span className="text-[#A1A1AA] font-bold w-[72px]">
                      Total Fare
                    </span>
                    <span className="text-[#00D26A] font-black text-2xl">
                      £{activeRide?.fareEstimate?.toFixed(2) || "0.00"}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Screen 4 & 5 & 6: Active Ride States (z-40) */}
          <AnimatePresence>
            {(rideState === "en_route_pickup" ||
              rideState === "waiting" ||
              rideState === "in_progress") && (
              <motion.div
                layout
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className={cn(
                  "absolute bottom-0 left-0 right-0 z-40 bg-[#1A1A1E] rounded-t-3xl border-t border-[#2C2C30] px-2 sm:px-4 md:max-w-[440px] md:left-1/2 md:-translate-x-1/2 pt-0 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] pointer-events-auto flex flex-col",
                  isCardCollapsed ? "pb-[calc(1.750rem+env(safe-area-inset-bottom,0px))]" : "pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]",
                )}
                onTouchStartCapture={() => {
                  if (
                    ["en_route_pickup", "waiting", "in_progress"].includes(
                      rideState,
                    ) &&
                    !isCardCollapsed
                  ) {
                    resetCardCollapseTimer();
                  }
                }}
                onMouseDownCapture={() => {
                  if (
                    ["en_route_pickup", "waiting", "in_progress"].includes(
                      rideState,
                    ) &&
                    !isCardCollapsed
                  ) {
                    resetCardCollapseTimer();
                  }
                }}
              >
                <div
                  className="w-auto h-[36px] -mx-2 sm:-mx-4 flex items-center justify-center mb-1 cursor-pointer touch-none transition-colors border-b border-black/20 drop-shadow-sm bg-[#2C2C30] rounded-t-[23px] hover:bg-[#34343A]"
                  onClick={() => {
                    const nextState = !isCardCollapsed;
                    setIsCardCollapsed(nextState);
                    if (
                      !nextState &&
                      ["en_route_pickup", "waiting", "in_progress"].includes(
                        rideState,
                      )
                    ) {
                      resetCardCollapseTimer();
                    } else if (nextState) {
                      if (cardCollapseTimeoutRef.current)
                        clearTimeout(cardCollapseTimeoutRef.current);
                    }
                  }}
                >
                  {isCardCollapsed ? (
                    <ChevronUp className="w-7 h-7 text-[#F8F9FA]" />
                  ) : (
                    <ChevronDown className="w-7 h-7 text-[#F8F9FA]" />
                  )}
                </div>

                {rideState === "en_route_pickup" && (
                  <>
                    <div className="flex justify-between items-start mb-2 relative">
                      <div className="flex-1 mr-2 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-0.5">
                          <span className={cn(
                            "bg-[#00D26A] text-[#1A1A1E] px-1.5 py-0.5 rounded-[4px] font-black uppercase tracking-wider shadow-[0_0_8px_rgba(0,210,106,0.3)] whitespace-nowrap shrink-0",
                            isCardCollapsed ? "text-[11px]" : "text-[9px]"
                          )}>
                            Pick Up
                          </span>
                          <p className={cn(
                            "font-black uppercase text-[#E4E4E7] tracking-widest truncate",
                            isCardCollapsed ? "text-[11px]" : "text-[9px]"
                          )}>
                            Picking up {activeRide?.name || "Sarah T."}
                          </p>
                        </div>
                        <p className={cn(
                          "font-semibold text-white drop-shadow-sm mb-0 line-clamp-2",
                          isCardCollapsed ? "text-[19px]" : "text-[17px]"
                        )}>
                          {activeRide?.pickupAddress || "12 Elm Street, SE15"}
                        </p>
                        <p className={cn(
                          "font-black text-white leading-none mt-0.5",
                          isCardCollapsed ? "text-[18px]" : "text-[16px]"
                        )}>
                          3 min{" "}
                          <span className={cn(
                            "text-white font-bold",
                            isCardCollapsed ? "text-[16px]" : "text-[14px]"
                          )}>
                            ·{" "}
                            {activeRide?.distanceToPickupMiles?.toFixed(1) ||
                              "1.2"}{" "}
                            mi
                          </span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "text-[#00D26A] font-black",
                          isCardCollapsed ? "text-2xl" : "text-xl"
                        )}>
                          £{activeRide?.fareEstimate?.toFixed(2) || "38.50"}
                        </p>
                      </div>
                    </div>

                    <AnimatePresence initial={false}>
                      {!isCardCollapsed && (
                        <motion.div
                          initial={{ height: 0, opacity: 0, marginTop: 0 }}
                          animate={{
                            height: "auto",
                            opacity: 1,
                            marginTop: 12,
                          }}
                          exit={{ height: 0, opacity: 0, marginTop: 0 }}
                          className="overflow-hidden flex flex-col gap-3"
                        >
                          {activeRide?.comments && (
                            <div className="bg-[#FFD60A] border rounded-[8px] p-2 flex items-start gap-2 shadow-[0_4px_10px_rgba(255,214,10,0.2)] max-w-full min-w-0">
                              <MessageSquare className="w-3.5 h-3.5 text-[#1A1A1E] shrink-0 mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <span className="text-[#1A1A1E] text-[9px] font-black uppercase tracking-wider block mb-0.5 opacity-70">
                                  Passenger Note
                                </span>
                                <p className="text-[#1A1A1E] text-[10px] font-bold leading-tight mt-[1px]">
                                  {activeRide.comments}
                                </p>
                              </div>
                            </div>
                          )}

                          <div className="flex justify-center gap-2 mb-3 pb-3">
                            <button
                              onClick={() => setShowJobDetails(true)}
                              className="w-[15%] h-10 bg-[#2C2C30] rounded-[10px] flex items-center justify-center shrink-0 active:scale-95 transition-transform"
                            >
                              <Info className="w-5 h-5 text-white" />
                            </button>
                            <button
                              onClick={() => setIsChatOpen(true)}
                              className="relative w-[15%] h-10 bg-[#252529] rounded-[10px] flex items-center justify-center shrink-0 active:scale-95 transition-transform border border-[#333338] shadow-[0_0_10px_rgba(0,210,106,0.1)]"
                            >
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
                            <div className="flex-1 min-w-0">
                              <SwipeButton
                                onComplete={onArrivedClick}
                                text="MARK AS ARRIVED"
                                bgClass="bg-[#FF9500]"
                                icon={<MapPin className="w-5 h-5 text-white" />}
                                resetToken={showEarlyArrivalConfirm}
                              />
                            </div>
                          </div>

                          <div className="flex overflow-x-auto no-scrollbar gap-2 mb-1 w-full pb-1">
                            {[
                              "I'll be right there",
                              "Traffic is heavy",
                              "I'm outside",
                              "I'm at location but can not find you."
                            ].map((msg, i) => (
                              <button
                                key={i}
                                onClick={() => handleSendQuickMessage(msg)}
                                disabled={quickMessageCooldown > 0}
                                className={cn(
                                  "whitespace-nowrap px-3 py-1.5 border text-[11px] font-bold rounded-[8px] shadow-sm transition-transform",
                                  quickMessageCooldown > 0
                                    ? "bg-[#1A1A1E] border-[#2C2C30] text-[#E4E4E7]/50 cursor-not-allowed"
                                    : "bg-[#252529] border-[#333338] text-white active:scale-95",
                                )}
                              >
                                {quickMessageCooldown > 0
                                  ? `${msg} (${Math.floor(quickMessageCooldown / 60)}:${(quickMessageCooldown % 60).toString().padStart(2, "0")})`
                                  : msg}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}

                {rideState === "waiting" && (
                  <>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex-1">
                        <p className={cn(
                          "font-black uppercase text-[#FF9500] tracking-widest mb-0.5 flex items-center gap-1",
                          isCardCollapsed ? "text-[11px]" : "text-[9px]"
                        )}>
                          <AlertCircle className="w-2.5 h-2.5" /> Waiting for
                          Rider
                        </p>
                        <p className={cn(
                          "font-black text-white px-0.5",
                          isCardCollapsed ? "text-[19px]" : "text-[17px]"
                        )}>
                          {Math.floor(elapsedWaitSeconds / 60)}:
                          {(elapsedWaitSeconds % 60)
                            .toString()
                            .padStart(2, "0")}
                        </p>
                        <p className={cn(
                          "font-bold mt-0",
                          isCardCollapsed ? "text-[13px]" : "text-[11px]"
                        )}>
                          {elapsedWaitSeconds < 180 ? (
                            <span className="text-[#00D26A]">
                              Free wait:{" "}
                              {Math.floor((180 - elapsedWaitSeconds) / 60)}:
                              {((180 - elapsedWaitSeconds) % 60)
                                .toString()
                                .padStart(2, "0")}
                            </span>
                          ) : elapsedWaitSeconds < 300 ? (
                            <span className="text-[#FF9500]">
                              Paid wait:{" "}
                              {Math.floor((elapsedWaitSeconds - 180) / 60)}:
                              {((elapsedWaitSeconds - 180) % 60)
                                .toString()
                                .padStart(2, "0")}
                            </span>
                          ) : (
                            <span className="text-[#FF3B30]">
                              Eligible for Cancel Fee
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="flex-[1.5] flex justify-center px-1">
                        <div className="bg-[#FF9500]/10 border border-[#FF9500]/30 px-3 py-1.5 rounded flex items-center gap-1.5 overflow-hidden w-full justify-center">
                          <User className="w-3.5 h-3.5 text-[#FF9500] shrink-0" />
                          <span className={cn(
                            "text-white font-black uppercase tracking-wider truncate",
                            isCardCollapsed ? "text-sm" : "text-xs"
                          )}>
                            {activeRide?.name || "Sarah T."}
                          </span>
                        </div>
                      </div>

                      <div className="flex-1 text-right">
                        <p className={cn(
                          "text-[#00D26A] font-black",
                          isCardCollapsed ? "text-2xl" : "text-xl"
                        )}>
                          £{activeRide?.fareEstimate?.toFixed(2) || "38.50"}
                        </p>
                      </div>
                    </div>

                    <AnimatePresence initial={false}>
                      {!isCardCollapsed && (
                        <motion.div
                          initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                          animate={{
                            height: "auto",
                            opacity: 1,
                            marginBottom: 12,
                          }}
                          exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                          className="overflow-hidden flex flex-col gap-3"
                        >
                          {activeRide?.comments && (
                            <div className="bg-[#FFD60A] border rounded-[8px] p-2 flex items-start gap-2 shadow-[0_4px_10px_rgba(255,214,10,0.2)] max-w-full min-w-0">
                              <MessageSquare className="w-3.5 h-3.5 text-[#1A1A1E] shrink-0 mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <span className="text-[#1A1A1E] text-[9px] font-black uppercase tracking-wider block mb-0.5 opacity-70">
                                  Passenger Note
                                </span>
                                <p className="text-[#1A1A1E] text-[10px] font-bold leading-tight mt-[1px]">
                                  {activeRide.comments}
                                </p>
                              </div>
                            </div>
                          )}

                          {(activeRide?.requirePasscode ||
                            activeRide?.driverRequirePasscode) &&
                            activeRide?.handshakeCode && (
                              <div className="bg-[#00D26A]/10 border border-[#00D26A]/30 rounded-[10px] p-2 flex items-center justify-between">
                                <div>
                                  <p className="text-[#00D26A] text-[9px] font-black tracking-widest uppercase mb-0.5">
                                    PIN Check Required
                                  </p>
                                  <p className="text-[#E4E4E7] text-[11px] font-medium">
                                    Verify this PIN with passenger
                                  </p>
                                </div>
                                <div className="bg-[#00D26A]/20 text-[#00D26A] font-mono font-black text-lg px-2.5 py-1 rounded-lg tracking-widest">
                                  {activeRide.handshakeCode}
                                </div>
                              </div>
                            )}

                          <div className="flex justify-center gap-2 mt-1 mb-3 pb-3">
                            <button
                              onClick={() => setShowJobDetails(true)}
                              className="w-[15%] h-10 bg-[#2C2C30] rounded-[10px] flex items-center justify-center shrink-0 active:scale-95 transition-transform"
                            >
                              <Info className="w-5 h-5 text-white" />
                            </button>
                            <button
                              onClick={() => setIsChatOpen(true)}
                              className="relative w-[15%] h-10 bg-[#252529] rounded-[10px] flex items-center justify-center shrink-0 active:scale-95 transition-transform border border-[#333338] shadow-[0_0_10px_rgba(0,210,106,0.1)]"
                            >
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
                            <div className="flex-1 min-w-0">
                              <SwipeButton
                                onComplete={handleStartRide}
                                text={
                                  <span className="text-[#0D0D0F]">
                                    START TRIP
                                  </span>
                                }
                                bgClass="bg-[#00D26A]"
                                icon={
                                  <Zap className="w-5 h-5 fill-[#0D0D0F] text-[#0D0D0F]" />
                                }
                              />
                            </div>
                          </div>

                          <div className="flex overflow-x-auto no-scrollbar gap-2 mt-auto mb-1 w-full pb-1">
                            {[
                              "I'm waiting outside",
                              "Are you coming?",
                              "Please hurry up",
                              "Couldn't stop at location, please look around for me",
                            ].map((msg, i) => (
                              <button
                                key={i}
                                onClick={() => handleSendQuickMessage(msg)}
                                disabled={quickMessageCooldown > 0}
                                className={cn(
                                  "whitespace-nowrap px-3 py-1.5 border text-[11px] font-bold rounded-[8px] shadow-sm transition-transform",
                                  quickMessageCooldown > 0
                                    ? "bg-[#1A1A1E] border-[#2C2C30] text-[#E4E4E7]/50 cursor-not-allowed"
                                    : "bg-[#252529] border-[#333338] text-white active:scale-95",
                                )}
                              >
                                {quickMessageCooldown > 0
                                  ? `${msg} (${Math.floor(quickMessageCooldown / 60)}:${(quickMessageCooldown % 60).toString().padStart(2, "0")})`
                                  : msg}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}

                {rideState === "in_progress" && (
                  <>
                    <div className="flex justify-between items-start mb-2 relative">
                      <div className="flex-1 mr-2 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-0.5">
                          {currentLegIndex <
                          (activeRide?.stops?.length || 0) ? (
                            <span className={cn(
                              "bg-[#FF9500] text-white px-1.5 py-0.5 rounded-[4px] font-black uppercase tracking-wider shadow-[0_0_8px_rgba(255,149,0,0.3)] whitespace-nowrap shrink-0",
                              isCardCollapsed ? "text-[11px]" : "text-[9px]"
                            )}>
                              Stop {currentLegIndex + 1}
                            </span>
                          ) : activeRide?.stops?.length > 0 ? (
                            <span className={cn(
                              "bg-[#FF9500] text-white px-1.5 py-0.5 rounded-[4px] font-black uppercase tracking-wider shadow-[0_0_8px_rgba(255,149,0,0.3)] whitespace-nowrap shrink-0",
                              isCardCollapsed ? "text-[11px]" : "text-[9px]"
                            )}>
                              Drop Off
                            </span>
                          ) : (
                            <span className={cn(
                              "bg-[#FF3B30] text-white px-1.5 py-0.5 rounded-[4px] font-black uppercase tracking-wider shadow-[0_0_8px_rgba(255,59,48,0.3)] whitespace-nowrap shrink-0",
                              isCardCollapsed ? "text-[11px]" : "text-[9px]"
                            )}>
                              Drop Off
                            </span>
                          )}
                          <p
                            className={cn(
                              "font-black uppercase tracking-widest flex items-center gap-1 truncate",
                              isCardCollapsed ? "text-[11px]" : "text-[9px]",
                              isWaitingAtStop ? "text-[#FF9500]" : "text-[#00D26A]"
                            )}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 animate-pulse ${isWaitingAtStop ? "bg-[#FF9500]" : "bg-[#00D26A]"}`}
                            ></span>{" "}
                            <span className="truncate">
                              {isWaitingAtStop
                                ? "WAITING AT STOP"
                                : "Trip in Progress"}
                            </span>
                          </p>
                        </div>
                        <p className={cn(
                          "font-semibold text-white drop-shadow-sm mb-0 line-clamp-2",
                          isCardCollapsed ? "text-[19px]" : "text-[17px]"
                        )}>
                          {currentLegIndex < (activeRide?.stops?.length || 0)
                            ? activeRide.stops[currentLegIndex].address
                            : activeRide?.dropoffAddress ||
                              "Bristol Temple Meads"}
                        </p>
                        {isWaitingAtStop ? (
                          <p className={cn(
                            "font-black text-[#FF9500] leading-none mt-0.5",
                            isCardCollapsed ? "text-[18px]" : "text-[16px]"
                          )}>
                            Paid wait: {Math.floor(totalPaidWaitSeconds / 60)}:
                            {(totalPaidWaitSeconds % 60)
                              .toString()
                              .padStart(2, "0")}
                          </p>
                        ) : (
                          <p className={cn(
                            "font-black text-white leading-none mt-0.5",
                            isCardCollapsed ? "text-[18px]" : "text-[16px]"
                          )}>
                            {activeRide?.durationMinutes || 38} min left{" "}
                            <span className={cn(
                              "text-white font-bold",
                              isCardCollapsed ? "text-[16px]" : "text-[14px]"
                            )}>
                              {" "}
                              •{" "}
                              {activeRide?.distanceMiles?.toFixed(1) ||
                                "14.2"}{" "}
                              mi
                            </span>
                          </p>
                        )}
                      </div>
                      <div className="text-right flex flex-col items-end shrink-0">
                        <p className={cn(
                          "text-[#00D26A] font-black leading-none mb-1.5 mt-0.5",
                          isCardCollapsed ? "text-2xl" : "text-xl"
                        )}>
                          £
                          {(
                            (activeRide?.fareEstimate || 38.5) +
                            (totalPaidWaitSeconds / 60) *
                              fareConfig.waitRatePerMinute
                          ).toFixed(2)}
                        </p>
                        {activeRide?.hasCardOnFile ? (
                          <div className="inline-block bg-white border-2 border-[#00D26A] px-2 py-1 rounded-md shadow-sm mt-0.5">
                            <span className={cn(
                              "text-[#059669] font-black uppercase tracking-wider block leading-none",
                              isCardCollapsed ? "text-[11px]" : "text-[9px]"
                            )}>
                              Auto Payment
                            </span>
                          </div>
                        ) : (
                          <div className="inline-block bg-white border-2 border-[#EA580C] px-2 py-1 rounded-md shadow-sm mt-0.5">
                            <span className={cn(
                              "text-[#EA580C] font-black uppercase tracking-wider block leading-none",
                              isCardCollapsed ? "text-[12px]" : "text-[10px]"
                            )}>
                              QR Code
                            </span>
                          </div>
                        )}
                        {totalPaidWaitSeconds > 0 && (
                          <p className={cn(
                            "text-[#FF9500] font-bold mt-1",
                            isCardCollapsed ? "text-[12px]" : "text-[10px]"
                          )}>
                            +Wait
                          </p>
                        )}
                      </div>
                    </div>

                    <AnimatePresence initial={false}>
                      {!isCardCollapsed && (
                        <motion.div
                          initial={{ height: 0, opacity: 0, marginTop: 0 }}
                          animate={{
                            height: "auto",
                            opacity: 1,
                            marginTop: 12,
                          }}
                          exit={{ height: 0, opacity: 0, marginTop: 0 }}
                          className="overflow-hidden flex flex-col gap-3"
                        >
                          {activeRide?.stops?.length > 0 && currentLegIndex < (activeRide?.stops?.length || 0) && (
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={handleToggleWaitAtStop}
                                className={`w-full py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-colors border ${isWaitingAtStop ? "bg-[#FF9500] text-white border-[#FF9500]/50" : "bg-transparent text-[#FF9500] border-[#FF9500]/30"}`}
                              >
                                {isWaitingAtStop
                                  ? "Resume Trip"
                                  : "Wait at Stop"}
                              </button>

                              <AnimatePresence>
                                {fareConfig.allowRiderAbandonment &&
                                  isWaitingAtStop &&
                                  currentStopWaitSeconds >= 300 &&
                                  !abandonmentWarningSent && (
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

                                {fareConfig.allowRiderAbandonment &&
                                  isWaitingAtStop &&
                                  currentStopWaitSeconds >= 420 &&
                                  abandonmentWarningSent && (
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

                          <div className="flex justify-center gap-2 mb-3 pb-3">
                            <button
                              onClick={() => setShowJobDetails(true)}
                              className="w-[15%] h-10 bg-[#2C2C30] rounded-[10px] flex items-center justify-center shrink-0 active:scale-95 transition-transform"
                            >
                              <Info className="w-5 h-5 text-white" />
                            </button>
                            <button
                              onClick={() => setIsChatOpen(true)}
                              className="relative w-[15%] h-10 bg-[#252529] rounded-[10px] flex items-center justify-center shrink-0 active:scale-95 transition-transform border border-[#333338] shadow-[0_0_10px_rgba(0,210,106,0.1)]"
                            >
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
                            {currentLegIndex <
                            (activeRide?.stops?.length || 0) ? (
                              <div className="flex-1 min-w-0">
                                <SwipeButton
                                  onComplete={handleGoToNextLeg}
                                  text="GO NEXT"
                                  bgClass="bg-[#FF9500]"
                                />
                              </div>
                            ) : (
                              <div className="flex-1 min-w-0">
                                <SwipeButton
                                  onComplete={handleCompleteRideBtnClick}
                                  text="COMPLETE"
                                  bgClass="bg-[#FF3B30]"
                                  icon={
                                    <Check className="w-5 h-5 stroke-[3] text-white" />
                                  }
                                  resetToken={showCompleteConfirm}
                                />
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}

                {/* Cancel fallback */}
                {(rideState === "en_route_pickup" ||
                  rideState === "waiting") && (
                  <>
                    <AnimatePresence initial={false}>
                      {!isCardCollapsed && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <button
                            onClick={() => setShowCancelConfirm(true)}
                            className="w-full mt-2 py-2 text-xs font-bold text-[#E4E4E7] uppercase tracking-wide hover:text-[#FF3B30] transition-colors"
                          >
                            {rideState === "waiting"
                              ? 300 - elapsedWaitSeconds > 0
                                ? `Cancel (No Fee in ${Math.floor((300 - elapsedWaitSeconds) / 60)}:${((300 - elapsedWaitSeconds) % 60).toString().padStart(2, "0")})`
                                : "Cancel (Charge Fee)"
                              : "Cancel Ride"}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

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
                          <h3 className="text-white text-lg font-black tracking-wide mb-1 uppercase">
                            Cancel Ride?
                          </h3>
                          <p className="text-[#E4E4E7] text-xs mb-4 px-2 leading-relaxed font-medium">
                            Are you sure you want to cancel this trip? Frequent
                            cancellations may affect your rating and account
                            standing.
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
                          <h3 className="text-white text-lg font-black tracking-wide mb-1 uppercase">
                            Too far from pickup?
                          </h3>
                          <p className="text-[#E4E4E7] text-xs mb-4 px-2 leading-relaxed font-medium">
                            You appear to be quite far away from the pickup
                            location. Are you sure you've arrived? Marking as
                            arrived early can confuse the rider.
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
            {rideState === "review" && (
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
                    <h2 className="text-xl font-black text-white uppercase tracking-tight mb-6">
                      Trip Complete
                    </h2>

                    <div className="mb-8">
                      <motion.h1
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", damping: 15 }}
                        className="text-[56px] leading-[1] font-black text-white tracking-tighter"
                      >
                        £
                        {(
                          activeRide?.finalFare ||
                          (activeRide?.fareEstimate || 38.5) +
                            (totalPaidWaitSeconds / 60) *
                              fareConfig.waitRatePerMinute +
                            (activeRide?.tipAmount || 0)
                        ).toFixed(2)}
                      </motion.h1>
                      {activeRide?.tipAmount ? (
                        <p className="text-emerald-400 font-bold text-[15px] mt-2 mb-4 bg-emerald-500/10 inline-block px-4 py-1.5 rounded-full border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                          Includes £{activeRide.tipAmount.toFixed(2)} Tip
                        </p>
                      ) : null}
                      <div className="mt-4 bg-[#00D26A]/10 border border-[#00D26A]/20 py-2.5 px-4 rounded-xl inline-block w-full">
                        <p className="text-[10px] font-black uppercase text-[#00D26A] tracking-wider mb-0.5">
                          You Earned
                        </p>
                        <p className="text-3xl font-black text-[#00D26A]">
                          £
                          {(
                            (activeRide?.finalFare
                              ? activeRide.finalFare -
                                (activeRide.tipAmount || 0)
                              : (activeRide?.fareEstimate || 38.5) +
                                (totalPaidWaitSeconds / 60) *
                                  fareConfig.waitRatePerMinute) *
                              (1 - fareConfig.commissionRate) - (fareConfig.fixedTripFee || 0) +
                            (activeRide?.tipAmount || 0)
                          ).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="bg-[#252529] rounded-2xl p-4 text-left mb-6">
                      <p className="text-[10px] font-black uppercase text-[#E4E4E7] tracking-widest mb-3 border-b border-[#333338] pb-2">
                        Fare Breakdown
                      </p>
                      <div className="space-y-1.5 mb-3">
                        <div className="flex justify-between text-xs text-[#E4E4E7]">
                          <span>Base fare:</span>
                          <span className="text-white">
                            £{fareConfig.baseFare.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-[#E4E4E7]">
                          <span>
                            Distance (
                            {activeRide?.distanceMiles?.toFixed(1) || "22"}mi):
                          </span>
                          <span className="text-white">
                            £
                            {(
                              (activeRide?.distanceMiles || 22) *
                              fareConfig.distanceRate
                            ).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-[#E4E4E7]">
                          <span>
                            Time (~{activeRide?.durationMinutes || 45}min):
                          </span>
                          <span className="text-white">£---</span>
                        </div>
                        {totalPaidWaitSeconds > 0 && (
                          <div className="flex justify-between text-xs text-[#FF9500]">
                            <span>
                              Paid Wait ({Math.floor(totalPaidWaitSeconds / 60)}
                              m):
                            </span>
                            <span className="font-bold">
                              +£
                              {(
                                (totalPaidWaitSeconds / 60) *
                                fareConfig.waitRatePerMinute
                              ).toFixed(2)}
                            </span>
                          </div>
                        )}
                        {activeRide?.isPriority && (
                          <div className="flex justify-between text-xs text-[#00E5FF]">
                            <span>Priority Booking:</span>
                            <span className="font-bold">
                              +£{fareConfig.priorityFee.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {activeRide?.status === "rider_abandoned" && (
                          <div className="flex justify-between text-xs text-[#FF3B30]">
                            <span>Abandonment Fee:</span>
                            <span className="font-bold">+£5.00</span>
                          </div>
                        )}
                        {fareConfig.surgeEnabled && (
                          <div className="flex justify-between text-xs text-[#FF9500]">
                            <span>
                              Surge (
                              {activeRide?.surgeModel === "fixed"
                                ? "Fixed"
                                : (activeRide?.surgeMultiplier || "1.4") + "x"}
                              ):
                            </span>
                            <span className="font-bold">
                              +£
                              {activeRide?.surgeModel === "fixed"
                                ? (activeRide?.surgeFixed || 2.0).toFixed(2)
                                : (
                                    (activeRide?.fareEstimate || 38.5) -
                                    (activeRide?.baseCalc || 30) -
                                    (activeRide?.isPriority
                                      ? fareConfig.priorityFee
                                      : 0)
                                  ).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>

                      {(() => {
                        const baseJobFare = activeRide?.finalFare
                          ? activeRide.finalFare - (activeRide.tipAmount || 0)
                          : (activeRide?.fareEstimate || 38.5) +
                            (totalPaidWaitSeconds / 60) *
                              fareConfig.waitRatePerMinute;
                        const commission = baseJobFare * fareConfig.commissionRate + (fareConfig.fixedTripFee || 0);
                        const normalEarnings = baseJobFare - commission;
                        const totalEarnings =
                          normalEarnings + (activeRide?.tipAmount || 0);

                        return (
                          <>
                            <div className="border-t border-[#333338] pt-2 mb-2 flex justify-between text-sm font-bold text-white">
                              <span>Base job fare:</span>
                              <span>£{baseJobFare.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold text-[#FF3B30] p-1.5 bg-[#FF3B30]/10 rounded border border-[#FF3B30]/20 mb-3">
                              <span>
                                Commission (
                                {(fareConfig.commissionRate * 100).toFixed(0)}
                                %{fareConfig.fixedTripFee ? ` + £${fareConfig.fixedTripFee.toFixed(2)}` : ''}):
                              </span>
                              <span>-£{commission.toFixed(2)}</span>
                            </div>
                            <div className="border-t border-[#333338] pt-2 pb-2 flex justify-between text-[15px] font-black text-white">
                              <span>Normal Earnings:</span>
                              <span>£{normalEarnings.toFixed(2)}</span>
                            </div>
                            {activeRide?.tipAmount ? (
                              <div className="flex justify-between text-[15px] font-black text-emerald-400 pb-2">
                                <span>Passenger Tip:</span>
                                <span>+£{activeRide.tipAmount.toFixed(2)}</span>
                              </div>
                            ) : null}
                            <div className="border-t-2 border-[#00D26A]/50 pt-2 flex justify-between text-lg font-black text-[#00D26A]">
                              <span>YOUR EARNINGS:</span>
                              <span>£{totalEarnings.toFixed(2)}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Passenger Rating Block */}
                    <div className="bg-[#1A1A1E] rounded-2xl p-5 mb-6 border border-[#2C2C30] text-center shadow-lg relative overflow-hidden">
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#FF9500] to-[#FFCC00]"></div>
                      <h3 className="text-[13px] font-black uppercase text-white tracking-widest mb-4">
                        Rate Passenger
                      </h3>

                      <div className="flex justify-center gap-2 mb-4 pb-3">
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
                                  : "text-[#333338] fill-transparent",
                              )}
                            />
                          </button>
                        ))}
                      </div>

                      <AnimatePresence>
                        {passengerRating < 5 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0, marginTop: 0 }}
                            animate={{
                              opacity: 1,
                              height: "auto",
                              marginTop: 16,
                            }}
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
                        setIsAutoNavHeadUp(true);
                        setIsAutoNavPaused(false);
                        if (acceptedStackedRideOffer) {
                          setActiveRide(acceptedStackedRideOffer);
                          setRideState("en_route_pickup");
                          setAcceptedStackedRideOffer(null);
                          setPassengerRating(5);
                          setRatingComment("");
                          return;
                        }

                        setRideState("idle");
                        const nextOnline = profile?.isLastJob ? false : true;
                        setIsOnline(nextOnline);
                        setIsSyncingMap(true);
                        setTimeout(() => {
                          setIsSyncingMap(false);
                        }, 1500);

                        if (activeRide && !activeRide.isReal && user) {
                          try {
                            const ridePayload = {
                              ...activeRide,
                              status:
                                activeRide.status === "rider_abandoned"
                                  ? "rider_abandoned"
                                  : "completed",
                              paymentMethod:
                                activeRide.paymentMethod || "stripe_auto",
                              finalFare:
                                activeRide.finalFare ||
                                (activeRide.fareEstimate || 38.5) +
                                  (activeRide.tipAmount || 0),
                              driverId: user.uid,
                              assignedDriverId: user.uid,
                              createdAt: serverTimestamp(),
                              completedAt: serverTimestamp(),
                            };
                            const cleanPayload = Object.fromEntries(
                              Object.entries(ridePayload).filter(
                                ([_, v]) => v !== undefined,
                              ),
                            );
                            await addDoc(
                              collection(db, "ride_requests"),
                              cleanPayload,
                            );
                          } catch (e) {
                            console.error("Failed to save simulated ride", e);
                          }
                        }

                        if (profile?.isLastJob && user) {
                          toast.success("Shift Ended", {
                            description: "You are now offline.",
                          });
                          await updateDoc(doc(db, "users", user.uid), {
                            isLastJob: false,
                          });
                        }

                        setPassengerRating(5);
                        setRatingComment("");
                        setActiveRide(null);
                      }}
                      disabled={
                        passengerRating < 5 && ratingComment.trim() === ""
                      }
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
          <div
            className={cn(
              "relative z-20 w-full px-4 pb-24 flex flex-col gap-3 transition-opacity",
              rideState !== "idle"
                ? "opacity-0 pointer-events-none"
                : "opacity-100",
            )}
          >
            {/* Primary Action Button moved to Menu - only map controls or status might remain here if needed */}
          </div>

          {/* Start Job Reminder Modal */}
          <AnimatePresence>
            {showStartJobReminder && (
              <div className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm overflow-y-auto pointer-events-auto flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-[#1A1A1E] w-full max-w-sm rounded-[32px] p-6 shadow-2xl border border-[#333338] text-center relative pointer-events-auto"
                >
                  <button
                    onClick={() => setHasDismissedStartJobReminder(true)}
                    className="absolute top-4 right-4 p-2 bg-[#2A2A2E] text-white rounded-full hover:bg-slate-700 active:scale-95 transition-all focus:outline-none"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <div className="w-16 h-16 bg-[#F59E0B]/20 rounded-full flex items-center justify-center mx-auto mb-4 mt-2">
                    <AlertCircle className="w-8 h-8 text-[#F59E0B]" />
                  </div>
                  <h3 className="text-xl font-black text-white px-2 mt-2 leading-tight">
                    Start Job Reminder
                  </h3>
                  <p className="text-slate-400 font-medium text-sm mt-3 leading-relaxed mb-6">
                    Are you sure you have picked up your passenger? You are
                    moving away from the pickup point. Please click the{" "}
                    <strong>"Passenger on board"</strong> button to start the
                    job.
                  </p>
                  <button
                    onClick={() => {
                      setShowStartJobReminder(false);
                      handleStartRide();
                    }}
                    className="w-full h-12 bg-[#00D26A] text-[#0D0D0F] rounded-xl font-bold active:scale-[0.98] transition-all"
                  >
                    Start Job Now
                  </button>
                  <button
                    onClick={() => setHasDismissedStartJobReminder(true)}
                    className="w-full mt-3 h-12 bg-[#2A2A2E] text-white flex items-center justify-center rounded-xl font-bold active:scale-[0.98] transition-all"
                  >
                    Not yet
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Leave Stop Reminder Modal */}
          <AnimatePresence>
            {showLeaveStopReminder && (
              <div className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm overflow-y-auto pointer-events-auto flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-[#1A1A1E] w-full max-w-sm rounded-[32px] p-6 shadow-2xl border border-[#333338] text-center relative pointer-events-auto"
                >
                  <button
                    onClick={() => setShowLeaveStopReminder(false)}
                    className="absolute top-4 right-4 p-2 bg-[#2A2A2E] text-white rounded-full hover:bg-slate-700 active:scale-95 transition-all focus:outline-none"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <div className="w-16 h-16 bg-[#F59E0B]/20 rounded-full flex items-center justify-center mx-auto mb-4 mt-2">
                    <AlertCircle className="w-8 h-8 text-[#F59E0B]" />
                  </div>
                  <h3 className="text-xl font-black text-white px-2 mt-2 leading-tight">
                    Proceed to Next Leg?
                  </h3>
                  <p className="text-slate-400 font-medium text-sm mt-3 leading-relaxed mb-6">
                    You appear to be moving away from the stop location. Please
                    click <strong>"Go to Next"</strong> if you are ready to
                    navigate to the next destination.
                  </p>
                  <button
                    onClick={() => handleGoToNextLeg()}
                    className="w-full h-12 bg-[#FF9500] text-white rounded-xl font-bold active:scale-[0.98] transition-all"
                  >
                    Go to Next
                  </button>
                  <button
                    onClick={() => setShowLeaveStopReminder(false)}
                    className="w-full mt-3 h-12 bg-[#2A2A2E] text-white flex items-center justify-center rounded-xl font-bold active:scale-[0.98] transition-all"
                  >
                    Dismiss
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Complete Ride Confirmation Modal */}
          <AnimatePresence>
            {showCompleteConfirm && (
              <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm overflow-y-auto pointer-events-auto scroll-smooth">
                <div className="min-h-full flex items-center justify-center p-4 py-8 pb-[140px]">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-[#1A1A1E] w-full max-w-sm rounded-[32px] p-6 shadow-2xl border border-[#333338] text-center"
                  >
                    <div className="w-16 h-16 bg-[#00D26A]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="w-8 h-8 text-[#00D26A]" />
                    </div>
                    <h3 className="text-2xl font-black text-white mb-2">
                      End Trip?
                    </h3>
                    {isEarlyCompletion ? (
                      <>
                        <p className="text-sm font-medium text-[#A1A1AA] mb-4">
                          You are finishing the ride before arriving at the
                          destination. Please provide a reason to complete the
                          job.
                        </p>
                        <div className="space-y-2 mb-6">
                          {[
                            "Customer requested drop-off here",
                            "Car broke down",
                            "Passenger behavior",
                            "Emergency",
                            "Other",
                          ].map((reason) => (
                            <button
                              key={reason}
                              onClick={() => setEarlyCompletionReason(reason)}
                              className={cn(
                                "w-full p-3 rounded-xl border text-sm font-bold transition-all text-left",
                                earlyCompletionReason === reason
                                  ? "bg-[#00D26A]/20 border-[#00D26A] text-[#00D26A]"
                                  : "bg-[#252529] border-[#333338] text-white hover:bg-[#333338]",
                              )}
                            >
                              {reason}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm font-medium text-[#A1A1AA] mb-6">
                        Please confirm you are dropping off the passenger at
                        their destination.
                      </p>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowCompleteConfirm(false)}
                        className="flex-1 py-4 bg-[#252529] rounded-2xl font-black text-[#A1A1AA] hover:bg-[#333338] transition-colors shadow-none"
                      >
                        Go Back
                      </button>
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
      {activeTab === "earnings" && (
        <DriverEarnings onClose={() => setActiveTab("home")} />
      )}
      {activeTab === "analytics" && (
        <DriverAnalytics onClose={() => setActiveTab("menu")} />
      )}
      {activeTab === "inbox" && (
        <DriverInbox
          onClose={() => setActiveTab("home")}
          onNavigate={(tab) => setActiveTab(tab)}
        />
      )}
      {activeTab === "jobs" && (
        <DriverJobs onClose={() => setActiveTab("home")} />
      )}
      {activeTab === "zones" && (
        <DriverZones onClose={() => setActiveTab("menu")} />
      )}
      {activeTab === "availability" && (
        <DriverAvailability onClose={() => setActiveTab("menu")} />
      )}
      {activeTab === "menu" && (
        <DriverMenu
          onNavigate={(tab) => setActiveTab(tab as any)}
          commissionRate={fareConfig.commissionRate}
          isOnline={isOnline}
          onToggleOnline={handleToggleOnline}
          onClose={() => setActiveTab("home")}
        />
      )}
      <AnimatePresence>
        {activeTab === "documents" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 z-50"
          >
            <DriverDocuments onBack={() => setActiveTab("menu")} />
          </motion.div>
        )}
      </AnimatePresence>
      {/* Bottom Status Widget (Sticky Floating above global nav) */}
      {rideState === "idle" && activeTab === "home" && (
        <div className="fixed left-0 right-0 px-4 z-50 pointer-events-none flex flex-col items-center" style={{ bottom: "calc(84px + env(safe-area-inset-bottom, 0px))" }}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "w-full max-w-sm h-8 px-4 rounded-xl flex items-center justify-between border backdrop-blur-md transition-all pointer-events-auto shadow-lg",
              isOnline
                ? "bg-[#064e3b]/80 border-emerald-500/30 shadow-emerald-900/20"
                : "bg-[#1A1A1E]/90 border-[#2C2C30]",
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  isOnline ? "bg-[#00D26A] animate-pulse" : "bg-[#A1A1AA]",
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-black uppercase tracking-widest",
                  isOnline ? "text-white" : "text-[#A1A1AA]",
                )}
              >
                {isOnline ? "Waiting for Jobs" : "Offline"}
              </span>
            </div>
            <span
              className={cn(
                "text-[9px]",
                isOnline
                  ? "font-black text-[#00D26A] drop-shadow-[0_0_2px_rgba(0,210,106,1)] brightness-150"
                  : "font-bold text-[#A1A1AA]",
              )}
            >
              {isOnline ? "ACTIVE" : "STANDBY"}
            </span>
          </motion.div>
        </div>
      )}
      {/* Hazard Report Modal */}
      <AnimatePresence>
        {showHazardModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0D0D0F]/80 backdrop-blur-sm"
          >
            <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
              <button
                onClick={() => {
                  setShowHazardModal(false);
                  setReportingHazardType(null);
                  setHazardCountdown(0);
                }}
                className="absolute top-5 left-5 w-8 h-8 flex items-center justify-center text-[#1A1A1E] hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6 stroke-[3]" />
              </button>

              <div className="flex justify-between items-center mb-8 pl-10">
                <h3 className="text-[22px] font-medium text-[#1A1A1E] tracking-tight mx-auto -ml-2">
                  Report road issue
                </h3>
                <button className="w-6 h-6 flex items-center justify-center text-[#1A1A1E] border-[1.5px] border-[#1A1A1E] rounded-full">
                  <span className="font-bold text-[13px]">?</span>
                </button>
              </div>

              {/* Grid of Hazards */}
              <div className="grid grid-cols-3 gap-y-8 gap-x-2">
                {[
                  {
                    label: "Accident",
                    type: "Accident",
                    icon: AlertTriangle,
                    bg: "bg-[#E0F2FE]",
                    color: "text-[#EA580C]",
                  },
                  {
                    label: "Traffic",
                    type: "Traffic",
                    icon: Car,
                    bg: "bg-[#FEF9C3]",
                    color: "text-[#CA8A04]",
                  },
                  {
                    label: "Construction",
                    type: "Construction",
                    icon: HardHat,
                    bg: "bg-[#FFF7ED]",
                    color: "text-[#F97316]",
                  },
                  {
                    label: "Road Closure",
                    type: "Road Closure",
                    icon: MinusCircle,
                    bg: "bg-[#FEE2E2]",
                    color: "text-[#DC2626]",
                  },
                  {
                    label: "Speed Trap",
                    type: "Speed Trap",
                    icon: Camera,
                    bg: "bg-[#DBEAFE]",
                    color: "text-[#3B82F6]",
                  },
                  {
                    label: "Incorrect Route",
                    type: "Incorrect Route",
                    icon: MapPinOff,
                    bg: "bg-[#F1F5F9]",
                    color: "text-[#475569]",
                  },
                ].map((item, i) => {
                  const isReporting = reportingHazardType === item.type;
                  const isOtherReporting =
                    reportingHazardType && reportingHazardType !== item.type;

                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex flex-col items-center gap-2 cursor-pointer transition-opacity",
                        isOtherReporting
                          ? "opacity-30 pointer-events-none"
                          : "",
                      )}
                      onClick={() => {
                        if (
                          hazardCountdown > 0 &&
                          reportingHazardType === item.type
                        ) {
                          // Cancel
                          setReportingHazardType(null);
                          setHazardCountdown(0);
                        } else if (hazardCountdown === 0) {
                          setReportingHazardType(item.type);
                          setHazardCountdown(3);
                        }
                      }}
                    >
                      <div
                        className={cn(
                          "w-[72px] h-[72px] rounded-3xl flex items-center justify-center transition-all relative overflow-hidden",
                          item.bg,
                          isReporting ? "scale-105" : "hover:scale-105",
                        )}
                      >
                        {isReporting && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: "100%" }}
                            transition={{ duration: 3, ease: "linear" }}
                            className="absolute bottom-0 left-0 right-0 bg-[#1E3A8A] opacity-20"
                          />
                        )}
                        <item.icon
                          className={cn("w-8 h-8 relative z-10", item.color)}
                          strokeWidth={2.5}
                        />
                      </div>
                      <div className="text-center h-10 flex flex-col justify-start mt-1">
                        <span className="text-[14px] text-[#475569] leading-tight font-medium">
                          {item.label}
                        </span>
                        {isReporting && (
                          <>
                            <span className="text-[12px] font-bold text-[#1E3A8A] leading-tight block mt-1">
                              Reporting in {hazardCountdown}s...
                            </span>
                            <span className="text-[11px] text-[#64748B] leading-tight block mt-0.5">
                              Tap to cancel
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* SOS Button at the bottom */}
              <div className="mt-6 pt-6 border-t border-gray-100">
                <button
                  onClick={() => {
                    window.location.href = "tel:999";
                    setShowHazardModal(false);
                  }}
                  className="w-full flex items-center justify-center gap-3 bg-[#FEF2F2] text-[#DC2626] py-3.5 rounded-2xl border border-[#FECACA] active:scale-[0.98] transition-transform"
                >
                  <PhoneCall className="w-5 h-5 fill-current" />
                  <span className="font-bold tracking-wide">
                    EMERGENCY SOS (999)
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

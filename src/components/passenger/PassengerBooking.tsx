import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  MapPin, Navigation, Car, Clock, X, Check, Target, 
  MessageSquare, ChevronRight, ChevronLeft, ArrowLeft, ArrowRight, Zap, History, Loader2, 
  Mic, MicOff, Star, Users, User, Repeat, Shield, Plus, Heart, Bookmark,
  Home, Briefcase, Dog, Accessibility, MessageCircle, Phone, AlertCircle, Hammer, ArrowDownToLine, Delete, Dumbbell,
  AlertTriangle, CreditCard
} from "lucide-react";
import RideChat from "../driver/RideChat";
import { cn } from "@/src/lib/utils";
import { db, addDoc, collection, serverTimestamp, doc, updateDoc, arrayUnion, arrayRemove, onSnapshot, setDoc, increment, query, where, getDocs, orderBy, limit, deleteField, getDoc, runTransaction } from "@/src/firebase";
import { playSound } from "@/src/lib/sound";
import { useAuth } from "../AuthProvider";
import { usePortal } from "../../lib/PortalContext";
import { useRemoteConfig } from "../RemoteConfigProvider";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { processTaxiVoiceCommand } from "@/src/services/gemini";
import { triggerHaptic, ImpactStyle, hideNativeKeyboard, getGoogleMapsApiKey } from "@/src/lib/capacitor";
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { LocalNotifications } from '@capacitor/local-notifications';

// Google Maps Imports
import { GoogleMap, useJsApiLoader, MarkerF, PolylineF, OverlayViewF, OverlayView } from "@react-google-maps/api";
import { MapZoomControls } from "../shared/MapZoomControls";
import { fetchLiveDemandZones } from "@/src/services/surgeHeatmapService";

const containerStyle = {
  width: '100%',
  height: '100%',
  touchAction: 'none'
};

const defaultCenter = {
  lat: 53.6458,
  lng: -1.785
};

const createPinIcon = (color: string) => {
  if (typeof window === 'undefined' || !window.google) return undefined;
  return {
    path: "M12,0 C5.373,0 0,5.373 0,12 C0,17.472 3.65,22.08 8.65,23.51 L11.5,46 L12.5,46 L15.35,23.51 C20.35,22.08 24,17.472 24,12 C24,5.373 18.627,0 12,0 Z",
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 1.5,
    scale: 1.4,
    anchor: new window.google.maps.Point(12, 46),
    labelOrigin: new window.google.maps.Point(12, 12)
  };
};

const formatAddressLines = (address: string) => {
  if (!address) return <span className="block truncate">{address}</span>;
  
  const ukPostcodeRegex = /([A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2})/i;
  let cleanAddress = address;
  
  let postcode = "";
  const match = cleanAddress.match(ukPostcodeRegex);
  if (match) {
    postcode = match[1];
    cleanAddress = cleanAddress.replace(match[1], '').trim();
  }
  
  // Clean trailing commas and spaces
  cleanAddress = cleanAddress.replace(/,\s*$/, '').replace(/,\s*UK$/i, ' UK').trim();
  const cparts = cleanAddress.split(',').map(p => p.trim()).filter(Boolean);
  
  let cityStr = "";
  let streetStr = "";
  
  if (cparts.length > 1) {
     cityStr = cparts[cparts.length - 1]; // e.g. "Huddersfield UK"
     streetStr = cparts.slice(0, cparts.length - 1).join(', '); // e.g. "McDonald's, 10 Leeds Rd"
  } else {
     streetStr = cparts[0] || '';
  }
  
  return (
    <>
      {streetStr && <span className="block max-w-[200px]" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{streetStr}</span>}
      {cityStr && <span className="block max-w-[200px] truncate">{cityStr}</span>}
      {postcode && <span className="block truncate uppercase font-extrabold max-w-[200px]">{postcode}</span>}
    </>
  );
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
      "featureType": "poi",
      "stylers": [{ "visibility": "off" }]
    },
    {
      "featureType": "transit",
      "stylers": [{ "visibility": "simplified" }]
    }
  ]
};

const premiumMapOptions: google.maps.MapOptions = {
  ...mapOptions,
  mapTypeId: "roadmap",
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
      elementType: "geometry",
      stylers: [{ color: "#ffffff" }],
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

const darkMapOptions: google.maps.MapOptions = {
  ...mapOptions,
  styles: [
    { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
    { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
    { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
    { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
    { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212a37" }] },
    { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca5b3" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] }
  ]
};

const libraries: any[] = ['places', 'geometry'];

type BookingStep = "details" | "searching" | "confirmed" | "receipt";

const CAR_CATEGORIES = [
  { id: 'standard', name: 'Standard Car', multiplier: 1.0, wait: '3-5', capacity: 4, icon: Car },
  { id: 'executive', name: 'Executive', multiplier: 1.5, wait: '5-8', capacity: 4, icon: Shield },
  { id: 'luxury', name: 'Luxury', multiplier: 2.2, wait: '8-12', capacity: 4, icon: Star },
  { id: '6seater', name: '6-Seater XL', multiplier: 1.4, wait: '6-10', capacity: 6, icon: Users },
  { id: '8seater', name: '8-Seater Max', multiplier: 2.0, wait: '8-15', capacity: 8, icon: Users },
  { id: 'wav', name: 'Wheelchair', multiplier: 2.5, wait: '10-20', capacity: 4, icon: Accessibility }
];

const getTimestampMs = (val: any): number => {
  if (!val) return Date.now();
  if (typeof val === 'number') return val;
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (val.seconds !== undefined) return val.seconds * 1000 + (val.nanoseconds || 0) / 1000000;
  if (typeof val === 'string') return new Date(val).getTime();
  if (val instanceof Date) return val.getTime();
  return Date.now();
};

function PassengerTimer({ arrivedAt }: { arrivedAt: any }) {
  const { values: remoteConfig } = useRemoteConfig();
  const [elapsed, setElapsed] = useState(0);

  const limitMins = remoteConfig?.driverWaitTimeLimitMins ?? 5;
  const maxWaitSeconds = limitMins * 60;
  const freeWaitSeconds = Math.max(60, maxWaitSeconds - 120);

  useEffect(() => {
    const ms = getTimestampMs(arrivedAt);
    setElapsed(Math.floor((Date.now() - ms) / 1000));
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - ms) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [arrivedAt]);

  const mins = Math.floor(elapsed / 60);
  const secs = (elapsed % 60).toString().padStart(2, '0');
  
  return (
    <div className="text-right">
      <p className="text-2xl font-black text-purple-900 leading-none mb-1">{mins}:{secs}</p>
      {elapsed < freeWaitSeconds ? (
        <p className="text-[10px] font-bold text-[#00D26A] uppercase tracking-widest leading-none">Free wait: {Math.floor((freeWaitSeconds - elapsed) / 60)}:{((freeWaitSeconds - elapsed) % 60).toString().padStart(2, '0')}</p>
      ) : elapsed < maxWaitSeconds ? (
        <p className="text-[10px] font-bold mt-0.5 uppercase tracking-widest text-[#FF3B30] leading-none">charging wait time: {Math.floor((elapsed - freeWaitSeconds) / 60)}:{((elapsed - freeWaitSeconds) % 60).toString().padStart(2, '0')}</p>
      ) : (
        <p className="text-[10px] font-bold mt-0.5 uppercase tracking-widest text-[#FF3B30] leading-none">Cancel fee applies</p>
      )}
    </div>
  );
}

function SearchingTimer() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const mins = Math.floor(elapsed / 60);
  const secs = (elapsed % 60).toString().padStart(2, '0');
  
  return (
    <div className="flex items-center justify-between bg-[#f8fafc] border border-black px-6 py-2 rounded-[16px] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] mb-3 w-full max-w-[320px]">
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.1em]">Time Elapsed</p>
      <p className="text-[24px] leading-none font-black text-slate-900 tracking-tight">{mins.toString().padStart(2, '0')}:{secs}</p>
    </div>
  );
}

function CancelRideButton_ConfirmedPhase({ 
  acceptedAt, 
  arrivedAt, 
  status, 
  onCancel 
}: { 
  acceptedAt: any; 
  arrivedAt?: any; 
  status?: string; 
  onCancel: () => void; 
}) {
  const { values: remoteConfig } = useRemoteConfig();
  const [elapsed, setElapsed] = useState(0);

  const limitMins = remoteConfig?.driverWaitTimeLimitMins ?? 5;
  const maxWaitSeconds = limitMins * 60;
  const freeWaitSeconds = Math.max(60, maxWaitSeconds - 120);

  useEffect(() => {
    const getElapsed = () => {
      if (status === "arrived" && arrivedAt) {
        return Math.floor((Date.now() - getTimestampMs(arrivedAt)) / 1000);
      }
      return Math.floor((Date.now() - getTimestampMs(acceptedAt)) / 1000);
    };

    setElapsed(getElapsed());
    const interval = setInterval(() => {
      setElapsed(getElapsed());
    }, 1000);
    return () => clearInterval(interval);
  }, [acceptedAt, arrivedAt, status]);

  const isArrivedStatus = status === "arrived";
  const isFree = isArrivedStatus
    ? (arrivedAt ? elapsed < freeWaitSeconds : true)
    : elapsed < 120;

  const remaining = isFree
    ? (isArrivedStatus ? (arrivedAt ? freeWaitSeconds - elapsed : freeWaitSeconds) : 120 - elapsed)
    : 0;

  const mins = Math.max(0, Math.floor(remaining / 60));
  const secs = Math.max(0, Math.floor(remaining % 60)).toString().padStart(2, '0');

  return (
    <button onClick={onCancel} className={cn("w-full py-2.5 rounded-[16px] border border-black flex flex-col items-center justify-center transition-transform active:scale-[0.98] shadow-lg bg-[#d32f2f] text-white shadow-red-900/10")}>
      <span className="font-bold text-[15px] leading-tight text-white mb-0.5">Cancel Ride</span>
      {isFree ? (
        <span className="text-white/80 text-[13px] font-medium leading-none">{mins}:{secs}</span>
      ) : (
        <span className="text-white/80 text-[13px] font-medium leading-none">Fee Applies</span>
      )}
    </button>
  );
}

export default function PassengerBooking() {
  const { user, profile } = useAuth();
  const { values: remoteConfig } = useRemoteConfig();
  const { theme, switchPortal } = usePortal();

  const limitMins = remoteConfig?.driverWaitTimeLimitMins ?? 5;
  const maxWaitSeconds = limitMins * 60;
  const freeWaitSeconds = Math.max(60, maxWaitSeconds - 120);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [step, setStep] = useState<BookingStep>("details");
  const [isMapFullScreen, setIsMapFullScreen] = useState(false);
  const [completedRideData, setCompletedRideData] = useState<any>(null);
  const [houseNumber, setHouseNumber] = useState("");
  const [pickup, setPickup] = useState(searchParams.get("pickup") || localStorage.getItem("passenger_temp_pickup") || "");
  const [dropoff, setDropoff] = useState(searchParams.get("dropoff") || localStorage.getItem("passenger_temp_dropoff") || "");
  const pickupInputRef = useRef<HTMLInputElement>(null);
  const dropoffInputRef = useRef<HTMLInputElement>(null);
  const [comments, setComments] = useState(searchParams.get("comments") || localStorage.getItem("passenger_temp_comments") || "");
  const [waitTolerance, setWaitTolerance] = useState<10 | 20 | 30>(20);
  const [selectedCategory, setSelectedCategory] = useState("standard");
  const [isPetFriendly, setIsPetFriendly] = useState(false);
  const [isPriority, setIsPriority] = useState(false);
  const [showPriorityPrompt, setShowPriorityPrompt] = useState(false);
  const [priorityInlineToast, setPriorityInlineToast] = useState<{message: string, type: 'success' | 'info'} | null>(null);
  const [editId, setEditId] = useState<string | null>(searchParams.get("edit"));
  const [showTipModal, setShowTipModal] = useState(false);
  const [showCustomTipKeypad, setShowCustomTipKeypad] = useState(false);
  const [disabledQuickMessages, setDisabledQuickMessages] = useState<string[]>([]);
  const [isAddingTip, setIsAddingTip] = useState(false);
  const [selectedTip, setSelectedTip] = useState<number | null>(null);
  const [customTip, setCustomTip] = useState("");
  const [rideRating, setRideRating] = useState<number>(5);
  const [selectedReviewTags, setSelectedReviewTags] = useState<string[]>([]);
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [hasSubmittedReview, setHasSubmittedReview] = useState(false);
  const [rideContext, setRideContext] = useState<"personal" | "business">("personal");
  const [isClearingBalance, setIsClearingBalance] = useState(false);

  // Check for an existing active ride to auto-resume
  useEffect(() => {
    if (!user || currentRideId || editId || step === "receipt") return;
    const checkActiveRide = async () => {
      try {
        const q = query(
          collection(db, "ride_requests"),
          where("riderId", "==", user.uid),
          where("status", "in", ["pending", "offered", "accepted", "arrived", "in_progress"]),
          orderBy("createdAt", "desc"),
          limit(1)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const activeRide = snapshot.docs[0];
          const data = activeRide.data();
          setCurrentRideId(activeRide.id);

          setPickup(data.pickup || "");
          setDropoff(data.dropoff || "");
          if (data.pickupLat && data.pickupLng) setPickupCoords({lat: data.pickupLat, lng: data.pickupLng});
          if (data.dropoffLat && data.dropoffLng) setDropoffCoords({lat: data.dropoffLat, lng: data.dropoffLng});
          if (data.stops) setStops(data.stops);
          setSelectedCategory(data.carCategory || "standard");
          setComments(data.comments || "");
          if (data.isPriority) setIsPriority(data.isPriority);
          if (data.isPetFriendly) setIsPetFriendly(data.isPetFriendly);
          if (data.baseCalc) {
            setFareEstimate(data.baseCalc);
          } else if (data.fareEstimate) {
            // Backwards compat if baseCalc isn't populated
            const extras = (data.isPriority ? 3 : 0) + (data.isPetFriendly ? 3 : 0);
            setFareEstimate(Math.max(data.fareEstimate - extras, 5.0));
          }
          if (data.surgeModel !== undefined) {
             setActiveSurge({
               multiplier: data.surgeMultiplier || 1.0,
               fee: data.surgeFixedAmount || 0,
               isFixed: data.surgeModel === 'fixed'
             });
          }

          if (data.status === "pending" || data.status === "offered") {
            setStep("searching");
          } else {
            setStep("confirmed");
          }
        }
      } catch (err) {
        console.error("Failed to auto-resume active ride", err);
      }
    };
    checkActiveRide();
  }, [user, currentRideId, editId, step]);

  // Mock settings for demonstrating corporate and card functionality
  const hasCorporateAccount = profile?.corporateAccountId ? true : true; 
  const hasCardOnFile = profile?.hasCardOnFile ? true : false;
  
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: getGoogleMapsApiKey(),
    libraries,
    version: "quarterly"
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);

  // Load existing ride
  useEffect(() => {
    if (editId) {
      const unsub = onSnapshot(doc(db, "ride_requests", editId), (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          if (data.status === "pending" || data.status === "draft" || data.status === "offered") {
            setPickup(data.pickup || "");
            setDropoff(data.dropoff || "");
            setComments(data.comments || "");
            setSelectedCategory(data.carCategory || "standard");
            setIsPetFriendly(data.isPetFriendly || false);
            if (data.waitTolerance) setWaitTolerance(data.waitTolerance as any);
            if (data.baseCalc) setFareEstimate(data.baseCalc);
            
            if (data.surgeModel !== undefined) {
               setActiveSurge({
                 multiplier: data.surgeMultiplier || 1.0,
                 fee: data.surgeFixedAmount || 0,
                 isFixed: data.surgeModel === 'fixed'
               });
            }
          }
        }
      }, (err) => console.error("onSnapshot ERROR ride_requests:", err));
      return () => unsub();
    }
  }, [editId]);

  const [isDetecting, setIsDetecting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>("");
  const [fareEstimate, setFareEstimate] = useState<number | null>(null);
  const [waitWarning, setWaitWarning] = useState(false);
  const [maxWaitTimeMins, setMaxWaitTimeMins] = useState<number>(0);
  const [waitWarningAcknowledged, setWaitWarningAcknowledged] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [distanceMiles, setDistanceMiles] = useState<number>(0);
  const [durationMinutes, setDurationMinutes] = useState<number>(0);
  const [activeSurge, setActiveSurge] = useState<{multiplier: number, fee: number, isFixed: boolean}>({multiplier: 1.0, fee: 0, isFixed: true});
  const [nearbyDriversCount, setNearbyDriversCount] = useState<number>(0);
  const [driversAvailableSoonCount, setDriversAvailableSoonCount] = useState<number>(0);
  const [estimatedWaitEta, setEstimatedWaitEta] = useState<number | null>(null);
  const [nearbyDriversLocations, setNearbyDriversLocations] = useState<{lat: number, lng: number, id: string}[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Set<string>>(new Set(['standard']));
  const [showRideInfo, setShowRideInfo] = useState(false);
  const [rideInfoTimerTick, setRideInfoTimerTick] = useState(0);
  const [assignedDriverInfo, setAssignedDriverInfo] = useState<any>(null);
  const lastSoundStatusRef = useRef<string | null>(null);
  const currentRideStatusRef = useRef<string | null>(null);
  const hasTriggeredTipModalRef = useRef(false);
  const [fareConfig, setFareConfig] = useState({ 
    baseFare: 3.5, 
    distanceRate: 1.3, 
    timeRate: 0.15, 
    waitRatePerMinute: 0.25, 
    minFare: 5.0, 
    commissionRate: 0.12,
    autoDispatchEnabled: true,
    dispatchRadiusMiles: 15,
    dispatchTimeoutSeconds: 15,
    vehicleMultipliers: {
      standard: 1.0,
      executive: 1.5,
      luxury: 2.2,
      '6seater': 1.4,
      '8seater': 2.0,
      wav: 2.5
    } as Record<string, number>
  });

  const [liveRouteLine, setLiveRouteLine] = useState<{lat: number, lng: number}[]>([]);
  const [liveEtaMins, setLiveEtaMins] = useState<number | null>(null);
  const [liveEtaSeconds, setLiveEtaSeconds] = useState<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveEtaSeconds(prev => (prev && prev > 0) ? prev - 1 : prev);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch remote config
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "platform_config", "rides"), (doc) => {
      if (doc.exists()) {
        setFareConfig(prev => ({ ...prev, ...doc.data() }));
      }
    }, (err) => console.error("onSnapshot ERROR platform_config/rides:", err));
    return () => unsub();
  }, []);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const lastSeenChatCountRef = useRef(0);
  const lastLocationSyncRef = useRef(0);
  const lastSyncCoordsRef = useRef<{lat: number, lng: number} | null>(null);

  const [incomingPopupMessage, setIncomingPopupMessage] = useState<{ id: string, text: string } | null>(null);
  const lastPopupMessageIdRef = useRef<string | null>(null);
  const [quickMessageCooldown, setQuickMessageCooldown] = useState(0);

  useEffect(() => {
    if (incomingPopupMessage) {
      const timer = setTimeout(() => {
        setIncomingPopupMessage(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [incomingPopupMessage]);

  useEffect(() => {
    if (quickMessageCooldown > 0) {
      const timer = setTimeout(() => setQuickMessageCooldown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [quickMessageCooldown]);

  const handleQuickReply = async (replyText: string) => {
    if (!currentRideId || !user) return;
    try {
      await addDoc(collection(db, "ride_requests", currentRideId, "chat"), {
        text: replyText,
        senderId: user.uid,
        createdAt: serverTimestamp()
      });
      setIncomingPopupMessage(null);

      // Trigger remote FCM push notification to driver
      if (assignedDriverInfo?.driverId) {
        fetch("/api/chat-push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientId: assignedDriverInfo.driverId,
            title: "New Message from Passenger",
            body: replyText,
            rideId: currentRideId
          })
        }).catch(err => console.error("FCM API error:", err));
      }
    } catch (err) {
      console.error("Failed to send quick reply", err);
    }
  };

  const [hasModifiedRouteByUser, setHasModifiedRouteByUser] = useState(false);
  const [showRegularJourneys, setShowRegularJourneys] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showHomeBlank, setShowHomeBlank] = useState(false);
  const [showWorkBlank, setShowWorkBlank] = useState(false);
  const [isEditingJourney, setIsEditingJourney] = useState(false);
  
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (showRegularJourneys || showFavorites || showHomeBlank || showWorkBlank) {
      if (bottomSheetRef.current) {
        setTimeout(() => {
          bottomSheetRef.current?.scrollTo({ top: bottomSheetRef.current.scrollHeight, behavior: 'smooth' });
        }, 350);
        setTimeout(() => {
          bottomSheetRef.current?.scrollTo({ top: bottomSheetRef.current.scrollHeight, behavior: 'smooth' });
        }, 500);
      }
      timeout = setTimeout(() => {
        setShowRegularJourneys(false);
        setShowFavorites(false);
        setShowHomeBlank(false);
        setShowWorkBlank(false);
      }, 10000);
    }
    return () => clearTimeout(timeout);
  }, [showRegularJourneys, showFavorites, showHomeBlank, showWorkBlank]);

  const [detailsView, setDetailsView] = useState<"address" | "vehicle">("address");

  const bottomSheetRef = useRef<HTMLDivElement>(null);
  const vehicleSelectionRef = useRef<HTMLDivElement>(null);
  
  // Auto-focus pickup field on mount
  useEffect(() => {
    if (step === "details" && detailsView === "address") {
      setTimeout(() => {
        if (!pickup) {
          pickupInputRef.current?.focus();
          setActiveField("pickup");
        }
      }, 300); // 300ms delay to ensure animation finishes
    }
  }, [step, detailsView]);

  // Auto-scroll when route is calculated
  useEffect(() => {
    if (distanceMiles > 0 && vehicleSelectionRef.current && bottomSheetRef.current) {
      setTimeout(() => {
        vehicleSelectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500);
    }
  }, [distanceMiles]);

  // Map States
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [mapZoom, setMapZoom] = useState(16);
  const [pickupCoords, setPickupCoords] = useState<{lat: number, lng: number} | null>(() => {
    try {
      const saved = localStorage.getItem("passenger_temp_pickup_coords");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [dropoffCoords, setDropoffCoords] = useState<{lat: number, lng: number} | null>(() => {
    try {
      const saved = localStorage.getItem("passenger_temp_dropoff_coords");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [stops, setStops] = useState<{address: string, coords: {lat: number, lng: number} | null}[]>(() => {
    try {
      const saved = localStorage.getItem("passenger_temp_stops");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [routeLine, setRouteLine] = useState<{lat: number, lng: number}[]>([]);

  const clearBookingInputsAndState = () => {
    setPickup("");
    setDropoff("");
    setComments("");
    setPickupCoords(null);
    setDropoffCoords(null);
    setStops([]);
    setCurrentRideId(null);
    setAssignedDriverInfo(null);
    setDriverPos(null);
    setLiveEtaSeconds(null);
    setLiveEtaMins(null);
    setStep("details");

    localStorage.removeItem("passenger_temp_pickup");
    localStorage.removeItem("passenger_temp_dropoff");
    localStorage.removeItem("passenger_temp_comments");
    localStorage.removeItem("passenger_temp_pickup_coords");
    localStorage.removeItem("passenger_temp_dropoff_coords");
    localStorage.removeItem("passenger_temp_stops");
  };

  // Adjust map zooming dynamically on ride status change
  useEffect(() => {
    if (assignedDriverInfo?.status === "arrived") {
      setMapZoom(17);
      if (pickupCoords) setMapCenter(pickupCoords);
    } else if (assignedDriverInfo?.status === "accepted") {
      setMapZoom(14);
    } else if (assignedDriverInfo?.status === "in_progress") {
      setMapZoom(15);
    }
  }, [assignedDriverInfo?.status, pickupCoords]);

  // Synchronize passenger input states to localStorage to preserve state across tab switches
  useEffect(() => {
    if (pickup) {
      localStorage.setItem("passenger_temp_pickup", pickup);
    } else {
      localStorage.removeItem("passenger_temp_pickup");
    }
  }, [pickup]);

  useEffect(() => {
    if (dropoff) {
      localStorage.setItem("passenger_temp_dropoff", dropoff);
    } else {
      localStorage.removeItem("passenger_temp_dropoff");
    }
  }, [dropoff]);

  useEffect(() => {
    if (comments) {
      localStorage.setItem("passenger_temp_comments", comments);
    } else {
      localStorage.removeItem("passenger_temp_comments");
    }
  }, [comments]);

  useEffect(() => {
    if (pickupCoords) {
      localStorage.setItem("passenger_temp_pickup_coords", JSON.stringify(pickupCoords));
    } else {
      localStorage.removeItem("passenger_temp_pickup_coords");
    }
  }, [pickupCoords]);

  useEffect(() => {
    if (dropoffCoords) {
      localStorage.setItem("passenger_temp_dropoff_coords", JSON.stringify(dropoffCoords));
    } else {
      localStorage.removeItem("passenger_temp_dropoff_coords");
    }
  }, [dropoffCoords]);

  useEffect(() => {
    if (stops && stops.length > 0) {
      localStorage.setItem("passenger_temp_stops", JSON.stringify(stops));
    } else {
      localStorage.removeItem("passenger_temp_stops");
    }
  }, [stops]);

  // Long press to drag markers
  const [draggablePin, setDraggablePin] = useState<string | null>(null);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handlePinMouseDown = (id: string) => {
    if (draggablePin === id) return;
    if (step !== "details" || detailsView !== "address") return;
    pressTimerRef.current = setTimeout(() => {
      setDraggablePin(id);
      toast.success("Pin unlocked! You can now drag it.", { duration: 2500, icon: '📍' });
      triggerHaptic(ImpactStyle.Heavy);
    }, 1000);
  };

  const handlePinMouseUpOrLeave = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  // Resolve URL parameters
  useEffect(() => {
    if (isLoaded && window.google && window.google.maps) {
      let resolvedPickup = false;
      let resolvedDropoff = false;

      const resolveAddresses = async () => {
        const geocoder = new window.google.maps.Geocoder();
        const initialPickup = searchParams.get("pickup");
        const initialDropoff = searchParams.get("dropoff");

        if (initialPickup && !pickupCoords) {
           try {
             const res = await geocoder.geocode({ address: initialPickup, componentRestrictions: { country: "GB" } });
             if (res.results && res.results.length > 0) {
               const loc = res.results[0].geometry.location;
               setPickupCoords({ lat: loc.lat(), lng: loc.lng() });
               resolvedPickup = true;
             }
           } catch(e) { console.error(e); }
        } else if (pickupCoords) {
           resolvedPickup = true;
        }

        if (initialDropoff && !dropoffCoords) {
           try {
             const res = await geocoder.geocode({ address: initialDropoff, componentRestrictions: { country: "GB" } });
             if (res.results && res.results.length > 0) {
               const loc = res.results[0].geometry.location;
               setDropoffCoords({ lat: loc.lat(), lng: loc.lng() });
               resolvedDropoff = true;
             }
           } catch(e) { console.error(e); }
        } else if (dropoffCoords) {
           resolvedDropoff = true;
        }
        
        if (resolvedPickup && resolvedDropoff && initialPickup && initialDropoff && detailsView === "address") {
           setDetailsView("vehicle");
        }
      };

      resolveAddresses();
    }
  }, [isLoaded, searchParams]);

  useEffect(() => {
    if (mapCenter && map && step === "details") {
      map.panTo(mapCenter);
    }
  }, [mapCenter, map, step]);

  // Routing and Distance Calculation (consolidated)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (pickupCoords && dropoffCoords && isLoaded) {
      const getRoute = async () => {
        if (Math.abs(pickupCoords.lat) < 0.1 && Math.abs(pickupCoords.lng) < 0.1) return;
        if (Math.abs(dropoffCoords.lat) < 0.1 && Math.abs(dropoffCoords.lng) < 0.1) return;
        if (Math.abs(pickupCoords.lat - dropoffCoords.lat) < 0.0001 && Math.abs(pickupCoords.lng - dropoffCoords.lng) < 0.0001) return;

        try {
          const directionsService = new window.google.maps.DirectionsService();
          const validStops = stops.filter(s => s.coords !== null).map(s => ({
            location: new window.google.maps.LatLng(s.coords!.lat, s.coords!.lng),
            stopover: true
          }));

          const routeReq: google.maps.DirectionsRequest = {
            origin: new window.google.maps.LatLng(pickupCoords.lat, pickupCoords.lng),
            destination: new window.google.maps.LatLng(dropoffCoords.lat, dropoffCoords.lng),
            travelMode: window.google.maps.TravelMode.DRIVING,
          };
          if (validStops.length > 0) {
            routeReq.waypoints = validStops;
          }

          directionsService.route(routeReq, (result, status) => {
            if (status === window.google.maps.DirectionsStatus.OK && result) {
              // Draw the line
              const path = result.routes[0].overview_path.map(p => ({ lat: p.lat(), lng: p.lng() }));
              setRouteLine(path);

              // Fit bounds
              if (map) {
                const bounds = new window.google.maps.LatLngBounds();
                path.forEach((p: any) => bounds.extend(p));
                map.fitBounds(bounds, { 
                  padding: { top: 60, right: 50, bottom: 60, left: 50 } 
                });
                
                // Zoom out 1-2 ticks after bounds are set to give more breathing room
                setTimeout(() => {
                  const currentZoom = map.getZoom();
                  if (currentZoom) {
                     map.setZoom(currentZoom - 1);
                  }
                }, 150);
              }

              // Calculate distance/fare
              let totalDistanceMeters = 0;
              let totalDurationSeconds = 0;
              result.routes[0].legs.forEach((leg: any) => {
                if (leg.distance) totalDistanceMeters += leg.distance.value;
                if (leg.duration) totalDurationSeconds += leg.duration.value;
              });
              const dMiles = totalDistanceMeters / 1609.34;
              const dMins = totalDurationSeconds / 60;
              
              setDistanceMiles(dMiles);
              setDurationMinutes(dMins);

              if (!currentRideId && !editId || hasModifiedRouteByUser) {
                // Base Fare + Distance + Time
                const calcFare = fareConfig.baseFare + (dMiles * fareConfig.distanceRate) + (dMins * fareConfig.timeRate);
                setFareEstimate(Math.max(calcFare, fareConfig.minFare));
              }
            }
          }).catch(() => {
            // Silently catch the unhandled promise rejection that Maps API throws for UNKNOWN_ERROR
          });
        } catch (e: any) {
          // completely silence routing errors to avoid unhandled rejection/console noise
        }
      };
      timeoutId = setTimeout(getRoute, 800);
      return () => clearTimeout(timeoutId);
    } else {
      setRouteLine([]);
    }
  }, [pickupCoords, dropoffCoords, stops, map, fareConfig, isLoaded, currentRideId, editId, hasModifiedRouteByUser]);


  useEffect(() => {
    if (navigator.geolocation && !pickupCoords && !searchParams.get("pickup")) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMapCenter(c);
        setPickupCoords(c);
        setMapZoom(16);
      });
    }
  }, [pickupCoords, searchParams]);

  useEffect(() => {
    if (!user || !pickupCoords) {
      setNearbyDriversCount(0);
      setDriversAvailableSoonCount(0);
      return;
    }
    
    // Check if pickup is in a busy/surge zone
    const checkZone = async () => {
      if (currentRideId && !isEditingJourney) return;
      const zones = await fetchLiveDemandZones();
      let isBusy = remoteConfig?.emergencySurgePricingEnabled ? true : false;
      let maxWait = 0;
      let highestMult = remoteConfig?.emergencySurgePricingEnabled ? 1.5 : 1.0;
      let highestFee = 0.0;
      let isFixedMode = remoteConfig?.emergencySurgePricingEnabled ? false : true;
      zones.forEach(z => {
         const dist = window.google?.maps?.geometry?.spherical?.computeDistanceBetween(
            new window.google.maps.LatLng(pickupCoords.lat, pickupCoords.lng),
            new window.google.maps.LatLng(z.lat, z.lng)
         );
         if (dist && dist <= z.radius) {
            if (z.waitWarning) isBusy = true;
            if (z.maxWaitTimeMins && z.maxWaitTimeMins > maxWait) maxWait = z.maxWaitTimeMins;
            if (z.surgeMultiplier > highestMult) highestMult = z.surgeMultiplier;
            if (z.extraFee && z.extraFee > highestFee) highestFee = z.extraFee;
            if (z.isFixedModel !== undefined) isFixedMode = z.isFixedModel;
         }
      });
      setWaitWarning(isBusy);
      setMaxWaitTimeMins(Math.floor(maxWait));
      setActiveSurge({multiplier: highestMult, fee: highestFee, isFixed: isFixedMode});
    };
    checkZone();
    
    // Reset ETA estimation
    setEstimatedWaitEta(null);
    const q = query(collection(db, "live_tracking"), where("isOnline", "==", true));
    const unsub = onSnapshot(q, (snapshot) => {
      const maxRadius = fareConfig?.dispatchRadiusMiles || 15;
      const eligibleDrivers: {
        id: string;
        data: any;
        distToPickup: number;
        distFromCurrentToDropoff: number;
        isStacked: boolean;
        categories: string[];
      }[] = [];

      const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 3958.8; // Radius of Earth in miles
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; 
      };

      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        
        // Match user's pet preference
        if (isPetFriendly && data.isPetFriendly !== true) {
          return;
        }
        if (data.isLastJob === true) {
          return;
        }

        let driverCategories = data.vehicleCategories || [data.vehicleCategory || 'standard'];
        const isStacked = data.status === 'on_ride';

        let distToPickup = Infinity;
        let distFromCurrentToDropoff = 0;

        if (isStacked) {
          if (data.isStackingEnabled !== false && data.dropoffLat && data.dropoffLng) {
            distFromCurrentToDropoff = (data.lat && data.lng) ? calculateDistance(data.lat, data.lng, data.dropoffLat, data.dropoffLng) : 0;
            distToPickup = calculateDistance(pickupCoords.lat, pickupCoords.lng, data.dropoffLat, data.dropoffLng);
          } else {
            return; // Not stackable
          }
        } else if (data.lat && data.lng) {
          distToPickup = calculateDistance(pickupCoords.lat, pickupCoords.lng, data.lat, data.lng);
        } else {
          return;
        }

        eligibleDrivers.push({
          id: docSnap.id,
          data,
          distToPickup,
          distFromCurrentToDropoff,
          isStacked,
          categories: driverCategories,
        });
      });

      // Progressive Ring Boundaries Search (Ring 1: 3mi, Ring 2: 8mi, Ring 3: platform maxRadius)
      let activeRadius = 3;
      const scanRings = [3, 8, maxRadius].filter(r => r <= maxRadius);
      for (const r of scanRings) {
        const matchesInRing = eligibleDrivers.filter(d => d.distToPickup <= r);
        if (matchesInRing.length > 0) {
          activeRadius = r;
          break;
        }
        if (r === maxRadius) {
          activeRadius = maxRadius;
        }
      }

      let countNow = 0;
      let countSoon = 0;
      let minEtaMins: number | null = null;
      const cats = new Set<string>();
      const locations: {lat: number, lng: number, id: string, dist?: number}[] = [];

      eligibleDrivers.forEach(d => {
        if (d.distToPickup <= activeRadius) {
          d.categories.forEach((cat: string) => cats.add(cat));
          if (d.isStacked) {
            countSoon++;
            const driverEta = (d.distFromCurrentToDropoff * 4) + 3 + (d.distToPickup * 4);
            if (minEtaMins === null || driverEta < minEtaMins) minEtaMins = driverEta;
          } else {
            countNow++;
            locations.push({ lat: d.data.lat, lng: d.data.lng, id: d.id, dist: d.distToPickup });
            const driverEta = d.distToPickup * 4;
            if (minEtaMins === null || driverEta < minEtaMins) minEtaMins = driverEta;
          }
        }
      });

      setNearbyDriversCount(countNow);
      setDriversAvailableSoonCount(countSoon);
      setEstimatedWaitEta(minEtaMins);
      
      // Take max 5 closest drivers (prioritize within 1 mile, fallback to within activeRadius)
      locations.sort((a, b) => (a as any).dist - (b as any).dist);
      const within1Mile = locations.filter((l: any) => l.dist <= 1);
      if (within1Mile.length > 0) {
        setNearbyDriversLocations(within1Mile.slice(0, 5));
      } else {
        setNearbyDriversLocations(locations.slice(0, 5));
      }
      setAvailableCategories(cats.size > 0 ? cats : new Set(['standard'])); // always show at least standard as fallback
    }, (err) => console.error("onSnapshot ERROR live_tracking:", err));
    return () => unsub();
  }, [pickupCoords, isPetFriendly, fareConfig?.dispatchRadiusMiles, user]);

  useEffect(() => {
    if (!availableCategories.has(selectedCategory)) {
      if (availableCategories.size > 0) {
        const firstAvail = CAR_CATEGORIES.find(c => availableCategories.has(c.id));
        if (firstAvail) setSelectedCategory(firstAvail.id);
      }
    }
  }, [availableCategories, selectedCategory]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "platform_config", "rides"), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setFareConfig(prev => ({
          ...prev,
          baseFare: Number(data.baseFare) || 3.5,
          distanceRate: Number(data.distanceRate) || 1.3,
          timeRate: Number(data.timeRate) || 0.15,
          waitRatePerMinute: Number(data.waitRatePerMinute) || 0.25,
          minFare: Number(data.minFare) || 5.0,
          commissionRate: Number(data.commissionRate) || 0.12,
          vehicleMultipliers: data.vehicleMultipliers || prev.vehicleMultipliers
        }));
      }
    }, (err) => console.error("onSnapshot ERROR platform_config/rides 2:", err));
    return () => unsub();
  }, []);

  const [favoriteAddresses, setFavoriteAddresses] = useState<any[]>([]);
  const [savingFavorite, setSavingFavorite] = useState<{address: string} | null>(null);
  const [favoriteNameInput, setFavoriteNameInput] = useState("");
  const [showFavoriteSuccess, setShowFavoriteSuccess] = useState<{name: string} | null>(null);

  useEffect(() => {
    if (profile?.favoriteAddresses) setFavoriteAddresses(profile.favoriteAddresses);
  }, [profile]);

  const toggleFavorite = async (address: string, name: string) => {
    if (!user || !address) return;
    const existing = favoriteAddresses.find(f => f.address === address);
    try {
      if (existing) {
        await updateDoc(doc(db, "users", user.uid), {
          favoriteAddresses: arrayRemove(existing)
        });
        toast.success("Removed from saved addresses");
      } else {
        const newFav = { id: Math.random().toString(36).substr(2, 9), name, address };
        await updateDoc(doc(db, "users", user.uid), {
          favoriteAddresses: arrayUnion(newFav)
        });
        toast.success("Saved address");
      }
    } catch (err) {
      toast.error("Failed to update saved addresses");
    }
  };

  const isFavorite = useCallback((addr: string) => {
    return favoriteAddresses.some(f => f.address === addr);
  }, [favoriteAddresses]);

  const handleStarClick = useCallback((addr: string) => {
    if (!addr) return;
    if (isFavorite(addr)) {
      toggleFavorite(addr, "");
    } else {
      setFavoriteNameInput("");
      setSavingFavorite({ address: addr });
    }
  }, [isFavorite, toggleFavorite]);

  const handleSaveFavorite = async () => {
    if (!user || !savingFavorite || !favoriteNameInput.trim()) return;
    try {
      const newFav = { id: Math.random().toString(36).substr(2, 9), name: favoriteNameInput.trim(), address: savingFavorite.address };
      await updateDoc(doc(db, "users", user.uid), {
        favoriteAddresses: arrayUnion(newFav)
      });
      const nameSaved = favoriteNameInput.trim();
      setSavingFavorite(null);
      setFavoriteNameInput("");
      setShowFavoriteSuccess({ name: nameSaved });
      setTimeout(() => {
         setShowFavoriteSuccess(null);
      }, 3000);
    } catch (err) {
      toast.error("Failed to save address");
    }
  };

  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const toggleListening = async () => {
    triggerHaptic(ImpactStyle.Light);
    
    if (isListening) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      
      if (Capacitor.isNativePlatform()) {
        try {
          await SpeechRecognition.stop();
        } catch (e: any) {
          console.error("Native stop error:", e);
        }
        setIsListening(false);
        if (transcriptRef.current.trim().length > 0) {
          processVoiceCommand(transcriptRef.current);
          transcriptRef.current = "";
        }
      } else {
        // Let the onend handler process the current transcript when it fires.
        recognitionRef.current?.stop(); 
      }
      return;
    }

    transcriptRef.current = "";

    if (Capacitor.isNativePlatform()) {
      try {
        // 1. Check if available
        const { available } = await SpeechRecognition.available();
        if (!available) {
          toast.error("Speech recognition is not available or supported on this device.");
          return;
        }

        // 2. Check & Request permissions
        const check = await SpeechRecognition.checkPermissions();
        if (check.speechRecognition !== 'granted') {
          const req = await SpeechRecognition.requestPermissions();
          if (req.speechRecognition !== 'granted') {
            setShowPermissionModal(true);
            return;
          }
        }

        // 3. Setup partial results listener
        if ((window as any)._speechListener) {
          try {
            await (window as any)._speechListener.remove();
          } catch (_) {}
        }
        
        const listener = await SpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
          if (data.matches && data.matches.length > 0) {
            transcriptRef.current = data.matches[0];
            resetSilenceTimer();
          }
        });
        (window as any)._speechListener = listener;

        const resetSilenceTimer = () => {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(async () => {
            try {
              await SpeechRecognition.stop();
            } catch (err) {}
          }, 4000); // Wait 4 seconds of silence before automatically stopping
        };

        // Listen for when it stops
        if ((window as any)._speechStateListener) {
          try {
            await (window as any)._speechStateListener.remove();
          } catch (_) {}
        }
        const stateListener = await SpeechRecognition.addListener('listeningState', (data: { status: 'started' | 'stopped' }) => {
          if (data.status === 'stopped') {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            setIsListening(false);
            
            // Clean up listeners
            if ((window as any)._speechListener) {
              (window as any)._speechListener.remove().catch(() => {});
              (window as any)._speechListener = null;
            }
            if ((window as any)._speechStateListener) {
              (window as any)._speechStateListener.remove().catch(() => {});
              (window as any)._speechStateListener = null;
            }

            if (transcriptRef.current.trim().length > 0) {
              processVoiceCommand(transcriptRef.current);
              transcriptRef.current = "";
            }
          }
        });
        (window as any)._speechStateListener = stateListener;

        setIsListening(true);
        resetSilenceTimer();

        // 4. Start native recorder
        await SpeechRecognition.start({
          language: 'en-GB',
          maxResults: 1,
          partialResults: true,
          popup: false,
        });

      } catch (err: any) {
        console.error("Capacitor Speech Recognition failed:", err);
        toast.error("Capacitor Voice Error: " + (err.message || String(err)));
        setIsListening(false);
      }
    } else {
      // Browser Web Speech API fallback
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        toast.error("Speech recognition not supported in this browser. Please use Google Chrome or Safari.");
        return;
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = "en-GB";
      recognition.continuous = true;
      recognition.interimResults = true;

      const resetSilenceTimer = () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (recognitionRef.current) recognitionRef.current.stop();
        }, 3000); // Wait 3 seconds of silence before automatically stopping
      };

      recognition.onstart = () => {
        setIsListening(true);
        resetSilenceTimer();
      };
      
      recognition.onend = () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        setIsListening(false);
        if (transcriptRef.current.trim().length > 0) {
          processVoiceCommand(transcriptRef.current);
          transcriptRef.current = "";
        }
      };
      
      recognition.onerror = (e: any) => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        const errDetail = e.error || String(e);
        console.error("Browser speech recognition error:", e);
        if (errDetail === 'no-speech') {
          setIsListening(false);
          return;
        }
        if (errDetail === 'aborted') {
          return;
        }
        if (errDetail === 'not-allowed') {
          setShowPermissionModal(true);
        } else {
          toast.error(`Voice Error: ${errDetail}`);
        }
        setIsListening(false);
      };
      
      recognition.onresult = (event: any) => {
        resetSilenceTimer();
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            currentTranscript += event.results[i][0].transcript + ' ';
          }
        }
        if (currentTranscript) {
          transcriptRef.current += currentTranscript;
        }
      };
      
      try {
        recognition.start();
      } catch(e: any) {
        if (e && e.name !== 'InvalidStateError' && !e.message?.includes('already started')) {
          console.error("Speech recognition start error:", e);
          toast.error("Failed to start speech listener.");
        }
        setIsListening(false);
      }
    }
  };

  const geocodeLocation = (address: string, setter: (val: string) => void, coordSetter: (coords: {lat: number, lng: number}) => void) => {
    if (!address || address.trim() === "" || address.toLowerCase() === "uk" || address.toLowerCase() === "united kingdom") return;
    
    if (!window.google || !window.google.maps) {
       setter(address);
       return;
    }
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ 
      address: address,
      componentRestrictions: { country: "GB" }
    }, (results, status) => {
      if (status === "OK" && results && results[0]) {
        const loc = results[0].geometry.location;
        coordSetter({ lat: loc.lat(), lng: loc.lng() });
        
        const isJustCountry = results[0].types.includes('country');
        const formatted = results[0].formatted_address;
        
        if (isJustCountry || formatted === 'United Kingdom' || formatted === 'UK') {
          setter(address);
        } else {
          setter(formatted);
        }
      } else {
        setter(address);
      }
    });
  };

  const handleMarkerDragEnd = async (e: google.maps.MapMouseEvent, type: "pickup" | "dropoff" | "stop", stopIndex?: number) => {
    if (!e.latLng) return;
    const newCoords = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    
    setHasModifiedRouteByUser(true);

    if (type === "pickup") {
      setPickupCoords(newCoords);
    } else if (type === "dropoff") {
      setDropoffCoords(newCoords);
    } else if (type === "stop" && typeof stopIndex === "number") {
      const newStops = [...stops];
      newStops[stopIndex].coords = newCoords;
      setStops(newStops);
    }
    
    if (!window.google || !window.google.maps) return;
    
    try {
      const geocoder = new window.google.maps.Geocoder();
      const response = await geocoder.geocode({ location: newCoords });
      if (response.results[0]) {
        let foundAddr = response.results[0].formatted_address;
        if (type === "pickup") setPickup(foundAddr);
        if (type === "dropoff") setDropoff(foundAddr);
        if (type === "stop" && typeof stopIndex === "number") {
          const newStops = [...stops];
          newStops[stopIndex].address = foundAddr;
          setStops(newStops);
        }
      }
    } catch (err) {
      console.error("Reverse geocoding failed:", err);
    }
  };

  const processVoiceCommand = async (text: string) => {
    setIsAiProcessing(true);
    toast.info("AI extracting details...");
    try {
      let locationContext = "";
      if (pickup) {
         locationContext += `The user is currently near: ${pickup}. `;
      }
      if (pickupCoords) {
         locationContext += `Coordinates: ${pickupCoords.lat}, ${pickupCoords.lng}. `;
      }

      const result = await processTaxiVoiceCommand(text, locationContext);

      if (result.pickup) geocodeLocation(result.pickup, setPickup, setPickupCoords);
      if (result.dropoff) geocodeLocation(result.dropoff, setDropoff, setDropoffCoords);
      if (result.comments) setComments(result.comments);
      
      toast.success("AI extraction complete. Please review and verify the addresses.", { duration: 5000 });
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      if (!(errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("rate limit"))) {
        console.error("AI Error:", err);
      }
      
      if (errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("rate limit")) {
        toast.error("Daily AI usage limit reached. Please type your address manually.", { duration: 6000 });
      } else {
        toast.error("AI error. Try typing.", { duration: 4000 });
      }
    } finally {
      setIsAiProcessing(false);
    }
  };

  const [suggestions, setSuggestions] = useState<{label: string, lat?: number, lon?: number, placeId?: string, placePrediction?: any, isHistory?: boolean, distance?: string}[]>([]);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [pastRides, setPastRides] = useState<any[]>([]);
  const [pastAddresses, setPastAddresses] = useState<{label: string, lat?: number, lon?: number}[]>([]);

  useEffect(() => {
    if (activeField && bottomSheetRef.current && detailsView === "address") {
      setTimeout(() => {
        bottomSheetRef.current?.scrollTo({ top: bottomSheetRef.current.scrollHeight, behavior: 'smooth' });
      }, 300); // Wait for suggestions to render/expand
    }
  }, [activeField, suggestions.length, detailsView]);

  useEffect(() => {
    if (!user) return;
    const fetchHistory = async () => {
      try {
        const q = query(collection(db, "ride_requests"), where("riderId", "==", user.uid), orderBy("createdAt", "desc"), limit(40));
        const res = await getDocs(q);
        const rides = res.docs.map(doc => doc.data());
        setPastRides(rides);
        
        const map = new Map<string, {label: string, lat: number, lon: number}>();
        rides.forEach(d => {
          if (d.pickup && d.pickupLat && d.pickupLng) map.set(d.pickup, {label: d.pickup, lat: d.pickupLat, lon: d.pickupLng});
          if (d.dropoff && d.dropoffLat && d.dropoffLng) map.set(d.dropoff, {label: d.dropoff, lat: d.dropoffLat, lon: d.dropoffLng});
          if (d.stops) {
            d.stops.forEach((s: any) => {
              if (s.address && s.coords?.lat && s.coords?.lng) {
                 map.set(s.address, {label: s.address, lat: s.coords.lat, lon: s.coords.lng});
              }
            });
          }
        });
        
        setPastAddresses(Array.from(map.values()));
      } catch (e) {
        console.error("Error fetching history", e);
      }
    };
    fetchHistory();
  }, [user]);

  useEffect(() => {
    if (!isLoaded) return;
    let val = "";
    if (activeField === "pickup") val = pickup;
    else if (activeField === "dropoff") val = dropoff;
    else if (activeField?.startsWith("stop-")) {
      const idx = parseInt(activeField.split('-')[1]);
      val = stops[idx]?.address || "";
    }
    
    if (!val || val.length < 3) { 
      const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
          const R = 3958.8; // Radius of Earth in miles
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLon = (lon2 - lon1) * Math.PI / 180;
          const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          return R * c;
      };

      let smartMatches: any[] = [];
      const userLat = passengerPos?.lat || mapCenter?.lat || 53.6458;
      const userLng = passengerPos?.lng || mapCenter?.lng || -1.7850;

      if (activeField === "pickup") {
        // Suggest past pickup addresses near current location (within 5 miles)
        const nearbyPickups = new Map<string, any>();
        pastRides.forEach(r => {
          if (r.pickup && r.pickupLat && r.pickupLng) {
            const dist = calculateDistance(userLat, userLng, r.pickupLat, r.pickupLng);
            if (dist <= 5) {
              if (!nearbyPickups.has(r.pickup)) {
                nearbyPickups.set(r.pickup, { label: r.pickup, lat: r.pickupLat, lon: r.pickupLng, dist, count: 1 });
              } else {
                nearbyPickups.get(r.pickup)!.count++;
              }
            }
          }
        });
        smartMatches = Array.from(nearbyPickups.values()).sort((a, b) => b.count - a.count || a.dist - b.dist).slice(0, 2);
      } else if (activeField === "dropoff") {
        // Suggest dropoffs associated with the current pickup location, or nearby
        const pLat = pickupCoords?.lat || userLat;
        const pLng = pickupCoords?.lng || userLng;
        const commonDropoffs = new Map<string, any>();
        
        pastRides.forEach(r => {
          if (r.pickupLat && r.pickupLng && r.dropoff && r.dropoffLat && r.dropoffLng) {
            const pDist = calculateDistance(pLat, pLng, r.pickupLat, r.pickupLng);
            if (pDist <= 5) {
               const dDist = calculateDistance(pLat, pLng, r.dropoffLat, r.dropoffLng); 
               if (dDist > 0.5) { // not same as pickup
                  if (!commonDropoffs.has(r.dropoff)) {
                     commonDropoffs.set(r.dropoff, { label: r.dropoff, lat: r.dropoffLat, lon: r.dropoffLng, count: 1 });
                  } else {
                     commonDropoffs.get(r.dropoff)!.count++;
                  }
               }
            }
          }
        });
        
        smartMatches = Array.from(commonDropoffs.values()).sort((a, b) => b.count - a.count).slice(0, 2);
        
        // Fallback to recent dropoffs if none matched
        if (smartMatches.length === 0) {
           const allDropoffs = new Map<string, any>();
           pastRides.forEach(r => {
             if (r.dropoff && r.dropoffLat && r.dropoffLng) {
               if (!allDropoffs.has(r.dropoff)) {
                 allDropoffs.set(r.dropoff, { label: r.dropoff, lat: r.dropoffLat, lon: r.dropoffLng, order: pastRides.indexOf(r) });
               }
             }
           });
           smartMatches = Array.from(allDropoffs.values()).sort((a, b) => a.order - b.order).slice(0, 2);
        }
      }

      if (smartMatches.length === 0 && pastAddresses.length > 0) {
         smartMatches = pastAddresses.filter(p => !val || p.label.toLowerCase().includes(val.toLowerCase())).slice(0, 2);
      }

      let finalSmart = smartMatches.map(p => ({ label: p.label, lat: p.lat, lon: p.lon, isHistory: true }));
      if (activeField === "dropoff" && pickup) {
         finalSmart = finalSmart.filter(s => !s.label.toLowerCase().includes(pickup.toLowerCase().split(',')[0]));
      } else if (activeField === "pickup" && dropoff) {
         finalSmart = finalSmart.filter(s => !s.label.toLowerCase().includes(dropoff.toLowerCase().split(',')[0]));
      }

      setSuggestions(finalSmart);
      return; 
    }

      const fetchSuggestions = async () => {
      setIsLoadingAddress(true);
      
      const historyMatches = pastAddresses.filter(p => p.label.toLowerCase().includes(val.toLowerCase())).slice(0, 3).map(p => ({...p, isHistory: true}));

      try {
        if (!window.google || !window.google.maps) {
          throw new Error("Google Maps not loaded. Check API Key or libraries.");
        }

        let predictions: any[] = [];
        const userLat = passengerPos?.lat || mapCenter?.lat || 53.6458;
        const userLng = passengerPos?.lng || mapCenter?.lng || -1.7850;

        try {
          const { AutocompleteSuggestion } = await window.google.maps.importLibrary("places") as any;
          const request = {
            input: val,
            includedRegionCodes: ['GB'],
            locationBias: {
              center: { lat: userLat, lng: userLng },
              radius: 50000
            },
            origin: { lat: userLat, lng: userLng }
          };
          const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
          predictions = res.suggestions || [];
        } catch (newApiError: any) {
          console.warn("New Places API fetch failed, trying classic AutocompleteService fallback:", newApiError);
          const classicService = new window.google.maps.places.AutocompleteService();
          const request = {
            input: val,
            componentRestrictions: { country: 'gb' },
            location: new window.google.maps.LatLng(userLat, userLng),
            radius: 50000
          };
          predictions = await new Promise<any[]>((resolve) => {
            classicService.getPlacePredictions(request as any, (classicPredictions, status) => {
              if (status === window.google.maps.places.PlacesServiceStatus.OK && classicPredictions) {
                resolve(classicPredictions.map((cp: any) => ({
                  placePrediction: {
                    text: { text: cp.description },
                    placeId: cp.place_id,
                    distanceMeters: undefined
                  }
                })));
              } else {
                resolve([]);
              }
            });
          });
        }

        setIsLoadingAddress(false);
        let finalSuggestions: any[] = [];
        
        if (predictions && predictions.length > 0) {
          // Sort predictions by distanceMeters if available
          const sortedPredictions = [...predictions].sort((a: any, b: any) => {
            const distA = a.placePrediction.distanceMeters ?? 9999999;
            const distB = b.placePrediction.distanceMeters ?? 9999999;
            return distA - distB;
          });
          
          const cleaned = sortedPredictions.map((p: any) => {
            const text = p.placePrediction.text.text;
            const dist = p.placePrediction.distanceMeters;
            const distStr = dist ? `${(dist / 1609.34).toFixed(1)} mi` : "";
            return {
              label: text,
              distance: distStr,
              placeId: p.placePrediction.placeId,
              placePrediction: p.placePrediction // Save the raw prediction object to use toPlace() later
            };
          });
          
          // Deduplicate based on label
          const uniqueCleaned = cleaned.filter((c: any) => !historyMatches.some(h => h.label.toLowerCase() === c.label.toLowerCase()));
          
          finalSuggestions = [...historyMatches, ...uniqueCleaned];
        } else {
          finalSuggestions = historyMatches;
        }

        if (activeField === "dropoff" && pickup) {
           finalSuggestions = finalSuggestions.filter(s => !s.label.toLowerCase().includes(pickup.toLowerCase().split(',')[0]));
        } else if (activeField === "pickup" && dropoff) {
           finalSuggestions = finalSuggestions.filter(s => !s.label.toLowerCase().includes(dropoff.toLowerCase().split(',')[0]));
        }

        // Hide suggestions if the exact same address is already typed in
        if (finalSuggestions.length === 1 && finalSuggestions[0].label.trim().toLowerCase() === val.trim().toLowerCase()) {
            finalSuggestions = [];
        } else if (finalSuggestions.length > 0 && finalSuggestions[0].label.trim().toLowerCase() === val.trim().toLowerCase() && finalSuggestions[0].isHistory === false) {
            // Remove exact match from suggestions to avoid annoyance
            finalSuggestions = finalSuggestions.filter(s => s.label.trim().toLowerCase() !== val.trim().toLowerCase());
        }

        setSuggestions(finalSuggestions);
      } catch (err: any) {
        console.error("Google Places Exception:", err);
        import("sonner").then(({ toast }) => toast.error(`Map Error: ${err.message}`));
        setSuggestions(historyMatches);
        setIsLoadingAddress(false);
      }
    };

    const debounce = setTimeout(fetchSuggestions, 500);
    return () => clearTimeout(debounce);
  }, [pickup, dropoff, stops, activeField, mapCenter, isLoaded]);

  const handleDetectLocation = () => {
    triggerHaptic(ImpactStyle.Light);
    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      
      if (accuracy > 100) {
        toast.warning(`GPS accuracy too low (${Math.round(accuracy)}m). Please enter manually for better precision.`);
        setIsDetecting(false);
        setActiveField("pickup");
        return;
      }
      
      if (accuracy > 30) {
        toast.info(`Adjust location slightly on map if needed (Accuracy: ${Math.round(accuracy)}m)`);
      }
      
      const c = { lat: latitude, lng: longitude };
      setMapCenter(c);
      setPickupCoords(c);
      setMapZoom(16);

      if (!window.google || !window.google.maps) {
        toast.error("Google Maps API not loaded. Please try again in a moment.");
        setIsDetecting(false);
        return;
      }

      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: c }, (results, status) => {
        setIsDetecting(false);
        if (status === "OK" && results && results[0]) {
          const res = results[0];
          let addr = res.formatted_address;
          const postcode = res.address_components.find((c: any) => c.types.includes("postal_code"))?.long_name;
          if (postcode && !addr.includes(postcode)) {
            addr += `, ${postcode}`;
          }
          setPickup(addr);
          setSuggestions([]);
          
          setActiveField(null);
          if (addr && dropoff) {
            setDetailsView("vehicle");
          } else if (addr && !dropoff) {
            setTimeout(() => {
              setActiveField("dropoff");
              dropoffInputRef.current?.focus();
            }, 100);
          }
        }
      });
    }, (err) => {
      let msg = "Failed to detect location.";
      if (err.code === 1) msg = "Location permission denied. Please allow location access in your device settings.";
      if (err.code === 2) msg = "Location unavailable. Please check your GPS/network.";
      if (err.code === 3) msg = "Location request timed out. Please try again.";
      toast.error(msg);
      setIsDetecting(false);
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };

  const [driverPos, setDriverPos] = useState<{lat: number, lng: number} | null>(null);
  const [passengerPos, setPassengerPos] = useState<{lat: number, lng: number} | null>(null);

  const getComputedFare = (catId: string) => {
    const defaultMultipliers: Record<string, number> = {
      standard: 1.0, executive: 1.5, luxury: 2.2, '6seater': 1.4, '8seater': 2.0, wav: 2.5
    };
    const catMultiplier = fareConfig.vehicleMultipliers?.[catId] || defaultMultipliers[catId] || 1.0;
    const base = fareEstimate || 5.0;
    let finalFare = Math.max(base * catMultiplier, fareConfig.minFare * catMultiplier);
    
    // Apply Surge
    if (activeSurge.isFixed) {
       finalFare += activeSurge.fee;
    } else {
       finalFare *= activeSurge.multiplier;
    }
    
    return finalFare;
  };

  const searchingStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isChatOpen) setUnreadChatCount(0);
  }, [isChatOpen]);

  useEffect(() => {
    if (!currentRideId || step !== "confirmed" || !user) return;
    
    const q = query(
      collection(db, "ride_requests", currentRideId, "chat"),
      orderBy("createdAt", "asc")
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      const remoteMessages = messages.filter(m => m.senderId !== user.uid);
      const latestMsg = remoteMessages[remoteMessages.length - 1];

      if (latestMsg && latestMsg.id !== lastPopupMessageIdRef.current) {
        lastPopupMessageIdRef.current = latestMsg.id;
        playSound('notification');
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        
        if (Capacitor.isNativePlatform()) {
          try {
            LocalNotifications.requestPermissions().then((perm) => {
              if (perm.display === 'granted') {
                LocalNotifications.schedule({
                  notifications: [
                    {
                      title: "New Message from Driver",
                      body: latestMsg.text,
                      id: new Date().getTime(),
                      schedule: { at: new Date(Date.now() + 100) },
                      sound: undefined,
                      attachments: undefined,
                      actionTypeId: "",
                      extra: null
                    }
                  ]
                }).catch(e => console.warn("LocalNotifications error:", e));
              }
            }).catch(e => console.warn("LocalNotifications error:", e));
          } catch (e) {
             console.warn("LocalNotifications error:", e);
          }
        }
        
        if (!isChatOpen) {
          setIncomingPopupMessage({ id: latestMsg.id, text: latestMsg.text });
        }
      }
      
      if (isChatOpen) {
        lastSeenChatCountRef.current = remoteMessages.length;
        setUnreadChatCount(0);
        setIncomingPopupMessage(null);
      } else {
        const unread = remoteMessages.length - lastSeenChatCountRef.current;
        if (unread > 0) {
          setUnreadChatCount(unread);
        }
      }
    }, (err) => console.error("onSnapshot ERROR chat:", err));
    return () => unsub();
  }, [currentRideId, step, user, isChatOpen]);

  const handleConfirmBooking = async () => {
    triggerHaptic(ImpactStyle.Heavy);
    hideNativeKeyboard();
    if (!user) return;
    
    // Check pending charges logic
    const pendingCharges = profile?.pendingCharges || 0;
    const cancellationCount = profile?.cancellationCount || 0;
    
    if (cancellationCount >= 2 && pendingCharges > 0) {
      toast.error(`Account Hold: You have £${pendingCharges.toFixed(2)} in unpaid cancellation fees. Please pay the outstanding balance to book another ride.`);
      return;
    }
    
    if (pendingCharges > 0) {
      const reason = profile?.pendingChargesReason || "unpaid balance / fees";
      toast.error(`Please pay your outstanding balance of £${pendingCharges.toFixed(2)} to book a new ride.`);
      return;
    }

    const isUpdatingActiveRide = assignedDriverInfo && (assignedDriverInfo.status === 'accepted' || assignedDriverInfo.status === 'arrived' || assignedDriverInfo.status === 'in_progress');

    if (isUpdatingActiveRide) {
      setStep("confirmed");
      toast.success("Ride Updated", { description: "Your driver has been notified of the changes." });
    } else {
      setStep("searching");
      searchingStartTimeRef.current = Date.now();
    }
    
    try {
      const rideData = {
        riderId: user.uid,
        passengerName: profile?.firstName || "Passenger",
        passengerPhone: profile?.phone || profile?.phoneNumber || "",
        pickup: houseNumber ? `${houseNumber} ${pickup}` : pickup,
        pickupLat: pickupCoords?.lat || mapCenter.lat,
        pickupLng: pickupCoords?.lng || mapCenter.lng,
        dropoff,
        dropoffLat: dropoffCoords?.lat,
        dropoffLng: dropoffCoords?.lng,
        stops: stops.filter(s => s.coords !== null),
        distanceMiles: Number(distanceMiles.toFixed(1)),
        durationMinutes: Number(durationMinutes.toFixed(0)),
        fareEstimate: getComputedFare(selectedCategory) + (isPriority ? 3 : 0) + (isPetFriendly ? 3 : 0),
        baseCalc: fareEstimate || 5.0,
        surgeMultiplier: activeSurge.multiplier, 
        surgeModel: activeSurge.isFixed ? 'fixed' : 'multiplier',
        surgeFixedAmount: activeSurge.fee,
        carCategory: selectedCategory,
        isPetFriendly,
        isPriority,
        waitTolerance,
        comments,
        status: isUpdatingActiveRide ? assignedDriverInfo.status : "pending",
        hasCardOnFile: !!profile?.stripeCustomerId,
        currency: "GBP",
        handshakeCode: (profile?.phone || profile?.phoneNumber || "").replace(/\D/g, "").slice(-4) || Math.floor(1000 + Math.random() * 9000).toString(),
        requirePasscode: profile?.requirePasscode === true,
      };
      
      const activeId = editId || currentRideId;
      if (activeId) {
         await updateDoc(doc(db, "ride_requests", activeId), { ...rideData, updatedAt: serverTimestamp(), isModifiedByPassenger: true });
         setCurrentRideId(activeId);
      } else {
         const docRef = await addDoc(collection(db, "ride_requests"), { ...rideData, createdAt: serverTimestamp() });
         setCurrentRideId(docRef.id);
      }
    } catch (err) { setStep("details"); }
  };

  const handleTogglePriorityClick = () => {
    if (!currentRideId) return;
    if (!isPriority) {
      setShowPriorityPrompt(true);
    } else {
      confirmTogglePriority(false);
    }
  };

  const confirmTogglePriority = async (newPriority: boolean) => {
    if (!currentRideId) return;
    try {
      setIsPriority(newPriority);
      await updateDoc(doc(db, "ride_requests", currentRideId), {
         isPriority: newPriority,
         fareEstimate: increment(newPriority ? 3 : -3)
      });
      setShowPriorityPrompt(false);
      if (!newPriority) {
        setPriorityInlineToast({ message: "Priority Boost removed.", type: "info" });
        setTimeout(() => setPriorityInlineToast(null), 3000);
      }
    } catch (e) {
      console.error(e);
      setIsPriority(!newPriority);
      toast.error("Failed to update priority");
    }
  };

  const handleCancelSearching = async () => {
    if (currentRideId) {
      await updateDoc(doc(db, "ride_requests", currentRideId), { status: "draft" });
    }
    setStep("details");
    // Do not clear currentRideId here, just let them edit
  };

  const simulateDriverAccepts = async () => {
    if (!currentRideId) return;
    try {
      const simData = {
        status: "accepted",
        driverId: "sim-driver-123",
        driverName: "Sim Driver",
        driverPhone: "07700900000",
        vehicleInfo: "Silver Toyota",
        vehiclePlate: "SIM 123",
        driverRequirePasscode: false,
        acceptedAt: serverTimestamp(),
      };
      
      // Force local optimistic UI update to bypass snapshot delay issues
      setAssignedDriverInfo((prev: any) => ({
         uid: simData.driverId, 
         name: simData.driverName, 
         vehicle: simData.vehicleInfo, 
         plate: simData.vehiclePlate,
         code: "---", 
         requirePasscode: false,
         phone: simData.driverPhone, 
         status: "accepted",
         fareEstimate: fareEstimate || 0,
         rating: "5.0",
         acceptedAt: Date.now(),
         isFinishingTrip: false,
         stackedDriverDelay: undefined
      }));
      setStep("confirmed");
      triggerHaptic(ImpactStyle.Heavy);
      playSound('success');
      setShowDriverFoundOverlay(true);

      await updateDoc(doc(db, "ride_requests", currentRideId), simData);
      if (pickupCoords) {
        await setDoc(doc(db, "live_tracking", "sim-driver-123"), {
           lat: pickupCoords.lat - 0.003,
           lng: pickupCoords.lng - 0.003,
           updatedAt: serverTimestamp(),
           isOnline: true
        });
      }
      toast.success("Simulated match!");
    } catch(err) {
      console.error(err);
    }
  };

  const simulateNextState = async () => {
    if (!currentRideId || !assignedDriverInfo) return;
    const currentStatus = assignedDriverInfo.status;
    let nextStatus = "arrived";
    if (currentStatus === "accepted") nextStatus = "arrived";
    else if (currentStatus === "arrived") nextStatus = "in_progress";
    else if (currentStatus === "in_progress") {
       nextStatus = profile?.stripeCustomerId ? "completed" : "awaiting_payment";
    }
    else if (currentStatus === "awaiting_payment" || currentStatus === "awaiting_cash_confirm") {
      nextStatus = "completed";
    }

    try {
      const rideDoc = await getDoc(doc(db, "ride_requests", currentRideId));
      const rideData = rideDoc.exists() ? rideDoc.data() : null;

      const updateData: any = { status: nextStatus };
      
      // Optimistic updates
      if (nextStatus === "arrived") {
         updateData.arrivedAt = serverTimestamp();
         setAssignedDriverInfo((prev: any) => prev ? { ...prev, status: "arrived", arrivedAt: Date.now() } : null);
         triggerHaptic(ImpactStyle.Heavy);
         playSound('notification');
         if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 500]);
         toast.success("Your driver has arrived!", { duration: 8000, position: "top-center" });
      }
      if (nextStatus === "in_progress") {
         updateData.startedAt = serverTimestamp();
         
         let waitSeconds = 0;
         if (rideData && rideData.arrivedAt) {
            const arrivedTime = rideData.arrivedAt.seconds ? rideData.arrivedAt.seconds * 1000 : (typeof rideData.arrivedAt.toMillis === 'function' ? rideData.arrivedAt.toMillis() : rideData.arrivedAt);
            const elapsed = Math.floor((Date.now() - arrivedTime) / 1000);
            if (elapsed > freeWaitSeconds) {
               waitSeconds = elapsed - freeWaitSeconds;
            }
         }
         updateData.paidWaitSeconds = (rideData?.paidWaitSeconds || 0) + waitSeconds;

         setAssignedDriverInfo((prev: any) => prev ? { ...prev, status: "in_progress", startedAt: Date.now(), paidWaitSeconds: updateData.paidWaitSeconds } : null);
         playSound('notification');
      }
      if (nextStatus === "awaiting_payment") {
         updateData.paymentUrl = "https://example.com/pay";
         setAssignedDriverInfo((prev: any) => prev ? { ...prev, status: "awaiting_payment", paymentUrl: updateData.paymentUrl } : null);
         playSound('notification');
      }
      if (nextStatus === "completed") {
         updateData.completedAt = serverTimestamp();
         updateData.paymentMethod = profile?.stripeCustomerId ? "stripe_auto" : "stripe_qr";
         if (rideData) {
            let waitSeconds = 0;
            if (rideData.arrivedAt && !rideData.startedAt) {
               // Fast forward simulation without in_progress
               const arrivedTime = rideData.arrivedAt.seconds ? rideData.arrivedAt.seconds * 1000 : (typeof rideData.arrivedAt.toMillis === 'function' ? rideData.arrivedAt.toMillis() : rideData.arrivedAt);
               const elapsed = Math.floor((Date.now() - arrivedTime) / 1000);
               if (elapsed > freeWaitSeconds) {
                  waitSeconds = elapsed - freeWaitSeconds;
               }
            }
            const finalWaitSeconds = (rideData.paidWaitSeconds || updateData.paidWaitSeconds || 0) + waitSeconds;
            updateData.paidWaitSeconds = finalWaitSeconds;
            
            const waitFare = (finalWaitSeconds / 60) * fareConfig.waitRatePerMinute;
            updateData.finalFare = (rideData.fareEstimate || fareConfig.baseFare) + waitFare + (rideData.tipAmount || 0) + (rideData.cancellationFee || 0);
         }
         
         const completedData = {
           status: "completed",
           id: currentRideId,
           ...rideData,
           ...updateData,
         };
         if (updateData.completedAt) completedData.completedAt = { toMillis: () => Date.now() };

         setCompletedRideData(completedData);
         setStep("receipt"); 
         setCurrentRideId(null); 
         setAssignedDriverInfo(null); 
         hasTriggeredTipModalRef.current = false;
         setShowTipModal(false);

         // Also clear passenger fees on simulation to mimic driver side clearing
         if (profile?.uid) {
           await updateDoc(doc(db, "users", profile.uid), {
             pendingCharges: 0,
             cancellationCount: 0,
             abandonmentStrikes: 0
           });
         }
      }
      
      await updateDoc(doc(db, "ride_requests", currentRideId), updateData);
    } catch(err: any) { 
       console.error("simulateNextState error:", err); 
       toast.error("Error: " + err.message); 
    }
  };

  const handleAbandonSearch = async () => {
    setShowAbandonPrompt(false);
    if (!currentRideId) return;

    try {
      await updateDoc(doc(db, "ride_requests", currentRideId), { 
        status: "cancelled", 
        cancelledBy: "passenger", 
        cancellationFee: 0,
        cancelledAt: serverTimestamp() 
      });

      clearBookingInputsAndState();
      toast.success("Ride cancelled.");
      navigate("/my-rides");
    } catch (err) {
      console.error("Cancel failed", err);
      toast.error("Failed to cancel ride.");
    }
  };

  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [showAbandonPrompt, setShowAbandonPrompt] = useState(false);
  const [showDriverFoundOverlay, setShowDriverFoundOverlay] = useState(false);
  const [driverFoundCountdown, setDriverFoundCountdown] = useState(10);
  const [cancelFeeToApply, setCancelFeeToApply] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showDriverFoundOverlay) {
      setDriverFoundCountdown(10);
      timer = setInterval(() => {
        setDriverFoundCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setShowDriverFoundOverlay(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showDriverFoundOverlay]);

  const handleKeepWaiting = async () => {
    if (!currentRideId) return;
    try {
      await updateDoc(doc(db, "ride_requests", currentRideId), {
        stackedDriverDelay: deleteField()
      });
      setAssignedDriverInfo((prev: any) => prev ? { ...prev, stackedDriverDelay: undefined } : null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFindAnotherDriver = async () => {
     if (!currentRideId) return;
     try {
       await updateDoc(doc(db, "ride_requests", currentRideId), {
          status: "pending",
          driverId: deleteField(),
          assignedDriverId: deleteField(),
          driverName: deleteField(),
          driverPhone: deleteField(),
          vehicleInfo: deleteField(),
          vehiclePlate: deleteField(),
          acceptedAt: deleteField(),
          stackedDriverDelay: deleteField(),
          updatedAt: serverTimestamp()
       });
       setAssignedDriverInfo(null);
       setStep("searching");
       searchingStartTimeRef.current = Date.now();
     } catch (err) {
       console.error(err);
     }
  };

  const handleCancelConfirmed = async () => {
    if (!currentRideId) return;

    let fee = 0;
    const limitMins = remoteConfig?.driverWaitTimeLimitMins ?? 5;
    const maxWaitSeconds = limitMins * 60;
    const freeWaitSeconds = Math.max(60, maxWaitSeconds - 120);

    if (assignedDriverInfo?.status === "arrived" && assignedDriverInfo?.arrivedAt) {
      const elapsedArrived = Math.floor((Date.now() - assignedDriverInfo.arrivedAt) / 1000);
      if (elapsedArrived >= freeWaitSeconds) {
        fee = fareConfig.baseFare;
      }
    } else if (assignedDriverInfo?.acceptedAt) {
      const diffMs = Date.now() - assignedDriverInfo.acceptedAt;
      if (diffMs > 120000) { // 2 minutes
        fee = fareConfig.baseFare; 
      }
    }

    if (!showCancelPrompt) {
        setCancelFeeToApply(fee);
        setShowCancelPrompt(true);
        return; 
    }

    try {
      await updateDoc(doc(db, "ride_requests", currentRideId), {
        status: "cancelled",
        cancelledBy: "passenger",
        cancellationFee: fee,
        cancelledAt: serverTimestamp()
      });
      
      if (fee > 0 && user) {
        await updateDoc(doc(db, "users", user.uid), {
           pendingCharges: increment(fee),
           cancellationCount: increment(1)
        });
      }

      clearBookingInputsAndState();
      setShowCancelPrompt(false);
      toast.success("Ride cancelled.");
      navigate("/my-rides");
    } catch (err) {
      console.error(err);
      toast.error("Failed to cancel ride.");
    }
  };

  const handleSendQuickMessage = async (text: string) => {
    if (!currentRideId || !user || disabledQuickMessages.includes(text)) return;
    try {
      await addDoc(collection(db, "ride_requests", currentRideId, "chat"), {
        text,
        senderId: user.uid,
        createdAt: serverTimestamp()
      });
      toast.success("Sent");
      
      setDisabledQuickMessages(prev => [...prev, text]);
      setTimeout(() => {
        setDisabledQuickMessages(prev => prev.filter(m => m !== text));
      }, 120000);

      // Trigger remote FCM push notification to driver
      if (assignedDriverInfo?.driverId) {
        fetch("/api/chat-push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientId: assignedDriverInfo.driverId,
            title: "New Message from Passenger",
            body: text,
            rideId: currentRideId
          })
        }).catch(err => console.error("FCM API error:", err));
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to send");
    }
  };

  const handleAddTip = async (amount: number) => {
    if (currentRideId) {
       await updateDoc(doc(db, "ride_requests", currentRideId), { tipAmount: amount, tipAddedAt: serverTimestamp() });
       toast.success(amount > 0 ? `Tip added successfully!` : "Tip skipped.");
    }
    setShowTipModal(false);
  };

  const submitTipInline = async () => {
    setIsAddingTip(true);
    const finalAmount = selectedTip || (customTip ? parseFloat(customTip) : 0);
    if (finalAmount > 0) {
        await handleAddTip(finalAmount);
    }
    setTimeout(() => {
        setIsAddingTip(false);
        // Optionally reset selection after success
        // setSelectedTip(null);
        // setCustomTip("");
    }, 2000);
  };

  const [driverDispatchIntervalId, setDriverDispatchIntervalId] = useState<NodeJS.Timeout | null>(null);

  // Auto-Dispatch Engine Effect
  useEffect(() => {
    if (step !== "searching" || !currentRideId || !pickupCoords || fareConfig.autoDispatchEnabled !== true) return;

    let dispatchInterval: NodeJS.Timeout;

    const runDispatch = async () => {
       const rideRef = doc(db, "ride_requests", currentRideId);
       const rideDoc = await getDoc(rideRef);
       if (!rideDoc.exists()) return;
       const rideInfo = rideDoc.data();
       
       if (rideInfo.status !== "pending") {
          // If status is "offered", wait until timeout passes
          if (rideInfo.status === "offered" && rideInfo.offerExpiresAt) {
             if (Date.now() > rideInfo.offerExpiresAt) {
                // Timeout! Update it back to pending and decline this driver
                await runTransaction(db, async (t) => {
                  const latestDoc = await t.get(rideRef);
                  if (latestDoc.exists() && latestDoc.data().status === "offered") {
                    t.update(rideRef, {
                      status: "pending",
                      assignedDriverId: deleteField(),
                      offerExpiresAt: deleteField(),
                      declinedBy: arrayUnion(rideInfo.assignedDriverId)
                    });
                  }
                });
             }
          }
          return; // Wait for next tick
       }

       // Ride is "pending". Let's find the best driver logically.
        const q = query(collection(db, "live_tracking"), where("isOnline", "==", true));
        const snapshot = await getDocs(q);
        const declinedBy = rideInfo.declinedBy || [];
        console.log(`[AnyRoller Dispatch] Checking dispatch for ride:${currentRideId}. Found ${snapshot.size} online driver(s) in live_tracking database.`);

       let bestDriver: any = null;
       let bestDistance = Infinity;

       snapshot.forEach(docSnap => {
          const driver = docSnap.data();
          if (docSnap.id === user?.uid) return; // Passenger can't be own driver
          if (declinedBy.includes(docSnap.id)) return; // Already declined or timed out


          
          // Category check logic
          const cats = driver.vehicleCategories || [driver.vehicleCategory || 'standard'];
          if (!cats.includes(selectedCategory)) return;

          // Stacking & Last Job logic
          if (driver.isLastJob) return; // Never dispatch if it's their last job
          
          if (driver.status !== "available") { // e.g. on_ride
             if (driver.status === "on_ride" && driver.isStackingEnabled) {
                // We can stack. But only if we have their dropoff coordinates to compute ETA/Distance
                if (!driver.dropoffLat || !driver.dropoffLng) return;
             } else {
                return; // Busy and not stackable
             }
          }

          // Distance logic (either from current location or future dropoff location)
          const startLat = driver.status === "on_ride" ? driver.dropoffLat : driver.lat;
          const startLng = driver.status === "on_ride" ? driver.dropoffLng : driver.lng;
          
          if (!startLat || !startLng) return;

          const R = 3958.8; // miles
          const dist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
             const rLat1 = lat1 * Math.PI / 180;
             const rLat2 = lat2 * Math.PI / 180;
             const deltaLat = (lat2 - lat1) * Math.PI / 180;
             const deltaLng = (lon2 - lon1) * Math.PI / 180;
             const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) + Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
             const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
             return R * c;
          };

          const d = dist(startLat, startLng, pickupCoords.lat, pickupCoords.lng);

          const radius = fareConfig.dispatchRadiusMiles || 15;
          if (d > radius) return;

          // Destination Mode Logic
          // If the driver is heading home, the ride's dropoff must be closer to their home than the pickup
          if (driver.destinationModeActive && driver.homeLat && driver.homeLng && dropoffCoords) {
             const distToHomeFromPickup = dist(pickupCoords.lat, pickupCoords.lng, driver.homeLat, driver.homeLng);
             const distToHomeFromDropoff = dist(dropoffCoords.lat, dropoffCoords.lng, driver.homeLat, driver.homeLng);
             
             // If this ride takes them further away from home, skip this driver
             if (distToHomeFromDropoff > distToHomeFromPickup) {
                 return;
             }
          }

          // Working Zone filter
          if (driver.zoneEnabled && driver.zoneMaxDistance > 0 && driver.homeLat && driver.homeLng) {
             const distPickupToHome = dist(pickupCoords.lat, pickupCoords.lng, driver.homeLat, driver.homeLng);
             if (distPickupToHome > driver.zoneMaxDistance) {
                 return;
             }
             if (dropoffCoords) {
                 const distDropoffToHome = dist(dropoffCoords.lat, dropoffCoords.lng, driver.homeLat, driver.homeLng);
                 if (distDropoffToHome > driver.zoneMaxDistance) {
                     return;
                 }
             }
          }

          // Match closest driver within the radius limit
          if (d < bestDistance) {
            bestDistance = d;
            bestDriver = docSnap.id;
          }
       });

       if (!bestDriver && declinedBy.length > 0) {
           console.log(`[AnyRoller Dispatch] No eligible driver found but some have declined. Resetting declinedBy logic to re-ping available drivers.`);
           await updateDoc(rideRef, { declinedBy: deleteField() });
           return;
       }

       // QUEUE PRIORITY SYSTEM:
       // Check if there are other pending jobs older than ours
       if (bestDriver) {
           const pendingQuery = query(collection(db, "ride_requests"), where("status", "==", "pending"));
           const pendingSnaps = await getDocs(pendingQuery);
           let shouldYield = false;
           pendingSnaps.forEach(snap => {
              if (snap.id !== currentRideId) {
                 const otherData = snap.data();
                 if (otherData.createdAt?.toMillis && rideInfo.createdAt?.toMillis) {
                    const otherAgeMs = Date.now() - otherData.createdAt.toMillis();
                    if (otherAgeMs < 1 * 60 * 1000 && otherData.createdAt.toMillis() < rideInfo.createdAt.toMillis()) {
                       // There is an older job. Let's see if it's close enough that the driver could take it instead.
                       const oldPickupLat = otherData.pickupLat;
                       const oldPickupLng = otherData.pickupLng;
                       if (oldPickupLat && oldPickupLng) {
                           // If the older job is within 5 miles of us, we yield to give them priority
                           const distToOther = (lat1: number, lon1: number, lat2: number, lon2: number) => {
                              const rLat1 = lat1 * Math.PI / 180;
                              const rLat2 = lat2 * Math.PI / 180;
                              return 3958.8 * 2 * Math.asin(Math.sqrt(Math.sin((lat2-lat1)*Math.PI/180/2)**2 + Math.cos(rLat1)*Math.cos(rLat2)*Math.sin((lon2-lon1)*Math.PI/180/2)**2));
                           };
                           const d = distToOther(pickupCoords.lat, pickupCoords.lng, oldPickupLat, oldPickupLng);
                           if (d <= 5) {
                               shouldYield = true;
                           }
                       }
                    }
                 }
              }
           });
           
           if (shouldYield) {
               // We randomly wait or skip this tick so the older job gets first dibs
               if (Math.random() < 0.0) {
                   return; // Yield to older job 70% of the time
               }
           }
       }

       if (bestDriver) {
          // Surge / Offer dispatch correctly matching the logic
          const timeoutMs = (fareConfig.dispatchTimeoutSeconds || 15) * 1000;
          await updateDoc(rideRef, {
             status: "offered",
             assignedDriverId: bestDriver,
             offerExpiresAt: Date.now() + timeoutMs
          });
          
          // Trigger remote FCM push notification to driver for new ride offer
          fetch("/api/chat-push", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipientId: bestDriver,
              title: "New Ride Offer",
              body: "You have a new incoming ride request",
              rideId: currentRideId,
              type: "ride_offer",
              channelId: "ride_offers"
            })
          }).catch(err => console.error("FCM API error:", err));
       }
    };

    dispatchInterval = setInterval(runDispatch, 3000);
    runDispatch(); // initial tick

    return () => clearInterval(dispatchInterval);

  }, [step, currentRideId, pickupCoords, selectedCategory, user, fareConfig]);

  useEffect(() => {
    if (!user || !currentRideId) return;
    const unsubRide = onSnapshot(doc(db, "ride_requests", currentRideId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        currentRideStatusRef.current = data.status || null;
        
        // Synchronize active ETA timers directly from the Firestore document (updated in real-time by driver terminal)
        if (data.liveEtaSeconds !== undefined && data.liveEtaSeconds !== null) {
          setLiveEtaSeconds(data.liveEtaSeconds);
          setLiveEtaMins(data.durationMinutes || Math.ceil(data.liveEtaSeconds / 60));
        } else if (data.durationMinutes !== undefined && data.durationMinutes !== null && liveEtaSeconds === null) {
          setLiveEtaSeconds(data.durationMinutes * 60);
          setLiveEtaMins(data.durationMinutes);
        }

        if (data.status === 'pending' || data.status === 'offered') {
          if (step !== "searching") {
            setStep("searching");
            setAssignedDriverInfo(null);
            setDriverPos(null);
            setLiveEtaSeconds(null);
            setLiveEtaMins(null);
            lastSoundStatusRef.current = null;
            searchingStartTimeRef.current = Date.now();
            toast.info("Finding a new driver", { description: "Your previous driver is no longer available." });
          } else {
            setAssignedDriverInfo(null);
            setDriverPos(null);
            setLiveEtaSeconds(null);
            setLiveEtaMins(null);
          }
        }
        if (data.status === 'accepted' && data.driverId) {
          if (lastSoundStatusRef.current !== 'accepted') {
             playSound('success');
             lastSoundStatusRef.current = 'accepted';
             // Only show the overlay if we just transitioned to accepted
             setShowDriverFoundOverlay(true);

             if (Capacitor.isNativePlatform()) {
               try {
                 LocalNotifications.requestPermissions().then((perm) => {
                   if (perm.display === 'granted') {
                     LocalNotifications.schedule({
                       notifications: [
                         {
                           title: "Driver Assigned",
                           body: `${data.driverName || "A driver"} is on their way to pick you up.`,
                           id: 1002,
                           schedule: { at: new Date(Date.now() + 100) },
                           actionTypeId: "",
                           extra: null
                         }
                       ]
                     });
                   }
                 }).catch(e => console.warn("LocalNotifications error:", e));
               } catch (e) {
                 console.warn("LocalNotifications error:", e);
               }
             }
          }
          setAssignedDriverInfo(prev => ({ 
             uid: data.driverId, 
             name: data.driverName || "Driver", 
             vehicle: data.vehicleInfo || "Taxi", 
             plate: data.vehiclePlate || "UNKNOWN",
             code: data.handshakeCode || "---", 
             requirePasscode: data.driverRequirePasscode === true || profile?.requirePasscode === true,
             phone: data.driverPhone || "", 
             status: "accepted",
             fareEstimate: data.fareEstimate || 0,
             rating: data.driverRating || "4.8",
             acceptedAt: data.acceptedAt?.toMillis() || Date.now(),
             isFinishingTrip: prev?.isFinishingTrip !== undefined ? prev.isFinishingTrip : (nearbyDriversCount === 0 && driversAvailableSoonCount > 0),
             stackedDriverDelay: data.stackedDriverDelay
          }));
          setStep("confirmed"); triggerHaptic(ImpactStyle.Heavy);
        }
        if (data.status === 'arrived') {
          if (lastSoundStatusRef.current !== 'arrived') {
             playSound('notification');
             if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 500]); // Distinct arrival vibration pattern
             lastSoundStatusRef.current = 'arrived';
             
             if (Capacitor.isNativePlatform()) {
               try {
                 LocalNotifications.requestPermissions().then((perm) => {
                   if (perm.display === 'granted') {
                     LocalNotifications.schedule({
                       notifications: [
                         {
                           title: "Driver Arrived",
                           body: "Your driver is outside the pickup location.",
                           id: 1001,
                           schedule: { at: new Date(Date.now() + 100) },
                           actionTypeId: "",
                           extra: null
                         }
                       ]
                     });
                   }
                 }).catch(e => console.warn("LocalNotifications error:", e));
               } catch (e) {
                 console.warn("LocalNotifications error:", e);
               }
             }

             // Attempt Text-to-Speech
             try {
               const textToSpeak = "Your driver has arrived outside.";
               if (Capacitor.isNativePlatform()) {
                 import('@capacitor-community/text-to-speech').then(({ TextToSpeech }) => {
                   TextToSpeech.speak({
                     text: textToSpeak,
                     rate: 1.0,
                     pitch: 1.0,
                     volume: 1.0,
                     lang: 'en-US'
                   }).catch(e => console.warn("Capacitor TTS error:", e));
                 }).catch(e => console.warn("Capacitor TTS import error:", e));
               } else if ('speechSynthesis' in window) {
                  const utterance = new SpeechSynthesisUtterance(textToSpeak);
                  utterance.rate = 1.0;
                  window.speechSynthesis.speak(utterance);
               }
             } catch (e) {
               console.warn("TTS error:", e);
             }
          }
          setAssignedDriverInfo(prev => {
            const base = prev || {
              uid: data.driverId,
              name: data.driverName || "Driver",
              vehicle: data.vehicleInfo || "Taxi",
              plate: data.vehiclePlate || "UNKNOWN",
              code: data.handshakeCode || "---",
              requirePasscode: data.driverRequirePasscode === true || profile?.requirePasscode === true,
              phone: data.driverPhone || "",
              fareEstimate: data.fareEstimate || 0,
              rating: data.driverRating || "4.8",
              acceptedAt: data.acceptedAt?.toMillis ? data.acceptedAt.toMillis() : (data.acceptedAt || Date.now()),
            };
            return {
              ...base,
              status: "arrived",
              arrivedAt: data.arrivedAt?.toMillis ? data.arrivedAt.toMillis() : (data.arrivedAt || Date.now()),
              tipAmount: data.tipAmount,
              currentStopIndex: data.currentStopIndex || 0,
              stops: data.stops || [],
              fareEstimate: data.fareEstimate || base.fareEstimate
            };
          });
          setStep("confirmed"); triggerHaptic(ImpactStyle.Heavy);
          toast.success("Your driver has arrived!", { duration: 8000, position: "top-center" });
        }
        if (data.status === 'in_progress') {
          if (lastSoundStatusRef.current !== 'in_progress') {
             playSound('notification');
             lastSoundStatusRef.current = 'in_progress';
          }
          setAssignedDriverInfo(prev => {
            const base = prev || {
              uid: data.driverId,
              name: data.driverName || "Driver",
              vehicle: data.vehicleInfo || "Taxi",
              plate: data.vehiclePlate || "UNKNOWN",
              code: data.handshakeCode || "---",
              requirePasscode: data.driverRequirePasscode === true || profile?.requirePasscode === true,
              phone: data.driverPhone || "",
              fareEstimate: data.fareEstimate || 0,
              rating: data.driverRating || "4.8",
              acceptedAt: data.acceptedAt?.toMillis ? data.acceptedAt.toMillis() : (data.acceptedAt || Date.now()),
            };
            return {
              ...base,
              status: "in_progress",
              startedAt: data.startedAt?.toMillis ? data.startedAt.toMillis() : (data.startedAt || Date.now()),
              currentStopIndex: data.currentStopIndex || 0,
              stops: data.stops || [],
              tipAmount: data.tipAmount,
              fareEstimate: data.fareEstimate || base.fareEstimate
            };
          });
          setStep("confirmed");
          
          // Let's remove the automatic tip modal per user instructions.
          if (!hasTriggeredTipModalRef.current) {
            hasTriggeredTipModalRef.current = true;
          }
        }
        if (data.status === 'awaiting_payment') {
          setAssignedDriverInfo(prev => {
            const base = prev || {
              uid: data.driverId,
              name: data.driverName || "Driver",
              vehicle: data.vehicleInfo || "Taxi",
              plate: data.vehiclePlate || "UNKNOWN",
              code: data.handshakeCode || "---",
              requirePasscode: data.driverRequirePasscode === true || profile?.requirePasscode === true,
              phone: data.driverPhone || "",
              fareEstimate: data.fareEstimate || 0,
              rating: data.driverRating || "4.8",
              acceptedAt: data.acceptedAt?.toMillis ? data.acceptedAt.toMillis() : (data.acceptedAt || Date.now()),
            };
            return {
              ...base,
              status: "awaiting_payment",
              paymentUrl: data.paymentUrl,
              fareEstimate: data.fareEstimate || base.fareEstimate
            };
          });
        }
        if (data.status === 'awaiting_cash_confirm') {
          setAssignedDriverInfo(prev => {
            const base = prev || {
              uid: data.driverId,
              name: data.driverName || "Driver",
              vehicle: data.vehicleInfo || "Taxi",
              plate: data.vehiclePlate || "UNKNOWN",
              code: data.handshakeCode || "---",
              requirePasscode: data.driverRequirePasscode === true || profile?.requirePasscode === true,
              phone: data.driverPhone || "",
              fareEstimate: data.fareEstimate || 0,
              rating: data.driverRating || "4.8",
              acceptedAt: data.acceptedAt?.toMillis ? data.acceptedAt.toMillis() : (data.acceptedAt || Date.now()),
            };
            return {
              ...base,
              status: "awaiting_cash_confirm",
              reportedCashCollected: data.reportedCashCollected,
              reportedCashDiscrepancy: data.reportedCashDiscrepancy,
              fareEstimate: data.fareEstimate || base.fareEstimate
            };
          });
        }
        if (data.status === 'completed') { 
          setCompletedRideData({ ...data, id: currentRideId });
          setStep("receipt"); 
          setCurrentRideId(null); 
          setAssignedDriverInfo(null); 
          lastSoundStatusRef.current = null; 
          hasTriggeredTipModalRef.current = false;
          setShowTipModal(false);
          // Clear cached search variables
          localStorage.removeItem("passenger_temp_pickup");
          localStorage.removeItem("passenger_temp_dropoff");
          localStorage.removeItem("passenger_temp_comments");
          localStorage.removeItem("passenger_temp_pickup_coords");
          localStorage.removeItem("passenger_temp_dropoff_coords");
          localStorage.removeItem("passenger_temp_stops");
        }
        if (data.status === 'cancelled') {
          clearBookingInputsAndState();
          toast.info("This ride was cancelled.");
          navigate("/my-rides");
        }
      }
    }, (err) => console.error("onSnapshot ERROR ride config step:", err));
    const unsubTrack = onSnapshot(doc(db, "live_tracking", assignedDriverInfo?.uid || "none"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.lat && data.lng) {
          const newPos = { lat: data.lat, lng: data.lng };
          setDriverPos(newPos);
          if (map) {
             const bounds = new window.google.maps.LatLngBounds();
             bounds.extend(newPos);
             
             // If driver is accepted, they are heading to pick you up
             if (currentRideStatusRef.current === "accepted" && pickupCoords) bounds.extend(pickupCoords);
             // If driver is in progress, they are heading to the dropoff
             if (currentRideStatusRef.current === "in_progress" && dropoffCoords) bounds.extend(dropoffCoords);

             if (currentRideStatusRef.current === "arrived") {
                 map.setCenter(newPos);
                 map.setZoom(17);
                 setMapCenter(newPos);
                 setMapZoom(17);
             } else {
                 if (isMapFullScreenRef.current) {
                     map.fitBounds(bounds, { top: 100, bottom: 120, left: 40, right: 40 });
                 } else {
                     map.fitBounds(bounds, { top: 60, bottom: 40, left: 40, right: 40 });
                 }
             }
          }
        }
      }
    }, (err) => { console.error("onSnapshot ERROR live_tracking 2:", err); });
    return () => { unsubRide(); unsubTrack(); };
  }, [currentRideId, assignedDriverInfo?.uid, user]);

  // Passenger Live GPS tracking for driver to see
  useEffect(() => {
    if (!user) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setPassengerPos({ lat: latitude, lng: longitude });
        
        if (currentRideId && step !== "details" && step !== "review" && step !== "payment" && step !== "receipt") {
          const now = Date.now();
          const timeSinceLastSync = now - lastLocationSyncRef.current;
          const distToLastSync = lastSyncCoordsRef.current 
              ? Math.sqrt(Math.pow(latitude - lastSyncCoordsRef.current.lat, 2) + Math.pow(longitude - lastSyncCoordsRef.current.lng, 2))
              : 999;
              
          const shouldSync = 
              timeSinceLastSync >= 60000 || 
              (timeSinceLastSync >= 10000 && distToLastSync > 0.00015) ||
              !lastSyncCoordsRef.current;

          if (shouldSync) {
            lastLocationSyncRef.current = now;
            lastSyncCoordsRef.current = { lat: latitude, lng: longitude };
            try {
              await setDoc(doc(db, "live_tracking", user.uid), {
                passengerId: user.uid,
                lat: latitude,
                lng: longitude,
                updatedAt: serverTimestamp(),
                isPassenger: true
              }, { merge: true });
            } catch (err) {
              console.error("Failed to sync passenger location:", err);
            }
          }
        }
      },
      (err) => console.warn("Passenger GPS error:", err),
      { enableHighAccuracy: true, maximumAge: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [currentRideId, user, step]);

  const selectSuggestion = async (s: {label: string, lat?: number, lon?: number, placeId?: string, placePrediction?: any}) => {
    setShowRegularJourneys(false);
    setShowFavorites(false);
    setShowHomeBlank(false);
    setShowWorkBlank(false);
    triggerHaptic(ImpactStyle.Light);
    setHasModifiedRouteByUser(true);
    
    const finalizeSelection = (coords: {lat: number, lng: number} | null, finalAddr: string) => {
      let currentPickup = pickup;
      let currentDropoff = dropoff;

      if (activeField === "pickup") { 
        setPickup(finalAddr); 
        currentPickup = finalAddr;
        if (coords) { setMapCenter(coords); setPickupCoords(coords); } 
      }
      else if (activeField === "dropoff" || !activeField) { 
        setDropoff(finalAddr); 
        currentDropoff = finalAddr;
        if (coords) { setMapCenter(coords); setDropoffCoords(coords); } 
      }
      else if (activeField?.startsWith("stop-")) {
        const idx = parseInt(activeField.split('-')[1]);
        const ns = [...stops];
        ns[idx] = { address: finalAddr, coords };
        setStops(ns);
        if (coords) setMapCenter(coords);
      }
      setSuggestions([]); 
      
      setActiveField(null);
      if (currentPickup && currentDropoff) {
        setDetailsView("vehicle");
      } else if (activeField === "pickup" && !currentDropoff) {
        setTimeout(() => {
          setActiveField("dropoff");
          dropoffInputRef.current?.focus();
        }, 100);
      }
    };

    if (s.placePrediction && typeof s.placePrediction.toPlace === "function") {
      if (!window.google || !window.google.maps) {
        import("sonner").then(({ toast }) => toast.error("Google Maps not loaded"));
        return;
      }
      try {
        const place = s.placePrediction.toPlace();
        await place.fetchFields({ fields: ['location', 'formattedAddress', 'addressComponents', 'displayName'] });
        const loc = place.location;
        let finalAddr = s.label;
        
        let pName = place.displayName || place.name;
        if (pName && place.formattedAddress) {
          // If it's a POI like McDonald's, formatted address is usually "123 Main St, City...".
          // The prediction name might be "McDonald's, Main Street..." lacking the number.
          // Extract the primary name (before any comma) to prevent duplicate road name in the address
          const mainName = pName.split(',')[0].trim();
          if (!place.formattedAddress.includes(mainName)) {
            finalAddr = `${mainName}, ${place.formattedAddress}`;
          } else {
            finalAddr = place.formattedAddress;
          }
        } else if (place.formattedAddress) {
          finalAddr = place.formattedAddress;
        }
        
        // Ensure UK postcode specifically is present
        const components = (place as any).addressComponents;
        const postcode = components?.find((c: any) => c.types.includes('postal_code'))?.longText;
        if (postcode && !finalAddr.includes(postcode)) {
          finalAddr += `, ${postcode}`;
        }

        if (loc) {
          finalizeSelection({ lat: loc.lat(), lng: loc.lng() }, finalAddr);
        } else {
          finalizeSelection(null, s.label);
        }
      } catch (err: any) {
        console.error("Geocoding using new Places API failed:", err);
        finalizeSelection(null, s.label);
      }
    } else {
      const coords = s.lat && s.lon ? { lat: s.lat, lng: s.lon } : null;
      if (!coords && window.google?.maps) {
        try {
          setIsLoadingAddress(true);
          const geocoder = new window.google.maps.Geocoder();
          const req = s.placeId ? { placeId: s.placeId } : { address: s.label };
          const res = await geocoder.geocode(req);
          if (res.results && res.results.length > 0) {
            const loc = res.results[0].geometry.location;
            finalizeSelection({ lat: loc.lat(), lng: loc.lng() }, s.label);
            setIsLoadingAddress(false);
            return;
          }
        } catch (e) {
          console.error("Geocoding failed:", e);
        } finally {
          setIsLoadingAddress(false);
        }
      }
      finalizeSelection(coords, s.label);
    }
  };

  const isMapFullScreenRef = useRef(false);
  useEffect(() => {
    isMapFullScreenRef.current = isMapFullScreen;
  }, [isMapFullScreen]);
  
  useEffect(() => {
    if (map && driverPos) {
       const bounds = new window.google.maps.LatLngBounds();
       bounds.extend(driverPos);
       
       if (currentRideStatusRef.current === "accepted" && pickupCoords) bounds.extend(pickupCoords);
       if (currentRideStatusRef.current === "in_progress" && dropoffCoords) bounds.extend(dropoffCoords);

       if (currentRideStatusRef.current === "arrived") {
           map.setCenter(driverPos);
           map.setZoom(17);
           setMapCenter(driverPos);
           setMapZoom(17);
       } else {
           if (isMapFullScreen) {
               map.fitBounds(bounds, { top: 100, bottom: 120, left: 40, right: 40 });
           } else {
               map.fitBounds(bounds, { top: 60, bottom: 40, left: 40, right: 40 });
           }
       }
    }
  }, [isMapFullScreen]);

  const driverPosRef = useRef(driverPos);
  
  useEffect(() => {
    driverPosRef.current = driverPos;
  }, [driverPos]);

  const lastQueriedDriverPosRef = useRef<any>(null);
  const lastQueriedDestCoordsRef = useRef<any>(null);

  useEffect(() => {
    const destinationCoords = assignedDriverInfo?.status === "accepted" ? pickupCoords :
                              assignedDriverInfo?.status === "in_progress" ? dropoffCoords : null;

    if ((assignedDriverInfo?.status === "accepted" || assignedDriverInfo?.status === "in_progress") && destinationCoords && isLoaded) {
      const getLiveRoute = async () => {
        const currentDriverPos = driverPosRef.current;
        if (!currentDriverPos || (Math.abs(currentDriverPos.lat) < 0.1 && Math.abs(currentDriverPos.lng) < 0.1)) return;
        if (!destinationCoords || (Math.abs(destinationCoords.lat) < 0.1 && Math.abs(destinationCoords.lng) < 0.1)) return;

        if (Math.abs(currentDriverPos.lat - destinationCoords.lat) < 0.0001 && Math.abs(currentDriverPos.lng - destinationCoords.lng) < 0.0001) return;

        // Skip if driver moved less than 30m since last directions fetch AND destination remains the same
        const destChanged = !lastQueriedDestCoordsRef.current ||
          Math.abs(lastQueriedDestCoordsRef.current.lat - destinationCoords.lat) > 0.0001 ||
          Math.abs(lastQueriedDestCoordsRef.current.lng - destinationCoords.lng) > 0.0001;

        if (!destChanged && lastQueriedDriverPosRef.current) {
          const lat1 = lastQueriedDriverPosRef.current.lat;
          const lng1 = lastQueriedDriverPosRef.current.lng;
          const lat2 = currentDriverPos.lat;
          const lng2 = currentDriverPos.lng;
          const dist = Math.sqrt(Math.pow((lat1 - lat2) * 111320, 2) + Math.pow((lng1 - lng2) * 111000 * Math.cos(lat1 * Math.PI / 180), 2));
          if (dist < 30) {
            return;
          }
        }

        try {
          const directionsService = new window.google.maps.DirectionsService();
          directionsService.route({
            origin: new window.google.maps.LatLng(currentDriverPos.lat, currentDriverPos.lng),
            destination: new window.google.maps.LatLng(destinationCoords.lat, destinationCoords.lng),
            travelMode: window.google.maps.TravelMode.DRIVING,
          }, (result, status) => {
            if (status === window.google.maps.DirectionsStatus.OK && result && result.routes && result.routes[0]) {
              lastQueriedDriverPosRef.current = currentDriverPos; // Update saved coords after a successful query
              lastQueriedDestCoordsRef.current = destinationCoords; // Track target destination coordinates
              const path = result.routes[0].overview_path.map(p => ({ lat: p.lat(), lng: p.lng() }));
              setLiveRouteLine(path);
              
              let totalSecs = 0;
              result.routes[0].legs.forEach((leg: any) => {
                if (leg.duration?.value) totalSecs += leg.duration.value;
              });
              
              if (assignedDriverInfo?.status === "accepted" && assignedDriverInfo?.stackedDriverDelay) {
                 totalSecs += assignedDriverInfo.stackedDriverDelay * 60;
              }

              setLiveEtaMins(Math.ceil(totalSecs / 60));
              setLiveEtaSeconds(totalSecs);
            }
          }).catch(() => {
            // Silently catch the unhandled promise rejection that Maps API throws for UNKNOWN_ERROR
          });
        } catch (e: any) {
          // completely silence routing errors to avoid unhandled rejection/console noise
        }
      };
      
      // Delay initial live route fetch slightly to avoid racing with initial load
      const timeoutId = setTimeout(getLiveRoute, 1000);
      const interval = setInterval(getLiveRoute, 15000); // refresh every 15s
      return () => {
         clearTimeout(timeoutId);
         clearInterval(interval);
      }
    } else {
      setLiveRouteLine([]);
      setLiveEtaMins(null);
      setLiveEtaSeconds(null);
    }
  }, [assignedDriverInfo?.status, dropoffCoords, pickupCoords, isLoaded]);

  useEffect(() => {
    let timer: any;
    if (showRideInfo) {
      timer = setTimeout(() => {
        setShowRideInfo(false);
      }, 10000);
    }
    return () => clearTimeout(timer);
  }, [showRideInfo, rideInfoTimerTick]);

  // Handle Google Maps load errors (e.g. ApiProjectMapError)
  const hasValidMapsKey = !!getGoogleMapsApiKey();
  if (loadError) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-surface p-8 text-center">
        <div className="w-20 h-20 bg-danger/10 rounded-full flex items-center justify-center mb-6">
          <Navigation className="w-10 h-10 text-danger" />
        </div>
        <h2 className="text-2xl font-black text-text-main mb-2">Maps API Error</h2>
        <p className="text-text-muted max-w-sm mb-8 font-medium">
          {!hasValidMapsKey 
            ? "Google Maps API Key is missing. Please configure VITE_GOOGLE_MAPS_API_KEY or VITE_GOOGLE_MAPS_API_KEY_ANDROID." 
            : "The Google Maps API failed to load. Please ensure the 'Maps JavaScript API' is enabled and your API Key is valid in your Google Cloud Console project."}
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <a 
            href="https://console.cloud.google.com/google/maps-apis/library/maps-backend.googleapis.com" 
            target="_blank" 
            rel="noreferrer"
            className="w-full py-4 bg-primary text-white rounded-2xl font-black text-sm shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            Enable Maps JS API
          </a>
          <button 
            onClick={() => window.location.reload()} 
            className="w-full py-4 bg-card border border-border-main text-text-main rounded-2xl font-black text-sm"
          >
            Check Again
          </button>
        </div>
      </div>
    );
  }

  const handleSubmitReview = async () => {
    if (!rideRating || !completedRideData || !user) return;
    setIsSubmittingReview(true);
    
    try {
      const visibilityDate = new Date();
      if (rideRating <= 3) {
        // 14 days cooling off
        visibilityDate.setDate(visibilityDate.getDate() + 14);
      }
      
      await addDoc(collection(db, "driver_reviews"), {
        rideId: completedRideData.id,
        driverId: completedRideData.driverId,
        passengerId: user.uid,
        rating: rideRating,
        tags: selectedReviewTags,
        comment: reviewComment,
        createdAt: serverTimestamp(),
        visibilityDate: visibilityDate,
        isAnonymous: true,
        status: "pending_aggregation" 
      });
      
      setHasSubmittedReview(true);
      toast.success("Review submitted anonymously. Thank you!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to submit review");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (!isLoaded) return <div className="h-full flex items-center justify-center bg-surface"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="relative flex-1 w-full overflow-hidden bg-[#e8eaed] dark:bg-slate-900 flex flex-col min-h-0">
       <div className={cn(
         "transition-all duration-300",
         isMapFullScreen ? "fixed inset-0 z-[200] h-[100dvh] w-[100dvw]" : (step === "details" ? "relative z-0 shrink-0 h-[60dvh] w-full" : (assignedDriverInfo?.status === "arrived" ? "relative z-0 shrink-0 h-[65dvh] w-full" : "relative z-0 shrink-0 h-[50dvh] w-full"))
       )}>
          {isMapFullScreen && (
            <button 
              onClick={() => setIsMapFullScreen(false)}
              className="absolute top-[env(safe-area-inset-top,1.5rem)] left-4 z-[210] bg-white border-2 border-slate-900 text-[#0a1930] p-3 rounded-full font-bold shadow-2xl pointer-events-auto flex items-center justify-center active:scale-95 transition-transform"
            >
              <ArrowLeft className="w-6 h-6 shrink-0" />
            </button>
          )}

          {isMapFullScreen && assignedDriverInfo && (
            <div className="absolute bottom-[env(safe-area-inset-bottom,1.5rem)] left-6 right-6 lg:left-auto lg:right-6 lg:w-96 z-[210] pointer-events-none flex justify-center">
              <div className="bg-white/95 backdrop-blur-md border border-black shadow-xl rounded-[20px] p-3 flex items-center justify-between pointer-events-auto w-full max-w-[280px]">
                 <div className="flex items-center gap-3 w-full">
                     <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${assignedDriverInfo.name || "driver"}`} alt="Driver" className="w-full h-full object-cover rounded-full" />
                     </div>
                     <div className="flex-1 min-w-0 pr-2">
                        <p className="font-bold text-slate-900 text-[14px] truncate leading-tight mb-0.5">{assignedDriverInfo.name || "Driver"}</p>
                        <p className="text-[12px] font-semibold text-slate-600 truncate leading-tight">{assignedDriverInfo.vehicle || "Toyota"}</p>
                     </div>
                     <div className="flex flex-col items-end shrink-0">
                         <div className="flex border-2 border-slate-900 rounded-[6px] overflow-hidden shadow-sm h-7 w-fit">
                            <div className="bg-blue-700 w-[14px] flex flex-col items-center justify-center pointer-events-none">
                               <span className="text-[5px] text-white font-bold leading-none">UK</span>
                            </div>
                            <div className="bg-[#ffcc00] px-1.5 flex items-center justify-center">
                               <p className="font-mono font-black text-slate-900 text-[11px] tracking-widest uppercase">{assignedDriverInfo.plate || "SIM 123"}</p>
                            </div>
                         </div>
                     </div>
                 </div>
              </div>
            </div>
          )}

          <GoogleMap
            mapContainerStyle={containerStyle}
            center={mapCenter}
            zoom={mapZoom}
            onZoomChanged={() => {
              if (map) {
                const z = map.getZoom();
                if (z !== undefined && z !== mapZoom) setMapZoom(z);
              }
            }}
            onDragEnd={() => {
              if (map) {
                const c = map.getCenter();
                if (c) {
                  setMapCenter({ lat: c.lat(), lng: c.lng() });
                }
              }
            }}
            onLoad={setMap}
            options={premiumMapOptions}
            onClick={async (e) => {
               if (e.latLng && step === "details" && (detailsView === "address" || isEditingJourney)) {
                  if (!activeField && pickupCoords && dropoffCoords) return;
                  
                  const lat = e.latLng.lat();
                  const lng = e.latLng.lng();
                  const coords = { lat, lng };
                  setMapCenter(coords);
                  setHasModifiedRouteByUser(true);
                  
                  let typeToUpdate = "";
                  let stopIdx = -1;
                  
                  if (activeField === "pickup" || (!activeField && !pickupCoords)) {
                    setPickupCoords(coords);
                    typeToUpdate = "pickup";
                  } else if (activeField === "dropoff" || (!activeField && pickupCoords && !dropoffCoords)) {
                    setDropoffCoords(coords);
                    typeToUpdate = "dropoff";
                  } else if (activeField?.startsWith("stop-")) {
                    stopIdx = parseInt(activeField.split("-")[1], 10);
                    const newStops = [...stops];
                    if (newStops[stopIdx]) {
                      newStops[stopIdx].coords = coords;
                      setStops(newStops);
                      typeToUpdate = "stop";
                    }
                  } else {
                    return;
                  }
                  
                  if (!window.google || !window.google.maps) return;
                  try {
                    const geocoder = new window.google.maps.Geocoder();
                    const response = await geocoder.geocode({ location: coords });
                    if (response.results[0]) {
                      let foundAddr = response.results[0].formatted_address;
                      if (typeToUpdate === "pickup") setPickup(foundAddr);
                      else if (typeToUpdate === "dropoff") setDropoff(foundAddr);
                      else if (typeToUpdate === "stop" && stopIdx >= 0) {
                        setStops(prevStops => {
                          const ns = [...prevStops];
                          ns[stopIdx].address = foundAddr;
                          return ns;
                        });
                      }
                    }
                  } catch (err) {
                    console.error("Reverse geocoding failed", err);
                  }
               }
            }}
          >
            {pickupCoords && (
              <>
                <MarkerF 
                  position={pickupCoords} 
                  label={{ text: "P", color: "white", fontSize: "13px", fontWeight: "bold" }} 
                  draggable={step === "details" && detailsView === "address" && draggablePin === "pickup"} 
                  onDragEnd={(e) => { setDraggablePin(null); handleMarkerDragEnd(e, "pickup"); }} 
                  onMouseDown={() => handlePinMouseDown("pickup")}
                  onMouseUp={handlePinMouseUpOrLeave}
                  onDragStart={handlePinMouseUpOrLeave}
                  icon={createPinIcon("#10b981")} 
                />
                {assignedDriverInfo?.status !== "in_progress" && (
                  <OverlayViewF
                    position={pickupCoords}
                    mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                    getPixelPositionOffset={(width, height) => ({ x: -(width / 2), y: -height - 68 })}
                  >
                    <div className="bg-emerald-50 px-2.5 py-2.5 rounded-xl shadow-xl border border-emerald-200 min-w-[120px] max-w-[200px] pointer-events-auto flex flex-col">
                      <p className="text-[8px] font-black text-emerald-600 uppercase tracking-[0.1em] mb-1">Pickup</p>
                      <div className="text-[10px] font-bold text-emerald-950 leading-tight space-y-0.5">
                        {formatAddressLines(pickup)}
                      </div>
                      {draggablePin !== "pickup" && step === "details" && detailsView === "address" && (
                        <div className="mt-1.5 pt-1 border-t border-emerald-200/50 flex items-center justify-center gap-1 opacity-70">
                          <MapPin className="w-2.5 h-2.5 text-emerald-700" />
                          <span className="text-[8px] font-bold text-emerald-800 tracking-tight">Hold pin to move</span>
                        </div>
                      )}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-emerald-50 border-r border-b border-emerald-200 rotate-45 -mt-1" />
                    </div>
                  </OverlayViewF>
                )}
              </>
            )}
            {dropoffCoords && (
              <>
                <MarkerF 
                  position={dropoffCoords} 
                  label={{ text: "D", color: "white", fontSize: "13px", fontWeight: "bold" }} 
                  draggable={step === "details" && detailsView === "address" && draggablePin === "dropoff"} 
                  onDragEnd={(e) => { setDraggablePin(null); handleMarkerDragEnd(e, "dropoff"); }} 
                  onMouseDown={() => handlePinMouseDown("dropoff")}
                  onMouseUp={handlePinMouseUpOrLeave}
                  onDragStart={handlePinMouseUpOrLeave}
                  icon={createPinIcon("#f43f5e")} 
                />
                <OverlayViewF
                  position={dropoffCoords}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                  getPixelPositionOffset={(width, height) => ({ x: -(width / 2), y: -height - 68 })}
                >
                  <div className="bg-rose-50 px-2.5 py-2.5 rounded-xl shadow-xl border border-rose-200 min-w-[120px] max-w-[200px] pointer-events-auto flex flex-col">
                    <p className="text-[8px] font-black text-rose-600 uppercase tracking-[0.1em] mb-1">Dropoff</p>
                    <div className="text-[10px] font-bold text-rose-950 leading-tight space-y-0.5">
                      {formatAddressLines(dropoff)}
                    </div>
                    {draggablePin !== "dropoff" && step === "details" && detailsView === "address" && (
                      <div className="mt-1.5 pt-1 border-t border-rose-200/50 flex items-center justify-center gap-1 opacity-70">
                        <MapPin className="w-2.5 h-2.5 text-rose-700" />
                        <span className="text-[8px] font-bold text-rose-800 tracking-tight">Hold pin to move</span>
                      </div>
                    )}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-rose-50 border-r border-b border-rose-200 rotate-45 -mt-1" />
                  </div>
                </OverlayViewF>
              </>
            )}
            {stops.map((s, i) => s.coords && (
              <React.Fragment key={i}>
                <MarkerF 
                  position={s.coords} 
                  label={{ text: `${i+1}`, color: "white", fontSize: "13px", fontWeight: "bold" }} 
                  draggable={step === "details" && detailsView === "address" && draggablePin === `stop-${i}`} 
                  onDragEnd={(e) => { setDraggablePin(null); handleMarkerDragEnd(e, "stop", i); }} 
                  onMouseDown={() => handlePinMouseDown(`stop-${i}`)}
                  onMouseUp={handlePinMouseUpOrLeave}
                  onDragStart={handlePinMouseUpOrLeave}
                  icon={createPinIcon("#f59e0b")} 
                />
                <OverlayViewF
                  position={s.coords}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                  getPixelPositionOffset={(width, height) => ({ x: -(width / 2), y: -height - 68 })}
                >
                  <div className="bg-amber-50 px-2.5 py-2.5 rounded-xl shadow-xl border border-amber-200 min-w-[120px] max-w-[200px] pointer-events-auto flex flex-col">
                    <p className="text-[8px] font-black text-amber-600 uppercase tracking-[0.1em] mb-1">Stop {i+1}</p>
                    <div className="text-[10px] font-bold text-amber-950 leading-tight space-y-0.5">
                      {formatAddressLines(s.address)}
                    </div>
                    {draggablePin !== `stop-${i}` && step === "details" && detailsView === "address" && (
                      <div className="mt-1.5 pt-1 border-t border-amber-200/50 flex items-center justify-center gap-1 opacity-70">
                        <MapPin className="w-2.5 h-2.5 text-amber-700" />
                        <span className="text-[8px] font-bold text-amber-800 tracking-tight">Hold pin to move</span>
                      </div>
                    )}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-amber-50 border-r border-b border-amber-200 rotate-45 -mt-1" />
                  </div>
                </OverlayViewF>
              </React.Fragment>
            ))}
             {passengerPos && (
              <OverlayViewF position={passengerPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                <div className="relative flex flex-col items-center justify-start -ml-[13px] -mt-[38px] z-50 pointer-events-none">
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
                </div>
              </OverlayViewF>
            )}

            {!currentRideId && step === "details" && nearbyDriversLocations.map(driver => (
              <OverlayViewF key={driver.id} position={{ lat: driver.lat, lng: driver.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                <div className="relative flex flex-col items-center justify-start -ml-[13px] -mt-[38px] z-50">
                  <div className="bg-[#FACC15] w-[26px] h-[26px] rounded-full border-[1.5px] border-black flex items-center justify-center relative shadow-sm z-20">
                    <Car className="w-3.5 h-3.5 text-black" fill="currentColor" />
                    {/* The leg */}
                    <div className="absolute top-[100%] left-1/2 -translate-x-1/2 w-[2px] h-[10px] bg-black flex justify-center">
                      <div className="w-[0.5px] h-full bg-[#FACC15]"></div>
                    </div>
                    {/* The base dot */}
                    <div className="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-2 h-2 bg-[#FACC15] border-[1.5px] border-black rounded-full shadow-sm"></div>
                  </div>
                </div>
              </OverlayViewF>
            ))}

            {driverPos && assignedDriverInfo && (
              <OverlayViewF position={driverPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                <div className="relative flex flex-col items-center justify-start -ml-[18px] -mt-[56px] z-50">
                  <div className="absolute top-[54px] w-6 h-2 bg-black/30 rounded-full blur-[1px]"></div>
                  {currentRideId && (assignedDriverInfo?.status === "accepted" || assignedDriverInfo?.status === "arrived") && (
                    <div className="absolute top-0 left-0 w-[36px] h-[36px] bg-[#FACC15] rounded-full animate-[ping_2s_ease-in-out_infinite] opacity-30"></div>
                  )}
                  <div className="bg-[#FACC15] w-[36px] h-[36px] rounded-full border-2 border-black flex items-center justify-center relative shadow-[0_0_15px_rgba(250,204,21,0.5)] z-20">
                    <Car className="w-[20px] h-[20px] text-black" fill="currentColor" />
                    {/* The leg */}
                    <div className="absolute top-[100%] left-1/2 -translate-x-1/2 w-[3px] h-[16px] bg-black flex justify-center">
                      <div className="w-[1px] h-full bg-[#FACC15]"></div>
                    </div>
                    {/* The base dot */}
                    <div className="absolute top-[calc(100%+14px)] left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-[#FACC15] border-2 border-black rounded-full shadow-[0_0_10px_rgba(250,204,21,0.8)]"></div>
                  </div>
                  <div className="absolute -top-7 bg-[#0a1930] px-2.5 py-1 rounded-md text-[10px] font-bold text-white whitespace-nowrap shadow-lg flex items-center gap-1.5 z-30">
                    <span>{assignedDriverInfo?.status === "accepted" ? "Heading to you" : assignedDriverInfo?.status === "arrived" ? "Arrived" : "In Progress"}</span>
                    {(liveEtaSeconds !== null && liveEtaSeconds > 0) && (
                      <span className="bg-white/20 px-1.5 py-0.5 rounded tracking-wider">
                        {Math.floor(liveEtaSeconds / 60) > 0 ? Math.floor(liveEtaSeconds / 60) + 'm ' : ''}{(liveEtaSeconds % 60).toString().padStart(2, '0')}s
                      </span>
                    )}
                  </div>
                </div>
              </OverlayViewF>
            )}
            {liveRouteLine.length > 0 ? (
               <PolylineF path={liveRouteLine} options={{ strokeColor: '#2563eb', strokeOpacity: 0.8, strokeWeight: 5 }} />
            ) : (
               routeLine.length > 0 && <PolylineF path={routeLine} options={{ strokeColor: '#2563eb', strokeOpacity: 0.8, strokeWeight: 5 }} />
            )}
          </GoogleMap>
          
          {map && (
             <div className={cn(
               "absolute right-4 z-[50] transition-all duration-300",
               isMapFullScreen ? "bottom-[120px]" : "bottom-4"
             )}>
               <MapZoomControls mapInstance={map} />
             </div>
          )}
       </div>

          {/* Incoming Message Quick Reply Popup */}
          <AnimatePresence>
            {incomingPopupMessage && !isChatOpen && (
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="absolute left-4 right-4 z-[60] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.2)] border border-slate-200 dark:border-white/10"
                style={{ top: "35%" }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 dark:bg-blue-400/20 flex items-center justify-center shrink-0">
                    <MessageCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-slate-900 dark:text-white font-bold text-[14px] truncate mb-1">
                      {assignedDriverInfo?.name || "Driver"}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-300 text-[13px] leading-snug line-clamp-2 break-words">
                      "{incomingPopupMessage.text}"
                    </p>
                  </div>
                  <button
                    onClick={() => setIncomingPopupMessage(null)}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center shrink-0 active:scale-95 transition-transform"
                  >
                    <X className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  </button>
                </div>

                <div className="flex overflow-x-auto no-scrollbar gap-2 pb-1 w-full">
                  {[
                    "OK, got it!",
                    "I'll be right there",
                    "Ok I will find you",
                    "I'll be outside shortly",
                    "I'm at location but can not find you."
                  ].map((msg, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuickReply(msg)}
                      className="whitespace-nowrap px-4 py-2 bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white text-[13px] font-bold rounded-[10px] active:scale-95 transition-transform shrink-0 shadow-sm"
                    >
                      {msg}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

       {/* Chat Component */}
       {step === "confirmed" && currentRideId && (
         <RideChat 
           rideId={currentRideId} 
           isOpen={isChatOpen} 
           onClose={() => setIsChatOpen(false)}
           otherPartyName={assignedDriverInfo?.name || "Driver"}
           otherPartyPhone={assignedDriverInfo?.phone || undefined}
           quickReplies={[
             "OK, got it!",
             "I'll be right there",
             "Ok I will find you",
             "I'll be outside shortly",
             "I'm at location but can not find you."
           ]}
         />
       )}
       
       <div className={cn("relative z-20 pointer-events-none flex flex-col justify-end overflow-hidden flex-1", isMapFullScreen && "opacity-0 invisible pointer-events-none")}>
          <AnimatePresence mode="wait">
            {step === "details" && (
              <motion.div
                key="details"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                className="bg-card rounded-t-[32px] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] pointer-events-auto flex flex-col h-full w-full border-t border-border-main overflow-hidden"
              >
                {detailsView === "address" && (
                    <button onClick={toggleListening} disabled={isAiProcessing} className="w-full bg-slate-900 border-b border-white/20/10 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 py-1 px-4 flex items-center justify-center gap-1.5 font-bold shadow-sm active:scale-95 transition-all text-[11px] uppercase tracking-wider shrink-0 z-10 relative rounded-none h-8">
                      {isListening ? (
                        <>
                          <div className="relative flex items-center justify-center">
                            <div className="absolute inset-0 bg-danger/20 rounded-full animate-ping" />
                            <div className="w-2.5 h-2.5 bg-danger rounded-sm animate-pulse" />
                          </div>
                          Tap to Stop & Process...
                        </>
                      ) : isAiProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin"/> Processing...
                        </>
                      ) : (
                        <>
                          <Mic className="w-4 h-4"/> Tap to Book by Voice <span className="text-orange-500 ml-1 font-bold">(BETA)</span>
                        </>
                      )}
                    </button>
                )}
                
                <div ref={bottomSheetRef} className={cn("overflow-x-hidden overflow-y-auto no-scrollbar flex-1 min-h-0", detailsView === "address" ? "p-4 pt-2 space-y-4 relative" : "p-3 pt-3 flex flex-col gap-2 relative")}>
                  {/* Outstanding Balance Reminder Banner */}
                  {profile && (profile.pendingCharges || 0) > 0 && (
                    <div className="mx-2 mb-3 mt-1 p-3.5 bg-red-50 border border-black rounded-[16px] shadow-sm flex flex-col gap-3 relative overflow-hidden shrink-0 pointer-events-auto">
                      <div className="absolute right-0 top-0 translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-red-200/50 rounded-full blur-lg pointer-events-none" />
                      <div className="flex items-start gap-3 relative z-10 text-left">
                        <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0 border border-red-200">
                          <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[13px] font-black text-[#0f172a] leading-tight mb-0.5 uppercase tracking-wide">Outstanding Balance</h3>
                          <p className="text-[11px] font-medium text-slate-700 leading-normal">
                            You have an unpaid balance of <span className="font-extrabold text-red-600">£{(profile.pendingCharges || 0).toFixed(2)}</span> ({profile.pendingChargesReason || "unpaid trip discrepancy"}).
                          </p>
                          <p className="text-[10px] font-semibold text-slate-500 mt-1">
                            Your booking privileges are suspended. Please settle this balance to unlock booking access.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 relative z-10">
                        <button 
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (isClearingBalance) return;
                            setIsClearingBalance(true);
                            await new Promise(r => setTimeout(r, 1500));
                            try {
                              await updateDoc(doc(db, "users", user.uid), {
                                pendingCharges: 0,
                                pendingChargesReason: deleteField(),
                                cancellationCount: 0,
                                abandonmentStrikes: 0
                              });
                              toast.success(`Success! Outstanding balance of £${(profile.pendingCharges || 0).toFixed(2)} has been cleared. Thank you.`);
                            } catch (err) {
                              console.error("Failed to clear balance:", err);
                              toast.error("Failed to clear outstanding balance.");
                            } finally {
                              setIsClearingBalance(false);
                            }
                          }}
                          disabled={isClearingBalance}
                          className="w-full py-2 px-3 bg-[#0f172a] hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-[11px] uppercase tracking-wider rounded-xl border border-black shadow active:scale-95 transition-all flex items-center justify-center gap-1.5"
                        >
                          {isClearingBalance ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Processing Secure Payment...
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-3.5 h-3.5" />
                              Pay £{(profile.pendingCharges || 0).toFixed(2)} with card
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                  {detailsView === "address" ? (
                    <>
                      <div className="bg-surface rounded-3xl p-2 pb-3 border border-border-main shadow-sm mb-4 shrink-0">
                    <div className="space-y-2 relative">
                      <div className="absolute left-3 top-8 bottom-8 w-0.5 border-l-2 border-dashed border-border-main/60" />
                      
                      {/* Pickup */}
                      <div className="relative flex flex-col group w-full">
                        <div className="relative flex items-center w-full">
                        <div className="w-6 flex justify-center shrink-0">
                           <div className="w-2.5 h-2.5 rounded-full border-2 border-emerald-500 bg-surface z-10 
                             group-focus-within:border-emerald-500 group-focus-within:scale-125 transition-all" />
                        </div>
                        <div className="flex-1 flex items-center bg-emerald-50/20 border border-emerald-200/60 rounded-2xl group-focus-within:bg-white group-focus-within:border-emerald-500 group-focus-within:ring-4 group-focus-within:ring-emerald-500/10 transition-all shadow-sm min-w-0 pr-1 overflow-hidden">
                          <input 
                            type="text" 
                            className="flex-none w-14 bg-transparent text-center font-bold text-text-main outline-none placeholder:text-text-muted/60 text-[15px] border-r border-emerald-200/60 py-3.5 focus:bg-emerald-500/5 transition-colors shrink-0 min-w-0 disabled:opacity-50" 
                            placeholder="Flat" 
                            value={houseNumber} 
                            disabled={!!assignedDriverInfo}
                            onChange={(e) => setHouseNumber(e.target.value)} 
                          />
                          <input 
                            ref={pickupInputRef}
                            type="text" 
                            className="flex-1 w-full bg-transparent px-4 font-bold text-text-main outline-none placeholder:text-text-muted/60 text-[15px] py-3.5 focus:bg-emerald-500/5 transition-colors min-w-0 disabled:opacity-50 disabled:cursor-not-allowed" 
                            placeholder="Current Location" 
                            value={pickup} 
                            disabled={!!assignedDriverInfo}
                            onFocus={() => { if (!assignedDriverInfo) setActiveField("pickup"); }} 
                            onChange={(e) => { if (!assignedDriverInfo) { setPickup(e.target.value); setActiveField("pickup"); } }} 
                          />
                          {pickup && !assignedDriverInfo && (
                            <button onClick={() => { setPickup(""); setPickupCoords(null); setHasModifiedRouteByUser(true); }} className="p-2 text-text-muted hover:text-text-main rounded-full shrink-0 outline-none"><X className="w-4 h-4" /></button>
                          )}
                          <div className="pl-1.5 pr-0.5 py-1.5 border-l border-emerald-200/60 flex items-center justify-center shrink-0 h-full">
                            <button onClick={handleDetectLocation} className="p-1.5 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg tooltip-trigger shrink-0 transition-colors">
                              {isDetecting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : (
                                <Target className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                        </div>
                        </div>

                        <AnimatePresence>
                          {activeField === "pickup" && (suggestions.length > 0 || isLoadingAddress) && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} onAnimationComplete={() => bottomSheetRef.current && bottomSheetRef.current.scrollTo({ top: bottomSheetRef.current.scrollHeight, behavior: 'smooth' })} className="z-[60] ml-6 mr-0 mt-1 overflow-hidden rounded-2xl shadow-sm border border-black bg-white origin-top flex flex-col">
                              <div className="flex justify-between items-center bg-slate-50 border-b border-black px-3 py-2 shrink-0">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Suggestions</span>
                                <button onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setActiveField(null); setSuggestions([]); }} className="p-1 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors shadow-sm active:scale-95"><X className="w-4 h-4" /></button>
                              </div>
                              <div className="text-sm max-h-56 overflow-y-auto flex flex-col no-scrollbar">
                              {suggestions.length === 0 && isLoadingAddress && (
                                <div className="py-4 flex items-center justify-center text-text-muted text-sm border-t border-black bg-white">
                                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Searching...
                                </div>
                              )}
                                {[...suggestions].map((s, idx) => (
                                  <button key={idx} onClick={() => selectSuggestion(s)} className="w-full py-3 px-3 text-left hover:bg-slate-50 border-b border-black flex items-center justify-between gap-3 transition-colors bg-white mt-0 first:border-b-0 shrink-0">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                      {s.isHistory ? 
                                        <History className="w-4 h-4 text-emerald-500 shrink-0 opacity-70" /> :
                                        <MapPin className="w-4 h-4 text-emerald-500 shrink-0 opacity-70" />
                                      }
                                      <span className="font-semibold text-text-main text-sm truncate">{s.label}</span>
                                    </div>
                                    {s.distance && <span className="text-xs whitespace-nowrap text-slate-500 font-bold tracking-tight bg-slate-100 px-2 py-0.5 rounded-md">{s.distance}</span>}
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Stops */}
                      {stops.map((stop, i) => (
                        <React.Fragment key={i}>
                          <div className="relative flex flex-col group w-full">
                          <div className="relative flex items-center w-full">
                          <div className="w-6 flex justify-center shrink-0">
                             <div className="w-2 h-2 rounded-full border-2 border-amber-500 bg-surface z-10" />
                          </div>
                          <div className="flex-1 flex bg-slate-50 border border-black rounded-2xl group-focus-within:bg-white group-focus-within:border-amber-500 group-focus-within:ring-4 group-focus-within:ring-amber-500/10 transition-all pr-1 shadow-sm min-w-0">
                            <input 
                              type="text" 
                              className="flex-1 w-full bg-transparent px-4 font-bold text-text-main outline-none placeholder:text-text-muted/60 text-[15px] py-3.5 focus:bg-amber-500/5 rounded-l-2xl transition-colors min-w-0" 
                              placeholder={`Stop ${i+1}`} 
                              value={stop.address} 
                              onFocus={() => setActiveField(`stop-${i}`)} 
                              onChange={(e) => {
                                const ns = [...stops]; ns[i].address = e.target.value; setStops(ns);
                                setActiveField(`stop-${i}`);
                                setHasModifiedRouteByUser(true);
                              }} 
                            />
                            {stop.address && (
                              <button onClick={() => { const ns = [...stops]; ns[i].address = ""; ns[i].coords = null; setStops(ns); setHasModifiedRouteByUser(true); }} className="p-2 text-text-muted hover:text-text-main rounded-full shrink-0 outline-none"><X className="w-4 h-4" /></button>
                            )}
                            <button onClick={() => { setStops(stops.filter((_, idx) => idx !== i)); setHasModifiedRouteByUser(true); }} className="p-2 text-text-muted hover:text-danger rounded-full shrink-0 outline-none"><X className="w-4 h-4" /></button>
                          </div>
                        </div>
                        </div>
                        
                        <AnimatePresence>
                          {activeField === `stop-${i}` && (suggestions.length > 0 || isLoadingAddress) && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="z-[60] ml-6 mr-0 mt-1 overflow-hidden rounded-2xl shadow-sm border border-black bg-white origin-top flex flex-col">
                              <div className="flex justify-between items-center bg-slate-50 border-b border-black px-3 py-2 shrink-0">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Suggestions</span>
                                <button onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setActiveField(null); setSuggestions([]); }} className="p-1 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors shadow-sm active:scale-95"><X className="w-4 h-4" /></button>
                              </div>
                              <div className="text-sm max-h-56 overflow-y-auto flex flex-col no-scrollbar">
                                {suggestions.length === 0 && isLoadingAddress && (
                                  <div className="py-4 flex items-center justify-center text-text-muted text-sm border-t border-black bg-white">
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Searching...
                                  </div>
                                )}
                                {[...suggestions].map((s, idx) => (
                                  <button key={idx} onClick={() => selectSuggestion(s)} className="w-full py-3 px-3 text-left hover:bg-slate-50 border-b border-black flex items-center justify-between gap-3 transition-colors bg-white mt-0 first:border-b-0 shrink-0">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                      {s.isHistory ? 
                                        <History className="w-4 h-4 text-amber-500 shrink-0 opacity-70" /> :
                                        <MapPin className="w-4 h-4 text-amber-500 shrink-0 opacity-70" />
                                      }
                                      <span className="font-semibold text-text-main text-sm truncate">{s.label}</span>
                                    </div>
                                    {s.distance && <span className="text-xs whitespace-nowrap text-slate-500 font-bold tracking-tight bg-slate-100 px-2 py-0.5 rounded-md">{s.distance}</span>}
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </React.Fragment>
                    ))}

                    {/* Dropoff */}
                      <div className="relative flex flex-col group w-full">
                        <div className="relative flex items-center w-full">
                        <div className="w-6 flex justify-center shrink-0">
                           <div className="w-2.5 h-2.5 bg-red-500 rounded-sm z-10 group-focus-within:bg-red-500 group-focus-within:scale-125 transition-all" />
                        </div>
                        <div className="flex-1 flex items-center bg-red-50/20 border border-red-200/60 rounded-2xl group-focus-within:bg-white group-focus-within:border-red-500 group-focus-within:ring-4 group-focus-within:ring-red-500/10 transition-all pr-1 shadow-sm min-w-0 overflow-hidden">
                          <input 
                            ref={dropoffInputRef}
                            type="text" 
                            className="flex-1 w-full bg-transparent px-4 font-bold text-text-main outline-none placeholder:text-text-muted/60 text-[15px] py-3.5 focus:bg-red-500/5 transition-colors min-w-0" 
                            placeholder="Where to?" 
                            value={dropoff} 
                            onFocus={() => setActiveField("dropoff")} 
                            onChange={(e) => { setDropoff(e.target.value); setActiveField("dropoff"); }} 
                          />
                          {dropoff && (
                            <button onClick={() => { setDropoff(""); setDropoffCoords(null); setHasModifiedRouteByUser(true); }} className="p-2 text-text-muted hover:text-text-main rounded-full shrink-0 outline-none"><X className="w-4 h-4" /></button>
                          )}
                          {stops.length < 3 && (
                            <div className="pl-2 pr-1 py-1 border-l border-red-200/60 flex items-center justify-center shrink-0 h-full">
                              <button onClick={() => { setStops([...stops, { address: "", coords: null }]); setHasModifiedRouteByUser(true); }} className="w-[30px] h-[34px] bg-[#FFB800] text-black hover:bg-[#E6A600] rounded-[10px] border-[1.5px] border-black flex flex-col items-center justify-center shrink-0 transition-colors shadow-sm" title="Add a stop">
                                <Plus className="w-3.5 h-3.5 -mb-[1px]" strokeWidth={4} />
                                <span className="text-[9px] font-black tracking-tighter leading-none mb-0.5 ml-0.5">STP</span>
                              </button>
                            </div>
                          )}
                        </div>
                        </div>

                        <AnimatePresence>
                          {activeField === "dropoff" && (suggestions.length > 0 || isLoadingAddress) && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} onAnimationComplete={() => bottomSheetRef.current && bottomSheetRef.current.scrollTo({ top: bottomSheetRef.current.scrollHeight, behavior: 'smooth' })} className="z-[60] ml-6 mr-0 mt-1 overflow-hidden rounded-2xl shadow-sm border border-black bg-white origin-top flex flex-col">
                              <div className="flex justify-between items-center bg-slate-50 border-b border-black px-3 py-2 shrink-0">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Suggestions</span>
                                <button onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setActiveField(null); setSuggestions([]); }} className="p-1 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors shadow-sm active:scale-95"><X className="w-4 h-4" /></button>
                              </div>
                              <div className="text-sm max-h-56 overflow-y-auto flex flex-col no-scrollbar">
                                {suggestions.length === 0 && isLoadingAddress && (
                                  <div className="py-4 flex items-center justify-center text-text-muted text-sm border-t border-black bg-white">
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Searching...
                                  </div>
                                )}
                                {[...suggestions].map((s, idx) => (
                                  <button key={idx} onClick={() => selectSuggestion(s)} className="w-full py-3 px-3 text-left hover:bg-slate-50 border-b border-black flex items-center justify-between gap-3 transition-colors bg-white mt-0 first:border-b-0 shrink-0">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                      {s.isHistory ? 
                                        <History className="w-4 h-4 text-blue-500 shrink-0 opacity-70" /> :
                                        <MapPin className="w-4 h-4 text-red-500 shrink-0 opacity-70" />
                                      }
                                      <span className="font-semibold text-text-main text-sm truncate">{s.label}</span>
                                    </div>
                                    {s.distance && <span className="text-xs whitespace-nowrap text-slate-500 font-bold tracking-tight bg-slate-100 px-2 py-0.5 rounded-md">{s.distance}</span>}
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      
                      <div className="flex justify-between gap-1 py-2 mt-1 mx-2 sm:ml-6 sm:mx-0 pr-1 items-center">
                        <button 
                          onClick={() => { 
                            const home = favoriteAddresses.find(f => f?.name?.toLowerCase() === 'home');
                            if (!home) {
                              setShowHomeBlank(!showHomeBlank);
                              if (!showHomeBlank) {
                                setShowWorkBlank(false);
                                setShowRegularJourneys(false);
                                setShowFavorites(false);
                              }
                            } else {
                              selectSuggestion({ label: home.address, lat: home.lat, lon: home.lng, placeId: home.placeId });
                            }
                          }} 
                          className={cn("flex-1 justify-center px-2 py-1.5 border rounded-full flex items-center gap-1 text-[10px] sm:text-[11px] font-bold transition-colors shadow-sm whitespace-nowrap", showHomeBlank ? "bg-blue-100 border-blue-300 text-blue-800" : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300")}
                        >
                          <Home className="w-3 h-3 text-blue-500" /> Home
                        </button>
                        <button 
                          onClick={() => { 
                            const work = favoriteAddresses.find(f => f?.name?.toLowerCase() === 'work');
                            if (!work) {
                              setShowWorkBlank(!showWorkBlank);
                              if (!showWorkBlank) {
                                setShowHomeBlank(false);
                                setShowRegularJourneys(false);
                                setShowFavorites(false);
                              }
                            } else {
                              selectSuggestion({ label: work.address, lat: work.lat, lon: work.lng, placeId: work.placeId });
                            }
                          }} 
                          className={cn("flex-1 justify-center px-2 py-1.5 border rounded-full flex items-center gap-1 text-[10px] sm:text-[11px] font-bold transition-colors shadow-sm whitespace-nowrap", showWorkBlank ? "bg-indigo-100 border-indigo-300 text-indigo-800" : "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300")}
                        >
                          <Briefcase className="w-3 h-3 text-indigo-500" /> Work
                        </button>
                        <button 
                          onClick={() => {
                             setShowRegularJourneys(!showRegularJourneys);
                             if (!showRegularJourneys) {
                                setShowFavorites(false);
                                setShowHomeBlank(false);
                                setShowWorkBlank(false);
                             }
                          }} 
                          className={cn("flex-1 justify-center px-2 py-1.5 border rounded-full flex items-center gap-1 text-[10px] sm:text-[11px] font-bold transition-colors shadow-sm whitespace-nowrap", showRegularJourneys ? "bg-emerald-100 border-emerald-300 text-emerald-800" : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300")}
                        >
                          <History className="w-3 h-3 text-emerald-500" /> Regular
                        </button>
                        <button 
                          onClick={() => {
                             setShowFavorites(!showFavorites);
                             if (!showFavorites) {
                                setShowRegularJourneys(false);
                                setShowHomeBlank(false);
                                setShowWorkBlank(false);
                             }
                          }} 
                          className={cn("flex-1 justify-center px-2 py-1.5 border rounded-full flex items-center gap-1 text-[10px] sm:text-[11px] font-bold transition-colors shadow-sm whitespace-nowrap", showFavorites ? "bg-amber-100 border-amber-300 text-amber-800" : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 hover:border-amber-300")}
                        >
                          <Bookmark className="w-3 h-3 text-amber-500 fill-amber-500" /> Saved
                        </button>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {distanceMiles > 0 && pickup && dropoff && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                        <button onClick={() => setDetailsView("vehicle")} className="w-full py-4 bg-primary text-white rounded-[20px] font-black shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all mb-4">
                          Continue to Vehicles
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {(showRegularJourneys || showFavorites || showHomeBlank || showWorkBlank) && (
                      <motion.div 
                        initial={{ y: "100%", opacity: 0 }} 
                        animate={{ y: 0, opacity: 1 }} 
                        exit={{ y: "100%", opacity: 0 }}
                        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-0 left-0 right-0 z-[250] bg-white rounded-t-[32px] border-t-2 border-black shadow-[0_-10px_40px_rgba(0,0,0,0.15)] flex flex-col max-h-[70vh] w-full"
                      >
                        <div className="flex justify-between items-center p-4 border-b border-black bg-slate-50 rounded-t-[32px] shrink-0">
                          <span className="font-black text-sm tracking-widest uppercase text-slate-700">
                             {showRegularJourneys && "Regular Journeys"}
                             {showFavorites && "Saved Addresses"}
                             {showHomeBlank && "Home Address"}
                             {showWorkBlank && "Work Address"}
                          </span>
                          <button 
                            onPointerDown={(e) => { 
                              e.preventDefault(); e.stopPropagation(); 
                              setShowRegularJourneys(false); setShowFavorites(false); setShowHomeBlank(false); setShowWorkBlank(false); 
                            }} 
                            className="p-1.5 rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors shadow-sm"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>

                        <div className="p-4 overflow-y-auto w-full max-w-[500px] mx-auto space-y-3 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)]">
                          {showHomeBlank && (
                             <div className="text-center py-6 text-slate-500">
                               <p className="font-bold text-[15px] mb-2 text-slate-800">No home address saved.</p>
                               <p className="text-sm">Save an address as 'Home' in My Rides.</p>
                             </div>
                          )}

                          {showWorkBlank && (
                             <div className="text-center py-6 text-slate-500">
                               <p className="font-bold text-[15px] mb-2 text-slate-800">No work address saved.</p>
                               <p className="text-sm">Save an address as 'Work' in My Rides.</p>
                             </div>
                          )}

                          {showFavorites && (
                            <>
                              {favoriteAddresses && favoriteAddresses.length > 0 ? (
                                favoriteAddresses.map((fav: any, idx: number) => (
                                  <button
                                    key={`fav-${idx}`}
                                    onClick={() => {
                                      selectSuggestion({ label: fav.address, lat: fav.lat, lon: fav.lng, placeId: fav.placeId });
                                      setShowFavorites(false);
                                    }}
                                    className="w-full text-left bg-white border border-black rounded-xl p-4 shadow-sm hover:border-amber-400 hover:bg-amber-50 transition-colors flex items-center gap-4"
                                  >
                                    <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex flex-shrink-0 items-center justify-center">
                                      <Bookmark className="w-5 h-5 text-amber-500 fill-amber-500" />
                                    </div>
                                    <div className="flex-1 min-w-0 pr-2">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="font-black text-[13px] text-slate-800 uppercase tracking-widest">{fav.name}</span>
                                      </div>
                                      <span className="font-semibold text-[15px] text-slate-600 truncate block">{fav.address}</span>
                                    </div>
                                  </button>
                                ))
                              ) : (
                                <div className="text-center py-6 text-slate-500">
                                  <p className="font-bold text-[15px] mb-2 text-slate-800">No saved addresses found.</p>
                                  <p className="text-sm">Add them to your saved places.</p>
                                </div>
                              )}
                            </>
                          )}

                          {showRegularJourneys && (
                            <>
                              {profile?.regularJourneys && profile.regularJourneys.length > 0 ? (
                                profile.regularJourneys.map((j: any, idx: number) => (
                                  <div key={idx} className="flex flex-col gap-2 p-2 bg-white rounded-2xl border-2 border-black shadow-[3px_3px_0_rgba(0,0,0,1)] relative">
                                    <div className="text-xs font-black text-slate-800 bg-slate-100 rounded-lg px-2 py-1 inline-block self-start border border-black">{j.name || "Saved Route"}</div>
                                    <div className="flex items-center gap-2">
                                      <MapPin className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                                      <span className="font-bold text-slate-700 text-xs truncate">{j.from}</span>
                                    </div>
                                    <div className="w-0.5 h-2 bg-slate-200 ml-[5px] my-0" />
                                    <div className="flex items-center gap-2">
                                      <MapPin className="w-3 h-3 text-red-500 flex-shrink-0" />
                                      <span className="font-bold text-slate-700 text-xs truncate">{j.to}</span>
                                    </div>
                                    <div className="flex gap-2 mt-1.5 pt-1.5 border-t border-slate-200">
                                      <button 
                                        onClick={() => {
                                          geocodeLocation(j.from, setPickup, setPickupCoords);
                                          geocodeLocation(j.to, setDropoff, setDropoffCoords);
                                          setShowRegularJourneys(false);
                                          setDetailsView("vehicle");
                                        }}
                                        className="flex-1 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-black hover:bg-emerald-100 active:scale-95 transition-all border border-emerald-200"
                                      >
                                        Book Outward
                                      </button>
                                      <button 
                                        onClick={() => {
                                          geocodeLocation(j.to, setPickup, setPickupCoords);
                                          geocodeLocation(j.from, setDropoff, setDropoffCoords);
                                          setShowRegularJourneys(false);
                                          setDetailsView("vehicle");
                                        }}
                                        className="flex-1 py-1.5 bg-orange-50 text-orange-700 rounded-xl text-xs font-black hover:bg-orange-100 active:scale-95 transition-all border border-orange-200"
                                      >
                                        Book Return
                                      </button>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-center py-6 text-slate-500">
                                  <p className="font-bold text-[15px] mb-2 text-slate-800">No regular journeys saved yet.</p>
                                  <p className="text-sm">Save routes in My Rides as regular journeys.</p>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <>
                  <div className="flex flex-col bg-white rounded-[16px] border border-black mb-2 shrink-0 shadow-sm">
                    <div className="flex flex-1 items-center gap-3 p-3 overflow-hidden">
                      <button onClick={() => setDetailsView("address")} className="p-1 rounded-xl bg-slate-50 text-slate-700 hover:bg-slate-100 border border-black transition-colors shrink-0 aspect-square flex flex-col items-center justify-center h-10 w-10 shadow-sm">
                        <ChevronLeft className="w-4 h-4 mb-0.5" />
                        <span className="text-[9px] font-black text-black leading-none tracking-tight">Edit</span>
                      </button>
                      <div className="flex flex-col flex-1 overflow-hidden relative pl-2 space-y-1.5">
                        <div className="absolute left-3 top-2.5 bottom-2.5 w-0.5 border-l-[1.5px] border-dotted border-black" />
                        <div className="flex items-center gap-3 relative z-10">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <span className="text-[13px] font-semibold text-slate-800 truncate">{pickup || "Current Location"}</span>
                        </div>
                        {stops.map((stop, i) => stop.address ? (
                          <div key={i} className="flex items-center gap-3 relative z-10">
                            <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                            <span className="text-[13px] font-semibold text-slate-800 truncate">{stop.address}</span>
                          </div>
                        ) : null)}
                        <div className="flex items-center gap-3 relative z-10">
                          <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                          <span className="text-[13px] font-semibold text-slate-800 truncate">{dropoff}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {distanceMiles > 0 && (
                      <div 
                        ref={vehicleSelectionRef}
                        className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
                      >
                        {/* Driver Availability */}
                        <div className={cn(
                          "flex items-center justify-center gap-2 px-3 py-2 rounded-[10px] font-bold text-sm transition-colors duration-300 shadow-sm",
                          (nearbyDriversCount === 0 && driversAvailableSoonCount === 0)
                            ? "bg-red-100 text-red-800" 
                            : waitWarning 
                              ? "bg-amber-100 text-amber-900" 
                              : "bg-emerald-600 text-[#F8F9FA]"
                        )}>
                          <Car className="w-[18px] h-[18px] shrink-0" />
                          <span>
                            {(() => {
                               if (nearbyDriversCount === 0 && driversAvailableSoonCount === 0) return "No drivers available nearby (Approx)";
                               if (waitWarning) {
                                   const wt = maxWaitTimeMins > 30 ? 30 : (maxWaitTimeMins || 20);
                                   return `High Demand - Wait ${wt}+ mins (Approx)`;
                               }
                               if (estimatedWaitEta !== null) {
                                  return estimatedWaitEta >= 20 ? "Driver available in 20+ mins (Approx)" :
                                    `Driver available within ${Math.max(5, Math.ceil(estimatedWaitEta / 5) * 5)} mins (Approx)`;
                               }
                               return "Driver available soon (Approx)";
                            })()}
                          </span>
                        </div>
                        
                        <div className="flex gap-2 overflow-x-auto no-scrollbar snap-x px-1 pb-1">
                          {CAR_CATEGORIES.map((cat) => {
                            const active = selectedCategory === cat.id;
                            const isAvailable = availableCategories.has(cat.id);
                            return (
                              <button 
                                key={cat.id} 
                                onClick={() => { if(isAvailable) setSelectedCategory(cat.id); }} 
                                disabled={!isAvailable}
                                className={cn(
                                  "flex-none min-w-[125px] snap-center flex flex-row items-center p-2 rounded-[8px] transition-all border gap-2.5", 
                                  active ? "bg-[#2563EB] text-white border-[#2563EB] shadow-md shadow-blue-500/20 scale-[1.02]" : 
                                  isAvailable ? "bg-white text-slate-600 hover:bg-slate-50 border-black shadow-sm" : "bg-slate-50 text-slate-400 opacity-60 cursor-not-allowed border-black"
                                )}
                              >
                                <cat.icon className={cn("w-5 h-5 shrink-0 ml-1", active ? "text-white" : isAvailable ? "text-slate-500" : "text-slate-400")} />
                                <div className="flex flex-col items-start min-w-0 flex-1">
                                  <span className={cn("text-[9px] font-bold tracking-tight text-left leading-none uppercase max-w-full truncate", active ? "text-white" : "text-slate-600")}>{cat.name}</span>
                                  {!isAvailable ? (
                                    <span className="text-[10px] font-bold line-through opacity-60 mt-0.5">£{getComputedFare(cat.id).toFixed(2)}</span>
                                  ) : (
                                    <span className="text-sm font-bold mt-0.5 leading-none">£{getComputedFare(cat.id).toFixed(2)}</span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Ride Context Selector (Corporate vs Personal) */}
                        {hasCorporateAccount && (
                          <div className="flex bg-white border border-black rounded-[8px] p-1 shadow-sm">
                            <button
                              onClick={() => setRideContext("personal")}
                              className={cn("flex-1 py-1.5 text-[11px] font-bold rounded-[6px] transition-all", rideContext === "personal" ? "bg-[#2563EB] text-white shadow-sm" : "hover:bg-slate-50 text-slate-800 border border-transparent")}
                            >
                              Personal Ride
                            </button>
                            <button
                              onClick={() => setRideContext("business")}
                              className={cn("flex-1 py-1.5 text-[11px] font-bold rounded-[6px] transition-all flex items-center justify-center gap-1.5", rideContext === "business" ? "bg-[#2563EB] text-white shadow-sm" : "hover:bg-slate-50 text-slate-800 border border-transparent")}
                            >
                              <Briefcase className="w-3 h-3" /> Business Ride
                            </button>
                          </div>
                        )}
                        
                        {/* Add-Ons */}
                        <div className="flex items-center gap-2">
                          <div 
                            onClick={() => setIsPriority(!isPriority)}
                            className={cn(
                              "flex-1 flex justify-between items-center bg-white border border-black rounded-[10px] px-3 py-2 shadow-xs cursor-pointer select-none transition-all active:scale-[0.99]",
                              isPriority ? "bg-blue-50/70" : "hover:bg-slate-50"
                            )}
                          >
                             <div className="flex items-center gap-1.5 text-slate-900 font-extrabold">
                               <Zap className={cn("w-4 h-4 shrink-0 transition-colors", isPriority ? "text-[#2563EB] fill-[#2563EB]" : "text-slate-700")} />
                               <span className="text-[13px] tracking-tight">Priority</span>
                             </div>
                             {/* Compact Slider Switch */}
                             <div className={cn("w-[34px] h-[18px] rounded-full p-[2px] transition-colors relative flex items-center shrink-0 border border-black", isPriority ? "bg-[#2563EB]" : "bg-slate-200")}>
                               <div className={cn("w-[12px] h-[12px] bg-white rounded-full shadow-xs transition-transform duration-200 ease-in-out shrink-0", isPriority ? "translate-x-[16px]" : "translate-x-0")} />
                             </div>
                          </div>

                          <div 
                            onClick={() => setIsPetFriendly(!isPetFriendly)}
                            className={cn(
                              "flex-1 flex justify-between items-center bg-white border border-black rounded-[10px] px-3 py-2 shadow-xs cursor-pointer select-none transition-all active:scale-[0.99]",
                              isPetFriendly ? "bg-blue-50/70" : "hover:bg-slate-50"
                            )}
                          >
                             <div className="flex items-center gap-1.5 text-slate-900 font-extrabold">
                               <Dog className={cn("w-4 h-4 shrink-0 transition-colors", isPetFriendly ? "text-[#2563EB]" : "text-slate-700")} />
                               <span className="text-[13px] tracking-tight">Pet</span>
                             </div>
                             {/* Compact Slider Switch */}
                             <div className={cn("w-[34px] h-[18px] rounded-full p-[2px] transition-colors relative flex items-center shrink-0 border border-black", isPetFriendly ? "bg-[#2563EB]" : "bg-slate-200")}>
                               <div className={cn("w-[12px] h-[12px] bg-white rounded-full shadow-xs transition-transform duration-200 ease-in-out shrink-0", isPetFriendly ? "translate-x-[16px]" : "translate-x-0")} />
                             </div>
                          </div>
                        </div>

                        <AnimatePresence>
                          {(isPriority || isPetFriendly) && (
                            <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:"auto"}} exit={{opacity:0, height:0}} className="overflow-hidden">
                              <div className="text-[10px] font-bold text-slate-900 bg-white shadow-sm p-2 rounded-[8px] text-center border border-black">
                                <span className="text-[#2563EB]">Notice:</span> Each active option adds <span className="font-bold">£3.00</span> to the base fare.
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        
                        {/* Fare Summary */}
                        {(() => {
                           const base = Math.max(fareEstimate || 5.0, fareConfig.minFare);
                           const defaultMultipliers: Record<string, number> = { standard: 1.0, executive: 1.5, luxury: 2.2, '6seater': 1.4, '8seater': 2.0, wav: 2.5 };
                           const catMultiplier = fareConfig.vehicleMultipliers?.[selectedCategory] || defaultMultipliers[selectedCategory] || 1.0;
                           const vehicleSubtotal = Math.max((fareEstimate || 5.0) * catMultiplier, fareConfig.minFare * catMultiplier);
                           const vehicleExtra = vehicleSubtotal - base;
                           const finalFare = getComputedFare(selectedCategory);
                           const surgeExtra = finalFare - vehicleSubtotal;
                           return (
                             <div className="bg-white shadow-sm rounded-[8px] pb-2 pt-3 px-3 border border-black">
                               <p className="text-[10px] font-bold uppercase text-slate-900 tracking-widest mb-2">Fare Breakdown</p>
                               <div className="space-y-1 mb-2 text-[13px] text-black font-medium">
                                 <div className="flex justify-between"><span>Journey Fare:</span><span>£{base.toFixed(2)}</span></div>
                                 {vehicleExtra > 0 && <div className="flex justify-between text-slate-600"><span>Vehicle Upgrade ({CAR_CATEGORIES.find(c => c.id === selectedCategory)?.name}):</span><span>+£{vehicleExtra.toFixed(2)}</span></div>}
                                 {surgeExtra > 0 && <div className="flex justify-between text-red-600 font-bold"><span>High Demand Surge:</span><span>+£{surgeExtra.toFixed(2)}</span></div>}
                                 {isPriority && <div className="flex justify-between text-[#2563EB] font-bold"><span>Priority:</span><span>+£3.00</span></div>}
                                 {isPetFriendly && <div className="flex justify-between text-[#2563EB] font-bold"><span>Pet:</span><span>+£3.00</span></div>}
                                 {((assignedDriverInfo?.tipAmount || 0) > 0) && <div className="flex justify-between text-emerald-600 font-bold"><span>Driver Tip:</span><span>+£{(assignedDriverInfo?.tipAmount || 0).toFixed(2)}</span></div>}
                               </div>
                               <div className="border-t border-black pt-2 flex flex-col font-black text-[17px] text-slate-900 border-b pb-2 mb-1">
                                 <div className="flex items-center justify-between">
                                   <span>Total estimate:</span>
                                   <span className="text-[20px]">£{(finalFare + (isPriority ? 3 : 0) + (isPetFriendly ? 3 : 0) + (assignedDriverInfo?.tipAmount || 0)).toFixed(2)}</span>
                                 </div>
                                 <div className="flex items-center justify-between mt-2">
                                   <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Payment Method</span>
                              {!!profile?.stripeCustomerId ? (
                                <div className="inline-block bg-white border-2 border-emerald-600 px-2 py-0.5 rounded-md shadow-sm">
                                  <span className="text-emerald-700 text-[10px] font-black uppercase tracking-wider block leading-none">Auto Payment</span>
                                </div>
                              ) : (
                                <div className="inline-block bg-white border-2 border-orange-600 px-2 py-0.5 rounded-md shadow-sm">
                                  <span className="text-orange-600 text-[10px] font-black uppercase tracking-wider block leading-none">QR Code</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <p className="text-[9px] text-slate-700 italic text-center pb-1 font-medium">Final fare may vary based on route</p>
                        </div>
                        )
                      })()}

                        <div className="pt-2">
                           <div className="relative">
                             <div className="absolute top-2.5 left-3 flex items-center justify-center">
                               <MessageSquare className="w-4 h-4 text-amber-500" />
                             </div>
                             <input 
                               type="text"
                               value={comments}
                               onChange={(e) => setComments(e.target.value)}
                               className="w-full bg-amber-50/80 border border-black rounded-[8px] pl-9 pr-8 py-2.5 text-[13px] font-medium text-slate-900 placeholder:text-amber-700/60 focus:outline-none focus:border-black focus:bg-amber-100/50 transition-all min-w-0 shadow-sm"
                               placeholder="Message to driver (e.g. Look for blue gate)"
                               maxLength={100}
                             />
                             {comments && (
                               <button 
                                 onClick={() => setComments("")} 
                                 className="absolute top-2.5 right-3 flex items-center justify-center text-amber-700/60 hover:text-amber-900 focus:outline-none"
                                 aria-label="Clear comments"
                               >
                                 <X className="w-4 h-4" />
                               </button>
                             )}
                           </div>
                        </div>
                        
                        {(() => {
                           const noDriversAtAll = nearbyDriversCount === 0 && driversAvailableSoonCount === 0;
                           const isHighDemandOrSlow = waitWarning || 
                              (estimatedWaitEta !== null && estimatedWaitEta >= 20) || 
                              (pickupCoords && noDriversAtAll);

                           return (
                        <div>
                           {isHighDemandOrSlow && !(assignedDriverInfo && ["accepted", "arrived", "in_progress"].includes(assignedDriverInfo.status)) && (
                             <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                               <div className="flex items-start gap-2">
                                 <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                 <div>
                                   <h4 className="text-sm font-bold text-red-900">
                                     {isPriority ? "Priority Active - High Demand" : (noDriversAtAll ? "No Drivers Available" : (waitWarning ? "High Demand Area" : "Limited Availability"))}
                                   </h4>
                                   <p className="text-[13px] text-red-700 mt-1 leading-tight font-medium">
                                     {isPriority 
                                       ? "With Priority activated, your request is at the top of the queue and will be matched as soon as a driver is available."
                                       : (noDriversAtAll 
                                         ? "There is no driver available right now. You might have to wait 20+ minutes for a match."
                                         : (waitWarning 
                                           ? `Drivers are very busy in this area. You might have to wait ${maxWaitTimeMins > 30 ? 30 : (maxWaitTimeMins || 20)}+ minutes.` 
                                           : `Drivers are busy in your area. You might have to wait ${estimatedWaitEta ? Math.max(20, Math.ceil(estimatedWaitEta/5)*5) : 20}+ minutes.`))}
                                   </p>
                                   
                                   {!isPriority && (
                                     <button 
                                       onClick={(e) => {
                                         e.preventDefault();
                                         if (currentRideId) {
                                             confirmTogglePriority(true);
                                         } else {
                                             setIsPriority(true);
                                             toast.success("Priority Boost Added! You will jump to the top of the queue.");
                                         }
                                       }}
                                       className="mt-2 text-left flex items-center justify-between bg-white text-indigo-700 border border-indigo-200 px-2 py-1.5 rounded-[6px] hover:bg-indigo-50 active:scale-[0.98] transition-all shadow-sm group cursor-pointer w-full"
                                     >
                                       <div className="flex items-center gap-1.5 font-bold text-[12px] truncate pr-2">
                                         <Zap className="w-3.5 h-3.5 fill-current shrink-0 group-hover:scale-110 transition-transform"/>
                                         <span className="truncate">Add Priority (+£3)</span>
                                       </div>
                                       <span className="text-[10px] uppercase font-black opacity-80 shrink-0 tracking-wider">Go Top of Queue</span>
                                     </button>
                                   )}
                                   
                                   <label className="flex items-center gap-2 mt-3 cursor-pointer">
                                     <input 
                                       type="checkbox" 
                                       checked={waitWarningAcknowledged}
                                       onChange={(e) => setWaitWarningAcknowledged(e.target.checked)}
                                       className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                                     />
                                     <span className="text-[13px] font-bold text-red-900">
                                       {isPriority ? "I understand and am ready to wait" : "I understand, find me a driver when available"}
                                     </span>
                                   </label>
                                 </div>
                               </div>
                             </div>
                           )}
                           <button 
                             onClick={handleConfirmBooking} 
                             disabled={!pickup || !dropoff || (isHighDemandOrSlow && !waitWarningAcknowledged && !(assignedDriverInfo && ["accepted", "arrived", "in_progress"].includes(assignedDriverInfo.status)))} 
                             className="w-full py-3 bg-[#0F172A] text-white rounded-[12px] font-bold text-[15px] hover:bg-black active:scale-95 disabled:opacity-50 transition-all focus:outline-none"
                           >
                             {assignedDriverInfo && ["accepted", "arrived", "in_progress"].includes(assignedDriverInfo.status) ? "Confirm Update" : `Confirm ${CAR_CATEGORIES.find(c => c.id === selectedCategory)?.name}`}
                           </button>
                           
                           {showCancelConfirm ? (
                             <div className="w-full mt-1.5 p-2 bg-red-50 border border-red-200 rounded-[12px] flex flex-col gap-1.5">
                               <p className="text-[13px] font-bold text-red-900 text-center">Cancel this ride?</p>
                               <div className="flex gap-2">
                                 <button 
                                   onClick={() => {
                                     setPickup("");
                                     setPickupCoords(null);
                                     setDropoff("");
                                     setDropoffCoords(null);
                                     setComments("");
                                     setWaitWarningAcknowledged(false);
                                     setShowCancelConfirm(false);
                                     navigate("/");
                                   }}
                                   className="flex-1 py-1.5 bg-red-600 text-white rounded-[8px] font-bold text-[12px] hover:bg-red-700 transition-all"
                                 >
                                   Yes, Cancel
                                 </button>
                                 <button 
                                   onClick={() => setShowCancelConfirm(false)}
                                   className="flex-1 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-[8px] font-bold text-[12px] hover:bg-slate-50 transition-all"
                                 >
                                   No, Keep
                                 </button>
                               </div>
                             </div>
                           ) : (
                             <button 
                               onClick={() => setShowCancelConfirm(true)}
                               className="w-full mt-2 py-2 bg-white border border-red-200 text-red-600 rounded-[12px] font-bold text-[13px] shadow-[0_2px_8px_-4px_rgba(0,0,0,0.1)] hover:bg-red-50 hover:border-red-300 active:scale-95 transition-all focus:outline-none flex justify-center items-center gap-2"
                             >
                               Cancel Booking
                             </button>
                           )}
                        </div>
                           );
                        })()}
                      </div>
                    )}
                  </AnimatePresence>
                  </>
                  )}
                  <div className="shrink-0 w-full h-[calc(6rem+env(safe-area-inset-bottom,0px))] transition-all duration-300" />
                </div>
              </motion.div>
            )}

            {step === "searching" && (
              <motion.div key="searching" initial={{ y: "100%" }} animate={{ y: 0 }} className="bg-white rounded-t-[24px] px-6 pt-3 pb-6 flex flex-col items-center border-t border-black pointer-events-auto h-full w-full overflow-y-auto no-scrollbar shadow-[0_-8px_30px_rgba(0,0,0,0.12)] relative z-20">
                <div className="w-10 h-[5px] bg-slate-200 rounded-full mb-3 shrink-0"/>
                <p className="text-slate-800 text-xs font-semibold mb-1">Searching for drivers...</p>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-3">Requesting...</h2>
                
                <SearchingTimer />

                <div className="w-full max-w-[320px] bg-[#f0f9ff] rounded-[16px] py-1.5 px-4 border border-black flex flex-col items-center justify-center shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] mb-2 mt-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0">Total Fare Estimate</p>
                  <p className="text-2xl font-black text-[#0f172a] leading-tight mb-1">£{(getComputedFare(selectedCategory) + (isPriority ? 3 : 0) + (isPetFriendly ? 3 : 0) + (assignedDriverInfo?.tipAmount || 0)).toFixed(2)}</p>
                  
                  {!!profile?.stripeCustomerId ? (
                    <div className="inline-block bg-white border-2 border-emerald-600 px-2 py-0.5 rounded-md shadow-sm mb-1.5">
                      <span className="text-emerald-700 text-[9px] font-black uppercase tracking-wider block leading-none">Auto Payment</span>
                    </div>
                  ) : (
                    <div className="inline-block bg-white border-2 border-orange-600 px-2 py-0.5 rounded-md shadow-sm mb-1.5">
                      <span className="text-orange-600 text-[10px] font-black uppercase tracking-wider block leading-none">QR Code</span>
                    </div>
                  )}
                </div>
                
                <div className="w-full max-w-[320px] relative">
                  <AnimatePresence mode="popLayout">
                    {isPriority && (
                      <motion.div key="priority-active" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-2 p-2.5 bg-emerald-500 rounded-xl text-center text-xs font-bold shadow-lg flex items-center justify-center gap-1.5 text-white">
                        <Check className="w-4 h-4 shrink-0" />
                        Priority activated! £3 added to base fare.
                      </motion.div>
                    )}
                    {!isPriority && priorityInlineToast && priorityInlineToast.type === 'info' && (!showPriorityPrompt) && (
                      <motion.div key="priority-info" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-2 p-2 bg-slate-800 rounded-xl text-center text-xs font-bold shadow-lg flex items-center justify-center gap-2 text-white">
                        <AlertCircle className="w-4 h-4" />
                        {priorityInlineToast.message}
                      </motion.div>
                    )}
                    {showPriorityPrompt && (
                      <motion.div key="priority-prompt" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute bottom-full left-0 right-0 mb-3 p-4 bg-white border border-black shadow-xl rounded-2xl z-20">
                        <p className="text-sm font-bold text-slate-800 text-center mb-3">Add Priority Boost for <span className="text-amber-600 font-black">£3.00</span>?</p>
                        <div className="flex gap-2">
                           <button onClick={() => setShowPriorityPrompt(false)} className="flex-1 py-2.5 bg-slate-100 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors">Cancel</button>
                           <button onClick={() => confirmTogglePriority(true)} className="flex-1 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 rounded-xl text-sm font-black text-white shadow-sm hover:opacity-90 transition-opacity">Confirm</button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <div onClick={handleTogglePriorityClick} className="w-full mb-3 bg-gradient-to-r from-[#ffeaa7] to-[#ffd43b] rounded-[16px] py-2 px-3 shadow-[0_4px_14px_-6px_rgba(255,212,59,0.5)] border border-black relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all">
                    <div className="flex items-center gap-3 relative z-10 w-full">
                      <div className="p-1.5 bg-amber-600/10 rounded-full shrink-0">
                        <Zap className="w-5 h-5 text-amber-800" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-amber-950 font-black text-[13px] leading-[1.1]">Boost Priority (+£3)</h4>
                        <p className="text-amber-800/80 text-[11px] font-bold tracking-tight mt-0.5 leading-[1.1]">Jump to the top of the queue.</p>
                      </div>
                      {/* Compact Slider Switch */}
                      <div className={cn("w-[34px] h-[18px] rounded-full p-[2px] transition-colors relative flex items-center shrink-0 border border-black/40", isPriority ? "bg-amber-900" : "bg-black/15")}>
                        <div className={cn("w-[12px] h-[12px] bg-white rounded-full shadow-xs transition-transform duration-200 ease-in-out shrink-0", isPriority ? "translate-x-[16px]" : "translate-x-0")} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 w-full max-w-[320px] relative mb-4">
                  <AnimatePresence>
                    {showAbandonPrompt && (
                      <motion.div key="abandon-prompt" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute bottom-full left-0 right-0 mb-4 p-4 bg-white border border-red-200 shadow-2xl rounded-[20px] z-30 flex gap-3">
                        <button onClick={handleAbandonSearch} className="flex-1 py-3 bg-red-500 rounded-2xl text-sm font-black text-white hover:bg-red-600 shadow-lg active:scale-95 transition-all">Cancel Request</button>
                        <button onClick={() => setShowAbandonPrompt(false)} className="flex-1 py-3 bg-slate-100 rounded-2xl text-sm font-bold text-slate-700 hover:bg-slate-200 active:scale-95 transition-all">Keep Waiting</button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <button onClick={handleCancelSearching} className="flex-1 text-slate-800 font-bold text-[15px] py-4 rounded-[16px] border border-black bg-white hover:bg-slate-50 transition-colors active:scale-[0.98]">Edit</button>
                  <button onClick={() => setShowAbandonPrompt(true)} className="flex-1 font-bold text-[15px] py-4 rounded-[16px] border border-black bg-[#dcfce7] text-[#15803d] hover:bg-[#bbf7d0] transition-colors active:scale-[0.98]">Cancel</button>
                </div>

                <div className="shrink-0 h-[calc(6rem+env(safe-area-inset-bottom,0px))] w-full mt-auto" />
              </motion.div>
            )}

            {step === "confirmed" && (
              <>
                <motion.div key="confirmed" initial={{ y: "100%" }} animate={{ y: 0 }} className="bg-white rounded-t-[24px] px-4 pt-2 pb-5 border-t border-black/50 pointer-events-auto h-full w-full overflow-y-auto no-scrollbar shadow-[0_-8px_30px_rgba(0,0,0,0.08)] relative z-20 flex flex-col">
                <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-2.5 shrink-0"/>
                
                {assignedDriverInfo?.status === "accepted" && (
                  <div className="bg-[#0a1930] rounded-[12px] px-4 py-2 border border-[#1e293b] shadow-sm flex flex-col items-center justify-center w-full mb-3 shrink-0">
                     <div className="flex items-center gap-2">
                       <Car className="w-[16px] h-[16px] text-white" />
                       <span className="font-black text-white text-[15px] tracking-wide">
                         {(liveEtaSeconds !== null && liveEtaSeconds > 0) ? `Arriving in ${Math.floor(liveEtaSeconds / 60) > 0 ? Math.floor(liveEtaSeconds / 60) + 'm ' : ''}${liveEtaSeconds % 60}s` : 
                          "Driver arriving soon..."}
                       </span>
                     </div>
                     {(assignedDriverInfo.isFinishingTrip || assignedDriverInfo.stackedDriverDelay) && (
                       <div className="bg-amber-400/20 px-2 py-0.5 rounded-full mt-1.5">
                         <span className="text-[10px] font-bold text-amber-300 uppercase tracking-widest flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                            Dropping off another passenger
                         </span>
                       </div>
                     )}
                  </div>
                )}
                
                <div className="flex justify-center mb-4 gap-2">
                   {assignedDriverInfo?.status === "in_progress" && (
                     <div className={cn("rounded-full px-5 py-1.5 flex items-center justify-center font-black text-[13px] text-white tracking-widest shadow-md uppercase shrink-0 drop-shadow-sm", (assignedDriverInfo?.currentStopIndex || 0) < (assignedDriverInfo?.stops?.length || 0) ? "bg-[#eab308] border border-[#ca8a04]" : "bg-red-500 border border-red-600")}>
                       {(assignedDriverInfo?.currentStopIndex || 0) < (assignedDriverInfo?.stops?.length || 0) ? `Going to Stop ${(assignedDriverInfo.currentStopIndex || 0) + 1}` : "Going to Drop-off"}
                     </div>
                   )}
                   <button onClick={() => setShowRideInfo(true)} className="bg-blue-600 rounded-full px-5 py-1.5 flex items-center justify-center font-black text-[13px] text-white tracking-widest border border-blue-500 shadow-md shadow-blue-500/20 active:scale-95 transition-transform uppercase shrink-0 drop-shadow-sm">
                      Ride Info
                   </button>
                </div>
                <AnimatePresence>
                   {assignedDriverInfo?.stackedDriverDelay && assignedDriverInfo.status === "accepted" && (
                       <motion.div
                          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 shadow-sm"
                       >
                         <h3 className="font-black text-amber-900 text-[15px] mb-1 flex items-center gap-2">
                           <AlertCircle className="w-4 h-4" /> Driver Delayed
                         </h3>
                         <p className="text-amber-800 text-[13px] font-semibold mb-3 leading-snug">
                           Your driver's current trip has been extended by {assignedDriverInfo.stackedDriverDelay} mins. Would you like to keep waiting or find another driver?
                           {nearbyDriversCount === 0 && driversAvailableSoonCount === 0 && (
                             <span className="block mt-1.5 text-amber-900 bg-amber-200/50 p-2 rounded-lg font-bold">
                               Note: There are currently no other drivers available in your area (15-20+ min wait expected).
                             </span>
                           )}
                         </p>
                         <div className="flex gap-3">
                           <button onClick={handleKeepWaiting} className="flex-1 py-2.5 px-3 bg-[#f59e0b] text-white rounded-[12px] font-bold text-sm active:scale-95 transition-transform shadow-sm">Keep Waiting</button>
                           <button onClick={handleFindAnotherDriver} className="flex-1 py-2.5 px-3 bg-white border border-amber-300 text-amber-800 rounded-[12px] font-bold text-sm active:scale-95 transition-transform">Find Another</button>
                         </div>
                       </motion.div>
                   )}
                </AnimatePresence>
                
                {(assignedDriverInfo?.status === "arrived") && (
                  <div className="flex overflow-x-auto no-scrollbar gap-2 mb-3 w-full pb-1">
                    {["I'm coming!", "Be there in 2 mins", "Wait for me", "I'm outside"].map((msg, i) => {
                      const isOnCooldown = disabledQuickMessages.includes(msg);
                      return (
                      <button 
                        key={i} 
                        onClick={() => handleSendQuickMessage(msg)}
                        disabled={isOnCooldown}
                        className={`whitespace-nowrap px-4 py-2 ${isOnCooldown ? 'bg-slate-300 border-white/20 text-slate-500 cursor-not-allowed opacity-60' : 'bg-slate-800 border-slate-700 text-white shadow-sm active:scale-95 transition-transform'} font-bold text-[13px] rounded-[12px]`}
                      >
                        {msg} {isOnCooldown && "⏳"}
                      </button>
                    )})}
                  </div>
                )}
                
                {assignedDriverInfo?.status === "arrived" ? (
                  <div className="flex items-center justify-between mb-4 bg-[#faf5ff] border border-[#d8b4fe] rounded-[16px] p-2.5 shadow-[0_2px_10px_-4px_rgba(168,85,247,0.15)] relative overflow-hidden">
                     {/* Decorative background accent */}
                     <div className="absolute top-0 right-0 w-24 h-24 bg-purple-200/40 rounded-full blur-xl -mt-8 -mr-8 pointer-events-none" />
                     <div className="absolute bottom-0 left-0 w-16 h-16 bg-fuchsia-200/30 rounded-full blur-lg -mb-6 -ml-6 pointer-events-none" />
                     
                     <div className="flex items-center gap-3 relative z-10">
                        <div className="w-9 h-9 bg-white border border-purple-200 rounded-full flex items-center justify-center shadow-sm shrink-0">
                           <Clock className="w-5 h-5 text-purple-600 animate-pulse" />
                        </div>
                        <div>
                          <h2 className="text-[17px] font-black text-purple-950 tracking-tight leading-none mb-0.5">Driver Outside</h2>
                          <p className="text-purple-700/80 font-bold text-[11px] leading-none mt-0.5">Please meet your driver now.</p>
                        </div>
                     </div>
                     {assignedDriverInfo?.arrivedAt && (
                       <div className="bg-white border border-purple-200 px-2.5 py-1.5 rounded-lg text-purple-900 font-bold text-xs shadow-sm relative z-10 flex flex-col items-center justify-center min-w-[68px]">
                         <PassengerTimer arrivedAt={assignedDriverInfo.arrivedAt} />
                       </div>
                     )}
                  </div>
                ) : (
                  <AnimatePresence>
                     {assignedDriverInfo?.isFinishingTrip && assignedDriverInfo?.status === "accepted" && (
                       <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-4">
                         <div className="bg-[#f0fdf4] border border-[#bbf7d0]/60 text-[#166534] px-4 py-2.5 rounded-[12px] text-[13px] font-semibold flex items-center justify-center gap-2 shadow-[0_2px_4px_-1px_rgba(0,0,0,0.05)]">
                           <span className="relative flex h-2.5 w-2.5">
                             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                             <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                           </span>
                           Finishing a trip nearby. Will head to you soon.
                         </div>
                       </motion.div>
                     )}
                  </AnimatePresence>
                )}

                <div className="flex items-start gap-2.5">
                  <div className="w-[48px] h-[48px] bg-slate-100 rounded-full border border-black shadow-sm shrink-0 overflow-hidden">
                     <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${assignedDriverInfo?.name || "driver"}`} alt="Driver" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                     <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-[16px] text-slate-900 leading-tight truncate">{assignedDriverInfo?.name || "Sim Driver"}</p>
                          <div className="flex items-center gap-1 shrink-0">
                             <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                             <span className="text-[13px] font-bold text-slate-700">{assignedDriverInfo?.rating || "4.8"}</span>
                          </div>
                        </div>
                        <p className="text-[13px] font-medium text-slate-600 truncate mt-0.5">{assignedDriverInfo?.vehicle || "Silver Toyota"}</p>
                     </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0 pl-1">
                     <p className="text-[9px] font-black text-black uppercase tracking-wider mb-1.5">License plate</p>
                     <div className="flex border-2 border-slate-900 rounded-[8px] overflow-hidden shadow-sm h-8">
                        <div className="bg-blue-700 w-4 flex flex-col items-center justify-center pointer-events-none">
                           <span className="text-[7px] text-yellow-400 font-bold leading-none">UK</span>
                        </div>
                        <div className="bg-[#ffcc00] px-2 flex items-center justify-center">
                           <p className="font-mono font-black text-slate-900 text-[15px] tracking-wider uppercase">{assignedDriverInfo?.plate || "SIM 123"}</p>
                        </div>
                     </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                   <div className="bg-slate-100/80 p-2.5 rounded-[12px] border border-black flex flex-col items-center justify-center">
                      {(assignedDriverInfo?.status === "in_progress" || assignedDriverInfo?.status === "awaiting_payment") ? (
                        <>
                           <p className="text-[13px] font-semibold text-slate-600 mb-0.5">Dropoff ETA</p>
                           <p className="text-[17px] font-black text-slate-900 tracking-wider leading-none">
                             {(liveEtaSeconds !== null && liveEtaSeconds > 0) ? `${Math.floor(liveEtaSeconds / 60) > 0 ? Math.floor(liveEtaSeconds / 60) + 'm ' : ''}${liveEtaSeconds % 60}s` : "Calculating..."}
                           </p>
                        </>
                      ) : assignedDriverInfo?.requirePasscode === false ? (
                        <>
                           <p className="text-[13px] font-semibold text-slate-600 mb-0.5">PIN Check</p>
                           <p className="text-[15px] font-black text-emerald-600 tracking-wider leading-none">Not Required</p>
                        </>
                      ) : (
                        <>
                           <p className="text-[13px] font-semibold text-slate-600 mb-0.5">Passcode</p>
                           <p className="text-[17px] font-black text-slate-900 tracking-wider leading-none">{assignedDriverInfo?.code || "1234"}</p>
                           <p className="text-[9px] font-bold uppercase text-slate-400 mt-1">Last 4 digits of<br/>phone if offline</p>
                        </>
                      )}
                   </div>
                   <div className="bg-slate-100/80 p-2.5 rounded-[12px] border border-black flex flex-col items-center justify-center text-center">
                      <p className="text-[13px] font-semibold text-slate-600 mb-0.5">Total Estimate</p>
                      <p className="text-[17px] font-black text-slate-900 leading-none">
                        Total: £{((assignedDriverInfo?.fareEstimate || fareEstimate || 0) + ((assignedDriverInfo?.paidWaitSeconds || 0) / 60) * fareConfig.waitRatePerMinute + (assignedDriverInfo?.tipAmount || 0)).toFixed(2)}
                      </p>
                      
                      {assignedDriverInfo?.hasCardOnFile ? (
                        <div className="inline-block bg-white border-2 border-emerald-600 px-2 py-0.5 rounded-md shadow-sm mt-1.5">
                          <span className="text-emerald-700 text-[9px] font-black uppercase tracking-wider block leading-none">Auto Payment</span>
                        </div>
                      ) : (
                        <div className="inline-block bg-white border-2 border-orange-600 px-2 py-0.5 rounded-md shadow-sm mt-1.5">
                          <span className="text-orange-600 text-[10px] font-black uppercase tracking-wider block leading-none">QR Code</span>
                        </div>
                      )}

                      {((assignedDriverInfo?.tipAmount || 0) > 0 || isPriority) && (
                          <p className="text-[11px] font-bold text-slate-600 mt-1.5 leading-tight">
                              Includes{isPriority ? " £3.00 priority" : ""}{isPriority && (assignedDriverInfo?.tipAmount || 0) > 0 ? " & " : ""}{(assignedDriverInfo?.tipAmount || 0) > 0 ? `£${assignedDriverInfo!.tipAmount.toFixed(2)} tip` : ""}
                          </p>
                      )}
                   </div>
                </div>

                {!assignedDriverInfo?.hasCardOnFile && (
                  <button
                    disabled={assignedDriverInfo?.status !== "awaiting_payment"}
                    onClick={() => {
                       if (assignedDriverInfo?.status === "awaiting_payment" && assignedDriverInfo.paymentUrl) {
                          window.open(assignedDriverInfo.paymentUrl, "_blank");
                       }
                    }}
                    className={cn(
                      "w-full py-2.5 mt-3 rounded-xl font-bold text-[15px] transition-all flex items-center justify-center gap-2 border border-black",
                      assignedDriverInfo?.status === "awaiting_payment" ? "bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:bg-emerald-600 animate-[pulse_2s_ease-in-out_infinite]" : "bg-slate-100 text-slate-400 border border-black"
                    )}
                  >
                     <Zap className="w-4 h-4 fill-current" /> Pay by Card / Scan QR
                  </button>
                )}
                
                {(assignedDriverInfo?.status === "in_progress" || assignedDriverInfo?.status === "awaiting_payment") && (
                    <div className="relative mt-4 mb-2">
                      {selectedTip !== null && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="absolute bottom-[calc(100%+12px)] left-0 bg-emerald-50 border border-emerald-500 rounded-[12px] p-3 shadow-lg z-10 w-[240px]">
                           <p className="text-emerald-900 text-[13px] font-bold mb-2.5">Are you confirming you want to add a tip?</p>
                           <div className="flex gap-2">
                             <button onClick={() => { handleAddTip(selectedTip); setSelectedTip(null); }} className="flex-1 bg-emerald-600 border border-emerald-700 text-white text-[13px] font-bold py-1.5 rounded-[8px] active:scale-95 transition-transform">Yes</button>
                             <button onClick={() => setSelectedTip(null)} className="flex-1 bg-white border border-emerald-300 text-emerald-800 text-[13px] font-bold py-1.5 rounded-[8px] active:scale-95 transition-transform">No</button>
                           </div>
                        </motion.div>
                      )}
                      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                        {[2, 3, 5].map((amount) => {
                          const isApplied = (assignedDriverInfo?.tipAmount || 0) === amount;
                          const isPending = selectedTip === amount;
                          const isHighlighted = isApplied || isPending;
                          
                          return (
                            <button key={amount} onClick={() => { 
                                if (assignedDriverInfo?.status === "awaiting_payment" || isApplied) return;
                                if (selectedTip === amount) {
                                  setSelectedTip(null);
                                } else {
                                  setSelectedTip(amount); 
                                  setCustomTip(""); 
                                }
                              }}
                              className={cn("px-5 py-2.5 rounded-[12px] font-bold text-[15px] transition-all shrink-0", isHighlighted ? "bg-emerald-600 text-white shadow-[0_2px_10px_rgba(5,150,105,0.3)] border border-emerald-700" : "bg-[#e2e8f0] text-[#0a1930] border border-transparent", assignedDriverInfo?.status === "awaiting_payment" || isApplied ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-300")}
                            >
                              £{amount}
                            </button>
                          );
                        })}
                        <button onClick={() => {
                            if (assignedDriverInfo?.status === "awaiting_payment") return;
                            setShowCustomTipKeypad(true);
                          }}
                          className={cn("px-5 py-2.5 rounded-[12px] font-bold text-[15px] transition-all shrink-0", 
                            ((assignedDriverInfo?.tipAmount || 0) > 0 && ![2, 3, 5].includes(assignedDriverInfo?.tipAmount || 0)) ? "bg-emerald-600 text-white shadow-[0_2px_10px_rgba(5,150,105,0.3)] border border-emerald-700" : "bg-[#e2e8f0] text-[#0a1930] border border-transparent", assignedDriverInfo?.status === "awaiting_payment" ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-300")}
                        >
                          {((assignedDriverInfo?.tipAmount || 0) > 0 && ![2, 3, 5].includes(assignedDriverInfo?.tipAmount || 0)) ? `£${assignedDriverInfo!.tipAmount.toFixed(2)}` : "Custom"}
                        </button>
                     </div>
                   </div>
                )}
                
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setIsChatOpen(true)} className="relative flex-1 py-3 bg-[#0a1930] border border-white/20 rounded-[16px] flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                    <MessageSquare className="w-[22px] h-[22px] text-white" />
                    {unreadChatCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-black items-center justify-center text-[8px] font-bold text-white shadow-sm">
                          {unreadChatCount}
                        </span>
                      </span>
                    )}
                  </button>
                  <a href={`tel:${assignedDriverInfo?.phone || ""}`} className="flex-1 py-3 bg-white border border-black rounded-[16px] flex items-center justify-center shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] active:scale-95 transition-transform"><Phone className="w-[22px] h-[22px] text-[#0a1930]" /></a>
                  <button onClick={() => setIsMapFullScreen(true)} className="flex-[2] py-3 bg-[#0a1930] border border-white/20 text-white rounded-[16px] font-bold text-[15px] shadow-lg shadow-blue-900/20 active:scale-[0.98] transition-transform">Track Live Driver</button>
                </div>
                
                {assignedDriverInfo?.status !== "in_progress" && assignedDriverInfo?.status !== "awaiting_payment" && assignedDriverInfo?.status !== "awaiting_cash_confirm" && (
                  <div className="flex gap-3 mt-4">
                    <button onClick={() => { setIsEditingJourney(true); }} className="flex-[1.1] py-[18px] border border-black bg-[#4fa764] text-white rounded-[16px] font-bold text-[15px] shadow-lg shadow-green-900/10 active:scale-[0.98] transition-transform">Edit Ride Options</button>
                    <div className="flex-1">
                      <CancelRideButton_ConfirmedPhase 
                        acceptedAt={assignedDriverInfo?.acceptedAt || Date.now()} 
                        arrivedAt={assignedDriverInfo?.arrivedAt}
                        status={assignedDriverInfo?.status}
                        onCancel={handleCancelConfirmed} 
                      />
                    </div>
                  </div>
                )}
                
                {assignedDriverInfo?.status === "in_progress" && (
                  <div className="mt-3">
                    <button onClick={() => { setIsEditingJourney(true); }} className="w-full py-2.5 border border-black bg-[#4fa764] text-white rounded-[16px] font-bold text-[14px] shadow-sm active:scale-[0.98] transition-transform">Edit Journey Options</button>
                  </div>
                )}
                

                
                <AnimatePresence>
                  {assignedDriverInfo?.status === "awaiting_cash_confirm" && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
                      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white relative rounded-[2rem] p-6 w-full max-w-[340px] shadow-2xl flex flex-col items-center border border-black">
                         <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-400 to-orange-500 rounded-t-full"></div>
                         
                         <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-5 border-4 border-white shadow-sm -mt-10">
                            <span className="text-3xl">💵</span>
                         </div>
                         
                         <div className="text-center mb-6 w-full">
                           <h3 className="text-[20px] font-black text-slate-900 leading-tight mb-2 tracking-tight">Confirm Cash Payment</h3>
                           <p className="text-[13.5px] text-slate-600 font-medium leading-snug">
                             Your driver indicated that they received £{(assignedDriverInfo?.reportedCashCollected || 0).toFixed(2)} in cash.
                           </p>
                         </div>
                         
                         <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6">
                            <div className="flex justify-between items-center mb-3">
                               <span className="text-[13px] font-bold text-slate-500">Total Fare</span>
                               <span className="text-[14.5px] font-black text-slate-800">£{(assignedDriverInfo?.fareEstimate || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center mb-3">
                               <span className="text-[13px] font-bold text-slate-500">Cash Checked</span>
                               <span className="text-[14.5px] font-black text-orange-600">-£{(assignedDriverInfo?.reportedCashCollected || 0).toFixed(2)}</span>
                            </div>
                            <div className="h-px bg-slate-200 w-full mb-3" />
                            <div className="flex justify-between items-center">
                               <span className="text-[13px] font-bold text-slate-700">Remainder</span>
                               <span className="text-[16px] font-black text-slate-900">£{(assignedDriverInfo?.reportedCashDiscrepancy || 0).toFixed(2)}</span>
                            </div>
                         </div>
                         
                         <div className="bg-orange-50 text-orange-800 text-[11px] font-bold p-3 rounded-xl w-full text-center border border-orange-200 mb-6">
                            The remainder will be added to your pending account balance for the next trip.
                         </div>

                         <button 
                            onClick={async () => {
                               if (currentRideId) {
                                  await updateDoc(doc(db, "ride_requests", currentRideId), {
                                     status: "cash_confirmed"
                                   });
                                   
                                   const finalAmountHandled = assignedDriverInfo?.reportedCashDiscrepancy || 0;
                                   if (profile?.uid && finalAmountHandled > 0) {
                                      try {
                                         const freshSnap = await getDoc(doc(db, "ride_requests", currentRideId));
                                         if (freshSnap.exists() && !freshSnap.data().pendingChargesApplied) {
                                            await updateDoc(doc(db, "users", profile.uid), {
                                               pendingCharges: increment(finalAmountHandled),
                                               pendingChargesReason: "Unpaid cash trip remainder"
                                            });
                                            await updateDoc(doc(db, "ride_requests", currentRideId), {
                                               status: "completed",
                                               paymentMethod: "cash",
                                               completedAt: serverTimestamp(),
                                               finalFare: assignedDriverInfo?.fareEstimate || 0,
                                               reportedCashCollected: assignedDriverInfo?.reportedCashCollected || 0,
                                               reportedCashDiscrepancy: finalAmountHandled,
                                               pendingChargesApplied: true
                                            });
                                            toast.success("Cash balance remainder recorded successfully!");
                                         }
                                      } catch (e) {
                                         console.error("Failed to apply cash balance to rider profile:", e);
                                      }
                                   } else {
                                      await updateDoc(doc(db, "ride_requests", currentRideId), {
                                         status: "completed",
                                         paymentMethod: "cash",
                                         completedAt: serverTimestamp(),
                                         finalFare: assignedDriverInfo?.fareEstimate || 0,
                                         reportedCashCollected: assignedDriverInfo?.reportedCashCollected || 0,
                                         reportedCashDiscrepancy: 0,
                                         pendingChargesApplied: true
                                      });
                                   }
                                   
                                   await updateDoc(doc(db, "ride_requests", currentRideId), {
                                      dummyCheckForCloseBracketHack: true
                                  });
                               }
                            }}
                            className="w-full bg-[#1e293b] text-white rounded-[16px] font-black text-[15px] h-[52px] shadow-lg hover:bg-black transition-all border border-black mb-2"
                         >
                            CONFIRM ENTRY
                         </button>

                         <button 
                            onClick={async () => {
                               if (currentRideId && confirm("Stuck on cash verification? Clicking this will immediately complete the ride and clear it. Proceed?")) {
                                  const finalAmountHandled = assignedDriverInfo?.reportedCashDiscrepancy || 0;
                                  
                                  await updateDoc(doc(db, "ride_requests", currentRideId), {
                                     status: "completed",
                                     paymentMethod: "cash",
                                     completedAt: serverTimestamp(),
                                     finalFare: assignedDriverInfo?.fareEstimate || 0,
                                     reportedCashCollected: assignedDriverInfo?.reportedCashCollected || 0
                                  });
                                  
                                  if (profile?.uid && finalAmountHandled > 0) {
                                     await updateDoc(doc(db, "users", profile.uid), {
                                        pendingCharges: increment(finalAmountHandled),
                                        pendingChargesReason: "Unpaid cash trip remainder"
                                     });
                                  }
                                  
                                  toast.success("Ride force-completed and cleared successfully!");
                               }
                            }}
                            className="w-full text-rose-600 hover:text-rose-800 font-extrabold text-[12px] py-2 text-center transition-all bg-rose-50 hover:bg-rose-100 rounded-xl mt-1.5 border border-rose-200/60"
                         >
                            🚨 Stuck? Force Complete & Clear Ride
                         </button>
                      </motion.div>
                    </div>
                  )}

                  {showCancelPrompt && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[2px]">
                      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white w-full max-w-sm rounded-[24px] p-6 shadow-2xl border border-black">
                        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4">
                          <AlertCircle className="w-6 h-6 text-red-500" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">Cancel Ride?</h3>
                        <p className="text-[13px] font-medium text-slate-600 mb-6 leading-relaxed">
                          {cancelFeeToApply > 0 ? (
                            <>Your driver has been on the way for over 2 minutes. A cancellation fee of <span className="text-slate-900 font-bold">£{cancelFeeToApply.toFixed(2)}</span> will apply.</>
                          ) : (
                            <>Are you sure you want to cancel your ride? No cancellation fee will be charged at this time.</>
                          )}
                        </p>
                        <div className="flex gap-3">
                          <button onClick={handleCancelConfirmed} className="flex-1 py-3 bg-red-500 text-white rounded-[12px] font-bold hover:bg-red-600 transition-colors shadow-[0_4px_14px_0_rgba(239,68,68,0.2)]">Yes, Cancel</button>
                          <button onClick={() => setShowCancelPrompt(false)} className="flex-1 py-3 bg-slate-100 rounded-[12px] font-bold text-slate-700 hover:bg-slate-200 transition-colors">Go Back</button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {showCustomTipKeypad && (
                    <motion.div initial={{ opacity: 0, y: "100%" }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: "100%" }} className="fixed inset-0 z-[200] bg-[#f8fafc] flex flex-col pointer-events-auto h-full overflow-hidden">
                      <div className="flex items-center justify-between p-4 pb-2 pt-[env(safe-area-inset-top,20px)] shrink-0">
                         <div className="w-10"></div>
                         <h2 className="text-xl font-bold text-[#0a1930] mb-0">Custom Tip</h2>
                         <button onClick={() => setShowCustomTipKeypad(false)} className="w-10 h-10 bg-slate-200/60 rounded-full flex items-center justify-center active:scale-95 transition-transform">
                           <X className="w-5 h-5 text-slate-800" />
                         </button>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto w-full px-6 pt-4 pb-[calc(20px+env(safe-area-inset-bottom,0px))] flex flex-col">
                        <div className="bg-white border text-center border-black rounded-[20px] py-10 shadow-sm mb-6 shrink-0">
                           <span className="text-6xl font-black tracking-tight text-[#0a1930]">£{customTip || "0.00"}</span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-y-4 gap-x-4 max-w-[280px] mx-auto w-full mb-6 shrink-0">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0, 'del'].map((key) => (
                             <button key={key} onClick={() => {
                                if (key === 'del') {
                                   setCustomTip(prev => prev.slice(0, -1));
                                   return;
                                }
                                const newValue = customTip + key.toString();
                                if (parseFloat(newValue) > 50) {
                                   toast.error("Maximum allowed tip is £50");
                                   return;
                                }
                                if (newValue.includes('.')) {
                                   const parts = newValue.split('.');
                                   if (parts[1].length > 2) return;
                                }
                                setCustomTip(newValue);
                                setSelectedTip(null);
                             }} className="h-16 rounded-full bg-[#0a1930] text-white text-[28px] font-semibold flex items-center justify-center active:scale-90 transition-transform">
                               {key === 'del' ? <Delete className="w-7 h-7" /> : key}
                             </button>
                          ))}
                        </div>
                        
                        <div className="mt-auto px-6 pb-2 shrink-0">
                           <p className="text-center text-slate-700 font-medium text-[15px] mb-4">Your driver receives 100% of the tip.</p>
                           <button onClick={() => {
                              const amount = parseFloat(customTip);
                              if (amount > 0) {
                                handleAddTip(amount);
                                setSelectedTip(null);
                                setShowCustomTipKeypad(false);
                              }
                           }} disabled={!customTip || parseFloat(customTip) <= 0} className="w-full py-4 rounded-[16px] bg-[#0a1930] text-white font-black text-lg shadow-lg active:scale-95 transition-transform disabled:opacity-50 disabled:active:scale-100">
                             Add Tip
                           </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="shrink-0 h-[calc(6rem+env(safe-area-inset-bottom,0px))] w-full mt-auto" />
              </motion.div>
              </>
            )}

            {step === "receipt" && completedRideData && (
              <motion.div key="receipt" initial={{ y: "100%" }} animate={{ y: 0 }} className="bg-card rounded-t-[40px] border border-border-main pointer-events-auto h-full w-full overflow-hidden relative z-[200] flex flex-col shadow-2xl">
                <div className="flex-1 overflow-y-auto w-full p-6 no-scrollbar pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
                  <div className="flex justify-between items-center mb-6">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Check className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h3 className="text-2xl font-black text-text-main flex-1 ml-4 tracking-tight">Trip Completed</h3>
                  <button onClick={() => toast.success("Receipt downloaded!")} className="w-10 h-10 rounded-full bg-surface border border-border-main flex items-center justify-center text-text-muted hover:text-text-main hover:bg-surface-hover">
                    <ArrowDownToLine className="w-5 h-5" />
                  </button>
                </div>

                <div className="bg-surface rounded-3xl p-5 mb-6 border border-black shadow-sm flex flex-col items-center text-center">
                  <p className="text-[10px] font-black tracking-widest uppercase text-text-muted mb-2">Total Paid</p>
                  <h2 className="text-5xl font-black text-text-main tracking-tighter">£{completedRideData.finalFare?.toFixed(2) || ((completedRideData.fareEstimate || fareConfig.baseFare) + (((completedRideData.paidWaitSeconds || 0) / 60) * fareConfig.waitRatePerMinute) + (completedRideData.tipAmount || 0) + (completedRideData.unpaidCancellationFeesOwed || completedRideData.cancellationFee || 0)).toFixed(2)}</h2>
                  <div className="flex gap-2 mt-3 items-center">
                    <p className="text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-md leading-none flex items-center">
                       <Check className="w-3.5 h-3.5 mr-1" />
                       Successful
                    </p>
                    {completedRideData.paymentMethod === 'stripe_auto' || (!completedRideData.paymentMethod && completedRideData.hasCardOnFile) ? (
                      <div className="inline-block bg-white border-2 border-emerald-600 px-2 py-1 rounded-md shadow-sm">
                        <span className="text-emerald-700 text-[10px] font-black uppercase tracking-wider block leading-none">Auto Payment</span>
                      </div>
                    ) : completedRideData.paymentMethod === 'stripe_qr' || (!completedRideData.paymentMethod && !completedRideData.hasCardOnFile) ? (
                      <div className="inline-block bg-white border-2 border-orange-600 px-2 py-1 rounded-md shadow-sm">
                        <span className="text-orange-600 text-[10px] font-black uppercase tracking-wider block leading-none">QR Code</span>
                      </div>
                    ) : completedRideData.paymentMethod === 'cash' ? (
                      <div className="inline-block bg-white border-2 border-slate-600 px-2 py-1 rounded-md shadow-sm">
                        <span className="text-slate-700 text-[10px] font-black uppercase tracking-wider block leading-none">Cash</span>
                      </div>
                    ) : (
                      <div className="inline-block bg-white border-2 border-emerald-600 px-2 py-1 rounded-md shadow-sm">
                        <span className="text-emerald-700 text-[10px] font-black uppercase tracking-wider block leading-none">Auto Payment</span>
                      </div>
                    )}
                  </div>
                  {((completedRideData.tipAmount || 0) > 0 || completedRideData.isPriority) && (
                      <p className="text-[12px] font-bold text-slate-500 mt-3 leading-tight">
                          Includes{completedRideData.isPriority ? " £3.00 priority" : ""}{completedRideData.isPriority && (completedRideData.tipAmount || 0) > 0 ? " & " : ""}{(completedRideData.tipAmount || 0) > 0 ? `£${completedRideData.tipAmount.toFixed(2)} tip` : ""}
                      </p>
                  )}
                </div>

                <p className="text-[10px] font-black uppercase text-text-muted tracking-widest mb-3 border-b border-border-main pb-2">Receipt Breakdown</p>
                <div className="space-y-3 flex-1 mb-4">
                  <div className="flex justify-between text-sm font-bold text-text-muted">
                    <span>Base Fare & Distance</span>
                    <span className="text-text-main">£{(completedRideData.finalFare ? completedRideData.finalFare - (completedRideData.tipAmount || 0) - (completedRideData.unpaidCancellationFeesOwed || completedRideData.cancellationFee || 0) - (completedRideData.isPriority ? 3 : 0) - (completedRideData.isPetFriendly ? 3 : 0) - (((completedRideData.paidWaitSeconds || 0) / 60) * fareConfig.waitRatePerMinute) : ((completedRideData.fareEstimate || fareConfig.baseFare) - (completedRideData.unpaidCancellationFeesOwed || completedRideData.cancellationFee || 0) - (completedRideData.isPriority ? 3 : 0) - (completedRideData.isPetFriendly ? 3 : 0))).toFixed(2)}</span>
                  </div>
                  {completedRideData.isPriority && (
                    <div className="flex justify-between text-sm font-bold text-blue-600">
                      <span>Priority Boost</span>
                      <span>+£3.00</span>
                    </div>
                  )}
                  {completedRideData.isPetFriendly && (
                    <div className="flex justify-between text-sm font-bold text-orange-600">
                      <span>Pet Friendly</span>
                      <span>+£3.00</span>
                    </div>
                  )}
                  {((completedRideData.paidWaitSeconds || 0) > 0) && (
                    <div className="flex justify-between text-sm font-bold text-[#FF9500]">
                      <span>Paid Wait ({Math.floor((completedRideData.paidWaitSeconds || 0) / 60)}m)</span>
                      <span>+£{(((completedRideData.paidWaitSeconds || 0) / 60) * fareConfig.waitRatePerMinute).toFixed(2)}</span>
                    </div>
                  )}
                  {((completedRideData.unpaidCancellationFeesOwed || completedRideData.cancellationFee || 0) > 0) && (
                    <div className="flex justify-between text-sm font-bold text-danger">
                      <span>Unpaid Cancellation Fee</span>
                      <span>+£{(completedRideData.unpaidCancellationFeesOwed || completedRideData.cancellationFee).toFixed(2)}</span>
                    </div>
                  )}
                  {(completedRideData.tipAmount || 0) > 0 && (
                    <div className="flex justify-between text-sm font-bold text-emerald-600">
                      <span>Driver Tip</span>
                      <span>+£{completedRideData.tipAmount.toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div className="border-t border-dashed border-border-main my-4 pt-4 flex justify-between">
                    <div>
                      <p className="text-xs font-bold text-text-muted text-left mb-1">Driver</p>
                      <p className="text-sm font-black text-text-main text-left">{completedRideData.driverName || "AnyRoller Driver"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text-muted text-right mb-1">Date</p>
                      <p className="text-sm font-black text-text-main text-right">{completedRideData.completedAt ? new Date(completedRideData.completedAt.toMillis ? completedRideData.completedAt.toMillis() : Date.now()).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                </div>
                
                {!hasSubmittedReview ? (
                   <div className="mb-6 bg-slate-50 rounded-xl p-3 border border-black shadow-sm mx-auto w-full max-w-[280px]">
                     <p className="text-center text-xs font-bold text-slate-600 mb-2">Rate your driver</p>
                     <div className="flex justify-center gap-1 mb-2">
                       {[1, 2, 3, 4, 5].map((star) => (
                         <button
                           key={star}
                           onClick={() => setRideRating(star)}
                           className="p-1 hover:scale-110 active:scale-95 transition-transform"
                         >
                           <Star className={cn("w-6 h-6 transition-colors", star <= rideRating ? "text-amber-400 fill-amber-400" : "text-slate-300 hover:text-amber-400 fill-transparent hover:fill-amber-400")} />
                         </button>
                       ))}
                     </div>
                     
                     <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex flex-col gap-3 overflow-hidden mt-2">
                         <div className="flex overflow-x-auto no-scrollbar gap-1.5 justify-start px-0.5 pb-1">
                           {(rideRating >= 4 ? ["Smooth Navigator", "Clean Car", "Great Conversation", "Expert Route"] : ["Unclean", "Navigation Issues", "Driving Safety", "Rude", "Late"]).map((tag) => (
                              <button 
                                key={tag} 
                                onClick={() => setSelectedReviewTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                                className={cn("px-2.5 border whitespace-nowrap flex-none py-1 rounded-full text-xs font-bold transition-colors shadow-sm", selectedReviewTags.includes(tag) ? (rideRating >= 4 ? "bg-[#f0f9ff] text-[#0369a1] border-[#bae6fd]" : "bg-rose-50 text-rose-700 border-rose-200") : "bg-white text-slate-600 border-black")}
                              >
                                {tag}
                              </button>
                           ))}
                         </div>
                         
                         {rideRating < 5 && (
                           <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                              <p className="text-[11px] font-black text-slate-500 mb-1.5 ml-1 uppercase tracking-widest pl-1">Add a comment</p>
                              <textarea 
                                className="w-full bg-white border border-black rounded-xl p-3.5 text-[15px] font-medium text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none transition-all shadow-sm"
                                rows={3}
                                placeholder="Tell us more about your experience..."
                                value={reviewComment}
                                onChange={(e) => setReviewComment(e.target.value)}
                              />
                           </motion.div>
                         )}

                         {rideRating <= 2 && (
                             <button 
                               onClick={async () => {
                                 if (!completedRideData?.id || !user) {
                                  toast.error("Ride data missing."); 
                                  return;
                                 }
                                 try {
                                   await addDoc(collection(db, "support_tickets"), {
                                     subject: "High Priority: Passenger Safety Report",
                                     preview: "Passenger flagged a critical safety issue during driver review.",
                                     userId: user.uid,
                                     userRole: "rider",
                                     status: "open",
                                     priority: "high",
                                     rideId: completedRideData.id,
                                     driverId: completedRideData.driverId,
                                     createdAt: serverTimestamp()
                                   });
                                   toast.success("Safety issue reported. Master Admin has been notified immediately.");
                                 } catch(e) {
                                   console.error(e);
                                   toast.error("Failed to sequence safety alert.");
                                 }
                               }}
                               className="flex items-center justify-center gap-2 w-full py-2 bg-rose-50 text-rose-600 font-bold rounded-xl border border-rose-100 mt-2 hover:bg-rose-100 transition-colors"
                             >
                               <AlertCircle className="w-4 h-4" /> Report a Safety Issue
                             </button>
                         )}
                     </motion.div>
                   </div>
                ) : (
                   <div className="mb-6 bg-emerald-50 rounded-2xl p-4 border border-emerald-200 flex flex-col items-center justify-center">
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mb-2">
                         <MapPin className="w-5 h-5 text-emerald-600" />
                      </div>
                      <p className="text-sm font-bold text-emerald-800 text-center">Thank you for your feedback!</p>
                      <p className="text-[11px] text-emerald-600 mt-1 text-center">Your anonymous review helps us keep the community safe.</p>
                   </div>
                )}

                  <button 
                    onClick={async () => {
                      if (!hasSubmittedReview) {
                        await handleSubmitReview();
                      }
                      setStep("details"); 
                      setCompletedRideData(null); 
                      setRideRating(5);
                      setSelectedReviewTags([]);
                      setReviewComment("");
                      setHasSubmittedReview(false);
                      setIsSubmittingReview(false);
                      setPickup("");
                      setDropoff("");
                      setPickupCoords(null);
                      setDropoffCoords(null);
                      setDistanceMiles(0);
                      setStops([]);
                      setRouteLine([]);
                      setLiveRouteLine([]);
                      navigate("/my-rides", { replace: true, state: { tab: "completed" } });
                    }}
                    disabled={isSubmittingReview}
                    className="w-full py-4 mt-6 rounded-2xl bg-text-main text-card font-black active:scale-95 transition-transform disabled:bg-slate-700 shadow-[0_4px_24px_rgba(0,0,0,0.15)] pointer-events-auto"
                  >
                    {isSubmittingReview ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin"/> Submitting...</span> : "Done"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <AnimatePresence>
          {showDriverFoundOverlay && assignedDriverInfo && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[300] bg-white flex flex-col pointer-events-auto overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-white/50 pattern-bg pointer-events-none" />
              
              <button onClick={() => setShowDriverFoundOverlay(false)} className="absolute top-12 right-6 w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 z-10">
                <X className="w-5 h-5" />
              </button>

              <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
                <div className="relative mb-10 w-48 h-48 flex items-center justify-center">
                   <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.2, 0.5] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute inset-0 bg-emerald-400/20 rounded-full blur-xl" />
                   <div className="absolute inset-4 bg-emerald-500/10 rounded-full border-[6px] border-emerald-400" />
                   <div className="absolute inset-8 bg-emerald-100 rounded-full overflow-hidden shadow-2xl">
                     <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${assignedDriverInfo.name || "driver"}`} alt="Driver" className="w-full h-full object-cover" />
                   </div>
                   
                   {/* Fake confetti dots */}
                   {[...Array(12)].map((_, i) => (
                     <motion.div 
                       key={i}
                       initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                       animate={{ 
                         opacity: [0, 1, 0], 
                         scale: [0, 1, 0.5],
                         x: Math.random() * 200 - 100, 
                         y: Math.random() * -200 - 50 
                       }}
                       transition={{ duration: 2.5, repeat: Infinity, delay: Math.random() * 2 }}
                       className={cn("absolute w-2 h-2 rounded-sm", ["bg-blue-400", "bg-yellow-400", "bg-emerald-400", "bg-amber-400"][i % 4])}
                     />
                   ))}
                </div>

                <motion.h2 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="text-4xl font-black text-[#0a1930] tracking-tight mb-3 text-center">
                  Driver Found!
                </motion.h2>

                <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="text-lg font-medium text-slate-700 text-center max-w-[320px] leading-relaxed">
                  <span className="font-bold">{assignedDriverInfo.name?.split(' ')[0] || "Driver"}</span> is on {assignedDriverInfo.name && assignedDriverInfo.name.toLowerCase().includes("sim") || assignedDriverInfo.name && assignedDriverInfo.name.toLowerCase().includes("sara") ? "her" : "their"} way in a <br/>
                  <span className="font-bold text-xl inline-block mt-1">{assignedDriverInfo.vehicle || "Silver Toyota"}</span>
                </motion.p>
                
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35 }} className="mt-8">
                  <div className="flex border-2 border-slate-900 rounded-[12px] overflow-hidden shadow-xl h-14 w-fit mx-auto">
                     <div className="bg-blue-700 w-8 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[12px] text-white font-bold leading-none">UK</span>
                     </div>
                     <div className="bg-[#ffcc00] px-5 flex items-center justify-center">
                        <p className="font-mono font-black text-slate-900 text-3xl tracking-widest uppercase">{assignedDriverInfo.plate || "SIM 123"}</p>
                     </div>
                  </div>
                </motion.div>
              </div>

              <div className="p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] relative z-10 w-full mt-auto flex flex-col items-center">
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-slate-500 font-bold mb-4 text-[13px] uppercase tracking-wider">
                  Proceeding to tracking in <span className="text-slate-700 font-black">{driverFoundCountdown}</span> sec
                </motion.p>
                <motion.button initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} onClick={() => setShowDriverFoundOverlay(false)} className="w-full py-4 rounded-[20px] bg-[#0a1930] text-white font-bold text-lg active:scale-[0.98] transition-transform shadow-[0_8px_30px_rgba(10,25,48,0.2)]">
                  Great!
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showRideInfo && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[600] pointer-events-auto bg-black/20" onPointerDown={() => setShowRideInfo(false)}>
              <motion.div 
                 onPointerDown={(e) => { e.stopPropagation(); setRideInfoTimerTick(t => t + 1); }}
                 initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} 
                 transition={{ type: "spring", damping: 25, stiffness: 300 }}
                 drag="y"
                 dragConstraints={{ top: 0, bottom: 0 }}
                 onDragEnd={(e, info) => {
                   if (info.offset.y > 50) setShowRideInfo(false);
                 }}
                 className="absolute inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-0 max-h-[85vh] bg-[#f4f7fa] rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.25)] flex flex-col pointer-events-auto overflow-hidden"
              >
                  {/* Handle */}
                  <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-4 shrink-0"/>
                  
                  {/* Header */}
                  <div className="p-4 pt-3 flex items-center justify-center border-b border-black shrink-0 bg-white relative shadow-sm z-10">
                     <h3 className="font-black text-[20px] text-[#0a1930]">
                        Ride Info
                     </h3>
                     <button onClick={() => setShowRideInfo(false)} className="absolute right-4 w-8 h-8 rounded-full bg-slate-100/80 flex items-center justify-center text-[#0a1930] active:scale-95 transition-transform hover:bg-slate-200">
                        <X className="w-4 h-4 cursor-pointer" />
                     </button>
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 no-scrollbar">
                     <div className="flex flex-col gap-1.5">
                        <p className="font-extrabold text-[#0a1930] text-[12px] uppercase tracking-wider pl-1">Pickup</p>
                        <div className="flex gap-3 items-center relative border-[2.5px] border-emerald-500 rounded-[10px] py-2.5 pl-3 pr-2 bg-white shadow-sm">
                           <div className="w-5 shrink-0 flex justify-center"><MapPin className="w-5 h-5 text-emerald-500 fill-emerald-500/20" /></div>
                           <div className="flex-1 min-w-0 pr-2">
                              <p className="text-[#0a1930] font-medium text-[15px] leading-snug truncate">{pickup || "Current address"}</p>
                           </div>
                           <button onClick={() => handleStarClick(pickup)} className="p-1.5 active:scale-90 transition-transform shrink-0 cursor-pointer">
                              <Bookmark className={cn("w-6 h-6", isFavorite(pickup) ? "fill-amber-400 text-amber-400" : "text-slate-400")} />
                           </button>
                        </div>
                     </div>
                     {stops.map((stop, i) => (
                        <div key={i} className="flex flex-col gap-1.5">
                           <p className="font-extrabold text-[#0a1930] text-[12px] uppercase tracking-wider pl-1">Stop {i + 1}</p>
                           <div className="flex gap-3 items-center relative border-[2.5px] border-amber-400 rounded-[10px] py-2.5 pl-3 pr-2 bg-white shadow-sm">
                              <div className="w-5 shrink-0 flex justify-center"><MapPin className="w-5 h-5 text-amber-500 fill-amber-500/20" /></div>
                              <div className="flex-1 min-w-0 pr-2">
                                 <p className="text-[#0a1930] font-medium text-[15px] leading-snug truncate">{stop.address}</p>
                              </div>
                              <button onClick={() => handleStarClick(stop.address)} className="p-1.5 active:scale-90 transition-transform shrink-0 cursor-pointer">
                                 <Bookmark className={cn("w-6 h-6", isFavorite(stop.address) ? "fill-amber-400 text-amber-400" : "text-slate-400")} />
                              </button>
                           </div>
                        </div>
                     ))}
                     <div className="flex flex-col gap-1.5">
                        <p className="font-extrabold text-[#0a1930] text-[12px] uppercase tracking-wider pl-1">Dropoff</p>
                        <div className="flex gap-3 items-center relative border-[2.5px] border-rose-600 rounded-[10px] py-2.5 pl-3 pr-2 bg-white shadow-sm">
                           <div className="w-5 shrink-0 flex justify-center"><MapPin className="w-5 h-5 text-rose-600 fill-rose-600" /></div>
                           <div className="flex-1 min-w-0 pr-2">
                              <p className="text-[#0a1930] font-medium text-[15px] leading-snug truncate">{dropoff || "Destination address"}</p>
                           </div>
                           <button onClick={() => handleStarClick(dropoff)} className="p-1.5 active:scale-90 transition-transform shrink-0 cursor-pointer">
                              <Bookmark className={cn("w-6 h-6", isFavorite(dropoff) ? "fill-amber-400 text-amber-400" : "text-slate-400")} />
                           </button>
                        </div>
                     </div>
                     
                     {(() => {
                        const base = Math.max(fareEstimate || 5.0, fareConfig.minFare);
                        const defaultMultipliers: Record<string, number> = { standard: 1.0, executive: 1.5, luxury: 2.2, '6seater': 1.4, '8seater': 2.0, wav: 2.5 };
                        const catMultiplier = fareConfig.vehicleMultipliers?.[selectedCategory] || defaultMultipliers[selectedCategory] || 1.0;
                        const vehicleSubtotal = Math.max((fareEstimate || 5.0) * catMultiplier, fareConfig.minFare * catMultiplier);
                        const vehicleExtra = vehicleSubtotal - base;
                        const finalFare = getComputedFare(selectedCategory);
                        const surgeExtra = finalFare - vehicleSubtotal;
                        return (
                           <div className="rounded-[16px] p-5 flex flex-col bg-white shadow-sm border border-black">
                              <p className="font-extrabold text-[#0a1930] text-[11px] uppercase tracking-wider border-b border-black pb-3 mb-3">Fare Breakdown</p>
                              <div className="flex justify-between items-center text-[15px] mb-2">
                                 <span className="text-[#0a1930]">Journey Fare</span>
                                 <span className="text-[#0a1930]">£{base.toFixed(2)}</span>
                              </div>
                              {vehicleExtra > 0 && (
                                <div className="flex justify-between items-center text-[15px] mb-2 text-slate-600">
                                   <span className="truncate pr-2">Vehicle Upgrade ({CAR_CATEGORIES.find(c => c.id === selectedCategory)?.name})</span>
                                   <span>+£{vehicleExtra.toFixed(2)}</span>
                                </div>
                              )}
                              {surgeExtra > 0 && (
                                <div className="flex justify-between items-center text-[15px] mb-2 text-red-600 font-bold">
                                   <span>High Demand Surge</span>
                                   <span>+£{surgeExtra.toFixed(2)}</span>
                                </div>
                              )}
                              {isPriority && (
                                <div className="flex justify-between items-center text-[15px] mb-2 text-[#2563EB] font-bold">
                                   <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-[#2563EB] fill-[#2563EB]"/> Priority</span>
                                   <span>+£3.00</span>
                                </div>
                              )}
                              {isPetFriendly && (
                                <div className="flex justify-between items-center text-[15px] mb-2 text-[#2563EB] font-bold">
                                   <span className="flex items-center gap-1.5"><Dog className="w-3.5 h-3.5 text-[#2563EB]"/> Pet</span>
                                   <span>+£3.00</span>
                                </div>
                              )}
                              {((assignedDriverInfo?.tipAmount || 0) > 0) && (
                                <div className="flex justify-between items-center text-[15px] mb-2 text-emerald-600 font-bold">
                                   <span>Driver Tip</span>
                                   <span>+£{(assignedDriverInfo?.tipAmount || 0).toFixed(2)}</span>
                                </div>
                              )}
                              <div className="flex justify-between items-center pt-3 border-t border-black mt-2">
                                 <span className="font-extrabold text-[#0a1930] text-[18px]">Total Estimate</span>
                                 <span className="font-black text-[#0a1930] text-[22px] tracking-tight">£{(finalFare + (isPriority ? 3 : 0) + (isPetFriendly ? 3 : 0) + (assignedDriverInfo?.tipAmount || 0)).toFixed(2)}</span>
                              </div>
                           </div>
                        )
                     })()}

                     {comments && (
                         <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <p className="font-black text-amber-900 text-[11px] uppercase tracking-wider mb-1 flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5"/> Note for driver</p>
                            <p className="font-medium text-amber-800 text-[13px] italic">{comments}</p>
                         </div>
                     )}
                     <div className="h-4 w-full shrink-0" />
                  </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {savingFavorite && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-black/40 pointer-events-auto">
                 <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white rounded-[24px] p-6 w-full max-w-[340px] shadow-2xl flex flex-col pointer-events-auto">
                     <h3 className="text-xl font-black text-[#0a1930] text-center mb-6 tracking-tight">Save Address</h3>
                     <input 
                        value={favoriteNameInput}
                        onChange={(e) => setFavoriteNameInput(e.target.value)}
                        placeholder="e.g. Home, Work, Sarah's House"
                        className="w-full border border-black rounded-[12px] px-4 py-3.5 text-[15px] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 mb-5 font-medium placeholder:text-slate-400"
                     />
                     <div className="flex flex-wrap gap-2 mb-8 justify-center">
                        {["Home", "Work", "Gym", "Other"].map(tag => (
                            <button key={tag} onClick={() => setFavoriteNameInput(tag)} className={cn("px-4 py-2 rounded-full text-[14px] font-bold border transition-colors flex items-center gap-1.5", favoriteNameInput === tag ? "bg-blue-100 border-blue-200 text-blue-800" : "bg-blue-50 border-blue-100 text-[#0a1930] hover:bg-blue-100")}>
                                {tag === "Home" && <Home className="w-4 h-4" />}
                                {tag === "Work" && <Briefcase className="w-4 h-4" />}
                                {tag === "Gym" && <Dumbbell className="w-4 h-4" />}
                                {tag === "Other" && <Bookmark className="w-4 h-4" />}
                                {tag}
                            </button>
                        ))}
                     </div>
                     <div className="flex gap-3 mt-auto">
                        <button onClick={() => setSavingFavorite(null)} className="flex-1 py-3.5 bg-white border border-[#0a1930] rounded-[12px] font-bold text-[#0a1930] text-[15px] active:scale-95 transition-transform">Cancel</button>
                        <button disabled={!favoriteNameInput.trim()} onClick={handleSaveFavorite} className="flex-1 py-3.5 bg-[#0a1930] border border-[#0a1930] rounded-[12px] font-bold text-white text-[15px] disabled:opacity-50 active:scale-95 transition-transform">Save</button>
                     </div>
                 </motion.div>
             </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showFavoriteSuccess && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-black/40 pointer-events-auto">
                 <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-gradient-to-b from-[#f0f7ff] to-white rounded-[32px] p-8 w-full max-w-[340px] shadow-2xl flex flex-col items-center text-center relative overflow-hidden pointer-events-auto">
                     <div className="relative mb-6 mt-4 w-32 h-32 flex items-center justify-center">
                        <div className="absolute inset-0 bg-yellow-400/20 blur-2xl rounded-full" />
                        <Bookmark className="w-24 h-24 text-amber-400 fill-amber-400 relative z-10" />
                        <div className="absolute -top-2 -left-2 w-2 h-2 bg-blue-400 rounded-full" />
                        <div className="absolute top-2.5 right-1 w-3 h-3 bg-green-400 rounded-full" />
                        <div className="absolute bottom-4 -right-2 w-2.5 h-2.5 bg-rose-400 rounded-full" />
                        <div className="absolute -bottom-2 left-4 w-2 h-2 bg-yellow-400 rounded-full" />
                     </div>
                     
                     <h3 className="text-[26px] font-black text-[#0a1930] mb-3 tracking-tight">Location Saved!</h3>
                     <p className="text-[16px] text-slate-600 font-medium mb-10 leading-snug px-2">
                         Your saved address "{showFavoriteSuccess.name}" is now available on your home screen.
                     </p>
                     
                     <button onClick={() => setShowFavoriteSuccess(null)} className="w-full py-4 bg-[#0a1930] rounded-[16px] font-bold text-white text-[16px] active:scale-95 transition-transform shadow-[0_4px_14px_rgba(10,25,48,0.3)]">
                        Done
                     </button>
                 </motion.div>
             </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isEditingJourney && (
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-0 z-[400] bg-white rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.2)] flex flex-col max-h-[85vh]">
                <div className="p-4 border-b border-black flex items-center justify-between shrink-0">
                    <h2 className="text-2xl font-black text-[#0a1930] tracking-tight">Edit Journey</h2>
                    <button onClick={() => setIsEditingJourney(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                   {/* Addresses */}
                   <div className="bg-slate-50 rounded-[20px] border border-black p-2 space-y-2">
                       {/* Pickup */}
                       <div className="flex flex-col relative w-full">
                         <div className={`flex bg-white border border-black rounded-xl px-2 py-1 items-center relative gap-2 transition-all ${assignedDriverInfo?.status === 'in_progress' ? 'opacity-70' : 'focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100'}`}>
                             <div className="w-6 shrink-0 flex justify-center"><div className="w-2.5 h-2.5 rounded-full border-2 border-emerald-500 bg-white" /></div>
                             {assignedDriverInfo?.status === 'in_progress' ? (
                                 <div className="flex-1 min-w-0 font-bold text-[15px] text-slate-800 py-3 ml-2 truncate">{pickup}</div>
                             ) : (
                                 <input 
                                     type="text" 
                                     value={pickup}
                                     onChange={(e) => { setPickup(e.target.value); setActiveField("pickup"); }}
                                     onFocus={() => setActiveField("pickup")}
                                     className="flex-1 min-w-0 font-bold bg-transparent border-none focus:outline-none text-[15px] text-slate-800 py-3 ml-2"
                                     placeholder="Pickup location"
                                 />
                             )}
                             {pickup && assignedDriverInfo?.status !== 'in_progress' && (
                                 <button onClick={() => { setPickup(""); setPickupCoords(null); setHasModifiedRouteByUser(true); }} className="p-2 text-slate-400 hover:text-slate-600 rounded-full shrink-0 outline-none"><X className="w-4 h-4" /></button>
                             )}
                         </div>
                         <AnimatePresence>
                           {activeField === "pickup" && (suggestions.length > 0 || isLoadingAddress) && (
                             <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="z-[60] mt-1 overflow-hidden rounded-2xl shadow-sm border border-black bg-white origin-top flex flex-col">
                               <div className="flex justify-between items-center bg-slate-50 border-b border-black px-3 py-2 shrink-0">
                                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Suggestions</span>
                                 <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveField(null); setSuggestions([]); }} className="p-1 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors shadow-sm active:scale-95"><X className="w-4 h-4" /></button>
                               </div>
                               <div className="text-sm max-h-56 overflow-y-auto flex flex-col no-scrollbar">
                                 {suggestions.length === 0 && isLoadingAddress && <div className="py-4 flex items-center justify-center gap-2 text-sm font-medium text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Searching...</div>}
                                 {[...suggestions].map((s, idx) => (
                                   <button key={idx} onClick={(e) => { e.preventDefault(); selectSuggestion(s); }} className="w-full py-3.5 px-4 text-left hover:bg-slate-50 border-b border-black flex items-center justify-between gap-3 transition-colors bg-white mt-0 first:border-b-0 shrink-0">
                                     <div className="flex items-center gap-3 min-w-0 flex-1">
                                      {s.isHistory ? 
                                       <History className="w-4 h-4 text-blue-500 shrink-0 opacity-70" /> :
                                       <MapPin className="w-4 h-4 text-slate-500 shrink-0 opacity-70" />
                                      }
                                      <span className="font-semibold text-slate-800 text-[15px] truncate">{s.label}</span>
                                     </div>
                                     {s.distance && <span className="text-xs whitespace-nowrap text-slate-500 font-bold tracking-tight bg-slate-100 px-2 py-0.5 rounded-md">{s.distance}</span>}
                                   </button>
                                 ))}
                               </div>
                             </motion.div>
                           )}
                         </AnimatePresence>
                       </div>

                       {/* Stops */}
                       {stops.map((stop, i) => (
                         <div key={i} className="flex flex-col relative w-full">
                           <div className="flex bg-white border border-black rounded-xl px-2 py-1 items-center relative gap-2 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-100 transition-all">
                               <div className="w-6 shrink-0 flex justify-center"><div className="w-2 h-2 rounded-full border-2 border-amber-500 bg-white" /></div>
                               <input 
                                   type="text" 
                                   value={stop.address}
                                   onChange={(e) => {
                                       const ns = [...stops]; ns[i].address = e.target.value; setStops(ns);
                                       setActiveField(`stop-${i}`);
                                       setHasModifiedRouteByUser(true);
                                   }}
                                   onFocus={() => setActiveField(`stop-${i}`)}
                                   className="flex-1 min-w-0 font-bold bg-transparent border-none focus:outline-none text-[15px] text-slate-800 py-3"
                                   placeholder={`Stop ${i+1}`}
                               />
                               {stop.address && (
                                   <button onClick={() => { const ns = [...stops]; ns[i].address = ""; ns[i].coords = null; setStops(ns); setHasModifiedRouteByUser(true); }} className="p-2 text-slate-400 hover:text-slate-600 rounded-full shrink-0 outline-none"><X className="w-4 h-4" /></button>
                               )}
                               <button onClick={() => { setStops(stops.filter((_, idx) => idx !== i)); setHasModifiedRouteByUser(true); }} className="p-2 text-slate-400 hover:text-red-500 outline-none"><X className="w-4 h-4" /></button>
                           </div>
                           <AnimatePresence>
                             {activeField === `stop-${i}` && (suggestions.length > 0 || isLoadingAddress) && (
                               <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="z-[60] mt-1 overflow-hidden rounded-2xl shadow-sm border border-black bg-white origin-top flex flex-col">
                                 <div className="flex justify-between items-center bg-slate-50 border-b border-black px-3 py-2 shrink-0">
                                   <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Suggestions</span>
                                   <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveField(null); setSuggestions([]); }} className="p-1 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors shadow-sm active:scale-95"><X className="w-4 h-4" /></button>
                                 </div>
                                 <div className="text-sm max-h-56 overflow-y-auto flex flex-col no-scrollbar">
                                   {suggestions.length === 0 && isLoadingAddress && <div className="py-4 flex items-center justify-center gap-2 text-sm font-medium text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Searching...</div>}
                                   {[...suggestions].map((s, idx) => (
                                     <button key={idx} onClick={(e) => { e.preventDefault(); selectSuggestion(s); }} className="w-full py-3.5 px-4 text-left hover:bg-slate-50 border-b border-black flex items-center justify-between gap-3 transition-colors bg-white mt-0 first:border-b-0 shrink-0">
                                       <div className="flex items-center gap-3 min-w-0 flex-1">
                                        {s.isHistory ? 
                                         <History className="w-4 h-4 text-blue-500 shrink-0 opacity-70" /> :
                                         <MapPin className="w-4 h-4 text-slate-500 shrink-0 opacity-70" />
                                        }
                                        <span className="font-semibold text-slate-800 text-[15px] truncate">{s.label}</span>
                                       </div>
                                       {s.distance && <span className="text-xs whitespace-nowrap text-slate-500 font-bold tracking-tight bg-slate-100 px-2 py-0.5 rounded-md">{s.distance}</span>}
                                     </button>
                                   ))}
                                 </div>
                               </motion.div>
                             )}
                           </AnimatePresence>
                         </div>
                       ))}

                       {/* Dropoff */}
                       <div className="flex flex-col relative w-full mt-1">
                         <div className="flex bg-white border border-black rounded-xl px-2 py-1 items-center relative focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-100 transition-all">
                             <div className="w-6 shrink-0 flex justify-center"><div className="w-2.5 h-2.5 bg-red-500 rounded-sm" /></div>
                             <input 
                                 type="text" 
                                 value={dropoff}
                                 onChange={(e) => { setDropoff(e.target.value); setActiveField("dropoff"); }}
                                 onFocus={() => setActiveField("dropoff")}
                                 className="flex-1 ml-2 min-w-0 font-bold bg-transparent border-none focus:outline-none text-[15px] text-slate-800 py-3"
                                 placeholder="Destination"
                             />
                             {dropoff && (
                                 <button onClick={() => { setDropoff(""); setDropoffCoords(null); setHasModifiedRouteByUser(true); }} className="p-2 text-slate-400 hover:text-slate-600 rounded-full shrink-0 outline-none"><X className="w-4 h-4" /></button>
                             )}
                         </div>
                         <AnimatePresence>
                           {activeField === "dropoff" && (suggestions.length > 0 || isLoadingAddress) && (
                             <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="z-[60] mt-1 overflow-hidden rounded-2xl shadow-sm border border-black bg-white origin-top flex flex-col">
                               <div className="flex justify-between items-center bg-slate-50 border-b border-black px-3 py-2 shrink-0">
                                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Suggestions</span>
                                 <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveField(null); setSuggestions([]); }} className="p-1 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors shadow-sm active:scale-95"><X className="w-4 h-4" /></button>
                               </div>
                               <div className="text-sm max-h-56 overflow-y-auto flex flex-col no-scrollbar">
                                 {suggestions.length === 0 && isLoadingAddress && <div className="py-4 flex items-center justify-center gap-2 text-sm font-medium text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Searching...</div>}
                                 {[...suggestions].map((s, idx) => (
                                   <button key={idx} onClick={(e) => { e.preventDefault(); selectSuggestion(s); }} className="w-full py-3.5 px-4 text-left hover:bg-slate-50 border-b border-black flex items-center justify-between gap-3 transition-colors bg-white mt-0 first:border-b-0 shrink-0">
                                     <div className="flex items-center gap-3 min-w-0 flex-1">
                                      {s.isHistory ? 
                                       <History className="w-4 h-4 text-blue-500 shrink-0 opacity-70" /> :
                                       <MapPin className="w-4 h-4 text-slate-500 shrink-0 opacity-70" />
                                      }
                                      <span className="font-semibold text-slate-800 text-[15px] truncate">{s.label}</span>
                                     </div>
                                     {s.distance && <span className="text-xs whitespace-nowrap text-slate-500 font-bold tracking-tight bg-slate-100 px-2 py-0.5 rounded-md">{s.distance}</span>}
                                   </button>
                                 ))}
                               </div>
                             </motion.div>
                           )}
                         </AnimatePresence>
                       </div>
                       
                       {stops.length < 3 && (
                           <div className="px-1 pt-1 mb-2">
                               <button onClick={() => { setStops([...stops, {address: "", coords: null}]); setHasModifiedRouteByUser(true); }} className="w-full border-2 border-dashed border-blue-200 py-2.5 flex items-center justify-center gap-1.5 text-blue-600 font-bold text-[14px] bg-blue-50/50 hover:bg-blue-100 rounded-xl transition-colors">
                                   <Plus className="w-4 h-4" /> Add Stop
                               </button>
                           </div>
                       )}
                   </div>

                   {/* Fare Display */}
                   <div className="bg-emerald-50 border border-emerald-100 rounded-[20px] p-5 flex flex-col items-center shadow-inner relative overflow-hidden">
                       <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-200/40 rounded-full blur-xl pointer-events-none" />
                       <div className="absolute -left-4 -bottom-4 w-16 h-16 bg-emerald-200/40 rounded-full blur-xl pointer-events-none" />
                       <span className="text-emerald-700 font-bold text-[12px] uppercase tracking-widest mb-1 relative z-10">Total Estimated Fare</span>
                       <div className="flex items-start tracking-tight relative z-10">
                           <span className="text-emerald-900 font-black text-2xl mt-1">£</span>
                           <span className="text-emerald-900 font-black text-5xl">{(getComputedFare(selectedCategory) + (isPriority ? 3 : 0) + (isPetFriendly ? 3 : 0) + (assignedDriverInfo?.tipAmount || 0)).toFixed(2)}</span>
                       </div>
                       
                       <div className="mt-4 w-full flex items-center justify-center gap-2 border-t border-emerald-200/50 pt-3 relative z-10">
                          {(() => {
                             const cat = CAR_CATEGORIES.find(c => c.id === selectedCategory);
                             if (!cat) return null;
                             const Icon = cat.icon;
                             return (
                               <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                                    <Icon className="w-4 h-4 text-emerald-700" />
                                  </div>
                                  <div>
                                    <span className="block text-emerald-900 font-black text-[13px]">{cat.name}</span>
                                    <span className="block text-emerald-700 font-bold text-[11px] leading-tight opacity-80">Selected Category</span>
                                  </div>
                               </div>
                             );
                          })()}
                       </div>
                   </div>
                </div>
                
                <div className="p-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] border-t border-black shrink-0 bg-white shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
                    <button 
                       onClick={async () => {
                           await handleConfirmBooking();
                           setIsEditingJourney(false);
                       }}
                       disabled={!dropoff}
                       className="w-full py-3.5 rounded-[14px] bg-[#0a1930] text-white font-bold text-[15px] shadow-lg shadow-blue-900/20 active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                       Confirm Update <ArrowRight className="w-5 h-5 opacity-70" />
                    </button>
                </div>
            </motion.div>
          )}

          {/* Permission Modal */}
          {showPermissionModal && (
            <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pointer-events-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-[32px] p-6 w-full max-w-sm border border-black shadow-2xl space-y-6"
              >
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto border border-red-100">
                  <Mic className="w-8 h-8 text-red-600" />
                </div>
                
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Microphone Access Denied</h3>
                  <p className="text-[13px] font-bold text-slate-500 leading-relaxed text-left">
                    We need microphone access to book your ride by voice. You can easily enable this in your device settings.
                  </p>
                  <div className="bg-slate-50 border border-black/10 rounded-xl p-3 text-left mt-4 text-[11px] font-bold text-slate-700">
                    <span className="text-black uppercase tracking-wider text-[10px]">Android:</span> Settings &rarr; Apps &rarr; AnyTrader &rarr; Permissions<br />
                    <span className="text-black uppercase tracking-wider text-[10px] mt-1 inline-block">iOS:</span> Settings &rarr; AnyTrader &rarr; Microphone<br />
                    <span className="text-black uppercase tracking-wider text-[10px] mt-1 inline-block">Web:</span> Click the lock icon next to the URL bar
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {Capacitor.isNativePlatform() && (
                    <button 
                      onClick={async () => {
                        try {
                          const { App: CapacitorApp } = await import('@capacitor/app');
                          if (CapacitorApp && CapacitorApp.openAppSettings) {
                             await CapacitorApp.openAppSettings();
                          }
                        } catch (e) {
                           console.error("Failed to open app settings", e);
                        }
                      }}
                      className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-bold text-[15px] active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      Open Settings
                    </button>
                  )}
                  <button 
                    onClick={() => setShowPermissionModal(false)}
                    className="w-full py-3.5 rounded-2xl bg-slate-100 text-slate-700 font-bold text-[15px] active:scale-95 transition-all border border-black/5 hover:bg-slate-200"
                  >
                    Continue without microphone
                  </button>
                </div>
              </motion.div>
            </div>
          )}

        </AnimatePresence>
     </div>
  );
}

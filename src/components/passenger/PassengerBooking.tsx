import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  MapPin, Navigation, Car, Clock, X, Check, Target, 
  MessageSquare, ChevronRight, ChevronLeft, ArrowLeft, Zap, History, Loader2, 
  Mic, MicOff, Star, Users, Repeat, Shield, Plus, Heart,
  Home, Briefcase, Dog, Accessibility, MessageCircle, Phone, AlertCircle, Hammer, ArrowDownToLine, Delete
} from "lucide-react";
import RideChat from "../driver/RideChat";
import { cn } from "@/src/lib/utils";
import { db, addDoc, collection, serverTimestamp, doc, updateDoc, arrayUnion, arrayRemove, onSnapshot, setDoc, increment, query, where, getDocs, orderBy, limit, deleteField, getDoc } from "@/src/firebase";
import { playSound } from "@/src/lib/sound";
import { useAuth } from "../AuthProvider";
import { usePortal } from "../../lib/PortalContext";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { processTaxiVoiceCommand } from "@/src/services/gemini";
import { triggerHaptic, ImpactStyle, hideNativeKeyboard } from "@/src/lib/capacitor";

// Google Maps Imports
import { GoogleMap, useJsApiLoader, MarkerF, PolylineF, OverlayViewF, OverlayView } from "@react-google-maps/api";

const containerStyle = {
  width: '100%',
  height: '100%'
};

const defaultCenter = {
  lat: 51.5225,
  lng: -0.1554
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
  zoomControl: true,
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

const libraries: any[] = ['places'];

type BookingStep = "details" | "searching" | "confirmed" | "receipt";

const CAR_CATEGORIES = [
  { id: 'standard', name: 'Standard Car', multiplier: 1.0, wait: '3-5', capacity: 4, icon: Car },
  { id: 'executive', name: 'Executive', multiplier: 1.5, wait: '5-8', capacity: 4, icon: Shield },
  { id: 'luxury', name: 'Luxury', multiplier: 2.2, wait: '8-12', capacity: 4, icon: Star },
  { id: '6seater', name: '6-Seater XL', multiplier: 1.4, wait: '6-10', capacity: 6, icon: Users },
  { id: '8seater', name: '8-Seater Max', multiplier: 2.0, wait: '8-15', capacity: 8, icon: Users },
  { id: 'wav', name: 'Wheelchair', multiplier: 2.5, wait: '10-20', capacity: 4, icon: Accessibility }
];

function PassengerTimer({ arrivedAt }: { arrivedAt: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(Math.floor((Date.now() - arrivedAt) / 1000));
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - arrivedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [arrivedAt]);

  const mins = Math.floor(elapsed / 60);
  const secs = (elapsed % 60).toString().padStart(2, '0');
  
  return (
    <div className="text-right">
      <p className="text-2xl font-black text-purple-900 leading-none mb-1">{mins}:{secs}</p>
      {elapsed < 180 ? (
        <p className="text-[10px] font-bold text-purple-700/80 uppercase tracking-widest leading-none">Free wait: {Math.floor((180 - elapsed) / 60)}:{((180 - elapsed) % 60).toString().padStart(2, '0')}</p>
      ) : elapsed < 300 ? (
        <p className="text-[10px] font-bold mt-0.5 uppercase tracking-widest text-[#FF9500] leading-none">Paid wait: {Math.floor((elapsed - 180) / 60)}:{((elapsed - 180) % 60).toString().padStart(2, '0')}</p>
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
    <div className="flex flex-col items-center justify-center bg-[#f8fafc] border border-black px-6 py-3.5 rounded-[20px] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] mb-4 min-w-[140px]">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em] mb-1.5">Time Elapsed</p>
      <p className="text-[28px] leading-none font-black text-slate-900 tracking-tight">{mins.toString().padStart(2, '0')}:{secs}</p>
    </div>
  );
}

function CancelRideButton_ConfirmedPhase({ acceptedAt, onCancel }: { acceptedAt: number, onCancel: () => void }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(Math.floor((Date.now() - acceptedAt) / 1000));
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - acceptedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [acceptedAt]);

  const timeLimit = 120; // 2 minutes
  const isFree = elapsed < timeLimit;
  const remaining = isFree ? timeLimit - elapsed : 0;
  const mins = Math.floor(remaining / 60);
  const secs = (remaining % 60).toString().padStart(2, '0');

  return (
    <button onClick={onCancel} className={cn("w-full py-2.5 rounded-[16px] border border-black flex flex-col items-center justify-center transition-transform active:scale-[0.98] shadow-lg", 
      isFree ? "bg-[#d32f2f] text-white shadow-red-900/10" : "bg-[#d32f2f] text-white shadow-red-900/10"
    )}>
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
  const { theme, switchPortal } = usePortal();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [step, setStep] = useState<BookingStep>("details");
  const [isMapFullScreen, setIsMapFullScreen] = useState(false);
  const [completedRideData, setCompletedRideData] = useState<any>(null);
  const [houseNumber, setHouseNumber] = useState("");
  const [pickup, setPickup] = useState(searchParams.get("pickup") || "");
  const [dropoff, setDropoff] = useState(searchParams.get("dropoff") || "");
  const pickupInputRef = useRef<HTMLInputElement>(null);
  const dropoffInputRef = useRef<HTMLInputElement>(null);
  const [comments, setComments] = useState(searchParams.get("comments") || "");
  const [waitTolerance, setWaitTolerance] = useState<10 | 20 | 30>(20);
  const [selectedCategory, setSelectedCategory] = useState("standard");
  const [isPetFriendly, setIsPetFriendly] = useState(false);
  const [isPriority, setIsPriority] = useState(false);
  const [showPriorityPrompt, setShowPriorityPrompt] = useState(false);
  const [priorityInlineToast, setPriorityInlineToast] = useState<{message: string, type: 'success' | 'info'} | null>(null);
  const [editId, setEditId] = useState<string | null>(searchParams.get("edit"));
  const [showTipModal, setShowTipModal] = useState(false);
  const [showCustomTipKeypad, setShowCustomTipKeypad] = useState(false);
  const [isAddingTip, setIsAddingTip] = useState(false);
  const [selectedTip, setSelectedTip] = useState<number | null>(null);
  const [customTip, setCustomTip] = useState("");
  const [rideRating, setRideRating] = useState<number>(5);
  const [selectedReviewTags, setSelectedReviewTags] = useState<string[]>([]);
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [hasSubmittedReview, setHasSubmittedReview] = useState(false);
  const [rideContext, setRideContext] = useState<"personal" | "business">("personal");

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
          if (data.fareEstimate) setFareEstimate(data.fareEstimate);

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
    googleMapsApiKey: (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
    version: "weekly"
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
          }
        }
      }, (err) => console.error("onSnapshot ERROR ride_requests:", err));
      return () => unsub();
    }
  }, [editId]);

  const [isDetecting, setIsDetecting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>("");
  const [fareEstimate, setFareEstimate] = useState<number | null>(null);
  const [distanceMiles, setDistanceMiles] = useState<number>(0);
  const [durationMinutes, setDurationMinutes] = useState<number>(0);
  const [nearbyDriversCount, setNearbyDriversCount] = useState<number>(0);
  const [driversAvailableSoonCount, setDriversAvailableSoonCount] = useState<number>(0);
  const [nearbyDriversLocations, setNearbyDriversLocations] = useState<{lat: number, lng: number, id: string}[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Set<string>>(new Set(['standard']));
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
    dispatchTimeoutSeconds: 15
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

  const [showRegularJourneys, setShowRegularJourneys] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showHomeBlank, setShowHomeBlank] = useState(false);
  const [showWorkBlank, setShowWorkBlank] = useState(false);
  
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (showRegularJourneys || showFavorites || showHomeBlank || showWorkBlank) {
      timeout = setTimeout(() => {
        setShowRegularJourneys(false);
        setShowFavorites(false);
        setShowHomeBlank(false);
        setShowWorkBlank(false);
      }, 5000);
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
  const [pickupCoords, setPickupCoords] = useState<{lat: number, lng: number} | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<{lat: number, lng: number} | null>(null);
  const [stops, setStops] = useState<{address: string, coords: {lat: number, lng: number} | null}[]>([]);
  const [routeLine, setRouteLine] = useState<{lat: number, lng: number}[]>([]);

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
    if (pickupCoords && dropoffCoords && isLoaded) {
      const getRoute = () => {
        try {
          const directionsService = new google.maps.DirectionsService();
          const validStops = stops.filter(s => s.coords !== null).map(s => ({
            location: new google.maps.LatLng(s.coords!.lat, s.coords!.lng),
            stopover: true
          }));

          const routeReq: google.maps.DirectionsRequest = {
            origin: new google.maps.LatLng(pickupCoords.lat, pickupCoords.lng),
            destination: new google.maps.LatLng(dropoffCoords.lat, dropoffCoords.lng),
            travelMode: google.maps.TravelMode.DRIVING,
          };
          if (validStops.length > 0) {
            routeReq.waypoints = validStops;
          }

          const routeResult: any = directionsService.route(routeReq, (result, status) => {
            if (status === google.maps.DirectionsStatus.OK && result) {
              // Draw the line
              const path = result.routes[0].overview_path.map(p => ({ lat: p.lat(), lng: p.lng() }));
              setRouteLine(path);

              // Fit bounds
              if (map) {
                const bounds = new google.maps.LatLngBounds();
                path.forEach((p: any) => bounds.extend(p));
                map.fitBounds(bounds, { 
                  padding: { 
                    top: 60, 
                    right: 50, 
                    bottom: 60, 
                    left: 50 
                  } 
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
              result.routes[0].legs.forEach(leg => {
                if (leg.distance) totalDistanceMeters += leg.distance.value;
                if (leg.duration) totalDurationSeconds += leg.duration.value;
              });
              const dMiles = totalDistanceMeters / 1609.34;
              const dMins = totalDurationSeconds / 60;
              
              setDistanceMiles(dMiles);
              setDurationMinutes(dMins);

              // Base Fare + Distance + Time
              const calcFare = fareConfig.baseFare + (dMiles * fareConfig.distanceRate) + (dMins * fareConfig.timeRate);
              setFareEstimate(Math.max(calcFare, fareConfig.minFare));
            } else {
              console.warn("Directions failed:", status);
            }
          });
          if (routeResult && routeResult.catch) {
            routeResult.catch((e: any) => console.warn("Caught Directions request Promise rejection", e));
          }
        } catch (e) {
          console.error("DIRECTIONS_ROUTE error:", e);
        }
      };
      getRoute();
    } else {
      setRouteLine([]);
    }
  }, [pickupCoords, dropoffCoords, stops, map, fareConfig, isLoaded]);

  useEffect(() => {
    if (navigator.geolocation && !pickupCoords && !searchParams.get("pickup")) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMapCenter(c);
        setPickupCoords(c);
      });
    }
  }, [pickupCoords, searchParams]);

  useEffect(() => {
    if (!pickupCoords) {
      setNearbyDriversCount(0);
      setDriversAvailableSoonCount(0);
      return;
    }
    const q = query(collection(db, "live_tracking"), where("isOnline", "==", true));
    const unsub = onSnapshot(q, (snapshot) => {
      let countNow = 0;
      let countSoon = 0;
      const cats = new Set<string>();
      const locations: {lat: number, lng: number, id: string}[] = [];

      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        
        // Match user's pet preference
        if (isPetFriendly && data.isPetFriendly !== true) {
          return;
        }

        let driverCategories = data.vehicleCategories || [data.vehicleCategory || 'standard'];
        
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

        if (data.status === 'on_ride' && data.dropoffLat && data.dropoffLng) {
          if (data.isStackingEnabled !== false && data.isLastJob !== true) {
            const distToPickup = calculateDistance(pickupCoords.lat, pickupCoords.lng, data.dropoffLat, data.dropoffLng);
            if (distToPickup <= 3) {
               countSoon++;
               driverCategories.forEach((cat: string) => cats.add(cat));
               locations.push({ lat: data.lat, lng: data.lng, id: docSnap.id });
            }
          }
        } else if (data.lat && data.lng && data.status !== 'on_ride') {
          if (data.isLastJob !== true) {
            const distToPickup = calculateDistance(pickupCoords.lat, pickupCoords.lng, data.lat, data.lng);
            if (distToPickup <= 3) {
               countNow++;
               driverCategories.forEach((cat: string) => cats.add(cat));
               locations.push({ lat: data.lat, lng: data.lng, id: docSnap.id });
            }
          }
        }
      });
      setNearbyDriversCount(countNow);
      setDriversAvailableSoonCount(countSoon);
      setNearbyDriversLocations(locations);
      setAvailableCategories(cats.size > 0 ? cats : new Set(['standard'])); // always show at least standard as fallback
    }, (err) => console.error("onSnapshot ERROR live_tracking:", err));
    return () => unsub();
  }, [pickupCoords, isPetFriendly]);

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
        setFareConfig({
          baseFare: Number(data.baseFare) || 3.5,
          distanceRate: Number(data.distanceRate) || 1.3,
          timeRate: Number(data.timeRate) || 0.15,
          waitRatePerMinute: Number(data.waitRatePerMinute) || 0.25,
          minFare: Number(data.minFare) || 5.0,
          commissionRate: Number(data.commissionRate) || 0.12,
        });
      }
    }, (err) => console.error("onSnapshot ERROR platform_config/rides 2:", err));
    return () => unsub();
  }, []);

  const [favoriteAddresses, setFavoriteAddresses] = useState<any[]>([]);
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
        toast.success("Removed from favorites");
      } else {
        const newFav = { id: Math.random().toString(36).substr(2, 9), name, address };
        await updateDoc(doc(db, "users", user.uid), {
          favoriteAddresses: arrayUnion(newFav)
        });
        toast.success("Added to favorites");
      }
    } catch (err) {
      toast.error("Failed to update favorites");
    }
  };

  const toggleListening = () => {
    triggerHaptic(ImpactStyle.Light);
    
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-GB";
    recognition.continuous = true;
    recognition.interimResults = true;
    transcriptRef.current = "";

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      setIsListening(false);
      if (transcriptRef.current.trim().length > 0) {
        processVoiceCommand(transcriptRef.current);
        transcriptRef.current = "";
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: any) => {
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
    recognition.start();
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

  const processVoiceCommand = async (text: string) => {
    setIsAiProcessing(true);
    toast.info("AI extracting details...");
    try {
      const result = await processTaxiVoiceCommand(text);

      if (result.pickup) geocodeLocation(result.pickup, setPickup, setPickupCoords);
      if (result.dropoff) geocodeLocation(result.dropoff, setDropoff, setDropoffCoords);
      if (result.comments) setComments(result.comments);
      
      toast.success("AI extraction complete.");
    } catch (err) {
      console.error("AI Error:", err);
      toast.error("AI error. Try typing.");
    } finally {
      setIsAiProcessing(false);
    }
  };

  const [suggestions, setSuggestions] = useState<{label: string, lat?: number, lon?: number, placeId?: string, placePrediction?: any, isHistory?: boolean}[]>([]);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [pastRides, setPastRides] = useState<any[]>([]);
  const [pastAddresses, setPastAddresses] = useState<{label: string, lat?: number, lon?: number}[]>([]);

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

        const { AutocompleteSuggestion } = await window.google.maps.importLibrary("places") as any;

        const userLat = passengerPos?.lat || mapCenter?.lat || 53.6458;
        const userLng = passengerPos?.lng || mapCenter?.lng || -1.7850;

        const request = {
          input: val,
          includedRegionCodes: ['GB'],
          locationBias: {
            center: { lat: userLat, lng: userLng },
            radius: 50000
          },
          origin: { lat: userLat, lng: userLng }
        };

        const { suggestions: predictions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

        setIsLoadingAddress(false);
        let finalSuggestions: any[] = [];
        
        if (predictions && predictions.length > 0) {
          // Sort predictions by distanceMeters if available
          const sortedPredictions = [...predictions].sort((a: any, b: any) => {
            const distA = a.placePrediction.distanceMeters ?? 9999999;
            const distB = b.placePrediction.distanceMeters ?? 9999999;
            return distA - distB;
          });
          
          const cleaned = sortedPredictions.map((p: any) => ({
            label: p.placePrediction.text.text,
            placeId: p.placePrediction.placeId,
            placePrediction: p.placePrediction // Save the raw prediction object to use toPlace() later
          }));
          
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
      
      if (accuracy > 20) {
        toast.warning(`GPS accuracy too low (${Math.round(accuracy)}m). Please enter manually for better precision.`);
        setIsDetecting(false);
        setActiveField("pickup");
        return;
      }
      
      const c = { lat: latitude, lng: longitude };
      setMapCenter(c);
      setPickupCoords(c);

      if (!window.google || !window.google.maps) {
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
          
          if (!dropoff) {
            dropoffInputRef.current?.focus();
            setActiveField("dropoff");
          } else {
            setActiveField(null);
            if (addr && dropoff) {
              setDetailsView("vehicle");
            }
          }
        }
      });
    }, (err) => {
      setIsDetecting(false);
      toast.error("Failed to detect location. Please check browser permissions.");
    }, { enableHighAccuracy: true });
  };

  const [driverPos, setDriverPos] = useState<{lat: number, lng: number} | null>(null);
  const [passengerPos, setPassengerPos] = useState<{lat: number, lng: number} | null>(null);

  const getComputedFare = (catId: string) => {
    const category = CAR_CATEGORIES.find(c => c.id === catId);
    const multiplier = category?.multiplier || 1.0;
    const base = fareEstimate || 5.0;
    return Math.max(base * multiplier, fareConfig.minFare * multiplier);
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
    
    if (pendingCharges > 0 && cancellationCount === 1) {
      toast.warning(`Notice: £${pendingCharges.toFixed(2)} unpaid cancellation fee will be added to this trip's fare.`);
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
        fareEstimate: getComputedFare(selectedCategory) + (isPriority ? 3 : 0) + (isPetFriendly ? 3 : 0) + (pendingCharges > 0 && cancellationCount === 1 ? pendingCharges : 0),
        baseCalc: fareEstimate || 5.0,
        surgeMultiplier: 1.0, 
        carCategory: selectedCategory,
        isPetFriendly,
        isPriority,
        waitTolerance,
        comments,
        unpaidCancellationFeesOwed: pendingCharges > 0 && cancellationCount === 1 ? pendingCharges : 0,
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
       nextStatus = "completed";
    }
    else if (currentStatus === "awaiting_payment") nextStatus = "completed";

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
         setAssignedDriverInfo((prev: any) => prev ? { ...prev, status: "in_progress", startedAt: Date.now() } : null);
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
            updateData.finalFare = (rideData.fareEstimate || fareConfig.baseFare) + (rideData.tipAmount || 0) + (rideData.cancellationFee || 0);
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
    if (assignedDriverInfo?.acceptedAt) {
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

      setShowCancelPrompt(false);
      toast.success("Ride cancelled.");
      navigate("/my-rides");
    } catch (err) {
      console.error(err);
      toast.error("Failed to cancel ride.");
    }
  };

  const handleSendQuickMessage = async (text: string) => {
    if (!currentRideId || !user) return;
    try {
      await addDoc(collection(db, "ride_requests", currentRideId, "chat"), {
        text,
        senderId: user.uid,
        createdAt: serverTimestamp()
      });
      toast.success("Sent");
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
                await updateDoc(rideRef, {
                  status: "pending",
                  assignedDriverId: deleteField(),
                  offerExpiresAt: deleteField(),
                  declinedBy: arrayUnion(rideInfo.assignedDriverId)
                });
             }
          }
          return; // Wait for next tick
       }

       // Ride is "pending". Let's find the best driver logically.
       const q = query(collection(db, "live_tracking"), where("isOnline", "==", true));
       const snapshot = await getDocs(q);
       const declinedBy = rideInfo.declinedBy || [];

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

          // Match closest driver within the radius limit
          if (d < bestDistance) {
            bestDistance = d;
            bestDriver = docSnap.id;
          }
       });

       if (bestDriver) {
          // Surge / Offer dispatch correctly matching the logic
          const timeoutMs = (fareConfig.dispatchTimeoutSeconds || 15) * 1000;
          await updateDoc(rideRef, {
             status: "offered",
             assignedDriverId: bestDriver,
             offerExpiresAt: Date.now() + timeoutMs
          });
       }
    };

    dispatchInterval = setInterval(runDispatch, 3000);
    runDispatch(); // initial tick

    return () => clearInterval(dispatchInterval);

  }, [step, currentRideId, pickupCoords, selectedCategory, user, fareConfig]);

  useEffect(() => {
    if (!currentRideId) return;
    const unsubRide = onSnapshot(doc(db, "ride_requests", currentRideId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        currentRideStatusRef.current = data.status || null;
        if (data.status === 'accepted' && data.driverId) {
          if (lastSoundStatusRef.current !== 'accepted') {
             playSound('success');
             lastSoundStatusRef.current = 'accepted';
             // Only show the overlay if we just transitioned to accepted
             setShowDriverFoundOverlay(true);
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
          }
          setAssignedDriverInfo(prev => prev ? { ...prev, status: "arrived", arrivedAt: data.arrivedAt?.toMillis(), tipAmount: data.tipAmount } : null);
          setStep("confirmed"); triggerHaptic(ImpactStyle.Heavy);
          toast.success("Your driver has arrived!", { duration: 8000, position: "top-center" });
        }
        if (data.status === 'in_progress') {
          if (lastSoundStatusRef.current !== 'in_progress') {
             playSound('notification');
             lastSoundStatusRef.current = 'in_progress';
          }
          setAssignedDriverInfo(prev => prev ? { ...prev, status: "in_progress", startedAt: data.startedAt?.toMillis(), tipAmount: data.tipAmount } : null);
          setStep("confirmed");
          
          // Let's remove the automatic tip modal per user instructions.
          if (!hasTriggeredTipModalRef.current) {
            hasTriggeredTipModalRef.current = true;
          }
        }
        if (data.status === 'completed') { 
          setCompletedRideData({ ...data, id: currentRideId });
          setStep("receipt"); 
          setCurrentRideId(null); 
          setAssignedDriverInfo(null); 
          lastSoundStatusRef.current = null; 
          hasTriggeredTipModalRef.current = false;
          setShowTipModal(false);
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

             if (isMapFullScreenRef.current) {
                 map.fitBounds(bounds, { top: 100, bottom: 120, left: 40, right: 40 });
             } else {
                 map.fitBounds(bounds, { top: 60, bottom: 40, left: 40, right: 40 });
             }
          }
        }
      }
    });
    return () => { unsubRide(); unsubTrack(); };
  }, [currentRideId, assignedDriverInfo?.uid]);

  // Passenger Live GPS tracking for driver to see
  useEffect(() => {
    if (!currentRideId || !user) return;
    if (step === "details" || step === "review" || step === "payment") return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setPassengerPos({ lat: latitude, lng: longitude });
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
      },
      (err) => console.warn("Passenger GPS error:", err),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [currentRideId, user, step]);

  const selectSuggestion = async (s: {label: string, lat?: number, lon?: number, placeId?: string, placePrediction?: any}) => {
    triggerHaptic(ImpactStyle.Light);
    
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
      
      if (activeField === "pickup" && !currentDropoff) {
        dropoffInputRef.current?.focus();
        setActiveField("dropoff");
      } else if (activeField === "dropoff" && !currentPickup) {
        pickupInputRef.current?.focus();
        setActiveField("pickup");
      } else {
        setActiveField(null);
        if (currentPickup && currentDropoff) {
          setDetailsView("vehicle");
        }
      }
    };

    if (s.placePrediction) {
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

       if (isMapFullScreen) {
           map.fitBounds(bounds, { top: 100, bottom: 120, left: 40, right: 40 });
       } else {
           map.fitBounds(bounds, { top: 60, bottom: 40, left: 40, right: 40 });
       }
    }
  }, [isMapFullScreen]);

  useEffect(() => {
    const destinationCoords = assignedDriverInfo?.status === "accepted" ? pickupCoords :
                              assignedDriverInfo?.status === "in_progress" ? dropoffCoords : null;

    if ((assignedDriverInfo?.status === "accepted" || assignedDriverInfo?.status === "in_progress") && driverPos && destinationCoords && isLoaded) {
      const getLiveRoute = () => {
        try {
          const directionsService = new window.google.maps.DirectionsService();
          const routeResult: any = directionsService.route({
            origin: new window.google.maps.LatLng(driverPos.lat, driverPos.lng),
            destination: new window.google.maps.LatLng(destinationCoords.lat, destinationCoords.lng),
            travelMode: window.google.maps.TravelMode.DRIVING,
          }, (result, status) => {
            if (status === window.google.maps.DirectionsStatus.OK && result && result.routes[0]) {
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
            } else {
              console.warn("Live route directions failed with status:", status);
            }
          });
          if (routeResult && routeResult.catch) {
            routeResult.catch((e: any) => console.warn("Caught Directions request Promise rejection", e));
          }
        } catch (e) {
          console.error("DIRECTIONS_ROUTE error:", e);
        }
      };
      
      getLiveRoute();
      const interval = setInterval(getLiveRoute, 15000); // refresh every 15s
      return () => clearInterval(interval);
    } else {
      setLiveRouteLine([]);
      setLiveEtaMins(null);
      setLiveEtaSeconds(null);
    }
  }, [assignedDriverInfo?.status, driverPos?.lat, driverPos?.lng, dropoffCoords, pickupCoords, isLoaded]);

  // Handle Google Maps load errors (e.g. ApiProjectMapError)
  if (loadError || (!isLoaded && !(import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY)) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-surface p-8 text-center">
        <div className="w-20 h-20 bg-danger/10 rounded-full flex items-center justify-center mb-6">
          <Navigation className="w-10 h-10 text-danger" />
        </div>
        <h2 className="text-2xl font-black text-text-main mb-2">Maps API Error</h2>
        <p className="text-text-muted max-w-sm mb-8 font-medium">
          {loadError ? "The Google Maps API failed to load. Please ensure the 'Maps JavaScript API' is enabled in your Google Cloud Console project." : "Google Maps API Key is missing. Please configure VITE_GOOGLE_MAPS_API_KEY."}
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
         isMapFullScreen ? "fixed inset-0 z-[200] h-[100dvh] w-[100dvw]" : (step === "details" ? "relative z-0 shrink-0 h-[60dvh] w-full" : "relative z-0 shrink-0 h-[50dvh] w-full")
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
              <div className="bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl rounded-[20px] p-3 flex items-center justify-between pointer-events-auto w-full max-w-[280px]">
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
            center={isMapFullScreen ? (driverPos || mapCenter) : mapCenter}
            zoom={isMapFullScreen ? 13 : 15}
            onLoad={setMap}
            options={theme === "dark" ? darkMapOptions : premiumMapOptions}
            onClick={(e) => {
               if (e.latLng && step === "details") {
                  const lat = e.latLng.lat();
                  const lng = e.latLng.lng();
                  const coords = { lat, lng };
                  setMapCenter(coords);
                  if (activeField === "pickup") setPickupCoords(coords);
                  else if (activeField === "dropoff") setDropoffCoords(coords);
                  else if (!pickupCoords) setPickupCoords(coords);
                  else setDropoffCoords(coords);
               }
            }}
          >
            {pickupCoords && (
              <>
                <MarkerF position={pickupCoords} label="P" />
                <OverlayViewF
                  position={pickupCoords}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                  getPixelPositionOffset={(width, height) => ({ x: -(width / 2), y: -height - 45 })}
                >
                  <div className="bg-emerald-50 px-2.5 py-2.5 rounded-xl shadow-xl border border-emerald-200 min-w-[120px] max-w-[200px] pointer-events-auto">
                    <p className="text-[8px] font-black text-emerald-600 uppercase tracking-[0.1em] mb-1">Pickup</p>
                    <div className="text-[10px] font-bold text-emerald-950 leading-tight space-y-0.5">
                      {formatAddressLines(pickup)}
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-emerald-50 border-r border-b border-emerald-200 rotate-45 -mt-1" />
                  </div>
                </OverlayViewF>
              </>
            )}
            {dropoffCoords && (
              <>
                <MarkerF position={dropoffCoords} label="D" />
                <OverlayViewF
                  position={dropoffCoords}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                  getPixelPositionOffset={(width, height) => ({ x: -(width / 2), y: -height - 45 })}
                >
                  <div className="bg-rose-50 px-2.5 py-2.5 rounded-xl shadow-xl border border-rose-200 min-w-[120px] max-w-[200px] pointer-events-auto">
                    <p className="text-[8px] font-black text-rose-600 uppercase tracking-[0.1em] mb-1">Dropoff</p>
                    <div className="text-[10px] font-bold text-rose-950 leading-tight space-y-0.5">
                      {formatAddressLines(dropoff)}
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-rose-50 border-r border-b border-rose-200 rotate-45 -mt-1" />
                  </div>
                </OverlayViewF>
              </>
            )}
            {stops.map((s, i) => s.coords && (
              <React.Fragment key={i}>
                <MarkerF position={s.coords} label={`${i+1}`} />
                <OverlayViewF
                  position={s.coords}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                  getPixelPositionOffset={(width, height) => ({ x: -(width / 2), y: -height - 45 })}
                >
                  <div className="bg-amber-50 px-2.5 py-2.5 rounded-xl shadow-xl border border-amber-200 min-w-[120px] max-w-[200px] pointer-events-auto">
                    <p className="text-[8px] font-black text-amber-600 uppercase tracking-[0.1em] mb-1">Stop {i+1}</p>
                    <div className="text-[10px] font-bold text-amber-950 leading-tight space-y-0.5">
                      {formatAddressLines(s.address)}
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-amber-50 border-r border-b border-amber-200 rotate-45 -mt-1" />
                  </div>
                </OverlayViewF>
              </React.Fragment>
            ))}
            {passengerPos && (
              <OverlayViewF position={passengerPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                <div className="relative flex items-center justify-center w-8 h-8 -ml-4 -mt-4">
                  <div className="absolute inset-0 bg-[#007AFF] rounded-full opacity-30 animate-ping"></div>
                  <div className="bg-[#007AFF] border-2 border-white w-4 h-4 rounded-full shadow-lg z-10"></div>
                </div>
              </OverlayViewF>
            )}

            {!currentRideId && step === "details" && nearbyDriversLocations.map(driver => (
              <OverlayViewF key={driver.id} position={{ lat: driver.lat, lng: driver.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                <div className="relative flex items-center justify-center w-6 h-6 -ml-3 -mt-3">
                  <div className="absolute inset-0 bg-primary/40 rounded-full animate-pulse blur-[2px]"></div>
                  <div className="bg-primary border-2 border-card w-3.5 h-3.5 rounded-sm shadow-md z-10 flex items-center justify-center transform rotate-45"></div>
                </div>
              </OverlayViewF>
            ))}

            {driverPos && (
              <OverlayViewF position={driverPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                <div className="relative flex items-center justify-center w-10 h-10 -ml-5 -mt-5">
                  <div className="absolute inset-0 bg-zinc-900 rounded-full opacity-20 animate-pulse blur-[2px]"></div>
                  <div className="bg-white border-2 border-slate-200 w-8 h-8 rounded-full shadow-xl z-10 flex items-center justify-center">
                     <Car className="w-4 h-4 text-slate-800" />
                  </div>
                  <div className="absolute -top-6 bg-[#0a1930] px-2.5 py-1 rounded-md text-[10px] font-bold text-white whitespace-nowrap shadow-lg flex items-center gap-1.5">
                    {assignedDriverInfo?.status === "accepted" ? "Heading to you" : "In Progress"}
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
       </div>

       {/* Chat Component */}
       {step === "confirmed" && currentRideId && (
         <RideChat 
           rideId={currentRideId} 
           isOpen={isChatOpen} 
           onClose={() => setIsChatOpen(false)}
           otherPartyName={assignedDriverInfo?.name || "Driver"}
           otherPartyPhone={assignedDriverInfo?.phone || undefined}
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
                    <button onClick={toggleListening} disabled={isAiProcessing} className="w-full bg-slate-900 border-b border-white/10 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 py-1 px-4 flex items-center justify-center gap-1.5 font-bold shadow-sm active:scale-95 transition-all text-[11px] uppercase tracking-wider shrink-0 z-10 relative rounded-none h-8">
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
                          <Mic className="w-4 h-4"/> Tap to Book by Voice
                        </>
                      )}
                    </button>
                )}
                
                <div ref={bottomSheetRef} className={cn("overflow-x-hidden overflow-y-auto no-scrollbar flex-1 min-h-0", detailsView === "address" ? "p-4 pt-2 space-y-4 relative" : "p-3 pt-3 flex flex-col gap-2 relative")}>
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
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="z-[60] ml-6 mr-0 mt-1 overflow-hidden rounded-2xl shadow-sm border border-slate-200 bg-white origin-top flex flex-col">
                              <div className="flex justify-between items-center bg-slate-50 border-b border-slate-200 px-3 py-2 shrink-0">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Suggestions</span>
                                <button onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setActiveField(null); setSuggestions([]); }} className="p-1 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors shadow-sm active:scale-95"><X className="w-4 h-4" /></button>
                              </div>
                              <div className="text-sm max-h-56 overflow-y-auto flex flex-col no-scrollbar">
                              {suggestions.length === 0 && isLoadingAddress && (
                                <div className="py-4 flex items-center justify-center text-text-muted text-sm border-t border-slate-200 bg-white">
                                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Searching...
                                </div>
                              )}
                                {[...suggestions].map((s, idx) => (
                                  <button key={idx} onClick={() => selectSuggestion(s)} className="w-full py-3 px-3 text-left hover:bg-slate-50 border-b border-slate-100 flex items-center gap-3 transition-colors bg-white mt-0 first:border-b-0 shrink-0">
                                    {s.isHistory ? 
                                      <History className="w-4 h-4 text-emerald-500 shrink-0 opacity-70" /> :
                                      <MapPin className="w-4 h-4 text-emerald-500 shrink-0 opacity-70" />
                                    }
                                    <span className="font-semibold text-text-main text-sm truncate">{s.label}</span>
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
                          <div className="flex-1 flex bg-slate-50 border border-slate-200 rounded-2xl group-focus-within:bg-white group-focus-within:border-amber-500 group-focus-within:ring-4 group-focus-within:ring-amber-500/10 transition-all pr-1 shadow-sm min-w-0">
                            <input 
                              type="text" 
                              className="flex-1 w-full bg-transparent px-4 font-bold text-text-main outline-none placeholder:text-text-muted/60 text-[15px] py-3.5 focus:bg-amber-500/5 rounded-l-2xl transition-colors min-w-0" 
                              placeholder={`Stop ${i+1}`} 
                              value={stop.address} 
                              onFocus={() => setActiveField(`stop-${i}`)} 
                              onChange={(e) => {
                                const ns = [...stops]; ns[i].address = e.target.value; setStops(ns);
                                setActiveField(`stop-${i}`);
                              }} 
                            />
                            <button onClick={() => setStops(stops.filter((_, idx) => idx !== i))} className="p-2 text-text-muted hover:text-danger rounded-full shrink-0"><X className="w-4 h-4" /></button>
                          </div>
                        </div>
                        </div>
                        
                        <AnimatePresence>
                          {activeField === `stop-${i}` && (suggestions.length > 0 || isLoadingAddress) && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="z-[60] ml-6 mr-0 mt-1 overflow-hidden rounded-2xl shadow-sm border border-slate-200 bg-white origin-top flex flex-col">
                              <div className="flex justify-between items-center bg-slate-50 border-b border-slate-200 px-3 py-2 shrink-0">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Suggestions</span>
                                <button onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setActiveField(null); setSuggestions([]); }} className="p-1 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors shadow-sm active:scale-95"><X className="w-4 h-4" /></button>
                              </div>
                              <div className="text-sm max-h-56 overflow-y-auto flex flex-col no-scrollbar">
                                {suggestions.length === 0 && isLoadingAddress && (
                                  <div className="py-4 flex items-center justify-center text-text-muted text-sm border-t border-slate-200 bg-white">
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Searching...
                                  </div>
                                )}
                                {[...suggestions].map((s, idx) => (
                                  <button key={idx} onClick={() => selectSuggestion(s)} className="w-full py-3 px-3 text-left hover:bg-slate-50 border-b border-slate-100 flex items-center gap-3 transition-colors bg-white mt-0 first:border-b-0 shrink-0">
                                    {s.isHistory ? 
                                      <History className="w-4 h-4 text-amber-500 shrink-0 opacity-70" /> :
                                      <MapPin className="w-4 h-4 text-amber-500 shrink-0 opacity-70" />
                                    }
                                    <span className="font-semibold text-text-main text-sm truncate">{s.label}</span>
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
                          {stops.length < 3 && (
                            <div className="pl-2 pr-1 py-1 border-l border-red-200/60 flex items-center justify-center shrink-0 h-full">
                              <button onClick={() => setStops([...stops, { address: "", coords: null }])} className="w-[30px] h-[34px] bg-[#FFB800] text-black hover:bg-[#E6A600] rounded-[10px] border-[1.5px] border-black flex flex-col items-center justify-center shrink-0 transition-colors shadow-sm" title="Add a stop">
                                <Plus className="w-3.5 h-3.5 -mb-[1px]" strokeWidth={4} />
                                <span className="text-[9px] font-black tracking-tighter leading-none mb-0.5 ml-0.5">STP</span>
                              </button>
                            </div>
                          )}
                        </div>
                        </div>

                        <AnimatePresence>
                          {activeField === "dropoff" && (suggestions.length > 0 || isLoadingAddress) && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="z-[60] ml-6 mr-0 mt-1 overflow-hidden rounded-2xl shadow-sm border border-slate-200 bg-white origin-top flex flex-col">
                              <div className="flex justify-between items-center bg-slate-50 border-b border-slate-200 px-3 py-2 shrink-0">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Suggestions</span>
                                <button onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setActiveField(null); setSuggestions([]); }} className="p-1 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors shadow-sm active:scale-95"><X className="w-4 h-4" /></button>
                              </div>
                              <div className="text-sm max-h-56 overflow-y-auto flex flex-col no-scrollbar">
                                {suggestions.length === 0 && isLoadingAddress && (
                                  <div className="py-4 flex items-center justify-center text-text-muted text-sm border-t border-slate-200 bg-white">
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Searching...
                                  </div>
                                )}
                                {[...suggestions].map((s, idx) => (
                                  <button key={idx} onClick={() => selectSuggestion(s)} className="w-full py-3 px-3 text-left hover:bg-slate-50 border-b border-slate-100 flex items-center gap-3 transition-colors bg-white mt-0 first:border-b-0 shrink-0">
                                    {s.isHistory ? 
                                      <History className="w-4 h-4 text-blue-500 shrink-0 opacity-70" /> :
                                      <MapPin className="w-4 h-4 text-red-500 shrink-0 opacity-70" />
                                    }
                                    <span className="font-semibold text-text-main text-sm truncate">{s.label}</span>
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
                          className={cn("flex-1 justify-center px-2 py-1.5 border rounded-full flex items-center gap-1 text-[10px] sm:text-[11px] font-bold transition-colors shadow-sm whitespace-nowrap", showFavorites ? "bg-rose-100 border-rose-300 text-rose-800" : "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 hover:border-rose-300")}
                        >
                          <Heart className="w-3 h-3 text-rose-500" /> Favorite
                        </button>
                      </div>

                      <AnimatePresence>
                        {showHomeBlank && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }} 
                            animate={{ opacity: 1, height: "auto" }} 
                            exit={{ opacity: 0, height: 0 }} 
                            className="ml-6 overflow-hidden pr-1"
                          >
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 mb-2 shadow-sm relative">
                                <button onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setShowHomeBlank(false); }} className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                                <div className="text-center py-4">
                                  <p className="text-xs text-slate-500 font-medium mb-1 pt-1">No home address saved.</p>
                                  <p className="text-[10px] text-slate-400">Save an address as 'Home' in My Rides.</p>
                                </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <AnimatePresence>
                        {showWorkBlank && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }} 
                            animate={{ opacity: 1, height: "auto" }} 
                            exit={{ opacity: 0, height: 0 }} 
                            className="ml-6 overflow-hidden pr-1"
                          >
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 mb-2 shadow-sm relative">
                                <button onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setShowWorkBlank(false); }} className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                                <div className="text-center py-4">
                                  <p className="text-xs text-slate-500 font-medium mb-1 pt-1">No work address saved.</p>
                                  <p className="text-[10px] text-slate-400">Save an address as 'Work' in My Rides.</p>
                                </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <AnimatePresence>
                        {showFavorites && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }} 
                            animate={{ opacity: 1, height: "auto" }} 
                            exit={{ opacity: 0, height: 0 }} 
                            className="ml-6 overflow-hidden pr-1"
                          >
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 mb-2 shadow-sm space-y-2 relative">
                              <button onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setShowFavorites(false); }} className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                              {favoriteAddresses && favoriteAddresses.length > 0 ? (
                                favoriteAddresses.map((fav: any, idx: number) => (
                                  <button
                                    key={`fav-${idx}`}
                                    onClick={() => {
                                      selectSuggestion({ label: fav.address, lat: fav.lat, lon: fav.lng, placeId: fav.placeId });
                                      setShowFavorites(false);
                                    }}
                                    className="w-full text-left bg-white border border-slate-100 rounded-xl p-3 shadow-sm hover:border-rose-300 transition-colors flex items-center gap-3"
                                  >
                                    <div className="w-8 h-8 rounded-full bg-rose-50 flex flex-shrink-0 items-center justify-center">
                                      <Heart className="w-4 h-4 text-rose-500" />
                                    </div>
                                    <div className="flex-1 min-w-0 pr-4">
                                      <div className="flex items-center justify-between mb-0.5">
                                        <span className="font-bold text-xs text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md inline-block uppercase tracking-wider">{fav.name}</span>
                                      </div>
                                      <span className="font-bold text-sm text-slate-800 truncate block">{fav.address}</span>
                                    </div>
                                  </button>
                                ))
                              ) : (
                                <div className="text-center py-4">
                                  <p className="text-xs text-slate-500 font-medium mb-1 pt-1">No favorite addresses saved.</p>
                                  <p className="text-[10px] text-slate-400">Add them in the Saved tab.</p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <AnimatePresence>
                        {showRegularJourneys && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }} 
                            animate={{ opacity: 1, height: "auto" }} 
                            exit={{ opacity: 0, height: 0 }} 
                            className="ml-6 overflow-hidden pr-1"
                          >
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 mb-2 shadow-sm space-y-2 relative">
                              <button onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setShowRegularJourneys(false); }} className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                              {profile?.regularJourneys && profile.regularJourneys.length > 0 ? (
                                profile.regularJourneys.map((j: any, idx: number) => (
                                  <div key={idx} className="flex flex-col gap-2 p-2 bg-white rounded-xl border border-slate-100 shadow-sm relative pr-2">
                                    <div className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1 mb-1 pr-4">{j.name || "Saved Route"}</div>
                                    <div className="flex items-center gap-2 text-xs">
                                      <MapPin className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                                      <span className="font-semibold text-slate-600 truncate">{j.from}</span>
                                    </div>
                                    <div className="w-0.5 h-2 bg-slate-200 ml-1.5" />
                                    <div className="flex items-center gap-2 text-xs">
                                      <MapPin className="w-3 h-3 text-red-500 flex-shrink-0" />
                                      <span className="font-semibold text-slate-600 truncate">{j.to}</span>
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                      <button 
                                        onClick={() => {
                                          geocodeLocation(j.from, setPickup, setPickupCoords);
                                          geocodeLocation(j.to, setDropoff, setDropoffCoords);
                                          setDetailsView("vehicle");
                                        }}
                                        className="flex-1 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors"
                                      >
                                        Book Outward
                                      </button>
                                      <button 
                                        onClick={() => {
                                          geocodeLocation(j.to, setPickup, setPickupCoords);
                                          geocodeLocation(j.from, setDropoff, setDropoffCoords);
                                          setDetailsView("vehicle");
                                        }}
                                        className="flex-1 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-xs font-bold hover:bg-orange-100 transition-colors"
                                      >
                                        Book Return
                                      </button>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-center py-4">
                                  <p className="text-xs text-slate-500 font-medium mb-3 pt-1">No regular journeys saved yet.</p>
                                  <p className="text-[10px] text-slate-400">Save routes in My Rides as regular journeys.</p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
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
                </>
              ) : (
                <>
                  <div className="flex flex-col bg-white rounded-[16px] border border-black mb-2 shrink-0 shadow-sm">
                    <div className="flex flex-1 items-center gap-3 p-3 overflow-hidden">
                      <button onClick={() => setDetailsView("address")} className="p-2 rounded-xl bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-300 transition-colors shrink-0 aspect-square flex items-center justify-center h-10 w-10 shadow-sm"><ChevronLeft className="w-5 h-5" /></button>
                      <div className="flex flex-col flex-1 overflow-hidden relative pl-2 space-y-1.5">
                        <div className="absolute left-3 top-2.5 bottom-2.5 w-0.5 border-l-[1.5px] border-dotted border-slate-300" />
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
                          "flex items-center justify-center gap-2 px-3 py-1.5 rounded-[8px] font-bold text-xs transition-colors duration-300",
                          nearbyDriversCount > 0 
                            ? "bg-[#D6F5E1] text-[#1E7145]" 
                            : driversAvailableSoonCount > 0 
                              ? "bg-lime-100 text-lime-800"
                              : "bg-red-100 text-red-800"
                        )}>
                          <Car className="w-4 h-4 shrink-0" />
                          <span>
                            {nearbyDriversCount === 0 && driversAvailableSoonCount === 0 && "No drivers available nearby"}
                            {nearbyDriversCount > 0 && nearbyDriversCount <= 5 && `${nearbyDriversCount} drivers available now`}
                            {nearbyDriversCount > 5 && "5+ drivers available now"}
                            {nearbyDriversCount === 0 && driversAvailableSoonCount > 0 && `${driversAvailableSoonCount} drivers available soon`}
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
                          <div className="flex-1 flex justify-between items-center bg-white border border-black rounded-[8px] px-3 py-2.5 shadow-sm">
                             <div className="flex items-center gap-2 text-slate-900 font-bold">
                               <Zap className="w-4 h-4" />
                               <span className="text-[13px]">Priority</span>
                             </div>
                             <button 
                               onClick={() => setIsPriority(!isPriority)}
                               className={cn("w-9 h-5 rounded-full transition-colors relative border", isPriority ? "bg-[#2563EB] border-[#2563EB]" : "bg-slate-200 border-black")}
                             >
                               <div className={cn("absolute top-[1.5px] w-4 h-4 bg-white rounded-full transition-transform shadow-sm", isPriority ? "right-[1.5px]" : "left-[1.5px]")} />
                             </button>
                          </div>
                          <div className="flex-1 flex justify-between items-center bg-white border border-black rounded-[8px] px-3 py-2.5 shadow-sm">
                             <div className="flex items-center gap-2 text-slate-900 font-bold">
                               <Dog className="w-4 h-4" />
                               <span className="text-[13px]">Pet</span>
                             </div>
                             <button 
                               onClick={() => setIsPetFriendly(!isPetFriendly)}
                               className={cn("w-9 h-5 rounded-full transition-colors relative border", isPetFriendly ? "bg-[#2563EB] border-[#2563EB]" : "bg-slate-200 border-black")}
                             >
                               <div className={cn("absolute top-[1.5px] w-4 h-4 bg-white rounded-full transition-transform shadow-sm", isPetFriendly ? "right-[1.5px]" : "left-[1.5px]")} />
                             </button>
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
                        <div className="bg-white shadow-sm rounded-[8px] pb-2 pt-3 px-3 border border-black">
                          <p className="text-[10px] font-bold uppercase text-slate-900 tracking-widest mb-2">Fare Breakdown</p>
                          <div className="space-y-1 mb-2 text-[13px] text-black font-medium">
                            <div className="flex justify-between"><span>Base fare:</span><span>£{(fareEstimate || 5.0).toFixed(2)}</span></div>
                            <div className="flex justify-between"><span>Vehicle ({CAR_CATEGORIES.find(c => c.id === selectedCategory)?.name}):</span><span>£{getComputedFare(selectedCategory).toFixed(2)}</span></div>
                            {isPriority && <div className="flex justify-between text-[#2563EB] font-bold"><span>Priority:</span><span>+£3.00</span></div>}
                            {isPetFriendly && <div className="flex justify-between text-[#2563EB] font-bold"><span>Pet:</span><span>+£3.00</span></div>}
                            {((profile?.pendingCharges || 0) > 0 && (profile?.cancellationCount || 0) === 1) && <div className="flex justify-between text-red-600 font-bold"><span>Unpaid Cancellation Fee:</span><span>+£{(profile?.pendingCharges || 0).toFixed(2)}</span></div>}
                          </div>
                          <div className="border-t border-slate-300 pt-2 flex flex-col font-black text-[17px] text-slate-900 border-b pb-2 mb-1">
                            <div className="flex items-center justify-between">
                              <span>Total estimate:</span>
                              <span className="text-[20px]">£{(getComputedFare(selectedCategory) + (isPriority ? 3 : 0) + (isPetFriendly ? 3 : 0) + (((profile?.pendingCharges || 0) > 0 && (profile?.cancellationCount || 0) === 1) ? (profile?.pendingCharges || 0) : 0)).toFixed(2)}</span>
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

                        <div className="pt-2">
                           <div className="relative">
                             <div className="absolute top-2.5 left-3 flex items-center justify-center">
                               <MessageSquare className="w-4 h-4 text-amber-500" />
                             </div>
                             <input 
                               type="text"
                               value={comments}
                               onChange={(e) => setComments(e.target.value)}
                               className="w-full bg-amber-50/80 border border-black rounded-[8px] pl-9 pr-3 py-2.5 text-[13px] font-medium text-slate-900 placeholder:text-amber-700/60 focus:outline-none focus:border-black focus:bg-amber-100/50 transition-all min-w-0 shadow-sm"
                               placeholder="Message to driver (e.g. Look for blue gate)"
                               maxLength={100}
                             />
                           </div>
                        </div>
                        
                        <div>
                           <button 
                             onClick={handleConfirmBooking} 
                             disabled={!pickup || !dropoff} 
                             className="w-full py-3.5 bg-[#0F172A] text-white rounded-[12px] font-bold text-[16px] hover:bg-black active:scale-95 disabled:opacity-50 transition-all focus:outline-none"
                           >
                             {assignedDriverInfo && ["accepted", "arrived", "in_progress"].includes(assignedDriverInfo.status) ? "Confirm Update" : `Confirm ${CAR_CATEGORIES.find(c => c.id === selectedCategory)?.name}`}
                           </button>
                        </div>
                      </div>
                    )}
                  </AnimatePresence>
                  </>
                  )}
                  <div className="shrink-0 h-[calc(4.5rem+env(safe-area-inset-bottom))] w-full" />
                </div>
              </motion.div>
            )}

            {step === "searching" && (
              <motion.div key="searching" initial={{ y: "100%" }} animate={{ y: 0 }} className="bg-white rounded-t-[32px] p-6 flex flex-col items-center border-t border-slate-200 pointer-events-auto h-full w-full overflow-y-auto no-scrollbar shadow-[0_-8px_30px_rgba(0,0,0,0.12)] relative z-20">
                <div className="w-10 h-[5px] bg-slate-200 rounded-full mb-5"/>
                <p className="text-slate-800 text-sm font-semibold mb-1">Searching for drivers...</p>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Requesting...</h2>
                <p className="text-slate-600 font-medium text-[15px] text-center mb-6 max-w-[280px]">Pinging the fleet to find your professional driver.</p>
                
                <SearchingTimer />

                <div className="w-full max-w-[320px] bg-[#f0f9ff] rounded-[16px] py-1.5 px-4 border border-black flex flex-col items-center justify-center shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] mb-2 mt-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0">Total Fare Estimate</p>
                  <p className="text-2xl font-black text-[#0f172a] leading-tight mb-1">£{(getComputedFare(selectedCategory) + (isPriority ? 3 : 0) + (isPetFriendly ? 3 : 0) + ((profile?.pendingCharges || 0) > 0 && (profile?.cancellationCount || 0) === 1 ? (profile?.pendingCharges || 0) : 0)).toFixed(2)}</p>
                  
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
                      <motion.div key="priority-prompt" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute bottom-full left-0 right-0 mb-3 p-4 bg-white border border-slate-200 shadow-xl rounded-2xl z-20">
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
                      <div className={cn("w-[42px] h-[26px] rounded-full p-1 transition-colors relative flex items-center shrink-0 border", isPriority ? "bg-amber-900 border-amber-950/20" : "bg-black/10 border-black/5")}>
                        <div className={cn("w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-transform", isPriority ? "translate-x-4" : "translate-x-0")} />
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
                {!assignedDriverInfo && <button onClick={simulateDriverAccepts} className="w-full max-w-[320px] font-black text-[15px] py-4 rounded-[16px] border border-black bg-[#e0e7ff] text-[#4338ca] hover:bg-[#c7d2fe] active:scale-[0.98] transition-transform">Simulate Match</button>}
                <div className="shrink-0 h-[calc(6rem+env(safe-area-inset-bottom))] w-full mt-auto" />
              </motion.div>
            )}

            {step === "confirmed" && (
              <>
                {assignedDriverInfo?.status === "accepted" && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-[#0a1930] rounded-[16px] px-5 py-3 border border-[#1e293b] shadow-[0_8px_20px_rgba(0,0,0,0.15)] flex flex-col items-center justify-center gap-1.5 mb-3 pointer-events-auto w-fit mx-auto z-20 mt-auto">
                     <div className="flex items-center gap-2.5">
                       <Car className="w-[20px] h-[20px] text-white" />
                       <span className="font-black text-white text-[17px] tracking-wide">
                         {(liveEtaSeconds !== null && liveEtaSeconds > 0) ? `Arriving in ${Math.floor(liveEtaSeconds / 60) > 0 ? Math.floor(liveEtaSeconds / 60) + 'm ' : ''}${liveEtaSeconds % 60}s` : 
                          "Driver arriving soon..."}
                       </span>
                     </div>
                     {(assignedDriverInfo.isFinishingTrip || assignedDriverInfo.stackedDriverDelay) && (
                       <div className="bg-amber-400/20 px-3 py-1 rounded-full mt-0.5">
                         <span className="text-[11px] font-bold text-amber-300 uppercase tracking-widest flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                            Dropping off another passenger
                         </span>
                       </div>
                     )}
                  </motion.div>
                )}
                <motion.div key="confirmed" initial={{ y: "100%" }} animate={{ y: 0 }} className="bg-white rounded-t-[28px] p-5 border-t border-slate-200/50 pointer-events-auto h-full w-full overflow-y-auto no-scrollbar shadow-[0_-8px_30px_rgba(0,0,0,0.08)] relative z-20 flex flex-col">
                <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4"/>
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
                    {["I'm coming!", "Be there in 2 mins", "Wait for me", "I'm outside"].map((msg, i) => (
                      <button 
                        key={i} 
                        onClick={() => handleSendQuickMessage(msg)}
                        className="whitespace-nowrap px-4 py-2 bg-slate-800 border border-slate-700 text-white font-bold text-[13px] rounded-[12px] shadow-sm active:scale-95 transition-transform"
                      >
                        {msg}
                      </button>
                    ))}
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
                  <div className="w-[48px] h-[48px] bg-slate-100 rounded-full border border-slate-200 shadow-sm shrink-0 overflow-hidden">
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
                      <p className="text-[17px] font-black text-slate-900 leading-none">Total: £{((assignedDriverInfo?.fareEstimate || fareEstimate || 0) + (assignedDriverInfo?.tipAmount || 0)).toFixed(2)}</p>
                      
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
                      assignedDriverInfo?.status === "awaiting_payment" ? "bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:bg-emerald-600" : "bg-slate-100 text-slate-400 border border-slate-200"
                    )}
                  >
                     <Zap className="w-4 h-4 fill-current" /> Pay by Card / Scan QR
                  </button>
                )}
                
                {(assignedDriverInfo?.status === "in_progress" || assignedDriverInfo?.status === "awaiting_payment") && (
                    <div className="flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar pb-1">
                      <button 
                         onClick={submitTipInline}
                         disabled={(!selectedTip && (!customTip || parseFloat(customTip) <= 0)) || isAddingTip || assignedDriverInfo?.status === "awaiting_payment"}
                         className={cn("px-3 py-1.5 rounded-[10px] font-bold text-[14px] transition-all shrink-0 border-2", isAddingTip ? "bg-[#0a1930] text-white border-[#0a1930]" : ((selectedTip || parseFloat(customTip)) ? "border-[#0a1930] bg-white text-[#0a1930]" : "border-transparent text-slate-900 bg-transparent px-1 mr-1"), assignedDriverInfo?.status === "awaiting_payment" && "opacity-50")}
                      >
                         {(!selectedTip && (!customTip || parseFloat(customTip) <= 0)) ? "Select Tip" : "Add Tip"}
                      </button>
                      {[2, 3, 5].map((amount) => (
                        <button key={amount} onClick={() => { 
                            if (assignedDriverInfo?.status === "awaiting_payment") return;
                            if (selectedTip === amount) {
                              setSelectedTip(null);
                            } else {
                              setSelectedTip(amount); 
                              setCustomTip(""); 
                            }
                          }}
                          className={cn("px-4 py-1.5 rounded-[10px] font-bold text-[14px] transition-all shrink-0", selectedTip === amount ? "bg-[#0a1930] text-white" : "bg-[#e2e8f0] text-[#0a1930]", assignedDriverInfo?.status === "awaiting_payment" ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-300")}
                        >
                          £{amount}
                        </button>
                      ))}
                      <button onClick={() => {
                          if (assignedDriverInfo?.status === "awaiting_payment") return;
                          if (!selectedTip && parseFloat(customTip) > 0) {
                            setCustomTip("");
                            setSelectedTip(null);
                          } else {
                            setShowCustomTipKeypad(true);
                          }
                        }}
                        className={cn("px-4 py-1.5 rounded-[10px] font-bold text-[14px] transition-all shrink-0", (!selectedTip && parseFloat(customTip) > 0) ? "bg-[#0a1930] text-white" : "bg-[#e2e8f0] text-[#0a1930]", assignedDriverInfo?.status === "awaiting_payment" ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-300")}
                      >
                        {(!selectedTip && parseFloat(customTip) > 0) ? `£${parseFloat(customTip)}` : "Custom"}
                      </button>
                   </div>
                )}
                
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setIsChatOpen(true)} className="relative flex-1 py-3 bg-[#0a1930] border border-black rounded-[16px] flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                    <MessageSquare className="w-[22px] h-[22px] text-white" />
                    {unreadChatCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white items-center justify-center text-[8px] font-bold text-white shadow-sm">
                          {unreadChatCount}
                        </span>
                      </span>
                    )}
                  </button>
                  <a href={`tel:${assignedDriverInfo?.phone || ""}`} className="flex-1 py-3 bg-white border border-black rounded-[16px] flex items-center justify-center shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] active:scale-95 transition-transform"><Phone className="w-[22px] h-[22px] text-[#0a1930]" /></a>
                  <button onClick={() => setIsMapFullScreen(true)} className="flex-[2] py-3 bg-[#0a1930] border border-black text-white rounded-[16px] font-bold text-[15px] shadow-lg shadow-blue-900/20 active:scale-[0.98] transition-transform">Track Live Driver</button>
                </div>
                
                {assignedDriverInfo?.status !== "in_progress" && assignedDriverInfo?.status !== "awaiting_payment" && (
                  <div className="flex gap-3 mt-4">
                    <button onClick={() => setStep("details")} className="flex-[1.1] py-[18px] border border-black bg-[#4fa764] text-white rounded-[16px] font-bold text-[15px] shadow-lg shadow-green-900/10 active:scale-[0.98] transition-transform">Edit Ride Options</button>
                    <div className="flex-1">
                      <CancelRideButton_ConfirmedPhase acceptedAt={assignedDriverInfo?.acceptedAt || Date.now()} onCancel={handleCancelConfirmed} />
                    </div>
                  </div>
                )}
                
                <div className="text-center">
                  <button onClick={simulateNextState} className="w-full mt-3 font-bold py-3 rounded-[16px] border border-black bg-[#e0e7ff] text-[#4338ca] active:scale-[0.98] transition-transform text-[15px]">Simulate Next: {assignedDriverInfo?.status === "accepted" ? "Arrived" : assignedDriverInfo?.status === "arrived" ? "In Progress" : "Complete"}</button>
                </div>
                
                <AnimatePresence>
                  {showCancelPrompt && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[2px]">
                      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white w-full max-w-sm rounded-[24px] p-6 shadow-2xl border border-slate-200">
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
                    <motion.div initial={{ opacity: 0, y: "100%" }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: "100%" }} className="fixed inset-0 z-[200] bg-[#f8fafc] flex flex-col pt-[env(safe-area-inset-top,20px)] pointer-events-auto">
                      <div className="flex items-center justify-between p-4 pb-2">
                         <div className="w-10"></div>
                         <h2 className="text-xl font-bold text-[#0a1930] mb-0">Custom Tip</h2>
                         <button onClick={() => setShowCustomTipKeypad(false)} className="w-10 h-10 bg-slate-200/60 rounded-full flex items-center justify-center active:scale-95 transition-transform">
                           <X className="w-5 h-5 text-slate-800" />
                         </button>
                      </div>
                      
                      <div className="flex-1 flex flex-col px-6 pt-6 relative overflow-hidden">
                        <div className="bg-white border text-center border-slate-200 rounded-[20px] py-10 shadow-sm mb-12">
                           <span className="text-6xl font-black tracking-tight text-[#0a1930]">£{customTip || "0.00"}</span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-y-6 gap-x-4 max-w-[280px] mx-auto w-full mb-10">
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
                        
                        <div className="mt-auto px-6 pb-8">
                           <p className="text-center text-slate-700 font-medium text-[15px] mb-4">Your driver receives 100% of the tip.</p>
                           <button onClick={() => {
                              const amount = parseFloat(customTip);
                              if (amount > 0) {
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
                <div className="shrink-0 h-[calc(6rem+env(safe-area-inset-bottom))] w-full mt-auto" />
              </motion.div>
              </>
            )}

            {step === "receipt" && completedRideData && (
              <motion.div key="receipt" initial={{ y: "100%" }} animate={{ y: 0 }} className="bg-card rounded-t-[40px] p-6 border border-border-main pointer-events-auto h-full w-full overflow-y-auto no-scrollbar relative z-[200] flex flex-col shadow-2xl">
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
                  <h2 className="text-5xl font-black text-text-main tracking-tighter">£{completedRideData.finalFare?.toFixed(2) || ((completedRideData.fareEstimate || fareConfig.baseFare) + (completedRideData.tipAmount || 0) + (completedRideData.cancellationFee || 0)).toFixed(2)}</h2>
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
                    <span className="text-text-main">£{(completedRideData.finalFare ? completedRideData.finalFare - (completedRideData.tipAmount || 0) - (completedRideData.cancellationFee || 0) - (completedRideData.isPriority ? 3 : 0) : ((completedRideData.fareEstimate || fareConfig.baseFare) - (completedRideData.isPriority ? 3 : 0))).toFixed(2)}</span>
                  </div>
                  {completedRideData.isPriority && (
                    <div className="flex justify-between text-sm font-bold text-blue-600">
                      <span>Priority Boost</span>
                      <span>+£3.00</span>
                    </div>
                  )}
                  {(completedRideData.cancellationFee || 0) > 0 && (
                    <div className="flex justify-between text-sm font-bold text-danger">
                      <span>Unpaid Cancellation Fee</span>
                      <span>+£{completedRideData.cancellationFee.toFixed(2)}</span>
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
                      <p className="text-sm font-black text-text-main text-left">{completedRideData.driverName || "AnyRide Driver"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text-muted text-right mb-1">Date</p>
                      <p className="text-sm font-black text-text-main text-right">{completedRideData.completedAt ? new Date(completedRideData.completedAt.toMillis ? completedRideData.completedAt.toMillis() : Date.now()).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                </div>
                
                {!hasSubmittedReview ? (
                   <div className="mb-6 bg-slate-50 rounded-2xl p-5 border border-black">
                     <p className="text-center text-sm font-black text-slate-700 mb-3">Rate your driver</p>
                     <div className="flex justify-center gap-2 mb-4">
                       {[1, 2, 3, 4, 5].map((star) => (
                         <button
                           key={star}
                           onClick={() => setRideRating(star)}
                           className="p-2 hover:scale-110 active:scale-95 transition-transform"
                         >
                           <Star className={cn("w-9 h-9 transition-colors", star <= rideRating ? "text-amber-400 fill-amber-400" : "text-slate-300 hover:text-amber-400 fill-transparent hover:fill-amber-400")} />
                         </button>
                       ))}
                     </div>
                     
                     <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex flex-col gap-4 overflow-hidden">
                         <div className="flex overflow-x-auto no-scrollbar gap-2 justify-start px-0.5 pb-1">
                           {(rideRating >= 4 ? ["Smooth Navigator", "Clean Car", "Great Conversation", "Expert Route"] : ["Unclean", "Navigation Issues", "Driving Safety", "Rude", "Late"]).map((tag) => (
                              <button 
                                key={tag} 
                                onClick={() => setSelectedReviewTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                                className={cn("px-3 border-[1.5px] whitespace-nowrap flex-none py-1.5 rounded-full text-[13.5px] font-bold transition-colors shadow-sm", selectedReviewTags.includes(tag) ? (rideRating >= 4 ? "bg-[#f0f9ff] text-[#0369a1] border-[#bae6fd]" : "bg-rose-50 text-rose-700 border-rose-200") : "bg-white text-slate-600 border-slate-200")}
                              >
                                {tag}
                              </button>
                           ))}
                         </div>
                         
                         {rideRating < 5 && (
                           <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                              <p className="text-[11px] font-black text-slate-500 mb-1.5 ml-1 uppercase tracking-widest pl-1">Add a comment</p>
                              <textarea 
                                className="w-full bg-white border border-slate-200 rounded-xl p-3.5 text-[15px] font-medium text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none transition-all shadow-sm"
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
                  className="w-full py-4 mt-auto rounded-2xl bg-text-main text-card font-black active:scale-95 transition-transform disabled:bg-slate-700"
                >
                  {isSubmittingReview ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin"/> Submitting...</span> : "Done"}
                </button>
                <div className="shrink-0 h-[calc(6rem+env(safe-area-inset-bottom))] w-full mt-auto" />
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

                <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="text-lg font-medium text-slate-700 text-center max-w-[280px] leading-relaxed">
                  <span className="font-bold">{assignedDriverInfo.name?.split(' ')[0] || "Driver"}</span> is on {assignedDriverInfo.name && assignedDriverInfo.name.toLowerCase().includes("sim") || assignedDriverInfo.name && assignedDriverInfo.name.toLowerCase().includes("sara") ? "her" : "their"} way in a <span className="font-bold">{assignedDriverInfo.vehicle || "Silver Toyota"}</span>
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

              <div className="p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] relative z-10 w-full mt-auto flex flex-col items-center">
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
     </div>
  );
}

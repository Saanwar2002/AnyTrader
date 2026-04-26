import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  MapPin, Navigation, Car, Clock, X, Check, Target, 
  MessageSquare, ChevronRight, ChevronLeft, Zap, History, Loader2, 
  Mic, MicOff, Star, Users, Repeat, Shield, Plus, Heart,
  Home, Briefcase, Dog, Accessibility, MessageCircle, Phone, AlertCircle, Hammer
} from "lucide-react";
import RideChat from "./RideChat";
import { cn } from "@/src/lib/utils";
import { db, addDoc, collection, serverTimestamp, doc, updateDoc, arrayUnion, arrayRemove, onSnapshot, setDoc, increment } from "@/src/firebase";
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

type BookingStep = "details" | "searching" | "confirmed";

const CAR_CATEGORIES = [
  { id: 'standard', name: 'Standard Car', multiplier: 1.0, wait: '3-5', capacity: 4, icon: Car },
  { id: 'executive', name: 'Executive', multiplier: 1.5, wait: '5-8', capacity: 4, icon: Shield },
  { id: 'luxury', name: 'Luxury', multiplier: 2.2, wait: '8-12', capacity: 4, icon: Star },
  { id: '6seater', name: '6-Seater XL', multiplier: 1.4, wait: '6-10', capacity: 6, icon: Users },
  { id: '8seater', name: '8-Seater Max', multiplier: 1.8, wait: '8-15', capacity: 8, icon: Users },
  { id: 'wav', name: 'Wheelchair', multiplier: 1.5, wait: '10-20', capacity: 4, icon: Accessibility }
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
      <p className="text-xl font-black text-warning">{mins}:{secs}</p>
      {elapsed < 180 ? (
        <p className="text-[10px] font-bold text-text-muted mt-0.5 uppercase tracking-widest">Free wait: {Math.floor((180 - elapsed) / 60)}:{((180 - elapsed) % 60).toString().padStart(2, '0')}</p>
      ) : elapsed < 300 ? (
        <p className="text-[10px] font-bold text-warning mt-0.5 uppercase tracking-widest text-[#FF9500]">Paid wait: {Math.floor((elapsed - 180) / 60)}:{((elapsed - 180) % 60).toString().padStart(2, '0')}</p>
      ) : (
        <p className="text-[10px] font-bold text-danger mt-0.5 uppercase tracking-widest">Cancel fee applies</p>
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
    <div className="flex flex-col items-center justify-center bg-surface border border-border-main px-4 py-2 rounded-2xl shadow-sm mb-6">
      <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Time Elapsed</p>
      <p className="text-xl font-black text-primary font-mono">{mins.toString().padStart(2, '0')}:{secs}</p>
    </div>
  );
}

function SearchingCancelButton({ onCancel, startTime }: { onCancel: () => void, startTime: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(Math.floor((Date.now() - startTime) / 1000));
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const timeLeft = 120 - elapsed;
  const isPenalty = timeLeft <= 0;

  const displayTime = Math.abs(timeLeft);
  const mins = Math.floor(displayTime / 60);
  const secs = (displayTime % 60).toString().padStart(2, '0');

  return (
    <button onClick={onCancel} className={cn("flex-1 font-black text-sm py-4 rounded-2xl border-2 shadow-sm active:scale-95 transition-colors flex items-center justify-center gap-2", isPenalty ? "bg-danger/5 border-danger/10 hover:bg-danger/10 text-danger" : "bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-700")}>
      Cancel
      <span className={cn("font-mono text-[10px] px-1.5 py-0.5 rounded-md border text-center min-w-[34px]", isPenalty ? "bg-danger/10 border-danger/20" : "bg-emerald-100 border-emerald-300")}>{isPenalty ? "+" : ""}{mins}:{secs}</span>
    </button>
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
    <button onClick={onCancel} className={cn("text-xs font-bold uppercase tracking-widest py-3 px-8 border transition-colors flex items-center justify-center gap-2 mx-auto rounded-xl", 
      isFree ? "border-emerald-500/50 text-emerald-600 hover:bg-emerald-50" : "border-danger/20 text-danger hover:bg-danger/5"
    )}>
      Cancel Ride
      {isFree ? (
        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md font-mono">{mins}:{secs}</span>
      ) : (
        <span className="bg-danger/10 text-danger px-2 py-0.5 rounded-md font-mono">Fee Applies</span>
      )}
    </button>
  );
}

export default function PassengerBooking() {
  const { user, profile } = useAuth();
  const { theme, switchPortal } = usePortal();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<BookingStep>("details");
  const [houseNumber, setHouseNumber] = useState("");
  const [pickup, setPickup] = useState(searchParams.get("pickup") || "");
  const [dropoff, setDropoff] = useState(searchParams.get("dropoff") || "");
  const [comments, setComments] = useState(searchParams.get("comments") || "");
  const [waitTolerance, setWaitTolerance] = useState<10 | 20 | 30>(20);
  const [selectedCategory, setSelectedCategory] = useState("standard");
  const [isPetFriendly, setIsPetFriendly] = useState(false);
  const [isPriority, setIsPriority] = useState(false);
  const [hasPaymentMeans, setHasPaymentMeans] = useState(false);
  const [editId, setEditId] = useState<string | null>(searchParams.get("edit"));
  
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
          if (data.status === "pending" || data.status === "draft") {
            setPickup(data.pickup || "");
            setDropoff(data.dropoff || "");
            setComments(data.comments || "");
            setSelectedCategory(data.carCategory || "standard");
            setIsPetFriendly(data.isPetFriendly || false);
            if (data.waitTolerance) setWaitTolerance(data.waitTolerance as any);
          }
        }
      });
      return () => unsub();
    }
  }, [editId]);

  const [isDetecting, setIsDetecting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [fareEstimate, setFareEstimate] = useState<number | null>(null);
  const [distanceMiles, setDistanceMiles] = useState<number>(0);
  const [durationMinutes, setDurationMinutes] = useState<number>(0);
  const [assignedDriverInfo, setAssignedDriverInfo] = useState<any>(null);
  const [fareConfig, setFareConfig] = useState({ baseFare: 3.5, distanceRate: 1.3, timeRate: 0.15, waitRatePerMinute: 0.25, minFare: 5.0, commissionRate: 0.12 });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showRegularJourneys, setShowRegularJourneys] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  
  const [detailsView, setDetailsView] = useState<"address" | "vehicle">("address");

  const bottomSheetRef = useRef<HTMLDivElement>(null);
  const vehicleSelectionRef = useRef<HTMLDivElement>(null);
  
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

  const panToWithOffset = useCallback((coords: {lat: number, lng: number}) => {
    if (!map) return;
    map.panTo(coords);
    // Offset North-South based on screen height to keep the pin visible above the sheet
    setTimeout(() => {
       map.panBy(0, window.innerHeight * 0.15); 
    }, 100);
  }, [map]);

  useEffect(() => {
    if (mapCenter && map && step === "details") {
      panToWithOffset(mapCenter);
    }
  }, [mapCenter, map, panToWithOffset, step]);

  // Routing and Distance Calculation (consolidated)
  useEffect(() => {
    if (pickupCoords && dropoffCoords && isLoaded) {
      const getRoute = () => {
        const directionsService = new google.maps.DirectionsService();
        const validStops = stops.filter(s => s.coords !== null).map(s => ({
          location: new google.maps.LatLng(s.coords!.lat, s.coords!.lng),
          stopover: true
        }));

        directionsService.route({
          origin: new google.maps.LatLng(pickupCoords.lat, pickupCoords.lng),
          destination: new google.maps.LatLng(dropoffCoords.lat, dropoffCoords.lng),
          waypoints: validStops,
          travelMode: google.maps.TravelMode.DRIVING,
        }, (result, status) => {
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
                  top: 100, 
                  right: 50, 
                  bottom: window.innerHeight * 0.45, 
                  left: 50 
                } 
              });
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
      };
      getRoute();
    } else {
      setRouteLine([]);
    }
  }, [pickupCoords, dropoffCoords, stops, map, fareConfig, isLoaded]);

  useEffect(() => {
    if (navigator.geolocation && !pickupCoords) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMapCenter(c);
        setPickupCoords(c);
      });
    }
  }, [pickupCoords]);

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
    });
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

  const startListening = () => {
    triggerHaptic(ImpactStyle.Light);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-GB";
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      await processVoiceCommand(transcript);
    };
    recognition.start();
  };

  const processVoiceCommand = async (text: string) => {
    setIsAiProcessing(true);
    toast.info("AI extracting details...");
    try {
      const result = await processTaxiVoiceCommand(text);
      
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

  const [suggestions, setSuggestions] = useState<{label: string, lat?: number, lon?: number, placeId?: string, placePrediction?: any}[]>([]);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    let val = "";
    if (activeField === "pickup") val = pickup;
    else if (activeField === "dropoff") val = dropoff;
    else if (activeField?.startsWith("stop-")) {
      const idx = parseInt(activeField.split('-')[1]);
      val = stops[idx]?.address || "";
    }
    if (!val || val.length < 3) { setSuggestions([]); return; }

    const fetchSuggestions = async () => {
      setIsLoadingAddress(true);
      
      try {
        if (!window.google || !window.google.maps) {
          throw new Error("Google Maps not loaded. Check API Key or libraries.");
        }

        const { AutocompleteSuggestion } = await window.google.maps.importLibrary("places") as any;

        const request = {
          input: val,
          includedRegionCodes: ['GB'],
        };

        const { suggestions: predictions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

        setIsLoadingAddress(false);
        
        if (predictions && predictions.length > 0) {
          const cleaned = predictions.map((p: any) => ({
            label: p.placePrediction.text.text,
            placeId: p.placePrediction.placeId,
            placePrediction: p.placePrediction // Save the raw prediction object to use toPlace() later
          }));
          setSuggestions(cleaned);
        } else {
          setSuggestions([]);
        }
      } catch (err: any) {
        console.error("Google Places Exception:", err);
        import("sonner").then(({ toast }) => toast.error(`Map Error: ${err.message}`));
        setSuggestions([]);
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
      
      if (accuracy > 10) {
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
          const postcode = res.address_components.find(c => c.types.includes("postal_code"))?.long_name;
          if (postcode && !addr.includes(postcode)) {
            addr += `, ${postcode}`;
          }
          setPickup(addr);
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

  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const searchingStartTimeRef = useRef<number | null>(null);

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

    setStep("searching");
    searchingStartTimeRef.current = Date.now();
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
        status: "pending",
        currency: "GBP",
        handshakeCode: Math.floor(1000 + Math.random() * 9000).toString(),
      };
      const activeId = editId || currentRideId;
      if (activeId) {
         await updateDoc(doc(db, "ride_requests", activeId), { ...rideData, updatedAt: serverTimestamp() });
         setCurrentRideId(activeId);
      } else {
         const docRef = await addDoc(collection(db, "ride_requests"), { ...rideData, createdAt: serverTimestamp() });
         setCurrentRideId(docRef.id);
      }
    } catch (err) { setStep("details"); }
  };

  const handleTogglePriority = async () => {
    if (!currentRideId) return;
    const newPriority = !isPriority;
    try {
      setIsPriority(newPriority);
      await updateDoc(doc(db, "ride_requests", currentRideId), {
         isPriority: newPriority,
         fareEstimate: increment(newPriority ? 3 : -3)
      });
      if (newPriority) {
        toast.success("Priority Boost Activated! (+£3)");
      } else {
        toast.info("Priority Boost Removed (-£3)");
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

  const handleAbandonSearch = async () => {
    if (!currentRideId) return;

    let fee = 0;
    if (searchingStartTimeRef.current) {
        const diffMs = Date.now() - searchingStartTimeRef.current;
        if (diffMs > 120000) { // 2 minutes
            fee = fareConfig.baseFare; 
        }
    }

    if (fee > 0 && !showCancelPrompt) {
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

      toast.success("Ride cancelled.");
      navigate("/my-rides");
    } catch (err) {
      console.error("Cancel failed", err);
      toast.error("Failed to cancel ride.");
    }
  };

  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [cancelFeeToApply, setCancelFeeToApply] = useState(0);

  const handleCancelConfirmed = async () => {
    if (!currentRideId) return;

    let fee = 0;
    if (assignedDriverInfo?.acceptedAt) {
      const diffMs = Date.now() - assignedDriverInfo.acceptedAt;
      if (diffMs > 120000) { // 2 minutes
        fee = fareConfig.baseFare; 
      }
    } else if (step === "searching" && searchingStartTimeRef.current) {
      const diffMs = Date.now() - searchingStartTimeRef.current;
      if (diffMs > 120000) {
        fee = fareConfig.baseFare;
      }
    }

    if (fee > 0 && !showCancelPrompt) {
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

  useEffect(() => {
    if (!currentRideId) return;
    const unsubRide = onSnapshot(doc(db, "ride_requests", currentRideId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.status === 'accepted' && data.driverId) {
          setAssignedDriverInfo({ 
             uid: data.driverId, 
             name: data.driverName || "Driver", 
             vehicle: data.vehicleInfo || "Taxi", 
             plate: data.vehiclePlate || "UNKNOWN",
             code: data.handshakeCode || "---", 
             phone: data.driverPhone || "", 
             status: "accepted",
             fareEstimate: data.fareEstimate || 0,
             rating: data.driverRating || "4.8",
             acceptedAt: data.acceptedAt?.toMillis() || Date.now()
          });
          setStep("confirmed"); triggerHaptic(ImpactStyle.Heavy);
        }
        if (data.status === 'arrived') {
          setAssignedDriverInfo(prev => prev ? { ...prev, status: "arrived", arrivedAt: data.arrivedAt?.toMillis() } : null);
          setStep("confirmed"); triggerHaptic(ImpactStyle.Heavy);
          toast.success("Your driver has arrived!");
        }
        if (data.status === 'in_progress') {
          setAssignedDriverInfo(prev => prev ? { ...prev, status: "in_progress", startedAt: data.startedAt?.toMillis() } : null);
          setStep("confirmed");
          
          // Trigger the 'end of journey' pop-up after a short delay for preview purposes
          setTimeout(() => {
            toast('Journey finishing soon', {
               description: "Please have your phone ready to scan the driver's QR code to pay via Stripe.",
               action: { label: 'Got it', onClick: () => console.log('Ready to scan') },
               duration: 20000,
               icon: <X className="w-5 h-5 text-warning" />
            });
            triggerHaptic(ImpactStyle.Heavy);
            // Vibrate pattern for alert
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          }, 15000); // 15s after ride starts
        }
        if (data.status === 'completed') { setStep("details"); setCurrentRideId(null); setAssignedDriverInfo(null); }
      }
    });
    const unsubTrack = onSnapshot(doc(db, "live_tracking", assignedDriverInfo?.uid || "none"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.lat && data.lng) setDriverPos({ lat: data.lat, lng: data.lng });
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
      else if (activeField === "dropoff") { 
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
      setSuggestions([]); setActiveField(null);
      
      if (currentPickup && currentDropoff) {
         setDetailsView("vehicle");
      }
    };

    if (s.placePrediction) {
      if (!window.google || !window.google.maps) {
        import("sonner").then(({ toast }) => toast.error("Google Maps not loaded"));
        return;
      }
      try {
        const place = s.placePrediction.toPlace();
        await place.fetchFields({ fields: ['location', 'formattedAddress', 'addressComponents'] });
        const loc = place.location;
        let finalAddr = place.formattedAddress || s.label;
        
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
      finalizeSelection(coords, s.label);
    }
  };

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

  if (!isLoaded) return <div className="h-full flex items-center justify-center bg-surface"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="relative flex-1 w-full overflow-hidden bg-surface flex flex-col min-h-0">
       <div className="absolute inset-0 z-0">
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={mapCenter}
            zoom={15}
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
                  <div className="bg-emerald-50 px-2.5 py-2.5 rounded-xl shadow-xl border border-emerald-200 min-w-[80px] max-w-[180px] pointer-events-auto">
                    <p className="text-[8px] font-black text-emerald-600 uppercase tracking-[0.1em] mb-0.5">Pickup</p>
                    <p className="text-[10px] font-bold text-emerald-950 leading-tight line-clamp-3">{pickup}</p>
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
                  <div className="bg-rose-50 px-2.5 py-2.5 rounded-xl shadow-xl border border-rose-200 min-w-[80px] max-w-[180px] pointer-events-auto">
                    <p className="text-[8px] font-black text-rose-600 uppercase tracking-[0.1em] mb-0.5">Dropoff</p>
                    <p className="text-[10px] font-bold text-rose-950 leading-tight line-clamp-3">{dropoff}</p>
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
                  <div className="bg-amber-50 px-2.5 py-2.5 rounded-xl shadow-xl border border-amber-200 min-w-[80px] max-w-[180px] pointer-events-auto">
                    <p className="text-[8px] font-black text-amber-600 uppercase tracking-[0.1em] mb-0.5">Stop {i+1}</p>
                    <p className="text-[10px] font-bold text-amber-950 leading-tight line-clamp-3">{s.address}</p>
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

            {driverPos && (
              <OverlayViewF position={driverPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                <div className="relative flex items-center justify-center w-8 h-8 -ml-4 -mt-4">
                  <div className="absolute inset-0 bg-primary rounded-full opacity-30 animate-pulse"></div>
                  <div className="bg-primary border-2 border-white w-4 h-4 rounded-full shadow-lg z-10 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 bg-black rounded-full"></span>
                  </div>
                  <div className="absolute -top-6 bg-black/80 px-2 py-0.5 rounded text-[9px] font-bold text-white whitespace-nowrap shadow border border-primary/30">
                    TAXI
                  </div>
                </div>
              </OverlayViewF>
            )}
            {routeLine.length > 0 && <PolylineF path={routeLine} options={{ strokeColor: '#2563eb', strokeOpacity: 0.8, strokeWeight: 5 }} />}
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
       
       <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none flex flex-col justify-end">
          <AnimatePresence mode="wait">
            {step === "details" && (
              <motion.div
                key="details"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                className="bg-card rounded-t-[40px] shadow-2xl pointer-events-auto flex flex-col max-h-[65vh] w-full border-t border-border-main pb-[calc(4rem+env(safe-area-inset-bottom))]"
              >
                <div className="w-12 h-1.5 bg-border-main rounded-full mx-auto mt-3 mb-1 shrink-0" />
                <div ref={bottomSheetRef} className="p-4 pt-2 overflow-x-hidden overflow-y-auto space-y-4 no-scrollbar flex-1">
                  {detailsView === "address" ? (
                    <>
                      <div className="mb-1">
                        <button onClick={startListening} disabled={isListening || isAiProcessing} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 py-4 px-4 rounded-3xl flex items-center justify-center gap-3 font-bold shadow-lg active:scale-95 transition-all">
                          {isListening ? (
                            <>
                              <div className="relative flex items-center justify-center">
                                <div className="absolute inset-0 bg-current opacity-20 rounded-full animate-ping" />
                                <Mic className="w-5 h-5 animate-pulse" />
                              </div>
                              Listening...
                            </>
                          ) : isAiProcessing ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin"/> Processing...
                            </>
                          ) : (
                            <>
                              <Mic className="w-5 h-5"/> Tap to Book by Voice
                            </>
                          )}
                        </button>
                      </div>
                      <div className="bg-surface rounded-3xl p-2 pb-3 border border-border-main shadow-sm mb-4 shrink-0">
                    <div className="space-y-2 relative">
                      <div className="absolute left-3 top-8 bottom-8 w-0.5 border-l-2 border-dashed border-border-main/60" />
                      
                      {/* Pickup */}
                      <div className="relative flex items-center group w-full">
                        <div className="w-6 flex justify-center shrink-0">
                           <div className="w-2.5 h-2.5 rounded-full border-2 border-emerald-500 bg-surface z-10 
                             group-focus-within:border-emerald-500 group-focus-within:scale-125 transition-all" />
                        </div>
                        <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-2xl group-focus-within:bg-white group-focus-within:border-emerald-500 group-focus-within:ring-4 group-focus-within:ring-emerald-500/10 transition-all shadow-sm min-w-0 pr-1">
                          <input 
                            type="text" 
                            className="flex-none w-14 bg-transparent text-center font-bold text-text-main outline-none placeholder:text-text-muted/60 text-[15px] border-r border-slate-200 py-3.5 focus:bg-emerald-500/5 rounded-l-2xl transition-colors shrink-0 min-w-0" 
                            placeholder="Flat" 
                            value={houseNumber} 
                            onChange={(e) => setHouseNumber(e.target.value)} 
                          />
                          <input 
                            type="text" 
                            className="flex-1 w-full bg-transparent px-4 font-bold text-text-main outline-none placeholder:text-text-muted/60 text-[15px] py-3.5 focus:bg-emerald-500/5 transition-colors min-w-0" 
                            placeholder="Current Location" 
                            value={pickup} 
                            onFocus={() => setActiveField("pickup")} 
                            onChange={(e) => setPickup(e.target.value)} 
                          />
                          <button onClick={handleDetectLocation} className="p-2 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-full tooltip-trigger shrink-0 transition-colors">
                            <Target className={`w-5 h-5 ${isDetecting ? 'animate-spin' : ''}`} />
                          </button>
                        </div>
                      </div>
                      
                      <AnimatePresence>
                        {activeField === "pickup" && (suggestions.length > 0 || isLoadingAddress) && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="ml-6 overflow-hidden pr-1">
                            {suggestions.map((s, idx) => (
                              <button key={idx} onClick={() => selectSuggestion(s)} className="w-full py-3 px-3 text-left hover:bg-slate-50 border-x border-b border-slate-200 last:rounded-b-2xl flex items-center gap-3 transition-colors bg-white shadow-sm mt-1">
                                <MapPin className="w-4 h-4 text-emerald-500 shrink-0 opacity-70" />
                                <span className="font-semibold text-text-main text-sm truncate">{s.label}</span>
                              </button>
                            ))}
                            {suggestions.length === 0 && isLoadingAddress && (
                              <div className="py-4 flex items-center justify-center text-text-muted text-sm border-x border-b border-slate-200 rounded-b-2xl bg-white shadow-sm mt-1">
                                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Searching...
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Stops */}
                      {stops.map((stop, i) => (
                        <React.Fragment key={i}>
                          <div className="relative flex items-center group w-full">
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
                              }} 
                            />
                            <button onClick={() => setStops(stops.filter((_, idx) => idx !== i))} className="p-2 text-text-muted hover:text-danger rounded-full shrink-0"><X className="w-4 h-4" /></button>
                          </div>
                        </div>
                        
                        <AnimatePresence>
                          {activeField === `stop-${i}` && (suggestions.length > 0 || isLoadingAddress) && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="ml-6 overflow-hidden pr-1">
                              {suggestions.map((s, idx) => (
                                <button key={idx} onClick={() => selectSuggestion(s)} className="w-full py-3 px-3 text-left hover:bg-slate-50 border-x border-b border-slate-200 last:rounded-b-2xl flex items-center gap-3 transition-colors bg-white shadow-sm mt-1">
                                  <MapPin className="w-4 h-4 text-amber-500 shrink-0 opacity-70" />
                                  <span className="font-semibold text-text-main text-sm truncate">{s.label}</span>
                                </button>
                              ))}
                              {suggestions.length === 0 && isLoadingAddress && (
                                <div className="py-4 flex items-center justify-center text-text-muted text-sm border-x border-b border-slate-200 rounded-b-2xl bg-white shadow-sm mt-1">
                                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Searching...
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </React.Fragment>
                    ))}

                    {/* Dropoff */}
                      <div className="relative flex items-center group w-full">
                        <div className="w-6 flex justify-center shrink-0">
                           <div className="w-2.5 h-2.5 bg-red-500 rounded-sm z-10 group-focus-within:bg-red-500 group-focus-within:scale-125 transition-all" />
                        </div>
                        <div className="flex-1 flex bg-slate-50 border border-slate-200 rounded-2xl group-focus-within:bg-white group-focus-within:border-red-500 group-focus-within:ring-4 group-focus-within:ring-red-500/10 transition-all pr-1 shadow-sm min-w-0">
                          <input 
                            type="text" 
                            className="flex-1 w-full bg-transparent px-4 font-bold text-text-main outline-none placeholder:text-text-muted/60 text-[15px] py-3.5 focus:bg-red-500/5 rounded-l-2xl transition-colors min-w-0" 
                            placeholder="Where to?" 
                            value={dropoff} 
                            onFocus={() => setActiveField("dropoff")} 
                            onChange={(e) => setDropoff(e.target.value)} 
                          />
                          {stops.length < 3 && (
                            <button onClick={() => setStops([...stops, { address: "", coords: null }])} className="p-2 text-text-main hover:bg-black/5 rounded-full tooltip-trigger shrink-0">
                              <Plus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <AnimatePresence>
                        {activeField === "dropoff" && (suggestions.length > 0 || isLoadingAddress) && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="ml-6 overflow-hidden pr-1">
                            {suggestions.map((s, idx) => (
                              <button key={idx} onClick={() => selectSuggestion(s)} className="w-full py-3 px-3 text-left hover:bg-slate-50 border-x border-b border-slate-200 last:rounded-b-2xl flex items-center gap-3 transition-colors bg-white shadow-sm mt-1">
                                <MapPin className="w-4 h-4 text-red-500 shrink-0 opacity-70" />
                                <span className="font-semibold text-text-main text-sm truncate">{s.label}</span>
                              </button>
                            ))}
                            {suggestions.length === 0 && isLoadingAddress && (
                              <div className="py-4 flex items-center justify-center text-text-muted text-sm border-x border-b border-slate-200 rounded-b-2xl bg-white shadow-sm mt-1">
                                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Searching...
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                      
                      <div className="flex gap-2 py-2 ml-6 overflow-x-auto no-scrollbar pr-1">
                        <button 
                          onClick={() => { 
                            const home = favoriteAddresses.find(f => f.name.toLowerCase() === 'home');
                            if (!home) {
                              toast.info("Please save an address as 'Home' to use this quick link.");
                            } else {
                              setDropoff(home.address); 
                              if (pickup) setDetailsView("vehicle"); 
                            }
                          }} 
                          className="flex-none px-4 py-2 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-2 text-[12px] font-bold text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors shadow-sm"
                        >
                          <Home className="w-4 h-4 text-blue-500" /> Home
                        </button>
                        <button 
                          onClick={() => { 
                            const work = favoriteAddresses.find(f => f.name.toLowerCase() === 'work');
                            if (!work) {
                              toast.info("Please save an address as 'Work' to use this quick link.");
                            } else {
                              setDropoff(work.address); 
                              if (pickup) setDetailsView("vehicle"); 
                            }
                          }} 
                          className="flex-none px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center gap-2 text-[12px] font-bold text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition-colors shadow-sm"
                        >
                          <Briefcase className="w-4 h-4 text-indigo-500" /> Work
                        </button>
                        <button 
                          onClick={() => setShowRegularJourneys(!showRegularJourneys)} 
                          className={cn("flex-none px-4 py-2 border rounded-2xl flex items-center gap-2 text-[12px] font-bold transition-colors shadow-sm", showRegularJourneys ? "bg-emerald-100 border-emerald-300 text-emerald-800" : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300")}
                        >
                          <History className="w-4 h-4 text-emerald-500" /> Regular Journeys
                        </button>
                        <button 
                          onClick={() => setShowFavorites(!showFavorites)} 
                          className={cn("flex-none px-4 py-2 border rounded-2xl flex items-center gap-2 text-[12px] font-bold transition-colors shadow-sm", showFavorites ? "bg-rose-100 border-rose-300 text-rose-800" : "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 hover:border-rose-300")}
                        >
                          <Heart className="w-4 h-4 text-rose-500" /> Favorites
                        </button>
                      </div>

                      <AnimatePresence>
                        {showFavorites && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }} 
                            animate={{ opacity: 1, height: "auto" }} 
                            exit={{ opacity: 0, height: 0 }} 
                            className="ml-6 overflow-hidden pr-1"
                          >
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 mb-2 shadow-sm space-y-2">
                              {favoriteAddresses && favoriteAddresses.length > 0 ? (
                                favoriteAddresses.map((fav: any, idx: number) => (
                                  <button
                                    key={`fav-${idx}`}
                                    onClick={() => {
                                      const coords = fav.lat && fav.lng ? { lat: fav.lat, lng: fav.lng } : null;
                                      if (activeField === "pickup") {
                                        setPickup(fav.address);
                                        if (coords) { setPickupCoords(coords); setMapCenter(coords); }
                                      } else if (activeField === "dropoff") {
                                        setDropoff(fav.address);
                                        if (coords) { setDropoffCoords(coords); setMapCenter(coords); }
                                      } else if (activeField?.startsWith("stop-")) {
                                        const stopIdx = parseInt(activeField.split('-')[1]);
                                        const newStops = [...stops];
                                        newStops[stopIdx].address = fav.address;
                                        if (coords) newStops[stopIdx].coords = coords;
                                        setStops(newStops);
                                        if (coords) setMapCenter(coords);
                                      } else {
                                        setDropoff(fav.address);
                                        if (coords) { setDropoffCoords(coords); setMapCenter(coords); }
                                      }
                                      setShowFavorites(false);
                                      if (pickup) setDetailsView("vehicle");
                                    }}
                                    className="w-full text-left bg-white border border-slate-100 rounded-xl p-3 shadow-sm hover:border-rose-300 transition-colors flex items-center gap-3"
                                  >
                                    <div className="w-8 h-8 rounded-full bg-rose-50 flex flex-shrink-0 items-center justify-center">
                                      <Heart className="w-4 h-4 text-rose-500" />
                                    </div>
                                    <span className="font-bold text-sm text-slate-800 truncate">{fav.address}</span>
                                  </button>
                                ))
                              ) : (
                                <div className="text-center py-4">
                                  <p className="text-xs text-slate-500 font-medium mb-1">No favorite addresses saved.</p>
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
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 mb-2 shadow-sm space-y-2">
                              {profile?.regularJourneys && profile.regularJourneys.length > 0 ? (
                                profile.regularJourneys.map((j: any, idx: number) => (
                                  <div key={idx} className="flex flex-col gap-2 p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                                    <div className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1 mb-1">{j.name || "Saved Route"}</div>
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
                                          setPickup(j.from);
                                          setDropoff(j.to);
                                          setDetailsView("vehicle");
                                        }}
                                        className="flex-1 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors"
                                      >
                                        Book Outward
                                      </button>
                                      <button 
                                        onClick={() => {
                                          setPickup(j.to);
                                          setDropoff(j.from);
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
                                  <p className="text-xs text-slate-500 font-medium mb-3">No regular journeys saved yet.</p>
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
                  <div className="flex items-start justify-between bg-surface-hover rounded-2xl p-4 border border-border-main shadow-sm mb-4 shrink-0">
                    <div className="flex flex-1 items-start gap-2 overflow-hidden">
                      <button onClick={() => setDetailsView("address")} className="p-2 -mt-1 -ml-2 rounded-xl text-text-muted hover:bg-black/5 transition-colors shrink-0 tooltip-trigger"><ChevronLeft className="w-5 h-5" /></button>
                      <div className="space-y-1.5 flex-1 overflow-hidden pt-0.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full border-2 border-text-main bg-surface shrink-0" />
                          <span className="text-sm font-bold text-text-main truncate max-w-full">{pickup || "Current Location"}</span>
                        </div>
                        {stops.map((stop, i) => stop.address ? (
                          <div key={i} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full border-2 border-amber-500 bg-surface shrink-0" />
                            <span className="text-sm font-bold text-text-main truncate max-w-full">{stop.address}</span>
                          </div>
                        ) : null)}
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 -ml-1 rounded-sm border-2 border-transparent bg-red-500 shrink-0 mx-[2px] w-[6px] h-[6px]" />
                          <span className="text-sm font-bold text-text-main truncate max-w-full">{dropoff}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {distanceMiles > 0 && (
                      <motion.div 
                        ref={vehicleSelectionRef}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-4 pt-2 overflow-hidden"
                      >
                        {/* Distance & ETA */}
                        <div className="flex items-center gap-2 px-1 mb-2">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span className="text-sm font-bold text-text-main">{distanceMiles.toFixed(1)} miles</span>
                        <span className="text-text-muted text-lg leading-none mb-1">•</span>
                        <span className="text-sm font-bold text-text-main">~{durationMinutes.toFixed(0)} min</span>
                      </div>
                    <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x px-1">
                      {CAR_CATEGORIES.map((cat) => {
                        const active = selectedCategory === cat.id;
                        return (
                          <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={cn("flex-none w-[100px] snap-center p-3 rounded-2xl border-2 transition-all shadow-sm", active ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105" : "bg-surface border-slate-300 text-text-main hover:border-primary/50")}>
                            <cat.icon className={cn("w-5 h-5 mb-2", active ? "text-white" : "text-primary")} />
                            <p className="text-[10px] font-black uppercase tracking-tight line-clamp-1">{cat.name}</p>
                            <p className="text-lg font-black tracking-tighter">£{getComputedFare(cat.id).toFixed(2)}</p>
                          </button>
                        );
                      })}
                    </div>
                    
                    {/* Add-Ons */}
                    <div className="pt-2">
                      <div className="flex items-center gap-3">
                         <button 
                           onClick={() => setIsPriority(!isPriority)}
                           className={cn("flex-1 p-2.5 rounded-xl border-2 flex items-center justify-between transition-colors", isPriority ? "bg-warning/10 border-warning text-warning" : "bg-surface border-slate-200 hover:border-warning/50 text-slate-700")}
                         >
                           <div className="flex items-center gap-2">
                             <Zap className={cn("w-4 h-4", isPriority ? "text-warning" : "text-slate-500")} />
                             <span className="text-xs font-bold leading-tight">Priority</span>
                           </div>
                           <div className={`w-8 h-4 rounded-full transition-colors relative shrink-0 ${isPriority ? 'bg-warning' : 'bg-slate-300'}`}>
                             <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isPriority ? 'right-0.5' : 'left-0.5'}`} />
                           </div>
                         </button>

                         <button 
                           onClick={() => setIsPetFriendly(!isPetFriendly)}
                           className={cn("flex-1 p-2.5 rounded-xl border-2 flex items-center justify-between transition-colors", isPetFriendly ? "bg-primary/10 border-primary text-primary" : "bg-surface border-slate-200 hover:border-primary/50 text-slate-700")}
                         >
                           <div className="flex items-center gap-2">
                             <Dog className={cn("w-4 h-4", isPetFriendly ? "text-primary" : "text-slate-500")} />
                             <span className="text-xs font-bold leading-tight">Pet</span>
                           </div>
                           <div className={`w-8 h-4 rounded-full transition-colors relative shrink-0 ${isPetFriendly ? 'bg-primary' : 'bg-slate-300'}`}>
                             <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isPetFriendly ? 'right-0.5' : 'left-0.5'}`} />
                           </div>
                         </button>
                      </div>

                      <AnimatePresence>
                        {(isPriority || isPetFriendly) && (
                          <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:"auto"}} exit={{opacity:0, height:0}} className="overflow-hidden">
                            <div className="text-[10px] font-bold text-slate-500 bg-slate-100 p-2.5 rounded-xl mt-3 text-center border border-slate-200">
                              <span className="text-warning">Notice:</span> Each active option adds <span className="text-slate-800">£3.00</span> to the base fare.
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    
                    {/* Fare Summary */}
                    <div className="bg-surface rounded-2xl p-4 text-left border border-border-main">
                      <p className="text-[10px] font-black uppercase text-text-muted tracking-widest mb-3 border-b border-border-main pb-2">Fare Breakdown</p>
                      <div className="space-y-1.5 mb-3">
                        <div className="flex justify-between text-xs text-text-muted"><span>Base fare:</span><span className="text-text-main">£{(fareEstimate || 5.0).toFixed(2)}</span></div>
                        <div className="flex justify-between text-xs text-text-muted"><span>Vehicle ({CAR_CATEGORIES.find(c => c.id === selectedCategory)?.name}):</span><span className="text-text-main">£{getComputedFare(selectedCategory).toFixed(2)}</span></div>
                        {isPriority && <div className="flex justify-between text-xs text-warning"><span>Priority:</span><span className="font-bold">+£3.00</span></div>}
                        {isPetFriendly && <div className="flex justify-between text-xs text-primary"><span>Pet:</span><span className="font-bold">+£3.00</span></div>}
                      </div>
                      <div className="border-t border-border-main pt-2 flex justify-between text-sm font-bold text-text-main">
                        <span>Total estimate:</span>
                        <span>£{(getComputedFare(selectedCategory) + (isPriority ? 3 : 0) + (isPetFriendly ? 3 : 0)).toFixed(2)}</span>
                      </div>
                      <p className="text-[9px] text-text-muted italic mt-2 text-center">Final fare may vary based on route</p>
                    </div>

                    <div className="pt-2 space-y-4">
                       <label className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-2xl cursor-pointer">
                         <input 
                           type="checkbox" 
                           checked={hasPaymentMeans}
                           onChange={(e) => setHasPaymentMeans(e.target.checked)}
                           className="w-5 h-5 rounded text-primary focus:ring-primary border-primary/30"
                         />
                         <div className="flex-1">
                           <p className="text-xs font-bold text-text-main">I confirm I have means to pay (QR Code / Cash)</p>
                         </div>
                       </label>

                       <button 
                         onClick={handleConfirmBooking} 
                         disabled={!pickup || !dropoff || !hasPaymentMeans} 
                         className="w-full py-5 bg-header text-surface rounded-3xl font-black text-xl shadow-xl hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all"
                       >
                         Confirm {CAR_CATEGORIES.find(c => c.id === selectedCategory)?.name}
                       </button>
                    </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  </>
                  )}
                </div>
              </motion.div>
            )}

            {step === "searching" && (
              <motion.div key="searching" initial={{ y: "100%" }} animate={{ y: 0 }} className="bg-card rounded-t-[40px] p-8 pb-[calc(4rem+env(safe-area-inset-bottom)+2rem)] flex flex-col items-center border-t border-border-main pointer-events-auto">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center relative mb-4">
                  <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                  <Car className="w-10 h-10 text-primary animate-pulse" />
                </div>
                <h2 className="text-2xl font-black text-text-main tracking-tight mb-2">Requesting...</h2>
                <p className="text-text-muted font-bold text-sm text-center mb-6">Pinging the fleet to find your professional driver.</p>
                
                <SearchingTimer />
                
                <div onClick={handleTogglePriority} className="w-full max-w-xs mt-4 mb-2 bg-gradient-to-r from-amber-200 to-amber-300 rounded-2xl p-4 shadow-sm border border-amber-400 relative overflow-hidden group cursor-pointer active:scale-95 transition-all">
                  <div className="absolute -right-4 -top-4 w-16 h-16 bg-amber-400/50 rounded-full blur-xl group-hover:scale-150 transition-transform"></div>
                  <div className="flex items-center gap-3 relative z-10 w-full">
                    <div className="p-2 bg-white/50 rounded-full shrink-0">
                      <Zap className="w-5 h-5 text-amber-700" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-amber-950 font-black text-sm">Boost Priority (+£3)</h4>
                      <p className="text-amber-800 text-[11px] font-semibold leading-tight mt-0.5">Jump to the top of the queue.</p>
                    </div>
                    <div className={cn("w-10 h-6 rounded-full p-1 transition-colors relative flex items-center shrink-0", isPriority ? "bg-amber-600" : "bg-black/20")}>
                      <div className={cn("w-4 h-4 bg-white rounded-full shadow-sm transition-transform", isPriority ? "translate-x-4" : "translate-x-0")} />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 w-full max-w-xs mt-2">
                  <button onClick={handleCancelSearching} className="flex-1 text-text-main font-black text-sm py-4 rounded-2xl border-2 border-border-main hover:bg-surface transition-colors active:scale-95">Edit</button>
                  <SearchingCancelButton onCancel={handleAbandonSearch} startTime={searchingStartTimeRef.current || Date.now()} />
                </div>
              </motion.div>
            )}

            {step === "confirmed" && (
              <motion.div key="confirmed" initial={{ y: "100%" }} animate={{ y: 0 }} className="bg-card rounded-t-[40px] p-6 pb-[calc(4rem+env(safe-area-inset-bottom)+1.5rem)] border-t border-border-main pointer-events-auto">
                {assignedDriverInfo?.status === "arrived" ? (
                  <div className="flex items-center gap-4 mb-6">
                     <div className="w-16 h-16 bg-warning/10 rounded-2xl flex items-center justify-center"><Clock className="w-8 h-8 text-warning animate-pulse" /></div>
                     <div>
                       <h2 className="text-2xl font-black text-text-main tracking-tight">Driver is Outside</h2>
                       <p className="text-text-muted font-bold text-sm">Please meet your driver now.</p>
                     </div>
                  </div>
                ) : (
                  <div className="flex flex-col mb-6">
                     <h2 className="text-2xl font-black text-text-main tracking-tight mb-4">
                       {assignedDriverInfo?.status === "en_route_pickup" ? "Driver is on the way" : 
                        assignedDriverInfo?.status === "in_progress" ? "Heading to destination" : 
                        "Driver found!"}
                     </h2>
                     <div className="flex flex-col md:flex-row md:items-center justify-between bg-surface border border-border-main p-4 rounded-3xl shadow-sm gap-4">
                       <div className="flex items-center gap-4">
                         <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${assignedDriverInfo?.name || "driver"}`} alt="Driver" className="w-14 h-14 rounded-full border border-border-main shadow-sm bg-card object-cover" />
                         <div>
                           <div className="flex items-center gap-2">
                             <p className="font-black text-lg text-text-main">{assignedDriverInfo?.name || "Assigning..."}</p>
                             <div className="flex items-center gap-1 bg-card px-1.5 py-0.5 rounded-md border border-border-main">
                               <Star className="w-3 h-3 text-warning fill-warning" />
                               <span className="text-xs font-bold text-text-main">{assignedDriverInfo?.rating || "4.8"}</span>
                             </div>
                           </div>
                           <p className="text-xs font-bold text-text-muted mt-0.5">{assignedDriverInfo?.vehicle || "Silver Toyota Prius"}</p>
                         </div>
                       </div>
                       
                       <div className="bg-[#FFCC00] rounded-lg border-2 border-black px-3 py-1 flex items-center justify-center shadow-sm w-fit">
                          <p className="font-mono font-black text-black text-sm uppercase tracking-widest">{assignedDriverInfo?.plate || "WK71 BCF"}</p>
                       </div>
                     </div>
                  </div>
                )}
                
                {assignedDriverInfo?.status === "arrived" && assignedDriverInfo?.arrivedAt && (
                   <div className="bg-warning/10 border border-warning/20 p-4 rounded-2xl mb-6">
                     <div className="flex justify-between items-center">
                       <p className="text-sm font-black text-warning">Waiting Time</p>
                       <PassengerTimer arrivedAt={assignedDriverInfo.arrivedAt} />
                     </div>
                   </div>
                )}

                <div className="grid grid-cols-2 gap-3 mb-6">
                   <div className="bg-surface p-4 rounded-2xl border border-border-main">
                      <p className="text-[10px] font-black text-text-muted uppercase mb-1">Pass Code</p>
                      <p className="text-2xl font-black text-primary tracking-widest">{assignedDriverInfo?.code || "1234"}</p>
                   </div>
                   <div className="bg-surface p-4 rounded-2xl border border-border-main">
                      <p className="text-[10px] font-black text-text-muted uppercase mb-1">Total Estimate</p>
                      <p className="text-2xl font-black text-text-main">£{(assignedDriverInfo?.fareEstimate || fareEstimate || 0).toFixed(2)}</p>
                   </div>
                </div>
                
                <div className="flex gap-3 mb-4">
                  <button onClick={() => setIsChatOpen(true)} className="flex-1 py-4 shrink-0 bg-surface border-2 border-border-main rounded-2xl flex items-center justify-center active:scale-95 transition-transform"><MessageSquare className="w-6 h-6 text-text-main" /></button>
                  <a href={`tel:${assignedDriverInfo?.phone || ""}`} className="flex-1 py-4 shrink-0 bg-surface border-2 border-border-main rounded-2xl flex items-center justify-center active:scale-95 transition-transform"><Phone className="w-6 h-6 text-text-main" /></a>
                  <button onClick={() => navigate("/my-rides")} className="flex-[2] py-4 bg-header text-surface rounded-2xl font-black text-lg shadow-xl shrink-0">Track Live Map</button>
                </div>
                
                <div className="text-center">
                  <CancelRideButton_ConfirmedPhase acceptedAt={assignedDriverInfo?.acceptedAt || Date.now()} onCancel={handleCancelConfirmed} />
                </div>
                
                <AnimatePresence>
                  {showCancelPrompt && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-card w-full max-w-sm rounded-[32px] p-6 shadow-2xl border border-border-main text-center">
                        <div className="w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-4">
                          <AlertCircle className="w-8 h-8 text-danger" />
                        </div>
                        <h3 className="text-xl font-black text-text-main mb-2">Cancel Ride?</h3>
                        <p className="text-sm font-bold text-text-muted mb-6">
                          {step === "searching" ? "You have been searching for over 2 minutes. " : "Your driver has been on the way for over 2 minutes. "}
                          A cancellation fee of <span className="text-text-main font-black">£{cancelFeeToApply.toFixed(2)}</span> will apply.
                        </p>
                        <div className="flex gap-3">
                          <button onClick={() => setShowCancelPrompt(false)} className="flex-1 py-4 bg-surface rounded-2xl font-black text-text-main hover:bg-surface-hover transition-colors">Go Back</button>
                          <button onClick={handleCancelConfirmed} className="flex-1 py-4 bg-danger text-white rounded-2xl font-black hover:bg-danger/90 transition-colors">Yes, Cancel</button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
       </div>
    </div>
  );
}

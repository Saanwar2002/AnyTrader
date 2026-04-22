import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  MapPin, Navigation, Car, Clock, X, Check, Target, 
  MessageSquare, ChevronRight, Zap, History, Loader2, 
  Mic, MicOff, Star, Users, Repeat, Shield, Plus, 
  Home, Briefcase, Dog, Accessibility 
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { db, addDoc, collection, serverTimestamp, doc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from "@/src/firebase";
import { useAuth } from "../AuthProvider";
import { usePortal } from "../../lib/PortalContext";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { GoogleGenAI, Type } from "@google/genai";
import { triggerHaptic, ImpactStyle, hideNativeKeyboard } from "@/src/lib/capacitor";

// Google Maps Imports
import { GoogleMap, useJsApiLoader, MarkerF, PolylineF, InfoWindowF } from "@react-google-maps/api";

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

export default function PassengerBooking() {
  const { user, profile } = useAuth();
  const { theme } = usePortal();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<BookingStep>("details");
  const [pickup, setPickup] = useState(searchParams.get("pickup") || "");
  const [dropoff, setDropoff] = useState(searchParams.get("dropoff") || "");
  const [comments, setComments] = useState(searchParams.get("comments") || "");
  const [waitTolerance, setWaitTolerance] = useState<10 | 20 | 30>(20);
  const [selectedCategory, setSelectedCategory] = useState("standard");
  const [isPetFriendly, setIsPetFriendly] = useState(false);
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
  const [assignedDriverInfo, setAssignedDriverInfo] = useState<any>(null);
  const [fareConfig, setFareConfig] = useState({ baseFare: 2.5, distanceRate: 1.2, minFare: 5.0 });

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
            result.routes[0].legs.forEach(leg => {
              if (leg.distance) totalDistanceMeters += leg.distance.value;
            });
            const distanceMiles = totalDistanceMeters / 1609.34;
            setFareEstimate(fareConfig.baseFare + (distanceMiles * fareConfig.distanceRate));
          } else {
            console.error("Directions failed:", status);
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
          baseFare: Number(data.baseFare) || 2.5,
          distanceRate: Number(data.distanceRate) || 1.2,
          minFare: Number(data.minFare) || 5.0,
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
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: `Extract taxi booking details from: "${text}". Return JSON with keys: pickup, dropoff, comments.` }] }],
        config: { responseMimeType: "application/json" }
      });
      const result = JSON.parse(response.text || "{}");
      if (result.pickup) setPickup(result.pickup);
      if (result.dropoff) setDropoff(result.dropoff);
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
  }, [pickup, dropoff, activeField, mapCenter, isLoaded]);

  const handleDetectLocation = () => {
    triggerHaptic(ImpactStyle.Light);
    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
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
    }, () => setIsDetecting(false));
  };

  const [driverPos, setDriverPos] = useState<{lat: number, lng: number} | null>(null);

  const getComputedFare = (catId: string) => {
    const category = CAR_CATEGORIES.find(c => c.id === catId);
    const multiplier = category?.multiplier || 1.0;
    const base = fareEstimate || 5.0;
    return Math.max(base * multiplier, fareConfig.minFare * multiplier);
  };

  const [currentRideId, setCurrentRideId] = useState<string | null>(null);

  const handleConfirmBooking = async () => {
    triggerHaptic(ImpactStyle.Heavy);
    hideNativeKeyboard();
    if (!user) return;
    setStep("searching");
    try {
      const rideData = {
        riderId: user.uid,
        passengerName: profile?.firstName || "Passenger",
        pickup,
        pickupLat: pickupCoords?.lat || mapCenter.lat,
        pickupLng: pickupCoords?.lng || mapCenter.lng,
        dropoff,
        dropoffLat: dropoffCoords?.lat,
        dropoffLng: dropoffCoords?.lng,
        stops: stops.filter(s => s.coords !== null),
        carCategory: selectedCategory,
        isPetFriendly,
        waitTolerance,
        comments,
        status: "pending",
        fareEstimate: getComputedFare(selectedCategory),
        currency: "GBP",
        handshakeCode: Math.floor(1000 + Math.random() * 9000).toString(),
      };
      if (editId) {
         await updateDoc(doc(db, "ride_requests", editId), { ...rideData, updatedAt: serverTimestamp() });
         setCurrentRideId(editId);
      } else {
         const docRef = await addDoc(collection(db, "ride_requests"), { ...rideData, createdAt: serverTimestamp() });
         setCurrentRideId(docRef.id);
      }
    } catch (err) { setStep("details"); }
  };

  useEffect(() => {
    if (!currentRideId) return;
    const unsubRide = onSnapshot(doc(db, "ride_requests", currentRideId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.status === 'accepted' && data.driverId) {
          setAssignedDriverInfo({ uid: data.driverId, name: data.driverName || "Driver", vehicle: data.vehicleInfo || "Taxi", code: data.handshakeCode || "---" });
          setStep("confirmed"); triggerHaptic(ImpactStyle.Heavy);
        }
        if (data.status === 'completed') { setStep("details"); setCurrentRideId(null); setAssignedDriverInfo(null); }
      }
    });
    const unsubTrack = onSnapshot(doc(db, "live_tracking", currentRideId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.lat && data.lng) setDriverPos({ lat: data.lat, lng: data.lng });
      }
    });
    return () => { unsubRide(); unsubTrack(); };
  }, [currentRideId]);

  const selectSuggestion = async (s: {label: string, lat?: number, lon?: number, placeId?: string, placePrediction?: any}) => {
    triggerHaptic(ImpactStyle.Light);
    
    const finalizeSelection = (coords: {lat: number, lng: number} | null, finalAddr: string) => {
      if (activeField === "pickup") { 
        setPickup(finalAddr); 
        if (coords) { setMapCenter(coords); setPickupCoords(coords); } 
      }
      else if (activeField === "dropoff") { 
        setDropoff(finalAddr); 
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
    <div className="relative flex-1 w-full overflow-hidden bg-surface flex flex-col">
       <div className="absolute inset-0 z-0">
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={mapCenter}
            zoom={15}
            onLoad={setMap}
            options={theme === "dark" ? darkMapOptions : mapOptions}
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
                <InfoWindowF position={pickupCoords} options={{ pixelOffset: new window.google.maps.Size(0, -40), disableAutoPan: true }}>
                  <div className="bg-card p-2 rounded-lg shadow-xl border border-border-main min-w-[120px]">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Pickup</p>
                    <p className="text-[11px] font-bold text-text-main leading-tight line-clamp-2">{pickup}</p>
                  </div>
                </InfoWindowF>
              </>
            )}
            {dropoffCoords && (
              <>
                <MarkerF position={dropoffCoords} label="D" />
                <InfoWindowF position={dropoffCoords} options={{ pixelOffset: new window.google.maps.Size(0, -40), disableAutoPan: true }}>
                  <div className="bg-card p-2 rounded-lg shadow-xl border border-border-main min-w-[120px]">
                    <p className="text-[10px] font-black text-header uppercase tracking-widest mb-1">Dropoff</p>
                    <p className="text-[11px] font-bold text-text-main leading-tight line-clamp-2">{dropoff}</p>
                  </div>
                </InfoWindowF>
              </>
            )}
            {stops.map((s, i) => s.coords && (
              <React.Fragment key={i}>
                <MarkerF position={s.coords} label={`${i+1}`} />
                <InfoWindowF position={s.coords} options={{ pixelOffset: new window.google.maps.Size(0, -40), disableAutoPan: true }}>
                  <div className="bg-card p-2 rounded-lg shadow-xl border border-border-main min-w-[120px]">
                    <p className="text-[10px] font-black text-warning uppercase tracking-widest mb-1">Stop {i+1}</p>
                    <p className="text-[11px] font-bold text-text-main leading-tight line-clamp-2">{s.address}</p>
                  </div>
                </InfoWindowF>
              </React.Fragment>
            ))}
            {driverPos && <MarkerF position={driverPos} label="🚕" />}
            {routeLine.length > 0 && <PolylineF path={routeLine} options={{ strokeColor: '#2563eb', strokeOpacity: 0.8, strokeWeight: 5 }} />}
          </GoogleMap>
       </div>

       <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none flex flex-col justify-end">
          <AnimatePresence mode="wait">
            {step === "details" && (
              <motion.div
                key="details"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                className="bg-card rounded-t-[40px] shadow-2xl pointer-events-auto flex flex-col max-h-[55vh] w-full border-t border-border-main"
              >
                <div className="w-12 h-1.5 bg-border-main rounded-full mx-auto mt-3 mb-1" />
                <div className="p-5 pt-2 overflow-y-auto space-y-4 no-scrollbar">
                  <div className="relative">
                    <div className="absolute left-4 top-10 bottom-6 w-0.5 border-l-2 border-dashed border-border-main" />
                    <div className="space-y-3 relative">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between ml-4 pr-1">
                          <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Pickup</label>
                          <div className="flex items-center gap-2">
                             <button onClick={startListening} className={cn("p-2 rounded-xl transition-all", isListening ? "bg-danger/20 text-danger animate-pulse" : "bg-warning/10 text-warning hover:bg-warning/20")}><Mic className="w-4 h-4" /></button>
                             <button onClick={handleDetectLocation} className="p-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl transition-all"><Target className="w-4 h-4" /></button>
                          </div>
                        </div>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-primary bg-surface z-10" />
                          <input type="text" className="w-full pl-12 pr-4 py-3 bg-surface border-2 border-transparent focus:border-primary rounded-2xl font-bold text-text-main outline-none transition-all placeholder:text-text-muted" placeholder="Where from?" value={pickup} onFocus={() => setActiveField("pickup")} onChange={(e) => setPickup(e.target.value)} />
                          
                          <AnimatePresence>
                            {activeField === "pickup" && (suggestions.length > 0 || isLoadingAddress) && (
                              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full mt-2 left-0 right-0 z-[100] w-full bg-surface border border-border-main shadow-2xl rounded-2xl overflow-hidden">
                                {suggestions.map((s, idx) => (
                                  <button key={idx} onClick={() => selectSuggestion(s)} className="w-full p-4 text-left hover:bg-card border-b border-border-main last:border-0 flex items-center gap-3">
                                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                                    <span className="font-bold text-text-main text-sm truncate">{s.label}</span>
                                  </button>
                                ))}
                                {suggestions.length === 0 && isLoadingAddress && (
                                  <div className="p-4 flex items-center justify-center text-text-muted bg-card">
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Searching...
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      {stops.map((stop, i) => (
                        <div key={i} className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 bg-warning rounded-full z-10 border-2 border-surface" />
                          <input type="text" className="w-full pl-12 pr-12 py-3 bg-surface border-2 border-transparent focus:border-warning rounded-2xl font-bold text-text-main outline-none placeholder:text-text-muted" placeholder={`Stop ${i+1}`} value={stop.address} onFocus={() => setActiveField(`stop-${i}`)} onChange={(e) => {
                             const ns = [...stops]; ns[i].address = e.target.value; setStops(ns);
                          }} />
                          <button onClick={() => setStops(stops.filter((_, idx) => idx !== i))} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-danger"><X className="w-4 h-4" /></button>

                          <AnimatePresence>
                            {activeField === `stop-${i}` && (suggestions.length > 0 || isLoadingAddress) && (
                              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full mt-2 left-0 right-0 z-[100] w-full bg-surface border border-border-main shadow-2xl rounded-2xl overflow-hidden">
                                {suggestions.map((s, idx) => (
                                  <button key={idx} onClick={() => selectSuggestion(s)} className="w-full p-4 text-left hover:bg-card border-b border-border-main last:border-0 flex items-center gap-3">
                                    <MapPin className="w-4 h-4 text-warning shrink-0" />
                                    <span className="font-bold text-text-main text-sm truncate">{s.label}</span>
                                  </button>
                                ))}
                                {suggestions.length === 0 && isLoadingAddress && (
                                  <div className="p-4 flex items-center justify-center text-text-muted bg-card">
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Searching...
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}

                      {stops.length < 3 && (
                        <button className="ml-8 flex items-center gap-1.5 px-3 py-1 bg-trust/10 text-trust rounded-full border-2 border-card text-[9px] font-black uppercase" onClick={() => setStops([...stops, { address: "", coords: null }])}>
                          <Plus className="w-3.5 h-3.5" /> Add Stop
                        </button>
                      )}

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-4">Dropoff</label>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 bg-header rounded-sm z-10" />
                          <input type="text" className="w-full pl-12 pr-4 py-3 bg-surface border-2 border-transparent focus:border-header rounded-2xl font-bold text-text-main outline-none placeholder:text-text-muted" placeholder="Where to?" value={dropoff} onFocus={() => setActiveField("dropoff")} onChange={(e) => setDropoff(e.target.value)} />
                          
                          <AnimatePresence>
                            {activeField === "dropoff" && (suggestions.length > 0 || isLoadingAddress) && (
                              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute bottom-full mb-2 left-0 right-0 z-[100] w-full bg-surface border border-border-main shadow-2xl rounded-2xl overflow-hidden">
                                {suggestions.map((s, idx) => (
                                  <button key={idx} onClick={() => selectSuggestion(s)} className="w-full p-4 text-left hover:bg-card border-b border-border-main last:border-0 flex items-center gap-3">
                                    <MapPin className="w-4 h-4 text-header shrink-0" />
                                    <span className="font-bold text-text-main text-sm truncate">{s.label}</span>
                                  </button>
                                ))}
                                {suggestions.length === 0 && isLoadingAddress && (
                                  <div className="p-4 flex items-center justify-center text-text-muted bg-card">
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Searching...
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        <button onClick={() => setDropoff(profile?.homeAddress || "")} className="flex-none px-3 py-1.5 bg-surface rounded-full flex items-center gap-1.5 border border-border-main text-[10px] font-black text-text-muted"><Home className="w-3 h-3" /> Home</button>
                        <button onClick={() => setDropoff(profile?.workAddress || "")} className="flex-none px-3 py-1.5 bg-surface rounded-full flex items-center gap-1.5 border border-border-main text-[10px] font-black text-text-muted"><Briefcase className="w-3 h-3" /> Work</button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x px-1">
                      {CAR_CATEGORIES.map((cat) => {
                        const active = selectedCategory === cat.id;
                        return (
                          <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={cn("flex-none w-[100px] snap-center p-3 rounded-2xl border-2 transition-all", active ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105" : "bg-surface border-border-main text-text-main hover:border-primary/50")}>
                            <cat.icon className={cn("w-5 h-5 mb-2", active ? "text-white" : "text-primary")} />
                            <p className="text-[10px] font-black uppercase tracking-tight line-clamp-1">{cat.name}</p>
                            <p className="text-lg font-black tracking-tighter">£{getComputedFare(cat.id).toFixed(2)}</p>
                          </button>
                        );
                      })}
                    </div>
                    
                    <button onClick={handleConfirmBooking} disabled={!pickup || !dropoff} className="w-full py-5 bg-header text-surface rounded-3xl font-black text-xl shadow-xl hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all">
                      Confirm {CAR_CATEGORIES.find(c => c.id === selectedCategory)?.name}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === "searching" && (
              <motion.div key="searching" initial={{ y: "100%" }} animate={{ y: 0 }} className="bg-card rounded-t-[40px] p-8 flex flex-col items-center border-t border-border-main">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center relative mb-6">
                  <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                  <Car className="w-10 h-10 text-primary animate-pulse" />
                </div>
                <h2 className="text-2xl font-black text-text-main tracking-tight mb-2">Requesting...</h2>
                <p className="text-text-muted font-bold text-sm text-center mb-8">Pinging the fleet to find your professional driver.</p>
                <button onClick={() => setStep("details")} className="text-danger font-black text-xs uppercase tracking-widest px-8 py-3 rounded-2xl bg-danger/5">Cancel</button>
              </motion.div>
            )}

            {step === "confirmed" && (
              <motion.div key="confirmed" initial={{ y: "100%" }} animate={{ y: 0 }} className="bg-card rounded-t-[40px] p-6 border-t border-border-main">
                <div className="flex items-center gap-4 mb-6">
                   <div className="w-16 h-16 bg-trust/10 rounded-2xl flex items-center justify-center"><Check className="w-8 h-8 text-trust" /></div>
                   <div>
                     <h2 className="text-2xl font-black text-text-main tracking-tight">Driver Assigned</h2>
                     <p className="text-text-muted font-bold text-sm">{assignedDriverInfo?.name} • {assignedDriverInfo?.vehicle}</p>
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-6">
                   <div className="bg-surface p-4 rounded-2xl border border-border-main">
                      <p className="text-[10px] font-black text-text-muted uppercase mb-1">Pass Code</p>
                      <p className="text-2xl font-black text-primary tracking-widest">{assignedDriverInfo?.code}</p>
                   </div>
                   <div className="bg-surface p-4 rounded-2xl border border-border-main">
                      <p className="text-[10px] font-black text-text-muted uppercase mb-1">Fixed Fare</p>
                      <p className="text-2xl font-black text-text-main">£{fareEstimate?.toFixed(2)}</p>
                   </div>
                </div>
                <button onClick={() => navigate("/my-rides")} className="w-full py-5 bg-text-main text-surface rounded-3xl font-black text-lg shadow-xl">Track Live Location</button>
              </motion.div>
            )}
          </AnimatePresence>
       </div>
    </div>
  );
}

import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MapPin, Navigation, Car, Clock, X, Check, Target, MessageSquare, Info, ChevronRight, Zap, History, Loader2, CreditCard, Mic, MicOff, Star, Users, Repeat, Shield, Menu, Plus, Home, Briefcase, Dog, Accessibility } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { db, addDoc, collection, serverTimestamp, doc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from "@/src/firebase";
import { useAuth } from "../AuthProvider";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { GoogleGenAI, Type } from "@google/genai";
import { triggerHaptic, ImpactStyle, hideNativeKeyboard } from "@/src/lib/capacitor";

// Leaflet Mapping Imports
import { MapContainer, TileLayer, Marker, useMap, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet's default icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function MapController({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      const zoom = 16;
      const targetPoint = map.project(center, zoom);
      // Add 25% of window height to push camera South, moving the marker North (up) on the screen
      const offsetPoint = L.point(targetPoint.x, targetPoint.y + window.innerHeight * 0.25);
      const offsetLatLng = map.unproject(offsetPoint, zoom);
      
      map.flyTo(offsetLatLng, zoom, { animate: true, duration: 1.5 });
    }
  }, [center, map]);
  return null;
}

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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<BookingStep>("details");
  const [pickup, setPickup] = useState(searchParams.get("pickup") || "");
  const [dropoff, setDropoff] = useState(searchParams.get("dropoff") || "");
  const [comments, setComments] = useState(searchParams.get("comments") || "");
  const [waitTolerance, setWaitTolerance] = useState<10 | 20 | 30>(20);
  const [selectedCategory, setSelectedCategory] = useState("standard");
  const [isPetFriendly, setIsPetFriendly] = useState(false);
  
  const [isDetecting, setIsDetecting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [fareEstimate, setFareEstimate] = useState<number | null>(null);
  const [assignedDriverInfo, setAssignedDriverInfo] = useState<any>(null);
  const [fareConfig, setFareConfig] = useState<{baseFare: number, distanceRate: number, minFare: number}>({ baseFare: 2.5, distanceRate: 1.2, minFare: 5.0 });

  // Map States
  const [mapCenter, setMapCenter] = useState<[number, number]>([51.5225, -0.1554]); // Default Baker St
  const [pickupCoords, setPickupCoords] = useState<[number, number] | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<[number, number] | null>(null);
  const [stops, setStops] = useState<{address: string, coords: [number, number] | null}[]>([]);
  const [routeLine, setRouteLine] = useState<[number, number][]>([]);

  // Fetch route when both coordinates are set
  useEffect(() => {
    if (pickupCoords && dropoffCoords) {
      const getRoute = async () => {
        try {
          const validStops = stops.filter(s => s.coords !== null);
          const stopString = validStops.length > 0 
             ? ';' + validStops.map(s => `${s.coords![1]},${s.coords![0]}`).join(';')
             : '';
          
          // Use OSRM public API for routing
          const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${pickupCoords[1]},${pickupCoords[0]}${stopString};${dropoffCoords[1]},${dropoffCoords[0]}?overview=full&geometries=geojson`);
          if (res.ok) {
            const data = await res.json();
            if (data.routes && data.routes[0]) {
              const coords = data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
              setRouteLine(coords);
            }
          }
        } catch (err) {
          console.error("Routing failed", err);
        }
      };
      getRoute();
    } else {
      setRouteLine([]);
    }
  }, [pickupCoords, dropoffCoords, stops]);

  useEffect(() => {
    // Try to get user's location immediately for the map when they open the page
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
           const coords: [number, number] = [position.coords.latitude, position.coords.longitude];
           setMapCenter(coords);
           setPickupCoords(coords); // Also tentatively set pickup to their GPS
        },
        () => {
           console.log("Could not get initial location automatically.");
        }
      );
    }
  }, []);

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

  
  // Favorites logic
  const [favoriteAddresses, setFavoriteAddresses] = useState<any[]>([]);
  useEffect(() => {
    if (profile?.favoriteAddresses) setFavoriteAddresses(profile.favoriteAddresses);
  }, [profile]);

  const isFavorite = (address: string) => favoriteAddresses.some(f => f.address === address);

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

  // Voice Interaction
  const recognitionRef = useRef<any>(null);

  const startListening = () => {
    triggerHaptic(ImpactStyle.Light);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-GB";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      await processVoiceCommand(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const processVoiceCommand = async (text: string) => {
    setIsAiProcessing(true);
    toast.info("AI extracting details from your voice...");

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Extract taxi booking details from this text: "${text}". 
        Return JSON with: pickup, dropoff, comments.
        The current location is Baker St, London.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              pickup: { type: Type.STRING },
              dropoff: { type: Type.STRING },
              comments: { type: Type.STRING }
            }
          }
        }
      });

      const result = response.text && response.text !== "undefined" ? JSON.parse(response.text) : {};
      if (result.pickup) setPickup(result.pickup);
      if (result.dropoff) setDropoff(result.dropoff);
      if (result.comments) setComments(result.comments);

      toast.success("Details updated via AI Voice!");
    } catch (err) {
      console.error(err);
      toast.error("AI failed to process voice. Please try again or type.");
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Real search results using Nominatim & Postcodes.io
  const [suggestions, setSuggestions] = useState<{label: string, lat?: number, lon?: number}[]>([]);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  useEffect(() => {
    let val = "";
    if (activeField === "pickup") val = pickup;
    else if (activeField === "dropoff") val = dropoff;
    else if (activeField?.startsWith("stop-")) {
      const idx = parseInt(activeField.split('-')[1]);
      val = stops[idx]?.address || "";
    }
    
    if (!val || val.length < 3) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      setIsLoadingAddress(true);
      try {
        // Quick postcode check
        const ukPostcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i;
        if (ukPostcodeRegex.test(val)) {
          const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(val)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === 200 && data.result) {
              setSuggestions([{
                label: `${data.result.postcode}, ${data.result.admin_district || data.result.parish || data.result.region}`,
                lat: data.result.latitude,
                lon: data.result.longitude
              }]);
              setIsLoadingAddress(false);
              return;
            }
          }
        }

        // Address check via Nominatim (Biased to current mapCenter to find nearby places like "Train Station")
        const latBias = mapCenter[0];
        const lonBias = mapCenter[1];
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&countrycodes=gb&limit=5&lat=${latBias}&lon=${lonBias}`);
        if (res.ok) {
          const data = await res.json();
          // Clean up long nominatim addresses a bit
          const cleaned = data.map((d: any) => {
            const parts = d.display_name.split(', ');
            return {
              label: parts.slice(0, 4).join(', '),
              lat: parseFloat(d.lat),
              lon: parseFloat(d.lon)
            };
          });
          setSuggestions(cleaned);
        }
      } catch (err) {
        console.error("Address lookup failed", err);
      } finally {
        setIsLoadingAddress(false);
      }
    };

    const debounce = setTimeout(fetchSuggestions, 600);
    return () => clearTimeout(debounce);
  }, [pickup, dropoff, activeField]);

  const handleDetectLocation = () => {
    triggerHaptic(ImpactStyle.Light);
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setMapCenter([latitude, longitude]); // Auto fly the map
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.display_name) {
              const parts = data.display_name.split(', ');
              const cleaned = parts.slice(0, 4).join(', ');
              setPickup(cleaned);
              setPickupCoords([latitude, longitude]);
              setIsDetecting(false);
              toast.success(`Location detected (Accuracy: ${accuracy.toFixed(1)}m)`);
              return;
            }
          }
        } catch (err) {
          console.error("Reverse geocoding failed", err);
        }
        setPickup(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        setPickupCoords([latitude, longitude]);
        setIsDetecting(false);
        toast.success(`Location detected (Accuracy: ${accuracy.toFixed(1)}m)`);
      },
      (error) => {
        setIsDetecting(false);
        toast.error("Unable to retrieve your location. Please check your permissions.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Simulated distance for fare calc using arbitrary string length hash scaling
  const estimatedMiles = useMemo(() => {
    if (!pickup || !dropoff) return 0;
    const combined = pickup + dropoff;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) hash = ((hash << 5) - hash) + combined.charCodeAt(i);
    return Math.max(2.5, (Math.abs(hash) % 150) / 10); // yields distances between 2.5 and 15 miles
  }, [pickup, dropoff]);

  const getComputedFare = (catId: string) => {
    if (!pickup || !dropoff) return 0;
    const category = CAR_CATEGORIES.find(c => c.id === catId);
    const rawFare = fareConfig.baseFare + (estimatedMiles * fareConfig.distanceRate);
    const multiplier = category?.multiplier || 1.0;
    return Math.max(rawFare * multiplier, fareConfig.minFare * multiplier);
  };

  const handleConfirmBooking = async () => {
    triggerHaptic(ImpactStyle.Heavy);
    hideNativeKeyboard();
    if (!user) return;
    
    const finalFare = getComputedFare(selectedCategory);
    if (!finalFare) return;
    setFareEstimate(finalFare);
    setStep("searching");

    try {
      const blockedList = profile?.blockedDrivers || [];
      
      // Simulate finding a driver that isn't blocked
      const availableDrivers = [
        { uid: "D-8821", name: "David Sterling", vehicle: "Silver Toyota Prius", code: "8821" },
        { uid: "D-4412", name: "Sarah Jenkins", vehicle: "Black Mercedes E-Class", code: "4412" },
        { uid: "D-1902", name: "Michael Chen", vehicle: "Tesla Model 3", code: "1902" }
      ];
      
      const assignedDriver = availableDrivers.find(d => !blockedList.includes(d.uid)) || availableDrivers[0];
      setAssignedDriverInfo(assignedDriver);

      const rideData = {
        riderId: user.uid,
        driverId: assignedDriver.uid,
        driverName: assignedDriver.name,
        vehicleInfo: assignedDriver.vehicle,
        pickup,
        dropoff,
        stops: stops.filter(s => s.coords !== null),
        carCategory: selectedCategory,
        isPetFriendly,
        waitTolerance,
        comments,
        status: "pending",
        totalFare: finalFare,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "ride_requests"), rideData);
      
      setTimeout(() => {
        setStep("confirmed");
        toast.success("Ride request sent to fleet!");
      }, 3000);

    } catch (err) {
      console.error(err);
      toast.error("Failed to post ride request");
      setStep("details");
    }
  };

  const selectSuggestion = (s: {label: string, lat?: number, lon?: number}) => {
    triggerHaptic(ImpactStyle.Light);
    if (activeField === "pickup") {
      setPickup(s.label);
      if (s.lat && s.lon) {
         setMapCenter([s.lat, s.lon]);
         setPickupCoords([s.lat, s.lon]);
      }
    } else if (activeField === "dropoff") {
      setDropoff(s.label);
      if (s.lat && s.lon) {
         setMapCenter([s.lat, s.lon]); // Move map to dropoff focus
         setDropoffCoords([s.lat, s.lon]);
      }
    } else if (activeField?.startsWith("stop-")) {
      const idx = parseInt(activeField.split('-')[1]);
      const newStops = [...stops];
      newStops[idx] = { ...newStops[idx], address: s.label };
      if (s.lat && s.lon) {
        newStops[idx].coords = [s.lat, s.lon];
        setMapCenter([s.lat, s.lon]);
      }
      setStops(newStops);
    }
    setSuggestions([]);
    setActiveField(null);
  };

  return (
    <div className="relative h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-100 flex flex-col">
       {/* Full Screen Map Layer */}
       <div className="absolute inset-0 z-0">
          {window.navigator && ( // Defensive load
             <MapContainer center={mapCenter} zoom={16} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {!pickupCoords && !dropoffCoords && <Marker key="center-marker" position={mapCenter} />}
                {pickupCoords && <Marker key="pickup-marker" position={pickupCoords} />}
                {stops.map((stop, i) => stop.coords && <Marker key={`stop-marker-${i}`} position={stop.coords} />)}
                {dropoffCoords && <Marker key="dropoff-marker" position={dropoffCoords} />}
                {routeLine.length > 0 && (
                   <Polyline key="route-polyline" positions={routeLine} color="#2563eb" weight={5} opacity={0.7} />
                )}
                <MapController center={mapCenter} />
             </MapContainer>
          )}
       </div>

       {/* Interactive Bottom Sheet overlaying the map */}
       <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none flex flex-col justify-end">
          <AnimatePresence mode="wait">
            {step === "details" && (
              <motion.div
                key="details"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="bg-white rounded-t-[40px] shadow-[0_-20px_40px_rgba(0,0,0,0.15)] pointer-events-auto flex flex-col max-h-[55vh] w-full"
              >
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-1 shrink-0" />
                <div className="p-5 pt-2 overflow-y-auto w-full space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <div className="relative">
                    <div className="absolute left-4 top-10 bottom-6 w-0.5 border-l-2 border-dashed border-slate-200" />
                    <div className="space-y-3 relative">
                      {/* Pickup */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between ml-4 pr-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pickup</label>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 bg-amber-50 border border-amber-100 rounded-xl p-1 shadow-sm">
                              <button onClick={startListening} disabled={isAiProcessing} className={cn("p-1.5 rounded-lg transition-all", isListening ? "bg-red-200 text-red-600 animate-pulse" : "text-amber-600 hover:bg-amber-100")}>
                                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                              </button>
                              <button onClick={handleDetectLocation} disabled={isDetecting} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors">
                                {isDetecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
                              </button>
                            </div>
                            <button onClick={() => toggleFavorite(pickup, pickup || "Pickup Location")} className={cn("p-2 rounded-xl transition-all", isFavorite(pickup) ? "bg-amber-100 text-amber-500" : "hover:bg-slate-50 text-slate-300 hover:text-amber-400")}>
                              <Star className={cn("w-4 h-4", isFavorite(pickup) && "fill-amber-500")} />
                            </button>
                          </div>
                        </div>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-blue-500 bg-white z-10" />
                          <input type="text" className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold text-slate-900 outline-none transition-all placeholder:text-slate-400" placeholder="Address, Station, Postcode..." value={pickup} onFocus={() => setActiveField("pickup")} onChange={(e) => setPickup(e.target.value)} />
                        </div>
                      </div>

                      {/* Stops */}
                      {stops.map((stop, i) => (
                        <div key={`stop-input-${stop.address}-${i}`} className="space-y-2 relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 bg-amber-500 rounded-full z-10 border-2 border-white" />
                          <input type="text" className="w-full pl-12 pr-12 py-3 bg-slate-50 border-2 border-transparent focus:border-amber-500 rounded-2xl font-bold text-slate-900 outline-none transition-all placeholder:text-slate-400" placeholder={`Stop ${i + 1}`} value={stop.address} onFocus={() => setActiveField(`stop-${i}`)} onChange={(e) => {
                             const newStops = [...stops];
                             newStops[i].address = e.target.value;
                             setStops(newStops);
                          }} />
                          <button onClick={() => {
                             setStops(stops.filter((_, idx) => idx !== i));
                          }} className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                      ))}

                      {/* Add Stop Button */}
                      {stops.length < 3 && (
                        <div className="relative -my-1 ml-[11px] z-10">
                          <button className="flex items-center gap-1.5 px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded-full border-2 border-white transition-colors" onClick={() => setStops([...stops, { address: "", coords: null }])}>
                            <Plus className="w-3.5 h-3.5" />
                            <span className="text-[9px] font-black uppercase tracking-wider">Add Stop</span>
                          </button>
                        </div>
                      )}

                      {/* Dropoff */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between ml-4 pr-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dropoff</label>
                          <button onClick={() => toggleFavorite(dropoff, dropoff || "Dropoff Location")} className={cn("transition-all p-2 rounded-xl", isFavorite(dropoff) ? "bg-amber-100 text-amber-500" : "text-slate-300 hover:text-amber-400 hover:bg-slate-50")}>
                            <Star className={cn("w-4 h-4", isFavorite(dropoff) && "fill-amber-500")} />
                          </button>
                        </div>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 bg-indigo-600 rounded-sm z-10" />
                          <input type="text" className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl font-bold text-slate-900 outline-none transition-all placeholder:text-slate-400" placeholder="Destination Name or Postcode" value={dropoff} onFocus={() => setActiveField("dropoff")} onChange={(e) => setDropoff(e.target.value)} />
                        </div>
                        {/* Quick Places Chips */}
                        <div className="flex items-center gap-2 mt-2 -mb-1 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                          <button onClick={() => { setDropoff("Home"); setActiveField("dropoff"); triggerHaptic(ImpactStyle.Light); }} className="flex-none flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-full transition-colors whitespace-nowrap">
                            <Home className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
                          </button>
                          <button onClick={() => { setDropoff("Work"); setActiveField("dropoff"); triggerHaptic(ImpactStyle.Light); }} className="flex-none flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-600 rounded-full transition-colors whitespace-nowrap">
                            <Briefcase className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Work</span>
                          </button>
                          <button onClick={() => { setDropoff("Recent Destination"); setActiveField("dropoff"); triggerHaptic(ImpactStyle.Light); }} className="flex-none flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-full transition-colors whitespace-nowrap">
                            <History className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Recent</span>
                          </button>
                        </div>
                      </div>

                      {/* Suggestions Dropdown */}
                      <AnimatePresence>
                        {(suggestions.length > 0 || isLoadingAddress) && (
                          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-100 shadow-xl rounded-2xl mt-1 overflow-hidden">
                            {isLoadingAddress && suggestions.length === 0 && (
                              <div className="w-full px-5 py-4 flex items-center justify-center gap-2 text-slate-400 text-sm font-bold"><Loader2 className="w-4 h-4 animate-spin" />Finding addresses...</div>
                            )}
                            {suggestions.map((s, idx) => (
                              <button key={`suggestion-${s.label}-${idx}`} onClick={() => selectSuggestion(s)} className="w-full px-5 py-3 text-left hover:bg-slate-50 flex items-center gap-3 transition-colors border-b border-slate-50 last:border-0">
                                <History className="w-4 h-4 text-slate-300" />
                                <span className="font-bold text-slate-700 text-sm">{s.label}</span>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Select Car Category */}
                  <div className="space-y-2 pt-2 -mx-2 px-2 overflow-hidden">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Select Ride</label>
                     <div className="flex gap-2 overflow-x-auto pb-4 pt-1 snap-x px-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                       {CAR_CATEGORIES.map((category, idx) => {
                         const price = getComputedFare(category.id);
                         return (
                           <button key={`category-${category.id}-${idx}`} onClick={() => setSelectedCategory(category.id)} className={cn("flex-none w-[88px] snap-start flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all", selectedCategory === category.id ? "border-slate-900 bg-slate-900 shadow-lg text-white transform scale-105" : "border-slate-100 bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50")}>
                             <category.icon className={cn("w-5 h-5 mb-1 transition-colors", selectedCategory === category.id ? "text-white" : "text-slate-400")} />
                             <p className={cn("text-[9px] font-black uppercase tracking-wider mb-0.5 line-clamp-1", selectedCategory === category.id ? "text-slate-300" : "text-slate-500")}>{category.name}</p>
                             <p className="text-[16px] font-black tracking-tighter mb-1.5">£{price.toFixed(2)}</p>
                             <div className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded border mb-1.5", selectedCategory === category.id ? "bg-amber-100 border-amber-200 text-amber-800" : "bg-amber-50 border-amber-200 text-amber-700")}>
                                <Clock className="w-2.5 h-2.5" />
                                <p className="text-[9px] font-bold uppercase tracking-wider">{category.wait} MINS</p>
                             </div>
                             <p className={cn("text-[8px] font-bold uppercase", selectedCategory === category.id ? "text-slate-400" : "text-slate-400")}>{category.capacity} PAX</p>
                           </button>
                         );
                       })}
                     </div>
                  </div>

                  {/* Driver Comments & Preferences */}
                  <div className="space-y-4">
                    {/* Accessibility Toggles */}
                    <div className="flex items-center gap-3 ml-1 mr-1">
                      <button onClick={() => { setIsPetFriendly(!isPetFriendly); triggerHaptic(ImpactStyle.Light); }} className={cn("flex flex-1 justify-center items-center gap-2 py-2.5 rounded-xl border-2 transition-all", isPetFriendly ? "bg-amber-100 border-amber-500 text-amber-800 shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50")}>
                         <Dog className="w-4 h-4" />
                         <span className="text-[10px] font-black uppercase tracking-wider">{isPetFriendly ? 'Pet Friendly ✓' : 'Pet Friendly'}</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between ml-4 pr-1">
                      <div className="flex items-center gap-2">
                         <MessageSquare className="w-3 h-3 text-slate-400" />
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes for Driver</label>
                      </div>
                      {pickup && dropoff && (
                        <button onClick={async () => {
                            if (!user) return;
                            const newJourney = { id: Math.random().toString(36).substr(2, 9), name: `${pickup.split(',')[0]} to ${dropoff.split(',')[0]}`, from: pickup, to: dropoff, comments };
                            try {
                              await updateDoc(doc(db, "users", user.uid), { regularJourneys: arrayUnion(newJourney) });
                              toast.success("Saved to Regular Journeys!");
                            } catch (err) { toast.error("Failed to save journey"); }
                          }} className="flex items-center gap-1 text-[10px] font-black text-blue-600 hover:text-blue-700 transition-colors">
                          <Repeat className="w-3 h-3" />
                          SAVE AS REGULAR
                        </button>
                      )}
                    </div>
                    <textarea rows={2} className="w-full p-4 bg-slate-50 rounded-2xl font-medium text-sm text-slate-600 border-2 border-transparent focus:border-slate-200 outline-none transition-all resize-none" placeholder="Gate code, specific entrance, luggage notes..." value={comments} onChange={(e) => setComments(e.target.value)} />
                  </div>

                  {pickup && dropoff ? (
                     <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pt-2">
                       <button onClick={handleConfirmBooking} disabled={isAiProcessing} className="w-full py-5 bg-orange-500 text-white rounded-3xl font-black text-xl shadow-[0_8px_30px_rgba(249,115,22,0.3)] hover:bg-orange-600 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                         {isAiProcessing ? "Processing Voice..." : `Confirm ${CAR_CATEGORIES.find(c => c.id === selectedCategory)?.name}`}
                         <ChevronRight className="w-6 h-6 opacity-50" />
                       </button>
                     </motion.div>
                  ) : (
                      <div className="py-6 text-center px-4">
                         <p className="text-slate-400 font-bold text-sm">Enter your pickup and dropoff to view ride options and prices.</p>
                      </div>
                  )}
                </div>
              </motion.div>
            )}

            {step === "searching" && (
              <motion.div
                key="searching"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                className="bg-white rounded-t-[40px] shadow-[0_-20px_40px_rgba(0,0,0,0.15)] pointer-events-auto flex flex-col p-8 pt-4 items-center justify-center w-full"
              >
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-8 shrink-0" />
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-blue-400/20 rounded-full animate-ping" />
                  <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center relative shadow-2xl z-10">
                    <Car className="w-8 h-8 text-white animate-pulse" />
                  </div>
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight text-center mb-2">Finding Your Driver</h2>
                <p className="text-slate-500 font-bold text-sm text-center mb-6 max-w-xs">Searching for available vehicles nearby.</p>
                <div className="w-full bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-6">
                   <div className="flex items-center justify-between mb-3">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Search Pulse</span>
                     <span className="flex items-center gap-1 text-[10px] font-black text-blue-600"><Loader2 className="w-3 h-3 animate-spin" /> ACTIVE</span>
                   </div>
                   <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <motion.div initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 180 }} className="h-full bg-blue-600" />
                   </div>
                </div>
                <button onClick={() => { if (window.confirm("Cancel this request?")) setStep("details"); }} className="text-red-500 font-black text-xs uppercase tracking-widest hover:bg-red-50 px-6 py-3 rounded-2xl transition-all">
                  Cancel Request
                </button>
              </motion.div>
            )}

            {step === "confirmed" && (
              <motion.div
                key="confirmed"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                className="bg-white rounded-t-[40px] shadow-[0_-20px_40px_rgba(0,0,0,0.15)] pointer-events-auto flex flex-col p-6 w-full"
              >
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 shrink-0" />
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0">
                     <Check className="w-8 h-8 text-emerald-500" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1">Driver Assigned!</h2>
                    <p className="text-slate-500 font-bold text-sm">{assignedDriverInfo?.name} • {assignedDriverInfo?.vehicle}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-6">
                   <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Est. Arrival</p>
                      <p className="text-xl font-black text-slate-900">4 Mins</p>
                   </div>
                   <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Fixed Fare</p>
                      <p className="text-xl font-black text-indigo-600">£{fareEstimate?.toFixed(2)}</p>
                   </div>
                </div>
                <div className="flex items-center gap-2 text-indigo-600 justify-center mb-6 bg-indigo-50 py-3 rounded-2xl">
                   <Zap className="w-4 h-4 fill-indigo-600" />
                   <p className="text-xs font-black uppercase tracking-widest">Handshake Code: {assignedDriverInfo?.code || "8821"}</p>
                </div>
                <button onClick={() => navigate("/")} className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black text-lg shadow-[0_8px_30px_rgba(15,23,42,0.3)] hover:bg-slate-800 transition-all flex justify-center items-center gap-2">
                  Track Ride Progress <Navigation className="w-5 h-5 opacity-70" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
       </div>
    </div>
  );
}

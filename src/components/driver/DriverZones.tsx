import React, { useState, useEffect } from "react";
import { db, doc, updateDoc } from "@/src/firebase";
import { ChevronLeft, MapPin, Navigation, Map as MapIcon, Search, Check, Minus, Plus } from "lucide-react";
import { useAuth } from "../AuthProvider";
import { toast } from "sonner";
import { GoogleMap, useJsApiLoader, MarkerF, CircleF } from "@react-google-maps/api";
import { cn } from "@/src/lib/utils";

export default function DriverZones({ onClose }: { onClose: () => void }) {
  const { user, profile } = useAuth();
  const [isEnabled, setIsEnabled] = useState(false);
  const [selectedDistance, setSelectedDistance] = useState<number>(0);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [homeLocation, setHomeLocation] = useState<{lat: number, lng: number, address: string} | null>(null);

  useEffect(() => {
    if (profile) {
      if (profile.homeLat && profile.homeLng) {
        setHomeLocation({ lat: profile.homeLat, lng: profile.homeLng, address: profile.homeAddress || '' });
      }
      setIsEnabled(profile.zoneEnabled || false);
      setSelectedDistance(profile.zoneMaxDistance || 0);
    }
  }, [profile]);

  useEffect(() => {
    if (searchQuery.length < 3) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        if (!window.google) return;
        const { AutocompleteSuggestion } = await window.google.maps.importLibrary("places") as any;
        const request = {
          input: searchQuery,
          includedRegionCodes: ["gb"]
        };
        const { suggestions: predictions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        if (predictions && predictions.length > 0) {
          const cleaned = predictions.map((p: any) => ({
            description: p.placePrediction.text.text,
            place_id: p.placePrediction.placeId
          }));
          setSuggestions(cleaned);
        }
      } catch (err) { }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectHome = async (placeId: string, description: string) => {
    if (!user || !window.google) return;
    try {
      const geocoder = new window.google.maps.Geocoder();
      const result = await geocoder.geocode({ placeId });
      if (result.results[0]) {
        const { lat, lng } = result.results[0].geometry.location;
        setHomeLocation({ lat: lat(), lng: lng(), address: description });
        setSearchQuery("");
        setSuggestions([]);
      }
    } catch (err) {
      toast.error("Failed to find location");
    }
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      const updates: any = {
        zoneEnabled: isEnabled,
        zoneMaxDistance: selectedDistance
      };
      if (homeLocation) {
        updates.homeAddress = homeLocation.address;
        updates.homeLat = homeLocation.lat;
        updates.homeLng = homeLocation.lng;
      }
      if (isEnabled && !homeLocation) {
         toast.error("Please set a home location first");
         return;
      }
      await updateDoc(doc(db, "users", user.uid), updates);
      toast.success("Zone preferences saved");
      onClose();
    } catch (err) {
      toast.error("Failed to save changes");
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-[#0E0E11] flex flex-col pointer-events-auto overflow-hidden animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/20 flex items-center justify-between bg-[#1A1A1E] shadow-sm sticky top-0 z-10 shrink-0">
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-[#252529] active:bg-[#2C2C30] border border-white/20 rounded-full transition-colors">
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <h2 className="text-lg font-bold text-white">My Zones</h2>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom)+8rem)] sm:pb-32">
        <div className="p-5 space-y-8">

          {/* Description */}
          <div>
            <p className="text-slate-400 text-sm">
              Set your preferred driving area based on your home Location. We will try to prioritize dispatching jobs that stay within your selected radius.
            </p>
          </div>

          {/* Home Location */}
          <div className="space-y-3">
            <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-2">Home Location</h3>
            {homeLocation ? (
              <div className="bg-[#1A1A1E] border border-white/20 p-4 rounded-xl flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-white font-medium">{homeLocation.address}</span>
                  <span className="text-xs text-slate-400">Lat: {homeLocation.lat.toFixed(4)}, Lng: {homeLocation.lng.toFixed(4)}</span>
                </div>
                <button onClick={() => setHomeLocation(null)} className="text-[#A1A1AA] text-sm underline px-2 py-1">
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search postcode or address..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-[#1A1A1E] text-white px-12 py-4 rounded-xl border border-white/20 focus:border-[#007AFF] outline-none"
                />
                <Search className="w-5 h-5 text-[#A1A1AA] absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
            )}
            
            {suggestions.length > 0 && !homeLocation && (
              <div className="bg-[#252529] rounded-xl overflow-hidden shadow-lg border border-white/20 max-h-[50vh] overflow-y-auto mb-4">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectHome(s.place_id, s.description)}
                    className="w-full text-left px-5 py-4 border-b border-white/20 hover:bg-[#2C2C30] transition-colors flex items-start gap-4"
                  >
                    <MapPin className="w-5 h-5 text-[#A1A1AA] shrink-0 mt-0.5" />
                    <span className="text-white text-sm">{s.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Map Preview */}
          {homeLocation && (
             <div className="h-64 rounded-xl overflow-hidden border border-white/20 relative">
                <GoogleMap
                  mapContainerClassName="w-full h-full"
                  center={{ lat: homeLocation.lat, lng: homeLocation.lng }}
                  zoom={selectedDistance > 0 ? Math.max(7, 13 - Math.log2(selectedDistance)) : 12}
                  options={{
                     disableDefaultUI: false,
                     zoomControl: true,
                     streetViewControl: false,
                     mapTypeControl: false,
                     fullscreenControl: false,
                     gestureHandling: "greedy",
                     keyboardShortcuts: false,
                     styles: [{"elementType":"geometry","stylers":[{"color":"#ebe3cd"}]},{"elementType":"labels.text.fill","stylers":[{"color":"#523735"}]},{"elementType":"labels.text.stroke","stylers":[{"color":"#f5f1e6"}]},{"featureType":"administrative","elementType":"geometry.stroke","stylers":[{"color":"#c9b2a6"}]},{"featureType":"administrative.land_parcel","elementType":"geometry.stroke","stylers":[{"color":"#dcd2be"}]},{"featureType":"administrative.land_parcel","elementType":"labels.text.fill","stylers":[{"color":"#ae9e90"}]},{"featureType":"landscape.natural","elementType":"geometry","stylers":[{"color":"#dfd2ae"}]},{"featureType":"poi","elementType":"geometry","stylers":[{"color":"#dfd2ae"}]},{"featureType":"poi","elementType":"labels.text.fill","stylers":[{"color":"#93817c"}]},{"featureType":"poi.park","elementType":"geometry.fill","stylers":[{"color":"#a5b076"}]},{"featureType":"poi.park","elementType":"labels.text.fill","stylers":[{"color":"#447530"}]},{"featureType":"road","elementType":"geometry","stylers":[{"color":"#f5f1e6"}]},{"featureType":"road.arterial","elementType":"geometry","stylers":[{"color":"#fdfcf8"}]},{"featureType":"road.highway","elementType":"geometry","stylers":[{"color":"#f8c967"}]},{"featureType":"road.highway","elementType":"geometry.stroke","stylers":[{"color":"#e9bc62"}]},{"featureType":"road.highway.controlled_access","elementType":"geometry","stylers":[{"color":"#e98d58"}]},{"featureType":"road.highway.controlled_access","elementType":"geometry.stroke","stylers":[{"color":"#db8555"}]},{"featureType":"road.local","elementType":"labels.text.fill","stylers":[{"color":"#806b63"}]},{"featureType":"transit.line","elementType":"geometry","stylers":[{"color":"#dfd2ae"}]},{"featureType":"transit.line","elementType":"labels.text.fill","stylers":[{"color":"#8f7d77"}]},{"featureType":"transit.line","elementType":"labels.text.stroke","stylers":[{"color":"#ebe3cd"}]},{"featureType":"transit.station","elementType":"geometry","stylers":[{"color":"#dfd2ae"}]},{"featureType":"water","elementType":"geometry.fill","stylers":[{"color":"#b9d3c2"}]},{"featureType":"water","elementType":"labels.text.fill","stylers":[{"color":"#92998d"}]}]
                  }}
                >
                  <MarkerF position={{ lat: homeLocation.lat, lng: homeLocation.lng }} />
                  {isEnabled && selectedDistance > 0 && (
                     <CircleF 
                        center={{ lat: homeLocation.lat, lng: homeLocation.lng }}
                        radius={selectedDistance * 1609.34} // miles to meters
                        options={{
                           fillColor: "#007AFF",
                           fillOpacity: 0.15,
                           strokeColor: "#007AFF",
                           strokeWeight: 2
                        }}
                     />
                  )}
                </GoogleMap>
             </div>
          )}

          {/* Toggle Enable */}
          <div className="bg-[#1A1A1E] border border-white/20 rounded-xl p-4 flex items-center justify-between">
             <div className="flex flex-col gap-1 pr-4">
                <span className="text-white font-bold">Enable Working Zone</span>
                <span className="text-xs text-slate-400">Limit offers based on radius from home</span>
             </div>
             <button 
                onClick={() => setIsEnabled(!isEnabled)}
                className={cn("w-14 h-8 rounded-full flex items-center p-1 transition-colors relative shrink-0", isEnabled ? "bg-[#00D26A]" : "bg-[#2C2C30]")}
             >
                <div className={cn("w-6 h-6 rounded-full bg-white transition-transform shadow-md outline-none", isEnabled ? "translate-x-6" : "translate-x-0")} />
             </button>
          </div>

          {/* Distance Dropdown Options */}
          {isEnabled && (
             <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                   <h3 className="text-white font-bold text-sm uppercase tracking-wider">Zone Radius</h3>
                   <span className="text-[#007AFF] font-bold text-lg">{selectedDistance > 0 ? `${selectedDistance} mi` : "National"}</span>
                </div>
                
                <div className="bg-[#1A1A1E] border border-white/20 rounded-xl p-5 flex items-center justify-between">
                   <button 
                      onClick={() => setSelectedDistance(selectedDistance === 0 ? 10 : Math.max(1, selectedDistance - 1))}
                      className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center text-white active:bg-[#2C2C30] transition-colors"
                   >
                      <Minus className="w-6 h-6" />
                   </button>
                   
                   <div className="flex flex-col items-center">
                      <div className="flex items-baseline gap-1">
                         <span className="text-4xl font-bold text-white">{selectedDistance > 0 ? selectedDistance : 10}</span>
                         <span className="text-slate-400 font-medium">mi</span>
                      </div>
                   </div>

                   <button 
                      onClick={() => setSelectedDistance(selectedDistance === 0 ? 10 : Math.min(50, selectedDistance + 1))}
                      className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center text-white active:bg-[#2C2C30] transition-colors"
                   >
                      <Plus className="w-6 h-6" />
                   </button>
                </div>

                <button
                   onClick={() => setSelectedDistance(selectedDistance === 0 ? 10 : 0)}
                   className={cn(
                      "w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left mt-2",
                      selectedDistance === 0 ? "bg-[#007AFF]/10 border-[#007AFF]" : "bg-[#1A1A1E] border-white/20"
                   )}
                >
                  <span className={cn("font-medium", selectedDistance === 0 ? "text-[#007AFF]" : "text-white")}>
                     National (Anywhere)
                  </span>
                  {selectedDistance === 0 && <Check className="w-5 h-5 text-[#007AFF]" />}
                </button>
             </div>
          )}

        </div>
      </div>

      {/* Floating Save Button */}
      <div className="absolute bottom-[calc(4.5rem+env(safe-area-inset-bottom)+1.5rem)] sm:bottom-6 left-5 right-5 pointer-events-auto">
        <button 
          onClick={handleSave}
          className="w-full bg-[#007AFF] text-white font-bold py-4 rounded-2xl shadow-[0_8px_30px_rgba(0,122,255,0.3)] active:scale-[0.98] transition-transform"
        >
          Save Zone Options
        </button>
      </div>

    </div>
  );
}

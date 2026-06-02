import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { db, doc, updateDoc, arrayRemove, arrayUnion } from "@/src/firebase";
import { motion, AnimatePresence } from "motion/react";
import { MapPin, Bookmark, Trash2, ArrowRight, Plus, Search, Heart, Star, X, Home, Briefcase } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/src/lib/utils";
import { toast } from "sonner";
import { useJsApiLoader } from "@react-google-maps/api";
import { Capacitor } from '@capacitor/core';
import { getGoogleMapsApiKey } from "@/src/lib/capacitor";

const libraries: any[] = ["places", "geometry"];

export default function SavedJourneys() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const savedJourneys = profile?.regularJourneys || [];
  const favoriteAddresses = profile?.favoriteAddresses || [];
  
  const [activeTab, setActiveTab] = useState<"regular" | "favorites">("regular");
  const [showAddFavorite, setShowAddFavorite] = useState(false);
  
  const [searchAddress, setSearchAddress] = useState("");
  const [favHouseNumber, setFavHouseNumber] = useState("");
  const [favName, setFavName] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: getGoogleMapsApiKey(),
    libraries,
    version: "quarterly"
  });

  useEffect(() => {
    if (!isLoaded || !searchAddress || searchAddress.length < 3) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      setIsLoadingAddress(true);
      try {
        if (!window.google || !window.google.maps) {
          throw new Error("Google Maps not loaded");
        }
        const { AutocompleteSuggestion } = await window.google.maps.importLibrary("places") as any;
        const request = { input: searchAddress, includedRegionCodes: ['GB'] };
        const { suggestions: predictions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        
        setIsLoadingAddress(false);
        if (predictions && predictions.length > 0) {
          const cleaned = predictions.map((p: any) => ({
            label: p.placePrediction.text.text,
            placeId: p.placePrediction.placeId,
            placePrediction: p.placePrediction
          }));
          setSuggestions(cleaned);
        } else {
          setSuggestions([]);
        }
      } catch (err) {
        console.error("Google Places Exception:", err);
        setSuggestions([]);
        setIsLoadingAddress(false);
      }
    };

    const timer = setTimeout(fetchSuggestions, 400);
    return () => clearTimeout(timer);
  }, [searchAddress, isLoaded]);

  const handleAddFavorite = async (place: any) => {
    if (!user) return;
    setLoading(true);
    try {
      let lat = null;
      let lng = null;
      const finalAddress = favHouseNumber ? `${favHouseNumber} ${place.label}` : place.label;

      if (window.google && window.google.maps) {
        try {
          const { Geocoder } = await window.google.maps.importLibrary("geocoding") as any;
          const geocoder = new Geocoder();
          const geocodeRes = await geocoder.geocode({ address: finalAddress });
          if (geocodeRes.results && geocodeRes.results.length > 0) {
             const loc = geocodeRes.results[0].geometry.location;
             lat = loc.lat();
             lng = loc.lng();
          }
        } catch (gErr) {
          console.warn("Geocoding failed for favorite:", gErr);
        }
      }

      const favoriteObj: any = {
        address: finalAddress,
        placeId: place.placeId,
        lat,
        lng,
        addedAt: Date.now()
      };
      if (favName.trim()) {
        favoriteObj.name = favName.trim();
      }

      await updateDoc(doc(db, "users", user.uid), {
        favoriteAddresses: arrayUnion(favoriteObj)
      });
      setShowAddFavorite(false);
      setSearchAddress("");
      setFavHouseNumber("");
      setFavName("");
      setSuggestions([]);
    } catch (err) {
      console.error("Failed to add favorite:", err);
    } finally {
      setLoading(false);
    }
  };

  const [confirmRemoveJourneyIndex, setConfirmRemoveJourneyIndex] = useState<number | null>(null);
  const [confirmRemoveFavIndex, setConfirmRemoveFavIndex] = useState<number | null>(null);

  const handleRemoveFavorite = async (fav: any, index: number) => {
    if (!user) return;
    if (confirmRemoveFavIndex !== index) {
      setConfirmRemoveFavIndex(index);
      setTimeout(() => setConfirmRemoveFavIndex(null), 2500);
      return;
    }
    
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        favoriteAddresses: arrayRemove(fav)
      });
      toast.success("Address deleted");
      setConfirmRemoveFavIndex(null);
    } catch (err) {
      console.error("Failed to remove favorite:", err);
      toast.error("Failed to delete address");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveJourney = async (journey: any, index: number) => {
    if (!user) return;
    if (confirmRemoveJourneyIndex !== index) {
      setConfirmRemoveJourneyIndex(index);
      setTimeout(() => setConfirmRemoveJourneyIndex(null), 2500);
      return;
    }
    
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        regularJourneys: arrayRemove(journey)
      });
      toast.success("Journey deleted");
      setConfirmRemoveJourneyIndex(null);
    } catch (err) {
      console.error("Failed to remove journey:", err);
      toast.error("Failed to delete journey");
    } finally {
      setLoading(false);
    }
  };

  const handleBookJourney = (journey: any, reverse = false) => {
    const params = new URLSearchParams();
    if (reverse) {
      if (journey.to) params.set("pickup", journey.to);
      if (journey.from) params.set("dropoff", journey.from);
    } else {
      if (journey.from) params.set("pickup", journey.from);
      if (journey.to) params.set("dropoff", journey.to);
    }
    navigate(`/book-ride?${params.toString()}`);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-surface pb-24 min-h-0">
      {/* Header */}
      <div className="bg-card px-4 pt-6 pb-4 border-b border-border-main sticky top-0 z-10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-text-main leading-tight">Saved</h1>
            <p className="text-text-muted font-medium text-sm mt-1">Your frequent trips & places</p>
          </div>
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
            <Bookmark className="w-6 h-6" />
          </div>
        </div>

        <div className="flex bg-surface p-1 rounded-2xl border border-border-main">
          <button
            onClick={() => setActiveTab("regular")}
            className={cn(
              "flex-1 py-2.5 text-sm font-bold rounded-xl transition-all",
              activeTab === "regular" ? "bg-sky-100 text-sky-900 shadow-sm border border-sky-200" : "text-text-muted hover:text-text-main hover:bg-card/50"
            )}
          >
            Regular Journeys
          </button>
          <button
            onClick={() => setActiveTab("favorites")}
            className={cn(
              "flex-1 py-2.5 text-sm font-bold rounded-xl transition-all",
              activeTab === "favorites" ? "bg-sky-100 text-sky-900 shadow-sm border border-sky-200" : "text-text-muted hover:text-text-main hover:bg-card/50"
            )}
          >
            Favorite Addresses
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {activeTab === "regular" ? (
          <>
            {savedJourneys.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-3xl border border-border-main shadow-sm">
                <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bookmark className="w-8 h-8 text-text-muted" />
                </div>
                <h3 className="text-lg font-bold text-text-main">No saved journeys</h3>
                <p className="text-sm text-text-muted mt-1 mb-6 max-w-[250px] mx-auto">
                  Save your frequent routes from the My Rides tab to quickly book them here.
                </p>
                <button
                  onClick={() => navigate("/my-rides")}
                  className="bg-text-main text-surface px-6 py-3 rounded-2xl font-black text-sm hover:opacity-90 transition-colors"
                >
                  Go to My Rides
                </button>
              </div>
            ) : (
              savedJourneys.map((journey: any, idx: number) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={`${journey.from}-${journey.to}-${idx}`}
                  className="bg-card rounded-3xl border border-border-main shadow-sm overflow-hidden p-4 group"
                >
                  <div className="space-y-4 mb-4">
                    {journey.name && (
                      <h3 className="text-sm font-black text-slate-800">{journey.name}</h3>
                    )}
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-surface border border-border-main flex items-center justify-center shrink-0 mt-0.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Pickup</p>
                        <p className="text-sm font-bold text-text-main line-clamp-1">{journey.from}</p>
                      </div>
                    </div>

                    <div className="w-0.5 h-4 bg-border-main ml-[15px] -my-2" />

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-surface border border-border-main flex items-center justify-center shrink-0 mt-0.5">
                        <MapPin className="w-4 h-4 text-trust" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Dropoff</p>
                        <p className="text-sm font-bold text-text-main line-clamp-1">{journey.to}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border-main relative">
                    {confirmRemoveJourneyIndex === idx && (
                      <div className="absolute bottom-full mb-2 left-0 whitespace-nowrap bg-amber-400 text-slate-900 text-[11px] font-black tracking-tight py-1.5 px-3 rounded-xl shadow-lg z-10 pointer-events-none origin-bottom flex items-center gap-1.5 border border-amber-500/30">
                        <span className="text-[10px]">⚠️</span> Double tap to delete
                        <div className="absolute -bottom-1 left-5 w-2 h-2 bg-amber-400 rotate-45 border-r border-b border-amber-500/30" />
                      </div>
                    )}
                    <button
                      onClick={() => handleRemoveJourney(journey, idx)}
                      disabled={loading}
                      className={cn(
                        "p-3 rounded-xl transition-colors disabled:opacity-50",
                        confirmRemoveJourneyIndex === idx ? "bg-danger/20 text-danger shadow-sm" : "text-text-muted bg-surface hover:bg-danger/10 hover:text-danger"
                      )}
                      title="Remove"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <div className="flex w-full gap-2 hidden group-hover:flex">
                      <button
                        onClick={() => handleBookJourney(journey, false)}
                        className="flex-1 flex items-center justify-center gap-1 py-3 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-xs hover:bg-emerald-100 transition-colors"
                      >
                        Go
                      </button>
                      <button
                        onClick={() => handleBookJourney(journey, true)}
                        className="flex-1 flex items-center justify-center gap-1 py-3 bg-orange-50 text-orange-700 rounded-xl font-bold text-xs hover:bg-orange-100 transition-colors"
                      >
                        Return
                      </button>
                    </div>
                    <button
                      onClick={() => handleBookJourney(journey, false)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl font-black text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 group-hover:hidden"
                    >
                      Book This Journey <ArrowRight className="w-4 h-4 opacity-70" />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </>
        ) : (
          /* Favorites Tab Content */
          <>
            <button
              onClick={() => setShowAddFavorite(true)}
              className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-primary/30 text-primary font-bold rounded-3xl hover:bg-primary/5 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Save your favorite addresses
            </button>

            {favoriteAddresses.length === 0 && !showAddFavorite ? (
              <div className="text-center py-12 bg-card rounded-3xl border border-border-main shadow-sm mt-4">
                <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-4">
                  <Star className="w-8 h-8 text-text-muted" />
                </div>
                <h3 className="text-lg font-bold text-text-main">No favorites yet</h3>
                <p className="text-sm text-text-muted mt-1 mb-6 max-w-[250px] mx-auto">
                  Add places like your gym, grocery store, or friends' houses.
                </p>
              </div>
            ) : (
              favoriteAddresses.map((fav: any, idx: number) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={`fav-${idx}`}
                  className="bg-card rounded-3xl border border-border-main shadow-sm p-4 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-yellow-50 flex items-center justify-center shrink-0">
                      <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                    </div>
                    <div className="min-w-0 pr-4">
                      {fav.name && <p className="text-sm font-black text-black truncate mb-0.5">{fav.name}</p>}
                      <p className={cn("truncate", fav.name ? "text-xs font-bold text-black" : "text-sm font-black text-black")}>{fav.address}</p>
                    </div>
                  </div>
                  <div className="relative flex items-center justify-center">
                    {confirmRemoveFavIndex === idx && (
                      <div className="absolute bottom-full mb-2 right-0 md:right-1/2 md:translate-x-1/2 whitespace-nowrap bg-amber-400 text-slate-900 text-[11px] font-black tracking-tight py-1.5 px-3 rounded-xl shadow-lg z-10 pointer-events-none origin-bottom flex items-center gap-1.5 border border-amber-500/30">
                        <span className="text-[10px]">⚠️</span> Double tap to delete
                        <div className="absolute -bottom-1 right-4 md:right-1/2 md:translate-x-1/2 w-2 h-2 bg-amber-400 rotate-45 border-r border-b border-amber-500/30" />
                      </div>
                    )}
                    <button
                      onClick={() => handleRemoveFavorite(fav, idx)}
                      disabled={loading}
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                        confirmRemoveFavIndex === idx ? "bg-danger/20 text-danger shadow-sm" : "bg-surface text-text-muted hover:bg-danger/10 hover:text-danger"
                      )}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              ))
            )}

            <AnimatePresence>
              {showAddFavorite && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
                  <motion.div
                    initial={{ opacity: 0, y: "100%" }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: "100%" }}
                    className="w-full max-w-lg bg-card rounded-t-3xl sm:rounded-3xl flex flex-col h-[80vh] sm:h-auto sm:max-h-[80vh]"
                  >
                    <div className="p-4 border-b border-border-main flex items-center justify-between shrink-0">
                      <h3 className="text-lg font-black text-text-main">Add Favorite Address</h3>
                      <button onClick={() => setShowAddFavorite(false)} className="w-10 h-10 rounded-full bg-surface flex items-center justify-center"><X className="w-6 h-6 text-text-main" /></button>
                    </div>
                    
                    <div className="p-4 border-b border-border-main shrink-0 flex flex-col gap-3">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Name (e.g. Home, Work, Gym)"
                          value={favName}
                          onChange={(e) => setFavName(e.target.value)}
                          className="w-full bg-surface border border-border-main rounded-2xl py-3 px-4 font-bold text-text-main placeholder:text-text-muted shadow-inner focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        />
                        <div className="flex gap-2 mt-2 flex-wrap">
                          <button 
                            onClick={() => setFavName("Home")} 
                            className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border", favName.trim().toLowerCase() === "home" ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100")}
                          >
                            <span className="flex items-center gap-1.5"><Home className="w-3.5 h-3.5" /> Save as Home</span>
                          </button>
                          <button 
                            onClick={() => setFavName("Work")} 
                            className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border", favName.trim().toLowerCase() === "work" ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100")}
                          >
                            <span className="flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Save as Work</span>
                          </button>
                          <button 
                            onClick={() => { if (favName.trim().toLowerCase() === "home" || favName.trim().toLowerCase() === "work") setFavName(""); }} 
                            className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border", (favName.trim().toLowerCase() !== "home" && favName.trim().toLowerCase() !== "work") ? "bg-rose-600 text-white border-rose-600 shadow-sm" : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100")}
                          >
                            <span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5" /> Save as Favorite</span>
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-none bg-surface border border-border-main rounded-2xl flex items-center shadow-inner focus-within:border-primary transition-colors pr-1">
                          <input
                            type="text"
                            placeholder="House No"
                            value={favHouseNumber}
                            onChange={(e) => setFavHouseNumber(e.target.value)}
                            className="w-24 bg-transparent outline-none text-text-main font-bold py-4 text-center placeholder:text-text-muted/60 text-[15px]"
                          />
                        </div>
                        <div className="relative flex-1">
                          <Search className="absolute left-4 top-[18px] w-5 h-5 text-text-muted" />
                          <input
                            type="text"
                            placeholder="Enter Postcode or Area..."
                            value={searchAddress}
                            onChange={(e) => setSearchAddress(e.target.value)}
                            className="w-full bg-surface border border-border-main rounded-2xl py-4 pl-12 pr-4 font-bold text-text-main placeholder:text-text-muted shadow-inner focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                            autoFocus
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2">
                       {isLoadingAddress ? (
                          <div className="flex items-center justify-center py-8">
                             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                          </div>
                        ) : suggestions.length > 0 ? (
                          suggestions.map((suggestion, idx) => (
                            <button
                               key={idx}
                               onClick={() => handleAddFavorite(suggestion)}
                               className="w-full text-left p-4 hover:bg-surface rounded-2xl transition-all flex items-center gap-4"
                            >
                               <div className="w-10 h-10 bg-card rounded-xl border border-border-main flex items-center justify-center shrink-0 shadow-sm">
                                 <MapPin className="w-5 h-5 text-text-muted" />
                               </div>
                               <div className="flex-1 min-w-0">
                                 <p className="font-bold text-sm text-text-main truncate">{suggestion.label}</p>
                                 <p className="text-xs text-text-muted truncate mt-0.5">Select to save as favorite</p>
                               </div>
                            </button>
                          ))
                        ) : searchAddress.length >= 3 ? (
                          <div className="text-center py-8 text-text-muted font-medium text-sm">
                             No addresses found
                          </div>
                        ) : (
                          <div className="text-center py-8 text-text-muted font-medium text-sm">
                             Start typing to search...
                          </div>
                        )}
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}

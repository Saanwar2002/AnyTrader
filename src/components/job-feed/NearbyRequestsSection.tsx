import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Navigation, LocateFixed, MapPin, Flame, Zap, Sparkles, ChevronRight, RefreshCw, AlertTriangle, Briefcase, Clock, CheckCircle2 } from "lucide-react";
import { cn, calculateDistanceMiles, getOutwardPostcode } from "@/src/lib/utils";
import { reverseLookupPostcode, lookupPostcode } from "@/src/services/postcodeService";
import { getNearbyTradeInsights, type NearbyTradeInsights } from "@/src/services/gemini";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface NearbyRequestsSectionProps {
  jobs: any[];
  onSelectCategoryFilter?: (category: string) => void;
  onSelectUrgencyFilter?: (urgency: string) => void;
}

export const NearbyRequestsSection: React.FC<NearbyRequestsSectionProps> = ({
  jobs,
  onSelectCategoryFilter,
  onSelectUrgencyFilter,
}) => {
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(() => {
    try {
      const saved = localStorage.getItem("user_geo_coords");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [locationName, setLocationName] = useState<string>(() => {
    return localStorage.getItem("user_geo_location_name") || "";
  });

  const [isLocating, setIsLocating] = useState(false);
  const [insights, setInsights] = useState<NearbyTradeInsights | null>(null);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [selectedNearbyCategory, setSelectedNearbyCategory] = useState<string | null>(null);

  // Auto-request location on mount if never set
  useEffect(() => {
    if (!userCoords && navigator.geolocation) {
      handleDetectLocation(true); // silent auto-detect attempt
    }
  }, []);

  const handleDetectLocation = (silent: boolean = false) => {
    if (!navigator.geolocation) {
      if (!silent) toast.error("Geolocation is not supported by your browser or device.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const coordsObj = { lat, lng };
        
        setUserCoords(coordsObj);
        localStorage.setItem("user_geo_coords", JSON.stringify(coordsObj));

        // Reverse lookup postcode / area name
        try {
          const pcData = await reverseLookupPostcode(lat, lng);
          if (pcData) {
            const displayName = pcData.area || pcData.city || pcData.postcode || `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
            setLocationName(displayName);
            localStorage.setItem("user_geo_location_name", displayName);
            if (!silent) toast.success(`Located: ${displayName}`);
          } else {
            const fallbackName = `Near Lat ${lat.toFixed(2)}, Lng ${lng.toFixed(2)}`;
            setLocationName(fallbackName);
            localStorage.setItem("user_geo_location_name", fallbackName);
            if (!silent) toast.success("Device geolocation updated");
          }
        } catch (err) {
          console.warn("Error reverse geocoding location:", err);
          if (!silent) toast.success("Device geolocation updated");
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.warn("Geolocation permission or position error:", error);
        setIsLocating(false);
        if (!silent) {
          if (error.code === error.PERMISSION_DENIED) {
            toast.error("Location permission denied. Please allow location access in your browser settings.");
          } else {
            toast.error("Unable to retrieve device location. Please try again.");
          }
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // Calculate nearby jobs with distance
  const nearbyJobsWithDistance = React.useMemo(() => {
    return jobs.map((job) => {
      let distanceMiles: number | null = null;

      const jobLat = job.lat || job.latitude || job.location?.lat;
      const jobLng = job.lng || job.longitude || job.location?.lng;

      if (userCoords && jobLat && jobLng) {
        distanceMiles = calculateDistanceMiles(userCoords.lat, userCoords.lng, jobLat, jobLng);
      } else if (userCoords && job.postcode) {
        // Approximate distance based on outward postcode matching if exact coords missing
        const outcode = getOutwardPostcode(job.postcode);
        const userOutcode = locationName ? locationName.split(' ')[0] : "";
        if (outcode && userOutcode && outcode.toUpperCase() === userOutcode.toUpperCase()) {
          distanceMiles = 1.5;
        } else {
          distanceMiles = 8.0;
        }
      }

      const isUrgent = job.urgency === "emergency" || job.urgency === "same-day" || job.urgency === "within-24h" || job.isEmergency === true;

      return {
        ...job,
        distanceMiles,
        isUrgent
      };
    })
    .sort((a, b) => {
      // Prioritize urgent jobs and closer distances
      if (a.isUrgent && !b.isUrgent) return -1;
      if (!a.isUrgent && b.isUrgent) return 1;
      if (a.distanceMiles !== null && b.distanceMiles !== null) {
        return a.distanceMiles - b.distanceMiles;
      }
      return 0;
    });
  }, [jobs, userCoords, locationName]);

  // Filter nearby jobs if category selected
  const displayedNearbyJobs = React.useMemo(() => {
    if (!selectedNearbyCategory) return nearbyJobsWithDistance.slice(0, 8);
    return nearbyJobsWithDistance
      .filter(j => j.category && j.category.toLowerCase().includes(selectedNearbyCategory.toLowerCase()))
      .slice(0, 8);
  }, [nearbyJobsWithDistance, selectedNearbyCategory]);

  // Fetch AI insights when nearby jobs or location changes
  useEffect(() => {
    if (jobs.length === 0) return;

    let isMounted = true;
    setIsGeneratingInsights(true);

    const summaries = nearbyJobsWithDistance.slice(0, 15).map(j => ({
      category: j.category || "General",
      title: j.title || "Trade Job",
      urgency: j.urgency || "routine",
      distanceMiles: j.distanceMiles || undefined
    }));

    getNearbyTradeInsights(locationName || "your immediate area", summaries)
      .then((res) => {
        if (isMounted && res) {
          setInsights(res);
        }
      })
      .catch((err) => {
        console.warn("Failed to generate AI nearby trade insights:", err);
      })
      .finally(() => {
        if (isMounted) setIsGeneratingInsights(false);
      });

    return () => {
      isMounted = false;
    };
  }, [locationName, nearbyJobsWithDistance.length]);

  const urgentCountNearby = nearbyJobsWithDistance.filter(j => j.isUrgent).length;

  return (
    <div className="bg-slate-50 rounded-3xl p-5 border border-black shadow-sm space-y-4 my-4">
      {/* Location Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shrink-0 shadow-sm">
            <Navigation className="w-5 h-5 text-amber-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-black tracking-tight">
                Nearby Requests
              </h2>
              {urgentCountNearby > 0 && (
                <span className="px-2 py-0.5 bg-red-100 text-red-900 border border-red-300 rounded-full font-black text-[10px] uppercase flex items-center gap-1">
                  <Flame className="w-3 h-3 text-red-600 fill-red-500" />
                  {urgentCountNearby} Urgent
                </span>
              )}
            </div>
            <p className="text-xs text-slate-700 font-medium flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              {userCoords ? (
                <span>
                  Showing demand in <strong>{locationName || "Your Immediate Area"}</strong>
                </span>
              ) : (
                <span>Detect your location to see urgent trade requests near you</span>
              )}
            </p>
          </div>
        </div>

        <button
          onClick={() => handleDetectLocation(false)}
          disabled={isLocating}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-100 text-black rounded-2xl border border-black font-extrabold text-xs transition-all active:scale-95 shadow-xs shrink-0 disabled:opacity-50"
        >
          {isLocating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              <span>Locating...</span>
            </>
          ) : (
            <>
              <LocateFixed className="w-4 h-4 text-emerald-600" />
              <span>{userCoords ? "Update Geolocation" : "Enable Geolocation"}</span>
            </>
          )}
        </button>
      </div>

      {/* Geolocation Prompt if not detected */}
      {!userCoords && (
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-300 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center shrink-0">
              <LocateFixed className="w-5 h-5 text-amber-800" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-950">
                Unlock Real-Time Nearby Job Alerts
              </p>
              <p className="text-[11px] text-amber-800">
                Allow device location access to instantly discover urgent plumbing, electrical, and roofing requests within miles of your position.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleDetectLocation(false)}
            className="px-4 py-2 bg-amber-900 text-white rounded-xl font-black text-xs hover:bg-black transition-all shrink-0 w-full sm:w-auto text-center"
          >
            Locate Me Now
          </button>
        </div>
      )}

      {/* AI Intelligence Insights & Urgent Alert Banner */}
      {insights && (
        <div className="space-y-2">
          {insights.urgentAlert && (
            <div className="bg-red-50 border border-red-300 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-red-950 font-bold shadow-xs">
              <Zap className="w-4 h-4 text-red-600 fill-red-500 shrink-0 mt-0.5" />
              <p className="flex-1 leading-snug">{insights.urgentAlert}</p>
            </div>
          )}

          <div className="bg-white rounded-2xl p-3.5 border border-black/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <p className="font-bold text-black">{insights.summary}</p>
                <p className="text-[11px] text-slate-600 italic mt-0.5">{insights.insightTip}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popular Trade Service Filter Chips */}
      {insights?.popularCategories && insights.popularCategories.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px] font-black uppercase text-slate-500 tracking-wider">
            <span>Popular Services Near You</span>
            {selectedNearbyCategory && (
              <button
                onClick={() => setSelectedNearbyCategory(null)}
                className="text-blue-600 hover:underline font-bold"
              >
                Show All Nearby
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {insights.popularCategories.map((cat, i) => {
              const isSelected = selectedNearbyCategory === cat.category;
              const isHighUrgency = cat.urgencyLevel === "High";

              return (
                <button
                  key={i}
                  onClick={() => {
                    const nextVal = isSelected ? null : cat.category;
                    setSelectedNearbyCategory(nextVal);
                    if (onSelectCategoryFilter) {
                      onSelectCategoryFilter(nextVal || "");
                    }
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border shadow-xs active:scale-95",
                    isSelected
                      ? "bg-slate-900 text-white border-black"
                      : isHighUrgency
                      ? "bg-red-50 text-red-900 border-red-300 hover:bg-red-100"
                      : "bg-white text-slate-900 border-black/10 hover:bg-slate-100"
                  )}
                >
                  {isHighUrgency ? (
                    <Flame className="w-3.5 h-3.5 text-red-600 fill-red-500 shrink-0" />
                  ) : (
                    <Briefcase className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  )}
                  <span>{cat.category}</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-slate-200/80 text-black text-[10px]">
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Nearby Jobs Horizon Carousel / Grid */}
      <div className="pt-2">
        {displayedNearbyJobs.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-black/10">
            <p className="text-xs font-bold text-slate-600">
              No matching active trade requests in your immediate vicinity right now.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {displayedNearbyJobs.map((job) => (
              <Link
                key={job.id}
                to={`/job/${job.id}`}
                className="bg-white rounded-2xl p-3.5 border border-black hover:border-blue-600 transition-all hover:shadow-md flex flex-col justify-between space-y-3 group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-1.5">
                    {/* Urgency Badge */}
                    {job.isUrgent ? (
                      <span className="px-2 py-0.5 bg-red-100 text-red-900 border border-red-300 rounded-lg text-[10px] font-black uppercase flex items-center gap-1">
                        <Flame className="w-3 h-3 text-red-600 fill-red-500 shrink-0" />
                        Urgent Request
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-bold">
                        {job.category || "Trade Job"}
                      </span>
                    )}

                    {/* Distance Badge */}
                    <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200 flex items-center gap-1 shrink-0">
                      <MapPin className="w-3 h-3 text-blue-600" />
                      {job.distanceMiles !== null ? `${job.distanceMiles} mi` : (job.postcode ? getOutwardPostcode(job.postcode) : "Nearby")}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-xs text-black line-clamp-1 group-hover:text-blue-600 transition-colors">
                    {job.title || "Trade Service Request"}
                  </h3>

                  <p className="text-[11px] text-slate-600 line-clamp-2 leading-tight">
                    {job.description || "No description provided."}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Target Budget</span>
                    <span className="font-black text-black">
                      {job.selectedBudget || (job.estimateMin ? `£${job.estimateMin}-£${job.estimateMax}` : "Quotes Invited")}
                    </span>
                  </div>

                  <span className="text-[10px] font-black text-blue-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                    View <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

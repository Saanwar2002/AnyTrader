import React, { useEffect, useState, useMemo } from "react";
import { Navigation, LocateFixed, MapPin, Flame, Briefcase, RefreshCw, Zap, X } from "lucide-react";
import { cn, calculateDistanceMiles, getOutwardPostcode } from "@/src/lib/utils";
import { reverseLookupPostcode } from "@/src/services/postcodeService";
import { toast } from "sonner";

interface NearbyRequestsSectionProps {
  jobs: any[];
  selectedCategories?: string[];
  urgencyFilter?: string;
  onSelectCategoryFilter?: (category: string) => void;
  onSelectUrgencyFilter?: (urgency: string) => void;
  onClearDemandFilter?: () => void;
  onClearAllFilters?: () => void;
  userTradeName?: string;
  isTradesperson?: boolean;
}

export const NearbyRequestsSection: React.FC<NearbyRequestsSectionProps> = ({
  jobs,
  selectedCategories = [],
  urgencyFilter = "any",
  onSelectCategoryFilter,
  onSelectUrgencyFilter,
  onClearDemandFilter,
  onClearAllFilters,
  userTradeName,
  isTradesperson = false,
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

  // Auto-request location on mount if never set
  useEffect(() => {
    if (!userCoords && navigator.geolocation) {
      handleDetectLocation(true);
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
  const nearbyJobsWithDistance = useMemo(() => {
    return jobs.map((job) => {
      let distanceMiles: number | null = null;

      const jobLat = job.lat || job.latitude || job.location?.lat;
      const jobLng = job.lng || job.longitude || job.location?.lng;

      if (userCoords && jobLat && jobLng) {
        distanceMiles = calculateDistanceMiles(userCoords.lat, userCoords.lng, jobLat, jobLng);
      } else if (userCoords && job.postcode) {
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
    }).sort((a, b) => {
      if (a.isUrgent && !b.isUrgent) return -1;
      if (!a.isUrgent && b.isUrgent) return 1;
      if (a.distanceMiles !== null && b.distanceMiles !== null) {
        return a.distanceMiles - b.distanceMiles;
      }
      return 0;
    });
  }, [jobs, userCoords, locationName]);

  const urgentJobs = useMemo(() => nearbyJobsWithDistance.filter(j => j.isUrgent), [nearbyJobsWithDistance]);
  const urgentCountNearby = urgentJobs.length;

  // Extract top urgent trade categories for display
  const urgentCategoriesText = useMemo(() => {
    if (urgentJobs.length === 0) return "";
    const cats = Array.from(new Set(urgentJobs.map(j => j.category).filter(Boolean)));
    if (cats.length === 1) return cats[0];
    if (cats.length === 2) return `${cats[0]} & ${cats[1]}`;
    return `${cats[0]} & ${cats.length - 1} other trades`;
  }, [urgentJobs]);

  // Compute category demand breakdown directly for instant zero-latency rendering
  const demandCategories = useMemo(() => {
    const categoryMap = new Map<string, { count: number; urgentCount: number }>();

    nearbyJobsWithDistance.forEach((job) => {
      const cat = job.category || "General";
      const current = categoryMap.get(cat) || { count: 0, urgentCount: 0 };
      categoryMap.set(cat, {
        count: current.count + 1,
        urgentCount: current.urgentCount + (job.isUrgent ? 1 : 0)
      });
    });

    return Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        count: data.count,
        urgentCount: data.urgentCount,
        hasUrgent: data.urgentCount > 0
      }))
      .sort((a, b) => {
        if (a.hasUrgent && !b.hasUrgent) return -1;
        if (!a.hasUrgent && b.hasUrgent) return 1;
        return b.count - a.count;
      });
  }, [nearbyJobsWithDistance]);

  const isUrgentActive = urgencyFilter === "emergency";
  const hasDemandCategoryActive = demandCategories.some((cat) => selectedCategories.includes(cat.category));
  const hasActiveDemandFilter = isUrgentActive || hasDemandCategoryActive;

  const handleCategoryToggle = (categoryName: string) => {
    const isAlreadySelected = selectedCategories.includes(categoryName);
    const nextCategory = isAlreadySelected ? "" : categoryName;
    if (onSelectCategoryFilter) {
      onSelectCategoryFilter(nextCategory);
    }
  };

  const handleUrgentToggle = () => {
    const nextUrgency = isUrgentActive ? "any" : "emergency";
    if (onSelectUrgencyFilter) {
      onSelectUrgencyFilter(nextUrgency);
    }
  };

  const handleClearDemandFilters = () => {
    if (onClearDemandFilter) {
      onClearDemandFilter();
    } else if (onClearAllFilters) {
      onClearAllFilters();
    } else {
      if (onSelectCategoryFilter) onSelectCategoryFilter("");
      if (onSelectUrgencyFilter) onSelectUrgencyFilter("any");
    }
  };

  return (
    <div className="bg-slate-50 rounded-2xl p-3.5 sm:p-4 border border-black shadow-xs space-y-3 my-3">
      {/* Location Status Bar */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-black/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center shrink-0 shadow-xs">
            <Navigation className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-black tracking-tight truncate">
                Nearby Requests
              </h2>
              {urgentCountNearby > 0 && (
                <span className="px-2 py-0.5 bg-red-100 text-red-900 border border-red-300 rounded-full font-black text-[10px] uppercase flex items-center gap-1 shrink-0">
                  <Flame className="w-3 h-3 text-red-600 fill-red-500" />
                  {urgentCountNearby} Urgent
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-600 font-medium flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 text-blue-600 shrink-0" />
              {userCoords ? (
                <span className="truncate">
                  Demand in <strong>{locationName || "Your Area"}</strong>
                </span>
              ) : (
                <span className="truncate">Enable location for nearby demand</span>
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleDetectLocation(false)}
          disabled={isLocating}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-black rounded-xl border border-black font-extrabold text-[11px] transition-all active:scale-95 shadow-xs shrink-0 disabled:opacity-50 cursor-pointer"
        >
          {isLocating ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
              <span className="hidden sm:inline">Locating...</span>
            </>
          ) : (
            <>
              <LocateFixed className="w-3.5 h-3.5 text-emerald-600" />
              <span>{userCoords ? "Update" : "Locate"}</span>
            </>
          )}
        </button>
      </div>

      {/* Geolocation Prompt if not detected */}
      {!userCoords && (
        <div className="bg-amber-50 rounded-xl p-3 border border-amber-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <LocateFixed className="w-4 h-4 text-amber-800 shrink-0" />
            <p className="text-xs font-bold text-amber-950 truncate">
              Enable location to sort nearby trade leads instantly
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleDetectLocation(false)}
            className="px-3 py-1 bg-amber-900 text-white rounded-lg font-black text-[11px] hover:bg-black transition-all shrink-0 cursor-pointer"
          >
            Enable
          </button>
        </div>
      )}

      {/* Rearranged High-Demand Filter Pills */}
      {demandCategories.length > 0 ? (
        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-500 tracking-wider">
            <span>Tap to Filter Feed by Demand:</span>
            {hasActiveDemandFilter && (
              <button
                type="button"
                onClick={handleClearDemandFilters}
                className="text-blue-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                Clear Filter
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full">
            {/* Urgent Filter Pill */}
            {urgentCountNearby > 0 && (
              <button
                type="button"
                onClick={handleUrgentToggle}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border shadow-xs active:scale-95 shrink-0 cursor-pointer",
                  isUrgentActive
                    ? "bg-red-600 text-white border-black ring-2 ring-red-400"
                    : "bg-red-50 text-red-900 border-red-300 hover:bg-red-100"
                )}
              >
                <Flame className={cn("w-3.5 h-3.5 shrink-0", isUrgentActive ? "text-white fill-white" : "text-red-600 fill-red-500")} />
                <span>Urgent Only</span>
                <span className={cn("px-1.5 py-0.2 rounded-full text-[10px]", isUrgentActive ? "bg-red-800 text-white" : "bg-red-200/80 text-red-950")}>
                  {urgentCountNearby}
                </span>
              </button>
            )}

            {/* Category Pills */}
            {demandCategories.map((cat, i) => {
              const isSelected = selectedCategories.includes(cat.category);

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleCategoryToggle(cat.category)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border shadow-xs active:scale-95 shrink-0 cursor-pointer",
                    isSelected
                      ? "bg-slate-900 text-white border-black ring-2 ring-blue-500"
                      : cat.hasUrgent
                      ? "bg-amber-50 text-amber-950 border-amber-300 hover:bg-amber-100"
                      : "bg-white text-slate-900 border-black/10 hover:bg-slate-100"
                  )}
                >
                  {cat.hasUrgent ? (
                    <Flame className="w-3.5 h-3.5 text-amber-600 fill-amber-500 shrink-0" />
                  ) : (
                    <Briefcase className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  )}
                  <span>{cat.category}</span>
                  <span className={cn("px-1.5 py-0.2 rounded-full text-[10px]", isSelected ? "bg-slate-700 text-white" : "bg-slate-200/80 text-black")}>
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : isTradesperson && userTradeName ? (
        <div className="bg-white rounded-xl p-3 border border-black/10 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Briefcase className="w-4 h-4 text-blue-600 shrink-0" />
            <p className="text-xs font-bold text-slate-800 truncate">
              No active homeowner requests for <strong>{userTradeName}</strong> in {locationName || "your area"} right now.
            </p>
          </div>
          <span className="text-[10px] font-black uppercase text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 shrink-0">
            Live Feed
          </span>
        </div>
      ) : null}
    </div>
  );
};

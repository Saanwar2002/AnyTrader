import { collection, query, where, getDocs, db, getDoc, doc } from "@/src/firebase";

export interface SurgeZone {
  lat: number;
  lng: number;
  radius: number;
  intensity: "high" | "medium" | "low";
  label: string;
  surgeMultiplier: number;
  maxWaitTimeMins?: number;
  waitWarning?: boolean;
  extraFee?: number;
  isFixedModel?: boolean;
  uiColor?: string;
  uiOpacity?: number;
}

// Distance helper
function getDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c; 
}

export async function fetchLiveDemandZones(): Promise<SurgeZone[]> {
  try {
    const configSnap = await getDoc(doc(db, "platform_config", "rides"));
    let rules: any = {
       lowWaitMins: 5, mediumWaitMins: 10, highWaitMins: 20,
       lowFee: 1.0, mediumFee: 2.0, highFee: 3.5,
       lowMultiplier: 1.1, mediumMultiplier: 1.3, highMultiplier: 1.6,
       lowColor: "green", mediumColor: "amber", highColor: "red",
       surgeOpacity: 40
    };
    let isFixedModel = true;
    let autoSurgeEnabled = true;

    if (configSnap.exists()) {
       const cd = configSnap.data();
       if (cd.surgeRules) rules = {...rules, ...cd.surgeRules};
       if (cd.surgeModel !== undefined) isFixedModel = cd.surgeModel === "fixed";
       if (cd.surgeEnabled !== undefined) autoSurgeEnabled = cd.surgeEnabled;
    }

    if (!autoSurgeEnabled) return [];

    const ridesRef = collection(db, "ride_requests");
    const qRides = query(
      ridesRef,
      where("status", "in", ["pending", "searching", "offered", "draft"])
    );
    const rideSnapshot = await getDocs(qRides);
    const pendingRides = rideSnapshot.docs.map((d) => d.data());

    // Fetch active drivers to compare supply/demand
    const driversRef = collection(db, "live_tracking");
    const qDrivers = query(driversRef, where("isOnline", "==", true));
    const driverSnapshot = await getDocs(qDrivers);
    const onlineDrivers = driverSnapshot.docs.map((d) => d.data());

    const hotSpots = new Map<string, { rideCount: number; lat: number; lng: number, rides: any[] }>();

    pendingRides.forEach((ride) => {
      const lat = ride.pickupLat;
      const lng = ride.pickupLng;
      if (lat && lng) {
        // approx 1 mile grid
        const gridLat = Math.round(lat * 50) / 50; 
        const gridLng = Math.round(lng * 50) / 50;
        const key = `${gridLat},${gridLng}`;
        if (!hotSpots.has(key)) {
          hotSpots.set(key, { rideCount: 0, lat, lng, rides: [] });
        }
        const spot = hotSpots.get(key)!;
        spot.rideCount += 1;
        spot.rides.push(ride);
      }
    });

    const zones: SurgeZone[] = [];

    hotSpots.forEach((spot) => {
      // 1. Calculate how many drivers are nearby (within 3 miles)
      let nearbyDrivers = 0;
      onlineDrivers.forEach(driver => {
         if (driver.lat && driver.lng) {
             const dist = getDistanceMiles(spot.lat, spot.lng, driver.lat, driver.lng);
             if (dist <= 3) nearbyDrivers++;
         }
      });
      
      // 2. Calculate max wait time for pending jobs
      const now = Date.now();
      let maxWaitTimeMins = 0;
      spot.rides.forEach(r => {
         if (r.createdAt?.toMillis) {
             const waitMins = (now - r.createdAt.toMillis()) / 60000;
             if (waitMins > maxWaitTimeMins) maxWaitTimeMins = waitMins;
         }
      });
      
      // AI Logic:
      // Trigger high surge if wait times > highWaitMins, OR Demand:Supply ratio > 3:1.
      
      const ratio = nearbyDrivers > 0 ? (spot.rideCount / nearbyDrivers) : spot.rideCount;
      
      let intensity: "high" | "medium" | "low" | null = null;
      let multiplier = 1.0;
      let extraFee = 0.0;
      
      if (spot.rideCount > 1 || maxWaitTimeMins >= rules.lowWaitMins) {
         if (maxWaitTimeMins >= rules.highWaitMins || ratio > 3) {
            intensity = "high";
            multiplier = rules.highMultiplier;
            extraFee = rules.highFee;
         } else if (maxWaitTimeMins >= rules.mediumWaitMins || ratio > 2) {
            intensity = "medium";
            multiplier = rules.mediumMultiplier;
            extraFee = rules.mediumFee;
         } else if (maxWaitTimeMins >= rules.lowWaitMins || ratio >= 1) {
            intensity = "low";
            multiplier = rules.lowMultiplier;
            extraFee = rules.lowFee;
         }
      }
      
      if (intensity) {
        zones.push({
          lat: spot.lat,
          lng: spot.lng,
          radius: intensity === "high" ? 800 : intensity === "medium" ? 600 : 400,
          intensity,
          label: isFixedModel ? `£${extraFee.toFixed(2)} Surge` : `${multiplier}x Surge`, 
          surgeMultiplier: multiplier,
          maxWaitTimeMins: maxWaitTimeMins,
          waitWarning: maxWaitTimeMins >= rules.highWaitMins,
          extraFee,
          isFixedModel,
          uiColor: intensity === "high" ? (rules.highColor || "red") : intensity === "medium" ? (rules.mediumColor || "amber") : (rules.lowColor || "green"),
          uiOpacity: rules.surgeOpacity
        });
      }
    });

    if (zones.length === 0) {
      // Provide simulated default zones if empty to give drivers an idea
      zones.push({ lat: 53.6458, lng: -1.7850, radius: 800, intensity: "high", label: isFixedModel ? `£${rules.highFee.toFixed(2)} Surge` : `${rules.highMultiplier}x Surge`, surgeMultiplier: rules.highMultiplier, extraFee: rules.highFee, isFixedModel, uiColor: rules.highColor || "red", uiOpacity: rules.surgeOpacity });
      zones.push({ lat: 53.6558, lng: -1.7750, radius: 600, intensity: "medium", label: isFixedModel ? `£${rules.mediumFee.toFixed(2)} Surge` : `${rules.mediumMultiplier}x Surge`, surgeMultiplier: rules.mediumMultiplier, extraFee: rules.mediumFee, isFixedModel, uiColor: rules.mediumColor || "amber", uiOpacity: rules.surgeOpacity });
    }

    return zones.sort((a,b) => b.surgeMultiplier - a.surgeMultiplier);

  } catch (error) {
    console.error("Error fetching live demand zones:", error);
    return [
      { lat: 53.6458, lng: -1.7850, radius: 800, intensity: "high", label: "£3.50 Surge", surgeMultiplier: 1.4 },
    ];
  }
}

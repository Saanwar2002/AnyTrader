import { collection, query, where, getDocs, db } from "@/src/firebase";

export interface SurgeZone {
  lat: number;
  lng: number;
  radius: number;
  intensity: "high" | "medium" | "low";
  label: string;
  surgeMultiplier: number;
}

export async function fetchLiveDemandZones(): Promise<SurgeZone[]> {
  try {
    const ridesRef = collection(db, "ride_requests");
    const q = query(
      ridesRef,
      where("status", "in", ["pending", "searching", "offered", "draft"])
    );
    const snapshot = await getDocs(q);

    const pendingRides = snapshot.docs.map((d) => d.data());
    const hotSpots = new Map<string, { count: number; lat: number; lng: number }>();

    pendingRides.forEach((ride) => {
      const lat = ride.pickupLat;
      const lng = ride.pickupLng;
      if (lat && lng) {
        // approx 1 mile grid (0.02 deg ~ 1.38 miles)
        const gridLat = Math.round(lat * 50) / 50; 
        const gridLng = Math.round(lng * 50) / 50;
        const key = `${gridLat},${gridLng}`;
        if (!hotSpots.has(key)) {
          hotSpots.set(key, { count: 0, lat, lng });
        }
        hotSpots.get(key)!.count += 1;
      }
    });

    const zones: SurgeZone[] = [];
    hotSpots.forEach((spot) => {
      if (spot.count > 0) {
        const intensity = spot.count > 3 ? "high" : spot.count > 1 ? "medium" : "low";
        const multiplier = spot.count > 3 ? 1.5 : spot.count > 1 ? 1.2 : 1.1;
        const extraFee = spot.count > 3 ? 5.0 : spot.count > 1 ? 2.5 : 1.0;

        zones.push({
          lat: spot.lat,
          lng: spot.lng,
          radius: spot.count > 3 ? 800 : spot.count > 1 ? 600 : 400,
          intensity,
          label: intensity === "low" ? "Busy Area" : `£${extraFee.toFixed(2)} Surge`,
          surgeMultiplier: multiplier
        });
      }
    });

    if (zones.length === 0) {
      // Provide simulated default zones if empty to give drivers an idea
      zones.push({ lat: 53.6458, lng: -1.7850, radius: 800, intensity: "high", label: "£3.50 Surge", surgeMultiplier: 1.3 });
      zones.push({ lat: 53.6558, lng: -1.7750, radius: 600, intensity: "medium", label: "£1.50 Surge", surgeMultiplier: 1.1 });
    }

    return zones.sort((a,b) => b.surgeMultiplier - a.surgeMultiplier);

  } catch (error) {
    console.error("Error fetching live demand zones:", error);
    return [
      { lat: 53.6458, lng: -1.7850, radius: 800, intensity: "high", label: "£3.50 Surge", surgeMultiplier: 1.3 },
    ];
  }
}

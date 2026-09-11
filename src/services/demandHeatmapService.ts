import { collection, query, where, getDocs, db } from "@/src/firebase";
import { getOutwardPostcode } from "@/src/lib/utils";

export interface RegionalDemand {
  area: string;
  jobCount: number;
  intensity: number; // 0 to 1 scale
  topCategory: string;
  totalEstimate: number;
}

export async function getRegionalDemandData(category?: string): Promise<RegionalDemand[]> {
  try {
    const jobsRef = collection(db, "public_job_cards");
    let q = query(jobsRef, where("status", "==", "posted"));
    
    if (category) {
      q = query(q, where("category", "==", category));
    }

    const snapshot = await getDocs(q);
    const areaMap: Record<string, { count: number; value: number; categories: Record<string, number> }> = {};

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const area = data.postcodeArea || getOutwardPostcode(data.postcode) || data.area || "Local Area";
      const cat = data.category || "General";
      const value = (data.estimateMax || 0) + (data.estimateMin || 0) / 2;

      if (!areaMap[area]) {
        areaMap[area] = { count: 0, value: 0, categories: {} };
      }
      
      areaMap[area].count++;
      areaMap[area].value += value;
      areaMap[area].categories[cat] = (areaMap[area].categories[cat] || 0) + 1;
    });

    const results: RegionalDemand[] = Object.entries(areaMap).map(([area, stats]) => {
      const topCategory = Object.entries(stats.categories).sort((a, b) => b[1] - a[1])[0][0];
      return {
        area,
        jobCount: stats.count,
        intensity: 0, // Calculated below
        topCategory,
        totalEstimate: stats.value
      };
    }).sort((a, b) => b.jobCount - a.jobCount).slice(0, 10); // Top 10 hot zones

    const maxJobs = Math.max(...results.map(r => r.jobCount), 1);
    
    return results.map(r => ({
      ...r,
      intensity: r.jobCount / maxJobs
    }));
  } catch (error) {
    console.error("Error fetching regional demand:", error);
    return [];
  }
}


import { getOutwardPostcode } from "@/src/lib/utils";
import { getApiUrl } from "@/src/lib/apiUrl";

export interface PostcodeData {
  postcode: string;
  city: string;
  area: string; // New field: "HD6 Huddersfield"
  county: string;
  country: string;
  region: string;
  latitude: number;
  longitude: number;
}

/**
 * Fetches location data for a given UK postcode using postcodes.io
 * @param postcode The UK postcode to look up
 * @returns PostcodeData object or null if not found
 */
export const lookupPostcode = async (postcode: string): Promise<PostcodeData | null> => {
  if (!postcode) return null;
  
  // Basic UK postcode regex for quick validation before API call
  const ukPostcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i;
  if (!ukPostcodeRegex.test(postcode)) return null;

  const key = `pc_${postcode.toUpperCase().replace(/\s/g, '')}`;
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    console.warn("Failed to read from sessionStorage:", e);
  }

  try {
    // Attempt cached proxy fetch via server first
    let response = await fetch(getApiUrl(`/api/postcode/${encodeURIComponent(postcode)}`));
    if (!response.ok) {
      // Fallback to direct API if backend is unreachable or returns an error
      response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
    }
    
    if (!response.ok) return null;

    const data = await response.json();
    if (data.status === 200 && data.result) {
      const result = formatPostcodeData(data.result);
      try {
        sessionStorage.setItem(key, JSON.stringify(result));
      } catch (e) {
        console.warn("Failed to write to sessionStorage:", e);
      }
      return result;
    }
  } catch (error) {
    console.warn("Proxy postcode lookup failed, falling back to direct flight:", error);
    try {
      const fallbackResponse = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
      if (fallbackResponse.ok) {
        const data = await fallbackResponse.json();
        if (data.status === 200 && data.result) {
          const result = formatPostcodeData(data.result);
          try {
            sessionStorage.setItem(key, JSON.stringify(result));
          } catch (e) {
            console.warn("Failed to write to sessionStorage:", e);
          }
          return result;
        }
      }
    } catch (fallbackError) {
      console.error("All postcode lookups exhausted:", fallbackError);
    }
  }
  
  return null;
};

/**
 * Fetches location data for a given latitude and longitude using postcodes.io
 * @param lat Latitude
 * @param lon Longitude
 * @returns PostcodeData object or null if not found
 */
export const reverseLookupPostcode = async (lat: number, lon: number): Promise<PostcodeData | null> => {
  try {
    const response = await fetch(`https://api.postcodes.io/postcodes?lat=${lat}&lon=${lon}`);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.status === 200 && data.result && data.result.length > 0) {
      return formatPostcodeData(data.result[0]);
    }
  } catch (error) {
    console.error("Reverse postcode lookup failed:", error);
  }
  
  return null;
};

const formatPostcodeData = (res: any): PostcodeData => {
  // Extract the outward postcode (e.g., "HD6" from "HD6 4TF")
  const outwardPostcode = getOutwardPostcode(res.postcode);
  
  // Helper to filter out undesirable area names like 'Kirklees'
  const isValidCity = (name: string) => name && !name.toLowerCase().includes('kirklees');

  // Determine the best area name, filtering out invalid ones
  const areaName = [res.parish, res.admin_district, res.town].find(isValidCity) || "";
  
  // Combine them for a more descriptive location
  const descriptiveLocation = `${outwardPostcode} ${areaName}`.trim();

  return {
    postcode: res.postcode,
    city: areaName,
    area: descriptiveLocation,
    county: res.admin_county || res.region || "",
    country: res.country,
    region: res.region,
    latitude: res.latitude,
    longitude: res.longitude
  };
};

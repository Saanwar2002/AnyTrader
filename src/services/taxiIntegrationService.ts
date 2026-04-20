import { collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/src/firebase';
import ngeohash from 'ngeohash';

// Higher precision = smaller area (precision 5 is ~4.9km x 4.9km)
const GEOHASH_PRECISION = 5;

export function getEmergencyRideRequestsQuery() {
  return query(
    collection(db, 'ride_requests'),
    where('urgency', '==', 'emergency'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );
}

/**
 * Generates a geohash for a given location.
 */
export function generateGeohash(latitude: number, longitude: number): string {
  return ngeohash.encode(latitude, longitude, GEOHASH_PRECISION);
}

/**
 * Gets the range of geohashes to query based on location.
 * Given a geohash, it returns the hash and its neighbors to cover the immediate area.
 */
export function getQueryableGeohashes(latitude: number, longitude: number): string[] {
  const hash = generateGeohash(latitude, longitude);
  const neighbors = ngeohash.neighbors(hash);
  return [hash, ...neighbors];
}

import { collection, query, where, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/src/firebase';
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
 * Assigns a driver to a ride request.
 */
export async function assignDriverToRide(rideId: string, driverId: string) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not authenticated");

  const response = await fetch('/api/rides/accept', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ rideId })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to accept ride");
  }
}

/**
 * Marks a ride as 'in_transit' after pickup.
 */
export async function pickupRider(rideId: string) {
  const rideRef = doc(db, 'ride_requests', rideId);
  await updateDoc(rideRef, {
    status: 'in_transit',
    pickedUpAt: serverTimestamp(),
  });
}

/**
 * Completes a ride (Handshake simulation).
 */
export async function completeRideWithHandshake(rideId: string, driverId: string) {
  const rideRef = doc(db, 'ride_requests', rideId);
  const driverRef = doc(db, 'driver_status', driverId);

  await updateDoc(rideRef, {
    status: 'completed',
    completedAt: serverTimestamp(),
    handshakeVerified: true,
  });

  await updateDoc(driverRef, {
    status: 'online',
    currentRideId: null,
    lastActiveAt: serverTimestamp(),
  });
}

/**
 * Cancels a ride request.
 */
export async function cancelRide(rideId: string, driverId?: string) {
  const rideRef = doc(db, 'ride_requests', rideId);
  await updateDoc(rideRef, {
    status: 'cancelled',
    cancelledAt: serverTimestamp(),
  });

  if (driverId) {
    const driverRef = doc(db, 'driver_status', driverId);
    await updateDoc(driverRef, {
      status: 'online',
      currentRideId: null,
      lastActiveAt: serverTimestamp(),
    });
  }
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

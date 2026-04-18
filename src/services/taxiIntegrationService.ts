import { collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/src/firebase';

export function getEmergencyRideRequestsQuery() {
  return query(
    collection(db, 'ride_requests'),
    where('urgency', '==', 'emergency'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );
}

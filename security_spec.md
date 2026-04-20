# Security Spec for Taxi Integration

## 1. Data Invariants
- A `TaxiRide` cannot exist without a valid `riderId` and `passengerId` (must match).
- A `DriverLocation` is immutable by anyone except the authorized driver.
- A `DriverLocation` update MUST include a valid `geohash` and `updatedAt` server timestamp.

## 2. The "Dirty Dozen" Payloads (Examples)
1. Creating a ride with another user's ID as `riderId` -> Should fail.
2. Updating `driverId` on a ride without being an Admin -> Should fail.
3. Setting `status` to "completed" without `totalFare` -> Should fail.
4. Setting a 1MB string as `rideId` (Poisoning) -> Should fail.
5. Updating `DriverLocation` with a future `updatedAt` -> Should fail.
6. Attempting to list all `ride_requests` without being Admin -> Should fail (must filter).
7. Setting `totalFare` to a negative number -> Should fail.
8. Updating a `TaxiRide` status while already marked "completed" (Terminal State) -> Should fail.
9. Injecting a "Ghost Field" (e.g., `isVerified: true`) into `TaxiRide` -> Should fail.
10. Spoofing `passengerId` in `TaxiRide` create -> Should fail.
11. Updating `live_tracking` with someone else's `driverId` -> Should fail.
12. Creating a `ride_requests` without `createdAt` (Server Timestamp) -> Should fail.

## 3. Test Runner
Will be implemented in `firestore.rules.test.ts`.

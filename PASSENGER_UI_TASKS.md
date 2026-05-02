# Passenger UI Overhaul - Implementation Checklist

## Phase 1: Reorganization & Foundation
- [x] **Restructure Folders**: Move `PassengerBooking.tsx` out of `src/components/driver/` and into a dedicated `src/components/passenger/` directory.
- [x] **Routing & Layout**: Create a `PassengerLayout` with a consumer-friendly bottom navigation bar, and establish dedicated routes (e.g., `/ride`, `/ride/history`).
- [x] **Theme Alignment**: Ensure the consumer app uses a clean, modern aesthetic distinct from the dark/dense driver terminal.

## Phase 2: Refined Home & Search Experience (Skipped per user request)
- [x] **Passenger Home Screen**: Build a landing view featuring a live map, a prominent "Where to?" input, and quick-access chips for "Home", "Work", and recent destinations.
- [x] **Location Search Enhancements**: Improve the pickup and dropoff input flow to handle suggestions smoothly, ensuring it feels like a premium ride-hailing app.
- [x] **Fare Estimation Engine**: Ensure the category selection (Standard, Executive, etc.) accurately updates the estimated price and ETA on the frontend.

## Phase 3: Active Ride & Live Tracking UX (Skipped per user request)
- [x] **Fluid Booking Transitions**: Polish the animations moving from `details` -> `searching` -> `confirmed`.
- [x] **Live Map Enhancements**: Improve driver tracking UI, displaying the driver's profile, vehicle details, and a real-time ETA countdown.
- [x] **Mid-Ride Actions**: Refine the chat/call UI buttons and implement a clear "Cancel Ride" flow with warnings about cancellation fees.

## Phase 4: History, Receipts & Support
- [x] **Ride History List**: Build a dedicated view (`PassengerRideHistory.tsx`) displaying a chronological list of past rides.
- [x] **Standalone Receipt View**: Implement functionality to click into any past ride and view the detailed receipt breakdown (reusing the receipt UI built recently).
- [x] **Support Integration**: Add quick links to "Report an issue" or "Find a lost item" for past rides.

## Phase 5: Account & Payment Management
- [x] **Passenger Profile**: Build a view for users to update their personal details, profile picture, and view their rider rating.
- [x] **Payment Methods**: Create a wallet interface to manage linked cards and view existing balance or travel credits.
- [x] **Saved Places Management**: Allow users to update their saved "Home" and "Work" coordinates visually on a map.

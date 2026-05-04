# AnyTrader Mobile App (Capacitor) Pre-Check List

As we prepare to wrap the AnyTrader web application into native iOS and Android apps using Capacitor, here is a breakdown of the features we've built, the potential challenges, and the native Capacitor plugins we will likely need to integrate to ensure everything works flawlessly on real mobile devices.

## 1. AI Voice Booking (Gemini + Speech Recognition)
- **Current State:** Uses the browser's native `SpeechRecognition` web API.
- **Mobile Consideration:** Web-based SpeechRecognition can be unreliable or completely unsupported in mobile WebViews (especially iOS WKWebView).
- **Action Required:** We will need to replace or supplement the web API with a native Capacitor speech-to-text plugin (e.g., `@capacitor-community/speech-recognition`) to ensure reliable voice recording and transcription on both iOS and Android.

## 2. Geolocation & Live Map Tracking
- **Current State:** Uses HTML5 Geolocation API (`navigator.geolocation`) for picking up the user's location and live driver tracking.
- **Mobile Consideration:** Native apps require explicit location permissions. Additionally, for drivers, we may need **background location** tracking so their position updates even when the app is minimized.
- **Action Required:** Integrate `@capacitor/geolocation` for foreground, and potentially a background geolocation plugin for driver apps. We must also configure `Info.plist` (iOS) and `AndroidManifest.xml` (Android) with detailed explanations for why location is needed.

## 3. Facial Verification & ID Upload (Camera)
- **Current State:** Standard HTML `<input type="file" accept="image/*" capture="environment">`.
- **Mobile Consideration:** While this works in WebViews, using the native camera UI provides a better UX.
- **Action Required:** Integrate `@capacitor/camera` for taking photos directly through the native interface to provide a seamless verification experience.

## 4. Notifications
- **Current State:** In-app visual notifications (using libraries like `sonner`).
- **Mobile Consideration:** To alert users/drivers when they are not actively looking at the app (e.g., driver receives a new job, user gets "driver has arrived" alert).
- **Action Required:** Integrate `@capacitor/push-notifications` (for remote Firebase Cloud Messaging) and `@capacitor/local-notifications`. We will need to configure APNs (Apple) and FCM (Firebase) to handle push events natively.

## 5. Stripe Payments
- **Current State:** QR-code payments or web-based checkout flows. 
- **Mobile Consideration:** Standard Stripe Checkout can work via web redirects or webviews, but a native UI (Apple Pay / Google Pay integration) drives higher conversion.
- **Action Required:** Consider migrating to the `@capacitor-community/stripe` plugin to enable deep integration with Apple Pay and Google Pay native wallets.

## 6. Real-Time Interactions & Offline State
- **Current State:** Real-time listeners via Firebase Firestore. 
- **Mobile Consideration:** Mobile connections can drop unexpectedly.
- **Action Required:** Ensure `@capacitor/network` is used to detect connectivity changes and alert the user smoothly (e.g., "You are offline. Reconnecting...").

## 7. General Mobile Polish (Hardware & Status Bar)
- **Action Required:** 
    - Include `@capacitor/status-bar` to style the iOS/Android status bars correctly.
    - Include `@capacitor/keyboard` to ensure inputs (like addressing or commenting) don't get hidden behind the virtual keyboard.
    - Ensure safe-area paddings (notches, home bars) are correctly enforced in Tailwind (`env(safe-area-inset-bottom)`).

### Summary
The Gemini AI features will continue to work perfectly as they rely on API calls, but the **hardware interfaces** (Microphone for Voice AI, Location for maps, Camera for ID) will need dedicated Capacitor plugins for the best native app experience.

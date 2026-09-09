# 🚀 AnyTrader Launch Checklist

This document outlines the critical technical steps required to move AnyTrader from development to a live production environment with a custom domain.

## 1. Domain & Hosting Setup
- [x] **Purchase Domain**: Buy your domain (e.g., `anytrader.co.uk`) from a registrar like Cloudflare, Namecheap, or Squarespace.
- [ ] **Deploy to Cloud Run**: Use the "Deploy" button in AI Studio to push the final build to Google Cloud Run.
- [ ] **Map Custom Domain**:
    - Go to [Google Cloud Console](https://console.cloud.google.com/).
    - Navigate to **Cloud Run** > [Your Service] > **Manage Custom Domains**.
    - Add your domain and update your DNS records (A/AAAA/CNAME) as instructed by Google.

## 2. Firebase Production Configuration
- [ ] **Authorize Production Domain**:
    - Go to [Firebase Console](https://console.firebase.google.com/).
    - Navigate to **Authentication** > **Settings** > **Authorized Domains**.
    - Add your live domain (e.g., `anytrader.co.uk`) and any staging domains.
- [ ] **Verify Firestore Rules**:
    - Ensure `firestore.rules` are deployed and tested against the "Devil's Advocate" attack vectors.
    - Run `npm run deploy-rules` (if configured) or use the `deploy_firebase` tool in AI Studio one last time.
- [ ] **Check Quotas**: Ensure your Firebase project is on the **Blaze (Pay-as-you-go)** plan to avoid "Quota Exceeded" errors during high traffic.

## 3. API Key & Secret Management
- [ ] **Gemini API**: Ensure `GEMINI_API_KEY` is set in the production environment variables.
- [ ] **Google Maps**:
    - Create a dedicated API Key in [Google Cloud Console](https://console.cloud.google.com/google/maps-apis/credentials).
    - **CRITICAL**: Restrict the key to your specific domain to prevent unauthorized use.
    - Add the key to AI Studio Settings.
- [ ] **Other Integrations**: Verify keys for Stripe, Twilio, or any other 3rd party services are correctly set in the environment.

## 4. Capacitor / Mobile App Configurations
- [x] **Remove Live Testing URL**: 
    - Verified `capacitor.config.json`.
    - Development URLs and cleartext traffic have been stripped. The native container serves bundled production assets and uses deep linking (`anytrader://`).

## 5. Final Application Audit
- [ ] **Clear Test Data**: Flush development/mock audit logs and delete test users/jobs from the Firestore database prior to live customer onboarding.
- [ ] **Verify Super Admin Claims & Roles**:
    - Ensure your admin user account has the `admin` custom claim assigned via `npx tsx scripts/set-admin-claim.ts <your-email-or-uid>` or exists in `/admins/{adminId}`.
    - Confirm access to `/admin` (`MasterAdminLayout.tsx`). Note: Hardcoded emails have been superseded by custom claims, Firestore admin records, and configurable admin email lists.
- [ ] **Mobile Responsiveness**: Verify the live preview and custom domain on mobile devices (viewport safe-area insets, keyboard height compensation, bottom navigation spacing).
- [ ] **Performance Check**: Verify route lazy-loading and dynamic imports (all 35+ routes in `App.tsx` use `lazyWithRetry`).

## 6. Post-Launch Monitoring
- [ ] **Error Tracking**: Monitor the Master Admin "Audit Logs" and Cloud Run logs for any unauthorized access or 4xx/5xx spikes.
- [ ] **User Feedback**: Ensure the in-app support flow and email alerts are active for new signups.
- [ ] **AI Insights & Telemetry**: Check unmatched search telemetry and AI Recommendation logs to monitor trade matching accuracy.

---
*Last Updated: 2026-09-09 (V6 Release Candidate)*

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
- [ ] **Remove Live Testing URL**: 
    - Open `capacitor.config.json`.
    - **CRITICAL**: Remove the `server.url` and `server.cleartext` properties before running your production build. Leaving these in will cause the app to load your development server instead of the bundled production files.

## 5. Final Application Audit
- [ ] **Clear Test Data**: Flush audit logs and delete "Test" users/jobs from the Admin Dashboard.
- [ ] **Check "Super Admin" Access**: Confirm that your email (`saanwar2002@gmail.com`) is correctly hardcoded in `firestore.rules` and `AdminDashboard.tsx`.
- [ ] **Mobile Responsiveness**: Test the live URL on multiple mobile devices.
- [ ] **Performance Check**: Ensure images are optimized and the app loads within < 3 seconds.

## 6. Post-Launch Monitoring
- [ ] **Error Tracking**: Monitor the Admin Dashboard "Audit Logs" for any "Permission Denied" errors.
- [ ] **User Feedback**: Set up a support email or feedback form for early users.
- [ ] **AI Insights**: Regularly check the "AI Platform Insights" tab to monitor marketplace health.

---
*Last Updated: 2026-04-15*

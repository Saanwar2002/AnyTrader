# Early Stage Financial Projections (AnyRoller Taxi Operations)

**Scenario Parameters (Daily Basis):**
- **Active Drivers:** 100
- **Shift Duration:** 24-Hour Cycle
- **Average Jobs per Driver:** 20
- **Total Jobs Completed:** 2,000
- **Average Fare/Job:** £8.00
- **Total Gross Volume:** £16,000
- **Platform Commission:** 12%

---

## 1. Revenue Breakdown (Daily)

| Metric | Calculation | Amount |
| :--- | :--- | :--- |
| **Total Gross Volume** | 2,000 jobs × £8.00 | **£16,000.00** |
| **Driver Earnings (88%)** | £16,000 × 88% | **£14,080.00** |
| **Platform Gross Revenue (Inc. VAT)**| £16,000 × 12% | **£1,920.00** |
| **VAT to HMRC (20%)** | £1,920 - (£1,920 / 1.2) | **-£320.00** |
| **Platform Revenue (Ex. VAT)** | £1,920 / 1.2 | **£1,600.00** |

*Note: VAT is calculated on the platform's 12% fee, assuming it is VAT inclusive. Operational costs like Stripe fees are generally VAT exempt or zero-rated, while SaaS (Maps/Firebase) VAT can be reclaimed.*

---

## 2. Operational Cost Breakdown (Daily Estimates)

### A. Stripe Payment Processing & Connect Fees
Stripe charges are the largest operational cost because they are a mixture of percentage-based and fixed-transaction fees.
- **Card Processing Fee (UK standard 1.5%):** 1.5% of £16,000 = **£240.00**
- **Fixed Transaction Fee (20p per job):** 2,000 jobs × £0.20 = **£400.00**
- **Stripe Connect Payout Fees:** ~£10.00 (Assuming daily payouts to 100 drivers at 10p/payout) + minor active account fractions.
- **Total Payment Costs:** **~£655.00**

### B. Google Maps Platform
Ride-hailing utilizes heavy location queries.
- **Places/Autocomplete (Pickup & Drop-off):** 4,000 requests/day
- **Directions API (Quotes & Real-time ETA):** 4,000 requests/day
- **Geocoding & Static Maps:** 2,000 requests/day
- **Total Maps Cost:** **~£100.00** ($128 USD approx.)

### C. Backend Infrastructure (Firebase + Google Cloud)
Firebase operates on a usage-based tier (writes/reads).
- **Driver Live Tracking:** 100 drivers pinging locations every 10 seconds for 24 hours yields ~864,000 Firestore writes ($1.50 USD).
- **Rider App Reads:** Passengers tracking the driver's approach.
- **Cloud Functions / Cloud Run:** Server logic execution.
- **Total Infrastructure Cost:** **~£5.00** (Firestore is extremely optimized).

### D. Communications (Twilio OTPs & Masked Calls)
- **SMS / Verification / Notifications:** Depending on usage, assume 20-30% of jobs require masked SMS or verification calls.
- **Total Comms Cost:** **~£40.00**

**Total Operational Daily Costs:** **~£800.00**

---

## 3. Net Margin & Profitability (After VAT & Taxes)

| Metric | Daily Amount | Monthly Projection (30 Days) |
| :--- | :--- | :--- |
| **Platform Revenue (Ex. VAT)** | **£1,600.00** | **£48,000.00** |
| **Total Operational Cost** | -£800.00 | -£24,000.00 |
| **Gross Profit (Before Corp Tax)** | **£800.00** | **£24,000.00** |
| **UK Corporation Tax (Est. 25%)** | -£200.00 | -£6,000.00 |
| **Final Net Profit (Take-Home)** | **£600.00** | **£18,000.00** |

---

## Total Breakdown Summary (Per £16,000 Daily Gross Volume)
- **Drivers Take:** £14,080.00 (88.0%)
- **Stripe & Ops Costs:** £800.00 (5.0%)
- **HMRC (VAT + Corp Tax):** £520.00 (3.25%) -> *£320 VAT + £200 Corp Tax*
- **Platform Net Profit:** £600.00 (3.75%)

---

## Key Takeaways
1. **The "20p Problem":** At lower average fares (£8), Stripe's flat 20p transaction fee heavily impacts margins. If average fares rise to £15, your platform commission doubles (to £3,840) while the £400 fixed transaction cost stays exactly the same, massively boosting profit margins.
2. **Infrastructure is Cheap:** Firebase and Google Cloud scale beautifully. Your servers and database will rarely be the bottleneck for profitability.
3. **VAT Reality:** Factoring in the UK VAT regime shrinks the margin, making payment processor optimization even more crucial.

---

## Payment Processor Alternatives for UK Marketplaces (Long-Term Solutions)

While Stripe Connect is the gold standard for getting a split-payment marketplace off the ground quickly, it is expensive at scale. As AnyRoller grows, you can consider these viable long-term UK alternatives:

### 1. Adyen (Adyen for Platforms)
- **Best For:** Scale and Enterprise operations. Uber, Bolt, and many large platforms use Adyen.
- **Pros:** Massively cheaper at scale. They negotiate deeply discounted fixed fees (e.g., dropping the 20p to 5p-10p). Excellent unified commerce capabilities.
- **Cons:** Very strict compliance and long onboarding. You usually need substantial existing volume to be accepted. Harder to integrate than Stripe.

### 2. Mangopay
- **Best For:** European marketplaces.
- **Pros:** Built specifically for marketplaces with an escrow model. Their pricing is often more competitive than Stripe for high volumes, and they handle UK/EU compliance exceptionally well.
- **Cons:** Developer experience and API docs aren't as polished as Stripe's.

### 3. Checkout.com
- **Best For:** Fast-growing UK fintechs and platforms.
- **Pros:** Native UK company with excellent clearing speeds and modular payment flows. Generally offers better custom pricing than Stripe.
- **Cons:** Less "out of the box" automated KYC/onboarding for drivers compared to Stripe Connect's pre-built Express dashboard.

### 4. Direct/Open Banking integration (e.g., TrueLayer)
- **Best For:** Wallet top-ups.
- **Details:** If riders maintain an "AnyRoller Wallet" rather than paying per ride, you can let them top up via Open Banking (bank transfer). This costs literal pennies per transaction, completely avoiding Visa/Mastercard interchange fees. 

**Recommendation:** Stick with Stripe Connect for launch and the first 6-12 months. Once you have a proven transaction volume (e.g., £500k+ per month passing through), take that volume data to **Adyen** or **Checkout.com** to negotiate heavily discounted custom enterprise rates.

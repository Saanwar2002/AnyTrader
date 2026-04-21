# AnyRide Driver Mobile UI — Complete Spec
"Beat Uber on transparency. Beat Bolt on intelligence. Beat both with AnyTrader."

## Design Philosophy
| Principle | Why | How |
| :--- | :--- | :--- |
| Money-first | Drivers are motivated by earnings. Every screen should reinforce progress. | Sticky earnings bar, goal progress, commission transparency on every ride |
| Map-second | Context matters — but earnings matter more than a pretty map | Map takes 50% of home, not 70%. Earnings/stats take the rest. |
| One-thumb rule | Phone is mounted on windscreen. Driver uses one thumb while stationary. | All primary actions at bottom half of screen. No top-corner buttons for critical flows. |
| 2-second glanceable | Driver glances at red lights. Can't read paragraphs. | Big numbers, colour-coded badges, minimal text |
| Dark mode default | Night driving, glare reduction, battery saving | Dark theme primary. Light mode optional in settings. |
| Transparent | Uber hides commission. We show everything. Trust = retention. | Fare breakdown on every ride. Commission shown everywhere. Savings CTAs tied to real numbers. |
| Cross-platform | No competitor can link rides to trade jobs. This is the moat. | AnyTrader widget persistent, context-aware, revenue-generating |

## Bottom Navigation (All Screens)
4 tabs only. Not 5.

| Tab | Contents |
| :--- | :--- |
| Home | Map, demand, go online/offline, earnings bar, bonus tracker, cross-sell widget |
| Earnings | All money in one place. Today/week/month. Commission breakdown. Tips. Payouts. Tax reports. Goal settings. |
| Inbox | Ride messages, platform notifications, doc expiry alerts, AnyTrader lead alerts |
| Menu | Profile, vehicle & docs, subscription, analytics, availability, settings, AnyTrader link, help |

## Screen 1: Home — Offline State
Answers 3 questions instantly: How much have I made? Where's the demand? Should I go online?

- **Sticky Earnings Bar**: Always visible (`£142.60`, `8 rides`, `5h`, `Goal progress: 71%`).
- **Demand Map**: Colour zones (🔴 HIGH, 🟡 MODERATE, 🟢 LOW).
- **Smart Tip**: "Head to Huddersfield Centre for 1.4x surge"
- **Active Bonus**: Progress bar (e.g., "Complete 2 more rides by 2pm → +£15 extra").
- **AnyTrader Cross-sell Widget**: "3 trade leads near you. Avg £45/job".
- **Go Online Button**: Big, green, 56px height, full width.

## Screen 2: Home — Online & Waiting
- **Sticky Earnings Bar**: Adds "🟢 ONLINE · 12 min" indicator.
- **Map**: Centers on driver with live GPS and surge overlay.
- **Session Stats**: Acceptance rate, Rating today, Avg fare, Rides/hour.
- **Go Offline Button**: Big, red, full width.

## Screen 3: Incoming Ride Request
Full-screen overlay. 15 seconds.
- **Fare First**: BIG text for total fare and "You earn" (after commission). Surge badge if active.
- **Timer**: Circular countdown ring.
- **Client**: Name, Rating.
- **Details**: Pickup (Distance + time to pickup), Drop-off (Trip duration + distance).
- **Fare Breakdown**: Expandable (Base, Distance, Time, Surge, Commission -> YOUR TAKE).
- **Accept Ride Button**: BIG green button.
- **Decline Button**: Small text link.

## Screen 4: En Route to Pickup
Minimal UI, navigation-focused.
- **ETA & Fare Reminder**: Keeps driver motivated.
- **Turn-by-turn Map**: Clear navigation instructions.
- **Client Info**: Shows pickup address, rider notes, call/message options.
- **Arrived at Pickup Button**: Large, easy to tap.

## Screen 5: Waiting at Pickup
- **Timers**: Wait time (counting up), Free cancel countdown.
- **Client Info**: Re-displayed with contextual tips (e.g., "Flash headlights").
- **Rider is in the car Button**: Starts the trip.

## Screen 6: Trip in Progress
- **ETA & Route**: Live updates to drop-off.
- **Fare**: Continues to be visible.
- **Drop-off Details**: Rider notes shown before arrival.
- **Bonus Progress Hint**: e.g., "This ride completes your +£15 bonus!"
- **Complete Trip Button**: Tap on arrival.

## Screen 7: Trip Completed — Earnings + Rating
The dopamine screen.
- **Earned Amount**: Big animated count-up.
- **Fare Breakdown**: Shows commission transparency and upgrade nudges ("Pro saves £0.77 on THIS ride").
- **Rating**: 5-star rating for the rider.
- **Bonus Unlocked**: Confetti animation if a bonus was hit.
- **Today So Far**: Running total updated.

## Screen 8: Earnings Tab (💰)
One place for all money.
- **This Week**: Big number (after commission), goal progress, period toggle (Today/Week/Month).
- **Daily Breakdown**: Bar chart with details.
- **Money Breakdown**: Gross fares, Surge, Tips, Bonuses minus Commission and Fees = Net Earnings.
- **Upgrade Comparison**: Math-based showing exact monthly savings on Pro.
- **Payouts & Goals**: Bank preview, tax reports, custom goal setting.

## Screen 9: Rides History
- **Every Ride**: Shows Fare, Commission, Surge, and Your Earnings. No more hidden commissions.

## Screen 10: Inbox Tab (📬)
Filtered inbox: All | Rides | Alerts | AnyTrader
- Alerts highlight important things (like MOT expiry).
- AnyTrader leads and Ride messages properly separated.

## Screen 11: Menu Tab (☰)
- **Profile**: Rating, Tier, Lifetime stats.
- **Driving**: Vehicle & Docs (alerts), Analytics, Availability Hours, Bonuses.
- **Money**: Subscription (showing value), Payouts, Tax.
- **AnyTrader**: Trade Profile, Home Services.
- **Account**: Settings, Privacy, Help.
- **Referrals**: Earn £25.

## Screen 12: Vehicle & Documents
- Colour-coded status per document (Green/Orange/Red).
- Days remaining countdown.
- **Proactive mechanic cross-sell** from AnyTrader (unique advantage).

## Screen 13: Analytics
- Performance overview (Rating, Acceptance, Cancellation, Resp time).
- Peak hours heatmap (Personalized).
- Earnings per hour + Gamification ("Top 15% in area").
- Top earning routes and trend graphs.

## Screen 14: Subscription Page
- Dynamic page showing actual savings based on the driver's real rides.
- Clear comparison between current tier and higher tiers (e.g., "Elite saves £38.01/mo at your volume").
- Real numbers = retention.

## Screen 15: Availability Hours
- Set scheduled driving hours.
- Demand forecasts per slot ("High demand 8am & 6pm").
- Gap suggestions to earn more.

## Screen 16: Referral Page
- Earn £25 per referral. Status tracking for each invited user.

## Dark Mode Colour Palette
- **Primary BG**: `#0D0D0F`
- **Secondary BG**: `#1A1A1E`
- **Tertiary BG**: `#252529`
- **Primary Text**: `#FFFFFF`
- **Accent Green**: `#00D26A`
- **Accent Red**: `#FF3B30`
- **Accent Orange**: `#FF9500`
- **Accent Blue**: `#007AFF`

## Haptics
Context-aware vibrations for requests, completions, navigation, and warnings.

import { db, collection, query, onSnapshot, doc, updateDoc, setDoc, addDoc, getDoc, serverTimestamp, orderBy, limit, where } from "@/src/firebase";

export interface ThresholdRuleConfig {
  maxRegistrationsPer15m: number;
  maxAiInvocationsPerMin: number;
  maxAiInvocationsPer5Min: number;
  maxFlashDealsPerHour: number;
  maxDiscountPercentageThreshold: number;
  maxDealClaimsPer2Min: number;
  maxDisputesPer24h: number;
  enableToastAlerts: boolean;
  enableAudioChime: boolean;
  enableEmailAlerts: boolean;
  adminAlertEmail: string;
  minSeverityForEmail: "ALL" | "HIGH_AND_CRITICAL" | "CRITICAL_ONLY";
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_THRESHOLD_RULES: ThresholdRuleConfig = {
  maxRegistrationsPer15m: 3,
  maxAiInvocationsPerMin: 15,
  maxAiInvocationsPer5Min: 35,
  maxFlashDealsPerHour: 4,
  maxDiscountPercentageThreshold: 75,
  maxDealClaimsPer2Min: 3,
  maxDisputesPer24h: 2,
  enableToastAlerts: true,
  enableAudioChime: true,
  enableEmailAlerts: true,
  adminAlertEmail: "saanwar2002@gmail.com",
  minSeverityForEmail: "HIGH_AND_CRITICAL",
};

export interface ActiveBreachAlert {
  id: string;
  breachType: 
    | "multiple_profile_creations" 
    | "rapid_api_usage" 
    | "deals_misuse" 
    | "abnormal_dispute_rate" 
    | "off_platform_circumvention" 
    | "security_exploit";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  description: string;
  detectedAt: string;
  targetEntity: {
    userId?: string;
    userName?: string;
    userEmail?: string;
    dealId?: string;
    dealTitle?: string;
    ipOrDevice?: string;
    role?: string;
  };
  metrics: {
    observedValue: number;
    thresholdLimit: number;
    unit: string;
    timeWindow: string;
  };
  evidence: Record<string, any>;
  suggestedActions: {
    label: string;
    action: "freeze_account" | "revoke_deal" | "throttle_ai" | "flag_kyc" | "dismiss";
    danger?: boolean;
  }[];
  status: "new" | "investigating" | "mitigated" | "dismissed";
  emailDispatched?: boolean;
  toastDisplayed?: boolean;
}

// In-memory cooldown tracker to prevent repeated notifications for the same breach within 5 minutes
const alertCooldownMap = new Map<string, number>();

function isUnderCooldown(key: string, cooldownSeconds: number = 300): boolean {
  const lastFired = alertCooldownMap.get(key);
  if (!lastFired) {
    alertCooldownMap.set(key, Date.now());
    return false;
  }
  if (Date.now() - lastFired > cooldownSeconds * 1000) {
    alertCooldownMap.set(key, Date.now());
    return false;
  }
  return true;
}

/**
 * Synthesizes an alert chime using Web Audio API (safe and self-contained).
 */
export function playAlertChime(severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "HIGH") {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (severity === "CRITICAL") {
      // Urgent double beep (Higher frequency)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sawtooth";
      osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc1.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.1); // C6
      gain1.gain.setValueAtTime(0.15, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.35);
    } else if (severity === "HIGH") {
      // Warning chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.12); // G5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      // Gentle notification tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (err) {
    console.debug("[Audio Alert] Audio playback not permitted or supported:", err);
  }
}

/**
 * Dispatches an email alert via the server-side proxy route and writes to email queue in Firestore.
 */
export async function sendAdminEmailAlert(
  breach: ActiveBreachAlert,
  recipientEmail: string = "saanwar2002@gmail.com"
): Promise<{ success: boolean; message: string }> {
  try {
    const emailSubject = `🚨 [SECURITY BREACH ${breach.severity}] ${breach.title} - TradeQuote Admin`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #000; border-radius: 12px; overflow: hidden; background: #ffffff;">
        <div style="background: ${breach.severity === 'CRITICAL' ? '#b91c1c' : breach.severity === 'HIGH' ? '#ea580c' : '#2563eb'}; padding: 20px; color: #ffffff;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 0.5px;">AnyTrader Sentinel Alert</h1>
          <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Automated Account Activity Threshold Violation Detected</p>
        </div>
        <div style="padding: 24px;">
          <div style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 11px; text-transform: uppercase; background: ${breach.severity === 'CRITICAL' ? '#fee2e2' : '#ffedd5'}; color: ${breach.severity === 'CRITICAL' ? '#991b1b' : '#9a3412'}; margin-bottom: 12px;">
            Severity: ${breach.severity}
          </div>
          <h2 style="margin: 0 0 10px 0; font-size: 17px; color: #0f172a;">${breach.title}</h2>
          <p style="margin: 0 0 16px 0; color: #334155; font-size: 14px; line-height: 1.5;">${breach.description}</p>
          
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Breach Metrics & Evidence</h3>
            <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #1e293b; line-height: 1.6;">
              <li><strong>Observed Activity:</strong> ${breach.metrics.observedValue} ${breach.metrics.unit}</li>
              <li><strong>Configured Threshold:</strong> Max ${breach.metrics.thresholdLimit} ${breach.metrics.unit} within ${breach.metrics.timeWindow}</li>
              ${breach.targetEntity.userName ? `<li><strong>Target User:</strong> ${breach.targetEntity.userName} (${breach.targetEntity.userId || 'N/A'})</li>` : ''}
              ${breach.targetEntity.userEmail ? `<li><strong>Email Address:</strong> ${breach.targetEntity.userEmail}</li>` : ''}
              ${breach.targetEntity.dealTitle ? `<li><strong>Target Deal:</strong> ${breach.targetEntity.dealTitle} (${breach.targetEntity.dealId})</li>` : ''}
              ${breach.targetEntity.ipOrDevice ? `<li><strong>IP / Device Signature:</strong> ${breach.targetEntity.ipOrDevice}</li>` : ''}
              <li><strong>Detection Timestamp:</strong> ${new Date(breach.detectedAt).toUTCString()}</li>
            </ul>
          </div>

          <div style="text-align: center; margin-top: 24px;">
            <a href="https://ais-dev-vumupz44ljjitc6rsqobbz-437256678397.europe-west2.run.app/admin?tab=sentinel_analytics" 
               style="background: #0f172a; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 13px; display: inline-block;">
              Open Admin Sentinel Dashboard →
            </a>
          </div>
        </div>
        <div style="background: #f1f5f9; padding: 12px 24px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; text-align: center;">
          AnyTrader Real-Time Security Sentinel • Automated Alert Dispatch
        </div>
      </div>
    `;

    // 1. Post to Server Email Dispatch Route
    try {
      await fetch("/api/admin/send-email-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipientEmail,
          subject: emailSubject,
          html: emailHtml,
          breachId: breach.id,
          severity: breach.severity,
          breachType: breach.breachType,
        }),
      }).catch((e) => console.warn("Direct /api/admin/send-email-alert call fallback:", e));
    } catch (err) {
      console.warn("Direct fetch error:", err);
    }

    // 2. Queue in Firestore for resilient background worker persistence
    const queueRef = collection(db, "email_alerts_queue");
    await addDoc(queueRef, {
      to: recipientEmail,
      subject: emailSubject,
      breachId: breach.id,
      severity: breach.severity,
      breachType: breach.breachType,
      htmlBody: emailHtml,
      status: "queued",
      createdAt: serverTimestamp(),
      isoCreatedAt: new Date().toISOString()
    }).catch(() => {});

    return {
      success: true,
      message: `Alert email dispatched to ${recipientEmail}`
    };
  } catch (error: any) {
    console.error("Failed to send admin email alert:", error);
    return {
      success: false,
      message: error.message || "Failed to dispatch email alert"
    };
  }
}

/**
 * Loads the active threshold rules from Firestore platform_config, falling back to defaults.
 */
export async function getAdminAlertThresholdRules(): Promise<ThresholdRuleConfig> {
  try {
    const configDoc = await getDoc(doc(db, "platform_config", "alert_thresholds"));
    if (configDoc.exists()) {
      return { ...DEFAULT_THRESHOLD_RULES, ...configDoc.data() };
    }
  } catch (err) {
    console.warn("Could not fetch remote alert_thresholds config, using defaults:", err);
  }
  return DEFAULT_THRESHOLD_RULES;
}

/**
 * Saves updated threshold rules to Firestore.
 */
export async function saveAdminAlertThresholdRules(
  rules: Partial<ThresholdRuleConfig>,
  adminEmail: string = "Admin"
): Promise<{ success: boolean; message: string }> {
  try {
    const docRef = doc(db, "platform_config", "alert_thresholds");
    const payload = {
      ...rules,
      updatedAt: new Date().toISOString(),
      updatedBy: adminEmail,
    };
    await setDoc(docRef, payload, { merge: true });
    return { success: true, message: "Alert threshold rules updated successfully" };
  } catch (error: any) {
    console.error("Error saving alert thresholds:", error);
    return { success: false, message: error.message || "Failed to save threshold rules" };
  }
}

/**
 * Core Real-Time Threshold Breach Listener
 * Listens to Firestore collections and evaluates activity metrics against configured thresholds.
 */
export function startAdminThresholdBreachListener(
  onBreachDetected: (breach: ActiveBreachAlert) => void,
  customRules?: ThresholdRuleConfig
): () => void {
  let activeRules = customRules || DEFAULT_THRESHOLD_RULES;
  let isInitialLoad = true;

  // Track initial load completion (so we don't spam toasts for existing historical data)
  const initialLoadTimer = setTimeout(() => {
    isInitialLoad = false;
  }, 2500);

  // 1. Listen for dynamic rule updates
  const unsubRules = onSnapshot(doc(db, "platform_config", "alert_thresholds"), (snap: any) => {
    if (snap.exists()) {
      activeRules = { ...DEFAULT_THRESHOLD_RULES, ...snap.data() };
    }
  }, (err: any) => console.debug("Alert rules listener note:", err));

  // 2. Listen to Users Collection (Check for rapid profile creations & clustering)
  const unsubUsers = onSnapshot(collection(db, "users"), (snapshot: any) => {
    const users = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() as any }));
    const now = Date.now();
    const fifteenMinutesAgo = now - (15 * 60 * 1000);

    // Filter profiles created within the last 15 minutes
    const recentUsers = users.filter((u: any) => {
      if (!u.createdAt) return false;
      const createdMillis = typeof u.createdAt === "object" && u.createdAt.seconds 
        ? u.createdAt.seconds * 1000 
        : new Date(u.createdAt).getTime();
      return createdMillis >= fifteenMinutesAgo;
    });

    if (recentUsers.length >= activeRules.maxRegistrationsPer15m) {
      const cooldownKey = `breach_users_rapid_${Math.floor(now / (10 * 60 * 1000))}`;
      if (!isUnderCooldown(cooldownKey, 300)) {
        const breach: ActiveBreachAlert = {
          id: `breach-reg-${Date.now()}`,
          breachType: "multiple_profile_creations",
          severity: "CRITICAL",
          title: "Rapid Multi-Profile Registration Spike",
          description: `${recentUsers.length} new user profiles were created within the last 15 minutes, exceeding the safe threshold of ${activeRules.maxRegistrationsPer15m}. Potential automated account farming or Sybil cluster.`,
          detectedAt: new Date().toISOString(),
          targetEntity: {
            userId: recentUsers[0]?.id || "cluster",
            userName: `${recentUsers.length} new accounts`,
            userEmail: recentUsers.map((u: any) => u.email).filter(Boolean).slice(0, 3).join(", "),
            ipOrDevice: recentUsers[0]?.ipAddress || "Subnet / Cluster",
            role: recentUsers[0]?.role || "homeowner"
          },
          metrics: {
            observedValue: recentUsers.length,
            thresholdLimit: activeRules.maxRegistrationsPer15m,
            unit: "accounts",
            timeWindow: "15 minutes"
          },
          evidence: {
            accountCount: recentUsers.length,
            accountEmails: recentUsers.map((u: any) => u.email).filter(Boolean),
            accountRoles: recentUsers.map((u: any) => u.role)
          },
          suggestedActions: [
            { label: "Freeze Recent Batch", action: "freeze_account", danger: true },
            { label: "Flag for KYC", action: "flag_kyc" },
            { label: "Dismiss Alert", action: "dismiss" }
          ],
          status: "new"
        };

        dispatchBreachNotification(breach, activeRules, onBreachDetected, isInitialLoad);
      }
    }
  }, (err: any) => console.debug("Users threshold listener note:", err));

  // 3. Listen to Flash Deals Collection (Check for deal spam & predatory discount depths)
  const unsubDeals = onSnapshot(collection(db, "flash_deals"), (snapshot: any) => {
    const deals = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() as any }));
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    // Group deals by trader
    const traderDeals1h: Record<string, any[]> = {};
    deals.forEach((deal: any) => {
      const createdMillis = deal.createdAt ? (typeof deal.createdAt === "object" && deal.createdAt.seconds ? deal.createdAt.seconds * 1000 : new Date(deal.createdAt).getTime()) : 0;
      if (createdMillis >= oneHourAgo && deal.traderId) {
        if (!traderDeals1h[deal.traderId]) traderDeals1h[deal.traderId] = [];
        traderDeals1h[deal.traderId].push(deal);
      }

      // Check discount depth threshold
      const discount = Number(deal.discountPercentage) || 0;
      if (discount > activeRules.maxDiscountPercentageThreshold && deal.status === "active") {
        const cooldownKey = `breach_deal_disc_${deal.id}`;
        if (!isUnderCooldown(cooldownKey, 600)) {
          const breach: ActiveBreachAlert = {
            id: `breach-deal-disc-${deal.id}`,
            breachType: "deals_misuse",
            severity: "HIGH",
            title: `Excessive Flash Deal Discount Flag (${discount}%)`,
            description: `Flash deal for "${deal.service || 'Service'}" was listed with an abnormal ${discount}% discount (exceeding the ${activeRules.maxDiscountPercentageThreshold}% safety ceiling). Potential price manipulation or bait-and-switch.`,
            detectedAt: new Date().toISOString(),
            targetEntity: {
              dealId: deal.id,
              dealTitle: `${deal.service} (${discount}% OFF)`,
              userId: deal.traderId,
              userName: deal.traderName || "Trader",
              role: "tradesperson"
            },
            metrics: {
              observedValue: discount,
              thresholdLimit: activeRules.maxDiscountPercentageThreshold,
              unit: "% discount",
              timeWindow: "Active deal"
            },
            evidence: {
              dealId: deal.id,
              originalPrice: deal.originalPrice,
              discountedPrice: deal.discountedPrice,
              discountPercentage: discount
            },
            suggestedActions: [
              { label: "Pause / Revoke Deal", action: "revoke_deal", danger: true },
              { label: "Request Rate Card Proof", action: "flag_kyc" },
              { label: "Dismiss Alert", action: "dismiss" }
            ],
            status: "new"
          };
          dispatchBreachNotification(breach, activeRules, onBreachDetected, isInitialLoad);
        }
      }
    });

    // Check rapid deal creation per trader
    Object.entries(traderDeals1h).forEach(([traderId, tDeals]) => {
      if (tDeals.length >= activeRules.maxFlashDealsPerHour) {
        const cooldownKey = `breach_deal_spam_${traderId}`;
        if (!isUnderCooldown(cooldownKey, 600)) {
          const firstDeal = tDeals[0];
          const breach: ActiveBreachAlert = {
            id: `breach-deal-spam-${traderId}-${Date.now()}`,
            breachType: "deals_misuse",
            severity: "HIGH",
            title: "Flash Deal Creation Burst (Spam Pattern)",
            description: `Trader ${firstDeal?.traderName || traderId} published ${tDeals.length} flash deals in under 60 minutes, breaching the limit of ${activeRules.maxFlashDealsPerHour}/hr.`,
            detectedAt: new Date().toISOString(),
            targetEntity: {
              userId: traderId,
              userName: firstDeal?.traderName || "Trader",
              role: "tradesperson",
              dealId: firstDeal?.id,
              dealTitle: `${tDeals.length} Flash Deals Created`
            },
            metrics: {
              observedValue: tDeals.length,
              thresholdLimit: activeRules.maxFlashDealsPerHour,
              unit: "deals",
              timeWindow: "60 minutes"
            },
            evidence: {
              traderId,
              dealsCount: tDeals.length,
              dealTitles: tDeals.map((d: any) => d.service)
            },
            suggestedActions: [
              { label: "Throttle Deal Publishing", action: "revoke_deal", danger: true },
              { label: "Contact Trader", action: "flag_kyc" },
              { label: "Dismiss Alert", action: "dismiss" }
            ],
            status: "new"
          };
          dispatchBreachNotification(breach, activeRules, onBreachDetected, isInitialLoad);
        }
      }
    });
  }, (err: any) => console.debug("Deals threshold listener note:", err));

  // 4. Listen to AI Agent Audit Logs (Check for rapid API calls & scraping bursts)
  const unsubAiLogs = onSnapshot(
    query(collection(db, "ai_agent_audit_logs"), orderBy("timestamp", "desc"), limit(40)),
    (snapshot: any) => {
      const logs = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() as any }));
      const now = Date.now();
      const oneMinuteAgo = now - (60 * 1000);

      // Check log volume in last 60 seconds
      const recentLogs = logs.filter((l: any) => {
        const timeMillis = l.timestamp ? (typeof l.timestamp === "object" && l.timestamp.seconds ? l.timestamp.seconds * 1000 : new Date(l.timestamp).getTime()) : 0;
        return timeMillis >= oneMinuteAgo;
      });

      if (recentLogs.length >= activeRules.maxAiInvocationsPerMin) {
        const cooldownKey = `breach_ai_burst_${Math.floor(now / (5 * 60 * 1000))}`;
        if (!isUnderCooldown(cooldownKey, 300)) {
          const topAgent = recentLogs[0]?.agentType || "AI Operations Fleet";
          const breach: ActiveBreachAlert = {
            id: `breach-ai-burst-${Date.now()}`,
            breachType: "rapid_api_usage",
            severity: "CRITICAL",
            title: "High-Frequency AI API Invocations Burst",
            description: `Detected ${recentLogs.length} AI agent queries in the last 60 seconds (threshold: ${activeRules.maxAiInvocationsPerMin}/min). Elevated risk of scraping, token exhaustion, or bot loops.`,
            detectedAt: new Date().toISOString(),
            targetEntity: {
              userName: `Fleet Invoker (${topAgent})`,
              role: "guest",
              ipOrDevice: recentLogs[0]?.triggerSource || "API Endpoint Cluster"
            },
            metrics: {
              observedValue: recentLogs.length,
              thresholdLimit: activeRules.maxAiInvocationsPerMin,
              unit: "invocations",
              timeWindow: "60 seconds"
            },
            evidence: {
              queriesIn60s: recentLogs.length,
              targetAgent: topAgent,
              recentActions: recentLogs.slice(0, 4).map((l: any) => l.actionTaken || l.action)
            },
            suggestedActions: [
              { label: "Throttle AI Fleet", action: "throttle_ai", danger: true },
              { label: "Investigate IP Cluster", action: "flag_kyc" },
              { label: "Dismiss Alert", action: "dismiss" }
            ],
            status: "new"
          };
          dispatchBreachNotification(breach, activeRules, onBreachDetected, isInitialLoad);
        }
      }
    },
    (err: any) => console.debug("AI logs listener note:", err)
  );

  return () => {
    clearTimeout(initialLoadTimer);
    unsubRules();
    unsubUsers();
    unsubDeals();
    unsubAiLogs();
  };
}

/**
 * Handles dispatching the breach across Toast, Email, and Security Alert log channels.
 */
function dispatchBreachNotification(
  breach: ActiveBreachAlert,
  rules: ThresholdRuleConfig,
  onBreachDetected: (b: ActiveBreachAlert) => void,
  isInitialLoad: boolean
) {
  // 1. Trigger Audio Chime (if enabled and not initial background load)
  if (rules.enableAudioChime && !isInitialLoad) {
    playAlertChime(breach.severity);
  }

  // 2. Trigger In-App Toast (if enabled and not initial load)
  if (rules.enableToastAlerts && !isInitialLoad) {
    breach.toastDisplayed = true;
    onBreachDetected(breach);
  }

  // 3. Dispatch Email Alert (if enabled and passes severity filter)
  const shouldEmail = rules.enableEmailAlerts && (
    rules.minSeverityForEmail === "ALL" ||
    (rules.minSeverityForEmail === "HIGH_AND_CRITICAL" && (breach.severity === "CRITICAL" || breach.severity === "HIGH")) ||
    (rules.minSeverityForEmail === "CRITICAL_ONLY" && breach.severity === "CRITICAL")
  );

  if (shouldEmail) {
    sendAdminEmailAlert(breach, rules.adminAlertEmail).then(() => {
      breach.emailDispatched = true;
    }).catch(() => {});
  }

  // 4. Record to Firestore Security Alerts collection
  try {
    const alertDocRef = doc(collection(db, "security_alerts"));
    setDoc(alertDocRef, {
      ...breach,
      createdAt: serverTimestamp(),
      isoCreatedAt: breach.detectedAt,
      dismissed: false,
      resolved: false
    }).catch((e) => console.debug("Security alert persist note:", e));
  } catch (err) {
    console.debug("Persist alert error:", err);
  }
}

/**
 * Triggers a simulated test breach alert to allow administrators to verify the Toast + Email alerting pipeline immediately.
 */
export function triggerTestBreachAlert(
  type: "multiple_profile_creations" | "rapid_api_usage" | "deals_misuse",
  onBreach: (breach: ActiveBreachAlert) => void,
  targetEmail: string = "saanwar2002@gmail.com"
): ActiveBreachAlert {
  let breach: ActiveBreachAlert;

  if (type === "multiple_profile_creations") {
    breach = {
      id: `test-breach-reg-${Date.now()}`,
      breachType: "multiple_profile_creations",
      severity: "CRITICAL",
      title: "🚨 [TEST] Rapid Multi-Account Creation Spike",
      description: "Simulation: 6 new homeowner accounts registered in 4 minutes from identical device fingerprint (threshold: 3 accounts / 15m).",
      detectedAt: new Date().toISOString(),
      targetEntity: {
        userId: "usr_sim_8819",
        userName: "Alex Thorne Cluster (6 accounts)",
        userEmail: "alex.t****@gmail.com",
        role: "homeowner",
        ipOrDevice: "185.192.68.*** (London, UK)"
      },
      metrics: {
        observedValue: 6,
        thresholdLimit: 3,
        unit: "registrations",
        timeWindow: "15 minutes"
      },
      evidence: {
        accounts: ["alex.t****@gmail.com", "alex.t****+1@gmail.com", "alex.t****+2@gmail.com"],
        deviceCanvasHash: "cv_iphone_15_pro_d991"
      },
      suggestedActions: [
        { label: "Freeze Accounts", action: "freeze_account", danger: true },
        { label: "Flag for Biometric KYC", action: "flag_kyc" },
        { label: "Dismiss Alert", action: "dismiss" }
      ],
      status: "new"
    };
  } else if (type === "rapid_api_usage") {
    breach = {
      id: `test-breach-ai-${Date.now()}`,
      breachType: "rapid_api_usage",
      severity: "HIGH",
      title: "⚠️ [TEST] AI Invocations Burst & Rate Abuse",
      description: "Simulation: 28 prompt queries executed within 45 seconds from single IP address (threshold: 15 queries / min).",
      detectedAt: new Date().toISOString(),
      targetEntity: {
        userName: "Guest Session (#9902)",
        role: "guest",
        ipOrDevice: "88.214.92.*** (Manchester, UK)"
      },
      metrics: {
        observedValue: 28,
        thresholdLimit: 15,
        unit: "invocations",
        timeWindow: "60 seconds"
      },
      evidence: {
        ratePerMinute: 37.3,
        detectedSignature: "Automated Rate Card Price Scraper"
      },
      suggestedActions: [
        { label: "Throttle AI Access", action: "throttle_ai", danger: true },
        { label: "Enforce Turnstile Challenge", action: "flag_kyc" },
        { label: "Dismiss Alert", action: "dismiss" }
      ],
      status: "new"
    };
  } else {
    breach = {
      id: `test-breach-deal-${Date.now()}`,
      breachType: "deals_misuse",
      severity: "HIGH",
      title: "🏷️ [TEST] Flash Deal Predatory Discount Violation",
      description: "Simulation: Flash deal published with 85% discount depth (threshold: 75%). Potential rate manipulation.",
      detectedAt: new Date().toISOString(),
      targetEntity: {
        dealId: "deal_sample_882",
        dealTitle: "Full Boiler Replacement (85% OFF)",
        userId: "trader_sample_44",
        userName: "Apex Heatworks Ltd",
        role: "tradesperson"
      },
      metrics: {
        observedValue: 85,
        thresholdLimit: 75,
        unit: "% discount",
        timeWindow: "Active deal"
      },
      evidence: {
        originalPrice: 3200,
        discountedPrice: 480,
        statedDiscount: "85%"
      },
      suggestedActions: [
        { label: "Pause & Revoke Deal", action: "revoke_deal", danger: true },
        { label: "Request Rate Baseline", action: "flag_kyc" },
        { label: "Dismiss Alert", action: "dismiss" }
      ],
      status: "new"
    };
  }

  // Play chime
  playAlertChime(breach.severity);

  // Trigger toast
  onBreach(breach);

  // Dispatch email
  sendAdminEmailAlert(breach, targetEmail).then(() => {
    breach.emailDispatched = true;
  }).catch(() => {});

  return breach;
}

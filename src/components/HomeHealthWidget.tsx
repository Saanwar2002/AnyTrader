import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Sparkles, ShieldAlert, CheckCircle2, Thermometer, 
  Wrench, Calendar, ArrowRight, Clock, ChevronDown, 
  ChevronUp, RefreshCw, Home, AlertTriangle, Droplets, 
  Flame, Zap, AlertCircle, Plus, ShieldCheck, FileText, CreditCard, BarChart3, X,
  Bell, Trash2, Edit3, CheckSquare, CalendarCheck, Share2
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { getMaintenancePredictions } from "../services/gemini";
import { toast } from "sonner";
import { useAuth } from "./AuthProvider";
import { db, collection, query, where, onSnapshot, doc, setDoc, deleteDoc, updateDoc, serverTimestamp, handleFirestoreError, OperationType } from "@/src/firebase";
import { cn } from "@/src/lib/utils";
import PropertyRiskAnalyticsWidget from "./PropertyRiskAnalyticsWidget";
import BnplFinancingModal from "./BnplFinancingModal";
import { syncJobToGoogleCalendar, openGoogleCalendarUrl } from "../services/googleCalendarService";

interface HomeHealthWidgetProps {
  completedJobs?: any[];
  userPostcode?: string;
}

interface MaintenanceTask {
  id: string;
  title: string;
  category: string;
  urgency: "urgent" | "recommended" | "routine";
  season: string;
  reasoning: string;
  recommendedMonth: string;
  estimatedCostRange: string;
  impactScore: number; // 1-10
  isPassportTask?: boolean;
  dueDate?: string;
}

export interface ScheduledRepairTask {
  id: string;
  userId?: string;
  title: string;
  category: string;
  targetDate: string; // YYYY-MM-DD
  reminderOffset: "same_day" | "3_days_before" | "1_week_before" | "2_weeks_before" | "1_month_before";
  estimatedBudget?: string;
  urgency: "routine" | "recommended" | "urgent";
  notes?: string;
  propertyId?: string;
  propertyName?: string;
  createdAt: string;
  status: "scheduled" | "posted" | "completed";
}

const TRADE_CATEGORIES = [
  "Any Category",
  "Heating & Gas",
  "Plumbing",
  "Electrical",
  "Roofing",
  "Painting & Decorating",
  "Joinery / Carpentry",
  "Damp & Mould",
  "Handyman",
  "Locksmith",
  "Gardening & Fencing",
  "Windows & Doors",
  "Tiling & Flooring",
  "Air Conditioning",
  "Plastering & Rendering",
  "Appliance Repair",
  "Cleaning & Jet Washing"
];

const QUICK_SUGGESTION_CHIPS = [
  { title: "Renew Home & Building Insurance", category: "Any Category", budget: "£200 - £450", urgency: "recommended" as const },
  { title: "Book Driving Lesson / Test", category: "Any Category", budget: "£35 - £70", urgency: "routine" as const },
  { title: "Vehicle MOT & Annual Service", category: "Any Category", budget: "£45 - £180", urgency: "recommended" as const },
  { title: "Boiler Annual Service & CP12", category: "Heating & Gas", budget: "£90 - £150", urgency: "recommended" as const },
  { title: "Gutter Clearance & Downpipe Flush", category: "Roofing", budget: "£80 - £160", urgency: "routine" as const },
  { title: "EICR Electrical Safety Check", category: "Electrical", budget: "£150 - £250", urgency: "recommended" as const },
  { title: "Roof Ridge & Tile Inspection", category: "Roofing", budget: "£120 - £280", urgency: "routine" as const },
  { title: "Radiator Bleeding & Sludge Flush", category: "Heating & Gas", budget: "£100 - £200", urgency: "routine" as const },
  { title: "Exterior Fence / Deck Staining", category: "Painting & Decorating", budget: "£150 - £350", urgency: "routine" as const },
  { title: "Damp & Mould Airflow Inspection", category: "Damp & Mould", budget: "£100 - £220", urgency: "recommended" as const }
];

export default function HomeHealthWidget({ completedJobs = [], userPostcode }: HomeHealthWidgetProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [passportProperties, setPassportProperties] = useState<any[]>([]);
  const [propertyAge, setPropertyAge] = useState<string>(() => {
    return localStorage.getItem("anytrader_property_age") || "1930s-1970s";
  });
  const [propertyType, setPropertyType] = useState<string>(() => {
    return localStorage.getItem("anytrader_property_type") || "Semi-Detached";
  });
  const [heatingType, setHeatingType] = useState<string>(() => {
    return localStorage.getItem("anytrader_heating_type") || "Gas Boiler";
  });

  const [isExpanded, setIsExpanded] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [showRiskAnalytics, setShowRiskAnalytics] = useState(false);
  const [showBnplModal, setShowBnplModal] = useState(false);
  const [showPlanner, setShowPlanner] = useState(false);
  const [activeForecastTab, setActiveForecastTab] = useState<"ai_forecasts" | "scheduled_repairs">("ai_forecasts");

  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPredictions, setAiPredictions] = useState<any[]>([]);

  // User Custom Scheduled Tasks State
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledRepairTask[]>(() => {
    try {
      const saved = localStorage.getItem("anytrader_scheduled_repairs_v1");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Planner Form Fields
  const [plannerTitle, setPlannerTitle] = useState("");
  const [plannerCategory, setPlannerCategory] = useState("Any Category");
  const [plannerTargetDate, setPlannerTargetDate] = useState(() => {
    const future = new Date();
    future.setMonth(future.getMonth() + 1);
    return future.toISOString().split("T")[0];
  });
  const [plannerReminderOffset, setPlannerReminderOffset] = useState<
    "same_day" | "3_days_before" | "1_week_before" | "2_weeks_before" | "1_month_before"
  >("1_week_before");
  const [plannerBudget, setPlannerBudget] = useState("£100 - £250");
  const [plannerUrgency, setPlannerUrgency] = useState<"routine" | "recommended" | "urgent">("recommended");
  const [plannerNotes, setPlannerNotes] = useState("");
  const [plannerSelectedProperty, setPlannerSelectedProperty] = useState("");
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // Automatically fetch user's Property Passports from Firestore
  useEffect(() => {
    if (!user) return;
    const q1 = query(collection(db, "properties"), where("ownerId", "==", user.uid));
    const unsubscribe = onSnapshot(q1, (snapshot) => {
      const props = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPassportProperties(props);

      // Auto-sync specs if property exists
      if (props.length > 0) {
        const primaryProp: any = props[0];
        if (primaryProp.propertyType) {
          setPropertyType(primaryProp.propertyType);
          localStorage.setItem("anytrader_property_type", primaryProp.propertyType);
        }
        if (primaryProp.boilerInfo?.brand) {
          const heatingDesc = `${primaryProp.boilerInfo.brand} Gas Boiler`;
          setHeatingType(heatingDesc);
          localStorage.setItem("anytrader_heating_type", heatingDesc);
        }
      }
    }, (err) => {
      console.error("HomeHealthWidget Property Passport sync error:", err);
    });

    return () => unsubscribe();
  }, [user]);

  // Realtime Firestore listener for user's scheduled repairs
  useEffect(() => {
    if (!user) return;
    const qTasks = query(
      collection(db, "scheduledRepairs"),
      where("userId", "==", user.uid)
    );
    const unsubscribe = onSnapshot(qTasks, (snapshot) => {
      const firestoreTasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ScheduledRepairTask[];

      // Sort by target date ascending
      firestoreTasks.sort((a, b) => (a.targetDate > b.targetDate ? 1 : -1));

      setScheduledTasks(firestoreTasks);
      localStorage.setItem("anytrader_scheduled_repairs_v1", JSON.stringify(firestoreTasks));
    }, (err) => {
      console.error("Firestore scheduledRepairs sync error:", err);
      handleFirestoreError(err, OperationType.LIST, "scheduledRepairs");
    });

    return () => unsubscribe();
  }, [user]);

  // Auto-close timer ref
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset or start the auto-close timer (disabled when an interactive overlay like Planner, Specs, or Risk is open)
  const resetAutoCloseTimer = useCallback(() => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    // DO NOT auto-close if an interactive sub-panel/modal (Planner, Specs, Risk, FlexiPay) is active
    if (isExpanded && !showPlanner && !showConfig && !showRiskAnalytics && !showBnplModal) {
      autoCloseTimerRef.current = setTimeout(() => {
        setIsExpanded(false);
      }, 20000); // 20s idle timeout for passive viewing only
    }
  }, [isExpanded, showPlanner, showConfig, showRiskAnalytics, showBnplModal]);

  // Manage timer lifecycle when states change
  useEffect(() => {
    if (isExpanded && !showPlanner && !showConfig && !showRiskAnalytics && !showBnplModal) {
      resetAutoCloseTimer();
    } else {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    }
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, [isExpanded, showPlanner, showConfig, showRiskAnalytics, showBnplModal, resetAutoCloseTimer]);

  // Current UK Season Detection
  const currentMonth = new Date().getMonth(); // 0-11
  let currentSeasonName = "Winter Freeze Prep";
  let seasonIcon = Thermometer;
  let weatherAlert = "UK Winter Frost Warning: Temperatures dropping below 3°C across England & Wales.";

  if (currentMonth >= 2 && currentMonth <= 4) {
    currentSeasonName = "Spring Thaw & Roof Check";
    weatherAlert = "UK Spring Damp Alert: Inspect roof tiles and timber mortar after winter freezing cycles.";
  } else if (currentMonth >= 5 && currentMonth <= 7) {
    currentSeasonName = "Summer Exterior Maintenance";
    weatherAlert = "UK Summer Heatwave: Ideal window for exterior painting, brick repointing & window seals.";
  } else if (currentMonth >= 8 && currentMonth <= 10) {
    currentSeasonName = "Autumn Rain & Heating Warm-up";
    weatherAlert = "UK Autumn Rainfall Surge: Gutter clearances & boiler servicing recommended before November frost.";
  }

  // Save config settings
  const handleSaveConfig = (age: string, type: string, heating: string) => {
    setPropertyAge(age);
    setPropertyType(type);
    setHeatingType(heating);
    localStorage.setItem("anytrader_property_age", age);
    localStorage.setItem("anytrader_property_type", type);
    localStorage.setItem("anytrader_heating_type", heating);
    setShowConfig(false);
    toast.success("Property specifications updated! Recalculating health forecast...");
  };

  // Generate dynamic maintenance forecasts based on property age, season, and history
  const getForecasts = (): MaintenanceTask[] => {
    const tasks: MaintenanceTask[] = [];

    // --- 0. PROPERTY PASSPORT LIVE SYNCED COMING UP DUE TASKS ---
    passportProperties.forEach((prop) => {
      const propName = prop.name || prop.address?.line1 || "Home";
      const today = new Date().toISOString().split('T')[0];

      // A. Gas Safety (CP12) Certificate Expiry
      if (prop.gasSafetyExpiry) {
        const isExpired = prop.gasSafetyExpiry <= today;
        tasks.push({
          id: `passport-gas-${prop.id}`,
          title: `Gas Safety Certificate (CP12) ${isExpired ? 'EXPIRED' : 'Renewal Due'}`,
          category: "Heating & Gas",
          urgency: isExpired ? "urgent" : "recommended",
          season: "Property Passport Sync",
          reasoning: `Property Passport record for ${propName} flags CP12 expiration on ${prop.gasSafetyExpiry}. Landlords & homeowners require annual certification.`,
          recommendedMonth: isExpired ? "IMMEDIATE" : prop.gasSafetyExpiry,
          estimatedCostRange: "£85 - £140",
          impactScore: 10,
          isPassportTask: true,
          dueDate: prop.gasSafetyExpiry
        });
      }

      // B. EICR Electrical Safety Expiry
      if (prop.eicrExpiry) {
        const isExpired = prop.eicrExpiry <= today;
        tasks.push({
          id: `passport-eicr-${prop.id}`,
          title: `EICR Electrical Safety Certificate ${isExpired ? 'EXPIRED' : 'Renewal Due'}`,
          category: "Electrical",
          urgency: isExpired ? "urgent" : "recommended",
          season: "Property Passport Sync",
          reasoning: `Property Passport record for ${propName} flags 5-year EICR electrical inspection renewal on ${prop.eicrExpiry}.`,
          recommendedMonth: isExpired ? "IMMEDIATE" : prop.eicrExpiry,
          estimatedCostRange: "£150 - £280",
          impactScore: 9,
          isPassportTask: true,
          dueDate: prop.eicrExpiry
        });
      }

      // C. Boiler Servicing & Maintenance
      if (prop.boilerInfo?.brand || prop.boilerInfo?.age) {
        const ageNum = parseInt(prop.boilerInfo.age) || 0;
        if (ageNum >= 5 || prop.boilerInfo.lastServiced) {
          tasks.push({
            id: `passport-boiler-${prop.id}`,
            title: `Annual Boiler Service & Flue Check (${prop.boilerInfo.brand || 'Boiler'})`,
            category: "Heating & Gas",
            urgency: ageNum > 8 ? "urgent" : "recommended",
            season: "Property Passport Sync",
            reasoning: `${propName} has a ${ageNum}-year-old ${prop.boilerInfo.brand || ''} unit. Passport recommends annual servicing to retain efficiency & warranty.`,
            recommendedMonth: "Before Winter",
            estimatedCostRange: "£90 - £160",
            impactScore: 8,
            isPassportTask: true
          });
        }
      }

      // D. Roof Condition Attention
      if (prop.roofCondition === "Needs Inspection" || prop.roofCondition === "Fair") {
        tasks.push({
          id: `passport-roof-${prop.id}`,
          title: `Roof Tile & Chimney Flashing Inspection (${prop.roofCondition})`,
          category: "Roofing",
          urgency: prop.roofCondition === "Needs Inspection" ? "urgent" : "recommended",
          season: "Property Passport Sync",
          reasoning: `Roof condition is flagged as '${prop.roofCondition}' in Property Passport. Early repair avoids severe damp intrusion.`,
          recommendedMonth: "Next 30 Days",
          estimatedCostRange: "£120 - £300",
          impactScore: 8,
          isPassportTask: true
        });
      }

      // E. EPC Rating Upgrade Recommendation
      if (prop.epcRating && ['D', 'E', 'F', 'G'].includes(prop.epcRating.toUpperCase())) {
        tasks.push({
          id: `passport-epc-${prop.id}`,
          title: `EPC Efficiency Upgrade (Current Grade ${prop.epcRating})`,
          category: "Insulation & Energy",
          urgency: "recommended",
          season: "Property Passport Sync",
          reasoning: `Property Passport lists EPC Grade ${prop.epcRating}. Improving loft insulation or draught proofing cuts energy bills by up to 25%.`,
          recommendedMonth: "Autumn / Winter",
          estimatedCostRange: "£200 - £600",
          impactScore: 7,
          isPassportTask: true
        });
      }
    });

    // 1. Heating / Boiler check (General Fallback if no Passport tasks)
    const hasRecentBoilerJob = completedJobs.some(j => 
      j.category?.toLowerCase().includes("heating") || j.category?.toLowerCase().includes("plumbing")
    );

    if ((currentMonth >= 8 || currentMonth <= 1 || !hasRecentBoilerJob) && tasks.length === 0) {
      tasks.push({
        id: "boiler-service",
        title: "Annual Boiler & Heating Efficiency Check",
        category: "Heating & Gas",
        urgency: currentMonth >= 8 || currentMonth <= 1 ? "urgent" : "recommended",
        season: "Autumn/Winter",
        reasoning: `${propertyAge} ${propertyType}s with ${heatingType} systems see a 40% higher breakdown risk during early winter frost if unserviced over 12 months.`,
        recommendedMonth: "Before Nov Freeze",
        estimatedCostRange: "£80 - £150",
        impactScore: 9
      });
    }

    // 2. Gutter & Roof Flashing
    tasks.push({
      id: "gutter-clearance",
      title: "Gutter Clearance & Roof Flashing Inspection",
      category: "Roofing",
      urgency: "urgent",
      season: "Autumn Rainfall",
      reasoning: "Autumn foliage & downpipe blockages cause water pooling against brickwork leading to internal damp patches.",
      recommendedMonth: "October / November",
      estimatedCostRange: "£90 - £180",
      impactScore: 8
    });

    // 3. Electrical & Consumer Unit Audit
    if (propertyAge.includes("1930s") || propertyAge.includes("Victorian") || propertyAge.includes("1970s")) {
      tasks.push({
        id: "electrical-safety",
        title: "Periodic Electrical Safety & RCD Breaker Check",
        category: "Electrical",
        urgency: "recommended",
        season: "Winter Overload Prep",
        reasoning: `${propertyAge} wiring systems experience elevated load during winter months with space heaters and festive lighting.`,
        recommendedMonth: "Year-Round",
        estimatedCostRange: "£120 - £250",
        impactScore: 7
      });
    }

    // 4. Damp & Extractor Fan Ventilation
    tasks.push({
      id: "damp-ventilation",
      title: "Damp & Condensation Airflow Audit",
      category: "Damp Proofing",
      urgency: "routine",
      season: "Winter Indoor Humidity",
      reasoning: "Reduced natural ventilation in cold months increases condensation risk in bathrooms & kitchens.",
      recommendedMonth: "November - February",
      estimatedCostRange: "£100 - £220",
      impactScore: 6
    });

    return tasks;
  };

  const forecasts = getForecasts();

  // Calculate Home Health Score (out of 100)
  const completedHistoryBonus = Math.min(completedJobs.length * 5, 20);
  const urgentTasksCount = forecasts.filter(f => f.urgency === "urgent").length;
  const recommendedTasksCount = forecasts.filter(f => f.urgency === "recommended").length;
  const attentionCount = urgentTasksCount + recommendedTasksCount;
  const healthScore = Math.max(50, Math.min(100, 92 - (urgentTasksCount * 8) + completedHistoryBonus));

  const handleFetchAIPredictions = async () => {
    setIsGenerating(true);
    try {
      const res = await getMaintenancePredictions(completedJobs);
      if (res && Array.isArray(res) && res.length > 0) {
        setAiPredictions(res);
        toast.success("AI Seasonal Maintenance Forecast refreshed!");
      } else {
        toast.info("Generated tailored seasonal forecasts based on your UK property profile.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePostPreventiveJob = (task: MaintenanceTask) => {
    const formattedDesc = `Preventive Maintenance Request (${propertyAge}, ${propertyType}, ${heatingType}):\n\n• Recommended Timeline: ${task.recommendedMonth}\n• Reason for Maintenance: ${task.reasoning}\n• Priority Level: ${task.urgency === 'urgent' ? 'High Seasonal Priority' : 'Recommended Seasonal Maintenance'}\n• Estimated Budget: ${task.estimatedCostRange}`;
    const params = new URLSearchParams({
      category: task.category || "General Maintenance",
      title: task.title,
      description: formattedDesc,
      urgency: task.urgency === "urgent" ? "asap" : "flexible",
      budget: task.estimatedCostRange,
      prefilledByAI: "true"
    });
    navigate(`/post-job?${params.toString()}`, {
      state: {
        category: task.category || "General Maintenance",
        title: task.title,
        description: formattedDesc,
        urgency: task.urgency === "urgent" ? "asap" : "flexible",
        selectedBudget: task.estimatedCostRange,
        prefilledByAI: true
      }
    });
  };

  // Days remaining calculation helper
  const getDaysRemaining = (targetDateStr: string): { days: number; text: string; isOverdue: boolean } => {
    try {
      const target = new Date(targetDateStr + "T00:00:00").getTime();
      const today = new Date().setHours(0, 0, 0, 0);
      const diffTime = target - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        return { days: diffDays, text: `${Math.abs(diffDays)}d Overdue`, isOverdue: true };
      } else if (diffDays === 0) {
        return { days: 0, text: "Due Today!", isOverdue: false };
      } else {
        return { days: diffDays, text: `In ${diffDays} day${diffDays === 1 ? '' : 's'}`, isOverdue: false };
      }
    } catch {
      return { days: 0, text: "Upcoming", isOverdue: false };
    }
  };

  // Fast chip select helper
  const handleQuickChipSelect = (chip: typeof QUICK_SUGGESTION_CHIPS[0]) => {
    setPlannerTitle(chip.title);
    setPlannerCategory(chip.category);
    setPlannerBudget(chip.budget);
    setPlannerUrgency(chip.urgency);
    toast.info(`Filled form with preset: "${chip.title}"`);
  };

  // Save/Schedule task form submit handler
  const handleSaveScheduledTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!plannerTitle.trim()) {
      toast.error("Please enter a repair task title.");
      return;
    }

    setIsSavingTask(true);
    try {
      const taskId = editingTaskId || (user ? doc(collection(db, "scheduledRepairs")).id : `local-${Date.now()}`);
      
      // Calculate notification trigger date
      const targetDateObj = new Date(plannerTargetDate + "T09:00:00");
      let offsetDays = 0;
      if (plannerReminderOffset === "3_days_before") offsetDays = 3;
      else if (plannerReminderOffset === "1_week_before") offsetDays = 7;
      else if (plannerReminderOffset === "2_weeks_before") offsetDays = 14;
      else if (plannerReminderOffset === "1_month_before") offsetDays = 30;

      const reminderDate = new Date(targetDateObj.getTime() - offsetDays * 24 * 60 * 60 * 1000);
      const now = new Date();
      const visibleAtTimestamp = reminderDate > now ? reminderDate.getTime() : now.getTime();

      const selectedProp = passportProperties.find(p => p.id === plannerSelectedProperty);
      const propId = plannerSelectedProperty || passportProperties[0]?.id || "";
      const propName = selectedProp?.name || selectedProp?.address?.line1 || passportProperties[0]?.name || "Home";

      const newTask: ScheduledRepairTask = {
        id: taskId,
        userId: user?.uid || "guest",
        title: plannerTitle.trim(),
        category: plannerCategory || "Any Category",
        targetDate: plannerTargetDate,
        reminderOffset: plannerReminderOffset || "1_week_before",
        estimatedBudget: plannerBudget || "Flexible",
        urgency: plannerUrgency || "routine",
        notes: plannerNotes.trim() || "",
        ...(propId ? { propertyId: propId } : {}),
        propertyName: propName,
        createdAt: new Date().toISOString(),
        status: "scheduled"
      };

      // 1. Save to Firestore if user logged in
      if (user) {
        // Clean out any undefined keys before sending to Firestore
        const firestoreData = JSON.parse(JSON.stringify(newTask));
        await setDoc(doc(db, "scheduledRepairs", taskId), firestoreData);

        // Create scheduled notification document
        const notifRef = doc(collection(db, "notifications"));
        const formattedDesc = `Scheduled Maintenance: ${plannerTitle}\nCategory: ${plannerCategory}\nTarget Date: ${plannerTargetDate}\nEstimated Budget: ${plannerBudget}\nNotes: ${plannerNotes}`;
        const postJobUrl = `/post-job?category=${encodeURIComponent(plannerCategory)}&title=${encodeURIComponent(plannerTitle)}&budget=${encodeURIComponent(plannerBudget)}&description=${encodeURIComponent(formattedDesc)}&prefilledByAI=true`;
        
        await setDoc(notifRef, {
          userId: user.uid,
          type: "scheduled_repair_reminder",
          title: `⏰ Scheduled Task Alert: ${plannerTitle}`,
          message: `Your scheduled ${plannerCategory} task "${plannerTitle}" is targetted for ${plannerTargetDate}. Tap below to request quotes with prefilled details.`,
          visibleAt: visibleAtTimestamp,
          read: false,
          createdAt: serverTimestamp(),
          actionPath: postJobUrl,
          link: postJobUrl,
          icon: "Calendar"
        });
      }

      // 2. Update local state and localStorage
      const updated = scheduledTasks.filter(t => t.id !== taskId);
      updated.push(newTask);
      updated.sort((a, b) => (a.targetDate > b.targetDate ? 1 : -1));
      setScheduledTasks(updated);
      localStorage.setItem("anytrader_scheduled_repairs_v1", JSON.stringify(updated));

      // Reset form
      setPlannerTitle("");
      setPlannerCategory("Any Category");
      setPlannerNotes("");
      setEditingTaskId(null);
      setShowPlanner(false);
      setActiveForecastTab("scheduled_repairs");

      const reminderDateFormatted = reminderDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      toast.success(`Task scheduled for ${plannerTargetDate}! Platform notification set for ${reminderDateFormatted}.`);
    } catch (err: any) {
      console.error("Error saving scheduled task:", err);
      toast.error("Saved scheduled repair task locally.");
    } finally {
      setIsSavingTask(false);
    }
  };

  // 1-Tap Post Job for Custom Scheduled Task
  const handlePostScheduledTask = (task: ScheduledRepairTask) => {
    const formattedDesc = `Scheduled Maintenance Request (${task.propertyName || 'Home'}):\n\n• Target Scheduled Date: ${task.targetDate}\n• Category: ${task.category}\n• Notes / Specifics: ${task.notes || 'None specified'}\n• Priority Level: ${task.urgency === 'urgent' ? 'High Priority' : task.urgency === 'recommended' ? 'Recommended Maintenance' : 'Routine Maintenance'}\n• Estimated Budget: ${task.estimatedBudget || 'Flexible'}`;
    
    const params = new URLSearchParams({
      category: task.category || "General Maintenance",
      title: task.title,
      description: formattedDesc,
      urgency: task.urgency === "urgent" ? "asap" : "flexible",
      budget: task.estimatedBudget || "",
      prefilledByAI: "true"
    });

    navigate(`/post-job?${params.toString()}`, {
      state: {
        category: task.category || "General Maintenance",
        title: task.title,
        description: formattedDesc,
        urgency: task.urgency === "urgent" ? "asap" : "flexible",
        selectedBudget: task.estimatedBudget || "",
        prefilledByAI: true
      }
    });
  };

  // Sync to Google Calendar
  const handleSyncToGCal = async (task: ScheduledRepairTask) => {
    try {
      toast.info("Generating Google Calendar event...");
      const res = await syncJobToGoogleCalendar({
        title: task.title,
        category: task.category,
        startDate: task.targetDate + "T10:00:00",
        description: `[AnyTrader Scheduled Maintenance]\nCategory: ${task.category}\nBudget: ${task.estimatedBudget || 'N/A'}\nNotes: ${task.notes || 'N/A'}\nProperty: ${task.propertyName || 'Home'}`
      });

      if (res && res.url) {
        openGoogleCalendarUrl(res.url);
        toast.success("Google Calendar opened! Tap 'Save' to add to your calendar.");
      } else {
        toast.error("Unable to generate Google Calendar link.");
      }
    } catch (err: any) {
      console.error("Google Calendar sync error:", err);
      toast.error("Calendar sync failed: " + (err.message || "Please check popup settings"));
    }
  };

  // Delete scheduled task
  const handleDeleteScheduledTask = async (taskId: string) => {
    try {
      if (user) {
        await deleteDoc(doc(db, "scheduledRepairs", taskId));
      }
      const updated = scheduledTasks.filter(t => t.id !== taskId);
      setScheduledTasks(updated);
      localStorage.setItem("anytrader_scheduled_repairs_v1", JSON.stringify(updated));
      toast.success("Scheduled task removed.");
    } catch (err) {
      console.error("Error deleting task:", err);
    }
  };

  // Edit existing task
  const handleEditScheduledTask = (task: ScheduledRepairTask) => {
    setEditingTaskId(task.id);
    setPlannerTitle(task.title);
    setPlannerCategory(task.category);
    setPlannerTargetDate(task.targetDate);
    setPlannerReminderOffset(task.reminderOffset);
    setPlannerBudget(task.estimatedBudget || "£100 - £250");
    setPlannerUrgency(task.urgency);
    setPlannerNotes(task.notes || "");
    setPlannerSelectedProperty(task.propertyId || "");
    setShowPlanner(true);
    setIsExpanded(true);
  };

  return (
    <div 
      onTouchStart={resetAutoCloseTimer}
      onTouchMove={resetAutoCloseTimer}
      onMouseEnter={resetAutoCloseTimer}
      onMouseMove={resetAutoCloseTimer}
      onKeyDown={resetAutoCloseTimer}
      onFocus={resetAutoCloseTimer}
      onClick={resetAutoCloseTimer}
      className="bg-slate-900 text-white rounded-3xl p-4 sm:p-5 border border-black shadow-lg space-y-4 transition-all duration-300"
    >
      {/* Top Header - Responsive & Mobile-Optimized */}
      <div className="space-y-3">
        {/* Title & Status Row */}
        <div className="flex items-start justify-between gap-2">
          <div 
            onClick={() => {
              if (!isExpanded) setIsExpanded(true);
            }}
            className={`flex items-center gap-2.5 min-w-0 flex-1 ${!isExpanded ? 'cursor-pointer' : ''}`}
          >
            <div className="relative w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
              {/* Notification Bubble Badge */}
              {attentionCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-md animate-bounce">
                  {attentionCount}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold text-white leading-tight">
                  AI Home Health & Seasonal Forecast
                </h2>
                {/* Notification Bubble Alert Pill */}
                {attentionCount > 0 ? (
                  <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-400/40 px-2 py-0.5 rounded-full font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    🚨 {attentionCount} Alert{attentionCount > 1 ? 's' : ''} Need Attention
                  </span>
                ) : (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0">
                    ✓ Healthy
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-300 truncate mt-0.5">
                {currentSeasonName} • Proactive seasonal predictions based on your UK property.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="text-[11px] font-bold bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded-xl border border-white/20 transition flex items-center gap-1 cursor-pointer shrink-0"
            title={isExpanded ? "Collapse box" : "Expand box"}
          >
            <span className="hidden sm:inline">{isExpanded ? "Collapse" : "Expand"}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Action Buttons Grid - 5 Columns fitting 100% width at all times with mutual auto-close */}
        <div className="grid grid-cols-5 gap-1 sm:gap-1.5 w-full border-t border-white/10 pt-2.5">
          {/* 1. Passport (Home Twin) */}
          <Link
            to="/portfolio"
            onClick={() => {
              setShowConfig(false);
              setShowRiskAnalytics(false);
              setShowBnplModal(false);
              setShowPlanner(false);
            }}
            className="w-full py-2 px-1 text-[10px] sm:text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-xl border border-blue-500 shadow-sm transition flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer text-center leading-none"
            title="Open Property Passport Digital Twin"
          >
            <Home className="w-3.5 h-3.5 text-blue-200 shrink-0" />
            <span className="truncate">Passport</span>
          </Link>

          {/* 2. Specs (Property Configuration) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const nextState = !showConfig;
              setShowRiskAnalytics(false);
              setShowBnplModal(false);
              setShowPlanner(false);
              setShowConfig(nextState);
              if (nextState) setIsExpanded(true);
            }}
            className={cn(
              "w-full py-2 px-1 text-[10px] sm:text-xs font-bold rounded-xl border transition flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer text-center leading-none relative group",
              showConfig 
                ? "bg-amber-400 text-slate-900 border-amber-300 font-extrabold shadow-sm"
                : "bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-700"
            )}
            title={showConfig ? "Close Property Specs" : "Configure Property Specs & Boiler/Roof details"}
          >
            <Wrench className={cn("w-3.5 h-3.5 shrink-0", showConfig ? "text-slate-900" : "text-amber-400")} />
            <span className="truncate">Specs</span>
            {showConfig && <X className="w-3 h-3 text-slate-900 shrink-0 ml-0.5" />}
          </button>

          {/* 3. Planner (Custom Repair Schedule & Alerts) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const nextState = !showPlanner;
              setShowConfig(false);
              setShowRiskAnalytics(false);
              setShowBnplModal(false);
              setShowPlanner(nextState);
              if (nextState) setIsExpanded(true);
            }}
            className={cn(
              "w-full py-2 px-1 text-[10px] sm:text-xs font-bold rounded-xl border transition flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer text-center leading-none relative group",
              showPlanner 
                ? "bg-purple-500 text-white border-purple-400 font-extrabold shadow-sm"
                : "bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border-purple-500/40"
            )}
            title={showPlanner ? "Close Task Planner" : "Plan Ahead Custom Repair & Schedule Alert"}
          >
            <Calendar className={cn("w-3.5 h-3.5 shrink-0", showPlanner ? "text-white" : "text-purple-300")} />
            <span className="truncate">Planner</span>
            {showPlanner && <X className="w-3 h-3 text-white shrink-0 ml-0.5" />}
          </button>

          {/* 4. Risk (Property Risk & Insurance Analytics) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const nextState = !showRiskAnalytics;
              setShowConfig(false);
              setShowBnplModal(false);
              setShowPlanner(false);
              setShowRiskAnalytics(nextState);
              if (nextState) setIsExpanded(true);
            }}
            className={cn(
              "w-full py-2 px-1 text-[10px] sm:text-xs font-bold rounded-xl border transition flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer text-center leading-none relative group",
              showRiskAnalytics 
                ? "bg-emerald-500 text-slate-900 border-emerald-400 font-extrabold shadow-sm"
                : "bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border-emerald-500/40"
            )}
            title={showRiskAnalytics ? "Close Risk Analytics" : "Insurance Underwriter Property Risk Analytics"}
          >
            <BarChart3 className={cn("w-3.5 h-3.5 shrink-0", showRiskAnalytics ? "text-slate-900" : "text-emerald-400")} />
            <span className="truncate">Risk</span>
            {showRiskAnalytics && <X className="w-3 h-3 text-slate-900 shrink-0 ml-0.5" />}
          </button>

          {/* 5. FlexiPay (BNPL Financing) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (showBnplModal) {
                setShowBnplModal(false);
              } else {
                setShowConfig(false);
                setShowRiskAnalytics(false);
                setShowPlanner(false);
                setShowBnplModal(true);
              }
            }}
            className={cn(
              "w-full py-2 px-1 text-[10px] sm:text-xs font-bold rounded-xl border transition flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer text-center leading-none",
              showBnplModal
                ? "bg-indigo-500 text-slate-900 border-indigo-400 font-extrabold shadow-sm"
                : "bg-indigo-600/40 hover:bg-indigo-600/70 text-indigo-200 border-indigo-500/50"
            )}
            title={showBnplModal ? "Close FlexiPay" : "BNPL Repair Financing (£1,000+)"}
          >
            <CreditCard className={cn("w-3.5 h-3.5 shrink-0", showBnplModal ? "text-slate-900" : "text-indigo-300")} />
            <span className="truncate">FlexiPay</span>
            {showBnplModal && <X className="w-3 h-3 text-slate-900 shrink-0 ml-0.5" />}
          </button>
        </div>
      </div>

      {/* Content Area Container */}
      {isExpanded && (
        <div className="relative min-h-[180px] transition-all duration-300">
          {/* Main Widget Info (blurred slightly when overlay is active) */}
          <div className={cn(
            "space-y-4 transition-all duration-300",
            (showConfig || showRiskAnalytics || showPlanner) && "blur-[3px] opacity-25 select-none pointer-events-none"
          )}>
            {/* Health Score & Weather Sync - Compact Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Score Card */}
              <div className="bg-gradient-to-br from-blue-900/50 to-slate-800/80 border border-blue-500/30 rounded-2xl p-3.5 flex items-center gap-3">
                <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                  <svg className="w-12 h-12 transform -rotate-90">
                    <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="5" className="text-slate-700" fill="transparent" />
                    <circle
                      cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="5"
                      className={healthScore >= 80 ? "text-emerald-400" : healthScore >= 65 ? "text-amber-400" : "text-red-400"}
                      strokeDasharray={126}
                      strokeDashoffset={126 - (126 * healthScore) / 100}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>
                  <span className="absolute font-black text-sm text-white">{healthScore}</span>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-blue-300 uppercase tracking-wider">Health Index</p>
                  <h4 className="font-extrabold text-xs text-white">
                    {healthScore >= 80 ? "Excellent Preventive Care" : healthScore >= 65 ? "Good — Seasonal Checks Due" : "Action Recommended"}
                  </h4>
                  <p className="text-[10px] text-slate-300 mt-0.5 line-clamp-1">
                    {propertyAge} • {completedJobs.length} past jobs
                  </p>
                </div>
              </div>

              {/* Weather Sync Banner */}
              <div className="md:col-span-2 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 flex items-center gap-3 text-amber-200">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-extrabold text-[11px] text-amber-300 uppercase tracking-wider">
                      {currentSeasonName}
                    </h4>
                    <button
                      onClick={handleFetchAIPredictions}
                      disabled={isGenerating}
                      className="text-[9px] font-bold text-amber-300 hover:text-white bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 px-2 py-0.5 rounded-md transition flex items-center gap-1 shrink-0"
                    >
                      <RefreshCw className={`w-2.5 h-2.5 ${isGenerating ? 'animate-spin' : ''}`} />
                      <span>AI Sync</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-100/90 font-medium leading-snug line-clamp-2 mt-0.5">
                    {weatherAlert}
                  </p>
                </div>
              </div>
            </div>

            {/* Forecast Cards & Scheduled Planner Section */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveForecastTab("ai_forecasts")}
                    className={cn(
                      "text-[10px] sm:text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-xl transition flex items-center gap-1.5 cursor-pointer",
                      activeForecastTab === "ai_forecasts"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-800 text-slate-300 hover:text-white"
                    )}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                    <span>AI Forecasts ({forecasts.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveForecastTab("scheduled_repairs")}
                    className={cn(
                      "text-[10px] sm:text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-xl transition flex items-center gap-1.5 cursor-pointer relative",
                      activeForecastTab === "scheduled_repairs"
                        ? "bg-purple-600 text-white shadow-sm"
                        : "bg-purple-950/40 text-purple-300 border border-purple-500/30 hover:bg-purple-900/60"
                    )}
                  >
                    <Calendar className="w-3.5 h-3.5 text-purple-300" />
                    <span>My Planned Tasks ({scheduledTasks.length})</span>
                    {scheduledTasks.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingTaskId(null);
                    setPlannerTitle("");
                    setPlannerCategory("Any Category");
                    setPlannerNotes("");
                    setShowPlanner(true);
                  }}
                  className="text-[10px] font-bold bg-purple-600 hover:bg-purple-500 text-white px-2.5 py-1 rounded-xl transition flex items-center gap-1 shadow cursor-pointer shrink-0 ml-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Plan Ahead</span>
                </button>
              </div>

              {/* Tab Content: 1. AI Seasonal Forecasts */}
              {activeForecastTab === "ai_forecasts" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {forecasts.map((task) => (
                    <div
                      key={task.id}
                      className="bg-white/5 border border-white/10 hover:border-blue-500/50 rounded-xl p-3 transition space-y-2 flex flex-col justify-between group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            task.urgency === 'urgent'
                              ? 'bg-red-500/20 text-red-300 border-red-400/30'
                              : task.urgency === 'recommended'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                              : 'bg-blue-500/20 text-blue-300 border-blue-400/30'
                          }`}>
                            {task.urgency === 'urgent' ? '🚨 High Priority' : task.urgency === 'recommended' ? '⚠️ Recommended' : 'Routine'}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {task.recommendedMonth}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-black text-xs text-white group-hover:text-blue-300 transition-colors">
                            {task.title}
                          </h4>
                          <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5 leading-tight">
                            {task.reasoning}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-extrabold text-emerald-400">{task.estimatedCostRange}</span>

                        <button
                          onClick={() => handlePostPreventiveJob(task)}
                          className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition flex items-center gap-1 shadow shrink-0"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Request Quotes</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab Content: 2. My Planned Scheduled Tasks */}
              {activeForecastTab === "scheduled_repairs" && (
                <div>
                  {scheduledTasks.length === 0 ? (
                    <div className="bg-slate-800/50 border border-dashed border-slate-700 rounded-2xl p-6 text-center space-y-3">
                      <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-white">No Planned Repair Tasks Yet</h4>
                        <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5">
                          Schedule any custom maintenance or repair task for a later date. Our platform will alert you with a platform notification when it's time to request trader quotes!
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setEditingTaskId(null);
                          setPlannerTitle("");
                          setPlannerCategory("Any Category");
                          setPlannerNotes("");
                          setShowPlanner(true);
                        }}
                        className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-black px-4 py-2 rounded-xl transition shadow flex items-center gap-1.5 mx-auto cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Schedule Your First Repair Task</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {scheduledTasks.map((task) => {
                        const countdown = getDaysRemaining(task.targetDate);
                        return (
                          <div
                            key={task.id}
                            className="bg-slate-800/80 border border-purple-500/30 hover:border-purple-400/60 rounded-xl p-3 transition space-y-2 flex flex-col justify-between group relative overflow-hidden"
                          >
                            <div className="space-y-1.5">
                              {/* Header row */}
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-400/30">
                                  {task.category}
                                </span>

                                <span className={cn(
                                  "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1",
                                  countdown.isOverdue 
                                    ? "bg-red-500/20 text-red-300 border-red-400/40"
                                    : countdown.days === 0
                                    ? "bg-amber-500/20 text-amber-300 border-amber-400/40 animate-pulse"
                                    : "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
                                )}>
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>{countdown.text}</span>
                                </span>
                              </div>

                              {/* Title & Notes */}
                              <div>
                                <h4 className="font-black text-xs text-white group-hover:text-purple-300 transition-colors flex items-center justify-between gap-1">
                                  <span>{task.title}</span>
                                </h4>
                                {task.notes && (
                                  <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5 leading-tight">
                                    {task.notes}
                                  </p>
                                )}
                              </div>

                              {/* Schedule & Notification Tag */}
                              <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 pt-0.5">
                                <span className="flex items-center gap-1 text-slate-300 font-semibold">
                                  <Calendar className="w-3 h-3 text-purple-400" />
                                  Scheduled: {task.targetDate}
                                </span>
                                <span className="flex items-center gap-1 text-purple-300 font-medium">
                                  <Bell className="w-3 h-3 text-purple-400" />
                                  Alert: {task.reminderOffset.replace(/_/g, ' ')}
                                </span>
                              </div>
                            </div>

                            {/* Footer Action Controls */}
                            <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] font-extrabold text-emerald-400 shrink-0">
                                {task.estimatedBudget || "Flexible"}
                              </span>

                              <div className="flex items-center gap-1.5 flex-wrap shrink-0 ml-auto">
                                {/* Google Calendar Sync */}
                                <button
                                  type="button"
                                  onClick={() => handleSyncToGCal(task)}
                                  className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-bold p-1.5 sm:px-2 rounded-lg transition flex items-center gap-1 cursor-pointer"
                                  title="Sync event to Google Calendar"
                                >
                                  <CalendarCheck className="w-3.5 h-3.5 text-blue-400" />
                                  <span className="hidden sm:inline">GCal</span>
                                </button>

                                {/* Edit Button */}
                                <button
                                  type="button"
                                  onClick={() => handleEditScheduledTask(task)}
                                  className="bg-slate-700 hover:bg-slate-600 text-slate-200 p-1.5 rounded-lg transition cursor-pointer"
                                  title="Edit Task"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                                </button>

                                {/* Delete Button */}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteScheduledTask(task.id)}
                                  className="bg-red-950/40 hover:bg-red-900/60 text-red-300 p-1.5 rounded-lg transition cursor-pointer border border-red-500/30"
                                  title="Delete Task"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>

                                {/* ⚡ Post Job Now */}
                                <button
                                  type="button"
                                  onClick={() => handlePostScheduledTask(task)}
                                  className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 shadow cursor-pointer whitespace-nowrap shrink-0"
                                >
                                  <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                                  <span>Post Job Now</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Absolute Overlay for Active Tab Section (Specs / Risk / Planner) */}
          {(showConfig || showRiskAnalytics || showPlanner) && (
            <div className="absolute inset-0 z-20 bg-slate-950/95 backdrop-blur-md rounded-2xl p-1 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
              
              {/* Planner Overlay Content */}
              {showPlanner && (
                <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <h4 className="text-xs font-black text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-purple-400" />
                      {editingTaskId ? "Edit Scheduled Repair Task" : "Plan Ahead & Schedule Maintenance Task"}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowPlanner(false)}
                      className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded-lg border border-white/20 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Close</span>
                    </button>
                  </div>

                  {/* 1-Tap Quick Suggestion Preset Chips */}
                  {!editingTaskId && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                        ⚡ Quick 1-Tap Preset Suggestions
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                        {QUICK_SUGGESTION_CHIPS.map((chip, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleQuickChipSelect(chip)}
                            className="text-[10px] font-bold bg-slate-800 hover:bg-purple-900/50 text-slate-200 hover:text-purple-200 border border-slate-700 hover:border-purple-500 px-2.5 py-1 rounded-xl transition cursor-pointer flex items-center gap-1"
                          >
                            <Plus className="w-2.5 h-2.5 text-purple-400" />
                            <span>{chip.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Task Schedule Form */}
                  <form onSubmit={handleSaveScheduledTask} className="space-y-3 text-xs">
                    {/* Row 1: Title & Category */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-300 block mb-1">
                          Task Title / Reminder <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={plannerTitle}
                          onChange={(e) => setPlannerTitle(e.target.value)}
                          placeholder="e.g. Renew Home Insurance, Book Driving Lesson, Boiler Service"
                          required
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-300 block mb-1">Task / Trade Category</label>
                        <select
                          value={plannerCategory}
                          onChange={(e) => setPlannerCategory(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-white text-xs font-semibold focus:ring-2 focus:ring-purple-500"
                        >
                          {TRADE_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Row 2: Target Date & Platform Reminder Offset */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-300 block mb-1">Scheduled Target Date</label>
                        <input
                          type="date"
                          value={plannerTargetDate}
                          onChange={(e) => setPlannerTargetDate(e.target.value)}
                          required
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-300 block mb-1">Platform In-App Alert Timing</label>
                        <select
                          value={plannerReminderOffset}
                          onChange={(e: any) => setPlannerReminderOffset(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-white text-xs font-semibold focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="same_day">On the scheduled date</option>
                          <option value="3_days_before">3 days before target date</option>
                          <option value="1_week_before">1 week before target date</option>
                          <option value="2_weeks_before">2 weeks before target date</option>
                          <option value="1_month_before">1 month before target date</option>
                        </select>
                      </div>
                    </div>

                    {/* Row 3: Budget & Priority */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-300 block mb-1">Estimated Budget</label>
                        <input
                          type="text"
                          value={plannerBudget}
                          onChange={(e) => setPlannerBudget(e.target.value)}
                          placeholder="e.g. £100 - £250"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-300 block mb-1">Priority Level</label>
                        <select
                          value={plannerUrgency}
                          onChange={(e: any) => setPlannerUrgency(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-white text-xs font-semibold focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="routine">Routine Maintenance</option>
                          <option value="recommended">Recommended Care</option>
                          <option value="urgent">Urgent / Critical</option>
                        </select>
                      </div>
                    </div>

                    {/* Row 4: Notes / Specs */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-300 block mb-1">Notes / Instructions for Trader</label>
                      <textarea
                        value={plannerNotes}
                        onChange={(e) => setPlannerNotes(e.target.value)}
                        rows={2}
                        placeholder="Add specific details e.g. Combi boiler brand, roof height, access instructions..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                      />
                    </div>

                    {/* Save & Calendar Action Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                      <div className="flex items-center gap-1.5 text-[10px] text-purple-300 font-medium">
                        <Bell className="w-3.5 h-3.5 text-purple-400" />
                        <span>Platform alert will notify you automatically when due.</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveScheduledTask()}
                          disabled={isSavingTask}
                          className="bg-purple-600 hover:bg-purple-500 text-white font-black text-[11px] px-4 py-2 rounded-xl transition shadow-md flex items-center gap-1.5 cursor-pointer"
                        >
                          <CalendarCheck className="w-3.5 h-3.5 text-purple-200" />
                          <span>{isSavingTask ? "Scheduling..." : editingTaskId ? "Update Scheduled Task" : "📌 Save & Schedule Task"}</span>
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}

              {/* Specs Overlay Content */}
              {showConfig && (
                <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                    <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Wrench className="w-4 h-4 text-amber-400" />
                      Property Specifications
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowConfig(false)}
                      className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded-lg border border-white/20 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Close</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                    <div>
                      <label className="text-[10px] font-bold text-slate-300 block mb-1">Property Age / Era</label>
                      <select
                        value={propertyAge}
                        onChange={(e) => setPropertyAge(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-white text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Pre-1919 Victorian / Edwardian">Pre-1919 Victorian / Edwardian</option>
                        <option value="1930s-1970s">1930s - 1970s Period Property</option>
                        <option value="1980s-1990s">1980s - 1990s Modern Construction</option>
                        <option value="2000+ New Build">2000+ New Build</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-300 block mb-1">Property Type</label>
                      <select
                        value={propertyType}
                        onChange={(e) => setPropertyType(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-white text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Detached House">Detached House</option>
                        <option value="Semi-Detached">Semi-Detached</option>
                        <option value="Terraced House">Terraced House</option>
                        <option value="Flat / Apartment">Flat / Apartment</option>
                        <option value="Bungalow">Bungalow</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-300 block mb-1">Heating System</label>
                      <select
                        value={heatingType}
                        onChange={(e) => setHeatingType(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-white text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Gas Combi Boiler">Gas Combi Boiler</option>
                        <option value="Air Source Heat Pump">Air Source Heat Pump</option>
                        <option value="Electric Radiators / Underfloor">Electric Radiators / Underfloor</option>
                        <option value="Oil Boiler / LPG">Oil Boiler / LPG</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-white/10">
                    <button
                      onClick={() => handleSaveConfig(propertyAge, propertyType, heatingType)}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] px-4 py-2 rounded-xl transition shadow-md flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                      <span>Save Specs & Recalculate</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Risk Overlay Content */}
              {showRiskAnalytics && (
                <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-center border-b border-white/10 pb-1.5">
                    <span className="text-xs font-black flex items-center gap-1.5 text-emerald-300">
                      <BarChart3 className="w-4 h-4 text-emerald-400" />
                      Property Risk & Insurance Analytics
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowRiskAnalytics(false)}
                      className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 hover:text-white rounded-lg border border-emerald-400/30 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Close</span>
                    </button>
                  </div>
                  <PropertyRiskAnalyticsWidget
                    propertyPassport={passportProperties[0]}
                    userPostcode={userPostcode}
                  />
                </div>
              )}

            </div>
          )}
        </div>
      )}

      {/* BNPL Financing Modal */}
      {showBnplModal && (
        <BnplFinancingModal
          isOpen={showBnplModal}
          onClose={() => setShowBnplModal(false)}
          initialAmount={2400}
          jobTitle="Major Unexpected Homeowner Repair"
        />
      )}
    </div>
  );
}

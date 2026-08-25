import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { 
  Sparkles, ShieldAlert, CheckCircle2, Thermometer, 
  Wrench, Calendar, ArrowRight, Clock, ChevronDown, 
  ChevronUp, RefreshCw, Home, AlertTriangle, Droplets, 
  Flame, Zap, AlertCircle, Plus, ShieldCheck, FileText, CreditCard, BarChart3, X,
  Bell, Trash2, Edit3, CheckSquare, CalendarCheck, Share2, MapPin, Building2, ExternalLink,
  ChevronRight, ArrowUpRight
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { getMaintenancePredictions } from "../services/gemini";
import { toast } from "sonner";
import { useAuth } from "./AuthProvider";
import { 
  db, collection, query, where, onSnapshot, doc, 
  setDoc, deleteDoc, updateDoc, addDoc, serverTimestamp, 
  handleFirestoreError, OperationType 
} from "@/src/firebase";
import { cn } from "@/src/lib/utils";
import PropertyRiskAnalyticsWidget from "./PropertyRiskAnalyticsWidget";
import BnplFinancingModal from "./BnplFinancingModal";
import { PropertyPassportModal } from "./PropertyPassportModal";
import { syncJobToGoogleCalendar, openGoogleCalendarUrl } from "../services/googleCalendarService";
import { lookupPostcode } from "../services/postcodeService";

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
  propertyAddress?: string;
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
  propertyAddress?: string;
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
  { title: "Boiler Annual Service & CP12", category: "Heating & Gas", budget: "£90 - £150", urgency: "recommended" as const },
  { title: "Gutter Clearance & Downpipe Flush", category: "Roofing", budget: "£80 - £160", urgency: "routine" as const },
  { title: "EICR 5-Year Electrical Safety Check", category: "Electrical", budget: "£150 - £250", urgency: "recommended" as const },
  { title: "Roof Ridge & Chimney Flashing Check", category: "Roofing", budget: "£120 - £280", urgency: "routine" as const },
  { title: "Radiator Bleeding & Sludge Flush", category: "Heating & Gas", budget: "£100 - £200", urgency: "routine" as const },
  { title: "Damp & Mould Airflow Inspection", category: "Damp & Mould", budget: "£100 - £220", urgency: "recommended" as const },
  { title: "Exterior Fence / Deck Staining", category: "Painting & Decorating", budget: "£150 - £350", urgency: "routine" as const }
];

export default function HomeHealthWidget({ completedJobs = [], userPostcode }: HomeHealthWidgetProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Firestore Properties State
  const [passportProperties, setPassportProperties] = useState<any[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");

  // Specifications State (synchronized with active property or user input)
  const [propertyAddressLine, setPropertyAddressLine] = useState("");
  const [propertyPostcode, setPropertyPostcode] = useState(userPostcode || "");
  const [propertyNameInput, setPropertyNameInput] = useState("");
  const [propertyAge, setPropertyAge] = useState<string>(() => {
    return localStorage.getItem("anytrader_property_age") || "1930s-1970s";
  });
  const [propertyType, setPropertyType] = useState<string>(() => {
    return localStorage.getItem("anytrader_property_type") || "Semi-Detached";
  });
  const [heatingType, setHeatingType] = useState<string>(() => {
    return localStorage.getItem("anytrader_heating_type") || "Gas Combi Boiler";
  });
  const [boilerBrand, setBoilerBrand] = useState("");
  const [boilerModel, setBoilerModel] = useState("");
  const [boilerAge, setBoilerAge] = useState("5");
  const [roofCondition, setRoofCondition] = useState("Good");
  const [epcRating, setEpcRating] = useState("C");
  const [gasSafetyExpiry, setGasSafetyExpiry] = useState("");
  const [eicrExpiry, setEicrExpiry] = useState("");

  // Clean 4-Tab Navigation View State
  const [activeTab, setActiveTab] = useState<"forecasts" | "planner" | "risk" | "financing">("forecasts");

  // Modal and Editor Overlay States
  const [isExpanded, setIsExpanded] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [showPassportModal, setShowPassportModal] = useState(false);
  const [showBnplModal, setShowBnplModal] = useState(false);
  const [showPlannerForm, setShowPlannerForm] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingSpecs, setIsSavingSpecs] = useState(false);
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

  // 1. Automatically fetch user's Property Passports from Firestore
  useEffect(() => {
    if (!user) return;
    const q1 = query(collection(db, "properties"), where("ownerId", "==", user.uid));
    const unsubscribe = onSnapshot(q1, (snapshot) => {
      const props = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPassportProperties(props);

      if (props.length > 0) {
        setSelectedPropertyId(prev => {
          if (prev && props.some(p => p.id === prev)) return prev;
          return props[0].id;
        });
      }
    }, (err) => {
      console.error("HomeHealthWidget Property Passport sync error:", err);
    });

    return () => unsubscribe();
  }, [user]);

  // Compute active property
  const activeProperty = useMemo(() => {
    if (passportProperties.length === 0) return null;
    return passportProperties.find(p => p.id === selectedPropertyId) || passportProperties[0] || null;
  }, [passportProperties, selectedPropertyId]);

  // Sync active property specs to state
  useEffect(() => {
    if (activeProperty) {
      setPropertyAddressLine(activeProperty.address?.line1 || "");
      setPropertyPostcode(activeProperty.address?.postcode || userPostcode || "");
      setPropertyNameInput(activeProperty.name || "");
      if (activeProperty.propertyType) {
        setPropertyType(activeProperty.propertyType);
        localStorage.setItem("anytrader_property_type", activeProperty.propertyType);
      }
      if (activeProperty.era) {
        setPropertyAge(activeProperty.era);
        localStorage.setItem("anytrader_property_age", activeProperty.era);
      }
      if (activeProperty.heatingType) {
        setHeatingType(activeProperty.heatingType);
        localStorage.setItem("anytrader_heating_type", activeProperty.heatingType);
      } else if (activeProperty.boilerInfo?.brand) {
        const heatingDesc = `${activeProperty.boilerInfo.brand} Gas Boiler`;
        setHeatingType(heatingDesc);
        localStorage.setItem("anytrader_heating_type", heatingDesc);
      }
      setBoilerBrand(activeProperty.boilerInfo?.brand || "");
      setBoilerModel(activeProperty.boilerInfo?.model || "");
      setBoilerAge(activeProperty.boilerInfo?.age || "5");
      setRoofCondition(activeProperty.roofCondition || "Good");
      setEpcRating(activeProperty.epcRating || "C");
      setGasSafetyExpiry(activeProperty.gasSafetyExpiry || "");
      setEicrExpiry(activeProperty.eicrExpiry || "");
    }
  }, [activeProperty, userPostcode]);

  // 2. Realtime Firestore listener for user's scheduled repairs
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

      firestoreTasks.sort((a, b) => (a.targetDate > b.targetDate ? 1 : -1));
      setScheduledTasks(firestoreTasks);
      localStorage.setItem("anytrader_scheduled_repairs_v1", JSON.stringify(firestoreTasks));
    }, (err) => {
      console.error("Firestore scheduledRepairs sync error:", err);
      handleFirestoreError(err, OperationType.LIST, "scheduledRepairs");
    });

    return () => unsubscribe();
  }, [user]);

  // Current UK Season Detection
  const currentMonth = new Date().getMonth(); // 0-11
  let currentSeasonName = "Winter Freeze Prep";
  let weatherAlert = "UK Winter Frost Warning: Inspect boiler pressure & external pipe lagging to prevent winter freeze bursts.";

  if (currentMonth >= 2 && currentMonth <= 4) {
    currentSeasonName = "Spring Thaw & Roof Check";
    weatherAlert = "UK Spring Damp Alert: Inspect roof tiles, chimney flashing & gutter seals after winter freezing cycles.";
  } else if (currentMonth >= 5 && currentMonth <= 7) {
    currentSeasonName = "Summer Exterior Maintenance";
    weatherAlert = "UK Summer Window: Ideal period for exterior wall painting, brick repointing, and window seal upgrades.";
  } else if (currentMonth >= 8 && currentMonth <= 10) {
    currentSeasonName = "Autumn Rain & Heating Warm-up";
    weatherAlert = "UK Autumn Rainfall Surge: Gutter clearances & annual boiler servicing recommended before November frost.";
  }

  // Save / Update Property Specifications (persists to Firestore & State)
  const handleSaveSpecsAndProperty = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingSpecs(true);

    try {
      const addressLine = propertyAddressLine.trim();
      let postcode = propertyPostcode.trim().toUpperCase();

      if (!postcode) {
        toast.error("Please enter a valid UK postcode so local trade services can be routed to your property passport.");
        setIsSavingSpecs(false);
        return;
      }

      const propName = propertyNameInput.trim() || addressLine || "My Home";

      let resolvedCity = activeProperty?.address?.city || activeProperty?.city || "";
      if (postcode && !resolvedCity) {
        try {
          const lookup = await lookupPostcode(postcode);
          if (lookup) {
            postcode = lookup.postcode;
            if (lookup.city) resolvedCity = lookup.city;
          }
        } catch (e) {
          console.warn("Postcode lookup in HomeHealthWidget:", e);
        }
      }

      const propData = {
        name: propName,
        address: {
          line1: addressLine || "Home Address",
          city: resolvedCity,
          postcode: postcode,
          country: "UK"
        },
        postcode: postcode,
        city: resolvedCity,
        propertyType: propertyType,
        era: propertyAge,
        heatingType: heatingType,
        boilerInfo: {
          brand: boilerBrand.trim() || (heatingType.includes("Boiler") ? "Gas Boiler" : "Heating System"),
          model: boilerModel.trim() || "",
          age: boilerAge || "5",
          lastServiced: activeProperty?.boilerInfo?.lastServiced || ""
        },
        roofCondition: roofCondition,
        epcRating: epcRating,
        gasSafetyExpiry: gasSafetyExpiry || "",
        eicrExpiry: eicrExpiry || "",
        updatedAt: new Date().toISOString()
      };

      if (user) {
        if (activeProperty?.id) {
          await updateDoc(doc(db, "properties", activeProperty.id), propData);
          toast.success("Property specifications updated in Property Passport & Firestore!");
        } else {
          const newDocRef = await addDoc(collection(db, "properties"), {
            ...propData,
            ownerId: user.uid,
            userId: user.uid,
            homeownerId: user.uid,
            status: "active",
            createdAt: new Date().toISOString()
          });
          setSelectedPropertyId(newDocRef.id);
          toast.success("New Property Passport created & address linked!");
        }
      } else {
        toast.success("Property specifications saved locally!");
      }

      localStorage.setItem("anytrader_property_age", propertyAge);
      localStorage.setItem("anytrader_property_type", propertyType);
      localStorage.setItem("anytrader_heating_type", heatingType);

      setShowConfig(false);
    } catch (err: any) {
      console.error("Error saving property specs:", err);
      handleFirestoreError(err, OperationType.UPDATE, "properties");
      toast.error("Failed to save property specifications. Please try again.");
    } finally {
      setIsSavingSpecs(false);
    }
  };

  // Generate dynamic maintenance forecasts
  const getForecasts = (): MaintenanceTask[] => {
    const tasks: MaintenanceTask[] = [];
    const propToUse = activeProperty || (passportProperties.length > 0 ? passportProperties[0] : null);
    const propName = propToUse?.name || propToUse?.address?.line1 || (propertyAddressLine ? propertyAddressLine : "Home");
    const today = new Date().toISOString().split('T')[0];

    if (propToUse) {
      // Gas Safety CP12
      if (propToUse.gasSafetyExpiry) {
        const isExpired = propToUse.gasSafetyExpiry <= today;
        tasks.push({
          id: `passport-gas-${propToUse.id}`,
          title: `Gas Safety Certificate (CP12) ${isExpired ? 'EXPIRED' : 'Renewal Due'}`,
          category: "Heating & Gas",
          urgency: isExpired ? "urgent" : "recommended",
          season: "Compliance Sync",
          reasoning: `Property record for ${propName} flags CP12 expiration on ${propToUse.gasSafetyExpiry}. Annual gas certification is required for safety & warranty.`,
          recommendedMonth: isExpired ? "IMMEDIATE" : propToUse.gasSafetyExpiry,
          estimatedCostRange: "£85 - £140",
          impactScore: 10,
          isPassportTask: true,
          dueDate: propToUse.gasSafetyExpiry,
          propertyAddress: propToUse.address?.line1 || propName
        });
      }

      // EICR Electrical
      if (propToUse.eicrExpiry) {
        const isExpired = propToUse.eicrExpiry <= today;
        tasks.push({
          id: `passport-eicr-${propToUse.id}`,
          title: `EICR 5-Year Electrical Safety Check ${isExpired ? 'EXPIRED' : 'Due'}`,
          category: "Electrical",
          urgency: isExpired ? "urgent" : "recommended",
          season: "Compliance Sync",
          reasoning: `Property record for ${propName} flags 5-year EICR electrical inspection renewal on ${propToUse.eicrExpiry}.`,
          recommendedMonth: isExpired ? "IMMEDIATE" : propToUse.eicrExpiry,
          estimatedCostRange: "£150 - £280",
          impactScore: 9,
          isPassportTask: true,
          dueDate: propToUse.eicrExpiry,
          propertyAddress: propToUse.address?.line1 || propName
        });
      }

      // Boiler Servicing
      if (propToUse.boilerInfo?.brand || propToUse.boilerInfo?.age) {
        const ageNum = parseInt(propToUse.boilerInfo.age) || 0;
        if (ageNum >= 5 || propToUse.boilerInfo.lastServiced) {
          tasks.push({
            id: `passport-boiler-${propToUse.id}`,
            title: `Annual Boiler Service & Flue Check (${propToUse.boilerInfo.brand || 'Boiler'})`,
            category: "Heating & Gas",
            urgency: ageNum > 8 ? "urgent" : "recommended",
            season: "Seasonal Care",
            reasoning: `${propName} has a ${ageNum}-year-old ${propToUse.boilerInfo.brand || 'boiler'} unit. Regular annual servicing prevents winter breakdowns and preserves warranty.`,
            recommendedMonth: "Before Nov Freeze",
            estimatedCostRange: "£90 - £160",
            impactScore: 8,
            isPassportTask: true,
            propertyAddress: propToUse.address?.line1 || propName
          });
        }
      }

      // Roof Condition Attention
      if (propToUse.roofCondition === "Needs Inspection" || propToUse.roofCondition === "Fair") {
        tasks.push({
          id: `passport-roof-${propToUse.id}`,
          title: `Roof Tile & Chimney Flashing Inspection (${propToUse.roofCondition})`,
          category: "Roofing",
          urgency: propToUse.roofCondition === "Needs Inspection" ? "urgent" : "recommended",
          season: "Structural Check",
          reasoning: `Roof condition is flagged as '${propToUse.roofCondition}' for ${propName}. Early repair avoids costly internal ceiling damp intrusion.`,
          recommendedMonth: "Next 30 Days",
          estimatedCostRange: "£120 - £300",
          impactScore: 8,
          isPassportTask: true,
          propertyAddress: propToUse.address?.line1 || propName
        });
      }

      // EPC Efficiency
      if (propToUse.epcRating && ['D', 'E', 'F', 'G'].includes(propToUse.epcRating.toUpperCase())) {
        tasks.push({
          id: `passport-epc-${propToUse.id}`,
          title: `EPC Efficiency Upgrade (Current Grade ${propToUse.epcRating})`,
          category: "Insulation & Energy",
          urgency: "recommended",
          season: "Energy Efficiency",
          reasoning: `Property record lists EPC Grade ${propToUse.epcRating}. Improving loft insulation, cavity wall seals or TRV valves cuts heating bills by up to 25%.`,
          recommendedMonth: "Autumn / Winter",
          estimatedCostRange: "£200 - £600",
          impactScore: 7,
          isPassportTask: true,
          propertyAddress: propToUse.address?.line1 || propName
        });
      }
    }

    // Seasonal & Era Fallbacks
    const hasRecentBoilerJob = completedJobs.some(j => 
      j.category?.toLowerCase().includes("heating") || j.category?.toLowerCase().includes("plumbing")
    );

    if ((currentMonth >= 8 || currentMonth <= 1 || !hasRecentBoilerJob) && !tasks.some(t => t.category === "Heating & Gas")) {
      tasks.push({
        id: "boiler-seasonal-service",
        title: "Annual Boiler & Central Heating Efficiency Check",
        category: "Heating & Gas",
        urgency: currentMonth >= 8 || currentMonth <= 1 ? "urgent" : "recommended",
        season: "Autumn / Winter Prep",
        reasoning: `${propertyAge} ${propertyType}s with ${heatingType} experience elevated failure rates during first cold snap if unserviced over 12 months.`,
        recommendedMonth: "Before Nov Freeze",
        estimatedCostRange: "£80 - £150",
        impactScore: 9,
        propertyAddress: propName
      });
    }

    if (!tasks.some(t => t.id === "gutter-clearance")) {
      tasks.push({
        id: "gutter-clearance",
        title: "Gutter Clearance & Roof Flashing Inspection",
        category: "Roofing",
        urgency: currentMonth >= 8 && currentMonth <= 11 ? "urgent" : "routine",
        season: currentSeasonName,
        reasoning: `Autumn leaves and moss block downpipes, forcing rainwater to pool against masonry and create penetrating damp on ${propertyType} walls.`,
        recommendedMonth: "October / November",
        estimatedCostRange: "£90 - £180",
        impactScore: 8,
        propertyAddress: propName
      });
    }

    if ((propertyAge.includes("1930s") || propertyAge.includes("Victorian") || propertyAge.includes("1970s")) && !tasks.some(t => t.category === "Electrical")) {
      tasks.push({
        id: "electrical-safety",
        title: "Periodic Electrical Consumer Unit & RCD Audit",
        category: "Electrical",
        urgency: "recommended",
        season: "Safety Audit",
        reasoning: `${propertyAge} wiring systems experience elevated load in colder months. Checking RCD trip switches and bonding prevents fire hazards.`,
        recommendedMonth: "Year-Round",
        estimatedCostRange: "£120 - £250",
        impactScore: 7,
        propertyAddress: propName
      });
    }

    if (!tasks.some(t => t.category === "Damp & Mould" || t.category === "Damp Proofing")) {
      tasks.push({
        id: "damp-ventilation",
        title: "Damp & Condensation Airflow Inspection",
        category: "Damp & Mould",
        urgency: "routine",
        season: "Indoor Humidity",
        reasoning: "Cold external temperatures increase indoor condensation on window reveals and bathroom walls without sufficient trickle airflow.",
        recommendedMonth: "November - February",
        estimatedCostRange: "£100 - £220",
        impactScore: 6,
        propertyAddress: propName
      });
    }

    return tasks;
  };

  const forecasts = getForecasts();

  // Calculate Home Health Score (out of 100)
  const completedHistoryBonus = Math.min(completedJobs.length * 5, 20);
  const passportCompleteBonus = activeProperty?.address?.line1 ? 10 : 0;
  const urgentTasksCount = forecasts.filter(f => f.urgency === "urgent").length;
  const recommendedTasksCount = forecasts.filter(f => f.urgency === "recommended").length;
  const attentionCount = urgentTasksCount + recommendedTasksCount;
  const healthScore = Math.max(50, Math.min(100, 90 - (urgentTasksCount * 8) - (recommendedTasksCount * 3) + completedHistoryBonus + passportCompleteBonus));

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

  // 1-Tap Post Job for Preventive Forecast Task
  const handlePostPreventiveJob = (task: MaintenanceTask) => {
    const propAddressStr = activeProperty?.address?.line1 
      ? `${activeProperty.address.line1}${activeProperty.address.postcode ? ', ' + activeProperty.address.postcode : ''}`
      : propertyAddressLine || "Home";

    const formattedDesc = `Preventive Maintenance Request for ${propAddressStr} (${propertyAge}, ${propertyType}, ${heatingType}):\n\n• Recommended Timeline: ${task.recommendedMonth}\n• Reason for Maintenance: ${task.reasoning}\n• Priority Level: ${task.urgency === 'urgent' ? 'High Seasonal Priority' : 'Recommended Seasonal Maintenance'}\n• Estimated Budget: ${task.estimatedCostRange}\n\n--- PROPERTY SPECS ---\n• Address: ${propAddressStr}\n• Era: ${propertyAge}\n• Heating / Boiler: ${boilerBrand || heatingType} ${boilerModel || ''}\n• Roof Condition: ${roofCondition}\n• EPC: Grade ${epcRating}`;

    const params = new URLSearchParams({
      category: task.category || "General Maintenance",
      title: task.title,
      description: formattedDesc,
      urgency: task.urgency === "urgent" ? "asap" : "flexible",
      budget: task.estimatedCostRange,
      prefilledByAI: "true"
    });

    if (activeProperty?.id) {
      params.set("linkedPropertyId", activeProperty.id);
    }

    navigate(`/post-job?${params.toString()}`, {
      state: {
        category: task.category || "General Maintenance",
        title: task.title,
        description: formattedDesc,
        urgency: task.urgency === "urgent" ? "asap" : "flexible",
        selectedBudget: task.estimatedCostRange,
        prefilledByAI: true,
        linkedPropertyId: activeProperty?.id || null,
        linkedPropertyName: activeProperty?.name || activeProperty?.address?.line1 || null,
        linkedProperties: activeProperty ? [activeProperty] : null
      }
    });
  };

  // Quick Add Forecast Task directly to Maintenance Planner
  const handleAddForecastToPlanner = (task: MaintenanceTask) => {
    setPlannerTitle(task.title);
    setPlannerCategory(task.category);
    setPlannerBudget(task.estimatedCostRange);
    setPlannerUrgency(task.urgency);
    setPlannerNotes(task.reasoning);
    setPlannerSelectedProperty(activeProperty?.id || "");
    setActiveTab("planner");
    setShowPlannerForm(true);
    toast.info(`Task pre-filled in Planner: "${task.title}"`);
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
    toast.info(`Filled with preset: "${chip.title}"`);
  };

  // Save/Schedule task form submit handler
  const handleSaveScheduledTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!plannerTitle.trim()) {
      toast.error("Please enter a task title.");
      return;
    }

    setIsSavingTask(true);
    try {
      const taskId = editingTaskId || (user ? doc(collection(db, "scheduledRepairs")).id : `local-${Date.now()}`);
      
      const targetDateObj = new Date(plannerTargetDate + "T09:00:00");
      let offsetDays = 0;
      if (plannerReminderOffset === "3_days_before") offsetDays = 3;
      else if (plannerReminderOffset === "1_week_before") offsetDays = 7;
      else if (plannerReminderOffset === "2_weeks_before") offsetDays = 14;
      else if (plannerReminderOffset === "1_month_before") offsetDays = 30;

      const reminderDate = new Date(targetDateObj.getTime() - offsetDays * 24 * 60 * 60 * 1000);
      const now = new Date();
      const visibleAtTimestamp = reminderDate > now ? reminderDate.getTime() : now.getTime();

      const selectedProp = passportProperties.find(p => p.id === plannerSelectedProperty) || activeProperty;
      const propId = selectedProp?.id || "";
      const propName = selectedProp?.name || selectedProp?.address?.line1 || "Home";
      const propAddress = selectedProp?.address?.line1 ? `${selectedProp.address.line1}${selectedProp.address.postcode ? ', ' + selectedProp.address.postcode : ''}` : "";

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
        propertyAddress: propAddress,
        createdAt: new Date().toISOString(),
        status: "scheduled"
      };

      if (user) {
        const firestoreData = JSON.parse(JSON.stringify(newTask));
        await setDoc(doc(db, "scheduledRepairs", taskId), firestoreData);

        const notifRef = doc(collection(db, "notifications"));
        const formattedDesc = `Scheduled Maintenance: ${plannerTitle}\nProperty: ${propName} (${propAddress})\nCategory: ${plannerCategory}\nTarget Date: ${plannerTargetDate}\nEstimated Budget: ${plannerBudget}\nNotes: ${plannerNotes}`;
        const postJobUrl = `/post-job?category=${encodeURIComponent(plannerCategory)}&title=${encodeURIComponent(plannerTitle)}&budget=${encodeURIComponent(plannerBudget)}&description=${encodeURIComponent(formattedDesc)}&prefilledByAI=true`;
        
        await setDoc(notifRef, {
          userId: user.uid,
          type: "scheduled_repair_reminder",
          title: `⏰ Maintenance Alert: ${plannerTitle}`,
          message: `Your scheduled task "${plannerTitle}" for ${propName} is targeted for ${plannerTargetDate}. Tap to request quotes.`,
          visibleAt: visibleAtTimestamp,
          read: false,
          createdAt: serverTimestamp(),
          actionPath: postJobUrl,
          link: postJobUrl,
          icon: "Calendar"
        });
      }

      const updated = scheduledTasks.filter(t => t.id !== taskId);
      updated.push(newTask);
      updated.sort((a, b) => (a.targetDate > b.targetDate ? 1 : -1));
      setScheduledTasks(updated);
      localStorage.setItem("anytrader_scheduled_repairs_v1", JSON.stringify(updated));

      setPlannerTitle("");
      setPlannerCategory("Any Category");
      setPlannerNotes("");
      setEditingTaskId(null);
      setShowPlannerForm(false);

      const reminderDateFormatted = reminderDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      toast.success(`Task scheduled for ${plannerTargetDate}! Alert set for ${reminderDateFormatted}.`);
    } catch (err: any) {
      console.error("Error saving scheduled task:", err);
      toast.error("Saved scheduled repair task locally.");
    } finally {
      setIsSavingTask(false);
    }
  };

  // 1-Tap Post Job for Custom Scheduled Task
  const handlePostScheduledTask = (task: ScheduledRepairTask) => {
    const prop = passportProperties.find(p => p.id === task.propertyId) || activeProperty;
    const formattedDesc = `Scheduled Maintenance Request (${task.propertyName || 'Home'}${task.propertyAddress ? ' - ' + task.propertyAddress : ''}):\n\n• Target Scheduled Date: ${task.targetDate}\n• Category: ${task.category}\n• Notes: ${task.notes || 'None specified'}\n• Priority: ${task.urgency === 'urgent' ? 'High Priority' : task.urgency === 'recommended' ? 'Recommended' : 'Routine'}\n• Budget: ${task.estimatedBudget || 'Flexible'}`;
    
    const params = new URLSearchParams({
      category: task.category || "General Maintenance",
      title: task.title,
      description: formattedDesc,
      urgency: task.urgency === "urgent" ? "asap" : "flexible",
      budget: task.estimatedBudget || "",
      prefilledByAI: "true"
    });

    if (prop?.id) {
      params.set("linkedPropertyId", prop.id);
    }

    navigate(`/post-job?${params.toString()}`, {
      state: {
        category: task.category || "General Maintenance",
        title: task.title,
        description: formattedDesc,
        urgency: task.urgency === "urgent" ? "asap" : "flexible",
        selectedBudget: task.estimatedBudget || "",
        prefilledByAI: true,
        linkedPropertyId: prop?.id || null,
        linkedPropertyName: prop?.name || prop?.address?.line1 || null,
        linkedProperties: prop ? [prop] : null
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
        description: `[AnyTrader Scheduled Maintenance]\nCategory: ${task.category}\nBudget: ${task.estimatedBudget || 'N/A'}\nNotes: ${task.notes || 'N/A'}\nProperty: ${task.propertyName || 'Home'} (${task.propertyAddress || ''})`
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
    setShowPlannerForm(true);
    setActiveTab("planner");
    setIsExpanded(true);
  };

  return (
    <div className="bg-slate-900 text-white rounded-3xl p-4 sm:p-5 border border-white shadow-xl space-y-4 transition-all duration-300 relative">
      
      {/* 1. SECTION HEADER: Title, Live Alert Badge & Collapse Toggle */}
      <div className="flex items-center justify-between gap-3">
        <div 
          onClick={() => { if (!isExpanded) setIsExpanded(true); }}
          className={`flex items-center gap-3 min-w-0 flex-1 ${!isExpanded ? 'cursor-pointer' : ''}`}
        >
          <div className="relative w-10 h-10 rounded-2xl bg-blue-500/20 border border-white flex items-center justify-center text-blue-400 shrink-0 shadow-inner">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white leading-tight">
                AI Home Health & Seasonal Care
              </h2>
              {attentionCount > 0 ? (
                <span className="text-[10px] bg-red-500/25 text-red-300 border border-white px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                  {attentionCount} Actions Due
                </span>
              ) : (
                <span className="text-[10px] bg-emerald-500/25 text-emerald-300 border border-white px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Optimal Condition
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-0.5 font-medium">
              Live UK weather forecasts, predictive maintenance, and digital property records.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-black bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl border border-white transition-all flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
        >
          <span className="hidden sm:inline">{isExpanded ? "Minimize" : "Expand"}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* 2. UNIFIED PROPERTY & HEALTH SCORE BAR (Zero redundancy, crystal clear actions) */}
      <div className="bg-slate-950/80 border border-white rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3.5">
        
        {/* Left: Health Score Radial + Address & Specs */}
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {/* Circular Health Gauge */}
          <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
            <svg className="w-12 h-12 transform -rotate-90">
              <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4.5" className="text-slate-800" fill="transparent" />
              <circle
                cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4.5"
                className={healthScore >= 80 ? "text-emerald-400" : healthScore >= 65 ? "text-amber-400" : "text-red-400"}
                strokeDasharray={126}
                strokeDashoffset={126 - (126 * healthScore) / 100}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <span className="absolute font-black text-xs text-white">{healthScore}</span>
          </div>

          {/* Property Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-black text-white truncate">
                {activeProperty ? (activeProperty.name || activeProperty.address?.line1 || "My Home") : "Home Address"}
              </span>
              {activeProperty?.address?.postcode && (
                <span className="text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-white px-2 py-0.2 rounded-md">
                  {activeProperty.address.postcode}
                </span>
              )}
              {passportProperties.length > 1 && (
                <select
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  className="text-[10px] font-bold bg-slate-800 text-slate-200 border border-white rounded-lg px-2 py-1 cursor-pointer ml-1"
                >
                  {passportProperties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.address?.line1 || "Property"} ({p.address?.postcode || "UK"})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-300 mt-0.5">
              <span>{propertyType}</span>
              <span className="text-slate-500">•</span>
              <span>{propertyAge}</span>
              <span className="text-slate-500">•</span>
              <span className="text-amber-300 font-semibold">{boilerBrand || heatingType}</span>
              {epcRating && (
                <>
                  <span className="text-slate-500">•</span>
                  <span className="text-emerald-400 font-bold">EPC {epcRating}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Primary Clear Action Buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end pt-2 md:pt-0 border-t md:border-t-0 border-white/20">
          {/* 1. Property Passport Modal */}
          <button
            type="button"
            onClick={() => {
              if (activeProperty) {
                setShowPassportModal(true);
              } else {
                setShowConfig(true);
                toast.info("Please add your property address first to open your Digital Passport!");
              }
            }}
            className="flex-1 md:flex-initial text-xs font-black bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl border border-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            title="View Property Passport Digital Twin"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Property Passport</span>
          </button>

          {/* 2. Edit Specs Form */}
          <button
            type="button"
            onClick={() => setShowConfig(true)}
            className="flex-1 md:flex-initial text-xs font-bold bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white px-3 py-2 rounded-xl border border-white transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            title="Edit address, boiler, roof & EPC details"
          >
            <Wrench className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <div className="flex flex-col text-left leading-tight">
              <span>Edit Property</span>
              <span>Specs</span>
            </div>
          </button>
        </div>
      </div>

      {/* 3. MAIN 4 FUNCTIONAL TABS (Intuitive, purpose-driven navigation) */}
      {isExpanded && (
        <div className="space-y-4 pt-1">
          {/* Navigation Tab Bar */}
          <div className="grid grid-cols-4 gap-1 sm:gap-2 bg-slate-950/80 p-1.5 rounded-2xl border border-white">
            
            {/* Tab 1: Seasonal Care */}
            <button
              type="button"
              onClick={() => setActiveTab("forecasts")}
              className={cn(
                "py-2 px-1 rounded-xl text-[9px] sm:text-xs font-black transition-all flex flex-col items-center justify-center cursor-pointer border text-center leading-tight min-h-[48px]",
                activeTab === "forecasts"
                  ? "bg-amber-400 text-slate-950 border-white shadow-md scale-[1.02]"
                  : "bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800/80 border-white/30"
              )}
            >
              <div className="flex items-center justify-center gap-0.5">
                <span>Seasonal</span>
                <span className={cn(
                  "text-[8px] font-black px-1 py-0.2 rounded-full shrink-0 border border-white",
                  activeTab === "forecasts"
                    ? "bg-slate-950 text-amber-400"
                    : "bg-amber-400/20 text-amber-300"
                )}>
                  {forecasts.length}
                </span>
              </div>
              <span>Care</span>
            </button>

            {/* Tab 2: Maintenance Planner */}
            <button
              type="button"
              onClick={() => setActiveTab("planner")}
              className={cn(
                "py-2 px-1 rounded-xl text-[9px] sm:text-xs font-black transition-all flex flex-col items-center justify-center cursor-pointer border text-center leading-tight min-h-[48px]",
                activeTab === "planner"
                  ? "bg-purple-600 text-white border-white shadow-md scale-[1.02]"
                  : "bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800/80 border-white/30"
              )}
            >
              <div className="flex items-center justify-center gap-0.5">
                <span>Planner</span>
                <span className={cn(
                  "text-[8px] font-black px-1 py-0.2 rounded-full shrink-0 border border-white",
                  activeTab === "planner"
                    ? "bg-white text-purple-700"
                    : "bg-purple-400/20 text-purple-300"
                )}>
                  {scheduledTasks.length}
                </span>
              </div>
              <span>Tasks</span>
            </button>

            {/* Tab 3: Risk & Insurance */}
            <button
              type="button"
              onClick={() => setActiveTab("risk")}
              className={cn(
                "py-2 px-1 rounded-xl text-[9px] sm:text-xs font-black transition-all flex flex-col items-center justify-center cursor-pointer border text-center leading-tight min-h-[48px]",
                activeTab === "risk"
                  ? "bg-emerald-500 text-slate-950 border-white shadow-md scale-[1.02]"
                  : "bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800/80 border-white/30"
              )}
            >
              <span>Risk &</span>
              <span>Insurance</span>
            </button>

            {/* Tab 4: Repair Financing (FlexiPay) */}
            <button
              type="button"
              onClick={() => setActiveTab("financing")}
              className={cn(
                "py-2 px-1 rounded-xl text-[9px] sm:text-xs font-black transition-all flex flex-col items-center justify-center cursor-pointer border text-center leading-tight min-h-[48px]",
                activeTab === "financing"
                  ? "bg-cyan-500 text-slate-950 border-white shadow-md scale-[1.02]"
                  : "bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800/80 border-white/30"
              )}
            >
              <span>FlexiPay</span>
              <span>Repair</span>
            </button>
          </div>

          {/* 4. TAB CONTENTS */}
          
          {/* TAB 1: SEASONAL FORECASTS */}
          {activeTab === "forecasts" && (
            <div className="space-y-3.5 animate-in fade-in duration-200">
              {/* Seasonal Weather Banner */}
              <div className="bg-amber-500/10 border border-white rounded-2xl p-3.5 flex items-center justify-between gap-3 text-amber-200">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-white flex items-center justify-center text-amber-400 shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-extrabold text-xs text-amber-300 uppercase tracking-wider">
                      {currentSeasonName}
                    </h4>
                    <p className="text-xs text-amber-100/90 font-medium leading-snug line-clamp-2 mt-0.5">
                      {weatherAlert}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleFetchAIPredictions}
                  disabled={isGenerating}
                  className="text-xs font-bold text-amber-300 hover:text-white bg-amber-500/20 hover:bg-amber-500/30 border border-white px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>AI Refresh</span>
                </button>
              </div>

              {/* Forecast Task Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {forecasts.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white/5 border border-white hover:border-amber-400 rounded-2xl p-3.5 transition flex flex-col justify-between space-y-3 group"
                  >
                    <div className="space-y-1.5">
                      {/* Priority Tag & Timeframe */}
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-white ${
                          task.urgency === 'urgent'
                            ? 'bg-red-500/20 text-red-300'
                            : task.urgency === 'recommended'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-blue-500/20 text-blue-300'
                        }`}>
                          {task.urgency === 'urgent' ? '🚨 High Priority' : task.urgency === 'recommended' ? '⚠️ Recommended' : 'Routine'}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {task.recommendedMonth}
                        </span>
                      </div>

                      {/* Title & Plain English Reason */}
                      <div>
                        <h4 className="font-black text-sm text-white group-hover:text-blue-300 transition-colors">
                          {task.title}
                        </h4>
                        <p className="text-xs text-slate-300 leading-relaxed mt-1">
                          {task.reasoning}
                        </p>
                      </div>
                    </div>

                    {/* Cost & Dual Action Buttons */}
                    <div className="pt-2.5 border-t border-white/20 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Est. Cost</span>
                        <span className="text-xs sm:text-sm font-black text-emerald-400">{task.estimatedCostRange}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Add to Planner Button */}
                        <button
                          type="button"
                          onClick={() => handleAddForecastToPlanner(task)}
                          className="bg-white/10 hover:bg-white/20 text-slate-200 text-[11px] font-bold px-2.5 py-1.5 rounded-xl border border-white transition flex items-center gap-1 cursor-pointer"
                          title="Save this task to your Maintenance Planner"
                        >
                          <Calendar className="w-3 h-3 text-purple-300" />
                          <span className="hidden sm:inline">Add to</span> Planner
                        </button>

                        {/* 1-Tap Request Quotes */}
                        <button
                          type="button"
                          onClick={() => handlePostPreventiveJob(task)}
                          className="bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black px-3 py-1.5 rounded-xl border border-white transition flex items-center gap-1 shadow cursor-pointer active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Request Quotes</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: MAINTENANCE PLANNER */}
          {activeTab === "planner" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Planner Header & Add Task CTA */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-purple-950/30 border border-white rounded-2xl p-3 sm:p-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-purple-400" />
                    <span>Home Maintenance Planner & Alert Engine</span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Schedule seasonal upkeep tasks, set automatic in-app alerts, and sync dates to Google Calendar.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingTaskId(null);
                    setPlannerTitle("");
                    setPlannerCategory("Any Category");
                    setPlannerNotes("");
                    setShowPlannerForm(!showPlannerForm);
                  }}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-black px-3.5 py-2 rounded-xl border border-white transition shadow flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>{showPlannerForm ? "Cancel" : "+ Schedule New Task"}</span>
                </button>
              </div>

              {/* Interactive Schedule Task Form (If open) */}
              {showPlannerForm && (
                <div className="bg-slate-950/90 border border-white rounded-2xl p-4 space-y-3.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-white/20 pb-2">
                    <span className="text-xs font-black text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {editingTaskId ? "Edit Scheduled Task" : "Schedule New Maintenance Task"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPlannerForm(false)}
                      className="text-slate-400 hover:text-white p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 1-Tap Quick Presets */}
                  {!editingTaskId && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                        ⚡ Quick 1-Tap Presets
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                        {QUICK_SUGGESTION_CHIPS.map((chip, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleQuickChipSelect(chip)}
                            className="text-[10px] font-bold bg-slate-800 hover:bg-purple-900/50 text-slate-200 hover:text-purple-200 border border-white px-2.5 py-1 rounded-xl transition cursor-pointer flex items-center gap-1"
                          >
                            <Plus className="w-2.5 h-2.5 text-purple-400" />
                            <span>{chip.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSaveScheduledTask} className="space-y-3 text-xs">
                    {/* Row 1: Title & Category */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-300 block mb-1">
                          Task Title / Task Name <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={plannerTitle}
                          onChange={(e) => setPlannerTitle(e.target.value)}
                          placeholder="e.g. Annual Boiler Servicing, Gutter Clearance"
                          required
                          className="w-full bg-slate-800 border border-white/20 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-300 block mb-1">Trade Category</label>
                        <select
                          value={plannerCategory}
                          onChange={(e) => setPlannerCategory(e.target.value)}
                          className="w-full bg-slate-800 border border-white/20 rounded-xl px-2.5 py-2 text-white text-xs font-semibold focus:ring-2 focus:ring-purple-500"
                        >
                          {TRADE_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Row 2: Target Date & Alert Timing */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-300 block mb-1">Target Scheduled Date</label>
                        <input
                          type="date"
                          value={plannerTargetDate}
                          onChange={(e) => setPlannerTargetDate(e.target.value)}
                          required
                          className="w-full bg-slate-800 border border-white/20 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-300 block mb-1">In-App Notification Alert</label>
                        <select
                          value={plannerReminderOffset}
                          onChange={(e: any) => setPlannerReminderOffset(e.target.value)}
                          className="w-full bg-slate-800 border border-white/20 rounded-xl px-2.5 py-2 text-white text-xs font-semibold focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="same_day">On the scheduled date</option>
                          <option value="3_days_before">3 days before target date</option>
                          <option value="1_week_before">1 week before target date</option>
                          <option value="2_weeks_before">2 weeks before target date</option>
                          <option value="1_month_before">1 month before target date</option>
                        </select>
                      </div>
                    </div>

                    {/* Row 3: Budget & Notes */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-300 block mb-1">Estimated Budget</label>
                        <input
                          type="text"
                          value={plannerBudget}
                          onChange={(e) => setPlannerBudget(e.target.value)}
                          placeholder="e.g. £100 - £250"
                          className="w-full bg-slate-800 border border-white/20 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold text-slate-300 block mb-1">Notes / Instructions</label>
                        <input
                          type="text"
                          value={plannerNotes}
                          onChange={(e) => setPlannerNotes(e.target.value)}
                          placeholder="e.g. Access via side gate, boiler located in utility room"
                          className="w-full bg-slate-800 border border-white/20 rounded-xl px-3 py-2 text-white text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/20">
                      <button
                        type="button"
                        onClick={() => setShowPlannerForm(false)}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/20 rounded-xl font-bold transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingTask}
                        className="bg-purple-600 hover:bg-purple-500 text-white font-black px-4 py-2 rounded-xl border border-white transition shadow flex items-center gap-1.5"
                      >
                        <CalendarCheck className="w-4 h-4 text-purple-200" />
                        <span>{isSavingTask ? "Saving..." : editingTaskId ? "Update Task" : "Schedule Task"}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Scheduled Tasks List */}
              {scheduledTasks.length === 0 ? (
                <div className="bg-slate-800/40 border border-white rounded-2xl p-6 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-400 border border-white flex items-center justify-center mx-auto">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-white">No Planned Repair Tasks Scheduled</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                      Plan ahead for boiler servicing, gutter clearance, or insurance renewals. We'll automatically notify you when it's time to request trader quotes!
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPlannerForm(true)}
                    className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-black px-4 py-2 rounded-xl border border-white transition shadow flex items-center gap-1.5 mx-auto cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Schedule Your First Task</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {scheduledTasks.map((task) => {
                    const countdown = getDaysRemaining(task.targetDate);
                    return (
                      <div
                        key={task.id}
                        className="bg-slate-800/80 border border-white hover:border-purple-300 rounded-2xl p-3.5 transition space-y-2.5 flex flex-col justify-between group"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-white">
                              {task.category}
                            </span>

                            <span className={cn(
                              "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-white flex items-center gap-1",
                              countdown.isOverdue 
                                ? "bg-red-500/20 text-red-300"
                                : countdown.days === 0
                                ? "bg-amber-500/20 text-amber-300 animate-pulse"
                                : "bg-emerald-500/20 text-emerald-300"
                            )}>
                              <Clock className="w-2.5 h-2.5" />
                              <span>{countdown.text}</span>
                            </span>
                          </div>

                          <div>
                            <h4 className="font-black text-sm text-white group-hover:text-purple-300 transition-colors">
                              {task.title}
                            </h4>
                            {task.notes && (
                              <p className="text-xs text-slate-300 mt-0.5 line-clamp-2 leading-tight">
                                {task.notes}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                            <span className="flex items-center gap-1 text-slate-300 font-semibold">
                              <Calendar className="w-3.5 h-3.5 text-purple-400" />
                              Target: {task.targetDate}
                            </span>
                            <span className="flex items-center gap-1 text-purple-300 font-medium">
                              <Bell className="w-3.5 h-3.5 text-purple-400" />
                              Alert: {task.reminderOffset.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>

                        <div className="pt-2.5 border-t border-white/20 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-black text-emerald-400">
                            {task.estimatedBudget || "Flexible"}
                          </span>

                          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                            {/* Google Calendar Sync */}
                            <button
                              type="button"
                              onClick={() => handleSyncToGCal(task)}
                              className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold p-1.5 sm:px-2 rounded-lg border border-white transition flex items-center gap-1 cursor-pointer"
                              title="Sync to Google Calendar"
                            >
                              <CalendarCheck className="w-3.5 h-3.5 text-blue-400" />
                              <span className="hidden sm:inline">GCal</span>
                            </button>

                            {/* Edit Button */}
                            <button
                              type="button"
                              onClick={() => handleEditScheduledTask(task)}
                              className="bg-slate-700 hover:bg-slate-600 text-slate-200 p-1.5 rounded-lg border border-white transition cursor-pointer"
                              title="Edit Task"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteScheduledTask(task.id)}
                              className="bg-red-950/40 hover:bg-red-900/60 text-red-300 p-1.5 rounded-lg transition cursor-pointer border border-white"
                              title="Delete Task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            {/* ⚡ Post Job Now */}
                            <button
                              type="button"
                              onClick={() => handlePostScheduledTask(task)}
                              className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-white transition flex items-center gap-1 shadow cursor-pointer active:scale-95"
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

          {/* TAB 3: RISK & INSURANCE UNDERWRITING */}
          {activeTab === "risk" && (
            <div className="bg-slate-950/80 border border-white rounded-2xl p-4 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-white/20 pb-2">
                <div>
                  <h3 className="text-sm font-black text-emerald-300 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                    <span>Insurance Underwriter Risk & Premium Analytics</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Risk assessment for {activeProperty?.name || activeProperty?.address?.line1 || "Home"} factoring boiler age, roof condition, and CP12/EICR compliance.
                  </p>
                </div>
              </div>

              <PropertyRiskAnalyticsWidget
                propertyPassport={activeProperty || {
                  name: propertyNameInput || propertyAddressLine || "Home",
                  era: propertyAge,
                  propertyType: propertyType,
                  boilerInfo: { brand: boilerBrand, model: boilerModel, age: boilerAge },
                  roofCondition: roofCondition,
                  epcRating: epcRating,
                  address: { line1: propertyAddressLine, postcode: propertyPostcode }
                }}
                userPostcode={propertyPostcode || userPostcode}
              />
            </div>
          )}

          {/* TAB 4: REPAIR FINANCING (FlexiPay) */}
          {activeTab === "financing" && (
            <div className="bg-slate-950/80 border border-white rounded-2xl p-4 space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/20 pb-3">
                <div>
                  <h3 className="text-sm font-black text-indigo-300 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-indigo-400" />
                    <span>FlexiPay • 0% APR Home Repair Financing</span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Spread unexpected boiler replacements, roof repairs, or emergency jobs (£1,000+) across 3 to 12 months.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowBnplModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-4 py-2 rounded-xl border border-white transition shadow flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <span>Open Full Loan Calculator</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Mini Interactive Preview Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white/5 border border-white rounded-xl p-3 space-y-1">
                  <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">3-Month Term</span>
                  <p className="text-sm font-black text-white">0% APR Interest</p>
                  <p className="text-xs text-slate-400">Equal monthly split with zero extra fees or charges.</p>
                </div>
                <div className="bg-white/5 border border-white rounded-xl p-3 space-y-1">
                  <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">6-Month Term</span>
                  <p className="text-sm font-black text-white">0% APR Fixed</p>
                  <p className="text-xs text-slate-400">Manage major heating and structural repairs smoothly.</p>
                </div>
                <div className="bg-white/5 border border-white rounded-xl p-3 space-y-1">
                  <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">12-Month Term</span>
                  <p className="text-sm font-black text-white">Low-Rate Flexible</p>
                  <p className="text-xs text-slate-400">Spread complete renovations or major rewiring over a full year.</p>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* MODAL 1: Full Property Specifications Form Overlay */}
      {showConfig && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-white/20 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-4 shadow-2xl">
            
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-amber-400" />
                  <span>{activeProperty ? "Edit Property Specifications" : "Add Property Address & Setup Passport"}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Update address, boiler details, roof condition, and compliance dates to power tailored seasonal forecasts.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConfig(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSpecsAndProperty} className="space-y-4 text-xs">
              {/* Row 1: Address Line 1 & Postcode */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-300 block mb-1">
                    Property Address (Line 1) <span className="text-amber-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={propertyAddressLine}
                      onChange={(e) => setPropertyAddressLine(e.target.value)}
                      placeholder="e.g. 14 Elm Street, Flat 2B"
                      required
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-white text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-300 block mb-1">
                    Postcode <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={propertyPostcode}
                    onChange={(e) => setPropertyPostcode(e.target.value.toUpperCase())}
                    placeholder="e.g. M14 5TP"
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none uppercase"
                  />
                </div>
              </div>

              {/* Row 2: Era, Type, and Heating System */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-300 block mb-1">Property Age / Era</label>
                  <select
                    value={propertyAge}
                    onChange={(e) => setPropertyAge(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-white text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Pre-1919 Victorian / Edwardian">Pre-1919 Victorian / Edwardian</option>
                    <option value="1930s-1970s">1930s - 1970s Period Property</option>
                    <option value="1980s-1990s">1980s - 1990s Modern Build</option>
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
                    <option value="Semi-Detached">Semi-Detached</option>
                    <option value="Detached House">Detached House</option>
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

              {/* Row 3: Boiler Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-300 block mb-1">Boiler Brand (optional)</label>
                  <input
                    type="text"
                    value={boilerBrand}
                    onChange={(e) => setBoilerBrand(e.target.value)}
                    placeholder="e.g. Worcester Bosch, Vaillant"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-300 block mb-1">Boiler Model</label>
                  <input
                    type="text"
                    value={boilerModel}
                    onChange={(e) => setBoilerModel(e.target.value)}
                    placeholder="e.g. Greenstar 30i"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-300 block mb-1">Boiler Age</label>
                  <select
                    value={boilerAge}
                    onChange={(e) => setBoilerAge(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-white text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="1">Under 2 years (New)</option>
                    <option value="3">3 - 5 years</option>
                    <option value="7">6 - 9 years</option>
                    <option value="12">10+ years (Replacement recommended)</option>
                  </select>
                </div>
              </div>

              {/* Row 4: Roof, EPC, Compliance */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-300 block mb-1">Roof Condition</label>
                  <select
                    value={roofCondition}
                    onChange={(e) => setRoofCondition(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-white text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Good">Good Condition</option>
                    <option value="Fair">Fair / Aged</option>
                    <option value="Needs Inspection">Needs Inspection</option>
                    <option value="Recently Replaced">Recently Replaced</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-300 block mb-1">EPC Rating</label>
                  <select
                    value={epcRating}
                    onChange={(e) => setEpcRating(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-white text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="A">Grade A (High Efficiency)</option>
                    <option value="B">Grade B</option>
                    <option value="C">Grade C (UK Average)</option>
                    <option value="D">Grade D</option>
                    <option value="E">Grade E</option>
                    <option value="F">Grade F</option>
                    <option value="G">Grade G</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-300 block mb-1">CP12 Gas Expiry</label>
                  <input
                    type="date"
                    value={gasSafetyExpiry}
                    onChange={(e) => setGasSafetyExpiry(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2 py-2 text-white text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-300 block mb-1">EICR Expiry</label>
                  <input
                    type="date"
                    value={eicrExpiry}
                    onChange={(e) => setEicrExpiry(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2 py-2 text-white text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowConfig(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSavingSpecs}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs px-5 py-2.5 rounded-xl transition shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  <span>{isSavingSpecs ? "Saving..." : "Save Specs & Recalculate"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Full Digital Twin Property Passport Modal */}
      {showPassportModal && activeProperty && (
        <PropertyPassportModal
          property={activeProperty}
          onClose={() => setShowPassportModal(false)}
          onUpdated={() => {
            setShowPassportModal(false);
          }}
        />
      )}

      {/* MODAL 3: BNPL Financing Modal */}
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

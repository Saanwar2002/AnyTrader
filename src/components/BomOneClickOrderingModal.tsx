import React, { useState, useEffect } from "react";
import { 
  X, Sparkles, ShoppingBag, Store, Truck, Clock, CheckCircle2, ArrowRight, 
  Plus, Trash2, ShieldCheck, MapPin, Tag, FileText, Share2, Printer, 
  RotateCcw, ChevronRight, AlertCircle, QrCode, DollarSign, PackageCheck,
  Building2, Wrench, ExternalLink, ArrowUpRight, Loader2, Edit3, Check,
  Percent, RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { 
  BOMItem, MerchantQuoteComparison, CourierDispatchDetails, BOMOrderRecord,
  extractBillOfMaterials, compareMerchantsForBOM, calculateCourierDispatchQuote, 
  createBOMOrder, TRADE_MERCHANTS 
} from "@/src/services/bomMerchantService";
import { BomOrderStatusTracker } from "./BomOrderStatusTracker";
import { useAuth } from "./AuthProvider";

interface BomOneClickOrderingModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  quote?: any;
  propertyPassportSpecs?: any;
  onOrderCreated?: (order: BOMOrderRecord) => void;
}

export function BomOneClickOrderingModal({
  isOpen,
  onClose,
  job,
  quote,
  propertyPassportSpecs,
  onOrderCreated
}: BomOneClickOrderingModalProps) {
  const { user, profile } = useAuth();
  
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<BOMItem[]>([]);
  const [merchantComparisons, setMerchantComparisons] = useState<MerchantQuoteComparison[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantQuoteComparison | null>(null);
  
  // Step 3 Fulfillment state
  const [fulfillmentType, setFulfillmentType] = useState<"click_and_collect" | "courier_dispatch">("click_and_collect");
  const [vanType, setVanType] = useState<"small_van" | "swb_transit" | "lwb_luton">("small_van");
  const [deliveryWindow, setDeliveryWindow] = useState<"asap_90min" | "early_morning_0800" | "custom_slot">("early_morning_0800");
  const [deliveryAddress, setDeliveryAddress] = useState(job?.address?.line1 || job?.propertyName || "Site Address");
  const [courierInstructions, setCourierInstructions] = useState("");
  
  // Step 1 Custom Add Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customQty, setCustomQty] = useState(1);
  const [customCost, setCustomCost] = useState("");
  const [customCategory, setCustomCategory] = useState<BOMItem["category"]>("Plumbing & Heating");
  const [customUnit, setCustomUnit] = useState("units");

  // Inline Editing State for existing items
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{
    name: string;
    category: BOMItem["category"];
    quantity: number;
    unitCost: number;
    unit: string;
    sku: string;
    compatibilityNotes: string;
    suggestedSupplier: string;
    isPassportComponent: boolean;
  }>({
    name: "",
    category: "Plumbing & Heating",
    quantity: 1,
    unitCost: 0,
    unit: "item",
    sku: "",
    compatibilityNotes: "",
    suggestedSupplier: "Screwfix Trade",
    isPassportComponent: false
  });

  // Step 4 Completed Order
  const [completedOrder, setCompletedOrder] = useState<BOMOrderRecord | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Initialize and run AI extraction on open
  useEffect(() => {
    if (isOpen) {
      loadAI_BOM();
    }
  }, [isOpen, job?.id]);

  const loadAI_BOM = async () => {
    setLoading(true);
    try {
      const extracted = await extractBillOfMaterials({
        jobTitle: job?.title,
        category: job?.category,
        description: job?.description,
        quoteMessage: quote?.message,
        quoteMaterialList: quote?.materialList,
        propertyPassportSpecs: propertyPassportSpecs || job?.propertyPassportSpecs
      });
      setItems(extracted);

      const postcodeArea = job?.estimatePostcodeArea || job?.postcode || "SW1";
      const comparisons = compareMerchantsForBOM(extracted, postcodeArea);
      setMerchantComparisons(comparisons);
      setSelectedMerchant(comparisons.find(c => c.isBestPrice) || comparisons[0]);
    } catch (err) {
      console.error("Failed to extract BOM:", err);
      toast.error("Failed to load materials");
    } finally {
      setLoading(false);
    }
  };

  // Re-calculate merchant comparisons when items change
  const refreshComparisons = (updatedItems: BOMItem[]) => {
    setItems(updatedItems);
    const postcodeArea = job?.estimatePostcodeArea || job?.postcode || "SW1";
    const comparisons = compareMerchantsForBOM(updatedItems, postcodeArea);
    setMerchantComparisons(comparisons);
    if (selectedMerchant) {
      const updatedMatch = comparisons.find(c => c.merchantName === selectedMerchant.merchantName);
      if (updatedMatch) setSelectedMerchant(updatedMatch);
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const unitCost = parseFloat(customCost) || 12.00;
    const newItem: BOMItem = {
      id: `bom_custom_${Date.now()}`,
      name: customName.trim(),
      sku: `CST-${Math.floor(10000 + Math.random() * 90000)}`,
      category: customCategory,
      quantity: Math.max(1, customQty),
      unit: customUnit,
      unitCost,
      retailCost: Math.round(unitCost * 1.25 * 100) / 100,
      totalCost: Math.max(1, customQty) * unitCost,
      suggestedSupplier: selectedMerchant?.merchantName || "Screwfix Trade",
      stockStatus: "in_stock_1hr"
    };

    const updated = [...items, newItem];
    refreshComparisons(updated);
    setCustomName("");
    setCustomQty(1);
    setCustomCost("");
    setShowAddForm(false);
    toast.success("Added material item to Bill of Materials");
  };

  const handleQuickAddPreset = (presetName: string, category: BOMItem["category"], unitCost: number, unit = "pack") => {
    const newItem: BOMItem = {
      id: `bom_preset_${Date.now()}`,
      name: presetName,
      sku: `PRESET-${Math.floor(1000 + Math.random() * 9000)}`,
      category,
      quantity: 1,
      unit,
      unitCost,
      retailCost: Math.round(unitCost * 1.2 * 100) / 100,
      totalCost: unitCost,
      suggestedSupplier: selectedMerchant?.merchantName || "Screwfix Trade",
      stockStatus: "in_stock_1hr",
      compatibilityNotes: "Standard trade site consumable"
    };
    const updated = [...items, newItem];
    refreshComparisons(updated);
    toast.success(`Added ${presetName} to BOM`);
  };

  const handleStartEdit = (item: BOMItem) => {
    setEditingItemId(item.id);
    setEditFormData({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unitCost: item.unitCost,
      unit: item.unit || "item",
      sku: item.sku || "",
      compatibilityNotes: item.compatibilityNotes || "",
      suggestedSupplier: item.suggestedSupplier || "Screwfix Trade",
      isPassportComponent: Boolean(item.isPassportComponent)
    });
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
  };

  const handleSaveEdit = (id: string) => {
    if (!editFormData.name.trim()) {
      toast.error("Item name cannot be empty");
      return;
    }
    const safeQty = Math.max(1, editFormData.quantity);
    const safeUnitCost = Math.max(0.1, editFormData.unitCost);

    const updated = items.map(item => {
      if (item.id === id) {
        return {
          ...item,
          name: editFormData.name.trim(),
          category: editFormData.category,
          quantity: safeQty,
          unit: editFormData.unit,
          unitCost: safeUnitCost,
          retailCost: Math.round(safeUnitCost * 1.25 * 100) / 100,
          totalCost: safeQty * safeUnitCost,
          sku: editFormData.sku.trim() || item.sku,
          compatibilityNotes: editFormData.compatibilityNotes.trim() || undefined,
          suggestedSupplier: editFormData.suggestedSupplier,
          isPassportComponent: editFormData.isPassportComponent
        };
      }
      return item;
    });

    refreshComparisons(updated);
    setEditingItemId(null);
    toast.success("Material updated and basket recalculated");
  };

  const handleApplyWasteBuffer = (percentage: number) => {
    const updated = items.map(item => {
      const addedQty = Math.ceil(item.quantity * (percentage / 100));
      const newQty = item.quantity + addedQty;
      return {
        ...item,
        quantity: newQty,
        totalCost: newQty * item.unitCost
      };
    });
    refreshComparisons(updated);
    toast.success(`Applied +${percentage}% Trade Waste/Fitting Buffer across all items`);
  };

  const handleRemoveItem = (id: string) => {
    const updated = items.filter(i => i.id !== id);
    if (updated.length === 0) {
      toast.error("At least one material item is required");
      return;
    }
    refreshComparisons(updated);
    toast.info("Item removed from BOM");
  };

  const handleUpdateQuantity = (id: string, newQty: number) => {
    if (newQty < 1) return;
    const updated = items.map(item => {
      if (item.id === id) {
        return {
          ...item,
          quantity: newQty,
          totalCost: newQty * item.unitCost
        };
      }
      return item;
    });
    refreshComparisons(updated);
  };

  // Courier fee calculation
  const courierQuote = calculateCourierDispatchQuote({
    vanType,
    distanceMiles: selectedMerchant?.distanceMiles || 2.5,
    deliveryWindow
  });

  const handleConfirmAndPlaceOrder = async () => {
    if (!selectedMerchant) {
      toast.error("Please select a merchant counter");
      return;
    }

    setIsSubmittingOrder(true);
    try {
      let courierDetails: CourierDispatchDetails | undefined = undefined;

      if (fulfillmentType === "courier_dispatch") {
        courierDetails = {
          vanType,
          vanTypeLabel: courierQuote.vanTypeLabel,
          deliveryWindow,
          scheduledTime: deliveryWindow === "early_morning_0800" ? "Tomorrow 08:00 AM" : "ASAP (Within 90 mins)",
          pickupBranch: selectedMerchant.branchAddress,
          pickupAddress: selectedMerchant.branchAddress,
          deliveryAddress: deliveryAddress || "Site Location",
          estimatedDistanceMiles: selectedMerchant.distanceMiles,
          courierFee: courierQuote.courierFee,
          platformCommission: courierQuote.platformCommission,
          driverPayout: courierQuote.driverPayout,
          status: "assigned",
          driverName: "Dave M. (Category 84 Express Courier)",
          driverPhone: "+44 7700 900482",
          vehiclePlate: "VE72 TKX (Ford Transit Custom)",
          trackingCode: `TRK-VAN-${Math.floor(100000 + Math.random() * 900000)}`,
          notes: courierInstructions.trim() || undefined
        };
      }

      const order = await createBOMOrder({
        jobId: job?.id || "job_demo",
        jobTitle: job?.title || "Trade Renovation Project",
        tradespersonId: user?.uid || "trader_123",
        tradespersonName: profile?.firstName ? `${profile.firstName} ${profile.lastName || ''}` : "Verified Tradesperson",
        homeownerId: job?.homeownerId || job?.userId,
        homeownerName: job?.homeownerName || "Homeowner",
        propertyId: job?.propertyId || job?.linkedPropertyId,
        items,
        selectedMerchant,
        fulfillmentType,
        courierDetails,
        paymentSource: "homeowner_materials_escrow"
      });

      setCompletedOrder(order);
      setCurrentStep(4);
      if (onOrderCreated) onOrderCreated(order);
      toast.success(
        fulfillmentType === "click_and_collect"
          ? `🎉 Click & Collect order reserved at ${selectedMerchant.merchantName}! Ready for 1-minute counter pickup.`
          : `🚀 On-Demand Category 84 Courier dispatched! Driver arriving at site by ${courierDetails?.scheduledTime}.`
      );
    } catch (err) {
      console.error("Order creation failed:", err);
      toast.error("Failed to place BOM order");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const totalTradePrice = items.reduce((sum, i) => sum + i.totalCost, 0);
  const totalRetailPrice = items.reduce((sum, i) => sum + (i.retailCost * i.quantity), 0);
  const totalEstimatedSavings = Math.max(0, totalRetailPrice - (selectedMerchant?.basketTotal || totalTradePrice));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-4xl bg-slate-900 text-white rounded-3xl border border-white/20 shadow-2xl overflow-hidden my-auto relative"
      >
        {/* Header Bar */}
        <div className="p-4 sm:p-6 bg-slate-950 border-b border-white/10 flex items-start justify-between gap-3 sm:gap-4 relative">
          <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 flex-1 min-w-0 pr-2">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
              <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3 className="text-sm sm:text-lg font-black text-white tracking-tight leading-tight">
                  Direct Merchant AI "BOM" One-Click Ordering
                </h3>
                <span className="text-[9px] sm:text-[10px] bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                  TradeOS Core
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 font-medium leading-snug">
                Extract required parts, compare trade prices across Screwfix/Travis Perkins, and skip the 2-hour morning queue.
              </p>
            </div>
          </div>

          {/* Prominent High-Visibility Close Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close BOM Ordering Modal"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white/10 hover:bg-red-500/80 text-slate-300 hover:text-white transition-all border border-white/20 hover:border-red-400 flex items-center justify-center shrink-0 shadow-lg active:scale-95 cursor-pointer z-10 group"
            title="Close BOM modal"
          >
            <X className="w-5 h-5 group-hover:scale-110 transition-transform text-white" />
          </button>
        </div>

        {/* 4-Step Progress Navigation Bar */}
        <div className="grid grid-cols-4 bg-slate-950/80 border-b border-white/10 text-xs font-bold">
          {[
            { step: 1, label: "1. AI BOM Items", icon: Sparkles },
            { step: 2, label: "2. Compare Merchants", icon: Store },
            { step: 3, label: "3. 1-Click Fulfillment", icon: Truck },
            { step: 4, label: "4. VAT Receipt & Specs", icon: FileText }
          ].map(s => {
            const Icon = s.icon;
            const isActive = currentStep === s.step;
            const isDone = currentStep > s.step;
            return (
              <button
                key={s.step}
                onClick={() => {
                  if (currentStep !== 4 && s.step < currentStep) setCurrentStep(s.step as any);
                }}
                disabled={currentStep === 4}
                className={`py-3 px-2 flex items-center justify-center gap-1.5 transition text-center border-r border-white/10 last:border-r-0 ${
                  isActive 
                    ? "bg-amber-400 text-slate-950 font-black shadow-sm"
                    : isDone
                    ? "bg-emerald-500/20 text-emerald-300 font-extrabold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline text-[11px] truncate">{s.label}</span>
                <span className="sm:hidden text-[10px]">Step {s.step}</span>
              </button>
            );
          })}
        </div>

        {/* Main Body */}
        <div className="p-5 sm:p-6 max-h-[70vh] overflow-y-auto space-y-6">
          {loading ? (
            <div className="py-16 text-center space-y-4">
              <Loader2 className="w-10 h-10 text-amber-400 animate-spin mx-auto" />
              <div className="space-y-1">
                <h4 className="text-base font-extrabold text-white">AI Gemini is parsing quote and specs...</h4>
                <p className="text-xs text-slate-400">Extracting raw materials, cross-referencing Property Passport, and checking local trade stock.</p>
              </div>
            </div>
          ) : (
            <>
              {/* ================= STEP 1: AI BOM ITEMS ================= */}
              {currentStep === 1 && (
                <div className="space-y-5">
                  {/* Top Stats Banner */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3.5 bg-white/5 rounded-2xl border border-white/15">
                      <p className="text-[10px] font-extrabold uppercase text-slate-400">Parts Required</p>
                      <p className="text-lg font-black text-amber-400 mt-0.5">{items.length} Items</p>
                    </div>
                    <div className="p-3.5 bg-white/5 rounded-2xl border border-white/15">
                      <p className="text-[10px] font-extrabold uppercase text-slate-400">Trade Price Total</p>
                      <p className="text-lg font-black text-emerald-400 mt-0.5">£{totalTradePrice.toFixed(2)}</p>
                    </div>
                    <div className="p-3.5 bg-white/5 rounded-2xl border border-white/15">
                      <p className="text-[10px] font-extrabold uppercase text-slate-400">Standard Retail</p>
                      <p className="text-lg font-black text-slate-300 mt-0.5 line-through">£{totalRetailPrice.toFixed(2)}</p>
                    </div>
                    <div className="p-3.5 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 rounded-2xl border border-emerald-400/30">
                      <p className="text-[10px] font-extrabold uppercase text-emerald-300">TradeOS Savings</p>
                      <p className="text-lg font-black text-emerald-300 mt-0.5">+£{totalEstimatedSavings.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Quote Scope & Billing Transparency Banner */}
                  <div className={`p-3.5 rounded-2xl border flex items-start gap-3 text-xs ${
                    quote?.quoteScope === "labour_only" 
                      ? "bg-amber-500/10 border-amber-400/30 text-amber-200" 
                      : "bg-emerald-500/10 border-emerald-400/30 text-emerald-200"
                  }`}>
                    <ShieldCheck className={`w-4 h-4 shrink-0 mt-0.5 ${
                      quote?.quoteScope === "labour_only" ? "text-amber-400" : "text-emerald-400"
                    }`} />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="font-extrabold text-white text-xs">
                          {quote?.quoteScope === "labour_only" ? "Labour Only Quote Scope" : "All-Inclusive Package Scope"}
                        </p>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          quote?.quoteScope === "labour_only" 
                            ? "bg-amber-400 text-slate-950" 
                            : "bg-emerald-400 text-slate-950"
                        }`}>
                          {quote?.quoteScope === "labour_only" ? "Homeowner Supplies Parts" : "Parts Included in Quote"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">
                        {quote?.quoteScope === "labour_only"
                          ? "The agreed quote covers labour only. Materials are charged directly at merchant trade trade price with 0% AnyTrader markup."
                          : `Materials are funded out of the agreed all-inclusive quote (£${quote?.amount || quote?.total || 'Agreed'}). Homeowner will not be billed twice.`}
                      </p>
                    </div>
                  </div>

                  {/* AI Extraction Context Banner */}
                  <div className="p-3.5 bg-blue-500/15 border border-blue-400/30 rounded-2xl flex items-start gap-3 text-xs">
                    <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-extrabold text-blue-200">
                        Extracted from accepted quote "{job?.title || 'Job Scope'}"
                      </p>
                      <p className="text-slate-300 text-[11px] mt-0.5">
                        Materials cross-referenced against UK Building Regulations (BS 7671, Part P/L) and local merchant inventory.
                        {propertyPassportSpecs?.boilerBrand && ` Spec matches ${propertyPassportSpecs.boilerBrand} heating specs.`}
                      </p>
                    </div>
                  </div>

                  {/* Materials Table Header & Quick Action Bar */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                          Bill of Materials (BOM) Itemized List
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Add, modify prices, tweak quantities, or customize before routing to suppliers.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleApplyWasteBuffer(10)}
                          className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-slate-200 text-[11px] font-bold rounded-xl border border-white/20 transition flex items-center gap-1"
                          title="Increase quantities by 10% to account for cuts and fitting waste"
                        >
                          <Percent className="w-3 h-3 text-amber-400" />
                          <span>+10% Waste Buffer</span>
                        </button>

                        <button
                          type="button"
                          onClick={loadAI_BOM}
                          className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-slate-300 text-[11px] font-bold rounded-xl border border-white/20 transition flex items-center gap-1"
                          title="Re-run AI extraction from the quote and Property Passport"
                        >
                          <RefreshCw className="w-3 h-3 text-blue-400" />
                          <span>Re-extract AI</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowAddForm(!showAddForm)}
                          className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black rounded-xl transition flex items-center gap-1 shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Custom Part</span>
                        </button>
                      </div>
                    </div>

                    {/* Quick Trade Consumables Chips */}
                    <div className="p-2.5 bg-slate-950/80 rounded-2xl border border-white/10 space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                        <Wrench className="w-3 h-3" /> Quick Add Site Consumables:
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleQuickAddPreset("PTFE Thread Seal Tape (Pack of 5)", "Plumbing & Heating", 2.20, "pack")}
                          className="text-[11px] bg-white/5 hover:bg-white/15 text-slate-200 border border-white/15 px-2.5 py-1 rounded-xl transition font-medium active:scale-95"
                        >
                          + PTFE Tape (£2.20)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAddPreset("Wago 221 3-Way Connectors (Pack of 50)", "Electrical", 15.40, "box")}
                          className="text-[11px] bg-white/5 hover:bg-white/15 text-slate-200 border border-white/15 px-2.5 py-1 rounded-xl transition font-medium active:scale-95"
                        >
                          + Wago 221 Box (£15.40)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAddPreset("Heavy Duty Rubble Sacks (Pack of 10)", "Tools & PPE", 4.50, "pack")}
                          className="text-[11px] bg-white/5 hover:bg-white/15 text-slate-200 border border-white/15 px-2.5 py-1 rounded-xl transition font-medium active:scale-95"
                        >
                          + Rubble Sacks (£4.50)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAddPreset("Sanitary Silicone Sealant (White 310ml)", "Fixings & Consumables", 5.80, "tube")}
                          className="text-[11px] bg-white/5 hover:bg-white/15 text-slate-200 border border-white/15 px-2.5 py-1 rounded-xl transition font-medium active:scale-95"
                        >
                          + Silicone Sealant (£5.80)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAddPreset("Assorted Wall Plugs & Screws Case (300 Pcs)", "Fixings & Consumables", 8.90, "kit")}
                          className="text-[11px] bg-white/5 hover:bg-white/15 text-slate-200 border border-white/15 px-2.5 py-1 rounded-xl transition font-medium active:scale-95"
                        >
                          + Screws & Plugs Kit (£8.90)
                        </button>
                      </div>
                    </div>

                    {/* Add Custom Item Form */}
                    <AnimatePresence>
                      {showAddForm && (
                        <motion.form
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          onSubmit={handleAddItem}
                          className="p-4 bg-white text-slate-900 rounded-2xl border border-black space-y-3 shadow-md"
                        >
                          <div className="flex items-center justify-between">
                            <h5 className="font-black text-xs text-slate-900 flex items-center gap-1.5">
                              <Plus className="w-3.5 h-3.5 text-amber-600" />
                              <span>Add Custom Material to BOM</span>
                            </h5>
                            <button 
                              type="button" 
                              onClick={() => setShowAddForm(false)} 
                              className="text-slate-500 hover:text-black p-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                            <input
                              type="text"
                              required
                              placeholder="Part Name & Spec (e.g. 15mm Chrome Lever Valves)"
                              value={customName}
                              onChange={(e) => setCustomName(e.target.value)}
                              className="sm:col-span-5 p-2 rounded-xl border border-black text-xs font-medium bg-slate-50"
                            />
                            <select
                              value={customCategory}
                              onChange={(e) => setCustomCategory(e.target.value as any)}
                              className="sm:col-span-3 p-2 rounded-xl border border-black text-xs font-bold bg-slate-50"
                            >
                              <option value="Plumbing & Heating">Plumbing & Heating</option>
                              <option value="Electrical">Electrical</option>
                              <option value="Building & Timber">Building & Timber</option>
                              <option value="Fixings & Consumables">Fixings & Consumables</option>
                              <option value="Tiling & Flooring">Tiling & Flooring</option>
                              <option value="Decorating">Decorating</option>
                              <option value="Tools & PPE">Tools & PPE</option>
                            </select>
                            <input
                              type="number"
                              min="1"
                              placeholder="Qty"
                              value={customQty}
                              onChange={(e) => setCustomQty(parseInt(e.target.value) || 1)}
                              className="sm:col-span-2 p-2 rounded-xl border border-black text-xs font-bold text-center bg-slate-50"
                            />
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Unit £"
                              value={customCost}
                              onChange={(e) => setCustomCost(e.target.value)}
                              className="sm:col-span-2 p-2 rounded-xl border border-black text-xs font-bold text-center bg-slate-50"
                            />
                          </div>

                          <button
                            type="submit"
                            className="w-full py-2 bg-slate-900 hover:bg-black text-amber-400 font-extrabold text-xs rounded-xl transition"
                          >
                            Save Item to Bill of Materials
                          </button>
                        </motion.form>
                      )}
                    </AnimatePresence>

                    {/* Items Card List */}
                    <div className="space-y-2.5">
                      {items.map((item) => {
                        const isEditing = editingItemId === item.id;

                        if (isEditing) {
                          return (
                            <motion.div
                              key={item.id}
                              initial={{ opacity: 0, scale: 0.98 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="p-4 bg-amber-50 text-slate-900 rounded-2xl border-2 border-amber-400 shadow-lg space-y-3"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Edit3 className="w-4 h-4 text-amber-700" />
                                  <h5 className="text-xs font-black text-slate-950 uppercase tracking-wide">
                                    Modify Material Specification
                                  </h5>
                                </div>
                                <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-md">
                                  Editing SKU: {item.sku || 'TRADE-PART'}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                                <div className="sm:col-span-7">
                                  <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                                    Part Name & Technical Description
                                  </label>
                                  <input
                                    type="text"
                                    value={editFormData.name}
                                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                    className="w-full p-2 bg-white rounded-xl border border-black text-xs font-bold"
                                    placeholder="Part description..."
                                  />
                                </div>

                                <div className="sm:col-span-5">
                                  <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                                    Trade Category
                                  </label>
                                  <select
                                    value={editFormData.category}
                                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value as any })}
                                    className="w-full p-2 bg-white rounded-xl border border-black text-xs font-bold"
                                  >
                                    <option value="Plumbing & Heating">Plumbing & Heating</option>
                                    <option value="Electrical">Electrical</option>
                                    <option value="Building & Timber">Building & Timber</option>
                                    <option value="Fixings & Consumables">Fixings & Consumables</option>
                                    <option value="Tiling & Flooring">Tiling & Flooring</option>
                                    <option value="Decorating">Decorating</option>
                                    <option value="Tools & PPE">Tools & PPE</option>
                                  </select>
                                </div>

                                <div className="sm:col-span-3">
                                  <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                                    Quantity
                                  </label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={editFormData.quantity}
                                    onChange={(e) => setEditFormData({ ...editFormData, quantity: parseInt(e.target.value) || 1 })}
                                    className="w-full p-2 bg-white rounded-xl border border-black text-xs font-black text-center"
                                  />
                                </div>

                                <div className="sm:col-span-3">
                                  <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                                    Unit Type
                                  </label>
                                  <input
                                    type="text"
                                    value={editFormData.unit}
                                    onChange={(e) => setEditFormData({ ...editFormData, unit: e.target.value })}
                                    className="w-full p-2 bg-white rounded-xl border border-black text-xs font-medium text-center"
                                    placeholder="units / m / pack"
                                  />
                                </div>

                                <div className="sm:col-span-3">
                                  <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                                    Trade Price (£)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0.10"
                                    value={editFormData.unitCost}
                                    onChange={(e) => setEditFormData({ ...editFormData, unitCost: parseFloat(e.target.value) || 0 })}
                                    className="w-full p-2 bg-white rounded-xl border border-black text-xs font-black text-emerald-800 text-center"
                                  />
                                </div>

                                <div className="sm:col-span-3">
                                  <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                                    Supplier Code / SKU
                                  </label>
                                  <input
                                    type="text"
                                    value={editFormData.sku}
                                    onChange={(e) => setEditFormData({ ...editFormData, sku: e.target.value })}
                                    className="w-full p-2 bg-white rounded-xl border border-black text-xs font-mono"
                                    placeholder="e.g. 7428H"
                                  />
                                </div>

                                <div className="sm:col-span-8">
                                  <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                                    Compatibility & Installation Notes
                                  </label>
                                  <input
                                    type="text"
                                    value={editFormData.compatibilityNotes}
                                    onChange={(e) => setEditFormData({ ...editFormData, compatibilityNotes: e.target.value })}
                                    className="w-full p-2 bg-white rounded-xl border border-black text-xs font-medium"
                                    placeholder="e.g. Matches existing 22mm flow manifold..."
                                  />
                                </div>

                                <div className="sm:col-span-4 flex items-center pt-4">
                                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                                    <input
                                      type="checkbox"
                                      checked={editFormData.isPassportComponent}
                                      onChange={(e) => setEditFormData({ ...editFormData, isPassportComponent: e.target.checked })}
                                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="flex items-center gap-1 text-[11px]">
                                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                                      Register in Property Passport
                                    </span>
                                  </label>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-amber-200">
                                <div className="text-xs text-slate-700">
                                  New Line Total: <strong className="text-emerald-700 font-mono">£{(Math.max(1, editFormData.quantity) * Math.max(0, editFormData.unitCost)).toFixed(2)}</strong>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEdit(item.id)}
                                    className="px-4 py-1.5 bg-slate-900 hover:bg-black text-amber-400 font-black text-xs rounded-xl transition flex items-center gap-1 shadow-sm"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Save Changes</span>
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          );
                        }

                        return (
                          <div
                            key={item.id}
                            className="p-3 sm:p-3.5 bg-white text-slate-900 rounded-2xl border border-black flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm hover:border-amber-400 transition group overflow-hidden"
                          >
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                <span className="font-black text-xs text-slate-950 leading-tight">
                                  {item.name}
                                </span>
                                <span className="text-[9px] bg-slate-100 text-slate-700 font-extrabold px-2 py-0.5 rounded-full border border-slate-300 shrink-0">
                                  {item.category}
                                </span>
                                {item.isPassportComponent && (
                                  <span className="text-[9px] bg-blue-100 text-blue-800 font-extrabold px-2 py-0.5 rounded-full border border-blue-300 flex items-center gap-1 shrink-0">
                                    <ShieldCheck className="w-2.5 h-2.5" /> Passport Component
                                  </span>
                                )}
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-slate-600">
                                <span>SKU: <strong className="font-mono text-slate-900">{item.sku || 'TRADE-PART'}</strong></span>
                                <span>•</span>
                                <span>Trade Unit: <strong className="text-emerald-700">£{item.unitCost.toFixed(2)}</strong> {item.unit && `/${item.unit}`}</span>
                                <span>•</span>
                                <span>Suggested: <strong className="text-blue-700">{item.suggestedSupplier}</strong></span>
                              </div>

                              {item.compatibilityNotes && (
                                <p className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg inline-block border border-emerald-200">
                                  ✓ {item.compatibilityNotes}
                                </p>
                              )}
                            </div>

                            {/* Controls & Price - Arranged with Edit & Trash on left, Quantity in middle, Price on right */}
                            <div className="flex items-center justify-between sm:justify-end gap-3 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                              {/* Left Column: Edit Button & Trash Button below it */}
                              <div className="flex flex-col items-center justify-center gap-1 shrink-0 min-w-[62px]">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(item)}
                                  className="w-full px-2 py-1 text-xs font-bold text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-amber-100 hover:border-amber-300 border border-slate-200 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                                  title="Edit item name, unit cost, SKU or notes"
                                >
                                  <Edit3 className="w-3 h-3 text-amber-600" />
                                  <span>Edit</span>
                                </button>

                                {/* Double-confirmation Trash Button below edit tab */}
                                {confirmDeleteId === item.id ? (
                                  <div className="flex items-center gap-1 bg-red-50 p-1 rounded-xl border border-red-300 shadow-inner animate-in fade-in zoom-in-95 duration-150">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleRemoveItem(item.id);
                                        setConfirmDeleteId(null);
                                      }}
                                      className="px-1.5 py-0.5 bg-red-600 hover:bg-red-700 text-white font-black text-[9px] rounded-lg shadow-sm active:scale-95 transition flex items-center gap-0.5 cursor-pointer"
                                      title="Confirm delete this material"
                                    >
                                      <Trash2 className="w-2.5 h-2.5" />
                                      <span>Del</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="px-1 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[9px] rounded-lg transition cursor-pointer"
                                      title="Cancel delete"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(item.id)}
                                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition flex items-center justify-center cursor-pointer"
                                    title="Delete Item (Tap to confirm)"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              {/* Quantity Adjuster */}
                              <div className="flex items-center bg-slate-100 rounded-xl border border-slate-300 p-0.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                                  className="w-7 h-7 rounded-lg bg-white text-slate-900 font-black text-xs hover:bg-slate-200 transition flex items-center justify-center cursor-pointer shadow-xs"
                                  title="Decrease quantity"
                                >
                                  -
                                </button>
                                <span className="w-7 text-center text-xs font-black text-slate-900">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                                  className="w-7 h-7 rounded-lg bg-white text-slate-900 font-black text-xs hover:bg-slate-200 transition flex items-center justify-center cursor-pointer shadow-xs"
                                  title="Increase quantity"
                                >
                                  +
                                </button>
                              </div>

                              {/* Price on the right of quantity counter */}
                              <div className="text-right min-w-[65px] pl-1">
                                <p className="text-sm sm:text-base font-black text-slate-950 font-mono tracking-tight">
                                  £{item.totalCost.toFixed(2)}
                                </p>
                                <p className="text-[10px] text-slate-400 line-through">
                                  £{(item.retailCost * item.quantity).toFixed(2)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ================= STEP 2: COMPARE MERCHANTS ================= */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">
                        Local Merchant Price & Stock Benchmark
                      </h4>
                      <p className="text-[11px] text-slate-300">
                        Live comparison for {items.length} BOM items near {job?.estimatePostcodeArea || job?.postcode || "your job site"}.
                      </p>
                    </div>
                    <span className="text-xs font-black text-amber-400 bg-amber-400/20 px-2.5 py-1 rounded-xl border border-amber-400/30">
                      3.0% – 5.0% Affiliate Earned
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {merchantComparisons.map((m) => {
                      const isSelected = selectedMerchant?.merchantName === m.merchantName;
                      return (
                        <div
                          key={m.merchantName}
                          onClick={() => setSelectedMerchant(m)}
                          className={`p-4 rounded-2xl border transition cursor-pointer relative space-y-3 ${
                            isSelected
                              ? "bg-white text-slate-900 border-amber-400 ring-2 ring-amber-400 shadow-xl"
                              : "bg-white/5 text-white border-white/15 hover:bg-white/10 hover:border-white/30"
                          }`}
                        >
                          {/* Badges */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${m.logoColor}`} />
                              <h5 className={`font-black text-sm ${isSelected ? 'text-slate-950' : 'text-white'}`}>
                                {m.merchantName}
                              </h5>
                            </div>
                            <div className="flex items-center gap-1">
                              {m.isBestPrice && (
                                <span className="text-[9px] bg-emerald-500 text-slate-950 font-black px-2 py-0.5 rounded-full">
                                  ★ Best Price
                                </span>
                              )}
                              {m.isClosest && (
                                <span className="text-[9px] bg-blue-500 text-white font-black px-2 py-0.5 rounded-full">
                                  📍 Closest ({m.distanceMiles} mi)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Pricing & Savings */}
                          <div className="flex items-baseline justify-between pt-1">
                            <div>
                              <p className={`text-2xl font-black ${isSelected ? 'text-slate-950' : 'text-amber-400'}`}>
                                £{m.basketTotal.toFixed(2)}
                              </p>
                              <p className={`text-[10px] font-bold ${isSelected ? 'text-slate-500' : 'text-slate-400'}`}>
                                Retail Value: <span className="line-through">£{m.retailTotal.toFixed(2)}</span>
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                                Save £{m.tradeSavingsAmount.toFixed(2)} ({m.tradeSavingsPercent}%)
                              </span>
                              <p className={`text-[10px] mt-1 font-mono ${isSelected ? 'text-slate-600' : 'text-slate-400'}`}>
                                {m.affiliateBreakdown.traderDiscountCode}
                              </p>
                            </div>
                          </div>

                          {/* Branch & Pick Speed */}
                          <div className={`text-[11px] pt-2 border-t space-y-1 ${isSelected ? 'border-slate-200 text-slate-600' : 'border-white/10 text-slate-300'}`}>
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-500" />
                                <strong>{m.pickSpeed}</strong>
                              </span>
                              <span className="font-bold text-emerald-600">
                                ✓ {m.inStockCount}/{m.totalItems} In Stock Now
                              </span>
                            </div>
                            <p className="truncate text-[10px]">
                              {m.branchAddress} • {m.openHours}
                            </p>
                          </div>

                          {/* Affiliate fee footer */}
                          <div className={`p-2 rounded-xl text-[10px] font-bold flex items-center justify-between ${
                            isSelected ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-white/5 text-amber-300'
                          }`}>
                            <span>TradeOS Affiliate Share</span>
                            <span className="font-black">+£{m.affiliateBreakdown.affiliateCommissionAmount.toFixed(2)} ({ (m.affiliateBreakdown.affiliateRate * 100).toFixed(1) }%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ================= STEP 3: 1-CLICK FULFILLMENT ================= */}
              {currentStep === 3 && (
                <div className="space-y-5">
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                    <h4 className="text-xs font-black text-white uppercase tracking-wider">
                      Choose How Materials Reach the Site
                    </h4>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Selected Supplier: <strong className="text-amber-400">{selectedMerchant?.merchantName}</strong> (£{selectedMerchant?.basketTotal.toFixed(2)})
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Option A: Click & Collect */}
                    <div
                      onClick={() => setFulfillmentType("click_and_collect")}
                      className={`p-5 rounded-3xl border transition cursor-pointer space-y-3 relative ${
                        fulfillmentType === "click_and_collect"
                          ? "bg-white text-slate-900 border-amber-400 ring-2 ring-amber-400 shadow-xl"
                          : "bg-white/5 text-white border-white/15 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold">
                          <Store className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black uppercase bg-emerald-500 text-slate-950 px-2.5 py-1 rounded-full">
                          FREE • 1-Minute Pick
                        </span>
                      </div>

                      <div>
                        <h5 className={`font-black text-base ${fulfillmentType === "click_and_collect" ? 'text-slate-950' : 'text-white'}`}>
                          Option 1: Express Click & Collect
                        </h5>
                        <p className={`text-xs mt-1 ${fulfillmentType === "click_and_collect" ? 'text-slate-600' : 'text-slate-300'}`}>
                          Bypass morning queues. Pre-picked & bagged at the trade counter before you arrive.
                        </p>
                      </div>

                      <div className={`p-3 rounded-2xl text-xs space-y-1.5 ${
                        fulfillmentType === "click_and_collect" ? 'bg-slate-100 text-slate-800' : 'bg-white/5 text-slate-200'
                      }`}>
                        <p className="flex items-center gap-1.5 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Dedicated TradeOS Fast-Track Lane</span>
                        </p>
                        <p className="flex items-center gap-1.5 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Instant digital barcode sent to your phone</span>
                        </p>
                        <p className="flex items-center gap-1.5 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{selectedMerchant?.openHours}</span>
                        </p>
                      </div>
                    </div>

                    {/* Option B: On-Demand Courier Dispatch (Category 84) */}
                    <div
                      onClick={() => setFulfillmentType("courier_dispatch")}
                      className={`p-5 rounded-3xl border transition cursor-pointer space-y-3 relative ${
                        fulfillmentType === "courier_dispatch"
                          ? "bg-white text-slate-900 border-amber-400 ring-2 ring-amber-400 shadow-xl"
                          : "bg-white/5 text-white border-white/15 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                          <Truck className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black uppercase bg-purple-600 text-white px-2.5 py-1 rounded-full">
                          Category 84 Van Courier
                        </span>
                      </div>

                      <div>
                        <h5 className={`font-black text-base ${fulfillmentType === "courier_dispatch" ? 'text-slate-950' : 'text-white'}`}>
                          Option 2: Site Courier Van Delivery
                        </h5>
                        <p className={`text-xs mt-1 ${fulfillmentType === "courier_dispatch" ? 'text-slate-600' : 'text-slate-300'}`}>
                          Auto-posts to AnyTrader Category 84 Van Fleet. A verified local courier collects materials from trade counter and delivers straight to site.
                        </p>
                      </div>

                      <div className={`p-3.5 rounded-2xl text-xs space-y-1.5 border transition ${
                        fulfillmentType === "courier_dispatch" 
                          ? 'bg-purple-50 text-slate-900 border-purple-200' 
                          : 'bg-white/10 text-white border-white/10'
                      }`}>
                        <div className="flex justify-between items-center">
                          <span className={`font-bold text-xs ${fulfillmentType === "courier_dispatch" ? 'text-slate-900' : 'text-slate-100'}`}>
                            Courier Delivery Fee:
                          </span>
                          <span className="font-black text-xs sm:text-sm text-white bg-purple-600 px-2.5 py-1 rounded-lg font-mono shadow-sm tracking-wide">
                            £{courierQuote.courierFee.toFixed(2)}
                          </span>
                        </div>
                        <p className={`text-[11px] font-medium leading-relaxed ${
                          fulfillmentType === "courier_dispatch" ? 'text-slate-700' : 'text-slate-200'
                        }`}>
                          ⚡ Saves 1.5 - 2.0 hours of trader billable labor time.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* If Courier Delivery Selected - Van & Slot Configuration */}
                  {fulfillmentType === "courier_dispatch" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="p-4 bg-white text-slate-900 rounded-3xl border border-black space-y-3"
                    >
                      <h5 className="font-black text-xs text-slate-900 uppercase tracking-wider">
                        Configure Category 84 Courier Dispatch
                      </h5>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[
                          { id: "small_van", label: "Small Van (Combo/Caddy)", price: "£18.00" },
                          { id: "swb_transit", label: "SWB Transit (Plasterboard)", price: "£28.00" },
                          { id: "lwb_luton", label: "LWB Luton (Bulky/Pallets)", price: "£42.00" }
                        ].map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setVanType(v.id as any)}
                            className={`p-2.5 rounded-xl border text-xs font-bold transition text-left flex justify-between items-center ${
                              vanType === v.id
                                ? "bg-slate-900 text-white border-black"
                                : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                            }`}
                          >
                            <span>{v.label}</span>
                            <span className="font-black">{v.price}</span>
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">
                            Delivery Window
                          </label>
                          <select
                            value={deliveryWindow}
                            onChange={(e) => setDeliveryWindow(e.target.value as any)}
                            className="w-full p-2.5 rounded-xl border border-black text-xs font-bold bg-slate-50"
                          >
                            <option value="early_morning_0800">Tomorrow Morning 08:00 AM on site</option>
                            <option value="asap_90min">⚡ ASAP Rush (Within 90 mins)</option>
                            <option value="custom_slot">Custom Slot (12:00 PM Midday)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">
                            Site Delivery Address
                          </label>
                          <input
                            type="text"
                            value={deliveryAddress}
                            onChange={(e) => setDeliveryAddress(e.target.value)}
                            placeholder="Site Postcode / Street address"
                            className="w-full p-2.5 rounded-xl border border-black text-xs font-bold bg-slate-50"
                          />
                        </div>
                      </div>

                      {/* Custom Instructions for Courier */}
                      <div className="pt-2 border-t border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-extrabold uppercase text-slate-600 flex items-center gap-1.5">
                            <span>Courier Access & Site Delivery Instructions</span>
                            <span className="text-[9px] font-medium text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded">Optional</span>
                          </label>
                          {courierInstructions && (
                            <button
                              type="button"
                              onClick={() => setCourierInstructions("")}
                              className="text-[10px] text-red-600 hover:text-red-700 font-bold transition cursor-pointer"
                            >
                              ✕ Clear
                            </button>
                          )}
                        </div>
                        <textarea
                          rows={2}
                          value={courierInstructions}
                          onChange={(e) => setCourierInstructions(e.target.value)}
                          placeholder="e.g. Leave materials beside the rear gate behind van. Call 07700 900482 upon arrival if gate is locked."
                          className="w-full p-2.5 rounded-xl border border-black text-xs font-medium text-slate-900 bg-slate-50 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600 resize-none shadow-inner"
                        />
                        {/* Quick preset suggestion chips */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className="text-[10px] text-slate-500 font-bold">Quick presets:</span>
                          {[
                            "Leave by side gate",
                            "Call on arrival",
                            "Knock loud / ring bell",
                            "Rear lane / back entrance",
                            "Under porch / keep dry"
                          ].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => {
                                setCourierInstructions(prev => {
                                  const trimmed = prev.trim();
                                  if (!trimmed) return preset;
                                  if (trimmed.includes(preset)) return trimmed;
                                  return `${trimmed}, ${preset}`;
                                });
                              }}
                              className="text-[10px] font-semibold bg-slate-100 hover:bg-purple-100 hover:text-purple-900 hover:border-purple-300 text-slate-700 px-2 py-1 rounded-lg border border-slate-300 transition-all cursor-pointer active:scale-95"
                            >
                              + {preset}
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {/* ================= STEP 4: ORDER CONFIRMATION & ANIMATED STATUS TRACKER ================= */}
              {currentStep === 4 && completedOrder && (
                <div className="space-y-5">
                  {/* Animated Status Tracker Component */}
                  <BomOrderStatusTracker
                    order={completedOrder}
                    onStatusUpdate={(newStatus) => {
                      setCompletedOrder({
                        ...completedOrder,
                        status: newStatus
                      });
                    }}
                    allowManualStageTesting={true}
                  />

                  {/* VAT Invoice & Making Tax Digital (MTD) Summary */}
                  <div className="p-4 bg-white text-slate-900 rounded-3xl border border-black space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <h5 className="font-black text-xs text-slate-900 uppercase tracking-wider">
                          Digital VAT Receipt ({completedOrder.vatInvoiceNumber})
                        </h5>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        HMRC MTD Tax Tagged
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-[9px] uppercase font-bold text-slate-400">Net Materials</p>
                        <p className="font-black text-slate-900">£{completedOrder.subtotalCost.toFixed(2)}</p>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-[9px] uppercase font-bold text-slate-400">VAT (20%)</p>
                        <p className="font-black text-slate-900">£{completedOrder.vatAmount.toFixed(2)}</p>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-[9px] uppercase font-bold text-slate-400">Trade Savings</p>
                        <p className="font-black text-emerald-700">-£{completedOrder.tradeDiscountAmount.toFixed(2)}</p>
                      </div>
                      <div className="p-2.5 bg-slate-900 text-white rounded-xl border border-black">
                        <p className="text-[9px] uppercase font-bold text-slate-300">Total Charged</p>
                        <p className="font-black text-amber-400">£{completedOrder.totalAmount.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Action Buttons */}
        <div className="p-4 sm:p-5 bg-slate-950 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400 w-full sm:w-auto justify-between sm:justify-start">
            {currentStep < 4 ? (
              <span>
                Step {currentStep} of 3 • Total Trade Basket: <strong className="text-amber-400">£{(selectedMerchant?.basketTotal || totalTradePrice).toFixed(2)}</strong>
              </span>
            ) : (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Order Completed & Dispatched
              </span>
            )}

            {/* Mobile Close shortcut in footer */}
            <button
              type="button"
              onClick={onClose}
              className="sm:hidden text-xs text-slate-400 hover:text-white underline decoration-slate-600"
            >
              Close
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* Step 1: Close / Cancel Button */}
            {currentStep === 1 && (
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white font-bold text-xs rounded-xl border border-white/20 transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel / Close</span>
              </button>
            )}

            {/* Steps 2 & 3: Back Button */}
            {currentStep > 1 && currentStep < 4 && (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-3 bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white font-semibold text-xs rounded-xl border border-white/10 transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                  title="Close and exit BOM modal"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Close</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep((currentStep - 1) as any)}
                  className="py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>← Back</span>
                </button>
              </>
            )}

            {/* Step 1 Next Button */}
            {currentStep === 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                disabled={items.length === 0}
                className="w-full sm:w-auto py-2.5 px-5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition shadow-md flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <span>Compare Local Merchants ({items.length} Parts)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {/* Step 2 Next Button */}
            {currentStep === 2 && (
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="w-full sm:w-auto py-2.5 px-5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition shadow-md flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
              >
                <span>Proceed to 1-Click Fulfillment</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {/* Step 3 Confirm Order Button */}
            {currentStep === 3 && (
              <button
                type="button"
                onClick={handleConfirmAndPlaceOrder}
                disabled={isSubmittingOrder}
                className="w-full sm:w-auto py-2.5 px-6 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition shadow-md flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingOrder ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Placing Order via Merchant API...</span>
                  </>
                ) : (
                  <>
                    <PackageCheck className="w-4 h-4" />
                    <span>
                      {fulfillmentType === "click_and_collect"
                        ? `1-Click Order at ${selectedMerchant?.merchantName}`
                        : `1-Click Order & Dispatch Category 84 Courier`}
                    </span>
                  </>
                )}
              </button>
            )}

            {/* Step 4 Done Button */}
            {currentStep === 4 && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className="py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto py-2.5 px-6 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  <span>Done & Close Modal</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

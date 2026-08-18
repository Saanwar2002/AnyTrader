import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  PackageCheck,
  Truck,
  Store,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  ShieldCheck,
  QrCode,
  FileText,
  Sparkles,
  ArrowRight,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ExternalLink
} from "lucide-react";
import { BOMOrderRecord } from "@/src/services/bomMerchantService";

export type OrderTrackerStage = "processing" | "merchant_ready" | "out_for_delivery" | "delivered";

interface BomOrderStatusTrackerProps {
  order: BOMOrderRecord;
  onStatusUpdate?: (newStatus: BOMOrderRecord["status"]) => void;
  allowManualStageTesting?: boolean;
}

const STAGES: {
  id: OrderTrackerStage;
  label: string;
  shortLabel: string;
  description: string;
  clickAndCollectDesc: string;
  courierDesc: string;
  icon: any;
  color: string;
}[] = [
  {
    id: "processing",
    label: "Processing & API Routing",
    shortLabel: "Processing",
    description: "Order payload dispatched to merchant partner API and stock reserved.",
    clickAndCollectDesc: "Merchant counter receiving electronic trade order and allocating stock.",
    courierDesc: "Order routed to nearest trade hub & Category 84 courier assigned.",
    icon: RefreshCw,
    color: "from-blue-500 to-indigo-600"
  },
  {
    id: "merchant_ready",
    label: "Merchant Ready & Staged",
    shortLabel: "Merchant Ready",
    description: "Warehouse counter team has picked and bagged all required trade parts.",
    clickAndCollectDesc: "Items packed at trade counter. 1-minute fast-track pickup barcode active.",
    courierDesc: "Items ready at merchant loading bay for courier van collection.",
    icon: Store,
    color: "from-amber-500 to-orange-600"
  },
  {
    id: "out_for_delivery",
    label: "Out for Delivery / Transit",
    shortLabel: "In Transit",
    description: "Materials en-route to site or waiting at counter express lane.",
    clickAndCollectDesc: "Trade counter express lane open. Ready for immediate trader collection.",
    courierDesc: "Category 84 Van en-route to job site with live GPS tracking.",
    icon: Truck,
    color: "from-purple-500 to-violet-600"
  },
  {
    id: "delivered",
    label: "Delivered & Passport Synced",
    shortLabel: "Delivered",
    description: "Materials received on site and registered in Property Passport.",
    clickAndCollectDesc: "Trade materials collected from counter. Property Passport updated.",
    courierDesc: "Delivered to driveway / site work area. Digital twin specs locked.",
    icon: PackageCheck,
    color: "from-emerald-500 to-teal-600"
  }
];

export function BomOrderStatusTracker({
  order,
  onStatusUpdate,
  allowManualStageTesting = true
}: BomOrderStatusTrackerProps) {
  // Map order.status string to tracker stage index
  const getInitialStage = (): OrderTrackerStage => {
    if (order.status === "delivered" || order.status === "collected") return "delivered";
    if (order.status === "out_for_delivery") return "out_for_delivery";
    if (order.status === "ready_for_pickup") return "merchant_ready";
    return "processing";
  };

  const [currentStage, setCurrentStage] = useState<OrderTrackerStage>(getInitialStage());
  const [showItemManifest, setShowItemManifest] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [etaMinutes, setEtaMinutes] = useState(
    order.fulfillmentType === "click_and_collect" ? 1 : 28
  );

  const stageIndex = STAGES.findIndex((s) => s.id === currentStage);
  const isCourier = order.fulfillmentType === "courier_dispatch";

  // Simulate progress countdown timer for visual delight
  useEffect(() => {
    const timer = setInterval(() => {
      setEtaMinutes((prev) => (prev > 2 ? prev - 1 : prev));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const handleStageChange = (newStage: OrderTrackerStage) => {
    setCurrentStage(newStage);
    if (onStatusUpdate) {
      let mappedStatus: BOMOrderRecord["status"] = "ordered";
      if (newStage === "merchant_ready") mappedStatus = "ready_for_pickup";
      if (newStage === "out_for_delivery") mappedStatus = "out_for_delivery";
      if (newStage === "delivered") mappedStatus = isCourier ? "delivered" : "collected";
      onStatusUpdate(mappedStatus);
    }
  };

  const handleAdvanceStep = () => {
    const nextIdx = Math.min(STAGES.length - 1, stageIndex + 1);
    handleStageChange(STAGES[nextIdx].id);
  };

  const handlePreviousStep = () => {
    const prevIdx = Math.max(0, stageIndex - 1);
    handleStageChange(STAGES[prevIdx].id);
  };

  return (
    <div className="space-y-4">
      {/* Main Glassmorphic Animated Tracker Card */}
      <motion.div
        layout
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-5 sm:p-6 bg-slate-950 text-white rounded-3xl border border-white/15 shadow-2xl relative overflow-hidden"
      >
        {/* Ambient background glow matching active stage */}
        <div
          className={`absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl opacity-25 pointer-events-none transition-colors duration-700 ${
            currentStage === "processing"
              ? "bg-blue-600"
              : currentStage === "merchant_ready"
              ? "bg-amber-500"
              : currentStage === "out_for_delivery"
              ? "bg-purple-600"
              : "bg-emerald-500"
          }`}
        />

        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-white shadow-lg transition-colors duration-500 ${
                currentStage === "delivered"
                  ? "bg-emerald-500 text-slate-950"
                  : currentStage === "out_for_delivery"
                  ? "bg-purple-600"
                  : currentStage === "merchant_ready"
                  ? "bg-amber-500 text-slate-950"
                  : "bg-blue-600"
              }`}
            >
              {currentStage === "delivered" ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : isCourier ? (
                <Truck className="w-6 h-6 animate-pulse" />
              ) : (
                <Store className="w-6 h-6" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm sm:text-base font-black text-white tracking-tight">
                  1-Click Order Live Tracker
                </h4>
                <span className="text-[10px] bg-white/10 text-amber-400 font-extrabold px-2 py-0.5 rounded-full border border-white/20 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Ref: <strong className="font-mono text-amber-300">{order.pickupReferenceCode}</strong> • {order.selectedMerchant}
              </p>
            </div>
          </div>

          {/* Dynamic ETA / Status Pill */}
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 bg-white/10 rounded-2xl border border-white/15 text-right">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">
                {currentStage === "delivered" ? "Status" : isCourier ? "Estimated Delivery" : "Collection Window"}
              </span>
              <span className="text-xs font-black text-emerald-400 flex items-center justify-end gap-1">
                {currentStage === "delivered" ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    {isCourier ? `~${etaMinutes} mins (${order.courierDetails?.scheduledTime || "Today"})` : "Ready in 1 min"}
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* ================= ANIMATED MULTI-STEP PROGRESS BAR ================= */}
        <div className="py-6 relative z-10">
          <div className="relative">
            {/* Background Grey Track */}
            <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-2 bg-slate-800 rounded-full" />

            {/* Active Animated Filling Progress Bar */}
            <motion.div
              className={`absolute top-1/2 left-0 -translate-y-1/2 h-2 rounded-full bg-gradient-to-r ${
                currentStage === "delivered"
                  ? "from-blue-500 via-purple-500 to-emerald-400"
                  : "from-blue-500 to-amber-400"
              }`}
              initial={false}
              animate={{
                width: `${(stageIndex / (STAGES.length - 1)) * 100}%`
              }}
              transition={{ type: "spring", stiffness: 70, damping: 15 }}
            />

            {/* 4 Step Waypoint Nodes */}
            <div className="relative flex justify-between items-center">
              {STAGES.map((s, idx) => {
                const isPassed = idx < stageIndex;
                const isCurrent = idx === stageIndex;
                const Icon = s.icon;

                return (
                  <div
                    key={s.id}
                    className="flex flex-col items-center cursor-pointer group"
                    onClick={() => allowManualStageTesting && handleStageChange(s.id)}
                    title={`Click to set stage to: ${s.label}`}
                  >
                    {/* Node Circle with Framer Motion Scale and Glow */}
                    <motion.div
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center transition-all duration-300 relative border ${
                        isCurrent
                          ? "bg-amber-400 text-slate-950 border-amber-300 ring-4 ring-amber-400/30 shadow-lg shadow-amber-400/20"
                          : isPassed
                          ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-md"
                          : "bg-slate-900 text-slate-500 border-slate-700 group-hover:border-slate-500"
                      }`}
                      animate={
                        isCurrent
                          ? { scale: [1, 1.08, 1] }
                          : { scale: 1 }
                      }
                      transition={
                        isCurrent
                          ? { repeat: Infinity, duration: 2.2, ease: "easeInOut" }
                          : {}
                      }
                    >
                      {isPassed ? (
                        <CheckCircle2 className="w-5 h-5 font-black" />
                      ) : (
                        <Icon className={`w-5 h-5 ${isCurrent && s.id === "processing" ? "animate-spin" : ""}`} />
                      )}

                      {/* Ripple Halo on Current Active Step */}
                      {isCurrent && (
                        <span className="absolute inset-0 rounded-2xl border-2 border-amber-400 animate-ping opacity-40 pointer-events-none" />
                      )}
                    </motion.div>

                    {/* Step Label Under Node */}
                    <span
                      className={`text-[10px] sm:text-xs font-black mt-2 text-center transition-colors max-w-[80px] sm:max-w-none ${
                        isCurrent
                          ? "text-amber-300 font-extrabold"
                          : isPassed
                          ? "text-emerald-400"
                          : "text-slate-500"
                      }`}
                    >
                      {s.shortLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ================= ACTIVE STAGE DETAIL HERO CARD ================= */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStage}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className={`p-4 sm:p-5 rounded-2xl border transition-all ${
              currentStage === "delivered"
                ? "bg-emerald-950/70 border-emerald-500/40 text-emerald-100"
                : currentStage === "out_for_delivery"
                ? "bg-purple-950/70 border-purple-500/40 text-purple-100"
                : currentStage === "merchant_ready"
                ? "bg-amber-950/70 border-amber-500/40 text-amber-100"
                : "bg-blue-950/70 border-blue-500/40 text-blue-100"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                      currentStage === "delivered"
                        ? "bg-emerald-400 text-slate-950"
                        : currentStage === "out_for_delivery"
                        ? "bg-purple-400 text-slate-950"
                        : currentStage === "merchant_ready"
                        ? "bg-amber-400 text-slate-950"
                        : "bg-blue-400 text-slate-950"
                    }`}
                  >
                    Stage {stageIndex + 1} of 4: {STAGES[stageIndex].label}
                  </span>
                  <span className="text-xs text-slate-300 font-mono">
                    {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <h5 className="text-sm sm:text-base font-black text-white">
                  {isCourier ? STAGES[stageIndex].courierDesc : STAGES[stageIndex].clickAndCollectDesc}
                </h5>
                <p className="text-xs text-slate-300">
                  {STAGES[stageIndex].description}
                </p>
              </div>

              {/* Action Buttons for Current Stage */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {!isCourier && (
                  <button
                    type="button"
                    onClick={() => setShowBarcodeModal(true)}
                    className="px-3 py-2 bg-white text-slate-950 hover:bg-slate-100 font-black text-xs rounded-xl transition flex items-center gap-1.5 shadow-md active:scale-95"
                  >
                    <QrCode className="w-4 h-4 text-slate-900" />
                    <span>View Pickup Barcode</span>
                  </button>
                )}

                {isCourier && order.courierDetails && (
                  <a
                    href={`tel:${order.courierDetails.driverPhone || "+447700900482"}`}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-md active:scale-95"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call Van Driver</span>
                  </a>
                )}
              </div>
            </div>

            {/* Courier Live Van Dispatch HUD */}
            {isCourier && order.courierDetails && currentStage === "out_for_delivery" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-4 p-3 bg-slate-900/90 rounded-xl border border-white/15 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-200">
                    <Truck className="w-4 h-4 text-purple-400 animate-bounce" />
                    <span>
                      Driver: <strong>{order.courierDetails.driverName || "Dave Kowalski"}</strong> •{" "}
                      <strong className="font-mono text-purple-300">
                        {order.courierDetails.vehiclePlate || "VE72 TKX"}
                      </strong>
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-black">
                    Live GPS En-Route
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-white/10 pt-1.5">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-400" />
                    From: {order.courierDetails.pickupAddress || order.selectedMerchant}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-emerald-400" />
                    To: {order.courierDetails.deliveryAddress || "Site Driveway"}
                  </span>
                </div>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* ================= STEP SIMULATION TESTING CONTROLS (IF ENABLED) ================= */}
        {allowManualStageTesting && (
          <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Interactive Status Simulator:</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePreviousStep}
                disabled={stageIndex === 0}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 disabled:opacity-40 text-slate-200 text-xs font-bold rounded-lg transition"
              >
                ← Prev Stage
              </button>

              <button
                type="button"
                onClick={handleAdvanceStep}
                disabled={stageIndex === STAGES.length - 1}
                className="px-3 py-1 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 text-xs font-black rounded-lg transition flex items-center gap-1 shadow-sm"
              >
                <span>Advance to Next Stage</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* ================= PROPERTY PASSPORT DIGITAL TWIN BANNER ================= */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-4 bg-white text-slate-900 rounded-3xl border border-black shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0 border border-blue-200">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h5 className="text-xs font-black text-slate-950 uppercase tracking-wider">
                Property Passport Digital Twin Synced
              </h5>
              <span className="text-[9px] font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-300">
                {order.items.length} Parts Tracked
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Serial numbers, boiler valves, and parts automatically logged for future homeowner maintenance & warranty claims.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowItemManifest(!showItemManifest)}
          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs rounded-xl border border-slate-300 transition flex items-center justify-center gap-1 shrink-0"
        >
          <span>{showItemManifest ? "Hide Materials Manifest" : "View Items Manifest"}</span>
          {showItemManifest ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </motion.div>

      {/* ================= COLLAPSIBLE ITEM MANIFEST ================= */}
      <AnimatePresence>
        {showItemManifest && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-slate-50 text-slate-900 rounded-3xl border border-black space-y-2.5 overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h5 className="font-black text-xs text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                Itemized Order Manifest ({order.items.length} Line Items)
              </h5>
              <span className="font-mono text-xs font-black text-slate-900">
                Total: £{order.totalAmount.toFixed(2)} (Inc. VAT)
              </span>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {order.items.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-bold text-slate-900 truncate">
                      {item.quantity}x {item.name}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      SKU: <span className="font-mono text-slate-700">{item.sku || "TRADE-PART"}</span> • Category: {item.category}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-emerald-700">£{item.totalCost.toFixed(2)}</p>
                    <p className="text-[10px] text-slate-400">£{item.unitCost.toFixed(2)} / {item.unit || "unit"}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= BARCODE / QR MODAL ================= */}
      <AnimatePresence>
        {showBarcodeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-white text-slate-900 p-6 rounded-3xl border border-black shadow-2xl text-center space-y-4"
            >
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-300">
                  Trade Counter Fast-Track Barcode
                </span>
                <h4 className="text-lg font-black text-slate-950 font-mono mt-1">
                  {order.pickupReferenceCode}
                </h4>
                <p className="text-xs text-slate-600">
                  Scan at the {order.selectedMerchant} express collection counter.
                </p>
              </div>

              <div className="p-4 bg-white rounded-2xl border-2 border-black inline-block shadow-inner">
                <img
                  src={order.pickupBarcode}
                  alt="Pickup QR Barcode"
                  className="w-48 h-48 object-contain mx-auto"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowBarcodeModal(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-black text-white font-black text-xs rounded-xl transition"
              >
                Close Barcode
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

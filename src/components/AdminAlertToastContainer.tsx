import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  AlertTriangle, ShieldAlert, ShieldCheck, X, Zap, ArrowRight, 
  ExternalLink, Bell, Volume2, VolumeX, Mail, CheckCircle2, UserX, Trash2
} from "lucide-react";
import { ActiveBreachAlert } from "../services/adminAlertThresholdService";
import { executeAnomalyMitigation } from "../services/adminAnalyticsService";
import { cn } from "@/src/lib/utils";

interface AdminAlertToastContainerProps {
  alerts: ActiveBreachAlert[];
  onDismiss: (alertId: string) => void;
  onMitigate?: (alertId: string, actionType: any, details: any) => Promise<void>;
  onOpenDashboard?: () => void;
}

export default function AdminAlertToastContainer({
  alerts,
  onDismiss,
  onMitigate,
  onOpenDashboard
}: AdminAlertToastContainerProps) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 max-w-md w-full pointer-events-none px-2 sm:px-0">
      <AnimatePresence mode="popLayout">
        {alerts.slice(0, 4).map((alert) => (
          <ToastCard 
            key={alert.id} 
            alert={alert} 
            onDismiss={() => onDismiss(alert.id)}
            onMitigate={onMitigate}
            onOpenDashboard={onOpenDashboard}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastCard({
  alert,
  onDismiss,
  onMitigate,
  onOpenDashboard
}: {
  alert: any;
  onDismiss: () => void;
  onMitigate?: (alertId: string, actionType: any, details: any) => Promise<void>;
  onOpenDashboard?: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);
  const isCritical = alert.severity === "CRITICAL";
  const duration = isCritical ? 18000 : 12000; // 18s for critical, 12s for others

  useEffect(() => {
    if (isHovered || isExecuting) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, duration);
    return () => clearTimeout(timer);
  }, [isHovered, isExecuting, duration, onDismiss]);

  const handleAction = async (action: any) => {
    setIsExecuting(true);
    try {
      if (onMitigate) {
        await onMitigate(alert.id, action.action, {
          targetUserId: alert.targetEntity?.userId,
          targetDealId: alert.targetEntity?.dealId,
          note: `Toast Quick Action: ${action.label}`
        });
      } else {
        await executeAnomalyMitigation(alert.id, action.action, {
          targetUserId: alert.targetEntity?.userId,
          targetDealId: alert.targetEntity?.dealId,
          note: `Toast Quick Action: ${action.label}`
        });
      }
      setExecutionMessage(`Applied: ${action.label}`);
      setTimeout(() => {
        onDismiss();
      }, 1200);
    } catch (err: any) {
      setExecutionMessage("Action failed");
      setTimeout(() => setExecutionMessage(null), 2000);
    } finally {
      setIsExecuting(false);
    }
  };

  const getSeverityBadge = () => {
    switch (alert.severity) {
      case "CRITICAL":
        return {
          bg: "bg-rose-600 text-white",
          border: "border-rose-700",
          icon: <ShieldAlert className="w-4 h-4 text-white animate-pulse" />,
          label: "Critical Breach Flagged"
        };
      case "HIGH":
        return {
          bg: "bg-amber-500 text-slate-950",
          border: "border-amber-600",
          icon: <AlertTriangle className="w-4 h-4 text-slate-950" />,
          label: "High Severity Alert"
        };
      default:
        return {
          bg: "bg-sky-500 text-white",
          border: "border-sky-600",
          icon: <Zap className="w-4 h-4 text-white" />,
          label: "Threshold Notice"
        };
    }
  };

  const badge = getSeverityBadge();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="pointer-events-auto bg-white rounded-2xl border-2 border-black shadow-2xl shadow-slate-900/30 overflow-hidden flex flex-col"
    >
      {/* Header bar */}
      <div className={cn("px-4 py-2.5 flex items-center justify-between border-b border-black/10", badge.bg)}>
        <div className="flex items-center gap-2">
          {badge.icon}
          <span className="text-xs font-black uppercase tracking-wider">
            {badge.label}
          </span>
          <span className="text-[10px] opacity-80 font-mono">
            {new Date(alert.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        <button
          onClick={onDismiss}
          className="p-1 hover:bg-black/10 rounded-lg transition-colors text-current"
          title="Dismiss Alert"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3 bg-slate-50/50">
        <div>
          <h4 className="text-sm font-black text-slate-900 leading-tight">
            {alert.title}
          </h4>
          <p className="text-xs text-slate-700 mt-1 font-medium leading-relaxed">
            {alert.description}
          </p>
        </div>

        {/* Observed metric chip */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <span className="bg-slate-900 text-white px-2.5 py-0.5 rounded-lg border border-black font-mono">
            Observed: {alert.metrics?.observedValue} {alert.metrics?.unit}
          </span>
          <span className="bg-slate-200 text-slate-800 px-2 py-0.5 rounded-lg">
            Limit: {alert.metrics?.thresholdLimit} / {alert.metrics?.timeWindow}
          </span>
          {alert.targetEntity?.userName && (
            <span className="bg-blue-100 text-blue-900 px-2 py-0.5 rounded-lg truncate max-w-[150px]">
              👤 {alert.targetEntity.userName}
            </span>
          )}
        </div>

        {/* Status notice if action executing */}
        {executionMessage && (
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl p-2 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{executionMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-1 flex items-center justify-between gap-2 border-t border-slate-200">
          <div className="flex items-center gap-1.5 flex-wrap">
            {alert.suggestedActions?.slice(0, 2).map((action: any, idx: number) => (
              <button
                key={idx}
                disabled={isExecuting}
                onClick={() => handleAction(action)}
                className={cn(
                  "px-2.5 py-1.5 rounded-xl font-black text-[11px] transition-all border border-black flex items-center gap-1 shadow-sm disabled:opacity-50",
                  action.danger
                    ? "bg-rose-600 text-white hover:bg-rose-700"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                )}
              >
                {action.danger ? <UserX className="w-3 h-3" /> : <Zap className="w-3 h-3 text-amber-400" />}
                {action.label}
              </button>
            ))}
          </div>

          {onOpenDashboard && (
            <button
              onClick={() => {
                onOpenDashboard();
                onDismiss();
              }}
              className="text-[11px] font-black text-blue-600 hover:text-blue-800 flex items-center gap-1 shrink-0 underline"
            >
              Dashboard
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Auto-dismiss linear timer bar */}
      <div className="h-1 w-full bg-slate-200">
        <motion.div
          initial={{ width: "100%" }}
          animate={{ width: isHovered ? "100%" : "0%" }}
          transition={{ duration: duration / 1000, ease: "linear" }}
          className={cn(
            "h-full",
            isCritical ? "bg-rose-600" : "bg-slate-900"
          )}
        />
      </div>
    </motion.div>
  );
}

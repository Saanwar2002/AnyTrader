import React, { useEffect, useRef, useState, useCallback } from "react";
import { usePortal } from "../../lib/PortalContext";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/src/lib/utils";
import { useNavigate } from "react-router-dom";
import { useBusinessTab } from "@/src/store/businessTabStore";
import { useAuth } from "../AuthProvider";
import { Building2, Wrench, Users, Briefcase, Search, ChevronDown, ChevronUp, Layers } from "lucide-react";

export default function RoleTabBar() {
  const { activePortal, activeRole, setActiveRole, availableRoles } = usePortal();
  const navigate = useNavigate();
  const { activeTab, setActiveTab, activeSubTab, setActiveSubTab } = useBusinessTab();
  const { profile } = useAuth();
  const hasInitialized = useRef(false);

  // Collapsible & Auto-Close Timer State
  const [isExpanded, setIsExpanded] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const resetAutoCloseTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    // Auto-close after 5 seconds of inactivity
    timerRef.current = setTimeout(() => {
      setIsExpanded(false);
    }, 5000);
  }, []);

  // Set up auto-close timer when expanded
  useEffect(() => {
    if (isExpanded) {
      resetAutoCloseTimer();
    } else if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isExpanded, resetAutoCloseTimer]);

  useEffect(() => {
    if (!hasInitialized.current && profile?.businessLayer) {
      if (profile.businessLayer === "consultancy") {
        setActiveTab("consultancy");
      } else if (profile.businessLayer === "field_services") {
        setActiveTab("field_services");
      } else {
        setActiveTab("properties");
      }
      hasInitialized.current = true;
    }
  }, [profile, setActiveTab]);

  // If there's only one role, or they are admin/ecosystem, hide the tab bar unless business subtabs needed
  if (availableRoles.length <= 1 || activeRole === "admin" || activeRole === "ecosystem_manager") {
    if (activeRole !== "business") {
      return null;
    }
  }

  // Which roles apply to the current active portal?
  const portalRoles = availableRoles.filter(role => {
    if (activePortal === "anyroller") {
      return role === "customer" || role === "driver";
    } else {
      return role === "customer" || role === "trader" || role === "business";
    }
  });

  const uniqueRoles = Array.from(new Set(portalRoles)) as string[];
  const shouldShowMainRoles = uniqueRoles.length > 1;

  if (!shouldShowMainRoles && activeRole !== "business") {
    return null;
  }

  const handleRoleChange = (role: any) => {
    setActiveRole(role);
    resetAutoCloseTimer();
    navigate("/");
  };

  const getLabel = (role: string) => {
    switch(role) {
      case "customer": return activePortal === "anyroller" ? "Rider Mode" : "Homeowner";
      case "trader": return "Tradesperson";
      case "business": return "Business Hub";
      case "driver": return "Driver Mode";
      default: return role;
    }
  };

  // Get compact active summary badge label
  const getActiveSummary = () => {
    const roleLabel = getLabel(activeRole);
    if (activeRole === "business") {
      if (activeTab === "field_services") {
        const subTabName = activeSubTab === "hire_b2b" ? "Hire B2B" : "Work Hub";
        return `${roleLabel} - Trades & Services - ${subTabName}`;
      }
      const tabName = activeTab === "properties" ? "Properties" : "Consultancy";
      return `${roleLabel} - ${tabName}`;
    }
    return roleLabel;
  };

  return (
    <div 
      onPointerDown={resetAutoCloseTimer}
      onTouchStart={resetAutoCloseTimer}
      onClick={resetAutoCloseTimer}
      className="w-full bg-slate-50/95 backdrop-blur-md border-b border-black/10 sticky top-16 z-40 shadow-xs transition-all duration-200"
    >
      {/* Collapsed State Bar (Ultra-compact, 1-tap expand) */}
      {!isExpanded ? (
        <div className="w-full max-w-lg mx-auto flex items-center justify-between px-3 py-1">
          <button
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-2 text-left group flex-1 py-0.5"
            title="Tap to switch view or role"
          >
            <span className="flex items-center justify-center w-5 h-5 rounded-md bg-blue-600/10 text-blue-600 border border-blue-200/50 shrink-0">
              <Layers className="w-3 h-3" />
            </span>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[11px] font-black text-slate-800 tracking-tight truncate uppercase">
                {getActiveSummary()}
              </span>
              <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 shrink-0">
                Change
              </span>
            </div>
          </button>

          <button
            onClick={() => setIsExpanded(true)}
            className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors shrink-0"
            aria-label="Expand navigation tabs"
            title="Expand tabs"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* Expanded State Container */
        <div className="w-full max-w-lg mx-auto flex flex-col items-center justify-center pt-1.5 pb-1 px-2.5">
          {/* Header Row with Title, Auto-Close timer indicator, and Collapse Arrow */}
          <div className="w-full flex items-center justify-between mb-1 px-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Navigation Hub
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Auto-closes in 5s" />
            </div>

            <button
              onClick={() => setIsExpanded(false)}
              className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-900 bg-white/80 hover:bg-white px-2 py-0.5 rounded-md border border-black/10 transition-colors shadow-2xs"
              title="Collapse tab section"
            >
              <span>Collapse</span>
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Primary Role Switcher (Compact Height) */}
          {shouldShowMainRoles && (
            <div className="flex bg-slate-200/70 p-0.5 rounded-lg items-center w-full relative mb-1 border border-black/5">
              {uniqueRoles.map((role) => (
                <button
                  key={role}
                  onClick={() => handleRoleChange(role)}
                  className={cn(
                    "relative flex-1 text-[11px] font-black tracking-tight py-1 px-1.5 rounded-md flex items-center justify-center transition-all z-10 uppercase",
                    activeRole === role ? "text-white" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {activeRole === role && (
                    <motion.div
                      layoutId="activeRolePill"
                      className="absolute inset-0 bg-[#0055DD] rounded-md shadow-xs border border-blue-600"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
                    />
                  )}
                  <span className="relative z-20 truncate">
                    {getLabel(role)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Business Domain Tabs & Sub-Tabs (Ultra-compact Height) */}
          {activeRole === "business" && (
            <div className="w-full flex flex-col gap-1">
              {/* Main 3 Business Layers */}
              <div className="grid grid-cols-3 p-0.5 bg-white border border-black/10 rounded-lg text-xs shadow-2xs">
                {[
                  { id: "properties", label: "Properties", icon: Building2, activeColor: "bg-slate-900 text-white" },
                  { id: "field_services", label: "Trades & Services", icon: Wrench, activeColor: "bg-[#0055DD] text-white" },
                  { id: "consultancy", label: "Consultancy", icon: Users, activeColor: "bg-purple-700 text-white" }
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id as any);
                        resetAutoCloseTimer();
                        navigate("/");
                      }}
                      className={cn(
                        "flex items-center justify-center gap-1 py-1 px-1.5 rounded-md font-bold transition-all text-center whitespace-nowrap text-[10px] sm:text-[11px]",
                        isActive ? `${tab.activeColor} shadow-xs` : "text-slate-600 hover:bg-slate-100/70"
                      )}
                    >
                      <Icon className="w-3 h-3 shrink-0" />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Field Services Sub-Segment (Work Hub vs Hire B2B) */}
              {activeTab === "field_services" && (
                <div className="flex bg-blue-50/80 border border-blue-200/60 p-0.5 rounded-md shadow-2xs w-full gap-1">
                  <button
                    onClick={() => {
                      setActiveSubTab("work_hub");
                      resetAutoCloseTimer();
                    }}
                    className={cn(
                      "flex items-center justify-center gap-1 py-0.5 px-2 rounded text-[10px] sm:text-[11px] font-bold transition-all flex-1 text-center whitespace-nowrap",
                      activeSubTab === "work_hub" ? "bg-[#0055DD] shadow-2xs text-white" : "text-slate-700 hover:bg-blue-100"
                    )}
                  >
                    <Briefcase className="w-2.5 h-2.5" />
                    <span>Work Hub</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveSubTab("hire_b2b");
                      resetAutoCloseTimer();
                    }}
                    className={cn(
                      "flex items-center justify-center gap-1 py-0.5 px-2 rounded text-[10px] sm:text-[11px] font-bold transition-all flex-1 text-center whitespace-nowrap",
                      activeSubTab === "hire_b2b" ? "bg-sky-600 shadow-2xs text-white" : "text-slate-700 hover:bg-blue-100"
                    )}
                  >
                    <Search className="w-2.5 h-2.5" />
                    <span>Hire B2B</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


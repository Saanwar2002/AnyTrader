import React, { useEffect, useRef } from "react";
import { usePortal } from "../../lib/PortalContext";
import { motion } from "framer-motion";
import { cn } from "@/src/lib/utils";
import { useNavigate } from "react-router-dom";
import { useBusinessTab } from "@/src/store/businessTabStore";
import { useAuth } from "../AuthProvider";

export default function RoleTabBar() {
  const { activePortal, activeRole, setActiveRole, availableRoles } = usePortal();
  const navigate = useNavigate();
  const { activeTab, setActiveTab, activeSubTab, setActiveSubTab } = useBusinessTab();
  const { profile } = useAuth();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!hasInitialized.current && profile?.businessCategory) {
      if (profile.businessCategory.toLowerCase().includes("consult")) {
        setActiveTab("consultancy");
      } else if (profile.businessCategory.toLowerCase().includes("field")) {
        setActiveTab("field_services");
      } else {
        setActiveTab("properties");
      }
      hasInitialized.current = true;
    }
  }, [profile, setActiveTab]);

  // If there's only one role, or they are admin/ecosystem, hide the tab bar
  if (availableRoles.length <= 1 || activeRole === "admin" || activeRole === "ecosystem_manager") {
    // If we're business and there's 1 role, we still might want to show the sub-role tab bar?
    // Based on original logic it returns null. Wait. If availableRoles <= 1, they only have "business".
    // Does the "Properties / Field Services / Consultancy" tab disappear? Oh! 
    // They still need the sub tabs! So we can't just return null.
    // Let me rewrite this logic so it returns the sub tabs if they are business, even if they have only 1 overall role.
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

  // If the portal only gives them 1 role, and it's not business, hide it
  const uniqueRoles = Array.from(new Set(portalRoles)) as string[];
  const shouldShowMainRoles = uniqueRoles.length > 1;

  if (!shouldShowMainRoles && activeRole !== "business") {
    return null;
  }

  const handleRoleChange = (role: any) => {
    setActiveRole(role);
    // When changing roles, go back to the home of that portal to prevent 404s
    navigate("/");
  };

  const getLabel = (role: string) => {
    switch(role) {
      case "customer": return activePortal === "anyroller" ? "As Rider" : "As Homeowner / Hire Trades";
      case "trader": return "As Tradesperson";
      case "business": return "As Business";
      case "driver": return "As Driver";
      default: return role;
    }
  };

  return (
    <div className="w-full bg-surface border-b border-slate-200 sticky top-16 z-40 sm:shadow-sm flex flex-col items-center justify-center pt-2 pb-0">
      {shouldShowMainRoles && (
        <div className="flex bg-slate-100/80 p-1 rounded-xl items-center shadow-inner max-w-sm w-full mx-auto relative mb-2 px-2 sm:px-0">
          {uniqueRoles.map((role) => (
            <button
              key={role}
              onClick={() => handleRoleChange(role)}
              className={cn(
                "relative flex-1 text-xs sm:text-sm font-black tracking-tight py-2.5 px-3 rounded-lg flex items-center justify-center transition-all z-10 uppercase",
                activeRole === role ? "text-white" : "text-slate-400 hover:text-slate-600 grayscale opacity-80"
              )}
            >
              {activeRole === role && (
                <motion.div
                  layoutId="activeRolePill"
                  className="absolute inset-0 bg-[#0066FF] rounded-lg shadow-[0_4px_12px_rgba(0,102,255,0.3)] border border-blue-400"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                />
              )}
              <span className="relative z-20">
                {getLabel(role)}
              </span>
            </button>
          ))}
        </div>
      )}

      {activeRole === "business" && (
        <div className="flex justify-center w-full px-2 sm:px-0 pt-2 pb-0 bg-surface">
          <div className="flex p-0.5 bg-white border border-black rounded-lg text-[13px] shadow-sm max-w-sm w-full mx-auto z-10 relative">
            {(["properties", "field_services", "consultancy"] as const).map((tab) => {
              const isActive = activeTab === tab;
              const displayNames = {
                properties: "Properties",
                field_services: "Field Services",
                consultancy: "Consultancy"
              };
              
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex-1 py-1 px-1 rounded-md font-medium transition duration-200 whitespace-nowrap text-center",
                    isActive ? "bg-black text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {displayNames[tab]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeRole === "business" && activeTab === "field_services" && (
        <div className="flex justify-center w-full px-2 sm:px-0 pb-2 bg-surface">
          <div className="flex bg-slate-50 border-x border-b border-black p-0.5 rounded-b-lg shadow-sm max-w-sm w-full mx-auto -mt-2 relative z-0">
            <button
               onClick={() => setActiveSubTab("work_hub")}
               className={cn(
                 "py-1 px-3 rounded-md text-xs font-bold transition-all flex-1 text-center",
                 activeSubTab === "work_hub" ? "bg-white shadow-sm border border-black text-slate-900" : "text-black hover:bg-slate-100"
               )}
            >
               Work Hub
            </button>
            <button
               onClick={() => setActiveSubTab("hire_b2b")}
               className={cn(
                 "py-1 px-3 rounded-md text-xs font-bold transition-all flex-1 text-center",
                 activeSubTab === "hire_b2b" ? "bg-white shadow-sm border border-black text-slate-900" : "text-black hover:bg-slate-100"
               )}
            >
               Hire B2B Service
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

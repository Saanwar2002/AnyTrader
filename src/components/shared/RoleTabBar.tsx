import React from "react";
import { usePortal } from "../../lib/PortalContext";
import { motion } from "framer-motion";
import { cn } from "@/src/lib/utils";
import { useNavigate } from "react-router-dom";

export default function RoleTabBar() {
  const { activePortal, activeRole, setActiveRole, availableRoles } = usePortal();
  const navigate = useNavigate();

  // If there's only one role, or they are admin/ecosystem, hide the tab bar
  if (availableRoles.length <= 1 || activeRole === "admin" || activeRole === "ecosystem_manager") {
    return null;
  }

  // Which roles apply to the current active portal?
  const portalRoles = availableRoles.filter(role => {
    if (activePortal === "anyride") {
      return role === "customer" || role === "driver";
    } else {
      return role === "customer" || role === "trader" || role === "business";
    }
  });

  // If the portal only gives them 1 role, hide it
  const uniqueRoles = Array.from(new Set(portalRoles)) as string[];
  if (uniqueRoles.length <= 1) {
    return null;
  }

  const handleRoleChange = (role: any) => {
    setActiveRole(role);
    // When changing roles, go back to the home of that portal to prevent 404s
    navigate("/");
  };

  const getLabel = (role: string) => {
    switch(role) {
      case "customer": return activePortal === "anyride" ? "As Rider" : "As Homeowner";
      case "trader": return "As Tradesperson";
      case "business": return "As Business";
      case "driver": return "As Driver";
      default: return role;
    }
  };

  return (
    <div className="w-full bg-surface border-b border-slate-200 sticky top-16 z-40 sm:shadow-sm flex items-center justify-center p-2 mb-2">
      <div className="flex bg-slate-100/80 p-1 rounded-xl items-center shadow-inner max-w-sm w-full mx-auto relative">
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
    </div>
  );
}

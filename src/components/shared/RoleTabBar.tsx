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
  if (portalRoles.length <= 1) {
    return null;
  }

  const handleRoleChange = (role: any) => {
    setActiveRole(role);
    // When changing roles, go back to the home of that portal to prevent 404s
    navigate("/");
  };

  const getLabel = (role: string) => {
    switch(role) {
      case "customer": return activePortal === "anyride" ? "Book Ride" : "Homeowner";
      case "trader": return "Tradesperson";
      case "business": return "Business";
      case "driver": return "Driver Terminal";
      default: return role;
    }
  };

  return (
    <div className="w-full bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm flex items-center justify-center p-2">
      <div className="flex bg-slate-100 p-1 rounded-xl items-center shadow-inner max-w-sm w-full mx-auto relative">
        {portalRoles.map((role) => (
          <button
            key={role}
            onClick={() => handleRoleChange(role)}
            className={cn(
              "relative flex-1 text-xs sm:text-sm font-semibold py-2 px-3 rounded-lg flex items-center justify-center text-slate-500 transition-colors z-10",
              activeRole === role ? "text-slate-900" : "hover:text-slate-700"
            )}
          >
            {activeRole === role && (
              <motion.div
                layoutId="activeRolePill"
                className="absolute inset-0 bg-white rounded-lg shadow-sm border border-slate-200/50"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
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

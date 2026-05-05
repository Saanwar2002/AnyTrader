import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "../components/AuthProvider";

type PortalType = "anytrader" | "anyride";
type ActiveRoleType = "customer" | "trader" | "business" | "admin" | "driver" | "ecosystem_manager";
type ThemeType = "light" | "dark" | "anyride";

interface PortalContextType {
  activePortal: PortalType;
  switchPortal: (portal: PortalType) => void;
  activeRole: ActiveRoleType;
  setActiveRole: (role: ActiveRoleType) => void;
  availableRoles: ActiveRoleType[];
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  preventPortalSwitch: boolean;
  setPreventPortalSwitch: (prevent: boolean) => void;
}

const PortalContext = createContext<PortalContextType | undefined>(undefined);

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  
  // Default to anyride if fleet_driver, otherwise anytrader
  const defaultPortal = profile?.role === "fleet_driver" ? "anyride" : "anytrader";
  
  const [activePortal, setActivePortal] = useState<PortalType>(() => {
    const saved = localStorage.getItem("anytrader_active_portal");
    if (saved === "anytrader" || saved === "anyride") {
      return saved;
    }
    return defaultPortal;
  });

  const [theme, setThemeState] = useState<ThemeType>(() => {
    const saved = localStorage.getItem("anyride_theme") as ThemeType;
    return saved || "light";
  });

  const [preventPortalSwitch, setPreventPortalSwitch] = useState<boolean>(false);

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
    localStorage.setItem("anyride_theme", newTheme);
  };

  useEffect(() => {
    // Apply theme to body
    document.body.classList.remove("theme-dark", "theme-anyride");
    if (theme === "dark") document.body.classList.add("theme-dark");
    if (theme === "anyride") document.body.classList.add("theme-anyride");
  }, [theme]);

  // Calculate user's available roles based on profile
  const availableRoles: ActiveRoleType[] = [];
  if (profile) {
    if (profile.role === "admin") availableRoles.push("admin");
    else if (profile.role === "ecosystem_manager") availableRoles.push("ecosystem_manager");
    else {
      availableRoles.push("customer"); // Everyone can be a customer
      if (profile.role === "fleet_driver" || profile.role === "driver") availableRoles.push("driver");
      if (profile.role === "tradesperson") availableRoles.push("trader");
      if (profile.subscriptionType === "business") availableRoles.push("business");
    }
  }

  // Determine initial role
  const determineInitialRole = (): ActiveRoleType => {
    const saved = localStorage.getItem("anytrader_active_role") as ActiveRoleType;
    if (saved && availableRoles.includes(saved)) return saved;
    
    if (profile?.role === "admin") return "admin";
    if (profile?.role === "ecosystem_manager") return "ecosystem_manager";
    if ((profile?.role === "fleet_driver" || profile?.role === "driver") && activePortal === "anyride") return "driver";
    if (profile?.subscriptionType === "business") return "business";
    if (profile?.role === "tradesperson") return "trader";
    return "customer";
  };

  const [activeRole, setActiveRoleState] = useState<ActiveRoleType>(determineInitialRole());

  useEffect(() => {
    localStorage.setItem("anytrader_active_portal", activePortal);
  }, [activePortal]);

  useEffect(() => {
    localStorage.setItem("anytrader_active_role", activeRole);
  }, [activeRole]);

  // Sync role if portal switches to anyride (force driver or customer)
  useEffect(() => {
    // Force activeRole update when profile becomes available
    if (profile) {
      const saved = localStorage.getItem("anytrader_active_role") as ActiveRoleType;
      // If user is admin but current role state is customer, we need to fix it
      if (profile.role === "admin" && activeRole !== "admin") {
        setActiveRoleState("admin");
        return;
      }
      if (profile.role === "ecosystem_manager" && activeRole !== "ecosystem_manager") {
        setActiveRoleState("ecosystem_manager");
        return;
      }
    }

    if (profile?.role === "admin" || profile?.role === "ecosystem_manager") return;

    if (activePortal === "anyride") {
       if (profile?.role === "fleet_driver" || profile?.role === "driver") setActiveRoleState("driver");
       else setActiveRoleState("customer");
    } else {
       // if they switch back to anytrader and were acting as driver, put them back to default trader/business/customer
       if (activeRole === "driver") {
          setActiveRoleState(profile?.subscriptionType === "business" ? "business" : (profile?.role === "tradesperson" ? "trader" : "customer"));
       }
    }
  }, [activePortal, profile]);

  const switchPortal = (portal: PortalType) => {
    setActivePortal(portal);
  };

  const setActiveRole = (role: ActiveRoleType) => {
    if (availableRoles.includes(role)) {
      setActiveRoleState(role);
    }
  };

  return (
    <PortalContext.Provider value={{ activePortal, switchPortal, activeRole, setActiveRole, availableRoles, theme, setTheme, preventPortalSwitch, setPreventPortalSwitch }}>
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  const context = useContext(PortalContext);
  if (context === undefined) {
    throw new Error("usePortal must be used within a PortalProvider");
  }
  return context;
}

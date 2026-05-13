import React from "react";
import { useAuth } from "./AuthProvider";
import { cn } from "@/src/lib/utils";
import { HireB2BServiceManager } from "./HireB2BServiceManager";
import { useBusinessTab } from "@/src/store/businessTabStore";
import TradesDashboard from "./TradesDashboard";

export function FieldServicesManager() {
  const { user } = useAuth();
  const { activeSubTab, setActiveSubTab } = useBusinessTab();

  return (
    <div className="flex flex-col">
      <div className="mt-0">
        {activeSubTab === "work_hub" ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <TradesDashboard isSubView={true} />
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
             <HireB2BServiceManager />
          </div>
        )}
      </div>
    </div>
  );
}

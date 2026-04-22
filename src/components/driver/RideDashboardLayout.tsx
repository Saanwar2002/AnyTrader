import React, { useState } from "react";
import PassengerBooking from "./PassengerBooking";
import ActivityTab from "./ActivityTab";
import InboxTab from "./InboxTab";
import MenuTab from "./MenuTab";
import SavedJourneys from "../SavedJourneys";
import BillingTab from "../BillingTab";
import { Car, Clock, Inbox, Menu, Bookmark, Wallet } from "lucide-react";
import { cn } from "@/src/lib/utils";
import PlatformSwitcher from "../shared/PlatformSwitcher";

export default function RideDashboardLayout() {
  const [activeTab, setActiveTab] = useState("ride");

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-surface overflow-hidden">
      {/* Content Area */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        <div className="flex-1 relative flex flex-col transition-all duration-300">
          {activeTab === "ride" && <PassengerBooking />}
          {activeTab === "activity" && <ActivityTab />}
          {activeTab === "saved" && <SavedJourneys />}
          {activeTab === "inbox" && <InboxTab />}
          {activeTab === "billing" && <BillingTab />}
          {activeTab === "menu" && <MenuTab />}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="bg-card border-t border-border-main pb-safe pt-2 px-1 flex items-center justify-around h-[70px] z-50">
        {[
          { id: "ride", icon: Car, label: "Ride" },
          { id: "activity", icon: Clock, label: "Rides" },
          { id: "saved", icon: Bookmark, label: "Saved" },
          { id: "inbox", icon: Inbox, label: "Chat" },
          { id: "billing", icon: Wallet, label: "Bills" },
          { id: "menu", icon: Menu, label: "Menu" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-xl transition-all min-w-[60px]",
              activeTab === tab.id ? "text-primary scale-110" : "text-text-muted hover:text-text-main"
            )}
          >
            <tab.icon className={cn("w-5 h-5", activeTab === tab.id && "fill-current")} />
            <span className="text-[9px] font-black uppercase tracking-tight">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

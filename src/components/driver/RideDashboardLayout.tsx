import React, { useState } from "react";
import PassengerBooking from "./PassengerBooking";
import ActivityTab from "./ActivityTab";
import InboxTab from "./InboxTab";
import MenuTab from "./MenuTab";
import SavedJourneys from "../SavedJourneys";
import BillingTab from "../BillingTab";
import { Car, Clock, Inbox, Menu, Bookmark, Wallet, Star } from "lucide-react";
import { cn } from "@/src/lib/utils";
import PlatformSwitcher from "../shared/PlatformSwitcher";

export default function RideDashboardLayout() {
  const [activeTab, setActiveTab] = useState("taxi");

  const renderContent = () => {
    switch (activeTab) {
      case "taxi": return <PassengerBooking />;
      case "activity": return <ActivityTab />;
      case "saved": return <SavedJourneys />;
      case "inbox": return <InboxTab />;
      case "menu": return <MenuTab />;
      default: return <PassengerBooking />;
    }
  };

  const navItems = [
    { id: "taxi", name: "Taxi", icon: Car },
    { id: "activity", name: "My Rides", icon: Clock },
    { id: "saved", name: "Favorite", icon: (props: any) => <Star {...props} className={cn(props.className, "text-amber-500 fill-amber-400")} /> },
    { id: "inbox", name: "Messages", icon: Inbox },
    { id: "menu", name: "Menu", icon: Menu },
  ];

  return (
    <div className="flex flex-col flex-1 w-full bg-surface overflow-hidden min-h-0 relative">
      <div className={cn("flex-1 relative z-0", activeTab === "taxi" ? "flex flex-col overflow-hidden" : "overflow-y-auto no-scrollbar pb-[calc(4rem+env(safe-area-inset-bottom))]")}>
         {renderContent()}
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-[100] bg-surface pb-[env(safe-area-inset-bottom)] border-t border-border-main">
        <div className="flex items-center justify-around px-2 py-1 bg-surface h-16">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="flex flex-col items-center justify-center w-16 h-full gap-1 active:scale-95 transition-all"
              >
                <item.icon className={cn("w-6 h-6", isActive ? "text-primary" : "text-text-muted")} />
                <span className={cn("text-[8px] font-bold tracking-tight", isActive ? "text-text-main" : "text-text-muted")}>
                  {item.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

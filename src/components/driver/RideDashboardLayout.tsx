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
  return (
    <div className="flex flex-col flex-1 w-full bg-surface overflow-hidden min-h-0">
      <PassengerBooking />
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { cn } from "@/src/lib/utils";

export const EmergencyTimer = ({ postedDate }: { postedDate: any }) => {
  const [remaining, setRemaining] = useState<string>("");
  const [isExpired, setIsExpired] = useState<boolean>(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const posted = postedDate?.seconds ? new Date(postedDate.seconds * 1000) : new Date(postedDate);
      const expiry = new Date(posted.getTime() + 2 * 60 * 60 * 1000); // 2 hours
      const now = new Date();
      const diff = expiry.getTime() - now.getTime();

      if (diff <= 0) {
        setRemaining("Expired");
        setIsExpired(true);
        clearInterval(interval);
      } else {
        const mins = Math.floor((diff / 1000 / 60) % 60);
        const hours = Math.floor(diff / 1000 / 60 / 60);
        setRemaining(`${hours}h ${mins}m left`);
        setIsExpired(false);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [postedDate]);

  return (
    <span className={cn("font-bold", isExpired ? "text-slate-500" : "text-red-600")}>
      Emergency {isExpired ? "• Expired" : `• ${remaining}`}
      {isExpired && (
        <span className="block text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md mt-1 border border-blue-200">
          Still Seeking Quotes
        </span>
      )}
    </span>
  );
};

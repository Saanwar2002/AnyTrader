import { useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { processRecurringSchedules } from "@/src/services/recurringJobs";

export function RecurringJobManager() {
  const { user } = useAuth();

  useEffect(() => {
    if (user?.uid) {
      // Run the check on mount
      processRecurringSchedules(user.uid);
      
      // Optionally run it periodically if the app stays open
      const interval = setInterval(() => {
        processRecurringSchedules(user.uid);
      }, 1000 * 60 * 60); // Every hour

      return () => clearInterval(interval);
    }
  }, [user?.uid]);

  return null;
}

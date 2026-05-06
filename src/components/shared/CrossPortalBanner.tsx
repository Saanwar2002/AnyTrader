import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, collection, query, where, onSnapshot } from "@/src/firebase";
import { useAuth } from "../AuthProvider";
import { usePortal } from "../../lib/PortalContext";
import { Car, Wrench } from "lucide-react";

export default function CrossPortalBanner() {
  const { user } = useAuth();
  const { activePortal, switchPortal } = usePortal();
  const navigate = useNavigate();

  const [activeRide, setActiveRide] = useState<any>(null);
  const [activeJob, setActiveJob] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    // Listen for active rides
    const qRides = query(
      collection(db, "ride_requests"),
      where("passengerId", "==", user.uid)
    );

    const unsubRidesPassenger = onSnapshot(qRides, (snapshot) => {
      let foundActive = null;
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (['accepted', 'arriving', 'in_progress'].includes(data.status)) {
          foundActive = { id: doc.id, ...data };
          break;
        }
      }
      setActiveRide(foundActive);
    }, () => {});

    return () => {
      unsubRidesPassenger();
    };
  }, [user]);

  // Listen for active jobs (homeowner or tradesperson)
  useEffect(() => {
    if (!user) return;

    // Listen for active jobs (homeowner)
    const qJobs = query(
      collection(db, "jobs"),
      where("homeownerId", "==", user.uid)
    );

    const unsubJobs = onSnapshot(qJobs, (snapshot) => {
      let foundActive = null;
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (['accepted', 'in_progress', 'en_route'].includes(data.status)) {
          foundActive = { id: doc.id, ...data };
          break;
        }
      }
      setActiveJob(prev => foundActive || prev);
    }, () => {});

    // Listen for active jobs (tradesperson)
    const qJobsTrader = query(
      collection(db, "jobs"),
      where("acceptedTradespersonId", "==", user.uid)
    );
    const unsubJobsTrader = onSnapshot(qJobsTrader, (snapshot) => {
      let foundActive = null;
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (['accepted', 'in_progress', 'en_route'].includes(data.status)) {
          foundActive = { id: doc.id, ...data };
          break;
        }
      }
      setActiveJob(prev => foundActive || prev);
    }, () => {});

    return () => {
      unsubJobs();
      unsubJobsTrader();
    };
  }, [user]);

  // When on AnyTrader but there is an active ride
  if (activePortal === 'anytrader' && activeRide) {
    return (
      <button 
        onClick={() => {
          switchPortal('anyroller');
          navigate('/my-rides');
        }}
        className="w-full bg-[#00D26A] text-[#0D0D0F] px-4 py-3 flex items-center justify-center gap-3 shadow-lg z-[60] sticky top-0 active:scale-[0.98] transition-all border-b border-[#00D26A]/80 cursor-pointer"
      >
        <Car className="w-5 h-5 flex-shrink-0" />
        <span className="font-bold text-sm tracking-wide">
          Ride in progress — {activeRide.status === 'in_progress' ? 'En Route' : 'Driver Arriving'}
        </span>
      </button>
    );
  }

  // When on AnyRoller but there is an active job
  if (activePortal === 'anyroller' && activeJob) {
    return (
      <button 
        onClick={() => {
          switchPortal('anytrader');
          navigate(`/jobs/${activeJob.id}`);
        }}
        className="w-full bg-[#007AFF] text-white px-4 py-3 flex items-center justify-center gap-3 shadow-lg z-[60] sticky top-0 active:scale-[0.98] transition-all border-b border-[#007AFF]/80 cursor-pointer"
      >
        <Wrench className="w-5 h-5 flex-shrink-0" />
        <span className="font-bold text-sm tracking-wide">
          Trader en route — {activeJob.scheduledDate ? new Date(activeJob.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Arriving soon'}
        </span>
      </button>
    );
  }

  return null;
}

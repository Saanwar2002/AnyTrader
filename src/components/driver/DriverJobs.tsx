import React, { useState, useEffect } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/src/firebase";
import { useAuth } from "../AuthProvider";
import { Clock, Car, ChevronRight, CheckCircle2, Navigation, PoundSterling, X } from "lucide-react";

export default function DriverJobs({ onClose }: { onClose?: () => void }) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "ride_requests"),
      where("driverId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setJobs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  const completedJobs = jobs.filter(j => j.status === "completed");

  return (
    <div className="flex-1 bg-[#0D0D0F] text-white overflow-y-auto px-4 py-6 font-sans pb-24 min-h-0">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black tracking-tighter">My Jobs</h1>
        <div className="flex items-center gap-2">
          <div className="bg-[#2C2C30] px-3 py-1 rounded-full border border-[#333338]">
            <p className="text-[10px] font-black uppercase text-[#E4E4E7] tracking-widest flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-[#00D26A]" /> {completedJobs.length} Completed
            </p>
          </div>
          {onClose && (
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-[#1A1A1E] rounded-full border border-[#2C2C30] text-[#A1A1AA] hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-[#A1A1AA] py-10 font-medium">Loading your job history...</div>
      ) : (
        <div className="space-y-3">
          {completedJobs.length > 0 ? (
            completedJobs.map((job) => {
              const date = job.createdAt?.seconds 
                ? new Date(job.createdAt.seconds * 1000).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                : 'Recent';
                
              const time = job.createdAt?.seconds
                ? new Date(job.createdAt.seconds * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <div 
                  key={job.id} 
                  className="bg-[#1A1A1E] rounded-3xl p-4 border border-[#2C2C30] shadow-sm relative overflow-hidden"
                >
                  <div className="flex items-start justify-between mb-3 border-b border-[#2C2C30] pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#00D26A]/10 rounded-2xl flex items-center justify-center text-[#00D26A]">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white leading-tight">Drop-off: {job.dropoffAddress?.split(',')[0] || job.dropoff?.split(',')[0] || "Completed Journey"}</h4>
                        <p className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-widest mt-0.5">
                          {date} • {time}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase text-[#00D26A] tracking-widest mb-0.5">Earned</p>
                      <h4 className="font-black text-xl text-white">£{job.driverEarnings?.toFixed(2) || (job.fareEstimate * 0.88).toFixed(2)}</h4>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 px-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#A1A1AA] tracking-wide">
                      <PoundSterling className="w-3.5 h-3.5" /> Gross: £{job.fareEstimate?.toFixed(2)}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#A1A1AA] tracking-wide">
                      <Navigation className="w-3.5 h-3.5" /> {job.distanceMiles?.toFixed(1) || "-"} miles
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
             <div className="bg-[#1A1A1E] rounded-3xl p-8 border border-[#2C2C30] text-center border-dashed mt-8">
               <Car className="w-12 h-12 text-[#333338] mx-auto mb-4" />
               <h3 className="text-white font-bold mb-2">No completed jobs yet</h3>
               <p className="text-[#A1A1AA] text-sm">Once you complete rides, they will appear here along with your earnings breakdown.</p>
             </div>
          )}
        </div>
      )}
    </div>
  );
}

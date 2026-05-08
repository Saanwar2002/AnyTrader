import React, { useState, useEffect } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/src/firebase";
import { useAuth } from "../AuthProvider";
import { Clock, Car, ChevronDown, ChevronUp, CheckCircle2, Navigation, PoundSterling, X, MapPin, Zap, Search } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function DriverJobs({ onClose }: { onClose?: () => void }) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [isListExpanded, setIsListExpanded] = useState(false);

  // Custom date filter states
  const [filterDay, setFilterDay] = useState("--");
  const [filterMonth, setFilterMonth] = useState("--");
  const [filterYear, setFilterYear] = useState("----");

  useEffect(() => {
    if (!user) return;


    const q = query(
      collection(db, "ride_requests"),
      where("driverId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setJobs(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  // Reset list expansion when filters change
  useEffect(() => {
    setIsListExpanded(false);
  }, [filter, filterDay, filterMonth, filterYear]);

  const completedJobs = jobs.filter(j => j.status === "completed" || j.status === 'rider_abandoned');

  const filteredJobs = completedJobs.filter(job => {
    if (!job.createdAt?.seconds && !job.completedAt?.seconds) return true;
    
    const jobDate = new Date((job.completedAt?.seconds || job.createdAt?.seconds) * 1000);
    const now = new Date();

    // If custom date filters are set, they override the tab filter
    if (filterDay !== "--" || filterMonth !== "--" || filterYear !== "----") {
      const dayMatch = filterDay === "--" || jobDate.getDate().toString().padStart(2, '0') === filterDay;
      const monthMatch = filterMonth === "--" || (jobDate.getMonth() + 1).toString().padStart(2, '0') === filterMonth;
      const yearMatch = filterYear === "----" || jobDate.getFullYear().toString() === filterYear;
      return dayMatch && monthMatch && yearMatch;
    }
    
    if (filter === 'all') return true;
    
    if (filter === 'today') {
      return jobDate.getDate() === now.getDate() && 
             jobDate.getMonth() === now.getMonth() && 
             jobDate.getFullYear() === now.getFullYear();
    }
    
    if (filter === 'week') {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1));
      weekStart.setHours(0, 0, 0, 0);
      return jobDate >= weekStart;
    }
    
    if (filter === 'month') {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      return jobDate >= monthStart;
    }
    
    return true;
  });

  const currentYear = new Date().getFullYear();
  const years = ["----", ...Array.from({length: 5}, (_, i) => (currentYear - i).toString())];
  const months = ["--", "01","02","03","04","05","06","07","08","09","10","11","12"];
  const days = ["--", ...Array.from({length: 31}, (_, i) => (i + 1).toString().padStart(2, '0'))];

  const jobsToDisplay = isListExpanded ? filteredJobs : filteredJobs.slice(0, 4);

  return (
    <div className="flex-1 bg-[#0D0D0F] text-white overflow-y-auto px-4 py-6 font-sans pb-24 min-h-0">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black tracking-tighter">My Jobs</h1>
        <div className="flex items-center gap-2">
          <div className="bg-[#2C2C30] px-3 py-1 rounded-full border border-[#333338]">
            <p className="text-[10px] font-black uppercase text-[#E4E4E7] tracking-widest flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-[#00D26A]" /> {filteredJobs.length} Completed
            </p>
          </div>
          {onClose && (
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-[#1A1A1E] rounded-full border border-[#2C2C30] text-[#A1A1AA] hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      
      {/* Date Filters */}
      <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-2xl p-4 mb-6 mt-4">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-[#A1A1AA]" />
          <p className="text-xs font-bold text-white uppercase tracking-wider">Search by Date</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <select 
            className="bg-[#0D0D0F] border border-[#2C2C30] text-white text-sm rounded-xl px-3 py-2 outline-none"
            value={filterDay}
            onChange={(e) => setFilterDay(e.target.value)}
          >
            {days.map(d => <option key={d} value={d}>{d === "--" ? "Day" : d}</option>)}
          </select>
          <select 
            className="bg-[#0D0D0F] border border-[#2C2C30] text-white text-sm rounded-xl px-3 py-2 outline-none"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
          >
            {months.map(m => <option key={m} value={m}>{m === "--" ? "Month" : m}</option>)}
          </select>
          <select 
            className="bg-[#0D0D0F] border border-[#2C2C30] text-white text-sm rounded-xl px-3 py-2 outline-none"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
          >
            {years.map(y => <option key={y} value={y}>{y === "----" ? "Year" : y}</option>)}
          </select>
        </div>
      </div>

      {/* Filters */}
      <div className="flex overflow-x-auto gap-2 mb-8 pb-2 scrollbar-hide">
        {[
          { id: 'today', label: 'Today' },
          { id: 'week', label: 'This Week' },
          { id: 'month', label: 'This Month' },
          { id: 'all', label: 'All Time' }
        ].map(f => (
          <button
            key={f.id}
            onClick={() => {
              setFilter(f.id as any);
              setFilterDay("--");
              setFilterMonth("--");
              setFilterYear("----");
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors border ${
              filter === f.id && filterDay === "--" && filterMonth === "--" && filterYear === "----"
                ? 'bg-white text-black border-white' 
                : 'bg-[#1A1A1E] text-[#A1A1AA] border-[#2C2C30] hover:bg-[#2C2C30] hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-[#A1A1AA] py-10 font-medium">Loading your job history...</div>
      ) : (
        <div className="space-y-3">
          {filteredJobs.length > 0 ? (
            <>
              {jobsToDisplay.map((job) => {
              const date = job.createdAt?.seconds 
                ? new Date(job.createdAt.seconds * 1000).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                : 'Recent';
                
              const time = job.createdAt?.seconds
                ? new Date(job.createdAt.seconds * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                : '';

              const isExpanded = expandedJobId === job.id;
              
              const grossFare = job.fareEstimate || 0;
              const commission = (grossFare * 0.12);
              const driverEarnings = job.driverEarnings || (grossFare - commission);
              const isAbandoned = job.status === 'rider_abandoned';

              return (
                <div 
                  key={job.id} 
                  className="bg-[#1A1A1E] rounded-3xl border border-[#2C2C30] shadow-sm relative overflow-hidden transition-colors hover:border-[#3F3F46]"
                >
                  <div 
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isAbandoned ? 'bg-red-500/10 text-red-500' : 'bg-[#00D26A]/10 text-[#00D26A]'}`}>
                          {isAbandoned ? <X className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                        </div>
                        <div>
                          <h4 className="font-bold text-white leading-tight line-clamp-1 max-w-[180px]">
                            {job.dropoffAddress?.split(',')[0] || job.dropoff?.split(',')[0] || "Completed Journey"}
                          </h4>
                          <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${isAbandoned ? 'text-[#FF3B30]' : 'text-[#A1A1AA]'}`}>
                            {isAbandoned ? 'Rider Abandoned' : `${date} • ${time}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <p className="text-[10px] font-black uppercase text-[#00D26A] tracking-widest mb-0.5">Earned</p>
                        <h4 className="font-black text-xl text-white">£{(job.finalFare ? (job.finalFare - (job.tipAmount || 0)) * 0.88 + (job.tipAmount || 0) : driverEarnings + (job.tipAmount || 0)).toFixed(2)}</h4>
                      </div>
                    </div>
                    
                    {!isExpanded && (
                      <div className="mt-3 pt-3 border-t border-[#2C2C30] flex items-center justify-between">
                        <div className="flex gap-4">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#A1A1AA] tracking-wide">
                            <PoundSterling className="w-3.5 h-3.5" /> Gross: £{(job.finalFare || grossFare)?.toFixed(2)}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#A1A1AA] tracking-wide">
                            <Navigation className="w-3.5 h-3.5" /> {job.distanceMiles?.toFixed(1) || "-"} mi
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-[#A1A1AA]" /> : <ChevronDown className="w-4 h-4 text-[#A1A1AA]" />}
                      </div>
                    )}
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-[#252529]"
                      >
                        <div className="p-4 border-t border-[#333338]">
                          {/* Route Details */}
                          <div className="relative pl-6 mb-5 space-y-4">
                            <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-gradient-to-b from-[#00D26A] via-[#333338] to-[#FF3B30] rounded-full"></div>
                            
                            <div className="relative">
                              <div className="absolute -left-[22px] top-0.5 w-2.5 h-2.5 rounded-full bg-[#00D26A] border-2 border-[#1A1A1E]"></div>
                              <p className="text-[10px] font-black tracking-widest text-[#A1A1AA] uppercase mb-0.5">Pickup</p>
                              <p className="text-sm font-medium text-white">{job.pickupAddress || job.pickup || "Unknown Pickup"}</p>
                            </div>

                            {job.stops && job.stops.length > 0 && job.stops.map((stop: any, idx: number) => (
                              <div className="relative" key={idx}>
                                <div className="absolute -left-[22px] top-0.5 w-2.5 h-2.5 rounded-full bg-[#FEF08A] border-2 border-[#1A1A1E]"></div>
                                <p className="text-[10px] font-black tracking-widest text-[#A1A1AA] uppercase mb-0.5">Stop {idx + 1}</p>
                                <p className="text-sm font-medium text-white">{stop.address || "Unknown Stop"}</p>
                              </div>
                            ))}

                            <div className="relative">
                              <div className="absolute -left-[22px] top-0.5 w-2.5 h-2.5 rounded-sm bg-[#FF3B30] border-2 border-[#1A1A1E]"></div>
                              <p className="text-[10px] font-black tracking-widest text-[#A1A1AA] uppercase mb-0.5">Drop-off</p>
                              <p className="text-sm font-medium text-white">{job.dropoffAddress || job.dropoff || "Unknown Drop-off"}</p>
                            </div>
                          </div>

                          {/* Fare Breakdown */}
                          <div className="bg-[#1A1A1E] rounded-2xl p-4 border border-[#333338]">
                            <p className="text-[10px] font-black uppercase text-[#E4E4E7] tracking-widest mb-3 border-b border-[#333338] pb-2">Fare Breakdown</p>
                            <div className="space-y-2 mb-3">
                              <div className="flex justify-between text-xs text-[#A1A1AA]">
                                <span>Gross Fare / Time & Distance:</span>
                                <span className="text-white">£{((job.finalFare ? job.finalFare - (job.tipAmount || 0) : grossFare) - (job.isPriority ? 3 : 0) - (isAbandoned ? 5 : 0) - (job.surgeFixed || 0)).toFixed(2)}</span>
                              </div>
                              {job.tipAmount > 0 && (
                                <div className="flex justify-between text-xs text-emerald-400">
                                  <span>Passenger Tip (100% yours):</span>
                                  <span className="font-bold">+£{job.tipAmount.toFixed(2)}</span>
                                </div>
                              )}
                              {job.isPriority && (
                                <div className="flex justify-between text-xs text-[#00E5FF]">
                                  <span>Priority Booking:</span>
                                  <span className="font-bold">+£3.00</span>
                                </div>
                              )}
                              {job.surgeModel && (
                                <div className="flex justify-between text-xs text-[#FF9500]">
                                  <span>Surge ({job.surgeModel === 'fixed' ? 'Fixed' : (job.surgeMultiplier || '1.4') + 'x'}):</span>
                                  <span className="font-bold">+£{job.surgeModel === 'fixed' ? (job.surgeFixed || 2.0).toFixed(2) : ((job.fareEstimate || 38.50) - (job.baseCalc || 30)).toFixed(2)}</span>
                                </div>
                              )}
                              {isAbandoned && (
                                <div className="flex justify-between text-xs text-[#FF3B30]">
                                  <span>Abandonment Fee:</span>
                                  <span className="font-bold">+£5.00</span>
                                </div>
                              )}
                              
                              <div className="flex justify-between text-xs font-bold text-[#FF3B30] mt-2 pt-2 border-t border-[#333338]">
                                <span>Platform Commission (12%):</span>
                                <span>-£{((job.finalFare ? job.finalFare - (job.tipAmount || 0) : grossFare) * 0.12).toFixed(2)}</span>
                              </div>
                            </div>
                            
                            <div className="border-t-2 border-[#00D26A]/30 pt-3 mt-3 flex justify-between items-end">
                              <span className="text-xs font-black uppercase tracking-widest text-[#00D26A]">Net Earnings</span>
                              <span className="text-xl font-black text-[#00D26A]">£{(job.finalFare ? (job.finalFare - (job.tipAmount || 0)) * 0.88 + (job.tipAmount || 0) : driverEarnings + (job.tipAmount || 0)).toFixed(2)}</span>
                            </div>
                          </div>
                          
                          {/* Payment Method & Status */}
                          <div className="flex items-center justify-between mt-4 px-2">
                             <div className="flex items-center gap-1.5">
                               {job.paymentMethod === 'cash' ? (
                                 <PoundSterling className="w-4 h-4 text-[#A1A1AA]" />
                               ) : (
                                 <svg className="w-5 h-5 opacity-70" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                   <rect x="2" y="5" width="20" height="14" rx="2" stroke="white" strokeWidth="2"/>
                                   <path d="M2 10H22" stroke="white" strokeWidth="2"/>
                                 </svg>
                               )}
                               <span className="text-xs font-bold text-[#A1A1AA] uppercase tracking-wider">{job.paymentMethod === 'cash' ? 'Cash Trip' : 'Card Payment'}</span>
                             </div>
                             {job.isPriority && (
                                <div className="flex items-center gap-1 bg-white text-black px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">
                                  <Zap className="w-3 h-3 fill-black text-black" /> Priority
                                </div>
                             )}
                          </div>
                          
                        </div>
                        <div className="cursor-pointer text-center py-2 bg-[#2C2C30]/50 hover:bg-[#2C2C30] transition-colors" onClick={() => setExpandedJobId(null)}>
                           <ChevronUp className="w-4 h-4 text-[#A1A1AA] mx-auto" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
            
            {!isListExpanded && filteredJobs.length > 4 && (
              <button 
                onClick={() => setIsListExpanded(true)}
                className="w-full flex items-center justify-center gap-2 bg-[#1A1A1E] border border-[#2C2C30] hover:bg-[#2C2C30] rounded-2xl py-4 transition-colors mt-4 text-[#A1A1AA] hover:text-white"
              >
                <span className="text-xs font-black uppercase tracking-widest">Show all {filteredJobs.length} past jobs</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            )}
            
            {isListExpanded && filteredJobs.length > 4 && (
              <button 
                onClick={() => setIsListExpanded(false)}
                className="w-full flex items-center justify-center gap-2 bg-[#1A1A1E] border border-[#2C2C30] hover:bg-[#2C2C30] rounded-2xl py-4 transition-colors mt-4 text-[#A1A1AA] hover:text-white"
              >
                <span className="text-xs font-black uppercase tracking-widest">Collapse Job List</span>
                <ChevronUp className="w-4 h-4" />
              </button>
            )}
            </>
          ) : (
             <div className="bg-[#1A1A1E] rounded-3xl p-8 border border-[#2C2C30] text-center border-dashed mt-8">
               <Car className="w-12 h-12 text-[#333338] mx-auto mb-4" />
               <h3 className="text-white font-bold mb-2">No completed jobs</h3>
               <p className="text-[#A1A1AA] text-sm">Rides matching your filter will appear here.</p>
             </div>
          )}
        </div>
      )}
    </div>
  );
}

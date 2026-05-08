import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, History, Car, ShieldCheck, ChevronDown, ChevronUp, MapPin, Navigation, User, CreditCard, Banknote, Search, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from "@/src/lib/utils";

interface FullTripHistoryProps {
  trips: any[];
  onClose: () => void;
  loading: boolean;
}

export default function DriverFullTripHistory({ trips, onClose, loading }: FullTripHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  
  // Date filters
  const [selectedDay, setSelectedDay] = useState<string>("All");
  const [selectedMonth, setSelectedMonth] = useState<string>("All");
  const [selectedYear, setSelectedYear] = useState<string>("All");

  const toggleTripExpansion = (id: string) => {
    setExpandedTripId(prev => prev === id ? null : id);
  };

  const currentYear = new Date().getFullYear();
  const years = ["All", ...Array.from({length: 5}, (_, i) => (currentYear - i).toString())];
  const months = ["All", "01","02","03","04","05","06","07","08","09","10","11","12"];
  const days = ["All", ...Array.from({length: 31}, (_, i) => (i + 1).toString().padStart(2, '0'))];

  const filteredTrips = useMemo(() => {
    return trips.filter(trip => {
       const date = new Date(trip.completedAt?.seconds * 1000 || trip.createdAt?.seconds * 1000 || Date.now());
       const d = date.getDate().toString().padStart(2, '0');
       const m = (date.getMonth() + 1).toString().padStart(2, '0');
       const y = date.getFullYear().toString();

       if (selectedDay !== "All" && d !== selectedDay) return false;
       if (selectedMonth !== "All" && m !== selectedMonth) return false;
       if (selectedYear !== "All" && y !== selectedYear) return false;
       return true;
    });
  }, [trips, selectedDay, selectedMonth, selectedYear]);

  // Is filter active?
  const isFilterActive = selectedDay !== "All" || selectedMonth !== "All" || selectedYear !== "All";

  // Display trips
  const displayedTrips = isFilterActive || isExpanded ? filteredTrips : filteredTrips.slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
      className="fixed inset-0 z-50 bg-[#0A0A0B] flex flex-col pt-16"
    >
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">Full History</h2>
            <p className="text-[#A1A1AA] text-xs font-bold uppercase tracking-wider mt-1">Recently completed jobs</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-[#1A1A1E] rounded-full flex items-center justify-center border border-[#2C2C30] active:scale-95 transition-all text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-2xl p-4 mb-6">
           <div className="flex items-center gap-2 mb-3">
              <Search className="w-4 h-4 text-[#A1A1AA]" />
              <p className="text-xs font-bold text-white uppercase tracking-wider">Search by Date</p>
           </div>
           <div className="grid grid-cols-3 gap-2">
              <select value={selectedDay} onChange={e => setSelectedDay(e.target.value)} className="bg-[#0D0D0F] border border-[#2C2C30] text-white text-sm rounded-xl px-3 py-2 outline-none">
                 <option value="All">Day</option>
                 {days.filter(d => d !== "All").map(d => <option key={`full-day-${d}`} value={d}>{d}</option>)}
              </select>
              <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-[#0D0D0F] border border-[#2C2C30] text-white text-sm rounded-xl px-3 py-2 outline-none">
                 <option value="All">Month</option>
                 {months.filter(m => m !== "All").map(m => <option key={`full-month-${m}`} value={m}>{m}</option>)}
              </select>
              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="bg-[#0D0D0F] border border-[#2C2C30] text-white text-sm rounded-xl px-3 py-2 outline-none">
                 <option value="All">Year</option>
                 {years.filter(y => y !== "All").map(y => <option key={`full-year-${y}`} value={y}>{y}</option>)}
              </select>
           </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-[#00D26A] border-t-transparent animate-spin mb-4" />
            <p className="text-sm text-[#A1A1AA] font-medium">Loading history...</p>
          </div>
        ) : filteredTrips.length === 0 ? (
          <div className="text-center py-12 bg-[#1A1A1E]/50 rounded-3xl border border-dashed border-[#2C2C30]">
            <History className="w-10 h-10 text-[#2C2C30] mx-auto mb-3" />
            <p className="text-sm text-[#E4E4E7] font-bold">No trips found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedTrips.map((trip) => {
              const tripDate = new Date(trip.completedAt?.seconds * 1000 || trip.createdAt?.seconds * 1000 || Date.now());
              const isExpandedCard = expandedTripId === trip.id;
              
              const totalFare = trip.fareEstimate || trip.finalFare || 0;
              const commission = totalFare * 0.12; // Example commission
              const netFare = typeof trip.driverEarnings === 'number' ? trip.driverEarnings : (totalFare - commission);
              const isCash = trip.paymentMethod === 'cash';

              return (
                <div
                  key={`fulltrip-${trip.id}`}
                  className="bg-[#1A1A1E] border border-[#2C2C30] rounded-3xl overflow-hidden transition-all"
                >
                  {/* Top Header - Always visible */}
                  <div 
                    onClick={() => toggleTripExpansion(trip.id)}
                    className="p-4 flex items-center justify-between cursor-pointer active:bg-[#252529] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-[#252529] flex items-center justify-center">
                        <Car className="w-5 h-5 text-[#E4E4E7]" />
                      </div>
                      <div className="max-w-[150px]">
                        <p className="text-sm font-bold text-white truncate">
                          {trip.dropoffAddress?.split(",")[0] || "Unknown"}
                        </p>
                        <p className="text-[10px] text-[#A1A1AA] font-bold uppercase mt-0.5">
                          {trip.rideType || "Standard"} •{" "}
                          {tripDate.toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                          {tripDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <p className="text-sm font-black text-[#00D26A]">
                        £{totalFare.toFixed(2)}
                      </p>
                      <div className="flex items-center gap-1 justify-end mt-0.5">
                        <ShieldCheck className="w-2.5 h-2.5 text-[#00D26A]" />
                        <span className="text-[9px] font-black text-[#00D26A] uppercase">
                          Paid
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {isExpandedCard && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-[#2C2C30] px-4 pb-4"
                      >
                         <div className="pt-4 space-y-4">
                            {/* Route Details */}
                            <div className="relative pl-6 space-y-4">
                              <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-[#2C2C30]" />
                              
                              <div className="relative">
                                <div className="absolute -left-[26px] top-0.5 w-4 h-4 bg-[#00D26A] rounded-full border-[3px] border-[#1A1A1E]" />
                                <p className="text-xs font-bold text-[#A1A1AA] uppercase">Pickup</p>
                                <p className="text-sm text-white font-medium">{trip.pickupAddress}</p>
                              </div>

                              {trip.stops && trip.stops.length > 0 && trip.stops.map((stop: any, idx: number) => (
                                <div key={`fulltrip-stop-${idx}`} className="relative">
                                  <div className="absolute -left-[26px] top-0.5 w-4 h-4 bg-[#FF9500] rounded-full border-[3px] border-[#1A1A1E]" />
                                  <p className="text-xs font-bold text-[#A1A1AA] uppercase">Stop {idx + 1}</p>
                                  <p className="text-sm text-white font-medium">{stop.address || stop}</p>
                                </div>
                              ))}

                              <div className="relative">
                                <div className="absolute -left-[26px] top-0.5 w-4 h-4 bg-[#FF3B30] rounded-full border-[3px] border-[#1A1A1E]" />
                                <p className="text-xs font-bold text-[#A1A1AA] uppercase">Dropoff</p>
                                <p className="text-sm text-white font-medium">{trip.dropoffAddress}</p>
                              </div>
                            </div>

                            {/* Trip Info */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                               <div className="bg-[#0D0D0F] p-3 rounded-xl border border-[#2C2C30]">
                                  <div className="flex items-center gap-2 mb-1">
                                     <User className="w-3.5 h-3.5 text-[#A1A1AA]" />
                                     <p className="text-[10px] font-bold text-[#A1A1AA] uppercase">Passenger</p>
                                  </div>
                                  <p className="text-sm font-white font-bold">{trip.passengerName || "Guest User"}</p>
                               </div>
                               <div className="bg-[#0D0D0F] p-3 rounded-xl border border-[#2C2C30]">
                                  <div className="flex items-center gap-2 mb-1">
                                     <Car className="w-3.5 h-3.5 text-[#A1A1AA]" />
                                     <p className="text-[10px] font-bold text-[#A1A1AA] uppercase">Vehicle</p>
                                  </div>
                                  <p className="text-sm font-white font-bold truncate">
                                     {trip.vehicleDetails?.make} {trip.vehicleDetails?.model} • {trip.vehicleDetails?.licensePlate}
                                  </p>
                               </div>
                            </div>

                            {/* Fare Breakdown */}
                            <div className="bg-[#0D0D0F] p-3 rounded-xl border border-[#2C2C30]">
                               <p className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider mb-2">Fare Breakdown</p>
                               
                               <div className="space-y-1.5 text-xs">
                                  <div className="flex justify-between text-[#E4E4E7]">
                                     <span>Passenger Paid</span>
                                     <span>£{totalFare.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-[#FF3B30]">
                                     <span>Platform Fee (12%)</span>
                                     <span>-£{commission.toFixed(2)}</span>
                                  </div>
                                  {trip.tipAmount > 0 && (
                                     <div className="flex justify-between text-[#00D26A]">
                                        <span>Tip</span>
                                        <span>+£{trip.tipAmount.toFixed(2)}</span>
                                     </div>
                                  )}
                                  <div className="border-t border-[#2C2C30] my-2 pt-2 flex justify-between font-bold text-white">
                                     <span>Net Earnings</span>
                                     <span>£{(netFare + (trip.tipAmount || 0)).toFixed(2)}</span>
                                  </div>
                               </div>

                               <div className="mt-3 pt-3 border-t border-[#2C2C30]">
                                  <div className="flex items-center gap-2">
                                     {isCash ? (
                                        <Banknote className="w-4 h-4 text-[#FF9500]" />
                                     ) : (
                                        <CreditCard className="w-4 h-4 text-[#AF52DE]" />
                                     )}
                                     <p className="text-xs font-bold text-[#A1A1AA]">
                                        {isCash ? "Paid by Cash" : "Paid via Stripe"}
                                     </p>
                                  </div>
                               </div>
                            </div>
                         </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}

        {!isFilterActive && filteredTrips.length > 5 && (
           <button 
             onClick={() => setIsExpanded(!isExpanded)}
             className="w-full mt-4 flex items-center justify-center gap-2 bg-[#252529] hover:bg-[#333338] text-[#A1A1AA] hover:text-white transition-colors py-3 rounded-2xl text-xs font-bold uppercase tracking-widest"
           >
              {isExpanded ? "Show Less" : `Show All (${filteredTrips.length})`}
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
           </button>
        )}
      </div>
    </motion.div>
  );
}

import React, { useState, useEffect } from "react";
import { ChevronLeft, Info, Calendar as CalendarIcon, Clock, ChevronRight, Check } from "lucide-react";
import { useAuth } from "../AuthProvider";
import { db, doc, onSnapshot, getDoc, updateDoc } from "@/src/firebase";
import { toast } from "sonner";
import { cn } from "@/src/lib/utils";

type DaySchedule = {
  status: 'anytime' | 'unavailable' | 'specific';
  startTime?: string;
  endTime?: string;
};

const DEFAULT_SCHEDULE: Record<string, DaySchedule> = {
  Monday: { status: 'anytime' },
  Tuesday: { status: 'anytime' },
  Wednesday: { status: 'anytime' },
  Thursday: { status: 'anytime' },
  Friday: { status: 'anytime' },
  Saturday: { status: 'anytime' },
  Sunday: { status: 'anytime' },
};

const TIME_OPTIONS: string[] = [];
for (let i = 0; i < 24; i++) {
  const hour = i.toString().padStart(2, '0');
  TIME_OPTIONS.push(`${hour}:00`);
  TIME_OPTIONS.push(`${hour}:30`);
}

export default function DriverAvailability({ onClose }: { onClose: () => void }) {
  const { user, profile } = useAuth();
  const [maxDailyHours, setMaxDailyHours] = useState(24);
  const [onlineSecondsToday, setOnlineSecondsToday] = useState(0);
  const [schedule, setSchedule] = useState<Record<string, DaySchedule>>(DEFAULT_SCHEDULE);
  
  const [editingDay, setEditingDay] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.weeklySchedule) {
      setSchedule({ ...DEFAULT_SCHEDULE, ...profile.weeklySchedule });
    }
  }, [profile]);

  useEffect(() => {
    // Listen to Platform config
    const fetchConfig = async () => {
      try {
        const configDoc = await getDoc(doc(db, "platform_config", "rides"));
        if (configDoc.exists() && configDoc.data().maxDailyDriverHours) {
          setMaxDailyHours(configDoc.data().maxDailyDriverHours);
        }
      } catch (err) { }
    };
    fetchConfig();

    if (!user) return;
    
    // Listen to driver metrics for online time
    const unsub = onSnapshot(doc(db, "driver_metrics", user.uid), (docSnap) => {
      if (docSnap.exists()) {
         const data = docSnap.data();
         const today = new Date().toISOString().split('T')[0];
         if (data.date === today && data.onlineSecondsToday) {
            setOnlineSecondsToday(data.onlineSecondsToday);
         } else if (data.date !== today) {
            setOnlineSecondsToday(0); // Assuming the function resets it, or we visually reset
         }
      }
    });

    return () => unsub();
  }, [user]);

  const handleSaveSchedule = async (day: string, newSchedule: DaySchedule) => {
    if (!user) return;
    try {
      const updatedSchedule = { ...schedule, [day]: newSchedule };
      setSchedule(updatedSchedule);
      await updateDoc(doc(db, "users", user.uid), {
        weeklySchedule: updatedSchedule
      });
      toast.success("Schedule updated");
      setEditingDay(null);
    } catch (err) {
      toast.error("Failed to update schedule");
    }
  };

  const onlineHours = onlineSecondsToday / 3600;
  const remainingHours = Math.max(0, maxDailyHours - onlineHours);
  const percentage = Math.min(100, (onlineHours / maxDailyHours) * 100);

  const formatScheduleText = (s: DaySchedule) => {
     if (s.status === 'anytime') return 'Anytime';
     if (s.status === 'unavailable') return 'Unavailable';
     return `${s.startTime || '09:00'} - ${s.endTime || '17:00'}`;
  };

  if (editingDay) {
     const dayData = schedule[editingDay] || { status: 'anytime' };
     return (
        <div className="absolute inset-0 z-50 bg-[#0E0E11] flex flex-col pointer-events-auto overflow-hidden animate-in slide-in-from-right duration-200">
           {/* Header */}
           <div className="px-5 py-4 border-b border-white/20 flex items-center justify-between bg-[#1A1A1E] shadow-sm shrink-0">
             <button onClick={() => setEditingDay(null)} className="w-10 h-10 flex items-center justify-center bg-[#252529] active:bg-[#2C2C30] border border-white/20 rounded-full transition-colors">
               <ChevronLeft className="w-5 h-5 text-white" />
             </button>
             <h2 className="text-lg font-bold text-white">{editingDay} Schedule</h2>
             <div className="w-10" />
           </div>

           <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <div className="space-y-3">
                 <button 
                    onClick={() => handleSaveSchedule(editingDay, { status: 'anytime' })}
                    className={cn("w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left", dayData.status === "anytime" ? "bg-[#007AFF]/10 border-[#007AFF]" : "bg-[#1A1A1E] border-white/20")}
                 >
                    <span className={cn("font-medium", dayData.status === "anytime" ? "text-[#007AFF]" : "text-white")}>Anytime</span>
                    {dayData.status === 'anytime' && <Check className="w-5 h-5 text-[#007AFF]" />}
                 </button>
                 
                 <button 
                    onClick={() => handleSaveSchedule(editingDay, { status: 'unavailable' })}
                    className={cn("w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left", dayData.status === "unavailable" ? "bg-[#007AFF]/10 border-[#007AFF]" : "bg-[#1A1A1E] border-white/20")}
                 >
                    <span className={cn("font-medium", dayData.status === "unavailable" ? "text-[#007AFF]" : "text-white")}>Unavailable</span>
                    {dayData.status === 'unavailable' && <Check className="w-5 h-5 text-[#007AFF]" />}
                 </button>

                 <div className={cn("p-4 rounded-xl border transition-all", dayData.status === "specific" ? "bg-[#007AFF]/5 border-[#007AFF]" : "bg-[#1A1A1E] border-white/20")}>
                    <div 
                       className="flex items-center justify-between mb-4 cursor-pointer"
                       onClick={() => handleSaveSchedule(editingDay, { status: 'specific', startTime: dayData.startTime || '09:00', endTime: dayData.endTime || '17:00' })}
                    >
                       <span className={cn("font-medium", dayData.status === "specific" ? "text-[#007AFF]" : "text-white")}>Specific Hours</span>
                       {dayData.status === 'specific' && <Check className="w-5 h-5 text-[#007AFF]" />}
                    </div>

                    {dayData.status === 'specific' && (
                       <div className="flex gap-4 items-center">
                          <div className="relative flex-1">
                             <select 
                                value={dayData.startTime || '09:00'} 
                                onChange={(e) => setSchedule(prev => ({ ...prev, [editingDay]: { ...prev[editingDay], startTime: e.target.value } }))}
                                className="w-full bg-[#2C2C30] text-white p-3 rounded-lg border border-[#3F3F46] outline-none appearance-none"
                             >
                                {TIME_OPTIONS.map(time => (
                                   <option key={`start-${time}`} value={time}>{time}</option>
                                ))}
                             </select>
                             <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                             </div>
                          </div>
                          <span className="text-slate-400">to</span>
                          <div className="relative flex-1">
                             <select 
                                value={dayData.endTime || '17:00'} 
                                onChange={(e) => setSchedule(prev => ({ ...prev, [editingDay]: { ...prev[editingDay], endTime: e.target.value } }))}
                                className="w-full bg-[#2C2C30] text-white p-3 rounded-lg border border-[#3F3F46] outline-none appearance-none"
                             >
                                {TIME_OPTIONS.map(time => (
                                   <option key={`end-${time}`} value={time}>{time}</option>
                                ))}
                             </select>
                             <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                             </div>
                          </div>
                       </div>
                    )}
                 </div>
              </div>

              {dayData.status === 'specific' && (
                 <button 
                    onClick={() => handleSaveSchedule(editingDay, dayData)}
                    className="w-full bg-[#007AFF] text-white font-bold py-4 rounded-2xl"
                 >
                    Save Hours
                 </button>
              )}
           </div>
        </div>
     );
  }

  return (
    <div className="absolute inset-0 z-50 bg-[#0E0E11] flex flex-col pointer-events-auto overflow-hidden animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/20 flex items-center justify-between bg-[#1A1A1E] shadow-sm sticky top-0 z-10 shrink-0">
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-[#252529] active:bg-[#2C2C30] border border-white/20 rounded-full transition-colors">
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <h2 className="text-lg font-bold text-white">Availability Hours</h2>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        <div className="p-5 space-y-6">

          {/* Time Tracking Widget */}
          <div className="bg-[#1A1A1E] border border-white/20 rounded-2xl p-6 shadow-sm relative overflow-hidden">
             
             <div className="flex justify-between items-start mb-6 relative z-10">
                <div>
                  <h3 className="text-white font-bold text-lg mb-1">Today's Online Time</h3>
                  <p className="text-slate-400 text-sm">Resets at midnight</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-[#007AFF]/20 flex items-center justify-center border border-[#007AFF]/30">
                  <Clock className="w-6 h-6 text-[#007AFF]" />
                </div>
             </div>

             <div className="space-y-2 relative z-10">
                <div className="flex justify-between text-sm font-medium mb-1">
                   <span className="text-white">{onlineHours.toFixed(1)}h driven</span>
                   <span className="text-[#00D26A]">{remainingHours.toFixed(1)}h remaining</span>
                </div>
                <div className="h-3 w-full bg-[#2C2C30] rounded-full overflow-hidden">
                   <div 
                     className="h-full bg-gradient-to-r from-[#00D26A] to-[#007AFF] rounded-full" 
                     style={{ width: `${percentage}%` }}
                   />
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-2">
                   <span>0h</span>
                   <span>Daily Limit: {maxDailyHours}h</span>
                </div>
             </div>

          </div>

          <div className="bg-[#FF9500]/10 border border-[#FF9500]/30 rounded-xl p-4 flex gap-3 text-sm text-[#FF9500]">
             <Info className="w-5 h-5 shrink-0" />
             <p>Platform rules restrict driving to a maximum of <strong>{maxDailyHours} hours</strong> within a 24-hour period for your safety and the safety of your passengers.</p>
          </div>

          {/* Schedular */}
          <div>
             <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4 mt-6">My Weekly Schedule</h3>
             <div className="bg-[#1A1A1E] border border-white/20 rounded-xl divide-y divide-white/20">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                   <button 
                      key={day} 
                      onClick={() => setEditingDay(day)}
                      className="w-full p-4 flex items-center justify-between active:bg-[#2C2C30] transition-colors text-left"
                   >
                      <span className="text-white font-medium">{day}</span>
                      <div className="flex items-center gap-2">
                         <span className={cn("text-sm", schedule[day]?.status === "unavailable" ? "text-slate-500" : "text-[#007AFF]")}>
                            {formatScheduleText(schedule[day] || {status: 'anytime'})}
                         </span>
                         <ChevronRight className="w-4 h-4 text-slate-500" />
                      </div>
                   </button>
                ))}
             </div>
             <p className="text-xs text-slate-500 mt-3 text-center">Settings inform dispatch algorithms of your preferences.</p>
          </div>

        </div>
      </div>
    </div>
  );
}

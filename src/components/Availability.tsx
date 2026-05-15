import React, { useState, useEffect } from "react";
import { db, doc, getDoc, updateDoc, setDoc, handleFirestoreError, OperationType, collection, query, where, orderBy, onSnapshot } from "@/src/firebase";
import { useAuth } from "./AuthProvider";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2, Save, Check, AlertCircle, Settings, CheckCircle2, Clock, CalendarDays, HelpCircle, X, Zap, CalendarClock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/src/lib/utils";
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, 
  isSameMonth, isSameDay, isToday, startOfWeek, endOfWeek, parseISO, isBefore, startOfDay
} from 'date-fns';

const timeOptions: string[] = [];
for (let i = 0; i < 24; i++) {
  const hour = i.toString().padStart(2, '0');
  timeOptions.push(`${hour}:00`);
  timeOptions.push(`${hour}:30`);
}

export default function Availability() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [activeTab, setActiveTab] = useState<'calendar' | 'standard' | 'appointments'>('calendar');
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isAcceptingRequests, setIsAcceptingRequests] = useState(true);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [dateOverrides, setDateOverrides] = useState<Record<string, 'available' | 'busy' | 'booked'>>({});

  const [availability, setAvailability] = useState({
    monday: { active: true, start: "08:00", end: "17:00" },
    tuesday: { active: true, start: "08:00", end: "17:00" },
    wednesday: { active: true, start: "08:00", end: "17:00" },
    thursday: { active: true, start: "08:00", end: "17:00" },
    friday: { active: true, start: "08:00", end: "17:00" },
    saturday: { active: false, start: "09:00", end: "13:00" },
    sunday: { active: false, start: "09:00", end: "13:00" },
  });

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const weekDays = [
    { key: "monday", label: "Monday" },
    { key: "tuesday", label: "Tuesday" },
    { key: "wednesday", label: "Wednesday" },
    { key: "thursday", label: "Thursday" },
    { key: "friday", label: "Friday" },
    { key: "saturday", label: "Saturday" },
    { key: "sunday", label: "Sunday" },
  ];

  useEffect(() => {
    const fetchAvailability = async () => {
      if (!user) return;
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.availability) setAvailability(data.availability);
          if (data.dateOverrides) setDateOverrides(data.dateOverrides);
          setIsAcceptingRequests(data.isAcceptingRequests !== false);
        }
      } catch (err) {
        console.error("Error fetching availability:", err);
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      } finally {
        setLoading(false);
      }
    };

    fetchAvailability();

    if (user) {
      const q = query(
        collection(db, "appointments"),
        where("traderId", "==", user.uid),
        orderBy("date", "desc")
      );
      const unsub = onSnapshot(q, (snapshot) => {
        setAppointments(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
      }, err => {
        console.error("Error fetching appointments:", err);
      });
      return () => unsub();
    }
  }, [user]);

  const handleAppointmentAction = async (appointmentId: string, action: 'confirmed' | 'declined') => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "appointments", appointmentId), {
        status: action
      });
      alert(`Appointment ${action} successfully!`);
    } catch(err) {
      handleFirestoreError(err, OperationType.UPDATE, `appointments/${appointmentId}`);
      alert("Action failed.");
    }
  };

  const handleSaveStandard = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    
    try {
      await setDoc(doc(db, "users", user.uid), {
        availability,
        isAcceptingRequests
      }, { merge: true });
      setSuccess(true);
      setHasUnsavedChanges(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error("Error saving availability:", err);
      setError(err.message || "Failed to save availability");
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSetOverride = async (status: 'available' | 'busy' | 'booked') => {
    if (!user || selectedDates.length === 0) return;
    
    const newOverrides = { ...dateOverrides };
    
    selectedDates.forEach(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      if (status === 'available') {
        delete newOverrides[dateStr];
      } else {
        newOverrides[dateStr] = status;
      }
    });
    
    setDateOverrides(newOverrides);
    setSelectedDates([]); // Clear selection after applying
    
    try {
      await setDoc(doc(db, "users", user.uid), {
        dateOverrides: newOverrides
      }, { merge: true });
    } catch (err) {
      console.error("Error saving date override:", err);
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const toggleDateSelection = (day: Date) => {
    setSelectedDates(prev => {
      const isSelected = prev.some(d => isSameDay(d, day));
      if (isSelected) {
        return prev.filter(d => !isSameDay(d, day));
      } else {
        return [...prev, day];
      }
    });
  };

  const toggleDay = (dayKey: string) => {
    setHasUnsavedChanges(true);
    setAvailability(prev => ({
      ...prev,
      [dayKey]: { ...prev[dayKey as keyof typeof prev], active: !prev[dayKey as keyof typeof prev].active }
    }));
  };

  const toggleAcceptingRequests = async () => {
    const newValue = !isAcceptingRequests;
    setIsAcceptingRequests(newValue);
    
    if (!user) return;
    
    try {
      await setDoc(doc(db, "users", user.uid), {
        isAcceptingRequests: newValue
      }, { merge: true });
    } catch (err) {
      console.error("Error saving availability toggle:", err);
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const updateTime = (dayKey: string, field: "start" | "end", value: string) => {
    setHasUnsavedChanges(true);
    setAvailability(prev => ({
      ...prev,
      [dayKey]: { ...prev[dayKey as keyof typeof prev], [field]: value }
    }));
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const currentMonthStr = format(currentMonth, 'yyyy-MM');
  let busyCount = 0;
  let bookedCount = 0;

  Object.entries(dateOverrides).forEach(([dateStr, status]) => {
    if (dateStr.startsWith(currentMonthStr)) {
      if (status === 'busy') busyCount++;
      if (status === 'booked') bookedCount++;
    }
  });

  const daysInMonth = monthEnd.getDate();
  const availableCount = daysInMonth - busyCount - bookedCount;

  return (
    <div className="max-w-2xl mx-auto pb-24">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2.5 bg-white border border-black rounded-xl shadow-sm hover:bg-slate-50 hover:shadow-md transition-all group">
          <ChevronLeft className="w-6 h-6 text-slate-800 group-hover:-translate-x-0.5 transition-transform" />
        </button>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          My Availability
        </h1>
        <button 
          onClick={() => setShowHowItWorks(true)}
          className="ml-auto text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          How it works
        </button>
      </div>

      {/* Global Toggle */}
      <div className="bg-white rounded-3xl border border-black shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900">Accepting New Work</h3>
            <p className="text-xs text-slate-500">Toggle off to pause all quote requests and messages.</p>
          </div>
          <button
            onClick={toggleAcceptingRequests}
            className={cn(
              "w-14 h-7 rounded-full transition-colors relative",
              isAcceptingRequests ? "bg-green-600" : "bg-slate-200"
            )}
          >
            <span className={cn(
              "absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform",
              isAcceptingRequests ? "translate-x-7" : "translate-x-0"
            )} />
          </button>
        </div>
        {!isAcceptingRequests && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-relaxed">
              <strong>Requests Paused:</strong> You won't receive new quote requests or messages from homeowners while this is off. Existing conversations will remain active.
            </p>
          </div>
        )}
      </div>

      {/* Pro Tip Section */}
      <div className="bg-blue-50 border border-blue-100 rounded-3xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <h3 className="font-bold text-blue-900">Pro Tip: Don't Miss Future Work</h3>
        </div>
        <div className="space-y-3">
          <p className="text-sm text-blue-800 leading-relaxed">
            Even when you're busy on a job, we recommend keeping <strong>"Accepting New Work"</strong> toggled <strong>ON</strong>. 
          </p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2 text-xs text-blue-700">
              <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Homeowners can still message you to book dates in the future.</span>
            </li>
            <li className="flex items-start gap-2 text-xs text-blue-700">
              <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Your "Busy Today" badge will let them know you're currently working.</span>
            </li>
            <li className="flex items-start gap-2 text-xs text-blue-700">
              <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Only toggle OFF if you are on holiday or fully booked for several weeks.</span>
            </li>
          </ul>
          
          <div className="mt-4 pt-4 border-t border-blue-100">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">What homeowners see when you're busy:</p>
            <div className="flex flex-col items-start gap-1">
              <div className="bg-orange-100 text-orange-600 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-orange-200 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                Busy Today
              </div>
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-white rounded border border-blue-100">
                <HelpCircle className="w-2.5 h-2.5 text-blue-600" />
                <p className="text-[8px] text-blue-700 font-bold uppercase tracking-tighter">Available for Messages & Quotes</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-200/50 p-1 rounded-2xl mb-6">
        <button
          onClick={() => setActiveTab('calendar')}
          className={cn(
            "flex-1 py-2.5 text-sm font-bold rounded-xl transition-all",
            activeTab === 'calendar' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Calendar
        </button>
        <button
          onClick={() => setActiveTab('standard')}
          className={cn(
            "flex-1 py-2.5 text-sm font-bold rounded-xl transition-all",
            activeTab === 'standard' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Standard Hours
        </button>
        <button
          onClick={() => setActiveTab('appointments')}
          className={cn(
            "flex-1 py-2.5 text-sm font-bold rounded-xl transition-all",
            activeTab === 'appointments' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Appointments
          {appointments?.filter(a => a.status === 'pending').length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center bg-red-500 text-white text-[10px] w-4 h-4 rounded-full">
              {appointments.filter(a => a.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'calendar' ? (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-black shadow-sm p-6">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-6">
              <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <h2 className="text-xl font-bold text-slate-900">
                {format(currentMonth, 'MMMM yyyy')}
              </h2>
              <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="text-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mx-auto mb-1" />
                <p className="text-xl font-bold text-slate-900">{availableCount}</p>
                <p className="text-xs text-slate-500 font-medium">Available</p>
              </div>
              <div className="text-center">
                <div className="w-2 h-2 bg-orange-500 rounded-full mx-auto mb-1" />
                <p className="text-xl font-bold text-slate-900">{busyCount}</p>
                <p className="text-xs text-slate-500 font-medium">Busy</p>
              </div>
              <div className="text-center">
                <div className="w-2 h-2 bg-slate-800 rounded-full mx-auto mb-1" />
                <p className="text-xl font-bold text-slate-900">{bookedCount}</p>
                <p className="text-xs text-slate-500 font-medium">Booked</p>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => (
                <div key={day} className="text-center text-xs font-bold text-slate-400 py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, i) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const status = dateOverrides[dateStr];
                const isSelected = selectedDates.some(d => isSameDay(d, day));
                const isPast = isBefore(day, startOfDay(new Date()));
                const isCurrentMonth = isSameMonth(day, currentMonth);

                return (
                  <button
                    key={day.toString()}
                    onClick={() => !isPast && toggleDateSelection(day)}
                    disabled={isPast}
                    className={cn(
                      "aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-bold transition-all relative",
                      !isCurrentMonth && "text-slate-300",
                      isCurrentMonth && !isPast && "text-slate-700 hover:bg-slate-50",
                      isPast && "text-slate-300 cursor-not-allowed",
                      isSelected && "ring-2 ring-blue-600 ring-offset-2",
                      status === 'available' && "bg-green-50 text-green-700",
                      status === 'busy' && "bg-orange-50 text-orange-700",
                      status === 'booked' && "bg-slate-800 text-white hover:bg-slate-700"
                    )}
                  >
                    {format(day, 'd')}
                    {status && (
                      <div className={cn(
                        "absolute bottom-1.5 w-1 h-1 rounded-full",
                        status === 'available' && "bg-green-500",
                        status === 'busy' && "bg-orange-500",
                        status === 'booked' && "bg-white"
                      )} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selection Hint */}
          {selectedDates.length === 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-2">
              <HelpCircle className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-bold text-blue-700">Select any date to start</p>
            </div>
          )}

          {/* Selected Date Actions */}
          {selectedDates.length > 0 && (
            <div className="bg-white rounded-3xl border border-black shadow-sm p-6 animate-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">
                  {selectedDates.length} {selectedDates.length === 1 ? 'day' : 'days'} selected
                </h3>
                <button onClick={() => setSelectedDates([])} className="text-sm font-bold text-blue-600 hover:underline">
                  Clear Selection
                </button>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleSetOverride('available')}
                  className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border bg-white border-black text-slate-600 hover:bg-slate-50 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Available
                </button>
                <button
                  onClick={() => handleSetOverride('busy')}
                  className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border bg-white border-black text-slate-600 hover:bg-slate-50 transition-all"
                >
                  <Clock className="w-4 h-4 text-orange-600" />
                  Busy
                </button>
                <button
                  onClick={() => handleSetOverride('booked')}
                  className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border bg-white border-black text-slate-600 hover:bg-slate-50 transition-all"
                >
                  <CalendarDays className="w-4 h-4 text-slate-800" />
                  Booked
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-4 text-center flex items-center justify-center gap-1">
                <Settings className="w-3 h-3" />
                Changes save automatically. Select 'Available' to clear any busy/booked status.
              </p>
            </div>
          )}
        </div>
      ) : activeTab === 'standard' ? (
        <div className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 border border-green-100 rounded-xl flex items-start gap-3">
              <Check className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <p className="text-sm text-green-700 font-medium">Standard hours saved successfully!</p>
            </div>
          )}

          <div className="bg-white rounded-3xl border border-black shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Standard Working Hours</h2>
              <p className="text-sm text-slate-500 mt-1">Set your regular working hours so homeowners know when you're available.</p>
            </div>
            
            <div className="divide-y divide-slate-100">
              {weekDays.map(({ key, label }) => {
                const dayData = availability[key as keyof typeof availability];
                return (
                  <div key={key} className="p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="w-32 flex items-center gap-3">
                      <button
                        onClick={() => toggleDay(key)}
                        className={cn(
                          "w-12 h-6 rounded-full transition-colors relative",
                          dayData.active ? "bg-blue-600" : "bg-slate-200"
                        )}
                      >
                        <span className={cn(
                          "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform",
                          dayData.active ? "translate-x-6" : "translate-x-0"
                        )} />
                      </button>
                      <span className={cn(
                        "font-bold text-sm",
                        dayData.active ? "text-slate-900" : "text-slate-400"
                      )}>
                        {label}
                      </span>
                    </div>

                    {dayData.active ? (
                      <div className="flex items-center gap-3 flex-1">
                        <div className="relative flex-1">
                          <select
                            value={dayData.start}
                            onChange={(e) => updateTime(key, "start", e.target.value)}
                            className="w-full p-3 rounded-xl border border-black focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all text-sm font-medium text-slate-700 appearance-none bg-white"
                          >
                            {timeOptions.map(time => (
                              <option key={`start-${time}`} value={time}>{time}</option>
                            ))}
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                          </div>
                        </div>
                        <span className="text-slate-400 font-medium">to</span>
                        <div className="relative flex-1">
                          <select
                            value={dayData.end}
                            onChange={(e) => updateTime(key, "end", e.target.value)}
                            className="w-full p-3 rounded-xl border border-black focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all text-sm font-medium text-slate-700 appearance-none bg-white"
                          >
                            {timeOptions.map(time => (
                              <option key={`end-${time}`} value={time}>{time}</option>
                            ))}
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 text-slate-400 text-sm font-medium italic py-3">
                        Not available
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleSaveStandard}
            disabled={saving}
            className="w-full bg-blue-600 text-white p-4 rounded-2xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Save Standard Hours
          </button>
        </div>
      ) : activeTab === 'appointments' ? (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border-2 border-blue-600 shadow-sm p-6">
             <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div>
                   <h2 className="text-xl font-bold text-slate-900">Appointment Requests</h2>
                   <p className="text-sm text-slate-500">Manage incoming bookings from your customers.</p>
                </div>
             </div>

             {appointments.length === 0 ? (
               <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border-2 border-dashed border-blue-200">
                  <CalendarDays className="w-12 h-12 text-blue-300 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-900">No appointments yet</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">When customers request an appointment from your profile, it will appear here for you to confirm or decline.</p>
               </div>
             ) : (
               <div className="space-y-4">
                  {appointments.map(apt => (
                    <div key={apt.id} className="p-5 border-2 border-blue-600 rounded-2xl bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                       <div>
                          <div className="flex items-center gap-2 mb-1">
                             <span className={cn(
                               "text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded",
                               apt.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                               apt.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                               'bg-slate-100 text-slate-600'
                             )}>{apt.status}</span>
                             <p className="text-xs text-slate-500 font-medium">{format(new Date(apt.date), 'MMM d, yyyy')} at {apt.startTime}</p>
                          </div>
                          <h4 className="font-bold text-slate-900">{apt.serviceName}</h4>
                          <p className="text-sm text-slate-500">{apt.durationMinutes} mins • £{apt.price}</p>
                          {apt.notes && (
                            <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded mt-2 border border-slate-100 italic">"{apt.notes}"</p>
                          )}
                       </div>
                       
                       {apt.status === 'pending' && (
                         <div className="flex items-center gap-2 shrink-0">
                           <button 
                             onClick={() => handleAppointmentAction(apt.id, 'declined')}
                             className="px-4 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                           >
                             Decline
                           </button>
                           <button 
                             onClick={() => handleAppointmentAction(apt.id, 'confirmed')}
                             className="px-4 py-2 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors"
                           >
                             Confirm Setup
                           </button>
                         </div>
                       )}
                    </div>
                  ))}
               </div>
             )}
          </div>
        </div>
      ) : null}

      {/* Unsaved Changes Sticky Banner */}
      {hasUnsavedChanges && activeTab === 'standard' && (
        <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-8 md:bottom-8 md:w-96 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between z-50 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-orange-400" />
            <span className="text-sm font-medium">You have unsaved changes</span>
          </div>
          <button 
            onClick={handleSaveStandard}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save
          </button>
        </div>
      )}

      {/* How it works modal */}
      {showHowItWorks && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-6 h-6 text-blue-600" />
                How it works
              </h3>
              <button 
                onClick={() => setShowHowItWorks(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <CalendarDays className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-1">Calendar View</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Tap on any specific date to override your standard hours. You can mark specific days as "Busy" if you're taking time off, or "Available" if you want to work on a day you're normally off.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-1">Standard Hours</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Set your regular working hours for each day of the week. This is your default schedule. Any changes made here will apply to all future weeks unless overridden in the calendar.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-1">Booked Jobs</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    When you accept a job, those dates will automatically be marked as "Booked" on your calendar, preventing double-booking.
                  </p>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setShowHowItWorks(false)}
              className="w-full mt-8 bg-slate-100 text-slate-700 p-4 rounded-2xl font-bold hover:bg-slate-200 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

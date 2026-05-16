import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { db, collection, query, where, onSnapshot, updateDoc, doc, handleFirestoreError, OperationType } from "@/src/firebase";
import { differenceInDays, format, addDays, subDays, isSameDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addMonths, getDaysInMonth, isWithinInterval } from "date-fns";
import { Calendar as CalendarIcon, Clock, MapPin, Search, Sparkles, BrainCircuit, ArrowRight, Zap, X, CalendarClock, CalendarDays, Check, XCircle, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/src/lib/utils";

export default function TraderCalendar() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);

  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncedCalendars, setSyncedCalendars] = useState<string[]>([]);

  const [activeTab, setActiveTab] = useState<'schedule' | 'appointments'>('schedule');
  const [appointments, setAppointments] = useState<any[]>([]);

  const [viewFilter, setViewFilter] = useState<'today' | 'week' | 'month'>('week');
  const [timeOffset, setTimeOffset] = useState(0);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      const selectedBtn = document.getElementById(`day-btn-${format(selectedDate, 'yyyy-MM-dd')}`);
      if (selectedBtn) {
        const container = scrollContainerRef.current;
        const scrollTo = selectedBtn.offsetLeft - container.offsetWidth / 2 + selectedBtn.offsetWidth / 2;
        container.scrollTo({ left: scrollTo, behavior: 'smooth' });
      }
    }
  }, [selectedDate, timeOffset, viewFilter]);

  useEffect(() => {
    if (!user) return;
    
    // Fetch user appointments
    const aptQuery = query(
      collection(db, "appointments"),
      where("traderId", "==", user.uid)
    );
    const unsubApt = onSnapshot(aptQuery, (snapshot) => {
      setAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => {
        // Sort pending first, then by date desc
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }));
    });

    // In the future this should query `accepted_jobs` or `calendar_events`
    // For now, let's just create a basic fetching structure
    const q = query(
      collection(db, "bidding_jobs"),
      where("status", "==", "accepted"),
      where("assignedTo", "==", user.uid) // mock condition for now, we usually have quote accepted
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEvents(data);
    });

    return () => {
      unsubApt();
      unsubscribe();
    };
  }, [user]);

  // Generate days based on filter
  let displayTitle = "";
  let viewRangeStart: Date;
  let viewRangeEnd: Date;
  let days: Date[] = [];

  if (viewFilter === 'today') {
    const base = addDays(new Date(), timeOffset);
    days = [base];
    viewRangeStart = base;
    viewRangeEnd = base;
    displayTitle = format(base, "MMMM yyyy");
  } else if (viewFilter === 'month') {
    const baseDate = addMonths(new Date(), timeOffset);
    const mStart = startOfMonth(baseDate);
    const daysInM = getDaysInMonth(mStart);
    days = Array.from({ length: daysInM }).map((_, i) => addDays(mStart, i));
    viewRangeStart = mStart;
    viewRangeEnd = endOfMonth(mStart);
    displayTitle = format(mStart, "MMMM yyyy");
  } else {
    // defaults to week
    const baseDate = addDays(new Date(), timeOffset * 7);
    const currentWeekStart = startOfWeek(baseDate, { weekStartsOn: 1 }); // Monday
    days = Array.from({ length: 7 }).map((_, i) => addDays(currentWeekStart, i));
    viewRangeStart = currentWeekStart;
    viewRangeEnd = addDays(currentWeekStart, 6);
    displayTitle = format(currentWeekStart, "MMMM yyyy");
  }

  // Filter appointments for the current view
  const displayAppointments = appointments.filter(apt => {
    const aptDate = new Date(apt.date);
    return aptDate >= viewRangeStart && aptDate <= viewRangeEnd;
  });

  const handleOptimizeSchedule = () => {
    setAiAssistantOpen(true);
    setAnalyzing(true);
    setTimeout(() => {
      setAnalyzing(false);
    }, 2000);
  };

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

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-4 sm:py-8 flex flex-col md:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <CalendarIcon className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">Smart Schedule</h1>
            <p className="text-slate-500">Manage your jobs, appointments, and availability</p>
          </div>
          <button 
            onClick={handleOptimizeSchedule}
            className="hidden md:flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:shadow-lg hover:shadow-indigo-500/30 transition-all active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            Optimize Planner
          </button>
        </div>

        {/* Unified Tabs */}
        <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl mb-6">
          <button
            onClick={() => setActiveTab('schedule')}
            className={cn(
              "flex-1 py-2.5 text-sm font-bold rounded-xl transition-all",
              activeTab === "schedule" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Agenda
          </button>
          <button
            onClick={() => setActiveTab('appointments')}
            className={cn(
              "flex-1 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center",
              activeTab === "appointments" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
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

        {activeTab === 'schedule' ? (
          <div className="bg-white rounded-3xl border border-black overflow-hidden shadow-sm">
        <div className="p-4 border-b border-black">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
             <h3 className="font-bold text-lg text-slate-800 capitalize flex-shrink-0">{displayTitle}</h3>
             <div className="flex items-center gap-2 flex-wrap">
                <button 
                  onClick={() => setTimeOffset(w => w - 1)}
                  className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                
                <div className="relative">
                  <button 
                    onClick={() => setShowViewMenu(!showViewMenu)}
                    className="flex items-center gap-1 px-4 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-full hover:bg-slate-200 transition-colors capitalize"
                  >
                    {viewFilter === 'today' ? 'Today' : viewFilter === 'week' ? 'This Week' : 'This Month'}
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </button>
                  
                  {showViewMenu && (
                    <div className="absolute top-full right-0 mt-1 w-36 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-20">
                       <button onClick={() => { setViewFilter('today'); setShowViewMenu(false); setTimeOffset(0); setSelectedDate(new Date()); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 transition-colors">Today</button>
                       <button onClick={() => { setViewFilter('week'); setShowViewMenu(false); setTimeOffset(0); setSelectedDate(new Date()); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 transition-colors">This Week</button>
                       <button onClick={() => { setViewFilter('month'); setShowViewMenu(false); setTimeOffset(0); setSelectedDate(new Date()); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 transition-colors">This Month</button>
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => setTimeOffset(w => w + 1)}
                  className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
             </div>
          </div>
          <div ref={scrollContainerRef} className="flex gap-2 w-full justify-start sm:justify-between overflow-x-auto pb-2 scrollbar-hide scroll-smooth px-1">
            {days.map((date, idx) => {
              const isSelected = isSameDay(date, selectedDate);
              return (
                <button
                  key={idx}
                  id={`day-btn-${format(date, 'yyyy-MM-dd')}`}
                  onClick={() => setSelectedDate(date)}
                  className={`flex flex-col items-center justify-center w-16 h-20 rounded-2xl transition-all flex-shrink-0 ${
                    isSelected ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="text-xs font-semibold uppercase">{format(date, 'EEE')}</span>
                  <span className="text-xl font-bold">{format(date, 'd')}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-slate-800">
               {viewFilter === 'today' ? format(viewRangeStart, "EEEE, MMMM do") :
                viewFilter === 'week' ? `Week of ${format(viewRangeStart, "MMM do")}` : 
                format(viewRangeStart, "MMMM yyyy")}
            </h3>
            <button 
              onClick={() => setSyncModalOpen(true)}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap"
            >
              Sync External Calendar
            </button>
          </div>
          
          <div className="space-y-4">
            {events.filter(e => e.date ? isSameDay(new Date(e.date), selectedDate) : isSameDay(new Date(), selectedDate)).length === 0 && appointments.filter(a => a.status === 'confirmed' && isSameDay(new Date(a.date), selectedDate)).length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                 <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                   <Clock className="w-8 h-8 text-slate-400" />
                 </div>
                 <p className="text-slate-600 font-medium">No jobs scheduled for {viewFilter === 'today' ? 'this day' : 'this period'}.</p>
                 <p className="text-slate-400 text-sm mt-1">Accept quotes or use the AI Scheduling Assistant to fill empty slots.</p>
                 <button 
                  onClick={handleOptimizeSchedule}
                  className="mt-6 flex items-center gap-2 bg-indigo-50 text-indigo-700 px-5 py-2.5 rounded-full font-bold hover:bg-indigo-100 transition-colors"
                 >
                   <BrainCircuit className="w-5 h-5" />
                   Find Matching Jobs
                 </button>
              </div>
            ) : (
              <div className="space-y-4">
                {appointments
                  .filter(a => a.status === 'confirmed' && isSameDay(new Date(a.date), selectedDate))
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map(apt => (
                  <div key={apt.id} className="p-4 rounded-2xl border border-blue-600 shadow-[4px_4px_0_0_rgba(37,99,235,1)] flex gap-4 bg-white relative">
                     <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-bl-xl rounded-tr-xl flex items-center gap-1">
                        <Check className="w-3 h-3" /> Confirmed
                     </div>
                     <div className="w-16 h-16 bg-blue-50 border border-blue-100 rounded-xl flex-shrink-0 flex items-center justify-center text-blue-600">
                        <CalendarClock className="w-8 h-8" />
                     </div>
                     <div>
                        <h4 className="font-bold text-slate-800">{apt.serviceName}</h4>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-slate-500 mt-2">
                           <span className="flex items-center gap-1 font-semibold text-slate-700"><Clock className="w-4 h-4" /> {apt.startTime} ({apt.durationMinutes}m)</span>
                           <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> Customer Location</span>
                        </div>
                        {apt.notes && (
                           <p className="text-sm mt-2 italic text-slate-600">"{apt.notes}"</p>
                        )}
                     </div>
                  </div>
                ))}
                {events.filter(e => e.date ? isSameDay(new Date(e.date), selectedDate) : isSameDay(new Date(), selectedDate)).map((evt) => (
                  <div key={evt.id} className="p-4 rounded-2xl border border-black flex gap-4 bg-slate-50">
                    <div className="w-16 h-16 bg-blue-100 rounded-xl flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-slate-800">{evt.title || "Scheduled Task"}</h4>
                      <div className="flex items-center gap-4 text-sm text-slate-500 mt-2">
                        <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> 10:00 AM - 1:00 PM</span>
                        <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {evt.location || "Client address"}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white rounded-3xl border border-black shadow-sm p-6">
               <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                      <CalendarClock className="w-5 h-5" />
                    </div>
                    <div>
                       <h2 className="text-xl font-bold text-slate-900">Appointment Requests</h2>
                       <p className="text-sm text-slate-500">Manage incoming bookings from your customers.</p>
                    </div>
                  </div>
                  
                  <div className="relative hidden md:block">
                    <button 
                      onClick={() => setShowViewMenu(!showViewMenu)}
                      className="flex items-center gap-1 px-4 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-full hover:bg-slate-200 transition-colors capitalize"
                    >
                      {viewFilter === 'today' ? 'Today' : viewFilter === 'week' ? 'This Week' : 'This Month'}
                      <ChevronDown className="w-3 h-3 ml-1" />
                    </button>
                    
                    {showViewMenu && (
                      <div className="absolute top-full right-0 mt-1 w-36 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-20">
                         <button onClick={() => { setViewFilter('today'); setShowViewMenu(false); setTimeOffset(0); setSelectedDate(new Date()); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 transition-colors">Today</button>
                         <button onClick={() => { setViewFilter('week'); setShowViewMenu(false); setTimeOffset(0); setSelectedDate(new Date()); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 transition-colors">This Week</button>
                         <button onClick={() => { setViewFilter('month'); setShowViewMenu(false); setTimeOffset(0); setSelectedDate(new Date()); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 transition-colors">This Month</button>
                      </div>
                    )}
                  </div>
               </div>

               {/* Mobile view dropdown button (since flex-col on small screens might be crowded) */}
               <div className="mb-6 md:hidden relative">
                    <button 
                      onClick={() => setShowViewMenu(!showViewMenu)}
                      className="flex w-full items-center justify-between px-4 py-2 text-sm font-bold bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors capitalize"
                    >
                      Filter: {viewFilter === 'today' ? 'Today' : viewFilter === 'week' ? 'This Week' : 'This Month'}
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    
                    {showViewMenu && (
                      <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-20">
                         <button onClick={() => { setViewFilter('today'); setShowViewMenu(false); setTimeOffset(0); setSelectedDate(new Date()); }} className="w-full text-left px-4 py-3 text-sm font-semibold hover:bg-slate-50 transition-colors">Today</button>
                         <button onClick={() => { setViewFilter('week'); setShowViewMenu(false); setTimeOffset(0); setSelectedDate(new Date()); }} className="w-full text-left px-4 py-3 text-sm font-semibold hover:bg-slate-50 transition-colors">This Week</button>
                         <button onClick={() => { setViewFilter('month'); setShowViewMenu(false); setTimeOffset(0); setSelectedDate(new Date()); }} className="w-full text-left px-4 py-3 text-sm font-semibold hover:bg-slate-50 transition-colors">This Month</button>
                      </div>
                    )}
               </div>

               {displayAppointments.length === 0 ? (
                 <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border-2 border-dashed border-blue-200">
                    <CalendarDays className="w-12 h-12 text-blue-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-900">No appointments</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">There are no appointments {viewFilter === 'today' ? 'for today' : viewFilter === 'week' ? 'this week' : 'this month'}.</p>
                 </div>
               ) : (
                 <div className="space-y-4">
                    {displayAppointments.map(apt => (
                      <div key={apt.id} className="p-5 border border-black rounded-2xl bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                         <div>
                            <div className="flex items-center gap-2 mb-1">
                               <span className={cn(
                                 "text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded",
                                 apt.status === "pending" ? "bg-amber-100 text-amber-700" :
                                 apt.status === "confirmed" ? "bg-emerald-100 text-emerald-700" :
                                 "bg-red-100 text-red-700"
                               )}>
                                 {apt.status === "pending" ? "Awaiting Reply" : apt.status}
                               </span>
                               <span className="text-xs font-semibold text-slate-500">
                                  {format(new Date(apt.date), "EEE, MMM do yyyy")}
                               </span>
                            </div>
                            <h3 className="font-bold text-slate-900">{apt.serviceName}</h3>
                            <div className="text-sm text-slate-500 flex items-center gap-3 mt-1">
                               <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {apt.startTime} ({apt.durationMinutes}m)</span>
                               <span className="font-bold text-slate-700">£{apt.price}</span>
                            </div>
                            {apt.notes && (
                              <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">"{apt.notes}"</p>
                            )}
                         </div>
                         
                         {apt.status === 'pending' && (
                           <div className="flex sm:flex-col gap-2 w-full sm:w-auto">
                              <button
                                onClick={() => handleAppointmentAction(apt.id, 'confirmed')}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700 transition-colors text-sm"
                              >
                                <Check className="w-4 h-4" /> Confirm
                              </button>
                              <button
                                onClick={() => handleAppointmentAction(apt.id, 'declined')}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 text-red-600 px-4 py-2 rounded-xl font-bold hover:bg-red-50 transition-colors text-sm"
                              >
                                <XCircle className="w-4 h-4" /> Decline
                              </button>
                           </div>
                         )}
                      </div>
                    ))}
                 </div>
               )}
            </div>
          </div>
        )}
      </div>

      {/* AI Scheduling Assistant Sidebar */}
      {aiAssistantOpen && (
        <div className="w-full md:w-80 bg-white rounded-3xl border border-purple-100 shadow-xl shadow-purple-500/10 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-8 duration-300">
          <div className="bg-gradient-to-br from-purple-600 to-indigo-600 p-6 text-white">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md mb-4">
              <Sparkles className="w-6 h-6 text-purple-100" />
            </div>
            <h3 className="text-lg font-bold">AI Availability Engine</h3>
            <p className="text-purple-100 text-sm opacity-90 mt-1">
              Scanning local job feed for optimal route matches...
            </p>
          </div>

          <div className="p-4 flex-1 overflow-y-auto">
            {analyzing ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 border-4 border-purple-100 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-purple-600 rounded-full border-t-transparent animate-spin"></div>
                </div>
                <p className="text-slate-500 font-medium text-sm animate-pulse">Running scheduling heuristics...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Gap Detected</span>
                    <span className="text-xs font-semibold text-slate-500">2:00 PM - 5:00 PM</span>
                  </div>
                  <h4 className="font-bold text-slate-900 mb-1 leading-tight">100% Route Match</h4>
                  <p className="text-sm text-slate-600 mb-3 leading-snug">
                    A job in <span className="font-semibold text-slate-800">Bermondsey</span> fits perfectly into your afternoon travel route.
                  </p>
                  
                  <div className="bg-white border border-black rounded-xl p-3 mb-3">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-sm">Leaking Kitchen Pipe</span>
                      <span className="font-bold text-green-600 text-sm">£85</span>
                    </div>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> 2.1 miles from last job
                    </span>
                  </div>

                  <button className="w-full py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                    Claim Slot <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">High Demand</span>
                    <span className="text-xs font-semibold text-slate-500">Tomorrow AM</span>
                  </div>
                  <h4 className="font-bold text-slate-900 mb-1 leading-tight">Emergency Premium</h4>
                  <p className="text-sm text-slate-600 mb-3 leading-snug">
                    <span className="font-semibold text-slate-800">3x Emergency Jobs</span> posted in your area for tomorrow morning. Maximize earnings by starting at 8 AM.
                  </p>
                  <button className="w-full py-2 bg-white border border-orange-200 text-orange-600 rounded-xl font-bold text-sm hover:bg-orange-100 transition-colors flex items-center justify-center gap-2">
                    <Zap className="w-4 h-4" /> View Emergency Leads
                  </button>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {syncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
            <div className="p-6 border-b border-black flex items-center justify-between">
              <h2 className="text-xl font-bold">Sync Calendars</h2>
              <button onClick={() => setSyncModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-500 text-sm">
                Connect your personal calendars to automatically block out time when you're busy, avoiding conflicting job bookings.
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 rounded-2xl border border-black bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" alt="Google" className="w-6 h-6" />
                    </div>
                    <span className="font-semibold text-slate-700">Google Calendar</span>
                  </div>
                  {syncedCalendars.includes('google') ? (
                    <button 
                      onClick={() => setSyncedCalendars(c => c.filter(x => x !== 'google'))}
                      className="text-sm font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button 
                      onClick={() => setSyncedCalendars(c => [...c, 'google'])}
                      className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100"
                    >
                      Connect
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl border border-black bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" alt="Apple" className="w-5 h-5" />
                    </div>
                    <span className="font-semibold text-slate-700">Apple Calendar</span>
                  </div>
                  {syncedCalendars.includes('apple') ? (
                    <button 
                      onClick={() => setSyncedCalendars(c => c.filter(x => x !== 'apple'))}
                      className="text-sm font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button 
                      onClick={() => setSyncedCalendars(c => [...c, 'apple'])}
                      className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100"
                    >
                      Connect
                    </button>
                  )}
                </div>

                 <div className="flex items-center justify-between p-4 rounded-2xl border border-black bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/d/df/Microsoft_Office_Outlook_%282018%E2%80%93present%29.svg" alt="Outlook" className="w-6 h-6" />
                    </div>
                    <span className="font-semibold text-slate-700">Outlook</span>
                  </div>
                  {syncedCalendars.includes('outlook') ? (
                    <button 
                      onClick={() => setSyncedCalendars(c => c.filter(x => x !== 'outlook'))}
                      className="text-sm font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button 
                      onClick={() => setSyncedCalendars(c => [...c, 'outlook'])}
                      className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

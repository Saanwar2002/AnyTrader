import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { db, collection, query, where, onSnapshot } from "@/src/firebase";
import { differenceInDays, format, addDays, subDays, isSameDay } from "date-fns";
import { Calendar as CalendarIcon, Clock, MapPin, Search, Sparkles, BrainCircuit, ArrowRight, Zap, X } from "lucide-react";

export default function TraderCalendar() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);

  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncedCalendars, setSyncedCalendars] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    
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

    return () => unsubscribe();
  }, [user]);

  // Generate 7 days for the top bar
  const days = [];
  for (let i = -3; i <= 3; i++) {
    days.push(addDays(new Date(), i));
  }

  const handleOptimizeSchedule = () => {
    setAiAssistantOpen(true);
    setAnalyzing(true);
    setTimeout(() => {
      setAnalyzing(false);
    }, 2000);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 flex flex-col md:flex-row gap-6">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <CalendarIcon className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">Smart Schedule</h1>
            <p className="text-slate-500">Manage your jobs, travel time, and availability</p>
          </div>
          <button 
            onClick={handleOptimizeSchedule}
            className="hidden md:flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:shadow-lg hover:shadow-indigo-500/30 transition-all active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            Optimize Planner
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex gap-2 w-full justify-between overflow-x-auto">
            {days.map((date, idx) => {
              const isSelected = isSameDay(date, selectedDate);
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(date)}
                  className={`flex flex-col items-center justify-center w-16 h-20 rounded-2xl transition-all ${
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-slate-800">{format(selectedDate, "EEEE, MMMM do")}</h3>
            <button 
              onClick={() => setSyncModalOpen(true)}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Sync External Calendar
            </button>
          </div>
          
          <div className="space-y-4">
            {events.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                 <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                   <Clock className="w-8 h-8 text-slate-400" />
                 </div>
                 <p className="text-slate-600 font-medium">No jobs scheduled for this day.</p>
                 <p className="text-slate-400 text-sm mt-1">Accept quotes or use the AI Scheduling Assistant to fill empty slots.</p>
                 <button 
                  onClick={handleOptimizeSchedule}
                  className="mt-6 flex items-center gap-2 bg-indigo-50 text-indigo-700 px-5 py-2.5 rounded-full font-bold hover:bg-indigo-100 transition-colors"
                 >
                   <BrainCircuit className="w-5 h-5" />
                   Find Matching Jobs
                 </button>
              </div>
            ) : null}
            {/* Mock Scheduled Event View (If jobs were loaded) */}
            {events.length > 0 && (
              <div className="space-y-4">
                {events.map((evt) => (
                  <div key={evt.id} className="p-4 rounded-2xl border border-slate-100 flex gap-4 bg-slate-50">
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
                  
                  <div className="bg-white border border-slate-100 rounded-xl p-3 mb-3">
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
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
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
                <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50">
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

                <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50">
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

                 <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50">
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

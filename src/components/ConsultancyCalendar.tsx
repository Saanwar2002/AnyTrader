import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { db, collection, query, where, onSnapshot } from "@/src/firebase";
import { Calendar as CalendarIcon, Clock, Users, Video, RefreshCw, X, CalendarCheck } from "lucide-react";
import { format, addDays, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { isGoogleCalendarConnected, requestCalendarAccessToken, disconnectGoogleCalendar, syncSiteInspectionToGoogleCalendar, openGoogleCalendarUrl } from "@/src/services/googleCalendarService";

export function ConsultancyCalendar() {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncedCalendars, setSyncedCalendars] = useState<string[]>([]);
  const [syncingEventId, setSyncingEventId] = useState<string | null>(null);
  const [syncedEventIds, setSyncedEventIds] = useState<string[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (isGoogleCalendarConnected()) {
      setSyncedCalendars(prev => prev.includes('google') ? prev : [...prev, 'google']);
    }
  }, []);

  const handleConnectGoogleCalendar = async () => {
    setSyncError(null);
    try {
      await requestCalendarAccessToken();
      setSyncedCalendars(prev => prev.includes('google') ? prev : [...prev, 'google']);
    } catch (err: any) {
      setSyncError(err.message || "Failed to connect Google Calendar.");
    }
  };

  const handleDisconnectGoogleCalendar = () => {
    disconnectGoogleCalendar();
    setSyncedCalendars(prev => prev.filter(c => c !== 'google'));
  };

  const handleSyncEventToGoogle = async (evt: any) => {
    setSyncingEventId(evt.id);
    setSyncError(null);

    const res = await syncSiteInspectionToGoogleCalendar({
      projectName: evt.title || "Consultancy Meeting",
      clientName: evt.clientName || "Client",
      address: evt.location || "Office / Virtual",
      scheduledTime: evt.startTime || new Date().toISOString(),
      notes: evt.notes || "Project consultation meeting",
    });

    setSyncingEventId(null);
    if (res && res.url) {
      openGoogleCalendarUrl(res.url);
      setSyncedEventIds(prev => [...prev, evt.id]);
    } else {
      setSyncError(res?.error || "Could not sync to Google Calendar.");
    }
  };

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "calendarEvents"),
      where("consultantId", "==", user.uid)
    );
    const unsub = onSnapshot(q, snap => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  // Generate week days
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const activeDayEvents = events.filter(e => {
    if (!e.startTime) return false;
    return isSameDay(new Date(e.startTime), selectedDate);
  }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return (
    <div className="space-y-4">
      <div className="bg-white border border-black rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-black flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-indigo-500" /> {format(selectedDate, "MMMM yyyy")}
          </h3>
          <div className="flex gap-2">
            <button onClick={() => setSelectedDate(addDays(selectedDate, -7))} className="text-xs font-bold bg-slate-100 px-3 py-1 rounded-xl border border-black/10 hover:bg-slate-200">Prev Week</button>
            <button onClick={() => setSelectedDate(new Date())} className="text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-xl border border-indigo-200 hover:bg-indigo-100">Today</button>
            <button onClick={() => setSelectedDate(addDays(selectedDate, 7))} className="text-xs font-bold bg-slate-100 px-3 py-1 rounded-xl border border-black/10 hover:bg-slate-200">Next Week</button>
          </div>
        </div>
        
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((date, i) => {
            const isSelected = isSameDay(date, selectedDate);
            const dayEvents = events.filter(e => e.startTime && isSameDay(new Date(e.startTime), date));
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(date)}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                  isSelected 
                    ? "border-indigo-600 bg-indigo-600 text-white shadow-md" 
                    : "border-black/10 bg-slate-50 text-black hover:border-black"
                }`}
              >
                <span className={`text-[10px] font-black uppercase mb-1 ${isSelected ? "text-indigo-200" : "text-black/50"}`}>
                  {format(date, "EEE")}
                </span>
                <span className="text-xl font-black leading-none">{format(date, "d")}</span>
                {dayEvents.length > 0 && (
                  <div className={`mt-2 flex gap-1 ${isSelected ? "opacity-100" : "opacity-60"}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-indigo-500"}`} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-black rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-black">
            Schedule for {format(selectedDate, "EEEE, MMMM do")}
          </h4>
          <button 
            onClick={() => setSyncModalOpen(true)}
            className="text-xs font-bold bg-slate-50 border border-black/10 text-black px-3 py-1.5 rounded-xl hover:bg-slate-100 flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Calendar Sync
          </button>
        </div>
        
        {activeDayEvents.length === 0 ? (
          <div className="py-8 text-center bg-slate-50 rounded-xl border border-black/5">
            <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-black/60">No events scheduled.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeDayEvents.map(evt => (
              <div key={evt.id} className="p-4 bg-slate-50 border border-black rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 shrink-0 bg-indigo-100 rounded-xl flex flex-col items-center justify-center border border-indigo-200">
                    <span className="text-[10px] font-black text-indigo-600 uppercase">
                      {format(new Date(evt.startTime), "a")}
                    </span>
                    <span className="text-lg font-black text-indigo-900 leading-none">
                      {format(new Date(evt.startTime), "h:mm")}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h5 className="font-bold text-black text-sm mb-1">{evt.title}</h5>
                    <div className="flex items-center gap-3 text-[11px] font-medium text-black/70 mb-1">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> {evt.clientName || "Team"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Video className="w-3.5 h-3.5" /> {evt.location === "video" ? "Virtual Meeting" : evt.location}
                      </span>
                    </div>
                    {evt.projectId && (
                       <div className="inline-block px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-black uppercase rounded-md">
                         Project Associated
                       </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleSyncEventToGoogle(evt)}
                  disabled={syncingEventId === evt.id || syncedEventIds.includes(evt.id)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all shrink-0 ${
                    syncedEventIds.includes(evt.id)
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                      : "bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700"
                  }`}
                >
                  {syncingEventId === evt.id ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : syncedEventIds.includes(evt.id) ? (
                    <CalendarCheck className="w-3.5 h-3.5" />
                  ) : (
                    <CalendarIcon className="w-3.5 h-3.5" />
                  )}
                  <span>{syncedEventIds.includes(evt.id) ? "In Calendar" : "Sync Google"}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {syncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col border border-black">
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
              
              {syncError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                  {syncError}
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 rounded-xl border border-black bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl border border-black/10 flex items-center justify-center">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" alt="Google" className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="font-semibold text-black block">Google Calendar</span>
                      <span className="text-[10px] text-slate-500 block">Sync site visits & client sessions</span>
                    </div>
                  </div>
                  {syncedCalendars.includes('google') ? (
                    <button 
                      onClick={handleDisconnectGoogleCalendar}
                      className="text-[10px] uppercase font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg hover:bg-rose-100"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button 
                      onClick={handleConnectGoogleCalendar}
                      className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-100"
                    >
                      Connect
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl border border-black bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl border border-black/10 flex items-center justify-center">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" alt="Apple" className="w-5 h-5 opacity-80" />
                    </div>
                    <span className="font-semibold text-black">Apple Calendar</span>
                  </div>
                  {syncedCalendars.includes('apple') ? (
                    <button 
                      onClick={() => setSyncedCalendars(c => c.filter(x => x !== 'apple'))}
                      className="text-[10px] uppercase font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg hover:bg-rose-100"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button 
                      onClick={() => setSyncedCalendars(c => [...c, 'apple'])}
                      className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-100"
                    >
                      Connect
                    </button>
                  )}
                </div>

                 <div className="flex items-center justify-between p-4 rounded-xl border border-black bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl border border-black/10 flex items-center justify-center">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/d/df/Microsoft_Office_Outlook_%282018%E2%80%93present%29.svg" alt="Outlook" className="w-6 h-6" />
                    </div>
                    <span className="font-semibold text-black">Outlook</span>
                  </div>
                  {syncedCalendars.includes('outlook') ? (
                    <button 
                      onClick={() => setSyncedCalendars(c => c.filter(x => x !== 'outlook'))}
                      className="text-[10px] uppercase font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg hover:bg-rose-100"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button 
                      onClick={() => setSyncedCalendars(c => [...c, 'outlook'])}
                      className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-100"
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

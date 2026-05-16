import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/src/firebase';
import { format, isAfter, isBefore, addDays, parseISO, startOfDay } from 'date-fns';
import { CalendarIcon, ChevronDown, ChevronUp, MapPin, Clock } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthProvider';

export function TraderUpcomingAppointments() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const aptQuery = query(
      collection(db, "appointments"),
      where("traderId", "==", user.uid)
    );
    
    const unsub = onSnapshot(aptQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter out non-confirmed and past
      const today = startOfDay(new Date());
      const confirmedFuture = data.filter(apt => {
        if (apt.status !== 'confirmed') return false;
        
        // Check if date is in future or today
        let aptDate: Date;
        if (apt.date) {
            aptDate = new Date(apt.date);
        } else {
            return false;
        }

        return !isBefore(startOfDay(aptDate), today);
      });

      // Sort by date, then by time
      confirmedFuture.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA === dateB) {
            return (a.startTime || "00:00").localeCompare(b.startTime || "00:00");
        }
        return dateA - dateB;
      });

      setAppointments(confirmedFuture);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  if (loading) return null;

  const displayCount = 10; // Keep initial view compact
  const hasMore = appointments.length > displayCount;
  
  const displayedAppointments = isExpanded ? appointments : appointments.slice(0, displayCount);

  return (
    <div className="mt-8 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <CalendarIcon className="w-5 h-5 text-indigo-500" />
        <h2 className="text-xl font-bold text-slate-900">My Appointments</h2>
      </div>

      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-1 md:p-1.5 rounded-[24px] border border-indigo-100 shadow-sm">
        <div className="bg-white rounded-[20px] p-4 flex flex-col gap-3">
          {appointments.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-slate-500 text-sm font-medium">You have no upcoming appointments.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 flex flex-col gap-3">
              {displayedAppointments.map((apt, index) => {
            const aptDate = new Date(apt.date);
            const isToday = format(aptDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
            const isTomorrow = format(aptDate, 'yyyy-MM-dd') === format(addDays(new Date(), 1), 'yyyy-MM-dd');
            
            let dateStr = format(aptDate, 'MMM d, yyyy');
            if (isToday) dateStr = 'Today';
            else if (isTomorrow) dateStr = 'Tomorrow';

            return (
              <div key={apt.id} className={cn("relative rounded-xl border border-black p-3.5 bg-white overflow-hidden group hover:shadow-md transition-shadow", "shadow-[2px_2px_0_0_#9333ea]")}>
                {/* Gradient edge */}
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-indigo-400 to-purple-500" />
                
                <div className="flex justify-between items-start pl-2 gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 truncate">{apt.customerName || apt.title || "Appointment"}</h3>
                    {apt.description && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{apt.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs font-semibold text-slate-600">
                      <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 shadow-sm">
                        <CalendarIcon className="w-3 h-3 text-indigo-500" />
                        <span>{dateStr}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 shadow-sm">
                        <Clock className="w-3 h-3 text-emerald-500" />
                        <span>{apt.startTime || "TBD"} {apt.endTime ? `- ${apt.endTime}` : ''}</span>
                      </div>
                      {apt.location && (
                        <div className="flex items-center gap-1 max-w-full">
                          <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                          <span className="truncate">{apt.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <Link to="/calendar" className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full whitespace-nowrap uppercase tracking-wider border border-indigo-100 hover:bg-indigo-100 transition-colors shrink-0">
                    View
                  </Link>
                </div>
              </div>
            );
          })}
          
          {hasMore && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center justify-center gap-2 pt-3 text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors w-full pb-1"
            >
              {isExpanded ? (
                <>
                  Show Less <ChevronUp className="w-4 h-4" />
                </>
              ) : (
                <>
                  Show {appointments.length - displayCount} More <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>
          )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

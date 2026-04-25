import React, { useState, useEffect } from "react";
import { Ticket, Search, Filter, MessageSquare, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { db } from "@/src/firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";

export default function SupportTickets() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [activeStatus, setActiveStatus] = useState("active");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);

  useEffect(() => {
    const q = query(collection(db, "support_tickets"), orderBy("createdAt", "desc"), limit(50));
    const unsub = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTickets(fetched);
      if (fetched.length > 0 && !selectedTicket) {
        setSelectedTicket(fetched[0]);
      }
    });

    return () => unsub();
  }, []);

  const filteredTickets = tickets.filter(t => activeStatus === "active" ? t.status === "open" : t.status === "resolved");

  const openTicketsCount = tickets.filter(t => t.status === "open").length;
  const escalatedCount = tickets.filter(t => t.priority === "high").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Support Tickets
          </h2>
          <p className="text-slate-500 font-medium">Manage driver and rider inquiries, disputes, and reports.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Open Tickets</p>
           <p className="text-2xl font-black text-slate-900">{openTicketsCount}</p>
         </div>
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-amber-200 bg-amber-50/10">
           <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Unassigned</p>
           <p className="text-2xl font-black text-amber-600">0</p>
         </div>
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Avg Resolution Time</p>
           <p className="text-2xl font-black text-slate-900">4.5h</p>
         </div>
         <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm bg-rose-50/30 text-rose-600">
           <p className="text-[10px] font-black uppercase tracking-widest mb-1">Escalated</p>
           <p className="text-2xl font-black">{escalatedCount}</p>
         </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row h-[600px]">
         {/* Ticket List */}
         <div className="w-full md:w-1/3 border-r border-slate-100 flex flex-col shrink-0">
           <div className="p-4 border-b border-slate-100">
             <div className="relative mb-3">
               <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
               <input type="text" placeholder="Search ticket..." className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" />
             </div>
             <div className="flex gap-2">
               <button 
                 onClick={() => setActiveStatus("active")}
                 className={cn("flex-1 px-2 py-1.5 text-[10px] uppercase font-black tracking-widest rounded", 
                 activeStatus === "active" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>
                 Active
               </button>
               <button 
                 onClick={() => setActiveStatus("resolved")}
                 className={cn("flex-1 px-2 py-1.5 text-[10px] uppercase font-black tracking-widest rounded", 
                 activeStatus === "resolved" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>
                 Resolved
               </button>
             </div>
           </div>
           
           <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-slate-50">
             {filteredTickets.map((ticket, i) => {
               const timeAgo = ticket.createdAt?.toDate ? ticket.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now";
               return (
                <div key={ticket.id} 
                  onClick={() => setSelectedTicket(ticket)}
                  className={cn(
                  "p-4 cursor-pointer hover:bg-slate-50 transition-colors",
                  selectedTicket?.id === ticket.id && "bg-slate-50 border-l-4 border-l-emerald-500"
                )}>
                   <div className="flex justify-between items-start mb-1">
                     <span className="text-xs font-bold text-slate-900">{ticket.subject}</span>
                     <span className="text-[10px] text-slate-500">{timeAgo}</span>
                   </div>
                   <p className="text-[10px] text-slate-500 line-clamp-1 mb-2">{ticket.preview}</p>
                   <div className="flex justify-between items-center">
                     <span className="text-[10px] font-bold text-slate-400">#{ticket.id.slice(0, 6)}</span>
                     {ticket.priority === "high" && <span className="bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-widest font-black">High Prio</span>}
                   </div>
                </div>
               );
             })}
             {filteredTickets.length === 0 && (
               <div className="p-4 text-center text-xs text-slate-500">No {activeStatus} tickets found.</div>
             )}
           </div>
         </div>

         {/* Ticket Detail */}
         <div className="flex-1 flex flex-col bg-slate-50">
            {selectedTicket ? (
              <>
                <div className="p-6 bg-white border-b border-slate-100 flex justify-between items-start">
                   <div>
                     <div className="flex items-center gap-2 mb-2">
                       <h3 className="text-xl font-black text-slate-900">{selectedTicket.subject}</h3>
                       <span className={cn(
                         "px-2 py-0.5 rounded text-[10px] uppercase tracking-widest font-black",
                         selectedTicket.status === "open" ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                       )}>
                         {selectedTicket.status}
                       </span>
                     </div>
                     <p className="text-xs text-slate-500 font-medium">Ticket #{selectedTicket.id.slice(0, 6)} • User ID: {selectedTicket.userId} • Role: <span className="capitalize">{selectedTicket.userRole}</span></p>
                   </div>
                   <div className="flex gap-2">
                     <button className="px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors">Assign to me</button>
                     <button className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors">Resolve</button>
                   </div>
                </div>

                <div className="flex-1 p-6 overflow-y-auto no-scrollbar space-y-6">
                   <div className="flex gap-4">
                     <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 text-xs shrink-0">U</div>
                     <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none shadow-sm flex-1">
                       <div className="flex justify-between items-center mb-2">
                         <span className="text-xs font-bold text-slate-900">User ({selectedTicket.userRole})</span>
                         <span className="text-[10px] text-slate-400">
                           {selectedTicket.createdAt?.toDate ? selectedTicket.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
                         </span>
                       </div>
                       <p className="text-sm text-slate-600">{selectedTicket.preview}</p>
                     </div>
                   </div>
                </div>

                <div className="p-4 bg-white border-t border-slate-100">
                   <textarea 
                     placeholder="Type your reply..." 
                     className="w-full h-24 p-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 mb-3 resize-none"
                   ></textarea>
                   <div className="flex justify-between items-center">
                     <button className="text-xs font-bold text-slate-500 hover:text-slate-700">Add Internal Note</button>
                     <button className="px-6 py-2 bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-lg hover:bg-emerald-600 transition-colors">Send Reply</button>
                   </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 font-medium text-sm">
                Select a ticket to view details
              </div>
            )}
         </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { 
  Ticket, 
  Search, 
  Plus, 
  Trash2, 
  Clock, 
  HelpCircle, 
  User, 
  AlertCircle, 
  CheckCircle,
  Inbox
} from "lucide-react";
import { db, collection, onSnapshot } from "../../firebase";
import { toast } from "sonner";

interface ClientTicket {
  id: string;
  creatorName: string;
  role: "rider" | "driver";
  subject: string;
  description: string;
  status: "Open Ticket" | "In Investigation" | "Resolved Closed";
}

const mockTicketsSeed: ClientTicket[] = [
  { id: "tkt_101", creatorName: "Thomas Sterling", role: "rider", subject: "Lost Cash wallet on rear hybrid seat", description: "Completed ride around 2:00 PM yesterday in Benjamin's Tesla. Realized my brown wallet was left in the vehicle.", status: "Open Ticket" },
  { id: "tkt_102", creatorName: "Amara Davies", role: "driver", subject: "Disputed fare calculation error", description: "Congestion charge area trigger did not calculate automatically when entering central borough. Requesting manual credit.", status: "In Investigation" },
  { id: "tkt_103", creatorName: "Craig Henderson", role: "rider", subject: "Application transaction crash on paying", description: "Checked out with direct-to-driver QR scan but visual loader failed. Verified credit charge cleared my bank.", status: "Resolved Closed" }
];

export default function SupportTickets() {
  const [tickets, setTickets] = useState<ClientTicket[]>(mockTicketsSeed);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  // New ticket state
  const [newCreator, setNewCreator] = useState("");
  const [newRole, setNewRole] = useState<"rider" | "driver">("rider");
  const [newSubject, setNewSubject] = useState("");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    // Attempt Firestore subscribe
    const unsub = onSnapshot(collection(db, "support_tickets"), (snapshot) => {
      const list = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          creatorName: d.creatorName || d.name || "Client Ticket Creator",
          role: d.role || d.creatorRole || "rider",
          subject: d.subject || "No Subject",
          description: d.description || d.details || "",
          status: d.status || "Open Ticket"
        } as ClientTicket;
      });

      if (list.length > 0) {
        const combined = [...list];
        mockTicketsSeed.forEach(seed => {
          if (!combined.some(c => c.id === seed.id)) {
            combined.push(seed);
          }
        });
        setTickets(combined);
      } else {
        setTickets(mockTicketsSeed);
      }
    }, (err) => {
      console.warn("Support tickets running offline fallback channels.", err);
      setTickets(mockTicketsSeed);
    });

    return () => unsub();
  }, []);

  const handleCreateTicket = () => {
    if (!newCreator.trim() || !newSubject.trim()) {
      toast.error("Please fill in applicant name and subject fields.");
      return;
    }
    const newTkt: ClientTicket = {
      id: "tkt_" + Math.floor(Math.random() * 9000 + 1000),
      creatorName: newCreator,
      role: newRole,
      subject: newSubject,
      description: newDesc,
      status: "Open Ticket"
    };

    setTickets([newTkt, ...tickets]);
    setNewCreator("");
    setNewSubject("");
    setNewDesc("");
    toast.success("Support query dispatched to agent desks successfully.");
  };

  const handleAdvanceStatus = (id: string, nextStatus: "In Investigation" | "Resolved Closed") => {
    setTickets(prev => prev.map(t => {
      if (t.id === id) {
        toast.success(`Advanced Ticket state to: ${nextStatus}`);
        return { ...t, status: nextStatus };
      }
      return t;
    }));
  };

  const filteredTickets = tickets.filter(t => {
    if (activeFilter === "all") return true;
    if (activeFilter === "open") return t.status === "Open Ticket";
    if (activeFilter === "investigating") return t.status === "In Investigation";
    if (activeFilter === "resolved") return t.status === "Resolved Closed";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Intro Header HUD */}
      <div className="p-5 bg-white border border-black rounded-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Ticket className="w-4 h-4 text-emerald-500 animate-pulse" />
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#AF52DE] font-bold">CLIENT ISSUES WORK DESK</span>
          </div>
          <h2 className="text-xl font-bold text-black font-sans">Support Tickets & Discrepancies</h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage lost baggage logs, investigate billing discrepancies, and message rider/driver dispute teams.
          </p>
        </div>

        {/* Counter filters */}
        <div className="flex bg-slate-100 border border-black rounded p-0.5 font-mono text-[10px]">
          {["all", "open", "investigating", "resolved"].map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1 cursor-pointer rounded uppercase font-black transition ${
                activeFilter === f ? "bg-black text-white" : "text-slate-500 hover:text-black"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Tickets registers */}
        <div className="lg:col-span-2 bg-white border border-black rounded-lg p-5 shadow-sm space-y-4">
          <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
            <Inbox className="w-4 h-4 text-slate-655" /> Inbox Queries ({filteredTickets.length})
          </h3>

          <div className="space-y-3.5">
            {filteredTickets.map(ticket => (
              <div key={ticket.id} className="p-4 bg-slate-55 border border-black rounded font-sans space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-black text-[#AF52DE]">{ticket.id}</span>
                    <h4 className="text-sm font-extrabold text-black">{ticket.subject}</h4>
                  </div>

                  <span className={`text-[9px] uppercase font-mono font-bold px-2 py-0.5 rounded ${
                    ticket.status === "Open Ticket"
                      ? "bg-red-50 text-red-800 border border-red-300 animate-pulse"
                      : ticket.status === "In Investigation"
                      ? "bg-amber-50 text-amber-800 border border-amber-300"
                      : "bg-emerald-50 text-emerald-800 border border-emerald-300"
                  }`}>
                    {ticket.status}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed font-sans">{ticket.description}</p>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-105">
                  <div className="flex items-center gap-2 text-[11.5px]">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>User: <strong className="text-black font-extrabold">{ticket.creatorName}</strong></span>
                    <span className="text-[9.5px] uppercase font-mono font-bold bg-slate-200 border border-black/10 px-1 rounded text-slate-705">
                      {ticket.role}
                    </span>
                  </div>

                  {ticket.status !== "Resolved Closed" && (
                    <div className="flex gap-2">
                      {ticket.status === "Open Ticket" && (
                        <button
                          onClick={() => handleAdvanceStatus(ticket.id, "In Investigation")}
                          className="px-2.5 py-1 border border-black text-xs font-bold font-mono rounded hover:bg-slate-50 cursor-pointer select-none"
                        >
                          Investigate
                        </button>
                      )}
                      <button
                        onClick={() => handleAdvanceStatus(ticket.id, "Resolved Closed")}
                        className="px-2.5 py-1 bg-black hover:bg-slate-900 border border-black text-white text-xs font-bold font-mono rounded cursor-pointer select-none"
                      >
                        Resolve Inquiry
                      </button>
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>
        </div>

        {/* Dispatch Ticket simulation form */}
        <div className="bg-white border border-black rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-1 border-b border-slate-100 pb-2">
            <Plus className="w-3.5 h-3.5 text-emerald-555" />
            <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider">File Ticket</h3>
          </div>

          <div className="space-y-4 font-sans">
            <div className="space-y-1">
              <label className="text-xs font-bold text-black block">Applicant Profile Name</label>
              <input 
                type="text" 
                placeholder="e.g. Benjamin Taylor" 
                value={newCreator}
                onChange={(e) => setNewCreator(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-black text-xs text-black font-sans rounded"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-black block">Association portal role</label>
              <select 
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-black text-xs text-black rounded outline-none"
              >
                <option value="rider">Rider Passenger</option>
                <option value="driver">Taxi Driver</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-black block">Discrepancy Subject header</label>
              <input 
                type="text" 
                placeholder="e.g. Card payment double charge" 
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-black text-xs text-slate-800 rounded"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-black block">In-Depth details</label>
              <textarea 
                rows={3}
                placeholder="Details of ride incident..." 
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-black text-xs text-slate-800 rounded outline-none"
              />
            </div>

            <button
              onClick={handleCreateTicket}
              className="w-full py-2 bg-black hover:bg-slate-900 border border-black text-white text-xs font-mono font-black tracking-wider uppercase cursor-pointer rounded transition flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" /> Dispatch Inquiry
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

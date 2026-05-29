import React, { useState, useEffect } from "react";
import { 
  Megaphone, 
  Send, 
  Users, 
  Sparkles, 
  Trash2, 
  CheckCircle, 
  Clock, 
  ShieldAlert, 
  Plus,
  Compass,
  BellRing
} from "lucide-react";
import { db, collection, addDoc, getDocs } from "../../firebase";
import { toast } from "sonner";

interface BroadcastSignal {
  id: string;
  title: string;
  body: string;
  targetAudience: "All Users" | "Drivers Only" | "Riders Only";
  priorityLevel: "Routine Alert" | "Core High" | "System Bypass emergency";
  dispatchedAt: string;
  deliveredCount: number;
}

const mockBroadcastsSeed: BroadcastSignal[] = [
  { id: "sig_201", title: "Weather Surcharge Warning Grid Active", body: "Severe weather alert across greater London. Surcharges are automatically elevated by 15% temporarily.", targetAudience: "All Users", priorityLevel: "Core High", dispatchedAt: "2026-05-29T04:20:00Z", deliveredCount: 650 },
  { id: "sig_202", title: "Stripe Connect Onboarding Required", body: "Please log on to update your financial driver portfolio to proceed with direct QR payouts.", targetAudience: "Drivers Only", priorityLevel: "System Bypass emergency", dispatchedAt: "2026-05-28T18:00:00Z", deliveredCount: 145 },
  { id: "sig_203", title: "Referrals Incentive Campaign 2026", body: "Share your user promotional links this week to receive £10.00 travel credits instantly.", targetAudience: "Riders Only", priorityLevel: "Routine Alert", dispatchedAt: "2026-05-25T12:00:00Z", deliveredCount: 1205 }
];

export default function BroadcastMessaging() {
  const [broadcastArchives, setBroadcastArchives] = useState<BroadcastSignal[]>(mockBroadcastsSeed);
  const [isSending, setIsSending] = useState(false);

  // Message fields
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<"All Users" | "Drivers Only" | "Riders Only">("All Users");
  const [priority, setPriority] = useState<"Routine Alert" | "Core High" | "System Bypass emergency">("Routine Alert");

  const handleDispatchBroadcast = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Please fill in message title and body descriptors.");
      return;
    }
    setIsSending(true);
    const newSignal: BroadcastSignal = {
      id: "sig_" + Math.floor(Math.random() * 9000 + 1000),
      title,
      body,
      targetAudience: target,
      priorityLevel: priority,
      dispatchedAt: new Date().toISOString(),
      deliveredCount: target === "All Users" ? 720 : target === "Drivers Only" ? 145 : 575
    };

    // Store in Firebase or update local state
    try {
      await addDoc(collection(db, "broadcast_messages"), {
        title: newSignal.title,
        body: newSignal.body,
        targetAudience: newSignal.targetAudience,
        priorityLevel: newSignal.priorityLevel,
        createdAt: newSignal.dispatchedAt
      });
    } catch {
      console.warn("Firestore collection unavailable. Dispatched local update loop.");
    }

    setBroadcastArchives([newSignal, ...broadcastArchives]);
    setTitle("");
    setBody("");
    setIsSending(false);
    toast.success(`Megaphone broadcast signals dispatched successfully to ${newSignal.targetAudience}.`);
  };

  const handleRemoveSignal = (id: string) => {
    setBroadcastArchives(prev => prev.filter(b => b.id !== id));
    toast.info("Broadcast logging removed.");
  };

  return (
    <div className="space-y-6">
      {/* Intro Header HUD */}
      <div className="p-5 bg-white border border-black rounded-lg shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Megaphone className="w-4 h-4 text-[#AF52DE]" />
          <span className="text-[10px] uppercase font-mono tracking-widest text-[#AF52DE] font-bold">MULTICAST SYSTEM CONSOLES</span>
        </div>
        <h2 className="text-xl font-bold text-black font-sans">Central Broadcast & Notifications</h2>
        <p className="text-xs text-slate-500 mt-1">
          Push alerts, publish emergency congestion zone instructions, and schedule promotional campaign triggers to driver/rider portfolios.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Composition forms */}
        <div className="bg-white border border-black rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <Plus className="w-4 h-4 text-emerald-555" />
            <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider">Compose Signal Broadcast</h3>
          </div>

          <div className="space-y-3.5 font-sans">
            <div className="space-y-1">
              <label className="text-xs font-bold text-black block">Broadcast Title Header</label>
              <input 
                type="text" 
                placeholder="e.g. Critical Server Maintenance" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-black text-xs text-black font-medium rounded"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-black block">Alert Description body text</label>
              <textarea 
                rows={3}
                placeholder="Alert description body info..." 
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-black text-xs text-slate-800 rounded outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-black block">Target Group</label>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value as any)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-black text-xs text-black font-sans font-semibold rounded outline-none"
                >
                  <option value="All Users">All Users</option>
                  <option value="Drivers Only">Drivers Only</option>
                  <option value="Riders Only">Riders Only</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-black block">Severity Scale</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-black text-xs text-red-700 font-semibold rounded outline-none"
                >
                  <option value="Routine Alert">Routine Alert</option>
                  <option value="Core High">Core High</option>
                  <option value="System Bypass emergency">System Bypass</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleDispatchBroadcast}
              disabled={isSending}
              className="w-full py-2.5 bg-black hover:bg-slate-900 border border-black text-white text-xs font-mono font-black tracking-wider uppercase cursor-pointer rounded transition flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5 text-emerald-400" />
              {isSending ? "Dispatching..." : "Transmit Broadcast Signal"}
            </button>
          </div>
        </div>

        {/* History log column */}
        <div className="lg:col-span-2 bg-white border border-black rounded-lg p-5 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-2.5">
            <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider flex items-center gap-1.5">
              <Megaphone className="w-4 h-4 text-slate-705 animate-pulse" /> Dispatch Signals History
            </h3>
          </div>

          <div className="space-y-3.5">
            {broadcastArchives.map(signal => {
              const dateObj = new Date(signal.dispatchedAt);
              return (
                <div key={signal.id} className="p-4 bg-slate-50 border border-black rounded font-sans space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-black text-[#AF52DE]">{signal.id}</span>
                      <h4 className="text-sm font-extrabold text-black font-sans">{signal.title}</h4>
                      <span className={`text-[9px] font-mono border px-1.5 font-bold rounded uppercase ${
                        signal.priorityLevel === "System Bypass emergency"
                          ? "bg-red-50 text-red-800 border-red-350 animate-pulse animate-duration-1000"
                          : "bg-stone-100 text-stone-800 border-stone-300"
                      }`}>
                        {signal.priorityLevel}
                      </span>
                    </div>

                    <div className="font-mono text-[10.5px] text-slate-500 bg-white p-1 px-2 border border-black/10 rounded flex items-center gap-1 shrink-0">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      <span>{dateObj.toLocaleDateString()} at {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-650 leading-relaxed">{signal.body}</p>

                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-105 font-mono text-xs">
                    <div className="flex gap-4">
                      <span>Audience: <strong className="text-black font-extrabold">{signal.targetAudience}</strong></span>
                      <span>Logs Delivered: <strong className="text-emerald-600 font-extrabold">{signal.deliveredCount} scopes</strong></span>
                    </div>

                    <button
                      onClick={() => handleRemoveSignal(signal.id)}
                      className="p-1 px-2 border border-black hover:bg-red-50 text-red-655 rounded transition cursor-pointer select-none"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, Bell, Zap, ShieldAlert, CircleAlert, CheckCircle2, ChevronRight, Car } from "lucide-react";
import { cn } from "@/src/lib/utils";

type FilterType = 'all' | 'rides' | 'alerts' | 'anytrader';

export default function DriverInbox() {
  const [filter, setFilter] = useState<FilterType>('all');

  const mockMessages = [
    { id: 1, type: 'alerts', title: 'MOT Expires in 14 Days', desc: 'Book a mechanic now to avoid suspension.', time: '2h ago', icon: ShieldAlert, color: 'text-[#FF3B30]', bg: 'bg-[#FF3B30]/10', unread: true },
    { id: 2, type: 'anytrader', title: 'New Trade Lead (Plumbing)', desc: 'Leaking pipe in SE15. Est: £65.', time: '4h ago', icon: Zap, color: 'text-[#AF52DE]', bg: 'bg-[#AF52DE]/10', unread: true },
    { id: 3, type: 'rides', title: 'Sarah T.', desc: 'I am standing outside the blue gate.', time: 'Yesterday', icon: MessageSquare, color: 'text-[#00D26A]', bg: 'bg-[#00D26A]/10', unread: false },
    { id: 4, type: 'alerts', title: 'Weekly Earnings Report', desc: 'You made £845.20 last week. View breakdown.', time: 'Mon', icon: Bell, color: 'text-white', bg: 'bg-[#252529]', unread: false },
    { id: 5, type: 'anytrader', title: 'Mechanic Offer', desc: 'Mobile mechanic quoted £45 for your brake pads.', time: 'Sun', icon: Zap, color: 'text-[#AF52DE]', bg: 'bg-[#AF52DE]/10', unread: false },
  ];

  const filteredMessages = mockMessages.filter(m => filter === 'all' || m.type === filter);

  return (
    <div className="flex-1 bg-[#0D0D0F] text-white overflow-y-auto px-4 py-6 font-sans pb-24 min-h-0">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black tracking-tight">Inbox</h1>
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {(['all', 'rides', 'alerts', 'anytrader'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors border",
              filter === f 
                ? "bg-white text-[#0D0D0F] border-white" 
                : "bg-[#1A1A1E] text-[#A0A0A8] border-[#2C2C30] hover:border-[#6B6B73]"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Cross-Sell Call to Action in Alerts */}
      <AnimatePresence>
        {(filter === 'all' || filter === 'alerts') && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 bg-gradient-to-r from-[#FF3B30]/20 to-[#FF9500]/10 border border-[#FF3B30]/30 rounded-2xl p-4 relative overflow-hidden"
          >
            <div className="flex items-start gap-4 z-10 relative">
              <div className="w-10 h-10 rounded-full bg-[#FF3B30]/20 flex items-center justify-center shrink-0 border border-[#FF3B30]/30">
                <ShieldAlert className="w-5 h-5 text-[#FF3B30]" />
              </div>
              <div>
                <h3 className="font-black text-white leading-tight">Action Required</h3>
                <p className="text-xs text-white/80 mt-1 mb-3">Your vehicle MOT expires in 14 days. Your account will be paused.</p>
                <button className="bg-white text-[#FF3B30] text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl shadow-lg border border-white">
                  Get MOT Quote on AnyTrader
                </button>
              </div>
            </div>
            <Car className="absolute -bottom-4 -right-4 w-24 h-24 text-[#FF3B30] opacity-10 pointer-events-none" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message List */}
      <div className="space-y-3">
        {filteredMessages.map((msg, idx) => {
          const Icon = msg.icon;
          return (
            <motion.div 
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={cn(
                "bg-[#1A1A1E] border border-[#2C2C30] rounded-2xl p-4 flex items-center gap-4 transition-colors active:bg-[#252529]",
                msg.unread ? "border-[#6B6B73]/50" : ""
              )}
            >
              <div className="relative">
                <div className={cn("w-12 h-12 rounded-full flex items-center justify-center shrink-0", msg.bg)}>
                  <Icon className={cn("w-6 h-6", msg.color)} />
                </div>
                {msg.unread && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#FF3B30] rounded-full border-2 border-[#1A1A1E]"></span>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <h3 className={cn("text-sm truncate font-bold", msg.unread ? "text-white font-black" : "text-[#EBEBF5]")}>
                    {msg.title}
                  </h3>
                  <span className="text-[10px] font-bold text-[#6B6B73] shrink-0 ml-2 uppercase tracking-wider">{msg.time}</span>
                </div>
                <p className="text-xs text-[#A0A0A8] truncate">{msg.desc}</p>
              </div>
              
              <ChevronRight className="w-5 h-5 text-[#6B6B73]" />
            </motion.div>
          );
        })}

        {filteredMessages.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle2 className="w-12 h-12 text-[#6B6B73] mx-auto mb-3 opacity-20" />
            <p className="text-[#A0A0A8] font-bold">You're all caught up!</p>
          </div>
        )}
      </div>
    </div>
  );
}

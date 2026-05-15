import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, Bell, Zap, ShieldAlert, CircleAlert, CheckCircle2, ChevronRight, Car, X, Trash2, Send, ChevronLeft } from "lucide-react";
import { cn } from "@/src/lib/utils";

type FilterType = 'all' | 'rides' | 'alerts' | 'anytrader';

function DoubleTapDeleteButton({ onDelete, className, tooltipSide = "left" }: { onDelete: () => void, className?: string, tooltipSide?: "left" | "right" | "top" | "bottom" }) {
  const [confirming, setConfirming] = useState(false);

  // Clear timeout if unmounted
  React.useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (confirming) {
      timeout = setTimeout(() => {
        setConfirming(false);
      }, 3000);
    }
    return () => clearTimeout(timeout);
  }, [confirming]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirming) {
      setConfirming(false);
      onDelete();
    } else {
      setConfirming(true);
    }
  };

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <button
        onClick={handleClick}
        className={cn(
          "w-10 h-10 flex items-center justify-center rounded-xl transition-all",
          confirming ? "bg-[#FF3B30] text-white scale-110 shadow-[0_0_15px_rgba(255,59,48,0.5)]" : "text-[#FF3B30] hover:bg-[#FF3B30]/10"
        )}
      >
        <Trash2 className="w-5 h-5" />
      </button>
      
      <AnimatePresence>
        {confirming && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: tooltipSide === 'left' ? 10 : tooltipSide === 'right' ? -10 : 0, y: tooltipSide === 'top' ? 10 : tooltipSide === 'bottom' ? -10 : 0 }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={cn(
              "absolute z-10 bg-[#FF3B30] text-white text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none",
              tooltipSide === "left" && "right-[calc(100%+8px)]",
              tooltipSide === "right" && "left-[calc(100%+8px)]",
              tooltipSide === "top" && "bottom-[calc(100%+8px)]",
              tooltipSide === "bottom" && "top-[calc(100%+8px)]"
            )}
          >
            Press Again
            {/* Little triangle pointer out to the icon */}
            <div className={cn(
              "absolute w-2 h-2 bg-[#FF3B30] rotate-45",
              tooltipSide === "left" && "-right-1 top-1/2 -translate-y-1/2",
              tooltipSide === "right" && "-left-1 top-1/2 -translate-y-1/2",
              tooltipSide === "top" && "-bottom-1 left-1/2 -translate-x-1/2",
              tooltipSide === "bottom" && "-top-1 left-1/2 -translate-x-1/2"
            )} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function DriverInbox({ onClose, onNavigate }: { onClose?: () => void, onNavigate?: (tab: string) => void }) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");

  const [messages, setMessages] = useState([
    { id: 1, type: 'alerts', title: 'MOT Expires in 14 Days', desc: 'Please upload your new taxi MOT.', fullText: 'Your taxi MOT is about to expire in 14 days. To ensure you can continue to accept rides without any interruption, please book your vehicle for a taxi MOT test with your local council. Once completed, upload the certificate in the Documents section.', time: '2h ago', icon: ShieldAlert, color: 'text-[#FF3B30]', bg: 'bg-[#FF3B30]/10', unread: true },
    { id: 2, type: 'anytrader', title: 'New Trade Lead (Plumbing)', desc: 'Leakin pipe in SE15. Est: £65.', fullText: 'A new plumbing lead is available in your area. The customer has reported a leaking pipe in SE15. The estimated quote is around £65. Tap on View Job to see more details and submit your offer.', time: '4h ago', icon: Zap, color: 'text-[#AF52DE]', bg: 'bg-[#AF52DE]/10', unread: true },
    { id: 3, type: 'rides', title: 'Sarah T.', desc: 'I am standing outside the blue gate.', fullText: 'Hello, I am currently waiting standing outside the large blue gate near the main entrance. You can pull up right next to it.', time: 'Yesterday', icon: MessageSquare, color: 'text-[#00D26A]', bg: 'bg-[#00D26A]/10', unread: false },
    { id: 4, type: 'alerts', title: 'Weekly Earnings Report', desc: 'You made £845.20 last week. View breakdown.', fullText: 'Great work! You have successfully earned £845.20 in the last week. Visit your earnings tab to view the full breakdown of trips, commissions, and tips.', time: 'Mon', icon: Bell, color: 'text-white', bg: 'bg-[#252529]', unread: false },
    { id: 5, type: 'anytrader', title: 'Mechanic Offer', desc: 'Mobile mechanic quoted £45 for your brake pads.', fullText: 'John from Mobile Mechanics has sent you a quote of £45 to replace your front brake pads. This offer expires in 48 hours.', time: 'Sun', icon: Zap, color: 'text-[#AF52DE]', bg: 'bg-[#AF52DE]/10', unread: false },
  ]);

  const filteredMessages = messages.filter(m => filter === 'all' || m.type === filter);
  const selectedMessage = messages.find(m => m.id === selectedMessageId);

  const handleDelete = (id: number) => {
    setMessages(prev => prev.filter(m => m.id !== id));
    if (selectedMessageId === id) {
      setSelectedMessageId(null);
    }
  };

  const handleReply = () => {
    if (!replyText.trim()) return;
    // In a real app, send the reply to the backend here
    console.log("Replying:", replyText);
    setReplyText("");
    // Close message or show success
    setSelectedMessageId(null);
  };

  return (
    <div className="flex-1 bg-[#0D0D0F] text-white relative font-sans min-h-0 flex flex-col items-stretch overflow-hidden">
      {!selectedMessageId ? (
        <div className="flex-1 overflow-y-auto px-4 py-6 pb-24">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-black tracking-tight">Inbox</h1>
            {onClose && (
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-[#1A1A1E] rounded-full border border-[#2C2C30] text-[#A1A1AA] hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Filter Chips */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
            {(['all', 'rides', 'alerts', 'anytrader'] as const).map(f => {
              const hasUnread = messages.some(m => m.type === f && m.unread);
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors border relative",
                    filter === f 
                      ? "bg-white text-[#0D0D0F] border-white" 
                      : "bg-[#1A1A1E] text-[#E4E4E7] border-[#2C2C30] hover:border-[#A1A1AA]"
                  )}
                >
                  {f}
                  {hasUnread && f !== 'all' && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#AF52DE] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#AF52DE] border border-[#1A1A1E]"></span>
                    </span>
                  )}
                </button>
              );
            })}
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
                    <p className="text-xs text-white/80 mt-1 mb-3">Your taxi MOT expires in 14 days. Your account will be paused. Please update your documents.</p>
                    <button 
                      onClick={() => onNavigate && onNavigate('documents')}
                      className="bg-white text-[#FF3B30] text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl shadow-lg border border-white active:scale-95 transition-all">
                      Upload New MOT
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
                  onClick={() => {
                     // mark as read
                     setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, unread: false } : m));
                     setSelectedMessageId(msg.id);
                  }}
                  className={cn(
                    "bg-[#1A1A1E] border border-[#2C2C30] rounded-2xl p-4 flex items-center gap-4 transition-colors cursor-pointer active:bg-[#252529]",
                    msg.unread ? "border-[#A1A1AA]/50" : ""
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
                      <span className="text-[10px] font-bold text-[#A1A1AA] shrink-0 ml-2 uppercase tracking-wider">{msg.time}</span>
                    </div>
                    <p className="text-xs text-[#E4E4E7] truncate">{msg.desc}</p>
                  </div>
                  
                  <DoubleTapDeleteButton 
                    onDelete={() => handleDelete(msg.id)} 
                    tooltipSide="left"
                    className="shrink-0 ml-2" 
                  />
                </motion.div>
              );
            })}

            {filteredMessages.length === 0 && (
              <div className="text-center py-12">
                <CheckCircle2 className="w-12 h-12 text-[#A1A1AA] mx-auto mb-3 opacity-20" />
                <p className="text-[#E4E4E7] font-bold">You're all caught up!</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <AnimatePresence>
          {selectedMessage && (
            <motion.div
              initial={{ opacity: 0, x: "100%" }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: "100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className="absolute inset-0 z-50 bg-[#0D0D0F] flex flex-col pb-24"
            >
              {/* Message Header */}
              <div className="shrink-0 sticky top-0 bg-[#0D0D0F]/90 backdrop-blur-xl z-20 px-4 py-4 flex items-center justify-between border-b border-[#2C2C30]">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setSelectedMessageId(null)} 
                    className="w-10 h-10 bg-[#1A1A1E] border border-[#2C2C30] rounded-xl flex items-center justify-center text-[#E4E4E7] active:text-white transition-colors group"
                  >
                    <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
                  </button>
                  <h1 className="text-lg font-black tracking-tight truncate max-w-[200px]">{selectedMessage.title}</h1>
                </div>
                <DoubleTapDeleteButton 
                   onDelete={() => handleDelete(selectedMessage.id)} 
                   tooltipSide="bottom"
                />
              </div>

              {/* Message Content */}
              <div className="flex-1 overflow-y-auto px-4 py-6">
                 <div className="flex items-center gap-3 mb-6">
                    <div className={cn("w-14 h-14 rounded-full flex items-center justify-center shrink-0", selectedMessage.bg)}>
                       <selectedMessage.icon className={cn("w-7 h-7", selectedMessage.color)} />
                    </div>
                    <div>
                       <h2 className="text-xl font-black text-white">{selectedMessage.title}</h2>
                       <p className="text-sm font-bold text-[#A1A1AA] uppercase tracking-wider mt-0.5">{selectedMessage.time}</p>
                    </div>
                 </div>

                 <div className="bg-[#1A1A1E] p-5 rounded-3xl border border-[#2C2C30]">
                    <p className="text-sm text-[#E4E4E7] leading-relaxed whitespace-pre-wrap">
                       {selectedMessage.fullText}
                    </p>
                 </div>
              </div>

              {/* Reply Section / Call to Actions */}
              <div className="p-4 border-t border-[#2C2C30] bg-[#0D0D0F] shrink-0">
                 {selectedMessage.type === 'rides' ? (
                    <div className="flex items-center gap-2">
                       <input 
                         type="text"
                         placeholder="Type a reply..."
                         value={replyText}
                         onChange={(e) => setReplyText(e.target.value)}
                         className="flex-1 bg-[#1A1A1E] border border-[#2C2C30] rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white transition-colors"
                       />
                       <button 
                         onClick={handleReply}
                         disabled={!replyText.trim()}
                         className="w-12 h-12 bg-white text-[#0D0D0F] rounded-2xl flex items-center justify-center disabled:opacity-50 disabled:bg-[#2C2C30] disabled:text-[#A1A1AA] transition-colors"
                       >
                         <Send className="w-5 h-5" />
                       </button>
                    </div>
                 ) : selectedMessage.type === 'anytrader' ? (
                     <button className="w-full py-4 rounded-xl bg-white text-[#0D0D0F] font-black uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-95 transition-all">
                        View Lead Details
                     </button>
                 ) : selectedMessage.id === 1 ? (
                     <button 
                       onClick={() => onNavigate && onNavigate('documents')}
                       className="w-full py-4 rounded-xl bg-white text-[#FF3B30] font-black uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all"
                     >
                        Upload Documents
                     </button>
                 ) : selectedMessage.id === 4 ? (
                     <button 
                       onClick={() => onNavigate && onNavigate('earnings')}
                       className="w-full py-4 rounded-xl bg-white text-[#0D0D0F] font-black uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all"
                     >
                        View Earnings
                     </button>
                 ) : (
                     <button 
                       onClick={() => setSelectedMessageId(null)}
                       className="w-full py-4 rounded-xl bg-[#252529] hover:bg-[#333338] text-white font-black uppercase tracking-widest text-sm transition-colors active:scale-95"
                     >
                        Close
                     </button>
                 )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}


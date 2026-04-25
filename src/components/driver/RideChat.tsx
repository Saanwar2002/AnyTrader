import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, setDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '@/src/firebase';
import { useAuth } from '@/src/components/AuthProvider';
import { X, Send, MessageSquare, Phone, BellRing } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { toast } from 'sonner';

interface RideChatProps {
  rideId: string;
  isOpen: boolean;
  onClose: () => void;
  otherPartyName: string;
  otherPartyPhone?: string;
  passengerId?: string;
  canSendSMS?: boolean;
}

export default function RideChat({ rideId, isOpen, onClose, otherPartyName, otherPartyPhone, passengerId, canSendSMS = false }: RideChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rideId || !isOpen) return;

    const q = query(
      collection(db, "ride_requests", rideId, "chat"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [rideId, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !rideId) return;

    const messageText = newMessage.trim();
    setNewMessage("");

    try {
      await addDoc(collection(db, "ride_requests", rideId, "chat"), {
        text: messageText,
        senderId: user.uid,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleSendSMSNudge = async () => {
    if (!passengerId) {
       toast.error("Passenger ID not found");
       return;
    }
    try {
       const smsRef = doc(collection(db, "sms_queue"));
       await setDoc(smsRef, {
         toUserId: passengerId,
         rideId: rideId,
         message: `AnyRide: Your driver ${user?.displayName || ""} has sent you a message. Please check the app.`,
         status: "pending",
         createdAt: serverTimestamp()
       });
       toast.success("SMS Alert Sent", { description: "The passenger will receive a text message immediately." });
    } catch (err) {
       console.error(err);
       toast.error("Failed to send SMS alert");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed bottom-20 left-4 right-4 z-[200] bg-[#1A1A1E] rounded-3xl border border-[#333338] shadow-2xl flex flex-col pointer-events-auto"
          style={{ height: "400px", maxHeight: "60vh" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#333338] shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#252529] flex items-center justify-center shrink-0 border border-[#333338]">
                <MessageSquare className="w-4 h-4 text-[#A1A1AA]" />
              </div>
              <p className="text-sm font-bold text-white line-clamp-1">{otherPartyName}</p>
            </div>
            <div className="flex items-center gap-2">
              {passengerId && canSendSMS && (
                <button 
                  onClick={handleSendSMSNudge}
                  className="w-8 h-8 rounded-full bg-[#252529] flex items-center justify-center hover:bg-[#333338] transition-colors"
                  title="Send SMS Alert"
                >
                  <BellRing className="w-4 h-4 text-[#007AFF]" />
                </button>
              )}
              {otherPartyPhone && (
                <a 
                  href={`tel:${otherPartyPhone}`}
                  className="w-8 h-8 rounded-full bg-[#252529] flex items-center justify-center hover:bg-[#333338] transition-colors"
                >
                  <Phone className="w-4 h-4 text-[#00D26A]" />
                </a>
              )}
              <button 
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-[#252529] flex items-center justify-center hover:bg-[#333338] transition-colors"
              >
                <X className="w-5 h-5 text-[#A1A1AA]" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-50">
                <MessageSquare className="w-8 h-8 text-[#A1A1AA] mb-2" />
                <p className="text-xs font-bold text-[#A1A1AA]">No messages yet</p>
                <p className="text-[10px] text-[#A1A1AA] mt-1">Start the conversation</p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isMe = msg.senderId === user?.uid;
                const showAvatar = idx === 0 || messages[idx - 1].senderId !== msg.senderId;

                return (
                  <div key={msg.id} className={cn("flex w-full", isMe ? "justify-end" : "justify-start")}>
                    <div className={cn("flex flex-col max-w-[80%]", isMe ? "items-end" : "items-start")}>
                      <div 
                        className={cn(
                          "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                          isMe 
                            ? "bg-[#00D26A] text-[#1A1A1E] rounded-tr-sm" 
                            : "bg-[#252529] text-white rounded-tl-sm border border-[#333338]"
                        )}
                      >
                        {msg.text}
                      </div>
                      <span className="text-[9px] text-[#A1A1AA] font-bold mt-1 px-1 opacity-70">
                        {msg.createdAt?.toDate ? 
                          msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                          : "Sending..."}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-[#333338] bg-[#1A1A1E] rounded-b-3xl shrink-0 flex gap-2 items-end shrink-0">
            <div className="bg-[#0D0D0F] border border-[#333338] rounded-2xl flex-1 flex items-center px-3 min-h-[44px]">
              <input 
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="w-full bg-transparent border-none text-white text-sm placeholder:text-[#6B6B73] focus:outline-none focus:ring-0 py-3"
              />
            </div>
            <button 
              type="submit"
              disabled={!newMessage.trim()}
              className="w-11 h-11 rounded-full bg-[#00D26A] text-[#1A1A1E] flex items-center justify-center shrink-0 disabled:opacity-50 disabled:bg-[#252529] disabled:text-[#6B6B73] transition-colors"
            >
              <Send className="w-5 h-5 -ml-1" />
            </button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

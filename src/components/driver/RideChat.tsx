import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, setDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, uploadStorageFile } from '@/src/firebase';
import { useAuth } from '@/src/components/AuthProvider';
import { X, Send, MessageSquare, Phone, BellRing, Image as ImageIcon, Loader2, Maximize2, Download } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { toast } from 'sonner';
import { playSound } from '@/src/lib/sound';

interface RideChatProps {
  rideId: string;
  isOpen: boolean;
  onClose: () => void;
  otherPartyName: string;
  otherPartyPhone?: string;
  passengerId?: string;
  canSendSMS?: boolean;
  quickReplies?: string[];
}

export default function RideChat({ rideId, isOpen, onClose, otherPartyName, otherPartyPhone, passengerId, canSendSMS = false, quickReplies }: RideChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isInitialListener = useRef(true);

  const defaultQuickReplies = [
    "OK, got it!",
    "I'll be right there",
    "Traffic is heavy",
    "I'll be outside shortly",
    "I'm at location but can not find you."
  ];
  
  const activeReplies = quickReplies || defaultQuickReplies;

  useEffect(() => {
    if (!rideId || !isOpen) return;

    const q = query(
      collection(db, "ride_requests", rideId, "chat"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!isInitialListener.current) {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (data.senderId !== user?.uid) {
              playSound('notification');
            }
          }
        });
      } else {
        isInitialListener.current = false;
      }
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
      if (passengerId) {
        fetch("/api/chat-push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientId: passengerId,
            title: "New Message",
            body: messageText,
            rideId: rideId
          })
        }).catch(err => console.error("FCM API error:", err));
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !rideId) return;

    setIsUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const storagePath = `rides/${rideId}/chat_${Date.now()}_${safeName}`;
      
      const url = await uploadStorageFile(file, storagePath, {
        contentType: file.type || "image/jpeg",
        maxImageWidth: 1200,
        quality: 0.75
      });

      await addDoc(collection(db, "ride_requests", rideId, "chat"), {
        imageUrl: url,
        senderId: user.uid,
        createdAt: serverTimestamp()
      });

      if (passengerId) {
        fetch("/api/chat-push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientId: passengerId,
            title: "New Photo",
            body: "📷 Sent a photo",
            rideId: rideId
          })
        }).catch(err => console.error("FCM API error:", err));
      }
      toast.success("Photo sent");
    } catch (err: any) {
      console.error("Error uploading ride chat image:", err);
      toast.error(err?.message || "Failed to upload photo");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sendQuickReply = async (text: string) => {
    if (!user || !rideId) return;
    try {
      await addDoc(collection(db, "ride_requests", rideId, "chat"), {
        text,
        senderId: user.uid,
        createdAt: serverTimestamp()
      });
      if (passengerId) {
        fetch("/api/chat-push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientId: passengerId,
            title: "New Message",
            body: text,
            rideId: rideId
          })
        }).catch(err => console.error("FCM API error:", err));
      }
    } catch (error) {
      console.error("Error sending quick reply:", error);
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
         message: `AnyRoller: Your driver ${user?.displayName || ""} has sent you a message. Please check the app.`,
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

                return (
                  <div key={msg.id} className={cn("flex w-full", isMe ? "justify-end" : "justify-start")}>
                    <div className={cn("flex flex-col max-w-[80%]", isMe ? "items-end" : "items-start")}>
                      <div 
                        className={cn(
                          "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                          isMe 
                            ? "bg-[#00D26A] text-[#1A1A1E] rounded-tr-sm font-medium" 
                            : "bg-[#252529] text-white rounded-tl-sm border border-[#333338]"
                        )}
                      >
                        {msg.imageUrl && (
                          <div 
                            onClick={() => setActiveLightboxImage(msg.imageUrl)}
                            className="mb-1 rounded-xl overflow-hidden cursor-pointer relative group bg-black/20"
                          >
                            <img 
                              src={msg.imageUrl} 
                              alt="Ride photo" 
                              className="max-w-full h-auto max-h-52 object-cover rounded-xl"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="bg-black/75 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                                <Maximize2 className="w-3 h-3" /> View
                              </span>
                            </div>
                          </div>
                        )}
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

          {/* Fullscreen Lightbox for Ride Chat */}
          <AnimatePresence>
            {activeLightboxImage && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[999] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4"
                onClick={() => setActiveLightboxImage(null)}
              >
                <div className="absolute top-4 right-4 flex items-center gap-3 z-10" onClick={(e) => e.stopPropagation()}>
                  <a 
                    href={activeLightboxImage} 
                    download="ride-photo.jpg" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                  >
                    <Download className="w-5 h-5" />
                  </a>
                  <button 
                    onClick={() => setActiveLightboxImage(null)}
                    className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="relative max-w-4xl max-h-[85vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                  <img 
                    src={activeLightboxImage} 
                    alt="Ride preview" 
                    className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick Replies */}
          <div className="px-3 pb-2 pt-2 border-t border-[#333338] bg-[#1A1A1E] flex overflow-x-auto no-scrollbar gap-2 w-full">
            {activeReplies.map((msg, i) => (
              <button
                key={i}
                type="button"
                onClick={() => sendQuickReply(msg)}
                className="whitespace-nowrap px-4 py-1.5 bg-[#252529] border border-[#333338] text-[#E4E4E7] hover:text-white text-[12px] font-bold rounded-lg active:scale-95 transition-transform shrink-0 shadow-sm cursor-pointer"
              >
                {msg}
              </button>
            ))}
          </div>

          {/* Input */}
          <form onSubmit={handleSendMessage} className="p-3 bg-[#1A1A1E] rounded-b-3xl shrink-0 flex gap-2 items-center">
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              className="hidden" 
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-11 h-11 rounded-2xl bg-[#252529] border border-[#333338] text-[#A1A1AA] hover:text-white flex items-center justify-center shrink-0 transition-colors disabled:opacity-50 cursor-pointer"
              title="Send photo"
            >
              {isUploading ? <Loader2 className="w-5 h-5 animate-spin text-[#00D26A]" /> : <ImageIcon className="w-5 h-5" />}
            </button>
            <div className="bg-[#0D0D0F] border border-[#333338] rounded-2xl flex-1 flex items-center px-3 min-h-[44px]">
              <input 
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="w-full bg-transparent border-none text-white text-sm placeholder:text-[#6B6B73] focus:outline-none focus:ring-0 py-2.5"
              />
            </div>
            <button 
              type="submit"
              disabled={!newMessage.trim() || isUploading}
              className="w-11 h-11 rounded-full bg-[#00D26A] text-[#1A1A1E] flex items-center justify-center shrink-0 disabled:opacity-50 disabled:bg-[#252529] disabled:text-[#6B6B73] transition-colors cursor-pointer"
            >
              <Send className="w-5 h-5 -ml-0.5" />
            </button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

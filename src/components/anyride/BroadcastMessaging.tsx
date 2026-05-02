import React, { useState, useEffect } from "react";
import { Megaphone, Users, Smartphone, Mail, Send, History, Loader2 } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { db, collection, query, onSnapshot, addDoc, serverTimestamp, handleFirestoreError, OperationType, orderBy } from "@/src/firebase";
import { toast } from "sonner";

export default function BroadcastMessaging() {
  const [target, setTarget] = useState("all-drivers");
  const [channel, setChannel] = useState("push");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "broadcasts"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBroadcasts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSend = async () => {
    if (!title || !content) {
      toast.error("Title and content are required.");
      return;
    }
    
    setSending(true);
    try {
      await addDoc(collection(db, "broadcasts"), {
        title,
        content,
        type: "announcement",
        targetSegments: [target],
        channel,
        reach: Math.floor(Math.random() * 500) + 100, // Simulated reach for now
        createdAt: serverTimestamp()
      });
      toast.success("Broadcast sent successfully!");
      setTitle("");
      setContent("");
    } catch(e) {
      handleFirestoreError(e, OperationType.CREATE, "broadcasts");
      toast.error("Failed to send broadcast");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-emerald-500" />
            Broadcast Center
          </h2>
          <p className="text-slate-500 font-medium">Send push, SMS, or emails to segments of users.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {/* Builder */}
         <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-black text-slate-900 mb-6 border-b border-slate-100 pb-4">Compose Broadcast</h3>
            
            <div className="space-y-6">
               <div>
                 <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-3">1. Target Audience</label>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                   {[
                     { id: 'all-drivers', label: "All Drivers" },
                     { id: 'active-drivers', label: "Online Drivers" },
                     { id: 'all-riders', label: "All Riders" },
                     { id: 'custom', label: "Custom Segment..." },
                   ].map(t => (
                     <button
                       key={t.id}
                       onClick={() => setTarget(t.id)}
                       className={cn(
                         "p-3 rounded-xl border text-sm font-bold text-center transition-all",
                         target === t.id ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                       )}
                     >
                       {t.label}
                     </button>
                   ))}
                 </div>
               </div>

               <div>
                 <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-3">2. Delivery Channel</label>
                 <div className="flex gap-3">
                   <button
                     onClick={() => setChannel("push")}
                     className={cn(
                       "flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-bold transition-all",
                       channel === "push" ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                     )}
                   >
                     <Smartphone className="w-4 h-4" /> Push Notification
                   </button>
                   <button
                     onClick={() => setChannel("sms")}
                     className={cn(
                       "flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-bold transition-all",
                       channel === "sms" ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                     )}
                   >
                     <Smartphone className="w-4 h-4" /> SMS Fast
                   </button>
                   <button
                     onClick={() => setChannel("email")}
                     className={cn(
                       "flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-bold transition-all",
                       channel === "email" ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                     )}
                   >
                     <Mail className="w-4 h-4" /> Email
                   </button>
                 </div>
               </div>

               <div>
                 <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-3">3. Message Content</label>
                 <input 
                   type="text" 
                   value={title}
                   onChange={e => setTitle(e.target.value)}
                   placeholder="Notification Title (Short)" 
                   className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold mb-3 outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" 
                 />
                 <textarea 
                   value={content}
                   onChange={e => setContent(e.target.value)}
                   placeholder="Type your message here..." 
                   className="w-full p-4 h-32 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 resize-none font-medium"
                 ></textarea>
               </div>

               <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                 <p className="text-xs font-medium text-slate-500"><Users className="w-4 h-4 inline mr-1" /> Estimated Reach: <strong className="text-slate-900">~250 users</strong></p>
                 <button 
                   onClick={handleSend}
                   disabled={sending}
                   className="bg-emerald-500 text-white px-8 py-3 rounded-xl font-black shadow-lg hover:bg-emerald-600 inline-flex items-center gap-2 transition-colors disabled:opacity-50"
                 >
                   {sending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4" />} {sending ? "Sending..." : "Send Broadcast Now"}
                 </button>
               </div>
            </div>
         </div>

         {/* History */}
         <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden h-[600px]">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-black text-slate-900">Recent Broadcasts</h3>
            </div>
            <div className="flex-1 overflow-y-auto split-y divide-slate-50 p-2">
               {loading ? (
                 <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
               ) : broadcasts.length > 0 ? broadcasts.map((b) => (
                 <div key={b.id} className="p-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors block border-b border-slate-50 border-solid py-4 last:border-0">
                    <h4 className="text-sm font-bold text-slate-900 mb-1">{b.title}</h4>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-black uppercase tracking-widest">{b.channel || 'push'}</span>
                      <span className="text-[10px] text-slate-500 font-medium">To: {b.targetSegments?.[0] || 'all'}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 font-medium border-t border-slate-100 pt-2 mt-2">
                      <span>{b.reach || 0} delivered</span>
                      <span>{b.createdAt?.toDate ? b.createdAt.toDate().toLocaleDateString() : 'Just now'}</span>
                    </div>
                 </div>
               )) : (
                 <div className="p-8 text-center text-slate-500 text-sm">No broadcasts sent yet.</div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
}

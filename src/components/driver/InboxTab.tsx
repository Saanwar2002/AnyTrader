import React, { useState, useEffect } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/src/firebase";
import { useAuth } from "../AuthProvider";
import { MessageSquare, Bell, Calendar, Tag } from "lucide-react";
import { cn } from "@/src/lib/utils";

export default function InboxTab() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsub();
  }, [user]);

  const filteredNotifications = filter === "all" 
    ? notifications 
    : notifications.filter(n => n.type === filter);

  return (
    <div className="flex-1 bg-surface overflow-y-auto pb-24">
      <div className="p-6">
        <h1 className="text-2xl font-black text-text-main mb-6">Inbox</h1>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
          {[{id: "all", label: "All"}, {id: "ride", label: "Rides"}, {id: "quote", label: "Quotes"}, {id: "system", label: "System"}].map(f => (
            <button 
              key={f.id} 
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all",
                filter === f.id ? "bg-text-main text-surface" : "bg-card text-text-muted hover:bg-surface border border-border-main"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="space-y-4">
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map((n) => (
              <div key={n.id} className={cn("bg-card p-5 rounded-3xl border shadow-sm space-y-3", !n.read ? "border-primary" : "border-border-main")}>
                <div className="flex items-center gap-3">
                  {!n.read && <div className="w-2 h-2 rounded-full bg-danger" />}
                  <h4 className="font-black text-text-main text-sm">{n.title}</h4>
                </div>
                <p className="text-xs text-text-main opacity-80 leading-relaxed">{n.message}</p>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    {n.createdAt?.seconds ? new Date(n.createdAt.seconds * 1000).toLocaleDateString() : "Just now"}
                  </span>
                  {n.link && <a href={n.link} className="text-[10px] font-black uppercase text-primary tracking-wider">View →</a>}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-text-muted">No notifications found.</div>
          )}
        </div>
      </div>
    </div>
  );
}

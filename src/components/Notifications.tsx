import React, { useEffect, useState } from "react";
import { db, collection, query, where, orderBy, onSnapshot, updateDoc, doc, handleFirestoreError, OperationType } from "@/src/firebase";
import { useAuth } from "./AuthProvider";
import { motion, AnimatePresence } from "motion/react";
import { Bell, MessageSquare, FileText, Info, Check, Trash2, Loader2, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/src/lib/utils";

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date();
      const allNotifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const visibleNotifs = allNotifs.filter((n: any) => {
        if (!n.visibleAt) return true;
        const visibleAt = n.visibleAt.toDate ? n.visibleAt.toDate() : new Date(n.visibleAt);
        return visibleAt <= now;
      });
      setNotifications(visibleNotifs);
      setLoading(false);
    }, (err) => {
      console.error(err);
      try {
        handleFirestoreError(err, OperationType.LIST, "notifications");
      } catch (e: any) {
        setError(e.message);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "quote": return <FileText className="w-5 h-5 text-blue-600" />;
      case "message": return <MessageSquare className="w-5 h-5 text-green-600" />;
      case "status": return <Check className="w-5 h-5 text-amber-600" />;
      default: return <Info className="w-5 h-5 text-slate-600" />;
    }
  };

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>{notifications.filter(n => !n.read).length} Unread</span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {notifications.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-4"
            >
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <Bell className="w-8 h-8" />
              </div>
              <p className="text-slate-500">No notifications yet.</p>
            </motion.div>
          ) : (
            notifications.map((notification) => (
              <motion.div
                key={notification.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={cn(
                  "bg-white p-4 rounded-2xl border transition-all flex gap-4 items-start group",
                  notification.read ? "border-slate-100 opacity-75" : "border-blue-100 bg-blue-50/30 shadow-sm"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                  notification.read ? "bg-slate-100" : "bg-white shadow-sm"
                )}>
                  {getIcon(notification.type)}
                </div>
                
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={cn("font-bold truncate", notification.read ? "text-slate-600" : "text-slate-900")}>
                      {notification.title}
                    </h3>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      {new Date(notification.createdAt?.toDate?.() || notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 line-clamp-2">{notification.message}</p>
                  
                  <div className="flex items-center gap-4 pt-2">
                    {notification.link && (
                      <Link 
                        to={notification.link}
                        onClick={() => markAsRead(notification.id)}
                        className="text-xs font-bold text-blue-600 hover:underline"
                      >
                        View Details
                      </Link>
                    )}
                    {!notification.read && (
                      <button 
                        onClick={() => markAsRead(notification.id)}
                        className="text-xs font-bold text-slate-400 hover:text-slate-600"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

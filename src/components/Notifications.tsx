import React, { useEffect, useState } from "react";
import { db, collection, query, where, orderBy, onSnapshot, updateDoc, doc, deleteDoc, handleFirestoreError, OperationType } from "@/src/firebase";
import { useAuth } from "./AuthProvider";
import { motion, AnimatePresence } from "motion/react";
import { Bell, MessageSquare, FileText, Info, Check, Loader2, Clock, X, Calendar, ArrowRight, Sparkles, ExternalLink, ShieldCheck, CreditCard, Building, Wrench, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/src/lib/utils";
import TraderNotificationPreferencesModal from "./TraderNotificationPreferencesModal";

export default function Notifications() {
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const navigate = useNavigate();

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

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, "notifications", id));
    } catch (err) {
      console.error("Error deleting notification:", err);
      handleFirestoreError(err, OperationType.DELETE, "notifications");
    }
  };

  const resolveNotificationRoute = (notification: any): string => {
    // 1. Direct path properties on notification document
    const directPath = notification.actionPath || notification.link || notification.actionUrl || notification.url || notification.targetUrl || notification.path;
    if (directPath && typeof directPath === "string" && directPath.trim().length > 0) {
      return directPath.trim();
    }

    // 2. ID based routing
    if (notification.jobId) return `/job/${notification.jobId}`;
    if (notification.chatId) return `/messages?chatId=${notification.chatId}`;
    if (notification.bookingId) return `/job/${notification.bookingId}`;
    if (notification.propertyId) return `/profile#property-passport`;

    // 3. Smart title / content matching
    const title = (notification.title || "").toLowerCase();
    const message = (notification.message || "").toLowerCase();
    const type = (notification.type || "").toLowerCase();

    // Profile Optimization / AI Coach / Match Score
    if (
      type === "profile_optimization" ||
      title.includes("profile") ||
      title.includes("coach") ||
      title.includes("match score") ||
      message.includes("profile") ||
      message.includes("match score")
    ) {
      if (title.includes("verification") || message.includes("verification") || title.includes("id")) {
        return "/profile#verification";
      }
      return "/profile#ai-profile-optimizer";
    }

    // Verification / CSCS / Trust Credentials
    if (title.includes("verification") || title.includes("cscs") || message.includes("verification")) {
      return "/profile#verification";
    }

    // Quotes / Bids / Jobs / Leads
    if (
      type === "quote" ||
      type === "bid" ||
      type === "lead" ||
      title.includes("quote") ||
      title.includes("bid") ||
      title.includes("job") ||
      title.includes("lead") ||
      message.includes("quote") ||
      message.includes("job")
    ) {
      return "/hiring";
    }

    // Messages / Chat
    if (
      type === "message" ||
      title.includes("message") ||
      title.includes("chat") ||
      message.includes("message")
    ) {
      return "/messages";
    }

    // Invoices / Financials / Payments
    if (
      title.includes("invoice") ||
      title.includes("payment") ||
      title.includes("payout") ||
      title.includes("earning") ||
      title.includes("tax") ||
      message.includes("payment")
    ) {
      return "/financials";
    }

    // Property Passport / CP12 / EICR
    if (
      title.includes("property") ||
      title.includes("passport") ||
      title.includes("cp12") ||
      title.includes("eicr") ||
      message.includes("property")
    ) {
      return "/profile#property-passport";
    }

    // Taxi / Delivery
    if (title.includes("taxi") || title.includes("ride") || title.includes("driver")) {
      return "/find-trades";
    }

    return "/profile";
  };

  const getActionButtonDetails = (notification: any, targetRoute: string) => {
    const title = (notification.title || "").toLowerCase();
    const type = (notification.type || "").toLowerCase();

    if (targetRoute.includes("#ai-profile-optimizer") || type === "profile_optimization" || title.includes("coach")) {
      return { label: "View Optimization Coach", icon: <Sparkles className="w-4 h-4 text-amber-300 stroke-[2.5]" /> };
    }
    if (targetRoute.includes("#verification") || title.includes("verification")) {
      return { label: "View Verification", icon: <ShieldCheck className="w-4 h-4 stroke-[2.5]" /> };
    }
    if (targetRoute.includes("job") || targetRoute.includes("hiring") || type === "quote" || title.includes("quote")) {
      return { label: "View Job & Quotes", icon: <FileText className="w-4 h-4 stroke-[2.5]" /> };
    }
    if (targetRoute.includes("messages") || type === "message") {
      return { label: "Open Messages", icon: <MessageSquare className="w-4 h-4 stroke-[2.5]" /> };
    }
    if (targetRoute.includes("financials") || title.includes("invoice") || title.includes("payment")) {
      return { label: "View Financials", icon: <CreditCard className="w-4 h-4 stroke-[2.5]" /> };
    }
    if (targetRoute.includes("#property-passport") || title.includes("property")) {
      return { label: "Open Property Passport", icon: <Building className="w-4 h-4 stroke-[2.5]" /> };
    }

    return { label: "View Section & Take Action", icon: <ArrowRight className="w-4 h-4 stroke-[2.5]" /> };
  };

  const handleNotificationCardClick = async (notification: any) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    const route = resolveNotificationRoute(notification);
    navigate(route);

    // If target route has a hash and we are navigating to /profile, scroll to section smoothly
    if (route.includes("#")) {
      const hash = route.split("#")[1];
      setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        }
      }, 150);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "quote": return <FileText className="w-5 h-5 text-blue-600" />;
      case "message": return <MessageSquare className="w-5 h-5 text-green-600" />;
      case "status": return <Check className="w-5 h-5 text-amber-600" />;
      case "scheduled_repair_reminder": return <Calendar className="w-5 h-5 text-blue-600" />;
      case "profile_optimization": return <Sparkles className="w-5 h-5 text-amber-500" />;
      default: return <Info className="w-5 h-5 text-slate-800" />;
    }
  };

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin text-black" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-black">Notifications</h1>
        <div className="flex items-center gap-3 text-sm font-extrabold text-black">
          <span className="bg-slate-100 border border-black px-3 py-1 rounded-full">{notifications.filter(n => !n.read).length} Unread</span>
          
          {(profile?.role === "tradesperson" || profile?.role === "business") && (
            <button
              onClick={() => setShowPreferencesModal(true)}
              className="w-10 h-10 rounded-full bg-slate-100 border border-black hover:bg-slate-200 flex items-center justify-center text-black hover:text-blue-600 transition-all active:scale-95 shadow-xs"
              title="Job Match Notification Timing & Settings"
            >
              <Settings className="w-5 h-5 stroke-[2.5]" />
            </button>
          )}

          <button 
            onClick={() => navigate(-1)} 
            className="w-10 h-10 rounded-full bg-slate-100 border border-black hover:bg-slate-200 flex items-center justify-center text-black hover:text-blue-600 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-black rounded-xl text-red-950 text-sm font-black">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {notifications.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white p-12 rounded-2xl border border-black text-center space-y-4 shadow-sm"
            >
              <div className="w-16 h-16 bg-slate-100 border border-black rounded-full flex items-center justify-center mx-auto text-black">
                <Bell className="w-8 h-8 text-black" />
              </div>
              <p className="text-black font-extrabold text-base">No notifications yet.</p>
            </motion.div>
          ) : (
            notifications.map((notification) => {
              const targetRoute = resolveNotificationRoute(notification);
              const actionDetails = getActionButtonDetails(notification, targetRoute);

              return (
                <motion.div
                  key={notification.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onClick={() => handleNotificationCardClick(notification)}
                  className={cn(
                    "bg-white p-4 rounded-2xl border border-black transition-all flex gap-4 items-start group shadow-sm cursor-pointer hover:border-blue-600 hover:shadow-md hover:scale-[1.005] active:scale-[0.995]",
                    notification.read ? "bg-slate-50/90" : "bg-blue-50/50"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-black",
                    notification.read ? "bg-white" : "bg-blue-100"
                  )}>
                    {getIcon(notification.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-black text-black text-base truncate leading-snug group-hover:text-blue-600 transition-colors">
                        {notification.title}
                      </h3>
                      <span className="text-xs text-black font-extrabold flex items-center gap-1 shrink-0 bg-slate-100 border border-black px-2 py-0.5 rounded-md">
                        <Clock className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                        {new Date(notification.createdAt?.toDate?.() || notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-950 font-bold leading-normal">{notification.message}</p>
                    
                    <div className="flex items-center gap-3 pt-2.5 flex-wrap">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNotificationCardClick(notification);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl border border-black shadow-md transition-all hover:scale-[1.02] active:scale-95 cursor-pointer shrink-0"
                      >
                        {actionDetails.icon}
                        <span>{actionDetails.label}</span>
                      </button>

                      {!notification.read && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                          className="text-xs font-black text-black hover:text-blue-700 underline underline-offset-2"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center h-full">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      className="p-2 text-slate-700 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors border border-transparent hover:border-black"
                      title="Delete notification"
                    >
                      <X className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Trader Notification Timing & Radius Preferences Modal */}
      <TraderNotificationPreferencesModal
        isOpen={showPreferencesModal}
        onClose={() => setShowPreferencesModal(false)}
        traderProfile={profile}
      />
    </div>
  );
}


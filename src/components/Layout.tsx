import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Home, Briefcase, MessageSquare, User as UserIcon, PlusCircle, Bell, LogOut, AlertCircle, PoundSterling, Search, Bot, Shield, Users, AlertTriangle, Calendar, X, BarChart3, LayoutGrid, Zap, ShoppingCart, Loader2, ChevronRight, Wrench, Hammer, HardHat, Droplets, Paintbrush, Truck, Scissors, Wind, Thermometer, PenTool, Box, ChevronDown, CreditCard, Menu, Star, MapPin, Repeat, Car, Heart, ShieldAlert, Phone, Download, Ban, Info, Bookmark } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { logout, db, collection, query, where, onSnapshot, handleFirestoreError, OperationType, doc, updateDoc, arrayRemove, orderBy, limit, arrayUnion } from "@/src/firebase";
import { useAuth } from "./AuthProvider";
import { toast } from "sonner";
import React, { useEffect, useState, useRef } from "react";
import { TradeBot } from "./TradeBot";
import { Logo } from "./Logo";
import { AnimatePresence, motion } from "motion/react";
import { setNativeStatusBar, triggerHaptic } from "@/src/lib/capacitor";
import { usePortal } from "../lib/PortalContext";
import PlatformSwitcher from "./shared/PlatformSwitcher";

import RoleTabBar from "./shared/RoleTabBar";

const getIconComponent = (iconName: string) => {
  const icons: any = { Wrench, Hammer, HardHat, Shield, Zap, Droplets, Paintbrush, Truck, Scissors, Wind, Thermometer, Briefcase, PenTool, Box };
  return icons[iconName] || Box;
};

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, isAnonymous, isTradeBotOpen, setIsTradeBotOpen } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadTypes, setUnreadTypes] = useState<Set<string>>(new Set());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [journeys, setJourneys] = useState<any[]>([]);
  const [preferredDrivers, setPreferredDrivers] = useState<any[]>([]);
  const [emergencyContacts, setEmergencyContacts] = useState<any[]>([]);
  const [recentRides, setRecentRides] = useState<any[]>([]);
  const [blockedDrivers, setBlockedDrivers] = useState<string[]>([]);
  const [openSection, setOpenSection] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "users", user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setFavorites(data.favoriteAddresses || []);
        setJourneys(data.regularJourneys || []);
        setPreferredDrivers(data.preferredDrivers || []);
        setEmergencyContacts(data.emergencyContacts || []);
        setBlockedDrivers(data.blockedDrivers || []);
      }
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "ride_requests"),
      where("riderId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(5)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecentRides(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error fetching recent rides:", error);
    });
    return () => unsubscribe();
  }, [user]);
  useEffect(() => {
    setNativeStatusBar(false); // Light mode status bar for the light-themed app
  }, []);

  const [platformConfig, setPlatformConfig] = useState<any>(null);
  const [showMaintenanceBanner, setShowMaintenanceBanner] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  // AI Shop States
  const [showShopPopover, setShowShopPopover] = useState(false);
  const [shopRecommendations, setShopRecommendations] = useState<any[]>([]);
  const [isLoadingShop, setIsLoadingShop] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowShopPopover(false);
      }
    };
    if (showShopPopover) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showShopPopover]);

  const loadShopRecommendations = async () => {
    setShowShopPopover(true);
    if (shopRecommendations.length > 0) return; // already loaded

    setIsLoadingShop(true);
    try {
      const res = await fetch("/api/shop-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: profile?.role || "general",
          category: profile?.category || profile?.businessCategory || "general"
        })
      });
      const data = await res.json();
      if (data.recommendations) {
        setShopRecommendations(data.recommendations);
      }
    } catch (err) {
      console.error("Failed to load shop recommendations:", err);
    } finally {
      setIsLoadingShop(false);
    }
  };

  const enterShop = async (category?: string) => {
    try {
      setIsLoadingShop(true);
      const res = await fetch("/api/sso-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: user?.uid,
          role: profile?.role,
          email: user?.email,
          category: profile?.category || profile?.businessCategory
        })
      });
      const data = await res.json();
      
      let shopUrl = `https://shop.tradequote.uk/?token=${data.token}`;
      if (category) shopUrl += `&category=${encodeURIComponent(category)}`;
      
      window.open(shopUrl, "_blank");
      setShowShopPopover(false);
    } catch (err) {
      console.error("Failed to generate SSO token:", err);
      // Fallback redirection
      window.open(`https://shop.tradequote.uk/?uid=${user?.uid}`, "_blank");
    } finally {
      setIsLoadingShop(false);
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "platform_config", "global"), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setPlatformConfig(data);
        
        // Check if banner should be shown
        if (data.scheduledMaintenance?.enabled) {
          const dismissalKey = `maintenance_dismissed_${data.scheduledMaintenance.time}`;
          const isDismissed = localStorage.getItem(dismissalKey);
          if (!isDismissed) {
            setShowMaintenanceBanner(true);
          }
        } else {
          setShowMaintenanceBanner(false);
        }
      }
    });
    return () => unsub();
  }, []);

  const dismissMaintenanceBanner = () => {
    if (platformConfig?.scheduledMaintenance?.time) {
      const dismissalKey = `maintenance_dismissed_${platformConfig.scheduledMaintenance.time}`;
      localStorage.setItem(dismissalKey, "true");
    }
    setShowMaintenanceBanner(false);
  };

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      where("read", "==", false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date();
      const types = new Set<string>();
      const visibleUnread = snapshot.docs.filter(doc => {
        const data = doc.data();
        if (!data.visibleAt) {
          if (data.type) types.add(data.type);
          return true;
        }
        const visibleAt = data.visibleAt.toDate ? data.visibleAt.toDate() : new Date(data.visibleAt);
        if (visibleAt <= now) {
          if (data.type) types.add(data.type);
          return true;
        }
        return false;
      });
      setUnreadCount(visibleUnread.length);
      setUnreadTypes(types);
    }, (error) => {
      console.error("Error fetching unread notifications:", error);
      handleFirestoreError(error, OperationType.LIST, "notifications");
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = "/";
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const { activePortal, switchPortal, activeRole } = usePortal();

  // Keep routing somewhat hardened to portal
  useEffect(() => {
    // List of exclusive AnyRide paths
    if (location.pathname === "/book-ride" || location.pathname === "/driver-terminal") {
      if (activePortal !== "anyride") switchPortal("anyride");
    } 
    // Example of exclusive AnyTrader paths
    else if (location.pathname === "/job-feed" || location.pathname === "/post-job") {
      if (activePortal !== "anytrader") switchPortal("anytrader");
    }
  }, [location.pathname, activePortal, switchPortal]);

  const homeownerNav = [
    { name: "Home", path: "/", icon: Home, isCta: false },
    { name: "Find Trades", path: "/find-trades", icon: Search, isCta: false },
    { name: "Post Job", path: "/post-job", icon: PlusCircle, isCta: true },
    { name: "My Jobs", path: "/my-jobs", icon: Briefcase, isCta: false },
    { name: "Messages", path: "/messages", icon: MessageSquare, isCta: false },
    { name: "Billing", path: "/billing", icon: PoundSterling, isCta: false },
  ];

  const tradespersonNav = [
    { name: "Home", path: "/", icon: Home, isCta: false },
    { name: "Find Work", path: "/job-feed", icon: Briefcase, isCta: false },
    { name: "Hire Trades", path: "/find-trades", icon: Search, isCta: false },
    { name: "Messages", path: "/messages", icon: MessageSquare, isCta: false },
    { name: "My Quotes", path: "/my-quotes?mode=active", icon: PoundSterling, isCta: false },
    { name: "Billing", path: "/billing", icon: CreditCard, isCta: false },
  ];

  const adminNav = [
    { name: "Dashboard", path: "/admin", icon: Shield, isCta: false },
    { name: "Users", path: "/admin?tab=users", icon: Users, isCta: false },
    { name: "Jobs", path: "/admin?tab=jobs", icon: Briefcase, isCta: false },
    { name: "Disputes", path: "/admin?tab=disputes", icon: AlertTriangle, isCta: false },
    { name: "Ecosystem", path: "/ecosystem", icon: Zap, isCta: false },
  ];

  const ecosystemNav = [
    { name: "Ecosystem", path: "/ecosystem", icon: Zap, isCta: false },
    { name: "Messages", path: "/messages", icon: MessageSquare, isCta: false },
  ];

  const businessNav = [
    { name: "HQ", path: "/", icon: Home, isCta: false },
    { name: "Portfolio", path: "/portfolio", icon: LayoutGrid, isCta: false },
    { name: "Projects", path: "/my-jobs", icon: Briefcase, isCta: false },
    { name: "Post Project", path: "/post-job", icon: PlusCircle, isCta: true },
    { name: "Analytics", path: "/analytics", icon: BarChart3, isCta: false },
    { name: "Messages", path: "/messages", icon: MessageSquare, isCta: false },
  ];

  const driverNav = [
    { name: "Terminal", path: "/driver-terminal", icon: Zap, isCta: false },
    { name: "Earnings", path: "/driver-terminal?tab=earnings", icon: PoundSterling, isCta: false },
    { name: "Messages", path: "/driver-terminal?tab=inbox", icon: MessageSquare, isCta: false },
    { name: "Menu", path: "/driver-terminal?tab=menu", icon: Menu, isCta: false },
  ];

  const passengerNav = [
    { name: "Book Ride", path: "/book-ride", icon: Car, isCta: false },
    { name: "My Rides", path: "/my-rides", icon: MapPin, isCta: false },
    { name: "Saved", path: "/saved-journeys", icon: Bookmark, isCta: false },
    { name: "Messages", path: "/messages", icon: MessageSquare, isCta: false },
    { name: "Menu", path: "/profile", icon: Menu, isCta: false },
  ];

  let navItems;
  if (activeRole === "admin") {
    navItems = adminNav;
  } else if (activeRole === "ecosystem_manager") {
    navItems = ecosystemNav;
  } else if (activePortal === "anyride") {
    navItems = activeRole === "driver" ? driverNav : passengerNav;
  } else {
    if (activeRole === "business") {
      navItems = businessNav;
    } else if (activeRole === "trader") {
      navItems = tradespersonNav;
    } else {
      navItems = homeownerNav;
    }
  }

  // Hide the sidebars if on map
  const isMapUX = (activePortal === "anyride" && activeRole === "customer");
  
  const isDriverTerminal = activeRole === "driver" && activePortal === "anyride";

  return (
    <div className={cn("min-h-screen flex flex-col", isDriverTerminal ? "bg-[#0D0D0F] text-white" : "bg-surface")}>
      {/* Scheduled Maintenance Banner */}
      {showMaintenanceBanner && platformConfig?.scheduledMaintenance && (
        <div className="bg-primary text-white px-4 py-3 flex items-center justify-between gap-4 shadow-lg z-[60]">
          <div className="flex items-center gap-3 max-w-4xl mx-auto">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">Scheduled Maintenance</p>
              <p className="text-xs opacity-90">{platformConfig.scheduledMaintenance.message}</p>
            </div>
          </div>
          <button 
            onClick={dismissMaintenanceBanner}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Guest Banner */}
      {isAnonymous && (
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center justify-center gap-2 text-amber-800 text-xs font-medium">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          <span>You are using a guest account. Sign up to save your data permanently.</span>
          <Link to="/profile" className="underline font-bold hover:text-amber-900 ml-1">
            Go to Profile
          </Link>
        </div>
      )}

      {/* Header */}
      {!isDriverTerminal && activePortal !== 'anyride' && (
      <header className="glass sticky top-0 z-50">
          <div className="max-w-7xl auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4 sm:gap-8">
              {activePortal === "anyride" && (
                <button 
                  onClick={() => {
                    triggerHaptic();
                    setIsMenuOpen(true);
                  }}
                  className="p-2 -ml-2 text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <Menu className="w-6 h-6" />
                </button>
              )}
              <Link to="/" className="flex items-center gap-3 group">
                <div className="w-11 h-11 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform duration-500">
                  <Logo size={32} className="text-white" />
                </div>
                <div className="hidden sm:block">
                  <span className="text-xl font-display font-black text-slate-900 tracking-tight">AnyTrader</span>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest -mt-1">Every Skill</p>
                </div>
              </Link>

              {/* Desktop Navigation */}
              {activePortal !== 'anyride' && (
                <nav className="hidden md:flex items-center gap-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname + location.search === item.path || (item.path === "/admin" && location.pathname === "/admin" && (!location.search || location.search === "?tab=users"));
                    
                    let hasUnread = false;
                    if (item.path === "/job-feed" && unreadTypes.has("system")) hasUnread = true;
                    if (item.path === "/messages" && unreadTypes.has("message")) hasUnread = true;
                    if (item.path.startsWith("/my-quotes") && unreadTypes.has("quote")) hasUnread = true;
                    if (item.path === "/my-jobs" && (unreadTypes.has("quote") || unreadTypes.has("status"))) hasUnread = true;

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all relative",
                          isActive 
                            ? "bg-primary/10 text-primary" 
                            : "text-slate-500 hover:text-slate-900 hover:bg-slate-100",
                          item.isCta && "bg-primary text-white hover:bg-primary-hover hover:text-white ml-2 shadow-lg shadow-primary/20"
                        )}
                      >
                        <div className="relative">
                          <Icon className={cn("w-4 h-4", item.isCta && "w-5 h-5")} />
                          {hasUnread && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                          )}
                        </div>
                        {item.name}
                      </Link>
                    );
                  })}
                </nav>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
            {profile?.role && (
              <span className="text-[9px] font-black uppercase text-primary bg-primary/5 px-2.5 py-1 rounded-lg border border-primary/10 tracking-wider">
                {profile.role}
              </span>
            )}
            
            {/* AI Smart Shop Button & Popover */}
            {(profile?.role === "tradesperson" || profile?.subscriptionType === "business") && (
              <div className="relative" ref={popoverRef}>
                <button 
                  onClick={loadShopRecommendations}
                  className={cn(
                    "w-8 h-8 rounded-full shadow-[inset_0_-2px_4px_rgba(0,0,0,0.2),0_4px_8px_rgba(0,0,0,0.1)] flex items-center justify-center text-white transition-all active:translate-y-0.5 active:shadow-[inset_0_-1px_2px_rgba(0,0,0,0.3),0_2px_4px_rgba(0,0,0,0.1)] relative",
                    showShopPopover ? "bg-blue-600 scale-105" : "bg-blue-500 hover:bg-blue-600 hover:scale-105"
                  )}
                  title="Trade Equipment Shop"
                >
                  <ShoppingCart className="w-4 h-4 fill-white stroke-white" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                </button>

                <AnimatePresence>
                  {showShopPopover && (
                    <motion.div
                      key="shop-popover"
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute top-full right-0 mt-3 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 origin-top-right"
                    >
                      <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <ShoppingCart className="w-4 h-4 text-blue-500" />
                            AI Smart Shop
                          </h3>
                          <p className="text-[10px] uppercase font-bold text-slate-400 mt-0.5 tracking-wider">Curated for your trade</p>
                        </div>
                        <button onClick={() => setShowShopPopover(false)} className="text-slate-400 hover:text-slate-900">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="p-2 space-y-1">
                        {isLoadingShop ? (
                          <div className="py-8 flex flex-col items-center justify-center text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3 ml-2" />
                            <p className="text-xs font-bold uppercase tracking-wider">Analyzing your profile...</p>
                            <p className="text-[10px] mt-1 text-slate-400">Scanning deals for {profile?.category || "your trade"}</p>
                          </div>
                        ) : (
                          <>
                            {shopRecommendations.map((rec, idx) => {
                              const RecommendationIcon = getIconComponent(rec.icon);
                              return (
                                <button 
                                  key={`rec-${idx}-${rec.name}`}
                                  onClick={() => enterShop(rec.name)}
                                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-blue-50 transition-colors group cursor-pointer w-full"
                                >
                                  <div className="w-10 h-10 rounded-lg bg-white border border-slate-100 shadow-sm flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform group-hover:border-blue-200 group-hover:shadow-blue-100">
                                    <RecommendationIcon className="w-5 h-5 text-slate-600 group-hover:text-blue-600" />
                                  </div>
                                  <div className="flex-1 min-w-0 text-left">
                                    <p className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-700">{rec.name}</p>
                                    <p className="text-xs text-slate-500 mt-0.5 leading-tight">{rec.reason}</p>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all mt-3 shrink-0" />
                                </button>
                              );
                            })}
                          </>
                        )}
                      </div>

                      <div className="p-3 bg-slate-50 border-t border-slate-100">
                        <button 
                          onClick={() => enterShop()}
                          className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          Browse Full Store <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <button 
              onClick={() => setIsTradeBotOpen(true)}
              className="p-2 text-slate-500 hover:text-primary transition-colors relative group"
              title="AnyTrader Assistant"
            >
              <Bot className="w-6 h-6" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-white group-hover:scale-125 transition-transform" />
            </button>
            <Link 
              to="/notifications" 
              className="p-2 text-slate-500 hover:text-slate-900 relative"
            >
              <Bell className="w-6 h-6" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
            <Link to="/profile" className="w-8 h-8 bg-slate-200 rounded-full overflow-hidden border border-slate-300 flex items-center justify-center text-slate-400">
              {user?.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt="User" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <UserIcon className="w-5 h-5" />
              )}
            </Link>
            <button 
              onClick={() => setShowLogoutConfirm(true)}
              className="p-2 text-slate-500 hover:text-red-600 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
                <LogOut className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Sign Out</h3>
                <p className="text-slate-500 mt-2">Are you sure you want to sign out of your account?</p>
              </div>
              <div className="flex gap-3 w-full pt-4">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 p-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 p-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={cn(
        "flex-1 w-full relative min-h-0",
        isDriverTerminal ? "pb-60 p-0 h-[100dvh] flex flex-col overflow-hidden" : (activePortal === 'anyride' ? "pb-60 sm:pb-6 p-0 h-[100dvh] flex flex-col overflow-hidden" : "max-w-7xl mx-auto px-4 py-6 pb-60 sm:pb-6")
      )}>
        {(!isDriverTerminal && activePortal !== 'anyride') && <RoleTabBar />}
        <Outlet />
      </main>

      {/* Sandwich Menu Sidebar */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            key="drawer-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[60]"
          />
        )}
        {isMenuOpen && (
          <motion.div 
            key="drawer-content"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 w-52 bg-white shadow-2xl z-[70] overflow-y-auto overflow-x-hidden"
          >
            <div className="p-3 space-y-5">
                <div className="flex items-center justify-between">
                  <Logo className="h-6" />
                  <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Account Health Section */}
                  <div className="bg-slate-900 rounded-[16px] p-3 mx-1 w-[140px] text-white shadow-lg shadow-slate-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[8px] font-black uppercase tracking-[0.1em] opacity-60">Passenger Rating</span>
                      <ShieldAlert className="w-3 h-3 text-emerald-400" />
                    </div>
                    <div className="flex items-end gap-1.5">
                       <span className="text-2xl font-black leading-none">⭐ {profile?.homeownerRating || "5.0"}</span>
                       <span className="text-[10px] font-bold opacity-60 pb-0.5">/ 5.0</span>
                    </div>
                    <p className="text-[8px] font-bold text-emerald-400 mt-1 uppercase tracking-widest">
                       Elite Helper
                    </p>
                  </div>

                  {/* Favorites Section */}
                  <div className="space-y-2">
                    <button 
                       onClick={() => setOpenSection(openSection === "places" ? null : "places")}
                       className="w-full flex items-center justify-between px-2 py-2 hover:bg-slate-50 rounded-xl transition-colors group"
                    >
                      <div className="flex items-center gap-2 text-slate-400 group-hover:text-slate-600">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Saved Places</span>
                      </div>
                      <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform duration-200", openSection === "places" && "rotate-180")} />
                    </button>
                    
                    <AnimatePresence initial={false}>
                      {openSection === "places" && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden space-y-2 px-1"
                        >
                          {favorites.length === 0 && journeys.length === 0 && (
                            <p className="text-xs text-slate-400 font-medium p-2 italic">Nothing saved yet.</p>
                          )}
                          
                          {favorites.slice(0, 3).map((fav, idx) => (
                            <button 
                              key={`fav-${idx}`}
                              onClick={() => { navigate(`/book-ride?pickup=${encodeURIComponent(fav.address)}`); setIsMenuOpen(false); }}
                              className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3 hover:bg-slate-100 transition-all group"
                            >
                              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                                <MapPin className="w-4 h-4 text-indigo-500" />
                              </div>
                              <div className="text-left flex-1 min-w-0">
                                <p className="font-bold text-slate-900 text-xs truncate">{fav.name}</p>
                              </div>
                            </button>
                          ))}

                          {journeys.slice(0, 2).map((j, idx) => (
                            <button 
                              key={`journey-${idx}`}
                              onClick={() => { navigate(`/book-ride?pickup=${encodeURIComponent(j.from)}&dropoff=${encodeURIComponent(j.to)}&comments=${encodeURIComponent(j.comments || "")}`); setIsMenuOpen(false); }}
                              className="w-full p-2.5 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-3 hover:bg-indigo-100 transition-all group"
                            >
                              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm text-indigo-500">
                                <Repeat className="w-4 h-4" />
                              </div>
                              <div className="text-left flex-1 min-w-0">
                                <p className="font-bold text-slate-900 text-xs truncate whitespace-pre-wrap leading-tight">{j.name}</p>
                              </div>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Preferred Drivers Section */}
                  <div className="space-y-2 pt-2">
                    <button 
                       onClick={() => setOpenSection(openSection === "drivers" ? null : "drivers")}
                       className="w-full flex items-center justify-between px-2 py-2 hover:bg-slate-50 rounded-xl transition-colors group"
                    >
                      <div className="flex items-center gap-2 text-slate-400 group-hover:text-slate-600">
                        <Heart className="w-4 h-4 fill-red-400 text-red-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Favorite Drivers</span>
                      </div>
                      <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform duration-200", openSection === "drivers" && "rotate-180")} />
                    </button>
                    
                    <AnimatePresence initial={false}>
                      {openSection === "drivers" && (
                        <motion.div 
                           initial={{ height: 0, opacity: 0 }}
                           animate={{ height: "auto", opacity: 1 }}
                           exit={{ height: 0, opacity: 0 }}
                           transition={{ duration: 0.2 }}
                           className="overflow-hidden"
                        >
                          {preferredDrivers.length === 0 ? (
                            <p className="text-xs text-slate-400 font-medium p-2 italic">Add drivers after 5-star rides.</p>
                          ) : (
                            <div className="flex gap-2 overflow-x-auto no-scrollbar px-1 pb-1 pt-1">
                              {preferredDrivers.map((driver, idx) => (
                                <button 
                                  key={`driver-${idx}`}
                                  onClick={() => navigate(`/profile/${driver.uid}`)}
                                  className="shrink-0 flex flex-col items-center gap-1.5 p-2 bg-slate-50 border border-slate-100 rounded-2xl min-w-[70px] hover:bg-slate-100 transition-colors"
                                >
                                  <img src={driver.avatarUrl || `https://ui-avatars.com/api/?name=${driver.name}`} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" alt={driver.name} referrerPolicy="no-referrer" />
                                  <span className="text-[10px] font-bold text-slate-700 truncate w-full text-center">{driver.name.split(' ')[0]}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Recent Trips Section */}
                  <div className="space-y-2 pt-2">
                    <button 
                       onClick={() => setOpenSection(openSection === "activity" ? null : "activity")}
                       className="w-full flex items-center justify-between px-2 py-2 hover:bg-slate-50 rounded-xl transition-colors group"
                    >
                       <div className="flex items-center gap-2 text-slate-400 group-hover:text-slate-600">
                         <Car className="w-4 h-4 text-blue-500" />
                         <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Recent Activity</span>
                       </div>
                       <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform duration-200", openSection === "activity" && "rotate-180")} />
                    </button>
                    
                    <AnimatePresence initial={false}>
                      {openSection === "activity" && (
                        <motion.div 
                           initial={{ height: 0, opacity: 0 }}
                           animate={{ height: "auto", opacity: 1 }}
                           exit={{ height: 0, opacity: 0 }}
                           transition={{ duration: 0.2 }}
                           className="overflow-hidden space-y-2 px-1"
                        >
                       {recentRides.map((ride, idx) => (
                         <div key={`ride-${idx}`} className="p-3 bg-white border border-slate-100 rounded-2xl space-y-2 group relative">
                            <div className="flex items-center justify-between">
                               <span className={cn(
                                 "text-[8px] font-black uppercase px-2 py-0.5 rounded-full",
                                 ride.status === "completed" ? "bg-emerald-100 text-emerald-700" : (ride.status === "cancelled" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700")
                               )}>
                                 {ride.status}
                               </span>
                               <span className="text-[9px] font-bold text-slate-400">{ride.createdAt?.toDate ? new Date(ride.createdAt.toDate()).toLocaleDateString() : 'Pending'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                               <div className="w-6 h-6 bg-slate-50 rounded flex items-center justify-center text-[10px] font-black text-slate-400">#</div>
                               <p className="text-[10px] font-bold text-slate-600 truncate flex-1">{ride.rideType === "hourly" ? `${ride.duration}h Hourly Ride` : ride.dropoff}</p>
                            </div>
                            <div className="flex items-center gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 bottom-2">
                               <button onClick={() => toast.success("Receipt downloaded!")} className="p-1.5 bg-slate-50 rounded-lg text-slate-400 hover:text-blue-500 transition-colors" title="Download Receipt">
                                  <Download className="w-3 h-3" />
                               </button>
                               <button onClick={() => navigate(`/profile/${ride.driverId}`)} className="p-1.5 bg-slate-50 rounded-lg text-slate-400 hover:text-indigo-500 transition-colors" title="View Driver">
                                  <Users className="w-3 h-3" />
                               </button>
                               <button 
                                 onClick={async () => {
                                   if (!user || !ride.driverId) return;
                                   const isFav = preferredDrivers.some(d => d.uid === ride.driverId);
                                   if (isFav) {
                                      // Remove favorite
                                      const newFavs = preferredDrivers.filter(d => d.uid !== ride.driverId);
                                      await updateDoc(doc(db, "users", user.uid), { preferredDrivers: newFavs });
                                      toast.success("Removed from Favorite Drivers");
                                   } else {
                                      // Add favorite
                                      await updateDoc(doc(db, "users", user.uid), { 
                                        preferredDrivers: arrayUnion({
                                          uid: ride.driverId,
                                          name: ride.driverName || "Driver",
                                          avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(ride.driverName || "Driver")}`
                                        }) 
                                      });
                                      toast.success("Driver added to Favorites");
                                   }
                                 }} 
                                 className={cn("p-1.5 bg-slate-50 rounded-lg transition-colors", preferredDrivers.some(d => d.uid === ride.driverId) ? "text-red-500 hover:text-red-600" : "text-slate-400 hover:text-red-500")} 
                                 title={preferredDrivers.some(d => d.uid === ride.driverId) ? "Remove Favorite" : "Favorite Driver"}
                               >
                                  <Heart className="w-3 h-3" fill={preferredDrivers.some(d => d.uid === ride.driverId) ? "currentColor" : "none"} />
                               </button>
                               <button 
                                 onClick={async () => {
                                   if (!user || !ride.driverId) return;
                                   if (confirm("Block this driver from future rides?")) {
                                     await updateDoc(doc(db, "users", user.uid), { blockedDrivers: arrayUnion(ride.driverId) });
                                     toast.success("Driver blocked");
                                   }
                                 }} 
                                 className="p-1.5 bg-slate-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors" 
                                 title="Block Driver"
                               >
                                  <Ban className="w-3 h-3" />
                               </button>
                            </div>
                         </div>
                       ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Safety Section */}
                  <div className="space-y-2 pt-2">
                    <button 
                       onClick={() => setOpenSection(openSection === "safety" ? null : "safety")}
                       className="w-full flex items-center justify-between px-2 py-2 hover:bg-slate-50 rounded-xl transition-colors group"
                    >
                      <div className="flex items-center gap-2 text-slate-400 group-hover:text-slate-600">
                        <ShieldAlert className="w-4 h-4 text-orange-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Safety & Emergency</span>
                      </div>
                      <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform duration-200", openSection === "safety" && "rotate-180")} />
                    </button>
                    
                    <AnimatePresence initial={false}>
                      {openSection === "safety" && (
                        <motion.div 
                           initial={{ height: 0, opacity: 0 }}
                           animate={{ height: "auto", opacity: 1 }}
                           exit={{ height: 0, opacity: 0 }}
                           transition={{ duration: 0.2 }}
                           className="overflow-hidden space-y-2 px-1"
                        >
                    {emergencyContacts.length === 0 ? (
                      <button 
                        onClick={() => navigate("/profile")}
                        className="w-full p-3 bg-orange-50 border border-orange-100 rounded-2xl flex items-center gap-3 text-orange-700"
                      >
                         <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                            <Phone className="w-4 h-4" />
                         </div>
                         <div className="text-left">
                            <p className="font-bold text-xs">Add Emergency Contacts</p>
                            <p className="text-[9px] opacity-70 uppercase tracking-widest font-black">Safety First</p>
                         </div>
                      </button>
                    ) : (
                      <div className="space-y-2">
                        {emergencyContacts.map((contact, i) => (
                           <div key={`contact-${i}`} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                              <p className="font-bold text-slate-900 text-xs">{contact.name}</p>
                              <a href={`tel:${contact.phone}`} className="p-2 bg-white rounded-xl shadow-sm text-blue-600">
                                 <Phone className="w-3 h-3" />
                              </a>
                           </div>
                        ))}
                      </div>
                    )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                     <button 
                       onClick={() => toast.info("Lost & Found report service coming soon. Please contact live support for immediate assistance.")}
                       className="w-full p-3 flex items-center gap-3 text-slate-500 hover:text-slate-900 transition-colors"
                     >
                        <Info className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold">Lost & Found</span>
                     </button>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      setShowLogoutConfirm(true);
                    }}
                    className="w-full p-4 flex items-center gap-3 text-red-500 font-bold hover:bg-red-50 rounded-2xl transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </motion.div>
        )}
      </AnimatePresence>

      <TradeBot isOpen={isTradeBotOpen} onClose={() => setIsTradeBotOpen(false)} />

      {/* Bottom Navigation (Mobile) */}
      {navItems && navItems.length > 0 && !location.pathname.startsWith('/post-job') && !location.pathname.startsWith('/post-emergency-job') && (
        <nav className={cn(
          "sm:hidden fixed bottom-0 left-0 right-0 w-full bg-white/95 backdrop-blur-xl shadow-[0_-8px_30px_rgba(0,0,0,0.08)] border-t px-4 pb-[env(safe-area-inset-bottom)] h-[calc(4rem+env(safe-area-inset-bottom))] flex items-center justify-around z-[100] transition-colors",
          isDriverTerminal ? "bg-[#1A1A1E] border-[#2C2C30]" : "bg-white border-slate-200"
        )}>
          {navItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = location.pathname + location.search === item.path || (item.path === "/admin" && location.pathname === "/admin" && (!location.search || location.search === "?tab=users"));
            
            let hasUnread = false;
            if (item.path === "/job-feed" && unreadTypes.has("system")) hasUnread = true;
            if (item.path === "/messages" && unreadTypes.has("message")) hasUnread = true;
            if (item.path.startsWith("/my-quotes") && unreadTypes.has("quote")) hasUnread = true;
            if (item.path === "/my-jobs" && (unreadTypes.has("quote") || unreadTypes.has("status"))) hasUnread = true;

            return (
              <Link
                key={`nav-${idx}-${item.path}`}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 transition-colors relative h-full px-2",
                  isActive 
                    ? (isDriverTerminal ? "text-white" : "text-blue-600 font-bold") 
                    : (isDriverTerminal ? "text-[#6B6B73] hover:text-[#A0A0A8]" : "text-slate-500 hover:text-slate-900"),
                  item.isCta && "text-blue-600"
                )}
              >
                <div className="relative">
                  <Icon className={cn(isActive ? "w-6 h-6" : "w-5 h-5", item.isCta && "w-7 h-7")} />
                  {hasUnread && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                  )}
                </div>
                <span className="text-[10px] font-medium tracking-tight">{item.name}</span>
                {isActive && (
                   <motion.div 
                     layoutId="navDot"
                     className={cn("absolute bottom-1 w-1 h-1 rounded-full", isDriverTerminal ? "bg-white" : "bg-blue-600")}
                   />
                )}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

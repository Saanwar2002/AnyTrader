import React from "react";
import { useAuth } from "../AuthProvider";
import { logout, db, doc, updateDoc } from "@/src/firebase";
import { ChevronRight, User, Car, BarChart3, Clock, CreditCard, Zap, Share2, Settings, HelpCircle, ShieldCheck, MapPin, X, Repeat, Power } from "lucide-react";
import { cn } from "@/src/lib/utils";

export default function DriverMenu({ 
  onNavigate, 
  commissionRate = 0.12,
  isOnline = false,
  onToggleOnline,
  onClose
}: { 
  onNavigate: (tab: string) => void, 
  commissionRate?: number,
  isOnline?: boolean,
  onToggleOnline?: () => void,
  onClose?: () => void
}) {
  const { profile } = useAuth();

  const [confirmLastJob, setConfirmLastJob] = React.useState(false);

  const handleLastJobToggle = () => {
    if (profile?.isLastJob) {
      updateDoc(doc(db, "users", profile?.userId || ''), { isLastJob: false });
      setConfirmLastJob(false);
    } else {
      if (confirmLastJob) {
        updateDoc(doc(db, "users", profile?.userId || ''), { isLastJob: true });
        setConfirmLastJob(false);
      } else {
        setConfirmLastJob(true);
        setTimeout(() => setConfirmLastJob(false), 3000);
      }
    }
  };

  const sections = [
    {
      title: "Navigation & Earnings",
      items: [
        { icon: BarChart3, label: "Analytics", desc: "Performance & trends", color: "text-[#00D26A]", bg: "bg-[#00D26A]/10" },
        { icon: Clock, label: "Availability Hours", desc: "Set schedule & see demand", color: "text-[#007AFF]", bg: "bg-[#007AFF]/10" },
        { icon: MapPin, label: "My Zones", desc: "Preferred driving areas", color: "text-[#E4E4E7]", bg: "bg-white/5" },
      ]
    },
    {
      title: "Vehicle & Profile",
      items: [
        { icon: User, label: "Driver Profile", desc: `⭐ ${profile?.rating?.toFixed(1) || '4.9'} • Active Driver`, color: "text-white", bg: "bg-white/10", id: "profile" },
        { icon: Car, label: "Vehicle & Documents", desc: profile?.documentsComplete ? "All clear" : "1 action required", color: profile?.documentsComplete ? "text-[#00D26A]" : "text-[#FF3B30]", bg: profile?.documentsComplete ? "bg-[#00D26A]/10" : "bg-[#FF3B30]/10", alert: !profile?.documentsComplete, id: "documents" },       
      ]
    },
    {
      title: "AnyTrader Ecosystem",
      items: [
        { icon: Zap, label: "My Trade Profile", desc: "Switch to trade leads", color: "text-[#AF52DE]", bg: "bg-[#AF52DE]/10", type: 'button' },
        { icon: ShieldCheck, label: "Mechanic Quotes", desc: "Fix your vehicle", color: "text-[#FF9500]", bg: "bg-[#FF9500]/10", type: 'button' },
      ]
    },
    {
      title: "Ride Preferences (Active Ride)",
      items: [
        { icon: Repeat, label: "Ride Stacking", desc: "Receive offers during trip", color: "text-[#00D26A]", bg: "bg-white/5", type: 'toggle', action: 'toggle-stacking', active: profile?.isStackingEnabled !== false },
        { icon: MapPin, label: "Destination Mode", desc: profile?.destinationModeActive ? "Active: Toward Home" : "Off", color: "text-[#AF52DE]", bg: "bg-white/5", type: 'toggle', action: 'toggle-destination-mode', active: profile?.destinationModeActive === true },
      ]
    },
    {
      title: "Account",
      items: [
        { icon: CreditCard, label: "Platform Fee", desc: `Fixed at ${(commissionRate * 100).toFixed(0)}%`, color: "text-[#E4E4E7]", bg: "bg-white/5", type: 'text' },
        { icon: Settings, label: "Settings", desc: "App & privacy", color: "text-[#E4E4E7]", bg: "bg-white/5", id: "settings", type: 'button' },
        { icon: HelpCircle, label: "Help Center", desc: "Support", color: "text-[#E4E4E7]", bg: "bg-white/5", type: 'button' },
      ]
    }
  ];

  return (
    <div className="flex-1 bg-[#0D0D0F] text-white overflow-y-auto px-4 py-8 font-sans pb-24 min-h-0">
      
      {/* Header / Profile Summary */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#252529] rounded-full flex items-center justify-center font-black text-2xl text-white border border-[#2C2C30]">
            {profile?.firstName?.[0] || "D"}
          </div>
          <div>
            <h1 className="text-xl font-black text-white">{profile?.firstName} {profile?.lastName}</h1>
            <p className="text-[10px] text-[#00D26A] font-black uppercase tracking-widest mt-1 flex items-center gap-2">
              <ShieldCheck className="w-3 h-3" /> Fully Verified
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
            <button 
              onClick={onToggleOnline}
              className={cn(
                "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95",
                isOnline 
                  ? "bg-[#FF3B30] text-white shadow-red-500/20" 
                  : "bg-[#00D26A] text-[#0D0D0F] shadow-emerald-500/20"
              )}
            >
              {isOnline ? "Go Offline" : "Go Online"}
            </button>
            
            {onClose && (
              <button onClick={onClose} className="w-10 h-10 flex shrink-0 items-center justify-center bg-[#1A1A1E] rounded-full border border-[#2C2C30] text-[#A1A1AA] hover:text-white transition-colors cursor-pointer active:scale-95">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          
          {/* Last Job Toggle */}
          {isOnline && (
            <button 
              onClick={handleLastJobToggle}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors border",
                profile?.isLastJob 
                  ? "bg-[#FF3B30]/10 border-[#FF3B30]/30 text-[#FF3B30]" 
                  : confirmLastJob
                    ? "bg-[#FF9500]/10 border-[#FF9500]/30 text-[#FF9500]"
                    : "bg-white/5 border-white/10 text-white/70 hover:text-white"
              )}
            >
              <Power className="w-3.5 h-3.5" />
              {profile?.isLastJob 
                ? "Last Job Active" 
                : confirmLastJob 
                  ? "Tap to Confirm" 
                  : "My Last Job"}
            </button>
          )}
        </div>
      </div>

      {/* Stripe Connect Onboarding Wizard */}
      {!profile?.stripeAccountId ? (
        <div className="bg-[#1A1A1E] border-2 border-[#AF52DE]/30 rounded-3xl p-6 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#AF52DE]/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-[#AF52DE]/20 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-[#AF52DE]" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-tight">Payments Setup Required</h3>
              <p className="text-[11px] text-[#E4E4E7] font-bold">Connect Stripe to receive instant payouts</p>
            </div>
          </div>
          <button className="w-full py-3.5 bg-[#AF52DE] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_4px_15px_rgba(175,82,222,0.3)] active:scale-95 transition-transform">
            Start Setup Wizard
          </button>
        </div>
      ) : (
        <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-3xl p-5 mb-8 flex items-center justify-between">
           <div className="flex items-center gap-4">
             <div className="w-10 h-10 rounded-full bg-[#007AFF]/10 flex items-center justify-center">
               <ShieldCheck className="w-5 h-5 text-[#007AFF]" />
             </div>
             <div>
               <p className="text-[10px] font-black text-[#A1A1AA] uppercase tracking-widest leading-none mb-1">Stripe Connected</p>
               <p className="text-sm font-black text-white tracking-tight">**** 4242</p>
             </div>
           </div>
           <button className="text-[10px] font-black text-[#E4E4E7] uppercase tracking-widest border border-[#2C2C30] px-3 py-1.5 rounded-lg active:bg-[#252529]">
             Manage
           </button>
        </div>
      )}

      {/* Referral Banner */}
      <div className="bg-gradient-to-r from-[#00D26A]/20 to-[#007AFF]/20 border border-[#00D26A]/30 rounded-2xl p-4 mb-8 flex items-center justify-between active:scale-[0.98] transition-transform">
        <div>
          <h3 className="font-black text-white uppercase tracking-tight">Earn £25</h3>
          <p className="text-xs text-[#E4E4E7] font-bold mt-0.5">Invite a driver or trader</p>
        </div>
        <div className="bg-white text-[#0D0D0F] p-2 rounded-full">
          <Share2 className="w-5 h-5" />
        </div>
      </div>

      {/* Menu Categories */}
      <div className="space-y-6">
        {sections.map((section, idx) => (
          <div key={idx}>
            <p className="text-[10px] font-black uppercase text-[#A1A1AA] tracking-widest px-2 mb-2">{section.title}</p>
            <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-2xl overflow-hidden shadow-sm">
              {section.items.map((item: any, idxi) => {
                const Icon = item.icon;
                return (
                  <button 
                    key={idxi}
                    onClick={() => {
                      if (item.type === 'toggle') {
                        if (item.action === 'toggle-stacking') {
                          updateDoc(doc(db, "users", profile?.userId || ''), { isStackingEnabled: !item.active });
                        }
                        if (item.action === 'toggle-destination-mode') {
                          updateDoc(doc(db, "users", profile?.userId || ''), { destinationModeActive: !item.active });
                        }
                        if (item.action === 'toggle-last-job') {
                          updateDoc(doc(db, "users", profile?.userId || ''), { isLastJob: !item.active });
                        }
                      } else {
                        item.id && onNavigate(item.id);
                      }
                    }}
                    className={cn(
                      "w-full flex items-center justify-between p-4 bg-transparent outline-none active:bg-[#252529] transition-colors text-left disabled:opacity-50",
                      idxi !== section.items.length - 1 ? "border-b border-[#2C2C30]" : ""
                    )}
                    disabled={item.type === 'text'}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn("w-9 h-9 rounded-full flex items-center justify-center", item.bg)}>
                        <Icon className={cn("w-5 h-5", item.color)} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                          {item.label}
                          {item.alert && <span className="w-2 h-2 rounded-full bg-[#FF3B30] animate-pulse"></span>}
                        </h4>
                        <p className="text-[11px] text-[#E4E4E7] font-medium mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                    {item.type === 'toggle' ? (
                      <div className="relative inline-block w-10 h-6 cursor-pointer rounded-full ml-4 shrink-0 transition-colors" style={{ backgroundColor: item.active ? '#00D26A' : '#3F3F46' }}>
                        <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all", item.active ? "right-1" : "left-1")}></div>
                      </div>
                    ) : item.type !== 'text' ? (
                      <ChevronRight className="w-5 h-5 text-[#A1A1AA]" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Logout */}
      <button 
        onClick={() => logout()}
        className="w-full mt-8 py-4 text-xs font-black text-[#FF3B30] uppercase tracking-widest active:bg-[#FF3B30]/10 rounded-xl transition-colors border border-transparent active:border-[#FF3B30]/20"
      >
        Log out
      </button>

      <p className="text-center text-[10px] text-[#A1A1AA] mt-8 font-medium">AnyTrader Driver v2.0.4</p>
    </div>
  );
}

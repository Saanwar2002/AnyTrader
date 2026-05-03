import React, { useState, useEffect } from "react";
import { useAuth } from "../AuthProvider";
import { logout, db, doc, updateDoc } from "@/src/firebase";
import { deleteField } from "firebase/firestore";
import { ChevronRight, User, Car, BarChart3, Clock, CreditCard, Zap, Share2, Settings, HelpCircle, ShieldCheck, MapPin, X, Repeat, Power, Search, Loader2, Edit2, Trash2, VolumeX } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { toast } from "sonner";

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
  const { profile, user } = useAuth();
  const [showHomeModal, setShowHomeModal] = useState(false);
  const [homeInput, setHomeInput] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);

  useEffect(() => {
    if (!homeInput || homeInput.length < 3) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        if (!window.google) return;
        const { AutocompleteSuggestion } = await window.google.maps.importLibrary("places") as any;
        const request = {
          input: homeInput,
          includedRegionCodes: ["gb"]
        };
        const { suggestions: predictions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        if (predictions && predictions.length > 0) {
            const cleaned = predictions.map((p: any) => ({
              description: p.placePrediction.text.text,
              place_id: p.placePrediction.placeId
            }));
            setSuggestions(cleaned);
        } else {
            setSuggestions([]);
        }
      } catch (err) {
        console.error(err);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [homeInput]);

  const handleSelectHome = async (placeId: string, description: string) => {
    if (!user || !window.google) return;
    setIsGeocoding(true);
    try {
      const geocoder = new window.google.maps.Geocoder();
      const result = await geocoder.geocode({ placeId });
      if (result.results[0]) {
        const { lat, lng } = result.results[0].geometry.location;
        await updateDoc(doc(db, "users", user.uid), {
           homeAddress: description,
           homeLat: lat(),
           homeLng: lng(),
           destinationModeActive: true
        });
        toast.success("Home address set & Destination Mode ON");
        setShowHomeModal(false);
      }
    } catch (err) {
      toast.error("Failed to find location");
    } finally {
      setIsGeocoding(false);
    }
  };

  const [confirmLastJob, setConfirmLastJob] = React.useState(false);

  const handleLastJobToggle = () => {
    if (!user?.uid) return;
    if (profile?.isLastJob) {
      updateDoc(doc(db, "users", user.uid), { isLastJob: false });
      setConfirmLastJob(false);
    } else {
      if (confirmLastJob) {
        updateDoc(doc(db, "users", user.uid), { isLastJob: true });
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
        { id: "analytics", icon: BarChart3, label: "Analytics", desc: "Performance & trends", color: "text-[#00D26A]", bg: "bg-[#00D26A]/10" },
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
        { icon: MapPin, label: "Destination Mode", desc: profile?.destinationModeActive ? `Active: ${profile?.homeAddress || "Toward Home"}` : "Off", color: "text-[#AF52DE]", bg: "bg-white/5", type: 'toggle', action: 'toggle-destination-mode', active: profile?.destinationModeActive === true },
        { icon: VolumeX, label: "Mute Offer Alerts", desc: "Disable 3-sec sound ping", color: "text-[#FF9500]", bg: "bg-white/5", type: 'toggle', action: 'toggle-mute-alerts', active: profile?.muteRideOfferAlerts === true },
        { icon: ShieldCheck, label: "Passcode Verification", desc: profile?.requirePasscode === true ? "Passenger must provide PIN (Last 4 of phone)" : "Off", color: "text-[#00D26A]", bg: "bg-white/5", type: 'toggle', action: 'toggle-passcode', active: profile?.requirePasscode === true },
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
                        if (!user?.uid) return;
                        if (item.action === 'toggle-stacking') {
                          updateDoc(doc(db, "users", user.uid), { isStackingEnabled: !item.active });
                        }
                        if (item.action === 'toggle-passcode') {
                          updateDoc(doc(db, "users", user.uid), { requirePasscode: !item.active });
                        }
                        if (item.action === 'toggle-destination-mode') {
                          if (!profile?.homeLat && !item.active) {
                             setShowHomeModal(true);
                          } else {
                             updateDoc(doc(db, "users", user.uid), { destinationModeActive: !item.active });
                          }
                        }
                        if (item.action === 'toggle-mute-alerts') {
                          updateDoc(doc(db, "users", user.uid), { muteRideOfferAlerts: !item.active });
                        }
                        if (item.action === 'toggle-last-job') {
                          updateDoc(doc(db, "users", user.uid), { isLastJob: !item.active });
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
                      <div className="flex items-center gap-3">
                        {item.action === 'toggle-destination-mode' && profile?.homeLat && (
                          <div className="flex items-center gap-2 mr-2">
                            <div 
                              onClick={(e) => { e.stopPropagation(); setShowHomeModal(true); setHomeInput(""); setSuggestions([]); }}
                              className="p-1.5 bg-[#2C2C30] hover:bg-[#3F3F46] rounded flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-[#A1A1AA] hover:text-white" />
                            </div>
                            <div 
                              onClick={async (e) => { 
                                e.stopPropagation(); 
                                if (!user?.uid) return;
                                try {
                                  await updateDoc(doc(db, "users", user.uid), {
                                    homeAddress: deleteField(),
                                    homeLat: deleteField(),
                                    homeLng: deleteField(),
                                    destinationModeActive: false
                                  });
                                  toast.success("Destination mode cleared");
                                } catch (err) {
                                  console.error(err);
                                }
                              }}
                              className="p-1.5 bg-[#2C2C30] hover:bg-[#FF3B30]/20 rounded flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-[#A1A1AA] hover:text-[#FF3B30]" />
                            </div>
                          </div>
                        )}
                        <div className="relative inline-block w-10 h-6 cursor-pointer rounded-full shrink-0 transition-colors" style={{ backgroundColor: item.active ? '#00D26A' : '#3F3F46' }}>
                          <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all", item.active ? "right-1" : "left-1")}></div>
                        </div>
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

      {showHomeModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1A1A1E] w-full max-w-sm rounded-[32px] p-6 shadow-2xl border border-[#2C2C30]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-white">Set Home Address</h3>
              <button onClick={() => setShowHomeModal(false)} className="p-2 w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm font-medium text-[#A1A1AA] mb-4">
              Where are you heading? We'll prioritize rides going in this direction.
            </p>
            <div className="relative mb-6">
              <input
                type="text"
                placeholder="Search home address..."
                className="w-full bg-[#2C2C30] border-none rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all pl-12 placeholder:text-[#A1A1AA]"
                value={homeInput}
                onChange={(e) => setHomeInput(e.target.value)}
              />
              <Search className="w-5 h-5 text-[#A1A1AA] absolute left-4 top-1/2 -translate-y-1/2" />
            </div>

            {suggestions.length > 0 && (
              <div className="bg-[#252529] rounded-2xl overflow-hidden shadow-lg border border-[#3F3F46] max-h-[50vh] overflow-y-auto mb-4">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectHome(s.place_id, s.description)}
                    disabled={isGeocoding}
                    className="w-full text-left px-5 py-4 border-b border-[#3F3F46] hover:bg-[#2C2C30] transition-colors disabled:opacity-50 flex items-start gap-4 text-left"
                  >
                    <MapPin className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-white leading-tight">{s.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {isGeocoding && <p className="text-xs text-center text-emerald-400 font-bold mb-4 flex justify-center items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> Setting home...</p>}
          </div>
        </div>
      )}
    </div>
  );
}

import React from "react";
import { useAuth } from "../AuthProvider";
import { ChevronRight, User, Car, BarChart3, Clock, CreditCard, Zap, Share2, Settings, HelpCircle, ShieldCheck, MapPin } from "lucide-react";
import { cn } from "@/src/lib/utils";

export default function DriverMenu({ onNavigate, commissionRate = 0.12 }: { onNavigate: (tab: string) => void, commissionRate?: number }) {
  const { profile, signOut } = useAuth();

  const sections = [
    {
      title: "Navigation & Earnings",
      items: [
        { icon: BarChart3, label: "Analytics", desc: "Performance & trends", color: "text-[#00D26A]", bg: "bg-[#00D26A]/10" },
        { icon: Clock, label: "Availability Hours", desc: "Set schedule & see demand", color: "text-[#007AFF]", bg: "bg-[#007AFF]/10" },
        { icon: MapPin, label: "My Zones", desc: "Preferred driving areas", color: "text-[#A0A0A8]", bg: "bg-white/5" },
      ]
    },
    {
      title: "Vehicle & Profile",
      items: [
        { icon: User, label: "Driver Profile", desc: "⭐ 4.9 • Active Driver", color: "text-white", bg: "bg-white/10", id: "profile" },
        { icon: Car, label: "Vehicle & Documents", desc: "1 action required", color: "text-[#FF3B30]", bg: "bg-[#FF3B30]/10", alert: true, id: "documents" },       
      ]
    },
    {
      title: "AnyTrader Ecosystem",
      items: [
        { icon: Zap, label: "My Trade Profile", desc: "Switch to trade leads", color: "text-[#AF52DE]", bg: "bg-[#AF52DE]/10" },
        { icon: ShieldCheck, label: "Mechanic Quotes", desc: "Fix your vehicle", color: "text-[#FF9500]", bg: "bg-[#FF9500]/10" },
      ]
    },
    {
      title: "Account",
      items: [
        { icon: CreditCard, label: "Platform Fee", desc: `Fixed at ${(commissionRate * 100).toFixed(0)}%`, color: "text-[#A0A0A8]", bg: "bg-white/5" },
        { icon: Settings, label: "Settings", desc: "App & privacy", color: "text-[#A0A0A8]", bg: "bg-white/5" },
        { icon: HelpCircle, label: "Help Center", desc: "Support", color: "text-[#A0A0A8]", bg: "bg-white/5" },
      ]
    }
  ];

  return (
    <div className="flex-1 bg-[#0D0D0F] text-white overflow-y-auto px-4 py-8 font-sans pb-24">
      
      {/* Header / Profile Summary */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 bg-[#252529] rounded-full flex items-center justify-center font-black text-2xl text-white border border-[#2C2C30]">
          {profile?.firstName?.[0] || "D"}
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-black text-white">{profile?.firstName} {profile?.lastName}</h1>
          <p className="text-xs text-[#00D26A] font-bold mt-1">⭐ 4.9 Rating</p>
        </div>
      </div>

      {/* Referral Banner */}
      <div className="bg-gradient-to-r from-[#00D26A]/20 to-[#007AFF]/20 border border-[#00D26A]/30 rounded-2xl p-4 mb-8 flex items-center justify-between active:scale-[0.98] transition-transform">
        <div>
          <h3 className="font-black text-white uppercase tracking-tight">Earn £25</h3>
          <p className="text-xs text-[#A0A0A8] font-bold mt-0.5">Invite a driver or trader</p>
        </div>
        <div className="bg-white text-[#0D0D0F] p-2 rounded-full">
          <Share2 className="w-5 h-5" />
        </div>
      </div>

      {/* Menu Categories */}
      <div className="space-y-6">
        {sections.map((section, idx) => (
          <div key={idx}>
            <p className="text-[10px] font-black uppercase text-[#6B6B73] tracking-widest px-2 mb-2">{section.title}</p>
            <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-2xl overflow-hidden shadow-sm">
              {section.items.map((item, idxi) => {
                const Icon = item.icon;
                return (
                  <button 
                    key={idxi}
                    onClick={() => item.id && onNavigate(item.id)}
                    className={cn(
                      "w-full flex items-center justify-between p-4 bg-transparent outline-none active:bg-[#252529] transition-colors text-left",
                      idxi !== section.items.length - 1 ? "border-b border-[#2C2C30]" : ""
                    )}
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
                        <p className="text-[11px] text-[#A0A0A8] font-medium mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#6B6B73]" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Logout */}
      <button 
        onClick={() => signOut()}
        className="w-full mt-8 py-4 text-xs font-black text-[#FF3B30] uppercase tracking-widest active:bg-[#FF3B30]/10 rounded-xl transition-colors border border-transparent active:border-[#FF3B30]/20"
      >
        Log out
      </button>

      <p className="text-center text-[10px] text-[#6B6B73] mt-8 font-medium">AnyTrader Driver v2.0.4</p>
    </div>
  );
}

import React from "react";
import { useAuth } from "../AuthProvider";
import { usePortal } from "../../lib/PortalContext";
import { 
  MapPin, CreditCard, Tag, Calendar, Package, 
  Shield, Star, Briefcase, User as UserIcon, 
  ChevronRight, LogOut, Sun, Moon, Palette 
} from "lucide-react";
import { cn } from "@/src/lib/utils";

export default function MenuTab() {
  const { profile, logout } = useAuth();
  const { theme, setTheme } = usePortal();

  const themes = [
    { id: "light", label: "Light", icon: Sun, color: "bg-white border-slate-200" },
    { id: "dark", label: "Dark", icon: Moon, color: "bg-slate-900 border-slate-800" },
    { id: "anyride", label: "Premium", icon: Palette, color: "bg-amber-50 border-amber-200" },
  ];

  const menuItems = [
    { section: "Ride", items: [
      { icon: MapPin, label: "Saved Addresses", detail: `${profile?.favoriteAddresses?.length || 0} saved` },
      { icon: CreditCard, label: "Payment Methods", detail: "Apple / Google Pay" },
      { icon: Tag, label: "Promo Codes", detail: "1 active" },
      { icon: Calendar, label: "Scheduled Rides", detail: "2 upcoming" },
    ]},
    { section: "Account", items: [
      { icon: Package, label: "AnyRide Plus", detail: "£7.99/mo" },
      { icon: Shield, label: "Safety Centre", detail: "2 trusted contacts" },
      { icon: Star, label: "My Ratings", detail: "4.8 ⭐" },
    ]},
    { section: "AnyTrader", items: [
      { icon: Briefcase, label: "Browse Services", detail: "23 providers" },
    ]},
  ];

  return (
    <div className="flex-1 bg-surface overflow-y-auto pb-24">
      <div className="p-6">
        {/* Profile Header */}
        <div className="bg-card p-6 rounded-3xl border border-border-main shadow-sm mb-6 flex items-center gap-4">
          <div className="w-16 h-16 bg-text-main rounded-full flex items-center justify-center text-surface text-xl font-black">
            {profile?.firstName?.charAt(0) || "S"}
          </div>
          <div>
            <h2 className="text-xl font-black text-text-main">{profile?.firstName} {profile?.lastName}</h2>
            <p className="text-sm text-text-muted font-bold">⭐ 4.8 Rider</p>
          </div>
        </div>

        {/* Theme Switching Section */}
        <div className="mb-6">
          <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1 mb-3">App Appearance</h3>
          <div className="grid grid-cols-3 gap-2">
            {themes.map((t) => {
              const Icon = t.icon;
              const isActive = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setTheme(t.id as any);
                    import("sonner").then(({ toast }) => toast.success(`${t.label} theme applied`));
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 py-2 px-1 rounded-2xl border-2 transition-all",
                    isActive 
                      ? "border-primary bg-primary/5 shadow-sm" 
                      : "border-border-main bg-card hover:bg-surface"
                  )}
                >
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center border shadow-sm", t.color)}>
                     <Icon className={cn("w-3.5 h-3.5", t.id === "dark" ? "text-white" : "text-slate-900")} />
                  </div>
                  <span className={cn("text-[9px] font-black uppercase tracking-wider", isActive ? "text-primary" : "text-text-muted")}>
                    {t.label}
                  </span>
                  {isActive && <div className="w-1 h-1 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Menu Sections */}
        {menuItems.map((section) => (
          <div key={section.section} className="mb-6">
            <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1 mb-3">{section.section}</h3>
            <div className="bg-card rounded-3xl border border-border-main shadow-sm overflow-hidden">
              {section.items.map((item, idx) => (
                <button key={item.label} className="w-full p-4 flex items-center justify-between hover:bg-surface border-b border-border-main last:border-0 transition-colors">
                  <div className="flex items-center gap-4">
                    <item.icon className="w-5 h-5 text-text-muted" />
                    <span className="font-bold text-text-main text-sm">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.detail && <span className="text-xs font-black text-text-muted">{item.detail}</span>}
                    <ChevronRight className="w-4 h-4 text-border-main" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}

        <button onClick={logout} className="w-full p-4 flex items-center gap-4 text-danger font-black text-sm hover:bg-danger/5 rounded-2xl transition-colors">
          <LogOut className="w-5 h-5" />
          Log Out
        </button>
      </div>
    </div>
  );
}

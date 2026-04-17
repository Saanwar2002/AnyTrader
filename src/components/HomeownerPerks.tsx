import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { 
  Home, 
  Zap, 
  Shield, 
  PoundSterling, 
  ChevronRight,
  ExternalLink,
  Sparkles,
  Lightbulb
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { db, collection, query, where, onSnapshot } from "@/src/firebase";
import { useAuth } from "./AuthProvider";
import { trackClick, generateLead } from "@/src/services/leadService";

interface Perk {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  category: string;
  cta: string;
  link: string;
  badge?: string;
}

const PERKS: Perk[] = [
  {
    id: "home-insurance",
    title: "Renovation Insurance",
    description: "Standard home insurance often doesn't cover major building works. Protect your home during your extension or conversion.",
    icon: Home,
    color: "blue",
    category: "Insurance",
    cta: "Get Covered",
    link: "https://example.com/home-insurance"
  },
  {
    id: "energy-grant",
    title: "Energy Efficiency Grants",
    description: "You could be eligible for up to £5,000 in government grants for insulation, solar panels, or heat pumps.",
    icon: Zap,
    color: "amber",
    category: "Grants",
    cta: "Check Eligibility",
    link: "https://example.com/grants",
    badge: "Free Money"
  },
  {
    id: "smart-security",
    title: "Smart Home Security",
    description: "Get 20% off professional-grade smart alarms and CCTV systems for AnyTrader homeowners.",
    icon: Shield,
    color: "indigo",
    category: "Security",
    cta: "Claim Discount",
    link: "https://example.com/security"
  },
  {
    id: "remortgage",
    title: "Project Financing",
    description: "Looking to fund a big project? Compare remortgage rates or home improvement loans from top lenders.",
    icon: PoundSterling,
    color: "green",
    category: "Finance",
    cta: "Compare Rates",
    link: "https://example.com/finance"
  }
];

export default function HomeownerPerks({ limit }: { limit?: number }) {
  const { user, profile } = useAuth();
  const [activeCampaigns, setActiveCampaigns] = useState<any[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, "campaigns"),
      where("status", "==", "active"),
      where("targetRole", "in", ["homeowner", "both"])
    );

    const unsub = onSnapshot(q, (snap) => {
      setActiveCampaigns(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsub();
  }, []);

  const handlePerkClick = async (perk: any) => {
    if (perk.isCampaign && user) {
      await trackClick(perk.id);
      await generateLead(perk.partnerId, perk.id, user.uid, profile?.role || "homeowner");
    }
  };

  const mappedCampaigns = activeCampaigns.map(c => ({
    id: c.id,
    partnerId: c.partnerId,
    title: c.title,
    description: c.content,
    icon: Sparkles,
    color: "blue",
    category: "Offer",
    cta: "Learn More",
    link: "#",
    isCampaign: true
  }));

  const combinedPerks = [...mappedCampaigns, ...PERKS];
  const displayPerks = limit ? combinedPerks.slice(0, limit) : combinedPerks;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-slate-900">Exclusive Homeowner Offers</h2>
        </div>
      </div>

      <div className={cn(
        "grid gap-4",
        limit ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
      )}>
        {displayPerks.map((perk, idx) => (
          <motion.a
            key={perk.id}
            href={perk.link}
            target={perk.link === "#" ? undefined : "_blank"}
            rel="noopener noreferrer"
            onClick={() => handlePerkClick(perk)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="group relative bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all flex flex-col justify-between"
          >
            {perk.badge && (
              <div className="absolute top-4 right-4 px-2 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-black uppercase tracking-widest">
                {perk.badge}
              </div>
            )}
            
            <div>
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110",
                perk.color === "blue" ? "bg-blue-50 text-blue-600" :
                perk.color === "amber" ? "bg-amber-50 text-amber-600" :
                perk.color === "indigo" ? "bg-indigo-50 text-indigo-600" :
                "bg-green-50 text-green-600"
              )}>
                <perk.icon className="w-6 h-6" />
              </div>
              
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{perk.category}</p>
              <h3 className="text-lg font-black text-slate-900 mb-2 group-hover:text-primary transition-colors">{perk.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">{perk.description}</p>
            </div>

            <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
              <span className="text-xs font-black text-primary uppercase tracking-tight flex items-center gap-1">
                {perk.cta}
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
              <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
            </div>
          </motion.a>
        ))}
      </div>

      {limit && (
        <div className="bg-slate-900 rounded-[2rem] p-6 text-white flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
              <Lightbulb className="w-6 h-6 fill-current" />
            </div>
            <div>
              <h4 className="font-black">Smart Home Maintenance</h4>
              <p className="text-sm text-slate-400">Get AI-powered maintenance alerts and exclusive discounts on home services.</p>
            </div>
          </div>
          <button className="bg-primary text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 active:scale-95">
            Explore All Offers
          </button>
        </div>
      )}
    </div>
  );
}

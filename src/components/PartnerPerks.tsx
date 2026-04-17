import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { 
  Shield, 
  Truck, 
  Wrench, 
  PoundSterling, 
  HeartPulse, 
  ChevronRight,
  ExternalLink,
  Zap,
  Award
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
    id: "insurance-pl",
    title: "Public Liability Insurance",
    description: "Essential cover for every tradesperson. Protect yourself against accidental damage or injury claims.",
    icon: Shield,
    color: "blue",
    category: "Insurance",
    cta: "Get a Quote",
    link: "https://example.com/insurance/pl",
    badge: "Most Popular"
  },
  {
    id: "insurance-tools",
    title: "Tool & Equipment Cover",
    description: "Your tools are your livelihood. Get covered against theft from your van, even overnight.",
    icon: Wrench,
    color: "orange",
    category: "Insurance",
    cta: "Protect My Tools",
    link: "https://example.com/insurance/tools"
  },
  {
    id: "breakdown-van",
    title: "Specialist Van Breakdown",
    description: "Don't get stranded on the way to a job. Includes roadside repair and replacement vehicle.",
    icon: Truck,
    color: "red",
    category: "Vehicle",
    cta: "View Plans",
    link: "https://example.com/breakdown"
  },
  {
    id: "business-loan",
    title: "Business Growth Loans",
    description: "Need new equipment or a van upgrade? Access flexible loans tailored for sole traders.",
    icon: PoundSterling,
    color: "green",
    category: "Finance",
    cta: "Check Eligibility",
    link: "https://example.com/finance"
  },
  {
    id: "income-protection",
    title: "Income Protection",
    description: "If you're injured and can't work, we'll help cover your bills and expenses.",
    icon: HeartPulse,
    color: "rose",
    category: "Health",
    cta: "Learn More",
    link: "https://example.com/health"
  }
];

export default function PartnerPerks({ limit }: { limit?: number }) {
  const { user, profile } = useAuth();
  const [activeCampaigns, setActiveCampaigns] = useState<any[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, "campaigns"),
      where("status", "==", "active"),
      where("targetRole", "in", ["tradesperson", "both"])
    );

    const unsub = onSnapshot(q, (snap) => {
      setActiveCampaigns(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsub();
  }, []);

  const handlePerkClick = async (perk: any) => {
    if (perk.isCampaign && user) {
      await trackClick(perk.id);
      await generateLead(perk.partnerId, perk.id, user.uid, profile?.role || "tradesperson");
    }
  };

  const mappedCampaigns = activeCampaigns.map(c => ({
    id: c.id,
    partnerId: c.partnerId,
    title: c.title,
    description: c.content,
    icon: Shield, // Default icon for now
    color: "blue",
    category: "Offer",
    cta: "Learn More",
    link: "#", // In a real app, this would be the partner's tracking URL
    isCampaign: true
  }));

  const combinedPerks = [...mappedCampaigns, ...PERKS];
  const displayPerks = limit ? combinedPerks.slice(0, limit) : combinedPerks;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-slate-900">Partner Perks & Offers</h2>
        </div>
        {!limit && (
          <p className="text-xs text-slate-500 font-medium">Exclusive deals for AnyTrader Pros</p>
        )}
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
              <div className="absolute top-4 right-4 px-2 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">
                {perk.badge}
              </div>
            )}
            
            <div>
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110",
                perk.color === "blue" ? "bg-blue-50 text-blue-600" :
                perk.color === "orange" ? "bg-orange-50 text-orange-600" :
                perk.color === "red" ? "bg-red-50 text-red-600" :
                perk.color === "green" ? "bg-green-50 text-green-600" :
                "bg-rose-50 text-rose-600"
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
        <div className="bg-primary/5 rounded-[2rem] p-6 border border-primary/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
              <Zap className="w-6 h-6 fill-current" />
            </div>
            <div>
              <h4 className="font-black text-slate-900">Unlock More Business Perks</h4>
              <p className="text-sm text-slate-600">Get access to fuel cards, tool discounts, and more by becoming a Verified Pro.</p>
            </div>
          </div>
          <button className="bg-primary text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 active:scale-95">
            View All Perks
          </button>
        </div>
      )}
    </div>
  );
}

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
    }, (error) => {
      console.error("Campaigns listing error:", error);
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
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 opacity-60 mix-blend-multiply">
          <Award className="w-4 h-4 text-slate-500" />
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Partner Perks & Offers</h2>
        </div>
        {!limit && (
          <p className="text-xs text-slate-400 font-medium">Exclusive deals for AnyTrader Pros</p>
        )}
      </div>

      <div className={cn(
        "grid gap-3",
        limit ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
      )}>
        {displayPerks.map((perk, idx) => (
          <motion.a
            key={perk.id}
            href={perk.link}
            target={perk.link === "#" ? undefined : "_blank"}
            rel="noopener noreferrer"
            onClick={() => handlePerkClick(perk)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="group block bg-slate-50/80 border border-dashed border-slate-300 p-3 rounded-2xl hover:bg-slate-100 hover:border-slate-400 transition-all relative overflow-hidden"
          >
             <div className="flex items-start gap-3">
               <div className={cn(
                 "w-10 h-10 rounded-xl shrink-0 flex items-center justify-center transition-transform group-hover:scale-105",
                 perk.color === "blue" ? "bg-blue-100 text-blue-600" :
                 perk.color === "orange" ? "bg-orange-100 text-orange-600" :
                 perk.color === "red" ? "bg-red-100 text-red-600" :
                 perk.color === "green" ? "bg-green-100 text-green-600" :
                 "bg-rose-100 text-rose-600"
               )}>
                 <perk.icon className="w-5 h-5" />
               </div>
               <div className="flex-1 min-w-0 pt-0.5">
                 <div className="flex items-center gap-2 mb-1">
                   <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-white px-1.5 py-0.5 rounded-md border border-slate-200 shadow-sm leading-none flex items-center">
                     Sponsored
                   </span>
                   {perk.badge && (
                     <span className="text-[9px] font-bold text-primary px-1.5 py-0.5 bg-primary/10 rounded-full truncate leading-none">
                       {perk.badge}
                     </span>
                   )}
                 </div>
                 <h3 className="text-sm font-bold text-slate-700 group-hover:text-slate-900 truncate">{perk.title}</h3>
                 <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 pr-2">{perk.description}</p>
               </div>
               <div className="shrink-0 flex flex-col items-center justify-center h-10">
                 <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
               </div>
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

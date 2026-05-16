import React, { useEffect, useState } from "react";
import { ChevronLeft, Shield, CheckCircle2, ChevronRight, Star, ExternalLink, ArrowRight, ShieldCheck } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { db, collection, getDocs, query, where, orderBy } from "@/src/firebase";
import { useAuth } from "../AuthProvider";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

interface Partner {
  id: string;
  name: string;
  description: string;
  logoUrl?: string;
  trackingUrl: string;
  rating: number;
  totalDrivers: number;
  startingPrice: string;
  benefits: string[];
  highlight?: string;
  tier: "basic" | "featured" | "exclusive";
}

export default function InsuranceMarketplace({ 
  onBack, 
  currentProvider, 
  daysUntilExpiry 
}: { 
  onBack: () => void;
  currentProvider: string;
  daysUntilExpiry: number;
}) {
  const { user } = useAuth();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  // Fallback data if none found in firestore
  const fallbackPartners: Partner[] = [
    {
      id: "zego",
      name: "Zego PHV Cover",
      description: "Pay-per-mile option available. Perfect for part-time drivers.",
      trackingUrl: "#",
      rating: 4.8,
      totalDrivers: 2405,
      startingPrice: "from £38/week",
      benefits: ["Pay per mile", "Instant certificate", "No annual contract"],
      highlight: "Exclusive: 60 mins free driving credit",
      tier: "featured"
    },
    {
      id: "acorn",
      name: "Acorn Insurance",
      description: "Comprehensive PHV annual cover tailored for London.",
      trackingUrl: "#",
      rating: 4.6,
      totalDrivers: 842,
      startingPrice: "from £1,850/year",
      benefits: ["No claims discount", "Accident replacement", "Legal cover"],
      tier: "basic"
    },
    {
      id: "kingsdale",
      name: "Kingsdale",
      description: "Specialist fleet and solo PHV covers.",
      trackingUrl: "#",
      rating: 4.2,
      totalDrivers: 345,
      startingPrice: "from £2,100/year",
      benefits: ["Fast claims", "0% APR over 12 months"],
      tier: "basic"
    }
  ];

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    try {
      // Query 'Insurance' category partners
      const q = query(
        collection(db, "partners"), 
        where("category", "==", "Insurance"), 
        where("status", "==", "active")
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        setPartners(fallbackPartners);
      } else {
        const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partner));
        // simple sort
        fetched.sort((a, b) => b.rating - a.rating);
        fetched.sort((a, b) => (a.tier === 'featured' ? -1 : 1));
        setPartners(fetched);
      }
    } catch (err) {
      console.error(err);
      setPartners(fallbackPartners);
    } finally {
      setLoading(false);
    }
  };

  const handlePartnerClick = async (partner: Partner) => {
     // Optionally log lead generation here
     if (user?.uid) {
         try {
            // Note: the `leads` collection is for Partners, but as an affiliate, you'd typically just redictect.
            // A more complex integration would create a lead record here.
         } catch(e) {}
     }
     window.open(partner.trackingUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex-1 bg-[#0D0D0F] text-white flex flex-col h-full font-sans absolute inset-0 z-50">
      <div className="sticky top-0 bg-[#0D0D0F]/90 backdrop-blur-xl z-20 px-4 py-4 flex items-center justify-between border-b border-[#2C2C30]">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 bg-[#1A1A1E] border border-[#2C2C30] rounded-xl flex items-center justify-center text-[#E4E4E7] active:text-white transition-colors group">
            <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <h1 className="text-xl font-black tracking-tight">Insurance</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {/* Current Policy Card */}
        <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-2xl p-5 mb-8">
           <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#00D26A]/10 text-[#00D26A] rounded-full flex items-center justify-center shrink-0">
                 <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex-1">
                 <h2 className="text-sm font-bold text-white tracking-tight">{currentProvider} Cover</h2>
                 <p className={cn("text-xs font-bold leading-relaxed", daysUntilExpiry <= 28 ? "text-[#FF9500]" : "text-[#A1A1AA]")}>
                    Expires in {daysUntilExpiry} days
                 </p>
              </div>
           </div>
           
           <div className="bg-[#0D0D0F] p-3 rounded-xl border border-[#2C2C30] flex items-center justify-between">
              <div>
                 <p className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider mb-0.5">Status</p>
                 <div className="flex items-center gap-1.5 text-xs font-black text-white">
                    <div className={cn("w-2 h-2 rounded-full", daysUntilExpiry > 28 ? "bg-[#00D26A]" : "bg-[#FF9500]")} />
                    {daysUntilExpiry > 28 ? "Active Policy" : "Expiring Soon"}
                 </div>
              </div>
              <button className="text-[11px] font-black uppercase text-[#00D26A] bg-[#00D26A]/10 px-3 py-1.5 rounded-lg">
                 Update Policy
              </button>
           </div>
        </div>

        {/* Marketplace Section */}
        <div>
           <h3 className="text-sm font-black text-white uppercase tracking-widest mb-1">Compare Partners</h3>
           <p className="text-xs text-[#A1A1AA] font-medium leading-relaxed mb-4">Exclusive rates for AnyRoller drivers. We only partner with TfL-approved insurers.</p>
           
           {loading ? (
             <div className="text-center py-10">
               <div className="w-8 h-8 rounded-full border-2 border-[#00D26A] border-t-transparent animate-spin mx-auto mb-4" />
               <p className="text-sm text-[#A1A1AA] font-bold">Loading quotes...</p>
             </div>
           ) : (
             <div className="space-y-4">
               {partners.map(partner => (
                 <div key={partner.id} className={cn(
                    "bg-[#1A1A1E] border rounded-2xl transition-all relative overflow-hidden",
                    partner.tier === "featured" ? "border-[#00D26A]/50 shadow-[0_0_20px_rgba(0,210,106,0.05)]" : "border-[#2C2C30]"
                 )}>
                    {partner.tier === 'featured' && (
                       <div className="absolute top-0 right-0 bg-[#00D26A] text-[#0D0D0F] text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-bl-lg z-10">
                          Recommended
                       </div>
                    )}
                    
                    <div className="p-4">
                       <div className="flex justify-between items-start mb-3">
                          <div>
                             <h4 className="text-lg font-black text-white tracking-tight leading-none mb-1.5">{partner.name}</h4>
                             <div className="flex items-center gap-2 text-xs font-medium">
                                <div className="flex items-center text-[#FF9500]">
                                   <Star className="w-3.5 h-3.5 fill-[#FF9500] mr-1" />
                                   <span className="font-bold text-white">{partner.rating.toFixed(1)}</span>
                                </div>
                                <span className="text-[#A1A1AA]">·</span>
                                <span className="text-[#A1A1AA]">{partner.totalDrivers} drivers</span>
                             </div>
                          </div>
                       </div>
                       
                       {partner.highlight && (
                         <div className="bg-[#00D26A]/10 border border-[#00D26A]/20 text-[#00D26A] text-[11px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg mb-3 inline-flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {partner.highlight}
                         </div>
                       )}

                       <p className="text-xs text-[#E4E4E7] leading-relaxed mb-4">{partner.description}</p>
                       
                       <div className="space-y-2 mb-4">
                          {partner.benefits.slice(0, 3).map((benefit, idx) => (
                             <div key={idx} className="flex items-start gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#00D26A] shrink-0 mt-0.5" />
                                <span className="text-xs text-[#A1A1AA] font-medium">{benefit}</span>
                             </div>
                          ))}
                       </div>
                       
                       <div className="pt-4 border-t border-[#333338] flex items-center justify-between">
                          <div>
                             <p className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-widest mb-0.5">Estimated</p>
                             <p className="text-[#00D26A] font-black">{partner.startingPrice}</p>
                          </div>
                          
                          <button 
                            onClick={() => handlePartnerClick(partner)}
                            className="bg-[#252529] hover:bg-[#333338] text-white text-xs font-black uppercase tracking-widest px-4 py-2.5 rounded-xl border border-[#333338] transition-colors flex items-center gap-1.5"
                          >
                             Get Quote <ExternalLink className="w-3 h-3" />
                          </button>
                       </div>
                    </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { ChevronRight, Zap, Briefcase, ShieldCheck, Star, Gift, ShieldAlert, Award, FileText } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { collection, query, onSnapshot, doc, updateDoc, increment, addDoc, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { cn } from "../../lib/utils";
import { useAuth } from "../AuthProvider";
import { Link } from "react-router-dom";

const iconMap: Record<string, any> = {
  Zap, Briefcase, ShieldCheck, Star, Gift, ShieldAlert, Award, FileText
};

const DEFAULT_PARTNER_ADVERTS = [
  {
    id: "default-trader-1",
    title: "Elite Pro Plumbing 24/7",
    description: "Top-rated emergency plumber in your area. Book now!",
    url: "#",
    bgColor: "bg-slate-900",
    iconName: "Zap",
    targetRole: "all",
    type: "trader_promo"
  },
  {
    id: "default-1",
    title: "Toolstation Next Day Delivery",
    description: "Get 10% off your first Trade Account order",
    url: "https://www.toolstation.com",
    bgColor: "bg-blue-600",
    iconName: "Briefcase",
    targetRole: "all",
    type: "partner"
  },
  {
    id: "default-2",
    title: "Screwfix Trade Exclusive",
    description: "Apply now for exclusive trade prices & offers",
    url: "https://www.screwfix.com",
    bgColor: "bg-red-600",
    iconName: "Zap",
    targetRole: "all",
    type: "partner"
  },
  {
    id: "default-3",
    title: "Selco Builders Warehouse",
    description: "Save big on bulk materials this week",
    url: "https://www.selcobw.com",
    bgColor: "bg-emerald-600",
    iconName: "ShieldCheck",
    targetRole: "all",
    type: "partner"
  }
];

export default function PartnerAdvertisement({ role = "tradesperson", category }: { role?: string, category?: string }) {
  const { profile } = useAuth();
  const [adverts, setAdverts] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rotationSpeed, setRotationSpeed] = useState(5000);
  const [isBannerAdsEnabled, setIsBannerAdsEnabled] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const unsubConfig = onSnapshot(doc(db, "platform_config", "global"), (docSnapshot) => {
      if (!isMounted) return;
      if (docSnapshot.exists()) {
        const config = docSnapshot.data();
        if (config.adRotationSpeedSeconds) {
          setRotationSpeed(config.adRotationSpeedSeconds * 1000);
        }
      }
    }, (error) => {
      console.error("Platform Config Error:", error);
    });

    const unsubAdConfig = onSnapshot(doc(db, "platform_config", "advertising"), (docSnapshot) => {
      if (!isMounted) return;
      if (docSnapshot.exists()) {
        setIsBannerAdsEnabled(docSnapshot.data().isBannerAdsEnabled !== false);
      }
    }, (error) => {
      console.error("Advertising Config Error:", error);
    });

    const unsubs = onSnapshot(query(collection(db, "advertisements")), (snapshot) => {
      if (!isMounted) return;
      const activeAds = snapshot.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }))
        .filter((ad: any) => ad.isActive !== false)
        .filter((ad: any) => {
           if (ad.type === "trader_promo" && ad.endDate) {
              const endMillis = ad.endDate.toMillis ? ad.endDate.toMillis() : ad.endDate.seconds * 1000;
              if (Date.now() > endMillis) return false;
           }
           return true;
        })
        .filter((ad: any) => ad.targetRole === "all" || ad.targetRole === role)
        .filter((ad: any) => {
            if (role !== "tradesperson") return true;
            if (!ad.targetCategories || ad.targetCategories.length === 0) return true;
            if (!category) return true;
            return ad.targetCategories.includes(category) || ad.targetCategories.includes("all");
        });
      
      setAdverts(activeAds.length ? activeAds : []);
    }, (error) => {
      console.error("Advertisements query error", error);
    });
    return () => {
      isMounted = false;
      unsubConfig();
      unsubAdConfig();
      unsubs();
    };
  }, [role, category]);

  const displayAdverts = adverts.length > 0 ? adverts : DEFAULT_PARTNER_ADVERTS.filter(ad => ad.targetRole === "all" || ad.targetRole === role);

  useEffect(() => {
    if (displayAdverts.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % displayAdverts.length);
    }, rotationSpeed);
    return () => clearInterval(timer);
  }, [displayAdverts.length, rotationSpeed]);

  if (displayAdverts.length === 0) return null;

  const ad = displayAdverts[currentIndex % displayAdverts.length];
  const AdIcon = iconMap[ad.iconName] || Zap;

  const handleAdClick = async (clickedAd: any) => {
    // Only track clicks for database-driven ads
    if (clickedAd.id && clickedAd.id !== "default-1" && clickedAd.id !== "default-2") {
      try {
        const updateData: any = { clicks: increment(1) };
        const cost = clickedAd.costPerDisplay || 0;
        
        if (clickedAd.billingCycle === "prepaid" && typeof clickedAd.prepaidBalance === "number") {
          const newBalance = clickedAd.prepaidBalance - cost;
          updateData.prepaidBalance = increment(-cost);
          
          if (newBalance <= 0) {
            updateData.isActive = false; // Stop promotion
          }
          
          // Notification logic
          if (clickedAd.advertiserUid && clickedAd.totalBudget) {
            const pct = newBalance / clickedAd.totalBudget;
            const oldPct = clickedAd.prepaidBalance / clickedAd.totalBudget;
            
            let noticeMsg = null;
            if (oldPct > 0.9 && pct <= 0.9) {
              noticeMsg = `Your ad campaign "${clickedAd.title}" has reached 90% of its budget capacity.`;
            } else if (oldPct > 0.1 && pct <= 0.1) {
              noticeMsg = `CRITICAL: Your ad campaign "${clickedAd.title}" has reached 10% of its budget capacity! Top up soon to avoid stoppage.`;
            } else if (oldPct > 0 && pct <= 0) {
              noticeMsg = `Your ad campaign "${clickedAd.title}" has run out of budget and has been paused. Top up to resume.`;
            }
            
            if (noticeMsg) {
              await addDoc(collection(db, "notifications"), {
                userId: clickedAd.advertiserUid,
                title: "Ad Budget Alert",
                body: noticeMsg,
                type: "alert",
                read: false,
                createdAt: serverTimestamp()
              });
            }
          }
        }
        
        await updateDoc(doc(db, "advertisements", clickedAd.id), updateData);
      } catch (e) {
        console.error("Failed to track ad click", e);
      }
    }
  };

  if (!isBannerAdsEnabled) return null;

  return (
    <div className="mt-4 mb-6 relative group/banner">
      {/* Animated Gradient Border Layer */}
      <div className="absolute -inset-[2px] rounded-2xl bg-gradient-to-r from-blue-500 via-purple-500 to-amber-500 opacity-60 group-hover/banner:opacity-100 transition duration-500 shadow-[0_0_15px_rgba(168,85,247,0.4)] animate-pulse"></div>
      
      {/* Main Banner Container */}
      <div className="relative overflow-hidden rounded-[14px] w-full h-20 sm:h-24 shadow-sm z-10 bg-slate-100 border border-black/40">
        <AnimatePresence>
          <motion.a
            key={ad.id}
            href={ad.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleAdClick(ad)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className={cn(
              "absolute inset-0 group text-white disabled cursor-pointer overflow-hidden flex items-stretch",
              ad.imageUrl ? "" : "flex items-center gap-4 p-4 sm:p-5",
              !ad.imageUrl && ad.bgColor?.startsWith("bg-") ? ad.bgColor : undefined,
              ad.type === "trader_promo" ? "bg-gradient-to-br from-slate-900 to-slate-800" : ""
            )}
            style={{ backgroundColor: !ad.imageUrl && ad.bgColor && !ad.bgColor.startsWith("bg-") && ad.type !== "trader_promo" ? ad.bgColor : undefined }}
          >
            {/* Ad Badge */}
            <div className="absolute top-2 right-2 bg-black/20 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] font-black text-white/90 uppercase tracking-widest z-20 border border-black/20">
              Ad
            </div>

            {ad.imageUrl ? (
              <img src={ad.imageUrl} alt={ad.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            ) : (
              <>
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", ad.type === "trader_promo" ? "bg-amber-500/20 shadow-inner shadow-white/10" : "bg-white/20")}>
                  <AdIcon className={cn("w-6 h-6", ad.type === "trader_promo" ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" : "text-white")} />
                </div>
                <div className="flex-1 min-w-0 pr-2 sm:pr-4 flex flex-col justify-center">
                  <p className={cn("text-sm sm:text-base font-black truncate leading-tight", ad.type === "trader_promo" ? "text-amber-400" : "text-white")}>{ad.title}</p>
                  <p className={cn("text-xs sm:text-sm truncate leading-relaxed mt-1", ad.type === "trader_promo" ? "text-amber-100/90" : "text-white/90")}>{ad.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0 self-center" />
              </>
            )}
          </motion.a>
        </AnimatePresence>
      </div>

      {(profile?.role === "tradesperson" || profile?.subscriptionType === "business" || profile?.role === "business") && (
        <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-20">
          <Link 
            to="/trader/banner-ads" 
            className="bg-yellow-400 border border-black text-black px-4 py-1 rounded-full text-[9px] font-black hover:bg-yellow-500 transition-colors uppercase tracking-widest shadow-[0_1.5px_0_0_rgba(0,0,0,1)] hover:shadow-none hover:translate-y-[1.5px]"
            onClick={(e) => e.stopPropagation()}
          >
            Click to advertise
          </Link>
        </div>
      )}
    </div>
  );
}

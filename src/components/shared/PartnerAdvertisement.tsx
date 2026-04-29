import React, { useState, useEffect } from "react";
import { ChevronRight, Zap, Briefcase, ShieldCheck, Star, Gift, ShieldAlert, Award, FileText } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { collection, query, onSnapshot, doc, updateDoc, increment } from "firebase/firestore";
import { db } from "../../firebase";
import { cn } from "../../lib/utils";

const iconMap: Record<string, any> = {
  Zap, Briefcase, ShieldCheck, Star, Gift, ShieldAlert, Award, FileText
};

const DEFAULT_PARTNER_ADVERTS = [
  {
    id: "default-1",
    title: "Toolstation Next Day Delivery",
    description: "Get 10% off your first Trade Account order",
    url: "https://www.toolstation.com",
    bgColor: "bg-blue-600",
    iconName: "Briefcase",
    targetRole: "all"
  },
  {
    id: "default-2",
    title: "Screwfix Trade Exclusive",
    description: "Apply now for exclusive trade prices & offers",
    url: "https://www.screwfix.com",
    bgColor: "bg-red-600",
    iconName: "Zap",
    targetRole: "all"
  },
  {
    id: "default-3",
    title: "Selco Builders Warehouse",
    description: "Save big on bulk materials this week",
    url: "https://www.selcobw.com",
    bgColor: "bg-emerald-600",
    iconName: "ShieldCheck",
    targetRole: "all"
  }
];

export default function PartnerAdvertisement({ role = "tradesperson", category }: { role?: string, category?: string }) {
  const [adverts, setAdverts] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rotationSpeed, setRotationSpeed] = useState(5000);

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
    });

    const unsubs = onSnapshot(query(collection(db, "advertisements")), (snapshot) => {
      if (!isMounted) return;
      const activeAds = snapshot.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }))
        .filter((ad: any) => ad.isActive !== false)
        .filter((ad: any) => ad.targetRole === "all" || ad.targetRole === role)
        .filter((ad: any) => {
            if (role !== "tradesperson") return true;
            if (!ad.targetCategories || ad.targetCategories.length === 0) return true;
            if (!category) return true;
            return ad.targetCategories.includes(category) || ad.targetCategories.includes("all");
        });
      
      setAdverts(activeAds.length ? activeAds : []);
    });
    return () => {
      isMounted = false;
      unsubConfig();
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
        await updateDoc(doc(db, "advertisements", clickedAd.id), {
          clicks: increment(1)
        });
      } catch (e) {
        console.error("Failed to track ad click", e);
      }
    }
  };

  return (
    <div className="mt-4 relative overflow-hidden rounded-2xl h-20 sm:h-24">
      <AnimatePresence mode="wait">
        <motion.a
          key={ad.id}
          href={ad.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => handleAdClick(ad)}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "absolute inset-0 group transition-all text-white shadow-sm disabled cursor-pointer overflow-hidden",
            ad.imageUrl ? "bg-slate-100 block" : "flex items-center gap-4 p-4 sm:p-5",
            !ad.imageUrl && ad.bgColor?.startsWith("bg-") ? ad.bgColor : undefined
          )}
          style={{ backgroundColor: !ad.imageUrl && ad.bgColor && !ad.bgColor.startsWith("bg-") ? ad.bgColor : undefined }}
        >
          {ad.imageUrl ? (
            <img src={ad.imageUrl} alt={ad.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <AdIcon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0 pr-2 sm:pr-4 flex flex-col justify-center">
                <p className="text-sm sm:text-base font-black truncate leading-tight">{ad.title}</p>
                <p className="text-xs sm:text-sm text-white/90 truncate leading-relaxed mt-1">{ad.description}</p>
              </div>
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" />
            </>
          )}
        </motion.a>
      </AnimatePresence>
    </div>
  );
}

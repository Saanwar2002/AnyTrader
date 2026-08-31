import React, { useState, useMemo } from "react";
import { Wrench, ChevronRight } from "lucide-react";

interface SlowTrustBadgesCarouselProps {
  trader: any;
  onSelectBadge?: (badgeId: string) => void;
  onOpenAllDocs?: () => void;
  bgClass?: string;
}

export const SlowTrustBadgesCarousel: React.FC<SlowTrustBadgesCarouselProps> = ({
  trader,
  onOpenAllDocs,
  onSelectBadge,
}) => {
  const [isPaused, setIsPaused] = useState(false);

  // Extract non-duplicate skills & services list
  const skillsList = useMemo(() => {
    const items: string[] = [];
    const addUnique = (str: any) => {
      if (str && typeof str === "string") {
        const trimmed = str.trim();
        if (trimmed && !items.includes(trimmed)) {
          items.push(trimmed);
        }
      }
    };

    if (Array.isArray(trader?.services)) trader.services.forEach(addUnique);
    if (Array.isArray(trader?.specialistServices)) trader.specialistServices.forEach(addUnique);
    if (Array.isArray(trader?.trades)) trader.trades.forEach(addUnique);
    if (Array.isArray(trader?.tags)) trader.tags.forEach(addUnique);
    if (Array.isArray(trader?.specialistTags)) trader.specialistTags.forEach(addUnique);

    if (items.length === 0) {
      if (trader?.trade) addUnique(trader.trade);
      if (trader?.category) addUnique(trader.category);
      if (trader?.primaryTrade) addUnique(trader.primaryTrade);
    }

    if (items.length === 0) {
      return [
        "Quality Craftsmanship",
        "Upfront Transparent Quotes",
        "Verified Workmanship",
        "Fast Response Times"
      ];
    }

    return items.slice(0, 15);
  }, [trader]);

  // Ensure minimum items in set for ultra-smooth loop
  const paddedSkillsList = useMemo(() => {
    if (skillsList.length === 0) return [];
    let list = [...skillsList];
    while (list.length < 4) {
      list = list.concat(skillsList);
    }
    return list;
  }, [skillsList]);

  const durationSeconds = useMemo(() => {
    return Math.max(14, paddedSkillsList.length * 4.5);
  }, [paddedSkillsList]);

  const renderSkillsGroup = (keySuffix: string) => (
    <div key={keySuffix} className="flex items-center shrink-0">
      {paddedSkillsList.map((skill, idx) => (
        <span key={`${skill}-${idx}-${keySuffix}`} className="inline-flex items-center">
          <span className="text-[10px] font-bold text-black tracking-tight whitespace-nowrap">
            {skill}
          </span>
          <span className="text-blue-600 font-black mx-2.5 text-[10px] select-none shrink-0">•</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="w-full my-0.5">
      <div className="flex items-center justify-between mb-0.5 px-0.5">
        <span className="text-[8.5px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1">
          <Wrench className="w-2.5 h-2.5 text-blue-600 shrink-0" /> Specialist Skills & Services
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenAllDocs) onOpenAllDocs();
            else if (onSelectBadge) onSelectBadge("liability_insurance");
          }}
          className="text-[8.5px] font-bold text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer shrink-0 z-10"
        >
          View Docs <ChevronRight className="w-2.5 h-2.5" />
        </button>
      </div>

      {/* Jet Black Thin Border Outer Container (GPU-accelerated CSS marquee) */}
      <div
        className="relative w-full rounded-lg bg-white border border-black overflow-hidden py-1 px-1 flex items-center"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Soft edge gradients */}
        <div className="absolute left-0 top-0 bottom-0 w-3 z-10 pointer-events-none bg-gradient-to-r from-white via-white/80 to-transparent" />
        <div className="absolute right-0 top-0 bottom-0 w-3 z-10 pointer-events-none bg-gradient-to-l from-white via-white/80 to-transparent" />

        <div
          className="flex w-max items-center animate-slow-scroll select-none"
          style={{
            animationDuration: `${durationSeconds}s`,
            animationPlayState: isPaused ? "paused" : "running",
          }}
        >
          {/* Two identical sets for 100% seamless, mathematically infinite marquee */}
          {renderSkillsGroup("set1")}
          {renderSkillsGroup("set2")}
        </div>
      </div>
    </div>
  );
};



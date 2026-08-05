import React, { useRef, useEffect, useState } from "react";
import { ShieldCheck, CheckCircle2, AlertTriangle, Shield, ChevronRight } from "lucide-react";
import { getTraderUnifiedTrustBadges } from "@/src/lib/trustBadges";
import { cn } from "@/src/lib/utils";

interface SlowTrustBadgesCarouselProps {
  trader: any;
  onSelectBadge: (badgeId: string) => void;
  onOpenAllDocs?: () => void;
  bgClass?: string;
}

export const SlowTrustBadgesCarousel: React.FC<SlowTrustBadgesCarouselProps> = ({
  trader,
  onSelectBadge,
  onOpenAllDocs,
  bgClass = "bg-slate-50"
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const badges = getTraderUnifiedTrustBadges(trader);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let animId: number;
    let lastTime = performance.now();

    const step = (time: number) => {
      if (!isPaused && el) {
        const delta = (time - lastTime) / 1000;
        // Very slow gentle movement speed: ~16px per second
        el.scrollLeft += delta * 16;

        // Smooth continuous infinite loop
        if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 2) {
          el.scrollLeft = 0;
        }
      }
      lastTime = time;
      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [isPaused]);

  if (!badges || badges.length === 0) return null;

  return (
    <div className="w-full my-1">
      <div className="flex items-center justify-between mb-1 px-0.5">
        <span className="text-[9px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Verified Credentials
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenAllDocs) onOpenAllDocs();
            else onSelectBadge("liability_insurance");
          }}
          className="text-[9px] font-bold text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer shrink-0 z-10"
        >
          View Docs <ChevronRight className="w-2.5 h-2.5" />
        </button>
      </div>

      {/* Carousel Wrapper with gradient edges */}
      <div
        className="relative w-full overflow-hidden"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        <div className={cn("absolute left-0 top-0 bottom-0 w-3 z-10 pointer-events-none bg-gradient-to-r to-transparent", bgClass === "bg-white" ? "from-white via-white/80" : "from-slate-50 via-slate-50/80")} />
        <div className={cn("absolute right-0 top-0 bottom-0 w-3 z-10 pointer-events-none bg-gradient-to-l to-transparent", bgClass === "bg-white" ? "from-white via-white/80" : "from-slate-50 via-slate-50/80")} />

        <div
          ref={scrollRef}
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 px-1 cursor-grab active:cursor-grabbing"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {badges.map((badge) => {
            const isApproved = badge.status === "approved";
            const isExpired = badge.status === "expired";

            let fullLabel = badge.shortLabel;
            if (badge.id === "liability_insurance") fullLabel = "Public Liability £2M+";
            else if (badge.id === "trade_licence") fullLabel = badge.shortLabel;
            else if (badge.id === "identity_dbs") fullLabel = "Verified ID & DBS Clear";
            else if (badge.id === "video_credentials") fullLabel = "Video Selfie Verified";
            else if (badge.id === "bank_guarantee") fullLabel = "£1k Defect Guarantee";

            return (
              <button
                key={badge.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectBadge(badge.id);
                }}
                className={cn(
                  "py-0.5 px-2 rounded-md text-center flex items-center gap-1.5 border transition-all cursor-pointer shrink-0 shadow-2xs hover:scale-102",
                  isApproved
                    ? "bg-emerald-50 border-black text-emerald-950 hover:bg-emerald-100"
                    : isExpired
                    ? "bg-red-50 border-black text-red-900 hover:bg-red-100 animate-pulse"
                    : "bg-slate-100 border-black text-slate-700 hover:bg-slate-200"
                )}
              >
                {isApproved ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                ) : isExpired ? (
                  <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                ) : (
                  <Shield className="w-3 h-3 text-slate-400 shrink-0" />
                )}

                <span className="text-[9.5px] font-black leading-none whitespace-nowrap text-slate-900">
                  {fullLabel}
                </span>

                <span className={cn(
                  "text-[7.5px] font-black uppercase tracking-wider px-1 py-0.2 rounded-sm",
                  isApproved ? "bg-emerald-200/80 text-emerald-950" : isExpired ? "bg-red-200 text-red-950" : "bg-slate-200 text-slate-800"
                )}>
                  {isApproved ? "Active" : isExpired ? "Expired!" : "Pending"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

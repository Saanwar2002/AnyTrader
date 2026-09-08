import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { RefreshCw, ArrowDown, Check } from "lucide-react";
import { triggerHaptic, ImpactStyle } from "@/src/lib/capacitor";
import { cn } from "@/src/lib/utils";

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  pullThreshold?: number;
  maxPullDistance?: number;
}

export function PullToRefresh({
  onRefresh,
  children,
  disabled = false,
  className = "",
  pullThreshold = 64,
  maxPullDistance = 110,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshJustCompleted, setRefreshJustCompleted] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const isTopRef = useRef(false);
  const hasTriggeredHapticRef = useRef(false);

  const getScrollTop = () => {
    const container = containerRef.current;
    if (container && container.scrollHeight > container.clientHeight && container.clientHeight > 0 && container.scrollTop > 0) {
      return container.scrollTop;
    }
    return window.pageYOffset || document.documentElement.scrollTop || window.scrollY || 0;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;

    const scrollTop = getScrollTop();
    
    if (scrollTop <= 1) {
      isTopRef.current = true;
      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
      hasTriggeredHapticRef.current = false;
    } else {
      isTopRef.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled || !isTopRef.current || isRefreshing) return;

    const scrollTop = getScrollTop();
    if (scrollTop > 1) {
      isTopRef.current = false;
      if (pullDistance > 0) setPullDistance(0);
      setIsPulling(false);
      return;
    }

    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const deltaY = currentY - startYRef.current;
    const deltaX = Math.abs(currentX - startXRef.current);

    // Only initiate pull-down if pulling downwards and strictly vertical
    if (deltaY > 5 && deltaY > deltaX) {
      // Apply dampening calculation so pull feels weighted and natural
      const dampening = 0.45;
      const calculatedPull = Math.min(maxPullDistance, deltaY * dampening);
      
      setPullDistance(calculatedPull);
      setIsPulling(true);

      // Trigger crisp haptic feedback when crossing the threshold
      if (calculatedPull >= pullThreshold && !hasTriggeredHapticRef.current) {
        hasTriggeredHapticRef.current = true;
        triggerHaptic(ImpactStyle.Light);
      } else if (calculatedPull < pullThreshold) {
        hasTriggeredHapticRef.current = false;
      }

      // Prevent default browser rubber-band bouncing if pulling at top
      if (e.cancelable && calculatedPull > 10) {
        e.preventDefault();
      }
    } else if (deltaY <= 0) {
      setPullDistance(0);
      setIsPulling(false);
    }
  };

  const handleTouchEnd = async () => {
    if (disabled || !isPulling || isRefreshing) return;

    setIsPulling(false);

    if (pullDistance >= pullThreshold) {
      setIsRefreshing(true);
      setPullDistance(pullThreshold); // Hold at threshold spinner height
      triggerHaptic(ImpactStyle.Medium);

      try {
        await Promise.resolve(onRefresh());
        setRefreshJustCompleted(true);
        triggerHaptic(ImpactStyle.Light);
        await new Promise((res) => setTimeout(res, 500));
      } catch (err) {
        console.error("[PullToRefresh] Error executing refresh:", err);
      } finally {
        setIsRefreshing(false);
        setRefreshJustCompleted(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };

  const progress = Math.min(1, pullDistance / pullThreshold);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={cn("relative w-full touch-pan-y", className)}
    >
      {/* Pull Indicator Badge */}
      <AnimatePresence>
        {(pullDistance > 0 || isRefreshing) && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.8 }}
            animate={{
              opacity: 1,
              y: isRefreshing ? 12 : Math.max(8, pullDistance - 40),
              scale: isRefreshing ? 1 : Math.max(0.7, Math.min(1.05, progress)),
            }}
            exit={{ opacity: 0, y: -20, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="absolute top-0 left-1/2 -translate-x-1/2 z-40 pointer-events-none"
          >
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-black bg-white shadow-md text-black text-xs font-semibold">
              {refreshJustCompleted ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                  <span className="text-black">Updated</span>
                </>
              ) : isRefreshing ? (
                <>
                  <RefreshCw className="w-4 h-4 text-black animate-spin stroke-[2.5]" />
                  <span className="text-black">Updating feed...</span>
                </>
              ) : (
                <>
                  <motion.div
                    animate={{ rotate: progress >= 1 ? 180 : progress * 180 }}
                    transition={{ duration: 0.15 }}
                  >
                    <ArrowDown className="w-4 h-4 text-black stroke-[2.5]" />
                  </motion.div>
                  <span className="text-black">
                    {progress >= 1 ? "Release to refresh" : "Pull to refresh"}
                  </span>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content wrapper with smooth spring transform while pulling */}
      <motion.div
        animate={{
          y: isRefreshing ? 48 : pullDistance,
        }}
        transition={
          isPulling
            ? { duration: 0 }
            : { type: "spring", stiffness: 400, damping: 30 }
        }
        className="w-full h-full min-h-full"
      >
        {children}
      </motion.div>
    </div>
  );
}

export default PullToRefresh;

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, ArrowRight, X, Search, Check } from "lucide-react";
import { FuzzyMatchResult } from "@/src/lib/fuzzyMatch";
import { triggerHaptic, ImpactStyle } from "@/src/lib/capacitor";
import { cn } from "@/src/lib/utils";

interface DidYouMeanSuggestionProps {
  suggestion: FuzzyMatchResult | null;
  onApplySuggestion: (suggestion: FuzzyMatchResult) => void;
  onDismiss?: () => void;
  className?: string;
  variant?: "dark" | "light";
}

export function DidYouMeanSuggestion({
  suggestion,
  onApplySuggestion,
  onDismiss,
  className,
  variant = "dark",
}: DidYouMeanSuggestionProps) {
  if (!suggestion) return null;

  const handleApply = () => {
    triggerHaptic(ImpactStyle.Light);
    onApplySuggestion(suggestion);
  };

  const isDark = variant === "dark";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className={cn(
          "flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all shadow-md mt-2",
          isDark
            ? "bg-slate-800/90 text-white border-blue-500/40 shadow-blue-900/20 backdrop-blur-md"
            : "bg-blue-50/90 text-slate-900 border-blue-200 shadow-blue-100/50",
          className
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border shadow-sm",
              isDark
                ? "bg-blue-600/30 text-blue-400 border-blue-400/30"
                : "bg-blue-100 text-blue-600 border-blue-200"
            )}
          >
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={cn("text-xs font-semibold", isDark ? "text-slate-300" : "text-slate-600")}>
                Did you mean
              </span>
              <button
                onClick={handleApply}
                className={cn(
                  "font-black text-xs sm:text-sm underline decoration-blue-400 decoration-2 underline-offset-2 hover:opacity-80 transition-opacity text-left inline-flex items-center gap-1 min-h-[36px] px-1",
                  isDark ? "text-blue-300" : "text-blue-700"
                )}
              >
                <span>"{suggestion.suggestion}"</span>
              </button>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border inline-block bg-blue-500/10 border-blue-500/20 text-blue-400">
                {suggestion.type}
              </span>
            </div>

            {suggestion.categoryName && suggestion.categoryName !== suggestion.suggestion && (
              <p className={cn("text-[10px] font-medium truncate mt-0.5", isDark ? "text-slate-400" : "text-slate-500")}>
                Category match: <span className="font-bold">{suggestion.categoryName}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleApply}
            className={cn(
              "px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-sm min-h-[38px]",
              isDark
                ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20"
                : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20"
            )}
          >
            <span>Apply</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {onDismiss && (
            <button
              onClick={onDismiss}
              className={cn(
                "p-2 rounded-xl transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center",
                isDark
                  ? "text-slate-400 hover:text-white hover:bg-slate-700/60"
                  : "text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
              )}
              aria-label="Dismiss suggestion"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default DidYouMeanSuggestion;

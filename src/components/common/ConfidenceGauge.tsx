import React from "react";
import { cn } from "@/src/lib/utils";

interface ConfidenceGaugeProps {
  score: number; // 0.0 - 1.0 or 0 - 100
  rating?: string; // "High Confidence" | "Medium Confidence" | "Low Confidence"
  size?: number; // width & height in px, default 48
  showRatingBadge?: boolean;
  variant?: "light" | "dark";
  className?: string;
}

export const ConfidenceGauge: React.FC<ConfidenceGaugeProps> = ({
  score,
  rating,
  size = 48,
  showRatingBadge = true,
  variant = "light",
  className
}) => {
  // Normalize percentage to 0 - 100
  const rawScore = typeof score === "number" ? score : 0.85;
  const pct = Math.min(100, Math.max(0, Math.round(rawScore > 1 ? rawScore : rawScore * 100)));

  // Color Coding Rules:
  // - High (>=75%): Green (#10B981)
  // - Medium (50-74%): Yellow/Amber (#F59E0B)
  // - Low (<50%): Red (#EF4444)
  let strokeColor = "#10B981"; // Green
  let textColor = variant === "dark" ? "text-emerald-300" : "text-emerald-700";
  let badgeStyle = variant === "dark" 
    ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/30" 
    : "bg-emerald-50 text-emerald-900 border-emerald-200";

  if (pct < 50 || rating === "Low Confidence") {
    strokeColor = "#EF4444"; // Red
    textColor = variant === "dark" ? "text-rose-300" : "text-rose-700";
    badgeStyle = variant === "dark" 
      ? "bg-rose-500/20 text-rose-200 border-rose-400/30" 
      : "bg-rose-50 text-rose-900 border-rose-200";
  } else if (pct < 75 || rating === "Medium Confidence") {
    strokeColor = "#F59E0B"; // Yellow/Amber
    textColor = variant === "dark" ? "text-amber-300" : "text-amber-700";
    badgeStyle = variant === "dark" 
      ? "bg-amber-500/20 text-amber-200 border-amber-400/30" 
      : "bg-amber-50 text-amber-900 border-amber-200";
  }

  // Derived rating text if not explicitly supplied
  const effectiveRating = rating || (pct >= 75 ? "High Confidence" : pct >= 50 ? "Medium Confidence" : "Low Confidence");

  // SVG Geometry
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;
  const center = size / 2;

  const trackColor = variant === "dark" ? "rgba(255, 255, 255, 0.2)" : "#E2E8F0";

  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      {/* Circular Progress Ring */}
      <div 
        className="relative inline-flex items-center justify-center shrink-0" 
        style={{ width: size, height: size }}
        title={`AI Confidence Score: ${pct}% (${effectiveRating})`}
      >
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background Track Circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke={trackColor}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress Arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        {/* Percentage Text inside Circle */}
        <span className={cn("absolute text-[11px] font-black tracking-tight", variant === "dark" ? "text-white" : textColor)}>
          {pct}%
        </span>
      </div>

      {/* Rating Badge Pill */}
      {showRatingBadge && (
        <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-xs shrink-0", badgeStyle)}>
          {effectiveRating}
        </span>
      )}
    </div>
  );
};

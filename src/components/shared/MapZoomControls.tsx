import React from "react";
import { Plus, Minus } from "lucide-react";
import { cn } from "@/src/lib/utils";

export const MapZoomControls = ({ mapInstance, className }: { mapInstance: google.maps.Map | null, className?: string }) => {
  if (!mapInstance) return null;
  return (
    <div className={cn("flex flex-col shadow-[0_2px_15px_rgba(0,0,0,0.15)] rounded overflow-hidden bg-white pointer-events-auto border border-black/10 w-[34px]", className)}>
      <button 
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); mapInstance.setZoom((mapInstance.getZoom() || 15) + 1); }}
        className="w-full aspect-square flex items-center justify-center text-[#555] hover:text-[#333] active:bg-slate-100 transition-colors"
      >
        <Plus className="w-5 h-5 stroke-[2.5]" />
      </button>
      <div className="h-px w-[80%] mx-auto bg-slate-200" />
      <button 
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); mapInstance.setZoom((mapInstance.getZoom() || 15) - 1); }}
        className="w-full aspect-square flex items-center justify-center text-[#555] hover:text-[#333] active:bg-slate-100 transition-colors"
      >
        <Minus className="w-5 h-5 stroke-[2.5]" />
      </button>
    </div>
  );
};

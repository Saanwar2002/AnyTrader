import React, { useState, useRef, useEffect } from 'react';
import { motion, useAnimation } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import { triggerHaptic } from '@/src/lib/capacitor';

interface SwipeButtonProps {
  onComplete: () => void;
  text: React.ReactNode;
  bgClass: string;
  sliderClass?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  resetToken?: any;
}

export function SwipeButton({ onComplete, text, bgClass, sliderClass, icon, disabled = false, resetToken }: SwipeButtonProps) {
  const [complete, setComplete] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const dragControls = useAnimation();

  useEffect(() => {
    // Reset complete state when component mounts or text changes (helps with reusability in same UI tree)
    setComplete(false);
    dragControls.set({ x: 0 });
    
    if (containerRef.current) {
      setWidth(containerRef.current.offsetWidth);
    }
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [text, dragControls, resetToken]);

  const SLIDER_WIDTH = 64; // width of slider
  const padding = 2; // matches left-0.5
  const maxDrag = Math.max(0, width - SLIDER_WIDTH - (padding * 2));

  const handleDragEnd = async (_: any, info: any) => {
    if (complete || disabled) return;
    if (info.offset.x >= maxDrag * 0.6) {
      setComplete(true);
      triggerHaptic();
      await dragControls.start({ x: maxDrag });
      onComplete();
    } else {
      dragControls.start({ x: 0 });
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`relative flex items-center h-10 w-full rounded-[10px] overflow-hidden select-none ${bgClass} transition-colors ${disabled ? 'opacity-50' : 'shadow-lg shadow-black/20'}`}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
         <div className="font-bold text-sm ml-6 flex items-center gap-2">
           {text}
         </div>
      </div>

      <motion.div
        drag={complete || disabled ? false : "x"}
        dragConstraints={{ left: 0, right: maxDrag > 0 ? maxDrag : 200 }}
        dragElastic={0.05}
        dragMomentum={false}
        animate={dragControls}
        onDragEnd={handleDragEnd}
        className={`absolute left-0.5 top-0.5 bottom-0.5 w-[60px] rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing z-10 ${sliderClass || 'bg-black/20 border border-black/20 shadow-sm'}`}
      >
        <span className="flex text-white font-black text-[12px] tracking-tighter drop-shadow-sm uppercase selection:bg-transparent">
          SLIDE
        </span>
      </motion.div>
    </div>
  );
}

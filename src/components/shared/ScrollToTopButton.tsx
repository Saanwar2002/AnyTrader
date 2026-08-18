import React from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/src/lib/utils";

interface ScrollToTopButtonProps {
  className?: string;
}

export const ScrollToTopButton: React.FC<ScrollToTopButtonProps> = ({ className }) => {
  const scrollToTop = () => {
    // Scroll window smoothly to top
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    // Also reset scroll for any inner main containers if applicable
    const mainEl = document.querySelector("main");
    if (mainEl && mainEl.scrollTop > 0) {
      mainEl.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <button
      onClick={scrollToTop}
      id="scroll-to-top-btn"
      aria-label="Scroll to top of page"
      title="Scroll to top"
      className={cn(
        "fixed left-3.5 bottom-[calc(5.2rem+env(safe-area-inset-bottom,0px))] sm:left-6 sm:bottom-6 z-[90]",
        "w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white",
        "border-2 border-black shadow-xl flex items-center justify-center transition-all duration-200",
        "active:scale-90 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 group",
        className
      )}
    >
      <ArrowUp className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5] group-hover:-translate-y-0.5 transition-transform" />
    </button>
  );
};

export default ScrollToTopButton;

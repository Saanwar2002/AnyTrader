import React, { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";

interface ScrollToTopButtonProps {
  className?: string;
}

export const ScrollToTopButton: React.FC<ScrollToTopButtonProps> = ({ className }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const windowScroll = window.scrollY || document.documentElement.scrollTop;
      const mainEl = document.querySelector("main");
      const mainScroll = mainEl ? mainEl.scrollTop : 0;
      
      setIsVisible(windowScroll > 200 || mainScroll > 200);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    const mainEl = document.querySelector("main");
    if (mainEl) {
      mainEl.addEventListener("scroll", handleScroll, { passive: true });
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (mainEl) {
        mainEl.removeEventListener("scroll", handleScroll);
      }
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    const mainEl = document.querySelector("main");
    if (mainEl && mainEl.scrollTop > 0) {
      mainEl.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          transition={{ duration: 0.2 }}
          onClick={scrollToTop}
          id="scroll-to-top-btn"
          aria-label="Scroll to top of page"
          title="Scroll to top"
          className={cn(
            "fixed left-3.5 bottom-[calc(5.2rem+env(safe-area-inset-bottom,0px))] sm:left-6 sm:bottom-6 z-[90]",
            "w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-slate-900/90 hover:bg-slate-900 text-white backdrop-blur-sm",
            "border border-black shadow-xl flex items-center justify-center transition-all duration-200",
            "active:scale-90 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 group",
            className
          )}
        >
          <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5] group-hover:-translate-y-0.5 transition-transform" />
        </motion.button>
      )}
    </AnimatePresence>
  );
};

export default ScrollToTopButton;

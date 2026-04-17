import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronLeft, ChevronRight, Play } from "lucide-react";

interface MediaGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  photos?: string[];
  videos?: string[];
  title: string;
  initialIndex?: number;
}

export default function MediaGalleryModal({ isOpen, onClose, photos = [], videos = [], title, initialIndex = 0 }: MediaGalleryModalProps) {
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);

  React.useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);

  const allMedia = [
    ...photos.map(url => ({ type: 'photo', url })),
    ...videos.map(url => ({ type: 'video', url }))
  ];

  if (!isOpen || allMedia.length === 0) return null;

  const next = () => setCurrentIndex((prev) => (prev + 1) % allMedia.length);
  const prev = () => setCurrentIndex((prev) => (prev - 1 + allMedia.length) % allMedia.length);

  const current = allMedia[currentIndex];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 sm:p-8"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between text-white z-10">
            <div className="space-y-1">
              <h3 className="font-bold text-lg truncate max-w-[200px] sm:max-w-md">{title}</h3>
              <p className="text-xs text-slate-400">
                {currentIndex + 1} of {allMedia.length}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Main Content */}
          <div className="relative flex-1 w-full flex items-center justify-center overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full h-full flex items-center justify-center"
              >
                {current.type === 'photo' ? (
                  <img
                    src={current.url}
                    alt={`Media ${currentIndex + 1}`}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <video
                      src={current.url}
                      controls
                      className="max-w-full max-h-full rounded-lg shadow-2xl"
                    />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation Buttons */}
            {allMedia.length > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-0 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all active:scale-95"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={next}
                  className="absolute right-0 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all active:scale-95"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {/* Thumbnails */}
          <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-2 max-w-full no-scrollbar">
            {allMedia.map((item, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                  idx === currentIndex ? 'border-blue-500 scale-110' : 'border-transparent opacity-50 hover:opacity-100'
                }`}
              >
                {item.type === 'photo' ? (
                  <img src={item.url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                    <Play className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

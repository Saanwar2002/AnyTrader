import React, { useState } from "react";
import { Star, Loader2, X } from "lucide-react";
import { submitReview } from "@/src/firebase";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";

interface ReviewFormProps {
  jobId: string;
  reviewerId: string;
  revieweeId: string;
  type?: "tradesperson_review" | "homeowner_review";
  onSuccess: () => void;
  onCancel: () => void;
}

export function ReviewForm({ jobId, reviewerId, revieweeId, type = "tradesperson_review", onSuccess, onCancel }: ReviewFormProps) {
  const isTradespersonReview = type === "tradesperson_review";
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [recommended, setRecommended] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError("Please select a rating");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await submitReview(jobId, reviewerId, revieweeId, rating, comment, recommended, type);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError("Failed to submit review. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white p-6 rounded-2xl border border-black shadow-xl space-y-6"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-900">
          {isTradespersonReview ? "Leave a Review" : "Rate Your Customer"}
        </h3>
        <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col items-center justify-center space-y-2 pt-4 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
                className="p-1 transition-transform hover:scale-110 active:scale-95"
              >
                <Star
                  className={cn(
                    "w-10 h-10 transition-colors",
                    (hover || rating) >= star ? "fill-orange-500 text-orange-500" : "text-slate-200"
                  )}
                />
              </button>
            ))}
          </div>
          <p className="text-sm text-slate-600 font-medium">Overall Experience</p>
        </div>

        <div className="space-y-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={isTradespersonReview 
              ? "Leave a comment (optional)... Tell others about your experience with this tradesperson."
              : "Leave a comment (optional)... Tell others about your experience with this homeowner."
            }
            className="w-full p-4 rounded-xl border border-black focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none min-h-[120px] resize-none text-sm"
          />
        </div>

        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5 max-w-[70%]">
            <p className="text-sm font-bold text-slate-900">
              {isTradespersonReview ? "Would you recommend this tradesperson to others?" : "Would you recommend this customer to other tradespeople?"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRecommended(!recommended)}
            className={cn(
              "w-12 h-7 rounded-full transition-all relative flex items-center shrink-0 shadow-inner",
              recommended ? "bg-green-500" : "bg-slate-200"
            )}
          >
            <motion.div
              animate={{ x: recommended ? 22 : 2 }}
              className="absolute w-6 h-6 bg-white rounded-full shadow-sm"
            />
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 font-medium text-center">{error}</p>
        )}

        <div className="flex flex-col gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Feedback"
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-3.5 rounded-xl font-bold text-blue-600 hover:bg-blue-50 transition-colors text-sm"
          >
            Skip
          </button>
        </div>
      </form>
    </motion.div>
  );
}

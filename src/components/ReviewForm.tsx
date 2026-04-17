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
  const [comment, setComment] = useState(
    isTradespersonReview 
      ? "Excellent work! Highly professional and efficient. I'm very happy with the results."
      : "Great homeowner! Clear communication, easy access, and prompt payment. Highly recommended."
  );
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
      className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl space-y-6"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-900">
          {isTradespersonReview ? "Leave a Review" : "Rate Homeowner"}
        </h3>
        <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Rating</label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={cn(
                    "w-8 h-8 transition-colors",
                    (hover || rating) >= star ? "fill-amber-400 text-amber-400" : "text-slate-300"
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        {isTradespersonReview && (
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="space-y-0.5">
              <p className="text-sm font-bold text-slate-900">Recommend to others?</p>
              <p className="text-[10px] text-slate-500">This helps other homeowners find trusted trades.</p>
            </div>
            <button
              type="button"
              onClick={() => setRecommended(!recommended)}
              className={cn(
                "w-12 h-6 rounded-full transition-all relative",
                recommended ? "bg-green-500" : "bg-slate-300"
              )}
            >
              <motion.div
                animate={{ x: recommended ? 26 : 2 }}
                className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm"
              />
            </button>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Comment</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={isTradespersonReview 
              ? "Tell others about your experience with this tradesperson..."
              : "Tell others about your experience with this homeowner..."
            }
            className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none min-h-[120px] resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 font-medium">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Review"
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
}

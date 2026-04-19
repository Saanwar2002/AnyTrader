import React from "react";
import { Star, Zap, CheckCircle2, Trophy, Clock, MapPin, Award, ShieldCheck, ShieldAlert, Medal } from "lucide-react";

export interface Badge {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  description: string;
}

export const getTraderBadges = (profile: any): Badge[] => {
  const badges: Badge[] = [];

  // 0. Founding Member (Highest Priority)
  if (profile.isFoundingMember) {
    badges.push({
      id: "founding_member",
      label: "Founding Member",
      icon: <Award className="w-3 h-3 text-orange-600 fill-orange-500" />,
      color: "text-orange-700",
      bgColor: "bg-orange-100",
      description: "One of the first 100 verified traders on AnyTrader"
    });
  }

  // Performance Badges
  if (profile.rating >= 4.8 && (profile.totalReviews || 0) >= 5) {
    badges.push({
      id: "top_rated",
      label: "Top Rated",
      icon: <Star className="w-3 h-3 fill-current" />,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      description: "Maintains a 4.8+ star rating"
    });
  }

  if (profile.responseRate >= 90) {
    badges.push({
      id: "fast_responder",
      label: "Fast Responder",
      icon: <Zap className="w-3 h-3 fill-current" />,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      description: "Responds to 90%+ of inquiries within an hour"
    });
  }

  // Milestone Badges
  const jobsDone = profile.totalJobsDone || 0;
  const boostedEmergencyJobsDone = profile.boostedEmergencyJobsDone || 0;

  if (boostedEmergencyJobsDone >= 3) {
    badges.push({
      id: "community_hero",
      label: "Community Hero",
      icon: <Zap className="w-3 h-3 text-red-500 fill-current" />,
      color: "text-red-600",
      bgColor: "bg-red-50",
      description: "Stepped up for 3+ Premium Emergency Jobs"
    });
  }

  if (jobsDone >= 50) {
    badges.push({
      id: "milestone_50",
      label: "50+ Jobs",
      icon: <Trophy className="w-3 h-3" />,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      description: "Completed over 50 jobs on the platform"
    });
  } else if (jobsDone >= 10) {
    badges.push({
      id: "milestone_10",
      label: "10+ Jobs",
      icon: <CheckCircle2 className="w-3 h-3" />,
      color: "text-green-600",
      bgColor: "bg-green-50",
      description: "Completed over 10 jobs on the platform"
    });
  }

  // Verification Badge (Tiered)
  if (profile.verificationStatus === "auditioned") {
    badges.push({
      id: "auditioned_pro",
      label: "Auditioned Pro",
      icon: <Medal className="w-3 h-3 text-amber-600 fill-amber-500" />,
      color: "text-amber-700",
      bgColor: "bg-amber-100",
      description: "Highest trust level: Work physically inspected and approved by AnyTrader experts"
    });
  } else if (profile.verificationStatus === "vetted") {
    badges.push({
      id: "vetted_pro",
      label: "Vetted Pro",
      icon: <ShieldCheck className="w-3 h-3 text-emerald-600 fill-emerald-500" />,
      color: "text-emerald-700",
      bgColor: "bg-emerald-100",
      description: "Enhanced trust level: Multiple references checked and past work reviewed"
    });
  } else if (profile.verificationStatus === "verified") {
    badges.push({
      id: "verified_pro",
      label: "Verified Pro",
      icon: <Award className="w-3 h-3" />,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      description: "Identity and insurance documents verified"
    });
  }

  // Local Badge (Example logic)
  if (profile.isLocalFavorite) {
    badges.push({
      id: "local_favorite",
      label: "Local Favorite",
      icon: <MapPin className="w-3 h-3" />,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      description: "Highly rated by homeowners in their local area"
    });
  }

  return badges;
};

export const BadgeOverlay = ({ badges, className = "" }: { badges: Badge[], className?: string }) => {
  if (!badges || badges.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {badges.slice(0, 2).map((badge) => (
        <div 
          key={badge.id}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full ${badge.bgColor} ${badge.color} border border-current/10 shadow-sm`}
          title={badge.description}
        >
          {badge.icon}
          <span className="text-[8px] font-black uppercase tracking-tighter whitespace-nowrap">
            {badge.label}
          </span>
        </div>
      ))}
    </div>
  );
};

import React from "react";
import { Camera, Zap, Star, Users, Briefcase, Clock, Shield, Award, Pencil, MapPin, Calendar } from "lucide-react";
import { getTraderBadges, BadgeOverlay } from "@/src/lib/badges";
import { cn } from "@/src/lib/utils";

interface TraderIdentityCardProps {
  profile: any;
  onEditClick: () => void;
  onPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isUploading: boolean;
}

export const TraderIdentityCard: React.FC<TraderIdentityCardProps> = ({
  profile,
  onEditClick,
  onPhotoUpload,
  isUploading,
}) => {
  const traderBadges = getTraderBadges(profile);

  return (
    <div className="bg-white rounded-[2rem] border border-black shadow-md bg-gradient-to-b from-white to-slate-50/50 overflow-hidden p-5 sm:p-7 relative">
      {/* Edit button */}
      <button 
        onClick={onEditClick}
        className="absolute top-5 right-5 p-2.5 rounded-full bg-slate-50 border border-black text-slate-700 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-xs cursor-pointer"
        title="Edit Profile"
      >
        <Pencil className="w-4 h-4" />
      </button>

      {/* Identity Top Row */}
      <div className="flex flex-col items-center text-center">
        {/* Avatar */}
        <div className="relative mb-4">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-slate-900 flex items-center justify-center text-white text-2xl md:text-3xl font-bold overflow-hidden border-4 border-white shadow-lg relative">
            {profile.photoURL ? (
              <img src={profile.photoURL} alt={profile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              profile.name?.charAt(0).toUpperCase() || "T"
            )}
            <BadgeOverlay 
              badges={traderBadges} 
              className="absolute -bottom-2 -left-2 -right-2 justify-center z-10" 
            />
          </div>
          <label className="absolute bottom-0 right-0 w-8 h-8 md:w-9 md:h-9 bg-white rounded-full shadow-md flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors border border-black">
            <Camera className="w-4 h-4 text-orange-500" />
            <input type="file" className="hidden" accept="image/*" onChange={onPhotoUpload} disabled={isUploading} />
          </label>
        </div>

        {/* Name & Boost */}
        <h2 className="text-2xl font-black text-slate-900 mb-1 flex items-center justify-center gap-2">
          {profile.name || "Trade Professional"}
          {profile.referralBoostUntil && new Date(profile.referralBoostUntil) > new Date() && (
            <div className="w-6 h-6 bg-yellow-400 rounded-lg flex items-center justify-center shadow-lg shadow-yellow-400/20" title="Profile Boost Active">
              <Zap className="w-4 h-4 text-slate-900 fill-slate-900" />
            </div>
          )}
        </h2>

        {/* Location & Member Since */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-slate-700 mb-4">
          <span className="px-2.5 py-0.5 bg-slate-100 rounded-full border border-black text-black text-[11px] font-black">Professional Tradesperson</span>
          <span className="text-black">•</span>
          <span className="flex items-center gap-1 text-black font-bold">
            <MapPin className="w-3.5 h-3.5 text-black" />
            {profile.postcode || profile.location || "Location not set"}
          </span>
          <span className="text-black">•</span>
          <span className="flex items-center gap-1 text-black font-bold">
            <Calendar className="w-3.5 h-3.5 text-black" />
            Member since {new Date(profile.createdAt?.seconds * 1000 || Date.now()).getFullYear()}
          </span>
        </div>

        {/* Rating & Recommendation Box */}
        <div className="flex items-stretch gap-3 bg-white p-2 rounded-[1.5rem] border border-black shadow-md w-full max-w-sm mb-6">
          <div className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-900 rounded-2xl shadow-sm border border-black">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <div className="flex flex-col items-start">
              <span className="font-black text-white text-base leading-none">{profile.rating?.toFixed(1) || "5.0"}</span>
              <span className="text-slate-300 text-[9px] font-black uppercase tracking-tighter mt-0.5">{profile.totalReviews || 0} reviews</span>
            </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-green-50 rounded-2xl border border-black">
            <div className="w-6 h-6 rounded-lg bg-green-600 flex items-center justify-center shadow-sm shrink-0 border border-black">
              <Users className="w-3 h-3 text-white" />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-[8px] font-black text-green-900 uppercase tracking-widest leading-none mb-0.5">Recmd By</span>
              <span className="text-base font-black text-black leading-none">{profile.totalRecommendations || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics Trio */}
      <div className="grid grid-cols-3 gap-3 pt-5 border-t border-black">
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-black text-center">
          <div className="w-9 h-9 mx-auto bg-white rounded-xl border border-black flex items-center justify-center mb-1.5 shadow-xs">
            <Briefcase className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-lg font-black text-black leading-tight">{profile.totalJobsDone || 0}</p>
          <p className="text-[10px] text-black font-bold uppercase tracking-wider">Jobs Done</p>
        </div>

        <div className="bg-slate-50 p-3.5 rounded-2xl border border-black text-center">
          <div className="w-9 h-9 mx-auto bg-white rounded-xl border border-black flex items-center justify-center mb-1.5 shadow-xs">
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-lg font-black text-black leading-tight">{profile.acceptanceRate || 100}%</p>
          <p className="text-[10px] text-black font-bold uppercase tracking-wider">Response</p>
        </div>

        <div className="bg-slate-50 p-3.5 rounded-2xl border border-black text-center">
          <div className="w-9 h-9 mx-auto bg-white rounded-xl border border-black flex items-center justify-center mb-1.5 shadow-xs">
            <Shield className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-lg font-black text-black leading-tight">{profile.trustScore || 95}</p>
          <p className="text-[10px] text-black font-bold uppercase tracking-wider">Trust Score</p>
        </div>
      </div>

      {/* Badges, Milestones & Achievements */}
      <div className="mt-6 pt-5 border-t border-black">
        <h3 className="text-xs font-black text-black uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <Award className="w-4 h-4 text-indigo-600" />
          Badges, Milestones & Achievements
        </h3>

        {/* Milestone Badges Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {traderBadges.map((badge) => (
            <div 
              key={badge.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-2xl border border-black transition-all hover:shadow-sm",
                badge.bgColor,
                badge.color
              )}
            >
              <div className="w-9 h-9 rounded-xl bg-white border border-black flex items-center justify-center shadow-xs shrink-0">
                {badge.icon}
              </div>
              <div className="min-w-0">
                <p className="font-black text-xs uppercase tracking-tight truncate text-black">{badge.label}</p>
                <p className="text-[10px] text-black font-medium leading-tight line-clamp-1">{badge.description}</p>
              </div>
            </div>
          ))}

          {/* Standard Trust Achievements */}
          <div className="bg-blue-50/70 p-3 rounded-2xl border border-black flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-black flex items-center justify-center shadow-xs shrink-0 text-blue-600">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <p className="font-black text-xs text-black uppercase tracking-tight">{profile.trustScore || 95} Trust Score</p>
              <p className="text-[10px] text-black font-medium">Highly reliable professional</p>
            </div>
          </div>

          <div className="bg-orange-50/70 p-3 rounded-2xl border border-black flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-black flex items-center justify-center shadow-xs shrink-0 text-orange-500">
              <Star className="w-4 h-4 fill-orange-500" />
            </div>
            <div>
              <p className="font-black text-xs text-black uppercase tracking-tight">Top Rated</p>
              <p className="text-[10px] text-black font-medium">{profile.rating?.toFixed(1) || "5.0"} average rating</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

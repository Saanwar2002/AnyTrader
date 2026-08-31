import React from "react";
import { Camera, Star, Pencil, Calendar, Mail, MapPin } from "lucide-react";

interface HomeownerIdentityCardProps {
  profile: any;
  onEditClick: () => void;
  onPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isUploading: boolean;
  activePortal: string;
}

export const HomeownerIdentityCard: React.FC<HomeownerIdentityCardProps> = ({
  profile,
  onEditClick,
  onPhotoUpload,
  isUploading,
  activePortal,
}) => {
  return (
    <div className="bg-white rounded-[2rem] border border-black shadow-md bg-gradient-to-b from-white to-slate-50/50 overflow-hidden p-5 sm:p-7 relative">
      <button 
        onClick={onEditClick}
        className="absolute top-5 right-5 p-2.5 rounded-full bg-slate-50 border border-black text-slate-700 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-xs cursor-pointer"
        title="Edit Profile"
      >
        <Pencil className="w-4 h-4" />
      </button>

      <div className="flex flex-col items-center text-center">
        {/* Avatar */}
        <div className="relative mb-4">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-slate-900 flex items-center justify-center text-white text-2xl md:text-3xl font-bold overflow-hidden border-4 border-white shadow-lg relative">
            {profile.photoURL ? (
              <img src={profile.photoURL} alt={profile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              profile.name?.charAt(0).toUpperCase() || "U"
            )}
          </div>
          <label className="absolute bottom-0 right-0 w-8 h-8 md:w-9 md:h-9 bg-white rounded-full shadow-md flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors border border-black">
            <Camera className="w-4 h-4 text-orange-500" />
            <input type="file" className="hidden" accept="image/*" onChange={onPhotoUpload} disabled={isUploading} />
          </label>
        </div>

        {/* Name */}
        <h2 className="text-2xl font-black text-slate-900 mb-1">
          {profile.name || "Homeowner"}
        </h2>

        {/* Email & Rating */}
        <p className="text-slate-500 text-xs font-medium mb-3 flex items-center gap-1.5 justify-center">
          <Mail className="w-3.5 h-3.5" />
          {profile.email}
        </p>

        {profile.homeownerRating && (
          <div className="inline-flex items-center gap-1.5 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 mb-3">
            <Star className="w-3.5 h-3.5 text-blue-600 fill-blue-600" />
            <span className="text-xs font-bold text-blue-800">
              Homeowner Rating: {profile.homeownerRating?.toFixed(1) || '5.0'} ({profile.totalHomeownerReviews || 0} reviews)
            </span>
          </div>
        )}

        {activePortal === "anyroller" && profile.role !== "driver" && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-100 rounded-full border border-black shadow-2xs mb-3">
            <Star className="w-4 h-4 text-slate-900 fill-slate-900" />
            <span className="font-black text-slate-900 text-sm">{profile.rating?.toFixed(1) || "5.0"}</span>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Rider Rating</span>
          </div>
        )}

        {/* Location & Member Since */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-slate-500 pt-2 border-t border-black/10 w-full">
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            {profile.postcode || profile.location || "Location not set"}
          </span>
          <span className="text-slate-300">•</span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            Member since {new Date(profile.createdAt?.seconds * 1000 || Date.now()).getFullYear()}
          </span>
        </div>
      </div>
    </div>
  );
};

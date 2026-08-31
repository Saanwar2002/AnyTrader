import React, { useState } from "react";
import { 
  FileText, Info, Pencil, CheckCircle2, Briefcase, Plus, Trash2, 
  ImageIcon, Loader2, GripVertical, Check, X, ShieldCheck, Clock, Shield,
  CheckCircle, MapPin, Heart, Star, AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  TouchSensor
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PROFESSIONAL_BADGES } from "@/src/constants";
import { cn } from "@/src/lib/utils";

function SortablePortfolioItem({ url, onRemove }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: url });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={cn(
        "group relative aspect-square rounded-2xl overflow-hidden border border-black shadow-xs bg-slate-50 cursor-grab active:cursor-grabbing",
        isDragging && "shadow-xl ring-2 ring-blue-600 scale-105"
      )}
    >
      <div className="w-full h-full" {...attributes} {...listeners}>
        <img 
          src={url} 
          alt="Portfolio" 
          className="w-full h-full object-cover transition-transform group-hover:scale-110" 
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-2 right-2 p-1.5 bg-white/95 backdrop-blur-xs rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-xs text-black border border-black">
          <GripVertical className="w-4 h-4" />
        </div>
      </div>
      
      <div className="absolute inset-0 bg-black/40 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
        <button 
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(url);
          }}
          className="p-2 bg-white rounded-full text-red-600 hover:bg-red-50 transition-colors shadow-md pointer-events-auto active:scale-90 cursor-pointer border border-black"
          title="Delete Image"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

interface BioOfferingsCardProps {
  profile: any;
  onEditProfile: () => void;
  onOpenBioInfo: () => void;
  onToggleBadge?: (badgeId: string) => void;
  onRemoveTrade?: (trade: string) => void;
  onRemoveTag?: (tag: string) => void;
  // Services
  isEditingServices: boolean;
  servicesList: string[];
  newServiceInput: string;
  setNewServiceInput: (val: string) => void;
  handleAddService: () => void;
  handleRemoveService: (index: number) => void;
  handleClearAllServices: () => void;
  startEditingServices: () => void;
  saveServices: () => void;
  cancelEditingServices: () => void;
  // Portfolio
  portfolioImages: string[];
  handlePortfolioUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemovePortfolioImage: (url: string) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  isUploadingPortfolio: boolean;
}

export const BioOfferingsCard: React.FC<BioOfferingsCardProps> = ({
  profile,
  onEditProfile,
  onOpenBioInfo,
  onToggleBadge,
  onRemoveTrade,
  onRemoveTag,
  isEditingServices,
  servicesList,
  newServiceInput,
  setNewServiceInput,
  handleAddService,
  handleRemoveService,
  handleClearAllServices,
  startEditingServices,
  saveServices,
  cancelEditingServices,
  portfolioImages,
  handlePortfolioUpload,
  handleRemovePortfolioImage,
  handleDragEnd,
  isUploadingPortfolio,
}) => {
  const [itemToDelete, setItemToDelete] = useState<{ name: string; type: "trade" | "tag" } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Extract all trades and skills from profile
  const allTrades = [
    ...(Array.isArray(profile.trades) ? profile.trades : typeof profile.trades === "string" ? profile.trades.split(",") : []),
    ...(profile.primaryTrade ? [profile.primaryTrade] : []),
    ...(profile.category ? [profile.category] : []),
    ...(Array.isArray(profile.categories) ? profile.categories : []),
    ...(Array.isArray(profile.skills) ? profile.skills : [])
  ];
  const cleanTrades = Array.from(
    new Set(
      allTrades
        .map((t: any) => (typeof t === "string" ? t.trim() : (t?.name || t?.title || "").trim()))
        .filter((t: string) => t.length > 0)
    )
  );

  const allTags = [
    ...(Array.isArray(profile.tags) ? profile.tags : typeof profile.tags === "string" ? profile.tags.split(",") : []),
    ...(Array.isArray(profile.specialistTags) ? profile.specialistTags : []),
    ...(Array.isArray(profile.specialisms) ? profile.specialisms : [])
  ];
  const cleanTags = Array.from(
    new Set(
      allTags
        .map((t: any) => (typeof t === "string" ? t.trim().replace(/^#+/, "") : (t?.name || t?.title || "").trim()))
        .filter((t: string) => t.length > 0)
    )
  ).slice(0, 15);

  // Extract additional unique services that might not be in cleanTrades
  const rawServices = (Array.isArray(profile.services) && profile.services.length > 0)
    ? profile.services
    : (Array.isArray(profile.productsAndServices) && profile.productsAndServices.length > 0)
    ? profile.productsAndServices
    : (Array.isArray(profile.offeredServices) && profile.offeredServices.length > 0)
    ? profile.offeredServices
    : (Array.isArray(profile.specialistServices) && profile.specialistServices.length > 0)
    ? profile.specialistServices
    : (Array.isArray(profile.fixedServices) && profile.fixedServices.length > 0)
    ? profile.fixedServices
    : [];

  const cleanServices = Array.from(
    new Set(
      rawServices
        .map((s: any) => {
          if (typeof s === "string") return s.trim();
          if (typeof s === "object" && s !== null) return (s.name || s.title || s.label || s.service || "").trim();
          return "";
        })
        .filter((s: string) => s.length > 0)
    )
  );

  // Deduplicated unified list of all offerings (Trades, Skills & Specific Services, Max 15)
  const unifiedOfferings = Array.from(
    new Set([
      ...cleanTrades,
      ...cleanServices
    ])
  ).slice(0, 15);

  const activeBadges = [
    ...(Array.isArray(profile.professionalBadges) ? profile.professionalBadges : []),
    ...(Array.isArray(profile.badges) ? profile.badges : []),
    ...(Array.isArray(profile.verifiedBadges) ? profile.verifiedBadges : [])
  ];

  const actualPortfolioImages = (portfolioImages && portfolioImages.length > 0)
    ? portfolioImages
    : (Array.isArray(profile.portfolio) && profile.portfolio.length > 0)
    ? profile.portfolio
    : (Array.isArray(profile.portfolioPhotos) && profile.portfolioPhotos.length > 0)
    ? profile.portfolioPhotos
    : (Array.isArray(profile.workPhotos) && profile.workPhotos.length > 0)
    ? profile.workPhotos
    : (Array.isArray(profile.images) && profile.images.length > 0)
    ? profile.images
    : [];

  const badgeIconMap: Record<string, any> = {
    ShieldCheck,
    Clock,
    FileText,
    Shield,
    CheckCircle,
    MapPin,
    Heart,
    Star
  };

  return (
    <div className="bg-white rounded-[2rem] border border-black shadow-md bg-gradient-to-b from-white to-slate-50/50 overflow-hidden p-5 sm:p-7 relative space-y-7">
      
      {/* 1. About / Bio */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-black">
              <FileText className="w-4 h-4" />
            </div>
            <h3 className="text-base font-black text-black">About Business</h3>
            <button 
              onClick={onOpenBioInfo}
              className="p-1 text-slate-400 hover:text-black transition-colors"
              title="Bio writing tips"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>
          <button 
            onClick={onEditProfile}
            className="flex items-center gap-1 text-[11px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-wider cursor-pointer"
          >
            <Pencil className="w-3 h-3" />
            Edit Bio
          </button>
        </div>
        <p className="text-xs sm:text-sm text-black leading-relaxed font-medium bg-slate-50/70 p-4 rounded-2xl border border-black">
          {profile.bio || "No business description provided yet. Click 'Edit Bio' to add your experience, trade history, and why clients should choose you."}
        </p>
      </div>

      {/* 2. Unified Specialist Trades, Skills & Services */}
      <div className="pt-5 border-t border-black">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-black">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-black uppercase tracking-widest">
                Specialist Trades, Skills & Services
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">Used for AI search matching and customer job dispatch</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {!isEditingServices ? (
              <button 
                onClick={startEditingServices}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all text-[11px] font-black uppercase tracking-wider border border-black cursor-pointer shadow-sm active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                Add / Manage
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button 
                  onClick={saveServices}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-green-600 text-white hover:bg-green-700 text-[11px] font-black uppercase tracking-wider cursor-pointer shadow-xs border border-black"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save
                </button>
                <button 
                  onClick={cancelEditingServices}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 text-black hover:bg-slate-200 text-[11px] font-black uppercase tracking-wider border border-black cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  Done
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Quick Add / Manage Panel when editing */}
        {isEditingServices && (
          <div className="mb-4 space-y-3 bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-black animate-in fade-in duration-200">
            <div className="flex items-center gap-2 w-full">
              <input 
                type="text" 
                placeholder={servicesList.length >= 15 ? "Max 15 skills/services reached" : "e.g. Washing Machine Repair, Rewiring, Boiler Service"}
                disabled={servicesList.length >= 15}
                className="flex-1 min-w-0 bg-white p-2.5 rounded-xl border border-black text-xs font-bold text-black focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:opacity-75 disabled:cursor-not-allowed"
                value={newServiceInput}
                onChange={(e) => setNewServiceInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && servicesList.length < 15 && handleAddService()}
              />
              <button 
                type="button"
                onClick={handleAddService}
                disabled={servicesList.length >= 15}
                className="shrink-0 px-3.5 sm:px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-colors flex items-center gap-1 cursor-pointer border border-black shadow-xs disabled:bg-slate-400 disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Add ({servicesList.length}/15)</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1">
              <span className="text-[11px] font-bold text-slate-500">
                Click any <Trash2 className="w-3 h-3 inline text-red-500 -mt-0.5" /> or ✕ icon on a pill below to instantly remove it.
              </span>
              {servicesList.length > 0 && (
                <button 
                  type="button"
                  onClick={handleClearAllServices}
                  className="text-[10px] font-black text-red-600 hover:underline uppercase tracking-wider cursor-pointer self-end sm:self-auto"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>
        )}

        {/* Double Confirmation Banner when NOT in edit mode */}
        <AnimatePresence>
          {!isEditingServices && itemToDelete && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -6 }}
              className="mb-4 p-3.5 bg-red-50 border-2 border-red-600 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0 border border-red-300">
                  <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <p className="text-xs font-black text-red-950">
                    Confirm Removal: Delete "{itemToDelete.name}"?
                  </p>
                  <p className="text-[11px] font-bold text-red-800">
                    This will remove this skill from your profile and AI search index.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  className="px-3 py-1.5 bg-white text-black border border-black hover:bg-slate-100 rounded-xl text-xs font-black transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (itemToDelete.type === "tag") {
                      onRemoveTag?.(itemToDelete.name);
                    } else {
                      onRemoveTrade?.(itemToDelete.name);
                    }
                    setItemToDelete(null);
                  }}
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black border border-black shadow-sm transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Yes, Delete</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Unified Pills Display */}
        <div className="flex flex-wrap gap-2">
          {unifiedOfferings.map((item: string, idx: number) => (
            <span 
              key={`offering-${idx}`}
              className="group inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-black text-black rounded-xl text-xs font-black shadow-2xs transition-all hover:bg-blue-100"
            >
              <span className="break-words leading-tight">{item}</span>
              {onRemoveTrade && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isEditingServices) {
                      onRemoveTrade(item);
                    } else {
                      setItemToDelete({ name: item, type: "trade" });
                    }
                  }}
                  className="w-3.5 h-3.5 rounded-full bg-slate-200/90 hover:bg-red-600 hover:text-white flex items-center justify-center text-slate-800 transition-all cursor-pointer ml-1 shrink-0 border border-slate-300 hover:border-black"
                  title={`Remove ${item}`}
                >
                  <X className="w-2 h-2 stroke-[3]" />
                </button>
              )}
            </span>
          ))}

          {cleanTags.map((tag: string, idx: number) => (
            <span 
              key={`tag-${idx}`}
              className="group inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-black text-black rounded-xl text-xs font-bold shadow-2xs transition-all hover:bg-slate-200"
            >
              <span>#{tag}</span>
              {onRemoveTag && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isEditingServices) {
                      onRemoveTag(tag);
                    } else {
                      setItemToDelete({ name: tag, type: "tag" });
                    }
                  }}
                  className="w-3.5 h-3.5 rounded-full bg-slate-200/90 hover:bg-red-600 hover:text-white flex items-center justify-center text-slate-800 transition-all cursor-pointer ml-1 shrink-0 border border-slate-300 hover:border-black"
                  title={`Remove #${tag}`}
                >
                  <X className="w-2 h-2 stroke-[3]" />
                </button>
              )}
            </span>
          ))}

          {(!unifiedOfferings.length && !cleanTags.length) && (
            <div className="w-full py-4 text-center bg-slate-50 rounded-xl border border-dashed border-black">
              <p className="text-xs text-slate-500 font-medium">No skills or services listed yet. Click 'Add / Manage' to add your trade offerings.</p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Professional Trust Badges */}
      <div className="pt-5 border-t border-black">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-green-50 text-green-600 flex items-center justify-center border border-black">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-black uppercase tracking-widest">
                Professional Guarantees & Features
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">Badges highlighted on your public profile & mini cards</p>
            </div>
          </div>
          <button 
            onClick={onEditProfile}
            className="text-[11px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-wider cursor-pointer"
          >
            Manage
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {PROFESSIONAL_BADGES.map((badge) => {
            const isSelected = activeBadges.includes(badge.id) || (badge.id === 'local_business' && profile.role === 'business');
            const IconComponent = badgeIconMap[badge.icon] || CheckCircle2;
            const badgeLabel = badge.name || (badge as any).label || "Feature";

            return (
              <button 
                key={badge.id}
                type="button"
                onClick={() => onToggleBadge ? onToggleBadge(badge.id) : onEditProfile()}
                className={cn(
                  "p-2.5 rounded-xl border border-black flex items-center gap-2 text-xs font-black transition-all cursor-pointer text-left shadow-2xs",
                  isSelected 
                    ? "bg-green-50 text-black ring-1 ring-black" 
                    : "bg-slate-50/70 text-black hover:bg-slate-100 opacity-70 hover:opacity-100"
                )}
                title={isSelected ? "Click to toggle or manage" : "Click to enable guarantee"}
              >
                <div className={cn(
                  "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[10px] border border-black",
                  isSelected ? "bg-green-600 text-white" : "bg-white text-slate-400"
                )}>
                  {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <IconComponent className="w-3.5 h-3.5 text-slate-400" />}
                </div>
                <span className="text-[11px] text-black font-bold flex-1 leading-tight">{badgeLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Work Portfolio Gallery */}
      <div className="pt-5 border-t border-black">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-black">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-black uppercase tracking-widest">
                Work Portfolio Gallery
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">Showcase previous work to win 3x more bookings</p>
            </div>
          </div>
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all text-[11px] font-black uppercase tracking-wider cursor-pointer shadow-xs border border-black">
            {isUploadingPortfolio ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            {isUploadingPortfolio ? "Uploading..." : "Add Photos"}
            <input 
              type="file" 
              className="hidden" 
              accept="image/*" 
              multiple 
              onChange={handlePortfolioUpload}
              disabled={isUploadingPortfolio} 
            />
          </label>
        </div>

        {actualPortfolioImages.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={actualPortfolioImages}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {actualPortfolioImages.map((url) => (
                  <SortablePortfolioItem 
                    key={url} 
                    url={url} 
                    onRemove={handleRemovePortfolioImage} 
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-black">
            <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-black">No portfolio photos uploaded yet</p>
            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Showcase your completed jobs to build trust and win 3x more bookings.</p>
          </div>
        )}
      </div>

    </div>
  );
};

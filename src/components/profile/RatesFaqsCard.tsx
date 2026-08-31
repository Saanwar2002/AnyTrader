import React from "react";
import { 
  PoundSterling, Zap, HelpCircle, Pencil, Check, Plus, Trash2, 
  Sparkles, Loader2 
} from "lucide-react";
import { cn } from "@/src/lib/utils";

export const FAQ_PRESETS = [
  { question: "Do you offer emergency callouts?", answer: "Yes, we are available for emergency callouts with fast local response." },
  { question: "Do you provide free written estimates?", answer: "Yes, we provide completely free, no-obligation written quotes." },
  { question: "Are your work and parts guaranteed?", answer: "Yes, all our workmanship and installed parts come with a full guarantee." },
  { question: "Are you fully insured with public liability?", answer: "Yes, we hold comprehensive public liability insurance for your complete peace of mind." },
];

interface RatesFaqsCardProps {
  profile: any;
  onEditMiniProfile: () => void;
  onEditInstantMatch: () => void;
  // FAQs
  faqs: Array<{ id: string; question: string; answer: string }>;
  isEditingFaqs: boolean;
  setIsEditingFaqs: (val: boolean) => void;
  isSavingFaqs: boolean;
  handleSaveFaqs: () => void;
  handleAddPresetFaq: (preset: { question: string; answer: string }) => void;
  handleUpdateFaq: (id: string, field: "question" | "answer", val: string) => void;
  handleDeleteFaq: (id: string) => void;
  handleAddCustomFaq: () => void;
}

export const RatesFaqsCard: React.FC<RatesFaqsCardProps> = ({
  profile,
  onEditMiniProfile,
  onEditInstantMatch,
  faqs,
  isEditingFaqs,
  setIsEditingFaqs,
  isSavingFaqs,
  handleSaveFaqs,
  handleAddPresetFaq,
  handleUpdateFaq,
  handleDeleteFaq,
  handleAddCustomFaq,
}) => {
  const callOutFee = profile.miniProfilePricing?.callOutFee ?? profile.miniProfileSettings?.callOutFee ?? profile.callOutFee;
  const hourlyRate = profile.miniProfilePricing?.hourlyRate ?? profile.miniProfileSettings?.hourlyRate ?? profile.hourlyRate;
  const extraInfo = profile.miniProfilePricing?.extraInfo || profile.miniProfileSettings?.extraInfo || profile.extraInfo;

  const imPricing = profile.instantMatchPricing || profile.instantMatchSettings || {};
  const imEnabled = profile.isAvailableForInstantMatch ?? imPricing.enabled ?? (profile.instantMatchPricing?.enabled !== false);
  const imCallOutFee = imPricing.callOutFee ?? profile.emergencyCallOutFee;
  const imHourlyRate = imPricing.hourlyRate ?? profile.emergencyHourlyRate;
  const imTerms = imPricing.terms || profile.emergencyTerms;

  return (
    <div className="bg-white rounded-[2rem] border border-black shadow-md bg-gradient-to-b from-white to-slate-50/50 overflow-hidden p-5 sm:p-7 relative space-y-7">
      
      {/* 1. Standard Rates & Mini Profile Card Settings */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-black">
              <PoundSterling className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-black leading-tight">Standard Rates & Availability</h3>
              <p className="text-[11px] text-black font-medium">Displayed on your mini profile card</p>
            </div>
          </div>
          <button 
            onClick={onEditMiniProfile}
            className="flex items-center gap-1 text-[11px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-wider cursor-pointer"
          >
            <Pencil className="w-3 h-3" />
            Edit Rates
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-black text-center">
            <p className="text-[10px] text-black font-black uppercase tracking-widest mb-0.5">Call-Out Fee</p>
            <p className="text-xl font-black text-black">
              {callOutFee !== undefined && callOutFee !== null ? `£${callOutFee}` : "Free"}
            </p>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-black text-center">
            <p className="text-[10px] text-black font-black uppercase tracking-widest mb-0.5">Hourly Rate</p>
            <p className="text-xl font-black text-black">
              {hourlyRate !== undefined && hourlyRate !== null ? `£${hourlyRate}/hr` : "£45/hr"}
            </p>
          </div>
        </div>
        {extraInfo && (
          <p className="text-xs text-black mt-2 font-medium bg-slate-50 p-2.5 rounded-xl border border-black">
            Note: {extraInfo}
          </p>
        )}
      </div>

      {/* 2. Instant Match Emergency Dispatch Settings */}
      <div className="pt-5 border-t border-black">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-black">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-black leading-tight">Instant Match Emergency Dispatch</h3>
              <p className="text-[11px] text-black font-medium">Auto-dispatch rates for urgent homeowner callouts</p>
            </div>
          </div>
          <button 
            onClick={onEditInstantMatch}
            className="flex items-center gap-1 text-[11px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-wider cursor-pointer"
          >
            <Pencil className="w-3 h-3" />
            Edit Settings
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-black">
            <span className="text-xs font-bold text-black">Instant Match Status</span>
            <span className={cn(
              "px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border border-black",
              imEnabled 
                ? "bg-green-100 text-black" 
                : "bg-slate-200 text-black"
            )}>
              {imEnabled ? "Active & Ready" : "Disabled"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 p-3 rounded-2xl border border-black text-center">
              <p className="text-[10px] text-black font-bold uppercase">Emergency Call-Out</p>
              <p className="text-base font-black text-black">
                {imCallOutFee !== undefined && imCallOutFee !== null ? `£${imCallOutFee}` : "£0"}
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl border border-black text-center">
              <p className="text-[10px] text-black font-bold uppercase">Emergency Hourly</p>
              <p className="text-base font-black text-black">
                {imHourlyRate !== undefined && imHourlyRate !== null ? `£${imHourlyRate}/hr` : "£50/hr"}
              </p>
            </div>
          </div>

          {imTerms && (
            <div className="bg-amber-50/70 border border-black p-3 rounded-2xl">
              <p className="text-[9px] text-black font-black uppercase tracking-widest mb-0.5">Custom Terms</p>
              <p className="text-xs font-medium text-black">{imTerms}</p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Frequently Asked Questions (FAQs) Manager */}
      <div id="faqs" className="pt-5 border-t border-black">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-black">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-black leading-tight">Customer FAQs</h3>
              <p className="text-[11px] text-black font-medium">Answer common customer questions on your public profile</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={handleSaveFaqs}
            disabled={isSavingFaqs}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-xs disabled:opacity-50 cursor-pointer border border-black"
          >
            {isSavingFaqs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Save FAQs
          </button>
        </div>

        {/* 1-Click Preset Questions Bar */}
        <div className="bg-slate-50 border border-black rounded-2xl p-3.5 mb-4">
          <div className="flex items-center gap-1.5 text-xs font-black text-black mb-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>1-Click Preset Templates:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FAQ_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAddPresetFaq(preset)}
                className="text-[11px] font-bold bg-white text-black hover:text-indigo-600 hover:bg-indigo-50 px-2.5 py-1 rounded-lg border border-black shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3 text-indigo-600" />
                {preset.question}
              </button>
            ))}
          </div>
        </div>

        {/* List of FAQs */}
        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div key={faq.id || index} className="p-3.5 bg-white rounded-2xl border border-black shadow-xs space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-black bg-indigo-50 px-2 py-0.5 rounded-md border border-black">
                  Question {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteFaq(faq.id)}
                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-black"
                  title="Remove FAQ"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <input
                  type="text"
                  value={faq.question}
                  onChange={(e) => handleUpdateFaq(faq.id, "question", e.target.value)}
                  placeholder="e.g. Do you offer emergency callouts?"
                  className="w-full p-2 text-xs font-bold text-black border border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 bg-slate-50/50"
                />
              </div>

              <div>
                <textarea
                  rows={2}
                  value={faq.answer}
                  onChange={(e) => handleUpdateFaq(faq.id, "answer", e.target.value)}
                  placeholder="e.g. Yes, we offer 24/7 emergency callout services..."
                  className="w-full p-2 text-xs font-medium text-black border border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 bg-slate-50/50"
                />
              </div>
            </div>
          ))}

          {faqs.length === 0 && (
            <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-black">
              <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
              <p className="text-xs text-black font-medium">No FAQs added yet.</p>
              <button
                type="button"
                onClick={handleAddCustomFaq}
                className="mt-1 text-xs font-black text-indigo-600 hover:underline cursor-pointer"
              >
                + Add your first custom Q&A
              </button>
            </div>
          )}
        </div>

        {/* Action button */}
        <div className="flex items-center justify-between pt-3">
          <button
            type="button"
            onClick={handleAddCustomFaq}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-black rounded-xl text-xs font-bold border border-black transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Custom Q&A
          </button>

          <button
            type="button"
            onClick={handleSaveFaqs}
            disabled={isSavingFaqs}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer border border-black"
          >
            {isSavingFaqs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Save All FAQs
          </button>
        </div>
      </div>

    </div>
  );
};

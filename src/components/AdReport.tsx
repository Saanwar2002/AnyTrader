import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { ArrowLeft, Loader2, MousePointerClick, Calendar, Zap, FileText, CheckCircle2, PauseCircle } from "lucide-react";
import { cn } from "../lib/utils";
import PartnerAdvertisement from "./shared/PartnerAdvertisement";

export default function AdReport() {
  const { id } = useParams<{ id: string }>();
  const [ad, setAd] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "advertisements", id), (docSnapshot) => {
      if (docSnapshot.exists()) {
        setAd({ id: docSnapshot.id, ...docSnapshot.data() });
      } else {
        setAd(null);
      }
      setIsLoading(false);
    });
    return unsub;
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!ad) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center bg-white p-8 rounded-3xl border border-black w-full max-w-sm shadow-xl">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Campaign Not Found</h2>
          <p className="text-slate-500 mb-6">This advertisement campaign does not exist or has been deleted.</p>
        </div>
      </div>
    );
  }

  const startDate = ad.createdAt?.toDate ? ad.createdAt.toDate().toLocaleDateString() : "Starting soon...";
  
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-black">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-slate-900">Campaign Report</h1>
          <p className="text-slate-500">Live performance report for your advertising campaign</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Campaign Info */}
        <div className="bg-white p-6 rounded-3xl border border-black shadow-sm">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{ad.advertiserName || "Advertiser Campaign"}</h2>
              <p className="text-slate-500">{ad.title}</p>
            </div>
            <div>
              {ad.isActive ? (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold ring-1 ring-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Active
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold ring-1 ring-amber-200">
                  <PauseCircle className="w-3.5 h-3.5" /> Paused
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded-2xl p-4 border border-black flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                <MousePointerClick className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Total Clicks</p>
                <p className="text-2xl font-black text-slate-900">{ad.clicks || 0}</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-black flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Billing Cycle</p>
                <p className="text-lg font-black text-slate-900 capitalize">{ad.billingCycle || "N/A"}</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-black flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Start Date</p>
                <p className="text-lg font-black text-slate-900">{startDate}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div className="bg-white p-6 rounded-3xl border border-black shadow-sm">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Live Preview</h3>
          <p className="text-sm text-slate-500 mb-6">This is exactly how your banner appears to users on the platform.</p>
          
          <div className="bg-slate-100 p-8 rounded-2xl max-w-sm mx-auto border border-black relative">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center mb-4">App Mockup Viewer</div>
            
            {/* Direct preview rendering because PartnerAdvertisement pulls from DB list randomly */}
              {ad.imageUrl ? (
                <div className="w-full h-20 sm:h-24 rounded-2xl relative overflow-hidden bg-slate-100 flex items-center justify-center shadow-md">
                  <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className={cn("w-full h-20 sm:h-24 rounded-2xl relative overflow-hidden flex flex-col justify-center p-4 sm:p-5 text-white shadow-md block", ad.bgColor)} style={{ background: ad.bgColor.includes("bg-") ? undefined : ad.bgColor }}>
                   <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                       <Zap className="w-6 h-6 text-white" />
                     </div>
                     <div className="flex-1 min-w-0 pr-2">
                       <p className="text-sm sm:text-base font-black truncate leading-tight">{ad.title}</p>
                       <p className="text-xs sm:text-sm text-white/90 truncate leading-relaxed mt-1">{ad.description}</p>
                     </div>
                   </div>
                </div>
              )}
          </div>
        </div>

        <div className="text-center border-t border-black pt-8 mt-8">
          <p className="text-xs text-slate-400 font-bold">POWERED BY</p>
          <p className="text-sm font-black text-slate-300 tracking-tight mt-1">ANYTRADER ADS</p>
        </div>
      </div>
    </div>
  );
}

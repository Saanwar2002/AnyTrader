import React, { useState, useEffect } from "react";
import { 
  Gift, 
  Plus, 
  Trash2, 
  Search, 
  Save, 
  Percent, 
  Tag, 
  Clock, 
  CheckCircle,
  HelpCircle
} from "lucide-react";
import { db, collection, onSnapshot } from "../../firebase";
import { toast } from "sonner";

interface PromoCoupon {
  id: string;
  code: string;
  type: "percent" | "flat";
  value: number; // e.g. 25 for percent, 5 for flat
  usageCap: number;
  redeemedCount: number;
  status: "Active" | "Expired" | "Fully Redeemed";
  validUntil: string;
}

const initialPromosSeed: PromoCoupon[] = [
  { id: "prm_1", code: "HELLOROLLER25", type: "percent", value: 25, usageCap: 1000, redeemedCount: 450, status: "Active", validUntil: "2026-06-30" },
  { id: "prm_2", code: "AIRPORTDEP10", type: "flat", value: 10, usageCap: 200, redeemedCount: 185, status: "Active", validUntil: "2026-06-15" },
  { id: "prm_3", code: "OFF50DISPATCH", type: "percent", value: 50, usageCap: 50, redeemedCount: 50, status: "Fully Redeemed", validUntil: "2026-05-10" }
];

export default function Promotions() {
  const [promos, setPromos] = useState<PromoCoupon[]>(initialPromosSeed);
  const [searchQuery, setSearchQuery] = useState("");

  // New coupon states
  const [newCode, setNewCode] = useState("");
  const [newType, setNewType] = useState<"percent" | "flat">("percent");
  const [newValue, setNewValue] = useState(15);
  const [newUsageCap, setNewUsageCap] = useState(500);
  const [newExpiry, setNewExpiry] = useState("2026-06-30");

  const handleCreatePromo = () => {
    if (!newCode.trim()) {
      toast.error("Please supply a unique alpha-numeric Promo Code label.");
      return;
    }
    const capCode = newCode.toUpperCase().replace(/\s+/g, "");
    const newCoupon: PromoCoupon = {
      id: "prm_" + Math.floor(Math.random() * 9000 + 1000),
      code: capCode,
      type: newType,
      value: Number(newValue),
      usageCap: Number(newUsageCap),
      redeemedCount: 0,
      status: "Active",
      validUntil: newExpiry
    };

    setPromos([newCoupon, ...promos]);
    setNewCode("");
    toast.success(`Discount Code '${newCoupon.code}' deployed live securely.`);
  };

  const handleDeletePromo = (id: string) => {
    setPromos(prev => prev.filter(p => p.id !== id));
    toast.info("Voucher configuration removed.");
  };

  const filteredPromos = promos.filter(p => 
    p.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Intro Header HUD */}
      <div className="p-5 bg-white border border-black rounded-lg shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Gift className="w-4 h-4 text-[#AF52DE]" />
          <span className="text-[10px] uppercase font-mono tracking-widest text-[#AF52DE] font-bold">PROMOTIONS & DISCOUNT SYSTEMS</span>
        </div>
        <h2 className="text-xl font-bold text-black font-sans">Campaign Promotion Coupons</h2>
        <p className="text-xs text-slate-500 mt-1">
          Design percentage deductions or flat bonus coupons code, schedule expiry parameters, and enforce maximum user redemption thresholds.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Promos table */}
        <div className="lg:col-span-2 bg-white border border-black rounded-lg p-5 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-slate-705" /> Campaigns Directory Ledger
            </h3>

            {/* Promo Lookup */}
            <input 
              type="text" 
              placeholder="Search code vouchers..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-black text-xs text-black"
            />
          </div>

          <div className="space-y-3">
            {filteredPromos.map(coupon => (
              <div key={coupon.id} className="p-3.5 bg-slate-50 border border-black rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-[#AF52DE]">{coupon.id}</span>
                    <h4 className="text-sm font-black text-black font-mono tracking-wider">{coupon.code}</h4>
                    <span className={`text-[9.5px] uppercase font-mono font-bold px-1.5 py-0.2 border rounded ${
                      coupon.status === "Active" 
                        ? "bg-emerald-50 text-emerald-800 border-emerald-305" 
                        : "bg-stone-105 text-stone-650 border-stone-250"
                    }`}>
                      {coupon.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 mt-2 font-mono">
                    <span>Discount: <strong className="text-slate-800 font-extrabold">{coupon.type === "percent" ? `${coupon.value}%` : `£${coupon.value.toFixed(2)}`} Value</strong></span>
                    <span>Redeemed: <strong className="text-slate-800 font-bold">{coupon.redeemedCount} / {coupon.usageCap} times</strong></span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Expiry: <strong className="text-slate-800 font-bold">{coupon.validUntil}</strong>
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleDeletePromo(coupon.id)}
                  className="p-1 px-2.5 border border-red-500/20 text-red-655 hover:bg-rose-50 rounded transition cursor-pointer select-none self-end sm:self-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Deploy coupon panel */}
        <div className="bg-white border border-black rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <Plus className="w-3.5 h-3.5 text-emerald-555" />
            <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider">Deploy Campaign Coupon</h3>
          </div>

          <div className="space-y-4 font-sans">
            <div className="space-y-1">
              <label className="text-xs font-bold text-black block">Special Promo Code String</label>
              <input 
                type="text" 
                placeholder="e.g. SUMMERSAVER" 
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-black text-xs text-black uppercase font-mono font-black rounded"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-black block">Voucher Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-black text-xs text-stone-750 font-sans outline-none rounded"
                >
                  <option value="percent">Percentage %</option>
                  <option value="flat">Flat Cash £</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-black block">Discount Value</label>
                <input 
                  type="number" 
                  value={newValue}
                  onChange={(e) => setNewValue(Number(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-black text-xs text-[#AF52DE] font-mono font-extrabold rounded"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-black block">Global Usage Cap</label>
                <input 
                  type="number" 
                  value={newUsageCap}
                  onChange={(e) => setNewUsageCap(Number(e.target.value) || 50)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-black text-xs text-black font-mono rounded"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-black block">Validity Date Limit</label>
                <input 
                  type="date" 
                  value={newExpiry}
                  onChange={(e) => setNewExpiry(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-black text-xs text-slate-800 font-mono rounded"
                />
              </div>
            </div>

            <button
              onClick={handleCreatePromo}
              className="w-full py-2.5 bg-black hover:bg-slate-900 border border-black text-white text-xs font-mono font-black tracking-wider uppercase cursor-pointer rounded transition flex items-center justify-center gap-1.5"
            >
              <Percent className="w-4 h-4 text-emerald-400" /> Complete Coupon Launch
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

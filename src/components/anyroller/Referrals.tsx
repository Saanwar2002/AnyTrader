import React, { useState, useEffect } from "react";
import { 
  Link, 
  Settings, 
  Save, 
  Plus, 
  Trash2, 
  Users, 
  AlertOctagon, 
  DollarSign, 
  CheckCircle,
  HelpCircle,
  ShieldCheck,
  Compass
} from "lucide-react";
import { toast } from "sonner";

interface ReferralRecord {
  id: string;
  inviterName: string;
  inviteeName: string;
  incentiveAmount: number;
  redeemedAt: string;
  status: "Bounty Credited" | "Awaiting First Voyage" | "Flagged Suspicious";
}

const initialReferralsSeed: ReferralRecord[] = [
  { id: "ref_9011", inviterName: "Sarah Connor", inviteeName: "John Connor", incentiveAmount: 5.00, redeemedAt: "2026-05-28", status: "Bounty Credited" },
  { id: "ref_9012", inviterName: "David Jenkins", inviteeName: "Siddharth Jenkins", incentiveAmount: 5.00, redeemedAt: "2026-05-29", status: "Awaiting First Voyage" },
  { id: "ref_9013", inviterName: "Craig Henderson", inviteeName: "Craig Henderson (Alt)", incentiveAmount: 5.00, redeemedAt: "2026-05-27", status: "Flagged Suspicious" }
];

export default function Referrals() {
  const [referrals, setReferrals] = useState<ReferralRecord[]>(initialReferralsSeed);
  const [blockSameDevice, setBlockSameDevice] = useState(true);
  const [inviterBonus, setInviterBonus] = useState(5.00);
  const [inviteeCredit, setInviteeCredit] = useState(10.00);

  const handleToggleFraud = (id: string, status: "Bounty Credited" | "Flagged Suspicious") => {
    setReferrals(prev => prev.map(r => {
      if (r.id === id) {
        toast.info(`Override referral status.`);
        return { ...r, status };
      }
      return r;
    }));
  };

  const handleSaveParameters = () => {
    toast.success("Double-sided referral bonuses parameters updated.");
  };

  return (
    <div className="space-y-6">
      {/* Upper Title HUD */}
      <div className="p-5 bg-white border border-black rounded-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link className="w-4 h-4 text-[#AF52DE]" />
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#AF52DE] font-bold">CLIENT GROWTH NETWORK PROTOCOLS</span>
          </div>
          <h2 className="text-xl font-bold text-black font-sans">Double-Sided Referrals Ledger</h2>
          <p className="text-xs text-slate-500 mt-1">
            Track customer viral referrals codes, audit suspicious self-referral signups, and monitor double-sided cash credits disbursement.
          </p>
        </div>

        {/* IP Blocker Notification */}
        <div className="p-3 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded font-mono text-[9.5px] max-w-sm flex items-start gap-2 leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
          <div>
            <strong className="text-black block">Anti-Abuse Core Active</strong>
            Referral payouts are blocked when the Inviter and Invitee share the same financial Stripe card or hardware ID fingerprints.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Referrals table listings */}
        <div className="lg:col-span-2 bg-white border border-black rounded-lg p-5 shadow-sm space-y-4">
          <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-slate-705" /> Redemptions & Payout Audits
          </h3>

          <div className="space-y-3.5">
            {referrals.map(record => (
              <div key={record.id} className="p-4 bg-slate-50 border border-black rounded font-sans space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="font-sans font-black text-[#AF52DE]">{record.id}</span>
                    <span className="bg-white px-2 py-0.5 rounded border border-black/10 font-sans font-extrabold text-black">
                      Incentive Bounties: £{record.incentiveAmount.toFixed(2)}
                    </span>
                  </div>

                  <span className={`text-[9px] uppercase font-mono font-bold px-2 py-0.5 border rounded ${
                    record.status === "Bounty Credited"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-305"
                      : record.status === "Flagged Suspicious"
                      ? "bg-red-50 text-red-800 border-red-305 animate-pulse"
                      : "bg-amber-50 text-amber-800 border-amber-305"
                  }`}>
                    {record.status}
                  </span>
                </div>

                {/* Growth associations details */}
                <div className="grid grid-cols-2 gap-3 p-2 bg-white border border-black/10 rounded text-xs text-stone-800">
                  <div>
                    <span className="text-[9px] text-slate-400 font-mono block uppercase">Inviter Participant</span>
                    <strong className="text-black font-extrabold">{record.inviterName}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-mono block uppercase">Invitee Convert</span>
                    <strong className="text-black font-extrabold">{record.inviteeName}</strong>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-105">
                  <span className="text-[10.5px] text-slate-500 font-mono">Completed: {record.redeemedAt}</span>
                  
                  <div className="flex gap-2">
                    {record.status === "Flagged Suspicious" ? (
                      <button 
                        onClick={() => handleToggleFraud(record.id, "Bounty Credited")}
                        className="px-2 py-1 text-[10px] bg-black text-white hover:bg-slate-900 font-bold border border-black rounded select-none cursor-pointer"
                      >
                        Release Credit
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleToggleFraud(record.id, "Flagged Suspicious")}
                        className="px-2 py-1 text-[10px] bg-white text-rose-800 border border-black hover:bg-rose-50 font-bold rounded select-none cursor-pointer"
                      >
                        Flag Fraud
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Global configuration boundaries */}
        <div className="bg-white border border-black rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-1 border-b border-slate-100 pb-2">
            <Settings className="w-3.5 h-3.5 text-emerald-555" />
            <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider">Growth Configuration</h3>
          </div>

          <div className="space-y-4 font-sans">
            {/* Same Device toggle */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-black rounded text-xs">
              <div>
                <strong className="text-black block text-xs">Block same-hardware logins</strong>
                <span className="text-[10px] text-slate-500 block">Excludes referral credits when devices overlap.</span>
              </div>
              <button 
                onClick={() => setBlockSameDevice(!blockSameDevice)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  blockSameDevice ? "bg-black" : "bg-slate-300"
                }`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  blockSameDevice ? "translate-x-5" : "translate-x-0"
                }`} />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-black block">Inviter Referral Reward size (£)</label>
              <input 
                type="number" 
                value={inviterBonus}
                onChange={(e) => setInviterBonus(Number(e.target.value) || 0)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-black text-xs font-mono text-[#AF52DE] font-bold rounded"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-black block">Invitee Welcome Travel discount (£)</label>
              <input 
                type="number" 
                value={inviteeCredit}
                onChange={(e) => setInviteeCredit(Number(e.target.value) || 0)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-black text-xs font-mono text-emerald-600 font-bold rounded"
              />
            </div>

            <button
              onClick={handleSaveParameters}
              className="w-full py-2 bg-black hover:bg-slate-900 border border-black text-white text-xs font-mono font-black tracking-wider uppercase cursor-pointer rounded transition flex items-center justify-center gap-1"
            >
              <Save className="w-4 h-4 text-emerald-400" />
              Save Referrals Config
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

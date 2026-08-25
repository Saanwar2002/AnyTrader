import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { 
  Building2, KeyRound, Printer, Copy, Check, Share2, 
  Download, ExternalLink, Sparkles, Home, ShieldCheck, Lock, Flame,
  Store, Monitor, FileText, CheckCircle2, QrCode
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { cn } from "@/src/lib/utils";

interface EstateAgentQRGeneratorModalProps {
  initialProperty?: any;
  onClose: () => void;
}

export function EstateAgentQRGeneratorModal({ initialProperty, onClose }: EstateAgentQRGeneratorModalProps) {
  const [mode, setMode] = useState<"property" | "branch">("property");
  const [address, setAddress] = useState(initialProperty?.name || initialProperty?.address?.line1 || "");
  const [postcode, setPostcode] = useState(initialProperty?.address?.postcode || "");
  const [passportId, setPassportId] = useState(initialProperty?.id || "");
  const [agencyName, setAgencyName] = useState("Connells Estate Agents");
  const [branchTown, setBranchTown] = useState("London Central Branch");
  const [agentId, setAgentId] = useState("CONN-LON-01");
  const [activeFormat, setActiveFormat] = useState<"desk_stand" | "wall_poster" | "keytag" | "a4_sheet" | "link">("desk_stand");
  const [copiedLink, setCopiedLink] = useState(false);

  // Generate target smart URL
  const origin = window.location.origin;
  const queryParams = new URLSearchParams();
  if (mode === "property") {
    if (passportId) queryParams.set("passportId", passportId);
    if (address) queryParams.set("address", address);
    if (postcode) queryParams.set("postcode", postcode);
  }
  if (agentId) queryParams.set("agentId", agentId);
  if (agencyName) queryParams.set("agentName", agencyName);
  queryParams.set("source", mode === "property" ? "qr_key_handover" : "qr_branch_display");

  const targetUrl = `${origin}/move-in?${queryParams.toString()}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopiedLink(true);
      toast.success("Move-in onboarding link copied!");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (e) {
      toast.error("Failed to copy link.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    const text = mode === "property"
      ? `🏡 *Key Handover: Move-In Trade Pack & Property Passport*\n` +
        `Property: *${address || "New Home"} (${postcode})*\n` +
        `Agency: *${agencyName}*\n\n` +
        `Scan or tap below to unlock your Digital Property Passport, security lock re-keying & move-in trade recommendations:\n${targetUrl}`
      : `🏢 *${agencyName} (${branchTown}) - Move-In & Trade Concierge Hub*\n\n` +
        `Scan or tap below to access our official TradeOS Move-In Hub, verified zero-lead-fee local trades, and Digital Property Passports:\n${targetUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl border border-black shadow-2xl max-w-3xl w-full p-6 sm:p-8 space-y-6 my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-300 text-amber-900 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Estate Agency QR Code Display Generator</h2>
              <p className="text-xs text-slate-500 font-bold">Printable Desk Stands, Wall Posters, Key Tags & Handover Packs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-black text-sm transition"
          >
            ✕
          </button>
        </div>

        {/* Display Purpose Mode Switcher */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-300">
          <button
            onClick={() => setMode("branch")}
            className={cn(
              "py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition",
              mode === "branch"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-200"
            )}
          >
            <Store className="w-4 h-4" />
            <span>🏢 Branch Desk & Wall Display</span>
          </button>

          <button
            onClick={() => setMode("property")}
            className={cn(
              "py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition",
              mode === "property"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-200"
            )}
          >
            <KeyRound className="w-4 h-4" />
            <span>🏡 Property Handover Key Tag</span>
          </button>
        </div>

        {/* Input Configuration Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div>
            <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
              Estate Agency Name
            </label>
            <input
              type="text"
              placeholder="e.g. Connells Estate Agents"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-black rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
              Branch Location / Town
            </label>
            <input
              type="text"
              placeholder="e.g. Manchester Central Branch"
              value={branchTown}
              onChange={(e) => setBranchTown(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-black rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
            />
          </div>

          {mode === "property" && (
            <>
              <div>
                <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
                  Property Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. 42 Oak Lane"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-black rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
                  Postcode
                </label>
                <input
                  type="text"
                  placeholder="e.g. M14 6XX"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-black rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
                />
              </div>
            </>
          )}

          <div className={mode === "property" ? "sm:col-span-2" : "sm:col-span-2"}>
            <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
              Branch Referral / Tracking ID
            </label>
            <input
              type="text"
              placeholder="e.g. CONN-LON-04"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-black rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
            />
          </div>
        </div>

        {/* Format Selector Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
          {[
            { id: "desk_stand", label: "🪧 Desk Stand Plaque" },
            { id: "wall_poster", label: "🖼️ Wall / Window Poster" },
            { id: "keytag", label: "🏷️ Key Fob Tag" },
            { id: "a4_sheet", label: "📄 Handover Certificate" },
            { id: "link", label: "🔗 URL & Share" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFormat(tab.id as any)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition",
                activeFormat === tab.id
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Preview Container */}
        <div className="border border-black rounded-2xl p-6 bg-slate-100/70 flex flex-col items-center justify-center min-h-[320px]">
          {/* FORMAT 1: Desk Stand / Counter Plaque */}
          {activeFormat === "desk_stand" && (
            <div className="bg-white rounded-2xl border-2 border-black p-6 max-w-sm w-full shadow-xl space-y-4 text-center relative overflow-hidden">
              <div className="bg-slate-900 text-white -mx-6 -mt-6 p-4 border-b-2 border-black space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">Official Partner</span>
                  <span className="bg-blue-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded">AnyTrader</span>
                </div>
                <h3 className="text-base font-black tracking-tight">{agencyName}</h3>
                <p className="text-[10px] text-slate-300 font-bold">{branchTown}</p>
              </div>

              <div className="space-y-1 pt-1">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                  New Home Move-In Concierge
                </h4>
                <p className="text-[11px] text-slate-600 font-medium leading-snug">
                  Scan to unlock your Digital Property Passport & verified local trades
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border-2 border-black inline-block shadow-inner mx-auto">
                <QRCodeSVG
                  value={targetUrl}
                  size={150}
                  level="H"
                  includeMargin={false}
                />
              </div>

              <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-200 text-slate-700">
                <div className="text-[9px] font-bold">
                  <Lock className="w-3.5 h-3.5 mx-auto text-amber-600 mb-0.5" />
                  <span>Lock Re-Key</span>
                </div>
                <div className="text-[9px] font-bold">
                  <Flame className="w-3.5 h-3.5 mx-auto text-blue-600 mb-0.5" />
                  <span>Gas Safe</span>
                </div>
                <div className="text-[9px] font-bold">
                  <Sparkles className="w-3.5 h-3.5 mx-auto text-emerald-600 mb-0.5" />
                  <span>Deep Clean</span>
                </div>
              </div>

              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                Place on client negotiation desks & reception counters
              </p>
            </div>
          )}

          {/* FORMAT 2: Wall / Window Poster (A4/A3) */}
          {activeFormat === "wall_poster" && (
            <div className="bg-white rounded-3xl border-2 border-black p-8 max-w-md w-full shadow-2xl space-y-6 text-center">
              <div className="flex items-center justify-between border-b-2 border-black pb-4">
                <div className="text-left">
                  <h3 className="text-lg font-black text-slate-900 leading-tight">{agencyName}</h3>
                  <p className="text-xs font-bold text-slate-500">{branchTown}</p>
                </div>
                <span className="bg-slate-900 text-amber-400 border border-black text-xs font-black uppercase px-3 py-1.5 rounded-xl">
                  TradeOS
                </span>
              </div>

              <div className="space-y-2">
                <span className="bg-blue-100 text-blue-900 text-[11px] font-black uppercase px-3 py-1 rounded-full border border-blue-300 inline-block">
                  🏡 Key Handover & Move-In Hub
                </span>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-snug">
                  Moving In? Get 1-Click Quotes With Zero Lead Fees
                </h2>
                <p className="text-xs text-slate-600 font-medium">
                  Scan the QR code with your smartphone camera to access recommended move-in trades and your Digital Property Passport.
                </p>
              </div>

              <div className="bg-slate-50 p-5 rounded-3xl border-2 border-black inline-block shadow-md">
                <QRCodeSVG
                  value={targetUrl}
                  size={170}
                  level="H"
                  includeMargin={false}
                />
              </div>

              <div className="bg-slate-100 p-3.5 rounded-2xl border border-slate-300 text-left text-xs space-y-1.5 font-bold text-slate-800">
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Insurance-Approved British Standard Locksmiths</span>
                </p>
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Gas Safe Registered Boiler & Heating Check</span>
                </p>
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Move-In Deep Cleaning & Oven Sanitisation</span>
                </p>
              </div>

              <p className="text-[10px] text-slate-400 font-medium italic">
                Print for agency branch walls, waiting lounge noticeboards, or window displays
              </p>
            </div>
          )}

          {/* FORMAT 3: Key Fob Tag */}
          {activeFormat === "keytag" && (
            <div className="bg-white rounded-2xl border-2 border-black p-5 max-w-sm w-full shadow-lg space-y-4 text-center">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600">AnyTrader</span>
                <span className="text-[10px] font-bold text-slate-500">{agencyName}</span>
              </div>

              <div className="py-1">
                <p className="text-xs font-black text-slate-900 leading-tight">{address || "New Home Key Tag"}</p>
                <p className="text-[10px] font-bold text-slate-500">{postcode || branchTown}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-black inline-block shadow-inner">
                <QRCodeSVG
                  value={targetUrl}
                  size={140}
                  level="H"
                  includeMargin={false}
                />
              </div>

              <div>
                <p className="text-[10px] font-black text-slate-900 uppercase tracking-wider">
                  Scan for Move-In Pack
                </p>
                <p className="text-[9px] text-slate-500">Locks • Boiler • Deep Clean • Passport</p>
              </div>
            </div>
          )}

          {/* FORMAT 4: A4 Handover Sheet */}
          {activeFormat === "a4_sheet" && (
            <div className="bg-white rounded-2xl border border-black p-6 max-w-md w-full shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h4 className="text-sm font-black text-slate-900">{agencyName}</h4>
                  <p className="text-[10px] font-bold text-slate-400">Official Key Handover Certificate</p>
                </div>
                <span className="bg-blue-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded">
                  AnyTrader
                </span>
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900">Welcome to Your New Home!</h3>
                <p className="text-xs font-extrabold text-blue-600">{address || branchTown} {postcode}</p>
              </div>

              <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <QRCodeSVG value={targetUrl} size={90} level="M" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-slate-800">Scan with your smartphone camera to unlock:</p>
                  <ul className="text-[11px] text-slate-600 space-y-0.5 list-disc pl-4 font-medium">
                    <li>Day-One Insurance Locksmith</li>
                    <li>Gas Safe Boiler Check</li>
                    <li>Pre-move Deep Clean & Sanitise</li>
                    <li>Your permanent Property Passport</li>
                  </ul>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 text-center italic">
                Supported by AnyTrader TradeOS • Zero Lead Fee Local Pros
              </p>
            </div>
          )}

          {/* FORMAT 5: URL & Share */}
          {activeFormat === "link" && (
            <div className="bg-white rounded-2xl border border-black p-6 max-w-md w-full shadow-lg space-y-4">
              <div className="space-y-1 text-center">
                <h4 className="text-sm font-black text-slate-900">Smart Move-In Onboarding URL</h4>
                <p className="text-xs text-slate-500">Direct link with embedded referral attribution</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-300 break-all text-xs font-mono text-slate-800 select-all">
                {targetUrl}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleCopyLink}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? "Copied!" : "Copy Link"}</span>
                </button>

                <button
                  onClick={handleShareWhatsApp}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>
                Print {
                  activeFormat === "desk_stand" ? "Desk Stand Plaque" :
                  activeFormat === "wall_poster" ? "Wall Poster (A4/A3)" :
                  activeFormat === "keytag" ? "Key Tag" : "Handover Sheet"
                }
              </span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

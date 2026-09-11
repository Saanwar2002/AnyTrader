import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { db, doc, getDoc, updateDoc } from "@/src/firebase";
import { useAuth } from "../AuthProvider";
import MoveInPackHub from "./MoveInPackHub";
import { ClaimPropertyPassportModal } from "./ClaimPropertyPassportModal";
import { 
  Home, KeyRound, ShieldCheck, Sparkles, Building2, CheckCircle2, 
  ArrowRight, ArrowLeft, Phone, Mail, Share2, Printer, Lock, Flame, Zap
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { SEO } from "../SEO";

export default function MoveInLanding() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const passportId = searchParams.get("passportId") || searchParams.get("id") || "";
  const agentId = searchParams.get("agentId") || searchParams.get("agent") || "";
  const rawAgentName = searchParams.get("agentName") || searchParams.get("agency") || "";
  const paramPostcode = searchParams.get("postcode") || "";
  const paramAddress = searchParams.get("address") || searchParams.get("name") || "";
  const transferCode = searchParams.get("code") || searchParams.get("transferCode") || "";

  const [property, setProperty] = useState<any | null>(null);
  const [loading, setLoading] = useState(Boolean(passportId));
  const [showClaimModal, setShowClaimModal] = useState(Boolean(transferCode));

  // Determine display agent name
  const agentName = rawAgentName || (agentId ? `${agentId.toUpperCase()} Estate Agents` : "Partner Estate Agency");

  useEffect(() => {
    async function loadPassport() {
      if (!passportId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const publicDocRef = doc(db, "public_properties", passportId);
        let snapshot = await getDoc(publicDocRef);
        if (!snapshot.exists()) {
          const privateDocRef = doc(db, "properties", passportId);
          snapshot = await getDoc(privateDocRef);
        }
        if (snapshot.exists()) {
          setProperty({ id: snapshot.id, ...snapshot.data() });
        }
      } catch (err) {
        console.warn("Could not load property from passportId:", err);
      } finally {
        setLoading(false);
      }
    }

    loadPassport();
  }, [passportId]);

  const effectiveAddress = property?.address?.line1 || property?.name || paramAddress || "Your New UK Residence";
  const effectivePostcode = property?.address?.postcode || paramPostcode || "";
  const effectiveEpc = property?.epcRating || "C";
  const effectiveBoiler = property?.boilerInfo;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-20 font-sans">
      <SEO
        title={`Move-In Pack & Property Passport - ${effectiveAddress}`}
        description="Claim your verified Digital Property Passport, review essential Day-One move-in trade recommendations, and get 1-click quotes on AnyTrader."
      />

      {/* Top Co-Branded Navigation */}
      <div className="sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              to="/" 
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase px-3 py-1.5 rounded-xl tracking-wider transition shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back To AnyTrader</span>
            </Link>
            {agentName && (
              <span className="text-xs text-slate-400 font-bold border-l border-slate-700 pl-3 hidden md:inline">
                Handover Partner: <strong className="text-white">{agentName}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {passportId && (
              <Link
                to={`/passport/view/${passportId}`}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 transition hidden sm:inline-flex"
              >
                View Full Passport
              </Link>
            )}

            <button
              onClick={() => setShowClaimModal(true)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-sm transition"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Claim Property</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hero Welcome Banner */}
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-2">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white rounded-3xl border border-black shadow-lg p-6 sm:p-10 space-y-6 relative overflow-hidden"
        >
          {/* Decorative ambient glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

          <div className="relative z-10 space-y-4 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-amber-400 text-slate-950 text-[11px] font-black uppercase px-3 py-1 rounded-full shadow-xs">
                🏡 Key Handover Welcome Pack
              </span>
              <span className="bg-white/15 text-white text-[11px] font-bold uppercase px-3 py-1 rounded-full border border-white/20">
                {agentName}
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              Welcome to Your New Home at <span className="text-amber-300">{effectiveAddress}</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
              Your estate agent and AnyTrader have set up your <strong>Digital Property Passport</strong> and curated 
              a list of essential Day-One and Week-One trade recommendations. Browse prices, tick off tasks, or post 
              pre-filled trade requests whenever you are ready.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-2xl border border-white/15">
                <div className="flex items-center gap-2 text-amber-300 font-black text-xs uppercase mb-1">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Insurance Locks</span>
                </div>
                <p className="text-xs text-slate-300">Re-key British Standard cylinders for insurance compliance.</p>
              </div>

              <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-2xl border border-white/15">
                <div className="flex items-center gap-2 text-blue-300 font-black text-xs uppercase mb-1">
                  <Flame className="w-3.5 h-3.5" />
                  <span>Gas Safe Heating</span>
                </div>
                <p className="text-xs text-slate-300">Boiler healthcheck & radiator bleed before moving in.</p>
              </div>

              <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-2xl border border-white/15">
                <div className="flex items-center gap-2 text-emerald-300 font-black text-xs uppercase mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Deep Sanitisation</span>
                </div>
                <p className="text-xs text-slate-300">Steam clean carpets & oven before furniture arrives.</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Main Move-In Tasks Hub */}
      <MoveInPackHub
        propertyId={property?.id || passportId || "qr_scan_prop"}
        propertyName={effectiveAddress}
        propertyAddress={property?.address || { line1: effectiveAddress, postcode: effectivePostcode }}
        postcode={effectivePostcode}
        epcRating={effectiveEpc}
        boilerInfo={effectiveBoiler}
        agentName={agentName}
      />

      {/* Claim Property Modal */}
      {showClaimModal && (
        <ClaimPropertyPassportModal
          initialCode={transferCode}
          onClose={() => setShowClaimModal(false)}
          onSuccess={(claimedId) => {
            setShowClaimModal(false);
            toast.success("Property claimed! You can now manage all records from your dashboard.");
            navigate(`/portfolio`);
          }}
        />
      )}
    </div>
  );
}

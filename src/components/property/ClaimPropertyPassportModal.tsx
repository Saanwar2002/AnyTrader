import React, { useState, useEffect } from "react";
import { db, doc, getDoc, updateDoc, collection, query, where, getDocs, handleFirestoreError, OperationType } from "@/src/firebase";
import { useAuth } from "../AuthProvider";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { X, ArrowRight, ShieldCheck, CheckCircle2, Home, AlertCircle, KeyRound, Building2, Wrench, Sparkles, FileText, Check, Lock, LogIn } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

interface ClaimPropertyPassportModalProps {
  initialCode?: string;
  onClose?: () => void;
  onSuccess?: (propertyId: string) => void;
}

export function ClaimPropertyPassportModal({ initialCode = "", onClose, onSuccess }: ClaimPropertyPassportModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const codeFromUrl = searchParams.get("code") || initialCode;
  const [transferCode, setTransferCode] = useState(codeFromUrl.toUpperCase());
  const [verifying, setVerifying] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [verifiedProperty, setVerifiedProperty] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState(false);

  // Auto-verify if code exists in URL on mount
  useEffect(() => {
    if (codeFromUrl && codeFromUrl.length >= 6) {
      handleVerifyCode(codeFromUrl.toUpperCase());
    }
  }, [codeFromUrl]);

  const handleVerifyCode = async (codeToTest?: string) => {
    const code = (codeToTest || transferCode).trim().toUpperCase();
    if (!code) {
      setError("Please enter a valid transfer code.");
      return;
    }

    setVerifying(true);
    setError(null);
    setVerifiedProperty(null);

    try {
      const q = query(
        collection(db, "properties"),
        where("transferCode", "==", code),
        where("transferStatus", "==", "pending")
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError("Invalid or expired transfer code. Please check with the seller or solicitor.");
        setVerifying(false);
        return;
      }

      const propDoc = snapshot.docs[0];
      const data = { id: propDoc.id, ...propDoc.data() };

      // Check expiry
      if (data.transferExpiresAt) {
        const expiry = new Date(data.transferExpiresAt);
        if (expiry.getTime() < Date.now()) {
          setError("This transfer code has expired. Please ask the seller to generate a new code.");
          setVerifying(false);
          return;
        }
      }

      setVerifiedProperty(data);
    } catch (err) {
      console.error("Error verifying transfer code:", err);
      setError("Failed to verify code. Please check your internet connection.");
    } finally {
      setVerifying(false);
    }
  };

  const handleClaimProperty = async () => {
    if (!user) {
      toast.error("Please sign in or create an account to claim this property.");
      navigate("/login");
      return;
    }

    if (!verifiedProperty?.id) return;

    if (verifiedProperty.ownerId === user.uid) {
      toast.info("You already own this property passport in your account.");
      if (onClose) onClose();
      return;
    }

    setClaiming(true);
    try {
      const propRef = doc(db, "properties", verifiedProperty.id);
      
      const newHistoryItem = {
        transferredAt: new Date().toISOString(),
        transferCode: verifiedProperty.transferCode,
        fromOwnerUid: verifiedProperty.ownerId || "previous_owner",
        toOwnerUid: user.uid,
        toOwnerEmail: user.email || null,
        propertyName: verifiedProperty.name || "Property"
      };

      const existingHistory = Array.isArray(verifiedProperty.transferHistory) 
        ? verifiedProperty.transferHistory 
        : [];

      await updateDoc(propRef, {
        ownerId: user.uid,
        userId: user.uid,
        transferStatus: "completed",
        transferCode: null,
        transferExpiresAt: null,
        transferClaimedAt: new Date().toISOString(),
        transferClaimedByUid: user.uid,
        previousOwnersCount: (verifiedProperty.previousOwnersCount || 0) + 1,
        transferHistory: [...existingHistory, newHistoryItem],
        updatedAt: new Date().toISOString()
      });

      setClaimSuccess(true);
      toast.success("🎉 Property Passport Claimed! Digital twin transferred to your account.");
      if (onSuccess) onSuccess(verifiedProperty.id);
    } catch (err) {
      console.error("Error claiming property:", err);
      handleFirestoreError(err, OperationType.UPDATE, `properties/${verifiedProperty.id}`);
      toast.error("Failed to claim property passport.");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className="relative w-full max-w-lg bg-white rounded-3xl border border-black shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-600 rounded-2xl text-white shadow-md">
                <Home className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-lg tracking-tight">Claim Property Passport</h3>
                  <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] uppercase font-black px-2 py-0.5 rounded-full">
                    Digital Twin Handover
                  </span>
                </div>
                <p className="text-xs text-slate-400">Inherit verified maintenance logs & warranties</p>
              </div>
            </div>

            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            {claimSuccess ? (
              /* Success View */
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 border border-emerald-300">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-900">Ownership Handover Complete!</h4>
                  <p className="text-xs text-slate-600 font-medium max-w-sm mx-auto mt-1">
                    <strong>{verifiedProperty?.name || verifiedProperty?.address?.line1}</strong> has been transferred into your AnyTrader portfolio. All verified service histories, boiler records, and appliance specs are now yours.
                  </p>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => {
                      if (onClose) onClose();
                      navigate("/portfolio");
                    }}
                    className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md transition"
                  >
                    View in My Portfolio
                  </button>
                  <button
                    onClick={() => {
                      if (onClose) onClose();
                      navigate("/dashboard");
                    }}
                    className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-extrabold border border-black transition"
                  >
                    Go to Dashboard
                  </button>
                </div>
              </div>
            ) : verifiedProperty ? (
              /* Verified Property Preview View */
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div className="text-xs">
                    <p className="font-bold text-emerald-950">Valid Transfer Code Verified</p>
                    <p className="text-emerald-800">You are ready to claim this property's complete digital twin.</p>
                  </div>
                </div>

                {/* Property Card */}
                <div className="p-5 rounded-2xl border border-black bg-slate-50 space-y-3">
                  <div>
                    <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider">Property Asset</span>
                    <h4 className="text-lg font-black text-slate-900 leading-tight">
                      {verifiedProperty.name || "Residential Property"}
                    </h4>
                    <p className="text-xs text-slate-600 font-bold mt-0.5">
                      {verifiedProperty.address?.line1 || "UK Address"} {verifiedProperty.address?.postcode}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-xs">
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <p className="text-[10px] font-extrabold uppercase text-slate-400">EPC Rating</p>
                      <p className="font-black text-blue-600 text-sm">Grade {verifiedProperty.epcRating || "C"}</p>
                    </div>

                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <p className="text-[10px] font-extrabold uppercase text-slate-400">Boiler</p>
                      <p className="font-bold text-slate-900 truncate">{verifiedProperty.boilerInfo?.brand || "Standard"}</p>
                    </div>

                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 col-span-2 sm:col-span-1">
                      <p className="text-[10px] font-extrabold uppercase text-slate-400">Roof Condition</p>
                      <p className="font-bold text-slate-900">{verifiedProperty.roofCondition || "Good"}</p>
                    </div>
                  </div>
                </div>

                {/* Authentication Check */}
                {!user ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                      <Lock className="w-4 h-4 text-amber-600" />
                      Sign In Required to Take Ownership
                    </div>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Please sign in or create your free AnyTrader account to claim this property into your portfolio.
                    </p>
                    <Link
                      to={`/login?redirect=${encodeURIComponent(`/claim-passport?code=${transferCode}`)}`}
                      className="block text-center py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-sm transition"
                    >
                      Sign In / Register to Claim
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      disabled={claiming}
                      onClick={handleClaimProperty}
                      className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl border border-black text-xs font-black shadow-md flex items-center justify-center gap-2 active:scale-98 transition"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {claiming ? "Transferring Digital Twin..." : "Confirm & Claim Property Passport"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setVerifiedProperty(null);
                        setTransferCode("");
                      }}
                      className="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800"
                    >
                      Enter a different transfer code
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Code Entry Form */
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 border border-black rounded-2xl text-xs text-slate-700 space-y-2">
                  <div className="flex items-center gap-2 font-black text-slate-900 text-sm">
                    <KeyRound className="w-4 h-4 text-blue-600" />
                    Enter Your 8-Character Transfer Code
                  </div>
                  <p className="leading-relaxed">
                    If you are purchasing a home, your seller or conveyancer will have provided you with a unique AnyTrader transfer code (e.g. <code>TRF-8K92X4</code>).
                  </p>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-900 block mb-1">
                    Transfer Claim Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. TRF-8K92X4"
                      value={transferCode}
                      onChange={(e) => setTransferCode(e.target.value.toUpperCase())}
                      className="flex-1 p-3 rounded-xl border border-black text-sm font-black bg-white text-slate-900 tracking-wider font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                    />
                    <button
                      type="button"
                      disabled={verifying || !transferCode.trim()}
                      onClick={() => handleVerifyCode()}
                      className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-black border border-black shadow-md flex items-center gap-1.5 transition"
                    >
                      {verifying ? "Checking..." : "Verify Code"}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <p>{error}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { useSearchParams } from "react-router-dom";
import { db, doc, setDoc, serverTimestamp, handleFirestoreError, OperationType, collection, query, where, getDocs, updateDoc, onSnapshot, auth, logout } from "@/src/firebase";
import { RecaptchaVerifier, linkWithPhoneNumber, PhoneAuthProvider } from "firebase/auth";
import { motion } from "motion/react";
import { User, Briefcase, Loader2, MapPin, Shield, CheckCircle2, ChevronRight, ChevronLeft, Upload, AlertCircle, Info, PoundSterling, Award, Gift, Home, Building2, Star } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { toast } from "sonner";
import { useCategories } from "../lib/CategoryProvider";
import { lookupPostcode } from "@/src/services/postcodeService";
import { generateMemberId } from "@/src/services/memberIdService";
import { BLOCKED_DOMAINS, UNSORTED_TRADE_CATEGORIES } from "@/src/constants";
import { performInitialPublicRecordCheck } from "../services/verificationService";

export default function Onboarding() {
  const { user } = useAuth();
  const { categories } = useCategories();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<"homeowner" | "tradesperson" | "admin" | "fleet_driver" | null>(null);
  const [homeownerType, setHomeownerType] = useState<"homeowner" | "business" | null>(null);
  const [businessCategory, setBusinessCategory] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [invitationId, setInvitationId] = useState<string | null>(null);
  const [name, setName] = useState(user?.displayName || "");
  const [phone, setPhone] = useState("");
  const [postcode, setPostcode] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [verificationDocs, setVerificationDocs] = useState<any[]>([]);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingInvite, setCheckingInvite] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platformConfig, setPlatformConfig] = useState<any>(null);

  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [bypassPhoneAuth, setBypassPhoneAuth] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "platform_config", "global"), (doc) => {
      if (doc.exists()) {
        setPlatformConfig(doc.data());
      }
    });
    return () => unsub();
  }, []);

  const requiredCerts = categories
    .filter(t => selectedTrades.includes(t.name))
    .flatMap(t => {
      const certs = [...(t.requiredCertifications || [])];
      if ((t as any).subcategoryCertifications) {
        t.subcategories?.forEach(sub => {
          if (selectedSubcategories.includes(sub) && (t as any).subcategoryCertifications[sub]) {
            certs.push(...(t as any).subcategoryCertifications[sub]);
          }
        });
      }
      return certs;
    });

  const uniqueRequiredCerts = Array.from(new Set([
    ...requiredCerts,
    ...(role === "fleet_driver" ? ["Driver License", "Private Hire Vehicle (PHV) Licence", "MOT / Vehicle Insurance"] : [])
  ]));

  useEffect(() => {
    const checkInvitation = async () => {
      if (!user?.email) {
        setCheckingInvite(false);
        return;
      }

      // Check for hardcoded admin email
      if (user.email.toLowerCase() === "saanwar2002@gmail.com") {
        setRole("admin");
        setCheckingInvite(false);
        return;
      }

      try {
        const q = query(
          collection(db, "invitations"),
          where("email", "==", user.email.toLowerCase()),
          where("status", "==", "pending")
        );
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const invite = snapshot.docs[0].data();
          setRole("admin");
          setPermissions(invite.permissions || []);
          setInvitationId(snapshot.docs[0].id);
        }
      } catch (err) {
        console.error("Error checking invitation:", err);
      } finally {
        setCheckingInvite(false);
      }
    };

    checkInvitation();
  }, [user]);

  const handleSubmit = async () => {
    console.log("handleSubmit called. State:", { user: !!user, role, name, postcode, phone });
    if (!user || !role || !name || !postcode || !phone) {
      console.log("handleSubmit returning early: Missing required fields");
      return;
    }

    // 1. Block Temporary Emails
    const emailDomain = user.email?.split("@")[1]?.toLowerCase();
    if (emailDomain && BLOCKED_DOMAINS.includes(emailDomain)) {
      setError("Sorry, we do not accept registrations from this email provider. Please use a standard email address.");
      return;
    }

    // 2. Phone Number Validation (Basic UK format check)
    const cleanPhone = phone.replace(/\s/g, "");
    if (!/^(\+44|0)7\d{9}$/.test(cleanPhone)) {
      setError("Please enter a valid UK mobile number (e.g., 07123 456789).");
      return;
    }

    // 3. Duplicate Profile Detection (Name + Postcode)
    try {
      setLoading(true);
      const duplicateQuery = query(
        collection(db, "users"),
        where("name", "==", name),
        where("postcode", "==", postcode.toUpperCase().replace(/\s/g, ""))
      );
      const duplicateSnap = await getDocs(duplicateQuery);
      if (!duplicateSnap.empty && duplicateSnap.docs[0].id !== user.uid) {
        setError("An account with this name and postcode already exists. If you've lost access, please contact support.");
        setLoading(false);
        return;
      }

      // 4. Restriction check
      if (platformConfig?.onboardingRestrictionsEnabled) {
        const allowedPostcodes = platformConfig.allowedPostcodes || [];
        const userClean = postcode.toUpperCase().replace(/\s/g, "");
        
        const isAllowed = allowedPostcodes.some((p: string) => {
          const allowed = p.toUpperCase().replace(/\s/g, "");
          
          // Area Level: If allowed is just letters (e.g. "B", "HD"), match any postcode starting with it
          if (/^[A-Z]+$/.test(allowed)) {
            return userClean.startsWith(allowed);
          }
          
          // District Level: Match the outward code exactly (e.g. "B1" matches "B1 1AA" but not "B10 1AA")
          // In UK postcodes, the outward code is everything except the last 3 characters
          const userOutward = userClean.length > 3 ? userClean.slice(0, -3) : userClean;
          return userOutward === allowed || userClean === allowed;
        });
        
        if (!isAllowed) {
          setError("Sorry, we are not currently accepting registrations in your area. Please check back later.");
          return;
        }
      }

    setLoading(true);
    setError(null);
    const isTestAdmin = sessionStorage.getItem("is_test_admin") === "true";

    const isBusiness = role === "tradesperson" || (role === "homeowner" && homeownerType === "business");

    // Temporarily disabled for development testing
    if (false && isBusiness && !isTestAdmin && !confirmationResult && !user.phoneNumber && !bypassPhoneAuth) {
      try {
        if (!(window as any).recaptchaVerifier) {
          (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
            size: "invisible",
          });
        }
        
        const fullPhone = cleanPhone.startsWith("0") ? "+44" + cleanPhone.slice(1) : cleanPhone;
        
        // Ensure to clear old verifier if it exists to prevent 'already rendered' errors
        if ((window as any).recaptchaVerifier) {
          try {
            (window as any).recaptchaVerifier.clear();
          } catch (e) {
            console.warn("Error clearing old recaptcha verifier:", e);
          }
          (window as any).recaptchaVerifier = null;
        }

        (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
        });
        
        const appVerifier = (window as any).recaptchaVerifier;
        
        const confirmation = await linkWithPhoneNumber(user, fullPhone, appVerifier);
        setConfirmationResult(confirmation);
        setStep(4);
        setPhoneError("");
        setLoading(false);
        return;
      } catch (err: any) {
        console.error("Phone auth error:", err);
        if (err.code === "auth/credential-already-in-use") {
          setError("This phone number is already linked to another account. Please use a different number.");
        } else if (err.code === "auth/operation-not-allowed" || err.code === "auth/billing-not-enabled") {
           console.error("Phone Auth is disabled or billing is missing in Firebase Console.");
           setError("Phone Authentication requires billing to be enabled in Firebase. If you are developing, click 'Complete Setup' again to bypass.");
           if (window.confirm("Phone Auth is missing or billing is not enabled in Firebase. Would you like to bypass this check? (This should only be done for local development testing)")) {
              setBypassPhoneAuth(true);
              setLoading(false);
              setTimeout(() => alert("Bypass enabled. Click 'Complete Setup' again to proceed."), 300);
           }
        } else {
          setError(err.message || "Failed to send verification SMS.");
        }
        if ((window as any).recaptchaVerifier) {
          (window as any).recaptchaVerifier.clear();
          (window as any).recaptchaVerifier = null;
        }
        setLoading(false);
        return;
      }
    }

      const finalRole = isTestAdmin ? "admin" : role;
      const finalPermissions = isTestAdmin ? ["manage_users", "manage_jobs", "manage_disputes", "view_logs", "manage_team"] : permissions;

      // Check for referral
      let referrerUid = null;
      const refCode = searchParams.get("ref");
      if (refCode) {
        const q = query(collection(db, "users"), where("referralCode", "==", refCode));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          referrerUid = snapshot.docs[0].id;
        }
      }

      // Fetch real IP address for fraud detection
      let detectedIp = "0.0.0.0";
      try {
        const ipRes = await fetch("https://api64.ipify.org?format=json");
        const ipData = await ipRes.json();
        if (ipData.ip) detectedIp = ipData.ip;
      } catch (err) {
        console.warn("Could not fetch IP address", err);
      }

      const deviceId = btoa(navigator.userAgent + navigator.language + screen.width + screen.height);
      
      // Generate Member ID
      const { memberId, memberSequence } = await generateMemberId(isBusiness ? (role === "tradesperson" ? "tradesperson" : "business") : "homeowner");

      // Fraud Detection: Check for existing accounts with same Device ID or IP
      let accountFlags: string[] = [];
      try {
        if (deviceId) {
          const deviceQuery = query(collection(db, "users"), where("deviceId", "==", deviceId));
          const deviceSnap = await getDocs(deviceQuery);
          if (deviceSnap.size > 0) {
            accountFlags.push(`Duplicate Device ID found (${deviceSnap.size} other accounts)`);
          }
        }

        if (detectedIp !== "0.0.0.0") {
          const ipQuery = query(collection(db, "users"), where("ipAddress", "==", detectedIp));
          const ipSnap = await getDocs(ipQuery);
          if (ipSnap.size > 2) {
            accountFlags.push(`High risk IP address (${ipSnap.size} other accounts)`);
          }
        }
      } catch (err) {
        console.warn("Fraud detection error", err);
      }

      const profile = {
        uid: user.uid,
        email: user.email,
        isAnonymous: user.isAnonymous,
        name,
        phone: cleanPhone,
        role: finalRole,
        tierId: selectedTier || (
          role === "homeowner" 
            ? (homeownerType === "business" ? "Business Professional" : "Standard Homeowner")
            : (platformConfig?.feeTiers?.[0]?.name || "Free Explorer")
        ),
        subscriptionType: role === "homeowner" ? homeownerType : null,
        businessCategory: homeownerType === "business" ? businessCategory : null,
        permissions: finalPermissions,
        deviceId,
        ipAddress: detectedIp,
        accountFlags,
        memberId,
        memberSequence,
        joinedDuringBeta: true,
        phantomFeesSaved: 0,
        postcode: postcode.toUpperCase().replace(/\s/g, ""),
        city,
        county,
        trades: selectedTrades,
        subcategories: selectedSubcategories,
        referralCode: user.uid.slice(0, 8).toUpperCase(), // Generate a simple referral code
        referredBy: referrerUid,
        verificationStatus: uniqueRequiredCerts.length > 0 ? "pending" : "unverified",
        verificationDocs: verificationDocs.map(d => ({
          type: d.type,
          status: "pending",
          fileUrl: d.fileUrl,
          createdAt: new Date().toISOString()
        })),
        createdAt: serverTimestamp(),
      };
      console.log("Saving setDoc, user.uid:", user.uid);
      await setDoc(doc(db, "users", user.uid), profile);
      console.log("setDoc success");
      
      // Trigger automated public record checks for each uploaded document
      console.log("Checking verification docs");
      verificationDocs.forEach(d => {
        performInitialPublicRecordCheck(user.uid, d.type);
      });
      console.log("Verification docs check skipped or finished");

      if (invitationId) {
        console.log("Updating invitation");
        await updateDoc(doc(db, "invitations", invitationId), {
          status: "accepted",
          acceptedAt: serverTimestamp()
        });
        console.log("Invitation updated");
      }

      console.log("Profile saved successfully.");
      
      if (isTestAdmin) {
        sessionStorage.removeItem("is_test_admin");
      }
      // No need to reload, AuthProvider is listening to onSnapshot
    } catch (err) {
      console.error("Error creating profile:", err);
      try {
        console.log("Attempting to handle Firestore error...");
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      } catch (e: any) {
        console.log("Firestore error handled, setting error state:", e.message);
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingInvite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative overflow-y-auto pb-64">
      {/* Header Section with Background */}
      <div className="relative h-[40vh] min-h-[320px] bg-[#1e3a5f] flex flex-col items-center justify-center p-8 text-center overflow-hidden">
        {/* Background Image Overlay */}
        <div 
          className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none"
          style={{ 
            backgroundImage: 'url("https://images.unsplash.com/photo-1513584684374-8bdb7489feef?q=80&w=2070&auto=format&fit=crop")',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1e3a5f]/50 to-[#1e3a5f]" />
        
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 space-y-4 max-w-2xl"
        >
          <div className="flex justify-center mb-2">
            <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
              <Shield className="w-7 h-7 text-white" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-orange-500 font-black uppercase tracking-[0.3em] text-[10px]">Welcome to AnyTrader</p>
            <h1 className="text-4xl md:text-5xl font-display font-black text-white tracking-tight leading-tight">
              Find trusted tradespeople.<br />Get fair quotes.
            </h1>
          </div>
          <p className="text-blue-100/80 font-medium text-lg max-w-md mx-auto">
            Connect with verified local tradespeople across the UK.
          </p>
          {role === "admin" && (
            <button
               onClick={() => handleSubmit()}
               className="mt-4 bg-red-600 text-white font-bold py-2 px-6 rounded-xl text-sm hover:bg-red-700 transition-colors shadow-lg"
            >
              Skip Setup (Enter Admin)
            </button>
          )}
        </motion.div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex items-start justify-center -mt-20 px-4 pb-12 relative z-20">
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white pt-12 px-8 pb-8 rounded-[3.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] space-y-8 relative"
        >
          {step === 1 && (
            <div className="space-y-6">
              <div 
                onClick={() => logout()}
                className="absolute top-6 left-6 text-slate-500 hover:text-slate-800 p-2 z-[60] cursor-pointer bg-white rounded-full shadow-sm border border-slate-100"
              >
                  <ChevronLeft className="w-8 h-8" />
              </div>
              <div className="space-y-4 pt-10">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">I am a...</h2>
                
                <div className="grid grid-cols-1 gap-4">
                  <button
                    onClick={() => {
                      setRole("homeowner");
                      if (invitationId) setHomeownerType("homeowner");
                    }}
                    className={cn(
                      "w-full p-5 rounded-3xl border-2 text-left transition-all duration-300 flex items-center gap-4 relative group",
                      role === "homeowner" 
                        ? "border-orange-500 bg-orange-50/30 ring-4 ring-orange-500/10" 
                        : "border-slate-100 bg-white hover:border-slate-200"
                    )}
                  >
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors",
                      role === "homeowner" ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
                    )}>
                      <Home className="w-7 h-7" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-black text-lg text-slate-900 block tracking-tight">Homeowner</span>
                      <span className="text-sm text-slate-500 block leading-tight">Post jobs, compare quotes, hire with confidence</span>
                    </div>
                    <div className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                      role === "homeowner" ? "border-orange-500" : "border-slate-200"
                    )}>
                      {role === "homeowner" && <div className="w-3 h-3 rounded-full bg-orange-500" />}
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setRole("tradesperson");
                      setHomeownerType(null);
                      setBusinessCategory(null);
                      setSelectedTier(null);
                    }}
                    className={cn(
                      "w-full p-5 rounded-3xl border-2 text-left transition-all duration-300 flex items-center gap-4 relative group",
                      role === "tradesperson" 
                        ? "border-orange-500 bg-orange-50/30 ring-4 ring-orange-500/10" 
                        : "border-slate-100 bg-white hover:border-slate-200"
                    )}
                  >
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors",
                      role === "tradesperson" ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
                    )}>
                      <Briefcase className="w-7 h-7" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-black text-lg text-slate-900 block tracking-tight">Tradesperson</span>
                      <span className="text-sm text-slate-500 block leading-tight">Browse local jobs, submit quotes, grow your business</span>
                    </div>
                    <div className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                      role === "tradesperson" ? "border-orange-500" : "border-slate-200"
                    )}>
                      {role === "tradesperson" && <div className="w-3 h-3 rounded-full bg-orange-500" />}
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setRole("fleet_driver");
                      setHomeownerType(null);
                      setBusinessCategory(null);
                      setSelectedTier(null);
                      // Force set trades so they can go to verification
                      setSelectedTrades(["Transport & Rides"]);
                      setSelectedSubcategories(["AnyTrader Rides"]);
                    }}
                    className={cn(
                      "w-full p-5 rounded-3xl border-2 text-left transition-all duration-300 flex items-center gap-4 relative group",
                      role === "fleet_driver" 
                        ? "border-orange-500 bg-orange-50/30 ring-4 ring-orange-500/10" 
                        : "border-slate-100 bg-white hover:border-slate-200"
                    )}
                  >
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors",
                      role === "fleet_driver" ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
                    )}>
                      <svg className="w-7 h-7" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-black text-lg text-slate-900 block tracking-tight">Driver (AnyTrader Rides)</span>
                      <span className="text-sm text-slate-500 block leading-tight">Drive passengers & trades, earn with fair commissions</span>
                    </div>
                    <div className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                      role === "fleet_driver" ? "border-orange-500" : "border-slate-200"
                    )}>
                      {role === "fleet_driver" && <div className="w-3 h-3 rounded-full bg-orange-500" />}
                    </div>
                  </button>
                </div>
              </div>

              {/* Homeowner Sub-selection (Individual vs Business) */}
              {role === "homeowner" && !invitationId && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-4 pt-4 border-t border-slate-100"
                >
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Select Account Type</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setHomeownerType("homeowner")}
                      className={cn(
                        "p-4 rounded-2xl border-2 text-center transition-all",
                        homeownerType === "homeowner" ? "border-primary bg-primary/5 text-primary" : "border-slate-100 text-slate-500 hover:border-slate-200"
                      )}
                    >
                      <User className="w-5 h-5 mx-auto mb-2" />
                      <span className="text-xs font-black">Individual</span>
                    </button>
                    <button
                      onClick={() => setHomeownerType("business")}
                      className={cn(
                        "p-4 rounded-2xl border-2 text-center transition-all",
                        homeownerType === "business" ? "border-primary bg-primary/5 text-primary" : "border-slate-100 text-slate-500 hover:border-slate-200"
                      )}
                    >
                      <Building2 className="w-5 h-5 mx-auto mb-2" />
                      <span className="text-xs font-black">Business</span>
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Personal Info Fields */}
              {(role === "tradesperson" || role === "fleet_driver" || (role === "homeowner" && homeownerType)) && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 pt-4 border-t border-slate-100"
                >
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                    <input 
                      type="text" 
                      className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all font-medium text-slate-900"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. John Smith"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mobile Number</label>
                    <input 
                      type="tel" 
                      placeholder="07123 456789"
                      className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all font-medium text-slate-900"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Postcode</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input 
                        type="text" 
                        className="w-full p-4 pl-12 rounded-2xl border border-slate-100 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all font-medium text-slate-900 uppercase"
                        placeholder="e.g. SW1A 1AA"
                        value={postcode}
                        onChange={(e) => setPostcode(e.target.value)}
                        onBlur={async (e) => {
                          const val = e.target.value;
                          if (!val) return;
                          try {
                            const data = await lookupPostcode(val);
                            if (data) {
                              setCity(data.city);
                              setCounty(data.county);
                              setPostcode(data.postcode);
                            }
                          } catch (err) {
                            console.error("Error looking up postcode:", err);
                          }
                        }}
                      />
                    </div>
                    {city && (
                      <div className="mt-2 px-4 py-2 bg-primary/5 rounded-xl border border-primary/10 flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs text-primary font-bold">
                          {city}{county ? `, ${county}` : ""}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Trust Bar */}
              <div className="grid grid-cols-3 gap-2 py-4 border-y border-slate-50">
                <div className="flex flex-col items-center text-center gap-1">
                  <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-[10px] font-black text-slate-700 uppercase leading-none">Verified<br/>trades</span>
                </div>
                <div className="flex flex-col items-center text-center gap-1 border-x border-slate-100">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-[10px] font-black text-slate-700 uppercase leading-none">Escrow<br/>payments</span>
                </div>
                <div className="flex flex-col items-center text-center gap-1">
                  <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center">
                    <Star className="w-4 h-4 text-orange-600 fill-orange-600" />
                  </div>
                  <span className="text-[10px] font-black text-slate-700 uppercase leading-none">Real<br/>reviews</span>
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-bold shadow-sm">
                  {error}
                </div>
              )}

              {/* Continue Button */}
              <button
                onClick={() => {
                  console.log("Button clicked. Role:", role, "HomeownerType:", homeownerType);
                  if (role === "fleet_driver") {
                    setStep(3); // Go straight to verification
                    return;
                  }
                  
                  if (platformConfig?.paywallEnabled === false) {
                    // In beta mode, skip complex setup and go straight to submission
                    handleSubmit();
                  } else {
                    if (role === "tradesperson") {
                      toast.info("Select one or more categories and subcategories!", { duration: 5000 });
                      setStep(2);
                    }
                    else if (role === "homeowner" && homeownerType === "business") setStep(2); // Business homeowner also needs to select category/tier
                    else handleSubmit();
                  }
                }}
                disabled={
                  !role || 
                  !name || 
                  !postcode || 
                  !phone || 
                  loading ||
                  (role === "homeowner" && !homeownerType)
                }
                className="w-full flex items-center justify-center gap-3 bg-orange-500 text-white p-5 rounded-[2rem] font-black text-xl hover:bg-orange-600 transition-all shadow-2xl shadow-orange-500/30 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none active:scale-95 group"
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    {role === "tradesperson" || role === "fleet_driver" || (role === "homeowner" && homeownerType === "business") ? "Continue" : "Complete Setup"}
                    <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* Step 2: Tradesperson - Select Trades */}
          {step === 2 && role === "tradesperson" && (
            <div className="space-y-8">
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-display font-black text-slate-900 tracking-tight">
                  Select Your Trades
                </h1>
                <p className="text-slate-500 font-medium text-sm">
                  Tell us what you're an expert in.
                </p>
              </div>

              <div className="bg-primary/5 border border-primary/10 p-5 rounded-[2rem] flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Info className="w-5 h-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-black text-primary uppercase tracking-tight">Get More Job Offers</p>
                  <p className="text-xs text-slate-600 leading-relaxed">Select multiple trades below to see more jobs. You can also add or edit your specializations later in your Profile.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                {categories.map(t => (
                  <div key={t.id} className="space-y-2">
                    <button
                      onClick={() => {
                        setSelectedTrades(prev => 
                          prev.includes(t.name) ? prev.filter(name => name !== t.name) : [...prev, t.name]
                        );
                      }}
                      className={cn(
                        "w-full p-4 rounded-2xl border-2 text-left flex items-center justify-between transition-all duration-300 group",
                        selectedTrades.includes(t.name) 
                          ? "bg-primary/5 border-primary text-primary shadow-lg shadow-primary/5" 
                          : "bg-white border-slate-100 text-slate-600 hover:border-slate-200"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-colors",
                          selectedTrades.includes(t.name) ? "bg-primary text-white" : "bg-slate-50"
                        )}>
                          {t.icon}
                        </div>
                        <span className="font-black text-sm tracking-tight">{t.name}</span>
                      </div>
                      {selectedTrades.includes(t.name) && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                          <CheckCircle2 className="w-5 h-5 text-primary" />
                        </motion.div>
                      )}
                    </button>
                    {selectedTrades.includes(t.name) && t.subcategories && t.subcategories.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }} 
                        animate={{ opacity: 1, height: 'auto' }}
                        className="ml-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3"
                      >
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Specific Services:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {t.subcategories.map(sub => (
                            <label key={sub} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white transition-colors cursor-pointer border border-transparent hover:border-slate-200 group">
                              <div className="relative flex items-center">
                                <input 
                                  type="checkbox" 
                                  className="w-5 h-5 rounded-md border-2 border-slate-300 text-primary focus:ring-primary focus:ring-offset-0 transition-all cursor-pointer peer"
                                  checked={selectedSubcategories.includes(sub)}
                                  onChange={(e) => {
                                    if (e.target.checked) setSelectedSubcategories(prev => [...prev, sub]);
                                    else setSelectedSubcategories(prev => prev.filter(s => s !== sub));
                                  }}
                                />
                              </div>
                              <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">{sub}</span>
                            </label>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 p-5 rounded-[2rem] border-2 border-slate-100 font-black text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                >
                  <ChevronLeft className="w-5 h-5" /> Back
                </button>
                <button
                  onClick={() => {
                    if (uniqueRequiredCerts.length > 0) setStep(3);
                    else handleSubmit();
                  }}
                  disabled={selectedTrades.length === 0 || loading}
                  className="flex-[2] bg-primary text-white p-5 rounded-[2rem] font-black text-lg hover:bg-primary-hover transition-all shadow-2xl shadow-primary/30 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 group"
                >
                  {loading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      {uniqueRequiredCerts.length > 0 ? "Next: Verification" : "Complete Setup"}
                      <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Business Homeowner - Category Setup */}
          {step === 2 && role === "homeowner" && homeownerType === "business" && (
            <div className="space-y-8">
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-display font-black text-slate-900 tracking-tight">
                  Business Setup
                </h1>
                <p className="text-slate-500 font-medium text-sm">
                  Configure your business profile to get started.
                </p>
              </div>

              {!businessCategory ? (
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-tight">Search Business Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Landlord, Fleet, Garden..."
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    className="w-full p-4 rounded-xl border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm"
                  />
                  <div className="max-h-60 overflow-y-auto grid grid-cols-1 gap-2 custom-scrollbar">
                    {UNSORTED_TRADE_CATEGORIES
                      .filter(cat => cat.name.toLowerCase().includes(categorySearch.toLowerCase()))
                      .map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setBusinessCategory(cat.name)}
                          className={cn(
                            "p-3 rounded-lg border text-left font-bold text-sm transition-all flex items-center gap-3",
                            businessCategory === cat.name 
                              ? "bg-primary/5 border-primary text-primary" 
                              : "bg-white border-slate-100 text-slate-600 hover:border-slate-200"
                          )}
                        >
                          <span className="text-xl">{cat.icon}</span>
                          {cat.name}
                        </button>
                      ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-6 bg-primary/5 rounded-[2rem] border border-primary/10 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Business Category</p>
                          <p className="font-black text-slate-900">{businessCategory}</p>
                        </div>
                      </div>
                      <button onClick={() => setBusinessCategory(null)} className="text-xs text-primary font-bold">Edit</button>
                    </div>
                    
                    <div className="flex items-start gap-3 bg-white/50 p-4 rounded-2xl border border-primary/10">
                      <Gift className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest leading-none mb-1">Introductory Offer</p>
                        <p className="text-xs text-slate-600 leading-tight">Your first 10 job posts are completely free. Test the platform and see the quality of our traders before you subscribe.</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Select Subscription Tier</p>
                    <div className="grid grid-cols-1 gap-3">
                      {(platformConfig?.businessTiers || []).map((tier: any) => (
                        <button
                          key={tier.name}
                          onClick={() => setSelectedTier(tier.name)}
                          className={cn(
                            "p-4 rounded-2xl border-2 text-left transition-all relative",
                            selectedTier === tier.name 
                              ? "bg-primary/5 border-primary shadow-sm" 
                              : "bg-white border-slate-100 hover:border-slate-200"
                          )}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <p className="font-black text-slate-900 leading-none">{tier.name}</p>
                            <p className="text-sm font-black text-primary">£{tier.price}</p>
                          </div>
                          <p className="text-[10px] text-slate-500 mb-2 font-medium leading-tight">{tier.description}</p>
                          <div className="flex items-center gap-2">
                            <div className="px-2 py-0.5 bg-blue-100 rounded text-[8px] font-black text-blue-700 uppercase tracking-wider">
                              {tier.commission || 0}% Comm
                            </div>
                            {tier.jobPostsLimit && (
                              <div className="px-2 py-0.5 bg-slate-100 rounded text-[8px] font-black text-slate-600 uppercase tracking-wider">
                                {tier.jobPostsLimit === 9999 ? "Unlimited" : tier.jobPostsLimit} Posts
                              </div>
                            )}
                          </div>
                          {selectedTier === tier.name && (
                            <CheckCircle2 className="absolute top-4 right-4 w-4 h-4 text-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={() => {
                        setStep(1);
                        setBusinessCategory(null);
                      }}
                      className="flex-1 p-5 rounded-[2rem] border-2 border-slate-100 font-black text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                    >
                      <ChevronLeft className="w-5 h-5" /> Back
                    </button>
                    <button
                      onClick={() => {
                        if (!selectedTier) setSelectedTier("Business Professional");
                        setTimeout(() => handleSubmit(), 100);
                      }}
                      disabled={loading}
                      className="flex-[2] flex items-center justify-center gap-3 bg-primary text-white p-5 rounded-[2rem] font-black text-lg hover:bg-primary-hover transition-all shadow-2xl shadow-primary/30 disabled:opacity-50 active:scale-95 group"
                    >
                      {loading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <>
                          Complete Setup
                          <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Tradesperson - Verification */}
          {step === 3 && (
            <div className="space-y-8">
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-display font-black text-slate-900 tracking-tight">
                  Verification Required
                </h1>
                <p className="text-slate-500 font-medium text-sm">
                  Some of your trades require certification to ensure platform safety.
                </p>
              </div>

              <div className="bg-orange-50 border border-orange-100 p-5 rounded-[2rem] flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-black text-orange-900 uppercase tracking-tight">Verification Required</p>
                  <p className="text-xs text-orange-700 leading-relaxed">You've selected trades that require specific certifications in the UK. You can still complete setup, but you won't be able to quote until verified.</p>
                </div>
              </div>

              <div className="space-y-4">
                {uniqueRequiredCerts.map((cert, idx) => (
                  <div key={idx} className="p-5 rounded-[2rem] border-2 border-slate-100 bg-slate-50/50 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black text-slate-900 tracking-tight">{cert}</p>
                      {verificationDocs.find(d => d.type === cert) ? (
                        <span className="text-[10px] bg-green-500 text-white px-3 py-1 rounded-full font-black uppercase tracking-widest">Uploaded</span>
                      ) : (
                        <span className="text-[10px] bg-slate-200 text-slate-500 px-3 py-1 rounded-full font-black uppercase tracking-widest">Required</span>
                      )}
                    </div>
                    <button 
                      onClick={() => {
                        // Mock upload
                        const mockUrl = `https://example.com/docs/${(cert as string).replace(/\s/g, '_')}.pdf`;
                        setVerificationDocs(prev => [...prev.filter(d => d.type !== cert), { type: cert, fileUrl: mockUrl }]);
                      }}
                      className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl border-2 border-dashed border-slate-200 bg-white text-xs font-black text-slate-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all group"
                    >
                      <Upload className="w-4 h-4 group-hover:-translate-y-1 transition-transform" />
                      Upload Document
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => setStep(role === "fleet_driver" ? 1 : 2)}
                  className="w-full sm:w-auto p-5 rounded-[2rem] border-2 border-slate-100 font-black text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                >
                  <ChevronLeft className="w-5 h-5" /> Back
                </button>
                <div className="flex-1 flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => {
                      setSelectedTier(platformConfig?.feeTiers?.[0]?.name || "Free Trial");
                      handleSubmit();
                    }}
                    disabled={loading}
                    className="flex-1 bg-white border-2 border-slate-200 text-slate-600 p-5 rounded-[2rem] font-black text-sm sm:text-lg hover:border-slate-300 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                  >
                    I'll do this later
                  </button>
                  <button
                    onClick={() => {
                      setSelectedTier(platformConfig?.feeTiers?.[0]?.name || "Free Trial");
                      handleSubmit();
                    }}
                    disabled={loading}
                    className="flex-1 bg-primary text-white p-5 rounded-[2rem] font-black text-sm sm:text-lg hover:bg-primary-hover transition-all shadow-xl shadow-primary/30 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                  >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Complete Setup"}
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-slate-400 justify-center">
                <Info className="w-4 h-4" />
                <p className="text-[10px] font-bold uppercase tracking-widest">You can also upload these later in your profile.</p>
              </div>
            </div>
          )}

          {/* Step 4: SMS Verification */}
          {step === 4 && (
            <div className="space-y-8">
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-display font-black text-slate-900 tracking-tight">
                  Verify Phone Number
                </h1>
                <p className="text-slate-500 font-medium text-sm">
                  We've sent a 6-digit code to {phone.startsWith("0") ? "+44" + phone.slice(1) : phone}
                </p>
              </div>

              {phoneError && (
                <div className="p-4 bg-red-50 text-red-700 text-sm rounded-2xl flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p>{phoneError}</p>
                </div>
              )}

              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full text-center text-3xl tracking-[1em] p-6 rounded-[2rem] border-2 border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none font-mono"
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setStep(1); // Go back to start
                    setConfirmationResult(null);
                  }}
                  className="flex-1 p-5 rounded-[2rem] border-2 border-slate-100 font-black text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                >
                  <ChevronLeft className="w-5 h-5" /> Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      setLoading(true);
                      setPhoneError("");
                      await confirmationResult.confirm(verificationCode);
                      
                      // Now submit normally
                      await handleSubmit();
                    } catch (err: any) {
                      console.error("SMS verification error:", err);
                      setPhoneError(err.message || "Invalid verification code.");
                      setLoading(false);
                    }
                  }}
                  disabled={loading || verificationCode.length !== 6}
                  className="flex-[2] bg-primary text-white p-5 rounded-[2rem] font-black text-lg hover:bg-primary-hover transition-all shadow-2xl shadow-primary/30 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Verify & Complete"}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <div id="recaptcha-container"></div>
    </div>
  );
}

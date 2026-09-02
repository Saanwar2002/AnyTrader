import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { useSearchParams } from "react-router-dom";
import { db, doc, setDoc, serverTimestamp, handleFirestoreError, OperationType, collection, query, where, getDocs, updateDoc, onSnapshot, auth, logout, increment } from "@/src/firebase";
import { RecaptchaVerifier, linkWithPhoneNumber, PhoneAuthProvider } from "firebase/auth";
import { motion } from "motion/react";
import { User, Briefcase, Loader2, MapPin, Shield, CheckCircle2, ChevronRight, ChevronLeft, Upload, AlertCircle, Info, PoundSterling, Award, Gift, Home, Building2, Star, CarFront, Check, LogOut } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { toast } from "sonner";
import { useCategories } from "../lib/CategoryProvider";
import { lookupPostcode } from "@/src/services/postcodeService";
import { generateMemberId } from "@/src/services/memberIdService";
import { BLOCKED_DOMAINS, UNSORTED_TRADE_CATEGORIES, CONSULTANCY_CATEGORIES } from "@/src/constants";
import { performInitialPublicRecordCheck } from "../services/verificationService";

export default function Onboarding() {
  const { user } = useAuth();
  const { categories } = useCategories();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<"homeowner" | "business" | "admin" | "fleet_driver" | null>(null);
  const [businessLayer, setBusinessLayer] = useState<"properties" | "field_services" | "consultancy" | null>(null);
  const [homeownerType, setHomeownerType] = useState<"homeowner" | "business" | null>(null); // Keep temporarily to not break types
  const [businessCategory, setBusinessCategory] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [vehicleCategories, setVehicleCategories] = useState<string[]>(['standard']);
  const [isPetFriendly, setIsPetFriendly] = useState<boolean>(false);
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

  const relevantCategories = businessLayer === "consultancy" ? CONSULTANCY_CATEGORIES : categories;

  const requiredCerts = relevantCategories
    .filter((t: any) => selectedTrades.includes(t.name))
    .flatMap((t: any) => {
      const certs = [...(t.requiredCertifications || [])];
      if (t.subcategoryCertifications) {
        t.subcategories?.forEach((sub: string) => {
          if (selectedSubcategories.includes(sub) && t.subcategoryCertifications[sub]) {
            certs.push(...t.subcategoryCertifications[sub]);
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

      // Check for hardcoded admin email or test admin flag
      if (user.email?.toLowerCase() === "saanwar2002@gmail.com" || sessionStorage.getItem("is_test_admin") === "true") {
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
    // Administrators can skip providing phone/postcode initially if needed,
    // but the db still requires name to exist for users.
    if (!user || !role || (role !== 'admin' && (!name || !postcode || (!user?.isAnonymous && !phone)))) {
      console.log("handleSubmit returning early: Missing required fields");
      return;
    }

    const cleanPhone = phone ? phone.replace(/\s/g, "") : "";
    const isAuthorizedAdmin = user?.email?.toLowerCase() === "saanwar2002@gmail.com";

    // Prevent unauthorized role elevation to admin
    if (role === 'admin' && !isAuthorizedAdmin) {
      setError("Unauthorized role selected. Please choose Homeowner, Tradesperson / Business, or Driver.");
      setRole("homeowner");
      return;
    }

    if (role !== 'admin') {
      // 1. Block Temporary Emails
      const emailDomain = user.email?.split("@")[1]?.toLowerCase();
      if (emailDomain && BLOCKED_DOMAINS.includes(emailDomain)) {
        setError("Sorry, we do not accept registrations from this email provider. Please use a standard email address.");
        return;
      }

      // 2. Phone Number Validation (Basic UK format check)
      if (!user?.isAnonymous && !/^(\+44|0)7\d{9}$/.test(cleanPhone)) {
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
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.error("Error checking duplicates:", e);
      }
    }

    setLoading(true);
    setError(null);

    const isBusiness = role === "business";

    // Temporarily disabled for development testing
    if (false && isBusiness && !confirmationResult && !user.phoneNumber && !bypassPhoneAuth) {
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

    try {
      const finalRole = isAuthorizedAdmin && role === "admin" ? "admin" : role;
      const finalName = finalRole === "admin" && !name ? "System Admin" : name;
      const finalPhone = finalRole === "admin" && !phone ? "N/A" : cleanPhone;
      
      const finalPermissions = finalRole === "admin" ? ["manage_users", "manage_jobs", "manage_disputes", "view_logs", "manage_team"] : permissions;

      // Check for referral
      let referrerUid = null;
      let appliedAffiliateCode = null;
      const refCode = searchParams.get("ref");
      
      const checkReferral = async (codeToTest: string) => {
        if (!codeToTest) return false;
        
        // 1. Check Affiliates / Influencers first
        const affiliateQ = query(collection(db, "affiliates"), where("code", "==", codeToTest.toLowerCase()));
        const affiliateSnap = await getDocs(affiliateQ);
        if (!affiliateSnap.empty) {
          appliedAffiliateCode = affiliateSnap.docs[0].id;
          return true;
        }

        // 2. Check traditional user-to-user referrals
        const q = query(collection(db, "users"), where("referralCode", "==", codeToTest));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          referrerUid = snapshot.docs[0].id;
          return true;
        }
        return false;
      };

      let foundRef = false;
      if (refCode) {
        foundRef = await checkReferral(refCode);
      }
      
      if (!foundRef) {
        const storedRef = localStorage.getItem("anytrader_referral");
        if (storedRef) {
          try {
            const parsed = JSON.parse(storedRef);
            if (parsed.expiresAt > Date.now()) {
              foundRef = await checkReferral(parsed.code);
            } else {
              localStorage.removeItem("anytrader_referral");
            }
          } catch (e) {
            console.error(e);
          }
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
      const { memberId, memberSequence } = await generateMemberId(isBusiness ? "business" : "homeowner");

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
        name: finalName,
        phone: finalPhone,
        role: finalRole,
        businessLayer: role === "business" ? businessLayer : null,
        tierId: selectedTier || (
          role === "homeowner" 
            ? (homeownerType === "business" ? "Business Professional" : "Standard Homeowner")
            : (platformConfig?.feeTiers?.[0]?.name || "Free Explorer")
        ),
        subscriptionType: role === "business" ? "business" : null,
        businessCategory: role === "business" ? businessCategory : null,
        permissions: finalPermissions,
        deviceId,
        ipAddress: detectedIp,
        accountFlags,
        memberId,
        memberSequence,
        fairnessScore: 100, // Starting score
        joinedDuringBeta: true,
        phantomFeesSaved: 0,
        postcode: finalRole === "admin" && !postcode ? "N/A" : postcode.toUpperCase().replace(/\s/g, ""),
        city,
        county,
        trades: selectedTrades,
        subcategories: selectedSubcategories,
        vehicleCategories: finalRole === "fleet_driver" ? vehicleCategories : null,
        isPetFriendly: finalRole === "fleet_driver" ? isPetFriendly : false,
        referralCode: user.uid.slice(0, 8).toUpperCase(), // Generate a simple referral code
        referredBy: referrerUid,
        affiliateId: appliedAffiliateCode,
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

      if (appliedAffiliateCode) {
        try {
          await updateDoc(doc(db, "affiliates", appliedAffiliateCode), {
            uses: increment(1)
          });
        } catch (e) {
          console.error("Failed to increment affiliate uses:", e);
        }
      }

      console.log("Profile saved successfully.");
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
            <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-black/20">
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
      <div className="flex-1 flex items-start justify-center -mt-16 sm:-mt-20 px-4 pb-12 relative z-20">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg w-full bg-white pt-8 sm:pt-10 px-5 sm:px-8 pb-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-xl border border-black/10 space-y-6 relative"
        >
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-2 border-b border-black/5">
                <button 
                  type="button"
                  onClick={() => logout()}
                  className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 p-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all border border-black/10"
                  title="Sign out or switch account"
                >
                  <LogOut className="w-3.5 h-3.5 text-slate-500" />
                  <span>Switch Account</span>
                </button>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                  Step 1 of 3
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Select your role</h2>
                  <p className="text-xs text-slate-500 font-medium">Choose how you plan to use AnyTrader & TradeOS</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setRole("homeowner");
                    }}
                    className={cn(
                      "w-full p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-center gap-3 relative group cursor-pointer",
                      role === "homeowner" 
                        ? "border-2 border-orange-500 bg-orange-50/40 shadow-sm" 
                        : "border-black bg-white hover:bg-slate-50"
                    )}
                  >
                    <div className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                      role === "homeowner" ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                    )}>
                      <Home className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-black text-sm text-slate-900 block leading-tight">Homeowner</span>
                      <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">Post jobs & hire trades</span>
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all",
                      role === "homeowner" ? "border-orange-500 bg-orange-500" : "border-slate-300"
                    )}>
                      {role === "homeowner" && <Check className="w-3 h-3 text-white stroke-[3]" />}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRole("business");
                      setBusinessLayer(null);
                      setBusinessCategory(null);
                      setSelectedTier(null);
                    }}
                    className={cn(
                      "w-full p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-center gap-3 relative group cursor-pointer",
                      role === "business" 
                        ? "border-2 border-orange-500 bg-orange-50/40 shadow-sm" 
                        : "border-black bg-white hover:bg-slate-50"
                    )}
                  >
                    <div className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                      role === "business" ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                    )}>
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-black text-sm text-slate-900 block leading-tight">Business & Trade</span>
                      <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">Services & TradeOS</span>
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all",
                      role === "business" ? "border-orange-500 bg-orange-500" : "border-slate-300"
                    )}>
                      {role === "business" && <Check className="w-3 h-3 text-white stroke-[3]" />}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRole("fleet_driver");
                      setBusinessLayer(null);
                      setBusinessCategory(null);
                      setSelectedTier(null);
                    }}
                    className={cn(
                      "w-full p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-center gap-3 relative group cursor-pointer",
                      role === "fleet_driver" 
                        ? "border-2 border-orange-500 bg-orange-50/40 shadow-sm" 
                        : "border-black bg-white hover:bg-slate-50"
                    )}
                  >
                    <div className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                      role === "fleet_driver" ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                    )}>
                      <CarFront className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-black text-sm text-slate-900 block leading-tight">Driver (Rides)</span>
                      <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">Transport & deliveries</span>
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all",
                      role === "fleet_driver" ? "border-orange-500 bg-orange-500" : "border-slate-300"
                    )}>
                      {role === "fleet_driver" && <Check className="w-3 h-3 text-white stroke-[3]" />}
                    </div>
                  </button>

                  {user?.email?.toLowerCase() === "saanwar2002@gmail.com" && (
                    <button
                      type="button"
                      onClick={() => {
                        setRole("admin");
                        setBusinessLayer(null);
                        setBusinessCategory(null);
                        setSelectedTier(null);
                      }}
                      className={cn(
                        "w-full p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-center gap-3 relative group cursor-pointer",
                        role === "admin" 
                          ? "border-2 border-red-500 bg-red-50/40 shadow-sm" 
                          : "border-black bg-white hover:bg-slate-50 border-dashed"
                      )}
                    >
                      <div className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                        role === "admin" ? "bg-red-500 text-white" : "bg-red-50 text-red-500 group-hover:bg-red-100"
                      )}>
                        <Shield className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-black text-sm text-slate-900 block leading-tight">Master Admin</span>
                        <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">Platform management</span>
                      </div>
                      <div className={cn(
                        "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all",
                        role === "admin" ? "border-red-500 bg-red-500" : "border-slate-300"
                      )}>
                        {role === "admin" && <Check className="w-3 h-3 text-white stroke-[3]" />}
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* Personal Info Fields */}
              {(role === "business" || role === "fleet_driver" || role === "homeowner") && (
                <motion.div 
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3.5 pt-4 border-t border-black/10"
                >
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      required
                      className="w-full p-3.5 rounded-xl border border-black bg-slate-50/60 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:bg-white transition-all font-medium text-slate-900 text-sm"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. John Smith"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">
                      Mobile Number {!user?.isAnonymous && <span className="text-red-500">*</span>}
                    </label>
                    <input 
                      type="tel" 
                      placeholder="07123 456789"
                      className="w-full p-3.5 rounded-xl border border-black bg-slate-50/60 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:bg-white transition-all font-medium text-slate-900 text-sm"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">
                      Postcode <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        required
                        className="w-full p-3.5 pl-10 rounded-xl border border-black bg-slate-50/60 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:bg-white transition-all font-medium text-slate-900 uppercase text-sm"
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
                      <div className="mt-1.5 px-3 py-1.5 bg-green-50 rounded-lg border border-green-200/60 flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                        <span className="text-xs text-green-800 font-bold">
                          Verified: {city}{county ? `, ${county}` : ""}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Fleet Driver Setup */}
              {role === "fleet_driver" && (
                <motion.div 
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3.5 pt-4 border-t border-black/10"
                >
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">Vehicle Setup</p>
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Which categories do you want to drive for?</label>
                    <p className="text-[11px] text-slate-500 mb-2">You can select multiple categories (e.g. Executive cars also take Standard rides).</p>
                    
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'standard', name: 'Standard Car' },
                        { id: 'executive', name: 'Executive' },
                        { id: 'luxury', name: 'Luxury' },
                        { id: '6seater', name: '6-Seater XL' },
                        { id: '8seater', name: '8-Seater Max' },
                        { id: 'wav', name: 'Wheelchair WAV' }
                      ].map(cat => (
                        <label key={cat.id} className={cn("p-2.5 rounded-xl border flex items-center gap-2.5 transition-colors cursor-pointer", vehicleCategories.includes(cat.id) ? "border-orange-500 bg-orange-50/50 text-orange-950 font-bold" : "border-black bg-white hover:bg-slate-50 text-slate-700")}>
                          <input type="checkbox" className="hidden" checked={vehicleCategories.includes(cat.id)} onChange={(e) => {
                            if (e.target.checked) setVehicleCategories(prev => [...prev, cat.id]);
                            else setVehicleCategories(prev => prev.filter(c => c !== cat.id));
                          }} />
                          <div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0", vehicleCategories.includes(cat.id) ? "bg-orange-500 border-orange-500" : "border-slate-400 bg-white")}>
                            {vehicleCategories.includes(cat.id) && <Check className="w-3 h-3 text-white stroke-[3]" />}
                          </div>
                          <span className="text-xs font-bold">{cat.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="pt-1">
                    <label className={cn("p-3 rounded-xl border flex items-center justify-between transition-colors cursor-pointer", isPetFriendly ? "border-orange-500 bg-orange-50/50" : "border-black bg-white hover:bg-slate-50")}>
                      <div>
                        <p className="text-xs font-black text-slate-900">Pet Friendly Vehicle</p>
                        <p className="text-[11px] text-slate-500">Allow passengers with pets (+£3 fare bonus)</p>
                      </div>
                      <input type="checkbox" className="hidden" checked={isPetFriendly} onChange={(e) => setIsPetFriendly(e.target.checked)} />
                      <div className={`w-9 h-5 outline-none rounded-full transition-colors relative shadow-inner shrink-0 ${isPetFriendly ? 'bg-orange-500' : 'bg-slate-200'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isPetFriendly ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </div>
                    </label>
                  </div>
                </motion.div>
              )}

              {/* Trust Bar */}
              <div className="grid grid-cols-3 gap-2 py-3 border-y border-black/5 bg-slate-50/50 rounded-xl px-2">
                <div className="flex flex-col items-center text-center gap-0.5">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-[9px] font-black text-slate-700 uppercase tracking-tight">Verified Trades</span>
                </div>
                <div className="flex flex-col items-center text-center gap-0.5 border-x border-black/10">
                  <Shield className="w-4 h-4 text-blue-600" />
                  <span className="text-[9px] font-black text-slate-700 uppercase tracking-tight">Secure Platform</span>
                </div>
                <div className="flex flex-col items-center text-center gap-0.5">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span className="text-[9px] font-black text-slate-700 uppercase tracking-tight">Genuine Reviews</span>
                </div>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold shadow-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Continue Button & Helper message */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
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
                      if (role === "business") {
                        setStep(1.5);
                      } else {
                        handleSubmit();
                      }
                    }
                  }}
                  disabled={
                    !role || 
                    loading ||
                    (role !== "admin" && (!name || !postcode || (!user?.isAnonymous && !phone))) ||
                    (role === "fleet_driver" && vehicleCategories.length === 0)
                  }
                  className="w-full flex items-center justify-center gap-2.5 bg-orange-500 text-white p-4 rounded-2xl font-black text-base hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/25 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none active:scale-98 group cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <span>{role === "business" || role === "fleet_driver" ? "Continue" : "Complete Setup"}</span>
                      <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>

                {/* Validation helper when button is disabled */}
                {!role && (
                  <p className="text-[11px] text-center text-slate-400 font-medium">
                    Please select a role above to proceed
                  </p>
                )}
                {role && role !== "admin" && (!name || !postcode || (!user?.isAnonymous && !phone)) && (
                  <p className="text-[11px] text-center text-amber-600 font-medium">
                    {!name ? "Enter your full name" : !postcode ? "Enter your postcode" : "Enter your mobile number"} to continue
                  </p>
                )}
              </div>
            </div>
          )}


          {/* Step 1.5: Business Layer Selection */}
          {step === 1.5 && role === "business" && (
            <div className="space-y-8">
              <div 
                onClick={() => setStep(1)}
                className="absolute top-6 left-6 text-slate-500 hover:text-slate-800 p-2.5 z-[60] cursor-pointer bg-white rounded-2xl shadow hover:shadow-md transition-all group border border-black"
              >
                  <ChevronLeft className="w-8 h-8 group-hover:-translate-x-0.5 transition-transform" />
              </div>
              <div className="text-center space-y-2 pt-10">
                <h1 className="text-3xl font-display font-black text-slate-900 tracking-tight">
                  Select Business Type
                </h1>
                <p className="text-slate-500 font-medium text-sm">
                  Choose how you will use the platform.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <button
                  onClick={() => {
                     setBusinessLayer('properties');
                     setStep(2);
                  }}
                  className={cn(
                    "w-full p-5 rounded-3xl border-2 text-left transition-all duration-300 flex items-center gap-4 relative group",
                    businessLayer === "properties" 
                      ? "border-orange-500 bg-orange-50/30 ring-4 ring-orange-500/10" 
                      : "border-black bg-white hover:border-black"
                  )}
                >
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors",
                    businessLayer === "properties" ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
                  )}>
                    <Building2 className="w-7 h-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-black text-lg text-slate-900 block tracking-tight">Property & Asset Management</span>
                    <span className="text-sm text-slate-500 block leading-tight">Landlords, agents, fleet managers</span>
                  </div>
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                    businessLayer === "properties" ? "border-orange-500" : "border-black"
                  )}>
                    {businessLayer === 'properties' && <div className="w-3 h-3 rounded-full bg-orange-500" />}
                  </div>
                </button>

                <button
                  onClick={() => {
                     setBusinessLayer('field_services');
                     setStep(2);
                  }}
                  className={cn(
                    "w-full p-5 rounded-3xl border-2 text-left transition-all duration-300 flex items-center gap-4 relative group",
                    businessLayer === "field_services" 
                      ? "border-orange-500 bg-orange-50/30 ring-4 ring-orange-500/10" 
                      : "border-black bg-white hover:border-black"
                  )}
                >
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors",
                    businessLayer === "field_services" ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
                  )}>
                    <Briefcase className="w-7 h-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-black text-lg text-slate-900 block tracking-tight">Trades & Services</span>
                    <span className="text-sm text-slate-500 block leading-tight">Plumbers, electricians, cleaners</span>
                  </div>
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                    businessLayer === "field_services" ? "border-orange-500" : "border-black"
                  )}>
                    {businessLayer === 'field_services' && <div className="w-3 h-3 rounded-full bg-orange-500" />}
                  </div>
                </button>

                <button
                  onClick={() => {
                     setBusinessLayer('consultancy');
                     setStep(2);
                  }}
                  className={cn(
                    "w-full p-5 rounded-3xl border-2 text-left transition-all duration-300 flex items-center gap-4 relative group",
                    businessLayer === "consultancy" 
                      ? "border-orange-500 bg-orange-50/30 ring-4 ring-orange-500/10" 
                      : "border-black bg-white hover:border-black"
                  )}
                >
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors",
                    businessLayer === "consultancy" ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
                  )}>
                    <Award className="w-7 h-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-black text-lg text-slate-900 block tracking-tight">Professional & Consultancy</span>
                    <span className="text-sm text-slate-500 block leading-tight">Tutors, accountants, event planners</span>
                  </div>
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                    businessLayer === "consultancy" ? "border-orange-500" : "border-black"
                  )}>
                    {businessLayer === 'consultancy' && <div className="w-3 h-3 rounded-full bg-orange-500" />}
                  </div>
                </button>
              </div>

            </div>
          )}

          {/* Step 2: Tradesperson or Consultancy - Select Categories */}
          {step === 2 && role === "business" && (businessLayer === "field_services" || businessLayer === "consultancy") && (
            <div className="space-y-8">
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-display font-black text-slate-900 tracking-tight">
                  {businessLayer === "consultancy" ? "Select Your Professional Categories" : "Select Your Trades"}
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
                  <p className="text-xs text-slate-600 leading-relaxed">Select multiple {businessLayer === "consultancy" ? "categories" : "trades"} below to see more jobs. You can also add or edit your specializations later in your Profile.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                {(businessLayer === "consultancy" ? CONSULTANCY_CATEGORIES : categories).map((t: any) => (
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
                          : "bg-white border-black text-slate-600 hover:border-black"
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
                        className="ml-4 p-4 bg-slate-50 border border-black rounded-2xl space-y-3"
                      >
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Specific Services:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {t.subcategories.map((sub: string, subIdx: number) => (
                            <label key={`${t.id}-${sub}-${subIdx}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white transition-colors cursor-pointer border border-transparent hover:border-black group">
                              <div className="relative flex items-center">
                                <input 
                                  type="checkbox" 
                                  className="w-5 h-5 rounded-md border-2 border-black text-primary focus:ring-primary focus:ring-offset-0 transition-all cursor-pointer peer"
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
                  className="flex-1 p-5 rounded-[2rem] border-2 border-black font-black text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
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
          {step === 2 && role === "business" && businessLayer === "properties" && (
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
                    className="w-full p-4 rounded-xl border border-black focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm"
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
                              : "bg-white border-black text-slate-600 hover:border-black"
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
                              : "bg-white border-black hover:border-black"
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
                      className="flex-1 p-5 rounded-[2rem] border-2 border-black font-black text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
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
                  <div key={idx} className="p-5 rounded-[2rem] border-2 border-black bg-slate-50/50 space-y-4">
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
                      className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl border-2 border-dashed border-black bg-white text-xs font-black text-slate-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all group"
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
                  className="w-full sm:w-auto p-5 rounded-[2rem] border-2 border-black font-black text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
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
                    className="flex-1 bg-white border-2 border-black text-slate-600 p-5 rounded-[2rem] font-black text-sm sm:text-lg hover:border-black hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
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
                  className="w-full text-center text-3xl tracking-[1em] p-6 rounded-[2rem] border-2 border-black focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none font-mono"
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setStep(1); // Go back to start
                    setConfirmationResult(null);
                  }}
                  className="flex-1 p-5 rounded-[2rem] border-2 border-black font-black text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
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

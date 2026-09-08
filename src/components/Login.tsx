import React, { useState, useEffect } from "react";
import { signInWithGoogle, signUpWithEmail, signInWithEmail, sendVerificationEmail, resetPassword, handleRedirectResult } from "@/src/firebase";
import { motion, AnimatePresence } from "motion/react";
import { LogIn, Loader2, Shield, Mail, Lock, Eye, EyeOff, Fingerprint, ScanFace, ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";
import { BiometricService } from "@/src/services/biometricService";
import { isTemporaryEmail } from "@/src/lib/utils";
import { Logo } from "./Logo";
import { Capacitor } from "@capacitor/core";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Biometrics States
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<"face" | "fingerprint" | "none" | "biometric">("biometric");
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [enableBiometricCheckbox, setEnableBiometricCheckbox] = useState(false);
  const [showBiometricOverlay, setShowBiometricOverlay] = useState(false);
  const [biometricStatusText, setBiometricStatusText] = useState("");

  useEffect(() => {
    async function checkBiometrics() {
      const status = await BiometricService.checkAvailability();
      setBiometricAvailable(status.available);
      setBiometricType(status.type);
      
      const enrolled = BiometricService.isEnabled();
      setBiometricsEnabled(enrolled);
    }
    checkBiometrics();
  }, []);

  const handleBiometricSignIn = async () => {
    setError(null);
    setBiometricStatusText("Scanning biometric profile...");
    setShowBiometricOverlay(true);
    
    try {
      // Simulate/Process Scan and verify
      const success = await BiometricService.authenticate("Verify FaceID / Tap your fingerprint sensor to sign in securely.");
      if (success) {
        const credentials = BiometricService.getCredentials();
        if (credentials) {
          setBiometricStatusText("Biometric hardware verified! Confirming session...");
          setEmail(credentials.email);
          setShowBiometricOverlay(false);
          setInfoMessage(`Biometric device verified for ${credentials.email}. Please enter your password or passkey to sign in.`);
        } else {
          setError("No enrolled biometric profile found on this device. Please sign in with your email and password.");
        }
      } else {
        // Cancelled or failed
        setError("Biometric verification canceled by user.");
      }
    } catch (err: any) {
      console.error("Biometric Login error:", err);
      const errCode = err?.code || "";
      const errMsg = err?.message || String(err);
      if (errCode === "auth/network-request-failed" || errMsg.includes("network-request-failed")) {
        setError("Network connection issue while signing in. Please check your internet connection and try again.");
      } else {
        setError(errMsg.replace(/^Firebase:\s*/, "") || "Biometric authentication failed.");
      }
    } finally {
      setShowBiometricOverlay(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only check redirect result in standalone top-level window to avoid iframe CSP issues
    if (typeof window !== "undefined" && window === window.top) {
      handleRedirectResult()
        .then((result) => {
          if (result?.user) {
            console.log("[Login] Redirect sign-in success:", result.user.email);
          }
        })
        .catch((err: any) => {
          console.warn("[Login] Redirect sign-in check handled:", err?.message || err);
        });
    }
  }, []);

  const handleEmailAuth = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    setError(null);
    setInfoMessage(null);

    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return;
    }

    // Basic email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!isResetPassword) {
      if (!trimmedPassword) {
        setError("Please enter your password.");
        return;
      }
      if (isSignup) {
        if (trimmedPassword.length < 8) {
          setError("Password must be at least 8 characters long.");
          return;
        }
        if (!/\d/.test(trimmedPassword) || !/[a-zA-Z]/.test(trimmedPassword)) {
          setError("Password must contain both letters and numbers.");
          return;
        }
      }
    }

    setLoading(true);
    try {
      if (isResetPassword) {
        await resetPassword(trimmedEmail);
        setInfoMessage("Password reset link sent! Please check your email inbox.");
        setIsResetPassword(false);
      } else if (isSignup) {
        if (isTemporaryEmail(trimmedEmail)) {
          throw new Error("Temporary email addresses are not allowed. Please use a valid email address.");
        }
        const { user } = await signUpWithEmail(trimmedEmail, trimmedPassword);
        try {
          await sendVerificationEmail(user);
        } catch (emailErr) {
          console.warn("Failed to send verification email:", emailErr);
        }
        setInfoMessage("Account created successfully! Logging you in...");
        setIsSignup(false);
      } else {
        await signInWithEmail(trimmedEmail, trimmedPassword);
        // Enroll biometrics dynamically on successful login if requested
        if (biometricAvailable && enableBiometricCheckbox) {
          await BiometricService.enroll(trimmedEmail);
          console.log("[Login] Biometrics enrolled successfully on login for:", trimmedEmail);
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      if (error.code === "auth/invalid-email") {
        setError("The email address is badly formatted.");
      } else if (error.code === "auth/user-not-found") {
        setError("No account found with this email address.");
      } else if (error.code === "auth/wrong-password") {
        setError("Incorrect password. Please try again.");
      } else if (error.code === "auth/email-already-in-use") {
        setError("An account with this email address already exists. Please Sign In instead, or use the Forgot Password link to reset your credentials.");
      } else if (error.code === "auth/weak-password") {
        setError("The password is too weak. Please choose a stronger password (minimum 6 characters).");
      } else if (error.code === "auth/operation-not-allowed") {
        setError("Email and Password registration is not enabled in the Firebase Console. Please ask the administrator to enable Email/Password provider.");
      } else if (error.code === "auth/invalid-credential") {
        setError("Invalid email or password. Please verify your credentials and try again.");
      } else {
        // If it's a standard Error with a message string from user-created errors, use it
        setError(error.message || "An error occurred during authentication. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-brand-blue relative overflow-x-hidden px-3.5 sm:px-6 shadow-inner selection:bg-primary selection:text-white">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/10 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-48 -right-24 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-50" />
      </div>

      <div className="flex-1 flex items-center justify-center py-6 sm:py-10">
        <motion.div 
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="max-w-md w-full bg-white/95 backdrop-blur-xl p-5 sm:p-8 rounded-[32px] sm:rounded-[36px] border border-black/20 shadow-2xl shadow-black/25 text-center space-y-5 relative z-10"
        >
          {/* Brand Header */}
          <div className="space-y-3">
            <div className="w-20 h-20 bg-primary rounded-[26px] flex items-center justify-center mx-auto shadow-xl shadow-primary/30 transform -rotate-3 hover:rotate-0 transition-transform duration-500 ease-out group">
              <Logo size={46} className="text-white group-hover:scale-105 transition-transform duration-300" />
            </div>
            <div className="space-y-0.5">
              <h1 className="text-3xl sm:text-4xl font-display font-black text-slate-900 tracking-tight">AnyTrader</h1>
              <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px]">Place for every skill</p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-trust/10 text-trust text-[10px] font-black uppercase tracking-widest rounded-full border border-trust/20">
              <Shield className="w-3.5 h-3.5" />
              Verified UK Marketplace
            </div>
          </div>

          {/* Mode Switcher Segmented Control (Sign In vs Sign Up) */}
          {!isResetPassword && (
            <div className="bg-slate-100 p-1 rounded-2xl border border-black/10 flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setIsSignup(false);
                  setError(null);
                  setInfoMessage(null);
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  !isSignup 
                    ? "bg-white text-slate-900 shadow-sm border border-black/10" 
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSignup(true);
                  setError(null);
                  setInfoMessage(null);
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  isSignup 
                    ? "bg-white text-slate-900 shadow-sm border border-black/10" 
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {isResetPassword && (
            <div className="flex items-center justify-between pb-1 border-b border-black/10">
              <button 
                onClick={() => { setIsResetPassword(false); setError(null); setInfoMessage(null); }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-primary transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Sign In</span>
              </button>
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider">Reset Password</span>
            </div>
          )}

          {/* Feedback Messages */}
          {infoMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 text-xs font-bold text-left flex items-start gap-2.5 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </motion.div>
          )}

          {error && !error.startsWith("FIREBASE_MISCONFIGURED") && !error.startsWith("FIREBASE_INTERNAL_ERROR") && (
            <motion.div 
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold text-left break-words whitespace-pre-wrap shadow-sm"
            >
              {error}
            </motion.div>
          )}

          {error?.startsWith("FIREBASE_INTERNAL_ERROR") && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 text-sm overflow-y-auto max-h-[60vh] text-left border border-black space-y-3 shadow-md">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-600 shrink-0" />
                <h3 className="font-bold text-amber-950 text-base">Third-Party Storage Blocked</h3>
              </div>
              
              <p className="text-amber-800 leading-relaxed text-xs">
                Firebase Auth threw <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold text-amber-950 text-[10px]">auth/internal-error</code>. This is a very common browser behavior, usually caused by <strong className="font-extrabold text-amber-950">"Block third-party cookies"</strong> being enabled in your web browser (especially in Incognito Mode, Brave Browser, or strict privacy mode).
              </p>
              
              <div className="bg-amber-100/50 p-3 rounded-xl space-y-1.5 text-xs">
                <p className="font-bold text-amber-950">How to resolve:</p>
                <ul className="list-disc pl-4 space-y-1.5 text-amber-900">
                  <li>Sign up or log in with your <strong className="font-bold text-amber-950">Email and Password</strong> above.</li>
                  <li>Or, click the address bar Settings/Lock icon next to the URL and allow third-party cookies for this session.</li>
                </ul>
              </div>
              
              <details className="text-[10px] text-amber-700">
                <summary className="cursor-pointer font-bold select-none hover:underline">Technical Error Message Details</summary>
                <pre className="mt-2 p-2 bg-amber-100 rounded overflow-x-auto whitespace-pre-wrap break-words border border-amber-200 font-mono">
                  {error.replace("FIREBASE_INTERNAL_ERROR:", "").trim() || "No additional error message provided."}
                </pre>
              </details>
            </div>
          )}

          {error?.startsWith("FIREBASE_MISCONFIGURED") && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm overflow-y-auto max-h-[60vh] text-left">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-red-600 shrink-0" />
                <h3 className="font-bold text-red-900 text-base">Google Auth Not Enabled</h3>
              </div>
              <p className="mb-3 text-red-700">Firebase threw an internal error. This usually means Google Login is not fully set up in your Firebase Console.</p>
              <ol className="list-decimal pl-5 space-y-3 text-red-800 font-medium pb-4 border-b border-red-200 mb-4 text-sm">
                <li>
                  <span className="font-bold text-red-900">Set Project Support Email (Most Common Fix):</span>
                  <br />Go to Firebase Console &gt; Project Settings (gear icon top left) &gt; General. Scroll down to <span className="font-bold">Support email</span> and select your email address.
                </li>
                <li>
                  <span className="font-bold text-red-900">Enable Google Provider:</span>
                  <br />Go to Firebase Console &gt; Authentication &gt; <span className="font-bold">Sign-in method</span> &gt; Add new provider &gt; Google &gt; Enable &amp; Save.
                </li>
                <li>
                  <span className="font-bold text-red-900">Add to Firebase Authorized Domains (Crucial for deployed apps):</span>
                  <br />Go to Firebase Console &gt; Authentication &gt; Settings &gt; <span className="font-bold">Authorized domains</span>. Click "Add domain" and enter exactly: <span className="font-bold underline text-blue-800">{window.location.hostname}</span>
                </li>
                <li>
                  <span className="font-bold text-red-900">Update OAuth Client Authorized Origins (Crucial!):</span>
                  <br />Go to Google Cloud Console &gt; APIs &amp; Services &gt; Credentials. Find the "Web client (auto created by Google Service)" OAuth client, and MAKE SURE these exact URLs are added (delete any wrong ones):
                  <ul className="list-disc pl-5 mt-2 space-y-2">
                    <li>
                      <span className="font-semibold">Authorized JavaScript origins:</span>
                      <br /><span className="bg-yellow-200 text-black px-2 py-1 select-all font-mono">https://anytradercombined.firebaseapp.com</span>
                      <br /><span className="bg-yellow-200 text-black px-2 py-1 select-all font-mono pt-1">{window.location.origin}</span>
                    </li>
                    <li>
                      <span className="font-semibold">Authorized redirect URIs:</span>
                      <br /><span className="bg-yellow-200 text-black px-2 py-1 select-all font-mono">https://anytradercombined.firebaseapp.com/__/auth/handler</span>
                    </li>
                  </ul>
                  <div className="mt-2 text-red-900 font-bold bg-red-100 p-2 rounded border border-red-300">
                    ⚠️ IMPORTANT: Look at your screenshot! You missed the "https://" part in your 2nd JavaScript origin. It must be exactly <span className="underline">https://ais-dev-vumupz44ljjitc6rsqobbz-437256678397.europe-west2.run.app</span> (including the https://)
                  </div>
                </li>
              </ol>
              <details className="text-xs text-red-600">
                <summary className="cursor-pointer font-bold">Debug Error Details</summary>
                <pre className="mt-2 p-2 bg-red-100 rounded overflow-x-auto whitespace-pre-wrap break-words border border-red-200">
                  {error.replace("FIREBASE_MISCONFIGURED:", "").trim() || "No additional error message provided."}
                </pre>
              </details>
            </div>
          )}

          {/* Primary Form */}
          <form onSubmit={(e) => { e.preventDefault(); handleEmailAuth(); }} className="space-y-3.5 text-left">
            {/* Fast Biometric Action Strip (when available & enrolled) */}
            {biometricsEnabled && biometricAvailable && !isSignup && !isResetPassword && (
              <div className="p-3 bg-slate-900 text-white border border-black rounded-2xl flex items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
                    {biometricType === "face" ? (
                      <ScanFace className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Fingerprint className="w-5 h-5 text-emerald-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-xs text-white leading-tight truncate">Quick Biometric Sign-In</p>
                    <p className="text-[10px] text-slate-400 font-medium truncate">Touch ID / Face ID saved</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleBiometricSignIn}
                  disabled={loading}
                  className="bg-primary hover:bg-primary-hover text-white text-[11px] font-black uppercase tracking-wider py-2 px-3.5 rounded-xl transition-all active:scale-95 shrink-0 shadow-sm"
                >
                  Verify &amp; Enter
                </button>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 pl-1">
                Email Address
              </label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-primary transition-colors" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-black bg-slate-50/70 focus:bg-white focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-medium text-slate-900 text-sm"
                />
              </div>
            </div>

            {/* Password Field */}
            {!isResetPassword && (
              <div className="space-y-1">
                <div className="flex items-center justify-between pl-1 pr-1">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600">
                    Password
                  </label>
                  {!isSignup && (
                    <button
                      type="button"
                      onClick={() => { setIsResetPassword(true); setError(null); setInfoMessage(null); }}
                      className="text-[11px] font-bold text-primary hover:underline"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-primary transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    placeholder={isSignup ? "At least 8 chars with letters & numbers" : "••••••••"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-11 py-3.5 rounded-2xl border border-black bg-slate-50/70 focus:bg-white focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-medium text-slate-900 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>
            )}

            {/* Biometric Opt-In Checkbox */}
            {!isSignup && !isResetPassword && biometricAvailable && (
              <div className="flex items-center gap-2.5 px-1 py-1">
                <input
                  type="checkbox"
                  id="enableBiometricCheckbox"
                  checked={enableBiometricCheckbox}
                  onChange={(e) => setEnableBiometricCheckbox(e.target.checked)}
                  className="w-4.5 h-4.5 rounded border border-black accent-primary cursor-pointer shrink-0"
                />
                <label htmlFor="enableBiometricCheckbox" className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer select-none">
                  <Fingerprint className="w-4 h-4 text-primary" />
                  <span>Enable Biometric Quick Sign-In next time</span>
                </label>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-3.5 px-5 rounded-2xl font-black uppercase tracking-wider text-xs sm:text-sm hover:bg-primary-hover transition-all shadow-lg shadow-primary/25 disabled:opacity-50 active:scale-[0.98] hover:-translate-y-0.5 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isResetPassword ? (
                "Send Password Reset Link"
              ) : isSignup ? (
                "Create AnyTrader Account"
              ) : (
                "Sign In to Account"
              )}
            </button>
          </form>

          {/* Social Divider */}
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-black/20"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white/95 px-3 font-bold text-slate-400 tracking-widest text-[10px]">Or Continue With</span>
            </div>
          </div>

          {/* Preview Panel Warning if iframe embedded */}
          {window !== window.top && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3.5 rounded-2xl flex flex-col items-center gap-2 text-center shadow-sm">
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-600" />
                <p className="font-bold text-xs">Google Login Blocked in Preview Frame</p>
              </div>
              <p className="text-[11px] leading-snug">Google security blocks sign-in within embedded panels.</p>
              <a 
                href={window.location.href} 
                target="_blank" 
                rel="noreferrer"
                className="mt-0.5 text-[11px] font-black bg-blue-600 text-white px-4 py-2 rounded-xl shadow-md uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-transform"
              >
                Open Full Screen To Login
              </a>
            </div>
          )}

          {/* Secondary Auth Options */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={async () => {
                setLoading(true);
                setError(null);
                try {
                  await signInWithGoogle();
                } catch (error: any) {
                  console.warn("Google Auth Warning:", error);
                  const errMsg = error?.message || String(error);
                  const errCode = error?.code || "";
                  
                  if (
                    errCode === "auth/internal-error" || 
                    errMsg.includes("auth/internal-error") || 
                    errMsg.includes("internal-error") ||
                    errMsg.includes("web-channel-connection-failed")
                  ) {
                    setError("FIREBASE_INTERNAL_ERROR: " + errMsg);
                  } else if (errCode === 'auth/network-request-failed' || errMsg.includes('network-request-failed')) {
                    if (window !== window.top) {
                      setError("Google Login is blocked inside this preview panel due to browser security. Please tap the 'Open App in New Tab' icon (top right corner of this preview) to open the app in a full window, then log in again.");
                    } else {
                      setError(`FIREBASE_MISCONFIGURED: ${errMsg} (Code: ${errCode})`);
                    }
                  } else if (errCode === 'auth/unauthorized-domain' || errMsg.includes('unauthorized-domain')) {
                    setError("This domain is not authorized. Please add it to Firebase Console > Authentication > Settings > Authorized domains.");
                  } else if (errCode === 'auth/popup-closed-by-user' || errMsg.includes('popup-closed-by-user')) {
                    setError("Sign-in popup was closed before completing.");
                  } else {
                    setError(errMsg || "An error occurred during Google sign in.");
                  }
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 bg-white border border-black py-3 px-4 rounded-2xl font-bold text-slate-800 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50 active:scale-[0.98] text-xs sm:text-sm"
            >
              <img 
                src="https://www.google.com/favicon.ico" 
                alt="Google" 
                className="w-4.5 h-4.5"
              />
              Continue with Google
            </button>
          </div>

          {/* Footer Terms */}
          <div className="pt-3 border-t border-black/10 space-y-2">
            <p className="text-[11px] text-slate-400 leading-snug">
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Biometric Authentication Overlay Modal */}
      {showBiometricOverlay && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 z-50 animate-fade-in">
          <div className="w-full max-w-sm bg-white border border-black rounded-3xl p-6 text-center shadow-2xl relative">
            <div className="flex flex-col items-center gap-5 my-4">
              <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center border border-black/10 relative">
                {biometricType === "face" ? (
                  <ScanFace className="w-10 h-10 text-primary animate-pulse" />
                ) : (
                  <Fingerprint className="w-10 h-10 text-primary animate-pulse" />
                )}
                <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-black leading-tight">Security Verification</h3>
                <p className="text-xs text-slate-500 font-bold mt-1 px-4">Please authenticate to access your AnyTrader account</p>
              </div>
              <div className="w-full bg-slate-50 border border-black/10 py-3 rounded-2xl">
                <p className="text-xs font-bold text-slate-700">{biometricStatusText}</p>
              </div>
              
              {!Capacitor.isNativePlatform() && (
                <div className="w-full flex flex-col gap-2 pt-2 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Web Simulator controls</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        setBiometricStatusText("Simulated scan! Authenticating...");
                        await new Promise(resolve => setTimeout(resolve, 800));
                        const credentials = BiometricService.getCredentials();
                        if (credentials) {
                          setBiometricStatusText("Biometrics verified! Loading profile...");
                          setEmail(credentials.email);
                          setShowBiometricOverlay(false);
                          setInfoMessage(`Biometric device verified for ${credentials.email}. Please enter your password or passkey to sign in.`);
                        } else {
                          setError("Simulator Alert: You haven't enrolled any credentials. Tick 'Enable Biometric Sign-In next time' below the password field, log in once with email/password, and on next logout you can log in instantly with one-click!");
                        }
                        setShowBiometricOverlay(false);
                      }}
                      className="flex-1 bg-black text-white text-[11px] font-black uppercase py-2.5 rounded-xl hover:bg-slate-800 active:scale-95 transition-transform"
                    >
                      Authenticate
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setError("Biometric identity challenge failed / rejected (simulated).");
                        setShowBiometricOverlay(false);
                      }}
                      className="flex-1 bg-slate-100 border border-black/10 text-slate-700 text-[11px] font-black uppercase py-2.5 rounded-xl hover:bg-slate-200 active:scale-95 transition-transform"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              
              {Capacitor.isNativePlatform() && (
                <button
                  type="button"
                  onClick={() => setShowBiometricOverlay(false)}
                  className="w-full bg-slate-100 border border-black/10 text-slate-700 text-xs font-extrabold py-3 rounded-xl hover:bg-slate-200 active:scale-95 transition-transform mt-2"
                >
                  Cancel Scan
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

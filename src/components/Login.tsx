import React, { useState, useEffect } from "react";
import { signInWithGoogle, signInAsGuest, signUpWithEmail, signInWithEmail, sendVerificationEmail, resetPassword, handleRedirectResult } from "@/src/firebase";
import { motion } from "motion/react";
import { LogIn, Loader2, UserCircle, Shield, Mail, Lock, Eye, EyeOff, Fingerprint, ScanFace } from "lucide-react";
import { BiometricService } from "@/src/services/biometricService";
import { isTemporaryEmail } from "@/src/lib/utils";
import { Logo } from "./Logo";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [adminGuestLoading, setAdminGuestLoading] = useState(false);
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
      
      // Auto-trigger biometric verification if enrolled on device mount
      if (enrolled && status.available) {
        const timer = setTimeout(() => {
          handleBiometricSignIn();
        }, 800);
        return () => clearTimeout(timer);
      }
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
          setBiometricStatusText("Biometric authenticated securely! Singing in...");
          setEmail(credentials.email);
          setPassword(credentials.pass);
          setLoading(true);
          await signInWithEmail(credentials.email, credentials.pass);
        } else {
          setError("No stored biometric credentials found. Please sign in manually and enable biometrics in App Settings.");
        }
      } else {
        // Cancelled or failed
        setError("Biometric verification canceled by user.");
      }
    } catch (err: any) {
      console.error("Biometric Login error:", err);
      setError(err?.message || "Biometric authentication failed.");
    } finally {
      setShowBiometricOverlay(false);
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
          await BiometricService.enroll(trimmedEmail, trimmedPassword);
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

  const handleGuestLogin = async () => {
    setGuestLoading(true);
    setError(null);
    try {
      await signInAsGuest();
    } catch (error: any) {
      console.error("Guest login error:", error);
      if (error.code === "auth/admin-restricted-operation") {
        setError("Anonymous sign-in is not enabled in the Firebase Console. Please enable it to use this feature.");
      } else if (error.code === "auth/network-request-failed") {
        setError("A network error occurred. Please check your internet connection and try again. If you're using a VPN or ad-blocker, try disabling it.");
      } else {
        setError(error.message || "An error occurred during guest login. Please try again.");
      }
    } finally {
      setGuestLoading(false);
    }
  };

  const handleAdminGuestLogin = async () => {
    console.log("Admin guest login triggered");
    setAdminGuestLoading(true);
    setError(null);
    try {
      const userCredential = await signInAsGuest();
      console.log("Admin guest login success:", userCredential.user);
      if (userCredential.user) {
        // We set a flag in sessionStorage so the onboarding or profile logic 
        // knows to set the role to admin for this specific test session
        sessionStorage.setItem("is_test_admin", "true");
        console.log("is_test_admin set in sessionStorage");
      }
    } catch (error: any) {
      console.error("Admin guest login error:", error);
      setError(error.message || "An error occurred during admin guest login.");
    } finally {
      setAdminGuestLoading(false);
      console.log("Admin guest loading set to false");
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-brand-blue relative overflow-hidden px-4 shadow-inner">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/10 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-48 -right-24 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-50" />
      </div>

      <div className="flex-1 flex items-center justify-center py-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-md w-full bg-white/95 backdrop-blur-xl p-6 sm:p-10 rounded-[40px] border border-black/20 shadow-2xl shadow-black/20 text-center space-y-6 sm:space-y-8 relative z-10"
        >
        <div className="space-y-4">
          <div className="w-24 h-24 bg-primary rounded-[32px] flex items-center justify-center mx-auto shadow-2xl shadow-primary/40 transform -rotate-6 hover:rotate-0 transition-transform duration-700 ease-out group">
            <Logo size={56} className="text-white group-hover:scale-110 transition-transform duration-500" />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-display font-black text-slate-900 tracking-tight">AnyTrader</h1>
            <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px]">Place for every skill</p>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-trust/10 text-trust text-[10px] font-black uppercase tracking-widest rounded-full border border-trust/20">
            <Shield className="w-3.5 h-3.5" />
            Verified UK Marketplace
          </div>
        </div>

        {infoMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-medium">
            {infoMessage}
          </div>
        )}

        {error && !error.startsWith("FIREBASE_MISCONFIGURED") && !error.startsWith("FIREBASE_INTERNAL_ERROR") && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm break-words whitespace-pre-wrap">
            {error}
          </div>
        )}

        {error?.startsWith("FIREBASE_INTERNAL_ERROR") && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-sm overflow-y-auto max-h-[60vh] text-left border border-black space-y-3 shadow-md">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-600 shrink-0" />
              <h3 className="font-bold text-amber-950 text-base">Third-Party Storage Blocked</h3>
            </div>
            
            <p className="text-amber-800 leading-relaxed text-xs">
              Firebase Auth threw <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold text-amber-950 text-[10px]">auth/internal-error</code>. This is a very common browser behavior, usually caused by <strong className="font-extrabold text-amber-950">"Block third-party cookies"</strong> being enabled in your web browser (especially in Incognito Mode, Brave Browser, or strict privacy mode).
            </p>
            
            <div className="bg-amber-100/50 p-3 rounded-xl space-y-1.5 text-xs">
              <p className="font-bold text-amber-950">How to fix or continue instantly:</p>
              <ul className="list-disc pl-4 space-y-1.5 text-amber-900">
                <li><strong className="text-amber-950 font-bold">Recommended:</strong> Click the <strong className="text-slate-800 font-bold">"Continue as Guest"</strong> or <strong className="text-red-500 font-bold">"Test Admin Access"</strong> button below to log in instantly without needing cookies!</li>
                <li>Or, sign up with a custom <strong className="font-bold text-amber-950">Email and Password</strong> above, which bypasses Google popup cookie constraints.</li>
                <li>Or, click the address bar Settings/Lock icon next to the URL and choose to allow third-party cookies for this session.</li>
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

        <div className="space-y-4">
          {!isResetPassword && (
            <>
              {biometricsEnabled && biometricAvailable && !isSignup && (
                <div className="p-4.5 bg-slate-50 border border-black rounded-2xl flex flex-col items-center gap-3.5 text-center shadow-sm relative overflow-hidden">
                  <div className="absolute right-3 top-3 w-4 h-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <div className="flex items-center gap-3 w-full self-start text-left font-sans">
                    <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center shrink-0 border border-black/10">
                      {biometricType === "face" ? (
                        <ScanFace className="w-6 h-6 text-primary" />
                      ) : (
                        <Fingerprint className="w-6 h-6 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="font-extrabold text-sm text-black">Fast Biometric Sign-In</p>
                      <p className="text-[11px] text-slate-500 font-bold">Use FaceID / TouchID on this device</p>
                    </div>
                  </div>
                  <button
                    onClick={handleBiometricSignIn}
                    className="w-full bg-black text-white hover:bg-slate-800 text-xs font-black uppercase tracking-widest py-3.5 px-4 rounded-xl transition-all active:scale-[0.98] border border-black hover:-translate-y-0.5 shadow-sm"
                  >
                    Authenticate with Biometrics
                  </button>
                </div>
              )}

              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4.5 rounded-2xl border border-black focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-medium bg-slate-50/50 focus:bg-white"
                />
              </div>
              {!isResetPassword && (
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-4.5 rounded-2xl border border-black focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-medium bg-slate-50/50 focus:bg-white"
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              )}

              {!isSignup && !isResetPassword && biometricAvailable && (
                <div className="flex items-center gap-2.5 px-1 py-1 max-w-full">
                  <input
                    type="checkbox"
                    id="enableBiometricCheckbox"
                    checked={enableBiometricCheckbox}
                    onChange={(e) => setEnableBiometricCheckbox(e.target.checked)}
                    className="w-4.5 h-4.5 rounded border border-black accent-primary cursor-pointer shrink-0"
                  />
                  <label htmlFor="enableBiometricCheckbox" className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer select-none">
                    <Fingerprint className="w-4 h-4 text-slate-600" />
                    <span>Enable Biometric Sign-In next time</span>
                  </label>
                </div>
              )}

              <button
                onClick={handleEmailAuth}
                disabled={loading}
                className="w-full bg-primary text-white p-4.5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-primary-hover transition-all shadow-xl shadow-primary/25 disabled:opacity-50 active:scale-[0.97] hover:-translate-y-0.5"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : isSignup ? "Create Account" : "Sign In"}
              </button>
            </>
          )}

          {isResetPassword && (
            <button
              onClick={handleEmailAuth}
              disabled={loading}
              className="w-full bg-primary text-white p-4 rounded-2xl font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : "Reset Password"}
            </button>
          )}

          <div className="flex justify-between text-xs font-semibold">
            <button onClick={() => { setIsSignup(!isSignup); setIsResetPassword(false); setError(null); setInfoMessage(null); setPassword(""); }} className="text-primary hover:underline">
              {isSignup ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
            </button>
            {!isSignup && (
              <button onClick={() => { setIsResetPassword(!isResetPassword); setIsSignup(false); setError(null); setInfoMessage(null); setPassword(""); }} className="text-slate-500 hover:text-primary">
                {isResetPassword ? "Back to Sign In" : "Forgot Password?"}
              </button>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-black"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-400">Or</span>
            </div>
          </div>

          {window !== window.top && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-2xl flex flex-col items-center gap-3 text-center my-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                <p className="font-bold text-[13px]">Google Login Blocked in Preview</p>
              </div>
              <p className="text-[11px] leading-relaxed">For security reasons, Google does not allow logging in inside embedding panels.</p>
              <a 
                href={window.location.href} 
                target="_blank" 
                rel="noreferrer"
                className="mt-1 text-xs font-bold bg-blue-600 text-white px-5 py-2.5 rounded-xl shadow-md uppercase tracking-wider flex items-center gap-2 active:scale-95 transition-transform"
              >
                Open Full Screen To Login
              </a>
            </div>
          )}

          <button
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
            disabled={loading || guestLoading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-black p-4 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50 active:scale-[0.98]"
          >
            <img 
              src="https://www.google.com/favicon.ico" 
              alt="Google" 
              className="w-5 h-5"
            />
            Continue with Google
          </button>

          <button
            onClick={handleGuestLogin}
            disabled={loading || guestLoading || adminGuestLoading}
            className="w-full flex items-center justify-center gap-3 bg-header text-white p-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 disabled:opacity-50 active:scale-[0.98]"
          >
            {guestLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <UserCircle className="w-5 h-5" />
                Continue as Guest
              </>
            )}
          </button>

          <div className="pt-4 border-t border-black">
            <button
              onClick={handleAdminGuestLogin}
              disabled={loading || guestLoading || adminGuestLoading}
              className="w-full flex items-center justify-center gap-2 text-xs font-bold text-slate-400 hover:text-red-500 transition-colors py-2"
            >
              {adminGuestLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <>
                  <Shield className="w-3 h-3" />
                  Dev Tool: Test Admin Access
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-slate-400">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </motion.div>
      </div>

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
                          setPassword(credentials.pass);
                          setLoading(true);
                          await signInWithEmail(credentials.email, credentials.pass);
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

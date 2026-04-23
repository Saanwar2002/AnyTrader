import React, { useState, useEffect } from "react";
import { signInWithGoogle, signInAsGuest, signUpWithEmail, signInWithEmail, sendVerificationEmail, resetPassword, handleRedirectResult } from "@/src/firebase";
import { motion } from "motion/react";
import { LogIn, Loader2, UserCircle, Shield, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { isTemporaryEmail } from "@/src/lib/utils";
import { Logo } from "./Logo";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [adminGuestLoading, setAdminGuestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Disabled handleRedirectResult on mount to prevent CSP-related auth/internal-error
    // in this environment. Users should sign in using Email/Password.
  }, []);

  const handleEmailAuth = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

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

    if (!isResetPassword && !trimmedPassword) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (isResetPassword) {
        await resetPassword(trimmedEmail);
        setError("Password reset email sent. Please check your inbox.");
        setIsResetPassword(false);
      } else if (isSignup) {
        if (isTemporaryEmail(trimmedEmail)) {
          throw new Error("Temporary email addresses are not allowed. Please use a valid email address.");
        }
        const { user } = await signUpWithEmail(trimmedEmail, trimmedPassword);
        await sendVerificationEmail(user);
        setError("Account created. Please check your email for verification link.");
        setIsSignup(false);
      } else {
        await signInWithEmail(trimmedEmail, trimmedPassword);
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      if (error.code === "auth/invalid-email") {
        setError("The email address is badly formatted.");
      } else if (error.code === "auth/user-not-found") {
        setError("No account found with this email.");
      } else if (error.code === "auth/wrong-password") {
        setError("Incorrect password.");
      } else {
        setError(error.message || "An error occurred. Please try again.");
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
    <div className="min-h-screen flex flex-col bg-brand-blue relative overflow-y-auto pt-8 pb-64 px-4 shadow-inner">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/10 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-48 -right-24 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-50" />
      </div>

      <div className="flex-1 flex items-start sm:items-center justify-center py-12 sm:py-20">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-md w-full bg-white/95 backdrop-blur-xl p-8 sm:p-10 rounded-[40px] border border-white/20 shadow-2xl shadow-black/20 text-center space-y-8 relative z-10 mb-20"
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

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {!isResetPassword && (
            <>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-medium bg-slate-50/50 focus:bg-white"
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
                    className="w-full pl-12 pr-12 py-4.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-medium bg-slate-50/50 focus:bg-white"
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
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
            <button onClick={() => { setIsSignup(!isSignup); setIsResetPassword(false); }} className="text-primary hover:underline">
              {isSignup ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
            </button>
            {!isSignup && (
              <button onClick={() => { setIsResetPassword(!isResetPassword); setIsSignup(false); }} className="text-slate-500 hover:text-primary">
                {isResetPassword ? "Back to Sign In" : "Forgot Password?"}
              </button>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-100"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-400">Or</span>
            </div>
          </div>

          <button
            onClick={async () => {
              setLoading(true);
              setError(null);
              try {
                await signInWithGoogle();
              } catch (error: any) {
                console.error("Google Auth Error:", error);
                if (error.code === 'auth/internal-error') {
                  setError("Firebase internal error. Please ensure this domain is added to 'Authorized Domains' in Firebase console > Authentication > Settings. Also, ensure a Support Email is set for your project.");
                } else if (error.code === 'auth/unauthorized-domain') {
                  setError("This domain is not authorized. Please add it to Firebase Console > Authentication > Settings > Authorized domains.");
                } else if (error.code === 'auth/popup-closed-by-user') {
                  setError("Sign-in popup was closed before completing.");
                } else {
                  setError(error.message || "An error occurred during Google sign in.");
                }
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading || guestLoading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 p-4 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50 active:scale-[0.98]"
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

          <div className="pt-4 border-t border-slate-100">
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
    </div>
  );
}

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShieldAlert, RefreshCw, Lock, LogOut, CheckCircle2, Sparkles, Clock, X, KeyRound, Loader2 } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { auth, signInWithEmailAndPassword, logout } from "@/src/firebase";
import { toast } from "sonner";

export const SessionReauthModal: React.FC = () => {
  const { user, profile, sessionStatus, showReauthModal, setShowReauthModal, ensureFreshToken, signInWithGoogle } = useAuth();
  
  const [password, setPassword] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!showReauthModal || !user) return null;

  const handleRefreshSession = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const success = await ensureFreshToken(true);
      if (success) {
        toast.success("✨ Security session verified & refreshed successfully!");
        setShowReauthModal(false);
      } else {
        setError("Failed to automatically refresh session token. Please re-authenticate with your password or Google.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to refresh session token.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePasswordReauth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || !user.email) return;

    setIsAuthenticating(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, user.email, password.trim());
      await ensureFreshToken(true);
      toast.success("✨ Successfully re-authenticated!");
      setShowReauthModal(false);
      setPassword("");
    } catch (err: any) {
      console.error("[SessionReauth] Password re-auth error:", err);
      if (err?.code === "auth/wrong-password" || err?.code === "auth/invalid-credential") {
        setError("Incorrect password. Please try again.");
      } else {
        setError(err?.message || "Re-authentication failed. Please check your credentials.");
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleGoogleReauth = async () => {
    setIsAuthenticating(true);
    setError(null);
    try {
      await signInWithGoogle();
      await ensureFreshToken(true);
      toast.success("✨ Google re-authentication successful!");
      setShowReauthModal(false);
    } catch (err: any) {
      console.error("[SessionReauth] Google re-auth error:", err);
      setError(err?.message || "Google re-authentication failed.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    try {
      setShowReauthModal(false);
      await logout();
      toast.info("Logged out successfully.");
    } catch (err: any) {
      console.error("Logout error:", err);
    }
  };

  const isInvalidOrExpired = sessionStatus === "expired" || sessionStatus === "invalid";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-3xl border border-black shadow-2xl max-w-md w-full overflow-hidden"
        >
          {/* Header Banner */}
          <div className="bg-slate-900 text-white p-6 relative">
            <button
              type="button"
              onClick={() => setShowReauthModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title="Dismiss for now"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 mb-1">
                  <Clock className="w-3 h-3" />
                  Session Heartbeat
                </div>
                <h3 className="text-lg font-extrabold text-white">
                  {isInvalidOrExpired ? "Security Session Expired" : "Session Refresh Required"}
                </h3>
              </div>
            </div>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              For your account protection, AnyTrader requires a quick session token validation before attempting critical operations.
            </p>
          </div>

          {/* User Badge */}
          <div className="p-6 space-y-5">
            <div className="bg-slate-50 border border-black rounded-2xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-sm shrink-0 border border-black">
                  {(profile?.name || user.displayName || user.email || "U").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h4 className="font-extrabold text-sm text-black truncate">
                    {profile?.name || user.displayName || "Active User"}
                  </h4>
                  <p className="text-xs font-medium text-slate-600 truncate">{user.email}</p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                  isInvalidOrExpired 
                    ? "bg-red-50 text-red-700 border-red-200" 
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isInvalidOrExpired ? "bg-red-500" : "bg-amber-500"} animate-ping`} />
                  {sessionStatus === "expiring_soon" ? "Expiring Soon" : "Expired"}
                </span>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-800 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Quick 1-Click Refresh */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleRefreshSession}
                disabled={isRefreshing || isAuthenticating}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 border border-black cursor-pointer disabled:opacity-50"
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Validating Session Token...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>1-Click Refresh Session</span>
                  </>
                )}
              </button>

              <div className="relative flex items-center justify-center my-2">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider absolute">
                  or re-authenticate
                </span>
              </div>

              {/* Password Re-auth Form */}
              {user.email && (
                <form onSubmit={handlePasswordReauth} className="space-y-3">
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter account password"
                      className="w-full pl-10 pr-4 py-2.5 text-xs text-black font-medium border border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!password.trim() || isAuthenticating || isRefreshing}
                    className="w-full py-2.5 px-4 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 border border-black disabled:opacity-40 cursor-pointer"
                  >
                    {isAuthenticating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                    <span>Confirm Password</span>
                  </button>
                </form>
              )}

              {/* Google Re-auth */}
              <button
                type="button"
                onClick={handleGoogleReauth}
                disabled={isAuthenticating || isRefreshing}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold border border-black transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Verify with Google</span>
              </button>
            </div>

            {/* Footer actions */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleLogout}
                className="text-slate-500 hover:text-red-600 font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>

              <button
                type="button"
                onClick={() => setShowReauthModal(false)}
                className="text-slate-500 hover:text-slate-900 font-bold transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

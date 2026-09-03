import React, { useState, useRef, useEffect } from "react";
import { Video, Camera, StopCircle, Upload, CheckCircle2, ShieldCheck, Play, Loader2, Trash2, Sparkles, AlertCircle, Award, Zap, Check, RotateCcw, SwitchCamera } from "lucide-react";
import { db, doc, updateDoc, storage, ref, uploadBytes, getDownloadURL, uploadStorageFile, onSnapshot } from "@/src/firebase";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import { calculateVerifiedVideoProSubscription } from "@/src/services/stripeIntegrationService";

interface TraderVideoVerificationCardProps {
  profile: any;
  onUpdateProfile?: (updatedFields: Partial<any>) => void;
  isReadOnly?: boolean;
}

export function TraderVideoVerificationCard({ profile, onUpdateProfile, isReadOnly = false }: TraderVideoVerificationCardProps) {
  const [platformConfig, setPlatformConfig] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [mediaBlobUrl, setMediaBlobUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "platform_config", "global"), (snap) => {
      if (snap.exists()) {
        setPlatformConfig(snap.data());
      }
    });
    return () => unsub();
  }, []);

  const videoAddonConfig = platformConfig?.paidAddons?.verifiedVideoPro;
  const plan = calculateVerifiedVideoProSubscription("monthly", videoAddonConfig);
  const isVideoProSubscriber = Boolean(profile?.hasVerifiedVideoProSubscription);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<any>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Clean up media streams and timers on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Ensure camera stream is attached as soon as the video preview element is mounted
  useEffect(() => {
    if (isCameraActive && liveStreamRef.current && videoPreviewRef.current) {
      if (videoPreviewRef.current.srcObject !== liveStreamRef.current) {
        videoPreviewRef.current.srcObject = liveStreamRef.current;
        videoPreviewRef.current.play().catch(e => console.warn("Video preview play error:", e));
      }
    }
  }, [isCameraActive]);

  const handleSubscribeVideoPro = async () => {
    if (!profile?.uid) {
      toast.error("Please log in to manage your subscription");
      return;
    }

    setIsSubscribing(true);
    try {
      const newStatus = !isVideoProSubscriber;
      const updates: any = {
        hasVerifiedVideoProSubscription: newStatus,
        videoProSubscribedAt: newStatus ? new Date().toISOString() : null,
        videoVerificationStatus: newStatus ? "verified" : (profile?.videoVerificationUrl ? "verified" : "none")
      };

      await updateDoc(doc(db, "users", profile.uid), updates);
      if (onUpdateProfile) onUpdateProfile(updates);

      if (newStatus) {
        toast.success(`⚡ Verified Video Pro Active! Granted +${plan.matchScoreBonus} AI Match Score points and Priority Quote Placement (£${plan.monthlyPrice}/mo).`);
      } else {
        toast.info("Verified Video Pro subscription paused.");
      }
    } catch (err) {
      console.error("Subscription update error:", err);
      toast.error("Failed to update subscription. Please try again.");
    } finally {
      setIsSubscribing(false);
    }
  };

  const startCamera = async (targetFacingMode: "user" | "environment" = facingMode) => {
    setCameraError(null);
    try {
      // Stop any existing stream
      if (liveStreamRef.current) {
        liveStreamRef.current.getTracks().forEach(t => t.stop());
        liveStreamRef.current = null;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: true
        });
      } catch (errConstraint) {
        console.warn("Target facingMode constraint failed, falling back to basic video:", errConstraint);
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      }

      liveStreamRef.current = stream;
      setIsCameraActive(true);

      // Immediately attempt to bind if DOM node already available
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(e => console.warn("Video play error:", e));
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError(err.message || "Camera access was denied or is not supported.");
      toast.error("Unable to access camera. Please allow camera permissions or upload a pre-recorded video file.");
    }
  };

  const toggleCameraFacing = async () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextMode);
    await startCamera(nextMode);
  };

  const stopCamera = () => {
    if (liveStreamRef.current) {
      liveStreamRef.current.getTracks().forEach(track => track.stop());
      liveStreamRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const startRecording = () => {
    if (!liveStreamRef.current) {
      toast.error("Camera stream is not active. Please start camera first.");
      return;
    }

    const chunks: Blob[] = [];
    let selectedMimeType = "";

    if (typeof MediaRecorder !== "undefined") {
      const candidateTypes = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "video/mp4;codecs=avc1,mp4a.40.2",
        "video/mp4"
      ];
      for (const t of candidateTypes) {
        if (MediaRecorder.isTypeSupported(t)) {
          selectedMimeType = t;
          break;
        }
      }
    }

    try {
      const options: MediaRecorderOptions = selectedMimeType ? { mimeType: selectedMimeType } : {};
      const mediaRecorder = new MediaRecorder(liveStreamRef.current, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalType = selectedMimeType || "video/mp4";
        const blob = new Blob(chunks, { type: finalType });
        setRecordedBlob(blob);
        setMediaBlobUrl(URL.createObjectURL(blob));
        stopCamera();
      };

      mediaRecorder.start(1000); // 1-second chunks for data safety
      setIsRecording(true);
      setRecordingSeconds(0);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => {
          if (prev >= 30) {
            stopRecording();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error("MediaRecorder creation error:", err);
      toast.error("Failed to start video recorder. Please try uploading a file instead.");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Please upload a valid video file (.mp4, .mov, .webm)");
      return;
    }

    setRecordedBlob(file);
    setMediaBlobUrl(URL.createObjectURL(file));
  };

  const handleSaveVideoVerification = async () => {
    if (!recordedBlob || !profile?.uid) return;

    setIsUploading(true);
    try {
      const fileName = `users/${profile.uid}/video_verification_${Date.now()}.mp4`;
      const downloadUrl = await uploadStorageFile(recordedBlob, fileName, { contentType: "video/mp4" });

      const updates = {
        videoVerificationUrl: downloadUrl,
        videoVerificationStatus: "verified",
        videoVerificationTimestamp: new Date().toISOString()
      };

      await updateDoc(doc(db, "users", profile.uid), updates);
      if (onUpdateProfile) onUpdateProfile(updates);

      toast.success("🎥 Video Credential Verification published! You earned +35 AI Match Points.");
      setMediaBlobUrl(null);
      setRecordedBlob(null);
    } catch (err) {
      console.error("Failed to upload video credential:", err);
      toast.error("Upload failed. Please check your network and try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveVideo = async () => {
    if (!profile?.uid) return;
    if (!window.confirm("Are you sure you want to remove your Video Credential Verification?")) return;

    try {
      const updates = {
        videoVerificationUrl: null,
        videoVerificationStatus: isVideoProSubscriber ? "verified" : "none"
      };
      await updateDoc(doc(db, "users", profile.uid), updates);
      if (onUpdateProfile) onUpdateProfile(updates);
      toast.success("Video Credential removed.");
    } catch (err) {
      console.error("Error removing video verification:", err);
    }
  };

  const hasVerifiedVideo = Boolean(profile?.videoVerificationUrl);

  return (
    <div className="bg-white rounded-[2rem] border border-black shadow-md p-5 mb-6 overflow-hidden relative">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
            <Video className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 leading-tight flex items-center gap-2">
              Video Credential Verification
              {hasVerifiedVideo && (
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Verified
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              15–30 sec video selfie intro & credential showcase to build 100% homeowner trust.
            </p>
          </div>
        </div>

        {!isReadOnly && hasVerifiedVideo && (
          <button
            onClick={handleRemoveVideo}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
            title="Remove Video Verification"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Existing Verified Video Showcase */}
      {hasVerifiedVideo && !mediaBlobUrl && (
        <div className="space-y-3">
          <div className="relative rounded-2xl overflow-hidden border border-black bg-slate-900 max-h-64 flex items-center justify-center">
            <video
              src={profile.videoVerificationUrl}
              controls
              playsInline
              className="w-full max-h-64 object-contain"
            />
          </div>

          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl flex items-center gap-3 text-emerald-900 text-xs font-semibold">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>
              <strong>Verified Trader Video Intro Active.</strong> Homeowners can watch your 30s video intro on your public profile & quote cards.
            </span>
          </div>
        </div>
      )}

      {/* Recording / Preview Mode for Trader */}
      {!isReadOnly && (!hasVerifiedVideo || mediaBlobUrl || isCameraActive) && (
        <div className="space-y-4 pt-2 border-t border-slate-100">
          {/* Live Camera Stream View */}
          {isCameraActive && (
            <div className="relative rounded-2xl overflow-hidden bg-black border border-black aspect-video flex items-center justify-center shadow-inner">
              <video
                ref={(el) => {
                  videoPreviewRef.current = el;
                  if (el && liveStreamRef.current && el.srcObject !== liveStreamRef.current) {
                    el.srcObject = liveStreamRef.current;
                    el.play().catch(e => console.warn("Video element play error:", e));
                  }
                }}
                autoPlay
                playsInline
                muted
                className={cn(
                  "w-full h-full object-cover",
                  facingMode === "user" && "scale-x-[-1]" // mirror selfie view for natural user experience
                )}
              />

              {/* Camera Header Overlay */}
              <div className="absolute top-3 inset-x-3 flex items-center justify-between z-10 pointer-events-none">
                {isRecording ? (
                  <div className="bg-red-600 text-white font-black text-xs px-3 py-1 rounded-full flex items-center gap-2 animate-pulse shadow-lg pointer-events-auto">
                    <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                    REC ({recordingSeconds}s / 30s)
                  </div>
                ) : (
                  <div className="bg-black/60 backdrop-blur-md text-white font-bold text-[11px] px-3 py-1 rounded-full flex items-center gap-1.5 border border-white/20 pointer-events-auto">
                    <Camera className="w-3.5 h-3.5 text-amber-300" />
                    <span>{facingMode === "user" ? "Selfie Front Camera" : "Rear Camera"}</span>
                  </div>
                )}

                {/* Flip camera button */}
                {!isRecording && (
                  <button
                    type="button"
                    onClick={toggleCameraFacing}
                    className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-md border border-white/20 shadow-md transition active:scale-90 pointer-events-auto"
                    title="Switch Camera (Front/Back)"
                  >
                    <SwitchCamera className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Bottom Control Bar */}
              <div className="absolute bottom-3 inset-x-3 flex justify-center gap-2.5 z-10">
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95 border border-red-500"
                  >
                    <div className="w-3 h-3 rounded-full bg-white" />
                    Start 30s Recording
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95 border border-white/20"
                  >
                    <StopCircle className="w-4 h-4 text-red-400" />
                    Stop Recording ({30 - recordingSeconds}s remaining)
                  </button>
                )}

                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-2.5 bg-white/90 hover:bg-white text-slate-800 font-bold text-xs rounded-xl shadow-md transition-all border border-black/10 active:scale-95"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Video Preview after recording or file selection */}
          {mediaBlobUrl && !isCameraActive && (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden bg-black border border-black max-h-64 flex items-center justify-center">
                <video src={mediaBlobUrl} controls playsInline className="w-full max-h-64 object-contain" />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSaveVideoVerification}
                  disabled={isUploading}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Publish Video Verification
                </button>
                <button
                  onClick={() => { setMediaBlobUrl(null); setRecordedBlob(null); }}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs border border-black transition-all flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retake
                </button>
              </div>
            </div>
          )}

          {/* Verified Video Pro (£15/mo) Subscription Card */}
          {!isReadOnly && (
            <div className="mt-4 p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl border border-black shadow-md space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shrink-0">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-white text-xs">Verified Video Pro Badge Subscription</h4>
                      <span className="bg-amber-400 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded border border-black">
                        £15.00 / month
                      </span>
                    </div>
                    <p className="text-[10px] text-indigo-200">Unlock priority quote placement, +35 AI match points, and gold trust badges.</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSubscribeVideoPro}
                  disabled={isSubscribing}
                  className={cn(
                    "px-4 py-2.5 rounded-xl font-extrabold text-xs border border-black shadow-sm flex items-center justify-center gap-2 transition active:scale-98 shrink-0",
                    isVideoProSubscriber
                      ? "bg-amber-400 hover:bg-amber-500 text-slate-950"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white"
                  )}
                >
                  {isSubscribing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isVideoProSubscriber ? (
                    <>
                      <Check className="w-4 h-4 text-slate-950" />
                      <span>Subscribed (£15/mo)</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-amber-300" />
                      <span>Upgrade for £15/mo</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-1">
                <div className="p-2 bg-white/10 rounded-xl border border-white/10">
                  <p className="text-[9px] font-extrabold uppercase text-indigo-300">Matching Bonus</p>
                  <p className="font-extrabold text-amber-300 text-xs mt-0.5">+35 Signal Points</p>
                </div>
                <div className="p-2 bg-white/10 rounded-xl border border-white/10">
                  <p className="text-[9px] font-extrabold uppercase text-indigo-300">Quote Positioning</p>
                  <p className="font-extrabold text-emerald-300 text-xs mt-0.5">Priority Top Slot</p>
                </div>
                <div className="p-2 bg-white/10 rounded-xl border border-white/10">
                  <p className="text-[9px] font-extrabold uppercase text-indigo-300">Profile Trust Badge</p>
                  <p className="font-extrabold text-white text-xs mt-0.5">Verified Video Pro</p>
                </div>
              </div>
            </div>
          )}

          {/* Action trigger buttons if camera is not active and no preview */}
          {!isCameraActive && !mediaBlobUrl && !hasVerifiedVideo && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => startCamera("user")}
                className="p-4 rounded-2xl border border-black bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-sm active:scale-98"
              >
                <Camera className="w-4 h-4 text-indigo-400" />
                Record Live Video Selfie
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-4 rounded-2xl border border-black bg-slate-50 text-slate-800 font-bold text-xs hover:bg-slate-100 transition-all flex items-center justify-center gap-2 shadow-sm active:scale-98"
              >
                <Upload className="w-4 h-4 text-slate-600" />
                Upload Pre-Recorded Video
              </button>

              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="video/*"
                onChange={handleFileUpload}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}


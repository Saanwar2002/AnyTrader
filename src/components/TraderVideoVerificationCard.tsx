import React, { useState, useRef } from "react";
import { Video, Camera, StopCircle, Upload, CheckCircle2, ShieldCheck, Play, Loader2, Trash2, Sparkles, AlertCircle } from "lucide-react";
import { db, doc, updateDoc, storage, ref, uploadBytes, getDownloadURL } from "@/src/firebase";
import { toast } from "sonner";
import { motion } from "motion/react";
import { cn } from "@/src/lib/utils";

interface TraderVideoVerificationCardProps {
  profile: any;
  onUpdateProfile?: (updatedFields: Partial<any>) => void;
  isReadOnly?: boolean;
}

export function TraderVideoVerificationCard({ profile, onUpdateProfile, isReadOnly = false }: TraderVideoVerificationCardProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [mediaBlobUrl, setMediaBlobUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<any>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      liveStreamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error("Camera access error:", err);
      toast.error("Unable to access camera/microphone. You can upload a pre-recorded video file instead.");
    }
  };

  const stopCamera = () => {
    if (liveStreamRef.current) {
      liveStreamRef.current.getTracks().forEach(track => track.stop());
      liveStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startRecording = () => {
    if (!liveStreamRef.current) return;
    const chunks: Blob[] = [];
    const mediaRecorder = new MediaRecorder(liveStreamRef.current, { mimeType: "video/webm" });
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/mp4" });
      setRecordedBlob(blob);
      setMediaBlobUrl(URL.createObjectURL(blob));
      stopCamera();
    };

    mediaRecorder.start();
    setIsRecording(true);
    setRecordingSeconds(0);

    timerRef.current = setInterval(() => {
      setRecordingSeconds(prev => {
        if (prev >= 30) {
          stopRecording();
          return 30;
        }
        return prev + 1;
      });
    }, 1000);
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
      const storageRef = ref(storage, fileName);
      const snapshot = await uploadBytes(storageRef, recordedBlob, { contentType: "video/mp4" });
      const downloadUrl = await getDownloadURL(snapshot.ref);

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
        videoVerificationStatus: "none"
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
            <div className="relative rounded-2xl overflow-hidden bg-black border border-black aspect-video flex items-center justify-center">
              <video ref={videoPreviewRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              
              {isRecording && (
                <div className="absolute top-3 left-3 bg-red-600 text-white font-bold text-xs px-3 py-1 rounded-full flex items-center gap-2 animate-pulse shadow-lg">
                  <div className="w-2.5 h-2.5 rounded-full bg-white" />
                  REC ({recordingSeconds}s / 30s)
                </div>
              )}

              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95"
                  >
                    <Camera className="w-4 h-4" />
                    Start 30s Recording
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95"
                  >
                    <StopCircle className="w-4 h-4 text-red-400" />
                    Stop Recording
                  </button>
                )}

                <button
                  onClick={stopCamera}
                  className="px-4 py-2.5 bg-white/80 hover:bg-white text-slate-800 font-bold text-xs rounded-xl shadow-md transition-all"
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
                <video src={mediaBlobUrl} controls className="w-full max-h-64 object-contain" />
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
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs border border-black transition-all"
                >
                  Retake
                </button>
              </div>
            </div>
          )}

          {/* Action trigger buttons if camera is not active and no preview */}
          {!isCameraActive && !mediaBlobUrl && !hasVerifiedVideo && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={startCamera}
                className="p-4 rounded-2xl border border-black bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-sm active:scale-98"
              >
                <Camera className="w-4 h-4 text-indigo-400" />
                Record Live Video Selfie
              </button>

              <button
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

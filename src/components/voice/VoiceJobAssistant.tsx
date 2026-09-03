import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Mic, MicOff, StopCircle, Sparkles, RefreshCw, CheckCircle2, 
  AlertCircle, Volume2, ArrowRight, Clock, Wrench, ShieldCheck, 
  Zap, X, FileText, Edit3, Loader2, Play, Pause, ChevronRight
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { toast } from "sonner";
import { processVoiceTranscript, transcribeVoiceAudio, processVoiceAudio } from "@/src/services/gemini";
import { Capacitor } from "@capacitor/core";
import { SpeechRecognition as CapSpeechRecognition } from "@capacitor-community/speech-recognition";

interface ExtractedVoiceJob {
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  urgency: "emergency" | "asap" | "flexible" | "specific_date";
  quoteScope?: "supply_and_fit" | "labour_only" | "materials_only";
  city?: string;
  estimatedCompletionTime?: string;
  estimatedCompletionTimeUnit?: "hours" | "days" | "weeks";
  keyHighlights?: string[];
  audioBlob?: Blob;
  audioUrl?: string;
}

interface VoiceJobAssistantProps {
  categories: any[];
  onApplyVoiceJob: (data: ExtractedVoiceJob) => void;
  targetTradespersonName?: string;
  className?: string;
}

const VOICE_SAMPLE_PROMPTS = [
  {
    icon: "🔥",
    label: "Boiler breakdown",
    text: "My Worcester Bosch combi boiler is flashing error code EA, lost all pressure, and there is no hot water or heating. Need a Gas Safe engineer ASAP in Manchester."
  },
  {
    icon: "⚡",
    label: "Fuse box tripping",
    text: "The RCD trip switch in our consumer unit keeps tripping whenever the kitchen oven is switched on. Need a certified electrician to inspect the circuit."
  },
  {
    icon: "🚿",
    label: "Leaking pipe",
    text: "There is an active water leak coming from the radiator valve in the upstairs bathroom leaking onto floorboards. Need an emergency plumber today."
  },
  {
    icon: "🛣️",
    label: "Tarmac driveway",
    text: "Looking to resurface our front driveway, approximately 45 square metres with new black tarmac, edging stones, and soakaway drainage next month."
  },
  {
    icon: "🧱",
    label: "Ready-mix concrete",
    text: "Need 6 cubic metres of ready-mix C25 concrete with ground line pump delivery for rear house extension foundation footings on Tuesday."
  }
];

export default function VoiceJobAssistant({
  categories,
  onApplyVoiceJob,
  targetTradespersonName,
  className
}: VoiceJobAssistantProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedJob, setExtractedJob] = useState<ExtractedVoiceJob | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [appendText, setAppendText] = useState("");
  const [newHighlightText, setNewHighlightText] = useState("");
  const [showAdvancedEdit, setShowAdvancedEdit] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const recordingTimerRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const recordedAudioUrlRef = useRef<string | null>(null);
  const recordedBlobRef = useRef<Blob | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecordingSession();
      if (Capacitor.isNativePlatform()) {
        try {
          CapSpeechRecognition.stop();
        } catch (e) {}
        if ((window as any)._voiceJobSpeechListener) {
          (window as any)._voiceJobSpeechListener.remove().catch(() => {});
          (window as any)._voiceJobSpeechListener = null;
        }
        if ((window as any)._voiceJobStateListener) {
          (window as any)._voiceJobStateListener.remove().catch(() => {});
          (window as any)._voiceJobStateListener = null;
        }
      }
      if (recordedAudioUrlRef.current) {
        URL.revokeObjectURL(recordedAudioUrlRef.current);
      }
    };
  }, []);

  const stopRecordingSession = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (Capacitor.isNativePlatform()) {
      try {
        CapSpeechRecognition.stop();
      } catch (e) {}
      if ((window as any)._voiceJobSpeechListener) {
        (window as any)._voiceJobSpeechListener.remove().catch(() => {});
        (window as any)._voiceJobSpeechListener = null;
      }
      if ((window as any)._voiceJobStateListener) {
        (window as any)._voiceJobStateListener.remove().catch(() => {});
        (window as any)._voiceJobStateListener = null;
      }
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.onend = null;
        speechRecognitionRef.current.stop();
      } catch (e) {}
      speechRecognitionRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    setIsRecording(false);
    setAudioLevel(0);
  };

  const startVoiceRecording = async () => {
    setVoiceError(null);
    setExtractedJob(null);
    setTranscript("");
    setInterimTranscript("");
    setRecordingDuration(0);
    audioChunksRef.current = [];

    // Native Capacitor App flow
    if (Capacitor.isNativePlatform()) {
      try {
        const { available } = await CapSpeechRecognition.available();
        if (!available) throw new Error("Native speech recognition unavailable");

        const perm = await CapSpeechRecognition.checkPermissions();
        if (perm.speechRecognition !== 'granted') {
          const req = await CapSpeechRecognition.requestPermissions();
          if (req.speechRecognition !== 'granted') {
            setVoiceError("Microphone permission denied. Please allow microphone access in device settings.");
            return;
          }
        }

        // Clean up previous listeners if any
        if ((window as any)._voiceJobSpeechListener) {
          try {
            await (window as any)._voiceJobSpeechListener.remove();
          } catch (_) {}
        }
        if ((window as any)._voiceJobStateListener) {
          try {
            await (window as any)._voiceJobStateListener.remove();
          } catch (_) {}
        }

        setIsRecording(true);
        recordingTimerRef.current = setInterval(() => {
          setRecordingDuration(prev => {
            if (prev >= 60) {
              stopVoiceRecording();
              return 60;
            }
            return prev + 1;
          });
        }, 1000);

        const listener = await CapSpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
          if (data.matches && data.matches.length > 0) {
            setTranscript(data.matches[0]);
          }
        });
        (window as any)._voiceJobSpeechListener = listener;

        const stateListener = await CapSpeechRecognition.addListener('listeningState', (data: { status: 'started' | 'stopped' }) => {
          if (data.status === 'stopped') {
            stopVoiceRecording();
          }
        });
        (window as any)._voiceJobStateListener = stateListener;

        await CapSpeechRecognition.start({
          language: 'en-GB',
          maxResults: 1,
          partialResults: true,
          popup: false
        });
        return;
      } catch (err: any) {
        console.warn("Capacitor speech recognition error, falling back to Web audio:", err);
      }
    }

    // Web / PWA flow with Real-Time Web Speech API + Audio Stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      audioStreamRef.current = stream;

      // Setup Web Audio Analyser for live visualizer
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateLevel = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const normalized = Math.min(100, Math.round((avg / 128) * 100));
            setAudioLevel(normalized);
            animationFrameRef.current = requestAnimationFrame(updateLevel);
          };
          updateLevel();
        }
      } catch (e) {
        console.warn("AudioContext visualizer error:", e);
      }

      // Initialize MediaRecorder for fallback transcription & voice memo playback
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = '';
        }
      }

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
          recordedBlobRef.current = blob;
          if (recordedAudioUrlRef.current) {
            URL.revokeObjectURL(recordedAudioUrlRef.current);
          }
          recordedAudioUrlRef.current = URL.createObjectURL(blob);
        }
      };

      mediaRecorder.start(200);
      setIsRecording(true);

      // Start recording timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          if (prev >= 60) {
            stopVoiceRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);

      // Setup Web Speech API for real-time live typing
      const SpeechRecognitionConstructor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionConstructor) {
        try {
          const recognition = new SpeechRecognitionConstructor();
          speechRecognitionRef.current = recognition;
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-GB';

          recognition.onresult = (event: any) => {
            let finalStr = "";
            let interimStr = "";
            for (let i = 0; i < event.results.length; i++) {
              const res = event.results[i];
              if (res.isFinal) {
                finalStr += res[0].transcript + " ";
              } else {
                interimStr += res[0].transcript;
              }
            }
            if (finalStr) setTranscript(finalStr.trim());
            setInterimTranscript(interimStr);
          };

          recognition.onerror = (err: any) => {
            console.warn("Web Speech API notice:", err?.error);
          };

          recognition.start();
        } catch (e) {
          console.warn("Could not start Web Speech Recognition:", e);
        }
      }

    } catch (err: any) {
      console.error("Microphone access failed:", err);
      stopRecordingSession();
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setVoiceError("Microphone permission was denied. Please allow microphone access in your browser or phone settings to speak your job.");
      } else {
        setVoiceError("Could not access microphone. You can type details or upload an audio file below.");
      }
    }
  };

  const stopVoiceRecording = async () => {
    if (!isRecording) return;
    
    // Grab current transcript before shutting down
    const capturedTranscript = transcript.trim() || interimTranscript.trim();
    stopRecordingSession();

    // Give MediaRecorder a small tick to finalize the blob
    setTimeout(async () => {
      if (capturedTranscript) {
        await processTranscriptWithAI(capturedTranscript);
      } else if (recordedBlobRef.current) {
        // Fallback: Transcribe audio blob via Gemini
        await processAudioBlobWithAI(recordedBlobRef.current);
      } else {
        setVoiceError("No speech was detected. Please try speaking again or click one of the examples below.");
      }
    }, 300);
  };

  const processTranscriptWithAI = async (text: string) => {
    if (!text.trim()) return;
    setIsProcessing(true);
    setVoiceError(null);

    try {
      const categoryNames = categories.map(c => c.name);
      const result = await processVoiceTranscript(text, categoryNames);

      // Match subcategory against the category's actual subcategories if possible
      let matchedSub = result.subcategory || "";
      const catObj = categories.find(c => c.name.toLowerCase() === (result.category || "").toLowerCase());
      if (catObj && catObj.subcategories?.length > 0) {
        if (!matchedSub || !catObj.subcategories.includes(matchedSub)) {
          const lowerSub = (matchedSub || "").toLowerCase();
          const found = catObj.subcategories.find((s: string) => s.toLowerCase().includes(lowerSub) || lowerSub.includes(s.toLowerCase()));
          if (found) matchedSub = found;
          else matchedSub = catObj.subcategories[0];
        }
      }

      setExtractedJob({
        title: result.title || "Home Repair & Trade Service",
        description: result.description || text,
        category: result.category || (categories[0]?.name || "General Building"),
        subcategory: matchedSub,
        urgency: result.urgency || "flexible",
        quoteScope: result.quoteScope || "supply_and_fit",
        city: result.city || undefined,
        estimatedCompletionTime: result.estimatedCompletionTime || "1-2",
        estimatedCompletionTimeUnit: result.estimatedCompletionTimeUnit || "hours",
        keyHighlights: result.keyHighlights || [],
        audioBlob: recordedBlobRef.current || undefined,
        audioUrl: recordedAudioUrlRef.current || undefined
      });
    } catch (err: any) {
      console.error("Voice parsing error:", err);
      toast.error("Could not structure job automatically. You can review and edit below.");
      setExtractedJob({
        title: "Trade Service Request",
        description: text,
        category: categories[0]?.name || "General Building",
        urgency: "flexible",
        audioBlob: recordedBlobRef.current || undefined,
        audioUrl: recordedAudioUrlRef.current || undefined
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const processAudioBlobWithAI = async (blob: Blob) => {
    setIsProcessing(true);
    setVoiceError(null);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64data = reader.result?.toString().split(',')[1];
          if (base64data) resolve(base64data);
          else reject(new Error("Failed to encode audio"));
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const base64Audio = await base64Promise;

      const categoryNames = categories.map(c => c.name);
      const result = await processVoiceAudio(base64Audio, blob.type || 'audio/webm', categoryNames);
      
      setTranscript(result.description || result.title || "Voice recording processed");
      setExtractedJob({
        title: result.title || "Home Repair & Trade Service",
        description: result.description || "Voice recording dictated by homeowner",
        category: result.category || categories[0]?.name,
        subcategory: result.subcategory,
        urgency: result.urgency || "flexible",
        quoteScope: result.quoteScope || "supply_and_fit",
        city: result.city || undefined,
        estimatedCompletionTime: result.estimatedCompletionTime || "1-2",
        estimatedCompletionTimeUnit: result.estimatedCompletionTimeUnit || "hours",
        keyHighlights: result.keyHighlights || [],
        audioBlob: blob,
        audioUrl: recordedAudioUrlRef.current || undefined
      });
    } catch (err) {
      console.error("Audio transcription failed:", err);
      setVoiceError("Could not transcribe the audio recording. Please try speaking clearly or enter text manually.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSamplePromptClick = async (sampleText: string) => {
    setTranscript(sampleText);
    setInterimTranscript("");
    await processTranscriptWithAI(sampleText);
  };

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    recordedBlobRef.current = file;
    if (recordedAudioUrlRef.current) URL.revokeObjectURL(recordedAudioUrlRef.current);
    recordedAudioUrlRef.current = URL.createObjectURL(file);
    await processAudioBlobWithAI(file);
  };

  const handleAppendNote = (noteText?: string) => {
    const textToAdd = (noteText || appendText).trim();
    if (!textToAdd || !extractedJob) return;

    const formattedNote = textToAdd.startsWith("Note:") || textToAdd.startsWith("Access:") || textToAdd.startsWith("Additional:")
      ? textToAdd
      : `Additional Note: ${textToAdd}`;

    const updatedDescription = extractedJob.description.trim()
      ? `${extractedJob.description.trim()}\n\n• ${formattedNote}`
      : formattedNote;

    setExtractedJob({
      ...extractedJob,
      description: updatedDescription
    });
    setAppendText("");
    toast.success("Appended note to job description!");
  };

  const handleRemoveHighlight = (indexToRemove: number) => {
    if (!extractedJob || !extractedJob.keyHighlights) return;
    setExtractedJob({
      ...extractedJob,
      keyHighlights: extractedJob.keyHighlights.filter((_, i) => i !== indexToRemove)
    });
  };

  const handleAddHighlight = () => {
    if (!newHighlightText.trim() || !extractedJob) return;
    const currentHighlights = extractedJob.keyHighlights || [];
    if (!currentHighlights.includes(newHighlightText.trim())) {
      setExtractedJob({
        ...extractedJob,
        keyHighlights: [...currentHighlights, newHighlightText.trim()]
      });
    }
    setNewHighlightText("");
  };

  const selectedCategoryObj = categories.find(
    c => c.name.toLowerCase() === (extractedJob?.category || "").toLowerCase()
  );
  const availableSubcategories: string[] = selectedCategoryObj?.subcategories || [];

  const handleToggleAudioPlayback = () => {
    if (!audioPlayerRef.current && recordedAudioUrlRef.current) {
      const audio = new Audio(recordedAudioUrlRef.current);
      audioPlayerRef.current = audio;
      audio.onended = () => setIsPlayingAudio(false);
    }

    if (audioPlayerRef.current) {
      if (isPlayingAudio) {
        audioPlayerRef.current.pause();
        setIsPlayingAudio(false);
      } else {
        audioPlayerRef.current.play().then(() => setIsPlayingAudio(true)).catch(() => {});
      }
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn("w-full max-w-full min-w-0 bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-black shadow-sm space-y-4 box-border overflow-hidden", className)}>
      {/* Error Banner */}
      {voiceError && (
        <div className="p-3.5 sm:p-4 bg-amber-50 rounded-2xl border border-black text-black text-xs font-semibold leading-relaxed space-y-2 relative">
          <button 
            type="button"
            onClick={() => setVoiceError(null)}
            className="absolute top-2 right-2 text-slate-500 hover:text-black p-1 cursor-pointer"
            title="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="pr-6">
            <p className="font-black text-red-700 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> Microphone Notice
            </p>
            <p className="mt-1 text-slate-700 leading-normal">
              {voiceError}
            </p>
          </div>
        </div>
      )}

      {/* Main Interactive Mic State */}
      {!extractedJob && !isProcessing && (
        <div className="space-y-3.5 min-w-0">
          {!isRecording ? (
            <div className="space-y-3 min-w-0">
              {/* Primary Interactive Speak Button */}
              <button
                type="button"
                onClick={startVoiceRecording}
                className="w-full p-3.5 sm:p-5 rounded-2xl border-2 border-black bg-gradient-to-r from-blue-50 via-indigo-50/50 to-blue-50 text-slate-900 font-black hover:bg-blue-100/70 active:scale-[0.99] transition-all flex items-center gap-3 sm:gap-3.5 cursor-pointer shadow-sm group min-w-0"
              >
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform shrink-0">
                  <Mic className="w-5 h-5" />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <span className="text-sm sm:text-lg font-black text-slate-900 leading-tight">
                      Tap to speak with microphone
                    </span>
                    <span className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[9px] sm:text-[9.5px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-2xs">
                      AI Powered
                    </span>
                  </div>
                  <span className="block text-[11px] sm:text-xs font-semibold text-slate-500 mt-0.5 leading-snug">
                    Describe fault, boiler model, location, or required work
                  </span>
                </div>
              </button>

              {/* Inspiration Chips */}
              <div className="pt-1 space-y-2 min-w-0">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Or tap an example to test AI:</span>
                </p>
                <div className="flex flex-wrap gap-1.5 min-w-0">
                  {VOICE_SAMPLE_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSamplePromptClick(prompt.text)}
                      className="text-left bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-black rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer max-w-full shrink-0"
                    >
                      <span className="shrink-0">{prompt.icon}</span>
                      <span className="truncate">{prompt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Hidden file input for phone voice memo bypass */}
              <input 
                type="file" 
                ref={fileInputRef} 
                accept="audio/*" 
                className="hidden" 
                onChange={handleAudioFileUpload} 
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-1.5 text-center text-xs font-bold text-slate-500 hover:text-slate-800 underline decoration-slate-300 hover:decoration-black transition-colors cursor-pointer"
              >
                Or upload an audio note file / phone memo
              </button>
            </div>
          ) : (
            /* Active Live Recording State */
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-white rounded-2xl p-4 sm:p-6 border border-black space-y-4 shadow-lg min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-ping inline-block" />
                  <span className="text-xs font-black text-red-400 uppercase tracking-widest">
                    Recording Live
                  </span>
                </div>
                <div className="bg-white/10 px-3 py-1 rounded-full text-xs font-mono font-bold text-slate-300">
                  ⏱️ {formatTimer(recordingDuration)} / 01:00
                </div>
              </div>

              {/* Audio Equalizer Waveform */}
              <div className="flex items-center justify-center gap-1.5 h-12 py-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((bar) => {
                  const baseHeight = 8;
                  const dynamicHeight = Math.max(8, Math.min(44, (audioLevel * (0.4 + (bar % 3) * 0.3))));
                  return (
                    <div
                      key={bar}
                      className="w-1.5 bg-gradient-to-t from-blue-400 to-cyan-300 rounded-full transition-all duration-75"
                      style={{ height: `${dynamicHeight}px` }}
                    />
                  );
                })}
              </div>

              {/* Live Streaming Speech Preview */}
              <div className="bg-white/10 rounded-xl p-3.5 min-h-[64px] border border-white/10 text-sm leading-relaxed min-w-0 break-words">
                {transcript || interimTranscript ? (
                  <p className="text-slate-100 font-medium break-words">
                    {transcript} <span className="text-blue-300 italic">{interimTranscript}</span>
                  </p>
                ) : (
                  <p className="text-slate-400 italic text-center animate-pulse">
                    Listening to your voice... start speaking now
                  </p>
                )}
              </div>

              {/* Stop / Finish Speaking Button */}
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={stopVoiceRecording}
                  className="flex-1 p-3.5 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 text-white font-black flex items-center justify-center gap-2 shadow-md hover:brightness-110 active:scale-98 transition-all cursor-pointer text-sm sm:text-base min-w-0"
                >
                  <StopCircle className="w-5 h-5 fill-white shrink-0" />
                  <span className="truncate">Done Speaking — Extract Job</span>
                </button>
                <button
                  type="button"
                  onClick={stopRecordingSession}
                  className="px-4 py-3.5 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 transition-colors cursor-pointer shrink-0"
                  title="Cancel"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Processing Spinner */}
      {isProcessing && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50/60 p-6 sm:p-8 rounded-2xl border border-black text-center space-y-3 min-w-0">
          <div className="w-14 h-14 bg-white rounded-2xl border border-black shadow-md mx-auto flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
          </div>
          <div>
            <h4 className="font-display font-black text-slate-900 text-base sm:text-lg">Gemini AI is structuring your job...</h4>
            <p className="text-xs font-bold text-slate-600 mt-1">
              Matching trade category, subcategory, urgency, and pricing scope
            </p>
          </div>
        </div>
      )}

      {/* Extracted Structured Job Confirmation Summary Screen */}
      {extractedJob && !isProcessing && (
        <div className="w-full max-w-full min-w-0 bg-slate-50 rounded-xl sm:rounded-2xl border-2 border-black p-3.5 sm:p-5 space-y-4 sm:space-y-5 shadow-sm animate-in fade-in zoom-in-95 duration-200 box-border overflow-hidden">
          {/* Card Header & Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/10 pb-3.5">
            <div className="flex items-start gap-2.5 min-w-0">
              <span className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5">
                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-black text-emerald-800 uppercase tracking-widest block">
                    AI Voice Spec Confirmation
                  </span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                    Ready to Review
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-600 block mt-0.5 leading-snug">
                  Review, edit, or append to your job details before submitting
                </span>
              </div>
            </div>

            {/* Audio Memo Playback button if recorded */}
            {extractedJob.audioUrl && (
              <button
                type="button"
                onClick={handleToggleAudioPlayback}
                className="px-3 py-1.5 rounded-xl bg-white border border-black text-xs font-black text-slate-800 hover:bg-slate-100 flex items-center gap-2 cursor-pointer shadow-2xs self-start sm:self-auto shrink-0 transition-colors"
              >
                {isPlayingAudio ? <Pause className="w-3.5 h-3.5 text-red-600 fill-current" /> : <Play className="w-3.5 h-3.5 text-blue-600 fill-current" />}
                <span>{isPlayingAudio ? "Pause Audio Memo" : "Listen to Voice Recording"}</span>
              </button>
            )}
          </div>

          {/* Form Fields: Title & Category Selection */}
          <div className="space-y-3.5 sm:space-y-4 min-w-0">
            {/* Job Title Field */}
            <div className="min-w-0">
              <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Job Title</span>
                <span className="text-[10px] font-normal text-slate-500 lowercase">editable</span>
              </label>
              <input
                type="text"
                value={extractedJob.title}
                onChange={(e) => setExtractedJob({ ...extractedJob, title: e.target.value })}
                placeholder="e.g. Combi Boiler Repair & Diagnostics"
                className="w-full min-w-0 max-w-full px-3.5 py-2.5 bg-white rounded-xl border border-black text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-black focus:outline-hidden box-border"
              />
            </div>

            {/* Trade Category & Subcategory Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
              <div className="min-w-0">
                <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Wrench className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                  <span>Category</span>
                </label>
                <select
                  value={extractedJob.category}
                  onChange={(e) => {
                    const newCat = e.target.value;
                    const catObj = categories.find(c => c.name.toLowerCase() === newCat.toLowerCase());
                    const defaultSub = catObj?.subcategories?.[0] || "";
                    setExtractedJob({
                      ...extractedJob,
                      category: newCat,
                      subcategory: defaultSub
                    });
                  }}
                  className="w-full min-w-0 max-w-full px-3 py-2.5 bg-white rounded-xl border border-black text-xs font-bold text-slate-900 focus:ring-2 focus:ring-black focus:outline-hidden cursor-pointer box-border truncate"
                >
                  {categories.map((cat) => (
                    <option key={cat.name} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0">
                <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <span>Subcategory / Speciality</span>
                </label>
                {availableSubcategories.length > 0 ? (
                  <select
                    value={extractedJob.subcategory || availableSubcategories[0]}
                    onChange={(e) => setExtractedJob({ ...extractedJob, subcategory: e.target.value })}
                    className="w-full min-w-0 max-w-full px-3 py-2.5 bg-white rounded-xl border border-black text-xs font-bold text-slate-900 focus:ring-2 focus:ring-black focus:outline-hidden cursor-pointer box-border truncate"
                  >
                    {availableSubcategories.map((sub: string) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={extractedJob.subcategory || ""}
                    onChange={(e) => setExtractedJob({ ...extractedJob, subcategory: e.target.value })}
                    placeholder="e.g. General repair"
                    className="w-full min-w-0 max-w-full px-3 py-2.5 bg-white rounded-xl border border-black text-xs font-bold text-slate-900 focus:ring-2 focus:ring-black focus:outline-hidden box-border"
                  />
                )}
              </div>
            </div>

            {/* Urgency & Quote Scope Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 min-w-0">
              <div className="min-w-0">
                <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                  <span>Urgency Level</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: "emergency", label: "🚨 Emergency", color: "bg-red-500 text-white" },
                    { id: "asap", label: "⚡ ASAP", color: "bg-orange-500 text-white" },
                    { id: "flexible", label: "📅 Flexible", color: "bg-emerald-600 text-white" },
                    { id: "specific_date", label: "🗓️ Pick Date", color: "bg-blue-600 text-white" }
                  ].map((urg) => (
                    <button
                      key={urg.id}
                      type="button"
                      onClick={() => setExtractedJob({ ...extractedJob, urgency: urg.id as any })}
                      className={cn(
                        "px-2 py-2 rounded-lg text-[11px] font-bold transition-all border cursor-pointer text-center truncate",
                        extractedJob.urgency === urg.id
                          ? cn(urg.color, "border-black font-black shadow-xs")
                          : "bg-white text-slate-700 border-slate-300 hover:border-black"
                      )}
                    >
                      {urg.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-w-0">
                <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                  <span>Quote Scope</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "supply_and_fit", label: "Supply & Fit" },
                    { id: "labour_only", label: "Labour Only" },
                    { id: "materials_only", label: "Materials" }
                  ].map((scope) => (
                    <button
                      key={scope.id}
                      type="button"
                      onClick={() => setExtractedJob({ ...extractedJob, quoteScope: scope.id as any })}
                      className={cn(
                        "w-full px-1 py-2 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all border cursor-pointer text-center leading-tight truncate",
                        extractedJob.quoteScope === scope.id
                          ? "bg-black text-white border-black font-black shadow-xs"
                          : "bg-white text-slate-700 border-slate-300 hover:border-black"
                      )}
                      title={scope.label}
                    >
                      {scope.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Editable Description with Live Word Count */}
            <div className="min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                  <span>AI-Generated Description (Editable)</span>
                </label>
                <span className="text-[10px] font-semibold text-slate-500 shrink-0">
                  {extractedJob.description.trim().split(/\s+/).filter(Boolean).length} words
                </span>
              </div>
              <textarea
                rows={4}
                value={extractedJob.description}
                onChange={(e) => setExtractedJob({ ...extractedJob, description: e.target.value })}
                placeholder="Detailed description of the job..."
                className="w-full min-w-0 max-w-full p-3 bg-white rounded-xl border border-black text-xs sm:text-sm font-medium text-slate-900 leading-relaxed focus:ring-2 focus:ring-black focus:outline-hidden box-border"
              />
            </div>

            {/* Quick Append Tool */}
            <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-black space-y-2.5 min-w-0 max-w-full box-border">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Quick Append to Description</span>
                </label>
                <span className="text-[10px] font-bold text-slate-400">1-Tap Preset Additions</span>
              </div>

              {/* Preset Append Chips */}
              <div className="flex flex-wrap gap-1.5 min-w-0">
                {[
                  "Access via side gate / key safe",
                  "Parking available on driveway",
                  "Need work completed on weekends only",
                  "Boiler error code noted on unit",
                  "Materials already on site"
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAppendNote(preset)}
                    className="max-w-full text-left px-2.5 py-1 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-400 rounded-lg text-[11px] font-semibold text-slate-700 hover:text-blue-900 transition-colors cursor-pointer active:scale-95 break-words"
                  >
                    + {preset}
                  </button>
                ))}
              </div>

              {/* Custom Append Input */}
              <div className="flex gap-1.5 sm:gap-2 pt-1 min-w-0">
                <input
                  type="text"
                  value={appendText}
                  onChange={(e) => setAppendText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAppendNote();
                    }
                  }}
                  placeholder="Type extra note to append..."
                  className="flex-1 min-w-0 w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-300 text-xs font-medium text-slate-900 focus:bg-white focus:border-black focus:outline-hidden box-border"
                />
                <button
                  type="button"
                  onClick={() => handleAppendNote()}
                  disabled={!appendText.trim()}
                  className="px-2.5 sm:px-3.5 py-2 rounded-lg bg-black hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-bold transition-all cursor-pointer shrink-0"
                >
                  <span className="hidden xs:inline">Append Note</span>
                  <span className="xs:hidden">Append</span>
                </button>
              </div>
            </div>

            {/* Detected Specifications / Highlights (Interactive Chips) */}
            <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-black space-y-2 min-w-0 max-w-full box-border">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <span className="text-[11px] font-black text-slate-900 uppercase tracking-wider">
                  Key Specifications Detected ({extractedJob.keyHighlights?.length || 0})
                </span>
                <span className="text-[10px] text-slate-400">Click ✕ to remove</span>
              </div>

              <div className="flex flex-wrap gap-1.5 min-w-0">
                {extractedJob.keyHighlights && extractedJob.keyHighlights.length > 0 ? (
                  extractedJob.keyHighlights.map((spec, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-950 text-xs font-bold rounded-lg max-w-full break-words"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                      <span className="break-words min-w-0 leading-tight">{spec}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveHighlight(i)}
                        className="text-blue-500 hover:text-red-600 hover:bg-blue-100 p-0.5 rounded-xs cursor-pointer ml-0.5 shrink-0"
                        title="Remove specification"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">No specific highlight tags detected.</span>
                )}
              </div>

              {/* Add Custom Highlight Input */}
              <div className="flex gap-1.5 sm:gap-2 pt-1 min-w-0">
                <input
                  type="text"
                  value={newHighlightText}
                  onChange={(e) => setNewHighlightText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddHighlight();
                    }
                  }}
                  placeholder="Add custom spec tag (e.g. Worcester 30kW)..."
                  className="flex-1 min-w-0 w-full px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-300 text-xs font-medium text-slate-900 focus:bg-white focus:border-black focus:outline-hidden box-border"
                />
                <button
                  type="button"
                  onClick={handleAddHighlight}
                  disabled={!newHighlightText.trim()}
                  className="px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 disabled:opacity-40 text-slate-800 text-xs font-bold transition-all cursor-pointer shrink-0"
                >
                  <span className="hidden xs:inline">+ Add Spec</span>
                  <span className="xs:hidden">+ Add</span>
                </button>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-black/10">
            <button
              type="button"
              onClick={() => onApplyVoiceJob(extractedJob)}
              className="w-full sm:flex-1 p-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black flex items-center justify-center gap-2 shadow-md active:scale-98 transition-all cursor-pointer text-sm"
            >
              <span>Confirm & Continue to Post</span>
              <ChevronRight className="w-4 h-4 stroke-[3]" />
            </button>
            <div className="grid grid-cols-2 sm:flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setExtractedJob(null);
                  setTranscript("");
                  setInterimTranscript("");
                  startVoiceRecording();
                }}
                className="px-3.5 py-3 rounded-xl bg-white border border-black text-slate-800 font-bold hover:bg-slate-100 transition-colors flex items-center justify-center gap-1.5 text-xs cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <span>Speak Again</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setExtractedJob(null);
                  setTranscript("");
                  setInterimTranscript("");
                }}
                className="px-3.5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors flex items-center justify-center gap-1 text-xs cursor-pointer"
              >
                <span>Discard</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

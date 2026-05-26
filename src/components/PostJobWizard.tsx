import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ChevronRight, 
  ChevronLeft, 
  Camera, 
  Video,
  MapPin, 
  CheckCircle2, 
  Loader2,
  X,
  Clock,
  Droplets, Zap, Thermometer, Home, Layout, Palette, Wrench, Maximize, Grid, Leaf, Box, Sparkles, Lock,
  PlusCircle,
  Circle,
  StopCircle,
  RefreshCw,
  Trash2,
  Image as ImageIcon,
  Mic,
  FileText,
  ShieldCheck,
  Search,
  Plus,
  Info,
  Building2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  User as UserIcon,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap as ZapIcon,
  BarChart3,
  Locate,
  Star,
  PenTool,
  MessageSquare,
  Calendar
} from "lucide-react";
import { cn, generateJobNumber, getOutwardPostcode } from "@/src/lib/utils";
import { TRADE_CATEGORIES, URGENCY_LEVELS } from "@/src/constants";
import { useCategories } from "../lib/CategoryProvider";
import { lookupPostcode, reverseLookupPostcode } from "@/src/services/postcodeService";
import { getJobEstimate, analyzeJobPhoto, getClarifyingQuestions, improveJobDescription, checkSafetyAndPII, processVoiceTranscript, transcribeVoiceAudio, processVoiceAudio, type AIEstimate } from "@/src/services/gemini";
import { db, doc, setDoc, updateDoc, collection, serverTimestamp, handleFirestoreError, OperationType, storage, ref, uploadBytes, getDownloadURL, uploadBytesResumable, uploadString, addDoc, sendNotification, getDoc, getDocs, query, where, onSnapshot } from "@/src/firebase";
import { distributeJobNotifications } from "@/src/services/notificationService";
import { useAuth } from "./AuthProvider";
import { useNavigate, useLocation } from "react-router-dom";
import { useJsApiLoader } from "@react-google-maps/api";
import { Capacitor } from '@capacitor/core';
import { getGoogleMapsApiKey, isCapacitor } from "@/src/lib/capacitor";
import { useBusinessTab } from "@/src/store/businessTabStore";
import { toast } from "sonner";

import { getInstantMatchCopy } from "@/src/lib/boosts";

const iconMap: Record<string, any> = {
  Droplets, Zap, Thermometer, Home, Layout, Palette, Wrench, Maximize, Grid, Leaf, Box, Sparkles, Lock
};

const libraries: any[] = ['places'];

const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

const compressImageFile = (file: File, maxDim = 1200, quality = 0.75): Promise<File> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

export default function PostJobWizard() {
  const { user, profile, loading: authLoading } = useAuth();
  const { categories } = useCategories();
  const location = useLocation();
  const navigate = useNavigate();
  const editJob = (location.state as any)?.editJob;
  const targetTradespersonId = (location.state as any)?.targetTradespersonId;
  const targetTradespersonName = (location.state as any)?.targetTradespersonName;
  const targetTrades = (location.state as any)?.targetTrades;
  
  // Backwards compatibility for single property
  const legacyPropertyId = (location.state as any)?.linkedPropertyId;
  const legacyPropertyName = (location.state as any)?.linkedPropertyName;
  
  const linkedProperties = (location.state as any)?.linkedProperties || (
    legacyPropertyId ? [{ id: legacyPropertyId, name: legacyPropertyName }] : []
  );
  
  const isB2B = (location.state as any)?.isB2B;
  const { activeTab } = useBusinessTab();
  const [isInitializing, setIsInitializing] = useState(!editJob);
  
  const JobReminder = () => {
    if (!formData.category && !formData.title) return null;
    return (
      <div className="bg-white rounded-2xl p-4 border border-[#0084a5] shadow-sm flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold text-slate-400 uppercase">
            {formData.title ? "Job Title" : "Category"}
          </p>
          <p className="font-bold text-slate-900">{formData.title || formData.category}</p>
          {formData.urgency === "emergency" && (
            <p className="text-xs font-bold text-red-600 uppercase">Emergency</p>
          )}
        </div>
        {formData.postcode && (
          <div className="text-right border-l border-black pl-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location</p>
            <p className="text-xs font-black text-slate-900 uppercase">
              {getOutwardPostcode(formData.postcode)}
            </p>
          </div>
        )}
      </div>
    );
  };

  // Step 0 is landing, 1 is category, 2 is subcategory, etc.
  const [step, setStep] = useState(editJob ? 3 : 0);
  const [formData, setFormData] = useState({
    category: editJob?.category || "",
    subcategory: editJob?.subcategory || "",
    title: editJob?.title || "",
    description: editJob?.description || "",
    urgency: editJob?.urgency || (location.state as any)?.urgency || "flexible",
    jobDate: editJob?.jobDate || "",
    postcode: editJob?.postcode || "",
    city: editJob?.city || "", 
    area: editJob?.area || "",
    fullAddress: editJob?.fullAddress || "",
    houseNumber: editJob?.houseNumber || "",
    locationInstructions: editJob?.locationInstructions || "",
    photos: editJob?.photos || [] as string[],
    videos: editJob?.videos || [] as string[],
    documents: editJob?.documents || [] as { name: string; url: string }[],
    paymentPreference: editJob?.paymentPreference || "negotiable",
    quoteScope: editJob?.quoteScope || "complete_package",
    estimatedCompletionTime: editJob?.estimatedCompletionTime || "",
    estimatedCompletionTimeUnit: editJob?.estimatedCompletionTimeUnit || "hours",
    selectedBudget: editJob?.selectedBudget || null,
    mobileNumber: editJob?.mobileNumber || profile?.phoneNumber || "",
    selectedAssets: [] as any[],
    isEmergencyBoost: false,
    isInstantMatch: false,
  });
  
  const [showBoostInfo, setShowBoostInfo] = useState<"emergency" | "instant" | null>(null);
  const [platformConfig, setPlatformConfig] = useState<any>(null);
  const [instantMatchCopy, setInstantMatchCopy] = useState<any>(getInstantMatchCopy(formData.category || ""));

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  React.useEffect(() => {
    if (step === 5 && formData.category && formData.description) {
      import("@/src/services/gemini").then((gemini) => {
        gemini.getDynamicInstantMatchPricing(formData.category, formData.title, formData.description)
        .then(res => {
           if (res) {
             setInstantMatchCopy({
               price: res.price,
               title: res.title,
               desc: res.desc,
               bullets: res.bullets.map((b: any) => ({ ...b, icon: Star, color: "text-amber-500" })) // Star is already imported
             });
           }
        });
      });
    }
  }, [step, formData.category, formData.title, formData.description]);

  React.useEffect(() => {
    const unsub = onSnapshot(doc(db, "platform_config", "global"), (doc) => {
      if (doc.exists()) {
        setPlatformConfig(doc.data());
      }
    });
    return () => unsub();
  }, []);
  
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [useRegisteredAddress, setUseRegisteredAddress] = useState(false);
  const [addressInput, setAddressInput] = useState(editJob?.fullAddress || "");
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [addressSuggestionTimeout, setAddressSuggestionTimeout] = useState<any>(null);

  React.useEffect(() => {
    if (profile?.postcode && !editJob) {
      setUseRegisteredAddress(true);
      setFormData(prev => ({
        ...prev,
        postcode: profile.postcode || "",
        city: profile.city || "",
        area: profile.area || "",
        county: profile.county || "",
        fullAddress: profile.postcode || ""
      }));
    }
  }, [profile, editJob]);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: getGoogleMapsApiKey(),
    libraries,
    version: "quarterly"
  });
  const [titleError, setTitleError] = useState("");
  const [descriptionError, setDescriptionError] = useState("");
  const [postcodeError, setPostcodeError] = useState("");
  const [cameraMode, setCameraMode] = useState<"photo" | "video">("photo");
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  // Drawing Canvas States
  const [showDrawingModal, setShowDrawingModal] = useState(false);
  const [drawingColor, setDrawingColor] = useState("#000000");
  const [drawingLineWidth, setDrawingLineWidth] = useState(4);
  const [paintIsDrawing, setPaintIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingFileInputRef = useRef<HTMLInputElement>(null);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = drawingColor;
    ctx.lineWidth = drawingLineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;
    
    if ("touches" in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setPaintIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!paintIsDrawing) return;
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;
    
    if ("touches" in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
      if (e.cancelable) e.preventDefault();
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setPaintIsDrawing(false);
  };

  const clearDrawingCanvas = () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSaveDrawing = async () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas || !user) return;
    
    setIsUploading(true);
    setUploadProgress(20);
    setError(null);
    setShowDrawingModal(false);

    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9);
      });

      if (!blob) {
        throw new Error("Could not capture drawing.");
      }

      if (user.isAnonymous) {
        setTimeout(() => {
          const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
          setFormData(prev => ({ ...prev, photos: [...prev.photos, dataUrl] }));
          setIsUploading(false);
          toast.success("Drawing saved!");
        }, 400);
        return;
      }

      const fileName = `jobs/${user.uid}/drawings/${Date.now()}.jpg`;
      const storageRef = ref(storage, fileName);
      setUploadProgress(40);

      const arrayBuffer = await blob.arrayBuffer();
      setUploadProgress(60);

      try {
        const snapshot = await uploadBytes(storageRef, arrayBuffer, { contentType: "image/jpeg" });
        setUploadProgress(90);

        const url = await getDownloadURL(snapshot.ref);
        setUploadProgress(100);

        setFormData(prev => ({ ...prev, photos: [...prev.photos, url] }));
        toast.success("Drawing successfully uploaded!");
      } catch (uploadError) {
        console.warn("Drawing cloud upload failed. Falling back to secure local representation:", uploadError);
        const localUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        setFormData(prev => ({ ...prev, photos: [...prev.photos, localUrl] }));
        toast.success("Drawing saved securely (offline fallback)!");
      }
    } catch (err) {
      console.error("Drawing save error:", err);
      setError("Failed to save drawing. Please try again.");
      toast.error("Failed to upload drawing.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrawingFileUploaded = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    setShowDrawingModal(false);

    try {
      const uploadPromises = Array.from(files as FileList).map(async (file: File) => {
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isImage = file.type.startsWith('image/') || 
                        file.name.toLowerCase().endsWith('.jpg') || 
                        file.name.toLowerCase().endsWith('.jpeg') || 
                        file.name.toLowerCase().endsWith('.png') || 
                        file.name.toLowerCase().endsWith('.webp') || 
                        file.name.toLowerCase().endsWith('.heic');

        if (!isPdf && !isImage) {
          console.warn(`File ${file.name} is not a valid drawing (PDF/Image), skipping.`);
          return null;
        }

        const fileName = `jobs/${user.uid}/drawings/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, fileName);

        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error("UPLOAD_TIMEOUT")), 25000);
        });

        const uploadOperationPromise = (async () => {
          const arrayBuffer = await file.arrayBuffer();
          const resolvedType = file.type || (isPdf ? 'application/pdf' : 'image/jpeg');
          const snapshot = await uploadBytes(storageRef, arrayBuffer, { contentType: resolvedType });
          const url = await getDownloadURL(snapshot.ref);
          return { type: isPdf ? 'pdf' : 'image', name: file.name, url };
        })();

        try {
          return await Promise.race([uploadOperationPromise, timeoutPromise]);
        } catch (uploadError) {
          console.warn("Standard Firebase Storage drawing upload failed or timed out. Falling back to local representation:", uploadError);
          try {
            const localUrl = await readFileAsDataURL(file);
            toast.success(`Attached "${file.name}" securely via offline fallback!`);
            return { type: isPdf ? 'pdf' : 'image', name: file.name, url: localUrl };
          } catch (fallbackError) {
            console.error("Local reading fallback failed:", fallbackError);
            toast.error(`Could not read drawing file "${file.name}" locally.`);
            return null;
          }
        }
      });

      const results = (await Promise.all(uploadPromises)).filter((r): r is { type: 'pdf' | 'image'; name: string; url: string } => r !== null);
      
      const newPhotos = results.filter(r => r.type === 'image').map(r => r.url);
      const newDocs = results.filter(r => r.type === 'pdf').map(r => ({ name: r.name, url: r.url }));

      setFormData(prev => ({
        ...prev,
        photos: [...prev.photos, ...newPhotos],
        documents: [...prev.documents, ...newDocs]
      }));
      toast.success("Drawing file successfully uploaded!");
    } catch (err) {
      console.error("Drawing upload error:", err);
      setError("Failed to upload drawing. Please try again.");
    } finally {
      setIsUploading(false);
      if (drawingFileInputRef.current) drawingFileInputRef.current.value = "";
    }
  };

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [userAssets, setUserAssets] = useState<any[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  
  useEffect(() => {
    if (editJob) return;
    if (authLoading) return; // Wait for auth to be fully loaded

    if (profile?.subscriptionType === "business" && user) {
      setLoadingAssets(true);
      getDocs(query(collection(db, "properties"), where("ownerId", "==", user.uid)))
        .then(snapshot => {
          const assets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setUserAssets(assets);
          if (assets.length > 0 && (!linkedProperties || linkedProperties.length === 0)) {
            setStep(-0.5);
          } else if (linkedProperties && linkedProperties.length > 0) {
            const preselectedAssets = assets.filter(a => linkedProperties.some((lp: any) => lp.id === a.id));
            if (preselectedAssets.length > 0) {
              setFormData(prev => ({ ...prev, selectedAssets: preselectedAssets }));
            }
            setStep(0);
          } else {
            setStep(0);
          }
        })
        .finally(() => {
          setLoadingAssets(false);
          setIsInitializing(false);
        });
    } else {
      setStep(0);
      setIsInitializing(false);
    }
  }, [user, profile, authLoading, editJob]);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchQuery && searchQuery.length >= 3) {
        addDoc(collection(db, "search_logs"), {
          query: searchQuery.toLowerCase(),
          timestamp: serverTimestamp()
        }).catch(err => console.error("Error logging search:", err));
      }
    }, 1000);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimerRef = useRef<any>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);

  const isIntentionallyStoppedRef = useRef(false);
  const voiceAccumulatorRef = useRef("");
  const currentSessionTextRef = useRef("");

  const handleToggleListening = async () => {
    if (isListening) {
      if (audioRecorderRef.current && audioRecorderRef.current.state !== 'inactive') {
        audioRecorderRef.current.stop();
      }
      setIsListening(false);
    } else {
      setVoiceText("");
      setVoiceError(null);
      audioChunksRef.current = [];
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream;
        
        let mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
             mimeType = ''; // Default
          }
        }
        
        const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        audioRecorderRef.current = mediaRecorder;
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          if (audioChunksRef.current.length === 0) return;
          
          setIsProcessingVoice(true);
          setVoiceText("Transcribing audio...");
          
          try {
            const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
            
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve, reject) => {
              reader.onloadend = () => {
                const base64data = reader.result?.toString().split(',')[1];
                if (base64data) resolve(base64data);
                else reject(new Error("Failed to convert audio to base64"));
              };
              reader.onerror = reject;
            });
            reader.readAsDataURL(audioBlob);
            const base64Audio = await base64Promise;

            const transcribedText = await transcribeVoiceAudio(base64Audio, audioBlob.type);
            setVoiceText(transcribedText || "");
          } catch (err) {
            console.error("Transcription error:", err);
            setVoiceError("Failed to transcribe audio. Please type your job details manually.");
            toast.error("Failed to transcribe audio.");
          } finally {
            setIsProcessingVoice(false);
            if (audioStreamRef.current) {
              audioStreamRef.current.getTracks().forEach(track => track.stop());
              audioStreamRef.current = null;
            }
          }
        };

        mediaRecorder.start(200); // 200ms chunks
        setIsListening(true);
        setVoiceText("Listening...");
      } catch (err) {
        console.error("Microphone permission denied or error:", err);
        setVoiceError(`Microphone issue detected (Permission denied or blocked by Android WebView). You can continue typing manually, enable Microphone under AnyTrader's Android Settings, or use the Phone Recorder bypass below.`);
        setIsListening(false);
        setVoiceText("");
        if (audioInputRef.current) {
          setTimeout(() => {
            audioInputRef.current?.click();
          }, 300);
        }
      }
    }
  };

  const handleFallbackAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setVoiceError(null);
    setIsProcessingVoice(true);
    setVoiceText("Transcribing voice input...");
    try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
                 const base64data = reader.result?.toString().split(',')[1];
                 if (base64data) resolve(base64data);
                 else reject(new Error("Failed to convert"));
            };
            reader.onerror = reject;
        });
        reader.readAsDataURL(file);
        const base64Audio = await base64Promise;
        const transcribedText = await transcribeVoiceAudio(base64Audio, file.type || 'audio/mp4');
        setVoiceText(transcribedText || "");
    } catch (err) {
        console.error("Transcription error fallback:", err);
        setVoiceError("Failed to transcribe audio file. Please type details manually or try again.");
    } finally {
        setIsProcessingVoice(false);
    }
  };

  const handleProcessVoice = async () => {
    if (!voiceText || isListening) return;

    setIsProcessingVoice(true);
    try {
      const parsedResult = await processVoiceTranscript(voiceText, categories.map(c => c.name));

      setFormData(prev => ({
        ...prev,
        category: parsedResult.category,
        title: parsedResult.title,
        description: parsedResult.description,
        city: parsedResult.city || prev.city,
        urgency: parsedResult.urgency,
        estimatedCompletionTime: parsedResult.estimatedCompletionTime || "",
        estimatedCompletionTimeUnit: parsedResult.estimatedCompletionTimeUnit || "hours"
      }));
      setStep(3); // Go to job details step
    } catch (err) {
      console.error("Error processing voice:", err);
      toast.error("AI could not extract the job details. Please try again or type manually.");
    } finally {
      setIsProcessingVoice(false);
    }
  };

  const safeSearchQuery = searchQuery.trim().toLowerCase();
  const filteredCategories = categories.filter(cat => {
    const matchesSearch = cat.name.toLowerCase().includes(safeSearchQuery) ||
      (cat.subcategories && cat.subcategories.some(sub => sub.toLowerCase().includes(safeSearchQuery)));
    
    // If we have a specific target tradesperson, only show categories they cover
    const matchesTargetTrades = targetTrades && Array.isArray(targetTrades) && targetTrades.length > 0 
      ? targetTrades.includes(cat.name) 
      : true;
      
    return matchesSearch && matchesTargetTrades;
  });

  // ... rest of the existing logic (handleStartCamera, handleCapturePhoto, etc.) ...

  React.useEffect(() => {
    const video = videoRef.current;
    if (stream && video) {
      // Only set srcObject if it's different to avoid interrupting playback
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      
      // Handle play promise to avoid interruption errors
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          // Ignore AbortError as it's common when switching streams or closing the camera
          if (err.name !== "AbortError") {
            console.error("Error playing video:", err);
          }
        });
      }
    }
  }, [stream]);

  const [estimate, setEstimate] = useState<AIEstimate | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [isRefiningScope, setIsRefiningScope] = useState(false);
  const [isImprovingDescription, setIsImprovingDescription] = useState(false);
  const [clarifyingQuestions, setClarifyingQuestions] = useState<string[]>([]);
  const [clarifyingAnswers, setClarifyingAnswers] = useState<Record<string, string>>({});
  const [aiDiagnosis, setAiDiagnosis] = useState<{ category: string; urgency: string; reasoning: string } | null>(null);
  const [showEstimateDetails, setShowEstimateDetails] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const nextStep = () => setStep((s) => s + 1);
  const prevStep = () => {
    if (step === -0.5) {
      navigate(-1);
    } else if (step === 0) {
      if (profile?.subscriptionType === 'business' && userAssets.length > 0) {
        setStep(-0.5);
      } else {
        navigate(-1);
      }
    } else if (step === 1) {
      setStep(0);
    } else if (step === 4) {
      setStep(3); // skip 3.5
    } else {
      setStep((s) => s - 1);
    }
  };

  const handleStartCamera = async (mode: "photo" | "video") => {
    setError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Camera access is not supported on this browser.");
      return;
    }
    try {
      const constraints = {
        video: { facingMode: "environment" },
        audio: mode === "video"
      };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      setCameraMode(mode);
      setIsCameraOpen(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Could not access camera. Please check permissions.");
    }
  };

  const handleStopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraOpen(false);
    setIsRecording(false);
    setUploadProgress(0);
  }, [stream]);

  const handleCapturePhoto = async () => {
    setError(null);
    if (!videoRef.current || !canvasRef.current || !user) {
      console.error("Capture failed: missing refs or user", { 
        video: !!videoRef.current, 
        canvas: !!canvasRef.current, 
        user: !!user 
      });
      return;
    }
    
    const video = videoRef.current;
    
    // Wait for video to be ready if it's not
    if (video.readyState < 2 || video.videoWidth === 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (video.videoWidth === 0 || video.videoHeight === 0 || video.readyState < 2) {
      console.error("Capture failed: video not ready after wait", { 
        width: video.videoWidth, 
        height: video.videoHeight,
        readyState: video.readyState 
      });
      setError("Camera is still starting up. Please wait a second and try again.");
      return;
    }

    const canvas = canvasRef.current;
    
    // Scale down image to reduce file size significantly
    const MAX_WIDTH = 600; // Reduced from 800
    const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("Capture failed: could not get canvas context");
      return;
    }
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    if (!user) {
      setError("You must be logged in to upload photos.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    if (user.isAnonymous) {
      console.log("Guest user detected, capturing actual photo in base64...");
      try {
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        setFormData(prev => ({ ...prev, photos: [...prev.photos, dataUrl] }));
        handleStopCamera();
      } catch (e) {
        console.error("Failed to capture local photo base64:", e);
        setFormData(prev => ({ ...prev, photos: [...prev.photos, "https://placehold.co/600x400?text=Captured+Photo"] }));
        handleStopCamera();
      }
      setIsUploading(false);
      return;
    }

    console.log("--- STARTING UPLOAD DIAGNOSTICS ---");
    console.log("Network Online:", navigator.onLine);
    console.log("User UID:", user.uid);
    console.log("Storage Bucket:", storage.app.options.storageBucket);
    
    try {
      let blob: Blob | null = null;
      
      if (canvas.toBlob) {
        blob = await new Promise<Blob | null>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("canvas.toBlob timed out")), 10000);
          canvas.toBlob((b) => {
            clearTimeout(timeout);
            resolve(b);
          }, "image/jpeg", 0.1); // Reduced quality from 0.3 to 0.1
        });
      } else {
        const dataUrl = canvas.toDataURL("image/jpeg", 0.1); // Reduced quality
        const response = await fetch(dataUrl);
        blob = await response.blob();
      }

      if (!blob) throw new Error("Could not capture photo: blob is null");
      console.log("Blob Details:", { size: blob.size, type: blob.type });
      
      const fileName = `jobs/${user.uid}/${Date.now()}.jpg`;
      const storageRef = ref(storage, fileName);
      
      // Attempt 1: uploadBytes (Fastest, simplest, and highly robust)
      console.log("Attempt 1: uploadBytes (robust standard)...");
      try {
        const arrayBuffer = await blob.arrayBuffer();
        setUploadProgress(10);
        const snapshot = await uploadBytes(storageRef, arrayBuffer, { contentType: blob.type });
        setUploadProgress(100);
        const url = await getDownloadURL(snapshot.ref);
        
        setFormData(prev => ({ ...prev, photos: [...prev.photos, url] }));
        handleStopCamera();
        return;
      } catch (err: any) {
        console.error("Attempt 1 (uploadBytes) failed, trying Attempt 2 (uploadBytesResumable) fallback:", err);
      }

      // Attempt 2: uploadBytesResumable (Fallback)
      console.log("Attempt 2: uploadBytesResumable...");
      try {
        const url = await new Promise<string>((resolve, reject) => {
          blob!.arrayBuffer().then((arrayBuffer) => {
            const uploadTask = uploadBytesResumable(storageRef, arrayBuffer, { contentType: blob!.type });
            
            const timeout = setTimeout(() => {
              console.warn("Resumable upload timed out at 0% (20s)");
              uploadTask.cancel();
              reject(new Error("TIMEOUT_0"));
            }, 20000);

            uploadTask.on('state_changed', 
              (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
                if (progress > 0) {
                  clearTimeout(timeout);
                }
              }, 
              (error) => {
                clearTimeout(timeout);
                reject(error);
              }, 
              async () => {
                clearTimeout(timeout);
                const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadUrl);
              }
            );
          }).catch(reject);
        });
        
        setFormData(prev => ({ ...prev, photos: [...prev.photos, url] }));
        handleStopCamera();
        return;
      } catch (err: any) {
        console.error("Simple upload fallback failed:", err.message || err);
        if (err.code === 'storage/unauthorized') {
          console.error("STORAGE_PERMISSION_DENIED: Check your Firebase Storage rules.");
        }
      }

      // Attempt 3: uploadString (Base64 fallback - most resilient)
      console.log("Attempt 3: uploadString fallback...");
      try {
        const dataUrl = canvas.toDataURL("image/jpeg", 0.3);
        const uploadPromise = uploadString(storageRef, dataUrl, 'data_url');
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("TIMEOUT_STRING")), 45000)
        );

        await Promise.race([uploadPromise, timeoutPromise]);
        const url = await getDownloadURL(storageRef);
        setFormData(prev => ({ ...prev, photos: [...prev.photos, url] }));
        handleStopCamera();
        return; 
      } catch (err: any) {
        console.error("All upload methods failed:", err.message || err);
        throw new Error("Upload failed. This is usually due to slow network, restricted Storage rules, or CORS being blocked. Please ensure rules allow writes: 'allow write: if request.auth != null;'. If you remixed this app, re-run 'Firebase Setup' in settings. You may also need to configure CORS for your bucket (see: https://firebase.google.com/docs/storage/web/download-files#cors_configuration).");
      }

    } catch (err) {
      console.error("Final Upload Error:", err);
      setError(err instanceof Error ? err.message : "An unknown upload error occurred.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    if (user.isAnonymous) {
      console.log("Guest user detected, processing gallery upload locally...");
      (async () => {
        try {
          const simulatedPhotos: string[] = [];
          const simulatedVideos: string[] = [];
          
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const isVid = file.type.startsWith('video/') || file.name.toLowerCase().endsWith('.mp4') || file.name.toLowerCase().endsWith('.mov') || file.name.toLowerCase().endsWith('.avi');
            if (isVid) {
              try {
                simulatedVideos.push(URL.createObjectURL(file));
              } catch (e) {
                simulatedVideos.push("https://www.w3schools.com/html/mov_bbb.mp4");
              }
            } else {
              try {
                const compressed = await compressImageFile(file, 1200, 0.75);
                const dataUrl = await readFileAsDataURL(compressed);
                simulatedPhotos.push(dataUrl);
              } catch (e) {
                simulatedPhotos.push(`https://placehold.co/600x400?text=Gallery+Photo+${i+1}`);
              }
            }
          }
          
          setFormData(prev => ({
            ...prev,
            photos: [...prev.photos, ...simulatedPhotos],
            videos: [...prev.videos, ...simulatedVideos]
          }));
        } catch (err) {
          console.error("Local media processing error:", err);
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      })();
      return;
    }

    try {
      const uploadPromises = Array.from(files as FileList).map(async (file: File) => {
        const isVideo = file.type.startsWith('video/') || 
                        file.name.toLowerCase().endsWith('.mp4') || 
                        file.name.toLowerCase().endsWith('.mov') || 
                        file.name.toLowerCase().endsWith('.avi') || 
                        file.name.toLowerCase().endsWith('.mkv') || 
                        file.name.toLowerCase().endsWith('.webm');
        const isImage = file.type.startsWith('image/') || 
                        file.name.toLowerCase().endsWith('.jpg') || 
                        file.name.toLowerCase().endsWith('.jpeg') || 
                        file.name.toLowerCase().endsWith('.png') || 
                        file.name.toLowerCase().endsWith('.webp') || 
                        file.name.toLowerCase().endsWith('.heic');

        if (!isImage && !isVideo) {
          console.warn(`File ${file.name} is not media, skipping.`);
          return null;
        }

        // Compress image first to avoid huge files and prevent UPLOAD_TIMEOUT
        let processedFile = file;
        if (isImage) {
          try {
            processedFile = await compressImageFile(file, 1200, 0.75);
          } catch (compressErr) {
            console.warn("Compression failed, using original file instead:", compressErr);
          }
        }

        const fileName = `jobs/${user.uid}/${Date.now()}_${processedFile.name}`;
        const storageRef = ref(storage, fileName);
        
        // Define a 25-second timeout for the file upload
        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error("UPLOAD_TIMEOUT")), 25000);
        });

        const uploadOperationPromise = (async () => {
          const arrayBuffer = await processedFile.arrayBuffer();
          
          let progress = 10;
          setUploadProgress(progress);
          const progressInterval = setInterval(() => {
            if (progress < 90) {
              progress += 15;
              setUploadProgress(progress);
            }
          }, 150);

          try {
            const resolvedType = processedFile.type || (isVideo ? 'video/mp4' : 'image/jpeg');
            const snapshot = await uploadBytes(storageRef, arrayBuffer, { contentType: resolvedType });
            clearInterval(progressInterval);
            setUploadProgress(100);
            const url = await getDownloadURL(snapshot.ref);
            return { type: isVideo ? 'video' : 'image', url };
          } catch (firstErr) {
            clearInterval(progressInterval);
            console.warn("First gallery upload attempt failed, retrying once simply:", firstErr);
            // Simple backup retry attempt
            const resolvedType = processedFile.type || (isVideo ? 'video/mp4' : 'image/jpeg');
            const snapshot = await uploadBytes(storageRef, arrayBuffer, { contentType: resolvedType });
            setUploadProgress(100);
            const url = await getDownloadURL(snapshot.ref);
            return { type: isVideo ? 'video' : 'image', url };
          }
        })();

        try {
          return await Promise.race([uploadOperationPromise, timeoutPromise]);
        } catch (uploadError) {
          console.warn("Standard Firebase Storage gallery upload failed or timed out. Falling back to secure local data URL:", uploadError);
          try {
            const localUrl = await readFileAsDataURL(processedFile);
            toast.success(`Attached "${file.name}" securely via offline fallback!`);
            return { type: isVideo ? 'video' : 'image', url: localUrl };
          } catch (fallbackError) {
            console.error("Local reading fallback failed:", fallbackError);
            toast.error(`Could not read "${file.name}" locally.`);
            return null;
          }
        }
      });

      const results = (await Promise.all(uploadPromises)).filter((res): res is { type: 'video' | 'image'; url: string } => res !== null);
      
      const newPhotos = results.filter(r => r.type === 'image').map(r => r.url);
      const newVideos = results.filter(r => r.type === 'video').map(r => r.url);

      setFormData(prev => ({
        ...prev,
        photos: [...prev.photos, ...newPhotos],
        videos: [...prev.videos, ...newVideos]
      }));
    } catch (err) {
      console.error("Gallery upload error:", err);
      setError("Failed to upload one or more images. Please connect to a stable network and try again.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    setIsUploadingDoc(true);
    setError(null);

    if (user.isAnonymous) {
      console.log("Guest user detected, simulating document upload...");
      setTimeout(() => {
        const simulatedDocs = Array.from(files as FileList).map((file: File, i) => ({
          name: file.name,
          url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
        }));
        setFormData(prev => ({ ...prev, documents: [...prev.documents, ...simulatedDocs] }));
        setIsUploadingDoc(false);
        if (docInputRef.current) docInputRef.current.value = "";
      }, 1000);
      return;
    }

    try {
      const uploadPromises = Array.from(files as FileList).map(async (file: File) => {
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
          console.warn(`File ${file.name} is not a PDF, skipping.`);
          return null;
        }

        const fileName = `jobs/${user.uid}/docs/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, fileName);
        
        // Timeout check and robust try block for PDF uploads
        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error("UPLOAD_TIMEOUT")), 25000);
        });

        const uploadOperationPromise = (async () => {
          const arrayBuffer = await file.arrayBuffer();
          try {
            const snapshot = await uploadBytes(storageRef, arrayBuffer, { contentType: file.type || 'application/pdf' });
            const url = await getDownloadURL(snapshot.ref);
            return { name: file.name, url };
          } catch (firstErr) {
            console.warn("First PDF upload attempt failed, retrying once simply:", firstErr);
            const snapshot = await uploadBytes(storageRef, arrayBuffer, { contentType: file.type || 'application/pdf' });
            const url = await getDownloadURL(snapshot.ref);
            return { name: file.name, url };
          }
        })();

        try {
          return await Promise.race([uploadOperationPromise, timeoutPromise]);
        } catch (uploadError) {
          console.warn("Standard Firebase Storage document upload failed or timed out. Falling back to secure local data URL:", uploadError);
          try {
            const localUrl = await readFileAsDataURL(file);
            toast.success(`Attached "${file.name}" securely via offline fallback!`);
            return { name: file.name, url: localUrl };
          } catch (fallbackError) {
            console.error("Local reading fallback failed:", fallbackError);
            toast.error(`Could not read document file "${file.name}" locally.`);
            return null;
          }
        }
      });

      const newDocs = (await Promise.all(uploadPromises)).filter((doc): doc is { name: string; url: string } => doc !== null);
      setFormData(prev => ({ ...prev, documents: [...prev.documents, ...newDocs] }));
    } catch (err) {
      console.error("Document upload error:", err);
      setError("Failed to upload one or more documents. Please try again.");
    } finally {
      setIsUploadingDoc(false);
      if (docInputRef.current) docInputRef.current.value = "";
    }
  };

  const handleStartRecording = () => {
    setError(null);
    if (!stream) return;
    
    setRecordingTime(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= 300) { // 5 minutes limit
          handleStopRecording();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);

    recordedChunksRef.current = [];
    const types = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
      "video/quicktime"
    ];
    const supportedType = types.find(type => MediaRecorder.isTypeSupported(type));
    
    if (!supportedType) {
      setError("Video recording is not supported on this browser.");
      return;
    }

    const mediaRecorder = new MediaRecorder(stream, { mimeType: supportedType });
    mediaRecorderRef.current = mediaRecorder;
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };
    
    mediaRecorder.onstop = async () => {
      if (!user) return;
      setIsUploading(true);
      setUploadProgress(0);

      if (user.isAnonymous) {
        console.log("Guest user detected, simulating video upload...");
        setTimeout(() => {
          setFormData(prev => ({ ...prev, videos: [...prev.videos, "https://www.w3schools.com/html/mov_bbb.mp4"] }));
          handleStopCamera();
          setIsUploading(false);
        }, 1500);
        return;
      }

      console.log("Starting video upload process...");
      try {
        const blob = new Blob(recordedChunksRef.current, { type: supportedType });
        console.log("Video blob created, size:", blob.size, "type:", supportedType);
        
        const extension = supportedType.split("/")[1].split(";")[0];
        const fileName = `jobs/${user.uid}/${Date.now()}.${extension}`;
        const storageRef = ref(storage, fileName);
        
        console.log("Uploading video to Firebase Storage via uploadBytes:", fileName);
        const arrayBuffer = await blob.arrayBuffer();
        
        let url = "";
        try {
          let progress = 5;
          setUploadProgress(progress);
          const progressInterval = setInterval(() => {
            if (progress < 95) {
              progress += 5;
              setUploadProgress(progress);
            }
          }, 300);

          const snapshot = await uploadBytes(storageRef, arrayBuffer, { contentType: blob.type });
          clearInterval(progressInterval);
          setUploadProgress(100);
          url = await getDownloadURL(snapshot.ref);
        } catch (err) {
          console.warn("video upload via uploadBytes failed, trying uploadBytesResumable fallback:", err);
          
          url = await new Promise<string>((resolve, reject) => {
            const uploadTask = uploadBytesResumable(storageRef, arrayBuffer, { contentType: blob.type });
            let isTimedOut = false;
            const timeout = setTimeout(() => {
              console.warn("Video upload timed out, canceling task...");
              isTimedOut = true;
              uploadTask.cancel();
              reject(new Error("Video upload timed out after 60s. Please check your internet connection."));
            }, 60000);

            uploadTask.on('state_changed', 
              (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
                console.log(`Video upload state: ${snapshot.state}, progress: ${progress.toFixed(2)}%`);
              }, 
              (error) => {
                clearTimeout(timeout);
                if (isTimedOut && error.code === 'storage/canceled') {
                  console.log("Video task canceled due to timeout.");
                  return;
                }
                reject(error);
              }, 
              async () => {
                clearTimeout(timeout);
                console.log("Video upload task completed successfully.");
                try {
                  const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                  resolve(downloadUrl);
                } catch (geturlErr) {
                  reject(geturlErr);
                }
              }
            );
          });
        }
        
        console.log("Video download URL obtained:", url);
        
        setFormData(prev => ({ ...prev, videos: [...prev.videos, url] }));
        handleStopCamera();
      } catch (err) {
        console.error("Error in video upload process:", err);
        setError("Failed to upload video. " + (err instanceof Error ? err.message : ""));
      } finally {
        console.log("Video upload process finished.");
        setIsUploading(false);
      }
    };
    
    mediaRecorder.start();
    setIsRecording(true);
  };

  const handleStopRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleAnalyzePhoto = async () => {
    if (formData.photos.length === 0) return;
    setIsAnalyzingPhoto(true);
    setError(null);
    try {
      const result = await analyzeJobPhoto(formData.photos);
      setAiDiagnosis(result);
    } catch (err) {
      console.error(err);
      setError("AI could not analyze the photo. Please select category manually.");
    } finally {
      setIsAnalyzingPhoto(false);
    }
  };

  const applyAiDiagnosis = () => {
    if (!aiDiagnosis) return;
    
    let diagnosedUrgency = aiDiagnosis.urgency.toLowerCase().includes("emergency") ? "emergency" : 
                           aiDiagnosis.urgency.toLowerCase().includes("asap") ? "asap" : "flexible";
                           
    // Downgrade emergency to asap if targeting a specific tradesperson
    if (diagnosedUrgency === "emergency" && targetTradespersonId) {
      diagnosedUrgency = "asap";
    }

    setFormData(prev => ({
      ...prev,
      category: aiDiagnosis.category,
      urgency: diagnosedUrgency
    }));
    setAiDiagnosis(null);
  };

  const handleImproveDescription = async () => {
    if (!formData.description || formData.description.length < 10) return;
    setIsImprovingDescription(true);
    try {
      const improved = await improveJobDescription(formData.category, formData.title, formData.description);
      setFormData(prev => ({ ...prev, description: improved }));
    } catch (err) {
      console.error(err);
    } finally {
      setIsImprovingDescription(false);
    }
  };

  const handleEstimate = async () => {
    setIsEstimating(true);
    setError(null);
    nextStep();
    try {
      // Append clarifying answers to description for better estimate
      const fullDescription = `${formData.description}\n\nAdditional Details:\n${Object.entries(clarifyingAnswers).map(([q, a]) => `Q: ${q}\nA: ${a}`).join("\n")}`;
      
      const result = await getJobEstimate(
        formData.category,
        fullDescription,
        formData.postcode,
        formData.urgency
      );
      setEstimate(result);
    } catch (err) {
      console.error(err);
      setError("Failed to generate estimate. Please try again.");
    } finally {
      setIsEstimating(false);
    }
  };

  const handleGetRefinement = async () => {
    let hasError = false;
    if (!formData.title || formData.title.trim().length < 3) {
      setTitleError("Title must be at least 3 characters long");
      hasError = true;
    } else {
      setTitleError("");
    }
    
    if (!formData.description || formData.description.trim().length < 10) {
      setDescriptionError("Description must be at least 10 characters long");
      hasError = true;
    } else {
      setDescriptionError("");
    }

    if (hasError) return;

    setStep(3.5); // Move to 3.5 immediately so user sees loader
    setIsRefiningScope(true);
    try {
      const questions = await getClarifyingQuestions(formData.category, formData.title, formData.description);
      if (!questions || questions.length === 0) {
        setStep(4);
      } else {
        setClarifyingQuestions(questions);
      }
    } catch (err) {
      console.error(err);
      setStep(4); // Skip if fails
    } finally {
      setIsRefiningScope(false);
    }
  };

  const handleAutoDetectLocation = () => {
    if ("geolocation" in navigator) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude: lat, longitude: lng } = position.coords;
            if (!window.google) {
              setIsLocating(false);
              return;
            }
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: { lat, lng } }, (results, status) => {
              if (status === "OK" && results?.[0]) {
                const foundAddress = results[0].formatted_address;
                setAddressInput(foundAddress);
                setFormData(prev => ({ ...prev, fullAddress: foundAddress }));
                setUseRegisteredAddress(false);
                
                let newCity = "";
                let newArea = "";
                let newPostcode = "";

                results[0].address_components.forEach((comp: any) => {
                  if (comp.types.includes("postal_town") || comp.types.includes("locality")) newCity = comp.long_name;
                  if (comp.types.includes("sublocality") || comp.types.includes("neighborhood")) newArea = comp.long_name;
                  if (comp.types.includes("postal_code")) newPostcode = comp.long_name;
                });

                if (!newPostcode) {
                  const pcMatch = foundAddress.match(/[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}/i);
                  newPostcode = pcMatch ? pcMatch[0] : "";
                }

                setFormData(prev => ({
                  ...prev,
                  city: newCity,
                  area: newArea,
                  postcode: newPostcode
                }));
              }
              setIsLocating(false);
            });
          } catch (err) {
            console.error("Geocoding failed:", err);
            setIsLocating(false);
          }
        },
        (err) => {
          console.error("Geolocation failed:", err);
          setIsLocating(false);
        },
        { timeout: 10000 }
      );
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);
    setError(null);
    try {
      let finalCity = formData.city;
      let finalArea = formData.area;
      let finalPostcode = formData.postcode;

      // Safety net: lookup location if city is missing
      if (!finalCity && formData.postcode) {
        const data = await lookupPostcode(formData.postcode);
        if (data) {
          finalCity = data.city;
          finalArea = data.area;
          finalPostcode = data.postcode;
        }
      }

      // Phase 3: PII & Safety Filter + Rate Limit check in parallel
      const safetyPromise = checkSafetyAndPII(formData.description);
      const limitPromise = editJob ? Promise.resolve(null) : fetch("/api/check-job-limit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId: user.uid,
          isEmergency: formData.urgency === "emergency" || formData.isEmergencyBoost,
          requestedCount: formData.selectedAssets.length > 0 ? formData.selectedAssets.length : 1
        })
      });

      const [safetyResult, limitResponse] = await Promise.all([safetyPromise, limitPromise]);
      
      if (!safetyResult.isSafe) {
        setError(`Safety Issue: ${safetyResult.issues.join(", ")}. Please revise your description.`);
        setIsSubmitting(false);
        return;
      }

      const jobRef = editJob ? doc(db, "jobs", editJob.id) : doc(collection(db, "jobs"));
      const jobNo = editJob?.jobNo || generateJobNumber();
      
      // Check job limit (only for new jobs)
      let securityAlert = null;
      let suggestedStatus = "posted";

      if (!editJob && limitResponse) {
        
        let limitData;
        try {
          limitData = await limitResponse.json();
        } catch (e) {
          limitData = { allowed: true }; // Fallback to allow if API fails totally
        }

        if (!limitResponse.ok) {
          console.error("Job limit check failed:", limitData.error);
          // If the backend refuses to serve or user is missing, we shouldn't necessarily block if it's a 404, but let's be safe
          if (limitResponse.status === 404) {
             setError("Your user profile could not be verified. Please log in again.");
             setIsSubmitting(false);
             return;
          }
        }

        if (limitData.allowed === false) {
          if (limitData.isTrial) {
            setError(`You have used your ${limitData.limit} free trial job posts. Please subscribe to a business plan to continue posting.`);
          } else {
            setError(`You have reached your limit of ${limitData.limit} job posts for your current tier. Please upgrade your plan to post more.`);
          }
          setIsSubmitting(false);
          return;
        }
        
        securityAlert = limitData.securityAlert;
        suggestedStatus = limitData.suggestedStatus || "posted";
      }
      
      // Merge clarifying answers into description
      const additionalDetails = Object.entries(clarifyingAnswers)
        .filter(([_, a]) => (a as string).trim() !== "")
        .map(([q, a]) => `Q: ${q}\nA: ${a}`)
        .join("\n\n");
      
      const baseDescription = safetyResult.hasPII ? safetyResult.redactedText : formData.description;
      
      const finalDescription = additionalDetails 
        ? `${baseDescription}\n\n--- Additional Details ---\n${additionalDetails}`
        : baseDescription;

      // Create jobs (handle bulk if business)
      const assetsToPost = formData.selectedAssets.length > 0 ? formData.selectedAssets : [null];
      
      let firstJobId: string | null = null;
      
      for (const asset of assetsToPost) {
        const finalJobNo = assetsToPost.length > 1 ? `${jobNo}-${asset.name.replace(/\s+/g, '-').toLowerCase()}` : jobNo;
        const currentJobRef = assetsToPost.length > 1 ? doc(collection(db, "jobs")) : jobRef;
        
        if (!firstJobId) {
          firstJobId = currentJobRef.id;
        }
        
        // Apply initial boost configuration based on selected premium features
        let isBoosted = editJob ? editJob.isBoosted || false : false;
        let boostTier = editJob ? editJob.boostTier || null : null;
        let boostExpiresAt = editJob ? editJob.boostExpiresAt || null : null;

        if (!editJob && formData.isInstantMatch) {
           isBoosted = true;
           boostTier = 'instant_match';
           boostExpiresAt = serverTimestamp(); // will be updated upon payment success in real implementation
        } else if (!editJob && formData.isEmergencyBoost) {
           isBoosted = true;
           boostTier = 'emergency_boost';
           boostExpiresAt = serverTimestamp();
        }

        const jobData = {
          id: currentJobRef.id,
          jobNo: finalJobNo,
          homeownerId: user.uid,
          ...formData,
          city: asset?.city || finalCity,
          area: asset?.area || finalArea,
          fullAddress: asset?.fullAddress || formData.fullAddress,
          postcode: (asset?.postcode || finalPostcode).toUpperCase(),
          description: finalDescription,
          status: editJob ? (editJob.status || "posted") : suggestedStatus,
          securityAlert: securityAlert || formData.securityAlert || null,
          hasReview: editJob?.hasReview || false,
          estimateMin: estimate?.min || Math.floor(Number(formData.selectedBudget || 0) * 0.9),
          estimateMax: estimate?.max || Math.floor(Number(formData.selectedBudget || 0) * 1.1),
          postedDate: editJob?.postedDate || serverTimestamp(),
          updatedAt: serverTimestamp(),
          quoteCount: editJob?.quoteCount || 0,
          assetId: asset?.id || null,
          assetName: asset?.name || null,
          linkedPropertyId: asset?.id || (location.state as any)?.linkedPropertyId || null,
          isBoosted,
          boostTier,
          boostExpiresAt,
          ...(editJob ? {} : { createdAt: serverTimestamp() })
        };
        
        const { selectedAssets, isEmergencyBoost, isInstantMatch, ...cleanData } = jobData as any;
        
        if (editJob) {
          await updateDoc(currentJobRef, cleanData);
        } else {
          // Time-Gate leads logic for new jobs
          cleanData.exclusiveUntil = new Date(Date.now() + ((formData.urgency === 'emergency' || formData.isEmergencyBoost) ? 5 : 15) * 60000);
          await setDoc(currentJobRef, cleanData);
        
          // Handle specific tradesperson invitation (only for first job if bulk)
          if (targetTradespersonId && asset === assetsToPost[0]) {
            try {
              const conversationId = `${currentJobRef.id}_${targetTradespersonId}`;
              const conversationRef = doc(db, "conversations", conversationId);
              
              await setDoc(conversationRef, {
                id: conversationId,
                participants: [user.uid, targetTradespersonId],
                jobId: currentJobRef.id,
                jobTitle: formData.title,
                lastMessage: `Invitation to quote for: ${formData.title}`,
                lastMessageAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdAt: serverTimestamp()
              });

              await addDoc(collection(db, "conversations", conversationId, "messages"), {
                senderId: user.uid,
                text: `Hi ${targetTradespersonName}, I'd like to invite you to quote for my new job: "${formData.title}". Please take a look at the details and let me know if you're interested!`,
                createdAt: serverTimestamp()
              });

              await sendNotification(
                targetTradespersonId,
                "New Quote Request! 📝",
                `${profile?.name || 'A homeowner'} invited you to quote for "${formData.title}"`,
                "quote",
                `/job/${currentJobRef.id}`
              );

              if (assetsToPost.length === 1) {
                setIsSubmitting(false);
                navigate(`/chat/${conversationId}`, { 
                  state: { recipientName: targetTradespersonName, jobTitle: formData.title } 
                });
                return;
              }
            } catch (err) {
              console.error("Error creating invitation conversation:", err);
            }
          }

          // Trigger matching system for the new job (standard broadcast)
          try {
            await distributeJobNotifications(
              currentJobRef.id,
              formData.category,
              asset?.postcode || formData.postcode,
              formData.urgency,
              false
            );
            
            // Dispatch standard email notification queue
            const emailRef = doc(collection(db, "email_queue"));
            await setDoc(emailRef, {
              toRole: "tradesperson",
              category: formData.category,
              jobId: currentJobRef.id,
              subject: `New ${formData.category} Job near ${formData.postcode}`,
              body: `A homeowner has posted a new job: ${formData.title}. Tap here to view and quote.`,
              status: "pending",
              createdAt: serverTimestamp()
            });
          } catch (err) {
            console.error("Error triggering matching system:", err);
          }
        }
      }

      if ((formData.isInstantMatch || formData.isEmergencyBoost) && firstJobId) {
        try {
          const response = await fetch("/api/create-checkout-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user?.uid,
              priceId: formData.isInstantMatch ? "price_mock_instant_match" : "price_mock_boost",
              mode: "payment",
              metadata: {
                type: "boost",
                jobId: firstJobId,
                tier: formData.isInstantMatch ? "instant_match" : "emergency_boost"
              },
              successUrl: `${window.location.origin}/job/${firstJobId}?boost_success=true`,
              cancelUrl: `${window.location.origin}/job/${firstJobId}`
            }),
          });
          const data = await response.json();
          if (data.url) {
            window.location.href = data.url;
            return; // Stop execution, redirecting to Stripe
          }
        } catch (paymentErr) {
          console.error("Payment init failed:", paymentErr);
          toast.error("Failed to start checkout. Job posted without boost.");
        }
      }

      toast.success(assetsToPost.length > 1 ? `Successfully posted ${assetsToPost.length} projects` : "Job posted successfully!");
      if (editJob || targetTradespersonId) {
        navigate(profile?.subscriptionType === "business" ? "/portfolio" : "/my-jobs");
      } else {
        setStep(6);
      }
    } catch (err) {
      console.error("Error posting job:", err);
      try {
        handleFirestoreError(err, OperationType.WRITE, "jobs");
      } catch (e: any) {
        setError(e.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white min-h-screen pb-20">
      {/* Target Tradesperson Indicator */}
      {targetTradespersonId && (
        <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2">
            <UserIcon className="w-4 h-4" />
            <span>Requesting quote from: {targetTradespersonName}</span>
          </div>
          <button 
            onClick={() => navigate(location.pathname, { state: { ...location.state, targetTradespersonId: null, targetTradespersonName: null, targetTrades: null } })}
            className="hover:bg-white/10 p-1 rounded transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Linked Project/Properties Indicator */}
      {(linkedProperties?.length > 0 || formData.selectedAssets.length > 0) && step >= 0 && (
        <div className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2 overflow-hidden mr-4">
            <Building2 className="w-4 h-4 shrink-0" />
            <span className="truncate">
              Posting for: {(linkedProperties?.length > 0 ? linkedProperties : formData.selectedAssets).map((p: any) => p.name || p.propertyName || p.address?.line1).join(", ")}
            </span>
          </div>
          <button 
            onClick={() => {
              if (linkedProperties?.length > 0) {
                navigate(location.pathname, { state: { ...location.state, linkedProperties: null, linkedPropertyId: null, linkedPropertyName: null, isB2B: null } });
              }
              setFormData({ ...formData, selectedAssets: [] });
            }}
            className="hover:bg-white/10 p-1 rounded transition-colors shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-black sticky top-0 z-30">
        <div className="flex items-center justify-between p-3 min-h-[48px]">
          <button 
            onClick={prevStep} 
            className="text-[#0084a5] font-bold text-base flex items-center gap-1 hover:opacity-80 transition-opacity"
          >
            Back
          </button>
          
          {step > 0 && step < 6 && (
            <div className="absolute left-1/2 -translate-x-1/2 text-center">
              <p className="text-slate-900 font-bold text-base">Step {step} of 5</p>
            </div>
          )}
          
          <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        
        {step > 0 && step < 6 && (
          <div className="w-full bg-slate-100 h-1">
            <motion.div 
              className="h-full bg-[#0084a5]"
              initial={{ width: 0 }}
              animate={{ width: `${(step / 5) * 100}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto p-3 sm:p-4">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-2">
            <X className="w-4 h-4" />
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {isInitializing && (
            <motion.div
              key="initializing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 gap-4"
            >
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0084a5]"></div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Loading</p>
            </motion.div>
          )}

          {!isInitializing && step === 0 && (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-700">Get quotes from verified tradespeople</h2>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => setStep(1)}
                  className="w-full p-4 rounded-[2rem] bg-orange-500 text-white font-black text-xl flex items-center justify-center gap-3 shadow-2xl shadow-orange-500/20 active:scale-95 transition-all group"
                >
                  Post Job Manually <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </button>
                <button 
                  onClick={() => navigate('/post-emergency-job', { state: location.state })}
                  className="w-full p-4 rounded-[2rem] bg-red-600 text-white font-black text-xl flex items-center justify-center gap-3 shadow-2xl shadow-red-600/20 active:scale-95 transition-all group"
                >
                  Emergency Job Post <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              {/* Post by Voice */}
              <div className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                      <Mic className={cn("w-6 h-6", isListening ? "text-red-600 animate-pulse" : "text-slate-600")} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">Post by Voice</h4>
                      <p className="text-sm text-slate-500">Speak your job — AI fills in the details</p>
                    </div>
                  </div>
                  <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">NEW</span>
                </div>

                {voiceError && (
                  <div className="p-4 bg-amber-50 rounded-xl border border-black text-black text-xs font-semibold leading-relaxed space-y-2 relative">
                    <button 
                      type="button"
                      onClick={() => setVoiceError(null)}
                      className="absolute top-2 right-2 text-slate-500 hover:text-black p-1"
                      title="Clear error"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="pr-6">
                      <p className="font-bold text-[#b91c1c] pr-2 flex items-center gap-1.5">⚠️ Microphone Permission Error</p>
                      <p className="mt-1 font-normal text-slate-700 leading-normal">
                        Your device's Android system has denied WebView microphone access. To fix this permanently, please go to:
                      </p>
                      <p className="mt-1 font-bold text-black border-l-2 border-black pl-2 leading-tight">
                        Android Settings → Apps → AnyTrader → Permissions → Microphone → "Allow"
                      </p>
                      <p className="mt-2 font-normal text-slate-600 leading-normal">
                        Alternatively, use the <strong className="font-bold text-black">Phone Recorder bypass</strong> button below to capture standard audio files using your phone's default voice recorder app.
                      </p>
                    </div>
                  </div>
                )}
                
                {isListening || voiceText ? (
                  <div className="space-y-4">
                    <div className="bg-slate-50 rounded-xl border border-black overflow-hidden">
                      <textarea 
                        className="w-full min-h-[120px] p-4 bg-transparent border-none focus:ring-0 resize-y text-slate-700 placeholder:text-slate-400"
                        placeholder="Listening..."
                        value={voiceText}
                        onChange={(e) => setVoiceText(e.target.value)}
                        disabled={isListening || isProcessingVoice}
                      />
                    </div>
                    <div className="flex gap-3">
                      {isListening ? (
                        <button 
                          onClick={handleToggleListening}
                          className="flex-1 p-3 rounded-xl bg-red-600 text-white font-bold flex items-center justify-center gap-2"
                        >
                          <StopCircle className="w-5 h-5" /> Stop
                        </button>
                      ) : (
                        <button 
                          onClick={() => { 
                            setVoiceText("");
                            audioChunksRef.current = [];
                            if (audioStreamRef.current) {
                              audioStreamRef.current.getTracks().forEach(track => track.stop());
                              audioStreamRef.current = null;
                            }
                            setIsListening(false); 
                          }}
                          className="flex-1 p-3 rounded-xl bg-slate-200 text-slate-700 font-bold flex items-center justify-center gap-2 hover:bg-slate-300 transition-colors"
                        >
                          <X className="w-5 h-5" /> Clear
                        </button>
                      )}
                      
                      <button 
                        onClick={handleProcessVoice}
                        disabled={!voiceText || isProcessingVoice}
                        className="flex-1 p-3 rounded-xl bg-[#1e3a5f] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isProcessingVoice ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                        Process
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button 
                      onClick={handleToggleListening}
                      className="w-full p-4 rounded-xl border border-black text-slate-700 font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Mic className="w-5 h-5 text-blue-600" /> Tap to speak with microphone
                    </button>
                    {isCapacitor() && (
                      <button 
                        onClick={() => audioInputRef.current?.click()}
                        className="w-full p-3 rounded-xl border border-black bg-blue-50 text-blue-800 font-bold hover:bg-blue-100 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                      >
                        🎙️ Use Phone Recorder (Bypass WebView permission)
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Popular Categories */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-slate-900">Popular Categories</h3>
                <div className="grid grid-cols-2 gap-3">
                  {categories.slice(0, 6).map((cat) => {
                    const Icon = iconMap[cat.icon];
                    return (
                      <button
                        key={cat.docId || cat.id}
                        onClick={() => {
                          setFormData({ ...formData, category: cat.name, subcategory: "" });
                          setStep(2);
                        }}
                        className={cn(
                          "w-full p-4 rounded-xl border flex flex-col items-center justify-center gap-3 transition-all active:scale-[0.98]",
                          formData.category === cat.name 
                            ? "border-[#0084a5] border-2 bg-[#0084a5]/5" 
                            : "border-[#0084a5]/40 border-2 bg-white hover:border-[#0084a5] hover:bg-slate-50"
                        )}
                      >
                        <div className="w-10 h-10 rounded-lg bg-[#0084a5]/10 flex items-center justify-center shrink-0">
                          {Icon ? (
                            <Icon className="w-5 h-5 text-[#0084a5]" />
                          ) : (
                            <span className="text-xl">{cat.icon}</span>
                          )}
                        </div>
                        <span className="font-bold text-sm text-center leading-tight text-slate-800">{cat.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* How it works */}
              <div className="bg-white rounded-3xl border border-black shadow-sm overflow-hidden">
                <button 
                  onClick={() => setIsHowItWorksOpen(!isHowItWorksOpen)}
                  className="w-full p-6 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors"
                >
                  <h3 className="text-xl font-bold text-slate-900">How it works</h3>
                  {isHowItWorksOpen ? (
                    <ChevronUp className="w-6 h-6 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-6 h-6 text-slate-400" />
                  )}
                </button>
                
                <AnimatePresence>
                  {isHowItWorksOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-6 pt-0 space-y-6">
                        {[
                          { step: 1, title: "Describe your job", desc: "Add photos and details for accurate quotes", icon: FileText },
                          { step: 2, title: "AI price estimate", desc: "Get an instant estimate before quotes arrive", icon: Zap },
                          { step: 3, title: "Compare quotes", desc: "Up to 5 verified tradespeople will quote", icon: Search },
                          { step: 4, title: "Accept & pay safely", desc: "Our 7-day guarantee protects your payment", icon: ShieldCheck },
                        ].map((item) => (
                          <div key={item.step} className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center font-bold text-sm">
                              {item.step}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="font-bold text-slate-900">{item.title}</h4>
                                <item.icon className="w-5 h-5 text-slate-400" />
                              </div>
                              <p className="text-sm text-slate-500">{item.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* AnyTrader Guarantee */}
              <div className="bg-green-50 rounded-2xl p-4 border border-green-100 flex gap-3">
                <ShieldCheck className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-green-800">AnyTrader Guarantee</h4>
                  <p className="text-sm text-green-700">Your payment is protected until the job is done to your satisfaction.</p>
                </div>
              </div>
            </motion.div>
          )}

          {!isInitializing && step === -0.5 && (
            <motion.div
              key="stepMinus05"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-slate-900">{isB2B || activeTab === 'field_services' ? "Select Projects" : "Select Properties"}</h2>
                <p className="text-slate-500 text-sm">{isB2B || activeTab === 'field_services' ? "Choose the projects from your portfolio for this request." : "Choose the properties from your portfolio for this job."}</p>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                  {userAssets.map((asset) => (
                    <button
                      key={asset.id}
                      onClick={() => setFormData({ ...formData, selectedAssets: [asset] })}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border border-black bg-white hover:bg-slate-50 transition-all text-left text-slate-900",
                        formData.selectedAssets.some(a => a.id === asset.id)
                          ? "ring-1 ring-black shadow-sm"
                          : ""
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="shrink-0 text-slate-700">
                          <Building2 className="w-5 h-5" strokeWidth={1.5} />
                        </div>
                        <div>
                          <p className="font-bold text-[14px] text-black leading-tight">
                            {asset.name || asset.propertyName || asset.address?.line1 || "Unnamed Project"}
                          </p>
                          {(asset.name || asset.propertyName) && asset.address?.line1 && (
                            <p className="font-bold text-[13px] text-black mt-0.5">
                              {asset.address.line1}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className={cn(
                        "w-4 h-4 rounded-full flex items-center justify-center transition-colors shrink-0",
                        formData.selectedAssets.some(a => a.id === asset.id)
                          ? "border-[4px] border-[#0084a5] bg-white ring-1 ring-black"
                          : "border border-black"
                      )} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex flex-col gap-3">
                <button
                  onClick={() => setStep(0)}
                  disabled={formData.selectedAssets.length === 0}
                  className={cn(
                    "w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all",
                    formData.selectedAssets.length > 0
                      ? "bg-[#0084a5] text-white hover:bg-[#006e8a] shadow-lg shadow-[#0084a5]/20"
                      : "bg-slate-200 text-slate-500 cursor-not-allowed opacity-50"
                  )}
                >
                  Continue with Selected
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    setFormData({ ...formData, selectedAssets: [] });
                    setStep(0);
                  }}
                  className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition-all"
                >
                  Continue without
                </button>
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-slate-900">What type of job is it?</h2>
                <p className="text-sm text-slate-500">Select the main trade category</p>
              </div>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Search or describe (e.g. leaky)"
                  className="w-full pl-12 pr-4 py-3 rounded-2xl border border-black shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-600/20 focus:border-blue-600 bg-white transition-all font-medium placeholder:font-normal"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 pb-4 no-scrollbar">
                {filteredCategories.map((cat) => {
                  const Icon = iconMap[cat.icon];
                  return (
                    <button
                      key={cat.docId || cat.id}
                      onClick={() => {
                        setFormData({ ...formData, category: cat.name, subcategory: "" });
                        nextStep();
                      }}
                      className={cn(
                        "w-full p-4 rounded-xl border flex flex-col items-center justify-center gap-3 transition-all active:scale-[0.98]",
                        formData.category === cat.name 
                          ? "border-[#0084a5] border-2 bg-[#0084a5]/5" 
                          : "border-[#0084a5]/40 border-2 bg-white hover:border-[#0084a5] hover:bg-slate-50"
                      )}
                    >
                      <div className="w-10 h-10 rounded-lg bg-[#0084a5]/10 flex items-center justify-center shrink-0">
                        {Icon ? (
                          <Icon className="w-5 h-5 text-[#0084a5]" />
                        ) : (
                          <span className="text-xl">{cat.icon}</span>
                        )}
                      </div>
                      <span className="font-bold text-sm text-center leading-tight text-slate-800">{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2-sub"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <JobReminder />
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-slate-900">What specifically do you need?</h2>
                <p className="text-slate-500 text-sm">Select the subcategory for {formData.category}.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 pb-4 no-scrollbar">
                {categories.find(c => c.name === formData.category)?.subcategories.map((sub) => (
                  <button
                    key={`${formData.category}-${sub}`}
                    onClick={() => {
                      setFormData({ ...formData, subcategory: sub });
                      nextStep();
                    }}
                    className={cn(
                      "w-full py-4 px-4 rounded-xl flex items-center gap-2 transition-all active:scale-[0.98]",
                      formData.subcategory === sub 
                        ? "border-[#0084a5] border-2 bg-blue-50 text-[#0084a5]" 
                        : "border-[#0084a5]/40 border-2 bg-white hover:border-[#0084a5] hover:bg-slate-50 text-slate-700"
                    )}
                  >
                    <span className="font-bold text-sm leading-tight text-left">{sub}</span>
                  </button>
                ))}
                
                <div className="col-span-2 pt-2">
                  <input
                    type="text"
                    placeholder="Custom Text Box"
                    className="w-full text-center p-4 rounded-xl border border-black shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-600/20 focus:border-black bg-white font-bold placeholder:font-bold placeholder:text-slate-600 text-xl text-slate-700"
                    value={formData.subcategory && !categories.find(c => c.name === formData.category)?.subcategories.includes(formData.subcategory) ? formData.subcategory : ""}
                    onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <JobReminder />
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-slate-900">Tell us about the job</h2>
                <p className="text-slate-500 text-sm">Be as descriptive as possible for a better estimate.</p>
              </div>


              <div className="space-y-4">
                {formData.urgency === "emergency" && (
                  <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-red-800">Emergency Tip</h4>
                      <p className="text-sm text-red-700">
                        {formData.category === "Plumbing" ? "Turn off your main water valve immediately." : 
                         formData.category === "Electrical" ? "Turn off your main power switch." : 
                         "Ensure your safety first and stay clear of the area."}
                      </p>
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700">Job Title <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    placeholder="e.g. Fix leaking kitchen tap"
                    className={cn(
                      "w-full p-4 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 bg-white",
                      titleError ? "border-red-500" : "border-black"
                    )}
                    value={formData.title}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData({ ...formData, title: value });
                      if (value.trim().length > 0 && value.trim().length < 3) {
                        setTitleError("Title must be at least 3 characters long");
                      } else {
                        setTitleError("");
                      }
                    }}
                  />
                  {titleError && <p className="text-red-500 text-xs mt-1 font-medium">{titleError}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700">Description <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <textarea 
                      rows={4}
                      placeholder="Describe the issue, any specific parts needed, and the current state..."
                      className={cn(
                        "w-full p-4 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 resize-none bg-white",
                        descriptionError ? "border-red-500" : "border-black"
                      )}
                      value={formData.description}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFormData({ ...formData, description: value });
                        if (value.trim().length > 0 && value.trim().length < 10) {
                          setDescriptionError("Description must be at least 10 characters long");
                        } else {
                          setDescriptionError("");
                        }
                      }}
                    />
                    <div className="absolute bottom-4 right-4 flex items-center gap-2">
                      {formData.description.length > 0 && formData.description.length < 10 && (
                        <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">Keep typing to use AI...</span>
                      )}
                      <button 
                        onClick={handleImproveDescription}
                        disabled={isImprovingDescription || formData.description.length < 10}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm",
                          formData.description.length >= 10 
                            ? "bg-blue-600 text-white hover:bg-blue-700 active:scale-95" 
                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                        )}
                      >
                        {isImprovingDescription ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3" />
                        )}
                        {isImprovingDescription ? "Improving..." : "AI Magic Polish"}
                      </button>
                    </div>
                  </div>
                  {descriptionError && <p className="text-red-500 text-xs mt-1 font-medium">{descriptionError}</p>}

                   <div className="flex flex-wrap gap-2 mt-3">
                     <button 
                       onClick={() => handleStartCamera("photo")}
                       className="px-3 py-2 rounded-xl border border-black text-slate-600 bg-white hover:border-[#0084a5] hover:text-[#0084a5] font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                     >
                       <Camera className="w-4 h-4 text-[#0084a5]" /> Add Photo
                     </button>
                     <button 
                       onClick={() => handleStartCamera("video")}
                       className="px-3 py-2 rounded-xl border border-black text-slate-600 bg-white hover:border-[#0084a5] hover:text-[#0084a5] font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                     >
                       <Video className="w-4 h-4 text-[#0084a5]" /> Add Video
                     </button>
                     <button 
                       onClick={() => docInputRef.current?.click()}
                       className="px-3 py-2 rounded-xl border border-black text-slate-600 bg-white hover:border-[#0084a5] hover:text-[#0084a5] font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                     >
                       <FileText className="w-4 h-4 text-[#0084a5]" /> Add PDF
                     </button>
                     <button 
                       onClick={() => setShowDrawingModal(true)}
                       className="px-3 py-2 rounded-xl border border-black text-slate-600 bg-white hover:border-[#0084a5] hover:text-[#0084a5] font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                     >
                       <PenTool className="w-4 h-4 text-[#0084a5]" /> Add Drawing
                     </button>
                   </div>

                   {/* Inline Uploading Indicator with progress */}
                   {(isUploading || isUploadingDoc) && (
                     <div className="mt-3 p-3 rounded-2xl border border-blue-100 bg-blue-50/50 flex items-center justify-between text-xs font-bold text-blue-700 animate-pulse">
                       <div className="flex items-center gap-2">
                         <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                         <span>Uploading files and project assets... {uploadProgress > 0 && uploadProgress < 100 ? `${Math.round(uploadProgress)}%` : ""}</span>
                       </div>
                       <span className="text-[10px] text-slate-400 font-medium font-mono">Please do not refresh</span>
                     </div>
                   )}

                  {/* Document & Media Previews */}
                  {(formData.photos.length > 0 || formData.videos.length > 0 || formData.documents.length > 0) && (
                    <div className="flex flex-wrap gap-3 pt-2">
                      {formData.photos.map((url, i) => (
                        <div key={`photo-${i}`} className="relative w-16 h-16 rounded-xl overflow-hidden border border-black shadow-sm">
                          <img src={url} alt={`Job photo ${i + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <button 
                            onClick={() => setFormData({ ...formData, photos: formData.photos.filter((_, idx) => idx !== i) })}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-md hover:bg-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {formData.videos.map((url, i) => (
                        <div key={`video-${i}`} className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/20 bg-slate-900 flex items-center justify-center shadow-sm">
                          <video src={url} className="w-full h-full object-cover opacity-60" />
                          <Video className="w-6 h-6 text-white absolute" />
                          <button 
                            onClick={() => setFormData({ ...formData, videos: formData.videos.filter((_, idx) => idx !== i) })}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-md hover:bg-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {formData.documents.map((doc, i) => (
                        <div key={`doc-${i}`} className="flex items-center gap-2 p-2 w-16 h-16 bg-slate-50 flex-col justify-center rounded-xl border border-black shadow-sm relative">
                          <FileText className="w-6 h-6 text-indigo-600 shrink-0" />
                          <span className="text-[9px] text-slate-700 truncate w-full text-center font-medium">{doc.name}</span>
                          <button 
                            onClick={() => setFormData(prev => ({ ...prev, documents: prev.documents.filter((_, idx) => idx !== i) }))}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-md hover:bg-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {formData.photos.length > 0 && !aiDiagnosis && (
                    <button 
                      onClick={handleAnalyzePhoto}
                      disabled={isAnalyzingPhoto}
                      className="w-full mt-2 p-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 font-bold flex items-center justify-center gap-2 hover:bg-blue-100 transition-all disabled:opacity-50 text-sm"
                    >
                      {isAnalyzingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      Analyze Photos with AI
                    </button>
                  )}

                  {aiDiagnosis && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mt-2 p-4 rounded-xl bg-blue-600 text-white space-y-3 shadow-lg"
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5" />
                        <h4 className="font-bold">AI Diagnosis</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1 bg-white/10 p-2 rounded-lg">
                          <p className="text-[10px] opacity-80 font-bold uppercase">Suggested Category</p>
                          <p className="font-bold text-sm leading-tight">{aiDiagnosis.category}</p>
                        </div>
                        <div className="space-y-1 bg-white/10 p-2 rounded-lg">
                          <p className="text-[10px] opacity-80 font-bold uppercase">Urgency Level</p>
                          <p className="font-bold text-sm leading-tight">{aiDiagnosis.urgency}</p>
                        </div>
                      </div>
                      <p className="text-sm opacity-90 italic">"{aiDiagnosis.reasoning}"</p>
                      <button 
                        onClick={applyAiDiagnosis}
                        className="w-full mt-1 p-2 rounded-lg bg-white text-blue-600 font-bold hover:bg-blue-50 transition-all text-sm"
                      >
                        Apply Suggestions
                      </button>
                    </motion.div>
                  )}

                   {/* Hidden inputs left outside visual flow */}
                   <input 
                     type="file"
                     ref={fileInputRef}
                     className="hidden"
                     accept="image/*,video/*"
                     multiple
                     onChange={handleGalleryUpload}
                   />

                   <input 
                     type="file"
                     ref={docInputRef}
                     className="hidden"
                     accept="application/pdf"
                     multiple
                     onChange={handleDocUpload}
                   />

                   <input 
                     type="file"
                     ref={drawingFileInputRef}
                     className="hidden"
                     accept="image/*,application/pdf"
                     multiple
                     onChange={handleDrawingFileUploaded}
                   />
                  
                  <input 
                    type="file"
                    ref={audioInputRef}
                    className="hidden"
                    accept="audio/*"
                    capture="microphone"
                    onChange={handleFallbackAudio}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700">Estimated Completion Time (Optional)</label>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      placeholder="e.g. 4"
                      className="w-24 p-4 rounded-2xl border border-black shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-600/20 focus:border-blue-600 bg-white transition-all font-medium placeholder:font-normal"
                      value={formData.estimatedCompletionTime}
                      onChange={(e) => setFormData({ ...formData, estimatedCompletionTime: e.target.value })}
                    />
                    <select 
                      className="w-32 p-4 rounded-2xl border border-black shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-600/20 focus:border-blue-600 bg-white font-bold text-slate-700 transition-all font-medium"
                      value={formData.estimatedCompletionTimeUnit}
                      onChange={(e) => setFormData({ ...formData, estimatedCompletionTimeUnit: e.target.value })}
                    >
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-700">Payment Preference</label>
                    <select 
                      className="w-full p-4 rounded-2xl border border-black focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 bg-white font-bold text-slate-700"
                      value={formData.paymentPreference}
                      onChange={(e) => setFormData({ ...formData, paymentPreference: e.target.value })}
                    >
                      <option value="fixed_price">Fixed Price</option>
                      <option value="hourly">Hourly Rate</option>
                      <option value="negotiable">Negotiable</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-700">Quote Scope</label>
                    <select 
                      className="w-full p-4 rounded-2xl border border-black focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 bg-white font-bold text-slate-700"
                      value={formData.quoteScope}
                      onChange={(e) => setFormData({ ...formData, quoteScope: e.target.value })}
                    >
                      <option value="complete_package">Complete Package</option>
                      <option value="labour_only">Labour Only</option>
                      <option value="materials_only">Materials Only</option>
                    </select>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3.5 && (
            <motion.div
              key="step3-refiner"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <JobReminder />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  <h2 className="text-xl font-bold text-slate-900">Refine your job post</h2>
                </div>
                <p className="text-slate-500 text-sm">AI has generated a few questions to help tradespeople give you more accurate quotes.</p>
              </div>

              <div className="space-y-6">
                {isRefiningScope ? (
                  <div className="bg-white rounded-3xl p-12 py-16 border border-black shadow-sm flex flex-col items-center justify-center space-y-6 text-center">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-2">
                      <Sparkles className="w-8 h-8 text-blue-600 animate-pulse" />
                    </div>
                    <div className="space-y-2 max-w-[250px]">
                      <h3 className="text-xl font-bold text-slate-900">AI is reviewing your job details</h3>
                      <p className="text-slate-500 text-sm">Generating follow-up questions to help you get the most accurate quotes...</p>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                ) : (
                  clarifyingQuestions.map((question, idx) => (
                    <div key={idx} className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">{question}</label>
                      <textarea 
                        rows={2}
                        placeholder="Your answer..."
                        className="w-full p-4 rounded-2xl border border-black focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 resize-none bg-white"
                        value={clarifyingAnswers[question] || ""}
                        onChange={(e) => setClarifyingAnswers(prev => ({ ...prev, [question]: e.target.value }))}
                      />
                    </div>
                  ))
                )}
              </div>

            </motion.div>
          )}

                    {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <JobReminder />

              {/* 1. Where is the job? */}
              <div className="space-y-4 bg-white p-5 rounded-3xl border border-black shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 rounded-l-3xl"></div>
                
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-sm font-black text-blue-600">1</span>
                  Where is the job?
                </h2>
                
                 <div className="relative">
                   <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                   <input 
                     className="w-full p-4 pl-12 pr-12 rounded-2xl border border-black focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 bg-white transition-all text-sm font-medium placeholder:font-normal placeholder:text-slate-400"
                     placeholder="Enter job address..."
                     value={addressInput}
                     onChange={(e) => {
                       const val = e.target.value;
                       setAddressInput(val);
                       setUseRegisteredAddress(false);
                       if (addressSuggestionTimeout) clearTimeout(addressSuggestionTimeout);
                       if (!val || val.length < 2 || !window.google) {
                         setAddressSuggestions([]);
                         setIsSearchingAddress(false);
                         return;
                       }
                       setIsSearchingAddress(true);
                       const timeout = setTimeout(async () => {
                         let predictions: any[] = [];
                         try {
                           const { AutocompleteSuggestion } = await google.maps.importLibrary("places") as any;
                           const request = { input: val, includedRegionCodes: ['gb'] };
                           const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
                           predictions = res.suggestions || [];
                         } catch (newApiError: any) {
                           console.warn("New Places API fetch failed in PostJobWizard, trying classic AutocompleteService:", newApiError);
                           const classicService = new google.maps.places.AutocompleteService();
                           const request = {
                             input: val,
                             componentRestrictions: { country: 'gb' }
                           };
                           predictions = await new Promise<any[]>((resolve) => {
                             classicService.getPlacePredictions(request, (classicPredictions, status) => {
                               if (status === google.maps.places.PlacesServiceStatus.OK && classicPredictions) {
                                 resolve(classicPredictions.map((cp: any) => ({
                                   placePrediction: {
                                     text: { text: cp.description },
                                     placeId: cp.place_id
                                   }
                                 })));
                               } else {
                                 resolve([]);
                               }
                             });
                           });
                         }

                         if (predictions && predictions.length > 0) {
                           setAddressSuggestions(predictions.map((p: any) => ({
                             label: p.placePrediction.text.text,
                             placeId: p.placePrediction.placeId,
                             placePrediction: p.placePrediction
                           })));
                         } else {
                           setAddressSuggestions([]);
                         }
                         setIsSearchingAddress(false);
                       }, 500);
                       setAddressSuggestionTimeout(timeout);
                     }}
                    onBlur={async (e) => {
                      const val = e.target.value;
                      if (!val || addressSuggestions.length > 0 || useRegisteredAddress) return;
                      try {
                        const data = await lookupPostcode(val);
                        if (data) {
                          setFormData(prev => ({ ...prev, city: data.city, area: data.area, postcode: data.postcode, fullAddress: data.postcode }));
                        }
                      } catch (err) { console.error("Error looking up postcode:", err); }
                    }}
                  />
                  {isSearchingAddress && (
                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0084a5] animate-spin shrink-0 z-10" />
                  )}
                  {addressSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-black max-h-64 overflow-y-auto z-50">
                      {addressSuggestions.map((suggestion, idx) => (
                        <div 
                          key={idx}
                          onClick={async () => {
                            setAddressInput(suggestion.label);
                            setFormData(prev => ({ ...prev, fullAddress: suggestion.label }));
                            setAddressSuggestions([]);
                            setUseRegisteredAddress(false);
                            if (suggestion.placeId) {
                              try {
                                const { Place } = await google.maps.importLibrary("places") as any;
                                const place = new Place({ id: suggestion.placeId });
                                await place.fetchFields({ fields: ['addressComponents'] });
                                if (place.addressComponents) {
                                  let newCity = formData.city;
                                  let newArea = formData.area;
                                  let newPostcode = "";
                                  let newHouseNumber = formData.houseNumber;
                                  place.addressComponents.forEach((comp: any) => {
                                    if (comp.types.includes("postal_town") || comp.types.includes("locality")) newCity = comp.longText;
                                    if (comp.types.includes("sublocality") || comp.types.includes("neighborhood")) newArea = comp.longText;
                                    if (comp.types.includes("postal_code")) newPostcode = comp.longText;
                                    if (comp.types.includes("street_number")) newHouseNumber = comp.longText;
                                  });
                                  if (!newPostcode) {
                                    const pcMatch = suggestion.label.match(/[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}/i);
                                    newPostcode = pcMatch ? pcMatch[0] : "";
                                  }
                                  if (!newHouseNumber) {
                                    const match = suggestion.label.match(/^(\d+|[a-zA-Z\d/]+)\s+/);
                                    if (match) newHouseNumber = match[1];
                                  }
                                  setFormData(prev => ({ ...prev, city: newCity || prev.city, area: newArea || prev.area, postcode: newPostcode, houseNumber: newHouseNumber || prev.houseNumber }));
                                }
                              } catch (err) {
                                console.warn("New Places fetchFields failed, trying Geocoder fallback:", err);
                                try {
                                  const geocoder = new google.maps.Geocoder();
                                  const geocodeRes = await geocoder.geocode({ placeId: suggestion.placeId });
                                  if (geocodeRes.results && geocodeRes.results.length > 0) {
                                    const result = geocodeRes.results[0];
                                    let newCity = formData.city;
                                    let newArea = formData.area;
                                    let newPostcode = "";
                                    let newHouseNumber = formData.houseNumber;
                                    result.address_components.forEach((comp: any) => {
                                      if (comp.types.includes("postal_town") || comp.types.includes("locality")) newCity = comp.long_name;
                                      if (comp.types.includes("sublocality") || comp.types.includes("neighborhood")) newArea = comp.long_name;
                                      if (comp.types.includes("postal_code")) newPostcode = comp.long_name;
                                      if (comp.types.includes("street_number")) newHouseNumber = comp.long_name;
                                    });
                                    if (!newPostcode) {
                                      const pcMatch = suggestion.label.match(/[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}/i);
                                      newPostcode = pcMatch ? pcMatch[0] : "";
                                    }
                                    if (!newHouseNumber) {
                                      const match = suggestion.label.match(/^(\d+|[a-zA-Z\d/]+)\s+/);
                                      if (match) newHouseNumber = match[1];
                                    }
                                    setFormData(prev => ({ ...prev, city: newCity || prev.city, area: newArea || prev.area, postcode: newPostcode, houseNumber: newHouseNumber || prev.houseNumber }));
                                  }
                                } catch (geoErr) {
                                  console.error("Geocoder fallback failed:", geoErr);
                                }
                              }
                            }
                          }}
                          className="p-4 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 flex items-start gap-3 transition-colors"
                        >
                          <MapPin className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="text-sm font-medium text-slate-700">{suggestion.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 w-full">
                  <button
                    type="button"
                    disabled={isLocating}
                    onClick={handleAutoDetectLocation}
                    className="flex-1 p-3 rounded-2xl border border-blue-100 bg-blue-50 text-blue-700 font-bold flex items-center justify-center gap-2 hover:bg-blue-100 transition-all text-sm active:scale-95 disabled:opacity-55"
                  >
                    {isLocating ? (
                      <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin text-blue-700" />
                    ) : (
                      <Locate className="w-4 h-4 flex-shrink-0" />
                    )}
                    {isLocating ? "Locating..." : "Current Location"}
                  </button>
                  {profile?.postcode && (
                    <button
                      type="button"
                      onClick={() => {
                        setUseRegisteredAddress(true);
                        setAddressInput("");
                        setFormData(prev => ({
                          ...prev,
                          postcode: profile.postcode,
                          city: profile.city || prev.city,
                          area: profile.area || prev.area,
                          county: profile.county || prev.county,
                          fullAddress: profile.postcode
                        }));
                      }}
                      className={cn(
                        "flex-1 p-3 rounded-2xl border font-bold flex items-center justify-center gap-2 transition-all text-sm active:scale-95",
                        useRegisteredAddress ? "border-blue-200 bg-white text-blue-700 shadow-inner" : "border-black bg-slate-50 text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      Use Profile Address
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-black mt-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">House / Flat</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 42 or Flat 3B"
                      className="w-full p-3.5 rounded-2xl border border-black focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 bg-white text-sm font-medium placeholder:text-slate-300"
                      value={formData.houseNumber}
                      onChange={(e) => setFormData({ ...formData, houseNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">City</label>
                    <input 
                      type="text" 
                      placeholder="Auto-filled"
                      className="w-full p-3.5 rounded-2xl border-none bg-slate-50 text-sm font-medium focus:outline-none cursor-not-allowed text-slate-500"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      readOnly
                    />
                  </div>
                </div>
              </div>

              {/* 2. When do you need it? */}
              <div className="space-y-4 bg-white p-5 rounded-3xl border border-black shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500 rounded-l-3xl"></div>

                <h2 className="text-lg font-black text-slate-800 flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-orange-50 flex items-center justify-center text-sm font-black text-orange-600">2</span>
                  When do you need it?
                </h2>
                
                {formData.urgency === "emergency" && (
                  <div className="bg-red-50 p-3 rounded-2xl border border-red-100 flex gap-3 text-left">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-red-800 text-sm">Emergency Post</h4>
                      <p className="text-xs text-red-700 font-medium">
                        {formData.category === "Plumbing" ? "Turn off your main water valve immediately." : 
                         formData.category === "Electrical" ? "Turn off your main power switch." : 
                         "Ensure your safety first and stay clear."}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {URGENCY_LEVELS.filter(level => !targetTradespersonId || level.id !== "emergency").map((level) => (
                    <button
                      key={level.id}
                      onClick={() => setFormData({ ...formData, urgency: level.id })}
                      className={cn(
                        "px-5 py-3 text-sm rounded-2xl border transition-all font-bold",
                        formData.urgency === level.id 
                          ? "border-[#0084a5] bg-[#0084a5] text-white shadow-[0_4px_12px_rgba(0,132,165,0.2)]" 
                          : "border-black bg-slate-50 text-slate-600 hover:border-black hover:bg-slate-100"
                      )}
                    >
                      {level.name}
                    </button>
                  ))}
                </div>

                {formData.urgency === "specific_date" && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="pt-2"
                  >
                    <input 
                      type="date" 
                      className="w-full p-4 rounded-2xl border border-black shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 bg-white transition-all font-medium text-slate-700"
                      value={formData.jobDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setFormData({ ...formData, jobDate: e.target.value })}
                    />
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}



{step === 5 && (
            <motion.div
              key="step6"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <JobReminder />
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-slate-900">AI Price Guide</h2>
                <p className="text-slate-500 text-sm">A rough estimate to help you set your budget.</p>
              </div>               {isEstimating ? (
                <div className="bg-white rounded-3xl p-12 border border-black shadow-sm flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="w-12 h-12 text-[#0084a5] animate-spin" />
                  <p className="text-slate-500 font-bold animate-pulse">Calculating estimate...</p>
                  <button 
                    onClick={() => setIsEstimating(false)}
                    className="pt-4 text-slate-400 font-bold text-sm hover:text-slate-600 transition-all"
                  >
                    Skip AI
                  </button>
                </div>
              ) : estimate ? (
                <div className="space-y-6">
                  {estimate.isAvailable === false ? (
                    <div className="bg-orange-50 rounded-xl p-6 text-orange-900 border border-orange-200/50 shadow-sm">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-6 h-6 text-orange-500 shrink-0 mt-0.5" />
                        <div>
                          <h3 className="text-base font-extrabold mb-1">AI Estimate Unavailable</h3>
                          <p className="text-orange-800 font-medium text-sm leading-relaxed">
                            Your job category ('{formData.category}') is outside the scope of our AI pricing model. You will need to receive direct quotes from tradespeople for this request.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={cn(
                      "rounded-3xl p-8 space-y-4 shadow-xl relative overflow-hidden transition-all border-4",
                      formData.selectedBudget === `£${estimate.min} - £${estimate.max}`
                        ? "bg-[#0084a5] text-white border-cyan-300 shadow-cyan-900/40 scale-[1.02]"
                        : "bg-[#0084a5] text-white border-transparent shadow-cyan-900/20"
                    )}>
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-amber-300 fill-current" />
                        <p className="font-bold text-lg">AI Suggested Budget Range</p>
                      </div>
                      <h3 className="text-4xl sm:text-5xl font-black">£{estimate.min} - £{estimate.max}</h3>
                      
                      <div className="bg-white/10 rounded-xl p-4 mt-4 border border-black/20">
                        <p className="text-cyan-50 text-xs leading-relaxed">
                          <strong>Note:</strong> This is an AI estimate, not a guaranteed quote. Tradespeople will see this as your target budget, but their actual quotes may vary based on specific job requirements, materials, and their rates.
                        </p>
                      </div>

                      <button 
                        onClick={() => {
                          setFormData({...formData, selectedBudget: `£${estimate.min} - £${estimate.max}`});
                          setTimeout(() => {
                            const nextStepButton = document.getElementById('next-step-button');
                            if (nextStepButton) {
                              nextStepButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                          }, 100);
                        }}
                        className={cn(
                          "w-full mt-4 font-bold py-4 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2",
                          formData.selectedBudget === `£${estimate.min} - £${estimate.max}`
                            ? "bg-white text-[#0084a5]"
                            : "bg-white/20 hover:bg-white/30 text-white border border-black/30"
                        )}
                      >
                        {formData.selectedBudget === `£${estimate.min} - £${estimate.max}` ? "Selected" : "Set as My Budget"}
                      </button>
                    </div>
                  )}

                  <div className="space-y-3 pt-6 border-t border-black">
                    <h3 className="font-extrabold text-black flex items-center justify-center -mt-2 bg-white px-4 mx-auto w-max text-sm relative -top-6">Custom budget</h3>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 text-xl font-bold">£</span>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          const el = document.getElementById('custom-budget-input');
                          if (el) el.blur();
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-[#114b78] hover:bg-[#0a3556] text-white rounded-lg text-sm font-bold shadow-sm active:scale-95 transition-all z-10"
                      >
                        Save
                      </button>
                      <input
                        id="custom-budget-input"
                        type="number"
                        placeholder="0.00"
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                        className="w-full py-4 pl-12 pr-24 rounded-xl border border-black bg-white font-bold text-xl text-center focus:outline-none focus:ring-4 focus:ring-[#0084a5]/10 focus:border-[#0084a5] transition-all"
                        value={formData.selectedBudget && formData.selectedBudget !== `£${estimate?.min} - £${estimate?.max}` ? formData.selectedBudget : ""}
                        onChange={(e) => setFormData({...formData, selectedBudget: e.target.value})}
                      />
                    </div>
                  </div>

                  {estimate.isAvailable !== false && (
                    <div className="bg-white rounded-3xl border border-black shadow-sm overflow-hidden">
                      <button 
                        onClick={() => setShowEstimateDetails(!showEstimateDetails)}
                        className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="text-left">
                            <h4 className="font-bold text-slate-900">AI Reasoning</h4>
                            <p className="text-xs text-slate-500">How we calculated this range</p>
                          </div>
                        </div>
                        {showEstimateDetails ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                      </button>

                      <AnimatePresence>
                        {showEstimateDetails && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="px-6 pb-6 space-y-4 overflow-hidden"
                          >
                            <div className="p-4 bg-slate-50 rounded-2xl border border-black">
                              <p className="text-sm text-slate-600 leading-relaxed italic">
                                "{estimate.reasoning}"
                              </p>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                              <div className="flex items-start gap-3 p-3 rounded-xl border border-black bg-white">
                                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                                  <Box className="w-4 h-4 text-orange-600" />
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Materials</p>
                                  <p className="text-xs text-slate-700 font-medium">{estimate.breakdown.materials}</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-3 p-3 rounded-xl border border-black bg-white">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                  <Wrench className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Labour</p>
                                  <p className="text-xs text-slate-700 font-medium">{estimate.breakdown.labour}</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-3 p-3 rounded-xl border border-black bg-white">
                                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                                  <Clock className="w-4 h-4 text-green-600" />
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Duration</p>
                                  <p className="text-xs text-slate-700 font-medium">{estimate.breakdown.duration}</p>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {estimate?.pricingInsights && (
                    <div className="rounded-2xl border border-black bg-white overflow-hidden shadow-sm">
                      <div className="p-4 bg-slate-50/50 border-b border-black">
                        <h3 className="font-extrabold text-slate-900">Dynamic Pricing Insights</h3>
                      </div>
                      <div className="divide-y divide-slate-100">
                        <div className="p-4 flex gap-4">
                          <div className="w-8 h-8 rounded-full border border-black flex items-center justify-center shrink-0">
                            <Clock className="w-4 h-4 text-slate-600" />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-slate-900 mb-0.5">Seasonal impact</h4>
                            <p className="text-sm text-slate-600">{estimate.pricingInsights.seasonalImpact || "Prices may vary depending on the time of year and local demand."}</p>
                          </div>
                        </div>
                        <div className="p-4 flex gap-4">
                          <div className="w-8 h-8 rounded-full border border-black flex items-center justify-center shrink-0">
                            <MapPin className="w-4 h-4 text-slate-600" />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-slate-900 mb-0.5">Regional premium</h4>
                            <p className="text-sm text-slate-600">{estimate.pricingInsights.regionalPremium || "Local rates in your area may be higher or lower than the national average."}</p>
                          </div>
                        </div>
                        <div className="p-4 flex gap-4">
                          <div className="w-8 h-8 rounded-full border border-black flex items-center justify-center shrink-0">
                            <ZapIcon className="w-4 h-4 text-slate-600" />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-slate-900 mb-1">Cost-saving tips</h4>
                            <ul className="text-sm text-slate-600 space-y-1 list-disc pl-4">
                              {estimate.pricingInsights.costSavingTips.length > 0 ? (
                                estimate.pricingInsights.costSavingTips.map((tip: string, i: number) => (
                                  <li key={i}>{tip}</li>
                                ))
                              ) : (
                                <>
                                  <li>Bundle multiple small jobs together.</li>
                                  <li>Provide clear photos to get more accurate quotes.</li>
                                  <li>Be flexible with your scheduling if possible.</li>
                                </>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-3xl p-8 border border-black shadow-sm space-y-6">
                  <div className="flex flex-col items-center text-center space-y-2">
                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-2">
                      <AlertTriangle className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Estimate Unavailable</h3>
                    <p className="text-slate-500 text-sm">We couldn't generate an AI estimate right now. You can still set your budget manually.</p>
                  </div>
                  
                  <div className="space-y-4 bg-slate-100/50 p-6 rounded-3xl border border-black">
                    <h3 className="text-xl font-black text-slate-900">Enter custom amount</h3>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-900 font-black text-xl">£</span>
                      <input
                        type="number"
                        placeholder="0.00"
                        className="w-full p-5 pl-12 rounded-2xl border border-black bg-white font-black text-xl focus:outline-none focus:ring-4 focus:ring-[#0084a5]/10 focus:border-[#0084a5] transition-all"
                        value={formData.selectedBudget || ""}
                        onChange={(e) => setFormData({...formData, selectedBudget: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              )}

              {platformConfig?.premiumJobUpgradesEnabled !== false && formData.urgency !== 'emergency' && (
                <div className="space-y-3 pt-6">
                  <h3 className="text-sm font-extrabold text-slate-900 mb-2">Premium Job Upgrades (Optional)</h3>
                  
                  <div className={cn(
                    "relative p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3",
                    formData.isEmergencyBoost ? "border-[#e11d48] bg-rose-50" : "border-[#e11d48]/50 hover:border-[#e11d48] bg-white"
                  )}
                  onClick={() => setFormData({...formData, isEmergencyBoost: !formData.isEmergencyBoost})}
                  >
                     <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex shrink-0 mt-0.5 transition-colors items-center justify-center",
                      formData.isEmergencyBoost ? "border-slate-900" : "border-black"
                    )}>
                      {formData.isEmergencyBoost && <div className="w-2.5 h-2.5 bg-slate-900 rounded-full" />}
                    </div>
                    <div className="flex-1 pr-6">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-base font-extrabold text-slate-900">Emergency Boost <span className="font-black ml-1">£5</span></h4>
                      </div>
                      <p className="text-sm text-slate-600 leading-snug">Emergency boost to elevate your job, help with reliability, and match your choices.</p>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShowBoostInfo('emergency'); }}
                      className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
                      type="button"
                    >
                      <Info className="w-5 h-5" />
                    </button>
                  </div>

                  <div className={cn(
                    "relative p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3",
                    formData.isInstantMatch ? "border-[#f59e0b] bg-amber-50" : "border-[#f59e0b]/50 hover:border-[#f59e0b] bg-white"
                  )}
                  onClick={() => setFormData({...formData, isInstantMatch: !formData.isInstantMatch})}
                  >
                     <div className={cn(
                      "w-5 h-5 shrink-0 rounded-full border-2 flex mt-0.5 transition-colors items-center justify-center",
                      formData.isInstantMatch ? "border-slate-900" : "border-black"
                    )}>
                      {formData.isInstantMatch && <div className="w-2.5 h-2.5 bg-slate-900 rounded-full" />}
                    </div>
                    <div className="flex-1 pr-6">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-base font-extrabold text-slate-900 tracking-tight">Instant Match <span className="text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-black ml-1 text-[10px] uppercase">Premium Value</span> <span className="font-black ml-0.5">From £{(instantMatchCopy?.price || 2.49).toFixed(2)}</span></h4>
                      </div>
                      <p className="text-sm text-slate-600 leading-snug">
                        Instant Match premium value gets you started and connects you to a record number of tradespeople.
                      </p>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShowBoostInfo('instant'); }}
                      className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
                      type="button"
                    >
                      <Info className="w-5 h-5" />
                    </button>
                  </div>

                  {(formData.isEmergencyBoost || formData.isInstantMatch) && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-black text-xs text-black flex items-start gap-2 shadow-sm font-semibold">
                       <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                       <span>You have selected {(formData.isEmergencyBoost && formData.isInstantMatch) ? "both Premium Upgrades" : (formData.isEmergencyBoost ? "the Emergency Boost" : "the Instant Match")}. By continuing, you agree to pay the additional charges upon job posting.</span>
                    </div>
                  )}
                </div>
              )}
              </motion.div>
            )}
        </AnimatePresence>
      </div>

      {/* Navigation Footer */}
      {step !== 0 && (
        <div className="mt-8 mb-8 pb-10 sm:mt-10 sm:pb-0">
          <div className="max-w-2xl mx-auto flex gap-3">
            {step > 0 && (
              <button 
                onClick={prevStep} 
                className="flex-[1] p-4 rounded-2xl border-2 border-black font-black text-slate-600 hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center"
              >
                Back
              </button>
            )}
            
            {step === 1 ? (
              <div className="flex-[3] py-4 px-6 bg-slate-50 rounded-2xl border border-black flex items-center justify-center">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Category Selection</p>
              </div>
            ) : step === 2 ? (
              formData.subcategory ? (
                <button 
                  onClick={() => {
                    const category = categories.find(c => c.name === formData.category);
                    if (category && formData.subcategory && !category.subcategories.includes(formData.subcategory)) {
                      addDoc(collection(db, "search_logs"), {
                        query: formData.subcategory.toLowerCase(),
                        timestamp: serverTimestamp()
                      }).catch(err => console.error("Error logging custom subcategory:", err));
                    }
                    nextStep();
                  }}
                  className="flex-[3] p-4 rounded-2xl bg-orange-500 text-white font-black flex items-center justify-center gap-2 shadow-xl shadow-orange-500/20 active:scale-95 transition-all text-lg"
                >
                  Continue <ChevronRight className="w-5 h-5" />
                </button>
              ) : (
                <div className="flex-[3] py-4 px-6 bg-slate-50 rounded-2xl border border-black flex items-center justify-center">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Subcategory Selection</p>
                </div>
              )
            ) : step === 3 ? (
            <div className="flex-[3] flex gap-3">
              <button 
                onClick={handleGetRefinement} 
                disabled={isRefiningScope}
                id="wizard-next-step-3"
                className={cn(
                  "flex-[2] p-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all",
                  "bg-orange-500 text-white shadow-xl shadow-orange-500/20 active:scale-95" 
                )}
              >
                {isRefiningScope ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Continue <ChevronRight className="w-6 h-6" /></>}
              </button>
            </div>
          ) : step === 3.5 ? (
            <div className="flex-[3] flex gap-3">
              <button 
                disabled={isRefiningScope}
                onClick={() => {
                  setClarifyingAnswers({});
                  setStep(4);
                }}
                className="flex-1 p-4 rounded-2xl border-2 border-black font-bold text-slate-500 hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                Skip 
              </button>
              <button 
                disabled={isRefiningScope}
                onClick={() => setStep(4)}
                id="wizard-next-step-3-5"
                className="flex-[2] p-4 rounded-2xl bg-orange-500 text-white font-black flex items-center justify-center gap-2 shadow-xl shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50"
              >
                Continue <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          ) : step === 4 ? (
            <div className="flex-[3] flex gap-3">
              <button 
                onClick={handleEstimate} 
                disabled={!formData.city || !formData.postcode || !!postcodeError || isUploading || isEstimating || (formData.urgency === "specific_date" && !formData.jobDate)}
                id="wizard-next-step-4"
                className={cn(
                  "flex-[2] p-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all",
                  (formData.city && formData.postcode && !postcodeError && !isUploading && !isEstimating && (formData.urgency !== "specific_date" || formData.jobDate))
                    ? "bg-[#0084a5] text-white shadow-xl shadow-cyan-500/20 active:scale-95" 
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                )}
              >
                {isUploading || isEstimating ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Continue to Estimate <ChevronRight className="w-6 h-6" /></>}
              </button>
            </div>
          ) : step === 5 ? (
            <div className="flex-[3] flex gap-3">
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting || (!estimate && !formData.selectedBudget)}
                id="wizard-next-step-5"
                className="w-full p-4 rounded-xl bg-[#f97316] text-white font-extrabold flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95 text-lg"
              >
                {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Post your job <CheckCircle2 className="w-5 h-5 bg-white text-[#f97316] rounded-full p-0.5" /></>}
              </button>
            </div>
          ) : null}
        </div>
        
        {step === 5 && error && (
          <div className="max-w-2xl mx-auto mt-4 px-4">
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-2">
              <X className="w-4 h-4" />
              {error}
            </div>
          </div>
        )}

        {step === 6 && (
          <motion.div
            key="step7"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-10"
          >
            {/* Illustration Composite */}
            <div className="relative w-full max-w-sm mx-auto mb-8 h-48 flex justify-center items-end bg-[#e6f4f9] rounded-[4rem] px-8 pt-8 overflow-hidden">
              <div className="absolute inset-x-0 bottom-0 h-10 bg-[#75c8b2] opacity-40 rounded-t-[4rem]"></div>
              <div className="relative z-10 flex items-end gap-2 -mb-2">
                <svg width="120" height="150" viewBox="0 0 120 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 150V70C10 60 20 50 35 50H85C100 50 110 60 110 70V150" fill="#a4d5ec" stroke="#2564aaa5" strokeWidth="3" />
                  <circle cx="60" cy="30" r="20" fill="#a4d5ec" stroke="#2564aaa5" strokeWidth="3" />
                  <path d="M45 40C45 40 50 45 60 45C70 45 75 40 75 40" stroke="#2564aaa5" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M50 25C50 25 55 25 60 25C65 25 70 25 70 25" stroke="#2564aaa5" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M10 80C10 80 0 100 0 150H30V90L10 80Z" fill="#a4d5ec" stroke="#2564aaa5" strokeWidth="3" strokeLinejoin="round" />
                  <path d="M110 80C110 80 120 100 120 150H90V90L110 80Z" fill="#a4d5ec" stroke="#2564aaa5" strokeWidth="3" strokeLinejoin="round" />
                </svg>
                
                <svg width="140" height="130" viewBox="0 0 140 130" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="25" y="45" width="90" height="85" fill="#a4d5ec" fillOpacity="0.4" stroke="#2564aaa5" strokeWidth="3" />
                  <path d="M5 45L70 5L135 45" fill="#a4d5ec" fillOpacity="0.8" stroke="#2564aaa5" strokeWidth="3" strokeLinejoin="round" />
                  <rect x="15" y="25" width="20" height="30" fill="#a4d5ec" stroke="#2564aaa5" strokeWidth="3" />
                  <rect x="65" y="75" width="30" height="55" fill="#a4d5ec" stroke="#2564aaa5" strokeWidth="3" />
                  <circle cx="85" cy="55" r="10" fill="none" stroke="#2564aaa5" strokeWidth="3" />
                  <path d="M85 45V65M75 55H95" stroke="#2564aaa5" strokeWidth="3" />
                </svg>
              </div>

              <div className="absolute top-10 right-10 w-16 h-16 bg-[#a5dbc2] rounded-full border-4 border-black flex items-center justify-center z-20 shadow-md">
                <CheckCircle2 className="w-10 h-10 text-[#21855a]" />
              </div>
            </div>

            <h2 className="text-3xl font-extrabold text-[#114b78] mb-8">Great news! Your job is live</h2>

            <div className="w-full max-w-sm mb-8 space-y-4 text-left">
              <h3 className="font-extrabold text-slate-900 text-lg">Next Steps</h3>
              
              <div className="flex items-center gap-4">
                <MessageSquare className="w-6 h-6 text-slate-600" />
                <span className="text-lg text-slate-800 font-medium tracking-tight">Check your messages</span>
              </div>
              
              <div className="flex items-center gap-4">
                <FileText className="w-6 h-6 text-slate-600" />
                <span className="text-lg text-slate-800 font-medium tracking-tight">Review quotes</span>
              </div>
              
              <div className="flex items-center gap-4">
                <Calendar className="w-6 h-6 text-slate-600" />
                <span className="text-lg text-slate-800 font-medium tracking-tight">Schedule appointments</span>
              </div>
            </div>

            <div className="w-full max-w-sm space-y-4">
              <button 
                onClick={() => navigate(profile?.subscriptionType === "business" ? "/portfolio" : "/my-jobs")}
                className="w-full py-4 rounded-xl bg-[#f97316] text-white font-extrabold text-lg hover:bg-[#ea580c] transition-colors"
              >
                Go to My Jobs
              </button>
              
              <button 
                onClick={() => navigate("/")}
                className="w-full py-4 rounded-xl bg-transparent text-[#114b78] font-bold text-lg hover:bg-slate-50 transition-colors"
              >
                Home
              </button>
            </div>
          </motion.div>
        )}
      </div>
      )}

      {/* Camera Overlay */}
      <AnimatePresence>
        {isCameraOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col"
          >
            <div className="p-4 flex justify-between items-center text-white">
              <h3 className="font-bold uppercase tracking-wider text-sm">
                {cameraMode === "photo" ? "Take Photo" : "Record Video"}
              </h3>
              <button onClick={handleStopCamera} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 relative flex items-center justify-center overflow-hidden">
              <video 
                ref={videoRef}
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover"
              />
              {isRecording && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                  <div className="w-2 h-2 bg-white rounded-full" />
                  REC {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')} / 5:00
                </div>
              )}
              {error && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600/90 text-white px-4 py-2 rounded-xl text-sm font-medium backdrop-blur-sm shadow-xl z-50 max-w-[80%] text-center flex flex-col gap-2">
                  <p>{error}</p>
                  <button 
                    onClick={() => setError(null)}
                    className="bg-white text-red-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              {isUploading && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center z-50">
                  <div className="w-64 bg-white/20 rounded-full h-2 overflow-hidden mb-4">
                    <motion.div 
                      className="bg-blue-500 h-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-white font-bold text-sm">Uploading... {Math.round(uploadProgress)}%</p>
                </div>
              )}
            </div>

            <div className="p-8 flex items-center justify-center gap-8 bg-black/50 backdrop-blur-md">
              <button 
                onClick={() => handleStartCamera(cameraMode)}
                className="p-4 text-white hover:bg-white/10 rounded-full transition-colors"
                title="Switch Camera"
              >
                <RefreshCw className="w-6 h-6" />
              </button>

              {cameraMode === "photo" ? (
                <button 
                  onClick={handleCapturePhoto}
                  disabled={isUploading}
                  className="w-20 h-20 rounded-full border-4 border-black flex items-center justify-center group disabled:opacity-50"
                >
                  <div className="w-16 h-16 bg-white rounded-full group-hover:scale-95 transition-transform flex items-center justify-center">
                    {isUploading && <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />}
                  </div>
                </button>
              ) : (
                <button 
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  disabled={isUploading}
                  className={cn(
                    "w-20 h-20 rounded-full border-4 flex items-center justify-center group disabled:opacity-50",
                    isRecording ? "border-red-600" : "border-black"
                  )}
                >
                  {isRecording ? (
                    <StopCircle className="w-12 h-12 text-red-600 group-hover:scale-95 transition-transform" />
                  ) : (
                    <div className="w-16 h-16 bg-red-600 rounded-full group-hover:scale-95 transition-transform flex items-center justify-center">
                      {isUploading && <Loader2 className="w-8 h-8 text-white animate-spin" />}
                    </div>
                  )}
                </button>
              )}

              <div className="w-14" /> {/* Spacer for balance */}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Processing Notifications Overlay */}
      <AnimatePresence>
        {(isRefiningScope || isEstimating || isSubmitting) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white rounded-[2rem] p-8 max-w-[320px] w-full shadow-2xl flex flex-col items-center text-center space-y-6 relative overflow-hidden"
            >
              {/* Decorative top gradient */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#0084a5] via-orange-500 to-[#0084a5]" />
              
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-slate-50 flex items-center justify-center border border-black shadow-inner">
                  <div className="absolute inset-0 border-4 border-[#0084a5]/20 rounded-2xl animate-[spin_3s_linear_infinite]" />
                  <Loader2 className="w-10 h-10 text-[#0084a5] animate-spin" />
                </div>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-xl font-black text-slate-900">
                  {isSubmitting ? "Posting Job..." : 
                   isEstimating ? "Calculating Estimate" : 
                   "Processing Request"}
                </h3>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">
                  {isSubmitting 
                    ? "We're securely saving your job details and matching you with local professionals..." 
                    : isEstimating
                    ? "Our AI is analyzing your job details to generate an accurate price guide..."
                    : "Please wait a moment while our system processes your information..."}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium Info Modal */}
      <AnimatePresence>
        {showBoostInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowBoostInfo(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white rounded-3xl p-6 max-w-[400px] w-full shadow-2xl relative overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-6">
                 <div className={cn(
                   "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner",
                   showBoostInfo === "emergency" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                 )}>
                   {showBoostInfo === 'emergency' ? <Zap className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
                 </div>
                 <button onClick={() => setShowBoostInfo(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                    <X className="w-5 h-5" />
                 </button>
              </div>
              
              <div className="space-y-4 flex-1">
                <h3 className="text-2xl font-black text-slate-900 leading-tight">
                  {showBoostInfo === 'emergency' ? "Emergency Boost" : "Instant Match"}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  {showBoostInfo === 'emergency' ? 
                   "Jump the queue! The Emergency Boost (£5) pins your job listing to the top of all local tradespeople's feeds and sends them an immediate push notification alert, bypassing normal delays." : 
                   instantMatchCopy.desc
                  }
                </p>
                
                <div className="bg-slate-50 p-4 rounded-xl border border-black mt-6 space-y-2">
                   <h4 className="font-bold text-xs uppercase tracking-widest text-slate-400">Why choose this?</h4>
                   <ul className="space-y-2">
                     {showBoostInfo === 'emergency' ? (
                       <>
                         <li className="flex items-start gap-2 text-sm text-slate-700 font-medium"><CheckCircle2 className="w-4 h-4 text-red-500 mt-0.5" /> Increases quotes by 300%</li>
                         <li className="flex items-start gap-2 text-sm text-slate-700 font-medium"><CheckCircle2 className="w-4 h-4 text-red-500 mt-0.5" /> Highlighted in red in the feed</li>
                         <li className="flex items-start gap-2 text-sm text-slate-700 font-medium"><CheckCircle2 className="w-4 h-4 text-red-500 mt-0.5" /> Ideal for urgent needs</li>
                       </>
                     ) : (
                       instantMatchCopy.bullets.map((b: any, i: number) => {
                         const BulletIcon = b.icon;
                         return (
                           <li key={i} className="flex items-start gap-2 text-sm text-slate-700 font-medium">
                             <BulletIcon className={`w-4 h-4 mt-0.5 ${b.color}`} /> {b.text}
                           </li>
                         );
                       })
                     )}
                   </ul>
                </div>
              </div>
              <button 
                onClick={() => setShowBoostInfo(null)}
                className={cn(
                  "mt-6 w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-white shadow-lg",
                  showBoostInfo === "emergency" ? "bg-red-600 shadow-red-600/20 hover:bg-red-700" : "bg-amber-500 shadow-amber-500/20 hover:bg-amber-600"
                )}
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Sketch / Drawing Modal */}
      <AnimatePresence>
        {showDrawingModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setShowDrawingModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white rounded-3xl p-6 max-w-[500px] w-full border border-black shadow-2xl relative overflow-hidden flex flex-col gap-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-xl font-black text-black flex items-center gap-2">
                    <PenTool className="w-5 h-5 text-[#0084a5]" /> Drawing Board
                  </h3>
                  <p className="text-slate-500 text-xs mt-0.5">Sketch a diagram or upload a blueprint drawing</p>
                </div>
                <button 
                  onClick={() => setShowDrawingModal(false)} 
                  className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400 border border-transparent hover:border-black/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* HTML5 Canvas Sketch Pad drawing board */}
              <div className="relative bg-slate-50 rounded-2xl border border-black overflow-hidden flex items-center justify-center">
                <canvas
                  ref={drawingCanvasRef}
                  width={450}
                  height={300}
                  className="bg-white cursor-crosshair touch-none select-none max-w-full"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400 gap-1.5 p-4 text-center">
                    <PenTool className="w-8 h-8 opacity-40 text-slate-600 animate-bounce" />
                    <p className="font-bold text-xs text-slate-600">Use finger or cursor to draw directly here</p>
                    <p className="text-[10px] text-slate-400 font-mono">Drawing is fully touch-optimized</p>
                  </div>
                )}
              </div>

              {/* Toolkit Controls */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-black/10">
                  {/* Colors */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Pen Color:</span>
                    {[
                      { hex: "#000000", label: "Black" },
                      { hex: "#0084a5", label: "Blue" },
                      { hex: "#ef4444", label: "Red" },
                      { hex: "#10b981", label: "Green" }
                    ].map((item) => (
                      <button
                        key={item.hex}
                        onClick={() => setDrawingColor(item.hex)}
                        className={cn(
                          "w-6 h-6 rounded-full border transition-all active:scale-90",
                          drawingColor === item.hex ? "border-black scale-110 ring-2 ring-black/10" : "border-transparent"
                        )}
                        style={{ backgroundColor: item.hex }}
                        title={item.label}
                      />
                    ))}
                  </div>

                  {/* Brush size */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Size:</span>
                    {[
                      { size: 2, label: "Thin" },
                      { size: 4, label: "Medium" },
                      { size: 8, label: "Thick" }
                    ].map((item) => (
                      <button
                        key={item.size}
                        onClick={() => setDrawingLineWidth(item.size)}
                        className={cn(
                          "px-2 py-1 rounded text-[10px] font-extrabold transition-all border active:scale-95",
                          drawingLineWidth === item.size ? "bg-black text-white border-black" : "bg-white text-slate-600 border-black/10"
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={clearDrawingCanvas}
                    className="flex-1 py-2.5 rounded-xl border border-black hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1 bg-white"
                  >
                    Clear Canvas
                  </button>
                  <button
                    onClick={() => drawingFileInputRef.current?.click()}
                    className="flex-1 py-2.5 rounded-xl border border-black hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1 bg-white"
                  >
                    Upload blueprint instead
                  </button>
                </div>
              </div>

              {/* Confirm / Cancel Actions */}
              <div className="grid grid-cols-2 gap-3 mt-2 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setShowDrawingModal(false)}
                  className="p-3 rounded-2xl border border-black text-black font-bold text-sm bg-white hover:bg-slate-100 transition-all text-center active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDrawing}
                  disabled={!hasDrawn}
                  className={cn(
                    "p-3 rounded-2xl text-white font-extrabold text-sm text-center transition-all active:scale-95 border",
                    hasDrawn ? "bg-[#0084a5] border-black hover:opacity-90 cursor-pointer shadow-md" : "bg-slate-200 border-slate-200 text-slate-400 cursor-not-allowed"
                  )}
                >
                  Confirm Sketch
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

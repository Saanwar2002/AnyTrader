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
  Locate
} from "lucide-react";
import { cn, generateJobNumber, getOutwardPostcode } from "@/src/lib/utils";
import { TRADE_CATEGORIES, URGENCY_LEVELS } from "@/src/constants";
import { useCategories } from "../lib/CategoryProvider";
import { lookupPostcode, reverseLookupPostcode } from "@/src/services/postcodeService";
import { getJobEstimate, analyzeJobPhoto, getClarifyingQuestions, improveJobDescription, checkSafetyAndPII, processVoiceTranscript, type AIEstimate } from "@/src/services/gemini";
import { db, doc, setDoc, updateDoc, collection, serverTimestamp, handleFirestoreError, OperationType, storage, ref, uploadBytes, getDownloadURL, uploadBytesResumable, uploadString, addDoc, sendNotification, getDoc, getDocs, query, where } from "@/src/firebase";
import { distributeJobNotifications } from "@/src/services/notificationService";
import { useAuth } from "./AuthProvider";
import { useNavigate, useLocation } from "react-router-dom";
import { useJsApiLoader } from "@react-google-maps/api";
import { toast } from "sonner";

const iconMap: Record<string, any> = {
  Droplets, Zap, Thermometer, Home, Layout, Palette, Wrench, Maximize, Grid, Leaf, Box, Sparkles, Lock
};

const libraries: any[] = ['places'];

export default function PostJobWizard() {
  const { user, profile } = useAuth();
  const { categories } = useCategories();
  const location = useLocation();
  const navigate = useNavigate();
  const editJob = (location.state as any)?.editJob;
  const targetTradespersonId = (location.state as any)?.targetTradespersonId;
  const targetTradespersonName = (location.state as any)?.targetTradespersonName;
  
  const JobReminder = () => {
    if (!formData.category && !formData.title) return null;
    return (
      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3 mb-4">
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
          <div className="text-right border-l border-slate-100 pl-4">
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
  });
  
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
    googleMapsApiKey: (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
    version: "weekly"
  });
  const [titleError, setTitleError] = useState("");
  const [postcodeError, setPostcodeError] = useState("");
  const [cameraMode, setCameraMode] = useState<"photo" | "video">("photo");
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [userAssets, setUserAssets] = useState<any[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  
  useEffect(() => {
    if (profile?.subscriptionType === "business" && user) {
      setLoadingAssets(true);
      getDocs(query(collection(db, "assets"), where("ownerId", "==", user.uid)))
        .then(snapshot => {
          setUserAssets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        })
        .finally(() => setLoadingAssets(false));
    }
  }, [user, profile]);
  
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-GB';

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        setVoiceText(finalTranscript || interimTranscript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const handleToggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setVoiceText("");
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleProcessVoice = async () => {
    if (!voiceText) return;
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
      toast.error("AI could not understand the job details. Please try manual posting.");
    } finally {
      setIsProcessingVoice(false);
    }
  };

  const safeSearchQuery = searchQuery.trim().toLowerCase();
  const filteredCategories = categories.filter(cat => 
    cat.name.toLowerCase().includes(safeSearchQuery) ||
    (cat.subcategories && cat.subcategories.some(sub => sub.toLowerCase().includes(safeSearchQuery)))
  );

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
    if (step === 0) {
      navigate(-1);
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
      console.log("Guest user detected, simulating photo capture upload...");
      setTimeout(() => {
        setFormData(prev => ({ ...prev, photos: [...prev.photos, "https://placehold.co/600x400?text=Captured+Photo"] }));
        handleStopCamera();
        setIsUploading(false);
      }, 1000);
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
      
      // Attempt 1: uploadBytesResumable (Best for progress)
      console.log("Attempt 1: uploadBytesResumable...");
      try {
        const url = await new Promise<string>((resolve, reject) => {
          const uploadTask = uploadBytesResumable(storageRef, blob!);
          
          const timeout = setTimeout(() => {
            console.warn("Resumable upload timed out at 0% (30s)");
            uploadTask.cancel();
            reject(new Error("TIMEOUT_0"));
          }, 30000);

          uploadTask.on('state_changed', 
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
              if (progress > 0) {
                clearTimeout(timeout);
                console.log(`Upload started! Progress: ${progress.toFixed(2)}%`);
              }
            }, 
            (error) => {
              clearTimeout(timeout);
              if (error.code === 'storage/canceled') return; 
              if (error.code === 'storage/unauthorized') {
                console.error("STORAGE_PERMISSION_DENIED: Check your Firebase Storage rules.");
              }
              reject(error);
            }, 
            async () => {
              clearTimeout(timeout);
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadUrl);
            }
          );
        });
        
        setFormData(prev => ({ ...prev, photos: [...prev.photos, url] }));
        handleStopCamera();
        return; 
      } catch (err: any) {
        if (err.message !== "TIMEOUT_0") {
          console.error("Resumable upload failed:", err);
        }
      }

      // Attempt 2: uploadBytes (Simpler binary upload)
      console.log("Attempt 2: uploadBytes fallback...");
      try {
        const uploadPromise = uploadBytes(storageRef, blob);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("TIMEOUT_FALLBACK")), 90000)
        );
        
        await Promise.race([uploadPromise, timeoutPromise]);
        const url = await getDownloadURL(storageRef);
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
      console.log("Guest user detected, simulating gallery upload...");
      setTimeout(() => {
        const simulatedUrls = Array.from(files).map((_, i) => `https://placehold.co/600x400?text=Gallery+Photo+${i+1}`);
        setFormData(prev => ({ ...prev, photos: [...prev.photos, ...simulatedUrls] }));
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }, 1000);
      return;
    }

    try {
      const uploadPromises = Array.from(files as FileList).map(async (file: File) => {
        // Basic validation
        if (!file.type.startsWith('image/')) {
          console.warn(`File ${file.name} is not an image, skipping.`);
          return null;
        }

        const fileName = `jobs/${user.uid}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, fileName);
        
        const uploadTask = uploadBytesResumable(storageRef, file);
        
        return new Promise<string>((resolve, reject) => {
          uploadTask.on('state_changed', 
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            }, 
            (error) => reject(error), 
            async () => {
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadUrl);
            }
          );
        });
      });

      const urls = (await Promise.all(uploadPromises)).filter((url): url is string => url !== null);
      setFormData(prev => ({ ...prev, photos: [...prev.photos, ...urls] }));
    } catch (err) {
      console.error("Gallery upload error:", err);
      setError("Failed to upload one or more images. Please try again.");
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

    try {
      const uploadPromises = Array.from(files as FileList).map(async (file: File) => {
        if (file.type !== 'application/pdf') {
          console.warn(`File ${file.name} is not a PDF, skipping.`);
          return null;
        }

        const fileName = `jobs/${user.uid}/docs/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, fileName);
        
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        return { name: file.name, url };
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
        
        console.log("Uploading video to Firebase Storage:", fileName);
        const uploadTask = uploadBytesResumable(storageRef, blob);
        
        const url = await new Promise<string>((resolve, reject) => {
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
              
              // If we timed out, don't reject again
              if (isTimedOut && error.code === 'storage/canceled') {
                console.log("Video task canceled due to timeout.");
                return;
              }
              
              console.error("Video upload task error details:", {
                code: error.code,
                message: error.message,
                name: error.name
              });
              reject(error);
            }, 
            async () => {
              clearTimeout(timeout);
              console.log("Video upload task completed successfully.");
              try {
                const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadUrl);
              } catch (err) {
                console.error("Error getting video download URL:", err);
                reject(err);
              }
            }
          );
        });
        
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
    setIsRefiningScope(true);
    try {
      const questions = await getClarifyingQuestions(formData.category, formData.title, formData.description);
      setClarifyingQuestions(questions);
      setStep(3.5); // Special sub-step
    } catch (err) {
      console.error(err);
      nextStep(); // Skip if fails
    } finally {
      setIsRefiningScope(false);
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

      // Phase 3: PII & Safety Filter
      const safetyResult = await checkSafetyAndPII(formData.description);
      
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

      if (!editJob) {
        const limitResponse = await fetch("/api/check-job-limit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            userId: user.uid,
            isEmergency: formData.urgency === "emergency",
            requestedCount: formData.selectedAssets.length > 0 ? formData.selectedAssets.length : 1
          })
        });
        
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
        suggestedStatus = limitData.suggestedStatus;
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
      
      for (const asset of assetsToPost) {
        const finalJobNo = assetsToPost.length > 1 ? `${jobNo}-${asset.name.replace(/\s+/g, '-').toLowerCase()}` : jobNo;
        const currentJobRef = assetsToPost.length > 1 ? doc(collection(db, "jobs")) : jobRef;
        
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
          securityAlert: securityAlert || formData.securityAlert,
          hasReview: editJob?.hasReview || false,
          estimateMin: estimate?.min || Math.floor(Number(formData.selectedBudget || 0) * 0.9),
          estimateMax: estimate?.max || Math.floor(Number(formData.selectedBudget || 0) * 1.1),
          postedDate: editJob?.postedDate || serverTimestamp(),
          updatedAt: serverTimestamp(),
          quoteCount: editJob?.quoteCount || 0,
          assetId: asset?.id || null,
          assetName: asset?.name || null,
          ...(editJob ? {} : { createdAt: serverTimestamp() })
        };
        
        // Remove selectedAssets from the doc
        const { selectedAssets, ...cleanData } = jobData as any;
        
        if (editJob) {
          await updateDoc(currentJobRef, cleanData);
        } else {
          // Time-Gate leads logic for new jobs
          cleanData.exclusiveUntil = new Date(Date.now() + (formData.urgency === 'emergency' ? 5 : 15) * 60000);
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

      toast.success(assetsToPost.length > 1 ? `Successfully posted ${assetsToPost.length} projects` : "Job posted successfully!");
      navigate(profile?.subscriptionType === "business" ? "/portfolio" : "/my-jobs");
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
            onClick={() => navigate(location.pathname, { state: { ...location.state, targetTradespersonId: null, targetTradespersonName: null } })}
            className="hover:bg-white/10 p-1 rounded transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-30">
        <div className="flex items-center justify-between p-4">
          <button 
            onClick={prevStep} 
            className="text-[#0084a5] font-bold text-lg flex items-center gap-1 hover:opacity-80 transition-opacity"
          >
            Back
          </button>
          
          {step > 0 && (
            <div className="absolute left-1/2 -translate-x-1/2 text-center">
              <p className="text-slate-900 font-black text-lg">Step {step} of 7</p>
            </div>
          )}
          
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>
        
        {step > 0 && (
          <div className="w-full bg-slate-100 h-1">
            <motion.div 
              className="h-full bg-[#0084a5]"
              initial={{ width: 0 }}
              animate={{ width: `${(step / 7) * 100}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-2">
            <X className="w-4 h-4" />
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-slate-700">Get up to 5 quotes from verified local tradespeople</h2>
              </div>

              <button 
                onClick={() => setStep(1)}
                className="w-full p-5 rounded-[2rem] bg-orange-500 text-white font-black text-xl flex items-center justify-center gap-3 shadow-2xl shadow-orange-500/20 active:scale-95 transition-all group"
              >
                Post Job Manually <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Post by Voice */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
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
                
                {isListening || voiceText ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 min-h-[100px]">
                      <p className="text-slate-700 italic">{voiceText || "Listening..."}</p>
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
                          onClick={() => { setVoiceText(""); setIsListening(false); }}
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
                  <button 
                    onClick={handleToggleListening}
                    className="w-full p-3 rounded-xl border-2 border-dashed border-slate-200 text-slate-500 font-bold hover:border-blue-600 hover:text-blue-600 transition-all"
                  >
                    Tap to speak
                  </button>
                )}
              </div>

              {/* Popular Categories */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-slate-900">Popular Categories</h3>
                <div className="grid grid-cols-3 gap-3">
                  {categories.slice(0, 6).map((cat) => {
                    const Icon = iconMap[cat.icon];
                    return (
                      <button
                        key={cat.docId || cat.id}
                        onClick={() => {
                          setFormData({ ...formData, category: cat.name, subcategory: "" });
                          setStep(2);
                        }}
                        className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center gap-2 active:scale-95 transition-transform"
                      >
                        <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">
                          {Icon ? (
                            <Icon className="w-6 h-6 text-orange-500" />
                          ) : (
                            <span className="text-2xl">{cat.icon}</span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-slate-900 text-center leading-tight">{cat.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* How it works */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
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
                          { step: 4, title: "Accept & pay safely", desc: "Escrow protects your payment until complete", icon: ShieldCheck },
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

          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">What type of job is it?</h2>
                <p className="text-slate-500">Select the main trade category</p>
              </div>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Search or describe (e.g. leaky)"
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-300 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-600/20 focus:border-blue-600 bg-white transition-all font-medium placeholder:font-normal"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
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
                        "w-full p-4 rounded-2xl border border-slate-100 bg-white flex items-center justify-between hover:border-blue-600 transition-all shadow-sm active:scale-[0.98]",
                        formData.category === cat.name && "border-blue-600 bg-blue-50"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", formData.category === cat.name ? "bg-blue-600 text-white" : "bg-slate-100 text-blue-600")}>
                          {Icon ? (
                            <Icon className="w-5 h-5" />
                          ) : (
                            <span className="text-xl">{cat.icon}</span>
                          )}
                        </div>
                        <span className="font-bold text-slate-900">{cat.name}</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300" />
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
              className="space-y-6"
            >
              <JobReminder />
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">What specifically do you need?</h2>
                <p className="text-slate-500 text-sm">Select the subcategory for {formData.category}.</p>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                {categories.find(c => c.name === formData.category)?.subcategories.map((sub) => (
                  <button
                    key={`${formData.category}-${sub}`}
                    onClick={() => {
                      setFormData({ ...formData, subcategory: sub });
                      nextStep();
                    }}
                    className={cn(
                      "w-full p-4 rounded-2xl border border-slate-100 bg-white flex items-center justify-between hover:border-blue-600 transition-all shadow-sm active:scale-[0.98]",
                      formData.subcategory === sub && "border-blue-600 bg-blue-50"
                    )}
                  >
                    <span className="font-bold text-slate-700 text-left">{sub}</span>
                    <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <JobReminder />
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">Tell us about the job</h2>
                <p className="text-slate-500 text-sm">Be as descriptive as possible for a better estimate.</p>
              </div>

              {/* Asset Selection for Business Users */}
              {profile?.subscriptionType === "business" && userAssets.length > 0 && (
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-700 block">Select Properties (Optional)</label>
                  <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-2 no-scrollbar">
                    {userAssets.map((asset) => (
                      <button
                        key={asset.id}
                        onClick={() => {
                          const isSelected = formData.selectedAssets.some(a => a.id === asset.id);
                          if (isSelected) {
                            setFormData({ ...formData, selectedAssets: formData.selectedAssets.filter(a => a.id !== asset.id) });
                          } else {
                            setFormData({ ...formData, selectedAssets: [...formData.selectedAssets, asset] });
                          }
                        }}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-xl border transition-all text-left",
                          formData.selectedAssets.some(a => a.id === asset.id)
                            ? "border-blue-600 bg-blue-50"
                            : "border-slate-100 bg-white hover:border-slate-200"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            formData.selectedAssets.some(a => a.id === asset.id) ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-400"
                          )}>
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{asset.name}</p>
                            <p className="text-[10px] text-slate-500">{asset.address}</p>
                          </div>
                        </div>
                        {formData.selectedAssets.some(a => a.id === asset.id) && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                      </button>
                    ))}
                  </div>
                  {formData.selectedAssets.length > 1 && (
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex gap-2">
                      <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-700">
                        Posting to <strong>{formData.selectedAssets.length}</strong> properties will count as <strong>{formData.selectedAssets.length}</strong> posts towards your allowance.
                      </p>
                    </div>
                  )}
                </div>
              )}
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
                  <label className="text-sm font-bold text-slate-700">Job Title</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Fix leaking kitchen tap"
                    className={cn(
                      "w-full p-4 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 bg-white",
                      titleError ? "border-red-500" : "border-slate-200"
                    )}
                    value={formData.title}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData({ ...formData, title: value });
                      if (value.length > 0 && value.length < 3) {
                        setTitleError("Title must be at least 3 characters long");
                      } else {
                        setTitleError("");
                      }
                    }}
                  />
                  {titleError && <p className="text-red-500 text-xs mt-1">{titleError}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700">Description</label>
                  <div className="relative">
                    <textarea 
                      rows={4}
                      placeholder="Describe the issue, any specific parts needed, and the current state..."
                      className="w-full p-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 resize-none bg-white"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700">Estimated Completion Time (Optional)</label>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      placeholder="e.g. 4"
                      className="w-24 p-4 rounded-2xl border-2 border-slate-300 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-600/20 focus:border-blue-600 bg-white transition-all font-medium placeholder:font-normal"
                      value={formData.estimatedCompletionTime}
                      onChange={(e) => setFormData({ ...formData, estimatedCompletionTime: e.target.value })}
                    />
                    <select 
                      className="w-32 p-4 rounded-2xl border-2 border-slate-300 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-600/20 focus:border-blue-600 bg-white font-bold text-slate-700 transition-all font-medium"
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
                      className="w-full p-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 bg-white font-bold text-slate-700"
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
                      className="w-full p-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 bg-white font-bold text-slate-700"
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
              className="space-y-6"
            >
              <JobReminder />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  <h2 className="text-2xl font-bold text-slate-900">Refine your job post</h2>
                </div>
                <p className="text-slate-500 text-sm">AI has generated a few questions to help tradespeople give you more accurate quotes.</p>
              </div>

              <div className="space-y-6">
                {clarifyingQuestions.map((question, idx) => (
                  <div key={idx} className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">{question}</label>
                    <textarea 
                      rows={2}
                      placeholder="Your answer..."
                      className="w-full p-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 resize-none bg-white"
                      value={clarifyingAnswers[question] || ""}
                      onChange={(e) => setClarifyingAnswers(prev => ({ ...prev, [question]: e.target.value }))}
                    />
                  </div>
                ))}
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
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">Where is the job?</h2>
                <p className="text-slate-500 text-sm">Help tradespeople find your location.</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-4">
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                      className="w-full p-4 pl-12 pr-12 rounded-2xl border-2 border-slate-300 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-600/20 focus:border-blue-600 bg-white transition-all font-medium placeholder:font-normal"
                      placeholder="Start typing your address or postcode..."
                      value={addressInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAddressInput(val);
                        setUseRegisteredAddress(false);
                        
                        if (addressSuggestionTimeout) clearTimeout(addressSuggestionTimeout);
                        
                        if (!val || val.length < 2 || !window.google) {
                          setAddressSuggestions([]);
                          return;
                        }
                        
                        const timeout = setTimeout(async () => {
                          try {
                            const { AutocompleteSuggestion } = await google.maps.importLibrary("places") as any;
                            const request = {
                              input: val,
                              includedRegionCodes: ['gb']
                            };
                            
                            const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
                            
                            if (suggestions && suggestions.length > 0) {
                              setAddressSuggestions(suggestions.map((p: any) => ({
                                label: p.placePrediction.text.text,
                                placeId: p.placePrediction.placeId,
                                placePrediction: p.placePrediction
                              })));
                            } else {
                              setAddressSuggestions([]);
                            }
                          } catch (err) {
                            console.error(err);
                            setAddressSuggestions([]);
                          }
                        }, 500);
                        setAddressSuggestionTimeout(timeout);
                      }}
                      onBlur={async (e) => {
                        const val = e.target.value;
                        if (!val || addressSuggestions.length > 0) return;
                        if (useRegisteredAddress) return;
                        try {
                          const data = await lookupPostcode(val);
                          if (data) {
                            setFormData(prev => ({ 
                              ...prev, 
                              city: data.city,
                              area: data.area,
                              postcode: data.postcode,
                              fullAddress: data.postcode
                            }));
                          }
                        } catch (err) {
                          console.error("Error looking up postcode:", err);
                        }
                      }}
                    />
                    
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
                      title="Auto-detect location"
                      onClick={() => {
                        if ("geolocation" in navigator) {
                          navigator.geolocation.getCurrentPosition(async (position) => {
                            try {
                              const { latitude: lat, longitude: lng } = position.coords;
                              const geocoder = new google.maps.Geocoder();
                              geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                                if (status === "OK" && results?.[0]) {
                                  const foundAddress = results[0].formatted_address;
                                  setAddressInput(foundAddress);
                                  setFormData(prev => ({ ...prev, fullAddress: foundAddress }));
                                  
                                  let newCity = "";
                                  let newArea = "";
                                  let newPostcode = "";

                                  results[0].address_components.forEach((comp) => {
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
                              });
                            } catch (err) {
                              console.error("Geocoding failed:", err);
                            }
                          });
                        }
                      }}
                    >
                      <Locate className="w-5 h-5" />
                    </button>
                    
                    {addressSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 max-h-64 overflow-y-auto z-50">
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

                                    place.addressComponents.forEach((comp: any) => {
                                      if (comp.types.includes("postal_town") || comp.types.includes("locality")) newCity = comp.longText;
                                      if (comp.types.includes("sublocality") || comp.types.includes("neighborhood")) newArea = comp.longText;
                                      if (comp.types.includes("postal_code")) newPostcode = comp.longText;
                                    });

                                    if (!newPostcode) {
                                      const pcMatch = suggestion.label.match(/[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}/i);
                                      newPostcode = pcMatch ? pcMatch[0] : "";
                                    }

                                    setFormData(prev => ({
                                      ...prev,
                                      city: newCity || prev.city,
                                      area: newArea || prev.area,
                                      postcode: newPostcode
                                    }));
                                  }
                                } catch (err) {
                                  console.error(err);
                                }
                              }
                            }}
                            className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 flex items-center gap-3"
                          >
                            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="text-sm text-slate-700">{suggestion.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    {formData.fullAddress && (
                      <div 
                        className={cn("flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors", !useRegisteredAddress ? "border-blue-200 bg-blue-50/50" : "border-slate-200 hover:bg-slate-50")}
                        onClick={() => setUseRegisteredAddress(false)}
                      >
                        <div className={cn("w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors", !useRegisteredAddress ? "border-blue-600 border-4 bg-white" : "border-slate-300 bg-white")}></div>
                        <div>
                          <div className="font-bold text-sm text-slate-900">Use selected address</div>
                          <div className="text-xs text-slate-600">
                            {formData.fullAddress}
                          </div>
                        </div>
                      </div>
                    )}

                    {profile?.postcode && (
                      <div 
                        className={cn("flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors", useRegisteredAddress ? "border-blue-200 bg-blue-50/50" : "border-slate-200 hover:bg-slate-50")}
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
                      >
                        <div className={cn("w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors", useRegisteredAddress ? "border-blue-600 border-4 bg-white" : "border-slate-300 bg-white")}></div>
                        <div>
                          <div className="font-bold text-sm text-slate-900">Use my registered address</div>
                          <div className="text-xs text-slate-600">
                            {profile.postcode} {profile.city ? `, ${profile.city}` : ''}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700">House Number / Flat / Building Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 42 or Flat 3B"
                    className="w-full p-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 bg-white"
                    value={formData.houseNumber}
                    onChange={(e) => setFormData({ ...formData, houseNumber: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700">Location Instructions (Optional)</label>
                  <textarea 
                    placeholder="Any specific instructions for finding you? (e.g., Use side gate, park on driveway, ring doorbell twice)"
                    className="w-full p-4 rounded-2xl border-2 border-slate-300 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-600/20 focus:border-blue-600 bg-white resize-none h-24 transition-all font-medium placeholder:font-normal"
                    value={formData.locationInstructions}
                    onChange={(e) => setFormData({ ...formData, locationInstructions: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700">City (Auto-filled)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Manchester"
                    className="w-full p-4 rounded-2xl border-2 border-slate-300 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-600/20 focus:border-blue-600 bg-slate-50 transition-all font-medium placeholder:font-normal"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          async (position) => {
                            try {
                              const { latitude, longitude } = position.coords;
                              const data = await reverseLookupPostcode(latitude, longitude);
                              if (data) {
                                setFormData(prev => ({ 
                                  ...prev, 
                                  city: data.city,
                                  area: data.area,
                                  postcode: data.postcode
                                }));
                                
                                if (window.google) {
                                  const geocoder = new window.google.maps.Geocoder();
                                  geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
                                    if (status === "OK" && results?.[0]) {
                                      setAddressInput(results[0].formatted_address);
                                      setFormData(prev => ({ ...prev, fullAddress: results[0].formatted_address }));
                                    }
                                  });
                                }
                              }
                            } catch (err) {
                              console.error("Error reverse geocoding:", err);
                              setFormData(prev => ({ ...prev, city: "Detected Location" }));
                            }
                          },
                          (error) => console.error(error)
                        );
                      }
                    }}
                    className="w-full p-4 rounded-2xl border border-slate-200 bg-white text-slate-700 font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all"
                  >
                    <MapPin className="w-5 h-5" /> Use Current Location
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <JobReminder />
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">When do you need it?</h2>
                <p className="text-slate-500 text-sm">Urgency affects the pricing and availability.</p>
              </div>
              {formData.urgency === "emergency" && (
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold text-red-800">Priority Emergency Post</h4>
                    <p className="text-sm text-red-700 mb-2">This post is exempt from your monthly allowance.</p>
                    <p className="text-sm text-red-700">
                      {formData.category === "Plumbing" ? "Turn off your main water valve immediately." : 
                       formData.category === "Electrical" ? "Turn off your main power switch." : 
                       "Ensure your safety first and stay clear of the area."}
                    </p>
                  </div>
                </div>
              )}
              <div className="space-y-3">
                {URGENCY_LEVELS.filter(level => !targetTradespersonId || level.id !== "emergency").map((level) => (
                  <button
                    key={level.id}
                    onClick={() => setFormData({ ...formData, urgency: level.id })}
                    className={cn(
                      "w-full p-5 rounded-2xl border border-slate-100 bg-white flex items-center justify-between hover:border-blue-600 transition-all shadow-sm active:scale-[0.98]",
                      formData.urgency === level.id && "border-blue-600 bg-blue-50"
                    )}
                  >
                    <div className="text-left">
                      <p className="font-bold text-slate-900">{level.name}</p>
                      <p className="text-xs text-slate-500">{level.description}</p>
                    </div>
                    {formData.urgency === level.id && <CheckCircle2 className="w-6 h-6 text-blue-600" />}
                  </button>
                ))}

                {formData.urgency === "specific_date" && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="pt-2"
                  >
                    <label className="text-sm font-bold text-slate-700 block mb-2">Select Date</label>
                    <input 
                      type="date" 
                      className="w-full p-4 rounded-2xl border-2 border-slate-300 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-600/20 focus:border-blue-600 bg-white transition-all font-medium placeholder:font-normal"
                      value={formData.jobDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setFormData({ ...formData, jobDate: e.target.value })}
                    />
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {step === 6 && (
            <motion.div
              key="step6"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <JobReminder />
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">Add photos & videos (Optional)</h2>
                <p className="text-slate-500 text-sm">Visuals help tradespeople give more accurate quotes.</p>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => handleStartCamera("photo")}
                    className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border border-slate-100 bg-white hover:border-blue-600 transition-all font-bold text-slate-700 shadow-sm active:scale-95"
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                      <Camera className="w-6 h-6 text-blue-600" />
                    </div>
                    Take Photo
                  </button>
                  <button 
                    onClick={() => handleStartCamera("video")}
                    className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border border-slate-100 bg-white hover:border-blue-600 transition-all font-bold text-slate-700 shadow-sm active:scale-95"
                  >
                    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                      <Video className="w-6 h-6 text-red-600" />
                    </div>
                    Record Video
                  </button>
                </div>
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border border-slate-100 bg-white hover:border-blue-600 transition-all font-bold text-slate-700 shadow-sm active:scale-95"
                >
                  <ImageIcon className="w-5 h-5 text-purple-600" />
                  Upload from Gallery
                </button>

                <button 
                  onClick={() => docInputRef.current?.click()}
                  disabled={isUploadingDoc}
                  className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border border-slate-100 bg-white hover:border-blue-600 transition-all font-bold text-slate-700 shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {isUploadingDoc ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5 text-indigo-600" />}
                  Attach Plans / Drawings (PDF)
                </button>

                {formData.documents.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-400 uppercase">Attached Documents</p>
                    <div className="space-y-2">
                      {formData.documents.map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span className="text-sm text-slate-700 truncate font-medium">{doc.name}</span>
                          </div>
                          <button 
                            onClick={() => setFormData(prev => ({ ...prev, documents: prev.documents.filter((_, i) => i !== idx) }))}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <input 
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
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

                {formData.photos.length > 0 && !aiDiagnosis && (
                  <button 
                    onClick={handleAnalyzePhoto}
                    disabled={isAnalyzingPhoto}
                    className="w-full p-4 rounded-2xl bg-blue-50 border border-blue-100 text-blue-700 font-bold flex items-center justify-center gap-2 hover:bg-blue-100 transition-all disabled:opacity-50"
                  >
                    {isAnalyzingPhoto ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                    Analyze Photos with AI
                  </button>
                )}

                {aiDiagnosis && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 rounded-2xl bg-blue-600 text-white space-y-3 shadow-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      <h4 className="font-bold">AI Diagnosis</h4>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs opacity-80 font-bold uppercase">Suggested Category</p>
                      <p className="font-bold text-lg">{aiDiagnosis.category}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs opacity-80 font-bold uppercase">Urgency Level</p>
                      <p className="font-bold">{aiDiagnosis.urgency}</p>
                    </div>
                    <p className="text-sm opacity-90 italic">"{aiDiagnosis.reasoning}"</p>
                    <button 
                      onClick={applyAiDiagnosis}
                      className="w-full p-3 rounded-xl bg-white text-blue-600 font-bold hover:bg-blue-50 transition-all"
                    >
                      Apply Suggestions
                    </button>
                  </motion.div>
                )}

                {/* Preview Grid */}
                {(formData.photos.length > 0 || formData.videos.length > 0) && (
                  <div className="grid grid-cols-3 gap-3 pt-4">
                    {formData.photos.map((url, i) => (
                      <div key={`photo-${i}`} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 group shadow-sm">
                        <img src={url} alt={`Job photo ${i + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button 
                          onClick={() => setFormData({ ...formData, photos: formData.photos.filter((_, idx) => idx !== i) })}
                          className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {formData.videos.map((url, i) => (
                      <div key={`video-${i}`} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 group bg-slate-900 flex items-center justify-center shadow-sm">
                        <video src={url} className="w-full h-full object-cover opacity-60" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity bg-black/40">
                          <button 
                            onClick={() => {
                              setFormData(prev => ({ ...prev, videos: prev.videos.filter((_, idx) => idx !== i) }));
                              handleStartCamera("video");
                            }}
                            className="bg-white text-blue-600 p-2 rounded-full shadow-lg hover:bg-blue-50 transition-colors"
                            title="Re-record Video"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setFormData(prev => ({ ...prev, videos: prev.videos.filter((_, idx) => idx !== i) }))}
                            className="bg-white text-red-600 p-2 rounded-full shadow-lg hover:bg-red-50 transition-colors"
                            title="Delete Video"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="absolute bottom-2 left-2 bg-black/50 text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">
                          Video {i + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
            </motion.div>
          )}

          {step === 7 && (
            <motion.div
              key="step7"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <JobReminder />
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">AI Price Guide</h2>
                <p className="text-slate-500 text-sm">A rough estimate to help you set your budget.</p>
              </div>               {isEstimating ? (
                <div className="bg-white rounded-3xl p-12 border border-slate-100 shadow-sm flex flex-col items-center justify-center space-y-4">
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
                    <div className="bg-amber-50 rounded-3xl p-8 text-amber-900 border border-amber-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles className="w-6 h-6 text-amber-500" />
                        <h3 className="text-xl font-black">AI Estimate Unavailable</h3>
                      </div>
                      <p className="text-amber-800 font-medium leading-relaxed">
                        {estimate.unavailableReason || "This job requires more specific details or a site visit for an accurate estimate."}
                      </p>
                      <p className="text-amber-700 text-sm mt-4">
                        Tradespeople will need to assess this job directly to provide a quote. You can still enter a custom budget below if you have one in mind.
                      </p>
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
                      
                      <div className="bg-white/10 rounded-xl p-4 mt-4 border border-white/20">
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
                            : "bg-white/20 hover:bg-white/30 text-white border border-white/30"
                        )}
                      >
                        {formData.selectedBudget === `£${estimate.min} - £${estimate.max}` ? "Selected" : "Set as My Budget"}
                      </button>
                    </div>
                  )}

                  <div className="space-y-4 bg-slate-100/50 p-6 rounded-3xl border border-slate-100">
                    <h3 className="text-xl font-black text-slate-900">Or enter custom amount</h3>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-900 font-black text-xl">£</span>
                      <input
                        type="number"
                        placeholder="0.00"
                        className="w-full p-5 pl-12 rounded-2xl border-2 border-white bg-white font-black text-xl focus:outline-none focus:ring-4 focus:ring-[#0084a5]/10 focus:border-[#0084a5] transition-all"
                        value={formData.selectedBudget && formData.selectedBudget !== `£${estimate?.min} - £${estimate?.max}` ? formData.selectedBudget : ""}
                        onChange={(e) => setFormData({...formData, selectedBudget: e.target.value})}
                      />
                    </div>
                  </div>

                  {estimate.isAvailable !== false && (
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
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
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                              <p className="text-sm text-slate-600 leading-relaxed italic">
                                "{estimate.reasoning}"
                              </p>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                              <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-white">
                                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                                  <Box className="w-4 h-4 text-orange-600" />
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Materials</p>
                                  <p className="text-xs text-slate-700 font-medium">{estimate.breakdown.materials}</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-white">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                  <Wrench className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Labour</p>
                                  <p className="text-xs text-slate-700 font-medium">{estimate.breakdown.labour}</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-white">
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
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="p-6 space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                              <BarChart3 className="w-5 h-5 text-indigo-600" />
                            </div>
                            Dynamic Pricing Insights
                          </h3>
                          <div className={cn(
                            "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                            estimate.pricingInsights.marketTrend === "rising" ? "bg-red-50 text-red-600" :
                            estimate.pricingInsights.marketTrend === "falling" ? "bg-green-50 text-green-600" :
                            "bg-slate-50 text-slate-600"
                          )}>
                            {estimate.pricingInsights.marketTrend === "rising" && <TrendingUp className="w-3 h-3" />}
                            {estimate.pricingInsights.marketTrend === "falling" && <TrendingDown className="w-3 h-3" />}
                            {estimate.pricingInsights.marketTrend === "stable" && <Minus className="w-3 h-3" />}
                            Market: {estimate.pricingInsights.marketTrend}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-amber-600" />
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Seasonal Impact</h4>
                            </div>
                            <p className="text-xs text-slate-700 font-medium leading-relaxed">
                              {estimate.pricingInsights.seasonalImpact}
                            </p>
                          </div>

                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-blue-600" />
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Regional Premium</h4>
                            </div>
                            <p className="text-xs text-slate-700 font-medium leading-relaxed">
                              {estimate.pricingInsights.regionalPremium}
                            </p>
                          </div>
                        </div>

                        <div className="bg-green-50/50 p-5 rounded-2xl border border-green-100 space-y-3">
                          <div className="flex items-center gap-2">
                            <ZapIcon className="w-4 h-4 text-green-600" />
                            <h4 className="text-[10px] font-black text-green-800 uppercase tracking-widest">Cost Saving Tips</h4>
                          </div>
                          <ul className="space-y-2">
                            {estimate.pricingInsights.costSavingTips.map((tip, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-green-800 font-medium">
                                <div className="w-1 h-1 rounded-full bg-green-400 mt-1.5 shrink-0" />
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
                  <div className="flex flex-col items-center text-center space-y-2">
                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-2">
                      <AlertTriangle className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Estimate Unavailable</h3>
                    <p className="text-slate-500 text-sm">We couldn't generate an AI estimate right now. You can still set your budget manually.</p>
                  </div>
                  
                  <div className="space-y-4 bg-slate-100/50 p-6 rounded-3xl border border-slate-100">
                    <h3 className="text-xl font-black text-slate-900">Enter custom amount</h3>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-900 font-black text-xl">£</span>
                      <input
                        type="number"
                        placeholder="0.00"
                        className="w-full p-5 pl-12 rounded-2xl border-2 border-white bg-white font-black text-xl focus:outline-none focus:ring-4 focus:ring-[#0084a5]/10 focus:border-[#0084a5] transition-all"
                        value={formData.selectedBudget || ""}
                        onChange={(e) => setFormData({...formData, selectedBudget: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              )}
              </motion.div>
            )}
        </AnimatePresence>
      </div>

      {/* Sticky Navigation Footer */}
      {step !== 0 && (
        <div className="fixed bottom-4 sm:bottom-0 left-4 right-4 p-4 bg-white/95 backdrop-blur-xl border border-slate-100 rounded-2xl z-40 sm:static sm:bg-transparent sm:border-0 sm:p-0 sm:mt-10 shadow-2xl">
          <div className="max-w-2xl mx-auto flex gap-3">
            {step > 0 && (
              <button 
                onClick={prevStep} 
                className="flex-[1] p-4 rounded-2xl border-2 border-slate-100 font-black text-slate-600 hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center"
              >
                Back
              </button>
            )}
            
            {step === 1 || step === 2 ? (
              <div className="flex-[3] py-4 px-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{step === 1 ? "Category Selection" : "Subcategory Selection"}</p>
              </div>
            ) : step === 3 ? (
            <div className="flex-[3] flex gap-3">
              <button 
                onClick={handleGetRefinement} 
                disabled={!formData.title || formData.title.length < 3 || !formData.description || isRefiningScope}
                id="wizard-next-step-3"
                className={cn(
                  "flex-[2] p-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all",
                  (formData.title && formData.title.length >= 3 && formData.description)
                    ? "bg-orange-500 text-white shadow-xl shadow-orange-500/20 active:scale-95" 
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                )}
              >
                {isRefiningScope ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Continue <ChevronRight className="w-6 h-6" /></>}
              </button>
            </div>
          ) : step === 3.5 ? (
            <div className="flex-[3] flex gap-3">
              <button 
                onClick={() => {
                  setClarifyingAnswers({});
                  setStep(4);
                }}
                className="flex-1 p-4 rounded-2xl border-2 border-slate-100 font-bold text-slate-500 hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                Skip 
              </button>
              <button 
                onClick={() => setStep(4)}
                id="wizard-next-step-3-5"
                className="flex-[2] p-4 rounded-2xl bg-orange-500 text-white font-black flex items-center justify-center gap-2 shadow-xl shadow-orange-500/20 active:scale-95 transition-all"
              >
                Continue <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          ) : step === 4 ? (
            <div className="flex-[3] flex gap-3">
              <button 
                onClick={nextStep} 
                disabled={!formData.city || !formData.postcode || !!postcodeError}
                id="wizard-next-step-4"
                className={cn(
                  "flex-[2] p-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all",
                  (formData.city && formData.postcode && !postcodeError)
                    ? "bg-orange-500 text-white shadow-xl shadow-orange-500/20 active:scale-95" 
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                )}
              >
                Continue <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          ) : step === 5 ? (
            <div className="flex-[3] flex gap-3">
              <button 
                onClick={nextStep} 
                id="wizard-next-step-5"
                className="flex-[2] p-4 rounded-2xl bg-orange-500 text-white font-black flex items-center justify-center gap-2 shadow-xl shadow-orange-500/20 active:scale-95 transition-all"
              >
                Continue <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          ) : step === 6 ? (
            <div className="flex-[3] flex gap-3">
              <button 
                onClick={nextStep} 
                disabled={isUploading}
                id="wizard-next-step-6"
                className="flex-[2] p-4 rounded-2xl bg-[#0084a5] text-white font-black flex items-center justify-center gap-2 shadow-xl shadow-cyan-500/20 active:scale-95 transition-all"
              >
                {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Continue to Estimate <ChevronRight className="w-6 h-6" /></>}
              </button>
            </div>
          ) : step === 7 ? (
            <div className="flex-[3] flex gap-3">
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting || (!estimate && !formData.selectedBudget)}
                id="wizard-next-step-7"
                className="flex-[2] p-4 rounded-2xl bg-orange-500 text-white font-black flex items-center justify-center gap-2 shadow-xl shadow-orange-500/20 disabled:opacity-50 transition-all active:scale-95"
              >
                {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Post your job <CheckCircle2 className="w-6 h-6" /></>}
              </button>
            </div>
          ) : null}
        </div>
        
        {step === 7 && error && (
          <div className="max-w-2xl mx-auto mt-4 px-4">
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-2">
              <X className="w-4 h-4" />
              {error}
            </div>
          </div>
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
                  className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center group disabled:opacity-50"
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
                    isRecording ? "border-red-600" : "border-white"
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

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

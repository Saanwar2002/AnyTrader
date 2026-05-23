import React, { useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronRight, X, AlertTriangle, MapPin, Camera, Image as ImageIcon, Loader2, Zap, CreditCard, Lock, Locate, Info, Sparkles, CheckCircle2 } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { TRADE_CATEGORIES } from "@/src/constants";
import { lookupPostcode } from "@/src/services/postcodeService";
import { db, collection, serverTimestamp, doc, setDoc, OperationType, handleFirestoreError, storage, ref, uploadBytesResumable, getDownloadURL, uploadBytes, uploadString, getDoc, getDocs, query, where } from "@/src/firebase";
import { distributeJobNotifications } from "@/src/services/notificationService";
import { useAuth } from "./AuthProvider";
import { AnimatePresence, motion } from "framer-motion";
import { useJsApiLoader } from "@react-google-maps/api";
import { getInstantMatchCopy } from "@/src/lib/boosts";

const libraries: any[] = ['places'];

export default function EmergencyJobWizard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const targetTradespersonId = (location.state as any)?.targetTradespersonId;
  const targetTradespersonName = (location.state as any)?.targetTradespersonName;
  const targetTrades = (location.state as any)?.targetTrades;
  
  const [step, setStep] = useState(1);
  const [addressInput, setAddressInput] = useState("");
  const [formData, setFormData] = useState({
    category: "",
    description: "",
    postcode: "",
    city: "",
    area: "",
    county: "",
    fullAddress: "",
    mobileNumber: "",
    urgency: "emergency",
    photos: [] as string[]
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isEmergencyBoost, setIsEmergencyBoost] = useState(false);
  const [isInstantMatch, setIsInstantMatch] = useState(false);
  const [showBoostInfo, setShowBoostInfo] = useState<"emergency" | "instant" | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [platformConfig, setPlatformConfig] = useState<any>(null);
  const [instantMatchCopy, setInstantMatchCopy] = useState<any>(getInstantMatchCopy(formData.category || ""));

  React.useEffect(() => {
    if (step === 2 && formData.category && formData.description) {
      import("@/src/services/gemini").then((gemini) => {
        gemini.getDynamicInstantMatchPricing(formData.category, "Emergency Request", formData.description)
        .then(res => {
           if (res) {
             setInstantMatchCopy({
               price: res.price,
               title: res.title,
               desc: res.desc,
               bullets: res.bullets.map((b: any) => ({ ...b, icon: Sparkles, color: "text-amber-500" })) // Sparkles imported
             });
           }
        });
      });
    }
  }, [step, formData.category, formData.description]);

  const [addressSuggestions, setAddressSuggestions] = useState<Array<{label: string, placeId: string, placePrediction: any}>>([]);
  const [addressSuggestionTimeout, setAddressSuggestionTimeout] = useState<NodeJS.Timeout | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [useRegisteredAddress, setUseRegisteredAddress] = useState(false);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.() && (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY_ANDROID) || (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
    version: "quarterly"
  });

  React.useEffect(() => {
    import("@/src/firebase").then(({ onSnapshot, doc, db }) => {
      const unsub = onSnapshot(doc(db, "platform_config", "global"), (docSnapshot) => {
        if (docSnapshot.exists()) {
          setPlatformConfig(docSnapshot.data());
        }
      });
      return () => unsub();
    });
  }, []);

  React.useEffect(() => {
    if (!user) return;
    const fetchUser = async () => {
      const uDoc = await getDoc(doc(db, "users", user.uid));
      if (uDoc.exists()) {
        const data = uDoc.data();
        setUserProfile(data);
        if (data.postcode) {
          setUseRegisteredAddress(true);
          setFormData(prev => ({
            ...prev,
            postcode: prev.postcode || data.postcode,
            city: prev.city || data.city || "",
            area: prev.area || data.area || "",
            county: prev.county || data.county || "",
            fullAddress: prev.fullAddress || data.postcode
          }));
        }
      }
    };
    fetchUser();
  }, [user]);

  const filteredCategories = TRADE_CATEGORIES.filter(cat => {
    const matchesSearch = cat.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTargetTrades = targetTrades && Array.isArray(targetTrades) && targetTrades.length > 0
      ? targetTrades.includes(cat.name)
      : true;
    return matchesSearch && matchesTargetTrades;
  });

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    console.log("handleGalleryUpload: files count:", files?.length, "user:", user?.uid);
    if (!files || files.length === 0 || !user) {
      console.error("handleGalleryUpload: missing files or user");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError("");

    if (user.isAnonymous) {
      console.log("Guest user detected, simulating upload...");
      setTimeout(() => {
        const simulatedUrls = Array.from(files).map((_, i) => `https://placehold.co/600x400?text=Emergency+Photo+${i+1}`);
        setFormData(prev => ({ ...prev, photos: [...prev.photos, ...simulatedUrls] }));
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }, 1500);
      return;
    }

    try {
      const uploadPromises = Array.from(files as FileList).map(async (file: File) => {
        if (!file.type.startsWith('image/')) {
          console.warn(`File ${file.name} is not an image, skipping.`);
          return null;
        }

        const fileName = `jobs/${user.uid}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, fileName);
        console.log("Attempting upload to:", storageRef.fullPath, "Bucket:", storage.app.options.storageBucket);

        // Attempt 1: Resumable Upload
        console.log("Attempt 1: uploadBytesResumable...");
        try {
          const arrayBuffer = await file.arrayBuffer();
          const uploadTask = uploadBytesResumable(storageRef, arrayBuffer, { contentType: file.type });
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => { uploadTask.cancel(); reject(new Error("TIMEOUT_RESUMABLE")); }, 90000);
            uploadTask.on('state_changed', 
              (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
              (error) => { clearTimeout(timeout); reject(error); },
              () => { clearTimeout(timeout); resolve(); }
            );
          });
          return await getDownloadURL(storageRef);
        } catch (err) {
          console.error("Attempt 1 failed:", err);
          throw err; // Rethrow to trigger catch block
        }
      });

      const results = await Promise.all(uploadPromises);
      const urls = results.filter((url): url is string => url !== null);
      
      setFormData(prev => ({ ...prev, photos: [...prev.photos, ...urls] }));
    } catch (err) {
      console.error("Gallery upload error:", err);
      setError("Failed to upload one or more images. Please check your internet connection or permissions.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleInitialSubmit = () => {
    if (!formData.description.trim() || !formData.postcode.trim() || !formData.mobileNumber.trim()) {
      setError("Please fill in all fields to post your emergency job.");
      return;
    }
    if (isEmergencyBoost || isInstantMatch) {
      setShowCheckout(true);
    } else {
      handleSubmit(false);
    }
  };

  // Modifies handleSubmit to return the job ID so we can pass it to Stripe
  const handleSubmit = async (isPaidOption: boolean): Promise<string | void> => {
    if (!user) return;
    
    setError("");
    
    try {
      let finalCity = formData.city;
      let finalArea = formData.area;
      let finalCounty = formData.county;
      let finalPostcode = formData.postcode;

      // Safety net: lookup location if city is missing
      if (!finalCity && formData.postcode) {
        const data = await lookupPostcode(formData.postcode);
        if (data) {
          finalCity = data.city;
          finalArea = data.area;
          finalCounty = data.county;
          finalPostcode = data.postcode;
        }
      }

      // 4 hours if boosted, 2 hours if free
      const expiryHours = isPaidOption ? 4 : 2;
      const boostExpiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

      let jobStatus = "posted";
      let securityAlert = "";

      // Check for duplicate account/device
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.data();
      if (userData?.deviceId) {
        const usersSnapshot = await getDocs(query(collection(db, "users"), where("deviceId", "==", userData.deviceId)));
        if (usersSnapshot.size > 1) {
          console.warn("Potential duplicate account detected for device:", userData.deviceId);
          jobStatus = "pending_admin_review";
          securityAlert = "Potential duplicate account detected";
        }
      }

      const currentBoostTier = isPaidOption ? (isInstantMatch ? "instant_match" : "emergency_boost") : null;

      // Create the document with a specific ID
      const jobRef = doc(collection(db, "jobs"));
      await setDoc(jobRef, {
        id: jobRef.id,
        homeownerId: user.uid,
        category: formData.category,
        title: `Emergency ${formData.category} Job`,
        description: formData.description,
        postcode: finalPostcode,
        city: finalCity,
        area: finalArea,
        county: finalCounty,
        status: jobStatus,
        securityAlert: securityAlert || null,
        urgency: "emergency",
        hasReview: false,
        photos: formData.photos,
        postedDate: serverTimestamp(),
        createdAt: serverTimestamp(),
        exclusiveUntil: new Date(Date.now() + 5 * 60000),
        paymentPreference: "negotiable",
        quoteScope: "complete_package",
        isBoosted: isPaidOption,
        boostTier: currentBoostTier,
        boostExpiresAt,
        retryCount: 0
      });
      
      // Simulate auto-picking and notifying traders
      console.log("Notifying relevant traders for job:", jobRef.id);
      await distributeJobNotifications(
        jobRef.id,
        formData.category,
        formData.postcode,
        "emergency",
        isPaidOption
      );
      
      try {
        // Send urgent SMS via Backend Extension Queue
        const smsRef = doc(collection(db, "sms_queue"));
        await setDoc(smsRef, {
          toRole: "tradesperson",
          category: formData.category,
          jobId: jobRef.id,
          message: `EMERGENCY ALERT: New ${formData.category} job near you. Accept within 5 mins to claim.`,
          status: "pending",
          createdAt: serverTimestamp()
        });
      } catch (smsErr) {
        console.error("Failed to send urgent SMS:", smsErr);
      }
      
      if (!isPaidOption) {
        navigate("/my-jobs");
      }
      return jobRef.id;
    } catch (err) {
      console.error("Error posting emergency job:", err);
      handleFirestoreError(err, OperationType.WRITE, "jobs");
    }
  };

  const handlePayment = async () => {
    setIsProcessingPayment(true);
    try {
      // Create job first as non-boosted so we have an ID
      const jobId = await handleSubmit(false);
      if (!jobId) {
        setIsProcessingPayment(false); 
        return;
      }

      // Initiate Stripe Checkout for boost
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.uid,
          priceId: "price_mock_boost",
          mode: "payment",
          metadata: {
            type: "boost",
            jobId: jobId
          },
          successUrl: `${window.location.origin}/job/${jobId}?boost_success=true`,
          cancelUrl: `${window.location.origin}/job/${jobId}`
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to initiate checkout");
      }
    } catch (err: any) {
      console.error("Checkout init failed:", err);
      alert(err.message || "Failed to start checkout. Your job was still posted.");
      setIsProcessingPayment(false);
      setShowCheckout(false);
      navigate("/my-jobs");
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-red-50/20 min-h-screen p-4 pb-48 border-x border-red-50">
      <div className="flex items-center justify-between mb-4 bg-red-50 p-4 rounded-2xl border border-red-100">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          <h1 className="text-xl font-bold text-slate-900">Emergency Job</h1>
        </div>
        <button onClick={() => navigate(-1)} className="p-2 bg-white hover:bg-slate-100 rounded-full border border-red-100 transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
      </div>

      {/* Target Tradesperson Indicator */}
      {targetTradespersonId && (
        <div className="bg-blue-600 text-white px-4 py-2 mb-4 rounded-xl flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 flex items-center justify-center shrink-0">👤</span>
            <span>Requesting emergency quote from: {targetTradespersonName}</span>
          </div>
          <button 
            onClick={() => navigate(location.pathname, { state: { ...location.state, targetTradespersonId: null, targetTradespersonName: null, targetTrades: null } })}
            className="hover:bg-white/10 p-1 rounded transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="mb-4 flex items-center justify-between">
          <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
            {formData.category}
          </div>
          <button 
            onClick={() => setStep(1)}
            className="text-sm text-slate-500 hover:text-slate-900 font-medium"
          >
            ← Back
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">What is the emergency?</h2>
          <input 
            type="text"
            className="w-full p-4 border border-black rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            placeholder="Search category (e.g. Plumbing)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            {filteredCategories.map(cat => (
              <button 
                key={cat.name}
                onClick={() => {
                  setFormData({...formData, category: cat.name});
                  setStep(2);
                }}
                className="p-4 border rounded-2xl hover:bg-blue-50 hover:border-blue-600 transition-all flex flex-col items-center gap-2"
              >
                <span className="text-3xl">{cat.icon}</span>
                <span className="font-bold text-sm">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-red-800">Priority Emergency Service</h4>
              <p className="text-sm text-red-700">This priority post is exempt from your monthly allowance. Verified tradespeople will respond within 1 hour.</p>
            </div>
          </div>
          
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold border border-red-100">
              {error}
            </div>
          )}

          <h2 className="text-xl font-bold">Describe the emergency</h2>
          <textarea 
            className="w-full p-4 border-2 border-black shadow-sm rounded-2xl focus:ring-4 focus:ring-red-500/20 focus:border-red-500 transition-all font-medium placeholder:font-normal h-32 resize-none"
            placeholder="e.g. Pipe burst in kitchen..."
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
          />
          
          <div className="space-y-3">
            <h3 className="font-bold text-slate-900">Add photos (Optional)</h3>
            <p className="text-sm text-slate-500">Photos help tradespeople understand the problem faster.</p>
            
            <input 
              type="file" 
              accept="image/*" 
              multiple 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleGalleryUpload}
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full p-4 border-2 border-dashed border-black rounded-2xl hover:border-red-500 hover:bg-red-50 transition-all flex items-center justify-center gap-2 text-slate-600 font-medium disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Uploading... {Math.round(uploadProgress)}%
                </>
              ) : (
                <>
                  <ImageIcon className="w-5 h-5" />
                  Upload Photos
                </>
              )}
            </button>

            {formData.photos.length > 0 && (
              <div className="grid grid-cols-3 gap-3 pt-2">
                {formData.photos.map((url, i) => (
                  <div key={`photo-${i}`} className="relative aspect-square rounded-2xl overflow-hidden border border-black group shadow-sm">
                    <img src={url} alt={`Emergency photo ${i + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <button 
                      onClick={() => setFormData({ ...formData, photos: formData.photos.filter((_, idx) => idx !== i) })}
                      className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                className="w-full p-4 pl-12 pr-12 border-2 border-black shadow-sm rounded-2xl focus:ring-4 focus:ring-red-500/20 focus:border-red-500 transition-all font-medium placeholder:font-normal"
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
                        county: data.county,
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
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-black max-h-64 overflow-y-auto z-50">
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

                              // If no postcode is found from components, fallback to trying to extract from label or use label
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
                      className="p-3 hover:bg-slate-50 cursor-pointer flex items-center gap-3 border-b border-slate-50 last:border-0"
                    >
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-700 truncate">{suggestion.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {formData.fullAddress && (
                <div 
                  className={cn("flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors", !useRegisteredAddress ? "border-red-200 bg-red-50/50" : "border-black hover:bg-slate-50")}
                  onClick={() => setUseRegisteredAddress(false)}
                >
                  <div className={cn("w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors", !useRegisteredAddress ? "border-red-600 border-4 bg-white" : "border-black bg-white")}></div>
                  <div>
                    <div className="font-bold text-sm text-slate-900">Use selected address</div>
                    <div className="text-xs text-slate-600">
                      {formData.fullAddress}
                    </div>
                  </div>
                </div>
              )}

              {userProfile?.postcode && (
                <div 
                  className={cn("flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors", useRegisteredAddress ? "border-red-200 bg-red-50/50" : "border-black hover:bg-slate-50")}
                  onClick={() => {
                    setUseRegisteredAddress(true);
                    setAddressInput("");
                    setFormData(prev => ({
                      ...prev,
                      postcode: userProfile.postcode,
                      city: userProfile.city || prev.city,
                      area: userProfile.area || prev.area,
                      county: userProfile.county || prev.county,
                      fullAddress: userProfile.postcode
                    }));
                  }}
                >
                  <div className={cn("w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors", useRegisteredAddress ? "border-red-600 border-4 bg-white" : "border-black bg-white")}></div>
                  <div>
                    <div className="font-bold text-sm text-slate-900">Use my registered address</div>
                    <div className="text-xs text-slate-600">
                      {userProfile.postcode} {userProfile.city ? `, ${userProfile.city}` : ''}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <input 
            className="w-full p-4 border-2 border-black shadow-sm rounded-2xl focus:ring-4 focus:ring-red-500/20 focus:border-red-500 transition-all font-medium placeholder:font-normal"
            placeholder="Mobile Number"
            value={formData.mobileNumber}
            onChange={(e) => setFormData({...formData, mobileNumber: e.target.value})}
          />

          {/* Premium Job Upgrades */}
          {platformConfig?.premiumJobUpgradesEnabled !== false && (
            <div className="space-y-3 pt-4 border-t border-red-100">
              <h3 className="text-lg font-extrabold text-black mt-2 mb-2">Premium Upgrades (Optional)</h3>
              
              <div className={cn(
                "relative p-3 rounded-lg border-2 transition-all cursor-pointer flex items-start gap-3",
                isEmergencyBoost ? "border-red-500 bg-red-50/50 shadow-sm shadow-red-500/10" : "border-black hover:border-slate-400 bg-white"
              )}
            onClick={() => setIsEmergencyBoost(!isEmergencyBoost)}
            >
               <div className={cn(
                "w-5 h-5 rounded-full border-2 flex shrink-0 mt-0.5 transition-colors items-center justify-center",
                isEmergencyBoost ? "border-red-500 bg-red-500" : "border-black"
              )}>
                {isEmergencyBoost && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
              </div>
              <div className="flex-1 pr-6">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-base font-extrabold text-black">Emergency Boost <span className="text-red-600 font-black ml-1">£5</span></h4>
                </div>
                <p className="text-xs text-black font-semibold line-clamp-2">Pin your job to the top of all local tradespeople's feeds and send them an instant push notification alert.</p>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowBoostInfo('emergency'); }}
                className="absolute top-2.5 right-2.5 text-slate-500 hover:text-red-500 transition-colors"
                type="button"
              >
                <Info className="w-5 h-5 fill-slate-100" />
              </button>
            </div>

            <div className={cn(
              "relative p-3 rounded-lg border-2 transition-all cursor-pointer flex items-start gap-3",
              isInstantMatch ? "border-amber-500 bg-amber-50/50 shadow-sm shadow-amber-500/10" : "border-black hover:border-slate-400 bg-white"
            )}
            onClick={() => setIsInstantMatch(!isInstantMatch)}
            >
               <div className={cn(
                "w-5 h-5 shrink-0 rounded-full border-2 flex mt-0.5 transition-colors items-center justify-center",
                isInstantMatch ? "border-amber-500 bg-amber-500" : "border-black"
              )}>
                {isInstantMatch && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
              </div>
              <div className="flex-1 pr-6">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-base font-extrabold text-black tracking-tight">Instant Match <span className="text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-md font-black ml-1 text-[10px] uppercase">Premium Value</span> <span className="text-amber-600 font-black ml-0.5">From £{(instantMatchCopy?.price || 2.99).toFixed(2)}</span></h4>
                </div>
                <p className="text-xs text-black font-semibold line-clamp-2">
                  {instantMatchCopy?.bullets?.map((b: any) => b.text).join(" • ")}
                </p>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowBoostInfo('instant'); }}
                className="absolute top-2.5 right-2.5 text-slate-500 hover:text-amber-500 transition-colors"
                type="button"
              >
                <Info className="w-5 h-5 fill-slate-100" />
              </button>
            </div>

            {(isEmergencyBoost || isInstantMatch) && (
              <div className="bg-white p-3 rounded-lg border border-black text-xs text-black flex items-start gap-2 shadow-sm font-semibold">
                 <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                 <span>You have selected {(isEmergencyBoost && isInstantMatch) ? "both Premium Upgrades" : (isEmergencyBoost ? "the Emergency Boost" : "the Instant Match")}. By continuing, you agree to pay the additional charges upon job posting.</span>
              </div>
            )}
            
            <div className="mt-4 p-4 bg-white border border-red-100 rounded-xl shadow-sm space-y-3">
              {(isEmergencyBoost || isInstantMatch) && (
                <div className="flex items-center justify-between px-2">
                  <span className="text-xs font-extrabold text-black uppercase">Total Fee</span>
                  <span className="text-lg font-black text-red-600">
                    {isInstantMatch ? 'From ' : ''}£{((isEmergencyBoost ? 5 : 0) + (isInstantMatch ? (instantMatchCopy?.price || 2.99) : 0)).toFixed(2)}
                  </span>
                </div>
              )}
              <button 
                onClick={handleInitialSubmit}
                className="w-full p-3.5 bg-red-600 text-white font-extrabold rounded-xl shadow-md shadow-red-600/20 active:scale-95 transition-transform"
              >
                {(isEmergencyBoost || isInstantMatch) ? "Pay & Post Emergency Job" : "Post Emergency Job Now"}
              </button>
            </div>
          </div>
          )}

          {!(platformConfig?.premiumJobUpgradesEnabled !== false) && (
            <div className="mt-4 p-4 bg-white border border-red-100 rounded-xl shadow-sm space-y-3">
              <button 
                onClick={handleInitialSubmit}
                className="w-full p-3.5 bg-red-600 text-white font-extrabold rounded-xl shadow-md shadow-red-600/20 active:scale-95 transition-transform"
              >
                Post Emergency Job Now
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mock Checkout Modal */}
      <AnimatePresence>
        {showCheckout && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-black"
            >
              <div className="p-6 border-b border-black bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-200">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Secure Checkout</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Powered by Stripe (Mock)</p>
                  </div>
                </div>
                <button 
                  onClick={() => !isProcessingPayment && setShowCheckout(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                  disabled={isProcessingPayment}
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="bg-slate-50 p-4 rounded-2xl border border-black flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Selected Plan</p>
                    <p className="text-lg font-black text-slate-900">
                      {(isEmergencyBoost && isInstantMatch) ? "Emergency Boost + Instant Match" : (isEmergencyBoost ? "Emergency Boost" : "Instant Match")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-500 uppercase">One-time</p>
                    <p className="text-xl font-black text-red-600">
                      {isInstantMatch ? 'From ' : ''}£{((isEmergencyBoost ? 5 : 0) + (isInstantMatch ? (instantMatchCopy?.price || 2.99) : 0)).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="text-center space-y-2 py-4">
                  <p className="text-sm text-slate-500">You will be redirected to our secure payment partner, Stripe, to complete this transaction.</p>
                </div>

                <button 
                  onClick={handlePayment}
                  disabled={isProcessingPayment}
                  className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessingPayment ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Redirecting...
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5" /> Proceed to Secure Checkout
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
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
                  {showBoostInfo === 'emergency' ? "Emergency Boost" : instantMatchCopy?.title}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  {showBoostInfo === 'emergency' ? 
                   "Jump the queue! The Emergency Boost (£5) pins your job listing to the top of all local tradespeople's feeds and sends them an immediate push notification alert, bypassing normal delays." : 
                   instantMatchCopy?.desc
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
                       instantMatchCopy?.bullets?.map((b: any, i: number) => {
                         const BulletIcon = b.icon;
                         return (
                           <li key={i} className="flex items-start gap-2 text-sm text-slate-700 font-medium">
                             {BulletIcon && <BulletIcon className={`w-4 h-4 mt-0.5 ${b.color}`} />} {b.text}
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
    </div>
  );
}

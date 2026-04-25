import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, X, AlertTriangle, MapPin, Camera, Image as ImageIcon, Loader2, Zap, CreditCard, Lock } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { TRADE_CATEGORIES } from "@/src/constants";
import { lookupPostcode } from "@/src/services/postcodeService";
import { db, collection, serverTimestamp, doc, setDoc, OperationType, handleFirestoreError, storage, ref, uploadBytesResumable, getDownloadURL, uploadBytes, uploadString, getDoc, getDocs, query, where } from "@/src/firebase";
import { useAuth } from "./AuthProvider";
import { AnimatePresence, motion } from "framer-motion";

export default function EmergencyJobWizard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    category: "",
    description: "",
    postcode: "",
    city: "",
    area: "",
    county: "",
    mobileNumber: "",
    urgency: "emergency",
    photos: [] as string[]
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isBoosted, setIsBoosted] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredCategories = TRADE_CATEGORIES.filter(cat => 
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          const uploadTask = uploadBytesResumable(storageRef, file);
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
    if (isBoosted) {
      setShowCheckout(true);
    } else {
      handleSubmit(false);
    }
  };

  // Modifies handleSubmit to return the job ID so we can pass it to Stripe
  const handleSubmit = async (paidBoost: boolean): Promise<string | void> => {
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
      const expiryHours = paidBoost ? 4 : 2;
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
        securityAlert: securityAlert,
        urgency: "emergency",
        hasReview: false,
        photos: formData.photos,
        postedDate: serverTimestamp(),
        createdAt: serverTimestamp(),
        exclusiveUntil: new Date(Date.now() + 5 * 60000),
        paymentPreference: "negotiable",
        quoteScope: "complete_package",
        isBoosted: paidBoost,
        boostExpiresAt,
        retryCount: 0
      });
      
      // Simulate auto-picking and notifying traders
      console.log("Notifying relevant traders for job:", jobRef.id);
      const notificationRef = doc(collection(db, "trader_notifications"));
      await setDoc(notificationRef, {
        id: notificationRef.id,
        jobId: jobRef.id,
        category: formData.category,
        postcode: formData.postcode.toUpperCase().replace(/\s/g, ""),
        urgency: "emergency",
        timestamp: serverTimestamp(),
        processed: false
      });
      
      if (!paidBoost) {
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
    <div className="max-w-2xl mx-auto bg-white min-h-screen p-4 pb-48">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Emergency Job</h1>
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-6 h-6" /></button>
      </div>

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
            className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
            className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
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
              className="w-full p-4 border-2 border-dashed border-slate-200 rounded-2xl hover:border-red-500 hover:bg-red-50 transition-all flex items-center justify-center gap-2 text-slate-600 font-medium disabled:opacity-50"
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
                  <div key={`photo-${i}`} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 group shadow-sm">
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

          <input 
            className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 uppercase"
            placeholder="Postcode (e.g. M1 2AB)"
            value={formData.postcode}
            onChange={(e) => setFormData({...formData, postcode: e.target.value})}
            onBlur={async (e) => {
              const postcode = e.target.value;
              if (!postcode) return;
              try {
                const data = await lookupPostcode(postcode);
                if (data) {
                  setFormData(prev => ({ 
                    ...prev, 
                    city: data.city,
                    area: data.area,
                    county: data.county,
                    postcode: data.postcode
                  }));
                }
              } catch (err) {
                console.error("Error looking up postcode:", err);
              }
            }}
          />
          {formData.area && (
            <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-600 font-medium">
                {formData.area}{formData.county ? `, ${formData.county}` : ""}
              </span>
            </div>
          )}
          <input 
            className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            placeholder="Mobile Number"
            value={formData.mobileNumber}
            onChange={(e) => setFormData({...formData, mobileNumber: e.target.value})}
          />

          {/* Boost Toggle */}
          <div 
            className={cn(
              "p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4",
              isBoosted ? "border-red-500 bg-red-50/50" : "border-slate-200 hover:border-slate-300"
            )}
            onClick={() => setIsBoosted(!isBoosted)}
          >
            <div className={cn(
              "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
              isBoosted ? "border-red-500 bg-red-500" : "border-slate-300"
            )}>
              {isBoosted && <div className="w-2 h-2 bg-white rounded-full" />}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-slate-900">Boost this Emergency</h3>
                <span className="bg-red-100 text-red-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">£5</span>
              </div>
              <p className="text-sm text-slate-600">
                Pin your job to the top of all local tradespeople's feeds and send them an instant high-priority alert.
              </p>
            </div>
          </div>
          
          <div className="fixed bottom-4 left-4 right-4 p-4 bg-white/95 backdrop-blur-xl border border-red-100 rounded-2xl z-40 shadow-2xl space-y-3">
            {isBoosted && (
              <div className="flex items-center justify-between px-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Emergency Boost Fee</span>
                <span className="text-lg font-black text-red-600">£5.00</span>
              </div>
            )}
            <button 
              onClick={handleInitialSubmit}
              className="w-full p-4 bg-red-600 text-white font-bold rounded-2xl shadow-lg shadow-red-600/20 active:scale-95 transition-transform"
            >
              {isBoosted ? "Pay £5 & Post Emergency Job" : "Post Emergency Job Now"}
            </button>
          </div>
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
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100"
            >
              <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
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
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Selected Plan</p>
                    <p className="text-lg font-black text-slate-900">Emergency Boost</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-500 uppercase">One-time</p>
                    <p className="text-xl font-black text-red-600">£5.00</p>
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
    </div>
  );
}

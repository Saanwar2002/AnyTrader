import React, { useEffect, useState } from "react";
import { db, collection, query, where, orderBy, limit, getDocs, onSnapshot, type FirebaseUser, handleFirestoreError, OperationType, updateDoc, doc } from "@/src/firebase";
import { parseNaturalLanguageSearch } from "@/src/services/gemini";
import { useAuth } from "./AuthProvider";
import { motion, AnimatePresence } from "motion/react";
import { Briefcase, Clock, MapPin, ChevronRight, Search, Filter, Wrench, X, Image as ImageIcon, Video as VideoIcon, ChevronDown, ChevronUp, Info, Star, Save, Zap, Loader2, PoundSterling, Calendar, FileText, AlertCircle, Mic } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { cn, getOutwardPostcode } from "@/src/lib/utils";
import { URGENCY_LEVELS } from "@/src/constants";
import { useCategories } from "../lib/CategoryProvider";
import MediaGalleryModal from "./MediaGalleryModal";
import { SEO } from "./SEO";
import { useEntitlements } from "../lib/useEntitlements";
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import { toast } from "sonner";
import { PullToRefresh } from "./common/PullToRefresh";

const iconMap: Record<string, any> = {
  Wrench, Briefcase, Clock, MapPin, Search, Filter, X
};

import { EmergencyTimer } from "./EmergencyTimer";
import { NearbyRequestsSection } from "./job-feed/NearbyRequestsSection";

export default function JobFeed() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { categories } = useCategories();
  const entitlements = useEntitlements();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [limitCount, setLimitCount] = useState(50);
  
  // Persistence: Load initial states from profile (cross-device) or localStorage (device-specific)
  const [searchTerm, setSearchTerm] = useState(() => profile?.activeFilter?.searchTerm || localStorage.getItem("job_feed_searchTerm") || "");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    if (profile?.activeFilter?.categories) return profile.activeFilter.categories;
    const saved = localStorage.getItem("job_feed_selectedCategories");
    try {
      return saved && saved !== "undefined" ? JSON.parse(saved) : [];
    } catch (e) {
      console.warn("Invalid JSON in localStorage for job_feed_selectedCategories");
      return [];
    }
  });
  const [sortBy, setSortBy] = useState<"newest" | "urgency" | "completion">(() => 
    profile?.activeFilter?.sortBy || (localStorage.getItem("job_feed_sortBy") as any) || "newest"
  );
  const [activeTab, setActiveTab] = useState<"feed" | "how-it-works">("feed");
  const [showFilters, setShowFilters] = useState(false);
  const [showMatchedOnly, setShowMatchedOnly] = useState(() => 
    profile?.activeFilter?.showMatchedOnly ?? (localStorage.getItem("job_feed_showMatchedOnly") === "true")
  );
  const [urgencyFilter, setUrgencyFilter] = useState<string>(() => 
    profile?.activeFilter?.urgencyFilter || localStorage.getItem("job_feed_urgencyFilter") || "any"
  );
  const [distanceFilter, setDistanceFilter] = useState<string>(() => 
    profile?.activeFilter?.distanceFilter || localStorage.getItem("job_feed_distanceFilter") || "any"
  );
  const [priceFilter, setPriceFilter] = useState<string>(() => 
    profile?.activeFilter?.priceFilter || localStorage.getItem("job_feed_priceFilter") || "any"
  );
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(true);
  const [selectedJobMedia, setSelectedJobMedia] = useState<any | null>(null);
  const [newFilterName, setNewFilterName] = useState("");
  const [isSavingFilter, setIsSavingFilter] = useState(false);
  const [hasSyncedFromCloud, setHasSyncedFromCloud] = useState(false);
  const [sysConfig, setSysConfig] = useState<any>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = React.useRef<any>(null);

  const startVoiceSearch = async () => {
    try {
      if (isListening) {
        if (Capacitor.isNativePlatform()) {
          try { await SpeechRecognition.stop(); } catch (e) {}
        } else if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
        setIsListening(false);
        return;
      }

      if (Capacitor.isNativePlatform()) {
        const { available } = await SpeechRecognition.available();
        if (!available) {
          toast.error("Speech recognition not available on this device.");
          return;
        }

        const check = await SpeechRecognition.checkPermissions();
        if (check.speechRecognition !== 'granted') {
          const req = await SpeechRecognition.requestPermissions();
          if (req.speechRecognition !== 'granted') {
            toast.error("Microphone permission is required for voice search.");
            return;
          }
        }

        setIsListening(true);
        if ((window as any)._jobFeedSpeechListener) await (window as any)._jobFeedSpeechListener.remove().catch(() => {});
        const listener = await SpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
          if (data.matches && data.matches.length > 0) {
            setSearchTerm(data.matches[0]);
          }
        });
        (window as any)._jobFeedSpeechListener = listener;

        if ((window as any)._jobFeedStateListener) await (window as any)._jobFeedStateListener.remove().catch(() => {});
        const stateListener = await SpeechRecognition.addListener('listeningState', (data: { status: 'started' | 'stopped' }) => {
          if (data.status === 'stopped') {
            setIsListening(false);
            if ((window as any)._jobFeedSpeechListener) (window as any)._jobFeedSpeechListener.remove().catch(() => {});
            stateListener.remove().catch(() => {});
          }
        });
        (window as any)._jobFeedStateListener = stateListener;

        await SpeechRecognition.start({
          language: "en-GB",
          maxResults: 2,
          prompt: "What are you looking for...",
          partialResults: true,
          popup: false,
        });

      } else {
        const InternalSpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!InternalSpeechRecognition) {
          toast.error("Your browser does not support voice search. Please try Chrome, Edge, or Safari.");
          return;
        }

        const recognition = new InternalSpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = "en-GB";

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          let transcript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
          }
          setSearchTerm(transcript);
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
          toast.error("Failed to recognize speech. Please try again.");
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.start();
      }
    } catch (e: any) {
      console.error(e);
      setIsListening(false);
      toast.error(e.message || "Error starting voice recognition.");
    }
  };

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, "platform_config", "global"), (docSnapshot) => {
      if (docSnapshot.exists()) {
        setSysConfig(docSnapshot.data());
      } else {
        setSysConfig({ paywallEnabled: true });
      }
    }, (error) => {
      console.error("Firestore Paywall Config Error:", error);
      setSysConfig({ paywallEnabled: true });
    });
    return () => unsubConfig();
  }, []);

  useEffect(() => {
    setHasSyncedFromCloud(false);
  }, [user?.uid]);

  // Persistence: Sync from profile when it loads for the first time
  useEffect(() => {
    if (profile?.activeFilter && !hasSyncedFromCloud) {
      const af = profile.activeFilter;
      if (af.searchTerm) setSearchTerm(af.searchTerm);
      if (af.categories) setSelectedCategories(af.categories);
      if (af.sortBy) setSortBy(af.sortBy);
      if (af.showMatchedOnly !== undefined) setShowMatchedOnly(af.showMatchedOnly);
      if (af.urgencyFilter) setUrgencyFilter(af.urgencyFilter);
      if (af.distanceFilter) setDistanceFilter(af.distanceFilter);
      if (af.priceFilter) setPriceFilter(af.priceFilter);
      setHasSyncedFromCloud(true);
    }
  }, [profile, hasSyncedFromCloud]); 

  // Persistence: Save states to localStorage and Firestore (cross-device sync)
  useEffect(() => {
    // Local persistence
    localStorage.setItem("job_feed_searchTerm", searchTerm);
    localStorage.setItem("job_feed_selectedCategories", JSON.stringify(selectedCategories));
    localStorage.setItem("job_feed_sortBy", sortBy);
    localStorage.setItem("job_feed_showMatchedOnly", String(showMatchedOnly));
    localStorage.setItem("job_feed_urgencyFilter", urgencyFilter);
    localStorage.setItem("job_feed_distanceFilter", distanceFilter);
    localStorage.setItem("job_feed_priceFilter", priceFilter);

    // Cloud persistence (Debounced to avoid excessive writes)
    if (!user) return;
    const timer = setTimeout(async () => {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          activeFilter: {
            searchTerm,
            categories: selectedCategories,
            sortBy,
            showMatchedOnly,
            urgencyFilter,
            distanceFilter,
            priceFilter,
            updatedAt: new Date().toISOString()
          }
        });
      } catch (err) {
        console.error("Error syncing filters to cloud:", err);
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(timer);
  }, [searchTerm, selectedCategories, sortBy, showMatchedOnly, urgencyFilter, distanceFilter, priceFilter, user]);

  const handleSaveFilter = async () => {
    if (!user || !newFilterName.trim()) return;
    setIsSavingFilter(true);
    try {
      const newFilter = {
        id: Date.now().toString(),
        name: newFilterName.trim(),
        searchTerm,
        categories: selectedCategories,
        sortBy,
        showMatchedOnly,
        urgencyFilter,
        distanceFilter,
        priceFilter,
        createdAt: new Date().toISOString()
      };
      
      const currentFilters = profile?.savedFilters || [];
      await updateDoc(doc(db, "users", user.uid), {
        savedFilters: [...currentFilters, newFilter]
      });
      setNewFilterName("");
    } catch (err) {
      console.error("Error saving filter:", err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setIsSavingFilter(false);
    }
  };

  const handleDeleteFilter = async (filterId: string) => {
    if (!user || !profile?.savedFilters) return;
    try {
      const updatedFilters = profile.savedFilters.filter((f: any) => f.id !== filterId);
      await updateDoc(doc(db, "users", user.uid), {
        savedFilters: updatedFilters
      });
    } catch (err) {
      console.error("Error deleting filter:", err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleAiSearch = async () => {
    if (!searchTerm.trim()) return;
    setIsAiSearching(true);
    try {
      const result = await parseNaturalLanguageSearch(searchTerm);
      
      // Apply the AI results
      if (result.categories.length > 0) {
        setSelectedCategories(result.categories);
      }
      
      if (result.urgency) {
        // We don't have a direct urgency filter state yet, but we can use it to filter the list
        // For now, let's just set the search term to the keywords if any
        if (result.keywords.length > 0) {
          setSearchTerm(result.keywords.join(" "));
        }
      }
      
      setShowFilters(true);
    } catch (err) {
      console.error("AI Search Error:", err);
    } finally {
      setIsAiSearching(false);
    }
  };

  const applyFilter = (filter: any, autoShowFilters = true) => {
    setSearchTerm(filter.searchTerm || "");
    setSelectedCategories(filter.categories || (filter.category ? [filter.category] : []));
    if (filter.sortBy) setSortBy(filter.sortBy);
    if (filter.showMatchedOnly !== undefined) setShowMatchedOnly(filter.showMatchedOnly);
    if (filter.urgencyFilter) setUrgencyFilter(filter.urgencyFilter);
    if (filter.distanceFilter) setDistanceFilter(filter.distanceFilter);
    if (filter.priceFilter) setPriceFilter(filter.priceFilter);
    if (autoShowFilters) setShowFilters(true);
  };

  useEffect(() => {
    if (!user) return;

    // Fetch up to current limitCount posted jobs with optimized composite ordering and fallback
    let q = query(
      collection(db, "jobs"),
      where("status", "==", "posted"),
      orderBy("postedDate", "desc"),
      limit(limitCount)
    );

    let unsubscribe = onSnapshot(q, (snapshot) => {
      const jobsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setJobs(jobsData);
      setLoading(false);
    }, (error) => {
      console.warn("Ordered job feed query error or indexing in progress, running resilient fallback query:", error);
      // Resilient fallback query without explicit orderBy in case composite index is building
      const fallbackQ = query(
        collection(db, "jobs"),
        where("status", "==", "posted"),
        limit(limitCount)
      );
      unsubscribe = onSnapshot(fallbackQ, (fallbackSnapshot) => {
        const jobsData = fallbackSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a: any, b: any) => new Date(b.postedDate || b.createdAt || 0).getTime() - new Date(a.postedDate || a.createdAt || 0).getTime());
        setJobs(jobsData);
        setLoading(false);
      }, (fallbackErr) => {
        console.error("Error fetching job feed fallback:", fallbackErr);
        handleFirestoreError(fallbackErr, OperationType.LIST, "jobs");
        setLoading(false);
      });
    });

    return () => unsubscribe();
  }, [user, limitCount]);

  const handleManualRefresh = async () => {
    try {
      const q = query(
        collection(db, "jobs"),
        where("status", "==", "posted"),
        orderBy("postedDate", "desc"),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      const jobsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setJobs(jobsData);
      toast.success("Job feed refreshed");
    } catch (err) {
      console.error("Error refreshing job feed:", err);
      toast.error("Failed to refresh job feed");
    }
  };

  const filteredJobs = jobs.filter(job => {
    // Time-Gate Security Check
    const jobExclusiveUntil = job.exclusiveUntil?.toDate ? job.exclusiveUntil.toDate() : (job.exclusiveUntil ? new Date(job.exclusiveUntil) : null);
    const isCurrentlyExclusive = jobExclusiveUntil && jobExclusiveUntil > new Date();
    
    // Hide if it's currently exclusive and the user DOES NOT have the fast pass AND the paywall is active
    if (isCurrentlyExclusive && profile?.hasExclusiveAddon !== true && sysConfig?.paywallEnabled !== false) {
      return false;
    }

    // Hide if job has reached maximum quotes limit (5)
    if ((job.quoteCount || 0) >= 5) {
      return false;
    }

    const searchLower = searchTerm.toLowerCase();
    const normalizedSearch = searchLower.replace(/[^a-z0-9]/g, '');
    const jobNoNormalized = job.jobNo?.toLowerCase().replace(/[^a-z0-9]/g, '') || "";

    const matchesSearch = job.title.toLowerCase().includes(searchLower) || 
                         job.description.toLowerCase().includes(searchLower) ||
                         (normalizedSearch !== "" && jobNoNormalized.includes(normalizedSearch));
    const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(job.category);
    
    // Base filters that always apply
    const baseFiltersMatch = matchesSearch && matchesCategory;

    // Urgency Filter
    let matchesUrgency = true;
    if (urgencyFilter !== "any") {
      if (urgencyFilter === "emergency") matchesUrgency = job.urgency === "emergency" || job.urgency === "asap";
      else if (urgencyFilter === "this_week") matchesUrgency = job.urgency === "this_week";
      else if (urgencyFilter === "flexible") matchesUrgency = job.urgency === "flexible";
      else if (urgencyFilter === "this_month") {
        const now = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(now.getDate() + 30);
        
        if (job.jobDate) {
          const jobDate = new Date(job.jobDate);
          matchesUrgency = jobDate >= now && jobDate <= thirtyDaysFromNow;
        } else {
          // If no specific date, treat "flexible" or "this_week" as potentially within this month
          matchesUrgency = job.urgency === "flexible" || job.urgency === "this_week" || job.urgency === "asap";
        }
      }
    }

    // Price Filter
    let matchesPrice = true;
    if (priceFilter !== "any") {
      const min = job.estimateMin || 0;
      const max = job.estimateMax || 0;
      if (priceFilter === "under_500") matchesPrice = max <= 500;
      else if (priceFilter === "500_2000") matchesPrice = (min >= 500 && min <= 2000) || (max >= 500 && max <= 2000);
      else if (priceFilter === "2000_5000") matchesPrice = (min >= 2000 && min <= 5000) || (max >= 2000 && max <= 5000);
      else if (priceFilter === "over_5000") matchesPrice = min >= 5000;
    }

    // Distance Filter (Mock logic for now)
    let matchesDistance = true;
    // In a real app, we'd calculate distance between profile.postcode and job.postcode
    // For now, we'll just return true to not break the feed

    // Check if job matches tradesperson's specific services or specializations
    const matchesService = profile?.services?.some((service: string) => 
      job.title.toLowerCase().includes(service.toLowerCase()) || 
      job.description.toLowerCase().includes(service.toLowerCase()) ||
      job.category.toLowerCase().includes(service.toLowerCase()) ||
      (job.subcategory && job.subcategory.toLowerCase().includes(service.toLowerCase()))
    );

    const matchesSpecialization = profile?.tags?.some((tag: string) => 
      job.title.toLowerCase().includes(tag.toLowerCase()) || 
      job.description.toLowerCase().includes(tag.toLowerCase()) ||
      job.category.toLowerCase().includes(tag.toLowerCase()) ||
      (job.subcategory && job.subcategory.toLowerCase().includes(tag.toLowerCase()))
    );

    const matchesTrade = profile?.trades?.some((trade: string) => 
      job.category.toLowerCase() === trade.toLowerCase()
    );

    const isMatched = matchesService || matchesSpecialization || matchesTrade;
    
    // Filter out jobs scheduled for dates the tradesperson is busy or booked
    let matchesAvailability = true;
    if (job.urgency === "specific_date" && job.jobDate && profile?.dateOverrides) {
      const overrideStatus = profile.dateOverrides[job.jobDate];
      if (overrideStatus === "busy" || overrideStatus === "booked") {
        matchesAvailability = false;
      }
    }

    const allCriteriaMatch = baseFiltersMatch && matchesAvailability && matchesUrgency && matchesPrice && matchesDistance;

    if (showMatchedOnly) {
      return isMatched && allCriteriaMatch;
    }

    return allCriteriaMatch;
  }).sort((a, b) => {
    // 1. Boosted jobs ALWAYS go to the top
    if (a.isBoosted && !b.isBoosted) return -1;
    if (!a.isBoosted && b.isBoosted) return 1;

    // 2. Then apply the selected sort
    if (sortBy === "newest") {
      const dateA = a.createdAt?.seconds || 0;
      const dateB = b.createdAt?.seconds || 0;
      return dateB - dateA;
    }
    
    if (sortBy === "urgency") {
      const urgencyOrder = ["emergency", "asap", "this_week", "flexible", "specific_date"];
      const indexA = urgencyOrder.indexOf(a.urgency);
      const indexB = urgencyOrder.indexOf(b.urgency);
      return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
    }
    
    if (sortBy === "completion") {
      const getHours = (val: any, unit: string) => {
        const num = parseFloat(val) || 0;
        if (unit === "days") return num * 24;
        if (unit === "weeks") return num * 168;
        return num;
      };
      const hoursA = getHours(a.estimatedCompletionTime, a.estimatedCompletionTimeUnit);
      const hoursB = getHours(b.estimatedCompletionTime, b.estimatedCompletionTimeUnit);
      return hoursA - hoursB;
    }
    
    return 0;
  });

  const isCurrentSearchSaved = profile?.savedFilters?.some((f: any) => {
    const fCats = [...(f.categories || [])].sort().join(',');
    const currCats = [...selectedCategories].sort().join(',');
    return fCats === currCats && 
           (f.searchTerm || "") === searchTerm &&
           (f.urgencyFilter || "any") === urgencyFilter &&
           (f.distanceFilter || "any") === distanceFilter &&
           (f.priceFilter || "any") === priceFilter &&
           (f.showMatchedOnly || false) === showMatchedOnly;
  });

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleManualRefresh} className="min-h-full pb-8">
      <div className="space-y-6">
        <SEO 
        title="Find Work | Job Feed" 
        description="Browse the latest jobs for tradespeople and community helpers on AnyTrader. Filter by category, location, and urgency."
      />
      {profile?.verificationStatus === "pending" && (
        <div className="bg-orange-50 border-2 border-orange-200 p-4 sm:p-6 rounded-[2rem] flex flex-col sm:flex-row gap-4 sm:items-start justify-between shadow-lg shadow-orange-100">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h3 className="font-black text-orange-900 text-lg tracking-tight">Admin Verification Required</h3>
              <p className="text-orange-800 text-sm font-medium mt-1">
                Because of the specific services you selected during sign-up, your account requires admin verification before you can quote on jobs.
              </p>
              {profile?.verificationDocs && profile.verificationDocs.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-bold text-orange-700 uppercase tracking-wider mb-2">Required Documents:</p>
                  <ul className="list-disc list-inside text-sm text-orange-800 font-medium space-y-1">
                    {profile.verificationDocs.map((doc: any, i: number) => (
                      <li key={i}>{doc.type} <span className="text-xs opacity-70">({doc.status})</span></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
          <Link to="/profile?tab=documents" className="shrink-0 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-2xl font-black text-sm transition-all text-center">
            View & Upload Documents
          </Link>
        </div>
      )}
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display font-black text-slate-900 tracking-tight">Job Feed</h1>
      </div>

      {activeTab === "feed" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder={isListening ? "Listening..." : "Search title, Job # (e.g. 123456) or try 'Plumber'..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAiSearch()}
                className={cn(
                  "w-full pl-9 pr-36 py-3 rounded-2xl border transition-all text-sm shadow-sm focus:outline-none focus:ring-4",
                  isListening ? "border-red-500 bg-red-50 focus:ring-red-500/10" : "border-black bg-white focus:ring-primary/10 focus:border-primary"
                )}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 group">
                <div className="relative flex items-center justify-center">
                  <button 
                    onClick={startVoiceSearch}
                    title="Voice Search"
                    className={cn(
                      "p-1.5 rounded-xl transition-all flex items-center justify-center",
                      isListening ? "bg-red-500 text-white animate-pulse shadow-md shadow-red-500/20" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    )}
                  >
                    <Mic className="w-4 h-4" />
                  </button>

                  <div className={cn(
                    "absolute right-0 top-full mt-2 w-max max-w-[240px] p-3 bg-slate-800 text-white rounded-xl shadow-xl z-50 transition-all origin-top-right pointer-events-none",
                    isListening ? "opacity-100 scale-100 visible" : "opacity-0 scale-95 invisible group-hover:opacity-100 group-hover:scale-100 group-hover:visible"
                  )}>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                       <Info className="w-3 h-3" /> Voice Commands
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs bg-slate-700/50 px-2 py-1 rounded-md border border-slate-600/50">"Show painting jobs"</span>
                      <span className="text-xs bg-slate-700/50 px-2 py-1 rounded-md border border-slate-600/50">"Urgent plumbing in London"</span>
                    </div>
                    <div className="absolute -top-1.5 right-3 w-3 h-3 bg-slate-800 rotate-45 rounded-sm"></div>
                  </div>
                </div>
                <button 
                  onClick={handleAiSearch}
                  disabled={isAiSearching || !searchTerm.trim()}
                  className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 hover:bg-primary/20 transition-all disabled:opacity-50"
                >
                  {isAiSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  AI Search
                </button>
              </div>
            </div>
            {isAiSearching && (
              <button 
                onClick={() => setIsAiSearching(false)}
                className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-all"
              >
                Skip AI Search
              </button>
            )}
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "p-3 rounded-2xl border transition-all shadow-sm",
                showFilters ? "bg-primary border-primary text-white shadow-lg shadow-primary/20" : "bg-white border-black text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl border border-black shadow-sm shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sort:</span>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="newest">Newest</option>
                <option value="urgency">Urgency</option>
                <option value="completion">Time</option>
              </select>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl border border-black shadow-sm shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Best Match Only</span>
              <button 
                onClick={() => setShowMatchedOnly(!showMatchedOnly)}
                className={cn(
                  "w-9 h-5 rounded-full transition-colors relative",
                  showMatchedOnly ? "bg-primary" : "bg-slate-300"
                )}
              >
                <div className={cn(
                  "absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform",
                  showMatchedOnly ? "translate-x-4" : "translate-x-0"
                )} />
              </button>
            </div>

            <button 
              onClick={() => {
                setShowFilters(true);
                setTimeout(() => {
                  const saveSection = document.getElementById('save-feed-section');
                  saveSection?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-black shadow-sm text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all shrink-0"
            >
              <Save className="w-4 h-4" />
              <span className="text-xs font-bold">Save Feed</span>
            </button>
          </div>
        </div>
      )}

      <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("feed")}
          className={cn(
            "px-6 py-2 rounded-lg text-xs font-bold transition-all",
            activeTab === "feed" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Feed
        </button>
        <button
          onClick={() => setActiveTab("how-it-works")}
          className={cn(
            "px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
            activeTab === "how-it-works" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Info className="w-3.5 h-3.5" />
          How it works
        </button>
      </div>
    </div>

      {activeTab === "feed" && profile?.savedFilters && profile.savedFilters.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          <span className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Your Feeds:</span>
          {profile.savedFilters.map((filter: any) => (
            <button
              key={filter.id}
              onClick={() => applyFilter(filter, false)}
              className="px-3 py-1.5 bg-white border border-black rounded-full text-xs font-bold text-slate-600 hover:border-blue-600 hover:text-blue-600 transition-all whitespace-nowrap shadow-sm"
            >
              {filter.name}
            </button>
          ))}
        </div>
      )}

      {activeTab === "how-it-works" ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          <div className="bg-white p-6 rounded-3xl border border-black shadow-sm space-y-4">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">1. Search & Smart Sorting</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Find specific jobs using keywords. Use the <strong>Sort</strong> dropdown to prioritize by <strong>Urgency</strong>, <strong>Newest</strong> posts, or <strong>Completion Time</strong> to find the best fit for your schedule.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-black shadow-sm space-y-4">
            <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">2. Best Match Toggle</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Enable <strong>Best Match Only</strong> to instantly filter the feed for jobs that specifically match your listed <strong>Services</strong>, <strong>Trades</strong>, and <strong>Specializations</strong>.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-black shadow-sm space-y-4">
            <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600">
              <Save className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">3. Save Your Custom Feeds</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Found a perfect filter combo? Tap the <strong>Save Feed</strong> icon. Your custom feeds appear as quick-access buttons at the top of your feed for one-tap access later.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-black shadow-sm space-y-4">
            <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
              <Filter className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">4. Multi-Category Filtering</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Select <strong>multiple categories</strong> at once in the filter panel. This allows you to see all jobs relevant to your diverse skill set in a single, unified view.
            </p>
          </div>

          <div className="md:col-span-2 bg-blue-600 p-8 rounded-3xl text-white flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1 space-y-2 text-center md:text-left">
              <h3 className="text-xl font-bold">Ready to find your next job?</h3>
              <p className="text-blue-100 text-sm">Switch back to the Feed tab to see live opportunities in your area.</p>
            </div>
            <button 
              onClick={() => setActiveTab("feed")}
              className="px-6 py-3 bg-white text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-all shadow-lg shadow-blue-900/20"
            >
              Go to Feed
            </button>
          </div>
        </motion.div>
      ) : (
        <>
          {showFilters && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-3xl border border-black shadow-xl space-y-8 relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-900">Filter Jobs</h2>
            <button 
              onClick={() => {
                setUrgencyFilter("any");
                setDistanceFilter("any");
                setPriceFilter("any");
                setSelectedCategories([]);
                setSearchTerm("");
                setShowMatchedOnly(false);
                // Clear localStorage explicitly
                localStorage.removeItem("job_feed_searchTerm");
                localStorage.removeItem("job_feed_selectedCategories");
                localStorage.removeItem("job_feed_sortBy");
                localStorage.removeItem("job_feed_showMatchedOnly");
                localStorage.removeItem("job_feed_urgencyFilter");
                localStorage.removeItem("job_feed_distanceFilter");
                localStorage.removeItem("job_feed_priceFilter");
                // Clear cloud persistence
                if (user) {
                  updateDoc(doc(db, "users", user.uid), {
                    activeFilter: null
                  }).catch(console.error);
                }
              }}
              className="text-sm font-bold text-red-600 hover:text-red-700 transition-colors"
            >
              Reset all
            </button>
          </div>

          {/* Saved Filters Section */}
          {profile?.savedFilters && profile.savedFilters.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600" />
                Saved Feeds
              </h3>
              <div className="flex flex-wrap gap-2">
                {profile.savedFilters.map((filter: any) => (
                  <div 
                    key={filter.id}
                    className="group flex items-center gap-1 bg-blue-50 text-blue-700 px-4 py-2 rounded-full border border-blue-100 hover:bg-blue-100 transition-all shadow-sm"
                  >
                    <button 
                      onClick={() => applyFilter(filter, true)}
                      className="text-xs font-bold"
                    >
                      {filter.name}
                    </button>
                    <button 
                      onClick={() => handleDeleteFilter(filter.id)}
                      className="p-1 hover:bg-blue-200 rounded-full transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Urgency Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Urgency</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "any", name: "Any urgency", icon: null },
                { id: "emergency", name: "Emergency", icon: "🚨" },
                { id: "this_week", name: "This week", icon: "📅" },
                { id: "this_month", name: "This month", icon: "📅" },
                { id: "flexible", name: "Flexible", icon: "🕒" },
              ].map((u) => (
                <button
                  key={u.id}
                  onClick={() => setUrgencyFilter(u.id)}
                  className={cn(
                    "px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2",
                    urgencyFilter === u.id 
                      ? "bg-slate-900 text-white border-slate-900 shadow-md" 
                      : "bg-white text-slate-600 border-black hover:border-black"
                  )}
                >
                  {u.icon && <span>{u.icon}</span>}
                  {u.name}
                </button>
              ))}
            </div>
          </div>

          {/* Distance Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Distance</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "any", name: "Any distance" },
                { id: "5", name: "Within 5 miles" },
                { id: "10", name: "Within 10 miles" },
                { id: "20", name: "Within 20 miles" },
                { id: "50", name: "Within 50 miles" },
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDistanceFilter(d.id)}
                  className={cn(
                    "px-4 py-2 rounded-full text-xs font-bold border transition-all",
                    distanceFilter === d.id 
                      ? "bg-slate-900 text-white border-slate-900 shadow-md" 
                      : "bg-white text-slate-600 border-black hover:border-black"
                  )}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>

          {/* Price Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Estimated Price</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "any", name: "Any price" },
                { id: "under_500", name: "Under £500" },
                { id: "500_2000", name: "£500 – £2,000" },
                { id: "2000_5000", name: "£2,000 – £5,000" },
                { id: "over_5000", name: "Over £5,000" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPriceFilter(p.id)}
                  className={cn(
                    "px-4 py-2 rounded-full text-xs font-bold border transition-all",
                    priceFilter === p.id 
                      ? "bg-slate-900 text-white border-slate-900 shadow-md" 
                      : "bg-white text-slate-600 border-black hover:border-black"
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Category Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Category</h3>
              <button 
                onClick={() => setSelectedCategories([])}
                className="text-xs text-blue-600 font-bold hover:underline"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategories([])}
                className={cn(
                  "px-4 py-2 rounded-full text-xs font-bold border transition-all",
                  selectedCategories.length === 0 
                    ? "bg-slate-900 text-white border-slate-900 shadow-md" 
                    : "bg-white text-slate-600 border-black hover:border-black"
                )}
              >
                All
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => {
                    setSelectedCategories(prev => 
                      prev.includes(category.name) 
                        ? prev.filter(c => c !== category.name)
                        : [...prev, category.name]
                    );
                  }}
                  className={cn(
                    "px-4 py-2 rounded-full text-xs font-bold border transition-all",
                    selectedCategories.includes(category.name) 
                      ? "bg-slate-900 text-white border-slate-900 shadow-md" 
                      : "bg-white text-slate-600 border-black hover:border-black"
                  )}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {/* Save Current Filter Section */}
          <div id="save-feed-section" className="pt-6 border-t border-black space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Save current search & filters</h3>
            <div className="flex gap-2">
              <input 
                type="text"
                placeholder="e.g. Local Plumbing Jobs"
                value={newFilterName}
                onChange={(e) => setNewFilterName(e.target.value)}
                className="flex-1 px-4 py-3 rounded-2xl border border-black focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 text-sm"
              />
              <button 
                onClick={handleSaveFilter}
                disabled={!newFilterName.trim() || isSavingFilter}
                className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/10"
              >
                {isSavingFilter ? "Saving..." : "Save Feed"}
              </button>
            </div>
          </div>

          <button 
            onClick={() => setShowFilters(false)}
            className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 hover:bg-orange-600 transition-all shadow-xl shadow-orange-900/10 active:scale-[0.98]"
          >
            <Filter className="w-5 h-5" />
            Apply Filters & Close
          </button>
        </motion.div>
      )}

      {activeTab === "feed" && (
        <NearbyRequestsSection
          jobs={jobs}
          onSelectCategoryFilter={(cat) => {
            if (cat) {
              setSelectedCategories([cat]);
            } else {
              setSelectedCategories([]);
            }
          }}
        />
      )}

      {filteredJobs.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-black text-center space-y-6 shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
            <Wrench className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-900">No jobs available</h3>
            <p className="text-slate-500 max-w-xs mx-auto">Check back later for new opportunities in your area.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredJobs.map((job) => {
            
            // Entitlements Delay Logic
            const createdAtMs = job.createdAt?.toMillis?.() || new Date(job.createdAt).getTime();
            const isDelayed = !entitlements.canBypassLeadDelay(createdAtMs);
            const delayMinutes = entitlements.entitlements.leadAccessDelayMinutes;
            const unlockTimeMs = createdAtMs + (delayMinutes * 60 * 1000);
            const msRemaining = unlockTimeMs - Date.now();
            const minutesToUnlock = Math.ceil(msRemaining / 60000);

            // Existing Exclusive Timer Logic
            const jobExclusiveUntil = job.exclusiveUntil?.toDate ? job.exclusiveUntil.toDate() : (job.exclusiveUntil ? new Date(job.exclusiveUntil) : null);
            const isCurrentlyExclusive = jobExclusiveUntil && jobExclusiveUntil > new Date() && !job.isBoosted; // Emergency boosts bypass exclusivity visual

            if (isDelayed && !job.isBoosted) {
              return (
                <div
                  key={job.id}
                  className="bg-white/80 rounded-[2rem] border border-black shadow-sm overflow-hidden group relative"
                >
                  <div className="p-5 flex items-center gap-4 relative">
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center p-4">
                      <div className="bg-slate-900/90 text-white px-6 py-4 rounded-2xl shadow-xl max-w-sm w-full text-center border border-slate-800">
                        <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Clock className="w-6 h-6 text-blue-400" />
                        </div>
                        <h4 className="font-bold text-lg mb-1">Lead Locked</h4>
                        <p className="text-sm text-slate-300 mb-4 px-2">
                          Pro members are viewing this lead right now. You gain access in <span className="font-bold text-white">{minutesToUnlock}m</span>.
                        </p>
                        <Link 
                          to="/billing"
                          className="inline-block w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-sm shadow-md shadow-blue-500/20"
                        >
                          Upgrade to Pro
                        </Link>
                      </div>
                    </div>
                    {/* Blurred Background Details */}
                    <div className="flex-1 min-w-0 opacity-40 select-none">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                          {job.category}
                        </span>
                      </div>
                      <h4 className="font-bold text-lg text-slate-900 mb-2">
                        {job.title.replace(/[a-zA-Z]/g, "x")}
                      </h4>
                      <p className="text-sm text-slate-500 line-clamp-2">
                        {job.description.replace(/[a-zA-Z]/g, "x")}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }

            return (
            <Link
              key={job.id}
              to={`/job/${job.id}`}
              className={cn(
                "bg-white rounded-[2rem] border shadow-md hover:shadow-xl transition-all overflow-hidden group relative",
                job.isBoosted ? "border-red-500 shadow-red-500/20" : "border-black hover:border-blue-300"
              )}
            >
              {job.isBoosted && (
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500" />
              )}
              <div className="p-5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {job.isBoosted && (
                          <span className="flex items-center gap-1 text-[10px] font-black uppercase text-white bg-red-600 px-2 py-0.5 rounded-md shadow-sm shadow-red-600/20 animate-pulse">
                            <Zap className="w-3 h-3 fill-current" />
                            Premium Emergency
                          </span>
                        )}
                        {job.jobNo && (
                          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                            #{job.jobNo}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                          {(() => {
                            const category = categories.find(c => c.name === job.category);
                            if (category) {
                              const Icon = iconMap[category.icon];
                              return Icon ? <Icon className="w-3 h-3" /> : <span className="text-[10px]">{category.icon}</span>;
                            }
                            return <Wrench className="w-3 h-3" />;
                          })()}
                          {job.category}
                        </span>
                        {job.subcategory && (
                          <span className="text-[10px] font-bold uppercase text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-black">
                            {job.subcategory}
                          </span>
                        )}
                        {(profile?.services?.some((s: string) => 
                          job.title.toLowerCase().includes(s.toLowerCase()) || 
                          job.description.toLowerCase().includes(s.toLowerCase()) ||
                          job.category.toLowerCase().includes(s.toLowerCase()) ||
                          (job.subcategory && job.subcategory.toLowerCase().includes(s.toLowerCase()))
                        ) || profile?.tags?.some((t: string) => 
                          job.title.toLowerCase().includes(t.toLowerCase()) || 
                          job.description.toLowerCase().includes(t.toLowerCase()) ||
                          job.category.toLowerCase().includes(t.toLowerCase()) ||
                          (job.subcategory && job.subcategory.toLowerCase().includes(t.toLowerCase()))
                        ) || profile?.trades?.some((trade: string) => 
                          job.category.toLowerCase() === trade.toLowerCase()
                        )) && (
                          <span className="text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                            <Zap className="w-3 h-3 fill-current" />
                            Best Match
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-lg text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                        {job.title}
                      </h4>
                    </div>
                    <div className="sm:text-right flex-shrink-0">
                      <div className="text-lg font-black text-green-600">
                        £{job.estimateMin} - £{job.estimateMax}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                        Estimated Budget
                      </div>
                    </div>
                  </div>
                  
                  {(() => {
                    const jobExclusiveUntil = job.exclusiveUntil?.toDate ? job.exclusiveUntil.toDate() : (job.exclusiveUntil ? new Date(job.exclusiveUntil) : null);
                    const isCurrentlyExclusive = jobExclusiveUntil && jobExclusiveUntil > new Date();
                    
                    if (isCurrentlyExclusive) {
                      const minutesRemaining = Math.max(0, Math.floor((jobExclusiveUntil.getTime() - Date.now()) / 60000));
                      return (
                        <div className="mb-3">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-[10px] font-black uppercase text-white shadow-sm ring-1 ring-amber-500/50">
                            <Zap className="w-3.5 h-3.5 fill-current" />
                            Exclusive Access: {minutesRemaining}m remaining
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <p className="text-sm text-slate-500 line-clamp-2 mb-4">{job.description}</p>
                  
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span>{getOutwardPostcode(job.postcode)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-400" />
                      {job.urgency === "emergency" ? (
                        <EmergencyTimer postedDate={job.createdAt?.seconds ? new Date(job.createdAt.seconds * 1000) : job.createdAt} />
                      ) : (
                        <span className={cn(
                          job.urgency === "asap" ? "text-orange-600 font-bold" : ""
                        )}>
                          {job.urgency === "specific_date" && job.jobDate ? `Date: ${new Date(job.jobDate).toLocaleDateString()}` : job.urgency || "Flexible"}
                        </span>
                      )}
                    </div>
                    <div className={cn(
                      "flex items-center gap-1.5",
                      (job.quoteCount || 0) >= 5 ? "text-red-600 font-bold" : "text-blue-600 font-bold"
                    )}>
                      <PoundSterling className={cn("w-4 h-4", (job.quoteCount || 0) >= 5 ? "text-red-500" : "text-blue-500")} />
                      <span>{job.quoteCount || 0} Quotes (Max 5)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>Posted {new Date(job.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString('en-GB')}</span>
                    </div>
                  </div>

                  {(job.paymentPreference || job.quoteScope || job.estimatedCompletionTime || job.photos?.length > 0 || job.videos?.length > 0) && (
                    <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-black">
                      {job.paymentPreference && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200 uppercase tracking-wider">
                          {job.paymentPreference.replace('_', ' ')}
                        </span>
                      )}
                      {job.quoteScope && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200 uppercase tracking-wider">
                          {job.quoteScope.replace('_', ' ')}
                        </span>
                      )}
                      {job.estimatedCompletionTime && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200 uppercase tracking-wider">
                          {job.estimatedCompletionTime} {job.estimatedCompletionTimeUnit}
                        </span>
                      )}
                      {(job.photos?.length > 0 || job.videos?.length > 0) && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedJobMedia(job);
                          }}
                          className="ml-auto flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          {job.photos?.length > 0 ? <ImageIcon className="w-4 h-4" /> : <VideoIcon className="w-4 h-4" />}
                          <span>{ (job.photos?.length || 0) + (job.videos?.length || 0) } Media</span>
                        </button>
                      )}
                    </div>
                  )}
                  {profile?.role === "tradesperson" && (
                    (job.quoteCount || 0) >= 5 ? (
                      <div className="mt-4 w-full bg-yellow-50 text-yellow-700 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 border border-black">
                        <FileText className="w-4 h-4" />
                        Quote Limit Reached
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(`/job/${job.id}?quickQuote=true`);
                        }}
                        className="mt-4 w-full bg-orange-500 text-white py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-orange-600 transition-all shadow-lg shadow-orange-100 active:scale-[0.98]"
                      >
                        <FileText className="w-4 h-4" />
                        Quick Quote
                        <span className="ml-auto bg-white/20 px-2 py-0.5 rounded-lg text-[10px]">
                          AI: £{job.estimateMin}-£{job.estimateMax}
                        </span>
                      </button>
                    )
                  )}
                </div>
                
                <div className="hidden sm:block">
                  <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-blue-600 transition-colors" />
                </div>
              </div>
              <div className="sm:hidden bg-slate-50 p-3 text-center text-xs font-bold text-blue-600 border-t border-black">
                View Details
              </div>
            </Link>
          );
        })}
        </div>
      )}

      {jobs.length === limitCount && (
        <div className="flex justify-center p-6 mt-4">
          <button
            onClick={() => setLimitCount(prev => prev + 50)}
            className="px-6 py-3 bg-white border border-black rounded-2xl font-black text-sm hover:bg-slate-50 transition-all flex items-center gap-2 active:scale-95 shadow-sm text-slate-900"
          >
            <span>LOAD MORE OPPORTUNITIES</span>
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  )}

  <AnimatePresence>
    {selectedCategories.length > 0 && !isCurrentSearchSaved && (
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-20 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md z-40"
      >
        <div className="bg-blue-600 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Save className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm">Save selection as feed</p>
              <p className="text-xs text-blue-100">Get notified for new jobs</p>
            </div>
          </div>
          <button
            onClick={() => {
              setShowFilters(true);
              setTimeout(() => {
                const element = document.getElementById('save-feed-section');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth' });
                  // Focus the input field
                  const input = element.querySelector('input');
                  if (input) input.focus();
                }
              }, 100);
            }}
            className="px-4 py-2 bg-white text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors whitespace-nowrap"
          >
            SAVE NOW
          </button>
        </div>
      </motion.div>
    )}
  </AnimatePresence>

      <MediaGalleryModal
        isOpen={!!selectedJobMedia}
        onClose={() => setSelectedJobMedia(null)}
        photos={selectedJobMedia?.photos}
        videos={selectedJobMedia?.videos}
        title={selectedJobMedia?.title || "Job Media"}
      />
      </div>
    </PullToRefresh>
  );
}

import { textContainsTokenMatch } from "@/src/lib/fuzzyMatch";
import React, { useEffect, useState, useMemo } from "react";
import { db, collection, collectionGroup, query, where, orderBy, limit, getDocs, onSnapshot, type FirebaseUser, handleFirestoreError, OperationType, updateDoc, setDoc, doc } from "@/src/firebase";
import { parseNaturalLanguageSearch } from "@/src/services/gemini";
import { useAuth } from "./AuthProvider";
import { motion, AnimatePresence } from "motion/react";
import { Briefcase, Clock, MapPin, ChevronRight, Search, Filter, Wrench, X, Image as ImageIcon, Video as VideoIcon, ChevronDown, ChevronUp, Info, Star, Save, Zap, Loader2, PoundSterling, Calendar, FileText, AlertCircle, Mic, CheckCircle2, History, Plus, Trash2, RefreshCw } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { cn, getOutwardPostcode, formatJobLocation, calculateDistanceMiles } from "@/src/lib/utils";
import { URGENCY_LEVELS } from "@/src/constants";
import { useCategories } from "../lib/CategoryProvider";
import MediaGalleryModal from "./MediaGalleryModal";
import { SEO } from "./SEO";
import { useEntitlements } from "../lib/useEntitlements";
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import { toast } from "sonner";
import { PullToRefresh } from "./common/PullToRefresh";
import { calculateTraderMatchScore, type MatchEngineResult } from "@/src/services/matchingEngine";
import { QuickQuoteModal } from "./job-feed/QuickQuoteModal";

const iconMap: Record<string, any> = {
  Wrench, Briefcase, Clock, MapPin, Search, Filter, X
};

import { EmergencyTimer } from "./EmergencyTimer";
import { NearbyRequestsSection } from "./job-feed/NearbyRequestsSection";

export default function JobFeed() {
  const { user, profile, setProfile } = useAuth();
  const navigate = useNavigate();
  const { categories } = useCategories();
  const entitlements = useEntitlements();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [limitCount, setLimitCount] = useState(50);
  
  // Track quotes submitted by this tradesperson
  const [myQuotes, setMyQuotes] = useState<Record<string, any>>({});
  const [quickQuoteJob, setQuickQuoteJob] = useState<any | null>(null);
  
  // Geolocation coordinates from storage or device
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(() => {
    try {
      const saved = localStorage.getItem("user_geo_coords");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

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
  const [sortBy, setSortBy] = useState<"match" | "newest" | "urgency" | "completion">(() => {
    if (profile?.activeFilter?.sortBy) return profile.activeFilter.sortBy;
    const local = localStorage.getItem("job_feed_sortBy") as any;
    if (local) return local;
    return profile?.role === "tradesperson" ? "match" : "newest";
  });
  const [activeTab, setActiveTab] = useState<"feed" | "how-it-works">("feed");
  const [showFilters, setShowFilters] = useState(false);
  const [showMatchedOnly, setShowMatchedOnly] = useState(() => {
    if (profile?.activeFilter?.showMatchedOnly !== undefined) {
      return profile.activeFilter.showMatchedOnly;
    }
    const stored = localStorage.getItem("job_feed_showMatchedOnly");
    if (stored !== null) {
      return stored === "true";
    }
    // Default to true for tradespeople so they see jobs in their trade by default
    return profile?.role === "tradesperson";
  });
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
  const [selectedSavedFilterIds, setSelectedSavedFilterIds] = useState<string[]>([]);
  const [filterToDelete, setFilterToDelete] = useState<any | null>(null);
  const [dismissedFilterKey, setDismissedFilterKey] = useState<string | null>(null);
  const [hasSyncedFromCloud, setHasSyncedFromCloud] = useState(false);
  const [sysConfig, setSysConfig] = useState<any>(null);

  // Dynamic filter signature representing current selection state
  const currentFilterKey = useMemo(() => {
    return [
      [...selectedCategories].sort().join(','),
      searchTerm.trim().toLowerCase(),
      urgencyFilter,
      distanceFilter,
      priceFilter,
      showMatchedOnly
    ].join('|');
  }, [selectedCategories, searchTerm, urgencyFilter, distanceFilter, priceFilter, showMatchedOnly]);

  // Banner is only dismissed if explicitly closed for this exact current filter selection
  const isSaveBannerDismissed = dismissedFilterKey !== null && dismissedFilterKey === currentFilterKey;

  // Unified saved filters combining profile and localStorage fallback for instant updates
  const savedFiltersList: any[] = useMemo(() => {
    if (profile?.savedFilters && Array.isArray(profile.savedFilters) && profile.savedFilters.length > 0) {
      return profile.savedFilters;
    }
    try {
      const local = localStorage.getItem("job_feed_savedFilters");
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  }, [profile?.savedFilters]);
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
    if (profile && !hasSyncedFromCloud) {
      if (profile.activeFilter) {
        const af = profile.activeFilter;
        if (af.searchTerm) setSearchTerm(af.searchTerm);
        if (af.categories) setSelectedCategories(af.categories);
        if (af.sortBy) setSortBy(af.sortBy);
        if (af.showMatchedOnly !== undefined) setShowMatchedOnly(af.showMatchedOnly);
        if (af.urgencyFilter) setUrgencyFilter(af.urgencyFilter);
        if (af.distanceFilter) setDistanceFilter(af.distanceFilter);
        if (af.priceFilter) setPriceFilter(af.priceFilter);
      } else if (profile.role === "tradesperson") {
        // Default tradespeople to show matched jobs for their trade if no active filter stored
        const stored = localStorage.getItem("job_feed_showMatchedOnly");
        if (stored !== "false") {
          setShowMatchedOnly(true);
        }
      }
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

  const handleSaveFilter = async (nameOverride?: string) => {
    const filterName = (typeof nameOverride === "string" ? nameOverride : newFilterName).trim();
    if (!filterName) {
      toast.error("Please enter a name for this filter feed.");
      return;
    }
    const currentFilters = [...savedFiltersList];
    if (currentFilters.length >= 4) {
      toast.error("Maximum 4 saved job feed filters allowed. Please delete an existing filter first.");
      return;
    }
    setIsSavingFilter(true);
    try {
      const newFilter = {
        id: Date.now().toString(),
        name: filterName,
        searchTerm,
        categories: selectedCategories,
        sortBy,
        showMatchedOnly,
        urgencyFilter,
        distanceFilter,
        priceFilter,
        createdAt: new Date().toISOString()
      };
      
      const updatedFilters = [...currentFilters, newFilter];

      // 1. Optimistically update local profile state for instantaneous UI feedback
      if (setProfile) {
        setProfile((prev) => prev ? ({ ...prev, savedFilters: updatedFilters }) : ({ savedFilters: updatedFilters } as any));
      }

      // 2. Persist to localStorage for immediate offline and persistent recall
      try {
        localStorage.setItem("job_feed_savedFilters", JSON.stringify(updatedFilters));
      } catch (e) {
        console.warn("Could not save filter to localStorage:", e);
      }

      // 3. Automatically select the newly created filter tab so the feed immediately reflects it
      setSelectedSavedFilterIds((prev) => [...prev.filter((id) => id !== newFilter.id), newFilter.id]);

      // 4. Cloud persistence with merge:true (safe against non-existent doc or strict schemas)
      if (user) {
        try {
          await setDoc(doc(db, "users", user.uid), {
            savedFilters: updatedFilters
          }, { merge: true });
        } catch (cloudErr) {
          console.warn("Cloud persistence warning for saved filter:", cloudErr);
        }
      }

      setNewFilterName("");
      setDismissedFilterKey(currentFilterKey);
      setShowFilters(false);
      toast.success(`Saved filter collection "${newFilter.name}"`);
    } catch (err) {
      console.error("Error saving filter:", err);
      toast.error("Failed to save filter collection. Please try again.");
    } finally {
      setIsSavingFilter(false);
    }
  };

  const handleDeleteFilter = async (filterId: string) => {
    const currentFilters = [...savedFiltersList];
    const updatedFilters = currentFilters.filter((f: any) => f.id !== filterId);
    
    // 1. Optimistic profile update
    if (setProfile) {
      setProfile((prev) => prev ? ({ ...prev, savedFilters: updatedFilters }) : null);
    }
    // 2. Local storage sync
    try {
      localStorage.setItem("job_feed_savedFilters", JSON.stringify(updatedFilters));
    } catch (e) {}

    // 3. Remove from active selections
    setSelectedSavedFilterIds((prev) => prev.filter((id) => id !== filterId));

    // 4. Cloud sync
    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid), {
          savedFilters: updatedFilters
        }, { merge: true });
        toast.success("Filter collection deleted");
      } catch (err) {
        console.error("Error deleting filter from cloud:", err);
        toast.error("Failed to delete filter collection from cloud");
      }
    } else {
      toast.success("Filter collection deleted");
    }
  };

  const resetAllFilters = () => {
    setUrgencyFilter("any");
    setDistanceFilter("any");
    setPriceFilter("any");
    setSelectedCategories([]);
    setSearchTerm("");
    setShowMatchedOnly(false);
    setSelectedSavedFilterIds([]);
    setDismissedFilterKey(null);

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
    toast.success("All filters cleared");
  };

  const handleSelectCategoryFromNearby = (cat: string) => {
    setDismissedFilterKey(null);
    if (!cat) {
      setSelectedCategories([]);
      return;
    }
    // Tapping a category pill expresses clear user intent to view that category's jobs
    setSelectedCategories([cat]);
    setSelectedSavedFilterIds([]);
    setSearchTerm("");
    setShowMatchedOnly(false);
    setDistanceFilter("any");
    setPriceFilter("any");
    if (urgencyFilter !== "any") {
      setUrgencyFilter("any");
    }
  };

  const handleSelectUrgencyFromNearby = (urgency: string) => {
    setUrgencyFilter(urgency);
    if (urgency !== "any") {
      setSelectedSavedFilterIds([]);
    }
  };

  const handleClearDemandFilter = () => {
    setSelectedCategories([]);
    setDismissedFilterKey(null);
    if (urgencyFilter === "emergency") {
      setUrgencyFilter("any");
    }
    toast.success("Demand filters cleared");
  };

  const hasActiveFilters = 
    selectedCategories.length > 0 ||
    searchTerm.trim() !== "" ||
    urgencyFilter !== "any" ||
    distanceFilter !== "any" ||
    priceFilter !== "any" ||
    showMatchedOnly ||
    selectedSavedFilterIds.length > 0;

  const activeFilterSummary = useMemo(() => {
    const parts: string[] = [];

    if (selectedCategories.length > 0) {
      parts.push(selectedCategories.join(", "));
    }

    if (urgencyFilter !== "any") {
      if (urgencyFilter === "emergency") parts.push("Urgent / Emergency");
      else if (urgencyFilter === "this_week") parts.push("This Week");
      else if (urgencyFilter === "this_month") parts.push("This Month");
      else if (urgencyFilter === "flexible") parts.push("Flexible / Routine");
      else parts.push(`Urgency: ${urgencyFilter}`);
    }

    if (searchTerm.trim()) {
      parts.push(`"${searchTerm.trim()}"`);
    }

    if (distanceFilter !== "any") {
      parts.push(`Within ${distanceFilter} mi`);
    }

    if (priceFilter !== "any") {
      parts.push(`Budget: ${priceFilter.replace('_', ' ')}`);
    }

    if (showMatchedOnly) {
      parts.push("Best Matches");
    }

    if (selectedSavedFilterIds.length > 0) {
      const names = savedFiltersList
        .filter((sf) => selectedSavedFilterIds.includes(sf.id))
        .map((sf) => sf.name);
      if (names.length > 0) {
        parts.push(names.join(", "));
      } else {
        parts.push(`Saved Feeds (${selectedSavedFilterIds.length})`);
      }
    }

    return parts;
  }, [
    selectedCategories,
    urgencyFilter,
    searchTerm,
    distanceFilter,
    priceFilter,
    showMatchedOnly,
    selectedSavedFilterIds,
    savedFiltersList,
  ]);

  const availableDemandCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    jobs.forEach((j) => {
      const cat = j.category || "General";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }, [jobs]);

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
    setDismissedFilterKey(null);
    setSearchTerm(filter.searchTerm || "");
    setSelectedCategories(filter.categories || (filter.category ? [filter.category] : []));
    if (filter.sortBy) setSortBy(filter.sortBy);
    if (filter.showMatchedOnly !== undefined) setShowMatchedOnly(filter.showMatchedOnly);
    if (filter.urgencyFilter) setUrgencyFilter(filter.urgencyFilter);
    if (filter.distanceFilter) setDistanceFilter(filter.distanceFilter);
    if (filter.priceFilter) setPriceFilter(filter.priceFilter);
    if (autoShowFilters) setShowFilters(true);
  };

  // Listen for the tradesperson's submitted quotes to display active quote status
  useEffect(() => {
    if (!user || profile?.role !== "tradesperson") {
      setMyQuotes({});
      return;
    }

    try {
      const quotesQuery = query(
        collectionGroup(db, "quotes"),
        where("tradespersonId", "==", user.uid)
      );

      const unsubscribe = onSnapshot(quotesQuery, (snapshot) => {
        const qMap: Record<string, any> = {};
        snapshot.docs.forEach((docSnap) => {
          const qData = docSnap.data();
          const targetJobId = qData.jobId || docSnap.ref.parent.parent?.id;
          if (targetJobId) {
            qMap[targetJobId] = { id: docSnap.id, ...qData };
          }
        });
        setMyQuotes(qMap);
      }, (error) => {
        console.warn("Could not listen to tradesperson quotes (will fallback gracefully):", error);
      });

      return () => unsubscribe();
    } catch (e) {
      console.warn("Error setting up quotes listener:", e);
    }
  }, [user?.uid, profile?.role]);

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
      const uniqueJobsMap = new Map<string, any>();
      snapshot.docs.forEach(doc => {
        uniqueJobsMap.set(doc.id, { id: doc.id, ...doc.data() });
      });
      setJobs(Array.from(uniqueJobsMap.values()));
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
        const uniqueJobsMap = new Map<string, any>();
        fallbackSnapshot.docs.forEach(doc => {
          uniqueJobsMap.set(doc.id, { id: doc.id, ...doc.data() });
        });
        const jobsData = Array.from(uniqueJobsMap.values())
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
      const uniqueJobsMap = new Map<string, any>();
      snapshot.docs.forEach(doc => {
        uniqueJobsMap.set(doc.id, { id: doc.id, ...doc.data() });
      });
      setJobs(Array.from(uniqueJobsMap.values()));
      toast.success("Job feed refreshed");
    } catch (err) {
      console.error("Error refreshing job feed:", err);
      toast.error("Failed to refresh job feed");
    }
  };

  // Pre-calculate 40+ signal intelligent match scores for tradespeople
  const traderMatchScores = useMemo(() => {
    if (!profile || profile.role !== "tradesperson") return {};
    const scores: Record<string, MatchEngineResult> = {};
    jobs.forEach(job => {
      try {
        scores[job.id] = calculateTraderMatchScore(profile, job);
      } catch (err) {
        console.warn(`Error computing match score for job ${job.id}:`, err);
      }
    });
    return scores;
  }, [jobs, profile]);

  const filteredJobs = jobs.filter(job => {
    // Time-Gate Security Check
    const jobExclusiveUntil = job.exclusiveUntil?.toDate ? job.exclusiveUntil.toDate() : (job.exclusiveUntil ? new Date(job.exclusiveUntil) : null);
    const isCurrentlyExclusive = jobExclusiveUntil && jobExclusiveUntil > new Date();
    
    // Hide if it's currently exclusive and the user DOES NOT have active fast pass AND the paywall is active
    if (isCurrentlyExclusive && (!profile?.hasExclusiveAddon || profile?.isExclusiveActive === false) && sysConfig?.paywallEnabled !== false) {
      return false;
    }

    // Hide if job has reached maximum quotes limit (5) and user hasn't already quoted on it
    const hasMyQuote = !!myQuotes[job.id];
    if ((job.quoteCount || 0) >= 5 && !hasMyQuote) {
      return false;
    }

    const searchLower = searchTerm.toLowerCase();
    const normalizedSearch = searchLower.replace(/[^a-z0-9]/g, '');
    const jobNoNormalized = job.jobNo?.toLowerCase().replace(/[^a-z0-9]/g, '') || "";

    const matchesSearch = !searchTerm.trim() ||
                         textContainsTokenMatch(job.title, searchTerm) || 
                         textContainsTokenMatch(job.description, searchTerm) ||
                         (normalizedSearch !== "" && jobNoNormalized.startsWith(normalizedSearch));
    const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(job.category);
    
    // Base filters that always apply
    const baseFiltersMatch = matchesSearch && matchesCategory;

    // Urgency Filter
    let matchesUrgency = true;
    if (urgencyFilter !== "any") {
      if (urgencyFilter === "emergency") matchesUrgency = job.urgency === "emergency" || job.urgency === "asap" || job.isEmergency === true;
      else if (urgencyFilter === "this_week") matchesUrgency = job.urgency === "this_week";
      else if (urgencyFilter === "flexible") matchesUrgency = job.urgency === "flexible" || job.urgency === "routine";
      else if (urgencyFilter === "this_month") {
        const now = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(now.getDate() + 30);
        
        if (job.jobDate) {
          const jobDate = new Date(job.jobDate);
          matchesUrgency = jobDate >= now && jobDate <= thirtyDaysFromNow;
        } else {
          // If no specific date, treat "flexible", "routine" or "this_week" as potentially within this month
          matchesUrgency = job.urgency === "flexible" || job.urgency === "routine" || job.urgency === "this_week" || job.urgency === "asap";
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

    // Distance Calculation & Filter
    let calculatedDistance: number | null = null;
    const jobLat = job.lat || job.latitude || job.location?.lat;
    const jobLng = job.lng || job.longitude || job.location?.lng;

    if (userCoords && jobLat && jobLng) {
      calculatedDistance = calculateDistanceMiles(userCoords.lat, userCoords.lng, jobLat, jobLng);
    } else if (profile?.postcode && job.postcode) {
      const p1 = profile.postcode.split(" ")[0].toUpperCase();
      const p2 = job.postcode.split(" ")[0].toUpperCase();
      if (p1 === p2) calculatedDistance = 1.5;
      else if (p1.slice(0, 2) === p2.slice(0, 2)) calculatedDistance = 6.0;
      else calculatedDistance = 18.0;
    }

    let matchesDistance = true;
    if (distanceFilter !== "any") {
      const maxDist = Number(distanceFilter);
      if (!isNaN(maxDist) && calculatedDistance !== null) {
        matchesDistance = calculatedDistance <= maxDist;
      }
    }

    // Normalize user's registered trades, categories, services, and skills safely
    const rawTrades = Array.isArray(profile?.trades)
      ? profile.trades
      : typeof profile?.trades === "string"
      ? (profile.trades as string).split(",")
      : [];
    const userTrades: string[] = [
      ...rawTrades,
      profile?.category,
      profile?.tradeCategory,
      profile?.primaryTrade,
      profile?.businessType
    ].filter(Boolean).map((t: string) => t.trim());

    const rawServices = Array.isArray(profile?.services)
      ? profile.services
      : typeof profile?.services === "string"
      ? (profile.services as string).split(",")
      : [];
    const userServices: string[] = rawServices.filter(Boolean).map((s: string) => s.trim());

    const rawTags = [
      ...(Array.isArray(profile?.tags) ? profile.tags : typeof profile?.tags === "string" ? (profile.tags as string).split(",") : []),
      ...(Array.isArray(profile?.skills) ? profile.skills : typeof profile?.skills === "string" ? (profile.skills as string).split(",") : []),
      ...(Array.isArray(profile?.specialties) ? profile.specialties : typeof profile?.specialties === "string" ? (profile.specialties as string).split(",") : [])
    ];
    const userTags: string[] = rawTags.filter(Boolean).map((t: string) => t.trim());

    const matchesTrade = userTrades.some((trade: string) => {
      const tLower = trade.toLowerCase();
      const jCat = (job.category || "").toLowerCase();
      const jSub = (job.subcategory || "").toLowerCase();
      const jTitle = (job.title || "").toLowerCase();
      const jDesc = (job.description || "").toLowerCase();

      if (jCat === tLower || jCat.includes(tLower) || tLower.includes(jCat)) return true;
      if (jSub && (jSub === tLower || jSub.includes(tLower) || tLower.includes(jSub))) return true;
      if (jTitle.includes(tLower) || tLower.includes(jTitle)) return true;
      if (jDesc.includes(tLower)) return true;
      if (textContainsTokenMatch(jCat, tLower) || textContainsTokenMatch(jSub, tLower) || textContainsTokenMatch(jTitle, tLower)) return true;
      return false;
    });

    const matchesService = userServices.some((service: string) => {
      const sLower = service.toLowerCase();
      const jCat = (job.category || "").toLowerCase();
      const jSub = (job.subcategory || "").toLowerCase();
      const jTitle = (job.title || "").toLowerCase();
      const jDesc = (job.description || "").toLowerCase();

      return jCat.includes(sLower) || jSub.includes(sLower) || jTitle.includes(sLower) || jDesc.includes(sLower) || textContainsTokenMatch(jCat, sLower) || textContainsTokenMatch(jTitle, sLower);
    });

    const matchesSpecialization = userTags.some((tag: string) => {
      const tLower = tag.toLowerCase();
      const jCat = (job.category || "").toLowerCase();
      const jSub = (job.subcategory || "").toLowerCase();
      const jTitle = (job.title || "").toLowerCase();
      const jDesc = (job.description || "").toLowerCase();

      return jCat.includes(tLower) || jSub.includes(tLower) || jTitle.includes(tLower) || jDesc.includes(tLower) || textContainsTokenMatch(jTitle, tLower);
    });

    const matchEngineScore = traderMatchScores[job.id]?.compositeScore || 0;
    const isMatched = matchesService || matchesSpecialization || matchesTrade || matchEngineScore >= 50;
    
    // Filter out jobs scheduled for dates the tradesperson is busy or booked
    let matchesAvailability = true;
    if (job.urgency === "specific_date" && job.jobDate && profile?.dateOverrides) {
      const overrideStatus = profile.dateOverrides[job.jobDate];
      if (overrideStatus === "busy" || overrideStatus === "booked") {
        matchesAvailability = false;
      }
    }

    // If any saved filter tabs are selected, check if job matches AT LEAST ONE selected saved filter
    let matchesSelectedSavedFilters = true;
    if (selectedSavedFilterIds.length > 0 && savedFiltersList.length > 0) {
      const activeSavedFilters = savedFiltersList.filter((f: any) => selectedSavedFilterIds.includes(f.id));
      if (activeSavedFilters.length > 0) {
        matchesSelectedSavedFilters = activeSavedFilters.some((f: any) => {
          if (f.searchTerm && f.searchTerm.trim() !== "") {
            const term = f.searchTerm.toLowerCase().trim();
            const inTitle = textContainsTokenMatch(job.title, term);
            const inDesc = textContainsTokenMatch(job.description, term);
            const inCat = job.category?.toLowerCase().includes(term);
            const inJobNo = job.jobNo?.toLowerCase().includes(term);
            if (!inTitle && !inDesc && !inCat && !inJobNo) return false;
          }

          const fCats = f.categories || (f.category ? [f.category] : []);
          if (fCats.length > 0 && !fCats.includes(job.category)) {
            return false;
          }

          if (f.urgencyFilter && f.urgencyFilter !== "any") {
            if (f.urgencyFilter === "emergency" && !(job.urgency === "emergency" || job.urgency === "asap" || job.isEmergency)) return false;
            if (f.urgencyFilter === "this_week" && job.urgency !== "this_week") return false;
            if (f.urgencyFilter === "flexible" && job.urgency !== "flexible") return false;
          }

          if (f.priceFilter && f.priceFilter !== "any") {
            const min = job.estimateMin || 0;
            const max = job.estimateMax || 0;
            if (f.priceFilter === "under_500" && max > 500) return false;
            if (f.priceFilter === "500_2000" && !((min >= 500 && min <= 2000) || (max >= 500 && max <= 2000))) return false;
            if (f.priceFilter === "2000_5000" && !((min >= 2000 && min <= 5000) || (max >= 2000 && max <= 5000))) return false;
            if (f.priceFilter === "over_5000" && min < 5000) return false;
          }

          return true;
        });
      }
    }

    const allCriteriaMatch = baseFiltersMatch && matchesAvailability && matchesUrgency && matchesPrice && matchesDistance && matchesSelectedSavedFilters;

    if (showMatchedOnly) {
      return isMatched && allCriteriaMatch;
    }

    return allCriteriaMatch;
  }).sort((a, b) => {
    // 1. Boosted emergency jobs ALWAYS go to the top
    if (a.isBoosted && !b.isBoosted) return -1;
    if (!a.isBoosted && b.isBoosted) return 1;

    // 2. Best Match sort for tradespeople
    if (sortBy === "match") {
      const scoreA = traderMatchScores[a.id]?.compositeScore || 0;
      const scoreB = traderMatchScores[b.id]?.compositeScore || 0;
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
      // If equal match score, fall back to newest
      const dateA = a.createdAt?.seconds || 0;
      const dateB = b.createdAt?.seconds || 0;
      return dateB - dateA;
    }

    // 3. Newest sort
    if (sortBy === "newest") {
      const dateA = a.createdAt?.seconds || 0;
      const dateB = b.createdAt?.seconds || 0;
      return dateB - dateA;
    }
    
    // 4. Urgency sort
    if (sortBy === "urgency") {
      const urgencyOrder = ["emergency", "asap", "this_week", "flexible", "specific_date"];
      const indexA = urgencyOrder.indexOf(a.urgency);
      const indexB = urgencyOrder.indexOf(b.urgency);
      return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
    }
    
    // 5. Completion time sort
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

  const isCurrentSearchSaved = savedFiltersList.some((f: any) => {
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
    <div className="space-y-3">
      {/* Header Row: Title + Mode Switcher Tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
        <h1 className="text-2xl sm:text-3xl font-display font-black text-slate-900 tracking-tight">Job Feed</h1>
        
        {/* Compact Mode Switcher Tabs */}
        <div className="flex p-1 bg-slate-100 border border-black/10 rounded-xl shrink-0">
          <button
            onClick={() => setActiveTab("feed")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              activeTab === "feed" 
                ? "bg-slate-900 text-white shadow-xs" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Feed
          </button>
          <button
            onClick={() => setActiveTab("how-it-works")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
              activeTab === "how-it-works" 
                ? "bg-slate-900 text-white shadow-xs" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Info className="w-3.5 h-3.5" />
            How it works
          </button>
        </div>
      </div>

      {activeTab === "feed" && (
        <div className="space-y-2.5">
          {/* Main Search Input & Filter Button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input 
                type="text" 
                placeholder={isListening ? "Listening..." : "Search title, Job #..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAiSearch()}
                className={cn(
                  "w-full pl-9 pr-9 h-10 rounded-xl border transition-all text-xs font-medium shadow-xs focus:outline-none focus:ring-2",
                  isListening ? "border-red-500 bg-red-50 focus:ring-red-500/10" : "border-black bg-white focus:ring-primary/10 focus:border-primary"
                )}
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 group">
                <button 
                  onClick={startVoiceSearch}
                  title="Voice Search"
                  type="button"
                  className={cn(
                    "p-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer",
                    isListening ? "bg-red-500 text-white animate-pulse shadow-md shadow-red-500/20" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  )}
                >
                  <Mic className="w-3.5 h-3.5" />
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
            </div>

            <button 
              onClick={handleAiSearch}
              disabled={isAiSearching || !searchTerm.trim()}
              title="AI Smart Search"
              className="h-10 px-3 rounded-xl border border-black bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-extrabold flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer shadow-xs active:scale-95 whitespace-nowrap"
            >
              {isAiSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-blue-600" />}
              <span>AI Search</span>
            </button>

            {isAiSearching && (
              <button 
                onClick={() => setIsAiSearching(false)}
                className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-all shrink-0 cursor-pointer"
              >
                Skip
              </button>
            )}

            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "h-10 w-10 rounded-xl border transition-all shadow-xs flex items-center justify-center shrink-0 cursor-pointer active:scale-95",
                showFilters ? "bg-slate-900 border-black text-white shadow-md" : "bg-white border-black text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
              title="Filter jobs"
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>

          {/* Sort & Filter Controls Row */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 w-full max-w-full">
            <div className="flex items-center gap-1.5 px-3 h-9 bg-white rounded-xl border border-black shadow-xs shrink-0">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sort:</span>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer pr-1"
              >
                <option value="match">✨ Best Match</option>
                <option value="newest">Newest</option>
                <option value="urgency">Urgency</option>
                <option value="completion">Time</option>
              </select>
            </div>

            {/* Best Match Clickable Toggle Pill */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setShowMatchedOnly(!showMatchedOnly)}
              className={cn(
                "flex items-center justify-between gap-2.5 bg-white border border-black rounded-xl px-3 h-9 shadow-xs cursor-pointer select-none transition-all active:scale-[0.99] shrink-0",
                showMatchedOnly ? "bg-blue-50/80 border-blue-600" : "hover:bg-slate-50"
              )}
            >
              <span className="text-xs font-extrabold text-slate-900 tracking-tight whitespace-nowrap">Best Match Only</span>
              <div className={cn(
                "w-[30px] h-[16px] rounded-full p-[2px] transition-colors relative flex items-center shrink-0 border border-black",
                showMatchedOnly ? "bg-[#2563EB]" : "bg-slate-200"
              )}>
                <div className={cn(
                  "w-[10px] h-[10px] bg-white rounded-full shadow-xs transition-transform duration-200 ease-in-out shrink-0",
                  showMatchedOnly ? "translate-x-[14px]" : "translate-x-0"
                )} />
              </div>
            </div>

            <button 
              onClick={() => {
                setShowFilters(true);
                setTimeout(() => {
                  const saveSection = document.getElementById('save-feed-section');
                  saveSection?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              className="flex items-center gap-1.5 px-3 h-9 bg-white rounded-xl border border-black shadow-xs text-slate-700 hover:text-blue-600 transition-all shrink-0 active:scale-95 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="text-xs font-extrabold whitespace-nowrap">Save Feed</span>
            </button>
          </div>
        </div>
      )}
    </div>

      {activeTab === "feed" && (
        <div className="bg-slate-50 border-2 border-black rounded-2xl p-2.5 sm:p-3 shadow-xs space-y-2 my-2.5">
          <div className="flex items-center justify-between gap-2 border-b border-black/10 pb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex flex-col text-[11px] sm:text-xs font-black uppercase text-slate-900 tracking-wider leading-tight select-none">
                <span>Your job feed</span>
                <span>filters</span>
              </div>
              <span className="text-[10px] font-black text-slate-700 bg-slate-200/80 px-2 py-0.5 rounded-full border border-black/15 shrink-0">
                {savedFiltersList.length}/4 Saved
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {selectedSavedFilterIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedSavedFilterIds([])}
                  className="text-[11px] font-black text-blue-600 hover:text-blue-800 hover:underline px-1.5 py-0.5 cursor-pointer"
                >
                  Unselect All
                </button>
              )}
              {savedFiltersList.length < 4 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowFilters(true);
                    setTimeout(() => {
                      const saveSection = document.getElementById('save-feed-section');
                      saveSection?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-black border border-black rounded-xl text-[11px] font-black flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-600 stroke-[3]" />
                  <span>Save Current</span>
                </button>
              )}
            </div>
          </div>

          {/* Saved Filter Tabs Row */}
          {savedFiltersList.length === 0 ? (
            <div className="text-xs font-medium text-slate-500 py-1 flex items-center gap-2">
              <span>No saved filter collections. Set search filters & tap <strong>"+ Save Current"</strong> (up to 4 max).</span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1 w-full">
              {savedFiltersList.slice(0, 4).map((filter: any) => {
                const isSelected = selectedSavedFilterIds.includes(filter.id);
                return (
                  <div key={filter.id} className="relative shrink-0 select-none">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSavedFilterIds((prev) =>
                          prev.includes(filter.id)
                            ? prev.filter((id) => id !== filter.id)
                            : [...prev, filter.id]
                        );
                      }}
                      className={cn(
                        "h-10 sm:h-11 pl-4 pr-7 rounded-2xl border border-black flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95",
                        isSelected
                          ? "bg-slate-900 text-white font-black ring-1 ring-black/20"
                          : "bg-white text-slate-900 hover:bg-slate-100 font-bold"
                      )}
                    >
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      )}
                      <span className="text-xs sm:text-sm font-bold whitespace-nowrap text-current">
                        {filter.name}
                      </span>
                    </button>

                    {/* Top-Right Corner Delete X - No white background, placed strictly at top right corner as marked by user */}
                    <button
                      type="button"
                      title={`Delete ${filter.name} filter`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setFilterToDelete(filter);
                      }}
                      className={cn(
                        "absolute top-1 right-1.5 w-5 h-5 p-0 bg-transparent border-0 flex items-center justify-center cursor-pointer transition-colors z-10",
                        isSelected
                          ? "text-slate-400 hover:text-white"
                          : "text-slate-400 hover:text-red-600"
                      )}
                    >
                      <X className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
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
            <div className="flex items-center gap-3">
              <button 
                type="button"
                onClick={resetAllFilters}
                className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline transition-colors cursor-pointer"
              >
                Reset all
              </button>

              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-black hover:text-white border border-black text-slate-900 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                title="Close filter panel"
                aria-label="Close filter panel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Saved Filters Section */}
          {savedFiltersList.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600" />
                Saved Feeds
              </h3>
              <div className="flex flex-wrap gap-2">
                {savedFiltersList.map((filter: any) => (
                  <div 
                    key={filter.id}
                    className="group flex items-center gap-1 bg-blue-50 text-blue-700 px-4 py-2 rounded-full border border-blue-100 hover:bg-blue-100 transition-all shadow-sm"
                  >
                    <button 
                      onClick={() => applyFilter(filter, true)}
                      className="text-xs font-bold cursor-pointer"
                    >
                      {filter.name}
                    </button>
                    <button 
                      onClick={() => setFilterToDelete(filter)}
                      className="p-1 hover:bg-blue-200 rounded-full transition-colors cursor-pointer"
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
                onClick={() => {
                  setSelectedCategories([]);
                  setDismissedFilterKey(null);
                }}
                className="text-xs text-blue-600 font-bold hover:underline"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setSelectedCategories([]);
                  setDismissedFilterKey(null);
                }}
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
                    setDismissedFilterKey(null);
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
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider">
                Save current search & filters
              </h3>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-black/10">
                {savedFiltersList.length}/4 Saved
              </span>
            </div>
            
            {savedFiltersList.length >= 4 ? (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs font-bold text-amber-900">
                Maximum 4 saved job feed filter collections reached. Please delete an existing collection above to save new criteria.
              </div>
            ) : (
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="e.g. Skip hire or Local Plumbing"
                  value={newFilterName}
                  onChange={(e) => setNewFilterName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSaveFilter();
                    }
                  }}
                  className="flex-1 min-w-0 px-4 py-3 rounded-2xl border border-black focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 text-sm font-medium"
                />
                <button 
                  type="button"
                  onClick={() => handleSaveFilter()}
                  disabled={!newFilterName.trim() || isSavingFilter}
                  className="px-4 sm:px-6 py-3 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer shrink-0 flex items-center gap-1.5"
                >
                  {isSavingFilter ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Feed</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <button 
            type="button"
            onClick={() => {
              if (newFilterName.trim()) {
                handleSaveFilter(newFilterName.trim());
              } else {
                setShowFilters(false);
              }
            }}
            className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 hover:bg-orange-600 transition-all shadow-xl shadow-orange-900/10 active:scale-[0.98] cursor-pointer"
          >
            <Filter className="w-5 h-5" />
            {newFilterName.trim() ? "Save Feed & Apply Filters" : "Apply Filters & Close"}
          </button>
        </motion.div>
      )}

      {/* Active Filter Indicators Bar */}
      {activeTab === "feed" && hasActiveFilters && (
        <div className="flex items-center gap-1.5 flex-wrap bg-blue-50/90 border border-black rounded-2xl p-2.5 sm:px-3 sm:py-2 text-xs shadow-xs my-2">
          <span className="font-extrabold text-blue-900 flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5 text-blue-700" />
            <span>Active Filters:</span>
          </span>

          {/* Selected Categories */}
          {selectedCategories.map((cat) => (
            <span
              key={cat}
              className="inline-flex items-center gap-1 bg-white border border-black text-slate-900 px-2.5 py-1 rounded-xl text-xs font-bold shadow-xs"
            >
              <Briefcase className="w-3 h-3 text-blue-600 shrink-0" />
              <span>{cat}</span>
              <button
                type="button"
                onClick={() => setSelectedCategories((prev) => prev.filter((c) => c !== cat))}
                className="p-0.5 hover:bg-slate-100 rounded-md text-slate-500 hover:text-black cursor-pointer"
                title={`Remove ${cat} filter`}
              >
                <X className="w-3 h-3 stroke-[2.5]" />
              </button>
            </span>
          ))}

          {/* Search Query */}
          {searchTerm.trim() !== "" && (
            <span className="inline-flex items-center gap-1 bg-white border border-black text-slate-900 px-2.5 py-1 rounded-xl text-xs font-bold shadow-xs">
              <span>"{searchTerm}"</span>
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="p-0.5 hover:bg-slate-100 rounded-md text-slate-500 hover:text-black cursor-pointer"
                title="Clear search"
              >
                <X className="w-3 h-3 stroke-[2.5]" />
              </button>
            </span>
          )}

          {/* Urgency */}
          {urgencyFilter !== "any" && (
            <span className="inline-flex items-center gap-1 bg-white border border-black text-slate-900 px-2.5 py-1 rounded-xl text-xs font-bold shadow-xs">
              <span>Urgency: {urgencyFilter}</span>
              <button
                type="button"
                onClick={() => setUrgencyFilter("any")}
                className="p-0.5 hover:bg-slate-100 rounded-md text-slate-500 hover:text-black cursor-pointer"
                title="Reset urgency"
              >
                <X className="w-3 h-3 stroke-[2.5]" />
              </button>
            </span>
          )}

          {/* Distance */}
          {distanceFilter !== "any" && (
            <span className="inline-flex items-center gap-1 bg-white border border-black text-slate-900 px-2.5 py-1 rounded-xl text-xs font-bold shadow-xs">
              <span>Within {distanceFilter} mi</span>
              <button
                type="button"
                onClick={() => setDistanceFilter("any")}
                className="p-0.5 hover:bg-slate-100 rounded-md text-slate-500 hover:text-black cursor-pointer"
                title="Reset distance"
              >
                <X className="w-3 h-3 stroke-[2.5]" />
              </button>
            </span>
          )}

          {/* Price */}
          {priceFilter !== "any" && (
            <span className="inline-flex items-center gap-1 bg-white border border-black text-slate-900 px-2.5 py-1 rounded-xl text-xs font-bold shadow-xs">
              <span>Price: {priceFilter.replace('_', ' ')}</span>
              <button
                type="button"
                onClick={() => setPriceFilter("any")}
                className="p-0.5 hover:bg-slate-100 rounded-md text-slate-500 hover:text-black cursor-pointer"
                title="Reset price"
              >
                <X className="w-3 h-3 stroke-[2.5]" />
              </button>
            </span>
          )}

          {/* Best Match Only */}
          {showMatchedOnly && (
            <span className="inline-flex items-center gap-1 bg-white border border-black text-slate-900 px-2.5 py-1 rounded-xl text-xs font-bold shadow-xs">
              <span>Best Match Only</span>
              <button
                type="button"
                onClick={() => setShowMatchedOnly(false)}
                className="p-0.5 hover:bg-slate-100 rounded-md text-slate-500 hover:text-black cursor-pointer"
                title="Disable Best Match Only"
              >
                <X className="w-3 h-3 stroke-[2.5]" />
              </button>
            </span>
          )}

          {/* Selected Saved Feeds */}
          {selectedSavedFilterIds.length > 0 && (
            <span className="inline-flex items-center gap-1 bg-white border border-black text-slate-900 px-2.5 py-1 rounded-xl text-xs font-bold shadow-xs">
              <span>Saved Feeds ({selectedSavedFilterIds.length})</span>
              <button
                type="button"
                onClick={() => setSelectedSavedFilterIds([])}
                className="p-0.5 hover:bg-slate-100 rounded-md text-slate-500 hover:text-black cursor-pointer"
                title="Unselect saved feeds"
              >
                <X className="w-3 h-3 stroke-[2.5]" />
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={resetAllFilters}
            className="ml-auto text-xs font-black text-red-600 hover:text-red-700 hover:underline px-2 py-1 cursor-pointer shrink-0"
          >
            Clear All ({jobs.length} total)
          </button>
        </div>
      )}

      {activeTab === "feed" && (
        <NearbyRequestsSection
          jobs={jobs}
          selectedCategories={selectedCategories}
          urgencyFilter={urgencyFilter}
          onSelectCategoryFilter={handleSelectCategoryFromNearby}
          onSelectUrgencyFilter={handleSelectUrgencyFromNearby}
          onClearDemandFilter={handleClearDemandFilter}
          onClearAllFilters={resetAllFilters}
        />
      )}

      {filteredJobs.length === 0 ? (
        jobs.length > 0 ? (
          <div className="bg-white p-8 sm:p-10 rounded-3xl border border-black text-center space-y-5 shadow-sm">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl border border-black flex items-center justify-center mx-auto text-blue-600">
              <Filter className="w-8 h-8" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="text-lg sm:text-xl font-black text-slate-900">
                No jobs match your current filters
              </h3>
              <p className="text-sm text-slate-600">
                There are <strong className="text-slate-900 font-black">{jobs.length} jobs available</strong> in your area that are currently hidden by your filter settings.
              </p>
            </div>

            {/* Active Filters Summary */}
            {hasActiveFilters && (
              <div className="inline-flex flex-wrap items-center justify-center gap-1.5 p-2.5 bg-slate-50 border border-black/20 rounded-2xl text-xs max-w-md mx-auto">
                <span className="text-slate-500 font-bold">Applied:</span>
                {selectedCategories.map((cat) => (
                  <span key={cat} className="bg-white px-2.5 py-1 rounded-xl border border-black font-bold text-slate-900">
                    {cat}
                  </span>
                ))}
                {searchTerm && (
                  <span className="bg-white px-2.5 py-1 rounded-xl border border-black font-bold text-slate-900">
                    "{searchTerm}"
                  </span>
                )}
                {showMatchedOnly && (
                  <span className="bg-white px-2.5 py-1 rounded-xl border border-black font-bold text-slate-900">
                    Best Match Only
                  </span>
                )}
                {urgencyFilter !== "any" && (
                  <span className="bg-white px-2.5 py-1 rounded-xl border border-black font-bold text-slate-900">
                    Urgency: {urgencyFilter}
                  </span>
                )}
                {distanceFilter !== "any" && (
                  <span className="bg-white px-2.5 py-1 rounded-xl border border-black font-bold text-slate-900">
                    Distance: ≤ {distanceFilter} mi
                  </span>
                )}
                {priceFilter !== "any" && (
                  <span className="bg-white px-2.5 py-1 rounded-xl border border-black font-bold text-slate-900">
                    Price: {priceFilter.replace('_', ' ')}
                  </span>
                )}
                {selectedSavedFilterIds.length > 0 && (
                  <span className="bg-white px-2.5 py-1 rounded-xl border border-black font-bold text-slate-900">
                    Saved Feeds ({selectedSavedFilterIds.length})
                  </span>
                )}
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={resetAllFilters}
                className="w-full sm:w-auto px-6 py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-black text-sm border border-black transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-emerald-400" />
                <span>Clear All Filters & Show All {jobs.length} Jobs</span>
              </button>
            </div>

            {/* Quick jump to available categories */}
            {availableDemandCategories.length > 0 && (
              <div className="pt-4 border-t border-black/10 max-w-md mx-auto space-y-2.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Or jump directly to categories with jobs:
                </span>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {availableDemandCategories.map((cat) => (
                    <button
                      key={cat.category}
                      type="button"
                      onClick={() => handleSelectCategoryFromNearby(cat.category)}
                      className="px-3 py-2 bg-slate-50 hover:bg-blue-50 text-slate-900 hover:text-blue-700 rounded-xl border border-black font-black text-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                      <span>{cat.category}</span>
                      <span className="bg-slate-200 text-slate-900 px-1.5 py-0.2 rounded-full text-[10px] font-black">
                        {cat.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white p-12 rounded-3xl border border-black text-center space-y-6 shadow-sm">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
              <Wrench className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900">No jobs available</h3>
              <p className="text-slate-500 max-w-xs mx-auto">Check back later for new opportunities in your area.</p>
            </div>
          </div>
        )
      ) : (
        <div className="space-y-3">
          {/* Filtered Active Jobs Status Banner */}
          {activeTab === "feed" && hasActiveFilters && activeFilterSummary.length > 0 && (
            <div
              id="active-jobs-filtered-banner"
              className="bg-yellow-300 border border-black rounded-xl px-3 py-1.5 sm:py-2 flex items-center justify-between gap-2 shadow-xs"
            >
              <div className="flex items-center gap-1.5 flex-wrap text-[10px] sm:text-[11px] font-black text-black">
                <Filter className="w-3 h-3 text-black stroke-[3] shrink-0" />
                <span>Showing active jobs for:</span>
                <span className="underline decoration-black/70 underline-offset-2">
                  {activeFilterSummary.join(" • ")}
                </span>
                <span className="text-black/80 font-black ml-0.5">
                  ({filteredJobs.length} {filteredJobs.length === 1 ? "job" : "jobs"})
                </span>
              </div>
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-[10px] font-black text-black hover:opacity-75 underline cursor-pointer shrink-0 ml-auto flex items-center gap-1"
                title="Clear all active filters"
              >
                <X className="w-2.5 h-2.5 stroke-[3]" />
                <span>Clear</span>
              </button>
            </div>
          )}

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

            const isEmergency = job.urgency === "emergency" || job.isEmergency === true || job.isBoosted;
            const isUrgentAsap = !isEmergency && (job.urgency === "asap" || job.urgency === "urgent");
            const isInstantMatch = !isEmergency && !isUrgentAsap && (job.boostTier === "instant_match" || job.isInstantMatch);
            const isDirectRequest = Boolean(job.targetTradespersonName || job.targetTradespersonId);
            const isFlashDeal = Boolean(job.claimedDeal);

            return (
            <Link
              key={job.id}
              to={`/job/${job.id}?quickQuote=true`}
              className={cn(
                "block w-full bg-white rounded-[2rem] border shadow-sm hover:shadow-lg transition-all overflow-hidden group relative text-left",
                isEmergency
                  ? "border-2 border-red-500 shadow-red-500/15"
                  : isUrgentAsap || isFlashDeal || isInstantMatch
                  ? "border-2 border-amber-400 shadow-amber-400/10"
                  : "border border-black hover:border-blue-400"
              )}
            >
              {/* Top Urgency / Category Heading Banner matching Homeowner Dashboard */}
              {isFlashDeal ? (
                <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 font-black text-xs uppercase py-2 px-4 sm:px-5 flex items-center justify-between border-b border-amber-600 shadow-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="bg-slate-950 text-amber-400 p-1 rounded-md shrink-0">
                      <Zap className="w-3.5 h-3.5 fill-current" />
                    </span>
                    <span className="truncate">Flash Deal Claimed • {job.claimedDeal?.discountPercentage || 0}% OFF</span>
                  </div>
                  <span className="bg-slate-950 text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase shrink-0">
                    £{job.claimedDeal?.targetRate || job.claimedDeal?.discountedPrice} Fixed Rate
                  </span>
                </div>
              ) : isDirectRequest ? (
                <div className="bg-gradient-to-r from-indigo-900 via-blue-900 to-indigo-950 text-white font-black text-xs uppercase py-2 px-4 sm:px-5 flex items-center justify-between border-b border-indigo-950 shadow-xs gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="shrink-0 text-sm">🎯</span>
                    <span className="truncate">Direct 1-on-1 Quote Request</span>
                  </div>
                  <div className="bg-amber-400 text-slate-950 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs flex items-center gap-1 shrink-0 border border-amber-300">
                    <span className="text-slate-800 font-bold opacity-90 hidden xs:inline">Sent to:</span>
                    <span className="text-amber-950 font-black tracking-tight underline decoration-amber-600 decoration-1 underline-offset-2">{job.targetTradespersonName || "Individual Trader"}</span>
                  </div>
                </div>
              ) : isInstantMatch ? (
                <div className="bg-[#E6A020] text-slate-950 font-black text-xs uppercase py-2 px-4 sm:px-5 flex items-center justify-between border-b border-[#D4921E] shadow-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Zap className="w-3.5 h-3.5 fill-current shrink-0" />
                    <span className="truncate">Instant Match Priority Lead</span>
                  </div>
                  <span className="bg-slate-950 text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase shrink-0">
                    Instant Lead
                  </span>
                </div>
              ) : isEmergency ? (
                <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white font-black text-xs tracking-widest uppercase py-2 px-4 sm:px-5 flex items-center justify-between border-b border-red-700 shadow-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <AlertCircle className="w-4 h-4 shrink-0 animate-bounce" />
                    <span className="truncate">Emergency Job • Immediate Dispatch</span>
                  </div>
                  <span className="bg-white/20 text-white text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider border border-white/30 shrink-0">
                    High Urgency
                  </span>
                </div>
              ) : isUrgentAsap ? (
                <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 font-black text-xs tracking-widest uppercase py-2 px-4 sm:px-5 flex items-center justify-between border-b border-amber-600 shadow-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Urgent Job • ASAP Required</span>
                  </div>
                  <span className="bg-slate-950 text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                    Priority
                  </span>
                </div>
              ) : job.urgency === "specific_date" && job.jobDate ? (
                <div className="bg-slate-900 text-white font-black text-[11px] tracking-widest uppercase py-1.5 px-4 sm:px-5 flex items-center justify-between border-b border-slate-800">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="truncate">Scheduled Date: {new Date(job.jobDate).toLocaleDateString('en-GB')}</span>
                  </div>
                  <span className="text-slate-400 text-[10px] shrink-0">Open For Quotes</span>
                </div>
              ) : (
                <div className="bg-slate-900 text-white font-black text-[11px] tracking-widest uppercase py-1.5 px-4 sm:px-5 flex items-center justify-between border-b border-slate-800">
                  <span className="truncate">Standard Job Opportunity</span>
                  <span className="text-slate-400 text-[10px] shrink-0">Open For Quotes</span>
                </div>
              )}

              {/* Main Card Body */}
              <div className={cn(
                "p-4 sm:p-5 space-y-3",
                isEmergency ? "bg-red-50/15" : ""
              )}>
                {/* Header Row: Category & Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  {job.jobNo && (
                    <span className="bg-slate-900 text-white px-2 py-0.5 rounded-md text-[10px] font-black shadow-2xs uppercase tracking-wider shrink-0">
                      #{job.jobNo}
                    </span>
                  )}
                  {/* Category & Subcategory Single Line Badge */}
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 truncate whitespace-nowrap max-w-full">
                    {(() => {
                      const category = categories.find(c => c.name === job.category);
                      if (category) {
                        const Icon = iconMap[category.icon];
                        return Icon ? <Icon className="w-3 h-3 shrink-0" /> : <span className="text-[10px] shrink-0">{category.icon}</span>;
                      }
                      return <Wrench className="w-3 h-3 shrink-0" />;
                    })()}
                    <span className="truncate">{job.category} {job.subcategory ? `• ${job.subcategory}` : ''}</span>
                  </span>

                  {/* Seeking Quotes Badge with Pulsing Green or Solid Red Border */}
                  {(() => {
                    const qCount = job.quoteCount || 0;
                    const isFull = qCount >= 5;
                    return (
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all",
                        isFull
                          ? "border-2 border-red-500 text-red-700 bg-red-50"
                          : "border-2 border-emerald-500 text-emerald-800 bg-emerald-50 pulse-green-border"
                      )}>
                        {isFull ? 'Max Quotes Reached' : 'Seeking Quotes'}
                      </span>
                    );
                  })()}

                  {/* Quotes Received Tab moved right next to Seeking Quotes */}
                  <span className={cn(
                    "px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 border transition-all",
                    (job.quoteCount || 0) >= 5
                      ? "bg-amber-100 text-amber-900 border-amber-300"
                      : (job.quoteCount || 0) > 0
                      ? "bg-blue-100 text-blue-800 border-blue-300"
                      : "bg-slate-100 text-slate-700 border-slate-300"
                  )}>
                    <span>{(job.quoteCount || 0)} Quotes</span>
                  </span>

                  {/* 40+ Signal Match Engine Pill */}
                  {(() => {
                    if (profile?.role !== "tradesperson") return null;
                    const matchData = traderMatchScores[job.id];
                    const score = matchData?.compositeScore || 0;
                    
                    if (score >= 80) {
                      return (
                        <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-300 flex items-center gap-1 shadow-xs">
                          <Zap className="w-3 h-3 text-emerald-600 fill-emerald-500" />
                          {score}% Match • Top Match
                        </span>
                      );
                    }
                    if (score >= 65) {
                      return (
                        <span className="text-[10px] font-black uppercase text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-300 flex items-center gap-1 shadow-xs">
                          <Zap className="w-3 h-3 text-blue-600 fill-blue-500" />
                          {score}% Match • Strong Match
                        </span>
                      );
                    }
                    if (score >= 50) {
                      return (
                        <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-300 flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-600 fill-amber-500" />
                          {score}% Match
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Title and Estimated Budget Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-extrabold text-base sm:text-lg text-slate-950 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
                      {job.title}
                    </h4>
                    {profile?.role === "tradesperson" && traderMatchScores[job.id]?.keyHighlights?.[0] && (
                      <p className="text-[11px] font-bold text-slate-600 flex items-center gap-1 mt-0.5">
                        <span className="text-amber-500 font-black">★</span> {traderMatchScores[job.id].keyHighlights[0]}
                      </p>
                    )}
                  </div>
                  <div className="sm:text-right shrink-0">
                    {job.claimedDeal ? (
                      <div>
                        <div className="text-lg font-black text-amber-600">
                          £{job.claimedDeal.targetRate || job.claimedDeal.discountedPrice}
                        </div>
                        <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                          Pre-Agreed Deal Rate
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-lg font-black text-green-600">
                          £{job.estimateMin || 0} - £{job.estimateMax || 0}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Estimated Budget
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {(() => {
                  const jobExclusiveUntil = job.exclusiveUntil?.toDate ? job.exclusiveUntil.toDate() : (job.exclusiveUntil ? new Date(job.exclusiveUntil) : null);
                  const isCurrentlyExclusive = jobExclusiveUntil && jobExclusiveUntil > new Date();
                  
                  if (isCurrentlyExclusive) {
                    const minutesRemaining = Math.max(0, Math.floor((jobExclusiveUntil.getTime() - Date.now()) / 60000));
                    return (
                      <div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-[10px] font-black uppercase text-white shadow-sm ring-1 ring-amber-500/50">
                          <Zap className="w-3.5 h-3.5 fill-current" />
                          Exclusive Access: {minutesRemaining}m remaining
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Description */}
                <p className="text-xs sm:text-sm text-slate-800 font-medium line-clamp-2 leading-relaxed">{job.description}</p>
                
                {/* Metadata Row */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold text-slate-900 pt-1">
                  <div className="flex items-center gap-1.5 text-slate-900 font-extrabold">
                    <MapPin className="w-4 h-4 text-slate-800" />
                    <span className="uppercase tracking-wide text-slate-900 font-black">{formatJobLocation(job)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-900 font-extrabold">
                    <Clock className="w-4 h-4 text-slate-800" />
                    {job.urgency === "emergency" ? (
                      <EmergencyTimer postedDate={job.createdAt?.seconds ? new Date(job.createdAt.seconds * 1000) : job.createdAt} />
                    ) : (
                      <span className={cn(
                        job.urgency === "asap" ? "text-orange-600 font-bold" : "text-slate-900 font-black"
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
                    <span>{Math.max(0, job.quoteCount || 0)} Quotes (Max 5)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                    <Calendar className="w-4 h-4 text-slate-800" />
                    <span className="text-slate-900 font-bold">Posted {new Date(job.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString('en-GB')}</span>
                  </div>
                </div>

                {/* Badges / Scope / Media */}
                {(job.paymentPreference || job.quoteScope || job.estimatedCompletionTime || job.photos?.length > 0 || job.videos?.length > 0) && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
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

                {/* Bottom Action Controls */}
                {profile?.role === "tradesperson" && (
                  myQuotes[job.id] ? (
                    <div className="pt-2">
                      <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider block truncate">
                              Quote Sent: £{myQuotes[job.id].amount || myQuotes[job.id].estimatedAmount}
                            </span>
                            <span className="text-xs text-emerald-950 font-extrabold truncate block">
                              Status: {myQuotes[job.id].status?.toUpperCase() || "PENDING"}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            navigate(`/job/${job.id}`);
                          }}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-xs shrink-0 active:scale-95 cursor-pointer"
                        >
                          View / Edit
                        </button>
                      </div>
                    </div>
                  ) : (job.quoteCount || 0) >= 5 ? (
                    <div className="pt-2">
                      <div className="w-full bg-slate-100 text-slate-600 py-2.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 border border-slate-300">
                        <AlertCircle className="w-4 h-4 text-slate-500" />
                        Quote Limit Reached (5/5 Received)
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setQuickQuoteJob(job);
                        }}
                        className="w-full bg-orange-500 text-white py-3 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-orange-600 transition-all shadow-md shadow-orange-500/20 active:scale-[0.98] cursor-pointer"
                      >
                        <FileText className="w-4 h-4" />
                        <span>Quick Quote</span>
                        <span className="ml-auto bg-white/20 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                          AI Guide: £{job.estimateMin || 0}-£{job.estimateMax || 0}
                        </span>
                      </button>
                    </div>
                  )
                )}
              </div>

              {/* Full-width View Details Bar across card bottom */}
              <div className="w-full bg-slate-50 group-hover:bg-blue-50/50 px-4 py-2.5 text-center text-xs font-black text-blue-600 border-t border-black flex items-center justify-center gap-1.5 transition-colors">
                <span>View Job Details & Full Specifications</span>
                <ChevronRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          );
        })}
          </div>
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
    {!showFilters && selectedCategories.length > 0 && !isCurrentSearchSaved && !isSaveBannerDismissed && (
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-20 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md z-40"
      >
        <div className="relative bg-blue-600 text-white p-4 pt-4 rounded-2xl shadow-xl flex items-center justify-between gap-3 border border-blue-500">
          <button
            type="button"
            onClick={() => setDismissedFilterKey(currentFilterKey)}
            className="absolute -top-2 -right-2 w-7 h-7 bg-white text-slate-700 hover:bg-slate-100 rounded-full flex items-center justify-center shadow-md transition-all border border-slate-200 cursor-pointer active:scale-95"
            title="Dismiss notification"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4 text-slate-600" />
          </button>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
              <Save className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">Save selection as feed</p>
              <p className="text-xs text-blue-100 truncate">
                {selectedCategories.length > 0 ? selectedCategories.join(", ") : "Get notified for new jobs"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const defaultName = newFilterName.trim() || (selectedCategories.length > 0 ? selectedCategories.join(", ") : (searchTerm.trim() || "My Saved Feed"));
              handleSaveFilter(defaultName);
            }}
            disabled={isSavingFilter}
            className="px-4 py-2 bg-white text-blue-600 rounded-xl font-black text-sm hover:bg-blue-50 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {isSavingFilter ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            ) : (
              <Save className="w-4 h-4 text-blue-600 stroke-[2.5]" />
            )}
            <span>{isSavingFilter ? "SAVING..." : "SAVE NOW"}</span>
          </button>
        </div>
      </motion.div>
    )}
  </AnimatePresence>

      {/* Delete Filter Confirmation Modal */}
      <AnimatePresence>
        {filterToDelete && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-black p-5 max-w-xs w-full space-y-4 shadow-xl text-center"
            >
              <div className="w-10 h-10 rounded-full bg-red-50 border border-black/10 flex items-center justify-center mx-auto text-red-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-slate-900">Delete Filter Collection?</h4>
                <p className="text-xs text-slate-600">
                  Are you sure you want to remove <strong className="text-black">"{filterToDelete.name}"</strong> from your saved feeds?
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setFilterToDelete(null)}
                  className="flex-1 py-2 px-3 rounded-xl border border-black bg-white hover:bg-slate-100 text-xs font-bold text-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const id = filterToDelete.id;
                    setFilterToDelete(null);
                    await handleDeleteFilter(id);
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white transition-colors cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <MediaGalleryModal
        isOpen={!!selectedJobMedia}
        onClose={() => setSelectedJobMedia(null)}
        photos={selectedJobMedia?.photos}
        videos={selectedJobMedia?.videos}
        title={selectedJobMedia?.title || "Job Media"}
      />

      <QuickQuoteModal
        job={quickQuoteJob}
        isOpen={!!quickQuoteJob}
        onClose={() => setQuickQuoteJob(null)}
        onQuoteSubmitted={(submittedQuote) => {
          if (quickQuoteJob?.id) {
            setMyQuotes(prev => ({
              ...prev,
              [quickQuoteJob.id]: submittedQuote
            }));
          }
        }}
      />
      </div>
    </PullToRefresh>
  );
}

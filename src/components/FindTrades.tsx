import React, { useState, useEffect, useMemo } from "react";
import { Search, Filter, Star, MapPin, CheckCircle, ChevronRight, X, SlidersHorizontal, Award, ShieldCheck, Clock, Briefcase, Users, FileText, Shield, Heart, Zap, MessageSquare, AlertTriangle, Info, Plus, Building, Mic, History, Trash2, Tag, ArrowRightLeft, CheckSquare, Square, Scale, Sparkles, Check, Map, List, Compass, GripHorizontal, ChevronDown } from "lucide-react";
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF, CircleF } from "@react-google-maps/api";
import { getGoogleMapsApiKey } from "@/src/lib/capacitor";
import { db, collection, query, where, onSnapshot, setDoc, updateDoc, doc, handleFirestoreError, OperationType } from "@/src/firebase";
import { DidYouMeanSuggestion } from "./common/DidYouMeanSuggestion";
import { findFuzzySuggestion, buildCandidateDictionary, FuzzyMatchResult, CandidateItem } from "@/src/lib/fuzzyMatch";
import { cn } from "@/src/lib/utils";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { useCategories } from "../lib/CategoryProvider";
import { motion, AnimatePresence } from "motion/react";
import { TRADE_CATEGORIES, PROFESSIONAL_BADGES } from "@/src/constants";
import { getTraderBadges, BadgeOverlay } from "@/src/lib/badges";
import { SEO } from "./SEO";
import { seedMockTraders, INITIAL_MOCK_TRADERS } from "@/src/services/seedService";
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import { toast } from "sonner";

const googleMapsLibraries: any[] = ['places', 'geometry'];

const iconMap: Record<string, any> = {
  Search, Filter, Star, MapPin, CheckCircle, ChevronRight, X, SlidersHorizontal, Award, ShieldCheck, Clock, Briefcase
};

const premiumMapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  styles: [
    { elementType: "geometry", stylers: [{ color: "#ebe3cd" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#523735" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#f5f1e6" }] },
    { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#c9b2a6" }] },
    { featureType: "administrative.land_parcel", elementType: "geometry.stroke", stylers: [{ color: "#dcd2c4" }] },
    { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#ae9e90" }] },
    { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#dfd2ae" }] },
    { featureType: "poi", elementType: "geometry", stylers: [{ color: "#dfd2ae" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#93817c" }] },
    { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#a5b076" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#447530" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
    { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#f8c967" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#f8c967" }] },
    { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#e98d58" }] },
    { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#806b63" }] },
    { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#dfd2ae" }] },
    { featureType: "water", elementType: "geometry.fill", stylers: [{ color: "#b9d3c2" }] }
  ]
};

const getTraderCoordinates = (tp: Tradesperson): { lat: number; lng: number } => {
  if (tp.lat && tp.lng) {
    return { lat: tp.lat, lng: tp.lng };
  }
  let hash = 0;
  for (let i = 0; i < tp.uid.length; i++) {
    hash = (hash << 5) - hash + tp.uid.charCodeAt(i);
    hash |= 0;
  }
  const latOffset = (((Math.abs(hash) % 120) - 60) * 0.003);
  const lngOffset = (((Math.abs(hash >> 2) % 120) - 60) * 0.004);
  return {
    lat: 51.5074 + latOffset,
    lng: -0.1278 + lngOffset
  };
};

interface Tradesperson {
  uid: string;
  name: string;
  avatarUrl?: string;
  bio?: string;
  rating?: number;
  totalReviews?: number;
  totalJobsDone?: number;
  completedJobsRevenue?: number;
  responseRate?: number;
  avgReplyTime?: number;
  trustScore?: number;
  trades?: string[];
  services?: string[];
  tags?: string[];
  badges?: string[];
  searchFeedBadges?: string[];
  miniProfileSettings?: {
    callOutFee: number;
    hourlyRate: number;
    extraInfo: string;
  };
  postcode?: string;
  lat?: number;
  lng?: number;
  city?: string;
  isTopTradesperson?: boolean;
  isEstablishedTradesperson?: boolean;
  verificationStatus?: string;
  referralBoostUntil?: string;
  totalRecommendations?: number;
  recommendedCategories?: string[];
  isDisabled?: boolean;
  tierId?: string;
  isAvailableForEmergency?: boolean;
  memberId?: string;
  isFoundingMember?: boolean;
}

const COMPARE_THEMES = [
  {
    num: "#1",
    numVal: 1,
    badgeBg: "bg-blue-600",
    badgeText: "text-white",
    chipBg: "bg-blue-100 border-blue-300 text-blue-900",
    cardBg: "bg-blue-50/90 border-2 border-blue-400",
    cellBg: "bg-blue-50/80 border border-blue-200 text-slate-900",
    btnBg: "bg-blue-600 hover:bg-blue-700 text-white",
    avatarRing: "ring-2 ring-blue-500",
  },
  {
    num: "#2",
    numVal: 2,
    badgeBg: "bg-purple-600",
    badgeText: "text-white",
    chipBg: "bg-purple-100 border-purple-300 text-purple-900",
    cardBg: "bg-purple-50/90 border-2 border-purple-400",
    cellBg: "bg-purple-50/80 border border-purple-200 text-slate-900",
    btnBg: "bg-purple-600 hover:bg-purple-700 text-white",
    avatarRing: "ring-2 ring-purple-500",
  },
  {
    num: "#3",
    numVal: 3,
    badgeBg: "bg-emerald-600",
    badgeText: "text-white",
    chipBg: "bg-emerald-100 border-emerald-300 text-emerald-900",
    cardBg: "bg-emerald-50/90 border-2 border-emerald-400",
    cellBg: "bg-emerald-50/80 border border-emerald-200 text-slate-900",
    btnBg: "bg-emerald-600 hover:bg-emerald-700 text-white",
    avatarRing: "ring-2 ring-emerald-500",
  },
  {
    num: "#4",
    numVal: 4,
    badgeBg: "bg-amber-600",
    badgeText: "text-white",
    chipBg: "bg-amber-100 border-amber-300 text-amber-900",
    cardBg: "bg-amber-50/90 border-2 border-amber-400",
    cellBg: "bg-amber-50/80 border border-amber-200 text-slate-900",
    btnBg: "bg-amber-600 hover:bg-amber-700 text-white",
    avatarRing: "ring-2 ring-amber-500",
  },
];

export default function FindTrades() {
  const navigate = useNavigate();
  const location = useLocation();
  const { categories } = useCategories();
  const { user, profile } = useAuth();
  const [tradespeople, setTradespeople] = useState<Tradesperson[]>(INITIAL_MOCK_TRADERS as any[]);
  const [platformConfig, setPlatformConfig] = useState<any>(null);
  
  const isB2B = location.state?.isB2B;
  const [showSplash, setShowSplash] = useState(isB2B === true);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [userAssets, setUserAssets] = useState<any[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("Top Rated");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [tempMinRating, setTempMinRating] = useState<number | null>(null);
  const [tempVerifiedOnly, setTempVerifiedOnly] = useState(false);
  const [postcodeFilterEnabled, setPostcodeFilterEnabled] = useState(() => localStorage.getItem("postcodeFilterEnabled") === "true");
  const [postcodeFilterValue, setPostcodeFilterValue] = useState(() => localStorage.getItem("postcodeFilterValue") || "");
  const [tempPostcodeFilterEnabled, setTempPostcodeFilterEnabled] = useState(false);
  const [tempPostcodeFilterValue, setTempPostcodeFilterValue] = useState("");

  // --- View Mode & Google Map State ---
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [selectedMapTrader, setSelectedMapTrader] = useState<Tradesperson | null>(null);
  const [mapRadiusKm, setMapRadiusKm] = useState<number>(5);
  const [dragOffset, setDragOffset] = useState(() => {
    try {
      const saved = sessionStorage.getItem("findTradesDragOffset");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          // Allow reasonable range matching the viewport bounds
          if (Math.abs(parsed.x) > 500 || Math.abs(parsed.y) > 900) {
            return { x: 0, y: 0 };
          }
          const x = Math.max(-400, Math.min(20, parsed.x));
          const y = Math.max(-700, Math.min(100, parsed.y));
          return { x, y };
        }
      }
      return { x: 0, y: 0 };
    } catch {
      return { x: 0, y: 0 };
    }
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = React.useRef({ x: 0, y: 0 });
  const positionStartRef = React.useRef({ x: 0, y: 0 });

  // Update sessionStorage whenever dragOffset successfully updates
  useEffect(() => {
    try {
      sessionStorage.setItem("findTradesDragOffset", JSON.stringify(dragOffset));
    } catch (err) {
      console.error("Failed to save drag position to sessionStorage:", err);
    }
  }, [dragOffset]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    positionStartRef.current = { ...dragOffset };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const newX = Math.max(-400, Math.min(20, positionStartRef.current.x + dx));
    const newY = Math.max(-700, Math.min(100, positionStartRef.current.y + dy));
    setDragOffset({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };
  
  const googleMapsApiKey = getGoogleMapsApiKey();
  const { isLoaded: isMapScriptLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: googleMapsApiKey,
    libraries: googleMapsLibraries,
    version: "quarterly"
  });

  const [showNoResultsToast, setShowNoResultsToast] = useState(false);
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>([]);
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("recentTradeSearches");
      if (!saved) return [];
      const now = Date.now();
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const validItems = parsed
          .map((item: any) => {
            if (typeof item === "string") {
              return { term: item, timestamp: now };
            }
            return item;
          })
          .filter((item: any) => item && item.term && (now - item.timestamp) < THIRTY_DAYS_MS)
          .slice(0, 5);

        // Update localStorage with clean dataset
        localStorage.setItem("recentTradeSearches", JSON.stringify(validItems));
        return validItems.map((item: any) => item.term);
      }
      return [];
    } catch {
      return [];
    }
  });

  const addRecentSearch = (term: string) => {
    const clean = term.trim();
    if (!clean || clean.length < 2) return;
    const now = Date.now();

    setRecentSearches(prev => {
      let storedItems: { term: string; timestamp: number }[] = [];
      try {
        const raw = localStorage.getItem("recentTradeSearches");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            storedItems = parsed.map((item: any) =>
              typeof item === "string" ? { term: item, timestamp: now } : item
            );
          }
        }
      } catch {}

      const filtered = storedItems.filter(
        item =>
          item &&
          item.term &&
          item.term.toLowerCase() !== clean.toLowerCase() &&
          now - item.timestamp < THIRTY_DAYS_MS
      );

      const updatedItems = [{ term: clean, timestamp: now }, ...filtered].slice(0, 5);
      localStorage.setItem("recentTradeSearches", JSON.stringify(updatedItems));
      return updatedItems.map(i => i.term);
    });
  };

  const removeRecentSearch = (termToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const now = Date.now();

    setRecentSearches(prev => {
      let storedItems: { term: string; timestamp: number }[] = [];
      try {
        const raw = localStorage.getItem("recentTradeSearches");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            storedItems = parsed.map((item: any) =>
              typeof item === "string" ? { term: item, timestamp: now } : item
            );
          }
        }
      } catch {}

      const updatedItems = storedItems
        .filter(
          item =>
            item &&
            item.term &&
            item.term.toLowerCase() !== termToRemove.toLowerCase() &&
            now - item.timestamp < THIRTY_DAYS_MS
        )
        .slice(0, 5);

      localStorage.setItem("recentTradeSearches", JSON.stringify(updatedItems));
      return updatedItems.map(i => i.term);
    });
  };

  const clearAllRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem("recentTradeSearches");
  };

  // --- Quick Filter Preset State (Option 1) ---
  const [quickEmergency, setQuickEmergency] = useState(false);
  const [quickVerified, setQuickVerified] = useState(false);
  const [quickTopRated, setQuickTopRated] = useState(false);
  const [quickFastReply, setQuickFastReply] = useState(false);

  // --- Comparison Engine State (Option 2) ---
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  const toggleCompareTrader = (uid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCompareIds(prev => {
      if (prev.includes(uid)) {
        return prev.filter(id => id !== uid);
      }
      if (prev.length >= 3) {
        toast.error("You can compare up to 3 tradespeople at a time");
        return prev;
      }
      return [...prev, uid];
    });
  };

  const compareTradersList = useMemo(() => {
    return tradespeople.filter(tp => selectedCompareIds.includes(tp.uid));
  }, [tradespeople, selectedCompareIds]);

  const quickFilterCounts = useMemo(() => {
    return {
      emergency: tradespeople.filter(tp => tp.isAvailableForEmergency).length,
      verified: tradespeople.filter(tp => tp.verificationStatus === "verified").length,
      topRated: tradespeople.filter(tp => (tp.rating || 0) >= 4.5).length,
      fastReply: tradespeople.filter(tp => (tp.responseRate || 0) >= 70).length,
    };
  }, [tradespeople]);

  const [displayLimit, setDisplayLimit] = useState(10);
  const loadMoreSentinelRef = React.useRef<HTMLDivElement>(null);
  const [isCategoryAutoReset, setIsCategoryAutoReset] = useState(false);
  const categoryInactivityTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const previousSearchQueryRef = React.useRef(searchQuery);
  const [activeAds, setActiveAds] = useState<any[]>([]);

  const handleCategorySelect = (catName: string) => {
    setSelectedCategory(catName);
    setSearchQuery("");
    if (catName !== "All") {
      addRecentSearch(catName);
    }
  };
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false);
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});
  const [lastResetCheck, setLastResetCheck] = useState(Date.now());
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedTraderPreview, setSelectedTraderPreview] = useState<Tradesperson | null>(null);
  const [selectedMiniProfile, setSelectedMiniProfile] = useState<Tradesperson | null>(null);
  const resultsRef = React.useRef<HTMLDivElement>(null);
  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = React.useRef<any>(null);

  // --- Auto Scroll & Focus when Map View is selected ---
  useEffect(() => {
    if (viewMode === "map") {
      const timer = setTimeout(() => {
        if (mapContainerRef.current) {
          mapContainerRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });
          mapContainerRef.current.focus();
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [viewMode]);

  // --- Fuzzy Matching State ---
  const [candidateDictionary, setCandidateDictionary] = useState<CandidateItem[]>([]);
  const [fuzzySuggestion, setFuzzySuggestion] = useState<FuzzyMatchResult | null>(null);

  // Rebuild dictionary when tradespeople change
  useEffect(() => {
    setCandidateDictionary(buildCandidateDictionary(tradespeople));
  }, [tradespeople]);

  // --- Live Auto-Complete Dropdown State ---
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle Fuzzy matching when search query changes
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchQuery.trim().length >= 3) {
        const suggestion = findFuzzySuggestion(searchQuery, candidateDictionary);
        setFuzzySuggestion(suggestion);
      } else {
        setFuzzySuggestion(null);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(handler);
  }, [searchQuery, candidateDictionary]);

  const handleApplySuggestion = (suggestion: FuzzyMatchResult) => {
    setSearchQuery(suggestion.suggestion);
    if (suggestion.categoryName) {
      setSelectedCategory(suggestion.categoryName);
    }
    setFuzzySuggestion(null);
  };
  // ----------------------------

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
          toast.error("Speech recognition is not available on this device.");
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
        if ((window as any)._findTradesSpeechListener) await (window as any)._findTradesSpeechListener.remove().catch(() => {});
        const listener = await SpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
          if (data.matches && data.matches.length > 0) {
            setSearchQuery(data.matches[0]);
          }
        });
        (window as any)._findTradesSpeechListener = listener;

        if ((window as any)._findTradesStateListener) await (window as any)._findTradesStateListener.remove().catch(() => {});
        const stateListener = await SpeechRecognition.addListener('listeningState', (data: { status: 'started' | 'stopped' }) => {
          if (data.status === 'stopped') {
            setIsListening(false);
            if ((window as any)._findTradesSpeechListener) (window as any)._findTradesSpeechListener.remove().catch(() => {});
            stateListener.remove().catch(() => {});
          }
        });
        (window as any)._findTradesStateListener = stateListener;

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
          setSearchQuery(transcript);
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
      toast.error(e.message || "Error starting voice recognition. Please try again.");
    }
  };

  useEffect(() => {
    if (!selectedMiniProfile) return;

    // Auto-close after 5 seconds
    const timeoutId = setTimeout(() => {
      setSelectedMiniProfile(null);
    }, 5000);

    // Auto-close on scroll
    const handleScroll = () => {
      setSelectedMiniProfile(null);
    };

    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('scroll', handleScroll, { capture: true } as any);
    };
  }, [selectedMiniProfile]);

  // Calculate counts for each category (only available traders)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tradespeople.forEach(tp => {
      if (tp.isDisabled || tp.isAcceptingRequests === false) return;
      tp.trades?.forEach(trade => {
        counts[trade] = (counts[trade] || 0) + 1;
      });
    });
    return counts;
  }, [tradespeople]);

  // Reset category to "All" after 15 seconds of inactivity
  useEffect(() => {
    if (selectedCategory === "All") {
      setIsCategoryAutoReset(false);
      if (categoryInactivityTimerRef.current) {
        clearTimeout(categoryInactivityTimerRef.current);
        categoryInactivityTimerRef.current = null;
      }
      return;
    }

    const resetInactivityTimer = () => {
      if (categoryInactivityTimerRef.current) {
        clearTimeout(categoryInactivityTimerRef.current);
      }
      categoryInactivityTimerRef.current = setTimeout(() => {
        setSelectedCategory("All");
        setIsCategoryAutoReset(true);
        setTimeout(() => setIsCategoryAutoReset(false), 2500);
      }, 15000); // 15 seconds inactivity
    };

    resetInactivityTimer();

    const handleUserActivity = () => {
      resetInactivityTimer();
    };

    window.addEventListener("mousemove", handleUserActivity, { passive: true });
    window.addEventListener("keydown", handleUserActivity, { passive: true });
    window.addEventListener("touchstart", handleUserActivity, { passive: true });
    window.addEventListener("scroll", handleUserActivity, { passive: true });

    return () => {
      if (categoryInactivityTimerRef.current) {
        clearTimeout(categoryInactivityTimerRef.current);
      }
      window.removeEventListener("mousemove", handleUserActivity);
      window.removeEventListener("keydown", handleUserActivity);
      window.removeEventListener("touchstart", handleUserActivity);
      window.removeEventListener("scroll", handleUserActivity);
    };
  }, [selectedCategory]);

  // Default selectedCategory to "All" whenever search input is cleared / emptied
  useEffect(() => {
    if (previousSearchQueryRef.current.trim() !== "" && searchQuery.trim() === "") {
      setSelectedCategory("All");
    }
    previousSearchQueryRef.current = searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    const stored = localStorage.getItem("recentlyViewedTraders");
    if (stored) {
      try {
        setRecentlyViewedIds(stored !== "undefined" ? JSON.parse(stored) : []);
      } catch (e) {
        console.error("Error parsing recently viewed:", e);
      }
    }
  }, []);

  useEffect(() => {
    const handleInteraction = () => {
      setExpandedServices(prev => {
        if (Object.values(prev).some(v => v)) {
          return {};
        }
        return prev;
      });
    };

    window.addEventListener("scroll", handleInteraction, { passive: true });
    document.addEventListener("click", handleInteraction);
    document.addEventListener("touchstart", handleInteraction, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleInteraction);
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("touchstart", handleInteraction);
    };
  }, []);

  const recentlyViewedTraders = useMemo(() => {
    return tradespeople.filter(tp => recentlyViewedIds.includes(tp.uid));
  }, [tradespeople, recentlyViewedIds]);

  const categoryNames = useMemo(() => {
    return ["All", ...categories.map(c => c.name).sort()];
  }, [categories]);

  useEffect(() => {
    if (isFilterModalOpen) {
      setTempMinRating(minRating);
      setTempVerifiedOnly(verifiedOnly);
      setTempPostcodeFilterEnabled(postcodeFilterEnabled);
      setTempPostcodeFilterValue(postcodeFilterValue);
    }
  }, [isFilterModalOpen]);

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, "platform_config", "global"), (doc) => {
      if (doc.exists()) {
        setPlatformConfig(doc.data());
      }
    });

    // Subscribe to active search-feed promoted campaigns for dynamic rotation
    const adsQuery = query(collection(db, "advertisements"), where("approvalStatus", "==", "approved"), where("isActive", "==", true));
    const unsubAds = onSnapshot(adsQuery, (snapshot) => {
      const ads = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((ad: any) => (ad.prepaidBalance || 0) > 0);
      setActiveAds(ads);
    }, (err) => {
      console.error("Error fetching active search ads:", err);
    });

    const q = query(collection(db, "users"), where("role", "==", "tradesperson"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Tradesperson));
      if (data.length > 0) {
        setTradespeople(data);
      } else {
        seedMockTraders().catch(console.error);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching tradespeople:", error);
      handleFirestoreError(error, OperationType.LIST, "users");
      setLoading(false);
    });
    
    // Fetch assets if B2B
    let unsubAssets = () => {};
    if (user && profile?.subscriptionType === 'business') {
      import("firebase/firestore").then(({ getDocs }) => {
        getDocs(query(collection(db, "properties"), where("ownerId", "==", user.uid)))
          .then(snapshot => {
            setUserAssets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          }).catch(console.error);
      });
    }

    return () => {
      unsubscribe();
      unsubConfig();
      unsubAds();
      unsubAssets();
    };
  }, []);

  const isUserRecommended = (tp: Tradesperson, category: string) => {
    const manual = category !== "All" && tp.recommendedCategories?.includes(category);
    const tier = platformConfig?.feeTiers?.find((t: any) => t.name === (tp.tierId || "Basic"));
    const tierRecommended = tier?.includesRecommendation && (category === "All" || tp.trades?.includes(category));
    return manual || tierRecommended;
  };

  const filteredTradespeople = useMemo(() => {
    return tradespeople
      .filter(tp => !tp.isDisabled)
      .filter(tp => {
        const matchesSearch = 
          tp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tp.trades?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
          tp.services?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
          tp.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
          tp.postcode?.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesCategory = selectedCategory === "All" || tp.trades?.includes(selectedCategory);
        
        const matchesRating = minRating === null || (tp.rating || 0) >= minRating;
        
        const matchesVerified = !verifiedOnly || tp.verificationStatus === "verified";
        
        const matchesPostcode = !postcodeFilterEnabled || !postcodeFilterValue || (() => {
          const allowedParts = postcodeFilterValue.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
          if (allowedParts.length === 0) return true;
          const tpPostcodePart = tp.postcode?.split(" ")[0]?.toUpperCase() || "";
          return allowedParts.some(part => tpPostcodePart.startsWith(part));
        })();

        const matchesQuickEmergency = !quickEmergency || tp.isAvailableForEmergency;
        const matchesQuickVerified = !quickVerified || tp.verificationStatus === "verified";
        const matchesQuickTopRated = !quickTopRated || (tp.rating || 0) >= 4.5;
        const matchesQuickFastReply = !quickFastReply || (tp.responseRate || 0) >= 70;

        return matchesSearch && matchesCategory && matchesRating && matchesVerified && matchesPostcode && matchesQuickEmergency && matchesQuickVerified && matchesQuickTopRated && matchesQuickFastReply;
      })
      .sort((a, b) => {
        // 1. Recommended for current category boost
        if (selectedCategory !== "All") {
          const aRecommended = isUserRecommended(a, selectedCategory);
          const bRecommended = isUserRecommended(b, selectedCategory);
          if (aRecommended && !bRecommended) return -1;
          if (!aRecommended && bRecommended) return 1;
        }

        // 2. Referral boosted users
        const now = new Date().toISOString();
        const aBoosted = a.referralBoostUntil && a.referralBoostUntil > now;
        const bBoosted = b.referralBoostUntil && b.referralBoostUntil > now;
        
        if (aBoosted && !bBoosted) return -1;
        if (!aBoosted && bBoosted) return 1;

        if (sortBy === "Top Rated") return (b.rating || 0) - (a.rating || 0);
        if (sortBy === "Most Reviews") return (b.totalReviews || 0) - (a.totalReviews || 0);
        if (sortBy === "Response Rate") return (b.responseRate || 0) - (a.responseRate || 0);
        if (sortBy === "Most Jobs Done") return (b.totalJobsDone || 0) - (a.totalJobsDone || 0);
        if (sortBy === "Near Me") {
          const userPostcode = profile?.postcode?.toUpperCase().replace(/\s/g, "").substring(0, 4) || "";
          const aPostcode = a.postcode?.toUpperCase().replace(/\s/g, "").substring(0, 4) || "";
          const bPostcode = b.postcode?.toUpperCase().replace(/\s/g, "").substring(0, 4) || "";
          
          if (userPostcode) {
            if (aPostcode === userPostcode && bPostcode !== userPostcode) return -1;
            if (bPostcode === userPostcode && aPostcode !== userPostcode) return 1;
          }
          return 0;
        }
        return 0;
      });
  }, [tradespeople, searchQuery, selectedCategory, sortBy, minRating, verifiedOnly, postcodeFilterEnabled, postcodeFilterValue, profile, quickEmergency, quickVerified, quickTopRated, quickFastReply]);

  // Reset pagination limit when filters or search change
  useEffect(() => {
    setDisplayLimit(10);
  }, [selectedCategory, searchQuery, sortBy, minRating, verifiedOnly, postcodeFilterEnabled, postcodeFilterValue, quickEmergency, quickVerified, quickTopRated, quickFastReply]);

  // Fair Dynamic Rotation Engine for Promoted Profiles (15-20 active promoters rotated fairly into top 3)
  const finalDisplayList = useMemo(() => {
    const userLocationPostcode = profile?.postcode?.toUpperCase().replace(/\s/g, "") || "";
    const searchPostcode = postcodeFilterEnabled && postcodeFilterValue ? postcodeFilterValue.toUpperCase().replace(/\s/g, "") : "";
    const effectiveSearchPostcode = searchPostcode || userLocationPostcode;

    const matchingAds = activeAds.filter((ad: any) => {
      if ((ad.prepaidBalance || 0) <= 0) return false;

      const placementMatch = !ad.placement || ad.placement === "search_feed" || ad.placement === "both";
      if (!placementMatch) return false;

      const tp = tradespeople.find(t => t.uid === ad.advertiserUid);
      if (!tp || tp.isDisabled) return false;

      // 1. Search Query Relevance Filter
      if (searchQuery.trim().length > 0) {
        const queryLower = searchQuery.toLowerCase().trim();
        const tpMatches = 
          tp.name.toLowerCase().includes(queryLower) ||
          tp.businessName?.toLowerCase().includes(queryLower) ||
          tp.trades?.some(t => t.toLowerCase().includes(queryLower)) ||
          tp.services?.some(s => s.toLowerCase().includes(queryLower)) ||
          tp.tags?.some(tag => tag.toLowerCase().includes(queryLower)) ||
          tp.postcode?.toLowerCase().includes(queryLower);
        
        const adMatches = 
          ad.title?.toLowerCase().includes(queryLower) ||
          ad.tagline?.toLowerCase().includes(queryLower) ||
          ad.targetCategories?.some((cat: string) => cat.toLowerCase().includes(queryLower));

        if (!tpMatches && !adMatches) return false;
      }

      // 2. Category Relevance Filter
      if (selectedCategory !== "All") {
        const adTargetsCategory = ad.targetCategories?.includes(selectedCategory);
        const traderHasTrade = tp.trades?.includes(selectedCategory);
        if (!adTargetsCategory && !traderHasTrade) return false;
      }

      // 3. Quick & Advanced Filter Matching
      if (quickEmergency && !tp.isAvailableForEmergency) return false;
      if ((quickVerified || verifiedOnly) && tp.verificationStatus !== "verified") return false;
      if (quickTopRated && (tp.rating || 0) < 4.5) return false;
      if (quickFastReply && (tp.responseRate || 0) < 70) return false;
      if (minRating !== null && (tp.rating || 0) < minRating) return false;

      // 4. Radius / Location targeting check
      let radiusMatch = true;
      if (ad.promotionRadius && ad.promotionRadius !== "nationwide") {
        const radiusMiles = Number(ad.promotionRadius);
        const traderPostcode = tp.postcode?.toUpperCase().replace(/\s/g, "") || "";

        if (effectiveSearchPostcode && traderPostcode && radiusMiles > 0) {
          const tpOutward = traderPostcode.substring(0, 3);
          const searchOutward = effectiveSearchPostcode.substring(0, 3);
          const tpArea = traderPostcode.substring(0, 2);
          const searchArea = effectiveSearchPostcode.substring(0, 2);

          if (radiusMiles <= 10) {
            radiusMatch = tpOutward === searchOutward || tpArea === searchArea;
          } else if (radiusMiles <= 25) {
            radiusMatch = tpArea === searchArea || traderPostcode.charAt(0) === effectiveSearchPostcode.charAt(0);
          } else {
            radiusMatch = traderPostcode.charAt(0) === effectiveSearchPostcode.charAt(0);
          }
        }
      }

      return radiusMatch;
    });

    if (matchingAds.length === 0) {
      return filteredTradespeople;
    }

    // Dynamic hourly hash seed to rotate impressions across all active paying promoters
    const currentHourSeed = new Date().getHours() + new Date().getDate() * 24 + new Date().getMonth() * 720;
    
    const scoredPromotedUids = matchingAds.map((ad: any) => {
      const uid = ad.advertiserUid;
      let hash = 0;
      for (let i = 0; i < uid.length; i++) {
        hash = (hash << 5) - hash + uid.charCodeAt(i);
        hash |= 0;
      }
      const pseudoRandomHash = Math.abs(hash + currentHourSeed) % 1000;
      const tp = tradespeople.find(t => t.uid === uid);
      const rating = tp?.rating || 4.0;
      const budgetWeight = Math.min(2.0, 1 + (ad.prepaidBalance || 0) / 200);
      const score = pseudoRandomHash * (rating / 5) * budgetWeight;

      return { uid, score, adId: ad.id, costPerDisplay: ad.costPerDisplay || 1.00, adData: ad };
    });

    scoredPromotedUids.sort((a, b) => b.score - a.score);
    const topPromotedCandidates = scoredPromotedUids.slice(0, 3);
    const topPromotedUidSet = new Set(topPromotedCandidates.map(c => c.uid));

    const promotedTraders: (Tradesperson & { isPromotedAd?: boolean; adId?: string; costPerDisplay?: number; clicks?: number; searchFeedClicks?: number; prepaidBalance?: number })[] = [];
    
    topPromotedCandidates.forEach(cand => {
      const tp = tradespeople.find(t => t.uid === cand.uid);
      if (tp && !tp.isDisabled) {
        promotedTraders.push({
          ...tp,
          isPromotedAd: true,
          adId: cand.adId,
          costPerDisplay: cand.costPerDisplay,
          clicks: cand.adData.clicks || 0,
          searchFeedClicks: cand.adData.searchFeedClicks || 0,
          prepaidBalance: cand.adData.prepaidBalance || 0,
          adData: cand.adData
        });
      }
    });

    const organicTraders = filteredTradespeople.filter(tp => !topPromotedUidSet.has(tp.uid));

    return [...promotedTraders, ...organicTraders];
  }, [filteredTradespeople, activeAds, selectedCategory, searchQuery, minRating, verifiedOnly, postcodeFilterEnabled, postcodeFilterValue, quickEmergency, quickVerified, quickTopRated, quickFastReply, profile, tradespeople]);

  const autocompleteSuggestions = useMemo(() => {
    const queryTrimmed = searchQuery.trim().toLowerCase();
    if (!queryTrimmed) {
      return {
        matchingRecent: [],
        matchingCategories: [],
        matchingTradespeople: [],
        matchingLocations: [],
        hasSuggestions: false,
      };
    }

    // 1. Matching Recent Searches (Max 2)
    const matchingRecent = recentSearches
      .filter(s => s.toLowerCase().includes(queryTrimmed))
      .slice(0, 2);

    // 2. Matching Categories (Max 2) with Smart Word Boundary Relevance
    const escapedQuery = queryTrimmed.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    const wordBoundaryRegex = new RegExp(`\\b${escapedQuery}`, "i");

    const categoryCandidates = categories
      .map(cat => {
        const catNameLower = cat.name.toLowerCase();
        
        // Category Name Direct Matches
        const nameStartsWith = catNameLower.startsWith(queryTrimmed);
        const nameMatches = catNameLower.includes(queryTrimmed);

        // Subcategory Matches
        let matchingSub: string | undefined = undefined;
        if (cat.subcategories && cat.subcategories.length > 0) {
          matchingSub = cat.subcategories.find((sub: string) => {
            const subLower = sub.toLowerCase();
            // For short queries (<=3 chars e.g. "plu"), require word-start boundary
            if (queryTrimmed.length <= 3) {
              return subLower.startsWith(queryTrimmed) || wordBoundaryRegex.test(subLower);
            }
            return subLower.includes(queryTrimmed);
          });
        }

        // Calculate relevance priority score
        let priority = 0;
        if (nameStartsWith) {
          priority = 100;
        } else if (nameMatches) {
          priority = 80;
        } else if (matchingSub && matchingSub.toLowerCase().startsWith(queryTrimmed)) {
          priority = 60;
        } else if (matchingSub && wordBoundaryRegex.test(matchingSub.toLowerCase())) {
          priority = 40;
        } else if (matchingSub && queryTrimmed.length > 3) {
          priority = 20;
        }

        return {
          cat,
          matchingSub,
          priority,
        };
      })
      .filter(item => item.priority > 0)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 2)
      .map(item => ({
        ...item.cat,
        matchedSubcategory: item.matchingSub
      }));

    // 3. Matching Tradespeople - strictly max 3 from finalDisplayList so dropdown order matches search results
    const matchingTradespeople = finalDisplayList.slice(0, 3);

    // 4. Matching Locations / Postcodes (Max 2)
    const locationsSet = new Set<string>();
    tradespeople.forEach(tp => {
      if (tp.postcode && tp.postcode.toLowerCase().includes(queryTrimmed)) {
        locationsSet.add(tp.postcode.toUpperCase());
      }
      if (tp.city && tp.city.toLowerCase().includes(queryTrimmed)) {
        locationsSet.add(tp.city);
      }
    });
    const matchingLocations = Array.from(locationsSet).slice(0, 2);

    const hasSuggestions = 
      matchingRecent.length > 0 || 
      categoryCandidates.length > 0 || 
      matchingTradespeople.length > 0 || 
      matchingLocations.length > 0;

    return {
      matchingRecent,
      matchingCategories: categoryCandidates,
      matchingTradespeople,
      matchingLocations,
      hasSuggestions,
    };
  }, [searchQuery, categories, finalDisplayList, tradespeople, recentSearches]);

  // Sliced list for compact initial rendering
  const visibleTradespeople = useMemo(() => {
    return finalDisplayList.slice(0, displayLimit);
  }, [finalDisplayList, displayLimit]);

  // Handle logging clicks and deducting budget on promoted profile clicks
  const handlePromotedCardClick = async (tp: any) => {
    if (tp.isPromotedAd && tp.adId && !String(tp.adId).startsWith("default") && !String(tp.adId).startsWith("seed-")) {
      try {
        const adRef = doc(db, "advertisements", tp.adId);
        const cost = tp.costPerDisplay || 1.00;
        const currentBal = tp.prepaidBalance || cost;
        const newBal = Math.max(0, currentBal - cost);

        const updateData: any = {
          clicks: (tp.clicks || 0) + 1,
          searchFeedClicks: (tp.searchFeedClicks || 0) + 1,
          prepaidBalance: newBal
        };

        // Smart Auto Top-Up: Reload £50 when balance drops <= £10
        if (tp.adData?.autoTopUpEnabled && newBal <= (tp.adData?.autoTopUpThreshold || 10)) {
          const topUpAmount = tp.adData?.autoTopUpAmount || 50;
          updateData.prepaidBalance = newBal + topUpAmount;
          updateData.lastAutoTopUpAt = new Date().toISOString();
        }

        await setDoc(adRef, updateData, { merge: true });
      } catch (e) {
        console.error("Error logging promoted profile click:", e);
      }
    }
  };

  // Infinite scroll listener to reveal 10 more on scroll near bottom
  useEffect(() => {
    if (displayLimit >= filteredTradespeople.length) return;

    const handleInfiniteScroll = () => {
      if (!loadMoreSentinelRef.current) return;
      const rect = loadMoreSentinelRef.current.getBoundingClientRect();
      if (rect.top <= window.innerHeight + 500) {
        setDisplayLimit(prev => Math.min(prev + 10, filteredTradespeople.length));
      }
    };

    window.addEventListener("scroll", handleInfiniteScroll, { passive: true });
    handleInfiniteScroll();

    return () => window.removeEventListener("scroll", handleInfiniteScroll);
  }, [displayLimit, filteredTradespeople.length]);

  useEffect(() => {
    if (!loading && filteredTradespeople.length === 0 && (searchQuery || selectedCategory !== "All" || minRating !== null || verifiedOnly || postcodeFilterEnabled)) {
      setShowNoResultsToast(true);
      const timer = setTimeout(() => setShowNoResultsToast(false), 6000);
      return () => clearTimeout(timer);
    } else {
      setShowNoResultsToast(false);
    }
  }, [filteredTradespeople.length, loading, searchQuery, selectedCategory, minRating, verifiedOnly, postcodeFilterEnabled]);

  useEffect(() => {
    if (selectedCategory !== "All" && filteredTradespeople.length > 0) {
      setSuccessMessage(`${filteredTradespeople.length} traders found for ${selectedCategory}`);
      setShowSuccessToast(true);
      const timer = setTimeout(() => setShowSuccessToast(false), 3000);
      
      // Auto-scroll to results
      if (resultsRef.current) {
        resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      
      return () => clearTimeout(timer);
    }
  }, [selectedCategory]);

  const sortOptions = ["Top Rated", "Most Reviews", "Response Rate", "Most Jobs Done", "Near Me"];

  // Criteria & Fair Equal-Chance Rotation for Trending Profiles:
  // 1. Max 10 profiles limit (increased from 5).
  // 2. Score & filter candidates using composite threshold criteria: rating (>=4.0), local postcode proximity, recommendations & verification.
  // 3. Apply a fair periodic rotation across qualifying candidates to give all eligible local traders equal visibility.
  const topRatedNearYou = useMemo(() => {
    if (!tradespeople || tradespeople.length === 0) return [];

    const userPrefix = profile?.postcode?.trim().split(' ')[0]?.toUpperCase() || "";

    // Score candidates based on composite quality metrics & area match
    const scored = tradespeople.map((tp) => {
      const ratingScore = (tp.rating || 4.5) * 20; // up to 100
      const recsScore = Math.min((tp.totalRecommendations || 0) * 2, 20); // up to 20
      const verifiedBonus = tp.verificationStatus === "verified" ? 15 : 0;
      
      const tpPostcode = (tp.postcode || "").trim().toUpperCase();
      const areaMatchBonus = (userPrefix && tpPostcode.startsWith(userPrefix)) ? 25 : 0;

      const totalScore = ratingScore + recsScore + verifiedBonus + areaMatchBonus;
      return { tp, score: totalScore, isAreaMatch: !!(userPrefix && tpPostcode.startsWith(userPrefix)) };
    });

    // Sort by composite score descending
    scored.sort((a, b) => b.score - a.score);

    // Filter qualifying pool (traders meeting quality threshold: rating >= 4.0 or area match)
    let qualifyingPool = scored.filter(item => (item.tp.rating || 0) >= 4.0 || item.isAreaMatch);
    if (qualifyingPool.length < 5) {
      qualifyingPool = scored.slice(0, 20); // Fallback to top 20 if strict threshold yields few candidates
    } else if (qualifyingPool.length > 20) {
      qualifyingPool = qualifyingPool.slice(0, 20); // Keep top 20 qualifying pool for rotation
    }

    // Fair Equal-Chance Rotation: Time/session-based rotation seed so every qualifying trader gets equal exposure
    const rotationSeed = Math.floor(Date.now() / (1000 * 60 * 15)); // Rotates every 15 minutes or session update
    const candidates = qualifyingPool.map(item => item.tp);

    // Deterministic shuffle using candidate UID & rotation seed
    const shuffled = [...candidates].sort((a, b) => {
      const hashA = (a.uid.charCodeAt(0) + rotationSeed) % 17;
      const hashB = (b.uid.charCodeAt(0) + rotationSeed) % 17;
      return hashA - hashB;
    });

    // Return maximum of 10 profiles for the trending section
    return shuffled.slice(0, 10);
  }, [tradespeople, profile?.postcode]);

  const hotSearches = [
    { label: "Emergency Plumber", query: "Plumber" },
    { label: "Boiler Service", query: "Boiler" },
    { label: "Kitchen Fitting", query: "Kitchen" },
    { label: "Smart Home", query: "Smart" },
    { label: "Rewiring", query: "Rewiring" },
    { label: "Leak Repair", query: "Leak" }
  ];

  if (showSplash) {
    return (
      <div className="max-w-md mx-auto p-4 space-y-6 pt-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
        
        {/* Double Confirmation Modal */}
        <AnimatePresence>
          {showSkipConfirm && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl overflow-hidden p-6 max-w-sm w-full shadow-2xl border border-black text-center"
              >
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-200">
                  <AlertTriangle className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Skip Linking?</h3>
                <p className="text-slate-600 text-sm mb-6 font-medium leading-relaxed">
                  Are you sure you want to proceed without linking a project? Any jobs requested will still appear under your Hiring Jobs.
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowSkipConfirm(false)}
                    className="flex-1 py-3 px-4 rounded-xl border-2 border-black font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => { setShowSkipConfirm(false); setShowSplash(false); }}
                    className="flex-1 py-3 px-4 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors border border-blue-600"
                  >
                    Yes, Skip
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setShowSkipConfirm(true)}
          className="w-full py-2.5 px-4 mb-3 rounded-xl bg-yellow-100 border border-black shadow-sm flex flex-col items-center justify-center text-center hover:bg-yellow-200 active:scale-95 transition-all"
        >
          <span className="text-black font-extrabold text-[13px] uppercase tracking-wider">SKIP WITHOUT LINKING</span>
          <span className="text-slate-600 font-bold text-[9px] uppercase tracking-widest mt-0.5">/ OR SELECT A PROJECT BELOW</span>
        </button>

        <div className="space-y-1">
          <p className="text-slate-800 text-lg font-medium leading-snug">
            Select an active project or property to link with this service request.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name, address or postcode" 
              className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm"
            />
          </div>
          <button 
            onClick={() => navigate('/portfolio')}
            className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shrink-0 shadow-lg hover:bg-blue-700 active:scale-95 transition-all"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        <div className="border border-black rounded-3xl p-6 border-dashed bg-white shadow-sm flex flex-col items-center justify-center text-center min-h-[250px]">
          {userAssets.length > 0 ? (
            <div className="w-full space-y-3">
              {userAssets.map(asset => (
                <button
                  key={asset.id}
                  onClick={() => { setSelectedAsset(asset); setShowSplash(false); }}
                  className="w-full p-4 rounded-xl border border-slate-200 hover:border-blue-600 hover:bg-blue-50 transition-all text-left flex items-center justify-between group bg-white shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center group-hover:border-blue-600 shrink-0">
                       <div className="w-2.5 h-2.5 rounded-full bg-transparent group-hover:bg-blue-600 transition-colors" />
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center border border-blue-200 shrink-0">
                      <Briefcase className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">{asset.name || asset.propertyName || "Unnamed Project"}</h4>
                      {asset.address?.line1 && <p className="text-xs text-slate-500 mt-0.5">{asset.address.line1}</p>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
             <div className="flex flex-col items-center justify-center py-8">
              <Building className="w-12 h-12 text-slate-300 mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">No projects found</h3>
              <p className="text-slate-700 text-base max-w-[250px] leading-snug font-medium">Add a project or property first to hire B2B services.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto -mt-6 relative">
      {(platformConfig?.isDemo || true) && (
        <button
          onClick={seedMockTraders}
          className="absolute top-0 right-4 z-50 bg-indigo-600 text-white text-xs px-3 py-1 rounded shadow-md hover:bg-indigo-700"
        >
          Seed Mock Traders
        </button>
      )}
      <SEO 
        title="Find Trades & Helpers" 
        description="Search for verified tradespeople and community helpers on AnyTrader. View profiles, reviews, and hire the best talent for your project."
      />
      {/* Header Section */}
      <div className="bg-[#1e293b] text-white p-6 rounded-b-3xl shadow-lg mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Find Tradespeople</h1>
            <motion.div 
              key={filteredTradespeople.length}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 border border-blue-400 rounded-full mt-2 shadow-[0_0_15px_rgba(37,99,235,0.3)]"
            >
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-white animate-ping absolute inset-0 opacity-75" />
                <div className="w-2 h-2 rounded-full bg-white relative" />
              </div>
              <p className="text-white text-[10px] font-black uppercase tracking-[0.15em]">
                {filteredTradespeople.length} <span className="text-blue-100 font-bold">Traders Available</span>
              </p>
            </motion.div>
          </div>
          <button 
            onClick={() => setIsFilterModalOpen(true)}
            className="p-2 bg-slate-700 rounded-xl hover:bg-slate-600 transition-colors"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div ref={searchContainerRef} className="relative mb-6 z-[90]">
          <div className="relative z-[95]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder={isListening ? "Listening..." : "Name, trade, postcode..."}
              value={searchQuery}
              onFocus={() => {
                setIsSearchFocused(true);
                setSelectedCategory("All");
              }}
              onClick={() => {
                setSelectedCategory("All");
              }}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchFocused(true);
                setSelectedCategory("All");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchQuery.trim()) {
                  addRecentSearch(searchQuery);
                  setIsSearchFocused(false);
                }
                if (e.key === "Escape") {
                  setIsSearchFocused(false);
                }
              }}
              className={cn(
                 "w-full bg-white pl-12 pr-24 py-3 rounded-2xl shadow-inner transition-colors",
                 isListening ? "focus:outline-none focus:ring-2 focus:ring-red-500 border-2 border-red-500 bg-red-50" : "text-slate-900 border border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              )}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 group">
              <div className="relative flex items-center justify-center">
                <button 
                  onClick={startVoiceSearch}
                  title="Voice Search"
                  className={cn(
                    "p-2 rounded-xl transition-all flex items-center justify-center",
                    isListening ? "bg-red-500 text-white animate-pulse shadow-md shadow-red-500/20" : "text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                  )}
                >
                  <Mic className="w-5 h-5" />
                </button>

                <div className={cn(
                  "absolute right-0 top-full mt-2 w-max max-w-[240px] p-3 bg-slate-800 text-white rounded-xl shadow-xl z-50 transition-all origin-top-right pointer-events-none",
                  isListening ? "opacity-100 scale-100 visible" : "opacity-0 scale-95 invisible group-hover:opacity-100 group-hover:scale-100 group-hover:visible"
                )}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                     <Info className="w-3 h-3" /> Voice Commands
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs bg-slate-700/50 px-2 py-1 rounded-md border border-slate-600/50">"Find a plumber in Manchester"</span>
                    <span className="text-xs bg-slate-700/50 px-2 py-1 rounded-md border border-slate-600/50">"Emergency electrician"</span>
                  </div>
                  <div className="absolute -top-1.5 right-3 w-3 h-3 bg-slate-800 rotate-45 rounded-sm"></div>
                </div>
              </div>
              {searchQuery && (
                <button 
                  onClick={() => {
                    setSearchQuery("");
                    setIsSearchFocused(false);
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                  title="Clear Search"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Backdrop when search suggestion box is open to prevent card bleed-through */}
          {isSearchFocused && searchQuery.trim().length >= 1 && autocompleteSuggestions.hasSuggestions && (
            <div 
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[80] transition-opacity" 
              onClick={() => setIsSearchFocused(false)} 
            />
          )}

          {/* Live Auto-Complete Dropdown */}
          <AnimatePresence>
            {isSearchFocused && searchQuery.trim().length >= 1 && autocompleteSuggestions.hasSuggestions && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-black rounded-2xl shadow-2xl z-[100] overflow-hidden text-slate-900 divide-y divide-slate-100 max-h-[320px] overflow-y-auto"
              >
                {/* Top Header Bar with Close Cross Button */}
                <div className="sticky top-0 z-[110] bg-white/95 backdrop-blur-sm px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Search Suggestions
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSearchFocused(false);
                    }}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Close suggestions"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {/* Category Section */}
                {autocompleteSuggestions.matchingCategories.length > 0 && (
                  <div className="p-2">
                    <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-orange-600">
                        <Tag className="w-3.5 h-3.5" /> Categories & Services
                      </span>
                      <span className="text-[9px] bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.2 rounded-full font-extrabold">
                        {autocompleteSuggestions.matchingCategories.length}
                      </span>
                    </div>
                    <div className="space-y-1 mt-1">
                      {autocompleteSuggestions.matchingCategories.map(cat => {
                        const Icon = iconMap[cat.icon];
                        const matchedSub = (cat as any).matchedSubcategory;
                        return (
                          <button
                            key={cat.docId || cat.id}
                            type="button"
                            onClick={() => {
                              handleCategorySelect(cat.name);
                              setIsSearchFocused(false);
                            }}
                            className="w-full px-3 py-2 rounded-xl hover:bg-slate-100 flex items-center justify-between text-left transition-colors group cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                                {Icon ? <Icon className="w-4 h-4" /> : <Tag className="w-4 h-4" />}
                              </div>
                              <div className="truncate">
                                <p className="text-xs font-bold text-black truncate">{cat.name}</p>
                                <p className="text-[10px] text-slate-500 truncate">
                                  {matchedSub ? `Matches: ${matchedSub}` : (cat.description || "Browse trade category")}
                                </p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tradespeople Direct Match Section */}
                {autocompleteSuggestions.matchingTradespeople.length > 0 && (
                  <div className="p-2">
                    <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-blue-600">
                        <Users className="w-3.5 h-3.5" /> Verified Tradespeople
                      </span>
                      <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded-full font-extrabold">
                        {autocompleteSuggestions.matchingTradespeople.length}
                      </span>
                    </div>
                    <div className="space-y-1 mt-1">
                      {autocompleteSuggestions.matchingTradespeople.map(tp => (
                        <button
                          key={tp.uid}
                          type="button"
                          onClick={() => {
                            if ((tp as any).isPromotedAd) {
                              handlePromotedCardClick(tp);
                            }
                            setSelectedTraderPreview(tp);
                            addRecentSearch(tp.name);
                            setIsSearchFocused(false);
                          }}
                          className="w-full px-3 py-2 rounded-xl hover:bg-slate-100 flex items-center justify-between text-left transition-colors group cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-slate-800 text-white font-bold flex items-center justify-center shrink-0 border border-black overflow-hidden relative">
                              {tp.avatarUrl ? (
                                <img src={tp.avatarUrl} alt={tp.name} className="w-full h-full object-cover" />
                              ) : (
                                tp.name.charAt(0)
                              )}
                            </div>
                            <div className="truncate min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-black truncate">{tp.name}</p>
                                {(tp as any).isPromotedAd ? (
                                  <span className="text-[9px] bg-amber-500 text-white px-1.5 py-0.2 rounded font-extrabold uppercase shrink-0">
                                    Promoted
                                  </span>
                                ) : (
                                  tp.verificationStatus === "verified" && (
                                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                  )
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500 truncate">
                                {tp.trades?.[0] || 'Tradesperson'} • £{tp.miniProfileSettings?.callOutFee || 0} call-out
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                              <span className="text-[10px] font-extrabold text-amber-800">{tp.rating?.toFixed(1) || '5.0'}</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Locations / Postcodes Section */}
                {autocompleteSuggestions.matchingLocations.length > 0 && (
                  <div className="p-2">
                    <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-red-500" /> Locations & Postcodes
                    </div>
                    <div className="space-y-1 mt-1">
                      {autocompleteSuggestions.matchingLocations.map(loc => (
                        <button
                          key={loc}
                          type="button"
                          onClick={() => {
                            setPostcodeFilterValue(loc);
                            setPostcodeFilterEnabled(true);
                            localStorage.setItem("postcodeFilterValue", loc);
                            localStorage.setItem("postcodeFilterEnabled", "true");
                            addRecentSearch(`Location: ${loc}`);
                            setIsSearchFocused(false);
                          }}
                          className="w-full px-3 py-1.5 rounded-xl hover:bg-slate-100 flex items-center justify-between text-left transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2 text-xs font-bold text-black">
                            <MapPin className="w-3.5 h-3.5 text-red-500" />
                            <span>Filter area: {loc}</span>
                          </div>
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                            Apply Location
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Matching Searches */}
                {autocompleteSuggestions.matchingRecent.length > 0 && (
                  <div className="p-2">
                    <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-purple-600" /> Recent History
                    </div>
                    <div className="space-y-1 mt-1">
                      {autocompleteSuggestions.matchingRecent.map(term => (
                        <button
                          key={term}
                          type="button"
                          onClick={() => {
                            setSearchQuery(term);
                            addRecentSearch(term);
                            setIsSearchFocused(false);
                          }}
                          className="w-full px-3 py-1.5 rounded-xl hover:bg-slate-100 flex items-center justify-between text-left transition-colors cursor-pointer text-xs font-bold text-black"
                        >
                          <div className="flex items-center gap-2">
                            <History className="w-3.5 h-3.5 text-slate-400" />
                            <span>{term}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">Saved</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Direct Full Search Submit Bar */}
                <div className="p-2 bg-slate-50 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      addRecentSearch(searchQuery);
                      setIsSearchFocused(false);
                    }}
                    className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer shadow-xs"
                  >
                    <span className="flex items-center gap-2">
                      <Search className="w-3.5 h-3.5" /> See all matches for "{searchQuery}"
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Fuzzy Search Suggestion */}
        <DidYouMeanSuggestion 
          suggestion={fuzzySuggestion} 
          onApplySuggestion={handleApplySuggestion}
          onDismiss={() => setFuzzySuggestion(null)}
          variant="dark"
        />

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {categoryNames.map(cat => {
            const categoryData = categories.find(c => c.name === cat);
            const Icon = categoryData ? iconMap[categoryData.icon] : null;
            const isAll = cat === "All";
            const isSelected = selectedCategory === cat;
            
            return (
              <button
                key={cat}
                onClick={() => handleCategorySelect(cat)}
                className={cn(
                  "px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-2 shrink-0 cursor-pointer relative",
                  isSelected 
                    ? "bg-orange-500 text-white shadow-md shadow-orange-500/20" 
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600",
                  isAll && isCategoryAutoReset && "ring-2 ring-amber-400 bg-orange-600 animate-pulse scale-105"
                )}
              >
                {categoryData && (
                  Icon ? <Icon className="w-4 h-4" /> : <span className="text-base">{categoryData.icon}</span>
                )}
                {cat}
                {isAll && isCategoryAutoReset && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Smart Quick-Filter Preset Chips (Option 1) */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 pb-1 no-scrollbar border-t border-slate-700/50 mt-1">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> Quick Filters:
          </span>
          <button
            onClick={() => setQuickEmergency(!quickEmergency)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer",
              quickEmergency
                ? "bg-red-600 text-white border-red-500 shadow-sm"
                : "bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700"
            )}
          >
            <AlertTriangle className={cn("w-3.5 h-3.5", quickEmergency ? "text-white" : "text-red-400")} />
            24/7 Emergency
            <span className={cn("text-[9px] px-1.5 py-0.2 rounded-full font-black", quickEmergency ? "bg-red-800 text-white" : "bg-slate-700 text-slate-300")}>
              {quickFilterCounts.emergency}
            </span>
          </button>

          <button
            onClick={() => setQuickVerified(!quickVerified)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer",
              quickVerified
                ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                : "bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700"
            )}
          >
            <ShieldCheck className={cn("w-3.5 h-3.5", quickVerified ? "text-white" : "text-blue-400")} />
            Verified
            <span className={cn("text-[9px] px-1.5 py-0.2 rounded-full font-black", quickVerified ? "bg-blue-800 text-white" : "bg-slate-700 text-slate-300")}>
              {quickFilterCounts.verified}
            </span>
          </button>

          <button
            onClick={() => setQuickTopRated(!quickTopRated)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer",
              quickTopRated
                ? "bg-amber-500 text-white border-amber-400 shadow-sm"
                : "bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700"
            )}
          >
            <Star className={cn("w-3.5 h-3.5 fill-current", quickTopRated ? "text-white text-amber-200" : "text-amber-400")} />
            Top Rated 4.5+
            <span className={cn("text-[9px] px-1.5 py-0.2 rounded-full font-black", quickTopRated ? "bg-amber-700 text-white" : "bg-slate-700 text-slate-300")}>
              {quickFilterCounts.topRated}
            </span>
          </button>

          <button
            onClick={() => setQuickFastReply(!quickFastReply)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer",
              quickFastReply
                ? "bg-emerald-600 text-white border-emerald-500 shadow-sm"
                : "bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700"
            )}
          >
            <Clock className={cn("w-3.5 h-3.5", quickFastReply ? "text-white" : "text-emerald-400")} />
            Fast Reply
            <span className={cn("text-[9px] px-1.5 py-0.2 rounded-full font-black", quickFastReply ? "bg-emerald-800 text-white" : "bg-slate-700 text-slate-300")}>
              {quickFilterCounts.fastReply}
            </span>
          </button>

          {(quickEmergency || quickVerified || quickTopRated || quickFastReply) && (
            <button
              onClick={() => {
                setQuickEmergency(false);
                setQuickVerified(false);
                setQuickTopRated(false);
                setQuickFastReply(false);
              }}
              className="px-2 py-1 text-[11px] font-bold text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Sort Options */}
      <div className="px-4 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          <span className="text-slate-500 text-sm font-medium mr-2">Sort:</span>
          {sortOptions.map(opt => (
            <button
              key={opt}
              onClick={() => setSortBy(opt)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border-2 border-black transition-all shrink-0",
                sortBy === opt 
                  ? "bg-[#1e293b] text-white" 
                  : "bg-white text-slate-900 hover:bg-slate-50"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Discovery / Hot Searches - Only visible when search is empty */}
      {!searchQuery && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 space-y-8 mb-8"
        >
          {/* Recent Searches Section */}
          {recentSearches.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-600" />
                  <h2 className="font-bold text-black text-sm">Recent Searches</h2>
                  <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                    {recentSearches.length}
                  </span>
                </div>
                <button
                  onClick={clearAllRecentSearches}
                  className="text-[11px] font-bold text-slate-500 hover:text-red-600 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Clear All
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((search) => {
                  const isCat = categories.some(c => c.name.toLowerCase() === search.toLowerCase());
                  return (
                    <button
                      key={search}
                      onClick={() => {
                        if (isCat) {
                          const matchedCat = categories.find(c => c.name.toLowerCase() === search.toLowerCase());
                          handleCategorySelect(matchedCat ? matchedCat.name : search);
                        } else {
                          setSearchQuery(search);
                          setSelectedCategory("All");
                          addRecentSearch(search);
                        }
                      }}
                      className="group px-3 py-1.5 bg-white border border-black rounded-lg text-xs font-bold text-black hover:bg-slate-50 transition-all flex items-center gap-2 shadow-xs active:scale-[0.98]"
                    >
                      {isCat ? (
                        <Tag className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      ) : (
                        <Search className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      )}
                      <span className="text-black">{search}</span>
                      <span
                        onClick={(e) => removeRecentSearch(search, e)}
                        className="p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors ml-1"
                        title="Remove search"
                      >
                        <X className="w-3 h-3" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Category Bubbles */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-900 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-orange-500 rounded-full" />
                Browse Categories
              </h2>
              {categories.length > 12 && (
                <button 
                  onClick={() => setIsCategoriesExpanded(!isCategoriesExpanded)}
                  className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:text-blue-700 transition-colors"
                >
                  {isCategoriesExpanded ? "Hide" : "Show all"}
                  <ChevronRight className={cn("w-3 h-3 transition-transform", isCategoriesExpanded && "rotate-90")} />
                </button>
              )}
            </div>
            <motion.div 
              layout
              className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3"
            >
              {(isCategoriesExpanded ? categories : categories.slice(0, 12)).map(cat => {
                const Icon = iconMap[cat.icon];
                return (
                  <button
                    key={cat.docId || cat.id}
                    onClick={() => handleCategorySelect(cat.name)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-3 p-4 rounded-xl border transition-all group active:scale-[0.98] relative",
                      selectedCategory === cat.name 
                        ? "border-[#0084a5] border-2 bg-[#0084a5]/5" 
                        : "border-[#0084a5]/40 border-2 bg-white hover:border-[#0084a5] hover:bg-slate-50"
                    )}
                  >
                    {categoryCounts[cat.name] > 0 && (
                      <span className="absolute top-1.5 right-1.5 bg-blue-50 text-blue-600 text-[8px] font-black px-1.5 py-0.5 rounded-full border border-blue-100 flex items-center gap-0.5">
                        <Users className="w-2 h-2" />
                        {categoryCounts[cat.name]}
                      </span>
                    )}
                    <div className="w-10 h-10 rounded-lg bg-[#0084a5]/10 flex items-center justify-center shrink-0">
                      {Icon ? <Icon className="w-5 h-5 text-[#0084a5]" /> : <span className="text-xl">{cat.icon}</span>}
                    </div>
                    <span className="font-bold text-[11px] text-center leading-tight text-slate-800 line-clamp-2">{cat.name}</span>
                  </button>
                );
              })}
            </motion.div>
          </div>

          {/* Recently Viewed */}
          {recentlyViewedTraders.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-blue-500" />
                <h2 className="font-bold text-slate-900">Recently Viewed</h2>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                {recentlyViewedTraders.map(tp => (
                  <Link 
                    key={tp.uid} 
                    to={`/profile/${tp.uid}`}
                    state={isB2B && selectedAsset ? { linkedPropertyId: selectedAsset.id, linkedPropertyName: selectedAsset.name || selectedAsset.propertyName || selectedAsset.address?.line1, isB2B } : undefined}
                    className="flex-shrink-0 w-24 bg-white p-2 rounded-2xl border-2 border-black shadow-sm hover:shadow-md transition-shadow text-center"
                  >
                    <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-white font-bold text-lg mx-auto mb-2">
                      {tp.avatarUrl ? (
                        <img src={tp.avatarUrl} alt={tp.name} className="w-full h-full object-cover rounded-xl" referrerPolicy="no-referrer" />
                      ) : (
                        tp.name.charAt(0)
                      )}
                    </div>
                    <h3 className="text-[10px] font-bold text-slate-900 truncate">{tp.name}</h3>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Hot Searches */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-orange-500 fill-orange-500" />
              <h2 className="font-bold text-slate-900">Hot Searches</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {hotSearches.map(item => (
                <button
                  key={item.label}
                  onClick={() => {
                    setSearchQuery(item.query);
                    addRecentSearch(item.label);
                  }}
                  className="px-4 py-2 bg-white border-2 border-black rounded-xl text-xs font-bold text-slate-900 hover:bg-slate-50 transition-all flex items-center gap-2"
                >
                  <Search className="w-3 h-3" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Top Rated Near You (Integrated) */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-4 h-4 text-orange-500 fill-orange-500" />
              <h2 className="font-bold text-slate-900">
                Trending in {profile?.postcode?.split(' ')[0] || "Your Area"}
              </h2>
            </div>
            <div className="overflow-hidden w-full pb-2 relative group">
              <div className="animate-slow-scroll flex gap-3 w-max">
                {(topRatedNearYou.length > 0 
                  ? (topRatedNearYou.length < 6 
                      ? [...topRatedNearYou, ...topRatedNearYou, ...topRatedNearYou, ...topRatedNearYou] 
                      : [...topRatedNearYou, ...topRatedNearYou])
                  : []
                ).map((tp, index) => {
                  let testRecmd = tp.totalRecommendations || 0;
                  let testReviews = tp.totalReviews || 0;
                  
                  return (
                  <Link 
                    key={`${tp.uid}-${index}`} 
                    to={`/profile/${tp.uid}`}
                    state={isB2B && selectedAsset ? { linkedPropertyId: selectedAsset.id, linkedPropertyName: selectedAsset.name || selectedAsset.propertyName || selectedAsset.address?.line1, isB2B } : undefined}
                    className="flex-shrink-0 w-36 bg-white p-3 rounded-2xl border border-black shadow-sm hover:shadow-md transition-all text-center flex flex-col items-center justify-between overflow-hidden"
                  >
                    <div className="w-full flex flex-col items-center">
                      <div className="relative mb-2 shrink-0">
                        <div className="w-14 h-14 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center text-slate-800 font-bold text-xl border border-slate-200">
                          {tp.avatarUrl ? (
                            <img src={tp.avatarUrl} alt={tp.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            tp.name.charAt(0)
                          )}
                        </div>
                        {tp.verificationStatus === "verified" && (
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center border border-white shadow-sm" title="Verified Trade">
                            <ShieldCheck className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <h3 className="text-xs font-bold text-black truncate w-full px-0.5 mb-0.5" title={tp.name}>{tp.name}</h3>
                      <p className="text-[10.5px] font-semibold text-black truncate w-full px-0.5 mb-2">{tp.trades?.[0] || 'Tradesperson'}</p>
                    </div>

                    <div className="w-full pt-1.5 border-t border-slate-100 flex flex-col items-center gap-1">
                      <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-900">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                        <span>{tp.rating ? Number(tp.rating).toFixed(1) : 'N/A'}</span>
                        <span className="text-[10px] text-slate-400 font-medium">({testReviews})</span>
                      </div>
                      {testRecmd > 0 && (
                        <div className="w-full bg-emerald-50 border border-emerald-200 rounded-lg px-1 py-0.5 flex items-center justify-center gap-1 text-[8.5px] font-bold text-emerald-800 truncate">
                          <Users className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{testRecmd} Recmds</span>
                        </div>
                      )}
                    </div>
                  </Link>
                )})}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Tradespeople List - Bento Grid */}
      <div ref={resultsRef} className="px-4 pb-12">
        {(searchQuery || selectedCategory !== "All") && (
          <div className="flex items-center gap-2 mb-4">
            <h2 className="font-bold text-slate-900">
              {selectedCategory !== "All" ? `${selectedCategory} Results` : "Search Results"}
            </h2>
            <span className="text-xs text-slate-500 font-medium">({filteredTradespeople.length} found)</span>
          </div>
        )}
        
        {viewMode === "map" ? (
          <div ref={mapContainerRef} tabIndex={-1} className="mb-10 focus:outline-none">
            <div className="bg-slate-900 border-2 border-black rounded-3xl p-3 sm:p-4 text-white shadow-2xl relative">
              {/* Map Header Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-600 rounded-xl">
                    <Map className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      Interactive Tradesperson Map
                      <span className="text-[10px] font-extrabold bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                        {filteredTradespeople.length} Pinned
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">Nearby verified tradespeople in radius</p>
                  </div>
                </div>

                {/* Distance Radius Selector */}
                <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
                  <Compass className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold text-slate-300">Radius:</span>
                  <select
                    value={mapRadiusKm}
                    onChange={(e) => setMapRadiusKm(Number(e.target.value))}
                    className="bg-transparent text-xs font-black text-white focus:outline-none cursor-pointer"
                  >
                    <option value={3} className="bg-slate-900 text-white">3 km (2 miles)</option>
                    <option value={5} className="bg-slate-900 text-white">5 km (3 miles)</option>
                    <option value={10} className="bg-slate-900 text-white">10 km (6 miles)</option>
                    <option value={20} className="bg-slate-900 text-white">20 km (12 miles)</option>
                  </select>
                </div>
              </div>

              {/* Google Map Container */}
              <div className="w-full h-[520px] sm:h-[620px] rounded-2xl overflow-hidden border border-slate-700 relative">
                {isMapScriptLoaded ? (
                  <GoogleMap
                    mapContainerStyle={{ width: "100%", height: "100%" }}
                    center={
                      filteredTradespeople.length > 0
                        ? getTraderCoordinates(filteredTradespeople[0])
                        : { lat: 51.5074, lng: -0.1278 }
                    }
                    zoom={12}
                    options={premiumMapOptions}
                  >
                    {/* Distance Radius Circle */}
                    <CircleF
                      center={
                        filteredTradespeople.length > 0
                          ? getTraderCoordinates(filteredTradespeople[0])
                          : { lat: 51.5074, lng: -0.1278 }
                      }
                      radius={mapRadiusKm * 1000}
                      options={{
                        fillColor: "#2563eb",
                        fillOpacity: 0.12,
                        strokeColor: "#2563eb",
                        strokeOpacity: 0.6,
                        strokeWeight: 2,
                      }}
                    />

                    {/* Pinned Tradespeople Markers */}
                    {filteredTradespeople.map((tp) => {
                      const coords = getTraderCoordinates(tp);
                      const isSelected = selectedMapTrader?.uid === tp.uid;
                      return (
                        <MarkerF
                          key={tp.uid}
                          position={coords}
                          onClick={() => setSelectedMapTrader(tp)}
                          title={tp.name}
                          icon={{
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: isSelected ? 12 : 9,
                            fillColor: tp.isAvailableForEmergency ? "#dc2626" : "#2563eb",
                            fillOpacity: 1,
                            strokeColor: "#ffffff",
                            strokeWeight: 2.5,
                          }}
                        />
                      );
                    })}

                    {/* InfoWindow for Selected Tradesperson */}
                    {selectedMapTrader && (
                      <InfoWindowF
                        position={getTraderCoordinates(selectedMapTrader)}
                        onCloseClick={() => setSelectedMapTrader(null)}
                      >
                        <div className="p-1 max-w-[220px] text-slate-900">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-9 h-9 rounded-xl bg-slate-800 text-white font-bold flex items-center justify-center shrink-0 overflow-hidden border border-black">
                              {selectedMapTrader.avatarUrl ? (
                                <img src={selectedMapTrader.avatarUrl} alt={selectedMapTrader.name} className="w-full h-full object-cover" />
                              ) : (
                                selectedMapTrader.name.charAt(0)
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-slate-900 truncate flex items-center gap-1">
                                {selectedMapTrader.name}
                                {selectedMapTrader.verificationStatus === "verified" && (
                                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                )}
                              </h4>
                              <p className="text-[10px] text-slate-500 truncate">{selectedMapTrader.trades?.[0] || 'Tradesperson'}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] bg-slate-50 p-1.5 rounded-lg border border-slate-200 mb-2">
                            <span className="font-extrabold text-amber-700 flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                              {selectedMapTrader.rating?.toFixed(1) || '5.0'} ({selectedMapTrader.totalReviews || 0})
                            </span>
                            <span className="font-bold text-blue-700">
                              £{selectedMapTrader.miniProfileSettings?.callOutFee || 0} call-out
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedTraderPreview(selectedMapTrader)}
                            className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1"
                          >
                            View Profile & Quote <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </InfoWindowF>
                    )}
                  </GoogleMap>
                ) : (
                  <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-400">
                    <Map className="w-10 h-10 text-blue-500 animate-pulse mb-3" />
                    <p className="text-sm font-bold text-white">Loading Interactive Trade Map...</p>
                    <p className="text-xs text-slate-500 mt-1">Locating nearby verified professionals</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <AnimatePresence>
        {showNoResultsToast && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[110] bg-orange-500 text-white px-6 py-3 rounded-2xl shadow-2xl border border-orange-400 flex items-center gap-3 whitespace-nowrap"
            >
              <AlertTriangle className="w-5 h-5 text-white" />
              <p className="text-sm font-bold">No matches! Try adjusting your search or filters.</p>
              <button onClick={() => setShowNoResultsToast(false)} className="ml-2 p-1 hover:bg-orange-600 rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showSuccessToast && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[110] bg-blue-600 text-white px-6 py-3 rounded-2xl shadow-2xl border border-blue-500 flex items-center gap-3 whitespace-nowrap"
            >
              <CheckCircle className="w-5 h-5 text-white" />
              <p className="text-sm font-bold">{successMessage}</p>
              <button onClick={() => setShowSuccessToast(false)} className="ml-2 p-1 hover:bg-blue-700 rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {visibleTradespeople.map((tp, index) => {
          let testReviews = tp.totalReviews || 0;
          let testRecmd = tp.totalRecommendations || 0;

          // Get the actual badge objects for the selected search feed badges
          const searchFeedBadgeObjects = (tp.searchFeedBadges || [])
            .map(id => PROFESSIONAL_BADGES.find(b => b.id === id))
            .filter(Boolean)
            .slice(0, 4); // Tier 1 Rule Constraint: Max 4 badges

          let typicalPriceHtml = null;
          if ((tp.totalJobsDone || 0) >= 5 && (tp.completedJobsRevenue || 0) > 0) {
            const avg = (tp.completedJobsRevenue || 0) / (tp.totalJobsDone || 1);
            const lowerBound = Math.round(avg * 0.85 / 10) * 10; // Round to nearest 10
            const upperBound = Math.round(avg * 1.15 / 10) * 10;
            typicalPriceHtml = (
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-900 tracking-tight">
                💰 Typical: <span className="text-blue-600">£{lowerBound} - £{upperBound}</span>
              </div>
            );
          }

          const isMiniProfileFlipped = selectedMiniProfile?.uid === tp.uid;

          return (
          <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            key={tp.uid}
            onClick={() => {
              if ((tp as any).isPromotedAd) {
                handlePromotedCardClick(tp);
              }
              if (isMiniProfileFlipped) {
                setSelectedMiniProfile(null);
              } else {
                setSelectedTraderPreview(tp);
              }
            }}
            className={`bg-white rounded-3xl border-2 shadow-sm overflow-hidden flex flex-col relative cursor-pointer hover:border-slate-800 hover:shadow-md transition-all group ${(tp as any).isPromotedAd ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-black'}`}
          >
            {/* Promoted Sponsor Header Pill */}
            {(tp as any).isPromotedAd && (
              <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white px-4 py-1 flex items-center justify-between text-[11px] font-black uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 fill-white text-white animate-pulse" /> Promoted Profile
                </span>
                <span className="text-[9px] opacity-90 lowercase font-medium">sponsored</span>
              </div>
            )}

            {/* Top Right Triangle Corner */}
            {!isMiniProfileFlipped && (
              <div 
                className="absolute top-0 right-0 w-[52px] h-[52px] bg-[#0066cc] z-10 cursor-pointer hover:bg-blue-700 transition-colors"
                style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}
                onClick={(e) => { e.stopPropagation(); setSelectedMiniProfile(tp); }}
              >
                <div className="absolute top-[8px] right-[2px] transform rotate-45 uppercase text-white text-[10px] font-black tracking-widest">
                  INFO
                </div>
              </div>
            )}

            <AnimatePresence mode="popLayout">
              {isMiniProfileFlipped ? (
                <motion.div
                  key="flipped"
                  initial={{ rotateY: -90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ rotateY: 90, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white p-6 relative w-full h-full flex flex-col justify-center min-h-[160px]"
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedMiniProfile(null); }}
                    className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors flex items-center justify-center z-20"
                  >
                    <X className="w-4 h-4 text-slate-400 font-bold" />
                  </button>
                  
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-[#0066cc] rounded-full flex items-center justify-center text-white shrink-0 shadow-sm">
                      <span className="font-serif font-bold text-2xl italic">i</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-[#0066cc] text-xl tracking-tight leading-tight">Instant Info</h3>
                      <p className="text-xs text-slate-400 font-medium">Pricing & Details</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white rounded-2xl py-2 border-2 border-[#81c3f8] text-center shadow-sm">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">CALL-OUT FEE</p>
                        <p className="text-xl font-black text-[#0066cc]">£{tp.miniProfileSettings?.callOutFee || 0}</p>
                      </div>
                      <div className="bg-white rounded-2xl py-2 border-2 border-[#81c3f8] text-center shadow-sm">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">HOURLY RATE</p>
                        <p className="text-xl font-black text-[#0066cc]">£{tp.miniProfileSettings?.hourlyRate || 0}</p>
                      </div>
                    </div>

                    {tp.miniProfileSettings?.extraInfo && (
                      <div className="bg-white rounded-2xl p-3 border-2 border-[#81c3f8] text-center shadow-sm">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">EXTRA INFO</p>
                        <p className="text-sm font-medium text-[#0066cc] leading-tight break-words whitespace-pre-wrap">
                          "{tp.miniProfileSettings.extraInfo.length > 120 ? tp.miniProfileSettings.extraInfo.substring(0, 120) + '...' : tp.miniProfileSettings.extraInfo}"
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="front"
                  initial={{ rotateY: 90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ rotateY: -90, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  <div className="p-4">
                    <div className="flex gap-4">
                {/* Photo: Large & Left-Aligned for rapid scanning */}
                <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center text-white font-black text-2xl relative shrink-0 overflow-hidden shadow-inner">
                  {tp.avatarUrl ? (
                    <img src={tp.avatarUrl} alt={tp.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    tp.name.charAt(0)
                  )}
                  {tp.isAvailableForEmergency && (
                    <div className="absolute bottom-0 left-0 right-0 bg-red-600 py-0.5 text-[8px] font-black tracking-widest text-white text-center uppercase">
                      24/7
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 mb-1">
                    <h3 className="font-bold text-slate-900 text-lg truncate group-hover:text-blue-600 transition-colors">
                      {tp.name}
                    </h3>
                    {tp.verificationStatus === "verified" && (
                      <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                    )}
                  </div>
                  
                  <p className="text-xs text-slate-500 font-medium truncate mb-1.5">
                    {tp.trades?.[0] || 'Professional'}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 text-[11px] font-bold text-slate-600 leading-normal">
                     <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
                      <span className="text-slate-900">{tp.rating?.toFixed(1) || '5.0'}</span>
                      <span className="text-slate-400 font-medium tracking-tight whitespace-nowrap shrink-0">({testReviews})</span>
                    </div>
                    <div className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-md px-1.5 py-0.5 text-green-800 shrink-0">
                      <Users className="w-2.5 h-2.5 text-green-700" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-green-900 shrink-0 whitespace-nowrap">Recmd By {testRecmd}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-500">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{tp.postcode?.split(' ')[0] || 'Local'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-500">
                       <Clock className="w-3 h-3" />
                       <span className="truncate">&lt; 1hr reply</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Badges & Trust Signals */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border-2 border-black">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                  <span className="text-[10px] font-bold text-slate-800 tracking-tight">Available this week</span>
                </div>
                {typicalPriceHtml}
              </div>

              {searchFeedBadgeObjects.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  {searchFeedBadgeObjects.map((badge: any) => {
                    const Icon = { ShieldCheck, Clock, FileText, Shield, CheckCircle, MapPin, Heart, Star }[badge.icon as string] as any;
                    return (
                      <div key={badge.id} className="flex items-center gap-1 py-0.5 overflow-hidden">
                        <Icon className="w-3 h-3 shrink-0 text-blue-600" />
                        <span className="text-[9px] leading-snug font-black text-blue-600 uppercase tracking-widest truncate">{badge.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Click Affordance & Compare Toggle */}
              <div className="mt-3 pt-3 border-t-2 border-black flex items-center justify-between">
                <button
                  type="button"
                  onClick={(e) => toggleCompareTrader(tp.uid, e)}
                  className={cn(
                    "px-1.5 py-0.5 text-[9.5px] font-bold rounded-md border flex items-center gap-0.5 transition-all cursor-pointer z-10 shrink-0",
                    selectedCompareIds.includes(tp.uid)
                      ? "bg-blue-600 text-white border-black shadow-xs"
                      : "bg-slate-100 text-slate-800 border-black hover:bg-slate-200"
                  )}
                >
                  {selectedCompareIds.includes(tp.uid) ? (
                    <>
                      <CheckSquare className="w-3 h-3 text-white shrink-0" /> Comparing
                    </>
                  ) : (
                    <>
                      <Square className="w-3 h-3 text-slate-500 shrink-0" /> Compare
                    </>
                  )}
                </button>

                <span className="text-xs font-bold text-blue-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  View Profile & Quotes <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>
            </motion.div>
            )}
            </AnimatePresence>
          </motion.div>
          );
        })}

        {/* Compact Infinite Scroll Sentinel & Status Indicator */}
        <div ref={loadMoreSentinelRef} className="col-span-full py-6 flex flex-col items-center justify-center text-center">
          {displayLimit < filteredTradespeople.length ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs font-bold text-slate-500">
                Showing {visibleTradespeople.length} of {filteredTradespeople.length} verified tradespeople
              </p>
              <button
                type="button"
                onClick={() => setDisplayLimit(prev => Math.min(prev + 10, filteredTradespeople.length))}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-blue-600 border border-black shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <ChevronDown className="w-4 h-4 text-amber-400 animate-bounce" />
                Show More Tradespeople (+10)
              </button>
            </div>
          ) : filteredTradespeople.length > 0 ? (
            <div className="px-4 py-2 bg-slate-100 rounded-full border border-slate-200 text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
              Showing all {filteredTradespeople.length} verified tradespeople
            </div>
          ) : null}
        </div>
      </div>
      )}

      {/* Spacer for bottom navigation */}
      <div className="h-24"></div>

      {/* Tier 2: Expanded Preview (Bottom Sheet) */}
      <AnimatePresence>
        {selectedTraderPreview && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTraderPreview(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
            />
            
            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(e, { offset, velocity }) => {
                if (offset.y > 100 || velocity.y > 500) {
                  setSelectedTraderPreview(null);
                }
              }}
              className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-white rounded-t-3xl shadow-[-10px_0_40px_rgba(0,0,0,0.1)] z-[101] flex flex-col overflow-hidden"
            >
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-3 shrink-0" />
              
              <button 
                onClick={() => setSelectedTraderPreview(null)}
                className="absolute top-4 right-4 w-9 h-9 bg-slate-100/80 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-500 transition-colors z-10 border-2 border-black"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex-1 overflow-y-auto px-6 pb-24 no-scrollbar">
                <div className="flex gap-4 mb-6 pt-2">
                  <div className="w-24 h-24 bg-slate-800 rounded-2xl shrink-0 overflow-hidden shadow-sm border-2 border-white/20">
                    {selectedTraderPreview.avatarUrl ? (
                      <img src={selectedTraderPreview.avatarUrl} alt={selectedTraderPreview.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl font-black text-white">
                        {selectedTraderPreview.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col justify-center overflow-hidden">
                    <h2 className="text-2xl font-black text-slate-900 mb-1 leading-tight line-clamp-2">{selectedTraderPreview.name}</h2>
                    <div className="flex flex-wrap items-center gap-1.5 gap-y-2 mb-2">
                       {selectedTraderPreview.verificationStatus === "verified" && (
                         <div className="flex items-center gap-1">
                           <ShieldCheck className="w-4 h-4 text-emerald-500" />
                           <span className="text-xs font-bold text-emerald-700">Verified ID</span>
                         </div>
                       )}
                       {selectedTraderPreview.verificationStatus === "verified" && <span className="text-slate-300 mx-1">•</span>}
                       <div className="flex items-center gap-1">
                         <MapPin className="w-3.5 h-3.5 text-slate-400" />
                         <span className="text-xs font-bold text-slate-600 truncate max-w-[100px]">{selectedTraderPreview.postcode?.split(' ')[0] || 'Local Area'}</span>
                       </div>
                    </div>
                  </div>
                </div>

                {/* Skills/Trades */}
                <div className="flex flex-wrap items-center gap-2 mb-6 max-h-[120px] overflow-y-auto no-scrollbar">
                  {(selectedTraderPreview.trades && selectedTraderPreview.trades.length > 0) ? (
                    selectedTraderPreview.trades.map((trade: string, idx: number) => (
                      <span key={`${trade}-${idx}`} className="text-xs leading-tight font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                        {trade}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm font-bold text-blue-600 truncate">Professional Tradesperson</p>
                  )}
                </div>

                {/* Trust Stats */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-slate-50 border-2 border-black rounded-2xl p-3 text-center">
                    <p className="text-lg font-black text-slate-900">{selectedTraderPreview.trustScore || 96}%</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Completion</p>
                  </div>
                  <div className="bg-slate-50 border-2 border-black rounded-2xl p-3 text-center">
                    <p className="text-lg font-black text-slate-900">{selectedTraderPreview.totalJobsDone || 12}</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Jobs Done</p>
                  </div>
                  <div className="bg-slate-50 border-2 border-black rounded-2xl p-3 text-center">
                    <p className="text-lg font-black text-slate-900">&lt; {selectedTraderPreview.avgReplyTime || 28}m</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Avg Reply</p>
                  </div>
                </div>

                <p className="text-sm text-slate-700 leading-relaxed font-medium mb-6 bg-slate-50 p-4 rounded-2xl italic border-2 border-black">
                  {selectedTraderPreview.bio ? `"${selectedTraderPreview.bio.substring(0, 140)}${selectedTraderPreview.bio.length > 140 ? '...' : ''}"` : '"Professional tradesman with years of experience. Fully qualified and insured for your peace of mind."'}
                </p>

                {/* Portfolio Preview Horizontal Scroll */}
                <div className="mb-6">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Briefcase className="w-3 h-3 text-slate-400" /> Recent Work
                  </h4>
                  <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
                    {/* Placeholder images for high-tier architectural feel */}
                    {[1, 2, 3, 4, 5, 6].map(idx => (
                      <div key={idx} className="w-28 h-28 shrink-0 rounded-2xl bg-slate-100 border-2 border-black overflow-hidden relative group">
                        <img src={`https://picsum.photos/seed/${selectedTraderPreview.uid}${idx}/300/300`} alt="Portfolio Work" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           <Search className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Reviews Preview */}
                <div className="mb-6">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Star className="w-3 h-3 text-slate-400" /> Top Reviews
                  </h4>
                  <div className="space-y-3">
                    <div className="bg-slate-50 border-2 border-black p-4 rounded-2xl">
                      <div className="flex items-center gap-1 mb-2">
                        {Array(5).fill(0).map((_, i) => <Star key={i} className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />)}
                      </div>
                      <p className="text-sm text-slate-700 font-medium italic mb-2">"Arrived on time, fixed the issue incredibly fast, and left the place spotless. Highly recommended!"</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mark S. — 2 weeks ago</p>
                    </div>
                     <div className="bg-slate-50 border-2 border-black p-4 rounded-2xl">
                      <div className="flex items-center gap-1 mb-2">
                        {Array(5).fill(0).map((_, i) => <Star key={i} className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />)}
                      </div>
                      <p className="text-sm text-slate-700 font-medium italic mb-2">"Great communication before arriving and completely transparent about pricing. Will use again."</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sarah L. — 1 month ago</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center mt-8 pb-4">
                   <Link 
                     to={`/profile/${selectedTraderPreview.uid}`}
                     state={isB2B && selectedAsset ? { linkedPropertyId: selectedAsset.id, linkedPropertyName: selectedAsset.name || selectedAsset.propertyName || selectedAsset.address?.line1, isB2B } : undefined}
                     className="bg-slate-100 text-slate-700 px-6 py-3 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors flex items-center gap-2 border-2 border-black"
                   >
                     View Full Profile <ChevronRight className="w-3 h-3" />
                   </Link>
                </div>
              </div>

              {/* Fixed Bottom Action Bar */}
              <div className="absolute bottom-0 left-0 right-0 bg-white border-t-2 border-black p-4 pb-8 flex items-center gap-4 justify-between shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
                <div className="hidden sm:block">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Typical Range</p>
                  <p className="text-lg font-black text-slate-900">£150 - £250</p>
                </div>
                <button 
                  onClick={() => navigate(`/profile/${selectedTraderPreview.uid}`, { state: { openQuote: true, isB2B, linkedPropertyId: isB2B && selectedAsset ? selectedAsset.id : undefined, linkedPropertyName: isB2B && selectedAsset ? (selectedAsset.name || selectedAsset.propertyName || selectedAsset.address?.line1) : undefined } })}
                  className="flex-1 bg-slate-900 text-white rounded-2xl py-4 px-6 text-sm font-black text-center shadow-lg shadow-slate-900/10 hover:-translate-y-0.5 transition-all w-full flex justify-center uppercase tracking-widest"
                >
                  Request Quote
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

        {filteredTradespeople.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">No tradespeople found</h3>
            <p className="text-slate-500 mb-6">Try adjusting your search or filters to find what you're looking for.</p>
            <button 
              onClick={async () => {
                const sampleTrades = [
                  { name: "Sarah Jenkins", trades: ["Electrical"], tags: ["Electrician", "Rewiring", "Smart Home", "Lighting"], postcode: "M1 3AP", rating: 4.9, totalReviews: 89, totalJobsDone: 112, completedJobsRevenue: 22400, responseRate: 97, trustScore: 98, badges: ["NICEIC", "Verified"], bio: "NICEIC-registered electrician specialising in rewires and smart home installations.", isTopTradesperson: true, verificationStatus: "verified" },
                  { name: "Andy Parker", trades: ["Heating", "Building & Construction"], tags: ["Builder", "Bricklayer", "Heating Engineer", "Boiler Repair"], postcode: "M4 1HQ", rating: 4.9, totalReviews: 210, totalJobsDone: 255, completedJobsRevenue: 76500, responseRate: 94, trustScore: 96, badges: ["Gas Safe", "Verified"], bio: "Premium heating and building solutions for homes across Greater Manchester.", isTopTradesperson: true, verificationStatus: "verified" },
                  { name: "Dave Collins", trades: ["Plumbing & Heating"], tags: ["Plumber", "Heating Engineer", "Leak Repair", "Bathroom Fitting"], postcode: "M3 4FH", rating: 4.8, totalReviews: 127, totalJobsDone: 143, completedJobsRevenue: 31460, responseRate: 92, trustScore: 94, badges: ["Gas Safe", "Verified"], bio: "Gas Safe registered plumber with 15 years experience.", isTopTradesperson: true, verificationStatus: "verified" },
                  { name: "Lisa Park", trades: ["Painting & Decorating"], tags: ["Painter", "Decorator", "Wallpapering", "Exterior Painting"], postcode: "M20 3LJ", rating: 4.7, totalReviews: 63, totalJobsDone: 78, completedJobsRevenue: 15600, responseRate: 95, trustScore: 82, badges: ["Verified"], bio: "Interior and exterior decorating. Fast, clean, and quality finish.", isEstablishedTradesperson: true, verificationStatus: "verified" },
                  { name: "Mike Walsh", trades: ["Plumbing & Heating"], tags: ["Heating Engineer", "Plumber", "Boiler Installation", "Radiator Repair"], postcode: "M2 5NA", rating: 4.6, totalReviews: 210, totalJobsDone: 240, completedJobsRevenue: 52800, responseRate: 90, trustScore: 88, badges: ["Gas Safe", "Verified"], bio: "Boiler installation specialist with 20+ years experience.", isTopTradesperson: true, verificationStatus: "verified" },
                  { name: "Tom Briggs", trades: ["Plumbing & Heating"], tags: ["Plumber", "Drainage", "Tap Repair"], postcode: "SK1 3PL", rating: 4.3, totalReviews: 45, totalJobsDone: 58, completedJobsRevenue: 8700, responseRate: 85, trustScore: 72, badges: ["Gas Safe"], bio: "Family-run plumbing business with 10 years in the trade.", isEstablishedTradesperson: true, verificationStatus: "unverified" }
                ];
                
                for (const tp of sampleTrades) {
                  const docId = `sample_${tp.name.replace(/\s+/g, '_').toLowerCase()}`;
                  await setDoc(doc(db, "users", docId), {
                    ...tp,
                    role: "tradesperson",
                    createdAt: new Date().toISOString()
                  });
                }
              }}
              className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 transition-colors"
            >
              Seed Sample Tradespeople
            </button>
          </div>
        )}
      </div>

      {/* Filter Modal */}
      <AnimatePresence>
        {isFilterModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFilterModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-lg bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-slate-900">Filter Results</h2>
                  <button 
                    onClick={() => {
                      setTempMinRating(null);
                      setTempVerifiedOnly(false);
                    }}
                    className="text-red-500 font-bold text-lg"
                  >
                    Reset
                  </button>
                </div>

                <div className="space-y-8">
                  <div>
                    <label className="block text-lg font-bold text-slate-900 mb-4">Minimum Rating</label>
                    <div className="flex gap-3">
                      {[null, 4, 4.5, 4.8].map(val => (
                        <button
                          key={val === null ? 'any' : val}
                          onClick={() => setTempMinRating(val)}
                          className={cn(
                            "flex-1 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-1.5 transition-all",
                            tempMinRating === val 
                              ? "bg-[#1e293b] text-white" 
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          )}
                        >
                          {val === null ? "Any" : `${val}+`}
                          {val !== null && <Star className="w-4 h-4 fill-orange-500 text-orange-500" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => setTempVerifiedOnly(!tempVerifiedOnly)}
                    className={cn(
                      "w-full p-5 rounded-2xl border-2 flex items-center justify-between transition-all",
                      tempVerifiedOnly 
                        ? "border-black bg-blue-50" 
                        : "border-black bg-white"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center",
                        tempVerifiedOnly ? "bg-blue-600" : "bg-slate-200"
                      )}>
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-lg font-bold text-slate-900">Verified tradespeople only</span>
                    </div>
                    <div className={cn(
                      "w-12 h-6 rounded-full relative transition-colors",
                      tempVerifiedOnly ? "bg-blue-600" : "bg-slate-200"
                    )}>
                      <div className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                        tempVerifiedOnly ? "left-7" : "left-1"
                      )} />
                    </div>
                  </button>

                  <div className={cn(
                    "p-5 rounded-3xl border-2 border-black transition-all space-y-4",
                    tempPostcodeFilterEnabled ? "bg-blue-50/30" : "bg-white"
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center",
                          tempPostcodeFilterEnabled ? "bg-blue-600" : "bg-slate-200"
                        )}>
                          <MapPin className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-lg font-bold text-slate-900">Filter by Postcode</span>
                      </div>
                      <button
                        onClick={() => setTempPostcodeFilterEnabled(!tempPostcodeFilterEnabled)}
                        className={cn(
                          "w-12 h-6 rounded-full relative transition-colors",
                          tempPostcodeFilterEnabled ? "bg-blue-600" : "bg-slate-200"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                          tempPostcodeFilterEnabled ? "left-7" : "left-1"
                        )} />
                      </button>
                    </div>
                    
                    {tempPostcodeFilterEnabled && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="space-y-2"
                      >
                        <p className="text-xs text-slate-500 font-medium">Enter first part of postcodes (e.g. HD, HD1, M), comma separated:</p>
                        <input
                          type="text"
                          placeholder="e.g. HD, HD1, M"
                          value={tempPostcodeFilterValue}
                          onChange={(e) => setTempPostcodeFilterValue(e.target.value.toUpperCase())}
                          className="w-full bg-white border-2 border-black px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-900"
                        />
                      </motion.div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setMinRating(tempMinRating);
                      setVerifiedOnly(tempVerifiedOnly);
                      setPostcodeFilterEnabled(tempPostcodeFilterEnabled);
                      setPostcodeFilterValue(tempPostcodeFilterValue);
                      localStorage.setItem("postcodeFilterEnabled", String(tempPostcodeFilterEnabled));
                      localStorage.setItem("postcodeFilterValue", tempPostcodeFilterValue);
                      setIsFilterModalOpen(false);
                    }}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white py-5 rounded-2xl text-xl font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-95"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
              <div className="h-6 bg-white sm:hidden" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Option 2: Floating Bottom Comparison Bar */}
      <AnimatePresence>
        {selectedCompareIds.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-[120] bg-slate-900 text-white p-3 rounded-2xl border-2 border-white/20 shadow-2xl flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex -space-x-2 shrink-0">
                {compareTradersList.map((tp, idx) => {
                  const theme = COMPARE_THEMES[idx % COMPARE_THEMES.length];
                  return (
                    <div key={tp.uid} className={cn("relative w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800 overflow-hidden text-[10px] font-black flex items-center justify-center text-white shrink-0", theme.avatarRing)}>
                      {tp.avatarUrl ? (
                        <img src={tp.avatarUrl} alt={tp.name} className="w-full h-full object-cover" />
                      ) : (
                        tp.name.charAt(0)
                      )}
                      <span className={cn("absolute bottom-0 right-0 w-3.5 h-3.5 text-[8px] font-black rounded-full flex items-center justify-center border border-white shadow-xs", theme.badgeBg, theme.badgeText)}>
                        {idx + 1}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-white truncate">{selectedCompareIds.length} Trader{selectedCompareIds.length > 1 ? 's' : ''} Selected</p>
                <p className="text-[10px] text-slate-400">Color-coded side-by-side comparison</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedCompareIds([])}
                className="px-2.5 py-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setIsCompareModalOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" /> Compare Now
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Option 2: Side-by-Side Comparison Sheet / Modal */}
      <AnimatePresence>
        {isCompareModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white border-2 border-black rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 sm:p-6 bg-slate-900 text-white flex items-center justify-between border-b-2 border-black shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-600 rounded-xl">
                    <Scale className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold">Side-by-Side Comparison</h2>
                    <p className="text-xs text-slate-400">Comparing {compareTradersList.length} tradespeople with matching color sequence</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCompareModalOpen(false)}
                  className="p-2 hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5 text-slate-400 hover:text-white" />
                </button>
              </div>

              {/* Matrix Content */}
              <div className="p-2.5 sm:p-6 overflow-y-auto flex-1 space-y-3.5 sm:space-y-5">
                {/* Profiles Column Grid Header */}
                <div className="w-full">
                  <div className={cn(
                    "grid gap-1.5 sm:gap-3 w-full",
                    compareTradersList.length === 2 ? "grid-cols-2" : compareTradersList.length === 4 ? "grid-cols-4" : "grid-cols-3"
                  )}>
                    {compareTradersList.map((tp, idx) => {
                      const theme = COMPARE_THEMES[idx % COMPARE_THEMES.length];
                      return (
                        <div 
                          key={tp.uid} 
                          className={cn("p-2 sm:p-3 rounded-2xl flex flex-col items-center text-center relative shadow-xs transition-all min-w-0 pt-2.5 sm:pt-3", theme.cardBg)}
                        >
                          {/* Top-Right Remove Cross Button (Not overlapping avatar) */}
                          <button
                            type="button"
                            onClick={(e) => toggleCompareTrader(tp.uid, e)}
                            className="absolute top-1.5 right-1.5 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors cursor-pointer shadow-xs z-10"
                            title="Remove from comparison"
                          >
                            <X className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          </button>

                          {/* Position Number Pill */}
                          <div className="flex items-center gap-1 mb-1.5">
                            <span className={cn("px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider shadow-xs whitespace-nowrap", theme.badgeBg, theme.badgeText)}>
                              Trader #{idx + 1}
                            </span>
                          </div>

                          {/* Profile Avatar (Unobstructed) */}
                          <div className="w-11 h-11 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-slate-800 overflow-hidden border-2 border-black mb-1.5 shrink-0 shadow-sm">
                            {tp.avatarUrl ? (
                              <img src={tp.avatarUrl} alt={tp.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-base sm:text-2xl font-bold text-white flex items-center justify-center h-full">{tp.name.charAt(0)}</span>
                            )}
                          </div>
                          <h3 className="font-extrabold text-slate-900 text-[11px] sm:text-base leading-tight truncate w-full px-0.5" title={tp.name}>{tp.name}</h3>
                          <p className="text-[9.5px] sm:text-[11px] text-slate-600 font-bold truncate w-full px-0.5">{tp.trades?.[0] || 'Professional'}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Metric Section: Rating & Reviews */}
                <div className="bg-slate-50 p-2.5 sm:p-4 rounded-2xl border border-black space-y-2">
                  <h4 className="text-[11px] sm:text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" /> Star Rating & Reviews
                  </h4>
                  <div className="w-full">
                    <div className={cn(
                      "grid gap-1.5 sm:gap-2.5 text-center w-full",
                      compareTradersList.length === 2 ? "grid-cols-2" : compareTradersList.length === 4 ? "grid-cols-4" : "grid-cols-3"
                    )}>
                      {compareTradersList.map((tp, idx) => {
                        const theme = COMPARE_THEMES[idx % COMPARE_THEMES.length];
                        return (
                          <div key={tp.uid} className={cn("p-1.5 sm:p-2.5 rounded-xl flex flex-col items-center justify-center space-y-0.5 min-w-0 transition-all", theme.cellBg)}>
                            <div className="flex items-center gap-1 mb-0.5 max-w-full">
                              <span className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full text-[8.5px] sm:text-[9px] font-black flex items-center justify-center shrink-0 shadow-xs", theme.badgeBg, theme.badgeText)}>
                                {idx + 1}
                              </span>
                              <span className="text-[9.5px] sm:text-[10px] font-extrabold text-slate-800 truncate">{tp.name.split(' ')[0]}</span>
                            </div>
                            <p className="text-xs sm:text-base font-black text-slate-900 flex items-center justify-center gap-0.5 sm:gap-1">
                              {tp.rating?.toFixed(1) || '5.0'}
                              <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                            </p>
                            <p className="text-[9px] sm:text-[10px] text-slate-600 font-bold truncate">{tp.totalReviews || 0} reviews</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Metric Section: Pricing & Rates */}
                <div className="bg-slate-50 p-2.5 sm:p-4 rounded-2xl border border-black space-y-2">
                  <h4 className="text-[11px] sm:text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-blue-600 shrink-0" /> Rates & Call-Out Fees
                  </h4>
                  <div className="w-full">
                    <div className={cn(
                      "grid gap-1.5 sm:gap-2.5 text-center w-full",
                      compareTradersList.length === 2 ? "grid-cols-2" : compareTradersList.length === 4 ? "grid-cols-4" : "grid-cols-3"
                    )}>
                      {compareTradersList.map((tp, idx) => {
                        const theme = COMPARE_THEMES[idx % COMPARE_THEMES.length];
                        return (
                          <div key={tp.uid} className={cn("p-1.5 sm:p-2.5 rounded-xl flex flex-col items-center justify-center space-y-0.5 min-w-0 transition-all", theme.cellBg)}>
                            <div className="flex items-center gap-1 mb-0.5 max-w-full">
                              <span className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full text-[8.5px] sm:text-[9px] font-black flex items-center justify-center shrink-0 shadow-xs", theme.badgeBg, theme.badgeText)}>
                                {idx + 1}
                              </span>
                              <span className="text-[9.5px] sm:text-[10px] font-extrabold text-slate-800 truncate">{tp.name.split(' ')[0]}</span>
                            </div>
                            <p className="text-[10px] sm:text-xs font-extrabold text-slate-900 leading-tight">
                              Call-Out: <span className="text-blue-700 font-black">£{tp.miniProfileSettings?.callOutFee || 0}</span>
                            </p>
                            <p className="text-[9.5px] sm:text-[10.5px] text-slate-700 font-bold leading-tight">
                              Hourly: <span className="font-extrabold text-slate-900">£{tp.miniProfileSettings?.hourlyRate || 0}/hr</span>
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Metric Section: Emergency & Reply Time */}
                <div className="bg-slate-50 p-2.5 sm:p-4 rounded-2xl border border-black space-y-2">
                  <h4 className="text-[11px] sm:text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Emergency & Availability
                  </h4>
                  <div className="w-full">
                    <div className={cn(
                      "grid gap-1.5 sm:gap-2.5 text-center w-full",
                      compareTradersList.length === 2 ? "grid-cols-2" : compareTradersList.length === 4 ? "grid-cols-4" : "grid-cols-3"
                    )}>
                      {compareTradersList.map((tp, idx) => {
                        const theme = COMPARE_THEMES[idx % COMPARE_THEMES.length];
                        return (
                          <div key={tp.uid} className={cn("p-1.5 sm:p-2.5 rounded-xl flex flex-col items-center justify-center space-y-0.5 min-w-0 transition-all", theme.cellBg)}>
                            <div className="flex items-center gap-1 mb-0.5 max-w-full">
                              <span className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full text-[8.5px] sm:text-[9px] font-black flex items-center justify-center shrink-0 shadow-xs", theme.badgeBg, theme.badgeText)}>
                                {idx + 1}
                              </span>
                              <span className="text-[9.5px] sm:text-[10px] font-extrabold text-slate-800 truncate">{tp.name.split(' ')[0]}</span>
                            </div>
                            {tp.isAvailableForEmergency ? (
                              <span className="inline-block px-1.5 py-0.5 bg-red-100 text-red-800 font-extrabold text-[8px] sm:text-[9px] rounded-full uppercase tracking-wider border border-red-300 truncate max-w-full">
                                24/7 Emergency
                              </span>
                            ) : (
                              <span className="text-[10px] sm:text-[11px] text-slate-700 font-bold truncate">Standard</span>
                            )}
                            <p className="text-[8.5px] sm:text-[10px] text-slate-500 font-medium truncate">&lt; 1 hr avg reply</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Metric Section: Verification & Badges */}
                <div className="bg-slate-50 p-2.5 sm:p-4 rounded-2xl border border-black space-y-2">
                  <h4 className="text-[11px] sm:text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" /> Verification & Badges
                  </h4>
                  <div className="w-full">
                    <div className={cn(
                      "grid gap-1.5 sm:gap-2.5 text-center w-full",
                      compareTradersList.length === 2 ? "grid-cols-2" : compareTradersList.length === 4 ? "grid-cols-4" : "grid-cols-3"
                    )}>
                      {compareTradersList.map((tp, idx) => {
                        const theme = COMPARE_THEMES[idx % COMPARE_THEMES.length];
                        return (
                          <div key={tp.uid} className={cn("p-1.5 sm:p-2.5 rounded-xl flex flex-col items-center justify-center space-y-0.5 min-w-0 transition-all", theme.cellBg)}>
                            <div className="flex items-center gap-1 mb-0.5 max-w-full">
                              <span className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full text-[8.5px] sm:text-[9px] font-black flex items-center justify-center shrink-0 shadow-xs", theme.badgeBg, theme.badgeText)}>
                                {idx + 1}
                              </span>
                              <span className="text-[9.5px] sm:text-[10px] font-extrabold text-slate-800 truncate">{tp.name.split(' ')[0]}</span>
                            </div>
                            {tp.verificationStatus === "verified" ? (
                              <span className="inline-flex items-center gap-0.5 text-[9.5px] sm:text-[11px] font-extrabold text-blue-700 truncate">
                                <ShieldCheck className="w-3 h-3 shrink-0" /> Verified
                              </span>
                            ) : (
                              <span className="text-[9.5px] sm:text-[11px] text-slate-500 font-medium truncate">Basic</span>
                            )}
                            <p className="text-[8.5px] sm:text-[10px] font-bold text-slate-700 truncate">{tp.totalJobsDone || 0} jobs done</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Direct Actions */}
                <div className="w-full pt-1">
                  <div className={cn(
                    "grid gap-1.5 sm:gap-2.5 w-full",
                    compareTradersList.length === 2 ? "grid-cols-2" : compareTradersList.length === 4 ? "grid-cols-4" : "grid-cols-3"
                  )}>
                    {compareTradersList.map((tp, idx) => {
                      const theme = COMPARE_THEMES[idx % COMPARE_THEMES.length];
                      return (
                        <button
                          key={tp.uid}
                          type="button"
                          onClick={() => {
                            setIsCompareModalOpen(false);
                            setSelectedTraderPreview(tp);
                          }}
                          className={cn(
                            "w-full py-2 sm:py-2.5 px-1 sm:px-2 font-extrabold rounded-xl text-[10px] sm:text-xs shadow-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1 truncate",
                            theme.btnBg
                          )}
                        >
                          <span className="truncate">Quote #{idx + 1}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating [ List View | Map View ] Toggle Button */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
          touchAction: "none"
        }}
        className="fixed bottom-32 right-4 z-[110] bg-slate-950/95 backdrop-blur-md text-white py-1.5 px-1 rounded-2xl border border-white/20 shadow-2xl flex flex-col items-center gap-1.5 select-none cursor-grab active:cursor-grabbing w-11"
      >
        <div className="py-0.5 text-slate-500 hover:text-slate-300 transition-colors shrink-0">
          <GripHorizontal className="w-3.5 h-3.5" />
        </div>

        <button
          type="button"
          onClick={() => setViewMode("list")}
          className={cn(
            "w-9 h-11 rounded-xl text-[9px] font-black uppercase tracking-wider flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer shrink-0",
            viewMode === "list"
              ? "bg-blue-600 text-white shadow-sm font-black"
              : "text-slate-300 hover:text-white hover:bg-slate-800/80"
          )}
        >
          <List className="w-3.5 h-3.5" />
          <span>List</span>
        </button>

        <button
          type="button"
          onClick={() => setViewMode("map")}
          className={cn(
            "w-9 h-11 rounded-xl text-[9px] font-black uppercase tracking-wider flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer shrink-0",
            viewMode === "map"
              ? "bg-blue-600 text-white shadow-sm font-black"
              : "text-slate-300 hover:text-white hover:bg-slate-800/80"
          )}
        >
          <Map className="w-3.5 h-3.5" />
          <span>Map</span>
        </button>
      </div>
    </div>
  );
}

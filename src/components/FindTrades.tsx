import React, { useState, useEffect, useMemo } from "react";
import { Search, Filter, Star, MapPin, CheckCircle, ChevronRight, X, SlidersHorizontal, Award, ShieldCheck, Clock, Briefcase, Users, FileText, Shield, Heart, Zap, MessageSquare, AlertTriangle } from "lucide-react";
import { db, collection, query, where, onSnapshot, setDoc, doc, handleFirestoreError, OperationType } from "@/src/firebase";
import { cn } from "@/src/lib/utils";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { useCategories } from "../lib/CategoryProvider";
import { motion, AnimatePresence } from "motion/react";
import { TRADE_CATEGORIES, PROFESSIONAL_BADGES } from "@/src/constants";
import { getTraderBadges, BadgeOverlay } from "@/src/lib/badges";
import { SEO } from "./SEO";

const iconMap: Record<string, any> = {
  Search, Filter, Star, MapPin, CheckCircle, ChevronRight, X, SlidersHorizontal, Award, ShieldCheck, Clock, Briefcase
};

interface Tradesperson {
  uid: string;
  name: string;
  avatarUrl?: string;
  bio?: string;
  rating?: number;
  totalReviews?: number;
  totalJobsDone?: number;
  responseRate?: number;
  trustScore?: number;
  trades?: string[];
  services?: string[];
  tags?: string[];
  badges?: string[];
  searchFeedBadges?: string[];
  postcode?: string;
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

export default function FindTrades() {
  const navigate = useNavigate();
  const { categories } = useCategories();
  const { profile } = useAuth();
  const [tradespeople, setTradespeople] = useState<Tradesperson[]>([]);
  const [platformConfig, setPlatformConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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
  const [showNoResultsToast, setShowNoResultsToast] = useState(false);
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>([]);
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false);
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});
  const [lastResetCheck, setLastResetCheck] = useState(Date.now());
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const resultsRef = React.useRef<HTMLDivElement>(null);

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

  // Handle category persistence and 30s reset logic
  useEffect(() => {
    const savedCategory = localStorage.getItem("lastSelectedCategory");
    const savedTimestamp = localStorage.getItem("lastSelectedCategoryTime");
    
    if (savedCategory && savedTimestamp) {
      const timeDiff = Date.now() - parseInt(savedTimestamp);
      if (timeDiff < 30000) {
        setSelectedCategory(savedCategory);
      } else {
        setSelectedCategory("All");
        localStorage.removeItem("lastSelectedCategory");
        localStorage.removeItem("lastSelectedCategoryTime");
      }
    }
  }, []);

  // Update timestamp whenever category changes or user interacts
  useEffect(() => {
    if (selectedCategory !== "All") {
      localStorage.setItem("lastSelectedCategory", selectedCategory);
      localStorage.setItem("lastSelectedCategoryTime", Date.now().toString());
    } else {
      localStorage.removeItem("lastSelectedCategory");
      localStorage.removeItem("lastSelectedCategoryTime");
    }
  }, [selectedCategory]);

  // Update timestamp on unmount to track when user leaves the tab
  useEffect(() => {
    return () => {
      if (selectedCategory !== "All") {
        localStorage.setItem("lastSelectedCategoryTime", Date.now().toString());
      }
    };
  }, [selectedCategory]);

  useEffect(() => {
    const stored = localStorage.getItem("recentlyViewedTraders");
    if (stored) {
      try {
        setRecentlyViewedIds(JSON.parse(stored));
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

    const q = query(collection(db, "users"), where("role", "==", "tradesperson"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Tradesperson));
      setTradespeople(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching tradespeople:", error);
      handleFirestoreError(error, OperationType.LIST, "users");
      setLoading(false);
    });
    return () => {
      unsubscribe();
      unsubConfig();
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

        return matchesSearch && matchesCategory && matchesRating && matchesVerified && matchesPostcode;
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
  }, [tradespeople, searchQuery, selectedCategory, sortBy, minRating, verifiedOnly, postcodeFilterEnabled, postcodeFilterValue, profile]);

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

  const topRatedNearYou = useMemo(() => {
    return [...tradespeople]
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 5);
  }, [tradespeople]);

  const hotSearches = [
    { label: "Emergency Plumber", query: "Plumber" },
    { label: "Boiler Service", query: "Boiler" },
    { label: "Kitchen Fitting", query: "Kitchen" },
    { label: "Smart Home", query: "Smart" },
    { label: "Rewiring", query: "Rewiring" },
    { label: "Leak Repair", query: "Leak" }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto -mt-6">
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
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Name, trade, postcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white text-slate-900 pl-12 pr-12 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {categoryNames.map(cat => {
            const categoryData = categories.find(c => c.name === cat);
            const Icon = categoryData ? iconMap[categoryData.icon] : null;
            
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-2",
                  selectedCategory === cat 
                    ? "bg-orange-500 text-white shadow-md shadow-orange-500/20" 
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                )}
              >
                {categoryData && (
                  Icon ? <Icon className="w-4 h-4" /> : <span className="text-base">{categoryData.icon}</span>
                )}
                {cat}
              </button>
            );
          })}
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
                "px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all",
                sortBy === opt 
                  ? "bg-[#1e293b] text-white border-[#1e293b]" 
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
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
                    onClick={() => {
                      setSelectedCategory(cat.name);
                      setSearchQuery("");
                    }}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 bg-white rounded-2xl border transition-all group shadow-sm hover:shadow-md relative",
                      selectedCategory === cat.name 
                        ? "border-orange-500 ring-1 ring-orange-500" 
                        : "border-slate-100 hover:border-blue-100"
                    )}
                  >
                    {categoryCounts[cat.name] > 0 && (
                      <span className="absolute top-1.5 right-1.5 bg-blue-50 text-blue-600 text-[8px] font-black px-1.5 py-0.5 rounded-full border border-blue-100 flex items-center gap-0.5">
                        <Users className="w-2 h-2" />
                        {categoryCounts[cat.name]}
                      </span>
                    )}
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      {Icon ? <Icon className="w-5 h-5" /> : <span className="text-xl">{cat.icon}</span>}
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 text-center line-clamp-1">{cat.name}</span>
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
                    className="flex-shrink-0 w-24 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow text-center"
                  >
                    <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-white font-bold text-lg mx-auto mb-2">
                      {tp.avatarUrl ? (
                        <img src={tp.avatarUrl} alt={tp.name} className="w-full h-full object-cover rounded-xl" referrerPolicy="no-referrer" />
                      ) : (
                        tp.name.charAt(0)
                      )}
                    </div>
                    <h3 className="text-[10px] font-bold text-slate-900 truncate">{tp.name.split(' ')[0]}</h3>
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
                  onClick={() => setSearchQuery(item.query)}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center gap-2"
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
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
              {topRatedNearYou.map(tp => (
                <Link 
                  key={tp.uid} 
                  to={`/profile/${tp.uid}`}
                  className="flex-shrink-0 w-28 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow text-center"
                >
                  <div className="relative mb-2 mx-auto">
                    <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center text-white font-bold text-xl mx-auto">
                      {tp.avatarUrl ? (
                        <img src={tp.avatarUrl} alt={tp.name} className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
                      ) : (
                        tp.name.charAt(0)
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center border-2 border-white">
                      <SlidersHorizontal className="w-3 h-3 text-white" />
                    </div>
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 truncate mb-1">{tp.name.split(' ')[0]}...</h3>
                  <p className="text-[10px] text-slate-500 truncate mb-1">{tp.trades?.[0] || 'Tradesperson'}</p>
                  <div className="flex items-center justify-center gap-1">
                    <Star className="w-3 h-3 text-orange-500 fill-orange-500" />
                    <span className="text-[10px] font-bold text-slate-900">{tp.rating || 'N/A'}</span>
                  </div>
                </Link>
              ))}
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
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <AnimatePresence>
        {showNoResultsToast && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[110] bg-orange-500 text-white px-6 py-3 rounded-2xl shadow-2xl border border-orange-400 flex items-center gap-3 whitespace-nowrap"
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
              className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[110] bg-blue-600 text-white px-6 py-3 rounded-2xl shadow-2xl border border-blue-500 flex items-center gap-3 whitespace-nowrap"
            >
              <CheckCircle className="w-5 h-5 text-white" />
              <p className="text-sm font-bold">{successMessage}</p>
              <button onClick={() => setShowSuccessToast(false)} className="ml-2 p-1 hover:bg-blue-700 rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {filteredTradespeople.map(tp => {
          // Get the actual badge objects for the selected search feed badges
          const searchFeedBadgeObjects = (tp.searchFeedBadges || [])
            .map(id => PROFESSIONAL_BADGES.find(b => b.id === id))
            .filter(Boolean)
            .slice(0, 4); // Enforce max 4

          return (
          <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            key={tp.uid}
            className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col relative"
          >
            {/* Search Feed Badges Strip */}
            {searchFeedBadgeObjects.length > 0 && (
              <div className="bg-indigo-100 border-b border-indigo-200 px-3 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {searchFeedBadgeObjects.map((badge: any) => {
                  const Icon = { ShieldCheck, Clock, FileText, Shield, CheckCircle, MapPin, Heart, Star }[badge.icon as string] as any;
                  return (
                    <div key={badge.id} className="flex items-center gap-1 shrink-0">
                      <Icon className="w-2.5 h-2.5 text-indigo-700" />
                      <span className="text-[8px] font-bold text-indigo-900 uppercase tracking-wider">{badge.name}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="p-4 flex-1">
              <div className="flex gap-3 mb-3">
                <div className="w-14 h-14 bg-slate-800 rounded-xl flex items-center justify-center text-white font-bold text-xl relative shrink-0">
                  {tp.avatarUrl ? (
                    <img src={tp.avatarUrl} alt={tp.name} className="w-full h-full object-cover rounded-xl" referrerPolicy="no-referrer" />
                  ) : (
                    tp.name.charAt(0)
                  )}
                  <BadgeOverlay 
                    badges={getTraderBadges(tp)} 
                    className="absolute -bottom-1.5 -left-1.5 -right-1.5 justify-center z-10 scale-75" 
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col gap-1 mb-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className="font-bold text-slate-900 text-sm truncate">{tp.name}</h3>
                        {tp.memberId && (
                          <span className="text-[9px] font-black tracking-widest text-[#1e3a5f] bg-[#1e3a5f]/5 px-1.5 py-0.5 rounded border border-[#1e3a5f]/10 ml-auto">
                            {tp.memberId}
                          </span>
                        )}
                      </div>
                      {tp.isAcceptingRequests === false && !tp.isAvailableForEmergency && (
                        <span className="bg-red-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider border border-red-700 shadow-sm shrink-0">
                          Unavailable
                        </span>
                      )}
                    </div>
                    {tp.isAvailableForEmergency && (
                      <span className="bg-red-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tighter text-center flex flex-col leading-none shrink-0 w-fit">
                        <span>Accepting</span>
                        <span>Emergency</span>
                        <span>Jobs</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 text-[10px] font-medium">
                    <div className="flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5" />
                      <span>{tp.postcode?.split(' ')[0] || 'UK'}</span>
                    </div>
                    <span className="text-slate-300">•</span>
                    <div className="flex items-center gap-0.5">
                      <Star className="w-2.5 h-2.5 text-orange-500 fill-orange-500" />
                      <span className="font-bold text-slate-900">{tp.rating || '5.0'}</span>
                    </div>
                    <span className="text-slate-300">•</span>
                    <div className="flex items-center gap-1 text-emerald-600 font-bold">
                      <Users className="w-3 h-3" />
                      <span>{tp.jobsCompleted || 0}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Compact Stats */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-slate-100/50 rounded-xl p-2 text-center">
                  <p className="text-xs font-bold text-slate-900">{tp.totalJobsDone || 0}</p>
                  <p className="text-[8px] text-slate-700 font-bold uppercase tracking-tighter">Jobs</p>
                </div>
                <div className="bg-slate-100/50 rounded-xl p-2 text-center">
                  <p className="text-xs font-bold text-slate-900">{tp.responseRate || 100}%</p>
                  <p className="text-[8px] text-slate-700 font-bold uppercase tracking-tighter">Resp</p>
                </div>
                <div className="bg-slate-100/50 rounded-xl p-2 text-center">
                  <p className="text-xs font-bold text-slate-900">{tp.trustScore || 95}</p>
                  <p className="text-[8px] text-slate-700 font-bold uppercase tracking-tighter">Trust</p>
                </div>
              </div>

              <p className="text-slate-800 text-[11px] font-medium line-clamp-2 mb-3 leading-relaxed">
                {tp.bio || "Professional Tradesperson providing quality services."}
              </p>

              <div className="flex flex-wrap gap-1 mb-3">
                {tp.trades?.slice(0, 2).map(trade => (
                  <span key={trade} className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-lg text-[9px] font-bold border border-slate-200">
                    {trade}
                  </span>
                ))}
              </div>
            </div>

            <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-50 flex flex-col">
              <AnimatePresence>
                {expandedServices[tp.uid] && tp.services && tp.services.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                  >
                    <div className="pb-3 mb-3 border-b border-slate-200/50">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Products & Services</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {tp.services.map(service => (
                          <span key={service} className="px-2 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg text-[9px] font-bold shadow-sm">
                            {service}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between">
                <Link 
                  to={`/profile/${tp.uid}`}
                  className="text-blue-600 font-bold text-[10px] hover:underline shrink-0"
                >
                  View Profile
                </Link>

                {tp.services && tp.services.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedServices(prev => {
                        const isOpen = prev[tp.uid];
                        return isOpen ? {} : { [tp.uid]: true };
                      });
                    }}
                    onTouchStart={(e) => e.stopPropagation()}
                    className="flex flex-col items-center justify-center group"
                  >
                    <span className="text-[10px] font-bold text-orange-500 mb-0.5">My Services</span>
                    <div className={cn(
                      "h-1.5 w-12 rounded-full transition-colors",
                      expandedServices[tp.uid] ? "bg-orange-500" : "bg-orange-500/40 group-hover:bg-orange-500/60"
                    )} />
                  </button>
                )}

                <div className="flex gap-2 shrink-0">
                  <button 
                    onClick={() => navigate(`/profile/${tp.uid}`, { state: { openChat: true } })}
                    disabled={tp.isAcceptingRequests === false}
                    className={cn(
                      "p-1.5 transition-colors",
                      tp.isAcceptingRequests === false 
                        ? "text-slate-200 cursor-not-allowed" 
                        : "text-slate-400 hover:text-orange-500"
                    )}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => navigate(`/profile/${tp.uid}`, { state: { openQuote: true } })}
                    disabled={tp.isAcceptingRequests === false}
                    className={cn(
                      "font-bold text-[10px] px-3 py-1.5 rounded-lg transition-all",
                      tp.isAcceptingRequests === false 
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                        : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                    )}
                  >
                    Quote
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
          );
        })}
        </div>

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
                  { name: "Sarah Jenkins", trades: ["Electrical"], tags: ["Electrician", "Rewiring", "Smart Home", "Lighting"], postcode: "M1 3AP", rating: 4.9, totalReviews: 89, totalJobsDone: 112, responseRate: 97, trustScore: 98, badges: ["NICEIC", "Verified"], bio: "NICEIC-registered electrician specialising in rewires and smart home installations.", isTopTradesperson: true, verificationStatus: "verified" },
                  { name: "Andy Parker", trades: ["Heating", "Building & Construction"], tags: ["Builder", "Bricklayer", "Heating Engineer", "Boiler Repair"], postcode: "M4 1HQ", rating: 4.9, totalReviews: 210, totalJobsDone: 255, responseRate: 94, trustScore: 96, badges: ["Gas Safe", "Verified"], bio: "Premium heating and building solutions for homes across Greater Manchester.", isTopTradesperson: true, verificationStatus: "verified" },
                  { name: "Dave Collins", trades: ["Plumbing & Heating"], tags: ["Plumber", "Heating Engineer", "Leak Repair", "Bathroom Fitting"], postcode: "M3 4FH", rating: 4.8, totalReviews: 127, totalJobsDone: 143, responseRate: 92, trustScore: 94, badges: ["Gas Safe", "Verified"], bio: "Gas Safe registered plumber with 15 years experience.", isTopTradesperson: true, verificationStatus: "verified" },
                  { name: "Lisa Park", trades: ["Painting & Decorating"], tags: ["Painter", "Decorator", "Wallpapering", "Exterior Painting"], postcode: "M20 3LJ", rating: 4.7, totalReviews: 63, totalJobsDone: 78, responseRate: 95, trustScore: 82, badges: ["Verified"], bio: "Interior and exterior decorating. Fast, clean, and quality finish.", isEstablishedTradesperson: true, verificationStatus: "verified" },
                  { name: "Mike Walsh", trades: ["Plumbing & Heating"], tags: ["Heating Engineer", "Plumber", "Boiler Installation", "Radiator Repair"], postcode: "M2 5NA", rating: 4.6, totalReviews: 210, totalJobsDone: 240, responseRate: 90, trustScore: 88, badges: ["Gas Safe", "Verified"], bio: "Boiler installation specialist with 20+ years experience.", isTopTradesperson: true, verificationStatus: "verified" },
                  { name: "Tom Briggs", trades: ["Plumbing & Heating"], tags: ["Plumber", "Drainage", "Tap Repair"], postcode: "SK1 3PL", rating: 4.3, totalReviews: 45, totalJobsDone: 58, responseRate: 85, trustScore: 72, badges: ["Gas Safe"], bio: "Family-run plumbing business with 10 years in the trade.", isEstablishedTradesperson: true, verificationStatus: "unverified" }
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
                        ? "border-blue-600 bg-blue-50" 
                        : "border-slate-100 bg-white"
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
                    "p-5 rounded-3xl border-2 transition-all space-y-4",
                    tempPostcodeFilterEnabled ? "border-blue-600 bg-blue-50/30" : "border-slate-100 bg-white"
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
                          className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-900"
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
    </div>
  );
}

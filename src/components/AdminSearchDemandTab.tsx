import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, Sparkles, Plus, Trash2, CheckCircle2, 
  AlertCircle, RefreshCw, Zap, Tag, ShieldCheck, 
  Layers, ExternalLink, ArrowRight, TrendingUp, Filter 
} from "lucide-react";
import { 
  fetchUnmatchedSearches, 
  fetchAllDynamicSynonyms, 
  saveDynamicSynonym, 
  deleteDynamicSynonym, 
  classifySearchTermWithAi, 
  approveTelemetryAsSynonym, 
  UnmatchedSearchItem, 
  StoredDynamicSynonym 
} from "../services/searchOptimizationService";
import { TRADE_CATEGORIES } from "@/src/constants";
import { SynonymMeta } from "../lib/fuzzyMatch";
import { cn } from "@/src/lib/utils";

export default function AdminSearchDemandTab() {
  const [telemetryList, setTelemetryList] = useState<UnmatchedSearchItem[]>([]);
  const [synonymsList, setSynonymsList] = useState<StoredDynamicSynonym[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [classifyingId, setClassifyingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"telemetry" | "synonyms">("telemetry");

  // AI Classification Preview Modal / State
  const [aiProposal, setAiProposal] = useState<{
    telemetryId: string;
    term: string;
    categoryName: string;
    tradeTitle: string;
    keywords: string[];
    confidence: number;
    reasoning: string;
  } | null>(null);

  // Manual Add Synonym Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTerm, setNewTerm] = useState("");
  const [newCategory, setNewCategory] = useState(TRADE_CATEGORIES[0]?.name || "Plumbing");
  const [newTradeTitle, setNewTradeTitle] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [telemetry, synonyms] = await Promise.all([
        fetchUnmatchedSearches(50),
        fetchAllDynamicSynonyms(),
      ]);
      setTelemetryList(telemetry);
      setSynonymsList(synonyms);
    } catch (err) {
      console.error("Failed to load search telemetry data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAiClassify = async (item: UnmatchedSearchItem) => {
    setClassifyingId(item.id);
    try {
      const result = await classifySearchTermWithAi(item.query);
      setAiProposal({
        telemetryId: item.id,
        term: item.query,
        categoryName: result.categoryName || TRADE_CATEGORIES[0]?.name || "Plumbing",
        tradeTitle: result.tradeTitle || item.query,
        keywords: result.keywords || [item.query],
        confidence: result.confidence || 0.85,
        reasoning: result.reasoning || "AI category match",
      });
    } catch (err: any) {
      showToast(err?.message || "AI classification failed", "error");
    } finally {
      setClassifyingId(null);
    }
  };

  const handleApproveAiProposal = async () => {
    if (!aiProposal) return;
    setApprovingId(aiProposal.telemetryId);
    try {
      const meta: SynonymMeta = {
        categoryName: aiProposal.categoryName,
        tradeTitle: aiProposal.tradeTitle,
        keywords: aiProposal.keywords,
      };

      const res = await approveTelemetryAsSynonym(aiProposal.telemetryId, meta, "admin");
      if (res.success) {
        showToast(`✅ Published "${aiProposal.term}" to FuzzyMatch (Live Instantly)`, "success");
        setAiProposal(null);
        await loadData();
      } else {
        showToast("Failed to publish dynamic synonym", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Error publishing synonym", "error");
    } finally {
      setApprovingId(null);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTerm.trim() || !newCategory) {
      showToast("Please provide both a search term and category", "error");
      return;
    }

    try {
      const parsedKeywords = newKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      const meta: SynonymMeta = {
        categoryName: newCategory,
        tradeTitle: newTradeTitle.trim() || newTerm.trim(),
        keywords: parsedKeywords.length > 0 ? parsedKeywords : [newTerm.trim().toLowerCase()],
      };

      const res = await saveDynamicSynonym(newTerm.trim(), meta, "admin");
      if (res.success) {
        showToast(`✅ Saved dynamic synonym: "${newTerm}"`, "success");
        setNewTerm("");
        setNewTradeTitle("");
        setNewKeywords("");
        setShowAddModal(false);
        await loadData();
      } else {
        showToast(res.message || "Failed to save synonym", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to save synonym", "error");
    }
  };

  const handleDeleteSynonym = async (term: string) => {
    if (!confirm(`Are you sure you want to remove dynamic synonym "${term}"?`)) return;
    try {
      const res = await deleteDynamicSynonym(term);
      if (res.success) {
        showToast(`Removed synonym "${term}"`, "success");
        await loadData();
      }
    } catch (err: any) {
      showToast("Failed to delete synonym", "error");
    }
  };

  const totalSearchesLogged = telemetryList.reduce((acc, curr) => acc + curr.searchCount, 0);

  return (
    <div className="space-y-6" id="admin-search-demand-tab">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className={cn(
            "px-4 py-3 rounded-lg shadow-lg border border-black flex items-center gap-2 text-sm font-semibold",
            toastMessage.type === "success" ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"
          )}>
            {toastMessage.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white border border-black rounded-lg p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300">
              <Zap className="w-3 h-3 text-blue-600" /> Zero-Code FuzzyMatch Engine
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <ShieldCheck className="w-3 h-3" /> Min-Cost Shield Active
            </span>
          </div>
          <h2 className="text-xl font-bold text-black tracking-tight">Search Demand Telemetry & Cloud Synonyms</h2>
          <p className="text-sm text-black/70 max-w-2xl mt-1">
            Captures real customer searches that yielded zero matches. Feed high-demand terms directly into trader Profile Optimizers, or 1-click publish them to FuzzyMatch without redeploying code.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={refreshing}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-black rounded-lg text-xs font-bold text-black flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
            Refresh
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-black hover:bg-slate-800 text-white border border-black rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Dynamic Synonym
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-black rounded-lg p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-black/60 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-black" /> Unmatched Search Queries
          </div>
          <div className="text-2xl font-black text-black mt-2">{telemetryList.length}</div>
          <div className="text-xs text-black/70 mt-1">Total query impressions: {totalSearchesLogged}</div>
        </div>

        <div className="bg-white border border-black rounded-lg p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-black/60 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-black" /> Active Cloud Synonyms
          </div>
          <div className="text-2xl font-black text-black mt-2">{synonymsList.length}</div>
          <div className="text-xs text-black/70 mt-1">Loaded dynamically into memory</div>
        </div>

        <div className="bg-white border border-black rounded-lg p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-black/60 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-black" /> Top Demand Gap
          </div>
          <div className="text-lg font-black text-black mt-2 truncate">
            {telemetryList[0] ? `"${telemetryList[0].query}" (${telemetryList[0].searchCount}x)` : "No gaps detected"}
          </div>
          <div className="text-xs text-black/70 mt-1">Synced to Profile Optimizer Agent</div>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex border-b border-black">
        <button
          onClick={() => setActiveView("telemetry")}
          className={cn(
            "px-5 py-2.5 text-sm font-bold border-b-2 transition-colors flex items-center gap-2",
            activeView === "telemetry" 
              ? "border-black text-black bg-slate-50" 
              : "border-transparent text-black/60 hover:text-black hover:bg-slate-50/50"
          )}
        >
          <Search className="w-4 h-4" />
          Unmatched Search Queries ({telemetryList.length})
        </button>
        <button
          onClick={() => setActiveView("synonyms")}
          className={cn(
            "px-5 py-2.5 text-sm font-bold border-b-2 transition-colors flex items-center gap-2",
            activeView === "synonyms" 
              ? "border-black text-black bg-slate-50" 
              : "border-transparent text-black/60 hover:text-black hover:bg-slate-50/50"
          )}
        >
          <Tag className="w-4 h-4" />
          Active Cloud Synonyms ({synonymsList.length})
        </button>
      </div>

      {/* Main Content Areas */}
      {loading ? (
        <div className="bg-white border border-black rounded-lg p-12 text-center">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-black/50 mb-2" />
          <p className="text-sm font-semibold text-black">Loading search demand telemetry...</p>
        </div>
      ) : activeView === "telemetry" ? (
        <div className="bg-white border border-black rounded-lg overflow-hidden">
          <div className="p-4 border-b border-black bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-black">Customer Searches with Zero Matches</h3>
              <p className="text-xs text-black/70">
                These terms were entered by real homeowners with 0 matching traders. Use AI to auto-classify or publish them to FuzzyMatch instantly.
              </p>
            </div>
          </div>

          {telemetryList.length === 0 ? (
            <div className="p-10 text-center text-black/60">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600 mb-2" />
              <p className="text-sm font-bold text-black">No unmatched searches found</p>
              <p className="text-xs text-black/70 mt-1">
                All recent customer search queries successfully matched active trade categories or profiles!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 overflow-x-auto">
              {telemetryList.map((item) => (
                <div key={item.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                      <Search className="w-4 h-4 text-amber-700" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-black text-base">"{item.query}"</span>
                        <span className="px-2 py-0.5 bg-black text-white text-xs font-bold rounded">
                          {item.searchCount} {item.searchCount === 1 ? "Search" : "Searches"}
                        </span>
                        {item.source === "ai_bot" ? (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-900 border border-purple-300 text-xs font-bold rounded flex items-center gap-1">
                            🤖 AI Bot
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 text-xs font-semibold rounded flex items-center gap-1">
                            🔍 Search Bar
                          </span>
                        )}
                        {item.gapType === "no_traders_found" && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold rounded">
                            ⚠️ 0 Traders Found
                          </span>
                        )}
                        {item.postcodeArea && (
                          <span className="px-2 py-0.5 bg-slate-200 text-black text-xs font-semibold rounded">
                            📍 {item.postcodeArea}
                          </span>
                        )}
                        {item.status === "synonym_added" && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded flex items-center gap-1 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3" /> Synonym Live
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-black/60 mt-1">
                        {item.suggestedCategory ? (
                          <span>Mapped Category: <strong className="text-black">{item.suggestedCategory}</strong></span>
                        ) : (
                          <span>Zero results returned • Suggested to relevant traders via Profile Optimizer</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleAiClassify(item)}
                      disabled={classifyingId === item.id}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <Sparkles className={cn("w-3.5 h-3.5 text-blue-600", classifyingId === item.id && "animate-spin")} />
                      {classifyingId === item.id ? "Analyzing..." : "✨ AI Classify"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Dynamic Synonyms List */
        <div className="bg-white border border-black rounded-lg overflow-hidden">
          <div className="p-4 border-b border-black bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-black">Active Dynamic Synonyms (Cloud Registry)</h3>
              <p className="text-xs text-black/70">
                These synonyms were registered at runtime and participate in all autocomplete and search matching without manual code editing.
              </p>
            </div>
          </div>

          {synonymsList.length === 0 ? (
            <div className="p-10 text-center text-black/60">
              <Tag className="w-8 h-8 mx-auto text-black/40 mb-2" />
              <p className="text-sm font-bold text-black">No dynamic synonyms created yet</p>
              <p className="text-xs text-black/70 mt-1">
                The platform is currently using the 80+ built-in base categories and synonyms. Click "Add Dynamic Synonym" or classify unmatched searches to add new ones.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {synonymsList.map((syn) => (
                <div key={syn.term} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-black text-base">"{syn.term}"</span>
                      <ArrowRight className="w-3.5 h-3.5 text-black/40" />
                      <span className="px-2 py-0.5 bg-slate-100 border border-black/30 text-black text-xs font-bold rounded">
                        {syn.categoryName}
                      </span>
                      {syn.tradeTitle && (
                        <span className="text-xs text-black/60 italic">({syn.tradeTitle})</span>
                      )}
                    </div>
                    {syn.keywords && syn.keywords.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        <span className="text-xs font-semibold text-black/50">Keywords:</span>
                        {syn.keywords.map((kw, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-black text-[11px] font-medium rounded border border-slate-200">
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDeleteSynonym(syn.term)}
                      className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI Classification & Approval Modal */}
      <AnimatePresence>
        {aiProposal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-black rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-black pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  <h3 className="text-base font-bold text-black">AI Synonym Categorization</h3>
                </div>
                <button 
                  onClick={() => setAiProposal(null)}
                  className="text-black/50 hover:text-black text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <label className="text-xs font-bold text-black/60 uppercase">Search Term</label>
                  <div className="font-bold text-black text-base mt-0.5">"{aiProposal.term}"</div>
                </div>

                <div>
                  <label className="text-xs font-bold text-black/60 uppercase">Target Trade Category</label>
                  <select
                    value={aiProposal.categoryName}
                    onChange={(e) => setAiProposal({ ...aiProposal, categoryName: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-black rounded-lg text-sm font-semibold bg-white text-black"
                  >
                    {TRADE_CATEGORIES.map((cat) => (
                      <option key={cat.name} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-black/60 uppercase">Suggested Trade Title</label>
                  <input
                    type="text"
                    value={aiProposal.tradeTitle}
                    onChange={(e) => setAiProposal({ ...aiProposal, tradeTitle: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-black rounded-lg text-sm text-black font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-black/60 uppercase">Keywords (Comma Separated)</label>
                  <input
                    type="text"
                    value={aiProposal.keywords.join(", ")}
                    onChange={(e) => setAiProposal({ ...aiProposal, keywords: e.target.value.split(",").map(k => k.trim()).filter(Boolean) })}
                    className="w-full mt-1 px-3 py-2 border border-black rounded-lg text-sm text-black"
                  />
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                  <strong>AI Reasoning:</strong> {aiProposal.reasoning}
                  <div className="mt-1 text-blue-700 font-semibold">Confidence: {Math.round(aiProposal.confidence * 100)}%</div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-black">
                <button
                  onClick={() => setAiProposal(null)}
                  className="px-4 py-2 border border-black rounded-lg text-xs font-bold hover:bg-slate-100 text-black"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApproveAiProposal}
                  disabled={approvingId === aiProposal.telemetryId}
                  className="px-4 py-2 bg-black hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 border border-black disabled:opacity-50 shadow-sm"
                >
                  <Zap className="w-3.5 h-3.5" />
                  {approvingId === aiProposal.telemetryId ? "Publishing..." : "⚡ Publish to FuzzyMatch"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-black rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-black pb-3">
                <div className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-black" />
                  <h3 className="text-base font-bold text-black">Add Dynamic Search Synonym</h3>
                </div>
                <button onClick={() => setShowAddModal(false)} className="text-black/50 hover:text-black text-sm font-bold">✕</button>
              </div>

              <form onSubmit={handleManualAdd} className="space-y-3 text-sm">
                <div>
                  <label className="text-xs font-bold text-black/60 uppercase">Search Term or Phrase</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. pet care, emergency glass, boiler breakdown"
                    value={newTerm}
                    onChange={(e) => setNewTerm(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-black rounded-lg text-sm text-black"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-black/60 uppercase">Trade Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-black rounded-lg text-sm font-semibold bg-white text-black"
                  >
                    {TRADE_CATEGORIES.map((cat) => (
                      <option key={cat.name} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-black/60 uppercase">Trade Title (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Pet Sitter & Carer"
                    value={newTradeTitle}
                    onChange={(e) => setNewTradeTitle(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-black rounded-lg text-sm text-black"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-black/60 uppercase">Associated Keywords (Comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. dog walking, pet sitting, cat care, feeding"
                    value={newKeywords}
                    onChange={(e) => setNewKeywords(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-black rounded-lg text-sm text-black"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-black">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-black rounded-lg text-xs font-bold hover:bg-slate-100 text-black"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-black hover:bg-slate-800 text-white rounded-lg text-xs font-bold border border-black shadow-sm"
                  >
                    Save & Activate
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

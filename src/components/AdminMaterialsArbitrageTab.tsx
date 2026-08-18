import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  ShoppingBag, RefreshCw, Sparkles, Send, CheckCircle2, TrendingDown, 
  Store, MapPin, Tag, ArrowRight, ShieldCheck, DollarSign, AlertCircle
} from "lucide-react";
import { 
  MaterialArbitrageItem, 
  runMaterialsArbitrageScan, 
  executeAgentAction 
} from "../services/aiAgentEcosystemService";
import { cn } from "@/src/lib/utils";

interface AdminMaterialsArbitrageTabProps {
  onShowNotice?: (text: string, type?: "success" | "error" | "info") => void;
}

export default function AdminMaterialsArbitrageTab({ onShowNotice }: AdminMaterialsArbitrageTabProps) {
  const [items, setItems] = useState<MaterialArbitrageItem[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [topCategory, setTopCategory] = useState<string>("");
  const [selectedRegion, setSelectedRegion] = useState<string>("Greater Manchester");
  const [loading, setLoading] = useState<boolean>(false);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [broadcastedIds, setBroadcastedIds] = useState<Set<string>>(new Set());

  const fetchArbitrageData = async (region: string) => {
    setLoading(true);
    try {
      const data = await runMaterialsArbitrageScan(region);
      setItems(data.items || []);
      setSummary(data.executiveSummary || "");
      setTopCategory(data.topSavingsCategory || "");
    } catch (err) {
      console.warn("Failed to fetch arbitrage data:", err);
      onShowNotice?.("Failed to run materials arbitrage scan", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArbitrageData(selectedRegion);
  }, [selectedRegion]);

  const handleBroadcastAlert = async (item: MaterialArbitrageItem) => {
    setExecutingId(item.id);
    try {
      const res = await executeAgentAction(
        "BROADCAST_ARBITRAGE_ALERT",
        {
          materialId: item.id,
          materialName: item.materialName,
          merchantName: item.bestMerchant,
          bestPrice: item.bestPrice,
          savingsAmount: item.savingsAmount,
          suggestedBroadcast: item.suggestedTraderBroadcast
        },
        "MATERIALS_ARBITRAGE_AGENT"
      );

      if (res.success) {
        setBroadcastedIds(prev => new Set(prev).add(item.id));
        onShowNotice?.(res.outcomeMessage, "success");
      } else {
        onShowNotice?.("Failed to broadcast alert", "error");
      }
    } catch (err) {
      onShowNotice?.("Error dispatching broadcast", "error");
    } finally {
      setExecutingId(null);
    }
  };

  return (
    <div className="space-y-6" id="admin-materials-arbitrage-root">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-black shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-700">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <h3 className="font-black text-slate-900 text-lg">AI Material Price Arbitrage & Sourcing</h3>
            <span className="bg-emerald-100 text-emerald-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-300 uppercase">
              Autonomous Merchant Sourcing
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium max-w-2xl">
            Continuously scours Screwfix, Travis Perkins, Toolstation, Selco, and B&Q TradePoint to identify wholesale pricing discrepancies, locking in margin improvements for AnyTrader verified contractors.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            id="arbitrage-region-select"
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="text-xs font-bold bg-slate-50 border border-black rounded-xl px-3 py-2.5 text-slate-800"
          >
            <option value="Greater Manchester">Greater Manchester</option>
            <option value="London & M25">London & M25</option>
            <option value="West Midlands">West Midlands</option>
            <option value="Yorkshire & Humber">Yorkshire & Humber</option>
            <option value="North West">North West</option>
          </select>

          <button
            id="arbitrage-rescan-btn"
            onClick={() => fetchArbitrageData(selectedRegion)}
            disabled={loading}
            className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-2 border border-black shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            {loading ? "Scanning Merchants..." : "Scan Trade Merchants"}
          </button>
        </div>
      </div>

      {/* AI Executive Summary Box */}
      {summary && (
        <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-3xl p-6 text-white border border-black shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <h4 className="font-black text-white text-base">Gemini Arbitrage Intelligence & Market Insight</h4>
            </div>
            {topCategory && (
              <span className="text-[11px] font-black text-emerald-300 bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-400/30">
                Top Savings Sector: {topCategory}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-200 leading-relaxed font-medium">
            {summary}
          </p>
        </div>
      )}

      {/* Arbitrage Items Grid */}
      <div className="space-y-4">
        {items.map((item) => {
          const isBroadcasted = broadcastedIds.has(item.id);
          const isExecuting = executingId === item.id;

          return (
            <div key={item.id} className="bg-white rounded-3xl p-6 border border-black shadow-sm space-y-4" id={`arbitrage-item-${item.id}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 text-base">{item.materialName}</span>
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                      {item.category}
                    </span>
                    <span className={cn(
                      "text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border border-black",
                      item.arbitrageOpportunityRating === "high" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    )}>
                      {item.arbitrageOpportunityRating} Arbitrage
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>Retail Benchmark: <strong className="text-slate-900 line-through">£{item.retailBenchmarkPrice.toFixed(2)}</strong></span>
                    <span>•</span>
                    <span>Best Trade Price: <strong className="text-emerald-700 font-black">£{item.bestPrice.toFixed(2)}</strong> ({item.bestMerchant})</span>
                  </div>
                </div>

                <div className="text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center">
                  <span className="text-[11px] font-bold text-slate-500">Trader Savings:</span>
                  <p className="text-xl font-black text-emerald-700 flex items-center gap-1">
                    <TrendingDown className="w-5 h-5 text-emerald-600" />
                    Save £{item.savingsAmount.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Merchant Comparison Table */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {item.merchants.map((m, idx) => {
                  const isBest = m.price === item.bestPrice;
                  return (
                    <div 
                      key={idx} 
                      className={cn(
                        "p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-2",
                        isBest ? "bg-emerald-50/70 border-emerald-400 shadow-sm ring-1 ring-emerald-400" : "bg-slate-50 border-slate-200"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-slate-600" />
                          {m.merchantName}
                        </span>
                        {isBest && (
                          <span className="bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                            Lowest Price
                          </span>
                        )}
                      </div>

                      <div className="flex items-baseline justify-between pt-1">
                        <span className="text-lg font-black text-slate-900">£{m.price.toFixed(2)}</span>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                          -{m.discountPct.toFixed(1)}%
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {m.distanceMiles} miles
                        </span>
                        <span className={cn("font-bold", m.inStock ? "text-emerald-700" : "text-amber-700")}>
                          {m.inStock ? "✓ In Stock" : "Pre-order"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action and Broadcast Row */}
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <Tag className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="italic font-medium">{item.suggestedTraderBroadcast}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    id={`broadcast-arbitrage-btn-${item.id}`}
                    onClick={() => handleBroadcastAlert(item)}
                    disabled={isExecuting || isBroadcasted}
                    className={cn(
                      "px-4 py-2 rounded-xl font-black transition-all border border-black flex items-center gap-1.5 text-xs shadow-sm",
                      isBroadcasted 
                        ? "bg-slate-100 text-slate-600 cursor-default" 
                        : "bg-emerald-600 hover:bg-emerald-500 text-white"
                    )}
                  >
                    {isExecuting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Broadcasting...
                      </>
                    ) : isBroadcasted ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Alert Broadcasted
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        ⚡ Broadcast Deal to Local Traders
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

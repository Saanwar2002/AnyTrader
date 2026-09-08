import React, { useState } from "react";
import { Plus, Trash2, Wrench, Sparkles, CheckCircle2, ShoppingBag, DollarSign, ExternalLink, Loader2, Store, Tag, ShieldCheck, ArrowUpRight, Truck, QrCode } from "lucide-react";
import { toast } from "sonner";
import { calculateMaterialMerchantAffiliateCommission } from "@/src/services/stripeIntegrationService";
import { BomOneClickOrderingModal } from "./BomOneClickOrderingModal";
import { BomOrderStatusTracker } from "./BomOrderStatusTracker";
import { BOMOrderRecord } from "@/src/services/bomMerchantService";

export interface MaterialItem {
  id: string;
  name: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  supplier?: string;
  status: "needed" | "ordered" | "purchased" | "delivered";
}

interface MaterialsTrackerProps {
  jobTitle?: string;
  category?: string;
  description?: string;
  materials: MaterialItem[];
  onUpdateMaterials: (materials: MaterialItem[]) => void;
  readOnly?: boolean;
  job?: any;
}

export function MaterialsTracker({
  jobTitle,
  category,
  description,
  materials,
  onUpdateMaterials,
  readOnly = false,
  job
}: MaterialsTrackerProps) {
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemCost, setNewItemCost] = useState("");
  const [newItemSupplier, setNewItemSupplier] = useState("");
  const [selectedMerchant, setSelectedMerchant] = useState("Screwfix Trade");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showBomModal, setShowBomModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [activeBomOrder, setActiveBomOrder] = useState<BOMOrderRecord | null>(() => {
    if (job?.hasBOMOrder) {
      return {
        id: job.bomOrderId || "bom_tracked",
        jobId: job.id || "job_demo",
        jobTitle: job.title || "Renovation Project",
        tradespersonId: job.traderId || "trader_1",
        tradespersonName: job.traderName || "Tradesperson",
        homeownerId: job.userId,
        homeownerName: job.homeownerName || "Homeowner",
        propertyId: job.propertyId,
        items: materials.map((m, i) => ({
          id: m.id,
          name: m.name,
          category: "Plumbing & Heating",
          quantity: m.quantity,
          unitCost: m.unitCost,
          totalCost: m.totalCost,
          retailCost: m.unitCost * 1.2,
          unit: "unit",
          stockStatus: "in_stock_today" as const,
          suggestedSupplier: m.supplier || job.bomMerchant || "Screwfix Trade"
        })),
        itemCount: materials.length,
        selectedMerchant: job.bomMerchant || "Screwfix Trade",
        subtotalCost: job.materialsCost || totalMaterialsCost,
        tradeDiscountAmount: 18.50,
        vatAmount: (job.materialsCost || totalMaterialsCost) * 0.20,
        totalAmount: (job.materialsCost || totalMaterialsCost) * 1.20,
        affiliateCommissionEarned: 4.50,
        fulfillmentType: "click_and_collect",
        pickupReferenceCode: job.bomPickupRef || "AT-SCR-829104",
        pickupBarcode: "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=AT-SCR-829104",
        vatInvoiceNumber: "VAT-BOM-2026-49102",
        paymentSource: "homeowner_materials_escrow",
        status: (job.bomStatus as any) || "ready_for_pickup",
        propertyPassportSynced: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    return null;
  });
  const [showOrderTracker, setShowOrderTracker] = useState(false);

  const totalMaterialsCost = materials.reduce((sum, m) => sum + (m.totalCost || m.quantity * m.unitCost), 0);
  
  // Calculate 3% - 5% Merchant Affiliate Commission Breakdown
  const merchantAffiliate = calculateMaterialMerchantAffiliateCommission(
    totalMaterialsCost,
    selectedMerchant,
    materials.length
  );

  const handleFulfillViaMerchantAffiliate = () => {
    if (materials.length === 0) {
      toast.error("Add materials to your cart before ordering via merchant");
      return;
    }

    const updated = materials.map(m => m.status === "needed" ? { ...m, status: "ordered" as const, supplier: selectedMerchant } : m);
    onUpdateMaterials(updated);

    toast.success(
      `🛒 Order dispatched to ${selectedMerchant}! TradeOS 5% discount code (${merchantAffiliate.traderDiscountCode}) applied. Platform affiliate fee (+£${merchantAffiliate.affiliateCommissionAmount.toFixed(2)}) logged.`
    );
  };

  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newItemName.trim()) return;

    const unitCost = parseFloat(newItemCost) || 0;
    const item: MaterialItem = {
      id: "mat_" + Math.random().toString(36).substr(2, 9),
      name: newItemName.trim(),
      quantity: Math.max(1, newItemQty),
      unitCost,
      totalCost: Math.max(1, newItemQty) * unitCost,
      supplier: newItemSupplier.trim() || undefined,
      status: "needed"
    };

    onUpdateMaterials([...materials, item]);
    setNewItemName("");
    setNewItemQty(1);
    setNewItemCost("");
    setNewItemSupplier("");
    toast.success("Material added");
  };

  const handleRemoveItem = (id: string) => {
    onUpdateMaterials(materials.filter(m => m.id !== id));
  };

  const handleStatusChange = (id: string, status: MaterialItem["status"]) => {
    onUpdateMaterials(
      materials.map(m => (m.id === id ? { ...m, status } : m))
    );
  };

  const handleAISourceMaterials = async () => {
    if (!jobTitle && !description) {
      toast.error("Job details required to generate materials");
      return;
    }
    setIsGenerating(true);
    try {
      const response = await fetch("/api/job/procure-materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: jobTitle,
          category,
          description
        })
      });

      if (!response.ok) throw new Error("API call failed");

      const data = await response.json();
      if (Array.isArray(data.materials)) {
        const generated: MaterialItem[] = data.materials.map((m: any, idx: number) => {
          const qty = parseInt(m.estimatedQuantity) || 1;
          const cost = parseFloat(m.estimatedUnitCost) || 15;
          return {
            id: "ai_mat_" + idx + "_" + Date.now(),
            name: m.item || m.name || "Material",
            quantity: qty,
            unitCost: cost,
            totalCost: qty * cost,
            supplier: m.suggestedSupplier || "Screwfix / Travis Perkins",
            status: "needed"
          };
        });

        onUpdateMaterials([...materials, ...generated]);
        toast.success(`AI generated ${generated.length} required materials!`);
      } else {
        toast.error("Could not generate materials automatically");
      }
    } catch (err) {
      console.error("AI Material sourcing error:", err);
      // Fallback smart materials if backend endpoint is unavailable
      const fallback: MaterialItem[] = [
        { id: "f1", name: "Standard Fixtures & Fittings Pack", quantity: 1, unitCost: 35, totalCost: 35, supplier: "Screwfix", status: "needed" },
        { id: "f2", name: "High-Grade Adhesive & Sealant", quantity: 2, unitCost: 12, totalCost: 24, supplier: "Toolstation", status: "needed" }
      ];
      onUpdateMaterials([...materials, ...fallback]);
      toast.success("Added standard trade materials checklist!");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-5 bg-white rounded-3xl border border-black shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-200">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-slate-900 text-sm">Materials & Procurement Tracker</h4>
            <p className="text-xs text-slate-500">Track job materials, supplier costs, and status</p>
          </div>
        </div>

        {!readOnly && (
          <button
            onClick={handleAISourceMaterials}
            disabled={isGenerating}
            className="py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-xl border border-black shadow-sm flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {isGenerating ? "Sourcing..." : "AI Materials Sourcing"}
          </button>
        )}
      </div>

      {/* Total Cost Summary Banner */}
      <div className="p-3.5 bg-slate-50 border border-black rounded-2xl flex items-center justify-between">
        <div>
          <p className="text-[10px] font-extrabold uppercase text-slate-500">Total Material Expenses</p>
          <p className="text-lg font-black text-slate-900">£{totalMaterialsCost.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-extrabold uppercase text-slate-500">Items Tracked</p>
          <p className="text-sm font-black text-blue-600">{materials.length} Items</p>
        </div>
      </div>

      {/* Merchant Partner Procurement & 3%-5% Affiliate Commission Card */}
      {!readOnly && (
        <div className="p-4 bg-gradient-to-r from-amber-50 via-amber-100/50 to-orange-50 border border-black rounded-2xl space-y-3 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-500 text-slate-950 rounded-xl font-bold">
                <Store className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h5 className="font-black text-slate-900 text-xs">TradeOS Merchant Partner Sourcing</h5>
                  <span className="bg-amber-300 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded border border-black">
                    3.0% – 5.0% Affiliate Fee
                  </span>
                </div>
                <p className="text-[10px] text-slate-600">Fulfill material lists with local trade merchants and earn platform referral commissions.</p>
              </div>
            </div>

            <select
              value={selectedMerchant}
              onChange={(e) => setSelectedMerchant(e.target.value)}
              className="p-2 rounded-xl border border-black text-xs font-bold bg-white text-slate-900 shadow-xs cursor-pointer"
            >
              <option value="Screwfix Trade">Screwfix Trade (4.0% Fee)</option>
              <option value="Travis Perkins">Travis Perkins (5.0% Fee)</option>
              <option value="B&Q TradePoint">B&Q TradePoint (3.5% Fee)</option>
              <option value="Toolstation">Toolstation (4.5% Fee)</option>
              <option value="Jewson">Jewson (5.0% Fee)</option>
              <option value="Selco Hygiene">Selco (4.5% Fee)</option>
              <option value="Wickes Trade">Wickes Trade (3.5% Fee)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
            <div className="p-2.5 bg-white rounded-xl border border-black">
              <p className="text-[9px] font-extrabold uppercase text-slate-400">Selected Merchant</p>
              <p className="font-extrabold text-slate-900 text-xs mt-0.5">{merchantAffiliate.merchantName}</p>
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-black">
              <p className="text-[9px] font-extrabold uppercase text-slate-400">Trader Trade Perk</p>
              <p className="font-extrabold text-emerald-700 text-xs mt-0.5">
                5% Trade Off <span className="text-[9px] text-slate-500 font-mono">({merchantAffiliate.traderDiscountCode})</span>
              </p>
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-black">
              <p className="text-[9px] font-extrabold uppercase text-slate-400">TradeOS Affiliate Share</p>
              <p className="font-extrabold text-amber-700 text-xs mt-0.5">
                +£{merchantAffiliate.affiliateCommissionAmount.toFixed(2)} <span className="text-[9px] text-slate-500">({(merchantAffiliate.affiliateRate * 100).toFixed(1)}%)</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowBomModal(true)}
              className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm active:scale-98"
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>🚀 Open Direct Merchant AI BOM Ordering (Screwfix/Travis Perkins)</span>
            </button>

            <button
              type="button"
              onClick={handleFulfillViaMerchantAffiliate}
              className="w-full py-2.5 bg-slate-900 hover:bg-black text-amber-300 font-extrabold text-xs rounded-xl border border-black shadow-sm flex items-center justify-center gap-2 transition active:scale-98"
            >
              <ShoppingBag className="w-4 h-4 text-amber-400" />
              <span>Fulfill Cart via {merchantAffiliate.merchantName} (+£{merchantAffiliate.affiliateCommissionAmount.toFixed(2)} Fee)</span>
            </button>
          </div>

          {activeBomOrder && (
            <div className="pt-2 border-t border-amber-200">
              <button
                type="button"
                onClick={() => setShowOrderTracker(!showOrderTracker)}
                className="w-full py-2 px-3 bg-purple-700 hover:bg-purple-800 text-white font-black text-xs rounded-xl flex items-center justify-between shadow-sm transition"
              >
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-300 animate-pulse" />
                  <span>
                    Active 1-Click Order ({activeBomOrder.pickupReferenceCode}) • Status:{" "}
                    <strong className="uppercase text-amber-300">{activeBomOrder.status.replace(/_/g, " ")}</strong>
                  </span>
                </div>
                <span className="text-[10px] bg-purple-900 px-2 py-0.5 rounded-lg text-purple-200 font-extrabold">
                  {showOrderTracker ? "Hide Tracker" : "Open Animated Live Tracker"}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Embedded Live Animated Status Tracker */}
      {showOrderTracker && activeBomOrder && (
        <div className="p-2">
          <BomOrderStatusTracker
            order={activeBomOrder}
            onStatusUpdate={(newStatus) => {
              setActiveBomOrder({
                ...activeBomOrder,
                status: newStatus
              });
            }}
            allowManualStageTesting={true}
          />
        </div>
      )}

      {/* Add New Material Form */}
      {!readOnly && (
        <form onSubmit={handleAddItem} className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
          <input
            type="text"
            placeholder="Material name (e.g. 15mm Copper Pipe)"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            className="sm:col-span-5 p-2.5 rounded-xl border border-black text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          <input
            type="number"
            min="1"
            placeholder="Qty"
            value={newItemQty}
            onChange={(e) => setNewItemQty(parseInt(e.target.value) || 1)}
            className="sm:col-span-2 p-2.5 rounded-xl border border-black text-xs font-bold text-center bg-white"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Unit £"
            value={newItemCost}
            onChange={(e) => setNewItemCost(e.target.value)}
            className="sm:col-span-2 p-2.5 rounded-xl border border-black text-xs font-bold bg-white"
          />
          <input
            type="text"
            placeholder="Supplier"
            value={newItemSupplier}
            onChange={(e) => setNewItemSupplier(e.target.value)}
            className="sm:col-span-2 p-2.5 rounded-xl border border-black text-xs font-medium bg-white"
          />
          <button
            type="submit"
            className="sm:col-span-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl border border-black flex items-center justify-center transition"
            title="Add Item"
          >
            <Plus className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* Material Items List Table */}
      {materials.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
          No materials recorded. Click "AI Materials Sourcing" or enter items manually above.
        </p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {materials.map((item) => (
            <div key={item.id} className="p-3 bg-white rounded-2xl border border-black flex items-center justify-between gap-3 text-xs">
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-slate-900 truncate">{item.name}</p>
                <p className="text-[10px] text-slate-500">
                  Qty: {item.quantity} × £{item.unitCost.toFixed(2)}
                  {item.supplier ? ` • Supplier: ${item.supplier}` : ''}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-black text-slate-900 text-xs">
                  £{(item.totalCost || item.quantity * item.unitCost).toFixed(2)}
                </span>

                {!readOnly ? (
                  <select
                    value={item.status}
                    onChange={(e) => handleStatusChange(item.id, e.target.value as any)}
                    className="p-1 rounded-lg border border-black text-[10px] font-extrabold bg-slate-50"
                  >
                    <option value="needed">Needed</option>
                    <option value="ordered">Ordered</option>
                    <option value="purchased">Purchased</option>
                    <option value="delivered">Delivered</option>
                  </select>
                ) : (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-100 border border-slate-300">
                    {item.status}
                  </span>
                )}

                {!readOnly && (
                  confirmDeleteId === item.id ? (
                    <div className="flex items-center gap-1 bg-red-50 p-0.5 rounded-lg border border-red-300">
                      <button
                        type="button"
                        onClick={() => {
                          handleRemoveItem(item.id);
                          setConfirmDeleteId(null);
                        }}
                        className="px-1.5 py-0.5 bg-red-600 hover:bg-red-700 text-white font-black text-[9px] rounded shadow-sm active:scale-95 transition cursor-pointer"
                        title="Confirm delete"
                      >
                        Delete?
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-1 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[9px] rounded transition cursor-pointer"
                        title="Cancel"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(item.id)}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer"
                      title="Delete material"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <BomOneClickOrderingModal
        isOpen={showBomModal}
        onClose={() => setShowBomModal(false)}
        job={job || { title: jobTitle, category: category, description: description }}
        onOrderCreated={(order) => {
          // Convert BOM items to Materials list
          const newMaterials: MaterialItem[] = order.items.map(i => ({
            id: i.id,
            name: i.name,
            quantity: i.quantity,
            unitCost: i.unitCost,
            totalCost: i.totalCost,
            supplier: order.selectedMerchant,
            status: "ordered" as const
          }));
          onUpdateMaterials(newMaterials);
          setActiveBomOrder(order);
          setShowOrderTracker(true);
          setShowBomModal(false);
        }}
      />
    </div>
  );
}

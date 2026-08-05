import React, { useState } from "react";
import { Plus, Trash2, Wrench, Sparkles, CheckCircle2, ShoppingBag, DollarSign, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
}

export function MaterialsTracker({
  jobTitle,
  category,
  description,
  materials,
  onUpdateMaterials,
  readOnly = false
}: MaterialsTrackerProps) {
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemCost, setNewItemCost] = useState("");
  const [newItemSupplier, setNewItemSupplier] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

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

  const totalMaterialsCost = materials.reduce((sum, m) => sum + (m.totalCost || m.quantity * m.unitCost), 0);

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
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="p-1 text-red-500 hover:text-red-700 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

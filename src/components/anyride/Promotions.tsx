import React, { useState, useEffect } from "react";
import { Tag, Plus, Settings2, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { db, collection, query, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, handleFirestoreError, OperationType } from "@/src/firebase";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

export default function Promotions() {
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newPromo, setNewPromo] = useState({ code: "", type: "Discount", value: "", discountPercent: 0, maxDiscount: 0, maxUses: 100, expiresDays: 30 });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "promo_codes"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPromos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCreate = async () => {
    if (!newPromo.code || !newPromo.value) {
      toast.error("Code and display value are required.");
      return;
    }
    
    setSaving(true);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + newPromo.expiresDays);
      
      await addDoc(collection(db, "promo_codes"), {
        code: newPromo.code.toUpperCase(),
        type: newPromo.type,
        value: newPromo.value,
        discountPercent: newPromo.discountPercent,
        maxDiscount: newPromo.maxDiscount,
        maxUses: newPromo.maxUses,
        currentUses: 0,
        expiresAt: expiresAt.toISOString(),
        status: "active",
        createdAt: serverTimestamp()
      });
      toast.success("Promo code created successfully.");
      setShowModal(false);
      setNewPromo({ code: "", type: "Discount", value: "", discountPercent: 0, maxDiscount: 0, maxUses: 100, expiresDays: 30 });
    } catch(e) {
      handleFirestoreError(e, OperationType.CREATE, "promo_codes");
      toast.error("Failed to create promo code");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if(!window.confirm("Are you sure you want to delete this promo code?")) return;
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, "promo_codes", id));
      toast.success("Promo code deleted");
    } catch(e) {
      handleFirestoreError(e, OperationType.DELETE, `promo_codes/${id}`);
      toast.error("Failed to delete promo code");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Tag className="w-6 h-6 text-indigo-500" />
            Promotions & Campaigns
          </h2>
          <p className="text-slate-500 font-medium">Create promo codes, discounts, and priority pass overrides.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 transition-colors shadow-sm inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Campaign
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {promos.map((promo) => (
           <div key={promo.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col relative group">
              <div className="flex justify-between items-start mb-4">
                <div>
                   <h3 className="text-xl font-mono font-black text-indigo-600 tracking-tight">{promo.code}</h3>
                   <span className={cn(
                     "mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest",
                     promo.type === "Discount" ? "bg-emerald-50 text-emerald-600" : "bg-purple-50 text-purple-600"
                   )}>
                     {promo.type}
                   </span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleDelete(promo.id)}
                    disabled={deletingId === promo.id}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors disabled:opacity-50"
                  >
                    {deletingId === promo.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4"/>}
                  </button>
                </div>
              </div>

              <div className="text-2xl font-black text-slate-900 mb-6">{promo.value}</div>
              
              <div className="mt-auto space-y-3">
                 <div className="flex justify-between text-xs font-medium">
                   <span className="text-slate-500">Usage Limit:</span>
                   <span className="text-slate-900 font-bold">{promo.currentUses} / {promo.maxUses || '∞'}</span>
                 </div>
                 {promo.status === "active" && promo.maxUses > 0 && (
                   <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                     <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${Math.min(100, (promo.currentUses / promo.maxUses) * 100)}%` }}></div>
                   </div>
                 )}
                 <div className="flex justify-between text-xs font-medium">
                   <span className="text-slate-500">Expiration:</span>
                   <span className={new Date(promo.expiresAt) > new Date() ? "text-emerald-600 font-bold" : "text-slate-400"}>
                     {new Date(promo.expiresAt).toLocaleDateString()}
                   </span>
                 </div>
              </div>
           </div>
         ))}
         {promos.length === 0 && (
           <div className="col-span-full py-12 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
             No active promo codes.
           </div>
         )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Create Promotion</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Promo Code</label>
                <input 
                  type="text" 
                  value={newPromo.code} 
                  onChange={e => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })} 
                  placeholder="e.g. WELCOME50" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Display Value (Title)</label>
                <input 
                  type="text" 
                  value={newPromo.value} 
                  onChange={e => setNewPromo({ ...newPromo, value: e.target.value })} 
                  placeholder="e.g. 50% Off First Ride" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Discount %</label>
                  <input 
                    type="number" 
                    value={newPromo.discountPercent} 
                    onChange={e => setNewPromo({ ...newPromo, discountPercent: parseInt(e.target.value) || 0 })} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Max Uses</label>
                  <input 
                    type="number" 
                    value={newPromo.maxUses} 
                    onChange={e => setNewPromo({ ...newPromo, maxUses: parseInt(e.target.value) || 0 })} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 flex gap-3">
              <button 
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 px-4 font-bold rounded-xl text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 py-3 px-4 font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center justify-center disabled:opacity-50"
              >
                 {saving ? <Loader2 className="w-5 h-5 animate-spin"/> : "Create Promo"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

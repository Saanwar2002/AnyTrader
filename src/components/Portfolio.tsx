import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { 
  collection, doc, setDoc, getDocs, query, where, orderBy, 
  db, handleFirestoreError, OperationType, deleteDoc
} from "@/src/firebase";
import { motion, AnimatePresence } from "motion/react";
import { 
  Plus, MapPin, Building2, Trash2, Edit2, Loader2, 
  Search, Filter, X, CheckCircle2, AlertCircle,
  Home, Building, Factory, Store
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { toast } from "sonner";

export default function Portfolio() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    postcode: "",
    type: "residential",
    notes: ""
  });

  useEffect(() => {
    if (!user) return;
    fetchAssets();
  }, [user]);

  const fetchAssets = async () => {
    try {
      const q = query(
        collection(db, "assets"),
        where("ownerId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      setAssets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "assets");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const assetId = editingAsset?.id || doc(collection(db, "assets")).id;
      const assetData = {
        ...formData,
        id: assetId,
        ownerId: user.uid,
        createdAt: editingAsset?.createdAt || new Date().toISOString()
      };

      await setDoc(doc(db, "assets", assetId), assetData);
      toast.success(editingAsset ? "Asset updated" : "Asset added to portfolio");
      setShowAddModal(false);
      setEditingAsset(null);
      setFormData({ name: "", address: "", postcode: "", type: "residential", notes: "" });
      fetchAssets();
    } catch (error) {
      toast.error("Failed to save asset");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this asset?")) return;
    try {
      await deleteDoc(doc(db, "assets", id));
      toast.success("Asset removed");
      fetchAssets();
    } catch (error) {
      toast.error("Failed to remove asset");
    }
  };

  const filteredAssets = assets.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.postcode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "residential": return Home;
      case "commercial": return Store;
      case "industrial": return Factory;
      default: return Building;
    }
  };

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display font-black text-slate-900 tracking-tight">Portfolio</h1>
          <p className="text-slate-500 font-medium">Manage your properties and assets.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-5 h-5" />
          Add Asset
        </button>
      </div>

      {/* Search & Filter */}
      <div className="bg-white p-4 rounded-[24px] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, address or postcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-600 transition-all"
          />
        </div>
      </div>

      {/* Assets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredAssets.map((asset) => {
            const Icon = getTypeIcon(asset.type);
            return (
              <motion.div
                key={asset.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingAsset(asset);
                        setFormData({
                          name: asset.name,
                          address: asset.address,
                          postcode: asset.postcode,
                          type: asset.type,
                          notes: asset.notes || ""
                        });
                        setShowAddModal(true);
                      }}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(asset.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-1">{asset.name}</h3>
                <div className="flex items-center gap-2 text-slate-500 text-sm mb-4">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span className="truncate">{asset.address}, {asset.postcode}</span>
                </div>
                <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {asset.type}
                  </span>
                  <button className="text-blue-600 text-xs font-bold hover:underline">
                    View History
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredAssets.length === 0 && (
          <div className="col-span-full py-24 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">No assets found</h3>
            <p className="text-slate-500 mt-2">Start building your portfolio by adding your first property.</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[32px] p-8 max-w-lg w-full shadow-2xl relative overflow-hidden"
          >
            <button
              onClick={() => {
                setShowAddModal(false);
                setEditingAsset(null);
              }}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-900 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <h2 className="text-2xl font-black text-slate-900 mb-6">
              {editingAsset ? "Edit Asset" : "Add New Asset"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Asset Name</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Building A, Flat 4"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-600 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Address</label>
                    <input
                      required
                      type="text"
                      placeholder="Street address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-600 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Postcode</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. SW1A 1AA"
                      value={formData.postcode}
                      onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-600 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-600 transition-all"
                    >
                      <option value="residential">Residential</option>
                      <option value="commercial">Commercial</option>
                      <option value="industrial">Industrial</option>
                      <option value="retail">Retail</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Notes (Optional)</label>
                  <textarea
                    rows={3}
                    placeholder="Any specific details or access instructions..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-600 transition-all resize-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
              >
                {editingAsset ? "Update Asset" : "Add to Portfolio"}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

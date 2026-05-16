import React, { useState, useEffect } from "react";
import { Link2, Plus, Copy, Check, Trash2, Edit3, TrendingUp, Users, DollarSign, ExternalLink } from "lucide-react";
import { db, doc, collection, getDocs, setDoc, deleteDoc, query, orderBy } from "@/src/firebase";

export interface Affiliate {
  id: string;
  name: string;
  code: string;
  discountPercentage: number;
  commissionPercentage: number;
  uses: number;
  revenueGenerated: number;
  status: "active" | "inactive";
  createdAt: number;
}

export default function AffiliatesManager() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Affiliate>>({
    name: "",
    code: "",
    discountPercentage: 10,
    commissionPercentage: 5,
    status: "active"
  });

  useEffect(() => {
    fetchAffiliates();
  }, []);

  const fetchAffiliates = async () => {
    try {
      const q = query(collection(db, "affiliates"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Affiliate));
      
      // If none, inject some mocks for demo
      if (data.length === 0) {
        const mocks: Affiliate[] = [
          {
            id: "mock_ava",
            name: "Ava (Influencer)",
            code: "ava",
            discountPercentage: 15,
            commissionPercentage: 10,
            uses: 342,
            revenueGenerated: 4500,
            status: "active",
            createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000
          },
          {
            id: "mock_tom",
            name: "Tradesman Tom",
            code: "tombuilds",
            discountPercentage: 10,
            commissionPercentage: 5,
            uses: 89,
            revenueGenerated: 1200,
            status: "active",
            createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000
          }
        ];
        // Don't necessarily save to DB, just set state
        setAffiliates(mocks);
      } else {
        setAffiliates(data);
      }
    } catch (err) {
      console.error("Error fetching affiliates:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.code) return;

    const newAffiliate: Affiliate = {
      id: formData.id || `aff_${Date.now()}`,
      name: formData.name,
      code: formData.code.toLowerCase().replace(/[^a-z0-9]/g, ''),
      discountPercentage: formData.discountPercentage || 0,
      commissionPercentage: formData.commissionPercentage || 0,
      uses: formData.uses || 0,
      revenueGenerated: formData.revenueGenerated || 0,
      status: formData.status as "active" | "inactive",
      createdAt: formData.createdAt || Date.now()
    };

    try {
      await setDoc(doc(db, "affiliates", newAffiliate.id), newAffiliate);
      setIsAdding(false);
      setFormData({ name: "", code: "", discountPercentage: 10, commissionPercentage: 5, status: "active" });
      fetchAffiliates();
    } catch (err) {
      console.error("Error saving affiliate:", err);
      alert("Failed to save affiliate.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this affiliate?")) return;
    try {
      await deleteDoc(doc(db, "affiliates", id));
      fetchAffiliates();
    } catch (err) {
      console.error("Error deleting:", err);
    }
  };

  const copyToClipboard = (code: string) => {
    const url = `${window.location.origin}/?ref=${code}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Affiliates & Partners</h2>
          <p className="text-slate-500 text-sm mt-1">Manage influencer codes, discounts, and track conversions.</p>
        </div>
        <button 
          onClick={() => {
            setIsAdding(true);
            setFormData({ name: "", code: "", discountPercentage: 10, commissionPercentage: 5, status: "active" });
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Partner
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-black shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Partners</p>
              <p className="text-2xl font-black text-slate-900">{affiliates.filter(a => a.status === 'active').length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-2xl border border-black shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Conversions</p>
              <p className="text-2xl font-black text-slate-900">{affiliates.reduce((sum, a) => sum + (a.uses || 0), 0)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-black shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Partner Revenue</p>
              <p className="text-2xl font-black text-slate-900">£{affiliates.reduce((sum, a) => sum + (a.revenueGenerated || 0), 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {isAdding && (
        <div className="bg-slate-50 p-6 rounded-2xl border border-blue-100 shadow-sm mb-6 relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 rounded-t-2xl px-6"></div>
          <h3 className="text-lg font-bold text-slate-900 mb-4">{formData.id ? "Edit Partner" : "New Affiliate Partner"}</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Partner Name</label>
              <input 
                type="text" 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full bg-white border border-black rounded-xl px-4 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                placeholder="e.g. Ava"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Referral Code</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">ref=</span>
                <input 
                  type="text" 
                  value={formData.code} 
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                  className="w-full pl-12 bg-white border border-black rounded-xl px-4 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                  placeholder="e.g. ava"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">User Discount (%)</label>
              <input 
                type="number" 
                value={formData.discountPercentage} 
                onChange={(e) => setFormData({...formData, discountPercentage: Number(e.target.value)})}
                className="w-full bg-white border border-black rounded-xl px-4 py-2 outline-none focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Partner Comm. (%)</label>
              <input 
                type="number" 
                value={formData.commissionPercentage} 
                onChange={(e) => setFormData({...formData, commissionPercentage: Number(e.target.value)})}
                className="w-full bg-white border border-black rounded-xl px-4 py-2 outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button 
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={!formData.name || !formData.code}
              className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {formData.id ? "Save Changes" : "Create Link"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-black overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-black uppercase text-[10px] tracking-wider text-slate-500 font-bold">
                <th className="p-4 rounded-tl-2xl">Partner</th>
                <th className="p-4">Tracking Link / Code</th>
                <th className="p-4">Terms</th>
                <th className="p-4">Performance</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right rounded-tr-2xl">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {affiliates.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No affiliates found. Click "Add Partner" to create your first tracking link.
                  </td>
                </tr>
              )}
              {affiliates.map(aff => (
                <tr key={aff.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="p-4">
                    <div className="font-bold text-slate-900">{aff.name}</div>
                    <div className="text-xs text-slate-400 font-medium whitespace-nowrap">Added {new Date(aff.createdAt).toLocaleDateString()}</div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-xs font-bold font-mono border border-blue-100 w-fit">
                        {aff.code}
                      </div>
                      <button 
                        onClick={() => copyToClipboard(aff.code)}
                        className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-blue-600 transition-colors w-fit"
                      >
                        {copiedCode === aff.code ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        {copiedCode === aff.code ? "Copied Link" : "Copy Link"}
                      </button>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-slate-600 font-medium"><span className="font-bold">{aff.discountPercentage}%</span> off for user</span>
                      <span className="text-xs text-slate-600 font-medium"><span className="font-bold text-emerald-600">{aff.commissionPercentage}%</span> commission</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-900">{aff.uses} <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">uses</span></span>
                      <span className="text-xs font-bold text-emerald-600">£{aff.revenueGenerated.toLocaleString()} rev</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      aff.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {aff.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setFormData(aff);
                          setIsAdding(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(aff.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

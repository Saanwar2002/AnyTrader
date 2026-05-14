import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { db, collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from "@/src/firebase";
import { Image as ImageIcon, Plus, Briefcase, FileText, X, Edit, Video } from "lucide-react";

export function ConsultancyPortfolio() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    imageUrl: "" // Hardcoded for preview limits
  });

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "portfolioItems"), where("consultantId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      // Hardcode an image if none is provided, to simulate upload success in preview
      const simulatedImage = form.imageUrl || "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80";

      await addDoc(collection(db, "portfolioItems"), {
        consultantId: user.uid,
        title: form.title,
        description: form.description,
        imageUrls: [simulatedImage],
        createdAt: serverTimestamp()
      });
      setForm({ title: "", description: "", imageUrl: "" });
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "portfolioItems", id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center justify-between">
         <h3 className="font-bold text-black flex items-center gap-2">
           <Briefcase className="w-5 h-5 text-indigo-500" /> My Portfolio
         </h3>
         <button 
           onClick={() => setIsModalOpen(true)}
           className="bg-indigo-600 text-white p-2 rounded-xl text-[12px] font-bold flex items-center gap-1 hover:bg-indigo-700 transition shadow-sm"
         >
           <Plus className="w-4 h-4" /> Add Item
         </button>
      </div>

      {loading ? (
         <div className="py-8 text-center text-slate-500">Loading...</div>
      ) : items.length === 0 ? (
         <div className="bg-white border border-black rounded-xl p-8 text-center shadow-sm">
           <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
           <p className="text-black font-medium text-sm mb-4">No portfolio items yet.</p>
           <button 
             onClick={() => setIsModalOpen(true)}
             className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-100 transition"
           >
             Add First Item
           </button>
         </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map(item => (
            <div key={item.id} className="bg-white border border-black rounded-xl overflow-hidden shadow-sm flex flex-col">
              <div className="aspect-video bg-slate-100 relative group">
                {item.imageUrls?.[0] ? (
                  <img src={item.imageUrls[0]} alt={item.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full w-full">
                    <ImageIcon className="w-8 h-8 text-slate-300" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                   <button className="p-2 bg-white text-black rounded-full hover:scale-105 transition-transform"><Edit className="w-4 h-4" /></button>
                   <button onClick={() => handleDelete(item.id)} className="p-2 bg-rose-500 text-white rounded-full hover:scale-105 transition-transform"><X className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="p-4 flex-1">
                <h4 className="font-bold text-black mb-1">{item.title}</h4>
                <p className="text-sm text-slate-600 line-clamp-2">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col border border-black animate-in zoom-in-95">
            <div className="p-4 border-b border-black/10 flex items-center justify-between bg-indigo-600 text-white">
              <h2 className="text-lg font-bold">Add Portfolio Item</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">Project Title</label>
                <input
                  required
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Acme Corp Rebranding"
                  className="w-full p-3 rounded-xl border border-black bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">Description</label>
                <textarea
                  required
                  rows={3}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe your role and the outcome..."
                  className="w-full p-3 rounded-xl border border-black bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">Image URL (Optional)</label>
                 <input
                  type="url"
                  value={form.imageUrl}
                  onChange={e => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full p-3 rounded-xl border border-black bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                />
                 <p className="text-[10px] text-slate-500 mt-1 pl-1">Leave blank to use a simulated sample image.</p>
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-sm font-bold text-black bg-slate-100 rounded-xl hover:bg-slate-200">
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-3 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-md">
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

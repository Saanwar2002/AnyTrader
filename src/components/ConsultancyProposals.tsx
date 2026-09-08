import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { db, collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, updateDoc, doc } from "@/src/firebase";
import { OperationType } from "@/src/firebase"; // Assuming we have handleFirestoreError if needed properly
import { FileText, Plus, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

export function ConsultancyProposals({ clientId }: { clientId?: string }) {
  const { user } = useAuth();
  const [proposals, setProposals] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", totalAmount: "" });

  useEffect(() => {
    if (!user) return;
    
    let q = query(
      collection(db, "proposals"),
      where("consultantId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    
    if (clientId) {
      q = query(
      collection(db, "proposals"),
      where("consultantId", "==", user.uid),
      where("clientId", "==", clientId),
      orderBy("createdAt", "desc")
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProposals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, error => {
      console.error(error);
    });

    return () => unsubscribe();
  }, [user, clientId]);

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    try {
      await addDoc(collection(db, "proposals"), {
        consultantId: user.uid,
        clientId: clientId || "unknown", // Normally selected or derived
        title: form.title,
        content: form.content,
        totalAmount: parseFloat(form.totalAmount) || 0,
        status: "draft",
        createdAt: serverTimestamp(),
      });
      setShowModal(false);
      setForm({ title: "", content: "", totalAmount: "" });
    } catch (err) {
      console.error("Error creating proposal:", err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
         <h3 className="font-bold text-black flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-500" /> Proposals
         </h3>
         <button 
           onClick={() => setShowModal(true)}
           className="bg-amber-500 text-white p-2 rounded-xl text-[12px] font-bold flex items-center gap-1 hover:bg-amber-600 transition"
         >
             <Plus className="w-4 h-4" /> New Proposal
         </button>
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-sm w-full max-w-md overflow-hidden border border-black"
            >
              <div className="p-6 bg-amber-500 text-white">
                <h3 className="font-black text-xl">Draft Proposal</h3>
                <p className="text-white/80 text-sm font-medium">Create a new proposal to send to your client.</p>
              </div>
              <form onSubmit={handleCreateProposal} className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">Title</label>
                  <input
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full p-3 rounded-xl border border-black bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-amber-500"
                    placeholder="e.g. Q3 Marketing Retainer"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">Scope / Content</label>
                  <textarea
                    required
                    rows={4}
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    className="w-full p-3 rounded-xl border border-black bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-amber-500"
                    placeholder="Outline the deliverables..."
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">Total Amount (£)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={form.totalAmount}
                    onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
                    className="w-full p-3 rounded-xl border border-black bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-amber-500"
                    placeholder="0.00"
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-3 text-sm font-bold text-black bg-slate-100 rounded-xl hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 text-sm font-bold text-white bg-amber-500 rounded-xl hover:bg-amber-600 shadow-md shadow-amber-200"
                  >
                    Save Draft
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {proposals.length === 0 ? (
         <div className="bg-white border border-black rounded-xl p-8 text-center shadow-sm">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-black font-medium text-sm">No proposals drafted yet.</p>
         </div>
      ) : (
         <div className="space-y-3">
            {proposals.map(prop => (
               <div key={prop.id} className="bg-white p-4 rounded-xl border border-black shadow-sm flex flex-col gap-3 group transition-all">
                  <div className="flex items-center justify-between">
                     <div className="flex flex-col">
                        <span className="font-bold text-black">{prop.title}</span>
                        <span className="text-xs text-black opacity-60">{prop.clientId !== "unknown" ? prop.clientId : "Draft"} • {prop.createdAt ? format(prop.createdAt.toDate(), "MMM dd, yyyy") : ""}</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase font-black px-2 py-1 rounded-md ${prop.status === 'accepted' ? 'bg-emerald-100 text-emerald-900 border border-emerald-900' : 'bg-amber-100 text-amber-900 border border-amber-900'}`}>
                           {prop.status}
                        </span>
                     </div>
                  </div>
                  <div className="pt-3 border-t border-black/10">
                    <p className="text-xs text-black opacity-80 whitespace-pre-wrap">{prop.content}</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="font-black text-black">£{prop.totalAmount?.toFixed(2) || '0.00'}</span>
                      {prop.status === 'draft' && (
                        <button 
                          onClick={async () => {
                            await updateDoc(doc(db, "proposals", prop.id), { status: "accepted" });
                            await addDoc(collection(db, "projects"), {
                              title: prop.title,
                              clientId: prop.clientId,
                              managerId: user?.uid,
                              status: "active",
                              createdAt: serverTimestamp(),
                              totalTasks: 0,
                              completedTasks: 0,
                              loggedHours: 0
                            });
                          }}
                          className="text-[10px] font-bold text-white bg-black px-3 py-1.5 rounded-lg border border-white/20 hover:bg-slate-800 transition"
                        >
                          Mark as Accepted
                        </button>
                      )}
                    </div>
                  </div>
               </div>
            ))}
         </div>
      )}
    </div>
  );
}

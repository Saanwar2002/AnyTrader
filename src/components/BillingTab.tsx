import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { db, collection, query, where, onSnapshot } from "@/src/firebase";
import { motion } from "motion/react";
import { PoundSterling, Receipt, CreditCard, ChevronRight, ArrowUpRight, ArrowDownRight, Wallet, Loader2 } from "lucide-react";
import { cn } from "@/src/lib/utils";

export default function BillingTab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rides, setRides] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "ride_requests"),
      where("riderId", "==", user.uid),
      where("status", "==", "completed")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRides(data);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  const totalSpent = rides.reduce((acc, r) => acc + (parseFloat(r.totalFare) || 0), 0);

  if (loading) {
     return (
       <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh]">
         <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
       </div>
     );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-surface pb-24">
      {/* Header */}
      <div className="bg-card px-4 py-8 border-b border-border-main text-center space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">Total Balance Spent</p>
        <h1 className="text-5xl font-black tracking-tighter text-text-main">
          £{totalSpent.toFixed(2)}
        </h1>
        <div className="flex items-center justify-center gap-4 mt-4">
           <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span className="text-xs font-black">£{(totalSpent * 0.8).toFixed(2)} Driver</span>
           </div>
           <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
              <ArrowDownRight className="w-3.5 h-3.5" />
              <span className="text-xs font-black">£{(totalSpent * 0.2).toFixed(2)} Priority</span>
           </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Payment Methods */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-sm font-black uppercase tracking-widest text-text-muted">Payment Methods</h2>
            <button className="text-[10px] font-black text-primary uppercase">Manage</button>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div className="p-4 bg-card rounded-3xl border border-border-main flex items-center gap-4 shadow-sm">
               <div className="w-12 h-12 bg-text-main rounded-xl flex items-center justify-center text-surface shrink-0">
                  <CreditCard className="w-6 h-6" />
               </div>
               <div className="flex-1">
                  <p className="text-sm font-black text-text-main">Digital Wallet</p>
                  <p className="text-xs font-medium text-text-muted">Apple Pay / GPay / Cards</p>
               </div>
               <div className="w-6 h-6 bg-trust rounded-full flex items-center justify-center text-white">
                  <Receipt className="w-3.5 h-3.5" />
               </div>
            </div>
          </div>
        </section>

        {/* Recent Transactions */}
        <section className="space-y-3">
          <h2 className="text-sm font-black uppercase tracking-widest text-text-muted px-2">Recent Transactions</h2>
          <div className="space-y-2">
            {rides.length === 0 ? (
              <div className="p-12 text-center bg-card rounded-3xl border border-border-main">
                <Wallet className="w-12 h-12 text-border-main mx-auto mb-3" />
                <p className="text-text-muted font-bold">No transactions found</p>
              </div>
            ) : (
              rides.map((ride, idx) => (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={ride.id}
                  className="p-4 bg-card rounded-2xl border border-border-main flex items-center gap-4 hover:shadow-md transition-shadow group"
                >
                  <div className="w-10 h-10 bg-surface rounded-xl flex items-center justify-center shrink-0">
                    <Receipt className="w-5 h-5 text-text-muted" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-bold text-text-main truncate">{ride.pickup || 'Ride'}</p>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                       {ride.createdAt?.toDate ? new Date(ride.createdAt.toDate()).toLocaleDateString() : 'Recent'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-text-main">£{(parseFloat(ride.totalFare) || 0).toFixed(2)}</p>
                    <div className="flex items-center gap-1 justify-end">
                       <div className="w-1.5 h-1.5 rounded-full bg-trust" />
                       <span className="text-[9px] font-black text-trust uppercase">Paid</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-border-main group-hover:text-primary transition-colors" />
                </motion.div>
              ))
            )}
          </div>
        </section>

        <button className="w-full py-4 bg-text-main text-surface rounded-2xl font-black text-sm hover:opacity-90 transition-opacity">
          Download Annual Statement (PDF)
        </button>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { db, collection, query, where, onSnapshot, addDoc, handleFirestoreError, OperationType } from "@/src/firebase";
import { useAuth } from "./AuthProvider";
import { shareToWhatsApp, copyPrivacyShareLink } from "@/src/utils/shareUtils";
import { PoundSterling, TrendingUp, FileText, Plus, Share2, CheckCircle2, Clock, Calculator, ShieldCheck, Download, AlertCircle, Award } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

export function FinancialDashboardWidget() {
  const { user, profile } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);

  // Form state
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [items, setItems] = useState<{ description: string; amount: number }[]>([
    { description: "Labour & Trade Services", amount: 250 },
    { description: "Materials & Supplies", amount: 75 }
  ]);
  const [vatRate, setVatRate] = useState<number>(20); // 20% UK VAT rate or 0% for non-VAT registered
  const [isVatRegistered, setIsVatRegistered] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "invoices"), where("traderId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const invs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInvoices(invs);
      setLoading(false);
    }, (err) => {
      console.error("Invoices load error:", err);
      setLoading(false);
    });
    return unsubscribe;
  }, [user]);

  const handleAddItem = () => {
    setItems([...items, { description: "", amount: 0 }]);
  };

  const handleItemChange = (index: number, field: "description" | "amount", value: any) => {
    const updated = [...items];
    if (field === "amount") {
      updated[index].amount = parseFloat(value) || 0;
    } else {
      updated[index].description = value;
    }
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Subtotal & VAT Calculations
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const vatAmount = isVatRegistered ? (subtotal * vatRate) / 100 : 0;
  const totalAmount = subtotal + vatAmount;

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!clientName.trim() || !jobTitle.trim() || totalAmount <= 0) {
      toast.error("Please fill in client details and invoice amount");
      return;
    }

    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, "invoices"), {
        traderId: user.uid,
        traderName: profile?.displayName || "TradeOS Specialist",
        clientName: clientName.trim(),
        clientAddress: clientAddress.trim(),
        title: jobTitle.trim(),
        items,
        subtotal,
        vatAmount,
        vatRate: isVatRegistered ? vatRate : 0,
        amount: totalAmount,
        status: "unpaid", // 'paid' | 'unpaid' | 'overdue'
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 14-day payment term
        createdAt: new Date().toISOString()
      });

      toast.success("Invoice created successfully!");
      setShowCreateInvoice(false);
      setClientName("");
      setClientAddress("");
      setJobTitle("");

      // Trigger WhatsApp share offer
      shareToWhatsApp({
        type: "invoice",
        id: docRef.id,
        title: jobTitle.trim(),
        amount: totalAmount
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "invoices");
      toast.error("Failed to create invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate Cashflow Analytics
  const totalEarned = invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const pendingInvoices = invoices.filter(i => i.status === "unpaid").reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  // UK Self-Assessment Tax Estimation (Rough guide for UK Sole Traders)
  const estimatedTaxableProfit = Math.max(0, totalEarned * 0.75); // Assume 25% average allowable trade expense deduction
  const personalAllowance = 12570;
  const taxableAboveAllowance = Math.max(0, estimatedTaxableProfit - personalAllowance);
  const estimatedTaxAndNI = Math.round(taxableAboveAllowance * 0.28); // 20% Income Tax + Class 4 NI approx

  return (
    <div className="space-y-4">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-slate-900 text-white rounded-3xl border border-black shadow-md flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400">Paid Invoices (Earned)</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">£{totalEarned.toLocaleString('en-GB')}</p>
          </div>
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
            <PoundSterling className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-white text-slate-900 rounded-3xl border border-black shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase text-slate-500">Outstanding Invoices</p>
            <p className="text-2xl font-black text-amber-600 mt-1">£{pendingInvoices.toLocaleString('en-GB')}</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-200">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-purple-50 text-purple-950 rounded-3xl border border-purple-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase text-purple-700">Est. Tax & NI Reserve</p>
            <p className="text-2xl font-black text-purple-900 mt-1">£{estimatedTaxAndNI.toLocaleString('en-GB')}</p>
          </div>
          <div className="p-3 bg-purple-200/60 text-purple-800 rounded-2xl">
            <Calculator className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Invoice Management Header & Action */}
      <div className="p-5 bg-white rounded-3xl border border-black shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-extrabold text-slate-900 text-base">TradeOS Invoicing & Cash Flow Engine</h4>
            <p className="text-xs text-slate-500">Create instant quotes & invoices with Strategy 1 WhatsApp links</p>
          </div>
          <button
            onClick={() => setShowCreateInvoice(true)}
            className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl border border-black shadow-md flex items-center gap-1.5 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Create Invoice
          </button>
        </div>

        {/* Invoice List */}
        {loading ? (
          <p className="text-xs text-slate-400 py-4 text-center">Loading invoices...</p>
        ) : invoices.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl border border-black">
            No invoices created yet. Click "Create Invoice" above to generate your first trade invoice.
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {invoices.map((inv) => (
              <div key={inv.id} className="p-3.5 bg-slate-50 rounded-2xl border border-black flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-extrabold text-slate-900">{inv.title}</p>
                  <p className="text-[10px] text-slate-500">Client: {inv.clientName} • Due: {inv.dueDate || '14 Days'}</p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-black text-slate-900 text-sm">£{Number(inv.amount).toLocaleString('en-GB')}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    inv.status === "paid" ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-amber-100 text-amber-800 border border-amber-300"
                  }`}>
                    {inv.status}
                  </span>
                  <button
                    onClick={() => shareToWhatsApp({ type: "invoice", id: inv.id, title: inv.title, amount: inv.amount })}
                    className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition"
                    title="Share via WhatsApp"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Invoice Modal */}
      <AnimatePresence>
        {showCreateInvoice && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-white rounded-3xl border border-black shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 bg-slate-900 text-white shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400 shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-sm sm:text-base text-white truncate">
                      Create Instant Trade Invoice
                    </h3>
                    <p className="text-[10px] text-slate-300 truncate">Professional invoice & Strategy 1 WhatsApp link</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateInvoice(false)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition shrink-0 ml-2 cursor-pointer"
                  title="Close modal"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body & Form */}
              <form onSubmit={handleCreateInvoice} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
                  <div>
                    <label className="text-[10px] font-extrabold uppercase text-slate-600 block mb-1">
                      Job / Service Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Boiler Servicing & Powerflush"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      className="w-full p-2.5 sm:p-3 rounded-xl border border-black text-xs font-bold bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 placeholder:text-slate-400"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <label className="text-[10px] font-extrabold uppercase text-slate-600 block mb-1">
                        Client Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="John Smith"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="w-full p-2.5 sm:p-3 rounded-xl border border-black text-xs font-bold bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 placeholder:text-slate-400"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="text-[10px] font-extrabold uppercase text-slate-600 block mb-1">
                        Client Address / Postcode
                      </label>
                      <input
                        type="text"
                        placeholder="SW1A 1AA / 12 High St"
                        value={clientAddress}
                        onChange={(e) => setClientAddress(e.target.value)}
                        className="w-full p-2.5 sm:p-3 rounded-xl border border-black text-xs font-medium bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-extrabold uppercase text-slate-600">Line Items & Labour</label>
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="text-xs text-blue-600 hover:text-blue-700 font-extrabold flex items-center gap-1 hover:underline active:scale-95 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Item
                      </button>
                    </div>

                    <div className="space-y-2">
                      {items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 min-w-0">
                          <input
                            type="text"
                            placeholder="Description"
                            value={item.description}
                            onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                            className="flex-1 min-w-0 p-2.5 rounded-xl border border-black text-xs font-medium bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                          />
                          <div className="relative w-24 sm:w-28 shrink-0">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-500">£</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={item.amount === 0 && !item.description ? "" : item.amount}
                              onChange={(e) => handleItemChange(idx, "amount", e.target.value)}
                              className="w-full pl-6 pr-2.5 py-2.5 rounded-xl border border-black text-xs font-bold bg-white text-right focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                            />
                          </div>
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="w-8 h-8 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center shrink-0 border border-red-200 transition active:scale-95 cursor-pointer"
                              title="Remove item"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* VAT Toggle */}
                  <div className="p-3 bg-slate-50 border border-black rounded-2xl flex items-center justify-between gap-3">
                    <label className="text-xs font-extrabold text-slate-900 flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isVatRegistered}
                        onChange={(e) => setIsVatRegistered(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-black focus:ring-blue-500"
                      />
                      <span>Include UK VAT (20%)</span>
                    </label>
                    {isVatRegistered && (
                      <span className="text-xs font-black text-blue-600 whitespace-nowrap">
                        +£{vatAmount.toFixed(2)} VAT
                      </span>
                    )}
                  </div>

                  {/* Total Amount Summary */}
                  <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-center justify-between">
                    <div className="min-w-0">
                      <span className="text-xs font-black text-blue-950 block">Total Invoice Amount</span>
                      <span className="text-[10px] text-blue-700 font-bold">
                        Subtotal: £{subtotal.toFixed(2)} {isVatRegistered ? `+ £${vatAmount.toFixed(2)} VAT` : '(No VAT)'}
                      </span>
                    </div>
                    <span className="text-xl sm:text-2xl font-black text-blue-950 shrink-0 ml-2">£{totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Sticky Action Footer */}
                <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 shrink-0">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-extrabold text-xs sm:text-sm rounded-xl border border-black shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>{isSubmitting ? "Generating..." : "Generate & Share via WhatsApp"}</span>
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

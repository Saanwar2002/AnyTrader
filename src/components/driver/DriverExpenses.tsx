import React, { useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Plus,
  Car,
  ShieldAlert,
  Wrench,
  Receipt,
  FileText,
  Download,
  Camera,
  X,
  CreditCard,
  Lock,
  Unlock,
  Check,
  CalendarDays,
  ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import { db, collection, query, where, orderBy, getDocs, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from "@/src/firebase";
import { useAuth } from "../AuthProvider";
import { toast } from "sonner";

const CATEGORY_COLORS: Record<string, string> = {
  Fuel: "#3B82F6",
  Maintenance: "#F59E0B",
  Insurance: "#10B981",
  Tolls: "#06B6D4",
  Other: "#8B5CF6",
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Fuel: <span className="text-[#3B82F6]">⛽</span>,
  Maintenance: <Wrench className="w-5 h-5 text-[#F59E0B]" />,
  Insurance: <ShieldAlert className="w-5 h-5 text-[#10B981]" />,
  Tolls: <Car className="w-5 h-5 text-[#06B6D4]" />,
  Other: <Receipt className="w-5 h-5 text-[#8B5CF6]" />,
};

type ExpensePeriod = "monthly" | "yearly";

const MONTHS = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

export default function DriverExpenses({ onClose }: { onClose?: () => void }) {
  const { user, profile } = useAuth();
  const [filterMonth, setFilterMonth] = useState<number | 'all'>(new Date().getMonth());
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [showAllExpenses, setShowAllExpenses] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Stats
  const [totalSpend, setTotalSpend] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);

  // Pro Subscription status
  const isPro = profile?.proFeaturesEnabled === true;
  const autoTrackedMileage = profile?.totalBusinessMileage || 0;
  const mileageDeductible = autoTrackedMileage * 0.45; // 45p per mile

  // Add Expense form state
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Fuel");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptImageStr, setReceiptImageStr] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const openAddExpense = () => {
    setEditingExpenseId(null);
    setShowDeleteConfirm(false);
    setAmount("");
    setCategory("Fuel");
    setDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setReceiptImageStr(null);
    setShowAddExpense(true);
  };

  const openEditExpense = (exp: any) => {
    setEditingExpenseId(exp.id);
    setShowDeleteConfirm(false);
    setAmount(exp.amount.toString());

    setCategory(exp.category);
    setDate(exp.date);
    setNotes(exp.notes || "");
    setReceiptImageStr(exp.receiptImage || null);
    setShowAddExpense(true);
  };

  useEffect(() => {
    if (!user) return;
    fetchExpenses();
  }, [user, filterMonth, filterYear]);

  const fetchExpenses = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "driver_expenses"),
        where("driverId", "==", user.uid),
        orderBy("date", "desc")
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter locally for simplicity
      const filtered = data.filter((exp: any) => {
        const expDate = new Date(exp.date);
        const matchYear = expDate.getFullYear() === filterYear;
        const matchMonth = filterMonth === 'all' ? true : expDate.getMonth() === filterMonth;
        return matchYear && matchMonth;
      });

      setExpenses(filtered);

      let total = 0;
      const cats: Record<string, number> = { Fuel: 0, Maintenance: 0, Insurance: 0, Tolls: 0, Other: 0 };
      
      filtered.forEach((exp: any) => {
        const amt = Number(exp.amount) || 0;
        total += amt;
        if (cats[exp.category] !== undefined) {
          cats[exp.category] += amt;
        } else {
          cats.Other += amt;
        }
      });
      
      setTotalSpend(total);
      
      const chartMap = Object.entries(cats).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
      setChartData(chartMap);
    } catch (err) {
      console.error("Failed to fetch expenses:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePro = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        proFeaturesEnabled: !isPro,
        proValidUntil: !isPro ? serverTimestamp() : null // In real app, integrate via Stripe
      });
      toast.success(isPro ? "Pro features disabled" : "Pro features enabled");
      setShowProModal(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status");
    }
  };

  // Image Compressions
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
       toast.error("Image too large. Max 5MB");
       return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        // max width/height
        const MAX_DIM = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height *= MAX_DIM / width;
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width *= MAX_DIM / height;
            height = MAX_DIM;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        // compress
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        setReceiptImageStr(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveExpense = async () => {
    if (!user || !amount || isNaN(Number(amount))) {
       toast.error("Please enter a valid amount");
       return;
    }
    
    setIsSubmitting(true);
    try {
       if (editingExpenseId) {
         await updateDoc(doc(db, "driver_expenses", editingExpenseId), {
           amount: Number(amount),
           category,
           date,
           notes,
           receiptImage: receiptImageStr,
         });
         toast.success("Expense updated");
       } else {
         await addDoc(collection(db, "driver_expenses"), {
            driverId: user.uid,
            amount: Number(amount),
            category,
            date,
            notes,
            receiptImage: receiptImageStr,
            createdAt: serverTimestamp()
         });
         toast.success("Expense added");
       }
       setShowAddExpense(false);
       fetchExpenses();
    } catch (err) {
       console.error("Error saving expense:", err);
       toast.error("Failed to save expense");
    } finally {
       setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!editingExpenseId) return;

    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    setIsSubmitting(true);
    try {
       await deleteDoc(doc(db, "driver_expenses", editingExpenseId));
       toast.success("Expense deleted");
       setShowAddExpense(false);
       setShowDeleteConfirm(false);
       fetchExpenses();
    } catch (err) {
       console.error("Error deleting expense:", err);
       toast.error("Failed to delete expense");
    } finally {
       setIsSubmitting(false);
    }
  };

  const handleDownloadReport = () => {
    if (!isPro) {
      setShowProModal(true);
      return;
    }
    // Generate simple CSV
    try {
      const rows = [
        ["Date", "Category", "Amount", "Notes"],
        ...expenses.map(e => [
          e.date,
          e.category,
          e.amount,
          `"${e.notes?.replace(/"/g, '""') || ""}"`
        ])
      ];
      
      const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      const monthStr = filterMonth === 'all' ? 'AllYear' : String(filterMonth + 1).padStart(2, '0');
      link.setAttribute("download", `Expenses_${filterYear}_${monthStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Report downloaded");
    } catch (err) {
      toast.error("Failed to generate report");
    }
  };

  return (
    <div className="space-y-6 pb-6">
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
           <div className="relative">
             <select 
               value={filterMonth} 
               onChange={(e) => setFilterMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
               className="appearance-none bg-[#1A1A1E] border border-[#2C2C30] rounded-full pl-3 pr-8 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-[#3B82F6]"
             >
               <option value="all">All Year</option>
               {MONTHS.map((m, i) => (
                 <option key={i} value={i}>{m}</option>
               ))}
             </select>
             <ChevronDown className="w-3.5 h-3.5 text-[#A1A1AA] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
           </div>

           <div className="relative">
             <select 
               value={filterYear} 
               onChange={(e) => setFilterYear(Number(e.target.value))}
               className="appearance-none bg-[#1A1A1E] border border-[#2C2C30] rounded-full pl-3 pr-8 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-[#3B82F6]"
             >
               {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                 <option key={y} value={y}>{y}</option>
               ))}
             </select>
             <ChevronDown className="w-3.5 h-3.5 text-[#A1A1AA] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
           </div>
        </div>
        
        <button 
          onClick={handleDownloadReport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1A1A1E] hover:bg-[#252529] border border-[#2C2C30] text-[#A1A1AA] hover:text-white transition-colors shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">CSV</span>
        </button>
      </div>

      {/* Main Expense Stats View */}
      <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-3xl p-5 relative overflow-hidden">
        {/* Decorative Blur */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#3B82F6]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="mb-6 flex justify-between items-start">
           <div>
              <p className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider mb-1">
                {filterMonth === 'all' 
                  ? `Tax Year ${filterYear}` 
                  : `${MONTHS[filterMonth as number]} ${filterYear}`} Spent
              </p>
              <h2 className="text-4xl font-black text-white">
                £{totalSpend.toFixed(2)}
              </h2>
           </div>
           
           <button
             onClick={openAddExpense}
             className="w-10 h-10 rounded-full flex items-center justify-center bg-[#3B82F6] hover:bg-[#2563EB] text-white shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all"
           >
             <Plus className="w-5 h-5" />
           </button>
        </div>

        {/* Categories Chart */}
        {totalSpend > 0 ? (
          <div className="flex flex-col items-center mb-6">
            <div className="w-[180px] h-[180px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1A1A1E', borderColor: '#2C2C30', borderRadius: '12px' }}
                    itemStyle={{ color: 'white', fontWeight: 'bold' }}
                    formatter={(value: number) => [`£${value.toFixed(2)}`, 'Spend']}
                  />
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name] || CATEGORY_COLORS.Other} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] text-[#A1A1AA] font-bold uppercase">Total</span>
                <span className="text-sm font-black text-white">£{totalSpend.toFixed(0)}</span>
              </div>
            </div>
            
            <div className="w-full grid grid-cols-2 lg:grid-cols-4 gap-2 mt-4">
               {["Fuel", "Maintenance", "Insurance", "Other"].map(cat => {
                 const amnt = chartData.find(d => d.name === cat)?.value || 0;
                 return (
                   <div key={cat} className="flex flex-col p-2 bg-[#252529] rounded-xl border border-[#2C2C30]" style={{ borderColor: `${CATEGORY_COLORS[cat]}40` }}>
                      <div className="flex items-center gap-1.5 mb-1 text-[10px] text-[#E4E4E7] font-bold uppercase">
                          {CATEGORY_ICONS[cat]}
                          <span>{cat}</span>
                      </div>
                      <span className="text-sm font-black text-white">£{amnt.toFixed(2)}</span>
                   </div>
                 )
               })}
            </div>
          </div>
        ) : (
          <div className="py-12 bg-[#252529] rounded-2xl border border-dashed border-[#2C2C30] flex flex-col items-center justify-center text-center">
            <Receipt className="w-10 h-10 text-[#404040] mb-3" />
            <p className="text-sm text-[#E4E4E7] font-bold">No expenses found</p>
            <p className="text-xs text-[#A1A1AA] font-medium mt-1 mb-4">Add your expenses to start tracking.</p>
            <button
             onClick={openAddExpense}
             className="px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-bold rounded-full transition-colors"
           >
             Add Expense
           </button>
          </div>
        )}
      </div>
      
      {/* Auto-Tracked Mileage Card (Pro Feature) */}
      <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-3xl p-5 relative overflow-hidden">
         <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
               <Car className="w-5 h-5 text-[#00D26A]" />
               <h3 className="text-base font-black text-white tracking-tight">Auto-Tracked Mileage</h3>
            </div>
            {!isPro && (
               <button onClick={() => setShowProModal(true)} className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 text-amber-500 rounded text-[9px] font-black uppercase tracking-widest border border-amber-500/20">
                 <Lock className="w-2.5 h-2.5" /> Pro
               </button>
            )}
         </div>
         
         <div className={cn("transition-opacity", !isPro && "opacity-50 blur-[2px] pointer-events-none select-none")}>
            <div className="flex items-end justify-between border-b border-[#2C2C30] pb-3 mb-3">
               <div>
                 <p className="text-[#E4E4E7] font-bold">Total Miles: <span className="text-xl font-black">{autoTrackedMileage.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span></p>
                 <p className="text-[10px] text-[#A1A1AA] uppercase mt-0.5">HMRC Rate: 45p/mile (first 10k miles)</p>
               </div>
               <div className="text-right">
                  <p className="text-[#A1A1AA] font-bold text-xs uppercase mb-1">Deductible</p>
                  <p className="text-xl font-black text-[#00D26A]">£{mileageDeductible.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
               </div>
            </div>
            <p className="text-[10px] text-[#A1A1AA] leading-relaxed">
              Business mileage is automatically calculated while you are on an active job, navigating to pickup or dropoff.
            </p>
         </div>
      </div>

      {/* Pro Features Banner */}
      {!isPro && (
        <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/5 border border-amber-500/30 rounded-3xl p-5">
           <h3 className="text-base font-black text-amber-500 mb-2 flex items-center gap-2">
             <Unlock className="w-4 h-4" />
             Unlock Pro Tax Features
           </h3>
           <p className="text-sm text-[#E4E4E7] font-medium mb-4">
             Get full access to auto-mileage tracking, unlimited receipt uploads, and HMRC-ready CSV/PDF reports.
           </p>
           <button
             onClick={() => setShowProModal(true)}
             className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-black font-black uppercase tracking-widest rounded-full transition-colors text-xs"
           >
             Upgrade for £10 / Year
           </button>
        </div>
      )}

      {/* Recent Expenses List */}
      <div>
         <div className="flex items-center justify-between mb-3 px-2">
            <h3 className="text-[11px] font-black text-[#A1A1AA] uppercase tracking-widest">Recent Expenses</h3>
            {expenses.length > 4 && (
              <button 
                onClick={() => setShowAllExpenses(!showAllExpenses)} 
                className="text-[11px] font-bold text-[#3B82F6] uppercase tracking-widest flex items-center gap-1"
              >
                 {showAllExpenses ? "Show Less" : "See All"}
                 <ChevronDown className={cn("w-3 h-3 transition-transform", showAllExpenses && "rotate-180")} />
              </button>
            )}
         </div>
         {expenses.length === 0 && (
            <p className="text-xs text-[#A1A1AA] px-2">No expenses added yet.</p>
         )}
         <div className="space-y-2">
           {expenses.slice(0, showAllExpenses ? expenses.length : 4).map((exp) => (
             <div key={exp.id} onClick={() => openEditExpense(exp)} className="bg-[#1A1A1E] border border-[#2C2C30] rounded-2xl p-3 flex items-center gap-3 cursor-pointer hover:bg-[#252529] active:scale-[0.98] transition-all">
                <div className="w-10 h-10 rounded-xl bg-[#252529] flex items-center justify-center shrink-0" style={{ color: CATEGORY_COLORS[exp.category] || CATEGORY_COLORS.Other }}>
                   {CATEGORY_ICONS[exp.category] || CATEGORY_ICONS.Other}
                </div>
                <div className="flex-1 min-w-0">
                   <p className="text-sm font-bold text-white truncate">{exp.notes || exp.category}</p>
                   <p className="text-[10px] font-bold text-[#A1A1AA] uppercase truncate">
                     {new Date(exp.date).toLocaleDateString("en-GB", { day: 'numeric', month: 'short' })} • {exp.category}
                   </p>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                   <p className="text-sm font-black text-white">£{Number(exp.amount).toFixed(2)}</p>
                   {exp.receiptImage && (
                     <div className="w-6 h-6 border border-[#2C2C30] rounded bg-cover bg-center shrink-0" style={{ backgroundImage: `url(${exp.receiptImage})` }} />
                   )}
                </div>
             </div>
           ))}
         </div>
      </div>

      {/* --- ADD EXPENSE MODAL --- */}
      <AnimatePresence>
        {showAddExpense && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-0 z-[250] bg-[#000000] overflow-y-auto min-h-screen flex flex-col pointer-events-auto"
          >
            <div className="flex items-center justify-between px-4 py-4 bg-[#121212] border-b border-white/5 sticky top-0 z-10 shrink-0">
               <button onClick={() => setShowAddExpense(false)} className="text-[#0a84ff] text-lg font-normal w-16 text-left">Cancel</button>
               <h2 className="text-lg font-semibold text-white">{editingExpenseId ? "Edit Expense" : "Add Expense"}</h2>
               <button onClick={handleSaveExpense} disabled={isSubmitting || !amount} className="text-[#34c759] text-lg font-semibold disabled:opacity-50 w-16 text-right">Save</button>
            </div>

            <div className="p-4 space-y-4 pb-12 flex-grow">
               {/* Amount Input */}
               <div className="bg-[#1c1c1e] rounded-2xl py-12 flex items-center justify-center relative">
                  <div className="text-6xl font-normal text-white flex items-center justify-center">
                     £
                     <input 
                       type="text"
                       inputMode="decimal"
                       value={amount}
                       onChange={(e) => {
                         const val = e.target.value.replace(/[^0-9.]/g, '');
                         if (val.split('.').length > 2) return;
                         setAmount(val);
                       }}
                       placeholder="0.00"
                       className="bg-transparent text-white focus:outline-none text-6xl leading-none font-normal tracking-tight placeholder:text-white/50 p-0 m-0 text-left caret-[#0a84ff] border-none"
                       autoFocus
                       style={{ width: `${Math.max(4, amount.length)}ch` }}
                     />
                  </div>
               </div>

               {/* Category Selection */}
               <div className="flex overflow-x-auto gap-2 pb-5 pt-2 px-1 no-scrollbar">
                  {["Fuel", "Maintenance", "Insurance", "Tolls", "Other"].map(cat => {
                     let colorClass = "text-[#8e8e93] border-[#8e8e93]";
                     if (cat === "Fuel") colorClass = "text-[#0a84ff] border-[#0a84ff]";
                     else if (cat === "Maintenance") colorClass = "text-[#ff9f0a] border-[#ff9f0a]";
                     else if (cat === "Insurance") colorClass = "text-[#30d158] border-[#30d158]";
                     else if (cat === "Tolls") colorClass = "text-[#64d2ff] border-[#64d2ff]";

                     const isActive = category === cat;

                     return (
                      <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={cn(
                          "px-4 py-1.5 rounded-full text-sm font-medium border shrink-0 whitespace-nowrap transition-all duration-300",
                          isActive ? colorClass : "text-[#8e8e93]/80 border-white/10 bg-white/5",
                          isActive ? "opacity-100 scale-105 shadow-sm" : "opacity-80 hover:opacity-100"
                        )}
                        style={isActive ? { 
                            backgroundColor: colorClass.includes('text-[#0a84ff]') ? '#0a84ff33' : 
                                             colorClass.includes('text-[#ff9f0a]') ? '#ff9f0a33' : 
                                             colorClass.includes('text-[#30d158]') ? '#30d15833' : 
                                             colorClass.includes('text-[#64d2ff]') ? '#64d2ff33' : '#8e8e9333',
                            boxShadow: `0 0 12px ${
                                             colorClass.includes('text-[#0a84ff]') ? '#0a84ff30' : 
                                             colorClass.includes('text-[#ff9f0a]') ? '#ff9f0a30' : 
                                             colorClass.includes('text-[#30d158]') ? '#30d15830' : 
                                             colorClass.includes('text-[#64d2ff]') ? '#64d2ff30' : '#8e8e9330'
                            }`
                         } : {}}
                      >
                        {cat === "Maintenance" ? "Repairs" : cat}
                      </button>
                   );
                  })}
               </div>

               {/* Date & Note */}
               <div className="bg-[#1c1c1e] rounded-xl flex items-center justify-between px-4 py-4 relative">
                  <span className="text-lg text-white">Date</span>
                  <div className="flex items-center space-x-2 text-[#8e8e93] relative">
                    <span className="text-lg pointer-events-none">
                      {new Date(date).toLocaleDateString("en-GB", { day: 'numeric', month: 'short' })}
                    </span>
                    <ChevronDown className="w-5 h-5 opacity-50 -rotate-90 pointer-events-none" />
                    <input 
                      type="date" 
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </div>
               </div>
               
               <div className="space-y-2">
                  <label className="block text-white text-lg px-1">Description</label>
                  <div className="bg-[#1c1c1e] rounded-xl px-4 py-4">
                     <input 
                       type="text"
                       value={notes}
                       onChange={(e) => setNotes(e.target.value)}
                       placeholder="Add notes..."
                       className="bg-transparent text-[#8e8e93] text-lg w-full focus:outline-none focus:ring-0 placeholder:text-[#8e8e93]/50 m-0 p-0 hover:border-0 border-none"
                     />
                  </div>
               </div>

               {/* Receipt Upload */}
               <div className="bg-[#1c1c1e] rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                     <div className="text-[#0a84ff] shrink-0">
                        <Camera className="h-8 w-8" strokeWidth={1.5} />
                     </div>
                     <div>
                       <p className="text-lg text-white leading-tight">Upload Receipt</p>
                       <p className="text-[#0a84ff] text-lg relative cursor-pointer active:opacity-80">
                          <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                          Snap or Upload
                       </p>
                     </div>
                  </div>
                  {receiptImageStr && (
                     <div className="w-16 h-16 rounded-lg overflow-hidden border border-white/10 shrink-0 border-solid" >
                        <img src={receiptImageStr} className="w-full h-full object-cover" alt="Receipt Thumbnail"/>
                     </div>
                  )}
               </div>

               {editingExpenseId && (
                  <div className="pt-4">
                    {showDeleteConfirm ? (
                       <div className="flex gap-2 mt-2">
                         <button 
                           onClick={() => setShowDeleteConfirm(false)} 
                           disabled={isSubmitting}
                           className="flex-1 py-3.5 bg-[#1c1c1e] rounded-xl text-white text-lg font-medium active:opacity-70 disabled:opacity-50 transition-opacity"
                         >
                            Cancel
                         </button>
                         <button 
                           onClick={handleDeleteExpense} 
                           disabled={isSubmitting}
                           className="flex-1 py-3.5 bg-[#ff453a] rounded-xl text-white text-lg font-medium active:opacity-70 disabled:opacity-50 transition-opacity"
                         >
                            Confirm Delete
                         </button>
                       </div>
                    ) : (
                      <button 
                        onClick={handleDeleteExpense} 
                        disabled={isSubmitting}
                        className="w-full mt-2 py-3.5 bg-[#1c1c1e] rounded-xl text-[#ff453a] text-lg font-medium active:opacity-70 disabled:opacity-50 transition-opacity"
                      >
                         Delete Expense
                      </button>
                    )}
                  </div>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- PRO SUBSCRIPTION MODAL --- */}
      <AnimatePresence>
        {showProModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-[#1A1A1E] border border-[#2C2C30] rounded-3xl w-full max-w-sm overflow-hidden"
            >
               <div className="bg-gradient-to-br from-amber-500/20 to-transparent p-6 pb-4 border-b border-[#2C2C30] flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-white tracking-tight leading-none mb-2">Pro Tax Features</h2>
                    <p className="text-xs text-[#A1A1AA] font-bold uppercase tracking-widest">Subscribe for £10/Year</p>
                  </div>
                  <button onClick={() => setShowProModal(false)} className="bg-[#252529] p-2 rounded-full text-[#A1A1AA]">
                     <X className="w-4 h-4" />
                  </button>
               </div>

               <div className="p-6 space-y-4">
                  {[
                    "Auto-tracked business mileage (HMRC ready)",
                    "Unlimited receipt cloud storage",
                    "Download reports in PDF & CSV",
                    "Automated tax deductions estimates"
                  ].map((feat, i) => (
                    <div key={i} className="flex gap-3 items-start">
                       <Check className="w-5 h-5 text-amber-500 shrink-0" />
                       <span className="text-sm font-medium text-[#E4E4E7]">{feat}</span>
                    </div>
                  ))}

                  <div className="pt-4 mt-4 border-t border-[#2C2C30]">
                     <button 
                       onClick={handleTogglePro}
                       className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-black font-black uppercase tracking-widest rounded-xl transition-colors flex items-center justify-center gap-2"
                     >
                        {isPro ? "Cancel Subscription" : "Pay £10.00 to Subscribe"}
                     </button>
                     <p className="text-center text-[10px] text-[#A1A1AA] mt-3">
                       Secure payment via Stripe. Auto-renews yearly. Cancel anytime.
                     </p>
                  </div>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

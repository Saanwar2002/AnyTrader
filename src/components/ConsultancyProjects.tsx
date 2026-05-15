import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { db, collection, query, where, onSnapshot, orderBy, updateDoc, doc, addDoc, deleteDoc, serverTimestamp } from "@/src/firebase";
import { FolderKanban, CheckCircle, Clock, Plus, ChevronDown, ChevronUp, Receipt, PoundSterling, Trash2, Edit2, PlayCircle, Archive, Settings, X } from "lucide-react";
import { format } from "date-fns";
import { ProMatchmakerModal } from "./shared/ProMatchmakerModal";

function ProjectRolesList({ projectId }: { projectId: string }) {
  const [roles, setRoles] = useState<any[]>([]);
  const [shortlists, setShortlists] = useState<any[]>([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleBudget, setNewRoleBudget] = useState("");
  const [newRoleDate, setNewRoleDate] = useState("");

  useEffect(() => {
    const q = query(
      collection(db, "projectRoles"),
      where("projectId", "==", projectId)
    );
    const unsub = onSnapshot(q, snap => {
      setRoles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const q2 = query(
      collection(db, "projectShortlists"),
      where("projectId", "==", projectId)
    );
    const unsub2 = onSnapshot(q2, snap => {
      setShortlists(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsub();
      unsub2();
    };
  }, [projectId]);

  const addRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    try {
      await addDoc(collection(db, "projectRoles"), {
        projectId,
        roleName: newRoleName,
        estimatedBudget: newRoleBudget ? parseFloat(newRoleBudget) : 0,
        requiredDate: newRoleDate || null,
        status: "open",
        createdAt: serverTimestamp()
      });
      setNewRoleName("");
      setNewRoleBudget("");
      setNewRoleDate("");
    } catch (err) {
      console.error(err);
    }
  };

  const [matchRole, setMatchRole] = useState<any | null>(null);

  return (
    <div className="mt-4 pt-4 border-t border-black/10 space-y-3">
      {matchRole && (
        <ProMatchmakerModal 
          role={matchRole} 
          projectId={projectId} 
          onClose={() => setMatchRole(null)} 
        />
      )}
      <h4 className="text-xs font-black uppercase text-black flex justify-between items-center">
        <span>Required Roles</span>
        <span className="text-[10px] bg-black text-white px-2 py-0.5 rounded-full">{roles.length}</span>
      </h4>
      <div className="space-y-2">
        {roles.map(r => {
          const roleShortlists = shortlists.filter(s => s.roleId === r.id);
          return (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-black/5">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-black">{r.roleName}</span>
                <div className="flex gap-2 text-xs text-black/60 font-mono mt-0.5">
                  <span>Budget: £{r.estimatedBudget || 0}</span>
                  {r.requiredDate && <span>| Date: {r.requiredDate}</span>}
                  {roleShortlists.length > 0 && <span className="text-indigo-600 font-bold">| {roleShortlists.length} Shortlisted</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] uppercase font-black px-2 py-1 rounded-md ${r.status === 'filled' ? 'bg-emerald-100 text-emerald-900' : r.status === 'bidding' ? 'bg-amber-100 text-amber-900' : 'bg-slate-200 text-slate-700'}`}>
                   {r.status}
                </span>
                <button 
                  onClick={() => setMatchRole(r)}
                  className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg hover:bg-indigo-100 border border-indigo-200">
                  Find Pros
                </button>
              </div>
            </div>
          );
        })}
        {roles.length === 0 && <p className="text-xs font-medium text-black/50 italic">No roles specified...</p>}
      </div>
      <form onSubmit={addRole} className="flex gap-2 pt-2 flex-col sm:flex-row flex-wrap">
        <input 
          value={newRoleName}
          onChange={e => setNewRoleName(e.target.value)}
          placeholder="Role (e.g. DJ, Caterer)"
          className="flex-1 text-sm p-2 rounded-xl border border-black focus:ring-1 focus:ring-black bg-white"
        />
        <div className="relative w-full sm:w-24">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-black/50 font-bold">£</span>
            <input 
              type="number"
              step="0.01"
              value={newRoleBudget}
              onChange={e => setNewRoleBudget(e.target.value)}
              placeholder="Budget"
              className="w-full pl-6 pr-2 py-2 text-sm rounded-xl border border-black focus:ring-1 focus:ring-black bg-white font-mono"
            />
        </div>
        <input 
          type="date"
          value={newRoleDate}
          onChange={e => setNewRoleDate(e.target.value)}
          className="w-full sm:w-32 p-2 text-sm rounded-xl border border-black focus:ring-1 focus:ring-black bg-white"
        />
        <button type="submit" className="p-2 bg-black text-white rounded-xl hover:bg-slate-800 transition flex items-center justify-center">
          <Plus className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

function ProjectMilestones({ projectId }: { projectId: string }) {
  const [milestones, setMilestones] = useState<any[]>([]);
  const [newTask, setNewTask] = useState("");

  useEffect(() => {
    const q = query(
      collection(db, "projectMilestones"),
      where("projectId", "==", projectId),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, snap => {
      setMilestones(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [projectId]);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    try {
      await addDoc(collection(db, "projectMilestones"), {
        projectId,
        title: newTask,
        status: "pending",
        createdAt: serverTimestamp()
      });
      setNewTask("");
    } catch (err) {
      console.error(err);
    }
  };

  const toggleTask = async (id: string, currentStatus: string) => {
    try {
      await updateDoc(doc(db, "projectMilestones", id), {
        status: currentStatus === "completed" ? "pending" : "completed"
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-black/10 space-y-3">
      <h4 className="text-xs font-black uppercase text-black">Project Milestones</h4>
      <div className="space-y-2">
        {milestones.map(m => (
          <div key={m.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-black/5">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => toggleTask(m.id, m.status)}
                className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${m.status === 'completed' ? 'bg-emerald-500 border-emerald-500' : 'border-black/20 bg-white'}`}
              >
                {m.status === "completed" && <CheckCircle className="w-3 h-3 text-white" />}
              </button>
              <span className={`text-sm font-medium ${m.status === 'completed' ? 'text-black/50 line-through' : 'text-black'}`}>{m.title}</span>
            </div>
          </div>
        ))}
        {milestones.length === 0 && <p className="text-xs font-medium text-black/50 italic">No milestones set...</p>}
      </div>
      <form onSubmit={addTask} className="flex gap-2 pt-2">
        <input 
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
          placeholder="New milestone..."
          className="flex-1 text-sm p-2 rounded-xl border border-black focus:ring-1 focus:ring-black bg-white"
        />
        <button type="submit" className="p-2 bg-black text-white rounded-xl hover:bg-slate-800 transition">
          <Plus className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

function ProjectTeam({ projectId }: { projectId: string }) {
  const [members, setMembers] = useState<any[]>([]);
  const [newRole, setNewRole] = useState("");
  const [newEmail, setNewEmail] = useState("");

  useEffect(() => {
    const q = query(
      collection(db, "teamMembers"),
      where("projectId", "==", projectId)
    );
    const unsub = onSnapshot(q, snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [projectId]);

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newRole.trim()) return;
    try {
      await addDoc(collection(db, "teamMembers"), {
        projectId,
        consultantId: newEmail, // Simulating linked user via email
        role: newRole,
        accessLevel: "read"
      });
      setNewEmail("");
      setNewRole("");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-black/10 space-y-3">
      <h4 className="text-xs font-black uppercase text-black">Project Team</h4>
      <div className="space-y-2">
        {members.map(m => (
          <div key={m.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-black/5">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-black">{m.consultantId}</span>
              <span className="text-xs text-black/60 capitalize">{m.role}</span>
            </div>
            <span className="text-[10px] uppercase font-black px-2 py-1 bg-slate-200 text-slate-700 rounded-md">
               {m.accessLevel}
            </span>
          </div>
        ))}
        {members.length === 0 && <p className="text-xs font-medium text-black/50 italic">No team members assigned...</p>}
      </div>
      <form onSubmit={addMember} className="flex gap-2 pt-2 flex-col sm:flex-row">
        <input 
          value={newEmail}
          onChange={e => setNewEmail(e.target.value)}
          placeholder="Email address..."
          type="email"
          className="flex-1 text-sm p-2 rounded-xl border border-black focus:ring-1 focus:ring-black bg-white"
        />
        <input 
          value={newRole}
          onChange={e => setNewRole(e.target.value)}
          placeholder="Role..."
          className="w-full sm:w-24 text-sm p-2 rounded-xl border border-black focus:ring-1 focus:ring-black bg-white"
        />
        <button type="submit" className="p-2 bg-black text-white rounded-xl hover:bg-slate-800 transition flex items-center justify-center">
          <Plus className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

function ProjectEventTimeline({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newStartTime, setNewStartTime] = useState("");

  useEffect(() => {
    const q = query(
      collection(db, "projectTimelineItems"),
      where("projectId", "==", projectId),
      orderBy("startTime", "asc")
    );
    const unsub = onSnapshot(q, snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [projectId]);

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newStartTime) return;
    try {
      const today = new Date();
      const [hours, minutes] = newStartTime.split(":");
      today.setHours(parseInt(hours, 10));
      today.setMinutes(parseInt(minutes, 10));
      
      await addDoc(collection(db, "projectTimelineItems"), {
        projectId,
        title: newTitle,
        startTime: today.toISOString()
      });
      setNewTitle("");
      setNewStartTime("");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-black/10 space-y-3">
      <h4 className="text-xs font-black uppercase text-black">Event Timeline</h4>
      <div className="space-y-2 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
        {items.map(item => (
          <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-300 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
              <Clock className="w-4 h-4" />
            </div>
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-3 rounded-xl border border-black/10 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-black text-sm">{item.title}</span>
              </div>
              <time className="font-mono text-xs text-amber-600 font-bold">{format(new Date(item.startTime), "HH:mm")}</time>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs font-medium text-black/50 italic text-center">No timeline events...</p>}
      </div>
      <form onSubmit={addItem} className="flex gap-2 pt-2 flex-col sm:flex-row items-center border border-black p-2 rounded-xl bg-slate-50">
        <input 
          type="time"
          value={newStartTime}
          onChange={e => setNewStartTime(e.target.value)}
          required
          className="text-sm p-2 rounded-lg border border-black focus:ring-1 focus:ring-black bg-white"
        />
        <input 
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="Timeline event..."
          required
          className="flex-1 w-full text-sm p-2 rounded-lg border border-black focus:ring-1 focus:ring-black bg-white"
        />
        <button type="submit" className="p-2 w-full sm:w-auto bg-black text-white rounded-lg hover:bg-slate-800 transition flex items-center justify-center">
          <Plus className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

function ProjectResources({ projectId }: { projectId: string }) {
  const [venues, setVenues] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  
  const [newVenueName, setNewVenueName] = useState("");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierService, setNewSupplierService] = useState("");

  useEffect(() => {
    const qVenues = query(
      collection(db, "projectVenues"),
      where("projectId", "==", projectId)
    );
    const unsubVenues = onSnapshot(qVenues, snap => {
      setVenues(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qSuppliers = query(
      collection(db, "projectSuppliers"),
      where("projectId", "==", projectId)
    );
    const unsubSuppliers = onSnapshot(qSuppliers, snap => {
      setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubVenues();
      unsubSuppliers();
    };
  }, [projectId]);

  const addVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVenueName.trim()) return;
    try {
      await addDoc(collection(db, "projectVenues"), {
        projectId,
        venueId: newVenueName, // Using name as ID for simplicity
        bookingStatus: "requested"
      });
      setNewVenueName("");
    } catch (err) {
      console.error(err);
    }
  };

  const addSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim() || !newSupplierService.trim()) return;
    try {
      await addDoc(collection(db, "projectSuppliers"), {
        projectId,
        supplierId: newSupplierName, // Using name as ID for simplicity
        serviceProvided: newSupplierService,
        cost: 0,
        status: "pending"
      });
      setNewSupplierName("");
      setNewSupplierService("");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-black/10 space-y-4">
      <div>
        <h4 className="text-xs font-black uppercase text-black mb-2">Venues</h4>
        <div className="space-y-2">
          {venues.map(v => (
            <div key={v.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-black/5">
              <span className="text-sm font-bold text-black">{v.venueId}</span>
              <span className="text-[10px] uppercase font-black px-2 py-1 bg-amber-100 text-amber-900 rounded-md">
                {v.bookingStatus}
              </span>
            </div>
          ))}
          {venues.length === 0 && <p className="text-xs font-medium text-black/50 italic">No venues assigned...</p>}
        </div>
        <form onSubmit={addVenue} className="flex gap-2 pt-2">
          <input 
            value={newVenueName}
            onChange={e => setNewVenueName(e.target.value)}
            placeholder="Venue Name..."
            className="flex-1 text-sm p-2 rounded-xl border border-black focus:ring-1 focus:ring-black bg-white"
          />
          <button type="submit" className="p-2 bg-black text-white rounded-xl hover:bg-slate-800 transition">
            <Plus className="w-4 h-4" />
          </button>
        </form>
      </div>

      <div>
        <h4 className="text-xs font-black uppercase text-black mb-2">Suppliers</h4>
        <div className="space-y-2">
          {suppliers.map(s => (
            <div key={s.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-black/5">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-black">{s.supplierId}</span>
                <span className="text-xs text-black/60 capitalize">{s.serviceProvided}</span>
              </div>
              <span className="text-[10px] uppercase font-black px-2 py-1 bg-indigo-100 text-indigo-900 rounded-md">
                {s.status}
              </span>
            </div>
          ))}
          {suppliers.length === 0 && <p className="text-xs font-medium text-black/50 italic">No suppliers assigned...</p>}
        </div>
        <form onSubmit={addSupplier} className="flex gap-2 pt-2 flex-col sm:flex-row">
          <input 
            value={newSupplierName}
            onChange={e => setNewSupplierName(e.target.value)}
            placeholder="Supplier Name..."
            className="flex-1 text-sm p-2 rounded-xl border border-black focus:ring-1 focus:ring-black bg-white"
          />
          <input 
            value={newSupplierService}
            onChange={e => setNewSupplierService(e.target.value)}
            placeholder="Service Provided..."
            className="w-full sm:w-1/3 text-sm p-2 rounded-xl border border-black focus:ring-1 focus:ring-black bg-white"
          />
          <button type="submit" className="p-2 bg-black text-white rounded-xl hover:bg-slate-800 transition flex items-center justify-center">
            <Plus className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

function ProjectFinancials({ projectId, budget = 0 }: { projectId: string; budget?: number }) {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [newExpenseCategory, setNewExpenseCategory] = useState("");

  useEffect(() => {
    const qExp = query(
      collection(db, "expenses"),
      where("projectId", "==", projectId)
    );
    const unsubExp = onSnapshot(qExp, snap => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qInv = query(
      collection(db, "invoices"),
      where("projectId", "==", projectId)
    );
    const unsubInv = onSnapshot(qInv, snap => {
      setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubExp();
      unsubInv();
    };
  }, [projectId]);

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpenseAmount.trim() || !user) return;
    try {
      await addDoc(collection(db, "expenses"), {
        projectId,
        consultantId: user.uid,
        amount: parseFloat(newExpenseAmount),
        category: newExpenseCategory || "General",
        date: new Date().toISOString(),
        status: "pending",
        createdAt: serverTimestamp()
      });
      setNewExpenseAmount("");
      setNewExpenseCategory("");
    } catch (err) {
      console.error(err);
    }
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  const netProfit = totalInvoiced - totalExpenses;
  
  const budgetSpentPct = budget > 0 ? Math.min((totalExpenses / budget) * 100, 100) : 0;

  return (
    <div className="mt-4 pt-4 border-t border-black/10 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-black uppercase text-black">Project Financials</h4>
        <div className="text-xs font-mono font-bold text-black border border-black/20 rounded-md px-2 py-0.5 bg-slate-50">
          NET: <span className={netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}>£{netProfit.toFixed(2)}</span>
        </div>
      </div>

      {budget > 0 && (
        <div className="bg-slate-50 border border-black/10 rounded-xl p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-black uppercase text-black/60">Budget Utilization</span>
            <span className="text-xs font-bold text-black font-mono">£{totalExpenses.toFixed(2)} / £{budget.toFixed(2)}</span>
          </div>
          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
            <div 
              className={`h-full ${budgetSpentPct > 90 ? 'bg-rose-500' : budgetSpentPct > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
              style={{ width: `${budgetSpentPct}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-center text-xs font-medium">
        <div className="bg-amber-50 rounded-xl p-2 border border-black/10">
          <div className="text-[10px] uppercase font-black text-amber-700 mb-0.5">Invoiced</div>
          <div className="font-mono text-black font-bold">£{totalInvoiced.toFixed(2)}</div>
        </div>
        <div className="bg-rose-50 rounded-xl p-2 border border-black/10">
          <div className="text-[10px] uppercase font-black text-rose-700 mb-0.5">Expenses</div>
          <div className="font-mono text-black font-bold">£{totalExpenses.toFixed(2)}</div>
        </div>
      </div>

      <div>
        <h5 className="text-[10px] font-black uppercase text-black/60 mb-2 mt-4">Log Expense</h5>
        <div className="space-y-2 mb-2">
          {expenses.map(ex => (
            <div key={ex.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-black/5">
              <div className="flex items-center gap-2">
                <Receipt className="w-3.5 h-3.5 text-black/40" />
                <span className="text-sm font-medium text-black capitalize">{ex.category}</span>
              </div>
              <span className="font-mono text-xs font-bold text-rose-600">
                -£{ex.amount?.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
        <form onSubmit={addExpense} className="flex gap-2">
          <input 
            value={newExpenseCategory}
            onChange={e => setNewExpenseCategory(e.target.value)}
            placeholder="Category..."
            className="flex-1 text-sm p-2 rounded-xl border border-black focus:ring-1 focus:ring-black bg-white"
          />
          <div className="relative w-1/3">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-black/50 font-bold">£</span>
            <input 
              type="number"
              step="0.01"
              required
              value={newExpenseAmount}
              onChange={e => setNewExpenseAmount(e.target.value)}
              placeholder="0.00"
              className="w-full pl-6 pr-2 py-2 text-sm rounded-xl border border-black focus:ring-1 focus:ring-black bg-white font-mono"
            />
          </div>
          <button type="submit" className="p-2 bg-black text-white rounded-xl hover:bg-slate-800 transition">
            <Plus className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

export function ConsultancyProjects({ clientId }: { clientId?: string }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBudget, setNewBudget] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "active" | "completed" | "cancelled">("all");
  const [settingsOpenId, setSettingsOpenId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    
    let q = query(
      collection(db, "projects"),
      where("managerId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    
    if (clientId) {
      q = query(
      collection(db, "projects"),
      where("managerId", "==", user.uid),
      where("clientId", "==", clientId),
      orderBy("createdAt", "desc")
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, error => {
      console.error("Error fetching projects:", error);
    });

    return () => unsubscribe();
  }, [user, clientId]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !user) return;
    try {
      await addDoc(collection(db, "projects"), {
        title: newTitle,
        managerId: user.uid,
        clientId: clientId || "unknown",
        budget: newBudget ? parseFloat(newBudget) : 0,
        status: "active",
        createdAt: serverTimestamp(),
        totalTasks: 0,
        completedTasks: 0,
        loggedHours: 0
      });
      setNewTitle("");
      setNewBudget("");
      setIsCreating(false);
    } catch (err) {
      console.error(err);
    }
  };

  const updateProjectStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "projects", id), { status: newStatus });
    } catch (err) {
       console.error("Error updating project:", err);
    }
  };

  const deleteProject = async (id: string) => {
    try {
      await deleteDoc(doc(db, "projects", id));
      setSettingsOpenId(null);
      setDeleteConfirmId(null);
    } catch (err) {
       console.error("Error deleting project:", err);
    }
  };

  const filteredProjects = projects.filter(p => {
    const status = p.status || "active";
    if (filter === "all") return status === "active" || status === "pending";
    return status === filter;
  });

  return (
    <div className="space-y-4 relative">
      <div className="flex items-center justify-between">
         <h3 className="font-bold text-black flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-indigo-500" /> Projects
         </h3>
         <button 
           onClick={() => setIsCreating(true)}
           className="bg-black text-white p-2 rounded-xl text-[12px] font-bold flex items-center gap-1 hover:bg-slate-800 transition shadow-sm"
         >
           <Plus className="w-4 h-4" /> New Project
         </button>
      </div>

      <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl w-full text-[10px] justify-between sm:justify-start">
        <button 
          onClick={() => setFilter("all")}
          className={`flex-1 sm:flex-none px-2 py-1 font-bold rounded-lg transition whitespace-nowrap text-center ${filter === "all" ? "bg-white shadow-sm border border-black/10 text-black" : "text-black/60 hover:text-black"}`}
        >
          All
        </button>
        <button 
          onClick={() => setFilter("active")}
          className={`flex-1 sm:flex-none px-2 py-1 font-bold rounded-lg transition whitespace-nowrap text-center ${filter === "active" ? "bg-white shadow-sm border border-black/10 text-black" : "text-black/60 hover:text-black"}`}
        >
          Active
        </button>
        <button 
          onClick={() => setFilter("pending")}
          className={`flex-1 sm:flex-none px-2 py-1 font-bold rounded-lg transition whitespace-nowrap text-center ${filter === "pending" ? "bg-white shadow-sm border border-black/10 text-black" : "text-black/60 hover:text-black"}`}
        >
          Pending
        </button>
        <button 
          onClick={() => setFilter("completed")}
          className={`flex-1 sm:flex-none px-2 py-1 font-bold rounded-lg transition whitespace-nowrap text-center ${filter === "completed" ? "bg-white shadow-sm border border-black/10 text-black" : "text-black/60 hover:text-black"}`}
        >
          Completed
        </button>
        <button 
          onClick={() => setFilter("cancelled")}
          className={`flex-1 sm:flex-none px-2 py-1 font-bold rounded-lg transition whitespace-nowrap text-center ${filter === "cancelled" ? "bg-white shadow-sm border border-black/10 text-black" : "text-black/60 hover:text-black"}`}
        >
          Cancelled
        </button>
      </div>

      {isCreating && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm pointer-events-auto">
          <div className="bg-white p-6 rounded-xl border border-black max-w-sm w-full relative shadow-2xl">
            <button 
              type="button" 
              onClick={() => setIsCreating(false)} 
              className="absolute top-3 right-3 p-1.5 bg-black/5 hover:bg-black/10 rounded-full text-black transition"
            >
               <X className="w-5 h-5" />
            </button>
            <div className="mb-4 text-sm font-black uppercase tracking-wider text-black">New Project</div>
            <form onSubmit={handleCreateProject} className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Project Title</label>
                <input 
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Kitchen Renovation"
                  autoFocus
                  className="w-full text-sm p-3 rounded-xl border border-black focus:ring-1 focus:ring-black bg-slate-50"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Total Budget (£)</label>
                <div className="relative w-full">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black/50 font-bold">£</span>
                  <input 
                    type="number"
                    step="0.01"
                    value={newBudget}
                    onChange={e => setNewBudget(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-3 text-sm rounded-xl border border-black focus:ring-1 focus:ring-black bg-slate-50 font-mono"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => setIsCreating(false)} className="flex-1 p-3 bg-slate-100 text-black rounded-xl hover:bg-slate-200 transition text-sm font-bold">
                  Cancel
                </button>
                <button type="submit" className="flex-1 p-3 bg-black text-white rounded-xl hover:bg-slate-800 transition text-sm font-bold">
                  Save Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {filteredProjects.length === 0 ? (
         <div className="bg-white border border-black rounded-xl p-8 text-center shadow-sm">
            <FolderKanban className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-black font-medium text-sm mb-4">No {filter === 'all' ? 'active or pending' : filter} projects found.</p>
            {(filter === "active" || filter === "all") && (
               <button 
                 onClick={() => setIsCreating(true)}
                 className="bg-black text-white px-4 py-2 rounded-xl text-sm font-bold inline-flex items-center gap-2 hover:bg-slate-800 transition"
               >
                 <Plus className="w-4 h-4" /> Start Your First Project
               </button>
            )}
         </div>
      ) : (
         <div className="space-y-3">
            {filteredProjects.map(project => (
               <div key={project.id} className="bg-white p-4 rounded-xl border border-black shadow-sm flex flex-col gap-3 group transition-all relative">
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(expandedId === project.id ? null : project.id)}>
                     <div className="flex flex-col">
                        <span className="font-bold text-black">{project.title || "Untitled Project"}</span>
                        <span className="text-xs text-black opacity-60">
                          {project.clientId !== "unknown" ? project.clientId : "Client"} • {project.createdAt ? format(project.createdAt.toDate(), "MMM dd, yyyy") : ""}
                        </span>
                     </div>
                     <div className="flex items-center gap-3">
                        <span className={`text-[10px] uppercase font-black px-2 py-1 rounded-md ${project.status === 'completed' ? 'bg-emerald-100 text-emerald-900 border border-emerald-900' : 'bg-indigo-100 text-indigo-900 border border-indigo-900'}`}>
                           {project.status || "active"}
                        </span>
                        {expandedId === project.id ? <ChevronUp className="w-4 h-4 text-black" /> : <ChevronDown className="w-4 h-4 text-black" />}
                     </div>
                  </div>
                  <div className="pt-3 border-t border-black/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-slate-400" />
                          <span className="text-xs font-bold text-black">{project.completedTasks || 0} / {project.totalTasks || 0} Tasks</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span className="text-xs font-bold text-black">{project.loggedHours || 0} hrs</span>
                        </div>
                      </div>
                      <div />
                    </div>
                    {expandedId === project.id && (
                      <div className="space-y-4 mt-4">
                        <ProjectMilestones projectId={project.id} />
                        <ProjectRolesList projectId={project.id} />
                        <ProjectTeam projectId={project.id} />
                        <ProjectResources projectId={project.id} />
                        <ProjectEventTimeline projectId={project.id} />
                        <ProjectFinancials projectId={project.id} budget={project.budget} />
                      </div>
                    )}
                  </div>
                  
                  {/* Bottom Right Settings Gear */}
                  <div className="absolute bottom-3 right-3 flex items-end">
                    <div className="relative flex flex-col items-end">
                      {settingsOpenId === project.id && (
                        <div className="mb-2 bg-white rounded-xl shadow-lg border border-black/10 p-2 min-w-[180px] z-[60] flex flex-col gap-1 origin-bottom-right animate-in zoom-in-95">
                          <select 
                            value={project.status || "active"} 
                            onChange={(e) => updateProjectStatus(project.id, e.target.value)}
                            className="text-[10px] font-bold uppercase rounded p-2 bg-slate-50 border border-black/10 outline-none w-full cursor-pointer hover:bg-slate-100 transition"
                          >
                            <option value="pending">Mark Pending</option>
                            <option value="active">Mark Active</option>
                            <option value="completed">Mark Completed</option>
                            <option value="cancelled">Mark Cancelled</option>
                          </select>
                          
                          {["completed", "cancelled"].includes(project.status) && (
                            deleteConfirmId === project.id ? (
                              <div className="flex flex-col gap-2 p-2 bg-rose-50 rounded-lg border border-rose-200 mt-2">
                                <span className="text-[10px] font-bold text-rose-800 text-center uppercase">Are you absolutely sure?</span>
                                <div className="flex flex-col gap-1 text-center">
                                   <button onClick={(e) => { e.stopPropagation(); deleteProject(project.id); }} className="w-full text-[10px] bg-rose-600 text-white py-1.5 rounded-lg font-bold hover:bg-rose-700 transition">Double Confirm Delete</button>
                                   <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }} className="w-full text-[10px] bg-slate-200 text-slate-800 py-1.5 rounded-lg font-bold hover:bg-slate-300 transition">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <button 
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(project.id); }} 
                                className="text-rose-600 hover:bg-rose-50 text-[10px] font-bold uppercase py-2 px-2 mt-1 rounded-lg transition text-left flex items-center justify-between w-full"
                              >
                                Delete Project
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )
                          )}
                        </div>
                      )}
                      
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSettingsOpenId(settingsOpenId === project.id ? null : project.id); setDeleteConfirmId(null); }}
                        className="text-slate-400 hover:text-black transition p-1.5 rounded-md hover:bg-slate-100 bg-white/80 backdrop-blur-sm border border-black/5"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
               </div>
            ))}
         </div>
      )}
    </div>
  );
}

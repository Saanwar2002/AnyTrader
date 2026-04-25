import React, { useState, useEffect } from "react";
import { Lock, UserPlus, Search, Shield } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { db } from "@/src/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

export default function AdminUsers() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Assuming admins are users with a role 'admin' or 'dispatcher'
    const q = query(
      collection(db, "users"),
      where("role", "in", ["admin", "dispatcher"])
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const adminUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAdmins(adminUsers);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Lock className="w-6 h-6 text-slate-500" />
            Admin Users & RBAC
          </h2>
          <p className="text-slate-500 font-medium">Manage dashboard access, roles, and permissions.</p>
        </div>
        <button className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-800 transition-colors shadow-sm inline-flex items-center gap-2">
          <UserPlus className="w-4 h-4" /> Add Admin
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
           <div className="relative w-full sm:w-64">
             <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
             <input type="text" placeholder="Search by name or email..." className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-500/20" />
           </div>
        </div>

        <div className="overflow-x-auto min-w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4 whitespace-nowrap">Admin User</th>
                <th className="px-6 py-4 whitespace-nowrap">Role</th>
                <th className="px-6 py-4 whitespace-nowrap">Joined Date</th>
                <th className="px-6 py-4 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={4} className="text-center py-8 text-slate-500">Loading admins...</td></tr>
              ) : admins.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-slate-500">No admins found.</td></tr>
              ) : admins.map((user, i) => {
                const dateObj = user.createdAt?.toDate ? user.createdAt.toDate() : new Date();
                const displayDate = dateObj.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
                return (
                 <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                   <td className="px-6 py-4 whitespace-nowrap">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500">
                          {user.name ? user.name.charAt(0) : '?'}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{user.name || "Unknown"}</div>
                          <div className="text-[10px] text-slate-500 font-medium">{user.email || user.id}</div>
                        </div>
                     </div>
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        "px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest flex items-center gap-1 w-fit",
                        user.role === "admin" ? "bg-rose-50 text-rose-600 border border-rose-100" :
                        "bg-slate-100 text-slate-600"
                      )}>
                        {user.role === "admin" && <Shield className="w-3 h-3" />}
                        {user.role || 'User'}
                      </span>
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-medium">
                     {displayDate}
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap text-right">
                     <button className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors">Edit Access</button>
                   </td>
                 </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

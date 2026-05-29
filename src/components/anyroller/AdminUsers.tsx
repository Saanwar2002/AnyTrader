import React, { useState } from "react";
import { 
  Lock, 
  Plus, 
  Trash2, 
  Search, 
  Save, 
  ShieldCheck, 
  Clock, 
  User,
  ShieldAlert,
  Compass
} from "lucide-react";
import { toast } from "sonner";

interface StaffAdmin {
  id: string;
  name: string;
  email: string;
  privilegeRole: "Super Admin Override" | "Support Desk Operator" | "Financial Auditor";
  activeSession: boolean;
  registeredDate: string;
}

const mockStaffSeed: StaffAdmin[] = [
  { id: "adm_101", name: "Saanwar Anwar (Author)", email: "saanwar2002@gmail.com", privilegeRole: "Super Admin Override", activeSession: true, registeredDate: "2026-05-01" },
  { id: "adm_102", name: "Jonathan Miller", email: "j.miller@anyroller.com", privilegeRole: "Support Desk Operator", activeSession: true, registeredDate: "2026-05-15" },
  { id: "adm_103", name: "Fiona Sterling", email: "fiona@anyroller.com", privilegeRole: "Financial Auditor", activeSession: false, registeredDate: "2026-05-20" }
];

export default function AdminUsers() {
  const [staff, setStaff] = useState<StaffAdmin[]>(mockStaffSeed);
  const [searchQuery, setSearchQuery] = useState("");

  // New staff form states
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"Super Admin Override" | "Support Desk Operator" | "Financial Auditor">("Support Desk Operator");

  const handleInviteStaffMember = () => {
    if (!newName.trim() || !newEmail.trim()) {
      toast.error("Please insert operator full name and contact organizational email.");
      return;
    }
    const newMember: StaffAdmin = {
      id: "adm_" + Math.floor(Math.random() * 9000 + 1000),
      name: newName,
      email: newEmail,
      privilegeRole: newRole,
      activeSession: false,
      registeredDate: new Date().toISOString().split('T')[0]
    };

    setStaff([newMember, ...staff]);
    setNewName("");
    setNewEmail("");
    toast.success(`Staff authorization invitation transmitted successfully to ${newMember.email}.`);
  };

  const handleUpdateRole = (id: string, role: any) => {
    setStaff(prev => prev.map(s => {
      if (s.id === id) {
        toast.success(`Authorized privilege group update to: ${role}`);
        return { ...s, privilegeRole: role };
      }
      return s;
    }));
  };

  const handleRemoveStaff = (id: string) => {
    setStaff(prev => prev.filter(s => s.id !== id));
    toast.info("Staff member access credentials revoked successfully.");
  };

  const filteredStaff = staff.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Intro Header HUD */}
      <div className="p-5 bg-white border border-black rounded-lg shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Lock className="w-4 h-4 text-[#AF52DE]" />
          <span className="text-[10px] uppercase font-mono tracking-widest text-[#AF52DE] font-bold">STAFF PRIVILEGE MANAGERS</span>
        </div>
        <h2 className="text-xl font-bold text-black font-sans">Admin Users & RBAC Authorization</h2>
        <p className="text-xs text-slate-500 mt-1">
          Approve operational staff memberships, monitor live administrator sessions, and limit system access using modular Role-Based Access Control thresholds.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Staff registry */}
        <div className="lg:col-span-2 bg-white border border-black rounded-lg p-5 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-slate-705" /> Command Center staff Roster
            </h3>

            {/* Filter Lookup */}
            <input 
              type="text" 
              placeholder="Find operators..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-black text-xs text-black"
            />
          </div>

          <div className="space-y-3.5">
            {filteredStaff.map(member => (
              <div key={member.id} className="p-4 bg-slate-50 border border-black rounded font-sans space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#AF52DE]">{member.id}</span>
                    <h4 className="text-sm font-extrabold text-black">{member.name}</h4>
                    <span className={`w-2 h-2 rounded-full border border-black/15 ${member.activeSession ? 'bg-emerald-500 animate-pulse' : 'bg-slate-350'}`} title={member.activeSession ? 'Active Session' : 'Offline'}></span>
                  </div>

                  <span className="text-[10.5px] text-slate-500 font-mono mt-0.5">Enrolled: {member.registeredDate}</span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-105 text-xs">
                  <div className="text-slate-500 font-mono font-bold flex items-center gap-1.5">
                    <span>Email: <strong className="text-black font-extrabold">{member.email}</strong></span>
                  </div>

                  {/* Role Select Options */}
                  <div className="flex items-center gap-2">
                    <select
                      value={member.privilegeRole}
                      onChange={(e) => handleUpdateRole(member.id, e.target.value as any)}
                      className="px-2.5 py-1.5 bg-white border border-black text-xs text-black font-sans font-medium outline-none rounded cursor-pointer"
                    >
                      <option value="Super Admin Override">Super Admin</option>
                      <option value="Support Desk Operator">Support Operator</option>
                      <option value="Financial Auditor">Financial Auditor</option>
                    </select>

                    <button
                      onClick={() => handleRemoveStaff(member.id)}
                      className="p-1 px-2.5 border border-red-500/20 text-red-655 hover:bg-rose-50 rounded transition cursor-pointer select-none"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        </div>

        {/* Invite staff operator */}
        <div className="bg-white border border-black rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-1 border-b border-slate-100 pb-2">
            <Plus className="w-4 h-4 text-emerald-555" />
            <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider">Invite command Operator</h3>
          </div>

          <div className="space-y-4 font-sans">
            <div className="space-y-1">
              <label className="text-xs font-bold text-black block">Staff Operator Full Name</label>
              <input 
                type="text" 
                placeholder="e.g. Rachel Sterling" 
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-black text-xs text-black rounded"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-black block">Organizational Email ID</label>
              <input 
                type="email" 
                placeholder="e.g. rachel@anyroller.com" 
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-black text-xs text-slate-800 rounded"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-black block">Privilege Group</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-black text-xs text-black font-sans rounded outline-none"
              >
                <option value="Super Admin Override">Super Privileged Admin</option>
                <option value="Support Desk Operator">Support Desk Operator</option>
                <option value="Financial Auditor">Financial Auditor Manager</option>
              </select>
            </div>

            <button
              onClick={handleInviteStaffMember}
              className="w-full py-2.5 bg-black hover:bg-slate-900 border border-black text-white text-xs font-mono font-black tracking-wider uppercase cursor-pointer rounded transition flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Authorized Invite
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

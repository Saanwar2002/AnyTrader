import React from "react";
import { Phone, Plus, X, Trash2, Loader2 } from "lucide-react";

interface SafetyEmergencyCardProps {
  profile: any;
  isAddingEmergency: boolean;
  setIsAddingEmergency: (val: boolean) => void;
  newEmergencyContact: { name: string; phone: string };
  setNewEmergencyContact: React.Dispatch<React.SetStateAction<{ name: string; phone: string }>>;
  handleAddEmergencyContact: () => void;
  handleRemoveEmergencyContact: (index: number) => void;
  isSaving: boolean;
}

export const SafetyEmergencyCard: React.FC<SafetyEmergencyCardProps> = ({
  profile,
  isAddingEmergency,
  setIsAddingEmergency,
  newEmergencyContact,
  setNewEmergencyContact,
  handleAddEmergencyContact,
  handleRemoveEmergencyContact,
  isSaving,
}) => {
  return (
    <div className="bg-white rounded-[2rem] border border-black shadow-md bg-gradient-to-b from-white to-slate-50/50 overflow-hidden p-5 sm:p-7 relative">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-200">
            <Phone className="w-4 h-4" />
          </div>
          <h3 className="text-base font-black text-slate-900 leading-tight">Safety & Emergency Contacts</h3>
        </div>
        {!isAddingEmergency ? (
          <button 
            onClick={() => setIsAddingEmergency(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-orange-50 text-orange-700 hover:bg-orange-100 transition-all text-[11px] font-black uppercase tracking-wider border border-orange-200 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            Add Contact
          </button>
        ) : (
          <button 
            onClick={() => setIsAddingEmergency(false)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all text-[11px] font-black uppercase tracking-wider border border-black/15 cursor-pointer"
          >
            <X className="w-3 h-3" />
            Cancel
          </button>
        )}
      </div>

      <div className="space-y-4">
        {isAddingEmergency && (
          <div className="p-4 bg-orange-50 rounded-2xl border border-orange-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input 
                type="text" 
                placeholder="Contact Name"
                className="p-2.5 bg-white border border-black rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                value={newEmergencyContact.name}
                onChange={(e) => setNewEmergencyContact({ ...newEmergencyContact, name: e.target.value })}
              />
              <input 
                type="tel" 
                placeholder="Phone Number"
                className="p-2.5 bg-white border border-black rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                value={newEmergencyContact.phone}
                onChange={(e) => setNewEmergencyContact({ ...newEmergencyContact, phone: e.target.value })}
              />
            </div>
            <button 
              onClick={handleAddEmergencyContact}
              disabled={isSaving || !newEmergencyContact.name || !newEmergencyContact.phone}
              className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Save Emergency Contact"}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {(profile.emergencyContacts || []).length === 0 ? (
            <div className="col-span-full py-6 text-center bg-slate-50 rounded-2xl border border-dashed border-black">
              <Phone className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
              <p className="text-slate-500 text-xs font-medium">No emergency contacts listed.</p>
              <p className="text-slate-400 text-[10px] mt-0.5">Add trusted contacts for emergency dispatch shared with verified drivers.</p>
            </div>
          ) : (
            profile.emergencyContacts.map((contact: any, index: number) => (
              <div key={index} className="p-3 bg-slate-50 rounded-xl border border-black flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-2xs text-orange-500 border border-black/10">
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-xs">{contact.name}</p>
                    <p className="text-[10px] text-slate-500 font-bold">{contact.phone}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleRemoveEmergencyContact(index)}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

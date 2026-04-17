import React from "react";
import { db, doc, deleteDoc } from "@/src/firebase";
import { Trash2, AlertTriangle, Calendar, MapPin, Eye, CheckCircle2 } from "lucide-react";

export default function GuestJobs({ jobs, users, showToast }: { jobs: any[], users: any[], showToast: (title: string, message: string, type?: "success" | "error") => void }) {
  const filteredGuestJobs = jobs.filter(j => {
    const homeowner = users.find(u => u.id === j.homeownerId);
    return !homeowner || homeowner.isAnonymous || !homeowner.email;
  });

  const handleDeleteAll = async () => {
    // Custom confirm logic is better for mobile than window.confirm
    if (window.confirm("Are you sure you want to delete ALL guest jobs? This cannot be undone.")) {
      try {
        for (const job of filteredGuestJobs) {
          await deleteDoc(doc(db, "jobs", job.id));
        }
        showToast("Success", "Deleted all guest jobs", "success");
      } catch (error) {
        showToast("Error", "Failed to delete jobs", "error");
      }
    }
  };

  const handleDeleteJob = async (id: string) => {
    try {
      await deleteDoc(doc(db, "jobs", id));
      showToast("Success", "Deleted job", "success");
    } catch (error) {
      showToast("Error", "Failed to delete job", "error");
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      <div className="p-4 md:p-6 bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">GUEST POSTS</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{filteredGuestJobs.length} Active Listings</p>
          </div>
          <button 
            onClick={handleDeleteAll}
            className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all active:scale-95 shadow-sm whitespace-nowrap"
          >
            <Trash2 className="w-3 h-3" />
            Delete All
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Desktop View Table */}
        <table className="w-full text-left border-collapse hidden md:table">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Listing Information</th>
              <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Location</th>
              <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Posted Date</th>
              <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/50">
            {filteredGuestJobs.map(j => (
              <tr key={j.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                      <AlertTriangle className="w-5 h-5 text-orange-400" />
                    </div>
                    <div>
                      <p className="font-black text-slate-900 text-sm group-hover:text-blue-600 transition-colors">{j.title}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{j.id}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-center">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg">
                    <MapPin className="w-3 h-3" />
                    <span className="text-[10px] font-black tracking-widest uppercase">{j.postcode || "N/A"}</span>
                  </div>
                </td>
                <td className="p-4 text-center">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 text-slate-600 rounded-lg">
                    <Calendar className="w-3 h-3" />
                    <span className="text-[10px] font-black tracking-widest uppercase">
                      {j.postedDate?.toDate().toLocaleDateString() || j.createdAt ? (j.createdAt.seconds ? new Date(j.createdAt.seconds * 1000).toLocaleDateString() : new Date(j.createdAt).toLocaleDateString()) : "N/A"}
                    </span>
                  </div>
                </td>
                <td className="p-4 text-right">
                   <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => window.open(`/job/${j.id}`, '_blank')}
                      className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteJob(j.id)}
                      className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile View Cards */}
        <div className="md:hidden divide-y divide-slate-100 bg-slate-50">
          {filteredGuestJobs.map(j => (
            <div key={j.id} className="p-5 bg-white mb-2 shadow-sm first:border-t hover:bg-slate-50 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                  <h3 className="font-black text-slate-900 text-base leading-tight tracking-tight">{j.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-widest">{j.id.slice(0, 8)}...</span>
                    <span className="text-[9px] font-black text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-widest">{j.postcode || "UK"}</span>
                  </div>
                </div>
                <div className="p-2 bg-orange-50 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                </div>
              </div>

              <div className="flex items-center gap-4 py-3 border-y border-slate-50 mb-4">
                 <div className="flex-1">
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Posted Date</p>
                    <div className="flex items-center gap-2 text-slate-700">
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="text-xs font-black">
                        {j.postedDate?.toDate().toLocaleDateString() || j.createdAt ? (j.createdAt.seconds ? new Date(j.createdAt.seconds * 1000).toLocaleDateString() : new Date(j.createdAt).toLocaleDateString()) : "N/A"}
                      </span>
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => window.open(`/job/${j.id}`, '_blank')}
                  className="py-3.5 rounded-2xl bg-slate-50 text-slate-600 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  View
                </button>
                <button 
                  onClick={() => handleDeleteJob(j.id)}
                  className="py-3.5 rounded-2xl bg-red-50 text-red-600 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          ))}
          
          {filteredGuestJobs.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-white">
              <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-10 h-10 text-slate-200" />
              </div>
              <p className="font-black text-lg text-slate-900 mb-1 tracking-tight">NO GUEST POSTS</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest transition-all">All listings are from verified accounts</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

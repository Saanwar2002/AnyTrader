import React, { useState, useEffect } from "react";
import { db, collection, query, getDocs, updateDoc, doc } from "@/src/firebase";
import { ShieldCheck, XCircle, Search, FileText, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { motion } from "motion/react";

interface PendingDoc {
  userId: string;
  userName: string;
  userEmail: string;
  type: string;
  fileUrl: string;
  status: string;
}

export default function DocumentCompliance() {
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState("");
  const [actionDoc, setActionDoc] = useState<PendingDoc | null>(null);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "users"));
      const snap = await getDocs(q);
      const docs: PendingDoc[] = [];

      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.verificationDocs && Array.isArray(data.verificationDocs)) {
          data.verificationDocs.forEach((d: any) => {
            if (d.status === "pending") {
              docs.push({
                userId: docSnap.id,
                userName: data.name || 'Unknown',
                userEmail: data.email || 'Unknown',
                type: d.type,
                fileUrl: d.fileUrl,
                status: d.status,
              });
            }
          });
        }
      });
      setPendingDocs(docs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleAction = async (docObj: PendingDoc, newStatus: "approved" | "rejected", reason?: string) => {
    try {
      const userRef = doc(db, "users", docObj.userId);
      const userSnap = await getDocs(query(collection(db, "users")));
      // Need exact user
      const userDoc = userSnap.docs.find(d => d.id === docObj.userId);
      if (!userDoc) return;
      
      const userData = userDoc.data();
      const currentDocs = userData.verificationDocs || [];
      
      const updatedDocs = currentDocs.map((d: any) => {
        if (d.type === docObj.type && d.status === "pending") {
          return {
            ...d,
            status: newStatus,
            rejectionReason: reason || null,
            expiryDate: newStatus === 'approved' ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null
          };
        }
        return d;
      });

      await updateDoc(userRef, { verificationDocs: updatedDocs });
      setActionDoc(null);
      setRejectReason("");
      fetchDocs();
    } catch (err) {
      console.error(err);
      alert("Error updating document.");
    }
  };

  const getDocName = (type: string) => {
    switch (type) {
      case 'dvla_license': return 'DVLA Driving License';
      case 'phv_license': return 'Private Hire License';
      case 'insurance': return 'Hire & Reward Insurance';
      case 'mot': return 'MOT Certificate';
      case 'logbook': return 'V5C Logbook';
      default: return type;
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto text-white font-sans">
      <div className="flex items-center justify-between mb-8">
         <div>
            <h1 className="text-3xl font-black tracking-tight">Document Compliance</h1>
            <p className="text-[#A1A1AA] text-sm font-medium mt-1">Review and approve driver uploaded documents.</p>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-xl p-6">
             <div className="w-12 h-12 bg-[#FF9500]/10 rounded-full flex items-center justify-center mb-4 text-[#FF9500]">
                <Clock className="w-6 h-6" />
             </div>
             <h3 className="text-[#A1A1AA] text-sm font-bold uppercase tracking-wider mb-1">Pending Reviews</h3>
             <p className="text-3xl font-black">{pendingDocs.length}</p>
          </div>
      </div>

      <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[#A1A1AA]">Scanning records...</div>
        ) : pendingDocs.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-[#252529] border-b border-[#2C2C30]">
              <tr>
                <th className="p-4 font-bold text-[#A1A1AA] uppercase tracking-wider text-xs">Driver</th>
                <th className="p-4 font-bold text-[#A1A1AA] uppercase tracking-wider text-xs">Document Type</th>
                <th className="p-4 font-bold text-[#A1A1AA] uppercase tracking-wider text-xs">File Reference</th>
                <th className="p-4 font-bold text-[#A1A1AA] uppercase tracking-wider text-xs w-48">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2C2C30]">
              {pendingDocs.map((doc, idx) => (
                <tr key={idx} className="hover:bg-[#252529]/50 transition-colors">
                  <td className="p-4">
                     <p className="font-bold text-white">{doc.userName}</p>
                     <p className="text-xs text-[#A1A1AA]">{doc.userEmail}</p>
                  </td>
                  <td className="p-4 font-bold text-[#FF9500]">
                     {getDocName(doc.type)}
                  </td>
                  <td className="p-4">
                     <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-[#00D26A] hover:underline font-medium">
                        <FileText className="w-4 h-4" /> View Document
                     </a>
                  </td>
                  <td className="p-4">
                     {actionDoc === doc ? (
                        <div className="flex items-center gap-2">
                           <input 
                             type="text" 
                             placeholder="Reason for rejection..." 
                             className="bg-[#0D0D0F] border border-[#333338] text-white text-xs px-2 py-1.5 rounded-lg w-32 focus:outline-none focus:border-[#AF52DE]"
                             value={rejectReason}
                             onChange={(e) => setRejectReason(e.target.value)}
                           />
                           <button onClick={() => handleAction(doc, 'rejected', rejectReason)} className="bg-[#FF3B30] text-white px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider">Submit</button>
                           <button onClick={() => setActionDoc(null)} className="text-[#A1A1AA] hover:text-white"><XCircle className="w-4 h-4" /></button>
                        </div>
                     ) : (
                        <div className="flex items-center gap-2">
                           <button onClick={() => handleAction(doc, 'approved')} className="bg-[#00D26A]/20 text-[#00D26A] hover:bg-[#00D26A] hover:text-[#0D0D0F] px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Approve
                           </button>
                           <button onClick={() => setActionDoc(doc)} className="bg-[#FF3B30]/20 text-[#FF3B30] hover:bg-[#FF3B30] hover:text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors">
                              Reject
                           </button>
                        </div>
                     )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center">
             <div className="w-16 h-16 bg-[#00D26A]/10 text-[#00D26A] rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-8 h-8" />
             </div>
             <h3 className="text-lg font-black text-white mb-1">All clear.</h3>
             <p className="text-[#A1A1AA] text-sm">No pending document verifications.</p>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useRef, useEffect } from "react";
import { ChevronLeft, ShieldCheck, AlertTriangle, XCircle, ArrowRight, Wrench, Shield, Upload, FileSignature } from "lucide-react";
import { cn } from "@/src/lib/utils";
import InsuranceMarketplace from "./InsuranceMarketplace";
import { useAuth } from "../AuthProvider";
import { db, doc, updateDoc, arrayUnion, getDoc } from "@/src/firebase";

export default function DriverDocuments({ onBack }: { onBack: () => void }) {
  const { profile } = useAuth();
  const [showMarketplace, setShowMarketplace] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);

  // Derive insurance expiry and status from profile if available, otherwise fallback
  const insuranceExpiryDate = profile?.insurance?.expiryDate 
    ? new Date(profile.insurance.expiryDate) 
    : new Date(Date.now() + 25 * 24 * 60 * 60 * 1000); // Default to 25 days from now for demo
  
  const daysUntilExpiry = Math.ceil((insuranceExpiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  let insStatus = "valid";
  let insColor = "text-[#00D26A]";
  let insBg = "bg-[#00D26A]/10";
  let insExpiryText = `Expires ${insuranceExpiryDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  let insAction = undefined;

  if (daysUntilExpiry <= 0) {
    insStatus = "missing";
    insColor = "text-[#FF3B30]";
    insBg = "bg-[#FF3B30]/10";
    insExpiryText = "Expired";
    insAction = "Renew Now";
  } else if (daysUntilExpiry <= 28) {
    insStatus = "expiring";
    insColor = "text-[#FF9500]";
    insBg = "bg-[#FF9500]/10";
    insExpiryText = `Expires in ${daysUntilExpiry} Days`;
    insAction = "Compare Quotes";
  }

  const baseDocuments = [
    { id: "dvla_license", name: "DVLA Driving License", fallbackExpiry: "Expires 12 Oct 2028" },
    { id: "phv_license", name: "Private Hire License", fallbackExpiry: "Expires 05 May 2025" },
    { id: "insurance", name: "Hire & Reward Insurance", fallbackExpiry: insExpiryText, originalProvider: profile?.insurance?.provider || "Zego" },
    { id: "mot", name: "MOT Certificate", fallbackExpiry: "Expires in 14 Days" },
    { id: "logbook", name: "V5C Logbook", fallbackExpiry: "Upload required" }
  ];

  const verificationDocs = profile?.verificationDocs || [];

  const documents = baseDocuments.map(baseDoc => {
    const uploadedDoc = verificationDocs.find((d: any) => d.type === baseDoc.id);

    if (uploadedDoc) {
      if (uploadedDoc.status === 'pending') {
        return {
          ...baseDoc,
          status: 'pending',
          expiry: 'Verification in progress',
          color: 'text-[#FF9500]',
          bg: 'bg-[#FF9500]/10',
          icon: FileSignature,
          action: 'Pending'
        };
      }
      if (uploadedDoc.status === 'rejected') {
        return {
          ...baseDoc,
          status: 'missing',
          expiry: `Rejected: ${uploadedDoc.rejectionReason}`,
          color: 'text-[#FF3B30]',
          bg: 'bg-[#FF3B30]/10',
          icon: XCircle,
          action: 'Re-Upload'
        };
      }
      if (uploadedDoc.status === 'approved') {
        return {
          ...baseDoc,
          status: 'valid',
          expiry: uploadedDoc.expiryDate ? `Expires ${new Date(uploadedDoc.expiryDate).toLocaleDateString()}` : baseDoc.fallbackExpiry,
          color: 'text-[#00D26A]',
          bg: 'bg-[#00D26A]/10',
          icon: ShieldCheck,
          action: baseDoc.id === 'insurance' && daysUntilExpiry <= 28 ? 'Compare Quotes' : undefined
        };
      }
    }

    // Default missing/expiring logic if no doc
    if (baseDoc.id === 'mot' || baseDoc.id === 'insurance') {
      return {
        ...baseDoc,
        status: 'expiring',
        expiry: baseDoc.fallbackExpiry,
        color: 'text-[#FF9500]',
        bg: 'bg-[#FF9500]/10',
        icon: AlertTriangle,
        action: 'Renew/Upload'
      }
    }

    if (baseDoc.id === 'logbook') {
        return {
            ...baseDoc,
            status: 'missing',
            expiry: 'Upload required',
            color: 'text-[#FF3B30]',
            bg: 'bg-[#FF3B30]/10',
            icon: XCircle,
            action: 'Upload'
        }
    }

    // Default valid
    return {
      ...baseDoc,
      status: 'valid',
      expiry: baseDoc.fallbackExpiry,
      color: 'text-[#00D26A]',
      bg: 'bg-[#00D26A]/10',
      icon: ShieldCheck,
      action: undefined
    };
  });

  const handleActionClick = (docType: string, currentAction?: string) => {
    if (currentAction === 'Pending') return;
    if (docType === 'insurance' && currentAction === 'Compare Quotes') {
       setShowMarketplace(true);
       return;
    }
    setUploadingDocType(docType);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingDocType || !profile?.uid) return;

    try {
      const userRef = doc(db, 'users', profile.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;

      const userData = userSnap.data();
      let currentDocs = userData.verificationDocs || [];
      
      // Remove any existing doc of this type
      currentDocs = currentDocs.filter((d: any) => d.type !== uploadingDocType);

      // Add new pending doc
      const expiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const newDoc = {
        type: uploadingDocType,
        status: 'pending',
        fileUrl: `https://fake-url.com/${file.name}`,
        expiryDate: expiry,
        rejectionReason: null
      };

      currentDocs.push(newDoc);

      await updateDoc(userRef, {
        verificationDocs: currentDocs
      });

      alert(`Uploaded ${file.name} for verification.`);
    } catch (err) {
      console.error(err);
      alert('Upload failed.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadingDocType(null);
    }
  };

  if (showMarketplace) {
    return <InsuranceMarketplace onBack={() => setShowMarketplace(false)} currentProvider={profile?.insurance?.provider || "Zego"} daysUntilExpiry={daysUntilExpiry} />;
  }

  return (
      <div className="flex-1 bg-[#0D0D0F] text-white overflow-y-auto font-sans pb-24 absolute inset-0 z-50">
        <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*,.pdf" 
        />
        <div className="sticky top-0 bg-[#0D0D0F]/90 backdrop-blur-xl z-20 px-4 py-4 flex items-center gap-3 border-b border-[#2C2C30]">
           <button onClick={onBack} className="w-10 h-10 bg-[#1A1A1E] border border-[#2C2C30] rounded-xl flex items-center justify-center text-[#E4E4E7] active:text-white transition-colors group">
             <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
           </button>
           <h1 className="text-xl font-black tracking-tight">Vehicle & Docs</h1>
        </div>

        <div className="px-4 py-6">
           {/* Summary Card */}
           <div className="bg-[#1A1A1E] border border-[#2C2C30] rounded-2xl p-5 mb-6 flex items-center justify-between">
              <div>
                 <p className="text-[10px] font-black uppercase text-[#A1A1AA] tracking-widest mb-1">Active Vehicle</p>
                 <h2 className="text-lg font-black text-white leading-tight">Toyota Prius Hybrid</h2>
                 <p className="text-sm font-bold text-[#E4E4E7] mt-1 border border-[#333338] bg-[#252529] px-2.5 py-1 rounded-md inline-block uppercase tracking-wider">YT68 XYZ</p>
              </div>
              <img src="https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=150&q=80" alt="Toyota Prius" className="w-16 h-16 object-cover rounded-xl border border-[#2C2C30]" />
           </div>

           {/* Alerts Section (Optional Layer 2 logic) */}
           {daysUntilExpiry <= 28 && daysUntilExpiry > 0 && (
              <div 
                className="bg-gradient-to-r from-[#FF9500]/20 to-[#FF9500]/5 border border-[#FF9500]/30 rounded-2xl p-4 mb-6 cursor-pointer active:scale-95 transition-transform shadow-[0_0_20px_rgba(255,149,0,0.1)] relative overflow-hidden"
                onClick={() => setShowMarketplace(true)}
              >
                 <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF9500]/20 blur-3xl rounded-full" />
                 <div className="flex items-start gap-3 relative z-10">
                    <Shield className="w-6 h-6 text-[#FF9500] shrink-0 mt-0.5" />
                    <div>
                       <h3 className="font-bold text-white mb-1 tracking-tight">Insurance expires in {daysUntilExpiry} days</h3>
                       <p className="text-xs text-[#E4E4E7] font-medium leading-relaxed mb-3">Compare quotes now from our partners so you don't lose access to AnyRoller trips.</p>
                       <button className="text-[11px] font-black text-[#0D0D0F] bg-[#FF9500] hover:bg-[#FF9500]/90 px-3 py-1.5 rounded-lg uppercase tracking-widest shadow-sm">
                          View Deals
                       </button>
                    </div>
                 </div>
              </div>
           )}

           {/* Documents List */}
           <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between px-2 mb-2">
                <h3 className="text-xs font-black uppercase text-[#A1A1AA] tracking-widest">Required Documents</h3>
                <span className="text-[10px] font-black text-[#FF3B30] bg-[#FF3B30]/10 px-2 py-0.5 rounded-full uppercase tracking-wider border border-[#FF3B30]/20">Uploads Checked</span>
              </div>

              {documents.map((doc) => {
                 const Icon = doc.icon;
                 return (
                    <div 
                       key={doc.id} 
                       onClick={() => {
                          if (doc.status === 'valid' && doc.id !== 'insurance') handleActionClick(doc.id, 'Update');
                       }}
                       className={cn("bg-[#1A1A1E] border rounded-2xl p-4 transition-colors", 
                          doc.status === 'expiring' ? "border-[#FF9500]/50 shadow-[0_0_15px_rgba(255,149,0,0.05)]" : 
                          doc.status === 'missing' ? "border-[#FF3B30]/50" : 
                          doc.status === 'pending' ? "border-[#FF9500]/50" : "border-[#2C2C30]",
                          doc.status === 'valid' && doc.id !== 'insurance' ? "cursor-pointer hover:border-[#333338]" : ""
                       )}>
                       <div className="flex items-center gap-4">
                          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", doc.bg)}>
                             <Icon className={cn("w-5 h-5", doc.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-white tracking-tight break-words">{doc.name}</h4>
                                {doc.id === 'insurance' && <span className="text-[9px] font-bold text-[#A1A1AA] uppercase px-1.5 py-0.5 bg-[#252529] rounded break-words">{doc.originalProvider}</span>}
                             </div>
                             <p className={cn("text-xs font-bold mt-0.5 break-words", doc.status === 'valid' ? "text-[#A1A1AA] font-medium" : doc.color)}>{doc.expiry}</p>
                          </div>
                          {doc.action && (
                             <button 
                               disabled={doc.action === 'Pending'}
                               onClick={() => handleActionClick(doc.id, doc.action)}
                               className={cn("px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider ml-2 shrink-0 border active:scale-95 transition-transform flex items-center gap-1", 
                                  doc.status === 'expiring' ? "bg-[#FF9500] text-[#0D0D0F] border-transparent" : 
                                  doc.status === 'pending' ? "bg-transparent text-[#FF9500] border-[#FF9500] opacity-50 cursor-not-allowed" :
                                  "bg-[#FF3B30] text-white border-transparent")}>
                                {doc.action === 'Renew/Upload' || doc.action === 'Upload' || doc.action === 'Re-Upload' ? <Upload className="w-3 h-3" /> : null}
                                {doc.action}
                             </button>
                          )}
                       </div>

                       {/* Cross-Sell AnyTrader Widget */}
                       {doc.id === 'mot' && doc.status === 'expiring' && (
                          <div className="mt-4 pt-4 border-t border-[#333338]">
                             <div className="bg-gradient-to-r from-[#FF9500]/10 to-transparent p-3.5 rounded-xl border border-[#FF9500]/20 flex items-start gap-3">
                                <div className="mt-0.5 text-[#FF9500]"><Wrench className="w-4 h-4" /></div>
                                <div className="flex-1">
                                   <p className="text-[12px] font-black text-white leading-tight mb-1">Book an MOT via AnyTrader</p>
                                   <p className="text-[11px] text-[#E4E4E7] mb-2.5 leading-relaxed font-medium">Top-rated mechanics near you. We verify the certificate automatically once passed.</p>
                                   <button className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-[#FF9500] hover:text-white transition-colors bg-[#FF9500]/20 px-3 py-1.5 rounded-lg w-max">
                                      Find a Mechanic <ArrowRight className="w-3 h-3 ml-1" />
                                   </button>
                                </div>
                             </div>
                          </div>
                       )}
                    </div>
                 );
              })}
           </div>
        </div>
      </div>
  );
}

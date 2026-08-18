import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { db, handleFirestoreError, OperationType, collection, query, where, onSnapshot, addDoc, doc, deleteDoc, updateDoc } from "@/src/firebase";
import { Plus, Building2, Wrench, Home, Briefcase, MapPin, Search, Edit, Trash2, Clock, Camera, ArrowLeft, CheckCircle2, Store, Users, FileText, Zap, ShieldAlert, ShieldCheck, KeyRound } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/src/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { PropertyPassportModal } from "./PropertyPassportModal";
import { ClaimPropertyPassportModal } from "./property/ClaimPropertyPassportModal";
import { toast } from "sonner";

export default function Portfolio() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [step, setStep] = useState(1);
  const [showAllProperties, setShowAllProperties] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [passportPropertyModal, setPassportPropertyModal] = useState<any | null>(null);
  const [showClaimPassportModal, setShowClaimPassportModal] = useState(false);
  const [bulkDispatching, setBulkDispatching] = useState(false);
  
  const [selectedProperty, setSelectedProperty] = useState<any | null>(null);
  const [propertyJobs, setPropertyJobs] = useState<any[]>([]);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const expiringCp12Count = properties.filter(p => !p.gasSafetyExpiry || p.gasSafetyExpiry <= today).length;
  const expiringEicrCount = properties.filter(p => !p.eicrExpiry || p.eicrExpiry <= today).length;

  const handleBulkComplianceDispatch = async () => {
    if (!user || properties.length === 0) return;
    setBulkDispatching(true);
    let count = 0;

    try {
      for (const prop of properties) {
        const needGas = !prop.gasSafetyExpiry || prop.gasSafetyExpiry <= today;
        const needEicr = !prop.eicrExpiry || prop.eicrExpiry <= today;

        if (needGas) {
          await addDoc(collection(db, "jobs"), {
            ownerId: user.uid,
            userId: user.uid,
            homeownerId: user.uid,
            title: `CP12 Gas Safety Inspection (${prop.name || prop.address?.line1 || 'Property'})`,
            category: "Heating & Gas",
            description: `Bulk compliance dispatch: Annual Gas Safety CP12 Inspection required.\nProperty: ${prop.name || ''} - ${prop.address?.line1 || ''}\nBoiler Spec: ${prop.boilerInfo?.brand || 'Standard Boiler'} ${prop.boilerInfo?.model || ''}`,
            budget: "110",
            agreedAmount: "110",
            status: "open",
            urgency: "urgent",
            propertyId: prop.id,
            linkedPropertyId: prop.id,
            propertyName: prop.name || "Property",
            address: prop.address || { line1: prop.name || "UK Address" },
            passportSpecsAttached: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          count++;
        }

        if (needEicr) {
          await addDoc(collection(db, "jobs"), {
            ownerId: user.uid,
            userId: user.uid,
            homeownerId: user.uid,
            title: `EICR Electrical Inspection (${prop.name || prop.address?.line1 || 'Property'})`,
            category: "Electrical",
            description: `Bulk compliance dispatch: 5-Year EICR Electrical Safety Certificate Inspection required.\nProperty: ${prop.name || ''} - ${prop.address?.line1 || ''}`,
            budget: "180",
            agreedAmount: "180",
            status: "open",
            urgency: "urgent",
            propertyId: prop.id,
            linkedPropertyId: prop.id,
            propertyName: prop.name || "Property",
            address: prop.address || { line1: prop.name || "UK Address" },
            passportSpecsAttached: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          count++;
        }
      }

      if (count > 0) {
        toast.success(`⚡ Bulk Dispatch Success! Dispatched ${count} compliance trade jobs to verified local engineers.`);
      } else {
        toast.info("All properties in your portfolio are fully compliant!");
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "jobs");
      toast.error("Failed bulk compliance dispatch.");
    } finally {
      setBulkDispatching(false);
    }
  };

  const handleNext = () => {
    if (selectedPropertyIds.length === 0) return;
    const selectedPropertiesObjects = properties.filter(p => selectedPropertyIds.includes(p.id))
      .map(p => ({
        id: p.id,
        name: p.name || p.address?.line1 || 'Property / Site'
      }));
    navigate("/post-job", { 
      state: { 
        linkedProperties: selectedPropertiesObjects,
        isB2B: true
      } 
    });
  };

  const toggleProperty = (propertyId: string) => {
    setSelectedPropertyIds(prev => 
      prev.includes(propertyId) 
        ? prev.filter(id => id !== propertyId)
        : [...prev, propertyId]
    );
  };

  // Form state
  const [propertyName, setPropertyName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [propertyType, setPropertyType] = useState("residential");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [accessInstructions, setAccessInstructions] = useState("");

  useEffect(() => {
    if (!user) return;
    
    const q = query(collection(db, "properties"), where("ownerId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const p = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProperties(p);
      setLoading(false);
    }, (error) => {
      console.error(error);
      handleFirestoreError(error, OperationType.LIST, "properties");
      setLoading(false);
    });
    
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!selectedProperty) return;
    const q = query(collection(db, "jobs"), where("linkedPropertyId", "==", selectedProperty.id));
    const unsub = onSnapshot(q, (snapshot) => {
      setPropertyJobs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      // It might fail if index is missing, handle gracefully
      console.warn("Failed to fetch property jobs:", error);
      setPropertyJobs([]);
    });
    return unsub;
  }, [selectedProperty]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep(step + 1);
    } else {
      if (!user) return;
      try {
        if (editingPropertyId) {
          await updateDoc(doc(db, "properties", editingPropertyId), {
            name: propertyName,
            "address.line1": addressLine1,
            propertyType: propertyType,
            contactName,
            contactPhone,
            accessInstructions,
            updatedAt: new Date().toISOString()
          });
        } else {
          await addDoc(collection(db, "properties"), {
            ownerId: user.uid,
            name: propertyName,
            address: {
              line1: addressLine1,
              city: "",
              postcode: "",
              country: ""
            },
            propertyType: propertyType,
            contactName,
            contactPhone,
            accessInstructions,
            status: "active",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
        setIsAdding(false);
        setEditingPropertyId(null);
        setStep(1);
        setPropertyName("");
        setAddressLine1("");
        setPropertyType("residential");
        setContactName("");
        setContactPhone("");
        setAccessInstructions("");
      } catch (error) {
        handleFirestoreError(error, editingPropertyId ? OperationType.UPDATE : OperationType.CREATE, "properties");
      }
    }
  };

  const handleAddNewClick = () => {
    setEditingPropertyId(null);
    setPropertyName("");
    setAddressLine1("");
    setPropertyType("residential");
    setContactName("");
    setContactPhone("");
    setAccessInstructions("");
    setStep(1);
    setIsAdding(true);
  };

  const handleEditClick = (property: any) => {
    setPropertyName(property.name || "");
    setAddressLine1(property.address?.line1 || "");
    setPropertyType(property.propertyType || "residential");
    setContactName(property.contactName || "");
    setContactPhone(property.contactPhone || "");
    setAccessInstructions(property.accessInstructions || "");
    setEditingPropertyId(property.id);
    setIsAdding(true);
    setStep(1);
  };

  const handleDeleteProperty = async (propertyId: string) => {
    try {
      await deleteDoc(doc(db, "properties", propertyId));
      setDeletingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `properties/${propertyId}`);
    }
  };

  if (loading) return <div className="p-6 text-center text-slate-500">Loading properties...</div>;

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {selectedProperty && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed inset-0 z-[120] bg-slate-50 flex flex-col"
          >
            <div className="bg-white flex-1 flex flex-col h-full overflow-hidden w-full max-w-4xl mx-auto shadow-xl">
              <div className="px-4 py-4 flex flex-col md:flex-row md:items-center justify-between border-b border-black bg-white shrink-0 gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <button onClick={() => setSelectedProperty(null)} className="p-2 -ml-2 text-slate-900 hover:bg-slate-100 rounded-full transition shrink-0 mt-[-4px]">
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-slate-900 truncate">{selectedProperty.name || "Property Details"}</h2>
                    <p className="text-sm font-medium text-black truncate">{selectedProperty.address?.line1}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 self-stretch md:self-auto overflow-x-auto pb-1 md:pb-0 hide-scrollbar shrink-0">
                  <select 
                    value={selectedProperty.occupancy || 'occupied'} 
                    onChange={async (e) => {
                       const v = e.target.value;
                       await updateDoc(doc(db, "properties", selectedProperty.id), { occupancy: v });
                       setSelectedProperty({ ...selectedProperty, occupancy: v });
                    }}
                    className="text-sm font-medium rounded-xl border border-black bg-white px-3 py-2 shadow-sm shrink-0"
                  >
                    <option value="occupied">Occupied</option>
                    <option value="vacant">Vacant</option>
                  </select>
                  <button 
                    onClick={() => navigate("/post-job", { state: { linkedPropertyId: selectedProperty.id } })}
                    className="px-4 py-2 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 transition flex shadow-sm border border-black items-center gap-2 shrink-0 whitespace-nowrap"
                  >
                    <Wrench className="w-4 h-4" /> Dispatch Maintenance
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                <div className="bg-white rounded-xl border border-black shadow-sm p-6 mb-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-slate-400" /> Active Maintenance Tasks</h3>
                  {propertyJobs.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-black">
                      <p className="text-slate-500 font-medium">No active tasks for this property.</p>
                      <p className="text-sm text-slate-400 mt-1">Click "Dispatch Maintenance" to create a new job.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {propertyJobs.map(job => (
                        <div key={job.id} className="flex items-center justify-between p-4 border border-black rounded-xl hover:shadow-sm transition bg-white">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{job.title || job.category}</span>
                            <span className="text-sm font-medium text-slate-500 mt-0.5">Status: <span className="text-slate-700 uppercase tracking-widest text-[10px] bg-slate-100 px-1.5 py-0.5 rounded ml-1">{job.status}</span></span>
                          </div>
                          <Link to={`/admin/job/${job.id}`} className="p-2 hover:bg-slate-100 rounded-lg transition text-slate-400 hover:text-slate-900">
                            <ArrowLeft className="w-5 h-5 rotate-180" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {selectedProperty.contactName && (
                  <div className="bg-white rounded-xl border border-black shadow-sm p-6">
                     <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-slate-400" /> Management Contacts</h3>
                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Point of Contact</p>
                         <p className="font-semibold text-slate-900">{selectedProperty.contactName}</p>
                       </div>
                       <div>
                         <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Phone Number</p>
                         <p className="font-semibold text-slate-900">{selectedProperty.contactPhone}</p>
                       </div>
                     </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isAdding ? (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <button
                onClick={() => navigate("/dashboard")}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-extrabold text-xs border border-black shadow-sm transition"
              >
                <ArrowLeft className="w-4 h-4 text-blue-600" />
                Back to Dashboard
              </button>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                  Landlord Portfolio Automation
                </h2>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  Manage property passports, compliance certs, tenant issues, and 1-tap trade dispatches across your entire portfolio.
                </p>
              </div>
              {properties.length > 0 && (
                <button
                  onClick={handleBulkComplianceDispatch}
                  disabled={bulkDispatching}
                  className="px-4 py-3 bg-gradient-to-r from-blue-700 to-indigo-900 hover:from-blue-800 hover:to-indigo-950 text-white font-black text-xs rounded-2xl border border-black shadow-lg flex items-center gap-2 transition shrink-0"
                >
                  <Zap className="w-4 h-4 text-amber-300 animate-bounce" />
                  {bulkDispatching ? "Auto-Dispatching..." : "⚡ Bulk Auto-Dispatch Compliance Jobs"}
                </button>
              )}
            </div>
          </div>

          {/* Portfolio Compliance Summary Banner */}
          {properties.length > 0 && (
            <div className="p-4 bg-slate-900 text-white rounded-2xl border border-black shadow-md grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                <Building2 className="w-6 h-6 text-blue-400 shrink-0" />
                <div>
                  <p className="text-[10px] font-extrabold uppercase text-slate-400">Total Portfolio Properties</p>
                  <p className="text-lg font-black text-white">{properties.length} Properties</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                {expiringCp12Count > 0 ? (
                  <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0" />
                ) : (
                  <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                )}
                <div>
                  <p className="text-[10px] font-extrabold uppercase text-slate-400">CP12 Gas Compliance</p>
                  <p className="text-lg font-black text-white">
                    {expiringCp12Count > 0 ? `${expiringCp12Count} Due / Expired` : "100% Compliant"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                {expiringEicrCount > 0 ? (
                  <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0" />
                ) : (
                  <ShieldCheck className="w-6 h-6 text-purple-400 shrink-0" />
                )}
                <div>
                  <p className="text-[10px] font-extrabold uppercase text-slate-400">EICR Electrical</p>
                  <p className="text-lg font-black text-white">
                    {expiringEicrCount > 0 ? `${expiringEicrCount} Due / Expired` : "100% Compliant"}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="relative flex gap-2 sm:gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, address or postcode" 
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm"
              />
            </div>
            <button
              onClick={() => setShowClaimPassportModal(true)}
              className="px-3.5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition shrink-0"
              title="Claim Property Passport from previous owner"
            >
              <KeyRound className="w-4 h-4" />
              <span className="hidden sm:inline">Claim Passport</span>
            </button>
            <button 
              onClick={handleAddNewClick}
              className="w-12 h-12 shrink-0 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 active:scale-95 transition"
              title="Add New Property"
            >
              <Plus className="w-6 h-6 stroke-2" />
            </button>
          </div>

          <div className="pt-2 pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {properties.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-slate-500 text-sm bg-white rounded-xl shadow-sm border border-black">
                    No properties / sites added yet. Click + to add your first property / site.
                  </div>
              ) : properties.map(property => {
                const isSelected = selectedPropertyIds.includes(property.id);
                return (
                <div key={property.id} className={cn("flex relative flex-col justify-start p-3 rounded-xl border transition cursor-pointer group shadow-sm bg-white", isSelected ? "border-black ring-1 ring-black bg-white" : "border-black hover:bg-slate-50")} onClick={() => toggleProperty(property.id)}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                      {property.propertyType === "commercial" ? (
                        <Briefcase className="w-5 h-5 text-blue-600" strokeWidth={1.5} />
                      ) : property.propertyType === "apartment" ? (
                        <Building2 className="w-5 h-5 text-blue-600" strokeWidth={1.5} />
                      ) : property.propertyType === "retail" ? (
                        <Store className="w-5 h-5 text-blue-600" strokeWidth={1.5} />
                      ) : (
                        <Home className="w-5 h-5 text-blue-600" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center flex-wrap gap-2 mb-1 pr-6">
                        <h3 onClick={(e) => { e.stopPropagation(); setSelectedProperty(property); }} className="font-bold hover:underline text-slate-900 text-base leading-tight truncate">{property.name || "Unnamed Property"}</h3>
                        <span onClick={(e) => { e.stopPropagation(); setSelectedProperty(property); }} className={cn("text-[9px] hover:underline font-black uppercase tracking-wider px-1.5 py-0.5 rounded leading-none border shrink-0", property.occupancy === "vacant" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-green-50 text-green-700 border-green-200")}>
                          {property.occupancy === 'vacant' ? 'Vacant' : 'Occupied'}
                        </span>
                        {property.transferStatus === "pending" && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded leading-none border bg-purple-50 text-purple-700 border-purple-300 flex items-center gap-1 shrink-0">
                            <KeyRound className="w-2.5 h-2.5" /> Transfer Active
                          </span>
                        )}
                      </div>
                      {property.address?.line1 && (
                        <div onClick={(e) => { e.stopPropagation(); setSelectedProperty(property); }} className="text-[12px] hover:underline text-black font-medium break-words whitespace-normal leading-snug line-clamp-2 pr-6">
                          {property.address.line1}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="absolute top-2 right-2 flex flex-col items-center justify-start gap-1">
                    <div className={cn("w-5 h-5 rounded-full border flex items-center justify-center transition-colors shrink-0 mx-auto mt-0.5", isSelected ? "border-white/20 bg-black shadow-sm" : "border-black/30 bg-white")}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_0_1px_black]" />}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/10 gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPassportPropertyModal(property);
                      }}
                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-black uppercase tracking-wider border border-blue-200 flex items-center gap-1 transition"
                    >
                      <FileText className="w-3.5 h-3.5" /> Passport
                    </button>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        {deletingId === property.id && (
                          <div className="absolute top-full mt-2 right-0 w-32 bg-slate-900 text-white text-[12px] p-2 rounded-xl text-center shadow-lg border border-white/20 z-10" onClick={e => e.stopPropagation()}>
                            <p className="mb-2">Delete property?</p>
                            <div className="flex gap-2">
                              <button 
                                onClick={(e) => { e.stopPropagation(); setDeletingId(null); }}
                                className="flex-1 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
                              >
                                No
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteProperty(property.id); }}
                                className="flex-1 py-1 bg-red-500 hover:bg-red-600 rounded-lg transition"
                              >
                                Yes
                              </button>
                            </div>
                            <div className="absolute -top-1 right-2 w-2 h-2 bg-slate-900 rotate-45 border-t border-l border-white/20"></div>
                          </div>
                        )}
                        <button 
                          onClick={(e) => { e.stopPropagation(); setDeletingId(property.id); }}
                          className="text-red-500 hover:bg-red-50 rounded p-1.5 transition flex items-center gap-1 text-[11px] font-bold uppercase"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleEditClick(property); }}
                        className="text-slate-500 hover:bg-slate-50 hover:text-blue-600 rounded p-1.5 transition flex items-center gap-1 text-[11px] font-bold uppercase"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>

            <div className="mt-8 flex justify-end sticky bottom-6 z-20">
              <button
                 onClick={handleNext}
                 disabled={selectedPropertyIds.length === 0}
                 className={cn(
                   "px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition shadow-xl",
                   selectedPropertyIds.length > 0
                     ? "bg-black text-white hover:bg-slate-800 border border-white/20" 
                     : "bg-slate-200 text-slate-400 cursor-not-allowed"
                 )}
              >
                 Post Job Request <Briefcase className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="fixed inset-0 z-[120] bg-slate-50 flex flex-col sm:p-4">
          <div className="bg-white flex-1 sm:rounded-3xl sm:max-w-md sm:mx-auto w-full sm:shadow-xl flex flex-col h-full overflow-hidden relative">
            
            {/* Header */}
            <div className="px-4 py-4 flex items-center justify-between border-b border-black bg-white shrink-0">
              <button 
                onClick={() => {
                  if (step > 1) {
                    setStep(step - 1);
                  } else {
                    setIsAdding(false);
                    setEditingPropertyId(null);
                  }
                }} 
                className="p-2 -ml-2 text-slate-900 hover:bg-slate-100 rounded-full transition"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h2 className="text-lg font-semibold text-slate-900">{editingPropertyId ? 'Edit Property / Site' : 'Add Property / Site'}</h2>
              <div className="w-10" /> {/* Spacer for centering */}
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col">
              {/* Progress Bar */}
              <div className="px-6 pt-6 pb-2 shrink-0">
                <div className="flex gap-2">
                  {[1, 2, 3].map((s) => (
                    <div key={s} className={cn("h-1 flex-1 rounded-full", s <= step ? "bg-slate-600" : "bg-slate-200")} />
                  ))}
                </div>
                <div className="text-center text-sm font-medium text-slate-500 mt-2">
                  Step {step} of 3
                </div>
              </div>

              {/* Form Content */}
              <form id="add-property-form" onSubmit={handleFormSubmit} className="p-6 space-y-6 flex-1">
                
                {step === 1 && (
                  <>
                    <div className="space-y-1.5">
                      <label className="block text-[15px] font-medium text-slate-900">Property / Site Name</label>
                      <input 
                        type="text" 
                        value={propertyName}
                        onChange={e => setPropertyName(e.target.value)}
                        required
                        placeholder="e.g., Sunrise Apartments or Acme Corp Site"
                        className="w-full px-4 py-3 rounded-xl border border-black focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm placeholder:text-slate-400 text-[15px]"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="block text-[15px] font-medium text-slate-900">Full Address</label>
                        <button type="button" className="text-[13px] font-medium text-slate-500 flex items-center gap-1 hover:text-slate-900 transition">
                          <MapPin className="w-3.5 h-3.5" /> Locate on Map
                        </button>
                      </div>
                      <input 
                        type="text" 
                        value={addressLine1}
                        onChange={e => setAddressLine1(e.target.value)}
                        required
                        placeholder="Enter address"
                        className="w-full px-4 py-3 rounded-xl border border-black focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm placeholder:text-slate-400 text-[15px]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[15px] font-medium text-slate-900">Property / Site Type</label>
                      <div className="flex p-1 bg-white border border-black rounded-xl text-[14px]">
                        {["Commercial", "Residential", "Industrial", "Retail", "Other"].map(type => {
                          const value = type.toLowerCase();
                          const isActive = propertyType === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setPropertyType(value)}
                              className={cn(
                                "flex-1 py-1.5 px-2 rounded-lg font-medium transition duration-200",
                                isActive ? "bg-black text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
                              )}
                            >
                              {type}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                       <h3 className="text-[16px] font-bold text-slate-900">Details</h3>
                       <input 
                         type="text" 
                         placeholder="Total Area (sq ft)" 
                         className="w-full px-4 py-3 rounded-xl border border-black bg-white shadow-sm placeholder:text-slate-400 text-[15px]" 
                       />
                       <input 
                         type="text" 
                         placeholder="Number of Units" 
                         className="w-full px-4 py-3 rounded-xl border border-black bg-white shadow-sm placeholder:text-slate-400 text-[15px]" 
                       />
                    </div>
                    
                    <button type="button" className="w-full mt-2 border border-black rounded-xl py-8 flex flex-col items-center justify-center text-slate-500 hover:bg-slate-50 transition bg-white shadow-sm">
                      <Camera className="w-8 h-8 text-slate-400 mb-2" strokeWidth={1.5} />
                      <span className="font-semibold text-slate-800">Upload Photos</span>
                      <p className="text-sm text-slate-500 mt-0.5">(Drag & Drop or Click)</p>
                    </button>
                  </>
                )}

                {step === 2 && (
                  <div className="space-y-5">
                    <h3 className="text-[18px] font-bold text-slate-900">Contact & Management</h3>
                    <p className="text-[15px] text-slate-600 mb-4">Who should tradespeople contact regarding this property?</p>
                    
                    <div className="space-y-1.5">
                      <label className="block text-[15px] font-medium text-slate-900">Contact Name</label>
                      <input 
                        type="text" 
                        value={contactName}
                        onChange={e => setContactName(e.target.value)}
                        required
                        placeholder="e.g., Jane Doe"
                        className="w-full px-4 py-3 rounded-xl border border-black focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm placeholder:text-slate-400 text-[15px]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[15px] font-medium text-slate-900">Contact Phone</label>
                      <input 
                        type="text" 
                        value={contactPhone}
                        onChange={e => setContactPhone(e.target.value)}
                        required
                        placeholder="e.g., 07123 456789"
                        className="w-full px-4 py-3 rounded-xl border border-black focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm placeholder:text-slate-400 text-[15px]"
                      />
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-5">
                    <h3 className="text-[18px] font-bold text-slate-900">Access & Instructions</h3>
                    <p className="text-[15px] text-slate-600 mb-4">Provide any instructions for access or parking.</p>
                    
                    <div className="space-y-1.5">
                      <label className="block text-[15px] font-medium text-slate-900">Access Instructions (Optional)</label>
                      <textarea 
                        value={accessInstructions}
                        onChange={e => setAccessInstructions(e.target.value)}
                        rows={4}
                        placeholder="e.g., Lockbox code is 1234, or pick up keys from front desk..."
                        className="w-full px-4 py-3 rounded-xl border border-black focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm placeholder:text-slate-400 text-[15px]"
                      />
                    </div>
                  </div>
                )}

              </form>
            </div>

            {/* Static Footer */}
            <div className="p-4 bg-white border-t border-black flex gap-3 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              <button 
                type="button" 
                onClick={() => setIsAdding(false)} 
                className="flex-[0.4] py-3.5 font-semibold text-slate-500 hover:bg-slate-50 rounded-full transition"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="add-property-form"
                className="flex-1 py-3.5 font-semibold text-white bg-blue-500 hover:bg-blue-600 active:bg-blue-700 rounded-full shadow-sm transition flex justify-center items-center gap-2"
              >
                {step < 3 ? "Next Step" : "Add Property / Site"}
              </button>
            </div>

          </div>
        </div>
      )}

      {passportPropertyModal && (
        <PropertyPassportModal
          property={passportPropertyModal}
          onClose={() => setPassportPropertyModal(null)}
        />
      )}

      {showClaimPassportModal && (
        <ClaimPropertyPassportModal
          onClose={() => setShowClaimPassportModal(false)}
          onSuccess={(propertyId) => {
            setShowClaimPassportModal(false);
          }}
        />
      )}
    </div>
  );
}

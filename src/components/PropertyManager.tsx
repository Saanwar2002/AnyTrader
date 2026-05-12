import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { db, handleFirestoreError, OperationType, collection, query, where, onSnapshot, addDoc, doc, deleteDoc, updateDoc } from "@/src/firebase";
import { Plus, Building2, Wrench, Home, Briefcase, MapPin, Search, Edit, Trash2, Clock, Camera, ArrowLeft, CheckCircle2, Store } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/src/lib/utils";
import { motion, AnimatePresence } from "motion/react";

export function PropertyManager() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [step, setStep] = useState(1);
  const [showAllProperties, setShowAllProperties] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  
  // Form state
  const [propertyName, setPropertyName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [propertyType, setPropertyType] = useState("residential");

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

  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      if (editingPropertyId) {
        await updateDoc(doc(db, "properties", editingPropertyId), {
          name: propertyName,
          "address.line1": addressLine1,
          propertyType: propertyType,
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
    } catch (error) {
      handleFirestoreError(error, editingPropertyId ? OperationType.UPDATE : OperationType.CREATE, "properties");
    }
  };

  const handleAddNewClick = () => {
    setEditingPropertyId(null);
    setPropertyName("");
    setAddressLine1("");
    setPropertyType("residential");
    setStep(1);
    setIsAdding(true);
  };

  const handleEditClick = (property: any) => {
    setPropertyName(property.name || "");
    setAddressLine1(property.address?.line1 || "");
    setPropertyType(property.propertyType || "residential");
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
      {!isAdding ? (
        <>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            Portfolio
          </h2>

          <div className="relative flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search by name, address or postcode" 
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm"
              />
            </div>
            <button 
              onClick={handleAddNewClick}
              className="w-12 h-12 shrink-0 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 active:scale-95 transition"
            >
              <Plus className="w-6 h-6 stroke-2" />
            </button>
          </div>

          <div className="pt-2 pb-6">
            <div className="space-y-3">
              {properties.length === 0 ? (
                 <div className="text-center py-8 text-slate-500 text-sm bg-white rounded-3xl shadow-sm border border-slate-100">
                   No properties added yet. Click + to add your first property.
                 </div>
              ) : properties.slice(0, 3).map(property => (
                <div key={property.id} className="flex items-stretch justify-between py-2 px-3 rounded-xl border border-black hover:bg-slate-50 transition group shadow-sm bg-white min-h-[72px]">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="text-blue-600/80 shrink-0">
                      {property.propertyType === "commercial" ? (
                        <Briefcase className="w-5 h-5" strokeWidth={1.5} />
                      ) : property.propertyType === "apartment" ? (
                        <Building2 className="w-5 h-5" strokeWidth={1.5} />
                      ) : property.propertyType === "retail" ? (
                        <Store className="w-5 h-5" strokeWidth={1.5} />
                      ) : (
                        <Home className="w-5 h-5" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0 justify-center py-1">
                      <div className="flex items-center justify-between gap-2 w-full mb-1">
                        <h3 className="font-semibold text-slate-900 text-[14px] leading-tight truncate">{property.name || "Unnamed Property"}</h3>
                        <Link 
                          to={`/my-jobs?propertyId=${property.id}`}
                          className="text-[12px] text-blue-600 font-medium hover:text-blue-800 transition shrink-0"
                        >
                          History
                        </Link>
                      </div>
                      {property.address?.line1 && (
                        <div className="text-[11px] text-black font-bold w-full break-words whitespace-normal leading-snug pt-0.5">
                          {property.address.line1}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-start gap-1.5 ml-3 shrink-0 pt-0.5">
                    <div className="relative">
                      {deletingId === property.id && (
                        <div className="absolute top-full mt-2 right-0 w-32 bg-slate-900 text-white text-[12px] p-2 rounded-xl text-center shadow-lg border border-black z-10">
                          <p className="mb-2">Delete property?</p>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => setDeletingId(null)}
                              className="flex-1 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
                            >
                              No
                            </button>
                            <button 
                              onClick={() => handleDeleteProperty(property.id)}
                              className="flex-1 py-1 bg-red-500 hover:bg-red-600 rounded-lg transition"
                            >
                              Yes
                            </button>
                          </div>
                          <div className="absolute -top-1 right-2 w-2 h-2 bg-slate-900 rotate-45 border-t border-l border-black"></div>
                        </div>
                      )}
                      <button 
                        onClick={() => setDeletingId(property.id)}
                        className="text-red-500 hover:text-red-700 transition p-1"
                      >
                        <Trash2 className="w-[15px] h-[15px]" strokeWidth={1.5} />
                      </button>
                    </div>
                    
                    <button 
                      onClick={() => handleEditClick(property)}
                      className="text-blue-600 hover:text-blue-800 transition p-1"
                    >
                      <Edit className="w-[15px] h-[15px]" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              ))}
              
              {properties.length > 3 && (
                <Link
                  to="/portfolio"
                  className="block text-center w-full py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors mt-2"
                >
                  Show More
                </Link>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="fixed inset-0 z-[120] bg-slate-50 flex flex-col sm:p-4">
          <div className="bg-white flex-1 sm:rounded-3xl sm:max-w-md sm:mx-auto w-full sm:shadow-xl flex flex-col h-full overflow-hidden relative">
            
            {/* Header */}
            <div className="px-4 py-4 flex items-center justify-between border-b border-slate-100 bg-white z-10 shrink-0">
              <button onClick={() => { setIsAdding(false); setEditingPropertyId(null); }} className="p-2 -ml-2 text-slate-900 hover:bg-slate-100 rounded-full transition">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h2 className="text-lg font-semibold text-slate-900">{editingPropertyId ? 'Edit Property' : 'Add New Property'}</h2>
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
              <form id="add-property-form" onSubmit={handleAddProperty} className="p-6 space-y-6 flex-1">
                
                <div className="space-y-1.5">
                  <label className="block text-[15px] font-medium text-slate-900">Property Name</label>
                  <input 
                    type="text" 
                    value={propertyName}
                    onChange={e => setPropertyName(e.target.value)}
                    required
                    placeholder="e.g., Sunrise Apartments"
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
                  <label className="block text-[15px] font-medium text-slate-900">Property Type</label>
                  <div className="flex p-1 bg-white border border-black rounded-xl text-[14px]">
                    {["Commercial", "Residential", "Industrial", "Retail"].map(type => {
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
                   <h3 className="text-[16px] font-bold text-slate-900">Property Details</h3>
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
              </form>
            </div>

            {/* Static Footer */}
            <div className="p-4 bg-white border-t border-slate-100 flex gap-3 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
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
                className="flex-1 py-3.5 font-semibold text-white bg-blue-500 hover:bg-blue-600 active:bg-blue-700 rounded-full shadow-sm transition flex items-center justify-center gap-2"
              >
                Next Step
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

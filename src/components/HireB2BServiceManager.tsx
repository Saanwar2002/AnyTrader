import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { db, handleFirestoreError, OperationType } from "@/src/firebase";
import { collection, query, where, onSnapshot, addDoc } from "firebase/firestore";
import { Building2, Plus, ArrowRight, Briefcase, Search, ArrowLeft, Camera, MapPin, Store, Home } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/src/lib/utils";

export function HireB2BServiceManager() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [step, setStep] = useState(1);
  const [propertyName, setPropertyName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [propertyType, setPropertyType] = useState("residential");

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "properties"), where("ownerId", "==", user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      setProperties(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "properties");
    });
    return unsub;
  }, [user]);

  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
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
      setIsAdding(false);
      setStep(1);
      setPropertyName("");
      setAddressLine1("");
      setPropertyType("residential");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "properties");
    }
  };

  const toggleProperty = (propertyId: string) => {
    setSelectedPropertyIds(prev => 
      prev.includes(propertyId) 
        ? prev.filter(id => id !== propertyId)
        : [...prev, propertyId]
    );
  };

  const handleNext = () => {
    if (selectedPropertyIds.length === 0) return;
    
    // Pass names too for displaying
    const selectedProperties = properties.filter(p => selectedPropertyIds.includes(p.id))
      .map(p => ({
        id: p.id,
        name: p.name || p.address?.line1 || 'Property'
      }));

    navigate("/post-job", { 
      state: { 
        linkedProperties: selectedProperties,
        isB2B: true
      } 
    });
  };

  const filteredProperties = properties.filter(p => {
    if (!searchQuery) return true;
    const lowerQuery = searchQuery.toLowerCase();
    const nameMatch = p.name?.toLowerCase().includes(lowerQuery);
    const addressMatch = p.address?.line1?.toLowerCase().includes(lowerQuery);
    return nameMatch || addressMatch;
  });

  if (loading) return <div className="py-8 text-center text-black font-medium">Loading Projects...</div>;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      {!isAdding ? (
        <>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-black leading-tight max-w-lg">
              Select an active project or property to link with this service request.
            </p>
          </div>

          <div className="relative flex gap-3 items-center">
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
              onClick={() => setIsAdding(true)}
              className="w-12 h-12 shrink-0 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 active:scale-95 transition"
            >
              <Plus className="w-6 h-6 stroke-2" />
            </button>
          </div>

          <div className="space-y-4">
             {filteredProperties.length === 0 ? (
                <div className="py-12 border-2 border-dashed border-black rounded-xl text-center">
                  <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="font-bold text-slate-900">No projects found</p>
                  <p className="text-sm font-medium text-black mt-1">Add a project or property first to hire B2B services.</p>
                </div>
             ) : (
                <div className="flex flex-col gap-3">
                  {filteredProperties.map(property => {
                    const isSelected = selectedPropertyIds.includes(property.id);
                    return (
                      <button
                        key={property.id}
                        onClick={() => toggleProperty(property.id)}
                        className={cn(
                          "p-3 rounded-xl border transition-all text-left flex items-center justify-between shadow-sm active:scale-[0.98]",
                          isSelected ? "border-black ring-1 ring-black bg-white" : "border-black bg-white hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                           <div className="shrink-0 text-slate-700">
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
                           <div>
                              <h4 className="font-bold text-[14px] leading-tight text-black flex items-center gap-2">
                                {property.name || property.address?.line1 || "Unnamed Project"}
                              </h4>
                              {property.name && property.address?.line1 && (
                                <p className="text-[13px] font-bold text-black mt-0.5">
                                  {property.address.line1}
                                </p>
                              )}
                           </div>
                        </div>
                        <div className={cn(
                          "w-4 h-4 rounded-full border flex flex-shrink-0 items-center justify-center transition-colors shrink-0",
                          isSelected ? "border-black bg-black" : "border-black"
                        )}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_0_1px_black]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
             )}

             <div className="mt-8 flex justify-end">
                <button
                   onClick={handleNext}
                   disabled={selectedPropertyIds.length === 0}
                   className={cn(
                     "px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition",
                     selectedPropertyIds.length > 0
                       ? "bg-black text-white hover:bg-slate-800 border border-black shadow-sm" 
                       : "bg-slate-200 text-slate-400 cursor-not-allowed"
                   )}
                >
                   Post Job Request <ArrowRight className="w-4 h-4" />
                </button>
             </div>
          </div>
        </>
      ) : (
        <div className="fixed inset-0 z-[120] bg-slate-50 flex flex-col sm:p-4">
          <div className="bg-white flex-1 sm:rounded-3xl sm:max-w-md sm:mx-auto w-full sm:shadow-xl flex flex-col h-full overflow-hidden relative">
            <div className="px-4 py-4 flex items-center justify-between border-b border-slate-100 bg-white z-10 shrink-0">
               <button onClick={() => setIsAdding(false)} className="p-2 -ml-2 text-slate-900 hover:bg-slate-100 rounded-full transition">
                 <ArrowLeft className="w-6 h-6" />
               </button>
               <h2 className="text-lg font-semibold text-slate-900">Add New Project</h2>
               <div className="w-10" />
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col">
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

               <form id="add-project-form" onSubmit={handleAddProperty} className="p-6 space-y-6 flex-1">
                 <div className="space-y-1.5">
                   <label className="block text-[15px] font-medium text-slate-900">Project/Property Name</label>
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

                 <button type="button" className="w-full mt-2 border border-black rounded-xl py-8 flex flex-col items-center justify-center text-slate-500 hover:bg-slate-50 transition bg-white shadow-sm">
                   <Camera className="w-8 h-8 text-slate-400 mb-2" strokeWidth={1.5} />
                   <span className="font-semibold text-slate-800">Upload Photos</span>
                   <p className="text-sm text-slate-500 mt-0.5">(Drag & Drop or Click)</p>
                 </button>
               </form>
            </div>

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
                 form="add-project-form"
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

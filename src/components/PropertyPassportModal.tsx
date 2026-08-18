import React, { useState, useEffect } from "react";
import { db, doc, updateDoc, collection, query, where, onSnapshot, addDoc, handleFirestoreError, OperationType } from "@/src/firebase";
import { useAuth } from "./AuthProvider";
import { shareToWhatsApp, copyPrivacyShareLink } from "@/src/utils/shareUtils";
import { X, ArrowLeft, Home, ShieldCheck, AlertTriangle, Calendar, FileText, Wrench, CheckCircle2, Share2, Sparkles, Plus, Edit2, TrendingUp, Info, Copy, Check, Users, Zap, ExternalLink, Clock, KeyRound, Printer, QrCode } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { TransferOwnershipModal } from "./property/TransferOwnershipModal";
import { BuyerPackModal } from "./property/BuyerPackModal";
import { calculatePropertyHealthScore } from "./property/propertyUtils";

interface PropertyPassportModalProps {
  property: any;
  onClose: () => void;
  onUpdated?: () => void;
}

export function PropertyPassportModal({ property, onClose, onUpdated }: PropertyPassportModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"passport" | "certs" | "history" | "predictive" | "tenant">("passport");
  const [isEditing, setIsEditing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedTenantLink, setCopiedTenantLink] = useState(false);
  const [completedJobs, setCompletedJobs] = useState<any[]>([]);
  const [tenantIssues, setTenantIssues] = useState<any[]>([]);
  const [dispatchingJobId, setDispatchingJobId] = useState<string | null>(null);

  // Transfer & Buyer Pack modal state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showBuyerPackModal, setShowBuyerPackModal] = useState(false);

  // Passport state
  const [epcRating, setEpcRating] = useState(property.epcRating || "C");
  const [gasSafetyExpiry, setGasSafetyExpiry] = useState(property.gasSafetyExpiry || "");
  const [eicrExpiry, setEicrExpiry] = useState(property.eicrExpiry || "");
  const [boilerBrand, setBoilerBrand] = useState(property.boilerInfo?.brand || "");
  const [boilerModel, setBoilerModel] = useState(property.boilerInfo?.model || "");
  const [boilerAge, setBoilerAge] = useState(property.boilerInfo?.age || "5");
  const [boilerLastServiced, setBoilerLastServiced] = useState(property.boilerInfo?.lastServiced || "");
  const [roofCondition, setRoofCondition] = useState(property.roofCondition || "Good");
  const [insuranceProvider, setInsuranceProvider] = useState(property.insuranceProvider || "");
  
  // Component Registry state
  const [stopcockLocation, setStopcockLocation] = useState(property.componentRegistry?.stopcockLocation || "");
  const [fuseboardLocation, setFuseboardLocation] = useState(property.componentRegistry?.fuseboardLocation || "");
  const [paintCodes, setPaintCodes] = useState(property.componentRegistry?.paintCodes || "");

  const [saving, setSaving] = useState(false);

  // Load associated completed jobs for history & valuation impact
  useEffect(() => {
    if (!property?.id) return;
    const q = query(collection(db, "jobs"), where("propertyId", "==", property.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const j = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setCompletedJobs(j.filter((job: any) => job.status === "completed"));
    }, (err) => {
      console.error("Error loading property jobs history:", err);
    });
    return unsubscribe;
  }, [property?.id]);

  // Load tenant reported issues for this property
  useEffect(() => {
    if (!property?.id) return;
    const q = query(collection(db, "tenant_issues"), where("propertyId", "==", property.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const issues = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setTenantIssues(issues);
    }, (err) => {
      console.error("Error loading tenant issues:", err);
    });
    return unsubscribe;
  }, [property?.id]);

  const handleOneTapDispatch = async (jobDetails: {
    idKey?: string;
    title: string;
    category: string;
    description: string;
    budget: string;
    urgency?: string;
  }) => {
    if (!user || !property?.id) return;
    setDispatchingJobId(jobDetails.idKey || jobDetails.title);
    try {
      await addDoc(collection(db, "jobs"), {
        ownerId: user.uid,
        userId: user.uid,
        homeownerId: user.uid,
        title: jobDetails.title,
        category: jobDetails.category,
        description: `${jobDetails.description}\n\n--- PRE-LOADED PROPERTY PASSPORT SPECS ---\n- Address: ${property.address?.line1 || property.name}\n- Boiler Spec: ${boilerBrand || 'Standard'} ${boilerModel || ''} (${boilerAge || 'N/A'} yrs old)\n- Roof Condition: ${roofCondition || 'Good'}\n- EPC Rating: Grade ${epcRating || 'C'}\n- Contact/Access Notes: ${property.contactPhone || "Call Landlord"}`,
        budget: jobDetails.budget || "120",
        agreedAmount: jobDetails.budget || "120",
        status: "open",
        urgency: jobDetails.urgency || "urgent",
        propertyId: property.id,
        linkedPropertyId: property.id,
        propertyName: property.name || "Property",
        address: property.address || { line1: property.name || "UK Address" },
        passportSpecsAttached: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      toast.success("⚡ 1-Tap Trade Dispatch Successful! Job posted to local verified trades.");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "jobs");
      toast.error("Failed to dispatch trade job.");
    } finally {
      setDispatchingJobId(null);
    }
  };

  const handleCopyTenantPortalLink = async () => {
    const tenantUrl = `${window.location.origin}/tenant-report?propertyId=${property.id}`;
    try {
      await navigator.clipboard.writeText(tenantUrl);
      setCopiedTenantLink(true);
      toast.success("Tenant Repair Reporting Link copied!");
      setTimeout(() => setCopiedTenantLink(false), 2000);
    } catch (e) {
      toast.error("Could not copy link");
    }
  };

  const handleSavePassport = async () => {
    if (!property?.id) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "properties", property.id), {
        epcRating,
        gasSafetyExpiry,
        eicrExpiry,
        boilerInfo: {
          brand: boilerBrand,
          model: boilerModel,
          age: boilerAge,
          lastServiced: boilerLastServiced,
        },
        roofCondition,
        insuranceProvider,
        componentRegistry: {
          stopcockLocation: stopcockLocation.trim() || null,
          fuseboardLocation: fuseboardLocation.trim() || null,
          paintCodes: paintCodes.trim() || null,
        },
        updatedAt: new Date().toISOString()
      });
      toast.success("Property Passport & Component Registry updated!");
      setIsEditing(false);
      if (onUpdated) onUpdated();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `properties/${property.id}`);
      toast.error("Failed to update passport");
    } finally {
      setSaving(false);
    }
  };

  const handleShareWhatsApp = () => {
    shareToWhatsApp({
      type: "passport",
      id: property.id,
      title: property.name || property.address?.line1 || "Property Passport",
      postcode: property.address?.postcode
    });
    toast.success("Opening WhatsApp with secure privacy link!");
  };

  const handleCopyLink = async () => {
    const success = await copyPrivacyShareLink("passport", property.id);
    if (success) {
      setCopiedLink(true);
      toast.success("Privacy passport link copied!");
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Calculate total investment & estimated home value impact
  const totalInvestment = completedJobs.reduce((sum, job) => sum + (Number(job.agreedAmount || job.budget) || 0), 0);
  const estimatedValueImpact = Math.round(totalInvestment * 1.35); // Estimated ROI multiplier for home upgrades

  // Check compliance certificate alerts
  const today = new Date().toISOString().split('T')[0];
  const isGasExpiringSoon = gasSafetyExpiry && gasSafetyExpiry <= today;
  const isEicrExpiringSoon = eicrExpiry && eicrExpiry <= today;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className="relative w-full max-w-2xl bg-white rounded-3xl border border-black shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 rounded-2xl text-white shadow-md">
                <Home className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-lg tracking-tight">{property.name || "Property Passport"}</h3>
                  <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] uppercase font-black px-2 py-0.5 rounded-full">
                    Digital Twin
                  </span>
                </div>
                <p className="text-xs text-slate-400">{property.address?.line1 || "UK Property Maintenance Record"}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBuyerPackModal(true)}
                className="p-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition"
                title="Conveyancing Solicitor Pack"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Buyer Pack</span>
              </button>
              <button
                onClick={() => setShowTransferModal(true)}
                className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition"
                title="Transfer Ownership to Buyer"
              >
                <KeyRound className="w-4 h-4" />
                <span className="hidden sm:inline">Transfer</span>
              </button>
              <button
                onClick={handleShareWhatsApp}
                className="p-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 border border-white/20 shadow-sm transition"
                title="Share via WhatsApp"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 border border-white/20 transition shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Close</span>
              </button>
            </div>
          </div>

          {/* Transfer Pending Alert Banner */}
          {property.transferStatus === "pending" && property.transferCode && (
            <div className="p-3 bg-amber-500 text-slate-950 font-sans px-5 flex items-center justify-between border-b border-amber-600 text-xs font-bold">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-slate-950 shrink-0" />
                <span>
                  Ownership Transfer Active: Code <strong className="font-mono bg-black text-white px-2 py-0.5 rounded text-xs">{property.transferCode}</strong>
                </span>
              </div>
              <button
                onClick={() => setShowTransferModal(true)}
                className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-[11px] font-black hover:bg-black transition"
              >
                Manage / QR Code
              </button>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="border-b border-black bg-slate-100 p-2 sm:px-4 sm:py-2.5">
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth">
              <button
                type="button"
                onClick={() => setActiveTab("passport")}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === "passport" 
                    ? "bg-blue-600 text-white shadow-sm border border-blue-700" 
                    : "bg-white text-slate-700 hover:text-black border border-slate-300 hover:border-slate-400"
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                <span>Specs</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("certs")}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === "certs" 
                    ? "bg-blue-600 text-white shadow-sm border border-blue-700" 
                    : "bg-white text-slate-700 hover:text-black border border-slate-300 hover:border-slate-400"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Compliance</span>
                {(isGasExpiringSoon || isEicrExpiringSoon) && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("tenant")}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === "tenant" 
                    ? "bg-blue-600 text-white shadow-sm border border-blue-700" 
                    : "bg-white text-slate-700 hover:text-black border border-slate-300 hover:border-slate-400"
                }`}
              >
                <Users className={`w-3.5 h-3.5 ${activeTab === "tenant" ? "text-white" : "text-emerald-600"}`} />
                <span>Tenant Issues</span>
                {tenantIssues.length > 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                    activeTab === "tenant" ? "bg-white text-blue-600" : "bg-red-500 text-white"
                  }`}>
                    {tenantIssues.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === "history" 
                    ? "bg-blue-600 text-white shadow-sm border border-blue-700" 
                    : "bg-white text-slate-700 hover:text-black border border-slate-300 hover:border-slate-400"
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>History</span>
                {completedJobs.length > 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                    activeTab === "history" ? "bg-white text-blue-600" : "bg-slate-200 text-slate-700"
                  }`}>
                    {completedJobs.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("predictive")}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === "predictive" 
                    ? "bg-blue-600 text-white shadow-sm border border-blue-700" 
                    : "bg-white text-slate-700 hover:text-black border border-slate-300 hover:border-slate-400"
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 ${activeTab === "predictive" ? "text-white" : "text-purple-600"}`} />
                <span>AI Insights</span>
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            {activeTab === "passport" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-slate-900 text-sm">Key Building & Appliance Details</h4>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    {isEditing ? "Cancel Editing" : "Edit Details"}
                  </button>
                </div>

                {isEditing ? (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-black space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-extrabold uppercase text-slate-600 block mb-1">EPC Rating</label>
                        <select
                          value={epcRating}
                          onChange={(e) => setEpcRating(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-black bg-white text-xs font-bold"
                        >
                          {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(r => (
                            <option key={r} value={r}>EPC Grade {r}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-extrabold uppercase text-slate-600 block mb-1">Roof Condition</label>
                        <select
                          value={roofCondition}
                          onChange={(e) => setRoofCondition(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-black bg-white text-xs font-bold"
                        >
                          <option value="Excellent">Excellent</option>
                          <option value="Good">Good</option>
                          <option value="Fair">Fair</option>
                          <option value="Needs Inspection">Needs Inspection</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-extrabold uppercase text-slate-600 block mb-1">Boiler Brand</label>
                        <input
                          type="text"
                          placeholder="e.g. Worcester Bosch"
                          value={boilerBrand}
                          onChange={(e) => setBoilerBrand(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-black bg-white text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold uppercase text-slate-600 block mb-1">Boiler Model</label>
                        <input
                          type="text"
                          placeholder="e.g. Greenstar 30i"
                          value={boilerModel}
                          onChange={(e) => setBoilerModel(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-black bg-white text-xs font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-extrabold uppercase text-slate-600 block mb-1">Boiler Age (Years)</label>
                        <input
                          type="number"
                          value={boilerAge}
                          onChange={(e) => setBoilerAge(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-black bg-white text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold uppercase text-slate-600 block mb-1">Insurance Provider</label>
                        <input
                          type="text"
                          placeholder="e.g. Aviva / Direct Line"
                          value={insuranceProvider}
                          onChange={(e) => setInsuranceProvider(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-black bg-white text-xs font-bold"
                        />
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-3 space-y-2">
                      <p className="text-[11px] font-black uppercase text-blue-700">Digital Component Registry</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-extrabold uppercase text-slate-600 block mb-1">Mains Water Stopcock Location</label>
                          <input
                            type="text"
                            placeholder="e.g. Under kitchen sink / Hallway"
                            value={stopcockLocation}
                            onChange={(e) => setStopcockLocation(e.target.value)}
                            className="w-full p-2.5 rounded-xl border border-black bg-white text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-extrabold uppercase text-slate-600 block mb-1">Consumer Unit (Fuseboard)</label>
                          <input
                            type="text"
                            placeholder="e.g. Under stairs / Hall cupboard"
                            value={fuseboardLocation}
                            onChange={(e) => setFuseboardLocation(e.target.value)}
                            className="w-full p-2.5 rounded-xl border border-black bg-white text-xs font-bold"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-extrabold uppercase text-slate-600 block mb-1">Decor Paint Codes & Finishes</label>
                        <input
                          type="text"
                          placeholder="e.g. Living: F&B Ammonite, Kitchen: Dulux Heritage Sage"
                          value={paintCodes}
                          onChange={(e) => setPaintCodes(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-black bg-white text-xs font-bold"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleSavePassport}
                      disabled={saving}
                      className="w-full py-3 bg-blue-600 text-white font-extrabold text-xs rounded-xl border border-black shadow-md hover:bg-blue-700 transition"
                    >
                      {saving ? "Saving Changes..." : "Save Passport Specs & Registry"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="p-3.5 bg-slate-50 border border-black rounded-2xl">
                        <p className="text-[10px] uppercase font-extrabold text-slate-500">EPC Energy Rating</p>
                        <p className="text-xl font-black text-blue-600 mt-1">Grade {epcRating}</p>
                      </div>

                      <div className="p-3.5 bg-slate-50 border border-black rounded-2xl">
                        <p className="text-[10px] uppercase font-extrabold text-slate-500">Roof Condition</p>
                        <p className="text-sm font-black text-slate-900 mt-1">{roofCondition}</p>
                      </div>

                      <div className="p-3.5 bg-slate-50 border border-black rounded-2xl col-span-2 sm:col-span-1">
                        <p className="text-[10px] uppercase font-extrabold text-slate-500">Boiler System</p>
                        <p className="text-sm font-black text-slate-900 mt-1">
                          {boilerBrand || "Not set"} {boilerModel ? `(${boilerModel})` : ""}
                        </p>
                        <p className="text-[10px] text-slate-500 font-bold">{boilerAge ? `${boilerAge} yrs old` : ""}</p>
                      </div>

                      <div className="p-3.5 bg-slate-50 border border-black rounded-2xl col-span-2">
                        <p className="text-[10px] uppercase font-extrabold text-slate-500">Insurance & Warranty</p>
                        <p className="text-sm font-black text-slate-900 mt-1">{insuranceProvider || "No active provider linked"}</p>
                      </div>

                      {/* Component Registry Display */}
                      <div className="p-3.5 bg-slate-50 border border-black rounded-2xl">
                        <p className="text-[10px] uppercase font-extrabold text-slate-500">Mains Stopcock</p>
                        <p className="text-xs font-black text-slate-900 mt-1">{stopcockLocation || "Under sink"}</p>
                      </div>

                      <div className="p-3.5 bg-slate-50 border border-black rounded-2xl">
                        <p className="text-[10px] uppercase font-extrabold text-slate-500">Fuseboard (Consumer Unit)</p>
                        <p className="text-xs font-black text-slate-900 mt-1">{fuseboardLocation || "Hall cupboard"}</p>
                      </div>

                      {paintCodes && (
                        <div className="p-3.5 bg-slate-50 border border-black rounded-2xl col-span-2 sm:col-span-3">
                          <p className="text-[10px] uppercase font-extrabold text-slate-500">Paint Codes & Finishes</p>
                          <p className="text-xs font-bold text-slate-900 mt-0.5">{paintCodes}</p>
                        </div>
                      )}
                    </div>

                    {/* Public Buyer Listing & Conveyancing Banner */}
                    <div className="p-4 bg-slate-50 border border-black rounded-2xl flex items-center justify-between gap-3">
                      <div>
                        <h5 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                          <QrCode className="w-4 h-4 text-purple-600" />
                          Public Buyer View & QR Badge
                        </h5>
                        <p className="text-[11px] text-slate-600 font-medium">
                          Estate agent brochure QR badges, Rightmove embed code, and buyer digital twin preview.
                        </p>
                      </div>
                      <a
                        href={`/passport/view/${property.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black flex items-center gap-1 shrink-0 shadow-sm transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Preview Buyer View
                      </a>
                    </div>
                  </div>
                )}

                {/* Privacy Share Bridge Card */}
                <div className="p-4 bg-gradient-to-r from-slate-900 to-blue-950 text-white rounded-2xl border border-black space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-extrabold text-sm flex items-center gap-1.5">
                        <Share2 className="w-4 h-4 text-emerald-400" />
                        Strategy 1 Privacy Share Link
                      </h5>
                      <p className="text-xs text-slate-300">
                        Share complete Property Passport with tradespeople or buyers without exposing your phone number.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleShareWhatsApp}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl border border-black/30 flex items-center justify-center gap-2 transition"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Send to WhatsApp
                    </button>
                    <button
                      onClick={handleCopyLink}
                      className="py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 flex items-center gap-1.5 transition"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedLink ? "Copied" : "Copy Link"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "certs" && (
              <div className="space-y-4">
                <h4 className="font-black text-slate-900 text-sm">Landlord & Homeowner Compliance Certificates</h4>

                <div className="space-y-3">
                  {/* Gas Safety */}
                  <div className={`p-4 rounded-2xl border ${isGasExpiringSoon ? 'border-amber-500 bg-amber-50' : 'border-black bg-slate-50'} space-y-3`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${isGasExpiringSoon ? 'bg-amber-200 text-amber-900' : 'bg-blue-100 text-blue-700'}`}>
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-black text-slate-900 text-sm">Gas Safety Certificate (CP12)</p>
                          <p className="text-xs text-slate-600">
                            Expires: <span className="font-bold">{gasSafetyExpiry || "Not configured"}</span>
                          </p>
                        </div>
                      </div>
                      <div>
                        <input
                          type="date"
                          value={gasSafetyExpiry}
                          onChange={(e) => setGasSafetyExpiry(e.target.value)}
                          className="p-1.5 border border-black rounded-lg text-xs font-bold bg-white"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => handleOneTapDispatch({
                          idKey: "cp12",
                          title: `Gas Safety Inspection & CP12 Certificate (${property.name || 'Property'})`,
                          category: "Heating & Gas",
                          description: `Urgent Gas Safety Inspection required for CP12 renewal. Property boiler spec: ${boilerBrand} ${boilerModel}.`,
                          budget: "110",
                          urgency: isGasExpiringSoon ? "urgent" : "routine"
                        })}
                        disabled={dispatchingJobId === "cp12"}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl border border-blue-500 shadow-sm transition flex items-center gap-1.5"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-300" />
                        {dispatchingJobId === "cp12" ? "Dispatching..." : "1-Tap Dispatch Gas Engineer"}
                      </button>
                    </div>
                  </div>

                  {/* EICR */}
                  <div className={`p-4 rounded-2xl border ${isEicrExpiringSoon ? 'border-amber-500 bg-amber-50' : 'border-black bg-slate-50'} space-y-3`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${isEicrExpiringSoon ? 'bg-amber-200 text-amber-900' : 'bg-purple-100 text-purple-700'}`}>
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-black text-slate-900 text-sm">Electrical Installation Condition (EICR)</p>
                          <p className="text-xs text-slate-600">
                            Expires: <span className="font-bold">{eicrExpiry || "Not configured"}</span>
                          </p>
                        </div>
                      </div>
                      <div>
                        <input
                          type="date"
                          value={eicrExpiry}
                          onChange={(e) => setEicrExpiry(e.target.value)}
                          className="p-1.5 border border-black rounded-lg text-xs font-bold bg-white"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => handleOneTapDispatch({
                          idKey: "eicr",
                          title: `EICR Electrical Safety Inspection (${property.name || 'Property'})`,
                          category: "Electrical",
                          description: `5-year EICR electrical inspection & certificate renewal. Full wiring & consumer unit test required.`,
                          budget: "180",
                          urgency: isEicrExpiringSoon ? "urgent" : "routine"
                        })}
                        disabled={dispatchingJobId === "eicr"}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-xl border border-purple-500 shadow-sm transition flex items-center gap-1.5"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-300" />
                        {dispatchingJobId === "eicr" ? "Dispatching..." : "1-Tap Dispatch Electrician"}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSavePassport}
                  disabled={saving}
                  className="w-full py-3 bg-slate-900 text-white font-extrabold text-xs rounded-xl border border-black shadow-md hover:bg-slate-800 transition"
                >
                  {saving ? "Updating Certificates..." : "Save Compliance Expiries"}
                </button>
              </div>
            )}

            {activeTab === "tenant" && (
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-emerald-900 to-slate-900 text-white rounded-2xl border border-black space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-extrabold text-sm flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-emerald-400" />
                        Tenant Issue Reporting Link
                      </h5>
                      <p className="text-xs text-slate-300">
                        Share this link with your tenants so they can report maintenance repairs directly into your Property Passport.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleCopyTenantPortalLink}
                      className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl border border-emerald-500 flex items-center gap-1.5 transition shadow-sm"
                    >
                      {copiedTenantLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedTenantLink ? "Tenant Link Copied!" : "Copy Tenant Reporting Link"}
                    </button>
                  </div>
                </div>

                <h4 className="font-black text-slate-900 text-sm">Tenant Reported Issues & Repair Requests</h4>

                {tenantIssues.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl border border-black">
                    No open tenant issues reported for this property. Share the Tenant Link above with your tenants to capture repairs directly!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tenantIssues.map((issue) => (
                      <div key={issue.id} className="p-4 bg-white rounded-2xl border border-black shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${
                            issue.urgency === 'emergency' ? 'bg-red-100 text-red-800 border border-red-300' :
                            issue.urgency === 'urgent' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                            'bg-blue-100 text-blue-800 border border-blue-300'
                          }`}>
                            {issue.urgency?.toUpperCase() || 'ROUTINE'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">
                            {issue.createdAt ? new Date(issue.createdAt).toLocaleDateString() : 'Recent'}
                          </span>
                        </div>

                        <div>
                          <p className="font-black text-slate-900 text-sm">{issue.title}</p>
                          <p className="text-xs text-slate-600 mt-1">{issue.description}</p>
                        </div>

                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 flex flex-wrap gap-x-4 gap-y-1 font-semibold">
                          <span>Tenant: <strong className="text-slate-900">{issue.tenantName}</strong> {issue.flatUnit ? `(${issue.flatUnit})` : ''}</span>
                          <span>Tel: <strong className="text-slate-900">{issue.tenantPhone}</strong></span>
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            onClick={() => handleOneTapDispatch({
                              idKey: issue.id,
                              title: `Tenant Repair: ${issue.title}`,
                              category: issue.category || "General Repair",
                              description: `TENANT REPORTED REPAIR: ${issue.description}\nTenant Contact: ${issue.tenantName} (${issue.tenantPhone}, ${issue.flatUnit || 'Main'})`,
                              budget: issue.urgency === 'emergency' ? "180" : "120",
                              urgency: issue.urgency || "urgent"
                            })}
                            disabled={dispatchingJobId === issue.id}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl border border-blue-500 shadow-md transition flex items-center gap-1.5"
                          >
                            <Zap className="w-4 h-4 text-amber-300" />
                            {dispatchingJobId === issue.id ? "Dispatching..." : "⚡ 1-Tap Dispatch Trade for Tenant"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "history" && (
              <div className="space-y-4">
                {/* Investment & Valuation Impact Header */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                    <p className="text-[10px] font-extrabold uppercase text-blue-800">Total Work Invested</p>
                    <p className="text-xl font-black text-blue-950 mt-1">£{totalInvestment.toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                    <p className="text-[10px] font-extrabold uppercase text-emerald-800 flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Est. Property Value Added
                    </p>
                    <p className="text-xl font-black text-emerald-950 mt-1">+£{estimatedValueImpact.toLocaleString()}</p>
                  </div>
                </div>

                <h4 className="font-black text-slate-900 text-sm pt-2">Completed Maintenance & Improvement Jobs</h4>

                {completedJobs.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl border border-black">
                    No completed maintenance jobs recorded yet. Jobs posted on AnyTrader for this property address will automatically attach here.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {completedJobs.map((job) => (
                      <div key={job.id} className="p-3.5 bg-white rounded-2xl border border-black flex items-center justify-between">
                        <div>
                          <p className="font-extrabold text-xs text-slate-900">{job.title}</p>
                          <p className="text-[10px] text-slate-500">{job.category} • Completed on {job.completedAt ? new Date(job.completedAt).toLocaleDateString() : 'Recent'}</p>
                        </div>
                        <p className="font-black text-slate-900 text-xs">£{Number(job.agreedAmount || job.budget || 0).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "predictive" && (
              <div className="space-y-4">
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-extrabold text-sm text-purple-900">TradeOS AI Predictive Maintenance Engine</h5>
                    <p className="text-xs text-purple-800">
                      Automated analysis of appliance ages, certificate renewal schedules, and seasonal weather trends.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="p-4 bg-white rounded-2xl border border-black shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Annual Boiler Servicing & Flue Check
                      </span>
                      <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Recommended</span>
                    </div>
                    <p className="text-xs text-slate-600 pl-5">
                      Boiler ({boilerBrand || "Boiler"}) is {boilerAge} years old. Regular servicing prevents winter breakdown risks.
                    </p>
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => handleOneTapDispatch({
                          idKey: "pred-boiler",
                          title: `Annual Boiler Service & Maintenance (${boilerBrand || 'Boiler'})`,
                          category: "Heating & Gas",
                          description: `Annual boiler service for ${boilerBrand} ${boilerModel} (${boilerAge} yrs old). Pressure test, safety check & flue test.`,
                          budget: "95",
                          urgency: "routine"
                        })}
                        disabled={dispatchingJobId === "pred-boiler"}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl border border-blue-500 shadow-sm transition flex items-center gap-1.5"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-300" />
                        {dispatchingJobId === "pred-boiler" ? "Dispatching..." : "1-Tap Dispatch Boiler Engineer"}
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-white rounded-2xl border border-black shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Autumn Gutter & Roof Inspection
                      </span>
                      <span className="text-[10px] font-extrabold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">Seasonal Alert</span>
                    </div>
                    <p className="text-xs text-slate-600 pl-5">
                      Roof condition is currently flagged as "{roofCondition}". Schedule a quick roof check before winter rain.
                    </p>
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => handleOneTapDispatch({
                          idKey: "pred-roof",
                          title: `Roof Tile & Gutter Inspection (${property.name || 'Property'})`,
                          category: "Roofing",
                          description: `Roof & gutter inspection. Current condition flagged as '${roofCondition}'. Clear debris & check flashing.`,
                          budget: "130",
                          urgency: "routine"
                        })}
                        disabled={dispatchingJobId === "pred-roof"}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-xl border border-purple-500 shadow-sm transition flex items-center gap-1.5"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-300" />
                        {dispatchingJobId === "pred-roof" ? "Dispatching..." : "1-Tap Dispatch Roofer"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sticky Bottom Footer with Close / Back Button */}
          <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
            <p className="text-xs text-slate-600 font-bold truncate pr-2">
              Property Passport • {property.name || "Digital Twin"}
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 hover:bg-black text-white font-extrabold text-xs rounded-xl border border-black shadow-md flex items-center gap-1.5 transition shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-slate-300" />
              Close Passport
            </button>
          </div>
        </motion.div>
      </div>

      {showTransferModal && (
        <TransferOwnershipModal
          property={property}
          onClose={() => setShowTransferModal(false)}
          onUpdated={() => {
            setShowTransferModal(false);
            if (onUpdated) onUpdated();
          }}
        />
      )}

      {showBuyerPackModal && (
        <BuyerPackModal
          property={property}
          completedJobs={completedJobs}
          onClose={() => setShowBuyerPackModal(false)}
        />
      )}
    </AnimatePresence>
  );
}

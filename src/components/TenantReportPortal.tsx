import React, { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { db, doc, getDoc, collection, addDoc, handleFirestoreError, OperationType } from "@/src/firebase";
import { Home, Wrench, AlertTriangle, CheckCircle2, ShieldAlert, Phone, User, FileText, ArrowLeft, Send, Camera, Clock, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

export function TenantReportPortal() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const propertyId = searchParams.get("propertyId") || "";

  const [property, setProperty] = useState<any>(null);
  const [loadingProperty, setLoadingProperty] = useState(!!propertyId);

  // Form state
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [flatUnit, setFlatUnit] = useState("");
  const [category, setCategory] = useState("Plumbing & Water Leak");
  const [urgency, setUrgency] = useState<"emergency" | "urgent" | "routine">("urgent");
  const [issueTitle, setIssueTitle] = useState("");
  const [description, setDescription] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedIssueId, setSubmittedIssueId] = useState<string | null>(null);

  useEffect(() => {
    if (!propertyId) return;
    async function fetchProperty() {
      try {
        const docRef = doc(db, "properties", propertyId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setProperty({ id: snap.id, ...snap.data() });
        }
      } catch (err) {
        console.error("Error fetching property for tenant portal:", err);
      } finally {
        setLoadingProperty(false);
      }
    }
    fetchProperty();
  }, [propertyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueTitle || !description || !tenantName) {
      toast.error("Please fill in your name, issue title, and description.");
      return;
    }

    setSubmitting(true);
    try {
      const issueRef = await addDoc(collection(db, "tenant_issues"), {
        propertyId: propertyId || "manual",
        propertyName: property?.name || manualAddress || "Home Property",
        address: property?.address?.line1 || manualAddress || "UK Address",
        postcode: property?.address?.postcode || "",
        landlordOwnerId: property?.ownerId || null,
        tenantName,
        tenantPhone,
        tenantEmail,
        flatUnit,
        category,
        urgency,
        title: issueTitle,
        description,
        status: "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      setSubmittedIssueId(issueRef.id);
      toast.success("Repair issue logged in Property Passport successfully!");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "tenant_issues");
      toast.error("Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-6 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Subtle Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-950/40 via-slate-900 to-black pointer-events-none" />

      <div className="relative z-10 w-full max-w-xl bg-slate-900/90 border border-white/20 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white tracking-tight">Tenant Repair Portal</h1>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full">
                  Property Passport Direct
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {property?.name ? `Reporting for ${property.name}` : "Report maintenance & emergency repairs directly to property owner"}
              </p>
            </div>
          </div>
          <Link to="/dashboard" className="p-2 text-slate-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </div>

        {submittedIssueId ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8 space-y-4">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-white">Repair Request Logged!</h2>
            <p className="text-sm text-slate-300 max-w-md mx-auto">
              Your issue has been attached directly to the landlord's <span className="font-bold text-blue-400">Property Passport</span>. The landlord and local emergency trades receive instant notification.
            </p>
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-xs text-left space-y-2">
              <p className="text-slate-400 font-extrabold uppercase">Reference ID: <span className="text-white">{submittedIssueId}</span></p>
              <p className="text-slate-300"><span className="font-bold text-white">Category:</span> {category}</p>
              <p className="text-slate-300"><span className="font-bold text-white">Urgency:</span> {urgency.toUpperCase()}</p>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => { setSubmittedIssueId(null); setIssueTitle(""); setDescription(""); }}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs rounded-xl border border-white/20 transition"
              >
                Report Another Issue
              </button>
              <Link
                to="/dashboard"
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl border border-blue-500 shadow-md text-center transition"
              >
                Return to Dashboard
              </Link>
            </div>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Property details badge */}
            {property ? (
              <div className="p-3.5 bg-blue-950/60 border border-blue-500/30 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Home className="w-4 h-4 text-blue-400" />
                  <div>
                    <p className="text-xs font-black text-white">{property.name || "Property"}</p>
                    <p className="text-[11px] text-slate-300">{property.address?.line1 || "UK Address"}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-blue-300 bg-blue-900/80 px-2 py-1 rounded-lg">Verified Property</span>
              </div>
            ) : (
              <div>
                <label className="text-xs font-extrabold text-slate-300 block mb-1">Property Address / Postcode</label>
                <input
                  type="text"
                  placeholder="e.g. 14 High Street, Manchester, M1 2AB"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-white/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
            )}

            {/* Tenant details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-extrabold text-slate-300 block mb-1">Your Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Alex Johnson"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-white/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-300 block mb-1">Phone Number (for trade updates) *</label>
                <input
                  type="tel"
                  placeholder="07123 456789"
                  value={tenantPhone}
                  onChange={(e) => setTenantPhone(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-white/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-extrabold text-slate-300 block mb-1">Flat / Unit Number</label>
                <input
                  type="text"
                  placeholder="e.g. Flat 3B"
                  value={flatUnit}
                  onChange={(e) => setFlatUnit(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-white/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-300 block mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-white/20 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Plumbing & Water Leak">Plumbing & Water Leak</option>
                  <option value="Boiler & Heating Failure">Boiler & Heating Failure</option>
                  <option value="Electrical & Power Issue">Electrical & Power Issue</option>
                  <option value="Roofing, Gutters & Damp">Roofing, Gutters & Damp</option>
                  <option value="Locksmith & Window Lock">Locksmith & Window Lock</option>
                  <option value="Appliance Breakdown">Appliance Breakdown</option>
                  <option value="General Repair & Joinery">General Repair & Joinery</option>
                </select>
              </div>
            </div>

            {/* Urgency Level */}
            <div>
              <label className="text-xs font-extrabold text-slate-300 block mb-1.5">Urgency Level</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setUrgency("routine")}
                  className={`p-2.5 rounded-xl border text-xs font-extrabold transition flex flex-col items-center justify-center gap-1 ${
                    urgency === "routine" ? "bg-slate-800 border-slate-400 text-white" : "bg-slate-950 border-white/10 text-slate-400"
                  }`}
                >
                  <Clock className="w-4 h-4 text-blue-400" />
                  Routine (7 Days)
                </button>

                <button
                  type="button"
                  onClick={() => setUrgency("urgent")}
                  className={`p-2.5 rounded-xl border text-xs font-extrabold transition flex flex-col items-center justify-center gap-1 ${
                    urgency === "urgent" ? "bg-amber-950/80 border-amber-500 text-amber-300" : "bg-slate-950 border-white/10 text-slate-400"
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Urgent (24 Hours)
                </button>

                <button
                  type="button"
                  onClick={() => setUrgency("emergency")}
                  className={`p-2.5 rounded-xl border text-xs font-extrabold transition flex flex-col items-center justify-center gap-1 ${
                    urgency === "emergency" ? "bg-red-950 border-red-500 text-red-300 animate-pulse" : "bg-slate-950 border-white/10 text-slate-400"
                  }`}
                >
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  Emergency (Immediate)
                </button>
              </div>
            </div>

            {/* Issue Title & Description */}
            <div>
              <label className="text-xs font-extrabold text-slate-300 block mb-1">Issue Title *</label>
              <input
                type="text"
                placeholder="e.g. Boiler leaking water onto kitchen floor"
                value={issueTitle}
                onChange={(e) => setIssueTitle(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-white/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-slate-300 block mb-1">Full Description *</label>
              <textarea
                rows={3}
                placeholder="Describe what happened, where the issue is located, and any access details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-white/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-xl border border-blue-400 shadow-xl flex items-center justify-center gap-2 transition"
            >
              <Send className="w-4 h-4" />
              {submitting ? "Attaching to Property Passport..." : "Submit Repair Request to Landlord Passport"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

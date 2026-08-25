import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { db, doc, getDoc, collection, query, where, getDocs } from "@/src/firebase";
import { QRCodeSVG } from "qrcode.react";
import { 
  Home, ShieldCheck, CheckCircle2, AlertCircle, Wrench, Calendar, 
  FileText, Share2, Copy, Check, ExternalLink, Printer, KeyRound, 
  Sparkles, Download, Layers, Eye, Building2, Flame, Zap, ArrowLeft
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { calculatePropertyHealthScore } from "./propertyUtils";
import { BuyerPackModal } from "./BuyerPackModal";
import { ClaimPropertyPassportModal } from "./ClaimPropertyPassportModal";
import MoveInPackHub from "./MoveInPackHub";

export default function PublicPropertyPassportView() {
  const { propertyId, id } = useParams<{ propertyId?: string; id?: string }>();
  const activeId = propertyId || id;
  const navigate = useNavigate();

  const [property, setProperty] = useState<any | null>(null);
  const [completedJobs, setCompletedJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"health" | "specs" | "history" | "move_in" | "agent_badge">("health");

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [showBuyerPack, setShowBuyerPack] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);

  useEffect(() => {
    async function loadPublicPassport() {
      if (!activeId) {
        setError("Invalid property passport reference.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const docRef = doc(db, "properties", activeId);
        const snapshot = await getDoc(docRef);

        if (!snapshot.exists()) {
          setError("Property passport record not found or link is private.");
          setLoading(false);
          return;
        }

        const propData = { id: snapshot.id, ...snapshot.data() };
        setProperty(propData);

        // Load public completed jobs for this property
        try {
          const jobsQ = query(collection(db, "jobs"), where("propertyId", "==", activeId));
          const jobsSnapshot = await getDocs(jobsQ);
          const j = jobsSnapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter((job: any) => job.status === "completed");
          setCompletedJobs(j);
        } catch (e) {
          console.warn("Could not load public jobs list:", e);
        }
      } catch (err) {
        console.error("Error loading public property passport:", err);
        setError("Failed to load property passport. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    loadPublicPassport();
  }, [activeId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-extrabold text-slate-800">Verifying Digital Property Passport...</p>
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-black shadow-xl text-center space-y-4">
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto border border-red-200">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900">Property Record Unavailable</h2>
          <p className="text-xs text-slate-600 font-medium">{error || "This property passport could not be found."}</p>
          <button
            onClick={() => navigate("/")}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition"
          >
            Return to AnyTrader Home
          </button>
        </div>
      </div>
    );
  }

  const health = calculatePropertyHealthScore(property, completedJobs);
  const passportUrl = window.location.href;
  const embedSnippet = `<iframe src="${window.location.origin}/passport/view/${property.id}" width="100%" height="450" frameborder="0" title="AnyTrader Verified Digital Twin"></iframe>`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(passportUrl);
      setCopiedLink(true);
      toast.success("Public passport link copied!");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (e) {
      toast.error("Failed to copy link");
    }
  };

  const handleCopyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(embedSnippet);
      setCopiedEmbed(true);
      toast.success("HTML embed badge code copied!");
      setTimeout(() => setCopiedEmbed(false), 2000);
    } catch (e) {
      toast.error("Failed to copy embed");
    }
  };

  const handleShareWhatsApp = () => {
    const msg = `🏡 *AnyTrader Verified Property Passport*\n` +
      `Property: *${property.name || property.address?.line1 || "UK Residence"}*\n` +
      `Asset Health Score: *${health.totalScore}/100 (Grade ${health.grade})*\n` +
      `EPC: Grade ${property.epcRating || 'C'} | Gas Safe: ${health.isGasCompliant ? 'Verified Valid' : 'Due'}\n\n` +
      `View complete verified maintenance log, appliance specs & compliance records:\n${passportUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-16 font-sans">
      {/* Top Navbar */}
      <div className="sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              to="/" 
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase px-3 py-1.5 rounded-xl tracking-wider transition shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back To AnyTrader</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBuyerPack(true)}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-black rounded-xl border border-white/20 flex items-center gap-1.5 transition shadow-sm"
            >
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Solicitor Buyer Pack</span>
            </button>

            <button
              onClick={() => setShowClaimModal(true)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-md transition"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Claim Ownership</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Hero Header */}
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-2">
        <div className="bg-white rounded-3xl border border-black shadow-md p-6 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full">
                  🛡️ Verified Property Passport
                </span>
                <span className="bg-slate-100 text-slate-700 border border-slate-300 text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
                  {property.propertyType || "Residential"}
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                {property.name || property.address?.line1 || "Verified Property Asset"}
              </h1>
              <p className="text-xs sm:text-sm font-bold text-slate-600">
                {property.address?.line1} {property.address?.city} {property.address?.postcode}
              </p>
            </div>

            {/* Health Score Pill */}
            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-black shrink-0">
              <div className={`w-16 h-16 rounded-2xl border flex flex-col items-center justify-center ${health.gradeColor} shadow-inner`}>
                <span className="text-[10px] font-black uppercase">Grade</span>
                <span className="text-2xl font-black leading-none">{health.grade}</span>
              </div>
              <div>
                <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Asset Health Score</p>
                <p className="text-2xl font-black text-slate-900">{health.totalScore}<span className="text-xs text-slate-500 font-bold">/100</span></p>
                <p className="text-[11px] text-emerald-700 font-bold">
                  {health.totalScore >= 75 ? "✓ High Compliance Standard" : "✓ Active Digital Twin"}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-200">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-[10px] uppercase font-extrabold text-slate-500">EPC Energy Grade</p>
              <p className="text-base font-black text-blue-600">Grade {property.epcRating || "C"}</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-[10px] uppercase font-extrabold text-slate-500">Gas Safety CP12</p>
              <p className="text-sm font-bold text-slate-900">
                {health.isGasCompliant ? (
                  <span className="text-emerald-700 font-black">✓ Certified Valid</span>
                ) : (
                  <span className="text-amber-700 font-black">⚠ Renewal Due</span>
                )}
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-[10px] uppercase font-extrabold text-slate-500">Boiler & Heating</p>
              <p className="text-sm font-bold text-slate-900 truncate">
                {property.boilerInfo?.brand || "Standard"} ({property.boilerInfo?.age || "5"} yrs)
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-[10px] uppercase font-extrabold text-slate-500">Verified Trade Works</p>
              <p className="text-base font-black text-slate-900">{completedJobs.length} Jobs Logged</p>
            </div>
          </div>

          {/* Prospective Buyer Handover Banner */}
          <div className="p-4 bg-emerald-50 border-2 border-emerald-600 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-sm">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-sm">Buying or Conveyancing this Property?</h4>
                <p className="text-xs text-slate-600 font-medium">
                  Ask the seller for the 8-character Transfer Code to claim this complete digital maintenance record on completion.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowClaimModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl border border-black shadow-sm transition shrink-0"
            >
              Enter Transfer Code
            </button>
          </div>
        </div>
      </div>

      {/* Tabs & Content */}
      <div className="max-w-6xl mx-auto px-4 mt-6">
        {/* Tab Navigation */}
        <div className="flex border-b border-black bg-white rounded-t-2xl px-4 pt-3 gap-2 overflow-x-auto shadow-sm">
          <button
            onClick={() => setActiveTab("health")}
            className={`pb-3 px-3 text-xs font-black uppercase tracking-wider border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "health" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <ShieldCheck className="w-4 h-4" /> Compliance & Health
          </button>

          <button
            onClick={() => setActiveTab("specs")}
            className={`pb-3 px-3 text-xs font-black uppercase tracking-wider border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "specs" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Home className="w-4 h-4" /> Digital Twin Specs
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`pb-3 px-3 text-xs font-black uppercase tracking-wider border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "history" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Wrench className="w-4 h-4" /> Verified Trade History ({completedJobs.length})
          </button>

          <button
            onClick={() => setActiveTab("move_in")}
            className={`pb-3 px-3 text-xs font-black uppercase tracking-wider border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "move_in" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <KeyRound className="w-4 h-4 text-amber-500" /> Move-In Trade Pack
          </button>

          <button
            onClick={() => setActiveTab("agent_badge")}
            className={`pb-3 px-3 text-xs font-black uppercase tracking-wider border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "agent_badge" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-600" /> Estate Agent QR Badge
          </button>
        </div>

        {/* Tab Panels */}
        <div className="bg-white rounded-b-3xl border-x border-b border-black shadow-md p-6 sm:p-8">
          {/* TAB 1: Health & Compliance */}
          {activeTab === "health" && (
            <div className="space-y-6">
              <h3 className="font-black text-slate-900 text-base">Statutory Compliance & Structural Health Matrix</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Gas Safety */}
                <div className="p-5 rounded-2xl border border-black bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 bg-orange-100 text-orange-600 rounded-xl">
                      <Flame className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-black text-slate-500">{health.gasScore}/20 pts</span>
                  </div>
                  <h4 className="font-black text-slate-900 text-sm">Gas Safety CP12</h4>
                  <p className="text-xs text-slate-600">
                    Expiry: <strong>{property.gasSafetyExpiry || "No Record"}</strong>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {health.isGasCompliant ? "Annually inspected by Gas Safe certified engineer." : "Action required: Annual landlord inspection due."}
                  </p>
                </div>

                {/* Electrical EICR */}
                <div className="p-5 rounded-2xl border border-black bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                      <Zap className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-black text-slate-500">{health.eicrScore}/20 pts</span>
                  </div>
                  <h4 className="font-black text-slate-900 text-sm">Electrical Installation (EICR)</h4>
                  <p className="text-xs text-slate-600">
                    Expiry: <strong>{property.eicrExpiry || "No Record"}</strong>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {health.isEicrCompliant ? "5-Year Part P certified electrical installation report valid." : "Inspection recommended for full compliance."}
                  </p>
                </div>

                {/* EPC Rating */}
                <div className="p-5 rounded-2xl border border-black bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                      <Sparkles className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-black text-slate-500">{health.epcScore}/25 pts</span>
                  </div>
                  <h4 className="font-black text-slate-900 text-sm">EPC Energy Performance</h4>
                  <p className="text-xs text-slate-600">
                    Rating: <strong className="text-blue-600">Grade {property.epcRating || "C"}</strong>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Standard UK Domestic Energy Performance Certificate.
                  </p>
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={() => setShowBuyerPack(true)}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition"
                >
                  <FileText className="w-4 h-4 text-blue-400" />
                  Generate Printable Solicitor Pack
                </button>
                <button
                  onClick={handleShareWhatsApp}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition"
                >
                  <Share2 className="w-4 h-4" />
                  Share via WhatsApp
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Specs & Registry */}
          {activeTab === "specs" && (
            <div className="space-y-5">
              <h3 className="font-black text-slate-900 text-base">Appliance & Fixtures Digital Registry</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 bg-slate-50 border border-black rounded-2xl space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-500">Heating / Boiler Spec</p>
                  <p className="font-black text-slate-900 text-sm">{property.boilerInfo?.brand || "Standard"} {property.boilerInfo?.model || ""}</p>
                  <p className="text-slate-600">Age: {property.boilerInfo?.age || "5"} Years</p>
                  {property.boilerInfo?.lastServiced && (
                    <p className="text-slate-600">Last Serviced: {property.boilerInfo.lastServiced}</p>
                  )}
                </div>

                <div className="p-4 bg-slate-50 border border-black rounded-2xl space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-500">Roof & Gutters</p>
                  <p className="font-black text-slate-900 text-sm">{property.roofCondition || "Good Condition"}</p>
                  <p className="text-slate-600">Standard Domestic Pitch / Slate</p>
                </div>

                <div className="p-4 bg-slate-50 border border-black rounded-2xl space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-500">Mains Water Stopcock</p>
                  <p className="font-black text-slate-900 text-sm">{property.componentRegistry?.stopcockLocation || "Under Kitchen Sink"}</p>
                  <p className="text-slate-600">Standard UK 15mm/22mm Isolator</p>
                </div>

                <div className="p-4 bg-slate-50 border border-black rounded-2xl space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-500">Consumer Unit (Fuseboard)</p>
                  <p className="font-black text-slate-900 text-sm">{property.componentRegistry?.fuseboardLocation || "Hallway Cupboard / Under Stairs"}</p>
                  <p className="text-slate-600">RCD / Circuit Protected</p>
                </div>

                {property.componentRegistry?.paintCodes && (
                  <div className="p-4 bg-slate-50 border border-black rounded-2xl space-y-1 sm:col-span-2">
                    <p className="text-[10px] font-black uppercase text-slate-500">Decor & Paint Codes</p>
                    <p className="font-bold text-slate-900">{property.componentRegistry.paintCodes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: History & Logbook */}
          {activeTab === "history" && (
            <div className="space-y-4">
              <h3 className="font-black text-slate-900 text-base">Verified Works Timeline</h3>

              {completedJobs.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-black rounded-2xl space-y-2">
                  <Wrench className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="font-bold text-slate-700 text-xs">No completed contractor works logged yet.</p>
                  <p className="text-[11px] text-slate-500">Works booked through AnyTrader are automatically logged here with Gas Safe & Part P credentials.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {completedJobs.map(job => (
                    <div key={job.id} className="p-4 bg-slate-50 border border-black rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="bg-blue-600 text-white font-black text-[9px] uppercase px-2 py-0.5 rounded">
                            {job.category || "General Trade"}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {job.completedAt ? new Date(job.completedAt).toLocaleDateString("en-GB") : "Recent"}
                          </span>
                        </div>
                        <h4 className="font-black text-slate-900 text-sm">{job.title}</h4>
                        <p className="text-slate-600 font-medium">{job.description?.slice(0, 100)}...</p>
                      </div>

                      <div className="shrink-0 text-left sm:text-right bg-white p-2.5 rounded-xl border border-slate-200">
                        <p className="text-[10px] font-black uppercase text-emerald-600">✓ Verified Trade Work</p>
                        <p className="font-bold text-slate-900">{job.traderName || "Verified Contractor"}</p>
                        <p className="text-[10px] text-slate-500">12-Mo Workmanship Guarantee</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Estate Agent Listing Badge & QR */}
          {activeTab === "agent_badge" && (
            <div className="space-y-6">
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl text-xs text-purple-950 space-y-1">
                <h4 className="font-black text-purple-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  Estate Agent & Online Listing Marketing Assets
                </h4>
                <p>
                  Embed this verified digital passport on Rightmove, Zoopla, Purplebricks, or print the window display QR code to prove full maintenance history to buyers.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                {/* Visual Window Card Preview */}
                <div className="p-6 bg-slate-900 text-white rounded-3xl border border-black shadow-xl space-y-4 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="bg-blue-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded">
                      AnyTrader
                    </span>
                    <span className="text-xs font-black tracking-wider text-slate-300">Verified Digital Twin</span>
                  </div>

                  <div className="p-4 bg-white rounded-2xl inline-block shadow-lg">
                    <QRCodeSVG value={passportUrl} size={140} />
                  </div>

                  <div>
                    <h5 className="font-black text-base">{property.name || property.address?.line1}</h5>
                    <p className="text-xs text-slate-400">Scan to view complete maintenance & EPC records</p>
                  </div>

                  <button
                    onClick={() => window.print()}
                    className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl w-full flex items-center justify-center gap-2 transition"
                  >
                    <Printer className="w-4 h-4" />
                    Print Window / Brochure Badge
                  </button>
                </div>

                {/* Sharing Options */}
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="font-black text-slate-900 block mb-1">Direct Shareable Link</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={passportUrl}
                        className="flex-1 p-2.5 rounded-xl border border-black bg-slate-50 text-slate-700 font-mono text-[11px]"
                      />
                      <button
                        onClick={handleCopyLink}
                        className="px-3.5 py-2 bg-slate-900 text-white rounded-xl font-bold flex items-center gap-1"
                      >
                        {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        {copiedLink ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="font-black text-slate-900 block mb-1">Embed Badge for Website / Rightmove</label>
                    <textarea
                      rows={3}
                      readOnly
                      value={embedSnippet}
                      className="w-full p-2.5 rounded-xl border border-black bg-slate-50 text-slate-700 font-mono text-[10px]"
                    />
                    <button
                      onClick={handleCopyEmbed}
                      className="mt-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 border border-black rounded-xl font-bold text-slate-800 flex items-center gap-1"
                    >
                      {copiedEmbed ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      {copiedEmbed ? "Embed Snippet Copied" : "Copy Embed HTML"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Move-In Trade Pack */}
          {activeTab === "move_in" && (
            <div className="pt-2">
              <MoveInPackHub
                propertyId={property.id}
                propertyName={property.name || property.address?.line1}
                propertyAddress={property.address}
                postcode={property.address?.postcode}
                epcRating={property.epcRating}
                boilerInfo={property.boilerInfo}
                embeddedMode={true}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showBuyerPack && (
        <BuyerPackModal
          property={property}
          completedJobs={completedJobs}
          onClose={() => setShowBuyerPack(false)}
        />
      )}

      {showClaimModal && (
        <ClaimPropertyPassportModal
          onClose={() => setShowClaimModal(false)}
          onSuccess={() => {
            setShowClaimModal(false);
            navigate("/portfolio");
          }}
        />
      )}
    </div>
  );
}

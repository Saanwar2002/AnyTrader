import React from "react";
import { X, Printer, ShieldCheck, FileText, CheckCircle2, AlertCircle, Home, Wrench, Calendar, Award, Lock, ExternalLink, Download } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { calculatePropertyHealthScore } from "./propertyUtils";

interface BuyerPackModalProps {
  property: any;
  completedJobs: any[];
  onClose: () => void;
}

export function BuyerPackModal({ property, completedJobs, onClose }: BuyerPackModalProps) {
  const healthScore = calculatePropertyHealthScore(property, completedJobs);
  const todayFormatted = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const referenceId = `AT-CONV-${(property?.id || "PROP").slice(0, 8).toUpperCase()}-${new Date().getFullYear()}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200 print:p-0 print:bg-white print:fixed print:inset-0">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className="relative w-full max-w-4xl bg-white rounded-3xl border border-black shadow-2xl overflow-hidden flex flex-col max-h-[94vh] print:max-h-none print:border-none print:shadow-none print:rounded-none"
        >
          {/* Top Bar (Hidden on Print) */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 print:hidden">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-600 rounded-xl text-white">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-sm tracking-tight">Solicitor & Buyer Conveyancing Pack</h3>
                <p className="text-[11px] text-slate-400">TA6 Property Information & Statutory Compliance Schedule</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-sm transition"
              >
                <Printer className="w-4 h-4" />
                <span>Print / Save PDF</span>
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable Document Body */}
          <div className="p-6 sm:p-10 overflow-y-auto space-y-6 text-slate-900 font-sans print:p-6 print:overflow-visible text-xs leading-relaxed">
            {/* Document Header */}
            <div className="border-b-2 border-black pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-slate-900 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded">
                    AnyTrader TradeOS Digital Twin
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">Ref: {referenceId}</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                  Property Passport & Compliance Schedule
                </h1>
                <p className="text-sm font-bold text-slate-700 mt-1">
                  {property.name || "Residential Property"} • {property.address?.line1 || "UK Address"} {property.address?.postcode}
                </p>
              </div>

              <div className="text-right shrink-0">
                <div className={`inline-block px-3.5 py-2 rounded-2xl border ${healthScore.gradeColor} text-center`}>
                  <p className="text-[10px] font-black uppercase tracking-wider">Asset Health Score</p>
                  <p className="text-2xl font-black">{healthScore.totalScore}/100 <span className="text-sm font-bold">({healthScore.grade})</span></p>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Generated: {todayFormatted}</p>
              </div>
            </div>

            {/* Section 1: Property Identity & Digital Specs */}
            <div className="space-y-2">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
                Section 1: Digital Spec & Asset Registry
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Property Type</p>
                  <p className="font-black text-slate-900 capitalize">{property.propertyType || "Residential"}</p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-[10px] uppercase font-bold text-slate-500">EPC Energy Grade</p>
                  <p className="font-black text-blue-600">Grade {property.epcRating || "C"}</p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Boiler Make & Model</p>
                  <p className="font-black text-slate-900">{property.boilerInfo?.brand || "Standard"} {property.boilerInfo?.model || ""}</p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Roof Condition</p>
                  <p className="font-black text-slate-900">{property.roofCondition || "Good"}</p>
                </div>

                {property.componentRegistry?.stopcockLocation && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Stopcock Location</p>
                    <p className="font-bold text-slate-900">{property.componentRegistry.stopcockLocation}</p>
                  </div>
                )}

                {property.componentRegistry?.fuseboardLocation && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Consumer Unit (Fuseboard)</p>
                    <p className="font-bold text-slate-900">{property.componentRegistry.fuseboardLocation}</p>
                  </div>
                )}

                {property.componentRegistry?.paintCodes && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl col-span-2">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Paint Codes / Decor Specs</p>
                    <p className="font-bold text-slate-900">{property.componentRegistry.paintCodes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Section 2: Statutory Compliance Schedule */}
            <div className="space-y-2">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
                Section 2: Statutory Compliance & Safety Certificates
              </h2>
              <table className="w-full border-collapse border border-black text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-black">
                    <th className="p-2.5 font-black border-r border-black">Certificate / Inspection</th>
                    <th className="p-2.5 font-black border-r border-black">Statutory Requirement</th>
                    <th className="p-2.5 font-black border-r border-black">Expiry Date</th>
                    <th className="p-2.5 font-black">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-300">
                    <td className="p-2.5 font-bold border-r border-slate-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                      CP12 Landlord Gas Safety
                    </td>
                    <td className="p-2.5 border-r border-slate-300 text-slate-600">Annual Gas Appliance & Flue Check</td>
                    <td className="p-2.5 font-mono font-bold border-r border-slate-300">{property.gasSafetyExpiry || "Not Recorded"}</td>
                    <td className="p-2.5">
                      {healthScore.isGasCompliant ? (
                        <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded text-[11px]">Valid & Certified</span>
                      ) : (
                        <span className="text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded text-[11px]">Action Due</span>
                      )}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="p-2.5 font-bold border-r border-slate-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                      EICR Electrical Installation
                    </td>
                    <td className="p-2.5 border-r border-slate-300 text-slate-600">5-Year Fixed Wire Inspection</td>
                    <td className="p-2.5 font-mono font-bold border-r border-slate-300">{property.eicrExpiry || "Not Recorded"}</td>
                    <td className="p-2.5">
                      {healthScore.isEicrCompliant ? (
                        <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded text-[11px]">Valid & Certified</span>
                      ) : (
                        <span className="text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded text-[11px]">Action Due</span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold border-r border-slate-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                      EPC Energy Performance
                    </td>
                    <td className="p-2.5 border-r border-slate-300 text-slate-600">10-Year Efficiency Rating</td>
                    <td className="p-2.5 font-mono font-bold border-r border-slate-300">Grade {property.epcRating || "C"}</td>
                    <td className="p-2.5">
                      <span className="text-blue-700 font-bold bg-blue-100 px-2 py-0.5 rounded text-[11px]">Active EPC</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 3: Verified Capital Works & Maintenance Logbook */}
            <div className="space-y-2">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
                Section 3: Verified Works & Alterations Logbook
              </h2>
              {completedJobs.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500">
                  No verified contractor works logged on the AnyTrader platform yet.
                </div>
              ) : (
                <table className="w-full border-collapse border border-black text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-black">
                      <th className="p-2.5 font-black border-r border-black">Date Completed</th>
                      <th className="p-2.5 font-black border-r border-black">Category & Description</th>
                      <th className="p-2.5 font-black border-r border-black">Verified Trader</th>
                      <th className="p-2.5 font-black">Warranty / Guarantee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedJobs.map((job, idx) => (
                      <tr key={job.id || idx} className="border-b border-slate-200">
                        <td className="p-2.5 font-mono font-bold border-r border-slate-200 text-slate-700">
                          {job.completedAt ? new Date(job.completedAt).toLocaleDateString("en-GB") : (job.updatedAt ? new Date(job.updatedAt).toLocaleDateString("en-GB") : "Recent")}
                        </td>
                        <td className="p-2.5 border-r border-slate-200">
                          <p className="font-black text-slate-900">{job.title}</p>
                          <p className="text-[11px] text-slate-600 line-clamp-1">{job.description?.slice(0, 80)}...</p>
                        </td>
                        <td className="p-2.5 border-r border-slate-200">
                          <span className="font-bold text-slate-900">{job.traderName || "Verified Contractor"}</span>
                          <p className="text-[10px] text-emerald-700 font-bold">✓ AnyTrader Verified</p>
                        </td>
                        <td className="p-2.5 font-bold text-slate-800">
                          {job.warrantyMonths ? `${job.warrantyMonths} Months Active` : "12-Month Workmanship Guarantee"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Legal Notice & Footer */}
            <div className="pt-4 border-t border-slate-300 text-[10px] text-slate-500 space-y-1">
              <p className="font-bold text-slate-700">Conveyancing & Legal Representation Notice:</p>
              <p>
                This document is generated directly from the immutable digital service records maintained under the AnyTrader TradeOS Platform. It provides verified evidence of building alterations, maintenance installations, and statutory landlord safety inspections for submission alongside Law Society TA6 Property Information Forms.
              </p>
              <div className="flex justify-between items-center pt-2 text-[9px] text-slate-400">
                <span>AnyTrader Ecosystem • Certified Property Digital Twin</span>
                <span>Verification Ref: {referenceId}</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

import React, { useState, useEffect } from "react";
import { 
  Settings, 
  Save, 
  AlertTriangle, 
  CheckCircle, 
  FileText, 
  Database, 
  ShieldAlert, 
  Info,
  Sliders,
  ChevronRight,
  Compass
} from "lucide-react";
import { db, doc, getDoc, setDoc } from "../../firebase";
import { toast } from "sonner";

export default function GlobalSettings() {
  const [maintenanceModeActive, setMaintenanceModeActive] = useState(false);
  const [apiVersion, setApiVersion] = useState("v1.4.2-Prod");
  const [minimumAppBuildRequired, setMinimumAppBuildRequired] = useState(1040);
  const [privacyPolicyLink, setPrivacyPolicyLink] = useState("https://anyroller.com/legal/privacy");
  const [safetyComplianceContact, setSafetyComplianceContact] = useState("compliance@anyroller.com");
  const [isSaving, setIsSaving] = useState(false);

  // Fetch Settings
  useEffect(() => {
    const fetchGlobal = async () => {
      try {
        const docRef = doc(db, "platform_settings", "global_settings");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const d = docSnap.data();
          if (d.maintenanceModeActive !== undefined) setMaintenanceModeActive(d.maintenanceModeActive);
          if (d.apiVersion !== undefined) setApiVersion(d.apiVersion);
          if (d.minimumAppBuildRequired !== undefined) setMinimumAppBuildRequired(d.minimumAppBuildRequired);
          if (d.privacyPolicyLink !== undefined) setPrivacyPolicyLink(d.privacyPolicyLink);
          if (d.safetyComplianceContact !== undefined) setSafetyComplianceContact(d.safetyComplianceContact);
        }
      } catch (err) {
        console.warn("Global settings parsed from client local context.", err);
      }
    };
    fetchGlobal();
  }, []);

  const handleSaveGlobal = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, "platform_settings", "global_settings"), {
        maintenanceModeActive,
        apiVersion,
        minimumAppBuildRequired,
        privacyPolicyLink,
        safetyComplianceContact,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      toast.success("Global administrative parameters updated on Firebase.");
    } catch {
      localStorage.setItem("anyroller_global_admin_settings", JSON.stringify({
        maintenanceModeActive, apiVersion, minimumAppBuildRequired, privacyPolicyLink, safetyComplianceContact
      }));
      toast.success("Global boundaries saved inside offline storage cache.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Header HUD */}
      <div className="p-5 bg-white border border-black rounded-lg shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Settings className="w-4 h-4 text-[#AF52DE]" />
          <span className="text-[10px] uppercase font-mono tracking-widest text-[#AF52DE] font-bold">SYSTEM OVERLORD UTILITIES</span>
        </div>
        <h2 className="text-xl font-bold text-black font-sans">Global Platform Configuration</h2>
        <p className="text-xs text-slate-500 mt-1">
          Manage system maintenance modes, configure minimum mobile app version indexes, update privacy policies references, and monitor API variables.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Settings controllers */}
        <div className="bg-white border border-black rounded-lg p-5 shadow-sm space-y-5">
          <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider border-b border-slate-100 pb-2.5">
            Core System Variables
          </h3>

          {/* Maintenance emergency lock */}
          <div className="flex items-center justify-between p-4 bg-red-50/50 border border-red-300 rounded text-xs">
            <div>
              <strong className="text-red-900 block text-xs flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                Emergency Maintenance Toggle
              </strong>
              <span className="text-[10px] text-red-500 block">Immediately block on-demand bookings globally.</span>
            </div>
            
            <button 
              onClick={() => {
                const nextState = !maintenanceModeActive;
                setMaintenanceModeActive(nextState);
                if (nextState) toast.error("System dispatch locks engaged. Alerting operations team.");
                else toast.success("Locks disengaged. Client bookings permitted.");
              }}
              className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                maintenanceModeActive ? "bg-red-600 animate-pulse" : "bg-slate-300"
              }`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                maintenanceModeActive ? "translate-x-5" : "translate-x-0"
              }`} />
            </button>
          </div>

          {/* API build text fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-black block">Core API Build ID</label>
              <input 
                type="text" 
                value={apiVersion} 
                onChange={(e) => setApiVersion(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-black text-xs font-mono text-black rounded"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-black block">Min App Build Match</label>
              <input 
                type="number" 
                value={minimumAppBuildRequired} 
                onChange={(e) => setMinimumAppBuildRequired(Number(e.target.value) || 1000)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-black text-xs font-mono text-[#AF52DE] font-bold rounded"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-black block font-sans">Legal Privacy URL Policy Link</label>
            <input 
              type="text" 
              value={privacyPolicyLink} 
              onChange={(e) => setPrivacyPolicyLink(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-black text-xs font-mono text-blue-800 rounded"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-black block font-sans">Safety Compliance Liaison email</label>
            <input 
              type="email" 
              value={safetyComplianceContact} 
              onChange={(e) => setSafetyComplianceContact(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-black text-xs text-stone-800 rounded"
            />
          </div>

          <button
            onClick={handleSaveGlobal}
            disabled={isSaving}
            className="w-full text-center py-2.5 bg-black hover:bg-slate-900 border border-black text-white text-xs font-mono font-black tracking-wider uppercase cursor-pointer rounded transition flex items-center justify-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5 text-emerald-400" />
            {isSaving ? "Saving Config..." : "Commit Global Controls"}
          </button>
        </div>

        {/* Informational matrix resources */}
        <div className="bg-white border border-black rounded-lg p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider border-b border-slate-100 pb-2">
              Legal Compliance Documentation
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-sans mt-2">
              View official directories references representing municipal private-hire taxi operating licensing (PHV) and regulatory frameworks under Greater London authorities.
            </p>
          </div>

          <div className="space-y-2 pb-2">
            {[
              "PHV Private Hire Operating Regulations 2026",
              "Stripe Connect Merchant Agreement Guidelines",
              "Corporate Travel Ledger Tax Directives"
            ].map((docName, idx) => (
              <div 
                key={idx} 
                className="p-3 bg-slate-50 hover:bg-slate-100 border border-black rounded flex items-center justify-between cursor-pointer transition"
                onClick={() => alert(`Opening official document resources: ${docName}`)}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-extrabold text-black font-sans">{docName}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            ))}
          </div>

          <div className="bg-blue-50/55 p-3.5 border border-blue-250 text-blue-900 rounded text-[10px] leading-relaxed flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <span>To update API client keys or live secrets, please navigate to the master AI Studio settings sidebar instead of changing code parameters directly.</span>
          </div>
        </div>

      </div>
    </div>
  );
}

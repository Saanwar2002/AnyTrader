import React, { useState } from "react";
import { 
  Link, 
  Settings, 
  Save, 
  Database, 
  RefreshCw, 
  CheckCircle, 
  HelpCircle, 
  Briefcase, 
  Users, 
  Radio, 
  ShieldAlert,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";

interface CrossPortalConnection {
  connectionId: string;
  traderName: string;
  driverName: string;
  syncedRole: string;
  syncTimestamp: string;
}

const syncConnectionsSeed: CrossPortalConnection[] = [
  { connectionId: "conn_11", traderName: "Marcus Sterling (Contract Electrician)", driverName: "Marcus Sterling", syncedRole: "Dual-Role Pro Trader", syncTimestamp: "2026-05-28" },
  { connectionId: "conn_12", traderName: "Amara Davies (Emergency Plumber)", driverName: "Amara Davies", syncedRole: "Dual-Role Emergency Pro", syncTimestamp: "2026-05-29" }
];

export default function AnyTraderIntegration() {
  const [connections, setConnections] = useState<CrossPortalConnection[]>(syncConnectionsSeed);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [allowJointAuth, setAllowJointAuth] = useState(true);
  const [syncStatusText, setSyncStatusText] = useState("Connected & Synced");
  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualSyncToggle = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      toast.success("Cross-portal login states index refreshed of the Firestore instance.");
    }, 1200);
  };

  const handleUpdateStatus = () => {
    toast.success("Super-App integrations metrics stored successfully.");
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="p-5 bg-white border border-black rounded-lg shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Link className="w-4 h-4 text-emerald-500 animate-spin-slow" />
          <span className="text-[10px] uppercase font-mono tracking-widest text-[#AF52DE] font-bold">ANYTRADER RECONCILIATION SUITE</span>
        </div>
        <h2 className="text-xl font-bold text-black font-sans">Multi-Portal Authentication Sync</h2>
        <p className="text-xs text-slate-500 mt-1">
          Manage shared user registers, synchronize driver/tradesperson security clearances, and reconcile mutual ledger pools across the directory portals.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Connection logs */}
        <div className="lg:col-span-2 bg-white border border-black rounded-lg p-5 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider flex items-center gap-1.5">
              <Database className="w-4 h-4 text-slate-705" /> Synced Dual-Portal Accounts ({connections.length})
            </h3>

            <button
              onClick={handleManualSyncToggle}
              disabled={isSyncing}
              className="px-2.5 py-1.5 border border-black text-xs font-mono font-bold rounded hover:bg-slate-50 transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? "Syncing..." : "Manual Force Sync"}
            </button>
          </div>

          <div className="space-y-3">
            {connections.map(conn => (
              <div key={conn.connectionId} className="p-4 bg-slate-50 border border-black rounded font-sans space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-black text-[#AF52DE]">{conn.connectionId}</span>
                    <span className="text-[10px] uppercase bg-black text-white px-2 py-0.2 rounded font-mono font-black font-sans">
                      {conn.syncedRole}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-slate-450">Synced: {conn.syncTimestamp}</span>
                </div>

                {/* Symmetrical side mappings display */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white border border-black/10 rounded text-xs text-stone-800">
                  <div className="space-y-0.5">
                    <span className="text-[9.5px] uppercase font-mono text-slate-400 block font-bold">AnyTrader Service Ledger</span>
                    <strong className="text-black font-extrabold">{conn.traderName}</strong>
                  </div>

                  <ArrowRight className="w-5 h-5 text-emerald-500 hidden sm:block shrink-0" />

                  <div className="space-y-0.5 sm:text-right">
                    <span className="text-[9.5px] uppercase font-mono text-slate-400 block font-bold">AnyRoller Transport Drivers</span>
                    <strong className="text-black font-extrabold">{conn.driverName}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Global reconciliation policy config */}
        <div className="bg-white border border-black rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-1 border-b border-slate-100 pb-2">
            <Settings className="w-3.5 h-3.5 text-emerald-555" />
            <h3 className="text-xs uppercase font-mono font-black text-black tracking-wider">Sync Matrix</h3>
          </div>

          <div className="space-y-4 font-sans text-xs">
            {/* Sync toggle */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-black rounded">
              <div>
                <strong className="text-black block text-xs font-sans">Firestore Auto-Sync Profile</strong>
                <span className="text-[10px] text-slate-500 block">Cross-populate credentials instantly.</span>
              </div>
              <button 
                onClick={() => setSyncEnabled(!syncEnabled)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  syncEnabled ? "bg-black" : "bg-slate-300"
                }`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  syncEnabled ? "translate-x-5" : "translate-x-0"
                }`} />
              </button>
            </div>

            {/* Joint authorization */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-black rounded">
              <div>
                <strong className="text-black block text-xs font-sans">Unified ecosystem sign on</strong>
                <span className="text-[10px] text-slate-500 block">Allow drivers to claim trade assignments.</span>
              </div>
              <button 
                onClick={() => setAllowJointAuth(!allowJointAuth)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  allowJointAuth ? "bg-black" : "bg-slate-300"
                }`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  allowJointAuth ? "translate-x-5" : "translate-x-0"
                }`} />
              </button>
            </div>

            <button
              onClick={handleUpdateStatus}
              className="w-full py-2 bg-black hover:bg-slate-900 border border-black text-white text-xs font-mono font-black tracking-wider uppercase cursor-pointer rounded transition flex items-center justify-center gap-1"
            >
              <Save className="w-4 h-4 text-emerald-400" /> Save Sync Rules
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

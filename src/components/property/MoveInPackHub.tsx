import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../AuthProvider";
import { 
  MOVE_IN_BUNDLES, MoveInTask, 
  getStoredCompletedTasks, saveStoredCompletedTasks,
  getStoredSkippedTasks, saveStoredSkippedTasks 
} from "@/src/data/moveInBundles";
import { 
  Lock, Flame, Zap, Sparkles, Palette, Wrench, Trash2, Leaf, ShieldCheck,
  CheckCircle2, Clock, Plus, Search, Printer, Share2, RotateCcw,
  Check, ChevronRight, AlertCircle, Calendar, ArrowRight, Home, Building2, ExternalLink, Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { cn } from "@/src/lib/utils";

const iconComponentMap: Record<string, any> = {
  Lock, Flame, Zap, Sparkles, Palette, Wrench, Trash2, Leaf, ShieldCheck
};

interface MoveInPackHubProps {
  propertyId?: string;
  propertyName?: string;
  propertyAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    postcode?: string;
  };
  postcode?: string;
  epcRating?: string;
  boilerInfo?: any;
  agentName?: string;
  embeddedMode?: boolean;
  onPostJobRedirect?: (task: MoveInTask) => void;
}

export default function MoveInPackHub({
  propertyId = "default_prop",
  propertyName = "New Home",
  propertyAddress,
  postcode = "",
  epcRating = "C",
  boilerInfo,
  agentName,
  embeddedMode = false,
  onPostJobRedirect
}: MoveInPackHubProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>(() => getStoredCompletedTasks(propertyId));
  const [skippedTaskIds, setSkippedTaskIds] = useState<string[]>(() => getStoredSkippedTasks(propertyId));
  const [activeFilter, setActiveFilter] = useState<"all" | "security_safety" | "hygiene_setup" | "exterior_waste" | "smart_home" | "completed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [customTasks, setCustomTasks] = useState<MoveInTask[]>([]);
  const [showAddCustomModal, setShowAddCustomModal] = useState(false);
  const [newCustomTitle, setNewCustomTitle] = useState("");
  const [newCustomCategory, setNewCustomCategory] = useState("Handyman & Property Maintenance");
  const [newCustomUrgency, setNewCustomUrgency] = useState<"asap" | "flexible">("flexible");
  const [newCustomPrice, setNewCustomPrice] = useState("£50 – £150");
  const [newCustomDesc, setNewCustomDesc] = useState("");

  // Sync state when propertyId changes
  useEffect(() => {
    setCompletedTaskIds(getStoredCompletedTasks(propertyId));
    setSkippedTaskIds(getStoredSkippedTasks(propertyId));
  }, [propertyId]);

  const allAvailableTasks = useMemo(() => {
    return [...MOVE_IN_BUNDLES, ...customTasks];
  }, [customTasks]);

  const toggleTaskDone = (taskId: string) => {
    setCompletedTaskIds((prev) => {
      const isDone = prev.includes(taskId);
      const updated = isDone ? prev.filter((id) => id !== taskId) : [...prev, taskId];
      saveStoredCompletedTasks(propertyId, updated);
      if (!isDone) {
        toast.success("Task marked as completed! Digital twin updated.");
      }
      return updated;
    });
  };

  const toggleTaskSkip = (taskId: string) => {
    setSkippedTaskIds((prev) => {
      const isSkipped = prev.includes(taskId);
      const updated = isSkipped ? prev.filter((id) => id !== taskId) : [...prev, taskId];
      saveStoredSkippedTasks(propertyId, updated);
      toast.info(isSkipped ? "Task restored to active list." : "Task skipped from checklist.");
      return updated;
    });
  };

  const handleLaunchPostJob = (task: MoveInTask) => {
    if (onPostJobRedirect) {
      onPostJobRedirect(task);
      return;
    }

    const effectivePostcode = postcode || propertyAddress?.postcode || "";
    const effectiveAddress = propertyAddress?.line1 || propertyName || "";

    navigate("/post-job", {
      state: {
        title: task.prefilledTitle,
        category: task.category,
        subcategory: task.subcategory,
        description: task.prefilledDescription + (effectiveAddress ? `\n\nProperty Location: ${effectiveAddress}` : ""),
        urgency: task.urgency,
        quoteScope: task.quoteScope,
        linkedPropertyId: propertyId !== "default_prop" ? propertyId : undefined,
        linkedPropertyName: propertyName,
        postcode: effectivePostcode,
        prefilledByAI: true,
        source: "move_in_pack"
      }
    });
  };

  const handleAddCustomTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomTitle.trim()) {
      toast.error("Please provide a task title.");
      return;
    }

    const newTask: MoveInTask = {
      id: `custom_${Date.now()}`,
      title: newCustomTitle.trim(),
      category: newCustomCategory,
      subcategory: "General Maintenance",
      phase: "hygiene_setup",
      phaseLabel: "Custom Move-In Task",
      priority: "Recommended",
      priorityColor: "bg-blue-100 text-blue-800 border-blue-200",
      priceRange: newCustomPrice || "£50 – £150",
      estimatedHours: "2–4 hrs",
      urgency: newCustomUrgency,
      quoteScope: "complete_package",
      whyRecommended: "Custom homeowner task added for property move-in readiness.",
      prefilledTitle: newCustomTitle.trim(),
      prefilledDescription: newCustomDesc.trim() || `Custom move-in task: ${newCustomTitle.trim()}`,
      iconName: "Wrench",
      tags: ["Custom Task", "Homeowner Planned"]
    };

    setCustomTasks((prev) => [...prev, newTask]);
    setShowAddCustomModal(false);
    setNewCustomTitle("");
    setNewCustomDesc("");
    toast.success("Custom move-in task added to your checklist!");
  };

  const filteredTasks = useMemo(() => {
    return allAvailableTasks.filter((task) => {
      const isDone = completedTaskIds.includes(task.id);
      const isSkipped = skippedTaskIds.includes(task.id);

      if (activeFilter === "completed") {
        if (!isDone && !isSkipped) return false;
      } else if (activeFilter !== "all") {
        if (task.phase !== activeFilter) return false;
        if (isSkipped) return false;
      } else {
        if (isSkipped) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          task.title.toLowerCase().includes(q) ||
          task.category.toLowerCase().includes(q) ||
          task.tags.some((t) => t.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [allAvailableTasks, completedTaskIds, skippedTaskIds, activeFilter, searchQuery]);

  const totalCount = allAvailableTasks.length;
  const completedCount = completedTaskIds.length;
  const progressPct = Math.round((completedCount / (totalCount || 1)) * 100);

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    const text = `🏡 *New Home Move-In Trade Checklist*\n` +
      `Property: *${propertyAddress?.line1 || propertyName}*\n` +
      `Progress: *${completedCount}/${totalCount} completed (${progressPct}%)*\n\n` +
      `Explore recommended move-in trades & 1-click quotes on AnyTrader:\n${window.location.origin}/move-in?postcode=${encodeURIComponent(postcode || "")}&address=${encodeURIComponent(propertyAddress?.line1 || "")}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className={cn("space-y-6", embeddedMode ? "" : "max-w-6xl mx-auto px-4 py-6")}>
      {/* Header & Status Card */}
      <div className="bg-white rounded-3xl border border-black shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-black uppercase px-3 py-1 rounded-full flex items-center gap-1.5">
                📦 New Home Move-In Pack
              </span>
              {agentName && (
                <span className="bg-slate-100 text-slate-700 border border-slate-300 text-[11px] font-extrabold px-3 py-1 rounded-full">
                  Partnered with {agentName}
                </span>
              )}
              <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-extrabold px-3 py-1 rounded-full">
                Zero Lead Fees
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Move-In Readiness & Trade Recommendations
            </h1>

            <p className="text-xs sm:text-sm font-bold text-slate-600">
              {propertyAddress?.line1 || propertyName} {postcode ? `• ${postcode}` : ""}
              {epcRating ? ` • EPC Grade ${epcRating}` : ""}
            </p>
          </div>

          {/* Actions & Progress Box */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <div className="bg-slate-50 p-4 rounded-2xl border border-black flex items-center gap-4 min-w-[220px]">
              <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
                <svg className="w-14 h-14 transform -rotate-90">
                  <circle
                    cx="28"
                    cy="28"
                    r="22"
                    stroke="#E2E8F0"
                    strokeWidth="5"
                    fill="transparent"
                  />
                  <circle
                    cx="28"
                    cy="28"
                    r="22"
                    stroke="#2563EB"
                    strokeWidth="5"
                    fill="transparent"
                    strokeDasharray={138.2}
                    strokeDashoffset={138.2 - (138.2 * progressPct) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-500 ease-out"
                  />
                </svg>
                <span className="absolute text-xs font-black text-slate-900">{progressPct}%</span>
              </div>
              <div>
                <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Checklist Progress</p>
                <p className="text-lg font-black text-slate-900">{completedCount} of {totalCount} Done</p>
                <p className="text-[10px] text-emerald-600 font-bold">
                  {completedCount === totalCount ? "✓ Home 100% Certified" : "Self-paced booking"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                title="Print Move-In Checklist"
                className="p-3 bg-slate-100 hover:bg-slate-200 border border-black rounded-xl text-slate-800 transition"
              >
                <Printer className="w-4 h-4" />
              </button>
              <button
                onClick={handleShareWhatsApp}
                title="Share Checklist on WhatsApp"
                className="p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl text-emerald-700 transition"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowAddCustomModal(true)}
                className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Task</span>
              </button>
            </div>
          </div>
        </div>

        {/* Informative Guidance Callout */}
        <div className="p-4 bg-blue-50/80 rounded-2xl border border-blue-200 flex items-start gap-3.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
            <Info className="w-4 h-4" />
          </div>
          <div className="text-xs text-blue-950 leading-relaxed">
            <p className="font-extrabold text-blue-900">How Move-In Trade Bundles Work:</p>
            <p className="font-medium text-blue-800 mt-0.5">
              These industry-recommended trade essentials are tailored for new home buyers and tenants. You are in full control: 
              tap <strong>"⚡ Post This Job"</strong> at any time to open our 1-click pre-filled wizard, or <strong>"Mark as Done"</strong> if already resolved.
            </p>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white rounded-2xl border border-black shadow-sm p-4 space-y-4">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* Phase Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0 scrollbar-none">
            {[
              { id: "all", label: `All (${totalCount})` },
              { id: "security_safety", label: "🚨 Security & Safety" },
              { id: "hygiene_setup", label: "🧹 Hygiene & Setup" },
              { id: "exterior_waste", label: "🚛 Exterior & Waste" },
              { id: "smart_home", label: "🛡️ Smart Home" },
              { id: "completed", label: `✓ Done (${completedCount})` }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id as any)}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all shrink-0",
                  activeFilter === tab.id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search move-in tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 transition"
            />
          </div>
        </div>
      </div>

      {/* Move-In Tasks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <AnimatePresence mode="popLayout">
          {filteredTasks.map((task) => {
            const IconComp = iconComponentMap[task.iconName] || Wrench;
            const isDone = completedTaskIds.includes(task.id);
            const isSkipped = skippedTaskIds.includes(task.id);

            return (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                  "bg-white rounded-3xl border border-black shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden relative group",
                  isDone ? "bg-slate-50/80 border-slate-300 opacity-80" : ""
                )}
              >
                {/* Header Badge */}
                <div className="p-5 pb-3 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border", task.priorityColor)}>
                        {task.priority}
                      </span>
                      <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                        {task.phaseLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isDone && (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Done
                        </span>
                      )}
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 group-hover:bg-blue-50 group-hover:text-blue-600 transition">
                        <IconComp className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className={cn("text-base font-black text-slate-900 leading-tight", isDone ? "line-through text-slate-500" : "")}>
                      {task.title}
                    </h3>
                    <p className="text-[11px] font-bold text-slate-500 mt-1">
                      {task.category} • <span className="text-slate-800 font-extrabold">{task.subcategory}</span>
                    </p>
                  </div>

                  {/* Pricing & Duration Bar */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-[9px] uppercase font-black text-slate-400 block leading-tight">Typical Price</span>
                      <span className="font-black text-blue-700">{task.priceRange}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] uppercase font-black text-slate-400 block leading-tight">Est. Time</span>
                      <span className="font-extrabold text-slate-700">{task.estimatedHours}</span>
                    </div>
                  </div>

                  {/* Why Recommended Callout */}
                  <p className="text-xs text-slate-600 font-medium leading-relaxed bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                    💡 <strong className="text-slate-900">Why:</strong> {task.whyRecommended}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {task.tags.map((tag, idx) => (
                      <span key={idx} className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="p-4 pt-3 bg-slate-50/80 border-t border-slate-200 space-y-2">
                  {!isDone ? (
                    <button
                      onClick={() => handleLaunchPostJob(task)}
                      className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm transition group/btn"
                    >
                      <span>⚡ Post This Job (Pre-Filled)</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleLaunchPostJob(task)}
                      className="w-full py-2.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
                    >
                      <span>Re-Post This Job</span>
                    </button>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleTaskDone(task.id)}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 transition border",
                        isDone
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                      )}
                    >
                      <Check className="w-3 h-3" />
                      <span>{isDone ? "Mark Incomplete" : "Mark as Done"}</span>
                    </button>

                    <button
                      onClick={() => toggleTaskSkip(task.id)}
                      title={isSkipped ? "Restore task" : "Skip / Not Needed"}
                      className="py-2 px-3 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-[11px] font-bold text-slate-500 transition"
                    >
                      {isSkipped ? "Restore" : "Skip"}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredTasks.length === 0 && (
        <div className="bg-white rounded-3xl border border-black p-12 text-center space-y-4">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-200">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-slate-900">No tasks in this view</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            You've completed or filtered out all tasks in this section. Switch tabs or add a custom task.
          </p>
          <button
            onClick={() => setActiveFilter("all")}
            className="px-5 py-2.5 bg-slate-900 text-white text-xs font-black rounded-xl hover:bg-slate-800 transition"
          >
            View All Tasks
          </button>
        </div>
      )}

      {/* Add Custom Task Modal */}
      {showAddCustomModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl border border-black shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-900">Add Custom Move-In Task</h3>
              <button
                onClick={() => setShowAddCustomModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-black text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCustomTask} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fit Cat Flap in Back UPVC Door"
                  value={newCustomTitle}
                  onChange={(e) => setNewCustomTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-black rounded-xl text-sm font-bold text-slate-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={newCustomCategory}
                    onChange={(e) => setNewCustomCategory(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-black rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
                  >
                    <option value="Handyman & Property Maintenance">Handyman & Maintenance</option>
                    <option value="Locksmith & Security">Locksmith & Security</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Gas Safe & Heating">Gas Safe & Heating</option>
                    <option value="Plumbing & Drainage">Plumbing & Drainage</option>
                    <option value="Painting & Decorating">Painting & Decorating</option>
                    <option value="Gardening & Landscaping">Gardening & Landscaping</option>
                    <option value="Carpentry & Joinery">Carpentry & Joinery</option>
                    <option value="Specialist Cleaning">Specialist Cleaning</option>
                    <option value="Waste & Clearance">Waste & Clearance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                    Estimated Price
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. £80 – £140"
                    value={newCustomPrice}
                    onChange={(e) => setNewCustomPrice(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-black rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                  Task Specifications / Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide any specific measurements, materials on site, or access details..."
                  value={newCustomDesc}
                  onChange={(e) => setNewCustomDesc(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-black rounded-xl text-xs font-medium text-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition shadow-sm"
                >
                  Save Task
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

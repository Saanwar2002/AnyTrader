import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import {
  db,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "@/src/firebase";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  Calendar as CalendarIcon,
  Clock,
  DollarSign,
  Plus,
  Video,
  CalendarCheck,
  Loader2,
  Link2,
  Monitor,
  Mail,
  Phone,
  MapPin,
  LayoutDashboard,
} from "lucide-react";
import {
  format,
  isSameDay,
  parseISO,
  addDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
} from "date-fns";
import { toast } from "sonner";
import { cn } from "@/src/lib/utils";
import { useLocation, useNavigate } from "react-router-dom";

enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
  authUser: any,
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: authUser?.uid,
      email: authUser?.email,
      emailVerified: authUser?.emailVerified,
      isAnonymous: authUser?.isAnonymous,
      tenantId: authUser?.tenantId,
      providerInfo:
        authUser?.providerData?.map((provider: any) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function ConsultancyManager() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
    "hq" | "calendar" | "clients" | "stats" | "billing"
  >("hq");
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sync tab with URL
  useEffect(() => {
    if (location.pathname.includes("/consultancy/clients")) {
      setActiveTab("clients");
      setShowBookingModal(false);
      setShowClientModal(false);
      setShowInvoiceModal(false);
    } else if (location.pathname.includes("/consultancy/billing")) {
      setActiveTab("billing");
      setShowBookingModal(false);
      setShowClientModal(false);
      setShowInvoiceModal(false);
    } else if (location.pathname.includes("/consultancy/calendar")) {
      setActiveTab("calendar");
      setShowClientModal(false);
      setShowInvoiceModal(false);
    } else if (
      location.pathname === "/" ||
      location.pathname === "/dashboard"
    ) {
      setActiveTab("hq");
      setShowBookingModal(false);
      setShowClientModal(false);
      setShowInvoiceModal(false);
    }

    // Handle 'New' CTA route
    if (location.pathname.includes("/consultancy/new")) {
      setShowBookingModal(true);
      // Soft redirect to calendar to clear the /new path so if they close it, they stay on calendar.
      navigate("/consultancy/calendar", { replace: true });
    }
  }, [location.pathname, navigate]);

  // Stats definition
  const [stats, setStats] = useState({
    upcomingSessions: 0,
    activeClients: 0,
    totalEarnings: 0,
  });

  useEffect(() => {
    if (!user) return;

    // Fetch Calendar Events (Appointments)
    const appointmentsQuery = query(
      collection(db, "calendarEvents"),
      where("consultantId", "==", user.uid),
      orderBy("startTime", "asc"),
    );

    const unsubscribeAppointments = onSnapshot(
      appointmentsQuery,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as any));
        setAppointments(data);
        const upcoming = data.filter((d: any) => new Date(d.startTime) > new Date());
        setStats((s) => ({ ...s, upcomingSessions: upcoming.length }));
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "calendarEvents", user);
      },
    );

    // Fetch Clients
    const clientsQuery = query(
      collection(db, "clients"),
      where("consultantId", "==", user.uid),
    );
    const unsubscribeClients = onSnapshot(
      clientsQuery,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setClients(data);
        setStats((s) => ({ ...s, activeClients: data.length }));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "clients", user);
      },
    );

    // Fetch Invoices for Earnings
    const invoicesQuery = query(
      collection(db, "invoices"),
      where("consultantId", "==", user.uid),
      where("status", "==", "paid"),
    );

    const unsubscribeInvoices = onSnapshot(
      invoicesQuery,
      (snapshot) => {
        let total = 0;
        const invoicesData = snapshot.docs.map(doc => {
          const data = doc.data();
          total += data.amount || 0;
          return { id: doc.id, ...data };
        });
        setInvoices(invoicesData);
        setStats((s) => ({ ...s, totalEarnings: total }));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "invoices", user);
      },
    );

    return () => {
      unsubscribeAppointments();
      unsubscribeClients();
      unsubscribeInvoices();
    };
  }, [user]);

  const [bookingForm, setBookingForm] = useState({
    title: "",
    clientName: "",
    date: format(new Date(), "yyyy-MM-dd"),
    time: "10:00",
    duration: "60",
    type: "video", // video, audio, in_person
  });

  const [clientForm, setClientForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
  });

  const [invoiceForm, setInvoiceForm] = useState({
    clientId: "",
    amount: "0",
    description: "",
    dueDate: format(new Date(), "yyyy-MM-dd"),
  });

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const startTime = new Date(`${bookingForm.date}T${bookingForm.time}`);
      const endTime = new Date(
        startTime.getTime() + parseInt(bookingForm.duration) * 60000,
      );

      await addDoc(collection(db, "calendarEvents"), {
        consultantId: user.uid,
        title: bookingForm.title,
        clientName: bookingForm.clientName,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        eventType: "meeting",
        location: bookingForm.type,
        createdAt: serverTimestamp(),
      });
      toast.success("Appointment scheduled!");
      setShowBookingModal(false);
      setBookingForm({
        title: "",
        clientName: "",
        date: format(new Date(), "yyyy-MM-dd"),
        time: "10:00",
        duration: "60",
        type: "video",
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to schedule appointment");
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await addDoc(collection(db, "clients"), {
        consultantId: user.uid,
        name: clientForm.name,
        email: clientForm.email,
        phone: clientForm.phone,
        company: clientForm.company,
        status: "active",
        createdAt: serverTimestamp(),
      });
      toast.success("Client added!");
      setShowClientModal(false);
      setClientForm({ name: "", email: "", phone: "", company: "" });
    } catch (err) {
      console.error(err);
      toast.error("Failed to add client");
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const selectedClient = clients.find(c => c.id === invoiceForm.clientId);
      if (!selectedClient) {
        toast.error("Please select a valid client.");
        return;
      }
      await addDoc(collection(db, "invoices"), {
        consultantId: user.uid,
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        amount: parseFloat(invoiceForm.amount),
        description: invoiceForm.description,
        status: "pending",
        dueDate: invoiceForm.dueDate,
        createdAt: serverTimestamp(),
      });
      toast.success("Invoice generated!");
      setShowInvoiceModal(false);
      setInvoiceForm({ clientId: "", amount: "0", description: "", dueDate: format(new Date(), "yyyy-MM-dd") });
    } catch (err) {
      console.error(err);
      toast.error("Failed to create invoice");
    }
  };

  if (loading)
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="animate-spin text-indigo-500" />
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Stats Header (Only visible on HQ to avoid repetition) */}
      {activeTab === "hq" && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100 flex flex-col justify-center items-center text-center shadow-sm">
            <CalendarIcon className="w-6 h-6 text-indigo-500 mb-2" />
            <div className="text-2xl font-black text-indigo-900 leading-none mb-1">
              {stats.upcomingSessions}
            </div>
            <div className="text-[10px] uppercase font-bold text-indigo-600">
              Upcoming
              <br />
              Sessions
            </div>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 flex flex-col justify-center items-center text-center shadow-sm">
            <Users className="w-6 h-6 text-emerald-500 mb-2" />
            <div className="text-2xl font-black text-emerald-900 leading-none mb-1">
              {stats.activeClients}
            </div>
            <div className="text-[10px] uppercase font-bold text-emerald-600">
              Active
              <br />
              Clients
            </div>
          </div>
          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex flex-col justify-center items-center text-center shadow-sm">
            <DollarSign className="w-6 h-6 text-amber-500 mb-2" />
            <div className="text-2xl font-black text-amber-900 leading-none mb-1">
              £{stats.totalEarnings.toLocaleString()}
            </div>
            <div className="text-[10px] uppercase font-bold text-amber-600">
              Total
              <br />
              Earnings
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className={activeTab === "hq" ? "mt-4" : "mt-0"}>
        {activeTab === "hq" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
                <LayoutDashboard className="w-5 h-5 text-blue-500" /> Welcome to Consultancy HQ
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed max-w-xl">
                Here you can manage your virtual practice. Schedule remote sessions, track professional 
                engagements with your clients, and handle invoicing. Use the tabs below to navigate.
              </p>
              
              <div className="mt-6 flex flex-wrap gap-3">
                <button 
                  onClick={() => navigate("/consultancy/calendar")}
                  className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-100 transition shadow-sm"
                >
                  View Calendar
                </button>
                <button 
                  onClick={() => navigate("/consultancy/new")}
                  className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition shadow-sm"
                >
                  New Session
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "calendar" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-indigo-500" /> Virtual
                Appointments
              </h3>
              <button
                onClick={() => setShowBookingModal(true)}
                className="bg-indigo-600 text-white p-2 rounded-xl text-[12px] font-bold flex items-center gap-1 hover:bg-indigo-700 transition"
              >
                <Plus className="w-4 h-4" /> Book Slot
              </button>
            </div>

            {appointments.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
                <Monitor className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium text-sm">
                  No upcoming appointments.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {appointments
                  .filter((a) => new Date(a.startTime) > new Date())
                  .slice(0, 5)
                  .map((apt) => (
                    <div
                      key={apt.id}
                      className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between"
                    >
                      <div className="flex gap-4 items-center">
                        <div className="w-12 h-12 bg-indigo-50 rounded-xl flex flex-col items-center justify-center border border-indigo-100">
                          <span className="text-[10px] font-bold text-indigo-500 uppercase leading-none">
                            {format(new Date(apt.startTime), "MMM")}
                          </span>
                          <span className="text-lg font-black text-indigo-900 leading-none">
                            {format(new Date(apt.startTime), "dd")}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm leading-tight mb-1">
                            {apt.title}
                          </h4>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />{" "}
                              {format(new Date(apt.startTime), "HH:mm")}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />{" "}
                              {apt.clientName || "Client"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button className="bg-slate-100 p-2 rounded-xl text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition">
                        <Video className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "clients" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-500" /> Client Roster
              </h3>
              <button
                onClick={() => setShowClientModal(true)}
                className="bg-emerald-600 text-white p-2 rounded-xl text-[12px] font-bold flex items-center gap-1 hover:bg-emerald-700 transition"
              >
                <Plus className="w-4 h-4" /> Add Client
              </button>
            </div>

            {clients.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium text-sm">
                  Your roster is empty.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {clients.map((client) => (
                  <div
                    key={client.id}
                    className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white font-black text-lg">
                        {client.name?.charAt(0) || "C"}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 leading-tight">
                          {client.name}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {client.company || "Independent"}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1.5 pt-3 border-t border-slate-100">
                      {client.email && (
                        <div className="flex items-center gap-2 text-[11px] text-slate-600 font-medium">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />{" "}
                          {client.email}
                        </div>
                      )}
                      {client.phone && (
                        <div className="flex items-center gap-2 text-[11px] text-slate-600 font-medium">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />{" "}
                          {client.phone}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === "billing" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-500" /> Invoices
              </h3>
              <button
                onClick={() => setShowInvoiceModal(true)}
                className="bg-amber-500 text-white p-2 rounded-xl text-[12px] font-bold flex items-center gap-1 hover:bg-amber-600 transition shadow-sm"
              >
                <Plus className="w-4 h-4" /> Create Invoice
              </button>
            </div>

            {invoices.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
                <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="font-bold text-slate-900 mb-1">No Invoices Yet</h3>
                <p className="text-slate-500 font-medium text-sm mb-4">
                  Create invoices and track your revenue here.
                </p>
                <button
                  onClick={() => setShowInvoiceModal(true)}
                  className="bg-amber-50 text-amber-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-amber-100 transition shadow-sm"
                >
                  Generate First Invoice
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between"
                  >
                    <div className="flex gap-4 items-center">
                      <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-100">
                        <DollarSign className="w-6 h-6 text-amber-500" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm leading-tight mb-1">
                          {inv.clientName || "Client"}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {inv.description || "Consultancy Services"} • Due {inv.dueDate ? format(new Date(inv.dueDate), "MMM dd") : "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-slate-900 text-lg">£{inv.amount}</div>
                      <span className={cn(
                        "text-[10px] font-bold uppercase rounded-full px-2 py-0.5 inline-block mt-1",
                        inv.status === "paid" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                      )}>
                        {inv.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Booking Modal */}
      <AnimatePresence>
        {showBookingModal && (
          <motion.div
            key="booking-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100"
            >
              <div className="p-6 bg-indigo-600 text-white">
                <h3 className="font-black text-xl">Schedule Consultation</h3>
                <p className="text-white/80 text-sm font-medium">
                  Block time in your calendar for a client session.
                </p>
              </div>
              <form
                onSubmit={handleCreateAppointment}
                className="p-6 space-y-4"
              >
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">
                    Meeting Title
                  </label>
                  <input
                    required
                    value={bookingForm.title}
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, title: e.target.value })
                    }
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. Discovery Call"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">
                    Client Name
                  </label>
                  <input
                    required
                    value={bookingForm.clientName}
                    onChange={(e) =>
                      setBookingForm({
                        ...bookingForm,
                        clientName: e.target.value,
                      })
                    }
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                    placeholder="John Doe"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">
                      Date
                    </label>
                    <input
                      type="date"
                      required
                      value={bookingForm.date}
                      onChange={(e) =>
                        setBookingForm({ ...bookingForm, date: e.target.value })
                      }
                      className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">
                      Time
                    </label>
                    <input
                      type="time"
                      required
                      value={bookingForm.time}
                      onChange={(e) =>
                        setBookingForm({ ...bookingForm, time: e.target.value })
                      }
                      className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">
                    Duration
                  </label>
                  <select
                    value={bookingForm.duration}
                    onChange={(e) =>
                      setBookingForm({
                        ...bookingForm,
                        duration: e.target.value,
                      })
                    }
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="15">15 Minutes</option>
                    <option value="30">30 Minutes</option>
                    <option value="60">1 Hour</option>
                    <option value="120">2 Hours</option>
                  </select>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowBookingModal(false)}
                    className="flex-1 py-3 text-sm font-bold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-200"
                  >
                    Schedule
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Client Modal */}
        {showClientModal && (
          <motion.div
            key="client-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100"
            >
              <div className="p-6 bg-emerald-600 text-white">
                <h3 className="font-black text-xl">Add New Client</h3>
                <p className="text-white/80 text-sm font-medium">
                  Add a client profile to your consultancy roster.
                </p>
              </div>
              <form onSubmit={handleAddClient} className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">
                    Client Name
                  </label>
                  <input
                    required
                    value={clientForm.name}
                    onChange={(e) =>
                      setClientForm({ ...clientForm, name: e.target.value })
                    }
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g. Jane Smith"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">
                    Company (Optional)
                  </label>
                  <input
                    value={clientForm.company}
                    onChange={(e) =>
                      setClientForm({ ...clientForm, company: e.target.value })
                    }
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g. Acme Corp"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={clientForm.email}
                    onChange={(e) =>
                      setClientForm({ ...clientForm, email: e.target.value })
                    }
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-emerald-500"
                    placeholder="jane@example.com"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={clientForm.phone}
                    onChange={(e) =>
                      setClientForm({ ...clientForm, phone: e.target.value })
                    }
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-emerald-500"
                    placeholder="+44 7000 000000"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowClientModal(false)}
                    className="flex-1 py-3 text-sm font-bold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-md shadow-emerald-200"
                  >
                    Save Client
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Invoice Modal */}
        {showInvoiceModal && (
          <motion.div
            key="invoice-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100"
            >
              <div className="p-6 bg-amber-500 text-white">
                <h3 className="font-black text-xl">Create Invoice</h3>
                <p className="text-white/80 text-sm font-medium">
                  Generate a new invoice for a client.
                </p>
              </div>
              <form onSubmit={handleCreateInvoice} className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">
                    Select Client
                  </label>
                  <select
                    required
                    value={invoiceForm.clientId}
                    onChange={(e) =>
                      setInvoiceForm({ ...invoiceForm, clientId: e.target.value })
                    }
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="" disabled>Choose a client...</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">
                    Description
                  </label>
                  <input
                    required
                    value={invoiceForm.description}
                    onChange={(e) =>
                      setInvoiceForm({ ...invoiceForm, description: e.target.value })
                    }
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-amber-500"
                    placeholder="e.g. Website Strategy Session"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">
                      Amount (£)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="0.01"
                      value={invoiceForm.amount}
                      onChange={(e) =>
                        setInvoiceForm({ ...invoiceForm, amount: e.target.value })
                      }
                      className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-amber-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">
                      Due Date
                    </label>
                    <input
                      type="date"
                      required
                      value={invoiceForm.dueDate}
                      onChange={(e) =>
                        setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })
                      }
                      className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowInvoiceModal(false)}
                    className="flex-1 py-3 text-sm font-bold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 text-sm font-bold text-white bg-amber-500 rounded-xl hover:bg-amber-600 shadow-md shadow-amber-200"
                  >
                    Send Invoice
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

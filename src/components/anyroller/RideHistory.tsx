import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
  Search, Filter, Calendar, Download, MapPin, 
  Car, User, Clock, CheckCircle2, XCircle, AlertCircle, ChevronLeft, ChevronRight, Eye
} from "lucide-react";

// Mock Data
const mockRides = [
  { id: "R-8842", date: "2026-06-01 14:20", passenger: "Sarah Jenkins", driver: "John Doe", pickup: "Central Station", dropoff: "Heathrow Airport", status: "Completed", amount: "£45.00", type: "Standard" },
  { id: "R-8841", date: "2026-06-01 13:45", passenger: "Mike Ross", driver: "Maria Garcia", pickup: "12 King Street", dropoff: "Westfield Stadium", status: "Cancelled", amount: "£0.00", type: "XL" },
  { id: "R-8840", date: "2026-06-01 12:15", passenger: "Emma Watson", driver: "David Chen", pickup: "University Campus", dropoff: "City Center", status: "Completed", amount: "£12.50", type: "Standard" },
  { id: "R-8839", date: "2026-06-01 11:30", passenger: "James Bond", driver: "Sam Wilson", pickup: "MI6 Headquarters", dropoff: "The Shard", status: "Completed", amount: "£28.00", type: "Executive" },
  { id: "R-8838", date: "2026-06-01 10:05", passenger: "Tony Stark", driver: "Linda Lee", pickup: "Stark Tower", dropoff: "Airport", status: "Disputed", amount: "£150.00", type: "Luxury" },
  { id: "R-8837", date: "2026-06-01 09:20", passenger: "Clark Kent", driver: "John Doe", pickup: "Daily Planet", dropoff: "Smallville", status: "Completed", amount: "£85.00", type: "Standard" },
  { id: "R-8836", date: "2026-06-01 08:45", passenger: "Diana Prince", driver: "Maria Garcia", pickup: "Louvre Museum", dropoff: "Eiffel Tower", status: "Completed", amount: "£18.00", type: "Executive" },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Completed': return 'bg-green-100 text-green-700 border-green-200';
    case 'Cancelled': return 'bg-red-100 text-red-700 border-red-200';
    case 'Disputed': return 'bg-orange-100 text-orange-700 border-orange-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'Completed': return <CheckCircle2 size={14} className="mr-1.5" />;
    case 'Cancelled': return <XCircle size={14} className="mr-1.5" />;
    case 'Disputed': return <AlertCircle size={14} className="mr-1.5" />;
    default: return null;
  }
};

const RideHistory = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("Today");

  const filteredRides = mockRides.filter((ride) => {
    const matchesSearch = 
      ride.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      ride.passenger.toLowerCase().includes(searchTerm.toLowerCase()) || 
      ride.driver.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "All" || ride.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black flex items-center">
            <Clock className="mr-2 text-blue-600" />
            Ride History Console
          </h1>
          <p className="text-gray-500 text-sm mt-1">Search, filter, and review all completed and historical rides.</p>
        </div>
        
        <button className="flex items-center gap-2 bg-white border border-black px-4 py-2 rounded-lg text-sm font-bold shadow-[0_2px_0_rgb(0,0,0)] hover:translate-y-[1px] hover:shadow-[0_1px_0_rgb(0,0,0)] transition-all">
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-black rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by ID, Passenger, or Driver..." 
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-shadow"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative group min-w-[140px]">
            <select 
              className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Disputed">Disputed</option>
            </select>
            <Filter size={14} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          <div className="relative group min-w-[140px]">
            <select 
              className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="Today">Today</option>
              <option value="Yesterday">Yesterday</option>
              <option value="Last 7 Days">Last 7 Days</option>
              <option value="This Month">This Month</option>
              <option value="Custom">Custom Range...</option>
            </select>
            <Calendar size={14} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-black rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-black text-sm">
                <th className="px-6 py-4 font-bold text-gray-700">Ride ID & Date</th>
                <th className="px-6 py-4 font-bold text-gray-700">Participants</th>
                <th className="px-6 py-4 font-bold text-gray-700">Route</th>
                <th className="px-6 py-4 font-bold text-gray-700">Status</th>
                <th className="px-6 py-4 font-bold text-gray-700 text-right">Amount</th>
                <th className="px-6 py-4 font-bold text-gray-700 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRides.map((ride) => (
                <tr key={ride.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-black">{ride.id}</div>
                    <div className="text-xs text-gray-500 mt-1">{ride.date}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-sm font-medium text-black">
                      <User size={14} className="mr-2 text-gray-400" /> {ride.passenger}
                    </div>
                    <div className="flex items-center text-sm text-gray-500 mt-1">
                      <Car size={14} className="mr-2 text-gray-400" /> {ride.driver}
                    </div>
                  </td>
                  <td className="px-6 py-4 max-w-xs">
                    <div className="flex items-start text-sm">
                      <div className="mt-1 w-2 h-2 rounded-full bg-green-500 shrink-0 mr-2"></div>
                      <span className="truncate text-gray-700">{ride.pickup}</span>
                    </div>
                    <div className="flex items-start text-sm mt-1">
                      <div className="mt-1 w-2 h-2 bg-red-500 shrink-0 mr-2"></div>
                      <span className="truncate text-gray-700">{ride.dropoff}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(ride.status)}`}>
                      {getStatusIcon(ride.status)}
                      {ride.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-bold text-black">{ride.amount}</div>
                    <div className="text-xs text-gray-500 mt-1">{ride.type}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-colors inline-block" title="View Details">
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 flex items-center justify-between">
          <p className="text-sm text-gray-500 font-medium">
            Showing <span className="font-bold text-black">1</span> to <span className="font-bold text-black">{filteredRides.length}</span> of <span className="font-bold text-black">{filteredRides.length}</span> results
          </p>
          <div className="flex gap-2">
            <button className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed">
              <ChevronLeft size={16} />
            </button>
            <button className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RideHistory;

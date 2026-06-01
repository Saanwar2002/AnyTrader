import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
  Map, Settings, Users, CarFront, AlertCircle, CheckCircle2, 
  MapPin, Clock, ArrowRight, UserPlus, Zap
} from "lucide-react";

// Mock Data
const mockPendingBookings = [
  { id: "B-8421", name: "Sarah Jenkins", pickup: "Central Station", dropoff: "Heathrow Airport", time: "ASAP", type: "Standard", value: "£45.00" },
  { id: "B-8422", name: "Mike Ross", pickup: "12 King Street", dropoff: "Westfield Stadium", time: "in 15 mins", type: "XL", value: "£18.50" },
  { id: "B-8423", name: "Emma Watson", pickup: "University Campus", dropoff: "City Center", time: "ASAP", type: "Standard", value: "£12.00" },
];

const mockActiveRides = [
  { id: "R-992", driver: "John Doe", passenger: "Alex Turner", pickup: "O2 Arena", dropoff: "Victoria Station", status: "In Transit", ETA: "8 mins" },
  { id: "R-993", driver: "Maria Garcia", passenger: "Tom Hardy", pickup: "Hyde Park", dropoff: "Oxford Street", status: "Pickup", ETA: "2 mins" },
];

const mockAvailableDrivers = [
  { id: "D-101", name: "David Chen", vehicle: "Toyota Prius", status: "Available", distance: "0.8 mi", rating: 4.9 },
  { id: "D-102", name: "Sam Wilson", vehicle: "Mercedes E-Class", status: "Available", distance: "1.2 mi", rating: 4.8 },
  { id: "D-103", name: "Linda Lee", vehicle: "Kia Niro", status: "Ending Soon", distance: "2.5 mi", rating: 4.7 },
];

const DispatchEngine = () => {
  const [autoDispatch, setAutoDispatch] = useState(true);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black flex items-center">
            <Zap className="mr-2 text-yellow-500" />
            Live Dispatch Engine
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage live rides, pending queue, and driver allocation.</p>
        </div>
        
        {/* Dispatch Toggle */}
        <div className="flex items-center gap-3 bg-white border border-black p-2 rounded-xl shadow-sm">
          <span className="text-sm font-bold text-gray-700 pl-2">Auto-Dispatch Engine</span>
          <button 
            onClick={() => setAutoDispatch(!autoDispatch)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${autoDispatch ? 'bg-black' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${autoDispatch ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Column: Map & Active Rides */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Map Viewer placeholder */}
          <div className="bg-white border border-black rounded-xl p-4 shadow-sm h-[400px] flex flex-col relative overflow-hidden group">
            <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
              <div className="text-center">
                <Map size={48} className="mx-auto text-gray-400 mb-2 opacity-50" />
                <p className="text-gray-500 font-medium">Live Map View Simulator</p>
                <p className="text-sm text-gray-400">Google Maps Integration Area</p>
              </div>
            </div>
            {/* Map Overlay Controls */}
            <div className="absolute top-4 right-4 bg-white border border-black rounded-lg p-2 shadow-sm flex flex-col gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
              <button className="p-2 hover:bg-gray-100 rounded-md transition-colors"><Settings size={18} /></button>
              <button className="p-2 hover:bg-gray-100 rounded-md transition-colors"><MapPin size={18} /></button>
            </div>
            
            {/* Live Stats Overlay */}
            <div className="absolute bottom-4 left-4 bg-white border border-black rounded-lg px-4 py-2 shadow-sm flex items-center gap-4 text-sm font-bold">
              <div className="flex items-center"><div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div> 42 Online</div>
              <div className="flex items-center"><div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div> 12 On Trip</div>
            </div>
          </div>

          {/* Active Rides */}
          <div className="bg-white border border-black rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-black border-b border-gray-200 pb-3 mb-4 flex justify-between items-center">
              Live Rides <span className="bg-blue-100 text-blue-700 text-xs py-1 px-3 rounded-full">12 Active</span>
            </h2>
            <div className="space-y-4">
              {mockActiveRides.map((ride) => (
                <div key={ride.id} className="flex flex-col sm:flex-row justify-between items-center sm:items-start p-4 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex flex-col w-full sm:w-auto">
                    <span className="font-bold text-black flex items-center gap-2">
                      <CarFront size={16} className="text-blue-600" />
                      {ride.driver} <span className="text-gray-400 font-normal">driving</span> {ride.passenger}
                    </span>
                    <div className="flex items-center text-sm text-gray-600 mt-2">
                      <span className="font-medium mr-1">From:</span> {ride.pickup}
                    </div>
                    <div className="flex items-center text-sm text-gray-600 mt-1">
                      <span className="font-medium mr-1">To:</span> {ride.dropoff}
                    </div>
                  </div>
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto mt-4 sm:mt-0">
                    <span className="text-sm font-bold text-blue-700 bg-blue-100 px-3 py-1 rounded-md">{ride.status}</span>
                    <span className="text-xs font-semibold text-gray-500 flex items-center mt-2">
                      <Clock size={12} className="mr-1" /> ETA: {ride.ETA}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Queues & Resources */}
        <div className="space-y-6">
          
          {/* Pending Queue */}
          <div className="bg-white border border-black rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-black border-b border-gray-200 pb-3 mb-4 flex justify-between items-center">
              Pending Bookings <span className="bg-yellow-100 text-yellow-700 text-xs py-1 px-3 rounded-full animate-pulse">3 Waiting</span>
            </h2>
            <div className="space-y-4">
              {mockPendingBookings.map((booking) => (
                <div key={booking.id} className="p-4 border border-yellow-300 rounded-lg bg-yellow-50/50">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-black text-sm">{booking.name}</span>
                    <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-md">{booking.value}</span>
                  </div>
                  <div className="text-sm text-gray-600 font-medium space-y-1 mb-3">
                    <div className="truncate"><span className="text-gray-400">P:</span> {booking.pickup}</div>
                    <div className="truncate"><span className="text-gray-400">D:</span> {booking.dropoff}</div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md border border-red-100">{booking.time}</span>
                    <button className="text-xs font-bold bg-black text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors shadow-sm">
                      Assign
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Available Drivers List */}
          <div className="bg-white border border-black rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-black border-b border-gray-200 pb-3 mb-4 flex justify-between items-center">
              Available Resources <span className="text-sm text-gray-500 font-medium">Nearest</span>
            </h2>
            <div className="space-y-3">
              {mockAvailableDrivers.map((driver) => (
                <div key={driver.id} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg hover:border-black cursor-pointer transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${driver.status === 'Available' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                    <div>
                      <p className="text-sm font-bold text-black">{driver.name}</p>
                      <p className="text-xs text-gray-500">{driver.vehicle} • ⭐ {driver.rating}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-gray-700">{driver.distance}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default DispatchEngine;


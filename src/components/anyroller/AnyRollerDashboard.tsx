import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Car, Users, TrendingUp, Activity, 
  MapPin, Clock, ArrowRight, ShieldAlert, CheckCircle2, Banknote, Navigation
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

// Mock Data Source for Real-time simulation
const generateMockChartData = () => {
  const data = [];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  for (let i = 0; i < 7; i++) {
    data.push({
      name: days[i],
      revenue: Math.floor(Math.random() * 5000) + 1000,
      rides: Math.floor(Math.random() * 200) + 50,
    });
  }
  return data;
};

const mockRecentActivity = [
  { id: 1, type: "ride_completed", title: "Ride Completed", time: "2 min ago", detail: "Driver John Doe finished ride in Zone A (£24.50)" },
  { id: 2, type: "driver_online", title: "Driver Online", time: "5 min ago", detail: "Sarah Smith went online (Vehicle: Prius)" },
  { id: 3, type: "sos_alert", title: "SOS Alert", time: "12 min ago", detail: "Passenger triggered SOS on Route 42. Resolved." },
  { id: 4, type: "new_booking", title: "New Booking", time: "15 min ago", detail: "Booking received from Central Station to Airport" },
  { id: 5, type: "driver_offline", title: "Driver Offline", time: "22 min ago", detail: "Mike Johnson went offline." },
];

const StatCard = ({ title, value, trend, trendUp, icon: Icon, colorClass }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white p-6 border border-black rounded-xl shadow-sm flex flex-col justify-between"
  >
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-black">{value}</h3>
      </div>
      <div className={`p-3 rounded-lg ${colorClass}`}>
        <Icon size={24} />
      </div>
    </div>
    <div className="flex items-center text-sm">
      <span className={`flex items-center font-semibold ${trendUp ? 'text-green-600' : 'text-red-500'}`}>
        <TrendingUp size={16} className={`mr-1 ${!trendUp && 'rotate-180'}`} />
        {trend}
      </span>
      <span className="text-gray-400 ml-2">vs last week</span>
    </div>
  </motion.div>
);

const AnyRollerDashboard = () => {
  const [chartData, setChartData] = useState<any[]>([]);
  
  // Simulate real-time data loading
  useEffect(() => {
    setChartData(generateMockChartData());
    
    // Simulate real-time updates every 30 seconds
    const interval = setInterval(() => {
      setChartData(generateMockChartData());
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black flex items-center">
            <Activity className="mr-2 text-blue-600" />
            Platform Overview
          </h1>
          <p className="text-gray-500 text-sm mt-1">Live metrics and real-time dispatch status.</p>
        </div>
        
        {/* Real-time indicator */}
        <div className="flex items-center px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium shadow-sm">
          <span className="relative flex h-3 w-3 mr-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          Live Data Sync Active
        </div>
      </div>

      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Today's Revenue" 
          value="£4,250.00" 
          trend="+12.5%" 
          trendUp={true} 
          icon={Banknote} 
          colorClass="bg-green-100 text-green-700" 
        />
        <StatCard 
          title="Active Drivers" 
          value="142" 
          trend="+5.2%" 
          trendUp={true} 
          icon={Car} 
          colorClass="bg-blue-100 text-blue-700" 
        />
        <StatCard 
          title="Live Rides" 
          value="38" 
          trend="-2.1%" 
          trendUp={false} 
          icon={Navigation} 
          colorClass="bg-purple-100 text-purple-700" 
        />
        <StatCard 
          title="Completed Rides" 
          value="856" 
          trend="+18.4%" 
          trendUp={true} 
          icon={CheckCircle2} 
          colorClass="bg-orange-100 text-orange-700" 
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Column: Charts (takes up 2 cols on wide screens) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="xl:col-span-2 bg-white border border-black rounded-xl shadow-sm p-6 flex flex-col min-h-[400px]"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-black border-b-2 border-black pb-1">Revenue & Ride Volume</h2>
            <select className="text-sm border border-black rounded-md px-3 py-1.5 bg-white font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
              <option>This Year</option>
            </select>
          </div>
          
          <div className="flex-1 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 500 }} dy={10} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 500 }} dx={-10} tickFormatter={(val) => `£${val}`} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 500 }} dx={10} />
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#E5E7EB" />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid black', boxShadow: '4px 4px 0px rgba(0,0,0,1)', padding: '12px' }}
                  itemStyle={{ fontWeight: 600 }}
                  formatter={(value: any, name: string) => [name === 'revenue' ? `£${value}` : value, name === 'revenue' ? 'Revenue' : 'Rides']}
                />
                <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                <Area yAxisId="right" type="monotone" dataKey="rides" stroke="#10B981" strokeWidth={3} fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Right Column: Activity Feed & Alerts */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white border border-black rounded-xl shadow-sm p-6 flex flex-col min-h-[400px]"
        >
          <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
            <h2 className="text-lg font-bold text-black flex items-center">
              Live Activity Log
            </h2>
            <button className="text-sm text-blue-600 font-bold hover:text-blue-800 transition-colors flex items-center group">
              View All <ArrowRight size={14} className="ml-1 transform group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-5">
            {mockRecentActivity.map((activity, idx) => (
              <div key={activity.id} className="flex gap-4 relative">
                {idx !== mockRecentActivity.length - 1 && (
                  <div className="absolute left-[15px] top-8 bottom-[-20px] w-[2px] bg-gray-200"></div>
                )}
                
                <div className={`mt-0.5 h-8 w-8 rounded-full flex items-center justify-center border-2 shrink-0 z-10 bg-white
                  ${activity.type === 'sos_alert' ? 'border-red-500 text-red-600' : 
                    activity.type === 'ride_completed' ? 'border-green-500 text-green-600' :
                    activity.type === 'new_booking' ? 'border-blue-500 text-blue-600' :
                    'border-gray-400 text-gray-600'
                  }`}
                >
                  {activity.type === 'sos_alert' ? <ShieldAlert size={14} strokeWidth={2.5} /> :
                   activity.type === 'ride_completed' ? <CheckCircle2 size={14} strokeWidth={2.5} /> :
                   activity.type === 'new_booking' ? <Car size={14} strokeWidth={2.5} /> :
                   <Users size={14} strokeWidth={2.5} />}
                </div>
                
                <div className="pb-2">
                  <div className="flex justify-between items-baseline mb-1">
                    <p className={`text-sm font-bold ${activity.type === 'sos_alert' ? 'text-red-600' : 'text-black'}`}>
                      {activity.title}
                    </p>
                    <span className="text-xs text-gray-400 font-semibold whitespace-nowrap ml-3 flex items-center bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200">
                      <Clock size={10} className="mr-1" />
                      {activity.time}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 leading-snug font-medium">
                    {activity.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4">
             <button className="w-full py-3 bg-black text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-all shadow-[0_4px_0_rgb(100,100,100)] active:shadow-none active:translate-y-1 flex justify-center items-center">
                Open Full Dispatch Center <ArrowRight size={16} className="ml-2" />
             </button>
          </div>
        </motion.div>

      </div>
    </div>
  );
};

export default AnyRollerDashboard;


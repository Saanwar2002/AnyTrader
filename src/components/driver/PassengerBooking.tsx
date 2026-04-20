import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MapPin, Navigation, Car, CreditCard, Clock, X, Check } from "lucide-react";
import { cn } from "@/src/lib/utils";

export default function PassengerBooking() {
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [step, setStep] = useState<"search" | "confirm">("search");
  const [fare, setFare] = useState<number | null>(null);

  const handleSearch = () => {
    // In a real app, this would call the Google Maps Distance Matrix API
    // and our own Fare Calculation engine.
    setFare(15.50);
    setStep("confirm");
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6 pt-4">
      <h1 className="text-2xl font-black font-display tracking-tight text-slate-900">Book a Ride</h1>

      {step === "search" && (
        <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border border-slate-100 space-y-4">
          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500" />
            <input
              type="text"
              placeholder="Pickup Location"
              value={pickup}
              onChange={(e) => setPickup(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-100 outline-none focus:border-blue-500 font-bold"
            />
          </div>
          <div className="relative">
            <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-500" />
            <input
              type="text"
              placeholder="Dropoff Location"
              value={dropoff}
              onChange={(e) => setDropoff(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-100 outline-none focus:border-blue-500 font-bold"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={!pickup || !dropoff}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black hover:bg-slate-800 transition-all disabled:opacity-50"
          >
            Find Rides
          </button>
        </div>
      )}

      {step === "confirm" && fare && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] p-6 shadow-xl border border-slate-100 space-y-6"
        >
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-black text-slate-900">Confirm Your Ride</h2>
            <p className="text-2xl font-black text-blue-600">£{fare.toFixed(2)}</p>
          </div>

          <div className="space-y-3">
             <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl">
                <Car className="w-8 h-8 text-blue-600" />
                <div>
                   <p className="font-black text-slate-900">AnyTrader Standard</p>
                   <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Arrives in 4 mins</p>
                </div>
             </div>
          </div>

          <button
            onClick={() => alert("Dispatching ride...")}
            className="w-full bg-orange-500 text-white py-5 rounded-2xl font-black text-lg hover:bg-orange-600 transition-all shadow-xl shadow-orange-500/20"
          >
            Confirm & Book
          </button>
          
          <button onClick={() => setStep("search")} className="w-full text-slate-400 font-bold text-sm hover:text-slate-600">
            Change details
          </button>
        </motion.div>
      )}
    </div>
  );
}

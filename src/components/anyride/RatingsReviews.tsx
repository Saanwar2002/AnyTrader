import React from "react";
import { Star, Filter, Search, Flag, ThumbsDown, MessageSquare } from "lucide-react";

export default function RatingsReviews() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Ratings & Reviews
          </h2>
          <p className="text-slate-500 font-medium">Monitor user feedback, flag disputes, and track sentiment.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center flex-shrink-0">
              <Star className="w-6 h-6 text-emerald-500 fill-emerald-500" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Platform Avg Driver</p>
              <p className="text-2xl font-black text-slate-900">4.82</p>
            </div>
         </div>
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
              <Star className="w-6 h-6 text-blue-500 fill-blue-500" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Platform Avg Rider</p>
              <p className="text-2xl font-black text-slate-900">4.91</p>
            </div>
         </div>
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Recent 1-stars (7d)</p>
           <p className="text-2xl font-black text-rose-500">14</p>
         </div>
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Disputed Ratings</p>
           <p className="text-2xl font-black text-amber-500">5</p>
         </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-2">
            <button className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-md shadow-sm">All Ratings</button>
            <button className="px-3 py-1.5 text-rose-600 bg-rose-50 text-xs font-bold rounded-md hover:bg-rose-100 transition-colors flex items-center gap-1">
              <ThumbsDown className="w-3 h-3"/> 1 & 2 Stars
            </button>
            <button className="px-3 py-1.5 text-slate-600 text-xs font-bold rounded-md hover:bg-slate-50 transition-colors border border-slate-200">Disputed</button>
          </div>
          
          <div className="flex items-center gap-2">
             <div className="relative">
               <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
               <input type="text" placeholder="Search by Ride ID..." className="w-64 pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" />
             </div>
             <button className="p-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
               <Filter className="w-4 h-4" />
             </button>
          </div>
        </div>

        <div className="overflow-x-auto min-w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4 whitespace-nowrap">Ride ID & Date</th>
                <th className="px-6 py-4 whitespace-nowrap">From</th>
                <th className="px-6 py-4 whitespace-nowrap">To</th>
                <th className="px-6 py-4 whitespace-nowrap">Rating</th>
                <th className="px-6 py-4">Comment / Tags</th>
                <th className="px-6 py-4 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[
                { id: "R-0994", date: "Today, 14:22", fromType: "Rider", fromName: "Dave R.", toType: "Driver", toName: "Ahmed K.", rating: 1, comment: "Reckless driving, went through a red light.", tags: ["Safety", "Driving"] },
                { id: "R-0993", date: "Today, 13:40", fromType: "Driver", fromName: "Sarah M.", toType: "Rider", toName: "Mike T.", rating: 3, comment: "Left trash in the backseat.", tags: ["Cleanliness"] },
                { id: "R-0980", date: "Yesterday", fromType: "Rider", fromName: "Chloe S.", toType: "Driver", toName: "Ali R.", rating: 5, comment: "Great chat!", tags: [] },
              ].map((review, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-xs font-bold text-slate-900 cursor-pointer hover:text-emerald-600">{review.id}</div>
                    <div className="text-[10px] text-slate-500 mt-1">{review.date}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                       <span className="text-[8px] bg-slate-100 px-1.5 py-0.5 rounded font-black uppercase tracking-widest text-slate-500">{review.fromType}</span>
                       <span className="text-xs font-bold text-slate-700">{review.fromName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                       <span className="text-[8px] bg-slate-100 px-1.5 py-0.5 rounded font-black uppercase tracking-widest text-slate-500">{review.toType}</span>
                       <span className="text-xs font-bold text-slate-700">{review.toName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} className={cn("w-4 h-4", star <= review.rating ? "text-amber-400 fill-amber-400" : "text-slate-200")} />
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 min-w-[300px]">
                    <div className="text-xs text-slate-600 italic mb-2">"{review.comment}"</div>
                    {review.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {review.tags.map(tag => (
                          <span key={tag} className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold text-slate-500">{tag}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="px-2 py-1 bg-white border border-slate-200 shadow-sm text-slate-600 text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1 rounded hover:bg-slate-50">
                        <Flag className="w-3 h-3" /> Flag
                      </button>
                      <button className="px-2 py-1 bg-white border border-slate-200 shadow-sm text-rose-600 text-[10px] font-black uppercase tracking-widest rounded hover:bg-rose-50">
                        Nullify
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

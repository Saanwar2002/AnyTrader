import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { db, collection, query, where, onSnapshot, updateDoc, doc, getDoc } from "@/src/firebase";
import { Briefcase, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

export function ConsultancyBids() {
  const { user } = useAuth();
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "projectBids"),
      where("consultantId", "==", user.uid)
    );

    const unsub = onSnapshot(q, async (snap) => {
      const bidsData = await Promise.all(snap.docs.map(async (d) => {
        const data = d.data();
        let projectTitle = "Unknown Project";
        let roleName = "Unknown Role";

        // Fetch project info
        if (data.projectId) {
          try {
            const projDoc = await getDoc(doc(db, "projects", data.projectId));
            if (projDoc.exists()) projectTitle = projDoc.data().title;
          } catch (e) {}
        }

        // Fetch role info
        if (data.projectRoleId) {
          try {
            const roleDoc = await getDoc(doc(db, "projectRoles", data.projectRoleId));
            if (roleDoc.exists()) roleName = roleDoc.data().roleName;
          } catch (e) {}
        }

        return {
          id: d.id,
          ...data,
          projectTitle,
          roleName
        };
      }));

      // Sort by createdAt desc locally since we have mixed data fetching
      bidsData.sort((a, b) => {
        const dateA = (a as any).createdAt?.toDate?.()?.getTime() || 0;
        const dateB = (b as any).createdAt?.toDate?.()?.getTime() || 0;
        return dateB - dateA;
      });

      setBids(bidsData);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  const updateBidStatus = async (bidId: string, newStatus: string) => {
    try {
      const bidDoc = await getDoc(doc(db, "projectBids", bidId));
      if (!bidDoc.exists()) return;
      const bidData = bidDoc.data();

      await updateDoc(doc(db, "projectBids", bidId), {
        status: newStatus
      });

      if (newStatus === "accepted" && bidData.projectRoleId) {
        const roleDoc = await getDoc(doc(db, "projectRoles", bidData.projectRoleId));
        if (roleDoc.exists()) {
          const roleData = roleDoc.data();
          // Mark role as filled
          await updateDoc(doc(db, "projectRoles", bidData.projectRoleId), {
            status: "filled"
          });

          // Map to calendar if a date is set
          if (roleData.requiredDate) {
            import("firebase/firestore").then(({ addDoc, collection, serverTimestamp }) => {
              addDoc(collection(db, "calendarEvents"), {
                consultantId: bidData.consultantId,
                projectId: bidData.projectId,
                title: `Role: ${roleData.roleName}`,
                startTime: new Date(roleData.requiredDate).toISOString(),
                eventType: "project"
              }).catch(console.error);
            });
          }

          // Fetch project to get managerId
          const projDoc = await getDoc(doc(db, "projects", bidData.projectId));
          if (projDoc.exists()) {
             const projData = projDoc.data();
             import("firebase/firestore").then(({ addDoc, collection, serverTimestamp }) => {
               addDoc(collection(db, "notifications"), {
                 userId: projData.managerId,
                 title: "Bid Accepted",
                 message: `A professional has accepted the role: ${roleData.roleName}`,
                 type: "system",
                 read: false,
                 createdAt: serverTimestamp(),
                 visibleAt: serverTimestamp()
               }).catch(console.error);
             });
          }

          // Add to team members
          import("firebase/firestore").then(({ addDoc, collection }) => {
            addDoc(collection(db, "teamMembers"), {
              projectId: bidData.projectId,
              consultantId: bidData.consultantId,
              role: roleData.roleName,
              accessLevel: "read"
            }).catch(console.error);

            // Also add to project timeline
            if (roleData.requiredDate) {
              addDoc(collection(db, "projectTimelineItems"), {
                projectId: bidData.projectId,
                title: `${roleData.roleName} Booking Confirmed`,
                startTime: new Date(roleData.requiredDate).toISOString()
              }).catch(console.error);
            }
          });
        }
      } else if (newStatus === "rejected") {
         const projDoc = await getDoc(doc(db, "projects", bidData.projectId));
         if (projDoc.exists()) {
            const projData = projDoc.data();
            import("firebase/firestore").then(({ addDoc, collection, serverTimestamp }) => {
              addDoc(collection(db, "notifications"), {
                userId: projData.managerId,
                title: "Bid Declined",
                message: `A professional has declined the invitation.`,
                type: "system",
                read: false,
                createdAt: serverTimestamp(),
                visibleAt: serverTimestamp()
              }).catch(console.error);
            });
         }
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-4 text-sm text-black/60 font-bold">Loading invitations...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-black flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-indigo-500" /> Pending Project Invitations
        </h3>
      </div>

      <div className="space-y-4">
        {bids.filter(b => b.status === "pending").map(bid => (
          <div key={bid.id} className="bg-white border border-black/10 shadow-sm rounded-2xl p-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">Project Invitation</span>
                <h4 className="text-lg font-black text-black mt-2 leading-tight">{bid.roleName}</h4>
                <p className="text-sm font-medium text-black/60 mt-0.5">{bid.projectTitle}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase text-black/40 tracking-widest">Proposed Budget</p>
                <p className="text-lg font-mono font-bold text-black">£{bid.amount}</p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-black/5 text-sm font-medium text-black/80 italic mb-4">
              "{bid.message || "No message provided."}"
            </div>

            <div className="flex gap-2">
              <button onClick={() => updateBidStatus(bid.id, "accepted")} className="flex-1 py-2 bg-black text-white font-bold text-sm rounded-xl hover:bg-slate-800 transition shadow-sm flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" /> Accept & Bid
              </button>
              <button onClick={() => updateBidStatus(bid.id, "rejected")} className="py-2 px-4 bg-white text-rose-600 border border-rose-200 font-bold text-sm rounded-xl hover:bg-rose-50 transition">
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>

      {bids.filter(b => b.status !== "pending").length > 0 && (
        <div className="mt-8">
          <h4 className="text-xs font-black uppercase text-black/50 tracking-widest mb-4">Past Bids & Invitations</h4>
          <div className="space-y-3">
            {bids.filter(b => b.status !== "pending").map(bid => (
              <div key={bid.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-black/5">
                <div>
                  <h5 className="font-bold text-black text-sm">{bid.roleName}</h5>
                  <p className="text-xs text-black/60">{bid.projectTitle}</p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md inline-block mb-1 ${bid.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {bid.status}
                  </span>
                  <p className="text-xs font-mono font-bold text-black">£{bid.amount}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {bids.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-black/10">
          <Clock className="w-8 h-8 text-black/20 mx-auto mb-3" />
          <h3 className="font-bold text-black">No Active Bids</h3>
          <p className="text-sm text-black/60 font-medium">You haven't received any project role invitations yet.</p>
        </div>
      )}
    </div>
  );
}

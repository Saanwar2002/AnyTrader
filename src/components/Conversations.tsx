import React, { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot, getDoc, doc, getDocs } from "firebase/firestore";
import { db, handleFirestoreError, OperationType, updateDoc, arrayUnion } from "@/src/firebase";
import { useAuth } from "./AuthProvider";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, Clock, ChevronRight, User as UserIcon, Loader2, Trash2, CheckCircle2, X, MoreVertical, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/src/lib/utils";
import { PullToRefresh } from "./common/PullToRefresh";

export default function Conversations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", user.uid),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const convs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((conv: any) => !conv.deletedBy?.includes(user.uid));
      
      setConversations(convs);
      setLoading(false);

      // Fetch profiles for recipients in a batched manner
      const missingRecipientIds = Array.from(new Set(
        convs
          .map((conv: any) => conv.participants?.find((p: string) => p !== user.uid))
          .filter((id: string | undefined): id is string => Boolean(id) && !(profiles as any)[id!])
      ));

      if (missingRecipientIds.length > 0) {
        Promise.all(missingRecipientIds.map(async (recipientId) => {
          try {
            const profileDoc = await getDoc(doc(db, "users", recipientId));
            return profileDoc.exists() ? { id: recipientId, data: profileDoc.data() } : null;
          } catch (e) {
            return null;
          }
        })).then((results) => {
          const fetchedProfiles: Record<string, any> = {};
          results.forEach((res) => {
            if (res) fetchedProfiles[res.id] = res.data;
          });
          if (Object.keys(fetchedProfiles).length > 0) {
            setProfiles(prev => ({ ...prev, ...fetchedProfiles }));
          }
        });
      }
    }, (error) => {
      console.error("Error fetching conversations:", error);
      handleFirestoreError(error, OperationType.LIST, "conversations");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      // Auto-reset confirmation after 3 seconds
      setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }

    setIsDeleting(true);
    try {
      await updateDoc(doc(db, "conversations", id), {
        deletedBy: arrayUnion(user!.uid)
      });
      setConfirmDeleteId(null);
    } catch (error) {
      console.error("Error deleting conversation:", error);
      handleFirestoreError(error, OperationType.UPDATE, `conversations/${id}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!user || selectedIds.length === 0) return;

    setIsDeleting(true);
    try {
      await Promise.all(selectedIds.map(id => 
        updateDoc(doc(db, "conversations", id), {
          deletedBy: arrayUnion(user.uid)
        })
      ));
      setSelectedIds([]);
      setIsSelectMode(false);
    } catch (error) {
      console.error("Error deleting conversations:", error);
      handleFirestoreError(error, OperationType.UPDATE, "conversations/bulk");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRefresh = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, "conversations"),
        where("participants", "array-contains", user.uid),
        orderBy("updatedAt", "desc")
      );
      const snapshot = await getDocs(q);
      const convs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((conv: any) => !conv.deletedBy?.includes(user.uid));
      setConversations(convs);

      await Promise.all(convs.map(async (conv: any) => {
        const recipientId = conv.participants.find((p: string) => p !== user.uid);
        if (recipientId && !profiles[recipientId]) {
          const profileDoc = await getDoc(doc(db, "users", recipientId));
          if (profileDoc.exists()) {
            setProfiles(prev => ({
              ...prev,
              [recipientId]: profileDoc.data()
            }));
          }
        }
      }));
    } catch (err) {
      console.error("Error refreshing inbox:", err);
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh} className="min-h-full pb-8">
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
        {conversations.length > 0 && (
          <div className="flex items-center gap-2">
            {isSelectMode ? (
              <>
                <button
                  onClick={handleDeleteSelected}
                  disabled={selectedIds.length === 0 || isDeleting}
                  className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete ({selectedIds.length})
                </button>
                <button
                  onClick={() => {
                    setIsSelectMode(false);
                    setSelectedIds([]);
                  }}
                  className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsSelectMode(true)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Select
              </button>
            )}
          </div>
        )}
      </div>

      {conversations.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-black text-center space-y-4">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
            <MessageSquare className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">No messages yet</h3>
            <p className="text-slate-500">When you accept a quote or start a discussion, your messages will appear here.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {conversations.map((conv) => {
            const recipientId = conv.participants.find((p: string) => p !== user?.uid);
            const recipient = profiles[recipientId];
            const isSelected = selectedIds.includes(conv.id);
            
            return (
              <div key={conv.id} className="relative group">
                <div
                  onClick={(e) => {
                    if (isSelectMode) {
                      toggleSelect(conv.id, e);
                    } else {
                      navigate(`/chat/${conv.id}`, { 
                        state: { 
                          jobTitle: conv.jobTitle,
                          recipientName: recipient?.name || "Chat"
                        } 
                      });
                    }
                  }}
                  className={cn(
                    "bg-white p-4 rounded-xl border transition-all flex items-center gap-4 cursor-pointer",
                    isSelectMode ? (isSelected ? "border-blue-600 bg-blue-50/30" : "border-black") : "border-black hover:border-blue-600 shadow-sm"
                  )}
                >
                  {isSelectMode && (
                    <div className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                      isSelected ? "bg-blue-600 border-blue-600" : "border-black bg-white"
                    )}>
                      {isSelected && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                    </div>
                  )}
                  
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center overflow-hidden shrink-0">
                    {recipient?.avatarUrl ? (
                      <img src={recipient.avatarUrl} alt={recipient.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <UserIcon className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-slate-900 truncate">{recipient?.name || "Loading..."}</h4>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">
                        {conv.updatedAt?.toDate ? conv.updatedAt.toDate().toLocaleDateString() : "Just now"}
                      </span>
                    </div>
                    <p className="text-xs text-blue-600 font-medium mb-1 truncate">{conv.jobTitle}</p>
                    <p className="text-sm text-slate-500 truncate">
                      {conv.lastMessage || "Start the conversation..."}
                    </p>
                  </div>
                  {!isSelectMode && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDelete(conv.id, e)}
                        className={cn(
                          "px-3 py-2 rounded-lg transition-all flex items-center gap-2",
                          confirmDeleteId === conv.id 
                            ? "bg-red-600 text-white" 
                            : "text-slate-400 hover:text-red-600 hover:bg-red-50 md:opacity-0 md:group-hover:opacity-100"
                        )}
                      >
                        <Trash2 className="w-4 h-4" />
                        {confirmDeleteId === conv.id && <span className="text-[10px] font-bold uppercase">Confirm?</span>}
                      </button>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-colors" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </PullToRefresh>
  );
}

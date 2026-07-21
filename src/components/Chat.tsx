import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { db, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, handleFirestoreError, OperationType, updateDoc, doc, getDoc, sendNotification, storage, ref, uploadBytes, getDownloadURL, arrayUnion } from "@/src/firebase";
import { useAuth } from "./AuthProvider";
import { motion, AnimatePresence } from "motion/react";
import { Send, ChevronLeft, Loader2, User as UserIcon, Briefcase, Image as ImageIcon, X, Mic, Square, Play, Pause, MousePointer2, Trash2 } from "lucide-react";
import { cn } from "@/src/lib/utils";

export default function Chat() {
  const { conversationId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get metadata from location state (e.g., job title, recipient name)
  const { jobTitle, recipientName } = location.state || {};

  useEffect(() => {
    if (!conversationId) return;

    // Fetch conversation metadata
    const fetchConversation = async () => {
      try {
        const convDoc = await getDoc(doc(db, "conversations", conversationId));
        if (convDoc.exists()) {
          setConversation(convDoc.data());
        }
      } catch (err) {
        console.error("Error fetching conversation:", err);
      }
    };
    fetchConversation();

    const q = query(
      collection(db, "conversations", conversationId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
      // Scroll to bottom
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }, (err) => {
      console.error(err);
      try {
        handleFirestoreError(err, OperationType.LIST, `conversations/${conversationId}/messages`);
      } catch (e: any) {
        setError(e.message);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [conversationId]);

  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 8000);
    return () => clearTimeout(timer);
  }, []);

  const sendText = async (text: string) => {
    if (!text || !user || !conversationId) return;

    try {
      await addDoc(collection(db, "conversations", conversationId, "messages"), {
        senderId: user.uid,
        text,
        createdAt: serverTimestamp(),
      });

      // Update conversation metadata
      await updateDoc(doc(db, "conversations", conversationId), {
        lastMessage: text,
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedBy: [] // Re-show for everyone when a new message arrives
      });

      // Notify recipient
      if (conversation) {
        const recipientId = conversation.participants.find((id: string) => id !== user.uid);
        if (recipientId) {
          await sendNotification(
            recipientId,
            "New Message",
            `You have a new message regarding "${conversation.jobTitle}"`,
            "message",
            `/chat/${conversationId}`
          );
        }
      }
    } catch (err) {
      console.error("Error sending message:", err);
      try {
        handleFirestoreError(err, OperationType.WRITE, `conversations/${conversationId}/messages`);
      } catch (e: any) {
        setError(e.message);
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    const text = newMessage.trim();
    setNewMessage("");
    await sendText(text);
  };

  const handleSendQuickReply = async (reply: string) => {
    await sendText(reply);
  };

  const getQuickReplies = () => {
    if (messages.length === 0) {
      return [
        "Are you available?",
        "Can you provide a quote?",
        "When can you start?",
      ];
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.senderId !== user?.uid) {
      const text = lastMessage.text?.toLowerCase() || "";
      if (text.includes("available")) {
        return ["Yes, it is!", "Not right now, sorry.", "When do you need it?"];
      }
      if (text.includes("quote") || text.includes("price") || text.includes("cost") || text.includes("estimate")) {
        return ["Sure, what are the details?", "I'll send one shortly.", "What's your budget?"];
      }
      if (text.includes("when") || text.includes("time") || text.includes("start")) {
        return ["I can start tomorrow.", "Next week works for me.", "Let's schedule a time."];
      }
      if (text.includes("where") || text.includes("location") || text.includes("address")) {
        return ["Could you share the address?", "It's nearby.", "I will check the map."];
      }
      return ["Thanks!", "Sounds good.", "Let me know if you have questions."];
    }
    
    return [];
  };

  const quickReplies = getQuickReplies();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !conversationId) return;

    if (!file.type.startsWith("image/")) {
       alert("Only image files are permitted in chat.");
       return;
    }
    if (file.size > 10 * 1024 * 1024) {
       alert("File size exceeds 10MB limit.");
       return;
    }

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `chats/${conversationId}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, await file.arrayBuffer(), { contentType: file.type });
      const url = await getDownloadURL(snapshot.ref);

      await addDoc(collection(db, "conversations", conversationId, "messages"), {
        senderId: user.uid,
        imageUrl: url,
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "conversations", conversationId), {
        lastMessage: "📷 Photo",
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedBy: []
      });

      if (conversation) {
        const recipientId = conversation.participants.find((id: string) => id !== user.uid);
        if (recipientId) {
          await sendNotification(
            recipientId,
            "New Photo",
            `You received a photo regarding "${conversation.jobTitle}"`,
            "message",
            `/chat/${conversationId}`
          );
        }
      }
    } catch (err) {
      console.error("Error uploading image:", err);
      try {
        handleFirestoreError(err, OperationType.WRITE, `conversations/${conversationId}/messages`);
      } catch (e: any) {
        setError(e.message);
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await uploadAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error starting recording:", err);
      setError("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const uploadAudio = async (blob: Blob) => {
    if (!user || !conversationId) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `chats/${conversationId}/${Date.now()}_voice.webm`);
      const snapshot = await uploadBytes(storageRef, await blob.arrayBuffer(), { contentType: blob.type });
      const url = await getDownloadURL(snapshot.ref);

      await addDoc(collection(db, "conversations", conversationId, "messages"), {
        senderId: user.uid,
        audioUrl: url,
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "conversations", conversationId), {
        lastMessage: "🎤 Voice message",
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedBy: []
      });

      if (conversation) {
        const recipientId = conversation.participants.find((id: string) => id !== user.uid);
        if (recipientId) {
          await sendNotification(
            recipientId,
            "New Voice Message",
            `You received a voice message regarding "${conversation.jobTitle}"`,
            "message",
            `/chat/${conversationId}`
          );
        }
      }
    } catch (err) {
      console.error("Error uploading audio:", err);
      try {
        handleFirestoreError(err, OperationType.WRITE, `conversations/${conversationId}/messages`);
      } catch (e: any) {
        setError(e.message);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDeleteConversation = async () => {
    if (!user || !conversationId) return;

    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }

    try {
      await updateDoc(doc(db, "conversations", conversationId), {
        deletedBy: arrayUnion(user.uid)
      });
      navigate("/messages");
    } catch (err) {
      console.error("Error deleting conversation:", err);
      handleFirestoreError(err, OperationType.UPDATE, `conversations/${conversationId}`);
    }
  };

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex flex-col h-[calc(100dvh-12rem)] sm:h-[calc(100dvh-13rem)] bg-white rounded-2xl border border-black shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-black flex items-center justify-between bg-slate-50/50 gap-2 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button onClick={() => navigate(-1)} className="p-2 sm:p-2.5 bg-white border border-black rounded-xl shadow-sm hover:bg-slate-50 hover:shadow-md transition-all group shrink-0">
            <ChevronLeft className="w-5 h-5 text-slate-800 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div className="flex flex-col min-w-0">
            <h3 className="font-bold text-slate-900 text-sm truncate">{recipientName || "Chat"}</h3>
            {!conversation?.jobId && (
              <p className="text-xs text-slate-500 truncate">General Discussion</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {conversation?.jobId && (
            <div className="relative shrink min-w-0">
              <button
                onClick={() => {
                  setShowHint(false);
                  navigate(`/job/${conversation.jobId}`);
                }}
                className="bg-blue-600 text-white px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-1.5 sm:gap-2 shadow-sm shadow-blue-100 active:scale-95 max-w-[130px] sm:max-w-none"
              >
                <Briefcase className="w-4 h-4 shrink-0" />
                <div className="flex flex-col items-start text-left min-w-0">
                  <span className="text-[9px] sm:text-[10px] opacity-80 font-medium leading-none mb-0.5 whitespace-nowrap">Regarding Job:</span>
                  <span className="truncate w-full leading-none text-[10px] sm:text-xs">
                    {jobTitle || conversation?.jobTitle || "View Details"}
                  </span>
                </div>
              </button>

              <AnimatePresence>
                {showHint && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.5, y: 10 }}
                    className="absolute -bottom-12 right-0 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap shadow-xl z-50 flex items-center gap-2"
                  >
                    <motion.div
                      animate={{ y: [0, -4, 0] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    >
                      <MousePointer2 className="w-3 h-3 text-blue-400 rotate-12" />
                    </motion.div>
                    Click here to view job details
                    <div className="absolute -top-1 right-6 w-2 h-2 bg-slate-900 rotate-45" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <button
            onClick={handleDeleteConversation}
            className={cn(
              "p-1.5 sm:p-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0",
              confirmDelete ? "bg-red-600 text-white px-2.5 sm:px-3" : "text-slate-400 hover:text-red-600 hover:bg-red-50"
            )}
            title="Delete Conversation"
          >
            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            {confirmDelete && <span className="text-[9px] sm:text-[10px] font-bold uppercase whitespace-nowrap">Confirm?</span>}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-xs text-center">
            {error}
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex flex-col max-w-[80%]",
                msg.senderId === user?.uid ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              <div className={cn(
                "p-3 rounded-2xl text-sm",
                msg.senderId === user?.uid 
                  ? "bg-blue-600 text-white rounded-tr-none" 
                  : "bg-slate-100 text-slate-900 rounded-tl-none"
              )}>
                {msg.imageUrl && (
                  <div className="mb-2 rounded-lg overflow-hidden border border-black/10">
                    <img 
                      src={msg.imageUrl} 
                      alt="Shared photo" 
                      className="max-w-full h-auto object-cover max-h-60"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                {msg.audioUrl && (
                  <div className="mb-2 min-w-[200px]">
                    <audio controls className="w-full h-8">
                      <source src={msg.audioUrl} type="audio/webm" />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
                {msg.text}
              </div>
              <span className="text-[10px] text-slate-400 mt-1">
                {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Sending..."}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={scrollRef} />
      </div>

      {/* Quick Replies */}
      {quickReplies.length > 0 && (
        <div className="px-2 sm:px-4 pb-2 pt-2 bg-white flex gap-2 overflow-x-auto shrink-0 border-t border-black/5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {quickReplies.map((reply) => (
            <button
              key={reply}
              type="button"
              onClick={() => handleSendQuickReply(reply)}
              className="whitespace-nowrap px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium rounded-xl border border-blue-200 transition-colors active:scale-95 flex-shrink-0"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-2 sm:p-4 border-t border-black flex gap-1 sm:gap-2 items-center bg-white shrink-0">
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleImageUpload}
          className="hidden"
        />
        
        {isRecording ? (
          <div className="flex-1 min-w-0 flex items-center gap-2 sm:gap-3 bg-red-50 p-2 rounded-xl border border-red-100">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0" />
            <span className="text-xs font-bold text-red-600 tabular-nums flex-shrink-0">{formatDuration(recordingDuration)}</span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={stopRecording}
              className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex-shrink-0"
            >
              <Square className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all disabled:opacity-50 flex-shrink-0"
              title="Share photo"
            >
              {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={startRecording}
              disabled={isUploading}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50 flex-shrink-0"
              title="Record voice message"
            >
              <Mic className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 min-w-0 p-2 rounded-xl border border-black focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-sm"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || isUploading}
              className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </>
        )}
      </form>
    </div>
  );
}

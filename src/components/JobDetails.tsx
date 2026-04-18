import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, doc, getDoc, getDocs, collection, query, where, or, and, onSnapshot, setDoc, updateDoc, deleteDoc, serverTimestamp, handleFirestoreError, OperationType, sendNotification, deleteField, storage, ref, uploadBytes, getDownloadURL, arrayUnion } from "@/src/firebase";
import { generateQuoteDraft, getReviewSummary, getMaterialList, getDisputeResolution, analyzeQuote, QuoteAnalysis, getRejectionFeedback, generateMarketingPost, getEquipmentRecommendations } from "@/src/services/gemini";
import { getTraderBadges, BadgeOverlay } from "@/src/lib/badges";
import { useAuth } from "./AuthProvider";
import { motion } from "motion/react";
import { 
  MapPin, Clock, Wrench, ChevronLeft, CheckCircle2, 
  MessageSquare, PoundSterling, Calendar, Loader2, User as UserIcon, Video, Star,
  MoreVertical, Edit2, Trash2, RotateCcw, XCircle, Briefcase, Zap, ChevronRight, X,
  AlertTriangle, Camera, FileText, Sparkles, RefreshCw, History, Download, AlertCircle,
  BarChart3
} from "lucide-react";
import jsPDF from 'jspdf';
import { cn, getOutwardPostcode } from "@/src/lib/utils";
import { ReviewForm } from "./ReviewForm";
import { AnimatePresence } from "motion/react";
import MediaGalleryModal from "./MediaGalleryModal";
import QuoteComparisonModal from "./QuoteComparisonModal";
import { SEO } from "./SEO";
import { RECURRING_CATEGORIES } from "@/src/constants";
import { format, addHours, parseISO } from 'date-fns';

// Helper to generate Google Calendar link
const generateGoogleCalendarLink = (job: any, quote: any) => {
  const title = encodeURIComponent(`Job: ${job.title}`);
  const description = encodeURIComponent(`Job Details: ${job.description}\n\nQuote Amount: £${quote.amount}\nJob ID: ${job.id}`);
  const location = encodeURIComponent(job.postcode || "");
  
  const startDate = quote.startDate || new Date().toISOString().split('T')[0];
  const start = startDate.replace(/-/g, '') + 'T090000Z';
  const end = startDate.replace(/-/g, '') + 'T170000Z'; // Default 9-5
  
  return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${description}&location=${location}&dates=${start}/${end}`;
};

// Helper to generate Outlook Calendar link
const generateOutlookCalendarLink = (job: any, quote: any) => {
  const title = encodeURIComponent(`Job: ${job.title}`);
  const description = encodeURIComponent(`Job Details: ${job.description}\n\nQuote Amount: £${quote.amount}\nJob ID: ${job.id}`);
  const location = encodeURIComponent(job.postcode || "");
  
  const startDate = quote.startDate || new Date().toISOString().split('T')[0];
  const start = startDate + 'T09:00:00Z';
  const end = startDate + 'T17:00:00Z';
  
  return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&body=${description}&location=${location}&startdt=${start}&enddt=${end}`;
};

// Helper to generate ICS file
const downloadICS = (job: any, quote: any) => {
  const startDate = quote.startDate || new Date().toISOString().split('T')[0];
  const start = startDate.replace(/-/g, '') + 'T090000Z';
  const end = startDate.replace(/-/g, '') + 'T170000Z';
  
  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:Job: ${job.title}`,
    `DESCRIPTION:Job Details: ${job.description}\\n\\nQuote Amount: £${quote.amount}\\nJob ID: ${job.id}`,
    `LOCATION:${job.postcode || ""}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\n");

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute('download', `job_${job.id}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function JobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [job, setJob] = useState<any>(null);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [tradespersonProfiles, setTradespersonProfiles] = useState<Record<string, any>>({});
  const [reviewSummaries, setReviewSummaries] = useState<Record<string, string>>({});
  const [quoteAnalyses, setQuoteAnalyses] = useState<Record<string, QuoteAnalysis>>({});
  const [homeownerProfile, setHomeownerProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteMessage, setQuoteMessage] = useState("");
  const [quoteStartDate, setQuoteStartDate] = useState("");
  const [isImmediateStart, setIsImmediateStart] = useState(false);
  const [estimatedTimeline, setEstimatedTimeline] = useState("");
  const [paymentPreference, setPaymentPreference] = useState("fixed_price");
  const [quoteScope, setQuoteScope] = useState("complete_package");
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDraftingAI, setIsDraftingAI] = useState(false);
  const [isGeneratingMaterials, setIsGeneratingMaterials] = useState(false);
  const [isGeneratingMarketing, setIsGeneratingMarketing] = useState(false);
  const [marketingPost, setMarketingPost] = useState("");
  const [isMediating, setIsMediating] = useState(false);
  const [disputeResolution, setDisputeResolution] = useState<any>(null);
  const [materialList, setMaterialList] = useState<string[]>([]);
  
  // Fast Pass - Material List Finalization Window Logic
  const [isFinalizingMaterials, setIsFinalizingMaterials] = useState(false);
  const [finalizingQuoteId, setFinalizingQuoteId] = useState<string | null>(null);
  const [editableMaterialItem, setEditableMaterialItem] = useState("");
  const [windowExpirationTimer, setWindowExpirationTimer] = useState<string | null>(null);

  const [hasAutoDrafted, setHasAutoDrafted] = useState(false);
  const [hasRecurringSchedule, setHasRecurringSchedule] = useState(false);
  const [showMap, setShowMap] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchJob = async () => {
      try {
        const jobDoc = await getDoc(doc(db, "jobs", id));
        if (jobDoc.exists()) {
          const data = jobDoc.data();
          setJob({ id: jobDoc.id, ...data });
          
          // Fetch homeowner profile
          const hoDoc = await getDoc(doc(db, "users", data.homeownerId));
          if (hoDoc.exists()) {
            setHomeownerProfile(hoDoc.data());
          }

          // Check if a recurring schedule already exists for this job
          if (user?.uid) {
            const recurringQuery = query(
              collection(db, "recurring_schedules"), 
              and(
                where("originalJobId", "==", id),
                or(
                  where("participants", "array-contains", user.uid),
                  where("homeownerId", "==", user.uid),
                  where("tradespersonId", "==", user.uid)
                )
              )
            );
            const recurringSnap = await getDocs(recurringQuery);
            if (!recurringSnap.empty) {
              setHasRecurringSchedule(true);
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [id, user?.uid]);

  useEffect(() => {
    if (!id || !job) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('quickQuote') === 'true') {
      setTimeout(() => {
        const element = document.getElementById('quote-form-section');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
    }
  }, [id, job]);

  useEffect(() => {
    if (!id || !job) return;

    // Listen for quotes
    // Homeowners see all quotes, tradespeople only see their own
    let q;
    if (user?.uid === job.homeownerId) {
      q = query(collection(db, "jobs", id, "quotes"));
    } else if (user) {
      q = query(collection(db, "jobs", id, "quotes"), where("tradespersonId", "==", user.uid));
    } else {
      setQuotes([]);
      return;
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const quotesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuotes(quotesData);
      
      // Auto-draft quote message if tradesperson has no quote yet
      if (user?.uid !== job.homeownerId && profile?.role === "tradesperson" && quotesData.length === 0 && !hasAutoDrafted && !quoteMessage) {
        setHasAutoDrafted(true);
        const autoDraft = async () => {
          setIsDraftingAI(true);
          try {
            const draft = await generateQuoteDraft(
              job.title,
              job.description,
              profile?.name || "Tradesperson",
              "TBD", // Amount is not known yet
              "complete_package"
            );
            setQuoteMessage(draft);
          } catch (err) {
            console.error("Error auto-drafting quote:", err);
          } finally {
            setIsDraftingAI(false);
          }
        };
        autoDraft();
      }
      
      // Fetch profiles for tradespeople who quoted
      quotesData.forEach(async (quote: any) => {
        if (!tradespersonProfiles[quote.tradespersonId]) {
          const profileDoc = await getDoc(doc(db, "users", quote.tradespersonId));
          if (profileDoc.exists()) {
            setTradespersonProfiles(prev => ({
              ...prev,
              [quote.tradespersonId]: profileDoc.data()
            }));

            // Fetch reviews and generate summary
            try {
              const reviewsSnapshot = await getDoc(doc(db, "reviews", quote.tradespersonId)); // Wait, reviews are in a collection, not a single doc
              // Actually, looking at blueprint, it's /reviews/{reviewId}
              // So I need a query
              const { getDocs } = await import("firebase/firestore");
              const reviewsQuery = query(collection(db, "reviews"), where("revieweeId", "==", quote.tradespersonId));
              const reviewsSnap = await getDocs(reviewsQuery);
              const reviewsData = reviewsSnap.docs.map(d => d.data());
              if (reviewsData.length > 0) {
                const summary = await getReviewSummary(reviewsData);
                setReviewSummaries(prev => ({
                  ...prev,
                  [quote.tradespersonId]: summary
                }));
              }
            } catch (err) {
              console.error("Error generating review summary:", err);
            }

            // Analyze quote with AI if estimate is available
            if (isHomeowner && job.estimateMin && job.estimateMax && !quoteAnalyses[quote.id]) {
              try {
                const analysis = await analyzeQuote(
                  job.title,
                  job.description,
                  quote.amount,
                  quote.message,
                  job.estimateMin,
                  job.estimateMax
                );
                setQuoteAnalyses(prev => ({
                  ...prev,
                  [quote.id]: analysis
                }));
              } catch (err) {
                console.error("Error analyzing quote:", err);
              }
            }
          }
        }
      });
    }, (err) => {
      console.error("Error listening to quotes:", err);
      // Only report if it's not a permission error we expect (though we try to avoid them now)
      try {
        handleFirestoreError(err, OperationType.LIST, `jobs/${id}/quotes`);
      } catch (e: any) {
        setError(e.message);
      }
    });

    return () => unsubscribe();
  }, [id, job, user?.uid]);

  const handleDraftWithAI = async () => {
    if (!job) return;
    setIsDraftingAI(true);
    try {
      const draft = await generateQuoteDraft(
        job.title,
        job.description,
        profile?.name || "Tradesperson",
        quoteAmount || "TBD",
        quoteScope
      );
      setQuoteMessage(draft);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDraftingAI(false);
    }
  };

  const handleGenerateMaterialList = async () => {
    if (!job) return;
    setIsGeneratingMaterials(true);
    try {
        const response = await fetch("/api/job/procure-materials", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: job.description })
        });
        const data = await response.json();
        // Assuming materialList expects an array of strings, mapping the API response
        setMaterialList(data.materials.map((m: any) => `${m.item} (${m.estimatedQuantity})`));
    } catch (err) {
        console.error("Material detection failed:", err);
    } finally {
        setIsGeneratingMaterials(false);
    }
  };

  const handleGenerateQuoteMaterials = async () => {
    if (!job) return;
    setIsGeneratingMaterials(true);
    try {
      const list = await getMaterialList(job.category, job.title, job.description);
      const formattedList = list.map(item => `- ${item}`).join('\n');
      setQuoteMessage(prev => {
        const separator = prev ? '\n\n' : '';
        const disclaimer = "⚠️ IMPORTANT: As this is a 'Labour Only' quote, the materials listed below are NOT included in the price. You will need to purchase and arrange these materials prior to the job starting.";
        return `${prev}${separator}${disclaimer}\n\nPotential Material Shopping List:\n${formattedList}`;
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingMaterials(false);
    }
  };

  const handleMediateDispute = async () => {
    if (!job || !job.dispute) return;
    setIsMediating(true);
    try {
      const acceptedQuote = quotes.find(q => q.status === "accepted");
      const res = await getDisputeResolution(
        job.title,
        job.description,
        job.dispute.reason,
        acceptedQuote?.amount || "0"
      );
      setDisputeResolution(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsMediating(false);
    }
  };

  const handleGenerateMarketingPost = async () => {
    if (!job || !profile) return;
    setIsGeneratingMarketing(true);
    try {
      const post = await generateMarketingPost(
        job.title,
        job.description,
        job.category,
        profile.name || "Tradesperson"
      );
      setMarketingPost(post);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingMarketing(false);
    }
  };

  const handleQuote = async () => {
    if (!user || !id) return;
    setIsSubmittingQuote(true);
    setError(null);
    try {
      // Check limits via server-side API
      const limitResponse = await fetch("/api/check-quote-limit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, jobId: id })
      });
      
      const limitData = await limitResponse.json();
      
      const existingQuote = quotes.find(q => q.tradespersonId === user.uid);
      
      if (!existingQuote && !limitData.allowed) {
        setError(limitData.error || `You have reached your monthly limit of ${limitData.limit} quotes. Please upgrade your tier to quote on more jobs.`);
        setIsSubmittingQuote(false);
        return;
      }

      if (existingQuote) {
        const updateData: any = {
          history: arrayUnion({
            amount: existingQuote.amount,
            message: existingQuote.message,
            paymentPreference: existingQuote.paymentPreference,
            quoteScope: existingQuote.quoteScope,
            timestamp: new Date().toISOString(),
            reason: "Manual Update"
          }),
          amount: parseFloat(quoteAmount),
          message: quoteMessage,
          startDate: isImmediateStart ? new Date().toISOString().split('T')[0] : quoteStartDate,
          isImmediateStart,
          estimatedTimeline,
          paymentPreference,
          quoteScope,
          status: "pending",
          updatedAt: serverTimestamp(),
          requoteMessage: deleteField(),
          jobTitle: job.title || ""
        };
        
        if (job.jobNo !== undefined) {
          updateData.jobNo = job.jobNo;
        }

        const quoteRef = doc(db, "jobs", id, "quotes", existingQuote.id);
        await updateDoc(quoteRef, updateData);
      } else {
        const quoteRef = doc(collection(db, "jobs", id, "quotes"));
        const quoteData: any = {
          id: quoteRef.id,
          jobId: id,
          jobTitle: job.title || "",
          tradespersonId: user.uid,
          homeownerId: job.homeownerId,
          amount: parseFloat(quoteAmount),
          message: quoteMessage,
          startDate: isImmediateStart ? new Date().toISOString().split('T')[0] : quoteStartDate,
          isImmediateStart,
          estimatedTimeline,
          paymentPreference,
          quoteScope,
          status: "pending",
          createdAt: serverTimestamp(),
        };
        
        if (job.jobNo !== undefined) {
          quoteData.jobNo = job.jobNo;
        }
        
        await setDoc(quoteRef, quoteData);
        const { increment } = await import("firebase/firestore");
        await updateDoc(doc(db, "jobs", id), {
            quoteCount: increment(1)
        });
      }

      
      const quoteRef = existingQuote ? doc(db, "jobs", id, "quotes", existingQuote.id) : doc(collection(db, "jobs", id, "quotes"));
      
      const quoteData: any = {
          amount: parseFloat(quoteAmount),
          message: quoteMessage,
          startDate: isImmediateStart ? new Date().toISOString().split('T')[0] : quoteStartDate,
          isImmediateStart,
          estimatedTimeline,
          paymentPreference,
          quoteScope,
          status: "pending",
          jobTitle: job.title || ""
      };

      if(existingQuote) {
        quoteData.updatedAt = serverTimestamp();
        quoteData.requoteMessage = deleteField();
      } else {
        quoteData.id = quoteRef.id;
        quoteData.jobId = id;
        quoteData.tradespersonId = user.uid;
        quoteData.homeownerId = job.homeownerId;
        quoteData.createdAt = serverTimestamp();
      }

      if (job.jobNo !== undefined) {
        quoteData.jobNo = job.jobNo;
      }

      
      // Notify homeowner
      await sendNotification(
        job.homeownerId,
        "Quote Received/Updated",
        `A tradesperson has ${existingQuote ? 'updated their' : 'submitted a'} quote for: ${job.title}`,
        "quote",
        `/job/${id}`
      );

      // Track exclusive limits if applicable
      if (limitData.isJobExclusive) {
        const { increment } = await import("firebase/firestore");
        const cooldownDate = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
        await updateDoc(doc(db, "users", user.uid), {
          exclusiveSlotsUsedToday: increment(1),
          exclusiveCooldownUntil: cooldownDate,
          lastExclusiveQuoteDate: serverTimestamp()
        });

        // Trigger Finalization Window for Materials
        setFinalizingQuoteId(quoteRef.id);
        setIsFinalizingMaterials(true);
      }

      setQuoteAmount("");
      setQuoteMessage("");
      setQuoteStartDate("");
      setIsImmediateStart(false);
      setEstimatedTimeline("");
    } catch (err) {
      console.error("Error submitting quote:", err);
      try {
        handleFirestoreError(err, OperationType.WRITE, `jobs/${id}/quotes`);
      } catch (e: any) {
        setError(e.message);
      }
    } finally {
      setIsSubmittingQuote(false);
    }
  };

  const handleWithdrawQuote = async () => {
    if (!id || !user || !withdrawingQuote) return;
    if (!withdrawReason.trim()) return;
    
    setIsProcessing(true);
    
    try {
      const quoteRef = doc(db, "jobs", id, "quotes", withdrawingQuote.id);
      await updateDoc(quoteRef, {
        status: "withdrawn",
        withdrawReason: withdrawReason.trim(),
        updatedAt: serverTimestamp(),
        history: arrayUnion({
          amount: withdrawingQuote.amount,
          message: withdrawingQuote.message,
          paymentPreference: withdrawingQuote.paymentPreference,
          quoteScope: withdrawingQuote.quoteScope,
          timestamp: new Date().toISOString(),
          reason: `Withdrawn by tradesperson: ${withdrawReason.trim()}`
        })
      });
    } catch (err) {
      console.error("Error updating quote status:", err);
      handleFirestoreError(err, OperationType.UPDATE, `jobs/${id}/quotes/${withdrawingQuote.id}`);
      setIsProcessing(false);
      return;
    }

    try {
      // Decrement quoteCount on job
      const { increment } = await import("firebase/firestore");
      await updateDoc(doc(db, "jobs", id), {
        quoteCount: increment(-1)
      });
    } catch (err) {
      console.error("Error decrementing quote count on job:", err);
      // We don't throw here to allow the process to continue even if job update fails
    }
      
    try {
      // Notify homeowner
      await sendNotification(
        job.homeownerId,
        "Quote Withdrawn",
        `A tradesperson has withdrawn their quote for: ${job.title}`,
        "quote",
        `/job/${id}`
      );
    } catch (err) {
      console.error("Error sending notification:", err);
    }

    setWithdrawingQuote(null);
    setWithdrawReason("");
    setIsProcessing(false);
  };

  const handleAcceptQuote = async (quote: any) => {
    if (!id || !user) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Update the accepted quote
      await updateDoc(doc(db, "jobs", id, "quotes", quote.id), {
        status: "accepted"
      });

      // Notify tradesperson
      await sendNotification(
        quote.tradespersonId,
        "Quote Accepted!",
        `Your quote for "${job.title}" has been accepted. You can now start chatting with the homeowner.`,
        "status",
        `/job/${id}`
      );

      // 2. Update the job status
      await updateDoc(doc(db, "jobs", id), {
        status: "accepted",
        acceptedTradespersonId: quote.tradespersonId,
        scheduledDate: quote.startDate || new Date().toISOString().split('T')[0],
        isConfirmedByTradesperson: false
      });

      // 3. Notify tradesperson to confirm
      await sendNotification(
        quote.tradespersonId,
        "Quote Accepted - Confirm Start Date",
        `Your quote for "${job.title}" has been accepted! Please confirm the start date (${format(new Date(quote.startDate || Date.now()), 'dd MMM')}) or request a reschedule.`,
        "status",
        `/job/${id}`
      );

      // 4. Reject other quotes and notify them
      const otherQuotes = quotes.filter(q => q.id !== quote.id && q.status === "pending");
      await Promise.all(otherQuotes.map(async (q) => {
        // Generate AI rejection feedback
        const feedback = await getRejectionFeedback(job, q, quote);
        
        await updateDoc(doc(db, "jobs", id, "quotes", q.id), {
          status: "rejected",
          rejectionFeedback: feedback
        });
        
        await sendNotification(
          q.tradespersonId,
          "Job Awarded to Another Trader",
          `The homeowner for "${job.title}" has accepted another quote. AI Insight: ${feedback.reason}`,
          "status",
          `/job/${id}`
        );
      }));
      
      // Refresh local job state
      setJob((prev: any) => ({ ...prev, status: "accepted" }));

      // 5. Ecosystem Synergy: Trigger AI equipment alerts for high-tier traders
      const acceptedTraderDoc = await getDoc(doc(db, "users", quote.tradespersonId));
      if (acceptedTraderDoc.exists()) {
        const traderData = acceptedTraderDoc.data();
        const tier = traderData.subscriptionType; // Simplified tier check
        if (tier === "Gold Elite" || tier === "Platinum Enterprise") {
          try {
            const recommendations = await getEquipmentRecommendations(job.title, job.description, job.category);
            if (recommendations.length > 0) {
              const recText = recommendations.map(r => `• ${r.item}: ${r.reason}`).join("\n");
              await sendNotification(
                quote.tradespersonId,
                "AI Tool Recommendations",
                `Based on this job scope, we recommend: \n${recText}`,
                "status",
                `/chat/${id}` // Or link to shop
              );
            }
          } catch (aiErr) {
            console.error("Failed to generate equipment alerts:", aiErr);
          }
        }
      }
    } catch (err) {
      console.error("Error accepting quote:", err);
      try {
        handleFirestoreError(err, OperationType.WRITE, `jobs/${id}/quotes/${quote.id}`);
      } catch (e: any) {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRejectQuote = async (quote: any) => {
    if (!id) return;
    setError(null);
    try {
      await updateDoc(doc(db, "jobs", id, "quotes", quote.id), {
        status: "rejected"
      });

      // Decrement quoteCount on job
      const { increment } = await import("firebase/firestore");
      await updateDoc(doc(db, "jobs", id), {
        quoteCount: increment(-1)
      });

      // Notify tradesperson
      await sendNotification(
        quote.tradespersonId,
        "Quote Update",
        `Your quote for "${job.title}" was not accepted this time.`,
        "status",
        `/job/${id}`
      );
    } catch (err) {
      console.error("Error rejecting quote:", err);
      try {
        handleFirestoreError(err, OperationType.WRITE, `jobs/${id}/quotes/${quote.id}`);
      } catch (e: any) {
        setError(e.message);
      }
    }
  };

  const handleRequoteQuote = async (quote: any, customMessage?: string) => {
    const message = customMessage || requoteMessage;
    if (!id || !message) return;
    
    const currentRevisions = quote.revisionCount || 0;
    if (currentRevisions >= 5) {
      setError("Maximum revision limit (5) reached for this quote.");
      return;
    }

    setError(null);
    try {
      await updateDoc(doc(db, "jobs", id, "quotes", quote.id), {
        status: "requote_requested",
        requoteMessage: message,
        revisionCount: currentRevisions + 1
      });

      // Notify tradesperson
      await sendNotification(
        quote.tradespersonId,
        "Requote Requested",
        `The homeowner has requested a requote for "${job.title}". Message: ${message}`,
        "status",
        `/job/${id}`
      );
      if (!customMessage) setRequoteMessage("");
      setActiveQuoteId(null);
    } catch (err) {
      console.error("Error requesting requote:", err);
      try {
        handleFirestoreError(err, OperationType.WRITE, `jobs/${id}/quotes/${quote.id}`);
      } catch (e: any) {
        setError(e.message);
      }
    }
  };

  const handleStartJob = async () => {
    if (!id) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "jobs", id), {
        status: "in_progress"
      });
      setJob((prev: any) => ({ ...prev, status: "in_progress" }));
      
      // Notify homeowner
      await sendNotification(
        job.homeownerId,
        "Job Started!",
        `The tradesperson has started work on "${job.title}".`,
        "status",
        `/job/${id}`
      );
    } catch (err) {
      console.error("Error starting job:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeMaterialList = async () => {
    if (!id || !finalizingQuoteId) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, "jobs", id, "quotes", finalizingQuoteId), {
        materialsFinalized: true,
        materialList: materialList.length > 0 ? materialList : [],
        updatedAt: serverTimestamp()
      });
      // Allow homeowner to immediately see it.
      setQuotes(prev => prev.map(q => q.id === finalizingQuoteId ? { ...q, materialsFinalized: true, materialList } : q));
      setIsFinalizingMaterials(false);
      setFinalizingQuoteId(null);
    } catch (err) {
      console.error("Error finalizing material list:", err);
      alert("Failed to save material list. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteJob = async () => {
    if (!id) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "jobs", id), {
        status: "completed",
        completedAt: serverTimestamp(),
        hasReview: false,
        hasTradespersonReview: false
      });
      setJob((prev: any) => ({ ...prev, status: "completed", completedAt: new Date(), hasReview: false, hasTradespersonReview: false }));
      
      // Notify tradesperson and update their stats
      const acceptedQuote = quotes.find(q => q.status === "accepted");
      if (acceptedQuote) {
        if (job.isBoosted && job.urgency === 'emergency') {
          // Increment boosted emergency jobs counter
          const tpRef = doc(db, "users", acceptedQuote.tradespersonId);
          const tpDoc = await getDoc(tpRef);
          if (tpDoc.exists()) {
            const currentCount = tpDoc.data().boostedEmergencyJobsDone || 0;
            await updateDoc(tpRef, {
              boostedEmergencyJobsDone: currentCount + 1
            });
          }
        }

        await sendNotification(
          acceptedQuote.tradespersonId,
          "Job Completed!",
          `The homeowner has marked "${job.title}" as completed. You can now review them.`,
          "status",
          `/job/${id}`
        );
      }
    } catch (err) {
      console.error("Error completing job:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadQuote = (quote: any) => {
    const doc = new jsPDF();
    const tpProfile = tradespersonProfiles[quote.tradespersonId];
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(30, 58, 95); // Indigo 900
    doc.text("OFFICIAL JOB QUOTE", 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 105, 28, { align: "center" });
    
    // Job Details
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("JOB INFORMATION", 20, 45);
    doc.setLineWidth(0.5);
    doc.line(20, 47, 190, 47);
    
    doc.setFontSize(10);
    doc.text(`Job Title: ${job.title}`, 20, 55);
    doc.text(`Category: ${job.category} - ${job.subcategory}`, 20, 62);
    doc.text(`Location: ${job.city}, ${job.postcode}`, 20, 69);
    doc.text(`Posted Date: ${new Date(job.createdAt?.seconds * 1000).toLocaleDateString()}`, 20, 76);
    
    // Tradesperson Details
    doc.setFontSize(14);
    doc.text("TRADESPERSON", 20, 90);
    doc.line(20, 92, 190, 92);
    
    doc.setFontSize(10);
    doc.text(`Name: ${tpProfile?.name || "Tradesperson"}`, 20, 100);
    doc.text(`Rating: ${tpProfile?.rating?.toFixed(1) || "5.0"} / 5.0`, 20, 107);
    
    // Quote Details
    doc.setFontSize(14);
    doc.text("QUOTE DETAILS", 20, 120);
    doc.line(20, 122, 190, 122);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Total Amount: £${quote.amount}`, 20, 132);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Payment Preference: ${quote.paymentPreference?.replace('_', ' ')}`, 20, 139);
    doc.text(`Scope: ${quote.quoteScope?.replace('_', ' ')}`, 20, 146);
    
    doc.setFontSize(11);
    doc.text("Message / Scope of Work:", 20, 160);
    doc.setFontSize(10);
    const splitMessage = doc.splitTextToSize(quote.message, 170);
    doc.text(splitMessage, 20, 167);
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("This document serves as a record of the agreed quote on the platform.", 105, 280, { align: "center" });
    doc.text("Any disputes should be raised through the platform's mediation system.", 105, 285, { align: "center" });
    
    doc.save(`Quote_${job.title.replace(/\s+/g, '_')}.pdf`);
  };

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showTradespersonReviewForm, setShowTradespersonReviewForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [showHistoryId, setShowHistoryId] = useState<string | null>(null);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
  const [initialMediaIndex, setInitialMediaIndex] = useState(0);
  const [requoteMessage, setRequoteMessage] = useState("");
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [isEditingRevision, setIsEditingRevision] = useState(false);
  const [revisionAmount, setRevisionAmount] = useState("");
  const [revisionMessage, setRevisionMessage] = useState("");
  const [revisionScope, setRevisionScope] = useState<"labour_only" | "complete_package">("complete_package");
  const [revisionPaymentPreference, setRevisionPaymentPreference] = useState<"fixed_price" | "hourly" | "negotiable">("fixed_price");
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [withdrawingQuote, setWithdrawingQuote] = useState<any | null>(null);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [disputePhotos, setDisputePhotos] = useState<File[]>([]);
  const [isUploadingDispute, setIsUploadingDispute] = useState(false);
  
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState("weekly");
  const [isProposingRecurring, setIsProposingRecurring] = useState(false);

  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [isRescheduling, setIsRescheduling] = useState(false);

  const handleRaiseDispute = async () => {
    if (!id || !user || !disputeReason) return;
    setIsProcessing(true);
    setIsUploadingDispute(true);
    try {
      const photoUrls: string[] = [];
      for (const file of disputePhotos) {
        const storageRef = ref(storage, `disputes/${id}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        photoUrls.push(url);
      }

      await updateDoc(doc(db, "jobs", id), {
        status: "disputed",
        dispute: {
          raisedBy: user.uid,
          reason: disputeReason,
          photos: photoUrls,
          status: "open",
          createdAt: serverTimestamp()
        }
      });

      // Notify other party
      const otherUserId = isHomeowner ? quotes.find(q => q.status === "accepted")?.tradespersonId : job.homeownerId;
      if (otherUserId) {
        await sendNotification(
          otherUserId,
          "Dispute Raised",
          `A dispute has been raised for the job: "${job.title}".`,
          "status",
          `/job/${id}`
        );
      }

      setJob((prev: any) => ({ ...prev, status: "disputed" }));
      setShowDisputeModal(false);
      setDisputeReason("");
      setDisputePhotos([]);
    } catch (err) {
      console.error("Error raising dispute:", err);
    } finally {
      setIsProcessing(false);
      setIsUploadingDispute(false);
    }
  };

  const handleProposeReschedule = async () => {
    if (!id || !user || !rescheduleDate || !rescheduleReason) return;
    setIsRescheduling(true);
    try {
      await updateDoc(doc(db, "jobs", id), {
        rescheduleProposal: {
          proposedDate: rescheduleDate,
          reason: rescheduleReason,
          proposedBy: user.uid,
          status: "pending",
          createdAt: serverTimestamp()
        }
      });

      // Notify homeowner
      await sendNotification(
        job.homeownerId,
        "Reschedule Proposed",
        `Tradesperson proposed a new start date for "${job.title}": ${format(new Date(rescheduleDate), 'dd MMM yyyy')}`,
        "status",
        `/job/${id}`
      );

      setShowRescheduleModal(false);
      setRescheduleDate("");
      setRescheduleReason("");
    } catch (err) {
      console.error("Error proposing reschedule:", err);
    } finally {
      setIsRescheduling(false);
    }
  };

  const handleAcceptReschedule = async () => {
    if (!id || !job.rescheduleProposal) return;
    setIsProcessing(true);
    try {
      const newDate = job.rescheduleProposal.proposedDate;
      const oldDate = job.scheduledDate;
      const tradespersonId = job.acceptedTradespersonId;

      // 1. Update Job
      await updateDoc(doc(db, "jobs", id), {
        scheduledDate: newDate,
        "rescheduleProposal.status": "accepted",
        updatedAt: serverTimestamp()
      });

      // 2. Update Tradesperson Calendar
      try {
        const tpRef = doc(db, "users", tradespersonId);
        const tpSnap = await getDoc(tpRef);
        if (tpSnap.exists()) {
          const tpData = tpSnap.data();
          const dateOverrides = tpData.dateOverrides || {};
          
          // Unbook old date
          if (oldDate) {
            delete dateOverrides[oldDate];
          }
          
          // Book new date
          dateOverrides[newDate] = "booked";

          await updateDoc(tpRef, {
            dateOverrides
          });
        }
      } catch (err) {
        console.error("Error updating tradesperson availability for reschedule:", err);
      }

      // 3. Notify Tradesperson
      await sendNotification(
        tradespersonId,
        "Reschedule Accepted",
        `Homeowner accepted the new start date for "${job.title}": ${format(new Date(newDate), 'dd MMM yyyy')}`,
        "status",
        `/job/${id}`
      );

      setJob(prev => ({
        ...prev,
        scheduledDate: newDate,
        rescheduleProposal: { ...prev.rescheduleProposal, status: "accepted" }
      }));
    } catch (err) {
      console.error("Error accepting reschedule:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectReschedule = async () => {
    if (!id || !job.rescheduleProposal) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, "jobs", id), {
        "rescheduleProposal.status": "rejected",
        updatedAt: serverTimestamp()
      });

      // Notify Tradesperson
      await sendNotification(
        job.acceptedTradespersonId,
        "Reschedule Rejected",
        `Homeowner declined the reschedule request for "${job.title}".`,
        "status",
        `/job/${id}`
      );

      setJob(prev => ({
        ...prev,
        rescheduleProposal: { ...prev.rescheduleProposal, status: "rejected" }
      }));
    } catch (err) {
      console.error("Error rejecting reschedule:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmJob = async () => {
    if (!id || !user || !job.scheduledDate) return;
    setIsProcessing(true);
    try {
      // 1. Update Job
      await updateDoc(doc(db, "jobs", id), {
        isConfirmedByTradesperson: true,
        updatedAt: serverTimestamp()
      });

      // 2. Update Tradesperson Availability
      try {
        const tpRef = doc(db, "users", user.uid);
        const tpSnap = await getDoc(tpRef);
        if (tpSnap.exists()) {
          const tpData = tpSnap.data();
          const dateOverrides = tpData.dateOverrides || {};
          dateOverrides[job.scheduledDate] = "booked";

          await updateDoc(tpRef, {
            dateOverrides
          });
        }
      } catch (err) {
        console.error("Error updating availability on confirmation:", err);
      }

      // 3. Notify Homeowner
      await sendNotification(
        job.homeownerId,
        "Job Confirmed",
        `Tradesperson confirmed the start date for "${job.title}": ${format(new Date(job.scheduledDate), 'dd MMM yyyy')}`,
        "status",
        `/job/${id}`
      );

      setJob(prev => ({ ...prev, isConfirmedByTradesperson: true }));
    } catch (err) {
      console.error("Error confirming job:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!id || !user || !myQuote) return;
    
    const currentRevisions = myQuote.revisionCount || 0;
    if (currentRevisions >= 5) {
      setError("Maximum revision limit (5) reached for this quote.");
      return;
    }

    setIsProcessing(true);
    try {
      await updateDoc(doc(db, "jobs", id, "quotes", myQuote.id), {
        pendingRevision: {
          amount: parseFloat(revisionAmount),
          message: revisionMessage,
          quoteScope: revisionScope,
          paymentPreference: revisionPaymentPreference,
          status: "pending",
          createdAt: serverTimestamp()
        },
        revisionCount: currentRevisions + 1
      });
      
      // Notify homeowner
      await sendNotification(
        job.homeownerId,
        "Quote Revision Requested",
        `The tradesperson has requested a price/scope change for "${job.title}".`,
        "quote",
        `/job/${id}`
      );
      
      setIsEditingRevision(false);
      setRevisionAmount("");
      setRevisionMessage("");
    } catch (err) {
      console.error("Error requesting revision:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveRevision = async (quote: any) => {
    if (!id || !user) return;
    setIsProcessing(true);
    try {
      const revision = quote.pendingRevision;
      await updateDoc(doc(db, "jobs", id, "quotes", quote.id), {
        history: arrayUnion({
          amount: quote.amount,
          message: quote.message,
          paymentPreference: quote.paymentPreference,
          quoteScope: quote.quoteScope,
          timestamp: new Date().toISOString(),
          reason: "Revision Approved"
        }),
        amount: revision.amount,
        message: `${quote.message}\n\n[Revision Approved]: ${revision.message}`,
        quoteScope: revision.quoteScope || quote.quoteScope,
        paymentPreference: revision.paymentPreference || quote.paymentPreference,
        pendingRevision: deleteField()
      });
      
      // Notify tradesperson
      await sendNotification(
        quote.tradespersonId,
        "Revision Approved!",
        `The homeowner has approved your quote revision for "${job.title}".`,
        "status",
        `/job/${id}`
      );
    } catch (err) {
      console.error("Error approving revision:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectRevision = async (quote: any) => {
    if (!id || !user) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, "jobs", id, "quotes", quote.id), {
        pendingRevision: deleteField()
      });
      
      // Notify tradesperson
      await sendNotification(
        quote.tradespersonId,
        "Revision Declined",
        `The homeowner has declined your quote revision for "${job.title}".`,
        "status",
        `/job/${id}`
      );
    } catch (err) {
      console.error("Error rejecting revision:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelJob = async () => {
    if (!id) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, "jobs", id), {
        status: "cancelled"
      });
      setJob((prev: any) => ({ ...prev, status: "cancelled" }));
      setShowActions(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteJob = async () => {
    if (!id || !window.confirm("Are you sure you want to delete this job?")) return;
    setIsProcessing(true);
    try {
      await deleteDoc(doc(db, "jobs", id));
      navigate("/my-jobs");
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRepostJob = async () => {
    if (!id) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, "jobs", id), {
        status: "posted",
        postedDate: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      setJob((prev: any) => ({ ...prev, status: "posted", postedDate: new Date().toISOString(), createdAt: new Date().toISOString() }));
      setShowActions(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartChat = async (quote: any, tpProfile: any) => {
    if (!id || !user || !job) return;
    const conversationId = `${id}_${quote.tradespersonId}`;
    const conversationRef = doc(db, "conversations", conversationId);
    
    try {
      const convDoc = await getDoc(conversationRef);
      if (!convDoc.exists()) {
        await setDoc(conversationRef, {
          id: conversationId,
          participants: [job.homeownerId, quote.tradespersonId],
          jobId: id,
          jobTitle: job.title,
          updatedAt: serverTimestamp(),
        });
      }
      
      navigate(`/chat/${conversationId}`, { 
        state: { 
          jobTitle: job.title,
          recipientName: isHomeowner ? (tpProfile?.name || "Tradesperson") : (homeownerProfile?.name || "Homeowner")
        }
      });
    } catch (err) {
      console.error("Error starting chat:", err);
    }
  };

  const handleDismissRecurring = async () => {
    if (!id || !user || !job) return;
    try {
      const currentDismissed = job.recurringDismissedBy || [];
      await updateDoc(doc(db, "jobs", id), {
        recurringDismissedBy: [...currentDismissed, user.uid]
      });
      setJob((prev: any) => ({
        ...prev,
        recurringDismissedBy: [...currentDismissed, user.uid]
      }));
    } catch (err) {
      console.error("Error dismissing recurring prompt:", err);
    }
  };

  const handleProposeRecurring = async () => {
    if (!id || !user || !job) return;
    setIsProposingRecurring(true);
    try {
      const acceptedQuote = quotes.find(q => q.status === "accepted");
      if (!acceptedQuote) throw new Error("No accepted quote found");

      const scheduleId = `recurring_${id}_${Date.now()}`;
      const otherPartyId = isHomeowner ? acceptedQuote.tradespersonId : job.homeownerId;
      
      await setDoc(doc(db, "recurring_schedules", scheduleId), {
        id: scheduleId,
        originalJobId: id,
        homeownerId: job.homeownerId,
        tradespersonId: acceptedQuote.tradespersonId,
        participants: [job.homeownerId, acceptedQuote.tradespersonId],
        category: job.category,
        title: job.title,
        postcode: job.postcode,
        paymentPreference: job.paymentPreference,
        quoteScope: job.quoteScope,
        frequency: recurringFrequency,
        status: "pending_approval",
        proposedBy: user.uid,
        amount: acceptedQuote.amount,
        createdAt: serverTimestamp()
      });

      // Notify the other party
      await sendNotification(
        otherPartyId,
        "Recurring Schedule Proposed",
        `${isHomeowner ? "Homeowner" : "Tradesperson"} proposed a ${recurringFrequency} schedule for "${job.title}".`,
        "status",
        `/profile`
      );

      setShowRecurringModal(false);
      // Automatically dismiss the prompt for this user so they don't see it again
      await handleDismissRecurring();
    } catch (err) {
      console.error("Error proposing recurring schedule:", err);
    } finally {
      setIsProposingRecurring(false);
    }
  };

  const isHomeowner = user?.uid === job?.homeownerId;
  const canSeeFullDetails = isHomeowner || quotes.find(q => q.status === "accepted")?.tradespersonId === user?.uid;
  const hasQuoted = quotes.some(q => q.tradespersonId === user?.uid);
  const myQuote = quotes.find(q => q.tradespersonId === user?.uid);
  const needsRequote = myQuote?.status === "requote_requested";

  useEffect(() => {
    if (needsRequote && myQuote) {
      setQuoteAmount(myQuote.amount.toString());
      setQuoteMessage(myQuote.message);
      setPaymentPreference(myQuote.paymentPreference || "fixed_price");
      setQuoteScope(myQuote.quoteScope || "complete_package");
    }
  }, [needsRequote, myQuote]);

  const handleDownloadInvoice = () => {
    if (!job || !myQuote || !profile) return;
    
    const invoiceWindow = window.open('', '_blank');
    if (!invoiceWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${job.title}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; color: #333; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 40px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
          .title { font-size: 24px; font-weight: bold; color: #1e3a5f; margin: 0; }
          .invoice-details { text-align: right; }
          .section { margin-bottom: 30px; }
          .section-title { font-size: 14px; font-weight: bold; text-transform: uppercase; color: #666; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          table { w-full; border-collapse: collapse; margin-top: 20px; width: 100%; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
          th { background-color: #f8fafc; font-weight: bold; color: #64748b; }
          .total-row { font-weight: bold; font-size: 18px; }
          .footer { margin-top: 60px; text-align: center; color: #666; font-size: 14px; border-top: 1px solid #eee; padding-top: 20px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">INVOICE</h1>
            <p style="margin-top: 5px; color: #666;">Job No: ${job.jobNo || job.id.substring(0, 8).toUpperCase()}</p>
          </div>
          <div class="invoice-details">
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>Status:</strong> Paid / Completed</p>
          </div>
        </div>

        <div class="grid section">
          <div>
            <div class="section-title">From (Tradesperson)</div>
            <p><strong>${profile.name}</strong></p>
            <p>${profile.trades?.join(', ') || 'Professional Tradesperson'}</p>
            <p>${profile.email || ''}</p>
          </div>
          <div>
            <div class="section-title">To (Customer)</div>
            <p><strong>${job.homeownerName || 'Customer'}</strong></p>
            <p>${job.postcode || ''}</p>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Job Details</div>
          <p><strong>${job.title}</strong></p>
          <p style="color: #666;">${job.description}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                Agreed Quote for Services
                <br>
                <small style="color: #666;">Scope: ${myQuote.quoteScope === 'labour_only' ? 'Labour Only' : 'Complete Package (Labour & Materials)'}</small>
              </td>
              <td style="text-align: right;">£${myQuote.amount.toFixed(2)}</td>
            </tr>
            ${myQuote.revisionCount && myQuote.revisionCount > 0 ? `
            <tr>
              <td>Agreed Revisions / Scope Changes</td>
              <td style="text-align: right;">Included</td>
            </tr>
            ` : ''}
            <tr class="total-row">
              <td style="text-align: right; padding-top: 20px;">Total Due:</td>
              <td style="text-align: right; padding-top: 20px;">£${myQuote.amount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <p>Thank you for your business!</p>
          <p>Generated via AnyTrader</p>
        </div>
        <script>
          window.onload = () => {
            window.print();
          };
        </script>
      </body>
      </html>
    `;
    
    invoiceWindow.document.write(html);
    invoiceWindow.document.close();
  };

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (!job) return <div className="py-12 text-center">Job not found.</div>;

  const fastestStartId = [...quotes]
    .filter(q => q.startDate)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0]?.id;

  const sortedQuotes = [...quotes].sort((a, b) => {
    // 1. Accepted first
    if (a.status === "accepted" && b.status !== "accepted") return -1;
    if (b.status === "accepted" && a.status !== "accepted") return 1;

    // 2. AI Value (Percentile) - Higher is better
    const analysisA = quoteAnalyses[a.id];
    const analysisB = quoteAnalyses[b.id];
    if (analysisA && analysisB) {
      if (analysisA.percentile !== analysisB.percentile) {
        return analysisB.percentile - analysisA.percentile;
      }
    }

    // 3. Trader Rating
    const profileA = tradespersonProfiles[a.tradespersonId];
    const profileB = tradespersonProfiles[b.tradespersonId];
    const ratingA = profileA?.rating || 0;
    const ratingB = profileB?.rating || 0;
    if (ratingA !== ratingB) return ratingB - ratingA;

    // 4. Fastest Start (Earliest start date)
    const dateA_start = a.startDate ? new Date(a.startDate).getTime() : Infinity;
    const dateB_start = b.startDate ? new Date(b.startDate).getTime() : Infinity;
    if (dateA_start !== dateB_start) return dateA_start - dateB_start;

    // 5. Recency (Newest first)
    const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
    const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
    return dateB.getTime() - dateA.getTime();
  });

  return (
    <div className="max-w-2xl mx-auto bg-slate-50 min-h-screen pb-20">
      <SEO 
        title={job.title} 
        description={job.description.substring(0, 160)}
        ogType="article"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "JobPosting",
          "title": job.title,
          "description": job.description,
          "datePosted": job.postedDate?.toDate?.()?.toISOString() || new Date().toISOString(),
          "hiringOrganization": {
            "@type": "Organization",
            "name": "AnyTrader",
            "logo": `${window.location.origin}/logo.png`
          },
          "jobLocation": {
            "@type": "Place",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": job.location,
              "addressRegion": "UK"
            }
          }
        }}
      />
      {/* Header */}
      <div className="bg-[#1e3a5f] text-white p-4 sticky top-0 z-30">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={() => {
              if (window.history.state && window.history.state.idx > 0) {
                navigate(-1);
              } else {
                navigate("/");
              }
            }} className="p-1 hover:bg-white/10 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
          </div>
          {isHomeowner && (
            <div className="relative">
              <button 
                onClick={() => setShowActions(!showActions)}
                className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
              >
                <MoreVertical className="w-6 h-6" />
              </button>
              
              <AnimatePresence>
                {showActions && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowActions(false)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-20 py-2"
                    >
                      <button
                        onClick={() => navigate(`/post-job`, { state: { editJob: job } })}
                        className="w-full px-4 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit Job
                      </button>
                      
                      {(job.status === "posted" || job.status === "accepted") && (
                        <button
                          onClick={handleCancelJob}
                          disabled={isProcessing}
                          className="w-full px-4 py-2 text-left text-sm font-semibold text-amber-600 hover:bg-amber-50 flex items-center gap-2 disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                          Cancel Job
                        </button>
                      )}
                      
                      {(job.status === "cancelled" || job.status === "completed") && (
                        <button
                          onClick={handleRepostJob}
                          disabled={isProcessing}
                          className="w-full px-4 py-2 text-left text-sm font-semibold text-green-600 hover:bg-green-50 flex items-center gap-2 disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                          Repost Job
                        </button>
                      )}
                      
                      <div className="h-px bg-slate-100 my-1" />
                      
                      {/* Delete Job option removed as requested */}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Confirmation Banner (Tradesperson) */}
        {!isHomeowner && job.status === "accepted" && !job.isConfirmedByTradesperson && (
          <div className="bg-indigo-600 text-white p-6 rounded-3xl space-y-4 shadow-xl shadow-indigo-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Calendar className="w-24 h-24" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <Clock className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg">Confirm Start Date</h3>
              </div>
              <p className="text-sm text-indigo-100 mb-4">
                Homeowner accepted your quote! Please confirm you can start on <strong>{format(new Date(job.scheduledDate), 'dd MMM yyyy')}</strong>.
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={handleConfirmJob}
                  disabled={isProcessing}
                  className="flex-1 bg-white text-indigo-600 py-3 rounded-xl text-sm font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Confirm & Schedule
                </button>
                <button 
                  onClick={() => setShowRescheduleModal(true)}
                  className="px-4 py-3 bg-indigo-500 text-white rounded-xl text-sm font-bold hover:bg-indigo-400 transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reschedule
                </button>
              </div>
              <div className="mt-4 pt-4 border-t border-white/10">
                <a 
                  href="/availability" 
                  className="text-[10px] font-bold uppercase tracking-widest text-indigo-200 hover:text-white flex items-center gap-1"
                >
                  Check my availability calendar
                  <ChevronRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Waiting for Confirmation Banner (Homeowner) */}
        {isHomeowner && job.status === "accepted" && !job.isConfirmedByTradesperson && (
          <div className="bg-slate-50 border border-slate-200 p-6 rounded-3xl space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                <Clock className="w-5 h-5 text-slate-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Waiting for Confirmation</h3>
                <p className="text-xs text-slate-500">Tradesperson is checking their schedule</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              We've notified the tradesperson to confirm the start date (<strong>{format(new Date(job.scheduledDate), 'dd MMM yyyy')}</strong>). You'll be notified as soon as they confirm or propose a change.
            </p>
          </div>
        )}

        {/* Reschedule Proposal Banner (Homeowner) */}
        {isHomeowner && job.rescheduleProposal?.status === "pending" && (
          <div className="bg-orange-50 border border-orange-100 p-6 rounded-3xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-orange-900">Reschedule Request</h3>
                <p className="text-xs text-orange-600">Tradesperson proposed a new start date</p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-orange-50 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Date</p>
                  <p className="text-sm font-bold text-slate-700">{format(new Date(job.scheduledDate), 'dd MMM yyyy')}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Proposed Date</p>
                  <p className="text-sm font-bold text-orange-600">{format(new Date(job.rescheduleProposal.proposedDate), 'dd MMM yyyy')}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Reason</p>
                <p className="text-sm text-slate-600 italic">"{job.rescheduleProposal.reason}"</p>
              </div>
              <div className="flex gap-2 pt-2">
                <button 
                  onClick={handleAcceptReschedule}
                  disabled={isProcessing}
                  className="flex-1 bg-green-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Accept New Date
                </button>
                <button 
                  onClick={handleRejectReschedule}
                  disabled={isProcessing}
                  className="px-6 border border-slate-200 text-slate-600 py-3 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recurring Prompt Banner */}
        {job.status === "completed" && RECURRING_CATEGORIES.includes(job.category) && !hasRecurringSchedule && !job.recurringDismissedBy?.includes(user?.uid) && (
          <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <RefreshCw className="w-24 h-24 text-indigo-600" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="font-bold text-indigo-900">
                  {isHomeowner ? "Loved the work?" : "Secure regular income!"}
                </h3>
              </div>
              <p className="text-sm text-indigo-700 mb-4">
                {isHomeowner 
                  ? "Schedule this as a regular service and never worry about it again." 
                  : "Propose a recurring schedule to this homeowner for guaranteed future work."}
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowRecurringModal(true)}
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors"
                >
                  Set up schedule
                </button>
                <button 
                  onClick={handleDismissRecurring}
                  className="px-4 py-3 border border-indigo-200 text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dispute Banner */}
        {job.status === "disputed" && (
          <div className="bg-red-50 border border-red-100 p-6 rounded-3xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-900">Job in Dispute</h3>
                <p className="text-xs text-red-600">Mediation is required to proceed</p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-red-50 space-y-3">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Reason for Dispute</p>
                <p className="text-sm text-slate-700 leading-relaxed">{job.dispute?.reason}</p>
                
                {disputeResolution ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 rounded-2xl bg-indigo-50 border border-indigo-100 space-y-3"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">AI Mediator Suggestion</h4>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-indigo-800 font-semibold">{disputeResolution.summary}</p>
                      <div className="p-3 bg-white rounded-xl border border-indigo-50">
                        <p className="text-xs text-slate-700 leading-relaxed">{disputeResolution.suggestion}</p>
                        {disputeResolution.fairPrice && (
                          <p className="mt-2 text-sm font-bold text-indigo-600">Suggested Fair Price: £{disputeResolution.fairPrice}</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="space-y-2">
                    <button 
                      onClick={handleMediateDispute}
                      disabled={isMediating}
                      className="mt-4 w-full p-3 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50"
                    >
                      {isMediating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      Get AI Mediation Suggestion
                    </button>
                    {isMediating && (
                      <button 
                        onClick={() => setIsMediating(false)}
                        className="w-full py-1 text-slate-400 font-bold text-[10px] hover:text-slate-600 transition-all text-center"
                      >
                        Skip AI Mediation
                      </button>
                    )}
                  </div>
                )}
              </div>
              {job.dispute?.photos && job.dispute.photos.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {job.dispute.photos.map((url: string, i: number) => (
                    <img 
                      key={i} 
                      src={url} 
                      className="w-16 h-16 rounded-lg object-cover border border-slate-100" 
                      referrerPolicy="no-referrer"
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-red-400">
              <Clock className="w-3 h-3" />
              <span>Raised on {new Date(job.dispute?.createdAt?.seconds * 1000).toLocaleDateString()}</span>
            </div>
          </div>
        )}

        {/* Active Chat Card */}
        {(job.status === "accepted" || job.status === "in_progress" || job.status === "disputed") && (
          <div className="bg-blue-600 rounded-3xl p-6 text-white shadow-lg shadow-blue-100 flex items-center justify-between group overflow-hidden relative">
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Active Discussion</h3>
                <p className="text-blue-100 text-xs">Chat with {isHomeowner ? (tradespersonProfiles[quotes.find(q => q.status === "accepted")?.tradespersonId]?.name || "Tradesperson") : (homeownerProfile?.name || "Homeowner")}</p>
              </div>
            </div>
            <button 
              onClick={() => {
                const acceptedQuote = quotes.find(q => q.status === "accepted");
                if (acceptedQuote) {
                  const tpProfile = tradespersonProfiles[acceptedQuote.tradespersonId];
                  handleStartChat(acceptedQuote, tpProfile);
                }
              }}
              className="relative z-10 bg-white text-blue-600 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all active:scale-95 flex items-center gap-2"
            >
              Open Chat
              <ChevronRight className="w-4 h-4" />
            </button>
            {/* Decorative background circle */}
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          </div>
        )}

        {/* Job Info Section */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {job.jobNo && (
              <span className="bg-slate-900 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                Job #{job.jobNo}
              </span>
            )}
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
              job.status === 'posted' ? "bg-blue-50 text-blue-600" :
              job.status === 'accepted' ? "bg-green-50 text-green-600" :
              job.status === 'in_progress' ? "bg-orange-50 text-orange-600" :
              "bg-slate-100 text-slate-600"
            )}>
              {job.status === 'posted' ? 'Seeking Quotes' : job.status.replace('_', ' ')}
            </span>
            {job.status === "accepted" && job.scheduledDate && (
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1",
                  job.isConfirmedByTradesperson ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-400"
                )}>
                  <Calendar className="w-3 h-3" />
                  {job.isConfirmedByTradesperson ? "Scheduled" : "Proposed"}: {format(new Date(job.scheduledDate), 'dd MMM yyyy')}
                </span>
                
                {/* Calendar Sync Options */}
                {job.isConfirmedByTradesperson && (
                  <div className="flex items-center gap-1">
                    <a 
                      href={generateGoogleCalendarLink(job, quotes.find(q => q.status === "accepted") || {})}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 bg-white border border-slate-200 rounded-md text-slate-400 hover:text-blue-600 hover:border-blue-100 transition-all shadow-sm"
                      title="Add to Google Calendar"
                    >
                      <img src="https://www.gstatic.com/calendar/images/dynamiclogo_2020q4/calendar_31_2x.png" className="w-3 h-3" alt="Google" referrerPolicy="no-referrer" />
                    </a>
                    <a 
                      href={generateOutlookCalendarLink(job, quotes.find(q => q.status === "accepted") || {})}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 bg-white border border-slate-200 rounded-md text-slate-400 hover:text-blue-600 hover:border-blue-100 transition-all shadow-sm"
                      title="Add to Outlook"
                    >
                      <img src="https://res-1.cdn.office.net/assets/bookwithme/v1/outlook_calendar_24x24.png" className="w-3 h-3" alt="Outlook" referrerPolicy="no-referrer" />
                    </a>
                    <button 
                      onClick={() => downloadICS(job, quotes.find(q => q.status === "accepted") || {})}
                      className="p-1 bg-white border border-slate-200 rounded-md text-slate-400 hover:text-blue-600 hover:border-blue-100 transition-all shadow-sm"
                      title="Download iCal (.ics)"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                )}
                {job.status === "accepted" && !isHomeowner && (
                  <button 
                    onClick={() => setShowRescheduleModal(true)}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-md transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Reschedule
                  </button>
                )}
              </div>
            )}
            <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              {job.urgency === "specific_date" && job.jobDate ? `Date: ${new Date(job.jobDate).toLocaleDateString()}` : job.urgency}
            </span>
            {job.estimatedCompletionTime && (
              <span className="bg-green-50 text-green-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {job.estimatedCompletionTime} {job.estimatedCompletionTimeUnit}
              </span>
            )}
            {job.paymentPreference && (
              <span className="bg-purple-50 text-purple-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider capitalize">
                {job.paymentPreference.replace('_', ' ')}
              </span>
            )}
            {job.quoteScope && (
              <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider capitalize">
                {job.quoteScope.replace('_', ' ')}
              </span>
            )}
          </div>

          {/* Expiry Banner */}
          {job.urgency === 'emergency' && 
           !job.expiryAcknowledged && 
           user?.uid === job.homeownerId && 
           (job.isBoosted ? new Date().getTime() > new Date(job.boostExpiresAt).getTime() : new Date().getTime() > (job.createdAt?.seconds * 1000 + 2 * 60 * 60 * 1000)) && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
              <h3 className="text-red-800 font-bold text-lg mb-2">Still Seeking Quotes</h3>
              <p className="text-red-600 text-sm mb-4">No traders responded to your emergency request in time. What would you like to do?</p>
              <div className="flex flex-wrap gap-2">
                {(!job.isBoosted && (job.retryCount || 0) >= 2) ? (
                  <button onClick={async () => {
                    const confirmBoost = window.confirm("Tradespeople are currently very busy. Boost your emergency job to the top of their feeds for £5 to get immediate attention. Proceed to checkout?");
                    if (!confirmBoost) return;

                    try {
                      const response = await fetch("/api/create-checkout-session", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          userId: user?.uid,
                          priceId: "price_mock_boost", // Replace with actual Stripe price ID
                          mode: "payment",
                          metadata: {
                            type: "boost",
                            jobId: id
                          },
                          successUrl: `${window.location.origin}/job/${id}?boost_success=true`,
                          cancelUrl: `${window.location.origin}/job/${id}`
                        }),
                      });

                      const data = await response.json();
                      if (data.url) {
                        window.location.href = data.url;
                      } else {
                        throw new Error(data.error || "Failed to initiate checkout");
                      }
                    } catch (err: any) {
                      console.error("Boost payment init failed:", err);
                      alert(err.message || "Failed to start checkout. Please try again later.");
                    }
                  }} className="bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
                    <Zap className="w-4 h-4" /> Boost for £5
                  </button>
                ) : (
                  <button onClick={async () => {
                    await updateDoc(doc(db, "jobs", id!), { 
                      postedDate: serverTimestamp(), 
                      createdAt: serverTimestamp(),
                      retryCount: (job.retryCount || 0) + 1
                    });
                    setJob((prev: any) => ({ 
                      ...prev, 
                      postedDate: new Date(), 
                      createdAt: new Date(),
                      retryCount: (prev.retryCount || 0) + 1
                    }));
                  }} className="bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold">Re-post as Emergency</button>
                )}
                <button onClick={async () => {
                  await updateDoc(doc(db, "jobs", id!), { urgency: "asap", expiryAcknowledged: true });
                  setJob((prev: any) => ({ ...prev, urgency: "asap", expiryAcknowledged: true }));
                }} className="bg-white text-red-600 border border-red-200 px-4 py-2 rounded-xl text-sm font-bold">Convert to Standard</button>
                <button onClick={async () => {
                  await updateDoc(doc(db, "jobs", id!), { status: "cancelled", expiryAcknowledged: true });
                  navigate("/my-jobs");
                }} className="bg-white text-slate-600 border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold">Delete Post</button>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-orange-500 text-xs font-bold uppercase tracking-widest">
              {job.category} • {job.subcategory}
            </p>
            <h1 className="text-3xl font-black text-slate-900 leading-tight">
              {job.title}
            </h1>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-500">
              <MapPin className="w-4 h-4" />
              <span className="text-sm font-bold uppercase">
                {canSeeFullDetails ? job.postcode : getOutwardPostcode(job.postcode || job.area)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-bold">
                {new Date(job.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {/* Map Section */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                <Wrench className="w-4 h-4 text-blue-600" />
              </div>
              Job Location
            </h3>
            <button 
              onClick={() => setShowMap(!showMap)}
              className="text-orange-500 font-bold text-sm hover:text-orange-600 transition-colors"
            >
              {showMap ? 'Hide map' : 'Show map'}
            </button>
          </div>
          
          <AnimatePresence>
            {showMap && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="aspect-video bg-slate-100 rounded-2xl relative flex items-center justify-center overflow-hidden border border-slate-200 pointer-events-none">
                  <iframe
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent((getOutwardPostcode(job.postcode) || '') + (job.city ? `, ${job.city}` : ''))}&t=&z=10&ie=UTF8&iwloc=&output=embed`}
                  ></iframe>
                  
                  {/* Dotted Area Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-48 border-2 border-dashed border-red-500/40 rounded-full bg-red-500/5" />
                  </div>

                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                    <div className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs font-bold text-slate-900 uppercase">
                        {canSeeFullDetails ? job.postcode : getOutwardPostcode(job.postcode || job.area)}
                      </span>
                      <span className="bg-orange-50 text-orange-600 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">Approx. area</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-start gap-2 text-slate-400 bg-slate-50 p-3 rounded-xl">
            <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] font-medium leading-relaxed">
              Exact address shown only after quote is accepted
            </p>
          </div>
        </div>

        {/* Description Section */}
        <div className="space-y-3">
          <h3 className="text-xl font-bold text-slate-900">Job Description</h3>
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-slate-600 font-medium leading-relaxed">{job.description}</p>
            </div>

            {job.quoteScope && (
              <div className="pt-4 border-t border-slate-50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center">
                    <PoundSterling className="w-3 h-3 text-indigo-600" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Quote Scope</h4>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-sm text-slate-700 font-semibold mb-1">
                    {job.quoteScope === 'complete_package' ? 'Complete Package (Materials & Labour)' : 
                     job.quoteScope === 'labour_only' ? 'Labour Only (Homeowner provides materials)' : 
                     job.quoteScope.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {job.quoteScope === 'complete_package' 
                      ? 'The tradesperson will be responsible for sourcing and providing all necessary materials for this job.' 
                      : 'The homeowner is expected to have all necessary materials ready. The quote will only cover the cost of professional labour.'}
                  </p>
                </div>

                {job.quoteScope === "labour_only" && (
                  <div className="mt-4 pt-4 border-t border-slate-50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">AI Material List</h4>
                      </div>
                      {materialList.length === 0 && (
                        <button 
                          onClick={handleGenerateMaterialList}
                          disabled={isGeneratingMaterials}
                          className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
                        >
                          {isGeneratingMaterials ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          Generate List
                        </button>
                      )}
                    </div>
                    
                    {materialList.length > 0 ? (
                      <div className="bg-blue-50 rounded-2xl p-4 space-y-3">
                        <p className="text-[10px] text-blue-700 font-bold uppercase tracking-tight">Recommended Shopping List:</p>
                        <ul className="space-y-2">
                          {materialList.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                              {item}
                            </li>
                          ))}
                        </ul>
                        <button 
                          onClick={() => setMaterialList([])}
                          className="text-[9px] font-bold text-blue-600 uppercase tracking-widest hover:underline"
                        >
                          Regenerate
                        </button>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500 italic">This is a "Labour Only" job. Use AI to generate a shopping list of materials you might need to provide.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* AI Price Estimate Card */}
            {job.estimateMin && job.estimateMax && (
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                    </div>
                    AI Price Estimate
                  </h3>
                  <div className="bg-slate-100 px-2 py-1 rounded-full text-[10px] font-bold text-slate-600 uppercase">
                    87% Confidence
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="text-4xl font-black text-slate-900">
                    £{job.estimateMin.toLocaleString()} – £{job.estimateMax.toLocaleString()}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                      <span>Labour</span>
                      <span>55%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600" style={{ width: '55%' }} />
                    </div>
                    
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                      <span>Materials</span>
                      <span>30%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500" style={{ width: '30%' }} />
                    </div>
                    
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                      <span>Overheads</span>
                      <span>15%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400" style={{ width: '15%' }} />
                    </div>
                  </div>
                  
                  <p className="text-[10px] text-slate-500 leading-relaxed italic">
                    Based on similar jobs in {job.city || 'your area'}. Seasonal adjustments applied. Actual quotes may vary.
                  </p>
                </div>
              </div>
            )}

            {(isHomeowner || quotes.find(q => q.status === "accepted")?.tradespersonId === user?.uid) && (
              <button 
                onClick={() => navigate(`/job/${id}/timeline`)}
                className="w-full bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-[#1e3a5f] transition-colors">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-bold text-slate-900 text-sm">Job Status Timeline</h4>
                    <p className="text-[10px] text-slate-500">Track progress from posting to completion</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-[#1e3a5f] transition-colors" />
              </button>
            )}
          </div>
        </div>

        {/* Documents Section */}
        {job.documents && job.documents.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xl font-bold text-slate-900">Plans & Drawings</h3>
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Project Documents</h4>
                  <p className="text-[10px] text-slate-500">Essential plans for accurate quoting</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {job.documents.map((doc: any, idx: number) => (
                  <a 
                    key={idx} 
                    href={doc.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                        <FileText className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                      </div>
                      <span className="text-sm font-bold text-slate-700 truncate">{doc.name}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Media Section (if any) */}
        {((job.photos && job.photos.length > 0) || (job.videos && job.videos.length > 0)) && (
          <div className="space-y-3">
            <h3 className="text-xl font-bold text-slate-900">Photos & Videos</h3>
            <div className="grid grid-cols-2 gap-3">
              {job.photos?.map((url: string, i: number) => (
                <div key={`photo-${i}`} className="aspect-square rounded-3xl overflow-hidden border border-slate-100 shadow-sm">
                  <img 
                    src={url} 
                    alt={`Job photo ${i + 1}`} 
                    className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer" 
                    referrerPolicy="no-referrer"
                    onClick={() => {
                      setInitialMediaIndex(i);
                      setIsMediaModalOpen(true);
                    }}
                  />
                </div>
              ))}
              {job.videos?.map((url: string, i: number) => (
                <div key={`video-${i}`} className="aspect-square rounded-3xl overflow-hidden border border-slate-100 bg-slate-900 flex items-center justify-center relative group shadow-sm">
                  <video 
                    src={url} 
                    className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-opacity cursor-pointer"
                    onClick={() => {
                      setInitialMediaIndex((job.photos?.length || 0) + i);
                      setIsMediaModalOpen(true);
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Video className="w-10 h-10 text-white" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <MediaGalleryModal
          isOpen={isMediaModalOpen}
          onClose={() => setIsMediaModalOpen(false)}
          photos={job.photos}
          videos={job.videos}
          title={job.title}
          initialIndex={initialMediaIndex}
        />

        {/* Material Finalization Modal (Fast Pass Feature) */}
        {!isHomeowner && isFinalizingMaterials && finalizingQuoteId && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-100 bg-amber-50">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Finalize Materials List</h3>
                    <p className="text-xs font-bold text-amber-700">Fast Pass Exclusive - Lock in your quote structure</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600">
                  Your quote has been secured! You now have a strict 10-minute window to finalize your material list before the homeowner reviews your bid.
                </p>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Itemized List</h4>
                  {materialList.length > 0 ? (
                    <ul className="space-y-2">
                      {materialList.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-700 bg-slate-50 p-2 rounded-xl">
                          <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <span className="flex-1">{item}</span>
                          <button 
                            onClick={() => setMaterialList(prev => prev.filter((_, i) => i !== idx))}
                            className="text-red-500 p-1 hover:bg-red-100 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center text-slate-500 text-xs">
                      No materials added yet. Add items below or generate an AI list if Labour Only.
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editableMaterialItem}
                    onChange={(e) => setEditableMaterialItem(e.target.value)}
                    placeholder="E.g. 5x Plasterboard sheets..."
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && editableMaterialItem.trim()) {
                        setMaterialList(prev => [...prev, editableMaterialItem.trim()]);
                        setEditableMaterialItem("");
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (editableMaterialItem.trim()) {
                        setMaterialList(prev => [...prev, editableMaterialItem.trim()]);
                        setEditableMaterialItem("");
                      }
                    }}
                    className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-800"
                  >
                    Add
                  </button>
                </div>
                
                <div className="pt-4 border-t border-slate-100">
                   <button 
                      onClick={handleGenerateMaterialList}
                      disabled={isGeneratingMaterials}
                      className="w-full text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center justify-center gap-2 p-2 border border-blue-100 rounded-xl hover:bg-blue-50 transition-colors disabled:opacity-50"
                    >
                      {isGeneratingMaterials ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      {materialList.length > 0 ? "Regenerate AI List" : "Auto-Generate AI List (Labour Only)"}
                    </button>
                </div>

              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
                <button
                  onClick={handleFinalizeMaterialList}
                  disabled={isProcessing}
                  className="flex-1 bg-green-600 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Finalize & Submit
                </button>
              </div>
            </div>
          </div>
        )}

        <QuoteComparisonModal
          isOpen={isComparisonModalOpen}
          onClose={() => setIsComparisonModalOpen(false)}
          quotes={quotes}
          tradespersonProfiles={tradespersonProfiles}
          quoteAnalyses={quoteAnalyses}
          onAccept={handleAcceptQuote}
          onRequestRequote={handleRequoteQuote}
          job={job}
        />

        {/* Quotes Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-slate-900">
              Quotes ({job.quoteCount || quotes.length})
            </h3>
            <div className="flex items-center gap-3">
              {isHomeowner && quotes.length > 1 && (
                <div className="flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider">Smart Sorted</span>
                </div>
              )}
              {quotes.length > 1 && isHomeowner && (
                <button 
                  onClick={() => setIsComparisonModalOpen(true)}
                  className="bg-blue-600 text-white px-6 py-2.5 rounded-2xl font-black text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2 active:scale-95"
                >
                  <BarChart3 className="w-4 h-4" />
                  Compare All
                </button>
              )}
            </div>
          </div>
          
          <div className="space-y-4">
            {/* Show actual quotes for homeowner or the tradesperson's own quote */}
            {sortedQuotes.map((quote) => {
              const tpProfile = tradespersonProfiles[quote.tradespersonId];
              
              // Check if tradesperson is currently within their material editing window (10 mins)
              let isInFinalizationWindow = false;
              let windowExpiresAt = null;
              if (quote.createdAt) {
                const createdAt = quote.createdAt?.toDate ? quote.createdAt.toDate() : new Date(quote.createdAt);
                windowExpiresAt = new Date(createdAt.getTime() + 10 * 60000); // 10 mins
                if (windowExpiresAt > new Date() && !quote.materialsFinalized) {
                  isInFinalizationWindow = true;
                }
              }

              // Hide detailed info from the homeowner if the window is open
              if (isHomeowner && isInFinalizationWindow) {
                 return (
                  <div key={quote.id} className="bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-sm flex items-start justify-between gap-4 animate-pulse">
                     <div className="flex-1 space-y-3">
                       <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                           <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                         </div>
                         <div>
                           <span className="font-bold text-slate-900 block">Quote Secured</span>
                           <span className="text-[10px] font-bold text-slate-500">Tradesperson is finalizing itemized material list...</span>
                         </div>
                       </div>
                     </div>
                  </div>
                 );
              }

              return (
                <div key={quote.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-full overflow-hidden border border-slate-200 relative">
                        {tpProfile?.avatarUrl ? (
                          <img src={tpProfile.avatarUrl} alt={tpProfile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <UserIcon className="w-5 h-5" />
                          </div>
                        )}
                        <BadgeOverlay 
                          badges={getTraderBadges(tpProfile)} 
                          className="absolute -bottom-1 -left-1 -right-1 justify-center z-10 scale-75" 
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 block">{tpProfile?.name || "Tradesperson"}</span>
                          {quote.id === fastestStartId && (
                            <span className="text-[9px] font-black bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                              <Zap className="w-2.5 h-2.5 fill-current" />
                              Fastest Start
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-400 fill-current" />
                          <span className="text-[10px] font-bold text-slate-500">
                            {tpProfile?.rating ? tpProfile.rating.toFixed(1) : "5.0"} ({tpProfile?.totalReviews || 0} reviews)
                          </span>
                        </div>
                      </div>
                    </div>

                    {isHomeowner && quoteAnalyses[quote.id] && (
                      <div className="space-y-3 pb-2">
                        <div className="flex items-center justify-between">
                          <div className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                            quoteAnalyses[quote.id].label === "Budget Friendly" ? "bg-green-50 text-green-600" :
                            quoteAnalyses[quote.id].label === "Good Value" ? "bg-blue-50 text-blue-600" :
                            quoteAnalyses[quote.id].label === "Premium" ? "bg-purple-50 text-purple-600" :
                            "bg-slate-50 text-slate-600"
                          )}>
                            {quoteAnalyses[quote.id].label}
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase">
                            Value vs. area average
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${quoteAnalyses[quote.id].percentile}%` }}
                              className={cn(
                                "h-full",
                                quoteAnalyses[quote.id].percentile > 70 ? "bg-green-500" :
                                quoteAnalyses[quote.id].percentile > 40 ? "bg-blue-500" :
                                "bg-amber-500"
                              )}
                            />
                          </div>
                          <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase">
                            <span>{quoteAnalyses[quote.id].percentile}th percentile</span>
                          </div>
                        </div>
                        
                        <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100/50">
                          <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
                            <Sparkles className="w-3 h-3 inline-block mr-1 -mt-0.5" />
                            {quoteAnalyses[quote.id].winningFactor}
                          </p>
                        </div>
                      </div>
                    )}

                    {reviewSummaries[quote.tradespersonId] && (
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Zap className="w-3 h-3 text-blue-600" />
                        </div>
                        <p className="text-[11px] text-slate-600 italic leading-relaxed">
                          <span className="font-bold text-blue-600 not-italic">AI Summary: </span>
                          "{reviewSummaries[quote.tradespersonId]}"
                        </p>
                      </div>
                    )}

                    <p className="text-slate-600 text-sm leading-relaxed">{quote.message}</p>
                    
                    {quote.startDate && (
                      <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-50 self-start px-3 py-1.5 rounded-lg border border-slate-100">
                          <Calendar className="w-3.5 h-3.5 text-blue-600" />
                          <span>{quote.isImmediateStart ? "Immediately" : `Starts: ${new Date(quote.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}</span>
                        </div>
                        {quote.estimatedTimeline && (
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-50 self-start px-3 py-1.5 rounded-lg border border-slate-100">
                            <Clock className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Timeline: {quote.estimatedTimeline}</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {quote.quoteScope === 'labour_only' && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 items-start mt-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-800">
                          <span className="font-bold">Labour Only Quote:</span> This price covers the tradesperson's time and labour only. You are responsible for purchasing and providing all necessary materials and tools for this job.
                        </div>
                      </div>
                    )}

                    {quote.materialList && quote.materialList.length > 0 && (
                       <div className="mt-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                         <div className="flex items-center gap-2 mb-3">
                           <Sparkles className="w-4 h-4 text-blue-600" />
                           <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Finalized Material List</h4>
                         </div>
                         <ul className="space-y-1.5">
                           {quote.materialList.map((item: string, idx: number) => (
                             <li key={idx} className="flex flex-wrap items-start gap-2 text-xs text-slate-700">
                               <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                               <span>{item}</span>
                             </li>
                           ))}
                         </ul>
                       </div>
                    )}

                    {quote.pendingRevision && (
                      <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <RotateCcw className="w-4 h-4 text-blue-600" />
                            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Quote Revision Requested</p>
                          </div>
                          {quote.revisionCount !== undefined && (
                            <div className="flex items-center gap-1.5">
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map(i => (
                                  <div 
                                    key={i} 
                                    className={cn(
                                      "w-2.5 h-1 rounded-full",
                                      i <= quote.revisionCount ? "bg-blue-400" : "bg-blue-100"
                                    )} 
                                  />
                                ))}
                              </div>
                              <span className="text-[8px] font-bold text-blue-400 uppercase tracking-tighter">
                                {Math.max(0, 5 - quote.revisionCount)} left
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-lg font-black text-blue-900">New Amount: £{quote.pendingRevision.amount}</p>
                          <div className="flex flex-wrap gap-2">
                            {quote.pendingRevision.quoteScope && quote.pendingRevision.quoteScope !== quote.quoteScope && (
                              <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full uppercase">
                                Scope: {quote.pendingRevision.quoteScope.replace('_', ' ')}
                              </span>
                            )}
                            {quote.pendingRevision.paymentPreference && quote.pendingRevision.paymentPreference !== quote.paymentPreference && (
                              <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full uppercase">
                                Payment: {quote.pendingRevision.paymentPreference.replace('_', ' ')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-blue-700 italic">"{quote.pendingRevision.message}"</p>
                        </div>
                        {isHomeowner && (
                          <div className="flex gap-2 pt-1">
                            <button 
                              onClick={() => handleApproveRevision(quote)}
                              disabled={isProcessing}
                              className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                              Approve Change
                            </button>
                            <button 
                              onClick={() => handleRejectRevision(quote)}
                              disabled={isProcessing}
                              className="flex-1 border border-blue-200 text-blue-600 py-2 rounded-xl text-xs font-bold hover:bg-blue-50 transition-colors disabled:opacity-50"
                            >
                              Decline
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {quote.requoteMessage && (
                      <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Requote Requested</p>
                          {quote.revisionCount !== undefined && (
                            <div className="flex items-center gap-1.5">
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map(i => (
                                  <div 
                                    key={i} 
                                    className={cn(
                                      "w-2.5 h-1 rounded-full",
                                      i <= quote.revisionCount ? "bg-amber-400" : "bg-amber-100"
                                    )} 
                                  />
                                ))}
                              </div>
                              <span className="text-[8px] font-bold text-amber-400 uppercase tracking-tighter">
                                {Math.max(0, 5 - quote.revisionCount)} left
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-amber-800 italic">"{quote.requoteMessage}"</p>
                      </div>
                    )}
                    
                    {(isHomeowner || (user?.uid === quote.tradespersonId && quote.status === "accepted")) && (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={() => handleStartChat(quote, tpProfile)}
                            className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                          >
                            <MessageSquare className="w-4 h-4" />
                            Message Tradesperson
                          </button>
                          
                          {quote.history && quote.history.length > 0 && (
                            <button 
                              onClick={() => setShowHistoryId(showHistoryId === quote.id ? null : quote.id)}
                              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                            >
                              <History className="w-4 h-4" />
                              {showHistoryId === quote.id ? "Hide History" : "View History"}
                            </button>
                          )}
                        </div>

                        {quote.status === "accepted" && (
                          <button 
                            onClick={() => handleDownloadQuote(quote)}
                            className="flex items-center gap-1.5 text-xs font-bold text-green-600 hover:text-green-700 transition-colors bg-green-50 self-start px-3 py-1.5 rounded-lg border border-green-100"
                          >
                            <Download className="w-4 h-4" />
                            Download Agreed Quote (PDF)
                          </button>
                        )}
                      </div>
                    )}

                    <AnimatePresence>
                      {showHistoryId === quote.id && quote.history && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quote History</p>
                            {quote.history.map((h: any, idx: number) => (
                              <div key={idx} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-slate-500">{new Date(h.timestamp).toLocaleString()}</span>
                                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{h.reason}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-black text-slate-900">£{h.amount}</p>
                                  <span className="text-[9px] font-bold text-slate-400 uppercase">{h.quoteScope?.replace('_', ' ')}</span>
                                </div>
                                <p className="text-xs text-slate-500 italic">"{h.message}"</p>
                              </div>
                            )).reverse()}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {quote.status === "withdrawn" && quote.withdrawReason && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Withdrawal Reason</p>
                          <p className="text-sm text-slate-700 italic">"{quote.withdrawReason}"</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-right space-y-2">
                    <p className="text-2xl font-black text-slate-900">£{quote.amount}</p>
                    <div className="flex flex-col items-end gap-1">
                      {quote.paymentPreference && (
                        <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full uppercase tracking-tight border border-purple-100">
                          {quote.paymentPreference.replace('_', ' ')}
                        </span>
                      )}
                      {quote.quoteScope && (
                        <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-tight border border-indigo-100">
                          {quote.quoteScope.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full inline-block",
                      quote.status === "accepted" ? "text-green-600 bg-green-50" : 
                      quote.status === "rejected" ? "text-red-600 bg-red-50" : 
                      quote.status === "withdrawn" ? "text-slate-600 bg-slate-100" : 
                      "text-amber-600 bg-amber-50"
                    )}>
                      {quote.status.replace('_', ' ')}
                    </span>
                    
                    {isHomeowner && (quote.status === "pending" || quote.status === "requote_requested") && job.status === "posted" && (
                      <div className="flex flex-col gap-2 pt-2">
                        {activeQuoteId === quote.id ? (
                          <div className="space-y-2">
                            <textarea
                              className="w-full p-2 border border-slate-200 rounded-xl text-xs"
                              placeholder="Enter requote details..."
                              value={requoteMessage}
                              onChange={(e) => setRequoteMessage(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleRequoteQuote(quote)}
                                className="flex-1 bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-amber-700 transition-colors"
                              >
                                Send Request
                              </button>
                              <button
                                onClick={() => setActiveQuoteId(null)}
                                className="flex-1 border border-slate-200 text-slate-500 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button 
                              onClick={() => handleAcceptQuote(quote)}
                              className="w-full bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-green-700 transition-colors"
                            >
                              Accept
                            </button>
                            <button 
                              onClick={() => handleRejectQuote(quote)}
                              className="w-full border border-slate-200 text-slate-500 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
                            >
                              Decline
                            </button>
                            <button 
                              onClick={() => setActiveQuoteId(quote.id)}
                              className="w-full border border-slate-200 text-slate-500 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
                            >
                              Request Requote
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {!isHomeowner && quote.tradespersonId === user?.uid && quote.status === "pending" && job.status === "posted" && (
                      <div className="flex flex-col gap-2 pt-2">
                        {quote.paymentPreference === "negotiable" && !quote.pendingRevision && (
                          isEditingRevision ? (
                            <div className="space-y-2">
                              <input
                                type="number"
                                className="w-full p-2 border border-slate-200 rounded-xl text-xs"
                                placeholder="New Amount (£)"
                                value={revisionAmount}
                                onChange={(e) => setRevisionAmount(e.target.value)}
                              />
                              <textarea
                                className="w-full p-2 border border-slate-200 rounded-xl text-xs"
                                placeholder="Reason for revision..."
                                value={revisionMessage}
                                onChange={(e) => setRevisionMessage(e.target.value)}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={handleRequestRevision}
                                  disabled={isProcessing || !revisionAmount || !revisionMessage}
                                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                                >
                                  Send Request
                                </button>
                                <button
                                  onClick={() => setIsEditingRevision(false)}
                                  className="flex-1 border border-slate-200 text-slate-500 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button 
                              onClick={() => {
                                setRevisionAmount(quote.amount.toString());
                                setRevisionMessage("");
                                setIsEditingRevision(true);
                              }}
                              disabled={(quote.revisionCount || 0) >= 2}
                              className="w-full border border-blue-200 text-blue-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Edit2 className="w-4 h-4" />
                              {(quote.revisionCount || 0) >= 2 ? "Max Revisions Reached" : "Request Revision"}
                            </button>
                          )
                        )}
                        <button 
                          onClick={() => setWithdrawingQuote(quote)}
                          disabled={isProcessing}
                          className="w-full border border-red-200 text-red-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Withdraw Quote
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Blind Bidding Placeholder for Tradespeople */}
            {!isHomeowner && (job.quoteCount || 0) > quotes.length && (
              <div className="space-y-4">
                {Array.from({ length: Math.max(0, (job.quoteCount || 0) - quotes.length) }).map((_, i) => (
                  <div key={`blind-${i}`} className="bg-slate-50/50 p-6 rounded-3xl border border-dashed border-slate-200 flex items-center justify-between gap-4 opacity-70">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                        <UserIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-400 block italic">Other Tradesperson</span>
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Quote Submitted</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-slate-300">£???</p>
                      <span className="text-[9px] font-bold text-slate-300 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-tight">
                        Hidden for Fair Bidding
                      </span>
                    </div>
                  </div>
                ))}
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-blue-600 shrink-0" />
                  <p className="text-xs text-blue-800 font-medium">
                    To ensure fair competition, prices and details of other tradespeople are hidden. The homeowner can see all quotes and will contact you if interested.
                  </p>
                </div>
              </div>
            )}

            {quotes.length === 0 && (!job.quoteCount || job.quoteCount === 0) && (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
                  <Clock className="w-8 h-8 text-slate-200 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xl font-bold text-slate-900">Waiting for quotes...</h4>
                  <p className="text-sm text-slate-500 max-w-[240px]">
                    Verified tradespeople in your area are reviewing this job.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Actions (Tradesperson view) */}
        {!isHomeowner && profile?.role === "tradesperson" && (!hasQuoted || needsRequote) && (
          (job.quoteCount || 0) >= 5 && !hasQuoted ? (
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900">Quote Limit Reached</h3>
                <p className="text-sm text-slate-500">
                  This job has already received the maximum number of quotes (5). If a quote is withdrawn or rejected, you may be able to submit one later.
                </p>
              </div>
            </div>
          ) : (
            <div id="quote-form-section" className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              {new URLSearchParams(window.location.search).get('quickQuote') === 'true' && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3 mb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Job Summary</span>
                    <button 
                      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                      className="text-[10px] font-bold text-blue-600 hover:underline"
                    >
                      View Full Details
                    </button>
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-900 leading-tight">{job.title}</h4>
                    <p className="text-xs text-slate-500 line-clamp-2">{job.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-100 text-[10px] font-bold text-slate-600">
                      <MapPin className="w-3 h-3" />
                      {job.location}
                    </div>
                    <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-100 text-[10px] font-bold text-slate-600">
                      <Sparkles className="w-3 h-3 text-orange-500" />
                      £{job.estimateMin}-£{job.estimateMax}
                    </div>
                  </div>
                </div>
              )}
              <h3 className="font-bold text-slate-900">{needsRequote ? "Update Your Quote" : "Submit a Quote"}</h3>
              {needsRequote && (
                <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl space-y-1">
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Homeowner Request</p>
                  <p className="text-xs text-amber-800 italic">"{myQuote.requoteMessage}"</p>
                </div>
              )}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Payment Preference</label>
                    <select 
                      className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-sm bg-white"
                      value={paymentPreference}
                      onChange={(e) => setPaymentPreference(e.target.value)}
                    >
                      <option value="fixed_price">Fixed Price</option>
                      <option value="hourly">Hourly Rate</option>
                      <option value="negotiable">Negotiable</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Quote Scope</label>
                    <select 
                      className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-sm bg-white"
                      value={quoteScope}
                      onChange={(e) => setQuoteScope(e.target.value)}
                    >
                      <option value="complete_package">Complete Package</option>
                      <option value="labour_only">Labour Only</option>
                      <option value="materials_only">Materials Only</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-500 uppercase">Willing Start Date</label>
                    <button 
                      onClick={() => setIsImmediateStart(!isImmediateStart)}
                      className={cn(
                        "text-[10px] font-bold px-2 py-1 rounded-lg border transition-all flex items-center gap-1",
                        isImmediateStart ? "bg-green-50 text-green-600 border-green-200" : "bg-slate-50 text-slate-500 border-slate-200"
                      )}
                    >
                      <Zap className={cn("w-3 h-3", isImmediateStart && "fill-current")} />
                      Immediately
                    </button>
                  </div>
                  {!isImmediateStart && (
                    <div className="relative animate-in fade-in slide-in-from-top-1">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="date" 
                        className="w-full p-3 pl-9 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-sm"
                        value={quoteStartDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setQuoteStartDate(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Estimated Timeline</label>
                <div className="grid grid-cols-3 gap-2">
                  {["Half day", "1 day", "2 days", "3-5 days", "1-2 weeks", "2-4 weeks"].map((time) => (
                    <button
                      key={time}
                      onClick={() => setEstimatedTimeline(time)}
                      className={cn(
                        "py-2 text-[10px] font-bold rounded-xl border transition-all",
                        estimatedTimeline === time 
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm" 
                          : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                      )}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Amount (£)</label>
                <div className="relative">
                  <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="number" 
                    className="w-full p-3 pl-9 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    value={quoteAmount}
                    onChange={(e) => setQuoteAmount(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500 uppercase">Message</label>
                  <div className="flex items-center gap-3">
                    {quoteScope === "labour_only" && (
                      <button 
                        onClick={handleGenerateQuoteMaterials}
                        disabled={isGeneratingMaterials}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 disabled:opacity-50"
                      >
                        {isGeneratingMaterials ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        Add Material List
                      </button>
                    )}
                    <button 
                      onClick={handleDraftWithAI}
                      disabled={isDraftingAI}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
                    >
                      {isDraftingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                      Draft with AI
                    </button>
                  </div>
                </div>
                <textarea 
                  rows={3}
                  className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 resize-none text-sm"
                  placeholder="Tell the homeowner why you're the best fit..."
                  value={quoteMessage}
                  onChange={(e) => setQuoteMessage(e.target.value)}
                />
              </div>

              {/* Tips for winning quotes */}
              <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <h4 className="text-[10px] font-black text-amber-900 uppercase tracking-widest">Tips for winning quotes</h4>
                </div>
                <ul className="space-y-2">
                  {[
                    "Be specific about what is included",
                    "Mention your experience with similar jobs",
                    "Include any warranties or guarantees",
                    "Clarify if there are any potential extras"
                  ].map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-amber-800 font-medium">
                      <div className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>

              <button 
                onClick={handleQuote}
                disabled={!quoteAmount || isSubmittingQuote}
                className="w-full bg-[#1e3a5f] text-white p-4 rounded-2xl font-bold hover:bg-blue-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmittingQuote ? <Loader2 className="w-5 h-5 animate-spin" /> : (needsRequote ? "Update Quote" : "Submit Quote")}
              </button>
            </div>
          </div>
          )
        )}

        {/* Completion / Review Actions */}
        {isHomeowner && (job.status === "accepted" || job.status === "in_progress") && (
          <div className="space-y-3">
            <button 
              onClick={handleCompleteJob}
              className="w-full bg-green-600 text-white p-5 rounded-2xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-100 active:scale-95"
            >
              Mark as Completed
            </button>
            <button 
              onClick={() => setShowDisputeModal(true)}
              className="w-full bg-white border border-red-200 text-red-600 p-4 rounded-2xl font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-5 h-5" />
              Raise a Dispute
            </button>
          </div>
        )}

        {!isHomeowner && job.status === "accepted" && quotes.find(q => q.status === "accepted")?.tradespersonId === user?.uid && (
          <button 
            onClick={handleStartJob}
            className="w-full bg-[#1e3a5f] text-white p-5 rounded-2xl font-bold hover:bg-blue-900 transition-all shadow-lg shadow-blue-100 active:scale-95"
          >
            Start Work
          </button>
        )}

        {!isHomeowner && job.status === "in_progress" && myQuote?.status === "accepted" && (
          <div className="space-y-3">
            <button 
              onClick={() => setShowDisputeModal(true)}
              className="w-full bg-white border border-red-200 text-red-600 p-4 rounded-2xl font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-5 h-5" />
              Raise a Dispute
            </button>
            
            {!isEditingRevision ? (
              <button 
                onClick={() => {
                  setRevisionAmount(myQuote.amount.toString());
                  setRevisionMessage("");
                  setRevisionScope(myQuote.quoteScope || "complete_package");
                  setRevisionPaymentPreference(myQuote.paymentPreference || "fixed_price");
                  setIsEditingRevision(true);
                }}
                disabled={(myQuote.revisionCount || 0) >= 4}
                className="w-full bg-white border-2 border-dashed border-slate-200 text-slate-600 p-5 rounded-2xl font-bold hover:border-blue-600 hover:text-blue-600 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-slate-200 disabled:hover:text-slate-600"
              >
                <Edit2 className="w-5 h-5" />
                {(myQuote.revisionCount || 0) >= 4 ? "Max Revisions Reached" : "Request Quote/Scope Change"}
              </button>
            ) : (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">Request Quote Change</h3>
                  <button onClick={() => setIsEditingRevision(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">New Amount (£)</label>
                    <div className="relative">
                      <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="number" 
                        className="w-full p-3 pl-9 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                        value={revisionAmount}
                        onChange={(e) => setRevisionAmount(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Scope</label>
                      <select 
                        className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-sm"
                        value={revisionScope}
                        onChange={(e) => setRevisionScope(e.target.value as any)}
                      >
                        <option value="complete_package">Full Package</option>
                        <option value="labour_only">Labour Only</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Payment</label>
                      <select 
                        className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-sm"
                        value={revisionPaymentPreference}
                        onChange={(e) => setRevisionPaymentPreference(e.target.value as any)}
                      >
                        <option value="fixed_price">Fixed Price</option>
                        <option value="hourly">Hourly</option>
                        <option value="negotiable">Negotiable</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Reason for Change</label>
                    <textarea 
                      rows={3}
                      className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 resize-none text-sm"
                      placeholder="Explain why the price or scope needs to change..."
                      value={revisionMessage}
                      onChange={(e) => setRevisionMessage(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={handleRequestRevision}
                    disabled={!revisionAmount || !revisionMessage || isProcessing}
                    className="w-full bg-blue-600 text-white p-4 rounded-2xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send Request to Homeowner"}
                  </button>
                </div>
                {job.status === "accepted" && !isHomeowner && (
                  <button 
                    onClick={() => setShowRescheduleModal(true)}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-md transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Reschedule
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {isHomeowner && job.status === "completed" && !job.hasReview && (
          <div className="space-y-4">
            {!showReviewForm ? (
              <button 
                onClick={() => setShowReviewForm(true)}
                className="w-full bg-amber-500 text-white p-5 rounded-2xl font-bold hover:bg-amber-600 transition-all shadow-lg shadow-amber-100 flex items-center justify-center gap-2 active:scale-95"
              >
                <Star className="w-5 h-5 fill-current" />
                Leave a Review for Tradesperson
              </button>
            ) : (
              <ReviewForm
                jobId={id!}
                reviewerId={user!.uid}
                revieweeId={quotes.find(q => q.status === "accepted")?.tradespersonId}
                type="homeowner_review"
                onSuccess={() => {
                  setShowReviewForm(false);
                  setJob((prev: any) => ({ ...prev, hasReview: true }));
                }}
                onCancel={() => setShowReviewForm(false)}
              />
            )}
          </div>
        )}

        {!isHomeowner && job.status === "completed" && myQuote?.status === "accepted" && (
          <div className="space-y-4">
            <button 
              onClick={handleDownloadInvoice}
              className="w-full bg-white border-2 border-slate-200 text-slate-700 p-5 rounded-2xl font-bold hover:border-blue-600 hover:text-blue-600 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <FileText className="w-5 h-5" />
              Download Invoice PDF
            </button>

            <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-lg shadow-indigo-100 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Sparkles className="w-24 h-24" />
              </div>
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">AI Marketing Assistant</h3>
                    <p className="text-indigo-100 text-xs">Showcase your work on social media</p>
                  </div>
                </div>

                {marketingPost ? (
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 space-y-3">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{marketingPost}</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(marketingPost);
                          // Could add a toast here
                        }}
                        className="flex-1 bg-white text-indigo-600 py-2 rounded-xl text-xs font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Copy Text
                      </button>
                      <button 
                        onClick={() => setMarketingPost("")}
                        className="px-4 bg-indigo-500 text-white py-2 rounded-xl text-xs font-bold hover:bg-indigo-400 transition-colors"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={handleGenerateMarketingPost}
                    disabled={isGeneratingMarketing}
                    className="w-full bg-white text-indigo-600 py-4 rounded-2xl font-bold hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    {isGeneratingMarketing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                    Generate Social Media Post
                  </button>
                )}
              </div>
            </div>
            
            {!job.hasTradespersonReview && (
              !showTradespersonReviewForm ? (
                <button 
                  onClick={() => setShowTradespersonReviewForm(true)}
                  className="w-full bg-blue-600 text-white p-5 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 active:scale-95"
                >
                  <Star className="w-5 h-5 fill-current" />
                  Review Homeowner
                </button>
              ) : (
                <ReviewForm
                  jobId={id!}
                  reviewerId={user!.uid}
                  revieweeId={job.homeownerId}
                  type="tradesperson_review"
                  onSuccess={() => {
                    setShowTradespersonReviewForm(false);
                    setJob((prev: any) => ({ ...prev, hasTradespersonReview: true }));
                  }}
                  onCancel={() => setShowTradespersonReviewForm(false)}
                />
              )
            )}
          </div>
        )}
      </div>

      {/* Dispute Modal */}
      <AnimatePresence>
        {showDisputeModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDisputeModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="relative w-full max-w-md bg-white rounded-t-[32px] sm:rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Raise Dispute</h3>
                      <p className="text-xs text-slate-500">Professional mediation will be required</p>
                    </div>
                  </div>
                  <button onClick={() => setShowDisputeModal(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reason for Disagreement</label>
                    <textarea 
                      rows={4}
                      className="w-full p-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600 resize-none text-sm leading-relaxed"
                      placeholder="Please explain the situation clearly. This will be reviewed by our team..."
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Evidence Photos</label>
                    <div className="grid grid-cols-4 gap-2">
                      {disputePhotos.map((file, i) => (
                        <div key={i} className="aspect-square rounded-xl bg-slate-100 relative overflow-hidden group">
                          <img 
                            src={URL.createObjectURL(file)} 
                            className="w-full h-full object-cover" 
                            alt="Evidence"
                          />
                          <button 
                            onClick={() => setDisputePhotos(prev => prev.filter((_, idx) => idx !== i))}
                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {disputePhotos.length < 4 && (
                        <label className="aspect-square rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-red-600 hover:bg-red-50 transition-all group">
                          <Camera className="w-6 h-6 text-slate-300 group-hover:text-red-600" />
                          <span className="text-[8px] font-bold text-slate-400 group-hover:text-red-600 uppercase">Add Photo</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            multiple 
                            className="hidden" 
                            onChange={(e) => {
                              if (e.target.files) {
                                setDisputePhotos(prev => [...prev, ...Array.from(e.target.files!)].slice(0, 4));
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <button 
                    onClick={handleRaiseDispute}
                    disabled={!disputeReason || isProcessing}
                    className="w-full bg-red-600 text-white p-4 rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isUploadingDispute ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Uploading Evidence...
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5" />
                        Submit Dispute for Review
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-center text-slate-400 px-4">
                    By submitting, you agree that our team may contact you for further information.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Recurring Schedule Modal */}
      <AnimatePresence>
        {showRecurringModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRecurringModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="relative w-full max-w-md bg-white rounded-t-[32px] sm:rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                      <RefreshCw className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Set up Schedule</h3>
                      <p className="text-xs text-slate-500">Propose a recurring service</p>
                    </div>
                  </div>
                  <button onClick={() => setShowRecurringModal(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Frequency</label>
                    <select 
                      className="w-full p-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-sm bg-white"
                      value={recurringFrequency}
                      onChange={(e) => setRecurringFrequency(e.target.value)}
                    >
                      <option value="weekly">Weekly</option>
                      <option value="fortnightly">Fortnightly (Every 2 weeks)</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-xs text-slate-600">
                      This will send a proposal to the {isHomeowner ? "tradesperson" : "homeowner"}. If they accept, this job will automatically be scheduled {recurringFrequency}.
                    </p>
                  </div>
                </div>

                <button 
                  onClick={handleProposeRecurring}
                  disabled={isProposingRecurring}
                  className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProposingRecurring ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Send Proposal"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reschedule Modal */}
      <AnimatePresence>
        {showRescheduleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-6 h-6 text-indigo-600" />
                  Propose Reschedule
                </h3>
                <button onClick={() => setShowRescheduleModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">New Proposed Date</label>
                  <input 
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Reason for Change</label>
                  <textarea 
                    value={rescheduleReason}
                    onChange={(e) => setRescheduleReason(e.target.value)}
                    placeholder="e.g., Previous job overran, or material delivery delay..."
                    rows={3}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm text-slate-700 resize-none"
                  />
                </div>

                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <p className="text-[10px] text-indigo-700 leading-relaxed">
                    <strong>Note:</strong> The homeowner must accept this proposal before the job is officially rescheduled. Your calendar will be updated automatically upon acceptance.
                  </p>
                </div>

                <button 
                  onClick={handleProposeReschedule}
                  disabled={isRescheduling || !rescheduleDate || !rescheduleReason}
                  className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-900/10 disabled:opacity-50"
                >
                  {isRescheduling ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  Send Proposal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Withdraw Quote Modal */}
      <AnimatePresence>
        {withdrawingQuote && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl max-w-md w-full overflow-hidden border border-slate-100"
            >
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 shrink-0">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Withdraw Quote</h3>
                    <p className="text-sm text-slate-500">Are you sure you want to withdraw this quote?</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-bold text-slate-700">
                    Reason for withdrawal <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={withdrawReason}
                    onChange={(e) => setWithdrawReason(e.target.value)}
                    placeholder="e.g., No longer available, fully booked..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-sm resize-none h-24"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setWithdrawingQuote(null);
                      setWithdrawReason("");
                    }}
                    className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleWithdrawQuote}
                    disabled={isProcessing || !withdrawReason.trim()}
                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Withdrawing...
                      </>
                    ) : (
                      "Withdraw Quote"
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

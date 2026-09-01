import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider, CustomProvider } from "firebase/app-check";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signInAnonymously, type User as FirebaseUser, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, RecaptchaVerifier, linkWithPhoneNumber, PhoneAuthProvider, initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence, signInWithCredential, browserPopupRedirectResolver } from "firebase/auth";
import { enableMultiTabIndexedDbPersistence, initializeFirestore, getFirestore, collection, collectionGroup, doc, getDoc, getDocs, setDoc as originalSetDoc, updateDoc as originalUpdateDoc, deleteDoc as originalDeleteDoc, onSnapshot as originalOnSnapshot, query, where, or, and, orderBy, limit, getDocFromServer, serverTimestamp, addDoc as originalAddDoc, runTransaction as originalRunTransaction, writeBatch as originalWriteBatch, deleteField, arrayUnion, arrayRemove, increment } from "firebase/firestore";
import { getPerformance, trace } from "firebase/performance";
import { getStorage, ref, uploadBytes, getDownloadURL, uploadBytesResumable, uploadString } from "firebase/storage";
import { Capacitor } from "@capacitor/core";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase SDK
export const app = initializeApp(firebaseConfig);

// Initialize Firebase App Check symmetrically across Iframes, Web browsers, and Capacitor Native containers
(async () => {
  try {
    if (typeof window !== "undefined") {
      const isInsideIframe = window.self !== window.top;

      if (isInsideIframe) {
        console.log("Firebase App Check bypassed: Running inside the AI Studio preview iframe. This prevents reCAPTCHA v3 from timing out due to top-level domain mismatch (ai.studio vs your registered domain). To use App Check, test the app in a new tab.");
        return;
      }

      if (Capacitor.isNativePlatform()) {
        try {
          console.log("Capacitor native platform detected. Initializing App Check with Native App Attest / Play Integrity...");
          const packageName = "@capacitor-firebase/app-check";
          const { FirebaseAppCheck } = await import(/* @vite-ignore */ packageName) as any;
          
          // First, run native initialization of App Check
          await FirebaseAppCheck.initialize();

          // Create standard Web CustomProvider to pull tokens from native SDK
          const provider = new CustomProvider({
            getToken: async () => {
              const { token } = await FirebaseAppCheck.getToken();
              return {
                token,
                expireTimeMillis: Date.now() + 30 * 60 * 1000 // default 30 mins
              };
            }
          });

          initializeAppCheck(app, {
            provider,
            isTokenAutoRefreshEnabled: true
          });
          console.log("Firebase App Check successfully initialized for Capacitor Native Client.");
        } catch (nativeErr) {
          console.error("Failed to initialize App Check on Capacitor Native Platform. Make sure '@capacitor-firebase/app-check' is compiled into the build package:", nativeErr);
        }
      } else {
        // Standard Web browser
        const siteKey = (import.meta as any).env?.VITE_RECAPTCHA_SITE_KEY;
        if (siteKey && siteKey !== "your_recaptcha_v3_site_key" && siteKey !== "YOUR_RECAPTCHA_V3_SITE_KEY") {
          initializeAppCheck(app, {
            provider: new ReCaptchaV3Provider(siteKey),
            isTokenAutoRefreshEnabled: true
          });
          console.log("Firebase App Check initialized successfully with reCAPTCHA v3 site key.");
        } else {
          console.log("Firebase App Check skipped: No valid VITE_RECAPTCHA_SITE_KEY detected. Disabling App Check for development/preview to prevent connection blocking.");
        }
      }
    }
  } catch (e) {
    console.warn("Failed to initialize Firebase App Check:", e);
  }
})();

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false
} as any, firebaseConfig.firestoreDatabaseId);

export let performance: any = null;

if (typeof window !== "undefined") {
  enableMultiTabIndexedDbPersistence(db)
    .then(() => {
      console.log("Firestore Multi-Tab Offline Persistence enabled successfully.");
    })
    .catch((err) => {
      if (err.code === "failed-precondition") {
        console.warn("Firestore offline persistence failed precondition (multiple tabs open). Client falling back to multiple active database sync states in memory.");
      } else if (err.code === "unimplemented") {
        console.warn("The current browser container environment does not support multi-tab disk cache storage.");
      } else {
        console.warn("Failed to activate Firestore multi-tab disk cache persistence:", err);
      }
    });

  // Passive Firebase Performance Monitoring initialized dynamically
  try {
    performance = getPerformance(app);
    console.log("Firebase Performance Monitoring initialized dynamically.");

    // Preemptively monkey-patch PerformanceTrace prototype to neutralize invalid attribute value crashes
    // which can be triggered by automated browser analytics/tracking scripts inside preview frames.
    try {
      const dummyTrace = trace(performance, "safeguard_init");
      const traceProto = Object.getPrototypeOf(dummyTrace);
      if (traceProto && typeof traceProto.putAttribute === "function") {
        const originalPutAttribute = traceProto.putAttribute;
        traceProto.putAttribute = function(this: any, attribute: string, value: string) {
          try {
            let safeAttr = attribute;
            let safeValue = value;
            
            if (typeof attribute === "string") {
              // Firebase Performance attributes constraints:
              // - Start with a letter (a-z, A-Z)
              // - Max 40 characters
              // - Restricted to alphanumeric, underscores, hyphens, periods
              safeAttr = attribute.substring(0, 40).replace(/[^a-zA-Z0-9_\-\.]/g, "_");
              if (safeAttr && !/^[a-zA-Z]/.test(safeAttr)) {
                safeAttr = "a_" + safeAttr.substring(1);
              }
            }
            
            if (typeof value === "string") {
              // Firebase Performance values constraints:
              // - Max 100 characters
              // - Avoid raw special characters that violate standard event-tracking limits
              safeValue = value.substring(0, 99).replace(/[^a-zA-Z0-9_\-\.\s]/g, "_");
            }
            
            return originalPutAttribute.call(this, safeAttr || attribute, safeValue || value);
          } catch (attrErr) {
            console.warn(`[Firebase Performance Safeguard] Suppressed invalid custom attribute: name="${attribute}" value="${value}"`, attrErr);
          }
        };
        console.log("Successfully patched Firebase PerformanceTrace.prototype.putAttribute.");
      }
    } catch (patchErr) {
      console.warn("Could not patch Firebase PerformanceTrace prototype:", patchErr);
    }
  } catch (err) {
    console.warn("Firebase Performance Monitoring is not supported in this frame or dev sandbox:", err);
  }
}

// Set up resilient Firebase Auth initialization with safe fallbacks
let authInstance: any;

try {
  // First, check if there's an existing instance already initialized for this app (preventing re-initialization crashes during hot-reloads)
  authInstance = getAuth(app);
  console.log("Retrieved already-initialized Firebase Auth instance.");
} catch (e) {
  console.log("No existing Firebase Auth instance found. Performing safe initialization...");
  
  // Build a verified list of persistence engines based on current window access capabilities
  const allowedPersistence: any[] = [];
  
  if (typeof window !== "undefined") {
    // 1. Check indexedDB
    try {
      if (window.indexedDB) {
        allowedPersistence.push(indexedDBLocalPersistence);
      }
    } catch (_) {}

    // 2. Check localStorage
    try {
      if (window.localStorage) {
        allowedPersistence.push(browserLocalPersistence);
      }
    } catch (_) {}

    // 3. Check sessionStorage
    try {
      if (window.sessionStorage) {
        allowedPersistence.push(browserSessionPersistence);
      }
    } catch (_) {}
  }
  
  // Memory persistence is always globally safe
  allowedPersistence.push(inMemoryPersistence);

  try {
    authInstance = initializeAuth(app, {
      persistence: allowedPersistence,
      popupRedirectResolver: browserPopupRedirectResolver
    });
    console.log("Firebase Auth initialized successfully with verified persistence list:", allowedPersistence.map(p => p.type));
  } catch (initErr: any) {
    console.warn("initializeAuth crashed, falling back to standard getAuth:", initErr);
    try {
      authInstance = getAuth(app);
    } catch (fallbackErr) {
      console.error("Critical: Could not initialize or retrieve Firebase Auth instance:", fallbackErr);
    }
  }
}

export const auth = authInstance;
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Auth Helpers
export const signInWithGoogle = async (options?: { forceWebView?: boolean }) => {
  const forceWebView = options?.forceWebView === true;

  if (Capacitor.isNativePlatform() && !forceWebView) {
    try {
      console.log("[signInWithGoogle] Capacitor native container detected. Loading @capacitor-firebase/authentication plugin...");
      const authPluginPkg = "@capacitor-firebase/authentication";
      const { FirebaseAuthentication } = (await import(/* @vite-ignore */ authPluginPkg)) as any;
      console.log("[signInWithGoogle] Triggering native Google Flow on device...");
      const result = await FirebaseAuthentication.signInWithGoogle({});
      console.log("[signInWithGoogle] Native authentication completed. Checking credentials...");
      
      const idToken = result.credential?.idToken;
      if (!idToken) {
        console.error("[signInWithGoogle] No idToken returned in credential. Native result structure was:", JSON.stringify(result));
        throw new Error("Google Sign-In completed, but no ID Token was returned. Web Client ID may need configuration.");
      }
      
      const credential = GoogleAuthProvider.credential(idToken);
      console.log("[signInWithGoogle] Handshaking native credentials with Firebase SDK...");
      const userCredential = await signInWithCredential(auth, credential);
      console.log("[signInWithGoogle] Success! Authenticated user ID:", userCredential.user?.uid);
      return userCredential;
    } catch (err: any) {
      console.warn("[signInWithGoogle] Native Google Sign-In status:", err);
      
      const rawErrorStr = err.message || JSON.stringify(err) || "Unknown Error";
      const isUserCanceled = rawErrorStr.toLowerCase().includes("canceled") || 
                             rawErrorStr.toLowerCase().includes("cancel") || 
                             rawErrorStr.includes("12501");

      if (isUserCanceled) {
        throw new Error("Sign-in was canceled by the user.");
      }

      console.warn("[signInWithGoogle] Native flow encountered an issue. Executing force-web-view fallback for frictionless login...");
      return await executeWebViewGoogleSignIn();
    }
  } else {
    return await executeWebViewGoogleSignIn();
  }
};

const executeWebViewGoogleSignIn = async () => {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (popupErr: any) {
    if (
      popupErr?.code === 'auth/popup-blocked' || 
      popupErr?.code === 'auth/cancelled-popup-request' ||
      popupErr?.message?.includes('popup-blocked')
    ) {
      console.warn("[signInWithGoogle] Popup blocked. Falling back to signInWithRedirect...");
      await signInWithRedirect(auth, googleProvider);
      return;
    }
    throw popupErr;
  }
};
export const handleRedirectResult = () => getRedirectResult(auth);
export const signInAsGuest = () => signInAnonymously(auth);
export const logout = async () => {
  try {
    sessionStorage.removeItem("is_test_admin");
  } catch (_) {}
  return await auth.signOut();
};
export const signUpWithEmail = (email: string, pass: string) => createUserWithEmailAndPassword(auth, email, pass);
export const signInWithEmail = (email: string, pass: string) => signInWithEmailAndPassword(auth, email, pass);
export const sendVerificationEmail = (user: FirebaseUser) => sendEmailVerification(user);
export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);

// Firestore Error Handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map((provider: any) => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}



export const sendNotification = async (userId: string, title: string, message: string, type: "quote" | "message" | "status" | "system", link?: string) => {
  try {
    const notificationRef = doc(collection(db, "notifications"));
    await setDoc(notificationRef, {
      id: notificationRef.id,
      userId,
      title,
      message,
      type,
      link,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Error sending notification:", err);
  }
};

export const submitReview = async (
  jobId: string, 
  reviewerId: string, 
  revieweeId: string, 
  rating: number, 
  comment: string, 
  recommended: boolean = true,
  type: "tradesperson_review" | "homeowner_review" = "tradesperson_review"
) => {
  try {
    const isLowRating = rating <= 2 && type === "tradesperson_review";
    
    await runTransaction(db, async (transaction: any) => {
      // 1. ALL READS FIRST
      const userRef = doc(db, "users", revieweeId);
      let userSnap = null;
      if (!isLowRating) {
        userSnap = await transaction.get(userRef);
      }

      // 2. ALL WRITES AFTER READS
      const reviewRef = doc(collection(db, "reviews"));
      const status = isLowRating ? "cooling_off" : "published";
      const publishAt = isLowRating ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : new Date();

      transaction.set(reviewRef, {
        id: reviewRef.id,
        jobId,
        reviewerId,
        revieweeId,
        type,
        rating,
        comment,
        recommended: type === "tradesperson_review" ? recommended : false,
        status,
        publishAt,
        createdAt: serverTimestamp()
      });

      // Update the reviewee's profile (only if not in cooling off)
      if (!isLowRating && userSnap && userSnap.exists()) {
        const userData = userSnap.data();
        
        if (type === "tradesperson_review") {
          const currentRating = userData.rating || 0;
          const currentTotalReviews = userData.totalReviews || 0;
          const currentTotalRecommendations = userData.totalRecommendations || 0;
          
          const newTotalReviews = currentTotalReviews + 1;
          const newRating = ((currentRating * currentTotalReviews) + rating) / newTotalReviews;
          const newTotalRecommendations = recommended ? currentTotalRecommendations + 1 : currentTotalRecommendations;
          
          transaction.update(userRef, {
            rating: newRating,
            totalReviews: newTotalReviews,
            totalRecommendations: newTotalRecommendations
          });
        } else {
          // Homeowner review
          const currentRating = userData.homeownerRating || 0;
          const currentTotalReviews = userData.totalHomeownerReviews || 0;
          
          const newTotalReviews = currentTotalReviews + 1;
          const newRating = ((currentRating * currentTotalReviews) + rating) / newTotalReviews;
          
          transaction.update(userRef, {
            homeownerRating: newRating,
            totalHomeownerReviews: newTotalReviews
          });
        }
      }

      // 3. Update the job document
      const jobRef = doc(db, "jobs", jobId);
      if (type === "tradesperson_review") {
        transaction.update(jobRef, {
          status: "completed",
          hasReview: true
        });
      } else {
        transaction.update(jobRef, {
          hasTradespersonReview: true
        });
      }
    });
    
    // Send notification to reviewee
    if (isLowRating) {
      // FUZZING: Delay the notification by 3-7 days so it's not linked to the last job
      const delayDays = 3 + Math.floor(Math.random() * 5); // 3 to 7 days
      const visibleAt = new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000);
      
      const notifRef = doc(collection(db, "notifications"));
      await setDoc(notifRef, {
        userId: revieweeId,
        title: "Trust & Fairness Update",
        message: "The Trust & Fairness engine is conducting a standard quality review of a recent interaction. This process ensures platform balance and takes 14 days.",
        type: "system",
        read: false,
        visibleAt: visibleAt, // UI will filter by this
        createdAt: serverTimestamp(),
        link: `/jobs/${jobId}`
      });
    } else {
      await sendNotification(
        revieweeId,
        "New Review Received!",
        `You received a ${rating}-star review.`,
        "status",
        type === "tradesperson_review" ? `/profile/${revieweeId}` : "/profile"
      );
    }
    
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "reviews");
  }
};

export const onSnapshot = (...args: any[]) => {
  const customErrorCb = (err: any) => {
    let _path = "Unknown";
    try {
      if (args[0]?.path) _path = args[0].path;
      else if (args[0]?._path?.segments) _path = args[0]._path.segments.join('/');
      else if (args[0]?.type === 'query') _path = 'query: ' + args[0]?._query?.path?.segments?.join('/');
    } catch(e){}
    
    // Ignore permission-denied errors that often occur during auth state transitions (like logout)
    if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
      console.warn(`Firestore permission denied on path [${_path}]. This is usually harmless during route transitions or logout.`, err.message);
      return;
    }
    
    console.error(`Global onSnapshot Uncaught ERROR intercept for path [${_path}]:`, err);
  };
  
  if (args.length === 2 && typeof args[1] === 'function') {
    return originalOnSnapshot(args[0], args[1], customErrorCb);
  } else if (args.length === 3 && typeof args[1] === 'function' && typeof args[2] === 'function') {
    return originalOnSnapshot(args[0], args[1], args[2]);
  } else if (args.length === 3 && typeof args[1] === 'object' && typeof args[2] === 'function') {
      return originalOnSnapshot(args[0], args[1], args[2], customErrorCb);
  } else {
    return (originalOnSnapshot as any)(...args);
  }
};

import { startTrackedWrite, endTrackedWrite } from "./lib/syncTracker";

export const setDoc = async (reference: any, data: any, options?: any) => {
  const trackId = startTrackedWrite("setDoc");
  try {
    return await originalSetDoc(reference, data, options);
  } finally {
    endTrackedWrite(trackId);
  }
};

export const updateDoc = async (reference: any, ...args: any[]) => {
  const trackId = startTrackedWrite("updateDoc");
  try {
    return await (originalUpdateDoc as any)(reference, ...args);
  } finally {
    endTrackedWrite(trackId);
  }
};

export const deleteDoc = async (reference: any) => {
  const trackId = startTrackedWrite("deleteDoc");
  try {
    return await originalDeleteDoc(reference);
  } finally {
    endTrackedWrite(trackId);
  }
};

export const addDoc = async (reference: any, data: any) => {
  const trackId = startTrackedWrite("addDoc");
  try {
    return await originalAddDoc(reference, data);
  } finally {
    endTrackedWrite(trackId);
  }
};

export const runTransaction = async (firestore: any, updateFunction: any, ...args: any[]) => {
  const trackId = startTrackedWrite("runTransaction");
  try {
    return await originalRunTransaction(firestore, updateFunction, ...args);
  } finally {
    endTrackedWrite(trackId);
  }
};

export const writeBatch = (firestore: any) => {
  const batch = originalWriteBatch(firestore);
  const originalCommit = batch.commit.bind(batch);
  batch.commit = async () => {
    const trackId = startTrackedWrite("writeBatch");
    try {
      return await originalCommit();
    } finally {
      endTrackedWrite(trackId);
    }
  };
  return batch;
};

export const uploadStorageFile = async (
  fileOrBlob: File | Blob,
  storagePath: string,
  options?: { contentType?: string; maxImageWidth?: number }
): Promise<string> => {
  const fileType = options?.contentType || fileOrBlob.type || "image/jpeg";
  
  // 1. Try Firebase Storage upload first with a safe timeout
  try {
    const storageRef = ref(storage, storagePath);
    const arrayBuffer = await fileOrBlob.arrayBuffer();
    
    const uploadPromise = uploadBytes(storageRef, arrayBuffer, { contentType: fileType }).then(
      async (snapshot) => await getDownloadURL(snapshot.ref)
    );
    
    // Timeout after 7 seconds if storage retries or hangs
    const timeoutPromise = new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error("Firebase Storage upload timed out")), 7000);
    });

    return await Promise.race([uploadPromise, timeoutPromise]);
  } catch (err: any) {
    console.warn(`[Storage Upload Fallback] Firebase Storage upload failed (${err?.message || err}). Converting to local Data URL fallback...`);

    // 2. Resilient Fallback: Convert to base64 Data URL (compressing image if > 200KB)
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (!result) {
          resolve("https://placehold.co/400x300?text=Uploaded+File");
          return;
        }

        if (fileType.startsWith("image/") && result.length > 200000) {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const maxDim = options?.maxImageWidth || 1024;
            let width = img.width;
            let height = img.height;

            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.7);
              resolve(compressedDataUrl);
              return;
            }
            resolve(result);
          };
          img.onerror = () => resolve(result);
          img.src = result;
        } else {
          resolve(result);
        }
      };
      reader.onerror = () => resolve("https://placehold.co/400x300?text=Uploaded+File");
      reader.readAsDataURL(fileOrBlob);
    });
  }
};

export { 
  collection, collectionGroup, doc, getDoc, getDocs, query, where, or, and, orderBy, limit, onAuthStateChanged, type FirebaseUser, serverTimestamp, deleteField, arrayUnion, arrayRemove, increment,
  ref, uploadBytes, getDownloadURL, uploadBytesResumable, uploadString, signInWithEmailAndPassword
};

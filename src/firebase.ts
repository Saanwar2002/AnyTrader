import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signInAnonymously, type User as FirebaseUser, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, RecaptchaVerifier, linkWithPhoneNumber, PhoneAuthProvider } from "firebase/auth";
import { getFirestore, collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, or, and, orderBy, limit, getDocFromServer, serverTimestamp, addDoc, runTransaction, deleteField, arrayUnion, arrayRemove, increment } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, uploadBytesResumable, uploadString } from "firebase/storage";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Auth Helpers
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const handleRedirectResult = () => getRedirectResult(auth);
export const signInAsGuest = () => signInAnonymously(auth);
export const logout = () => auth.signOut();
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
      providerInfo: auth.currentUser?.providerData.map(provider => ({
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
    
    await runTransaction(db, async (transaction) => {
      // 1. Create the review document
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

      // 2. Update the reviewee's profile (only if not in cooling off)
      if (!isLowRating) {
        const userRef = doc(db, "users", revieweeId);
        const userSnap = await transaction.get(userRef);
        
        if (userSnap.exists()) {
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

export { 
  collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, or, and, orderBy, limit, onAuthStateChanged, type FirebaseUser, serverTimestamp, addDoc, runTransaction, deleteField, arrayUnion, arrayRemove, increment,
  ref, uploadBytes, getDownloadURL, uploadBytesResumable, uploadString
};

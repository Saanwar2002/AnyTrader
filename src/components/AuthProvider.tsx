import React, { createContext, useContext, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { auth, db, onAuthStateChanged, type FirebaseUser, doc, onSnapshot, handleFirestoreError, OperationType, logout, updateDoc, addDoc, collection, serverTimestamp } from "@/src/firebase";
import { Loader2, ShieldAlert, LogOut } from "lucide-react";

interface AuthContextType {
  user: FirebaseUser | null;
  profile: any | null;
  setProfile: React.Dispatch<React.SetStateAction<any | null>>;
  loading: boolean;
  isAuthReady: boolean;
  isAnonymous: boolean;
  isTradeBotOpen: boolean;
  setIsTradeBotOpen: (isOpen: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  setProfile: () => {},
  loading: true,
  isAuthReady: false,
  isAnonymous: false,
  isTradeBotOpen: false,
  setIsTradeBotOpen: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isTradeBotOpen, setIsTradeBotOpen] = useState(false);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Security: Prevent unverified emails from accessing the platform
      // Temporarily disabled for development testing
      const isAdminEmail = firebaseUser?.email?.toLowerCase() === "saanwar2002@gmail.com";
      const isTestAdmin = sessionStorage.getItem("is_test_admin") === "true";
      
      // if (firebaseUser && !firebaseUser.emailVerified && !firebaseUser.isAnonymous && !isAdminEmail && !isTestAdmin) {
      //   console.warn("Unverified email attempted login:", firebaseUser.email);
      //   await logout();
      //   setUser(null);
      //   setProfile(null);
      //   setLoading(false);
      //   setIsAuthReady(true);
      //   return;
      // }

      setUser(firebaseUser);
      setIsAnonymous(firebaseUser?.isAnonymous || false);
      
      if (firebaseUser) {
        if (Capacitor.isNativePlatform()) {
          import(/* @vite-ignore */ '@capacitor-firebase/crashlytics').then(({ FirebaseCrashlytics }) => {
             FirebaseCrashlytics.setUserId({ userId: firebaseUser.uid });
          }).catch(e => console.error("Crashlytics plugin load error:", e));
        }
      }
      
      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = null;
      }

      if (firebaseUser) {
        // Listen for profile changes in real-time
        profileUnsubscribe = onSnapshot(doc(db, "users", firebaseUser.uid), async (docSnap) => {
          try {
            if (docSnap.exists()) {
              const data = docSnap.data();
              
              // Force admin role if email matches or test admin flag is set
              if ((isAdminEmail || isTestAdmin) && data.role !== "admin") {
                data.role = "admin";
                await updateDoc(doc(db, "users", firebaseUser.uid), { 
                  role: "admin",
                  subscriptionType: null
                });
              }
              
              // Check for expired or near-expiry documents
              const now = new Date();
              const thirtyDaysFromNow = new Date();
              thirtyDaysFromNow.setDate(now.getDate() + 30);
              
              let needsUpdate = false;
              let newVerificationStatus = data.verificationStatus;
              
              const updatedDocs = (data.verificationDocs || []).map((doc: any) => {
                if (doc.expiryDate) {
                  const expiry = new Date(doc.expiryDate);
                  
                  // If expired
                  if (expiry < now && doc.status !== "expired") {
                    needsUpdate = true;
                    newVerificationStatus = "unverified";
                    
                    // Send notification
                    addDoc(collection(db, "notifications"), {
                      userId: firebaseUser.uid,
                      title: "Verification Expired ⚠️",
                      message: `Your ${doc.type} has expired. Please upload a new document to restore your verified status.`,
                      type: "verification",
                      read: false,
                      createdAt: serverTimestamp()
                    });
                    
                    return { ...doc, status: "expired" };
                  }
                  
                  // If expiring soon (within 30 days) and no notification sent recently
                  if (expiry > now && expiry < thirtyDaysFromNow && !doc.expiryWarningSent) {
                    needsUpdate = true;
                    
                    addDoc(collection(db, "notifications"), {
                      userId: firebaseUser.uid,
                      title: "Verification Expiring Soon ⏳",
                      message: `Your ${doc.type} will expire on ${expiry.toLocaleDateString()}. Please prepare your renewal documents.`,
                      type: "verification",
                      read: false,
                      createdAt: serverTimestamp()
                    });
                    
                    return { ...doc, expiryWarningSent: true };
                  }
                }
                return doc;
              });

              if (needsUpdate) {
                await updateDoc(doc(db, "users", firebaseUser.uid), {
                  verificationDocs: updatedDocs,
                  verificationStatus: newVerificationStatus
                });
                return;
              }

              setProfile(data);
            } else {
              // If profile doesn't exist, check if it's the admin email or test admin
              if (isAdminEmail || isTestAdmin) {
                setProfile({ role: "admin", name: firebaseUser.displayName || "Admin", uid: firebaseUser.uid });
              } else {
                setProfile(null);
              }
            }
          } catch (err) {
            console.error("Error in profile snapshot handler:", err);
          } finally {
            setLoading(false);
            setIsAuthReady(true);
          }
        }, (error) => {
          // Identify permission-denied errors which often happen shortly after logout
          if (error.code === 'permission-denied') {
            console.log("Permission denied for profile listener, likely due to logout or missing rules.");
          } else {
            console.error("Error fetching profile:", error);
            try {
              handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
            } catch (e) {
              console.error("Failed to handle firestore error", e);
            }
          }
          setProfile(null);
          setLoading(false);
          setIsAuthReady(true);
        });
      } else {
        setProfile(null);
        setLoading(false);
        setIsAuthReady(true);
      }
    });

    return () => {
      authUnsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, setProfile, loading, isAuthReady, isAnonymous, isTradeBotOpen, setIsTradeBotOpen }}>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            <p className="text-slate-600 font-medium animate-pulse">Initializing AnyTrader...</p>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

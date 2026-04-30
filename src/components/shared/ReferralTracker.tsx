import { useEffect } from "react";
import { useSearchParams, useParams, Navigate } from "react-router-dom";

export function storeReferralCode(code: string) {
  const referralData = {
    code: code.toLowerCase(),
    timestamp: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 
  };
  localStorage.setItem("anytrader_referral", JSON.stringify(referralData));
  console.log(`Referral code [${code}] captured successfully.`);
}

export default function ReferralTracker() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const refCode = searchParams.get("ref");
    if (refCode) {
      storeReferralCode(refCode);
    }
  }, [searchParams]);

  return null;
}

export function RefRedirect() {
  const { code } = useParams();
  
  useEffect(() => {
    if (code) {
      storeReferralCode(code);
    }
  }, [code]);

  // Redirect to home page with the ref applied in the background
  return <Navigate to="/" replace />;
}

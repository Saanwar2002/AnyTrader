import { Zap, ShieldCheck, Star, CheckCircle2, Clock } from "lucide-react";

export const getInstantMatchCopy = (category: string) => {
  const highUrgency = ["Plumbing", "Heating", "Boiler", "Locksmith", "Electrician", "Gas", "Drainage", "Roofing", "Appliance", "Glazing", "Plumber", "Fix", "Fault"];
  const highValue = ["Building", "Kitchen", "Bathroom", "Extension", "Carpentry", "Renewable", "Builder", "Conversion", "Refit", "Loft"];

  const safeCategory = (category || "").toLowerCase();

  let price = 2.99;
  
  if (['building', 'extension', 'kitchen', 'bathroom', 'solar', 'renewable'].some(c => safeCategory.includes(c))) {
    price = 7.99;
  } else if (['roofing', 'hvac', 'damp'].some(c => safeCategory.includes(c))) {
    price = 4.99;
  } else if (['locksmith', 'plumbing', 'cleaning', 'handyman'].some(c => safeCategory.includes(c))) {
    price = 1.99; // some have super high conversion at lower price points
  }

  if (highUrgency.some(c => safeCategory.includes(c))) {
    return {
      price,
      title: "Immediate Rescue",
      desc: "Issues like this escalate quickly. Don't wait 24 hours for quotes—get a top-rated pro assigned instantly to resolve this now.",
      bullets: [
        { text: "Immediate pro assignment", icon: Zap, color: "text-amber-500" },
        { text: "Stop further damage or inconvenience", icon: ShieldCheck, color: "text-amber-500" },
        { text: "Vetted emergency responders", icon: Star, color: "text-amber-500" }
      ]
    };
  }
  if (highValue.some(c => safeCategory.includes(c))) {
    return {
      price,
      title: "Secure the Best Pro",
      desc: "For major projects, you need guaranteed quality. Bypass the typical quote-shopping and let our algorithm secure a top-tier, highly vetted expert immediately.",
      bullets: [
        { text: "Top 5% rated professionals", icon: Star, color: "text-amber-500" },
        { text: "Guaranteed quality for big projects", icon: ShieldCheck, color: "text-amber-500" },
        { text: "Skip the guesswork", icon: CheckCircle2, color: "text-amber-500" }
      ]
    };
  }
  
  return {
    price,
    title: "Save Time & Hassle",
    desc: "Busy schedule? Don't want to deal with comparing quotes or negotiating? Let us directly assign a trusted, reliable pro so you can get this checked off your to-do list.",
    bullets: [
      { text: "No waiting for quotes", icon: Clock, color: "text-amber-500" },
      { text: "Zero negotiation needed", icon: CheckCircle2, color: "text-amber-500" },
      { text: "Guaranteed reliable professional", icon: ShieldCheck, color: "text-amber-500" }
    ]
  };
};

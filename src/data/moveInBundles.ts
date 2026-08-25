export interface MoveInTask {
  id: string;
  title: string;
  category: string;
  subcategory: string;
  phase: "security_safety" | "hygiene_setup" | "exterior_waste" | "smart_home";
  phaseLabel: string;
  priority: "Safety Critical" | "High Priority" | "Essential" | "Recommended" | "Optional";
  priorityColor: string;
  priceRange: string;
  estimatedHours: string;
  urgency: "emergency" | "asap" | "flexible" | "specific_date";
  quoteScope: "supply_and_fit" | "labour_only" | "materials_only" | "complete_package";
  whyRecommended: string;
  prefilledTitle: string;
  prefilledDescription: string;
  iconName: string;
  tags: string[];
}

export const MOVE_IN_BUNDLES: MoveInTask[] = [
  // Phase 1: Security & Safety
  {
    id: "move_in_locks",
    title: "Locksmith & British Standard Cylinder Re-Keying",
    category: "Locksmith & Security",
    subcategory: "Lock Replacement & Re-Keying",
    phase: "security_safety",
    phaseLabel: "Security & Safety",
    priority: "High Priority",
    priorityColor: "bg-red-100 text-red-700 border-red-200",
    priceRange: "£80 – £150",
    estimatedHours: "1–2 hrs",
    urgency: "asap",
    quoteScope: "supply_and_fit",
    whyRecommended: "Crucial for home insurance compliance. Previous owners, tenants, cleaners, agents, or building contractors may retain spare keys.",
    prefilledTitle: "Move-In Locksmith: British Standard Anti-Snap Euro Cylinder Replacement",
    prefilledDescription: "New home move-in requirement: Replace external front and back door lock cylinders with British Standard TS007 3-star anti-snap euro cylinders for insurance compliance. Supply 3 keys per cylinder and verify smooth latching mechanism.",
    iconName: "Lock",
    tags: ["Insurance Requirement", "Day 1 Priority", "Key Security"]
  },
  {
    id: "move_in_boiler_check",
    title: "Gas Safe Boiler Healthcheck & Radiator Bleed",
    category: "Gas Safe & Heating",
    subcategory: "Boiler Service & Healthcheck",
    phase: "security_safety",
    phaseLabel: "Security & Safety",
    priority: "Essential",
    priorityColor: "bg-orange-100 text-orange-800 border-orange-200",
    priceRange: "£75 – £125",
    estimatedHours: "1–2 hrs",
    urgency: "asap",
    quoteScope: "labour_only",
    whyRecommended: "Ensures hot water & central heating operate safely and efficiently before your family moves in, preventing unexpected winter breakdowns.",
    prefilledTitle: "Move-In Heating Check: Gas Boiler Service & Radiator System Bleed",
    prefilledDescription: "Comprehensive move-in boiler inspection by a Gas Safe registered engineer. Check flue emissions, burner pressure, expansion vessel, test central heating thermostat, bleed all radiators, and provide a digital safety certificate for the Property Passport.",
    iconName: "Flame",
    tags: ["Gas Safe Certified", "Winter Proofing", "Energy Efficiency"]
  },
  {
    id: "move_in_electrical_safety",
    title: "Electrical Safety & Smoke / CO Alarm Verification",
    category: "Electrical",
    subcategory: "Consumer Unit & Alarm Testing",
    phase: "security_safety",
    phaseLabel: "Security & Safety",
    priority: "Safety Critical",
    priorityColor: "bg-red-100 text-red-800 border-red-300",
    priceRange: "£65 – £140",
    estimatedHours: "1–2 hrs",
    urgency: "flexible",
    quoteScope: "supply_and_fit",
    whyRecommended: "Tests consumer unit (fuse box) RCD trip switches and installs interconnected 10-year optical smoke and carbon monoxide alarms on every floor.",
    prefilledTitle: "Move-In Electrical Check: Fuse Box RCD Test & Interconnected Smoke/CO Alarms",
    prefilledDescription: "Check consumer unit trip switches / RCD functionality, verify earth bonding, test sockets, and install/test interconnected smoke detectors in hallways and carbon monoxide alarms near fuel-burning appliances.",
    iconName: "Zap",
    tags: ["UK Building Regs", "Fire Safety", "Life Safety"]
  },

  // Phase 2: Hygiene & Setup
  {
    id: "move_in_deep_clean",
    title: "Move-In Deep Sanitisation & Carpet Steam Clean",
    category: "Specialist Cleaning",
    subcategory: "End of Tenancy / Move-In Deep Clean",
    phase: "hygiene_setup",
    phaseLabel: "Hygiene & Setup",
    priority: "Recommended",
    priorityColor: "bg-blue-100 text-blue-800 border-blue-200",
    priceRange: "£140 – £240",
    estimatedHours: "3–6 hrs",
    urgency: "asap",
    quoteScope: "complete_package",
    whyRecommended: "Best completed while the property is completely empty before heavy removal vans and unboxed furniture arrive.",
    prefilledTitle: "Move-In Deep Clean & Carpet Steam Extraction",
    prefilledDescription: "Full empty-home deep clean prior to unboxing: inside kitchen cupboards & oven degrease, bathroom descaling & sanitisation, wiping skirtings and internal doors, plus high-temperature steam extraction on all carpeted bedrooms and stairs.",
    iconName: "Sparkles",
    tags: ["Pre-Furniture", "Allergy Sanitisation", "Deep Clean"]
  },
  {
    id: "move_in_painting",
    title: "White-Box Decorating / Fresh Room Refresh",
    category: "Painting & Decorating",
    subcategory: "Interior Painting & Wall Prep",
    phase: "hygiene_setup",
    phaseLabel: "Hygiene & Setup",
    priority: "Recommended",
    priorityColor: "bg-amber-100 text-amber-800 border-amber-200",
    priceRange: "£180 – £420",
    estimatedHours: "1–2 days",
    urgency: "flexible",
    quoteScope: "labour_only",
    whyRecommended: "Painting empty rooms with no furniture takes 50% less time and eliminates the risk of paint spills on carpets or personal belongings.",
    prefilledTitle: "Move-In Interior Painting: Fresh Coat in Living Room & Bedrooms",
    prefilledDescription: "Prep and emulsion empty walls and ceilings in primary living areas and bedrooms. Fill minor picture hook holes, sand smooth, apply 2 coats of premium matte emulsion, and touch up skirting woodwork.",
    iconName: "Palette",
    tags: ["Empty Room Speed", "Visual Refresh", "Value Booster"]
  },
  {
    id: "move_in_handyman_assembly",
    title: "Furniture Assembly, TV Mounting & Curtain Rails",
    category: "Handyman & Property Maintenance",
    subcategory: "Flat-Pack Assembly & Fixtures",
    phase: "hygiene_setup",
    phaseLabel: "Hygiene & Setup",
    priority: "Optional",
    priorityColor: "bg-slate-100 text-slate-700 border-slate-200",
    priceRange: "£60 – £130",
    estimatedHours: "2–4 hrs",
    urgency: "flexible",
    quoteScope: "labour_only",
    whyRecommended: "Get flat-pack beds, wardrobes, wall-mounted TVs, heavy mirrors, and curtain poles fitted securely on move-in week.",
    prefilledTitle: "Move-In Handyman: Flat-Pack Wardrobe/Bed Assembly & TV Wall Mounting",
    prefilledDescription: "Assistance with Day-One furniture setup: assemble 1 double bed frame and flat-pack wardrobe, mount 55\" TV to solid masonry chimney breast, and fit 2 curtain poles with secure wall anchors.",
    iconName: "Wrench",
    tags: ["Day 1 Setup", "Heavy Mounting", "Flat-Pack Help"]
  },

  // Phase 3: Exterior, Waste & Smart Home
  {
    id: "move_in_cardboard_rubbish",
    title: "Removal Boxes & Packaging Waste Clearance",
    category: "Waste & Clearance",
    subcategory: "Cardboard & Bulky Waste Removal",
    phase: "exterior_waste",
    phaseLabel: "Exterior & Waste",
    priority: "Recommended",
    priorityColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    priceRange: "£45 – £90",
    estimatedHours: "1 hr",
    urgency: "flexible",
    quoteScope: "complete_package",
    whyRecommended: "Recycle dozens of flattened moving boxes, bubble wrap, polystyrene crates, and old unwanted move-in packaging in one go.",
    prefilledTitle: "Move-In Waste Clearance: Cardboard Moving Boxes & Packaging Disposal",
    prefilledDescription: "Collect and responsibly dispose of 30+ flattened removal boxes, plastic bubble wrap, polystyrene crates, and miscellaneous move-in packing rubbish from front driveway. Environment Agency registered waste carrier.",
    iconName: "Trash2",
    tags: ["Driveway Clearance", "Eco-Recycling", "Post-Unboxing"]
  },
  {
    id: "move_in_garden_tidy",
    title: "Overgrown Lawn Mowing & Garden Tidy",
    category: "Gardening & Landscaping",
    subcategory: "Lawn Mowing & Hedge Trimming",
    phase: "exterior_waste",
    phaseLabel: "Exterior & Waste",
    priority: "Optional",
    priorityColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    priceRange: "£50 – £110",
    estimatedHours: "2–3 hrs",
    urgency: "flexible",
    quoteScope: "complete_package",
    whyRecommended: "Overgrown lawns and hedges left between house viewings and completion can be quickly cut and bagged to enjoy your new garden.",
    prefilledTitle: "Move-In Garden Tidy: Overgrown Lawn Mow & Border Strimming",
    prefilledDescription: "Initial garden tidy-up for newly purchased property: cut overgrown front and rear grass lawns, strim borders, trim wild brambles/hedges, and bag/remove garden green waste.",
    iconName: "Leaf",
    tags: ["Outdoor Living", "Green Waste Removal", "Curb Appeal"]
  },
  {
    id: "move_in_smart_doorbell",
    title: "Smart Video Doorbell & Security Camera Setup",
    category: "Security Systems & CCTV",
    subcategory: "Video Doorbell & Smart Security",
    phase: "smart_home",
    phaseLabel: "Smart Home & CCTV",
    priority: "Optional",
    priorityColor: "bg-indigo-100 text-indigo-800 border-indigo-200",
    priceRange: "£60 – £130",
    estimatedHours: "1–2 hrs",
    urgency: "flexible",
    quoteScope: "labour_only",
    whyRecommended: "Install video doorbell (Ring, Nest, Eufy) and smart cameras to monitor parcel deliveries and protect your property while at work.",
    prefilledTitle: "Install Smart Video Doorbell & Outdoor Security Camera",
    prefilledDescription: "Mount and hardwire / configure smart video doorbell to front door frame, connect to existing chime transformer and household Wi-Fi network, and test smartphone live video alerts.",
    iconName: "ShieldCheck",
    tags: ["Smart Security", "Delivery Protection", "Wi-Fi Connected"]
  }
];

export const MOVE_IN_STORAGE_KEY_PREFIX = "anytrader_move_in_tasks_";

export function getStoredCompletedTasks(propertyId: string): string[] {
  try {
    const raw = localStorage.getItem(`${MOVE_IN_STORAGE_KEY_PREFIX}${propertyId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveStoredCompletedTasks(propertyId: string, completedIds: string[]): void {
  try {
    localStorage.setItem(`${MOVE_IN_STORAGE_KEY_PREFIX}${propertyId}`, JSON.stringify(completedIds));
  } catch (e) {
    console.warn("Could not save move-in completed tasks to localStorage:", e);
  }
}

export function getStoredSkippedTasks(propertyId: string): string[] {
  try {
    const raw = localStorage.getItem(`${MOVE_IN_STORAGE_KEY_PREFIX}${propertyId}_skipped`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveStoredSkippedTasks(propertyId: string, skippedIds: string[]): void {
  try {
    localStorage.setItem(`${MOVE_IN_STORAGE_KEY_PREFIX}${propertyId}_skipped`, JSON.stringify(skippedIds));
  } catch (e) {
    console.warn("Could not save move-in skipped tasks to localStorage:", e);
  }
}

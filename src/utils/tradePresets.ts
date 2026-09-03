import { TRADE_CATEGORIES } from "@/src/constants";

export interface CategoryHotSearchPreset {
  id: string;
  title: string;
  category: string;
  subcategory: string;
  description: string;
  icon: string;
  tag: string;
  typicalPriceRange?: string;
}

/**
 * Curated hot search terms for common trade categories (supporting up to 10 items per category)
 */
const CURATED_HOT_SEARCHES: Record<string, CategoryHotSearchPreset[]> = {
  // Cake & Bake / Bakery / Patisserie
  "bake n cake": [
    {
      id: "preset-cake-1",
      title: "Birthday Cakes",
      category: "Bake N Cake",
      subcategory: "Birthday Cakes",
      description: "Bespoke themed & milestone celebration cakes",
      icon: "🎂",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£45 - £120"
    },
    {
      id: "preset-cake-2",
      title: "Wedding Cakes",
      category: "Bake N Cake",
      subcategory: "Wedding Cakes",
      description: "Multi-tier luxury wedding cakes, tastings & setups",
      icon: "💒",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£180 - £550"
    },
    {
      id: "preset-cake-3",
      title: "Cupcakes & Mini Treats",
      category: "Bake N Cake",
      subcategory: "Cupcakes & Mini Treats",
      description: "Boxed artisan cupcakes, macarons & dessert platters",
      icon: "🧁",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£25 - £75"
    },
    {
      id: "preset-cake-4",
      title: "Corporate & Event Cakes",
      category: "Bake N Cake",
      subcategory: "Corporate / Event Cakes",
      description: "Branded logos, launch events & celebration slabs",
      icon: "🏢",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£80 - £300"
    },
    {
      id: "preset-cake-5",
      title: "Dessert Table Catering",
      category: "Bake N Cake",
      subcategory: "Dessert Table Setup",
      description: "Full dessert buffet with brownies, tarts & pastries",
      icon: "🍩",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£120 - £400"
    },
    {
      id: "preset-cake-6",
      title: "Gluten-Free & Vegan Cakes",
      category: "Bake N Cake",
      subcategory: "Special Dietary Cakes",
      description: "Delicious dietary-safe bespoke sponge and buttercream cakes",
      icon: "🌱",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£50 - £130"
    },
    {
      id: "preset-cake-7",
      title: "Cake Pops & Cookies",
      category: "Bake N Cake",
      subcategory: "Custom Cookies & Favours",
      description: "Hand-iced cookies, party favours & themed cake pops",
      icon: "🍪",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£30 - £90"
    },
    {
      id: "preset-cake-8",
      title: "Number & Letter Cakes",
      category: "Bake N Cake",
      subcategory: "Novelty & Number Cakes",
      description: "Trendy biscuit or sponge numeral cakes topped with berries & sweets",
      icon: "🔢",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£55 - £110"
    },
    {
      id: "preset-cake-9",
      title: "Gender Reveal Cakes",
      category: "Bake N Cake",
      subcategory: "Baby Shower & Gender Reveal Cakes",
      description: "Surprise coloured sponge or confetti center celebration cakes",
      icon: "🎀",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£50 - £115"
    },
    {
      id: "preset-cake-10",
      title: "Afternoon Tea Platters",
      category: "Bake N Cake",
      subcategory: "Afternoon Tea & Scones",
      description: "Fresh clotted cream scones, mini eclairs and finger sandwiches",
      icon: "🫖",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£35 - £95"
    }
  ],
  // Plumbing
  "plumbing": [
    {
      id: "preset-plumb-1",
      title: "Emergency Plumbing Repairs",
      category: "Plumbing",
      subcategory: "General Plumbing Repairs",
      description: "Dripping taps, burst pipes, faulty valves & leaks",
      icon: "🔧",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£60 - £120"
    },
    {
      id: "preset-plumb-2",
      title: "Unblocking Sinks & Toilets",
      category: "Plumbing",
      subcategory: "Unblocking (drains, toilets, sinks)",
      description: "Fast blockage clearing & emergency drain jetting",
      icon: "🚰",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£75 - £150"
    },
    {
      id: "preset-plumb-3",
      title: "Bathroom Plumbing Fitting",
      category: "Plumbing",
      subcategory: "Bathroom Plumbing",
      description: "Shower valves, basins, toilets & mixer installation",
      icon: "🛁",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£120 - £350"
    },
    {
      id: "preset-plumb-4",
      title: "Radiator & Valve Replacement",
      category: "Plumbing",
      subcategory: "Radiator Installation",
      description: "Modern designer radiators & thermostatic radiator valves",
      icon: "🌡️",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£80 - £200"
    },
    {
      id: "preset-plumb-5",
      title: "Water Tank & Cylinder Repair",
      category: "Plumbing",
      subcategory: "Water Tank Repairs",
      description: "Hot water cylinders, immersion heaters & overflow pipes",
      icon: "💧",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£100 - £300"
    },
    {
      id: "preset-plumb-6",
      title: "Kitchen Sink & Tap Fitting",
      category: "Plumbing",
      subcategory: "Kitchen Plumbing",
      description: "Mixer taps, waste disposal units & washing machine plumbing",
      icon: "🍳",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£70 - £160"
    },
    {
      id: "preset-plumb-7",
      title: "Drainage CCTV & Survey",
      category: "Plumbing",
      subcategory: "Drain Survey & Clearing",
      description: "Full camera survey to diagnose root ingress and cracks",
      icon: "📹",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£110 - £250"
    },
    {
      id: "preset-plumb-8",
      title: "Shower Pump & Booster Fitting",
      category: "Plumbing",
      subcategory: "Shower Pump Installation",
      description: "Twin-impeller pumps for high-pressure power showers",
      icon: "🚿",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£140 - £320"
    },
    {
      id: "preset-plumb-9",
      title: "Outside Garden Tap Fitting",
      category: "Plumbing",
      subcategory: "Outdoor Tap Installation",
      description: "Frost-proof brass outdoor bib tap with isolator valve",
      icon: "🌱",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£65 - £120"
    },
    {
      id: "preset-plumb-10",
      title: "Water Leak Trace & Access",
      category: "Plumbing",
      subcategory: "Leak Detection & Tracing",
      description: "Acoustic and thermal detection for hidden underfloor pipe leaks",
      icon: "🔍",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£150 - £380"
    }
  ],
  // Heating & Gas
  "gas engineering": [
    {
      id: "preset-gas-1",
      title: "Boiler Servicing & Safety Check",
      category: "Gas Engineering",
      subcategory: "Boiler Servicing & Repair",
      description: "Annual boiler safety inspection & efficiency tune-up",
      icon: "🔥",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£80 - £130"
    },
    {
      id: "preset-gas-2",
      title: "Gas Safety Certificate (CP12)",
      category: "Gas Engineering",
      subcategory: "Gas Safety Inspection (CP12 / Landlord cert)",
      description: "Official landlord & homeowner CP12 compliance check",
      icon: "📜",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£65 - £110"
    },
    {
      id: "preset-gas-3",
      title: "New Boiler Installation",
      category: "Gas Engineering",
      subcategory: "Gas Boiler Installation",
      description: "A-rated combi, system & regular boiler installations",
      icon: "⚙️",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£1,400 - £2,800"
    },
    {
      id: "preset-gas-4",
      title: "Radiator Power Flushing",
      category: "Gas Engineering",
      subcategory: "Central Heating Power Flush",
      description: "Deep chemical flush to remove central heating sludge & cold spots",
      icon: "🚿",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£280 - £500"
    },
    {
      id: "preset-gas-5",
      title: "Gas Hob & Cooker Fitting",
      category: "Gas Engineering",
      subcategory: "Gas Hob & Cooker Installation",
      description: "Certified Gas Safe disconnection & appliance connection",
      icon: "🍳",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£75 - £140"
    },
    {
      id: "preset-gas-6",
      title: "Gas Leak Detection & Repair",
      category: "Gas Engineering",
      subcategory: "Gas Leak Detection & Repair",
      description: "Emergency gas smell tracing & pipe re-sealing",
      icon: "⚠️",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£90 - £180"
    },
    {
      id: "preset-gas-7",
      title: "Smart Thermostat Installation",
      category: "Gas Engineering",
      subcategory: "Thermostat & Heating Controls",
      description: "Hive, Nest & wireless programmable smart room stats",
      icon: "📱",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£70 - £150"
    },
    {
      id: "preset-gas-8",
      title: "Underfloor Heating Installation",
      category: "Gas Engineering",
      subcategory: "Underfloor Heating",
      description: "Wet water manifold systems and digital multi-zone controls",
      icon: "♨️",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£600 - £2,200"
    },
    {
      id: "preset-gas-9",
      title: "Gas Fire Servicing & Removal",
      category: "Gas Engineering",
      subcategory: "Gas Fire Installation & Service",
      description: "Chimney draw check, carbon monoxide safety & gas capping",
      icon: "🪵",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£85 - £160"
    },
    {
      id: "preset-gas-10",
      title: "Expansion Vessel & Pressure Repair",
      category: "Gas Engineering",
      subcategory: "Heating Pressure Faults",
      description: "Fixing dropping boiler pressure & faulty relief valves",
      icon: "⏲️",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£80 - £170"
    }
  ],
  // Electrical
  "electrical": [
    {
      id: "preset-elec-1",
      title: "EICR Safety Inspection",
      category: "Electrical",
      subcategory: "EICR (Electrical Safety Inspection)",
      description: "Full periodic inspection & digital compliance report",
      icon: "⚡",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£120 - £220"
    },
    {
      id: "preset-elec-2",
      title: "Consumer Unit (Fuse Box) Upgrade",
      category: "Electrical",
      subcategory: "Consumer Unit (Fuse Box) Replacement",
      description: "Modern surge-protected 18th edition consumer unit",
      icon: "🔌",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£350 - £650"
    },
    {
      id: "preset-elec-3",
      title: "EV Charger Installation",
      category: "Electrical",
      subcategory: "EV Charger Installation",
      description: "Fast 7kW home smart car charger installation",
      icon: "🚗",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£450 - £850"
    },
    {
      id: "preset-elec-4",
      title: "LED Downlight Installation",
      category: "Electrical",
      subcategory: "Lighting Installation (Indoor)",
      description: "Energy efficient fire-rated spotlights & dimmer switches",
      icon: "💡",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£100 - £280"
    },
    {
      id: "preset-elec-5",
      title: "Full House Rewire",
      category: "Electrical",
      subcategory: "Full / Partial House Rewire",
      description: "Complete modern certified rewiring for older homes",
      icon: "🏠",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£2,500 - £5,500"
    },
    {
      id: "preset-elec-6",
      title: "Socket & Switch Additions",
      category: "Electrical",
      subcategory: "Extra Sockets & Switches",
      description: "USB sockets, outdoor waterproof power & spurs",
      icon: "🎛️",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£60 - £150"
    },
    {
      id: "preset-elec-7",
      title: "Emergency Tripping Diagnosis",
      category: "Electrical",
      subcategory: "Emergency Electrical Fault Finding",
      description: "Fast fault tracing for tripping RCDs and power loss",
      icon: "🚨",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£85 - £160"
    },
    {
      id: "preset-elec-8",
      title: "Outdoor Security Lighting & CCTV",
      category: "Electrical",
      subcategory: "Security Lighting & Alarms",
      description: "PIR motion sensor floodlights & smart video doorbells",
      icon: "📹",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£110 - £260"
    },
    {
      id: "preset-elec-9",
      title: "Extractor Fan & Ventilation Fitting",
      category: "Electrical",
      subcategory: "Bathroom & Kitchen Extractor Fans",
      description: "Humidistat extractor fans to eliminate mould and damp",
      icon: "💨",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£90 - £180"
    },
    {
      id: "preset-elec-10",
      title: "Electric Shower Fitting & Wiring",
      category: "Electrical",
      subcategory: "Electric Shower Installation",
      description: "Dedicated 10mm cable runs & ceiling pull cord switches",
      icon: "🚿",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£130 - £290"
    }
  ],
  // Cleaning
  "home cleaning": [
    {
      id: "preset-clean-1",
      title: "End of Tenancy Deep Clean",
      category: "Home Cleaning",
      subcategory: "End of Tenancy Deep Clean",
      description: "Deposit-back guaranteed full property deep clean",
      icon: "✨",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£140 - £280"
    },
    {
      id: "preset-clean-2",
      title: "Carpet & Upholstery Steam Clean",
      category: "Specialist Cleaning",
      subcategory: "Carpet Cleaning",
      description: "Deep hot-water extraction & stain neutralisation",
      icon: "🧼",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£50 - £130"
    },
    {
      id: "preset-clean-3",
      title: "Regular Domestic House Cleaning",
      category: "Home Cleaning",
      subcategory: "Regular Domestic Cleaning",
      description: "Weekly or fortnightly general household cleaning",
      icon: "🧹",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£35 - £70"
    },
    {
      id: "preset-clean-4",
      title: "Deep Oven & Hob Cleaning",
      category: "Home Cleaning",
      subcategory: "Oven Cleaning",
      description: "Fume-free deep dip-tank oven, rack & glass cleaning",
      icon: "🍳",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£45 - £95"
    },
    {
      id: "preset-clean-5",
      title: "After-Builders Sparkle Clean",
      category: "Home Cleaning",
      subcategory: "After Builders Cleaning",
      description: "Fine dust removal, paint splatter clearing & window buffing",
      icon: "🏗️",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£160 - £350"
    },
    {
      id: "preset-clean-6",
      title: "Exterior Window & Gutter Cleaning",
      category: "Exterior Cleaning",
      subcategory: "Window & Gutter Cleaning",
      description: "Pure water-fed pole window washing & gutter vacuuming",
      icon: "🪟",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£40 - £110"
    },
    {
      id: "preset-clean-7",
      title: "Pressure Washing & Patio Jet Clean",
      category: "Exterior Cleaning",
      subcategory: "Driveway & Patio Jet Washing",
      description: "High-pressure moss, lichen & grime removal for driveways",
      icon: "💦",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£80 - £220"
    },
    {
      id: "preset-clean-8",
      title: "Wheelie Bin & Refuse Area Wash",
      category: "Specialist Cleaning",
      subcategory: "Wheelie Bin Cleaning",
      description: "Eco-friendly disinfectant power wash & deodorising for domestic bins",
      icon: "🗑️",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£15 - £35"
    },
    {
      id: "preset-clean-9",
      title: "Mould & Damp Sanitisation",
      category: "Specialist Cleaning",
      subcategory: "Mould & Mildew Treatment",
      description: "Fungicidal wall spray and surface deep sterilisation",
      icon: "🧪",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£90 - £220"
    },
    {
      id: "preset-clean-10",
      title: "Mattress & Sofa Stain Clean",
      category: "Specialist Cleaning",
      subcategory: "Upholstery & Fabric Cleaning",
      description: "Anti-allergen extraction for fabric lounges, headboards and mattresses",
      icon: "🛋️",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£40 - £110"
    }
  ],
  // Painting & Decorating
  "painting & decorating": [
    {
      id: "preset-paint-1",
      title: "Interior Room Painting",
      category: "Painting & Decorating",
      subcategory: "Interior Painting",
      description: "Walls, ceilings & woodwork glossing/emulsion",
      icon: "🎨",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£160 - £350"
    },
    {
      id: "preset-paint-2",
      title: "Wallpaper Hanging & Feature Wall",
      category: "Painting & Decorating",
      subcategory: "Wallpapering",
      description: "Precision pattern matching & wallpaper installation",
      icon: "🖌️",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£120 - £240"
    },
    {
      id: "preset-paint-3",
      title: "Exterior House & Facade Painting",
      category: "Painting & Decorating",
      subcategory: "Exterior Painting",
      description: "Weatherproof masonry paint & woodwork coating",
      icon: "🏡",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£450 - £1,200"
    },
    {
      id: "preset-paint-4",
      title: "Woodwork, Doors & Skirting Glossing",
      category: "Painting & Decorating",
      subcategory: "Woodwork Painting & Satinwood",
      description: "Sanding, undercoat & satinwood/gloss on doors & stairs",
      icon: "🚪",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£100 - £250"
    },
    {
      id: "preset-paint-5",
      title: "Kitchen Cabinet Spraying",
      category: "Painting & Decorating",
      subcategory: "Kitchen Unit Spraying",
      description: "Factory-finish spray coating for kitchen cupboard doors",
      icon: "✨",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£450 - £950"
    },
    {
      id: "preset-paint-6",
      title: "Plaster Patching & Skimming Prep",
      category: "Painting & Decorating",
      subcategory: "Plaster Repair & Prep",
      description: "Filling cracks, surface smoothing & mist coating",
      icon: "🧱",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£90 - £200"
    },
    {
      id: "preset-paint-7",
      title: "Commercial & Office Decorating",
      category: "Painting & Decorating",
      subcategory: "Commercial Painting",
      description: "Out-of-hours rapid office and retail refresh",
      icon: "🏢",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£350 - £1,500"
    },
    {
      id: "preset-paint-8",
      title: "Fence & Shed Weatherproof Staining",
      category: "Painting & Decorating",
      subcategory: "Outdoor Wood Staining & Preserving",
      description: "Protective decking oil, timber stain and fence spray",
      icon: "🪵",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£80 - £220"
    },
    {
      id: "preset-paint-9",
      title: "Ceiling Water Stain Blocking",
      category: "Painting & Decorating",
      subcategory: "Stain Block & Ceiling Repainting",
      description: "Anti-bleed primer and flat ceiling re-emulsion",
      icon: "🏠",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£75 - £160"
    },
    {
      id: "preset-paint-10",
      title: "Specialist Coving & Cornice Fitting",
      category: "Painting & Decorating",
      subcategory: "Coving & Moulding Installation",
      description: "Plaster & polymer decorative cornice mitring and adhesive fixing",
      icon: "📐",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£120 - £300"
    }
  ],
  // General Labour, Trade Mates & Site Helpers
  "general labour, trade mates & site helpers": [
    {
      id: "preset-labour-1",
      title: "Garden Digging & Groundwork Helper",
      category: "General Labour, Trade Mates & Site Helpers",
      subcategory: "Garden Digging, Trenching & Groundwork Assistance",
      description: "Trench digging, earth moving & garden prep",
      icon: "⛏️",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£100 - £160 / day"
    },
    {
      id: "preset-labour-2",
      title: "Heavy Material Offloading & Lifting",
      category: "General Labour, Trade Mates & Site Helpers",
      subcategory: "Material Offloading, Plasterboard, Bricks & Timber Carrying",
      description: "Offloading deliveries, plasterboard & site moving",
      icon: "🧱",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£90 - £150 / day"
    },
    {
      id: "preset-labour-3",
      title: "Demolition & Strip-Out Labourer",
      category: "General Labour, Trade Mates & Site Helpers",
      subcategory: "Demolition & Non-Structural Wall Strip-Out Helper",
      description: "Bathroom/kitchen rip-out, floor stripping & skip loading",
      icon: "🔨",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£110 - £180 / day"
    },
    {
      id: "preset-labour-4",
      title: "Skip Loading & Waste Clearance",
      category: "General Labour, Trade Mates & Site Helpers",
      subcategory: "Skip Loading & Site Rubbish Clearance",
      description: "Fast loading of heavy rubble, bricks and garden waste",
      icon: "🗑️",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£85 - £140 / day"
    },
    {
      id: "preset-labour-5",
      title: "Trade Mate & Primary Tradesperson Support",
      category: "General Labour, Trade Mates & Site Helpers",
      subcategory: "Trade Mate (Assisting Electricians, Plumbers, Roofers)",
      description: "Assisting skilled trades with tool fetching and holding",
      icon: "🤝",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£100 - £150 / day"
    },
    {
      id: "preset-labour-6",
      title: "Site Clean-Down & Post-Job Tidy",
      category: "General Labour, Trade Mates & Site Helpers",
      subcategory: "Site Sweeping & Daily Cleanup",
      description: "Broom sweep, bagging offcuts & final tidy-up",
      icon: "🧹",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£70 - £120"
    },
    {
      id: "preset-labour-7",
      title: "Paving, Slab & Sand Barrowing",
      category: "General Labour, Trade Mates & Site Helpers",
      subcategory: "Sand & Aggregate Barrowing",
      description: "Wheelbarrow transport of ballast, MOT Type 1 & mortar",
      icon: "🚜",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£95 - £155 / day"
    },
    {
      id: "preset-labour-8",
      title: "Tile & Laminate Removal Helper",
      category: "General Labour, Trade Mates & Site Helpers",
      subcategory: "Floor Stripping & Tile Chipping",
      description: "Lifting old floor tiles, carpet underlay and adhesive scraping",
      icon: "⛏️",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£95 - £160 / day"
    },
    {
      id: "preset-labour-9",
      title: "Insulation & Loft Boarding Assistant",
      category: "General Labour, Trade Mates & Site Helpers",
      subcategory: "Loft Loading & Insulation Laying",
      description: "Passing mineral wool rolls and boarding into attic spaces",
      icon: "📦",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£90 - £150 / day"
    },
    {
      id: "preset-labour-10",
      title: "Bulky Appliance & Furniture Carrying",
      category: "General Labour, Trade Mates & Site Helpers",
      subcategory: "Bulky Item Moving & Two-Person Lifting",
      description: "Safe two-person lifting of washing machines, cast baths and sofas",
      icon: "🏋️",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£80 - £140"
    }
  ],
  // Roofing
  "roofing": [
    {
      id: "preset-roof-1",
      title: "Emergency Roof Leak Repair",
      category: "Roofing",
      subcategory: "Roof Leak Repair",
      description: "Fast storm damage inspection, slip slate replacement & tarping",
      icon: "🏠",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£120 - £350"
    },
    {
      id: "preset-roof-2",
      title: "Flat Roof Replacement (EPDM / GRP)",
      category: "Roofing",
      subcategory: "Flat Roof Installation (EPDM / Felt / GRP)",
      description: "Seamless fibreglass, rubber EPDM & torch-on felt flat roofing",
      icon: "🏗️",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£850 - £2,400"
    },
    {
      id: "preset-roof-3",
      title: "Chimney Repointing & Lead Flashing",
      category: "Roofing",
      subcategory: "Chimney Repair & Flashing",
      description: "Lead apron replacement, chimney stack repointing & cowl fitting",
      icon: "🧱",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£180 - £450"
    },
    {
      id: "preset-roof-4",
      title: "Fascias, Soffits & Guttering Replacement",
      category: "Roofing",
      subcategory: "Fascias & Soffits",
      description: "Maintenance-free uPVC roofline, deep-flow gutters & downpipes",
      icon: "🌧️",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£350 - £900"
    },
    {
      id: "preset-roof-5",
      title: "Ridge Tile Rebedding & Dry Ridge",
      category: "Roofing",
      subcategory: "Ridge Tiles & Dry Verge",
      description: "Mortar-free dry ridge systems & mechanical storm verge caps",
      icon: "🛡️",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£220 - £550"
    },
    {
      id: "preset-roof-6",
      title: "Velux & Skylight Installation",
      category: "Roofing",
      subcategory: "Skylight / Velux Window Installation",
      description: "Centre-pivot roof windows with weatherproof flashing kits",
      icon: "🪟",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£450 - £1,100"
    },
    {
      id: "preset-roof-7",
      title: "Full Roof Retiling & Overhaul",
      category: "Roofing",
      subcategory: "New Tiled / Slate Roof",
      description: "Complete breathable membrane, battens and concrete/clay tiles",
      icon: "🏡",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£3,500 - £8,500"
    },
    {
      id: "preset-roof-8",
      title: "Gutter Clearance & Downpipe Unblocking",
      category: "Roofing",
      subcategory: "Gutter Cleaning & Repairs",
      description: "Clearing leaves, silt, moss and joint leak resealing",
      icon: "🍂",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£45 - £120"
    },
    {
      id: "preset-roof-9",
      title: "Roof Valley Lead Replacement",
      category: "Roofing",
      subcategory: "Roof Valley Repair",
      description: "New code 4 lead valley troughs & water channel sealing",
      icon: "📐",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£200 - £480"
    },
    {
      id: "preset-roof-10",
      title: "Roof Moss Removal & Biocide Spray",
      category: "Roofing",
      subcategory: "Roof Moss Scraping & Treatment",
      description: "Manual tile scraping and long-term anti-fungal wash",
      icon: "🌿",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£180 - £450"
    }
  ],
  // Carpentry & Joinery
  "carpentry & joinery": [
    {
      id: "preset-carp-1",
      title: "Internal Door Hanging & Latches",
      category: "Carpentry & Joinery",
      subcategory: "Door Hanging & Trimming",
      description: "Oak, fire-rated & panel doors planed, hinged and latched",
      icon: "🚪",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£40 - £90 / door"
    },
    {
      id: "preset-carp-2",
      title: "Bespoke Fitted Wardrobes & Alcove Units",
      category: "Carpentry & Joinery",
      subcategory: "Built-In Wardrobes & Cabinetry",
      description: "Floor-to-ceiling custom storage, shelving and hanging rails",
      icon: "🪑",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£850 - £2,800"
    },
    {
      id: "preset-carp-3",
      title: "Kitchen Worktop & Cupboard Fitting",
      category: "Carpentry & Joinery",
      subcategory: "Kitchen Fitting (Joinery)",
      description: "Solid wood & laminate worktop masons mitre joints & units",
      icon: "🍳",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£650 - £2,200"
    },
    {
      id: "preset-carp-4",
      title: "Skirting Boards & Architrave",
      category: "Carpentry & Joinery",
      subcategory: "Skirting & Architrave Installation",
      description: "MDF or timber skirting scribed, mitred and caulked",
      icon: "📐",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£140 - £350"
    },
    {
      id: "preset-carp-5",
      title: "Staircase Balustrade & Handrail Refurbishment",
      category: "Carpentry & Joinery",
      subcategory: "Staircase Renovation",
      description: "Oak spindles, newel posts, glass balustrades & handrails",
      icon: "🪜",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£380 - £1,200"
    },
    {
      id: "preset-carp-6",
      title: "Garden Decking & Timber Pergolas",
      category: "Carpentry & Joinery",
      subcategory: "Decking & Pergolas",
      description: "Composite or treated timber frame deck boards and seating",
      icon: "🪵",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£600 - £1,900"
    },
    {
      id: "preset-carp-7",
      title: "Hardwood & Engineered Wood Flooring",
      category: "Carpentry & Joinery",
      subcategory: "Wood Flooring Installation",
      description: "Tongue & groove secret nailing and acoustic underlay fitting",
      icon: "🪵",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£300 - £950"
    },
    {
      id: "preset-carp-8",
      title: "Stud Wall Partitioning & Framing",
      category: "Carpentry & Joinery",
      subcategory: "Stud Wall Construction",
      description: "Timber stud framing, acoustic insulation and door openings",
      icon: "🧱",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£250 - £650"
    },
    {
      id: "preset-carp-9",
      title: "Window Sill & Sash Window Restoration",
      category: "Carpentry & Joinery",
      subcategory: "Sash Window Repair",
      description: "Rotten timber splice repairs, new cords and draught proofing",
      icon: "🪟",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£120 - £380"
    },
    {
      id: "preset-carp-10",
      title: "Under-Stairs Pull-Out Storage",
      category: "Carpentry & Joinery",
      subcategory: "Under-Stairs Storage Solutions",
      description: "Custom pull-out shoe racks, drawers and coat cupboards",
      icon: "👟",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£450 - £1,100"
    }
  ],
  // Gardening & Landscaping
  "gardening & landscaping": [
    {
      id: "preset-gard-1",
      title: "Patio Paving & Porcelain Slabs",
      category: "Gardening & Landscaping",
      subcategory: "Patio & Paving Installation",
      description: "Sandstone, porcelain and granite modern garden patios",
      icon: "🌿",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£950 - £3,200"
    },
    {
      id: "preset-gard-2",
      title: "Timber & Featheredge Fencing",
      category: "Gardening & Landscaping",
      subcategory: "Fencing Installation & Repair",
      description: "Concrete slotted posts, gravel boards & lap/featheredge panels",
      icon: "🪵",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£350 - £1,200"
    },
    {
      id: "preset-gard-3",
      title: "Lawn Turfing & Artificial Grass",
      category: "Gardening & Landscaping",
      subcategory: "Lawn Turfing & Astro Turf",
      description: "Ground grading, weed membrane & premium seeded turfing",
      icon: "🌱",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£450 - £1,600"
    },
    {
      id: "preset-gard-4",
      title: "Tree Pruning, Lopping & Stump Removal",
      category: "Gardening & Landscaping",
      subcategory: "Tree Surgery & Stump Grinding",
      description: "Crown reduction, branch thinning, felling and root grinding",
      icon: "🌳",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£180 - £600"
    },
    {
      id: "preset-gard-5",
      title: "Hedge Trimming & Shrub Shaping",
      category: "Gardening & Landscaping",
      subcategory: "Hedge Trimming & Pruning",
      description: "Seasonal conifer, laurel and privet hedge cutting and disposal",
      icon: "✂️",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£70 - £180"
    },
    {
      id: "preset-gard-6",
      title: "Garden Clearance & Jungle Overhaul",
      category: "Gardening & Landscaping",
      subcategory: "Garden Clearance",
      description: "Overgrown briar clearing, strimming and green waste removal",
      icon: "🌾",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£160 - £420"
    },
    {
      id: "preset-gard-7",
      title: "Raised Sleeper Flowerbeds & Retaining Walls",
      category: "Gardening & Landscaping",
      subcategory: "Raised Beds & Planters",
      description: "Oak railway sleeper beds, topsoil fill & tiered garden walls",
      icon: "🪴",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£280 - £850"
    },
    {
      id: "preset-gard-8",
      title: "Garden Gate Fitting & Repair",
      category: "Gardening & Landscaping",
      subcategory: "Garden Gates & Latches",
      description: "Heavy-duty T-hinge wooden side gates with key locks",
      icon: "🚪",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£85 - £220"
    },
    {
      id: "preset-gard-9",
      title: "Garden Drainage & Soakaway Fitting",
      category: "Gardening & Landscaping",
      subcategory: "Lawn & Garden Drainage",
      description: "French drains, perforated pipes and waterlogged lawn solutions",
      icon: "💧",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£350 - £1,100"
    },
    {
      id: "preset-gard-10",
      title: "Garden Shed Base & Erection",
      category: "Gardening & Landscaping",
      subcategory: "Shed Bases & Assembly",
      description: "Concrete pads, treated timber bases and shed waterproofing",
      icon: "🏡",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£220 - £650"
    }
  ],
  // Handyman & Property Maintenance
  "handyman & property maintenance": [
    {
      id: "preset-handy-1",
      title: "TV Wall Mounting & Cable Concealing",
      category: "Handyman & Property Maintenance",
      subcategory: "TV Wall Mounting",
      description: "Secure stud & brick wall bracket mounting with trunking",
      icon: "📺",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£45 - £95"
    },
    {
      id: "preset-handy-2",
      title: "Flat Pack Furniture Assembly",
      category: "Handyman & Property Maintenance",
      subcategory: "Flat Pack Furniture Assembly",
      description: "IKEA, Argos & Next wardrobes, bedframes and drawers",
      icon: "🪛",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£40 - £120"
    },
    {
      id: "preset-handy-3",
      title: "Blind, Curtain Pole & Mirror Fitting",
      category: "Handyman & Property Maintenance",
      subcategory: "Curtain Pole & Blind Fitting",
      description: "Level masonry drilling, heavy mirrors, pictures and roller blinds",
      icon: "🪟",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£35 - £80"
    },
    {
      id: "preset-handy-4",
      title: "Silicone Resealing (Bath & Shower)",
      category: "Handyman & Property Maintenance",
      subcategory: "Silicone & Mastic Resealing",
      description: "Anti-mould sanitary silicone removal and neat re-beading",
      icon: "🛁",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£45 - £90"
    },
    {
      id: "preset-handy-5",
      title: "Door Lock & Handle Replacement",
      category: "Handyman & Property Maintenance",
      subcategory: "Lock & Handle Repair",
      description: "Anti-snap cylinder upgrades, sashlocks and interior handles",
      icon: "🔐",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£50 - £120"
    },
    {
      id: "preset-handy-6",
      title: "Drywall Hole & Plasterboard Patching",
      category: "Handyman & Property Maintenance",
      subcategory: "Plasterboard Patch Repair",
      description: "Doorknob punch-throughs, pipe cutouts and joint taping",
      icon: "🧱",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£60 - £140"
    },
    {
      id: "preset-handy-7",
      title: "General Odd Jobs & Maintenance (Half Day)",
      category: "Handyman & Property Maintenance",
      subcategory: "General Odd Jobs",
      description: "Tackle a multi-item household fix-it checklist",
      icon: "🛠️",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£100 - £180"
    },
    {
      id: "preset-handy-8",
      title: "Draught Proofing & Door Shaving",
      category: "Handyman & Property Maintenance",
      subcategory: "Door Trimming & Draught Proofing",
      description: "Planed door bottoms over new thick carpets and brush seals",
      icon: "🚪",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£40 - £85"
    },
    {
      id: "preset-handy-9",
      title: "Grouting & Broken Tile Replacement",
      category: "Handyman & Property Maintenance",
      subcategory: "Grout Repair & Tile Fixing",
      description: "Regrouting discoloured shower tiles and fixing loose floor tiles",
      icon: "🧼",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£55 - £130"
    },
    {
      id: "preset-handy-10",
      title: "Cat Flap & Letterbox Installation",
      category: "Handyman & Property Maintenance",
      subcategory: "Cat Flap Fitting",
      description: "uPVC or wooden panel precision cutout and magnetic flap fitting",
      icon: "🐱",
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "£50 - £110"
    }
  ]
};

/**
 * Normalizes and extracts trade/category tokens for a trader
 */
export function getTraderCategoryTokens(profile: any): string[] {
  if (!profile) return [];
  const rawList: string[] = [];

  if (profile.primaryCategory) rawList.push(String(profile.primaryCategory));
  if (profile.trade) rawList.push(String(profile.trade));
  if (Array.isArray(profile.trades)) {
    rawList.push(...profile.trades.map(String));
  } else if (typeof profile.trades === "string") {
    rawList.push(profile.trades);
  }
  if (Array.isArray(profile.services)) {
    rawList.push(...profile.services.map(String));
  }
  if (Array.isArray(profile.tags)) {
    rawList.push(...profile.tags.map(String));
  }

  const tokens = new Set<string>();
  rawList.forEach(item => {
    const lower = item.toLowerCase().trim();
    if (!lower) return;
    tokens.add(lower);
    // Split on separators
    lower.split(/[\s,&•/]+/).forEach(word => {
      if (word.length >= 3) tokens.add(word);
    });
  });

  return Array.from(tokens);
}

/**
 * Finds the primary category object and canonical name for a trader
 */
export function findCategoryForTrader(profile: any): { categoryName: string; categoryObj: any | null } {
  if (!profile) {
    return { categoryName: "General Trade", categoryObj: null };
  }

  const tradesStr = [
    profile.primaryCategory,
    profile.trade,
    Array.isArray(profile.trades) ? profile.trades.join(" ") : profile.trades,
    Array.isArray(profile.services) ? profile.services.join(" ") : profile.services,
    profile.bio
  ].filter(Boolean).join(" ").toLowerCase();

  // 1. Check for Cake / Bake / Bakery
  if (
    tradesStr.includes("cake") ||
    tradesStr.includes("bake") ||
    tradesStr.includes("pastry") ||
    tradesStr.includes("patisserie") ||
    tradesStr.includes("cupcake")
  ) {
    const cat = TRADE_CATEGORIES.find(c => c.name.toLowerCase().includes("bake n cake") || c.id === 84);
    return { categoryName: "Bake N Cake", categoryObj: cat || null };
  }

  // 2. Check for Catering
  if (tradesStr.includes("catering") || tradesStr.includes("private chef")) {
    const cat = TRADE_CATEGORIES.find(c => c.name.toLowerCase().includes("event") || c.name.toLowerCase().includes("party"));
    return { categoryName: "Catering & Private Chef", categoryObj: cat || null };
  }

  // 3. Exact or substring match in TRADE_CATEGORIES
  for (const cat of TRADE_CATEGORIES) {
    const catLower = cat.name.toLowerCase();
    if (tradesStr.includes(catLower)) {
      return { categoryName: cat.name, categoryObj: cat };
    }
  }

  // 4. Token-based matching
  const tokens = getTraderCategoryTokens(profile);
  for (const cat of TRADE_CATEGORIES) {
    const catLower = cat.name.toLowerCase();
    for (const tok of tokens) {
      if (tok.length >= 4 && catLower.includes(tok)) {
        return { categoryName: cat.name, categoryObj: cat };
      }
    }
  }

  const fallbackName = profile.primaryCategory || profile.trade || (Array.isArray(profile.trades) ? profile.trades[0] : "General Trade");
  return { categoryName: fallbackName, categoryObj: null };
}

/**
 * Returns strictly no more than 3 hot searched terms in the trader's category
 */
export function getCategoryHotSearches(profile: any, maxItems: number = 3): CategoryHotSearchPreset[] {
  const { categoryName, categoryObj } = findCategoryForTrader(profile);
  const catKey = categoryName.toLowerCase().trim();

  // 1. Check curated hot searches lookup
  if (CURATED_HOT_SEARCHES[catKey]) {
    return CURATED_HOT_SEARCHES[catKey].slice(0, maxItems);
  }

  // Check aliases (e.g. "cake maker & baker" -> "bake n cake")
  if (catKey.includes("cake") || catKey.includes("bake")) {
    return CURATED_HOT_SEARCHES["bake n cake"].slice(0, maxItems);
  }
  if (catKey.includes("plumb")) {
    return CURATED_HOT_SEARCHES["plumbing"].slice(0, maxItems);
  }
  if (catKey.includes("gas") || catKey.includes("boiler") || catKey.includes("heating")) {
    return CURATED_HOT_SEARCHES["gas engineering"].slice(0, maxItems);
  }
  if (catKey.includes("electr")) {
    return CURATED_HOT_SEARCHES["electrical"].slice(0, maxItems);
  }
  if (catKey.includes("clean")) {
    return CURATED_HOT_SEARCHES["home cleaning"].slice(0, maxItems);
  }
  if (catKey.includes("paint") || catKey.includes("decorat")) {
    return CURATED_HOT_SEARCHES["painting & decorating"].slice(0, maxItems);
  }
  if (catKey.includes("labour") || catKey.includes("helper") || catKey.includes("mate")) {
    return CURATED_HOT_SEARCHES["general labour, trade mates & site helpers"].slice(0, maxItems);
  }
  if (catKey.includes("roof")) {
    return CURATED_HOT_SEARCHES["roofing"].slice(0, maxItems);
  }
  if (catKey.includes("carpent") || catKey.includes("joiner") || catKey.includes("wood")) {
    return CURATED_HOT_SEARCHES["carpentry & joinery"].slice(0, maxItems);
  }
  if (catKey.includes("garden") || catKey.includes("landscape") || catKey.includes("fenc") || catKey.includes("lawn") || catKey.includes("tree")) {
    return CURATED_HOT_SEARCHES["gardening & landscaping"].slice(0, maxItems);
  }
  if (catKey.includes("handyman") || catKey.includes("maintenance") || catKey.includes("flat pack") || catKey.includes("odd job")) {
    return CURATED_HOT_SEARCHES["handyman & property maintenance"].slice(0, maxItems);
  }

  // 2. If trader has explicit custom services (e.g. from seed or profile)
  if (Array.isArray(profile?.services) && profile.services.length > 0) {
    const icon = categoryObj?.icon || "✨";
    return profile.services.slice(0, maxItems).map((svc: string, idx: number) => ({
      id: `svc-preset-${idx}`,
      title: svc,
      category: categoryName,
      subcategory: svc,
      description: `Bespoke ${svc} service requested directly from ${profile.name}`,
      icon,
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "Quote on Request"
    }));
  }

  // 3. Use top subcategories from category object in TRADE_CATEGORIES
  if (categoryObj && Array.isArray(categoryObj.subcategories) && categoryObj.subcategories.length > 0) {
    const icon = categoryObj.icon || "✨";
    return categoryObj.subcategories.slice(0, maxItems).map((sub: string, idx: number) => ({
      id: `cat-sub-${idx}`,
      title: sub,
      category: categoryName,
      subcategory: sub,
      description: `Popular ${sub} quote request for ${categoryName}`,
      icon,
      tag: "🔥 HOT SEARCH",
      typicalPriceRange: "Quote on Request"
    }));
  }

  // 4. Default generic 3 presets
  return [
    {
      id: "gen-1",
      title: `General ${categoryName} Consultation`,
      category: categoryName,
      subcategory: "Consultation",
      description: `Discuss scope, design, pricing & scheduling with ${profile?.name || "the trader"}`,
      icon: "💬",
      tag: "🔥 HOT SEARCH"
    },
    {
      id: "gen-2",
      title: `Bespoke ${categoryName} Project`,
      category: categoryName,
      subcategory: "Custom Work",
      description: `Full quote and specifications for tailor-made ${categoryName} requirements`,
      icon: "⭐",
      tag: "🔥 HOT SEARCH"
    },
    {
      id: "gen-3",
      title: `Standard ${categoryName} Service`,
      category: categoryName,
      subcategory: "Standard Service",
      description: `Routine booking, delivery & execution for ${categoryName}`,
      icon: "✅",
      tag: "🔥 HOT SEARCH"
    }
  ].slice(0, maxItems);
}

/**
 * Strictly checks if a user's existing job is related to the target tradesperson's category/trades.
 * Filters out completely unrelated jobs (e.g. Gas Safety Inspection or Taxi when requesting a Cake Baker).
 */
export function isJobMatchingTrader(job: any, profile: any): boolean {
  if (!job || !profile) return false;

  // Emergency jobs are never directly requested
  if (job.urgency === "emergency") return false;

  const traderTokens = getTraderCategoryTokens(profile);
  if (traderTokens.length === 0) return true;

  const jobCategory = String(job.category || "").toLowerCase();
  const jobSubcategory = String(job.subcategory || "").toLowerCase();
  const jobTitle = String(job.title || "").toLowerCase();
  const jobTrade = String(job.trade || "").toLowerCase();

  // Special category check: Cake & Bake
  const traderIsCake = traderTokens.some(t =>
    t.includes("cake") || t.includes("bake") || t.includes("pastry") || t.includes("baker")
  );

  if (traderIsCake) {
    // If trader is Cake Maker & Baker, job MUST have cake/bake/catering/dessert keywords
    const matchesCake =
      jobCategory.includes("bake") ||
      jobCategory.includes("cake") ||
      jobSubcategory.includes("cake") ||
      jobSubcategory.includes("bake") ||
      jobTitle.includes("cake") ||
      jobTitle.includes("bake") ||
      jobTitle.includes("pastry") ||
      jobTitle.includes("cupcake") ||
      jobTitle.includes("wedding") ||
      jobTitle.includes("birthday") ||
      jobTitle.includes("catering") ||
      jobCategory.includes("catering");

    return matchesCake;
  }

  // Special category check: Taxi / Rides
  const traderIsTaxi = traderTokens.some(t => t.includes("taxi") || t.includes("transport") || t.includes("ride"));
  if (traderIsTaxi) {
    return jobCategory.includes("taxi") || jobCategory.includes("transport") || jobTitle.includes("taxi");
  }

  // General check: Does any significant trader token match the job's category or title?
  for (const token of traderTokens) {
    if (token.length < 3) continue;
    // Skip generic words
    if (["and", "the", "for", "with", "services", "specialist", "expert"].includes(token)) continue;

    if (
      jobCategory.includes(token) ||
      jobSubcategory.includes(token) ||
      jobTitle.includes(token) ||
      jobTrade.includes(token)
    ) {
      return true;
    }
  }

  return false;
}

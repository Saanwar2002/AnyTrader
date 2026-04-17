export const RECURRING_CATEGORIES = [
  "Landscaping & Garden",
  "Home Cleaning",
  "Swimming Pool & Hot Tub",
  "Pet Services",
  "Industrial & Commercial Cleaning",
  "Specialist Cleaning",
  "Car Detailing & Valeting",
  "Windows & Doors", // For window cleaning
  "Estate Agent & Landlord Services"
];

export const UNSORTED_TRADE_CATEGORIES = [
  {
    id: 1,
    name: "Plumbing",
    icon: "🔧",
    requiredCertifications: ["NVQ Level 2/3 Plumbing", "WRAS Approval (Optional)"],
    subcategories: [
      "General Plumbing Repairs",
      "Boiler Installation & Replacement",
      "Boiler Servicing & Repair",
      "Central Heating Installation",
      "Central Heating Repair",
      "Radiator Installation & Balancing",
      "Underfloor Heating",
      "Bathroom Plumbing",
      "Kitchen Plumbing",
      "Water Tank & Cylinder Replacement",
      "Unblocking (drains, toilets, sinks)",
      "Leak Detection & Repair",
      "Pipe Lagging & Insulation",
      "Power Flushing",
      "Thermostatic Valve Fitting",
      "Water Softener Installation",
      "Stopcock & Valve Replacement",
      "Emergency Plumbing (24/7)"
    ]
  },
  {
    id: 2,
    name: "Electrical",
    icon: "⚡",
    requiredCertifications: ["NICEIC/NAPIT/ELECSA Membership", "Part P Certification", "18th Edition Wiring Regs"],
    subcategories: [
      "Full & Partial Rewiring",
      "Consumer Unit (Fuse Box) Replacement",
      "Socket & Switch Installation",
      "Lighting Installation (indoor)",
      "Outdoor & Garden Lighting",
      "EICR (Electrical Safety Inspection)",
      "PAT Testing",
      "EV Charger Installation",
      "Smart Home Wiring",
      "Smoke & CO Alarm Installation",
      "Extractor Fan Installation",
      "CCTV & Security System Installation",
      "Alarm System Installation & Repair",
      "Electric Shower Installation",
      "Cooker & Hob Connection",
      "Emergency Electrician (24/7)",
      "Commercial Electrical Works"
    ]
  },
  {
    id: 3,
    name: "Building & Construction",
    icon: "🏗️",
    subcategories: [
      "Extensions (single/double storey)",
      "Loft Conversions",
      "Garage Conversions",
      "Basement / Cellar Conversions",
      "Conservatory Building",
      "Orangery Construction",
      "Garden Rooms & Offices",
      "New Builds",
      "Structural Alterations (knock-through, RSJ)",
      "Porch Building",
      "Outbuildings & Sheds",
      "Underpinning",
      "Foundation Work",
      "Demolition",
      "Project Management"
    ]
  },
  {
    id: 4,
    name: "Carpentry & Joinery",
    icon: "🪚",
    subcategories: [
      "Fitted Wardrobes & Storage",
      "Kitchen Fitting",
      "Door Hanging & Replacement",
      "Staircase Installation & Repair",
      "Skirting Boards & Architrave",
      "Flooring (wood, laminate, engineered)",
      "Decking Installation",
      "Pergola & Gazebo Building",
      "Shelving & Built-in Furniture",
      "Loft Boarding",
      "Window Boarding",
      "Bespoke Furniture",
      "Structural Timber Work",
      "Shop & Office Fitting"
    ]
  },
  {
    id: 5,
    name: "Painting & Decorating",
    icon: "🎨",
    subcategories: [
      "Interior Painting",
      "Exterior Painting",
      "Wallpapering",
      "Plastering (skimming, rendering)",
      "Artex Removal",
      "Coving & Cornice Fitting",
      "Wood Staining & Varnishing",
      "Spray Painting (walls, cabinets, UPVC)",
      "Mural & Feature Wall Painting",
      "Commercial Decorating",
      "Period Property Restoration"
    ]
  },
  {
    id: 6,
    name: "Roofing",
    icon: "🏠",
    subcategories: [
      "Roof Repair (slate, tile, flat)",
      "Full Roof Replacement",
      "Flat Roofing (felt, GRP fibreglass, EPDM rubber)",
      "Ridge Tile Repointing & Dry Ridge",
      "Fascia, Soffit & Bargeboard",
      "Lead Work & Flashing",
      "Chimney Repair & Repointing",
      "Chimney Removal",
      "Velux / Skylight Installation",
      "Roof Cleaning & Moss Removal",
      "Emergency Roof Repair",
      "Loft Insulation (via roofing access)",
      "Green / Living Roofs"
    ]
  },
  {
    id: 7,
    name: "Windows & Doors",
    icon: "🪟",
    subcategories: [
      "UPVC Window Installation",
      "Aluminium Window Installation",
      "Timber / Sash Window Restoration",
      "Double / Triple Glazing Upgrade",
      "Composite Door Installation",
      "UPVC Door Installation & Repair",
      "Internal Door Hanging (Wooden)",
      "External Door Hanging (Wooden)",
      "Door Trimming & Easing",
      "Door Repair (handles, hinges, locks, mechanisms)",
      "French & Patio Doors",
      "Bi-fold Door Installation",
      "Garage Door Installation & Repair",
      "Conservatory Roof Replacement",
      "Window Repair (handles, hinges, locks, seals)",
      "Cat Flap Installation",
      "Shopfront Installation"
    ]
  },
  {
    id: 8,
    name: "Refrigerator/AC",
    icon: "❄️",
    subcategories: [
      "Domestic Refrigerator & Freezer Repair",
      "Commercial Refrigeration Service",
      "Air Conditioning Installation",
      "Air Conditioning Servicing",
      "Wine Cooler & Specialist Cooling Repair",
      "Heat Pump Installation (air source / ground source)",
      "Ventilation & MVHR Systems",
      "Ductwork Installation",
      "Commercial HVAC Systems",
      "Biomass Boiler Installation"
    ]
  },
  {
    id: 9,
    name: "Tiling",
    icon: "🔲",
    subcategories: [
      "Bathroom Wall & Floor Tiling",
      "Kitchen Splashback Tiling",
      "Floor Tiling (porcelain, ceramic, natural stone)",
      "Wet Room Tiling & Tanking",
      "Mosaic Tiling",
      "External Tiling (patios, steps)",
      "Re-grouting & Silicone Replacement",
      "Tile Removal & Preparation"
    ]
  },
  {
    id: 10,
    name: "Masonry & Stonework",
    icon: "🧱",
    subcategories: [
      "Bricklaying",
      "Repointing",
      "Garden Wall Building",
      "Retaining Walls",
      "Stone Cladding",
      "Rendering (cement, monocouche, silicone)",
      "Pebble Dashing",
      "Chimney Rebuilding",
      "Restoration & Conservation"
    ]
  },
  {
    id: 11,
    name: "Landscaping & Garden",
    icon: "🌿",
    subcategories: [
      "Garden Design & Landscaping",
      "Patio & Paving (block, Indian stone, porcelain)",
      "Driveway Installation (block paving, resin, tarmac, gravel)",
      "Fencing & Gates",
      "Artificial Grass Installation",
      "Turfing & Lawn Care",
      "Garden Clearance",
      "Raised Beds & Planters",
      "Pond Building",
      "Irrigation Systems",
      "Hedge Trimming & Maintenance",
      "Outdoor Kitchen / BBQ Area"
    ]
  },
  {
    id: 12,
    name: "Guttering & Drainage",
    icon: "🪈",
    subcategories: [
      "Gutter Replacement (UPVC, cast iron, aluminium)",
      "Gutter Repair & Resealing",
      "Gutter Cleaning",
      "Blocked Gutters",
      "Downpipe Installation & Repair",
      "Drainage Installation (land drains, soakaways)",
      "Drain Unblocking & CCTV Survey",
      "Blocked Sewerage Pipes",
      "French Drain Installation",
      "Septic Tank Installation & Servicing",
      "Rainwater Harvesting Systems"
    ]
  },
  {
    id: 13,
    name: "Damp Proofing & Waterproofing",
    icon: "💧",
    subcategories: [
      "Rising Damp Treatment (DPC injection)",
      "Penetrating Damp Repair",
      "Condensation Solutions",
      "Basement Waterproofing (tanking)",
      "Mould Removal & Treatment",
      "Cavity Wall Tie Replacement",
      "Timber Treatment (woodworm, wet/dry rot)",
      "Structural Drying"
    ]
  },
  {
    id: 14,
    name: "Pest Control",
    icon: "🐛",
    requiredCertifications: ["BPCA/NPTA Membership", "RSPH Level 2 in Pest Management"],
    subcategories: [
      "Rodent Control (rats, mice)",
      "Insect Control (wasps, ants, bed bugs, fleas, cockroaches)",
      "Bird Control (pigeons, gulls — netting, spikes)",
      "Squirrel Removal",
      "Fox Deterrent",
      "Mole Control",
      "Moth Treatment",
      "Woodworm Treatment",
      "Commercial Pest Management"
    ]
  },
  {
    id: 15,
    name: "Tree Surgery & Arboriculture",
    icon: "🌳",
    subcategories: [
      "Tree Felling",
      "Crown Reduction & Thinning",
      "Tree Pruning",
      "Stump Grinding & Removal",
      "Hedge Cutting (large/tall)",
      "Tree Health Survey",
      "Emergency Storm Damage",
      "Tree Planting",
      "TPO / Conservation Area Advice"
    ]
  },
  {
    id: 16,
    name: "Solar & Renewable Energy",
    icon: "☀️",
    subcategories: [
      "Solar Panel Installation (PV)",
      "Solar Panel Cleaning & Maintenance",
      "Battery Storage Systems",
      "Solar Thermal (hot water)",
      "EV Charger Installation",
      "Heat Pump Installation",
      "Wind Turbine (micro/domestic)",
      "Energy Efficiency Assessment",
      "Energy Saving Audit",
      "Composting & Worm Farm Setup",
      "Rainwater Collection Systems"
    ]
  },
  {
    id: 17,
    name: "Handyman / General",
    icon: "🔨",
    subcategories: [
      "Flat Pack Assembly",
      "Picture & Mirror Hanging",
      "Curtain Pole & Blind Fitting",
      "TV Wall Mounting",
      "Odd Jobs & Small Repairs",
      "Shed Assembly",
      "Pressure Washing",
      "Gutter Cleaning",
      "General Property Maintenance"
    ]
  },
  {
    id: 18,
    name: "Locksmith",
    icon: "🔒",
    subcategories: [
      "Emergency Lockout (24/7)",
      "Lock Replacement & Upgrade",
      "UPVC Door Lock Mechanism Repair",
      "Window Lock Installation",
      "Safe Installation",
      "Master Key Systems",
      "Smart Lock Installation",
      "Boarding Up (after break-in)"
    ]
  },
  {
    id: 19,
    name: "Home Cleaning",
    icon: "🧹",
    subcategories: [
      "Regular Domestic Cleaning",
      "One-off Deep Clean",
      "End of Tenancy Cleaning",
      "Move-in / Pre-Tenancy Clean",
      "Spring Cleaning",
      "Oven Cleaning",
      "Carpet Cleaning (steam / dry)",
      "Upholstery Cleaning",
      "Window Cleaning (internal & external)",
      "After-Builders Cleaning",
      "After-Party Cleaning",
      "Mattress Cleaning",
      "Curtain & Blind Cleaning",
      "Hard Floor Cleaning & Polishing",
      "Kitchen Deep Clean (inc. appliances)",
      "Bathroom Deep Clean (inc. descaling)",
      "Hoarding Cleanup",
      "Bereavement / Deceased Estate Cleaning",
      "Airbnb / Holiday Let Turnaround",
      "Eco-Friendly / Green Cleaning"
    ]
  },
  {
    id: 20,
    name: "Removals",
    icon: "🚚",
    subcategories: [
      "Man & Van",
      "Furniture Delivery & Collection",
      "Ebay / Marketplace Item Collection",
      "Student Move (single room)",
      "Small Move (1-2 rooms)",
      "Packaging Material Supply",
      "Storage Drop-off & Collection"
    ]
  },
  {
    id: 21,
    name: "Bathroom & Kitchen Fitting",
    icon: "🪞",
    subcategories: [
      "Full Bathroom Installation",
      "Wet Room Installation",
      "Bathroom Refurbishment",
      "Full Kitchen Installation",
      "Kitchen Refurbishment",
      "Worktop Supply & Fit (granite, quartz, laminate)",
      "Kitchen Appliance Installation",
      "Disability Adaptation (walk-in showers, grab rails)"
    ]
  },
  {
    id: 22,
    name: "Plastering",
    icon: "🧱",
    subcategories: [
      "Skimming (over plasterboard/artex)",
      "Dry Lining & Plasterboarding",
      "Ceiling Repair & Replacement",
      "Coving Installation",
      "External Rendering",
      "Venetian / Polished Plaster",
      "Screeding (floor levelling)"
    ]
  },
  {
    id: 23,
    name: "Gas Engineering",
    icon: "🔥",
    requiredCertifications: ["Gas Safe Registration (MANDATORY)", "ACS Certification"],
    subcategories: [
      "Gas Boiler Installation",
      "Gas Safety Inspection (CP12 / Landlord cert)",
      "Gas Fire Installation & Servicing",
      "Gas Hob & Cooker Installation",
      "Gas Leak Detection & Repair",
      "Gas Meter Relocation",
      "LPG Installation"
    ]
  },
  {
    id: 24,
    name: "Security Systems",
    icon: "🛡️",
    subcategories: [
      "CCTV Installation (home & commercial)",
      "Burglar Alarm Installation",
      "Smart Doorbell Installation (Ring, Nest)",
      "Access Control Systems",
      "Intercom Systems",
      "Security Lighting",
      "Safe Installation"
    ]
  },
  {
    id: 25,
    name: "Water Treatment",
    icon: "🚰",
    subcategories: [
      "Water Softener Installation",
      "Water Filtration Systems",
      "Boiling Water Tap Installation",
      "Water Testing"
    ]
  },
  {
    id: 26,
    name: "Insulation",
    icon: "🏡",
    subcategories: [
      "Loft Insulation",
      "Cavity Wall Insulation",
      "External Wall Insulation (EWI)",
      "Internal Wall Insulation",
      "Floor Insulation",
      "Pipe & Tank Insulation",
      "Draught Proofing",
      "Spray Foam Insulation"
    ]
  },
  {
    id: 27,
    name: "Swimming Pool & Hot Tub",
    icon: "🏊",
    subcategories: [
      "Swimming Pool Installation",
      "Swimming Pool Maintenance",
      "Hot Tub Installation",
      "Hot Tub Servicing",
      "Sauna Installation"
    ]
  },
  {
    id: 28,
    name: "Accessibility & Adaptations",
    icon: "♿",
    subcategories: [
      "Stairlift Installation",
      "Walk-in Shower / Wet Room Conversion",
      "Wheelchair Ramp Installation",
      "Grab Rail Fitting",
      "Door Widening",
      "Home Assessment for Disabled Facilities Grant"
    ]
  },
  {
    id: 29,
    name: "Flooring",
    icon: "🪵",
    subcategories: [
      "Hardwood Flooring",
      "Laminate Flooring",
      "Engineered Wood Flooring",
      "Vinyl / LVT Flooring",
      "Carpet Fitting",
      "Floor Sanding & Restoration",
      "Resin Flooring",
      "Underfloor Heating"
    ]
  },
  {
    id: 30,
    name: "Chimney & Fireplace",
    icon: "🧯",
    subcategories: [
      "Chimney Sweeping",
      "Chimney Lining",
      "Fireplace Installation (gas, electric, wood burner)",
      "Log Burner / Multi-fuel Stove Installation",
      "Chimney Cap & Cowl Fitting",
      "Fireplace Removal & Blocking Up",
      "Flue Installation"
    ]
  },
  {
    id: 31,
    name: "Party Planner",
    icon: "🎉",
    subcategories: [
      "Children's Party Planning",
      "Birthday Party Planning (adult)",
      "Garden Party Setup",
      "Themed Party Design & Styling",
      "Balloon Decoration & Arches",
      "Party Catering Coordination",
      "Entertainment Booking (DJs, magicians, bands)",
      "Photo Booth & Props Hire",
      "Bouncy Castle & Inflatable Hire",
      "Marquee & Gazebo Hire",
      "Table & Chair Hire",
      "Lighting & Sound Setup",
      "Party Cleanup Service",
      "Surprise Party Coordination"
    ]
  },
  {
    id: 32,
    name: "Event Management",
    icon: "🎪",
    subcategories: [
      "Wedding Planning & Coordination",
      "Corporate Event Management",
      "Funeral & Wake Arrangement",
      "Christening & Naming Ceremony",
      "Anniversary & Milestone Events",
      "Engagement Party Planning",
      "Charity & Fundraiser Events",
      "Festival & Fete Organisation",
      "Venue Sourcing & Booking",
      "Event Catering Management",
      "Florist & Floral Arrangement",
      "Event Photography & Videography",
      "Marquee & Tipi Hire (large scale)",
      "Stage & AV Equipment Hire",
      "Event Security & Stewarding",
      "Portable Toilet / Luxury Restroom Hire",
      "Event Licensing & Permits Advice"
    ]
  },
  {
    id: 33,
    name: "Aerial & Satellite",
    icon: "📡",
    subcategories: [
      "TV Aerial Installation & Repair",
      "Satellite Dish Installation (Sky, Freesat)",
      "Signal Boosting & Distribution",
      "Multi-room TV Setup",
      "Aerial Removal",
      "DAB Radio Aerial",
      "Communal System Installation (flats)"
    ]
  },
  {
    id: 34,
    name: "Asbestos Removal & Testing",
    icon: "☣️",
    requiredCertifications: ["HSE Asbestos License (MANDATORY)", "BOHS P402/P405"],
    subcategories: [
      "Asbestos Survey (management/refurbishment/demolition)",
      "Asbestos Testing & Sampling",
      "Asbestos Removal (licensed)",
      "Asbestos Encapsulation",
      "Garage Roof Removal (asbestos cement)",
      "Artex Testing (pre-removal)",
      "Asbestos Disposal & Certification"
    ]
  },
  {
    id: 35,
    name: "Scaffolding",
    icon: "🏗️",
    subcategories: [
      "Domestic Scaffolding Hire",
      "Commercial Scaffolding",
      "Tower Scaffold Hire",
      "Chimney Scaffold",
      "Roof Access Scaffold",
      "Scaffolding for Painting & Rendering",
      "Emergency Scaffold (storm damage)"
    ]
  },
  {
    id: 36,
    name: "Appliance Repair",
    icon: "🔧",
    subcategories: [
      "Washing Machine Repair",
      "Tumble Dryer Repair",
      "Dishwasher Repair",
      "Fridge & Freezer Repair",
      "Oven & Cooker Repair",
      "Microwave Repair",
      "Extractor Hood Repair",
      "Vacuum Cleaner Repair",
      "Appliance Installation (new)"
    ]
  },
  {
    id: 37,
    name: "Interior Design & Home Staging",
    icon: "🎨",
    subcategories: [
      "Full Room Design & Consultation",
      "Colour & Material Consultation",
      "Space Planning & Layout",
      "Home Staging for Sale",
      "Furniture Sourcing & Procurement",
      "Lighting Design",
      "Window Treatment Design",
      "Show Home Styling",
      "Virtual Design Consultation (remote)",
      "Virtual Room Design & 3D Renderings",
      "3D Floor Plans",
      "Mood Boards & Concept Design"
    ]
  },
  {
    id: 38,
    name: "Metalwork & Welding",
    icon: "⚒️",
    subcategories: [
      "Metal Gates & Railings",
      "Balcony & Juliet Balcony Installation",
      "Wrought Iron Work",
      "Staircase Balustrade (metal/glass)",
      "Security Grilles & Bars",
      "Bespoke Metal Furniture",
      "Structural Steelwork (RSJ, beams)",
      "Welding Repairs",
      "Fire Escape Installation"
    ]
  },
  {
    id: 39,
    name: "Curtains, Blinds & Shutters",
    icon: "🪟",
    subcategories: [
      "Curtain Supply & Fitting",
      "Made-to-Measure Curtains",
      "Roller Blinds",
      "Venetian Blinds",
      "Roman Blinds",
      "Vertical Blinds",
      "Plantation Shutters",
      "Motorised Blinds & Curtains",
      "Curtain Pole & Track Fitting",
      "Commercial Window Coverings"
    ]
  },
  {
    id: 40,
    name: "Surveying & Architecture",
    icon: "📋",
    subcategories: [
      "Home Buyer Survey (Level 2)",
      "Building Survey (Level 3)",
      "Structural Engineer Report",
      "Party Wall Survey & Agreement",
      "Architectural Drawings & Plans",
      "Planning Permission Application",
      "Building Regulations Application",
      "Measured Survey (floor plans)",
      "Damp & Timber Survey",
      "Roof Survey (drone)",
      "Energy Performance Certificate (EPC)"
    ]
  },
  {
    id: 41,
    name: "Home Network & AV",
    icon: "📶",
    subcategories: [
      "Ethernet / Cat6 Cabling",
      "Wi-Fi Mesh Network Setup",
      "Home Cinema Installation",
      "Multi-room Audio (Sonos, in-ceiling)",
      "Projector & Screen Installation",
      "Outdoor AV Setup",
      "Structured Wiring (full home)",
      "Network Cabinet / Rack Setup",
      "Smart Home Hub Integration",
      "Smart Home & Voice Control Setup (Alexa/Google)",
      "Home Wi-Fi Security & Privacy Check",
      "Smart Lighting Automation"
    ]
  },
  {
    id: 42,
    name: "Upholstery & Soft Furnishings",
    icon: "🛋️",
    subcategories: [
      "Sofa & Chair Reupholstering",
      "Dining Chair Recovery",
      "Headboard Upholstery",
      "Cushion & Cover Making",
      "Antique Furniture Restoration",
      "Boat & Caravan Upholstery",
      "Leather Repair & Restoration",
      "Commercial Seating Upholstery"
    ]
  },
  {
    id: 43,
    name: "Glazing & Glass",
    icon: "🪟",
    subcategories: [
      "Emergency Glazing (24/7 broken window)",
      "Double Glazing Repairs (misted units)",
      "Shower Screen Supply & Fit",
      "Glass Splashback Installation",
      "Mirror Cutting & Installation",
      "Glass Balustrade",
      "Stained Glass Repair / Restoration",
      "Greenhouse Glass Replacement",
      "Shopfront Glazing"
    ]
  },
  {
    id: 44,
    name: "Groundworks",
    icon: "🚜",
    subcategories: [
      "Excavation & Site Clearance",
      "Foundation Digging",
      "Land Drainage",
      "Concrete Base Laying (sheds, garages)",
      "Kerbing & Edging",
      "Retaining Wall Foundations",
      "Soil & Aggregate Supply",
      "Mini Digger Hire (with operator)",
      "Garden Levelling",
      "Septic Tank & Cesspit"
    ]
  },
  {
    id: 45,
    name: "Pet Services",
    icon: "🐾",
    subcategories: [
      "Dog Walking",
      "Pet Sitting (in-home)",
      "Dog Boarding / Kennels",
      "Cat Sitting",
      "Pet Grooming (mobile & salon)",
      "Dog Training & Behaviour",
      "Puppy Training Classes",
      "Pet Transport",
      "Pet Taxi (vet runs etc.)",
      "Doggy Day Care",
      "Pet Photography",
      "Pet First Aid / CPR Training"
    ]
  },
  {
    id: 46,
    name: "Pet Home Installations",
    icon: "🏠",
    subcategories: [
      "Dog Kennel & Run Building",
      "Cat Enclosure / Catio Building",
      "Pet-proof Fencing & Gates",
      "Dog Flap Installation",
      "Cat Flap Installation (microchip)",
      "Garden Pet-proofing",
      "Aviary Building",
      "Rabbit Hutch & Run Building",
      "Pond Netting (fish protection)",
      "Horse Stable & Field Shelter",
      "Chicken Coop Building"
    ]
  },
  {
    id: 47,
    name: "Veterinary & Pet Health",
    icon: "🩺",
    subcategories: [
      "Mobile Vet Home Visits",
      "Pet Vaccination",
      "Flea & Worm Treatment",
      "Pet Microchipping",
      "Pet Dental Care",
      "Pet Physiotherapy",
      "Pet Behavioural Therapy",
      "End of Life / Pet Euthanasia (home)",
      "Pet Cremation & Memorial",
      "Emergency Vet Referral"
    ]
  },
  {
    id: 48,
    name: "Industrial & Commercial Cleaning",
    icon: "🏭",
    subcategories: [
      "Office Cleaning (regular contract)",
      "Warehouse Cleaning",
      "Factory & Plant Cleaning",
      "Retail & Shop Cleaning",
      "Restaurant & Kitchen Deep Clean",
      "Pub & Bar Cleaning",
      "School & Nursery Cleaning",
      "Gym & Leisure Centre Cleaning",
      "Medical & Dental Practice Cleaning",
      "Care Home Cleaning",
      "Church & Community Hall Cleaning",
      "Construction Site Cleanup",
      "Graffiti Removal",
      "Biohazard & Trauma Cleaning",
      "Crime Scene Cleaning",
      "Needle & Sharps Removal",
      "Industrial Pressure Washing",
      "Cladding & Facade Cleaning",
      "Car Park Cleaning",
      "Bin Store / Refuse Area Cleaning",
      "Air Duct & Ventilation Cleaning",
      "Commercial Kitchen Extract Cleaning",
      "Tank & Vessel Cleaning",
      "Specialist Decontamination"
    ]
  },
  {
    id: 49,
    name: "Specialist Cleaning",
    icon: "🧽",
    subcategories: [
      "Pressure Washing (domestic — driveways, patios, decking)",
      "Roof Cleaning & Moss Treatment",
      "Render Cleaning (K-Rend, silicone)",
      "Conservatory Roof Cleaning",
      "Solar Panel Cleaning",
      "Gutter Cleaning (specialist)",
      "Stone & Brick Cleaning",
      "Swimming Pool Cleaning",
      "Hot Tub Cleaning & Water Treatment",
      "Wheelie Bin Cleaning",
      "Leather Cleaning & Conditioning",
      "Persian / Oriental Rug Cleaning",
      "Fire & Smoke Damage Cleaning",
      "Flood Damage Cleanup",
      "Odour Removal (pets, smoke, damp)"
    ]
  },
  {
    id: 50,
    name: "Car Detailing & Valeting",
    icon: "🚗",
    subcategories: [
      "Mobile Car Valeting",
      "Full Car Detailing (paint correction, ceramic coating)",
      "Interior Deep Clean & Sanitisation",
      "Leather Cleaning & Conditioning",
      "Engine Bay Cleaning",
      "Alloy Wheel Refurbishment",
      "Headlight Restoration",
      "Paint Protection Film (PPF)",
      "Ceramic Coating Application",
      "Scratch & Swirl Removal",
      "Windscreen Chip Repair",
      "Dent Removal (PDR — paintless)",
      "Convertible Roof Cleaning & Reproofing",
      "Fleet Valeting (commercial)"
    ]
  },
  {
    id: 51,
    name: "Vehicle Repair & Maintenance",
    icon: "🔧",
    subcategories: [
      "Mobile Mechanic",
      "MOT Preparation & Repair",
      "Car Servicing (home visit)",
      "Oil & Filter Change",
      "Interim & Full Servicing",
      "Brake Repair & Replacement",
      "Clutch Repair & Replacement",
      "Exhaust Repair & Replacement",
      "Battery Replacement & Jump Start",
      "Tyre Fitting (mobile)",
      "New Tyre Supply & Fitting",
      "Part-Worn Tyre Supply & Fitting",
      "Puncture Repair",
      "Wheel Balancing & Alignment",
      "Air Conditioning Regas",
      "Brake Fluid Flush",
      "Coolant Change",
      "Engine Carbon Cleaning",
      "Diagnostic Fault Finding",
      "Pre-Purchase Inspection",
      "Seasonal Safety Check (Winter/Summer)",
      "Headlight Restoration",
      "Timing Belt / Chain Replacement",
      "Suspension & Steering Repair",
      "Welding & Bodywork Repair",
      "Windscreen Replacement",
      "Breakdown Recovery"
    ]
  },
  {
    id: 52,
    name: "Vehicle Bodywork & Cosmetic",
    icon: "🎨",
    subcategories: [
      "Car Body Repair (bumper, panel)",
      "Car Spraying & Respraying",
      "SMART Repair (small area)",
      "Vehicle Wrapping (full & partial)",
      "Sign Writing & Vehicle Graphics",
      "Window Tinting",
      "Number Plate Supply & Fitting",
      "Rust Treatment & Prevention",
      "Classic Car Restoration"
    ]
  },
  {
    id: 53,
    name: "Garage & Driveway",
    icon: "🏠",
    subcategories: [
      "Garage Door Installation & Repair",
      "Garage Conversion (to workshop/gym)",
      "EV Charger Installation (home)",
      "Driveway Resurfacing (tarmac, resin, block)",
      "Carport Installation",
      "Vehicle Crossover / Dropped Kerb Application",
      "Garage Flooring (epoxy, tile)",
      "Workshop Electrical Fit-out",
      "Motorcycle Shed / Secure Storage",
      "Jet Washing & Driveway Cleaning"
    ]
  },
  {
    id: 54,
    name: "Vehicle Recovery & Roadside",
    icon: "🚨",
    subcategories: [
      "Breakdown Recovery (24/7)",
      "Accident Recovery & Towing",
      "Flatbed Transport (prestige/classic cars)",
      "Motorcycle Recovery",
      "Van & Light Commercial Recovery",
      "HGV & Heavy Vehicle Recovery",
      "Stuck Vehicle Extraction (mud, snow, ditch)",
      "Lock-out / Keys Locked in Car",
      "Fuel Drain (wrong fuel)",
      "Jump Start Service (mobile)",
      "Tyre Change (roadside)",
      "Long Distance Vehicle Transport",
      "Scrap Car Collection & Disposal",
      "DVLA / End-of-Life Vehicle Certificate"
    ]
  },
  {
    id: 55,
    name: "Disaster Recovery & Restoration",
    icon: "🌊",
    subcategories: [
      "Flood Damage Restoration",
      "Fire & Smoke Damage Restoration",
      "Storm Damage Repair (emergency)",
      "Structural Drying & Dehumidification",
      "Sewage Cleanup & Sanitisation",
      "Mould Remediation (post-flood)",
      "Insurance Claim Support & Surveying",
      "Contents Restoration (furniture, documents)",
      "Emergency Board-up & Securing",
      "Roof Tarpaulin (emergency cover)",
      "Subsidence Assessment & Repair",
      "Escape of Water Response",
      "Commercial Disaster Recovery"
    ]
  },
  {
    id: 56,
    name: "Data & Tech Recovery",
    icon: "💾",
    subcategories: [
      "Hard Drive Data Recovery",
      "Phone Data Recovery",
      "CCTV Footage Recovery",
      "RAID / Server Data Recovery",
      "Water / Fire Damaged Device Recovery",
      "Laptop & PC Repair",
      "Smart Home System Reset & Recovery",
      "Network Restoration (post-outage)"
    ]
  },
  {
    id: 57,
    name: "Home & Domestic Removals",
    icon: "🚚",
    subcategories: [
      "Full House Move (local <50 miles)",
      "Full House Move (national)",
      "Flat / Apartment Move",
      "Part Load / Shared Van Move",
      "Student Move (term-time)",
      "Pensioner / Assisted Move",
      "Single Item Collection & Delivery",
      "Packing Service (full / part)",
      "Unpacking & Home Setup",
      "Furniture Disassembly & Reassembly",
      "Wardrobe & Packaging Material Supply",
      "Short-Term Storage (between moves)",
      "Long-Term Storage",
      "Overseas Removals (container / groupage)",
      "European Removals",
      "Pet Transport (during move)"
    ]
  },
  {
    id: 58,
    name: "Office & Commercial Removals",
    icon: "🏢",
    subcategories: [
      "Office Relocation (small / SME)",
      "Corporate Office Move (100+ desks)",
      "IT Infrastructure Relocation (servers, comms)",
      "Retail / Shop Refit Removal",
      "Warehouse & Industrial Move",
      "Medical / Dental Practice Move",
      "School & University Move",
      "Gym & Heavy Equipment Relocation",
      "Restaurant / Commercial Kitchen Move",
      "Lab Equipment Relocation",
      "Archive & Document Storage Transfer",
      "Modular Building / Portacabin Move"
    ]
  },
  {
    id: 59,
    name: "Specialist & Heavy Item Removals",
    icon: "🎹",
    subcategories: [
      "Piano Moving",
      "Safe Moving & Installation",
      "Pool Table Moving",
      "Hot Tub / Jacuzzi Moving",
      "Antique & Fine Art Transport",
      "Grandfather Clock Moving",
      "Stairlift Removal & Disposal",
      "Mobility Equipment Removal",
      "Gun Cabinet Removal (licensed)",
      "Aquarium Moving",
      "Sculpture & Large Artwork Transport",
      "Wine Cellar / Collection Transport"
    ]
  },
  {
    id: 60,
    name: "House & Garden Clearance",
    icon: "🗑️",
    subcategories: [
      "Full House Clearance",
      "Deceased Estate Clearance",
      "Hoarder Property Clearance",
      "Loft Clearance",
      "Garage Clearance",
      "Shed Clearance",
      "Garden Clearance & Green Waste",
      "Cellar / Basement Clearance",
      "Pre-Sale Property Clearance",
      "Landlord End-of-Let Clearance",
      "Probate Clearance (valuation + removal)",
      "Charity Donation Sorting & Drop-off"
    ]
  },
  {
    id: 61,
    name: "Waste & Skip Services",
    icon: "🚛",
    subcategories: [
      "General Rubbish Removal (van load)",
      "Builders Waste Removal",
      "Skip Hire (mini, midi, large, RoRo)",
      "Grab Lorry Hire",
      "Wait & Load Service",
      "Mattress Collection & Disposal",
      "White Goods Collection & Recycling",
      "Sofa & Furniture Disposal",
      "Fly-Tipping Cleanup",
      "Confidential Shredding & Disposal",
      "WEEE / Electronic Waste Disposal",
      "Tyre Disposal",
      "Commercial Waste Collection (contract)"
    ]
  },
  {
    id: 62,
    name: "Hazardous Material Removal",
    icon: "☢️",
    subcategories: [
      "Asbestos Survey & Testing",
      "Licensed Asbestos Removal",
      "Oil Tank Decommissioning & Removal",
      "Lead Paint Removal",
      "Chemical Waste Disposal",
      "Needle & Sharps Clearance",
      "Japanese Knotweed Removal",
      "Invasive Plant Removal (giant hogweed etc.)",
      "Contaminated Soil Removal",
      "Underground Storage Tank Removal"
    ]
  },
  {
    id: 63,
    name: "Demolition & Strip-Out",
    icon: "🏗️",
    subcategories: [
      "Internal Strip-Out (kitchens, bathrooms)",
      "Conservatory Demolition & Removal",
      "Garage Demolition",
      "Wall Removal (internal, non-structural)",
      "Chimney Removal (breast or stack)",
      "Concrete / Hardstanding Breaking & Removal",
      "Swimming Pool Infill & Removal",
      "Fence & Decking Removal",
      "Outbuilding Demolition",
      "Patio / Driveway Uplift",
      "Partial / Selective Demolition (commercial)"
    ]
  },
  {
    id: 64,
    name: "Tool & Equipment Hire",
    icon: "🛠️",
    subcategories: [
      "Power Tools (drills, saws, sanders)",
      "Garden Machinery (lawnmowers, hedge trimmers)",
      "Construction Equipment (mixers, generators)",
      "Access Equipment (ladders, towers)",
      "Cleaning Equipment (pressure washers, carpet cleaners)",
      "Heating & Drying Equipment",
      "Surveying Equipment"
    ]
  },
  {
    id: 65,
    name: "Entertainers",
    icon: "🎤",
    subcategories: [
      "Solo Singers & Vocalists",
      "Acoustic Duos & Trios",
      "Live Bands (Rock, Pop, Jazz, Soul)",
      "Tribute Acts",
      "DJs (Club, Wedding, Party)",
      "Comedians",
      "Magicians & Illusionists",
      "Dancers & Dance Troupes",
      "Fire & Stunt Performers",
      "Impersonators & Lookalikes",
      "Karaoke Hosts",
      "Pub Quiz Masters",
      "Children’s Entertainers",
      "Bouncy Castle & Inflatable Hire",
      "Drag Acts",
      "MCs & Event Hosts"
    ]
  },
  {
    id: 66,
    name: "OnDemand & Lifestyle",
    icon: "🤝",
    subcategories: [
      "Flat Pack Furniture Assembly",
      "Shelf & Picture Hanging",
      "Light Bulb & Battery Replacement",
      "Curtain & Blind Fitting",
      "Willing to Talk / Good Listener",
      "Tech Support for Seniors",
      "Reading / Letter Writing Help",
      "Accompanied Shopping / Appointments",
      "Grocery Shopping & Delivery",
      "Parcel Collection / Returns",
      "Waiting in for Deliveries",
      "Queue Standing",
      "Leaf Raking / Snow Shovelling",
      "Watering Plants (Holiday cover)",
      "Jet Washing Driveways"
    ]
  },
  {
    id: 67,
    name: "Decluttering & Home Sorting",
    icon: "📦",
    subcategories: [
      "Wardrobe & Clothes Sorting",
      "Kitchen & Cupboard Organizing",
      "Home Office & Paperwork Help",
      "Garage & Shed Tidying",
      "Moving House Unpacking Help",
      "Photo & Computer File Organizing"
    ]
  },
  {
    id: 68,
    name: "Eco-Home & Healthy Living",
    icon: "🍃",
    subcategories: [
      "Save Energy & Lower Bills Advice",
      "Stop Damp & Mould Advice",
      "Healthy Home & Air Quality Check",
      "Room Layout & Feng Shui",
      "Indoor Plants & Natural Light Design",
      "Recycling & Zero Waste Help"
    ]
  },
  {
    id: 69,
    name: "Home Help & Personal Errands",
    icon: "🧺",
    subcategories: [
      "Home Cooking & Meal Prep",
      "Personal Shopping & Errands",
      "House Sitting & Plant Watering",
      "Tech Support for Seniors",
      "Ironing & Laundry Service",
      "Waiting in for Deliveries"
    ]
  },
  {
    id: 70,
    name: "Marketing & Growing Your Business",
    icon: "📈",
    subcategories: [
      "Get Found on Google (Local SEO)",
      "Facebook & Instagram Management",
      "Google & Facebook Ad Help",
      "Writing for Websites & Blogs",
      "Email Newsletters",
      "Managing Customer Reviews"
    ]
  },
  {
    id: 71,
    name: "Online Lessons & Tutoring",
    icon: "🎓",
    subcategories: [
      "School & Exam Tutoring",
      "Learning a Language",
      "Learn to Code / Computer Skills",
      "Music & Instrument Lessons",
      "Public Speaking & Confidence",
      "Online Fitness & Yoga",
      "Online Cooking Lessons"
    ]
  },
  {
    id: 72,
    name: "Logo, Design & Websites",
    icon: "🎨",
    subcategories: [
      "Logo & Brand Design",
      "Building a Website",
      "Social Media Pictures & Posts",
      "Video Editing for Social Media",
      "Drawing & Digital Art",
      "Photo Editing & Fixing"
    ]
  },
  {
    id: 73,
    name: "Admin & Virtual Assistant",
    icon: "💻",
    subcategories: [
      "Virtual Assistant (General Help)",
      "Typing & Data Entry",
      "Bookkeeping & Basic Accounts",
      "Researching Information",
      "Answering Emails & Customer Help",
      "Checking Contracts & Legal Advice"
    ]
  },
  {
    id: 74,
    name: "Health, Fitness & Wellbeing",
    icon: "🧘",
    subcategories: [
      "Personal Training (Home, Outdoor, Online)",
      "Yoga & Pilates (Private or Group)",
      "Massage Therapy (Sports, Swedish, Deep Tissue)",
      "Nutrition & Healthy Eating Advice",
      "Counselling & Mental Health Support",
      "Physiotherapy & Injury Rehab",
      "Meditation & Mindfulness Sessions",
      "Sports Coaching (Running, Swimming, etc.)",
      "First Aid & CPR Training"
    ]
  },
  {
    id: 75,
    name: "Beauty & Mobile Spa",
    icon: "💅",
    subcategories: [
      "Mobile Hairdressing & Styling",
      "Nails, Manicure & Pedicure",
      "Facials & Skincare Treatments",
      "Makeup Artist (Events & Weddings)",
      "Waxing & Body Treatments",
      "Eye & Brow Treatments",
      "Mobile Beauty & Spa Packages"
    ]
  },
  {
    id: 76,
    name: "Care & Home Support",
    icon: "❤️",
    subcategories: [
      "Elderly Care & Home Assistance",
      "Companion Visits & Sitting",
      "Mobility Support & Equipment Help",
      "Respite Care for Families",
      "Post-Hospital Recovery Support",
      "Specialist Care (Dementia, etc.)"
    ]
  },
  {
    id: 77,
    name: "Estate Agent & Landlord Services",
    icon: "🏠",
    subcategories: [
      "Residential Sales",
      "Residential Lettings",
      "Property Management",
      "Tenant Sourcing & Vetting",
      "Rent Collection & Arrears",
      "Property Inspections",
      "Inventory & Check-in/out",
      "EPC & Safety Compliance",
      "Holiday Let / Airbnb Management",
      "Commercial Property Services",
      "Block Management",
      "HMO Management & Compliance",
      "Landlord Advisory Services"
    ]
  },
  {
    id: 78,
    name: "Driving Instructors",
    icon: "🚗",
    subcategories: [
      "Manual Driving Lessons",
      "Automatic Driving Lessons",
      "Intensive Driving Courses",
      "Pass Plus Course",
      "Motorway Driving Lessons",
      "Refresher Lessons",
      "Theory Test Support",
      "Taxi Driver Training",
      "Fleet Driver Training"
    ]
  },
  {
    id: 79,
    name: "Childcare & Babysitting",
    icon: "👶",
    subcategories: [
      "Occasional Babysitting",
      "Regular Nanny Services",
      "After-School Care",
      "School Run Service",
      "Emergency Childcare",
      "Holiday Childcare",
      "Newborn / Night Nanny",
      "Special Educational Needs (SEN) Care",
      "Maternity Nurse"
    ]
  },
  {
    id: 80,
    name: "Legal Services (Solicitors)",
    icon: "⚖️",
    subcategories: [
      "Conveyancing (Buying/Selling)",
      "Wills, Trusts & Probate",
      "Family & Divorce Law",
      "Employment Law",
      "Personal Injury Claims",
      "Immigration Services",
      "Commercial & Business Law",
      "Landlord & Tenant Disputes",
      "Power of Attorney"
    ]
  },
  {
    id: 81,
    name: "Financial Services",
    icon: "💰",
    subcategories: [
      "Mortgage Advice & Brokerage",
      "Pension & Retirement Planning",
      "Investment Advice",
      "Life Insurance & Protection",
      "Debt Management & Advice",
      "Tax Planning",
      "Equity Release",
      "Business Finance & Loans"
    ]
  },
  {
    id: 82,
    name: "Holistic & Alternative Health",
    icon: "✨",
    subcategories: [
      "Acupuncture",
      "Reiki & Energy Healing",
      "Hypnotherapy",
      "Aromatherapy",
      "Reflexology",
      "Herbalism & Naturopathy",
      "Crystal Healing",
      "Homeopathy",
      "Sound Healing / Therapy"
    ]
  },
  {
    id: 83,
    name: "Taxi & Transport",
    icon: "🚕",
    requiredCertifications: [], // Main cert logic managed by subcategories
    subcategoryCertifications: {
      "School Runs": ["Enhanced DBS Check", "PHV License"],
      "Hospital & Medical Transport": ["Enhanced DBS Check", "PHV License"],
      "Wheelchair Accessible Transport": ["Enhanced DBS Check", "PHV License"],
      "Airport Transfers": ["PHV License", "Hire & Reward Insurance"],
      "Party & Night Out": ["PHV License", "Hire & Reward Insurance"],
      "Executive & Corporate": ["PHV License", "Hire & Reward Insurance"],
      "Minibus & Group Hire": ["PHV License", "Minibus Operator License"],
      "Courier & Parcel Delivery": ["Goods in Transit / Courier Insurance"],
      "Pet-Friendly Transport": ["DEFRA Animal Transport Authorization"],
      "Long Distance": ["PHV License", "Hire & Reward Insurance"]
    },
    subcategories: [
      "Airport Transfers",
      "Wedding Cars",
      "Party & Night Out",
      "Day Trips & Excursions",
      "Executive & Corporate",
      "Wheelchair Accessible Transport",
      "Minibus & Group Hire",
      "School Runs",
      "Hospital & Medical Transport",
      "Funeral Cars",
      "Courier & Parcel Delivery",
      "Pet-Friendly Transport",
      "Long Distance"
    ]
  }
];

export const TRADE_CATEGORIES = [...UNSORTED_TRADE_CATEGORIES].sort((a, b) => a.name.localeCompare(b.name));

export const URGENCY_LEVELS = [
  { id: "emergency", name: "Emergency", description: "Within 24 hours", multiplier: 1.5 },
  { id: "asap", name: "ASAP", description: "Within 2-3 days", multiplier: 1.2 },
  { id: "this_week", name: "This Week", description: "Next 7 days", multiplier: 1.1 },
  { id: "flexible", name: "Flexible", description: "No rush", multiplier: 1.0 },
  { id: "specific_date", name: "Specific Date", description: "Choose a date", multiplier: 1.0 },
];

export const PROFESSIONAL_BADGES = [
  { id: "no_call_out", name: "No call out charges", icon: "ShieldCheck", color: "blue" },
  { id: "emergency_24_7", name: "Emergency 24/7", icon: "Clock", color: "red" },
  { id: "free_estimates", name: "Free estimates", icon: "FileText", color: "green" },
  { id: "fully_insured", name: "Fully insured", icon: "Shield", color: "indigo" },
  { id: "guaranteed_work", name: "Guaranteed work", icon: "CheckCircle", color: "amber" },
  { id: "local_business", name: "Local business", icon: "MapPin", color: "slate" },
  { id: "senior_discount", name: "Senior discount", icon: "Heart", color: "rose" },
  { id: "id_verified", name: "ID Verified", icon: "ShieldCheck", color: "blue" },
  { id: "community_hero", name: "Community Hero", icon: "Star", color: "yellow" }
];

export const BLOCKED_DOMAINS = [
  "temp-mail.org", "guerrillamail.com", "sharklasers.com", "mailinator.com", 
  "dispostable.com", "10minutemail.com", "tempmail.net", "yopmail.com",
  "getnada.com", "maildrop.cc", "protonmail.com" // Optional: some platforms block proton for high-risk signups
];


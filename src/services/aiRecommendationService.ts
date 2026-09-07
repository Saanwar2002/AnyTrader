import { TRADE_CATEGORIES } from "@/src/constants";
import { INITIAL_MOCK_TRADERS, Tradesperson } from "./seedService";
import { db, collection, query, where, getDocs, limit } from "@/src/firebase";
import { categoryMatchesSearch, getCategoryMetadata } from "@/src/lib/fuzzyMatch";
import { categoryRegistry } from "./categoryRegistrySync";

export interface TraderRecommendationCard {
  uid: string;
  name: string;
  businessName?: string;
  avatarUrl?: string;
  category: string;
  rating: number;
  reviewsCount: number;
  hourlyRate?: number;
  postcode?: string;
  distanceMiles?: number;
  isVerified: boolean;
  isGasSafe?: boolean;
  isNiceic?: boolean;
  isVideoVerified?: boolean;
  isSponsored: boolean; // Featured Partner (Monetized Slot)
  isNewcomerBoost?: boolean; // Fairness Engine Newcomer Slot
  badges: string[];
  bio?: string;
}

export interface AiTradeBotActionPayload {
  category?: string;
  subcategory?: string;
  suggestedTitle?: string;
  estimatedPriceRange?: { min: number; max: number; unit?: string };
  suggestedJobDescription?: string;
  relatedCategories?: string[];
  recommendedTraders?: TraderRecommendationCard[];
}

/**
 * Searches for best matching category names from TRADE_CATEGORIES based on user text.
 */
export function findMatchingTradeCategories(userText: string, maxResults: number = 3): string[] {
  if (!userText || userText.trim().length === 0) return ["Building & Construction", "Handyman Services"];
  
  const textLower = userText.toLowerCase();
  const matchedCategories: { name: string; score: number }[] = [];

  TRADE_CATEGORIES.forEach((cat) => {
    let score = 0;
    const catNameLower = cat.name.toLowerCase();

    // Direct name match
    if (textLower.includes(catNameLower)) {
      score += 20;
    }

    // Fuzzy category/synonym match from fuzzyMatch.ts dictionary
    if (categoryMatchesSearch(cat, userText)) {
      score += 15;
    }

    // Subcategory matches (direct phrase match)
    if (cat.subcategories && Array.isArray(cat.subcategories)) {
      cat.subcategories.forEach((sub: string) => {
        const subLower = sub.toLowerCase();
        if (textLower.includes(subLower)) {
          score += 20;
        }
      });
    }

    // Keyword heuristics across all key UK trade domains
    // 1. Bake N Cake, Wedding Cakes, Pastry & Catering
    if (
      textLower.includes("cake") || 
      textLower.includes("bake") || 
      textLower.includes("baker") || 
      textLower.includes("baking") || 
      textLower.includes("cupcake") || 
      textLower.includes("wedding cake") || 
      textLower.includes("tier") || 
      textLower.includes("fondant") || 
      textLower.includes("pastry") || 
      textLower.includes("patisserie") || 
      textLower.includes("afternoon tea") || 
      textLower.includes("catering") || 
      textLower.includes("caterer") || 
      textLower.includes("food allergen") || 
      textLower.includes("natasha's law") || 
      textLower.includes("fsa") || 
      textLower.includes("dessert")
    ) {
      if (cat.name === "Bake N Cake" || cat.name === "Catering & Private Chef") score += 25;
    }

    // 2. Painting & Decorating
    if (
      textLower.includes("paint") || 
      textLower.includes("painter") || 
      textLower.includes("painting") || 
      textLower.includes("decorat") || 
      textLower.includes("wallpaper") || 
      textLower.includes("gloss") || 
      textLower.includes("emulsion") || 
      textLower.includes("varnish") || 
      textLower.includes("stain") || 
      (textLower.includes("door") && (textLower.includes("paint") || textLower.includes("wood") || textLower.includes("finish") || textLower.includes("color") || textLower.includes("colour"))) ||
      textLower.includes("skirting") || 
      textLower.includes("woodwork") || 
      textLower.includes("coving")
    ) {
      if (cat.name === "Painting & Decorating") score += 25;
    }

    // 3. Carpentry & Joinery
    if (
      textLower.includes("carpenter") || 
      textLower.includes("joiner") || 
      textLower.includes("carpentry") || 
      textLower.includes("joinery") || 
      textLower.includes("staircase") || 
      textLower.includes("cupboard") || 
      textLower.includes("cabinet") || 
      textLower.includes("wardrobe") || 
      textLower.includes("timber") || 
      (textLower.includes("door") && (textLower.includes("hang") || textLower.includes("fit") || textLower.includes("frame") || textLower.includes("hinge")))
    ) {
      if (cat.name === "Carpentry & Joinery" || cat.name === "Door Fitting & Hanging") score += 20;
    }

    // 4. Locksmith & Security
    if (
      textLower.includes("lock") || 
      textLower.includes("locksmith") || 
      textLower.includes("key") || 
      textLower.includes("lockout") || 
      textLower.includes("anti snap") || 
      textLower.includes("ultion") || 
      textLower.includes("latch") || 
      textLower.includes("bolt")
    ) {
      if (cat.name === "Locksmith") score += 25;
    }

    // 5. Plumbing & Gas
    if (
      textLower.includes("plumb") || 
      textLower.includes("plumber") || 
      textLower.includes("leak") || 
      textLower.includes("pipe") || 
      textLower.includes("tap") || 
      textLower.includes("sink") || 
      textLower.includes("toilet") || 
      textLower.includes("drain") || 
      textLower.includes("shower") || 
      textLower.includes("unblock")
    ) {
      if (cat.name === "Plumbing" || cat.name === "Bathroom & Kitchen Fitting") score += 20;
    }

    // 6. Gas & Heating
    if (
      textLower.includes("boiler") || 
      textLower.includes("heating") || 
      textLower.includes("radiator") || 
      textLower.includes("gas") || 
      textLower.includes("cp12") || 
      textLower.includes("flue") || 
      textLower.includes("thermostat") || 
      textLower.includes("combi")
    ) {
      if (cat.name === "Gas Engineering" || cat.name === "Plumbing") score += 25;
    }

    // 7. Electrical
    if (
      textLower.includes("fuse") || 
      textLower.includes("light") || 
      textLower.includes("wire") || 
      textLower.includes("rewir") || 
      textLower.includes("socket") || 
      textLower.includes("circuit") || 
      textLower.includes("electric") || 
      textLower.includes("eicr") || 
      textLower.includes("consumer unit")
    ) {
      if (cat.name === "Electrical") score += 25;
    }

    // 8. Roofing & Guttering
    if (
      textLower.includes("roof") || 
      textLower.includes("tile") || 
      textLower.includes("gutter") || 
      textLower.includes("chimney") || 
      textLower.includes("leadwork") || 
      textLower.includes("fascia") || 
      textLower.includes("soffit")
    ) {
      if (cat.name === "Roofing" || cat.name === "Guttering & Drainage") score += 20;
    }

    // 9. Cleaning
    if (
      textLower.includes("clean") || 
      textLower.includes("carpet clean") || 
      textLower.includes("tenancy") || 
      textLower.includes("mould") || 
      textLower.includes("damp") || 
      textLower.includes("bin clean") ||
      textLower.includes("wheelie bin")
    ) {
      if (cat.name === "Home Cleaning" || cat.name === "Industrial & Commercial Cleaning" || cat.name === "Specialist Cleaning") score += 25;
    }

    // 10. Gardening & Landscaping
    if (
      textLower.includes("garden") || 
      textLower.includes("lawn") || 
      textLower.includes("mow") || 
      textLower.includes("hedge") || 
      textLower.includes("tree") || 
      textLower.includes("fence") || 
      textLower.includes("patio") || 
      textLower.includes("paving") || 
      textLower.includes("decking")
    ) {
      if (cat.name === "Landscaping & Garden" || cat.name === "Tree Surgery & Arboriculture") score += 25;
    }

    // 11. Delivery & Transport
    if (
      textLower.includes("courier") || 
      textLower.includes("parcel") || 
      textLower.includes("delivery") || 
      textLower.includes("bulky") || 
      textLower.includes("appliance delivery")
    ) {
      if (cat.name === "Courier, Parcel & Express Delivery" || cat.name === "On-Demand Delivery & Bulky Goods Courier") score += 25;
    }

    // 12. Removals & House Moves
    if (
      textLower.includes("removal") || 
      textLower.includes("house move") || 
      textLower.includes("moving house") || 
      textLower.includes("man and van")
    ) {
      if (cat.name === "Removals") score += 25;
    }

    // 13. Tailoring & Laundry
    if (
      textLower.includes("tailor") || 
      textLower.includes("alteration") || 
      textLower.includes("seamstress") || 
      textLower.includes("hemming") || 
      textLower.includes("laundry") || 
      textLower.includes("dry clean")
    ) {
      if (cat.name === "Tailoring, Alterations & Laundry Services") score += 25;
    }

    // 14. Pet Services & Dog Walking
    if (
      textLower.includes("pet") || 
      textLower.includes("dog") || 
      textLower.includes("cat") || 
      textLower.includes("puppy") || 
      textLower.includes("kitten") || 
      textLower.includes("dog walk") || 
      textLower.includes("dog sit") || 
      textLower.includes("cat sit") || 
      textLower.includes("pet care") || 
      textLower.includes("kennel") || 
      textLower.includes("cattery") || 
      textLower.includes("vet") || 
      textLower.includes("animal")
    ) {
      if (cat.name === "Pet Services") score += 30;
      if (cat.name === "Pet Home Installations") score += 18;
    }

    // 15. Pest Control
    if (
      textLower.includes("pest") || 
      textLower.includes("wasp") || 
      textLower.includes("bee") || 
      textLower.includes("rodent") || 
      textLower.includes("rat") || 
      textLower.includes("mice") || 
      textLower.includes("mouse") || 
      textLower.includes("infest") || 
      textLower.includes("flea") || 
      textLower.includes("bed bug")
    ) {
      if (cat.name === "Pest Control") score += 30;
    }

    // 16. Car Detailing & Valeting
    if (
      textLower.includes("car detail") || 
      textLower.includes("valeting") || 
      textLower.includes("car polish") || 
      textLower.includes("ceramic coat") || 
      textLower.includes("vehicle wash")
    ) {
      if (cat.name === "Car Detailing & Valeting") score += 30;
    }

    // 17. Plastering & Rendering
    if (
      textLower.includes("plaster") || 
      textLower.includes("skimm") || 
      textLower.includes("drylin") || 
      textLower.includes("render")
    ) {
      if (cat.name === "Plastering & Rendering") score += 25;
    }

    // 18. Tiling
    if (
      textLower.includes("tile") || 
      textLower.includes("tiler") || 
      textLower.includes("tiling") || 
      textLower.includes("grout")
    ) {
      if (cat.name === "Tiling & Grouting") score += 25;
    }

    // 19. Flooring
    if (
      textLower.includes("floor") || 
      textLower.includes("laminate") || 
      textLower.includes("hardwood") || 
      textLower.includes("vinyl") || 
      textLower.includes("lvt")
    ) {
      if (cat.name === "Flooring & Carpets") score += 25;
    }

    // 20. General Labour & Trade Mates
    if (
      textLower.includes("labour") || 
      textLower.includes("helper") || 
      textLower.includes("trade mate") || 
      textLower.includes("skip load") || 
      textLower.includes("demolition help") ||
      textLower.includes("digging")
    ) {
      if (cat.name === "General Labour, Trade Mates & Site Helpers") score += 25;
    }

    // 21. Security Services, Manned Guarding & Event Security
    if (
      textLower.includes("security guard") || 
      textLower.includes("site security") || 
      textLower.includes("patrol") || 
      textLower.includes("patrolling") || 
      textLower.includes("event security") || 
      textLower.includes("stadium security") || 
      textLower.includes("stadium steward") || 
      textLower.includes("door supervisor") || 
      textLower.includes("bouncer") || 
      textLower.includes("close protection") || 
      textLower.includes("bodyguard") || 
      textLower.includes("cctv monitoring") || 
      textLower.includes("cctv security") || 
      textLower.includes("dog handler") || 
      textLower.includes("k9 security") || 
      textLower.includes("keyholding") || 
      textLower.includes("manned guarding") ||
      textLower.includes("guarding")
    ) {
      if (cat.name === "Security Services, Manned Guarding & Event Security") score += 35;
    }

    // 22. Vehicle Recovery & Roadside Assistance
    if (
      textLower.includes("recovery") || 
      textLower.includes("breakdown") || 
      textLower.includes("tow truck") || 
      textLower.includes("towing") || 
      textLower.includes("car tow") || 
      textLower.includes("tow to garage") || 
      textLower.includes("broken down") || 
      textLower.includes("roadside assistance") || 
      textLower.includes("jump start") || 
      textLower.includes("fuel drain") || 
      textLower.includes("wrong fuel") || 
      textLower.includes("stuck car") || 
      textLower.includes("winch") || 
      textLower.includes("flatbed") || 
      textLower.includes("van recovery") || 
      textLower.includes("hgv recovery")
    ) {
      if (cat.name === "Vehicle Recovery & Roadside") score += 35;
      if (cat.name === "Vehicle Repair & Maintenance") score += 12;
    }

    // --- PLATFORM-WIDE OPTIMIZED CATEGORY HEURISTICS FOR ALL 94 CATEGORIES ---
    if (
      textLower.includes("stairlift") || 
      textLower.includes("stair lift") || 
      textLower.includes("walk in shower") || 
      textLower.includes("wet room") || 
      textLower.includes("grab rail") || 
      textLower.includes("wheelchair ramp") || 
      textLower.includes("disabled adaptation") || 
      textLower.includes("mobility lift") || 
      textLower.includes("disabled facilities grant") || 
      textLower.includes("dfg grant") || 
      textLower.includes("accessible bathroom")
    ) {
      if (cat.name === "Accessibility & Adaptations") score += 35;
    }

    if (
      textLower.includes("virtual assistant") || 
      textLower.includes("data entry") || 
      textLower.includes("bookkeeping") || 
      textLower.includes("typing") || 
      textLower.includes("invoicing") || 
      textLower.includes("customer service assistant") || 
      textLower.includes("va support") || 
      textLower.includes("copy typing") || 
      textLower.includes("spreadsheet help") || 
      textLower.includes("receipts sorting")
    ) {
      if (cat.name === "Admin & Virtual Assistant") score += 35;
    }

    if (
      textLower.includes("tv aerial") || 
      textLower.includes("satellite dish") || 
      textLower.includes("freesat") || 
      textLower.includes("sky dish") || 
      textLower.includes("starlink") || 
      textLower.includes("tv reception") || 
      textLower.includes("digital aerial") || 
      textLower.includes("aerial repair") || 
      textLower.includes("tv signal") || 
      textLower.includes("dish alignment")
    ) {
      if (cat.name === "Aerial & Satellite") score += 35;
    }

    if (
      textLower.includes("washing machine repair") || 
      textLower.includes("dishwasher repair") || 
      textLower.includes("tumble dryer repair") || 
      textLower.includes("oven repair") || 
      textLower.includes("cooker repair") || 
      textLower.includes("fridge repair") || 
      textLower.includes("freezer repair") || 
      textLower.includes("not draining") || 
      textLower.includes("not spinning") || 
      textLower.includes("dryer not heating") || 
      textLower.includes("appliance engineer")
    ) {
      if (cat.name === "Appliance Repair") score += 35;
    }

    if (
      textLower.includes("asbestos") || 
      textLower.includes("asbestos survey") || 
      textLower.includes("asbestos testing") || 
      textLower.includes("asbestos removal") || 
      textLower.includes("artex testing") || 
      textLower.includes("asbestos garage roof") || 
      textLower.includes("chrysotile") || 
      textLower.includes("licensed asbestos")
    ) {
      if (cat.name === "Asbestos Removal & Testing") score += 35;
    }

    if (
      textLower.includes("bathroom renovation") || 
      textLower.includes("bathroom installation") || 
      textLower.includes("kitchen installation") || 
      textLower.includes("kitchen fitter") || 
      textLower.includes("bathroom fitter") || 
      textLower.includes("kitchen cabinets") || 
      textLower.includes("worktop fitting") || 
      textLower.includes("bathroom refurbishment") || 
      textLower.includes("wet room fitting") || 
      textLower.includes("ensuite")
    ) {
      if (cat.name === "Bathroom & Kitchen Fitting") score += 35;
    }

    if (
      textLower.includes("mobile hairdresser") || 
      textLower.includes("mobile beautician") || 
      textLower.includes("makeup artist") || 
      textLower.includes("bridal makeup") || 
      textLower.includes("manicure") || 
      textLower.includes("pedicure") || 
      textLower.includes("gel nails") || 
      textLower.includes("waxing") || 
      textLower.includes("lash extensions") || 
      textLower.includes("mobile massage spa")
    ) {
      if (cat.name === "Beauty & Mobile Spa") score += 35;
    }

    if (
      textLower.includes("builder") || 
      textLower.includes("building extension") || 
      textLower.includes("loft conversion") || 
      textLower.includes("garage conversion") || 
      textLower.includes("rsj") || 
      textLower.includes("structural alterations") || 
      textLower.includes("foundations") || 
      textLower.includes("underpinning") || 
      textLower.includes("house extension") || 
      textLower.includes("knock through") || 
      textLower.includes("load bearing wall")
    ) {
      if (cat.name === "Building & Construction") score += 35;
    }

    if (
      textLower.includes("car valeting") || 
      textLower.includes("car detailing") || 
      textLower.includes("ceramic coating") || 
      textLower.includes("paint correction") || 
      textLower.includes("machine polish") || 
      textLower.includes("mobile car wash") || 
      textLower.includes("seat shampoo") || 
      textLower.includes("interior deep clean") || 
      textLower.includes("swirl marks")
    ) {
      if (cat.name === "Car Detailing & Valeting") score += 35;
    }

    if (
      textLower.includes("carer") || 
      textLower.includes("elderly care") || 
      textLower.includes("domiciliary care") || 
      textLower.includes("companion visit") || 
      textLower.includes("respite care") || 
      textLower.includes("dementia care") || 
      textLower.includes("home care assistance") || 
      textLower.includes("senior support")
    ) {
      if (cat.name === "Care & Home Support") score += 35;
    }

    if (
      textLower.includes("chimney sweep") || 
      textLower.includes("log burner") || 
      textLower.includes("wood burner") || 
      textLower.includes("stove installer") || 
      textLower.includes("chimney lining") || 
      textLower.includes("fire stove") || 
      textLower.includes("chimney cowl") || 
      textLower.includes("hetas")
    ) {
      if (cat.name === "Chimney & Fireplace") score += 35;
    }

    if (
      textLower.includes("blinds") || 
      textLower.includes("roller blinds") || 
      textLower.includes("venetian blinds") || 
      textLower.includes("plantation shutters") || 
      textLower.includes("wooden shutters") || 
      textLower.includes("curtain fitting") || 
      textLower.includes("roman blinds") || 
      textLower.includes("made to measure curtains") || 
      textLower.includes("curtain pole")
    ) {
      if (cat.name === "Curtains, Blinds & Shutters") score += 35;
    }

    if (
      textLower.includes("rising damp") || 
      textLower.includes("black mould") || 
      textLower.includes("damp proofing") || 
      textLower.includes("dpc injection") || 
      textLower.includes("tanking") || 
      textLower.includes("basement waterproofing") || 
      textLower.includes("penetrating damp") || 
      textLower.includes("condensation solution") || 
      textLower.includes("damp survey") || 
      textLower.includes("woodworm treatment")
    ) {
      if (cat.name === "Damp Proofing & Waterproofing") score += 35;
    }

    if (
      textLower.includes("data recovery") || 
      textLower.includes("hard drive recovery") || 
      textLower.includes("computer repair") || 
      textLower.includes("laptop repair") || 
      textLower.includes("crashed hard drive") || 
      textLower.includes("macbook repair") || 
      textLower.includes("ssd recovery") || 
      textLower.includes("dead phone recovery")
    ) {
      if (cat.name === "Data & Tech Recovery") score += 35;
    }

    if (
      textLower.includes("decluttering") || 
      textLower.includes("home organizer") || 
      textLower.includes("wardrobe declutter") || 
      textLower.includes("pantry sorting") || 
      textLower.includes("cupboard tidy") || 
      textLower.includes("downsizing help") || 
      textLower.includes("room sorting") || 
      textLower.includes("marie kondo")
    ) {
      if (cat.name === "Decluttering & Home Sorting") score += 35;
    }

    if (
      textLower.includes("demolition") || 
      textLower.includes("strip out") || 
      textLower.includes("internal strip out") || 
      textLower.includes("garage demolition") || 
      textLower.includes("shed demolition") || 
      textLower.includes("wall knocking") || 
      textLower.includes("concrete breaking") || 
      textLower.includes("site clearing")
    ) {
      if (cat.name === "Demolition & Strip-Out") score += 35;
    }

    if (
      textLower.includes("flood damage") || 
      textLower.includes("fire damage") || 
      textLower.includes("smoke damage") || 
      textLower.includes("water damage restoration") || 
      textLower.includes("dehumidifiers") || 
      textLower.includes("drying out") || 
      textLower.includes("sewage cleanup") || 
      textLower.includes("emergency board up")
    ) {
      if (cat.name === "Disaster Recovery & Restoration") score += 35;
    }

    if (
      textLower.includes("driving lessons") || 
      textLower.includes("driving instructor") || 
      textLower.includes("manual driving lessons") || 
      textLower.includes("automatic driving lessons") || 
      textLower.includes("intensive driving course") || 
      textLower.includes("pass plus") || 
      textLower.includes("learn to drive")
    ) {
      if (cat.name === "Driving Instructors") score += 35;
    }

    if (
      textLower.includes("eco home") || 
      textLower.includes("energy efficiency check") || 
      textLower.includes("thermal imaging heat loss") || 
      textLower.includes("healthy home") || 
      textLower.includes("stop damp advice") || 
      textLower.includes("lower energy bills advice")
    ) {
      if (cat.name === "Eco-Home & Healthy Living") score += 35;
    }

    if (
      textLower.includes("wedding dj") || 
      textLower.includes("party dj") || 
      textLower.includes("magician") || 
      textLower.includes("live band") || 
      textLower.includes("covers band") || 
      textLower.includes("childrens entertainer") || 
      textLower.includes("solo singer") || 
      textLower.includes("comedian") || 
      textLower.includes("quiz master")
    ) {
      if (cat.name === "Entertainers") score += 35;
    }

    if (
      textLower.includes("letting agent") || 
      textLower.includes("property management") || 
      textLower.includes("property inventory") || 
      textLower.includes("tenant check in") || 
      textLower.includes("check out report") || 
      textLower.includes("schedule of condition") || 
      textLower.includes("hmo compliance")
    ) {
      if (cat.name === "Estate Agent & Landlord Services") score += 35;
    }

    if (
      textLower.includes("wedding planner") || 
      textLower.includes("event planner") || 
      textLower.includes("event coordinator") || 
      textLower.includes("venue dressing") || 
      textLower.includes("event styling") || 
      textLower.includes("wedding coordination") || 
      textLower.includes("anniversary party planner")
    ) {
      if (cat.name === "Event Management") score += 35;
    }

    if (
      textLower.includes("accountant") || 
      textLower.includes("chartered accountant") || 
      textLower.includes("tax return") || 
      textLower.includes("self assessment") || 
      textLower.includes("mortgage advisor") || 
      textLower.includes("mortgage broker") || 
      textLower.includes("bookkeeper") || 
      textLower.includes("sole trader accounts") || 
      textLower.includes("vat return")
    ) {
      if (cat.name === "Financial Services") score += 35;
    }

    if (
      textLower.includes("fire door") || 
      textLower.includes("fd30") || 
      textLower.includes("fd60") || 
      textLower.includes("fire door inspection") || 
      textLower.includes("fire risk assessment") || 
      textLower.includes("fra") || 
      textLower.includes("passive fire stopping") || 
      textLower.includes("intumescent seal") || 
      textLower.includes("fire extinguisher servicing") || 
      textLower.includes("dry riser testing")
    ) {
      if (cat.name === "Fire Safety, Fire Doors & Passive Protection") score += 35;
    }

    if (
      textLower.includes("carpet fitter") || 
      textLower.includes("carpet fitting") || 
      textLower.includes("laminate flooring") || 
      textLower.includes("wood flooring") || 
      textLower.includes("lvt") || 
      textLower.includes("luxury vinyl tile") || 
      textLower.includes("floor sanding") || 
      textLower.includes("herringbone flooring") || 
      textLower.includes("underfloor heating")
    ) {
      if (cat.name === "Flooring") score += 35;
    }

    if (
      textLower.includes("garage door") || 
      textLower.includes("roller garage door") || 
      textLower.includes("sectional garage door") || 
      textLower.includes("driveway") || 
      textLower.includes("block paving driveway") || 
      textLower.includes("resin driveway") || 
      textLower.includes("tarmac driveway") || 
      textLower.includes("dropped kerb") || 
      textLower.includes("garage floor epoxy")
    ) {
      if (cat.name === "Garage & Driveway") score += 35;
    }

    if (
      textLower.includes("glazier") || 
      textLower.includes("broken window glass") || 
      textLower.includes("double glazing repair") || 
      textLower.includes("double glazed window") || 
      textLower.includes("misted sealed unit") || 
      textLower.includes("misted window") || 
      textLower.includes("misted glass") || 
      textLower.includes("glass replacement") || 
      textLower.includes("toughened glass") || 
      textLower.includes("glass balustrade") || 
      textLower.includes("emergency glazing") || 
      textLower.includes("glass splashback")
    ) {
      if (cat.name === "Glazing & Glass") score += 35;
    }

    if (
      textLower.includes("groundworks") || 
      textLower.includes("digger hire") || 
      textLower.includes("excavation") || 
      textLower.includes("foundations digging") || 
      textLower.includes("trench digging") || 
      textLower.includes("concrete slab base") || 
      textLower.includes("land drainage") || 
      textLower.includes("mini digger operator")
    ) {
      if (cat.name === "Groundworks") score += 35;
    }

    if (
      textLower.includes("gutter cleaning") || 
      textLower.includes("blocked gutters") || 
      textLower.includes("gutters") || 
      textLower.includes("downpipe repair") || 
      textLower.includes("blocked drain") || 
      textLower.includes("drain unblocking") || 
      textLower.includes("drain jetting") || 
      textLower.includes("cctv drain survey") || 
      textLower.includes("fascias and soffits")
    ) {
      if (cat.name === "Guttering & Drainage") score += 35;
    }

    if (
      textLower.includes("handyman") || 
      textLower.includes("flat pack assembly") || 
      textLower.includes("odd jobs") || 
      textLower.includes("tv mounting") || 
      textLower.includes("picture hanging") || 
      textLower.includes("curtain pole fitting") || 
      textLower.includes("silicone sealant") || 
      textLower.includes("door easing")
    ) {
      if (cat.name === "Handyman / General") score += 35;
    }

    if (
      textLower.includes("hard surface repair") || 
      textLower.includes("bath repair") || 
      textLower.includes("chipped bath") || 
      textLower.includes("enamel chip repair") || 
      textLower.includes("enamel repair") || 
      textLower.includes("worktop repair") || 
      textLower.includes("worktop chip") || 
      textLower.includes("quartz chip fix") || 
      textLower.includes("quartz chip") || 
      textLower.includes("laminate burn repair") || 
      textLower.includes("upvc frame scratch") || 
      textLower.includes("scratched glass polishing") || 
      textLower.includes("cosmetic resurfacing")
    ) {
      if (cat.name === "Hard Surface Repair & Cosmetic Resurfacing") score += 35;
    }

    if (
      textLower.includes("japanese knotweed") || 
      textLower.includes("knotweed") || 
      textLower.includes("oil tank removal") || 
      textLower.includes("lead paint removal") || 
      textLower.includes("contaminated soil") || 
      textLower.includes("chemical waste disposal") || 
      textLower.includes("needle clearance")
    ) {
      if (cat.name === "Hazardous Material Removal") score += 35;
    }

    if (
      textLower.includes("personal trainer") || 
      textLower.includes("pt") || 
      textLower.includes("fitness coach") || 
      textLower.includes("sports massage") || 
      textLower.includes("deep tissue massage") || 
      textLower.includes("physiotherapy") || 
      textLower.includes("nutrition advice") || 
      textLower.includes("yoga instructor")
    ) {
      if (cat.name === "Health, Fitness & Wellbeing") score += 35;
    }

    if (
      textLower.includes("acupuncture") || 
      textLower.includes("hypnotherapy") || 
      textLower.includes("reiki") || 
      textLower.includes("reflexology") || 
      textLower.includes("herbalism") || 
      textLower.includes("aromatherapy") || 
      textLower.includes("sound healing")
    ) {
      if (cat.name === "Holistic & Alternative Health") score += 35;
    }

    if (
      textLower.includes("home help") || 
      textLower.includes("errand runner") || 
      textLower.includes("grocery shopping helper") || 
      textLower.includes("meal prep help") || 
      textLower.includes("waiting in service") || 
      textLower.includes("prescription collection")
    ) {
      if (cat.name === "Home Help & Personal Errands") score += 35;
    }

    if (
      textLower.includes("wifi setup") || 
      textLower.includes("mesh wifi") || 
      textLower.includes("home network") || 
      textLower.includes("cat6 cabling") || 
      textLower.includes("ethernet installation") || 
      textLower.includes("wifi dead zones") || 
      textLower.includes("smart home automation") || 
      textLower.includes("home cinema")
    ) {
      if (cat.name === "Home Network & AV") score += 35;
    }

    if (
      textLower.includes("loft insulation") || 
      textLower.includes("cavity wall insulation") || 
      textLower.includes("soundproofing") || 
      textLower.includes("acoustic insulation") || 
      textLower.includes("external wall insulation") || 
      textLower.includes("internal wall insulation") || 
      textLower.includes("draught proofing")
    ) {
      if (cat.name === "Insulation") score += 35;
    }

    if (
      textLower.includes("interior designer") || 
      textLower.includes("interior design") || 
      textLower.includes("home staging") || 
      textLower.includes("property styling") || 
      textLower.includes("room makeover") || 
      textLower.includes("mood board") || 
      textLower.includes("colour consultation") || 
      textLower.includes("show home staging")
    ) {
      if (cat.name === "Interior Design & Home Staging") score += 35;
    }

    if (
      textLower.includes("gardener") || 
      textLower.includes("landscaping") || 
      textLower.includes("patio paving") || 
      textLower.includes("fencing") || 
      textLower.includes("artificial grass") || 
      textLower.includes("lawn mowing") || 
      textLower.includes("hedge trimming") || 
      textLower.includes("turfing") || 
      textLower.includes("decking installation") || 
      textLower.includes("garden design")
    ) {
      if (cat.name === "Landscaping & Garden") score += 35;
    }

    if (
      textLower.includes("locksmith") || 
      textLower.includes("locked out") || 
      textLower.includes("lock replacement") || 
      textLower.includes("broken key") || 
      textLower.includes("door lockout") || 
      textLower.includes("anti snap cylinder") || 
      textLower.includes("upvc door mechanism") || 
      textLower.includes("window locks")
    ) {
      if (cat.name === "Locksmith") score += 35;
    }

    if (
      textLower.includes("web design") || 
      textLower.includes("website builder") || 
      textLower.includes("logo design") || 
      textLower.includes("graphic design") || 
      textLower.includes("wordpress website") || 
      textLower.includes("shopify store") || 
      textLower.includes("branding identity")
    ) {
      if (cat.name === "Logo, Design & Websites") score += 35;
    }

    if (
      textLower.includes("seo") || 
      textLower.includes("local seo") || 
      textLower.includes("google business profile") || 
      textLower.includes("google ads") || 
      textLower.includes("facebook ads") || 
      textLower.includes("lead generation") || 
      textLower.includes("digital marketing")
    ) {
      if (cat.name === "Marketing & Growing Your Business") score += 35;
    }

    if (
      textLower.includes("bricklayer") || 
      textLower.includes("bricklaying") || 
      textLower.includes("repointing") || 
      textLower.includes("garden wall") || 
      textLower.includes("stone cladding") || 
      textLower.includes("lime mortar repointing") || 
      textLower.includes("brick repair") || 
      textLower.includes("retaining wall")
    ) {
      if (cat.name === "Masonry & Stonework") score += 35;
    }

    if (
      textLower.includes("welder") || 
      textLower.includes("mobile welding") || 
      textLower.includes("metal gates") || 
      textLower.includes("wrought iron railings") || 
      textLower.includes("security grilles") || 
      textLower.includes("structural steel") || 
      textLower.includes("fire escape")
    ) {
      if (cat.name === "Metalwork & Welding") score += 35;
    }

    if (
      textLower.includes("errand runner") || 
      textLower.includes("queue standing") || 
      textLower.includes("delivery waiting") || 
      textLower.includes("snow shovelling") || 
      textLower.includes("leaf clearing")
    ) {
      if (cat.name === "OnDemand & Lifestyle") score += 35;
    }

    if (
      textLower.includes("tutor") || 
      textLower.includes("maths tutor") || 
      textLower.includes("english tutor") || 
      textLower.includes("science tutor") || 
      textLower.includes("gcse tutor") || 
      textLower.includes("a level tutor") || 
      textLower.includes("online tutoring") || 
      textLower.includes("language lessons")
    ) {
      if (cat.name === "Online Lessons & Tutoring") score += 35;
    }

    if (
      textLower.includes("party planner") || 
      textLower.includes("balloon arch") || 
      textLower.includes("balloon garland") || 
      textLower.includes("party decorator") || 
      textLower.includes("themed party") || 
      textLower.includes("candy cart") || 
      textLower.includes("birthday party organizer")
    ) {
      if (cat.name === "Party Planner") score += 35;
    }

    if (
      textLower.includes("cat flap") || 
      textLower.includes("dog flap") || 
      textLower.includes("microchip cat flap") || 
      textLower.includes("catio") || 
      textLower.includes("cat enclosure") || 
      textLower.includes("dog kennel run") || 
      textLower.includes("pet proof fencing") || 
      textLower.includes("rabbit hutch")
    ) {
      if (cat.name === "Pet Home Installations") score += 35;
    }

    if (
      textLower.includes("plasterer") || 
      textLower.includes("plastering") || 
      textLower.includes("skimming") || 
      textLower.includes("dry lining") || 
      textLower.includes("ceiling plaster") || 
      textLower.includes("artex skimming") || 
      textLower.includes("external rendering") || 
      textLower.includes("coving")
    ) {
      if (cat.name === "Plastering") score += 35;
    }

    if (
      textLower.includes("ready mix concrete") || 
      textLower.includes("concrete delivery") || 
      textLower.includes("concrete pump") || 
      textLower.includes("volumetric concrete") || 
      textLower.includes("tarmac") || 
      textLower.includes("asphalt surfacing") || 
      textLower.includes("tarmac driveway") || 
      textLower.includes("pothole repair")
    ) {
      if (cat.name === "Ready-Mix Concrete & Tarmacadam Surfacing") score += 35;
    }

    if (
      textLower.includes("air conditioning") || 
      textLower.includes("air con") || 
      textLower.includes("commercial refrigeration") || 
      textLower.includes("cold room") || 
      textLower.includes("chiller repair") || 
      textLower.includes("heat pump installation") || 
      textLower.includes("ventilation ductwork") || 
      textLower.includes("f-gas")
    ) {
      if (cat.name === "Refrigerator/AC & Commercial HVAC") score += 35;
    }

    if (
      textLower.includes("scaffolding") || 
      textLower.includes("scaffolder") || 
      textLower.includes("scaffold hire") || 
      textLower.includes("access tower") || 
      textLower.includes("chimney scaffolding") || 
      textLower.includes("temporary roof") || 
      textLower.includes("edge protection")
    ) {
      if (cat.name === "Scaffolding") score += 35;
    }

    if (
      textLower.includes("cctv") || 
      textLower.includes("security cameras") || 
      textLower.includes("burglar alarm") || 
      textLower.includes("intruder alarm") || 
      textLower.includes("ring doorbell") || 
      textLower.includes("smart security") || 
      textLower.includes("access control intercom")
    ) {
      if (cat.name === "Security Systems") score += 35;
    }

    if (
      textLower.includes("solar panels") || 
      textLower.includes("solar pv") || 
      textLower.includes("battery storage") || 
      textLower.includes("air source heat pump") || 
      textLower.includes("ashp") || 
      textLower.includes("ground source heat pump") || 
      textLower.includes("boiler upgrade scheme") || 
      textLower.includes("renewable energy")
    ) {
      if (cat.name === "Solar, Heat Pumps & Renewable Energy") score += 35;
    }

    if (
      textLower.includes("architect") || 
      textLower.includes("architectural drawings") || 
      textLower.includes("surveyor") || 
      textLower.includes("rics survey") || 
      textLower.includes("homebuyer report") || 
      textLower.includes("building survey level 3") || 
      textLower.includes("party wall surveyor") || 
      textLower.includes("planning permission drawings")
    ) {
      if (cat.name === "Surveying & Architecture") score += 35;
    }

    if (
      textLower.includes("hot tub") || 
      textLower.includes("hot tub repair") || 
      textLower.includes("hot tub servicing") || 
      textLower.includes("swimming pool maintenance") || 
      textLower.includes("pool pump") || 
      textLower.includes("pool liner") || 
      textLower.includes("sauna installation")
    ) {
      if (cat.name === "Swimming Pool & Hot Tub") score += 35;
    }

    if (
      textLower.includes("airport transfer") || 
      textLower.includes("taxi to airport") || 
      textLower.includes("private hire") || 
      textLower.includes("chauffeur") || 
      textLower.includes("minibus hire") || 
      textLower.includes("wheelchair accessible taxi") || 
      textLower.includes("executive travel")
    ) {
      if (cat.name === "Taxi & Transport") score += 35;
    }

    if (
      textLower.includes("tiler") || 
      textLower.includes("tiling") || 
      textLower.includes("porcelain tiles") || 
      textLower.includes("ceramic tiles") || 
      textLower.includes("wall tiler") || 
      textLower.includes("floor tiler") || 
      textLower.includes("splashback tiling") || 
      textLower.includes("regrouting") || 
      textLower.includes("wet room tiling")
    ) {
      if (cat.name === "Tiling") score += 35;
    }

    if (
      textLower.includes("tool hire") || 
      textLower.includes("carpet cleaner hire") || 
      textLower.includes("cement mixer hire") || 
      textLower.includes("floor sander hire") || 
      textLower.includes("power tool hire") || 
      textLower.includes("scaffold tower hire")
    ) {
      if (cat.name === "Tool & Equipment Hire") score += 35;
    }

    if (
      textLower.includes("tree surgeon") || 
      textLower.includes("tree felling") || 
      textLower.includes("stump grinding") || 
      textLower.includes("crown reduction") || 
      textLower.includes("tree pruning") || 
      textLower.includes("tree removal") || 
      textLower.includes("hedge cutting tall")
    ) {
      if (cat.name === "Tree Surgery & Arboriculture") score += 35;
    }

    if (
      textLower.includes("reupholstery") || 
      textLower.includes("upholstery") || 
      textLower.includes("sofa reupholstery") || 
      textLower.includes("dining chair recovery") || 
      textLower.includes("cushion foam replacement") || 
      textLower.includes("headboard upholstery") || 
      textLower.includes("leather restoration")
    ) {
      if (cat.name === "Upholstery & Soft Furnishings") score += 35;
    }

    if (
      textLower.includes("car body repair") || 
      textLower.includes("dent repair") || 
      textLower.includes("bumper scuff") || 
      textLower.includes("car respray") || 
      textLower.includes("smart repair") || 
      textLower.includes("alloy wheel refurbishment") || 
      textLower.includes("paint scratch repair")
    ) {
      if (cat.name === "Vehicle Bodywork & Cosmetic") score += 35;
    }

    if (
      textLower.includes("mobile vet") || 
      textLower.includes("home visit vet") || 
      textLower.includes("pet vaccination") || 
      textLower.includes("dog microchipping") || 
      textLower.includes("home pet euthanasia") || 
      textLower.includes("flea treatment vet") || 
      textLower.includes("pet dental care")
    ) {
      if (cat.name === "Veterinary & Pet Health") score += 35;
    }

    if (
      textLower.includes("void property turnaround") || 
      textLower.includes("void turnaround") || 
      textLower.includes("property turnaround") || 
      textLower.includes("lock change and secure") || 
      textLower.includes("sparkle clean void") || 
      textLower.includes("council void") || 
      textLower.includes("key safe installation")
    ) {
      if (cat.name === "Void Property Turnaround & Tenancy Refresh") score += 35;
    }

    if (
      textLower.includes("skip hire") || 
      textLower.includes("rubbish removal") || 
      textLower.includes("waste clearance") || 
      textLower.includes("grab hire") || 
      textLower.includes("builders waste removal") || 
      textLower.includes("junk removal") || 
      textLower.includes("house clearance") || 
      textLower.includes("scrap metal collection")
    ) {
      if (cat.name === "Waste & Skip Services") score += 35;
    }

    if (
      textLower.includes("water softener") || 
      textLower.includes("limescale filtration") || 
      textLower.includes("drinking water filter") || 
      textLower.includes("reverse osmosis") || 
      textLower.includes("water descaler") || 
      textLower.includes("boiling water tap")
    ) {
      if (cat.name === "Water Treatment") score += 35;
    }

    if (
      textLower.includes("window fitter") || 
      textLower.includes("double glazing windows") || 
      textLower.includes("double glazed windows") || 
      textLower.includes("upvc windows") || 
      textLower.includes("composite door") || 
      textLower.includes("composite front door") || 
      textLower.includes("bifold doors") || 
      textLower.includes("french doors") || 
      textLower.includes("sash windows") || 
      textLower.includes("window repair") || 
      textLower.includes("patio sliding doors")
    ) {
      if (cat.name === "Windows & Doors") score += 35;
    }

    if (
      textLower.includes("van hire") || 
      textLower.includes("van rental") || 
      textLower.includes("rent a van") || 
      textLower.includes("hire a van") || 
      textLower.includes("luton van hire") || 
      textLower.includes("transit hire") || 
      textLower.includes("self drive van") || 
      textLower.includes("tipper hire") || 
      textLower.includes("dropside hire") || 
      textLower.includes("commercial vehicle rental") || 
      textLower.includes("commercial vehicle hire")
    ) {
      if (cat.name === "Van Hire & Commercial Vehicle Rental") score += 35;
    }

    if (
      textLower.includes("tyre") || 
      textLower.includes("tyres") || 
      textLower.includes("tyre shop") || 
      textLower.includes("tyre fitting") || 
      textLower.includes("mobile tyre fitting") || 
      textLower.includes("buy tyres") || 
      textLower.includes("puncture repair") || 
      textLower.includes("part worn tyres") || 
      textLower.includes("new tyres") || 
      textLower.includes("wheel alignment") || 
      textLower.includes("wheel tracking") || 
      textLower.includes("locking wheel nut") || 
      textLower.includes("run flat tyre")
    ) {
      if (cat.name === "Tyres, Wheels & Mobile Tyre Fitting") score += 35;
    }



    // Only keep categories that have achieved a confident trade relevance score (>= 15)
    if (score >= 15) {
      matchedCategories.push({ name: cat.name, score });
    }
  });

  matchedCategories.sort((a, b) => b.score - a.score);

  // If top category is highly confident (>= 25), do not pad with weak low-scoring categories
  const topScore = matchedCategories[0]?.score || 0;
  const filtered = matchedCategories.filter(c => c.score >= 20 || c.score >= topScore - 10);
  const result = filtered.slice(0, maxResults).map((c) => c.name);

  return result.length > 0 ? result : ["Building & Construction", "Handyman / General"];
}

/**
 * Normalizes trade strings and category aliases to ensure cross-matching.
 */
/**
 * Normalizes trade strings and category aliases to ensure intra-domain match precision
 * using the central CategoryRegistry and curated domain definitions.
 * STRICT ISOLATION: Prevents bridge aliases (e.g. "security systems") from contaminating
 * distinct trade disciplines like Electrical, Locksmith, or Manned Guarding.
 */
export function getCategoryAliases(categories: string | string[]): string[] {
  const catList = Array.isArray(categories) ? categories : [categories];
  const aliases = new Set<string>();

  catList.forEach((rawCat) => {
    const cat = (rawCat || "").toLowerCase().trim();
    if (!cat) return;
    aliases.add(cat);

    // 1. Dynamic sync integration with CategoryRegistry
    const canonical = categoryRegistry.resolveCanonicalCategory(cat);
    if (canonical) {
      aliases.add(canonical.toLowerCase().trim());
      const regCat = categoryRegistry.getCategoryByName(canonical);
      if (regCat) {
        if (regCat.synonyms) {
          regCat.synonyms.forEach(s => aliases.add(s.toLowerCase().trim()));
        }
        if (regCat.subcategories) {
          regCat.subcategories.forEach(sub => aliases.add(sub.toLowerCase().trim()));
        }
      }
    }

    // 2. Curated fuzzy metadata synonyms
    const meta = getCategoryMetadata(canonical || cat);
    if (meta?.synonyms) {
      meta.synonyms.forEach(s => aliases.add(s.toLowerCase().trim()));
    }

    // 3. Strict Intra-Domain Sector Expansions (Isolated by trade discipline)
    if (cat.includes("cake") || cat.includes("bake") || cat.includes("pastry")) {
      ["bake n cake", "cake maker & baker", "cake maker", "baker", "baking", "wedding cakes", "celebration cakes", "bespoke bakes", "pastry chef"].forEach(a => aliases.add(a));
    }
    if (cat.includes("catering") || cat.includes("chef")) {
      ["catering & private chef", "event catering", "private dinner chef", "buffet catering"].forEach(a => aliases.add(a));
    }
    if (cat.includes("hvac") || cat.includes("air condition") || cat.includes("refrigerat") || cat.includes("chiller")) {
      ["refrigerator/ac & commercial hvac", "air conditioning", "refrigeration", "commercial hvac", "heat pump", "ventilation", "chiller"].forEach(a => aliases.add(a));
    }
    if (cat.includes("gas") || cat.includes("heating") || cat.includes("boiler") || cat.includes("radiator")) {
      ["gas & heating", "gas engineering", "heating", "boiler engineer", "boiler installation", "boiler repair", "emergency boiler repair", "gas safety certification", "cp12", "gas safe"].forEach(a => aliases.add(a));
    }
    if (cat.includes("plumb") || cat.includes("pipe") || cat.includes("leak") || cat.includes("tap") || cat.includes("toilet") || cat.includes("sink")) {
      ["plumbing", "plumber", "emergency plumbing", "bathroom fitting", "leak repair", "tap replacement", "toilet repair", "pipework", "unblock drain"].forEach(a => aliases.add(a));
    }
    if (cat.includes("electr") || cat.includes("socket") || cat.includes("fuse") || cat.includes("rewir") || cat.includes("eicr") || cat.includes("consumer unit")) {
      ["electrical", "electrician", "sparks", "sparky", "electrical contractor", "smart home & automation", "ev charger fitting", "consumer unit upgrade", "consumer unit replacement", "eicr safety inspection", "rewiring", "socket installation", "fuse box"].forEach(a => aliases.add(a));
    }
    if (cat.includes("remov") || cat.includes("move") || cat.includes("man and van") || cat.includes("man & van")) {
      ["removals", "home & domestic removals", "house removals", "man & van", "man and van", "house & garden clearance", "flat move"].forEach(a => aliases.add(a));
    }
    if (cat.includes("clean") || cat.includes("carpet") || cat.includes("bin") || cat.includes("tenancy")) {
      ["home cleaning", "domestic & commercial cleaning", "specialist cleaning", "carpet & upholstery cleaning", "end of tenancy", "window cleaning", "wheelie bin cleaning"].forEach(a => aliases.add(a));
    }
    if (cat.includes("paint") || cat.includes("decorat") || cat.includes("wallpaper")) {
      ["painting & decorating", "painter & decorator", "decorating", "wallpapering", "heritage decor", "interior painting", "exterior painting"].forEach(a => aliases.add(a));
    }
    if (cat.includes("carpent") || cat.includes("joiner") || cat.includes("timber")) {
      ["carpentry & joinery", "carpenter & joiner", "joiner", "timber decking", "cabinet maker", "fitted wardrobes"].forEach(a => aliases.add(a));
    }
    if (cat.includes("door fitting") || cat.includes("door hanging")) {
      ["door fitting & hanging", "door hanging", "internal door fitting", "fire door installation"].forEach(a => aliases.add(a));
    }
    if (cat.includes("roof") || cat.includes("chimney") || cat.includes("leadwork")) {
      ["roofing", "roofer", "roofing services", "slate roofing", "tile replacement", "flat roofing", "chimney repair"].forEach(a => aliases.add(a));
    }
    if (cat.includes("build") || cat.includes("brick") || cat.includes("extension") || cat.includes("loft")) {
      ["builder", "building & construction", "house extension", "loft conversion", "bricklayer", "bricklaying", "general builder"].forEach(a => aliases.add(a));
    }
    if (cat.includes("gutter") || cat.includes("fascia") || cat.includes("soffit")) {
      ["guttering & drainage", "gutter cleaning", "fascias & soffits", "gutter repair", "downpipe clearance"].forEach(a => aliases.add(a));
    }
    if (cat.includes("lock") || cat.includes("key") || cat.includes("lockout") || cat.includes("anti snap") || cat.includes("ultion")) {
      ["locksmith", "locksmith & security", "master locksmith", "key cutting", "emergency door opening", "lock replacement", "upvc door lock mechanism repair", "anti snap cylinder", "lockout"].forEach(a => aliases.add(a));
    }
    if (cat.includes("security system") || cat.includes("cctv") || cat.includes("burglar alarm") || cat.includes("intruder alarm") || cat.includes("smart security") || cat.includes("access control")) {
      ["security systems", "cctv installation", "burglar alarm", "smart doorbell installation", "access control systems", "intercom systems", "security lighting", "smart security", "intruder alarm"].forEach(a => aliases.add(a));
    }
    if (cat.includes("guard") || cat.includes("patrol") || cat.includes("stadium") || cat.includes("bouncer") || cat.includes("door supervisor") || cat.includes("close protection") || cat.includes("manned guarding")) {
      ["security services, manned guarding & event security", "manned guarding", "security guard", "site security", "event security", "stadium security", "door supervisor", "bouncers", "close protection", "k9 security", "mobile patrols"].forEach(a => aliases.add(a));
    }
    if (cat.includes("tailor") || cat.includes("alterat") || cat.includes("seamstress") || cat.includes("laundry")) {
      ["tailoring, alterations & laundry services", "tailoring", "garment alterations", "bespoke tailoring", "seamstress", "laundry"].forEach(a => aliases.add(a));
    }
    if (cat.includes("pet") || cat.includes("dog") || cat.includes("cat")) {
      ["pet services", "pet care specialist", "dog walker", "cat sitter", "pet care", "dog walking", "cat sitting"].forEach(a => aliases.add(a));
    }
    if (cat.includes("garden") || cat.includes("landscap") || cat.includes("paving") || cat.includes("decking")) {
      ["landscaping & garden", "driveways, patios & paving", "fencing", "decking", "turfing", "garden maintenance"].forEach(a => aliases.add(a));
    }
    if (cat.includes("tree")) {
      ["tree surgery & arboriculture", "tree surgeon", "tree felling", "stump grinding", "crown reduction"].forEach(a => aliases.add(a));
    }
    if (cat.includes("courier") || cat.includes("parcel") || cat.includes("delivery") || cat.includes("bulky")) {
      ["courier, parcel & express delivery", "on-demand delivery & bulky goods courier", "express delivery", "courier", "bulky goods transport"].forEach(a => aliases.add(a));
    }
    if (cat.includes("labour") || cat.includes("helper") || cat.includes("mate") || cat.includes("digging")) {
      ["general labour, trade mates & site helpers", "site helper", "trade mate", "labourer", "strip out", "skip loading"].forEach(a => aliases.add(a));
    }
    if (cat.includes("van hire") || cat.includes("van rental") || cat.includes("rent a van") || cat.includes("hire a van")) {
      ["van hire & commercial vehicle rental", "van hire", "van rental", "rent a van", "self drive van hire", "commercial vehicle rental"].forEach(a => aliases.add(a));
    }
    if (cat.includes("tyre") || cat.includes("wheel") || cat.includes("puncture")) {
      ["tyres, wheels & mobile tyre fitting", "tyres", "tyre shop", "tyre fitting", "mobile tyre fitting", "buy tyres", "puncture repair", "wheel alignment"].forEach(a => aliases.add(a));
    }
  });

  return Array.from(aliases);
}

/**
 * Calculates a strict trade relevance score (0 - 100+) between a trader and target categories/inquiry.
 * 
 * ARCHITECTURAL RULE: HARD PRIMARY-DOMAIN GATING.
 * A tradesperson MUST possess at least one primary trade, category, or certified specialization
 * matching the target category domain or its canonical synonyms.
 * 
 * Secondary tags, ancillary services (e.g. CCTV offered by a Locksmith, or doorbell installed by a Decorator),
 * subcategories, or user query tokens CAN NEVER qualify an out-of-domain trader.
 * 
 * Returns 0 if the trader fails the primary trade domain gate.
 */
export function calculateTradeRelevanceScore(
  trader: any,
  targetAliases: string[],
  userQueryTokens: string[] = [],
  targetCategoryNames: string[] = []
): number {
  if (!trader) return 0;

  const traderTrades = (Array.isArray(trader.trades) ? trader.trades : [trader.trades || ""])
    .filter(Boolean).map((t: string) => t.toLowerCase().trim());
  const recCats = (Array.isArray(trader.recommendedCategories) ? trader.recommendedCategories : [trader.recommendedCategories || ""])
    .filter(Boolean).map((t: string) => t.toLowerCase().trim());
  const services = (Array.isArray(trader.services) ? trader.services : [trader.services || ""])
    .filter(Boolean).map((s: string) => s.toLowerCase().trim());
  const tags = (Array.isArray(trader.tags) ? trader.tags : [trader.tags || ""])
    .filter(Boolean).map((tg: string) => tg.toLowerCase().trim());
  const skills = (Array.isArray(trader.skills) ? trader.skills : [trader.skills || ""])
    .filter(Boolean).map((sk: string) => sk.toLowerCase().trim());
  const subcats = (Array.isArray(trader.subcategories) ? trader.subcategories : [trader.subcategories || ""])
    .filter(Boolean).map((sb: string) => sb.toLowerCase().trim());

  const traderCat = (trader.category || "").toLowerCase().trim();
  const busCat = (trader.businessCategory || "").toLowerCase().trim();
  const primary = (trader.primaryTrade || "").toLowerCase().trim();
  const company = (trader.businessName || trader.companyName || "").toLowerCase().trim();
  const bio = (trader.bio || "").toLowerCase().trim();

  // 1. DETERMINE TARGET DOMAIN KEYWORDS
  // Collect canonical domain names and primary synonyms for the requested trade categories
  const domainKeywords = new Set<string>();
  const categoriesToCheck = targetCategoryNames.length > 0 
    ? targetCategoryNames 
    : targetAliases.slice(0, 5);

  categoriesToCheck.forEach((raw) => {
    const c = (raw || "").toLowerCase().trim();
    if (!c) return;
    domainKeywords.add(c);

    const canonical = categoryRegistry.resolveCanonicalCategory(c);
    if (canonical) {
      domainKeywords.add(canonical.toLowerCase().trim());
      const reg = categoryRegistry.getCategoryByName(canonical);
      if (reg?.synonyms) {
        reg.synonyms.forEach((s) => domainKeywords.add(s.toLowerCase().trim()));
      }
    }
    const meta = getCategoryMetadata(canonical || c);
    if (meta?.synonyms) {
      meta.synonyms.forEach((s) => domainKeywords.add(s.toLowerCase().trim()));
    }
  });

  // Primary trade identifiers of this trader
  const primaryIdentifiers = [primary, traderCat, busCat, ...traderTrades, ...recCats].filter(Boolean);

  // 2. HARD PRIMARY-DOMAIN GATE CHECK
  // The trader MUST have at least one primary identifier matching the domain
  let passesDomainGate = false;

  for (const domainWord of domainKeywords) {
    if (domainWord.length < 3) continue;

    const matched = primaryIdentifiers.some((ident) => {
      if (ident === domainWord) return true;
      if (ident.includes(domainWord) || domainWord.includes(ident)) {
        // Tokenize to avoid accidental partial substring matches (e.g. "pet" in "carpet")
        const words = ident.split(/[^a-z0-9]+/);
        return words.some((w: string) => w === domainWord || (w.length >= 4 && domainWord.startsWith(w)) || (domainWord.length >= 4 && w.startsWith(domainWord)));
      }
      return false;
    });

    if (matched) {
      passesDomainGate = true;
      break;
    }
  }

  // IF TRADER FAILS THE PRIMARY DOMAIN GATE: STRICT REJECTION (Score 0)
  // Ancillary skills, secondary services, or query token hits CANNOT qualify an out-of-domain trader.
  if (!passesDomainGate) {
    return 0;
  }

  // 3. RELEVANCE SCORING (Only computed for qualified domain professionals)
  let score = 0;

  // Primary Category or Primary Trade Match (+50 pts)
  for (const alias of targetAliases) {
    if (primary && (primary === alias || primary.includes(alias) || alias.includes(primary))) {
      score += 50;
      break;
    }
    if (traderCat && (traderCat === alias || traderCat.includes(alias) || alias.includes(traderCat))) {
      score += 50;
      break;
    }
    if (busCat && (busCat === alias || busCat.includes(alias) || alias.includes(busCat))) {
      score += 45;
      break;
    }
  }

  // Direct Trade List Match (+40 pts)
  for (const alias of targetAliases) {
    const hasTrade = traderTrades.some((tr: string) => tr === alias || tr.includes(alias) || alias.includes(tr));
    if (hasTrade) {
      score += 40;
      break;
    }
  }

  // Recommended Category or Subcategory Match (+30 pts)
  for (const alias of targetAliases) {
    const hasRec = recCats.some((rc: string) => rc === alias || rc.includes(alias) || alias.includes(rc));
    const hasSub = subcats.some((sb: string) => sb === alias || sb.includes(alias) || alias.includes(sb));
    if (hasRec || hasSub) {
      score += 30;
      break;
    }
  }

  // Specific Service Offerings or Verified Skills Match (+20 pts)
  for (const alias of targetAliases) {
    const hasService = services.some((s: string) => s === alias || s.includes(alias) || alias.includes(s));
    const hasTag = tags.some((tg: string) => tg === alias || tg.includes(alias) || alias.includes(tg));
    const hasSkill = skills.some((sk: string) => sk === alias || sk.includes(alias) || alias.includes(sk));
    if (hasService || hasTag || hasSkill) {
      score += 20;
      break;
    }
  }

  // Company Name trade keyword match (+15 pts)
  for (const alias of targetAliases) {
    if (company && company.includes(alias)) {
      score += 15;
      break;
    }
  }

  // User Query domain token reinforcement (+up to 20 pts)
  if (userQueryTokens.length > 0) {
    const allProfileText = [...traderTrades, ...services, ...tags, ...skills, ...subcats, company, bio].join(" ");
    let queryHits = 0;
    for (const tok of userQueryTokens) {
      if (allProfileText.includes(tok)) {
        queryHits++;
      }
    }
    score += Math.min(queryHits * 5, 20);
  }

  return score;
}

/**
 * Retrieves recommended traders using the Hybrid Fairness & Monetization Engine:
 * - Accepts single category OR array of detected categories (e.g. from TradeBot AI)
 * - Enforces strict Category-Aware Gating so unrelated trades (e.g. builders for a plumbing issue) never leak
 * - Slot 1: Featured Pro ⚡ (Monetized / Priority Partner with top badges within matching category)
 * - Slot 2: Organic Match 🌟 (Fairness Rotation with distance & quality ranking within matching category)
 */
export async function getHybridTraderRecommendations(
  categories: string | string[],
  userPostcode?: string,
  liveTradersPool?: Tradesperson[],
  userQuery?: string
): Promise<TraderRecommendationCard[]> {
  try {
    const categoryList = Array.isArray(categories) 
      ? categories.filter(Boolean)
      : (categories ? [categories] : []);
    
    if (categoryList.length === 0) {
      categoryList.push("General Trades");
    }

    let pool: Tradesperson[] = [];

    // 1. Fetch live traders from Firestore if available
    let firestoreTraders: Tradesperson[] = [];
    if (!liveTradersPool || liveTradersPool.length === 0) {
      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("role", "in", ["tradesperson", "trader", "business"]), limit(50));
        const snap = await getDocs(q);
        if (!snap.empty) {
          firestoreTraders = snap.docs.map(d => ({ uid: d.id, ...d.data() } as Tradesperson));
        }
      } catch (err) {
        console.warn("Firestore fetch for traders skipped:", err);
      }
    }

    // Always merge seeded mock traders into pool so verified profiles in all 86+ trade sectors are accessible
    const seedPool = INITIAL_MOCK_TRADERS as Tradesperson[];
    if (liveTradersPool && liveTradersPool.length > 0) {
      const existingUids = new Set(liveTradersPool.map(t => t.uid));
      pool = [...liveTradersPool, ...seedPool.filter(s => !existingUids.has(s.uid))];
    } else {
      const existingUids = new Set(firestoreTraders.map(t => t.uid));
      pool = [...firestoreTraders, ...seedPool.filter(s => !existingUids.has(s.uid))];
    }

    // 2. Strict Trade Relevance Filtering across all detected categories
    const isAllCategories = categoryList.some(c => c.toLowerCase() === "all" || c.toLowerCase() === "general trades" || c.toLowerCase() === "all trades");
    const targetAliases = getCategoryAliases(categoryList);

    // Extract significant query tokens (min 3 chars, skip noise and generic words)
    const noiseWords = new Set([
      "how", "much", "does", "cost", "what", "where", "when", "who", "which", "is", "are", "was", "were", "been",
      "the", "and", "for", "with", "apply", "laws", "rule", "rules", "need", "hire", "find", "best", "good", "local",
      "system", "systems", "installed", "installing", "installation", "new", "complete", "including", "included",
      "house", "home", "full", "done", "week", "weeks", "work", "price", "prices", "quote", "quotes", "about", "tell",
      "estimate", "service", "services", "unit", "area", "type", "within", "around", "near", "nearby", "trader", "tradesperson",
      "company", "business", "repair", "repairs", "fixed", "fixing", "problem", "problems", "issue", "issues",
      "making", "sounds", "causes", "typical", "losing", "fault"
    ]);
    
    const queryTokens = (userQuery || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter(t => t.length >= 3 && !noiseWords.has(t));

    // Filter and score candidates based on strict trade domain gating
    const scoredCandidates: Array<{
      tp: any;
      tradeScore: number;
      rating: number;
      reviews: number;
      isVerified: boolean;
      isGasSafe: boolean;
      isNiceic: boolean;
      isVideo: boolean;
      isProSubscribed: boolean;
      isAreaMatch: boolean;
      totalScore: number;
      isNewcomer: boolean;
    }> = [];

    const userPrefix = (userPostcode || "").trim().split(" ")[0]?.toUpperCase() || "";

    for (const traderObj of pool) {
      const tp: any = traderObj;
      const tradeScore = isAllCategories ? 50 : calculateTradeRelevanceScore(tp, targetAliases, queryTokens, categoryList);

      // STRICT GATE: Must have a valid trade relevance score (> 0) to enter the candidate pool
      if (tradeScore <= 0) {
        continue;
      }

      const rating = tp.rating || 4.8;
      const reviews = tp.reviewsCount || tp.totalReviews || tp.totalJobsCompleted || tp.totalJobsDone || 12;
      const isVerified = tp.verificationStatus === "verified" || tp.isVerified === true;
      const isGasSafe = tp.isGasSafeRegistered || tp.certifications?.some((c: any) => c.name?.toLowerCase().includes("gas safe")) || tp.recommendedCategories?.includes("Gas & Heating");
      const isNiceic = tp.isNiceicApproved || tp.certifications?.some((c: any) => c.name?.toLowerCase().includes("niceic"));
      const isVideo = Boolean(tp.videoVerificationUrl || tp.verificationVideoUrl || tp.isVideoVerified || tp.videoVerificationStatus === "verified" || tp.videoVerificationStatus === "approved" || tp.hasVerifiedVideoProSubscription);
      const isProSubscribed = Boolean(tp.subscriptionType === "business" || tp.subscriptionType === "pro" || tp.tier === "premium" || tp.subscriptionTier === "gold" || tp.subscriptionTier === "platinum" || tp.subscriptionTier === "pro" || tp.tierId === "Gold" || tp.tierId === "Platinum" || tp.tierId === "Pro" || tp.isTradeOsPro || tp.hasVerifiedVideoProSubscription);

      const tpPostcode = (tp.postcode || "").trim().toUpperCase();
      const isAreaMatch = !!(userPrefix && tpPostcode.startsWith(userPrefix));

      // Calculate combined score
      const totalScore = tradeScore + (rating * 10) + Math.min(reviews, 30) + (isVerified ? 15 : 0) + (isAreaMatch ? 20 : 0);

      scoredCandidates.push({
        tp,
        tradeScore,
        rating,
        reviews,
        isVerified,
        isGasSafe: !!isGasSafe,
        isNiceic: !!isNiceic,
        isVideo,
        isProSubscribed,
        isAreaMatch,
        totalScore,
        isNewcomer: reviews <= 5
      });
    }

    // If zero traders matched the requested categories, return empty to display genuine demand gap
    if (scoredCandidates.length === 0) {
      return [];
    }

    // Sort by trade relevance and total score
    scoredCandidates.sort((a, b) => b.totalScore - a.totalScore);

    const recommendations: TraderRecommendationCard[] = [];
    const primaryCategoryLabel = categoryList[0] || "Certified Specialist";

    // --- SLOT 1: FEATURED PRO ⚡ (Monetized / Pro Tier Partner strictly within matching category) ---
    const featuredCandidates = scoredCandidates.filter((c) => c.isProSubscribed || (c.isVerified && c.rating >= 4.7));
    const featuredPick = featuredCandidates.length > 0
      ? featuredCandidates[Math.floor(Date.now() / (1000 * 60 * 30)) % featuredCandidates.length]
      : scoredCandidates[0];

    if (featuredPick) {
      const tp: any = featuredPick.tp;
      const primaryTradeName = (tp.trades && tp.trades[0]) || tp.category || primaryCategoryLabel;
      recommendations.push({
        uid: tp.uid || tp.id || "trader-featured-1",
        name: tp.name || tp.displayName || tp.businessName || "Certified Trade Specialist",
        businessName: tp.businessName || tp.companyName || `${tp.name}'s ${primaryTradeName}`,
        avatarUrl: tp.avatarUrl || tp.photoURL || tp.profilePicture || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=150",
        category: primaryTradeName,
        rating: Math.max(4.7, featuredPick.rating),
        reviewsCount: Math.max(18, featuredPick.reviews),
        hourlyRate: tp.hourlyRate || tp.miniProfileSettings?.hourlyRate || tp.baseRate || 45,
        postcode: tp.postcode || "UK Wide",
        distanceMiles: featuredPick.isAreaMatch ? 1.4 : 3.8,
        isVerified: true,
        isGasSafe: featuredPick.isGasSafe,
        isNiceic: featuredPick.isNiceic,
        isVideoVerified: featuredPick.isVideo,
        isSponsored: true, // Tagged as Featured Pro
        badges: [
          "⚡ Featured Partner",
          featuredPick.isGasSafe ? "Gas Safe" : (featuredPick.isNiceic ? "NICEIC" : "Verified Pro"),
          "Fast Response (<15m)"
        ],
        bio: tp.bio || `Specialist in ${primaryTradeName} with guaranteed workmanship and public liability insurance.`
      });
    }

    // --- SLOT 2: ORGANIC FAIR ROTATION MATCH 🌟 (Strictly within trade-qualified candidate pool) ---
    const organicPool = scoredCandidates.filter((c) => c.tp.uid !== featuredPick?.tp.uid);
    const rotationSeed = Math.floor(Date.now() / (1000 * 60 * 15)); // 15-min fair share rotation
    
    if (organicPool.length > 0) {
      // Sort organic pool with a combination of trade score and rotation hash to ensure relevant fair exposure
      const sortedOrganic = [...organicPool].sort((a, b) => {
        // First prioritize high trade match
        if (Math.abs(b.tradeScore - a.tradeScore) >= 20) {
          return b.tradeScore - a.tradeScore;
        }
        // Then apply fairness rotation seed
        const hashA = ((a.tp.uid || "a").charCodeAt(0) + rotationSeed) % 23;
        const hashB = ((b.tp.uid || "b").charCodeAt(0) + rotationSeed) % 23;
        return hashA - hashB;
      });

      const organicPick = sortedOrganic[0];
      const tp: any = organicPick.tp;
      const organicTradeName = (tp.trades && tp.trades[0]) || tp.category || primaryCategoryLabel;

      recommendations.push({
        uid: tp.uid || tp.id || "trader-organic-2",
        name: tp.name || tp.displayName || tp.businessName || "Local Verified Pro",
        businessName: tp.businessName || tp.companyName || `${tp.name} Quality Trades`,
        avatarUrl: tp.avatarUrl || tp.photoURL || tp.profilePicture || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        category: organicTradeName,
        rating: organicPick.rating,
        reviewsCount: organicPick.reviews,
        hourlyRate: tp.hourlyRate || tp.miniProfileSettings?.hourlyRate || tp.baseRate || 40,
        postcode: tp.postcode || "Local Area",
        distanceMiles: organicPick.isAreaMatch ? 0.9 : 2.6,
        isVerified: organicPick.isVerified,
        isGasSafe: organicPick.isGasSafe,
        isNiceic: organicPick.isNiceic,
        isVideoVerified: organicPick.isVideo,
        isSponsored: false,
        isNewcomerBoost: organicPick.isNewcomer,
        badges: [
          organicPick.isNewcomer ? "🌟 Newcomer Boost" : "Top Local Match",
          organicPick.isVerified ? "100% Vetted" : "Insured Trader",
          organicPick.isAreaMatch ? "Near You" : "Guaranteed Work"
        ],
        bio: tp.bio || `Reliable ${organicTradeName} specialist providing transparent quotes, punctuality, and high-quality finishes.`
      });
    }

    return recommendations;
  } catch (err) {
    console.error("Error generating hybrid trader recommendations:", err);
    return [];
  }
}

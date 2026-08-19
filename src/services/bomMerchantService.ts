import { db, collection, doc, setDoc, getDoc, updateDoc, addDoc, serverTimestamp, query, where, onSnapshot } from "@/src/firebase";
import { calculateMaterialMerchantAffiliateCommission, MaterialMerchantAffiliateBreakdown } from "./stripeIntegrationService";
import { getApiUrl } from "@/src/lib/apiUrl";

export interface BOMItem {
  id: string;
  name: string;
  sku?: string;
  category: "Plumbing & Heating" | "Electrical" | "Building & Timber" | "Fixings & Consumables" | "Tiling & Flooring" | "Decorating" | "Tools & PPE" | "General";
  quantity: number;
  unit: string; // "units" | "lengths (2m)" | "packs" | "tubs (20kg)" | "rolls" | "meters" | "boxes"
  unitCost: number; // Trade price
  retailCost: number; // Retail price
  totalCost: number;
  suggestedSupplier: string; // "Screwfix" | "Toolstation" | "Travis Perkins" | "City Plumbing" | "B&Q TradePoint" | "Jewson"
  compatibilityNotes?: string; // e.g. "Verified with Worcester Bosch 30i boiler spec", "15mm copper compression"
  stockStatus: "in_stock_1hr" | "in_stock_today" | "next_day_delivery" | "low_stock";
  isPassportComponent?: boolean;
}

export interface MerchantBranch {
  name: string;
  brand: string;
  address: string;
  distanceMiles: number;
  openHours: string;
  clickAndCollectSpeed: string; // "Ready in 1 min", "Ready in 15 mins"
  phone: string;
}

export interface MerchantQuoteComparison {
  merchantName: string;
  brand: "Screwfix" | "Toolstation" | "Travis Perkins" | "City Plumbing" | "B&Q TradePoint" | "Jewson" | "Selco";
  logoColor: string;
  badge: string;
  distanceMiles: number;
  branchAddress: string;
  openHours: string;
  basketTotal: number;
  retailTotal: number;
  tradeSavingsAmount: number;
  tradeSavingsPercent: number;
  inStockCount: number;
  totalItems: number;
  pickSpeed: string;
  affiliateBreakdown: MaterialMerchantAffiliateBreakdown;
  isBestPrice?: boolean;
  isClosest?: boolean;
  isSpecialistPick?: boolean;
  specialistBadgeText?: string;
}

export interface CourierDispatchDetails {
  vanType: "small_van" | "swb_transit" | "lwb_luton";
  vanTypeLabel: string;
  deliveryWindow: "asap_90min" | "early_morning_0800" | "custom_slot";
  scheduledTime: string;
  pickupBranch: string;
  pickupAddress: string;
  deliveryAddress: string;
  estimatedDistanceMiles: number;
  courierFee: number; // e.g. £24.00
  platformCommission: number; // 12% AnyTrader commission = £2.88
  driverPayout: number; // £21.12
  status: "unassigned" | "assigned" | "at_merchant" | "in_transit" | "delivered";
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  vehiclePlate?: string;
  trackingCode?: string;
  notes?: string;
}

export interface BOMOrderRecord {
  id: string;
  jobId: string;
  jobTitle: string;
  tradespersonId: string;
  tradespersonName?: string;
  homeownerId?: string;
  homeownerName?: string;
  propertyId?: string;
  items: BOMItem[];
  itemCount: number;
  selectedMerchant: string;
  merchantBranch?: string;
  subtotalCost: number;
  tradeDiscountAmount: number;
  vatAmount: number;
  totalAmount: number;
  affiliateCommissionEarned: number;
  fulfillmentType: "click_and_collect" | "courier_dispatch";
  pickupReferenceCode: string;
  pickupBarcode: string;
  courierDetails?: CourierDispatchDetails;
  vatInvoiceNumber: string;
  paymentSource: "homeowner_materials_escrow" | "trader_trade_credit" | "stripe_card";
  status: "draft" | "ordered" | "ready_for_pickup" | "out_for_delivery" | "delivered" | "collected";
  propertyPassportSynced: boolean;
  syncedComponentsCount?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Default Trade Merchants Catalog & Specialist Categories
 */
export const TRADE_MERCHANTS = [
  {
    name: "Screwfix Trade",
    brand: "Screwfix" as const,
    logoColor: "bg-blue-600",
    badge: "1-Min Counter Pick",
    defaultDistance: 0.8,
    branchName: "Screwfix Trade Counter (Central Branch)",
    address: "Unit 3 Trade Park, Station Road",
    openHours: "Mon-Fri 06:30 - 20:00 • Sat 07:00 - 18:00",
    pickSpeed: "Ready in 1 min",
    discountRate: 0.08,
    specialistFor: ["Fixings & Consumables", "Electrical", "Plumbing & Heating", "Tools & PPE"]
  },
  {
    name: "Toolstation",
    brand: "Toolstation" as const,
    logoColor: "bg-red-600",
    badge: "Lowest Consumables Price",
    defaultDistance: 1.2,
    branchName: "Toolstation Trade Counter",
    address: "Unit 8 Industrial Estate, High Way",
    openHours: "Mon-Fri 07:00 - 19:00 • Sat 07:00 - 17:00",
    pickSpeed: "Ready in 5 mins",
    discountRate: 0.09,
    specialistFor: ["Fixings & Consumables", "Decorating", "Plumbing & Heating"]
  },
  {
    name: "Travis Perkins",
    brand: "Travis Perkins" as const,
    logoColor: "bg-amber-600",
    badge: "Timber & Heavy Building Specialist",
    defaultDistance: 1.9,
    branchName: "Travis Perkins Builders Merchant",
    address: "West Wharf Way, Trade Central",
    openHours: "Mon-Fri 07:00 - 17:00 • Sat 08:00 - 12:00",
    pickSpeed: "Ready in 15 mins (Yard Ready)",
    discountRate: 0.12,
    specialistFor: ["Building & Timber", "Tiling & Flooring"]
  },
  {
    name: "City Plumbing",
    brand: "City Plumbing" as const,
    logoColor: "bg-emerald-700",
    badge: "Boiler & Heating Parts Specialist",
    defaultDistance: 2.1,
    branchName: "City Plumbing Supplies & PTS",
    address: "Plumbing Hub, 14 Commerce Rd",
    openHours: "Mon-Fri 07:00 - 17:00 • Sat 08:00 - 12:00",
    pickSpeed: "Ready in 10 mins",
    discountRate: 0.14,
    specialistFor: ["Plumbing & Heating"]
  },
  {
    name: "B&Q TradePoint",
    brand: "B&Q TradePoint" as const,
    logoColor: "bg-orange-600",
    badge: "Open 7 Days & Late Evenings",
    defaultDistance: 2.4,
    branchName: "B&Q TradePoint Hub",
    address: "Retail Park, Junction 4",
    openHours: "Mon-Sat 07:00 - 20:00 • Sun 10:00 - 16:00",
    pickSpeed: "Ready in 15 mins",
    discountRate: 0.07,
    specialistFor: ["Decorating", "Tiling & Flooring", "Building & Timber"]
  },
  {
    name: "Jewson",
    brand: "Jewson" as const,
    logoColor: "bg-blue-800",
    badge: "Aggregates & Sheet Materials",
    defaultDistance: 3.1,
    branchName: "Jewson Builders Merchant",
    address: "Docklands Yard, Pier 5",
    openHours: "Mon-Fri 07:00 - 17:00",
    pickSpeed: "Ready in 20 mins",
    discountRate: 0.11,
    specialistFor: ["Building & Timber"]
  }
];

/**
 * Step 1: AI Bill of Materials (BOM) Extraction
 * Calls server endpoint or uses smart domain-specific UK trade fallback
 */
export async function extractBillOfMaterials(params: {
  jobTitle?: string;
  category?: string;
  description?: string;
  quoteMessage?: string;
  quoteMaterialList?: string[];
  propertyPassportSpecs?: {
    boilerBrand?: string;
    boilerModel?: string;
    boilerAge?: string;
    roofCondition?: string;
    epcRating?: string;
    componentRegistry?: any;
    address?: any;
  };
}): Promise<BOMItem[]> {
  try {
    const response = await fetch(getApiUrl("/api/job/extract-bom"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params)
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.items) && data.items.length > 0) {
        return data.items.map((item: any, idx: number) => ({
          id: item.id || `bom_ai_${Date.now()}_${idx}`,
          name: item.name || item.item || "Standard Material",
          sku: item.sku || `SKU-${Math.floor(100000 + Math.random() * 900000)}`,
          category: item.category || inferBOMCategory(item.name || params.category),
          quantity: Math.max(1, parseInt(item.quantity) || 1),
          unit: item.unit || "units",
          unitCost: parseFloat(item.unitCost) || 18.50,
          retailCost: parseFloat(item.retailCost) || (parseFloat(item.unitCost) ? parseFloat(item.unitCost) * 1.25 : 24.00),
          totalCost: (parseFloat(item.unitCost) || 18.50) * (Math.max(1, parseInt(item.quantity) || 1)),
          suggestedSupplier: item.suggestedSupplier || "Screwfix Trade",
          compatibilityNotes: item.compatibilityNotes || (params.propertyPassportSpecs?.boilerModel ? `Compatible with ${params.propertyPassportSpecs.boilerBrand || ''} ${params.propertyPassportSpecs.boilerModel}` : undefined),
          stockStatus: item.stockStatus || "in_stock_1hr",
          isPassportComponent: !!item.isPassportComponent
        }));
      }
    }
  } catch (err) {
    console.warn("AI BOM Extraction server call failed, using intelligent fallback rules:", err);
  }

  // Domain-specific realistic UK fallback BOM based on Job Category & Specs
  return generateFallbackBOM(params);
}

function inferBOMCategory(text: string = ""): BOMItem["category"] {
  const t = text.toLowerCase();
  if (t.includes("boiler") || t.includes("pipe") || t.includes("valve") || t.includes("radiator") || t.includes("tap") || t.includes("plumb") || t.includes("drain")) {
    return "Plumbing & Heating";
  }
  if (t.includes("wire") || t.includes("socket") || t.includes("fuse") || t.includes("cable") || t.includes("light") || t.includes("electr")) {
    return "Electrical";
  }
  if (t.includes("timber") || t.includes("wood") || t.includes("brick") || t.includes("cement") || t.includes("plasterboard") || t.includes("stud")) {
    return "Building & Timber";
  }
  if (t.includes("tile") || t.includes("grout") || t.includes("adhesive") || t.includes("floor") || t.includes("underlay")) {
    return "Tiling & Flooring";
  }
  if (t.includes("paint") || t.includes("brush") || t.includes("filler") || t.includes("primer") || t.includes("sandpaper")) {
    return "Decorating";
  }
  if (t.includes("screw") || t.includes("fixing") || t.includes("sealant") || t.includes("silicone") || t.includes("bolt") || t.includes("anchor")) {
    return "Fixings & Consumables";
  }
  return "General";
}

function generateFallbackBOM(params: {
  jobTitle?: string;
  category?: string;
  description?: string;
  propertyPassportSpecs?: any;
}): BOMItem[] {
  const title = (params.jobTitle || "").toLowerCase();
  const desc = (params.description || "").toLowerCase();
  const cat = (params.category || "").toLowerCase();
  const boilerSpec = params.propertyPassportSpecs?.boilerBrand ? `${params.propertyPassportSpecs.boilerBrand} ${params.propertyPassportSpecs.boilerModel || ''}` : "Standard System";

  if (cat.includes("plumb") || title.includes("boiler") || title.includes("radiator") || title.includes("leak")) {
    return [
      {
        id: `bom_fallback_1`,
        name: "15mm Angled TRV Thermostatic Radiator Valve & Lockshield Pack",
        sku: "SFX-59104",
        category: "Plumbing & Heating",
        quantity: 4,
        unit: "packs",
        unitCost: 14.50,
        retailCost: 19.99,
        totalCost: 58.00,
        suggestedSupplier: "City Plumbing",
        compatibilityNotes: `Fits standard 15mm copper piping (${boilerSpec})`,
        stockStatus: "in_stock_1hr",
        isPassportComponent: true
      },
      {
        id: `bom_fallback_2`,
        name: "15mm Copper Pipe (2 Metre Length - BS EN 1057)",
        sku: "SFX-83141",
        category: "Plumbing & Heating",
        quantity: 3,
        unit: "lengths (2m)",
        unitCost: 8.20,
        retailCost: 11.50,
        totalCost: 24.60,
        suggestedSupplier: "Screwfix Trade",
        compatibilityNotes: "UK Water Regs Part G Compliant",
        stockStatus: "in_stock_1hr"
      },
      {
        id: `bom_fallback_3`,
        name: "Fernox Total Filter TF1 Magnetic System Protector + Inhibitor F1 (500ml)",
        sku: "CP-78210",
        category: "Plumbing & Heating",
        quantity: 1,
        unit: "units",
        unitCost: 89.00,
        retailCost: 115.00,
        totalCost: 89.00,
        suggestedSupplier: "City Plumbing",
        compatibilityNotes: `Warranty requirement for ${boilerSpec}`,
        stockStatus: "in_stock_1hr",
        isPassportComponent: true
      },
      {
        id: `bom_fallback_4`,
        name: "Professional PTFE Thread Seal Tape & 15mm Brass Compression Fittings Pack",
        sku: "TS-39411",
        category: "Fixings & Consumables",
        quantity: 2,
        unit: "packs",
        unitCost: 6.50,
        retailCost: 9.00,
        totalCost: 13.00,
        suggestedSupplier: "Toolstation",
        compatibilityNotes: "WRAS Approved brass fittings",
        stockStatus: "in_stock_1hr"
      }
    ];
  }

  if (cat.includes("tile") || title.includes("bathroom") || title.includes("shower") || title.includes("kitchen")) {
    return [
      {
        id: `bom_fallback_t1`,
        name: "Rapid-Set Flexible Wall & Floor Tile Adhesive (Grey, 20kg)",
        sku: "TP-99214",
        category: "Tiling & Flooring",
        quantity: 3,
        unit: "tubs (20kg)",
        unitCost: 19.80,
        retailCost: 26.50,
        totalCost: 59.40,
        suggestedSupplier: "Travis Perkins",
        compatibilityNotes: "BS 5385 Part 1 Compliant for wetrooms",
        stockStatus: "in_stock_1hr"
      },
      {
        id: `bom_fallback_t2`,
        name: "Mapei Ultracolor Plus Flexible Anti-Mould Grout (Manhattan Grey, 5kg)",
        sku: "SFX-44219",
        category: "Tiling & Flooring",
        quantity: 2,
        unit: "packs",
        unitCost: 15.20,
        retailCost: 19.99,
        totalCost: 30.40,
        suggestedSupplier: "Screwfix Trade",
        compatibilityNotes: "Water repellent with DropEffect technology",
        stockStatus: "in_stock_1hr",
        isPassportComponent: true
      },
      {
        id: `bom_fallback_t3`,
        name: "Everbuild Forever White Anti-Bacterial Sanitary Silicone Sealant (310ml)",
        sku: "TS-10842",
        category: "Fixings & Consumables",
        quantity: 2,
        unit: "units",
        unitCost: 7.40,
        retailCost: 10.50,
        totalCost: 14.80,
        suggestedSupplier: "Toolstation",
        compatibilityNotes: "10 Year Mould Shield Protection",
        stockStatus: "in_stock_1hr"
      }
    ];
  }

  if (cat.includes("electr") || title.includes("socket") || title.includes("fuse") || title.includes("light")) {
    return [
      {
        id: `bom_fallback_e1`,
        name: "MK 2-Gang 13A Double Switched Socket Outlets (White, Pack of 5)",
        sku: "SFX-11234",
        category: "Electrical",
        quantity: 2,
        unit: "packs",
        unitCost: 22.50,
        retailCost: 29.99,
        totalCost: 45.00,
        suggestedSupplier: "Screwfix Trade",
        compatibilityNotes: "BS 1363-2 IET 18th Edition Certified",
        stockStatus: "in_stock_1hr",
        isPassportComponent: true
      },
      {
        id: `bom_fallback_e2`,
        name: "2.5mm² Twin & Earth Cable 6242Y (50m Drum)",
        sku: "TS-90214",
        category: "Electrical",
        quantity: 1,
        unit: "rolls",
        unitCost: 44.00,
        retailCost: 56.00,
        totalCost: 44.00,
        suggestedSupplier: "Toolstation",
        compatibilityNotes: "BASEC Approved copper conductor",
        stockStatus: "in_stock_1hr"
      },
      {
        id: `bom_fallback_e3`,
        name: "Wago 221 Compact Splicing Wire Connectors Assortment Box (50 Pcs)",
        sku: "SFX-33012",
        category: "Fixings & Consumables",
        quantity: 1,
        unit: "boxes",
        unitCost: 16.80,
        retailCost: 21.50,
        totalCost: 16.80,
        suggestedSupplier: "Screwfix Trade",
        compatibilityNotes: "Maintenance-free connection BS 7671",
        stockStatus: "in_stock_1hr"
      }
    ];
  }

  // General building default
  return [
    {
      id: `bom_fallback_g1`,
      name: "Treated C16 Structural Timber (47mm x 100mm x 2.4m Lengths)",
      sku: "TP-55219",
      category: "Building & Timber",
      quantity: 6,
      unit: "lengths (2m)",
      unitCost: 11.20,
      retailCost: 15.80,
      totalCost: 67.20,
      suggestedSupplier: "Travis Perkins",
      compatibilityNotes: "FSC Certified Kiln Dried structural timber",
      stockStatus: "in_stock_1hr"
    },
    {
      id: `bom_fallback_g2`,
      name: "TurboGold High Performance Multi-Purpose Screws (5.0 x 70mm, Tub of 500)",
      sku: "SFX-66120",
      category: "Fixings & Consumables",
      quantity: 1,
      unit: "tubs (20kg)",
      unitCost: 14.99,
      retailCost: 19.50,
      totalCost: 14.99,
      suggestedSupplier: "Screwfix Trade",
      compatibilityNotes: "Double countersunk with anti-split thread",
      stockStatus: "in_stock_1hr"
    },
    {
      id: `bom_fallback_g3`,
      name: "Gorilla Heavy Duty Construction Grab Adhesive (290ml)",
      sku: "TS-88421",
      category: "Fixings & Consumables",
      quantity: 2,
      unit: "units",
      unitCost: 8.50,
      retailCost: 11.90,
      totalCost: 17.00,
      suggestedSupplier: "Toolstation",
      compatibilityNotes: "All-weather instant grab formula",
      stockStatus: "in_stock_1hr"
    }
  ];
}

/**
 * Step 2: Multi-Merchant Price & Proximity Comparison Engine
 */
export function compareMerchantsForBOM(
  items: BOMItem[],
  postcodeArea: string = "SW1"
): MerchantQuoteComparison[] {
  const baseTradeSubtotal = items.reduce((sum, item) => sum + item.totalCost, 0);
  const baseRetailSubtotal = items.reduce((sum, item) => sum + (item.retailCost * item.quantity), 0);

  const comparisons: MerchantQuoteComparison[] = TRADE_MERCHANTS.map((merchant, idx) => {
    // Apply merchant-specific catalog variance & trade discount
    const discountMultiplier = 1 - merchant.discountRate;
    const basketTotal = Math.round(baseTradeSubtotal * discountMultiplier * 100) / 100;
    const retailTotal = Math.round(baseRetailSubtotal * 100) / 100;
    const tradeSavingsAmount = Math.round((retailTotal - basketTotal) * 100) / 100;
    const tradeSavingsPercent = Math.round((tradeSavingsAmount / retailTotal) * 100);

    const affiliateBreakdown = calculateMaterialMerchantAffiliateCommission(
      basketTotal,
      merchant.name,
      items.length
    );

    // Calculate specialist match
    const primaryCategory = items[0]?.category;
    const isSpecialist = merchant.specialistFor.includes(primaryCategory);

    // Distance calculation simulation
    const distanceMiles = Math.round((merchant.defaultDistance + (idx * 0.3)) * 10) / 10;

    return {
      merchantName: merchant.name,
      brand: merchant.brand,
      logoColor: merchant.logoColor,
      badge: merchant.badge,
      distanceMiles,
      branchAddress: `${merchant.branchName}, ${postcodeArea} Postcode Hub`,
      openHours: merchant.openHours,
      basketTotal,
      retailTotal,
      tradeSavingsAmount,
      tradeSavingsPercent,
      inStockCount: Math.min(items.length, items.length - (idx === 3 ? 1 : 0)), // High in-stock simulation
      totalItems: items.length,
      pickSpeed: merchant.pickSpeed,
      affiliateBreakdown,
      isSpecialistPick: isSpecialist,
      specialistBadgeText: isSpecialist ? `Top Pick for ${primaryCategory}` : undefined
    };
  });

  // Sort and flag best prices & closest
  const sorted = [...comparisons].sort((a, b) => a.basketTotal - b.basketTotal);
  const lowestPrice = sorted[0].basketTotal;
  const closestDistance = Math.min(...comparisons.map(c => c.distanceMiles));

  return comparisons.map(c => ({
    ...c,
    isBestPrice: c.basketTotal === lowestPrice,
    isClosest: c.distanceMiles === closestDistance
  }));
}

/**
 * Step 3: Courier Delivery Quote Calculator (Category 84 Van Fleet)
 */
export function calculateCourierDispatchQuote(params: {
  vanType: "small_van" | "swb_transit" | "lwb_luton";
  distanceMiles: number;
  deliveryWindow: "asap_90min" | "early_morning_0800" | "custom_slot";
}): {
  courierFee: number;
  platformCommission: number;
  driverPayout: number;
  vanTypeLabel: string;
} {
  let baseFee = 18.00; // Small Van base
  let vanTypeLabel = "Small Van (Combo / Caddy / Partner)";

  if (params.vanType === "swb_transit") {
    baseFee = 28.00;
    vanTypeLabel = "SWB Transit / Vivaro (Plasterboard & Aggregates)";
  } else if (params.vanType === "lwb_luton") {
    baseFee = 42.00;
    vanTypeLabel = "LWB Luton / Tail Lift (Bulky Pallets & Timber)";
  }

  // Mileage surcharge (£1.50/mile after 3 miles)
  const extraMiles = Math.max(0, params.distanceMiles - 3);
  const mileageSurcharge = Math.round(extraMiles * 1.50 * 100) / 100;

  // Window surcharge (ASAP 90 min rush is +£6)
  const windowSurcharge = params.deliveryWindow === "asap_90min" ? 6.00 : 0.00;

  const totalFee = Math.round((baseFee + mileageSurcharge + windowSurcharge) * 100) / 100;
  const platformCommission = Math.round(totalFee * 0.12 * 100) / 100; // 12% AnyTrader cut
  const driverPayout = Math.round((totalFee - platformCommission) * 100) / 100;

  return {
    courierFee: totalFee,
    platformCommission,
    driverPayout,
    vanTypeLabel
  };
}

/**
 * Step 4: Persist BOM Order Record & Sync with TradeOS Financials + Property Passport
 */
export async function createBOMOrder(params: {
  jobId: string;
  jobTitle: string;
  tradespersonId: string;
  tradespersonName?: string;
  homeownerId?: string;
  homeownerName?: string;
  propertyId?: string;
  items: BOMItem[];
  selectedMerchant: MerchantQuoteComparison;
  fulfillmentType: "click_and_collect" | "courier_dispatch";
  courierDetails?: CourierDispatchDetails;
  paymentSource: "homeowner_materials_escrow" | "trader_trade_credit" | "stripe_card";
}): Promise<BOMOrderRecord> {
  const orderId = `bom_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const pickupReferenceCode = `AT-${params.selectedMerchant.brand.slice(0, 3).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;
  const vatInvoiceNumber = `VAT-BOM-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
  
  const subtotalCost = params.selectedMerchant.basketTotal;
  const vatAmount = Math.round(subtotalCost * 0.20 * 100) / 100;
  const totalAmount = Math.round((subtotalCost + vatAmount) * 100) / 100;
  const tradeDiscountAmount = params.selectedMerchant.tradeSavingsAmount;
  const affiliateCommissionEarned = params.selectedMerchant.affiliateBreakdown.affiliateCommissionAmount;

  const orderRecord: BOMOrderRecord = {
    id: orderId,
    jobId: params.jobId,
    jobTitle: params.jobTitle,
    tradespersonId: params.tradespersonId,
    tradespersonName: params.tradespersonName || "Verified Tradesperson",
    homeownerId: params.homeownerId,
    homeownerName: params.homeownerName || "Homeowner",
    propertyId: params.propertyId,
    items: params.items,
    itemCount: params.items.length,
    selectedMerchant: params.selectedMerchant.merchantName,
    merchantBranch: params.selectedMerchant.branchAddress,
    subtotalCost,
    tradeDiscountAmount,
    vatAmount,
    totalAmount,
    affiliateCommissionEarned,
    fulfillmentType: params.fulfillmentType,
    pickupReferenceCode,
    pickupBarcode: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pickupReferenceCode)}`,
    courierDetails: params.courierDetails,
    vatInvoiceNumber,
    paymentSource: params.paymentSource,
    status: params.fulfillmentType === "click_and_collect" ? "ready_for_pickup" : "ordered",
    propertyPassportSynced: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    // 1. Save BOM order to Firestore
    await setDoc(doc(db, "bom_orders", orderId), {
      ...orderRecord,
      createdAtServer: serverTimestamp()
    });

    // 2. Update Job record with materials details
    if (params.jobId) {
      await updateDoc(doc(db, "jobs", params.jobId), {
        materialsCost: subtotalCost,
        hasBOMOrder: true,
        bomOrderId: orderId,
        bomMerchant: params.selectedMerchant.merchantName,
        bomStatus: orderRecord.status,
        bomPickupRef: pickupReferenceCode,
        updatedAt: serverTimestamp()
      });
    }

    // 3. Sync to Property Passport if propertyId exists
    if (params.propertyId) {
      await syncBOMToPropertyPassport(params.propertyId, params.items, orderId);
      orderRecord.propertyPassportSynced = true;
    }

    // 4. If Courier Dispatch selected, create Category 84 dispatch in ride_requests
    if (params.fulfillmentType === "courier_dispatch" && params.courierDetails) {
      await addDoc(collection(db, "ride_requests"), {
        serviceCategory: "Courier, Parcel & Express Delivery",
        serviceSubcategory: "Bulky Item & Heavy Appliance Transport",
        categoryCode: "84",
        jobId: params.jobId,
        bomOrderId: orderId,
        pickupAddress: params.courierDetails.pickupAddress,
        dropoffAddress: params.courierDetails.deliveryAddress,
        scheduledDeliveryTime: params.courierDetails.scheduledTime,
        vanType: params.courierDetails.vanType,
        totalFare: params.courierDetails.courierFee,
        platformFee: params.courierDetails.platformCommission,
        driverPayout: params.courierDetails.driverPayout,
        traderId: params.tradespersonId,
        status: "pending",
        urgency: params.courierDetails.deliveryWindow === "asap_90min" ? "emergency" : "scheduled",
        notes: `TradeOS Materials BOM Dispatch from ${params.selectedMerchant.merchantName}. Collection Ref: ${pickupReferenceCode}. Items: ${params.items.length} trade parts.`,
        createdAt: serverTimestamp()
      });
    }
  } catch (err) {
    console.error("Error creating BOM order in Firestore:", err);
  }

  return orderRecord;
}

/**
 * Step 4B: Property Passport Digital Twin Component Sync
 * Registers installed parts, boiler valves, paint codes, and warranty items directly to the passport
 */
export async function syncBOMToPropertyPassport(
  propertyId: string,
  items: BOMItem[],
  orderId: string
): Promise<number> {
  try {
    const propRef = doc(db, "properties", propertyId);
    const propSnap = await getDoc(propRef);

    if (!propSnap.exists()) return 0;

    const propData = propSnap.data();
    const existingRegistry = propData.componentRegistry || {};
    const existingLog = propData.maintenanceLog || [];

    const newInstalledComponents: any[] = [];
    let updatedPaintCodes = existingRegistry.paintCodes || "";

    items.forEach(item => {
      if (item.category === "Decorating" && item.name.toLowerCase().includes("paint")) {
        updatedPaintCodes = updatedPaintCodes ? `${updatedPaintCodes}, ${item.name}` : item.name;
      }

      newInstalledComponents.push({
        id: `comp_${Date.now()}_${item.id}`,
        name: item.name,
        category: item.category,
        sku: item.sku,
        installedDate: new Date().toISOString().split("T")[0],
        supplier: item.suggestedSupplier,
        unitCost: item.unitCost,
        quantity: item.quantity,
        warrantyYears: item.category === "Plumbing & Heating" || item.category === "Electrical" ? 5 : 2,
        orderId
      });
    });

    const newLogEntry = {
      date: new Date().toISOString().split("T")[0],
      title: `TradeOS AI BOM Materials Installed (${items.length} Parts)`,
      cost: items.reduce((sum, i) => sum + i.totalCost, 0),
      orderId,
      items: items.map(i => `${i.quantity}x ${i.name} [${i.sku || 'N/A'}]`)
    };

    await updateDoc(propRef, {
      "componentRegistry.installedParts": [...(existingRegistry.installedParts || []), ...newInstalledComponents],
      "componentRegistry.paintCodes": updatedPaintCodes,
      maintenanceLog: [newLogEntry, ...existingLog],
      lastMaterialsUpdate: serverTimestamp()
    });

    return newInstalledComponents.length;
  } catch (err) {
    console.error("Failed to sync BOM to Property Passport:", err);
    return 0;
  }
}

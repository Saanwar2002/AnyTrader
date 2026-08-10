/**
 * AnyTrader & AnyRoller Ecosystem Master Platform Agreement, Terms & Conditions, and Privacy Policy
 * Version: 2026.1
 * Last Updated: August 9, 2026
 */

export const CURRENT_TERMS_VERSION = "2026.1";
export const TERMS_LAST_UPDATED = "August 9, 2026";

export interface TermsSection {
  id: string;
  title: string;
  category: "general" | "privacy" | "trades" | "rides" | "food" | "pets" | "delivery" | "care" | "pricing";
  content: string[];
}

export const TERMS_AND_PRIVACY_SECTIONS: TermsSection[] = [
  {
    id: "section_1_intermediary",
    title: "1. Software Intermediary Role & Total Liability Exemption",
    category: "general",
    content: [
      "1.1 Platform Nature: AnyTrader (incorporating AnyRoller, TradeOS, Gotham Housing Portal, and associated digital services) operates strictly and exclusively as an independent technology platform, software intermediary, and digital venue.",
      "1.2 Independent Contracting: All tradespeople, transport providers, taxi/PHV drivers, food vendors, pet carers, couriers, care assistants, and service professionals ('Service Providers') using the platform are independent self-employed sole traders or independent corporate entities. They are NOT employees, agents, partners, joint venturers, or vicarious representatives of AnyTrader.",
      "1.3 Direct Contractual Relationship: Any contract, agreement, quote, work specification, or transaction entered into for services, repairs, rides, meals, pet care, delivery, or caregiving is solely between the Customer and the Service Provider. AnyTrader is not a party to such contracts.",
      "1.4 Absolute Exclusion of Liability: To the maximum extent permitted by applicable law (including the UK Consumer Rights Act 2015 and E-Commerce Regulations), AnyTrader excludes all liability for any direct, indirect, incidental, punitive, special, or consequential loss, damage, property damage, personal injury, delay, financial loss, breach of statutory duty, or dispute arising out of or in connection with work executed, services rendered, rides completed, or goods delivered by Service Providers.",
      "1.5 No Guarantee of Outcomes: While AnyTrader provides trust badges, identity verifications, rating scores, and video credentials, these tools are for informational and matching optimization purposes only. AnyTrader does not warrant or guarantee the accuracy, completeness, skill level, solvency, or suitability of any Service Provider."
    ]
  },
  {
    id: "section_2_pricing_and_fees",
    title: "2. Commercial Pricing, Tiers, Commissions, Fees & Unilateral Right of Modification",
    category: "pricing",
    content: [
      "2.1 Platform Fee Rights: AnyTrader reserves the absolute, unrestricted, and unilateral right to establish, modify, adjust, introduce, or terminate any Pricing Tiers (e.g. Free, PAYG, Starter, Growth, Enterprise, Pro), Commission Rates (e.g. 12% split-payments), Lead Fees, Subscription Charges, B2B Per-Door SaaS Rates (e.g. £4.50/£3.50/£2.50 per door), Platform Convenience Surcharges, and Cancellation Fees at any time.",
      "2.2 No Mandatory Prior Individual Notice: Commercial fee adjustments, promotional pricing rollouts, commission rate updates, and subscription tier modifications may be implemented by AnyTrader without prior individual written notice to users.",
      "2.3 Price Display at Time of Transaction: Any applicable commission, convenience fee, or tier charge will be displayed or calculated at the point of booking, quote submission, or invoice settlement. Continued use of the platform following fee updates constitutes irrevocable acceptance.",
      "2.4 Non-Refundable Platform Fees: All platform commission deductions, software tier subscriptions, lead connection fees, and verification processing fees paid to AnyTrader are non-refundable, except where required by mandatory statutory law."
    ]
  },
  {
    id: "section_3_marketing_partner_data",
    title: "3. Marketing, Promotional Communications, Partner Data Sharing & Cross-Selling",
    category: "privacy",
    content: [
      "3.1 Promotional Use of Contact Info: By agreeing to these Terms and providing contact details (Email, Phone Number, WhatsApp, Postal Address), users acknowledge and consent that AnyTrader may utilize their contact information to communicate operational updates, promotional offers, cross-selling materials, and platform service announcements.",
      "3.2 Cross-Selling Ancillary Services: AnyTrader may present, cross-sell, or recommend relevant third-party and partner services—including home and landlord insurance, trade tool hire, building material sourcing, vehicle fleet leasing, BNPL repair financing ('FlexiPay'), energy efficiency upgrades, and warranty products.",
      "3.3 Partner & Supplier Data Sharing: Subject to user privacy preferences and statutory regulations (including UK PECR and UK GDPR), AnyTrader may share job specifications, anonymized operational requirements, or lead contact details with vetted trade material merchants (e.g., Travis Perkins, Jewson, Screwfix), insurance underwriters, material logistics providers, and financing partners solely to facilitate job execution, material procurement, or pre-approved financing.",
      "3.4 Granular Preference Controls: Users maintain full control over their marketing and partner data-sharing preferences via their Account Profile settings, where optional marketing and partner deal notifications can be toggled on or off at any time."
    ]
  },
  {
    id: "section_4_trades_gotham_passports",
    title: "4. Trades, Property Passports & Gotham B2B Social Housing Terms",
    category: "trades",
    content: [
      "4.1 Property Passport Digital Twins: Property specifications, EPC ratings, CP12 Gas Safety certifications, EICR electrical records, and maintenance logs recorded in Property Passports represent digital reference twins. Landlords and homeowners remain legally responsible for statutory compliance.",
      "4.2 Gotham B2B Social Housing Portal: B2B estate managers, local councils, and housing associations using Gotham SaaS per-door licensing must ensure tenant data provided for repair reporting complies with local housing regulations.",
      "4.3 Awaab's Law Damp & Mould Compliance: Gotham portal SLA timers (24h Emergency Investigation, 14d Remediation) provide workflow automation alerts. AnyTrader is not liable for statutory penalties incurred by landlords or social housing providers for missed statutory windows.",
      "4.4 Emergency & 1-Tap Specs Dispatch: Dispatching emergency jobs or pre-loaded Property Passport specifications constitutes immediate authorization for tradesperson contact."
    ]
  },
  {
    id: "section_5_anyroller_rides",
    title: "5. AnyRoller Passenger Transport & Driver Terminal Terms",
    category: "rides",
    content: [
      "5.1 Independent Private Hire Operators: Drivers operating on AnyRoller are independent licensed Private Hire Vehicle (PHV) or Hackney Carriage operators holding valid council licenses and commercial hire insurance.",
      "5.2 GPS Tracking & Live Terminal: Passengers and drivers consent to high-accuracy GPS tracking during active sessions for safety, navigation, split-payment calculations, and ETA estimations.",
      "5.3 Passenger Conduct & Cleanliness: Passengers must treat drivers and vehicles with respect. Drivers reserve the right to cancel rides for unruly behavior, intoxication, or safety threats. Spoilage or vehicle damage fees up to £150 may be charged to the passenger payment method on file.",
      "5.4 Split Payments & Commission: Fare amounts are processed via Stripe Connect, automatically deducting AnyRoller's 12% platform commission and dispatching net driver earnings directly."
    ]
  },
  {
    id: "section_6_verticals_food_pets_delivery_care",
    title: "6. Specialized Platform Verticals (Food Safety, Pet Care, Delivery & Care Services)",
    category: "general",
    content: [
      "6.1 Food Safety, Catering & Kitchen Prep: Food vendors and caterers must comply with Food Standards Agency (FSA) regulations, possess valid local authority food hygiene ratings (minimum 3+), and adhere to Natasha's Law allergen labeling. AnyTrader assumes zero liability for foodborne illness, allergic reactions, or catering delays.",
      "6.2 Pet Care, Boarding & Dog Walking: Pet carers and dog walkers must comply with the Animal Welfare Act 2006 and local council licensing for pet boarding. Owners warrant that pets are vaccinated, non-aggressive, and microchipped. Owners authorize emergency veterinary care up to a pre-set spending limit (£250) in case of injury or illness during a session.",
      "6.3 On-Demand Delivery & Bulky Goods Courier: Couriers carrying bulky items, appliances (washing machines, fridges), or marketplace pickups must ensure vehicles do not exceed legal weight limits. Couriers are independent transporters and must maintain Goods in Transit insurance. Prohibited items include hazardous chemicals, illegal substances, and unsecured firearms.",
      "6.4 Care Services & Domestic Support: Care workers and personal assistants listed on the platform must hold current DBS (Disclosure and Barring Service) certificates where required. Services are restricted to non-medical personal assistance, companionship, and housekeeping. AnyTrader does not provide CQC-regulated medical nursing care."
    ]
  },
  {
    id: "section_7_benchmark_clauses",
    title: "7. Benchmark Industry Rules (Non-Circumvention, Solvency, UGC License & Distance Selling)",
    category: "general",
    content: [
      "7.1 Non-Circumvention & Fee Avoidance: Users are strictly forbidden from circumventing the platform by introducing customers or tradespeople through AnyTrader/AnyRoller and subsequently negotiating, accepting, or completing payments off-platform to avoid platform fees or commissions. Violations incur an administrative fee of £500 per instance and immediate permanent account suspension.",
      "7.2 Solvency & Payment Defaults: Customers warrant that they have sufficient funds prior to posting paid jobs or booking rides. In the event of a chargeback, bounced transfer, or default, AnyTrader reserves the right to suspend the user account and initiate collection proceedings.",
      "7.3 User-Generated Content (UGC) & Photo/Video License: By posting job photos, video verification selfies, reviews, or project portfolios, users grant AnyTrader a worldwide, non-exclusive, royalty-free, perpetual, transferable license to use, reproduce, display, and distribute such media for platform operation, marketing, advertising, and AI model training/verification.",
      "7.4 Zero-Tolerance Harassment & Account Termination: AnyTrader maintains a strict zero-tolerance policy against discrimination, verbal abuse, harassment, fraud, or unsafe conduct. AnyTrader reserves the absolute right to suspend or terminate any account instantly without refund.",
      "7.5 Distance Selling & Cancellation Waiver: By requesting instant trade dispatch, emergency repair, or immediate ride/courier pickup, users expressly request immediate performance of services and waive their standard 14-day statutory right of cancellation under the Consumer Contracts Regulations 2013 once performance has begun.",
      "7.6 AI Automated Profiling Disclosures: Users acknowledge that AnyTrader uses automated artificial intelligence engines (including Gemini AI models) for 40+ signal trade matching, lead quality scoring, fraud prevention scanning, and price benchmark estimation."
    ]
  },
  {
    id: "section_8_privacy_policy",
    title: "8. UK GDPR & Data Protection Act 2018 Privacy Policy",
    category: "privacy",
    content: [
      "8.1 Data Controller & Processor Roles: AnyTrader acts as Data Controller for user profile data, billing records, and platform analytics, and as Data Processor for job-matching communications between customers and Service Providers.",
      "8.2 Categories of Data Collected: Data collected includes Identity Data (Name, Email, Phone), Location Data (GPS coordinates, job postcodes), Property Data (Passport specs, EPC, boiler models), Verification Data (DBS, Gas Safe numbers, driver licenses, video selfies), and Transaction Data (Stripe tokens, invoice history).",
      "8.3 Legal Basis for Processing: Processing is necessary for the performance of the platform contract, compliance with legal/tax obligations, legitimate security interests, and explicit user consent for marketing.",
      "8.4 User Data Rights: Under UK GDPR, users have the right to access, rectify, port, or request erasure of their personal data, or restrict processing, accessible via Profile settings or by contacting privacy@anytrader.app.",
      "8.5 Retention & Security: Data is retained for as long as the account remains active, plus mandatory statutory tax retention periods (6 years for invoicing/financial records). Data is encrypted in transit (TLS 1.3) and at rest using enterprise Firebase Firestore infrastructure."
    ]
  }
];

export const PRIVACY_SUMMARY_POINTS = [
  "Strict Data Encryption: Your personal data is encrypted in transit and at rest using enterprise Firestore security.",
  "Your Rights: Access, export, or delete your data anytime via Profile Settings.",
  "Operational Sharing Only: We only share your job details with matched, verified service providers to complete your requested work.",
  "Granular Marketing Control: You can opt in or out of promotional offers and partner discounts anytime without losing access to core platform services.",
  "Zero Unapproved Selling: We never sell your personal contact details to unvetted third-party data brokers."
];

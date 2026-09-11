export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'customer' | 'tradesperson' | 'business' | 'driver' | 'fleet_driver' | 'admin' | 'ecosystem_manager';
  tierId?: string;
  subscriptionType?: string;
  isFoundingMember?: boolean;
  isVerified?: boolean;
  stripeCustomerId?: string;
  stripeAccountId?: string;
  // Let the rest be dynamic as we adopt strict mode gradually
  [key: string]: any;
}

export interface PublicJobCard {
  id: string;
  jobNo?: string;
  category: string;
  subCategory?: string;
  title: string;
  description: string;
  postcodeArea?: string;
  city?: string;
  area?: string;
  urgency?: string;
  status: string;
  estimateMin?: number;
  estimateMax?: number;
  postedDate?: any;
  createdAt?: any;
  updatedAt?: any;
  quoteCount?: number;
  isBoosted?: boolean;
  boostTier?: string | null;
  isInstantMatch?: boolean;
  targetTradespersonId?: string | null;
  targetTradespersonName?: string | null;
  exclusiveUntil?: any;
  photosCount?: number;
  videosCount?: number;
  documentsCount?: number;
  propertyId?: string | null;
  [key: string]: any;
}

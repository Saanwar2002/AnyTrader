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

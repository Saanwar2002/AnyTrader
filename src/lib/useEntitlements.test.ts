import { describe, it, expect } from 'vitest';
import { resolveTier } from './useEntitlements';

describe('resolveTier', () => {
  it('defaults to PAYG when profile is null or undefined', () => {
    expect(resolveTier(null)).toBe('PAYG');
    expect(resolveTier(undefined)).toBe('PAYG');
  });

  it('maps Founding Members to Silver Professional if tier is missing or free trial', () => {
    expect(resolveTier({ isFoundingMember: true })).toBe('Silver Professional');
    expect(resolveTier({ isFoundingMember: true, tierId: "Free Trial" })).toBe('Silver Professional');
    // But doesn't override if they upgraded to Elite
    expect(resolveTier({ isFoundingMember: true, tierId: "Elite" })).toBe('Gold Elite');
  });

  it('maps strings to the correct ProviderTierName', () => {
    expect(resolveTier({ tierId: 'Pro' })).toBe('Silver Professional');
    expect(resolveTier({ tierId: 'Silver Professional' })).toBe('Silver Professional');
    expect(resolveTier({ tierId: 'Professional Tier' })).toBe('Silver Professional');

    expect(resolveTier({ tierId: 'Elite' })).toBe('Gold Elite');
    expect(resolveTier({ tierId: 'Premium Package' })).toBe('Gold Elite');

    expect(resolveTier({ tierId: 'Enterprise' })).toBe('Platinum Enterprise');
    expect(resolveTier({ tierId: 'Powerhouse' })).toBe('Platinum Enterprise');
  });
});

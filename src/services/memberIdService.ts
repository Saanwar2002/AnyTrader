import { db, doc, runTransaction, increment, getDoc } from "../firebase";

export type MemberRolePrefix = 'T' | 'H' | 'B' | 'D';

export async function generateMemberId(role: string): Promise<{ memberId: string, memberSequence: number }> {
  let prefix: MemberRolePrefix = 'H';
  
  if (role === 'tradesperson') prefix = 'T';
  else if (role === 'business') prefix = 'B';
  else if (role === 'driver') prefix = 'D';
  else if (role === 'homeowner') prefix = 'H';

  const counterRef = doc(db, "platform_counters", "member_id");

  return (await runTransaction(db, async (transaction: any) => {
    const counterSnap = await transaction.get(counterRef);
    
    let nextSeq = 10001; // Start standard range at 10001
    
    if (counterSnap.exists()) {
      nextSeq = counterSnap.data().currentValue + 1;
    }
    
    // Check for Founding Member range (1-100)
    // For now, we will handle the 1-100 logic by checking if it's a trader 
    // and if we haven't reached 100 traders yet.
    // However, the user said "all roles share a single atomic sequence counter".
    // "Standard registrations start at 10001".
    // "Founding Range: The first 100 verified traders use IDs T-001 through T-100".
    
    // Refined logic: 
    // We need a separate counter for founding members if we want T-001 to T-100
    // while others start at 10001.
    // Actually, let's stick to the shared sequence but handle the offset.
    
    transaction.set(counterRef, { currentValue: nextSeq }, { merge: true });

    const formattedId = `${prefix}-${nextSeq}`;
    return { memberId: formattedId, memberSequence: nextSeq };
  })) as any;
}

/**
 * Specifically for the first 100 verified traders.
 * This should probably be called when a trader becomes 'verified'.
 */
export async function assignFoundingId(userId: string): Promise<string | null> {
  const foundingCounterRef = doc(db, "platform_counters", "founding_trader_id");
  const userRef = doc(db, "users", userId);

  return (await runTransaction(db, async (transaction: any) => {
    const counterSnap = await transaction.get(foundingCounterRef);
    const userSnap = await transaction.get(userRef);

    if (!userSnap.exists()) return null;
    const userData = userSnap.data();

    if (userData.isFoundingMember) return userData.memberId;

    let nextSeq = 1;
    if (counterSnap.exists()) {
      nextSeq = counterSnap.data().currentValue + 1;
    }

    if (nextSeq > 100) return null; // Only first 100

    transaction.set(foundingCounterRef, { currentValue: nextSeq }, { merge: true });
    
    const formattedId = `T-${nextSeq.toString().padStart(3, '0')}`;
    
    transaction.update(userRef, {
      memberId: formattedId,
      memberSequence: nextSeq,
      isFoundingMember: true
    });

    return formattedId;
  })) as any;
}

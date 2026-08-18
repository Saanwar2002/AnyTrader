/**
 * AnyTrader Property Passport & Digital Twin Utility
 * Health scoring, Transfer Code generator, and Component Registry helpers.
 */

export interface PropertyHealthScore {
  totalScore: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D';
  gradeColor: string;
  epcScore: number;
  gasScore: number;
  eicrScore: number;
  boilerScore: number;
  roofScore: number;
  isGasCompliant: boolean;
  isEicrCompliant: boolean;
  activeWarrantiesCount: number;
  maintenanceInvestmentTotal: number;
}

export function calculatePropertyHealthScore(property: any, completedJobs: any[] = []): PropertyHealthScore {
  const today = new Date().toISOString().split('T')[0];

  // 1. EPC Rating (Max 25 pts)
  const epc = (property?.epcRating || 'C').toUpperCase();
  let epcScore = 15;
  if (epc === 'A') epcScore = 25;
  else if (epc === 'B') epcScore = 22;
  else if (epc === 'C') epcScore = 18;
  else if (epc === 'D') epcScore = 12;
  else if (epc === 'E') epcScore = 7;
  else epcScore = 4;

  // 2. Gas Safety CP12 (Max 20 pts)
  const gasExpiry = property?.gasSafetyExpiry || '';
  const isGasCompliant = Boolean(gasExpiry && gasExpiry > today);
  const gasScore = isGasCompliant ? 20 : (gasExpiry ? 5 : 0);

  // 3. Electrical Safety EICR (Max 20 pts)
  const eicrExpiry = property?.eicrExpiry || '';
  const isEicrCompliant = Boolean(eicrExpiry && eicrExpiry > today);
  const eicrScore = isEicrCompliant ? 20 : (eicrExpiry ? 5 : 0);

  // 4. Boiler & Heating Health (Max 20 pts)
  const boilerAge = Number(property?.boilerInfo?.age) || 5;
  const boilerServiced = property?.boilerInfo?.lastServiced || '';
  let boilerScore = 10;
  if (boilerAge <= 3) boilerScore += 5;
  else if (boilerAge <= 7) boilerScore += 3;
  else if (boilerAge > 12) boilerScore -= 3;
  
  if (boilerServiced) {
    const serviceDate = new Date(boilerServiced);
    const monthsAgo = (Date.now() - serviceDate.getTime()) / (1000 * 60 * 60 * 24 * 30.5);
    if (monthsAgo <= 12) boilerScore += 5;
    else if (monthsAgo <= 24) boilerScore += 2;
  }
  boilerScore = Math.max(0, Math.min(20, boilerScore));

  // 5. Roof & Structure (Max 15 pts)
  const roof = property?.roofCondition || 'Good';
  let roofScore = 10;
  if (roof === 'Excellent' || roof === 'New (<5 yrs)') roofScore = 15;
  else if (roof === 'Good') roofScore = 12;
  else if (roof === 'Fair') roofScore = 7;
  else roofScore = 3;

  const totalScore = Math.min(100, Math.max(0, epcScore + gasScore + eicrScore + boilerScore + roofScore));

  let grade: 'A+' | 'A' | 'B' | 'C' | 'D' = 'C';
  let gradeColor = 'text-amber-600 bg-amber-50 border-amber-300';
  if (totalScore >= 90) {
    grade = 'A+';
    gradeColor = 'text-emerald-700 bg-emerald-50 border-emerald-300';
  } else if (totalScore >= 80) {
    grade = 'A';
    gradeColor = 'text-emerald-600 bg-emerald-50 border-emerald-300';
  } else if (totalScore >= 68) {
    grade = 'B';
    gradeColor = 'text-blue-600 bg-blue-50 border-blue-300';
  } else if (totalScore >= 50) {
    grade = 'C';
    gradeColor = 'text-amber-600 bg-amber-50 border-amber-300';
  } else {
    grade = 'D';
    gradeColor = 'text-red-600 bg-red-50 border-red-300';
  }

  // Active Warranties
  const activeWarrantiesCount = completedJobs.filter(j => j.warrantyMonths || j.agreedAmount > 500).length;
  const maintenanceInvestmentTotal = completedJobs.reduce((sum, j) => sum + (Number(j.agreedAmount || j.budget) || 0), 0);

  return {
    totalScore,
    grade,
    gradeColor,
    epcScore,
    gasScore,
    eicrScore,
    boilerScore,
    roofScore,
    isGasCompliant,
    isEicrCompliant,
    activeWarrantiesCount,
    maintenanceInvestmentTotal
  };
}

/**
 * Generates an 8-character uppercase cryptographic transfer claim code (e.g. TRF-8K92X4)
 */
export function generateTransferCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'TRF-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

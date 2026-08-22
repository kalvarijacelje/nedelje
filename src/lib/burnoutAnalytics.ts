import { ServiceSunday, Person } from '../types';

export type BurnoutLevel = 'exempt' | 'overloaded' | 'balanced' | 'available';

export interface BurnoutStatusResult {
  status: BurnoutLevel;
  consecutiveSundays: number;
  totalMonth: number;
  isExempt: boolean;
  badge: string;
  labelSl: string;
  labelEn: string;
  colorClass: string;
  recommendationSl?: string;
  recommendationEn?: string;
}

// Check if a person is the main pastor or full-time staff exempt from volunteer fatigue flags
export function isExemptFromBurnout(personNameOrObj: string | Person, people?: Person[]): boolean {
  if (!personNameOrObj) return false;

  let name = typeof personNameOrObj === 'string' ? personNameOrObj : (personNameOrObj?.name || '');
  if (!name) return false;

  let personObj = typeof personNameOrObj === 'object' ? personNameOrObj : (people || []).find(p => p && p.name === name);

  if (personObj) {
    if (personObj.isPastorOrStaff || personObj.excludeFromBurnout) return true;
  }

  const lowerName = name.toLowerCase();
  // Known default pastors / full-time ministers
  if (
    lowerName.includes('pastor') ||
    lowerName.includes('aleš lajlar') ||
    lowerName.includes('ales lajlar') ||
    lowerName.includes('pridigar') ||
    lowerName.includes('glavni pastor')
  ) {
    return true;
  }

  return false;
}

// Calculate serving frequency & consecutive Sundays for a person
export function calculatePersonBurnoutStatus(
  personName: string,
  sundays: ServiceSunday[] = [],
  people?: Person[]
): BurnoutStatusResult {
  const cleanName = (personName || '').trim();
  if (!cleanName) {
    return {
      status: 'available',
      consecutiveSundays: 0,
      totalMonth: 0,
      isExempt: false,
      badge: '⚪',
      labelSl: 'Neznano',
      labelEn: 'Unknown',
      colorClass: 'bg-slate-100 text-slate-700 border-slate-300 font-normal',
    };
  }

  const isExempt = isExemptFromBurnout(cleanName, people);

  if (isExempt) {
    return {
      status: 'exempt',
      consecutiveSundays: 0,
      totalMonth: 0,
      isExempt: true,
      badge: '👑',
      labelSl: 'Izvzet (Glavni pastor / stalno osebje)',
      labelEn: 'Exempt (Pastor / Full-time staff)',
      colorClass: 'bg-purple-100 text-purple-900 border-purple-300 font-semibold',
      recommendationSl: 'Prisotnost vsako nedeljo je del redne službe',
      recommendationEn: 'Presence every Sunday is part of regular ministry duties',
    };
  }

  // Calculate maximum consecutive Sundays served in the scheduled list
  let maxConsecutive = 0;
  let currentConsecutive = 0;
  let totalServed = 0;

  (sundays || []).forEach((sunday) => {
    let isAssignedOnSunday = false;
    Object.values(sunday?.assignments || {}).forEach((roster) => {
      if (Array.isArray(roster) && roster.some(n => typeof n === 'string' && n.trim() === cleanName)) {
        isAssignedOnSunday = true;
      }
    });

    if (isAssignedOnSunday) {
      currentConsecutive++;
      totalServed++;
      if (currentConsecutive > maxConsecutive) {
        maxConsecutive = currentConsecutive;
      }
    } else {
      currentConsecutive = 0;
    }
  });

  // Evaluate status
  if (maxConsecutive >= 3) {
    return {
      status: 'overloaded',
      consecutiveSundays: maxConsecutive,
      totalMonth: totalServed,
      isExempt: false,
      badge: '🔴',
      labelSl: 'Preobremenjen (3+ zaporedne nedelje)',
      labelEn: 'Overloaded (3+ consecutive Sundays)',
      colorClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
      recommendationSl: 'Priporočljiv je 1 teden počitka za preprečevanje izgorelosti',
      recommendationEn: '1 week of rest is recommended to prevent volunteer fatigue',
    };
  } else if (totalServed >= 1) {
    return {
      status: 'balanced',
      consecutiveSundays: maxConsecutive,
      totalMonth: totalServed,
      isExempt: false,
      badge: '🟢',
      labelSl: 'Uravnoteženo (1–2x na mesec)',
      labelEn: 'Balanced (1–2 times a month)',
      colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-medium',
      recommendationSl: 'Optimalna obremenitev službe',
      recommendationEn: 'Optimal serving frequency',
    };
  } else {
    return {
      status: 'available',
      consecutiveSundays: 0,
      totalMonth: 0,
      isExempt: false,
      badge: '⚪',
      labelSl: 'Na voljo (>30 dni brez službe)',
      labelEn: 'Available (Not served in >30 days)',
      colorClass: 'bg-slate-100 text-slate-700 border-slate-300 font-normal',
      recommendationSl: 'Neizkoriščen sodelavec - pripravljen za razpored',
      recommendationEn: 'Underutilized team member - ready to schedule',
    };
  }
}

// Summary stats across entire church roster
export function getBurnoutSummaryStats(sundays: ServiceSunday[] = [], people: Person[] = []) {
  let overloadedCount = 0;
  let balancedCount = 0;
  let availableCount = 0;
  let exemptCount = 0;

  const overloadedPeople: { name: string; consecutive: number }[] = [];
  const availablePeople: { name: string }[] = [];

  (people || []).forEach((p) => {
    if (!p || !p.name) return;
    const res = calculatePersonBurnoutStatus(p.name, sundays, people);
    if (res.status === 'exempt') {
      exemptCount++;
    } else if (res.status === 'overloaded') {
      overloadedCount++;
      overloadedPeople.push({ name: p.name, consecutive: res.consecutiveSundays });
    } else if (res.status === 'balanced') {
      balancedCount++;
    } else {
      availableCount++;
      availablePeople.push({ name: p.name });
    }
  });

  return {
    overloadedCount,
    balancedCount,
    availableCount,
    exemptCount,
    overloadedPeople,
    availablePeople,
  };
}

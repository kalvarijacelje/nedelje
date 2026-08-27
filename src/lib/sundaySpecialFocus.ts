import { ServiceSunday, SpecialSundayFocus, CommunionCheckitem, Ministry } from '../types';
import { resolveMinistryAssignments } from '../utils/worshipSync';
import { parseEuropeanDate } from '../utils/dateUtils';

export const DEFAULT_COMMUNION_CHECKLIST: CommunionCheckitem[] = [
  { id: 'chk-1', textSl: 'Pripravi brezglutenski kruh in navadne kruhke', done: true },
  { id: 'chk-2', textSl: 'Pripravi grozdni sok (brez alkohola) v posamične kozarčke', done: true },
  { id: 'chk-3', textSl: 'Postavi pladnje in prtičke na mizo pred oder pred 09:30', done: false },
  { id: 'chk-4', textSl: 'Preveri mikrofon za voditelja Gospodove Večerje in kratek nagovor', done: false },
  { id: 'chk-5', textSl: 'Pospravi pladnje po bogoslužju in pomij posodice', done: false }
];

export const SAMPLE_FAMILY_PRAYER_LIST = [
  { familyName: 'Družina Lajlar (Aleš & Whitney)', sphere: 'Vodstvo cerkve, založništvo in soseska v Celju', prayer: 'Za modrost pri vodenju, zdravje družine in blagoslov pri delu z otroki in mladimi.' },
  { familyName: 'Družina Novak (Marko & Maja)', sphere: 'Šolstvo, lokalno podjetništvo in sosedje', prayer: 'Za odprta vrata pri pričevanju sodelavcem ter blagoslov otrok v šoli.' },
  { familyName: 'Družina Kovač (Peter & Nina)', sphere: 'Zdravstvo, glasbeno služenje in študentski krog', prayer: 'Za moč pri delu v bolnišnici, navdih pri slavljenju in zdravje.' },
  { familyName: 'Družina Zupan (Luka & Ema)', sphere: 'Tehnologija, mladinsko delo in športni klub', prayer: 'Za mladinsko skupino, finančno stabilnost in povezanost v družini.' },
  { familyName: 'Družina Horvat (Denis & Katja)', sphere: 'Tehnična ekipa, gradbeništvo in lokalna skupnost', prayer: 'Za varnost pri delu, odprta srca sorodnikov in mir v domu.' }
];

/**
  Parse date string like "31. 8. 2025" or "31. 8. 25" or "07.09.2025"
  Returns day of month (e.g. 31) and calculates index of Sunday in month (1..5)
 */
export function getSundayOfMonthIndex(dateStr: string): { day: number; sundayIndex: number; monthName: string } {
  if (!dateStr) return { day: 1, sundayIndex: 1, monthName: 'Avgust' };

  const d = parseEuropeanDate(dateStr);
  if (d.getTime() === 0) return { day: 1, sundayIndex: 1, monthName: 'Avgust' };

  const day = d.getDate();
  const month = d.getMonth() + 1;

  // Calculate Sunday index in month: days 1..7 -> 1st Sunday, 8..14 -> 2nd Sunday, 15..21 -> 3rd Sunday, 22..28 -> 4th Sunday, 29..31 -> 5th Sunday
  const sundayIndex = Math.min(5, Math.max(1, Math.ceil(day / 7)));

  const monthsSl = ['Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij', 'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December'];
  const monthName = monthsSl[(month - 1) % 12] || 'Avgust';

  return { day, sundayIndex, monthName };
}

/**
 * Returns effective SpecialSundayFocus for a given Sunday.
 * If explicitly saved in `sunday.specialFocus`, returns that.
 * Otherwise, auto-derives based on the church pattern:
 * - 2nd and 4th Sunday of month = Communion (Gospodova Večerja)
 * - 1st, 3rd, 5th Sunday of month = Prayer Focus for Family / Person
 */
export function getEffectiveSundayFocus(sunday: ServiceSunday, indexInList = 0): SpecialSundayFocus {
  if (sunday.specialFocus) {
    return sunday.specialFocus;
  }

  const { sundayIndex } = getSundayOfMonthIndex(sunday.date);

  // 2nd or 4th Sunday OR if volunteers are signed up for Communion -> Gospodova Večerja
  const assignedCommunion = sunday.assignments?.['gospodova_vecerja'];
  const hasAssignedCommunion = Array.isArray(assignedCommunion) && assignedCommunion.length > 0 && assignedCommunion[0] !== '/';

  if (sundayIndex === 2 || sundayIndex === 4 || hasAssignedCommunion) {
    return {
      type: 'communion',
      communion: {
        inChargeNames: hasAssignedCommunion ? assignedCommunion : ['Aleš & Whitney'],
        breadType: 'Brezglutenski kruh & navadni kruhki',
        drinkType: 'Grozdni sok (brez alkohola)',
        checklist: DEFAULT_COMMUNION_CHECKLIST,
        notes: 'Gospodova Večerja na 2. in 4. nedeljo v mesecu.'
      }
    };
  }

  // 1st, 3rd, 5th Sunday -> Molitev za Družino / Posameznika
  return {
    type: 'prayer_focus',
    prayerFocus: {
      familyNameOrPerson: '',
      sphereOfInfluence: 'Sfera vpliva, delovno mesto in soseska',
      prayerRequests: 'Molitvene potrebe in blagoslov za družino.',
      encouragementNotes: []
    }
  };
}

/**
 * Checks whether a ministry is applicable on a given Sunday based on weekly rotation rules:
 * - Lord's Supper ('gospodova_vecerja' or rotationType === 'communion'): Active on Communion Sundays (2nd & 4th).
 * - Prayer for Families ('molitev_druzine' or rotationType === 'family_prayer'): Active on Prayer Sundays (1st, 3rd, 5th).
 * - All other ministries are active every week.
 */
export function isMinistryApplicableOnSunday(
  ministryOrId: Ministry | string,
  sunday: ServiceSunday
): boolean {
  const minId = typeof ministryOrId === 'string' ? ministryOrId : ministryOrId.id;
  const rotationType = typeof ministryOrId === 'object' ? ministryOrId.rotationType : undefined;

  const effFocus = getEffectiveSundayFocus(sunday);

  if (minId === 'gospodova_vecerja' || rotationType === 'communion') {
    return effFocus.type === 'communion';
  }

  if (minId === 'molitev_druzine' || rotationType === 'family_prayer') {
    return effFocus.type === 'prayer_focus';
  }

  return true;
}

/**
 * Returns list of ministries that are active on a specific Sunday (filters out inactive rotation items).
 */
export function getApplicableMinistriesForSunday(
  ministries: Ministry[],
  sunday: ServiceSunday
): Ministry[] {
  return ministries.filter(m => isMinistryApplicableOnSunday(m, sunday));
}

export interface SundayCoverageStats {
  applicableMinistries: Ministry[];
  requiredMinistries: Ministry[];
  optionalMinistries: Ministry[];
  totalRequired: number;
  filledRequired: number;
  totalApplicable: number;
  filledApplicable: number;
  percent: number;
  isFullyCovered: boolean;
}

/**
 * Calculates unified coverage statistics for a Sunday:
 * - Respects weekly rotating ministries (only active rotation counts).
 * - Respects optional ministries (isOptional: true does not lower coverage percentage when empty).
 */
export function getSundayCoverageStats(
  sunday: ServiceSunday,
  ministries: Ministry[],
  worshipRoster?: any
): SundayCoverageStats {
  const applicable = getApplicableMinistriesForSunday(ministries, sunday);
  const required = applicable.filter(m => !m.isOptional);
  const optional = applicable.filter(m => !!m.isOptional);

  let filledRequired = 0;
  required.forEach(m => {
    const list = resolveMinistryAssignments(sunday, m.id, worshipRoster);
    if (list && list.length > 0 && list[0] !== '/') {
      filledRequired++;
    }
  });

  let filledApplicable = 0;
  applicable.forEach(m => {
    const list = resolveMinistryAssignments(sunday, m.id, worshipRoster);
    if (list && list.length > 0 && list[0] !== '/') {
      filledApplicable++;
    }
  });

  const totalRequired = required.length;
  const percent = totalRequired > 0 ? Math.round((filledRequired / totalRequired) * 100) : 100;
  const isFullyCovered = filledRequired >= totalRequired;

  return {
    applicableMinistries: applicable,
    requiredMinistries: required,
    optionalMinistries: optional,
    totalRequired,
    filledRequired,
    totalApplicable: applicable.length,
    filledApplicable,
    percent,
    isFullyCovered
  };
}

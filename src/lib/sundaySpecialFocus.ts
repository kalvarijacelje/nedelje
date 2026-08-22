import { ServiceSunday, SpecialSundayFocus, CommunionCheckitem } from '../types';

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

  // Normalize separators: replace slash or dash or multiple spaces with dots
  const clean = dateStr.replace(/[/\-\s]+/g, '.').replace(/\.+/g, '.');
  const parts = clean.split('.').filter(Boolean);

  let day = 1;
  let month = 8;

  if (parts.length >= 2) {
    day = parseInt(parts[0], 10) || 1;
    month = parseInt(parts[1], 10) || 8;
  }

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

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'Admin' | 'Leader' | 'Servant' | 'Viewer' | 'Visitor' | 'Minor';

export const SUPERADMIN_EMAIL = 'ales.lajlar@gmail.com';

/**
 * Checks if given email or user object corresponds to the church superadmin & pastor (ales.lajlar@gmail.com).
 */
export const isSuperAdmin = (emailOrUser?: string | { email?: string | null } | null): boolean => {
  if (!emailOrUser) return false;
  const email = typeof emailOrUser === 'string' ? emailOrUser : emailOrUser.email;
  return (email || '').toLowerCase().trim() === SUPERADMIN_EMAIL;
};

/**
 * Utility helper to determine if a user role or user profile has authorization to view personal contact data.
 * Only approved Admin, Leader, and Servant roles have access to personal contact details.
 */
export const canAccessPersonalData = (
  userOrRole?: UserRole | { role?: UserRole | string; email?: string } | string | null,
  userEmail?: string | null
): boolean => {
  if (userEmail && isSuperAdmin(userEmail)) return true;
  if (!userOrRole) return false;
  if (typeof userOrRole === 'object' && isSuperAdmin(userOrRole.email)) return true;
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole.role;
  if (!role) return false;
  return ['Admin', 'Leader', 'Servant'].includes(role);
};

/**
 * Helper to determine if a user can view a target person's sensitive contact details (phone, email).
 * Rules:
 * 1. Admin and Leader roles can view contact details for ALL people.
 * 2. Any user can view their OWN contact details (matching name, email, or ID).
 * 3. Servants can view contact details of Leaders & Admins (for ministry coordination).
 * 4. Otherwise (peer Servants or Viewers viewing non-leader volunteers), returns false.
 */
export const canViewPersonContactInfo = (
  currentUserRole?: UserRole | string | null,
  myPersonName?: string | null,
  targetPerson?: { id?: string; name?: string; phone?: string; email?: string; role?: UserRole | string; ledMinistries?: string[] } | string | null,
  currentUserEmail?: string | null,
  currentUserId?: string | null
): boolean => {
  if (currentUserEmail && isSuperAdmin(currentUserEmail)) return true;
  if (!currentUserRole || currentUserRole === 'Viewer') return false;

  // 1. Admin and Leader can see contact details for everyone
  if (currentUserRole === 'Admin' || currentUserRole === 'Leader') {
    return true;
  }

  if (!targetPerson) return false;

  const targetName = typeof targetPerson === 'string' ? targetPerson : targetPerson.name;
  const targetEmail = typeof targetPerson === 'object' ? targetPerson.email : undefined;
  const targetId = typeof targetPerson === 'object' ? targetPerson.id : undefined;
  const targetRole = typeof targetPerson === 'object' ? targetPerson.role : undefined;
  const targetLedMinistries = typeof targetPerson === 'object' ? targetPerson.ledMinistries : undefined;

  // 2. Can view OWN contact details
  if (currentUserId && targetId && currentUserId === targetId) return true;

  if (myPersonName && targetName && myPersonName.trim().toLowerCase() === targetName.trim().toLowerCase()) {
    return true;
  }

  if (currentUserEmail && targetEmail && currentUserEmail.trim().toLowerCase() === targetEmail.trim().toLowerCase()) {
    return true;
  }

  // 3. Servants can view Leaders and Admins contacts (or anyone leading a ministry)
  if (targetRole === 'Leader' || targetRole === 'Admin' || (targetLedMinistries && targetLedMinistries.length > 0)) {
    return true;
  }

  // 4. Peer Servants viewing other Servants -> false
  return false;
};

/**
 * Formats a person's display name according to privacy & role permissions:
 * - Superadmin, Admin, and Leader: See full names for EVERYONE.
 * - Current user: Always sees their OWN full name.
 * - Servants (Volunteers):
 *     - See FULL names for Leaders & Admins (or anyone leading a ministry), so they know who they are coordinating with.
 *     - See FIRST name (e.g. "Barbara", "Dejan", "Andrea") for peer servants / general members.
 * - Viewers / Public: See FIRST name only.
 */
export const getPrivacyDisplayName = (
  personOrName?: { id?: string; name?: string; role?: UserRole | string; ledMinistries?: string[]; isPastorOrStaff?: boolean } | string | null,
  currentUserRole?: UserRole | string | null,
  myPersonName?: string | null,
  currentUserEmail?: string | null,
  currentUserId?: string | null,
  allPeople?: ({ id?: string; name?: string; role?: UserRole | string; ledMinistries?: string[]; isPastorOrStaff?: boolean })[]
): string => {
  if (!personOrName) return '';
  const fullName = typeof personOrName === 'string' ? personOrName.trim() : (personOrName.name || '').trim();
  if (!fullName) return '';

  // 1. Superadmin, Admin, Leader see full name for everyone
  if (currentUserEmail && isSuperAdmin(currentUserEmail)) return fullName;
  if (currentUserRole === 'Admin' || currentUserRole === 'Leader') return fullName;

  // 2. User viewing themselves sees their own full name
  const targetId = typeof personOrName === 'object' ? personOrName.id : undefined;
  if (currentUserId && targetId && currentUserId === targetId) return fullName;
  if (myPersonName && myPersonName.trim().toLowerCase() === fullName.toLowerCase()) return fullName;

  // 3. Check if target is a Leader, Admin, or Ministry Coordinator
  let targetObj = typeof personOrName === 'object' ? personOrName : undefined;
  if (!targetObj && allPeople) {
    targetObj = allPeople.find(p => p && p.name && p.name.trim().toLowerCase() === fullName.toLowerCase());
  }

  const isTargetLeader = 
    targetObj?.role === 'Leader' || 
    targetObj?.role === 'Admin' || 
    Boolean(targetObj?.isPastorOrStaff) ||
    (Array.isArray(targetObj?.ledMinistries) && targetObj!.ledMinistries!.length > 0);

  // Servants can see full name of Leaders & Admins
  if (isTargetLeader && currentUserRole === 'Servant') {
    return fullName;
  }

  // 4. Extract First Name (e.g., "Barbara Bukovec Breznikar" -> "Barbara")
  const parts = fullName.split(' ').filter(Boolean);
  if (parts.length <= 1) return fullName;

  return parts[0];
};

export type Language = 'en' | 'sl';

export type ServiceStatus = 'draft' | 'ready' | 'completed';

export interface Ministry {
  id: string;
  name?: string;
  nameSl: string;
  nameEn: string;
  category: 'cleaning' | 'hospitality' | 'sermon_prayer' | 'worship' | 'audio_video' | 'kids' | 'post_service' | 'other' | 'av_tech';
  color: string; // Tailwind class color for visual indication
  icon?: string; // Lucide icon name for visual representation
  leader?: string;
  defaultLeader?: string;
  requiredCount?: number;
  active?: boolean;
  description?: string;
}

export type AssignmentStatus = 'pending' | 'confirmed' | 'declined' | 'tentative';

export interface MinistryAssignment {
  personName: string;
  status: AssignmentStatus;
  notes?: string;
  assignedByLeaderId?: string;
  assignedByLeaderName?: string;
  assignedAt?: string;
  confirmationToken?: string;
  declineReason?: string;
  responseAt?: string;
}

export interface ServiceAttendanceRecord {
  personName: string;
  ministryId: string;
  status: 'present' | 'late' | 'absent' | 'excused';
  checkInTime?: string;
  notes?: string;
}

export interface ServiceHeadcount {
  adults?: number;
  children?: number;
  visitors?: number;
  notes?: string;
}

export interface SetlistSong {
  id: string;
  songId?: string;
  titleSl: string;
  titleEn?: string;
  key?: string; // e.g. "G", "C", "D", "Em"
  bpm?: number;
  durationMinutes: number; // e.g. 4
  youtubeUrl?: string;
  docLink?: string;
  lyricsStart?: string;
  leadSinger?: string;
  notes?: string;
}

export interface RundownItem {
  id: string;
  time: string; // e.g. "09:00" or "10:00"
  durationMinutes: number; // e.g. 30
  titleSl: string;
  titleEn?: string;
  leaderOrTeam?: string; // e.g. "Worship Band", "Pastor Aleš", "AV Techs"
  notes?: string;
  type: 'soundcheck' | 'welcome' | 'worship' | 'sermon' | 'communion' | 'offering' | 'announcements' | 'closing' | 'other';
}

export type SpecialSundayFocusType = 'communion' | 'prayer_focus' | 'special_event' | 'none';

export interface CommunionCheckitem {
  id: string;
  textSl: string;
  textEn?: string;
  done: boolean;
}

export interface CommunionFocus {
  inChargeNames: string[]; // e.g. ["Aleš & Whitney"]
  breadType?: string; // e.g. "Brezglutenski kruh"
  drinkType?: string; // e.g. "Grozdni sok v skodelicah"
  checklist?: CommunionCheckitem[];
  notes?: string;
}

export interface PrayerFocus {
  familyNameOrPerson: string; // e.g. "Družina Novak"
  sphereOfInfluence?: string; // e.g. "Šolstvo in lokalna soseska"
  prayerRequests?: string; // e.g. "Za zdravje, modrost in pričevanje sodelavcem"
  encouragementNotes?: { id: string; author: string; text: string; date: string }[];
}

export interface SpecialSundayFocus {
  type: SpecialSundayFocusType;
  communion?: CommunionFocus;
  prayerFocus?: PrayerFocus;
  customTitleSl?: string;
}

export interface ServiceSunday {
  id: string;
  date: string; // e.g. "31. 8. 2025"
  themeSl: string; // custom theme/sermon label from "Učenje" sheet info
  themeEn: string;
  status: ServiceStatus;
  guest: string; // guest speaker or info from spreadsheet "Gost" column
  assignments: Record<string, string[]>; // key: ministryId, value: names of assigned people
  assignmentDetails?: Record<string, MinistryAssignment[]>; // key: ministryId, value: list of assignees with status and notes
  attendanceRecords?: Record<string, ServiceAttendanceRecord>; // key: `${ministryId}_${personName}`
  headcount?: ServiceHeadcount;
  worshipSetlist?: SetlistSong[];
  serviceRundown?: RundownItem[];
  absentOrNotes: string; // Notes or absent leaders from "Odsotni voditelji" column
  googleEventId?: string;
  googleEventHtmlLink?: string;
  googleRehearsalEventId?: string;
  googleRehearsalEventHtmlLink?: string;
  specialFocus?: SpecialSundayFocus;
}

export type FollowUpStatus = 'new' | 'contacted' | 'connected' | 'completed';

export interface VisitorConnection {
  id: string;
  sundayId?: string;
  sundayDate: string;
  visitorName: string;
  contactInfo?: string;
  invitedBy?: string;
  notes?: string;
  interests?: string[];
  assignedFollowUpPerson?: string;
  followUpStatus: FollowUpStatus;
  coffeeShopNotes?: string;
  createdAt: string;
}

export type PersonCategory = 'active' | 'members' | 'youth' | 'visitors';

export interface Person {
  id: string; // Permanent, immutable unique entity identifier
  name: string;
  full_name?: string;
  avatarUrl?: string;
  preferredMinistries: string[]; // ministryIds
  role?: UserRole; // 'Admin' | 'Leader' | 'Servant' | 'Viewer' | 'Visitor' | 'Minor'
  memberType?: 'adult' | 'minor' | 'youth' | 'visitor' | 'member';
  birthDate?: string;
  isVisitor?: boolean;
  ledMinistries?: string[]; // ministryIds managed by this leader/admin (if role === 'Leader' || 'Admin')
  familyMembers?: string[]; // names of linked spouse / adult children / family members
  phone?: string;
  email?: string;
  notificationSettings?: NotificationSettings;
  isPastorOrStaff?: boolean; // Exclude from volunteer burnout alerts (e.g. main pastor / full-time ministers)
  isExemptFromBurnout?: boolean;
  excludeFromBurnout?: boolean;
  isArchived?: boolean; // Flag indicating if volunteer profile is archived
}

export interface NotificationBatchItem {
  id: string;
  sundayId?: string;
  sundayDate: string;
  ministryId: string;
  ministryName: string;
  token: string;
  assignedAt: string;
}

export interface NotificationBatch {
  volunteerName: string;
  volunteerEmail: string;
  leaderName: string;
  items: NotificationBatchItem[];
  timerExpiresAt: number;
  createdAt: number;
}

export interface NotificationSettings {
  emailReminders: boolean;
  fridayReminder: boolean; // Friday gentle reminder 48h before
  saturdayReminder: boolean; // Saturday final reminder 24h before
  browserPush: boolean;
  reminderTimeFriday: string; // e.g. "18:00"
  reminderTimeSaturday: string; // e.g. "10:00"
}

export interface DutyReminderAlert {
  id: string;
  sundayId: string;
  sundayDate: string;
  ministryId: string;
  ministryName: string;
  personName: string;
  type: 'upcoming_duty' | 'friday_gentle' | 'saturday_final' | 'roster_changed';
  scheduledDay: 'Friday' | 'Saturday' | 'Immediate';
  status: 'pending' | 'confirmed' | 'swap_requested';
  createdAt: string;
  isRead: boolean;
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  personName?: string;
}

export interface WorshipRosterEntry {
  id: string;
  date: string;
  leader: string;
  acoustic: string;
  drums: string;
  bass: string;
  keys: string;
  vocals: string;
  sound: string;
  slides: string;
  vocalTechAbsent: string;
  monitors: string;
  sundaySchool: string;
}

export interface WorshipSong {
  id: string;
  number: string;
  titleSl: string;
  titleEn: string;
  youtubeUrl?: string;
  demoUrl?: string;
  timesSung: number;
  isNew?: boolean;
  category?: 'favorite' | 'great' | 'kids' | 'christmas' | 'standard';
  sasuNumber?: string;
  sasuLink?: string;
  docLink?: string;
  attachLink?: string;
  sasuLyricsStart?: string;
}

export interface SasuSong {
  id: string;
  number: string;
  titleSl: string;
  titleEn: string;
  authors?: string;
  translator?: string;
  lyricsStart?: string;
  webLink?: string;
  docLink?: string;
  attachLink?: string;
  isKalvarijaActive?: boolean;
  kalvarijaSongNumber?: string;
}

export interface WorshipContact {
  id: string;
  name: string;
  phone: string;
  email: string;
  role?: string;
}

export interface StageSetupChecklist {
  id: string;
  stepNumber: string;
  instrumentalists: string;
  vocals: string;
  flute: string;
}

export interface ArchivedSong {
  id: string;
  number: string;
  titleSl: string;
  titleEn: string;
  note?: string;
}

export interface ShiftSwapRequest {
  id: string;
  requesterName: string;
  sundayId: string;
  sundayDate: string;
  ministryId: string;
  ministryName: string;
  reason?: string;
  status: 'open' | 'accepted' | 'declined' | 'cancelled';
  acceptedByName?: string;
  createdAt: string;
}

export interface BlackoutDate {
  id: string;
  personName: string;
  personId?: string;
  startDate: string; // YYYY-MM-DD or DD. MM. YYYY
  endDate: string;
  reason?: string;
  createdAt: string;
}

// --- Nedeljska Šola (Sunday School) Types ---
export type SundaySchoolGroupKey = 'mlajsa' | 'starejsa' | 'oboji';

export interface SundaySchoolLesson {
  id: string;
  sundayId: string;
  sundayDate: string;
  group: SundaySchoolGroupKey; // Mlajša (3-9 let) or Starejša (10-15+ let) or Oboji
  topicSl: string;
  bibleStorySl: string;
  descriptionSl?: string;
  memoryVerseSl?: string;
  craftAndGamesSl?: string;
  materialsNeeded?: string[];
  googleDocUrl?: string;
  teachers: string[];
  helpers: string[];
  notes?: string;
  status: 'planned' | 'completed';
}

export interface SundaySchoolSupply {
  id: string;
  nameSl: string;
  category: 'basic' | 'paper' | 'christmas' | 'decorations' | 'wood' | 'things' | 'random' | 'crafts' | 'stationery' | 'snacks' | 'equipment' | 'other';
  quantity: string;
  status: 'ok' | 'low' | 'buy'; // Green (Na zalogi), Yellow (Zmanjkuje), Red (Kupiti)
  notes?: string;
}

export interface Translation {
  title: string;
  chooseRole: string;
  roleAdmin: string;
  roleViewer: string;
  sundaySchedule: string;
  home: string;
  sundays: string;
  worship: string;
  ministries: string;
  people: string;
  coverage: string;
  missingAssignments: string;
  quickActions: string;
  nextSunday: string;
  viewDetails: string;
  editSunday: string;
  assignPerson: string;
  duplicateWeek: string;
  statusDraft: string;
  statusReady: string;
  statusCompleted: string;
  details: string;
  addPerson: string;
  customNotes: string;
  absentNotes: string;
  save: string;
  cancel: string;
  importExport: string;
  deleteConfirmation: string;
  languageSelect: string;
  overallCoverage: string;
  filterByMinistry: string;
  searchPerson: string;
  overloadWarning: string;
  noOverload: string;
  servingCount: string;
  duplicateBtn: string;
  themeLabel: string;
  guestLabel: string;
  serviceNotes: string;
}

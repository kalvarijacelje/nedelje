/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, startTransition } from 'react';
import { ServiceSunday, Ministry, Person, UserRole, Language, Translation, User, ShiftSwapRequest, BlackoutDate, WorshipRosterEntry, SundaySchoolLesson, SundaySchoolSupply, VisitorConnection, canAccessPersonalData } from './types';
import { 
  INITIAL_MINISTRIES, 
  INITIAL_PEOPLE, 
  INITIAL_SUNDAYS, 
  TRANS_SL, 
  TRANS_EN 
  } from './data/initialData';
import { INITIAL_WORSHIP_ROSTER } from './data/worshipData';
import { syncWorshipRosterFromSundayAssignments } from './utils/worshipSync';
import { syncSundaySchoolLessonsFromSunday, syncSundaysFromSundaySchoolLessons } from './utils/sundaySchoolSync';
import { parseEuropeanDate, formatToEuropeanDate } from './utils/dateUtils';
import { generateAcademicYear2026_2027, getAutoSundayStatus, seedAcademicYearToSupabase } from './utils/academicYear';

import HomeDashboard from './components/HomeDashboard';
import ScheduleView from './components/ScheduleView';
import SundayDetail from './components/SundayDetail';
import MinistryView from './components/MinistryView';
import PeopleView from './components/PeopleView';
import WorshipTeamView from './components/WorshipTeamView';
import SundaySchoolView from './components/SundaySchoolView';
import NotificationHubModal from './components/NotificationHubModal';
import SwapBoardModal from './components/SwapBoardModal';
import BlackoutPlannerModal from './components/BlackoutPlannerModal';
import AttendanceCheckInModal from './components/AttendanceCheckInModal';
import VisitorTrackerModal from './components/VisitorTrackerModal';
import InspectionChecklistModal from './components/InspectionChecklistModal';
import ServiceRundownModal from './components/ServiceRundownModal';
import Statistika from './pages/Statistika';
import ConfirmPage from './pages/ConfirmPage';
import { PwaInstallBanner } from './components/PwaInstallBanner';
import { sendSwapAcceptedNotificationToRequester, logInAppNotification } from './services/notificationService';

import { INITIAL_SUNDAY_SCHOOL_LESSONS, INITIAL_SUNDAY_SCHOOL_SUPPLIES } from './data/sundaySchoolData';
import { INITIAL_VISITOR_CONNECTIONS } from './data/visitorData';

import KcKalvarijaLogo from './components/KcKalvarijaLogo';
import { EcosystemNavbar } from './components/EcosystemNavbar';
import NotificationQueueBar from './components/NotificationQueueBar';

import { 
  Home, 
  Calendar, 
  Music,
  Layers, 
  Users, 
  Globe, 
  LogOut, 
  ShieldAlert, 
  UserCheck, 
  Loader2,
  Bell,
  ArrowRightLeft,
  Palmtree,
  GraduationCap,
  Coffee,
  ClipboardCheck,
  Menu,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Trash2,
  CheckCircle2,
  Mail,
  Lock,
  LogIn,
  AlertCircle
} from 'lucide-react';

// Import Firebase Firestore utilities conditionally (fallback)
import { 
  db, 
  IS_FIREBASE_ENABLED, 
  handleFirestoreError, 
  OperationType,
  sanitizeForFirestore
} from './lib/firebase';
import { 
  findPersonByAuthUser, 
  updatePersonRecord, 
  createPersonRecord, 
  deletePersonRecord, 
  linkUserToPerson,
  isNameMatch 
} from './services/userService';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  writeBatch 
} from 'firebase/firestore';
import { supabase, performGlobalSignOut, getAuthBroadcastChannel, broadcastAuthChange } from './supabaseClient';
import { 
  fetchSundaysFromSupabase, 
  upsertSundayToSupabase, 
  fetchPeopleFromSupabase, 
  fetchRegisteredUsersFromSupabase,
  upsertPersonToSupabase, 
  deletePersonFromSupabase, 
  fetchBlackoutsFromSupabase, 
  insertBlackoutToSupabase, 
  deleteBlackoutFromSupabase, 
  fetchShiftSwapsFromSupabase, 
  upsertShiftSwapToSupabase, 
  upsertWorshipScheduleToSupabase,
  subscribeToSupabaseRealtime, 
  toCanonicalPersonId,
  IS_SUPABASE_CONFIGURED 
} from './services/supabaseDataService';
import { seedSupabaseDatabase } from './utils/supabaseSeeder';
import { migrateFirestoreToSupabase } from './utils/firestoreMigrationBridge';

type TabType = 'home' | 'sundays' | 'statistics' | 'sunday_school' | 'worship' | 'ministries' | 'people';

const TAB_TO_PATH: Record<TabType, string> = {
  home: '/domov',
  sundays: '/razpored',
  statistics: '/statistika',
  sunday_school: '/sola',
  worship: '/slavilna',
  ministries: '/sluzbe',
  people: '/ekipa',
};

const PATH_TO_TAB: Record<string, TabType> = {
  '/': 'home',
  '/dom': 'home',
  '/domov': 'home',
  '/prijava': 'home',
  '/login': 'home',
  '/vpis': 'home',
  '/signin': 'home',
  '/razpored': 'sundays',
  '/statistika': 'statistics',
  '/analitika': 'statistics',
  '/sola': 'sunday_school',
  '/slavba': 'worship',
  '/slavilna': 'worship',
  '/sluzbe': 'ministries',
  '/ekipa': 'people',
};

function getTabFromPath(pathname: string): TabType {
  const normalized = pathname.toLowerCase().replace(/\/$/, '') || '/';
  return PATH_TO_TAB[normalized] || 'home';
}

const ensurePersonId = (p: Person): Person => {
  if (!p || typeof p !== 'object') return p;
  const cleanId = (p.id && !p.id.includes('_mu_i_') && !/[-_][a-z0-9]{7,15}$/i.test(p.id)) 
    ? toCanonicalPersonId(p.id) 
    : toCanonicalPersonId(p.name);
  return { ...p, id: cleanId };
};

const safeParsePeople = (raw: string | null): Person[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
        .filter(p => p && typeof p === 'object' && typeof p.name === 'string')
        .map(ensurePersonId);
    }
  } catch (e) { /* ignore */ }
  return [];
};

const safeParseSundays = (raw: string | null): ServiceSunday[] => {
  if (!raw) return INITIAL_SUNDAYS;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const valid = parsed.filter(s => s && typeof s === 'object' && typeof s.id === 'string');
      return valid.length > 0 ? valid : INITIAL_SUNDAYS;
    }
  } catch (e) { /* ignore */ }
  return INITIAL_SUNDAYS;
};

const getDeletedPeopleKeys = (): string[] => {
  try {
    const raw = localStorage.getItem('church_roster_deleted_people_keys_v1');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
};

const saveDeletedPeopleKeys = (keys: string[]) => {
  try {
    localStorage.setItem('church_roster_deleted_people_keys_v1', JSON.stringify(Array.from(new Set(keys.filter(Boolean)))));
  } catch (e) {}
};

const removeDeletedPeopleKeys = (identifiers: (string | undefined)[]) => {
  const current = getDeletedPeopleKeys();
  if (current.length === 0) return;
  const toRemove = new Set(identifiers.filter(Boolean).map(s => s!.toLowerCase().trim()));
  const filtered = current.filter(key => {
    const cleanKey = key.replace(/^(name:|id:|email:|phone:)/, '').toLowerCase().trim();
    return !toRemove.has(cleanKey) && !toRemove.has(key);
  });
  saveDeletedPeopleKeys(filtered);
};

export const getRoleWeight = (role?: string | null): number => {
  if (!role) return 1;
  const r = role.toString().toLowerCase().trim();
  if (r === 'superadmin' || r === 'admin') return 4;
  if (r === 'leader') return 3;
  if (r === 'servant' || r === 'volunteer') return 2;
  return 1; // 'viewer', 'visitor', 'minor', etc.
};

export const ensureDesignatedLeaders = (peopleList: Person[]): { list: Person[]; changed: boolean } => {
  let changed = false;
  const list = peopleList.map(p => {
    if (!p) return p;
    const isNina = p.id === 'p-nina_cizic' || 
      (p.email && p.email.toLowerCase().trim() === 'nina.cizic@gmail.com') ||
      (p.name && (p.name.toLowerCase().trim() === 'nina čižič' || p.name.toLowerCase().trim() === 'nina cizic'));
    const isDoroteja = p.id === 'p-doroteja_kolar' ||
      (p.email && (p.email.toLowerCase().trim() === 'dkolar@drustvovec.si' || p.email.toLowerCase().trim() === 'doroteja.kolar@gmail.com')) ||
      (p.name && p.name.toLowerCase().trim() === 'doroteja kolar');

    if ((isNina || isDoroteja) && p.role !== 'Leader') {
      changed = true;
      return { ...p, role: 'Leader' as UserRole };
    }
    return p;
  });
  return { list, changed };
};

const deduplicatePeopleList = (list: Person[]): Person[] => {
  const result: Person[] = [];
  const seenIds = new Set<string>();
  const phoneToPerson = new Map<string, Person>();
  const emailToPerson = new Map<string, Person>();
  const nameToPerson = new Map<string, Person>();

  // Sort list so that higher-privilege and canonical records (Admin > Leader > Servant > Viewer, and 'p-' canonical IDs) come first
  const sorted = [...list].sort((a, b) => {
    // 1. Higher role weight first
    const roleDiff = getRoleWeight(b.role) - getRoleWeight(a.role);
    if (roleDiff !== 0) return roleDiff;

    // 2. Canonical roster IDs (starting with 'p-') come before arbitrary UUIDs
    const aIsCanonical = (a.id || '').startsWith('p-') ? 1 : 0;
    const bIsCanonical = (b.id || '').startsWith('p-') ? 1 : 0;
    if (aIsCanonical !== bIsCanonical) return bIsCanonical - aIsCanonical;

    // 3. Records with linked emails
    const aHasGoogleEmail = a.email && !a.email.includes('drustvovec.si');
    const bHasGoogleEmail = b.email && !b.email.includes('drustvovec.si');
    if (aHasGoogleEmail && !bHasGoogleEmail) return -1;
    if (!aHasGoogleEmail && bHasGoogleEmail) return 1;

    const aNameLen = (a.name || '').length;
    const bNameLen = (b.name || '').length;
    if (aNameLen !== bNameLen) return bNameLen - aNameLen;

    return 0;
  });

  for (const person of sorted) {
    if (!person || !person.id || !person.name) continue;
    if (seenIds.has(person.id)) continue;

    const cleanPhone = person.phone ? person.phone.replace(/\s+/g, '').replace(/[^0-9]/g, '') : '';
    const cleanEmail = person.email ? person.email.toLowerCase().trim() : '';
    const cleanName = person.name.toLowerCase().trim();

    // 1. Deduplicate by matching non-empty phone number
    if (cleanPhone && phoneToPerson.has(cleanPhone)) {
      const existing = phoneToPerson.get(cleanPhone)!;
      if (getRoleWeight(person.role) > getRoleWeight(existing.role)) {
        existing.role = person.role;
      }
      if (person.id && person.id.startsWith('p-') && !existing.id.startsWith('p-')) {
        existing.id = person.id;
      }
      if (!(existing as any).auth_user_id && (person as any).auth_user_id) {
        (existing as any).auth_user_id = (person as any).auth_user_id;
      }
      if (!existing.email && person.email) {
        existing.email = person.email;
      }
      // Merge missing preferred ministries, led ministries, family members
      if (person.preferredMinistries && person.preferredMinistries.length > 0) {
        existing.preferredMinistries = Array.from(new Set([...(existing.preferredMinistries || []), ...person.preferredMinistries]));
      }
      if (person.ledMinistries && person.ledMinistries.length > 0) {
        existing.ledMinistries = Array.from(new Set([...(existing.ledMinistries || []), ...person.ledMinistries]));
      }
      if (person.familyMembers && person.familyMembers.length > 0) {
        existing.familyMembers = Array.from(new Set([...(existing.familyMembers || []), ...person.familyMembers]));
      }
      if (!existing.avatarUrl && person.avatarUrl) {
        existing.avatarUrl = person.avatarUrl;
      }
      continue;
    }

    // 2. Deduplicate by matching non-empty email
    if (cleanEmail && emailToPerson.has(cleanEmail)) {
      const existing = emailToPerson.get(cleanEmail)!;
      if (getRoleWeight(person.role) > getRoleWeight(existing.role)) {
        existing.role = person.role;
      }
      if (person.id && person.id.startsWith('p-') && !existing.id.startsWith('p-')) {
        existing.id = person.id;
      }
      if (!(existing as any).auth_user_id && (person as any).auth_user_id) {
        (existing as any).auth_user_id = (person as any).auth_user_id;
      }
      if (!existing.phone && person.phone) {
        existing.phone = person.phone;
      }
      if (person.preferredMinistries && person.preferredMinistries.length > 0) {
        existing.preferredMinistries = Array.from(new Set([...(existing.preferredMinistries || []), ...person.preferredMinistries]));
      }
      if (person.ledMinistries && person.ledMinistries.length > 0) {
        existing.ledMinistries = Array.from(new Set([...(existing.ledMinistries || []), ...person.ledMinistries]));
      }
      if (person.familyMembers && person.familyMembers.length > 0) {
        existing.familyMembers = Array.from(new Set([...(existing.familyMembers || []), ...person.familyMembers]));
      }
      if (!existing.avatarUrl && person.avatarUrl) {
        existing.avatarUrl = person.avatarUrl;
      }
      continue;
    }

    // 3. Deduplicate by canonical name prefix (e.g. "Dejan" when "Dejan Š" already exists)
    let isNameVariantDuplicate = false;
    for (const [existingName, existingPerson] of nameToPerson.entries()) {
      const samePrefix = cleanName.startsWith(existingName) || existingName.startsWith(cleanName);
      if (samePrefix && (Math.abs(cleanName.length - existingName.length) <= 3)) {
        if (existingPerson.role === person.role || (cleanPhone && existingPerson.phone && existingPerson.phone.replace(/[^0-9]/g, '') === cleanPhone)) {
          isNameVariantDuplicate = true;
          if (getRoleWeight(person.role) > getRoleWeight(existingPerson.role)) {
            existingPerson.role = person.role;
          }
          if (person.id && person.id.startsWith('p-') && !existingPerson.id.startsWith('p-')) {
            existingPerson.id = person.id;
          }
          if (!(existingPerson as any).auth_user_id && (person as any).auth_user_id) {
            (existingPerson as any).auth_user_id = (person as any).auth_user_id;
          }
          if (!existingPerson.email && person.email) {
            existingPerson.email = person.email;
          }
          // Merge ministries if any
          if (person.preferredMinistries && person.preferredMinistries.length > 0) {
            existingPerson.preferredMinistries = Array.from(new Set([...(existingPerson.preferredMinistries || []), ...person.preferredMinistries]));
          }
          if (person.ledMinistries && person.ledMinistries.length > 0) {
            existingPerson.ledMinistries = Array.from(new Set([...(existingPerson.ledMinistries || []), ...person.ledMinistries]));
          }
          break;
        }
      }
    }
    if (isNameVariantDuplicate) {
      continue;
    }

    seenIds.add(person.id);
    if (cleanPhone) phoneToPerson.set(cleanPhone, person);
    if (cleanEmail) emailToPerson.set(cleanEmail, person);
    nameToPerson.set(cleanName, person);
    result.push(person);
  }

  return result;
};

const OBSOLETE_DUMMY_PEOPLE_IDS = new Set([
  'p-erik', 'p-daniel', 'p-lajlar', 'p-ravnak', 'p-matej', 'p-pratneker', 
  'p-cizic', 'p-vuleta', 'p-sanja_m', 'p-sarkan', 'p-georgiev', 'p-tonja', 
  'p-barbara', 'p-kreiner', 'p-breznikar', 'p-music', 'p-stefancic',
  'p-ales', 'p-stella', 'p-damijan', 'p-dejan', 'p-urh', 'p-whitney',
  'p-andrea', 'p-doroteja', 'p-ninac', 'p-franci', 'p-nastja', 'p-katja',
  'p-bojan', 'p-kenzley', 'p-vesna', 'p-pia', 'p-denis', 'p-huntley',
  'p-jure', 'p-darko', 'p-janez', 'p-zoja', 'p-lorens', 'p-mateja',
  'p-tina', 'p-karla', 'p-barbi', 'p-luka'
]);

const mergePeopleWithDefaults = (fetched: Person[], base: Person[]): Person[] => {
  // If remote records from Supabase are provided, they are the EXCLUSIVE source of truth
  if (fetched && fetched.length > 0) {
    return deduplicatePeopleList(fetched.map(ensurePersonId));
  }

  // Fallback to local storage base if present
  if (base && base.length > 0) {
    return deduplicatePeopleList(base.map(ensurePersonId));
  }

  // Offline / initial fallback only when database is completely disconnected
  if (!IS_SUPABASE_CONFIGURED) {
    return INITIAL_PEOPLE.map(ensurePersonId);
  }

  return [];
};

const normalizeDateKey = (dateStr: string): string => {
  const d = parseEuropeanDate(dateStr);
  if (!d || isNaN(d.getTime()) || d.getTime() === 0) return (dateStr || '').replace(/\s+/g, '');
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const mergeSundaysWithDefaults = (fetched: ServiceSunday[], base: ServiceSunday[]): ServiceSunday[] => {
  const map = new Map<string, ServiceSunday>();
  
  // 1. Initial past year sundays
  INITIAL_SUNDAYS.forEach(s => { 
    if (s && s.date) {
      const key = normalizeDateKey(s.date);
      map.set(key, s);
    } 
  });
  
  // 2. Standard 2026/2027 Academic Year (Aug 30, 2026 -> Aug 29, 2027)
  const standardAy = generateAcademicYear2026_2027();
  standardAy.forEach(s => { 
    if (s && s.date) {
      const key = normalizeDateKey(s.date);
      map.set(key, s);
    } 
  });

  // 3. Overlay base/local storage (filtering out any obsolete s_ay2627_ keys)
  base.forEach(s => { 
    if (s && s.date && !s.id?.startsWith('s_ay2627_')) {
      const key = normalizeDateKey(s.date);
      const existing = map.get(key);
      map.set(key, {
        ...(existing || {}),
        ...s,
        id: existing?.id || s.id.replace(/_/g, '-'),
        status: getAutoSundayStatus(s.date)
      }); 
    } 
  });

  // 4. Overlay authoritative remote records
  fetched.forEach(s => { 
    if (s && s.date && !s.id?.startsWith('s_ay2627_')) {
      const key = normalizeDateKey(s.date);
      const existing = map.get(key);
      map.set(key, {
        ...(existing || {}),
        ...s,
        id: existing?.id || s.id.replace(/_/g, '-'),
        status: getAutoSundayStatus(s.date)
      }); 
    } 
  });

  return Array.from(map.values()).sort((a, b) => {
    return parseEuropeanDate(a.date).getTime() - parseEuropeanDate(b.date).getTime();
  });
};

export default function App() {
  // --- Core Application States ---
  const [sundays, setSundays] = useState<ServiceSunday[]>(() => {
    const raw = localStorage.getItem('church_roster_sundays_v2');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return mergeSundaysWithDefaults([], parsed);
        }
      } catch (e) { /* ignore */ }
    }
    return mergeSundaysWithDefaults([], []);
  });
  const [people, setPeople] = useState<Person[]>(() => {
    const raw = localStorage.getItem('church_roster_people_v2');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return mergePeopleWithDefaults([], parsed);
        }
      } catch (e) { /* ignore */ }
    }
    return IS_SUPABASE_CONFIGURED ? [] : INITIAL_PEOPLE;
  });
  const [users, setUsers] = useState<User[]>([]); // Dynamic registered app users (admin only)
  const [currentLanguage, setCurrentLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('church_roster_lang_v2');
    return (saved as Language) || 'sl';
  });
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (typeof window !== 'undefined') {
      return getTabFromPath(window.location.pathname);
    }
    return 'home';
  });
  const [visitedTabs, setVisitedTabs] = useState<Set<TabType>>(() => new Set([activeTab]));
  useEffect(() => {
    setVisitedTabs(prev => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);
  const [isConfirmView, setIsConfirmView] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase();
      const s = window.location.search.toLowerCase();
      return p.startsWith('/potrdi') || p.startsWith('/confirm') || s.includes('token=');
    }
    return false;
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isMoreToolsOpen, setIsMoreToolsOpen] = useState<boolean>(false);
  const [showManageUserRoles, setShowManageUserRoles] = useState<boolean>(false);

  // --- HTML5 History API & URL Routing Synchronizer ---
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isConfirmView) {
      return;
    }

    const targetPath = TAB_TO_PATH[activeTab] || '/domov';
    const currentPath = window.location.pathname.toLowerCase().replace(/\/$/, '') || '/';

    if (currentPath !== targetPath && !currentPath.startsWith('/potrdi') && !currentPath.startsWith('/confirm')) {
      if (currentPath === '/') {
        window.history.replaceState({ tab: activeTab }, '', targetPath);
      } else {
        window.history.pushState({ tab: activeTab }, '', targetPath);
      }
    }

    const handlePopState = (e: PopStateEvent) => {
      // Ignore popstate events triggered by modal or drawer overlays closing
      if (e.state && (e.state as any).__modalOverlay) {
        return;
      }
      const p = window.location.pathname.toLowerCase();
      const s = window.location.search.toLowerCase();
      if (p.startsWith('/potrdi') || p.startsWith('/confirm') || s.includes('token=')) {
        setIsConfirmView(true);
      } else {
        setIsConfirmView(false);
        const tabFromUrl = (e.state && (e.state as any).tab) ? (e.state as any).tab : getTabFromPath(window.location.pathname);
        startTransition(() => {
          setActiveTab(tabFromUrl);
        });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab, isConfirmView]);
  const [selectedSundayId, setSelectedSundayId] = useState<string | null>(null);
  const [targetMinistryId, setTargetMinistryId] = useState<string | null>(null);
  const [targetCategory, setTargetCategory] = useState<string | null>(null);

  const handleSelectSunday = (sundayId: string, ministryId?: string, categoryId?: string) => {
    setSelectedSundayId(sundayId);
    setTargetMinistryId(ministryId || null);
    setTargetCategory(categoryId || null);
  };

  const handleNavTab = (tab: TabType) => {
    setSelectedSundayId(null);
    setTargetMinistryId(null);
    setTargetCategory(null);
    const targetPath = TAB_TO_PATH[tab] || '/domov';
    const currentPath = typeof window !== 'undefined' ? (window.location.pathname.toLowerCase().replace(/\/$/, '') || '/') : '';
    if (currentPath !== targetPath && typeof window !== 'undefined') {
      window.history.pushState({ tab }, '', targetPath);
    }
    setVisitedTabs(prev => prev.has(tab) ? prev : new Set(prev).add(tab));
    startTransition(() => {
      setActiveTab(tab);
    });
  };
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState<boolean>(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState<boolean>(false);
  const [isBlackoutModalOpen, setIsBlackoutModalOpen] = useState<boolean>(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState<boolean>(false);
  const [isVisitorModalOpen, setIsVisitorModalOpen] = useState<boolean>(false);
  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState<boolean>(false);
  const [inspectionCategory, setInspectionCategory] = useState<'coffee_upper_hall' | 'tech_stage' | 'kids_classrooms' | 'general_cleaning'>('coffee_upper_hall');
  const [isRundownModalOpen, setIsRundownModalOpen] = useState<boolean>(false);
  const [rundownSundayId, setRundownSundayId] = useState<string | null>(null);

  const handleOpenInspectionModal = (category: 'coffee_upper_hall' | 'tech_stage' | 'kids_classrooms' | 'general_cleaning' = 'coffee_upper_hall') => {
    setInspectionCategory(category);
    setIsInspectionModalOpen(true);
  };

  const handleOpenRundownModal = (sundayId?: string) => {
    if (sundayId) {
      setRundownSundayId(sundayId);
    }
    setIsRundownModalOpen(true);
  };

  // Toast notification for user role actions & profile linking
  const [roleActionToast, setRoleActionToast] = useState<{ message: string; type?: 'success' | 'info' } | null>(null);

  useEffect(() => {
    if (roleActionToast) {
      const timer = setTimeout(() => setRoleActionToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [roleActionToast]);

  // --- Visitor & Coffee Shop Connections ---
  const [visitorConnections, setVisitorConnections] = useState<VisitorConnection[]>(() => {
    const saved = localStorage.getItem('church_roster_visitors_v1');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return INITIAL_VISITOR_CONNECTIONS;
  });

  useEffect(() => {
    localStorage.setItem('church_roster_visitors_v1', JSON.stringify(visitorConnections));
  }, [visitorConnections]);

  // --- Nedeljska Šola States ---
  const [sundaySchoolLessons, setSundaySchoolLessons] = useState<SundaySchoolLesson[]>(() => {
    const saved = localStorage.getItem('church_roster_nsl_lessons_v1');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return INITIAL_SUNDAY_SCHOOL_LESSONS;
  });

  useEffect(() => {
    localStorage.setItem('church_roster_nsl_lessons_v1', JSON.stringify(sundaySchoolLessons));
  }, [sundaySchoolLessons]);

  const handleUpdateSundaySchoolLessons = (newLessons: SundaySchoolLesson[]) => {
    setSundaySchoolLessons(newLessons);
    setSundays(prev => {
      const syncedSundays = syncSundaysFromSundaySchoolLessons(newLessons, prev);
      try {
        localStorage.setItem('church_roster_sundays_v2', JSON.stringify(syncedSundays));
      } catch (e) { /* ignore */ }
      return syncedSundays;
    });
  };

  const [sundaySchoolSupplies, setSundaySchoolSupplies] = useState<SundaySchoolSupply[]>(() => {
    const saved = localStorage.getItem('church_roster_nsl_supplies_v3');
    if (saved) {
      try { 
        const parsed: SundaySchoolSupply[] = JSON.parse(saved);
        return parsed.map(s => {
          if ((s.category as string) === 'wood') return { ...s, category: 'crafts' as const };
          if ((s.category as string) === 'other' || (s.category as string) === 'things') return { ...s, category: 'random' as const };
          return s;
        });
      } catch (e) { /* ignore */ }
    }
    return INITIAL_SUNDAY_SCHOOL_SUPPLIES;
  });

  useEffect(() => {
    localStorage.setItem('church_roster_nsl_supplies_v3', JSON.stringify(sundaySchoolSupplies));
  }, [sundaySchoolSupplies]);

  // Initial Shift Swap Requests
  const [swapRequests, setSwapRequests] = useState<ShiftSwapRequest[]>(() => {
    const saved = localStorage.getItem('church_roster_swaps_v1');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return [
      {
        id: 'swap-1',
        requesterName: 'Matjaž Vrečko - TEST OBVESTILA',
        sundayId: 'sun-3',
        sundayDate: '14. 9. 2025',
        ministryId: 'av_tech',
        ministryName: 'AV Tech / Zvok',
        reason: 'Službena pot v tujino. Prosim za zamenjavo.',
        status: 'open',
        createdAt: 'Včeraj, 18:20'
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem('church_roster_swaps_v1', JSON.stringify(swapRequests));
  }, [swapRequests]);

  // Initial Blackout Dates
  const [blackoutDates, setBlackoutDates] = useState<BlackoutDate[]>(() => {
    const saved = localStorage.getItem('church_roster_blackouts_v1');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return [
      {
        id: 'blackout-1',
        personName: 'Aleš Lajlar',
        startDate: '2025-08-15',
        endDate: '2025-08-25',
        reason: 'Letni dopust / Družinski oddih',
        createdAt: '1. 8. 2025'
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem('church_roster_blackouts_v1', JSON.stringify(blackoutDates));
  }, [blackoutDates]);

  // Shared Worship Roster Schedule State (Single Source of Truth)
  const [worshipRoster, setWorshipRoster] = useState<WorshipRosterEntry[]>(() => {
    const saved = localStorage.getItem('church_roster_worship_schedule_v1');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return INITIAL_WORSHIP_ROSTER;
  });

  useEffect(() => {
    localStorage.setItem('church_roster_worship_schedule_v1', JSON.stringify(worshipRoster));
  }, [worshipRoster]);

  const handleUpdateWorshipRoster = (newRoster: WorshipRosterEntry[]) => {
    setWorshipRoster(newRoster);
    // Persist to Supabase
    for (const entry of newRoster) {
      upsertWorshipScheduleToSupabase(entry).catch(console.warn);
    }
    if (IS_FIREBASE_ENABLED && db) {
      (async () => {
        try {
          for (const entry of newRoster) {
            try {
              const docRef = doc(db, 'worshipSchedules', entry.id);
              await setDoc(docRef, sanitizeForFirestore(entry), { merge: true });
            } catch (singleErr: any) {
              if (singleErr?.code === 'permission-denied' || singleErr?.message?.includes('insufficient permissions')) {
                console.warn('[Firestore] Worship schedule write restricted (unauthenticated or missing permissions). Changes safely preserved in local storage.');
                break;
              } else {
                console.warn('[Firestore] Notice saving worship schedule entry:', singleErr?.message || singleErr);
              }
            }
          }
        } catch (e: any) {
          console.warn('[Firestore] Worship schedule sync notice:', e?.message || e);
        }
      })();
    }
  };

  // Handlers for Swap Requests
  const handleCreateSwapRequest = (req: Omit<ShiftSwapRequest, 'id' | 'createdAt' | 'status'> & { status?: ShiftSwapRequest['status'] }) => {
    const newReq: ShiftSwapRequest = {
      ...req,
      id: 'swap-' + Date.now(),
      status: req.status || (req.swapType === 'direct' ? 'pending_direct' : 'open'),
      createdAt: 'Danes ob ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setSwapRequests(prev => [newReq, ...prev]);
    upsertShiftSwapToSupabase(newReq).catch(console.warn);
  };

  const handleAcceptSwapRequest = (requestId: string, acceptingPersonName: string) => {
    const req = swapRequests.find(r => r.id === requestId);
    if (!req) return;

    const updatedReq: ShiftSwapRequest = {
      ...req,
      status: 'accepted',
      acceptedByName: acceptingPersonName
    };

    // 1. Mark request as accepted
    setSwapRequests(prev =>
      prev.map(r => r.id === requestId ? updatedReq : r)
    );
    upsertShiftSwapToSupabase(updatedReq).catch(console.warn);

    // 2. Automatically update Sunday assignments: replace requester with accepting person
    setSundays(prevSundays =>
      prevSundays.map(sun => {
        if (sun.id === req.sundayId || sun.date === req.sundayDate) {
          const updatedAssignments = { ...sun.assignments };
          const currentList = updatedAssignments[req.ministryId] || [];
          // Swap requester out, accepting person in
          const newList = currentList.filter(n => n !== req.requesterName);
          if (!newList.includes(acceptingPersonName)) {
            newList.push(acceptingPersonName);
          }
          updatedAssignments[req.ministryId] = newList;

          const modifiedSunday = {
            ...sun,
            assignments: updatedAssignments
          };
          upsertSundayToSupabase(modifiedSunday).catch(console.warn);
          return modifiedSunday;
        }
        return sun;
      })
    );

    // 3. Resolve requester email and send notification + log in-app notification
    const requesterPerson = people.find(p => p.name.toLowerCase().trim() === req.requesterName.toLowerCase().trim());
    const requesterEmail = req.requesterEmail || requesterPerson?.email;

    logInAppNotification({
      type: 'volunteer_response',
      title: `🎉 Zamenjava sprejeta! (${req.ministryName})`,
      message: `${acceptingPersonName} je sprejel/a tvojo prošnjo za zamenjavo pri službi ${req.ministryName} dne ${req.sundayDate}.`,
      action: 'confirmed',
      volunteerName: acceptingPersonName,
      ministryName: req.ministryName,
      sundayDate: req.sundayDate,
    });

    if (requesterEmail && requesterEmail.includes('@')) {
      sendSwapAcceptedNotificationToRequester({
        requesterName: req.requesterName,
        requesterEmail,
        targetPersonName: acceptingPersonName,
        ministryName: req.ministryName,
        sundayDate: req.sundayDate,
      }).catch(err => {
        console.warn('Swap accepted email notice to requester:', err);
      });
    }
  };

  const handleDeclineSwapRequest = (requestId: string, declineReason?: string) => {
    const req = swapRequests.find(r => r.id === requestId);
    if (!req) return;

    const updatedReq: ShiftSwapRequest = {
      ...req,
      status: 'declined',
      declinedByName: req.targetPersonName || activePerson?.name,
      declineReason: declineReason || req.declineReason,
    };

    setSwapRequests(prev =>
      prev.map(r => r.id === requestId ? updatedReq : r)
    );
    upsertShiftSwapToSupabase(updatedReq).catch(console.warn);

    logInAppNotification({
      type: 'volunteer_response',
      title: `❌ Prošnja za zamenjavo zavrnjena (${req.ministryName})`,
      message: `${req.targetPersonName || 'Sodelavec'} ne more prevzeti službe ${req.ministryName} dne ${req.sundayDate}.${declineReason ? ` Razlog: "${declineReason}"` : ''} Lahko objavite na odprto desko.`,
      action: 'declined',
      volunteerName: req.targetPersonName || '',
      ministryName: req.ministryName,
      sundayDate: req.sundayDate,
      note: declineReason,
    });
  };

  const handleConvertToOpenSwapRequest = (requestId: string) => {
    const req = swapRequests.find(r => r.id === requestId);
    if (!req) return;

    const updatedReq: ShiftSwapRequest = {
      ...req,
      status: 'open',
      swapType: 'open',
      targetPersonName: undefined,
      targetPersonId: undefined,
      targetPersonEmail: undefined,
    };

    setSwapRequests(prev =>
      prev.map(r => r.id === requestId ? updatedReq : r)
    );
    upsertShiftSwapToSupabase(updatedReq).catch(console.warn);
  };

  const handleCancelSwapRequest = (requestId: string) => {
    const req = swapRequests.find(r => r.id === requestId);
    if (req) {
      upsertShiftSwapToSupabase({ ...req, status: 'cancelled' }).catch(console.warn);
    }
    setSwapRequests(prev => prev.filter(r => r.id !== requestId));
  };

  // Handlers for Blackout Dates
  const handleAddBlackoutDate = (b: Omit<BlackoutDate, 'id' | 'createdAt'>) => {
    const newB: BlackoutDate = {
      ...b,
      id: 'blackout-' + Date.now(),
      createdAt: formatToEuropeanDate(new Date())
    };
    setBlackoutDates(prev => [newB, ...prev]);
    insertBlackoutToSupabase(b).catch(console.warn);
  };

  const handleDeleteBlackoutDate = (id: string) => {
    setBlackoutDates(prev => prev.filter(b => b.id !== id));
    deleteBlackoutFromSupabase(id).catch(console.warn);
  };



  // --- Auth states ---
  const [authUser, setAuthUser] = useState<any>(null);
  const [userDbProfile, setUserDbProfile] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  const [isSigningInGoogle, setIsSigningInGoogle] = useState<boolean>(false);
  const [showEmailForm, setShowEmailForm] = useState<boolean>(false);
  const [emailInput, setEmailInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [isEmailSubmitting, setIsEmailSubmitting] = useState<boolean>(false);
  const [authEmailError, setAuthEmailError] = useState<string | null>(null);
  const [isSendingMagicLink, setIsSendingMagicLink] = useState<boolean>(false);
  const [magicLinkSent, setMagicLinkSent] = useState<boolean>(false);
  const [googleToken, setGoogleToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('church_roster_google_token') || sessionStorage.getItem('church_roster_google_token') || null;
    }
    return null;
  });

  const handleSetGoogleToken = (token: string | null) => {
    setGoogleToken(token);
    if (token) {
      try {
        localStorage.setItem('church_roster_google_token', token);
        sessionStorage.setItem('church_roster_google_token', token);
      } catch (e) { /* ignore */ }
    } else {
      try {
        localStorage.removeItem('church_roster_google_token');
        sessionStorage.removeItem('church_roster_google_token');
      } catch (e) { /* ignore */ }
    }
  };

  // --- Legacy Mode States (If Firebase is not provisioned/enabled) ---
  const [legacyRole, setLegacyRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem('church_roster_role_v2');
    return (saved as UserRole) || 'Admin';
  });

  // Local role simulation: STRICTLY RESTRICTED TO GENUINE ADMINS
  const [testRoleOverride, setTestRoleOverride] = useState<UserRole | null>(null);

  // Confirmed Viewer IDs/emails: suppresses persistent pending role alerts for recognized Viewers
  const [confirmedViewerIds, setConfirmedViewerIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('church_roster_confirmed_viewers_v2');
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.removeItem('kck_local_test_role_override');
    } catch {}
  }, []);

  const handleSetTestRole = (role: UserRole | null) => {
    const isAles = (authUser?.email || '').toLowerCase().trim() === 'ales.lajlar@gmail.com';
    const isDbAdmin = userDbProfile?.role === 'Admin';
    if (!isAles && !isDbAdmin) {
      setTestRoleOverride(null);
      return;
    }
    setTestRoleOverride(role);
  };

  const [activePersonName, setActivePersonName] = useState<string>(() => {
    const saved = localStorage.getItem('church_roster_active_person_v2');
    return saved || '';
  });

  useEffect(() => {
    if (activePersonName) {
      localStorage.setItem('church_roster_active_person_v2', activePersonName);
    } else {
      localStorage.removeItem('church_roster_active_person_v2');
    }
  }, [activePersonName]);

  // Calculate standard translations
  const translations: Translation = currentLanguage === 'sl' ? TRANS_SL : TRANS_EN;
  const ministries: Ministry[] = INITIAL_MINISTRIES;

  // Active person object strictly tied to authUser or active persona (NEVER falling back to Aleš Lajlar when someone else logs in!)
  const activePerson: Person | null = (() => {
    if (authUser) {
      const userEmail = (authUser.email || '').toLowerCase().trim();
      const isAles = userEmail === 'ales.lajlar@gmail.com';
      const userFullName = (authUser.user_metadata?.full_name || authUser.user_metadata?.name || '').toLowerCase().trim();

      const match = (people || []).find(p => {
        if (!p || typeof p !== 'object') return false;
        // Strictly prevent any non-Ales user from matching Aleš Lajlar's profile
        if (!isAles && (p.name?.toLowerCase().includes('aleš lajlar') || p.id === 'p-ales_lajlar' || p.email?.toLowerCase() === 'ales.lajlar@gmail.com')) {
          return false;
        }
        if (userEmail && p.email && p.email.toLowerCase().trim() === userEmail) return true;
        if (authUser.id && (p.id === authUser.id || (p as any).auth_user_id === authUser.id)) return true;
        if (userFullName && p.name && p.name.toLowerCase().trim() === userFullName) return true;
        return false;
      });
      return match || null;
    }
    if (activePersonName) {
      return (people || []).find(p => p && p.name && p.name.toLowerCase().trim() === activePersonName.toLowerCase().trim()) || null;
    }
    return null;
  })();

  // Active upcoming duty count for active person & unread volunteer responses
  const unreadAppNotifsCount = (() => {
    try {
      const raw = localStorage.getItem('church_roster_in_app_notifications_v1');
      if (!raw) return 0;
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list.filter((n: any) => !n.read).length : 0;
    } catch (e) {
      return 0;
    }
  })();

  const activeUpcomingDutiesCount = (sundays || []).reduce((count, sunday) => {
    if (!sunday || !sunday.assignments) return count;
    let assigned = false;
    Object.values(sunday.assignments).forEach((names) => {
      if (Array.isArray(names) && activePerson?.name && names.includes(activePerson.name)) {
        assigned = true;
      }
    });
    return assigned ? count + 1 : count;
  }, 0) + unreadAppNotifsCount;

  const handleUpdatePersonNotificationSettings = (pName: string, settings: any) => {
    const existing = (people || []).find(p => p && p.name === pName);
    if (existing) {
      handleUpdatePerson(pName, { ...existing, notificationSettings: settings });
    }
  };

  // Active role depending on authentication state or active persona
  const isAlesLoggedIn = (authUser?.email || '').toLowerCase().trim() === 'ales.lajlar@gmail.com';
  const isGenuineAdmin = isAlesLoggedIn || userDbProfile?.role === 'Admin';
  const safeActivePersonRole = (!isAlesLoggedIn && activePerson?.name === 'Aleš Lajlar') ? 'Viewer' : activePerson?.role;
  const resolvedDbOrPersonRole = userDbProfile?.role || safeActivePersonRole;
  const actualAccountRole: UserRole = isAlesLoggedIn
    ? 'Admin'
    : (resolvedDbOrPersonRole || (authUser ? 'Viewer' : 'Viewer'));

  // ONLY genuine Admins are allowed to simulate roles (Leader, Servant, Viewer). Non-admins ALWAYS get their true role!
  const activeRole: UserRole = (isGenuineAdmin && testRoleOverride)
    ? testRoleOverride
    : actualAccountRole;

  // Save changes to localStorage in legacy offline fallback mode
  useEffect(() => {
    localStorage.setItem('church_roster_lang_v2', currentLanguage);
  }, [currentLanguage]);

  useEffect(() => {
    if (!IS_FIREBASE_ENABLED) {
      localStorage.setItem('church_roster_role_v2', legacyRole);
    }
  }, [legacyRole]);

  const peopleRef = useRef<Person[]>(people);
  useEffect(() => {
    peopleRef.current = people;
  }, [people]);

  // --- Supabase Authentication State Subscription ---
  useEffect(() => {
    if (!IS_SUPABASE_CONFIGURED) {
      setSundays(prev => prev.length > 0 ? prev : INITIAL_SUNDAYS);
      setPeople(prev => prev.length > 0 ? prev : INITIAL_PEOPLE);
      setAuthLoading(false);
      setDataLoading(false);
      return;
    }

    const syncUserSession = async (sessionUser: any) => {
      if (!sessionUser) {
        setAuthUser(null);
        setUserDbProfile(null);
        setAuthLoading(false);
        return;
      }

      setAuthUser(sessionUser);
      const userEmail = (sessionUser.email || '').toLowerCase().trim();
      const isAles = userEmail === 'ales.lajlar@gmail.com';
      const userFullName = sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name || '';
      const currentPeople = (peopleRef.current && peopleRef.current.length > 0) ? peopleRef.current : (people && people.length > 0 ? people : []);

      // 1. Direct superadmin override for Ales
      if (isAles) {
        const adminName = 'Aleš Lajlar';
        const adminPerson = currentPeople.find(p => p && (
          (p.email && p.email.toLowerCase() === userEmail) ||
          (p.name && p.name.toLowerCase().includes('aleš'))
        ));
        const matchedName = adminPerson?.name || adminName;
        setActivePersonName(matchedName);
        const adminUserObj: User = {
          uid: sessionUser.id,
          email: userEmail,
          displayName: userFullName || `${matchedName} (Pastor/Admin)`,
          role: 'Admin',
          personName: matchedName
        };
        setUserDbProfile(adminUserObj);
        setUsers(prev => {
          const filtered = prev.filter(u => u.uid !== sessionUser.id && u.email !== sessionUser.email);
          return [adminUserObj, ...filtered];
        });

        // Set auth_user_id on canonical profile row
        try {
          await supabase.from('profiles').update({
            auth_user_id: sessionUser.id,
            email: userEmail,
            role: 'Admin'
          }).ilike('email', userEmail);
        } catch (e) { /* ignore */ }

        setAuthLoading(false);
        return;
      }

      // Purge any stale active persona from localStorage left over from previous test sessions
      if (!isAles) {
        const storedActivePerson = localStorage.getItem('church_roster_active_person_v2');
        if (storedActivePerson && storedActivePerson.toLowerCase().includes('aleš')) {
          localStorage.removeItem('church_roster_active_person_v2');
          setActivePersonName('');
        }
      }

      // 2. Fetch fresh live profile from Supabase profiles table
      let dbProfile: any = null;
      try {
        const { data: matchedProfiles } = await supabase
          .from('profiles')
          .select('id, auth_user_id, email, full_name, name, role, approval_status, preferred_ministries, led_ministries, family_members, is_exempt_from_burnout')
          .or(`auth_user_id.eq.${sessionUser.id},id.eq.${sessionUser.id},email.ilike.${userEmail}`)
          .limit(5);

        if (matchedProfiles && matchedProfiles.length > 0) {
          // If not Ales, discard any profile belonging to Ales Lajlar to prevent identity crossover
          const filteredProfiles = isAles
            ? matchedProfiles
            : matchedProfiles.filter(p => !p.email?.toLowerCase().includes('ales.lajlar') && !p.full_name?.toLowerCase().includes('aleš lajlar') && p.id !== 'p-ales_lajlar');

          if (filteredProfiles.length > 0) {
            // Sort to prioritize highest role (Admin > Leader > Servant > Viewer) and canonical IDs (p-*)
            const sortedProfiles = [...filteredProfiles].sort((a, b) => {
              const roleDiff = getRoleWeight(b.role) - getRoleWeight(a.role);
              if (roleDiff !== 0) return roleDiff;
              const aIsCanonical = (a.id || '').startsWith('p-') ? 1 : 0;
              const bIsCanonical = (b.id || '').startsWith('p-') ? 1 : 0;
              return bIsCanonical - aIsCanonical;
            });
            dbProfile = sortedProfiles[0];
          }
        }
      } catch (e) { /* ignore */ }

      // Find in loaded people list or fallback to initial roster (preventing non-Ales from matching Aleš Lajlar)
      let matchedPerson = currentPeople.find(p => p && (
        (!isAles && (p.name?.toLowerCase().includes('aleš lajlar') || p.id === 'p-ales_lajlar' || p.email?.toLowerCase() === 'ales.lajlar@gmail.com') ? false : true) && (
          (p.id && (p.id === sessionUser.id || (p as any).auth_user_id === sessionUser.id || (dbProfile && p.id === dbProfile.id))) ||
          (p.email && p.email.toLowerCase().trim() === userEmail) ||
          (userFullName && p.name && (p.name.toLowerCase().trim() === userFullName.toLowerCase().trim() || isNameMatch(p.name, userFullName)))
        )
      ));

      if (!matchedPerson) {
        matchedPerson = INITIAL_PEOPLE.find(p => p && (
          (!isAles && (p.name?.toLowerCase().includes('aleš lajlar') || p.id === 'p-ales_lajlar' || p.email?.toLowerCase() === 'ales.lajlar@gmail.com') ? false : true) && (
            (p.email && p.email.toLowerCase().trim() === userEmail) ||
            (userFullName && p.name && (p.name.toLowerCase().trim() === userFullName.toLowerCase().trim() || isNameMatch(p.name, userFullName)))
          )
        ));
      }

      // Explicit check for designated leaders requested by user
      const isNina = userEmail === 'nina.cizic@gmail.com' || (userFullName && userFullName.toLowerCase().includes('nina'));
      const isDoroteja = userEmail === 'dkolar@drustvovec.si' || userEmail === 'doroteja.kolar@gmail.com' || (userFullName && userFullName.toLowerCase().includes('doroteja'));

      // Determine resolved role: preserve any assigned Leader or Servant role!
      let resolvedRole: UserRole = 'Viewer';

      if (isNina || isDoroteja) {
        resolvedRole = 'Leader';
      } else {
        const dbRole = dbProfile?.role ? normalizeUserRole(dbProfile.role) : null;
        const rosterRole = matchedPerson?.role ? normalizeUserRole(matchedPerson.role) : null;

        // Never downgrade an assigned Leader or Servant to Viewer!
        const candidateRoles = [dbRole, rosterRole].filter(Boolean) as UserRole[];
        if (candidateRoles.length > 0) {
          candidateRoles.sort((a, b) => getRoleWeight(b) - getRoleWeight(a));
          resolvedRole = candidateRoles[0];
        } else {
          resolvedRole = 'Viewer';
        }
      }

      if (dbProfile) {
        const dbPreferred = Array.isArray(dbProfile.preferred_ministries) ? dbProfile.preferred_ministries : [];
        const dbLed = Array.isArray(dbProfile.led_ministries) ? dbProfile.led_ministries : [];
        const dbFamily = Array.isArray(dbProfile.family_members) ? dbProfile.family_members : [];

        if (matchedPerson) {
          matchedPerson = {
            ...matchedPerson,
            role: resolvedRole,
            preferredMinistries: dbPreferred.length > 0 ? dbPreferred : (matchedPerson.preferredMinistries || []),
            ledMinistries: dbLed.length > 0 ? dbLed : (matchedPerson.ledMinistries || []),
            familyMembers: dbFamily.length > 0 ? dbFamily : (matchedPerson.familyMembers || [])
          };
        } else {
          matchedPerson = {
            id: dbProfile.id,
            name: dbProfile.full_name || dbProfile.name || userFullName || userEmail.split('@')[0],
            email: dbProfile.email || userEmail,
            phone: dbProfile.phone,
            role: resolvedRole,
            preferredMinistries: dbPreferred,
            ledMinistries: dbLed,
            familyMembers: dbFamily
          };
        }
      } else if (matchedPerson) {
        matchedPerson = {
          ...matchedPerson,
          role: resolvedRole
        };
      }

      if (matchedPerson) {
        setActivePersonName(matchedPerson.name);
        
        const userObj: User = {
          uid: sessionUser.id,
          email: userEmail,
          displayName: matchedPerson.name || userFullName || userEmail.split('@')[0],
          role: resolvedRole,
          personName: matchedPerson.name
        };
        setUserDbProfile(userObj);
        setUsers(prev => {
          const filtered = prev.filter(u => u.uid !== sessionUser.id && u.email !== sessionUser.email);
          return [userObj, ...filtered];
        });

        // Update in-memory people list so this user's live role and profile are immediately active in state
        setPeople(prev => {
          const list = prev || [];
          let exists = false;
          const updated = list.map(p => {
            if (p && (p.id === matchedPerson!.id || p.name.toLowerCase().trim() === matchedPerson!.name.toLowerCase().trim())) {
              exists = true;
              return { ...p, ...matchedPerson, role: resolvedRole };
            }
            return p;
          });
          const result = exists ? updated : [...list, matchedPerson!];
          try { localStorage.setItem('church_roster_people_v2', JSON.stringify(result)); } catch (e) {}
          return result;
        });

        // Link auth_user_id without downgrading or overwriting their role
        try {
          const profileIdToUpdate = dbProfile?.id || matchedPerson.id;
          await supabase.from('profiles').update({
            auth_user_id: sessionUser.id,
            email: sessionUser.email || matchedPerson.email || userEmail,
            role: resolvedRole,
            updated_at: new Date().toISOString()
          }).or(`id.eq.${profileIdToUpdate},email.ilike.${userEmail}`);

          if (matchedPerson.id !== sessionUser.id && profileIdToUpdate !== sessionUser.id) {
            await supabase.from('profiles').delete().eq('id', sessionUser.id).catch(() => {});
          }
        } catch (e) { /* ignore */ }
      } else {
        // Only create a new profile row if this person is genuinely brand new!
        try {
          await supabase.from('profiles').upsert({
            id: sessionUser.id,
            auth_user_id: sessionUser.id,
            full_name: userFullName || userEmail.split('@')[0],
            name: userFullName || userEmail.split('@')[0],
            email: userEmail,
            role: 'Viewer',
            member_type: 'member',
            preferred_ministries: [],
            family_members: [],
            is_exempt_from_burnout: false
          });
        } catch (e) { /* ignore */ }
      }

      const activeUserObj: User = {
        uid: sessionUser.id,
        email: sessionUser.email || '',
        displayName: dbProfile?.full_name || dbProfile?.name || userFullName || (sessionUser.email ? sessionUser.email.split('@')[0] : 'Uporabnik'),
        role: resolvedRole,
        personName: dbProfile?.full_name || dbProfile?.name || matchedPerson?.name
      };
      setUserDbProfile(activeUserObj);
      setUsers(prev => {
        const filtered = prev.filter(u => u.uid !== sessionUser.id && u.email !== sessionUser.email);
        return [activeUserObj, ...filtered];
      });
      setAuthLoading(false);
    };

    // 0. Check for OAuth errors in URL
    if (typeof window !== 'undefined') {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const queryParams = new URLSearchParams(window.location.search);
      const oauthError = hashParams.get('error_description') || queryParams.get('error_description') || hashParams.get('error') || queryParams.get('error');
      if (oauthError) {
        console.warn('OAuth redirect error:', oauthError);
        alert(`Prijava ni uspela: ${decodeURIComponent(oauthError.replace(/\+/g, ' '))}`);
      }
    }

    // 1. Initial user session check from Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      syncUserSession(session?.user ?? null);
    }).catch(() => {
      setAuthLoading(false);
    });

    // 2. Supabase Auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      syncUserSession(session?.user ?? null);
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        broadcastAuthChange('GLOBAL_SIGNIN');
      } else if (event === 'SIGNED_OUT') {
        broadcastAuthChange('GLOBAL_SIGNOUT');
      }
    });

    // 3. Cross-subdomain & cross-tab BroadcastChannel listener
    const broadcastChannel = getAuthBroadcastChannel();
    if (broadcastChannel) {
      broadcastChannel.onmessage = (event) => {
        if (event.data?.type === 'GLOBAL_SIGNOUT') {
          syncUserSession(null);
        } else if (event.data?.type === 'GLOBAL_SIGNIN') {
          supabase.auth.getSession().then(({ data: { session } }) => {
            syncUserSession(session?.user ?? null);
          });
        }
      };
    }

    // 4. Tab visibility / focus sync
    const handleTabFocus = () => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        syncUserSession(session?.user ?? null);
      }).catch(() => {});
    };

    window.addEventListener('focus', handleTabFocus);
    document.addEventListener('visibilitychange', handleTabFocus);

    return () => {
      subscription.unsubscribe();
      if (broadcastChannel) broadcastChannel.close();
      window.removeEventListener('focus', handleTabFocus);
      document.removeEventListener('visibilitychange', handleTabFocus);
    };
  }, []);

  // --- Firestore Realtime Data Synchronizer (Disabled when Supabase is active) ---
  useEffect(() => {
    if (!IS_FIREBASE_ENABLED || !db || IS_SUPABASE_CONFIGURED) {
      return;
    }

    // 1. Real-time Listener for Sundays
    const unsubSundays = onSnapshot(collection(db, 'sundays'), (snapshot) => {
      const fetchedSundays: ServiceSunday[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as ServiceSunday;
        if (data && data.id) fetchedSundays.push(data);
      });

      const localSundays = safeParseSundays(localStorage.getItem('church_roster_sundays_v2'));
      const mergedSundays = mergeSundaysWithDefaults(fetchedSundays, localSundays);
      setSundays(mergedSundays);
      try {
        localStorage.setItem('church_roster_sundays_v2', JSON.stringify(mergedSundays));
      } catch (e) { /* ignore */ }
      setDataLoading(false);
    }, (error) => {
      console.warn('Sundays Firestore listener warning, falling back to local merge:', error?.message || error);
      const localSundays = safeParseSundays(localStorage.getItem('church_roster_sundays_v2'));
      setSundays(mergeSundaysWithDefaults([], localSundays));
      setDataLoading(false);
    });

    // 2. Real-time Listener for People
    const unsubPeople = onSnapshot(collection(db, 'people'), (snapshot) => {
      const fetchedPeople: Person[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Person;
        if (data && data.name) {
          const docId = docSnap.id;
          fetchedPeople.push({
            ...data,
            id: data.id || docId || ('p-' + data.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '_'))
          });
        }
      });

      const localPeople = safeParsePeople(localStorage.getItem('church_roster_people_v2'));
      const mergedPeople = mergePeopleWithDefaults(fetchedPeople, localPeople);
      setPeople(mergedPeople);
      try {
        localStorage.setItem('church_roster_people_v2', JSON.stringify(mergedPeople));
      } catch (e) { /* ignore */ }
    }, (error) => {
      console.warn('People Firestore listener warning, falling back to local merge:', error?.message || error);
      const localPeople = safeParsePeople(localStorage.getItem('church_roster_people_v2'));
      setPeople(mergePeopleWithDefaults([], localPeople));
    });

    // 3. Real-time Listener for Registered Users (Admin view)
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const fetchedUsers: User[] = [];
      snapshot.forEach((doc) => {
        fetchedUsers.push(doc.data() as User);
      });
      setUsers(prevUsers => {
        if (prevUsers.length === fetchedUsers.length) {
          const isIdentical = prevUsers.every((u) => {
            const f = fetchedUsers.find(fu => fu.uid === u.uid);
            return f && f.role === u.role && f.personName === u.personName && f.email === u.email && f.displayName === u.displayName;
          });
          if (isIdentical) return prevUsers;
        }
        return fetchedUsers;
      });
    }, (error) => {
      console.warn('Silent users listen permission error:', error);
    });

    return () => {
      unsubSundays();
      unsubPeople();
      unsubUsers();
    };
  }, [activeRole]);

  // --- Supabase Realtime & Persistent Data Synchronizer ---
  useEffect(() => {
    if (!IS_SUPABASE_CONFIGURED) return;

    const loadFromSupabase = async () => {
      try {
        const [remoteSundays, remotePeople, remoteBlackouts, remoteSwaps, remoteUsers] = await Promise.all([
          fetchSundaysFromSupabase(),
          fetchPeopleFromSupabase(),
          fetchBlackoutsFromSupabase(),
          fetchShiftSwapsFromSupabase(),
          fetchRegisteredUsersFromSupabase()
        ]);

        if (remoteSundays.length > 0) {
          const localSundays = safeParseSundays(localStorage.getItem('church_roster_sundays_v2'));
          const merged = mergeSundaysWithDefaults(remoteSundays, localSundays);
          setSundays(merged);
          try { localStorage.setItem('church_roster_sundays_v2', JSON.stringify(merged)); } catch (e) {}
        }

        if (remotePeople.length > 0) {
          const localPeople = safeParsePeople(localStorage.getItem('church_roster_people_v2'));
          const merged = mergePeopleWithDefaults(remotePeople, localPeople);
          const { list: enforcedList, changed } = ensureDesignatedLeaders(merged);
          setPeople(enforcedList);
          try { localStorage.setItem('church_roster_people_v2', JSON.stringify(enforcedList)); } catch (e) {}

          if (changed && IS_SUPABASE_CONFIGURED) {
            supabase.from('profiles').update({ role: 'Leader', updated_at: new Date().toISOString() })
              .or('email.ilike.nina.cizic@gmail.com,id.eq.p-nina_cizic,name.ilike.Nina Čižič,full_name.ilike.Nina Čižič').catch(() => {});
            supabase.from('profiles').update({ role: 'Leader', updated_at: new Date().toISOString() })
              .or('email.ilike.dkolar@drustvovec.si,id.eq.p-doroteja_kolar,name.ilike.Doroteja Kolar,full_name.ilike.Doroteja Kolar').catch(() => {});
          }

          // Sync current logged in user's profile role if matched
          if (authUser) {
            const myEmail = (authUser.email || '').toLowerCase().trim();
            const isAles = myEmail === 'ales.lajlar@gmail.com';
            const myUid = authUser.id || authUser.uid;
            const myPerson = (enforcedList || []).find(p => p && (
              (!isAles && (p.name?.toLowerCase().includes('aleš lajlar') || p.id === 'p-ales_lajlar' || p.email?.toLowerCase() === 'ales.lajlar@gmail.com') ? false : true) && (
                (myEmail && p.email && p.email.toLowerCase().trim() === myEmail) ||
                ((p as any).auth_user_id === myUid) ||
                (p.id === myUid)
              )
            ));
            if (myPerson) {
              const liveRole = normalizeUserRole(myPerson.role);
              setUserDbProfile(prev => prev ? { ...prev, role: liveRole, personName: myPerson.name } : {
                uid: myUid,
                email: myEmail,
                displayName: myPerson.name,
                role: liveRole,
                personName: myPerson.name
              });
            }
          }
        }

        // Populate users for Role Management directly from Supabase profiles
        if (remoteUsers.length > 0) {
          setUsers(prev => {
            const map = new Map<string, User>();
            remoteUsers.forEach(u => {
              const isNinaOrDoroteja = (
                (u.email && (u.email.toLowerCase() === 'nina.cizic@gmail.com' || u.email.toLowerCase() === 'dkolar@drustvovec.si' || u.email.toLowerCase() === 'doroteja.kolar@gmail.com')) ||
                (u.displayName && (u.displayName.toLowerCase().includes('nina čižič') || u.displayName.toLowerCase().includes('doroteja kolar'))) ||
                (u.personName && (u.personName.toLowerCase().includes('nina čižič') || u.personName.toLowerCase().includes('doroteja kolar')))
              );
              const role = isNinaOrDoroteja ? 'Leader' : u.role;
              map.set(u.uid, { ...u, role });
            });
            prev.forEach(u => {
              if (!map.has(u.uid)) map.set(u.uid, u);
            });
            return Array.from(map.values());
          });
        }

        if (remoteBlackouts.length > 0) {
          setBlackoutDates(remoteBlackouts);
          try { localStorage.setItem('church_roster_blackouts_v1', JSON.stringify(remoteBlackouts)); } catch (e) {}
        }

        if (remoteSwaps.length > 0) {
          setSwapRequests(remoteSwaps);
          try { localStorage.setItem('church_roster_swaps_v1', JSON.stringify(remoteSwaps)); } catch (e) {}
        }
      } catch (err) {
        console.warn('[Supabase] Initial data fetch notice:', err);
      } finally {
        setDataLoading(false);
      }
    };

    loadFromSupabase();

    const unsubRealtime = subscribeToSupabaseRealtime(
      async () => {
        const freshSundays = await fetchSundaysFromSupabase();
        if (freshSundays.length > 0) {
          const merged = mergeSundaysWithDefaults(freshSundays, []);
          setSundays(merged);
          try { localStorage.setItem('church_roster_sundays_v2', JSON.stringify(merged)); } catch (e) {}
        }
      },
      async () => {
        const [freshPeople, freshUsers] = await Promise.all([
          fetchPeopleFromSupabase(),
          fetchRegisteredUsersFromSupabase()
        ]);

        if (freshPeople.length > 0) {
          const merged = mergePeopleWithDefaults(freshPeople, peopleRef.current);
          const { list: enforcedList } = ensureDesignatedLeaders(merged);
          setPeople(enforcedList);
          try { localStorage.setItem('church_roster_people_v2', JSON.stringify(enforcedList)); } catch (e) {}
        }

        if (freshUsers.length > 0) {
          setUsers(prev => {
            const map = new Map<string, User>();
            freshUsers.forEach(u => {
              const isNinaOrDoroteja = (
                (u.email && (u.email.toLowerCase() === 'nina.cizic@gmail.com' || u.email.toLowerCase() === 'dkolar@drustvovec.si' || u.email.toLowerCase() === 'doroteja.kolar@gmail.com')) ||
                (u.displayName && (u.displayName.toLowerCase().includes('nina čižič') || u.displayName.toLowerCase().includes('doroteja kolar'))) ||
                (u.personName && (u.personName.toLowerCase().includes('nina čižič') || u.personName.toLowerCase().includes('doroteja kolar')))
              );
              const role = isNinaOrDoroteja ? 'Leader' : u.role;
              map.set(u.uid, { ...u, role });
            });
            prev.forEach(u => {
              if (!map.has(u.uid)) map.set(u.uid, u);
            });
            return Array.from(map.values());
          });
        }

          // Sync current logged in user's profile role on live Supabase changes
          if (authUser) {
            const myEmail = (authUser.email || '').toLowerCase().trim();
            const isAles = myEmail === 'ales.lajlar@gmail.com';
            const myUid = authUser.id || authUser.uid;
            const myPerson = (freshPeople || []).find(p => p && (
              (!isAles && (p.name?.toLowerCase().includes('aleš lajlar') || p.id === 'p-ales_lajlar' || p.email?.toLowerCase() === 'ales.lajlar@gmail.com') ? false : true) && (
                (myEmail && p.email && p.email.toLowerCase().trim() === myEmail) ||
                ((p as any).auth_user_id === myUid) ||
                (p.id === myUid)
              )
            ));
            if (myPerson) {
              const liveRole = normalizeUserRole(myPerson.role);
              setUserDbProfile(prev => prev ? { ...prev, role: liveRole, personName: myPerson.name } : {
                uid: myUid,
                email: myEmail,
                displayName: myPerson.name,
                role: liveRole,
                personName: myPerson.name
              });
            }
          }
      },
      async () => {
        const freshBlackouts = await fetchBlackoutsFromSupabase();
        if (freshBlackouts.length > 0) {
          setBlackoutDates(freshBlackouts);
          try { localStorage.setItem('church_roster_blackouts_v1', JSON.stringify(freshBlackouts)); } catch (e) {}
        }
      },
      async () => {
        const freshSwaps = await fetchShiftSwapsFromSupabase();
        if (freshSwaps.length > 0) {
          setSwapRequests(freshSwaps);
          try { localStorage.setItem('church_roster_swaps_v1', JSON.stringify(freshSwaps)); } catch (e) {}
        }
      }
    );

    return () => {
      unsubRealtime();
    };
  }, []);

  // --- Manual Developer Database Seeding Helper (Only triggered via explicit manual command) ---
  const seedInitialCollections = async () => {
    if (!db) return;
    try {
      console.log('Manual seed requested. Preparing to seed initial church roster documents...');
      const batch = writeBatch(db);
      
      // Seed Sundays
      INITIAL_SUNDAYS.forEach((sunday) => {
        const docRef = doc(db, 'sundays', sunday.id);
        batch.set(docRef, sanitizeForFirestore(sunday));
      });

      // Seed People
      INITIAL_PEOPLE.forEach((person) => {
        const docRef = doc(db, 'people', person.id);
        batch.set(docRef, sanitizeForFirestore(person));
      });

      // Seed Ministries Metadata reference
      INITIAL_MINISTRIES.forEach((ministry) => {
        const docRef = doc(db, 'ministries', ministry.id);
        batch.set(docRef, sanitizeForFirestore(ministry));
      });

      await batch.commit();
      console.log('Church initial seed data has been successfully written to Firestore.');
      setDataLoading(false);
    } catch (err) {
      console.error('Failed to seed initial collections database:', err);
      setDataLoading(false);
    }
  };

  const handleRestoreFullRoster = async () => {
    setPeople(INITIAL_PEOPLE);
    setSundays(INITIAL_SUNDAYS);
    try {
      localStorage.setItem('church_roster_people_v2', JSON.stringify(INITIAL_PEOPLE));
      localStorage.setItem('church_roster_sundays_v2', JSON.stringify(INITIAL_SUNDAYS));
    } catch (e) { /* ignore */ }

    if (IS_FIREBASE_ENABLED && db) {
      try {
        await seedInitialCollections();
      } catch (e) {
        console.warn('Firestore restore seed warning:', e);
      }
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).seedChurchDatabaseManually = seedInitialCollections;
      (window as any).restoreFullRoster = handleRestoreFullRoster;
      (window as any).seedSupabaseDatabase = (customS?: any, customP?: any) => seedSupabaseDatabase(customS || sundays, customP || people);
      (window as any).migrateFirestoreToSupabase = migrateFirestoreToSupabase;
    }
  }, [sundays, people]);

  const handleGoogleLogin = async () => {
    setIsSigningInGoogle(true);
    setAuthEmailError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            prompt: 'select_account'
          }
        }
      });
      if (error) {
        console.error('Supabase Google OAuth error:', error);
        setAuthEmailError((currentLanguage === 'sl' ? 'Napaka pri prijavi z Google računom: ' : 'Google Sign-In failed: ') + error.message);
      }
    } catch (err: any) {
      console.error('Failed signing in with Google provider:', err);
      setAuthEmailError((currentLanguage === 'sl' ? 'Napaka pri prijavi z Google računom: ' : 'Google Sign-In failed: ') + (err?.message || err));
    } finally {
      setIsSigningInGoogle(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) return;
    setIsEmailSubmitting(true);
    setAuthEmailError(null);
    setMagicLinkSent(false);

    try {
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailInput.trim(),
          password: passwordInput,
        });

        if (error) {
          throw error;
        }

        if (data?.session?.user) {
          await syncUserSession(data.session.user);
        }
      }
    } catch (err: any) {
      console.warn('Email sign-in notice:', err);
      setAuthEmailError(
        err?.message ||
        (currentLanguage === 'sl'
          ? 'Napačen e-poštni naslov ali geslo.'
          : 'Invalid email or password.')
      );
    } finally {
      setIsEmailSubmitting(false);
    }
  };

  const handleMagicLinkSignIn = async () => {
    if (!emailInput || !emailInput.includes('@')) {
      setAuthEmailError(currentLanguage === 'sl' ? 'Vnesite veljaven e-poštni naslov.' : 'Please enter a valid email address.');
      return;
    }
    setIsSendingMagicLink(true);
    setAuthEmailError(null);
    setMagicLinkSent(false);

    try {
      if (supabase) {
        const { error } = await supabase.auth.signInWithOtp({
          email: emailInput.trim(),
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setMagicLinkSent(true);
      }
    } catch (err: any) {
      console.warn('Magic link error:', err);
      setAuthEmailError(err?.message || (currentLanguage === 'sl' ? 'Pošiljanje povezave ni uspelo.' : 'Failed to send login link.'));
    } finally {
      setIsSendingMagicLink(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await performGlobalSignOut();
      setUserDbProfile(null);
      setAuthUser(null);
      setActivePersonName('');
      localStorage.removeItem('church_roster_active_person_v2');
      localStorage.removeItem('kck_local_test_role_override');
      setTestRoleOverride(null);
      setGoogleToken(null);
      setSelectedSundayId(null);
      setActiveTab('home');
      window.location.reload();
    } catch (err) {
      console.error('Failed log out session:', err);
    }
  };

  // --- Role Promotion Callback (Used by Admin in People View) ---
  const handleUpdateUserRole = async (userId: string, newRole: UserRole) => {
    const targetUser = users.find(u => u.uid === userId);
    const userName = targetUser?.displayName || targetUser?.personName || targetUser?.email || 'Uporabnik';
    const userEmailKey = (targetUser?.email || '').toLowerCase().trim();

    // 1. Optimistic React state update
    setUsers(prev => prev.map(u => u.uid === userId ? { ...u, role: newRole } : u));

    // Auto-sync confirmed viewer state: if explicitly set to Viewer, dismiss notification
    if (newRole === 'Viewer') {
      setConfirmedViewerIds(prev => {
        const updated = Array.from(new Set([...prev, userId, userEmailKey].filter(Boolean)));
        try { localStorage.setItem('church_roster_confirmed_viewers_v2', JSON.stringify(updated)); } catch {}
        return updated;
      });
    } else {
      setConfirmedViewerIds(prev => {
        const updated = prev.filter(id => id !== userId && id !== userEmailKey);
        try { localStorage.setItem('church_roster_confirmed_viewers_v2', JSON.stringify(updated)); } catch {}
        return updated;
      });
    }

    // 2. Also update linked person in `people` roster if exists
    const linkedPerson = (people || []).find(p => p && (
      p.name === targetUser?.personName || 
      p.id === targetUser?.personName ||
      (p.email && targetUser?.email && p.email.toLowerCase().trim() === targetUser.email.toLowerCase().trim()) ||
      (p as any).auth_user_id === userId
    ));
    if (linkedPerson) {
      handleUpdatePerson(linkedPerson.id, { ...linkedPerson, role: newRole });
    }

    // 3. Show instant save toast popup
    const roleLabels: Record<string, string> = {
      Admin: 'Admin 🛠️',
      Leader: currentLanguage === 'sl' ? 'Vodja 📋' : 'Leader 📋',
      Servant: currentLanguage === 'sl' ? 'Služabnik 👤' : 'Servant 👤',
      Viewer: currentLanguage === 'sl' ? 'Gledalec 👁️' : 'Viewer 👁️',
      Visitor: currentLanguage === 'sl' ? 'Obiskovalec 👋' : 'Visitor 👋',
      Minor: currentLanguage === 'sl' ? 'Otrok 👶' : 'Minor 👶',
    };
    const roleText = roleLabels[newRole] || newRole;
    setRoleActionToast({
      message: currentLanguage === 'sl'
        ? `✓ Vloga shranjena: ${userName} ima zdaj vlogo ${roleText}.`
        : `✓ Role change saved: ${userName} is now ${roleText}.`,
      type: 'success'
    });

    // 4. Persist to Supabase
    if (IS_SUPABASE_CONFIGURED) {
      try {
        const patch = { 
          role: newRole, 
          approval_status: newRole === 'Viewer' ? 'viewer_approved' : 'approved',
          updated_at: new Date().toISOString() 
        };
        const isUUID = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

        if (userEmailKey) {
          await supabase.from('profiles').update(patch).ilike('email', userEmailKey);
        }
        if (userId) {
          if (isUUID(userId)) {
            await supabase.from('profiles').update(patch).or(`id.eq.${userId},auth_user_id.eq.${userId}`);
          } else {
            await supabase.from('profiles').update(patch).eq('id', userId);
          }
        }
      } catch (err) {
        console.error('Failed to promote user role in Supabase:', err);
      }
    }

    if (IS_FIREBASE_ENABLED && db && !IS_SUPABASE_CONFIGURED) {
      try {
        const docRef = doc(db, 'users', userId);
        await setDoc(docRef, sanitizeForFirestore({ role: newRole }), { merge: true });
      } catch (err) {
        console.warn('Firestore role notice:', err);
      }
    }
  };

  const handleConfirmViewer = async (userId: string, userEmail?: string) => {
    const targetUser = users.find(u => u.uid === userId || (userEmail && u.email.toLowerCase().trim() === userEmail.toLowerCase().trim()));
    const userName = targetUser?.displayName || targetUser?.personName || targetUser?.email || 'Uporabnik';
    const emailToAdd = (userEmail || targetUser?.email || '').toLowerCase().trim();

    // 1. Optimistic React state update: immediately dismiss notification
    setConfirmedViewerIds(prev => {
      const updated = Array.from(new Set([...prev, userId, emailToAdd].filter(Boolean)));
      try { localStorage.setItem('church_roster_confirmed_viewers_v2', JSON.stringify(updated)); } catch {}
      return updated;
    });

    setUsers(prev => prev.map(u => (u.uid === userId || (emailToAdd && u.email.toLowerCase().trim() === emailToAdd)) ? { ...u, role: 'Viewer', approval_status: 'viewer_approved' } : u));

    // 2. Show instant toast
    setRoleActionToast({
      message: currentLanguage === 'sl'
        ? `✓ ${userName} je potrjen kot Gledalec (Viewer). Obvestilo je odstranjeno.`
        : `✓ ${userName} confirmed as Viewer. Notification dismissed.`,
      type: 'success'
    });

    // 3. Persist to Supabase profiles safely by email and valid UUID
    if (IS_SUPABASE_CONFIGURED) {
      try {
        const patch = { 
          role: 'Viewer', 
          approval_status: 'viewer_approved',
          updated_at: new Date().toISOString() 
        };
        const isUUID = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

        if (emailToAdd) {
          await supabase.from('profiles').update(patch).ilike('email', emailToAdd);
        }
        if (userId) {
          if (isUUID(userId)) {
            await supabase.from('profiles').update(patch).or(`id.eq.${userId},auth_user_id.eq.${userId}`);
          } else {
            await supabase.from('profiles').update(patch).eq('id', userId);
          }
        }
      } catch (err) {
        console.warn('Supabase confirm viewer notice:', err);
      }
    }
  };

  const handleLinkUserPerson = async (userId: string, personNameOrId: string | undefined) => {
    const targetPerson = (people || []).find(p => p && (p.id === personNameOrId || p.name === personNameOrId || (personNameOrId && isNameMatch(p.name, personNameOrId))));
    const targetUser = (users || []).find(u => u.uid === userId);
    
    // 1. Optimistic React Memory State Update
    setUsers(prev => prev.map(u => {
      if (u.uid === userId) {
        return {
          ...u,
          personName: targetPerson?.name || personNameOrId || undefined,
          role: targetPerson?.role || u.role
        };
      }
      return u;
    }));

    // Auto-dismiss pending notification since user is linked to roster profile
    if (userId && targetPerson) {
      const emailKey = (targetUser?.email || '').toLowerCase().trim();
      setConfirmedViewerIds(prev => {
        const updated = Array.from(new Set([...prev, userId, emailKey].filter(Boolean)));
        try { localStorage.setItem('church_roster_confirmed_viewers_v2', JSON.stringify(updated)); } catch {}
        return updated;
      });
    }

    // Auto-populate person's email with Google email if unwritten or updating
    if (userId && targetPerson) {
      if (targetUser && targetUser.email && (!targetPerson.email || targetPerson.email.trim() === '')) {
        handleUpdatePerson(targetPerson.id, {
          ...targetPerson,
          email: targetUser.email
        });
      }
    }

    // Show instant save toast popup
    setRoleActionToast({
      message: currentLanguage === 'sl'
        ? (targetPerson ? `✓ Povezava shranjena: Račun povezan s profilom "${targetPerson.name}".` : '✓ Povezava profila odstranjena.')
        : (targetPerson ? `✓ Profile link saved: Linked to "${targetPerson.name}".` : '✓ Profile link removed.'),
      type: 'success'
    });

    // 2. Persist to Supabase
    if (IS_SUPABASE_CONFIGURED) {
      linkUserToPerson(userId, targetPerson).catch(console.warn);
      if (authUser && (authUser.uid === userId || authUser.id === userId) && targetPerson?.name) {
        setActivePersonName(targetPerson.name);
      }
    }

    if (IS_FIREBASE_ENABLED && db && !IS_SUPABASE_CONFIGURED) {
      try {
        await linkUserToPerson(userId, targetPerson);
        if (authUser && (authUser.uid === userId || authUser.id === userId) && targetPerson?.name) {
          setActivePersonName(targetPerson.name);
        }
      } catch (err) {
        console.warn('Firestore link notice:', err);
      }
    }
  };

  const handleDeleteUser = async (userId: string, userEmail?: string) => {
    const targetUser = users.find(u => u.uid === userId);
    const identifier = userEmail || targetUser?.email || targetUser?.displayName || userId;

    const confirmMsg = currentLanguage === 'sl'
      ? `Ali ste prepričani, da želite izbrisati ta uporabniški račun / e-pošto (${identifier}) iz sistema?`
      : `Are you sure you want to delete this user account and email (${identifier}) from the system?`;

    if (!window.confirm(confirmMsg)) return;

    // 1. Optimistic React state update
    setUsers(prev => prev.filter(u => u.uid !== userId));

    // 2. Clear email on any linked person if email matches
    if (identifier) {
      setPeople(prev => prev.map(p => {
        if (p && p.email && p.email.toLowerCase() === identifier.toLowerCase()) {
          const { email, ...rest } = p;
          return rest;
        }
        return p;
      }));
    }

    // 3. Supabase deletion
    if (IS_SUPABASE_CONFIGURED) {
      try {
        await supabase.from('profiles').delete().eq('id', userId);
      } catch (err) {
        console.warn('[Supabase] Delete user profile error:', err);
      }
    }

    // 4. Firestore deletion
    if (IS_FIREBASE_ENABLED && db) {
      try {
        await deleteDoc(doc(db, 'users', userId));
      } catch (err) {
        console.error('Failed to delete user document in Firestore:', err);
      }
    }
  };

  const handleAddPerson = async (newPerson: Person) => {
    if (!newPerson || !newPerson.name) return;
    
    // Ensure clean immutable unique ID
    const cleanId = newPerson.id || ('p-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6));
    const personWithId: Person = { ...newPerson, id: cleanId };

    removeDeletedPeopleKeys([personWithId.name, personWithId.id, personWithId.email]);

    // 1. React memory state & localstorage update
    setPeople(prev => {
      const nextPeople = [...(prev || []), personWithId];
      try {
        localStorage.setItem('church_roster_people_v2', JSON.stringify(nextPeople));
      } catch (err) { /* ignore */ }
      return nextPeople;
    });

    // Auto-link to matching registered user accounts by email
    if (personWithId.email) {
      const matchingUser = (users || []).find(u => u && u.email && u.email.toLowerCase().trim() === personWithId.email!.toLowerCase().trim());
      if (matchingUser) {
        handleLinkUserPerson(matchingUser.uid, personWithId.id);
      }
    }

    // Persist to Supabase
    upsertPersonToSupabase(personWithId).catch(console.warn);

    if (IS_FIREBASE_ENABLED && db) {
      try {
        await createPersonRecord(personWithId);
      } catch (error) {
        console.warn('Firestore add person warning:', error);
      }
    }
  };

  const handleDeletePerson = async (personIdOrName: string) => {
    if (!personIdOrName) return;

    // 1. Find exact matching person
    const matched = (people || []).find(p => p && (p.id === personIdOrName || p.name === personIdOrName));
    if (!matched) return;

    const targetId = matched.id;
    const targetName = matched.name;
    const targetEmail = matched.email || '';

    // Build tombstone keys
    const keysToTombstone: string[] = [
      'id:' + targetId.trim().toLowerCase(),
      targetId.trim().toLowerCase(),
      ...(targetEmail ? ['email:' + targetEmail.toLowerCase().trim()] : [])
    ];

    const existingDeleted = getDeletedPeopleKeys();
    saveDeletedPeopleKeys([...existingDeleted, ...keysToTombstone]);

    // 2. Remove ONLY this specific person record from state & LocalStorage
    setPeople(prev => {
      const nextPeople = (prev || []).filter(p => p && p.id !== targetId);
      try {
        localStorage.setItem('church_roster_people_v2', JSON.stringify(nextPeople));
      } catch (err) { /* ignore */ }
      return nextPeople;
    });

    // 3. Automatically unlink any Google accounts linked to this deleted person
    const linkedUsers = (users || []).filter(u => 
      u.personName === targetName || 
      u.personName === targetId || 
      (targetEmail && u.email && u.email.toLowerCase().trim() === targetEmail.toLowerCase().trim())
    );

    for (const u of linkedUsers) {
      handleLinkUserPerson(u.uid, undefined);
    }

    // Persist to Supabase
    deletePersonFromSupabase(targetId).catch(console.warn);

    // 4. Delete document from Firestore
    if (IS_FIREBASE_ENABLED && db) {
      try {
        await deletePersonRecord(targetId);
        if (targetName !== targetId) {
          await deleteDoc(doc(db, 'people', targetName)).catch(() => {});
        }
      } catch (error) {
        console.warn('Firestore delete person warning:', error);
      }
    }
  };

  const handleUpdatePerson = async (personIdOrOldName: string, updatedPerson: Person) => {
    if (!personIdOrOldName || !updatedPerson || !updatedPerson.name) return;

    const targetPersonId = updatedPerson.id || personIdOrOldName;
    const personWithId: Person = { ...updatedPerson, id: targetPersonId };

    // Find previous name to detect renames
    const existing = (people || []).find(p => p && (p.id === targetPersonId || p.name === personIdOrOldName));
    const oldName = existing?.name;

    removeDeletedPeopleKeys([personWithId.name, personWithId.id, personWithId.email]);

    // 1. Update memory state: lookup and replace ONLY the specific matching person record
    setPeople(prev => {
      const currentList = prev || [];
      let matched = false;
      const updatedPeople = currentList.map(p => {
        if (!p) return p;
        if (p.id === targetPersonId || (oldName && p.name === oldName)) {
          matched = true;
          return personWithId;
        }
        return p;
      });

      const finalPeople = matched ? updatedPeople : [...updatedPeople, personWithId];
      try {
        localStorage.setItem('church_roster_people_v2', JSON.stringify(finalPeople));
      } catch (err) { /* ignore */ }
      return finalPeople;
    });

    // 2. If renamed, update memory state for Sunday roster assignments
    if (oldName && oldName !== personWithId.name) {
      setSundays(prevSundays => {
        const updatedSundays = prevSundays.map(sunday => {
          let updated = false;
          const updatedAssignments = { ...sunday.assignments };
          Object.keys(updatedAssignments).forEach(mId => {
            const list = updatedAssignments[mId] || [];
            if (list.includes(oldName)) {
              updatedAssignments[mId] = list.map(n => n === oldName ? personWithId.name : n);
              updated = true;
            }
          });
          return updated ? { ...sunday, assignments: updatedAssignments } : sunday;
        });
        try {
          localStorage.setItem('church_roster_sundays_v2', JSON.stringify(updatedSundays));
        } catch (err) { /* ignore */ }
        return updatedSundays;
      });
    }

    // Persist to Supabase
    await upsertPersonToSupabase(personWithId).catch(console.warn);

    // 3. Persist to Firestore: overwrite /people/{person.id} directly
    if (IS_FIREBASE_ENABLED && db) {
      try {
        await updatePersonRecord(targetPersonId, personWithId);

        if (oldName && oldName !== targetPersonId) {
          await deleteDoc(doc(db, 'people', oldName)).catch(() => {});
        }

        if (oldName && oldName !== personWithId.name) {
          const batch = writeBatch(db);
          sundays.forEach(sunday => {
            let hasOldName = false;
            const newAssignments = { ...sunday.assignments };
            Object.keys(newAssignments).forEach(mId => {
              const list = newAssignments[mId] || [];
              if (list.includes(oldName)) {
                newAssignments[mId] = list.map(n => n === oldName ? personWithId.name : n);
                hasOldName = true;
              }
            });
            if (hasOldName) {
              batch.set(doc(db, 'sundays', sunday.id), sanitizeForFirestore({ ...sunday, assignments: newAssignments }), { merge: true });
            }
          });
          await batch.commit();
        }
      } catch (error) {
        console.warn('Firestore update person warning:', error);
      }
    }
  };

  // --- Interactive Roster Data Mutation Handlers (Dual-Layer Persistent) ---
  const handleUpdateSunday = async (updatedSunday: ServiceSunday) => {
    // 1. Optimistic React State & LocalStorage Update
    setSundays(prev => {
      const nextSundays = prev.map(s => s.id === updatedSunday.id ? updatedSunday : s);
      try {
        localStorage.setItem('church_roster_sundays_v2', JSON.stringify(nextSundays));
      } catch (err) { /* ignore */ }
      return nextSundays;
    });

    // Bi-directional Worship Team ("Slavilna ekipa") sync from /sluzbe to /slavilna
    if (updatedSunday.assignments['slavilna_ekipa'] || updatedSunday.assignments['slavilna']) {
      const updatedWorshipRoster = syncWorshipRosterFromSundayAssignments(updatedSunday, worshipRoster);
      handleUpdateWorshipRoster(updatedWorshipRoster);
    }

    // Bi-directional Sunday School sync from /sluzbe to /sola
    if (updatedSunday.assignments['nedeljska_sola_mlajsa'] || updatedSunday.assignments['nedeljska_sola_starejsa']) {
      setSundaySchoolLessons(prev => syncSundaySchoolLessonsFromSunday(updatedSunday, prev));
    }

    // Persist to Supabase
    upsertSundayToSupabase(updatedSunday).catch(console.warn);

    // 2. Persist to Firestore if available
    if (IS_FIREBASE_ENABLED && db) {
      try {
        await setDoc(doc(db, 'sundays', updatedSunday.id), sanitizeForFirestore(updatedSunday));
      } catch (error) {
        console.warn('Firestore update sunday warning:', error);
      }
    }
  };

  const handleDeleteSunday = async (sundayId: string) => {
    setSundays(prev => {
      const nextSundays = prev.filter(s => s.id !== sundayId);
      try {
        localStorage.setItem('church_roster_sundays_v2', JSON.stringify(nextSundays));
      } catch (err) { /* ignore */ }
      return nextSundays;
    });

    if (selectedSundayId === sundayId) {
      setSelectedSundayId(null);
    }

    if (IS_FIREBASE_ENABLED && db) {
      try {
        await deleteDoc(doc(db, 'sundays', sundayId));
      } catch (error) {
        console.warn('Firestore delete sunday warning:', error);
      }
    }
  };

  // Safe automatic scheduling calculation adding exact 7 days to next service record
  const handleAddSunday = async () => {
    const sorted = [...sundays].sort((a, b) => {
      return parseEuropeanDate(a.date).getTime() - parseEuropeanDate(b.date).getTime();
    });

    let newDateStr = '';
    if (sorted.length > 0) {
      const latestDate = parseEuropeanDate(sorted[sorted.length - 1].date);
      latestDate.setDate(latestDate.getDate() + 7);
      const d = latestDate.getDate();
      const m = latestDate.getMonth() + 1;
      const y = latestDate.getFullYear() % 100;
      newDateStr = `${d}. ${m}. ${y}`;
    } else {
      newDateStr = '6. 9. 26';
    }

    const nextId = `s_${Date.now()}`;
    const newSunday: ServiceSunday = {
      id: nextId,
      date: newDateStr,
      themeSl: 'Novo učenje',
      themeEn: 'New message topic',
      status: 'draft',
      guest: '',
      assignments: {},
      absentOrNotes: ''
    };

    setSundays(prev => {
      const nextSundays = [...prev, newSunday];
      try {
        localStorage.setItem('church_roster_sundays_v2', JSON.stringify(nextSundays));
      } catch (err) { /* ignore */ }
      return nextSundays;
    });

    setSelectedSundayId(nextId);

    // Persist to Supabase
    upsertSundayToSupabase(newSunday).catch(console.warn);

    if (IS_FIREBASE_ENABLED && db) {
      try {
        await setDoc(doc(db, 'sundays', nextId), sanitizeForFirestore(newSunday));
      } catch (error) {
        console.warn('Firestore add sunday warning:', error);
      }
    }
  };

  // Generate & Seed all Sundays for Academic Year 2026/2027 (Aug 30, 2026 -> Aug 29, 2027)
  const handleGenerateAcademicYear = async () => {
    const res = await seedAcademicYearToSupabase(sundays);
    if (res.syncedSundays && res.syncedSundays.length > 0) {
      setSundays(res.syncedSundays);
      try {
        localStorage.setItem('church_roster_sundays_v2', JSON.stringify(res.syncedSundays));
      } catch (e) {}
    }
  };

  // Target object lookup
  const activeSunday = sundays.find(s => s.id === selectedSundayId);

  // --- SPLASH & AUTHENTICATION GATES ---
  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-700">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
        <p className="text-xs font-semibold tracking-wider uppercase font-mono text-slate-500 animate-pulse">
          {currentLanguage === 'sl' ? 'Nalaganje uporabniške seje...' : 'Verifying active session...'}
        </p>
      </div>
    );
  }

  // If user is confirming via token link, let them confirm without login
  if (isConfirmView) {
    return (
      <ConfirmPage
        sundays={sundays}
        ministries={ministries}
        people={people}
        swapRequests={swapRequests}
        onUpdateSunday={handleUpdateSunday}
        onAcceptSwapRequest={handleAcceptSwapRequest}
        onDeclineSwapRequest={handleDeclineSwapRequest}
        onNavigateHome={() => {
          setIsConfirmView(false);
          setActiveTab('home');
          if (typeof window !== 'undefined') {
            window.history.pushState({ tab: 'home' }, '', '/domov');
          }
        }}
      />
    );
  }

  // Active secure sign in check: ALWAYS require login if not authenticated!
  if (!authUser) {
    const loginBgUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_LOGIN_BG_URL) || '/kck-coffee-bar.jpg';

    return (
      <div className="min-h-screen w-full relative flex flex-col justify-between overflow-x-hidden bg-[#150309] select-none">
        {/* Full-Screen Atmospheric Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700"
          style={{ backgroundImage: `url(${loginBgUrl})` }}
        />

        {/* Warm Cinematic Dark Vignette Overlay & Soft Backdrop Blur */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-black/85 backdrop-blur-[2px]" />

        {/* Top Floating Pill Header */}
        <header className="relative z-10 w-full px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5 bg-black/40 hover:bg-black/55 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-white/15 transition shadow-sm">
            <img
              src="/KCK-logo-rdec-sekundaren_small.png"
              alt="KCK"
              className="w-7 h-7 object-contain rounded-full shadow-2xs shrink-0"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold tracking-tight text-white font-display">
                KCK Celje
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#93032E] text-white shadow-2xs">
                {currentLanguage === 'sl' ? 'Planer' : 'Hub'}
              </span>
            </div>
          </div>

          <button
            onClick={() => setCurrentLanguage(prev => prev === 'sl' ? 'en' : 'sl')}
            className="text-xs font-bold font-mono bg-black/40 hover:bg-black/60 text-white px-3 py-1.5 rounded-xl border border-white/15 transition flex items-center gap-1.5 cursor-pointer backdrop-blur-md shadow-sm active:scale-95"
            title={currentLanguage === 'sl' ? 'Preklopi jezik' : 'Switch language'}
          >
            <Globe className="w-3.5 h-3.5 text-amber-300" />
            <span>{currentLanguage === 'sl' ? 'SLO ➔ EN' : 'EN ➔ SLO'}</span>
          </button>
        </header>

        {/* Centered Frosted Glass Login Panel */}
        <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-6 sm:py-10 my-auto">
          <div className="max-w-md w-full bg-white/95 backdrop-blur-xl border border-white/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-slate-900 animate-in fade-in zoom-in-95 duration-200">
            {/* Top Brand Logo & Welcome Headings */}
            <div className="text-center space-y-3">
              {/* Prominent High-Res KCK Logo */}
              <div className="inline-flex items-center justify-center p-3.5 sm:p-4 bg-white rounded-2xl shadow-xs border border-slate-100/90 mx-auto">
                <img
                  src="/KCK-logo-rdec_small.png"
                  alt="Krščanska cerkev Kalvarija Celje"
                  className="h-10 sm:h-12 w-auto object-contain"
                />
              </div>

              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-[#93032E]/10 text-[#93032E]">
                  <span>✦ {currentLanguage === 'sl' ? 'Nedeljske službe & ekipe' : 'Sunday Teams & Ministry'} ✦</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black font-display text-slate-900 tracking-tight">
                  {currentLanguage === 'sl' ? 'Prijava v Planer' : 'Sunday Worship Hub'}
                </h1>
                <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
                  {currentLanguage === 'sl' 
                    ? 'Dobrodošli! Za dostop do nedeljskih razporedov, služb in gradiv se prijavite s svojim računom.' 
                    : 'Welcome! Sign in with your account to view service rosters, duty coverage, and materials.'}
                </p>
              </div>
            </div>

            {/* Error banner if authentication fails */}
            {authEmailError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200/80 rounded-2xl text-xs text-rose-700 flex items-start gap-2.5 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span className="leading-snug font-medium">{authEmailError}</span>
              </div>
            )}

            {/* 1. Primary Google Sign-In */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isSigningInGoogle}
              className="w-full flex items-center justify-center gap-3 bg-slate-950 hover:bg-slate-850 text-white px-4 py-3.5 rounded-2xl font-bold text-sm shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 group"
            >
              {isSigningInGoogle ? (
                <Loader2 className="w-5 h-5 animate-spin text-amber-300" />
              ) : (
                <svg className="w-5 h-5 shrink-0 group-hover:scale-105 transition-transform" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              )}
              <span>
                {isSigningInGoogle
                  ? (currentLanguage === 'sl' ? 'Povezovanje z Google...' : 'Connecting with Google...')
                  : (currentLanguage === 'sl' ? 'Nadaljuj z Google računom' : 'Continue with Google')}
              </span>
            </button>

            {/* 2. Collapsible Dropdown Bar with arrow for Email Sign In */}
            <div className="pt-2 border-t border-slate-200/80">
              <button
                type="button"
                onClick={() => setShowEmailForm(prev => !prev)}
                className="w-full flex items-center justify-between py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer select-none"
              >
                <span>
                  {currentLanguage === 'sl'
                    ? 'Ali pa se prijavi z e-pošto in geslom'
                    : 'Or sign in with email and password'}
                </span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 text-slate-400 ${
                    showEmailForm ? 'rotate-180 text-[#93032E]' : ''
                  }`}
                />
              </button>

              {showEmailForm && (
                <form
                  onSubmit={handleEmailLogin}
                  className="mt-2.5 p-4 bg-slate-50/90 rounded-2xl border border-slate-200/90 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150"
                >
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      {currentLanguage === 'sl' ? 'E-poštni naslov' : 'Email Address'}
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="vasa.eposta@domena.si"
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#93032E] focus:outline-none bg-white text-slate-900 placeholder:text-slate-400 shadow-2xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      {currentLanguage === 'sl' ? 'Geslo' : 'Password'}
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="password"
                        required
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#93032E] focus:outline-none bg-white text-slate-900 placeholder:text-slate-400 shadow-2xs"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isEmailSubmitting}
                    className="w-full py-2.5 rounded-xl bg-[#93032E] hover:bg-[#7a0225] text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    {isEmailSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <LogIn className="w-4 h-4" />
                    )}
                    <span>
                      {isEmailSubmitting
                        ? (currentLanguage === 'sl' ? 'Preverjanje...' : 'Verifying...')
                        : (currentLanguage === 'sl' ? 'Prijava z e-pošto' : 'Sign In with Email')}
                    </span>
                  </button>

                  <div className="pt-1.5 text-center border-t border-slate-200/60">
                    <button
                      type="button"
                      onClick={handleMagicLinkSignIn}
                      disabled={isSendingMagicLink || !emailInput}
                      className="text-[11px] text-slate-500 hover:text-[#93032E] underline cursor-pointer disabled:opacity-50 disabled:no-underline transition-colors"
                    >
                      {isSendingMagicLink
                        ? (currentLanguage === 'sl' ? 'Pošiljanje povezave...' : 'Sending link...')
                        : (currentLanguage === 'sl' ? 'Nimate gesla? Pošlji povezavo za prijavo na e-pošto' : "Don't have a password? Send login link to email")}
                    </button>
                    {magicLinkSent && (
                      <p className="text-[11px] text-emerald-600 font-medium mt-1 animate-in fade-in">
                        {currentLanguage === 'sl' ? '✓ Povezava za prijavo poslana na vaš e-poštni naslov!' : '✓ Login link sent to your email address!'}
                      </p>
                    )}
                  </div>
                </form>
              )}
            </div>

            {/* Security footnote */}
            <div className="pt-1 text-[11px] text-slate-400 text-center font-medium">
              {currentLanguage === 'sl'
                ? 'Varno overjanje • Povezano z zbirko podatkov KCK Supabase'
                : 'Secure authentication • Linked to KCK Supabase database'}
            </div>
          </div>
        </main>

        {/* Bottom footer credit */}
        <footer className="relative z-10 py-4 px-6 text-center text-xs text-white/70 tracking-wide font-medium">
          <span>Krščanska cerkev Kalvarija Celje • nedelje.kalvarija.si</span>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF7F5] font-sans selection:bg-[#93032E] selection:text-white pb-20 max-w-full overflow-x-hidden">
      
      {/* Universal 2-Tier Ecosystem Navbar */}
      <EcosystemNavbar
        currentApp="nedelje"
        user={authUser ? {
          name: isAlesLoggedIn 
            ? 'Aleš Lajlar' 
            : ((activePerson && !activePerson.name.toLowerCase().includes('aleš lajlar') ? activePerson.name : null) || (userDbProfile?.personName && !userDbProfile.personName.toLowerCase().includes('aleš lajlar') ? userDbProfile.personName : null) || userDbProfile?.displayName || authUser.user_metadata?.full_name || authUser.user_metadata?.name || (authUser.email ? authUser.email.split('@')[0].split('.').map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') : 'Uporabnik')),
          email: authUser.email || '',
          role: isAlesLoggedIn ? (testRoleOverride || 'Superadmin') : activeRole,
        } : null}
        testRole={isGenuineAdmin ? testRoleOverride : null}
        onTestRoleChange={isGenuineAdmin ? handleSetTestRole : undefined}
        onLogin={handleGoogleLogin}
        onLogout={handleSignOut}
        currentLang={currentLanguage}
        onLanguageChange={(l) => setCurrentLanguage(l)}
        extraNavItems={
          <>
            <button
              onClick={() => handleNavTab('home')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold font-['Nohemi',sans-serif] flex items-center gap-1.5 transition-all cursor-pointer select-none whitespace-nowrap ${
                activeTab === 'home'
                  ? 'bg-[#93032E] text-white shadow-xs'
                  : 'text-slate-700 hover:text-[#93032E] hover:bg-slate-100/80'
              }`}
              title={currentLanguage === 'sl' ? 'Domov' : 'Home'}
            >
              <Home className="w-3.5 h-3.5" />
              <span>{currentLanguage === 'sl' ? 'Domov' : 'Home'}</span>
            </button>

            <button
              onClick={() => handleNavTab('sundays')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold font-['Nohemi',sans-serif] flex items-center gap-1.5 transition-all cursor-pointer select-none whitespace-nowrap ${
                activeTab === 'sundays'
                  ? 'bg-[#93032E] text-white shadow-xs'
                  : 'text-slate-700 hover:text-[#93032E] hover:bg-slate-100/80'
              }`}
              title={currentLanguage === 'sl' ? 'Razpored' : 'Schedule'}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{currentLanguage === 'sl' ? 'Razpored' : 'Schedule'}</span>
            </button>

            <button
              onClick={() => handleNavTab('sunday_school')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold font-['Nohemi',sans-serif] flex items-center gap-1.5 transition-all cursor-pointer select-none whitespace-nowrap ${
                activeTab === 'sunday_school'
                  ? 'bg-[#93032E] text-white shadow-xs'
                  : 'text-slate-700 hover:text-[#93032E] hover:bg-slate-100/80'
              }`}
              title={currentLanguage === 'sl' ? 'Šola' : 'Kids'}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>{currentLanguage === 'sl' ? 'Šola' : 'Kids'}</span>
            </button>

            <button
              onClick={() => handleNavTab('worship')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold font-['Nohemi',sans-serif] flex items-center gap-1.5 transition-all cursor-pointer select-none whitespace-nowrap ${
                activeTab === 'worship'
                  ? 'bg-[#93032E] text-white shadow-xs'
                  : 'text-slate-700 hover:text-[#93032E] hover:bg-slate-100/80'
              }`}
              title={currentLanguage === 'sl' ? 'Slavilna' : 'Music'}
            >
              <Music className="w-3.5 h-3.5" />
              <span>{currentLanguage === 'sl' ? 'Slavilna' : 'Music'}</span>
            </button>

            <button
              onClick={() => handleNavTab('ministries')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold font-['Nohemi',sans-serif] flex items-center gap-1.5 transition-all cursor-pointer select-none whitespace-nowrap ${
                activeTab === 'ministries'
                  ? 'bg-[#93032E] text-white shadow-xs'
                  : 'text-slate-700 hover:text-[#93032E] hover:bg-slate-100/80'
              }`}
              title={currentLanguage === 'sl' ? 'Službe' : 'Teams'}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{currentLanguage === 'sl' ? 'Službe' : 'Teams'}</span>
            </button>

            <button
              onClick={() => handleNavTab('people')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold font-['Nohemi',sans-serif] flex items-center gap-1.5 transition-all cursor-pointer select-none whitespace-nowrap ${
                activeTab === 'people'
                  ? 'bg-[#93032E] text-white shadow-xs'
                  : 'text-slate-700 hover:text-[#93032E] hover:bg-slate-100/80'
              }`}
              title={currentLanguage === 'sl' ? 'Ekipa' : 'People'}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{currentLanguage === 'sl' ? 'Ekipa' : 'People'}</span>
            </button>
          </>
        }
        rightActionItems={
          activeRole !== 'Viewer' ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsNotificationModalOpen(true)}
                className="relative p-2 bg-slate-100 hover:bg-slate-200 text-[#93032E] rounded-xl transition cursor-pointer flex items-center justify-center shrink-0"
                title={currentLanguage === 'sl' ? 'Opomniki in obvestila' : 'Notifications & Reminders'}
              >
                <Bell className="w-4 h-4" />
                {activeUpcomingDutiesCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#93032E] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse shadow-xs">
                    {activeUpcomingDutiesCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setIsSwapModalOpen(true)}
                className="relative p-2 bg-slate-100 hover:bg-slate-200 text-[#034C3C] rounded-xl transition cursor-pointer flex items-center justify-center shrink-0"
                title={currentLanguage === 'sl' ? 'Oglasna deska za zamenjave' : 'Shift Swap Board'}
              >
                <ArrowRightLeft className="w-4 h-4" />
                {swapRequests.filter(r => r.status === 'open').length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#034C3C] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                    {swapRequests.filter(r => r.status === 'open').length}
                  </span>
                )}
              </button>
            </div>
          ) : null
        }
      />

      {/* Roster Alert Info (Visible for viewers across the app) */}
      {!isAlesLoggedIn && activeRole === 'Viewer' && (
        <div className="bg-amber-500/10 border-b border-amber-500/10 py-1.5 px-4 text-center">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-1 text-[11px] font-medium text-amber-800">
            <span className="shrink-0">⚠️</span>
            <span>
              {currentLanguage === 'sl' 
                ? 'Prikaz za gledalce: osebni podatki in urejanje služb so omejeni. Za sodelovanje kontaktirajte administratorja.' 
                : 'Viewer mode: Personal contact details and schedule editing are restricted. Contact an administrator for team access.'}
            </span>
          </div>
        </div>
      )}

      {/* Main Container Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-32">
        {activeSunday ? (
          <SundayDetail
            key={activeSunday.id}
            sunday={activeSunday}
            initialMinistryId={targetMinistryId}
            initialCategory={targetCategory}
            allSundays={sundays}
            ministries={ministries}
            people={people}
            userRole={activeRole}
            activePerson={activePerson}
            translations={translations}
            currentLanguage={currentLanguage}
            worshipRoster={worshipRoster}
            sundaySchoolLessons={sundaySchoolLessons}
            blackoutDates={blackoutDates}
            onBack={() => {
              setSelectedSundayId(null);
              setTargetMinistryId(null);
              setTargetCategory(null);
              setActiveTab('sundays');
              window.history.pushState(null, '', '/razpored');
            }}
            onSelectSunday={(id) => handleSelectSunday(id)}
            onUpdateSunday={handleUpdateSunday}
            onUpdatePerson={handleUpdatePerson}
            googleToken={googleToken}
            onSetGoogleToken={handleSetGoogleToken}
            onOpenVisitorModal={() => setIsVisitorModalOpen(true)}
            onOpenInspectionModal={handleOpenInspectionModal}
            authUser={authUser}
          />
        ) : (
          <div className="animate-fade-in">
            {visitedTabs.has('home') && (
              <div className={activeTab === 'home' ? 'block animate-fade-in' : 'hidden'}>
                <HomeDashboard
                  sundays={sundays}
                  ministries={ministries}
                  people={people}
                  activePerson={activePerson}
                  userRole={activeRole}
                  translations={translations}
                  currentLanguage={currentLanguage}
                  onSelectSunday={(id, mId, catId) => handleSelectSunday(id, mId, catId)}
                  onAddSunday={handleAddSunday}
                  onUpdateSunday={handleUpdateSunday}
                  onOpenVisitorModal={() => setIsVisitorModalOpen(true)}
                  onOpenSwapModal={() => setIsSwapModalOpen(true)}
                  onOpenCheckInModal={() => setIsAttendanceModalOpen(true)}
                  onOpenBlackoutModal={() => setIsBlackoutModalOpen(true)}
                  onOpenInspectionModal={handleOpenInspectionModal}
                  onOpenNotificationModal={() => setIsNotificationModalOpen(true)}
                  onOpenRundownModal={handleOpenRundownModal}
                  visitors={visitorConnections}
                  blackoutDates={blackoutDates}
                />
              </div>
            )}

            {visitedTabs.has('sundays') && (
              <div className={activeTab === 'sundays' ? 'block animate-fade-in' : 'hidden'}>
                <ScheduleView
                  sundays={sundays}
                  ministries={ministries}
                  userRole={activeRole}
                  translations={translations}
                  currentLanguage={currentLanguage}
                  onSelectSunday={(id, mId, catId) => handleSelectSunday(id, mId, catId)}
                  onDeleteSunday={handleDeleteSunday}
                  onGenerateAcademicYear={handleGenerateAcademicYear}
                  onOpenStatistics={() => handleNavTab('statistics')}
                />
              </div>
            )}

            {visitedTabs.has('statistics') && (
              <div className={activeTab === 'statistics' ? 'block animate-fade-in' : 'hidden'}>
                <Statistika
                  sundays={sundays}
                  ministries={ministries}
                  people={people}
                  currentLanguage={currentLanguage}
                  translations={translations}
                  onBack={() => handleNavTab('sundays')}
                  onSelectSunday={(id) => {
                    handleSelectSunday(id);
                    handleNavTab('sundays');
                  }}
                />
              </div>
            )}

            {visitedTabs.has('sunday_school') && (
              <div className={activeTab === 'sunday_school' ? 'block animate-fade-in' : 'hidden'}>
                <SundaySchoolView
                  sundays={sundays}
                  people={people}
                  userRole={activeRole}
                  lessons={sundaySchoolLessons}
                  supplies={sundaySchoolSupplies}
                  onUpdateLessons={handleUpdateSundaySchoolLessons}
                  onUpdateSupplies={setSundaySchoolSupplies}
                  translations={translations}
                  currentLanguage={currentLanguage}
                  canEdit={activeRole !== 'Viewer'}
                  onSelectSunday={(id) => handleSelectSunday(id, 'nedeljska_sola_mlajsa', 'kids')}
                  onUpdateSunday={handleUpdateSunday}
                  onGenerateAcademicYear={handleGenerateAcademicYear}
                  blackoutDates={blackoutDates}
                  ministries={ministries}
                />
              </div>
            )}

            {visitedTabs.has('worship') && (
              <div className={activeTab === 'worship' ? 'block animate-fade-in' : 'hidden'}>
                <WorshipTeamView
                  sundays={sundays}
                  people={people}
                  userRole={activeRole}
                  translations={translations}
                  currentLanguage={currentLanguage}
                  worshipRoster={worshipRoster}
                  onUpdateWorshipRoster={handleUpdateWorshipRoster}
                  onUpdateSunday={handleUpdateSunday}
                  onSelectSunday={(id) => handleSelectSunday(id, 'slavilna_ekipa', 'worship')}
                  blackoutDates={blackoutDates}
                  ministries={ministries}
                />
              </div>
            )}

            {visitedTabs.has('ministries') && (
              <div className={activeTab === 'ministries' ? 'block animate-fade-in' : 'hidden'}>
                <MinistryView
                  sundays={sundays}
                  ministries={ministries}
                  people={people}
                  userRole={activeRole}
                  translations={translations}
                  currentLanguage={currentLanguage}
                  worshipRoster={worshipRoster}
                  sundaySchoolLessons={sundaySchoolLessons}
                  onSelectSunday={(id, mId, catId) => handleSelectSunday(id, mId, catId)}
                  onOpenInspectionModal={handleOpenInspectionModal}
                />
              </div>
            )}

            {visitedTabs.has('people') && (
              <div className={activeTab === 'people' ? 'block animate-fade-in' : 'hidden'}>
                <PeopleView
                  key={`people-view-${activeRole}`}
                  sundays={sundays}
                  ministries={ministries}
                  people={people}
                  users={users}
                  userRole={activeRole}
                  activePerson={activePerson}
                  authUser={authUser}
                  translations={translations}
                  currentLanguage={currentLanguage}
                  onAddPerson={handleAddPerson}
                  onDeletePerson={handleDeletePerson}
                  onUpdatePerson={handleUpdatePerson}
                  onLinkUserPerson={handleLinkUserPerson}
                  onUpdateUserRole={handleUpdateUserRole}
                  onDeleteUser={handleDeleteUser}
                  onOpenNotificationModal={() => setIsNotificationModalOpen(true)}
                  googleToken={googleToken}
                  onSetGoogleToken={handleSetGoogleToken}
                  confirmedViewerIds={confirmedViewerIds}
                  onConfirmViewer={handleConfirmViewer}
                />

                {/* Extra Admin Controls Block (Collapsible) */}
                {activeRole === 'Admin' && users.length > 0 && (
                  <div className="px-2 sm:px-4 pb-12 max-w-6xl mx-auto w-full space-y-4">
                {/* Save confirmation toast inside section */}
                {roleActionToast && (
                  <div className="bg-emerald-600 text-white p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-md border border-emerald-500 animate-fade-in">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
                      <span className="truncate">{roleActionToast.message}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRoleActionToast(null)}
                      className="text-emerald-200 hover:text-white font-bold text-base shrink-0 ml-2 cursor-pointer p-1"
                    >
                      &times;
                    </button>
                  </div>
                )}

                <div className="border-t border-gray-200/80 my-6 pt-6">
                  {(() => {
                    const unlinkedCount = users.filter(u => {
                      const isConfirmed = confirmedViewerIds.includes(u.uid) || (u.email && confirmedViewerIds.includes(u.email.toLowerCase().trim())) || u.approval_status === 'viewer_approved';
                      if (isConfirmed) return false;
                      return !people.some(p => p && (
                        p.name === u.personName || 
                        p.id === u.personName || 
                        (p.email && u.email && p.email.toLowerCase().trim() === u.email.toLowerCase().trim()) ||
                        ((p as any).auth_user_id && (p as any).auth_user_id === u.uid)
                      ));
                    }).length;
                    const unconfirmedViewerCount = users.filter(u => {
                      const isConfirmed = confirmedViewerIds.includes(u.uid) || (u.email && confirmedViewerIds.includes(u.email.toLowerCase().trim())) || u.approval_status === 'viewer_approved';
                      return u.role === 'Viewer' && !isConfirmed;
                    }).length;

                    return (
                      <button
                        type="button"
                        onClick={() => setShowManageUserRoles(!showManageUserRoles)}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl transition cursor-pointer font-sans border shadow-xs ${
                          (unlinkedCount > 0 || unconfirmedViewerCount > 0)
                            ? 'bg-amber-50 hover:bg-amber-100/90 border-amber-300' 
                            : 'bg-white hover:bg-slate-50 border-slate-200/90'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                          <div className={`p-2 rounded-xl shrink-0 ${(unlinkedCount > 0 || unconfirmedViewerCount > 0) ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                            <ShieldAlert className="w-5 h-5" />
                          </div>
                          <span className="font-display font-bold text-sm uppercase tracking-wider text-slate-800 font-mono">
                            {currentLanguage === 'sl' ? 'Upravljanje Vlog & Dostopov Planerja' : 'Manage User Roles & Access'}
                          </span>
                          <span className="text-xs bg-indigo-100 text-indigo-800 font-mono font-bold px-2.5 py-0.5 rounded-full border border-indigo-200 shrink-0">
                            {users.length} {currentLanguage === 'sl' ? 'uporabnikov' : 'users'}
                          </span>
                          {unlinkedCount > 0 && (
                            <span className="text-xs bg-amber-500 text-white font-mono font-bold px-2.5 py-0.5 rounded-full shrink-0 shadow-2xs">
                              ⚠️ {unlinkedCount} {currentLanguage === 'sl' ? 'nepovezanih' : 'unlinked'}
                            </span>
                          )}
                          {unconfirmedViewerCount > 0 ? (
                            <span className="text-xs bg-amber-600 text-white font-mono font-bold px-2.5 py-0.5 rounded-full shrink-0 shadow-2xs">
                              👁️ {unconfirmedViewerCount} {currentLanguage === 'sl' ? 'čaka na vlogo' : 'pending review'}
                            </span>
                          ) : (
                            <span className="text-xs bg-slate-100 text-slate-700 border border-slate-300 font-mono font-bold px-2.5 py-0.5 rounded-full shrink-0">
                              👁️ {users.filter(u => u.role === 'Viewer').length} {currentLanguage === 'sl' ? 'gledalcev' : 'viewers'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 shrink-0 pl-2">
                          <span>{showManageUserRoles ? (currentLanguage === 'sl' ? 'Skrij seznam' : 'Hide list') : (currentLanguage === 'sl' ? 'Prikaži seznam' : 'Show list')}</span>
                          {showManageUserRoles ? <ChevronUp className="w-4 h-4 text-indigo-600" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        </div>
                      </button>
                    );
                  })()}
                </div>

                {showManageUserRoles && (
                  <div className="space-y-4 animate-fade-in bg-slate-50/90 p-4 sm:p-6 rounded-3xl border border-slate-200/90 shadow-sm">
                    <div className="flex items-center justify-between text-xs text-slate-600 leading-relaxed font-sans bg-white/80 p-3.5 px-4 rounded-2xl border border-slate-200">
                      <p>
                        {currentLanguage === 'sl' 
                          ? 'Kot administrator lahko spremenite vloge registriranih Google računov ter jih povežete s profili v bazi sodelavcev. Vse spremembe se takoj samodejno shranijo.' 
                          : 'As an Administrator, manage registered Google account permissions and link accounts to roster volunteer profiles. All changes auto-save instantly.'}
                      </p>
                    </div>

                    <div className="space-y-3">
                      {users.map((u) => {
                        const linkedPerson = people.find(p => p && (
                          p.name === u.personName || 
                          p.id === u.personName || 
                          (p.email && u.email && p.email.toLowerCase().trim() === u.email.toLowerCase().trim()) ||
                          ((p as any).auth_user_id && (p as any).auth_user_id === u.uid)
                        ));
                        const currentLinkVal = linkedPerson ? linkedPerson.name : (u.personName || '');
                        const isConfirmedViewer = confirmedViewerIds.includes(u.uid) || (u.email && confirmedViewerIds.includes(u.email.toLowerCase().trim())) || u.approval_status === 'viewer_approved';
                        const isUnlinked = !linkedPerson && !isConfirmedViewer;

                        return (
                          <div key={u.uid} className={`rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition shadow-xs ${
                            isUnlinked 
                              ? 'border-2 border-amber-500/80 bg-amber-50/90 shadow-sm ring-2 ring-amber-400/20' 
                              : 'bg-white border border-slate-200 hover:border-slate-300'
                          }`}>
                            {/* Left Column: User details */}
                            <div className="space-y-1.5 min-w-0 flex-1">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="text-sm font-bold text-slate-900 leading-snug">
                                  {u.displayName || 'Google User'}
                                </span>
                                {isConfirmedViewer ? (
                                  <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                    <span>👁️</span>
                                    <span>{currentLanguage === 'sl' ? 'Potrjen Gledalec (brez pravic)' : 'Confirmed Viewer'}</span>
                                  </span>
                                ) : isUnlinked ? (
                                  <span className="text-[10px] font-mono font-bold bg-amber-600 text-white px-2.5 py-0.5 rounded-full shadow-2xs flex items-center gap-1">
                                    <span>⚠️</span>
                                    <span>{currentLanguage === 'sl' ? 'NI POVEZAN S PROFILOM' : 'NOT LINKED TO ROSTER'}</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-mono font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <span>✓</span>
                                    <span>{currentLanguage === 'sl' ? 'Povezan račun' : 'Linked account'}</span>
                                  </span>
                                )}
                              </div>

                              <div className="text-xs text-slate-500 font-mono break-all select-all">
                                ✉️ {u.email}
                              </div>

                              {linkedPerson ? (
                                <div className="text-xs text-indigo-700 font-semibold flex items-center gap-1.5 pt-0.5">
                                  <span>👤 {currentLanguage === 'sl' ? 'Profil v bazi sodelavcev:' : 'Roster profile:'}</span>
                                  <span className="font-bold underline decoration-indigo-300 underline-offset-2">{linkedPerson.name}</span>
                                </div>
                              ) : (
                                <div className="text-xs text-amber-900 font-semibold flex items-center gap-1.5 pt-0.5">
                                  <span>🔔 {currentLanguage === 'sl' ? 'Izberite profil sodelavca za povezavo:' : 'Choose a volunteer profile to link:'}</span>
                                </div>
                              )}
                            </div>

                            {/* Right Column: Linking, Role Selector, Delete */}
                            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200/60">
                              {/* Option to link this account to a Person in people database */}
                              <select
                                value={currentLinkVal}
                                onChange={(e) => handleLinkUserPerson(u.uid, e.target.value || undefined)}
                                className={`text-xs border py-2.5 px-3 rounded-xl focus:outline-none font-medium cursor-pointer transition w-full sm:w-auto min-w-[220px] lg:min-w-[240px] shadow-2xs ${
                                  isUnlinked 
                                    ? 'bg-amber-100 border-2 border-amber-500 text-amber-950 font-bold focus:ring-2 focus:ring-amber-500' 
                                    : 'bg-slate-50 hover:bg-white border-slate-300 text-slate-800 focus:ring-2 focus:ring-indigo-500'
                                }`}
                                title={currentLanguage === 'sl' ? 'Poveži z imenom v bazi sodelavcev' : 'Link to volunteer in database'}
                              >
                                <option value="">{currentLanguage === 'sl' ? '⚠️ -- Poveži sodelavca --' : '⚠️ -- Link volunteer --'}</option>
                                {people
                                  .filter(p => p && p.name)
                                  .map(p => (
                                    <option key={p.id || p.name} value={p.name}>
                                      👤 {p.name} {p.role ? `(${p.role})` : ''}
                                    </option>
                                  ))
                                }
                              </select>

                              {/* Role selection - Auto saves immediately with popup feedback */}
                              <select
                                value={u.role}
                                onChange={(e) => handleUpdateUserRole(u.uid, e.target.value as UserRole)}
                                className="text-xs bg-slate-50 hover:bg-white border border-slate-300 py-2.5 px-3 rounded-xl focus:outline-none font-bold cursor-pointer text-slate-800 transition focus:ring-2 focus:ring-indigo-500 shadow-2xs w-full sm:w-auto min-w-[130px]"
                                title={currentLanguage === 'sl' ? 'Spremeni vlogo (samodejno shranjeno)' : 'Change role (automatically saved)'}
                              >
                                <option value="Admin">🛠️ Admin</option>
                                <option value="Leader">📋 Vodja</option>
                                <option value="Servant">👤 Služabnik</option>
                                <option value="Viewer">👁️ Viewer</option>
                              </select>

                              {/* Quick Confirm button for viewers */}
                              {u.role === 'Viewer' && !isConfirmedViewer && (
                                <button
                                  type="button"
                                  onClick={() => handleConfirmViewer(u.uid, u.email)}
                                  className="px-3 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer shrink-0 shadow-2xs flex items-center gap-1"
                                  title={currentLanguage === 'sl' ? 'Potrdi kot Gledalec (odstrani obvestila)' : 'Confirm as Viewer'}
                                >
                                  <span>👁️ {currentLanguage === 'sl' ? 'Potrdi' : 'Confirm'}</span>
                                </button>
                              )}

                              {/* Erase / Delete User Button */}
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u.uid, u.email)}
                                className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-800 border border-rose-200 rounded-xl transition active:scale-95 cursor-pointer shrink-0 shadow-2xs"
                                title={currentLanguage === 'sl' ? 'Izbriši uporabniški račun in e-pošto' : 'Delete user account and erase email'}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Mobile Native Bottom Navigation - Hidden on Desktop */}
      <nav id="bottom-navigation-bar" className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-[#A6A15E]/20 py-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg z-30 animate-fade-in w-full">
        <div className="mx-auto w-full max-w-lg grid grid-cols-6 px-1 gap-0.5">
          
          <button
            onClick={() => handleNavTab('home')}
            id="nav-tab-home"
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-lg transition-all duration-200 focus:outline-none min-w-0 ${
              activeTab === 'home' && !activeSunday
                ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/80 shadow-xs' 
                : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/50 hover:shadow-[0_0_10px_rgba(79,70,229,0.2)]'
            }`}
          >
            <Home className="w-4 h-4 shrink-0 text-indigo-600" />
            <span className="text-[8px] sm:text-[9px] uppercase tracking-tight font-bold mt-0.5 truncate max-w-full text-center">
              {currentLanguage === 'sl' ? 'DOMOV' : 'HOME'}
            </span>
          </button>

          <button
            onClick={() => handleNavTab('sundays')}
            id="nav-tab-sundays"
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-lg transition-all duration-200 focus:outline-none min-w-0 ${
              activeTab === 'sundays' || activeSunday
                ? 'bg-sky-50 text-sky-700 font-bold border border-sky-200/80 shadow-xs' 
                : 'text-slate-500 hover:text-sky-600 hover:bg-sky-50/50 hover:shadow-[0_0_10px_rgba(2,132,199,0.2)]'
            }`}
          >
            <Calendar className="w-4 h-4 shrink-0 text-sky-600" />
            <span className="text-[8px] sm:text-[9px] uppercase tracking-tight font-bold mt-0.5 truncate max-w-full text-center">
              {currentLanguage === 'sl' ? 'RAZPORED' : 'ROSTER'}
            </span>
          </button>

          <button
            onClick={() => handleNavTab('sunday_school')}
            id="nav-tab-sunday-school"
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-lg transition-all duration-200 focus:outline-none min-w-0 ${
              activeTab === 'sunday_school' && !activeSunday
                ? 'bg-amber-100 text-amber-950 font-bold border border-amber-300/80 shadow-xs' 
                : 'text-slate-500 hover:text-amber-700 hover:bg-amber-50/50 hover:shadow-[0_0_10px_rgba(217,119,6,0.2)]'
            }`}
          >
            <GraduationCap className="w-4 h-4 shrink-0 text-amber-600" />
            <span className="text-[8px] sm:text-[9px] uppercase tracking-tight font-bold mt-0.5 truncate max-w-full text-center">
              {currentLanguage === 'sl' ? 'ŠOLA' : 'KIDS'}
            </span>
          </button>

          <button
            onClick={() => handleNavTab('worship')}
            id="nav-tab-worship"
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-lg transition-all duration-200 focus:outline-none min-w-0 ${
              activeTab === 'worship' && !activeSunday
                ? 'bg-purple-50 text-purple-700 font-bold border border-purple-200/80 shadow-xs' 
                : 'text-slate-500 hover:text-purple-600 hover:bg-purple-50/50 hover:shadow-[0_0_10px_rgba(147,51,234,0.2)]'
            }`}
          >
            <Music className="w-4 h-4 shrink-0 text-purple-600" />
            <span className="text-[8px] sm:text-[9px] uppercase tracking-tight font-bold mt-0.5 truncate max-w-full text-center">
              {currentLanguage === 'sl' ? 'SLAVILNA' : 'MUSIC'}
            </span>
          </button>

          <button
            onClick={() => handleNavTab('ministries')}
            id="nav-tab-ministries"
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-lg transition-all duration-200 focus:outline-none min-w-0 ${
              activeTab === 'ministries' && !activeSunday
                ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200/80 shadow-xs' 
                : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50/50 hover:shadow-[0_0_10px_rgba(5,150,105,0.2)]'
            }`}
          >
            <Layers className="w-4 h-4 shrink-0 text-emerald-600" />
            <span className="text-[8px] sm:text-[9px] uppercase tracking-tight font-bold mt-0.5 truncate max-w-full text-center">
              {currentLanguage === 'sl' ? 'SLUŽBE' : 'TEAMS'}
            </span>
          </button>

          <button
            onClick={() => handleNavTab('people')}
            id="nav-tab-people"
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-lg transition-all duration-200 focus:outline-none min-w-0 ${
              activeTab === 'people' && !activeSunday
                ? 'bg-rose-50 text-rose-700 font-bold border border-rose-200/80 shadow-xs' 
                : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50/50 hover:shadow-[0_0_10px_rgba(225,29,72,0.2)]'
            }`}
          >
            <Users className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="text-[8px] sm:text-[9px] uppercase tracking-tight font-bold mt-0.5 truncate max-w-full text-center">
              {currentLanguage === 'sl' ? 'EKIPA' : 'PEOPLE'}
            </span>
          </button>
        </div>
      </nav>

      {/* Global Notification & Gentle Reminder Hub Modal */}
      <NotificationHubModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        sundays={sundays}
        ministries={ministries}
        people={people}
        activePerson={activePerson}
        currentLanguage={currentLanguage}
        onUpdateSunday={handleUpdateSunday}
        onUpdatePersonNotificationSettings={handleUpdatePersonNotificationSettings}
        googleToken={googleToken}
        onSetGoogleToken={setGoogleToken}
        swapRequests={swapRequests}
        onCreateSwapRequest={handleCreateSwapRequest}
        onCancelSwapRequest={handleCancelSwapRequest}
        userRole={activeRole}
      />

      {/* Peer-to-Peer Shift Swap Board Modal */}
      <SwapBoardModal
        isOpen={isSwapModalOpen}
        onClose={() => setIsSwapModalOpen(false)}
        swapRequests={swapRequests}
        sundays={sundays}
        ministries={ministries}
        people={people}
        activePerson={activePerson}
        currentLanguage={currentLanguage}
        onCreateSwapRequest={handleCreateSwapRequest}
        onAcceptSwapRequest={handleAcceptSwapRequest}
        onDeclineSwapRequest={handleDeclineSwapRequest}
        onConvertToOpenSwapRequest={handleConvertToOpenSwapRequest}
        onCancelSwapRequest={handleCancelSwapRequest}
        blackoutDates={blackoutDates}
        userRole={activeRole}
      />

      {/* Blackout Dates & Vacation Planner Modal */}
      <BlackoutPlannerModal
        isOpen={isBlackoutModalOpen}
        onClose={() => setIsBlackoutModalOpen(false)}
        blackoutDates={blackoutDates}
        people={people}
        activePerson={activePerson}
        currentLanguage={currentLanguage}
        onAddBlackoutDate={handleAddBlackoutDate}
        onDeleteBlackoutDate={handleDeleteBlackoutDate}
      />

      {/* Live Sunday Attendance Check-in Modal */}
      <AttendanceCheckInModal
        isOpen={isAttendanceModalOpen}
        onClose={() => setIsAttendanceModalOpen(false)}
        sunday={sundays.find(s => s.id === selectedSundayId) || sundays[0]}
        allSundays={sundays}
        ministries={ministries}
        people={people}
        currentLanguage={currentLanguage}
        onUpdateSunday={handleUpdateSunday}
        onSelectSundayId={(id) => setSelectedSundayId(id)}
      />

      {/* Visitor & Living Faith Coffee Shop Tracker Modal */}
      <VisitorTrackerModal
        isOpen={isVisitorModalOpen}
        onClose={() => setIsVisitorModalOpen(false)}
        visitors={visitorConnections}
        sundays={sundays}
        people={people}
        onUpdateVisitors={setVisitorConnections}
        selectedSundayId={selectedSundayId}
        canEdit={activeRole !== 'Viewer'}
        currentLanguage={currentLanguage}
        onOpenInspectionModal={() => handleOpenInspectionModal('coffee_upper_hall')}
      />

      {/* Equipment & Upper Hall Setup Inspection Checklist Modal */}
      <InspectionChecklistModal
        isOpen={isInspectionModalOpen}
        onClose={() => setIsInspectionModalOpen(false)}
        initialCategory={inspectionCategory}
        currentLanguage={currentLanguage}
      />

      {/* Service Rundown & Worship Songbook Modal */}
      <ServiceRundownModal
        isOpen={isRundownModalOpen}
        onClose={() => setIsRundownModalOpen(false)}
        sunday={sundays.find(s => s.id === (rundownSundayId || selectedSundayId)) || sundays[0]}
        currentLanguage={currentLanguage}
        onUpdateSunday={handleUpdateSunday}
        ministries={ministries}
        people={people}
      />

        {/* 10-Minute Assignment Grace Queue Floating Bar */}
        <NotificationQueueBar />

        {/* Floating Role & User Link Action Toast Pop-up */}
        {roleActionToast && (
          <div className="fixed bottom-20 md:bottom-8 right-4 left-4 sm:left-auto sm:max-w-md z-50 animate-fade-in bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/60 flex items-center justify-between gap-3 text-xs font-semibold">
            <div className="flex items-center gap-2.5 min-w-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="truncate">{roleActionToast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setRoleActionToast(null)}
              className="text-slate-400 hover:text-white text-base font-bold shrink-0 cursor-pointer ml-2"
            >
              &times;
            </button>
          </div>
        )}

        {/* Mobile/Desktop PWA Install Banner */}
        <PwaInstallBanner currentLang={currentLanguage} />
      </div>
  );
}

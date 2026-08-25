/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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

import { INITIAL_SUNDAY_SCHOOL_LESSONS, INITIAL_SUNDAY_SCHOOL_SUPPLIES } from './data/sundaySchoolData';
import { INITIAL_VISITOR_CONNECTIONS } from './data/visitorData';

import KcKalvarijaLogo from './components/KcKalvarijaLogo';
import { EcosystemNavbar } from './components/EcosystemNavbar';
import { NotificationQueueProvider } from './context/NotificationQueueContext';
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
  Trash2
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
  linkUserToPerson 
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
import { supabase } from './supabaseClient';
import { 
  fetchSundaysFromSupabase, 
  upsertSundayToSupabase, 
  fetchPeopleFromSupabase, 
  upsertPersonToSupabase, 
  deletePersonFromSupabase, 
  fetchBlackoutsFromSupabase, 
  insertBlackoutToSupabase, 
  deleteBlackoutFromSupabase, 
  fetchShiftSwapsFromSupabase, 
  upsertShiftSwapToSupabase, 
  subscribeToSupabaseRealtime, 
  IS_SUPABASE_CONFIGURED 
} from './services/supabaseDataService';
import { seedSupabaseDatabase } from './utils/supabaseSeeder';
import { migrateFirestoreToSupabase } from './utils/firestoreMigrationBridge';

type TabType = 'home' | 'sundays' | 'statistics' | 'sunday_school' | 'worship' | 'ministries' | 'people';

const TAB_TO_PATH: Record<TabType, string> = {
  home: '/domov',
  sundays: '/urnik',
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
  '/urnik': 'sundays',
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
  const cleanId = p.id || ('p-' + (p.name || 'user').toLowerCase().trim().replace(/[^a-z0-9]/g, '_'));
  return { ...p, id: cleanId };
};

const safeParsePeople = (raw: string | null): Person[] => {
  if (!raw) return INITIAL_PEOPLE.map(ensurePersonId);
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const valid = parsed
        .filter(p => p && typeof p === 'object' && typeof p.name === 'string')
        .map(ensurePersonId);
      return valid.length > 0 ? valid : INITIAL_PEOPLE.map(ensurePersonId);
    }
  } catch (e) { /* ignore */ }
  return INITIAL_PEOPLE.map(ensurePersonId);
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

const deduplicatePeopleList = (list: Person[]): Person[] => {
  const result: Person[] = [];
  const seenIds = new Set<string>();
  const phoneToPerson = new Map<string, Person>();
  const emailToPerson = new Map<string, Person>();
  const nameToPerson = new Map<string, Person>();

  // Sort list so that richer records (e.g. records with linked Google email, longer surname) come first
  const sorted = [...list].sort((a, b) => {
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
      continue;
    }

    // 3. Deduplicate by canonical name prefix (e.g. "Dejan" when "Dejan Š" already exists)
    let isNameVariantDuplicate = false;
    for (const [existingName, existingPerson] of nameToPerson.entries()) {
      const samePrefix = cleanName.startsWith(existingName) || existingName.startsWith(cleanName);
      if (samePrefix && (Math.abs(cleanName.length - existingName.length) <= 3)) {
        if (existingPerson.role === person.role || (cleanPhone && existingPerson.phone && existingPerson.phone.replace(/[^0-9]/g, '') === cleanPhone)) {
          isNameVariantDuplicate = true;
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
  const deletedKeys = new Set(getDeletedPeopleKeys().map(k => k.toLowerCase().trim()));

  const isInvalidOrDeleted = (p: Person): boolean => {
    if (!p || !p.id) return true;
    const idKey = p.id.toLowerCase().trim();
    if (OBSOLETE_DUMMY_PEOPLE_IDS.has(idKey)) return true;
    if (['Čižič', 'Lajlar', 'Pratneker', 'Ravnak', 'Vuleta', 'Šarkan', 'Georgiev', 'Kreiner', 'Breznikar', 'Mušič', 'Štefančič'].includes((p.name || '').trim())) return true;
    return deletedKeys.has(idKey) || (p.email ? deletedKeys.has('email:' + p.email.toLowerCase().trim()) : false);
  };

  const map = new Map<string, Person>();

  // 1. Always seed with all INITIAL_PEOPLE defaults so roster members are never dropped
  INITIAL_PEOPLE.forEach(p => {
    if (p && p.id && !isInvalidOrDeleted(p)) {
      map.set(p.id, ensurePersonId(p));
    }
  });

  // 2. Overlay local memory/saved records
  (base || []).forEach(p => {
    if (p && p.id && !isInvalidOrDeleted(p)) {
      const existing = map.get(p.id) || (p.name ? Array.from(map.values()).find(x => x.name.toLowerCase() === p.name.toLowerCase()) : null);
      const targetId = existing?.id || p.id;
      map.set(targetId, { ...(existing || {}), ...ensurePersonId(p), id: targetId });
    }
  });

  // 3. Overlay fetched remote database records
  (fetched || []).forEach(p => {
    if (p && p.id && !isInvalidOrDeleted(p)) {
      const existing = map.get(p.id) || (p.name ? Array.from(map.values()).find(x => x.name.toLowerCase() === p.name.toLowerCase()) : null);
      const targetId = existing?.id || p.id;
      map.set(targetId, { ...(existing || {}), ...ensurePersonId(p), id: targetId });
    }
  });

  return deduplicatePeopleList(Array.from(map.values()));
};

const mergeSundaysWithDefaults = (fetched: ServiceSunday[], base: ServiceSunday[]): ServiceSunday[] => {
  const map = new Map<string, ServiceSunday>();
  INITIAL_SUNDAYS.forEach(s => { if (s && s.id) map.set(s.id, s); });
  base.forEach(s => { if (s && s.id) map.set(s.id, s); });
  fetched.forEach(s => { if (s && s.id) map.set(s.id, s); });
  return Array.from(map.values());
};

export default function App() {
  // --- Core Application States ---
  const [sundays, setSundays] = useState<ServiceSunday[]>(() => {
    const raw = localStorage.getItem('church_roster_sundays_v2');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingIds = new Set(parsed.map((s: any) => s.id));
          const missingInitial = INITIAL_SUNDAYS.filter(s => !existingIds.has(s.id));
          if (missingInitial.length > 0) {
            return [...parsed, ...missingInitial];
          }
          return parsed;
        }
      } catch (e) { /* ignore */ }
    }
    return INITIAL_SUNDAYS;
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
    return INITIAL_PEOPLE;
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

    const handlePopState = () => {
      const p = window.location.pathname.toLowerCase();
      const s = window.location.search.toLowerCase();
      if (p.startsWith('/potrdi') || p.startsWith('/confirm') || s.includes('token=')) {
        setIsConfirmView(true);
      } else {
        setIsConfirmView(false);
        const tabFromUrl = getTabFromPath(window.location.pathname);
        setActiveTab(tabFromUrl);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab, isConfirmView]);
  const [selectedSundayId, setSelectedSundayId] = useState<string | null>(null);
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
    const saved = localStorage.getItem('church_roster_nsl_supplies_v1');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return INITIAL_SUNDAY_SCHOOL_SUPPLIES;
  });

  useEffect(() => {
    localStorage.setItem('church_roster_nsl_supplies_v1', JSON.stringify(sundaySchoolSupplies));
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
  const handleCreateSwapRequest = (req: Omit<ShiftSwapRequest, 'id' | 'createdAt' | 'status'>) => {
    const newReq: ShiftSwapRequest = {
      ...req,
      id: 'swap-' + Date.now(),
      status: 'open',
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
      createdAt: new Date().toLocaleDateString('sl')
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

  const [activePersonName, setActivePersonName] = useState<string>(() => {
    const saved = localStorage.getItem('church_roster_active_person_v2');
    return saved || 'Aleš Lajlar';
  });

  useEffect(() => {
    localStorage.setItem('church_roster_active_person_v2', activePersonName);
  }, [activePersonName]);

  // Calculate standard translations
  const translations: Translation = currentLanguage === 'sl' ? TRANS_SL : TRANS_EN;
  const ministries: Ministry[] = INITIAL_MINISTRIES;

  // Active person object safely guarded against missing or null array elements
  const activePerson: Person | null = (people || []).find(p => {
    if (!p || typeof p !== 'object' || !p.name) return false;
    if (p.name === activePersonName) return true;
    if ((activePersonName === 'Aleš' || activePersonName === 'Aleš Lajlar') && (p.name === 'Aleš' || p.name === 'Aleš Lajlar' || p.id === 'p-ales' || p.id === 'p1')) return true;
    if (authUser?.email && p.email && p.email.toLowerCase().trim() === authUser.email.toLowerCase().trim()) return true;
    return false;
  }) || (people || []).find(p => p && (p.name === 'Aleš' || p.name === 'Aleš Lajlar' || p.id === 'p-ales' || p.id === 'p1')) || null;

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
  const activeRole: UserRole = isAlesLoggedIn
    ? 'Admin'
    : (userDbProfile?.role || (IS_SUPABASE_CONFIGURED || IS_FIREBASE_ENABLED ? (authUser ? 'Servant' : 'Viewer') : (activePerson?.role || legacyRole)));

  // Save changes to localStorage in legacy offline fallback mode
  useEffect(() => {
    localStorage.setItem('church_roster_lang_v2', currentLanguage);
  }, [currentLanguage]);

  useEffect(() => {
    if (!IS_FIREBASE_ENABLED) {
      localStorage.setItem('church_roster_role_v2', legacyRole);
    }
  }, [legacyRole]);

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

      // 1. Direct superadmin override for Ales
      if (isAles) {
        const alesPerson = (people || INITIAL_PEOPLE).find(p => p && (
          p.id === 'p-ales' || 
          p.id === 'p1' || 
          p.id === 'ales-lajlar' || 
          p.name === 'Aleš' || 
          p.name === 'Aleš Lajlar' || 
          (p.email && p.email.toLowerCase() === 'ales.lajlar@gmail.com')
        ));
        const alesName = alesPerson?.name || 'Aleš';
        setActivePersonName(alesName);
        const alesUserObj: User = {
          uid: sessionUser.id,
          email: sessionUser.email || 'ales.lajlar@gmail.com',
          displayName: userFullName || 'Aleš Lajlar (Pastor/Admin)',
          role: 'Admin',
          personName: alesName
        };
        setUserDbProfile(alesUserObj);
        setUsers(prev => {
          const filtered = prev.filter(u => u.uid !== sessionUser.id && u.email !== sessionUser.email);
          return [alesUserObj, ...filtered];
        });

        // Set auth_user_id on p-ales and delete any duplicate UUID row
        try {
          await supabase.from('profiles').update({
            auth_user_id: sessionUser.id,
            email: 'ales.lajlar@gmail.com',
            role: 'Admin'
          }).eq('id', 'p-ales');
          if (sessionUser.id !== 'p-ales') {
            await supabase.from('profiles').delete().eq('id', sessionUser.id);
          }
        } catch (e) { /* ignore */ }

        setAuthLoading(false);
        return;
      }

      // 2. Check in loaded people list
      let matchedPerson = (people || INITIAL_PEOPLE).find(p => p && (
        (p.email && p.email.toLowerCase().trim() === userEmail) ||
        (userFullName && p.name && p.name.toLowerCase().trim() === userFullName.toLowerCase().trim()) ||
        (p.id && (p.id === sessionUser.id || (p as any).auth_user_id === sessionUser.id))
      ));

      if (!matchedPerson) {
        try {
          const { data: dbProfile } = await supabase
            .from('profiles')
            .select('*')
            .or(`email.ilike.${userEmail},full_name.ilike.${userFullName || userEmail}`)
            .maybeSingle();

          if (dbProfile) {
            matchedPerson = {
              id: dbProfile.id,
              name: dbProfile.full_name || dbProfile.name,
              email: dbProfile.email,
              phone: dbProfile.phone,
              role: (dbProfile.role as UserRole) || 'Servant',
              preferredMinistries: dbProfile.preferred_ministries || [],
              ledMinistries: dbProfile.led_ministries || [],
              familyMembers: dbProfile.family_members || []
            };
          }
        } catch (e) { /* ignore */ }
      }

      let resolvedRole: UserRole = matchedPerson?.role || 'Servant';

      if (matchedPerson) {
        setActivePersonName(matchedPerson.name);
        resolvedRole = (matchedPerson.role as UserRole) || 'Servant';
        // Auto-link this user to their canonical card row & remove any duplicate row!
        try {
          await supabase.from('profiles').update({
            auth_user_id: sessionUser.id,
            email: sessionUser.email || matchedPerson.email,
            role: resolvedRole
          }).eq('id', matchedPerson.id);

          if (matchedPerson.id !== sessionUser.id) {
            await supabase.from('profiles').delete().eq('id', sessionUser.id);
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
            role: resolvedRole,
            preferred_ministries: [],
            family_members: [],
            is_exempt_from_burnout: false
          });
        } catch (e) { /* ignore */ }
      }

      const activeUserObj: User = {
        uid: sessionUser.id,
        email: sessionUser.email || '',
        displayName: userFullName || sessionUser.email || 'Volunteer',
        role: resolvedRole,
        personName: matchedPerson?.name
      };
      setUserDbProfile(activeUserObj);
      setUsers(prev => {
        const filtered = prev.filter(u => u.uid !== sessionUser.id && u.email !== sessionUser.email);
        return [activeUserObj, ...filtered];
      });
      setAuthLoading(false);
    };

    // 1. Initial user session check from Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      syncUserSession(session?.user ?? null);
    }).catch(() => {
      setAuthLoading(false);
    });

    // 2. Supabase Auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      syncUserSession(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [people]);

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
        const [remoteSundays, remotePeople, remoteBlackouts, remoteSwaps] = await Promise.all([
          fetchSundaysFromSupabase(),
          fetchPeopleFromSupabase(),
          fetchBlackoutsFromSupabase(),
          fetchShiftSwapsFromSupabase()
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
          setPeople(merged);
          try { localStorage.setItem('church_roster_people_v2', JSON.stringify(merged)); } catch (e) {}

          const registeredUsers: User[] = (merged || [])
            .filter((p: any) => p.auth_user_id)
            .map((p: any) => ({
              uid: (p as any).auth_user_id,
              email: p.email || '',
              displayName: p.name,
              role: p.role || 'Viewer',
              personName: p.name
            }));
          setUsers(prev => {
            const map = new Map<string, User>();
            registeredUsers.forEach(u => map.set(u.uid, u));
            prev.forEach(u => map.set(u.uid, u));
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
          setSundays(freshSundays);
          try { localStorage.setItem('church_roster_sundays_v2', JSON.stringify(freshSundays)); } catch (e) {}
        }
      },
      async () => {
        const freshPeople = await fetchPeopleFromSupabase();
        if (freshPeople.length > 0) {
          setPeople(freshPeople);
          try { localStorage.setItem('church_roster_people_v2', JSON.stringify(freshPeople)); } catch (e) {}
          const registeredUsers: User[] = (freshPeople || [])
            .filter((p: any) => p.auth_user_id)
            .map((p: any) => ({
              uid: (p as any).auth_user_id,
              email: p.email || '',
              displayName: p.name,
              role: p.role || 'Viewer',
              personName: p.name
            }));
          setUsers(prev => {
            const map = new Map<string, User>();
            registeredUsers.forEach(u => map.set(u.uid, u));
            prev.forEach(u => map.set(u.uid, u));
            return Array.from(map.values());
          });
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
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) {
        console.error('Supabase Google OAuth error:', error);
        alert((currentLanguage === 'sl' ? 'Napaka pri prijavi z Google računom: ' : 'Google Sign-In failed: ') + error.message);
      }
    } catch (err: any) {
      console.error('Failed signing in with Google provider:', err);
      alert((currentLanguage === 'sl' ? 'Napaka pri prijavi z Google računom: ' : 'Google Sign-In failed: ') + (err?.message || err));
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setUserDbProfile(null);
      setAuthUser(null);
      setGoogleToken(null);
      setSelectedSundayId(null);
      setActiveTab('home');
    } catch (err) {
      console.error('Failed log out session:', err);
    }
  };

  // --- Role Promotion Callback (Used by Admin in People View) ---
  const handleUpdateUserRole = async (userId: string, newRole: UserRole) => {
    // 1. Optimistic React state update
    setUsers(prev => prev.map(u => u.uid === userId ? { ...u, role: newRole } : u));

    // 2. Persist to Supabase
    if (IS_SUPABASE_CONFIGURED) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ role: newRole, updated_at: new Date().toISOString() })
          .eq('id', userId);

        if (error) {
          console.warn('[Supabase] Role update notice:', error.message);
        }
      } catch (err) {
        console.error('Failed to promote user role in Supabase:', err);
      }
    }

    if (IS_FIREBASE_ENABLED && db) {
      try {
        const docRef = doc(db, 'users', userId);
        await setDoc(docRef, sanitizeForFirestore({ role: newRole }), { merge: true });
      } catch (err) {
        console.error('Failed to promote user role in Firestore:', err);
      }
    }
  };

  const handleLinkUserPerson = async (userId: string, personNameOrId: string | undefined) => {
    const targetPerson = (people || []).find(p => p && (p.id === personNameOrId || p.name === personNameOrId));
    
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

    // Auto-populate person's email with Google email if unwritten or updating
    if (userId && targetPerson) {
      const targetUser = (users || []).find(u => u.uid === userId);
      if (targetUser && targetUser.email && targetPerson && (!targetPerson.email || targetPerson.email.trim() === '')) {
        handleUpdatePerson(targetPerson.id, {
          ...targetPerson,
          email: targetUser.email
        });
      }
    }

    // 2. Persist to Supabase
    if (IS_SUPABASE_CONFIGURED) {
      linkUserToPerson(userId, targetPerson).catch(console.warn);
      if (authUser && (authUser.uid === userId || authUser.id === userId) && targetPerson?.name) {
        setActivePersonName(targetPerson.name);
      }
    }

    if (IS_FIREBASE_ENABLED && db) {
      try {
        await linkUserToPerson(userId, targetPerson);
        if (authUser && (authUser.uid === userId || authUser.id === userId) && targetPerson?.name) {
          setActivePersonName(targetPerson.name);
        }
      } catch (err) {
        console.error('Failed to link user profile in Firestore:', err);
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
    upsertPersonToSupabase(personWithId).catch(console.warn);

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
    const parseSheetDate = (dateStr: string): Date => {
      const parts = dateStr.split('.').map(p => parseInt(p.trim(), 10));
      if (parts.length < 3) return new Date();
      const day = parts[0];
      const month = parts[1] - 1;
      const year = 2000 + parts[2];
      return new Date(year, month, day);
    };

    const sorted = [...sundays].sort((a, b) => {
      return parseSheetDate(a.date).getTime() - parseSheetDate(b.date).getTime();
    });

    let newDateStr = '';
    if (sorted.length > 0) {
      const latestDate = parseSheetDate(sorted[sorted.length - 1].date);
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

  // Generate all Sundays for Academic Year 2026/2027 (Sep 6, 2026 -> Aug 29, 2027)
  const handleGenerateAcademicYear = async () => {
    const startDate = new Date(2026, 8, 6); // Sep 6, 2026
    const endDate = new Date(2027, 7, 29); // Aug 29, 2027

    const existingDates = new Set(sundays.map(s => s.date.replace(/\s+/g, '')));

    const newSundaysToAdd: ServiceSunday[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const d = currentDate.getDate();
      const m = currentDate.getMonth() + 1;
      const y = currentDate.getFullYear() % 100;
      const formattedDate = `${d}. ${m}. ${y}`;
      const normalizedKey = formattedDate.replace(/\s+/g, '');

      if (!existingDates.has(normalizedKey)) {
        const sundayId = `s_ay2627_${currentDate.getTime()}`;
        newSundaysToAdd.push({
          id: sundayId,
          date: formattedDate,
          themeSl: 'Nedeljsko bogoslužje',
          themeEn: 'Sunday Service',
          status: 'draft',
          guest: '',
          assignments: {},
          absentOrNotes: ''
        });
      }

      currentDate.setDate(currentDate.getDate() + 7);
    }

    if (newSundaysToAdd.length === 0) {
      return;
    }

    setSundays(prev => {
      const updated = [...prev, ...newSundaysToAdd];
      localStorage.setItem('church_roster_sundays_v2', JSON.stringify(updated));
      return updated;
    });

    if (IS_SUPABASE_CONFIGURED) {
      try {
        const rows = newSundaysToAdd.map(s => ({
          id: s.id,
          date: s.date,
          theme_sl: s.themeSl || '',
          theme_en: s.themeEn || '',
          status: s.status || 'draft',
          guest: s.guest || '',
          absent_or_notes: s.absentOrNotes || '',
          special_focus: s.specialFocus || null,
          worship_setlist: s.worshipSetlist || [],
          updated_at: new Date().toISOString()
        }));
        await supabase.from('nedelje_services').upsert(rows);
      } catch (e) {
        console.warn('[Supabase] batch academic year upsert error:', e);
      }
    }

    if (IS_FIREBASE_ENABLED && db) {
      try {
        const batch = writeBatch(db);
        newSundaysToAdd.forEach(s => {
          batch.set(doc(db, 'sundays', s.id), s);
        });
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'sundays/batch_academic_year');
      }
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
        onUpdateSunday={handleUpdateSunday}
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
    return (
      <div className="flex flex-col min-h-screen bg-[#F3F4F6] font-sans">
        {/* Banner with language change */}
        <header className="bg-white border-b border-gray-200 py-3 px-4">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KcKalvarijaLogo className="w-8 h-8" />
              <div>
                <span className="text-sm font-semibold tracking-tight text-slate-900 block font-display leading-tight">
                  {translations.title}
                </span>
              </div>
            </div>
            <button
              onClick={() => setCurrentLanguage(prev => prev === 'sl' ? 'en' : 'sl')}
              className="text-[11px] font-mono font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-md transition flex items-center gap-1 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{currentLanguage === 'sl' ? 'EN' : 'SL'}</span>
            </button>
          </div>
        </header>

        {/* Secure gate panel centering */}
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto p-1.5 shadow-xs">
                <KcKalvarijaLogo className="w-full h-full" />
              </div>
              <h2 className="text-xl font-display font-semibold text-slate-900">
                {currentLanguage === 'sl' ? 'Prijava v Planer' : 'Sunday Worship Hub'}
              </h2>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                {currentLanguage === 'sl' 
                  ? 'Za dostop do nedeljskih razporedov in pokritosti služb se prijavite s svojim Googlovim računom.' 
                  : 'To view community rosters, absent notes, and live coverage plans, please sign in with Google.'}
              </p>
            </div>

            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-2 bg-slate-950 text-white hover:bg-slate-850 px-4 py-3 rounded-xl transition duration-150 font-semibold text-xs border border-slate-950 shadow-sm cursor-pointer active:scale-95"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{currentLanguage === 'sl' ? 'Prijava z Google računom' : 'Continue with Google'}</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <NotificationQueueProvider>
      <div className="flex flex-col min-h-screen bg-[#FAF7F5] font-sans selection:bg-[#93032E] selection:text-white pb-20 max-w-full overflow-x-hidden">
      
      {/* Universal 2-Tier Ecosystem Navbar */}
      <EcosystemNavbar
        currentApp="nedelje"
        user={authUser ? {
          name: isAlesLoggedIn ? 'Aleš' : (userDbProfile?.displayName || userDbProfile?.personName || authUser.email?.split('@')[0] || 'Uporabnik'),
          email: authUser.email || '',
          role: isAlesLoggedIn ? 'Superadmin' : activeRole,
        } : null}
        onLogin={handleGoogleLogin}
        onLogout={handleSignOut}
        currentLang={currentLanguage}
        onLanguageChange={(l) => setCurrentLanguage(l)}
        extraNavItems={
          <>
            <button
              onClick={() => { setSelectedSundayId(null); setActiveTab('home'); }}
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
              onClick={() => { setSelectedSundayId(null); setActiveTab('sundays'); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold font-['Nohemi',sans-serif] flex items-center gap-1.5 transition-all cursor-pointer select-none whitespace-nowrap ${
                activeTab === 'sundays'
                  ? 'bg-[#93032E] text-white shadow-xs'
                  : 'text-slate-700 hover:text-[#93032E] hover:bg-slate-100/80'
              }`}
              title={currentLanguage === 'sl' ? 'Urnik' : 'Roster'}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{currentLanguage === 'sl' ? 'Urnik' : 'Roster'}</span>
            </button>

            <button
              onClick={() => { setSelectedSundayId(null); setActiveTab('sunday_school'); }}
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
              onClick={() => { setSelectedSundayId(null); setActiveTab('worship'); }}
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
              onClick={() => { setSelectedSundayId(null); setActiveTab('ministries'); }}
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
              onClick={() => { setSelectedSundayId(null); setActiveTab('people'); }}
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
        }
      />

      {/* Roster Alert Info (Hidden for logged in leaders/admins/superadmin) */}
      {!isAlesLoggedIn && activeRole === 'Viewer' && !authUser && (
        <div className="bg-amber-500/10 border-b border-amber-500/10 py-1.5 px-4 text-center">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-1 text-[11px] font-medium text-amber-800">
            <span className="shrink-0">⚠️</span>
            <span>
              {currentLanguage === 'sl' 
                ? 'Prikaz za gledalce: urejanje in dodeljevanje storitev je zaklenjeno.' 
                : 'Viewer mode: Editing and volunteer allocation is currently read-only.'}
            </span>
          </div>
        </div>
      )}

      {/* Main Container Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-32">
        {activeSunday ? (
          <SundayDetail
            sunday={activeSunday}
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
            onBack={() => setSelectedSundayId(null)}
            onSelectSunday={(id) => setSelectedSundayId(id)}
            onUpdateSunday={handleUpdateSunday}
            onUpdatePerson={handleUpdatePerson}
            googleToken={googleToken}
            onSetGoogleToken={handleSetGoogleToken}
            onOpenVisitorModal={() => setIsVisitorModalOpen(true)}
            onOpenInspectionModal={handleOpenInspectionModal}
          />
        ) : (
          <div className="animate-fade-in">
            {activeTab === 'home' && (
              <HomeDashboard
                sundays={sundays}
                ministries={ministries}
                people={people}
                activePerson={activePerson}
                userRole={activeRole}
                translations={translations}
                currentLanguage={currentLanguage}
                onSelectSunday={(id) => setSelectedSundayId(id)}
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
              />
            )}

            {activeTab === 'sundays' && (
              <ScheduleView
                sundays={sundays}
                ministries={ministries}
                userRole={activeRole}
                translations={translations}
                currentLanguage={currentLanguage}
                onSelectSunday={(id) => setSelectedSundayId(id)}
                onDeleteSunday={handleDeleteSunday}
                onGenerateAcademicYear={handleGenerateAcademicYear}
                onOpenStatistics={() => setActiveTab('statistics')}
              />
            )}

            {activeTab === 'statistics' && (
              <Statistika
                sundays={sundays}
                ministries={ministries}
                people={people}
                currentLanguage={currentLanguage}
                translations={translations}
                onBack={() => setActiveTab('sundays')}
                onSelectSunday={(id) => {
                  setSelectedSundayId(id);
                  setActiveTab('sundays');
                }}
              />
            )}

            {activeTab === 'sunday_school' && (
              <SundaySchoolView
                sundays={sundays}
                people={people}
                lessons={sundaySchoolLessons}
                supplies={sundaySchoolSupplies}
                onUpdateLessons={handleUpdateSundaySchoolLessons}
                onUpdateSupplies={setSundaySchoolSupplies}
                translations={translations}
                currentLanguage={currentLanguage}
                canEdit={activeRole !== 'Viewer'}
                onSelectSunday={(id) => setSelectedSundayId(id)}
                onGenerateAcademicYear={handleGenerateAcademicYear}
              />
            )}

            {activeTab === 'worship' && (
              <WorshipTeamView
                sundays={sundays}
                people={people}
                userRole={activeRole}
                translations={translations}
                currentLanguage={currentLanguage}
                worshipRoster={worshipRoster}
                onUpdateWorshipRoster={handleUpdateWorshipRoster}
                onUpdateSunday={handleUpdateSunday}
                onSelectSunday={(id) => setSelectedSundayId(id)}
              />
            )}

            {activeTab === 'ministries' && (
              <MinistryView
                sundays={sundays}
                ministries={ministries}
                people={people}
                userRole={activeRole}
                translations={translations}
                currentLanguage={currentLanguage}
                worshipRoster={worshipRoster}
                sundaySchoolLessons={sundaySchoolLessons}
                onSelectSunday={(id) => setSelectedSundayId(id)}
                onOpenInspectionModal={handleOpenInspectionModal}
              />
            )}

            {activeTab === 'people' && (
              <PeopleView
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
              />
            )}

            {/* Extra Admin Controls Block (Collapsible) */}
            {activeTab === 'people' && activeRole === 'Admin' && IS_FIREBASE_ENABLED && users.length > 0 && (
              <div className="px-4 pb-6 max-w-lg mx-auto w-full space-y-3">
                <div className="border-t border-gray-200/80 my-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowManageUserRoles(!showManageUserRoles)}
                    className="w-full flex items-center justify-between p-3 bg-slate-100 hover:bg-slate-200/80 border border-slate-250 rounded-xl transition cursor-pointer font-sans"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ShieldAlert className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="font-display font-semibold text-xs uppercase tracking-wider text-slate-800 font-mono truncate">
                        {currentLanguage === 'sl' ? 'Upravljanje Vlog Planerja' : 'Manage User Roles'}
                      </span>
                      <span className="text-[10px] bg-indigo-100 text-indigo-800 font-mono font-bold px-2 py-0.5 rounded-full border border-indigo-200 shrink-0">
                        {users.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold shrink-0">
                      <span>{showManageUserRoles ? (currentLanguage === 'sl' ? 'Skrij' : 'Hide') : (currentLanguage === 'sl' ? 'Prikaži' : 'Show')}</span>
                      {showManageUserRoles ? <ChevronUp className="w-4 h-4 text-indigo-600" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </div>
                  </button>
                </div>

                {showManageUserRoles && (
                  <div className="space-y-3.5 animate-fade-in bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200">
                    <p className="text-[11px] text-slate-600 leading-relaxed font-sans">
                      {currentLanguage === 'sl' 
                        ? 'Kot administrator lahko spremenite vloge registriranih uporabnikov ter jih povežete s profili v bazi sodelavcev.' 
                        : 'As an Administrator, verify, link profiles, and update roles of collaborative leaders.'}
                    </p>

                    <div className="space-y-2">
                      {users.map((u) => {
                        const linkedPerson = people.find(p => p && (
                          p.name === u.personName || 
                          p.id === u.personName || 
                          (p.email && u.email && p.email.toLowerCase().trim() === u.email.toLowerCase().trim())
                        ));
                        const currentLinkVal = linkedPerson ? linkedPerson.name : (u.personName || '');
                        const isUnlinked = !linkedPerson;

                        return (
                          <div key={u.uid} className={`bg-white border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs transition ${
                            isUnlinked ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200'
                          }`}>
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-900 leading-none truncate">{u.displayName || 'Google User'}</span>
                                {isUnlinked && (
                                  <span className="text-[9px] font-mono font-bold bg-amber-500 text-white px-1.5 py-0.2 rounded-full">
                                    {currentLanguage === 'sl' ? '🔔 Čaka na povezavo' : '🔔 Unlinked'}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500 font-mono block truncate">{u.email}</span>
                              {linkedPerson && (
                                <span className="text-[10px] text-indigo-700 font-bold block truncate">
                                  ✔ {currentLanguage === 'sl' ? 'Povezan z: ' : 'Linked to: '}{linkedPerson.name}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap shrink-0">
                              {/* Option to link this account to a Person in people database */}
                              <select
                                value={currentLinkVal}
                                onChange={(e) => handleLinkUserPerson(u.uid, e.target.value || undefined)}
                                className={`text-[10px] border p-1.5 px-2 rounded-lg focus:outline-none font-medium cursor-pointer ${
                                  isUnlinked ? 'bg-amber-100 border-amber-300 text-amber-950 font-bold' : 'bg-slate-50 border-gray-250 text-slate-800'
                                }`}
                                title={currentLanguage === 'sl' ? 'Poveži z imenom v bazi sodelavcev' : 'Link to volunteer in database'}
                              >
                                <option value="">{currentLanguage === 'sl' ? '-- Poveži sodelavca --' : '-- Link volunteer --'}</option>
                                {people
                                  .filter(p => p && p.name)
                                  .map(p => (
                                    <option key={p.id || p.name} value={p.name}>
                                      👤 {p.name} {p.role ? `(${p.role})` : ''}
                                    </option>
                                  ))
                                }
                              </select>

                              {/* Role selection */}
                              <select
                                value={u.role}
                                onChange={(e) => handleUpdateUserRole(u.uid, e.target.value as UserRole)}
                                className="text-[11px] bg-slate-50 border border-gray-250 p-1.5 px-2 rounded-lg focus:outline-none font-bold cursor-pointer"
                              >
                                <option value="Admin">🛠️ Admin</option>
                                <option value="Leader">📋 Vodja</option>
                                <option value="Servant">👤 Služabnik</option>
                                <option value="Viewer">👁️ Viewer</option>
                              </select>

                              {/* Erase / Delete User Button */}
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u.uid, u.email)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-800 border border-rose-200 rounded-lg transition active:scale-95 cursor-pointer shrink-0"
                                title={currentLanguage === 'sl' ? 'Izbriši uporabniški račun in e-pošto' : 'Delete user account and erase email'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
      </main>

      {/* Mobile Native Bottom Navigation - Hidden on Desktop */}
      <nav id="bottom-navigation-bar" className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-[#A6A15E]/20 py-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg z-30 animate-fade-in w-full">
        <div className="mx-auto w-full max-w-lg grid grid-cols-6 px-1 gap-0.5">
          
          <button
            onClick={() => { setSelectedSundayId(null); setActiveTab('home'); }}
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
            onClick={() => { setSelectedSundayId(null); setActiveTab('sundays'); }}
            id="nav-tab-sundays"
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-lg transition-all duration-200 focus:outline-none min-w-0 ${
              activeTab === 'sundays' || activeSunday
                ? 'bg-sky-50 text-sky-700 font-bold border border-sky-200/80 shadow-xs' 
                : 'text-slate-500 hover:text-sky-600 hover:bg-sky-50/50 hover:shadow-[0_0_10px_rgba(2,132,199,0.2)]'
            }`}
          >
            <Calendar className="w-4 h-4 shrink-0 text-sky-600" />
            <span className="text-[8px] sm:text-[9px] uppercase tracking-tight font-bold mt-0.5 truncate max-w-full text-center">
              {currentLanguage === 'sl' ? 'URNIK' : 'ROSTER'}
            </span>
          </button>

          <button
            onClick={() => { setSelectedSundayId(null); setActiveTab('sunday_school'); }}
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
            onClick={() => { setSelectedSundayId(null); setActiveTab('worship'); }}
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
            onClick={() => { setSelectedSundayId(null); setActiveTab('ministries'); }}
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
            onClick={() => { setSelectedSundayId(null); setActiveTab('people'); }}
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
        onCancelSwapRequest={handleCancelSwapRequest}
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

        {/* Mobile/Desktop PWA Install Banner */}
        <PwaInstallBanner currentLang={currentLanguage} />
      </div>
    </NotificationQueueProvider>
  );
}

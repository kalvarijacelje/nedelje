/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ServiceSunday, Ministry, Person, UserRole, Translation, MinistryAssignment, AssignmentStatus, BlackoutDate, WorshipRosterEntry, SundaySchoolLesson, canAccessPersonalData, canViewPersonContactInfo, getPrivacyDisplayName } from '../types';
import { ArrowLeft, ArrowRight, UserPlus, Trash2, Check, CheckCircle2, AlertTriangle, Copy, Save, BookOpen, AlertCircle, HelpCircle, FileText, Loader2, Calendar, MessageSquare, Send, Lock, Music, Clock, Tv, ExternalLink, Youtube, Sparkles, Coffee, ClipboardCheck, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Layers, Heart, HeartHandshake, Crown, Phone, PhoneCall, Mail, X, Home, Unlock, Utensils, CupSoda, Volume2, Camera, Sliders, Monitor, Film, Smile, GraduationCap, Globe, Coins, Wine, Repeat, MoreVertical, Key, Flame, Mic, HandHelping, Video } from 'lucide-react';
import ServiceRundownModal from './ServiceRundownModal';
import HeroHeaderBanner from './HeroHeaderBanner';
import { supabase } from '../supabaseClient';
import { generateGoogleDoc } from '../lib/googleDocs';
import { createOrUpdateServiceEvent, createOrUpdateRehearsalEvent, deleteCalendarEvent } from '../lib/googleCalendar';
import { listChatSpaces, sendChatMessage, buildWorkflowMessage } from '../lib/googleChat';
import { isExemptFromBurnout } from '../lib/burnoutAnalytics';
import SpecialSundayFocusSection from './SpecialSundayFocusSection';
import { getApplicableMinistriesForSunday, getSundayCoverageStats } from '../lib/sundaySpecialFocus';
import { resolveMinistryAssignments } from '../utils/worshipSync';
import { getSundaySchoolLesson } from '../utils/sundaySchoolSync';
import { batchAssignPersonToConsecutiveSundays, getConsecutiveSundayDates } from '../utils/recurringAssignments';
import { useNotificationQueue } from '../hooks/useNotificationQueue';
import { useBackdropHistory } from '../hooks/useBackdropHistory';
import { 
  generateConfirmationToken, 
  generatePublicConfirmationUrl, 
  generateVolunteerChatInviteMessage,
  getWhatsAppInvitationUrl
} from '../services/notificationService';
import { parseEuropeanDate, formatToEuropeanDate, formatEuropeanDateRange, formatEuropeanDateTime } from '../utils/dateUtils';

export function parseToDateOnly(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = parseEuropeanDate(dateStr);
  return d.getTime() === 0 ? null : d;
}

export function checkPersonAbsenceOnSunday(
  personNameOrId: string,
  targetSundayDate: string,
  blackoutList: BlackoutDate[]
): { isAbsent: boolean; reason?: string; startDate?: string; endDate?: string } {
  if (!personNameOrId || !targetSundayDate || !Array.isArray(blackoutList)) return { isAbsent: false };
  const sundayDate = parseToDateOnly(targetSundayDate);
  if (!sundayDate) return { isAbsent: false };

  const normTarget = personNameOrId.toLowerCase().trim();

  for (const b of blackoutList) {
    if (!b || !b.startDate) continue;
    const bName = (b.personName || '').toLowerCase().trim();
    const bId = (b.personId || '').toLowerCase().trim();
    const familyNames = Array.isArray(b.familyMemberNames)
      ? b.familyMemberNames.map(f => (f || '').toLowerCase().trim())
      : [];

    const matchesPerson =
      (bId && bId === normTarget) ||
      (bName && bName === normTarget) ||
      familyNames.includes(normTarget);

    if (!matchesPerson) continue;

    const start = parseToDateOnly(b.startDate);
    const end = parseToDateOnly(b.endDate || b.startDate);

    if (start && end) {
      if (sundayDate.getTime() >= start.getTime() && sundayDate.getTime() <= end.getTime()) {
        return {
          isAbsent: true,
          reason: b.reason,
          startDate: b.startDate,
          endDate: b.endDate || b.startDate
        };
      }
    }
  }

  return { isAbsent: false };
}

function checkCandidateDeclineOnSunday(personName: string, ministryId: string, sunday: ServiceSunday): { isDeclined: boolean; declineReason?: string } {
  if (!personName || !sunday.assignmentDetails) return { isDeclined: false };
  
  // Check this ministry specifically first
  const details = sunday.assignmentDetails[ministryId];
  if (Array.isArray(details)) {
    const found = details.find(d => d.personName.toLowerCase().trim() === personName.toLowerCase().trim() && d.status === 'declined');
    if (found) {
      return { isDeclined: true, declineReason: found.declineReason };
    }
  }

  // Also check if they declined any ministry on that Sunday
  for (const [_, list] of Object.entries(sunday.assignmentDetails)) {
    if (Array.isArray(list)) {
      const found = list.find(d => d.personName.toLowerCase().trim() === personName.toLowerCase().trim() && d.status === 'declined');
      if (found) {
        return { isDeclined: true, declineReason: found.declineReason };
      }
    }
  }

  return { isDeclined: false };
}

export function isLightweightDuty(ministryIdOrName: string, ministries?: Ministry[]): boolean {
  if (!ministryIdOrName) return false;
  const raw = ministryIdOrName.toLowerCase().trim();

  // Explicit ID matches (0.5 Weight Roles)
  const lightIds = ['odklepanje', 'zaklepanje', 'koncni_pregled', 'cistoca', 'kava', 'hrana', 'editiranje', 'finance'];
  if (lightIds.includes(raw)) return true;

  // Check if it matches name of any ministry with light ID
  if (ministries) {
    const found = ministries.find(m => m.id.toLowerCase() === raw || m.nameSl.toLowerCase() === raw || m.nameEn.toLowerCase() === raw);
    if (found && lightIds.includes(found.id.toLowerCase())) return true;
  }

  // Exact Slovenian or English label matches
  const exactLabels = [
    'odklepanje stavbe', 'building unlock',
    'zaklepanje stavbe', 'building lock',
    'končni pregled', 'koncni pregled', 'final inspection',
    'čistoča pred nedeljo', 'cistoca pred nedeljo', 'pre-service cleaning',
    'kava (filter)', 'kava', 'filter coffee',
    'hrana (prigrizki)', 'hrana', 'food / snacks', 'food/snacks', 'food',
    'editiranje učenj', 'editiranje ucenj', 'video/audio editing',
    'finance (štetje)', 'finance (stetje)', 'finance', 'finance / counting',
  ];
  return exactLabels.includes(raw);
}

function WhatsAppIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.301-.15-1.785-.881-2.062-.982-.276-.101-.477-.15-.678.15-.201.3-.779.982-.955 1.183-.176.201-.351.226-.652.076-.301-.15-1.274-.47-2.426-1.498-.897-.799-1.502-1.786-1.678-2.087-.176-.301-.019-.464.13-.613.135-.134.301-.351.452-.527.15-.176.201-.301.301-.502.101-.201.05-.376-.025-.527-.075-.15-.678-1.635-.93-2.245-.244-.593-.492-.511-.677-.521l-.578-.01c-.201 0-.527.075-.804.376-.276.301-1.054 1.03-1.054 2.512 0 1.482 1.079 2.912 1.23 3.113.15.201 2.122 3.24 5.142 4.542.718.31 1.279.495 1.716.634.721.23 1.377.197 1.896.12.578-.086 1.785-.729 2.036-1.432.251-.703.251-1.305.176-1.432-.075-.128-.276-.202-.577-.352z" />
    </svg>
  );
}

function MessengerIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.654V24l4.088-2.242c1.092.304 2.246.464 3.443.464 6.627 0 12-4.975 12-11.111C24 4.974 18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26 6.559-6.963 3.13 3.26 5.888-3.26-6.559 6.963z" />
    </svg>
  );
}

function GoogleChatIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.98-1.385A9.947 9.947 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm-3 8h6a1 1 0 110 2H9a1 1 0 110-2zm0 4h4a1 1 0 110 2H9a1 1 0 110-2z" />
    </svg>
  );
}

interface SundayDetailProps {
  sunday: ServiceSunday;
  initialMinistryId?: string | null;
  initialCategory?: string | null;
  allSundays: ServiceSunday[];
  ministries: Ministry[];
  people: Person[];
  userRole: UserRole;
  activePerson?: Person | null;
  translations: Translation;
  currentLanguage: 'sl' | 'en';
  worshipRoster?: WorshipRosterEntry[];
  sundaySchoolLessons?: SundaySchoolLesson[];
  blackoutDates?: BlackoutDate[];
  onBack: () => void;
  onSelectSunday?: (sundayId: string) => void;
  onUpdateSunday: (updated: ServiceSunday) => void;
  onUpdatePerson?: (personId: string, updatedPerson: Person) => void;
  googleToken: string | null;
  onSetGoogleToken: (token: string | null) => void;
  onOpenVisitorModal?: () => void;
  onOpenInspectionModal?: (category?: 'coffee_upper_hall' | 'tech_stage' | 'kids_classrooms' | 'general_cleaning') => void;
  authUser?: any;
}

const renderCategoryIcon = (catId: string, className = "w-3.5 h-3.5") => {
  switch (catId) {
    case 'all':
      return <Layers className={className} />;
    case 'cleaning':
      return <Sparkles className={className} />;
    case 'hospitality':
      return <Coffee className={className} />;
    case 'sermon_prayer':
      return <BookOpen className={className} />;
    case 'worship':
    case 'av_tech':
      return <Music className={className} />;
    case 'audio_video':
      return <Video className={className} />;
    case 'kids':
      return <Smile className={className} />;
    case 'post_service':
    case 'other':
    default:
      return <HeartHandshake className={className} />;
  }
};

const getTeamTheme = (category: string) => {
  switch (category) {
    case 'cleaning':
      return {
        activeTab: 'bg-amber-600 text-white border-amber-600 shadow-xs font-semibold',
        inactiveTab: 'bg-amber-50/80 hover:bg-amber-100/90 text-amber-900 border-amber-200/90 font-medium',
        dot: 'bg-amber-500',
        labelSl: 'Priprava & Čiščenje',
        labelEn: 'Setup & Cleaning'
      };
    case 'hospitality':
      return {
        activeTab: 'bg-rose-600 text-white border-rose-600 shadow-xs font-semibold',
        inactiveTab: 'bg-rose-50/80 hover:bg-rose-100/90 text-rose-900 border-rose-200/90 font-medium',
        dot: 'bg-rose-500',
        labelSl: 'Gostoljubje & Kava',
        labelEn: 'Hospitality & Snacks'
      };
    case 'sermon_prayer':
      return {
        activeTab: 'bg-sky-600 text-white border-sky-600 shadow-xs font-semibold',
        inactiveTab: 'bg-sky-50/80 hover:bg-sky-100/90 text-sky-900 border-sky-200/90 font-medium',
        dot: 'bg-sky-500',
        labelSl: 'Bogoslužje',
        labelEn: 'Main Service'
      };
    case 'worship':
    case 'av_tech':
      return {
        activeTab: 'bg-purple-600 text-white border-purple-600 shadow-xs font-semibold',
        inactiveTab: 'bg-purple-50/80 hover:bg-purple-100/90 text-purple-900 border-purple-200/90 font-medium',
        dot: 'bg-purple-500',
        labelSl: 'Slavljenje',
        labelEn: 'Worship'
      };
    case 'audio_video':
      return {
        activeTab: 'bg-cyan-600 text-white border-cyan-600 shadow-xs font-semibold',
        inactiveTab: 'bg-cyan-50/80 hover:bg-cyan-100/90 text-cyan-950 border-cyan-200/90 font-medium',
        dot: 'bg-cyan-500',
        labelSl: 'Avdio Video',
        labelEn: 'Audio Video'
      };
    case 'kids':
      return {
        activeTab: 'bg-emerald-600 text-white border-emerald-600 shadow-xs font-semibold',
        inactiveTab: 'bg-emerald-50/80 hover:bg-emerald-100/90 text-emerald-900 border-emerald-200/90 font-medium',
        dot: 'bg-emerald-500',
        labelSl: 'Nedeljska šola',
        labelEn: 'Sunday School'
      };
    case 'post_service':
    case 'other':
    default:
      return {
        activeTab: 'bg-indigo-600 text-white border-indigo-600 shadow-xs font-semibold',
        inactiveTab: 'bg-indigo-50/80 hover:bg-indigo-100/90 text-indigo-900 border-indigo-200/90 font-medium',
        dot: 'bg-indigo-500',
        labelSl: 'Po bogoslužju',
        labelEn: 'Post-Service'
      };
  }
};

export const getMinistryIconEmoji = (minId: string): string => {
  switch (minId) {
    case 'cistoca': return '✨';
    case 'zgornja_dvorana': return '🏠';
    case 'odklepanje': return '🔑';
    case 'zaklepanje': return '🔒';
    case 'koncni_pregled': return '📋';
    case 'gostoljubje': return '🥤';
    case 'kava': return '☕';
    case 'hrana': return '🍽️';
    case 'barista': return '🔥';
    case 'sprejem_reditelji': return '🤝';
    case 'uvodna_molitev_darovi': return '🙏';
    case 'ucenje': return '📖';
    case 'obvestila': return '📢';
    case 'pricevanja': return '💬';
    case 'prevajanje': return '🌐';
    case 'gospodova_vecerja': return '🍷';
    case 'molitev_druzine': return '🙏';
    case 'slavilna_ekipa': return '🎵';
    case 'uvod_slavljenje': return '🎤';
    case 'zvok': return '🎚️';
    case 'postavitev_av': return '🎥';
    case 'besedila': return '🖥️';
    case 'youtube_prenos': return '📹';
    case 'editiranje': return '🎬';
    case 'nedeljska_sola_mlajsa': return '👶';
    case 'nedeljska_sola_starejsa': return '🎓';
    case 'molitev_po': return '🙏';
    case 'finance': return '🪙';
    default: return '📌';
  }
};

const renderMinistryIcon = (ministry: Ministry, className = "w-4 h-4") => {
  switch (ministry.icon || ministry.id) {
    case 'Sparkles':
    case 'cistoca':
      return <Sparkles className={className} />;
    case 'Home':
    case 'zgornja_dvorana':
      return <Home className={className} />;
    case 'ClipboardCheck':
    case 'koncni_pregled':
      return <ClipboardCheck className={className} />;
    case 'Key':
    case 'Unlock':
    case 'odklepanje':
      return <Key className={className} />;
    case 'Lock':
    case 'zaklepanje':
      return <Lock className={className} />;
    case 'Coffee':
    case 'kava':
      return <Coffee className={className} />;
    case 'Flame':
    case 'barista':
      return <Flame className={className} />;
    case 'Utensils':
    case 'hrana':
      return <Utensils className={className} />;
    case 'CupSoda':
    case 'gostoljubje':
      return <CupSoda className={className} />;
    case 'HeartHandshake':
    case 'sprejem_reditelji':
      return <HeartHandshake className={className} />;
    case 'HandHelping':
    case 'uvodna_molitev_darovi':
    case 'molitev_po':
      return <HandHelping className={className} />;
    case 'BookOpen':
    case 'ucenje':
      return <BookOpen className={className} />;
    case 'Megaphone':
    case 'obvestila':
      return <Volume2 className={className} />;
    case 'MessageSquare':
    case 'pricevanja':
      return <MessageSquare className={className} />;
    case 'Music':
    case 'slavilna_ekipa':
      return <Music className={className} />;
    case 'Mic':
    case 'uvod_slavljenje':
      return <Mic className={className} />;
    case 'Sliders':
    case 'zvok':
      return <Sliders className={className} />;
    case 'Camera':
    case 'postavitev_av':
      return <Camera className={className} />;
    case 'Monitor':
    case 'besedila':
      return <Monitor className={className} />;
    case 'Video':
    case 'Tv':
    case 'youtube_prenos':
      return <Video className={className} />;
    case 'Film':
    case 'editiranje':
      return <Film className={className} />;
    case 'Smile':
    case 'nedeljska_sola_mlajsa':
      return <Smile className={className} />;
    case 'GraduationCap':
    case 'nedeljska_sola_starejsa':
      return <GraduationCap className={className} />;
    case 'Globe':
    case 'prevajanje':
      return <Globe className={className} />;
    case 'Coins':
    case 'finance':
      return <Coins className={className} />;
    case 'Wine':
    case 'gospodova_vecerja':
      return <Wine className={className} />;
    case 'molitev_druzine':
      return <HeartHandshake className={className} />;
    default:
      return <Layers className={className} />;
  }
};

export default function SundayDetail({
  sunday,
  allSundays,
  ministries,
  people,
  userRole,
  activePerson,
  translations,
  initialMinistryId,
  initialCategory,
  currentLanguage,
  worshipRoster,
  sundaySchoolLessons,
  blackoutDates,
  onBack,
  onSelectSunday,
  onUpdateSunday,
  onUpdatePerson,
  googleToken,
  onSetGoogleToken,
  onOpenVisitorModal,
  onOpenInspectionModal,
  authUser,
}: SundayDetailProps) {
  const [activeMinistryEditId, setActiveMinistryEditId] = useState<string | null>(initialMinistryId || null);
  const [newPersonInput, setNewPersonInput] = useState('');
  const [newFamilyMemberInput, setNewFamilyMemberInput] = useState('');
  const [themeSl, setThemeSl] = useState(sunday.themeSl);
  const [themeEn, setThemeEn] = useState(sunday.themeEn);
  const [guest, setGuest] = useState(sunday.guest);
  const [absentOrNotes, setAbsentOrNotes] = useState(sunday.absentOrNotes);
  const [status, setStatus] = useState(sunday.status);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isRundownModalOpen, setIsRundownModalOpen] = useState<boolean>(false);
  const [showPrayerFocus, setShowPrayerFocus] = useState<boolean>(false);
  const [selectedLeaderForContact, setSelectedLeaderForContact] = useState<Person | null>(null);
  const [showAllOtherMinistries, setShowAllOtherMinistries] = useState<boolean>(false);
  const [rosterSearchQuery, setRosterSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    if (initialCategory) return initialCategory;
    if (initialMinistryId && ministries) {
      const found = ministries.find(m => m.id === initialMinistryId);
      if (found) {
        if (['prep_clean', 'hospitality', 'service', 'worship', 'audio_video', 'kids', 'post_service'].includes(found.category)) {
          return found.category;
        }
      }
    }
    return 'all';
  });
  const [overrideMenuOpenId, setOverrideMenuOpenId] = useState<string | null>(null);
  const { queueAssignment, batches, removeQueuedItem } = useNotificationQueue();
  const [pendingRemoval, setPendingRemoval] = useState<{
    ministryId: string;
    ministryName: string;
    personName: string;
    status: AssignmentStatus;
  } | null>(null);
  const [overrideConfirmationTarget, setOverrideConfirmationTarget] = useState<{
    person: Person;
    ministryId: string;
    type: 'declined' | 'absent';
    reason?: string;
    startDate?: string;
    endDate?: string;
  } | null>(null);

  // Sync state if sunday prop updates
  React.useEffect(() => {
    setThemeSl(sunday.themeSl);
    setThemeEn(sunday.themeEn);
    setGuest(sunday.guest);
    setAbsentOrNotes(sunday.absentOrNotes);
    setStatus(sunday.status);
  }, [sunday.id, sunday.themeSl, sunday.themeEn, sunday.guest, sunday.absentOrNotes, sunday.status]);

  // Scroll and highlight target ministry if navigated from specific ministry tree
  React.useEffect(() => {
    if (initialMinistryId) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`ministry-card-${initialMinistryId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-indigo-500', 'ring-offset-2');
          setTimeout(() => {
            el.classList.remove('ring-2', 'ring-indigo-500', 'ring-offset-2');
          }, 2500);
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [initialMinistryId]);

  // Back-button interception for drawers, popups, and modal dialogs
  useBackdropHistory(!!activeMinistryEditId, () => setActiveMinistryEditId(null), 'sunday-assignment-drawer');
  useBackdropHistory(isRundownModalOpen, () => setIsRundownModalOpen(false), 'sunday-rundown-modal');
  useBackdropHistory(!!selectedLeaderForContact, () => setSelectedLeaderForContact(null), 'sunday-leader-contact-modal');
  useBackdropHistory(!!pendingRemoval, () => setPendingRemoval(null), 'sunday-pending-removal-modal');
  useBackdropHistory(!!overrideConfirmationTarget, () => setOverrideConfirmationTarget(null), 'sunday-override-confirm-modal');

  const effectiveBlackoutDates: BlackoutDate[] = blackoutDates || (() => {
    try {
      const raw = localStorage.getItem('church_roster_blackouts_v1');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  })();

  const handleStatusChange = (newStatus: 'draft' | 'ready' | 'completed') => {
    setStatus(newStatus);
    onUpdateSunday({
      ...sunday,
      status: newStatus,
      absentOrNotes
    });
  };

  const handleNotesChange = (notes: string) => {
    setAbsentOrNotes(notes);
    onUpdateSunday({
      ...sunday,
      status,
      absentOrNotes: notes
    });
  };

  const [selectedDocType, setSelectedDocType] = useState<'service_plan' | 'worship_meet' | 'briefing_sheet' | 'volunteers' | 'archive_note'>('service_plan');
  const [docLanguage, setDocLanguage] = useState<'sl' | 'en'>(currentLanguage);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState<{ id: string; url: string; title: string } | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [integrationTab, setIntegrationTab] = useState<'docs' | 'calendar' | 'chat'>('calendar');

  const isAdmin = userRole === 'Admin' || activePerson?.role === 'Admin';
  const isLeader = userRole === 'Leader' || activePerson?.role === 'Leader';
  const isServant = !isAdmin && !isLeader;
  const canEditGeneral = isAdmin || isLeader;

  // Check if current user has leader authority over a specific ministry
  const canEditMinistry = (ministryId: string) => {
    if (isAdmin) return true;
    if (isLeader && activePerson) {
      return Array.isArray(activePerson.ledMinistries) && activePerson.ledMinistries.includes(ministryId);
    }
    return false;
  };

  const triggerRemovalConfirmation = (ministryId: string, personName: string, status?: AssignmentStatus) => {
    const minObj = ministries.find(m => m.id === ministryId);
    const minName = currentLanguage === 'sl' 
      ? (minObj?.nameSl || minObj?.nameEn || ministryId) 
      : (minObj?.nameEn || minObj?.nameSl || ministryId);
    
    let resolvedStatus: AssignmentStatus = status || 'pending';
    if (!status) {
      const details = getAssignmentDetails(ministryId);
      const found = details.find(d => d.personName.toLowerCase() === personName.toLowerCase());
      if (found) resolvedStatus = found.status;
    }

    setPendingRemoval({
      ministryId,
      ministryName: minName,
      personName,
      status: resolvedStatus,
    });
  };

  const handleAddFamilyMember = (newMemberName: string) => {
    if (!activePerson || !onUpdatePerson || !newMemberName.trim()) return;
    const trimmed = newMemberName.trim();
    const currentFamily = activePerson.familyMembers || [];
    if (currentFamily.includes(trimmed)) return;

    onUpdatePerson(activePerson.id, {
      ...activePerson,
      familyMembers: [...currentFamily, trimmed]
    });
    setNewFamilyMemberInput('');
  };

  const handleGenerateGoogleDoc = async () => {
    if (!googleToken) {
      setGenerationError(currentLanguage === 'sl' ? 'Prosimo, najprej povežite Google Račun.' : 'Please connect your Google Account first.');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setGeneratedDoc(null);

    try {
      const result = await generateGoogleDoc(
        googleToken,
        sunday,
        selectedDocType,
        docLanguage,
        ministries,
        people
      );
      setGeneratedDoc(result);
    } catch (err: any) {
      console.error('Failed to create formatted Google Document:', err);
      if (err instanceof Error && (err.message.includes('401') || err.message.toUpperCase().includes('UNAUTHORIZED') || err.message.toUpperCase().includes('EXPIRED'))) {
        onSetGoogleToken(null);
        setGenerationError(currentLanguage === 'sl' 
          ? 'Seja z Google računom je potekla. Prosimo, povezavo vzpostavite znova.' 
          : 'Google session expired. Please connect again.'
        );
      } else {
        setGenerationError(currentLanguage === 'sl' 
          ? 'Napaka pri generiranju dokumenta. Poskusite ponovno.' 
          : 'Failed to generate document. Please try again.'
        );
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [googleConnectError, setGoogleConnectError] = useState<string | null>(null);
  const [showIntegrationsSection, setShowIntegrationsSection] = useState(false);

  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true);
    setGoogleConnectError(null);
    setGenerationError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/chat.spaces.readonly https://www.googleapis.com/auth/chat.messages.create',
          redirectTo: window.location.origin
        }
      });
      if (error) {
        setGoogleConnectError(error.message);
      }
    } catch (err: any) {
      console.error('Google Auth cancelled or failed:', err);
      setGoogleConnectError(err?.message || (currentLanguage === 'sl' ? 'Povezava z Google računom ni uspela.' : 'Failed to authenticate Google account.'));
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  // --- Google Calendar States ---
  const [calendarLocation, setCalendarLocation] = useState('KC Kalvarija, Celje');
  const [serviceStartTime, setServiceStartTime] = useState('10:00');
  const [serviceEndTime, setServiceEndTime] = useState('12:00');
  const [includeRehearsal, setIncludeRehearsal] = useState(false);
  const [rehearsalStartTime, setRehearsalStartTime] = useState('09:00');
  const [rehearsalEndTime, setRehearsalEndTime] = useState('09:45');
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [calendarSyncError, setCalendarSyncError] = useState<string | null>(null);
  const [calendarSyncSuccess, setCalendarSyncSuccess] = useState<string | null>(null);

  // --- Google Chat States ---
  const [chatSpaces, setChatSpaces] = useState<any[]>([]);
  const [selectedSpaceName, setSelectedSpaceName] = useState<string>('');
  const [isFetchingSpaces, setIsFetchingSpaces] = useState(false);
  const [chatMessageType, setChatMessageType] = useState<'missing_assignments' | 'status_ready' | 'roster_snapshot' | 'role_assigned'>('roster_snapshot');
  const [chatAssignedPerson, setChatAssignedPerson] = useState('');
  const [chatAssignedRole, setChatAssignedRole] = useState('');
  const [chatDraftText, setChatDraftText] = useState('');
  const [isSendingChatMessage, setIsSendingChatMessage] = useState(false);
  const [chatSyncSuccess, setChatSyncSuccess] = useState<string | null>(null);
  const [chatSyncError, setChatSyncError] = useState<string | null>(null);

  const handleSendChatMessage = async () => {
    if (!googleToken) {
      setChatSyncError(currentLanguage === 'sl' ? 'Prosimo, najprej povežite Google Račun.' : 'Please connect your Google Account first.');
      return;
    }
    if (!selectedSpaceName) {
      setChatSyncError(currentLanguage === 'sl' ? 'Prosimo, izberite Google Chat prostor.' : 'Please select a Google Chat space.');
      return;
    }
    if (!chatDraftText.trim()) {
      setChatSyncError(currentLanguage === 'sl' ? 'Besedilo sporočila ne sme biti prazno.' : 'Message content cannot be empty.');
      return;
    }

    setIsSendingChatMessage(true);
    setChatSyncError(null);
    setChatSyncSuccess(null);

    try {
      await sendChatMessage(googleToken, selectedSpaceName, chatDraftText);
      setChatSyncSuccess(currentLanguage === 'sl' 
        ? 'Sporočilo je bilo uspešno poslano v Google Chat!'
        : 'Message successfully sent to Google Chat!'
      );
    } catch (err: any) {
      console.error('Failed to send Google Chat message:', err);
      if (err instanceof Error && (err.message.includes('401') || err.message.toUpperCase().includes('UNAUTHORIZED') || err.message.toUpperCase().includes('EXPIRED'))) {
        onSetGoogleToken(null);
        setChatSyncError(currentLanguage === 'sl' 
          ? 'Seja z Google računom je potekla. Prosimo, povezavo vzpostavite znova.' 
          : 'Google session expired. Please connect again.'
        );
      } else {
        setChatSyncError(currentLanguage === 'sl' 
          ? 'Pošiljanje sporočila ni uspelo. Preverite povezavo ali poskusite znova.' 
          : 'Failed to send message. Please check connection or try again.'
        );
      }
    } finally {
      setIsSendingChatMessage(false);
    }
  };

  // Load spaces
  React.useEffect(() => {
    if (googleToken) {
      const fetchSpaces = async () => {
        setIsFetchingSpaces(true);
        setChatSyncError(null);
        try {
          const spaces = await listChatSpaces(googleToken);
          setChatSpaces(spaces);
          if (spaces.length > 0 && !selectedSpaceName) {
            setSelectedSpaceName(spaces[0].name);
          }
        } catch (err) {
          console.warn('Failed to load Google Chat spaces automatically:', err);
        } finally {
          setIsFetchingSpaces(false);
        }
      };
      fetchSpaces();
    } else {
      setChatSpaces([]);
      setSelectedSpaceName('');
    }
  }, [googleToken]);

  // Sync draft message
  React.useEffect(() => {
    const draft = buildWorkflowMessage(
      chatMessageType,
      sunday,
      ministries,
      currentLanguage,
      {
        assignedPerson: chatAssignedPerson,
        assignedRole: chatAssignedRole
      }
    );
    setChatDraftText(draft);
  }, [chatMessageType, chatAssignedPerson, chatAssignedRole, sunday, ministries, currentLanguage]);

  const handleSyncToGoogleCalendar = async () => {
    if (!googleToken) {
      setCalendarSyncError(currentLanguage === 'sl' ? 'Prosimo, najprej povežite Google Račun.' : 'Please connect your Google Account first.');
      return;
    }

    setIsSyncingCalendar(true);
    setCalendarSyncError(null);
    setCalendarSyncSuccess(null);

    try {
      // 1. Create or Update standard Sunday event
      const serviceResult = await createOrUpdateServiceEvent(
        googleToken,
        sunday,
        ministries,
        currentLanguage,
        {
          serviceStartTime,
          serviceEndTime,
          location: calendarLocation,
          existingEventId: sunday.googleEventId || null
        }
      );

      let updatedSunday: ServiceSunday = {
        ...sunday,
        googleEventId: serviceResult.eventId,
        googleEventHtmlLink: serviceResult.htmlLink
      };

      // 2. Conditionally handle Rehearsal event
      if (includeRehearsal) {
        const rehearsalResult = await createOrUpdateRehearsalEvent(
          googleToken,
          sunday,
          currentLanguage,
          {
            rehearsalStartTime,
            rehearsalEndTime,
            location: calendarLocation,
            existingEventId: sunday.googleRehearsalEventId || null
          }
        );
        updatedSunday.googleRehearsalEventId = rehearsalResult.eventId;
        updatedSunday.googleRehearsalEventHtmlLink = rehearsalResult.htmlLink;
      } else if (sunday.googleRehearsalEventId) {
        // If they had rehearsal event before but unchecked it, optionally delete it or at least de-link it
        try {
          await deleteCalendarEvent(googleToken, sunday.googleRehearsalEventId);
        } catch (e) {
          console.warn('Could not delete old rehearsal event, stripping link anyway.', e);
        }
        updatedSunday.googleRehearsalEventId = undefined;
        updatedSunday.googleRehearsalEventHtmlLink = undefined;
      }

      // 3. Persist update
      onUpdateSunday(updatedSunday);
      
      setCalendarSyncSuccess(currentLanguage === 'sl' 
        ? 'Dogodki so uspešno sinhronizirani s koledarjem!'
        : 'Events successfully synchronized to your Google Calendar!'
      );
    } catch (err: any) {
      console.error('Failed to sync to Google Calendar:', err);
      if (err instanceof Error && (err.message.includes('401') || err.message.toUpperCase().includes('UNAUTHORIZED') || err.message.toUpperCase().includes('EXPIRED'))) {
        onSetGoogleToken(null);
        setCalendarSyncError(currentLanguage === 'sl' 
          ? 'Seja z Google računom je potekla. Prosimo, povezavo vzpostavite znova.' 
          : 'Google session expired. Please connect again.'
        );
      } else {
        setCalendarSyncError(currentLanguage === 'sl' 
          ? 'Sinhronizacija s koledarjem ni uspela. Preverite povezavo ali poskusite znova.' 
          : 'Google calendar synchronization failed. Check connection or try again.'
        );
      }
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    const confirmMsg = currentLanguage === 'sl'
      ? 'Ali ste prepričani, da želite odstraniti povezavo s koledarjem in izbrisati pripadajoče dogodke?'
      : 'Are you sure you want to disconnect this Sunday from Google Calendar and delete the associated events?';
    
    if (!window.confirm(confirmMsg)) return;

    if (!googleToken) {
      setCalendarSyncError(currentLanguage === 'sl' ? 'Prosimo, najprej povežite Google Račun.' : 'Please connect your Google Account first.');
      return;
    }

    setIsSyncingCalendar(true);
    setCalendarSyncError(null);
    setCalendarSyncSuccess(null);

    try {
      // 1. Delete Service Event
      if (sunday.googleEventId) {
        await deleteCalendarEvent(googleToken, sunday.googleEventId);
      }
      // 2. Delete Rehearsal Event
      if (sunday.googleRehearsalEventId) {
        await deleteCalendarEvent(googleToken, sunday.googleRehearsalEventId);
      }

      // 3. Clear fields in database
      const updatedSunday: ServiceSunday = {
        ...sunday,
        googleEventId: undefined,
        googleEventHtmlLink: undefined,
        googleRehearsalEventId: undefined,
        googleRehearsalEventHtmlLink: undefined
      };
      onUpdateSunday(updatedSunday);

      setCalendarSyncSuccess(currentLanguage === 'sl' 
        ? 'Povezava s koledarjem je bila uspešno odstranjena in pripadajoči dogodki izbrisani.'
        : 'Successfully disconnected from Google Calendar and deleted events.'
      );
    } catch (err: any) {
      console.error('Failed to disconnect Google Calendar events:', err);
      setCalendarSyncError(currentLanguage === 'sl'
        ? 'Napaka pri brisanju dogodkov iz koledarja.'
        : 'Failed to delete events from Google Calendar.'
      );
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  // Synchronize local states when sunday props change from firestore real-time sync
  React.useEffect(() => {
    setThemeSl(sunday.themeSl);
    setThemeEn(sunday.themeEn);
    setGuest(sunday.guest);
    setAbsentOrNotes(sunday.absentOrNotes);
    setStatus(sunday.status);
  }, [sunday.id, sunday.themeSl, sunday.themeEn, sunday.guest, sunday.absentOrNotes, sunday.status]);

  const handleSaveHeaderInfo = () => {
    onUpdateSunday({
      ...sunday,
      themeSl,
      themeEn,
      guest,
      absentOrNotes,
      status,
    });
    setSuccessToast(currentLanguage === 'sl' ? "Opombe in stanje uspešno posodobljeni!" : "Service details updated successfully!");
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Auto-hydrate & persist missing confirmation tokens so WhatsApp/Messenger/Chat share links are ALWAYS in DB
  React.useEffect(() => {
    if (!sunday || !ministries || ministries.length === 0) return;
    let needsUpdate = false;
    const currentDetailsMap = { ...(sunday.assignmentDetails || {}) };

    ministries.forEach(m => {
      const names = resolveMinistryAssignments(sunday, m.id, worshipRoster);
      if (names.length === 0) return;

      const currentList = currentDetailsMap[m.id] || [];
      const updatedList: MinistryAssignment[] = [];
      let ministryChanged = false;

      names.forEach(name => {
        const existing = currentList.find(d => d.personName.toLowerCase().trim() === name.toLowerCase().trim());
        if (existing) {
          if (!existing.confirmationToken) {
            ministryChanged = true;
            updatedList.push({
              ...existing,
              confirmationToken: generateConfirmationToken(sunday.id, m.id, name),
            });
          } else {
            updatedList.push(existing);
          }
        } else {
          ministryChanged = true;
          updatedList.push({
            personName: name,
            status: 'confirmed',
            notes: '',
            assignedByLeaderId: activePerson?.id || '',
            assignedByLeaderName: activePerson?.name || 'Vodja službe',
            assignedAt: new Date().toISOString(),
            confirmationToken: generateConfirmationToken(sunday.id, m.id, name),
          });
        }
      });

      if (ministryChanged || updatedList.length !== currentList.length) {
        currentDetailsMap[m.id] = updatedList;
        needsUpdate = true;
      }
    });

    if (needsUpdate) {
      onUpdateSunday({
        ...sunday,
        assignmentDetails: currentDetailsMap,
      });
    }
  }, [sunday.id, sunday.assignments, worshipRoster, ministries]);

  const getAssignmentDetails = (ministryId: string): MinistryAssignment[] => {
    const names = resolveMinistryAssignments(sunday, ministryId, worshipRoster);
    const details = sunday.assignmentDetails?.[ministryId] || [];
    return names.map(name => {
      const existing = details.find(d => d.personName.toLowerCase().trim() === name.toLowerCase().trim());
      if (existing) {
        if (!existing.confirmationToken) {
          return { ...existing, confirmationToken: generateConfirmationToken(sunday.id, ministryId, name) };
        }
        return existing;
      }
      return { 
        personName: name, 
        status: 'confirmed', 
        notes: '',
        confirmationToken: generateConfirmationToken(sunday.id, ministryId, name)
      };
    });
  };

  const handleUpdateAssignmentDetails = (ministryId: string, updatedDetails: MinistryAssignment[]) => {
    const updatedNames = updatedDetails.map(d => d.personName);
    const updatedSunday: ServiceSunday = {
      ...sunday,
      assignments: {
        ...sunday.assignments,
        [ministryId]: updatedNames,
      },
      assignmentDetails: {
        ...(sunday.assignmentDetails || {}),
        [ministryId]: updatedDetails,
      }
    };
    onUpdateSunday(updatedSunday);
  };

  // --- Recurring Series Multi-Week States ---
  const [enableSeries, setEnableSeries] = useState(false);
  const [seriesWeekCount, setSeriesWeekCount] = useState<number>(5);

  const handleAddAssignment = (ministryId: string, personOrName: string | Person, skipNotification = false) => {
    let resolvedName = '';
    let matchedRosterPerson: Person | undefined = undefined;

    if (typeof personOrName === 'object' && personOrName !== null) {
      resolvedName = personOrName.name.trim();
      matchedRosterPerson = personOrName;
    } else {
      const rawStr = typeof personOrName === 'string' ? personOrName : ((personOrName as Person)?.name || '');
      const trimmed = rawStr.trim();
      if (!trimmed) return;
      matchedRosterPerson = (people || []).find(p => p && p.name && p.name.toLowerCase() === trimmed.toLowerCase());
      resolvedName = matchedRosterPerson ? matchedRosterPerson.name : trimmed;
    }

    if (!resolvedName) return;

    if (enableSeries) {
      const batchItems = batchAssignPersonToConsecutiveSundays({
        allSundays,
        startSundayId: sunday.id,
        ministryId,
        personName: resolvedName,
        weekCount: seriesWeekCount,
        leaderId: activePerson?.id || '',
        leaderName: activePerson?.name || 'Vodja službe',
        onUpdateSunday
      });

      if (matchedRosterPerson?.email) {
        const minObj = ministries.find(m => m.id === ministryId);
        const minName = minObj ? (currentLanguage === 'sl' ? minObj.nameSl : minObj.nameEn) : ministryId;
        const leaderName = activePerson?.name || 'Vodja službe';

        batchItems.forEach(item => {
          queueAssignment({
            volunteerName: resolvedName,
            volunteerEmail: matchedRosterPerson.email,
            leaderName,
            sundayDate: item.sundayDate,
            ministryId,
            ministryName: minName,
            token: item.token,
          });
        });

        setSuccessToast(currentLanguage === 'sl' 
          ? `✓ Serija dodeljena! ⏳ ${batchItems.length} terminov dodanih v čakalno vrsto (10 min).` 
          : `✓ Series assigned! ⏳ ${batchItems.length} dates queued (10 min).`
        );
        setTimeout(() => setSuccessToast(null), 4000);
      } else {
        setSuccessToast(currentLanguage === 'sl' 
          ? `ℹ️ Serija dodeljena. Sodelavec ${resolvedName} nima vpisanega e-poštnega naslova (uporabite WhatsApp/FB).` 
          : `ℹ️ Series assigned. ${resolvedName} has no email configured (use WhatsApp/FB).`
        );
        setTimeout(() => setSuccessToast(null), 5000);
      }
    } else {
      const currentDetails = getAssignmentDetails(ministryId);
      if (currentDetails.some(d => d.personName.toLowerCase() === resolvedName.toLowerCase())) return;

      const isSelfAssign = activePerson && (resolvedName.toLowerCase() === activePerson.name.toLowerCase());
      const token = generateConfirmationToken(sunday.id, ministryId, resolvedName);

      const newDetail: MinistryAssignment = {
        personName: resolvedName,
        status: isSelfAssign ? 'confirmed' : 'pending',
        notes: '',
        assignedByLeaderId: activePerson?.id || '',
        assignedByLeaderName: activePerson?.name || 'Vodja službe',
        assignedAt: new Date().toISOString(),
        confirmationToken: token,
      };

      handleUpdateAssignmentDetails(ministryId, [...currentDetails, newDetail]);

      if (isSelfAssign) {
        setSuccessToast(currentLanguage === 'sl' ? '✓ Uspešno prijavljeni na to službo!' : '✓ Successfully signed up!');
        setTimeout(() => setSuccessToast(null), 3000);
      } else if (!skipNotification && matchedRosterPerson?.email) {
        const minObj = ministries.find(m => m.id === ministryId);
        const minName = minObj ? (currentLanguage === 'sl' ? minObj.nameSl : minObj.nameEn) : ministryId;
        
        queueAssignment({
          volunteerName: resolvedName,
          volunteerEmail: matchedRosterPerson.email,
          leaderName: activePerson?.name || 'Vodja službe',
          sundayId: sunday.id,
          sundayDate: sunday.date,
          ministryId,
          ministryName: minName,
          token,
        });

        setSuccessToast(currentLanguage === 'sl' 
          ? `⏳ Obvestilo za ${resolvedName} dodano v čakalno vrsto (10 min).` 
          : `⏳ Notification for ${resolvedName} queued (10 min).`
        );
        setTimeout(() => setSuccessToast(null), 3500);
      } else if (!skipNotification) {
        // Person without email
        setSuccessToast(currentLanguage === 'sl' 
          ? `ℹ️ Sodelavec ${resolvedName} nima vpisanega e-poštnega naslova (lahko uporabite WhatsApp/FB).` 
          : `ℹ️ ${resolvedName} has no email configured (you can use WhatsApp/FB).`
        );
        setTimeout(() => setSuccessToast(null), 4000);
      }
    }
    setNewPersonInput('');
  };

  const handleCandidateClick = (
    person: Person,
    ministryId: string,
    isChosen: boolean,
    isUnavailable: boolean,
    isDeclined: boolean,
    isAbsent: boolean,
    declineReason?: string,
    absenceReason?: string,
    absenceStartDate?: string,
    absenceEndDate?: string
  ) => {
    if (isChosen) {
      triggerRemovalConfirmation(ministryId, person.name);
      return;
    }

    if (isUnavailable) {
      if (isDeclined) {
        setOverrideConfirmationTarget({
          person,
          ministryId,
          type: 'declined',
          reason: declineReason,
        });
        return;
      } else if (isAbsent) {
        setOverrideConfirmationTarget({
          person,
          ministryId,
          type: 'absent',
          reason: absenceReason,
          startDate: absenceStartDate,
          endDate: absenceEndDate,
        });
        return;
      }
    }

    handleAddAssignment(ministryId, person);
  };

  const handleConfirmOverrideAssignment = () => {
    if (!overrideConfirmationTarget) return;
    const { person, ministryId } = overrideConfirmationTarget;
    handleAddAssignment(ministryId, person);
    setOverrideConfirmationTarget(null);
  };

  const handleRemoveAssignment = (ministryId: string, personName: string) => {
    const currentDetails = getAssignmentDetails(ministryId);
    const updated = currentDetails.filter((d) => d.personName !== personName);
    handleUpdateAssignmentDetails(ministryId, updated);

    // Also cancel queued notification if it's currently waiting in grace period
    const matchedPerson = (people || []).find(p => p && p.name && p.name.toLowerCase() === personName.toLowerCase());
    if (matchedPerson?.email) {
      const emailKey = matchedPerson.email.toLowerCase().trim();
      const batch = batches[emailKey];
      if (batch && Array.isArray(batch.items)) {
        batch.items.forEach(item => {
          if ((item.sundayDate.trim() === sunday.date.trim() || (item.sundayId && item.sundayId === sunday.id)) && item.ministryId === ministryId) {
            removeQueuedItem(matchedPerson.email, item.id);
          }
        });
      }
    }
  };

  const handleSetStatus = (ministryId: string, personName: string, newStatus: 'pending' | 'confirmed' | 'declined') => {
    const currentDetails = getAssignmentDetails(ministryId);
    const updated = currentDetails.map(d => {
      if (d.personName === personName) {
        return {
          ...d,
          status: newStatus,
          responseAt: new Date().toISOString(),
        };
      }
      return d;
    });
    handleUpdateAssignmentDetails(ministryId, updated);
  };

  const handleToggleStatus = (ministryId: string, personName: string) => {
    const currentDetails = getAssignmentDetails(ministryId);
    const updated = currentDetails.map(d => {
      if (d.personName === personName) {
        const nextStatus: AssignmentStatus = d.status === 'confirmed' ? 'pending' : 'confirmed';
        return {
          ...d,
          status: nextStatus,
        };
      }
      return d;
    });
    handleUpdateAssignmentDetails(ministryId, updated);
  };

  const handleDuplicateFromPrevious = () => {
    const sortedSundays = [...allSundays].sort((a, b) => {
      return parseEuropeanDate(a.date).getTime() - parseEuropeanDate(b.date).getTime();
    });

    const currentIndex = sortedSundays.findIndex((s) => s.id === sunday.id);
    if (currentIndex > 0) {
      const previousSunday = sortedSundays[currentIndex - 1];
      if (confirm(currentLanguage === 'sl' 
        ? `Ali želite prekopirati vse zadolžitve iz prejšnje nedeljske službe (${previousSunday.date})?` 
        : `Do you want to copy all assignments from the previous Sunday service (${previousSunday.date})?`
      )) {
        onUpdateSunday({
          ...sunday,
          assignments: { ...previousSunday.assignments },
        });
      }
    } else {
      alert(currentLanguage === 'sl' 
        ? "Ni najti prejšnje nedelje za kopiranje." 
        : "No previous Sunday found to copy from."
      );
    }
  };

  const volunteerLoadMap: Record<string, { totalLoad: number; assignedCount: number; duties: string[] }> = {};

  Object.entries(sunday.assignments || {}).forEach(([ministryId, names]) => {
    if (!Array.isArray(names) || names.length === 0) return;
    const isLight = isLightweightDuty(ministryId, ministries);
    const minObj = (ministries || []).find(m => m.id === ministryId);
    const dutyLabel = minObj ? (currentLanguage === 'sl' ? minObj.nameSl : minObj.nameEn) : ministryId;

    names.forEach((name) => {
      const cleanName = (name || '').trim();
      if (!cleanName || cleanName === '/' || cleanName.toLowerCase() === 'all') return;

      if (!volunteerLoadMap[cleanName]) {
        volunteerLoadMap[cleanName] = { totalLoad: 0, assignedCount: 0, duties: [] };
      }
      volunteerLoadMap[cleanName].totalLoad += isLight ? 0.5 : 1.0;
      volunteerLoadMap[cleanName].assignedCount += 1;
      volunteerLoadMap[cleanName].duties.push(dutyLabel);
    });
  });

  const overloadedVolunteers = Object.entries(volunteerLoadMap)
    .filter(([name, data]) => data.totalLoad > 3.0 && !isExemptFromBurnout(name, people))
    .map(([name, data]) => ({
      name,
      totalLoad: data.totalLoad,
      assignedCount: data.assignedCount,
      duties: data.duties,
    }));

  const coverageStats = getSundayCoverageStats(sunday, ministries, worshipRoster);
  const coveredCount = coverageStats.filledRequired;

  const sortedSundays = [...allSundays].sort((a, b) => {
    return parseEuropeanDate(a.date).getTime() - parseEuropeanDate(b.date).getTime();
  });

  const currentSundayIndex = sortedSundays.findIndex(s => s.id === sunday.id);
  const previousSunday = currentSundayIndex > 0 ? sortedSundays[currentSundayIndex - 1] : null;
  const nextSunday = currentSundayIndex >= 0 && currentSundayIndex < sortedSundays.length - 1 ? sortedSundays[currentSundayIndex + 1] : null;

  return (
    <div id="sunday-detail-screen" className="w-full">
      <div className="w-full space-y-4 pb-16 animate-fade-in">
        
        {/* 1. TOP HERO HEADER & CONTAINER ALIGNMENT (#034C3C Deep Green Gradient) */}
        <HeroHeaderBanner
          variant="schedule"
          eyebrow={currentLanguage === 'sl' ? '📍 KCK NEDELJSKO BOGOSLUŽJE' : '📍 KCK SUNDAY SERVICE'}
          title={currentLanguage === 'sl' ? `Nedelja, ${sunday.date}` : `Sunday, ${sunday.date}`}
          subtitle={currentLanguage === 'sl' ? 'Razpored služb, pokritost dežurstev in koordinacija ekipe' : 'Sunday service team roster & coverage status'}
          icon={Calendar}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onBack}
                id="btn-back-to-schedule"
                className="px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white font-semibold text-xs rounded-xl border border-white/20 transition flex items-center gap-1.5 cursor-pointer backdrop-blur-xs shadow-2xs active:scale-95"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{currentLanguage === 'sl' ? 'Vse nedelje' : 'Back'}</span>
              </button>

              {previousSunday && onSelectSunday && (
                <button
                  type="button"
                  onClick={() => onSelectSunday(previousSunday.id)}
                  className="px-3 py-2 bg-white/15 hover:bg-white/25 text-white font-semibold text-xs rounded-xl border border-white/20 transition flex items-center gap-1 cursor-pointer backdrop-blur-xs shadow-2xs active:scale-95"
                  title={currentLanguage === 'sl' ? `Prejšnja nedelja: ${previousSunday.date}` : `Previous Sunday: ${previousSunday.date}`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">{currentLanguage === 'sl' ? 'Prejšnja' : 'Previous'}</span>
                </button>
              )}

              {nextSunday && onSelectSunday && (
                <button
                  type="button"
                  onClick={() => onSelectSunday(nextSunday.id)}
                  className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl border border-emerald-400/50 transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                  title={currentLanguage === 'sl' ? `Naslednja nedelja: ${nextSunday.date}` : `Next Sunday: ${nextSunday.date}`}
                >
                  <span>{currentLanguage === 'sl' ? 'Naslednja nedelja' : 'Next Sunday'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {canEditGeneral && (
                <button
                  onClick={handleDuplicateFromPrevious}
                  className="px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white font-semibold text-xs rounded-xl border border-white/20 transition flex items-center gap-1.5 cursor-pointer backdrop-blur-xs shadow-2xs active:scale-95"
                  title={translations.duplicateWeek}
                >
                  <Copy className="w-4 h-4" />
                  <span className="hidden md:inline">{currentLanguage === 'sl' ? 'Kloniraj prejšnjo' : 'Duplicate Previous'}</span>
                </button>
              )}

              {canEditGeneral ? (
                <select
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value as any)}
                  className="px-3 py-2 bg-white text-emerald-950 font-bold text-xs rounded-xl border border-white/30 transition cursor-pointer font-mono shadow-2xs focus:outline-none"
                >
                  <option value="draft">⚠️ {currentLanguage === 'sl' ? 'Osnutek' : 'Draft Schedule'}</option>
                  <option value="ready">✅ {currentLanguage === 'sl' ? 'Pripravljeno' : 'Ready'}</option>
                  <option value="completed">📁 {currentLanguage === 'sl' ? 'Zaključeno' : 'Completed'}</option>
                </select>
              ) : (
                <span className="text-xs font-mono font-bold px-3 py-1.5 bg-white/15 rounded-xl border border-white/20">
                  {status === 'ready' ? `✅ ${translations.statusReady}` : status === 'draft' ? `⚠️ ${translations.statusDraft}` : `📁 ${translations.statusCompleted}`}
                </span>
              )}
            </div>
          }
        />

        {/* Assignment Removal Confirmation Modal */}
        {pendingRemoval && (
          <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="flex items-start gap-3.5">
                <div className={`p-2.5 rounded-full shrink-0 ${
                  pendingRemoval.status === 'confirmed'
                    ? 'bg-rose-100 text-rose-600'
                    : pendingRemoval.status === 'pending'
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="space-y-1.5 text-slate-800">
                  <h3 className="font-bold text-base font-sans">
                    {currentLanguage === 'sl' ? 'Potrditev odstranitve' : 'Confirm Removal'}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {pendingRemoval.status === 'pending' ? (
                      currentLanguage === 'sl'
                        ? `⚠️ Oseba ${pendingRemoval.personName} je še v čakanju in še ni odgovorila na e-poštno povabilo. Ali jo res želite odstraniti iz službe ${pendingRemoval.ministryName}?`
                        : `⚠️ ${pendingRemoval.personName} is still pending and has not answered the email invitation yet. Are you sure you want to remove them from ${pendingRemoval.ministryName}?`
                    ) : pendingRemoval.status === 'confirmed' ? (
                      currentLanguage === 'sl'
                        ? `🚨 Oseba ${pendingRemoval.personName} je že POTRDILA svojo udeležbo! Ali ste prepričani, da jo želite odstraniti iz službe ${pendingRemoval.ministryName}?`
                        : `🚨 ${pendingRemoval.personName} has already CONFIRMED their participation! Are you sure you want to remove them from ${pendingRemoval.ministryName}?`
                    ) : (
                      currentLanguage === 'sl'
                        ? `Ali želite odstraniti osebo ${pendingRemoval.personName} iz službe ${pendingRemoval.ministryName}?`
                        : `Do you want to remove ${pendingRemoval.personName} from ${pendingRemoval.ministryName}?`
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => setPendingRemoval(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  {currentLanguage === 'sl' ? 'Prekliči' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleRemoveAssignment(pendingRemoval.ministryId, pendingRemoval.personName);
                    setSuccessToast(currentLanguage === 'sl' 
                      ? `✓ Oseba ${pendingRemoval.personName} je bila odstranjena.` 
                      : `✓ ${pendingRemoval.personName} was removed.`
                    );
                    setTimeout(() => setSuccessToast(null), 3500);
                    setPendingRemoval(null);
                  }}
                  className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{currentLanguage === 'sl' ? 'Odstrani iz službe' : 'Remove from ministry'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Unavailable Volunteer Override Confirmation Modal */}
        {overrideConfirmationTarget && (
          <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="flex items-start gap-3.5">
                <div className={`p-2.5 rounded-full shrink-0 ${
                  overrideConfirmationTarget.type === 'declined'
                    ? 'bg-rose-100 text-rose-600'
                    : 'bg-amber-100 text-amber-600'
                }`}>
                  {overrideConfirmationTarget.type === 'declined' ? (
                    <AlertTriangle className="w-6 h-6" />
                  ) : (
                    <span className="text-xl">🌴</span>
                  )}
                </div>
                <div className="space-y-1.5 text-slate-800">
                  <h3 className="font-bold text-base font-sans">
                    {overrideConfirmationTarget.type === 'declined'
                      ? (currentLanguage === 'sl' ? 'Opozorilo: Zavrnjen termin' : 'Warning: Declined Assignment')
                      : (currentLanguage === 'sl' ? 'Opozorilo: Odsotnost / Dopust' : 'Warning: Absence / Vacation')}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {overrideConfirmationTarget.type === 'declined' ? (
                      currentLanguage === 'sl'
                        ? `⚠️ Oseba ${overrideConfirmationTarget.person.name} je že ZAVRNILA sodelovanje za ta termin (${sunday.date})${overrideConfirmationTarget.reason ? `: "${overrideConfirmationTarget.reason}"` : ''}. Ali jo res želite kljub temu dodati?`
                        : `⚠️ ${overrideConfirmationTarget.person.name} has already DECLINED this assignment for (${sunday.date})${overrideConfirmationTarget.reason ? `: "${overrideConfirmationTarget.reason}"` : ''}. Are you sure you want to add them anyway?`
                    ) : (
                      currentLanguage === 'sl'
                        ? `🌴 Oseba ${overrideConfirmationTarget.person.name} je na dopustu (${formatEuropeanDateRange(overrideConfirmationTarget.startDate, overrideConfirmationTarget.endDate, 'do')})${overrideConfirmationTarget.reason ? `: "${overrideConfirmationTarget.reason}"` : ''}. Ali jo res želite dodati?`
                        : `🌴 ${overrideConfirmationTarget.person.name} is on vacation (${formatEuropeanDateRange(overrideConfirmationTarget.startDate, overrideConfirmationTarget.endDate, 'to')})${overrideConfirmationTarget.reason ? `: "${overrideConfirmationTarget.reason}"` : ''}. Are you sure you want to add them?`
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => setOverrideConfirmationTarget(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  {currentLanguage === 'sl' ? 'Prekliči' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmOverrideAssignment}
                  className={`px-4 py-2 text-sm font-bold text-white rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 ${
                    overrideConfirmationTarget.type === 'declined'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  <span>{currentLanguage === 'sl' ? 'Vseeno dodaj' : 'Add anyway'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Notice Toast (Fixed High Z-Index on top of all drawers/modals) */}
        {successToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] max-w-md w-[90%] shadow-2xl rounded-xl p-4 bg-slate-900 text-white border border-slate-700 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300">
            <div className="text-sm font-medium leading-snug flex items-center gap-2.5">
              <span>{successToast}</span>
            </div>
            <button 
              type="button" 
              onClick={() => setSuccessToast(null)}
              className="text-slate-400 hover:text-white p-1 text-sm font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* 2. COMPACT GENERAL NOTES CARD (No theme/guest bloat) */}
        <div id="core-info-panel" className="p-4 bg-white rounded-2xl shadow-xs border border-gray-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 font-mono flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-700" />
              <span>{currentLanguage === 'sl' ? 'Odsotnosti in posebne opombe' : 'Absences & Setup Notes'}</span>
            </label>
            <span className="text-[10px] font-mono font-bold text-gray-400">
              {currentLanguage === 'sl' ? 'Samodejno shranjeno' : 'Auto-saved'}
            </span>
          </div>

          <textarea
            value={absentOrNotes || ''}
            onChange={(e) => handleNotesChange(e.target.value)}
            disabled={!canEditGeneral}
            rows={2}
            placeholder={currentLanguage === 'sl' ? 'Vnesite odsotnosti sodelavcev oz. posebna navodila za nedeljsko ekipo...' : 'Enter team member absences or special setup notes for Sunday...'}
            className="w-full text-xs px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 disabled:opacity-75 disabled:bg-gray-50 resize-none font-sans"
          />
        </div>

        {/* 3. SLEEK SUB-NAVIGATION TOOLBAR SWITCHER */}
        <div className="bg-white border border-gray-200 rounded-2xl p-2 shadow-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setShowPrayerFocus(false)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                !showPrayerFocus 
                  ? 'bg-[#034C3C] text-white shadow-2xs' 
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>{currentLanguage === 'sl' ? '👥 Razpored služb' : '👥 Ministry Roster'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsRundownModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-violet-50 hover:bg-violet-100 text-violet-900 border border-violet-200 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Music className="w-4 h-4 text-violet-700" />
              <span>{currentLanguage === 'sl' ? '🎵 Potek & Pesmi' : '🎵 Setlist & Rundown'}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-violet-200/80 text-violet-950 rounded-full font-bold">
                {sunday.worshipSetlist ? `${sunday.worshipSetlist.length}` : '2'}
              </span>
            </button>

            {canAccessPersonalData(userRole) && onOpenVisitorModal && (
              <button
                type="button"
                onClick={onOpenVisitorModal}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Coffee className="w-4 h-4 text-amber-800" />
                <span>{currentLanguage === 'sl' ? '☕ Obiskovalci & Kava' : '☕ Visitors & Coffee'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowPrayerFocus(!showPrayerFocus)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                showPrayerFocus
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border border-indigo-200'
              }`}
            >
              <HeartHandshake className="w-4 h-4 text-indigo-700" />
              <span>{currentLanguage === 'sl' ? '🕊️ Molitveni poudarek' : '🕊️ Prayer Focus'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-xl border border-gray-150 text-[11px] font-mono font-semibold text-gray-600">
            <span>{coverageStats.filledRequired} / {coverageStats.totalRequired} {currentLanguage === 'sl' ? 'obveznih pokritih' : 'required covered'}</span>
            {coverageStats.optionalMinistries.length > 0 && (
              <span className="text-[10px] text-slate-400 font-sans font-normal border-l border-gray-200 pl-2">
                +{coverageStats.filledApplicable - coverageStats.filledRequired} {currentLanguage === 'sl' ? 'opcijsko' : 'optional'}
              </span>
            )}
          </div>
        </div>

        {/* Optional inline Prayer Focus section */}
        {showPrayerFocus && (
          <div className="animate-fade-in">
            <SpecialSundayFocusSection
              sunday={sunday}
              people={people}
              canEdit={canEditGeneral}
              currentLanguage={currentLanguage}
              onUpdateSunday={onUpdateSunday}
              activePersonName={activePerson?.name || 'Služabnik'}
            />
          </div>
        )}

        {/* Full Coverage Suggestion Banner for Draft Sundays */}
        {status === 'draft' && coverageStats.isFullyCovered && canEditGeneral && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-2xl p-3 sm:p-3.5 px-4 flex flex-wrap items-center justify-between gap-3 shadow-xs animate-in fade-in duration-300">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🎉</span>
              <div>
                <span className="font-bold text-xs sm:text-sm block text-emerald-900">
                  {currentLanguage === 'sl' ? 'Vse službe so pokrite!' : 'All ministries are 100% covered!'}
                </span>
                <span className="text-[11px] text-emerald-700 font-sans">
                  {currentLanguage === 'sl' 
                    ? 'Ekipa je sestavljena. Želite razpored označiti kot "Pripravljeno"?' 
                    : 'The roster is complete. Would you like to mark this schedule as "Ready"?'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleStatusChange('ready')}
              className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition text-xs shadow-xs cursor-pointer shrink-0 flex items-center gap-1.5 active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{currentLanguage === 'sl' ? 'Označi kot Pripravljeno' : 'Mark as Ready'}</span>
            </button>
          </div>
        )}

        {overloadedVolunteers.length > 0 && (
          <div id="overload-alert-banner" className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">
                {currentLanguage === 'sl'
                  ? '⚠️ Opozorilo o visoki obremenitvi (več kot 3 polne zadolžitve na ta dan):'
                  : '⚠️ High workload warning (more than 3 full duties on this day):'}
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {overloadedVolunteers.map(({ name, totalLoad, duties }) => (
                  <span
                    key={name}
                    title={duties.join(', ')}
                    className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md font-mono font-bold text-[10px] cursor-help shadow-2xs transition hover:bg-amber-200"
                  >
                    {name} ({totalLoad}x)
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* List of Ministries Stacked as Cards */}
        {(() => {
          const categories = [
            { id: 'all', labelSl: 'Vse skupine', labelEn: 'All Areas' },
            { id: 'cleaning', labelSl: 'Priprava & Čiščenje', labelEn: 'Setup & Cleaning' },
            { id: 'hospitality', labelSl: 'Gostoljubje & Kava', labelEn: 'Hospitality & Snacks' },
            { id: 'sermon_prayer', labelSl: 'Bogoslužje', labelEn: 'Main Service' },
            { id: 'worship', labelSl: 'Slavljenje', labelEn: 'Worship' },
            { id: 'audio_video', labelSl: 'Avdio Video', labelEn: 'Audio Video' },
            { id: 'kids', labelSl: 'Nedeljska šola', labelEn: 'Sunday School' },
            { id: 'post_service', labelSl: 'Po bogoslužju', labelEn: 'Post-Service' },
          ];

          const applicableMinistriesList = getApplicableMinistriesForSunday(ministries, sunday);
          const filteredMinistries = selectedCategory === 'all'
            ? applicableMinistriesList
            : applicableMinistriesList.filter(m => {
                if (m.category === selectedCategory) return true;
                if (selectedCategory === 'post_service' && m.category === 'other') return true;
                if (selectedCategory === 'worship' && m.category === 'av_tech' && (m.id === 'slavilna_ekipa' || m.id === 'uvod_slavljenje' || m.id === 'zvok')) return true;
                if (selectedCategory === 'audio_video' && m.category === 'av_tech' && (m.id !== 'slavilna_ekipa' && m.id !== 'uvod_slavljenje' && m.id !== 'zvok')) return true;
                return false;
              });

          const isMyDuty = (mId: string) => {
            if (!activePerson) return false;
            const assignedList = sunday.assignments[mId] || [];
            const isMe = assignedList.includes(activePerson.name);
            const isFam = (activePerson.familyMembers || []).some(fam => assignedList.includes(fam));
            return isMe || isFam;
          };

          const mySignedUpMinistries = filteredMinistries.filter(m => isMyDuty(m.id));
          const otherAvailableMinistries = filteredMinistries.filter(m => !isMyDuty(m.id));

          const renderMinistryCard = (ministry: Ministry) => {
            const assignmentDetailsList = getAssignmentDetails(ministry.id);
            const assignedPeople = assignmentDetailsList.map(d => d.personName);
            const isAssigned = assignedPeople.length > 0;
            const isEditingThis = activeMinistryEditId === ministry.id;
            const hasLeaderAuthority = canEditMinistry(ministry.id);

            const ministryLeaders = people.filter(p => p && (p.role === 'Leader' || p.role === 'Admin') && p.ledMinistries?.includes(ministry.id));

            const isMeAssigned = activePerson ? assignedPeople.includes(activePerson.name) : false;
            const myFamilyMembers = activePerson?.familyMembers || [];

            const getCategorySideBorderClass = (cat: string) => {
              switch (cat) {
                case 'cleaning': return 'border-l-4 border-l-amber-400';
                case 'hospitality': return 'border-l-4 border-l-rose-400';
                case 'sermon_prayer': return 'border-l-4 border-l-sky-400';
                case 'worship':
                case 'av_tech': return 'border-l-4 border-l-purple-400';
                case 'audio_video': return 'border-l-4 border-l-cyan-500';
                case 'kids': return 'border-l-4 border-l-emerald-400';
                case 'post_service':
                case 'other':
                default: return 'border-l-4 border-l-indigo-400';
              }
            };
            const cardBorderClass = getCategorySideBorderClass(ministry.category);

            return (
              <div
                key={ministry.id}
                id={`ministry-card-${ministry.id}`}
                className={`bg-white rounded-xl shadow-[0_2px_4px_rgba(0,0,0,0.01)] border border-gray-200 transition duration-150 ${cardBorderClass}`}
              >
                <div 
                  className={`p-4 flex items-start justify-between gap-2 ${hasLeaderAuthority ? 'cursor-pointer' : 'cursor-default'}`}
                  onClick={() => hasLeaderAuthority && setActiveMinistryEditId(isEditingThis ? null : ministry.id)}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-2xs ${
                        ministry.category === 'cleaning' ? 'bg-amber-100/80 text-amber-800 border border-amber-200/80' :
                        ministry.category === 'hospitality' ? 'bg-rose-100/80 text-rose-800 border border-rose-200/80' :
                        ministry.category === 'sermon_prayer' ? 'bg-sky-100/80 text-sky-800 border border-sky-200/80' :
                        (ministry.category === 'worship' || ministry.category === 'av_tech') ? 'bg-purple-100/80 text-purple-800 border border-purple-200/80' :
                        ministry.category === 'audio_video' ? 'bg-cyan-100/80 text-cyan-800 border border-cyan-200/80' :
                        ministry.category === 'kids' ? 'bg-emerald-100/80 text-emerald-800 border border-emerald-200/80' :
                        'bg-indigo-100/80 text-indigo-800 border border-indigo-200/80'
                      }`}>
                        {renderMinistryIcon(ministry, "w-4 h-4")}
                      </div>
                      <h4 className="font-display font-bold text-xs uppercase tracking-wide text-gray-800">
                        {currentLanguage === 'sl' ? ministry.nameSl : ministry.nameEn}
                      </h4>
                      {ministry.isOptional && (
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {currentLanguage === 'sl' ? 'Opcijsko' : 'Optional'}
                        </span>
                      )}

                      {(() => {
                        const groupKey = ministry.id === 'nedeljska_sola_mlajsa' ? 'mlajsa' : ministry.id === 'nedeljska_sola_starejsa' ? 'starejsa' : null;
                        const lesson = groupKey ? getSundaySchoolLesson(sunday, groupKey, sundaySchoolLessons) : null;
                        if (!lesson?.topicSl) return null;
                        return (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded-md border border-emerald-200">
                            📖 Tema: {lesson.topicSl}
                          </span>
                        );
                      })()}
                      {ministryLeaders.length > 0 && ministryLeaders.map((leader, lIdx) => (
                        <div
                          key={`${leader.id || leader.name}-${lIdx}`}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold bg-indigo-50/90 text-indigo-900 px-2 py-0.5 rounded-md border border-indigo-200/80 shadow-2xs"
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLeaderForContact(leader);
                            }}
                            className="hover:text-indigo-600 transition cursor-pointer flex items-center gap-1 font-mono"
                            title={currentLanguage === 'sl' ? `Odpri kontaktno kartico: ${leader.name}` : `View contact details: ${leader.name}`}
                          >
                            <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                            <span>{currentLanguage === 'sl' ? 'Vodja:' : 'Leader:'} {leader.name}</span>
                          </button>

                          {canViewPersonContactInfo(userRole, undefined, leader) && (
                            <div className="flex items-center gap-1 pl-1 border-l border-indigo-200 ml-0.5">
                              {leader.phone && (
                                <a
                                  href={`tel:${leader.phone.replace(/\s+/g, '')}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-0.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 rounded transition cursor-pointer"
                                  title={currentLanguage === 'sl' ? `Pokliči: ${leader.phone}` : `Call: ${leader.phone}`}
                                >
                                  <Phone className="w-3 h-3" />
                                </a>
                              )}
                              {leader.phone && (
                                <a
                                  href={`https://wa.me/${leader.phone.replace(/[^0-9]/g, '').replace(/^0/, '386')}?text=${encodeURIComponent(`Živjo ${leader.name}! 👋`)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-0.5 text-sky-600 hover:text-sky-800 hover:bg-sky-100 rounded transition cursor-pointer"
                                  title={currentLanguage === 'sl' ? 'Pošlji WhatsApp / SMS' : 'Send WhatsApp / SMS'}
                                >
                                  <MessageSquare className="w-3 h-3" />
                                </a>
                              )}
                              {leader.email && (
                                <a
                                  href={`mailto:${leader.email}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-0.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 rounded transition cursor-pointer"
                                  title={currentLanguage === 'sl' ? `Pošlji e-pošto: ${leader.email}` : `Email: ${leader.email}`}
                                >
                                  <Mail className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {isAssigned ? (
                        getAssignmentDetails(ministry.id).map((detail, idx) => {
                          const isConfirmed = detail.status === 'confirmed';
                          const isPending = detail.status === 'pending' || detail.status === 'tentative';
                          const isDeclined = detail.status === 'declined';
                          const isMeOrFamily = activePerson && (detail.personName === activePerson.name || myFamilyMembers.includes(detail.personName));
                          
                          let badgeClasses = 'bg-amber-50 text-amber-900 border-amber-300';
                          if (isConfirmed) {
                            badgeClasses = 'bg-emerald-50 text-emerald-900 border-emerald-300';
                          } else if (isDeclined) {
                            badgeClasses = 'bg-rose-50/70 text-rose-700 border-rose-200 line-through opacity-80';
                          }

                          const tooltipText = isDeclined 
                            ? (detail.declineReason ? `Zavrnjeno: "${detail.declineReason}"` : (currentLanguage === 'sl' ? 'Zavrnjeno (termin je sproščen)' : 'Declined (slot released)'))
                            : isPending 
                            ? (currentLanguage === 'sl' ? 'V čakanju na potrditev' : 'Pending confirmation')
                            : (detail.notes ? `${detail.personName}: ${detail.notes}` : `${detail.personName} (${currentLanguage === 'sl' ? 'Potrjeno' : 'Confirmed'})`);

                          return (
                            <span
                              key={idx}
                              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full font-mono font-medium border transition shadow-2xs ${
                                isMeOrFamily ? 'ring-2 ring-indigo-300 ' + badgeClasses : badgeClasses
                              }`}
                              title={tooltipText}
                            >
                              {isConfirmed && <Check className="w-3 h-3 text-emerald-600 stroke-[3] shrink-0" />}
                              {isPending && <Clock className="w-3 h-3 text-amber-600 stroke-[2.5] shrink-0" />}
                              {isDeclined && <X className="w-3 h-3 text-rose-500 stroke-[2.5] shrink-0" />}

                              <span>{detail.personName}{isMeOrFamily ? ' (Vi/Družina)' : ''}</span>
                              {isPending && (
                                <span className="text-[10px] text-amber-700 font-sans font-normal opacity-90 hidden sm:inline">
                                  ({currentLanguage === 'sl' ? 'v čakanju' : 'pending'})
                                </span>
                              )}
                              {detail.declineReason && (
                                <span className="text-[10px] text-rose-700 italic cursor-help ml-0.5" title={`Opomba ob zavrnitvi: "${detail.declineReason}"`}>
                                  💬 "{detail.declineReason.length > 20 ? detail.declineReason.substring(0, 20) + '...' : detail.declineReason}"
                                </span>
                              )}
                              {detail.notes && !detail.declineReason && (
                                <span className="text-[11px] cursor-help" title={detail.notes}>
                                  💬
                                </span>
                              )}
                              {(hasLeaderAuthority || isMeOrFamily) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerRemovalConfirmation(ministry.id, detail.personName, detail.status);
                                  }}
                                  className="text-gray-400 hover:text-red-600 transition ml-1 font-bold focus:outline-none cursor-pointer"
                                  title={currentLanguage === 'sl' ? 'Odstrani' : 'Remove'}
                                >
                                  &times;
                                </button>
                              )}
                            </span>
                          );
                        })
                      ) : (
                        ministry.isOptional ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium bg-slate-50 text-slate-500 border border-slate-200/80 px-2.5 py-0.5 rounded-lg shadow-2xs">
                            <span className="text-[10px]">💬</span>
                            <span>{currentLanguage === 'sl' ? 'Opcijsko (po potrebi)' : 'Optional (as needed)'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium bg-amber-50 text-amber-700 border border-amber-200/80 px-2.5 py-0.5 rounded-lg shadow-2xs">
                            <span className="text-[10px]">⚠️</span>
                            <span>{currentLanguage === 'sl' ? 'Ni dodeljenih' : 'Vacant slot'}</span>
                          </span>
                        )
                      )}
                    </div>
                  </div>

                </div>

                {/* Servant & Family Self-Service Quick Action Panel */}
                {activePerson && (
                  <div className="px-3.5 py-2 bg-slate-50/70 border-t border-gray-150 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono">
                        🙋 {currentLanguage === 'sl' ? 'Prijavi se:' : 'Sign up:'}
                      </span>

                      {isMeAssigned ? (
                        <button
                          type="button"
                          onClick={() => triggerRemovalConfirmation(ministry.id, activePerson.name)}
                          className="inline-flex items-center gap-1 text-[11px] bg-indigo-600 text-white font-bold px-2.5 py-0.5 rounded-full shadow-2xs hover:bg-rose-600 transition cursor-pointer"
                          title={currentLanguage === 'sl' ? 'Klikni za odjavo' : 'Click to step down'}
                        >
                          <span>✔ {activePerson.name}</span>
                          <span className="text-xs font-mono">&times;</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddAssignment(ministry.id, activePerson)}
                          className="inline-flex items-center gap-1 text-[11px] bg-white text-indigo-700 font-semibold border border-indigo-200 hover:bg-indigo-50 px-2.5 py-0.5 rounded-full transition cursor-pointer active:scale-95"
                        >
                          <span>+ {activePerson.name}</span>
                        </button>
                      )}

                      {/* + OSTALI (OTHERS) Button for Leader / Admin */}
                      {hasLeaderAuthority && (
                        <button
                          type="button"
                          onClick={() => setActiveMinistryEditId(isEditingThis ? null : ministry.id)}
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full transition cursor-pointer active:scale-95 border ${
                            isEditingThis
                              ? 'bg-indigo-700 text-white border-indigo-800 shadow-2xs'
                              : 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
                          }`}
                          title={currentLanguage === 'sl' ? 'Prijava ostalih članov ekipe' : 'Sign up others'}
                        >
                          <span>{isEditingThis ? '✓' : '+'} 👥 {currentLanguage === 'sl' ? 'OSTALI' : 'OTHERS'}</span>
                        </button>
                      )}

                      {!isAdmin && myFamilyMembers.map(famName => {
                        const isFamAssigned = assignedPeople.includes(famName);
                        return isFamAssigned ? (
                          <button
                            key={famName}
                            type="button"
                            onClick={() => triggerRemovalConfirmation(ministry.id, famName)}
                            className="inline-flex items-center gap-1 text-[11px] bg-emerald-600 text-white font-bold px-2.5 py-0.5 rounded-full shadow-2xs hover:bg-rose-600 transition cursor-pointer"
                            title={currentLanguage === 'sl' ? 'Klikni za odjavo družinskega člana' : 'Click to step down family member'}
                          >
                            <span>👨‍👩‍👧 {famName}</span>
                            <span className="text-xs font-mono">&times;</span>
                          </button>
                        ) : (
                          <button
                            key={famName}
                            type="button"
                            onClick={() => handleAddAssignment(ministry.id, famName)}
                            className="inline-flex items-center gap-1 text-[11px] bg-white text-emerald-800 font-semibold border border-emerald-250 hover:bg-emerald-50 px-2.5 py-0.5 rounded-full transition cursor-pointer active:scale-95"
                          >
                            <span>+ 👨‍👩‍👧 {famName}</span>
                          </button>
                        );
                      })}
                    </div>

                    {!isAdmin && (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          placeholder={currentLanguage === 'sl' ? 'Dodaj družinskega člana...' : 'Add family member...'}
                          value={newFamilyMemberInput}
                          onChange={(e) => setNewFamilyMemberInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddFamilyMember(newFamilyMemberInput);
                          }}
                          className="text-[10px] px-2 py-0.5 bg-white border border-gray-250 rounded-lg text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-32"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddFamilyMember(newFamilyMemberInput)}
                          className="text-[10px] bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold px-2 py-0.5 rounded-lg cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Leader Full Management Dropdown Panel */}
                {isEditingThis && hasLeaderAuthority && (
                  <div className="px-4 pb-4 pt-3 border-t border-gray-100 bg-gray-50/80 rounded-b-xl space-y-3">
                    {assignedPeople.length > 0 && (
                      <div className="space-y-2 border-b border-gray-200/50 pb-3 mb-2.5">
                        <p className="text-[9px] uppercase font-bold tracking-wider text-gray-400 font-mono">
                          {currentLanguage === 'sl' ? 'Status potrditve, povabila in opombe' : 'Confirmation Status, Invites & Notes'}
                        </p>
                        <div className="space-y-2.5 max-h-72 overflow-y-auto">
                          {getAssignmentDetails(ministry.id).map((detail) => {
                            const personObj = (people || []).find(p => p.name.toLowerCase() === detail.personName.toLowerCase());
                            const waUrl = getWhatsAppInvitationUrl({
                              leaderName: detail.assignedByLeaderName || activePerson?.name || 'Vodja službe',
                              volunteerName: detail.personName,
                              ministryName: currentLanguage === 'sl' ? ministry.nameSl : ministry.nameEn,
                              sundayDate: sunday.date,
                              token: detail.confirmationToken || '',
                              phone: personObj?.phone,
                            });

                            return (
                              <div key={detail.personName} className="bg-white p-3 rounded-xl border border-gray-200 flex flex-col gap-2.5 shadow-2xs">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-xs font-bold text-gray-900">
                                      👤 {getPrivacyDisplayName(detail.personName, userRole, activePerson?.name, authUser?.email || activePerson?.email, authUser?.id || authUser?.uid || activePerson?.id, people)}
                                    </span>
                                    {detail.assignedByLeaderName && (
                                      <span className="text-[10px] text-gray-400">
                                        (dodelil: {getPrivacyDisplayName(detail.assignedByLeaderName, userRole, activePerson?.name, authUser?.email || activePerson?.email, authUser?.id || authUser?.uid || activePerson?.id, people)})
                                      </span>
                                    )}
                                  </div>

                                  {/* Status Read-Only Badge + Discreet Override Menu */}
                                  <div className="flex items-center gap-1.5">
                                    {detail.status === 'confirmed' && (
                                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border bg-emerald-50 text-emerald-900 border-emerald-300 flex items-center gap-1">
                                        <Check className="w-2.5 h-2.5 text-emerald-600 stroke-[3]" />
                                        <span>{currentLanguage === 'sl' ? 'Potrjeno' : 'Confirmed'}</span>
                                      </span>
                                    )}
                                    {detail.status === 'declined' && (
                                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border bg-rose-50 text-rose-900 border-rose-300 flex items-center gap-1">
                                        <X className="w-2.5 h-2.5 text-rose-600 stroke-[2.5]" />
                                        <span>{currentLanguage === 'sl' ? 'Zavrnjeno' : 'Declined'}</span>
                                      </span>
                                    )}
                                    {(detail.status === 'pending' || detail.status === 'tentative' || !detail.status) && (
                                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border bg-amber-50 text-amber-900 border-amber-300 flex items-center gap-1">
                                        <Clock className="w-2.5 h-2.5 text-amber-600 stroke-[2.5]" />
                                        <span>{currentLanguage === 'sl' ? 'V čakanju' : 'Pending'}</span>
                                      </span>
                                    )}

                                    {/* Discreet manual override dropdown */}
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const key = `${ministry.id}-${detail.personName}`;
                                          setOverrideMenuOpenId(overrideMenuOpenId === key ? null : key);
                                        }}
                                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition cursor-pointer flex items-center"
                                        title={currentLanguage === 'sl' ? 'Ročna sprememba statusa (ustni dogovor/SMS)' : 'Manual status override'}
                                      >
                                        <MoreVertical className="w-3.5 h-3.5" />
                                      </button>

                                      {overrideMenuOpenId === `${ministry.id}-${detail.personName}` && (
                                        <div className="absolute right-0 mt-1 w-40 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-30 animate-scale-up font-sans text-xs space-y-0.5">
                                          <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                                            {currentLanguage === 'sl' ? 'Ročna sprememba:' : 'Manual override:'}
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              handleSetStatus(ministry.id, detail.personName, 'pending');
                                              setOverrideMenuOpenId(null);
                                            }}
                                            className="w-full text-left px-3 py-1 text-slate-700 hover:bg-amber-50 hover:text-amber-900 flex items-center gap-2 cursor-pointer font-medium"
                                          >
                                            <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                                            <span>{currentLanguage === 'sl' ? 'V čakanju' : 'Set Pending'}</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              handleSetStatus(ministry.id, detail.personName, 'confirmed');
                                              setOverrideMenuOpenId(null);
                                            }}
                                            className="w-full text-left px-3 py-1 text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 flex items-center gap-2 cursor-pointer font-medium"
                                          >
                                            <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                            <span>{currentLanguage === 'sl' ? 'Označi potrjeno' : 'Set Confirmed'}</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              handleSetStatus(ministry.id, detail.personName, 'declined');
                                              setOverrideMenuOpenId(null);
                                            }}
                                            className="w-full text-left px-3 py-1 text-slate-700 hover:bg-rose-50 hover:text-rose-900 flex items-center gap-2 cursor-pointer font-medium"
                                          >
                                            <X className="w-3 h-3 text-rose-600 shrink-0" />
                                            <span>{currentLanguage === 'sl' ? 'Označi zavrnjeno' : 'Set Declined'}</span>
                                          </button>
                                        </div>
                                      )}
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => triggerRemovalConfirmation(ministry.id, detail.personName, detail.status)}
                                      className="text-red-400 hover:text-red-700 text-sm font-bold px-1.5 cursor-pointer"
                                      title={currentLanguage === 'sl' ? 'Odstrani osebo' : 'Remove person'}
                                    >
                                      &times;
                                    </button>
                                  </div>
                                </div>

                                {/* Optional Decline Reason Alert */}
                                {detail.declineReason && (
                                  <div className="bg-rose-50 border border-rose-200 p-2 rounded-lg text-xs text-rose-900 flex items-start gap-1.5">
                                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                                    <div>
                                      <span className="font-bold">Sporočilo ob zavrnitvi:</span> "{detail.declineReason}"
                                      {detail.responseAt && (
                                        <span className="text-[10px] text-rose-700 block font-mono">
                                          Odziv: {formatEuropeanDateTime(detail.responseAt)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Unified Chat App Dispatch Pills (WA, FB Messenger, Google Chat) */}
                                <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                                  {/* WhatsApp Pill */}
                                  <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition cursor-pointer active:scale-95 shrink-0 font-semibold shadow-2xs"
                                    title={currentLanguage === 'sl' ? 'Pošlji povabilo preko WhatsApp' : 'Send WhatsApp invitation'}
                                  >
                                    <WhatsAppIcon className="w-3 h-3 fill-current" />
                                    <span>WA</span>
                                  </a>

                                  {/* Messenger Pill */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const msg = generateVolunteerChatInviteMessage({
                                        volunteerName: detail.personName,
                                        leaderName: detail.assignedByLeaderName || activePerson?.name || 'Vodja službe',
                                        ministryName: currentLanguage === 'sl' ? ministry.nameSl : ministry.nameEn,
                                        sundayDate: sunday.date,
                                        token: detail.confirmationToken || '',
                                      });
                                      navigator.clipboard.writeText(msg);
                                      setSuccessToast(currentLanguage === 'sl' ? 'Besedilo skopirano! Odpiram Messenger...' : 'Text copied! Opening Messenger...');
                                      setTimeout(() => setSuccessToast(null), 3000);
                                      window.open('https://m.me/', '_blank', 'noopener,noreferrer');
                                    }}
                                    className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition cursor-pointer active:scale-95 shrink-0 font-semibold shadow-2xs"
                                    title={currentLanguage === 'sl' ? 'Kopiraj in odpri v Facebook Messenger' : 'Copy and open in Facebook Messenger'}
                                  >
                                    <MessengerIcon className="w-3 h-3 fill-current" />
                                    <span>FB</span>
                                  </button>

                                  {/* Google Chat Pill */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const msg = generateVolunteerChatInviteMessage({
                                        volunteerName: detail.personName,
                                        leaderName: detail.assignedByLeaderName || activePerson?.name || 'Vodja službe',
                                        ministryName: currentLanguage === 'sl' ? ministry.nameSl : ministry.nameEn,
                                        sundayDate: sunday.date,
                                        token: detail.confirmationToken || '',
                                      });
                                      navigator.clipboard.writeText(msg);
                                      setSuccessToast(currentLanguage === 'sl' ? 'Besedilo skopirano! Odpiram Google Chat...' : 'Text copied! Opening Google Chat...');
                                      setTimeout(() => setSuccessToast(null), 3000);
                                      window.open('https://chat.google.com/', '_blank', 'noopener,noreferrer');
                                    }}
                                    className="bg-teal-600 hover:bg-teal-700 text-white text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition cursor-pointer active:scale-95 shrink-0 font-semibold shadow-2xs"
                                    title={currentLanguage === 'sl' ? 'Kopiraj in odpri v Google Chat' : 'Copy and open in Google Chat'}
                                  >
                                    <GoogleChatIcon className="w-3 h-3 fill-current" />
                                    <span>GChat</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Recurring Multi-Week Series Toggle & Controls */}
                    <div className="bg-indigo-50/80 border border-indigo-200/90 p-2.5 rounded-xl space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-indigo-950 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={enableSeries}
                            onChange={(e) => setEnableSeries(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span className="flex items-center gap-1">
                            <Repeat className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>{currentLanguage === 'sl' ? 'Dodaj za več zaporednih nedelj' : 'Add for multiple consecutive Sundays'}</span>
                          </span>
                        </label>

                        {enableSeries && (
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[10px] font-mono font-semibold text-indigo-700">{currentLanguage === 'sl' ? 'Serija:' : 'Series:'}</span>
                            <select
                              value={seriesWeekCount}
                              onChange={(e) => setSeriesWeekCount(Number(e.target.value))}
                              className="text-xs font-bold font-mono bg-white text-indigo-900 border border-indigo-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer"
                            >
                              {[2, 3, 4, 5, 6].map(num => (
                                <option key={num} value={num}>{num} {currentLanguage === 'sl' ? 'tednov zapored' : 'weeks in a row'}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {enableSeries && (
                        <div className="pt-2 border-t border-indigo-200/60 text-[11px] text-indigo-900">
                          <div className="font-mono font-semibold text-[10px] uppercase text-indigo-700 mb-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-indigo-600 shrink-0" />
                            <span>{currentLanguage === 'sl' ? `Predogled serije (${seriesWeekCount} nedelj):` : `Series preview (${seriesWeekCount} Sundays):`}</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {getConsecutiveSundayDates(allSundays, sunday.id, seriesWeekCount).map((item, idx) => (
                              <span key={idx} className="bg-white border border-indigo-200 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold text-indigo-800 shadow-2xs">
                                ✓ {item.date}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Real-time search box & filtered roster options */}
                    <div className="space-y-2 pt-1">
                      <label className="block text-[10px] font-mono font-bold uppercase text-slate-500 tracking-wider">
                        🔍 {currentLanguage === 'sl' ? 'Išči osebo po imenu (zadetki se prikažejo sproti):' : 'Search person by name (filters in real-time):'}
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={rosterSearchQuery}
                          onChange={(e) => setRosterSearchQuery(e.target.value)}
                          placeholder={currentLanguage === 'sl' ? "Napišite ime (npr. Dejan)..." : "Type a name (e.g. Dejan)..."}
                          className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono shadow-2xs"
                        />
                        {rosterSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setRosterSearchQuery('')}
                            className="absolute right-3 top-2 text-xs text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                          >
                            &times;
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1 bg-white border border-slate-200 rounded-xl">
                        {(() => {
                          const query = rosterSearchQuery.trim().toLowerCase();
                          const filteredPeople = (people || []).filter(p => p && p.name && p.name.toLowerCase().includes(query));

                          const decoratedList = filteredPeople.map((person) => {
                            const isChosen = assignedPeople.includes(person.name);
                            const isPref = Array.isArray(person.preferredMinistries) && (
                              person.preferredMinistries.includes(ministry.id) ||
                              person.preferredMinistries.includes(ministry.nameSl) ||
                              person.preferredMinistries.includes(ministry.nameEn)
                            );
                            const { isAbsent, reason: absenceReason, startDate: absenceStartDate, endDate: absenceEndDate } = checkPersonAbsenceOnSunday(person.name, sunday.date, effectiveBlackoutDates);
                            const { isDeclined, declineReason } = checkCandidateDeclineOnSunday(person.name, ministry.id, sunday);
                            const isUnavailable = isDeclined || isAbsent;

                            // Check what other ministries this person is already assigned to this Sunday
                            const otherAssignments = Object.entries(sunday.assignments || {})
                              .filter(([minId, assignedList]) => minId !== ministry.id && Array.isArray(assignedList) && assignedList.includes(person.name))
                              .map(([minId]) => {
                                const minObj = ministries.find(m => m.id === minId || m.nameSl.toLowerCase() === minId.toLowerCase());
                                const name = minObj ? (currentLanguage === 'sl' ? minObj.nameSl : minObj.nameEn) : minId;
                                const emoji = getMinistryIconEmoji(minId);
                                return { minId, name, emoji };
                              });

                            // 1: Available Preferred (⭐), 2: Available Other, 3: Unavailable (🌴 or 🚫)
                            const tier = isUnavailable ? 3 : isPref ? 1 : 2;

                            return {
                              person,
                              isChosen,
                              isPref,
                              isAbsent,
                              absenceReason,
                              absenceStartDate,
                              absenceEndDate,
                              isDeclined,
                              declineReason,
                              isUnavailable,
                              otherAssignments,
                              tier,
                            };
                          });

                          // 3-Tier Sort: Tier 1 -> Tier 2 -> Tier 3, then alphabetical by locale
                          decoratedList.sort((a, b) => {
                            if (a.tier !== b.tier) {
                              return a.tier - b.tier;
                            }
                            return a.person.name.localeCompare(b.person.name, 'sl');
                          });

                          return decoratedList.map(({ person, isChosen, isPref, isAbsent, absenceReason, absenceStartDate, absenceEndDate, isDeclined, declineReason, isUnavailable, otherAssignments }) => {
                            let badgeClasses = 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200';
                            let tooltip = person.name;

                            const otherMinistryText = otherAssignments.length > 0
                              ? (currentLanguage === 'sl'
                                  ? `\nŽe v službi: ${otherAssignments.map(o => `${o.emoji} ${o.name}`).join(', ')}`
                                  : `\nAlready serving: ${otherAssignments.map(o => `${o.emoji} ${o.name}`).join(', ')}`)
                              : '';

                            if (isChosen) {
                              badgeClasses = 'bg-indigo-600 text-white border-indigo-700 font-bold shadow-2xs';
                            } else if (isDeclined) {
                              badgeClasses = 'opacity-60 bg-rose-50/70 border-rose-200 text-rose-900 hover:opacity-100 hover:bg-rose-100 transition';
                              tooltip = (declineReason ? `Zavrnjeno: "${declineReason}"` : 'Oseba je zavrnila ta termin') + otherMinistryText;
                            } else if (isAbsent) {
                              badgeClasses = 'opacity-60 bg-amber-50/70 border-amber-200 text-amber-900 hover:opacity-100 hover:bg-amber-100 transition';
                              const dateInfo = absenceStartDate
                                ? ` (${formatEuropeanDateRange(absenceStartDate, absenceEndDate, '-')})`
                                : '';
                              tooltip = (absenceReason 
                                ? `Odsotnost / Dopust${dateInfo}: "${absenceReason}"` 
                                : `Oseba je na dopustu${dateInfo}`) + otherMinistryText;
                            } else if (isPref) {
                              badgeClasses = 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200 font-semibold';
                              tooltip = (currentLanguage === 'sl' ? 'Prednostni sodelavec za to službo' : 'Preferred volunteer for this ministry') + otherMinistryText;
                            } else {
                              tooltip = person.name + otherMinistryText;
                            }

                            return (
                              <button
                                key={person.name}
                                type="button"
                                onClick={() => handleCandidateClick(person, ministry.id, isChosen, isUnavailable, isDeclined, isAbsent, declineReason, absenceReason, absenceStartDate, absenceEndDate)}
                                title={tooltip}
                                className={`text-xs px-2.5 py-1 rounded-lg font-mono transition duration-150 border focus:outline-none cursor-pointer flex items-center gap-1.5 ${badgeClasses}`}
                              >
                                <span>{person.name}</span>
                                {isChosen && <Check className="w-3 h-3 stroke-[3]" />}
                                {!isChosen && isDeclined && <span title={tooltip}>🚫</span>}
                                {!isChosen && !isDeclined && isAbsent && <span title={tooltip}>🌴</span>}
                                {!isChosen && !isUnavailable && isPref && <span title={currentLanguage === 'sl' ? 'Prednostni sodelavec' : 'Preferred'}>⭐</span>}
                                
                                {/* Visual badges of ministries they are already signed up for this Sunday */}
                                {!isChosen && otherAssignments.length > 0 && (
                                  <span className="inline-flex items-center gap-0.5 ml-0.5 px-1 py-0.2 bg-black/5 rounded text-[11px] font-sans">
                                    {otherAssignments.map((oa) => (
                                      <span
                                        key={oa.minId}
                                        title={currentLanguage === 'sl' ? `Že v službi: ${oa.name}` : `Already serving: ${oa.name}`}
                                      >
                                        {oa.emoji}
                                      </span>
                                    ))}
                                  </span>
                                )}
                              </button>
                            );
                          });
                        })()}
                      </div>

                      {rosterSearchQuery.trim() && !people.some(p => p && p.name && p.name.toLowerCase() === rosterSearchQuery.trim().toLowerCase()) && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              handleAddAssignment(ministry.id, rosterSearchQuery.trim());
                              setRosterSearchQuery('');
                            }}
                            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1 font-mono"
                          >
                            <span>+ {currentLanguage === 'sl' ? 'Dodaj novo osebo:' : 'Add custom name:'} "{rosterSearchQuery.trim()}"</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          };

          return (
            <div id="ministries-list-stack" className="space-y-3.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono">
                  {currentLanguage === 'sl' ? 'SLUŽBE IN RAZPIS' : 'MINISTRIES & COVERAGE'}
                </span>
                <span className="text-[11px] text-gray-500 font-mono font-medium">
                  {Object.keys(sunday.assignments).filter(k => (sunday.assignments[k] || []).length > 0).length} / {filteredMinistries.length} {currentLanguage === 'sl' ? 'pokritih' : 'covered'}
                </span>
              </div>

              {/* Category Selector Tab Bar (Matches MinistryView.tsx) */}
              <div id="category-selector-tabs" className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 pt-1">
                {categories.map((cat) => {
                  const theme = getTeamTheme(cat.id);
                  const isSelected = selectedCategory === cat.id;

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`text-[11px] px-3.5 py-1.5 rounded-xl transition shrink-0 whitespace-nowrap focus:outline-none cursor-pointer flex items-center gap-1.5 border font-semibold ${
                        isSelected
                          ? cat.id === 'all'
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : theme.activeTab
                          : cat.id === 'all'
                            ? 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                            : theme.inactiveTab
                      }`}
                    >
                      {renderCategoryIcon(cat.id, "w-3.5 h-3.5 shrink-0")}
                      <span>{currentLanguage === 'sl' ? cat.labelSl : cat.labelEn}</span>
                    </button>
                  );
                })}
              </div>

              {isServant ? (
                /* SERVANT ROLE VIEW: Show signed up duties first, hide others in collapsible dropdown */
                <div className="space-y-4">
                  {/* Section 1: My Assigned Duties */}
                  <div>
                    <h5 className="text-xs font-bold text-slate-800 font-mono uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <span>📌</span>
                      <span>{currentLanguage === 'sl' ? 'Moja dežurstva na to nedeljo' : 'My Scheduled Duties for Sunday'}</span>
                      <span className="text-[10px] bg-indigo-100 text-indigo-900 font-mono px-2 py-0.2 rounded-full font-bold">
                        {mySignedUpMinistries.length}
                      </span>
                    </h5>

                    {mySignedUpMinistries.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {mySignedUpMinistries.map(renderMinistryCard)}
                      </div>
                    ) : (
                      <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl text-xs text-indigo-950 flex items-center justify-between gap-3 shadow-2xs">
                        <div className="flex items-center gap-2.5">
                          <HelpCircle className="w-5 h-5 text-indigo-600 shrink-0" />
                          <div>
                            <span className="font-bold font-display block">
                              {currentLanguage === 'sl' ? 'Trenutno niste prijavljeni na nobeno službo' : 'You are not currently signed up for any duties'}
                            </span>
                            <span className="text-[11px] text-indigo-800">
                              {currentLanguage === 'sl' ? 'Kliknite spodaj za pregled vseh prostih mest in vpis na dežurstvo.' : 'Click below to expand available positions and sign up.'}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAllOtherMinistries(true)}
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-2xs transition shrink-0 cursor-pointer"
                        >
                          {currentLanguage === 'sl' ? 'Preglej službe' : 'View Duties'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Section 2: Collapsible Dropdown for Other Available Ministries */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAllOtherMinistries(!showAllOtherMinistries)}
                      className="w-full py-3 px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl shadow-2xs text-xs font-bold text-slate-800 flex items-center justify-between transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">📋</span>
                        <span>
                          {currentLanguage === 'sl' 
                            ? `Ostale službe in prosta mesta za vpis (${otherAvailableMinistries.length})` 
                            : `Other available duties to sign up (${otherAvailableMinistries.length})`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-indigo-600 font-mono text-[11px]">
                        <span>{showAllOtherMinistries ? (currentLanguage === 'sl' ? 'Skrij' : 'Hide') : (currentLanguage === 'sl' ? 'Prikaži vse' : 'Expand all')}</span>
                        {showAllOtherMinistries ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    {showAllOtherMinistries && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3.5 animate-fade-in">
                        {otherAvailableMinistries.map(renderMinistryCard)}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* ADMIN & LEADER VIEW: Full schedule grid */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredMinistries.map(renderMinistryCard)}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Leader Contact Modal / Quick Actions Popover */}
      {selectedLeaderForContact && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scale-up">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm font-mono border border-indigo-200">
                  {selectedLeaderForContact.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <span>{selectedLeaderForContact.name}</span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-mono font-bold">
                      👑 {selectedLeaderForContact.role || 'Vodja'}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {currentLanguage === 'sl' ? 'Vodja službe' : 'Ministry Leader'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLeaderForContact(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {canViewPersonContactInfo(userRole, undefined, selectedLeaderForContact) ? (
              <div className="space-y-2.5 pt-2">
                {selectedLeaderForContact.phone ? (
                  <a
                    href={`tel:${selectedLeaderForContact.phone.replace(/\s+/g, '')}`}
                    className="w-full flex items-center justify-between p-3 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 rounded-xl text-emerald-950 transition font-medium text-xs cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Phone className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition" />
                      <div className="text-left">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 font-mono block">
                          {currentLanguage === 'sl' ? 'Pokliči številko' : 'Call Phone Number'}
                        </span>
                        <span className="font-mono font-bold text-xs">{selectedLeaderForContact.phone}</span>
                      </div>
                    </div>
                    <PhoneCall className="w-4 h-4 text-emerald-600" />
                  </a>
                ) : (
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-[11px] font-mono">
                    {currentLanguage === 'sl' ? 'Telefonska številka ni vpisana' : 'No phone number provided'}
                  </div>
                )}

                {selectedLeaderForContact.phone && (
                  <a
                    href={`https://wa.me/${selectedLeaderForContact.phone.replace(/[^0-9]/g, '').replace(/^0/, '386')}?text=${encodeURIComponent(`Živjo ${selectedLeaderForContact.name}! 👋`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-between p-3 bg-sky-50 hover:bg-sky-100/80 border border-sky-200 rounded-xl text-sky-950 transition font-medium text-xs cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <MessageSquare className="w-4 h-4 text-sky-600 group-hover:scale-110 transition" />
                      <div className="text-left">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-sky-700 font-mono block">
                          {currentLanguage === 'sl' ? 'Pošlji WhatsApp / SMS' : 'Send WhatsApp / SMS'}
                        </span>
                        <span className="font-mono font-bold text-xs">{selectedLeaderForContact.phone}</span>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-sky-600" />
                  </a>
                )}

                {selectedLeaderForContact.email ? (
                  <a
                    href={`mailto:${selectedLeaderForContact.email}`}
                    className="w-full flex items-center justify-between p-3 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 rounded-xl text-indigo-950 transition font-medium text-xs cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Mail className="w-4 h-4 text-indigo-600 shrink-0 group-hover:scale-110 transition" />
                      <div className="text-left min-w-0">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-700 font-mono block">
                          {currentLanguage === 'sl' ? 'Pošlji e-pošto' : 'Send Email'}
                        </span>
                        <span className="font-mono font-semibold text-xs truncate block">{selectedLeaderForContact.email}</span>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-indigo-600 shrink-0" />
                  </a>
                ) : null}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-xs font-medium text-center">
                🔒 {currentLanguage === 'sl' ? 'Osebni podatki so vidni samo registriranim članom ekipe.' : 'Personal contact info is restricted to logged-in team members.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Service Rundown & Worship Songbook Attachment Modal */}
      <ServiceRundownModal
        isOpen={isRundownModalOpen}
        onClose={() => setIsRundownModalOpen(false)}
        sunday={sunday}
        currentLanguage={currentLanguage}
        onUpdateSunday={onUpdateSunday}
        ministries={ministries}
        people={people}
        userRole={userRole}
        canEdit={canEditGeneral}
      />
    </div>
  );
}

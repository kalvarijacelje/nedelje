/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ServiceSunday, Ministry, UserRole, Translation, Person, VisitorConnection, BlackoutDate, canAccessPersonalData, getFirstName } from '../types';
import { 
  Calendar, Users, ArrowRightLeft, AlertTriangle, ShieldCheck, Heart, Sparkles, ChevronRight, CheckCircle2, AlertCircle, Plus, Eye, BookOpen, Layers, Check, Clock, HelpCircle, X, ExternalLink, ShieldAlert, Award, Star, MessageSquare, Phone, Info, Music, Home, Wine, HeartHandshake, PlusCircle, Coffee, Edit, UserPlus, Copy, CheckCircle, Palmtree, ClipboardCheck, Bell, UserCheck, User, Crown, ChevronDown
} from 'lucide-react';
import HeroHeaderBanner from './HeroHeaderBanner';
import KcKalvarijaLogoComponent from './KcKalvarijaLogo';
import { IS_FIREBASE_ENABLED } from '../lib/firebase';
import { getEffectiveSundayFocus, getSundayCoverageStats, getApplicableMinistriesForSunday } from '../lib/sundaySpecialFocus';
import { resolveMinistryAssignments } from '../utils/worshipSync';
import { generateConfirmationToken } from '../services/notificationService';
import { useNotificationQueue } from '../hooks/useNotificationQueue';
import { parseEuropeanDate, formatToEuropeanDate } from '../utils/dateUtils';
import { getMinistryIconEmoji, checkPersonAbsenceOnSunday } from './SundayDetail';

const KcKalvarijaLogo = () => (
  <KcKalvarijaLogoComponent className="w-14 h-14" />
);

interface HomeDashboardProps {
  sundays: ServiceSunday[];
  ministries: Ministry[];
  people: Person[];
  activePerson?: Person | null;
  userRole: UserRole;
  translations: Translation;
  currentLanguage: 'sl' | 'en';
  onSelectSunday: (id: string, ministryId?: string, categoryId?: string) => void;
  onAddSunday: () => void;
  onUpdateSunday?: (updated: ServiceSunday) => void;
  onOpenVisitorModal?: () => void;
  onOpenSwapModal?: () => void;
  onOpenCheckInModal?: () => void;
  onOpenBlackoutModal?: () => void;
  onOpenInspectionModal?: (category?: 'coffee_upper_hall' | 'tech_stage' | 'kids_classrooms' | 'general_cleaning') => void;
  onOpenNotificationModal?: () => void;
  onOpenRundownModal?: (sundayId?: string) => void;
  visitors?: VisitorConnection[];
  blackoutDates?: BlackoutDate[];
}

export default function HomeDashboard({
  sundays,
  ministries,
  people,
  activePerson,
  userRole,
  translations,
  currentLanguage,
  onSelectSunday,
  onAddSunday,
  onUpdateSunday,
  onOpenVisitorModal,
  onOpenSwapModal,
  onOpenCheckInModal,
  onOpenBlackoutModal,
  onOpenInspectionModal,
  onOpenNotificationModal,
  onOpenRundownModal,
  visitors = [],
  blackoutDates = [],
}: HomeDashboardProps) {

  // Toast notification state
  const [toast, setToast] = useState<string | null>(null);
  const { queueAssignment } = useNotificationQueue();

  // Quick Assign form states
  const [showQuickAssign, setShowQuickAssign] = useState(false);
  const [selectedVacantId, setSelectedVacantId] = useState('');
  const [selectedPersonName, setSelectedPersonName] = useState('');
  const [rosterSearchQuery, setRosterSearchQuery] = useState('');

  // Personal upcoming serving calendar toggle in banner
  const [showMyServingCalendar, setShowMyServingCalendar] = useState(false);

  // Today at midnight for calculating upcoming dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Sort sundays chronologically
  const sortedSundays = [...sundays].sort((a, b) => {
    return parseEuropeanDate(a.date).getTime() - parseEuropeanDate(b.date).getTime();
  });

  // School Year 2026/2027 sundays calculation & countdown
  const academicYear2627Start = new Date(2026, 7, 20); // late August 2026
  const academicYear2627End = new Date(2027, 7, 31);    // August 2027
  const schoolYearSundays = sortedSundays.filter(s => {
    const d = parseEuropeanDate(s.date);
    return d >= academicYear2627Start && d <= academicYear2627End;
  });
  const activeSchoolSundays = schoolYearSundays.length > 0 ? schoolYearSundays : sortedSundays;
  const upcomingSchoolSundays = activeSchoolSundays.filter(s => parseEuropeanDate(s.date).getTime() >= today.getTime());
  const completedSchoolSundaysCount = activeSchoolSundays.length - upcomingSchoolSundays.length;

  // Active Servants count (strictly active volunteers in ministries, matching PeopleView)
  const activeServantsCount = (people || []).filter(p => {
    if (!p || !p.name || p.isArchived || p.isVisitor || p.role === 'Visitor' || p.memberType === 'visitor') return false;
    return p.role === 'Admin' || p.role === 'Leader' || p.role === 'Servant' ||
      (p.preferredMinistries && p.preferredMinistries.length > 0) ||
      (p.ledMinistries && p.ledMinistries.length > 0);
  }).length;

  // Total visitor headcount (summing party/group sizes)
  const totalVisitorHeadcount = (visitors || []).reduce((acc, v) => acc + (Math.max(1, Number(v.attendeeCount) || 1)), 0);

  // Find all pending invitations strictly for activePerson only (no family members)
  const pendingInvitations: {
    sunday: ServiceSunday;
    ministry: Ministry;
    ministryId: string;
    detail: any;
  }[] = [];

  if (activePerson) {
    const myName = activePerson.name.toLowerCase().trim();
    const myId = activePerson.id;

    sortedSundays.forEach(sunday => {
      if (sunday.assignmentDetails) {
        Object.entries(sunday.assignmentDetails).forEach(([mId, details]) => {
          if (Array.isArray(details)) {
            details.forEach(d => {
              const matchesPerson = (myId && (d as any).personId === myId) || 
                (d.personName && d.personName.toLowerCase().trim() === myName);

              if (
                matchesPerson &&
                (d.status === 'pending' || d.status === 'tentative')
              ) {
                const ministryObj = ministries.find(m => m.id === mId) || {
                  id: mId,
                  nameSl: mId,
                  nameEn: mId,
                  category: 'other' as const,
                  color: 'indigo'
                };
                pendingInvitations.push({
                  sunday,
                  ministry: ministryObj,
                  ministryId: mId,
                  detail: d
                });
              }
            });
          }
        });
      }
    });
  }

  const handleInAppAccept = (sunday: ServiceSunday, ministryId: string, personName: string) => {
    if (!onUpdateSunday || !activePerson) return;
    // Prevent cross-family accept: strictly for activePerson
    if (personName.toLowerCase().trim() !== activePerson.name.toLowerCase().trim()) return;

    const currentDetails = sunday.assignmentDetails?.[ministryId] || [];
    const updatedDetails = currentDetails.map(d => {
      if (d.personName.toLowerCase().trim() === activePerson.name.toLowerCase().trim()) {
        return { ...d, status: 'confirmed' as const, responseAt: new Date().toISOString() };
      }
      return d;
    });

    const updatedSunday: ServiceSunday = {
      ...sunday,
      assignmentDetails: {
        ...(sunday.assignmentDetails || {}),
        [ministryId]: updatedDetails,
      }
    };
    onUpdateSunday(updatedSunday);
    setToast(currentLanguage === 'sl' 
      ? `Zadolžitev za ${personName} uspešno potrjena!` 
      : `Assignment for ${personName} confirmed!`
    );
  };

  const handleInAppDecline = (sunday: ServiceSunday, ministryId: string, personName: string) => {
    if (!onUpdateSunday || !activePerson) return;
    // Prevent cross-family decline: strictly for activePerson
    if (personName.toLowerCase().trim() !== activePerson.name.toLowerCase().trim()) return;

    const reason = prompt(
      currentLanguage === 'sl' 
        ? `Želite dodati kratko opombo za vodjo službe? (neobvezno)` 
        : `Add an optional note for the ministry leader?`
    ) || '';

    const currentDetails = sunday.assignmentDetails?.[ministryId] || [];
    const updatedDetails = currentDetails.map(d => {
      if (d.personName.toLowerCase().trim() === activePerson.name.toLowerCase().trim()) {
        return { 
          ...d, 
          status: 'declined' as const, 
          declineReason: reason,
          responseAt: new Date().toISOString() 
        };
      }
      return d;
    });

    const confirmedAndPendingNames = updatedDetails
      .filter(d => d.status !== 'declined')
      .map(d => d.personName);

    const updatedSunday: ServiceSunday = {
      ...sunday,
      assignments: {
        ...sunday.assignments,
        [ministryId]: confirmedAndPendingNames,
      },
      assignmentDetails: {
        ...(sunday.assignmentDetails || {}),
        [ministryId]: updatedDetails,
      }
    };
    onUpdateSunday(updatedSunday);
    setToast(currentLanguage === 'sl' 
      ? `Termin sproščen. Hvala, ker ste sporočili!` 
      : `Slot released. Thank you for notifying!`
    );
  };

  // Clear toast automatically after 4 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Find the next upcoming Sunday (today or in the future), or fallback to the latest Sunday
  const nextSunday = sortedSundays.find(s => parseEuropeanDate(s.date).getTime() >= today.getTime()) || sortedSundays[sortedSundays.length - 1];

  // If there's no sunday computed, return safe state
  if (!nextSunday) {
    return (
      <div id="empty-dashboard-container" className="px-4 py-8 text-center bg-white border border-dashed border-gray-200 rounded-2xl flex flex-col items-center max-w-lg mx-auto m-4 space-y-3.5 shadow-[0_4px_12px_rgba(0,0,0,0.015)]">
        <Calendar className="w-10 h-10 text-gray-300 stroke-1" />
        <div className="space-y-1">
          <h3 className="font-display font-semibold text-sm text-gray-950">
            {currentLanguage === 'sl' ? 'Ni planiranih bogoslužij' : 'No Sundays Scheduled'}
          </h3>
          <p className="text-xs text-gray-400 font-sans max-w-xs leading-normal">
            {currentLanguage === 'sl' 
              ? 'V bazi trenutno ni najdenih nedeljskih razporedov. Začnite z dodajanjem prve nedelje za planer.' 
              : 'There are no active Sunday service schedules in the database. Add your first service calendar to begin planning.'}
          </p>
        </div>
        {userRole !== 'Viewer' && (
          <button
            onClick={onAddSunday}
            className="text-xs font-semibold bg-[#4338CA] hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl shadow-xs cursor-pointer transition active:scale-95 flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{currentLanguage === 'sl' ? 'Ustvari prvo nedeljo' : 'Create First Sunday'}</span>
          </button>
        )}
      </div>
    );
  }

  // Let's compute statistics for nextSunday taking into account rotation and optional ministries
  const nextSundayCoverage = getSundayCoverageStats(nextSunday, ministries);
  const totalSlots = nextSundayCoverage.totalRequired;
  const assignedSlots = nextSundayCoverage.filledRequired;
  const coveragePercent = nextSundayCoverage.percent;

  // Find vacant slots among applicable non-optional ministries
  const vacantMinistries = nextSundayCoverage.requiredMinistries.filter(
    m => resolveMinistryAssignments(nextSunday, m.id).length === 0
  );

  // Find fulfilled slots among applicable non-optional ministries
  const fulfilledMinistries = nextSundayCoverage.requiredMinistries.filter(
    m => resolveMinistryAssignments(nextSunday, m.id).length > 0
  );

  const getCategoryBorderClass = (category?: string) => {
    switch (category) {
      case 'cleaning': return 'border-l-4 border-l-amber-400 hover:border-amber-400';
      case 'hospitality': return 'border-l-4 border-l-rose-400 hover:border-rose-400';
      case 'sermon_prayer': return 'border-l-4 border-l-sky-400 hover:border-sky-400';
      case 'worship':
      case 'av_tech': return 'border-l-4 border-l-purple-400 hover:border-purple-400';
      case 'audio_video': return 'border-l-4 border-l-cyan-500 hover:border-cyan-400';
      case 'kids': return 'border-l-4 border-l-emerald-400 hover:border-emerald-400';
      case 'post_service':
      case 'other':
      default: return 'border-l-4 border-l-indigo-400 hover:border-indigo-400';
    }
  };

  const getCategoryIconBgClass = (category?: string) => {
    switch (category) {
      case 'cleaning': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'hospitality': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'sermon_prayer': return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'worship':
      case 'av_tech': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'audio_video': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'kids': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'post_service':
      case 'other':
      default: return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    }
  };

  // Helper to check if a specific person is assigned to a ministry on a given Sunday
  const isPersonAssignedOnSunday = (sunday: ServiceSunday, person: Person, ministryId: string): boolean => {
    const pName = person.name.toLowerCase().trim();
    const pId = person.id;
    
    // Check assignmentDetails first
    const details = sunday.assignmentDetails?.[ministryId];
    if (Array.isArray(details) && details.length > 0) {
      return details.some(d => {
        if (d.status === 'declined') return false;
        if (pId && (d as any).personId === pId) return true;
        return d.personName && d.personName.toLowerCase().trim() === pName;
      });
    }
    
    // Fallback to legacy string array
    const assignedList = sunday.assignments?.[ministryId] || [];
    return assignedList.some(name => name.toLowerCase().trim() === pName);
  };

  // Serving Phase Helper
  type ServingPhase = 'before' | 'during' | 'after';

  type ServingDutyItem = {
    ministry: Ministry;
    phase: ServingPhase;
    phaseLabel: string;
    timeHint: string;
    phaseEmoji: string;
    phaseColor: string;
    actionTooltip: string;
  };

  type ServingSundayScheduleItem = {
    sunday: ServiceSunday;
    date: string;
    isThisSunday: boolean;
    duties: ServingDutyItem[];
  };

  const getMinistryPhaseInfo = (
    m: Ministry,
    lang: 'sl' | 'en'
  ): {
    phase: ServingPhase;
    phaseLabel: string;
    timeHint: string;
    phaseEmoji: string;
    phaseColor: string;
  } => {
    const cat = (m.category || '').toLowerCase();
    const id = (m.id || '').toLowerCase();
    const name = ((m.nameSl || '') + ' ' + (m.nameEn || '')).toLowerCase();

    // 1. After service duties (inspection, lock, finance count, coffee cleanup)
    if (
      cat === 'post_service' ||
      id.includes('lock') || id.includes('zaklep') ||
      id.includes('inspect') || id.includes('pregled') ||
      id.includes('count') || id.includes('finance') || id.includes('darov') ||
      name.includes('zaklep') || name.includes('pregled') || name.includes('lock') || name.includes('posprav') || name.includes('darov')
    ) {
      return {
        phase: 'after',
        phaseLabel: lang === 'sl' ? 'Po bogoslužju' : 'After Service',
        timeHint: '11:30+',
        phaseEmoji: '🧹',
        phaseColor: 'border-amber-400/40 text-amber-200 bg-amber-500/15',
      };
    }

    // 2. Before service setup & tech duties (audio/video setup, stage prep, door welcome)
    if (
      cat === 'cleaning' ||
      cat === 'audio_video' ||
      cat === 'av_tech' ||
      id.includes('setup') || id.includes('priprava') || id.includes('tehnika') || id.includes('sound') ||
      name.includes('priprava') || name.includes('zvok') || name.includes('sound') || name.includes('vrata') || name.includes('sprejem')
    ) {
      return {
        phase: 'before',
        phaseLabel: lang === 'sl' ? 'Pred bogoslužjem' : 'Before Service',
        timeHint: '09:00 - 09:45',
        phaseEmoji: '🌅',
        phaseColor: 'border-sky-400/40 text-sky-200 bg-sky-500/15',
      };
    }

    // 3. During service (Sermon, Worship, Kids, Prayer, Communion, Hospitality)
    return {
      phase: 'during',
      phaseLabel: lang === 'sl' ? 'Med bogoslužjem' : 'During Service',
      timeHint: '10:00 - 11:30',
      phaseEmoji: '⛪',
      phaseColor: 'border-emerald-400/40 text-emerald-200 bg-emerald-500/15',
    };
  };

  // Personalized serving duties computation
  const myThisSundayDuties: ServingDutyItem[] = [];
  const myUpcomingServingSchedule: ServingSundayScheduleItem[] = [];

  if (activePerson) {
    // 1. Scan all future Sundays
    sortedSundays.forEach(s => {
      const sDate = parseEuropeanDate(s.date);
      if (sDate.getTime() >= today.getTime()) {
        const assignedDutiesForSunday: ServingDutyItem[] = [];
        ministries.forEach(m => {
          if (isPersonAssignedOnSunday(s, activePerson, m.id)) {
            const phaseInfo = getMinistryPhaseInfo(m, currentLanguage);
            const mId = m.id.toLowerCase();
            const actionTooltip = (mId.includes('inspect') || mId.includes('pregled') || mId.includes('lock') || mId.includes('zaklep'))
              ? (currentLanguage === 'sl' ? 'Odpri kontrolni seznam pregleda' : 'Open inspection checklist')
              : (mId.includes('sermon') || mId.includes('govor') || mId.includes('pridig') || mId.includes('rundown'))
                ? (currentLanguage === 'sl' ? 'Odpri potek bogoslužja & odštevalnik' : 'Open service rundown & timer')
                : (currentLanguage === 'sl' ? 'Odpri razpored te službe' : 'Open schedule for this role');

            assignedDutiesForSunday.push({
              ministry: m,
              ...phaseInfo,
              actionTooltip,
            });
          }
        });

        if (assignedDutiesForSunday.length > 0) {
          myUpcomingServingSchedule.push({
            sunday: s,
            date: s.date,
            isThisSunday: s.id === nextSunday.id,
            duties: assignedDutiesForSunday,
          });
        }
      }
    });

    // 2. Extract this Sunday's duties
    const thisSundaySchedule = myUpcomingServingSchedule.find(entry => entry.sunday.id === nextSunday.id);
    if (thisSundaySchedule) {
      myThisSundayDuties.push(...thisSundaySchedule.duties);
    }
  }

  const isServingThisSunday = myThisSundayDuties.length > 0;
  const nextServingScheduleEntry = isServingThisSunday
    ? myUpcomingServingSchedule.find(entry => entry.sunday.id !== nextSunday.id)
    : myUpcomingServingSchedule[0];

  const beforeDuties = myThisSundayDuties.filter(d => d.phase === 'before');
  const duringDuties = myThisSundayDuties.filter(d => d.phase === 'during');
  const afterDuties = myThisSundayDuties.filter(d => d.phase === 'after');

  const handleServingDutyClick = (m: Ministry, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const mId = m.id.toLowerCase();

    // If it's an inspection / lock / checklist duty
    if (mId.includes('inspect') || mId.includes('pregled') || mId.includes('lock') || mId.includes('zaklep')) {
      if (onOpenInspectionModal) {
        if (mId.includes('tech') || mId.includes('oder')) {
          onOpenInspectionModal('tech_stage');
        } else if (mId.includes('coffee') || mId.includes('kav')) {
          onOpenInspectionModal('coffee_upper_hall');
        } else if (mId.includes('kid') || mId.includes('sol') || mId.includes('šol')) {
          onOpenInspectionModal('kids_classrooms');
        } else {
          onOpenInspectionModal('general_cleaning');
        }
        return;
      }
    }

    // If it's sermon / teaching / rundown
    if (mId.includes('sermon') || mId.includes('govor') || mId.includes('pridig') || mId.includes('rundown')) {
      if (onOpenRundownModal) {
        onOpenRundownModal(nextSunday.id);
        return;
      }
    }

    // Default: Open the Sunday details focused on that ministry
    onSelectSunday(nextSunday.id, m.id, m.category);
  };

  const nextSundayFocus = getEffectiveSundayFocus(nextSunday);
  const nextSundayFocusLabel = nextSundayFocus.type === 'communion'
    ? (currentLanguage === 'sl' ? '🍷 Gospodova Večerja' : '🍷 Lord\'s Supper')
    : nextSundayFocus.type === 'prayer'
      ? (currentLanguage === 'sl' ? '🙏 Molitev za družine' : '🙏 Family & Sphere Prayer')
      : (currentLanguage === 'sl' ? '✨ Redno bogoslužje' : '✨ Regular Service');


  // --- Duplicate previous week handler ---
  const handleDuplicateWeek = () => {
    if (!onUpdateSunday) return;
    const currentIndex = sortedSundays.findIndex(s => s.id === nextSunday.id);
    if (currentIndex > 0) {
      const prevSunday = sortedSundays[currentIndex - 1];
      const updatedSunday = {
        ...nextSunday,
        assignments: { ...prevSunday.assignments },
        assignmentDetails: { ...prevSunday.assignmentDetails }
      };
      onUpdateSunday(updatedSunday);
      setToast(currentLanguage === 'sl' 
        ? `Uspešno prekopirano iz prejšnjega tedna (${prevSunday.date})!` 
        : `Successfully copied assignments from previous week (${prevSunday.date})!`
      );
    } else {
      setToast(currentLanguage === 'sl'
        ? "Ni prejšnjega tedna za kopiranje."
        : "No previous Sunday found to copy from."
      );
    }
  };

  // --- Quick Assign handler ---
  const handleQuickAssign = () => {
    if (!onUpdateSunday || !selectedVacantId || !selectedPersonName) return;

    const currentList = nextSunday.assignments[selectedVacantId] || [];
    if (currentList.includes(selectedPersonName)) return;

    const token = generateConfirmationToken(nextSunday.id, selectedVacantId, selectedPersonName);
    const isSelfAssign = activePerson && (selectedPersonName.toLowerCase().trim() === activePerson.name.toLowerCase().trim());
    const currentDetails = nextSunday.assignmentDetails?.[selectedVacantId] || [];

    const newDetail = {
      personName: selectedPersonName,
      status: isSelfAssign ? 'confirmed' as const : 'pending' as const,
      notes: '',
      assignedByLeaderId: activePerson?.id || '',
      assignedByLeaderName: activePerson?.name || 'Vodja službe',
      assignedAt: new Date().toISOString(),
      confirmationToken: token,
    };

    const updatedSunday: ServiceSunday = {
      ...nextSunday,
      assignments: {
        ...nextSunday.assignments,
        [selectedVacantId]: [...currentList, selectedPersonName]
      },
      assignmentDetails: {
        ...(nextSunday.assignmentDetails || {}),
        [selectedVacantId]: [...currentDetails, newDetail]
      }
    };
    onUpdateSunday(updatedSunday);

    // Queue notification if person has an email address
    const personObj = (people || []).find(p => p && p.name && p.name.toLowerCase().trim() === selectedPersonName.toLowerCase().trim());
    if (!isSelfAssign && personObj?.email) {
      const minObj = ministries.find(m => m.id === selectedVacantId);
      const minName = minObj ? (currentLanguage === 'sl' ? minObj.nameSl : minObj.nameEn) : selectedVacantId;

      queueAssignment({
        volunteerName: selectedPersonName,
        volunteerEmail: personObj.email,
        leaderName: activePerson?.name || 'Vodja službe',
        sundayId: nextSunday.id,
        sundayDate: nextSunday.date,
        ministryId: selectedVacantId,
        ministryName: minName,
        token,
      });

      setToast(currentLanguage === 'sl'
        ? `✓ ${selectedPersonName} dodeljen! ⏳ Obvestilo dodano v čakalno vrsto (10 min).`
        : `✓ ${selectedPersonName} assigned! ⏳ Notification queued (10 min).`
      );
    } else if (!isSelfAssign) {
      setToast(currentLanguage === 'sl'
        ? `ℹ️ ${selectedPersonName} dodeljen, vendar nima vpisanega e-poštnega naslova (uporabite WhatsApp/FB).`
        : `ℹ️ ${selectedPersonName} assigned, but has no email configured (use WhatsApp/FB).`
      );
    } else {
      setToast(currentLanguage === 'sl'
        ? `✓ Uspešno prijavljeni za to službo!`
        : `✓ Successfully signed up for this role!`
      );
    }

    // reset form
    setSelectedVacantId('');
    setSelectedPersonName('');
    setRosterSearchQuery('');
    setShowQuickAssign(false);
  };

  return (
    <div id="home-dashboard-component" className="w-full space-y-5 animate-fade-in pb-12">
      
      {/* Pending Volunteer Invitation In-App Notification Banner */}
      {pendingInvitations.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-indigo-600 text-white p-4 sm:p-5 rounded-2xl shadow-lg border border-amber-400/50 space-y-3 animate-scale-up relative overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0">
                <Bell className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm sm:text-base">
                  {currentLanguage === 'sl'
                    ? `👋 Imate ${pendingInvitations.length} ${pendingInvitations.length === 1 ? 'novo povabilo' : pendingInvitations.length === 2 ? 'novi povabili' : 'novih povabil'} k služenju`
                    : `👋 You have ${pendingInvitations.length} pending ministry invitation${pendingInvitations.length > 1 ? 's' : ''}`}
                </h3>
                <p className="text-[11px] text-amber-100 font-medium">
                  {currentLanguage === 'sl' 
                    ? 'Prosimo, potrdite svojo razpoložljivost z enim klikom:' 
                    : 'Please confirm your availability below:'}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            {pendingInvitations.map((inv, iIdx) => {
              const leaderName = inv.detail.assignedByLeaderName || 'Vodja službe';
              const minName = currentLanguage === 'sl' ? inv.ministry.nameSl : inv.ministry.nameEn;

              return (
                <div 
                  key={`pending-inv-${inv.sunday.id}-${inv.ministryId}-${iIdx}`}
                  className="bg-white/95 text-slate-900 rounded-xl p-3 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-indigo-950 font-display flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>{inv.sunday.date}</span>
                      </span>
                      <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                        {minName}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      {currentLanguage === 'sl'
                        ? `Vodja ${leaderName} vas vabi k sodelovanju.`
                        : `Leader ${leaderName} invited you.`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleInAppAccept(inv.sunday, inv.ministryId, inv.detail.personName)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1 cursor-pointer active:scale-95"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{currentLanguage === 'sl' ? 'Sprejmi' : 'Accept'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInAppDecline(inv.sunday, inv.ministryId, inv.detail.personName)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition border border-slate-300 flex items-center gap-1 cursor-pointer active:scale-95"
                    >
                      <X className="w-3.5 h-3.5 text-slate-500" />
                      <span>{currentLanguage === 'sl' ? 'Ne morem' : 'Decline'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Toast Alert Banner */}
      {toast && (
        <div className="bg-emerald-500/10 border-2 border-emerald-400 text-emerald-950 p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs animate-fade-in relative z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="truncate">{toast}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-emerald-500 hover:text-emerald-800 font-bold text-sm select-none cursor-pointer shrink-0 ml-2">
            &times;
          </button>
        </div>
      )}

      {/* Offline/Local fallback mode warning banner */}
      {!IS_FIREBASE_ENABLED && (
        <div id="offline-fallback-warning" className="bg-amber-50 border border-amber-200 text-amber-950 p-4 rounded-xl text-xs space-y-1.5 shadow-xs relative z-10">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-bold uppercase tracking-wider text-[10px] text-amber-800 font-mono">
              {currentLanguage === 'sl' ? 'Lokalni Način Shranjevanja' : 'Local Offline Storage active'}
            </span>
          </div>
          <p className="text-slate-600 leading-normal font-sans">
            {currentLanguage === 'sl' 
              ? 'Aplikacija trenutno deluje v varnem lokalnem načinu. Vsi vnosi se shranjujejo v vaš brskalnik in se NE prenašajo ali delijo z drugimi člani cerkve.' 
              : 'The workspace is in local-only fallback mode. All listings, schedules, and assignments are saved directly in your browser and are NOT shared with the church.'}
          </p>
        </div>
      )}

      {/* Dynamic welcome hero header */}
      <HeroHeaderBanner
        variant="home"
        eyebrow={currentLanguage === 'sl' ? '📍 KCK BOGOSLUŽJA • KC KALVARIJA' : '📍 KCK SERVICE • KC KALVARIJA'}
        title={currentLanguage === 'sl' ? 'Organizacija nedeljskih bogoslužij KCK' : 'KCK Sunday Meeting Organization'}
        subtitle={currentLanguage === 'sl' ? 'Organizirajmo nedeljske ekipe skupaj. Pregled naslednjega bogoslužja, razporedov in hitrih opravil.' : 'Sunday service organizer and volunteer roster.'}
        icon={Home}
        actions={
          <div className="flex items-center gap-2 sm:gap-3 text-xs flex-wrap font-mono">
            <span className="bg-white/10 px-2.5 py-1 rounded-lg border border-white/15">
              {currentLanguage === 'sl' ? 'Vloga:' : 'Roster access:'} <strong className="text-white font-bold">{translations[`role${userRole}` as any] || userRole}</strong>
            </span>
            <span className="bg-white/10 px-2.5 py-1 rounded-lg border border-white/15">
              📆 {currentLanguage === 'sl' ? 'Šolsko leto 2026/2027' : 'School Year 2026/2027'}
            </span>
          </div>
        }
      >
        {/* Personalized Interactive Serving Center & Church Metrics */}
        <div className="pt-2.5 border-t border-white/15 space-y-3">
          {activePerson ? (
            <div className="space-y-2.5">
              {isServingThisSunday ? (
                /* Card when serving this Sunday */
                <div className="bg-black/30 backdrop-blur-md rounded-2xl p-3.5 sm:p-4 border border-white/20 shadow-lg space-y-3">
                  {/* Top Bar: Count of assignments + Calendar button */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-emerald-500/25 border border-emerald-400/50 text-emerald-300 text-sm font-bold shadow-2xs">
                        ⚡
                      </span>
                      <div>
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm sm:text-base font-extrabold text-white font-display tracking-tight">
                            {currentLanguage === 'sl' 
                              ? `${myThisSundayDuties.length} ${myThisSundayDuties.length === 1 ? 'zadolžitev' : myThisSundayDuties.length === 2 ? 'zadolžitvi' : myThisSundayDuties.length <= 4 ? 'zadolžitve' : 'zadolžitev'} to nedeljo` 
                              : `${myThisSundayDuties.length} assignment${myThisSundayDuties.length > 1 ? 's' : ''} this Sunday`}
                          </span>
                          <span className="text-xs text-emerald-300 font-mono font-medium">
                            ({formatToEuropeanDate(nextSunday.date)})
                          </span>
                        </div>
                        <p className="text-[11px] text-white/75 font-sans">
                          {currentLanguage === 'sl' 
                            ? 'Kliknite na posamezno službo za takojšen ogled ali kontrolni seznam:' 
                            : 'Click any assignment below to view details or launch its checklist:'}
                        </p>
                      </div>
                    </div>

                    {/* Schedule / Calendar Drawer Toggle */}
                    {myUpcomingServingSchedule.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowMyServingCalendar(!showMyServingCalendar)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border shadow-xs active:scale-95 ${
                          showMyServingCalendar
                            ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold shadow-md'
                            : 'bg-white/15 hover:bg-white/25 text-white border-white/20'
                        }`}
                        title={currentLanguage === 'sl' ? 'Prikaži vse prihajajoče nedelje služenja' : 'View all upcoming serving dates'}
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          {currentLanguage === 'sl' 
                            ? `Moj razpored (${myUpcomingServingSchedule.length})` 
                            : `My Schedule (${myUpcomingServingSchedule.length})`}
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showMyServingCalendar ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>

                  {/* Phase Flow Grid (Before / During / After) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                    {beforeDuties.length > 0 && (
                      <div className="bg-white/10 rounded-xl p-2.5 border border-sky-400/30 flex flex-col justify-between gap-2 backdrop-blur-xs">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-sky-200 pb-1 border-b border-white/10">
                          <span className="flex items-center gap-1.5">
                            <span>🌅</span>
                            <span className="uppercase tracking-wider font-mono font-bold">
                              {currentLanguage === 'sl' ? 'Pred bogoslužjem' : 'Before Service'}
                            </span>
                          </span>
                          <span className="text-[10px] text-sky-300/80 font-mono">09:00 - 09:45</span>
                        </div>
                        <div className="space-y-1.5">
                          {beforeDuties.map((duty, idx) => {
                            const minName = currentLanguage === 'sl' ? duty.ministry.nameSl : duty.ministry.nameEn;
                            const emoji = getMinistryIconEmoji(duty.ministry.id);
                            return (
                              <button
                                key={`before-${duty.ministry.id}-${idx}`}
                                type="button"
                                onClick={(e) => handleServingDutyClick(duty.ministry, e)}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/40 text-white font-medium text-xs flex items-center justify-between gap-2 transition cursor-pointer group shadow-2xs active:scale-98"
                                title={duty.actionTooltip}
                              >
                                <span className="flex items-center gap-1.5 truncate">
                                  <span>{emoji}</span>
                                  <span className="truncate font-semibold">{minName}</span>
                                </span>
                                <ExternalLink className="w-3 h-3 text-sky-300 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition shrink-0" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {duringDuties.length > 0 && (
                      <div className="bg-white/10 rounded-xl p-2.5 border border-emerald-400/30 flex flex-col justify-between gap-2 backdrop-blur-xs">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-200 pb-1 border-b border-white/10">
                          <span className="flex items-center gap-1.5">
                            <span>⛪</span>
                            <span className="uppercase tracking-wider font-mono font-bold">
                              {currentLanguage === 'sl' ? 'Med bogoslužjem' : 'During Service'}
                            </span>
                          </span>
                          <span className="text-[10px] text-emerald-300/80 font-mono">10:00 - 11:30</span>
                        </div>
                        <div className="space-y-1.5">
                          {duringDuties.map((duty, idx) => {
                            const minName = currentLanguage === 'sl' ? duty.ministry.nameSl : duty.ministry.nameEn;
                            const emoji = getMinistryIconEmoji(duty.ministry.id);
                            return (
                              <button
                                key={`during-${duty.ministry.id}-${idx}`}
                                type="button"
                                onClick={(e) => handleServingDutyClick(duty.ministry, e)}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/40 text-white font-medium text-xs flex items-center justify-between gap-2 transition cursor-pointer group shadow-2xs active:scale-98"
                                title={duty.actionTooltip}
                              >
                                <span className="flex items-center gap-1.5 truncate">
                                  <span>{emoji}</span>
                                  <span className="truncate font-semibold">{minName}</span>
                                </span>
                                <ExternalLink className="w-3 h-3 text-emerald-300 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition shrink-0" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {afterDuties.length > 0 && (
                      <div className="bg-white/10 rounded-xl p-2.5 border border-amber-400/30 flex flex-col justify-between gap-2 backdrop-blur-xs">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-amber-200 pb-1 border-b border-white/10">
                          <span className="flex items-center gap-1.5">
                            <span>🧹</span>
                            <span className="uppercase tracking-wider font-mono font-bold">
                              {currentLanguage === 'sl' ? 'Po bogoslužju' : 'After Service'}
                            </span>
                          </span>
                          <span className="text-[10px] text-amber-300/80 font-mono">11:30+</span>
                        </div>
                        <div className="space-y-1.5">
                          {afterDuties.map((duty, idx) => {
                            const minName = currentLanguage === 'sl' ? duty.ministry.nameSl : duty.ministry.nameEn;
                            const emoji = getMinistryIconEmoji(duty.ministry.id);
                            return (
                              <button
                                key={`after-${duty.ministry.id}-${idx}`}
                                type="button"
                                onClick={(e) => handleServingDutyClick(duty.ministry, e)}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 text-white font-medium text-xs flex items-center justify-between gap-2 transition cursor-pointer group shadow-2xs active:scale-98"
                                title={duty.actionTooltip}
                              >
                                <span className="flex items-center gap-1.5 truncate">
                                  <span>{emoji}</span>
                                  <span className="truncate font-semibold">{minName}</span>
                                </span>
                                <ExternalLink className="w-3 h-3 text-amber-300 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition shrink-0" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Expanded Upcoming Serving Schedule */}
                  {showMyServingCalendar && (
                    <div className="mt-3 pt-3 border-t border-white/15 space-y-2.5 animate-fade-in">
                      <div className="flex items-center justify-between text-xs text-white/90">
                        <span className="font-bold flex items-center gap-1.5 text-amber-300">
                          <Calendar className="w-4 h-4" />
                          <span>{currentLanguage === 'sl' ? 'Vaš koledar služenja za naslednje mesece:' : 'Your upcoming serving schedule:'}</span>
                        </span>
                        {onOpenSwapModal && (
                          <button
                            type="button"
                            onClick={onOpenSwapModal}
                            className="text-[11px] bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-lg border border-white/20 transition cursor-pointer flex items-center gap-1 text-white active:scale-95"
                          >
                            <ArrowRightLeft className="w-3 h-3 text-amber-300" />
                            <span>{currentLanguage === 'sl' ? 'Zamenjava' : 'Swap'}</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {myUpcomingServingSchedule.map((entry, eIdx) => {
                          return (
                            <div
                              key={`upcoming-entry-${entry.sunday.id}-${eIdx}`}
                              className={`p-2.5 rounded-xl border transition ${
                                entry.isThisSunday
                                  ? 'bg-emerald-500/25 border-emerald-400/50 shadow-xs'
                                  : 'bg-black/25 border-white/15 hover:bg-black/35'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1.5 pb-1.5 border-b border-white/10 text-xs">
                                <span className="font-bold font-mono text-white flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-indigo-300" />
                                  <span>{formatToEuropeanDate(entry.date)}</span>
                                </span>
                                {entry.isThisSunday ? (
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-400 text-emerald-950">
                                    {currentLanguage === 'sl' ? 'To nedeljo' : 'This Sunday'}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => onSelectSunday(entry.sunday.id)}
                                    className="text-[10px] text-sky-300 hover:text-white underline cursor-pointer font-medium"
                                  >
                                    {currentLanguage === 'sl' ? 'Odpri razpored' : 'Open Schedule'}
                                  </button>
                                )}
                              </div>
                              <div className="pt-1.5 space-y-1">
                                {entry.duties.map((d, dIdx) => (
                                  <div key={`entry-duty-${d.ministry.id}-${dIdx}`} className="flex items-center justify-between text-[11px] text-white/90">
                                    <span className="flex items-center gap-1 truncate">
                                      <span>{getMinistryIconEmoji(d.ministry.id)}</span>
                                      <span className="truncate">{currentLanguage === 'sl' ? d.ministry.nameSl : d.ministry.nameEn}</span>
                                    </span>
                                    <span className="text-[10px] text-white/60 font-mono shrink-0 ml-1">{d.phaseLabel}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Card when activePerson is NOT serving this Sunday */
                <div className="bg-black/25 backdrop-blur-md rounded-2xl p-3.5 sm:p-4 border border-white/15 shadow-md space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-white/15 border border-white/20 text-amber-300 text-sm">
                        ✨
                      </span>
                      <div>
                        <span className="text-xs sm:text-sm font-bold text-white font-display block">
                          {currentLanguage === 'sl' ? 'To nedeljo nimaš razporejenih služb' : 'No duties scheduled for this Sunday'}
                        </span>
                        {nextServingScheduleEntry && (
                          <span className="text-[11px] text-white/80 font-mono">
                            {currentLanguage === 'sl' 
                              ? `Naslednje služenje: ${formatToEuropeanDate(nextServingScheduleEntry.date)} (${nextServingScheduleEntry.duties.map(d => currentLanguage === 'sl' ? d.ministry.nameSl : d.ministry.nameEn).join(', ')})`
                              : `Next duty: ${formatToEuropeanDate(nextServingScheduleEntry.date)} (${nextServingScheduleEntry.duties.map(d => currentLanguage === 'sl' ? d.ministry.nameSl : d.ministry.nameEn).join(', ')})`}
                          </span>
                        )}
                      </div>
                    </div>

                    {myUpcomingServingSchedule.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowMyServingCalendar(!showMyServingCalendar)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border shadow-xs active:scale-95 ${
                          showMyServingCalendar
                            ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold shadow-md'
                            : 'bg-white/15 hover:bg-white/25 text-white border-white/20'
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          {currentLanguage === 'sl' 
                            ? `Moj koledar (${myUpcomingServingSchedule.length})` 
                            : `My Schedule (${myUpcomingServingSchedule.length})`}
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showMyServingCalendar ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>

                  {/* Expanded Upcoming Serving Schedule */}
                  {showMyServingCalendar && (
                    <div className="mt-3 pt-3 border-t border-white/15 space-y-2 animate-fade-in">
                      <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        <span>{currentLanguage === 'sl' ? 'Vaša prihajajoča služenja:' : 'Your upcoming serving dates:'}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {myUpcomingServingSchedule.map((entry, eIdx) => (
                          <div
                            key={`upcoming-rest-${entry.sunday.id}-${eIdx}`}
                            className="p-2.5 rounded-xl border bg-black/25 border-white/15 hover:bg-black/35 transition"
                          >
                            <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-white/10 text-xs">
                              <span className="font-bold font-mono text-white flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-indigo-300" />
                                <span>{formatToEuropeanDate(entry.date)}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => onSelectSunday(entry.sunday.id)}
                                className="text-[10px] text-sky-300 hover:text-white underline cursor-pointer font-medium"
                              >
                                {currentLanguage === 'sl' ? 'Odpri razpored' : 'Open Schedule'}
                              </button>
                            </div>
                            <div className="pt-1.5 space-y-1">
                              {entry.duties.map((d, dIdx) => (
                                <div key={`entry-rest-duty-${d.ministry.id}-${dIdx}`} className="flex items-center justify-between text-[11px] text-white/90">
                                  <span className="flex items-center gap-1 truncate">
                                    <span>{getMinistryIconEmoji(d.ministry.id)}</span>
                                    <span className="truncate">{currentLanguage === 'sl' ? d.ministry.nameSl : d.ministry.nameEn}</span>
                                  </span>
                                  <span className="text-[10px] text-white/60 font-mono shrink-0 ml-1">{d.phaseLabel}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* General Next Sunday Summary when no active person is selected */
            <div className="flex items-center gap-2 text-white/90 text-xs py-1">
              <span className="flex items-center gap-1 text-white/80">
                <Calendar className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                <span>{currentLanguage === 'sl' ? 'Naslednje bogoslužje:' : 'Next Service:'}</span>
              </span>
              <span className="font-bold text-white bg-white/15 px-2 py-0.5 rounded-md border border-white/20 text-[11px] font-mono">
                {formatToEuropeanDate(nextSunday.date)}
              </span>
              <span className="text-[11px] bg-white/10 px-2 py-0.5 rounded-md border border-white/15 text-indigo-100 font-medium">
                {nextSundayFocusLabel}
              </span>
            </div>
          )}

          {/* Bottom Community & Ecosystem Live Metrics */}
          <div className="pt-1.5 flex flex-wrap items-center justify-between gap-2.5 text-[11px] font-mono text-white/90 border-t border-white/10">
            <div className="flex flex-wrap items-center gap-1.5">
              <span 
                className="px-2 py-0.5 bg-white/10 rounded-lg border border-white/15 flex items-center gap-1 shadow-2xs backdrop-blur-xs" 
                title={currentLanguage === 'sl' 
                  ? `Šolsko leto 2026/2027: ${completedSchoolSundaysCount} zaključenih nedelj, še ${upcomingSchoolSundays.length} pred nami (skupaj ${activeSchoolSundays.length})` 
                  : `School Year 2026/2027: ${completedSchoolSundaysCount} completed, ${upcomingSchoolSundays.length} upcoming (${activeSchoolSundays.length} total)`}
              >
                📅 <strong className="text-white font-bold">{upcomingSchoolSundays.length}/{activeSchoolSundays.length}</strong> {currentLanguage === 'sl' ? 'nedelj' : 'Sundays'}
              </span>
              <span 
                className="px-2 py-0.5 bg-white/10 rounded-lg border border-white/15 flex items-center gap-1 shadow-2xs backdrop-blur-xs" 
                title={currentLanguage === 'sl' ? 'Aktivne službe v cerkvi' : 'Active church ministries'}
              >
                📋 <strong className="text-white font-bold">{ministries.length}</strong> {currentLanguage === 'sl' ? 'služb' : 'ministries'}
              </span>
              <span 
                className="px-2 py-0.5 bg-white/10 rounded-lg border border-white/15 flex items-center gap-1 shadow-2xs backdrop-blur-xs" 
                title={currentLanguage === 'sl' ? `Aktivni sodelavci z dodeljenimi ali prednostnimi službami (${activeServantsCount} od skupaj ${people.length} v bazi)` : `Active servants with ministry duties (${activeServantsCount} of ${people.length} total)`}
              >
                👥 <strong className="text-white font-bold">{activeServantsCount}</strong> {currentLanguage === 'sl' ? 'aktivnih' : 'active'}
              </span>
            </div>

            {onOpenVisitorModal && (
              <button
                type="button"
                onClick={onOpenVisitorModal}
                className="px-2 py-0.5 bg-amber-400/25 hover:bg-amber-400/40 text-amber-200 rounded-lg border border-amber-300/35 cursor-pointer transition flex items-center gap-1 active:scale-95 shadow-2xs"
                title={currentLanguage === 'sl' 
                  ? `Evidenca obiskovalcev: ${totalVisitorHeadcount} oseb (${visitors.length} vnosov / skupin)` 
                  : `Visitor tracker: ${totalVisitorHeadcount} visitors (${visitors.length} entries / groups)`}
              >
                <Coffee className="w-3 h-3 text-amber-300" />
                <span><strong className="text-white font-bold">{totalVisitorHeadcount}</strong> {currentLanguage === 'sl' ? (totalVisitorHeadcount === 1 ? 'obiskovalec' : totalVisitorHeadcount === 2 ? 'obiskovalca' : 'obiskovalcev') : (totalVisitorHeadcount === 1 ? 'visitor' : 'visitors')}</span>
              </button>
            )}
          </div>
        </div>
      </HeroHeaderBanner>

      {/* Responsive Grid Layout for PC vs Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Main Column on Desktop (Next Sunday overview + Vacant Roles) */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* Primary: Executive Summary of Next Sunday */}
          <div id="next-service-overview" className="bg-white rounded-2xl shadow-2xs border border-gray-200/90 p-5 space-y-4">
            {/* Header: Date, Focus & Direct Link */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl shrink-0 border border-indigo-100 shadow-2xs">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-indigo-600 uppercase font-bold font-mono tracking-wider block">
                    📅 {translations.nextSunday}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 font-display truncate">
                    {formatToEuropeanDate(nextSunday.date)}
                  </h3>
                </div>
              </div>
              
              <button
                onClick={() => onSelectSunday(nextSunday.id)}
                id="btn-next-sunday-details"
                className="text-xs bg-slate-50 hover:bg-indigo-50 hover:text-indigo-900 text-slate-700 py-1.5 px-3 rounded-xl border border-slate-200 flex items-center gap-1.5 transition font-semibold cursor-pointer shrink-0 shadow-2xs active:scale-95"
              >
                <span>{currentLanguage === 'sl' ? 'Odpri razpored' : 'Open Schedule'}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>

            {/* Theme & Special Sunday Focus Banner */}
            {(() => {
              const effFocus = getEffectiveSundayFocus(nextSunday);
              const sundayTheme = (currentLanguage === 'sl' ? nextSunday.themeSl : nextSunday.themeEn) || (currentLanguage === 'sl' ? 'Nedeljsko bogoslužje' : 'Sunday Service');

              return (
                <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider font-mono">
                      {translations.themeLabel}
                    </span>
                    <span className="font-bold text-slate-900 text-sm block truncate" title={sundayTheme}>
                      📖 {sundayTheme}
                    </span>
                  </div>

                  {effFocus.type === 'communion' ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-lg text-xs font-semibold shrink-0 shadow-2xs">
                      <span>🍷🍞</span>
                      <span>{currentLanguage === 'sl' ? 'Gospodova večerja' : "Lord's Supper"}</span>
                    </div>
                  ) : effFocus.type === 'prayer_focus' ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg text-xs font-semibold shrink-0 shadow-2xs">
                      <span>🙏</span>
                      <span>{currentLanguage === 'sl' ? 'Molitev za družino:' : 'Prayer for Family:'} <strong className="text-indigo-950 font-bold">{userRole === 'Viewer' ? (currentLanguage === 'sl' ? 'Oznanjena družina' : 'Featured Family') : (effFocus.prayerFocus?.familyNameOrPerson || '—')}</strong></span>
                    </div>
                  ) : null}
                </div>
              );
            })()}

            {/* 5 Key Responsibility Leaders for this Sunday */}
            {(() => {
              const rawPreacher = (nextSunday.assignments?.['ucenje'] || [])[0] || (nextSunday.assignments?.['sermon_prayer'] || [])[0] || nextSunday.guest || '';
              const rawWorshipLeader = (nextSunday.assignments?.['uvod_slavljenje'] || [])[0] || (nextSunday.assignments?.['slavilna_ekipa'] || [])[0] || '';
              const rawYoungerTeacher = (nextSunday.assignments?.['nedeljska_sola_mlajsa'] || [])[0] || '';
              const rawOlderTeacher = (nextSunday.assignments?.['nedeljska_sola_starejsa'] || [])[0] || '';
              const rawHospitalityLead = (nextSunday.assignments?.['gostoljubje'] || [])[0] || (nextSunday.assignments?.['kava'] || [])[0] || '';

              const isViewer = userRole === 'Viewer';
              const preacher = isViewer ? getFirstName(rawPreacher) : rawPreacher;
              const worshipLeader = isViewer ? getFirstName(rawWorshipLeader) : rawWorshipLeader;
              const youngerTeacher = isViewer ? getFirstName(rawYoungerTeacher) : rawYoungerTeacher;
              const olderTeacher = isViewer ? getFirstName(rawOlderTeacher) : rawOlderTeacher;
              const hospitalityLead = isViewer ? getFirstName(rawHospitalityLead) : rawHospitalityLead;

              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Crown className="w-3.5 h-3.5 text-amber-500" />
                      <span>{currentLanguage === 'sl' ? 'Glavni nosilci služb te nedelje:' : 'Key Service Leaders This Sunday:'}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    {/* 1. Preacher */}
                    <div 
                      onClick={() => onSelectSunday(nextSunday.id, 'ucenje', 'sermon_prayer')}
                      className="p-2.5 rounded-xl border border-slate-200/90 border-l-4 border-l-sky-500 bg-gradient-to-r from-sky-50/40 via-white to-white hover:border-sky-400 hover:shadow-xs transition cursor-pointer flex flex-col justify-between"
                      title={preacher || (currentLanguage === 'sl' ? 'Ni določeno' : 'Not assigned')}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-sky-800 uppercase tracking-wider mb-1">
                        <span>📖</span>
                        <span className="truncate">{currentLanguage === 'sl' ? 'Pridiga' : 'Preaching'}</span>
                      </div>
                      <div className="font-bold text-xs text-slate-900 truncate">
                        {preacher || <span className="text-slate-400 font-normal italic text-[11px]">— Ni določeno —</span>}
                      </div>
                    </div>

                    {/* 2. Worship Leader */}
                    <div 
                      onClick={() => onSelectSunday(nextSunday.id, 'slavilna_ekipa', 'worship')}
                      className="p-2.5 rounded-xl border border-slate-200/90 border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50/40 via-white to-white hover:border-purple-400 hover:shadow-xs transition cursor-pointer flex flex-col justify-between"
                      title={worshipLeader || (currentLanguage === 'sl' ? 'Ni določeno' : 'Not assigned')}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-purple-800 uppercase tracking-wider mb-1">
                        <span>🎵</span>
                        <span className="truncate">{currentLanguage === 'sl' ? 'Slavljenje' : 'Worship'}</span>
                      </div>
                      <div className="font-bold text-xs text-slate-900 truncate">
                        {worshipLeader || <span className="text-slate-400 font-normal italic text-[11px]">— Ni določeno —</span>}
                      </div>
                    </div>

                    {/* 3. Younger Kids School */}
                    <div 
                      onClick={() => onSelectSunday(nextSunday.id, 'nedeljska_sola_mlajsa', 'kids')}
                      className="p-2.5 rounded-xl border border-slate-200/90 border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-50/40 via-white to-white hover:border-emerald-400 hover:shadow-xs transition cursor-pointer flex flex-col justify-between"
                      title={youngerTeacher || (currentLanguage === 'sl' ? 'Ni določeno' : 'Not assigned')}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider mb-1">
                        <span>👶</span>
                        <span className="truncate">{currentLanguage === 'sl' ? 'Šola (3–9 let)' : 'Kids (3–9)'}</span>
                      </div>
                      <div className="font-bold text-xs text-slate-900 truncate">
                        {youngerTeacher || <span className="text-slate-400 font-normal italic text-[11px]">— Ni določeno —</span>}
                      </div>
                    </div>

                    {/* 4. Older Kids School */}
                    <div 
                      onClick={() => onSelectSunday(nextSunday.id, 'nedeljska_sola_starejsa', 'kids')}
                      className="p-2.5 rounded-xl border border-slate-200/90 border-l-4 border-l-teal-500 bg-gradient-to-r from-teal-50/40 via-white to-white hover:border-teal-400 hover:shadow-xs transition cursor-pointer flex flex-col justify-between"
                      title={olderTeacher || (currentLanguage === 'sl' ? 'Ni določeno' : 'Not assigned')}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-teal-800 uppercase tracking-wider mb-1">
                        <span>🎓</span>
                        <span className="truncate">{currentLanguage === 'sl' ? 'Šola (10–15+)' : 'Kids (10–15+)'}</span>
                      </div>
                      <div className="font-bold text-xs text-slate-900 truncate">
                        {olderTeacher || <span className="text-slate-400 font-normal italic text-[11px]">— Ni določeno —</span>}
                      </div>
                    </div>

                    {/* 5. Hospitality & Coffee */}
                    <div 
                      onClick={() => onSelectSunday(nextSunday.id, 'gostoljubje', 'hospitality')}
                      className="p-2.5 rounded-xl border border-slate-200/90 border-l-4 border-l-rose-400 bg-gradient-to-r from-rose-50/40 via-white to-white hover:border-rose-300 hover:shadow-xs transition cursor-pointer flex flex-col justify-between col-span-2 sm:col-span-1"
                      title={hospitalityLead || (currentLanguage === 'sl' ? 'Ni določeno' : 'Not assigned')}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-rose-800 uppercase tracking-wider mb-1">
                        <span>☕</span>
                        <span className="truncate">{currentLanguage === 'sl' ? 'Gostoljubje' : 'Hospitality'}</span>
                      </div>
                      <div className="font-bold text-xs text-slate-900 truncate">
                        {hospitalityLead || <span className="text-slate-400 font-normal italic text-[11px]">— Ni določeno —</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Coverage Progress Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-gray-500 font-mono text-[11px] uppercase tracking-wider">{translations.coverage}</span>
                <span className={coveragePercent === 100 ? "text-emerald-700 font-bold" : "text-gray-700 font-mono"}>
                  {coveragePercent}% ({assignedSlots}/{totalSlots})
                </span>
              </div>
              <div className="w-full bg-gray-100/80 rounded-full h-2 overflow-hidden flex border border-gray-200/35">
                <div 
                  style={{ width: `${coveragePercent}%` }} 
                  className={`h-full transition-all duration-300 ${coveragePercent === 100 ? 'bg-emerald-500' : 'bg-[#4338CA]'}`} 
                />
              </div>
            </div>

            {/* Quick Actions Panel directly on sunday card (Hidden for Viewers) */}
            {userRole !== 'Viewer' && (
              <div className="pt-3 border-t border-gray-150 grid grid-cols-3 gap-2">
                <button
                  onClick={() => setShowQuickAssign(!showQuickAssign)}
                  id="action-assign-person"
                  className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl transition cursor-pointer font-sans text-xs font-bold border shadow-2xs active:scale-95 ${
                    showQuickAssign 
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs' 
                      : 'bg-indigo-50 hover:bg-indigo-100/80 text-indigo-900 border-indigo-200/80'
                  }`}
                >
                  <UserPlus className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="truncate">{currentLanguage === 'sl' ? 'Dodeli sodelavca' : 'Assign Person'}</span>
                </button>

                <button
                  onClick={() => onSelectSunday(nextSunday.id)}
                  id="action-edit-sunday"
                  className="flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 transition cursor-pointer border border-slate-200/80 font-sans text-xs font-bold shadow-2xs active:scale-95"
                >
                  <Edit className="w-4 h-4 text-slate-600 shrink-0" />
                  <span className="truncate">{currentLanguage === 'sl' ? 'Uredi nedeljo' : 'Edit Sunday'}</span>
                </button>

                <button
                  onClick={handleDuplicateWeek}
                  id="action-duplicate-week"
                  className="flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 transition cursor-pointer border border-slate-200/80 font-sans text-xs font-bold shadow-2xs active:scale-95"
                >
                  <Copy className="w-4 h-4 text-slate-600 shrink-0" />
                  <span className="truncate">{currentLanguage === 'sl' ? 'Kopiraj teden' : 'Duplicate Week'}</span>
                </button>
              </div>
            )}

            {/* Quick Assign Form Container (Collapsible Roster Helper - Only for non-viewers) */}
            {userRole !== 'Viewer' && showQuickAssign && (
              <div id="quick-assign-dropdown-drawer" className="p-4 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-3 mt-3 animate-fade-in text-xs text-slate-800">
                <div className="flex items-center justify-between">
                  <strong className="text-[#312E81] text-xs font-mono font-bold uppercase tracking-wider block">
                    👤 {currentLanguage === 'sl' ? 'Hitra Dodelitev Sodelavca' : 'Quick Assign Volunteer'}
                  </strong>
                  <button onClick={() => setShowQuickAssign(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer mb-0.5 select-none font-bold">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-indigo-700 mb-1 font-mono tracking-wider">
                      {currentLanguage === 'sl' ? 'Prosto mesto' : 'Select Vacant Role'}
                    </label>
                    <select
                      value={selectedVacantId}
                      onChange={(e) => {
                        setSelectedVacantId(e.target.value);
                        setSelectedPersonName('');
                      }}
                      className="w-full text-xs px-3 py-2 bg-white border border-indigo-200 rounded-lg focus:outline-none focus:border-indigo-500 font-semibold cursor-pointer shadow-2xs text-slate-900"
                    >
                      <option value="">-- {currentLanguage === 'sl' ? 'Izberi prazno službo' : 'Select vacant title'} --</option>
                      {(() => {
                        const categoryOrder: Array<{ id: string; labelSl: string; labelEn: string }> = [
                          { id: 'cleaning', labelSl: '🧹 PRIPRAVA & ČIŠČENJE', labelEn: '🧹 SETUP & CLEANING' },
                          { id: 'hospitality', labelSl: '☕ GOSTOLJUBJE & KAVA', labelEn: '☕ HOSPITALITY & SNACKS' },
                          { id: 'sermon_prayer', labelSl: '📖 BOGOSLUŽJE & MOLITEV', labelEn: '📖 MAIN SERVICE & PRAYER' },
                          { id: 'worship', labelSl: '🎵 SLAVLJENJE', labelEn: '🎵 WORSHIP TEAM' },
                          { id: 'audio_video', labelSl: '🎥 AVDIO & VIDEO', labelEn: '🎥 AUDIO & VIDEO' },
                          { id: 'kids', labelSl: '👶 NEDELJSKA ŠOLA', labelEn: '👶 SUNDAY KIDS SCHOOL' },
                          { id: 'post_service', labelSl: '🤝 PO BOGOSLUŽJU & FINANCE', labelEn: '🤝 POST-SERVICE & FINANCE' },
                          { id: 'other', labelSl: '📌 OSTALO', labelEn: '📌 OTHER' },
                        ];

                        const groups = categoryOrder.map(cat => {
                          const items = vacantMinistries.filter(m => {
                            if (cat.id === 'audio_video') return m.category === 'audio_video' || m.category === 'av_tech';
                            if (cat.id === 'other') return !['cleaning', 'hospitality', 'sermon_prayer', 'worship', 'audio_video', 'av_tech', 'kids', 'post_service'].includes(m.category);
                            return m.category === cat.id;
                          });
                          return { ...cat, items };
                        }).filter(g => g.items.length > 0);

                        return groups.map(group => (
                          <optgroup key={group.id} label={currentLanguage === 'sl' ? group.labelSl : group.labelEn}>
                            {group.items.map(m => {
                              const emoji = getMinistryIconEmoji(m.id);
                              const name = currentLanguage === 'sl' ? m.nameSl : m.nameEn;
                              return (
                                <option key={m.id} value={m.id}>
                                  {emoji} {name}
                                </option>
                              );
                            })}
                          </optgroup>
                        ));
                      })()}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase font-bold text-indigo-700 mb-1 font-mono tracking-wider">
                      🔍 {currentLanguage === 'sl' ? 'Išči osebo v ekipi' : 'Search & Select Person'}
                    </label>
                    <input
                      type="text"
                      value={rosterSearchQuery}
                      onChange={(e) => {
                        setRosterSearchQuery(e.target.value);
                        setSelectedPersonName('');
                      }}
                      placeholder={currentLanguage === 'sl' ? 'Vtipkajte ime (npr. Aleš, Urh, Dejan)...' : 'Type name (e.g. Aleš, Urh, Dejan)...'}
                      className="w-full text-xs px-3 py-2 bg-white border border-indigo-200 rounded-lg focus:outline-none focus:border-indigo-500 font-medium placeholder:text-gray-400 font-mono shadow-2xs"
                    />

                    {/* Filtered Available Volunteer Selection Pills */}
                    {(() => {
                      const query = rosterSearchQuery.toLowerCase().trim();
                      const rawPeople = (people || []).filter(p => p && p.name && !p.isArchived && !p.isVisitor);
                      const matchingPeople = rawPeople.filter(p => !query || p.name.toLowerCase().includes(query));

                      if (matchingPeople.length === 0) {
                        return (
                          <p className="text-[11px] text-rose-500 italic mt-1.5 font-mono">
                            {currentLanguage === 'sl' ? 'Oseba ni bila najdena v bazi ekipe.' : 'No matching volunteer found in roster.'}
                          </p>
                        );
                      }

                      const effectiveBlackouts = blackoutDates || [];
                      const nextSundayDate = nextSunday?.date || '';

                      const decoratedPeople = matchingPeople.map(p => {
                        const prefList = (p.preferredMinistries || []).map(m => m.toLowerCase());
                        const ledList = (p.ledMinistries || []).map(m => m.toLowerCase());
                        const vId = (selectedVacantId || '').toLowerCase();

                        const isPreferred = vId ? (
                          prefList.includes(vId) ||
                          ledList.includes(vId) ||
                          (vId === 'nedeljska_sola_mlajsa' && (prefList.includes('nedeljska_sola_mlajsa') || prefList.includes('otroško služenje - mlajša'))) ||
                          (vId === 'nedeljska_sola_starejsa' && (prefList.includes('nedeljska_sola_starejsa') || prefList.includes('otroško služenje - starejša'))) ||
                          (vId === 'slavilna_ekipa' && (prefList.includes('slavilna_ekipa') || prefList.includes('uvod_slavljenje')))
                        ) : false;

                        const { isAbsent, reason: absenceReason } = checkPersonAbsenceOnSunday(
                          p.name,
                          nextSundayDate,
                          effectiveBlackouts
                        );

                        return {
                          person: p,
                          isPreferred,
                          isAbsent,
                          absenceReason
                        };
                      });

                      // Sort: Starred / Preferred volunteers FIRST, then non-absent, then absent at bottom, alphabetically within each group
                      decoratedPeople.sort((a, b) => {
                        // 1. Absent to the bottom
                        if (a.isAbsent && !b.isAbsent) return 1;
                        if (!a.isAbsent && b.isAbsent) return -1;

                        // 2. Starred / Preferred to the top
                        if (a.isPreferred && !b.isPreferred) return -1;
                        if (!a.isPreferred && b.isPreferred) return 1;

                        // 3. Alphabetical
                        return a.person.name.localeCompare(b.person.name, 'sl', { sensitivity: 'base' });
                      });

                      const preferredCount = decoratedPeople.filter(d => d.isPreferred && !d.isAbsent).length;

                      return (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="block text-[9px] font-bold text-gray-500 font-mono uppercase tracking-wider">
                              {currentLanguage === 'sl' ? 'Izberite sodelavca s seznama:' : 'Choose volunteer from roster:'}
                            </label>
                            {selectedVacantId && preferredCount > 0 && (
                              <span className="text-[9px] font-mono font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-md border border-amber-300">
                                ⭐ {preferredCount} {currentLanguage === 'sl' ? 'predlaganih za to službo' : 'recommended for this role'}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-2 bg-white border border-indigo-150 rounded-xl shadow-2xs">
                            {decoratedPeople.map(({ person: p, isPreferred, isAbsent, absenceReason }) => {
                              const isSelected = selectedPersonName === p.name;

                              return (
                                <button
                                  type="button"
                                  key={p.id || p.name}
                                  onClick={() => setSelectedPersonName(p.name)}
                                  className={`text-xs px-2.5 py-1.5 rounded-lg transition font-medium border cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white border-indigo-700 font-bold shadow-2xs'
                                      : isAbsent
                                      ? 'bg-rose-50 text-rose-800 border-rose-200 opacity-60 hover:opacity-100'
                                      : isPreferred
                                      ? 'bg-amber-50 text-amber-950 border-amber-300 font-semibold shadow-2xs hover:bg-amber-100 ring-1 ring-amber-300/60'
                                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:text-indigo-900'
                                  }`}
                                  title={
                                    isAbsent
                                      ? `${p.name} (Odsoten/Dopust: ${absenceReason || 'Dopust'})`
                                      : isPreferred
                                      ? `${p.name} (Prednostna / dodeljena služba ⭐)`
                                      : p.name
                                  }
                                >
                                  <span>{p.name}</span>
                                  {isPreferred && <span className="text-[11px] text-amber-500 font-bold">⭐</span>}
                                  {isAbsent && <span className="text-[10px] text-rose-500 font-bold" title="Odsoten / dopust">🌴</span>}
                                  {isSelected && <span className="text-[10px] font-bold">✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex gap-2 pt-1.5">
                    <button
                      type="button"
                      onClick={handleQuickAssign}
                      disabled={!selectedVacantId || !selectedPersonName}
                      className="flex-grow py-2 bg-[#4338CA] text-white font-bold text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-[#4338CA] cursor-pointer transition active:scale-95"
                    >
                      {currentLanguage === 'sl' 
                        ? (selectedPersonName ? `Potrdi dodelitev: ${selectedPersonName}` : 'Potrdi dodelitev') 
                        : (selectedPersonName ? `Confirm Assignment: ${selectedPersonName}` : 'Confirm Assignment')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowQuickAssign(false);
                        setSelectedVacantId('');
                        setSelectedPersonName('');
                        setRosterSearchQuery('');
                      }}
                      className="px-3 py-2 bg-white text-gray-700 text-xs rounded-lg border border-gray-300 hover:bg-gray-50 font-semibold cursor-pointer transition active:scale-95"
                    >
                      {currentLanguage === 'sl' ? 'Prekliči' : 'Cancel'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Missing & Fulfilled Assignments Section */}
          <div id="missing-assignments-overview" className="bg-white rounded-2xl shadow-2xs border border-gray-200/90 p-5 space-y-4">
            {/* Header with Title & Percentage / Slots count */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider font-mono">
                  {translations.missingAssignments}
                </h3>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs bg-indigo-50 text-indigo-900 px-2.5 py-1 rounded-lg font-bold font-mono border border-indigo-200 shadow-2xs flex items-center gap-1.5">
                  <span>📊 {currentLanguage === 'sl' ? 'Pokritost:' : 'Coverage:'}</span>
                  <span className="text-indigo-700">{assignedSlots}/{totalSlots}</span>
                  <span className="bg-indigo-600 text-white px-1.5 py-0.2 rounded text-[10px] font-bold">
                    {coveragePercent}%
                  </span>
                </span>

                {vacantMinistries.length > 0 && (
                  <span className="text-xs bg-rose-100 text-rose-800 px-2.5 py-1 rounded-lg font-bold font-mono border border-rose-300 shadow-2xs">
                    {currentLanguage === 'sl' ? `Prosto: ${vacantMinistries.length}` : `Vacant: ${vacantMinistries.length}`}
                  </span>
                )}
              </div>
            </div>

            {/* 1. Vacant / Missing Roles */}
            {vacantMinistries.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1">
                    <span>⚠️ {currentLanguage === 'sl' ? 'Potrebno zapolniti' : 'Roles to be filled'} ({vacantMinistries.length}):</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-80 overflow-y-auto pr-1">
                  {vacantMinistries.map((ministry) => {
                    const emoji = getMinistryIconEmoji(ministry.id);
                    const borderClass = getCategoryBorderClass(ministry.category);
                    const iconBg = getCategoryIconBgClass(ministry.category);

                    return (
                      <button
                        key={ministry.id}
                        onClick={() => onSelectSunday(nextSunday.id, ministry.id, ministry.category)}
                        className={`text-left px-3 py-2.5 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl transition flex justify-between items-center group cursor-pointer shadow-2xs ${borderClass}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 border ${iconBg} shadow-2xs group-hover:scale-105 transition`}>
                            {emoji}
                          </div>
                          <div className="space-y-0.5 min-w-0">
                            <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition block truncate">
                              {currentLanguage === 'sl' ? ministry.nameSl : ministry.nameEn}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono block truncate capitalize">
                              {ministry.category.replace('_', ' ')}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-2 py-1 bg-rose-100 text-rose-800 border border-rose-300 font-mono font-bold text-[10px] uppercase rounded-md tracking-wider shadow-2xs">
                            ⚠️ {currentLanguage === 'sl' ? 'PROSTO' : 'VACANT'}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition shrink-0" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-emerald-50 text-emerald-950 border border-emerald-200 rounded-xl flex items-center gap-3 text-xs shadow-2xs">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold block text-emerald-950">{currentLanguage === 'sl' ? 'Čudovito! Vse službe so pokrite!' : 'Excellent! All roles are filled!'}</span>
                  <span className="text-emerald-800/85 text-[11px] block mt-0.5">{currentLanguage === 'sl' ? 'Sodelavci so uspešno razporejeni za vse službe.' : 'Roster checklist is fully completed.'}</span>
                </div>
              </div>
            )}

            {/* 2. Fulfilled / Filled Roles (at the bottom of the stack) */}
            {fulfilledMinistries.length > 0 && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{currentLanguage === 'sl' ? 'Zapolnjeno / Pokrito' : 'Filled & Fulfilled'} ({fulfilledMinistries.length}/{totalSlots}):</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                  {fulfilledMinistries.map((ministry) => {
                    const assignedPeople = resolveMinistryAssignments(nextSunday, ministry.id);
                    const emoji = getMinistryIconEmoji(ministry.id);
                    const borderClass = getCategoryBorderClass(ministry.category);
                    const iconBg = getCategoryIconBgClass(ministry.category);

                    return (
                      <button
                        key={ministry.id}
                        onClick={() => onSelectSunday(nextSunday.id, ministry.id, ministry.category)}
                        className={`text-left px-3 py-2 bg-slate-50/70 hover:bg-slate-100/80 border border-slate-200 rounded-xl transition flex justify-between items-center group cursor-pointer shadow-2xs ${borderClass}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 border ${iconBg}`}>
                            {emoji}
                          </div>
                          <div className="space-y-0.5 min-w-0">
                            <span className="text-xs font-semibold text-slate-800 group-hover:text-indigo-600 transition block truncate">
                              {currentLanguage === 'sl' ? ministry.nameSl : ministry.nameEn}
                            </span>
                            <span className="text-[10px] text-emerald-800 font-mono font-medium block truncate flex items-center gap-1">
                              <span>👤 {userRole === 'Viewer' ? (currentLanguage === 'sl' ? 'Dodeljeno sodelavcu' : 'Assigned') : assignedPeople.join(', ')}</span>
                            </span>
                          </div>
                        </div>

                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 font-mono font-bold text-[9px] uppercase rounded-md tracking-wider shrink-0 shadow-2xs">
                          ✓ {currentLanguage === 'sl' ? 'ZASEDENO' : 'FILLED'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar Column on Desktop: Quick Operations Panel */}
        <div className="space-y-5">
          {userRole === 'Viewer' ? (
            <div id="viewer-info-panel" className="bg-white rounded-2xl shadow-2xs border border-gray-200/90 p-5 space-y-4 font-sans">
              <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-base shadow-2xs border border-indigo-100">
                  ⛪
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider font-mono">
                    {currentLanguage === 'sl' ? 'Nedeljska Bogoslužja' : 'Sunday Services'}
                  </h3>
                  <span className="text-[10px] text-gray-500 font-medium block">
                    Krščanski center Kalvarija Celje
                  </span>
                </div>
              </div>

              <div className="space-y-3 text-xs text-gray-600">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-150 space-y-1">
                  <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span>⏰</span>
                    <span>{currentLanguage === 'sl' ? 'Vsako nedeljo ob 10:00' : 'Every Sunday at 10:00 AM'}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {currentLanguage === 'sl' 
                      ? 'Skupno slavljenje, Božja beseda ter vzporedna otroška nedeljska šola.'
                      : 'Corporate worship, Bible teaching, and kids Sunday school classes.'}
                  </p>
                </div>

                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-indigo-950 text-[11px] space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-indigo-900">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{currentLanguage === 'sl' ? 'Dostop pregledovalca (Viewer)' : 'Viewer Access Mode'}</span>
                  </div>
                  <p className="text-indigo-900/80 leading-relaxed">
                    {currentLanguage === 'sl'
                      ? 'Prijavljeni ste kot pregledovalec. Za vključitev v strežniško ekipo ali dodelitev vloge sodelavca kontaktirajte vodstvo cerkve.'
                      : 'You are signed in as a viewer. To join a service team or request servant access, please contact church leadership.'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div id="quick-actions-panel" className="bg-white rounded-2xl shadow-2xs border border-gray-200/90 p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 font-mono flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{currentLanguage === 'sl' ? 'Hitra Orodja & Operacije' : 'Quick Operations & Tools'}</span>
                </h3>
              </div>

            <div className="flex flex-col gap-2">
              {/* 1. Live Sunday Attendance Check-in */}
              {onOpenCheckInModal && (
                <button
                  type="button"
                  onClick={onOpenCheckInModal}
                  className="p-3 bg-emerald-50/60 hover:bg-emerald-100/70 border border-emerald-200/80 rounded-xl transition flex items-center gap-3 text-left group cursor-pointer"
                >
                  <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg group-hover:scale-105 transition shrink-0">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-emerald-950 block leading-tight group-hover:text-emerald-900 transition">
                      {currentLanguage === 'sl' ? 'Prisotnost & Število ljudi' : 'Live Attendance & Headcount'}
                    </span>
                    <span className="text-[10px] text-emerald-800/80 block truncate mt-0.5 font-sans">
                      {currentLanguage === 'sl' ? 'Beleži prihod sodelavcev in obiskovalcev' : 'Check-in team servants & Sunday headcount'}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-emerald-600/70 group-hover:translate-x-0.5 transition shrink-0" />
                </button>
              )}

              {/* 2. Shift Swap Board */}
              {onOpenSwapModal && (
                <button
                  type="button"
                  onClick={onOpenSwapModal}
                  className="p-3 bg-indigo-50/60 hover:bg-indigo-100/70 border border-indigo-200/80 rounded-xl transition flex items-center gap-3 text-left group cursor-pointer"
                >
                  <div className="p-2 bg-indigo-100 text-indigo-800 rounded-lg group-hover:scale-105 transition shrink-0">
                    <ArrowRightLeft className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-indigo-950 block leading-tight group-hover:text-indigo-900 transition">
                      {currentLanguage === 'sl' ? 'Menjava Služb' : 'Swap Board'}
                    </span>
                    <span className="text-[10px] text-indigo-800/80 block truncate mt-0.5 font-sans">
                      {currentLanguage === 'sl' ? 'Zaprosi za menjavo ali sprejmi dežurstvo' : 'Request substitution or accept open shift'}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-indigo-600/70 group-hover:translate-x-0.5 transition shrink-0" />
                </button>
              )}

              {/* 3. Vacation & Blackout Planner */}
              {onOpenBlackoutModal && (
                <button
                  type="button"
                  onClick={onOpenBlackoutModal}
                  className="p-3 bg-teal-50/60 hover:bg-teal-100/70 border border-teal-200/80 rounded-xl transition flex items-center gap-3 text-left group cursor-pointer"
                >
                  <div className="p-2 bg-teal-100 text-teal-800 rounded-lg group-hover:scale-105 transition shrink-0">
                    <Palmtree className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-teal-950 block leading-tight group-hover:text-teal-900 transition">
                      {currentLanguage === 'sl' ? 'Odsotnosti & Dopusti' : 'Vacations & Blackout Dates'}
                    </span>
                    <span className="text-[10px] text-teal-800/80 block truncate mt-0.5 font-sans">
                      {currentLanguage === 'sl' ? 'Vnesi datume ko te ne bo na službi' : 'Register dates when you are unavailable'}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-teal-600/70 group-hover:translate-x-0.5 transition shrink-0" />
                </button>
              )}

              {/* 4. Living Faith Coffee Shop & Visitors */}
              {onOpenVisitorModal && canAccessPersonalData(userRole) && (
                <button
                  type="button"
                  onClick={onOpenVisitorModal}
                  className="p-3 bg-amber-50/60 hover:bg-amber-100/70 border border-amber-200/80 rounded-xl transition flex items-center gap-3 text-left group cursor-pointer"
                >
                  <div className="p-2 bg-amber-100 text-amber-900 rounded-lg group-hover:scale-105 transition shrink-0">
                    <Coffee className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-amber-950 block leading-tight group-hover:text-amber-900 transition flex items-center gap-1">
                      <span>{currentLanguage === 'sl' ? 'Kavarna & Obiskovalci' : 'Coffee Shop & Visitors'}</span>
                      {visitors.filter(v => v.followUpStatus === 'new').length > 0 && (
                        <span className="text-[9px] bg-amber-600 text-white font-bold px-1.5 py-0.2 rounded-full font-mono">
                          {visitors.filter(v => v.followUpStatus === 'new').length}
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-amber-800/80 block truncate mt-0.5 font-sans">
                      {currentLanguage === 'sl' ? 'Zabeleži obiskovalce in dodeli kontakt' : 'Track visitors and assign follow-up contacts'}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-amber-600/70 group-hover:translate-x-0.5 transition shrink-0" />
                </button>
              )}

              {/* 5. Setup Guides & Inspection List */}
              {onOpenInspectionModal && (
                <button
                  type="button"
                  onClick={() => onOpenInspectionModal()}
                  className="p-3 bg-rose-50/60 hover:bg-rose-100/70 border border-rose-200/80 rounded-xl transition flex items-center gap-3 text-left group cursor-pointer"
                >
                  <div className="p-2 bg-rose-100 text-rose-800 rounded-lg group-hover:scale-105 transition shrink-0">
                    <ClipboardCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-rose-950 block leading-tight group-hover:text-rose-900 transition">
                      {currentLanguage === 'sl' ? 'Pregled dvorane in tehnike' : 'Inspection & Setup Checklists'}
                    </span>
                    <span className="text-[10px] text-rose-800/80 block truncate mt-0.5 font-sans">
                      {currentLanguage === 'sl' ? 'Postavitev, kava, zvok in čiščenje' : 'Stage setup, sound check, coffee & cleaning'}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-rose-600/70 group-hover:translate-x-0.5 transition shrink-0" />
                </button>
              )}

              {/* 6. Notification Hub */}
              {onOpenNotificationModal && (
                <button
                  type="button"
                  onClick={onOpenNotificationModal}
                  className="p-3 bg-sky-50/60 hover:bg-sky-100/70 border border-sky-200/80 rounded-xl transition flex items-center gap-3 text-left group cursor-pointer"
                >
                  <div className="p-2 bg-sky-100 text-sky-800 rounded-lg group-hover:scale-105 transition shrink-0">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-sky-950 block leading-tight group-hover:text-sky-900 transition">
                      {currentLanguage === 'sl' ? 'Center Obvestil & Opomniki' : 'Notification Hub & Messaging'}
                    </span>
                    <span className="text-[10px] text-sky-800/80 block truncate mt-0.5 font-sans">
                      {currentLanguage === 'sl' ? 'Pošlji opomnike preko WhatsApp ali e-pošte' : 'Send team reminders via WhatsApp or email'}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-sky-600/70 group-hover:translate-x-0.5 transition shrink-0" />
                </button>
              )}
            </div>
          </div>
        )}
        </div>

      </div>
    </div>
  );
}

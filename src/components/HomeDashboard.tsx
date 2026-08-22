/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ServiceSunday, Ministry, UserRole, Translation, Person, VisitorConnection, canAccessPersonalData } from '../types';
import { 
  Calendar, Users, ArrowRightLeft, AlertTriangle, ShieldCheck, Heart, Sparkles, ChevronRight, CheckCircle2, AlertCircle, Plus, Eye, BookOpen, Layers, Check, Clock, HelpCircle, X, ExternalLink, ShieldAlert, Award, Star, MessageSquare, Phone, Info, Music, Home, Wine, HeartHandshake, PlusCircle, Coffee, Edit, UserPlus, Copy, CheckCircle, Palmtree, ClipboardCheck, Bell, UserCheck
} from 'lucide-react';
import HeroHeaderBanner from './HeroHeaderBanner';
import KcKalvarijaLogoComponent from './KcKalvarijaLogo';
import { IS_FIREBASE_ENABLED } from '../lib/firebase';
import { getEffectiveSundayFocus } from '../lib/sundaySpecialFocus';
import { resolveMinistryAssignments } from '../utils/worshipSync';
import { generateConfirmationToken } from '../services/notificationService';
import { useNotificationQueue } from '../hooks/useNotificationQueue';

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
  onSelectSunday: (id: string) => void;
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
}: HomeDashboardProps) {

  // Toast notification state
  const [toast, setToast] = useState<string | null>(null);
  const { queueAssignment } = useNotificationQueue();

  // Quick Assign form states
  const [showQuickAssign, setShowQuickAssign] = useState(false);
  const [selectedVacantId, setSelectedVacantId] = useState('');
  const [selectedPersonName, setSelectedPersonName] = useState('');
  const [rosterSearchQuery, setRosterSearchQuery] = useState('');

  // Parse Slovenian style date "DD. MM. YY" or "DD. MM. YYYY" into a comparable Date object
  const parseSheetDate = (dateStr: string): Date => {
    if (!dateStr) return new Date(0);
    const parts = dateStr.split('.').map(p => parseInt(p.trim(), 10));
    if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return new Date(0);
    const day = parts[0];
    const month = parts[1] - 1; // 0-indexed
    let year = parts[2];
    if (year < 100) year = 2000 + year;
    return new Date(year, month, day);
  };

  // Target start date for active Academic Year 2026/2027 services (Aug 23, 2026 onwards)
  const activeYearCutoff = new Date(2026, 7, 23); // Aug 23, 2026

  // Sort sundays chronologically
  const sortedSundays = [...sundays].sort((a, b) => {
    return parseSheetDate(a.date).getTime() - parseSheetDate(b.date).getTime();
  });

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

  // Find the next Sunday on or after activeYearCutoff, or default to the last Sunday
  const nextSunday = sortedSundays.find(s => parseSheetDate(s.date) >= activeYearCutoff) || sortedSundays[sortedSundays.length - 1];

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

  // Let's compute statistics for nextSunday
  const totalSlots = ministries.length;
  const assignedSlots = ministries.filter(
    m => resolveMinistryAssignments(nextSunday, m.id).length > 0
  ).length;

  const coveragePercent = Math.round((assignedSlots / totalSlots) * 100);

  // Find vacant slots
  const vacantMinistries = ministries.filter(
    m => resolveMinistryAssignments(nextSunday, m.id).length === 0
  );

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

    const token = generateConfirmationToken();
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
    <div id="home-dashboard-component" className="max-w-5xl mx-auto w-full space-y-5 animate-fade-in pb-12 px-3 sm:px-4">
      
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
          <div className="flex items-center gap-3 text-xs flex-wrap font-mono">
            <span className="bg-white/10 px-2.5 py-1 rounded-lg border border-white/15">
              {currentLanguage === 'sl' ? 'Vloga:' : 'Roster access:'} <strong className="text-white font-bold">{translations[`role${userRole}` as any] || userRole}</strong>
            </span>
            <span className="bg-white/10 px-2.5 py-1 rounded-lg border border-white/15">
              📆 {currentLanguage === 'sl' ? 'Šolsko leto 2026/2027' : 'School Year 2026/2027'}
            </span>
          </div>
        }
      />

      {/* Responsive Grid Layout for PC vs Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Main Column on Desktop (Next Sunday overview + Vacant Roles) */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* Primary: Quick Roster Summary of Next Sunday */}
          <div id="next-service-overview" className="bg-white rounded-xl shadow-[0_2px_4px_rgba(0,0,0,0.02)] border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 bg-[#EEF2FF] text-[#4338CA] rounded-lg shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-gray-400 uppercase font-bold font-mono tracking-wider block">
                    {translations.nextSunday}
                  </span>
                  <span className="text-base font-bold text-gray-900 font-display truncate block">
                    {nextSunday.date}
                  </span>
                </div>
              </div>
              
              <button
                onClick={() => onSelectSunday(nextSunday.id)}
                id="btn-next-sunday-details"
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 py-1.5 px-3 rounded-lg flex items-center gap-1 transition active:scale-95 font-medium cursor-pointer shrink-0"
              >
                <span>{translations.viewDetails}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Info badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200/60 min-w-0">
                <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wider font-mono mb-1">{translations.themeLabel}</span>
                <span className="font-semibold text-gray-800 block truncate" title={currentLanguage === 'sl' ? nextSunday.themeSl : nextSunday.themeEn}>
                  {currentLanguage === 'sl' ? nextSunday.themeSl : nextSunday.themeEn || '/'}
                </span>
              </div>

              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200/60 font-sans min-w-0">
                <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wider font-mono mb-1">{currentLanguage === 'sl' ? 'Odsotni' : 'Absent'}</span>
                <span className="font-semibold text-gray-800 block truncate" title={nextSunday.guest || nextSunday.absentOrNotes}>
                  {nextSunday.guest || nextSunday.absentOrNotes || '/'}
                </span>
              </div>
            </div>

            {/* Special Sunday Focus Callout Banner */}
            {(() => {
              const effFocus = getEffectiveSundayFocus(nextSunday);
              if (effFocus.type === 'communion') {
                return (
                  <div 
                    onClick={() => onSelectSunday(nextSunday.id)}
                    className="p-3 sm:p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer hover:bg-rose-100/80 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 bg-rose-100 text-rose-800 rounded-lg shrink-0 flex items-center justify-center text-sm font-bold shadow-2xs">
                        🍷🍞
                      </div>
                      <div className="min-w-0 text-xs">
                        <span className="font-bold text-rose-950 block">🍷🍞 {currentLanguage === 'sl' ? 'Ta nedelja: Gospodova Večerja' : 'This Sunday: Lord\'s Supper / Communion'}</span>
                        <p className="text-[11px] text-rose-800/80 truncate">
                          {currentLanguage === 'sl' ? 'Odgovorni za Gospodovo Večerjo:' : 'Assigned for Communion:'} <strong>{(effFocus.communion?.inChargeNames || []).join(', ') || 'Aleš & Whitney'}</strong>
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 bg-rose-100/80 px-2.5 py-1 rounded-lg shrink-0 whitespace-nowrap self-start sm:self-auto shadow-2xs">
                      {currentLanguage === 'sl' ? 'Pripravi Večerjo →' : 'Communion Details →'}
                    </span>
                  </div>
                );
              }
              if (effFocus.type === 'prayer_focus') {
                return (
                  <div 
                    onClick={() => onSelectSunday(nextSunday.id)}
                    className="p-3 sm:p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer hover:bg-indigo-100/80 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 bg-indigo-100 text-indigo-800 rounded-lg shrink-0 flex items-center justify-center text-sm font-bold shadow-2xs">
                        🙏
                      </div>
                      <div className="min-w-0 text-xs">
                        <span className="font-bold text-indigo-950 block">🙏 {currentLanguage === 'sl' ? 'Ta nedelja: Molitev za Družino & Sfero Vpliva' : 'This Sunday: Family & Sphere Prayer Focus'}</span>
                        <p className="text-[11px] text-indigo-800/80 truncate">
                          {currentLanguage === 'sl' ? 'Molitveni poudarek:' : 'Prayer focus:'} <strong>{effFocus.prayerFocus?.familyNameOrPerson || (currentLanguage === 'sl' ? 'Določi družino za molitev' : 'Set Prayer Family')}</strong> {effFocus.prayerFocus?.sphereOfInfluence ? `(${effFocus.prayerFocus.sphereOfInfluence})` : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 bg-indigo-100/80 px-2.5 py-1 rounded-lg shrink-0 whitespace-nowrap self-start sm:self-auto shadow-2xs">
                      {currentLanguage === 'sl' ? 'Poglej Potrebe →' : 'View Prayer Needs →'}
                    </span>
                  </div>
                );
              }
              return null;
            })()}

            {/* Worship Setlist & Service Rundown Quick Bar */}
            <div 
              onClick={() => onOpenRundownModal ? onOpenRundownModal(nextSunday.id) : onSelectSunday(nextSunday.id)}
              className="bg-slate-900 text-white p-3 sm:p-3.5 rounded-xl border border-violet-800/80 hover:border-violet-600 transition cursor-pointer flex items-center justify-between gap-2.5 group shadow-sm"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="p-2 bg-violet-600/40 text-violet-300 rounded-lg shrink-0">
                  <Music className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-white group-hover:text-violet-200 transition">
                      {currentLanguage === 'sl' ? 'Slavilne pesmi & Urnik' : 'Worship Songs & Rundown'}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-violet-500/20 text-violet-300 rounded-full border border-violet-500/30 whitespace-nowrap shrink-0">
                      {nextSunday.worshipSetlist ? `${nextSunday.worshipSetlist.length} ${currentLanguage === 'sl' ? 'pesmi' : 'songs'}` : (currentLanguage === 'sl' ? '2 pesmi' : '2 songs')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    {nextSunday.worshipSetlist && nextSunday.worshipSetlist.length > 0
                      ? nextSunday.worshipSetlist.map(s => `${s.titleSl} [${s.key || 'C'}]`).join(' • ')
                      : (currentLanguage === 'sl' ? 'Klikni za izbiro pesmi iz pesmarice appa ali pregled urikarja' : 'Click to select songs from app songbook or view rundown')}
                  </p>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white transition shrink-0" />
            </div>

            {/* Living Faith Coffee Shop & Visitors Quick Banner */}
            {canAccessPersonalData(userRole) && (
              <div 
                onClick={onOpenVisitorModal}
                className="bg-amber-50/90 hover:bg-amber-100/90 text-amber-950 p-3 sm:p-3.5 rounded-xl border border-amber-300/80 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 group shadow-2xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 bg-amber-900 text-amber-100 rounded-lg shrink-0 shadow-2xs">
                    <Coffee className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-amber-950 group-hover:text-amber-900 transition">
                        {currentLanguage === 'sl' ? '☕ Kavarna Živa Vera & Obiskovalci' : '☕ Living Faith Coffee Shop & Visitors'}
                      </span>
                      {visitors.filter(v => v.followUpStatus === 'new').length > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-600 text-white rounded-full whitespace-nowrap shrink-0">
                          {visitors.filter(v => v.followUpStatus === 'new').length} {currentLanguage === 'sl' ? 'za kontakt' : 'to contact'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-amber-800/90 truncate font-sans">
                      {currentLanguage === 'sl' 
                        ? 'Druženje po bogoslužju spodaj v kavarni • Zabeleži nove obiskovalce in dodeli kontakt'
                        : 'Post-service coffee fellowship • Log new visitors and assign follow-up'}
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-200/80 hover:bg-amber-300 px-2.5 py-1 rounded-lg shrink-0 transition whitespace-nowrap self-start sm:self-auto shadow-2xs">
                  {currentLanguage === 'sl' ? 'Odpri Karton →' : 'Open Tracker →'}
                </span>
              </div>
            )}

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

            {/* Quick Actions Panel directly on sunday card */}
            <div className="pt-4 border-t border-gray-150 grid grid-cols-3 phone-grid-3 gap-2">
              <button
                onClick={() => onSelectSunday(nextSunday.id)}
                id="action-edit-sunday"
                className="flex flex-col items-center justify-center py-2.5 px-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 transition cursor-pointer border border-gray-200/60 font-sans"
              >
                <Edit className="w-4 h-4 text-slate-600 mb-1" />
                <span className="text-[10px] font-bold text-center leading-tight">
                  {currentLanguage === 'sl' ? 'Uredi nedeljo' : 'Edit Sunday'}
                </span>
              </button>

              <button
                onClick={() => setShowQuickAssign(!showQuickAssign)}
                id="action-assign-person"
                className={`flex flex-col items-center justify-center py-2.5 px-1.5 rounded-xl transition cursor-pointer border font-sans ${
                  showQuickAssign 
                    ? 'bg-indigo-50 border-indigo-300 text-[#4338CA]' 
                    : 'bg-gray-50 hover:bg-indigo-50/50 border-gray-200/60 text-[#4338CA]'
                }`}
              >
                <UserPlus className="w-4 h-4 text-indigo-600 mb-1" />
                <span className="text-[10px] font-bold text-center leading-tight">
                  {currentLanguage === 'sl' ? 'Dodeli osebo' : 'Assign Person'}
                </span>
              </button>

              <button
                onClick={handleDuplicateWeek}
                id="action-duplicate-week"
                className="flex flex-col items-center justify-center py-2.5 px-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 transition cursor-pointer border border-gray-200/60 font-sans"
              >
                <Copy className="w-4 h-4 text-slate-600 mb-1" />
                <span className="text-[10px] font-bold text-center leading-tight">
                  {currentLanguage === 'sl' ? 'Kopiraj teden' : 'Duplicate Week'}
                </span>
              </button>
            </div>

            {/* Quick Assign Form Container (Collapsible Roster Helper) */}
            {showQuickAssign && (
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
                      onChange={(e) => setSelectedVacantId(e.target.value)}
                      className="w-full text-xs px-2.5 py-2 bg-white border border-indigo-200 rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="">-- {currentLanguage === 'sl' ? 'Izberi prazno službo' : 'Select vacant title'} --</option>
                      {vacantMinistries.map((m) => (
                        <option key={m.id} value={m.id}>
                          {currentLanguage === 'sl' ? m.nameSl : m.nameEn}
                        </option>
                      ))}
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
                      const filteredPeople = (people || [])
                        .filter(p => p && p.name && !p.isArchived)
                        .filter(p => !query || p.name.toLowerCase().includes(query))
                        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

                      if (filteredPeople.length === 0) {
                        return (
                          <p className="text-[11px] text-rose-500 italic mt-1.5 font-mono">
                            {currentLanguage === 'sl' ? 'Oseba ni bila najdena v bazi ekipe.' : 'No matching volunteer found in roster.'}
                          </p>
                        );
                      }

                      return (
                        <div className="mt-2 space-y-1">
                          <label className="block text-[9px] font-bold text-gray-500 font-mono uppercase tracking-wider">
                            {currentLanguage === 'sl' ? 'Izberite sodelavca s seznama:' : 'Choose volunteer from roster:'}
                          </label>
                          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-white border border-indigo-150 rounded-lg shadow-2xs">
                            {filteredPeople.map((p) => {
                              const preferences = p.preferredMinistries || [];
                              const isPreferred = selectedVacantId && preferences.includes(selectedVacantId);
                              const isSelected = selectedPersonName === p.name;

                              return (
                                <button
                                  type="button"
                                  key={p.id || p.name}
                                  onClick={() => setSelectedPersonName(p.name)}
                                  className={`text-xs px-2.5 py-1 rounded-md transition font-medium border cursor-pointer flex items-center gap-1 active:scale-95 ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white border-indigo-700 font-bold shadow-2xs'
                                      : isPreferred
                                      ? 'bg-amber-50 text-amber-900 border-amber-300 font-semibold hover:bg-amber-100'
                                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:text-indigo-900'
                                  }`}
                                >
                                  <span>{p.name}</span>
                                  {isPreferred && <span className="text-[10px] text-amber-500" title={currentLanguage === 'sl' ? 'Prednostna služba' : 'Preferred ministry'}>★</span>}
                                  {isSelected && <span className="text-[10px]">✓</span>}
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

          {/* Missing Assignments Section */}
          <div id="missing-assignments-overview" className="bg-white rounded-xl shadow-[0_2px_4px_rgba(0,0,0,0.02)] border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{translations.missingAssignments}</span>
              </h3>
              <span className="text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-bold font-mono border border-rose-200">
                {vacantMinistries.length}
              </span>
            </div>

            {vacantMinistries.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {vacantMinistries.map((ministry) => (
                  <button
                    key={ministry.id}
                    onClick={() => onSelectSunday(nextSunday.id)}
                    className="text-left px-3.5 py-2.5 bg-[#FFF1F2] hover:bg-[#FFE4E6] border border-[#FECDD3] rounded-xl transition flex justify-between items-center group cursor-pointer"
                  >
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <span className="text-xs font-semibold text-gray-900 group-hover:text-[#4338CA] transition block truncate">
                        {currentLanguage === 'sl' ? ministry.nameSl : ministry.nameEn}
                      </span>
                      <span className="text-[9px] text-[#9F1239] font-mono font-bold uppercase tracking-wider block">
                        {currentLanguage === 'sl' ? 'ZAPOLNITI' : 'VACANT'}
                      </span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-rose-400 group-hover:translate-x-1 transition shrink-0" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] rounded-xl flex items-center gap-3 text-xs">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold block text-emerald-950">{currentLanguage === 'sl' ? 'Čudovito! Vse službe so pokrite!' : 'Excellent! All roles are filled!'}</span>
                  <span className="text-emerald-800/85 text-[11px] block mt-0.5">{currentLanguage === 'sl' ? 'Sodelavci so uspešno razporejeni.' : 'Roster checklist is fully completed.'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar Column on Desktop: Quick Operations Panel */}
        <div className="space-y-5">
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
        </div>

      </div>
    </div>
  );
}

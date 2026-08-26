/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ServiceSunday, Ministry, Translation, Person, UserRole, SundaySchoolLesson, canAccessPersonalData, WorshipRosterEntry } from '../types';
import { resolveMinistryAssignments } from '../utils/worshipSync';
import { getSundaySchoolLesson } from '../utils/sundaySchoolSync';
import { 
  Filter, Users, Calendar, AlertCircle, ChevronDown, ChevronUp, ShieldAlert, Sparkles, 
  AlertTriangle, CheckCircle, ClipboardCheck, ExternalLink, FileText, Layers,
  Home, Unlock, Lock, Coffee, Utensils, HeartHandshake, BookOpen, Volume2, 
  MessageSquare, Heart, Music, Camera, Sliders, Monitor, Film, Smile, 
  GraduationCap, Globe, Coins, CupSoda, Crown, PhoneCall, Phone, Mail, X, Wine, Clock, Check,
  Key, Flame, Mic, HandHelping, Video, Tv, Radio
} from 'lucide-react';
import HeroHeaderBanner from './HeroHeaderBanner';
import { isExemptFromBurnout } from '../lib/burnoutAnalytics';
import { isMinistryApplicableOnSunday, getEffectiveSundayFocus } from '../lib/sundaySpecialFocus';
import { useBackdropHistory } from '../hooks/useBackdropHistory';

interface MinistryViewProps {
  sundays: ServiceSunday[];
  ministries: Ministry[];
  people: Person[];
  translations: Translation;
  currentLanguage: 'sl' | 'en';
  userRole?: UserRole;
  activePerson?: Person | null;
  worshipRoster?: WorshipRosterEntry[];
  sundaySchoolLessons?: SundaySchoolLesson[];
  onSelectSunday: (id: string) => void;
  onUpdateMinistryLeader?: (ministryId: string, leaderName: string) => void;
  onUpdatePersonLedMinistries?: (personName: string, ledMinistries: string[]) => void;
  onOpenInspectionModal?: (category?: 'coffee_upper_hall' | 'tech_stage' | 'kids_classrooms' | 'general_cleaning') => void;
}

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
    case 'Camera':
    case 'postavitev_av':
      return <Camera className={className} />;
    case 'Sliders':
    case 'zvok':
      return <Sliders className={className} />;
    case 'Monitor':
    case 'besedila':
      return <Monitor className={className} />;
    case 'Video':
    case 'Tv':
    case 'Radio':
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
        cardBorder: 'border-l-4 border-l-amber-400 border-gray-200 bg-gradient-to-r from-amber-50/30 to-white hover:border-amber-300',
        headerBg: 'bg-amber-50/60',
        badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
        iconBoxBg: 'bg-amber-100 text-amber-800 border-amber-300',
        assignedBg: 'bg-amber-100/90 text-amber-950 border-amber-300',
        activeTab: 'bg-amber-600 text-white border-amber-600 shadow-xs font-semibold scale-[1.02]',
        inactiveTab: 'bg-amber-50/80 hover:bg-amber-100/90 text-amber-900 border-amber-200/90 shadow-2xs font-medium',
        dot: 'bg-amber-500',
        labelSl: 'Priprava & Čiščenje',
        labelEn: 'Setup & Cleaning'
      };
    case 'hospitality':
      return {
        cardBorder: 'border-l-4 border-l-rose-400 border-gray-200 bg-gradient-to-r from-rose-50/30 to-white hover:border-rose-300',
        headerBg: 'bg-rose-50/60',
        badgeBg: 'bg-rose-100 text-rose-900 border-rose-300',
        iconBoxBg: 'bg-rose-100 text-rose-800 border-rose-300',
        assignedBg: 'bg-rose-100/90 text-rose-950 border-rose-300',
        activeTab: 'bg-rose-600 text-white border-rose-600 shadow-xs font-semibold scale-[1.02]',
        inactiveTab: 'bg-rose-50/80 hover:bg-rose-100/90 text-rose-900 border-rose-200/90 shadow-2xs font-medium',
        dot: 'bg-rose-500',
        labelSl: 'Gostoljubje & Kava',
        labelEn: 'Hospitality & Snacks'
      };
    case 'sermon_prayer':
      return {
        cardBorder: 'border-l-4 border-l-sky-400 border-gray-200 bg-gradient-to-r from-sky-50/30 to-white hover:border-sky-300',
        headerBg: 'bg-sky-50/60',
        badgeBg: 'bg-sky-100 text-sky-900 border-sky-300',
        iconBoxBg: 'bg-sky-100 text-sky-800 border-sky-300',
        assignedBg: 'bg-sky-100/90 text-sky-950 border-sky-300',
        activeTab: 'bg-sky-600 text-white border-sky-600 shadow-xs font-semibold scale-[1.02]',
        inactiveTab: 'bg-sky-50/80 hover:bg-sky-100/90 text-sky-900 border-sky-200/90 shadow-2xs font-medium',
        dot: 'bg-sky-500',
        labelSl: 'Bogoslužje',
        labelEn: 'Main Service'
      };
    case 'worship':
    case 'av_tech':
      return {
        cardBorder: 'border-l-4 border-l-purple-400 border-gray-200 bg-gradient-to-r from-purple-50/30 to-white hover:border-purple-300',
        headerBg: 'bg-purple-50/60',
        badgeBg: 'bg-purple-100 text-purple-900 border-purple-300',
        iconBoxBg: 'bg-purple-100 text-purple-800 border-purple-300',
        assignedBg: 'bg-purple-100/90 text-purple-950 border-purple-300',
        activeTab: 'bg-purple-600 text-white border-purple-600 shadow-xs font-semibold scale-[1.02]',
        inactiveTab: 'bg-purple-50/80 hover:bg-purple-100/90 text-purple-900 border-purple-200/90 shadow-2xs font-medium',
        dot: 'bg-purple-500',
        labelSl: 'Slavljenje',
        labelEn: 'Worship'
      };
    case 'audio_video':
      return {
        cardBorder: 'border-l-4 border-l-cyan-500 border-gray-200 bg-gradient-to-r from-cyan-50/30 to-white hover:border-cyan-400',
        headerBg: 'bg-cyan-50/60',
        badgeBg: 'bg-cyan-100 text-cyan-900 border-cyan-300',
        iconBoxBg: 'bg-cyan-100 text-cyan-800 border-cyan-300',
        assignedBg: 'bg-cyan-100/90 text-cyan-950 border-cyan-300',
        activeTab: 'bg-cyan-600 text-white border-cyan-600 shadow-xs font-semibold scale-[1.02]',
        inactiveTab: 'bg-cyan-50/80 hover:bg-cyan-100/90 text-cyan-950 border-cyan-200/90 shadow-2xs font-medium',
        dot: 'bg-cyan-500',
        labelSl: 'Avdio Video',
        labelEn: 'Audio Video'
      };
    case 'kids':
      return {
        cardBorder: 'border-l-4 border-l-emerald-400 border-gray-200 bg-gradient-to-r from-emerald-50/30 to-white hover:border-emerald-300',
        headerBg: 'bg-emerald-50/60',
        badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        iconBoxBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        assignedBg: 'bg-emerald-100/90 text-emerald-950 border-emerald-300',
        activeTab: 'bg-emerald-600 text-white border-emerald-600 shadow-xs font-semibold scale-[1.02]',
        inactiveTab: 'bg-emerald-50/80 hover:bg-emerald-100/90 text-emerald-900 border-emerald-200/90 shadow-2xs font-medium',
        dot: 'bg-emerald-500',
        labelSl: 'Nedeljska šola',
        labelEn: 'Sunday School'
      };
    case 'post_service':
    case 'other':
    default:
      return {
        cardBorder: 'border-l-4 border-l-indigo-400 border-gray-200 bg-gradient-to-r from-indigo-50/30 to-white hover:border-indigo-300',
        headerBg: 'bg-indigo-50/60',
        badgeBg: 'bg-indigo-100 text-indigo-900 border-indigo-300',
        iconBoxBg: 'bg-indigo-100 text-indigo-800 border-indigo-300',
        assignedBg: 'bg-indigo-100/90 text-indigo-950 border-indigo-300',
        activeTab: 'bg-indigo-600 text-white border-indigo-600 shadow-xs font-semibold scale-[1.02]',
        inactiveTab: 'bg-indigo-50/80 hover:bg-indigo-100/90 text-indigo-900 border-indigo-200/90 shadow-2xs font-medium',
        dot: 'bg-indigo-500',
        labelSl: 'Po bogoslužju',
        labelEn: 'Post-Service'
      };
  }
};

// Parse Slovenian style date "DD. MM. YY" or "DD. MM. YYYY" into a comparable Date object
const parseSheetDate = (dateStr: string): Date => {
  if (!dateStr) return new Date(0);
  const parts = dateStr.split('.').map(p => parseInt(p.trim(), 10));
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return new Date(0);
  const day = parts[0];
  const month = parts[1] - 1;
  let year = parts[2];
  if (year < 100) year = 2000 + year;
  return new Date(year, month, day);
};

interface MinistryCardProps {
  key?: React.Key;
  ministry: Ministry;
  allUpcomingSundays: ServiceSunday[];
  worshipRoster?: WorshipRosterEntry[];
  sundaySchoolLessons?: SundaySchoolLesson[];
  people: Person[];
  userRole?: UserRole;
  currentLanguage: 'sl' | 'en';
  overAssignedPeople: Array<{ name: string; totalCount: number; conflictWeeks: string[] }>;
  understaffedRoles: Array<{ ministry: Ministry; vacantCount: number; vacantDates: string[] }>;
  onSelectSunday: (id: string) => void;
  onSelectLeaderForContact: (leader: Person) => void;
}

function MinistryCard({
  ministry,
  allUpcomingSundays,
  worshipRoster,
  sundaySchoolLessons,
  people,
  userRole,
  currentLanguage,
  overAssignedPeople,
  understaffedRoles,
  onSelectSunday,
  onSelectLeaderForContact,
}: MinistryCardProps) {
  const [visibleCount, setVisibleCount] = useState(5);
  const maxCount = allUpcomingSundays.length; // e.g. 15 or total available

  const handleStepExpand = () => {
    if (visibleCount >= 15 || visibleCount >= maxCount) {
      setVisibleCount(5); // Collapse back to default
    } else {
      setVisibleCount((prev) => Math.min(prev + 5, maxCount));
    }
  };

  const theme = getTeamTheme(ministry.category);
  const isUnderstaffed = understaffedRoles.some(r => r.ministry.id === ministry.id);
  const vacItem = understaffedRoles.find(r => r.ministry.id === ministry.id);
  const visibleSundays = allUpcomingSundays.slice(0, visibleCount);

  return (
    <div
      id={`matrix-card-${ministry.id}`}
      className={`bg-white rounded-2xl p-4 shadow-2xs border transition-all duration-200 space-y-3.5 flex flex-col justify-between ${
        isUnderstaffed ? 'border-rose-300 bg-rose-500/[0.01]' : theme.cardBorder
      }`}
    >
      <div className="space-y-3.5">
        {/* Header with icon, color theme badge & leader(s) */}
        <div className={`p-3 rounded-xl border ${theme.headerBg} ${theme.cardBorder} space-y-2`}>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <div className={`p-2 rounded-xl border shrink-0 mt-0.5 ${theme.iconBoxBg}`}>
                {renderMinistryIcon(ministry, "w-4 h-4")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="font-display font-bold text-xs uppercase tracking-wide text-slate-900 leading-snug break-words">
                    {currentLanguage === 'sl' ? ministry.nameSl : ministry.nameEn}
                  </h4>
                  {ministry.isOptional && (
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                      {currentLanguage === 'sl' ? 'Opcijsko' : 'Optional'}
                    </span>
                  )}
                  {ministry.rotationType && (
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200">
                      {currentLanguage === 'sl' ? 'Rotacija' : 'Rotation'}
                    </span>
                  )}
                </div>
                {isUnderstaffed && (
                  <span className="text-[9px] text-rose-700 bg-rose-100 border border-rose-200 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 font-mono font-semibold mt-1 max-w-full">
                    ⚠️ {currentLanguage === 'sl' ? `Pogosto prazno: ${vacItem?.vacantCount}/5` : `Vacant: ${vacItem?.vacantCount}/5`}
                  </span>
                )}
              </div>
            </div>
            <span className={`text-[9px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-lg border shrink-0 font-bold whitespace-nowrap self-start sm:self-auto ${theme.badgeBg}`}>
              {currentLanguage === 'sl' ? theme.labelSl : theme.labelEn}
            </span>
          </div>

          {/* Assigned Leader(s) Row */}
          {(() => {
            const ministryLeaders = people.filter(
              p => p && (p.role === 'Leader' || p.role === 'Admin') && p.ledMinistries?.includes(ministry.id)
            );

            if (ministryLeaders.length === 0) return null;

            return (
              <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200/60 flex-wrap">
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>{currentLanguage === 'sl' ? 'Vodja:' : 'Leader:'}</span>
                </span>
                {ministryLeaders.map((leader, lIdx) => (
                  <div
                    key={`${leader.id || leader.name}-${lIdx}`}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white text-slate-900 px-2 py-1 rounded-lg border border-slate-250 shadow-2xs"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectLeaderForContact(leader);
                      }}
                      className="hover:text-indigo-600 transition cursor-pointer flex items-center gap-1"
                      title={currentLanguage === 'sl' ? `Odpri podrobnosti: ${leader.name}` : `View details: ${leader.name}`}
                    >
                      <span>{leader.name}</span>
                    </button>

                    {canAccessPersonalData(userRole) && (
                      <div className="flex items-center gap-1 pl-1 border-l border-slate-200 ml-1">
                        {leader.phone && (
                          <a
                            href={`tel:${leader.phone.replace(/\s+/g, '')}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-0.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded transition cursor-pointer"
                            title={currentLanguage === 'sl' ? `Poklicaj: ${leader.phone}` : `Call: ${leader.phone}`}
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
                            className="p-0.5 text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded transition cursor-pointer"
                            title={currentLanguage === 'sl' ? 'Pošlji WhatsApp / SMS' : 'Send WhatsApp / SMS'}
                          >
                            <MessageSquare className="w-3 h-3" />
                          </a>
                        )}
                        {leader.email && (
                          <a
                            href={`mailto:${leader.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-0.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition cursor-pointer"
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
            );
          })()}
        </div>

        {/* Roster cross dates */}
        <div className="space-y-2.5">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono flex items-center justify-between">
            <span>{currentLanguage === 'sl' ? 'Prihajajoči tedni in razpored' : 'Roster across next Sundays'}</span>
            {maxCount > 5 && (
              <span className="text-[9px] text-slate-400 font-normal">
                {visibleSundays.length}/{maxCount}
              </span>
            )}
          </p>

          <div className="space-y-1.5 transition-all duration-200">
            {visibleSundays.map((sunday) => {
              const isApplicable = isMinistryApplicableOnSunday(ministry, sunday);
              const rosters = isApplicable ? resolveMinistryAssignments(sunday, ministry.id, worshipRoster) : [];
              const isCovered = rosters.length > 0;
              const nslGroupKey = ministry.id === 'nedeljska_sola_mlajsa' ? 'mlajsa' : ministry.id === 'nedeljska_sola_starejsa' ? 'starejsa' : null;
              const nslLesson = nslGroupKey ? getSundaySchoolLesson(sunday, nslGroupKey, sundaySchoolLessons) : null;

              if (!isApplicable) {
                return (
                  <div
                    key={sunday.id}
                    onClick={() => onSelectSunday(sunday.id)}
                    className="p-2.5 rounded-xl transition-all duration-150 flex items-center justify-between gap-2 border text-xs cursor-pointer bg-slate-50/40 hover:bg-slate-100/60 border-slate-200/60 text-slate-400"
                  >
                    <span className="font-mono font-medium text-slate-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      <span>{sunday.date}</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 italic">
                      {ministry.id === 'gospodova_vecerja' 
                        ? (currentLanguage === 'sl' ? '— (Molitev za družine)' : '— (Family Prayer)')
                        : (currentLanguage === 'sl' ? '— (Gospodova večerja)' : "— (Lord's Supper)")}
                    </span>
                  </div>
                );
              }

              const rowStyleClass = isCovered
                ? 'bg-slate-50/80 hover:bg-slate-100/80 border-slate-200/80 text-slate-800'
                : ministry.isOptional
                  ? 'bg-slate-50/60 hover:bg-slate-100/80 border-slate-200/80 text-slate-600'
                  : 'bg-rose-50/80 hover:bg-rose-100/80 border-rose-200 text-rose-900';

              return (
                <div
                  key={sunday.id}
                  onClick={() => onSelectSunday(sunday.id)}
                  className={`p-2.5 rounded-xl transition-all duration-150 flex items-center justify-between gap-2 border text-xs cursor-pointer animate-fade-in ${rowStyleClass}`}
                >
                  <span className="font-mono font-medium text-slate-500 flex flex-col justify-center shrink-0 min-w-0">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{sunday.date}</span>
                    </span>
                    {nslLesson?.topicSl && (
                      <span className="text-[10px] text-emerald-800 font-sans font-medium truncate max-w-[130px] sm:max-w-[200px]">
                        📖 {nslLesson.topicSl}
                      </span>
                    )}
                  </span>

                  <div className="flex flex-wrap justify-end gap-1 max-w-[65%]">
                    {(() => {
                      const details = sunday.assignmentDetails?.[ministry.id] || [];
                      const declinedDetails = details.filter(d => d.status === 'declined' && !rosters.includes(d.personName));

                      return (
                        <>
                          {isCovered ? (
                            rosters.map((name, idx) => {
                              const isOverloaded = overAssignedPeople.some(p => p && p.name === name);
                              const detail = details.find(d => d.personName === name);
                              const isConfirmed = detail ? detail.status === 'confirmed' : true;
                              const isPending = detail ? (detail.status === 'pending' || detail.status === 'tentative') : false;

                              let badgeClasses = 'bg-white text-slate-800 border-slate-300';
                              if (isConfirmed) {
                                badgeClasses = 'bg-emerald-50 text-emerald-900 border-emerald-300';
                              } else if (isPending) {
                                badgeClasses = 'bg-amber-50 text-amber-900 border-amber-300';
                              }

                              if (isOverloaded) {
                                badgeClasses = 'bg-amber-100 text-amber-950 border-amber-400 animate-pulse';
                              }

                              const statusTooltip = isPending 
                                ? (currentLanguage === 'sl' ? 'V čakanju na potrditev' : 'Pending confirmation')
                                : isOverloaded 
                                ? (currentLanguage === 'sl' ? 'Udeleženec je preobremenjen' : 'Volunteer has high load / conflicts')
                                : (detail?.notes ? `${name}: ${detail.notes}` : `${name} (${currentLanguage === 'sl' ? 'Potrjeno' : 'Confirmed'})`);

                              return (
                                <span
                                  key={idx}
                                  className={`px-2 py-0.5 rounded-lg border font-mono text-[10px] font-semibold flex items-center gap-1 transition shadow-2xs ${badgeClasses}`}
                                  title={statusTooltip}
                                >
                                  {isConfirmed && !isOverloaded && <Check className="w-2.5 h-2.5 text-emerald-600 stroke-[3] shrink-0" />}
                                  {isPending && <Clock className="w-2.5 h-2.5 text-amber-600 stroke-[2.5] shrink-0" />}
                                  <span>{name}</span>
                                  {isOverloaded && <span className="text-[9px] text-amber-700 font-bold">⚠️</span>}
                                </span>
                              );
                            })
                          ) : ministry.isOptional ? (
                            <span className="text-[9px] font-mono font-medium text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-250 shadow-2xs">
                              💬 {currentLanguage === 'sl' ? 'Opcijsko' : 'Optional'}
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200">
                              {currentLanguage === 'sl' ? '⚠️ MANJKA' : '⚠️ VACANT'}
                            </span>
                          )}

                          {/* Declined volunteers indicator showing decline note on hover/click */}
                          {declinedDetails.map((dec, dIdx) => (
                            <span
                              key={`dec-${dIdx}`}
                              className="px-1.5 py-0.5 rounded-lg border font-mono text-[9px] bg-rose-50/70 text-rose-700 border-rose-200 line-through opacity-80 flex items-center gap-0.5 cursor-help"
                              title={dec.declineReason ? `Zavrnil/a ${dec.personName}: "${dec.declineReason}"` : `Zavrnil/a ${dec.personName} (termin sproščen)`}
                            >
                              <X className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                              <span>{dec.personName}</span>
                            </span>
                          ))}
                        </>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Minimalist Arrow Expander Button */}
      {maxCount > 5 && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={handleStepExpand}
            title={visibleCount >= 15 || visibleCount >= maxCount ? (currentLanguage === 'sl' ? 'Prikaži manj' : 'Show less') : (currentLanguage === 'sl' ? 'Prikaži več' : 'Show more')}
            className="w-8 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {visibleCount >= 15 || visibleCount >= maxCount ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default function MinistryView({
  sundays,
  ministries,
  people = [],
  userRole,
  translations,
  currentLanguage,
  worshipRoster,
  sundaySchoolLessons,
  onSelectSunday,
  onOpenInspectionModal
}: MinistryViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showHealthReport, setShowHealthReport] = useState<boolean>(false);
  const [selectedLeaderForContact, setSelectedLeaderForContact] = useState<Person | null>(null);

  useBackdropHistory(!!selectedLeaderForContact, () => setSelectedLeaderForContact(null), 'ministry-leader-contact-modal');

  // Categories list mapped elegantly
  const categories = [
    { id: 'all', labelSl: 'Vse skupine', labelEn: 'All Areas' },
    { id: 'cleaning', labelSl: 'Priprava & Čiščenje', labelEn: 'Setup & Cleaning' },
    { id: 'hospitality', labelSl: 'Gostoljubje & Kava', labelEn: 'Hospitality & Snacks' },
    { id: 'sermon_prayer', labelSl: 'Bogoslužje', labelEn: 'Main Service' },
    { id: 'worship', labelSl: 'Slavljenje', labelEn: 'Worship' },
    { id: 'audio_video', labelSl: 'Avdio Video', labelEn: 'Audio Video' },
    { id: 'kids', labelSl: 'Nedeljska šola', labelEn: 'Sunday Kids School' },
    { id: 'post_service', labelSl: 'Po bogoslužju', labelEn: 'Post-Service' },
  ];

  // Upcoming sundays from today onwards
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sortedUpcomingSundays = [...sundays]
    .filter(s => parseSheetDate(s.date).getTime() >= today.getTime())
    .sort((a, b) => parseSheetDate(a.date).getTime() - parseSheetDate(b.date).getTime());

  const allUpcomingSundays = sortedUpcomingSundays.length > 0
    ? sortedUpcomingSundays
    : [...sundays].sort((a, b) => parseSheetDate(a.date).getTime() - parseSheetDate(b.date).getTime());

  const upcomingSundays = allUpcomingSundays.slice(0, 5);

  // --- Roster Overload and Understaffing Calculations ---
  const volunteerLoad: Record<string, number> = {};
  const singleSundayVolunteerLoad: Record<string, Record<string, number>> = {};

  upcomingSundays.forEach(sunday => {
    if (!sunday) return;
    singleSundayVolunteerLoad[sunday.id] = {};
    if (sunday.assignments) {
      Object.entries(sunday.assignments).forEach(([mId, names]) => {
        if (Array.isArray(names)) {
          names.forEach(name => {
            if (typeof name === 'string') {
              const cleanName = name.trim();
              if (cleanName && cleanName !== '/' && cleanName.toLowerCase() !== 'all') {
                volunteerLoad[cleanName] = (volunteerLoad[cleanName] || 0) + 1;
                singleSundayVolunteerLoad[sunday.id][cleanName] = (singleSundayVolunteerLoad[sunday.id][cleanName] || 0) + 1;
              }
            }
          });
        }
      });
    }
  });

  const overAssignedPeople = Object.entries(volunteerLoad)
    .filter(([name, totalCount]) => {
      if (isExemptFromBurnout(name, people)) return false;
      const hasConflict = Object.values(singleSundayVolunteerLoad).some(sundayLoad => (sundayLoad?.[name] || 0) >= 2);
      return totalCount >= 3 || hasConflict;
    })
    .map(([name, totalCount]) => {
      const conflictWeeks = upcomingSundays
        .filter(s => s && (singleSundayVolunteerLoad[s.id]?.[name] || 0) >= 2)
        .map(s => s.date);
      return { name, totalCount, conflictWeeks };
    })
    .sort((a, b) => b.totalCount - a.totalCount);

  const understaffedThreshold = Math.max(2, Math.ceil(upcomingSundays.length / 2));
  const understaffedRoles = ministries
    .filter(m => !m.isOptional)
    .map(m => {
      const applicableSundays = upcomingSundays.filter(s => isMinistryApplicableOnSunday(m, s));
      const vacantSundays = applicableSundays.filter(s => {
        if (!s || !s.assignments) return true;
        const list = s.assignments[m.id] || [];
        return Array.isArray(list) ? list.length === 0 : true;
      });
      return {
        ministry: m,
        vacantCount: vacantSundays.length,
        vacantDates: vacantSundays.map(s => s.date)
      };
    }).filter(item => item.vacantCount >= understaffedThreshold)
      .sort((a, b) => b.vacantCount - a.vacantCount);

  const filteredMinistries = selectedCategory === 'all'
    ? ministries
    : ministries.filter((m) => {
        if (m.category === selectedCategory) return true;
        if (selectedCategory === 'post_service' && m.category === 'other') return true;
        if (selectedCategory === 'worship' && m.category === 'av_tech' && (m.id === 'slavilna_ekipa' || m.id === 'uvod_slavljenje' || m.id === 'zvok')) return true;
        if (selectedCategory === 'audio_video' && m.category === 'av_tech' && (m.id !== 'slavilna_ekipa' && m.id !== 'uvod_slavljenje' && m.id !== 'zvok')) return true;
        return false;
      });

  return (
    <div id="ministries-matrix-component" className="w-full space-y-5 animate-fade-in pb-12">
      {/* Hero Header Banner */}
      <HeroHeaderBanner
        variant="ministries"
        eyebrow={currentLanguage === 'sl' ? '📋 NEDELJSKE SLUŽBE • KC KALVARIJA' : '📋 SUNDAY MINISTRIES • KC KALVARIJA'}
        title={translations.ministries}
        subtitle={currentLanguage === 'sl' ? 'Pregled vseh služb, zadolžitev po področjih, kontrolnih seznamov in analize opremljenosti nedelj.' : 'Overview of service teams, area responsibilities, checklists, and Sunday coverage health.'}
        icon={Layers}
        actions={
          <span className="text-xs font-mono font-bold bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
            {filteredMinistries.length} {currentLanguage === 'sl' ? 'aktivnih služb' : 'active ministries'}
          </span>
        }
      >
        {/* Inspection Protocols & Standards Summary Line */}
        <div className="pt-2.5 border-t border-white/15 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-white/85 font-medium flex items-center gap-1.5 text-xs mr-1">
              <ClipboardCheck className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span>{currentLanguage === 'sl' ? 'Kontrolni pregledi:' : 'Area Checklists:'}</span>
            </span>
            {onOpenInspectionModal && (
              <>
                <button
                  onClick={() => onOpenInspectionModal('coffee_upper_hall')}
                  className="px-2.5 py-1 text-[11px] font-medium text-amber-100 bg-white/10 hover:bg-white/20 rounded-lg border border-white/15 transition flex items-center gap-1.5 cursor-pointer backdrop-blur-xs shadow-2xs"
                >
                  <Coffee className="w-3 h-3 text-amber-300" />
                  <span>{currentLanguage === 'sl' ? 'Kava & Dvorana' : 'Coffee & Upper Hall'}</span>
                </button>
                <button
                  onClick={() => onOpenInspectionModal('tech_stage')}
                  className="px-2.5 py-1 text-[11px] font-medium text-sky-100 bg-white/10 hover:bg-white/20 rounded-lg border border-white/15 transition flex items-center gap-1.5 cursor-pointer backdrop-blur-xs shadow-2xs"
                >
                  <Sliders className="w-3 h-3 text-sky-300" />
                  <span>{currentLanguage === 'sl' ? 'Tehnika & Oder' : 'Tech & Stage'}</span>
                </button>
                <button
                  onClick={() => onOpenInspectionModal('kids_classrooms')}
                  className="px-2.5 py-1 text-[11px] font-medium text-emerald-100 bg-white/10 hover:bg-white/20 rounded-lg border border-white/15 transition flex items-center gap-1.5 cursor-pointer backdrop-blur-xs shadow-2xs"
                >
                  <Smile className="w-3 h-3 text-emerald-300" />
                  <span>{currentLanguage === 'sl' ? 'Nedeljska šola' : 'Kids Rooms'}</span>
                </button>
                <button
                  onClick={() => onOpenInspectionModal('general_cleaning')}
                  className="px-2.5 py-1 text-[11px] font-medium text-purple-100 bg-white/10 hover:bg-white/20 rounded-lg border border-white/15 transition flex items-center gap-1.5 cursor-pointer backdrop-blur-xs shadow-2xs"
                >
                  <Sparkles className="w-3 h-3 text-purple-300" />
                  <span>{currentLanguage === 'sl' ? 'Čiščenje' : 'Cleaning'}</span>
                </button>
              </>
            )}
          </div>

          <a
            href="https://docs.google.com/document/d/1wmI85X8MY501sqgY-z0dm03VtB3lFTCyi46TObb_f40/edit?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 text-[11px] font-medium text-emerald-100 bg-black/25 hover:bg-black/40 border border-emerald-400/30 rounded-lg transition flex items-center gap-1 cursor-pointer shrink-0"
          >
            <FileText className="w-3 h-3 text-emerald-300" />
            <span>Google Doc</span>
            <ExternalLink className="w-2.5 h-2.5 text-emerald-300" />
          </a>
        </div>
      </HeroHeaderBanner>

      {/* Category selector pills */}
      <div id="ministry-category-pills" className="flex flex-wrap gap-2 pt-1 pb-1">
        {categories.map((cat) => {
          const theme = getTeamTheme(cat.id);
          const isSelected = selectedCategory === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition duration-150 flex items-center gap-1.5 cursor-pointer border ${
                isSelected
                  ? cat.id === 'all'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs scale-[1.02]'
                    : theme.activeTab
                  : cat.id === 'all'
                    ? 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border-slate-200/80 shadow-2xs'
                    : theme.inactiveTab
              }`}
            >
              {renderCategoryIcon(cat.id, "w-3.5 h-3.5 shrink-0")}
              <span>{currentLanguage === 'sl' ? cat.labelSl : cat.labelEn}</span>
            </button>
          );
        })}
      </div>

      {/* Roster matrix - structured as touchable cards with progressive arrow expander */}
      <div id="ministries-matrix-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 items-start">
        {filteredMinistries.map((ministry) => (
          <MinistryCard
            key={ministry.id}
            ministry={ministry}
            allUpcomingSundays={allUpcomingSundays}
            worshipRoster={worshipRoster}
            sundaySchoolLessons={sundaySchoolLessons}
            people={people}
            userRole={userRole}
            currentLanguage={currentLanguage}
            overAssignedPeople={overAssignedPeople}
            understaffedRoles={understaffedRoles}
            onSelectSunday={onSelectSunday}
            onSelectLeaderForContact={setSelectedLeaderForContact}
          />
        ))}
      </div>

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

            {canAccessPersonalData(userRole) ? (
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
                    href={`sms:${selectedLeaderForContact.phone.replace(/\s+/g, '')}`}
                    className="w-full flex items-center justify-between p-3 bg-sky-50 hover:bg-sky-100/80 border border-sky-200 rounded-xl text-sky-950 transition font-medium text-xs cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <MessageSquare className="w-4 h-4 text-sky-600 group-hover:scale-110 transition" />
                      <div className="text-left">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-sky-700 font-mono block">
                          {currentLanguage === 'sl' ? 'Pošlji SMS sporočilo' : 'Send SMS Message'}
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
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs leading-relaxed space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  <span>{currentLanguage === 'sl' ? 'Omejen Dostop do Kontaktov' : 'Restricted Contact Access'}</span>
                </p>
                <p className="text-[11px] text-amber-800">
                  {currentLanguage === 'sl' 
                    ? 'Kontaktne številke in e-pošte vodij so iz varnostnih razlogov dostopne le odobrenim članom planerja.' 
                    : 'Leader contact details are only visible to approved roster servants.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

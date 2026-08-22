/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ServiceSunday, Ministry, UserRole, Translation } from '../types';
import { Calendar, Trash2, Edit3, ChevronRight, Filter, AlertCircle, Check, FolderArchive, Sparkles, PlusCircle, History, Wine, HeartHandshake, BarChart3, Clock, X } from 'lucide-react';
import HeroHeaderBanner from './HeroHeaderBanner';
import { getEffectiveSundayFocus } from '../lib/sundaySpecialFocus';
import { useBackdropHistory } from '../hooks/useBackdropHistory';

interface ScheduleViewProps {
  sundays: ServiceSunday[];
  ministries: Ministry[];
  userRole: UserRole;
  translations: Translation;
  currentLanguage: 'sl' | 'en';
  onSelectSunday: (id: string) => void;
  onDeleteSunday: (id: string) => void;
  onGenerateAcademicYear: () => void;
  onOpenStatistics?: () => void;
}

type FilterStatus = 'all' | 'draft' | 'ready' | 'completed';
type YearView = '2026_2027' | 'history' | 'all';

export default function ScheduleView({
  sundays,
  ministries,
  userRole,
  translations,
  currentLanguage,
  onSelectSunday,
  onDeleteSunday,
  onGenerateAcademicYear,
  onOpenStatistics,
}: ScheduleViewProps) {
  const [yearView, setYearView] = useState<YearView>('2026_2027');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [sundayToDelete, setSundayToDelete] = useState<ServiceSunday | null>(null);

  useBackdropHistory(!!sundayToDelete, () => setSundayToDelete(null), 'schedule-delete-sunday');

  const canEdit = userRole === 'Admin' || userRole === 'Leader';

  // Parse Slovenian style date "DD. MM. YY" into a comparable Date object
  const parseSheetDate = (dateStr: string): Date => {
    const parts = dateStr.split('.').map(p => parseInt(p.trim(), 10));
    if (parts.length < 3) return new Date();
    const day = parts[0];
    const month = parts[1] - 1;
    const year = 2000 + parts[2];
    return new Date(year, month, day);
  };

  // Threshold date for Academic Year 2026/2027: August 23, 2026
  const academicYearStartDate = new Date(2026, 7, 23);

  const isAcademicYear2627 = (dateStr: string) => {
    return parseSheetDate(dateStr).getTime() >= academicYearStartDate.getTime();
  };

  const getEffectiveSundayStatus = (s: ServiceSunday): 'draft' | 'ready' | 'completed' => {
    if (s.status === 'completed') return 'completed';
    const sDate = parseSheetDate(s.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // If the Sunday is in the past, automatically categorize as completed/archived
    if (sDate.getTime() < today.getTime()) {
      return 'completed';
    }
    return s.status || 'draft';
  };

  const count2627 = sundays.filter(s => isAcademicYear2627(s.date)).length;
  const countHistory = sundays.filter(s => !isAcademicYear2627(s.date)).length;

  // Filter by year scope first
  const yearFilteredSundays = sundays.filter((s) => {
    if (yearView === '2026_2027') return isAcademicYear2627(s.date);
    if (yearView === 'history') return !isAcademicYear2627(s.date);
    return true;
  });

  // Sort Sundays chronologically (newest first for schedule browsing, or ascending based on view)
  const sortedSundays = [...yearFilteredSundays].sort((a, b) => {
    if (yearView === '2026_2027') {
      // Ascending for upcoming academic year (from Aug/Sep 2026 onwards)
      return parseSheetDate(a.date).getTime() - parseSheetDate(b.date).getTime();
    }
    // Descending for history / all
    return parseSheetDate(b.date).getTime() - parseSheetDate(a.date).getTime();
  });

  // Filter by status tab
  const filteredSundays = sortedSundays.filter((s) => {
    if (filter === 'all') return true;
    const effectiveStatus = getEffectiveSundayStatus(s);
    return effectiveStatus === filter;
  });

  return (
    <div id="schedule-view-component" className="max-w-5xl mx-auto w-full space-y-5 animate-fade-in pb-12 px-3 sm:px-4">
      {/* Unified Hero Header Banner */}
      <HeroHeaderBanner
        variant="schedule"
        eyebrow={currentLanguage === 'sl' ? '📅 NEDELJSKI RAZPORED • ŠOLSKO LETO 2026/2027' : '📅 SUNDAY SCHEDULE • SCHOOL YEAR 2026/2027'}
        title={translations.sundaySchedule}
        subtitle={currentLanguage === 'sl' ? 'Pregled in načrtovanje nedeljskih razporedov ter arhiv preteklih let.' : 'Browse and manage Sunday service rosters and review historical archives.'}
        icon={Calendar}
        actions={
          <button
            onClick={onOpenStatistics}
            className="px-4 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95 cursor-pointer flex items-center gap-2"
            title={currentLanguage === 'sl' ? 'Odpri analitiko in pregled pokritosti služb' : 'Open analytics and ministry coverage overview'}
          >
            <BarChart3 className="w-4 h-4 text-amber-300 shrink-0" />
            <span>{currentLanguage === 'sl' ? '📊 Statistika & Pregled Pokritosti' : '📊 Statistics & Coverage'}</span>
          </button>
        }
      />
      {/* Academic Year vs History Main Tabs & Filters Card */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-gray-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-3">
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-0.5">
          <button
            onClick={() => setYearView('2026_2027')}
            className={`text-xs px-3 py-2 sm:px-3.5 rounded-xl transition font-medium flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 ${
              yearView === '2026_2027'
                ? 'bg-[#EEF2FF] text-[#4338CA] border border-indigo-200/80 font-semibold shadow-2xs'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200/70'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{currentLanguage === 'sl' ? 'Šolsko leto 2026/2027' : 'School Year 2026/2027'}</span>
            <span className="sm:hidden">{currentLanguage === 'sl' ? 'Šol. leto 26/27' : 'Year 26/27'}</span>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
              yearView === '2026_2027' ? 'bg-[#4338CA] text-white' : 'bg-gray-200 text-gray-700'
            }`}>
              {count2627}
            </span>
          </button>

          <button
            onClick={() => setYearView('history')}
            className={`text-xs px-3 py-2 sm:px-3.5 rounded-xl transition font-medium flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 ${
              yearView === 'history'
                ? 'bg-amber-50 text-amber-800 border border-amber-200 font-semibold shadow-2xs'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200/70'
            }`}
          >
            <History className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{currentLanguage === 'sl' ? 'Arhiv / Zgodovina (do avg. 2026)' : 'Past Archive (until Aug 2026)'}</span>
            <span className="sm:hidden">{currentLanguage === 'sl' ? 'Arhiv <=2026' : 'Archive <=2026'}</span>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
              yearView === 'history' ? 'bg-amber-700 text-white' : 'bg-gray-200 text-gray-700'
            }`}>
              {countHistory}
            </span>
          </button>

          <button
            onClick={() => setYearView('all')}
            className={`text-xs px-3 py-2 sm:px-3.5 rounded-xl transition font-medium flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 ${
              yearView === 'all'
                ? 'bg-gray-900 text-white border border-gray-900 font-semibold shadow-2xs'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200/70'
            }`}
          >
            <span>{currentLanguage === 'sl' ? 'Vse nedelje' : 'All Sundays'}</span>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
              yearView === 'all' ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-700'
            }`}>
              {sundays.length}
            </span>
          </button>
        </div>

        {/* Filter Badges (Draft, Ready, Completed) */}
        <div id="schedule-filters" className="flex items-center gap-2 overflow-x-auto custom-scrollbar pt-1 pb-0.5">
          <span className="text-[10px] text-gray-400 font-mono uppercase font-bold tracking-wider mr-0.5 shrink-0">
            {currentLanguage === 'sl' ? 'Status:' : 'Status:'}
          </span>
          <button
            onClick={() => setFilter('all')}
            className={`text-[11px] px-2.5 sm:px-3 py-1 rounded-lg transition shrink-0 focus:outline-none cursor-pointer ${
              filter === 'all'
                ? 'bg-gray-950 text-white font-semibold'
                : 'bg-white hover:bg-gray-50 text-gray-600 border border-gray-200'
            }`}
          >
            {currentLanguage === 'sl' ? 'Vsi statusi' : 'All status'}
          </button>
          <button
            onClick={() => setFilter('draft')}
            className={`text-[11px] px-2.5 sm:px-3 py-1 rounded-lg transition shrink-0 focus:outline-none flex items-center gap-1 cursor-pointer ${
              filter === 'draft'
                ? 'tag-neutral font-semibold'
                : 'bg-white hover:bg-gray-50 text-gray-500 border border-gray-200'
            }`}
          >
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>{translations.statusDraft}</span>
          </button>
          <button
            onClick={() => setFilter('ready')}
            className={`text-[11px] px-2.5 sm:px-3 py-1 rounded-lg transition shrink-0 focus:outline-none flex items-center gap-1 cursor-pointer ${
              filter === 'ready'
                ? 'tag-ready font-semibold'
                : 'bg-white hover:bg-gray-50 text-gray-500 border border-gray-200'
            }`}
          >
            <Check className="w-3 h-3 shrink-0" />
            <span>{translations.statusReady}</span>
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`text-[11px] px-2.5 sm:px-3 py-1 rounded-lg transition shrink-0 focus:outline-none flex items-center gap-1 cursor-pointer ${
              filter === 'completed'
                ? 'bg-[#EEF2FF] text-[#4338CA] border border-indigo-200 font-semibold'
                : 'bg-white hover:bg-gray-50 text-gray-500 border border-gray-200'
            }`}
          >
            <FolderArchive className="w-3 h-3 shrink-0" />
            <span>{translations.statusCompleted}</span>
          </button>
        </div>
      </div>

      {/* Empty State Banner if 2026/2027 is selected but empty */}
      {yearView === '2026_2027' && count2627 === 0 && (
        <div className="bg-gradient-to-br from-indigo-50/80 via-white to-indigo-50/30 border border-indigo-100 rounded-2xl p-4 sm:p-6 text-center space-y-3 shadow-xs">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-100 text-[#4338CA] rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="font-display font-semibold text-gray-900 text-sm sm:text-base">
              {currentLanguage === 'sl' ? 'Priprava za šolsko leto 2026/2027' : 'Prepare School Year 2026/2027'}
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed font-sans">
              {currentLanguage === 'sl'
                ? 'Vsi urniki za šolsko leto 2026/2027 (od 6. septembra 2026 do 29. avgusta 2027) še niso generirani. Z enim klikom lahko dodate vseh 52 nedelj za celotno šolsko leto.'
                : 'Sunday rosters for the 2026/2027 school year (Sep 6, 2026 to Aug 29, 2027) have not been created yet. Generate all 52 Sundays with a single click.'}
            </p>
          </div>
          {canEdit && (
            <button
              onClick={onGenerateAcademicYear}
              className="mt-2 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#4338CA] hover:bg-[#3730A3] text-white text-xs font-semibold rounded-xl shadow-md transition active:scale-95 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>{currentLanguage === 'sl' ? 'Ustvari 52 nedelj za leto 2026/2027' : 'Generate 52 Sundays for 2026/2027'}</span>
            </button>
          )}
        </div>
      )}

      {/* Roster list in Responsive Grid */}
      <div id="schedule-cards-list" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3.5 sm:gap-4">
        {filteredSundays.length > 0 ? (
          filteredSundays.map((sunday) => {
            const total = ministries.length;
            const filled = Object.keys(sunday.assignments).filter(
              (k) => (sunday.assignments[k] || []).length > 0 && ministries.some(m => m.id === k)
            ).length;
            const percentNum = total > 0 ? Math.round((filled / total) * 100) : 0;
            const percentStr = `${percentNum}%`;

            let progressColorClass = 'bg-slate-200';
            if (percentNum === 100) {
              progressColorClass = 'bg-emerald-500';
            } else if (percentNum > 0) {
              progressColorClass = 'bg-amber-500';
            }

            const effFocus = getEffectiveSundayFocus(sunday);
            let borderAccentClass = 'border-l-4 border-l-slate-300 bg-white';
            if (effFocus.type === 'prayer_focus') {
              borderAccentClass = 'border-l-4 border-l-indigo-400 bg-gradient-to-r from-indigo-50/30 via-indigo-50/10 to-white';
            } else if (effFocus.type === 'communion') {
              borderAccentClass = 'border-l-4 border-l-rose-400 bg-gradient-to-r from-rose-50/30 via-rose-50/10 to-white';
            }

            const effectiveStatus = getEffectiveSundayStatus(sunday);
            const statusTagClass = 
              effectiveStatus === 'draft' ? 'tag-neutral' :
              effectiveStatus === 'ready' ? 'tag-ready' : 'bg-[#EEF2FF] text-[#4338CA] border border-indigo-200';

            const statusLabel = 
              effectiveStatus === 'draft' ? translations.statusDraft :
              effectiveStatus === 'ready' ? translations.statusReady : translations.statusCompleted;

            return (
              <div
                key={sunday.id}
                id={`sunday-card-row-${sunday.id}`}
                className={`rounded-xl p-3.5 sm:p-4.5 shadow-[0_2px_4px_rgba(0,0,0,0.01)] border border-gray-200 hover:border-gray-300 transition duration-150 flex items-center justify-between gap-2.5 cursor-pointer group hover:shadow-xs ${borderAccentClass}`}
                onClick={() => onSelectSunday(sunday.id)}
              >
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-semibold text-gray-900 group-hover:text-[#4338CA] transition text-sm sm:text-base">
                      {sunday.date}
                    </span>
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${statusTagClass}`}>
                      {statusLabel}
                    </span>

                    {/* Special Sunday Focus Badge */}
                    {(() => {
                      if (effFocus.type === 'communion') {
                        return (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                            <span className="text-[11px] leading-none shrink-0">🍷🍞</span>
                            <span>Gospodova Večerja</span>
                          </span>
                        );
                      }
                      if (effFocus.type === 'prayer_focus') {
                        const famName = effFocus.prayerFocus?.familyNameOrPerson;
                        return (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                            <span className="text-[11px] leading-none shrink-0">🙏</span>
                            <span>
                              {famName 
                                ? `Molitev: ${famName}` 
                                : (currentLanguage === 'sl' ? 'Molitev za družino' : 'Family Prayer')}
                            </span>
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  <div className="space-y-0.5">
                    <p className="text-xs text-gray-600 truncate">
                      <span className="text-gray-400 font-mono tracking-wider font-bold text-[9px] uppercase mr-1">{translations.themeLabel}:</span> 
                      <span className="text-gray-800 font-semibold">{currentLanguage === 'sl' ? sunday.themeSl : sunday.themeEn}</span>
                    </p>
                    {(sunday.guest || sunday.absentOrNotes) && (
                      <p className="text-[11px] text-gray-400 truncate">
                        💡 {sunday.guest ? `${sunday.guest} • ` : ''}{sunday.absentOrNotes}
                      </p>
                    )}
                  </div>

                  {/* Coverage & Confirmation Badges info */}
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <span className="text-[9px] font-mono font-bold text-gray-400 block tracking-wider uppercase">
                      {translations.coverage}:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden border border-gray-200/50">
                        <div 
                          style={{ width: percentStr }} 
                          className={`h-full transition-all duration-300 ${progressColorClass}`}
                        />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-gray-600 flex items-center gap-1">
                        <span>{filled}/{total} ({percentStr})</span>
                        {percentNum === 100 && (
                          <span className="inline-flex items-center justify-center w-3.5 h-3.5 bg-emerald-100 text-emerald-700 rounded-full shrink-0">
                            <Check className="w-2.5 h-2.5 text-emerald-600 stroke-[3]" />
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Pending / Confirmed / Declined Mini Chips */}
                    {(() => {
                      let confirmedCnt = 0;
                      let pendingCnt = 0;
                      let declinedCnt = 0;
                      const declinedList: { name: string; reason?: string }[] = [];

                      if (sunday.assignmentDetails) {
                        Object.values(sunday.assignmentDetails).forEach(details => {
                          if (Array.isArray(details)) {
                            details.forEach(d => {
                              if (d.status === 'confirmed') {
                                confirmedCnt++;
                              } else if (d.status === 'declined') {
                                declinedCnt++;
                                declinedList.push({ name: d.personName, reason: d.declineReason });
                              } else {
                                pendingCnt++;
                              }
                            });
                          }
                        });
                      }

                      const declinedTooltip = declinedList.length > 0
                        ? declinedList.map(d => `${d.name}: "${d.reason || (currentLanguage === 'sl' ? 'Brez opombe' : 'No note')}"`).join('\n')
                        : (currentLanguage === 'sl' ? `${declinedCnt} zavrnjenih zadolžitev` : `${declinedCnt} declined assignments`);

                      return (
                        <div className="flex items-center gap-1.5 ml-auto">
                          {confirmedCnt > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-250 px-2 py-0.5 rounded-full" title={`${confirmedCnt} ${currentLanguage === 'sl' ? 'potrjenih zadolžitev' : 'confirmed assignments'}`}>
                              <Check className="w-2.5 h-2.5 text-emerald-600 stroke-[3]" />
                              <span>{confirmedCnt} {currentLanguage === 'sl' ? 'potrjeno' : 'confirmed'}</span>
                            </span>
                          )}
                          {pendingCnt > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-250 px-2 py-0.5 rounded-full" title={`${pendingCnt} ${currentLanguage === 'sl' ? 'v čakanju na potrditev' : 'pending confirmation'}`}>
                              <Clock className="w-2.5 h-2.5 text-amber-600 stroke-[2.5]" />
                              <span>{pendingCnt} {currentLanguage === 'sl' ? 'v čakanju' : 'pending'}</span>
                            </span>
                          )}
                          {declinedCnt > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-250 px-2 py-0.5 rounded-full cursor-help" title={declinedTooltip}>
                              <X className="w-2.5 h-2.5 text-rose-600" />
                              <span>{declinedCnt}</span>
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Right Arrow/Actions layout */}
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {canEdit && (
                    <button
                      onClick={() => setSundayToDelete(sunday)}
                      className="p-1.5 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-md transition focus:outline-none cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => onSelectSunday(sunday.id)}
                    className="p-1 text-gray-400 hover:text-gray-800 transition focus:outline-none cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition text-gray-400 group-hover:text-gray-700" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          yearView !== '2026_2027' || count2627 > 0 ? (
            <div className="col-span-full text-center p-8 bg-white border border-dashed border-gray-200 rounded-xl flex flex-col items-center">
              <AlertCircle className="w-8 h-8 text-gray-300 stroke-1 mb-2" />
              <p className="text-xs text-gray-400 font-mono">
                {currentLanguage === 'sl' 
                  ? 'Ni najdenih nedelj za izbrani filter.' 
                  : 'No services found matching this schedule filter.'}
              </p>
            </div>
          ) : null
        )}
      </div>

      {/* Sunday Delete Modal */}
      {sundayToDelete && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in"
          onClick={() => setSundayToDelete(null)}
        >
          <div 
            className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-gray-100 space-y-4 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display font-semibold text-gray-900 text-sm">
                  {currentLanguage === 'sl' ? 'Izbris nedeljskega bogoslužja' : 'Delete Sunday Roster'}
                </h3>
                <p className="text-xs text-indigo-600 font-medium font-mono truncate">
                  {sundayToDelete.date}
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 font-medium">
              {currentLanguage === 'sl' 
                ? 'Ali ste prepričani, da želite izbrisati to nedeljo?' 
                : 'Are you sure you want to delete this service date?'}
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSundayToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition cursor-pointer"
              >
                {currentLanguage === 'sl' ? 'Prekliči' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteSunday(sundayToDelete.id);
                  setSundayToDelete(null);
                }}
                className="px-4.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{currentLanguage === 'sl' ? 'Izbriši' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


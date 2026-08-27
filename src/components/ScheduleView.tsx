/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ServiceSunday, Ministry, UserRole, Translation } from '../types';
import { Calendar, ChevronRight, AlertCircle, Check, Sparkles, PlusCircle, History, BarChart3, Clock, X } from 'lucide-react';
import HeroHeaderBanner from './HeroHeaderBanner';
import { getEffectiveSundayFocus, getSundayCoverageStats } from '../lib/sundaySpecialFocus';
import { parseEuropeanDate, formatToEuropeanDate } from '../utils/dateUtils';
import { getAutoSundayStatus } from '../utils/academicYear';

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

  const canEdit = userRole === 'Admin' || userRole === 'Leader';

  // Threshold date for Academic Year 2026/2027: August 20, 2026 (first Sunday: Aug 30, 2026)
  const academicYearStartDate = new Date(2026, 7, 20);

  const isAcademicYear2627 = (dateStr: string) => {
    return parseEuropeanDate(dateStr).getTime() >= academicYearStartDate.getTime();
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
      // Ascending for upcoming academic year (from Aug 2026 onwards)
      return parseEuropeanDate(a.date).getTime() - parseEuropeanDate(b.date).getTime();
    }
    // Descending for history / all
    return parseEuropeanDate(b.date).getTime() - parseEuropeanDate(a.date).getTime();
  });

  const filteredSundays = sortedSundays;

  return (
    <div id="schedule-view-component" className="w-full space-y-5 animate-fade-in pb-12">
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
            className="px-3.5 py-1.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95 cursor-pointer flex items-center gap-1.5"
            title={currentLanguage === 'sl' ? 'Odpri analitiko in pregled pokritosti služb' : 'Open analytics and ministry coverage overview'}
          >
            <BarChart3 className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>{currentLanguage === 'sl' ? '📊 Statistika & Pokritost' : '📊 Statistics & Coverage'}</span>
          </button>
        }
      >
        {/* School Year / Archive Period Selector Line */}
        <div className="pt-2.5 border-t border-white/15 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-white/85 font-medium flex items-center gap-1.5 text-xs mr-1">
              <Calendar className="w-3.5 h-3.5 text-sky-300 shrink-0" />
              <span>{currentLanguage === 'sl' ? 'Obdobje:' : 'Period:'}</span>
            </span>

            <button
              onClick={() => setYearView('2026_2027')}
              className={`text-xs px-3 py-1 sm:px-3.5 rounded-xl transition font-medium flex items-center gap-1.5 cursor-pointer shrink-0 border ${
                yearView === '2026_2027'
                  ? 'bg-white text-indigo-950 border-white font-bold shadow-xs scale-[1.02]'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/15 backdrop-blur-xs'
              }`}
            >
              <span className="hidden sm:inline">{currentLanguage === 'sl' ? 'Šolsko leto 2026/2027' : 'School Year 2026/2027'}</span>
              <span className="sm:hidden">{currentLanguage === 'sl' ? 'Šol. leto 26/27' : 'Year 26/27'}</span>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                yearView === '2026_2027' ? 'bg-indigo-600 text-white' : 'bg-white/20 text-white'
              }`}>
                {count2627}
              </span>
            </button>

            <button
              onClick={() => setYearView('history')}
              className={`text-xs px-3 py-1 sm:px-3.5 rounded-xl transition font-medium flex items-center gap-1.5 cursor-pointer shrink-0 border ${
                yearView === 'history'
                  ? 'bg-amber-400 text-amber-950 border-amber-300 font-bold shadow-xs scale-[1.02]'
                  : 'bg-white/10 hover:bg-white/20 text-amber-200 border-white/15 backdrop-blur-xs'
              }`}
            >
              <History className="w-3 h-3 shrink-0" />
              <span className="hidden sm:inline">{currentLanguage === 'sl' ? 'Arhiv / Zgodovina (do avg. 2026)' : 'Past Archive (until Aug 2026)'}</span>
              <span className="sm:hidden">{currentLanguage === 'sl' ? 'Arhiv <=2026' : 'Archive <=2026'}</span>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                yearView === 'history' ? 'bg-amber-800 text-white' : 'bg-white/20 text-amber-100'
              }`}>
                {countHistory}
              </span>
            </button>

            <button
              onClick={() => setYearView('all')}
              className={`text-xs px-3 py-1 sm:px-3.5 rounded-xl transition font-medium flex items-center gap-1.5 cursor-pointer shrink-0 border ${
                yearView === 'all'
                  ? 'bg-slate-900 text-white border-slate-700 font-bold shadow-xs scale-[1.02]'
                  : 'bg-white/10 hover:bg-white/20 text-white/85 border-white/15 backdrop-blur-xs'
              }`}
            >
              <span>{currentLanguage === 'sl' ? 'Vse nedelje' : 'All Sundays'}</span>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                yearView === 'all' ? 'bg-white/30 text-white' : 'bg-white/20 text-white'
              }`}>
                {sundays.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-white/80">
              {filteredSundays.length} {currentLanguage === 'sl' ? 'nedelj' : 'Sundays'}
            </span>
          </div>
        </div>
      </HeroHeaderBanner>

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
            const covStats = getSundayCoverageStats(sunday, ministries);
            const total = covStats.totalRequired;
            const filled = covStats.filledRequired;
            const percentNum = covStats.percent;
            const percentStr = `${percentNum}%`;

            let progressColorClass = 'bg-slate-200';
            if (covStats.isFullyCovered) {
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

            const effectiveStatus = getAutoSundayStatus(sunday.date);
            const statusTagClass = 
              effectiveStatus === 'ready' ? 'tag-ready' : 'bg-[#EEF2FF] text-[#4338CA] border border-indigo-200';

            const statusLabel = 
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
                      {formatToEuropeanDate(sunday.date)}
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
    </div>
  );
}


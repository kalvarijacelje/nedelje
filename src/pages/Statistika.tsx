/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ServiceSunday, Ministry, Person, Translation, UserRole } from '../types';
import { 
  BarChart3, 
  Calendar, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Search, 
  ChevronRight, 
  ArrowLeft, 
  ShieldAlert, 
  HeartHandshake, 
  BookOpen, 
  Music, 
  Coffee, 
  Scissors, 
  Layers, 
  Flame, 
  Check, 
  Wine, 
  Filter,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import HeroHeaderBanner from '../components/HeroHeaderBanner';
import { calculatePersonBurnoutStatus, getBurnoutSummaryStats, isExemptFromBurnout } from '../lib/burnoutAnalytics';
import { getEffectiveSundayFocus, getSundayCoverageStats, isMinistryApplicableOnSunday } from '../lib/sundaySpecialFocus';

interface StatistikaProps {
  sundays: ServiceSunday[];
  ministries: Ministry[];
  people: Person[];
  currentLanguage: 'sl' | 'en';
  translations: Translation;
  onBack: () => void;
  onSelectSunday?: (sundayId: string) => void;
}

export default function Statistika({
  sundays,
  ministries,
  people,
  currentLanguage,
  translations,
  onBack,
  onSelectSunday,
}: StatistikaProps) {
  const [volunteerSearch, setVolunteerSearch] = useState('');
  const [volunteerFilter, setVolunteerFilter] = useState<'all' | 'overloaded' | 'balanced' | 'exempt'>('all');
  const [sundaySearch, setSundaySearch] = useState('');
  const [selectedLogSundayId, setSelectedLogSundayId] = useState<string | null>(null);

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

  // Sort sundays chronologically
  const sortedSundays = [...sundays].sort((a, b) => parseSheetDate(a.date).getTime() - parseSheetDate(b.date).getTime());

  // Filter Academic Year 2026/2027 sundays (Sep 1, 2026 -> Aug 31, 2027)
  const academicYear2627Start = new Date(2026, 8, 1);
  const academicYear2627End = new Date(2027, 7, 31);

  const aySundays = sortedSundays.filter(s => {
    const d = parseSheetDate(s.date);
    return d >= academicYear2627Start && d <= academicYear2627End;
  });

  const displaySundays = aySundays.length > 0 ? aySundays : sortedSundays;

  // --- 1. OVERALL COVERAGE COMPUTATIONS ---
  const totalSundaysCount = displaySundays.length;
  let totalPossibleSlots = 0;
  let totalFilledSlots = 0;

  displaySundays.forEach(sun => {
    const stats = getSundayCoverageStats(sun, ministries);
    totalPossibleSlots += stats.totalRequired;
    totalFilledSlots += stats.filledRequired;
  });

  const totalVacantSlots = Math.max(0, totalPossibleSlots - totalFilledSlots);
  const overallCoveragePercent = totalPossibleSlots > 0 ? Math.round((totalFilledSlots / totalPossibleSlots) * 100) : 0;

  // Category breakdown metrics
  const categoriesList = [
    { id: 'worship', labelSl: 'Slavljenje', labelEn: 'Worship', color: 'purple' },
    { id: 'audio_video', labelSl: 'Avdio Video', labelEn: 'Audio Video', color: 'cyan' },
    { id: 'sermon_prayer', labelSl: 'Bogoslužje', labelEn: 'Main Service', color: 'sky' },
    { id: 'kids', labelSl: 'Nedeljska šola', labelEn: 'Sunday School', color: 'emerald' },
    { id: 'hospitality', labelSl: 'Gostoljubje & Kava', labelEn: 'Hospitality & Snacks', color: 'rose' },
    { id: 'cleaning', labelSl: 'Priprava & Čiščenje', labelEn: 'Setup & Cleaning', color: 'amber' },
    { id: 'post_service', labelSl: 'Po bogoslužju', labelEn: 'Post-Service', color: 'indigo' },
  ];

  const categoryCoverage = categoriesList.map(cat => {
    const catMinistries = ministries.filter(m => 
      !m.isOptional && (
        m.category === cat.id ||
        (cat.id === 'post_service' && m.category === 'other') ||
        (cat.id === 'worship' && m.category === 'av_tech' && (m.id === 'slavilna_ekipa' || m.id === 'uvod_slavljenje' || m.id === 'zvok')) ||
        (cat.id === 'audio_video' && m.category === 'av_tech' && (m.id !== 'slavilna_ekipa' && m.id !== 'uvod_slavljenje' && m.id !== 'zvok'))
      )
    );
    let catTotalPossible = 0;
    let catFilled = 0;

    displaySundays.forEach(sun => {
      catMinistries.forEach(m => {
        if (isMinistryApplicableOnSunday(m, sun)) {
          catTotalPossible += 1;
          const assigned = sun.assignments?.[m.id] || [];
          if (assigned.length > 0 && assigned[0] !== '/') {
            catFilled += 1;
          }
        }
      });
    });

    const percent = catTotalPossible > 0 ? Math.round((catFilled / catTotalPossible) * 100) : 0;
    return {
      ...cat,
      totalPossible: catTotalPossible,
      filled: catFilled,
      percent,
    };
  });

  // --- 2. VOLUNTEER PARTICIPATION TRACKER ---
  const volunteerStatsMap = new Map<string, {
    person: Person | null;
    name: string;
    totalServed: number;
    ministryCounts: Record<string, number>;
  }>();

  // Populate from people database first
  people.forEach(p => {
    if (p && p.name) {
      volunteerStatsMap.set(p.name.trim(), {
        person: p,
        name: p.name.trim(),
        totalServed: 0,
        ministryCounts: {}
      });
    }
  });

  // Aggregate assigned Sundays from displaySundays
  displaySundays.forEach(sun => {
    Object.entries(sun.assignments || {}).forEach(([mId, names]) => {
      (names || []).forEach(name => {
        const cleanName = (name || '').trim();
        if (cleanName && cleanName !== '/' && cleanName.toLowerCase() !== 'all') {
          let stat = volunteerStatsMap.get(cleanName);
          if (!stat) {
            stat = { person: null, name: cleanName, totalServed: 0, ministryCounts: {} };
            volunteerStatsMap.set(cleanName, stat);
          }
          stat.totalServed += 1;
          stat.ministryCounts[mId] = (stat.ministryCounts[mId] || 0) + 1;
        }
      });
    });
  });

  const allVolunteerStatsList = Array.from(volunteerStatsMap.values())
    .map(v => {
      const burnoutStatus = calculatePersonBurnoutStatus(v.name, displaySundays, people);
      return {
        ...v,
        burnoutStatus
      };
    })
    .sort((a, b) => b.totalServed - a.totalServed);

  const filteredVolunteerList = allVolunteerStatsList.filter(v => {
    const matchesSearch = volunteerSearch === '' || v.name.toLowerCase().includes(volunteerSearch.toLowerCase());
    if (!matchesSearch) return false;

    if (volunteerFilter === 'overloaded') return v.burnoutStatus.status === 'overloaded';
    if (volunteerFilter === 'balanced') return v.burnoutStatus.status === 'balanced';
    if (volunteerFilter === 'exempt') return v.burnoutStatus.status === 'exempt';
    return true;
  });

  const summaryStats = getBurnoutSummaryStats(displaySundays, people);

  // --- 3. HISTORICAL LOG & SEARCH ---
  const filteredLogSundays = sortedSundays.filter(s => {
    if (!sundaySearch.trim()) return true;
    const query = sundaySearch.toLowerCase().trim();
    const dateMatches = s.date.toLowerCase().includes(query);
    const themeMatches = (s.themeSl || '').toLowerCase().includes(query) || (s.themeEn || '').toLowerCase().includes(query);
    const guestMatches = (s.guest || '').toLowerCase().includes(query);
    const notesMatches = (s.absentOrNotes || '').toLowerCase().includes(query);

    // Also search assigned volunteer names
    const assignedNames = Object.values(s.assignments || {}).flat().join(' ').toLowerCase();
    const volunteerMatches = assignedNames.includes(query);

    return dateMatches || themeMatches || guestMatches || notesMatches || volunteerMatches;
  });

  const selectedLogSunday = sortedSundays.find(s => s.id === selectedLogSundayId);

  return (
    <div id="statistika-dashboard-page" className="w-full space-y-6 animate-fade-in pb-16">
      {/* Hero Header Banner */}
      <HeroHeaderBanner
        variant="schedule"
        eyebrow={currentLanguage === 'sl' ? '📊 ANALITIKA IN PREGLED POKRITOSTI • KC KALVARIJA' : '📊 ANALYTICS & COVERAGE OVERVIEW • KC KALVARIJA'}
        title={currentLanguage === 'sl' ? 'Statistika & Pokritost Služb' : 'Statistics & Service Coverage'}
        subtitle={currentLanguage === 'sl' ? 'Celovit pregled pokritosti nedelj, analitika obremenitve sodelavcev ter zgodovinski arhiv pridig in razporedov.' : 'Comprehensive overview of Sunday coverage metrics, volunteer workload analytics, and historical rosters.'}
        icon={BarChart3}
        actions={
          <button
            onClick={onBack}
            className="px-4 py-2 bg-white/15 hover:bg-white/25 text-white border border-white/30 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-amber-200" />
            <span>{currentLanguage === 'sl' ? 'Nazaj na urnik' : 'Back to Schedule'}</span>
          </button>
        }
      />

      {/* --- SECTION 1: OVERALL COVERAGE METRICS & KPI CARDS --- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 font-display uppercase tracking-wider flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            <span>{currentLanguage === 'sl' ? '1. Skupna Pokritost Služb (Šolsko Leto 2026/2027)' : '1. Overall Ministry Coverage (2026/2027)'}</span>
          </h2>
          <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 px-2.5 py-1 rounded-lg">
            {displaySundays.length} {currentLanguage === 'sl' ? 'nedelj' : 'Sundays'}
          </span>
        </div>

        {/* 4 KPI Top Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs space-y-1">
            <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider block">
              {currentLanguage === 'sl' ? 'Načrtovane Nedelje' : 'Scheduled Sundays'}
            </span>
            <div className="text-xl font-extrabold text-slate-900 font-mono">
              {totalSundaysCount}
            </div>
            <p className="text-[11px] text-gray-500">
              {currentLanguage === 'sl' ? 'Šolsko leto 2026/2027' : 'School Year 2026/2027'}
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs space-y-1">
            <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider block">
              {currentLanguage === 'sl' ? 'Skupna Pokritost' : 'Overall Coverage'}
            </span>
            <div className="text-xl font-extrabold text-emerald-600 font-mono flex items-center gap-1.5">
              <span>{overallCoveragePercent}%</span>
              {overallCoveragePercent >= 80 && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            </div>
            <p className="text-[11px] text-gray-500">
              {totalFilledSlots} / {totalPossibleSlots} {currentLanguage === 'sl' ? 'mest' : 'slots'}
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs space-y-1">
            <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider block">
              {currentLanguage === 'sl' ? 'Prazna Mesta (Vacant)' : 'Vacant Slots'}
            </span>
            <div className="text-xl font-extrabold text-amber-600 font-mono">
              {totalVacantSlots}
            </div>
            <p className="text-[11px] text-gray-500">
              {currentLanguage === 'sl' ? 'Potrebujejo dodelitev' : 'Slots awaiting assignment'}
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs space-y-1">
            <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider block">
              {currentLanguage === 'sl' ? 'Opremljeni Sodelavci' : 'Active Volunteers'}
            </span>
            <div className="text-xl font-extrabold text-indigo-600 font-mono flex items-center gap-1">
              <span>{allVolunteerStatsList.filter(v => v.totalServed > 0).length}</span>
              {summaryStats.overloadedCount > 0 && (
                <span className="text-xs bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded-full border border-rose-200" title="Preobremenjeni sodelavci">
                  ⚠️ {summaryStats.overloadedCount}
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500">
              {currentLanguage === 'sl' ? 'Aktivno razporejeni' : 'Actively scheduled'}
            </p>
          </div>
        </div>

        {/* Category Breakdown Bars Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-gray-900 uppercase font-mono tracking-wider">
            {currentLanguage === 'sl' ? 'Pokritost Mesta po Kategorijah Služb' : 'Coverage Breakdown by Ministry Category'}
          </h3>

          <div className="space-y-3.5">
            {categoryCoverage.map(cat => {
              let barColorClass = 'bg-indigo-500';
              if (cat.id === 'worship' || cat.id === 'av_tech') barColorClass = 'bg-purple-500';
              if (cat.id === 'audio_video') barColorClass = 'bg-cyan-500';
              if (cat.id === 'kids') barColorClass = 'bg-emerald-500';
              if (cat.id === 'hospitality') barColorClass = 'bg-rose-500';
              if (cat.id === 'cleaning') barColorClass = 'bg-amber-500';
              if (cat.id === 'sermon_prayer') barColorClass = 'bg-sky-500';
              if (cat.id === 'post_service' || cat.id === 'other') barColorClass = 'bg-indigo-500';

              return (
                <div key={cat.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-800 flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${barColorClass}`} />
                      <span>{currentLanguage === 'sl' ? cat.labelSl : cat.labelEn}</span>
                    </span>
                    <span className="font-mono font-bold text-gray-700">
                      {cat.filled} / {cat.totalPossible} ({cat.percent}%)
                    </span>
                  </div>

                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden border border-gray-200/60">
                    <div 
                      style={{ width: `${cat.percent}%` }}
                      className={`h-full transition-all duration-500 ${barColorClass}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* --- SECTION 2: VOLUNTEER PARTICIPATION TRACKER & BURNOUT ALERTS --- */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h2 className="text-sm font-bold text-gray-900 font-display uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>{currentLanguage === 'sl' ? '2. Sledenje Sodelavcem & Opremljenost (Burnout Alert)' : '2. Volunteer Participation & Fatigue Tracker'}</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {currentLanguage === 'sl' 
                ? 'Spremljanje zaporednih nedelj in obremenjenosti sodelavcev za preprečevanje izgorelosti' 
                : 'Monitor volunteer frequency and consecutive Sundays to prevent serving fatigue'}
            </p>
          </div>

          {/* Volunteer Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200 shrink-0">
            <button
              onClick={() => setVolunteerFilter('all')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                volunteerFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {currentLanguage === 'sl' ? 'Vsi' : 'All'} ({allVolunteerStatsList.length})
            </button>
            <button
              onClick={() => setVolunteerFilter('overloaded')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${
                volunteerFilter === 'overloaded' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              <span>🔴 Preobremenjeni</span>
              <span className="text-[10px] font-mono font-bold bg-white/20 px-1.5 rounded-full">
                {summaryStats.overloadedCount}
              </span>
            </button>
            <button
              onClick={() => setVolunteerFilter('balanced')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                volunteerFilter === 'balanced' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              🟢 Uravnoteženi
            </button>
          </div>
        </div>

        {/* Volunteer Search Box */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={volunteerSearch}
            onChange={(e) => setVolunteerSearch(e.target.value)}
            placeholder={currentLanguage === 'sl' ? 'Išči sodelavca po imenu...' : 'Search volunteer by name...'}
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-indigo-500 shadow-xs font-semibold"
          />
        </div>

        {/* Volunteers Grid List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredVolunteerList.map((vol) => {
            const status = vol.burnoutStatus;
            const isOverloaded = status.status === 'overloaded';

            return (
              <div
                key={vol.name}
                className={`bg-white border rounded-2xl p-4 shadow-2xs space-y-3 transition ${
                  isOverloaded 
                    ? 'border-rose-300 bg-rose-50/20' 
                    : status.status === 'exempt' 
                    ? 'border-purple-200 bg-purple-50/10' 
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2.5">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 font-display flex items-center gap-1.5">
                      <span>{vol.name}</span>
                      {vol.person?.role && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                          {vol.person.role}
                        </span>
                      )}
                    </h4>
                    <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                      Zadolžitve v letu 2026/2027: <strong className="text-gray-900">{vol.totalServed}x nedelja</strong>
                    </p>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border flex items-center gap-1 ${status.colorClass}`}>
                    <span>{status.badge}</span>
                    <span>{currentLanguage === 'sl' ? status.labelSl : status.labelEn}</span>
                  </span>
                </div>

                {/* Serving details & recommendation */}
                <div className="space-y-2">
                  {isOverloaded && (
                    <div className="p-2.5 bg-rose-100/80 border border-rose-300 rounded-xl text-xs text-rose-950 font-medium flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">⚠️ Opozorilo pred izgorelostjo!</span>
                        <span>{status.recommendationSl}</span>
                      </div>
                    </div>
                  )}

                  {/* Ministry breakdown pills */}
                  {Object.keys(vol.ministryCounts).length > 0 ? (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {Object.entries(vol.ministryCounts).map(([mId, count]) => {
                        const m = ministries.find(min => min.id === mId);
                        const mName = m ? (currentLanguage === 'sl' ? m.nameSl : m.nameEn) : mId;

                        return (
                          <span key={mId} className="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-250 rounded-md text-[10px] font-mono">
                            {mName}: <strong>{count}x</strong>
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-400 italic">
                      {currentLanguage === 'sl' ? 'V tem letu še ni zabeleženih zadolžitev' : 'No service assignments recorded for this year'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- SECTION 3: HISTORICAL SUNDAY LOG & SEARCHABLE ROSTER INSPECTOR --- */}
      <div className="space-y-4 pt-4 border-t border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h2 className="text-sm font-bold text-gray-900 font-display uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>{currentLanguage === 'sl' ? '3. Zgodovinski Arhiv & Pregledovalnik Nedeljskih Ekip' : '3. Historical Roster Log & Inspection'}</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {currentLanguage === 'sl' 
                ? 'Kliknite na katerokoli nedeljo za natančen vpogled v ekipo sodelavcev (pridigar, slavljenje, nedeljska šola, kava)' 
                : 'Click any Sunday to inspect exact roster assignees (preacher, worship, teachers, AV tech, coffee team)'}
            </p>
          </div>

          <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 shrink-0">
            {filteredLogSundays.length} {currentLanguage === 'sl' ? 'nedelj v dnevniku' : 'logged Sundays'}
          </span>
        </div>

        {/* Log Search input */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={sundaySearch}
            onChange={(e) => setSundaySearch(e.target.value)}
            placeholder={currentLanguage === 'sl' ? 'Išči po datumu, učitelju, pridigarju ali temi...' : 'Search by date, preacher, or sermon topic...'}
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-indigo-500 shadow-xs font-semibold"
          />
        </div>

        {/* Date-indexed log cards */}
        <div className="space-y-3">
          {filteredLogSundays.map((sun) => {
            const isSelected = selectedLogSundayId === sun.id;
            const effFocus = getEffectiveSundayFocus(sun);

            // Compute roster categories counts
            const assignedCount = Object.keys(sun.assignments || {}).filter(k => (sun.assignments[k] || []).length > 0).length;

            return (
              <div
                key={sun.id}
                className={`bg-white border rounded-2xl p-4 shadow-2xs transition space-y-3 cursor-pointer ${
                  isSelected ? 'border-indigo-400 ring-2 ring-indigo-100 bg-indigo-50/10' : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedLogSundayId(isSelected ? null : sun.id)}
              >
                <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-bold text-sm text-gray-900 font-mono">{sun.date}</span>
                    {sun.themeSl && (
                      <span className="text-xs font-semibold text-indigo-950 font-display">
                        📖 {sun.themeSl}
                      </span>
                    )}

                    {effFocus.type === 'communion' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                        <span>🍷🍞 Gospodova Večerja</span>
                      </span>
                    )}
                    {effFocus.type === 'prayer_focus' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                        <span>🙏 Molitev za družino</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                      {assignedCount} {currentLanguage === 'sl' ? 'služb zasedenih' : 'roles filled'}
                    </span>
                    {isSelected ? <ChevronUp className="w-4 h-4 text-indigo-600" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>

                {/* Quick preview of preacher / speaker */}
                <div className="text-xs text-gray-700 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">Učenje/Pridigar:</span>
                    <span>{(sun.assignments['ucenje'] || []).join(', ') || (sun.themeSl ? sun.themeSl.split(' ')[0] : 'Ni določeno')}</span>
                  </div>

                  {onSelectSunday && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSunday(sun.id);
                      }}
                      className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>{currentLanguage === 'sl' ? 'Uredi razpored →' : 'Edit Sunday →'}</span>
                    </button>
                  )}
                </div>

                {/* Expanded Full Roster Details */}
                {isSelected && (
                  <div className="pt-3 border-t border-gray-100 space-y-3 text-xs animate-fade-in">
                    <h5 className="font-bold text-gray-900 font-display uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{currentLanguage === 'sl' ? 'Popolna Ekipa Sodelavcev na to Nedeljo:' : 'Full Service Volunteer Roster:'}</span>
                    </h5>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {ministries.map((m) => {
                        const assignees = sun.assignments?.[m.id] || [];
                        const hasAssignees = assignees.length > 0;

                        return (
                          <div 
                            key={m.id} 
                            className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                              hasAssignees 
                                ? 'bg-slate-50 border-slate-200 text-slate-900' 
                                : 'bg-rose-50/50 border-rose-200 text-rose-700'
                            }`}
                          >
                            <span className="text-[10px] font-bold font-mono uppercase tracking-wider block text-gray-500">
                              {currentLanguage === 'sl' ? m.nameSl : m.nameEn}
                            </span>
                            <p className="font-semibold text-xs">
                              {hasAssignees ? assignees.join(', ') : (currentLanguage === 'sl' ? '⚠️ Ni dodeljeno' : '⚠️ Unassigned')}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

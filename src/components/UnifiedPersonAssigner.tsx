import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Person, ServiceSunday, BlackoutDate, Ministry, UserRole } from '../types';
import { checkPersonAbsenceOnSunday, getMinistryIconEmoji } from './SundayDetail';
import { 
  Search, 
  X, 
  Check, 
  Clock, 
  AlertTriangle, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  User, 
  Users, 
  Star, 
  Sparkles, 
  Repeat, 
  Calendar,
  MessageSquare,
  MoreVertical
} from 'lucide-react';
import { WhatsAppIcon, MessengerIcon, GoogleChatIcon } from './CommunicationIcons';

export interface UnifiedPersonAssignerProps {
  mode: 'single' | 'multiple';
  label: string;
  icon?: string | React.ReactNode;
  value?: string | string[];
  onChange: (newValue: string | string[]) => void;
  targetSunday?: ServiceSunday;
  allSundays?: ServiceSunday[];
  people: Person[];
  blackoutDates?: BlackoutDate[];
  ministries?: Ministry[];
  roleKey?: string; // e.g. 'acoustic', 'drums', 'teacher', 'assistant', 'leader', 'cistoca'
  category?: string;
  currentLanguage?: 'sl' | 'en';
  canEdit?: boolean;
  compact?: boolean;
  enableSeriesOption?: boolean;
  onSeriesApply?: (weeksCount: number, personName: string) => void;
  showChatInviteButtons?: boolean;
  userRole?: UserRole;
  activePersonName?: string;
}

export const UnifiedPersonAssigner: React.FC<UnifiedPersonAssignerProps> = ({
  mode,
  label,
  icon,
  value,
  onChange,
  targetSunday,
  allSundays = [],
  people = [],
  blackoutDates = [],
  ministries = [],
  roleKey,
  category,
  currentLanguage = 'sl',
  canEdit = true,
  compact = false,
  enableSeriesOption = false,
  onSeriesApply,
  showChatInviteButtons = true,
  userRole,
  activePersonName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [enableSeries, setEnableSeries] = useState(false);
  const [seriesWeeks, setSeriesWeeks] = useState(3);
  const containerRef = useRef<HTMLDivElement>(null);

  // Automatically reset multi-week checkbox when closed or role changes
  useEffect(() => {
    if (!isOpen) {
      setEnableSeries(false);
    }
  }, [isOpen, roleKey]);

  // Normalize active assignments into a string array
  const assignedList = useMemo(() => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    return typeof value === 'string' && value.trim() && value !== '-' ? [value.trim()] : [];
  }, [value]);

  // Determine candidate lists (Tier 1 Preferred, Tier 2 Other, Tier 3 Absent)
  const candidateTiers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const cleanRole = (roleKey || '').toLowerCase();
    const effectiveBlackouts = blackoutDates || [];
    const sundayDate = targetSunday?.date || '';

    const results: Array<{
      person: Person;
      tier: 1 | 2 | 3;
      isSpecialist: boolean;
      conflictLabel?: string;
      absenceReason?: string;
      isCurrentlyAssigned: boolean;
    }> = [];

    people.forEach((p) => {
      if (!p || !p.name) return;
      if (query && !p.name.toLowerCase().includes(query)) return;

      const isCurrentlyAssigned = assignedList.includes(p.name);

      // Check absence on this Sunday
      const { isAbsent, reason: absenceReason } = checkPersonAbsenceOnSunday(p.name, sundayDate, effectiveBlackouts);

      // Check if person is a role specialist / preferred
      const prefList = (p.preferredMinistries || []).map(m => m.toLowerCase());
      const ledList = (p.ledMinistries || []).map(m => m.toLowerCase());
      const tags = (p.tags || []).map(t => t.toLowerCase());

      let isSpecialist = false;
      if (cleanRole === 'leader' || cleanRole === 'voditelj') {
        isSpecialist = p.role === 'Leader' || p.role === 'Admin' || tags.includes('worship') || tags.includes('leader') || prefList.includes('slavilna_ekipa') || prefList.includes('uvod_slavljenje');
      } else if (cleanRole === 'acoustic' || cleanRole === 'akustika') {
        isSpecialist = tags.includes('akustika') || tags.includes('kitara') || tags.includes('guitar') || tags.includes('acoustic') || prefList.includes('slavilna_ekipa');
      } else if (cleanRole === 'drums' || cleanRole === 'bobni') {
        isSpecialist = tags.includes('bobni') || tags.includes('drums') || prefList.includes('slavilna_ekipa');
      } else if (cleanRole === 'bass' || cleanRole === 'bas') {
        isSpecialist = tags.includes('bas') || tags.includes('bass') || prefList.includes('slavilna_ekipa');
      } else if (cleanRole === 'keys' || cleanRole === 'klaviature') {
        isSpecialist = tags.includes('klavir') || tags.includes('keys') || tags.includes('klaviature') || tags.includes('piano') || prefList.includes('slavilna_ekipa');
      } else if (cleanRole === 'vocals' || cleanRole === 'vokali') {
        isSpecialist = tags.includes('vokal') || tags.includes('vocal') || tags.includes('petje') || tags.includes('sing') || prefList.includes('slavilna_ekipa');
      } else if (cleanRole === 'sound' || cleanRole === 'zvok') {
        isSpecialist = tags.includes('zvok') || tags.includes('sound') || tags.includes('audio') || prefList.includes('zvok') || prefList.includes('av_tech');
      } else if (cleanRole === 'slides' || cleanRole === 'projekcija' || cleanRole === 'besedila') {
        isSpecialist = tags.includes('projekcija') || tags.includes('slides') || tags.includes('besedila') || prefList.includes('besedila') || prefList.includes('av_tech');
      } else if (cleanRole === 'nedeljska_sola_mlajsa' || cleanRole === 'nedeljska_sola_mlajsa_helper' || cleanRole === 'mlajsa') {
        isSpecialist = prefList.includes('nedeljska_sola_mlajsa') || prefList.includes('otroško služenje - mlajša') || ledList.includes('nedeljska_sola_mlajsa') || ledList.includes('otroško služenje - mlajša') || tags.includes('mlajša');
      } else if (cleanRole === 'nedeljska_sola_starejsa' || cleanRole === 'nedeljska_sola_starejsa_helper' || cleanRole === 'starejsa') {
        isSpecialist = prefList.includes('nedeljska_sola_starejsa') || prefList.includes('otroško služenje - starejša') || ledList.includes('nedeljska_sola_starejsa') || ledList.includes('otroško služenje - starejša') || tags.includes('starejša');
      } else if (cleanRole === 'teacher' || cleanRole === 'ucitelj') {
        isSpecialist = tags.includes('učitelj') || tags.includes('teacher') || tags.includes('šola') || tags.includes('kids') || prefList.includes('nedeljska_sola') || prefList.includes('nedeljska_sola_mlajsa') || prefList.includes('nedeljska_sola_starejsa');
      } else if (cleanRole === 'assistant' || cleanRole === 'pomocnik') {
        isSpecialist = tags.includes('pomočnik') || tags.includes('assistant') || tags.includes('šola') || tags.includes('kids') || prefList.includes('nedeljska_sola') || prefList.includes('nedeljska_sola_mlajsa') || prefList.includes('nedeljska_sola_starejsa');
      } else if (roleKey) {
        isSpecialist = prefList.includes(cleanRole) || ledList.includes(cleanRole);
      }

      // Check conflict assignments on this Sunday
      const otherConflicts: string[] = [];
      if (targetSunday && targetSunday.assignments) {
        Object.entries(targetSunday.assignments).forEach(([mId, names]) => {
          if (mId !== roleKey && Array.isArray(names) && names.includes(p.name)) {
            const m = ministries.find(x => x.id === mId);
            const mName = m ? (currentLanguage === 'sl' ? m.nameSl : m.nameEn) : mId;
            const emoji = getMinistryIconEmoji(mId);
            otherConflicts.push(`${emoji} ${mName}`);
          }
        });
      }

      let conflictLabel = otherConflicts.length > 0 ? otherConflicts.slice(0, 2).join(', ') : undefined;

      // Tier Calculation
      let tier: 1 | 2 | 3 = 2;
      if (isAbsent) {
        tier = 3;
      } else if (isSpecialist) {
        tier = 1;
      } else {
        tier = 2;
      }

      results.push({
        person: p,
        tier,
        isSpecialist,
        conflictLabel,
        absenceReason: isAbsent ? (absenceReason || (currentLanguage === 'sl' ? 'Dopust / Odsoten' : 'Absent')) : undefined,
        isCurrentlyAssigned,
      });
    });

    // Sort within tiers alphabetically
    return results.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return a.person.name.localeCompare(b.person.name, 'sl', { sensitivity: 'base' });
    });
  }, [people, searchQuery, roleKey, blackoutDates, targetSunday, assignedList, ministries, currentLanguage]);

  const tier1 = useMemo(() => candidateTiers.filter(c => c.tier === 1), [candidateTiers]);
  const tier2 = useMemo(() => candidateTiers.filter(c => c.tier === 2), [candidateTiers]);
  const tier3 = useMemo(() => candidateTiers.filter(c => c.tier === 3), [candidateTiers]);

  const handleSelectPerson = (name: string) => {
    if (mode === 'single') {
      const isDeselect = assignedList.includes(name);
      const nextVal = isDeselect ? '' : name;
      onChange(nextVal);
      setIsOpen(false);
      setSearchQuery('');

      if (!isDeselect && enableSeries && onSeriesApply) {
        onSeriesApply(seriesWeeks, name);
      }
    } else {
      // Multiple mode
      if (assignedList.includes(name)) {
        onChange(assignedList.filter(n => n !== name));
      } else {
        onChange([...assignedList, name]);
        if (enableSeries && onSeriesApply) {
          onSeriesApply(seriesWeeks, name);
        }
      }
    }
  };

  const handleRemovePerson = (name: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (mode === 'single') {
      onChange('');
    } else {
      onChange(assignedList.filter(n => n !== name));
    }
  };

  // Click outside to collapse
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Read-only presentation
  if (!canEdit) {
    if (compact) {
      return (
        <span className="text-slate-700 font-medium text-xs truncate block">
          {assignedList.length > 0 ? (currentLanguage === 'sl' ? 'Dodeljeno' : 'Assigned') : '-'}
        </span>
      );
    }
    return (
      <div className="bg-slate-50/90 p-2.5 rounded-xl border border-slate-200/70 space-y-1">
        <span className="text-[9px] uppercase font-bold text-gray-500 font-mono flex items-center gap-1">
          {icon && <span>{icon}</span>}
          <span>{label}</span>
        </span>
        <div className="flex flex-wrap gap-1">
          {assignedList.length === 0 ? (
            <span className="text-xs text-gray-400 italic font-mono">-</span>
          ) : (
            assignedList.map(name => (
              <span key={name} className="text-xs font-semibold text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-250">
                👤 {currentLanguage === 'sl' ? 'Dodeljeno' : 'Assigned'}
              </span>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative transition-all ${compact ? 'min-w-[130px]' : 'space-y-1.5'}`}>
      {/* 1. SLOT HEADER / SUMMARY BAR */}
      {compact ? (
        /* Compact Button for Table Cells */
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full text-left text-xs font-semibold py-1 px-2 rounded-lg border transition flex items-center justify-between gap-1 cursor-pointer ${
            assignedList.length > 0
              ? 'bg-white border-indigo-200 text-indigo-950 shadow-2xs hover:border-indigo-400'
              : 'bg-slate-50/80 border-dashed border-gray-300 text-gray-400 hover:bg-white hover:border-gray-400 hover:text-gray-700'
          }`}
        >
          <span className="truncate">
            {assignedList.length > 0 ? (
              <span>👤 {assignedList.join(', ')}</span>
            ) : (
              <span>+ {label}...</span>
            )}
          </span>
          <ChevronDown className={`w-3 h-3 shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180 text-indigo-600' : ''}`} />
        </button>
      ) : (
        /* Standard Rich Card Slot View */
        <div className="bg-slate-50/90 hover:bg-white p-2.5 rounded-xl border border-slate-200/80 hover:border-indigo-300 transition space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] uppercase font-bold text-gray-500 font-mono flex items-center gap-1">
              {icon && <span>{icon}</span>}
              <span>{label}</span>
            </span>

            {/* Quick Toggle Drawer Button */}
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-md transition cursor-pointer flex items-center gap-1 border ${
                isOpen
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                  : assignedList.length > 0
                  ? 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
                  : 'bg-white text-gray-600 border-gray-250 hover:border-gray-400 hover:text-gray-900'
              }`}
            >
              <span>{isOpen ? '▲ Zapri' : mode === 'multiple' ? '+ Dodaj / Ostali' : assignedList.length > 0 ? 'Spremeni' : '+ Dodaj'}</span>
            </button>
          </div>

          {/* Active Assigned Badges */}
          <div className="flex flex-wrap gap-1.5 items-center min-h-[26px]">
            {assignedList.length === 0 ? (
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="text-[11px] text-gray-400 hover:text-indigo-600 font-medium italic cursor-pointer flex items-center gap-1"
              >
                <span>— {currentLanguage === 'sl' ? 'Klikni za določitev' : 'Unassigned (click to assign)'} —</span>
              </button>
            ) : (
              assignedList.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 text-[11px] font-bold bg-white text-indigo-950 border border-indigo-200 px-2 py-0.5 rounded-lg shadow-2xs group/chip"
                >
                  <span>👤 {name}</span>
                  <button
                    type="button"
                    onClick={(e) => handleRemovePerson(name, e)}
                    className="text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded p-0.5 transition cursor-pointer font-bold leading-none"
                    title={currentLanguage === 'sl' ? `Odstrani ${name}` : `Remove ${name}`}
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
        </div>
      )}

      {/* 2. INLINE EXPANDABLE SEARCH & CANDIDATE PILLS DRAWER */}
      {isOpen && (
        <div
          className={`z-30 p-3 bg-white border border-indigo-200 rounded-xl shadow-xl space-y-2.5 animate-in fade-in zoom-in-95 duration-150 ${
            compact ? 'absolute left-0 top-full mt-1 min-w-[280px] sm:min-w-[320px]' : 'mt-1.5'
          }`}
        >
          {/* Real-time Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={currentLanguage === 'sl' ? `Išči ${label.toLowerCase()}...` : `Search ${label.toLowerCase()}...`}
              className="w-full text-xs pl-8 pr-7 py-1.5 bg-slate-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-gray-400 hover:text-gray-600 absolute right-2 top-1/2 -translate-y-1/2 font-bold cursor-pointer"
              >
                ×
              </button>
            )}
          </div>

          {/* Optional Recurring Series Checkbox */}
          {enableSeriesOption && (
            <div className="bg-indigo-50/70 p-2 rounded-lg border border-indigo-100 flex items-center justify-between gap-2 text-xs">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableSeries}
                  onChange={(e) => setEnableSeries(e.target.checked)}
                  className="w-3.5 h-3.5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                <Repeat className="w-3 h-3 text-indigo-600 shrink-0" />
                <span>{currentLanguage === 'sl' ? 'Več tednov zapored' : 'Multiple weeks'}</span>
              </label>

              {enableSeries && (
                <select
                  value={seriesWeeks}
                  onChange={(e) => setSeriesWeeks(Number(e.target.value))}
                  className="text-[10px] font-bold bg-white text-indigo-900 border border-indigo-200 rounded px-1.5 py-0.5 cursor-pointer"
                >
                  {[2, 3, 4, 5, 6].map(n => (
                    <option key={n} value={n}>{n} {currentLanguage === 'sl' ? 'tedne' : 'weeks'}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Categorized Person Pills Grid */}
          <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
            {/* TIER 1: ⭐ Preferred / Specialists */}
            {tier1.length > 0 && (
              <div className="space-y-1">
                <span className="text-[9px] uppercase font-bold text-amber-700 font-mono flex items-center gap-1">
                  <span>⭐</span>
                  <span>{currentLanguage === 'sl' ? `Predlagani ${label}` : `Suggested ${label}`}</span>
                </span>
                <div className="flex flex-wrap gap-1">
                  {tier1.map(({ person, conflictLabel, isCurrentlyAssigned }) => (
                    <button
                      key={person.id || person.name}
                      type="button"
                      onClick={() => handleSelectPerson(person.name)}
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border transition cursor-pointer active:scale-95 text-left ${
                        isCurrentlyAssigned
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs font-bold'
                          : 'bg-amber-50/80 hover:bg-amber-100/90 text-amber-950 border-amber-200/90 hover:border-amber-300'
                      }`}
                      title={conflictLabel ? `${person.name} [${conflictLabel}]` : person.name}
                    >
                      <span>⭐ {person.name}</span>
                      {conflictLabel && (
                        <span className={`text-[9px] px-1 rounded font-mono ${isCurrentlyAssigned ? 'bg-indigo-700 text-white' : 'bg-amber-100 text-amber-900 border border-amber-250'}`}>
                          {conflictLabel}
                        </span>
                      )}
                      {isCurrentlyAssigned && <Check className="w-3 h-3 text-white stroke-[3] ml-0.5" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TIER 2: 👤 Other Available Volunteers */}
            {tier2.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-gray-100">
                <span className="text-[9px] uppercase font-bold text-slate-500 font-mono flex items-center gap-1">
                  <span>👤</span>
                  <span>{currentLanguage === 'sl' ? 'Ostali razpoložljivi' : 'Other volunteers'}</span>
                </span>
                <div className="flex flex-wrap gap-1">
                  {tier2.map(({ person, conflictLabel, isCurrentlyAssigned }) => (
                    <button
                      key={person.id || person.name}
                      type="button"
                      onClick={() => handleSelectPerson(person.name)}
                      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg border transition cursor-pointer active:scale-95 text-left ${
                        isCurrentlyAssigned
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs font-bold'
                          : 'bg-white hover:bg-slate-100 text-slate-800 border-gray-200 hover:border-gray-300'
                      }`}
                      title={conflictLabel ? `${person.name} [${conflictLabel}]` : person.name}
                    >
                      <span>{person.name}</span>
                      {conflictLabel && (
                        <span className={`text-[9px] px-1 rounded font-mono ${isCurrentlyAssigned ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                          {conflictLabel}
                        </span>
                      )}
                      {isCurrentlyAssigned && <Check className="w-3 h-3 text-white stroke-[3] ml-0.5" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TIER 3: ⚠️ Absent / Blackout Volunteers */}
            {tier3.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-gray-100">
                <span className="text-[9px] uppercase font-bold text-rose-600 font-mono flex items-center gap-1">
                  <span>⚠️</span>
                  <span>{currentLanguage === 'sl' ? 'Odsotni / Dopust' : 'Absent / Unavailable'}</span>
                </span>
                <div className="flex flex-wrap gap-1">
                  {tier3.map(({ person, absenceReason, isCurrentlyAssigned }) => (
                    <button
                      key={person.id || person.name}
                      type="button"
                      onClick={() => handleSelectPerson(person.name)}
                      className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-lg border transition cursor-pointer active:scale-95 text-left opacity-75 hover:opacity-100 ${
                        isCurrentlyAssigned
                          ? 'bg-rose-600 text-white border-rose-700 shadow-2xs font-bold'
                          : 'bg-rose-50/70 hover:bg-rose-100/90 text-rose-900 border-rose-200'
                      }`}
                      title={`${person.name}: ${absenceReason || 'Odsoten'}`}
                    >
                      <span>⚠️ {person.name}</span>
                      {absenceReason && <span className="text-[9px] italic opacity-80 truncate max-w-[100px]">({absenceReason})</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {candidateTiers.length === 0 && (
              <p className="text-xs text-gray-400 italic text-center py-2">
                {currentLanguage === 'sl' ? 'Ni zadetkov za iskanje.' : 'No matching volunteers found.'}
              </p>
            )}
          </div>

          {/* Drawer Footer Actions */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-150 text-xs">
            {assignedList.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  if (mode === 'single') onChange('');
                  else onChange([]);
                }}
                className="text-[10px] text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
              >
                Počisti izbiro ({assignedList.length})
              </button>
            ) : <span />}

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setSearchQuery('');
              }}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-bold text-[10px] cursor-pointer"
            >
              Zapri
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedPersonAssigner;

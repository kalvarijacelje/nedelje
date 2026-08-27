import React, { useState } from 'react';
import { ServiceSunday, Ministry, Person, Language, ServiceAttendanceRecord, ServiceHeadcount } from '../types';
import { useBackdropHistory } from '../hooks/useBackdropHistory';
import { formatToEuropeanDate } from '../utils/dateUtils';
import {
  UserCheck,
  X,
  Check,
  Clock,
  UserX,
  Sparkles,
  Users,
  Plus,
  Minus,
  Save,
  Copy,
  CheckCircle2,
  AlertCircle,
  Search,
  UserPlus
} from 'lucide-react';

interface AttendanceCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  sunday: ServiceSunday;
  allSundays: ServiceSunday[];
  ministries: Ministry[];
  people: Person[];
  currentLanguage: Language;
  onUpdateSunday: (updatedSunday: ServiceSunday) => void;
  onSelectSundayId?: (id: string) => void;
}

export default function AttendanceCheckInModal({
  isOpen,
  onClose,
  sunday,
  allSundays,
  ministries,
  people,
  currentLanguage,
  onUpdateSunday,
  onSelectSundayId
}: AttendanceCheckInModalProps) {
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMinistry, setFilterMinistry] = useState<string>('all');
  
  // Walk-in / Substitute state
  const [showAddSubstitute, setShowAddSubstitute] = useState(false);
  const [substitutePerson, setSubstitutePerson] = useState('');
  const [substituteMinistry, setSubstituteMinistry] = useState(ministries[0]?.id || 'av_tech');

  // Headcount local state
  const [headcount, setHeadcount] = useState<ServiceHeadcount>(() => {
    return (
      sunday.headcount || {
        adults: 65,
        children: 14,
        visitors: 3,
        notes: ''
      }
    );
  });

  useBackdropHistory(isOpen, onClose, 'attendance-checkin-modal');

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Get current attendance records
  const currentAttendance = sunday.attendanceRecords || {};

  // Get all assigned people for this sunday across all ministries
  const assignedList: { personName: string; ministryId: string; ministryName: string }[] = [];

  Object.entries(sunday.assignments).forEach(([mId, names]) => {
    if (Array.isArray(names)) {
      names.forEach((pName) => {
        const ministry = ministries.find((m) => m.id === mId);
        assignedList.push({
          personName: pName,
          ministryId: mId,
          ministryName: ministry ? (currentLanguage === 'sl' ? ministry.nameSl : ministry.nameEn) : mId
        });
      });
    }
  });

  // Handle single check-in status update
  const handleSetCheckInStatus = (
    personName: string,
    ministryId: string,
    status: 'present' | 'late' | 'absent' | 'excused'
  ) => {
    const key = `${ministryId}_${personName}`;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const updatedRecords: Record<string, ServiceAttendanceRecord> = {
      ...currentAttendance,
      [key]: {
        personName,
        ministryId,
        status,
        checkInTime: status === 'present' || status === 'late' ? nowTime : undefined
      }
    };

    const updatedSunday: ServiceSunday = {
      ...sunday,
      attendanceRecords: updatedRecords
    };

    onUpdateSunday(updatedSunday);

    const statusLabel =
      status === 'present'
        ? currentLanguage === 'sl' ? 'Prisoten' : 'Present'
        : status === 'late'
        ? currentLanguage === 'sl' ? 'Zamudil' : 'Late'
        : status === 'absent'
        ? currentLanguage === 'sl' ? 'Odsoten' : 'Absent'
        : currentLanguage === 'sl' ? 'Opravičen' : 'Excused';

    showToast(`✓ ${personName}: ${statusLabel}`);
  };

  // Quick action: Mark all scheduled as present
  const handleMarkAllPresent = () => {
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const updatedRecords: Record<string, ServiceAttendanceRecord> = { ...currentAttendance };

    assignedList.forEach(({ personName, ministryId }) => {
      const key = `${ministryId}_${personName}`;
      if (!updatedRecords[key] || updatedRecords[key].status === 'absent') {
        updatedRecords[key] = {
          personName,
          ministryId,
          status: 'present',
          checkInTime: nowTime
        };
      }
    });

    onUpdateSunday({
      ...sunday,
      attendanceRecords: updatedRecords
    });

    showToast(
      currentLanguage === 'sl'
        ? '✓ Vsi razporejeni sodelavci označeni kot prisotni!'
        : '✓ All assigned servants marked present!'
    );
  };

  // Save headcount changes
  const handleSaveHeadcount = (updated: ServiceHeadcount) => {
    setHeadcount(updated);
    onUpdateSunday({
      ...sunday,
      headcount: updated
    });
  };

  const handleAdjustHeadcount = (field: 'adults' | 'children' | 'visitors', delta: number) => {
    const currentVal = headcount[field] || 0;
    const newVal = Math.max(0, currentVal + delta);
    const updated = { ...headcount, [field]: newVal };
    handleSaveHeadcount(updated);
  };

  // Add Substitute / Walk-in volunteer
  const handleAddSubstitute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!substitutePerson.trim()) return;

    const trimmed = substitutePerson.trim();
    // Add to assignments for this Sunday
    const currentMList = sunday.assignments[substituteMinistry] || [];
    if (!currentMList.includes(trimmed)) {
      const updatedAssignments = {
        ...sunday.assignments,
        [substituteMinistry]: [...currentMList, trimmed]
      };

      // Also set attendance to present
      const key = `${substituteMinistry}_${trimmed}`;
      const updatedRecords: Record<string, ServiceAttendanceRecord> = {
        ...currentAttendance,
        [key]: {
          personName: trimmed,
          ministryId: substituteMinistry,
          status: 'present',
          checkInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      };

      onUpdateSunday({
        ...sunday,
        assignments: updatedAssignments,
        attendanceRecords: updatedRecords
      });

      showToast(
        currentLanguage === 'sl'
          ? `✓ Nadomestni sodelavec ${trimmed} dodan in označen kot prisoten!`
          : `✓ Substitute ${trimmed} added and checked in!`
      );
    }

    setSubstitutePerson('');
    setShowAddSubstitute(false);
  };

  // Copy Attendance Summary to Clipboard
  const handleCopySummary = () => {
    const totalAdults = headcount.adults || 0;
    const totalKids = headcount.children || 0;
    const totalVisitors = headcount.visitors || 0;
    const totalAttendance = totalAdults + totalKids + totalVisitors;

    const totalServants = assignedList.length;
    const checkedInCount = assignedList.filter(({ personName, ministryId }) => {
      const rec = currentAttendance[`${ministryId}_${personName}`];
      return rec?.status === 'present' || rec?.status === 'late';
    }).length;

    const text = `⛪ *KC Kalvarija - Poročilo o prisotnosti (${sunday.date})*
----------------------------------------
👥 **Udeležba na bogoslužju:**
• Odrasli: ${totalAdults}
• Otroci: ${totalKids}
• Obiskovalci: ${totalVisitors}
👉 **SKUPAJ:** ${totalAttendance} ljudi

🤝 **Prisotnost sodelavcev:**
• ${checkedInCount} / ${totalServants} prisotnih sodelavcev (${Math.round((checkedInCount / (totalServants || 1)) * 100)}%)

Tema: ${sunday.themeSl || 'Nedeljsko bogoslužje'}`;

    navigator.clipboard.writeText(text);
    showToast(currentLanguage === 'sl' ? '📋 Poročilo kopirano v odložišče!' : '📋 Summary copied to clipboard!');
  };

  // Calculate statistics
  const totalAssigned = assignedList.length;
  const presentCount = assignedList.filter(({ personName, ministryId }) => {
    const rec = currentAttendance[`${ministryId}_${personName}`];
    return rec?.status === 'present' || rec?.status === 'late';
  }).length;
  const percentage = Math.round((presentCount / (totalAssigned || 1)) * 100);

  // Filter list
  const filteredList = assignedList.filter(({ personName, ministryId }) => {
    const matchesSearch = personName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMinistry = filterMinistry === 'all' || ministryId === filterMinistry;
    return matchesSearch && matchesMinistry;
  });

  const totalHeadcount = (headcount.adults || 0) + (headcount.children || 0) + (headcount.visitors || 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-150 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <UserCheck className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-semibold text-gray-900 text-base sm:text-lg">
                  {currentLanguage === 'sl' ? 'Prisotnost in števec obiska' : 'Live Sunday Attendance Check-in'}
                </h2>

                {/* Sunday Selector */}
                {allSundays.length > 0 && onSelectSundayId && (
                  <select
                    value={sunday.id}
                    onChange={(e) => onSelectSundayId(e.target.value)}
                    className="text-xs font-mono font-bold bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-lg px-2 py-0.5 focus:outline-none cursor-pointer"
                  >
                    {allSundays.map((s) => (
                      <option key={s.id} value={s.id}>
                        {formatToEuropeanDate(s.date)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <p className="text-xs text-gray-500 font-sans mt-0.5">
                {currentLanguage === 'sl'
                  ? `Preverjanje prisotnosti sodelavcev in obiskovalcev za nedeljo ${formatToEuropeanDate(sunday.date)}`
                  : `Real-time check-in and congregation counter for ${formatToEuropeanDate(sunday.date)}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast Notification */}
        {toastMsg && (
          <div className="bg-emerald-600 text-white text-xs px-4 py-2 flex items-center justify-between font-medium animate-fade-in shadow-xs">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
              <span>{toastMsg}</span>
            </span>
            <button onClick={() => setToastMsg(null)} className="text-emerald-200 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Top Summary Banner & Quick Actions */}
        <div className="p-4 bg-emerald-50/60 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 font-mono block">
                {currentLanguage === 'sl' ? 'Prisotnost sodelavcev' : 'Volunteer Check-in'}
              </span>
              <div className="text-sm font-bold text-emerald-950 font-display flex items-center gap-1.5">
                <span>{presentCount} / {totalAssigned}</span>
                <span className="text-xs text-emerald-700 font-normal">({percentage}%)</span>
              </div>
            </div>

            <div className="h-7 w-px bg-emerald-200"></div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 font-mono block">
                {currentLanguage === 'sl' ? 'Skupno na bogoslužju' : 'Congregation Count'}
              </span>
              <div className="text-sm font-bold text-emerald-950 font-display">
                {totalHeadcount} <span className="text-xs text-emerald-700 font-normal">{currentLanguage === 'sl' ? 'ljudi' : 'people'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllPresent}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-2xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{currentLanguage === 'sl' ? 'Označi vse prisotne' : 'Mark All Present'}</span>
            </button>

            <button
              onClick={handleCopySummary}
              className="px-2.5 py-1.5 bg-white hover:bg-gray-50 text-gray-800 border border-emerald-300 text-xs font-semibold rounded-xl transition active:scale-95 flex items-center gap-1 cursor-pointer"
              title={currentLanguage === 'sl' ? 'Kopiraj poročilo v odložišče' : 'Copy summary'}
            >
              <Copy className="w-3.5 h-3.5 text-emerald-700" />
              <span className="hidden sm:inline">{currentLanguage === 'sl' ? 'Poročilo' : 'Report'}</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-6">
          
          {/* SECTION 1: CONGREGATION HEADCOUNT COUNTERS */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-xs text-gray-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>{currentLanguage === 'sl' ? 'Števec udeležbe na bogoslužju' : 'Congregation Headcount'}</span>
              </h3>
              <span className="text-[11px] font-mono text-gray-500 font-medium">
                {currentLanguage === 'sl' ? 'Skupaj:' : 'Total:'} <strong className="text-gray-900">{totalHeadcount}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Adults Counter */}
              <div className="bg-white border border-gray-200 rounded-lg p-3 text-center space-y-1.5 shadow-2xs">
                <span className="text-xs font-semibold text-gray-700 block">
                  {currentLanguage === 'sl' ? 'Odrasli' : 'Adults'}
                </span>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => handleAdjustHeadcount('adults', -1)}
                    className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center font-bold transition active:scale-90 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-display font-bold text-lg text-gray-900 min-w-[2rem]">
                    {headcount.adults || 0}
                  </span>
                  <button
                    onClick={() => handleAdjustHeadcount('adults', 1)}
                    className="w-7 h-7 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 flex items-center justify-center font-bold transition active:scale-90 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Children Counter */}
              <div className="bg-white border border-gray-200 rounded-lg p-3 text-center space-y-1.5 shadow-2xs">
                <span className="text-xs font-semibold text-gray-700 block">
                  {currentLanguage === 'sl' ? 'Otroci (Nedeljska šola)' : 'Children'}
                </span>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => handleAdjustHeadcount('children', -1)}
                    className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center font-bold transition active:scale-90 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-display font-bold text-lg text-gray-900 min-w-[2rem]">
                    {headcount.children || 0}
                  </span>
                  <button
                    onClick={() => handleAdjustHeadcount('children', 1)}
                    className="w-7 h-7 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 flex items-center justify-center font-bold transition active:scale-90 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Visitors / First Time Guests Counter */}
              <div className="bg-white border border-gray-200 rounded-lg p-3 text-center space-y-1.5 shadow-2xs">
                <span className="text-xs font-semibold text-gray-700 block">
                  {currentLanguage === 'sl' ? 'Obiskovalci / Novi' : 'First-time Guests'}
                </span>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => handleAdjustHeadcount('visitors', -1)}
                    className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center font-bold transition active:scale-90 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-display font-bold text-lg text-emerald-700 min-w-[2rem]">
                    {headcount.visitors || 0}
                  </span>
                  <button
                    onClick={() => handleAdjustHeadcount('visitors', 1)}
                    className="w-7 h-7 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 flex items-center justify-center font-bold transition active:scale-90 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: VOLUNTEER ATTENDANCE LIVE CHECK-IN */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="font-display font-semibold text-xs text-gray-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>{currentLanguage === 'sl' ? 'Prisotnost razporejenih sodelavcev' : 'Servants Attendance Roster'}</span>
              </h3>

              <button
                onClick={() => setShowAddSubstitute(!showAddSubstitute)}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{currentLanguage === 'sl' ? '+ Dodaj zamenjavo / hodnika' : '+ Add Substitute Volunteer'}</span>
              </button>
            </div>

            {/* Walk-in Substitute Form */}
            {showAddSubstitute && (
              <form
                onSubmit={handleAddSubstitute}
                className="bg-emerald-50/70 border border-emerald-200 p-3 rounded-xl flex flex-wrap items-center gap-2 animate-fade-in"
              >
                <input
                  type="text"
                  placeholder={currentLanguage === 'sl' ? 'Ime nadomestnega sodelavca...' : 'Substitute person name...'}
                  value={substitutePerson}
                  onChange={(e) => setSubstitutePerson(e.target.value)}
                  className="text-xs p-2 bg-white border border-emerald-300 rounded-lg focus:outline-none flex-1 min-w-[140px]"
                />

                <select
                  value={substituteMinistry}
                  onChange={(e) => setSubstituteMinistry(e.target.value)}
                  className="text-xs p-2 bg-white border border-emerald-300 rounded-lg focus:outline-none"
                >
                  {ministries.map((m) => (
                    <option key={m.id} value={m.id}>
                      {currentLanguage === 'sl' ? m.nameSl : m.nameEn}
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  {currentLanguage === 'sl' ? 'Dodaj & Označi Prisoten' : 'Add & Check In'}
                </button>
              </form>
            )}

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder={currentLanguage === 'sl' ? 'Išči sodelavca...' : 'Search volunteer...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <select
                value={filterMinistry}
                onChange={(e) => setFilterMinistry(e.target.value)}
                className="text-xs p-2 border border-gray-300 rounded-lg bg-white focus:outline-none"
              >
                <option value="all">{currentLanguage === 'sl' ? 'Vse službe' : 'All Ministries'}</option>
                {ministries.map((m) => (
                  <option key={m.id} value={m.id}>
                    {currentLanguage === 'sl' ? m.nameSl : m.nameEn}
                  </option>
                ))}
              </select>
            </div>

            {/* Volunteers List */}
            {filteredList.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-xs text-gray-500">
                {currentLanguage === 'sl' ? 'Ni najdenih razporejenih sodelavcev.' : 'No scheduled volunteers found.'}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredList.map(({ personName, ministryId, ministryName }) => {
                  const key = `${ministryId}_${personName}`;
                  const rec = currentAttendance[key];
                  const currentStatus = rec?.status || 'pending';

                  return (
                    <div
                      key={key}
                      className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-emerald-200 transition shadow-2xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 text-xs sm:text-sm">
                            {personName}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full font-mono font-semibold">
                            {ministryName}
                          </span>
                        </div>
                        {rec?.checkInTime && (
                          <div className="text-[10px] text-emerald-700 font-mono mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{currentLanguage === 'sl' ? `Prihod ob ${rec.checkInTime}` : `Checked in at ${rec.checkInTime}`}</span>
                          </div>
                        )}
                      </div>

                      {/* Check-in Buttons */}
                      <div className="flex items-center gap-1">
                        {/* Present */}
                        <button
                          onClick={() => handleSetCheckInStatus(personName, ministryId, 'present')}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95 cursor-pointer flex items-center gap-1 ${
                            currentStatus === 'present'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-800'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{currentLanguage === 'sl' ? 'Prisoten' : 'Present'}</span>
                        </button>

                        {/* Late */}
                        <button
                          onClick={() => handleSetCheckInStatus(personName, ministryId, 'late')}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95 cursor-pointer flex items-center gap-1 ${
                            currentStatus === 'late'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-gray-100 text-gray-600 hover:bg-amber-50 hover:text-amber-800'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>{currentLanguage === 'sl' ? 'Zamudil' : 'Late'}</span>
                        </button>

                        {/* Absent */}
                        <button
                          onClick={() => handleSetCheckInStatus(personName, ministryId, 'absent')}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95 cursor-pointer flex items-center gap-1 ${
                            currentStatus === 'absent'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-gray-100 text-gray-600 hover:bg-rose-50 hover:text-rose-800'
                          }`}
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>{currentLanguage === 'sl' ? 'Odsoten' : 'Absent'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[10px] text-gray-500 font-mono">
            {currentLanguage === 'sl' ? 'KC Kalvarija • Evidenca prisotnosti v živo' : 'KC Kalvarija • Live Attendance Log'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            {currentLanguage === 'sl' ? 'Zapri' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
}

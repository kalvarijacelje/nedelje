import React, { useState } from 'react';
import { BlackoutDate, Person, Language } from '../types';
import { useBackdropHistory } from '../hooks/useBackdropHistory';
import {
  Palmtree,
  X,
  PlusCircle,
  Calendar,
  Trash2,
  User,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock
} from 'lucide-react';

interface BlackoutPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  blackoutDates: BlackoutDate[];
  people: Person[];
  activePerson: Person | null;
  currentLanguage: Language;
  onAddBlackoutDate: (b: Omit<BlackoutDate, 'id' | 'createdAt'>) => void;
  onDeleteBlackoutDate: (id: string) => void;
}

export default function BlackoutPlannerModal({
  isOpen,
  onClose,
  blackoutDates,
  people,
  activePerson,
  currentLanguage,
  onAddBlackoutDate,
  onDeleteBlackoutDate
}: BlackoutPlannerModalProps) {
  const [personName, setPersonName] = useState<string>(activePerson?.name || ((people || []).find(p => p && p.name)?.name || ''));
  const [selectedFamilyNames, setSelectedFamilyNames] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useBackdropHistory(isOpen, onClose, 'blackout-planner-modal');

  if (!isOpen) return null;

  // Resolve linked family members for the currently selected person
  const selectedPersonObj = (people || []).find(p => p && p.name === personName);
  const familyMembers = (people || []).filter(p => {
    if (!p || !p.name || p.name === personName) return false;
    if (!selectedPersonObj) return false;

    const inSelectedFamily = Array.isArray(selectedPersonObj.familyMembers) && (
      selectedPersonObj.familyMembers.includes(p.name) ||
      selectedPersonObj.familyMembers.includes(p.id)
    );

    const inMemberFamily = Array.isArray(p.familyMembers) && (
      p.familyMembers.includes(selectedPersonObj.name) ||
      p.familyMembers.includes(selectedPersonObj.id)
    );

    return inSelectedFamily || inMemberFamily;
  });

  const toggleFamilyMember = (name: string) => {
    setSelectedFamilyNames(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName || !startDate) {
      showToast(
        currentLanguage === 'sl'
          ? 'Prosimo vnesite osebo in začetni datum odsotnosti.'
          : 'Please enter person and start date of absence.'
      );
      return;
    }

    const allPeopleToLog = [personName, ...selectedFamilyNames.filter(n => n !== personName)];

    allPeopleToLog.forEach(targetName => {
      onAddBlackoutDate({
        personName: targetName,
        startDate,
        endDate: endDate || startDate,
        reason: reason.trim() || undefined
      });
    });

    setStartDate('');
    setEndDate('');
    setReason('');
    setSelectedFamilyNames([]);
    setShowAddForm(false);

    showToast(
      currentLanguage === 'sl'
        ? `✓ Odsotnost/dopust zabeležen za ${allPeopleToLog.join(', ')}!`
        : `✓ Vacation blackout logged for ${allPeopleToLog.join(', ')}!`
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-150 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Palmtree className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-gray-900 text-base sm:text-lg flex items-center gap-2">
                <span>{currentLanguage === 'sl' ? 'Načrtovalec odsotnosti in dopustov' : 'Blackout Dates & Vacation Planner'}</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-teal-100 text-teal-900 rounded-full border border-teal-200">
                  {blackoutDates.length} {currentLanguage === 'sl' ? 'zapisov' : 'records'}
                </span>
              </h2>
              <p className="text-xs text-gray-500 font-sans mt-0.5">
                {currentLanguage === 'sl'
                  ? 'Vnesite datume dopusta, da vas vodje na te nedelje ne razporedijo.'
                  : 'Log planned vacations so leaders avoid scheduling you on absent dates.'}
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
          <div className="bg-teal-700 text-white text-xs px-4 py-2 flex items-center justify-between font-medium animate-fade-in shadow-xs">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
              <span>{toastMsg}</span>
            </span>
            <button onClick={() => setToastMsg(null)} className="text-teal-200 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Action Header Banner */}
        <div className="p-4 bg-teal-50/70 border-b border-teal-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-teal-950">
            <span className="font-semibold block">
              {currentLanguage === 'sl' ? 'Načrtujete dopust ali službeno pot?' : 'Planning a holiday or weekend away?'}
            </span>
            <span className="text-[11px] text-teal-800/90 font-sans">
              {currentLanguage === 'sl'
                ? 'Označite svoje nerazpoložljive vikende vnaprej za nemoteno načrtovanje.'
                : 'Mark your unavailable weekends in advance for smooth scheduling.'}
            </span>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{currentLanguage === 'sl' ? 'Zabeleži odsotnost' : 'Log Absence / Vacation'}</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5">
          {/* Add Blackout Date Form */}
          {showAddForm && (
            <form
              onSubmit={handleAdd}
              className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 animate-fade-in"
            >
              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                <h3 className="font-display font-semibold text-xs text-gray-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Palmtree className="w-3.5 h-3.5 text-teal-600" />
                  <span>{currentLanguage === 'sl' ? 'Nova zabeležka odsotnosti' : 'New Vacation / Blackout Entry'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-gray-400 hover:text-gray-600 text-xs"
                >
                  {currentLanguage === 'sl' ? 'Prekliči' : 'Cancel'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Person Selection */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    {currentLanguage === 'sl' ? 'Oseba:' : 'Person:'}
                  </label>
                  <select
                    value={personName}
                    onChange={(e) => {
                      setPersonName(e.target.value);
                      setSelectedFamilyNames([]);
                    }}
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-medium"
                  >
                    {(people || []).filter(p => p && p.name).map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    {currentLanguage === 'sl' ? 'Razlog (izbirno):' : 'Reason (optional):'}
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={
                      currentLanguage === 'sl'
                        ? 'Npr. Letni dopust / Potovanje...'
                        : 'e.g. Summer holiday...'
                    }
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
                  />
                </div>

                {/* Quick Family Member Selector */}
                {familyMembers.length > 0 && (
                  <div className="sm:col-span-2 pt-1 pb-1">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      {currentLanguage === 'sl' ? 'Vključi družinske člane na isti dopust:' : 'Include family members in the same vacation:'}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {familyMembers.map(member => (
                        <button
                          key={member.id || member.name}
                          type="button"
                          onClick={() => toggleFamilyMember(member.name)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer flex items-center gap-1 ${
                            selectedFamilyNames.includes(member.name)
                              ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
                              : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                          }`}
                        >
                          <span>{selectedFamilyNames.includes(member.name) ? '✓ ' : '+ '}</span>
                          <span>{member.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Start Date */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    {currentLanguage === 'sl' ? 'Začetek odsotnosti:' : 'Start Date:'}
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-mono"
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    {currentLanguage === 'sl' ? 'Konec odsotnosti:' : 'End Date:'}
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg shadow-2xs transition cursor-pointer"
                >
                  {currentLanguage === 'sl' ? 'Shrani odsotnost' : 'Save Absence'}
                </button>
              </div>
            </form>
          )}

          {/* List of Logged Absences */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 font-mono">
              {currentLanguage === 'sl' ? 'Zabeleženi dopusti in odsotnosti' : 'Logged Vacation & Blackout Dates'}
            </h3>

            {blackoutDates.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200 space-y-1.5">
                <CheckCircle2 className="w-7 h-7 text-teal-500 mx-auto" />
                <p className="text-xs font-semibold text-gray-700">
                  {currentLanguage === 'sl' ? 'Trenutno ni zabeleženih odsotnosti.' : 'No vacation blackout dates recorded.'}
                </p>
                <p className="text-[11px] text-gray-400">
                  {currentLanguage === 'sl'
                    ? 'Vsi sodelavci so označeni kot razpoložljivi za služenje.'
                    : 'All volunteers are marked as available for service.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {blackoutDates.map((b) => (
                  <div
                    key={b.id}
                    className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs flex items-center justify-between gap-3 hover:border-teal-200 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center shrink-0">
                        <Palmtree className="w-4 h-4" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 text-xs">
                            {b.personName}
                          </span>
                          {b.reason && (
                            <span className="text-[10px] px-2 py-0.2 bg-slate-100 text-slate-700 rounded-md font-sans">
                              {b.reason}
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-teal-800 font-mono font-medium mt-0.5 flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-teal-600" />
                          <span>
                            {b.startDate} {b.endDate && b.endDate !== b.startDate ? `➔ ${b.endDate}` : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onDeleteBlackoutDate(b.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title={currentLanguage === 'sl' ? 'Izbriši zabeležko' : 'Delete record'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[10px] text-gray-500 font-mono">
            {currentLanguage === 'sl' ? 'Opozorila pred razporeditvijo delujejo samodejno' : 'Pre-scheduling availability checks active'}
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

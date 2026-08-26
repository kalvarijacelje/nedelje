import React, { useState } from 'react';
import { ShiftSwapRequest, ServiceSunday, Ministry, Person, Language, UserRole, canAccessPersonalData, getPrivacyDisplayName } from '../types';
import { useBackdropHistory } from '../hooks/useBackdropHistory';
import {
  ArrowRightLeft,
  X,
  Check,
  PlusCircle,
  AlertCircle,
  Calendar,
  UserCheck,
  Sparkles,
  MessageSquare,
  Clock,
  Send,
  Trash2
} from 'lucide-react';

interface SwapBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  swapRequests: ShiftSwapRequest[];
  sundays: ServiceSunday[];
  ministries: Ministry[];
  people: Person[];
  activePerson: Person | null;
  currentLanguage: Language;
  onCreateSwapRequest: (req: Omit<ShiftSwapRequest, 'id' | 'createdAt' | 'status'>) => void;
  onAcceptSwapRequest: (requestId: string, acceptingPersonName: string) => void;
  onCancelSwapRequest: (requestId: string) => void;
  userRole?: UserRole;
}

export default function SwapBoardModal({
  isOpen,
  onClose,
  swapRequests,
  sundays,
  ministries,
  people,
  activePerson,
  currentLanguage,
  onCreateSwapRequest,
  onAcceptSwapRequest,
  onCancelSwapRequest,
  userRole
}: SwapBoardModalProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedSundayId, setSelectedSundayId] = useState<string>('');
  const [selectedMinistryId, setSelectedMinistryId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useBackdropHistory(isOpen, onClose, 'swap-board-modal');

  if (!isOpen) return null;

  const currentPersonName = activePerson?.name || 'Aleš Lajlar';
  const isViewer = userRole === 'Viewer' || !canAccessPersonalData(userRole);

  // Find assigned duties for active user to easily pick one for swap
  const myAssignedDuties: { sunday: ServiceSunday; ministry: Ministry }[] = [];
  sundays.forEach((sunday) => {
    Object.entries(sunday.assignments).forEach(([mId, names]) => {
      if (Array.isArray(names) && names.includes(currentPersonName)) {
        const m = ministries.find((item) => item.id === mId);
        if (m) {
          myAssignedDuties.push({ sunday, ministry: m });
        }
      }
    });
  });

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handlePostSwap = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSundayId || !selectedMinistryId) {
      showToast(
        currentLanguage === 'sl'
          ? 'Prosimo izberite nedeljo in službo.'
          : 'Please select a Sunday and ministry.'
      );
      return;
    }

    const sunday = sundays.find((s) => s.id === selectedSundayId);
    const ministry = ministries.find((m) => m.id === selectedMinistryId);

    if (!sunday || !ministry) return;

    onCreateSwapRequest({
      requesterName: currentPersonName,
      sundayId: sunday.id,
      sundayDate: sunday.date,
      ministryId: ministry.id,
      ministryName: currentLanguage === 'sl' ? ministry.nameSl : ministry.nameEn,
      reason: reason.trim() || undefined
    });

    setShowCreateForm(false);
    setSelectedSundayId('');
    setSelectedMinistryId('');
    setReason('');
    showToast(
      currentLanguage === 'sl'
        ? '✓ Prošnja za zamenjavo je objavljena na oglasni deski!'
        : '✓ Swap request posted to the board!'
    );
  };

  const handleAccept = (req: ShiftSwapRequest) => {
    onAcceptSwapRequest(req.id, currentPersonName);
    showToast(
      currentLanguage === 'sl'
        ? `🎉 Hvala! Prevzeli ste službo (${req.ministryName}) za nedeljo ${req.sundayDate}.`
        : `🎉 Thank you! You took over duty (${req.ministryName}) for ${req.sundayDate}.`
    );
  };

  const openRequests = swapRequests.filter((r) => r.status === 'open');
  const pastRequests = swapRequests.filter((r) => r.status !== 'open');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-150 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-gray-900 text-base sm:text-lg flex items-center gap-2">
                <span>{currentLanguage === 'sl' ? 'Oglasna deska za zamenjave' : 'Peer-to-Peer Shift Swap Board'}</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full border border-amber-200">
                  {openRequests.length} {currentLanguage === 'sl' ? 'odprtih' : 'open'}
                </span>
              </h2>
              <p className="text-xs text-gray-500 font-sans mt-0.5">
                {currentLanguage === 'sl'
                  ? 'Neposredna medsebojna zamenjava nedeljskih služb med sodelavci.'
                  : 'Direct volunteer-to-volunteer shift swapping & duty takeover.'}
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

        {/* Action Header Banner */}
        <div className="p-4 bg-amber-50/60 border-b border-amber-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-amber-900">
            <span className="font-semibold block">
              {currentLanguage === 'sl' ? 'Potrebujete zamenjavo za nedeljsko službo?' : 'Need coverage for your Sunday duty?'}
            </span>
            <span className="text-[11px] text-amber-800/80 font-sans">
              {currentLanguage === 'sl'
                ? 'Objavite prošnjo. Ko drug sodelavec klikne "Prevzemi", se razpored samodejno posodobi.'
                : 'Post a request. When a fellow volunteer clicks "Accept", the roster updates automatically.'}
            </span>
          </div>

          {!isViewer && (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{currentLanguage === 'sl' ? 'Objavi prošnjo za zamenjavo' : 'Post Swap Request'}</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5">
          {/* Create Request Form */}
          {showCreateForm && (
            <form
              onSubmit={handlePostSwap}
              className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 animate-fade-in"
            >
              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                <h3 className="font-display font-semibold text-xs text-gray-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600" />
                  <span>{currentLanguage === 'sl' ? 'Nova prošnja za zamenjavo' : 'New Swap Request'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="text-gray-400 hover:text-gray-600 text-xs"
                >
                  {currentLanguage === 'sl' ? 'Prekliči' : 'Cancel'}
                </button>
              </div>

              {/* Quick Pick from User's Assigned Duties */}
              {myAssignedDuties.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-gray-700">
                    {currentLanguage === 'sl' ? 'Izberite iz vaših dodeljenih služb:' : 'Select from your scheduled duties:'}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {myAssignedDuties.map(({ sunday, ministry }) => {
                      const mName = currentLanguage === 'sl' ? ministry.nameSl : ministry.nameEn;
                      const isSelected = selectedSundayId === sunday.id && selectedMinistryId === ministry.id;

                      return (
                        <button
                          key={`${sunday.id}-${ministry.id}`}
                          type="button"
                          onClick={() => {
                            setSelectedSundayId(sunday.id);
                            setSelectedMinistryId(ministry.id);
                          }}
                          className={`p-2.5 rounded-lg border text-left transition cursor-pointer text-xs ${
                            isSelected
                              ? 'bg-amber-100 border-amber-400 text-amber-950 font-semibold shadow-2xs'
                              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <div className="font-semibold">{sunday.date}</div>
                          <div className="text-[11px] text-amber-800 mt-0.5">{mName}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Custom Reason Input */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  {currentLanguage === 'sl' ? 'Razlog / Opomba (izbirno):' : 'Reason / Note (optional):'}
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    currentLanguage === 'sl'
                      ? 'Npr. Odpotujem na službeno pot / Bolan...'
                      : 'e.g. Out of town for family event...'
                  }
                  className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{currentLanguage === 'sl' ? 'Objavi na desko' : 'Post to Board'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Active Open Swap Requests List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 font-mono">
              {currentLanguage === 'sl' ? 'Odprte prošnje za zamenjavo' : 'Open Swap Requests'}
            </h3>

            {openRequests.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200 space-y-1.5">
                <UserCheck className="w-7 h-7 text-emerald-500 mx-auto" />
                <p className="text-xs font-semibold text-gray-700">
                  {currentLanguage === 'sl' ? 'Trenutno ni odprtih prošenj za zamenjavo.' : 'No active swap requests.'}
                </p>
                <p className="text-[11px] text-gray-400">
                  {currentLanguage === 'sl'
                    ? 'Vsi nedeljski razporedi so pokriti in brez konfliktov.'
                    : 'All Sunday rosters are covered and conflict-free.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {openRequests.map((req) => {
                  const isOwnRequest = req.requesterName === currentPersonName;

                  return (
                    <div
                      key={req.id}
                      className="bg-white border border-amber-200 rounded-xl p-4 shadow-2xs space-y-3 hover:border-amber-300 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-display font-semibold text-sm text-gray-900">
                              {req.sundayDate}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full font-mono border border-amber-200">
                              {req.ministryName}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 flex items-center gap-1.5">
                            <span>{currentLanguage === 'sl' ? 'Išče zamenjavo:' : 'Requested by:'}</span>
                            <strong className="text-gray-900 font-semibold">{getPrivacyDisplayName(req.requesterName, userRole, currentPersonName, undefined, undefined, people)}</strong>
                          </p>
                        </div>

                        <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{req.createdAt}</span>
                        </div>
                      </div>

                      {req.reason && (
                        <div className="text-xs bg-amber-50/70 p-2.5 rounded-lg text-amber-900 border border-amber-100/80 flex items-start gap-2">
                          <MessageSquare className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                          <span>"{req.reason}"</span>
                        </div>
                      )}

                      {/* Swap Actions */}
                      <div className="flex items-center justify-between pt-1">
                        {isOwnRequest ? (
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[11px] text-amber-800 font-medium">
                              {currentLanguage === 'sl' ? 'Vaša objavljena prošnja' : 'Your posted request'}
                            </span>
                            <button
                              onClick={() => onCancelSwapRequest(req.id)}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg transition active:scale-95 flex items-center gap-1 cursor-pointer border border-rose-200"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>{currentLanguage === 'sl' ? 'Umakni prošnjo' : 'Cancel Request'}</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[11px] text-gray-500">
                              {currentLanguage === 'sl'
                                ? 'Lahko pomagate in prevzamete službo?'
                                : 'Can you step in and cover this shift?'}
                            </span>
                            {isViewer ? (
                              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200 flex items-center gap-1">
                                <Lock className="w-3 h-3 text-slate-400" />
                                <span>{currentLanguage === 'sl' ? 'Prevzem dostopen sodelavcem' : 'Restricted to team members'}</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => handleAccept(req)}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{currentLanguage === 'sl' ? 'Prevzemi službo' : 'Accept & Take Over'}</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Past Resolved Swaps */}
          {pastRequests.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-gray-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 font-mono">
                {currentLanguage === 'sl' ? 'Zaključene zamenjave' : 'Resolved Swaps'}
              </h3>
              <div className="space-y-2">
                {pastRequests.slice(0, 5).map((req) => (
                  <div
                    key={req.id}
                    className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs flex items-center justify-between text-gray-600"
                  >
                    <div>
                      <span className="font-semibold text-gray-900">{req.sundayDate}</span> ({req.ministryName}):{' '}
                      <span>{req.requesterName}</span> ➔{' '}
                      <strong className="text-emerald-700">{req.acceptedByName || 'Zamenjano'}</strong>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold">
                      {currentLanguage === 'sl' ? 'Prevzeto' : 'Resolved'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[10px] text-gray-500 font-mono">
            {currentLanguage === 'sl' ? 'Samodejna posodobitev razporeda po prevzemu' : 'Auto-updates Sunday roster upon acceptance'}
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

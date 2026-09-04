import React, { useState } from 'react';
import { 
  ShiftSwapRequest, 
  ServiceSunday, 
  Ministry, 
  Person, 
  Language, 
  UserRole, 
  BlackoutDate,
  canAccessPersonalData, 
  getPrivacyDisplayName 
} from '../types';
import { useBackdropHistory } from '../hooks/useBackdropHistory';
import { formatToEuropeanDate, formatEuropeanDateTime, parseEuropeanDate } from '../utils/dateUtils';
import { generateConfirmationToken, sendDirectSwapNotification } from '../services/notificationService';
import { checkPersonAbsenceOnSunday, getMinistryIconEmoji } from './SundayDetail';
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
  Trash2,
  Users,
  User,
  Mail,
  Star,
  Lock,
  Share2,
  CheckCircle2,
  HelpCircle,
  ChevronRight,
  Copy,
  ExternalLink
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
  onCreateSwapRequest: (req: Omit<ShiftSwapRequest, 'id' | 'createdAt'>) => void;
  onAcceptSwapRequest: (requestId: string, acceptingPersonName: string) => void;
  onDeclineSwapRequest?: (requestId: string, declineReason?: string) => void;
  onConvertToOpenSwapRequest?: (requestId: string) => void;
  onCancelSwapRequest: (requestId: string) => void;
  blackoutDates?: BlackoutDate[];
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
  onDeclineSwapRequest,
  onConvertToOpenSwapRequest,
  onCancelSwapRequest,
  blackoutDates = [],
  userRole
}: SwapBoardModalProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedSundayId, setSelectedSundayId] = useState<string>('');
  const [selectedMinistryId, setSelectedMinistryId] = useState<string>('');
  const [swapType, setSwapType] = useState<'direct' | 'open'>('direct');
  const [selectedTargetPersonName, setSelectedTargetPersonName] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  useBackdropHistory(isOpen, onClose, 'swap-board-modal');

  if (!isOpen) return null;

  const currentPersonName = activePerson?.name || 'Aleš Lajlar';
  const isViewer = userRole === 'Viewer' || !canAccessPersonalData(userRole);

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  // Find assigned duties for active user to easily pick one for swap (ONLY today or upcoming dates!)
  const myAssignedDuties: { sunday: ServiceSunday; ministry: Ministry; dateObj: Date }[] = [];
  sundays.forEach((sunday) => {
    const sDate = parseEuropeanDate(sunday.date);
    if (!sDate) return;
    const sTime = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate()).getTime();
    if (sTime < todayMidnight) return; // Ignore expired / past Sundays!

    Object.entries(sunday.assignments).forEach(([mId, names]) => {
      if (Array.isArray(names) && names.includes(currentPersonName)) {
        const m = ministries.find((item) => item.id === mId);
        if (m) {
          myAssignedDuties.push({ sunday, ministry: m, dateObj: sDate });
        }
      }
    });
  });

  // Sort upcoming duties chronologically (closest Sunday first)
  myAssignedDuties.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 5000);
  };

  // Selected duty details for smart candidate filtering
  const selectedSunday = sundays.find(s => s.id === selectedSundayId);
  const selectedMinistry = ministries.find(m => m.id === selectedMinistryId);

  // Compute smart qualified candidates for direct swap
  interface CandidateVolunteer {
    person: Person;
    isTeamMember: boolean;
    isAbsent: boolean;
    absenceReason?: string;
    isAlreadyAssigned: boolean;
    hasEmail: boolean;
  }

  const qualifiedCandidates: CandidateVolunteer[] = [];

  if (selectedSunday && selectedMinistry) {
    const minId = selectedMinistry.id;
    const minNameSl = (selectedMinistry.nameSl || '').toLowerCase().trim();
    const minNameEn = (selectedMinistry.nameEn || '').toLowerCase().trim();
    const currentDutyAssignees = selectedSunday.assignments[minId] || [];

    people.forEach(p => {
      if (!p || !p.name || p.isArchived || p.isVisitor || p.role === 'Visitor' || p.memberType === 'visitor') return;
      if (p.name.toLowerCase().trim() === currentPersonName.toLowerCase().trim()) return;

      const pPrefs = (p.preferredMinistries || []).map(x => (x || '').toLowerCase().trim());
      const pLeds = (p.ledMinistries || []).map(x => (x || '').toLowerCase().trim());
      
      const isTeamMember = 
        pPrefs.includes(minId.toLowerCase()) ||
        pPrefs.includes(minNameSl) ||
        pPrefs.includes(minNameEn) ||
        pLeds.includes(minId.toLowerCase()) ||
        (selectedMinistry.leader && selectedMinistry.leader.toLowerCase().trim() === p.name.toLowerCase().trim()) ||
        (selectedMinistry.defaultLeader && selectedMinistry.defaultLeader.toLowerCase().trim() === p.name.toLowerCase().trim());

      const absenceCheck = checkPersonAbsenceOnSunday(p.name, selectedSunday.date, blackoutDates);
      const isAlreadyAssigned = currentDutyAssignees.includes(p.name);
      const hasEmail = Boolean(p.email && p.email.includes('@'));

      qualifiedCandidates.push({
        person: p,
        isTeamMember,
        isAbsent: absenceCheck.isAbsent,
        absenceReason: absenceCheck.reason,
        isAlreadyAssigned,
        hasEmail,
      });
    });

    // Sort: Team members first, then available volunteers, absent at the bottom
    qualifiedCandidates.sort((a, b) => {
      if (a.isAbsent !== b.isAbsent) return a.isAbsent ? 1 : -1;
      if (a.isTeamMember !== b.isTeamMember) return a.isTeamMember ? -1 : 1;
      return a.person.name.localeCompare(b.person.name);
    });
  }

  const teamMembers = qualifiedCandidates.filter(c => c.isTeamMember && !c.isAbsent);
  const otherVolunteers = qualifiedCandidates.filter(c => !c.isTeamMember && !c.isAbsent);
  const absentVolunteers = qualifiedCandidates.filter(c => c.isAbsent);

  const handlePostSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSundayId || !selectedMinistryId) {
      showToast(
        currentLanguage === 'sl'
          ? 'Prosimo, izberite nedeljo in službo, ki jo želite zamenjati.'
          : 'Please select a Sunday and ministry to swap.'
      );
      return;
    }

    const sunday = selectedSunday;
    const ministry = selectedMinistry;

    if (!sunday || !ministry) return;

    if (swapType === 'direct') {
      if (!selectedTargetPersonName) {
        showToast(
          currentLanguage === 'sl'
            ? 'Prosimo, izberite sodelavca, ki ga želite prositi za zamenjavo.'
            : 'Please select a teammate to request a swap from.'
        );
        return;
      }

      const targetCandidate = qualifiedCandidates.find(c => c.person.name === selectedTargetPersonName);
      const targetPerson = targetCandidate?.person || people.find(p => p.name === selectedTargetPersonName);
      const token = generateConfirmationToken(sunday.id, ministry.id, targetPerson?.name || selectedTargetPersonName);

      setIsSending(true);

      onCreateSwapRequest({
        requesterName: currentPersonName,
        requesterEmail: activePerson?.email,
        sundayId: sunday.id,
        sundayDate: sunday.date,
        ministryId: ministry.id,
        ministryName: currentLanguage === 'sl' ? ministry.nameSl : ministry.nameEn,
        reason: reason.trim() || undefined,
        status: 'pending_direct',
        swapType: 'direct',
        targetPersonName: targetPerson?.name || selectedTargetPersonName,
        targetPersonId: targetPerson?.id,
        targetPersonEmail: targetPerson?.email,
        confirmationToken: token,
      });

      // Dispatch direct email notification if email exists
      if (targetPerson?.email && targetPerson.email.includes('@')) {
        try {
          const emailResult = await sendDirectSwapNotification({
            requesterName: currentPersonName,
            requesterEmail: activePerson?.email,
            targetPersonName: targetPerson.name,
            targetPersonEmail: targetPerson.email,
            ministryName: currentLanguage === 'sl' ? ministry.nameSl : ministry.nameEn,
            sundayDate: sunday.date,
            reason: reason.trim() || undefined,
            token,
          });

          if (emailResult.success) {
            showToast(
              currentLanguage === 'sl'
                ? `✓ Prošnja za zamenjavo je bila poslana osebi ${targetPerson.name} na e-pošto (${targetPerson.email})!`
                : `✓ Direct swap request emailed to ${targetPerson.name} (${targetPerson.email})!`
            );
          } else {
            console.warn('[Swap Email Error]', emailResult.error);
            showToast(
              currentLanguage === 'sl'
                ? `⚠️ Prošnja je shranjena za ${targetPerson.name}, vendar e-pošta ni bila poslana: ${emailResult.error || 'Preverite Resend API ključ'}`
                : `⚠️ Request saved for ${targetPerson.name}, but email failed: ${emailResult.error || 'Check Resend API key'}`
            );
          }
        } catch (err: any) {
          console.warn('Direct swap email dispatch notice:', err);
          showToast(
            currentLanguage === 'sl'
              ? `⚠️ Prošnja shranjena za ${targetPerson.name}, napaka pri pošiljanju: ${err?.message || 'Neznana napaka'}`
              : `⚠️ Request saved for ${targetPerson.name}, email error: ${err?.message || 'Unknown error'}`
          );
        }
      } else {
        showToast(
          currentLanguage === 'sl'
            ? `✓ Prošnja poslana osebi ${selectedTargetPersonName}! (Brez e-pošte, obvestilo bo prikazano v aplikaciji).`
            : `✓ Swap request created for ${selectedTargetPersonName}! (No email on file, in-app notification active).`
        );
      }

      setIsSending(false);
    } else {
      // Public Open Board Post
      onCreateSwapRequest({
        requesterName: currentPersonName,
        requesterEmail: activePerson?.email,
        sundayId: sunday.id,
        sundayDate: sunday.date,
        ministryId: ministry.id,
        ministryName: currentLanguage === 'sl' ? ministry.nameSl : ministry.nameEn,
        reason: reason.trim() || undefined,
        status: 'open',
        swapType: 'open',
      });

      showToast(
        currentLanguage === 'sl'
          ? '✓ Prošnja za zamenjavo je objavljena na odprti oglasni deski!'
          : '✓ Swap request posted to the open shift board!'
      );
    }

    // Reset Form
    setShowCreateForm(false);
    setSelectedSundayId('');
    setSelectedMinistryId('');
    setSelectedTargetPersonName('');
    setReason('');
  };

  const handleAccept = (req: ShiftSwapRequest) => {
    onAcceptSwapRequest(req.id, currentPersonName);
    showToast(
      currentLanguage === 'sl'
        ? `🎉 Hvala! Prevzeli ste službo (${req.ministryName}) za nedeljo ${req.sundayDate}.`
        : `🎉 Thank you! You took over duty (${req.ministryName}) for ${req.sundayDate}.`
    );
  };

  const handleDecline = (req: ShiftSwapRequest) => {
    if (onDeclineSwapRequest) {
      onDeclineSwapRequest(req.id);
      showToast(
        currentLanguage === 'sl'
          ? `Zamenjavo ste zavrnili. Hvala za pravočasno obvestilo.`
          : `You declined the swap request.`
      );
    }
  };

  const handleConvertToOpen = (req: ShiftSwapRequest) => {
    if (onConvertToOpenSwapRequest) {
      onConvertToOpenSwapRequest(req.id);
      showToast(
        currentLanguage === 'sl'
          ? `✓ Prošnja je zdaj odprta za vse sodelavce na oglasni deski!`
          : `✓ Request converted to open board for all volunteers!`
      );
    }
  };

  const isUpcoming = (sundayDate: string) => {
    const d = parseEuropeanDate(sundayDate);
    if (!d) return true;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() >= todayMidnight;
  };

  const openOrPendingRequests = swapRequests.filter(
    (r) => (r.status === 'open' || r.status === 'pending_direct') && isUpcoming(r.sundayDate)
  );
  const pastRequests = swapRequests.filter(
    (r) => (r.status !== 'open' && r.status !== 'pending_direct') || !isUpcoming(r.sundayDate)
  );

  const handleCopyConfirmationLink = (token?: string) => {
    if (!token) return;
    const url = `${window.location.origin}/potrdi?token=${token}&action=accept`;
    navigator.clipboard.writeText(url).then(() => {
      showToast(
        currentLanguage === 'sl'
          ? '📋 Potrditvena povezava je kopirana v odložišče!'
          : '📋 Confirmation link copied to clipboard!'
      );
    }).catch(() => {
      showToast(url);
    });
  };

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
                  {openOrPendingRequests.length} {currentLanguage === 'sl' ? 'aktivnih' : 'active'}
                </span>
              </h2>
              <p className="text-xs text-gray-500 font-sans mt-0.5">
                {currentLanguage === 'sl'
                  ? 'Neposredna menjava službe z določenim sodelavcem ali objava na odprti deski.'
                  : 'Direct 1-on-1 swap request with email confirmation or open board broadcast.'}
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
          <div className="bg-emerald-600 text-white text-xs px-4 py-2.5 flex items-center justify-between font-medium animate-fade-in shadow-xs">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
              <span>{toastMsg}</span>
            </span>
            <button onClick={() => setToastMsg(null)} className="text-emerald-200 hover:text-white cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Action Header Banner */}
        <div className="p-4 bg-amber-50/70 border-b border-amber-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-amber-950">
            <span className="font-bold block">
              {currentLanguage === 'sl' ? 'Potrebujete zamenjavo za nedeljsko službo?' : 'Need coverage for your Sunday duty?'}
            </span>
            <span className="text-[11px] text-amber-800/90 font-sans">
              {currentLanguage === 'sl'
                ? 'Pošljite neposredno vabilo sodelavcu iz ekipe ali objavite na odprto desko.'
                : 'Send a direct swap invite to a teammate or post to the public board.'}
            </span>
          </div>

          {!isViewer && (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{currentLanguage === 'sl' ? 'Nova prošnja za zamenjavo' : 'Request Shift Swap'}</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5">
          {/* Create Request Form */}
          {showCreateForm && (
            <form
              onSubmit={handlePostSwap}
              className="bg-slate-50/90 border border-indigo-200/80 rounded-2xl p-4 sm:p-5 space-y-4 animate-fade-in shadow-xs"
            >
              <div className="flex items-center justify-between border-b border-gray-200 pb-2.5">
                <h3 className="font-display font-bold text-xs text-slate-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <ArrowRightLeft className="w-4 h-4 text-amber-600" />
                  <span>{currentLanguage === 'sl' ? 'Nastavitev zamenjave službe' : 'Shift Swap Setup'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="text-gray-400 hover:text-gray-600 text-xs font-semibold cursor-pointer"
                >
                  {currentLanguage === 'sl' ? 'Prekliči' : 'Cancel'}
                </button>
              </div>

              {/* Step 1: Pick from User's Assigned Duties */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  1. {currentLanguage === 'sl' ? 'Katero svojo službo želite zamenjati?' : 'Which of your scheduled duties to swap?'}
                </label>
                {myAssignedDuties.length === 0 ? (
                  <div className="p-3 bg-white border border-gray-200 rounded-xl text-xs text-slate-500">
                    {currentLanguage === 'sl'
                      ? 'Trenutno nimate dodeljenih aktivnih služb za menjavo.'
                      : 'You currently have no scheduled duties to swap.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {myAssignedDuties.map(({ sunday, ministry }) => {
                      const mName = currentLanguage === 'sl' ? ministry.nameSl : ministry.nameEn;
                      const emoji = getMinistryIconEmoji(ministry.id);
                      const isSelected = selectedSundayId === sunday.id && selectedMinistryId === ministry.id;

                      return (
                        <button
                          key={`${sunday.id}-${ministry.id}`}
                          type="button"
                          onClick={() => {
                            setSelectedSundayId(sunday.id);
                            setSelectedMinistryId(ministry.id);
                            setSelectedTargetPersonName('');
                          }}
                          className={`p-3 rounded-xl border text-left transition cursor-pointer text-xs flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-amber-500/15 border-amber-500 text-amber-950 font-bold shadow-xs'
                              : 'bg-white border-gray-200 text-slate-700 hover:bg-slate-100/80 hover:border-gray-300'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-bold flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>{formatToEuropeanDate(sunday.date)}</span>
                            </div>
                            <div className="text-[11px] text-amber-900/90 font-medium truncate mt-0.5">
                              {emoji} {mName}
                            </div>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Step 2: Swap Mode Toggle (Direct 1-on-1 vs Open Board) */}
              {selectedSundayId && selectedMinistryId && (
                <div className="space-y-2 pt-1 border-t border-gray-200/80 animate-fade-in">
                  <label className="block text-xs font-bold text-slate-800">
                    2. {currentLanguage === 'sl' ? 'Kako želite izvesti zamenjavo?' : 'How would you like to request the swap?'}
                  </label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSwapType('direct')}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                        swapType === 'direct'
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-950 shadow-2xs'
                          : 'bg-white border-gray-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs flex items-center gap-1.5 text-indigo-900">
                          <span>🎯</span>
                          <span>{currentLanguage === 'sl' ? 'Prosi določenega sodelavca' : 'Ask Specific Teammate'}</span>
                        </span>
                        {swapType === 'direct' && <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight">
                        {currentLanguage === 'sl'
                          ? 'Izberite sodelavca iz te službe. Prejel bo e-poštno vabilo s tipko za potrditev.'
                          : 'Pick a qualified teammate. They receive an email with instant 1-click confirmation.'}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSwapType('open')}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                        swapType === 'open'
                          ? 'bg-amber-50 border-amber-500 text-amber-950 shadow-2xs'
                          : 'bg-white border-gray-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs flex items-center gap-1.5 text-amber-900">
                          <span>📢</span>
                          <span>{currentLanguage === 'sl' ? 'Objavi na odprto desko' : 'Post to Open Board'}</span>
                        </span>
                        {swapType === 'open' && <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight">
                        {currentLanguage === 'sl'
                          ? 'Prošnja je vidna vsem sodelavcem v aplikaciji. Kdorkoli jo lahko prevzame.'
                          : 'Visible to all volunteers on the swap board. Anyone available can step in.'}
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Smart Teammate Dropdown (Only for Direct Swap) */}
              {selectedSundayId && selectedMinistryId && swapType === 'direct' && (
                <div className="space-y-1.5 pt-1 border-t border-gray-200/80 animate-fade-in">
                  <label className="block text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span>3. {currentLanguage === 'sl' ? 'Izberite sodelavca za zamenjavo:' : 'Choose teammate for swap:'}</span>
                    <span className="text-[10px] text-indigo-600 font-normal">
                      {teamMembers.length} {currentLanguage === 'sl' ? 'članov te službe' : 'in this ministry'}
                    </span>
                  </label>

                  <select
                    value={selectedTargetPersonName}
                    onChange={(e) => setSelectedTargetPersonName(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white border border-indigo-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-slate-900 shadow-2xs cursor-pointer"
                  >
                    <option value="">-- {currentLanguage === 'sl' ? 'Izberi sodelavca...' : 'Select teammate...'} --</option>
                    
                    {/* Team Members */}
                    {teamMembers.length > 0 && (
                      <optgroup label={currentLanguage === 'sl' ? '⭐ Sodelavci v tej ekipi / službi' : '⭐ Active in this ministry'}>
                        {teamMembers.map(({ person, hasEmail }) => (
                          <option key={person.id || person.name} value={person.name}>
                            ⭐ {person.name} {hasEmail ? '📧' : '⚠️ (brez emaila)'}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {/* Other Volunteers */}
                    {otherVolunteers.length > 0 && (
                      <optgroup label={currentLanguage === 'sl' ? '👥 Ostali razpoložljivi sodelavci' : '👥 Other available volunteers'}>
                        {otherVolunteers.map(({ person, hasEmail }) => (
                          <option key={person.id || person.name} value={person.name}>
                            {person.name} {hasEmail ? '📧' : '⚠️ (brez emaila)'}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {/* Absent Volunteers (Disabled with absence notice) */}
                    {absentVolunteers.length > 0 && (
                      <optgroup label={currentLanguage === 'sl' ? '🏖️ Odsotni / Na dopustu to nedeljo' : '🏖️ Absent / On vacation this Sunday'}>
                        {absentVolunteers.map(({ person, absenceReason }) => (
                          <option key={person.id || person.name} value="" disabled>
                            🚫 {person.name} ({absenceReason || (currentLanguage === 'sl' ? 'Dopust' : 'Vacation')})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>

                  {/* Selected Person Helper Note */}
                  {selectedTargetPersonName && (() => {
                    const candidate = qualifiedCandidates.find(c => c.person.name === selectedTargetPersonName);
                    if (!candidate) return null;
                    return (
                      <div className="flex items-center gap-2 p-2 bg-indigo-50/70 border border-indigo-100 rounded-lg text-[11px] text-indigo-900 font-medium">
                        {candidate.hasEmail ? (
                          <>
                            <Mail className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>
                              {currentLanguage === 'sl' 
                                ? `E-poštno vabilo bo takoj poslano na ${candidate.person.email}` 
                                : `Email invite will be sent immediately to ${candidate.person.email}`}
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>
                              {currentLanguage === 'sl'
                                ? 'Ta oseba nima e-pošte. Obvestilo bo prejela v aplikaciji.'
                                : 'No email on file. In-app notification will appear when they open the app.'}
                            </span>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Step 4: Reason / Custom Message */}
              {selectedSundayId && selectedMinistryId && (
                <div className="space-y-1.5 pt-1 border-t border-gray-200/80 animate-fade-in">
                  <label className="block text-xs font-bold text-slate-800">
                    {swapType === 'direct' ? '4.' : '3.'} {currentLanguage === 'sl' ? 'Razlog ali sporočilo za sodelavca (opcijsko):' : 'Reason or note for the teammate (optional):'}
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={
                      swapType === 'direct'
                        ? (currentLanguage === 'sl' ? 'Npr. Živjo, ta vikend sem na poti, bi lahko prevzel/a zame? Hvala!' : 'e.g. Out of town for family event, could you cover? Thanks!')
                        : (currentLanguage === 'sl' ? 'Npr. Službeno potovanje / Zadržanost' : 'e.g. Traveling / unavailable')
                    }
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white shadow-2xs"
                  />
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-gray-300 transition cursor-pointer"
                >
                  {currentLanguage === 'sl' ? 'Prekliči' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSending || !selectedSundayId || !selectedMinistryId || (swapType === 'direct' && !selectedTargetPersonName)}
                  className={`px-4 py-2 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                    isSending || !selectedSundayId || !selectedMinistryId || (swapType === 'direct' && !selectedTargetPersonName)
                      ? 'bg-slate-400 cursor-not-allowed opacity-70'
                      : swapType === 'direct'
                        ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                        : 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {isSending
                      ? (currentLanguage === 'sl' ? 'Pošiljanje...' : 'Sending...')
                      : swapType === 'direct'
                        ? (currentLanguage === 'sl' ? 'Pošlji prošnjo sodelavcu' : 'Send Swap Request')
                        : (currentLanguage === 'sl' ? 'Objavi na oglasno desko' : 'Post to Board')}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* Active Open / Pending Swap Requests List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono flex items-center justify-between">
              <span>{currentLanguage === 'sl' ? 'Aktivne prošnje za zamenjavo' : 'Active Swap Requests'}</span>
              <span className="text-[10px] text-gray-400">({openOrPendingRequests.length})</span>
            </h3>

            {openOrPendingRequests.length === 0 ? (
              <div className="text-center py-8 bg-gray-50/80 rounded-2xl border border-dashed border-gray-200 space-y-1.5">
                <UserCheck className="w-7 h-7 text-emerald-500 mx-auto" />
                <p className="text-xs font-semibold text-gray-700">
                  {currentLanguage === 'sl' ? 'Trenutno ni aktivnih prošenj za zamenjavo.' : 'No active swap requests.'}
                </p>
                <p className="text-[11px] text-gray-400">
                  {currentLanguage === 'sl'
                    ? 'Vsi nedeljski razporedi so pokriti in usklajeni.'
                    : 'All Sunday rosters are covered and conflict-free.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {openOrPendingRequests.map((req) => {
                  const isOwnRequest = req.requesterName === currentPersonName;
                  const isTargetPerson = req.targetPersonName && req.targetPersonName.toLowerCase().trim() === currentPersonName.toLowerCase().trim();
                  const isDirect = req.swapType === 'direct' || req.status === 'pending_direct';

                  return (
                    <div
                      key={req.id}
                      className={`bg-white border rounded-2xl p-4 shadow-2xs space-y-3 transition ${
                        isDirect 
                          ? 'border-indigo-200/90 hover:border-indigo-300 bg-gradient-to-br from-white to-indigo-50/20' 
                          : 'border-amber-200/90 hover:border-amber-300'
                      }`}
                    >
                      {/* Top Bar: Date, Duty, Type Badge & Date */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-display font-bold text-sm text-slate-900">
                              {formatToEuropeanDate(req.sundayDate)}
                            </span>
                            <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md font-mono border border-slate-200">
                              {req.ministryName}
                            </span>
                            {isDirect ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-900 rounded-full font-mono border border-indigo-200 flex items-center gap-1">
                                <span>🎯</span>
                                <span>{currentLanguage === 'sl' ? `Direktno za: ${req.targetPersonName}` : `Direct: ${req.targetPersonName}`}</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full font-mono border border-amber-200 flex items-center gap-1">
                                <span>📢</span>
                                <span>{currentLanguage === 'sl' ? 'Odprto za vse' : 'Open to all'}</span>
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-gray-600 flex items-center gap-1.5 pt-0.5">
                            <span>{currentLanguage === 'sl' ? 'Prosil/a:' : 'Requested by:'}</span>
                            <strong className="text-slate-900 font-bold">
                              {getPrivacyDisplayName(req.requesterName, userRole, currentPersonName, undefined, undefined, people)}
                            </strong>
                          </p>
                        </div>

                        <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1 shrink-0">
                          <Clock className="w-3 h-3" />
                          <span>{formatEuropeanDateTime(req.createdAt)}</span>
                        </div>
                      </div>

                      {/* Reason / Custom Message */}
                      {req.reason && (
                        <div className={`text-xs p-2.5 rounded-xl border flex items-start gap-2 ${
                          isDirect ? 'bg-indigo-50/60 border-indigo-100 text-indigo-950' : 'bg-amber-50/60 border-amber-100 text-amber-950'
                        }`}>
                          <MessageSquare className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isDirect ? 'text-indigo-600' : 'text-amber-600'}`} />
                          <span className="italic">"{req.reason}"</span>
                        </div>
                      )}

                      {/* Action Area */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        {isOwnRequest ? (
                          <div className="flex items-center justify-between w-full flex-wrap gap-2">
                            <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                              {isDirect ? (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                  <span>{currentLanguage === 'sl' ? `Čaka na odgovor osebe ${req.targetPersonName}` : `Waiting for ${req.targetPersonName}'s response`}</span>
                                </>
                              ) : (
                                <span>{currentLanguage === 'sl' ? 'Vaša odprta prošnja na deski' : 'Your open request on the board'}</span>
                              )}
                            </span>

                            <div className="flex items-center gap-2">
                              {isDirect && req.confirmationToken && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyConfirmationLink(req.confirmationToken)}
                                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition active:scale-95 flex items-center gap-1 cursor-pointer border border-indigo-200"
                                  title={currentLanguage === 'sl' ? 'Kopiraj 1-klik povezavo za potrditev' : 'Copy 1-click confirmation link'}
                                >
                                  <Copy className="w-3 h-3" />
                                  <span>{currentLanguage === 'sl' ? 'Kopiraj povezavo' : 'Copy Link'}</span>
                                </button>
                              )}
                              {isDirect && onConvertToOpenSwapRequest && (
                                <button
                                  type="button"
                                  onClick={() => handleConvertToOpen(req)}
                                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold rounded-lg transition active:scale-95 flex items-center gap-1 cursor-pointer border border-amber-200"
                                  title={currentLanguage === 'sl' ? 'Odpri za vse sodelavce, če izbrani ne more' : 'Convert to open board'}
                                >
                                  <Share2 className="w-3 h-3" />
                                  <span>{currentLanguage === 'sl' ? 'Pretvori v odprto' : 'Open to All'}</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onCancelSwapRequest(req.id)}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg transition active:scale-95 flex items-center gap-1 cursor-pointer border border-rose-200"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>{currentLanguage === 'sl' ? 'Umakni' : 'Cancel'}</span>
                              </button>
                            </div>
                          </div>
                        ) : isTargetPerson ? (
                          /* Targeted Teammate View */
                          <div className="flex items-center justify-between w-full flex-wrap gap-2 bg-indigo-50/80 p-2.5 rounded-xl border border-indigo-200">
                            <div className="text-xs text-indigo-950 font-semibold">
                              {currentLanguage === 'sl' ? '👋 Ali lahko prevzamete to službo?' : '👋 Can you take over this shift?'}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleAccept(req)}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition active:scale-95 flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{currentLanguage === 'sl' ? 'Sprejmi zamenjavo' : 'Accept Swap'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDecline(req)}
                                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition active:scale-95 flex items-center gap-1 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5 text-slate-500" />
                                <span>{currentLanguage === 'sl' ? 'Ne morem' : 'Decline'}</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* General Open Board View */
                          <div className="flex items-center justify-between w-full flex-wrap gap-2">
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
                                type="button"
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
                    className="p-3 bg-gray-50/90 border border-gray-200 rounded-xl text-xs flex items-center justify-between text-gray-600"
                  >
                    <div>
                      <span className="font-semibold text-gray-900">{formatToEuropeanDate(req.sundayDate)}</span> ({req.ministryName}):{' '}
                      <span>{req.requesterName}</span> ➔{' '}
                      <strong className="text-emerald-700 font-bold">{req.acceptedByName || (currentLanguage === 'sl' ? 'Zamenjano' : 'Resolved')}</strong>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                      req.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {req.status === 'accepted' 
                        ? (currentLanguage === 'sl' ? 'Prevzeto' : 'Resolved')
                        : (currentLanguage === 'sl' ? 'Zaključeno' : 'Closed')}
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

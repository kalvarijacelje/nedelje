/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { ServiceSunday, Ministry, Person, ShiftSwapRequest } from '../types';
import { 
  findAssignmentByToken, 
  updateAssignmentStatusByToken, 
  downloadICS, 
  getGoogleCalendarAddUrl,
  sendLeaderResponseNotification,
  logInAppNotification
} from '../services/notificationService';
import { confirmAssignmentByToken, fetchAssignmentByToken } from '../services/supabaseDataService';
import { formatToEuropeanDate } from '../utils/dateUtils';
import KcKalvarijaLogo from '../components/KcKalvarijaLogo';
import { 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  Clock, 
  Download, 
  ExternalLink, 
  MessageSquare, 
  Send, 
  ChevronRight, 
  AlertCircle,
  Sparkles,
  Heart,
  ArrowRightLeft,
  Loader2
} from 'lucide-react';

interface ConfirmPageProps {
  sundays: ServiceSunday[];
  ministries: Ministry[];
  people?: Person[];
  swapRequests?: ShiftSwapRequest[];
  onUpdateSunday: (sunday: ServiceSunday) => void;
  onAcceptSwapRequest?: (requestId: string, acceptingPersonName: string) => void;
  onDeclineSwapRequest?: (requestId: string, declineReason?: string) => void;
  onNavigateHome: () => void;
}

export default function ConfirmPage({
  sundays,
  ministries,
  people = [],
  swapRequests = [],
  onUpdateSunday,
  onAcceptSwapRequest,
  onDeclineSwapRequest,
  onNavigateHome,
}: ConfirmPageProps) {
  const [token, setToken] = useState<string>('');
  const [initialAction, setInitialAction] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [asyncMatch, setAsyncMatch] = useState<{ sunday: ServiceSunday; ministryId: string; assignment: any } | null>(null);
  const [processed, setProcessed] = useState<boolean>(false);
  const [currentStatus, setCurrentStatus] = useState<'pending' | 'confirmed' | 'declined'>('pending');
  const [declineReasonInput, setDeclineReasonInput] = useState<string>('');
  const [noteSaved, setNoteSaved] = useState<boolean>(false);
  const hasNotifiedLeaderRef = useRef<boolean>(false);

  // Parse URL query params and resolve assignment or swap request
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    let tok = urlParams.get('token') || urlParams.get('swap_token') || '';
    let act = urlParams.get('action') || null;

    if (!tok && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      tok = hashParams.get('token') || hashParams.get('swap_token') || '';
      act = act || hashParams.get('action') || null;
    }

    setToken(tok);
    setInitialAction(act);

    if (!tok) {
      setIsLoading(false);
      return;
    }

    const cleanTok = tok.trim();

    // 1. Check if token matches a direct shift swap request in memory
    const swapReq = swapRequests.find(r => r.confirmationToken === cleanTok || r.id === cleanTok);
    if (swapReq) {
      setIsLoading(false);
      return;
    }

    // 2. Check if token exists in in-memory sundays list (optimistic immediate display)
    const memoryMatch = findAssignmentByToken(sundays, cleanTok);
    if (memoryMatch) {
      setAsyncMatch(memoryMatch);
      setIsLoading(false);
    }

    // 3. Check if structured token can be resolved immediately
    if (cleanTok.startsWith('tok_')) {
      const raw = cleanTok.replace(/^tok_/, '');
      const hasSundayMatch = sundays.some(s => raw.includes(s.id) || raw.includes(s.date.replace(/\.\s*/g, '_')));
      if (hasSundayMatch) {
        setIsLoading(false);
      }
    }

    // 4. Fetch directly from Supabase by token for authoritative DB state
    let isCancelled = false;
    fetchAssignmentByToken(cleanTok).then(remoteMatch => {
      if (isCancelled) return;
      if (remoteMatch) {
        setAsyncMatch(remoteMatch);
        onUpdateSunday(remoteMatch.sunday);
      }
      setIsLoading(false);
    }).catch(err => {
      if (isCancelled) return;
      console.warn('Async token fetch notice:', err);
      setIsLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [sundays, swapRequests]);

  const cleanToken = token.trim();

  // Helper to resolve swap request either from list or from token pattern
  const resolveSwap = (): ShiftSwapRequest | null => {
    if (!cleanToken) return null;
    const direct = swapRequests.find(r => r.confirmationToken === cleanToken || r.id === cleanToken);
    if (direct) return direct;

    // Pattern matching: tok_s_YYYY_MM_DD_ministryId_personName_rand
    if (cleanToken.startsWith('tok_')) {
      const raw = cleanToken.replace(/^tok_/, '');
      const sMatch = sundays.find(s => 
        raw.includes(s.id) || 
        raw.includes(s.date.replace(/\.\s*/g, '_')) ||
        raw.includes(s.date.replace(/\.\s*/g, '-'))
      );

      if (sMatch) {
        const mMatch = ministries.find(m => raw.includes(m.id));
        if (mMatch) {
          const pMatch = people.find(p => {
            const slug = p.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
            return raw.includes(slug);
          });

          const currentAssignees = sMatch.assignments[mMatch.id] || [];
          const requester = currentAssignees[0] || 'Aleš Lajlar';
          const reqPerson = people.find(p => p.name.toLowerCase().trim() === requester.toLowerCase().trim());

          return {
            id: 'swap-' + cleanToken,
            sundayId: sMatch.id,
            sundayDate: sMatch.date,
            ministryId: mMatch.id,
            ministryName: mMatch.nameSl,
            requesterName: requester,
            requesterEmail: reqPerson?.email,
            targetPersonName: pMatch?.name || 'Kenzley Franceen Lajlar',
            targetPersonId: pMatch?.id,
            targetPersonEmail: pMatch?.email,
            status: 'pending_direct',
            swapType: 'direct',
            confirmationToken: cleanToken,
            createdAt: 'Danes'
          };
        }
      }
    }
    return null;
  };

  // Check if this token is for a Shift Swap Request
  const matchedSwapRequest = resolveSwap();

  // Combined synchronous / asynchronous match for regular assignment
  const match = asyncMatch || findAssignmentByToken(sundays, cleanToken);
  const assignment = match?.assignment;

  // Resolve Sunday, Ministry, and Names based on whether it's a swap or assignment
  const isSwap = Boolean(matchedSwapRequest);
  const sunday = isSwap
    ? (sundays.find(s => s.id === matchedSwapRequest?.sundayId || s.date === matchedSwapRequest?.sundayDate) || {
        id: matchedSwapRequest!.sundayId,
        date: matchedSwapRequest!.sundayDate,
        themeSl: '',
        themeEn: '',
        assignments: {},
      } as ServiceSunday)
    : match?.sunday;

  const ministry = isSwap
    ? ministries.find(m => m.id === matchedSwapRequest?.ministryId)
    : (match ? ministries.find(m => m.id === match.ministryId) : null);

  const ministryName = isSwap
    ? (matchedSwapRequest?.ministryName || ministry?.nameSl || 'Nedeljska služba')
    : (ministry ? ministry.nameSl : 'Nedeljska služba');

  const personName = isSwap
    ? (matchedSwapRequest?.targetPersonName || 'Sodelavec')
    : (assignment?.personName || 'Sodelavec');

  const leaderOrRequesterName = isSwap
    ? (matchedSwapRequest?.requesterName || 'Sodelavec')
    : (assignment?.assignedByLeaderName || 'Vodja službe');

  // Helper to resolve leader email for regular assignment
  const resolveLeaderEmail = (): string | null => {
    if (!match || !assignment) return null;

    if (assignment.assignedByLeaderId && people.length > 0) {
      const found = people.find(p => p && p.id === assignment.assignedByLeaderId);
      if (found?.email) return found.email;
    }

    if (assignment.assignedByLeaderName && people.length > 0) {
      const found = people.find(p => p && p.name && p.name.toLowerCase().trim() === assignment.assignedByLeaderName.toLowerCase().trim());
      if (found?.email) return found.email;
    }

    if (ministry?.leader && people.length > 0) {
      const found = people.find(p => p && p.name && p.name.toLowerCase().trim() === ministry.leader.toLowerCase().trim());
      if (found?.email) return found.email;
    }

    return null;
  };

  // Helper to notify leader via email & log in-app notification for regular assignment
  const notifyLeader = (action: 'confirmed' | 'declined', note?: string) => {
    if (!match || !assignment || !sunday) return;

    logInAppNotification({
      type: 'volunteer_response',
      title: action === 'confirmed' ? `✓ ${assignment.personName} je potrdil/a` : `❌ ${assignment.personName} ne more služiti`,
      message: action === 'confirmed'
        ? `${assignment.personName} je potrdil/a sodelovanje pri službi ${ministryName} (${sunday.date}).`
        : `${assignment.personName} je zavrnil/a sodelovanje pri službi ${ministryName} (${sunday.date}).${note ? ` Opomba: "${note}"` : ''}`,
      action,
      volunteerName: assignment.personName,
      ministryName,
      sundayDate: sunday.date,
      note,
    });

    const leaderEmail = resolveLeaderEmail();
    if (leaderEmail) {
      sendLeaderResponseNotification({
        volunteerName: assignment.personName,
        leaderName: leaderOrRequesterName,
        leaderEmail,
        ministryName,
        sundayDate: sunday.date,
        action,
        note,
      }).catch(err => {
        console.warn('Reverse leader email notification failed:', err);
      });
    }
  };

  // Handle auto-action on load if specified in URL query
  useEffect(() => {
    if (processed || !cleanToken) return;

    if (isSwap && matchedSwapRequest) {
      if (initialAction === 'accept') {
        if (onAcceptSwapRequest) {
          onAcceptSwapRequest(matchedSwapRequest.id, matchedSwapRequest.targetPersonName || 'Sodelavec');
        }
        setCurrentStatus('confirmed');
        setProcessed(true);
      } else if (initialAction === 'decline') {
        if (onDeclineSwapRequest) {
          onDeclineSwapRequest(matchedSwapRequest.id);
        }
        setCurrentStatus('declined');
        setProcessed(true);
      } else {
        setCurrentStatus(
          matchedSwapRequest.status === 'accepted' ? 'confirmed' :
          matchedSwapRequest.status === 'declined' ? 'declined' : 'pending'
        );
        if (matchedSwapRequest.declineReason) {
          setDeclineReasonInput(matchedSwapRequest.declineReason);
        }
      }
      return;
    }

    if (!match) return;

    if (initialAction === 'accept') {
      const res = updateAssignmentStatusByToken(sundays, cleanToken, 'confirmed', undefined, match);
      if (res) {
        onUpdateSunday(res.modifiedSunday);
        setCurrentStatus('confirmed');
        setProcessed(true);
        confirmAssignmentByToken(cleanToken, 'confirmed').catch(console.warn);
        if (!hasNotifiedLeaderRef.current) {
          hasNotifiedLeaderRef.current = true;
          notifyLeader('confirmed');
        }
      }
    } else if (initialAction === 'decline') {
      const res = updateAssignmentStatusByToken(sundays, cleanToken, 'declined', undefined, match);
      if (res) {
        onUpdateSunday(res.modifiedSunday);
        setCurrentStatus('declined');
        setProcessed(true);
        confirmAssignmentByToken(cleanToken, 'declined').catch(console.warn);
        if (!hasNotifiedLeaderRef.current) {
          hasNotifiedLeaderRef.current = true;
          notifyLeader('declined');
        }
      }
    } else if (assignment) {
      setCurrentStatus(assignment.status === 'declined' ? 'declined' : assignment.status === 'confirmed' ? 'confirmed' : 'pending');
      if (assignment.declineReason) {
        setDeclineReasonInput(assignment.declineReason);
      }
    }
  }, [match, isSwap, matchedSwapRequest, cleanToken, initialAction, processed]);

  const handleAccept = () => {
    if (isSwap && matchedSwapRequest) {
      if (onAcceptSwapRequest) {
        onAcceptSwapRequest(matchedSwapRequest.id, matchedSwapRequest.targetPersonName || 'Sodelavec');
      }
      setCurrentStatus('confirmed');
      setProcessed(true);
      return;
    }

    if (!match) return;
    const res = updateAssignmentStatusByToken(sundays, cleanToken, 'confirmed', undefined, match);
    if (res) {
      onUpdateSunday(res.modifiedSunday);
      setCurrentStatus('confirmed');
      setProcessed(true);
      confirmAssignmentByToken(cleanToken, 'confirmed').catch(console.warn);
      notifyLeader('confirmed');
    }
  };

  const handleDecline = () => {
    if (isSwap && matchedSwapRequest) {
      if (onDeclineSwapRequest) {
        onDeclineSwapRequest(matchedSwapRequest.id, declineReasonInput);
      }
      setCurrentStatus('declined');
      setProcessed(true);
      return;
    }

    if (!match) return;
    const res = updateAssignmentStatusByToken(sundays, cleanToken, 'declined', declineReasonInput, match);
    if (res) {
      onUpdateSunday(res.modifiedSunday);
      setCurrentStatus('declined');
      setProcessed(true);
      confirmAssignmentByToken(cleanToken, 'declined', declineReasonInput).catch(console.warn);
      notifyLeader('declined', declineReasonInput);
    }
  };

  const handleSaveDeclineNote = () => {
    if (isSwap && matchedSwapRequest) {
      if (onDeclineSwapRequest) {
        onDeclineSwapRequest(matchedSwapRequest.id, declineReasonInput);
      }
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 3500);
      return;
    }

    if (!match) return;
    const res = updateAssignmentStatusByToken(sundays, cleanToken, 'declined', declineReasonInput, match);
    if (res) {
      onUpdateSunday(res.modifiedSunday);
      setNoteSaved(true);
      confirmAssignmentByToken(cleanToken, 'declined', declineReasonInput).catch(console.warn);
      notifyLeader('declined', declineReasonInput);
      setTimeout(() => setNoteSaved(false), 3500);
    }
  };

  // State: Loading token validation
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-gray-150 text-center space-y-4 animate-scale-up">
          <div className="w-12 h-12 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="space-y-1">
            <h3 className="font-bold text-slate-800 text-sm font-display">Preverjanje potrditvene povezave...</h3>
            <p className="text-xs text-slate-400 font-sans">Nalagamo podatke iz baze KC Kalvarija</p>
          </div>
        </div>
      </div>
    );
  }

  // State: Token invalid / not found
  if (!cleanToken || (!isSwap && (!match || !sunday || !assignment)) || (isSwap && !matchedSwapRequest)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-150 text-center space-y-5 animate-scale-up">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-gray-900 font-display">Povezava ni veljavna ali je potekla</h2>
            <p className="text-xs text-gray-600 leading-relaxed">
              Zadolžitev ali prošnja za zamenjavo za to potrditveno kodo morda ne obstaja več ali pa je bila že zaključena.
            </p>
          </div>
          <button
            onClick={onNavigateHome}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Odpri aplikacijo KC Kalvarija</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-indigo-50/20 to-slate-100 flex flex-col justify-between py-8 px-4 sm:px-6">
      
      {/* Top Brand Logo */}
      <div className="max-w-md mx-auto w-full text-center space-y-2">
        <div className="inline-flex items-center justify-center p-2.5 bg-white rounded-2xl shadow-sm border border-gray-200/80 mb-1">
          <KcKalvarijaLogo className="w-10 h-10" />
        </div>
        <h1 className="text-xs font-mono font-bold tracking-wider uppercase text-indigo-900">
          Krščanska cerkev Kalvarija
        </h1>
      </div>

      {/* Main Interactive Card */}
      <div className="max-w-md mx-auto w-full my-6 bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-200/80 space-y-6 animate-scale-up">
        
        {/* Card Header with Person Greeting */}
        <div className="space-y-2 border-b border-gray-100 pb-5">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-[11px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${
              isSwap ? 'bg-amber-50 text-amber-700 border border-amber-200/60' : 'bg-indigo-50 text-indigo-600'
            }`}>
              {isSwap ? (
                <>
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Prošnja za zamenjavo</span>
                </>
              ) : (
                'Povabilo k služenju'
              )}
            </span>
            <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 ${
              currentStatus === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
              currentStatus === 'declined' ? 'bg-rose-100 text-rose-800' :
              'bg-amber-100 text-amber-800'
            }`}>
              {currentStatus === 'confirmed' ? (isSwap ? '✓ Zamenjava sprejeta' : '✓ Potrjeno') :
               currentStatus === 'declined' ? '✕ Zavrnjeno' :
               '⏳ Čaka na odziv'}
            </span>
          </div>

          <h2 className="text-xl font-bold text-gray-900 font-display">
            Pozdravljeni, {personName}!
          </h2>
          <p className="text-xs text-gray-600 leading-relaxed">
            {isSwap ? (
              <>Sodelavec <strong className="text-gray-900">{leaderOrRequesterName}</strong> te prosi za zamenjavo oz. prevzem službe <strong className="text-indigo-700">{ministryName}</strong>.</>
            ) : (
              <>Vodja službe <strong className="text-gray-900">{leaderOrRequesterName}</strong> te vabi k sodelovanju pri službi <strong className="text-indigo-700">{ministryName}</strong>.</>
            )}
          </p>
        </div>

        {/* Highlighted Assignment Date & Role Card */}
        <div className="p-4 bg-gradient-to-r from-indigo-50/80 to-slate-50 rounded-2xl border border-indigo-100/80 space-y-2">
          <div className="flex items-center gap-2 text-indigo-950 font-bold text-base">
            <Calendar className="w-5 h-5 text-indigo-600 shrink-0" />
            <span>{sunday ? formatToEuropeanDate(sunday.date) : ''}</span>
          </div>
          <div className="text-xs font-semibold text-gray-700 pl-7 flex items-center gap-1.5">
            <span>Služba:</span>
            <span className="text-indigo-900 font-bold bg-white px-2 py-0.5 rounded-md border border-indigo-200">
              {ministryName}
            </span>
          </div>
          {isSwap && matchedSwapRequest?.reason && (
            <div className="text-xs text-amber-900 bg-amber-50/90 border border-amber-200 rounded-xl p-2.5 mt-2 flex items-start gap-2">
              <MessageSquare className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-[11px] text-amber-800">Sporočilo sodelavca ({leaderOrRequesterName}):</span>
                <span className="italic">"{matchedSwapRequest.reason}"</span>
              </div>
            </div>
          )}
          {!isSwap && sunday?.themeSl && (
            <div className="text-[11px] text-gray-500 pl-7 italic truncate">
              Tema: {sunday.themeSl}
            </div>
          )}
        </div>

        {/* Dynamic State Feedback: CONFIRMED */}
        {currentStatus === 'confirmed' && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2 text-center">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-emerald-900">
                {isSwap
                  ? `Hvala za vašo pomoč in kolegialnost! Zamenjava je sprejeta in vpisana v razpored.`
                  : `Hvala za vašo pripravljenost in služenje! Zadolžitev je potrjena.`}
              </p>
              <p className="text-[11px] text-emerald-700">
                {isSwap
                  ? `Sodelavec ${leaderOrRequesterName} je obveščen, da ste prevzeli njegov termin.`
                  : `Vodja ${leaderOrRequesterName} je obveščen o vaši potrditvi.`}
              </p>
            </div>

            {/* Calendar download & Google Calendar buttons */}
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider block text-center">
                DODAJ V SVOJ OSEBNI KOLEDAR:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <a
                  href={getGoogleCalendarAddUrl(sunday?.date || '', ministryName, isSwap ? matchedSwapRequest?.reason : assignment?.notes)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2.5 bg-white hover:bg-gray-50 text-gray-800 text-xs font-semibold rounded-xl border border-gray-200 shadow-2xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  title="Dodaj dogodek v Google Koledar"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                  <span>📅 Google Koledar</span>
                </a>
                <button
                  type="button"
                  onClick={() => downloadICS(sunday?.date || '', ministryName, isSwap ? matchedSwapRequest?.reason : assignment?.notes)}
                  className="px-3 py-2.5 bg-white hover:bg-gray-50 text-gray-800 text-xs font-semibold rounded-xl border border-gray-200 shadow-2xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  title="Prenesi datoteko za Apple Koledar, Outlook ali druge aplikacije"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-600" />
                  <span>🍎 Apple / Outlook (.ics)</span>
                </button>
              </div>
            </div>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={handleDecline}
                className="text-[11px] text-gray-400 hover:text-rose-600 transition underline cursor-pointer"
              >
                Se je kaj spremenilo? Kliknite tukaj za spremembo na "Ne morem"
              </button>
            </div>
          </div>
        )}

        {/* Dynamic State Feedback: DECLINED */}
        {currentStatus === 'declined' && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-center">
              <div className="w-10 h-10 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center mx-auto">
                <XCircle className="w-6 h-6 text-rose-500" />
              </div>
              <p className="text-xs font-bold text-gray-800">
                Hvala, ker ste pravočasno sporočili.
              </p>
              <p className="text-[11px] text-gray-500">
                {isSwap
                  ? `Sodelavec ${leaderOrRequesterName} lahko zamenjavo ponudi drugemu sodelavcu ali objavi na odprto desko.`
                  : `Termin je bil sproščen, da lahko vodja poišče nadomeščanje.`}
              </p>
            </div>

            {/* Optional note */}
            <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200/80 space-y-2">
              <label className="block text-xs font-medium text-gray-700">
                Želite dodati kratko opombo za {isSwap ? 'sodelavca' : 'vodjo službe'} <strong>{leaderOrRequesterName}</strong>? <span className="text-gray-400 font-normal">(neobvezno)</span>
              </label>
              <textarea
                value={declineReasonInput}
                onChange={(e) => setDeclineReasonInput(e.target.value)}
                placeholder="Npr. sem na potovanju, praznujemo družinski dogodek, menjava termina..."
                rows={2}
                className="w-full text-xs p-2.5 bg-white border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-emerald-600 font-bold">
                  {noteSaved ? '✓ Opomba shranjena!' : ''}
                </span>
                <button
                  type="button"
                  onClick={handleSaveDeclineNote}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3 h-3" />
                  <span>Oddaj opombo</span>
                </button>
              </div>
            </div>

            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={handleAccept}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 transition underline font-semibold cursor-pointer"
              >
                Ste pomotoma zavrnili? Če vseeno želite prevzeti termin, kliknite tukaj za potrditev.
              </button>
            </div>
          </div>
        )}

        {/* Action Choice Buttons when Pending */}
        {currentStatus === 'pending' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleAccept}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSwap ? '✅ Sprejmi zamenjavo' : '✅ Sprejmi zadolžitev'}</span>
            </button>

            <button
              type="button"
              onClick={handleDecline}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 active:scale-98 text-gray-700 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2 border border-gray-200"
            >
              <XCircle className="w-4 h-4 text-gray-500" />
              <span>❌ Ne morem / Zavrni</span>
            </button>

            {/* Reassuring note */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <p className="text-[11px] text-gray-600 italic">
                "Če ne utegnete, preprosto kliknite 'Ne morem' – vsako pravočasno obvestilo nam je v veliko pomoč."
              </p>
            </div>
          </div>
        )}

        {/* Footer info note */}
        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
          <span>{isSwap ? 'Prosil/a:' : 'Vodja:'} <strong>{leaderOrRequesterName}</strong></span>
          <button
            type="button"
            onClick={onNavigateHome}
            className="text-indigo-600 hover:underline font-medium cursor-pointer"
          >
            Vstop v aplikacijo →
          </button>
        </div>

      </div>

      {/* Page Footer */}
      <footer className="text-center text-xs text-gray-400">
        © {new Date().getFullYear()} Krščanska cerkev Kalvarija • Vsa prava pridržana.
      </footer>
    </div>
  );
}

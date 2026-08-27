/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { ServiceSunday, Ministry, Person } from '../types';
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
  Loader2
} from 'lucide-react';

interface ConfirmPageProps {
  sundays: ServiceSunday[];
  ministries: Ministry[];
  people?: Person[];
  onUpdateSunday: (sunday: ServiceSunday) => void;
  onNavigateHome: () => void;
}

export default function ConfirmPage({
  sundays,
  ministries,
  people = [],
  onUpdateSunday,
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

  // Parse URL query params and resolve assignment asynchronously
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    let tok = urlParams.get('token') || '';
    let act = urlParams.get('action') || null;

    if (!tok && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      tok = hashParams.get('token') || '';
      act = act || hashParams.get('action') || null;
    }

    setToken(tok);
    setInitialAction(act);

    if (!tok) {
      setIsLoading(false);
      return;
    }

    // 1. Check if token already exists in in-memory sundays list (optimistic immediate display)
    const memoryMatch = findAssignmentByToken(sundays, tok);
    if (memoryMatch) {
      setAsyncMatch(memoryMatch);
      setIsLoading(false);
    }

    // 2. Fetch directly from Supabase by token for authoritative DB state
    let isCancelled = false;
    fetchAssignmentByToken(tok).then(remoteMatch => {
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
  }, [sundays]);

  // Combined synchronous / asynchronous match
  const match = asyncMatch || findAssignmentByToken(sundays, token);
  const assignment = match?.assignment;
  const sunday = match?.sunday;
  const ministry = match ? ministries.find(m => m.id === match.ministryId) : null;
  const ministryName = ministry ? ministry.nameSl : 'Nedeljska služba';
  const leaderName = assignment?.assignedByLeaderName || 'Vodja službe';

  // Helper to resolve leader email
  const resolveLeaderEmail = (): string | null => {
    if (!match || !assignment) return null;

    // 1. By leader ID
    if (assignment.assignedByLeaderId && people.length > 0) {
      const found = people.find(p => p && p.id === assignment.assignedByLeaderId);
      if (found?.email) return found.email;
    }

    // 2. By leader name
    if (assignment.assignedByLeaderName && people.length > 0) {
      const found = people.find(p => p && p.name && p.name.toLowerCase().trim() === assignment.assignedByLeaderName.toLowerCase().trim());
      if (found?.email) return found.email;
    }

    // 3. By ministry leader
    if (ministry?.leader && people.length > 0) {
      const found = people.find(p => p && p.name && p.name.toLowerCase().trim() === ministry.leader.toLowerCase().trim());
      if (found?.email) return found.email;
    }

    // 4. LocalStorage fallback
    try {
      const raw = localStorage.getItem('church_roster_people_v2');
      if (raw) {
        const localPeople: Person[] = JSON.parse(raw);
        const found = localPeople.find(p => 
          (assignment.assignedByLeaderName && p.name.toLowerCase() === assignment.assignedByLeaderName.toLowerCase()) ||
          (ministry?.leader && p.name.toLowerCase() === ministry.leader.toLowerCase())
        );
        if (found?.email) return found.email;
      }
    } catch (e) {}

    return null;
  };

  // Helper to notify leader via email & log in-app notification
  const notifyLeader = (action: 'confirmed' | 'declined', note?: string) => {
    if (!match || !assignment || !sunday) return;

    // In-app notification
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

    // Email dispatch to leader
    const leaderEmail = resolveLeaderEmail();
    if (leaderEmail) {
      sendLeaderResponseNotification({
        volunteerName: assignment.personName,
        leaderName,
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
    if (!match || processed || !token) return;

    if (initialAction === 'accept') {
      const res = updateAssignmentStatusByToken(sundays, token, 'confirmed', undefined, match);
      if (res) {
        onUpdateSunday(res.modifiedSunday);
        setCurrentStatus('confirmed');
        setProcessed(true);
        confirmAssignmentByToken(token, 'confirmed').catch(console.warn);
        if (!hasNotifiedLeaderRef.current) {
          hasNotifiedLeaderRef.current = true;
          notifyLeader('confirmed');
        }
      }
    } else if (initialAction === 'decline') {
      const res = updateAssignmentStatusByToken(sundays, token, 'declined', undefined, match);
      if (res) {
        onUpdateSunday(res.modifiedSunday);
        setCurrentStatus('declined');
        setProcessed(true);
        confirmAssignmentByToken(token, 'declined').catch(console.warn);
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
  }, [match, token, initialAction, processed]);

  const handleAccept = () => {
    if (!match) return;
    const res = updateAssignmentStatusByToken(sundays, token, 'confirmed', undefined, match);
    if (res) {
      onUpdateSunday(res.modifiedSunday);
      setCurrentStatus('confirmed');
      setProcessed(true);
      confirmAssignmentByToken(token, 'confirmed').catch(console.warn);
      notifyLeader('confirmed');
    }
  };

  const handleDecline = () => {
    if (!match) return;
    const res = updateAssignmentStatusByToken(sundays, token, 'declined', declineReasonInput, match);
    if (res) {
      onUpdateSunday(res.modifiedSunday);
      setCurrentStatus('declined');
      setProcessed(true);
      confirmAssignmentByToken(token, 'declined', declineReasonInput).catch(console.warn);
      notifyLeader('declined', declineReasonInput);
    }
  };

  const handleSaveDeclineNote = () => {
    if (!match) return;
    const res = updateAssignmentStatusByToken(sundays, token, 'declined', declineReasonInput, match);
    if (res) {
      onUpdateSunday(res.modifiedSunday);
      setNoteSaved(true);
      confirmAssignmentByToken(token, 'declined', declineReasonInput).catch(console.warn);
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
            <p className="text-xs text-slate-400 font-sans">Nalagamo vašo zadolžitev iz baze KC Kalvarija</p>
          </div>
        </div>
      </div>
    );
  }

  // State: Token invalid / not found
  if (!token || !match || !sunday || !assignment) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-150 text-center space-y-5 animate-scale-up">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-gray-900 font-display">Povezava ni veljavna ali je potekla</h2>
            <p className="text-xs text-gray-600 leading-relaxed">
              Zadolžitev za to potrditveno kodo morda ne obstaja več ali pa je bila že posodobljena v razporedu.
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
        
        {/* Card Header with Person Greeting & Leader Intro */}
        <div className="space-y-2 border-b border-gray-100 pb-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
              Povabilo k služenju
            </span>
            <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 ${
              currentStatus === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
              currentStatus === 'declined' ? 'bg-rose-100 text-rose-800' :
              'bg-amber-100 text-amber-800'
            }`}>
              {currentStatus === 'confirmed' ? '✓ Potrjeno' :
               currentStatus === 'declined' ? '✕ Zavrnjeno' :
               '⏳ Čaka na odziv'}
            </span>
          </div>

          <h2 className="text-xl font-bold text-gray-900 font-display">
            Pozdravljeni, {assignment.personName}!
          </h2>
          <p className="text-xs text-gray-600 leading-relaxed">
            Vodja službe <strong className="text-gray-900">{leaderName}</strong> vas vabi k sodelovanju pri službi <strong className="text-indigo-700">{ministryName}</strong>.
          </p>
        </div>

        {/* Highlighted Assignment Date & Role Card */}
        <div className="p-4 bg-gradient-to-r from-indigo-50/80 to-slate-50 rounded-2xl border border-indigo-100/80 space-y-1.5">
          <div className="flex items-center gap-2 text-indigo-950 font-bold text-base">
            <Calendar className="w-5 h-5 text-indigo-600 shrink-0" />
            <span>{formatToEuropeanDate(sunday.date)}</span>
          </div>
          <div className="text-xs font-semibold text-gray-700 pl-7 flex items-center gap-1.5">
            <span>Služba:</span>
            <span className="text-indigo-900 font-bold bg-white px-2 py-0.5 rounded-md border border-indigo-200">
              {ministryName}
            </span>
          </div>
          {sunday.themeSl && (
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
                Hvala za vašo pripravljenost in služenje! Zadolžitev je potrjena.
              </p>
              <p className="text-[11px] text-emerald-700">
                Vodja {leaderName} je obveščen o vaši potrditvi.
              </p>
            </div>

            {/* Calendar download & Google Calendar buttons */}
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider block text-center">
                DODAJ V SVOJ OSEBNI KOLEDAR:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <a
                  href={getGoogleCalendarAddUrl(sunday.date, ministryName, assignment.notes)}
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
                  onClick={() => downloadICS(sunday.date, ministryName, assignment.notes)}
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
                Termin je bil sproščen, da lahko vodja poišče nadomeščanje.
              </p>
            </div>

            {/* Optional note to leader */}
            <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200/80 space-y-2">
              <label className="block text-xs font-medium text-gray-700">
                Želite dodati kratko opombo za vodjo službe <strong>{leaderName}</strong>? <span className="text-gray-400 font-normal">(neobvezno)</span>
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
                Ste pomotoma zavrnili? Če vseeno želite sodelovati, kliknite tukaj za potrditev.
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
              <span>✅ Sprejmi zadolžitev</span>
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
          <span>Vodja: <strong>{leaderName}</strong></span>
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

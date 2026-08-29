/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useBackdropHistory } from '../hooks/useBackdropHistory';
import { 
  ServiceSunday, 
  SetlistSong, 
  RundownItem, 
  WorshipSong, 
  SasuSong, 
  Language, 
  Ministry, 
  Person,
  UserRole
} from '../types';
import { INITIAL_WORSHIP_SONGS } from '../data/worshipData';
import { SASU_ALL_SONGS } from '../data/sasuSongsData';
import { 
  getStoredGoogleChatWebhook,
  sendGoogleChatMessage,
  formatSetlistForGoogleChat,
  openFacebookMessenger
} from '../lib/messaging';
import { 
  X, 
  Music, 
  Clock, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  ExternalLink, 
  Youtube, 
  FileText, 
  Share2, 
  Send, 
  MessageSquare, 
  Sliders, 
  Search, 
  ListOrdered, 
  Sparkles, 
  ChevronUp, 
  ChevronDown, 
  Tv, 
  BookOpen, 
  User, 
  Volume2, 
  Calendar,
  Layers
} from 'lucide-react';

interface ServiceRundownModalProps {
  isOpen: boolean;
  onClose: () => void;
  sunday: ServiceSunday;
  currentLanguage: Language;
  onUpdateSunday: (updated: ServiceSunday) => void;
  ministries?: Ministry[];
  people?: Person[];
  userRole?: UserRole;
  canEdit?: boolean;
}

const COMMON_KEYS = ['C', 'C#m', 'D', 'Dm', 'Eb', 'E', 'Em', 'F', 'F#m', 'G', 'Gm', 'Ab', 'A', 'Am', 'Bb', 'B'];

const DEFAULT_RUNDOWN_PRESET: RundownItem[] = [
  { id: 'rd_1', time: '09:00', durationMinutes: 30, titleSl: 'Tonski preizkus in vaja banda', titleEn: 'Soundcheck & Band Rehearsal', leaderOrTeam: 'Worship Team & AV', type: 'soundcheck' },
  { id: 'rd_2', time: '09:30', durationMinutes: 15, titleSl: 'Molitev in priprava ekipe', titleEn: 'Team Prayer & Warmup', leaderOrTeam: 'Vodja slavljenja & Ekipa', type: 'welcome' },
  { id: 'rd_3', time: '10:00', durationMinutes: 5, titleSl: 'Dobrodošlica in uvodna molitev', titleEn: 'Welcome & Opening Prayer', leaderOrTeam: 'Voditelj / Obvestila', type: 'welcome' },
  { id: 'rd_4', time: '10:05', durationMinutes: 25, titleSl: 'Slavljenje (Pesmi)', titleEn: 'Worship Set', leaderOrTeam: 'Ekipa za slavljenje', type: 'worship' },
  { id: 'rd_5', time: '10:30', durationMinutes: 35, titleSl: 'Pridiga in božja beseda', titleEn: 'Sermon & Message', leaderOrTeam: 'Govornik / Pridigar', type: 'sermon' },
  { id: 'rd_6', time: '11:05', durationMinutes: 10, titleSl: 'Gospodova večerja / Nabirka & Obvestila', titleEn: 'Communion / Offering & News', leaderOrTeam: 'Voditelj', type: 'communion' },
  { id: 'rd_7', time: '11:15', durationMinutes: 30, titleSl: 'Druženje ob kavi in prigrizkih', titleEn: 'Fellowship & Coffee', leaderOrTeam: 'Gostoljubje', type: 'closing' },
];

export default function ServiceRundownModal({
  isOpen,
  onClose,
  sunday,
  currentLanguage,
  onUpdateSunday,
  ministries = [],
  people = [],
  userRole,
  canEdit: canEditProp
}: ServiceRundownModalProps) {
  useBackdropHistory(isOpen, onClose, 'service-rundown-modal');

  const canEdit = canEditProp !== undefined ? canEditProp : (userRole ? userRole !== 'Viewer' : true);

  const [activeTab, setActiveTab] = useState<'setlist' | 'rundown' | 'stageView'>('setlist');

  // Setlist State
  const [setlist, setSetlist] = useState<SetlistSong[]>(sunday.worshipSetlist || [
    {
      id: 'set_1',
      songId: 'song_1',
      titleSl: 'BITKA PRIPADA TI',
      titleEn: 'Battle belongs to you',
      key: 'G',
      bpm: 78,
      durationMinutes: 5,
      youtubeUrl: 'https://www.youtube.com/watch?v=johgSkNj3-A',
      docLink: 'https://docs.google.com/document/d/1wpO2yfXPpoivLaJFVdIvs00xlObJxevrQn4MKssOC9k/edit?usp=sharing',
      leadSinger: 'NinaČ',
      notes: 'Zacni z akustično kitaro, po 2. kitici stopi cel band'
    },
    {
      id: 'set_2',
      songId: 'sasu_2',
      titleSl: 'TISOČ RAZLOGOV (SLAVI BOGA)',
      titleEn: '10.000 reasons',
      key: 'D',
      bpm: 73,
      durationMinutes: 5,
      youtubeUrl: 'https://www.youtube.com/watch?v=r3K3roEF36k',
      docLink: 'https://docs.google.com/document/d/1YXjygOvndXjchJJBYQHTm0NjJVtR6TVuYab6X0LiRyA/edit',
      leadSinger: 'Bojan',
      notes: 'Pripravi prehod v C dur za refren'
    }
  ]);

  // Rundown State
  const [rundown, setRundown] = useState<RundownItem[]>(
    sunday.serviceRundown && sunday.serviceRundown.length > 0 
      ? sunday.serviceRundown 
      : DEFAULT_RUNDOWN_PRESET
  );

  // Song Picker State
  const [isSongPickerOpen, setIsSongPickerOpen] = useState(false);
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [selectedSongSource, setSelectedSongSource] = useState<'kalvarija' | 'sasu' | 'all'>('all');

  // Copy Feedback
  const [copiedBriefing, setCopiedBriefing] = useState(false);
  const [notifySuccess, setNotifySuccess] = useState(false);

  // Filter available songs for picker
  const filteredSongs = useMemo(() => {
    const q = songSearchQuery.toLowerCase().trim();

    let combined: { id: string; titleSl: string; titleEn?: string; youtubeUrl?: string; docLink?: string; source: string; number?: string; category?: WorshipSong['category'] }[] = [];

    if (selectedSongSource === 'all' || selectedSongSource === 'kalvarija') {
      INITIAL_WORSHIP_SONGS.forEach(s => {
        combined.push({
          id: s.id,
          titleSl: s.titleSl,
          titleEn: s.titleEn,
          youtubeUrl: s.youtubeUrl,
          docLink: s.docLink,
          source: 'Kalvarija',
          number: s.number,
          category: s.category
        });
      });
    }

    if (selectedSongSource === 'all' || selectedSongSource === 'sasu') {
      SASU_ALL_SONGS.forEach(s => {
        combined.push({
          id: s.id,
          titleSl: s.titleSl,
          titleEn: s.titleEn,
          youtubeUrl: s.webLink,
          docLink: s.docLink,
          source: 'SASU Songbook',
          number: s.number
        });
      });
    }

    if (!q) return combined.slice(0, 40); // show top 40 when query empty

    return combined.filter(s => 
      s.titleSl.toLowerCase().includes(q) || 
      (s.titleEn && s.titleEn.toLowerCase().includes(q)) ||
      (s.number && s.number.includes(q))
    ).slice(0, 50);
  }, [songSearchQuery, selectedSongSource]);

  // Total worship set time
  const totalWorshipDuration = useMemo(() => {
    return setlist.reduce((acc, curr) => acc + (Number(curr.durationMinutes) || 0), 0);
  }, [setlist]);

  // Total service duration
  const totalServiceDuration = useMemo(() => {
    return rundown.reduce((acc, curr) => acc + (Number(curr.durationMinutes) || 0), 0);
  }, [rundown]);

  // Add song from app to setlist
  const handleAddSongToSetlist = (songItem: { id: string; titleSl: string; titleEn?: string; youtubeUrl?: string; docLink?: string }) => {
    const newEntry: SetlistSong = {
      id: `set_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      songId: songItem.id,
      titleSl: songItem.titleSl,
      titleEn: songItem.titleEn || '',
      key: 'G',
      bpm: 120,
      durationMinutes: 4,
      youtubeUrl: songItem.youtubeUrl || '',
      docLink: songItem.docLink || '',
      leadSinger: '',
      notes: ''
    };

    setSetlist(prev => [...prev, newEntry]);
    setIsSongPickerOpen(false);
  };

  // Add custom song
  const handleAddCustomSong = () => {
    const newEntry: SetlistSong = {
      id: `set_${Date.now()}`,
      titleSl: currentLanguage === 'sl' ? 'Nova pesem' : 'New Song',
      titleEn: '',
      key: 'C',
      bpm: 100,
      durationMinutes: 4,
      youtubeUrl: '',
      docLink: '',
      leadSinger: '',
      notes: ''
    };
    setSetlist(prev => [...prev, newEntry]);
  };

  // Move song up/down
  const handleMoveSong = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === setlist.length - 1) return;

    const updated = [...setlist];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setSetlist(updated);
  };

  // Remove song
  const handleRemoveSong = (id: string) => {
    setSetlist(prev => prev.filter(s => s.id !== id));
  };

  // Update song field
  const handleUpdateSong = (id: string, field: keyof SetlistSong, value: any) => {
    setSetlist(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  // Rundown Management
  const handleAddRundownItem = () => {
    const lastItem = rundown[rundown.length - 1];
    let nextTime = '11:00';
    if (lastItem && lastItem.time) {
      const [h, m] = lastItem.time.split(':').map(Number);
      const totalM = (h * 60 + m) + (lastItem.durationMinutes || 15);
      const newH = Math.floor(totalM / 60) % 24;
      const newM = totalM % 60;
      nextTime = `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
    }

    const newItem: RundownItem = {
      id: `rd_${Date.now()}`,
      time: nextTime,
      durationMinutes: 15,
      titleSl: currentLanguage === 'sl' ? 'Nova točka programa' : 'New Agenda Item',
      titleEn: 'New Item',
      leaderOrTeam: '',
      type: 'other',
      notes: ''
    };
    setRundown(prev => [...prev, newItem]);
  };

  const handleUpdateRundownItem = (id: string, field: keyof RundownItem, value: any) => {
    setRundown(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleRemoveRundownItem = (id: string) => {
    setRundown(prev => prev.filter(r => r.id !== id));
  };

  const handleLoadDefaultPreset = () => {
    setRundown(DEFAULT_RUNDOWN_PRESET);
  };

  // Save changes to Sunday
  const handleSave = () => {
    const updatedSunday: ServiceSunday = {
      ...sunday,
      worshipSetlist: setlist,
      serviceRundown: rundown
    };
    onUpdateSunday(updatedSunday);
    onClose();
  };

  // Generate WhatsApp / Viber / Email copy text
  const generateBriefingText = () => {
    let text = `🎶 *BOGOSLUŽJE & SLAVILNI PROGRAM - KC KALVARIJA*\n`;
    text += `📅 *Datum:* ${sunday.date}\n`;
    if (sunday.themeSl) text += `📖 *Tema / Pridiga:* ${sunday.themeSl}\n`;
    text += `------------------------------------\n\n`;

    text += `🎵 *SLAVILNI SEZNAM (SETLISTA) [Skupaj: ~${totalWorshipDuration} min]:*\n`;
    if (setlist.length === 0) {
      text += `(Pesmi še niso izbrane)\n`;
    } else {
      setlist.forEach((s, idx) => {
        text += `${idx + 1}. *${s.titleSl}* ${s.key ? `[Key: ${s.key}]` : ''} ${s.bpm ? `(${s.bpm} BPM)` : ''} - ~${s.durationMinutes} min\n`;
        if (s.leadSinger) text += `   👤 Vodi: ${s.leadSinger}\n`;
        if (s.notes) text += `   📝 Opomba: ${s.notes}\n`;
        if (s.docLink) text += `   📄 Akordi / Note: ${s.docLink}\n`;
        if (s.youtubeUrl) text += `   ▶️ Posnetek: ${s.youtubeUrl}\n`;
      });
    }

    text += `\n⏱️ *URIKAR / POTOK BOGOSLUŽJA (RUNDOWN):*\n`;
    rundown.forEach((r) => {
      text += `• *${r.time}* (${r.durationMinutes} min) - ${r.titleSl} ${r.leaderOrTeam ? `[${r.leaderOrTeam}]` : ''}\n`;
    });

    text += `\n---\nSporočilo ustvarjeno v KC Kalvarija Aplikaciji`;
    return text;
  };

  const handleCopyBriefing = () => {
    const text = generateBriefingText();
    navigator.clipboard.writeText(text);
    setCopiedBriefing(true);
    setTimeout(() => setCopiedBriefing(false), 2500);
  };

  const handleNotifyTeam = () => {
    // Save state and show toast
    const updatedSunday: ServiceSunday = {
      ...sunday,
      worshipSetlist: setlist,
      serviceRundown: rundown
    };
    onUpdateSunday(updatedSunday);
    setNotifySuccess(true);
    setTimeout(() => setNotifySuccess(false), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-600/30 text-violet-300 border border-violet-500/30 rounded-xl">
              <Music className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {currentLanguage === 'sl' ? 'Program bogoslužja in pesmarica' : 'Service Rundown & Worship Songbook'}
                </h2>
                <span className="text-xs px-2 py-0.5 bg-violet-500/20 text-violet-300 rounded-full border border-violet-500/30 font-medium">
                  {sunday.date}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {sunday.themeSl ? `Tema: ${sunday.themeSl}` : (currentLanguage === 'sl' ? 'Uredi pesmi, akorde, ključe in urnik za ekipo' : 'Manage songs, keys, chords and timeline for team')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 pt-2.5 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab('setlist')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'setlist'
                ? 'bg-white text-violet-700 border-violet-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <Music className="w-4 h-4 text-violet-600" />
            <span>{currentLanguage === 'sl' ? 'Slavilni seznam (Pesmarica)' : 'Worship Setlist (Songbook)'}</span>
            <span className="ml-1 px-1.5 py-0.2 bg-violet-100 text-violet-700 text-[10px] rounded-full font-bold">
              {setlist.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('rundown')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'rundown'
                ? 'bg-white text-sky-700 border-sky-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <Clock className="w-4 h-4 text-sky-600" />
            <span>{currentLanguage === 'sl' ? 'Urnik bogoslužja (Rundown)' : 'Order of Service Timeline'}</span>
            <span className="ml-1 px-1.5 py-0.2 bg-sky-100 text-sky-700 text-[10px] rounded-full font-bold">
              ~{totalServiceDuration}m
            </span>
          </button>

          <button
            onClick={() => setActiveTab('stageView')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'stageView'
                ? 'bg-white text-amber-700 border-amber-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <Tv className="w-4 h-4 text-amber-600" />
            <span>{currentLanguage === 'sl' ? 'Oder & AV Mikser Prikaz' : 'Stage & AV Monitor View'}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50">

          {/* TAB 1: WORSHIP SETLIST & ATTACHED SONGBOOK */}
          {activeTab === 'setlist' && (
            <div className="space-y-4">
              
              {/* Summary & Action Bar */}
              <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-700 shrink-0">
                    <Music className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      {currentLanguage === 'sl' ? 'Pripravljene pesmi za nedeljo' : 'Prepared Songs for Sunday'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {currentLanguage === 'sl' 
                        ? `Skupni čas predvajanja: ~${totalWorshipDuration} minut (${setlist.length} pesmi v pesmarici)` 
                        : `Total playtime: ~${totalWorshipDuration} minutes (${setlist.length} songs attached)`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsSongPickerOpen(true)}
                    className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{currentLanguage === 'sl' ? 'Dodaj pesem iz pesmarice appa' : 'Attach Song from App'}</span>
                  </button>

                  <button
                    onClick={handleAddCustomSong}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{currentLanguage === 'sl' ? 'Ročni vnos' : 'Custom'}</span>
                  </button>
                </div>
              </div>

              {/* SONG PICKER DRAWER / MODAL INLINE */}
              {isSongPickerOpen && (
                <div className="bg-white p-4 rounded-xl border-2 border-violet-400 shadow-lg animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-violet-600" />
                      <h4 className="text-sm font-bold text-slate-800">
                        {currentLanguage === 'sl' ? 'Izberi pesem iz baze (150+ pesmi v appu)' : 'Select song from app database (150+ songs)'}
                      </h4>
                    </div>
                    <button 
                      onClick={() => setIsSongPickerOpen(false)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Search and Filters */}
                  <div className="flex flex-col sm:flex-row items-center gap-2 mb-3">
                    <div className="relative flex-1 w-full">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={songSearchQuery}
                        onChange={(e) => setSongSearchQuery(e.target.value)}
                        placeholder={currentLanguage === 'sl' ? 'Išči po naslovu ali številki pesmi...' : 'Search by song title or number...'}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>

                    <div className="flex items-center gap-1 shrink-0 w-full sm:w-auto">
                      <button
                        onClick={() => setSelectedSongSource('all')}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md cursor-pointer transition ${
                          selectedSongSource === 'all' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Vse ({INITIAL_WORSHIP_SONGS.length + SASU_ALL_SONGS.length})
                      </button>
                      <button
                        onClick={() => setSelectedSongSource('kalvarija')}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md cursor-pointer transition ${
                          selectedSongSource === 'kalvarija' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Kalvarija ({INITIAL_WORSHIP_SONGS.length})
                      </button>
                      <button
                        onClick={() => setSelectedSongSource('sasu')}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md cursor-pointer transition ${
                          selectedSongSource === 'sasu' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        SASU ({SASU_ALL_SONGS.length})
                      </button>
                    </div>
                  </div>

                  {/* Song List Results */}
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                    {filteredSongs.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">
                        {currentLanguage === 'sl' ? 'Ni najdenih pesmi za ta vnos' : 'No songs found'}
                      </div>
                    ) : (
                      filteredSongs.map((s) => (
                        <div key={s.id} className={`p-2.5 hover:bg-violet-50/60 transition flex items-center justify-between gap-2 ${
                          s.category === 'favorite' ? 'bg-amber-50/40' : s.category === 'great' ? 'bg-yellow-50/40' : s.category === 'kids' ? 'bg-emerald-50/40' : s.category === 'christmas' ? 'bg-sky-50/40' : ''
                        }`}>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {s.number && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-white text-slate-700 rounded border border-slate-200 shrink-0">
                                  #{s.number}
                                </span>
                              )}
                              <p className="text-xs font-bold text-slate-800 truncate">{s.titleSl}</p>
                              {s.category === 'favorite' && (
                                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-200 text-amber-950 font-bold">
                                  ⭐ Priljubljena
                                </span>
                              )}
                              {s.category === 'great' && (
                                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-yellow-100 text-yellow-900 font-medium">
                                  👍 Odlična
                                </span>
                              )}
                              {s.category === 'kids' && (
                                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-100 text-emerald-900 font-medium">
                                  👶 Otroška
                                </span>
                              )}
                              {s.category === 'christmas' && (
                                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-sky-100 text-sky-900 font-medium">
                                  🎄 Božična
                                </span>
                              )}
                              {s.titleEn && (
                                <span className="text-[10px] text-slate-500 truncate">({s.titleEn})</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-400">
                              <span className="text-violet-600 font-medium">{s.source}</span>
                              {s.youtubeUrl && <span className="text-red-500">YouTube Video</span>}
                              {s.docLink && <span className="text-blue-500">Akordi Doc</span>}
                            </div>
                          </div>

                          <button
                            onClick={() => handleAddSongToSetlist(s)}
                            className="px-2.5 py-1 bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-semibold rounded-md shadow-sm transition shrink-0 cursor-pointer flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>{currentLanguage === 'sl' ? 'Dodaj' : 'Add'}</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* SETLIST ITEMS LIST */}
              {setlist.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300">
                  <Music className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-600">
                    {currentLanguage === 'sl' ? 'Še ni dodanih pesmi v slavilni seznam za to nedeljo.' : 'No worship songs attached yet.'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 mb-3">
                    {currentLanguage === 'sl' ? 'Uporabi gumb "Dodaj pesem iz pesmarice appa" zgoraj.' : 'Click "Attach Song from App" above to build the setlist.'}
                  </p>
                  <button
                    onClick={() => setIsSongPickerOpen(true)}
                    className="px-3.5 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg shadow-sm hover:bg-violet-700 cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{currentLanguage === 'sl' ? 'Opremi nedeljo s pesmimi' : 'Pick Songs Now'}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {setlist.map((song, index) => (
                    <div key={song.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 sm:p-4 hover:border-violet-300 transition group">
                      
                      {/* Song Top Line */}
                      <div className="flex items-start justify-between gap-3 mb-3 pb-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-violet-100 text-violet-800 text-xs font-black flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          
                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              value={song.titleSl}
                              onChange={(e) => handleUpdateSong(song.id, 'titleSl', e.target.value)}
                              placeholder={currentLanguage === 'sl' ? 'Naslov pesmi (SL)' : 'Song Title'}
                              className="text-sm font-bold text-slate-800 w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-violet-500 focus:bg-slate-50 focus:outline-none px-1 py-0.5 rounded"
                            />
                          </div>
                        </div>

                        {/* Order & Remove Controls */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleMoveSong(index, 'up')}
                            disabled={index === 0}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100 cursor-pointer"
                            title="Move Up"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleMoveSong(index, 'down')}
                            disabled={index === setlist.length - 1}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100 cursor-pointer"
                            title="Move Down"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveSong(song.id)}
                            className="p-1 text-red-400 hover:text-red-600 rounded hover:bg-red-50 cursor-pointer ml-1"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Musical Parameters Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
                        
                        {/* Key Transpose */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            {currentLanguage === 'sl' ? 'Tonaliteta (Key)' : 'Key Signature'}
                          </label>
                          <select
                            value={song.key || 'C'}
                            onChange={(e) => handleUpdateSong(song.id, 'key', e.target.value)}
                            className="w-full text-xs font-bold text-slate-800 bg-amber-50/60 border border-amber-200 rounded-lg p-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          >
                            {COMMON_KEYS.map(k => (
                              <option key={k} value={k}>Key of {k}</option>
                            ))}
                          </select>
                        </div>

                        {/* Tempo / BPM */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Tempo (BPM)
                          </label>
                          <input
                            type="number"
                            value={song.bpm || 100}
                            onChange={(e) => handleUpdateSong(song.id, 'bpm', parseInt(e.target.value) || 0)}
                            className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </div>

                        {/* Playtime Duration */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            {currentLanguage === 'sl' ? 'Čas (minut)' : 'Playtime (min)'}
                          </label>
                          <input
                            type="number"
                            value={song.durationMinutes || 4}
                            onChange={(e) => handleUpdateSong(song.id, 'durationMinutes', parseInt(e.target.value) || 1)}
                            className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </div>

                        {/* Lead Vocalist */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            {currentLanguage === 'sl' ? 'Vodilni vokal' : 'Lead Singer'}
                          </label>
                          <input
                            type="text"
                            value={song.leadSinger || ''}
                            onChange={(e) => handleUpdateSong(song.id, 'leadSinger', e.target.value)}
                            placeholder="e.g. NinaČ"
                            className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </div>
                      </div>

                      {/* Links & Arrangement Notes */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                        <div>
                          <label className="text-[10px] font-medium text-slate-400 block mb-1">
                            {currentLanguage === 'sl' ? 'Povezava na akorde / note (Google Doc / Drive)' : 'Chord Sheet Doc Link'}
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={song.docLink || ''}
                              onChange={(e) => handleUpdateSong(song.id, 'docLink', e.target.value)}
                              placeholder="https://docs.google.com/..."
                              className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-1.5 flex-1 focus:outline-none focus:ring-1 focus:ring-violet-500"
                            />
                            {song.docLink && (
                              <a
                                href={song.docLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition shrink-0"
                                title="Open Chords Doc"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-medium text-slate-400 block mb-1">
                            {currentLanguage === 'sl' ? 'Povezava na YouTube / Posnetek' : 'YouTube Link'}
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={song.youtubeUrl || ''}
                              onChange={(e) => handleUpdateSong(song.id, 'youtubeUrl', e.target.value)}
                              placeholder="https://youtube.com/watch?v=..."
                              className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-1.5 flex-1 focus:outline-none focus:ring-1 focus:ring-violet-500"
                            />
                            {song.youtubeUrl && (
                              <a
                                href={song.youtubeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition shrink-0"
                                title="Watch YouTube Video"
                              >
                                <Youtube className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Arrangement Notes */}
                        <div className="sm:col-span-2">
                          <input
                            type="text"
                            value={song.notes || ''}
                            onChange={(e) => handleUpdateSong(song.id, 'notes', e.target.value)}
                            placeholder={currentLanguage === 'sl' ? 'Navodila za izvedbo (npr. uvod akustika, modulacija v refrenu)...' : 'Arrangement instructions (e.g., quiet intro, key change)...'}
                            className="w-full text-xs italic text-slate-600 bg-slate-50/70 border border-slate-200 rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
                          />
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ORDER OF SERVICE TIMELINE (RUNDOWN) */}
          {activeTab === 'rundown' && (
            <div className="space-y-4">
              
              {/* Header Bar */}
              <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700 shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      {currentLanguage === 'sl' ? 'Potek bogoslužja minuta-za-minuto' : 'Minute-by-Minute Service Timeline'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {currentLanguage === 'sl' 
                        ? `Skupno trajanje celotnega programa: ~${totalServiceDuration} minut` 
                        : `Total service timeline duration: ~${totalServiceDuration} minutes`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleLoadDefaultPreset}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>{currentLanguage === 'sl' ? 'Naloži standardni urnik Kalvarije' : 'Load Standard Preset'}</span>
                  </button>

                  <button
                    onClick={handleAddRundownItem}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{currentLanguage === 'sl' ? 'Dodaj točko' : 'Add Agenda Item'}</span>
                  </button>
                </div>
              </div>

              {/* RUNDOWN TIMELINE LIST */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
                {rundown.map((item, index) => (
                  <div key={item.id} className="p-3 sm:p-4 hover:bg-slate-50/80 transition flex flex-col sm:flex-row sm:items-center gap-3">
                    
                    {/* Time & Duration */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="text"
                          value={item.time}
                          onChange={(e) => handleUpdateRundownItem(item.id, 'time', e.target.value)}
                          className="w-16 text-xs font-bold text-slate-900 bg-sky-50/80 border border-sky-200 rounded-md p-1 text-center focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={item.durationMinutes}
                          onChange={(e) => handleUpdateRundownItem(item.id, 'durationMinutes', parseInt(e.target.value) || 5)}
                          className="w-12 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-md p-1 text-center focus:outline-none"
                        />
                        <span className="text-[10px] font-medium text-slate-400">min</span>
                      </div>
                    </div>

                    {/* Title & Responsible Leader */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={item.titleSl}
                        onChange={(e) => handleUpdateRundownItem(item.id, 'titleSl', e.target.value)}
                        placeholder={currentLanguage === 'sl' ? 'Naziv točke (npr. Slavljenje, Pridiga)' : 'Title'}
                        className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-md p-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />

                      <input
                        type="text"
                        value={item.leaderOrTeam || ''}
                        onChange={(e) => handleUpdateRundownItem(item.id, 'leaderOrTeam', e.target.value)}
                        placeholder={currentLanguage === 'sl' ? 'Odgovorna oseba / ekipa' : 'Responsible person/team'}
                        className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md p-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>

                    {/* Remove Action */}
                    <button
                      onClick={() => handleRemoveRundownItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition self-end sm:self-center cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: STAGE & AV MONITOR VIEW */}
          {activeTab === 'stageView' && (
            <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-xl border border-slate-800 space-y-6">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400 bg-amber-950/60 px-2.5 py-1 rounded-md border border-amber-800/60">
                    {currentLanguage === 'sl' ? 'Oder & AV Tehnični zaslon' : 'Stage & AV Technical Monitor'}
                  </span>
                  <h3 className="text-xl font-black text-white mt-2 tracking-tight">
                    KC Kalvarija • {sunday.date}
                  </h3>
                  {sunday.themeSl && (
                    <p className="text-xs text-slate-400 mt-0.5">Tema: {sunday.themeSl}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Google Chat Button (Leaders & Serving) */}
                  <button
                    onClick={async () => {
                      const webhookUrl = getStoredGoogleChatWebhook();
                      const msg = formatSetlistForGoogleChat(sunday.date, sunday.themeSl, setlist, rundown, currentLanguage);
                      if (webhookUrl) {
                        const res = await sendGoogleChatMessage(msg, webhookUrl);
                        if (res.success) {
                          alert(currentLanguage === 'sl' ? '✓ Uspešno poslano v Google Chat prostor!' : '✓ Posted to Google Chat Space!');
                        } else {
                          navigator.clipboard.writeText(msg);
                          alert(currentLanguage === 'sl' ? '📋 Kopirano za Google Chat! (Dodajte Webhook URL v obvestilih)' : '📋 Copied for Google Chat!');
                        }
                      } else {
                        navigator.clipboard.writeText(msg);
                        alert(currentLanguage === 'sl' ? '📋 Kopirano za Google Chat! (Če želite avtomatsko pošiljanje, nastavite Google Chat Webhook URL v obvestilih)' : '📋 Copied for Google Chat!');
                      }
                    }}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md cursor-pointer"
                    title="Google Chat za voditelje in služabnike"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Google Chat</span>
                  </button>

                  {/* Facebook Messenger Button (Public / Members) */}
                  <button
                    onClick={() => {
                      const text = generateBriefingText();
                      openFacebookMessenger('kc.kalvarija', text);
                    }}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md cursor-pointer"
                    title="Facebook Messenger za javna sporočila"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>FB Messenger</span>
                  </button>

                  {/* Copy Button */}
                  <button
                    onClick={handleCopyBriefing}
                    className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md cursor-pointer"
                  >
                    {copiedBriefing ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedBriefing ? (currentLanguage === 'sl' ? 'Kopirano!' : 'Copied!') : (currentLanguage === 'sl' ? 'Kopiraj' : 'Copy')}</span>
                  </button>
                </div>
              </div>

              {/* Worship Songs Grid */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <Music className="w-4 h-4 text-amber-400" />
                  <span>{currentLanguage === 'sl' ? 'Slavilne pesmi & Akordi' : 'Worship Set & Key Signatures'}</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {setlist.map((song, i) => (
                    <div key={song.id} className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-xs font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            #{i + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-200 bg-slate-700/80 px-2.5 py-0.5 rounded-full border border-slate-600">
                            KEY: {song.key || 'C'}
                          </span>
                        </div>

                        <h5 className="text-sm font-bold text-white tracking-tight">{song.titleSl}</h5>
                        {song.titleEn && <p className="text-xs text-slate-400 mt-0.5">{song.titleEn}</p>}
                        
                        {song.leadSinger && userRole !== 'Viewer' && (
                          <p className="text-xs text-violet-300 font-medium mt-1.5 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>Vokal: {song.leadSinger}</span>
                          </p>
                        )}

                        {song.notes && (
                          <p className="text-xs text-slate-300 italic mt-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                            "{song.notes}"
                          </p>
                        )}
                      </div>

                      {/* Links */}
                      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-700/60">
                        {song.docLink && (
                          <a
                            href={song.docLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-semibold hover:bg-blue-600/50 transition flex items-center gap-1"
                          >
                            <FileText className="w-3 h-3" />
                            <span>Akordi</span>
                          </a>
                        )}
                        {song.youtubeUrl && (
                          <a
                            href={song.youtubeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-red-600/30 text-red-300 border border-red-500/30 rounded-lg text-xs font-semibold hover:bg-red-600/50 transition flex items-center gap-1"
                          >
                            <Youtube className="w-3 h-3" />
                            <span>YouTube</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Compact Rundown Timeline */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-400" />
                  <span>{currentLanguage === 'sl' ? 'Potek bogoslužja (Rundown)' : 'Timeline Schedule'}</span>
                </h4>

                <div className="bg-slate-800/80 rounded-xl border border-slate-700/80 divide-y divide-slate-700/60">
                  {rundown.map((r) => (
                    <div key={r.id} className="p-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-sky-300 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800/60">
                          {r.time}
                        </span>
                        <span className="font-bold text-slate-200">{r.titleSl}</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-400">
                        <span>{r.leaderOrTeam}</span>
                        <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400">{r.durationMinutes}m</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer / Action Bar */}
        <div className="bg-white p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyBriefing}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 border border-slate-300 cursor-pointer"
            >
              {copiedBriefing ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
              <span>{copiedBriefing ? (currentLanguage === 'sl' ? 'Kopirano v odložišče!' : 'Copied!') : (currentLanguage === 'sl' ? 'Kopiraj celoten program' : 'Copy Briefing')}</span>
            </button>

            {canEdit && (
              <button
                onClick={handleNotifyTeam}
                className="px-3.5 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 border border-violet-200 cursor-pointer"
              >
                {notifySuccess ? <Check className="w-4 h-4 text-emerald-600" /> : <Send className="w-4 h-4 text-violet-600" />}
                <span>{notifySuccess ? (currentLanguage === 'sl' ? 'Shranjeno & Obveščeno!' : 'Notified!') : (currentLanguage === 'sl' ? 'Shrani & Obvesti ekipo' : 'Notify Team')}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canEdit ? (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer"
                >
                  {currentLanguage === 'sl' ? 'Prekliči' : 'Cancel'}
                </button>

                <button
                  onClick={handleSave}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{currentLanguage === 'sl' ? 'Shrani spremembe' : 'Save & Close'}</span>
                </button>
              </>
            ) : (
              <button
                onClick={onClose}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
              >
                {currentLanguage === 'sl' ? 'Zapri' : 'Close'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

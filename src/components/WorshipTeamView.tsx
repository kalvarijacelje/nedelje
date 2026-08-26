import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  WorshipRosterEntry, 
  WorshipSong, 
  WorshipContact, 
  StageSetupChecklist, 
  ArchivedSong, 
  UserRole, 
  Language, 
  Translation, 
  ServiceSunday,
  Person,
  SasuSong,
  canAccessPersonalData
} from '../types';
import { 
  INITIAL_WORSHIP_ROSTER, 
  INITIAL_WORSHIP_SONGS, 
  INITIAL_ARCHIVED_SONGS, 
  INITIAL_WORSHIP_CONTACTS, 
  INITIAL_SETUP_STEPS, 
  INITIAL_TEARDOWN_STEPS 
} from '../data/worshipData';
import { INITIAL_PEOPLE } from '../data/initialData';
import { matchWorshipRosterEntry, syncSundayFromWorshipRosterEntry } from '../utils/worshipSync';
import { SASU_ALL_SONGS, SASU_GOOGLE_SHEETS_URL } from '../data/sasuSongsData';
import { 
  Music, 
  Plus, 
  Search, 
  SlidersHorizontal, 
  Volume2, 
  FileText,
  UserCheck, 
  Sparkles, 
  ChevronDown, 
  ChevronUp,
  Filter,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Table,
  ArrowLeftRight,
  BookOpen,
  Globe,
  Sliders,
  Phone,
  Archive,
  Calendar,
  Youtube,
  FileSpreadsheet,
  ExternalLink,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Edit,
  Pencil,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  BarChart3,
  History,
  X
} from 'lucide-react';
import HeroHeaderBanner from './HeroHeaderBanner';
import { useBackdropHistory } from '../hooks/useBackdropHistory';

interface WorshipTeamViewProps {
  userRole: UserRole;
  currentLanguage: Language;
  translations: Translation;
  worshipRoster?: WorshipRosterEntry[];
  onUpdateWorshipRoster?: (updatedRoster: WorshipRosterEntry[]) => void;
  sundays?: ServiceSunday[];
  people?: Person[];
  onUpdateSunday?: (updatedSunday: ServiceSunday) => void;
  onSelectSunday?: (id: string) => void;
}

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

const academicYear2627Start = new Date(2026, 8, 1);  // Sep 1, 2026 (first Sunday: Sep 6, 2026)
const academicYear2627End = new Date(2027, 7, 31);   // Aug 31, 2027

export const getCategoryBadge = (category?: WorshipSong['category'], lang: 'sl' | 'en' = 'sl') => {
  switch (category) {
    case 'favorite':
      return {
        label: lang === 'sl' ? '⭐ Glavni repertoar' : '⭐ Core Repertoire',
        shortLabel: lang === 'sl' ? '⭐ Glavna' : '⭐ Core',
        codePrefix: 'W',
        badgeClass: 'bg-amber-200 text-amber-950 border border-amber-300 font-bold',
        numBadgeClass: 'bg-amber-50 text-amber-900 border border-amber-300 font-bold font-mono',
        rowClass: 'bg-amber-100/70 hover:bg-amber-100/90 text-amber-950',
        cardClass: 'bg-amber-50/90 hover:bg-amber-100/70 border-amber-300/80 ring-1 ring-amber-200/60',
        cardAccent: 'border-l-4 border-l-amber-500',
        icon: '⭐'
      };
    case 'great':
      return {
        label: lang === 'sl' ? '👍 Standardno slavljenje' : '👍 Standard Worship',
        shortLabel: lang === 'sl' ? '👍 Standard' : '👍 Standard',
        codePrefix: 'W',
        badgeClass: 'bg-yellow-100 text-yellow-900 border border-yellow-300 font-semibold',
        numBadgeClass: 'bg-yellow-50 text-yellow-900 border border-yellow-300 font-bold font-mono',
        rowClass: 'bg-yellow-50/80 hover:bg-yellow-100/80 text-yellow-950',
        cardClass: 'bg-yellow-50/70 hover:bg-yellow-50 border-yellow-200 ring-1 ring-yellow-100',
        cardAccent: 'border-l-4 border-l-yellow-400',
        icon: '👍'
      };
    case 'kids':
      return {
        label: lang === 'sl' ? '👶 Otroška pesem' : '👶 Kids Song',
        shortLabel: lang === 'sl' ? '👶 Otroška' : '👶 Kids',
        codePrefix: 'K',
        badgeClass: 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-semibold',
        numBadgeClass: 'bg-emerald-50 text-emerald-900 border border-emerald-300 font-bold font-mono',
        rowClass: 'bg-emerald-50/80 hover:bg-emerald-100/80 text-emerald-950',
        cardClass: 'bg-emerald-50/70 hover:bg-emerald-50 border-emerald-200 ring-1 ring-emerald-100',
        cardAccent: 'border-l-4 border-l-emerald-500',
        icon: '👶'
      };
    case 'christmas':
      return {
        label: lang === 'sl' ? '🎄 Božična / Praznična' : '🎄 Christmas / Seasonal',
        shortLabel: lang === 'sl' ? '🎄 Božična' : '🎄 Christmas',
        codePrefix: 'B',
        badgeClass: 'bg-sky-100 text-sky-900 border border-sky-300 font-semibold',
        numBadgeClass: 'bg-sky-50 text-sky-900 border border-sky-300 font-bold font-mono',
        rowClass: 'bg-sky-50/80 hover:bg-sky-100/80 text-sky-950',
        cardClass: 'bg-sky-50/70 hover:bg-sky-50 border-sky-200 ring-1 ring-sky-100',
        cardAccent: 'border-l-4 border-l-sky-500',
        icon: '🎄'
      };
    default:
      return {
        label: lang === 'sl' ? '✨ Nove pesmi' : '✨ New Songs',
        shortLabel: lang === 'sl' ? '✨ Nova' : '✨ New',
        codePrefix: 'W',
        badgeClass: 'bg-purple-100 text-purple-900 border border-purple-300 font-semibold',
        numBadgeClass: 'bg-purple-50 text-purple-900 border border-purple-300 font-bold font-mono',
        rowClass: 'bg-purple-50/40 hover:bg-purple-100/60 text-purple-950',
        cardClass: 'bg-purple-50/50 hover:bg-purple-50 border-purple-200 ring-1 ring-purple-100',
        cardAccent: 'border-l-4 border-l-purple-500',
        icon: '✨'
      };
  }
};

export const getTimesSungBadge = (count: number, lang: 'sl' | 'en' = 'sl') => {
  if (count === 0) {
    return {
      className: 'bg-slate-100/80 text-slate-400 border border-slate-200/70 font-normal',
      label: '0×',
      tierName: lang === 'sl' ? 'Neizvedena v tem obdobju (0×)' : 'Not sung in this period (0×)'
    };
  }
  if (count === 1) {
    return {
      className: 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold shadow-2xs',
      label: '1×',
      tierName: lang === 'sl' ? 'Enkrat izvedena (1×)' : 'Sung once (1×)'
    };
  }
  if (count >= 2 && count <= 3) {
    return {
      className: 'bg-amber-100 text-amber-950 border border-amber-300 font-bold shadow-2xs',
      label: `${count}×`,
      tierName: lang === 'sl' ? `Zmerna rotacija (${count}×)` : `Moderate rotation (${count}×)`
    };
  }
  if (count >= 4 && count <= 7) {
    return {
      className: 'bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold shadow-2xs',
      label: `${count}×`,
      tierName: lang === 'sl' ? `Glavna rotacija (${count}×)` : `Core rotation (${count}×)`
    };
  }
  // 8+ times (Top anthems)
  return {
    className: 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-950 border border-orange-400 font-black shadow-2xs ring-1 ring-orange-300',
    label: `🔥 ${count}×`,
    tierName: lang === 'sl' ? `Top uspešnica / Največkrat zapeta (${count}×)` : `Top Anthem / Heavy rotation (${count}×)`
  };
};

export default function WorshipTeamView({
  userRole,
  currentLanguage,
  translations,
  worshipRoster,
  onUpdateWorshipRoster,
  sundays,
  people = [],
  onUpdateSunday,
  onSelectSunday
}: WorshipTeamViewProps) {
  // Active sub-tab state (Default to Sunday Schedule 'roster')
  const [activeSubTab, setActiveSubTab] = useState<'roster' | 'songs' | 'sasu' | 'sound' | 'archive'>('roster');
  const [rosterYearView, setRosterYearView] = useState<'2026_2027' | '2025_2026'>('2026_2027');

  // Sub-nav scroll ref & handler
  const navRef = useRef<HTMLDivElement>(null);
  const scrollNav = (direction: 'left' | 'right') => {
    if (navRef.current) {
      navRef.current.scrollBy({
        left: direction === 'left' ? -220 : 220,
        behavior: 'smooth'
      });
    }
  };

  // Table scroll refs & handlers
  const songsTableRef = useRef<HTMLDivElement>(null);
  const sasuTableRef = useRef<HTMLDivElement>(null);
  const rosterTableRef = useRef<HTMLDivElement>(null);

  const scrollTable = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
    if (ref.current) {
      ref.current.scrollBy({
        left: direction === 'left' ? -280 : 280,
        behavior: 'smooth'
      });
    }
  };

  // Mouse drag-to-scroll state & handlers for desktop mouse dragging
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const activeTableRef = useRef<HTMLDivElement | null>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return;
    const target = e.target as HTMLElement;
    if (target.closest('a, button, input, select, textarea')) return;

    isDraggingRef.current = true;
    activeTableRef.current = ref.current;
    startXRef.current = e.pageX - ref.current.offsetLeft;
    scrollLeftRef.current = ref.current.scrollLeft;
    ref.current.style.cursor = 'grabbing';
    ref.current.style.userSelect = 'none';
  };

  const handleMouseUpOrLeave = (ref: React.RefObject<HTMLDivElement | null>) => {
    isDraggingRef.current = false;
    if (ref.current) {
      ref.current.style.cursor = 'grab';
      ref.current.style.removeProperty('user-select');
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>, ref: React.RefObject<HTMLDivElement | null>) => {
    if (!isDraggingRef.current || !ref.current || activeTableRef.current !== ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    ref.current.scrollLeft = scrollLeftRef.current - walk;
  };

  // View modes - defaults to 'table' (Table view) with automatic phone view support
  const [songViewMode, setSongViewMode] = useState<'table' | 'cards'>(() => {
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 768;
      if (isMobile) return 'table';
      const saved = localStorage.getItem('worship_song_view_mode');
      if (saved === 'table' || saved === 'cards') return saved;
    }
    return 'table';
  });

  const handleSetSongViewMode = (mode: 'table' | 'cards') => {
    setSongViewMode(mode);
    try {
      localStorage.setItem('worship_song_view_mode', mode);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSongViewMode('table');
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [rosterViewMode, setRosterViewMode] = useState<'cards' | 'table'>('cards');
  const [sasuViewMode, setSasuViewMode] = useState<'table' | 'cards'>('table');

  // Academic Year / Period Mode for Song Times Sung
  const [songYearMode, setSongYearMode] = useState<'2026/2027' | '2025/2026' | 'all'>('2026/2027');

  // Songbook Sorting States
  const [sortField, setSortField] = useState<'number' | 'titleSl' | 'titleEn' | 'timesSung'>('number');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Search & Filter States
  const [songSearch, setSongSearch] = useState('');
  const [songCategoryFilter, setSongCategoryFilter] = useState<'all' | 'favorite' | 'great' | 'kids' | 'christmas' | 'standard'>('all');
  const [rosterSearch, setRosterSearch] = useState('');
  const [archiveSearch, setArchiveSearch] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [selectedLeaderFilter, setSelectedLeaderFilter] = useState<string>('all');

  // Archive Tab View Mode (Historical 2025/26 stats vs Retired songs)
  const [archiveTabMode, setArchiveTabMode] = useState<'historical_times' | 'retired_songs'>('historical_times');
  const [archiveSortField, setArchiveSortField] = useState<'number' | 'titleSl' | 'titleEn' | 'timesSung'>('timesSung');
  const [archiveSortDirection, setArchiveSortDirection] = useState<'asc' | 'desc'>('desc');

  // SASU Search & Filter States
  const [sasuSearch, setSasuSearch] = useState('');
  const [sasuOnlyKalvarija, setSasuOnlyKalvarija] = useState(false);
  const [sasuDisplayLimit, setSasuDisplayLimit] = useState(100);

  // Natural comparison for hybrid song numbers (W-1, W-2... W-10, K-1, B-1)
  const compareSongNumbers = (numA: string, numB: string): number => {
    const parse = (val: string) => {
      const match = (val || '').trim().match(/^([a-zA-Z]+)-?(\d+)$/);
      if (match) {
        return { prefix: match[1].toUpperCase(), num: parseInt(match[2], 10) };
      }
      const pureNum = parseInt(val, 10);
      if (!isNaN(pureNum)) {
        return { prefix: 'W', num: pureNum };
      }
      return { prefix: val || '', num: 0 };
    };

    const a = parse(numA);
    const b = parse(numB);

    const prefixOrder: Record<string, number> = { W: 1, K: 2, B: 3, NEW: 4 };
    const orderA = prefixOrder[a.prefix] || 99;
    const orderB = prefixOrder[b.prefix] || 99;

    if (orderA !== orderB) {
      return orderA - orderB;
    }
    if (a.prefix !== b.prefix) {
      return a.prefix.localeCompare(b.prefix);
    }
    return a.num - b.num;
  };

  // Helper to compute next available prefix number for a category
  const getNextSuggestedSongNumber = React.useCallback((cat: WorshipSong['category'], songList: WorshipSong[]) => {
    let prefix = 'W';
    if (cat === 'kids') prefix = 'K';
    if (cat === 'christmas') prefix = 'B';

    let maxNum = 0;
    songList.forEach(s => {
      const numStr = s.number || '';
      const match = numStr.match(/^([a-zA-Z]+)-?(\d+)$/);
      if (match && match[1].toUpperCase() === prefix) {
        const n = parseInt(match[2], 10);
        if (n > maxNum) maxNum = n;
      }
    });

    return `${prefix}-${maxNum + 1}`;
  }, []);

  // Data states (persisted with localStorage, auto-migrated with prefixes)
  const [songs, setSongs] = useState<WorshipSong[]>(() => {
    try {
      const saved = localStorage.getItem('kck_worship_songs_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasPrefixes = parsed.some(s => s.number && s.number.includes('-'));
          if (hasPrefixes) {
            return parsed.filter(s => {
              const t = (s.titleSl || '').trim().toUpperCase();
              return t !== 'OTROŠKA PESMARICA' && t !== 'RR PESMARICA';
            });
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load songs from storage', e);
    }
    return INITIAL_WORSHIP_SONGS;
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('kck_worship_songs_v1', JSON.stringify(songs));
    } catch (e) {
      console.warn('Failed to save songs to storage', e);
    }
  }, [songs]);

  const activeRoster = worshipRoster || INITIAL_WORSHIP_ROSTER;
  const [editingRosterEntry, setEditingRosterEntry] = useState<WorshipRosterEntry | null>(null);

  // Edit Song Modal State
  const [editingSong, setEditingSong] = useState<WorshipSong | null>(null);

  // Full Roster combined with all Sunday dates from the main schedule
  const combinedRoster = useMemo(() => {
    const baseList = (worshipRoster && worshipRoster.length > 0) ? worshipRoster : INITIAL_WORSHIP_ROSTER;
    if (!sundays || sundays.length === 0) {
      return baseList;
    }

    const result: WorshipRosterEntry[] = [...baseList];

    sundays.forEach((sunday) => {
      const match = matchWorshipRosterEntry(sunday.date, result);
      if (!match) {
        result.push({
          id: `worship_${sunday.id}`,
          date: sunday.date,
          leader: sunday.assignments?.['slavilna_ekipa']?.[0] || '',
          acoustic: '',
          drums: '',
          bass: '',
          keys: '',
          vocals: (sunday.assignments?.['slavilna_ekipa'] || []).join(', '),
          sound: sunday.assignments?.['zvok']?.[0] || '',
          slides: sunday.assignments?.['besedila']?.[0] || '',
          vocalTechAbsent: sunday.absentOrNotes || '',
          monitors: '',
          sundaySchool: (sunday.assignments?.['nedeljska_sola_mlajsa'] || sunday.assignments?.['nedeljska_sola'] || [])[0] || ''
        });
      }
    });

    return result;
  }, [worshipRoster, sundays]);

  const handleSaveRosterEntry = () => {
    if (!editingRosterEntry) return;
    const exists = activeRoster.some(e => e.id === editingRosterEntry.id);
    let updated: WorshipRosterEntry[];
    if (exists) {
      updated = activeRoster.map(e => e.id === editingRosterEntry.id ? editingRosterEntry : e);
    } else {
      updated = [...activeRoster, editingRosterEntry];
    }
    if (onUpdateWorshipRoster) {
      onUpdateWorshipRoster(updated);
    }

    // Bi-directionally sync with Sunday roster
    if (sundays && onUpdateSunday) {
      const matchedSunday = sundays.find(s => matchWorshipRosterEntry(s.date, [editingRosterEntry]));
      if (matchedSunday) {
        const syncedSunday = syncSundayFromWorshipRosterEntry(editingRosterEntry, matchedSunday);
        onUpdateSunday(syncedSunday);
      }
    }

    setEditingRosterEntry(null);
  };

  const [archivedSongs, setArchivedSongs] = useState<ArchivedSong[]>(INITIAL_ARCHIVED_SONGS);
  const [contacts, setContacts] = useState<WorshipContact[]>(INITIAL_WORSHIP_CONTACTS);

  // New Song Modal State
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [newSongNumber, setNewSongNumber] = useState('');
  const [newSongTitleSl, setNewSongTitleSl] = useState('');
  const [newSongTitleEn, setNewSongTitleEn] = useState('');
  const [newSongYoutube, setNewSongYoutube] = useState('');
  const [newSongCategory, setNewSongCategory] = useState<WorshipSong['category']>('favorite');

  // When opening add song modal or changing category, suggest next number
  const handleOpenAddSong = () => {
    const suggested = getNextSuggestedSongNumber('favorite', songs);
    setNewSongNumber(suggested);
    setNewSongCategory('favorite');
    setIsAddSongOpen(true);
  };

  const handleCategoryChangeInAdd = (cat: WorshipSong['category']) => {
    setNewSongCategory(cat);
    const suggested = getNextSuggestedSongNumber(cat, songs);
    setNewSongNumber(suggested);
  };

  useBackdropHistory(!!editingRosterEntry, () => setEditingRosterEntry(null), 'worship-edit-roster-modal');
  useBackdropHistory(isAddSongOpen, () => setIsAddSongOpen(false), 'worship-add-song-modal');
  useBackdropHistory(!!editingSong, () => setEditingSong(null), 'worship-edit-song-modal');

  // Setup Checklist Completed Steps
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  // Copy Feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const canEdit = userRole === 'Admin' || userRole === 'Leader';

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleStep = (id: string) => {
    setCompletedSteps(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddSong = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSongTitleSl.trim()) return;

    const assignedNumber = newSongNumber.trim() || getNextSuggestedSongNumber(newSongCategory || 'favorite', songs);

    const newSong: WorshipSong = {
      id: `song_${Date.now()}`,
      number: assignedNumber,
      titleSl: newSongTitleSl.trim(),
      titleEn: newSongTitleEn.trim(),
      youtubeUrl: newSongYoutube.trim(),
      category: newSongCategory || 'favorite',
      timesSung: 0,
      isNew: true
    };

    setSongs(prev => [newSong, ...prev]);
    setIsAddSongOpen(false);
    setNewSongTitleSl('');
    setNewSongTitleEn('');
    setNewSongYoutube('');
    setNewSongNumber('');
    setNewSongCategory('favorite');
  };

  const handleUpdateSongCategory = (songId: string, newCategory: WorshipSong['category']) => {
    setSongs(prev => prev.map(s => s.id === songId ? { ...s, category: newCategory } : s));
  };

  const handleSaveEditSong = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSong || !editingSong.titleSl.trim()) return;
    setSongs(prev => prev.map(s => s.id === editingSong.id ? editingSong : s));
    setEditingSong(null);
  };

  // Song Category Counts
  const songCategoryCounts = useMemo(() => {
    const counts = {
      all: songs.length,
      favorite: 0,
      great: 0,
      kids: 0,
      christmas: 0,
      standard: 0
    };
    songs.forEach(s => {
      const cat = s.category || 'standard';
      if (counts[cat] !== undefined) {
        counts[cat]++;
      }
    });
    return counts;
  }, [songs]);

  // Academic Year item counts
  const count2627 = useMemo(() => {
    return combinedRoster.filter(r => {
      const d = parseSheetDate(r.date);
      return d >= academicYear2627Start && d <= academicYear2627End;
    }).length;
  }, [combinedRoster]);

  const count2526 = useMemo(() => {
    return combinedRoster.filter(r => {
      const d = parseSheetDate(r.date);
      return d < academicYear2627Start;
    }).length;
  }, [combinedRoster]);

  // Dynamically compute times sung in the 2026/2027 school year (Sep 1, 2026 - Aug 31, 2027)
  const songUsageCounts2627 = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!sundays || sundays.length === 0) return counts;

    sundays.forEach(sunday => {
      const d = parseSheetDate(sunday.date);
      // Check if on or after Sep 1, 2026
      if (d >= academicYear2627Start && d <= academicYear2627End) {
        const setlist = sunday.worshipSetlist || [];
        setlist.forEach(item => {
          const titleSl = (item.titleSl || item.title || '').trim().toLowerCase();
          const titleEn = (item.titleEn || '').trim().toLowerCase();
          const songId = item.songId || '';

          if (songId) {
            counts[songId] = (counts[songId] || 0) + 1;
          }
          if (titleSl) {
            counts[`title_${titleSl}`] = (counts[`title_${titleSl}`] || 0) + 1;
          }
          if (titleEn) {
            counts[`titleEn_${titleEn}`] = (counts[`titleEn_${titleEn}`] || 0) + 1;
          }
        });
      }
    });

    return counts;
  }, [sundays]);

  // Helper to get times sung for a song in a given school year mode
  const getSongTimesSung = React.useCallback((song: WorshipSong, yearMode: '2026/2027' | '2025/2026' | 'all') => {
    const historical2526 = Number(song.timesSung) || 0;
    const count2627 = songUsageCounts2627[song.id] 
      || songUsageCounts2627[`title_${song.titleSl.trim().toLowerCase()}`]
      || (song.titleEn ? songUsageCounts2627[`titleEn_${song.titleEn.trim().toLowerCase()}`] : 0)
      || 0;

    if (yearMode === '2026/2027') {
      return count2627;
    }
    if (yearMode === '2025/2026') {
      return historical2526;
    }
    return historical2526 + count2627;
  }, [songUsageCounts2627]);

  const handleSortToggle = (field: 'number' | 'titleSl' | 'titleEn' | 'timesSung') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'timesSung' ? 'desc' : 'asc');
    }
  };

  const handleArchiveSortToggle = (field: 'number' | 'titleSl' | 'titleEn' | 'timesSung') => {
    if (archiveSortField === field) {
      setArchiveSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setArchiveSortField(field);
      setArchiveSortDirection(field === 'timesSung' ? 'desc' : 'asc');
    }
  };

  const handleDeleteSong = (id: string) => {
    if (window.confirm(currentLanguage === 'sl' ? 'Ali res želite odstraniti to pesem iz pesmarice?' : 'Are you sure you want to remove this song from the songbook?')) {
      setSongs(songs.filter(s => s.id !== id));
    }
  };

  // Helper to extract direct Google Doc link for a song
  const getSongDocUrl = (song: { docLink?: string; sasuNumber?: string; titleSl?: string; titleEn?: string }) => {
    if (song.docLink && song.docLink.trim().length > 0) {
      return song.docLink.trim();
    }
    if (song.sasuNumber) {
      const found = SASU_ALL_SONGS.find(s => s.number === song.sasuNumber);
      if (found?.docLink && found.docLink.trim().length > 0) {
        return found.docLink.trim();
      }
    }
    if (song.titleSl) {
      const slLower = song.titleSl.trim().toLowerCase();
      const found = SASU_ALL_SONGS.find(s => s.titleSl && s.titleSl.trim().toLowerCase() === slLower);
      if (found?.docLink && found.docLink.trim().length > 0) {
        return found.docLink.trim();
      }
    }
    return null;
  };

  // Filtered & Sorted Songs for main Songbook
  const filteredSongs = useMemo(() => {
    const list = songs.filter(s => {
      const cat = s.category || 'standard';
      const matchesCategory = songCategoryFilter === 'all' || cat === songCategoryFilter;
      const q = songSearch.toLowerCase().trim();
      const matchesSearch = !q ||
        s.titleSl.toLowerCase().includes(q) ||
        s.titleEn.toLowerCase().includes(q) ||
        (s.sasuNumber && s.sasuNumber.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });

    list.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'number') {
        comparison = compareSongNumbers(a.number, b.number);
      } else if (sortField === 'titleSl') {
        comparison = a.titleSl.localeCompare(b.titleSl, 'sl', { sensitivity: 'base' });
      } else if (sortField === 'titleEn') {
        comparison = (a.titleEn || '').localeCompare(b.titleEn || '', 'en', { sensitivity: 'base' });
      } else if (sortField === 'timesSung') {
        const timesA = getSongTimesSung(a, songYearMode);
        const timesB = getSongTimesSung(b, songYearMode);
        comparison = timesA - timesB;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [songs, songSearch, songCategoryFilter, sortField, sortDirection, songYearMode, getSongTimesSung]);

  // 2025/2026 Historical Archive list for the Archive Tab
  const filteredArchivedHistorical = useMemo(() => {
    const list = songs.filter(s => {
      const q = archiveSearch.toLowerCase().trim();
      return !q ||
        s.titleSl.toLowerCase().includes(q) ||
        s.titleEn.toLowerCase().includes(q) ||
        (s.sasuNumber && s.sasuNumber.toLowerCase().includes(q));
    });

    list.sort((a, b) => {
      let comparison = 0;
      if (archiveSortField === 'number') {
        comparison = compareSongNumbers(a.number, b.number);
      } else if (archiveSortField === 'titleSl') {
        comparison = a.titleSl.localeCompare(b.titleSl, 'sl', { sensitivity: 'base' });
      } else if (archiveSortField === 'titleEn') {
        comparison = (a.titleEn || '').localeCompare(b.titleEn || '', 'en', { sensitivity: 'base' });
      } else if (archiveSortField === 'timesSung') {
        comparison = (Number(a.timesSung) || 0) - (Number(b.timesSung) || 0);
      }
      return archiveSortDirection === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [songs, archiveSearch, archiveSortField, archiveSortDirection]);

  // Filtered SASU Songs
  const filteredSasuSongs = useMemo(() => {
    let list = SASU_ALL_SONGS;

    if (sasuOnlyKalvarija) {
      list = list.filter(s => s.isKalvarijaActive);
    }

    if (sasuSearch.trim()) {
      const q = sasuSearch.toLowerCase().trim();
      list = list.filter(s => 
        s.titleSl.toLowerCase().includes(q) ||
        s.titleEn.toLowerCase().includes(q) ||
        s.number.toLowerCase().includes(q) ||
        (s.lyricsStart && s.lyricsStart.toLowerCase().includes(q)) ||
        (s.authors && s.authors.toLowerCase().includes(q)) ||
        (s.translator && s.translator.toLowerCase().includes(q))
      );
    }

    return list;
  }, [sasuSearch, sasuOnlyKalvarija]);

  // Filtered Roster by Year & Search
  const filteredRoster = useMemo(() => {
    return combinedRoster
      .filter(r => {
        const d = parseSheetDate(r.date);
        if (rosterYearView === '2026_2027') {
          return d >= academicYear2627Start && d <= academicYear2627End;
        } else {
          return d < academicYear2627Start;
        }
      })
      .sort((a, b) => {
        return parseSheetDate(a.date).getTime() - parseSheetDate(b.date).getTime();
      })
      .filter(r => {
        const matchesSearch = 
          r.date.toLowerCase().includes(rosterSearch.toLowerCase()) ||
          r.leader.toLowerCase().includes(rosterSearch.toLowerCase()) ||
          r.vocals.toLowerCase().includes(rosterSearch.toLowerCase()) ||
          r.acoustic.toLowerCase().includes(rosterSearch.toLowerCase()) ||
          r.drums.toLowerCase().includes(rosterSearch.toLowerCase()) ||
          r.bass.toLowerCase().includes(rosterSearch.toLowerCase()) ||
          r.keys.toLowerCase().includes(rosterSearch.toLowerCase()) ||
          r.sound.toLowerCase().includes(rosterSearch.toLowerCase());

        const matchesLeader = selectedLeaderFilter === 'all' || r.leader.toLowerCase().includes(selectedLeaderFilter.toLowerCase());

        return matchesSearch && matchesLeader;
      });
  }, [combinedRoster, rosterYearView, rosterSearch, selectedLeaderFilter]);

  // Unique Leaders List for Roster Filter
  const uniqueLeaders = useMemo(() => {
    const set = new Set<string>();
    combinedRoster.forEach(r => {
      if (r.leader && r.leader.trim()) set.add(r.leader.trim());
    });
    return Array.from(set);
  }, [combinedRoster]);

  // Filtered Archived Songs
  const filteredArchived = useMemo(() => {
    return archivedSongs.filter(s =>
      s.titleSl.toLowerCase().includes(archiveSearch.toLowerCase()) ||
      s.titleEn.toLowerCase().includes(archiveSearch.toLowerCase())
    );
  }, [archivedSongs, archiveSearch]);

  return (
    <div id="worship-team-container" className="max-w-5xl mx-auto w-full space-y-5 animate-fade-in pb-24 px-3 sm:px-4">
      {/* Hero Header Banner */}
      <HeroHeaderBanner
        variant="worship"
        eyebrow={currentLanguage === 'sl' 
          ? (rosterYearView === '2026_2027' ? '🎸 KCK SLAVILNA SKUPINA • 2026/2027' : '🎸 KCK SLAVILNA SKUPINA • 2025/2026')
          : (rosterYearView === '2026_2027' ? '🎸 KCK WORSHIP MINISTRY • 2026/2027' : '🎸 KCK WORSHIP MINISTRY • 2025/2026')
        }
        title={currentLanguage === 'sl' ? 'Slavilna Skupina' : 'Worship Team Hub'}
        subtitle={currentLanguage === 'sl' ? 'Celotna evidenca slavilne skupine: razpored po nedeljah, pesmarica KCK s statistiko in vodnik po opremi ter ozvočenju.' : 'Complete worship portal: Sunday schedules, songbook with stats, and stage guidelines.'}
        icon={Music}
      >
        {/* Sub-Navigation Line */}
        <div className="pt-2.5 border-t border-white/15 flex items-center justify-between gap-2 text-xs">
          <div 
            ref={navRef}
            className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar no-scrollbar py-0.5 w-full flex-wrap sm:flex-nowrap"
          >
            <button
              onClick={() => setActiveSubTab('songs')}
              className={`flex items-center gap-1.5 px-3 py-1 sm:px-3.5 rounded-xl transition whitespace-nowrap cursor-pointer shrink-0 border ${
                activeSubTab === 'songs' 
                  ? 'bg-white text-indigo-950 font-bold border-white shadow-xs scale-[1.02]' 
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/15 backdrop-blur-xs font-medium'
              }`}
            >
              <Music className="w-3.5 h-3.5 shrink-0" />
              <span>{currentLanguage === 'sl' ? 'Pesmarica & Statistika' : 'Songbook & Stats'}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeSubTab === 'songs' ? 'bg-indigo-600 text-white' : 'bg-white/20 text-white'}`}>
                {songs.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab('sasu')}
              className={`flex items-center gap-1.5 px-3 py-1 sm:px-3.5 rounded-xl transition whitespace-nowrap cursor-pointer shrink-0 border ${
                activeSubTab === 'sasu' 
                  ? 'bg-amber-400 text-amber-950 font-bold border-amber-300 shadow-xs scale-[1.02]' 
                  : 'bg-white/10 hover:bg-white/20 text-amber-200 border-white/15 backdrop-blur-xs font-medium'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span>{currentLanguage === 'sl' ? 'SASU vse pesmi' : 'SASU All Songs'}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${activeSubTab === 'sasu' ? 'bg-amber-800 text-white' : 'bg-white/20 text-amber-100'}`}>
                {SASU_ALL_SONGS.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab('roster')}
              className={`flex items-center gap-1.5 px-3 py-1 sm:px-3.5 rounded-xl transition whitespace-nowrap cursor-pointer shrink-0 border ${
                activeSubTab === 'roster' 
                  ? 'bg-white text-indigo-950 font-bold border-white shadow-xs scale-[1.02]' 
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/15 backdrop-blur-xs font-medium'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>{currentLanguage === 'sl' ? 'Razpored Nedelj' : 'Sunday Schedule'}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeSubTab === 'roster' ? 'bg-indigo-600 text-white' : 'bg-white/20 text-white'}`}>
                {activeRoster.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab('sound')}
              className={`flex items-center gap-1.5 px-3 py-1 sm:px-3.5 rounded-xl transition whitespace-nowrap cursor-pointer shrink-0 border ${
                activeSubTab === 'sound' 
                  ? 'bg-white text-indigo-950 font-bold border-white shadow-xs scale-[1.02]' 
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/15 backdrop-blur-xs font-medium'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 shrink-0" />
              <span>{currentLanguage === 'sl' ? 'Ozvočenje' : 'Sound Guide'}</span>
            </button>

            <button
              onClick={() => setActiveSubTab('archive')}
              className={`flex items-center gap-1.5 px-3 py-1 sm:px-3.5 rounded-xl transition whitespace-nowrap cursor-pointer shrink-0 border ${
                activeSubTab === 'archive' 
                  ? 'bg-white text-indigo-950 font-bold border-white shadow-xs scale-[1.02]' 
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/15 backdrop-blur-xs font-medium'
              }`}
            >
              <Archive className="w-3.5 h-3.5 shrink-0" />
              <span>{currentLanguage === 'sl' ? 'Arhiv Pesmi' : 'Song Archive'}</span>
            </button>
          </div>
        </div>
      </HeroHeaderBanner>

      {/* ==================== SUB-TAB 1: SONGS & STATS ==================== */}
      {activeSubTab === 'songs' && (
        <div className="space-y-4 animate-fade-in">
          {/* Top Bar: Search, View Mode, Add Song */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={songSearch}
                onChange={(e) => setSongSearch(e.target.value)}
                placeholder={currentLanguage === 'sl' ? 'Išči pesem (npr. Dober si Oče, Battle belongs...)' : 'Search songs by title...'}
                className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-gray-200 text-xs">
                <button
                  type="button"
                  onClick={() => handleSetSongViewMode('table')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md transition cursor-pointer font-medium ${
                    songViewMode === 'table' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">{currentLanguage === 'sl' ? 'Tabela' : 'Table'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetSongViewMode('cards')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md transition cursor-pointer font-medium ${
                    songViewMode === 'cards' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">{currentLanguage === 'sl' ? 'Kartice' : 'Cards'}</span>
                </button>
              </div>

              {canEdit && (
                <button
                  onClick={handleOpenAddSong}
                  type="button"
                  className="flex items-center justify-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg transition shadow-2xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{currentLanguage === 'sl' ? 'Dodaj pesem' : 'Add Song'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
            <button
              type="button"
              onClick={() => setSongCategoryFilter('all')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition cursor-pointer shrink-0 ${
                songCategoryFilter === 'all'
                  ? 'bg-slate-900 text-white font-bold shadow-2xs'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <span>{currentLanguage === 'sl' ? 'Vse pesmi' : 'All Songs'}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                songCategoryFilter === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                {songCategoryCounts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSongCategoryFilter('favorite')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition cursor-pointer shrink-0 ${
                songCategoryFilter === 'favorite'
                  ? 'bg-amber-400 text-amber-950 font-bold border border-amber-500 shadow-2xs ring-2 ring-amber-300'
                  : 'bg-amber-50/90 text-amber-900 hover:bg-amber-100/80 border border-amber-300/80'
              }`}
            >
              <span>⭐ {currentLanguage === 'sl' ? 'Glavni repertoar' : 'Core Repertoire'}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-amber-200/90 text-amber-950 font-bold">
                {songCategoryCounts.favorite}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSongCategoryFilter('great')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition cursor-pointer shrink-0 ${
                songCategoryFilter === 'great'
                  ? 'bg-yellow-300 text-yellow-950 font-bold border border-yellow-400 shadow-2xs ring-2 ring-yellow-200'
                  : 'bg-yellow-50/90 text-yellow-900 hover:bg-yellow-100/80 border border-yellow-200'
              }`}
            >
              <span>👍 {currentLanguage === 'sl' ? 'Standardno slavljenje' : 'Standard Worship'}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-yellow-200/90 text-yellow-950 font-bold">
                {songCategoryCounts.great}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSongCategoryFilter('kids')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition cursor-pointer shrink-0 ${
                songCategoryFilter === 'kids'
                  ? 'bg-emerald-500 text-white font-bold border border-emerald-600 shadow-2xs ring-2 ring-emerald-200'
                  : 'bg-emerald-50/90 text-emerald-900 hover:bg-emerald-100/80 border border-emerald-200'
              }`}
            >
              <span>👶 {currentLanguage === 'sl' ? 'Otroške pesmi' : 'Kids Songs'}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                songCategoryFilter === 'kids' ? 'bg-emerald-700 text-white' : 'bg-emerald-200/90 text-emerald-950'
              }`}>
                {songCategoryCounts.kids}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSongCategoryFilter('christmas')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition cursor-pointer shrink-0 ${
                songCategoryFilter === 'christmas'
                  ? 'bg-sky-500 text-white font-bold border border-sky-600 shadow-2xs ring-2 ring-sky-200'
                  : 'bg-sky-50/90 text-sky-900 hover:bg-sky-100/80 border border-sky-200'
              }`}
            >
              <span>🎄 {currentLanguage === 'sl' ? 'Božične & Praznične' : 'Christmas & Seasonal'}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                songCategoryFilter === 'christmas' ? 'bg-sky-700 text-white' : 'bg-sky-200/90 text-sky-950'
              }`}>
                {songCategoryCounts.christmas}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSongCategoryFilter('standard')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition cursor-pointer shrink-0 ${
                songCategoryFilter === 'standard'
                  ? 'bg-purple-600 text-white font-bold border border-purple-700 shadow-2xs ring-2 ring-purple-300'
                  : 'bg-purple-50/80 text-purple-900 hover:bg-purple-100/80 border border-purple-200'
              }`}
            >
              <span>✨ {currentLanguage === 'sl' ? 'Nove pesmi' : 'New Songs'}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                songCategoryFilter === 'standard' ? 'bg-purple-800 text-white' : 'bg-purple-200 text-purple-950'
              }`}>
                {songCategoryCounts.standard}
              </span>
            </button>
          </div>

          {/* School Year (Academic Year) & Quick Sort Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-slate-50/90 border border-gray-200/80 p-2.5 rounded-xl text-xs">
            {/* School Year Mode Selector */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-mono font-bold uppercase text-gray-500 flex items-center gap-1 shrink-0 px-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>{currentLanguage === 'sl' ? 'Šolsko leto (izvedbe):' : 'School Year (Times Sung):'}</span>
              </span>
              <div className="inline-flex p-0.5 bg-white border border-gray-200 rounded-lg shadow-2xs">
                <button
                  type="button"
                  onClick={() => setSongYearMode('2026/2027')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                    songYearMode === '2026/2027'
                      ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  title={currentLanguage === 'sl' ? 'Tekoče šolsko leto 2026/27 (začne z 0 v septembru)' : 'Current 2026/27 School Year (resets to 0 in September)'}
                >
                  <span>2026/27</span>
                  <span className={`text-[9px] px-1 py-0.2 rounded-full font-mono ${
                    songYearMode === '2026/2027' ? 'bg-indigo-800 text-white' : 'bg-indigo-50 text-indigo-700'
                  }`}>
                    {currentLanguage === 'sl' ? 'Tekoče' : 'Current'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSongYearMode('2025/2026')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                    songYearMode === '2025/2026'
                      ? 'bg-amber-600 text-white shadow-2xs font-bold'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  title={currentLanguage === 'sl' ? 'Prejšnje šolsko leto 2025/26 (arhivirane izvedbe)' : 'Previous 2025/26 School Year (archived counts)'}
                >
                  <span>2025/26</span>
                  <span className={`text-[9px] px-1 py-0.2 rounded-full font-mono ${
                    songYearMode === '2025/2026' ? 'bg-amber-800 text-white' : 'bg-amber-50 text-amber-800'
                  }`}>
                    {currentLanguage === 'sl' ? 'Arhiv' : 'Archive'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSongYearMode('all')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    songYearMode === 'all'
                      ? 'bg-slate-800 text-white shadow-2xs font-bold'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  title={currentLanguage === 'sl' ? 'Vsa leta skupaj' : 'All time combined'}
                >
                  <span>{currentLanguage === 'sl' ? 'Vse skupaj' : 'All time'}</span>
                </button>
              </div>
            </div>

            {/* Quick Sort Dropdown - Bilingual */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-mono font-bold uppercase text-gray-500 flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600" />
                <span>{currentLanguage === 'sl' ? 'Razvrsti:' : 'Sort:'}</span>
              </span>
              <select
                value={`${sortField}_${sortDirection}`}
                onChange={(e) => {
                  const [f, d] = e.target.value.split('_') as ['number' | 'titleSl' | 'titleEn' | 'timesSung', 'asc' | 'desc'];
                  setSortField(f);
                  setSortDirection(d);
                }}
                className="text-xs px-2.5 py-1 bg-white border border-gray-300 rounded-lg text-gray-800 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs"
              >
                <option value="number_asc">
                  {currentLanguage === 'sl' ? '# Po kodi / številki (W-1 → W-99)' : '# By Code / Number (W-1 → W-99)'}
                </option>
                <option value="number_desc">
                  {currentLanguage === 'sl' ? '# Po kodi padajoče' : '# By Code Descending'}
                </option>
                <option value="titleSl_asc">
                  {currentLanguage === 'sl' ? '🔤 Slovenski naslov (A → Z)' : '🔤 Slovenian Title (A → Z)'}
                </option>
                <option value="titleSl_desc">
                  {currentLanguage === 'sl' ? '🔤 Slovenski naslov (Z → A)' : '🔤 Slovenian Title (Z → A)'}
                </option>
                <option value="titleEn_asc">
                  {currentLanguage === 'sl' ? '🔤 Originalni naslov (A → Z)' : '🔤 Original Title (A → Z)'}
                </option>
                <option value="titleEn_desc">
                  {currentLanguage === 'sl' ? '🔤 Originalni naslov (Z → A)' : '🔤 Original Title (Z → A)'}
                </option>
                <option value="timesSung_desc">
                  {currentLanguage === 'sl' ? '🔥 Največkrat izvedene (najprej)' : '🔥 Most Sung First'}
                </option>
                <option value="timesSung_asc">
                  {currentLanguage === 'sl' ? '❄️ Najmanjkrat izvedene (najprej)' : '❄️ Least Sung First'}
                </option>
              </select>
            </div>
          </div>

          {/* Add Song Form Modal */}
          {isAddSongOpen && (
            <form onSubmit={handleAddSong} className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3 animate-slide-up shadow-2xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900 font-mono flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-indigo-600" />
                <span>{currentLanguage === 'sl' ? 'Nova Pesem v Pesmarici' : 'Add New Worship Song'}</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono mb-1">
                    {currentLanguage === 'sl' ? 'Koda / Številka *' : 'Code / Song # *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newSongNumber}
                    onChange={(e) => setNewSongNumber(e.target.value)}
                    placeholder="e.g. W-129, K-32"
                    className="w-full text-xs px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono mb-1">
                    {currentLanguage === 'sl' ? 'Slovenski naslov *' : 'Slovenian Title *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newSongTitleSl}
                    onChange={(e) => setNewSongTitleSl(e.target.value)}
                    placeholder="Npr. ČUDOVITO IME"
                    className="w-full text-xs px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono mb-1">
                    {currentLanguage === 'sl' ? 'Kategorija pesmi' : 'Song Category'}
                  </label>
                  <select
                    value={newSongCategory}
                    onChange={(e) => handleCategoryChangeInAdd(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                  >
                    <option value="favorite">⭐ {currentLanguage === 'sl' ? 'Glavni repertoar (W-)' : 'Core Repertoire (W-)'}</option>
                    <option value="great">👍 {currentLanguage === 'sl' ? 'Standardno slavljenje (W-)' : 'Standard Worship (W-)'}</option>
                    <option value="kids">👶 {currentLanguage === 'sl' ? 'Otroška pesem (K-)' : 'Kids Song (K-)'}</option>
                    <option value="christmas">🎄 {currentLanguage === 'sl' ? 'Božična / Praznična (B-)' : 'Christmas & Holiday (B-)'}</option>
                    <option value="standard">✨ {currentLanguage === 'sl' ? 'Nove pesmi (W-)' : 'New Songs (W-)'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono mb-1">
                    {currentLanguage === 'sl' ? 'Originalni angleški naslov' : 'Original English Title'}
                  </label>
                  <input
                    type="text"
                    value={newSongTitleEn}
                    onChange={(e) => setNewSongTitleEn(e.target.value)}
                    placeholder="e.g. What a Beautiful Name"
                    className="w-full text-xs px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono mb-1">
                    {currentLanguage === 'sl' ? 'YouTube posnetek URL' : 'YouTube Link URL'}
                  </label>
                  <input
                    type="url"
                    value={newSongYoutube}
                    onChange={(e) => setNewSongYoutube(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full text-xs px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddSongOpen(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg bg-white"
                >
                  {translations.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs"
                >
                  {translations.save}
                </button>
              </div>
            </form>
          )}

          {/* Table Mode vs Cards Mode rendering */}
          {songViewMode === 'table' ? (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs relative">
              {/* Sticky Scroll Hint Banner */}
              <div className="sticky top-0 z-20 px-3.5 py-2 bg-indigo-50/95 backdrop-blur-md border-b border-indigo-100 flex items-center justify-between text-[11px] text-indigo-900 font-medium flex-wrap gap-2 shadow-2xs">
                <span className="flex items-center gap-1.5 min-w-0">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="truncate">
                    {currentLanguage === 'sl' 
                      ? '💡 Klikni na glavo stolpca za razvrščanje ali pomakni vodoravno za povezave:'
                      : '💡 Click column header to sort or scroll horizontally for links:'}
                  </span>
                </span>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Quick Scroll Buttons for Table */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => scrollTable(songsTableRef, 'left')}
                      className="inline-flex items-center gap-0.5 px-2 py-1 bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-300 rounded-md shadow-2xs font-bold text-[10px] transition cursor-pointer"
                      title="Pomakni tabelo levo"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline">{currentLanguage === 'sl' ? 'Levo' : 'Left'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollTable(songsTableRef, 'right')}
                      className="inline-flex items-center gap-0.5 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-600 rounded-md shadow-2xs font-bold text-[10px] transition cursor-pointer"
                      title="Pomakni tabelo desno za povezave"
                    >
                      <span className="hidden xs:inline">{currentLanguage === 'sl' ? 'Desno' : 'Right'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-indigo-200/80 text-indigo-700 font-bold">
                    {filteredSongs.length} {currentLanguage === 'sl' ? 'pesmi' : 'songs'}
                  </span>
                </div>
              </div>

              <div 
                ref={songsTableRef} 
                className="overflow-x-auto custom-scrollbar scroll-smooth cursor-grab touch-pan-x"
                onMouseDown={(e) => handleMouseDown(e, songsTableRef)}
                onMouseLeave={() => handleMouseUpOrLeave(songsTableRef)}
                onMouseUp={() => handleMouseUpOrLeave(songsTableRef)}
                onMouseMove={(e) => handleMouseMove(e, songsTableRef)}
              >
                <table className="w-full text-left text-xs border-collapse min-w-[760px]">
                  <thead className="sticky top-0 z-10 bg-slate-100 shadow-2xs select-none">
                    <tr className="bg-slate-100 text-gray-600 font-mono text-[10px] uppercase tracking-wider border-b border-gray-200">
                      <th 
                        onClick={() => handleSortToggle('number')}
                        className="py-2.5 px-3 w-16 text-center shrink-0 cursor-pointer hover:bg-slate-200/80 transition"
                        title={currentLanguage === 'sl' ? 'Klikni za razvrščanje po kodi pesmi' : 'Click to sort by song code'}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>#</span>
                          {sortField === 'number' ? (
                            <span className="text-indigo-600 font-bold">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                          ) : (
                            <span className="text-gray-400 opacity-40">↕</span>
                          )}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSortToggle('titleSl')}
                        className="py-2.5 px-3 min-w-[220px] cursor-pointer hover:bg-slate-200/80 transition"
                        title={currentLanguage === 'sl' ? 'Klikni za abecedno razvrščanje (slovenski naslov)' : 'Click to sort alphabetically (Slovenian title)'}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{currentLanguage === 'sl' ? 'Naslov pesmi & akordi' : 'Song Title & Chords'}</span>
                          <span className={`text-[10px] font-bold ${sortField === 'titleSl' ? 'text-indigo-600' : 'text-gray-400 opacity-40'}`}>
                            {sortField === 'titleSl' ? (sortDirection === 'asc' ? '▲ A-Z' : '▼ Z-A') : '⇅'}
                          </span>
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSortToggle('titleEn')}
                        className="py-2.5 px-3 min-w-[180px] cursor-pointer hover:bg-slate-200/80 transition"
                        title={currentLanguage === 'sl' ? 'Klikni za abecedno razvrščanje (originalni naslov)' : 'Click to sort alphabetically (Original title)'}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{currentLanguage === 'sl' ? 'Originalni naslov' : 'Original Title'}</span>
                          <span className={`text-[10px] font-bold ${sortField === 'titleEn' ? 'text-indigo-600' : 'text-gray-400 opacity-40'}`}>
                            {sortField === 'titleEn' ? (sortDirection === 'asc' ? '▲ A-Z' : '▼ Z-A') : '⇅'}
                          </span>
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSortToggle('timesSung')}
                        className="py-2.5 px-3 text-center min-w-[110px] cursor-pointer hover:bg-slate-200/80 transition"
                        title={currentLanguage === 'sl' ? 'Klikni za razvrščanje po številu izvedb (največ / najmanj)' : 'Click to sort by times sung (most / least)'}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span>{currentLanguage === 'sl' ? 'Izvedbe' : 'Times Sung'}</span>
                          <span className={`text-[10px] font-bold ${sortField === 'timesSung' ? 'text-indigo-600' : 'text-gray-400 opacity-40'}`}>
                            {sortField === 'timesSung' ? (sortDirection === 'desc' ? '▼ Največ' : '▲ Najmanj') : '⇅'}
                          </span>
                        </div>
                      </th>
                      <th className="py-2.5 px-3 text-right min-w-[220px]">{currentLanguage === 'sl' ? 'Povezave' : 'Media Links'}</th>
                      {canEdit && <th className="py-2.5 px-3 w-14 text-center shrink-0"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/70 text-gray-800">
                    {filteredSongs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-xs text-gray-400 font-mono">
                          {currentLanguage === 'sl' ? 'Ni najdenih pesmi z izbranim iskalnim nizom.' : 'No songs found matching your search.'}
                        </td>
                      </tr>
                    ) : (
                      filteredSongs.map((song, i) => {
                        const badge = getCategoryBadge(song.category, currentLanguage);
                        const timesCount = getSongTimesSung(song, songYearMode);
                        return (
                          <tr key={song.id} className={`${badge.rowClass} transition border-b border-gray-200/50`}>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] ${badge.numBadgeClass}`}>
                                #{song.number}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-semibold">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-slate-900">{song.titleSl}</span>
                                {canEdit ? (
                                  <div className="relative inline-flex items-center">
                                    <select
                                      value={song.category || 'standard'}
                                      onChange={(e) => handleUpdateSongCategory(song.id, e.target.value as WorshipSong['category'])}
                                      className={`text-[10px] pl-1.5 pr-4 py-0.5 rounded-md font-mono font-bold border cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none shadow-2xs ${badge.badgeClass}`}
                                      title={currentLanguage === 'sl' ? 'Klikni za spremembo kategorije pesmi' : 'Click to change song category'}
                                    >
                                      <option value="favorite">⭐ {currentLanguage === 'sl' ? 'Glavni repertoar' : 'Core Repertoire'}</option>
                                      <option value="great">👍 {currentLanguage === 'sl' ? 'Standardno slavljenje' : 'Standard Worship'}</option>
                                      <option value="kids">👶 {currentLanguage === 'sl' ? 'Otroška pesem' : 'Kids Song'}</option>
                                      <option value="christmas">🎄 {currentLanguage === 'sl' ? 'Božična / Praznična' : 'Christmas & Seasonal'}</option>
                                      <option value="standard">✨ {currentLanguage === 'sl' ? 'Nove pesmi' : 'New Songs'}</option>
                                    </select>
                                    <span className="absolute right-1 pointer-events-none text-[8px] opacity-70">▾</span>
                                  </div>
                                ) : (
                                  song.category && song.category !== 'standard' && (
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${badge.badgeClass}`}>
                                      {badge.shortLabel}
                                    </span>
                                  )
                                )}
                                {song.isNew && (
                                  <span className="text-[9px] font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">
                                    NEW
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-gray-600 italic">
                              {song.titleEn || '-'}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {(() => {
                                const sungBadge = getTimesSungBadge(timesCount, currentLanguage);
                                return (
                                  <span 
                                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono transition ${sungBadge.className}`}
                                    title={`${songYearMode === '2026/2027' ? (currentLanguage === 'sl' ? 'Šolsko leto 2026/27 (tekoče)' : '2026/27 (Current)') : songYearMode === '2025/2026' ? (currentLanguage === 'sl' ? 'Šolsko leto 2025/26 (arhivirano)' : '2025/26 (Archive)') : (currentLanguage === 'sl' ? 'Vsa leta' : 'All time')}: ${sungBadge.tierName}`}
                                  >
                                    {sungBadge.label}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {song.sasuNumber && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSasuSearch(song.titleSl || song.titleEn);
                                      setActiveSubTab('sasu');
                                    }}
                                    className="inline-flex items-center gap-1 text-[11px] text-amber-800 hover:text-amber-900 font-bold bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-md border border-amber-200 shadow-2xs transition cursor-pointer"
                                    title={`Prikaži v zbirki SASU vse pesmi (#${song.sasuNumber})`}
                                  >
                                    <BookOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span>SASU #{song.sasuNumber}</span>
                                  </button>
                                )}
                                {(() => {
                                  const docUrl = getSongDocUrl(song);
                                  if (docUrl) {
                                    return (
                                      <a
                                        href={docUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-[11px] text-blue-700 hover:text-blue-800 font-medium hover:underline bg-white px-2 py-1 rounded-md border border-blue-200 shadow-2xs"
                                        title="Odpri Google Doc pesmi (besedilo / akordi)"
                                      >
                                        <FileText className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                                        <span>Google Doc</span>
                                      </a>
                                    );
                                  }
                                  return null;
                                })()}
                                {song.youtubeUrl && (
                                  <a
                                    href={song.youtubeUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:text-red-700 font-medium hover:underline bg-white px-2 py-1 rounded-md border border-red-200 shadow-2xs"
                                    title="YouTube Video"
                                  >
                                    <Youtube className="w-3.5 h-3.5 shrink-0" />
                                    <span>YouTube</span>
                                  </a>
                                )}
                                {!song.youtubeUrl && !getSongDocUrl(song) && (
                                  <span className="text-[10px] text-gray-400 font-mono">-</span>
                                )}
                              </div>
                            </td>
                            {canEdit && (
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => setEditingSong(song)}
                                    type="button"
                                    className="text-gray-400 hover:text-indigo-600 transition p-1 cursor-pointer rounded"
                                    title={currentLanguage === 'sl' ? 'Uredi pesem' : 'Edit song'}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSong(song.id)}
                                    type="button"
                                    className="text-gray-400 hover:text-rose-600 transition p-1 cursor-pointer rounded"
                                    title={currentLanguage === 'sl' ? 'Odstrani pesem' : 'Delete song'}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Cards View for Songbook */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredSongs.map((song, i) => {
                const badge = getCategoryBadge(song.category, currentLanguage);
                const timesCount = getSongTimesSung(song, songYearMode);
                return (
                  <div key={song.id} className={`${badge.cardClass} ${badge.cardAccent} rounded-xl p-3.5 shadow-2xs space-y-2.5 transition`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded shadow-2xs ${badge.numBadgeClass}`}>
                          #{song.number}
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 font-display flex items-center gap-1.5 flex-wrap">
                            <span>{song.titleSl}</span>
                            {canEdit ? (
                              <div className="relative inline-flex items-center">
                                <select
                                  value={song.category || 'standard'}
                                  onChange={(e) => handleUpdateSongCategory(song.id, e.target.value as WorshipSong['category'])}
                                  className={`text-[10px] pl-1.5 pr-4 py-0.5 rounded-md font-mono font-bold border cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none shadow-2xs ${badge.badgeClass}`}
                                  title={currentLanguage === 'sl' ? 'Klikni za spremembo kategorije pesmi' : 'Click to change song category'}
                                >
                                  <option value="favorite">⭐ {currentLanguage === 'sl' ? 'Glavni repertoar' : 'Core Repertoire'}</option>
                                  <option value="great">👍 {currentLanguage === 'sl' ? 'Standardno slavljenje' : 'Standard Worship'}</option>
                                  <option value="kids">👶 {currentLanguage === 'sl' ? 'Otroška pesem' : 'Kids Song'}</option>
                                  <option value="christmas">🎄 {currentLanguage === 'sl' ? 'Božična / Praznična' : 'Christmas & Seasonal'}</option>
                                  <option value="standard">✨ {currentLanguage === 'sl' ? 'Nove pesmi' : 'New Songs'}</option>
                                </select>
                                <span className="absolute right-1 pointer-events-none text-[8px] opacity-70">▾</span>
                              </div>
                            ) : (
                              song.category && song.category !== 'standard' && (
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${badge.badgeClass}`}>
                                  {badge.shortLabel}
                                </span>
                              )
                            )}
                            {song.isNew && (
                              <span className="text-[9px] font-mono bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-bold">
                                NEW
                              </span>
                            )}
                          </h4>
                          {song.titleEn && (
                            <p className="text-[11px] text-gray-600 italic">{song.titleEn}</p>
                          )}
                        </div>
                      </div>

                      {(() => {
                        const sungBadge = getTimesSungBadge(timesCount, currentLanguage);
                        return (
                          <span 
                            className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full transition shrink-0 ${sungBadge.className}`}
                            title={`${songYearMode === '2026/2027' ? (currentLanguage === 'sl' ? 'Šolsko leto 2026/27 (tekoče)' : '2026/27 (Current)') : songYearMode === '2025/2026' ? (currentLanguage === 'sl' ? 'Šolsko leto 2025/26 (arhivirano)' : '2025/26 (Archive)') : (currentLanguage === 'sl' ? 'Vsa leta' : 'All time')}: ${sungBadge.tierName}`}
                          >
                            {sungBadge.label}
                          </span>
                        );
                      })()}
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-200/60 pt-2 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {song.sasuNumber && (
                          <button
                            type="button"
                            onClick={() => {
                              setSasuSearch(song.titleSl || song.titleEn);
                              setActiveSubTab('sasu');
                            }}
                            className="inline-flex items-center gap-1 text-[11px] text-amber-800 hover:text-amber-900 font-bold bg-white hover:bg-amber-50 px-2 py-1 rounded border border-amber-200 shadow-2xs transition cursor-pointer"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>SASU #{song.sasuNumber}</span>
                          </button>
                        )}
                        {(() => {
                          const docUrl = getSongDocUrl(song);
                          if (docUrl) {
                            return (
                              <a
                                href={docUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-blue-700 hover:underline font-medium bg-white px-2 py-1 rounded border border-blue-200 shadow-2xs"
                                title="Odpri Google Doc pesmi (besedilo / akordi)"
                              >
                                <FileText className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                                <span>Google Doc</span>
                              </a>
                            );
                          }
                          return null;
                        })()}
                        {song.youtubeUrl && (
                          <a
                            href={song.youtubeUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:underline font-medium bg-white px-2 py-1 rounded border border-red-200 shadow-2xs"
                          >
                            <Youtube className="w-3.5 h-3.5 shrink-0" />
                            <span>YouTube</span>
                          </a>
                        )}
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingSong(song)}
                            type="button"
                            className="text-gray-400 hover:text-indigo-600 p-1 cursor-pointer transition rounded"
                            title={currentLanguage === 'sl' ? 'Uredi pesem' : 'Edit song'}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSong(song.id)}
                            type="button"
                            className="text-gray-400 hover:text-rose-600 p-1 cursor-pointer transition rounded"
                            title={currentLanguage === 'sl' ? 'Odstrani pesem' : 'Delete song'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== SUB-TAB: SASU VSE PESMI (ALL SONGS) ==================== */}
      {activeSubTab === 'sasu' && (
        <div className="space-y-4 animate-fade-in">
          {/* Top Banner with info and link to Google Sheets */}
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/80 rounded-2xl p-3.5 sm:p-5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <BookOpen className="w-5 h-5 text-amber-600 shrink-0" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900 font-display">
                  SASU Vse Pesmi (All Songs)
                </h3>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-amber-100 text-amber-900 border border-amber-200">
                    {SASU_ALL_SONGS.length} {currentLanguage === 'sl' ? 'pesmi' : 'songs'}
                  </span>
                  <span className="text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">
                    {currentLanguage === 'sl' ? '156 v Kalvariji' : '156 in Kalvarija'}
                  </span>
                </div>
              </div>

              {/* Compact Google Sheets link button */}
              <a
                href={SASU_GOOGLE_SHEETS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer shrink-0"
                title={currentLanguage === 'sl' ? 'Odpri celotno Google Tabelo z vsemi pesmimi' : 'Open Google Sheets'}
              >
                <FileSpreadsheet className="w-4 h-4 text-white shrink-0" />
                <span className="hidden xs:inline">{currentLanguage === 'sl' ? 'Google Tabela' : 'Google Sheets'}</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80 shrink-0" />
              </a>
            </div>

            {/* Description sitting cleanly on full width */}
            <p className="text-xs text-gray-600 leading-relaxed">
              {currentLanguage === 'sl'
                ? 'Celotna obsežna zbirka več kot 1.180 krščanskih slavilnih pesmi s prevodi, izvirnimi naslovi, avtorji, prevajalci, začetnimi vrsticami in neposrednimi spletnimi povezavami.'
                : 'Comprehensive database of over 1,180 Christian worship songs with translations, original titles, authors, translators, starting lyrics, and direct links.'}
            </p>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={sasuSearch}
                onChange={(e) => {
                  setSasuSearch(e.target.value);
                  setSasuDisplayLimit(100);
                }}
                placeholder={currentLanguage === 'sl' ? 'Išči po naslovu, začetnih vrsticah, avtorju ali številki (#)...' : 'Search by song title, starting lyrics, author, or number (#)...'}
                className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Toggle Kalvarija filter */}
              <button
                type="button"
                onClick={() => {
                  setSasuOnlyKalvarija(!sasuOnlyKalvarija);
                  setSasuDisplayLimit(100);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                  sasuOnlyKalvarija 
                    ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold' 
                    : 'bg-slate-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>{currentLanguage === 'sl' ? 'Samo Kalvarija (156)' : 'Only Kalvarija (156)'}</span>
              </button>

              {/* View Mode Toggle */}
              <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-gray-200 text-xs">
                <button
                  type="button"
                  onClick={() => setSasuViewMode('table')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md transition cursor-pointer font-medium ${
                    sasuViewMode === 'table' ? 'bg-white text-amber-700 shadow-2xs font-bold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">{currentLanguage === 'sl' ? 'Tabela' : 'Table'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSasuViewMode('cards')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md transition cursor-pointer font-medium ${
                    sasuViewMode === 'cards' ? 'bg-white text-amber-700 shadow-2xs font-bold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">{currentLanguage === 'sl' ? 'Kartice' : 'Cards'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Table Mode vs Cards Mode rendering */}
          {sasuViewMode === 'table' ? (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs relative">
              {/* Sticky Scroll Hint Banner */}
              <div className="sticky top-0 z-20 px-3.5 py-2 bg-amber-50/95 backdrop-blur-md border-b border-amber-100 flex items-center justify-between text-[11px] text-amber-900 font-medium flex-wrap gap-2 shadow-2xs">
                <span className="flex items-center gap-1.5 min-w-0">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="truncate">
                    {currentLanguage === 'sl' 
                      ? '💡 Vodoravni pomik tabele za vse podatke in povezave:'
                      : '💡 Table horizontal scroll for links & info:'}
                  </span>
                </span>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Table Scroll Buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => scrollTable(sasuTableRef, 'left')}
                      className="inline-flex items-center gap-0.5 px-2 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-md shadow-2xs font-bold text-[10px] transition cursor-pointer"
                      title="Pomakni tabelo levo"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline">{currentLanguage === 'sl' ? 'Levo' : 'Left'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollTable(sasuTableRef, 'right')}
                      className="inline-flex items-center gap-0.5 px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white border border-amber-600 rounded-md shadow-2xs font-bold text-[10px] transition cursor-pointer"
                      title="Pomakni tabelo desno za povezave"
                    >
                      <span className="hidden xs:inline">{currentLanguage === 'sl' ? 'Desno' : 'Right'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-amber-200 text-amber-800 font-bold">
                    Prikazanih {Math.min(filteredSasuSongs.length, sasuDisplayLimit)} od {filteredSasuSongs.length} pesmi
                  </span>
                </div>
              </div>

              <div 
                ref={sasuTableRef} 
                className="overflow-x-auto custom-scrollbar scroll-smooth cursor-grab touch-pan-x"
                onMouseDown={(e) => handleMouseDown(e, sasuTableRef)}
                onMouseLeave={() => handleMouseUpOrLeave(sasuTableRef)}
                onMouseUp={() => handleMouseUpOrLeave(sasuTableRef)}
                onMouseMove={(e) => handleMouseMove(e, sasuTableRef)}
              >
                <table className="w-full text-left text-xs border-collapse min-w-[680px]">
                  <thead className="sticky top-0 z-10 bg-slate-100 shadow-2xs">
                    <tr className="bg-slate-100 text-gray-600 font-mono text-[10px] uppercase tracking-wider border-b border-gray-200 select-none">
                      <th className="py-2.5 px-3 w-12 text-center shrink-0">#</th>
                      <th className="py-2.5 px-3 min-w-[200px]">{currentLanguage === 'sl' ? 'Slovenski naslov & besedilo' : 'Slovenian Title & Lyrics'}</th>
                      <th className="py-2.5 px-3 min-w-[180px]">{currentLanguage === 'sl' ? 'Originalni naslov & avtorji' : 'Original Title & Authors'}</th>
                      <th className="py-2.5 px-3 text-right min-w-[180px]">{currentLanguage === 'sl' ? 'Povezave' : 'Links'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150 text-gray-800">
                    {filteredSasuSongs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-xs text-gray-400 font-mono">
                          {currentLanguage === 'sl' ? 'Ni najdenih pesmi z izbranim iskalnim nizom.' : 'No songs found matching your search.'}
                        </td>
                      </tr>
                    ) : (
                      filteredSasuSongs.slice(0, sasuDisplayLimit).map((song) => (
                        <tr key={song.id} className="hover:bg-amber-50/40 transition">
                          <td className="py-2.5 px-3 text-center font-mono text-amber-800 font-bold text-[11px]">
                            {song.number}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900 max-w-xs">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{song.titleSl || '-'}</span>
                                {song.isKalvarijaActive && (
                                  <span className="text-[9px] font-mono font-bold bg-indigo-100 text-indigo-900 px-1.5 py-0.2 rounded border border-indigo-200">
                                    🎸 Kalvarija #{song.kalvarijaSongNumber}
                                  </span>
                                )}
                                {song.translator && (
                                  <span className="text-[9px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-normal" title={`Prevod: ${song.translator}`}>
                                    ✍️ {song.translator}
                                  </span>
                                )}
                              </div>
                              {song.lyricsStart && (
                                <p className="text-[10px] text-gray-500 font-normal line-clamp-2 leading-tight">
                                  "{song.lyricsStart}"
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 max-w-xs">
                            <div className="space-y-0.5">
                              <span className="text-slate-800 italic font-medium block">
                                {song.titleEn || '-'}
                              </span>
                              {song.authors && (
                                <span className="text-[10px] text-gray-400 block font-mono">
                                  {song.authors}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {song.webLink && (
                                <a
                                  href={song.webLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:text-red-700 font-medium hover:underline bg-red-50 px-2 py-1 rounded-md border border-red-100"
                                  title="YouTube / Spletna povezava"
                                >
                                  <Youtube className="w-3.5 h-3.5 shrink-0" />
                                  <span>Posnetek</span>
                                </a>
                              )}
                              {song.docLink ? (
                                <a
                                  href={song.docLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-blue-700 hover:text-blue-800 font-medium hover:underline bg-blue-50 px-2 py-1 rounded-md border border-blue-100"
                                  title="Odpri Google Doc pesmi (besedilo / prevod)"
                                >
                                  <FileText className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                                  <span>Google Doc</span>
                                </a>
                              ) : (
                                <a
                                  href={`https://drive.google.com/drive/search?q=${encodeURIComponent(song.titleSl || song.titleEn)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800 font-medium hover:underline bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100"
                                  title="Išči pesem v Google Drive"
                                >
                                  <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                                  <span>Drive</span>
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Cards View for SASU Songbook */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredSasuSongs.slice(0, sasuDisplayLimit).map((song) => (
                <div key={song.id} className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs space-y-2.5 hover:border-amber-300 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        #{song.number}
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 font-display">
                          {song.titleSl || song.titleEn}
                        </h4>
                        {song.titleEn && song.titleSl && (
                          <p className="text-[11px] text-gray-500 italic">{song.titleEn}</p>
                        )}
                      </div>
                    </div>

                    {song.isKalvarijaActive && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-indigo-100 text-indigo-900 rounded-full border border-indigo-200 shrink-0">
                        Kalvarija #{song.kalvarijaSongNumber}
                      </span>
                    )}
                  </div>

                  {song.lyricsStart && (
                    <p className="text-[11px] text-gray-600 bg-slate-50 p-2 rounded-lg border border-slate-100 italic leading-snug">
                      "{song.lyricsStart}"
                    </p>
                  )}

                  <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-[10px] text-gray-500">
                    <div>
                      {song.authors && <span className="block font-medium">Avtorji: {song.authors}</span>}
                      {song.translator && <span className="block text-gray-400">Prevod: {song.translator}</span>}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {song.webLink && (
                        <a
                          href={song.webLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:underline font-medium bg-red-50 px-2 py-1 rounded border border-red-100"
                        >
                          <Youtube className="w-3.5 h-3.5 shrink-0" />
                          <span>Posnetek</span>
                        </a>
                      )}
                      {song.docLink ? (
                        <a
                          href={song.docLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-blue-700 hover:underline font-medium bg-blue-50 px-2 py-1 rounded border border-blue-100"
                          title="Odpri Google Doc pesmi (besedilo / prevod)"
                        >
                          <FileText className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                          <span>Google Doc</span>
                        </a>
                      ) : (
                        <a
                          href={`https://drive.google.com/drive/search?q=${encodeURIComponent(song.titleSl || song.titleEn)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:underline font-medium bg-emerald-50 px-2 py-1 rounded border border-emerald-100"
                          title="Išči pesem v Google Drive"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                          <span>Drive</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Load More Button if results exceed sasuDisplayLimit */}
          {filteredSasuSongs.length > sasuDisplayLimit && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setSasuDisplayLimit(prev => prev + 150)}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                {currentLanguage === 'sl' 
                  ? `Prikaži naslednjih 150 pesmi (še ${filteredSasuSongs.length - sasuDisplayLimit})` 
                  : `Load 150 more songs (${filteredSasuSongs.length - sasuDisplayLimit} remaining)`}
              </button>
            </div>
          )}
        </div>
      )}
      {activeSubTab === 'roster' && (
        <div className="space-y-4 animate-fade-in">
          {/* Controls & Filter */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
            <div className="flex items-center gap-2 flex-1">
              {/* Academic Year Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-gray-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setRosterYearView('2026_2027')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer font-mono flex items-center gap-1.5 ${
                    rosterYearView === '2026_2027'
                      ? 'bg-white text-indigo-700 shadow-2xs border border-gray-200/80'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span>2026 / 2027</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${rosterYearView === '2026_2027' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
                    {count2627}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setRosterYearView('2025_2026')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer font-mono flex items-center gap-1.5 ${
                    rosterYearView === '2025_2026'
                      ? 'bg-white text-indigo-700 shadow-2xs border border-gray-200/80'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span>2025 / 2026</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${rosterYearView === '2025_2026' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
                    {count2526}
                  </span>
                </button>
              </div>

              <div className="relative flex-1 min-w-[160px]">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  placeholder={currentLanguage === 'sl' ? 'Išči po datumu ali imenu...' : 'Filter schedule...'}
                  className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 justify-between md:justify-end">
              <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-gray-200 text-xs">
                <button
                  type="button"
                  onClick={() => setRosterViewMode('cards')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md transition cursor-pointer font-medium ${
                    rosterViewMode === 'cards' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">{currentLanguage === 'sl' ? 'Kartice' : 'Cards'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRosterViewMode('table')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md transition cursor-pointer font-medium ${
                    rosterViewMode === 'table' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">{currentLanguage === 'sl' ? 'Razpredelnica' : 'Spreadsheet'}</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-gray-400 shrink-0" />
                <select
                  value={selectedLeaderFilter}
                  onChange={(e) => setSelectedLeaderFilter(e.target.value)}
                  className="text-xs px-3 py-2 bg-slate-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer max-w-[150px] sm:max-w-none truncate"
                >
                  <option value="all">
                    {currentLanguage === 'sl' ? 'Vsi voditelji' : 'All Leaders'}
                  </option>
                  {uniqueLeaders.map(leader => (
                    <option key={leader} value={leader}>
                      👤 {leader}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {rosterViewMode === 'cards' ? (
            /* Roster Cards List */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRoster.map((entry) => {
                const isLordSupper = entry.date.includes('14.') || entry.date.includes('28.') || entry.date.includes('12.') || entry.date.includes('26.') || entry.date.includes('9.') || entry.date.includes('23.');
                const matchedSunday = sundays?.find(s => matchWorshipRosterEntry(s.date, [entry]));
                
                return (
                  <div key={entry.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs space-y-3 hover:border-indigo-200 transition">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                        {matchedSunday && onSelectSunday ? (
                          <button
                            type="button"
                            onClick={() => onSelectSunday(matchedSunday.id)}
                            className={`text-xs font-bold font-mono hover:text-indigo-600 transition cursor-pointer text-left ${isLordSupper ? 'underline decoration-indigo-500 underline-offset-4 text-indigo-950' : 'text-slate-900'}`}
                            title={currentLanguage === 'sl' ? 'Odpri celoten nedeljski razpored' : 'Open Sunday detail'}
                          >
                            {entry.date}
                          </button>
                        ) : (
                          <span className={`text-xs font-bold font-mono ${isLordSupper ? 'underline decoration-indigo-500 underline-offset-4 text-indigo-950' : 'text-slate-900'}`}>
                            {entry.date}
                          </span>
                        )}
                        {isLordSupper && (
                          <span className="text-[9px] font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold border border-indigo-100">
                            🍷 {currentLanguage === 'sl' ? 'Gospodova večerja' : 'Lord\'s Supper'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {entry.leader && (
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md font-mono">
                            👤 {entry.leader}
                          </span>
                        )}
                        {canEdit && (
                          <button
                            onClick={() => setEditingRosterEntry(entry)}
                            className="p-1 text-gray-400 hover:text-indigo-600 rounded-md hover:bg-slate-100 transition cursor-pointer"
                            title={currentLanguage === 'sl' ? 'Uredi razpored' : 'Edit Schedule'}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Service Lineup grid */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-[9px] uppercase font-bold text-gray-400 block font-mono">🎸 Akustika</span>
                        <span className="font-medium text-slate-800">{entry.acoustic || '-'}</span>
                      </div>

                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-[9px] uppercase font-bold text-gray-400 block font-mono">🥁 Bobni</span>
                        <span className="font-medium text-slate-800">{entry.drums || '-'}</span>
                      </div>

                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-[9px] uppercase font-bold text-gray-400 block font-mono">🎸 Bas</span>
                        <span className="font-medium text-slate-800">{entry.bass || '-'}</span>
                      </div>

                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-[9px] uppercase font-bold text-gray-400 block font-mono">🎹 Klaviature</span>
                        <span className="font-medium text-slate-800">{entry.keys || '-'}</span>
                      </div>
                    </div>

                    {/* Vocals Line */}
                    {entry.vocals && (
                      <div className="p-2 bg-indigo-50/50 rounded-lg border border-indigo-100/60 text-[11px]">
                        <span className="text-[9px] uppercase font-bold text-indigo-600 block font-mono">🎤 Vokali</span>
                        <span className="font-semibold text-indigo-950">{entry.vocals}</span>
                      </div>
                    )}

                    {/* Tech & Extras */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] font-mono text-gray-500 border-t border-gray-100">
                      {entry.sound && <span>🔊 Zvok: <strong className="text-slate-800">{entry.sound}</strong></span>}
                      {entry.slides && <span>💻 Projekcija: <strong className="text-slate-800">{entry.slides}</strong></span>}
                      {entry.vocalTechAbsent && <span className="text-rose-600">⚠️ Odsotni: {entry.vocalTechAbsent}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Full Roster Spreadsheet Table */
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs relative">
              {/* Sticky Scroll Hint Banner */}
              <div className="sticky top-0 z-20 px-3.5 py-2 bg-indigo-50/95 backdrop-blur-md border-b border-indigo-100 flex items-center justify-between text-[11px] text-indigo-900 font-medium flex-wrap gap-2 shadow-2xs">
                <span className="flex items-center gap-1.5 min-w-0">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="truncate">
                    {currentLanguage === 'sl' 
                      ? '💡 Vodoravni pomik razpredelnice za vse službe:'
                      : '💡 Spreadsheet view supports horizontal scroll across all service roles:'}
                  </span>
                </span>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => scrollTable(rosterTableRef, 'left')}
                      className="inline-flex items-center gap-0.5 px-2 py-1 bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-300 rounded-md shadow-2xs font-bold text-[10px] transition cursor-pointer"
                      title="Pomakni razpredelnico levo"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline">{currentLanguage === 'sl' ? 'Levo' : 'Left'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollTable(rosterTableRef, 'right')}
                      className="inline-flex items-center gap-0.5 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-600 rounded-md shadow-2xs font-bold text-[10px] transition cursor-pointer"
                      title="Pomakni razpredelnico desno"
                    >
                      <span className="hidden xs:inline">{currentLanguage === 'sl' ? 'Desno' : 'Right'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-indigo-200/80 text-indigo-700 font-bold">
                    {filteredRoster.length} {currentLanguage === 'sl' ? 'nedelj' : 'Sundays'}
                  </span>
                </div>
              </div>

              <div 
                ref={rosterTableRef} 
                className="overflow-x-auto custom-scrollbar scroll-smooth cursor-grab touch-pan-x"
                onMouseDown={(e) => handleMouseDown(e, rosterTableRef)}
                onMouseLeave={() => handleMouseUpOrLeave(rosterTableRef)}
                onMouseUp={() => handleMouseUpOrLeave(rosterTableRef)}
                onMouseMove={(e) => handleMouseMove(e, rosterTableRef)}
              >
                <table className="w-full text-left text-xs border-collapse min-w-[850px]">
                  <thead className="sticky top-0 z-10 bg-slate-100 shadow-2xs">
                    <tr className="bg-slate-100 text-gray-600 font-mono text-[10px] uppercase tracking-wider border-b border-gray-200 select-none">
                      <th className="py-2.5 px-3">Datum</th>
                      <th className="py-2.5 px-3">Voditelj</th>
                      <th className="py-2.5 px-3">Akustika</th>
                      <th className="py-2.5 px-3">Bobni</th>
                      <th className="py-2.5 px-3">Bas</th>
                      <th className="py-2.5 px-3">Klaviature</th>
                      <th className="py-2.5 px-3">Vokali</th>
                      <th className="py-2.5 px-3">Zvok</th>
                      <th className="py-2.5 px-3">Projekcija</th>
                      <th className="py-2.5 px-3">Odsotni / Opombe</th>
                      {canEdit && <th className="py-2.5 px-3 text-right">Uredi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150 text-gray-800">
                    {filteredRoster.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-950 whitespace-nowrap">
                          {entry.date}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                          {entry.leader || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{entry.acoustic || '-'}</td>
                        <td className="py-2.5 px-3 text-slate-700">{entry.drums || '-'}</td>
                        <td className="py-2.5 px-3 text-slate-700">{entry.bass || '-'}</td>
                        <td className="py-2.5 px-3 text-slate-700">{entry.keys || '-'}</td>
                        <td className="py-2.5 px-3 text-slate-800 font-medium">{entry.vocals || '-'}</td>
                        <td className="py-2.5 px-3 text-slate-700">{entry.sound || '-'}</td>
                        <td className="py-2.5 px-3 text-slate-700">{entry.slides || '-'}</td>
                        <td className="py-2.5 px-3 text-rose-600 font-mono text-[11px]">{entry.vocalTechAbsent || '-'}</td>
                        {canEdit && (
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <button
                              onClick={() => setEditingRosterEntry(entry)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-md text-[11px] font-semibold transition cursor-pointer border border-slate-200"
                            >
                              ✏️ {currentLanguage === 'sl' ? 'Uredi' : 'Edit'}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== SUB-TAB 3: SOUND & STAGE GUIDE ==================== */}
      {activeSubTab === 'sound' && (
        <div className="space-y-6 animate-fade-in">
          {/* Setup Checklist */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
              <Volume2 className="w-5 h-5 text-indigo-600 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-display">
                  {currentLanguage === 'sl' ? 'Sistem Postavljanja Opreme' : 'Stage Setup Checklist'}
                </h3>
                <p className="text-[11px] text-gray-400 font-mono">
                  {currentLanguage === 'sl' ? 'Navodila za namestitev ozvočenja pred vajo in bogoslužjem' : 'Setup steps for instrumentalists, vocals, and sound tech'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {INITIAL_SETUP_STEPS.map((step) => {
                const isDone = !!completedSteps[step.id];
                return (
                  <div 
                    key={step.id} 
                    onClick={() => handleToggleStep(step.id)}
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                      isDone ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-gray-200 hover:bg-slate-100/70'
                    }`}
                  >
                    <button 
                      type="button" 
                      className="mt-0.5 shrink-0 text-indigo-600 cursor-pointer"
                    >
                      <CheckCircle2 className={`w-5 h-5 ${isDone ? 'text-emerald-600 fill-emerald-100' : 'text-gray-300'}`} />
                    </button>
                    <div className="flex-1 space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-indigo-700">{step.stepNumber}</span>
                        {step.instrumentalists && (
                          <span className={`font-semibold ${isDone ? 'line-through text-gray-400' : 'text-slate-900'}`}>
                            {step.instrumentalists}
                          </span>
                        )}
                      </div>
                      {step.vocals && (
                        <p className={`text-[11px] text-indigo-900 bg-indigo-50/80 p-1.5 rounded-md border border-indigo-100 ${isDone ? 'line-through opacity-60' : ''}`}>
                          🎤 <strong>Vokali:</strong> {step.vocals}
                        </p>
                      )}
                      {step.flute && (
                        <p className={`text-[11px] text-emerald-900 bg-emerald-50/80 p-1.5 rounded-md border border-emerald-100 ${isDone ? 'line-through opacity-60' : ''}`}>
                          🎶 <strong>Flavta:</strong> {step.flute}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Teardown Checklist & Warning */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
              <Sliders className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-display">
                  {currentLanguage === 'sl' ? 'Sistem Pospravljanja Opreme' : 'Teardown Checklist'}
                </h3>
                <p className="text-[11px] text-gray-400 font-mono">
                  {currentLanguage === 'sl' ? 'Pravila in navodila za pospravljanje po bogoslužju' : 'Post-service cleanup and microphone storage'}
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-950 space-y-1">
                <span className="font-bold uppercase tracking-wider font-mono block">
                  ⚠️ {currentLanguage === 'sl' ? 'POMEMBNO OPOZORILO ZA MEŠALKO' : 'CRITICAL SOUND BOARD WARNING'}
                </span>
                <p className="leading-relaxed font-semibold">
                  {currentLanguage === 'sl' 
                    ? 'Pri izklapljanju kablov iz mešalke (Urh, Tonja): Prvi 4 kabli levo zgoraj se NIKOLI ne izklopijo!' 
                    : 'When disconnecting cables from the main sound board: The top-left 4 cables MUST NEVER be unplugged!'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {INITIAL_TEARDOWN_STEPS.map((step) => {
                const isDone = !!completedSteps[`td_${step.id}`];
                return (
                  <div 
                    key={step.id} 
                    onClick={() => handleToggleStep(`td_${step.id}`)}
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                      isDone ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-gray-200 hover:bg-slate-100/70'
                    }`}
                  >
                    <button 
                      type="button" 
                      className="mt-0.5 shrink-0 cursor-pointer text-indigo-600"
                    >
                      <CheckCircle2 className={`w-5 h-5 ${isDone ? 'text-emerald-600 fill-emerald-100' : 'text-gray-300'}`} />
                    </button>
                    <div className="flex-1 space-y-1 text-xs">
                      <span className="font-bold font-mono text-indigo-700 mr-2">{step.stepNumber}</span>
                      {step.vocals && (
                        <p className={`text-slate-800 ${isDone ? 'line-through text-gray-400' : ''}`}>
                          🎤 {step.vocals}
                        </p>
                      )}
                      {step.instrumentalists && (
                        <p className={`text-slate-800 font-semibold ${isDone ? 'line-through text-gray-400' : ''}`}>
                          🎸 {step.instrumentalists}
                        </p>
                      )}
                      {step.flute && (
                        <p className={`text-slate-800 ${isDone ? 'line-through text-gray-400' : ''}`}>
                          🎶 {step.flute}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}



      {/* ==================== SUB-TAB 5: SONG ARCHIVE ==================== */}
      {activeSubTab === 'archive' && (
        <div className="space-y-4 animate-fade-in">
          {/* Top Archive Mode Switcher & Stats Banner */}
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Archive className="w-5 h-5 text-indigo-400 shrink-0" />
                  <h3 className="text-base sm:text-lg font-bold font-display">
                    {currentLanguage === 'sl' ? 'Arhiv Pesmarice in Izvedb' : 'Songbook & Performance Archive'}
                  </h3>
                </div>
                <p className="text-xs text-indigo-200/90 font-mono">
                  {currentLanguage === 'sl' 
                    ? 'Pregled zgodovine izvedb prejšnjih šolskih let ter neaktivnih pesmi' 
                    : 'History of songs sung in previous school years and inactive songs'}
                </p>
              </div>

              {/* Toggle between 2025/26 Historical Stats & Retired Songs */}
              <div className="inline-flex p-1 bg-white/10 backdrop-blur-md rounded-xl border border-white/15 text-xs font-semibold self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setArchiveTabMode('historical_times')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    archiveTabMode === 'historical_times'
                      ? 'bg-white text-indigo-950 font-bold shadow-xs'
                      : 'text-indigo-200 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5 text-amber-500" />
                  <span>{currentLanguage === 'sl' ? 'Izvedbe 2025/26' : '2025/26 Times Sung'}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    archiveTabMode === 'historical_times' ? 'bg-indigo-100 text-indigo-950 font-bold' : 'bg-white/15 text-indigo-100'
                  }`}>
                    {songs.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setArchiveTabMode('retired_songs')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    archiveTabMode === 'retired_songs'
                      ? 'bg-white text-indigo-950 font-bold shadow-xs'
                      : 'text-indigo-200 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>🚫 {currentLanguage === 'sl' ? 'Upokojene pesmi' : 'Retired Songs'}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    archiveTabMode === 'retired_songs' ? 'bg-indigo-100 text-indigo-950 font-bold' : 'bg-white/15 text-indigo-100'
                  }`}>
                    {archivedSongs.length}
                  </span>
                </button>
              </div>
            </div>

            {/* Quick Stats Grid for 2025/26 when in historical mode */}
            {archiveTabMode === 'historical_times' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-white/10 text-xs">
                <div className="bg-white/10 rounded-xl p-2.5 border border-white/10">
                  <div className="text-[10px] uppercase font-mono text-indigo-300">{currentLanguage === 'sl' ? 'Šolsko leto' : 'School Year'}</div>
                  <div className="text-sm font-bold text-white font-mono mt-0.5">2025 / 2026</div>
                </div>
                <div className="bg-white/10 rounded-xl p-2.5 border border-white/10">
                  <div className="text-[10px] uppercase font-mono text-indigo-300">{currentLanguage === 'sl' ? 'Skupaj pesmi' : 'Total Songs'}</div>
                  <div className="text-sm font-bold text-amber-300 font-mono mt-0.5">{songs.length}</div>
                </div>
                <div className="bg-white/10 rounded-xl p-2.5 border border-white/10">
                  <div className="text-[10px] uppercase font-mono text-indigo-300">{currentLanguage === 'sl' ? 'Vse izvedbe 2025/26' : 'Total Plays'}</div>
                  <div className="text-sm font-bold text-emerald-300 font-mono mt-0.5">
                    {songs.reduce((sum, s) => sum + (Number(s.timesSung) || 0), 0)}×
                  </div>
                </div>
                <div className="bg-white/10 rounded-xl p-2.5 border border-white/10">
                  <div className="text-[10px] uppercase font-mono text-indigo-300">{currentLanguage === 'sl' ? 'Največkrat zapeta' : 'Top Sung Song'}</div>
                  <div className="text-sm font-bold text-white truncate mt-0.5" title="Kralj kraljev (10x)">
                    {(() => {
                      const top = [...songs].sort((a, b) => (Number(b.timesSung) || 0) - (Number(a.timesSung) || 0))[0];
                      return top ? `${top.titleSl} (${top.timesSung}×)` : '-';
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Search Input Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={archiveSearch}
                onChange={(e) => setArchiveSearch(e.target.value)}
                placeholder={
                  archiveTabMode === 'historical_times'
                    ? (currentLanguage === 'sl' ? 'Išči pesem v arhivu 2025/26 (npr. Kralj kraljev, Dober si Oče...)' : 'Search songs in 2025/26 archive...')
                    : (currentLanguage === 'sl' ? 'Išči po upokojenih pesmih...' : 'Search retired songs...')
                }
                className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* View Mode 1: 2025/2026 Historical Performance Table */}
          {archiveTabMode === 'historical_times' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="p-3 bg-slate-50 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-slate-800 font-mono flex items-center gap-1.5">
                  <History className="w-4 h-4 text-indigo-600" />
                  <span>{currentLanguage === 'sl' ? 'Arhiv izvedb pesmi za šolsko leto 2025/26' : '2025/26 School Year Performance Archive'}</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200">
                    {filteredArchivedHistorical.length} {currentLanguage === 'sl' ? 'pesmi' : 'songs'}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse min-w-[720px]">
                  <thead className="sticky top-0 z-10 bg-slate-100 shadow-2xs select-none">
                    <tr className="bg-slate-100 text-gray-600 font-mono text-[10px] uppercase tracking-wider border-b border-gray-200">
                      <th 
                        onClick={() => handleArchiveSortToggle('number')}
                        className="py-2.5 px-3 w-14 text-center shrink-0 cursor-pointer hover:bg-slate-200/80 transition"
                        title={currentLanguage === 'sl' ? 'Klikni za razvrščanje po številki pesmi' : 'Click to sort by song number'}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>#</span>
                          {archiveSortField === 'number' ? (
                            <span className="text-indigo-600 font-bold">{archiveSortDirection === 'asc' ? '▲' : '▼'}</span>
                          ) : (
                            <span className="text-gray-400 opacity-40">↕</span>
                          )}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleArchiveSortToggle('titleSl')}
                        className="py-2.5 px-3 min-w-[220px] cursor-pointer hover:bg-slate-200/80 transition"
                        title={currentLanguage === 'sl' ? 'Klikni za abecedno razvrščanje (slovenski naslov)' : 'Click to sort alphabetically (Slovenian title)'}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{currentLanguage === 'sl' ? 'Naslov pesmi' : 'Song Title'}</span>
                          <span className={`text-[10px] font-bold ${archiveSortField === 'titleSl' ? 'text-indigo-600' : 'text-gray-400 opacity-40'}`}>
                            {archiveSortField === 'titleSl' ? (archiveSortDirection === 'asc' ? '▲ A-Z' : '▼ Z-A') : '⇅'}
                          </span>
                        </div>
                      </th>
                      <th 
                        onClick={() => handleArchiveSortToggle('titleEn')}
                        className="py-2.5 px-3 min-w-[180px] cursor-pointer hover:bg-slate-200/80 transition"
                        title={currentLanguage === 'sl' ? 'Klikni za abecedno razvrščanje (originalni naslov)' : 'Click to sort alphabetically (Original title)'}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{currentLanguage === 'sl' ? 'Originalni naslov' : 'Original Title'}</span>
                          <span className={`text-[10px] font-bold ${archiveSortField === 'titleEn' ? 'text-indigo-600' : 'text-gray-400 opacity-40'}`}>
                            {archiveSortField === 'titleEn' ? (archiveSortDirection === 'asc' ? '▲ A-Z' : '▼ Z-A') : '⇅'}
                          </span>
                        </div>
                      </th>
                      <th 
                        onClick={() => handleArchiveSortToggle('timesSung')}
                        className="py-2.5 px-3 text-center min-w-[120px] cursor-pointer hover:bg-slate-200/80 transition"
                        title={currentLanguage === 'sl' ? 'Klikni za razvrščanje po številu izvedb v 2025/26' : 'Click to sort by times sung in 2025/26'}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span>{currentLanguage === 'sl' ? 'Izvedbe 2025/26' : '2025/26 Plays'}</span>
                          <span className={`text-[10px] font-bold ${archiveSortField === 'timesSung' ? 'text-indigo-600' : 'text-gray-400 opacity-40'}`}>
                            {archiveSortField === 'timesSung' ? (archiveSortDirection === 'desc' ? '▼ Največ' : '▲ Najmanj') : '⇅'}
                          </span>
                        </div>
                      </th>
                      <th className="py-2.5 px-3 text-right min-w-[200px]">{currentLanguage === 'sl' ? 'Povezave' : 'Links'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/70 text-gray-800">
                    {filteredArchivedHistorical.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-xs text-gray-400 font-mono">
                          {currentLanguage === 'sl' ? 'Ni najdenih pesmi v arhivu.' : 'No archived songs found.'}
                        </td>
                      </tr>
                    ) : (
                      filteredArchivedHistorical.map((song, i) => {
                        const badge = getCategoryBadge(song.category);
                        const count2526 = Number(song.timesSung) || 0;
                        return (
                          <tr key={song.id} className={`${badge.rowClass} transition border-b border-gray-200/50`}>
                            <td className="py-2.5 px-3 text-center font-mono text-gray-500 font-semibold text-[11px]">
                              {song.number || i + 1}
                            </td>
                            <td className="py-2.5 px-3 font-semibold">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-slate-900">{song.titleSl}</span>
                                {song.category && song.category !== 'standard' && (
                                  <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${badge.badgeClass}`}>
                                    {badge.shortLabel}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-gray-600 italic">
                              {song.titleEn || '-'}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {(() => {
                                const sungBadge = getTimesSungBadge(count2526, currentLanguage);
                                return (
                                  <span 
                                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono transition ${sungBadge.className}`}
                                    title={`2025/26: ${sungBadge.tierName}`}
                                  >
                                    {sungBadge.label}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {song.sasuNumber && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSasuSearch(song.titleSl || song.titleEn);
                                      setActiveSubTab('sasu');
                                    }}
                                    className="inline-flex items-center gap-1 text-[11px] text-amber-800 hover:text-amber-900 font-bold bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-md border border-amber-200 shadow-2xs transition cursor-pointer"
                                  >
                                    <BookOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span>SASU #{song.sasuNumber}</span>
                                  </button>
                                )}
                                {(() => {
                                  const docUrl = getSongDocUrl(song);
                                  if (docUrl) {
                                    return (
                                      <a
                                        href={docUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-[11px] text-blue-700 hover:text-blue-800 font-medium hover:underline bg-white px-2 py-1 rounded-md border border-blue-200 shadow-2xs"
                                      >
                                        <FileText className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                                        <span>Google Doc</span>
                                      </a>
                                    );
                                  }
                                  return null;
                                })()}
                                {song.youtubeUrl && (
                                  <a
                                    href={song.youtubeUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:text-red-700 font-medium hover:underline bg-white px-2 py-1 rounded-md border border-red-200 shadow-2xs"
                                  >
                                    <Youtube className="w-3.5 h-3.5 shrink-0" />
                                    <span>YouTube</span>
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* View Mode 2: Retired / Inactive Songs List */}
          {archiveTabMode === 'retired_songs' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="p-3 bg-slate-50 border-b border-gray-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 font-mono">
                  🚫 {currentLanguage === 'sl' ? 'Pesmi, ki jih trenutno ne pojemo' : 'Archived / Retired Songs List'}
                </span>
                <span className="text-[10px] font-mono text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200">
                  {filteredArchived.length} {currentLanguage === 'sl' ? 'pesmi' : 'songs'}
                </span>
              </div>

              <div className="divide-y divide-gray-150 text-xs">
                {filteredArchived.length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-400 font-mono">
                    {currentLanguage === 'sl' ? 'Ni najdenih upokojenih pesmi.' : 'No retired songs found.'}
                  </div>
                ) : (
                  filteredArchived.map((song, i) => (
                    <div key={song.id} className="p-3 flex items-center justify-between hover:bg-slate-50/70 transition">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-slate-900 block">{song.titleSl}</span>
                        {song.titleEn && (
                          <span className="text-[11px] text-gray-500 italic block">{song.titleEn}</span>
                        )}
                      </div>
                      {song.note && (
                        <span className="text-[10px] text-gray-400 font-mono bg-gray-100 px-2 py-0.5 rounded">
                          {song.note}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Roster Entry Modal */}
      {editingRosterEntry && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-150 pb-3">
              <h3 className="font-display font-semibold text-slate-900 text-sm flex items-center gap-2">
                <span>🎵 {currentLanguage === 'sl' ? 'Uredi slavilni razpored za' : 'Edit Worship Schedule for'} {editingRosterEntry.date}</span>
              </h3>
              <button onClick={() => setEditingRosterEntry(null)} className="text-gray-400 hover:text-gray-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const peopleList = [...(people && people.length > 0 ? people : INITIAL_PEOPLE)].sort((a, b) => a.name.localeCompare(b.name, 'sl'));
              const vocalList = (editingRosterEntry.vocals || '')
                .split(',')
                .map(v => v.trim())
                .filter(Boolean);

              const handleAddVocal = (name: string) => {
                if (!name || vocalList.includes(name)) return;
                const updated = [...vocalList, name].join(', ');
                setEditingRosterEntry({ ...editingRosterEntry, vocals: updated });
              };

              const handleRemoveVocal = (name: string) => {
                const updated = vocalList.filter(v => v !== name).join(', ');
                setEditingRosterEntry({ ...editingRosterEntry, vocals: updated });
              };

              const renderPersonSelect = (
                label: string, 
                value: string, 
                onChange: (val: string) => void,
                icon: string
              ) => (
                <div>
                  <label className="block font-semibold text-gray-700 text-[11px] mb-1">
                    {icon} {label}:
                  </label>
                  <select
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full p-2 bg-slate-50 hover:bg-slate-100/70 border border-gray-200 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-xs cursor-pointer"
                  >
                    <option value="">{currentLanguage === 'sl' ? '— Ni določeno —' : '— Unassigned —'}</option>
                    {value && !peopleList.some(p => p.name === value) && (
                      <option value={value}>{value} (vpisano)</option>
                    )}
                    {peopleList.map(p => (
                      <option key={p.id || p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              );

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {renderPersonSelect('Voditelj slavljenja', editingRosterEntry.leader || '', (val) => setEditingRosterEntry({ ...editingRosterEntry, leader: val }), '👑')}
                  {renderPersonSelect('Akustika', editingRosterEntry.acoustic || '', (val) => setEditingRosterEntry({ ...editingRosterEntry, acoustic: val }), '🎸')}
                  {renderPersonSelect('Klaviature', editingRosterEntry.keys || '', (val) => setEditingRosterEntry({ ...editingRosterEntry, keys: val }), '🎹')}
                  {renderPersonSelect('Bobni', editingRosterEntry.drums || '', (val) => setEditingRosterEntry({ ...editingRosterEntry, drums: val }), '🥁')}
                  {renderPersonSelect('Bas', editingRosterEntry.bass || '', (val) => setEditingRosterEntry({ ...editingRosterEntry, bass: val }), '🎸')}
                  {renderPersonSelect('Zvok (mikser)', editingRosterEntry.sound || '', (val) => setEditingRosterEntry({ ...editingRosterEntry, sound: val }), '🔊')}
                  {renderPersonSelect('Projekcija (besedila)', editingRosterEntry.slides || '', (val) => setEditingRosterEntry({ ...editingRosterEntry, slides: val }), '💻')}

                  {/* Vokali Multi-Select */}
                  <div className="sm:col-span-2 space-y-2 pt-1 border-t border-gray-150">
                    <div className="flex items-center justify-between">
                      <label className="block font-semibold text-gray-700 text-[11px]">
                        🎤 {currentLanguage === 'sl' ? 'Vokali (izberite člane ekipe):' : 'Vocals (select team members):'}
                      </label>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {vocalList.length} {currentLanguage === 'sl' ? 'izbranih' : 'selected'}
                      </span>
                    </div>

                    {/* Active Selected Vocal Chips */}
                    <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-gray-200 rounded-xl min-h-[42px] items-center">
                      {vocalList.length === 0 ? (
                        <span className="text-[11px] text-gray-400 font-mono italic">
                          {currentLanguage === 'sl' ? 'Trenutno ni izbranih vokalistov' : 'No vocalists selected'}
                        </span>
                      ) : (
                        vocalList.map((name) => (
                          <span
                            key={name}
                            className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-lg shadow-2xs"
                          >
                            <span>👤 {name}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveVocal(name)}
                              className="text-indigo-500 hover:text-rose-600 hover:bg-rose-50 p-0.5 rounded cursor-pointer transition font-bold"
                              title={currentLanguage === 'sl' ? `Odstrani ${name}` : `Remove ${name}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>

                    {/* Add Vocalist Dropdown & Quick-Add Pills */}
                    <div className="flex flex-wrap gap-1.5 items-center pt-1">
                      <span className="text-[10px] text-gray-400 font-mono font-bold uppercase">
                        {currentLanguage === 'sl' ? '+ Dodaj:' : '+ Add:'}
                      </span>
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddVocal(e.target.value);
                          }
                        }}
                        className="text-xs px-2.5 py-1 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer font-medium"
                      >
                        <option value="">{currentLanguage === 'sl' ? '+ Izberi osebo...' : '+ Choose person...'}</option>
                        {peopleList
                          .filter(p => !vocalList.includes(p.name))
                          .map(person => (
                            <option key={person.id || person.name} value={person.name}>
                              + {person.name}
                            </option>
                          ))}
                      </select>

                      {/* Quick Add Top Suggested Vocalists */}
                      <div className="flex flex-wrap gap-1 ml-auto">
                        {['NinaČ', 'Bojan', 'Whitney', 'Tonja', 'Doroteja', 'Erik', 'Aleš']
                          .filter(name => !vocalList.includes(name) && peopleList.some(p => p.name === name))
                          .slice(0, 4)
                          .map(name => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => handleAddVocal(name)}
                              className="text-[10px] font-mono px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-md transition cursor-pointer font-semibold"
                            >
                              + {name}
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-150">
              <button
                type="button"
                onClick={() => setEditingRosterEntry(null)}
                className="px-3.5 py-1.5 text-xs text-gray-600 font-semibold cursor-pointer"
              >
                {currentLanguage === 'sl' ? 'Prekliči' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveRosterEntry}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                {currentLanguage === 'sl' ? 'Shrani spremembe' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Song Modal */}
      {editingSong && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <Music className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 font-display">
                    {currentLanguage === 'sl' ? 'Uredi pesem v pesmarici' : 'Edit Worship Song'}
                  </h3>
                  <p className="text-xs text-gray-500 font-mono">
                    #{editingSong.number} • {editingSong.titleSl}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSong(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditSong} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono mb-1">
                    {currentLanguage === 'sl' ? 'Koda / Številka *' : 'Code / Song # *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={editingSong.number || ''}
                    onChange={(e) => setEditingSong({ ...editingSong, number: e.target.value })}
                    placeholder="e.g. W-42, K-05"
                    className="w-full text-xs px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono mb-1">
                    {currentLanguage === 'sl' ? 'Slovenski naslov *' : 'Slovenian Title *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={editingSong.titleSl}
                    onChange={(e) => setEditingSong({ ...editingSong, titleSl: e.target.value })}
                    placeholder="Npr. ČUDOVITO IME"
                    className="w-full text-xs px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono mb-1">
                  {currentLanguage === 'sl' ? 'Originalni angleški naslov' : 'Original English Title'}
                </label>
                <input
                  type="text"
                  value={editingSong.titleEn || ''}
                  onChange={(e) => setEditingSong({ ...editingSong, titleEn: e.target.value })}
                  placeholder="e.g. What a Beautiful Name"
                  className="w-full text-xs px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Category Selector with Color Previews */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-700 font-mono">
                  🏷️ {currentLanguage === 'sl' ? 'Kategorija in barvna oznaka pesmi:' : 'Song Category & Color Tag:'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {[
                    { id: 'favorite', label: currentLanguage === 'sl' ? '⭐ Glavni repertoar' : '⭐ Core Repertoire', desc: currentLanguage === 'sl' ? 'W- koda • Rumena' : 'W- prefix • Core Worship', bg: 'bg-amber-200 text-amber-950 border-amber-300' },
                    { id: 'great', label: currentLanguage === 'sl' ? '👍 Standardno slavljenje' : '👍 Standard Worship', desc: currentLanguage === 'sl' ? 'W- koda • Svetlo rumena' : 'W- prefix • Standard Worship', bg: 'bg-yellow-100 text-yellow-900 border-yellow-300' },
                    { id: 'kids', label: currentLanguage === 'sl' ? '👶 Otroška pesem' : '👶 Kids Song', desc: currentLanguage === 'sl' ? 'K- koda • Zelena' : 'K- prefix • Kids & Family', bg: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
                    { id: 'christmas', label: currentLanguage === 'sl' ? '🎄 Božična / Praznična' : '🎄 Christmas / Seasonal', desc: currentLanguage === 'sl' ? 'B- koda • Modra' : 'B- prefix • Holiday', bg: 'bg-sky-100 text-sky-900 border-sky-300' },
                    { id: 'standard', label: currentLanguage === 'sl' ? '✨ Nove pesmi' : '✨ New Songs', desc: currentLanguage === 'sl' ? 'W- koda • Vijolična' : 'W- prefix • Purple', bg: 'bg-purple-100 text-purple-900 border-purple-300' },
                  ].map((cat) => {
                    const isSelected = (editingSong.category || 'standard') === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setEditingSong({ ...editingSong, category: cat.id as any })}
                        className={`p-2 rounded-xl border text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                          isSelected 
                            ? `${cat.bg} border-2 font-bold ring-2 ring-indigo-400 shadow-2xs` 
                            : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-semibold">{cat.label}</div>
                          <div className="text-[10px] opacity-75 font-mono">{cat.desc}</div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-indigo-700 shrink-0 stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono mb-1">
                    {currentLanguage === 'sl' ? 'SASU Št. pesmi' : 'SASU Song #'}
                  </label>
                  <input
                    type="text"
                    value={editingSong.sasuNumber || ''}
                    onChange={(e) => setEditingSong({ ...editingSong, sasuNumber: e.target.value })}
                    placeholder="Npr. 123"
                    className="w-full text-xs px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono mb-1">
                    {currentLanguage === 'sl' ? 'YouTube posnetek URL' : 'YouTube Link URL'}
                  </label>
                  <input
                    type="url"
                    value={editingSong.youtubeUrl || ''}
                    onChange={(e) => setEditingSong({ ...editingSong, youtubeUrl: e.target.value })}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full text-xs px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono mb-1">
                  {currentLanguage === 'sl' ? 'Povezava do Google Doc akordov' : 'Google Doc Chords Link'}
                </label>
                <input
                  type="url"
                  value={editingSong.docLink || ''}
                  onChange={(e) => setEditingSong({ ...editingSong, docLink: e.target.value })}
                  placeholder="https://docs.google.com/document/d/..."
                  className="w-full text-xs px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-150">
                <button
                  type="button"
                  onClick={() => setEditingSong(null)}
                  className="px-3.5 py-1.5 text-xs text-gray-600 font-semibold cursor-pointer"
                >
                  {currentLanguage === 'sl' ? 'Prekliči' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  {currentLanguage === 'sl' ? 'Shrani spremembe' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

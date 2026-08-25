import React, { useState } from 'react';
import { ServiceSunday, Person, Translation, SundaySchoolLesson, SundaySchoolSupply, SundaySchoolGroupKey } from '../types';
import { 
  BookOpen, 
  Package, 
  Users, 
  Calendar, 
  ExternalLink, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  ShoppingBag, 
  Sparkles, 
  FileText, 
  Scissors, 
  Pencil, 
  Trash2, 
  Search, 
  Filter, 
  GraduationCap, 
  Check, 
  X,
  ChevronLeft,
  ChevronRight,
  Layers,
  Clock,
} from 'lucide-react';
import HeroHeaderBanner from './HeroHeaderBanner';
import { useBackdropHistory } from '../hooks/useBackdropHistory';

interface SundaySchoolViewProps {
  sundays: ServiceSunday[];
  people: Person[];
  lessons: SundaySchoolLesson[];
  supplies: SundaySchoolSupply[];
  onUpdateLessons: (updated: SundaySchoolLesson[]) => void;
  onUpdateSupplies: (updated: SundaySchoolSupply[]) => void;
  translations: Translation;
  currentLanguage: 'sl' | 'en';
  canEdit: boolean;
  onSelectSunday?: (sundayId: string) => void;
  onGenerateAcademicYear?: () => void;
}

export default function SundaySchoolView({
  sundays,
  people,
  lessons,
  supplies,
  onUpdateLessons,
  onUpdateSupplies,
  translations,
  currentLanguage,
  canEdit,
  onSelectSunday,
  onGenerateAcademicYear
}: SundaySchoolViewProps) {
  const [activeTab, setActiveTab] = useState<'roster' | 'lessons' | 'curriculum' | 'supplies'>('roster');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<'all' | 'mlajsa' | 'starejsa'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [rosterYearView, setRosterYearView] = useState<'2026_2027' | '2025_2026'>('2026_2027');

  const groupNavRef = React.useRef<HTMLDivElement>(null);
  const tabsNavRef = React.useRef<HTMLDivElement>(null);

  const scrollContainer = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
    if (ref.current) {
      const amount = direction === 'left' ? -180 : 180;
      ref.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  // Modals / Forms
  const [showAddLessonModal, setShowAddLessonModal] = useState(false);
  const [showAddSupplyModal, setShowAddSupplyModal] = useState(false);
  const [editingLesson, setEditingLesson] = useState<SundaySchoolLesson | null>(null);

  // New Lesson State
  const [lessonSundayId, setLessonSundayId] = useState(sundays[0]?.id || '');
  const [lessonGroup, setLessonGroup] = useState<SundaySchoolGroupKey>('mlajsa');
  const [lessonTopic, setLessonTopic] = useState('');
  const [lessonBibleStory, setLessonBibleStory] = useState('');
  const [lessonMemoryVerse, setLessonMemoryVerse] = useState('');
  const [lessonCraftAndGames, setLessonCraftAndGames] = useState('');
  const [lessonMaterialsText, setLessonMaterialsText] = useState('');
  const [lessonGoogleDoc, setLessonGoogleDoc] = useState('');
  const [lessonTeachersText, setLessonTeachersText] = useState('');
  const [lessonHelpersText, setLessonHelpersText] = useState('');
  const [lessonNotes, setLessonNotes] = useState('');

  // New Supply State
  const [editingSupply, setEditingSupply] = useState<SundaySchoolSupply | null>(null);
  const [supplyName, setSupplyName] = useState('');
  const [supplyCategory, setSupplyCategory] = useState<'crafts' | 'stationery' | 'snacks' | 'equipment' | 'other'>('crafts');
  const [supplyQuantity, setSupplyQuantity] = useState('');
  const [supplyStatus, setSupplyStatus] = useState<'ok' | 'low' | 'buy'>('ok');
  const [supplyNotes, setSupplyNotes] = useState('');

  // Master Google Doc link for Nedeljska Šola
  const masterDocUrl = 'https://docs.google.com/document/d/1_kc_kalvarija_nedeljska_sola_kurikulum_2025/edit';

  // Filter lessons
  const filteredLessons = lessons.filter(l => {
    const matchesGroup = selectedGroupFilter === 'all' || l.group === selectedGroupFilter || l.group === 'oboji';
    const matchesSearch = searchQuery === '' || 
      l.topicSl.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.bibleStorySl.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.sundayDate.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesGroup && matchesSearch;
  });

  // Filter supplies
  const filteredSupplies = supplies.filter(s => {
    return searchQuery === '' || 
      s.nameSl.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.notes?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const suppliesToBuyCount = supplies.filter(s => s.status === 'buy').length;

  // Handle Save Lesson
  const handleSaveLesson = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedSunday = sundays.find(s => s.id === lessonSundayId);
    const sundayDate = selectedSunday ? selectedSunday.date : 'Nedelja';

    const materialsList = lessonMaterialsText.split(',').map(m => m.trim()).filter(Boolean);
    const teachersList = lessonTeachersText.split(',').map(t => t.trim()).filter(Boolean);
    const helpersList = lessonHelpersText.split(',').map(h => h.trim()).filter(Boolean);

    if (editingLesson) {
      const updated = lessons.map(l => l.id === editingLesson.id ? {
        ...l,
        sundayId: lessonSundayId,
        sundayDate,
        group: lessonGroup,
        topicSl: lessonTopic,
        bibleStorySl: lessonBibleStory,
        memoryVerseSl: lessonMemoryVerse,
        craftAndGamesSl: lessonCraftAndGames,
        materialsNeeded: materialsList,
        googleDocUrl: lessonGoogleDoc,
        teachers: teachersList,
        helpers: helpersList,
        notes: lessonNotes
      } : l);
      onUpdateLessons(updated);
    } else {
      const newLesson: SundaySchoolLesson = {
        id: 'nsl-' + Date.now(),
        sundayId: lessonSundayId,
        sundayDate,
        group: lessonGroup,
        topicSl: lessonTopic,
        bibleStorySl: lessonBibleStory,
        memoryVerseSl: lessonMemoryVerse,
        craftAndGamesSl: lessonCraftAndGames,
        materialsNeeded: materialsList,
        googleDocUrl: lessonGoogleDoc,
        teachers: teachersList.length > 0 ? teachersList : ['Učitelj'],
        helpers: helpersList,
        notes: lessonNotes,
        status: 'planned'
      };
      onUpdateLessons([newLesson, ...lessons]);
    }

    resetLessonForm();
  };

  const resetLessonForm = () => {
    setShowAddLessonModal(false);
    setEditingLesson(null);
    setLessonTopic('');
    setLessonBibleStory('');
    setLessonMemoryVerse('');
    setLessonCraftAndGames('');
    setLessonMaterialsText('');
    setLessonGoogleDoc('');
    setLessonTeachersText('');
    setLessonHelpersText('');
    setLessonNotes('');
  };

  const handleEditLessonClick = (lesson: SundaySchoolLesson) => {
    setEditingLesson(lesson);
    setLessonSundayId(lesson.sundayId);
    setLessonGroup(lesson.group);
    setLessonTopic(lesson.topicSl);
    setLessonBibleStory(lesson.bibleStorySl);
    setLessonMemoryVerse(lesson.memoryVerseSl || '');
    setLessonCraftAndGames(lesson.craftAndGamesSl || '');
    setLessonMaterialsText((lesson.materialsNeeded || []).join(', '));
    setLessonGoogleDoc(lesson.googleDocUrl || '');
    setLessonTeachersText(lesson.teachers.join(', '));
    setLessonHelpersText(lesson.helpers.join(', '));
    setLessonNotes(lesson.notes || '');
    setShowAddLessonModal(true);
  };

  const handleDeleteLesson = (id: string) => {
    if (window.confirm(currentLanguage === 'sl' ? 'Ali res želite izbrisati to lekcijo?' : 'Delete this lesson?')) {
      onUpdateLessons(lessons.filter(l => l.id !== id));
    }
  };

  // Handle Save Supply
  const handleSaveSupply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplyName.trim()) return;

    if (editingSupply) {
      const updated = supplies.map(s => s.id === editingSupply.id ? {
        ...s,
        nameSl: supplyName.trim(),
        category: supplyCategory,
        quantity: supplyQuantity || '1 paket',
        status: supplyStatus,
        notes: supplyNotes
      } : s);
      onUpdateSupplies(updated);
    } else {
      const newSupply: SundaySchoolSupply = {
        id: 'sup-' + Date.now(),
        nameSl: supplyName.trim(),
        category: supplyCategory,
        quantity: supplyQuantity || '1 paket',
        status: supplyStatus,
        notes: supplyNotes
      };
      onUpdateSupplies([...supplies, newSupply]);
    }

    resetSupplyForm();
  };

  const resetSupplyForm = () => {
    setShowAddSupplyModal(false);
    setEditingSupply(null);
    setSupplyName('');
    setSupplyQuantity('');
    setSupplyNotes('');
    setSupplyCategory('crafts');
    setSupplyStatus('ok');
  };

  useBackdropHistory(showAddLessonModal, resetLessonForm, 'sunday-school-lesson-modal');
  useBackdropHistory(showAddSupplyModal, resetSupplyForm, 'sunday-school-supply-modal');

  const handleEditSupply = (sup: SundaySchoolSupply) => {
    setEditingSupply(sup);
    setSupplyName(sup.nameSl || '');
    setSupplyCategory(sup.category || 'crafts');
    setSupplyQuantity(sup.quantity || '');
    setSupplyStatus(sup.status || 'ok');
    setSupplyNotes(sup.notes || '');
    setShowAddSupplyModal(true);
  };

  const getSupplyStatusLabel = (status: 'ok' | 'low' | 'buy') => {
    if (status === 'buy') {
      return currentLanguage === 'sl' ? '🔴 NUJNO KUPITI' : '🔴 NEED TO BUY';
    }
    if (status === 'low') {
      return currentLanguage === 'sl' ? '🟡 ZMANJKUJE' : '🟡 LOW STOCK';
    }
    return currentLanguage === 'sl' ? '🟢 NA ZALOGI' : '🟢 IN STOCK';
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'crafts':
        return currentLanguage === 'sl' ? 'Ustvarjanje' : 'Crafts';
      case 'stationery':
        return currentLanguage === 'sl' ? 'Pisarniške potrebščine' : 'Stationery';
      case 'snacks':
        return currentLanguage === 'sl' ? 'Sokci & Prigrizki' : 'Snacks & Drinks';
      case 'equipment':
        return currentLanguage === 'sl' ? 'Oprema' : 'Equipment';
      default:
        return currentLanguage === 'sl' ? 'Ostalo' : 'Other';
    }
  };

  const handleToggleSupplyStatus = (id: string) => {
    const updated = supplies.map(s => {
      if (s.id === id) {
        const nextStatus: 'ok' | 'low' | 'buy' = s.status === 'ok' ? 'low' : s.status === 'low' ? 'buy' : 'ok';
        return { ...s, status: nextStatus };
      }
      return s;
    });
    onUpdateSupplies(updated);
  };

  const handleDeleteSupply = (id: string) => {
    onUpdateSupplies(supplies.filter(s => s.id !== id));
  };

  return (
    <div id="sunday-school-component" className="max-w-5xl mx-auto w-full space-y-5 animate-fade-in pb-16 px-3 sm:px-4">
      
      {/* Hero Header Banner */}
      <HeroHeaderBanner
        variant="school"
        eyebrow={currentLanguage === 'sl' ? '🏫 OTROŠKO SLUŽENJE • KC KALVARIJA' : '🏫 KIDS MINISTRY • KC KALVARIJA'}
        title={currentLanguage === 'sl' ? 'Nedeljska Šola' : 'Sunday School Hub'}
        subtitle={currentLanguage === 'sl' ? 'Centralno stičišče za učitelje: učni načrti, svetopisemske zgodbe, zaloga ustvarjalnih materialov ter razpored.' : 'Central hub for teachers: lesson plans, Bible stories, craft supply inventory, and roster.'}
        icon={GraduationCap}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={masterDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/30 text-white rounded-xl text-xs font-semibold transition flex items-center gap-2 shadow-xs backdrop-blur-md"
            >
              <FileText className="w-3.5 h-3.5 text-amber-200" />
              <span>{currentLanguage === 'sl' ? 'Glavni Kurikulum (Google Doc)' : 'Master Curriculum Doc'}</span>
              <ExternalLink className="w-3 h-3 text-white/70" />
            </a>

            {canEdit && (
              <button
                onClick={() => setShowAddLessonModal(true)}
                className="px-3.5 py-1.5 bg-white text-rose-950 hover:bg-amber-50 font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-rose-600" />
                <span>{currentLanguage === 'sl' ? 'Nova Učna Lekcija' : 'Add Lesson Plan'}</span>
              </button>
            )}
          </div>
        }
      />

      {/* Age Group Filter & Shopping List Alert Bar */}
      <div className="bg-rose-50/90 border border-rose-200/80 p-3 sm:p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
          {/* Age Group Badge */}
          <span className="hidden sm:flex px-3 py-1.5 bg-rose-100 text-rose-900 border border-rose-200 font-mono text-[11px] font-bold uppercase tracking-wider rounded-xl items-center gap-1.5 shrink-0 self-start sm:self-auto">
            <Filter className="w-3.5 h-3.5 text-rose-700" />
            <span>{currentLanguage === 'sl' ? 'Skupina:' : 'Age Group:'}</span>
          </span>

          {/* Group Buttons Container: 2-line layout on mobile (Line 1: All Groups, Line 2: Younger + Older), 1 row on desktop */}
          <div className="bg-white/80 border border-rose-200/90 p-1.5 rounded-2xl flex flex-col sm:flex-row gap-1.5 w-full sm:w-auto shadow-2xs">
            {/* Line 1 on mobile: All Groups button (full width) */}
            <button
              type="button"
              onClick={() => setSelectedGroupFilter('all')}
              className={`w-full sm:w-auto px-3.5 py-1.5 rounded-xl text-xs transition cursor-pointer text-center sm:text-left ${
                selectedGroupFilter === 'all'
                  ? 'bg-[#93032E] text-white font-bold shadow-xs border border-[#93032E]'
                  : 'bg-white text-gray-700 hover:bg-rose-100/60 border border-gray-200/80 font-medium'
              }`}
            >
              🌟 {currentLanguage === 'sl' ? 'Vsi otroci (Vse skupine)' : 'All Groups'}
            </button>

            {/* Line 2 on mobile: Younger + Older side-by-side grid */}
            <div className="grid grid-cols-2 gap-1.5 w-full sm:w-auto sm:flex sm:flex-row">
              <button
                type="button"
                onClick={() => setSelectedGroupFilter('mlajsa')}
                className={`w-full px-3 py-1.5 rounded-xl text-xs transition cursor-pointer text-center sm:text-left min-w-0 ${
                  selectedGroupFilter === 'mlajsa'
                    ? 'bg-[#93032E] text-white font-bold shadow-xs border border-[#93032E]'
                    : 'bg-white text-gray-700 hover:bg-rose-100/60 border border-gray-200/80 font-medium'
                }`}
              >
                <span className="truncate block">👦👧 {currentLanguage === 'sl' ? 'Mlajša (3–9)' : 'Younger (3-9 yrs)'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedGroupFilter('starejsa')}
                className={`w-full px-3 py-1.5 rounded-xl text-xs transition cursor-pointer text-center sm:text-left min-w-0 ${
                  selectedGroupFilter === 'starejsa'
                    ? 'bg-[#93032E] text-white font-bold shadow-xs border border-[#93032E]'
                    : 'bg-white text-gray-700 hover:bg-rose-100/60 border border-gray-200/80 font-medium'
                }`}
              >
                <span className="truncate block">🧑‍🦱👩‍🦱 {currentLanguage === 'sl' ? 'Starejša (10–15+ let)' : 'Older (10-15+ yrs)'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Inventory Alert Status */}
        {suppliesToBuyCount > 0 && (
          <div 
            onClick={() => setActiveTab('supplies')}
            className="px-3.5 py-1.5 bg-amber-100 hover:bg-amber-200 border border-amber-300/80 text-amber-950 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition w-full sm:w-auto shrink-0 shadow-2xs"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span className="truncate">
              {currentLanguage === 'sl' 
                ? `${suppliesToBuyCount} artiklov za nakup` 
                : `${suppliesToBuyCount} items on shopping list`}
            </span>
          </div>
        )}
      </div>

      {/* Main Navigation Sub-Tabs (2 Rows on Mobile Grid, 1 Row on Desktop Flex) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
        <div className="grid grid-cols-2 sm:flex sm:flex-row sm:items-center gap-1.5 bg-gray-100 p-1.5 rounded-2xl border border-gray-200 w-full sm:w-auto">
          {/* 1st: Teacher Roster */}
          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            className={`px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer min-w-0 ${
              activeTab === 'roster'
                ? 'bg-white text-orange-600 shadow-sm border border-gray-200/80'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{currentLanguage === 'sl' ? 'Razpored Učiteljev' : 'Teacher Roster'}</span>
          </button>

          {/* 2nd: Weekly Lesson Plans */}
          <button
            type="button"
            onClick={() => setActiveTab('lessons')}
            className={`px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer min-w-0 ${
              activeTab === 'lessons'
                ? 'bg-white text-orange-600 shadow-sm border border-gray-200/80'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{currentLanguage === 'sl' ? 'Tedenski Učni Načrt' : 'Weekly Lesson Plans'}</span>
            <span className="px-1.5 py-0.5 bg-orange-100 text-orange-800 rounded-md text-[10px] font-mono font-bold shrink-0">
              {filteredLessons.length}
            </span>
          </button>

          {/* 3rd: Curriculum & Docs */}
          <button
            type="button"
            onClick={() => setActiveTab('curriculum')}
            className={`px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer min-w-0 ${
              activeTab === 'curriculum'
                ? 'bg-white text-orange-600 shadow-sm border border-gray-200/80'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{currentLanguage === 'sl' ? 'Kurikulum & Gradiva' : 'Curriculum & Docs'}</span>
          </button>

          {/* 4th: Craft Supplies */}
          <button
            type="button"
            onClick={() => setActiveTab('supplies')}
            className={`px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer min-w-0 ${
              activeTab === 'supplies'
                ? 'bg-white text-orange-600 shadow-sm border border-gray-200/80'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Scissors className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{currentLanguage === 'sl' ? 'Zaloga Materialov' : 'Craft Supplies'}</span>
            {suppliesToBuyCount > 0 && (
              <span className="px-1.5 py-0.5 bg-rose-500 text-white rounded-md text-[10px] font-mono font-bold animate-pulse shrink-0">
                {suppliesToBuyCount}
              </span>
            )}
          </button>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={currentLanguage === 'sl' ? 'Išči teme, zgodbe, materiale...' : 'Search lessons, topics...'}
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* --- TAB 1: WEEKLY LESSON PLANS --- */}
      {activeTab === 'lessons' && (
        <div className="space-y-4">
          {filteredLessons.length === 0 ? (
            <div className="p-12 text-center bg-gray-50 border border-dashed border-gray-300 rounded-2xl space-y-3">
              <BookOpen className="w-10 h-10 text-gray-400 mx-auto" />
              <p className="text-sm font-semibold text-gray-700">
                {currentLanguage === 'sl' ? 'Ni vnesenih učnih lekcij za izbrano skupino' : 'No lesson plans found for selected group'}
              </p>
              {canEdit && (
                <button
                  onClick={() => setShowAddLessonModal(true)}
                  className="px-4 py-2 bg-orange-600 text-white font-bold text-xs rounded-xl shadow transition"
                >
                  {currentLanguage === 'sl' ? 'Ustvari prvo lekcijo' : 'Create First Lesson'}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredLessons.map((lesson) => {
                const isMlajsa = lesson.group === 'mlajsa';
                const isStarejsa = lesson.group === 'starejsa';

                return (
                  <div
                    key={lesson.id}
                    className={`bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between ${
                      isMlajsa 
                        ? 'border-amber-200/80 bg-gradient-to-b from-amber-50/30 to-white' 
                        : isStarejsa 
                        ? 'border-indigo-200/80 bg-gradient-to-b from-indigo-50/30 to-white' 
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Top Header line */}
                      <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono border ${
                            isMlajsa
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : isStarejsa
                              ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                              : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          }`}>
                            {isMlajsa ? '👦👧 Mlajša (3–9 let)' : isStarejsa ? '🧑‍🦱👩‍🦱 Starejša (10–15+ let)' : '🌟 Vsi otroci'}
                          </span>
                          <span className="text-xs font-bold text-gray-700 font-mono flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            <span>{lesson.sundayDate}</span>
                          </span>
                        </div>

                        {canEdit && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEditLessonClick(lesson)}
                              className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-gray-100 transition"
                              title="Uredi lekcijo"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteLesson(lesson.id)}
                              className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-gray-100 transition"
                              title="Izbriši lekcijo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Main Topic & Bible Story */}
                      <div>
                        <h3 className="text-base font-bold text-gray-900 font-display leading-tight">
                          📖 {lesson.topicSl}
                        </h3>
                        <p className="text-xs font-semibold text-orange-700 mt-1 font-sans">
                          Svetopisemska zgodba: <span className="text-gray-800 font-normal">{lesson.bibleStorySl}</span>
                        </p>
                      </div>

                      {/* Memory Verse */}
                      {lesson.memoryVerseSl && (
                        <div className="p-2.5 bg-amber-50/80 border border-amber-200/70 rounded-xl text-xs text-amber-900 italic font-serif">
                          "{lesson.memoryVerseSl}"
                        </div>
                      )}

                      {/* Craft & Games */}
                      {lesson.craftAndGamesSl && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold font-mono text-gray-400 uppercase tracking-wider block">
                            ✂️ Ustvarjanje in igre:
                          </span>
                          <p className="text-xs text-gray-700 leading-relaxed font-sans">
                            {lesson.craftAndGamesSl}
                          </p>
                        </div>
                      )}

                      {/* Materials Needed */}
                      {lesson.materialsNeeded && lesson.materialsNeeded.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold font-mono text-gray-400 uppercase tracking-wider block">
                            🎨 Potrebni ustvarjalni materiali:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {lesson.materialsNeeded.map((mat, i) => (
                              <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-700 border border-gray-200 rounded-md text-[11px]">
                                • {mat}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Footer: Roster & External Doc Link */}
                    <div className="pt-3 border-t border-gray-100 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 text-gray-700">
                          <Users className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="font-semibold text-gray-900">Učitelji:</span>
                          <span className="text-gray-600">{lesson.teachers.join(', ')}</span>
                          {lesson.helpers.length > 0 && (
                            <span className="text-gray-400 italic">({lesson.helpers.join(', ')})</span>
                          )}
                        </div>

                        {lesson.googleDocUrl && (
                          <a
                            href={lesson.googleDocUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-bold rounded-lg transition flex items-center gap-1 shrink-0"
                          >
                            <FileText className="w-3 h-3 text-blue-600" />
                            <span>Gradivo Doc</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 2: CRAFT SUPPLIES INVENTORY --- */}
      {activeTab === 'supplies' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 border border-gray-200 p-4 rounded-2xl">
            <div>
              <h3 className="text-xs font-bold text-gray-900 font-display uppercase tracking-wider">
                🎨 {currentLanguage === 'sl' ? 'Zaloga Ustvarjalnega & Učnega Materiala' : 'Craft & Teaching Supplies Inventory'}
              </h3>
              <p className="text-xs text-gray-500">
                {currentLanguage === 'sl'
                  ? 'Spremljajte zalogo barvic, papirja, lepil in sokcev za otroke. Kliknite na status za hitro spremembo.'
                  : 'Track crafts, stationery, and snack inventory for Sunday school. Click status to toggle.'}
              </p>
            </div>

            {canEdit && (
              <button
                onClick={() => {
                  resetSupplyForm();
                  setShowAddSupplyModal(true);
                }}
                className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{currentLanguage === 'sl' ? 'Dodaj Material' : 'Add Supply Item'}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filteredSupplies.map((sup) => {
              const isBuy = sup.status === 'buy';
              const isLow = sup.status === 'low';

              return (
                <div
                  key={sup.id}
                  className={`bg-white border rounded-2xl p-4 shadow-sm flex flex-col justify-between space-y-2 transition ${
                    isBuy
                      ? 'border-rose-300 bg-rose-50/30'
                      : isLow
                      ? 'border-amber-300 bg-amber-50/20'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-gray-900 font-display">
                        {sup.nameSl}
                      </h4>
                      {canEdit && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEditSupply(sup)}
                            className="p-1 text-gray-400 hover:text-indigo-600 rounded transition cursor-pointer"
                            title={currentLanguage === 'sl' ? 'Uredi material' : 'Edit supply item'}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSupply(sup.id)}
                            className="p-1 text-gray-400 hover:text-rose-600 rounded transition cursor-pointer"
                            title={currentLanguage === 'sl' ? 'Izbriši material' : 'Delete supply item'}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 font-mono">
                      {currentLanguage === 'sl' ? 'Količina:' : 'Quantity:'} <span className="font-bold text-gray-800">{sup.quantity}</span>
                    </p>

                    {sup.notes && (
                      <p className="text-[11px] text-gray-600 italic">
                        "{sup.notes}"
                      </p>
                    )}
                  </div>

                  {/* Status Switcher Button */}
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                    <button
                      onClick={() => handleToggleSupplyStatus(sup.id)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono border transition flex items-center gap-1 cursor-pointer ${
                        isBuy
                          ? 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200'
                          : isLow
                          ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                      }`}
                      title={currentLanguage === 'sl' ? 'Klikni za spremembo statusa' : 'Click to change status'}
                    >
                      <span>
                        {getSupplyStatusLabel(sup.status)}
                      </span>
                    </button>

                    <span className="text-[10px] text-gray-400 font-medium">
                      {getCategoryLabel(sup.category)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- TAB 3: ROSTER VIEW --- */}
      {activeTab === 'roster' && (() => {
        const parseSheetDate = (dateStr: string): Date => {
          if (!dateStr) return new Date(0);
          const parts = dateStr.split('.').map(p => parseInt(p.trim(), 10));
          if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
            return new Date(0);
          }
          const day = parts[0];
          const month = parts[1] - 1;
          let year = parts[2];
          if (year < 100) {
            year = 2000 + year;
          }
          return new Date(year, month, day);
        };

        const academicYear2627Start = new Date(2026, 8, 1);  // Sep 1, 2026 (first Sunday: Sep 6, 2026)
        const academicYear2627End = new Date(2027, 7, 31);   // Aug 31, 2027

        const rosterFilteredSundays = sundays.filter((s) => {
          const d = parseSheetDate(s.date);
          if (rosterYearView === '2026_2027') {
            return d >= academicYear2627Start && d <= academicYear2627End;
          } else {
            return d < academicYear2627Start;
          }
        });

        const rosterSortedSundays = [...rosterFilteredSundays].sort((a, b) => {
          return parseSheetDate(a.date).getTime() - parseSheetDate(b.date).getTime();
        });

        const getTeachersForGroup = (
          sun: ServiceSunday,
          groupKey: 'mlajsa' | 'starejsa',
          lesson?: SundaySchoolLesson
        ): string => {
          const primaryKey = groupKey === 'mlajsa' 
            ? 'OTROŠKO SLUŽENJE - MLAJŠA' 
            : 'OTROŠKO SLUŽENJE - STAREJŠA';
          const secondaryKey = groupKey === 'mlajsa' 
            ? 'nedeljska_sola_mlajsa' 
            : 'nedeljska_sola_starejsa';

          // Live assignments directly from sunday.assignments
          const directAssigned = sun.assignments?.[primaryKey] 
            || sun.assignments?.[secondaryKey]
            || sun.assignments?.[primaryKey.toLowerCase()]
            || sun.assignments?.[secondaryKey.toLowerCase()];

          if (directAssigned && directAssigned.length > 0) {
            return directAssigned.join(', ');
          }

          // Fallback to legacy 'nedeljska_sola' array where index 0 is younger, index 1 is older
          const legacyNedeljskaSola = sun.assignments?.['nedeljska_sola'];
          if (legacyNedeljskaSola && legacyNedeljskaSola.length > 0) {
            if (groupKey === 'mlajsa') {
              return legacyNedeljskaSola[0];
            } else {
              return legacyNedeljskaSola.length > 1 ? legacyNedeljskaSola[1] : legacyNedeljskaSola[0];
            }
          }

          // Fallback to legacy 'kids' array
          const legacyKids = sun.assignments?.['kids'];
          if (legacyKids && legacyKids.length > 0) {
            if (groupKey === 'mlajsa') {
              return legacyKids[0];
            } else {
              return legacyKids.length > 1 ? legacyKids[1] : legacyKids[0];
            }
          }

          // Fallback to lesson plan teachers if set
          if (lesson && lesson.teachers && lesson.teachers.length > 0) {
            return lesson.teachers.join(', ');
          }

          return currentLanguage === 'sl' ? 'Ni razporejeno' : 'Unassigned';
        };

        return (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 font-display">
                    👥 {currentLanguage === 'sl' ? 'Razpored Učiteljev Nedeljske Šola po Nedeljah' : 'Sunday School Teacher Roster per Sunday'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {currentLanguage === 'sl'
                      ? 'Pregled razporejenih služabnikov v otroški cerkvi (Nedeljski šoli) po skupinah'
                      : 'Overview of Sunday school teachers assigned per group'}
                  </p>
                </div>

                {/* Academic Year Toggle Pills */}
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200 shrink-0 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setRosterYearView('2026_2027')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer font-mono ${
                      rosterYearView === '2026_2027'
                        ? 'bg-white text-orange-600 shadow-xs border border-gray-200/80'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    2026 / 2027
                  </button>
                  <button
                    type="button"
                    onClick={() => setRosterYearView('2025_2026')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer font-mono ${
                      rosterYearView === '2025_2026'
                        ? 'bg-white text-orange-600 shadow-xs border border-gray-200/80'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    2025 / 2026
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {rosterSortedSundays.length === 0 ? (
                  <div className="p-8 text-center bg-gray-50 border border-dashed border-gray-300 rounded-xl space-y-3">
                    <Calendar className="w-8 h-8 text-gray-400 mx-auto" />
                    <p className="text-xs font-semibold text-gray-600">
                      {currentLanguage === 'sl'
                        ? 'Za šolsko leto 2026 / 2027 trenutno še ni vnesenih nedeljskih razporedov.'
                        : 'No Sunday schedules found for academic year 2026 / 2027.'}
                    </p>
                    {onGenerateAcademicYear && (
                      <button
                        type="button"
                        onClick={onGenerateAcademicYear}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
                      >
                        {currentLanguage === 'sl' ? '🗓️ Generiraj 2026 / 2027 Šolsko Leto' : '🗓️ Generate 2026 / 2027 Academic Year'}
                      </button>
                    )}
                  </div>
                ) : (
                  rosterSortedSundays.map((sun) => {
                    const youngerLesson = lessons.find(l => (l.sundayId === sun.id || l.sundayDate === sun.date) && l.group === 'mlajsa');
                    const olderLesson = lessons.find(l => (l.sundayId === sun.id || l.sundayDate === sun.date) && l.group === 'starejsa');
                    const youngerTeachers = getTeachersForGroup(sun, 'mlajsa', youngerLesson);
                    const olderTeachers = getTeachersForGroup(sun, 'starejsa', olderLesson);

                    return (
                      <div key={sun.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-gray-900 font-mono">{sun.date}</span>
                            {sun.themeSl && (
                              <span className="text-xs text-gray-500 italic">• {sun.themeSl}</span>
                            )}
                          </div>
                          {onSelectSunday && (
                            <button
                              type="button"
                              onClick={() => onSelectSunday(sun.id)}
                              className="text-xs text-orange-600 font-bold hover:text-orange-700 hover:underline flex items-center gap-1 cursor-pointer transition"
                            >
                              <span>{currentLanguage === 'sl' ? 'Uredi razpored →' : 'Edit Roster →'}</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Younger group */}
                          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-amber-900 font-display">
                                👦👧 Mlajša skupina (3–9 let)
                              </span>
                            </div>
                            <p className="text-xs text-gray-700">
                              <span className="font-semibold text-amber-800">Učitelji: </span>
                              {youngerTeachers}
                            </p>
                            <p className="text-[11px] text-gray-600">
                              <span className="font-semibold">Tema: </span>
                              {youngerLesson ? youngerLesson.topicSl : (currentLanguage === 'sl' ? 'Lekcija še ni vnesena' : 'No lesson plan yet')}
                            </p>
                          </div>

                          {/* Older group */}
                          <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-indigo-900 font-display">
                                🧑‍🦱👩‍🦱 Starejša skupina (10–15+ let)
                              </span>
                            </div>
                            <p className="text-xs text-gray-700">
                              <span className="font-semibold text-indigo-800">Učitelji: </span>
                              {olderTeachers}
                            </p>
                            <p className="text-[11px] text-gray-600">
                              <span className="font-semibold">Tema: </span>
                              {olderLesson ? olderLesson.topicSl : (currentLanguage === 'sl' ? 'Lekcija še ni vnesena' : 'No lesson plan yet')}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* --- TAB 4: CURRICULUM & GOOGLE DOCS --- */}
      {activeTab === 'curriculum' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="p-3 bg-orange-100 text-orange-800 rounded-2xl">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 font-display">
                  {currentLanguage === 'sl' ? 'Učni Načrt in Smernice za Nedeljsko Šolo' : 'Sunday School Curriculum & Teaching Guidelines'}
                </h3>
                <p className="text-xs text-gray-500">
                  {currentLanguage === 'sl'
                    ? 'Uradni kurikulum KC Kalvarija, navodila za izvajanje učnih ur in letni načrt svetopisemskih tem.'
                    : 'Official church curriculum guidelines, teaching instructions, and annual lesson syllabus.'}
                </p>
              </div>
            </div>

            <div className="p-4 bg-orange-50/80 border border-orange-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-xs font-bold text-orange-950 block">
                  📄 {currentLanguage === 'sl' ? 'Glavni Kurikulum Doc (Google Docs)' : 'Master Curriculum Document (Google Docs)'}
                </span>
                <p className="text-xs text-orange-900/80">
                  {currentLanguage === 'sl'
                    ? 'Dostopajte do celotnega letnega pregleda tem, učnih stihov in ročnih del.'
                    : 'Access full syllabus, memory verses, and craft references.'}
                </p>
              </div>
              <a
                href={masterDocUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2 shrink-0"
              >
                <span>{currentLanguage === 'sl' ? 'Odpri Google Doc' : 'Open Google Doc'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD / EDIT LESSON MODAL --- */}
      {showAddLessonModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4 border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-900 font-display flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-orange-600" />
                <span>{editingLesson ? (currentLanguage === 'sl' ? 'Uredi Učno Lekcijo' : 'Edit Lesson Plan') : (currentLanguage === 'sl' ? 'Nova Učna Lekcija • Nedeljska Šola' : 'New Lesson Plan • Kids Ministry')}</span>
              </h3>
              <button
                onClick={resetLessonForm}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLesson} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 font-mono mb-1">
                    Nedelja:
                  </label>
                  <select
                    value={lessonSundayId}
                    onChange={(e) => setLessonSundayId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono text-gray-900 focus:outline-none focus:border-orange-500"
                  >
                    {sundays.map(s => (
                      <option key={s.id} value={s.id}>{s.date} {s.themeSl ? `(${s.themeSl})` : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 font-mono mb-1">
                    Starostna Skupina:
                  </label>
                  <select
                    value={lessonGroup}
                    onChange={(e) => setLessonGroup(e.target.value as SundaySchoolGroupKey)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-orange-500 font-semibold"
                  >
                    <option value="mlajsa">👦👧 Mlajša skupina (3–9 let)</option>
                    <option value="starejsa">🧑‍🦱👩‍🦱 Starejša skupina (10–15+ let)</option>
                    <option value="oboji">🌟 Obe skupini skupaj</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 font-mono mb-1">
                  Tema Lekcije:*
                </label>
                <input
                  type="text"
                  required
                  value={lessonTopic}
                  onChange={(e) => setLessonTopic(e.target.value)}
                  placeholder="npr. Jezus je moj Dobri Pastir"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 font-mono mb-1">
                  Svetopisemska Zgodba / Odlomek:*
                </label>
                <input
                  type="text"
                  required
                  value={lessonBibleStory}
                  onChange={(e) => setLessonBibleStory(e.target.value)}
                  placeholder="npr. Prilika o izgubljeni ovci (Luka 15:1-7)"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 font-mono mb-1">
                  Učni Stih / Vrstica za Pomnjenje:
                </label>
                <input
                  type="text"
                  value={lessonMemoryVerse}
                  onChange={(e) => setLessonMemoryVerse(e.target.value)}
                  placeholder="npr. Gospod je moj pastir, nič mi ne manjka. (Psalm 23:1)"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 font-mono mb-1">
                  Ustvarjanje & Igre:
                </label>
                <textarea
                  rows={2}
                  value={lessonCraftAndGames}
                  onChange={(e) => setLessonCraftAndGames(e.target.value)}
                  placeholder="Opis ročnega dela ali igre..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 font-mono mb-1">
                  Potrebni Materiali (ločeno s vejico):
                </label>
                <input
                  type="text"
                  value={lessonMaterialsText}
                  onChange={(e) => setLessonMaterialsText(e.target.value)}
                  placeholder="npr. Papirnati krožniki, Vata, Lepilo, Škarje"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 font-mono mb-1">
                    Učitelji:
                  </label>
                  <input
                    type="text"
                    value={lessonTeachersText}
                    onChange={(e) => setLessonTeachersText(e.target.value)}
                    placeholder="npr. Maja Lajlar, Peter Kovač"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 font-mono mb-1">
                    Pomočniki:
                  </label>
                  <input
                    type="text"
                    value={lessonHelpersText}
                    onChange={(e) => setLessonHelpersText(e.target.value)}
                    placeholder="npr. Kaja Vrečko"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 font-mono mb-1">
                  Povezava do Google Doc Gradiva:
                </label>
                <input
                  type="url"
                  value={lessonGoogleDoc}
                  onChange={(e) => setLessonGoogleDoc(e.target.value)}
                  placeholder="https://docs.google.com/document/d/..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={resetLessonForm}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Prekliči
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                >
                  {editingLesson ? 'Posodobi Lekcijo' : 'Shrani Učno Lekcijo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD / EDIT SUPPLY MODAL --- */}
      {showAddSupplyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-900 font-display flex items-center gap-2">
                <Scissors className="w-4 h-4 text-orange-600" />
                <span>
                  {editingSupply 
                    ? (currentLanguage === 'sl' ? 'Uredi Material • Nedeljska Šola' : 'Edit Supply Item • Kids Ministry') 
                    : (currentLanguage === 'sl' ? 'Dodaj Material v Zalogo • Nedeljska Šola' : 'Add Supply Item • Kids Ministry')}
                </span>
              </h3>
              <button
                onClick={resetSupplyForm}
                className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupply} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 font-mono mb-1">
                  {currentLanguage === 'sl' ? 'Naziv Materiala:*' : 'Item Name:*'}
                </label>
                <input
                  type="text"
                  required
                  value={supplyName}
                  onChange={(e) => setSupplyName(e.target.value)}
                  placeholder={currentLanguage === 'sl' ? "npr. Lepilo v stiku (UHU)" : "e.g. Glue sticks"}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-orange-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 font-mono mb-1">
                    {currentLanguage === 'sl' ? 'Kategorija:' : 'Category:'}
                  </label>
                  <select
                    value={supplyCategory}
                    onChange={(e) => setSupplyCategory(e.target.value as any)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-orange-500 font-medium"
                  >
                    <option value="crafts">{currentLanguage === 'sl' ? 'Ustvarjanje' : 'Crafts'}</option>
                    <option value="stationery">{currentLanguage === 'sl' ? 'Pisarniške potrebščine' : 'Stationery'}</option>
                    <option value="snacks">{currentLanguage === 'sl' ? 'Sokci & Prigrizki' : 'Snacks & Drinks'}</option>
                    <option value="equipment">{currentLanguage === 'sl' ? 'Oprema' : 'Equipment'}</option>
                    <option value="other">{currentLanguage === 'sl' ? 'Ostalo' : 'Other'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 font-mono mb-1">
                    {currentLanguage === 'sl' ? 'Količina:' : 'Quantity:'}
                  </label>
                  <input
                    type="text"
                    value={supplyQuantity}
                    onChange={(e) => setSupplyQuantity(e.target.value)}
                    placeholder={currentLanguage === 'sl' ? "npr. 5 kosov" : "e.g. 5 packs"}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 font-mono mb-1">
                  {currentLanguage === 'sl' ? 'Status Zaloge:' : 'Inventory Status:'}
                </label>
                <select
                  value={supplyStatus}
                  onChange={(e) => setSupplyStatus(e.target.value as any)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-orange-500"
                >
                  <option value="ok">{currentLanguage === 'sl' ? '🟢 Na zalogi (Imamo dovolj)' : '🟢 In Stock (Sufficient)'}</option>
                  <option value="low">{currentLanguage === 'sl' ? '🟡 Zmanjkuje (Priporočljiv nakup)' : '🟡 Low Stock (Running low)'}</option>
                  <option value="buy">{currentLanguage === 'sl' ? '🔴 Nujno kupiti (Dodaj na nakupovalni seznam)' : '🔴 Need to Buy (Add to shopping list)'}</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 font-mono mb-1">
                  {currentLanguage === 'sl' ? 'Opomba / Lokacija Shranjevanja:' : 'Notes / Storage Location:'}
                </label>
                <input
                  type="text"
                  value={supplyNotes}
                  onChange={(e) => setSupplyNotes(e.target.value)}
                  placeholder={currentLanguage === 'sl' ? "npr. Preveri v sprednji omarici" : "e.g. Front cupboard top shelf"}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={resetSupplyForm}
                  className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  {currentLanguage === 'sl' ? 'Prekliči' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                >
                  {editingSupply 
                    ? (currentLanguage === 'sl' ? 'Shrani Spremembe' : 'Save Changes') 
                    : (currentLanguage === 'sl' ? 'Dodaj v Zalogo' : 'Add to Inventory')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

import React, { useState } from 'react';
import { ServiceSunday, Person, Translation, SundaySchoolLesson, SundaySchoolSupply, SundaySchoolGroupKey, BlackoutDate, Ministry } from '../types';
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
  UserPlus,
  AlertTriangle
} from 'lucide-react';
import HeroHeaderBanner from './HeroHeaderBanner';
import { useBackdropHistory } from '../hooks/useBackdropHistory';
import { checkPersonAbsenceOnSunday } from './SundayDetail';

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
  onUpdateSunday?: (updated: ServiceSunday) => void;
  onGenerateAcademicYear?: () => void;
  blackoutDates?: BlackoutDate[];
  ministries?: Ministry[];
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
  onUpdateSunday,
  onGenerateAcademicYear,
  blackoutDates,
  ministries
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
  const [lessonDescription, setLessonDescription] = useState('');
  const [lessonMemoryVerse, setLessonMemoryVerse] = useState('');
  const [lessonCraftAndGames, setLessonCraftAndGames] = useState('');
  const [lessonMaterialsText, setLessonMaterialsText] = useState('');
  const [lessonGoogleDoc, setLessonGoogleDoc] = useState('');
  const [lessonTeachersText, setLessonTeachersText] = useState('');
  const [lessonHelpersText, setLessonHelpersText] = useState('');
  const [lessonNotes, setLessonNotes] = useState('');
  const [autoAddSuppliesToInventory, setAutoAddSuppliesToInventory] = useState(true);

  // Helper to extract assigned teachers from Sunday roster
  const getAssignedTeachersForSundayAndGroup = (sundayId: string, groupKey: SundaySchoolGroupKey) => {
    const selectedSunday = sundays.find(s => s.id === sundayId);
    if (!selectedSunday || !selectedSunday.assignments) return { teachers: '', helpers: '' };

    let assigned: string[] = [];
    if (groupKey === 'mlajsa') {
      assigned = selectedSunday.assignments['nedeljska_sola_mlajsa'] || [];
      if (assigned.length === 0 && selectedSunday.assignments['nedeljska_sola']) {
        assigned = [selectedSunday.assignments['nedeljska_sola'][0]].filter(Boolean);
      }
    } else if (groupKey === 'starejsa') {
      assigned = selectedSunday.assignments['nedeljska_sola_starejsa'] || [];
      if (assigned.length === 0 && selectedSunday.assignments['nedeljska_sola']) {
        assigned = selectedSunday.assignments['nedeljska_sola'].slice(1).filter(Boolean);
        if (assigned.length === 0 && selectedSunday.assignments['nedeljska_sola'][0]) {
          assigned = [selectedSunday.assignments['nedeljska_sola'][0]];
        }
      }
    } else {
      const ml = selectedSunday.assignments['nedeljska_sola_mlajsa'] || [];
      const st = selectedSunday.assignments['nedeljska_sola_starejsa'] || [];
      const leg = selectedSunday.assignments['nedeljska_sola'] || [];
      assigned = Array.from(new Set([...ml, ...st, ...leg])).filter(Boolean);
    }

    return {
      teachers: assigned[0] || '',
      helpers: assigned.slice(1).join(', ')
    };
  };

  const openNewLessonModal = (preselectedSundayId?: string, preselectedGroup?: SundaySchoolGroupKey) => {
    resetLessonForm();
    const targetSundayId = preselectedSundayId || sundays[0]?.id || '';
    const targetGroup = preselectedGroup || 'mlajsa';
    setLessonSundayId(targetSundayId);
    setLessonGroup(targetGroup);

    const auto = getAssignedTeachersForSundayAndGroup(targetSundayId, targetGroup);
    if (auto.teachers || auto.helpers) {
      setLessonTeachersText(auto.teachers);
      setLessonHelpersText(auto.helpers);
    }
    setShowAddLessonModal(true);
  };

  const handleSundayChange = (newSundayId: string) => {
    setLessonSundayId(newSundayId);
    if (!editingLesson) {
      const auto = getAssignedTeachersForSundayAndGroup(newSundayId, lessonGroup);
      if (auto.teachers || auto.helpers) {
        setLessonTeachersText(auto.teachers);
        setLessonHelpersText(auto.helpers);
      }
    }
  };

  const handleGroupChange = (newGroup: SundaySchoolGroupKey) => {
    setLessonGroup(newGroup);
    if (!editingLesson) {
      const auto = getAssignedTeachersForSundayAndGroup(lessonSundayId, newGroup);
      if (auto.teachers || auto.helpers) {
        setLessonTeachersText(auto.teachers);
        setLessonHelpersText(auto.helpers);
      }
    }
  };

  // Quick Assign Teacher & Assistant Modal State
  const [quickAssignModalOpen, setQuickAssignModalOpen] = useState(false);
  const [quickAssignSundayId, setQuickAssignSundayId] = useState<string>('');
  const [quickAssignGroup, setQuickAssignGroup] = useState<'mlajsa' | 'starejsa'>('mlajsa');
  const [quickAssignTeacher, setQuickAssignTeacher] = useState<string>('');
  const [quickAssignHelper, setQuickAssignHelper] = useState<string>('');
  const [quickAssignSyncLesson, setQuickAssignSyncLesson] = useState<boolean>(true);

  const openQuickAssignModal = (sundayId: string, group: 'mlajsa' | 'starejsa') => {
    const sun = sundays.find(s => s.id === sundayId);
    if (!sun) return;

    setQuickAssignSundayId(sundayId);
    setQuickAssignGroup(group);

    const primaryKey = group === 'mlajsa' ? 'OTROŠKO SLUŽENJE - MLAJŠA' : 'OTROŠKO SLUŽENJE - STAREJŠA';
    const secondaryKey = group === 'mlajsa' ? 'nedeljska_sola_mlajsa' : 'nedeljska_sola_starejsa';

    let assigned = sun.assignments?.[primaryKey] 
      || sun.assignments?.[secondaryKey] 
      || sun.assignments?.[primaryKey.toLowerCase()] 
      || sun.assignments?.[secondaryKey.toLowerCase()] 
      || [];

    if (assigned.length === 0 && sun.assignments?.['nedeljska_sola']) {
      if (group === 'mlajsa') {
        assigned = [sun.assignments['nedeljska_sola'][0]].filter(Boolean);
      } else {
        assigned = sun.assignments['nedeljska_sola'].slice(1).filter(Boolean);
      }
    }

    setQuickAssignTeacher(assigned[0] || '');
    setQuickAssignHelper(assigned[1] || '');
    setQuickAssignSyncLesson(true);
    setQuickAssignModalOpen(true);
  };

  const handleSaveQuickAssign = (e: React.FormEvent) => {
    e.preventDefault();
    const sun = sundays.find(s => s.id === quickAssignSundayId);
    if (!sun || !onUpdateSunday) return;

    const primaryKey = quickAssignGroup === 'mlajsa' ? 'OTROŠKO SLUŽENJE - MLAJŠA' : 'OTROŠKO SLUŽENJE - STAREJŠA';
    const secondaryKey = quickAssignGroup === 'mlajsa' ? 'nedeljska_sola_mlajsa' : 'nedeljska_sola_starejsa';

    const newTeam = [quickAssignTeacher.trim(), quickAssignHelper.trim()].filter(Boolean);

    const updatedAssignments = {
      ...(sun.assignments || {}),
      [secondaryKey]: newTeam,
      [primaryKey]: newTeam
    };

    const updatedSunday: ServiceSunday = {
      ...sun,
      assignments: updatedAssignments
    };

    onUpdateSunday(updatedSunday);

    // Sync with existing lesson plan if checked
    if (quickAssignSyncLesson) {
      const existingLesson = lessons.find(l => (l.sundayId === quickAssignSundayId || l.sundayDate === sun.date) && l.group === quickAssignGroup);
      if (existingLesson) {
        const updatedLessons = lessons.map(l => l.id === existingLesson.id ? {
          ...l,
          teachers: quickAssignTeacher.trim() ? [quickAssignTeacher.trim()] : [],
          helpers: quickAssignHelper.trim() ? [quickAssignHelper.trim()] : []
        } : l);
        onUpdateLessons(updatedLessons);
      }
    }

    setQuickAssignModalOpen(false);
  };

  const getPersonConflictInfo = (personName: string, targetSunday: ServiceSunday | undefined) => {
    if (!personName || !targetSunday) return null;
    const nameNorm = personName.toLowerCase().trim();

    if (blackoutDates && blackoutDates.length > 0) {
      const absence = checkPersonAbsenceOnSunday(personName, targetSunday.date, blackoutDates);
      if (absence.isAbsent) {
        return { type: 'absent', label: currentLanguage === 'sl' ? `Odsoten (${absence.reason || 'Dopust'})` : `Absent (${absence.reason || 'Vacation'})` };
      }
    }

    if (targetSunday.assignments) {
      for (const [minId, list] of Object.entries(targetSunday.assignments)) {
        if (
          minId === 'nedeljska_sola_mlajsa' || 
          minId === 'nedeljska_sola_starejsa' || 
          minId === 'nedeljska_sola' ||
          minId === 'OTROŠKO SLUŽENJE - MLAJŠA' ||
          minId === 'OTROŠKO SLUŽENJE - STAREJŠA'
        ) continue;

        if (Array.isArray(list) && list.some(n => n && n.toLowerCase().trim() === nameNorm)) {
          const minObj = ministries?.find(m => m.id === minId || m.nameSl.toLowerCase() === minId.toLowerCase());
          const minName = minObj ? (currentLanguage === 'sl' ? minObj.nameSl : minObj.nameEn) : minId;
          return { type: 'busy', label: currentLanguage === 'sl' ? `Že v službi: ${minName}` : `Already serving: ${minName}` };
        }
      }
    }

    return null;
  };

  const getGroupCoverage = (sun: ServiceSunday, groupKey: 'mlajsa' | 'starejsa', lesson?: SundaySchoolLesson) => {
    const primaryKey = groupKey === 'mlajsa' ? 'OTROŠKO SLUŽENJE - MLAJŠA' : 'OTROŠKO SLUŽENJE - STAREJŠA';
    const secondaryKey = groupKey === 'mlajsa' ? 'nedeljska_sola_mlajsa' : 'nedeljska_sola_starejsa';

    let assigned = sun.assignments?.[primaryKey] 
      || sun.assignments?.[secondaryKey] 
      || sun.assignments?.[primaryKey.toLowerCase()] 
      || sun.assignments?.[secondaryKey.toLowerCase()] 
      || [];

    if (assigned.length === 0 && sun.assignments?.['nedeljska_sola'] && sun.assignments['nedeljska_sola'].length > 0) {
      if (groupKey === 'mlajsa') {
        assigned = [sun.assignments['nedeljska_sola'][0]].filter(Boolean);
      } else {
        assigned = sun.assignments['nedeljska_sola'].slice(1).filter(Boolean);
        if (assigned.length === 0 && sun.assignments['nedeljska_sola'][0]) {
          assigned = [sun.assignments['nedeljska_sola'][0]];
        }
      }
    }

    let teacher = assigned[0] || (lesson?.teachers?.[0] !== 'Učitelj' ? lesson?.teachers?.[0] : '') || '';
    let helper = assigned[1] || lesson?.helpers?.[0] || '';

    let status: 'full' | 'missing_helper' | 'empty' = 'empty';
    if (teacher && helper) {
      status = 'full';
    } else if (teacher && !helper) {
      status = 'missing_helper';
    } else {
      status = 'empty';
    }

    return {
      teacher: teacher || '',
      helper: helper || '',
      status
    };
  };

  const getMinistryIconEmoji = (minId: string): string => {
    switch (minId) {
      case 'cistoca': return '✨';
      case 'zgornja_dvorana': return '🏠';
      case 'odklepanje': return '🔑';
      case 'zaklepanje': return '🔒';
      case 'koncni_pregled': return '📋';
      case 'gostoljubje': return '🥤';
      case 'kava': return '☕';
      case 'hrana': return '🍽️';
      case 'barista': return '🔥';
      case 'sprejem_reditelji': return '🤝';
      case 'ucenje': return '📖';
      case 'obvestila': return '📢';
      case 'pricevanja': return '💬';
      case 'molitev_po': return '🙏';
      case 'slavilna_ekipa': return '🎵';
      case 'uvod_slavljenje': return '🎤';
      case 'postavitev_av': return '🎥';
      case 'zvok': return '🎚️';
      case 'besedila': return '🖥️';
      case 'editiranje': return '🎬';
      case 'nedeljska_sola_mlajsa': return '👶';
      case 'nedeljska_sola_starejsa': return '🎓';
      case 'prevajanje': return '🌐';
      case 'finance': return '🪙';
      case 'gospodova_vecerja': return '🍷';
      default: return '📌';
    }
  };

  // Helper to get 3-Tier sorted candidate list (Starred at top, Other in middle, Unavailable at bottom)
  const getSortedCandidateList = (targetSunday: ServiceSunday | undefined, groupKey?: SundaySchoolGroupKey) => {
    const list = (people || []).map(p => {
      // 1. Check if person prefers or leads kids ministry (Starred ⭐)
      const isPref = (Array.isArray(p.preferredMinistries) && (
        p.preferredMinistries.includes('nedeljska_sola') ||
        p.preferredMinistries.includes('nedeljska_sola_mlajsa') ||
        p.preferredMinistries.includes('nedeljska_sola_starejsa') ||
        p.preferredMinistries.includes('OTROŠKO SLUŽENJE - MLAJŠA') ||
        p.preferredMinistries.includes('OTROŠKO SLUŽENJE - STAREJŠA') ||
        p.preferredMinistries.includes('OTROŠKO SLUŽENJE') ||
        p.preferredMinistries.includes('kids')
      )) || (
        Array.isArray(p.ledMinistries) && (
          p.ledMinistries.includes('nedeljska_sola') ||
          p.ledMinistries.includes('nedeljska_sola_mlajsa') ||
          p.ledMinistries.includes('nedeljska_sola_starejsa') ||
          p.ledMinistries.includes('OTROŠKO SLUŽENJE - MLAJŠA') ||
          p.ledMinistries.includes('OTROŠKO SLUŽENJE - STAREJŠA') ||
          p.ledMinistries.includes('OTROŠKO SLUŽENJE') ||
          p.ledMinistries.includes('kids')
        )
      );

      // 2. Check conflicts (absent on vacation, or already serving elsewhere)
      const conflict = getPersonConflictInfo(p.name, targetSunday);
      const isUnavailable = !!conflict;

      // 3. Check what other ministries this person is signed up for on this Sunday
      const otherAssignments: { minId: string; name: string; emoji: string }[] = [];
      if (targetSunday?.assignments) {
        for (const [minId, assignedList] of Object.entries(targetSunday.assignments)) {
          if (
            minId === 'nedeljska_sola_mlajsa' || 
            minId === 'nedeljska_sola_starejsa' || 
            minId === 'nedeljska_sola' ||
            minId === 'OTROŠKO SLUŽENJE - MLAJŠA' ||
            minId === 'OTROŠKO SLUŽENJE - STAREJŠA'
          ) continue;

          if (Array.isArray(assignedList) && assignedList.some(n => n && n.toLowerCase().trim() === p.name.toLowerCase().trim())) {
            const minObj = ministries?.find(m => m.id === minId || m.nameSl.toLowerCase() === minId.toLowerCase());
            const name = minObj ? (currentLanguage === 'sl' ? minObj.nameSl : minObj.nameEn) : minId;
            const emoji = getMinistryIconEmoji(minId);
            otherAssignments.push({ minId, name, emoji });
          }
        }
      }

      // Tier 1: Starred / Preferred & Available (⭐)
      // Tier 2: Other Available Church Members (👤)
      // Tier 3: Unavailable / On Vacation / Busy elsewhere (⚠️)
      const tier = isUnavailable ? 3 : isPref ? 1 : 2;

      return {
        person: p,
        isPref,
        conflict,
        otherAssignments,
        tier
      };
    });

    list.sort((a, b) => {
      if (a.tier !== b.tier) {
        return a.tier - b.tier;
      }
      return a.person.name.localeCompare(b.person.name, 'sl');
    });

    return list;
  };

  // New Supply State
  const [editingSupply, setEditingSupply] = useState<SundaySchoolSupply | null>(null);
  const [supplyName, setSupplyName] = useState('');
  const [supplyCategory, setSupplyCategory] = useState<SundaySchoolSupply['category']>('basic');
  const [supplyQuantity, setSupplyQuantity] = useState('');
  const [supplyStatus, setSupplyStatus] = useState<'ok' | 'low' | 'buy'>('ok');
  const [supplyNotes, setSupplyNotes] = useState('');
  const [selectedSupplyCategory, setSelectedSupplyCategory] = useState<string>('all');
  const [onlyShowShoppingList, setOnlyShowShoppingList] = useState<boolean>(false);

  // Master Google Doc link for Nedeljska Šola
  const masterDocUrl = 'https://docs.google.com/document/d/1_kc_kalvarija_nedeljska_sola_kurikulum_2025/edit';

  // Filter lessons
  const filteredLessons = lessons.filter(l => {
    const matchesGroup = selectedGroupFilter === 'all' || l.group === selectedGroupFilter || l.group === 'oboji';
    const matchesSearch = searchQuery === '' || 
      l.topicSl.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.bibleStorySl.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.descriptionSl && l.descriptionSl.toLowerCase().includes(searchQuery.toLowerCase())) ||
      l.sundayDate.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesGroup && matchesSearch;
  });

  // Filter supplies
  const filteredSupplies = supplies.map(s => {
    if ((s.category as string) === 'wood') return { ...s, category: 'crafts' as const };
    if ((s.category as string) === 'other' || (s.category as string) === 'things') return { ...s, category: 'random' as const };
    return s;
  }).filter(s => {
    const matchesCategory = selectedSupplyCategory === 'all' || s.category === selectedSupplyCategory;
    const matchesShoppingList = !onlyShowShoppingList || s.status === 'buy';
    const matchesSearch = searchQuery === '' || 
      s.nameSl.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesShoppingList && matchesSearch;
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

    // Auto-add materials to supplies inventory if requested
    if (autoAddSuppliesToInventory && materialsList.length > 0) {
      const existingNames = new Set(supplies.map(s => s.nameSl.toLowerCase().trim()));
      const newItemsToAdd: SundaySchoolSupply[] = [];

      materialsList.forEach((matName, idx) => {
        if (!existingNames.has(matName.toLowerCase().trim())) {
          newItemsToAdd.push({
            id: 'sup-auto-' + Date.now() + '-' + idx,
            nameSl: matName,
            category: 'crafts',
            quantity: '1 paket',
            status: 'ok',
            notes: `Dodano ob lekciji: ${lessonTopic || sundayDate}`
          });
          existingNames.add(matName.toLowerCase().trim());
        }
      });

      if (newItemsToAdd.length > 0) {
        onUpdateSupplies([...supplies, ...newItemsToAdd]);
      }
    }

    if (editingLesson) {
      const updated = lessons.map(l => l.id === editingLesson.id ? {
        ...l,
        sundayId: lessonSundayId,
        sundayDate,
        group: lessonGroup,
        topicSl: lessonTopic,
        bibleStorySl: lessonBibleStory,
        descriptionSl: lessonDescription.trim(),
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
        descriptionSl: lessonDescription.trim(),
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
    setLessonDescription('');
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
    setLessonDescription(lesson.descriptionSl || '');
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
    setSupplyCategory('basic');
    setSupplyStatus('ok');
  };

  useBackdropHistory(showAddLessonModal, resetLessonForm, 'sunday-school-lesson-modal');
  useBackdropHistory(showAddSupplyModal, resetSupplyForm, 'sunday-school-supply-modal');
  useBackdropHistory(quickAssignModalOpen, () => setQuickAssignModalOpen(false), 'quick-assign-teacher-modal');

  const handleEditSupply = (sup: SundaySchoolSupply) => {
    setEditingSupply(sup);
    setSupplyName(sup.nameSl || '');
    setSupplyCategory(sup.category || 'basic');
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
      case 'basic':
        return currentLanguage === 'sl' ? '✏️ Osnovno' : '✏️ Basic';
      case 'paper':
        return currentLanguage === 'sl' ? '📄 Papir' : '📄 Paper';
      case 'christmas':
        return currentLanguage === 'sl' ? '🎁 Božična darila' : '🎁 Christmas Gifts';
      case 'decorations':
        return currentLanguage === 'sl' ? '✨ Dekoracije' : '✨ Decorations';
      case 'wood':
      case 'crafts':
        return currentLanguage === 'sl' ? '🎨 Ustvarjanje' : '🎨 Crafts';
      case 'stationery':
        return currentLanguage === 'sl' ? '✂️ Pisarniške potrebščine' : '✂️ Stationery';
      case 'snacks':
        return currentLanguage === 'sl' ? '🧃 Prigrizki' : '🧃 Snacks';
      case 'equipment':
        return currentLanguage === 'sl' ? '📻 Oprema' : '📻 Equipment';
      case 'things':
      case 'other':
      case 'random':
      default:
        return currentLanguage === 'sl' ? '📦 Razno' : '📦 Random / Misc';
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
    <div id="sunday-school-component" className="w-full space-y-5 animate-fade-in pb-16">
      
      {/* Hero Header Banner */}
      <HeroHeaderBanner
        variant="school"
        eyebrow={currentLanguage === 'sl' ? '🏫 OTROŠKO SLUŽENJE • KC KALVARIJA' : '🏫 KIDS MINISTRY • KC KALVARIJA'}
        title={currentLanguage === 'sl' ? 'Nedeljska Šola' : 'Sunday School Hub'}
        subtitle={currentLanguage === 'sl' ? 'Centralno stičišče za učitelje: učni načrti, svetopisemske zgodbe, zaloga ustvarjalnih materialov ter razpored.' : 'Central hub for teachers: lesson plans, Bible stories, craft supply inventory, and roster.'}
        icon={GraduationCap}
        actions={
          canEdit && (
            <button
              onClick={() => openNewLessonModal()}
              className="px-3.5 py-1.5 bg-white text-rose-950 hover:bg-amber-50 font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4 text-rose-600" />
              <span>{currentLanguage === 'sl' ? 'Nova Učna Lekcija' : 'Add Lesson Plan'}</span>
            </button>
          )
        }
      >
        {/* Subtle Serving & Age Group Summary Line */}
        <div className="pt-2.5 border-t border-white/15 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-white/85 font-medium flex items-center gap-1.5 text-xs">
              <GraduationCap className="w-3.5 h-3.5 text-amber-200 shrink-0" />
              <span>{currentLanguage === 'sl' ? 'Starostni skupini:' : 'Age groups:'}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-white/10 text-white border border-white/20">
              👦👧 {currentLanguage === 'sl' ? 'Mlajša (3–9 let)' : 'Younger (3–9 yrs)'}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-white/10 text-white border border-white/20">
              🧑‍🦱👩‍🦱 {currentLanguage === 'sl' ? 'Starejša (10–15+ let)' : 'Older (10–15+ yrs)'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-white/85">
            <span className="px-2 py-0.5 bg-white/10 rounded-lg border border-white/10">
              📖 {lessons.length} {currentLanguage === 'sl' ? 'učnih lekcij' : 'lessons'}
            </span>
            <span className="px-2 py-0.5 bg-white/10 rounded-lg border border-white/10">
              ✂️ {supplies.length} {currentLanguage === 'sl' ? 'materialov' : 'supplies'}
            </span>
            {suppliesToBuyCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('supplies')}
                className="px-2 py-0.5 bg-rose-500/30 hover:bg-rose-500/45 text-rose-200 rounded-lg border border-rose-400/40 cursor-pointer transition flex items-center gap-1"
                title={currentLanguage === 'sl' ? 'Klikni za ogled artiklov za nakup' : 'Click to view shopping list'}
              >
                <ShoppingBag className="w-3 h-3 text-rose-300" />
                <span>{suppliesToBuyCount} {currentLanguage === 'sl' ? 'za nakup' : 'to buy'}</span>
              </button>
            )}
          </div>
        </div>
      </HeroHeaderBanner>

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
          {/* Unified Group Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 bg-gray-50/80 border border-gray-200/80 p-2 rounded-2xl shadow-2xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2.5 py-1 text-gray-500 font-mono text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                <Filter className="w-3 h-3 text-gray-400" />
                <span>{currentLanguage === 'sl' ? 'Skupina:' : 'Group:'}</span>
              </span>

              <button
                type="button"
                onClick={() => setSelectedGroupFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs transition cursor-pointer font-medium ${
                  selectedGroupFilter === 'all'
                    ? 'bg-[#93032E] text-white font-bold shadow-xs'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200/70'
                }`}
              >
                🌟 {currentLanguage === 'sl' ? 'Vse skupine' : 'All Groups'}
              </button>

              <button
                type="button"
                onClick={() => setSelectedGroupFilter('mlajsa')}
                className={`px-3 py-1.5 rounded-xl text-xs transition cursor-pointer font-medium ${
                  selectedGroupFilter === 'mlajsa'
                    ? 'bg-[#93032E] text-white font-bold shadow-xs'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200/70'
                }`}
              >
                👦👧 {currentLanguage === 'sl' ? 'Mlajša (3–9 let)' : 'Younger (3–9 yrs)'}
              </button>

              <button
                type="button"
                onClick={() => setSelectedGroupFilter('starejsa')}
                className={`px-3 py-1.5 rounded-xl text-xs transition cursor-pointer font-medium ${
                  selectedGroupFilter === 'starejsa'
                    ? 'bg-[#93032E] text-white font-bold shadow-xs'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200/70'
                }`}
              >
                🧑‍🦱👩‍🦱 {currentLanguage === 'sl' ? 'Starejša (10–15+ let)' : 'Older (10–15+ yrs)'}
              </button>
            </div>

            {canEdit && (
              <button
                onClick={() => openNewLessonModal(undefined, selectedGroupFilter !== 'all' ? selectedGroupFilter : undefined)}
                className="ml-auto px-3 py-1.5 bg-[#93032E] hover:bg-[#7A0225] text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{currentLanguage === 'sl' ? 'Nova Učna Lekcija' : 'Add Lesson Plan'}</span>
              </button>
            )}
          </div>
          {filteredLessons.length === 0 ? (
            <div className="p-12 text-center bg-gray-50 border border-dashed border-gray-300 rounded-2xl space-y-3">
              <BookOpen className="w-10 h-10 text-gray-400 mx-auto" />
              <p className="text-sm font-semibold text-gray-700">
                {currentLanguage === 'sl' ? 'Ni vnesenih učnih lekcij za izbrano skupino' : 'No lesson plans found for selected group'}
              </p>
              {canEdit && (
                <button
                  onClick={() => openNewLessonModal(undefined, selectedGroupFilter !== 'all' ? selectedGroupFilter : undefined)}
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

                      {/* Main Topic & Bible Story & Description */}
                      <div className="space-y-1.5">
                        <h3 className="text-base font-bold text-gray-900 font-display leading-tight">
                          📖 {lesson.topicSl}
                        </h3>
                        <p className="text-xs font-semibold text-orange-700 font-sans">
                          {currentLanguage === 'sl' ? 'Svetopisemska zgodba:' : 'Bible story:'} <span className="text-gray-800 font-normal">{lesson.bibleStorySl}</span>
                        </p>
                        {lesson.descriptionSl && (
                          <p className="text-xs text-gray-600 font-sans leading-relaxed pt-1 bg-gray-50/80 p-2.5 rounded-xl border border-gray-150">
                            {lesson.descriptionSl}
                          </p>
                        )}
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
                  ? `Popis zalog za otroško cerkev (${supplies.length} artiklov). Kliknite na status za hitro spremembo.`
                  : `Inventory tracking for kids ministry (${supplies.length} items). Click status to toggle.`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOnlyShowShoppingList(!onlyShowShoppingList)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  onlyShowShoppingList
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-rose-50 hover:text-rose-700 border border-gray-200'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>{currentLanguage === 'sl' ? `Seznam za nakup (${suppliesToBuyCount})` : `Shopping List (${suppliesToBuyCount})`}</span>
              </button>

              {canEdit && (
                <button
                  onClick={() => {
                    resetSupplyForm();
                    setShowAddSupplyModal(true);
                  }}
                  className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{currentLanguage === 'sl' ? 'Dodaj Material' : 'Add Supply Item'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {[
              { key: 'all', labelSl: '🌟 Vse', labelEn: '🌟 All' },
              { key: 'basic', labelSl: '✏️ Osnovno', labelEn: '✏️ Basic' },
              { key: 'paper', labelSl: '📄 Papir', labelEn: '📄 Paper' },
              { key: 'christmas', labelSl: '🎁 Božična darila', labelEn: '🎁 Christmas' },
              { key: 'decorations', labelSl: '✨ Dekoracije', labelEn: '✨ Decorations' },
              { key: 'crafts', labelSl: '🎨 Ustvarjanje', labelEn: '🎨 Crafts' },
              { key: 'stationery', labelSl: '✂️ Pisarniško', labelEn: '✂️ Stationery' },
              { key: 'snacks', labelSl: '🧃 Prigrizki', labelEn: '🧃 Snacks' },
              { key: 'equipment', labelSl: '📻 Oprema', labelEn: '📻 Equipment' },
              { key: 'random', labelSl: '📦 Razno', labelEn: '📦 Random' },
            ].map(cat => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setSelectedSupplyCategory(cat.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                  selectedSupplyCategory === cat.key
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {currentLanguage === 'sl' ? cat.labelSl : cat.labelEn}
              </button>
            ))}
          </div>

          {filteredSupplies.length === 0 ? (
            <div className="p-12 text-center bg-gray-50 border border-dashed border-gray-300 rounded-2xl space-y-3">
              <Scissors className="w-10 h-10 text-gray-400 mx-auto" />
              <p className="text-sm font-semibold text-gray-700">
                {currentLanguage === 'sl' ? 'Ni najdenih materialov za izbran filter' : 'No supply items found for selected filter'}
              </p>
              {onlyShowShoppingList && (
                <button
                  type="button"
                  onClick={() => setOnlyShowShoppingList(false)}
                  className="px-3.5 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  {currentLanguage === 'sl' ? 'Prikaži vse materiale' : 'Show all supplies'}
                </button>
              )}
            </div>
          ) : (
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
          )}
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
                    const youngerCoverage = getGroupCoverage(sun, 'mlajsa', youngerLesson);
                    const olderCoverage = getGroupCoverage(sun, 'starejsa', olderLesson);

                    return (
                      <div key={sun.id} className="p-4 sm:p-5 bg-white rounded-2xl border border-gray-200 shadow-2xs space-y-3.5">
                        <div className="flex items-center justify-between border-b border-gray-150 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs sm:text-sm text-gray-900 font-mono">📅 {sun.date}</span>
                            {sun.themeSl && (
                              <span className="text-xs text-gray-500 italic hidden sm:inline">• {sun.themeSl}</span>
                            )}
                          </div>
                          {onSelectSunday && (
                            <button
                              type="button"
                              onClick={() => onSelectSunday(sun.id)}
                              className="text-xs text-orange-600 font-bold hover:text-orange-700 hover:underline flex items-center gap-1 cursor-pointer transition"
                            >
                              <span>{currentLanguage === 'sl' ? 'Celoten razpored nedelje →' : 'Full Sunday Roster →'}</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          {/* Younger group */}
                          <div className="p-3.5 bg-amber-50/70 border border-amber-200/90 rounded-2xl space-y-2.5 flex flex-col justify-between">
                            <div className="space-y-2">
                              {/* Header: Group Name + Coverage Badge */}
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-amber-950 font-display">
                                  👦👧 {currentLanguage === 'sl' ? 'Mlajša skupina (3–9 let)' : 'Younger group (3–9 yrs)'}
                                </span>
                                {youngerCoverage.status === 'full' && (
                                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    {currentLanguage === 'sl' ? '🟢 Polna ekipa' : '🟢 Full coverage'}
                                  </span>
                                )}
                                {youngerCoverage.status === 'missing_helper' && (
                                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                                    {currentLanguage === 'sl' ? '🟡 Manjka pomočnik' : '🟡 Helper needed'}
                                  </span>
                                )}
                                {youngerCoverage.status === 'empty' && (
                                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300">
                                    {currentLanguage === 'sl' ? '🔴 Brez učitelja' : '🔴 Unassigned'}
                                  </span>
                                )}
                              </div>

                              {/* People: Teacher & Assistant Rows */}
                              <div className="space-y-1.5 pt-1">
                                <div className="flex items-center justify-between text-xs bg-white/90 p-2 rounded-xl border border-amber-200/60">
                                  <span className="font-semibold text-amber-900 flex items-center gap-1.5 text-[11px]">
                                    🎓 {currentLanguage === 'sl' ? 'Učitelj:' : 'Teacher:'}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`font-mono font-bold text-xs ${youngerCoverage.teacher ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                                      {youngerCoverage.teacher || (currentLanguage === 'sl' ? 'Ni določen' : 'Unassigned')}
                                    </span>
                                    {canEdit && (
                                      <button
                                        type="button"
                                        onClick={() => openQuickAssignModal(sun.id, 'mlajsa')}
                                        className="px-1.5 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-bold rounded cursor-pointer transition"
                                      >
                                        {youngerCoverage.teacher ? (currentLanguage === 'sl' ? 'Spremeni' : 'Change') : (currentLanguage === 'sl' ? '+ Dodaj' : '+ Add')}
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center justify-between text-xs bg-white/90 p-2 rounded-xl border border-amber-200/60">
                                  <span className="font-semibold text-amber-900 flex items-center gap-1.5 text-[11px]">
                                    🤝 {currentLanguage === 'sl' ? 'Pomočnik:' : 'Assistant:'}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`font-mono font-bold text-xs ${youngerCoverage.helper ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                                      {youngerCoverage.helper || (currentLanguage === 'sl' ? 'Ni določen' : 'Unassigned')}
                                    </span>
                                    {canEdit && (
                                      <button
                                        type="button"
                                        onClick={() => openQuickAssignModal(sun.id, 'mlajsa')}
                                        className="px-1.5 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-bold rounded cursor-pointer transition"
                                      >
                                        {youngerCoverage.helper ? (currentLanguage === 'sl' ? 'Spremeni' : 'Change') : (currentLanguage === 'sl' ? '+ Dodaj' : '+ Add')}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Lesson Info */}
                              <div className="pt-1.5 border-t border-amber-200/60 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-gray-700 font-sans truncate mr-2">
                                    {currentLanguage === 'sl' ? 'Tema:' : 'Topic:'} {youngerLesson ? youngerLesson.topicSl : (currentLanguage === 'sl' ? 'Ni vnesene lekcije' : 'No lesson plan')}
                                  </span>
                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => youngerLesson ? handleEditLessonClick(youngerLesson) : openNewLessonModal(sun.id, 'mlajsa')}
                                      className="text-[10px] text-amber-900 hover:text-amber-950 font-bold underline cursor-pointer shrink-0"
                                    >
                                      {youngerLesson ? (currentLanguage === 'sl' ? 'Uredi lekcijo' : 'Edit') : (currentLanguage === 'sl' ? '+ Učna lekcija' : '+ Lesson plan')}
                                    </button>
                                  )}
                                </div>
                                {youngerLesson?.bibleStorySl && (
                                  <p className="text-[11px] text-gray-500 italic mt-0.5">
                                    📖 {youngerLesson.bibleStorySl}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Older group */}
                          <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/90 rounded-2xl space-y-2.5 flex flex-col justify-between">
                            <div className="space-y-2">
                              {/* Header: Group Name + Coverage Badge */}
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-indigo-950 font-display">
                                  🧑‍🦱👩‍🦱 {currentLanguage === 'sl' ? 'Starejša skupina (10–15+ let)' : 'Older group (10–15+ yrs)'}
                                </span>
                                {olderCoverage.status === 'full' && (
                                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    {currentLanguage === 'sl' ? '🟢 Polna ekipa' : '🟢 Full coverage'}
                                  </span>
                                )}
                                {olderCoverage.status === 'missing_helper' && (
                                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                                    {currentLanguage === 'sl' ? '🟡 Manjka pomočnik' : '🟡 Helper needed'}
                                  </span>
                                )}
                                {olderCoverage.status === 'empty' && (
                                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300">
                                    {currentLanguage === 'sl' ? '🔴 Brez učitelja' : '🔴 Unassigned'}
                                  </span>
                                )}
                              </div>

                              {/* People: Teacher & Assistant Rows */}
                              <div className="space-y-1.5 pt-1">
                                <div className="flex items-center justify-between text-xs bg-white/90 p-2 rounded-xl border border-indigo-200/60">
                                  <span className="font-semibold text-indigo-900 flex items-center gap-1.5 text-[11px]">
                                    🎓 {currentLanguage === 'sl' ? 'Učitelj:' : 'Teacher:'}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`font-mono font-bold text-xs ${olderCoverage.teacher ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                                      {olderCoverage.teacher || (currentLanguage === 'sl' ? 'Ni določen' : 'Unassigned')}
                                    </span>
                                    {canEdit && (
                                      <button
                                        type="button"
                                        onClick={() => openQuickAssignModal(sun.id, 'starejsa')}
                                        className="px-1.5 py-0.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 text-[10px] font-bold rounded cursor-pointer transition"
                                      >
                                        {olderCoverage.teacher ? (currentLanguage === 'sl' ? 'Spremeni' : 'Change') : (currentLanguage === 'sl' ? '+ Dodaj' : '+ Add')}
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center justify-between text-xs bg-white/90 p-2 rounded-xl border border-indigo-200/60">
                                  <span className="font-semibold text-indigo-900 flex items-center gap-1.5 text-[11px]">
                                    🤝 {currentLanguage === 'sl' ? 'Pomočnik:' : 'Assistant:'}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`font-mono font-bold text-xs ${olderCoverage.helper ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                                      {olderCoverage.helper || (currentLanguage === 'sl' ? 'Ni določen' : 'Unassigned')}
                                    </span>
                                    {canEdit && (
                                      <button
                                        type="button"
                                        onClick={() => openQuickAssignModal(sun.id, 'starejsa')}
                                        className="px-1.5 py-0.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 text-[10px] font-bold rounded cursor-pointer transition"
                                      >
                                        {olderCoverage.helper ? (currentLanguage === 'sl' ? 'Spremeni' : 'Change') : (currentLanguage === 'sl' ? '+ Dodaj' : '+ Add')}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Lesson Info */}
                              <div className="pt-1.5 border-t border-indigo-200/60 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-gray-700 font-sans truncate mr-2">
                                    {currentLanguage === 'sl' ? 'Tema:' : 'Topic:'} {olderLesson ? olderLesson.topicSl : (currentLanguage === 'sl' ? 'Ni vnesene lekcije' : 'No lesson plan')}
                                  </span>
                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => olderLesson ? handleEditLessonClick(olderLesson) : openNewLessonModal(sun.id, 'starejsa')}
                                      className="text-[10px] text-indigo-900 hover:text-indigo-950 font-bold underline cursor-pointer shrink-0"
                                    >
                                      {olderLesson ? (currentLanguage === 'sl' ? 'Uredi lekcijo' : 'Edit') : (currentLanguage === 'sl' ? '+ Učna lekcija' : '+ Lesson plan')}
                                    </button>
                                  )}
                                </div>
                                {olderLesson?.bibleStorySl && (
                                  <p className="text-[11px] text-gray-500 italic mt-0.5">
                                    📖 {olderLesson.bibleStorySl}
                                  </p>
                                )}
                              </div>
                            </div>
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
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4 border border-gray-100 animate-scale-up">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-900 font-display flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-orange-600" />
                <span>
                  {editingLesson 
                    ? (currentLanguage === 'sl' ? 'Uredi Učno Lekcijo' : 'Edit Lesson Plan') 
                    : (currentLanguage === 'sl' ? 'Nova Učna Lekcija • Nedeljska Šola' : 'New Lesson Plan • Kids Ministry')}
                </span>
              </h3>
              <button
                type="button"
                onClick={resetLessonForm}
                className="text-gray-400 hover:text-gray-600 transition cursor-pointer p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLesson} className="space-y-3.5">
              {/* Sunday & Age Group Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 font-mono mb-1">
                    {currentLanguage === 'sl' ? 'Nedelja:' : 'Sunday:'}
                  </label>
                  <select
                    value={lessonSundayId}
                    onChange={(e) => handleSundayChange(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono text-gray-900 focus:outline-none focus:border-orange-500 focus:bg-white"
                  >
                    {sundays.map(s => (
                      <option key={s.id} value={s.id}>{s.date} {s.themeSl ? `(${s.themeSl})` : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 font-mono mb-1">
                    {currentLanguage === 'sl' ? 'Starostna Skupina:' : 'Age Group:'}
                  </label>
                  <select
                    value={lessonGroup}
                    onChange={(e) => handleGroupChange(e.target.value as SundaySchoolGroupKey)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-orange-500 focus:bg-white font-semibold"
                  >
                    <option value="mlajsa">👦👧 {currentLanguage === 'sl' ? 'Mlajša skupina (3–9 let)' : 'Younger group (3–9 yrs)'}</option>
                    <option value="starejsa">🧑‍🦱👩‍🦱 {currentLanguage === 'sl' ? 'Starejša skupina (10–15+ let)' : 'Older group (10–15+ yrs)'}</option>
                    <option value="oboji">🌟 {currentLanguage === 'sl' ? 'Obe skupini skupaj' : 'Combined / Both groups'}</option>
                  </select>
                </div>
              </div>

              {/* 1. REQUIRED FIELD: Topic */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-700 font-mono mb-1">
                  <span>{currentLanguage === 'sl' ? 'Tema Lekcije' : 'Lesson Topic / Theme'}</span>
                  <span className="text-rose-600 font-bold ml-1">*</span>
                  <span className="text-[10px] text-rose-500 font-medium lowercase font-sans ml-1">
                    ({currentLanguage === 'sl' ? 'obvezno' : 'required'})
                  </span>
                </label>
                <input
                  type="text"
                  required
                  value={lessonTopic}
                  onChange={(e) => setLessonTopic(e.target.value)}
                  placeholder={currentLanguage === 'sl' ? "npr. Jezus je moj Dobri Pastir" : "e.g. Jesus is my Good Shepherd"}
                  className="w-full bg-white border border-gray-250 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>

              {/* 2. REQUIRED FIELD: Bible Story / Scripture */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-700 font-mono mb-1">
                  <span>{currentLanguage === 'sl' ? 'Svetopisemska Zgodba / Odlomek' : 'Bible Story / Scripture Passage'}</span>
                  <span className="text-rose-600 font-bold ml-1">*</span>
                  <span className="text-[10px] text-rose-500 font-medium lowercase font-sans ml-1">
                    ({currentLanguage === 'sl' ? 'obvezno' : 'required'})
                  </span>
                </label>
                <input
                  type="text"
                  required
                  value={lessonBibleStory}
                  onChange={(e) => setLessonBibleStory(e.target.value)}
                  placeholder={currentLanguage === 'sl' ? "npr. Prilika o izgubljeni ovci (Luka 15:1-7)" : "e.g. The Parable of the Lost Sheep (Luke 15:1-7)"}
                  className="w-full bg-white border border-gray-250 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>

              {/* 3. REQUIRED FIELD: Short Lesson Description */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-700 font-mono mb-1">
                  <span>{currentLanguage === 'sl' ? 'Kratek Opis Lekcije' : 'Short Lesson Description'}</span>
                  <span className="text-rose-600 font-bold ml-1">*</span>
                  <span className="text-[10px] text-rose-500 font-medium lowercase font-sans ml-1">
                    ({currentLanguage === 'sl' ? 'obvezno' : 'required'})
                  </span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={lessonDescription}
                  onChange={(e) => setLessonDescription(e.target.value)}
                  placeholder={currentLanguage === 'sl' 
                    ? "Kratek povzetek vsebine, ciljev učne ure ali ključnih poudarkov za otroke..." 
                    : "Brief summary of the lesson, learning goals, or key takeaways for the kids..."}
                  className="w-full bg-white border border-gray-250 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 font-sans"
                />
              </div>

              {/* 4. OPTIONAL: Memory Verse */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 font-mono mb-1">
                  <span>{currentLanguage === 'sl' ? 'Učni Stih / Vrstica za Pomnjenje' : 'Memory Verse'}</span>
                  <span className="text-[10px] text-gray-400 font-normal lowercase font-sans ml-1">
                    ({currentLanguage === 'sl' ? 'opcijsko' : 'optional'})
                  </span>
                </label>
                <input
                  type="text"
                  value={lessonMemoryVerse}
                  onChange={(e) => setLessonMemoryVerse(e.target.value)}
                  placeholder={currentLanguage === 'sl' 
                    ? "npr. Gospod je moj pastir, nič mi ne manjka. (Psalm 23:1)" 
                    : "e.g. The Lord is my shepherd; I shall not want. (Psalm 23:1)"}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-orange-500 focus:bg-white"
                />
              </div>

              {/* 5. OPTIONAL: Crafts & Games */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 font-mono mb-1">
                  <span>{currentLanguage === 'sl' ? 'Ustvarjanje & Igre' : 'Crafts & Games'}</span>
                  <span className="text-[10px] text-gray-400 font-normal lowercase font-sans ml-1">
                    ({currentLanguage === 'sl' ? 'opcijsko' : 'optional'})
                  </span>
                </label>
                <textarea
                  rows={2}
                  value={lessonCraftAndGames}
                  onChange={(e) => setLessonCraftAndGames(e.target.value)}
                  placeholder={currentLanguage === 'sl' ? "Opis ročnega dela, barvanja ali didaktične igre..." : "Description of craft project, coloring, or games..."}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-orange-500 focus:bg-white"
                />
              </div>

              {/* 6. OPTIONAL: Materials Needed + Auto Inventory Checkbox */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 font-mono mb-1">
                  <span>{currentLanguage === 'sl' ? 'Potrebni Materiali' : 'Materials Needed'}</span>
                  <span className="text-[10px] text-gray-400 font-normal lowercase font-sans ml-1">
                    ({currentLanguage === 'sl' ? 'opcijsko, ločeno z vejico' : 'optional, comma-separated'})
                  </span>
                </label>
                <input
                  type="text"
                  value={lessonMaterialsText}
                  onChange={(e) => setLessonMaterialsText(e.target.value)}
                  placeholder={currentLanguage === 'sl' ? "npr. Papirnati krožniki, Vata, Lepilo, Škarje" : "e.g. Paper plates, Cotton balls, Glue sticks, Scissors"}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-orange-500 focus:bg-white font-mono"
                />
                <label className="flex items-center gap-1.5 text-[11px] text-gray-600 font-medium cursor-pointer mt-1.5">
                  <input
                    type="checkbox"
                    checked={autoAddSuppliesToInventory}
                    onChange={(e) => setAutoAddSuppliesToInventory(e.target.checked)}
                    className="rounded text-orange-600 focus:ring-orange-500"
                  />
                  <span>
                    {currentLanguage === 'sl' 
                      ? 'Samodejno dodaj nove materiale v seznam zaloge' 
                      : 'Auto-add new materials to supplies inventory'}
                  </span>
                </label>
              </div>

              {/* 7. TEACHERS & HELPERS: With Quick Picker Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 font-mono mb-1">
                    <span>{currentLanguage === 'sl' ? 'Učitelji:' : 'Teachers:'}</span>
                    <span className="text-[10px] text-gray-400 font-normal lowercase font-sans ml-1">
                      ({currentLanguage === 'sl' ? 'opcijsko' : 'optional'})
                    </span>
                  </label>
                  <input
                    type="text"
                    value={lessonTeachersText}
                    onChange={(e) => setLessonTeachersText(e.target.value)}
                    placeholder={currentLanguage === 'sl' ? "npr. Maja Lajlar, Peter Kovač" : "e.g. Maja Lajlar, Peter Kovač"}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-orange-500 focus:bg-white"
                  />
                  {/* Quick-Pick Dropdown */}
                  {(() => {
                    const candidateList = getSortedCandidateList(sundays.find(s => s.id === lessonSundayId), lessonGroup);
                    const tier1 = candidateList.filter(c => c.tier === 1);
                    const tier2 = candidateList.filter(c => c.tier === 2);
                    const tier3 = candidateList.filter(c => c.tier === 3);

                    return (
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            const cur = lessonTeachersText ? lessonTeachersText.split(',').map(s => s.trim()).filter(Boolean) : [];
                            if (!cur.includes(e.target.value)) {
                              setLessonTeachersText([...cur, e.target.value].join(', '));
                            }
                            e.target.value = '';
                          }
                        }}
                        className="w-full mt-1 bg-white border border-gray-200 rounded-lg px-2 py-1 text-[11px] text-gray-600 cursor-pointer"
                      >
                        <option value="">+ {currentLanguage === 'sl' ? 'Dodaj učitelja s seznama...' : 'Add teacher from list...'}</option>
                        {tier1.length > 0 && (
                          <optgroup label={currentLanguage === 'sl' ? '⭐ Služabniki v otroški cerkvi' : '⭐ Kids Ministry Team'}>
                            {tier1.map(c => {
                              const otherText = c.otherAssignments.length > 0 ? ` [${c.otherAssignments.map(o => `${o.emoji} ${o.name}`).join(', ')}]` : '';
                              return (
                                <option key={c.person.id} value={c.person.name}>⭐ {c.person.name}{otherText}</option>
                              );
                            })}
                          </optgroup>
                        )}
                        {tier2.length > 0 && (
                          <optgroup label={currentLanguage === 'sl' ? '👤 Ostali razpoložljivi' : '👤 Other Available'}>
                            {tier2.map(c => {
                              const otherText = c.otherAssignments.length > 0 ? ` [${c.otherAssignments.map(o => `${o.emoji} ${o.name}`).join(', ')}]` : '';
                              return (
                                <option key={c.person.id} value={c.person.name}>{c.person.name}{otherText}</option>
                              );
                            })}
                          </optgroup>
                        )}
                        {tier3.length > 0 && (
                          <optgroup label={currentLanguage === 'sl' ? '⚠️ Odsotni / Zasedeni' : '⚠️ Unavailable / Absent'}>
                            {tier3.map(c => (
                              <option key={c.person.id} value={c.person.name}>⚠️ {c.person.name} ({c.conflict?.label})</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    );
                  })()}
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 font-mono mb-1">
                    <span>{currentLanguage === 'sl' ? 'Pomočniki / Asistenti:' : 'Helpers / Assistants:'}</span>
                    <span className="text-[10px] text-gray-400 font-normal lowercase font-sans ml-1">
                      ({currentLanguage === 'sl' ? 'opcijsko' : 'optional'})
                    </span>
                  </label>
                  <input
                    type="text"
                    value={lessonHelpersText}
                    onChange={(e) => setLessonHelpersText(e.target.value)}
                    placeholder={currentLanguage === 'sl' ? "npr. Kaja Vrečko" : "e.g. Kaja Vrečko"}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-orange-500 focus:bg-white"
                  />
                  {/* Quick-Pick Dropdown */}
                  {(() => {
                    const candidateList = getSortedCandidateList(sundays.find(s => s.id === lessonSundayId), lessonGroup);
                    const tier1 = candidateList.filter(c => c.tier === 1);
                    const tier2 = candidateList.filter(c => c.tier === 2);
                    const tier3 = candidateList.filter(c => c.tier === 3);

                    return (
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            const cur = lessonHelpersText ? lessonHelpersText.split(',').map(s => s.trim()).filter(Boolean) : [];
                            if (!cur.includes(e.target.value)) {
                              setLessonHelpersText([...cur, e.target.value].join(', '));
                            }
                            e.target.value = '';
                          }
                        }}
                        className="w-full mt-1 bg-white border border-gray-200 rounded-lg px-2 py-1 text-[11px] text-gray-600 cursor-pointer"
                      >
                        <option value="">+ {currentLanguage === 'sl' ? 'Dodaj pomočnika s seznama...' : 'Add helper from list...'}</option>
                        {tier1.length > 0 && (
                          <optgroup label={currentLanguage === 'sl' ? '⭐ Služabniki v otroški cerkvi' : '⭐ Kids Ministry Team'}>
                            {tier1.map(c => {
                              const otherText = c.otherAssignments.length > 0 ? ` [${c.otherAssignments.map(o => `${o.emoji} ${o.name}`).join(', ')}]` : '';
                              return (
                                <option key={c.person.id} value={c.person.name}>⭐ {c.person.name}{otherText}</option>
                              );
                            })}
                          </optgroup>
                        )}
                        {tier2.length > 0 && (
                          <optgroup label={currentLanguage === 'sl' ? '👤 Ostali razpoložljivi' : '👤 Other Available'}>
                            {tier2.map(c => {
                              const otherText = c.otherAssignments.length > 0 ? ` [${c.otherAssignments.map(o => `${o.emoji} ${o.name}`).join(', ')}]` : '';
                              return (
                                <option key={c.person.id} value={c.person.name}>{c.person.name}{otherText}</option>
                              );
                            })}
                          </optgroup>
                        )}
                        {tier3.length > 0 && (
                          <optgroup label={currentLanguage === 'sl' ? '⚠️ Odsotni / Zasedeni' : '⚠️ Unavailable / Absent'}>
                            {tier3.map(c => (
                              <option key={c.person.id} value={c.person.name}>⚠️ {c.person.name} ({c.conflict?.label})</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    );
                  })()}
                </div>
              </div>

              {/* 8. OPTIONAL: Google Doc Link */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 font-mono mb-1">
                  <span>{currentLanguage === 'sl' ? 'Povezava do Google Doc Gradiva:' : 'Google Doc Material Link:'}</span>
                  <span className="text-[10px] text-gray-400 font-normal lowercase font-sans ml-1">
                    ({currentLanguage === 'sl' ? 'opcijsko' : 'optional'})
                  </span>
                </label>
                <input
                  type="url"
                  value={lessonGoogleDoc}
                  onChange={(e) => setLessonGoogleDoc(e.target.value)}
                  placeholder="https://docs.google.com/document/d/..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-orange-500 focus:bg-white font-mono"
                />
                <div className="flex items-center justify-between mt-1">
                  <a
                    href="https://docs.new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-orange-700 hover:text-orange-900 underline font-medium"
                  >
                    <Sparkles className="w-3 h-3 text-orange-600" />
                    <span>{currentLanguage === 'sl' ? 'Ustvari nov prazen Google Doc' : 'Create new blank Google Doc'}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={resetLessonForm}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  {currentLanguage === 'sl' ? 'Prekliči' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                >
                  {editingLesson 
                    ? (currentLanguage === 'sl' ? 'Posodobi Lekcijo' : 'Update Lesson Plan') 
                    : (currentLanguage === 'sl' ? 'Shrani Učno Lekcijo' : 'Save Lesson Plan')}
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
                    <option value="basic">{currentLanguage === 'sl' ? '✏️ Osnovno' : '✏️ Basic'}</option>
                    <option value="paper">{currentLanguage === 'sl' ? '📄 Papir' : '📄 Paper'}</option>
                    <option value="christmas">{currentLanguage === 'sl' ? '🎁 Božična darila' : '🎁 Christmas Gifts'}</option>
                    <option value="decorations">{currentLanguage === 'sl' ? '✨ Dekoracije' : '✨ Decorations'}</option>
                    <option value="crafts">{currentLanguage === 'sl' ? '🎨 Ustvarjanje (Les, volna, kompleti)' : '🎨 Crafts (Wood, yarn, kits)'}</option>
                    <option value="stationery">{currentLanguage === 'sl' ? '✂️ Pisarniške potrebščine' : '✂️ Stationery'}</option>
                    <option value="snacks">{currentLanguage === 'sl' ? '🧃 Prigrizki' : '🧃 Snacks'}</option>
                    <option value="equipment">{currentLanguage === 'sl' ? '📻 Oprema' : '📻 Equipment'}</option>
                    <option value="random">{currentLanguage === 'sl' ? '📦 Razno' : '📦 Random / Misc'}</option>
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

      {/* --- QUICK ASSIGN TEACHER & ASSISTANT MODAL --- */}
      {quickAssignModalOpen && (() => {
        const targetSun = sundays.find(s => s.id === quickAssignSundayId);
        const groupLabel = quickAssignGroup === 'mlajsa'
          ? (currentLanguage === 'sl' ? '👦👧 Mlajša skupina (3–9 let)' : '👦👧 Younger group (3–9 yrs)')
          : (currentLanguage === 'sl' ? '🧑‍🦱👩‍🦱 Starejša skupina (10–15+ let)' : '🧑‍🦱👩‍🦱 Older group (10–15+ yrs)');

        const candidateList = getSortedCandidateList(targetSun, quickAssignGroup);
        const tier1Candidates = candidateList.filter(c => c.tier === 1);
        const tier2Candidates = candidateList.filter(c => c.tier === 2);
        const tier3Candidates = candidateList.filter(c => c.tier === 3);

        const teacherConflict = getPersonConflictInfo(quickAssignTeacher, targetSun);
        const helperConflict = getPersonConflictInfo(quickAssignHelper, targetSun);

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-gray-100 animate-scale-up">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 font-display flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-orange-600" />
                    <span>{currentLanguage === 'sl' ? 'Določi Učitelja in Pomočnika' : 'Assign Teacher & Assistant'}</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5 font-medium">
                    📅 {targetSun?.date} • {groupLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setQuickAssignModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition cursor-pointer p-1 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveQuickAssign} className="space-y-3.5">
                {/* Teacher Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-gray-800">
                      🎓 {currentLanguage === 'sl' ? 'Učitelj / Vodja učne ure:' : 'Lead Teacher:'}
                    </label>
                    {quickAssignTeacher && (
                      <button
                        type="button"
                        onClick={() => setQuickAssignTeacher('')}
                        className="text-[10px] text-gray-400 hover:text-rose-600 font-medium cursor-pointer"
                      >
                        {currentLanguage === 'sl' ? 'Počisti' : 'Clear'}
                      </button>
                    )}
                  </div>

                  {/* Quick-Pick Starred Chips */}
                  {tier1Candidates.length > 0 && (
                    <div className="mb-1.5 flex flex-wrap items-center gap-1">
                      <span className="text-[10px] text-gray-400 font-medium">
                        {currentLanguage === 'sl' ? 'Učitelji:' : 'Teachers:'}
                      </span>
                      {tier1Candidates.slice(0, 5).map(c => {
                        const otherIcons = c.otherAssignments.length > 0 ? c.otherAssignments.map(o => o.emoji).join('') : '';
                        return (
                          <button
                            key={c.person.id}
                            type="button"
                            onClick={() => setQuickAssignTeacher(c.person.name)}
                            title={c.otherAssignments.length > 0 ? (currentLanguage === 'sl' ? `Že v službi: ${c.otherAssignments.map(o => `${o.emoji} ${o.name}`).join(', ')}` : `Already serving: ${c.otherAssignments.map(o => `${o.emoji} ${o.name}`).join(', ')}`) : undefined}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer border flex items-center gap-1 ${
                              quickAssignTeacher === c.person.name
                                ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                            }`}
                          >
                            <span>⭐ {c.person.name}</span>
                            {otherIcons && <span className="text-[9px] opacity-85 font-sans">{otherIcons}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <select
                    value={quickAssignTeacher}
                    onChange={(e) => setQuickAssignTeacher(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-250 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-orange-500 focus:bg-white"
                  >
                    <option value="">{currentLanguage === 'sl' ? '-- Izberi učitelja (ali pusti prazno) --' : '-- Select teacher (or leave empty) --'}</option>
                    {tier1Candidates.length > 0 && (
                      <optgroup label={currentLanguage === 'sl' ? '⭐ Služabniki v otroški cerkvi' : '⭐ Kids Ministry Team'}>
                        {tier1Candidates.map(c => {
                          const otherText = c.otherAssignments.length > 0 ? ` [${c.otherAssignments.map(o => `${o.emoji} ${o.name}`).join(', ')}]` : '';
                          return (
                            <option key={c.person.id} value={c.person.name}>
                              ⭐ {c.person.name}{otherText}
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                    {tier2Candidates.length > 0 && (
                      <optgroup label={currentLanguage === 'sl' ? '👤 Ostali razpoložljivi sodelavci' : '👤 Other Available Volunteers'}>
                        {tier2Candidates.map(c => {
                          const otherText = c.otherAssignments.length > 0 ? ` [${c.otherAssignments.map(o => `${o.emoji} ${o.name}`).join(', ')}]` : '';
                          return (
                            <option key={c.person.id} value={c.person.name}>
                              {c.person.name}{otherText}
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                    {tier3Candidates.length > 0 && (
                      <optgroup label={currentLanguage === 'sl' ? '⚠️ Odsotni / Zasedeni' : '⚠️ Unavailable / Absent'}>
                        {tier3Candidates.map(c => (
                          <option key={c.person.id} value={c.person.name}>
                            ⚠️ {c.person.name} ({c.conflict?.label})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  {teacherConflict && (
                    <div className="text-[11px] text-amber-800 font-medium mt-1 flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                      <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                      <span>{teacherConflict.label}</span>
                    </div>
                  )}
                </div>

                {/* Assistant Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-gray-800">
                      🤝 {currentLanguage === 'sl' ? 'Pomočnik / Asistent:' : 'Assistant / Helper:'}
                    </label>
                    {quickAssignHelper && (
                      <button
                        type="button"
                        onClick={() => setQuickAssignHelper('')}
                        className="text-[10px] text-gray-400 hover:text-rose-600 font-medium cursor-pointer"
                      >
                        {currentLanguage === 'sl' ? 'Počisti' : 'Clear'}
                      </button>
                    )}
                  </div>

                  {/* Quick-Pick Starred Chips */}
                  {tier1Candidates.length > 0 && (
                    <div className="mb-1.5 flex flex-wrap items-center gap-1">
                      <span className="text-[10px] text-gray-400 font-medium">
                        {currentLanguage === 'sl' ? 'Pomočniki:' : 'Helpers:'}
                      </span>
                      {tier1Candidates.slice(0, 5).map(c => {
                        const otherIcons = c.otherAssignments.length > 0 ? c.otherAssignments.map(o => o.emoji).join('') : '';
                        return (
                          <button
                            key={c.person.id}
                            type="button"
                            onClick={() => setQuickAssignHelper(c.person.name)}
                            title={c.otherAssignments.length > 0 ? (currentLanguage === 'sl' ? `Že v službi: ${c.otherAssignments.map(o => `${o.emoji} ${o.name}`).join(', ')}` : `Already serving: ${c.otherAssignments.map(o => `${o.emoji} ${o.name}`).join(', ')}`) : undefined}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer border flex items-center gap-1 ${
                              quickAssignHelper === c.person.name
                                ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                            }`}
                          >
                            <span>⭐ {c.person.name}</span>
                            {otherIcons && <span className="text-[9px] opacity-85 font-sans">{otherIcons}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <select
                    value={quickAssignHelper}
                    onChange={(e) => setQuickAssignHelper(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-250 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-orange-500 focus:bg-white"
                  >
                    <option value="">{currentLanguage === 'sl' ? '-- Izberi pomočnika (ali pusti prazno) --' : '-- Select assistant (or leave empty) --'}</option>
                    {tier1Candidates.length > 0 && (
                      <optgroup label={currentLanguage === 'sl' ? '⭐ Služabniki v otroški cerkvi' : '⭐ Kids Ministry Team'}>
                        {tier1Candidates.map(c => {
                          const otherText = c.otherAssignments.length > 0 ? ` [${c.otherAssignments.map(o => `${o.emoji} ${o.name}`).join(', ')}]` : '';
                          return (
                            <option key={c.person.id} value={c.person.name}>
                              ⭐ {c.person.name}{otherText}
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                    {tier2Candidates.length > 0 && (
                      <optgroup label={currentLanguage === 'sl' ? '👤 Ostali razpoložljivi sodelavci' : '👤 Other Available Volunteers'}>
                        {tier2Candidates.map(c => {
                          const otherText = c.otherAssignments.length > 0 ? ` [${c.otherAssignments.map(o => `${o.emoji} ${o.name}`).join(', ')}]` : '';
                          return (
                            <option key={c.person.id} value={c.person.name}>
                              {c.person.name}{otherText}
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                    {tier3Candidates.length > 0 && (
                      <optgroup label={currentLanguage === 'sl' ? '⚠️ Odsotni / Zasedeni' : '⚠️ Unavailable / Absent'}>
                        {tier3Candidates.map(c => (
                          <option key={c.person.id} value={c.person.name}>
                            ⚠️ {c.person.name} ({c.conflict?.label})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  {helperConflict && (
                    <div className="text-[11px] text-amber-800 font-medium mt-1 flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                      <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                      <span>{helperConflict.label}</span>
                    </div>
                  )}
                </div>

                {/* Sync Lesson Checkbox */}
                <label className="flex items-center gap-2 text-xs text-gray-700 font-medium cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={quickAssignSyncLesson}
                    onChange={(e) => setQuickAssignSyncLesson(e.target.checked)}
                    className="rounded text-orange-600 focus:ring-orange-500"
                  />
                  <span>
                    {currentLanguage === 'sl'
                      ? 'Posodobi imena tudi v obstoječem učnem načrtu (lekciji)'
                      : 'Sync teacher names to existing lesson plan'}
                  </span>
                </label>

                {/* Actions */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickAssignModalOpen(false)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    {currentLanguage === 'sl' ? 'Prekliči' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-orange-600 hover:bg-orange-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                  >
                    {currentLanguage === 'sl' ? 'Shrani razpored' : 'Save Assignment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

    </div>
  );
}

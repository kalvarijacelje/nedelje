import React, { useState, useRef } from 'react';
import { VisitorConnection, FollowUpStatus, Person, ServiceSunday, UserRole, canAccessPersonalData } from '../types';
import { useBackdropHistory } from '../hooks/useBackdropHistory';
import { formatToEuropeanDate } from '../utils/dateUtils';
import { 
  Coffee, 
  UserPlus, 
  Heart, 
  PhoneCall, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  X, 
  Plus, 
  Filter, 
  Search, 
  UserCheck, 
  MessageSquare, 
  Tag, 
  Calendar, 
  Building2,
  ChevronRight,
  Trash2,
  Edit2,
  ClipboardCheck,
  ExternalLink,
  FileText
} from 'lucide-react';

interface VisitorTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  visitors: VisitorConnection[];
  sundays: ServiceSunday[];
  people: Person[];
  onUpdateVisitors: (visitors: VisitorConnection[]) => void;
  selectedSundayId?: string | null;
  canEdit: boolean;
  currentLanguage: 'sl' | 'en';
  onOpenInspectionModal?: () => void;
  userRole?: UserRole;
}

const INTEREST_OPTIONS = [
  'Domača skupina (Home Group)',
  'Kava & Druženje v Kavarni Živa Vera',
  'Nedeljska Šola za otroke',
  'Glasbena ekipa / Slavljenje',
  'Krst in Učeništvo',
  'Tehnična ali strežna ekipa',
  'Osebni pogovor s pastorjem'
];

const KNOWN_MINOR_IDS = new Set([
  'p-tian_knap', 'p-hana_knap', 'p-natan_knap',
  'p-iva_kolar', 'p-mila_kolar',
  'p-jona_oreskovic', 'p-ronja_oreskovic',
  'p-emanuel_pratneker', 'p-jakob_pratneker', 'p-luka_pratneker',
  'p-lucija_srebot', 'p-leon_srebot',
  'p-masa_stefancic', 'p-mia_stefancic',
  'p-david_vuleta', 'p-izak_vuleta',
  'p-arne_zunec', 'p-pia_princic',
  'p-adonijah_lajlar', 'p-daniel_lajlar',
  'p-huntley_james_hupp', 'p-kenzley_franceen_hupp'
]);

const isMinorPerson = (p: Person): boolean => {
  if (!p) return false;
  if (p.memberType === 'minor' || p.memberType === 'youth' || p.role === 'Minor') return true;
  if (p.id && KNOWN_MINOR_IDS.has(p.id)) return true;
  return false;
};

const isLeaderPerson = (p: Person): boolean => {
  if (!p) return false;
  const lowerName = (p.name || '').toLowerCase();
  if (lowerName === 'pastor aleš' || lowerName === 'whitney' || lowerName === 'aleš lajlar' || lowerName === 'whitney lajlar') return true;
  if (p.role === 'Admin' || p.role === 'Leader') return true;
  if (p.isPastorOrStaff) return true;
  if (Array.isArray(p.ledMinistries) && p.ledMinistries.length > 0) return true;
  return false;
};

const isServantPerson = (p: Person): boolean => {
  if (!p || isLeaderPerson(p) || isMinorPerson(p)) return false;
  if (p.role === 'Servant') return true;
  if (Array.isArray(p.preferredMinistries) && p.preferredMinistries.length > 0) return true;
  return false;
};

export default function VisitorTrackerModal({
  isOpen,
  onClose,
  visitors,
  sundays,
  people,
  onUpdateVisitors,
  selectedSundayId,
  canEdit,
  currentLanguage,
  onOpenInspectionModal,
  userRole
}: VisitorTrackerModalProps) {
  useBackdropHistory(isOpen, onClose, 'visitor-tracker-modal');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'new' | 'contacted' | 'completed' | 'just_visiting'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingVisitorId, setEditingVisitorId] = useState<string | null>(null);

  // Grouped and filtered people lists (Leaders on top, Servants, then Members, excluding Minors/Kids)
  const { leadersList, servantsList, membersList } = React.useMemo(() => {
    const eligiblePeople = (people || []).filter(p => {
      if (!p || !p.name || !p.name.trim()) return false;
      if (p.isArchived) return false;
      if (p.isVisitor || p.memberType === 'visitor' || p.role === 'Visitor') return false;
      if (isMinorPerson(p)) return false;
      return true;
    });

    const customEntries: Person[] = [];
    if (!eligiblePeople.some(p => p.name === 'Pastor Aleš' || p.name === 'Aleš Lajlar')) {
      customEntries.push({ id: 'p-pastor_ales', name: 'Pastor Aleš', role: 'Admin', isPastorOrStaff: true, preferredMinistries: [] });
    }
    if (!eligiblePeople.some(p => p.name === 'Whitney' || p.name === 'Whitney Lajlar')) {
      customEntries.push({ id: 'p-whitney', name: 'Whitney', role: 'Leader', isPastorOrStaff: true, preferredMinistries: [] });
    }

    const allEligible = [...customEntries, ...eligiblePeople];
    const seen = new Set<string>();
    const uniqueEligible: Person[] = [];
    for (const p of allEligible) {
      const key = p.name.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueEligible.push(p);
      }
    }

    const leaders: Person[] = [];
    const servants: Person[] = [];
    const members: Person[] = [];

    for (const p of uniqueEligible) {
      if (isLeaderPerson(p)) {
        leaders.push(p);
      } else if (isServantPerson(p)) {
        servants.push(p);
      } else {
        members.push(p);
      }
    }

    const sortSl = (a: Person, b: Person) => a.name.localeCompare(b.name, 'sl', { sensitivity: 'base' });

    leaders.sort((a, b) => {
      const aIsPastor = a.name.toLowerCase().includes('aleš') || a.name.toLowerCase().includes('pastor');
      const bIsPastor = b.name.toLowerCase().includes('aleš') || b.name.toLowerCase().includes('pastor');
      if (aIsPastor && !bIsPastor) return -1;
      if (!aIsPastor && bIsPastor) return 1;
      const aIsWhitney = a.name.toLowerCase().includes('whitney');
      const bIsWhitney = b.name.toLowerCase().includes('whitney');
      if (aIsWhitney && !bIsWhitney) return -1;
      if (!aIsWhitney && bIsWhitney) return 1;
      return sortSl(a, b);
    });

    servants.sort(sortSl);
    members.sort(sortSl);

    return {
      leadersList: leaders,
      servantsList: servants,
      membersList: members
    };
  }, [people]);

  // Form states
  const [visitorName, setVisitorName] = useState('');
  const [attendeeCount, setAttendeeCount] = useState<number>(1);
  const [contactInfo, setContactInfo] = useState('');
  const [invitedBy, setInvitedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [coffeeShopNotes, setCoffeeShopNotes] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(['Kava & Druženje v Kavarni Živa Vera']);
  const [assignedPerson, setAssignedPerson] = useState('');
  const [status, setStatus] = useState<FollowUpStatus>('new');
  const [targetSundayId, setTargetSundayId] = useState<string>(selectedSundayId || sundays[0]?.id || '');

  const resetForm = () => {
    setVisitorName('');
    setAttendeeCount(1);
    setContactInfo('');
    setInvitedBy('');
    setNotes('');
    setCoffeeShopNotes('');
    setSelectedInterests(['Kava & Druženje v Kavarni Živa Vera']);
    setAssignedPerson('');
    setStatus('new');
    setIsAddingNew(false);
    setEditingVisitorId(null);
  };

  const handleOpenAddNew = () => {
    resetForm();
    setIsAddingNew(true);
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 40);
  };

  const handleToggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const handleSaveVisitor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorName.trim()) return;

    const matchedSunday = sundays.find(s => s.id === targetSundayId);
    const dateStr = matchedSunday ? formatToEuropeanDate(matchedSunday.date) : formatToEuropeanDate(new Date());

    if (editingVisitorId) {
      // Update
      const updated = visitors.map(v => v.id === editingVisitorId ? {
        ...v,
        visitorName: visitorName.trim(),
        attendeeCount: Math.max(1, Number(attendeeCount) || 1),
        contactInfo: contactInfo.trim(),
        invitedBy: invitedBy.trim(),
        notes: notes.trim(),
        coffeeShopNotes: coffeeShopNotes.trim(),
        interests: selectedInterests,
        assignedFollowUpPerson: assignedPerson,
        followUpStatus: status,
        sundayId: targetSundayId,
        sundayDate: dateStr
      } : v);
      onUpdateVisitors(updated);
    } else {
      // Create new
      const newVisitor: VisitorConnection = {
        id: 'vis-' + Date.now(),
        sundayId: targetSundayId,
        sundayDate: dateStr,
        visitorName: visitorName.trim(),
        attendeeCount: Math.max(1, Number(attendeeCount) || 1),
        contactInfo: contactInfo.trim(),
        invitedBy: invitedBy.trim(),
        notes: notes.trim(),
        coffeeShopNotes: coffeeShopNotes.trim(),
        interests: selectedInterests,
        assignedFollowUpPerson: assignedPerson,
        followUpStatus: status,
        createdAt: formatToEuropeanDate(new Date())
      };
      onUpdateVisitors([newVisitor, ...visitors]);
    }

    resetForm();
  };

  const handleStartEdit = (v: VisitorConnection) => {
    setEditingVisitorId(v.id);
    setVisitorName(v.visitorName);
    setAttendeeCount(Math.max(1, Number(v.attendeeCount) || 1));
    setContactInfo(v.contactInfo || '');
    setInvitedBy(v.invitedBy || '');
    setNotes(v.notes || '');
    setCoffeeShopNotes(v.coffeeShopNotes || '');
    setSelectedInterests(v.interests || []);
    setAssignedPerson(v.assignedFollowUpPerson || '');
    setStatus(v.followUpStatus);
    setTargetSundayId(v.sundayId || sundays[0]?.id || '');
    setIsAddingNew(true);
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 40);
  };

  const handleDelete = (id: string) => {
    if (confirm('Ali res želiš izbrisati tega obiskovalca?')) {
      onUpdateVisitors(visitors.filter(v => v.id !== id));
    }
  };

  const handleStatusChange = (id: string, newStatus: FollowUpStatus) => {
    const updated = visitors.map(v => v.id === id ? { ...v, followUpStatus: newStatus } : v);
    onUpdateVisitors(updated);
  };

  // Filter visitors
  const filteredVisitors = visitors.filter(v => {
    const matchesSearch = v.visitorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (v.notes && v.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (v.coffeeShopNotes && v.coffeeShopNotes.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (v.invitedBy && v.invitedBy.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;

    if (activeTab === 'new') return v.followUpStatus === 'new';
    if (activeTab === 'contacted') return v.followUpStatus === 'contacted';
    if (activeTab === 'completed') return v.followUpStatus === 'connected' || v.followUpStatus === 'completed';
    if (activeTab === 'just_visiting') return v.followUpStatus === 'just_visiting';

    return true;
  });

  if (!isOpen) return null;
  if (userRole && !canAccessPersonalData(userRole)) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[60] flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-900 via-amber-800 to-amber-950 text-white flex items-start justify-between relative overflow-hidden shrink-0">
          <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-8">
            <Coffee className="w-48 h-48 text-amber-200" />
          </div>

          <div className="space-y-1 relative z-10 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-200 border border-amber-400/30 flex items-center gap-1">
                <span>☕ KAVARNA ŽIVA VERA</span>
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-bold font-display tracking-tight text-amber-50">
              {currentLanguage === 'sl' ? '☕ Obiskovalci & Gostoljubje v Kavarni Živa Vera' : '☕ Visitors & Hospitality at Living Faith Coffee Shop'}
            </h2>
            <p className="text-xs text-amber-200/90 leading-relaxed font-sans">
              {currentLanguage === 'sl'
                ? 'Popolna nedeljska kava in družabni prostor pod cerkvijo za sprejem novih obiskovalcev, vzpostavitev stika ter medtedensko spremljanje in spodbudo.'
                : 'Post-service fellowship and coffee shop welcoming new visitors, helping connect them into church life and mid-week care.'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-amber-200 hover:text-white bg-amber-950/40 hover:bg-amber-950/70 rounded-full transition cursor-pointer relative z-10 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar & Stats */}
        <div className="p-4 bg-amber-50/60 border-b border-amber-200/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-amber-200 shadow-2xs flex-wrap">
            {(() => {
              const totalPeopleCount = visitors.reduce((sum, v) => sum + (Math.max(1, Number(v.attendeeCount) || 1)), 0);
              return (
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeTab === 'all' ? 'bg-amber-900 text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {currentLanguage === 'sl' ? 'Vsi' : 'All'} ({visitors.length} • {totalPeopleCount} {currentLanguage === 'sl' ? 'oseb' : 'people'})
                </button>
              );
            })()}
            <button
              onClick={() => setActiveTab('new')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'new' ? 'bg-amber-600 text-white shadow-2xs' : 'text-amber-800 hover:bg-amber-100/50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{currentLanguage === 'sl' ? 'Za kontakt' : 'To Contact'} ({visitors.filter(v => v.followUpStatus === 'new').length})</span>
            </button>
            <button
              onClick={() => setActiveTab('contacted')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'contacted' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {currentLanguage === 'sl' ? 'V stiku' : 'Contacted'} ({visitors.filter(v => v.followUpStatus === 'contacted').length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'completed' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {currentLanguage === 'sl' ? 'Povezani' : 'Connected'} ({visitors.filter(v => v.followUpStatus === 'connected' || v.followUpStatus === 'completed').length})
            </button>
            <button
              onClick={() => setActiveTab('just_visiting')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'just_visiting' ? 'bg-slate-700 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-white border border-slate-400 inline-block shrink-0 shadow-2xs" />
              <span>{currentLanguage === 'sl' ? 'Samo obisk' : 'Just Visiting'} ({visitors.filter(v => v.followUpStatus === 'just_visiting').length})</span>
            </button>
          </div>

          {/* Add New Visitor Button */}
          {canEdit && !isAddingNew && (
            <button
              onClick={handleOpenAddNew}
              className="px-4 py-2 bg-amber-900 hover:bg-amber-950 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-amber-300" />
              <span>{currentLanguage === 'sl' ? 'Zabeleži Novega Obiskovalca' : 'Log New Visitor'}</span>
            </button>
          )}
        </div>

        {/* Scrollable Body */}
        <div ref={scrollContainerRef} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* Form for adding / editing visitor */}
          {isAddingNew && (
            <form onSubmit={handleSaveVisitor} className="p-4 sm:p-5 bg-amber-50/80 border-2 border-amber-300 rounded-2xl space-y-4 shadow-sm animate-fade-in">
              <div className="flex items-center justify-between border-b border-amber-200/80 pb-2.5">
                <h3 className="font-display font-bold text-sm text-amber-950 flex items-center gap-2">
                  <Coffee className="w-4 h-4 text-amber-800" />
                  <span>{editingVisitorId ? (currentLanguage === 'sl' ? 'Uredi Obiskovalca' : 'Edit Visitor') : (currentLanguage === 'sl' ? 'Nov Obiskovalec v Kavarni Živa Vera' : 'New Visitor at Living Faith Coffee Shop')}</span>
                </h3>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-amber-800 hover:text-amber-950 text-xs font-semibold cursor-pointer"
                >
                  {currentLanguage === 'sl' ? 'Prekliči' : 'Cancel'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase text-amber-900 mb-1">
                    {currentLanguage === 'sl' ? 'Ime in priimek obiskovalca / družine *' : 'Visitor / Family Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                    placeholder={currentLanguage === 'sl' ? 'npr. 4 Punce iz Ljubljane / Luka & Maja' : 'e.g. John & Mary Smith'}
                    className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase text-amber-900 mb-1 flex items-center justify-between">
                    <span>👥 {currentLanguage === 'sl' ? 'Število oseb (skupina / družina):' : 'Party Size / Number of People:'}</span>
                    <span className="text-amber-900 font-bold text-xs">
                      {attendeeCount} {attendeeCount === 1 ? (currentLanguage === 'sl' ? 'oseba' : 'person') : (currentLanguage === 'sl' ? 'osebe / oseb' : 'people')}
                    </span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setAttendeeCount(num)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold font-mono transition cursor-pointer border ${
                          attendeeCount === num
                            ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                            : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                    <div className="relative flex-1 min-w-[65px]">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={attendeeCount}
                        onChange={(e) => setAttendeeCount(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-white border border-amber-200 rounded-xl px-2 py-2 text-xs font-bold text-center text-gray-900 focus:outline-none focus:border-amber-600 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase text-amber-900 mb-1">
                    {currentLanguage === 'sl' ? 'Kontakt (Telefon / Email)' : 'Contact (Phone / Email)'}
                  </label>
                  <input
                    type="text"
                    value={contactInfo}
                    onChange={(e) => setContactInfo(e.target.value)}
                    placeholder="npr. 040 123 456 / email@example.com"
                    className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase text-amber-900 mb-1">
                    {currentLanguage === 'sl' ? 'Kdo jih je povabil / spoznal?' : 'Who invited / met them?'}
                  </label>
                  <input
                    type="text"
                    value={invitedBy}
                    onChange={(e) => setInvitedBy(e.target.value)}
                    placeholder={currentLanguage === 'sl' ? 'npr. Peter Kovač, ekipa gostoljubja' : 'e.g. Peter, hospitality team'}
                    className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase text-amber-900 mb-1">
                    {currentLanguage === 'sl' ? 'Nedeljsko Bogoslužje' : 'Sunday Service'}
                  </label>
                  <select
                    value={targetSundayId}
                    onChange={(e) => setTargetSundayId(e.target.value)}
                    className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-amber-600"
                  >
                    {sundays.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.date} - {s.themeSl || 'Bogoslužje'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Interests checkboxes */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono font-bold uppercase text-amber-900">
                  {currentLanguage === 'sl' ? 'Zanimanja & Naslednji koraki:' : 'Interests & Next Steps:'}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {INTEREST_OPTIONS.map(opt => {
                    const isSelected = selectedInterests.includes(opt);
                    return (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => handleToggleInterest(opt)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                          isSelected
                            ? 'bg-amber-800 text-amber-50 font-bold border border-amber-900'
                            : 'bg-white text-gray-700 border border-amber-200 hover:bg-amber-100/50'
                        }`}
                      >
                        {isSelected ? <CheckCircle2 className="w-3 h-3 text-amber-300" /> : <Plus className="w-3 h-3 text-gray-400" />}
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Coffee Shop Notes */}
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase text-amber-900 mb-1">
                  {currentLanguage === 'sl' ? '☕ Opombe s kave v Kavarni Živa Vera:' : '☕ Coffee Fellowship Notes:'}
                </label>
                <textarea
                  rows={2}
                  value={coffeeShopNotes}
                  onChange={(e) => setCoffeeShopNotes(e.target.value)}
                  placeholder={currentLanguage === 'sl' 
                    ? "Kaj ste se pogovarjali pri kavi? (npr. 'Naročila kapučino, pogovor o družinski skupini...')"
                    : "Coffee conversation notes... (e.g. 'Interested in home group, introduced to team...')"}
                  className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-amber-600"
                />
              </div>

              {/* Assignee & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-amber-200/80">
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase text-amber-900 mb-1">
                    {currentLanguage === 'sl' ? 'Dodeljena odgovorna oseba za kontakt:' : 'Assigned Follow-up Volunteer:'}
                  </label>
                  <select
                    value={assignedPerson}
                    onChange={(e) => setAssignedPerson(e.target.value)}
                    className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-amber-600 cursor-pointer"
                  >
                    <option value="">{currentLanguage === 'sl' ? '— Nihče (Brez dodeljene osebe) —' : '— None (No volunteer assigned) —'}</option>
                    
                    {leadersList.length > 0 && (
                      <optgroup label={currentLanguage === 'sl' ? '👑 Voditelji & Pastorji' : '👑 Leaders & Pastors'}>
                        {leadersList.map(p => (
                          <option key={p.name} value={p.name}>
                            👑 {p.name}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {servantsList.length > 0 && (
                      <optgroup label={currentLanguage === 'sl' ? '🤝 Služabniki' : '🤝 Volunteers'}>
                        {servantsList.map(p => (
                          <option key={p.name} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {membersList.length > 0 && (
                      <optgroup label={currentLanguage === 'sl' ? '👥 Člani skupnosti' : '👥 Church Members'}>
                        {membersList.map(p => (
                          <option key={p.name} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase text-amber-900 mb-1">
                    {currentLanguage === 'sl' ? 'Status spremljanja:' : 'Follow-up Status:'}
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as FollowUpStatus)}
                    className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-amber-600"
                  >
                    <option value="new">{currentLanguage === 'sl' ? '🟡 Novo (Za kontaktirati)' : '🟡 New (Needs Contact)'}</option>
                    <option value="contacted">{currentLanguage === 'sl' ? '🔵 Kontaktirano / V stiku' : '🔵 Contacted / In touch'}</option>
                    <option value="connected">{currentLanguage === 'sl' ? '🟢 Povezano z domačo skupino' : '🟢 Connected to Home Group'}</option>
                    <option value="completed">{currentLanguage === 'sl' ? '✅ Zaključeno' : '✅ Completed'}</option>
                    <option value="just_visiting">{currentLanguage === 'sl' ? '⚪ Samo na obisku (Brez nadaljnjega stika)' : '⚪ Just Visiting (No contact needed)'}</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition cursor-pointer"
                >
                  {currentLanguage === 'sl' ? 'Prekliči' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-900 hover:bg-amber-950 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <UserCheck className="w-4 h-4 text-amber-300" />
                  <span>{editingVisitorId ? (currentLanguage === 'sl' ? 'Shrani Spremembe' : 'Save Changes') : (currentLanguage === 'sl' ? 'Zabeleži Obiskovalca' : 'Log Visitor')}</span>
                </button>
              </div>
            </form>
          )}

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={currentLanguage === 'sl' ? 'Išči obiskovalce po imenu, opombah ali povabitelju...' : 'Search visitors by name, notes or inviter...'}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-amber-600"
            />
          </div>

          {/* Visitors Cards List */}
          {filteredVisitors.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 space-y-2">
              <Coffee className="w-8 h-8 text-amber-700/40 mx-auto" />
              <p className="text-xs text-gray-500 font-medium">{currentLanguage === 'sl' ? 'Ni najdenih obiskovalcev za izbrani filter.' : 'No visitors found for selected filter.'}</p>
              {canEdit && (
                <button
                  onClick={() => { resetForm(); setIsAddingNew(true); }}
                  className="text-xs font-bold text-amber-800 hover:underline cursor-pointer"
                >
                  {currentLanguage === 'sl' ? '+ Dodaj prvega obiskovalca' : '+ Add first visitor'}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredVisitors.map((v) => (
                <div 
                  key={v.id} 
                  className="p-4 bg-white border border-gray-200/90 hover:border-amber-300 rounded-2xl shadow-xs transition space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-display font-bold text-sm text-gray-900">
                          {v.visitorName}
                        </h4>

                        {(v.attendeeCount && v.attendeeCount > 1) ? (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-100/90 text-amber-900 border border-amber-300 shadow-2xs flex items-center gap-1">
                            <span>👥 {v.attendeeCount}</span>
                            <span>{currentLanguage === 'sl' ? (v.attendeeCount === 2 ? 'osebi' : v.attendeeCount <= 4 ? 'osebe' : 'oseb') : 'people'}</span>
                          </span>
                        ) : null}
                        
                        {/* Status Badge */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1.5 ${
                          v.followUpStatus === 'new' 
                            ? 'bg-amber-100 text-amber-900 border-amber-300' 
                            : v.followUpStatus === 'contacted'
                            ? 'bg-indigo-100 text-indigo-900 border-indigo-200'
                            : v.followUpStatus === 'just_visiting'
                            ? 'bg-slate-100 text-slate-700 border-slate-300'
                            : 'bg-emerald-100 text-emerald-900 border-emerald-200'
                        }`}>
                          {v.followUpStatus === 'new' && <Clock className="w-3 h-3 text-amber-700" />}
                          {v.followUpStatus === 'contacted' && <PhoneCall className="w-3 h-3 text-indigo-700" />}
                          {(v.followUpStatus === 'connected' || v.followUpStatus === 'completed') && <CheckCircle2 className="w-3 h-3 text-emerald-700" />}
                          {v.followUpStatus === 'just_visiting' && (
                            <span className="w-2.5 h-2.5 rounded-full bg-white border border-slate-400 inline-block shrink-0 shadow-2xs" />
                          )}
                          <span>
                            {v.followUpStatus === 'new' && (currentLanguage === 'sl' ? 'Za kontakt' : 'To Contact')}
                            {v.followUpStatus === 'contacted' && (currentLanguage === 'sl' ? 'Kontaktirano' : 'Contacted')}
                            {v.followUpStatus === 'connected' && (currentLanguage === 'sl' ? 'Povezano' : 'Connected')}
                            {v.followUpStatus === 'completed' && (currentLanguage === 'sl' ? 'Zaključeno' : 'Completed')}
                            {v.followUpStatus === 'just_visiting' && (currentLanguage === 'sl' ? 'Samo na obisku' : 'Just Visiting')}
                          </span>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 font-sans">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <span>Obisk: <strong>{formatToEuropeanDate(v.sundayDate)}</strong></span>
                        </span>
                        {v.contactInfo && (
                          <span className="flex items-center gap-1 font-mono text-[11px] text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                            <PhoneCall className="w-3 h-3 text-gray-500" />
                            <span>{v.contactInfo}</span>
                          </span>
                        )}
                        {v.invitedBy && (
                          <span className="text-gray-600">Povabil/a: <strong>{v.invitedBy}</strong></span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {canEdit && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleStartEdit(v)}
                          className="p-1.5 text-gray-500 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                          title="Uredi"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(v.id)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Izbriši"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Coffee Shop Notes */}
                  {v.coffeeShopNotes && (
                    <div className="p-2.5 bg-amber-50/70 border border-amber-200/70 rounded-xl text-xs space-y-0.5">
                      <span className="text-[10px] font-mono font-bold text-amber-900 uppercase flex items-center gap-1">
                        <Coffee className="w-3 h-3 text-amber-800" />
                        <span>Kavarna Živa Vera opombe:</span>
                      </span>
                      <p className="text-gray-800 font-sans">{v.coffeeShopNotes}</p>
                    </div>
                  )}

                  {/* Interests Badges */}
                  {v.interests && v.interests.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 pt-1">
                      {v.interests.map((interest, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md text-[10px] font-medium border border-gray-200">
                          {interest}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Follow Up Assignee & Quick Status Bar */}
                  <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-gray-700">
                      <UserCheck className="w-3.5 h-3.5 text-amber-800" />
                      <span className="flex items-center gap-1 flex-wrap">
                        <span>{currentLanguage === 'sl' ? 'Odgovorna oseba za kontakt:' : 'Assigned volunteer:'}</span>
                        {v.assignedFollowUpPerson ? (
                          <span className="inline-flex items-center gap-1">
                            {leadersList.some(l => l.name.toLowerCase() === v.assignedFollowUpPerson?.toLowerCase()) && (
                              <span title={currentLanguage === 'sl' ? 'Voditelj' : 'Leader'}>👑</span>
                            )}
                            <strong className="text-gray-900">{v.assignedFollowUpPerson}</strong>
                          </span>
                        ) : (
                          <span className="text-gray-400 italic font-medium">{currentLanguage === 'sl' ? 'Nihče' : 'None'}</span>
                        )}
                      </span>
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-400">Spremeni status:</span>
                        <select
                          value={v.followUpStatus}
                          onChange={(e) => handleStatusChange(v.id, e.target.value as FollowUpStatus)}
                          className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-[11px] font-bold text-gray-800 focus:outline-none focus:border-amber-600 cursor-pointer"
                        >
                          <option value="new">🟡 Novo</option>
                          <option value="contacted">🔵 Kontaktirano</option>
                          <option value="connected">🟢 Povezano</option>
                          <option value="completed">✅ Zaključeno</option>
                          <option value="just_visiting">⚪ Samo na obisku</option>
                        </select>
                      </div>
                    )}
                  </div>

                </div>
              ))}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500 font-sans shrink-0">
          <div className="flex items-center gap-1.5 text-amber-900 font-medium">
            <Coffee className="w-4 h-4 text-amber-800" />
            <span>Kavarna Živa Vera • Gostoljubje KC Kalvarija</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl transition cursor-pointer"
          >
            Zapri
          </button>
        </div>

      </div>
    </div>
  );
}

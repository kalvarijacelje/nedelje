import React, { useState } from 'react';
import { VisitorConnection, FollowUpStatus, Person, ServiceSunday, UserRole, canAccessPersonalData } from '../types';
import { useBackdropHistory } from '../hooks/useBackdropHistory';
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

  const [activeTab, setActiveTab] = useState<'all' | 'new' | 'contacted' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingVisitorId, setEditingVisitorId] = useState<string | null>(null);

  // Form states
  const [visitorName, setVisitorName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [invitedBy, setInvitedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [coffeeShopNotes, setCoffeeShopNotes] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(['Kava & Druženje v Kavarni Živa Vera']);
  const [assignedPerson, setAssignedPerson] = useState('Pastor Aleš');
  const [status, setStatus] = useState<FollowUpStatus>('new');
  const [targetSundayId, setTargetSundayId] = useState<string>(selectedSundayId || sundays[0]?.id || '');

  const resetForm = () => {
    setVisitorName('');
    setContactInfo('');
    setInvitedBy('');
    setNotes('');
    setCoffeeShopNotes('');
    setSelectedInterests(['Kava & Druženje v Kavarni Živa Vera']);
    setAssignedPerson('Pastor Aleš');
    setStatus('new');
    setIsAddingNew(false);
    setEditingVisitorId(null);
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
    const dateStr = matchedSunday?.date || new Date().toLocaleDateString('sl-SI');

    if (editingVisitorId) {
      // Update
      const updated = visitors.map(v => v.id === editingVisitorId ? {
        ...v,
        visitorName: visitorName.trim(),
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
        contactInfo: contactInfo.trim(),
        invitedBy: invitedBy.trim(),
        notes: notes.trim(),
        coffeeShopNotes: coffeeShopNotes.trim(),
        interests: selectedInterests,
        assignedFollowUpPerson: assignedPerson,
        followUpStatus: status,
        createdAt: new Date().toISOString().split('T')[0]
      };
      onUpdateVisitors([newVisitor, ...visitors]);
    }

    resetForm();
  };

  const handleStartEdit = (v: VisitorConnection) => {
    setEditingVisitorId(v.id);
    setVisitorName(v.visitorName);
    setContactInfo(v.contactInfo || '');
    setInvitedBy(v.invitedBy || '');
    setNotes(v.notes || '');
    setCoffeeShopNotes(v.coffeeShopNotes || '');
    setSelectedInterests(v.interests || []);
    setAssignedPerson(v.assignedFollowUpPerson || 'Pastor Aleš');
    setStatus(v.followUpStatus);
    setTargetSundayId(v.sundayId || sundays[0]?.id || '');
    setIsAddingNew(true);
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
                          (v.invitedBy && v.invitedBy.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;

    if (activeTab === 'new') return v.followUpStatus === 'new';
    if (activeTab === 'contacted') return v.followUpStatus === 'contacted';
    if (activeTab === 'completed') return v.followUpStatus === 'connected' || v.followUpStatus === 'completed';

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
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-amber-200 shadow-2xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'all' ? 'bg-amber-900 text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {currentLanguage === 'sl' ? 'Vsi' : 'All'} ({visitors.length})
            </button>
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
          </div>

          {/* Add New Visitor Button */}
          {canEdit && !isAddingNew && (
            <button
              onClick={() => { resetForm(); setIsAddingNew(true); }}
              className="px-4 py-2 bg-amber-900 hover:bg-amber-950 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-amber-300" />
              <span>{currentLanguage === 'sl' ? 'Zabeleži Novega Obiskovalca' : 'Log New Visitor'}</span>
            </button>
          )}
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          
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
                    placeholder={currentLanguage === 'sl' ? 'npr. Luka & Maja Podgoršek' : 'e.g. John & Mary Smith'}
                    className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-amber-600"
                  />
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
                    className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-amber-600"
                  >
                    <option value="Pastor Aleš">Pastor Aleš</option>
                    <option value="Whitney">Whitney</option>
                    {people.map(p => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
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
                        
                        {/* Status Badge */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                          v.followUpStatus === 'new' 
                            ? 'bg-amber-100 text-amber-900 border-amber-300' 
                            : v.followUpStatus === 'contacted'
                            ? 'bg-indigo-100 text-indigo-900 border-indigo-200'
                            : 'bg-emerald-100 text-emerald-900 border-emerald-200'
                        }`}>
                          {v.followUpStatus === 'new' && <Clock className="w-3 h-3 text-amber-700" />}
                          {v.followUpStatus === 'contacted' && <PhoneCall className="w-3 h-3 text-indigo-700" />}
                          {(v.followUpStatus === 'connected' || v.followUpStatus === 'completed') && <CheckCircle2 className="w-3 h-3 text-emerald-700" />}
                          <span>
                            {v.followUpStatus === 'new' && 'Za kontakt'}
                            {v.followUpStatus === 'contacted' && 'Kontaktirano'}
                            {v.followUpStatus === 'connected' && 'Povezano'}
                            {v.followUpStatus === 'completed' && 'Zaključeno'}
                          </span>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 font-sans">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <span>Obisk: <strong>{v.sundayDate}</strong></span>
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
                      <span>Odgovorna oseba za kontakt: <strong>{v.assignedFollowUpPerson || 'Pastor Aleš'}</strong></span>
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-400">Spremeni status:</span>
                        <select
                          value={v.followUpStatus}
                          onChange={(e) => handleStatusChange(v.id, e.target.value as FollowUpStatus)}
                          className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-[11px] font-bold text-gray-800 focus:outline-none focus:border-amber-600"
                        >
                          <option value="new">🟡 Novo</option>
                          <option value="contacted">🔵 Kontaktirano</option>
                          <option value="connected">🟢 Povezano</option>
                          <option value="completed">✅ Zaključeno</option>
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

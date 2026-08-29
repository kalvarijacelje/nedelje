import React, { useState } from 'react';
import { ServiceSunday, SpecialSundayFocus, SpecialSundayFocusType, Person } from '../types';
import { getEffectiveSundayFocus, getSundayOfMonthIndex, DEFAULT_COMMUNION_CHECKLIST } from '../lib/sundaySpecialFocus';
import { useBackdropHistory } from '../hooks/useBackdropHistory';
import { 
  Wine, 
  HeartHandshake, 
  CheckSquare, 
  Square, 
  Edit3, 
  Plus, 
  Sparkles, 
  MessageCircle, 
  Users, 
  ChevronRight, 
  X, 
  Check, 
  Tag, 
  Send,
  Coffee,
  HelpCircle,
  Clock
} from 'lucide-react';

interface SpecialSundayFocusSectionProps {
  sunday: ServiceSunday;
  people: Person[];
  canEdit: boolean;
  currentLanguage: 'sl' | 'en';
  onUpdateSunday: (updated: ServiceSunday) => void;
  activePersonName?: string;
}

export default function SpecialSundayFocusSection({
  sunday,
  people,
  canEdit,
  currentLanguage,
  onUpdateSunday,
  activePersonName = 'Služabnik'
}: SpecialSundayFocusSectionProps) {
  const focus = getEffectiveSundayFocus(sunday);
  const { sundayIndex, monthName } = getSundayOfMonthIndex(sunday.date);

  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false);
  const [newEncouragementText, setNewEncouragementText] = useState('');

  useBackdropHistory(isEditingModalOpen, () => setIsEditingModalOpen(false), 'special-focus-edit-modal');

  // Form State for Modal
  const [focusType, setFocusType] = useState<SpecialSundayFocusType>(focus.type);
  const [inChargeInput, setInChargeInput] = useState((focus.communion?.inChargeNames || []).join(', '));
  const [breadTypeInput, setBreadTypeInput] = useState(focus.communion?.breadType || 'Brezglutenski kruh & navadni kruhki');
  const [drinkTypeInput, setDrinkTypeInput] = useState(focus.communion?.drinkType || 'Grozdni sok v posamičnih skodelicah');
  const [communionNotesInput, setCommunionNotesInput] = useState(focus.communion?.notes || '');

  const [familyNameInput, setFamilyNameInput] = useState(focus.prayerFocus?.familyNameOrPerson || '');
  const [sphereInput, setSphereInput] = useState(focus.prayerFocus?.sphereOfInfluence || '');
  const [prayerRequestsInput, setPrayerRequestsInput] = useState(focus.prayerFocus?.prayerRequests || '');

  // Toggle checklist item
  const handleToggleChecklist = (checkId: string) => {
    const currentChecklist = focus.communion?.checklist || DEFAULT_COMMUNION_CHECKLIST;
    const updatedChecklist = currentChecklist.map(item => 
      item.id === checkId ? { ...item, done: !item.done } : item
    );

    const updatedFocus: SpecialSundayFocus = {
      ...focus,
      type: 'communion',
      communion: {
        ...(focus.communion || {}),
        inChargeNames: focus.communion?.inChargeNames || ['Aleš & Whitney'],
        checklist: updatedChecklist
      }
    };

    onUpdateSunday({
      ...sunday,
      specialFocus: updatedFocus
    });
  };

  // Add new encouragement note
  const handleAddEncouragement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEncouragementText.trim()) return;

    const currentEncouragements = focus.prayerFocus?.encouragementNotes || [];
    const newNote = {
      id: 'enc-' + Date.now(),
      author: activePersonName,
      text: newEncouragementText.trim(),
      date: sunday.date
    };

    const updatedFocus: SpecialSundayFocus = {
      ...focus,
      type: 'prayer_focus',
      prayerFocus: {
        ...(focus.prayerFocus || { familyNameOrPerson: 'Družina' }),
        encouragementNotes: [newNote, ...currentEncouragements]
      }
    };

    onUpdateSunday({
      ...sunday,
      specialFocus: updatedFocus
    });

    setNewEncouragementText('');
  };

  // Save Modal
  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    const inChargeList = inChargeInput.split(',').map(s => s.trim()).filter(Boolean);

    let updatedFocus: SpecialSundayFocus;

    if (focusType === 'communion') {
      updatedFocus = {
        type: 'communion',
        communion: {
          inChargeNames: inChargeList.length > 0 ? inChargeList : ['Aleš & Whitney'],
          breadType: breadTypeInput,
          drinkType: drinkTypeInput,
          notes: communionNotesInput,
          checklist: focus.communion?.checklist || DEFAULT_COMMUNION_CHECKLIST
        }
      };
    } else if (focusType === 'prayer_focus') {
      updatedFocus = {
        type: 'prayer_focus',
        prayerFocus: {
          familyNameOrPerson: familyNameInput,
          sphereOfInfluence: sphereInput,
          prayerRequests: prayerRequestsInput,
          encouragementNotes: focus.prayerFocus?.encouragementNotes || []
        }
      };
    } else {
      updatedFocus = { type: 'none' };
    }

    onUpdateSunday({
      ...sunday,
      specialFocus: updatedFocus
    });

    setIsEditingModalOpen(false);
  };

  return (
    <div id="special-sunday-focus-section" className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
      {/* Top Bar with Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2.5">
          {focus.type === 'communion' ? (
            <div className="p-2.5 bg-rose-100 text-rose-800 rounded-xl border border-rose-200 shadow-2xs">
              <Wine className="w-5 h-5" />
            </div>
          ) : (
            <div className="p-2.5 bg-indigo-100 text-indigo-800 rounded-xl border border-indigo-200 shadow-2xs">
              <HeartHandshake className="w-5 h-5" />
            </div>
          )}

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-sm sm:text-base text-gray-900">
                {focus.type === 'communion' 
                  ? (currentLanguage === 'sl' ? '🍷 Gospodova Večerja' : '🍷 Lord\'s Supper / Communion')
                  : (currentLanguage === 'sl' ? '🙏 Molitev za Družino & Področje Vpliva' : '🙏 Family & Sphere Prayer Focus')}
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md border border-gray-200">
                {currentLanguage === 'sl' 
                  ? `${sundayIndex}. nedelja v mesecu` 
                  : `${sundayIndex}${sundayIndex === 1 ? 'st' : sundayIndex === 2 ? 'nd' : sundayIndex === 3 ? 'rd' : 'th'} Sunday of the month`}
              </span>
            </div>
            <p className="text-xs text-gray-500 font-sans">
              {focus.type === 'communion'
                ? (currentLanguage === 'sl' ? 'Gospodova Večerja poteka vsako 2. in 4. nedeljo v mesecu.' : 'Communion takes place on the 2nd and 4th Sunday of the month.')
                : (currentLanguage === 'sl' ? 'Posebna molitev za družine in njihov vpliv poteka 1., 3. in 5. nedeljo.' : 'Special family and sphere prayer focus on 1st, 3rd, and 5th Sundays.')}
            </p>
          </div>
        </div>

        {canEdit && (
          <button
            onClick={() => setIsEditingModalOpen(true)}
            className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Edit3 className="w-3.5 h-3.5 text-gray-500" />
            <span>{currentLanguage === 'sl' ? 'Uredi posebni poudarek' : 'Edit Special Focus'}</span>
          </button>
        )}
      </div>

      {/* --- COMMUNION DISPLAY CONTENT --- */}
      {focus.type === 'communion' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left: Info & Assignees */}
          <div className="p-4 bg-rose-50/50 border border-rose-200/80 rounded-xl space-y-3">
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-800">
                {currentLanguage === 'sl' 
                  ? '👤 Odgovorni za Pripravo & Služenje Gospodove Večerje:' 
                  : '👤 Assigned for Communion Preparation & Serving:'}
              </span>
              <p className="text-sm font-bold text-gray-900 font-display">
                {!canEdit 
                  ? (currentLanguage === 'sl' ? 'Dodeljeni strežniki' : 'Assigned servants')
                  : ((focus.communion?.inChargeNames || []).join(', ') || (currentLanguage === 'sl' ? 'Dodeljeni strežniki' : 'Assigned servants'))}
              </p>
            </div>

            <div className="space-y-1 text-xs text-gray-700 font-sans">
              <p><strong>{currentLanguage === 'sl' ? '🍞 Kruh:' : '🍞 Bread:'}</strong> {focus.communion?.breadType || (currentLanguage === 'sl' ? 'Brezglutenski kruh & navadni kruhki' : 'Gluten-free bread & regular loafs')}</p>
              <p><strong>{currentLanguage === 'sl' ? '🍷 Pijača:' : '🍷 Drink / Wine:'}</strong> {focus.communion?.drinkType || (currentLanguage === 'sl' ? 'Grozdni sok (brez alkohola) v posamičnih skodelicah' : 'Grape juice (non-alcoholic) in individual cups')}</p>
              {focus.communion?.notes && canEdit && (
                <p className="text-gray-600 italic">"{focus.communion.notes}"</p>
              )}
            </div>
          </div>

          {/* Right: Interactive Checklist */}
          <div className="p-4 bg-white border border-gray-200 rounded-xl space-y-2.5">
            <h4 className="text-xs font-bold text-gray-900 font-display uppercase tracking-wider flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-rose-600" />
              <span>{currentLanguage === 'sl' ? 'Seznam opravil za Gospodovo Večerjo:' : 'Communion Preparation Checklist:'}</span>
            </h4>

            <div className="space-y-2">
              {(focus.communion?.checklist || DEFAULT_COMMUNION_CHECKLIST).map((item) => (
                <div
                  key={item.id}
                  onClick={() => canEdit && handleToggleChecklist(item.id)}
                  className={`p-2 rounded-lg border text-xs flex items-center gap-2 transition cursor-pointer ${
                    item.done
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                      : 'bg-gray-50 border-gray-200 text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  {item.done ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-400 shrink-0" />
                  )}
                  <span className={item.done ? 'line-through text-gray-500' : 'font-medium'}>
                    {currentLanguage === 'sl' ? item.textSl : (item.textEn || item.textSl)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- PRAYER FOCUS DISPLAY CONTENT --- */}
      {focus.type === 'prayer_focus' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left: Family details & Requests */}
          <div className="p-4 bg-indigo-50/50 border border-indigo-200/80 rounded-xl space-y-3">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-800 block">
                {currentLanguage === 'sl' ? '🙏 Družina / Posameznik v Molitvi:' : '🙏 Family / Individual in Prayer:'}
              </span>
              <h4 className="text-base font-bold text-gray-900 font-display">
                {!canEdit 
                  ? (currentLanguage === 'sl' ? 'Oznanjena družina' : 'Featured Family')
                  : (focus.prayerFocus?.familyNameOrPerson || (currentLanguage === 'sl' ? 'Družina v molitvi' : 'Family in prayer'))}
              </h4>
            </div>

            {focus.prayerFocus?.sphereOfInfluence && (
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400 block">
                  {currentLanguage === 'sl' ? '🌐 Področje Vpliva (Sfera):' : '🌐 Sphere of Influence:'}
                </span>
                <span className="px-2.5 py-1 bg-indigo-100 text-indigo-900 font-semibold rounded-lg text-xs inline-block border border-indigo-200">
                  {focus.prayerFocus.sphereOfInfluence}
                </span>
              </div>
            )}

            {focus.prayerFocus?.prayerRequests && canEdit && (
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400 block">
                  {currentLanguage === 'sl' ? '📌 Molitvene Potrebe:' : '📌 Prayer Requests / Needs:'}
                </span>
                <p className="text-xs text-gray-800 leading-relaxed font-sans bg-white p-2.5 border border-indigo-100 rounded-lg">
                  {focus.prayerFocus.prayerRequests}
                </p>
              </div>
            )}
          </div>

          {/* Right: Encouragement & Blessings Notes */}
          <div className="p-4 bg-white border border-gray-200 rounded-xl space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-900 font-display uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>{currentLanguage === 'sl' ? 'Molitvena Spodbuda Občestva:' : 'Congregational Prayer Encouragement:'}</span>
              </h4>

              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {(focus.prayerFocus?.encouragementNotes || []).length === 0 ? (
                  <p className="text-xs text-gray-400 italic">
                    {currentLanguage === 'sl' ? 'Bodi prvi, ki doda kratko molitveno misel za družino!' : 'Be the first to add a short prayer note for the family!'}
                  </p>
                ) : (
                  focus.prayerFocus?.encouragementNotes?.map((note) => (
                    <div key={note.id} className="p-2 bg-gray-50 border border-gray-200/80 rounded-lg text-xs space-y-0.5">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-gray-500">
                        <span>{note.author}</span>
                        <span>{note.date}</span>
                      </div>
                      <p className="text-gray-800 font-medium font-sans">"{note.text}"</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Add Note */}
            <form onSubmit={handleAddEncouragement} className="flex gap-2 pt-2 border-t border-gray-100">
              <input
                type="text"
                value={newEncouragementText}
                onChange={(e) => setNewEncouragementText(e.target.value)}
                placeholder={currentLanguage === 'sl' ? 'Napiši kratko blagoslovilno misel...' : 'Write a short blessing note...'}
                className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Send className="w-3 h-3" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditingModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-900 font-display flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-600" />
                <span>{currentLanguage === 'sl' ? 'Uredi Posebni Poudarek za Nedeljo' : 'Edit Special Focus for Sunday'}</span>
              </h3>
              <button onClick={() => setIsEditingModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 font-mono mb-1">
                  {currentLanguage === 'sl' ? 'Vrsta Posebnega Poudarka:' : 'Special Focus Type:'}
                </label>
                <select
                  value={focusType}
                  onChange={(e) => setFocusType(e.target.value as SpecialSundayFocusType)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-indigo-500"
                >
                  <option value="communion">{currentLanguage === 'sl' ? '🍷 Gospodova Večerja' : '🍷 Lord\'s Supper / Communion'}</option>
                  <option value="prayer_focus">{currentLanguage === 'sl' ? '🙏 Molitev za Družino / Posameznika' : '🙏 Family / Individual Prayer Focus'}</option>
                  <option value="none">{currentLanguage === 'sl' ? 'Prazno / Redno bogoslužje' : 'None / Regular Service'}</option>
                </select>
              </div>

              {focusType === 'communion' && (
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-400 font-mono mb-1">
                      {currentLanguage === 'sl' ? 'Odgovorni za Gospodovo Večerjo (ločeno s vejico):' : 'Assigned for Communion (comma-separated):'}
                    </label>
                    <input
                      type="text"
                      value={inChargeInput}
                      onChange={(e) => setInChargeInput(e.target.value)}
                      placeholder={currentLanguage === 'sl' ? 'npr. Aleš & Whitney, Peter Kovač' : 'e.g. Aleš & Whitney, John Doe'}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-400 font-mono mb-1">
                      {currentLanguage === 'sl' ? 'Vrsta Kruha:' : 'Bread Type:'}
                    </label>
                    <input
                      type="text"
                      value={breadTypeInput}
                      onChange={(e) => setBreadTypeInput(e.target.value)}
                      placeholder={currentLanguage === 'sl' ? 'npr. Brezglutenski kruh & navadni kruhki' : 'e.g. Gluten-free bread & regular loafs'}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-400 font-mono mb-1">
                      {currentLanguage === 'sl' ? 'Vrsta Pijače:' : 'Drink / Wine Type:'}
                    </label>
                    <input
                      type="text"
                      value={drinkTypeInput}
                      onChange={(e) => setDrinkTypeInput(e.target.value)}
                      placeholder={currentLanguage === 'sl' ? 'npr. Grozdni sok v skodelicah' : 'e.g. Grape juice in cups'}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              {focusType === 'prayer_focus' && (
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-500 font-mono mb-1">
                      {currentLanguage === 'sl' ? 'Izberi iz ekipe sodelavcev:' : 'Select from team roster:'}
                    </label>
                    <select
                      value=""
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          setFamilyNameInput(val);
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600 mb-2 cursor-pointer"
                    >
                      <option value="">{currentLanguage === 'sl' ? '-- Izberite iz ekipe ali vpišite poljubno spodaj --' : '-- Choose from roster or type custom below --'}</option>
                      {people
                        .filter(p => p && p.name)
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(p => {
                          const famLabel = p.familyMembers && p.familyMembers.length > 0 
                            ? `${currentLanguage === 'sl' ? 'Družina' : 'Family'} ${p.name} (${p.familyMembers.join(' & ')})`
                            : p.name;
                          return (
                            <option key={p.id || p.name} value={famLabel}>
                              👤 {famLabel}
                            </option>
                          );
                        })}
                    </select>

                    <label className="block text-[10px] font-bold uppercase text-gray-500 font-mono mb-1">
                      {currentLanguage === 'sl' ? 'Ali vpiši družino / osebo po meri:' : 'Or type custom family / person name:'}
                    </label>
                    <input
                      type="text"
                      value={familyNameInput}
                      onChange={(e) => setFamilyNameInput(e.target.value)}
                      placeholder={currentLanguage === 'sl' ? 'npr. Družina Novak ali Janez M.' : 'e.g. Smith Family or John S.'}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-400 font-mono mb-1">
                      {currentLanguage === 'sl' ? 'Področje Vpliva (Sfera):' : 'Sphere of Influence:'}
                    </label>
                    <input
                      type="text"
                      value={sphereInput}
                      onChange={(e) => setSphereInput(e.target.value)}
                      placeholder={currentLanguage === 'sl' ? 'npr. Šolstvo, podjetništvo in soseska' : 'e.g. Education, workplace & neighborhood'}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-400 font-mono mb-1">
                      {currentLanguage === 'sl' ? 'Molitvene Potrebe:' : 'Prayer Requests / Needs:'}
                    </label>
                    <textarea
                      rows={3}
                      value={prayerRequestsInput}
                      onChange={(e) => setPrayerRequestsInput(e.target.value)}
                      placeholder={currentLanguage === 'sl' ? 'Napišite konkretne molitvene potrebe...' : 'Enter specific prayer requests...'}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Prekliči
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                >
                  Shrani
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

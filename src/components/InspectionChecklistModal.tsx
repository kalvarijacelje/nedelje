import React, { useState, useRef } from 'react';
import { useBackdropHistory } from '../hooks/useBackdropHistory';
import { 
  ClipboardCheck, 
  Coffee, 
  ExternalLink, 
  FileText, 
  CheckCircle2, 
  Circle, 
  Sparkles, 
  X, 
  Building2, 
  Copy, 
  Check, 
  Layers, 
  Volume2, 
  Baby, 
  Sparkle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface InspectionChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: 'sl' | 'en';
  defaultCategory?: 'coffee_upper_hall' | 'tech_stage' | 'kids_classrooms' | 'general_cleaning';
  initialCategory?: 'coffee_upper_hall' | 'tech_stage' | 'kids_classrooms' | 'general_cleaning' | string;
}

export const UPPER_HALL_COFFEE_DOC_URL = 'https://docs.google.com/document/d/1wmI85X8MY501sqgY-z0dm03VtB3lFTCyi46TObb_f40/edit?usp=sharing';

interface ChecklistItem {
  id: string;
  taskSl: string;
  taskEn: string;
  detailSl?: string;
  detailEn?: string;
  section: 'pre_service' | 'during_service' | 'post_service';
}

const UPPER_HALL_ITEMS: ChecklistItem[] = [
  // Pre-Service
  {
    id: 'uh_1',
    section: 'pre_service',
    taskSl: 'Vklop grelnikov vode in aparata za kavo (ob 09:15)',
    taskEn: 'Turn on water heaters & coffee machines (by 09:15)',
    detailSl: 'Preveri raven vode v rezervoarjih in pripravi svežo kavo ter čaje.',
    detailEn: 'Check water reservoir levels, set up fresh coffee blends and tea choices.'
  },
  {
    id: 'uh_2',
    section: 'pre_service',
    taskSl: 'Priprava pulta, skodelic, serviet ter sladkorja',
    taskEn: 'Set up counter, mugs, napkins, milk & sugar',
    detailSl: 'Postavi čiste skodelice, žličke, mleko (navadno in rastlinsko), sladkor in papirnate serviete.',
    detailEn: 'Provide clean mugs, spoons, regular & plant milk, sugar, and paper napkins.'
  },
  {
    id: 'uh_3',
    section: 'pre_service',
    taskSl: 'Ureditev miz in stolov v zgornji dvorani / kavarni',
    taskEn: 'Arrange tables and seating in Upper Hall / Coffee Shop',
    detailSl: 'Obriši mize, preveri urejenost stolov in postavi letake/obiltenčke.',
    detailEn: 'Wipe tables, align seating comfortably, and display church flyers/bulletins.'
  },
  {
    id: 'uh_4',
    section: 'pre_service',
    taskSl: 'Priprava prigrizkov, piškotov ali sadja',
    taskEn: 'Prepare snacks, cookies or fruit platters',
    detailSl: 'Uredi pladnje s prigrizki na osrednjem pultu zgornje dvorane.',
    detailEn: 'Arrange snack platters neatly on the main Upper Hall serving table.'
  },

  // During Service
  {
    id: 'uh_5',
    section: 'during_service',
    taskSl: 'Nadzor nad pultom in priprava za osvežitev po bogoslužju',
    taskEn: 'Monitor setup and prepare post-service refreshments',
    detailSl: 'Zagotovi, da je kava topla in pripravljena takoj ob zaključku službe (~11:30).',
    detailEn: 'Ensure coffee is fresh and hot right as the main service concludes (~11:30).'
  },
  {
    id: 'uh_6',
    section: 'during_service',
    taskSl: 'Sprejem novih obiskovalcev in toplina v dvorani',
    taskEn: 'Welcome first-time guests & maintain warm atmosphere',
    detailSl: 'Pripravi usmerjevalne tabličke in usmeri obiskovalce k pultu po zaključku.',
    detailEn: 'Guide first-time visitors warmly to the coffee shop area after service.'
  },

  // Post-Service
  {
    id: 'uh_7',
    section: 'post_service',
    taskSl: 'Postrežba kave, čaja in osvežilnih pijač',
    taskEn: 'Serve coffee, tea & beverages to guests and congregation',
    detailSl: 'Pomagaj pri postrežbi obiskovalcem in družinam po bogoslužju.',
    detailEn: 'Help serve members, guests, and families during post-service fellowship.'
  },
  {
    id: 'uh_8',
    section: 'post_service',
    taskSl: 'Čiščenje aparata za kavo in pranje vrčev/skodelic',
    taskEn: 'Clean coffee machines and wash used mugs/carafes',
    detailSl: 'Izprazni kavo, operi vrče, očisti šobe za mleko in zloži čisto posodo.',
    detailEn: 'Empty coffee grounds, rinse carafes, clean milk nozzles, and put away clean dishes.'
  },
  {
    id: 'uh_9',
    section: 'post_service',
    taskSl: 'Brisača & razkuževanje miz ter pulta',
    taskEn: 'Sanitize tables, counters and coffee area',
    detailSl: 'Obriši vse mize z razkužilom, pobriši razlite tekočine in pospravi drobtine.',
    detailEn: 'Wipe all tables with disinfectant, wipe spills, and clear crumbs.'
  },
  {
    id: 'uh_10',
    section: 'post_service',
    taskSl: 'Praznjenje smetnjakov in zamenjava vrečk',
    taskEn: 'Empty waste bins & replace trash liners',
    detailSl: 'Odnesi smeti v zabojnike in namesti sveže vrečke v zgornji dvorani ter kavarni.',
    detailEn: 'Take trash to containers outside and fit new liners in Upper Hall bins.'
  },
  {
    id: 'uh_11',
    section: 'post_service',
    taskSl: 'Pregled zapiranja: Izklop grelnikov, luči in zaklepanje',
    taskEn: 'Final inspection: Turn off heaters, lights & lock up',
    detailSl: 'Preveri, da so vsi grelniki izklopljeni, okna zaprta in luči ugasnjene.',
    detailEn: 'Double check all boilers are turned off, windows closed, and lights off.'
  }
];

export default function InspectionChecklistModal({
  isOpen,
  onClose,
  currentLanguage,
  defaultCategory = 'coffee_upper_hall'
}: InspectionChecklistModalProps) {
  useBackdropHistory(isOpen, onClose, 'inspection-checklist-modal');

  if (!isOpen) return null;

  const [activeCategory, setActiveCategory] = useState<'coffee_upper_hall' | 'tech_stage' | 'kids_classrooms' | 'general_cleaning'>(defaultCategory);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [copiedLink, setCopiedLink] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsRef.current) {
      const scrollAmount = direction === 'left' ? -180 : 180;
      tabsRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const toggleCheck = (id: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleCopyDocLink = () => {
    navigator.clipboard.writeText(UPPER_HALL_COFFEE_DOC_URL);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const completedCount = UPPER_HALL_ITEMS.filter(i => checkedItems[i.id]).length;
  const progressPercent = Math.round((completedCount / UPPER_HALL_ITEMS.length) * 100);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-150 w-full max-w-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-900 via-amber-800 to-amber-950 text-white p-4 sm:p-5 flex items-start justify-between shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-amber-500/20 rounded-lg text-amber-300 border border-amber-400/30">
                <ClipboardCheck className="w-5 h-5" />
              </span>
              <h2 className="font-display font-bold text-base sm:text-lg">
                {currentLanguage === 'sl' 
                  ? 'Kontrolni Seznami in Navodila za Ureditev Prostorov' 
                  : 'Church Setup & Inspection Lists'}
              </h2>
            </div>
            <p className="text-xs text-amber-200/90 leading-relaxed max-w-md">
              {currentLanguage === 'sl'
                ? 'Natančni koraki in standardi za ureditev dvorane, kavarne ter služenje.'
                : 'Detailed step-by-step standards for church area setup and inspections.'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-xl text-amber-200 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inspection Area Tabs with Left/Right Navigation Arrows */}
        <div className="bg-amber-50/80 border-b border-amber-200/80 px-2 sm:px-3 py-2 flex items-center gap-1.5 shrink-0 relative">
          <button
            type="button"
            onClick={() => scrollTabs('left')}
            className="p-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300/80 transition cursor-pointer shrink-0 shadow-2xs active:scale-95"
            title={currentLanguage === 'sl' ? 'Pomakni levo' : 'Scroll left'}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div 
            ref={tabsRef}
            className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap py-0.5 px-1 flex-1"
          >
            <button
              onClick={() => setActiveCategory('coffee_upper_hall')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
                activeCategory === 'coffee_upper_hall'
                  ? 'bg-amber-800 text-white shadow-xs'
                  : 'text-amber-950 hover:bg-amber-100/90 bg-white/80 border border-amber-200/70'
              }`}
            >
              <Coffee className="w-3.5 h-3.5" />
              <span>{currentLanguage === 'sl' ? 'Zgornja dvorana & Kavarna' : 'Upper Hall & Coffee Shop'}</span>
              <span className="px-1.5 py-0.2 bg-amber-400 text-amber-950 font-mono text-[9px] rounded-full font-bold">
                Doc Link
              </span>
            </button>

            <button
              onClick={() => setActiveCategory('tech_stage')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
                activeCategory === 'tech_stage'
                  ? 'bg-amber-800 text-white shadow-xs'
                  : 'text-amber-950 hover:bg-amber-100/90 bg-white/80 border border-amber-200/70'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{currentLanguage === 'sl' ? 'Ozvočenje' : 'Sound Guide'}</span>
            </button>

            <button
              onClick={() => setActiveCategory('kids_classrooms')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
                activeCategory === 'kids_classrooms'
                  ? 'bg-amber-800 text-white shadow-xs'
                  : 'text-amber-950 hover:bg-amber-100/90 bg-white/80 border border-amber-200/70'
              }`}
            >
              <Baby className="w-3.5 h-3.5" />
              <span>{currentLanguage === 'sl' ? 'Nedeljska Šola' : 'Kids Classrooms'}</span>
            </button>

            <button
              onClick={() => setActiveCategory('general_cleaning')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
                activeCategory === 'general_cleaning'
                  ? 'bg-amber-800 text-white shadow-xs'
                  : 'text-amber-950 hover:bg-amber-100/90 bg-white/80 border border-amber-200/70'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{currentLanguage === 'sl' ? 'Splošno Čiščenje' : 'General Cleanliness'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => scrollTabs('right')}
            className="p-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300/80 transition cursor-pointer shrink-0 shadow-2xs active:scale-95"
            title={currentLanguage === 'sl' ? 'Pomakni desno' : 'Scroll right'}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
          
          {/* Active Category: Upper Hall & Coffee Shop */}
          {activeCategory === 'coffee_upper_hall' && (
            <div className="space-y-4">

              {/* Official Google Doc Link Banner */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/80 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-amber-700 shrink-0" />
                      <h3 className="text-xs font-bold text-amber-950 font-display">
                        {currentLanguage === 'sl' 
                          ? 'Uradni Google Dokument Navodil (Upper Hall & Coffee Shop Setup)' 
                          : 'Official Setup Document (Upper Hall & Coffee Shop)'}
                      </h3>
                    </div>
                    <p className="text-[11px] text-amber-800/90 leading-relaxed">
                      {currentLanguage === 'sl'
                        ? 'Celotna specifikacija z opisi, standardi in navodili za ekipo gostoljubja ter čiščenje zgornje dvorane.'
                        : 'Full specifications, team standards, and guidelines for Upper Hall setup & Coffee Shop hospitality.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={UPPER_HALL_COFFEE_DOC_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{currentLanguage === 'sl' ? 'Odpri Google Doc' : 'Open Google Doc'}</span>
                    </a>

                    <button
                      type="button"
                      onClick={handleCopyDocLink}
                      className="p-2 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300/80 rounded-xl transition cursor-pointer"
                      title={currentLanguage === 'sl' ? 'Kopiraj povezavo' : 'Copy document link'}
                    >
                      {copiedLink ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4 text-amber-800" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Interactive In-App Inspection Checklist Progress */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-amber-700" />
                    <h4 className="text-xs font-bold text-gray-900 font-display">
                      {currentLanguage === 'sl' ? 'Interaktivni Pregledni Seznam Opravil' : 'Interactive Inspection Checklist'}
                    </h4>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    {completedCount} / {UPPER_HALL_ITEMS.length} ({progressPercent}%)
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-amber-600 h-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Sections */}
                <div className="space-y-4 pt-2">
                  
                  {/* 1. Pred Bogoslužjem */}
                  <div className="space-y-2">
                    <h5 className="text-[11px] font-bold text-amber-900 uppercase font-mono tracking-wider bg-amber-100/60 px-2.5 py-1 rounded-md inline-block">
                      1. {currentLanguage === 'sl' ? 'Pred Bogoslužjem (09:00 - 10:00)' : 'Pre-Service Setup (09:00 - 10:00)'}
                    </h5>

                    <div className="space-y-1.5">
                      {UPPER_HALL_ITEMS.filter(i => i.section === 'pre_service').map(item => {
                        const isChecked = checkedItems[item.id];
                        return (
                          <div
                            key={item.id}
                            onClick={() => toggleCheck(item.id)}
                            className={`p-2.5 rounded-xl border transition cursor-pointer flex items-start gap-2.5 ${
                              isChecked 
                                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' 
                                : 'bg-gray-50/70 hover:bg-amber-50/40 border-gray-200 text-gray-800'
                            }`}
                          >
                            <span className="mt-0.5 shrink-0">
                              {isChecked ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Circle className="w-4 h-4 text-gray-400" />
                              )}
                            </span>
                            <div className="space-y-0.5 text-xs">
                              <p className={`font-semibold ${isChecked ? 'line-through text-emerald-800' : 'text-gray-900'}`}>
                                {currentLanguage === 'sl' ? item.taskSl : item.taskEn}
                              </p>
                              {item.detailSl && (
                                <p className="text-[11px] text-gray-500 leading-snug">
                                  {currentLanguage === 'sl' ? item.detailSl : item.detailEn}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Med Bogoslužjem */}
                  <div className="space-y-2">
                    <h5 className="text-[11px] font-bold text-amber-900 uppercase font-mono tracking-wider bg-amber-100/60 px-2.5 py-1 rounded-md inline-block">
                      2. {currentLanguage === 'sl' ? 'Med Bogoslužjem (10:00 - 11:30)' : 'During Service Preparation (10:00 - 11:30)'}
                    </h5>

                    <div className="space-y-1.5">
                      {UPPER_HALL_ITEMS.filter(i => i.section === 'during_service').map(item => {
                        const isChecked = checkedItems[item.id];
                        return (
                          <div
                            key={item.id}
                            onClick={() => toggleCheck(item.id)}
                            className={`p-2.5 rounded-xl border transition cursor-pointer flex items-start gap-2.5 ${
                              isChecked 
                                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' 
                                : 'bg-gray-50/70 hover:bg-amber-50/40 border-gray-200 text-gray-800'
                            }`}
                          >
                            <span className="mt-0.5 shrink-0">
                              {isChecked ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Circle className="w-4 h-4 text-gray-400" />
                              )}
                            </span>
                            <div className="space-y-0.5 text-xs">
                              <p className={`font-semibold ${isChecked ? 'line-through text-emerald-800' : 'text-gray-900'}`}>
                                {currentLanguage === 'sl' ? item.taskSl : item.taskEn}
                              </p>
                              {item.detailSl && (
                                <p className="text-[11px] text-gray-500 leading-snug">
                                  {currentLanguage === 'sl' ? item.detailSl : item.detailEn}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Po Bogoslužju & Zaključek */}
                  <div className="space-y-2">
                    <h5 className="text-[11px] font-bold text-amber-900 uppercase font-mono tracking-wider bg-amber-100/60 px-2.5 py-1 rounded-md inline-block">
                      3. {currentLanguage === 'sl' ? 'Po Bogoslužju & Čiščenje (11:30 - 12:30)' : 'Post-Service Fellowship & Cleaning'}
                    </h5>

                    <div className="space-y-1.5">
                      {UPPER_HALL_ITEMS.filter(i => i.section === 'post_service').map(item => {
                        const isChecked = checkedItems[item.id];
                        return (
                          <div
                            key={item.id}
                            onClick={() => toggleCheck(item.id)}
                            className={`p-2.5 rounded-xl border transition cursor-pointer flex items-start gap-2.5 ${
                              isChecked 
                                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' 
                                : 'bg-gray-50/70 hover:bg-amber-50/40 border-gray-200 text-gray-800'
                            }`}
                          >
                            <span className="mt-0.5 shrink-0">
                              {isChecked ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Circle className="w-4 h-4 text-gray-400" />
                              )}
                            </span>
                            <div className="space-y-0.5 text-xs">
                              <p className={`font-semibold ${isChecked ? 'line-through text-emerald-800' : 'text-gray-900'}`}>
                                {currentLanguage === 'sl' ? item.taskSl : item.taskEn}
                              </p>
                              {item.detailSl && (
                                <p className="text-[11px] text-gray-500 leading-snug">
                                  {currentLanguage === 'sl' ? item.detailSl : item.detailEn}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* Other Inspection Categories (Placeholders for future inspection docs) */}
          {activeCategory !== 'coffee_upper_hall' && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center space-y-3">
              <Sparkles className="w-8 h-8 text-amber-600 mx-auto" />
              <h3 className="text-xs font-bold text-gray-900 font-display">
                {currentLanguage === 'sl' ? 'Pripravljamo dodatne kontrolne sezname' : 'Additional Inspection Lists Coming Soon'}
              </h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
                {currentLanguage === 'sl'
                  ? 'Za to področje bomo kmalu dodali neposredno povezavo do pripadajočega Google Dokumenta in interaktivni pregledni seznam.'
                  : 'We will link the corresponding Google Documents and interactive checklists for this area soon.'}
              </p>
              <button
                onClick={() => setActiveCategory('coffee_upper_hall')}
                className="px-3.5 py-1.5 bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold rounded-lg shadow-2xs transition cursor-pointer"
              >
                {currentLanguage === 'sl' ? 'Nazaj na Zgornjo Dvorano & Kavo' : 'Back to Upper Hall & Coffee Shop'}
              </button>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 border-t border-gray-200 p-3 sm:p-4 flex items-center justify-between shrink-0">
          <a
            href={UPPER_HALL_COFFEE_DOC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-amber-800 hover:text-amber-900 flex items-center gap-1.5 underline decoration-amber-300"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>{currentLanguage === 'sl' ? 'Odpri celoten Google Dokument' : 'Open full Google Document'}</span>
          </a>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            {currentLanguage === 'sl' ? 'Zapri' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
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
  Volume2, 
  Baby, 
  ChevronLeft,
  ChevronRight,
  Sliders,
  Sparkle
} from 'lucide-react';

export type InspectionCategoryType = 'coffee_upper_hall' | 'tech_stage' | 'kids_classrooms' | 'general_cleaning';

interface InspectionChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: 'sl' | 'en';
  defaultCategory?: InspectionCategoryType;
  initialCategory?: InspectionCategoryType | string;
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

const CATEGORY_CONFIG: Record<InspectionCategoryType, {
  nameSl: string;
  nameEn: string;
  icon: any;
  docUrl: string;
  docTitleSl: string;
  docTitleEn: string;
  docDescSl: string;
  docDescEn: string;
  items: ChecklistItem[];
}> = {
  coffee_upper_hall: {
    nameSl: 'Zgornja dvorana & Kavarna',
    nameEn: 'Upper Hall & Coffee Shop',
    icon: Coffee,
    docUrl: UPPER_HALL_COFFEE_DOC_URL,
    docTitleSl: 'Uradni Google Dokument Navodil (Upper Hall & Coffee Shop Setup)',
    docTitleEn: 'Official Setup Document (Upper Hall & Coffee Shop)',
    docDescSl: 'Celotna specifikacija z opisi, standardi in navodili za ekipo gostoljubja ter čiščenje zgornje dvorane.',
    docDescEn: 'Full specifications, team standards, and guidelines for Upper Hall setup & Coffee Shop hospitality.',
    items: [
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
        detailSl: 'Obriši mize, preveri urejenost stolov in postavi letake/obvestila.',
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
    ]
  },
  tech_stage: {
    nameSl: 'Tehnika & Oder',
    nameEn: 'Tech, Sound & Stage',
    icon: Volume2,
    docUrl: UPPER_HALL_COFFEE_DOC_URL,
    docTitleSl: 'Standardi & Protokoli za Ozvočenje, Luči ter Projekcijo',
    docTitleEn: 'Audio, Stage & Visual Presentation Standards',
    docDescSl: 'Navodila za vklop zvočnega sistema, nastavitev mikrofonov, odrske monitorje ter varno ugašanje opreme.',
    docDescEn: 'Guidelines for sound system startup, microphone levels, in-ear monitoring, and safe shutdown.',
    items: [
      {
        id: 'ts_1',
        section: 'pre_service',
        taskSl: 'Vklop glavnega električnega stikala in mešalne mize (ob 08:30)',
        taskEn: 'Power on master audio switch & digital mixing console (by 08:30)',
        detailSl: 'Najprej vklopi mešalno mizo ter preveri shranjene nastavitve za nedeljsko bogoslužje.',
        detailEn: 'Power on the digital mixer first and recall Sunday service scene presets.'
      },
      {
        id: 'ts_2',
        section: 'pre_service',
        taskSl: 'Vklop ojačevalcev, odrskih monitorjev in brezžičnih sprejemnikov',
        taskEn: 'Power on amplifiers, stage monitors & wireless mic receivers',
        detailSl: 'Preveri stabilnost povezav in glasnost glavnih zvočnikov v dvorani.',
        detailEn: 'Confirm signal flow and verify main PA and monitor levels.'
      },
      {
        id: 'ts_3',
        section: 'pre_service',
        taskSl: 'Zamenjava baterij v brezžičnih mikrofonih in test (Vokal 1-4, Pridigar)',
        taskEn: 'Check & replace wireless mic batteries (Vocal 1-4, Preacher mic)',
        detailSl: 'Zagotovi sveže baterije in preizkusi jakost ter brezhiben sprejem signala.',
        detailEn: 'Ensure fresh batteries and test clear reception for speaking and singing.'
      },
      {
        id: 'ts_4',
        section: 'pre_service',
        taskSl: 'Povezava računalnika za besedila in preizkus projektorja / zaslonov',
        taskEn: 'Connect lyrics presentation computer & test video projectors',
        detailSl: 'Zaženi program za besedila (ProPresenter/PPT), naloži pesmi in preveri vidnost besedil.',
        detailEn: 'Open projection software, load worship lyrics and test screen clarity.'
      },
      {
        id: 'ts_5',
        section: 'pre_service',
        taskSl: 'Tonska vaja z bendom (Line check, vokali, instrumenti ob 08:45)',
        taskEn: 'Full band line check & sound check (vocals, keys, acoustic, drums by 08:45)',
        detailSl: 'Uravnovesi glasnost v dvorani in na odru za prijetno zvočno izkušnjo.',
        detailEn: 'Balance front of house levels and in-ear/stage monitors.'
      },
      {
        id: 'ts_6',
        section: 'during_service',
        taskSl: 'Spremljanje ravni zvoka in glasnosti v dvorani med slavljenjem',
        taskEn: 'Monitor sound balance & volume levels during worship',
        detailSl: 'Usklajuj nivoje glasnosti glede na polnost dvorane in dinamiko pesmi.',
        detailEn: 'Maintain balanced acoustic dynamic suitable for congregational singing.'
      },
      {
        id: 'ts_7',
        section: 'during_service',
        taskSl: 'Pravočasen vklop mikrofona za pridigarja in video projekcija pridige',
        taskEn: 'Unmute preacher mic & display sermon scriptures smoothly',
        detailSl: 'Spremljaj potek bogoslužja in pravočasno menjaj diapozitive ter video vsebine.',
        detailEn: 'Follow service cues, advance scripture slides, and adjust vocal EQ.'
      },
      {
        id: 'ts_8',
        section: 'post_service',
        taskSl: 'Izklop ojačevalcev (najprej ojačevalci, nato mešalna miza)',
        taskEn: 'Power down sequence: Amplifiers first, then mixing console',
        detailSl: 'Pravilno zaporedje prepreči pok v zvočnikih in poškodbe membran.',
        detailEn: 'Always turn off power amps before powering down digital consoles.'
      },
      {
        id: 'ts_9',
        section: 'post_service',
        taskSl: 'Pospravljanje mikrofonov, kablov in DI boxov v zaklenjeno omaro',
        taskEn: 'Store wireless microphones, cables & DI boxes in locked tech cabinet',
        detailSl: 'Odstrani baterije iz mikrofonov in lepo navij mikrofonske kable.',
        detailEn: 'Remove batteries from mics, coil cables neatly, and secure wireless units.'
      },
      {
        id: 'ts_10',
        section: 'post_service',
        taskSl: 'Izklop projektorja, luči na odru in zaklep avdio režije',
        taskEn: 'Power off projectors, stage lighting & lock tech control booth',
        detailSl: 'Preveri, da so vsi ekrani ugasnjeni in tehnični pult zaklenjen.',
        detailEn: 'Double check screens, projectors, and lock the sound booth.'
      }
    ]
  },
  kids_classrooms: {
    nameSl: 'Nedeljska Šola',
    nameEn: 'Kids Classrooms',
    icon: Baby,
    docUrl: UPPER_HALL_COFFEE_DOC_URL,
    docTitleSl: 'Protokol Učilnic Nedeljske Šole & Varnost Otrok',
    docTitleEn: 'Sunday School Classroom Protocols & Safety Checklist',
    docDescSl: 'Ureditev učilnic, priprava svetopisemske lekcije, ustvarjalnih delavnic in varnostna predaja otrok staršem.',
    docDescEn: 'Classroom preparation, lesson supplies, interactive crafts, and child check-in/checkout security.',
    items: [
      {
        id: 'kc_1',
        section: 'pre_service',
        taskSl: 'Zračenje in toplotna priprava učilnic za otroke (ob 09:15)',
        taskEn: 'Air out & prepare warm, inviting classrooms for kids (by 09:15)',
        detailSl: 'Odpri okna za svež zrak in preveri primerno temperaturo v prostorih.',
        detailEn: 'Ventilate rooms and ensure comfortable room temperature for children.'
      },
      {
        id: 'kc_2',
        section: 'pre_service',
        taskSl: 'Postavitev miz, stolčkov in varnostni pregled igrač',
        taskEn: 'Arrange kids tables, seating & inspect toys for safety',
        detailSl: 'Razporedi prostore za malo (3-6 let) in veliko skupino (7-12 let).',
        detailEn: 'Organize age-appropriate play, learning, and craft areas.'
      },
      {
        id: 'kc_3',
        section: 'pre_service',
        taskSl: 'Priprava materialov za ustvarjanje, barvic in delovnih listov',
        taskEn: 'Prepare craft supplies, coloring materials, and lesson sheets',
        detailSl: 'Pripravi škarje, lepila, pobarvanke ter vizualne pripomočke za zgodbo.',
        detailEn: 'Set out scissors, glue, colored pencils, and lesson visual aids.'
      },
      {
        id: 'kc_4',
        section: 'pre_service',
        taskSl: 'Preizkus zvočnika / zaslona za otroško slavljenje in zgodbice',
        taskEn: 'Test media screen & audio player for kids worship songs',
        detailSl: 'Pripravi predvajalnik za otroško animacijo in pesmice.',
        detailEn: 'Queue upbeat kids worship songs and video animations.'
      },
      {
        id: 'kc_5',
        section: 'during_service',
        taskSl: 'Vpis prisotnih otrok (Check-in) in sprejem z nasmehom',
        taskEn: 'Child check-in, name tagging & warm greeting at door',
        detailSl: 'Zapiši posebnosti (alergije) in kontaktne podatke staršev ob prvem obisku.',
        detailEn: 'Note any allergies and welcome new visiting families warmly.'
      },
      {
        id: 'kc_6',
        section: 'during_service',
        taskSl: 'Izvedba svetopisemske lekcije, zlatega stiha in molitve',
        taskEn: 'Lead dynamic Bible lesson, memory verse & interactive prayer',
        detailSl: 'Vključi otroke v pogovor in razlago božje besede na njim razumljiv način.',
        detailEn: 'Engage kids with age-appropriate biblical storytelling and discussion.'
      },
      {
        id: 'kc_7',
        section: 'during_service',
        taskSl: 'Vodenje ustvarjalne delavnice, iger ter zdrava malica',
        taskEn: 'Guide creative craft workshop, fun games & serve snack',
        detailSl: 'Poskrbi za umivanje rok pred malico in varno ustvarjanje.',
        detailEn: 'Ensure handwashing hygiene before snack and assist with crafts.'
      },
      {
        id: 'kc_8',
        section: 'post_service',
        taskSl: 'Varna predaja otrok staršem z overitvijo',
        taskEn: 'Secure child checkout and direct parent handoff',
        detailSl: 'Otroka oddaj izključno staršem ali pooblaščenim skrbnikom.',
        detailEn: 'Only release children directly to authorized parents or guardians.'
      },
      {
        id: 'kc_9',
        section: 'post_service',
        taskSl: 'Pospravljanje igrač, barvic in delovnih zvezkov v omare',
        taskEn: 'Pack away toys, art supplies and learning materials in closets',
        detailSl: 'Zloži igrače v škatle in zapri omare z materiali.',
        detailEn: 'Organize games, clean tables, and stow away materials.'
      },
      {
        id: 'kc_10',
        section: 'post_service',
        taskSl: 'Brisanje miz, praznjenje koša za smeti in ugašanje luči',
        taskEn: 'Sanitize tables, empty trash bin & power off lights',
        detailSl: 'Obriši mize, odnesi smeti in preveri, da so okna zaprta.',
        detailEn: 'Wipe all surfaces, take trash to bins, and close windows.'
      }
    ]
  },
  general_cleaning: {
    nameSl: 'Splošno Čiščenje',
    nameEn: 'General Cleanliness',
    icon: Sparkles,
    docUrl: UPPER_HALL_COFFEE_DOC_URL,
    docTitleSl: 'Kontrolni Pregled Čistoče & Ureditve Stavbe',
    docTitleEn: 'Facility Cleanliness & Building Care Checklist',
    docDescSl: 'Standardi za čistočo vhodov, hodnikov, glavne dvorane in sanitarij pred in po bogoslužju.',
    docDescEn: 'Facility inspection standards for entrance, lobby, main auditorium, and restroom sanitation.',
    items: [
      {
        id: 'gc_1',
        section: 'pre_service',
        taskSl: 'Pregled vhoda, preddverja in poravnava predpražnikov (ob 08:45)',
        taskEn: 'Inspect main entrance, lobby & align welcoming floor mats (by 08:45)',
        detailSl: 'Odstrani listje, očisti stekla na vratih in poskrbi za čist prvi vtis.',
        detailEn: 'Sweep entryway, ensure clean door glass, and arrange welcome mats.'
      },
      {
        id: 'gc_2',
        section: 'pre_service',
        taskSl: 'Pregled sanitarij: Preverjanje mila, brisač in toaletnega papirja',
        taskEn: 'Restroom check: Refill liquid soap, paper towels & toilet rolls',
        detailSl: 'Preveri čistočo ogledal, umivalnikov in delovanje sušilnikov.',
        detailEn: 'Check mirrors, sinks, soap dispensers, and ensure ample supplies.'
      },
      {
        id: 'gc_3',
        section: 'pre_service',
        taskSl: 'Zračenje glavne dvorane in pregled urejenosti stolov',
        taskEn: 'Ventilate main auditorium & check neat row chair alignment',
        detailSl: 'Preveri, da so stoli poravnani in da so prehodi prosti ter varni.',
        detailEn: 'Align chair rows neatly and ensure wide, unobstructed aisles.'
      },
      {
        id: 'gc_4',
        section: 'during_service',
        taskSl: 'Nadzor nad čistočo hodnikov in sanitarij med dogodkom',
        taskEn: 'Monitor lobby & restroom cleanliness during worship service',
        detailSl: 'Občasno preveri sanitarije in hitro pobriši morebitna razlitja.',
        detailEn: 'Periodic check of restrooms to keep floors dry and clean.'
      },
      {
        id: 'gc_5',
        section: 'post_service',
        taskSl: 'Zbiranje vseh smeti in zamenjava vrečk v celotni stavbi',
        taskEn: 'Empty all trash bins throughout building & insert fresh liners',
        detailSl: 'Izprazni smetnjake v dvorani, preddverju, učilnicah in sanitarijah.',
        detailEn: 'Gather trash from auditorium, lobby, classrooms and bathrooms.'
      },
      {
        id: 'gc_6',
        section: 'post_service',
        taskSl: 'Sesanje in pomivanje tal v glavni dvorani ter preddverju',
        taskEn: 'Vacuum carpets & mop hard floors in auditorium and lobby',
        detailSl: 'Temeljito posesi preproge in pomij keramična tla z dišečim čistilom.',
        detailEn: 'Vacuum main carpet areas and mop hard surfaces thoroughly.'
      },
      {
        id: 'gc_7',
        section: 'post_service',
        taskSl: 'Temeljito čiščenje, razkuževanje sanitarij in umivalnikov',
        taskEn: 'Deep sanitize restrooms, toilet bowls, faucets and sinks',
        detailSl: 'Očisti z razkužilnim sredstvom školjke, pipe in obriši ogledala.',
        detailEn: 'Use disinfectant on all fixtures, wipe counters, and polish mirrors.'
      },
      {
        id: 'gc_8',
        section: 'post_service',
        taskSl: 'Ločevanje odpadkov in odvoz vseh vreč v zunanje zabojnike',
        taskEn: 'Dispose sorted recycling and trash bags into outdoor dumpsters',
        detailSl: 'Poskrbi za ločevanje embalaže, papirja in mešanih odpadkov.',
        detailEn: 'Ensure proper recycling separation and secure outside bin lids.'
      },
      {
        id: 'gc_9',
        section: 'post_service',
        taskSl: 'Končni pregled: Zapiranje vseh oken, ugašanje vseh luči in zaklepanje',
        taskEn: 'Final security check: Close all windows, turn off lights & lock up',
        detailSl: 'Preveri, da so vsi grelniki izklopljeni, stavba zaklenjena in alarm vklopljen.',
        detailEn: 'Ensure all auxiliary heaters are off, windows locked, and alarm set.'
      }
    ]
  }
};

export default function InspectionChecklistModal({
  isOpen,
  onClose,
  currentLanguage,
  defaultCategory = 'coffee_upper_hall',
  initialCategory
}: InspectionChecklistModalProps) {
  useBackdropHistory(isOpen, onClose, 'inspection-checklist-modal');

  const resolvedInitialCategory: InspectionCategoryType = 
    (initialCategory && (initialCategory in CATEGORY_CONFIG))
      ? (initialCategory as InspectionCategoryType)
      : (defaultCategory || 'coffee_upper_hall');

  const [activeCategory, setActiveCategory] = useState<InspectionCategoryType>(resolvedInitialCategory);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [copiedLink, setCopiedLink] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  // Synchronize category whenever modal opens or when initialCategory changes
  useEffect(() => {
    if (isOpen) {
      const targetCategory: InspectionCategoryType = 
        (initialCategory && (initialCategory in CATEGORY_CONFIG))
          ? (initialCategory as InspectionCategoryType)
          : (defaultCategory || 'coffee_upper_hall');
      setActiveCategory(targetCategory);
    }
  }, [isOpen, initialCategory, defaultCategory]);

  if (!isOpen) return null;

  const currentConfig = CATEGORY_CONFIG[activeCategory] || CATEGORY_CONFIG.coffee_upper_hall;
  const currentItems = currentConfig.items;

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
    navigator.clipboard.writeText(currentConfig.docUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const completedCount = currentItems.filter(i => checkedItems[i.id]).length;
  const progressPercent = currentItems.length > 0 
    ? Math.round((completedCount / currentItems.length) * 100) 
    : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-150 w-full max-w-3xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-900 via-amber-800 to-amber-950 text-white p-4 sm:p-5 flex items-start justify-between shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-amber-500/20 rounded-xl text-amber-300 border border-amber-400/30">
                <ClipboardCheck className="w-5 h-5" />
              </span>
              <h2 className="font-display font-bold text-base sm:text-lg">
                {currentLanguage === 'sl' 
                  ? 'Kontrolni Seznami in Navodila za Ureditev Prostorov' 
                  : 'Church Setup & Inspection Lists'}
              </h2>
            </div>
            <p className="text-xs text-amber-200/90 leading-relaxed max-w-md font-sans">
              {currentLanguage === 'sl'
                ? 'Natančni koraki in standardi za ureditev dvorane, tehnike, otrok in čiščenja.'
                : 'Detailed step-by-step standards for church area setup, tech, kids and cleaning.'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl text-amber-200 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inspection Area Tabs with Navigation */}
        <div className="bg-amber-50/90 border-b border-amber-200/80 px-2 sm:px-3 py-2.5 flex items-center gap-1.5 shrink-0 relative">
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
            {(Object.keys(CATEGORY_CONFIG) as InspectionCategoryType[]).map((catKey) => {
              const cat = CATEGORY_CONFIG[catKey];
              const IconComp = cat.icon;
              const isActive = activeCategory === catKey;

              return (
                <button
                  key={catKey}
                  onClick={() => setActiveCategory(catKey)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 whitespace-nowrap shadow-2xs ${
                    isActive
                      ? 'bg-amber-800 text-white shadow-md ring-2 ring-amber-600/30'
                      : 'text-amber-950 hover:bg-amber-100/90 bg-white/90 border border-amber-200/80'
                  }`}
                >
                  <IconComp className={`w-4 h-4 ${isActive ? 'text-amber-200' : 'text-amber-700'}`} />
                  <span>{currentLanguage === 'sl' ? cat.nameSl : cat.nameEn}</span>
                </button>
              );
            })}
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
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Active Category Header & Google Doc link banner */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/90 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-700 shrink-0" />
                  <h3 className="text-xs sm:text-sm font-bold text-amber-950 font-display">
                    {currentLanguage === 'sl' ? currentConfig.docTitleSl : currentConfig.docTitleEn}
                  </h3>
                </div>
                <p className="text-xs text-amber-800/90 leading-relaxed font-sans">
                  {currentLanguage === 'sl' ? currentConfig.docDescSl : currentConfig.docDescEn}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={currentConfig.docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer active:scale-95"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{currentLanguage === 'sl' ? 'Odpri Google Doc' : 'Open Google Doc'}</span>
                </a>

                <button
                  type="button"
                  onClick={handleCopyDocLink}
                  className="p-2.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300/80 rounded-xl transition cursor-pointer active:scale-95"
                  title={currentLanguage === 'sl' ? 'Kopiraj povezavo' : 'Copy document link'}
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4 text-amber-800" />}
                </button>
              </div>
            </div>
          </div>

          {/* Interactive In-App Inspection Checklist Progress */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-700" />
                <h4 className="text-xs sm:text-sm font-bold text-gray-900 font-display">
                  {currentLanguage === 'sl' ? `Interaktivni Seznam: ${currentConfig.nameSl}` : `Inspection List: ${currentConfig.nameEn}`}
                </h4>
              </div>
              <span className="text-xs font-mono font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                {completedCount} / {currentItems.length} ({progressPercent}%)
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-amber-600 h-full transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Sections */}
            <div className="space-y-5 pt-2">
              
              {/* 1. Pred Bogoslužjem */}
              {currentItems.some(i => i.section === 'pre_service') && (
                <div className="space-y-2.5">
                  <h5 className="text-[11px] font-bold text-amber-900 uppercase font-mono tracking-wider bg-amber-100/70 px-3 py-1.5 rounded-lg inline-block">
                    1. {currentLanguage === 'sl' ? 'Pred Bogoslužjem (Priprava)' : 'Pre-Service Setup'}
                  </h5>

                  <div className="space-y-2">
                    {currentItems.filter(i => i.section === 'pre_service').map(item => {
                      const isChecked = checkedItems[item.id];
                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleCheck(item.id)}
                          className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                            isChecked 
                              ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 shadow-2xs' 
                              : 'bg-gray-50/80 hover:bg-amber-50/50 border-gray-200 text-gray-800 hover:border-amber-200'
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
              )}

              {/* 2. Med Bogoslužjem */}
              {currentItems.some(i => i.section === 'during_service') && (
                <div className="space-y-2.5">
                  <h5 className="text-[11px] font-bold text-amber-900 uppercase font-mono tracking-wider bg-amber-100/70 px-3 py-1.5 rounded-lg inline-block">
                    2. {currentLanguage === 'sl' ? 'Med Bogoslužjem (Potek)' : 'During Service Operations'}
                  </h5>

                  <div className="space-y-2">
                    {currentItems.filter(i => i.section === 'during_service').map(item => {
                      const isChecked = checkedItems[item.id];
                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleCheck(item.id)}
                          className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                            isChecked 
                              ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 shadow-2xs' 
                              : 'bg-gray-50/80 hover:bg-amber-50/50 border-gray-200 text-gray-800 hover:border-amber-200'
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
              )}

              {/* 3. Po Bogoslužju & Zaključek */}
              {currentItems.some(i => i.section === 'post_service') && (
                <div className="space-y-2.5">
                  <h5 className="text-[11px] font-bold text-amber-900 uppercase font-mono tracking-wider bg-amber-100/70 px-3 py-1.5 rounded-lg inline-block">
                    3. {currentLanguage === 'sl' ? 'Po Bogoslužju & Pospravljanje' : 'Post-Service Fellowship & Shutdown'}
                  </h5>

                  <div className="space-y-2">
                    {currentItems.filter(i => i.section === 'post_service').map(item => {
                      const isChecked = checkedItems[item.id];
                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleCheck(item.id)}
                          className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                            isChecked 
                              ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 shadow-2xs' 
                              : 'bg-gray-50/80 hover:bg-amber-50/50 border-gray-200 text-gray-800 hover:border-amber-200'
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
              )}

            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 border-t border-gray-200 p-3.5 sm:p-4 flex items-center justify-between shrink-0">
          <a
            href={currentConfig.docUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-amber-800 hover:text-amber-900 flex items-center gap-1.5 underline decoration-amber-300 underline-offset-2"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>{currentLanguage === 'sl' ? 'Odpri uradni Google Dokument' : 'Open official Google Document'}</span>
          </a>

          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95"
          >
            {currentLanguage === 'sl' ? 'Zapri' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
}

import { SundaySchoolLesson, SundaySchoolSupply } from '../types';

export const INITIAL_SUNDAY_SCHOOL_LESSONS: SundaySchoolLesson[] = [
  // 31. 8. 2025
  {
    id: 'nsl-1',
    sundayId: 'sun-1',
    sundayDate: '31. 8. 2025',
    group: 'mlajsa',
    topicSl: 'Jezus je moj Dobri Pastir',
    bibleStorySl: 'Prilika o izgubljeni ovci (Luka 15:1-7)',
    memoryVerseSl: 'Gospod je moj pastir, nič mi ne manjka. (Psalm 23:1)',
    craftAndGamesSl: 'Izdelava mehke ovčke iz vate in papirnatih krožnikov. Igra: "Poišči izgubljeno ovčko v učilnici".',
    materialsNeeded: ['Papirnati krožniki', 'Vata', 'Lepilo', 'Črn karton za glavo ovčke'],
    googleDocUrl: 'https://docs.google.com/document/d/1_sample_nedeljska_sola_mlajsa_1/edit',
    teachers: ['Maja Lajlar'],
    helpers: ['Kaja Vrečko'],
    notes: 'Pripravi pesmico "Jezus me ima rad" in predvajaj preko bluetooth zvočnika.',
    status: 'planned'
  },
  {
    id: 'nsl-2',
    sundayId: 'sun-1',
    sundayDate: '31. 8. 2025',
    group: 'starejsa',
    topicSl: 'Mojzes in Izhod iz Egipta',
    bibleStorySl: 'Deset kuge in prehod čez Rdeče morje (2. Mojzesova 14)',
    memoryVerseSl: 'Gospod se bo bojeval za vas, vi pa bodite tiho! (2. Mojzesova 14:14)',
    craftAndGamesSl: 'Model Rdečega morja iz modrega krep papirja. Kviz o 10 egipčanskih kugah.',
    materialsNeeded: ['Modri krep papir', 'Škarje', 'Lesene palčke', 'Natisnjeni delovni listi'],
    googleDocUrl: 'https://docs.google.com/document/d/1_sample_nedeljska_sola_starejsa_1/edit',
    teachers: ['Peter Kovač'],
    helpers: ['David Novak'],
    notes: 'Pripravljeni delovni listi s križanko so v omarici Nedeljske šole.',
    status: 'planned'
  },
  // 7. 9. 2025
  {
    id: 'nsl-3',
    sundayId: 'sun-2',
    sundayDate: '7. 9. 2025',
    group: 'mlajsa',
    topicSl: 'Noe in Veliki potop',
    bibleStorySl: 'Noetova barka in mavrica kot obljuba (1. Mojzesova 6-9)',
    memoryVerseSl: 'Bog je zvest v svojih obljubah. (1. Korinčanom 1:9)',
    craftAndGamesSl: 'Barvanje velike skupinske mavrice in lepljenje živalic na papirnato barko.',
    materialsNeeded: ['Barvice', 'Vodne barve', 'Natisnjene živali', 'Velik plakat'],
    googleDocUrl: 'https://docs.google.com/document/d/1_sample_nedeljska_sola_mlajsa_2/edit',
    teachers: ['Maja Lajlar'],
    helpers: ['Ana Novak'],
    notes: 'Preveri ali imamo dovolj modre vode barve.',
    status: 'planned'
  },
  {
    id: 'nsl-4',
    sundayId: 'sun-2',
    sundayDate: '7. 9. 2025',
    group: 'starejsa',
    topicSl: 'David in Goljat - Pogum v veri',
    bibleStorySl: 'Zgodba o mladem Davidu in prači (1. Samuelova 17)',
    memoryVerseSl: 'Ti greš name z mečem, jaz pa grem nate v imenu Gospoda. (1. Samuelova 17:45)',
    craftAndGamesSl: 'Metanje mehkih žogic v plastične keglje ("Goljat"). Izdelava spominskega tiska z verzom.',
    materialsNeeded: ['Plastični keglji', 'Žogice', 'Karton', 'Flomastri'],
    googleDocUrl: 'https://docs.google.com/document/d/1_sample_nedeljska_sola_starejsa_2/edit',
    teachers: ['Luka Zupan'],
    helpers: ['Ema Horvat'],
    notes: 'Pogovor o tem, s kakšnimi "velikani" (strahovi) se srečujejo otroci v šoli.',
    status: 'planned'
  }
];

export const INITIAL_SUNDAY_SCHOOL_SUPPLIES: SundaySchoolSupply[] = [
  { id: 'sup-1', nameSl: 'Barvni papir in karton (A4/A3)', category: 'stationery', quantity: '3 paketi', status: 'ok', notes: 'Zaloga v zgornji omarici' },
  { id: 'sup-2', nameSl: 'Vata za ustvarjanje (ovčke, oblaki)', category: 'crafts', quantity: '1 paket', status: 'low', notes: 'Potrebno dokupiti za lekcijo o pastirju' },
  { id: 'sup-3', nameSl: 'Papirnati krožniki (beli)', category: 'crafts', quantity: '50 kosov', status: 'ok', notes: 'Za maske in krožne izdelke' },
  { id: 'sup-4', nameSl: 'Lepilo v stiku (Pritt / UHU)', category: 'stationery', quantity: '2 kosa', status: 'buy', notes: 'Nujno kupiti vsaj 5 novih lepil!' },
  { id: 'sup-5', nameSl: 'Otroške škarje s zaobljeno konico', category: 'stationery', quantity: '12 kosov', status: 'ok', notes: 'Vse delujoče' },
  { id: 'sup-6', nameSl: 'Flomastri in debeli voščeni svinčniki', category: 'stationery', quantity: '4 škatle', status: 'ok', notes: 'V omarici mlajše skupine' },
  { id: 'sup-7', nameSl: 'Plastelin različnih barv', category: 'crafts', quantity: '1 škatla', status: 'low', notes: 'Preveri ali se je posušil' },
  { id: 'sup-8', nameSl: 'Sadni sokci & piškoti za odmor', category: 'snacks', quantity: '10 sokcev', status: 'buy', notes: 'Kupi piškote brez oreščkov' },
  { id: 'sup-9', nameSl: 'Bluetooth zvočnik za otroške pesmi', category: 'equipment', quantity: '1 kos', status: 'ok', notes: 'Napolnjen na mizi' }
];

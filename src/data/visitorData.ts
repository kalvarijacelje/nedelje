import { VisitorConnection } from '../types';

export const INITIAL_VISITOR_CONNECTIONS: VisitorConnection[] = [
  {
    id: 'vis-1',
    sundayId: '1',
    sundayDate: '10. 8. 2025',
    visitorName: 'Luka & Maja Podgoršek',
    contactInfo: 'luka.podgorsek@example.com | 040 123 456',
    invitedBy: 'Peter Kovač',
    notes: 'Prvič obiskala bogoslužje. Zelo sta uživala v slavljenju. Po bogoslužju smo se družili v Kavarni Živa Vera pri kavi.',
    interests: ['Domača skupina', 'Kava v Kavarni Živa Vera', 'Glasbena ekipa'],
    assignedFollowUpPerson: 'Pastor Aleš',
    followUpStatus: 'contacted',
    coffeeShopNotes: 'Naročila kapučino v Kavarni Živa Vera, pogovor o mladinski in družinski skupini.',
    createdAt: '2025-08-10'
  },
  {
    id: 'vis-2',
    sundayId: '1',
    sundayDate: '10. 8. 2025',
    visitorName: 'Tjaša Novak',
    contactInfo: '031 987 654',
    invitedBy: 'Whitney',
    notes: 'Pred kratkim se je preselila v Celje. Zanima jo otroška nedeljska šola za njeno 6-letno hčerko.',
    interests: ['Nedeljska Šola', 'Domača skupina'],
    assignedFollowUpPerson: 'Whitney',
    followUpStatus: 'new',
    coffeeShopNotes: 'Družili smo se ob rogljičku in kavi spodaj v Živi Veri.',
    createdAt: '2025-08-10'
  }
];

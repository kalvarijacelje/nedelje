/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import MinistryView from '../components/MinistryView';
import { ServiceSunday, Ministry, Translation, Person, UserRole, SundaySchoolLesson, WorshipRosterEntry } from '../types';

export interface SluzbeProps {
  sundays: ServiceSunday[];
  ministries: Ministry[];
  people: Person[];
  translations: Translation;
  currentLanguage: 'sl' | 'en';
  userRole?: UserRole;
  worshipRoster?: WorshipRosterEntry[];
  sundaySchoolLessons?: SundaySchoolLesson[];
  onSelectSunday: (id: string) => void;
  onUpdateMinistryLeader?: (ministryId: string, leaderName: string) => void;
  onUpdatePersonLedMinistries?: (personName: string, ledMinistries: string[]) => void;
  onOpenInspectionModal?: (category?: 'coffee_upper_hall' | 'tech_stage' | 'kids_classrooms' | 'general_cleaning') => void;
}

export default function Sluzbe(props: SluzbeProps) {
  return <MinistryView {...props} />;
}

export { Sluzbe, Sluzbe as Službe };

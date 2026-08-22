/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import ScheduleView from '../components/ScheduleView';
import { ServiceSunday, Ministry, UserRole, Translation, Person } from '../types';

export interface UrnikProps {
  sundays: ServiceSunday[];
  ministries: Ministry[];
  people?: Person[];
  userRole: UserRole;
  translations: Translation;
  currentLanguage: 'sl' | 'en';
  onSelectSunday: (id: string) => void;
  onDeleteSunday: (id: string) => void;
  onGenerateAcademicYear: () => void;
  onOpenStatistics?: () => void;
}

export default function Urnik(props: UrnikProps) {
  return <ScheduleView {...props} />;
}

export { Urnik };

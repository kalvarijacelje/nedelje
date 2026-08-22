import { SundaySchoolLesson, ServiceSunday } from '../types';

/**
 * Find matching Sunday School lesson for a given Sunday and group key ('mlajsa' | 'starejsa').
 */
export function getSundaySchoolLesson(
  sunday: ServiceSunday,
  groupKey: 'mlajsa' | 'starejsa',
  lessons: SundaySchoolLesson[] = []
): SundaySchoolLesson | undefined {
  if (!sunday) return undefined;
  return lessons.find(
    l => (l.sundayId === sunday.id || l.sundayDate === sunday.date) && l.group === groupKey
  );
}

/**
 * Bi-directional Sync Helper:
 * When a Sunday object is updated from /sluzbe (assignments['nedeljska_sola_mlajsa'] or ['nedeljska_sola_starejsa']),
 * sync these teacher names into the corresponding SundaySchoolLesson in lessons list.
 */
export function syncSundaySchoolLessonsFromSunday(
  updatedSunday: ServiceSunday,
  currentLessons: SundaySchoolLesson[]
): SundaySchoolLesson[] {
  let nextLessons = [...currentLessons];

  const syncGroup = (groupKey: 'mlajsa' | 'starejsa', minId: string) => {
    const assignedTeachers = updatedSunday.assignments[minId] || [];
    if (assignedTeachers.length === 0) return;

    const existingIdx = nextLessons.findIndex(
      l => (l.sundayId === updatedSunday.id || l.sundayDate === updatedSunday.date) && l.group === groupKey
    );

    if (existingIdx >= 0) {
      nextLessons[existingIdx] = {
        ...nextLessons[existingIdx],
        sundayId: updatedSunday.id,
        sundayDate: updatedSunday.date,
        teachers: assignedTeachers
      };
    } else {
      nextLessons.push({
        id: 'nsl-' + groupKey + '-' + Date.now(),
        sundayId: updatedSunday.id,
        sundayDate: updatedSunday.date,
        group: groupKey,
        topicSl: 'Lekcija za ' + updatedSunday.date,
        bibleStorySl: '',
        teachers: assignedTeachers,
        helpers: [],
        status: 'planned'
      });
    }
  };

  syncGroup('mlajsa', 'nedeljska_sola_mlajsa');
  syncGroup('starejsa', 'nedeljska_sola_starejsa');

  return nextLessons;
}

/**
 * Bi-directional Sync Helper:
 * When lessons are updated from /sola (SundaySchoolView),
 * sync teacher assignments back into Sunday objects.
 */
export function syncSundaysFromSundaySchoolLessons(
  lessons: SundaySchoolLesson[],
  sundays: ServiceSunday[]
): ServiceSunday[] {
  return sundays.map(sunday => {
    const youngerLesson = lessons.find(
      l => (l.sundayId === sunday.id || l.sundayDate === sunday.date) && l.group === 'mlajsa'
    );
    const olderLesson = lessons.find(
      l => (l.sundayId === sunday.id || l.sundayDate === sunday.date) && l.group === 'starejsa'
    );

    let updatedAssignments = { ...sunday.assignments };
    let hasChanges = false;

    if (youngerLesson && youngerLesson.teachers.length > 0) {
      updatedAssignments['nedeljska_sola_mlajsa'] = youngerLesson.teachers;
      hasChanges = true;
    }

    if (olderLesson && olderLesson.teachers.length > 0) {
      updatedAssignments['nedeljska_sola_starejsa'] = olderLesson.teachers;
      hasChanges = true;
    }

    if (!hasChanges) return sunday;

    return {
      ...sunday,
      assignments: updatedAssignments
    };
  });
}

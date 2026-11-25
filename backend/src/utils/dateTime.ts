/**
 * Calculates inclusive calendar days between two YYYY-MM-DD date strings.
 */
export const calculateInclusiveCalendarDays = (startDateStr: string, endDateStr: string): number => {
  const start = new Date(`${startDateStr}T00:00:00.000Z`);
  const end = new Date(`${endDateStr}T00:00:00.000Z`);
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
};

/**
 * Adds hours to an HH:mm time string and returns formatted HH:mm.
 */
export const addHoursToTime = (timeStr: string, hoursToAdd: number): string => {
  const [hourStr, minuteStr] = timeStr.split(':');
  const totalMinutes = Number(hourStr) * 60 + Number(minuteStr) + hoursToAdd * 60;
  const endHour = Math.floor(totalMinutes / 60);
  const endMinute = totalMinutes % 60;
  return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
};


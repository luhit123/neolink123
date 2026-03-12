export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface CustomDateRangeInput {
  startDate?: string;
  endDate?: string;
}

/**
 * Shared date-range helper used across dashboard and registry views.
 * Calendar-based periods use 00:00-23:59 boundaries, while Today/Yesterday
 * remain shift-aware for operational workflows.
 */
export const getOperationalDateRange = (
  period: string,
  shiftStartTime: string,
  customDates?: CustomDateRangeInput,
  nowInput?: Date
): DateRange => {
  let startDate: Date;
  let endDate: Date;
  const now = nowInput ?? new Date();
  const [shiftHour, shiftMinute] = shiftStartTime.split(':').map(Number);

  if (/\d{4}-\d{2}/.test(period)) {
    const [year, month] = period.split('-').map(Number);
    startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    endDate = new Date(year, month, 0, 23, 59, 59, 999);
  } else {
    switch (period) {
      case 'Today':
        if (shiftStartTime === '00:00') {
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        } else {
          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();
          if (currentHour < shiftHour || (currentHour === shiftHour && currentMinute < shiftMinute)) {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, shiftHour, shiftMinute, 0, 0);
          } else {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), shiftHour, shiftMinute, 0, 0);
          }
        }
        endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000 - 1);
        break;
      case 'Yesterday':
        if (shiftStartTime === '00:00') {
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
        } else {
          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();
          let todayShiftStart: Date;
          if (currentHour < shiftHour || (currentHour === shiftHour && currentMinute < shiftMinute)) {
            todayShiftStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, shiftHour, shiftMinute, 0, 0);
          } else {
            todayShiftStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), shiftHour, shiftMinute, 0, 0);
          }
          startDate = new Date(todayShiftStart.getTime() - 24 * 60 * 60 * 1000);
        }
        endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000 - 1);
        break;
      case 'This Week':
        const firstDayOfWeek = new Date(now);
        firstDayOfWeek.setDate(now.getDate() - now.getDay());
        startDate = new Date(firstDayOfWeek.getFullYear(), firstDayOfWeek.getMonth(), firstDayOfWeek.getDate(), 0, 0, 0, 0);
        endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
        break;
      case 'This Month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case 'Custom':
        if (customDates?.startDate && customDates?.endDate) {
          startDate = new Date(customDates.startDate);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(customDates.endDate);
          endDate.setHours(23, 59, 59, 999);
        } else {
          startDate = new Date(0);
          endDate = new Date();
        }
        break;
      default:
        startDate = new Date(0);
        endDate = new Date();
        break;
    }
  }

  return { startDate, endDate };
};

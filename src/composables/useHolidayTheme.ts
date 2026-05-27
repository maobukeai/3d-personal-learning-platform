import { ref, onMounted } from 'vue';

export type HolidayType =
  | 'normal'
  | 'new-year'
  | 'spring-festival'
  | 'lantern-festival'
  | 'qingming'
  | 'labor-day'
  | 'dragon-boat'
  | 'qixi'
  | 'mid-autumn'
  | 'double-ninth'
  | 'national-day'
  | 'halloween'
  | 'christmas';

interface DateRange {
  start: { month: number; date: number };
  end: { month: number; date: number };
}

// Lunar holidays mapped to Gregorian date ranges.
// Data source: Calculations of solar-lunar terms (based on Purple Mountain Observatory astronomical data) 
// combined with standard Chinese government public holiday patterns for years 2026 to 2030.
const lunarHolidays: Record<number, {
  springFestival: DateRange;
  lanternFestival: DateRange;
  dragonBoat: DateRange;
  qixi: DateRange;
  midAutumn: DateRange;
  doubleNinth: DateRange;
}> = {
  2026: {
    springFestival: { start: { month: 2, date: 16 }, end: { month: 2, date: 22 } },
    lanternFestival: { start: { month: 3, date: 2 }, end: { month: 3, date: 3 } },
    dragonBoat: { start: { month: 6, date: 18 }, end: { month: 6, date: 20 } },
    qixi: { start: { month: 8, date: 18 }, end: { month: 8, date: 19 } },
    midAutumn: { start: { month: 9, date: 24 }, end: { month: 9, date: 26 } },
    doubleNinth: { start: { month: 10, date: 25 }, end: { month: 10, date: 26 } }
  },
  2027: {
    springFestival: { start: { month: 2, date: 5 }, end: { month: 2, date: 11 } },
    lanternFestival: { start: { month: 2, date: 19 }, end: { month: 2, date: 20 } },
    dragonBoat: { start: { month: 6, date: 8 }, end: { month: 6, date: 10 } },
    qixi: { start: { month: 8, date: 7 }, end: { month: 8, date: 8 } },
    midAutumn: { start: { month: 9, date: 14 }, end: { month: 9, date: 16 } },
    doubleNinth: { start: { month: 10, date: 14 }, end: { month: 10, date: 15 } }
  },
  2028: {
    springFestival: { start: { month: 1, date: 25 }, end: { month: 1, date: 31 } },
    lanternFestival: { start: { month: 2, date: 8 }, end: { month: 2, date: 9 } },
    dragonBoat: { start: { month: 5, date: 27 }, end: { month: 5, date: 29 } },
    qixi: { start: { month: 8, date: 25 }, end: { month: 8, date: 26 } },
    midAutumn: { start: { month: 10, date: 2 }, end: { month: 10, date: 4 } },
    doubleNinth: { start: { month: 10, date: 25 }, end: { month: 10, date: 26 } }
  },
  2029: {
    springFestival: { start: { month: 2, date: 12 }, end: { month: 2, date: 18 } },
    lanternFestival: { start: { month: 2, date: 26 }, end: { month: 2, date: 27 } },
    dragonBoat: { start: { month: 6, date: 15 }, end: { month: 6, date: 17 } },
    qixi: { start: { month: 8, date: 15 }, end: { month: 8, date: 16 } },
    midAutumn: { start: { month: 9, date: 21 }, end: { month: 9, date: 23 } },
    doubleNinth: { start: { month: 10, date: 15 }, end: { month: 10, date: 16 } }
  },
  2030: {
    springFestival: { start: { month: 2, date: 2 }, end: { month: 2, date: 8 } },
    lanternFestival: { start: { month: 2, date: 16 }, end: { month: 2, date: 17 } },
    dragonBoat: { start: { month: 6, date: 4 }, end: { month: 6, date: 6 } },
    qixi: { start: { month: 8, date: 4 }, end: { month: 8, date: 5 } },
    midAutumn: { start: { month: 9, date: 11 }, end: { month: 9, date: 13 } },
    doubleNinth: { start: { month: 10, date: 4 }, end: { month: 10, date: 5 } }
  }
};

export function useHolidayTheme() {
  const currentHoliday = ref<HolidayType>('normal');

  const checkHoliday = () => {
    const mock = localStorage.getItem('mock_holiday');
    if (mock) {
      currentHoliday.value = mock as HolidayType;
      return;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    const date = now.getDate();

    const isInRange = (startMonth: number, startDate: number, endMonth: number, endDate: number) => {
      const start = new Date(year, startMonth - 1, startDate, 0, 0, 0);
      const end = new Date(year, endMonth - 1, endDate, 23, 59, 59);
      return now >= start && now <= end;
    };

    if ((month === 12 && date === 31) || (month === 1 && (date === 1 || date === 2))) {
      currentHoliday.value = 'new-year';
      return;
    }
    if (month === 4 && (date === 4 || date === 5)) {
      currentHoliday.value = 'qingming';
      return;
    }
    if (month === 5 && date >= 1 && date <= 5) {
      currentHoliday.value = 'labor-day';
      return;
    }
    if (month === 10 && date >= 1 && date <= 7) {
      currentHoliday.value = 'national-day';
      return;
    }
    if ((month === 10 && date >= 29) || (month === 11 && date <= 2)) {
      currentHoliday.value = 'halloween';
      return;
    }
    if (month === 12 && date >= 20 && date <= 27) {
      currentHoliday.value = 'christmas';
      return;
    }

    const lunarMap = lunarHolidays[year];
    if (lunarMap) {
      if (isInRange(lunarMap.springFestival.start.month, lunarMap.springFestival.start.date, lunarMap.springFestival.end.month, lunarMap.springFestival.end.date)) {
        currentHoliday.value = 'spring-festival';
        return;
      }
      if (isInRange(lunarMap.lanternFestival.start.month, lunarMap.lanternFestival.start.date, lunarMap.lanternFestival.end.month, lunarMap.lanternFestival.end.date)) {
        currentHoliday.value = 'lantern-festival';
        return;
      }
      if (isInRange(lunarMap.dragonBoat.start.month, lunarMap.dragonBoat.start.date, lunarMap.dragonBoat.end.month, lunarMap.dragonBoat.end.date)) {
        currentHoliday.value = 'dragon-boat';
        return;
      }
      if (isInRange(lunarMap.qixi.start.month, lunarMap.qixi.start.date, lunarMap.qixi.end.month, lunarMap.qixi.end.date)) {
        currentHoliday.value = 'qixi';
        return;
      }
      if (isInRange(lunarMap.midAutumn.start.month, lunarMap.midAutumn.start.date, lunarMap.midAutumn.end.month, lunarMap.midAutumn.end.date)) {
        currentHoliday.value = 'mid-autumn';
        return;
      }
      if (isInRange(lunarMap.doubleNinth.start.month, lunarMap.doubleNinth.start.date, lunarMap.doubleNinth.end.month, lunarMap.doubleNinth.end.date)) {
        currentHoliday.value = 'double-ninth';
        return;
      }
    } else if (year > 2030 && import.meta.env.DEV) {
      console.warn(
        `[AISprite] The lunar holiday date map only covers 2026-2030. Please extend lunarHolidays.`
      );
    }

    currentHoliday.value = 'normal';
  };

  onMounted(() => {
    checkHoliday();
  });

  return {
    currentHoliday,
    checkHoliday
  };
}

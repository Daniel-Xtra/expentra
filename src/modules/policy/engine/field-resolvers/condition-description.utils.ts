import { ExpenseCategory } from 'src/database/entities/expense.enums';

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  [ExpenseCategory.TRAVEL]: 'Travel',
  [ExpenseCategory.MEALS]: 'Meals',
  [ExpenseCategory.SUPPLIES]: 'Supplies',
  [ExpenseCategory.OTHERS]: 'Others',
};

export function formatCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category as ExpenseCategory] ?? category;
}

export function formatWeekday(day: number): string {
  return WEEKDAY_NAMES[day] ?? String(day);
}

export function joinNaturalLanguage(
  items: string[],
  conjunction: 'and' | 'or',
): string {
  if (items.length === 0) {
    return '';
  }
  if (items.length === 1) {
    return items[0];
  }
  if (items.length === 2) {
    return `${items[0]} ${conjunction} ${items[1]}`;
  }

  return `${items.slice(0, -1).join(', ')}, ${conjunction} ${items[items.length - 1]}`;
}

export function capitalizeFirst(text: string): string {
  if (!text) {
    return text;
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

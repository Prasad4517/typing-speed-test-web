import { MESSAGES } from '@/constants/messages';
import { PRIMARY_NAVIGATION } from '@/constants/navigation';
import { TEST_DURATIONS } from '@/constants/test-config';

export const siteConfig = Object.freeze({
  name: MESSAGES.site.name,
  shortName: MESSAGES.site.shortName,
  description: MESSAGES.site.description,
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL,
  navItems: PRIMARY_NAVIGATION,
  testDurations: TEST_DURATIONS,
  defaultDuration: 30,
});

export const statCopy = {
  wpm: { label: 'Words per minute', shortLabel: 'WPM' },
  accuracy: { label: 'Accuracy', shortLabel: 'ACC' },
  consistency: { label: 'Consistency', shortLabel: 'CON' },
};

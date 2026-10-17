'use client';

import { useEffect, useState } from 'react';

import { Icon, IconButton } from '@/common-components';
import { DEFAULT_THEME, THEMES } from '@/constants/theme';
import { STORAGE_KEYS } from '@/constants/storage-keys';

export function ThemeToggle() {
  const [theme, setTheme] = useState(DEFAULT_THEME);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEYS.theme);
    if (stored && Object.values(THEMES).includes(stored)) setTheme(stored);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === THEMES.dark ? THEMES.light : THEMES.dark;
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(STORAGE_KEYS.theme, nextTheme);
  }

  return (
    <IconButton
      label={`Switch to ${theme === THEMES.dark ? 'light' : 'dark'} theme`}
      onClick={toggleTheme}
    >
      <Icon name={theme === THEMES.dark ? 'sun' : 'moon'} />
    </IconButton>
  );
}

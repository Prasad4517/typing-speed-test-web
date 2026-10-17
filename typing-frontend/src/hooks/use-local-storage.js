'use client';

import { useCallback, useEffect, useState } from 'react';

export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) setValue(JSON.parse(stored));
    } catch {
      setValue(initialValue);
    }
  }, [initialValue, key]);

  const updateValue = useCallback(
    (nextValue) => {
      setValue((currentValue) => {
        const resolved =
          typeof nextValue === 'function' ? nextValue(currentValue) : nextValue;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // Storage is optional; memory state still keeps the UI usable.
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, updateValue];
}

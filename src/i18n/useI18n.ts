import { useEffect, useState } from 'react';
import { getLocale, setLocale, subscribe, t, type Params } from './index';

export interface I18n {
  t: (key: string, defaultText: string, params?: Params) => string;
  locale: string;
  setLocale: (locale: string) => void;
}

/**
 * React hook that subscribes to locale changes and returns a `t` function
 * bound to the current locale. Components re-render when the locale changes.
 */
export function useI18n(): I18n {
  const [, setTick] = useState(0);

  useEffect(() => {
    return subscribe(() => setTick((n) => n + 1));
  }, []);

  return {
    t,
    locale: getLocale(),
    setLocale,
  };
}
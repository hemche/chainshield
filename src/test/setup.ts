/**
 * Vitest setup: mock next-intl for component tests.
 * Loads en.json and provides a passthrough useTranslations that returns English strings.
 */
import { vi } from 'vitest';
import messages from '../messages/en.json';

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    params[key] !== undefined ? String(params[key]) : `{${key}}`
  );
}

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const ns = getNestedValue(messages, namespace) as Record<string, unknown> | undefined;
    const t = (key: string, params?: Record<string, string | number>): string => {
      const val = ns ? getNestedValue(ns as Record<string, unknown>, key) : undefined;
      if (typeof val === 'string') return interpolate(val, params);
      // Fallback: return the full path
      return `${namespace}.${key}`;
    };
    return t;
  },
  useLocale: () => 'en',
}));

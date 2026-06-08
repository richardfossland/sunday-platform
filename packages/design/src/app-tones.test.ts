import { describe, it, expect } from 'vitest';
import {
  APP_TONES,
  BRANDED_APP_IDS,
  appToneBackground,
  APP_THREAD_COLOR,
} from './app-tones.js';
import { BRAND } from './tokens.js';

describe('APP_TONES', () => {
  it('covers the seven branded apps (five brand-sheet + two extensions)', () => {
    expect([...BRANDED_APP_IDS].sort()).toEqual(
      ['edit', 'paper', 'plan', 'rec', 'song', 'stage', 'studio'].sort(),
    );
  });

  it('matches the brand sheet jewel tones', () => {
    expect(APP_TONES.rec).toMatchObject({ toneName: 'Kobolt', from: '#2A4E92', to: '#172F5E' });
    expect(APP_TONES.edit).toMatchObject({ toneName: 'Plomme', from: '#7A3E86', to: '#451F54' });
    expect(APP_TONES.plan).toMatchObject({ toneName: 'Smaragd', from: '#1F7A55', to: '#114A34' });
    expect(APP_TONES.stage).toMatchObject({ toneName: 'Petrol', from: '#1E6E86', to: '#0F3E50' });
  });

  it('includes the suite-extension jewel tones for song and paper', () => {
    expect(APP_TONES.song).toMatchObject({ kind: 'jewel', toneName: 'Rubin', from: '#A8392E', to: '#4E1820' });
    expect(APP_TONES.paper).toMatchObject({ kind: 'jewel', toneName: 'Kobber', from: '#A56A33', to: '#4A2A12' });
  });

  it('treats SundayStudio as the light exception, not a jewel tone', () => {
    const studio = APP_TONES.studio;
    expect(studio.kind).toBe('light');
    if (studio.kind === 'light') {
      expect(studio.background).toBe('#FFFFFF');
      expect(studio.arc).toBe('#EAD7B4');
      expect(studio.symbol).toBe('#28304A');
    }
  });
});

describe('appToneBackground', () => {
  it('renders a diagonal gradient for jewel apps', () => {
    expect(appToneBackground('rec')).toBe('linear-gradient(135deg, #2A4E92, #172F5E)');
  });

  it('renders a flat background for the studio exception', () => {
    expect(appToneBackground('studio')).toBe('#FFFFFF');
  });

  it('produces a usable background for every branded app', () => {
    for (const id of BRANDED_APP_IDS) {
      expect(appToneBackground(id).length).toBeGreaterThan(0);
    }
  });
});

it('binds the family with the shared gold thread', () => {
  expect(APP_THREAD_COLOR).toBe(BRAND.gold.base);
});

import { describe, it, expect } from 'vitest';
import { BRAND, SUNDAY_BRAND_VERSION } from './tokens.js';

const HEX = /^#[0-9A-F]{6}$/;

describe('brand colours', () => {
  it('matches the brand sheet golden thread', () => {
    expect(BRAND.gold.base).toBe('#EBB84B');
    expect(BRAND.gold.light).toBe('#F2D58A');
    expect(BRAND.gold.deep).toBe('#D4A23A');
  });

  it('matches the brand sheet ink + paper foundation', () => {
    expect(BRAND.ink).toBe('#1A1D24');
    expect(BRAND.inkSoft).toBe('#2A2F3A');
    expect(BRAND.paper).toBe('#FAF7F0');
    expect(BRAND.paperWarm).toBe('#F5EFE3');
  });

  it('exposes colours as uppercase 6-digit hex', () => {
    for (const value of [BRAND.gold.base, BRAND.gold.light, BRAND.gold.deep, BRAND.ink, BRAND.inkSoft, BRAND.paper, BRAND.paperWarm]) {
      expect(value).toMatch(HEX);
    }
  });

  it('builds the gold gradient from light → base', () => {
    expect(BRAND.goldGradient).toBe('linear-gradient(135deg, #F2D58A, #EBB84B)');
  });
});

describe('brand typography', () => {
  it('uses Playfair for display styles and system for body', () => {
    expect(BRAND.fonts.display).toContain('Playfair Display');
    expect(BRAND.type.displayXl.family).toBe(BRAND.fonts.display);
    expect(BRAND.type.display.family).toBe(BRAND.fonts.display);
    expect(BRAND.type.body.family).toBe(BRAND.fonts.body);
  });

  it('keeps the documented scale (Display XL is the largest, heaviest)', () => {
    expect(BRAND.type.displayXl).toEqual({
      family: BRAND.fonts.display,
      size: 56,
      weight: 900,
      letterSpacing: -1.5,
    });
    const sizes = Object.values(BRAND.type).map((t) => t.size);
    expect(Math.max(...sizes)).toBe(BRAND.type.displayXl.size);
  });
});

describe('brand shape + elevation', () => {
  it('orders radii from swatch to icon', () => {
    expect(BRAND.radius.sm).toBeLessThan(BRAND.radius.md);
    expect(BRAND.radius.md).toBeLessThan(BRAND.radius.icon);
    expect(BRAND.radius.pill).toBe(100);
  });

  it('exposes the card/icon shadow system', () => {
    expect(BRAND.shadow.card).toContain('rgba(0,0,0,0.06)');
    expect(BRAND.shadow.icon).toContain('rgba(0,0,0,0.18)');
  });
});

it('ships a real (non-placeholder) brand version', () => {
  expect(SUNDAY_BRAND_VERSION).not.toBe('0.0.0');
});

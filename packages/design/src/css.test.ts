import { describe, it, expect } from 'vitest';
import { cssVariables, cssVariablesBlock } from './css.js';

describe('cssVariables', () => {
  it('mirrors the brand sheet :root names and values', () => {
    const vars = cssVariables();
    expect(vars['--gold']).toBe('#EBB84B');
    expect(vars['--gold-light']).toBe('#F2D58A');
    expect(vars['--gold-deep']).toBe('#D4A23A');
    expect(vars['--ink']).toBe('#1A1D24');
    expect(vars['--paper-warm']).toBe('#F5EFE3');
    expect(vars['--font-display']).toContain('Playfair Display');
  });

  it('emits two stops per jewel app and three vars for studio', () => {
    const vars = cssVariables();
    expect(vars['--rec-1']).toBe('#2A4E92');
    expect(vars['--rec-2']).toBe('#172F5E');
    expect(vars['--stage-1']).toBe('#1E6E86');
    expect(vars['--studio-bg']).toBe('#FFFFFF');
    expect(vars['--studio-arc']).toBe('#EAD7B4');
    expect(vars['--studio-symbol']).toBe('#28304A');
    // studio has no numeric jewel stops
    expect(vars['--studio-1']).toBeUndefined();
  });
});

describe('cssVariablesBlock', () => {
  it('wraps the variables in a :root block by default', () => {
    const block = cssVariablesBlock();
    expect(block.startsWith(':root {')).toBe(true);
    expect(block.trimEnd().endsWith('}')).toBe(true);
    expect(block).toContain('  --gold: #EBB84B;');
  });

  it('honours a custom selector', () => {
    expect(cssVariablesBlock('.sunday-theme')).toContain('.sunday-theme {');
  });
});

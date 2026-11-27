import { describe, expect, it } from 'vitest';
import { buildTownSelected } from './journey-event.ts';

describe('buildTownSelected', () => {
  it('builds the exact town_selected event with the picker source', () => {
    expect(buildTownSelected('addison')).toEqual({
      event: 'town_selected',
      properties: { town: 'addison', source: 'picker' },
    });
  });
});

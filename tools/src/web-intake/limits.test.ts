import { describe, expect, it } from 'vitest';

import { DEFAULT_REPOSITORY, repositoryFrom } from './limits.ts';

describe('repositoryFrom', () => {
  it('falls back to the default repository when the env var is absent or empty', () => {
    expect(repositoryFrom({})).toBe(DEFAULT_REPOSITORY);
    expect(repositoryFrom({ GITHUB_REPOSITORY: '' })).toBe(DEFAULT_REPOSITORY);
    expect(DEFAULT_REPOSITORY).toBe('jamesjnadeau/vt-education-budget-review');
  });
  it('prefers an explicit env var', () => {
    expect(repositoryFrom({ GITHUB_REPOSITORY: 'o/r' })).toBe('o/r');
  });
});

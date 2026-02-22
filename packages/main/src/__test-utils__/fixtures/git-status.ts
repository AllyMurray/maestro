/** Git status --porcelain=v1 output fixtures */

export const CLEAN = '';

export const MODIFIED_STAGED = 'M  src/index.ts';

export const MODIFIED_UNSTAGED = ' M src/index.ts';

export const ADDED_STAGED = 'A  src/new-file.ts';

export const DELETED_STAGED = 'D  src/removed.ts';

export const DELETED_UNSTAGED = ' D src/removed.ts';

export const RENAMED_STAGED = 'R  old-name.ts -> new-name.ts';

export const UNTRACKED = '?? src/untracked.ts';

export const CONFLICT_BOTH_MODIFIED = 'UU src/conflicted.ts';

export const CONFLICT_BOTH_ADDED = 'AA src/conflicted.ts';

export const CONFLICT_BOTH_DELETED = 'DD src/conflicted.ts';

export const MIXED_STATUS = [
  'M  src/modified-staged.ts',
  ' M src/modified-unstaged.ts',
  'A  src/added.ts',
  'D  src/deleted.ts',
  '?? src/untracked.ts',
].join('\n');

export const WITH_CONFLICTS = [
  'M  src/clean.ts',
  'UU src/conflicted.ts',
  '?? src/untracked.ts',
].join('\n');

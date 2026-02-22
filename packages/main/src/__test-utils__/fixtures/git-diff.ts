/** Git diff --numstat output fixtures */

export const SINGLE_FILE = '10\t5\tsrc/index.ts';

export const MULTIPLE_FILES = [
  '10\t5\tsrc/index.ts',
  '3\t0\tsrc/new.ts',
  '0\t8\tsrc/removed.ts',
].join('\n');

export const BINARY_FILE = '-\t-\timage.png';

export const EMPTY = '';

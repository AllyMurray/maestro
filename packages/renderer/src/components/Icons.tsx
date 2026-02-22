import React from 'react';

interface IconProps {
  size?: number;
  stroke?: number;
  color?: string;
  style?: React.CSSProperties;
}

function createIcon(path: string, viewBox = '0 0 24 24') {
  return function Icon({ size = 24, stroke = 2, color = 'currentColor', style }: IconProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox={viewBox}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={style}
      >
        <path d={path} />
      </svg>
    );
  };
}

// Simple inline SVG icons to avoid tabler dependency
export const IconPlus = createIcon('M12 5v14M5 12h14');
export const IconSettings = createIcon(
  'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
);
export const IconLayoutSidebar = createIcon(
  'M3 3h18v18H3zM9 3v18',
);
export const IconFolder = createIcon(
  'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z',
);
export const IconGitBranch = createIcon(
  'M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9',
);
export const IconTerminal = createIcon('M4 17l6-5-6-5M12 19h8');
export const IconMessage = createIcon(
  'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
);
export const IconRocket = createIcon(
  'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3M22 2l-7.5 7.5',
);
export const IconChevronRight = createIcon('M9 18l6-6-6-6');
export const IconX = createIcon('M18 6L6 18M6 6l12 12');
export const IconCheck = createIcon('M20 6L9 17l-5-5');
export const IconTrash = createIcon(
  'M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2',
);
export const IconSearch = createIcon('M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM21 21l-4.35-4.35');
export const IconGitPullRequest = createIcon(
  'M18 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 9v12M18 15V6a3 3 0 0 0-3-3H13',
);
export const IconArchive = createIcon(
  'M21 8v13H3V8M1 3h22v5H1zM10 12h4',
);

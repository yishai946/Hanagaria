import type { ReactNode } from 'react';

const I = {
  back: <path d="M9 18l6-6-6-6" />, next: <path d="M15 18l-6-6 6-6" />, prev: <path d="M9 18l6-6-6-6" />,
  play: <path d="M7 4l13 8-13 8z" fill="currentColor" stroke="none" />, pause: <path d="M7 4h4v16H7zM14 4h4v16h-4z" fill="currentColor" stroke="none" />,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></>,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />, x: <path d="M6 6l12 12M18 6L6 18" />,
  replay: <path d="M4 12a8 8 0 1 0 3-6.3M4 4v5h5" />, rotate: <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" />,
  ghost: <path d="M5 21V10a7 7 0 0 1 14 0v11l-3-2-2 2-2-2-2 2-2-2z" />, spark: <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />,
  plus: <path d="M12 5v14M5 12h14" />, pin: <><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></>,
  logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  locate: <><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="8" /><path d="M12 1v3M12 20v3M1 12h3M20 12h3" /></>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
} satisfies Record<string, ReactNode>;

export const Icon = ({ n, s = 18 }: { n: keyof typeof I; s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[n]}</svg>
);

import type { ReactNode } from "react";

type P = { size?: number };

const base = (size: number, children: ReactNode) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const Mic = ({ size = 24 }: P) =>
  base(size, <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>);
export const Home = ({ size = 24 }: P) => base(size, <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />);
export const Clock = ({ size = 24 }: P) => base(size, <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const Pin = ({ size = 24 }: P) => base(size, <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>);
export const Keyboard = ({ size = 24 }: P) =>
  base(size, <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" /></>);
export const Back = ({ size = 24 }: P) => base(size, <path d="M15 5l-7 7 7 7" />);
export const Close = ({ size = 24 }: P) => base(size, <path d="M6 6l12 12M18 6L6 18" />);
export const Check = ({ size = 24 }: P) => base(size, <path d="M5 12.5l4.5 4.5L19 7.5" />);
export const Speaker = ({ size = 24 }: P) =>
  base(size, <><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" /><path d="M15.5 9a4 4 0 0 1 0 6" /></>);
export const Phone = ({ size = 24 }: P) =>
  base(size, <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />);
export const Shield = ({ size = 24 }: P) =>
  base(size, <><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></>);
export const Play = ({ size = 24 }: P) => base(size, <path d="M8 5.5v13l11-6.5z" fill="currentColor" />);
export const Stop = ({ size = 24 }: P) => base(size, <rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor" />);
export const Pause =({ size = 24 }: P) => base(size, <path d="M8 5v14M16 5v14" strokeWidth={3} />);

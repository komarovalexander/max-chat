import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const SendIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M5 12h13M13 6l6 6-6 6" />
  </svg>
);

export const PlusIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const BackIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export const LogoutIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />
  </svg>
);

export const EyeIcon = (p: IconProps & { off?: boolean }) => {
  const { off, ...rest } = p;
  return (
    <svg {...base} {...rest}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
};

export const TrashIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </svg>
);

export const ChatBubbleIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z" />
  </svg>
);

/** Галочки статуса доставки. */
export const TicksIcon = ({ double, ...p }: IconProps & { double?: boolean }) => (
  <svg width={double ? 18 : 14} height={12} viewBox={double ? '0 0 18 12' : '0 0 14 12'} fill="none" aria-hidden {...p}>
    <path d="M1.5 6.5l3.5 3.5 7-8" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    {double && (
      <path d="M8.5 9l1 1 7-8" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    )}
  </svg>
);

export const ClockIcon = (p: IconProps) => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" strokeLinecap="round" />
  </svg>
);

export const AlertIcon = (p: IconProps) => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v6M12 16.5v.5" strokeLinecap="round" />
  </svg>
);

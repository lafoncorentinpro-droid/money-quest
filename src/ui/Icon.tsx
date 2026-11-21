/**
 * Icônes au trait fin et arrondi, dans l'esprit des SF Symbols d'Apple
 * (dessinées pour MONEY QUEST : les SF Symbols eux-mêmes sont réservés aux apps natives Apple).
 */

const PATHS = {
  plus: <path d="M12 5v14M5 12h14" />,
  'chevron-left': <path d="M15 5l-7 7 7 7" />,
  'chevron-right': <path d="M9 5l7 7-7 7" />,
  xmark: <path d="M6 6l12 12M18 6L6 18" />,
  card: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
      <path d="M2.5 9.5h19M6 15h4" />
    </>
  ),
  'arrow-down-circle': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v8.5M8.5 12.5 12 16l3.5-3.5" />
    </>
  ),
  chest: (
    <>
      <path d="M3.5 10.5h17v8a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z" />
      <path d="M3.5 10.5V9a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4v1.5" />
      <rect x="10.2" y="9" width="3.6" height="4.6" rx="1" />
    </>
  ),
  repeat: (
    <>
      <path d="M4 11V9.5A3.5 3.5 0 0 1 7.5 6H19l-3-3M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H5l3 3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.6v.1" />
    </>
  )
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, strokeWidth = 1.9, className }: { name: IconName; size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
      style={{ flexShrink: 0 }}
    >
      {PATHS[name]}
    </svg>
  );
}

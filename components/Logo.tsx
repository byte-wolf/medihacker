/** DOKuTOR wordmark (design/logo/final), themed via Carbon tokens. The lower-case u is a stethoscope. */
export function Wordmark({ height = 32, className }: { height?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="16 32 596 150"
      height={height}
      width={(height * 596) / 150}
      role="img"
      aria-label="DOKuTOR"
      className={className}
    >
      <g stroke="var(--cds-text-primary, #161616)" strokeWidth="16" fill="none" strokeLinejoin="miter">
        <path d="M28 48 V112 H50 A32 32 0 0 0 50 48 Z" />
        <ellipse cx="144" cy="80" rx="30" ry="32" />
        <path d="M208 40 V120 M252 48 L214 82 L254 120" strokeLinecap="butt" />
        <path d="M366 48 H426 M396 48 V120" />
        <ellipse cx="482" cy="80" rx="30" ry="32" />
        <path d="M546 120 V48 H570 A16 16 0 0 1 570 80 H546 M564 80 L592 120" />
      </g>
      <g stroke="var(--cds-link-primary, #0f62fe)" fill="none" strokeLinecap="round">
        <path d="M280 62 V86 A26 26 0 0 0 332 86 V62" strokeWidth="16" />
        <path d="M306 114 C304 130 286 132 288 148 S310 174 330 160 S354 144 369 159" strokeWidth="8" />
        <circle cx="376" cy="166" r="11" strokeWidth="8" />
      </g>
      <circle cx="280" cy="54" r="9" fill="var(--cds-link-primary, #0f62fe)" />
      <circle cx="332" cy="54" r="9" fill="var(--cds-link-primary, #0f62fe)" />
    </svg>
  );
}

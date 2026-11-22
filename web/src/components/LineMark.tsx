/**
 * LUMA's signature mark: two faint, tilted lines from a photographed page
 * resolving into one straight, bold line of text. Decorative.
 */
export function LineMark({ className = "h-8 w-11" }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 40" className={className} aria-hidden="true" focusable="false">
      <path d="M3 9 L30 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
      <path d="M4 17 L31 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
      <path d="M8 31 H52" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

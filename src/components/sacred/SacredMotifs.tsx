// Kural Graph's brand mark. Inherits currentColor.

/** A lotus seen from above, the map's other shape and a flower the Kural itself uses. Static: motion in the chrome is reserved for state changes. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center text-accent" style={{ width: size, height: size }} aria-hidden>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="15" stroke="var(--accent-line)" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <path key={angle} d="M16 16c-2.6-2.8-2.6-7 0-10 2.6 3 2.6 7.2 0 10Z" fill="currentColor" fillOpacity="0.72" transform={`rotate(${angle} 16 16)`} />
        ))}
        <circle cx="16" cy="16" r="2" fill="var(--accent-ink)" stroke="currentColor" />
      </svg>
    </span>
  );
}

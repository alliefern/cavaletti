export function HorseImage({ src, alt, size = "md" }: { src?: string | null; alt: string; size?: "sm" | "md" | "lg" }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={`horse-img horse-img-${size}`} loading="lazy" />;
  }
  return (
    <div className={`horse-img horse-img-${size} horse-img-empty`} aria-label={`${alt} (no photo yet)`}>
      <svg viewBox="0 0 64 64" width="40%" height="40%" aria-hidden="true">
        <path
          d="M32 6c-12 0-20 9-20 22 0 9 3 18 6 26h8l-2-20c0-4 3-7 8-7s8 3 8 7l-2 20h8c3-8 6-17 6-26C52 15 44 6 32 6z"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle cx="20" cy="22" r="2" fill="currentColor" />
        <circle cx="44" cy="22" r="2" fill="currentColor" />
        <circle cx="16" cy="36" r="2" fill="currentColor" />
        <circle cx="48" cy="36" r="2" fill="currentColor" />
      </svg>
    </div>
  );
}

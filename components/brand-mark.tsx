/** Exact Fit: the approved B concept. Keep these paths in sync with public/brand. */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      aria-hidden="true"
      focusable="false"
      data-brand="exact-fit"
    >
      <path fill="currentColor" d="M32 48H112V80A48 48 0 0 1 112 176V208H32Z" />
      <path
        fill="currentColor"
        d="M224 48H144V64A64 64 0 0 1 144 192V208H224Z"
      />
    </svg>
  );
}

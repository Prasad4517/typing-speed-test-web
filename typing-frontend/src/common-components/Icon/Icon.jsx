/** @param {{ name: 'arrow-right'|'check'|'close'|'sun'|'moon', size?: number, title?: string }} props */
export function Icon({ name, size = 18, title }) {
  const paths = {
    'arrow-right': (
      <>
        <path d="M3 9h12" />
        <path d="m10 4 5 5-5 5" />
      </>
    ),
    check: <path d="m4 9 3 3 7-7" />,
    close: (
      <>
        <path d="m5 5 8 8" />
        <path d="m13 5-8 8" />
      </>
    ),
    sun: (
      <>
        <circle cx="9" cy="9" r="3" />
        <path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.3 3.3l1.4 1.4M13.3 13.3l1.4 1.4M13.3 4.7l1.4-1.4M3.3 14.7l1.4-1.4" />
      </>
    ),
    moon: <path d="M14.5 11.5A6 6 0 0 1 6.5 3.5 6 6 0 1 0 14.5 11.5Z" />,
  };
  return (
    <svg
      aria-hidden={title ? undefined : true}
      aria-label={title}
      fill="none"
      height={size}
      role={title ? 'img' : undefined}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 18 18"
      width={size}
    >
      {paths[name]}
    </svg>
  );
}

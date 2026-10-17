/** @param {{ name: 'arrow-right'|'check'|'close'|'sun'|'moon'|'user'|'sign-out', size?: number, title?: string }} props */
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
    user: (
      <>
        <circle cx="9" cy="6.25" r="2.75" />
        <path d="M3.5 16c.55-2.8 2.45-4.25 5.5-4.25S13.95 13.2 14.5 16" />
      </>
    ),
    'sign-out': (
      <>
        <path d="M7.5 3H4.75A1.75 1.75 0 0 0 3 4.75v8.5C3 14.22 3.78 15 4.75 15H7.5" />
        <path d="M10 6.25 12.75 9 10 11.75M12.5 9H6" />
      </>
    ),
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

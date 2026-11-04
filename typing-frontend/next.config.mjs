const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

function backendInternalUrl() {
  const configured = process.env.BACKEND_INTERNAL_URL?.trim();
  if (!configured && isProduction) {
    throw new Error('Production requires BACKEND_INTERNAL_URL.');
  }

  const candidate = configured || 'http://127.0.0.1:5000';
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('BACKEND_INTERNAL_URL must be a valid absolute URL.');
  }

  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      'BACKEND_INTERNAL_URL must be an http(s) origin without credentials, path, query, or fragment.',
    );
  }

  return parsed.origin;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          ...(isProduction
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=31536000',
                },
              ]
            : []),
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "object-src 'none'",
              `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              `connect-src 'self'${isDevelopment ? ' ws: wss:' : ''}`,
            ].join('; '),
          },
        ],
      },
    ];
  },
  async rewrites() {
    const backendUrl = backendInternalUrl();

    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

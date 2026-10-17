import './globals.scss';

import { AppShell } from '@/layouts/app-shell';
import { siteConfig } from '@/config/site';

export const metadata = {
  title: {
    default: `${siteConfig.name} — Typing practice, refined`,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(()=>{try{const t=localStorage.getItem('keystroke.theme.v1');if(t&&t!=='system')document.documentElement.dataset.theme=t}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

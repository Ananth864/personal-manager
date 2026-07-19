import { createRootRouteWithContext, HeadContent, Scripts } from '@tanstack/react-router'
import { ClerkProvider } from '@clerk/tanstack-react-start'

import { RegisterSw } from '../components/register-sw'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'
import type { TRPCRouter } from '../integrations/trpc/router'
import type { TRPCOptionsProxy } from '@trpc/tanstack-react-query'

interface MyRouterContext {
  queryClient: QueryClient
  trpc: TRPCOptionsProxy<TRPCRouter>
}

// Applies the stored theme before paint to avoid a flash of the wrong scheme.
const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('theme');var m=(s==='light'||s==='dark'||s==='auto')?s:'auto';var d=m==='auto'?window.matchMedia('(prefers-color-scheme: dark)').matches:(m==='dark');document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      { title: 'Personal Manager' },
      {
        name: 'description',
        content: 'Plan meals, track your kitchen, and cook with intent.',
      },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-title', content: 'Personal Manager' },
      {
        name: 'theme-color',
        content: '#ffffff',
        media: '(prefers-color-scheme: light)',
      },
      {
        name: 'theme-color',
        content: '#0a0a0a',
        media: '(prefers-color-scheme: dark)',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'manifest', href: '/manifest.json' },
      { rel: 'apple-touch-icon', href: '/logo192.png' },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '192x192',
        href: '/logo192.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '512x512',
        href: '/logo512.png',
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="font-sans antialiased bg-background text-foreground min-h-dvh">
        <ClerkProvider>
          {children}
          <RegisterSw />
        </ClerkProvider>
        <Scripts />
      </body>
    </html>
  )
}

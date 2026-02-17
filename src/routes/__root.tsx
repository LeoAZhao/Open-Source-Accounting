import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from 'next-themes'
import { authMiddleware } from '@/server/functions/auth'
import { getBaseUrl } from '@/server/functions/request'
import {
  createOGMetaTags,
  generateOGImageUrl,
  OGImageConfig,
  OGMetaTags,
} from '@/lib/og-config'

interface MyRouterContext {
  queryClient: QueryClient
}

const scripts: React.DetailedHTMLProps<
  React.ScriptHTMLAttributes<HTMLScriptElement>,
  HTMLScriptElement
>[] = []

if (import.meta.env.VITE_INSTRUMENTATION_SCRIPT_SRC) {
  scripts.push({
    src: import.meta.env.VITE_INSTRUMENTATION_SCRIPT_SRC,
    type: 'module',
  })
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  loader: async () => {
    const { currentUser } = await authMiddleware()
    const baseUrl = await getBaseUrl()

    return {
      currentUser,
      baseUrl,
    }
  },
  head: ({ loaderData }) => {
    const baseUrl =
      typeof window !== 'undefined'
        ? window.location.origin
        : (loaderData?.baseUrl ?? 'https://imagine.dev')

    const config: OGImageConfig = {
      isCustom: false,
    }

    const ogImageUrl = generateOGImageUrl(config, baseUrl)

    const metadata: OGMetaTags = {
      title: 'LocalHost Accounting System',
      description:
        'A self-hosted double-entry accounting system with chart of accounts, transaction management, financial reports, and audit trails for local deployment.',
      image: ogImageUrl,
      url: typeof window !== 'undefined' ? window.location.href : baseUrl,
    }

    const ogTags = createOGMetaTags(metadata)

    return {
      meta: [
        {
          charSet: 'utf-8',
        },
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1',
        },
        {
          title: 'LocalHost Accounting System',
        },
        {
          name: 'description',
          content:
            'A self-hosted double-entry accounting system with chart of accounts, transaction management, financial reports, and audit trails for local deployment.',
        },
        ...ogTags.meta,
      ],
      links: [
        {
          rel: 'stylesheet',
          href: appCss,
        },
        {
          rel: 'preconnect',
          href: 'https://fonts.googleapis.com',
        },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossOrigin: 'anonymous',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap',
        },
      ],
      scripts: [...scripts],
    }
  },

  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}

<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog into the Zapper landing page (Next.js 15 App Router). The following changes were made:

- **`instrumentation-client.ts`** (new): Initializes PostHog on the client side using the Next.js 15.3+ instrumentation API. Configured with a reverse proxy via `/ingest`, automatic exception capture, and debug mode in development.
- **`next.config.ts`** (updated): Added rewrites to proxy PostHog requests through `/ingest/*` to `us.i.posthog.com` and `/ingest/static/*` and `/ingest/array/*` to `us-assets.i.posthog.com`. Added `skipTrailingSlashRedirect: true`.
- **`lib/posthog-server.ts`** (new): Singleton server-side PostHog client using `posthog-node`, used in API routes to capture server-side events.
- **`components/landing/InstallSnippet.tsx`** (updated): Added `install_command_copied` event capture when users successfully copy the install command, including the command text as a property.
- **`components/landing/DownloadMacButton.tsx`** (new): Client component wrapping the Download for Mac button, capturing `mac_download_cta_clicked` on click.
- **`components/landing/DocsCTAButton.tsx`** (new): Client component wrapping docs/agent-docs CTA buttons, capturing `docs_cta_clicked` with `label` and `href` properties.
- **`app/page.tsx`** (updated): Replaced inline `<Button>` elements for docs CTAs and the Mac download button with the new tracked client components.
- **`app/download/mac/route.ts`** (updated): Added server-side `mac_download_initiated` event capture via `posthog-node` whenever the macOS download redirect endpoint is hit.
- **`.env.local`** (created): Added `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` environment variables.

## Events

| Event | Description | File |
|---|---|---|
| `install_command_copied` | User copied the install command snippet from the hero or CTA section | `components/landing/InstallSnippet.tsx` |
| `mac_download_cta_clicked` | User clicked the Download for Mac button on the landing page | `components/landing/DownloadMacButton.tsx` |
| `docs_cta_clicked` | User clicked a Read the docs or Read the agent docs CTA button | `components/landing/DocsCTAButton.tsx` |
| `mac_download_initiated` | Server-side: user was redirected to the macOS download URL via the /download/mac route | `app/download/mac/route.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](/dashboard/1608702)
- [Install command copies over time](/insights/LrTX8m3z)
- [Mac downloads over time](/insights/cdtTTA19)
- [Docs CTA clicks over time](/insights/58GIKkRt)
- [Install-to-Download conversion funnel](/insights/XbWDUdGh)
- [All key events (30d totals)](/insights/TjUqqe9L)

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>

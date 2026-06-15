// WEB-ONLY shim for the AI config.
//
// Metro automatically resolves `*.web.ts` ahead of the plain `.ts` file when
// bundling for web. Because the public web preview ships its JavaScript to any
// visitor's browser, we must NOT bundle the real Anthropic API key here — it
// would be trivially extractable from the public bundle.
//
// Instead, the web app sends its Claude requests to the same-origin serverless
// proxy at `/api/claude` (see `api/claude.ts`), which injects the secret key
// server-side from the ANTHROPIC_API_KEY env var. So the key is intentionally
// left blank here — the proxy supplies it, never the browser.
//
// The native app (iOS / Android) continues to use the real key from `./ai.ts`,
// which is unchanged.
export const ANTHROPIC_API_KEY = '';
export const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
export const CLAUDE_URL = '/api/claude';

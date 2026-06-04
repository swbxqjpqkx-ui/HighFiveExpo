// WEB-ONLY shim for the AI config.
//
// Metro automatically resolves `*.web.ts` ahead of the plain `.ts` file when
// bundling for web. Because the public web preview ships its JavaScript to any
// visitor's browser, we must NOT bundle the real Anthropic API key here — it
// would be trivially extractable from the public bundle.
//
// The native app (iOS / Android) continues to use the real key from `./ai.ts`,
// which is unchanged. On web, these empty values are never actually used: each
// AI service short-circuits with a "not available in the web preview" message
// before any network call (see the `Platform.OS === 'web'` guards).
export const ANTHROPIC_API_KEY = '';
export const CLAUDE_MODEL = '';
export const CLAUDE_URL = '';

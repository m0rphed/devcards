import { Carta } from 'carta-md';
import { code } from '@cartamd/plugin-code';
import DOMPurify from 'isomorphic-dompurify';

// Carta does NOT sanitize by default — with public/shared collections this
// is a real stored-XSS surface (one user's card content, another user's
// browser), so the sanitizer isn't optional. One shared instance so the
// editor's live preview and the server-side pre-render both go through the
// exact same rules.
//
// `code()` (fenced code block syntax highlighting via Shiki) only runs
// through Carta's *async* pipeline — `carta.render()`, not the sync
// `renderSSR()` — so render-card.ts uses `render()` throughout.
export const carta = new Carta({
	sanitizer: DOMPurify.sanitize,
	extensions: [code()]
});

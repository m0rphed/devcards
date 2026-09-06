import { Carta } from 'carta-md';
import DOMPurify from 'isomorphic-dompurify';

// Carta does NOT sanitize by default — with public/shared collections this
// is a real stored-XSS surface (one user's card content, another user's
// browser), so the sanitizer isn't optional. One shared instance so the
// editor's live preview and the server-side pre-render below go through the
// exact same rules.
export const carta = new Carta({ sanitizer: DOMPurify.sanitize });

/** Markdown -> sanitized HTML, for read-only display (study/quiz/card list). */
export function renderMarkdown(markdown: string): string {
	return carta.renderSSR(markdown);
}

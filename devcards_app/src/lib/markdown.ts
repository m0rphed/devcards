import { Carta } from 'carta-md';
import { code } from '@cartamd/plugin-code';
import DOMPurify from 'isomorphic-dompurify';

// Carta does NOT sanitize by default — with public/shared collections this
// is a real stored-XSS surface (one user's card content, another user's
// browser), so the sanitizer isn't optional. Same options reused by both
// factories below, so editor preview and server-side pre-render always go
// through identical rules.
function cartaOptions() {
	return { sanitizer: DOMPurify.sanitize, extensions: [code()] };
}

// Shared instance for server-side rendering (renderCard -> carta.render()).
// Safe to share: render()/renderSSR() don't touch any per-widget state.
//
// `code()` (fenced code block syntax highlighting via Shiki) only runs
// through Carta's *async* pipeline — `carta.render()`, not the sync
// `renderSSR()` — so render-card.ts uses `render()` throughout.
export const carta = new Carta(cartaOptions());

/**
 * A **fresh** Carta instance for a `<MarkdownEditor>` widget — never share
 * one instance between two simultaneously-mounted editors. Carta stores the
 * "currently registered" editor/input/renderer element as instance state
 * (set via internal $setElement/$setInput/$setRenderer calls each editor
 * makes on mount); two editors sharing one instance means the second one
 * silently steals the first's toolbar/caret targeting — clicking **Bold**
 * in editor A ends up mutating editor B's textarea.
 */
export function createEditorCarta(): Carta {
	return new Carta(cartaOptions());
}

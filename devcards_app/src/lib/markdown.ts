import { Carta } from 'carta-md';
import { code } from '@cartamd/plugin-code';
import { math } from '@cartamd/plugin-math';
import { attachment } from '@cartamd/plugin-attachment';
import DOMPurify from 'isomorphic-dompurify';

// Carta does NOT sanitize by default — with public/shared collections this
// is a real stored-XSS surface (one user's card content, another user's
// browser), so the sanitizer isn't optional. `code()` and `math()` both run
// real remark/rehype transformers (not just editor-side UI), so both the
// editor's live preview *and* the server-side pre-render (render-card.ts)
// need the same two extensions, or a card would look different while
// editing than it does in study/quiz.
const sanitizer = DOMPurify.sanitize;
function sharedExtensions() {
	return [code(), math()];
}

// Shared instance for server-side rendering (renderCard -> carta.render()).
// Safe to share: render()/renderSSR() don't touch any per-widget state.
//
// `code()` (fenced code block syntax highlighting via Shiki) only runs
// through Carta's *async* pipeline — `carta.render()`, not the sync
// `renderSSR()` — so render-card.ts uses `render()` throughout.
export const carta = new Carta({ sanitizer, extensions: sharedExtensions() });

/** Uploads a file to be embedded in card markdown — see the attachment()
 * plugin config below. Matches its required `(file: File) => Promise<string
 * | null>` contract: null on any failure, no throwing, since the plugin's
 * only reaction to null is to just drop the "Uploading..." placeholder it
 * had inserted.
 */
async function uploadAttachment(file: File): Promise<string | null> {
	const body = new FormData();
	body.set('file', file);
	const res = await fetch('/api/attachments', { method: 'POST', body });
	if (!res.ok) return null;
	const { url } = (await res.json()) as { url: string };
	return url;
}

/**
 * A **fresh** Carta instance for a `<MarkdownEditor>` widget — never share
 * one instance between two simultaneously-mounted editors. Carta stores the
 * "currently registered" editor/input/renderer element as instance state
 * (set via internal $setElement/$setInput/$setRenderer calls each editor
 * makes on mount); two editors sharing one instance means the second one
 * silently steals the first's toolbar/caret targeting — clicking **Bold**
 * in editor A ends up mutating editor B's textarea.
 *
 * `attachment()` only makes sense here, not in the shared server-side
 * `carta` above: it drives editor-only UX (drag/drop, paste, its own
 * toolbar button) and just inserts plain `![alt](url)` markdown once a
 * file's uploaded — ordinary image syntax that carta's core renderer
 * already handles with no extra registration needed to *render* it back.
 */
export function createEditorCarta(): Carta {
	return new Carta({
		sanitizer,
		extensions: [...sharedExtensions(), attachment({ upload: uploadAttachment })]
	});
}

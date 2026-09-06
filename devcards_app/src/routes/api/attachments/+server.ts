import { json } from '@sveltejs/kit';
import { saveAttachment } from '$lib/server/attachments';
import type { RequestHandler } from './$types';

// Called directly from carta-md's attachment plugin (see
// createEditorCarta's `upload` callback in $lib/markdown.ts) — not a form
// action, since the plugin drives it from drag-and-drop/paste/its own
// toolbar button, all before the surrounding card form is ever submitted.
//
// Deliberately NOT using requireUser() here: it redirects to /login, which
// `fetch` would transparently follow into an HTML page — this is an API
// endpoint called from client JS, so an unauthenticated caller needs a
// plain JSON 401 the `upload()` callback can turn into a null return.
export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return json({ error: 'unauthenticated' }, { status: 401 });

	const form = await event.request.formData();
	const file = form.get('file');
	if (!(file instanceof File)) return json({ error: 'missing file' }, { status: 400 });

	const result = await saveAttachment(user.id, file);
	if ('error' in result) return json({ error: result.error }, { status: 422 });

	return json({ url: `/attachments/${result.id}` });
};

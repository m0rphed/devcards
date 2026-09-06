import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/require-user';
import { getAttachment } from '$lib/server/attachments';
import type { RequestHandler } from './$types';

// Gated on "is logged in", not "can this user actually see the card that
// references this image" — attachments aren't FK'd to a specific card (see
// domain.schema.ts), so tracing attachment -> every card that might embed
// its URL -> that card's collection -> this user's role on it isn't
// something a single cheap lookup can answer. Every other card-content view
// in this app already requires a session (see requireUser elsewhere), so
// this matches the app's existing baseline rather than loosening it to
// fully anonymous — a deliberate simplification, not an oversight.
export const GET: RequestHandler = async (event) => {
	requireUser(event);

	const attachment = await getAttachment(event.params.id);
	if (!attachment) error(404, 'Файл не найден');

	if (event.request.headers.get('if-none-match') === `"${attachment.sha256}"`) {
		return new Response(null, { status: 304 });
	}

	// Response/Blob's BodyInit typing wants a definite ArrayBuffer-backed
	// view; Node's Buffer is typed as Buffer<ArrayBufferLike>, which admits
	// SharedArrayBuffer too and doesn't structurally match — Uint8Array.from
	// makes a fresh, plainly-typed copy that does.
	return new Response(new Blob([Uint8Array.from(attachment.data)]), {
		headers: {
			'Content-Type': attachment.mimeType,
			'Cache-Control': 'private, max-age=31536000, immutable',
			ETag: `"${attachment.sha256}"`
		}
	});
};

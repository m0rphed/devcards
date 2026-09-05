import { redirect, type RequestEvent } from '@sveltejs/kit';

/** Redirects to /login if there's no session; otherwise narrows locals.user to non-null. */
export function requireUser(event: RequestEvent) {
	if (!event.locals.user) {
		redirect(302, '/login');
	}
	return event.locals.user;
}

import { fail } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';

		try {
			await auth.api.requestPasswordReset({ body: { email, redirectTo: '/reset-password' } });
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Не удалось отправить письмо' });
			}
			return fail(500, { message: 'Непредвиденная ошибка' });
		}

		// better-auth itself never reveals whether the email exists — same
		// "check your inbox" response either way, to avoid leaking accounts.
		return { sent: true };
	}
};

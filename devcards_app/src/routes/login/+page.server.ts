import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	if (event.locals.user) {
		redirect(302, '/collections');
	}
	return {};
};

export const actions: Actions = {
	signInEmail: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		try {
			await auth.api.signInEmail({ body: { email, password, callbackURL: '/collections' } });
		} catch (error) {
			if (error instanceof APIError) {
				if (error.body?.code === 'EMAIL_NOT_VERIFIED') {
					// sendOnSignIn already fired a fresh verification link server-side.
					return fail(400, { message: 'Почта ещё не подтверждена — отправили новую ссылку на неё.', pendingVerification: true });
				}
				return fail(400, { message: error.message || 'Не удалось войти' });
			}
			return fail(500, { message: 'Непредвиденная ошибка' });
		}

		redirect(302, '/collections');
	},

	signUpEmail: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const name = formData.get('name')?.toString() ?? '';

		if (!name.trim()) {
			return fail(400, { message: 'Укажи имя' });
		}

		try {
			await auth.api.signUpEmail({ body: { email, password, name, callbackURL: '/collections' } });
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Не удалось зарегистрироваться' });
			}
			return fail(500, { message: 'Непредвиденная ошибка' });
		}

		// No session yet — requireEmailVerification blocks sign-in until the
		// link in the email is clicked.
		return { pendingVerification: true, email };
	}
};

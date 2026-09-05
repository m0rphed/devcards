import { fail } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	return {
		token: event.url.searchParams.get('token'),
		error: event.url.searchParams.get('error')
	};
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const token = formData.get('token')?.toString();
		const newPassword = formData.get('password')?.toString() ?? '';
		if (!token) return fail(400, { message: 'Ссылка недействительна — запроси новую' });

		try {
			await auth.api.resetPassword({ body: { newPassword, token } });
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Не удалось сбросить пароль' });
			}
			return fail(500, { message: 'Непредвиденная ошибка' });
		}

		return { done: true };
	}
};

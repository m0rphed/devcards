import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/auth.schema';
import { requireUser } from '$lib/server/require-user';
import {
	computeRetentionRate,
	computeStudyStreak,
	getFsrsStateDistribution,
	getGradeDistribution,
	getReviewActivity,
	getStrugglingTags,
	getUpcomingReviewForecast
} from '$lib/server/stats';
import type { Actions, PageServerLoad } from './$types';

// A rolling ~3-month window — a GitHub-style heatmap reads fine at this
// span, and it's a lot less data to carry down to the client than a year.
const ACTIVITY_WINDOW_DAYS = 90;

export const load: PageServerLoad = async (event) => {
	const currentUser = requireUser(event);
	const activity = await getReviewActivity(currentUser.id, ACTIVITY_WINDOW_DAYS);

	return {
		user: currentUser,
		activity,
		streak: computeStudyStreak(activity),
		retentionRate: computeRetentionRate(activity),
		gradeDistribution: await getGradeDistribution(currentUser.id),
		fsrsStateDistribution: await getFsrsStateDistribution(currentUser.id),
		upcomingReviews: await getUpcomingReviewForecast(currentUser.id),
		strugglingTags: await getStrugglingTags(currentUser.id)
	};
};

export const actions: Actions = {
	// The client already uploaded the file via POST /api/attachments (the
	// same endpoint card images use) and just hands us the resulting URL —
	// this action only persists it onto the user row. Bypasses better-auth's
	// own API on purpose: `image` isn't a security-sensitive field (unlike
	// email/password), and the minimal better-auth bundle this app uses
	// doesn't pull in a dedicated user-update endpoint for it.
	setAvatar: async (event) => {
		const currentUser = requireUser(event);
		const url = (await event.request.formData()).get('url')?.toString();
		if (!url?.startsWith('/attachments/')) return fail(400, { message: 'Некорректная ссылка на файл' });

		await db.update(user).set({ image: url }).where(eq(user.id, currentUser.id));
	},

	// Unlike setAvatar, this genuinely goes through better-auth's own API
	// (auth.api.changePassword) — it's the one place a password's actual
	// hash lives, and it independently re-verifies currentPassword against
	// it before writing anything, so this action itself doesn't (and
	// shouldn't) re-implement that check. revokeOtherSessions is hardcoded
	// true — same posture as password-reset's revokeSessionsOnPasswordReset,
	// not exposed as a toggle, since there's no good reason for it to be off.
	changePassword: async (event) => {
		requireUser(event);
		const formData = await event.request.formData();
		const currentPassword = formData.get('currentPassword')?.toString() ?? '';
		const newPassword = formData.get('newPassword')?.toString() ?? '';
		// changePassword: true on every failure path — `form` is shared with
		// setAvatar (same page, both plain use:enhance forms), and both fail
		// with a bare `{message}`, so the template needs a way to tell whose
		// error it's looking at.
		if (!currentPassword || !newPassword) return fail(400, { changePassword: true, message: 'Заполни оба поля' });

		try {
			await auth.api.changePassword({
				headers: event.request.headers,
				body: { currentPassword, newPassword, revokeOtherSessions: true }
			});
		} catch (error) {
			if (error instanceof APIError) {
				const message =
					error.body?.code === 'INVALID_PASSWORD' ? 'Неверный текущий пароль' : error.message || 'Не удалось сменить пароль';
				return fail(400, { changePassword: true, message });
			}
			return fail(500, { changePassword: true, message: 'Непредвиденная ошибка' });
		}

		return { passwordChanged: true };
	}
};

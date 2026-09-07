import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/auth.schema';
import { requireUser } from '$lib/server/require-user';
import {
	computeRetentionRate,
	computeStudyStreak,
	getFsrsStateDistribution,
	getGradeDistribution,
	getReviewActivity
} from '$lib/server/stats';
import type { Actions, PageServerLoad } from './$types';

// A year of daily buckets — enough for a GitHub-style yearly heatmap without
// pulling in every review this user has ever made.
const ACTIVITY_WINDOW_DAYS = 365;

export const load: PageServerLoad = async (event) => {
	const currentUser = requireUser(event);
	const activity = await getReviewActivity(currentUser.id, ACTIVITY_WINDOW_DAYS);

	return {
		user: currentUser,
		activity,
		streak: computeStudyStreak(activity),
		retentionRate: computeRetentionRate(activity),
		gradeDistribution: await getGradeDistribution(currentUser.id),
		fsrsStateDistribution: await getFsrsStateDistribution(currentUser.id)
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
	}
};

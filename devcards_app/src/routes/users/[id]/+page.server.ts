import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/require-user';
import { getPublicCollectionsByOwner, getPublicProfile } from '$lib/server/profile';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireUser(event); // profiles are only visible to other logged-in users, same baseline as everything else here

	const profile = await getPublicProfile(event.params.id);
	if (!profile) error(404, 'Пользователь не найден');

	return { profile, collections: await getPublicCollectionsByOwner(profile.id) };
};

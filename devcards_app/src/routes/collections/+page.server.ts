import { fail } from '@sveltejs/kit';
import { and, desc, eq, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { collections, collectionAccess } from '$lib/server/db/domain.schema';
import { requireUser } from '$lib/server/require-user';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);

	const [mine, shared, publicOnes] = await Promise.all([
		db
			.select()
			.from(collections)
			.where(eq(collections.ownerId, user.id))
			.orderBy(desc(collections.createdAt)),
		db
			.select({ collection: collections, role: collectionAccess.role })
			.from(collectionAccess)
			.innerJoin(collections, eq(collectionAccess.collectionId, collections.id))
			.where(eq(collectionAccess.userId, user.id)),
		db
			.select()
			.from(collections)
			.where(and(eq(collections.isPublic, true), ne(collections.ownerId, user.id)))
			.orderBy(desc(collections.createdAt))
			.limit(50)
	]);

	return { mine, shared, publicOnes };
};

export const actions: Actions = {
	create: async (event) => {
		const user = requireUser(event);
		const formData = await event.request.formData();
		const title = formData.get('title')?.toString().trim();
		const description = formData.get('description')?.toString().trim() || null;
		const isPublic = formData.get('isPublic') === 'on';

		if (!title) {
			return fail(400, { message: 'Название обязательно' });
		}

		await db.insert(collections).values({ ownerId: user.id, title, description, isPublic });
	}
};

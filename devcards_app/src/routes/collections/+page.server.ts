import { error, fail } from '@sveltejs/kit';
import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { collections, collectionAccess } from '$lib/server/db/domain.schema';
import { requireUser } from '$lib/server/require-user';
import { getCollectionAccess } from '$lib/server/authz';
import {
	forkCollection,
	leaveCollection,
	parseCollectionColor,
	parseCollectionIcon,
	subscribeToPublicCollection
} from '$lib/server/collections';
import { getRatingSummaries } from '$lib/server/ratings';
import { searchPublicCollections } from '$lib/server/collection-search';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const searchQuery = event.url.searchParams.get('q')?.trim() || undefined;

	const [mine, shared, publicRows] = await Promise.all([
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
		searchPublicCollections(user.id, searchQuery)
	]);

	const publicIds = publicRows.map((r) => r.collection.id);
	const [ratings, mySubscriptions, myForks] = await Promise.all([
		getRatingSummaries(publicIds),
		publicIds.length > 0
			? db
					.select({ collectionId: collectionAccess.collectionId })
					.from(collectionAccess)
					.where(and(eq(collectionAccess.userId, user.id), inArray(collectionAccess.collectionId, publicIds)))
			: [],
		publicIds.length > 0
			? db
					.select({ forkedFromCollectionId: collections.forkedFromCollectionId })
					.from(collections)
					.where(and(eq(collections.ownerId, user.id), inArray(collections.forkedFromCollectionId, publicIds)))
			: []
	]);
	const subscribedIds = new Set(mySubscriptions.map((r) => r.collectionId));
	const forkedIds = new Set(myForks.map((r) => r.forkedFromCollectionId));

	const publicOnes = publicRows.map((r) => ({
		...r.collection,
		ownerName: r.ownerName,
		ownerImage: r.ownerImage,
		rating: ratings.get(r.collection.id) ?? null,
		subscribed: subscribedIds.has(r.collection.id),
		forked: forkedIds.has(r.collection.id)
	}));

	return { mine, shared, publicOnes, searchQuery: searchQuery ?? '' };
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

		await db.insert(collections).values({
			ownerId: user.id,
			title,
			description,
			isPublic,
			color: parseCollectionColor(formData),
			icon: parseCollectionIcon(formData)
		});
	},

	subscribe: async (event) => {
		const user = requireUser(event);
		const collectionId = (await event.request.formData()).get('collectionId')?.toString();
		if (!collectionId) return fail(400, { message: 'collectionId обязателен' });

		const { collection } = await getCollectionAccess(collectionId, user.id);
		if (!collection?.isPublic) error(404, 'Коллекция не найдена');

		await subscribeToPublicCollection(collectionId, user.id);
	},

	leave: async (event) => {
		const user = requireUser(event);
		const collectionId = (await event.request.formData()).get('collectionId')?.toString();
		if (!collectionId) return fail(400, { message: 'collectionId обязателен' });
		await leaveCollection(collectionId, user.id);
	},

	fork: async (event) => {
		const user = requireUser(event);
		const collectionId = (await event.request.formData()).get('collectionId')?.toString();
		if (!collectionId) return fail(400, { message: 'collectionId обязателен' });

		// Anyone who can currently view the source may fork it (owner/editor/
		// viewer/public) — same rule as commenting/rating, not limited to
		// "public only" (see phase02.social_features.md).
		const { role } = await getCollectionAccess(collectionId, user.id);
		if (role === null) error(404, 'Коллекция не найдена');

		await forkCollection(collectionId, user.id);
	}
};

import { error, fail, redirect } from '@sveltejs/kit';
import { and, desc, eq, ilike } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/auth.schema';
import {
	cardTags as cardTagsTable,
	cards,
	collectionAccess,
	collections,
	collectionRole,
	tags
} from '$lib/server/db/domain.schema';
import { canEdit, getCollectionAccess } from '$lib/server/authz';
import { listCollectionCards } from '$lib/server/card-search';
import { parseCardColor, parseCardContent } from '$lib/server/card-content';
import { requireUser } from '$lib/server/require-user';
import { getTagNamesByCard, parseTagNames, setCardTags } from '$lib/server/tags';
import { renderCard } from '$lib/server/render-card';
import { getCardDeletionImpacts, getCollectionDeletionImpact, getCollectionProgress } from '$lib/server/stats';
import { forkCollection, leaveCollection, subscribeToPublicCollection } from '$lib/server/collections';
import { addComment, deleteComment, getComment, listComments } from '$lib/server/comments';
import { getMyRating, getRatingSummary, rateCollection, removeRating } from '$lib/server/ratings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const currentUser = requireUser(event);
	const { collectionId } = event.params;

	const { collection, role } = await getCollectionAccess(collectionId, currentUser.id);
	if (!collection) error(404, 'Коллекция не найдена');

	const searchQuery = event.url.searchParams.get('q')?.trim() || undefined;
	const tagFilter = event.url.searchParams.get('tag')?.trim() || undefined;

	const collectionCards = await listCollectionCards(collectionId, { query: searchQuery, tag: tagFilter });
	const tagsByCard = await getTagNamesByCard(collectionCards.map((c) => c.id));

	// Distinct tags actually used in this collection, for the filter chips —
	// cheap enough to compute per-request at this scale, no caching needed.
	const collectionTags = await db
		.selectDistinct({ name: tags.name })
		.from(tags)
		.innerJoin(cardTagsTable, eq(cardTagsTable.tagId, tags.id))
		.innerJoin(cards, eq(cardTagsTable.cardId, cards.id))
		.where(eq(cards.collectionId, collectionId))
		.orderBy(tags.name);

	// Only the owner needs to see (and manage) the sharing list.
	const shares =
		role === 'owner'
			? await db
					.select({ userId: user.id, name: user.name, email: user.email, role: collectionAccess.role })
					.from(collectionAccess)
					.innerJoin(user, eq(collectionAccess.userId, user.id))
					.where(eq(collectionAccess.collectionId, collectionId))
			: [];

	// Explicit self/owner-granted access row, distinct from "can view because
	// it's public" — that's what the Subscribe/Unsubscribe button state
	// needs (role alone can't tell them apart: a public collection's viewer
	// role is the same either way).
	const isSubscribed =
		role !== 'owner' &&
		(await db
			.select({ userId: collectionAccess.userId })
			.from(collectionAccess)
			.where(and(eq(collectionAccess.collectionId, collectionId), eq(collectionAccess.userId, currentUser.id)))
			.limit(1)
			.then((rows) => rows.length > 0));

	let forkSource: { title: string; isStale: boolean } | null = null;
	if (collection.forkedFromCollectionId) {
		const [source] = await db
			.select({ title: collections.title, updatedAt: collections.updatedAt })
			.from(collections)
			.where(eq(collections.id, collection.forkedFromCollectionId))
			.limit(1);
		// Source itself was deleted since — forked_from_collection_id went
		// NULL via ON DELETE SET NULL, so `source` here being undefined only
		// happens in the instant between that and this read; treat it as "no
		// longer trackable" rather than stale.
		if (source) {
			forkSource = {
				title: source.title,
				isStale: collection.forkedFromUpdatedAt !== null && source.updatedAt > collection.forkedFromUpdatedAt
			};
		}
	}

	const cardStudierCounts = canEdit(role)
		? await getCardDeletionImpacts(
				collectionCards.map((c) => c.id),
				currentUser.id
			)
		: new Map<string, number>();

	return {
		collection,
		role,
		myUserId: currentUser.id,
		cards: await Promise.all(
			collectionCards.map(async (card) => ({
				...card,
				rendered: await renderCard(card.type, card.content),
				otherStudierCount: cardStudierCounts.get(card.id) ?? 0
			}))
		),
		tagsByCard: Object.fromEntries(tagsByCard),
		allTags: collectionTags.map((t) => t.name),
		searchQuery: searchQuery ?? '',
		tagFilter: tagFilter ?? '',
		shares,
		progress: await getCollectionProgress(collectionId, currentUser.id),
		deletionImpact:
			role === 'owner' ? await getCollectionDeletionImpact(collectionId, currentUser.id) : null,
		isSubscribed,
		forkSource,
		comments: await listComments(collectionId),
		ratingSummary: await getRatingSummary(collectionId),
		myRating: await getMyRating(collectionId, currentUser.id)
	};
};

export const actions: Actions = {
	createCard: async (event) => {
		const currentUser = requireUser(event);
		const { collectionId } = event.params;
		const { role } = await getCollectionAccess(collectionId, currentUser.id);
		if (!canEdit(role)) error(403, 'Нет прав на редактирование этой коллекции');

		const formData = await event.request.formData();
		const parsed = parseCardContent(formData);
		if (!parsed.ok) return fail(400, { message: parsed.message });

		const [newCard] = await db
			.insert(cards)
			.values({ collectionId, type: parsed.type, content: parsed.content, color: parseCardColor(formData) })
			.returning({ id: cards.id });
		await setCardTags(newCard.id, parseTagNames(formData.get('tags')?.toString() ?? ''));
	},

	updateCard: async (event) => {
		const currentUser = requireUser(event);
		const { collectionId } = event.params;
		const { role } = await getCollectionAccess(collectionId, currentUser.id);
		if (!canEdit(role)) error(403, 'Нет прав на редактирование этой коллекции');

		const formData = await event.request.formData();
		const cardId = formData.get('cardId')?.toString();
		if (!cardId) return fail(400, { message: 'cardId обязателен' });

		const parsed = parseCardContent(formData);
		if (!parsed.ok) return fail(400, { message: parsed.message });

		await db
			.update(cards)
			.set({ type: parsed.type, content: parsed.content, color: parseCardColor(formData) })
			.where(and(eq(cards.id, cardId), eq(cards.collectionId, collectionId)));
		await setCardTags(cardId, parseTagNames(formData.get('tags')?.toString() ?? ''));
	},

	deleteCard: async (event) => {
		const currentUser = requireUser(event);
		const { collectionId } = event.params;
		const { role } = await getCollectionAccess(collectionId, currentUser.id);
		if (!canEdit(role)) error(403, 'Нет прав на редактирование этой коллекции');

		const formData = await event.request.formData();
		const cardId = formData.get('cardId')?.toString();
		if (!cardId) return fail(400, { message: 'cardId обязателен' });

		await db.delete(cards).where(and(eq(cards.id, cardId), eq(cards.collectionId, collectionId)));
	},

	updateCollection: async (event) => {
		const currentUser = requireUser(event);
		const { collectionId } = event.params;
		const { role } = await getCollectionAccess(collectionId, currentUser.id);
		if (role !== 'owner') error(403, 'Только владелец может менять настройки коллекции');

		const formData = await event.request.formData();
		const title = formData.get('title')?.toString().trim();
		const description = formData.get('description')?.toString().trim() || null;
		const isPublic = formData.get('isPublic') === 'on';
		if (!title) return fail(400, { message: 'Название обязательно' });

		await db.update(collections).set({ title, description, isPublic }).where(eq(collections.id, collectionId));
	},

	deleteCollection: async (event) => {
		const currentUser = requireUser(event);
		const { collectionId } = event.params;
		const { role } = await getCollectionAccess(collectionId, currentUser.id);
		if (role !== 'owner') error(403, 'Только владелец может удалить коллекцию');

		await db.delete(collections).where(eq(collections.id, collectionId));
		redirect(303, '/collections');
	},

	share: async (event) => {
		const currentUser = requireUser(event);
		const { collectionId } = event.params;
		const { role } = await getCollectionAccess(collectionId, currentUser.id);
		if (role !== 'owner') error(403, 'Только владелец может расшаривать коллекцию');

		const formData = await event.request.formData();
		const email = formData.get('email')?.toString().trim();
		const grantRole = formData.get('role')?.toString();
		if (!email) return fail(400, { message: 'Укажи email пользователя' });
		if (!collectionRole.enumValues.includes(grantRole as (typeof collectionRole.enumValues)[number])) {
			return fail(400, { message: 'Некорректная роль' });
		}

		const [target] = await db.select().from(user).where(ilike(user.email, email)).limit(1);
		if (!target) return fail(400, { message: 'Пользователь с таким email не найден' });
		if (target.id === currentUser.id) return fail(400, { message: 'Это и так твоя коллекция' });

		await db
			.insert(collectionAccess)
			.values({ collectionId, userId: target.id, role: grantRole as 'viewer' | 'editor' })
			.onConflictDoUpdate({
				target: [collectionAccess.collectionId, collectionAccess.userId],
				set: { role: grantRole as 'viewer' | 'editor' }
			});
	},

	revokeAccess: async (event) => {
		const currentUser = requireUser(event);
		const { collectionId } = event.params;
		const { role } = await getCollectionAccess(collectionId, currentUser.id);
		if (role !== 'owner') error(403, 'Только владелец может отзывать доступ');

		const formData = await event.request.formData();
		const targetUserId = formData.get('userId')?.toString();
		if (!targetUserId) return fail(400, { message: 'userId обязателен' });

		await db
			.delete(collectionAccess)
			.where(and(eq(collectionAccess.collectionId, collectionId), eq(collectionAccess.userId, targetUserId)));
	},

	subscribe: async (event) => {
		const currentUser = requireUser(event);
		const { collectionId } = event.params;
		const { collection } = await getCollectionAccess(collectionId, currentUser.id);
		if (!collection?.isPublic) error(404, 'Коллекция не найдена');
		await subscribeToPublicCollection(collectionId, currentUser.id);
	},

	leave: async (event) => {
		const currentUser = requireUser(event);
		const { collectionId } = event.params;
		await leaveCollection(collectionId, currentUser.id);
		redirect(303, '/collections');
	},

	fork: async (event) => {
		const currentUser = requireUser(event);
		const { collectionId } = event.params;
		const { role } = await getCollectionAccess(collectionId, currentUser.id);
		if (role === null) error(404, 'Коллекция не найдена');
		const forked = await forkCollection(collectionId, currentUser.id);
		redirect(303, `/collections/${forked.id}`);
	},

	addComment: async (event) => {
		const currentUser = requireUser(event);
		const { collectionId } = event.params;
		const { role } = await getCollectionAccess(collectionId, currentUser.id);
		if (role === null) error(404, 'Коллекция не найдена');

		const body = (await event.request.formData()).get('body')?.toString() ?? '';
		if (!body.trim()) return fail(400, { message: 'Комментарий не может быть пустым' });
		await addComment(collectionId, currentUser.id, body);
	},

	deleteComment: async (event) => {
		const currentUser = requireUser(event);
		const { collectionId } = event.params;
		const { role } = await getCollectionAccess(collectionId, currentUser.id);

		const commentId = (await event.request.formData()).get('commentId')?.toString();
		if (!commentId) return fail(400, { message: 'commentId обязателен' });

		const comment = await getComment(commentId);
		if (!comment || comment.collectionId !== collectionId) error(404, 'Комментарий не найден');
		// Own comment, or the collection's owner moderating — not editors: an
		// editor's write access to *cards* doesn't imply moderation rights
		// over other people's comments.
		if (comment.authorId !== currentUser.id && role !== 'owner') error(403, 'Нет прав на удаление этого комментария');

		await deleteComment(commentId);
	},

	rate: async (event) => {
		const currentUser = requireUser(event);
		const { collectionId } = event.params;
		const { role } = await getCollectionAccess(collectionId, currentUser.id);
		if (role === null) error(404, 'Коллекция не найдена');

		const rating = Number((await event.request.formData()).get('rating'));
		if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail(400, { message: 'Оценка должна быть 1-5' });
		await rateCollection(collectionId, currentUser.id, rating);
	},

	unrate: async (event) => {
		const currentUser = requireUser(event);
		const { collectionId } = event.params;
		await removeRating(collectionId, currentUser.id);
	}
};

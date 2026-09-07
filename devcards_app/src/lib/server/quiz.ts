import { and, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { cards, quizAttempts, quizSessions } from '$lib/server/db/domain.schema';
import type { StudyCard } from '$lib/server/srs';

/** An unfinished session this user already has going for this collection, if any. */
export async function getActiveSession(collectionId: string, userId: string) {
	const [session] = await db
		.select()
		.from(quizSessions)
		.where(
			and(
				eq(quizSessions.collectionId, collectionId),
				eq(quizSessions.userId, userId),
				sql`${quizSessions.finishedAt} IS NULL`
			)
		)
		.limit(1);
	return session;
}

/** Starts a fresh session over every card currently in the collection. */
export async function startQuizSession(collectionId: string, userId: string): Promise<string> {
	const [{ count }] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(cards)
		.where(eq(cards.collectionId, collectionId));

	const [session] = await db
		.insert(quizSessions)
		.values({ userId, collectionId, totalQuestions: count })
		.returning({ id: quizSessions.id });
	return session.id;
}

export async function getSession(sessionId: string, userId: string) {
	const [session] = await db
		.select()
		.from(quizSessions)
		.where(and(eq(quizSessions.id, sessionId), eq(quizSessions.userId, userId)))
		.limit(1);
	return session;
}

/**
 * Next not-yet-answered card in this session, in a shuffled but *stable*
 * order (same session -> same order every reload): sorting by md5(session
 * id || card id) is a cheap way to get a per-session pseudo-random order
 * without persisting a queue anywhere.
 */
export async function getNextQuizCard(sessionId: string, collectionId: string): Promise<StudyCard | null> {
	const [row] = await db
		.select({ card: cards })
		.from(cards)
		.where(
			and(
				eq(cards.collectionId, collectionId),
				sql`${cards.id} not in (select card_id from quiz_attempts where quiz_session_id = ${sessionId})`
			)
		)
		.orderBy(sql`md5(${sessionId}::text || ${cards.id}::text)`)
		.limit(1);

	if (!row) return null;
	return { id: row.card.id, type: row.card.type, content: row.card.content, color: row.card.color };
}

/** Records one answer, and closes out the session once every card's been answered. */
export async function submitAnswer(
	sessionId: string,
	cardId: string,
	givenAnswer: unknown,
	isCorrect: boolean
): Promise<void> {
	await db.insert(quizAttempts).values({ quizSessionId: sessionId, cardId, givenAnswer, isCorrect });

	const [{ answered }] = await db
		.select({ answered: sql<number>`count(*)::int` })
		.from(quizAttempts)
		.where(eq(quizAttempts.quizSessionId, sessionId));

	const [session] = await db.select().from(quizSessions).where(eq(quizSessions.id, sessionId)).limit(1);
	if (!session || answered < session.totalQuestions) return;

	const [{ correct }] = await db
		.select({ correct: sql<number>`count(*) filter (where is_correct)::int` })
		.from(quizAttempts)
		.where(eq(quizAttempts.quizSessionId, sessionId));

	await db.update(quizSessions).set({ finishedAt: new Date(), score: correct }).where(eq(quizSessions.id, sessionId));
}

export async function getAnsweredCount(sessionId: string): Promise<number> {
	const [{ answered }] = await db
		.select({ answered: sql<number>`count(*)::int` })
		.from(quizAttempts)
		.where(eq(quizAttempts.quizSessionId, sessionId));
	return answered;
}

export async function getSessionResults(sessionId: string, userId: string) {
	const session = await getSession(sessionId, userId);
	if (!session) return null;

	const attempts = await db
		.select({ attempt: quizAttempts, card: cards })
		.from(quizAttempts)
		.innerJoin(cards, eq(quizAttempts.cardId, cards.id))
		.where(eq(quizAttempts.quizSessionId, sessionId))
		.orderBy(quizAttempts.answeredAt);

	return { session, attempts };
}

/** Past sessions for a collection (for a simple history list on the collection page). */
export async function listSessions(collectionId: string, userId: string) {
	return db
		.select()
		.from(quizSessions)
		.where(
			and(eq(quizSessions.collectionId, collectionId), eq(quizSessions.userId, userId), sql`${quizSessions.finishedAt} IS NOT NULL`)
		)
		.orderBy(sql`${quizSessions.finishedAt} desc`)
		.limit(10);
}

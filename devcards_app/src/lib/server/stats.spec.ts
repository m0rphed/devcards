import { afterAll, describe, expect, test } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/auth.schema';
import { cards, collections, reviewState } from '$lib/server/db/domain.schema';
import { computeRetentionRate, computeStudyStreak, getUpcomingReviewForecast, type DailyActivity } from './stats';

function daysAgo(n: number): Date {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() - n);
	d.setUTCHours(0, 0, 0, 0);
	return d;
}

function activity(reviews: number, day: Date, correct = reviews, incorrect = 0): DailyActivity {
	return { day, reviews, correct, incorrect };
}

describe('computeStudyStreak', () => {
	test('counts consecutive days back from today', () => {
		const rows = [activity(3, daysAgo(0)), activity(2, daysAgo(1)), activity(1, daysAgo(2))];
		expect(computeStudyStreak(rows)).toBe(3);
	});

	test('today with no activity yet does not break the streak', () => {
		// No row at all for today — same as reviews:0 — but yesterday/the day
		// before both have activity, so the streak should still count them.
		const rows = [activity(4, daysAgo(1)), activity(2, daysAgo(2))];
		expect(computeStudyStreak(rows)).toBe(2);
	});

	test('a gap stops the streak', () => {
		const rows = [activity(1, daysAgo(0)), activity(1, daysAgo(1)), activity(1, daysAgo(3))]; // gap at daysAgo(2)
		expect(computeStudyStreak(rows)).toBe(2);
	});

	test('no activity at all is a zero streak', () => {
		expect(computeStudyStreak([])).toBe(0);
	});
});

describe('computeRetentionRate', () => {
	test('correct / (correct + incorrect) as a rounded percentage', () => {
		const rows = [activity(10, daysAgo(0), 7, 3), activity(10, daysAgo(1), 8, 2)];
		// 15 correct / 20 total = 75%
		expect(computeRetentionRate(rows)).toBe(75);
	});

	test('zero total reviews -> null, not a divide-by-zero NaN', () => {
		expect(computeRetentionRate([])).toBeNull();
		expect(computeRetentionRate([activity(0, daysAgo(0), 0, 0)])).toBeNull();
	});
});

describe('getUpcomingReviewForecast (real DB)', () => {
	// Regression test for a real production bug: `day` is built from a raw
	// SQL expression (greatest(date_trunc(...))), not a plain schema column
	// reference — postgres-js only auto-parses timestamps into real Date
	// objects for columns it recognizes from the schema, so a computed
	// column like this one came back as a plain "YYYY-MM-DD HH:MM:SS+00"
	// string despite `sql<Date>`'s type annotation (that's compile-time
	// only). settings/+page.svelte called `.toISOString()` on it and 500'd
	// in production. Confirmed via this exact query against prod before
	// fixing, and confirmed the fix (`new Date(r.day)` in stats.ts) here
	// against a real row, not just by reasoning about it.
	const testUserId = 'stats-spec-test-user';
	const testCollectionId = crypto.randomUUID();
	const testCardId = crypto.randomUUID();

	afterAll(async () => {
		await db.delete(user).where(eq(user.id, testUserId)); // cascades to collections/cards/review_state
	});

	test('day is a real Date, not a string that only looks like one', async () => {
		await db
			.insert(user)
			.values({ id: testUserId, name: 'stats spec test', email: 'stats-spec-test@example.invalid', emailVerified: true })
			.onConflictDoNothing();
		const [{ id: collectionId }] = await db
			.insert(collections)
			.values({ id: testCollectionId, ownerId: testUserId, title: 'stats spec test collection' })
			.returning({ id: collections.id });
		const [{ id: cardId }] = await db
			.insert(cards)
			.values({ id: testCardId, collectionId, type: 'basic', content: { front: 'Q', back: 'A' } })
			.returning({ id: cards.id });
		await db.insert(reviewState).values({ userId: testUserId, cardId, due: new Date() });

		const forecast = await getUpcomingReviewForecast(testUserId);

		expect(forecast.length).toBeGreaterThan(0);
		expect(forecast[0].day).toBeInstanceOf(Date);
		expect(() => forecast[0].day.toISOString()).not.toThrow();
	});
});

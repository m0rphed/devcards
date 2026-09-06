import { describe, expect, test } from 'vitest';
import { State } from 'ts-fsrs';
import { dbStateToFsrs, fromFsrsCard, fsrsStateToDb, toFsrsCard, type ReviewStateRow } from './fsrs-mapping';

describe('dbStateToFsrs / fsrsStateToDb', () => {
	test('round-trips every state', () => {
		for (const dbState of ['new', 'learning', 'review', 'relearning'] as const) {
			expect(fsrsStateToDb(dbStateToFsrs(dbState))).toBe(dbState);
		}
	});

	test('matches ts-fsrs numeric State enum', () => {
		expect(dbStateToFsrs('new')).toBe(State.New);
		expect(dbStateToFsrs('learning')).toBe(State.Learning);
		expect(dbStateToFsrs('review')).toBe(State.Review);
		expect(dbStateToFsrs('relearning')).toBe(State.Relearning);
	});
});

describe('toFsrsCard / fromFsrsCard', () => {
	test('no row (never studied) -> a brand-new FSRS card', () => {
		const card = toFsrsCard(undefined);
		expect(card.state).toBe(State.New);
		expect(card.reps).toBe(0);
	});

	test('round-trips a review_state row through Card and back', () => {
		const row: ReviewStateRow = {
			userId: 'u1',
			cardId: 'c1',
			state: 'review',
			due: new Date('2026-01-01T00:00:00Z'),
			stability: 12.5,
			difficulty: 4.2,
			scheduledDays: 10,
			learningSteps: 0,
			reps: 3,
			lapses: 1,
			lastReview: new Date('2025-12-22T00:00:00Z')
		};

		const card = toFsrsCard(row);
		expect(card.state).toBe(State.Review);
		expect(card.stability).toBe(row.stability);
		expect(card.reps).toBe(row.reps);

		const back = fromFsrsCard(card);
		expect(back).toEqual({
			state: 'review',
			due: row.due,
			stability: row.stability,
			difficulty: row.difficulty,
			scheduledDays: row.scheduledDays,
			learningSteps: row.learningSteps,
			reps: row.reps,
			lapses: row.lapses,
			lastReview: row.lastReview
		});
	});

	test('a null last_review maps to undefined on the Card, and back to null', () => {
		const row: ReviewStateRow = {
			userId: 'u1',
			cardId: 'c1',
			state: 'new',
			due: new Date(),
			stability: 0,
			difficulty: 0,
			scheduledDays: 0,
			learningSteps: 0,
			reps: 0,
			lapses: 0,
			lastReview: null
		};

		const card = toFsrsCard(row);
		expect(card.last_review).toBeUndefined();
		expect(fromFsrsCard(card).lastReview).toBeNull();
	});
});

import { describe, expect, test } from 'vitest';
import { computeRetentionRate, computeStudyStreak, type DailyActivity } from './stats';

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

<script lang="ts">
	import { enhance } from '$app/forms';
	import { scaleThreshold } from 'd3-scale';
	import { BarChart, Calendar, Chart, Layer, PieChart } from 'layerchart';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	let uploading = $state(false);
	let uploadError = $state('');
	let avatarForm: HTMLFormElement;
	let urlInput: HTMLInputElement;

	async function onFileChange(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;

		uploading = true;
		uploadError = '';
		try {
			const body = new FormData();
			body.set('file', file);
			const res = await fetch('/api/attachments', { method: 'POST', body });
			if (!res.ok) {
				const { error: reason } = await res.json().catch(() => ({ error: 'unknown' }));
				uploadError =
					reason === 'unsupported_type'
						? 'Поддерживаются только PNG, JPEG и WebP'
						: reason === 'too_large'
							? 'Файл больше 5MB'
							: 'Не удалось загрузить файл';
				return;
			}
			const { url } = await res.json();
			urlInput.value = url;
			avatarForm.requestSubmit();
		} finally {
			uploading = false;
		}
	}

	// --- Статистика ---
	let hasAnyActivity = $derived(data.gradeDistribution.length > 0);

	// Snapshot "now" once at module init, not reactively — this is a display
	// window, not something that should recompute on every render.
	const heatmapEnd = new Date();
	const heatmapStart = new Date(heatmapEnd);
	heatmapStart.setUTCDate(heatmapStart.getUTCDate() - 365);

	function dayKey(d: Date) {
		return d.toISOString().slice(0, 10);
	}

	// Calendar expects one point per day in [start, end] (LayerChart's own
	// docs example fills every day explicitly rather than leaving gaps) —
	// getReviewActivity only returns rows for days with actual reviews, so
	// fill every other day in the window with 0 here.
	let heatmapData = $derived.by(() => {
		const byDay = new Map(data.activity.map((a) => [dayKey(a.day), a.reviews]));
		const days: { date: Date; value: number }[] = [];
		const cursor = new Date(heatmapStart);
		while (cursor <= heatmapEnd) {
			days.push({ date: new Date(cursor), value: byDay.get(dayKey(cursor)) ?? 0 });
			cursor.setUTCDate(cursor.getUTCDate() + 1);
		}
		return days;
	});

	const GRADE_LABELS: Record<string, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' };
	const GRADE_ORDER = ['again', 'hard', 'good', 'easy'];
	let gradeChartData = $derived(
		GRADE_ORDER.map((rating) => ({
			grade: GRADE_LABELS[rating],
			count: data.gradeDistribution.find((g) => g.rating === rating)?.count ?? 0
		}))
	);

	const STATE_LABELS: Record<string, string> = {
		new: 'Новые',
		learning: 'Изучение',
		review: 'Повторение',
		relearning: 'Пересдача'
	};
	const STATE_ORDER = ['new', 'learning', 'review', 'relearning'];
	// Zero-count states are dropped — an empty wedge/label for "0 карточек"
	// only clutters a donut, unlike the bar chart above where all 4 grades
	// side by side are worth comparing even when one is empty.
	let stateChartData = $derived(
		STATE_ORDER.map((state) => ({
			key: STATE_LABELS[state],
			value: data.fsrsStateDistribution.find((s) => s.state === state)?.count ?? 0
		})).filter((d) => d.value > 0)
	);
</script>

<div class="flex max-w-3xl flex-col gap-8">
	<div class="flex max-w-md flex-col gap-6">
		<h1 class="text-xl font-semibold">Настройки профиля</h1>

		<div class="flex items-center gap-4">
			<Avatar src={data.user.image} name={data.user.name} size="lg" />
			<div>
				<p class="font-medium text-gray-900">{data.user.name}</p>
				<p class="text-sm text-gray-500">{data.user.email}</p>
				<label class="mt-1 block text-sm text-blue-600 hover:underline">
					{uploading ? 'Загрузка…' : 'Сменить аватар'}
					<input
						type="file"
						accept="image/png,image/jpeg,image/webp"
						class="hidden"
						onchange={onFileChange}
						disabled={uploading}
					/>
				</label>
				<p class="text-xs text-gray-400">PNG, JPEG или WebP, до 5MB</p>
				{#if uploadError}<p class="text-xs text-red-600">{uploadError}</p>{/if}
				{#if form?.message}<p class="text-xs text-red-600">{form.message}</p>{/if}
			</div>
		</div>

		<form bind:this={avatarForm} method="post" action="?/setAvatar" use:enhance class="hidden">
			<input bind:this={urlInput} type="hidden" name="url" />
		</form>
	</div>

	<div class="flex flex-col gap-4">
		<h2 class="text-lg font-semibold">Статистика</h2>

		{#if !hasAnyActivity}
			<p class="text-sm text-gray-500">
				Пока нет ни одного повторения — статистика появится, как только начнёшь учить карточки.
			</p>
		{:else}
			<div class="flex gap-6">
				<div>
					<p class="text-2xl font-semibold">{data.streak} 🔥</p>
					<p class="text-xs text-gray-500">дней подряд</p>
				</div>
				{#if data.retentionRate !== null}
					<div>
						<p class="text-2xl font-semibold">{data.retentionRate}%</p>
						<p class="text-xs text-gray-500">запоминания (good/easy)</p>
					</div>
				{/if}
			</div>

			<div class="rounded-md border border-gray-200 p-4">
				<p class="mb-2 text-sm font-medium text-gray-700">Активность за год</p>
				<Chart
					data={heatmapData}
					x="date"
					c="value"
					cScale={scaleThreshold().unknown('transparent')}
					cDomain={[1, 5, 15]}
					cRange={['var(--color-gray-100)', 'var(--color-blue-200)', 'var(--color-blue-400)', 'var(--color-blue-600)']}
					padding={{ top: 20 }}
					height={140}
				>
					<Layer>
						<Calendar start={heatmapStart} end={heatmapEnd} monthPath />
					</Layer>
				</Chart>
			</div>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="rounded-md border border-gray-200 p-4">
					<p class="mb-2 text-sm font-medium text-gray-700">Оценки за всё время</p>
					<BarChart data={gradeChartData} x="grade" y="count" height={220} />
				</div>
				{#if stateChartData.length > 0}
					<div class="rounded-md border border-gray-200 p-4">
						<p class="mb-2 text-sm font-medium text-gray-700">Карточки по стадии FSRS</p>
						<PieChart data={stateChartData} key="key" value="value" innerRadius={-20} height={220} legend />
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

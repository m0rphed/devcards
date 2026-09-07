<script lang="ts">
	import { enhance } from '$app/forms';
	import { scaleThreshold } from 'd3-scale';
	import { intervalOffset } from '@layerstack/utils';
	import { BarChart, Calendar, Chart, Layer, PieChart, Tooltip } from 'layerchart';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import Disclosure from '$lib/components/ui/Disclosure.svelte';
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

	// --- Смена пароля ---
	let showPasswordForm = $state(false);
	$effect(() => {
		// A successful change closes the form back up — nothing left to do
		// with it open, and it re-shows the collapsed "Изменить пароль"
		// trigger alongside the success message.
		if (form?.passwordChanged) showPasswordForm = false;
	});

	// --- Статистика ---
	let hasAnyActivity = $derived(data.gradeDistribution.length > 0);

	// Tooltip look shared by all three charts below — muted/neutral, legible
	// on its own merit rather than relying on LayerChart's default theme
	// variables (--color-surface-*), which this app never defines, so the
	// built-in "default" variant renders as near-white-on-white. Deliberately
	// not the app's own accent blue either — that's reserved for interactive
	// controls (buttons/links), and a chart tooltip isn't one.
	const TOOLTIP_CLASSES = { container: 'bg-gray-800 text-white shadow-lg' };

	// Snapshot "now" once at module init, not reactively — this is a display
	// window, not something that should recompute on every render.
	const heatmapEnd = new Date();
	const heatmapStart = intervalOffset('day', heatmapEnd, -90);

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
	// Same colors as the grade buttons in StudyCardView (bg-red-600/orange-500/
	// green-600/blue-600) — same CSS variables Tailwind generates for those
	// exact utility classes, so the chart reads as the same visual language
	// instead of an unrelated new accent.
	const GRADE_COLORS: Record<string, string> = {
		again: 'var(--color-red-600)',
		hard: 'var(--color-orange-500)',
		good: 'var(--color-green-600)',
		easy: 'var(--color-blue-600)'
	};
	let gradeChartData = $derived(
		GRADE_ORDER.map((rating) => ({
			grade: GRADE_LABELS[rating],
			count: data.gradeDistribution.find((g) => g.rating === rating)?.count ?? 0
		}))
	);
	const gradeColorRange = GRADE_ORDER.map((rating) => GRADE_COLORS[rating]);

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

	const dayLabelFormat = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' });
	function dayLabel(d: Date) {
		return dayKey(d) === dayKey(new Date()) ? 'Сегодня' : dayLabelFormat.format(d);
	}
	let upcomingChartData = $derived(
		data.upcomingReviews.map((r) => ({ day: dayLabel(r.day), count: r.dueCount }))
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
				{#if form?.message && !form?.changePassword}<p class="text-xs text-red-600">{form.message}</p>{/if}
			</div>
		</div>

		<form bind:this={avatarForm} method="post" action="?/setAvatar" use:enhance class="hidden">
			<input bind:this={urlInput} type="hidden" name="url" />
		</form>

		<Disclosure bind:open={showPasswordForm} triggerClass="w-fit text-sm text-blue-600 hover:underline">
			{#snippet trigger(open)}{open ? 'Скрыть' : 'Изменить пароль'}{/snippet}
			<form method="post" action="?/changePassword" use:enhance class="flex flex-col gap-3">
				<label class="block text-sm">
					Текущий пароль
					<input
						type="password"
						name="currentPassword"
						required
						minlength="8"
						autocomplete="current-password"
						class="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
					/>
				</label>
				<label class="block text-sm">
					Новый пароль
					<input
						type="password"
						name="newPassword"
						required
						minlength="8"
						autocomplete="new-password"
						class="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
					/>
				</label>
				{#if form?.message && form?.changePassword}<p class="text-sm text-red-600">{form.message}</p>{/if}
				<button class="w-fit rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">
					Сохранить новый пароль
				</button>
			</form>
		</Disclosure>
		{#if form?.passwordChanged}
			<p class="text-sm text-green-700">
				Пароль обновлён ✓ Все остальные сессии на аккаунте разлогинены на всякий случай.
			</p>
		{/if}
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
				<p class="mb-2 text-sm font-medium text-gray-700">Активность за 3 месяца</p>
				<Chart
					data={heatmapData}
					x="date"
					c="value"
					cScale={scaleThreshold()}
					cDomain={[1, 5, 15]}
					cRange={['var(--color-gray-100)', 'var(--color-blue-200)', 'var(--color-blue-400)', 'var(--color-blue-600)']}
					padding={{ top: 20 }}
					height={140}
				>
					{#snippet children({ context })}
						<Layer type="html">
							<Calendar start={heatmapStart} end={heatmapEnd}>
								{#snippet children({ cells, cellSize })}
									{#each cells as cell}
										<!-- Hover-only tooltip trigger, not a real control (no
										     keyboard equivalent exists for "hover a calendar
										     cell") — same reasoning as Flashcard.svelte's
										     pointer layer. -->
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<div
											class="absolute p-px"
											style:left="{cell.x}px"
											style:top="{cell.y}px"
											style:width="{cellSize[0]}px"
											style:height="{cellSize[1]}px"
											onpointermove={(e) => context.tooltip?.show(e, cell.data)}
											onpointerleave={() => context.tooltip?.hide()}
										>
											<div
												class="h-full w-full rounded-sm"
												style:background-color={cell.color ?? 'var(--color-gray-100)'}
											></div>
										</div>
									{/each}
								{/snippet}
							</Calendar>
						</Layer>

						<Tooltip.Root classes={TOOLTIP_CLASSES}>
							{#snippet children({ data: cellData })}
								<Tooltip.Header value={cellData.date} format="day" />
								<Tooltip.List>
									<Tooltip.Item label="повторений" value={cellData.value} format="integer" valueAlign="right" />
								</Tooltip.List>
							{/snippet}
						</Tooltip.Root>
					{/snippet}
				</Chart>
			</div>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="rounded-md border border-gray-200 p-4">
					<p class="mb-2 text-sm font-medium text-gray-700">Оценки за всё время</p>
					<BarChart
						data={gradeChartData}
						x="grade"
						y="count"
						c="grade"
						cRange={gradeColorRange}
						height={220}
						props={{ tooltip: { root: { classes: TOOLTIP_CLASSES } } }}
					/>
				</div>
				{#if stateChartData.length > 0}
					<div class="rounded-md border border-gray-200 p-4">
						<p class="mb-2 text-sm font-medium text-gray-700">Карточки по стадии FSRS</p>
						<PieChart
							data={stateChartData}
							key="key"
							value="value"
							innerRadius={-20}
							height={220}
							legend
							props={{ tooltip: { root: { classes: TOOLTIP_CLASSES } } }}
						/>
					</div>
				{/if}
			</div>

			{#if upcomingChartData.length > 0}
				<div class="rounded-md border border-gray-200 p-4">
					<p class="mb-2 text-sm font-medium text-gray-700">Прогноз повторений на неделю</p>
					<BarChart
						data={upcomingChartData}
						x="day"
						y="count"
						props={{ bars: { class: 'fill-blue-500' }, tooltip: { root: { classes: TOOLTIP_CLASSES } } }}
						height={200}
					/>
				</div>
			{/if}

			{#if data.strugglingTags.length > 0}
				<div class="rounded-md border border-gray-200 p-4">
					<p class="mb-2 text-sm font-medium text-gray-700">Проблемные теги</p>
					<ul class="flex flex-col gap-1.5">
						{#each data.strugglingTags as tag (tag.name)}
							<li class="flex items-center justify-between text-sm">
								<span class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">#{tag.name}</span>
								<span class="text-gray-500">
									{Math.round((tag.incorrect / tag.total) * 100)}% ошибок ({tag.incorrect}/{tag.total})
								</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{/if}
	</div>
</div>

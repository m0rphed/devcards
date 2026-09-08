<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	// Generic "render whatever columns came back" table — the 7 functions
	// each return a different shape, so this stays one component instead of
	// seven near-identical ones.
	function columnsOf(rows: Record<string, unknown>[]): string[] {
		return rows.length > 0 ? Object.keys(rows[0]) : [];
	}
</script>

<svelte:head><title>Admin — devcards</title></svelte:head>

<div class="mx-auto flex max-w-4xl flex-col gap-8 pb-16">
	<div>
		<h1 class="text-xl font-semibold">Служебная страница администратора</h1>
		<p class="mt-1 text-sm text-gray-500">
			Личная утилита для защиты курсовой — просмотр всех таблиц БД и вызов хранимых функций с
			произвольными параметрами. Не часть обычного функционала devcards.
		</p>
	</div>

	<section>
		<h2 class="mb-2 text-lg font-medium">Таблицы в БД ({data.tables.length})</h2>
		<div class="overflow-x-auto rounded-md border border-gray-200">
			<table class="w-full text-sm">
				<thead class="bg-gray-50 text-left text-gray-500">
					<tr><th class="px-3 py-2">Таблица</th><th class="px-3 py-2">Строк</th></tr>
				</thead>
				<tbody>
					{#each data.tables as t (t.name)}
						<tr class="border-t border-gray-100">
							<td class="px-3 py-1.5 font-mono">{t.name}</td>
							<td class="px-3 py-1.5">{t.rowCount}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section>
		<h2 class="mb-2 text-lg font-medium">Хранимые функции</h2>
		<div class="flex flex-col gap-6">
			<!-- 1 -->
			<form method="post" action="?/fn_user_top_struggling_tags" use:enhance class="rounded-md border border-gray-200 p-4">
				<p class="mb-2 font-mono text-sm">fn_user_top_struggling_tags(p_user_id, p_days, p_min_reviews)</p>
				<div class="flex flex-wrap gap-2">
					<input name="userId" placeholder="user id" class="rounded border border-gray-300 px-2 py-1 text-sm" required />
					<input name="days" type="number" placeholder="days (30)" class="w-28 rounded border border-gray-300 px-2 py-1 text-sm" />
					<input name="minReviews" type="number" placeholder="min reviews (3)" class="w-36 rounded border border-gray-300 px-2 py-1 text-sm" />
					<button class="rounded bg-gray-800 px-3 py-1 text-sm text-white">Выполнить</button>
				</div>
			</form>

			<!-- 2 -->
			<form method="post" action="?/fn_public_collections_ranking" use:enhance class="rounded-md border border-gray-200 p-4">
				<p class="mb-2 font-mono text-sm">fn_public_collections_ranking(p_limit)</p>
				<div class="flex flex-wrap gap-2">
					<input name="limit" type="number" placeholder="limit (10)" class="w-28 rounded border border-gray-300 px-2 py-1 text-sm" />
					<button class="rounded bg-gray-800 px-3 py-1 text-sm text-white">Выполнить</button>
				</div>
			</form>

			<!-- 3 -->
			<form method="post" action="?/fn_review_forecast" use:enhance class="rounded-md border border-gray-200 p-4">
				<p class="mb-2 font-mono text-sm">fn_review_forecast(p_user_id, p_days)</p>
				<div class="flex flex-wrap gap-2">
					<input name="userId" placeholder="user id" class="rounded border border-gray-300 px-2 py-1 text-sm" required />
					<input name="days" type="number" placeholder="days (7)" class="w-28 rounded border border-gray-300 px-2 py-1 text-sm" />
					<button class="rounded bg-gray-800 px-3 py-1 text-sm text-white">Выполнить</button>
				</div>
			</form>

			<!-- 4 -->
			<form method="post" action="?/fn_daily_activity" use:enhance class="rounded-md border border-gray-200 p-4">
				<p class="mb-2 font-mono text-sm">fn_daily_activity(p_user_id, p_days)</p>
				<div class="flex flex-wrap gap-2">
					<input name="userId" placeholder="user id" class="rounded border border-gray-300 px-2 py-1 text-sm" required />
					<input name="days" type="number" placeholder="days (30)" class="w-28 rounded border border-gray-300 px-2 py-1 text-sm" />
					<button class="rounded bg-gray-800 px-3 py-1 text-sm text-white">Выполнить</button>
				</div>
			</form>

			<!-- 5 -->
			<form method="post" action="?/fn_public_authors_without_forks" use:enhance class="rounded-md border border-gray-200 p-4">
				<p class="mb-2 font-mono text-sm">fn_public_authors_without_forks()</p>
				<button class="rounded bg-gray-800 px-3 py-1 text-sm text-white">Выполнить</button>
			</form>

			<!-- 6 -->
			<form method="post" action="?/fn_never_reviewed_cards" use:enhance class="rounded-md border border-gray-200 p-4">
				<p class="mb-2 font-mono text-sm">fn_never_reviewed_cards(p_collection_id)</p>
				<div class="flex flex-wrap gap-2">
					<input name="collectionId" placeholder="collection id (uuid)" class="w-72 rounded border border-gray-300 px-2 py-1 text-sm" required />
					<button class="rounded bg-gray-800 px-3 py-1 text-sm text-white">Выполнить</button>
				</div>
			</form>

			<!-- 7 -->
			<form method="post" action="?/fn_collection_rating_summary" use:enhance class="rounded-md border border-gray-200 p-4">
				<p class="mb-2 font-mono text-sm">fn_collection_rating_summary()</p>
				<button class="rounded bg-gray-800 px-3 py-1 text-sm text-white">Выполнить</button>
			</form>
		</div>
	</section>

	{#if form}
		<section>
			<h2 class="mb-2 text-lg font-medium">Результат: <span class="font-mono">{form.fn}</span></h2>
			{#if form.error}
				<p class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{form.error}</p>
			{:else if form.rows && form.rows.length > 0}
				<div class="overflow-x-auto rounded-md border border-gray-200">
					<table class="w-full text-sm">
						<thead class="bg-gray-50 text-left text-gray-500">
							<tr>{#each columnsOf(form.rows) as col (col)}<th class="px-3 py-2">{col}</th>{/each}</tr>
						</thead>
						<tbody>
							{#each form.rows as row, i (i)}
								<tr class="border-t border-gray-100">
									{#each columnsOf(form.rows) as col (col)}<td class="px-3 py-1.5">{String(row[col])}</td>{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="text-sm text-gray-500">Пусто (0 строк).</p>
			{/if}
		</section>
	{/if}
</div>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowLeft } from '@lucide/svelte';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();
</script>

<div class="flex flex-col gap-6">
	<a href="/collections/{data.collection.id}" class="flex w-fit items-center gap-1 text-sm text-blue-600 hover:underline">
		<ArrowLeft class="size-4" aria-hidden="true" /> {data.collection.title}
	</a>
	<h1 class="text-xl font-semibold">Тест по коллекции «{data.collection.title}»</h1>

	{#if data.cardCount === 0}
		<p class="text-sm text-gray-500">В коллекции пока нет карточек — нечего тестировать.</p>
	{:else}
		<p class="text-sm text-gray-500">Вопросов: {data.cardCount}. В конце — итоговый счёт и разбор ответов.</p>
		<form method="post" action="?/start" use:enhance>
			{#if form?.message}<p class="mb-2 text-sm text-red-600">{form.message}</p>{/if}
			<button class="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">Начать тест</button>
		</form>
	{/if}

	{#if data.history.length > 0}
		<div>
			<h2 class="mb-3 text-lg font-semibold">История прохождений</h2>
			<ul class="flex flex-col gap-1 text-sm">
				{#each data.history as s (s.id)}
					<li>
						<a href="/collections/{data.collection.id}/quiz/{s.id}/results" class="text-blue-600 hover:underline">
							{s.score} / {s.totalQuestions}
						</a>
						<span class="text-gray-400">
							— {s.finishedAt ? new Date(s.finishedAt).toLocaleString('ru-RU') : ''}
						</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

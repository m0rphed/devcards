<script lang="ts">
	import { enhance } from '$app/forms';
	import type { StudyCard } from '$lib/server/srs';

	let { card, current, total }: { card: StudyCard; current: number; total: number } = $props();
	let revealed = $state(false);

	const CLOZE_PATTERN = /\{\{c\d+::(.*?)\}\}/g;
	function clozeText(text: string, reveal: boolean) {
		return text.replace(CLOZE_PATTERN, (_, answer: string) => (reveal ? answer : '[...]'));
	}
</script>

<p class="text-sm text-gray-500">Вопрос {current} из {total}</p>

<div class="rounded-md border border-gray-200 p-6">
	{#if card.type === 'multiple_choice'}
		{@const content = card.content as { question: string; options: string[] }}
		<p class="text-lg">{content.question}</p>
	{:else if card.type === 'basic'}
		{@const content = card.content as { front: string; back: string }}
		<p class="text-lg">{content.front}</p>
		{#if revealed}
			<hr class="my-4 border-gray-200" />
			<p class="text-lg text-gray-700">{content.back}</p>
		{/if}
	{:else}
		{@const content = card.content as { text: string }}
		<p class="text-lg">{clozeText(content.text, revealed)}</p>
	{/if}
</div>

{#if card.type === 'multiple_choice'}
	{@const content = card.content as { options: string[] }}
	<form method="post" action="?/answer" use:enhance class="flex flex-col gap-2">
		<input type="hidden" name="cardId" value={card.id} />
		{#each content.options as option, i}
			<button
				name="selectedIndex"
				value={i}
				class="rounded-md border border-gray-300 px-4 py-2 text-left text-sm hover:border-blue-400 hover:bg-blue-50"
			>
				{option}
			</button>
		{/each}
	</form>
{:else if !revealed}
	<button
		type="button"
		class="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
		onclick={() => (revealed = true)}
	>
		Показать ответ
	</button>
{:else}
	<form method="post" action="?/answer" use:enhance class="flex gap-2">
		<input type="hidden" name="cardId" value={card.id} />
		<button
			name="selfReported"
			value="incorrect"
			class="flex-1 rounded-md bg-red-600 py-2 text-sm text-white hover:bg-red-700"
		>
			Неверно
		</button>
		<button
			name="selfReported"
			value="correct"
			class="flex-1 rounded-md bg-green-600 py-2 text-sm text-white hover:bg-green-700"
		>
			Верно
		</button>
	</form>
{/if}

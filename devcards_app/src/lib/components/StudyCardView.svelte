<script lang="ts">
	import { enhance } from '$app/forms';
	import type { StudyCard } from '$lib/server/srs';

	// Local `revealed` state — owned entirely by this component instance, so
	// the parent must recreate this component (via {#key}) whenever a new
	// card is shown, even if it happens to be the same card id as before
	// (e.g. "Again" bringing it right back).
	let { card, remaining }: { card: StudyCard; remaining: number } = $props();
	let revealed = $state(false);

	const CLOZE_PATTERN = /\{\{c\d+::(.*?)\}\}/g;

	function clozeText(text: string, reveal: boolean) {
		return text.replace(CLOZE_PATTERN, (_, answer: string) => (reveal ? answer : '[...]'));
	}
</script>

<p class="text-sm text-gray-500">Осталось карточек: {remaining}</p>

<div class="rounded-md border border-gray-200 p-6">
	{#if card.type === 'basic'}
		{@const content = card.content as { front: string; back: string }}
		<p class="text-lg">{content.front}</p>
		{#if revealed}
			<hr class="my-4 border-gray-200" />
			<p class="text-lg text-gray-700">{content.back}</p>
		{/if}
	{:else if card.type === 'cloze'}
		{@const content = card.content as { text: string }}
		<p class="text-lg">{clozeText(content.text, revealed)}</p>
	{:else}
		{@const content = card.content as { question: string; options: string[]; correct_index: number }}
		<p class="text-lg">{content.question}</p>
		{#if revealed}
			<ul class="mt-4 flex flex-col gap-1">
				{#each content.options as option, i}
					<li class={i === content.correct_index ? 'font-medium text-green-700' : 'text-gray-600'}>
						{i === content.correct_index ? '✓' : '—'}
						{option}
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>

{#if !revealed}
	<button
		type="button"
		class="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
		onclick={() => (revealed = true)}
	>
		Показать ответ
	</button>
{:else}
	<form method="post" action="?/grade" use:enhance class="flex gap-2">
		<input type="hidden" name="cardId" value={card.id} />
		<button name="rating" value="1" class="flex-1 rounded-md bg-red-600 py-2 text-sm text-white hover:bg-red-700">
			Again
		</button>
		<button name="rating" value="2" class="flex-1 rounded-md bg-orange-500 py-2 text-sm text-white hover:bg-orange-600">
			Hard
		</button>
		<button name="rating" value="3" class="flex-1 rounded-md bg-green-600 py-2 text-sm text-white hover:bg-green-700">
			Good
		</button>
		<button name="rating" value="4" class="flex-1 rounded-md bg-blue-600 py-2 text-sm text-white hover:bg-blue-700">
			Easy
		</button>
	</form>
{/if}

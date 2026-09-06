<script lang="ts">
	import { enhance } from '$app/forms';
	import { PreRendered } from 'carta-md';
	import type { StudyCard } from '$lib/server/srs';
	import type { RenderedCard } from '$lib/server/render-card';

	// Local `revealed` state — owned entirely by this component instance, so
	// the parent must recreate this component (via {#key}) whenever a new
	// card is shown, even if it happens to be the same card id as before
	// (e.g. "Again" bringing it right back).
	let { card, rendered, remaining }: { card: StudyCard; rendered: RenderedCard; remaining: number } = $props();
	let revealed = $state(false);
</script>

<p class="text-sm text-gray-500">Осталось карточек: {remaining}</p>

<div class="rounded-md border border-gray-200 p-6">
	{#if rendered.kind === 'basic'}
		<div class="prose max-w-none">
			<PreRendered html={rendered.frontHtml} />
		</div>
		{#if revealed}
			<hr class="my-4 border-gray-200" />
			<div class="prose max-w-none text-gray-700">
				<PreRendered html={rendered.backHtml} />
			</div>
		{/if}
	{:else if rendered.kind === 'cloze'}
		<div class="prose max-w-none">
			<PreRendered html={revealed ? rendered.revealedHtml : rendered.maskedHtml} />
		</div>
	{:else}
		<div class="prose max-w-none">
			<PreRendered html={rendered.questionHtml} />
		</div>
		{#if revealed}
			<ul class="mt-4 flex flex-col gap-1">
				{#each rendered.options as option, i}
					<li class={i === rendered.correctIndex ? 'font-medium text-green-700' : 'text-gray-600'}>
						{i === rendered.correctIndex ? '✓' : '—'}
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

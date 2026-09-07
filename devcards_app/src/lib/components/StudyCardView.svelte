<script lang="ts">
	import { enhance } from '$app/forms';
	import { Check, Minus } from '@lucide/svelte';
	import { PreRendered } from 'carta-md';
	import Flashcard from '$lib/components/ui/Flashcard.svelte';
	import { createFlashcardFlip } from '$lib/components/ui/useFlashcard.svelte';
	import type { StudyCard } from '$lib/server/srs';
	import type { RenderedCard } from '$lib/server/render-card';

	// Local flip state — owned entirely by this component instance, so the
	// parent must recreate this component (via {#key}) whenever a new card
	// is shown, even if it happens to be the same card id as before (e.g.
	// "Again" bringing it right back).
	let {
		card,
		rendered,
		remaining,
		onSkip
	}: { card: StudyCard; rendered: RenderedCard; remaining: number; onSkip?: () => void } = $props();

	const flipHook = createFlashcardFlip();
	let flipped = $derived(flipHook.state === 'back');
</script>

<div class="flex items-center justify-between">
	<p class="text-sm text-gray-500">Осталось карточек: {remaining}</p>
	{#if onSkip}
		<button type="button" class="text-xs text-gray-400 hover:text-gray-600 hover:underline" onclick={onSkip}>
			Пропустить →
		</button>
	{/if}
</div>

{#if rendered.kind === 'multiple_choice'}
	<!-- Doesn't flip: revealing is "show a list of options below the
	     question", not a front/back pair — the flip metaphor doesn't fit. -->
	<div class="rounded-md border border-gray-200 p-6">
		<div class="prose max-w-none">
			<PreRendered html={rendered.questionHtml} />
		</div>
		{#if flipped}
			<ul class="mt-4 flex flex-col gap-1">
				{#each rendered.options as option, i}
					<li class="flex items-center gap-1 {i === rendered.correctIndex ? 'font-medium text-green-700' : 'text-gray-600'}">
						{#if i === rendered.correctIndex}
							<Check class="size-4" aria-hidden="true" /><span class="sr-only">Верно:</span>
						{:else}
							<Minus class="size-4" aria-hidden="true" /><span class="sr-only">Неверно:</span>
						{/if}
						{option}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{:else}
	<Flashcard {flipHook} {onSkip}>
		{#snippet front()}
			<div class="h-full rounded-md border border-gray-200 p-6">
				<div class="prose max-w-none">
					<PreRendered html={rendered.kind === 'basic' ? rendered.frontHtml : rendered.maskedHtml} />
				</div>
			</div>
		{/snippet}
		{#snippet back()}
			<div class="h-full rounded-md border border-gray-200 p-6">
				<div class="prose max-w-none {rendered.kind === 'basic' ? 'text-gray-700' : ''}">
					<PreRendered html={rendered.kind === 'basic' ? rendered.backHtml : rendered.revealedHtml} />
				</div>
			</div>
		{/snippet}
	</Flashcard>
{/if}

{#if !flipped}
	<button
		type="button"
		class="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
		onclick={() => flipHook.flip('back')}
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

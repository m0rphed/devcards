<script lang="ts">
	import { enhance } from '$app/forms';
	import { PreRendered } from 'carta-md';
	import FlipCard from '$lib/components/ui/FlipCard.svelte';
	import type { StudyCard } from '$lib/server/srs';
	import type { RenderedCard } from '$lib/server/render-card';

	let { card, rendered, current, total }: { card: StudyCard; rendered: RenderedCard; current: number; total: number } =
		$props();
	let revealed = $state(false);
	// Unlike /study (pure self-assessment, no typed input — that's normal for
	// SRS), a "test" should make you actually commit to an answer first.
	let typedAnswer = $state('');
</script>

<p class="text-sm text-gray-500">Вопрос {current} из {total}</p>

{#if rendered.kind === 'multiple_choice'}
	<div class="rounded-md border border-gray-200 p-6">
		<div class="prose max-w-none">
			<PreRendered html={rendered.questionHtml} />
		</div>
	</div>
{:else}
	<!-- disabled until `revealed`: the whole point of a test (vs /study's
	     silent self-recall) is committing to an answer first — a stray
	     drag/tap on the card can't be allowed to jump straight to the
	     answer before that. Once revealed, it's a normal FlipCard (you can
	     flip back to re-read the question if you want). -->
	<FlipCard bind:flipped={revealed} disabled={!revealed}>
		{#snippet front()}
			<div class="rounded-md border border-gray-200 p-6">
				<div class="prose max-w-none">
					<PreRendered html={rendered.kind === 'basic' ? rendered.frontHtml : rendered.maskedHtml} />
				</div>
			</div>
		{/snippet}
		{#snippet back()}
			<div class="rounded-md border border-gray-200 p-6">
				{#if typedAnswer.trim()}
					<p class="text-sm text-gray-500">Твой ответ: <span class="text-gray-700">{typedAnswer}</span></p>
					<hr class="my-3 border-gray-200" />
				{/if}
				<div class="prose max-w-none {rendered.kind === 'basic' ? 'text-gray-700' : ''}">
					<PreRendered html={rendered.kind === 'basic' ? rendered.backHtml : rendered.revealedHtml} />
				</div>
			</div>
		{/snippet}
	</FlipCard>
{/if}

{#if rendered.kind === 'multiple_choice'}
	<form method="post" action="?/answer" use:enhance class="flex flex-col gap-2">
		<input type="hidden" name="cardId" value={card.id} />
		{#each rendered.options as option, i}
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
	<form
		class="flex flex-col gap-2"
		onsubmit={(e) => {
			e.preventDefault();
			revealed = true;
		}}
	>
		<label class="block text-sm">
			Твой ответ (необязательно, но лучше правда попробовать вспомнить)
			<textarea
				bind:value={typedAnswer}
				rows="2"
				class="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
				placeholder="Впиши свой ответ перед тем как посмотреть правильный..."
			></textarea>
		</label>
		<button type="submit" class="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
			Показать ответ
		</button>
	</form>
{:else}
	<form method="post" action="?/answer" use:enhance class="flex gap-2">
		<input type="hidden" name="cardId" value={card.id} />
		<input type="hidden" name="typedAnswer" value={typedAnswer} />
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

<script lang="ts">
	import { enhance } from '$app/forms';
	import { Check, X } from '@lucide/svelte';
	import { PreRendered } from 'carta-md';
	import Flashcard from '$lib/components/ui/Flashcard.svelte';
	import { createFlashcardFlip } from '$lib/components/ui/useFlashcard.svelte';
	import { CARD_COLOR_META } from '$lib/card-colors';
	import type { StudyCard } from '$lib/server/srs';
	import type { RenderedCard } from '$lib/server/render-card';

	let { card, rendered, current, total }: { card: StudyCard; rendered: RenderedCard; current: number; total: number } =
		$props();
	// Starts disabled: the whole point of a test (vs /study's silent
	// self-recall) is committing to an answer first — a stray drag/tap on
	// the card can't be allowed to jump straight to the answer before that.
	// The typed-answer form below flips this open on submit; once open, you
	// can freely flip back and forth (e.g. to re-read the question).
	const flipHook = createFlashcardFlip({ disableFlip: true });
	let revealed = $derived(flipHook.state === 'back');
	// Tints the whole face, not just a strip — border-l stays for a crisp
	// edge of full saturation, bg is the *-100 light tier so the existing
	// dark body text (unchanged) stays readable without any extra work.
	let accentClass = $derived(
		card.color ? `border-l-4 ${CARD_COLOR_META[card.color].accent} ${CARD_COLOR_META[card.color].bg}` : ''
	);
	// Unlike /study (pure self-assessment, no typed input — that's normal for
	// SRS), a "test" should make you actually commit to an answer first.
	let typedAnswer = $state('');
</script>

<p class="text-sm text-gray-500">Вопрос {current} из {total}</p>

{#if rendered.kind === 'multiple_choice'}
	<div class="rounded-md border border-gray-200 p-6 {accentClass}">
		<div class="prose max-w-none">
			<PreRendered html={rendered.questionHtml} />
		</div>
	</div>
{:else}
	<Flashcard {flipHook}>
		{#snippet front()}
			<div class="rounded-md border border-gray-200 p-6 {accentClass}">
				<div class="prose max-w-none">
					<PreRendered html={rendered.kind === 'basic' ? rendered.frontHtml : rendered.maskedHtml} />
				</div>
			</div>
		{/snippet}
		{#snippet back()}
			<div class="rounded-md border border-gray-200 p-6 {accentClass}">
				{#if typedAnswer.trim()}
					<p class="text-sm text-gray-500">Твой ответ: <span class="text-gray-700">{typedAnswer}</span></p>
					<hr class="my-3 border-gray-200" />
				{/if}
				<div class="prose max-w-none {rendered.kind === 'basic' ? 'text-gray-700' : ''}">
					<PreRendered html={rendered.kind === 'basic' ? rendered.backHtml : rendered.revealedHtml} />
				</div>
			</div>
		{/snippet}
	</Flashcard>
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
			flipHook.disableFlip = false;
			flipHook.flip('back');
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
	<!-- Sized to content (not flex-1/full-width) and centered — a plain
	     yes/no pair reads as oversized when stretched across a card-width
	     row; an icon carries most of the meaning at a glance, the label is
	     there for clarity/screen readers rather than to fill space. -->
	<form method="post" action="?/answer" use:enhance class="flex justify-center gap-3">
		<input type="hidden" name="cardId" value={card.id} />
		<input type="hidden" name="typedAnswer" value={typedAnswer} />
		<button
			name="selfReported"
			value="incorrect"
			class="flex items-center gap-1.5 rounded-md bg-red-600 px-5 py-2 text-sm text-white hover:bg-red-700"
		>
			<X class="size-4" aria-hidden="true" />
			Неверно
		</button>
		<button
			name="selfReported"
			value="correct"
			class="flex items-center gap-1.5 rounded-md bg-green-600 px-5 py-2 text-sm text-white hover:bg-green-700"
		>
			<Check class="size-4" aria-hidden="true" />
			Верно
		</button>
	</form>
{/if}

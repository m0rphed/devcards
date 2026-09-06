<script lang="ts">
	import { enhance } from '$app/forms';
	import { PreRendered } from 'carta-md';
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

<div class="rounded-md border border-gray-200 p-6">
	{#if rendered.kind === 'multiple_choice'}
		<div class="prose max-w-none">
			<PreRendered html={rendered.questionHtml} />
		</div>
	{:else if rendered.kind === 'basic'}
		<div class="prose max-w-none">
			<PreRendered html={rendered.frontHtml} />
		</div>
		{#if revealed}
			<hr class="my-4 border-gray-200" />
			{#if typedAnswer.trim()}
				<p class="text-sm text-gray-500">Твой ответ: <span class="text-gray-700">{typedAnswer}</span></p>
			{/if}
			<div class="prose max-w-none text-gray-700">
				<PreRendered html={rendered.backHtml} />
			</div>
		{/if}
	{:else}
		<div class="prose max-w-none">
			<PreRendered html={revealed ? rendered.revealedHtml : rendered.maskedHtml} />
		</div>
		{#if revealed && typedAnswer.trim()}
			<p class="mt-2 text-sm text-gray-500">Твой ответ: <span class="text-gray-700">{typedAnswer}</span></p>
		{/if}
	{/if}
</div>

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

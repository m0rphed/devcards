<script lang="ts">
	import { enhance } from '$app/forms';
	import { PreRendered } from 'carta-md';
	import type { StudyCard } from '$lib/server/srs';
	import type { RenderedCard } from '$lib/server/render-card';

	let { card, rendered, current, total }: { card: StudyCard; rendered: RenderedCard; current: number; total: number } =
		$props();
	let revealed = $state(false);
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
			<div class="prose max-w-none text-gray-700">
				<PreRendered html={rendered.backHtml} />
			</div>
		{/if}
	{:else}
		<div class="prose max-w-none">
			<PreRendered html={revealed ? rendered.revealedHtml : rendered.maskedHtml} />
		</div>
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

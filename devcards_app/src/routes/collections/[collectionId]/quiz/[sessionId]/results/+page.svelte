<script lang="ts">
	import { PreRendered } from 'carta-md';
	import { ArrowLeft, Check, X } from '@lucide/svelte';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();
	const pct = $derived(Math.round((100 * (data.session.score ?? 0)) / data.session.totalQuestions));
</script>

<div class="flex flex-col gap-6">
	<a href="/collections/{data.collection.id}" class="flex w-fit items-center gap-1 text-sm text-blue-600 hover:underline">
		<ArrowLeft class="size-4" aria-hidden="true" /> {data.collection.title}
	</a>

	<div class="rounded-md border border-gray-200 p-6 text-center">
		<p class="text-3xl font-semibold">{data.session.score} / {data.session.totalQuestions}</p>
		<p class="mt-1 text-sm text-gray-500">{pct}% правильных ответов</p>
	</div>

	<div>
		<h2 class="mb-3 text-lg font-semibold">Разбор ответов</h2>
		<ul class="flex flex-col gap-2">
			{#each data.attempts as { attempt, rendered } (attempt.id)}
				<li class="rounded-md border p-4 {attempt.isCorrect ? 'border-green-200' : 'border-red-200'}">
					<span class="flex items-center gap-1 text-xs {attempt.isCorrect ? 'text-green-700' : 'text-red-700'}">
						{#if attempt.isCorrect}
							<Check class="size-3.5" aria-hidden="true" /> верно
						{:else}
							<X class="size-3.5" aria-hidden="true" /> неверно
						{/if}
					</span>

					{#if rendered.kind === 'basic'}
						{@const given = attempt.givenAnswer as { typed_answer: string | null }}
						<div class="prose prose-sm mt-1 max-w-none">
							<span class="text-xs text-gray-500">Q:</span>
							<PreRendered html={rendered.frontHtml} />
						</div>
						{#if given.typed_answer}
							<p class="text-sm text-gray-500">Твой ответ: <span class="text-gray-700">{given.typed_answer}</span></p>
						{/if}
						<div class="prose prose-sm max-w-none">
							<span class="text-xs text-gray-500">A:</span>
							<PreRendered html={rendered.backHtml} />
						</div>
					{:else if rendered.kind === 'cloze'}
						{@const given = attempt.givenAnswer as { typed_answer: string | null }}
						{#if given.typed_answer}
							<p class="mt-1 text-sm text-gray-500">Твой ответ: <span class="text-gray-700">{given.typed_answer}</span></p>
						{/if}
						<div class="prose prose-sm mt-1 max-w-none">
							<PreRendered html={rendered.revealedHtml} />
						</div>
					{:else}
						{@const given = attempt.givenAnswer as { selected_index: number }}
						<div class="prose prose-sm mt-1 max-w-none">
							<PreRendered html={rendered.questionHtml} />
						</div>
						<p class="text-sm text-gray-500">Твой ответ: {rendered.options[given.selected_index]}</p>
						{#if !attempt.isCorrect}
							<p class="text-sm text-green-700">Правильный: {rendered.options[rendered.correctIndex]}</p>
						{/if}
					{/if}
				</li>
			{/each}
		</ul>
	</div>

	<a
		href="/collections/{data.collection.id}/quiz"
		class="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
	>
		Пройти ещё раз
	</a>
</div>

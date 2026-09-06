<script lang="ts">
	import { enhance } from '$app/forms';
	import { MarkdownEditor } from 'carta-md';
	import 'carta-md/default.css';
	import { carta } from '$lib/markdown';

	type CardType = 'basic' | 'cloze' | 'multiple_choice';
	type CardContent =
		| { front: string; back: string }
		| { text: string }
		| { question: string; options: string[]; correct_index: number };

	let {
		formAction,
		initialType = 'basic',
		initialContent,
		initialTags = [],
		submitLabel = 'Сохранить',
		onSuccess
	}: {
		formAction: string;
		initialType?: CardType;
		initialContent?: CardContent;
		initialTags?: string[];
		submitLabel?: string;
		onSuccess?: () => void;
	} = $props();

	// initialContent's shape always matches initialType by construction (see callers) —
	// a runtime cast here is simpler than re-deriving the union narrowing for a
	// props-only editing convenience.
	const seed = initialContent as
		| { front?: string; back?: string; text?: string; question?: string; options?: string[]; correct_index?: number }
		| undefined;

	let type = $state<CardType>(initialType);
	let front = $state(seed?.front ?? '');
	let back = $state(seed?.back ?? '');
	let clozeText = $state(seed?.text ?? '');
	let question = $state(seed?.question ?? '');
	let options = $state<string[]>(seed?.options ? [...seed.options] : ['', '']);
	let correctIndex = $state(seed?.correct_index ?? 0);
	let tagsInput = $state(initialTags.join(', '));

	let errorMessage = $state('');

	function addOption() {
		options.push('');
	}
	function removeOption(i: number) {
		options.splice(i, 1);
		if (correctIndex >= options.length) correctIndex = options.length - 1;
	}
</script>

<form
	method="post"
	action={formAction}
	use:enhance={() => {
		errorMessage = '';
		return async ({ result, update }) => {
			if (result.type === 'failure') {
				errorMessage = (result.data?.message as string | undefined) ?? 'Ошибка';
			} else if (result.type === 'success') {
				onSuccess?.();
			}
			await update();
		};
	}}
	class="flex flex-col gap-3"
>
	<label class="block text-sm">
		Тип
		<select name="type" bind:value={type} class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
			<option value="basic">Вопрос/ответ</option>
			<option value="cloze">Пропуск в тексте</option>
			<option value="multiple_choice">Выбор варианта</option>
		</select>
	</label>

	{#if type === 'basic'}
		<div class="text-sm">
			<span>Лицевая сторона (markdown)</span>
			<div class="mt-1">
				<MarkdownEditor {carta} bind:value={front} mode="tabs" textarea={{ name: 'front', required: true }} />
			</div>
		</div>
		<div class="text-sm">
			<span>Обратная сторона (markdown)</span>
			<div class="mt-1">
				<MarkdownEditor {carta} bind:value={back} mode="tabs" textarea={{ name: 'back', required: true }} />
			</div>
		</div>
	{:else if type === 'cloze'}
		<div class="text-sm">
			<span>Текст с пропуском (например: «горутины дешевле, чем {'{{c1::потоки ОС}}'}», markdown)</span>
			<div class="mt-1">
				<MarkdownEditor {carta} bind:value={clozeText} mode="tabs" textarea={{ name: 'text', required: true }} />
			</div>
		</div>
	{:else}
		<div class="text-sm">
			<span>Вопрос (markdown)</span>
			<div class="mt-1">
				<MarkdownEditor {carta} bind:value={question} mode="tabs" textarea={{ name: 'question', required: true }} />
			</div>
		</div>
		<div class="flex flex-col gap-2">
			<span class="text-sm">Варианты ответа (отметь правильный)</span>
			{#each options as _, i}
				<div class="flex items-center gap-2">
					<input
						type="radio"
						name="correct_index"
						value={i}
						checked={correctIndex === i}
						onchange={() => (correctIndex = i)}
					/>
					<input
						name="options"
						bind:value={options[i]}
						required
						placeholder="Вариант {i + 1}"
						class="flex-1 rounded-md border-gray-300 shadow-sm"
					/>
					{#if options.length > 2}
						<button type="button" class="text-xs text-red-600" onclick={() => removeOption(i)}>✕</button>
					{/if}
				</div>
			{/each}
			<button type="button" class="w-fit text-sm text-blue-600 hover:underline" onclick={addOption}>+ вариант</button>
		</div>
	{/if}

	<label class="block text-sm">
		Теги (через запятую)
		<input
			name="tags"
			bind:value={tagsInput}
			placeholder="go, concurrency"
			class="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
		/>
	</label>

	{#if errorMessage}
		<p class="text-sm text-red-600">{errorMessage}</p>
	{/if}

	<button class="w-fit rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">{submitLabel}</button>
</form>

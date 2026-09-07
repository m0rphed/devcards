<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { RadioGroup } from 'bits-ui';
	import { X } from '@lucide/svelte';
	import { MarkdownEditor } from 'carta-md';
	import 'carta-md/default.css';
	import '@cartamd/plugin-attachment/default.css';
	import { createEditorCarta } from '$lib/markdown';
	import Select from '$lib/components/ui/Select.svelte';
	import { CARD_COLORS, CARD_COLOR_META, isCardColor } from '$lib/card-colors';

	const TYPE_OPTIONS = [
		{ value: 'basic', label: 'Вопрос/ответ' },
		{ value: 'cloze', label: 'Пропуск в тексте' },
		{ value: 'multiple_choice', label: 'Выбор варианта' }
	];

	// One Carta instance *per editor widget* — never shared, even between
	// fields of the same form. See createEditorCarta's doc comment: Carta
	// tracks "the currently registered editor" as instance state, so two
	// simultaneously-mounted editors sharing one instance means the second
	// (e.g. "back") silently steals the first's ("front") toolbar/caret
	// targeting. Only one of these 4 is ever actually rendered at a time
	// except front+back (both shown together for "basic"), which is exactly
	// the case that needs this.
	const frontCarta = createEditorCarta();
	const backCarta = createEditorCarta();
	const clozeCarta = createEditorCarta();
	const questionCarta = createEditorCarta();

	type CardType = 'basic' | 'cloze' | 'multiple_choice';
	type CardContent =
		| { front: string; back: string }
		| { text: string }
		| { question: string; options: string[]; correct_index: number };

	let {
		formAction,
		initialType = 'basic',
		initialContent,
		initialColor = null,
		initialTags = [],
		submitLabel = 'Сохранить',
		onSuccess
	}: {
		formAction: string;
		initialType?: CardType;
		initialContent?: CardContent;
		initialColor?: string | null;
		initialTags?: string[];
		submitLabel?: string;
		onSuccess?: () => void;
	} = $props();

	// Stable per-instance id for wiring <label for> to carta-md's editor
	// (it doesn't render as a plain <label>-friendly control on its own).
	const uid = $props.id();

	// initialContent's shape always matches initialType by construction (see callers) —
	// a runtime cast here is simpler than re-deriving the union narrowing for a
	// props-only editing convenience.
	const seed = untrack(() => initialContent) as
		| { front?: string; back?: string; text?: string; question?: string; options?: string[]; correct_index?: number }
		| undefined;

	// untrack(): these are deliberately one-time snapshots to seed local
	// editable state, not meant to track later prop changes (editing a field
	// shouldn't get clobbered if the parent happens to re-pass initial*).
	let type = $state<CardType>(untrack(() => initialType));
	let front = $state(untrack(() => seed?.front) ?? '');
	let back = $state(untrack(() => seed?.back) ?? '');
	let clozeText = $state(untrack(() => seed?.text) ?? '');
	let question = $state(untrack(() => seed?.question) ?? '');
	let options = $state<string[]>(untrack(() => (seed?.options ? [...seed.options] : ['', ''])));
	// String, not number: this is bits-ui RadioGroup's bound value (its own
	// hidden input, and thus form submission, works in terms of strings) —
	// converted to a number only where the actual index arithmetic needs it.
	let correctIndex = $state(String(untrack(() => seed?.correct_index) ?? 0));
	// 'none' rather than '' — an empty-string RadioGroup value is easy to
	// confuse with "nothing selected"; 'none' round-trips through the form
	// unambiguously, and parseCardColor treats it the same as absent/invalid.
	let color = $state(untrack(() => (isCardColor(initialColor) ? initialColor : 'none')));
	let tagsInput = $state(untrack(() => initialTags.join(', ')));

	let errorMessage = $state('');

	function addOption() {
		options.push('');
	}
	function removeOption(i: number) {
		options.splice(i, 1);
		if (Number(correctIndex) >= options.length) correctIndex = String(options.length - 1);
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
	<label for="{uid}-type" class="block text-sm">
		Тип
		<div class="mt-1">
			<Select id="{uid}-type" name="type" bind:value={type} options={TYPE_OPTIONS} />
		</div>
	</label>

	<div class="text-sm">
		<span id="{uid}-color-label">Цвет карточки</span>
		<!-- display:contents: same reasoning as the correct-answer RadioGroup
		     below — wrap every swatch for roving-focus/keyboard behavior
		     without disturbing the flex row's own layout. -->
		<RadioGroup.Root
			bind:value={color}
			name="color"
			aria-labelledby="{uid}-color-label"
			class="mt-1.5 contents"
		>
			<div class="flex flex-wrap items-center gap-2">
				<!-- transition-transform + active:scale-95: a small press-down
				     feel on click, same idea as the sv-animations "color-selector"
				     spell's active:scale-90 (kept a bit more subtle here). -->
				<RadioGroup.Item
					value="none"
					aria-label="Без цвета"
					class="size-6 shrink-0 rounded-full border-2 border-dashed border-gray-300 bg-white transition-transform active:scale-95 data-[state=checked]:ring-2 data-[state=checked]:ring-gray-400 data-[state=checked]:ring-offset-2"
				/>
				{#each CARD_COLORS as c}
					<RadioGroup.Item
						value={c}
						aria-label={CARD_COLOR_META[c].label}
						class="size-6 shrink-0 rounded-full {CARD_COLOR_META[c].dot} {CARD_COLOR_META[
							c
						].ring} transition-transform active:scale-95 data-[state=checked]:ring-2 data-[state=checked]:ring-offset-2"
					/>
				{/each}
			</div>
		</RadioGroup.Root>
	</div>

	{#if type === 'basic'}
		<div class="text-sm">
			<label for="{uid}-front">Лицевая сторона (markdown)</label>
			<div class="mt-1">
				<MarkdownEditor
					carta={frontCarta}
					bind:value={front}
					mode="tabs"
					textarea={{ name: 'front', id: `${uid}-front`, required: true }}
				/>
			</div>
		</div>
		<div class="text-sm">
			<label for="{uid}-back">Обратная сторона (markdown)</label>
			<div class="mt-1">
				<MarkdownEditor
					carta={backCarta}
					bind:value={back}
					mode="tabs"
					textarea={{ name: 'back', id: `${uid}-back`, required: true }}
				/>
			</div>
		</div>
	{:else if type === 'cloze'}
		<div class="text-sm">
			<label for="{uid}-text">Текст с пропуском (например: «горутины дешевле, чем {'{{c1::потоки ОС}}'}», markdown)</label>
			<div class="mt-1">
				<MarkdownEditor
					carta={clozeCarta}
					bind:value={clozeText}
					mode="tabs"
					textarea={{ name: 'text', id: `${uid}-text`, required: true }}
				/>
			</div>
		</div>
	{:else}
		<div class="text-sm">
			<label for="{uid}-question">Вопрос (markdown)</label>
			<div class="mt-1">
				<MarkdownEditor
					carta={questionCarta}
					bind:value={question}
					mode="tabs"
					textarea={{ name: 'question', id: `${uid}-question`, required: true }}
				/>
			</div>
		</div>
		<div class="flex flex-col gap-2">
			<span class="text-sm">Варианты ответа (отметь правильный)</span>
			<!-- display:contents: a real RadioGroup.Root needs to wrap every
			     item for correct roving-focus/keyboard behavior, but shouldn't
			     interfere with the existing per-row flex layout below. -->
			<RadioGroup.Root bind:value={correctIndex} name="correct_index" class="contents">
				{#each options as _, i}
					<div class="flex items-center gap-2">
						<RadioGroup.Item
							value={String(i)}
							aria-label="Отметить вариант {i + 1} как правильный"
							class="size-4 shrink-0 rounded-full border border-gray-300 data-[state=checked]:border-[5px] data-[state=checked]:border-blue-600"
						/>
						<input
							name="options"
							bind:value={options[i]}
							required
							placeholder="Вариант {i + 1}"
							class="flex-1 rounded-md border-gray-300 shadow-sm"
						/>
						{#if options.length > 2}
							<button
								type="button"
								class="text-red-600"
								onclick={() => removeOption(i)}
								aria-label="Удалить вариант {i + 1}"
							>
								<X class="size-3.5" aria-hidden="true" />
							</button>
						{/if}
					</div>
				{/each}
			</RadioGroup.Root>
			<button type="button" class="w-fit text-sm text-blue-600 hover:underline" onclick={addOption}>+ вариант</button>
		</div>
	{/if}

	<label for="{uid}-tags" class="block text-sm">
		Теги (через запятую)
		<input
			id="{uid}-tags"
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

<script lang="ts">
	import { enhance } from '$app/forms';
	import { PreRendered } from 'carta-md';
	import CardForm from '$lib/components/CardForm.svelte';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	let showAddCard = $state(false);
	let showSettings = $state(false);
	let showShare = $state(false);

	let canEdit = $derived(data.role === 'owner' || data.role === 'editor');
	let isOwner = $derived(data.role === 'owner');

	function cardTypeLabel(type: string) {
		return { basic: 'Вопрос/ответ', cloze: 'Пропуск в тексте', multiple_choice: 'Выбор варианта' }[type] ?? type;
	}

	const STATE_LABELS: Record<string, string> = {
		new: 'Новые',
		learning: 'Изучение',
		review: 'Повторение',
		relearning: 'Пересдача'
	};
	// Fixed order (not whatever collection_progress happens to return rows
	// in) so the widget doesn't reshuffle between visits.
	const STATE_ORDER = ['new', 'learning', 'review', 'relearning'];
	let orderedProgress = $derived(
		STATE_ORDER.map((state) => data.progress.find((p) => p.state === state) ?? { state, cardCount: 0, dueCount: 0 })
	);
	let totalDue = $derived(data.progress.reduce((sum, p) => sum + p.dueCount, 0));

	function tagHref(tagName: string) {
		const params = new URLSearchParams();
		if (data.searchQuery) params.set('q', data.searchQuery);
		if (data.tagFilter !== tagName) params.set('tag', tagName);
		const qs = params.toString();
		return `/collections/${data.collection.id}${qs ? `?${qs}` : ''}`;
	}
</script>

<div class="flex flex-col gap-8">
	<div>
		<div class="flex items-start justify-between">
			<div>
				<h1 class="text-xl font-semibold">
					{data.collection.title}
					{#if data.collection.isPublic}
						<span class="ml-2 rounded bg-green-100 px-1.5 py-0.5 align-middle text-xs text-green-700">публичная</span>
					{/if}
					<span class="ml-2 rounded bg-gray-100 px-1.5 py-0.5 align-middle text-xs text-gray-600">{data.role}</span>
				</h1>
				{#if data.collection.description}
					<p class="mt-1 text-sm text-gray-500">{data.collection.description}</p>
				{/if}
			</div>
			{#if isOwner}
				<button type="button" class="text-sm text-blue-600 hover:underline" onclick={() => (showSettings = !showSettings)}>
					{showSettings ? 'Скрыть настройки' : 'Настройки'}
				</button>
			{/if}
		</div>

		{#if isOwner && showSettings}
			<div class="mt-4 flex flex-col gap-4 rounded-md border border-gray-200 p-4">
				<form method="post" action="?/updateCollection" use:enhance class="flex flex-col gap-3">
					<label class="block text-sm">
						Название
						<input
							name="title"
							required
							value={data.collection.title}
							class="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
						/>
					</label>
					<label class="block text-sm">
						Описание
						<textarea name="description" rows="2" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
							>{data.collection.description ?? ''}</textarea
						>
					</label>
					<label class="flex items-center gap-2 text-sm">
						<input type="checkbox" name="isPublic" checked={data.collection.isPublic} class="rounded border-gray-300" />
						Публичная
					</label>
					{#if form?.message}<p class="text-sm text-red-600">{form.message}</p>{/if}
					<button class="w-fit rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">Сохранить</button>
				</form>

				<form
					method="post"
					action="?/deleteCollection"
					use:enhance
					onsubmit={(e) => {
						if (!confirm('Удалить коллекцию вместе со всеми карточками?')) e.preventDefault();
					}}
				>
					<button class="w-fit rounded-md border border-red-300 px-4 py-1.5 text-sm text-red-600 hover:bg-red-50">
						Удалить коллекцию
					</button>
				</form>

				<div>
					<button type="button" class="text-sm text-blue-600 hover:underline" onclick={() => (showShare = !showShare)}>
						{showShare ? 'Скрыть шеринг' : 'Расшарить коллекцию'}
					</button>
					{#if showShare}
						<div class="mt-3 flex flex-col gap-3">
							{#if data.shares.length > 0}
								<ul class="flex flex-col gap-1 text-sm">
									{#each data.shares as s (s.userId)}
										<li class="flex items-center justify-between rounded-md border border-gray-200 px-3 py-1.5">
											<span>{s.name} ({s.email}) — {s.role}</span>
											<form method="post" action="?/revokeAccess" use:enhance>
												<input type="hidden" name="userId" value={s.userId} />
												<button class="text-xs text-red-600 hover:underline">Отозвать</button>
											</form>
										</li>
									{/each}
								</ul>
							{/if}
							<form method="post" action="?/share" use:enhance class="flex items-end gap-2">
								<label class="block text-sm">
									Email пользователя
									<input name="email" type="email" required class="mt-1 block rounded-md border-gray-300 shadow-sm" />
								</label>
								<label class="block text-sm">
									Роль
									<select name="role" class="mt-1 block rounded-md border-gray-300 shadow-sm">
										<option value="viewer">viewer</option>
										<option value="editor">editor</option>
									</select>
								</label>
								<button class="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">Дать доступ</button>
							</form>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	{#if data.cards.length > 0}
		<div class="flex flex-col gap-3">
			<div class="flex gap-2">
				<a
					href="/collections/{data.collection.id}/study"
					class="w-fit rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
				>
					▶ Учить{totalDue > 0 ? ` (${totalDue})` : ''}
				</a>
				<a
					href="/collections/{data.collection.id}/quiz"
					class="w-fit rounded-md bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700"
				>
					📝 Тест
				</a>
			</div>

			<!-- Per-FSRS-state breakdown, from collection_progress() — see
			     $lib/server/stats.ts. Cards with no review_state row at all
			     (never studied) come back bucketed as 'new' by the function
			     itself, not here. -->
			<div class="flex flex-wrap gap-2 text-xs">
				{#each orderedProgress as p (p.state)}
					{#if p.cardCount > 0}
						<span class="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">
							{STATE_LABELS[p.state]}: {p.cardCount}
							{#if p.dueCount > 0}
								<span class="font-medium text-green-700">(due {p.dueCount})</span>
							{/if}
						</span>
					{/if}
				{/each}
			</div>
		</div>
	{/if}

	<div>
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-lg font-semibold">Карточки ({data.cards.length})</h2>
			{#if canEdit}
				<button
					type="button"
					class="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
					onclick={() => (showAddCard = !showAddCard)}
				>
					{showAddCard ? 'Отмена' : '+ Карточка'}
				</button>
			{/if}
		</div>

		{#if showAddCard}
			<div class="mb-4 rounded-md border border-gray-200 p-4">
				<CardForm formAction="?/createCard" submitLabel="Добавить" onSuccess={() => (showAddCard = false)} />
			</div>
		{/if}

		<form method="get" class="mb-3 flex gap-2">
			<input
				type="search"
				name="q"
				value={data.searchQuery}
				placeholder="Поиск по карточкам…"
				class="flex-1 rounded-md border-gray-300 text-sm shadow-sm"
			/>
			{#if data.tagFilter}
				<input type="hidden" name="tag" value={data.tagFilter} />
			{/if}
			<button class="rounded-md bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-900">Искать</button>
			{#if data.searchQuery || data.tagFilter}
				<a
					href="/collections/{data.collection.id}"
					class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
				>
					Сбросить
				</a>
			{/if}
		</form>

		{#if data.allTags.length > 0}
			<div class="mb-4 flex flex-wrap gap-1.5">
				{#each data.allTags as tagName}
					<a
						href={tagHref(tagName)}
						class="rounded-full px-2.5 py-0.5 text-xs {data.tagFilter === tagName
							? 'bg-blue-600 text-white'
							: 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
					>
						#{tagName}
					</a>
				{/each}
			</div>
		{/if}

		{#if data.cards.length === 0}
			<p class="text-sm text-gray-500">
				{data.searchQuery || data.tagFilter ? 'Ничего не найдено.' : 'В коллекции пока нет карточек.'}
			</p>
		{:else}
			<ul class="flex flex-col gap-2">
				{#each data.cards as card (card.id)}
					<li class="rounded-md border border-gray-200 p-4">
						<div class="mb-1 flex items-center justify-between">
							<span class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{cardTypeLabel(card.type)}</span>
							{#if canEdit}
								<div class="flex items-center gap-3 text-xs">
									<a href="/collections/{data.collection.id}/cards/{card.id}" class="text-blue-600 hover:underline">
										Изменить
									</a>
									<form
										method="post"
										action="?/deleteCard"
										use:enhance
										onsubmit={(e) => {
											if (!confirm('Удалить карточку?')) e.preventDefault();
										}}
									>
										<input type="hidden" name="cardId" value={card.id} />
										<button class="text-red-600 hover:underline">Удалить</button>
									</form>
								</div>
							{/if}
						</div>

						{#if card.rendered.kind === 'basic'}
							<div class="prose prose-sm max-w-none">
								<span class="text-xs text-gray-500">Q:</span>
								<PreRendered html={card.rendered.frontHtml} />
							</div>
							<div class="prose prose-sm max-w-none">
								<span class="text-xs text-gray-500">A:</span>
								<PreRendered html={card.rendered.backHtml} />
							</div>
						{:else if card.rendered.kind === 'cloze'}
							<div class="prose prose-sm max-w-none">
								<PreRendered html={card.rendered.revealedHtml} />
							</div>
						{:else}
							<div class="prose prose-sm max-w-none">
								<PreRendered html={card.rendered.questionHtml} />
							</div>
							<ul class="mt-1 text-sm">
								{#each card.rendered.options as option, i}
									<li class={i === card.rendered.correctIndex ? 'font-medium text-green-700' : 'text-gray-600'}>
										{i === card.rendered.correctIndex ? '✓' : '—'}
										{option}
									</li>
								{/each}
							</ul>
						{/if}

						{#if data.tagsByCard[card.id]?.length}
							<div class="mt-2 flex flex-wrap gap-1">
								{#each data.tagsByCard[card.id] as tagName}
									<a
										href={tagHref(tagName)}
										class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-200"
									>
										#{tagName}
									</a>
								{/each}
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { Collapsible } from 'bits-ui';
	import { PreRendered } from 'carta-md';
	import { Check, ClipboardList, Minus, Play, Star } from '@lucide/svelte';
	import CardForm from '$lib/components/CardForm.svelte';
	import CollectionAppearanceFields from '$lib/components/CollectionAppearanceFields.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import StarRating from '$lib/components/ui/StarRating.svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import Disclosure from '$lib/components/ui/Disclosure.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import { CARD_COLOR_META } from '$lib/card-colors';
	import type { ActionData, PageServerData } from './$types';

	const SHARE_ROLE_OPTIONS = [
		{ value: 'viewer', label: 'viewer' },
		{ value: 'editor', label: 'editor' }
	];
	let shareRole = $state('viewer');

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
				{#if data.ratingSummary}
					<p class="mt-1 flex items-center gap-1 text-sm text-gray-500">
						<Star class="size-4" fill="currentColor" aria-hidden="true" />
						{data.ratingSummary.avgRating.toFixed(1)} ({data.ratingSummary.ratingCount})
					</p>
				{/if}
				{#if data.forkSource}
					<p class="mt-1 text-xs text-gray-400">
						Скопировано из «{data.forkSource.title}»
						{#if data.forkSource.isStale}<span class="text-amber-600">— в оригинале есть изменения</span>{/if}
					</p>
				{/if}
			</div>
			<div class="flex items-center gap-3">
				{#if !isOwner && data.isSubscribed}
					<form method="post" action="?/leave" use:enhance>
						<button class="text-sm text-gray-600 hover:underline">Отписаться</button>
					</form>
				{:else if !isOwner && data.collection.isPublic}
					<form method="post" action="?/subscribe" use:enhance>
						<button class="text-sm text-blue-600 hover:underline">Добавить себе</button>
					</form>
				{/if}
				{#if !isOwner}
					<form method="post" action="?/fork" use:enhance>
						<button class="text-sm text-blue-600 hover:underline">Скопировать себе</button>
					</form>
				{/if}
			</div>
		</div>

		{#if isOwner}
			<Disclosure bind:open={showSettings}>
				{#snippet trigger(open)}{open ? 'Скрыть настройки' : 'Настройки'}{/snippet}
				<div class="flex flex-col gap-4 rounded-md border border-gray-200 p-4">
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
						<CollectionAppearanceFields initialColor={data.collection.color} initialIcon={data.collection.icon} />
						{#if form?.message}<p class="text-sm text-red-600">{form.message}</p>{/if}
						<button class="w-fit rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">Сохранить</button>
					</form>

					<form id="delete-collection-form" method="post" action="?/deleteCollection" use:enhance></form>
					<ConfirmDialog
						formId="delete-collection-form"
						title="Удалить коллекцию?"
						triggerClass="w-fit rounded-md border border-red-300 px-4 py-1.5 text-sm text-red-600 hover:bg-red-50"
					>
						{#snippet trigger()}Удалить коллекцию{/snippet}
						{#snippet description()}
							Коллекция содержит {data.deletionImpact?.cardCount ?? data.cards.length} карточек. Это необратимо.
							{#if data.deletionImpact?.studierCount}
								<br />Эту коллекцию также изучают ещё {data.deletionImpact.studierCount} пользователь(ей) — их прогресс
								тоже будет удалён.
							{/if}
						{/snippet}
					</ConfirmDialog>

					<Disclosure bind:open={showShare}>
						{#snippet trigger(open)}{open ? 'Скрыть шеринг' : 'Расшарить коллекцию'}{/snippet}
						<div class="flex flex-col gap-3">
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
									<div class="mt-1">
										<Select bind:value={shareRole} name="role" options={SHARE_ROLE_OPTIONS} />
									</div>
								</label>
								<button class="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">Дать доступ</button>
							</form>
						</div>
					</Disclosure>
				</div>
			</Disclosure>
		{/if}
	</div>

	{#if data.cards.length > 0}
		<div class="flex flex-col gap-3">
			<div class="flex gap-2">
				<a
					href="/collections/{data.collection.id}/study"
					class="flex w-fit items-center gap-1.5 rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
				>
					<Play class="size-4" fill="currentColor" aria-hidden="true" /> Учить{totalDue > 0
						? ` (${totalDue})`
						: ''}
				</a>
				<a
					href="/collections/{data.collection.id}/quiz"
					class="flex w-fit items-center gap-1.5 rounded-md bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700"
				>
					<ClipboardList class="size-4" aria-hidden="true" /> Тест
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
		<!-- Collapsible used directly (not the generic Disclosure wrapper):
		     the trigger button needs to sit in this header's flex row next to
		     the "Карточки (N)" title, with content appearing as a new block
		     below — Disclosure's wrapper assumes trigger and content are
		     simply sequential, which doesn't fit this particular layout. -->
		<Collapsible.Root bind:open={showAddCard}>
			<div class="mb-3 flex items-center justify-between">
				<h2 class="text-lg font-semibold">Карточки ({data.cards.length})</h2>
				{#if canEdit}
					<Collapsible.Trigger class="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">
						{showAddCard ? 'Отмена' : '+ Карточка'}
					</Collapsible.Trigger>
				{/if}
			</div>
			<Collapsible.Content>
				<div class="mb-4 rounded-md border border-gray-200 p-4">
					<CardForm formAction="?/createCard" submitLabel="Добавить" onSuccess={() => (showAddCard = false)} />
				</div>
			</Collapsible.Content>
		</Collapsible.Root>

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
					<li
						class="rounded-md border border-gray-200 p-4 {card.color
							? `border-l-4 ${CARD_COLOR_META[card.color].accent}`
							: ''}"
					>
						<div class="mb-1 flex items-center justify-between">
							<div class="flex items-center gap-1.5">
								<span class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{cardTypeLabel(card.type)}</span>
								{#if card.color}
									<span
										class="size-2.5 rounded-full {CARD_COLOR_META[card.color].dot}"
										aria-label={CARD_COLOR_META[card.color].label}
									></span>
								{/if}
							</div>
							{#if canEdit}
								<div class="flex items-center gap-3 text-xs">
									<a href="/collections/{data.collection.id}/cards/{card.id}" class="text-blue-600 hover:underline">
										Изменить
									</a>
									<form id="delete-card-form-{card.id}" method="post" action="?/deleteCard" use:enhance>
										<input type="hidden" name="cardId" value={card.id} />
									</form>
									<ConfirmDialog
										formId="delete-card-form-{card.id}"
										title="Удалить карточку?"
										triggerClass="text-red-600 hover:underline"
									>
										{#snippet trigger()}Удалить{/snippet}
										{#snippet description()}
											Вся история повторений по ней тоже удалится.
											{#if card.otherStudierCount > 0}
												<br />Её также изучают ещё {card.otherStudierCount} пользователь(ей) — их прогресс тоже будет
												удалён.
											{/if}
										{/snippet}
									</ConfirmDialog>
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
									<li
										class="flex items-center gap-1 {i === card.rendered.correctIndex
											? 'font-medium text-green-700'
											: 'text-gray-600'}"
									>
										{#if i === card.rendered.correctIndex}
											<Check class="size-4" aria-hidden="true" /><span class="sr-only">Верно:</span>
										{:else}
											<Minus class="size-4" aria-hidden="true" /><span class="sr-only">Неверно:</span>
										{/if}
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

	<div class="flex flex-col gap-4 border-t border-gray-200 pt-6">
		<div>
			<h2 class="mb-2 text-lg font-semibold">Оценка</h2>
			<div class="flex items-center gap-3">
				<StarRating value={data.myRating} rateAction="?/rate" unrateAction="?/unrate" />
				{#if data.ratingSummary}
					<span class="text-sm text-gray-500">
						среднее {data.ratingSummary.avgRating.toFixed(1)} ({data.ratingSummary.ratingCount})
					</span>
				{/if}
			</div>
		</div>

		<div>
			<h2 class="mb-2 text-lg font-semibold">Комментарии ({data.comments.length})</h2>
			<form method="post" action="?/addComment" use:enhance class="mb-3 flex gap-2">
				<input
					name="body"
					required
					placeholder="Написать комментарий…"
					class="flex-1 rounded-md border-gray-300 text-sm shadow-sm"
				/>
				<button class="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">Отправить</button>
			</form>
			{#if data.comments.length > 0}
				<ul class="flex flex-col gap-2">
					{#each data.comments as c (c.id)}
						<li class="rounded-md border border-gray-200 p-3 text-sm">
							<div class="mb-1 flex items-center justify-between">
								<a href="/users/{c.authorId}" class="flex items-center gap-1.5 font-medium text-gray-900 hover:underline">
									<Avatar src={c.authorImage} name={c.authorName} size="sm" />
									{c.authorName}
								</a>
								{#if c.authorId === data.myUserId || isOwner}
									<form method="post" action="?/deleteComment" use:enhance>
										<input type="hidden" name="commentId" value={c.id} />
										<button class="text-xs text-red-600 hover:underline">Удалить</button>
									</form>
								{/if}
							</div>
							<p class="text-gray-700">{c.body}</p>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>

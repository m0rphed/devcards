<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();
</script>

<div class="mx-auto flex max-w-sm flex-col gap-6 py-12">
	<h1 class="text-center text-2xl font-semibold">Новый пароль</h1>

	{#if form?.done}
		<div class="rounded-md border border-gray-200 p-4 text-center text-sm">
			<p class="font-medium">Пароль обновлён ✓</p>
			<p class="mt-1 text-gray-500">Все остальные сессии на аккаунте разлогинены на всякий случай.</p>
		</div>
		<a href="/login" class="w-full rounded-md bg-blue-600 py-2 text-center text-white transition hover:bg-blue-700">
			Войти
		</a>
	{:else if data.error || !data.token}
		<div class="rounded-md border border-red-200 p-4 text-center text-sm text-red-600">
			Ссылка недействительна или истекла.
		</div>
		<a href="/forgot-password" class="text-center text-sm text-blue-600 hover:underline">Запросить новую</a>
	{:else}
		<form method="post" use:enhance class="flex flex-col gap-4">
			<input type="hidden" name="token" value={data.token} />
			<label class="block text-sm">
				Новый пароль
				<input
					type="password"
					name="password"
					required
					minlength="8"
					class="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
				/>
			</label>

			{#if form?.message}
				<p class="text-sm text-red-600">{form.message}</p>
			{/if}

			<button class="w-full rounded-md bg-blue-600 py-2 text-white transition hover:bg-blue-700">
				Сохранить
			</button>
		</form>
	{/if}
</div>

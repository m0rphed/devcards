<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowLeft } from '@lucide/svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<div class="mx-auto flex max-w-sm flex-col gap-6 py-12">
	<h1 class="text-center text-2xl font-semibold">Сброс пароля</h1>

	{#if form?.sent}
		<div class="rounded-md border border-gray-200 p-4 text-center text-sm">
			<p class="font-medium">Проверь почту 📬</p>
			<p class="mt-1 text-gray-500">Если такой аккаунт существует — на него отправлена ссылка для сброса пароля.</p>
		</div>
	{:else}
		<form method="post" use:enhance class="flex flex-col gap-4">
			<label class="block text-sm">
				Email
				<input type="email" name="email" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
			</label>

			{#if form?.message}
				<p class="text-sm text-red-600">{form.message}</p>
			{/if}

			<button class="w-full rounded-md bg-blue-600 py-2 text-white transition hover:bg-blue-700">
				Отправить ссылку
			</button>
		</form>
	{/if}

	<a href="/login" class="flex items-center justify-center gap-1 text-center text-sm text-blue-600 hover:underline">
		<ArrowLeft class="size-4" aria-hidden="true" /> Вход
	</a>
</div>

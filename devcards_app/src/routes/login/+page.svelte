<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let mode = $state<'signin' | 'signup'>('signin');

	// Successful signup with no error message -> nothing left to do here but
	// wait for the verification email. A blocked sign-in also sets
	// pendingVerification, but *with* a message — that one keeps the form
	// visible so the user can retry once they've clicked the link.
	let awaitingFirstVerification = $derived(form?.pendingVerification && !form?.message);
</script>

<div class="mx-auto flex max-w-sm flex-col gap-6 py-12">
	<h1 class="text-center text-2xl font-semibold">devcards</h1>

	{#if awaitingFirstVerification}
		<div class="rounded-md border border-gray-200 p-4 text-center text-sm">
			<p class="font-medium">Проверь почту 📬</p>
			<p class="mt-1 text-gray-500">
				Отправили ссылку для подтверждения на <strong>{form?.email}</strong>. Перейди по ней, чтобы войти.
			</p>
		</div>
	{:else}
		<div class="flex overflow-hidden rounded-md border border-gray-300 text-sm">
			<button
				type="button"
				class="flex-1 py-2 {mode === 'signin' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}"
				onclick={() => (mode = 'signin')}
			>
				Вход
			</button>
			<button
				type="button"
				class="flex-1 py-2 {mode === 'signup' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}"
				onclick={() => (mode = 'signup')}
			>
				Регистрация
			</button>
		</div>

		<form
			method="post"
			action={mode === 'signin' ? '?/signInEmail' : '?/signUpEmail'}
			use:enhance
			class="flex flex-col gap-4"
		>
			{#if mode === 'signup'}
				<label class="block text-sm">
					Имя
					<input name="name" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
				</label>
			{/if}
			<label class="block text-sm">
				Email
				<input type="email" name="email" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
			</label>
			<label class="block text-sm">
				Пароль
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
				{mode === 'signin' ? 'Войти' : 'Создать аккаунт'}
			</button>

			{#if mode === 'signin'}
				<a href="/forgot-password" class="text-center text-sm text-blue-600 hover:underline">Забыл пароль?</a>
			{/if}
		</form>
	{/if}
</div>

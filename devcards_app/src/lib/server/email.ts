import { Resend } from 'resend';
import { env } from '$env/dynamic/private';

const resend = new Resend(env.RESEND_API_KEY);
const FROM = 'devcards <noreply@mail.cloudmorph.org>';

async function send(to: string, subject: string, html: string): Promise<void> {
	const { error } = await resend.emails.send({ from: FROM, to, subject, html });
	if (error) throw new Error(`Resend: ${error.message}`);
}

export async function sendVerificationEmail(to: string, url: string): Promise<void> {
	await send(
		to,
		'Подтверди почту — devcards',
		`
			<p>Привет!</p>
			<p>Подтверди почту, чтобы начать пользоваться devcards:</p>
			<p><a href="${url}">${url}</a></p>
			<p style="color:#888">Ссылка одноразовая и действует ограниченное время. Если это не ты — просто проигнорируй письмо.</p>
		`
	);
}

export async function sendResetPasswordEmail(to: string, url: string): Promise<void> {
	await send(
		to,
		'Сброс пароля — devcards',
		`
			<p>Привет!</p>
			<p>Кто-то (надеемся, что ты) запросил сброс пароля в devcards:</p>
			<p><a href="${url}">${url}</a></p>
			<p style="color:#888">Ссылка одноразовая и действует ограниченное время. Если это не ты — просто проигнорируй письмо, пароль не изменится.</p>
		`
	);
}

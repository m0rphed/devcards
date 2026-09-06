/**
 * Seeds three public demo collections (SQL / Go / JavaScript) so there's
 * something real to look at in the UI. Idempotent — re-running wipes and
 * recreates this seed user's collections rather than duplicating them.
 *
 * Reference copy of the same questions, readable: ./seed-questions.md
 * (topics inspired by github.com/Londeren/hh-skill-verifications-quizzes,
 * questions themselves rewritten/original — see that file for details).
 *
 * Run with: npm run db:seed (needs DATABASE_URL, same as the app itself).
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, sql } from 'drizzle-orm';
import { user } from '../src/lib/server/db/auth.schema';
import { cards, cardTags, collections, tags, type CardContent } from '../src/lib/server/db/domain.schema';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = postgres(DATABASE_URL);
const db = drizzle(client);

const SEED_USER_ID = 'seed-demo-content';
const SEED_USER_EMAIL = 'demo-seed@devcards.local';

type CardSeed =
	| { type: 'basic'; front: string; back: string; tags: string[] }
	| { type: 'cloze'; text: string; tags: string[] }
	| { type: 'multiple_choice'; question: string; options: string[]; correctIndex: number; tags: string[] };

type CollectionSeed = { title: string; description: string; cards: CardSeed[] };

const SEED_DATA: CollectionSeed[] = [
	{
		title: 'SQL — вопросы для проверки',
		description: 'Основы SQL и немного специфики PostgreSQL. Темы позаимствованы у Londeren/hh-skill-verifications-quizzes.',
		cards: [
			{
				type: 'basic',
				tags: ['sql', 'group-by'],
				front: 'Что делает `HAVING` в SQL и чем отличается от `WHERE`?',
				back:
					'- `WHERE` фильтрует строки **до** группировки (`GROUP BY`)\n' +
					'- `HAVING` фильтрует уже **агрегированные** группы, после `GROUP BY`\n\n' +
					'```sql\nSELECT dept, COUNT(*) FROM employees\nGROUP BY dept\nHAVING COUNT(*) > 5;\n```'
			},
			{
				type: 'basic',
				tags: ['sql', 'select'],
				front: '```sql\nSELECT * FROM users WHERE age > 18 ORDER BY age DESC LIMIT 3;\n```\nЧто вернёт этот запрос?',
				back: 'Три строки — пользователи старше 18, отсортированные по возрасту **по убыванию**, показаны только первые 3.'
			},
			{
				type: 'cloze',
				tags: ['sql', 'aggregate'],
				text: 'Агрегатная функция {{c1::COUNT()}} используется для подсчёта количества строк, удовлетворяющих условию.'
			},
			{
				type: 'multiple_choice',
				tags: ['sql', 'joins'],
				question: 'Что из перечисленного **не** является типом `JOIN` в SQL?',
				options: ['INNER JOIN', 'LEFT JOIN', 'CROSS JOIN', 'FULL SIDE JOIN'],
				correctIndex: 3
			},
			{
				type: 'basic',
				tags: ['sql', 'ddl'],
				front: 'Чем отличаются `DELETE`, `TRUNCATE` и `DROP`?',
				back:
					'| Команда | Удаляет | ROLLBACK | Сброс auto-increment |\n' +
					'|---|---|---|---|\n' +
					'| `DELETE` | строки | да | нет |\n' +
					'| `TRUNCATE` | все строки | обычно нет | да |\n' +
					'| `DROP` | всю таблицу | нет | — |'
			},
			{
				type: 'multiple_choice',
				tags: ['sql', 'postgresql', 'indexes'],
				question: 'Какой тип индекса в PostgreSQL лучше всего подходит для полнотекстового поиска по `tsvector`?',
				options: ['B-tree', 'GIN', 'Hash', 'BRIN'],
				correctIndex: 1
			},
			{
				type: 'cloze',
				tags: ['sql', 'constraints'],
				text: '{{c1::PRIMARY KEY}} гарантирует уникальность и `NOT NULL` для столбца (или набора столбцов) во всей таблице.'
			}
		]
	},
	{
		title: 'Go — вопросы для проверки',
		description: 'Горутины, каналы, интерфейсы и типичные вопросы на понимание рантайма Go.',
		cards: [
			{
				type: 'basic',
				tags: ['go', 'defer'],
				front:
					'```go\nfunc main() {\n    defer fmt.Println("1")\n    defer fmt.Println("2")\n    fmt.Println("3")\n}\n```\n' +
					'Что выведет этот код и в каком порядке?',
				back: '```\n3\n2\n1\n```\n`defer` выполняется в порядке **LIFO** — последний вызванный `defer` срабатывает первым.'
			},
			{
				type: 'multiple_choice',
				tags: ['go', 'channels'],
				question: 'Что произойдёт при попытке записи в уже закрытый (`close()`) канал?',
				options: [
					'Значение молча потеряется',
					'panic: send on closed channel',
					'Горутина заблокируется навсегда',
					'Канал автоматически откроется заново'
				],
				correctIndex: 1
			},
			{
				type: 'cloze',
				tags: ['go', 'goroutines'],
				text: 'Горутины в Go — это {{c1::легковесные потоки выполнения}}, которыми управляет сам рантайм, а не операционная система.'
			},
			{
				type: 'basic',
				tags: ['go', 'slices'],
				front: 'В чём разница между `nil`-slice и **пустым** slice в Go?\n```go\nvar a []int      // nil\nb := []int{}     // пустой, но не nil\n```',
				back:
					'- `len(a) == 0` и `len(b) == 0` — оба «пустые» по длине\n' +
					'- Но `a == nil` → `true`, а `b == nil` → `false`\n' +
					'- Некоторые API (например, JSON) различают эти случаи: `nil` → `null`, пустой slice → `[]`'
			},
			{
				type: 'multiple_choice',
				tags: ['go', 'concurrency'],
				question: 'Какой примитив синхронизации предотвращает гонку данных при доступе к общей переменной из нескольких горутин?',
				options: ['sync.WaitGroup', 'sync.Mutex', 'context.Context', 'sync.Once'],
				correctIndex: 1
			},
			{
				type: 'basic',
				tags: ['go', 'interfaces'],
				front: 'Нужно ли в Go явно объявлять, что тип реализует интерфейс?',
				back: 'Нет — интерфейсы реализуются **неявно** (structural typing): если у типа есть все нужные методы с нужными сигнатурами, он автоматически удовлетворяет интерфейсу, никакого `implements` не требуется.'
			},
			{
				type: 'cloze',
				tags: ['go', 'defer'],
				text: 'Ключевое слово {{c1::defer}} откладывает вызов функции до момента выхода из окружающей функции.'
			},
			{
				type: 'multiple_choice',
				tags: ['go', 'errors'],
				question: 'Как принято проверять конкретный тип/значение ошибки, обёрнутой через `fmt.Errorf("...: %w", err)`?',
				options: ['err == MyError', 'errors.Is(err, MyError)', 'err.(MyError) напрямую', 'panic(err)'],
				correctIndex: 1
			}
		]
	},
	{
		title: 'JavaScript — вопросы для проверки',
		description: 'Приведение типов, замыкания, event loop и другие вечнозелёные темы JS-собеседований.',
		cards: [
			{
				type: 'basic',
				tags: ['javascript', 'type-coercion'],
				front: '```js\nconsole.log("10" + 2 * "5");\n```\nЧто выведет этот код?',
				back: '`"1010"` — сначала `2 * "5"` приводит строку `"5"` к числу и даёт `10`, затем `"10" + 10` **конкатенирует** строки (число снова приводится к строке).'
			},
			{
				type: 'multiple_choice',
				tags: ['javascript', 'data-structures'],
				question: 'Какая структура данных в JS специально спроектирована так, чтобы сохранять порядок вставки ключей **любого** типа (включая объекты)?',
				options: ['Object', 'Map', 'WeakMap', 'Array'],
				correctIndex: 1
			},
			{
				type: 'cloze',
				tags: ['javascript', 'closures'],
				text: '{{c1::Замыкание (closure)}} — функция, которая запоминает переменные из своей лексической области видимости даже после завершения внешней функции.'
			},
			{
				type: 'basic',
				tags: ['javascript', 'hoisting'],
				front: 'Чем `let`/`const` отличаются от `var` в контексте `hoisting`?',
				back:
					'- `var` — поднимается и сразу инициализируется как `undefined`, область видимости — **функция**\n' +
					'- `let`/`const` — тоже поднимаются, но попадают в *temporal dead zone* до самого объявления, область видимости — **блок**'
			},
			{
				type: 'multiple_choice',
				tags: ['javascript', 'event-loop'],
				question:
					'```js\nconsole.log(\'A\');\nsetTimeout(() => console.log(\'B\'), 0);\nPromise.resolve().then(() => console.log(\'C\'));\nconsole.log(\'D\');\n```\nВ каком порядке это выведется?',
				options: ['A, B, C, D', 'A, D, C, B', 'A, D, B, C', 'D, A, C, B'],
				correctIndex: 1
			},
			{
				type: 'basic',
				tags: ['javascript', 'objects'],
				front: 'Как сделать поверхностную (`shallow`) копию объекта одной строкой?',
				back: '```js\nconst copy = { ...original };\n```\nСпред-оператор копирует **собственные перечисляемые** свойства верхнего уровня — вложенные объекты остаются общими по ссылке.'
			},
			{
				type: 'cloze',
				tags: ['javascript', 'arrays'],
				text: 'Метод массива {{c1::reduce}} сворачивает все элементы в одно значение, передавая аккумулятор от итерации к итерации.'
			},
			{
				type: 'multiple_choice',
				tags: ['javascript', 'bundlers'],
				question: 'Что делает `tree shaking` в сборщиках вроде Webpack/Rollup/Vite?',
				options: [
					'Сортирует импорты по алфавиту',
					'Удаляет неиспользуемый код из финального бандла',
					'Разбивает бандл на чанки по роутам',
					'Минифицирует имена переменных'
				],
				correctIndex: 1
			}
		]
	}
];

async function upsertTags(names: string[]): Promise<string[]> {
	if (names.length === 0) return [];
	const rows = await db
		.insert(tags)
		.values(names.map((name) => ({ name })))
		.onConflictDoUpdate({ target: tags.name, set: { name: sql`excluded.name` } })
		.returning();
	return rows.map((r) => r.id);
}

function toContent(card: CardSeed): CardContent {
	if (card.type === 'basic') return { front: card.front, back: card.back };
	if (card.type === 'cloze') return { text: card.text };
	return { question: card.question, options: card.options, correct_index: card.correctIndex };
}

async function main() {
	console.log('Seeding demo content...');

	await db
		.insert(user)
		.values({ id: SEED_USER_ID, name: 'Демо-контент', email: SEED_USER_EMAIL, emailVerified: true })
		.onConflictDoUpdate({ target: user.id, set: { name: 'Демо-контент' } });

	// Idempotent: wipe this seed user's previous collections (cascades to
	// cards and card_tags) before recreating them.
	await db.delete(collections).where(eq(collections.ownerId, SEED_USER_ID));

	for (const col of SEED_DATA) {
		const [{ id: collectionId }] = await db
			.insert(collections)
			.values({ ownerId: SEED_USER_ID, title: col.title, description: col.description, isPublic: true })
			.returning({ id: collections.id });

		for (const card of col.cards) {
			const [{ id: cardId }] = await db
				.insert(cards)
				.values({ collectionId, type: card.type, content: toContent(card) })
				.returning({ id: cards.id });

			const tagIds = await upsertTags(card.tags);
			if (tagIds.length > 0) {
				await db.insert(cardTags).values(tagIds.map((tagId) => ({ cardId, tagId })));
			}
		}
		console.log(`  + ${col.title}: ${col.cards.length} карточек`);
	}

	console.log('Готово.');
	await client.end();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

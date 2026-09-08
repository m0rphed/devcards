-- Hand-written (drizzle-kit can't diff triggers) — see also
-- 0005_add_cards_touch_collection_trigger.sql for the first trigger in this
-- project. Four more, each a genuinely different kind of rule (not four
-- copies of the same pattern): a self-reference guard, a temporal-order
-- check, a referential-integrity rule that spans two FKs (something a plain
-- foreign key can't express), and an input-normalization rule.
--
-- None of these can fire on the app's own current code paths (checked
-- against src/lib/server/{collections,quiz,tags}.ts before writing this) —
-- they're defense-in-depth against direct/malformed SQL, exactly like the
-- kind of edge case report-assets/demo-function-trigger.sql-style scripts
-- are meant to exercise, not something the polished UI is expected to hit.

-- ============================================================
-- 1) Коллекция не может быть форкнута сама из себя.
-- ============================================================
CREATE FUNCTION prevent_self_fork() RETURNS trigger AS $$
BEGIN
	IF NEW.forked_from_collection_id = NEW.id THEN
		RAISE EXCEPTION 'Коллекция % не может быть форком самой себя', NEW.id;
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER collections_prevent_self_fork
BEFORE INSERT OR UPDATE ON collections
FOR EACH ROW EXECUTE FUNCTION prevent_self_fork();

-- ============================================================
-- 2) Сессия теста не может завершиться раньше, чем началась.
-- ============================================================
CREATE FUNCTION enforce_quiz_session_time_order() RETURNS trigger AS $$
BEGIN
	IF NEW.finished_at IS NOT NULL AND NEW.finished_at < NEW.started_at THEN
		RAISE EXCEPTION 'quiz_sessions.finished_at (%) не может быть раньше started_at (%)', NEW.finished_at, NEW.started_at;
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quiz_sessions_enforce_time_order
BEFORE INSERT OR UPDATE ON quiz_sessions
FOR EACH ROW EXECUTE FUNCTION enforce_quiz_session_time_order();

-- ============================================================
-- 3) Карточка, на которую отвечают в рамках сессии теста, обязана
--    принадлежать той же коллекции, что и сама сессия. Обычный FOREIGN KEY
--    не может этого выразить: card_id ссылается на cards.id, а
--    quiz_session_id — на quiz_sessions.id, независимо друг от друга; здесь
--    же проверяется согласованность ЗНАЧЕНИЙ двух разных внешних ключей
--    между собой.
-- ============================================================
CREATE FUNCTION validate_quiz_attempt_card_in_session_collection() RETURNS trigger AS $$
DECLARE
	v_ok boolean;
BEGIN
	SELECT EXISTS (
		SELECT 1
		FROM cards c
		JOIN quiz_sessions qs ON qs.id = NEW.quiz_session_id
		WHERE c.id = NEW.card_id AND c.collection_id = qs.collection_id
	) INTO v_ok;

	IF NOT v_ok THEN
		RAISE EXCEPTION 'Карточка % не принадлежит коллекции сессии теста %', NEW.card_id, NEW.quiz_session_id;
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quiz_attempts_validate_card_collection
BEFORE INSERT ON quiz_attempts
FOR EACH ROW EXECUTE FUNCTION validate_quiz_attempt_card_in_session_collection();

-- ============================================================
-- 4) Имя тега нормализуется (обрезаются пробелы по краям) и не может быть
--    пустым после обрезки. Приложение (parseTagNames в tags.ts) уже делает
--    это на своей стороне — триггер здесь на случай прямой вставки в обход
--    приложения (то самое "defense in depth", а не дублирование ради
--    дублирования).
-- ============================================================
CREATE FUNCTION normalize_tag_name() RETURNS trigger AS $$
BEGIN
	NEW.name := btrim(NEW.name);
	IF NEW.name = '' THEN
		RAISE EXCEPTION 'Имя тега не может быть пустым';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tags_normalize_name
BEFORE INSERT OR UPDATE ON tags
FOR EACH ROW EXECUTE FUNCTION normalize_tag_name();

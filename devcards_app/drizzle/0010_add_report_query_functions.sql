-- Hand-written (drizzle-kit can't diff functions) — wraps the 7 report
-- queries (report-assets/queries/*.sql, repo root, not in the public repo)
-- as real stored functions, per course requirement: "все запросы должны
-- быть реализованы через вызовы хранимых процедур/функций". Each function
-- that takes an id/user-supplied value validates it and RAISEs a readable
-- exception on bad input, matching the assignment's own example (missing
-- user -> error branch), not just a silent empty result set.
--
-- All STABLE (read-only, same result for same args within one snapshot).

-- ============================================================
-- 1) Топ тегов пользователя по доле Again/Hard за последние N дней.
-- ============================================================
CREATE FUNCTION fn_user_top_struggling_tags(
	p_user_id text,
	p_days int DEFAULT 30,
	p_min_reviews int DEFAULT 3
)
RETURNS TABLE(tag_name text, total_reviews bigint, struggling_reviews bigint, struggling_pct numeric)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM "user" WHERE id = p_user_id) THEN
		RAISE EXCEPTION 'Пользователь % не найден', p_user_id;
	END IF;
	IF p_days <= 0 THEN
		RAISE EXCEPTION 'p_days должен быть положительным (получено %)', p_days;
	END IF;

	RETURN QUERY
	SELECT
		t.name,
		count(*),
		count(*) FILTER (WHERE rl.rating IN ('again', 'hard')),
		round(100.0 * count(*) FILTER (WHERE rl.rating IN ('again', 'hard')) / count(*), 1)
	FROM review_log rl
	JOIN card_tags ct ON ct.card_id = rl.card_id
	JOIN tags t ON t.id = ct.tag_id
	WHERE rl.user_id = p_user_id
	  AND rl.reviewed_at >= now() - (p_days || ' days')::interval
	GROUP BY t.name
	HAVING count(*) >= p_min_reviews
	ORDER BY 4 DESC, 2 DESC
	LIMIT 10;
END;
$$;

-- ============================================================
-- 2) Топ-N публичных коллекций по рейтингу и числу форков.
-- ============================================================
CREATE FUNCTION fn_public_collections_ranking(p_limit int DEFAULT 10)
RETURNS TABLE(title text, owner_name text, avg_rating numeric, rating_count bigint, forks bigint, rank bigint)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
	IF p_limit <= 0 THEN
		RAISE EXCEPTION 'p_limit должен быть положительным (получено %)', p_limit;
	END IF;

	RETURN QUERY
	WITH fork_counts AS (
		SELECT forked_from_collection_id AS collection_id, count(*) AS forks
		FROM collections
		WHERE forked_from_collection_id IS NOT NULL
		GROUP BY forked_from_collection_id
	)
	SELECT
		c.title,
		u.name,
		coalesce(crs.avg_rating, 0)::numeric(3, 2),
		coalesce(crs.rating_count, 0),
		coalesce(fc.forks, 0),
		RANK() OVER (ORDER BY coalesce(crs.avg_rating, 0) DESC, coalesce(fc.forks, 0) DESC)
	FROM collections c
	JOIN "user" u ON u.id = c.owner_id
	LEFT JOIN collection_rating_summary crs ON crs.collection_id = c.id
	LEFT JOIN fork_counts fc ON fc.collection_id = c.id
	WHERE c.is_public = true
	ORDER BY 6
	LIMIT p_limit;
END;
$$;

-- ============================================================
-- 3) Прогноз повторений на N дней вперёд для пользователя.
-- ============================================================
CREATE FUNCTION fn_review_forecast(p_user_id text, p_days int DEFAULT 7)
RETURNS TABLE(day date, due_count bigint)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM "user" WHERE id = p_user_id) THEN
		RAISE EXCEPTION 'Пользователь % не найден', p_user_id;
	END IF;
	IF p_days <= 0 THEN
		RAISE EXCEPTION 'p_days должен быть положительным (получено %)', p_days;
	END IF;

	RETURN QUERY
	WITH days AS (
		SELECT generate_series(
			date_trunc('day', now()),
			date_trunc('day', now()) + ((p_days - 1) || ' days')::interval,
			interval '1 day'
		)::date AS day
	),
	due_counts AS (
		SELECT
			GREATEST(date_trunc('day', due), date_trunc('day', now()))::date AS day,
			count(*) AS due_count
		FROM review_state
		WHERE user_id = p_user_id
		  AND due < now() + (p_days || ' days')::interval
		GROUP BY 1
	)
	SELECT d.day, coalesce(dc.due_count, 0)
	FROM days d
	LEFT JOIN due_counts dc ON dc.day = d.day
	ORDER BY d.day;
END;
$$;

-- ============================================================
-- 4) Ежедневная активность повторений за последние N дней.
-- ============================================================
CREATE FUNCTION fn_daily_activity(p_user_id text, p_days int DEFAULT 30)
RETURNS TABLE(day timestamptz, reviews bigint, correct bigint, incorrect bigint, retention_pct numeric)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM "user" WHERE id = p_user_id) THEN
		RAISE EXCEPTION 'Пользователь % не найден', p_user_id;
	END IF;
	IF p_days <= 0 THEN
		RAISE EXCEPTION 'p_days должен быть положительным (получено %)', p_days;
	END IF;

	RETURN QUERY
	SELECT
		date_trunc('day', rl.reviewed_at),
		count(*),
		count(*) FILTER (WHERE rl.rating IN ('good', 'easy')),
		count(*) FILTER (WHERE rl.rating IN ('again', 'hard')),
		round(100.0 * count(*) FILTER (WHERE rl.rating IN ('good', 'easy')) / NULLIF(count(*), 0), 1)
	FROM review_log rl
	WHERE rl.user_id = p_user_id
	  AND rl.reviewed_at >= now() - (p_days || ' days')::interval
	GROUP BY 1
	ORDER BY 1;
END;
$$;

-- ============================================================
-- 5) Пользователи с публичной коллекцией, но без единого своего форка.
--    Без входных параметров — запрос по своей природе не параметризован.
-- ============================================================
CREATE FUNCTION fn_public_authors_without_forks()
RETURNS TABLE(id text, name text, email text)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
	RETURN QUERY
	SELECT DISTINCT u.id, u.name, u.email
	FROM "user" u
	JOIN collections c ON c.owner_id = u.id AND c.is_public = true
	WHERE NOT EXISTS (
		SELECT 1 FROM collections c2
		WHERE c2.owner_id = u.id AND c2.forked_from_collection_id IS NOT NULL
	)
	ORDER BY u.name;
END;
$$;

-- ============================================================
-- 6) Карточки без единого повторения в конкретной коллекции.
-- ============================================================
CREATE FUNCTION fn_never_reviewed_cards(p_collection_id uuid)
RETURNS TABLE(id uuid, type card_type, created_at timestamptz)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM collections WHERE collections.id = p_collection_id) THEN
		RAISE EXCEPTION 'Коллекция % не найдена', p_collection_id;
	END IF;

	RETURN QUERY
	SELECT c.id, c.type, c.created_at
	FROM cards c
	LEFT JOIN review_log rl ON rl.card_id = c.id
	WHERE c.collection_id = p_collection_id
	  AND rl.id IS NULL
	ORDER BY c.created_at;
END;
$$;

-- ============================================================
-- 7) Содержимое view collection_rating_summary с названиями коллекций.
--    Без входных параметров — прямой обзор уже готового агрегата.
-- ============================================================
CREATE FUNCTION fn_collection_rating_summary()
RETURNS TABLE(title text, avg_rating real, rating_count bigint)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
	RETURN QUERY
	SELECT c.title, crs.avg_rating, crs.rating_count
	FROM collection_rating_summary crs
	JOIN collections c ON c.id = crs.collection_id
	ORDER BY crs.avg_rating DESC;
END;
$$;

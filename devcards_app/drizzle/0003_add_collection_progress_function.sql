-- Hand-written (drizzle-kit can't diff functions): per-(collection, user)
-- FSRS state breakdown, for a "N new / M learning / K due today" progress
-- widget. See $lib/server/stats.ts for the Drizzle-side caller.
--
-- A card with no review_state row (never studied) is bucketed as 'new' via
-- COALESCE, and counts as "due" — matching getNextDueCard()'s (srs.ts) own
-- rule for what belongs in the study queue right now, so this widget and
-- the actual queue never disagree about what's due.
CREATE FUNCTION collection_progress(p_collection_id uuid, p_user_id text)
RETURNS TABLE(state fsrs_state, card_count bigint, due_count bigint)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
	RETURN QUERY
	SELECT
		COALESCE(rs.state, 'new'::fsrs_state) AS state,
		count(*) AS card_count,
		count(*) FILTER (WHERE rs.card_id IS NULL OR rs.due <= now()) AS due_count
	FROM cards c
	LEFT JOIN review_state rs ON rs.card_id = c.id AND rs.user_id = p_user_id
	WHERE c.collection_id = p_collection_id
	GROUP BY COALESCE(rs.state, 'new'::fsrs_state);
END;
$$;

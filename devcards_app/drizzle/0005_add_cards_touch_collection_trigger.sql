-- Hand-written (drizzle-kit can't diff triggers): keeps collections.updated_at
-- honest about card-level changes, not just title/description/isPublic edits
-- (the only thing that touched it before this). Needed for forked_from_updated_at
-- comparisons (phase02.social_features.md) to mean anything — an app-level
-- "don't forget to touch updated_at" in every card create/update/delete path
-- is exactly the kind of thing a future change quietly breaks; a trigger can't
-- be forgotten.
CREATE FUNCTION touch_collection_updated_at() RETURNS trigger AS $$
BEGIN
	UPDATE collections SET updated_at = now()
	WHERE id = COALESCE(NEW.collection_id, OLD.collection_id);
	RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cards_touch_collection
AFTER INSERT OR UPDATE OR DELETE ON cards
FOR EACH ROW EXECUTE FUNCTION touch_collection_updated_at();

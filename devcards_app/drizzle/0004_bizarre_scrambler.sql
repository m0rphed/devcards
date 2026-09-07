CREATE TABLE "collection_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_ratings" (
	"collection_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"rating" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_ratings_collection_id_user_id_pk" PRIMARY KEY("collection_id","user_id"),
	CONSTRAINT "collection_ratings_rating_check" CHECK ("collection_ratings"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "forked_from_collection_id" uuid;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "forked_from_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "collection_comments" ADD CONSTRAINT "collection_comments_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_comments" ADD CONSTRAINT "collection_comments_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_ratings" ADD CONSTRAINT "collection_ratings_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_ratings" ADD CONSTRAINT "collection_ratings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_comments_collection_idx" ON "collection_comments" USING btree ("collection_id","created_at");--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_forked_from_collection_id_collections_id_fk" FOREIGN KEY ("forked_from_collection_id") REFERENCES "public"."collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE VIEW "public"."collection_rating_summary" AS (
	select "collection_ratings"."collection_id" as collection_id,
		-- avg() over smallint naturally comes back as numeric, which
		-- postgres-js returns as a string (no precision loss) — cast to
		-- match the real() builder above so it round-trips as an actual
		-- number, same reasoning as review_activity_daily's explicit
		-- column builders (see the comment there).
		avg("collection_ratings"."rating")::real as avg_rating,
		count(*) as rating_count
	from "collection_ratings"
	group by "collection_ratings"."collection_id"
);
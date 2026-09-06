CREATE TYPE "public"."review_rating" AS ENUM('again', 'hard', 'good', 'easy');--> statement-breakpoint
CREATE TABLE "review_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"card_id" uuid NOT NULL,
	"rating" "review_rating" NOT NULL,
	"state_before" "fsrs_state" NOT NULL,
	"due_before" timestamp with time zone NOT NULL,
	"stability_before" real NOT NULL,
	"difficulty_before" real NOT NULL,
	"scheduled_days" integer NOT NULL,
	"reviewed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_log" ADD CONSTRAINT "review_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_log" ADD CONSTRAINT "review_log_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_log_user_reviewed_idx" ON "review_log" USING btree ("user_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "review_log_card_idx" ON "review_log" USING btree ("card_id","reviewed_at");--> statement-breakpoint
CREATE VIEW "public"."review_activity_daily" AS (
	select
		"review_log"."user_id" as user_id,
		date_trunc('day', "review_log"."reviewed_at") as day,
		count(*) as reviews,
		count(*) filter (where "review_log"."rating" in ('good', 'easy')) as correct,
		count(*) filter (where "review_log"."rating" in ('again', 'hard')) as incorrect
	from "review_log"
	group by "review_log"."user_id", date_trunc('day', "review_log"."reviewed_at")
);
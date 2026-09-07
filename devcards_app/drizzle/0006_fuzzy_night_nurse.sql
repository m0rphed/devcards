CREATE TYPE "public"."card_color" AS ENUM('red', 'orange', 'yellow', 'green', 'blue', 'purple');--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "color" "card_color";
import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const rsvpsTable = pgTable("rsvps", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contact: text("contact").notNull(),
  attending: boolean("attending").notNull(),
  guests: integer("guests").notNull(),
  categoryId: text("category_id").notNull(),
  dishName: text("dish_name").notNull(),
  dishOrigin: text("dish_origin").notNull(),
  dishMemory: text("dish_memory").notNull(),
  guestDietary: text("dietary").array().notNull(),
  guestAllergies: text("allergies").notNull(),
  dishIngredients: text("dish_ingredients").notNull().default(""),
  dishDietary: text("dish_dietary").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertRsvpSchema = createInsertSchema(rsvpsTable, {
  name: z.string().min(1),
  contact: z.string().email("Enter a valid email address"),
  guests: z.number().int().min(0).max(20),
  guestDietary: z.array(z.string()),
  dishDietary: z.array(z.string()),
});

export type InsertRsvp = z.infer<typeof insertRsvpSchema>;
export type Rsvp = typeof rsvpsTable.$inferSelect;
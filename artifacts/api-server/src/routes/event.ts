import { Router, type IRouter } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  CreateRsvpBody,
  CreateRsvpResponse,
  GetEventAvailabilityResponse,
  ListRsvpsResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import { rsvpsTable } from "@workspace/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sendRsvpConfirmation } from "../lib/resend";

const router: IRouter = Router();
const organiserPassword = process.env.ORGANISER_PASSWORD ?? "friendsgiving";
const sessionSecret = process.env.SESSION_SECRET ?? "taste-of-home-development-session";

const eventDetails = {
  eventName: "Shay's Friendsgiving Dinner",
  date: "Saturday, 21 November 2026",
  time: "6:30 pm onwards",
  location: "NCPV MCR · 215A Anzac Parade, Kensington NSW 2033",
};

function organiserToken() {
  return createHmac("sha256", sessionSecret).update("organiser-session").digest("hex");
}

function isOrganiserAuthenticated(cookieHeader?: string) {
  const token = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("organiser_session="))
    ?.split("=")[1];
  if (!token) return false;
  const expected = Buffer.from(organiserToken());
  const actual = Buffer.from(token);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const dishCategories = [
  {
    id: "protein",
    name: "Main protein",
    shortName: "Protein",
    description: "Chicken, turkey, fish or another meat you enjoy. Please note ingredients.",
    target: 5,
  },
  {
    id: "vegetarian",
    name: "Vegetarian main",
    shortName: "Vegetarian main",
    description: "A substantial vegetarian dish that can serve 8–10.",
    target: 4,
  },
  {
    id: "sides",
    name: "Potato & vegetable sides",
    shortName: "Vegetable sides",
    description: "Something generous, comforting and easy to share.",
    target: 5,
  },
  {
    id: "salads",
    name: "Salads",
    shortName: "Salads",
    description: "Something fresh or vegetable-forward for the middle of the table.",
    target: 4,
  },
  {
    id: "grains",
    name: "Rice & grains",
    shortName: "Rice & grains",
    description: "Rice, couscous, grains or another dish to make the table feel abundant.",
    target: 3,
  },
  {
    id: "pasta",
    name: "Pasta & noodle dishes",
    shortName: "Pasta & noodles",
    description: "A crowd-pleasing pasta or noodle dish to share.",
    target: 3,
  },
  {
    id: "bread",
    name: "Bread & baked goods",
    shortName: "Bread",
    description: "Choose something that can be shared by 8–10 people.",
    target: 3,
  },
  {
    id: "appetisers",
    name: "Appetisers & snacks",
    shortName: "Appetisers",
    description: "A little something for people to reach for while they settle in.",
    target: 5,
  },
  {
    id: "desserts",
    name: "Desserts",
    shortName: "Desserts",
    description: "A sweet finish, whether it is baked, chilled or passed down.",
    target: 5,
  },
  {
    id: "treats",
    name: "Childhood treats",
    shortName: "Nostalgic treats",
    description: "Something that tastes like a favourite memory.",
    target: 4,
  },
  {
    id: "drinks",
    name: "Drinks",
    shortName: "Drinks",
    description: "Something lovely to pour, share and toast with.",
    target: 5,
  },
] as const;

async function getRsvps() {
  return db.select().from(rsvpsTable).orderBy(desc(rsvpsTable.createdAt));
}

router.get("/event/availability", async (_req, res, next) => {
  try {
    const rsvps = await db
      .select({ categoryId: rsvpsTable.categoryId })
      .from(rsvpsTable)
      .where(eq(rsvpsTable.attending, true));

    const counts = rsvps.reduce<Record<string, number>>((result, rsvp) => {
      result[rsvp.categoryId] = (result[rsvp.categoryId] ?? 0) + 1;
      return result;
    }, {});

    const response = GetEventAvailabilityResponse.parse({
      ...eventDetails,
      categories: dishCategories.map((category) => {
        const claimed = counts[category.id] ?? 0;
        return {
          ...category,
          claimed,
          remaining: Math.max(0, category.target - claimed),
        };
      }),
    });

    res.json(response);
  } catch (error) {
    next(error);
  }
});

router.get("/rsvps", async (_req, res, next) => {
  try {
    if (!isOrganiserAuthenticated(_req.headers.cookie)) {
      res.status(401).json({ error: "Organiser password required." });
      return;
    }
    const response = ListRsvpsResponse.parse(await getRsvps());
    res.json(response);
  } catch (error) {
    next(error);
  }
});

router.get("/guest/rsvps", async (_req, res, next) => {
  try {
    const rsvps = await getRsvps();
    res.json(rsvps.map((rsvp) => ({
      id: rsvp.id,
      name: rsvp.name,
      attending: rsvp.attending,
      categoryId: rsvp.categoryId,
      dishName: rsvp.dishName,
      guestDietary: rsvp.guestDietary,
      guestAllergies: rsvp.guestAllergies,
      dishIngredients: rsvp.dishIngredients,
      dishDietary: rsvp.dishDietary,
      createdAt: rsvp.createdAt,
    })));
  } catch (error) {
    next(error);
  }
});

router.post("/organiser/auth", (req, res) => {
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (password !== organiserPassword) {
    res.status(401).json({ error: "That password does not open this view." });
    return;
  }
  res.cookie("organiser_session", organiserToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 8,
    path: "/api",
  });
  res.json({ authenticated: true });
});

router.post("/rsvps", async (req, res, next) => {
  try {
    const body = CreateRsvpBody.parse(req.body);

    if (body.guests !== 0) {
      res.status(400).json({ error: "Each RSVP must represent exactly one person." });
      return;
    }

    if (body.attending) {
      const category = dishCategories.find((item) => item.id === body.categoryId);
      if (!category) {
        res.status(400).json({ error: "Please choose a valid dish category." });
        return;
      }

      const categoryRsvps = await db
        .select({ id: rsvpsTable.id })
        .from(rsvpsTable)
        .where(
          and(
            eq(rsvpsTable.categoryId, body.categoryId),
            eq(rsvpsTable.attending, true),
          ),
        );

      if (categoryRsvps.length >= category.target) {
        res.status(409).json({
          error: "That category was just filled. Please choose another available option.",
        });
        return;
      }
    }

    const [created] = await db
      .insert(rsvpsTable)
      .values(body)
      .returning();

    let emailDelivered = true;
    try {
      await sendRsvpConfirmation(created);
    } catch (error) {
      emailDelivered = false;
      logger.error(
        { err: error, rsvpId: created.id },
        "RSVP saved but the confirmation email could not be sent",
      );
    }

    const response = CreateRsvpResponse.parse(created);
    res.status(201).json({ ...response, emailDelivered });
  } catch (error) {
    next(error);
  }
});

router.patch("/rsvps/:id", async (req, res, next) => {
  try {
    if (!isOrganiserAuthenticated(req.headers.cookie)) {
      res.status(401).json({ error: "Organiser password required." });
      return;
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ error: "That RSVP id is not valid." });
      return;
    }

    const body = CreateRsvpBody.parse(req.body);
    if (body.guests !== 0) {
      res.status(400).json({ error: "Each RSVP must represent exactly one person." });
      return;
    }

    const existing = await db
      .select({ id: rsvpsTable.id })
      .from(rsvpsTable)
      .where(eq(rsvpsTable.id, id));

    if (existing.length === 0) {
      res.status(404).json({ error: "That RSVP could not be found." });
      return;
    }

    if (body.attending) {
      const category = dishCategories.find((item) => item.id === body.categoryId);
      if (!category) {
        res.status(400).json({ error: "Please choose a valid dish category." });
        return;
      }

      const categoryRsvps = await db
        .select({ id: rsvpsTable.id })
        .from(rsvpsTable)
        .where(
          and(
            eq(rsvpsTable.categoryId, body.categoryId),
            eq(rsvpsTable.attending, true),
          ),
        );

      const otherClaims = categoryRsvps.filter((rsvp) => rsvp.id !== id).length;
      if (otherClaims >= category.target) {
        res.status(409).json({
          error: "That category is already full. Please choose another available option.",
        });
        return;
      }
    }

    const [updated] = await db
      .update(rsvpsTable)
      .set(body)
      .where(eq(rsvpsTable.id, id))
      .returning();

    const response = CreateRsvpResponse.parse(updated);
    res.json(response);
  } catch (error) {
    next(error);
  }
});

router.post("/rsvps/:id/resend", async (req, res, next) => {
  try {
    if (!isOrganiserAuthenticated(req.headers.cookie)) {
      res.status(401).json({ error: "Organiser password required." });
      return;
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ error: "That RSVP id is not valid." });
      return;
    }

    const [rsvp] = await db
      .select()
      .from(rsvpsTable)
      .where(eq(rsvpsTable.id, id));

    if (!rsvp) {
      res.status(404).json({ error: "That RSVP could not be found." });
      return;
    }

    try {
      await sendRsvpConfirmation(rsvp);
    } catch (error) {
      logger.error({ err: error, rsvpId: id }, "Manual confirmation email resend failed");
      res.status(502).json({
        error: "The confirmation email could not be sent. Check the Resend setup and try again.",
      });
      return;
    }

    res.json({ delivered: true, contact: rsvp.contact });
  } catch (error) {
    next(error);
  }
});

router.delete("/rsvps/:id", async (req, res, next) => {
  try {
    if (!isOrganiserAuthenticated(req.headers.cookie)) {
      res.status(401).json({ error: "Organiser password required." });
      return;
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ error: "That RSVP id is not valid." });
      return;
    }

    const deleted = await db
      .delete(rsvpsTable)
      .where(eq(rsvpsTable.id, id))
      .returning({ id: rsvpsTable.id });

    if (deleted.length === 0) {
      res.status(404).json({ error: "That RSVP could not be found." });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
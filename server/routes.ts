import type { Express } from "express";
import type { Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { insertTicketSchema, insertWatchlistSchema, insertConflictSchema, insertInboundEmailSchema } from "@shared/schema";
import { z } from "zod";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Seed a demo user so the app works out-of-the-box
function seedDemoUser() {
  const existing = storage.getUserByEmail("demo@hbs.edu");
  if (!existing) {
    const user = storage.createUser({ name: "Alex Chen", email: "demo@hbs.edu", forwardEmail: "alex-chen@fomohedge.com" });

    // Seed some demo tickets
    const demoTickets = [
      {
        userId: user.id, eventName: "HBS Winter Formal 2026", eventDate: "2026-04-15",
        eventType: "party", platform: "partiful", pricePaid: 45, currency: "USD",
        userLikelihood: 70, aiLikelihood: 42,
        aiReason: "You have a flight back from Peru landing Apr 13 — 2 days buffer before a late-night formal is historically low for you.",
        isListed: 1, askingPrice: 40, notes: "",
      },
      {
        userId: user.id, eventName: "HBS Peru Trek 2026", eventDate: "2026-04-03",
        eventType: "trek", platform: "manual", pricePaid: 2800, currency: "USD",
        userLikelihood: 90, aiLikelihood: 88,
        aiReason: "No major conflicts detected. Trek is 2+ weeks away and you have no overlapping commitments.",
        isListed: 0, askingPrice: null, notes: "10-day trek, departs April 3",
      },
      {
        userId: user.id, eventName: "FinTech Club Networking Night", eventDate: "2026-04-08",
        eventType: "career", platform: "luma", pricePaid: 0, currency: "USD",
        userLikelihood: 55, aiLikelihood: 61,
        aiReason: "Free event — commitment tends to be lower. You have 2 other events that week.",
        isListed: 0, askingPrice: null, notes: "",
      },
      {
        userId: user.id, eventName: "HBS Spring Concert", eventDate: "2026-04-22",
        eventType: "party", platform: "eventbrite", pricePaid: 30, currency: "USD",
        userLikelihood: 80, aiLikelihood: 75,
        aiReason: "No conflicts detected. You've attended 3 of 4 past concerts.",
        isListed: 0, askingPrice: null, notes: "",
      },
    ];

    for (const t of demoTickets) {
      const ticket = storage.createTicket(t);
      // Add a conflict for the Winter Formal
      if (t.eventName === "HBS Winter Formal 2026") {
        storage.createConflict({
          ticketId: ticket.id,
          conflictDescription: "You're returning from the Peru Trek on Apr 13 — only 2 days before this event. Your attendance rate for events shortly after travel is historically low (28%).",
          dismissed: 0,
        });
      }
    }

    // Seed some marketplace listings from other users
    const otherListings = [
      {
        userId: 999, eventName: "HBS Winter Formal 2026", eventDate: "2026-04-15",
        eventType: "party", platform: "partiful", pricePaid: 45, currency: "USD",
        userLikelihood: 25, aiLikelihood: 18,
        aiReason: "User has a job interview in NYC the next morning.",
        isListed: 1, askingPrice: 35, notes: "",
      },
      {
        userId: 998, eventName: "HBS Winter Formal 2026", eventDate: "2026-04-15",
        eventType: "party", platform: "partiful", pricePaid: 45, currency: "USD",
        userLikelihood: 30, aiLikelihood: 27,
        aiReason: "Bought 3 overlapping events that weekend.",
        isListed: 1, askingPrice: 38, notes: "",
      },
    ];
    for (const t of otherListings) {
      storage.createTicket(t);
    }
  }
}

seedDemoUser();

export function registerRoutes(httpServer: Server, app: Express) {

  // ── Auth (demo mode: just pick the demo user) ──────────────────────────────
  app.get("/api/me", (req, res) => {
    const user = storage.getUserByEmail("demo@hbs.edu");
    res.json(user);
  });

  // ── Tickets ────────────────────────────────────────────────────────────────
  app.get("/api/tickets", (req, res) => {
    const user = storage.getUserByEmail("demo@hbs.edu")!;
    const userTickets = storage.getTicketsByUser(user.id);
    const conflicts = storage.getActiveConflicts();
    const ticketsWithConflicts = userTickets.map(t => ({
      ...t,
      conflicts: conflicts.filter(c => c.ticketId === t.id),
    }));
    res.json(ticketsWithConflicts);
  });

  app.post("/api/tickets", (req, res) => {
    try {
      const user = storage.getUserByEmail("demo@hbs.edu")!;
      const data = insertTicketSchema.parse({ ...req.body, userId: user.id });
      
      // Compute simple rule-based AI likelihood
      const aiResult = computeAiLikelihood(data);
      const ticket = storage.createTicket({
        ...data,
        aiLikelihood: aiResult.score,
        aiReason: aiResult.reason,
      });

      // Check for conflicts
      const conflicts = detectConflicts(ticket, storage.getTicketsByUser(user.id));
      for (const c of conflicts) {
        storage.createConflict({ ticketId: ticket.id, conflictDescription: c, dismissed: 0 });
      }

      res.json(ticket);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/tickets/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = storage.updateTicket(id, req.body);
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/tickets/:id", (req, res) => {
    storage.deleteTicket(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ── Marketplace ────────────────────────────────────────────────────────────
  app.get("/api/marketplace", (req, res) => {
    const query = (req.query.q as string) || "";
    const listed = query
      ? storage.searchListedTickets(query)
      : storage.getAllListedTickets();

    // For each event, group by event name and return top 2 lowest likelihood sellers
    const grouped: Record<string, typeof listed> = {};
    for (const t of listed) {
      if (!grouped[t.eventName]) grouped[t.eventName] = [];
      grouped[t.eventName].push(t);
    }

    const result = Object.entries(grouped).map(([eventName, sellers]) => {
      const sorted = sellers.sort((a, b) => (a.aiLikelihood ?? a.userLikelihood) - (b.aiLikelihood ?? b.userLikelihood));
      const top2 = sorted.slice(0, 2);
      const watchers = storage.getWatchlistForEvent(eventName).length;
      return {
        eventName,
        eventDate: sellers[0].eventDate,
        eventType: sellers[0].eventType,
        totalListings: sellers.length,
        watchers,
        topSellers: top2,
      };
    });

    res.json(result);
  });

  // ── Watchlist ──────────────────────────────────────────────────────────────
  app.post("/api/watchlist", (req, res) => {
    try {
      const data = insertWatchlistSchema.parse(req.body);
      const entry = storage.createWatchEntry(data);
      res.json(entry);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ── Conflicts ──────────────────────────────────────────────────────────────
  app.post("/api/conflicts/:id/dismiss", (req, res) => {
    storage.dismissConflict(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ── Email Ingestion (simulated) ────────────────────────────────────────────
  app.post("/api/ingest/email", (req, res) => {
    try {
      const { subject, fromAddress, bodySnippet } = req.body;
      const parsed = parseEmailForEvent(subject, bodySnippet || "");
      const inbound = storage.createInboundEmail({
        toAddress: "demo@fomohedge.com",
        fromAddress: fromAddress || "unknown@example.com",
        subject: subject || "(no subject)",
        bodySnippet: bodySnippet || "",
        parsedEventName: parsed.eventName,
        parsedDate: parsed.date,
        parsedPrice: parsed.price,
        status: parsed.eventName ? "pending" : "ignored",
      });

      if (parsed.eventName) {
        const user = storage.getUserByEmail("demo@hbs.edu")!;
        const aiResult = computeAiLikelihood({ eventType: "other", eventDate: parsed.date || "", pricePaid: parsed.price || 0 } as any);
        storage.createTicket({
          userId: user.id,
          eventName: parsed.eventName,
          eventDate: parsed.date || new Date().toISOString().split("T")[0],
          eventType: "other",
          platform: "email",
          pricePaid: parsed.price || 0,
          currency: "USD",
          userLikelihood: 50,
          aiLikelihood: aiResult.score,
          aiReason: aiResult.reason,
          isListed: 0,
          askingPrice: null,
          notes: `Auto-imported from forwarded email: "${subject}"`,
        });
        storage.updateEmailStatus(inbound.id, "converted");
      }

      res.json({ ok: true, parsed, created: !!parsed.eventName });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ── Screenshot Upload ──────────────────────────────────────────────────────
  app.post("/api/ingest/screenshot", upload.single("image"), (req, res) => {
    // In production: send image to Claude Vision API
    // For demo: parse whatever text fields were submitted alongside
    try {
      const { eventName, eventDate, pricePaid, platform } = req.body;
      if (!eventName || !eventDate) {
        return res.status(400).json({ error: "Could not extract event details from screenshot. Please fill in manually." });
      }
      const user = storage.getUserByEmail("demo@hbs.edu")!;
      const aiResult = computeAiLikelihood({ eventType: "other", eventDate, pricePaid: parseFloat(pricePaid) || 0 } as any);
      const ticket = storage.createTicket({
        userId: user.id,
        eventName,
        eventDate,
        eventType: "other",
        platform: platform || "screenshot",
        pricePaid: parseFloat(pricePaid) || 0,
        currency: "USD",
        userLikelihood: 50,
        aiLikelihood: aiResult.score,
        aiReason: aiResult.reason,
        isListed: 0,
        askingPrice: null,
        notes: "Imported via screenshot upload",
      });
      res.json({ ok: true, ticket });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

function computeAiLikelihood(data: { eventType: string; eventDate: string; pricePaid: number }): { score: number; reason: string } {
  let score = 65;
  const reasons: string[] = [];

  const daysUntil = Math.ceil((new Date(data.eventDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (daysUntil < 3) { score -= 20; reasons.push("event is very soon"); }
  else if (daysUntil < 7) { score -= 5; reasons.push("less than a week away"); }
  else if (daysUntil > 30) { score -= 10; reasons.push("far in the future (commitment tends to slip)"); }

  if (data.pricePaid === 0) { score -= 15; reasons.push("free event (lower commitment)"); }
  else if (data.pricePaid > 100) { score += 10; reasons.push("significant spend signals commitment"); }

  if (data.eventType === "trek") { score += 10; reasons.push("treks have higher follow-through"); }
  if (data.eventType === "party") { score -= 5; reasons.push("parties have higher bail rate"); }
  if (data.eventType === "career") { score += 5; reasons.push("career events have moderate commitment"); }

  score = Math.max(5, Math.min(95, score));
  const reason = reasons.length
    ? `Score based on: ${reasons.join("; ")}.`
    : "No strong signals detected — default baseline applied.";

  return { score, reason };
}

function detectConflicts(newTicket: any, existingTickets: any[]): string[] {
  const conflicts: string[] = [];
  const newDate = new Date(newTicket.eventDate);

  for (const t of existingTickets) {
    if (t.id === newTicket.id) continue;
    const existDate = new Date(t.eventDate);
    const daysDiff = Math.abs((newDate.getTime() - existDate.getTime()) / (1000 * 60 * 60 * 24));

    if (t.eventType === "trek" && daysDiff <= 2) {
      conflicts.push(`You have the "${t.eventName}" trek ending around the same time — events within 2 days of returning from a trek have a 70%+ bail rate.`);
    } else if (daysDiff === 0) {
      conflicts.push(`"${t.eventName}" is on the same day. You might not make both.`);
    }
  }
  return conflicts;
}

function parseEmailForEvent(subject: string, body: string): { eventName: string | null; date: string | null; price: number | null } {
  // Simple heuristic parsing — in production, use Claude
  const eventName = subject.replace(/^(re:|fwd?:|your booking|confirmation:|you're (in|going to)|ticket for)/gi, "").trim() || null;

  const dateMatch = body.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+ \d{1,2},?\s*\d{4})\b/i);
  let date: string | null = null;
  if (dateMatch) {
    const parsed = new Date(dateMatch[0]);
    if (!isNaN(parsed.getTime())) date = parsed.toISOString().split("T")[0];
  }

  const priceMatch = body.match(/\$\s?(\d+(?:\.\d{2})?)/);
  const price = priceMatch ? parseFloat(priceMatch[1]) : null;

  return { eventName, date, price };
}

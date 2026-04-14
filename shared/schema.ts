import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  forwardEmail: text("forward_email"), // their personal @fomohedge.com address
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Events / Tickets table (owned by a user)
export const tickets = sqliteTable("tickets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  eventName: text("event_name").notNull(),
  eventDate: text("event_date").notNull(), // ISO date string
  eventType: text("event_type").notNull(), // "party" | "trek" | "conference" | "career" | "other"
  platform: text("platform").notNull(), // "eventbrite" | "partiful" | "luma" | "manual" | "email" | "screenshot"
  pricePaid: real("price_paid").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  // Likelihood
  userLikelihood: integer("user_likelihood").notNull().default(50), // 0-100
  aiLikelihood: integer("ai_likelihood"), // 0-100, computed
  aiReason: text("ai_reason"), // brief explanation of AI suggestion
  // Resale
  isListed: integer("is_listed").notNull().default(0), // 0 = false, 1 = true
  askingPrice: real("asking_price"),
  // Metadata
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(""),
});

export const insertTicketSchema = createInsertSchema(tickets).omit({ id: true, createdAt: true });
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof tickets.$inferSelect;

// Buyer interest — someone watching an event
export const watchlist = sqliteTable("watchlist", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  watcherName: text("watcher_name").notNull(),
  watcherEmail: text("watcher_email").notNull(),
  eventName: text("event_name").notNull(),
  maxBudget: real("max_budget"),
  createdAt: text("created_at").notNull().default(""),
});

export const insertWatchlistSchema = createInsertSchema(watchlist).omit({ id: true, createdAt: true });
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;
export type Watchlist = typeof watchlist.$inferSelect;

// Conflicts — flagged scheduling issues
export const conflicts = sqliteTable("conflicts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticketId: integer("ticket_id").notNull(),
  conflictDescription: text("conflict_description").notNull(),
  dismissed: integer("dismissed").notNull().default(0),
  createdAt: text("created_at").notNull().default(""),
});

export const insertConflictSchema = createInsertSchema(conflicts).omit({ id: true, createdAt: true });
export type InsertConflict = z.infer<typeof insertConflictSchema>;
export type Conflict = typeof conflicts.$inferSelect;

// Inbound emails parsed into tickets
export const inboundEmails = sqliteTable("inbound_emails", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  toAddress: text("to_address").notNull(),
  fromAddress: text("from_address").notNull(),
  subject: text("subject").notNull(),
  bodySnippet: text("body_snippet"),
  parsedEventName: text("parsed_event_name"),
  parsedDate: text("parsed_date"),
  parsedPrice: real("parsed_price"),
  status: text("status").notNull().default("pending"), // "pending" | "converted" | "ignored"
  createdAt: text("created_at").notNull().default(""),
});

export const insertInboundEmailSchema = createInsertSchema(inboundEmails).omit({ id: true, createdAt: true });
export type InsertInboundEmail = z.infer<typeof insertInboundEmailSchema>;
export type InboundEmail = typeof inboundEmails.$inferSelect;

// OAuth tokens — stored per user per provider
export const oauthTokens = sqliteTable("oauth_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  provider: text("provider").notNull(), // "eventbrite" | "outlook"
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").notNull().default(""),
});

export const insertOAuthTokenSchema = createInsertSchema(oauthTokens).omit({ id: true, createdAt: true });
export type InsertOAuthToken = z.infer<typeof insertOAuthTokenSchema>;
export type OAuthToken = typeof oauthTokens.$inferSelect;

// Transactions — peer-to-peer ticket transfer flow
export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticketId: integer("ticket_id").notNull(),
  buyerName: text("buyer_name").notNull(),
  buyerEmail: text("buyer_email").notNull(),
  status: text("status").notNull().default("interested"), // "interested" | "ticket_transferred" | "payment_done"
  createdAt: text("created_at").notNull().default(""),
});
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

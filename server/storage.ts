import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, like, asc, desc } from "drizzle-orm";
import {
  users, tickets, watchlist, conflicts, inboundEmails, oauthTokens, transactions,
  type User, type InsertUser,
  type Ticket, type InsertTicket,
  type Watchlist, type InsertWatchlist,
  type Conflict, type InsertConflict,
  type InboundEmail, type InsertInboundEmail,
  type OAuthToken, type InsertOAuthToken,
  type Transaction, type InsertTransaction,
} from "@shared/schema";

const sqlite = new Database("hbs-tix.db");
const db = drizzle(sqlite);

// Run migrations inline
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    forward_email TEXT
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    event_name TEXT NOT NULL,
    event_date TEXT NOT NULL,
    event_type TEXT NOT NULL,
    platform TEXT NOT NULL,
    price_paid REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    user_likelihood INTEGER NOT NULL DEFAULT 50,
    ai_likelihood INTEGER,
    ai_reason TEXT,
    is_listed INTEGER NOT NULL DEFAULT 0,
    asking_price REAL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    watcher_name TEXT NOT NULL,
    watcher_email TEXT NOT NULL,
    event_name TEXT NOT NULL,
    max_budget REAL,
    created_at TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS conflicts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    conflict_description TEXT NOT NULL,
    dismissed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS inbound_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    to_address TEXT NOT NULL,
    from_address TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_snippet TEXT,
    parsed_event_name TEXT,
    parsed_date TEXT,
    parsed_price REAL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS oauth_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    provider TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    buyer_name TEXT NOT NULL,
    buyer_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'interested',
    created_at TEXT NOT NULL DEFAULT ''
  );
`);

// Add HBS email columns to existing users table if they don't exist yet
try { sqlite.exec("ALTER TABLE users ADD COLUMN hbs_email TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE users ADD COLUMN class_year INTEGER"); } catch {}

export interface IStorage {
  // Users
  getUser(id: number): User | undefined;
  getUserByEmail(email: string): User | undefined;
  createUser(user: InsertUser): User;
  updateUser(id: number, data: Partial<InsertUser>): User | undefined;

  // Tickets
  getTicket(id: number): Ticket | undefined;
  getTicketsByUser(userId: number): Ticket[];
  getAllListedTickets(): Ticket[];
  searchListedTickets(query: string): Ticket[];
  createTicket(ticket: InsertTicket): Ticket;
  updateTicket(id: number, data: Partial<InsertTicket>): Ticket | undefined;
  deleteTicket(id: number): void;

  // Watchlist
  createWatchEntry(entry: InsertWatchlist): Watchlist;
  getWatchlistForEvent(eventName: string): Watchlist[];

  // Conflicts
  getConflictsForTicket(ticketId: number): Conflict[];
  getActiveConflicts(): Conflict[];
  createConflict(conflict: InsertConflict): Conflict;
  dismissConflict(id: number): void;

  // Inbound Emails
  createInboundEmail(email: InsertInboundEmail): InboundEmail;
  getPendingEmails(): InboundEmail[];
  updateEmailStatus(id: number, status: string): void;

  // OAuth Tokens
  saveOAuthToken(token: InsertOAuthToken): OAuthToken;
  getOAuthToken(userId: number, provider: string): OAuthToken | undefined;
  getConnectedProviders(userId: number): string[];

  // Transactions
  createTransaction(t: InsertTransaction): Transaction;
  getTransactionsForTicket(ticketId: number): Transaction[];
  updateTransactionStatus(id: number, status: string): void;
  getTransactionsForUser(userId: number): Transaction[];
}

function now() {
  return new Date().toISOString();
}

export const storage: IStorage = {
  // Users
  getUser(id) {
    return db.select().from(users).where(eq(users.id, id)).get();
  },
  getUserByEmail(email) {
    return db.select().from(users).where(eq(users.email, email)).get();
  },
  createUser(user) {
    return db.insert(users).values({ ...user }).returning().get();
  },
  updateUser(id, data) {
    return db.update(users).set(data).where(eq(users.id, id)).returning().get();
  },

  // Tickets
  getTicket(id) {
    return db.select().from(tickets).where(eq(tickets.id, id)).get();
  },
  getTicketsByUser(userId) {
    return db.select().from(tickets).where(eq(tickets.userId, userId)).orderBy(asc(tickets.eventDate)).all();
  },
  getAllListedTickets() {
    return db.select().from(tickets).where(eq(tickets.isListed, 1)).orderBy(asc(tickets.eventDate)).all();
  },
  searchListedTickets(query) {
    return db.select().from(tickets)
      .where(eq(tickets.isListed, 1))
      .all()
      .filter(t => t.eventName.toLowerCase().includes(query.toLowerCase()));
  },
  createTicket(ticket) {
    return db.insert(tickets).values({ ...ticket, createdAt: now() }).returning().get();
  },
  updateTicket(id, data) {
    const result = db.update(tickets).set(data).where(eq(tickets.id, id)).returning().get();
    return result;
  },
  deleteTicket(id) {
    db.delete(tickets).where(eq(tickets.id, id)).run();
  },

  // Watchlist
  createWatchEntry(entry) {
    return db.insert(watchlist).values({ ...entry, createdAt: now() }).returning().get();
  },
  getWatchlistForEvent(eventName) {
    return db.select().from(watchlist).where(like(watchlist.eventName, `%${eventName}%`)).all();
  },

  // Conflicts
  getConflictsForTicket(ticketId) {
    return db.select().from(conflicts).where(eq(conflicts.ticketId, ticketId)).all();
  },
  getActiveConflicts() {
    return db.select().from(conflicts).where(eq(conflicts.dismissed, 0)).all();
  },
  createConflict(conflict) {
    return db.insert(conflicts).values({ ...conflict, createdAt: now() }).returning().get();
  },
  dismissConflict(id) {
    db.update(conflicts).set({ dismissed: 1 }).where(eq(conflicts.id, id)).run();
  },

  // Inbound emails
  createInboundEmail(email) {
    return db.insert(inboundEmails).values({ ...email, createdAt: now() }).returning().get();
  },
  getPendingEmails() {
    return db.select().from(inboundEmails).where(eq(inboundEmails.status, "pending")).all();
  },
  updateEmailStatus(id, status) {
    db.update(inboundEmails).set({ status }).where(eq(inboundEmails.id, id)).run();
  },

  // OAuth tokens
  saveOAuthToken(token) {
    sqlite.prepare("DELETE FROM oauth_tokens WHERE user_id = ? AND provider = ?").run(token.userId, token.provider);
    return db.insert(oauthTokens).values({ ...token, createdAt: now() }).returning().get();
  },
  getOAuthToken(userId, provider) {
    return db.select().from(oauthTokens)
      .where(eq(oauthTokens.userId, userId))
      .all()
      .find(t => t.provider === provider);
  },
  getConnectedProviders(userId) {
    return db.select().from(oauthTokens)
      .where(eq(oauthTokens.userId, userId))
      .all()
      .map(t => t.provider);
  },

  // Transactions
  createTransaction(t) {
    return db.insert(transactions).values({ ...t, createdAt: now() }).returning().get();
  },
  getTransactionsForTicket(ticketId) {
    return db.select().from(transactions).where(eq(transactions.ticketId, ticketId)).all();
  },
  updateTransactionStatus(id, status) {
    db.update(transactions).set({ status }).where(eq(transactions.id, id)).run();
  },
  getTransactionsForUser(userId) {
    // Get all ticket IDs owned by this user, then find transactions for those tickets
    const userTickets = db.select().from(tickets).where(eq(tickets.userId, userId)).all();
    const ticketIds = userTickets.map(t => t.id);
    if (ticketIds.length === 0) return [];
    return db.select().from(transactions).all().filter(t => ticketIds.includes(t.ticketId));
  },
};

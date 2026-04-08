import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, like, asc, desc } from "drizzle-orm";
import {
  users, tickets, watchlist, conflicts, inboundEmails,
  type User, type InsertUser,
  type Ticket, type InsertTicket,
  type Watchlist, type InsertWatchlist,
  type Conflict, type InsertConflict,
  type InboundEmail, type InsertInboundEmail,
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
`);

export interface IStorage {
  // Users
  getUser(id: number): User | undefined;
  getUserByEmail(email: string): User | undefined;
  createUser(user: InsertUser): User;

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
};

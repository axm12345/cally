import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { priceBundle, type PaymentMethod } from "../payment-pricing";

// Separate demo-only ledger. Never represents real money or paid credits.
let database: DatabaseSync | undefined;
function db() {
  if (database) return database;
  const directory = join(process.cwd(), ".cally-data");
  mkdirSync(directory, { recursive: true });
  database = new DatabaseSync(join(directory, "demo-payments.sqlite"));
  database.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, balance INTEGER NOT NULL CHECK(balance >= 0));
    CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, account TEXT NOT NULL, credits INTEGER NOT NULL, method TEXT NOT NULL, amount INTEGER NOT NULL, status TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS searches (id TEXT PRIMARY KEY, account TEXT NOT NULL, status TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS ledger (id TEXT PRIMARY KEY, account TEXT NOT NULL, reference TEXT UNIQUE NOT NULL, delta INTEGER NOT NULL, kind TEXT NOT NULL, created INTEGER NOT NULL);`);
  const accountColumns = database.prepare("PRAGMA table_info(accounts)").all() as { name: string }[];
  if (!accountColumns.some(column => column.name === "qr_sequence")) database.exec("ALTER TABLE accounts ADD COLUMN qr_sequence INTEGER NOT NULL DEFAULT 0");
  const orderColumns = database.prepare("PRAGMA table_info(orders)").all() as { name: string }[];
  if (!orderColumns.some(column => column.name === "qr_variant")) database.exec("ALTER TABLE orders ADD COLUMN qr_variant INTEGER");
  return database;
}
function transaction<T>(fn: () => T): T {
  const d = db(); d.exec("BEGIN IMMEDIATE");
  try { const value = fn(); d.exec("COMMIT"); return value; }
  catch (error) { d.exec("ROLLBACK"); throw error; }
}
function entry(account: string, reference: string, delta: number, kind: string) {
  db().prepare("INSERT INTO ledger VALUES(?, ?, ?, ?, ?, ?)").run(randomUUID(), account, reference, delta, kind, Date.now());
}
export function accountExists(id: string) { return !!db().prepare("SELECT id FROM accounts WHERE id=?").get(id); }
export function newAccount() {
  const id = randomUUID();
  transaction(() => { db().prepare("INSERT INTO accounts(id, balance) VALUES(?, 3)").run(id); entry(id, `welcome:${id}`, 3, "free_demo_credits"); });
  return id;
}
export function wallet(account: string) {
  return transaction(() => {
    db().prepare("UPDATE orders SET status='expired' WHERE account=? AND status='pending' AND created<?").run(account, Date.now() - 600000);
    const stale = db().prepare("SELECT id FROM searches WHERE account=? AND status='reserved' AND created<?").all(account, Date.now() - 600000) as { id: string }[];
    for (const search of stale) {
      db().prepare("UPDATE searches SET status='released' WHERE id=?").run(search.id);
      db().prepare("UPDATE accounts SET balance=balance+1 WHERE id=?").run(account);
      entry(account, `release:${search.id}`, 1, "expired_reservation_release");
    }
    const row = db().prepare("SELECT balance FROM accounts WHERE id=?").get(account) as { balance: number };
    const reserved = db().prepare("SELECT COUNT(*) AS count FROM searches WHERE account=? AND status='reserved'").get(account) as { count: number };
    return { mode: "demo" as const, balance: row.balance, reserved: reserved.count, orders: db().prepare("SELECT * FROM orders WHERE account=? ORDER BY created DESC LIMIT 8").all(account) };
  });
}
export function createOrder(account: string, credits: number, method: PaymentMethod) {
  const price = priceBundle(credits, method);
  return transaction(() => {
    const id = randomUUID();
    const created = Date.now();
    let qrVariant: number | null = null;
    if (method === "promptpay") {
      const row = db().prepare("SELECT qr_sequence FROM accounts WHERE id=?").get(account) as { qr_sequence: number };
      qrVariant = row.qr_sequence % 2;
      db().prepare("UPDATE accounts SET qr_sequence=qr_sequence+1 WHERE id=?").run(account);
    }
    db().prepare("INSERT INTO orders(id, account, credits, method, amount, status, created, qr_variant) VALUES(?, ?, ?, ?, ?, 'pending', ?, ?)").run(id, account, credits, method, price.totalSatang, created, qrVariant);
    return { id, status: "pending", ...price, mode: "demo", qrVariant, expiresAt: created + 600000 };
  });
}
export function resolveOrder(account: string, id: string, approve: boolean) {
  return transaction(() => {
    const order = db().prepare("SELECT * FROM orders WHERE id=? AND account=?").get(id, account) as { credits: number; status: string; created: number } | undefined;
    if (!order) throw new Error("Order not found.");
    if (order.status !== "pending") return order.status;
    const status = order.created < Date.now() - 600000 ? "expired" : approve ? "demo_paid" : "failed";
    db().prepare("UPDATE orders SET status=? WHERE id=?").run(status, id);
    if (status === "demo_paid") {
      db().prepare("UPDATE accounts SET balance=balance+? WHERE id=?").run(order.credits, account);
      entry(account, `order:${id}`, order.credits, "simulated_purchase");
    }
    return status;
  });
}
export function reserveSearch(account: string) {
  return transaction(() => {
    const changed = db().prepare("UPDATE accounts SET balance=balance-1 WHERE id=? AND balance>=1").run(account);
    if (!changed.changes) throw new Error("No demo credits left. Open search credits to add more.");
    const id = randomUUID();
    db().prepare("INSERT INTO searches VALUES(?, ?, 'reserved', ?)").run(id, account, Date.now());
    entry(account, `reserve:${id}`, -1, "demo_search_reserved");
    return id;
  });
}
export function finishSearch(account: string, id: string) {
  // Until genuine quote comparability is verified server-side, always return the
  // demo credit. Client results and mock quotes cannot authorize paid fulfillment.
  return transaction(() => {
    const changed = db().prepare("UPDATE searches SET status='released' WHERE id=? AND account=? AND status='reserved'").run(id, account);
    if (changed.changes) {
      db().prepare("UPDATE accounts SET balance=balance+1 WHERE id=?").run(account);
      entry(account, `release:${id}`, 1, "demo_credit_returned");
    }
  });
}

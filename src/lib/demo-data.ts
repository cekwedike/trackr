import { getDb } from '@/db/client';
import { createCustomer, deleteCustomer } from '@/db/repos/customers';
import { createExpense, deleteExpense } from '@/db/repos/expenses';
import { createNote, deleteNote } from '@/db/repos/notes';
import { createOrder, deleteOrder } from '@/db/repos/orders';
import { createProduct, deleteProduct } from '@/db/repos/products';
import { createSale, deleteSale } from '@/db/repos/sales';
import { dayjs } from '@/lib/date';
import { toMinor } from '@/lib/money';

/**
 * Sample data for exploring the app.
 *
 * Records are inserted through the EXISTING repo `create*` functions so every
 * invariant / side-effect holds (stock decrements on sales, customer debt on
 * credit sales, order totals, etc.).
 *
 * Tagging / removal — the schema is fixed (no migrations allowed here), so
 * there is no dedicated `is_demo` column. Instead every demo row carries a
 * recognizable marker string, {@link DEMO_TAG}, inside a free-text field that
 * already exists on the table (product/customer/ingredient notes, sale/order
 * notes, expense description, note body). {@link clearDemoData} finds those
 * rows by the marker and deletes them through the repo `delete*` functions so
 * the same side-effects are reversed.
 *
 * Limitation: if a user manually types the exact marker "[TRACKR_DEMO]" into
 * one of those fields, that record would also be treated as demo data and
 * removed by Clear. The marker is deliberately unusual to make this unlikely.
 */
export const DEMO_TAG = '[TRACKR_DEMO]';

export interface DemoCounts {
  products: number;
  customers: number;
  sales: number;
  expenses: number;
  orders: number;
  notes: number;
}

const emptyCounts = (): DemoCounts => ({
  products: 0,
  customers: 0,
  sales: 0,
  expenses: 0,
  orders: 0,
  notes: 0,
});

/** Suffix a free-text field with the demo marker so the row can be found later. */
function tag(text: string): string {
  return `${text} ${DEMO_TAG}`;
}

/**
 * Insert a small, realistic sample dataset. Safe to call more than once (each
 * call adds a fresh, independently-removable batch). Returns counts inserted.
 */
export async function loadDemoData(): Promise<DemoCounts> {
  const counts = emptyCounts();

  // --- Inventory / products ---
  const waterId = await createProduct({
    name: 'Bottled Water (50cl)',
    category: 'Drinks',
    sku: 'DRK-001',
    price: toMinor(200),
    cost: toMinor(120),
    stock: 80,
    unit: 'pcs',
    low_stock_threshold: 20,
    notes: tag('Sample product.'),
  });
  counts.products++;

  const breadId = await createProduct({
    name: 'Loaf of Bread',
    category: 'Bakery',
    sku: 'BKY-010',
    price: toMinor(1200),
    cost: toMinor(750),
    stock: 24,
    unit: 'pcs',
    low_stock_threshold: 6,
    notes: tag('Sample product.'),
  });
  counts.products++;

  const pieId = await createProduct({
    name: 'Chicken Pie',
    category: 'Bakery',
    sku: 'BKY-021',
    price: toMinor(800),
    cost: toMinor(450),
    stock: 40,
    unit: 'pcs',
    low_stock_threshold: 10,
    notes: tag('Sample product.'),
  });
  counts.products++;

  // --- Customers ---
  const adaId = await createCustomer({
    name: 'Ada Obi',
    phone: '0801 234 5678',
    email: 'ada@example.com',
    note: tag('Sample customer.'),
  });
  counts.customers++;

  const johnId = await createCustomer({
    name: 'John Doe',
    phone: '0802 987 6543',
    note: tag('Sample customer.'),
  });
  counts.customers++;

  // --- Sales (one cash, one credit) ---
  await createSale({
    occurred_at: dayjs().subtract(2, 'day').toISOString(),
    payment_method: 'cash',
    customer_id: adaId,
    note: tag('Sample sale.'),
    items: [
      { product_id: waterId, name: 'Bottled Water (50cl)', qty: 3, unit_price: toMinor(200), unit_cost: toMinor(120) },
      { product_id: pieId, name: 'Chicken Pie', qty: 2, unit_price: toMinor(800), unit_cost: toMinor(450) },
    ],
  });
  counts.sales++;

  // A credit sale — createSale adds the total to the customer's debt balance.
  await createSale({
    occurred_at: dayjs().subtract(1, 'day').toISOString(),
    payment_method: 'credit',
    customer_id: johnId,
    note: tag('Sample credit sale.'),
    items: [
      { product_id: breadId, name: 'Loaf of Bread', qty: 4, unit_price: toMinor(1200), unit_cost: toMinor(750) },
    ],
  });
  counts.sales++;

  // --- Expenses ---
  await createExpense({
    occurred_at: dayjs().subtract(3, 'day').toISOString(),
    amount: toMinor(3500),
    description: tag('Baking supplies.'),
    category: 'Supplies',
    payment_method: 'cash',
  });
  counts.expenses++;

  // --- Order ---
  await createOrder({
    customer_id: adaId,
    customer_name: 'Ada Obi',
    status: 'pending',
    due_at: dayjs().add(2, 'day').toISOString(),
    amount_paid: toMinor(500),
    note: tag('Sample order.'),
    items: [
      { product_id: pieId, name: 'Chicken Pie', qty: 6, unit_price: toMinor(800) },
    ],
  });
  counts.orders++;

  // --- Note ---
  await createNote({
    title: 'Welcome to Trackr (demo)',
    body: `This is a sample note you can safely delete. ${DEMO_TAG}`,
  });
  counts.notes++;

  return counts;
}

interface IdRow {
  id: number;
}

/** Ids of rows whose free-text `field` contains the demo marker. */
async function demoIds(table: string, field: string): Promise<number[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<IdRow>(
    `SELECT id FROM ${table} WHERE ${field} LIKE ? ORDER BY id DESC`,
    [`%${DEMO_TAG}%`],
  );
  return rows.map((r) => r.id);
}

/**
 * Remove only the demo-tagged records, deleting through the repo `delete*`
 * functions so side-effects are reversed (sale stock/debt, cascade of items).
 * Sales are removed first (restoring stock and clearing the demo credit debt)
 * before their products/customers. Returns counts removed.
 */
export async function clearDemoData(): Promise<DemoCounts> {
  const counts = emptyCounts();

  for (const id of await demoIds('sales', 'note')) {
    await deleteSale(id);
    counts.sales++;
  }
  for (const id of await demoIds('orders', 'note')) {
    await deleteOrder(id);
    counts.orders++;
  }
  for (const id of await demoIds('expenses', 'description')) {
    await deleteExpense(id);
    counts.expenses++;
  }
  for (const id of await demoIds('notes', 'body')) {
    await deleteNote(id);
    counts.notes++;
  }
  for (const id of await demoIds('products', 'notes')) {
    await deleteProduct(id);
    counts.products++;
  }
  for (const id of await demoIds('customers', 'note')) {
    await deleteCustomer(id);
    counts.customers++;
  }

  return counts;
}

/** Total number of demo rows currently present (used to enable the Clear action). */
export async function countDemoData(): Promise<number> {
  const groups = await Promise.all([
    demoIds('sales', 'note'),
    demoIds('orders', 'note'),
    demoIds('expenses', 'description'),
    demoIds('notes', 'body'),
    demoIds('products', 'notes'),
    demoIds('customers', 'note'),
  ]);
  return groups.reduce((sum, g) => sum + g.length, 0);
}

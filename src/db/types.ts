export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'pos' | 'credit' | 'other';
export type OrderStatus = 'pending' | 'in_progress' | 'ready' | 'delivered' | 'cancelled';
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';
export type LinkTargetType = 'note' | 'product' | 'sale' | 'order' | 'customer' | 'expense';

export interface Settings {
  id: number;
  business_name: string;
  currency_code: string;
  currency_symbol: string;
  locale: string;
  industry: string;
  profit_allocation: string; // JSON string of AllocationBucket[]
  lock_enabled: number;
  biometric_enabled: number;
  onboarded: number;
  created_at: string;
  updated_at: string;
}

export interface AllocationBucket {
  name: string;
  percent: number;
}

/** A resolved allocation slice: a bucket plus the money (minor units) assigned to it. */
export interface AllocationSlice {
  name: string;
  percent: number;
  amount: number;
}

/**
 * A saved monthly profit snapshot (cash-basis). One row per calendar month.
 * Amounts are integer minor units; `allocation` is a JSON `AllocationSlice[]`.
 */
export interface ProfitRecord {
  id: number;
  month: string; // 'YYYY-MM'
  revenue: number;
  cogs: number;
  expenses: number;
  net_profit: number;
  allocation: string; // JSON string of AllocationSlice[]
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  name: string;
  category: string | null;
  sku: string | null;
  price: number;
  cost: number;
  stock: number;
  unit: string;
  low_stock_threshold: number;
  image_uri: string | null;
  notes: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Ingredient {
  id: number;
  name: string;
  unit: string;
  qty_on_hand: number;
  unit_cost: number;
  reorder_threshold: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Recipe {
  id: number;
  product_id: number | null;
  name: string;
  yield_qty: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeItem {
  id: number;
  recipe_id: number;
  ingredient_id: number | null;
  name: string;
  qty: number;
  unit: string | null;
}

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  address: string | null;
  note: string | null;
  debt_balance: number;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: number;
  occurred_at: string;
  payment_method: PaymentMethod;
  customer_id: number | null;
  total: number;
  cost_total: number;
  note: string | null;
  created_at: string;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number | null;
  name: string;
  qty: number;
  unit_price: number;
  unit_cost: number;
  line_total: number;
}

export interface Expense {
  id: number;
  occurred_at: string;
  amount: number;
  description: string | null;
  category: string | null;
  payment_method: string | null;
  created_at: string;
}

export interface Order {
  id: number;
  customer_id: number | null;
  customer_name: string | null;
  status: OrderStatus;
  due_at: string | null;
  total: number;
  amount_paid: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number | null;
  name: string;
  qty: number;
  unit_price: number;
  line_total: number;
}

export interface Note {
  id: number;
  title: string;
  body: string;
  pinned: number;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface Link {
  id: number;
  source_note_id: number;
  target_type: LinkTargetType;
  target_id: number | null;
  target_title: string | null;
  created_at: string;
}

export interface Reminder {
  id: number;
  title: string;
  body: string | null;
  due_at: string;
  recurrence: Recurrence;
  completed: number;
  notification_id: string | null;
  target_type: string | null;
  target_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: number;
  item_type: 'product' | 'ingredient';
  item_id: number;
  change: number;
  reason: string | null;
  created_at: string;
}

/** A recorded payment against an order balance or a customer's outstanding debt. */
export interface Payment {
  id: number;
  kind: 'order' | 'debt';
  ref_id: number; // order id when kind='order', customer id when kind='debt'
  amount: number;
  method: string;
  note: string | null;
  created_at: string;
}

/** A rule that auto-creates a recurring expense on a cadence. */
export interface RecurringRule {
  id: number;
  kind: 'expense';
  amount: number;
  category: string | null;
  description: string | null;
  payment_method: string | null;
  cadence: 'daily' | 'weekly' | 'monthly';
  next_run: string;
  last_run: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

/** A single entry in the activity/audit log. */
export interface AuditEntry {
  id: number;
  entity: string;
  entity_id: number | null;
  action: 'create' | 'update' | 'delete';
  summary: string;
  created_at: string;
}

/** A file/photo attached to a sale or expense. */
export interface Attachment {
  id: number;
  entity: 'sale' | 'expense';
  entity_id: number;
  uri: string;
  mime: string | null;
  created_at: string;
}

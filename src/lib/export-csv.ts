import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { listCustomers } from '@/db/repos/customers';
import { listExpenses } from '@/db/repos/expenses';
import { listOrders } from '@/db/repos/orders';
import { listProducts } from '@/db/repos/products';
import { listSales } from '@/db/repos/sales';
import { dayjs, formatDate, formatDateTime } from '@/lib/date';
import { fromMinor } from '@/lib/money';

/**
 * Per-module CSV export.
 *
 * Each `export*Csv` function reads rows via the EXISTING repo list functions,
 * builds an RFC-4180-safe document with {@link toCsv}, writes it to a file in
 * the cache directory using the expo-file-system `File`/`Paths` API (SDK 57),
 * and opens the OS share sheet via expo-sharing so the user can save it to
 * Files/Drive or email it.
 *
 * Money is stored everywhere as integer minor units; CSV cells render it as a
 * plain major-unit decimal (e.g. `1500.00`) with no currency symbol so the
 * value is spreadsheet-friendly. Dates render in the app's human format.
 */

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

export interface CsvExportResult {
  count: number;
  uri: string | null;
}

/** Money (minor units) -> plain major-unit decimal string, e.g. 20000 -> "200.00". */
function money(minor: number): string {
  return fromMinor(minor ?? 0).toFixed(2);
}

/** Escape a single field per RFC-4180: quote if it contains ", comma, CR or LF; double embedded quotes. */
function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build an RFC-4180 document (CRLF line breaks) from rows + column definitions. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(',');
  if (rows.length === 0) return header;
  const body = rows
    .map((row) => columns.map((c) => escapeCell(c.value(row))).join(','))
    .join('\r\n');
  return `${header}\r\n${body}`;
}

/** Write a CSV string to a cache file and open the share sheet. Returns the file uri. */
async function shareCsv(baseName: string, csv: string): Promise<string> {
  const filename = `${baseName}-${dayjs().format('YYYY-MM-DD-HHmm')}.csv`;
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(csv);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/csv',
      UTI: 'public.comma-separated-values-text',
      dialogTitle: 'Export CSV',
    });
  }
  return file.uri;
}

/** Generic pipeline: fetch rows, and (only when non-empty) build + share the CSV. */
async function exportCsv<T>(
  baseName: string,
  load: () => Promise<T[]>,
  columns: CsvColumn<T>[],
): Promise<CsvExportResult> {
  const rows = await load();
  if (rows.length === 0) return { count: 0, uri: null };
  const uri = await shareCsv(baseName, toCsv(rows, columns));
  return { count: rows.length, uri };
}

export function exportSalesCsv(): Promise<CsvExportResult> {
  return exportCsv('trackr-sales', () => listSales(100000), [
    { header: 'ID', value: (s) => s.id },
    { header: 'Date', value: (s) => formatDateTime(s.occurred_at) },
    { header: 'Payment method', value: (s) => s.payment_method },
    { header: 'Customer', value: (s) => s.customer_name },
    { header: 'Items', value: (s) => s.item_count },
    { header: 'Total', value: (s) => money(s.total) },
    { header: 'Cost', value: (s) => money(s.cost_total) },
    { header: 'Profit', value: (s) => money(s.total - s.cost_total) },
    { header: 'Note', value: (s) => s.note },
  ]);
}

export function exportExpensesCsv(): Promise<CsvExportResult> {
  return exportCsv('trackr-expenses', () => listExpenses(100000), [
    { header: 'ID', value: (e) => e.id },
    { header: 'Date', value: (e) => formatDateTime(e.occurred_at) },
    { header: 'Amount', value: (e) => money(e.amount) },
    { header: 'Category', value: (e) => e.category },
    { header: 'Description', value: (e) => e.description },
    { header: 'Payment method', value: (e) => e.payment_method },
    { header: 'Tax rate %', value: (e) => e.tax_rate ?? 0 },
  ]);
}

export function exportCustomersCsv(): Promise<CsvExportResult> {
  return exportCsv('trackr-customers', () => listCustomers(), [
    { header: 'ID', value: (c) => c.id },
    { header: 'Name', value: (c) => c.name },
    { header: 'Phone', value: (c) => c.phone },
    { header: 'Email', value: (c) => c.email },
    { header: 'Birthday', value: (c) => formatDate(c.birthday) },
    { header: 'Address', value: (c) => c.address },
    { header: 'Debt balance', value: (c) => money(c.debt_balance) },
    { header: 'Note', value: (c) => c.note },
  ]);
}

export function exportInventoryCsv(): Promise<CsvExportResult> {
  return exportCsv('trackr-inventory', () => listProducts(true), [
    { header: 'ID', value: (p) => p.id },
    { header: 'Name', value: (p) => p.name },
    { header: 'Category', value: (p) => p.category },
    { header: 'SKU', value: (p) => p.sku },
    { header: 'Price', value: (p) => money(p.price) },
    { header: 'Cost', value: (p) => money(p.cost) },
    { header: 'Stock', value: (p) => p.stock },
    { header: 'Unit', value: (p) => p.unit },
    { header: 'Low stock threshold', value: (p) => p.low_stock_threshold },
    { header: 'Active', value: (p) => (p.is_active ? 'Yes' : 'No') },
    { header: 'Notes', value: (p) => p.notes },
  ]);
}

export function exportOrdersCsv(): Promise<CsvExportResult> {
  return exportCsv('trackr-orders', () => listOrders(), [
    { header: 'ID', value: (o) => o.id },
    { header: 'Customer', value: (o) => o.customer_name },
    { header: 'Status', value: (o) => o.status },
    { header: 'Due date', value: (o) => formatDate(o.due_at) },
    { header: 'Total', value: (o) => money(o.total) },
    { header: 'Amount paid', value: (o) => money(o.amount_paid) },
    { header: 'Balance', value: (o) => money(o.total - o.amount_paid) },
    { header: 'Created', value: (o) => formatDateTime(o.created_at) },
    { header: 'Note', value: (o) => o.note },
  ]);
}

import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { alertAsync } from '@/components/confirm';
import type { Order, OrderItem, Sale, SaleItem } from '@/db/types';
import { hexToRgba, shade } from '@/lib/color';
import { dayjs, formatDateTime } from '@/lib/date';
import { toUserMessage } from '@/lib/errors';
import { formatMoney, formatQty } from '@/lib/money';

export type ReceiptKind = 'receipt' | 'invoice';

export interface ReceiptLine {
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ReceiptData {
  kind: ReceiptKind;
  businessName: string;
  currencySymbol: string;
  accent: string;
  number: string;
  dateLabel: string;
  customerName?: string | null;
  lines: ReceiptLine[];
  subtotal: number;
  total: number;
  amountPaid?: number;
  balanceDue?: number;
  paymentMethod?: string | null;
  statusLabel?: string | null;
  note?: string | null;
}

interface BrandInfo {
  businessName: string;
  currencySymbol: string;
  accent: string;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  transfer: 'Bank transfer',
  card: 'Card',
  pos: 'POS',
  credit: 'Credit',
  other: 'Other',
};

function paymentLabel(method?: string | null): string | null {
  if (!method) return null;
  return PAYMENT_LABELS[method] ?? method.charAt(0).toUpperCase() + method.slice(1);
}

function docNumber(id: number): string {
  return String(id).padStart(4, '0');
}

/** Build the shared receipt/invoice model for a sale. */
export function saleToReceipt(
  sale: Sale,
  items: SaleItem[],
  customerName: string | null | undefined,
  brand: BrandInfo,
): ReceiptData {
  return {
    kind: 'receipt',
    businessName: brand.businessName,
    currencySymbol: brand.currencySymbol,
    accent: brand.accent,
    number: docNumber(sale.id),
    dateLabel: formatDateTime(sale.occurred_at),
    customerName: customerName ?? null,
    lines: items.map((it) => ({ name: it.name, qty: it.qty, unitPrice: it.unit_price, lineTotal: it.line_total })),
    subtotal: sale.total,
    total: sale.total,
    paymentMethod: paymentLabel(sale.payment_method),
    note: sale.note,
  };
}

/** Build the shared receipt/invoice model for an order. */
export function orderToReceipt(
  order: Order,
  items: OrderItem[],
  brand: BrandInfo,
  statusLabel?: string | null,
): ReceiptData {
  return {
    kind: 'invoice',
    businessName: brand.businessName,
    currencySymbol: brand.currencySymbol,
    accent: brand.accent,
    number: docNumber(order.id),
    dateLabel: formatDateTime(order.created_at),
    customerName: order.customer_name,
    lines: items.map((it) => ({ name: it.name, qty: it.qty, unitPrice: it.unit_price, lineTotal: it.line_total })),
    subtotal: order.total,
    total: order.total,
    amountPaid: order.amount_paid,
    balanceDue: order.total - order.amount_paid,
    statusLabel: statusLabel ?? null,
    note: order.note,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Render a branded, inline-styled HTML document for a receipt or invoice. */
export function buildReceiptHtml(data: ReceiptData): string {
  const money = (minor: number) => escapeHtml(formatMoney(minor, data.currencySymbol));
  const accent = data.accent;
  const accentDark = shade(accent, -0.25);
  const accentSoft = hexToRgba(accent, 0.1);
  const label = data.kind === 'invoice' ? 'INVOICE' : 'RECEIPT';
  const numberPrefix = data.kind === 'invoice' ? 'INV' : 'RCT';
  const initial = escapeHtml((data.businessName.trim()[0] ?? 'T').toUpperCase());

  const rows = data.lines
    .map((line, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      return `
        <tr style="background:${bg};">
          <td style="padding:10px 12px;font-size:13px;color:#0f172a;">${escapeHtml(line.name)}</td>
          <td style="padding:10px 12px;font-size:13px;color:#475569;text-align:center;white-space:nowrap;">${escapeHtml(formatQty(line.qty))}</td>
          <td style="padding:10px 12px;font-size:13px;color:#475569;text-align:right;white-space:nowrap;">${money(line.unitPrice)}</td>
          <td style="padding:10px 12px;font-size:13px;color:#0f172a;text-align:right;white-space:nowrap;font-weight:600;">${money(line.lineTotal)}</td>
        </tr>`;
    })
    .join('');

  const totalsRows: string[] = [];
  totalsRows.push(totalRow('Subtotal', money(data.subtotal), '#475569'));
  totalsRows.push(
    `<tr>
      <td style="padding:12px 0 4px;"></td>
      <td style="padding:14px 0 4px;border-top:2px solid ${accent};text-align:right;">
        <div style="font-size:12px;letter-spacing:0.08em;color:#64748b;text-transform:uppercase;">Total</div>
        <div style="font-size:22px;font-weight:700;color:${accentDark};">${money(data.total)}</div>
      </td>
    </tr>`,
  );
  if (data.amountPaid != null) totalsRows.push(totalRow('Amount paid', money(data.amountPaid), '#16a34a'));
  if (data.balanceDue != null) {
    const balanceColor = data.balanceDue > 0 ? '#b45309' : '#16a34a';
    totalsRows.push(totalRow('Balance due', money(data.balanceDue), balanceColor, true));
  }

  const metaRows: string[] = [];
  metaRows.push(metaRow(data.kind === 'invoice' ? 'Invoice no.' : 'Receipt no.', `${numberPrefix}-${escapeHtml(data.number)}`));
  metaRows.push(metaRow('Date', escapeHtml(data.dateLabel)));
  if (data.statusLabel) metaRows.push(metaRow('Status', escapeHtml(data.statusLabel)));
  if (data.paymentMethod) metaRows.push(metaRow('Payment', escapeHtml(data.paymentMethod)));

  const customerBlock = data.customerName
    ? `<div style="margin-top:2px;">
         <div style="font-size:11px;letter-spacing:0.08em;color:#94a3b8;text-transform:uppercase;">Billed to</div>
         <div style="font-size:16px;font-weight:600;color:#0f172a;margin-top:2px;">${escapeHtml(data.customerName)}</div>
       </div>`
    : '';

  const noteBlock = data.note
    ? `<div style="margin-top:20px;padding:14px 16px;background:${accentSoft};border-radius:12px;border-left:4px solid ${accent};">
         <div style="font-size:11px;letter-spacing:0.08em;color:${accentDark};text-transform:uppercase;font-weight:600;">Note</div>
         <div style="font-size:13px;color:#334155;margin-top:4px;line-height:1.5;">${escapeHtml(data.note)}</div>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <style>@page { margin: 24px; }</style>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
    <div style="max-width:640px;margin:0 auto;padding:8px;color:#0f172a;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:24px;border-radius:16px;background:linear-gradient(135deg, ${accent}, ${accentDark});color:#ffffff;">
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:52px;height:52px;border-radius:14px;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;">${initial}</div>
          <div>
            <div style="font-size:22px;font-weight:700;line-height:1.1;">${escapeHtml(data.businessName)}</div>
            <div style="font-size:12px;opacity:0.85;margin-top:2px;">${data.kind === 'invoice' ? 'Invoice' : 'Sales receipt'}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:24px;font-weight:800;letter-spacing:0.12em;">${label}</div>
          <div style="font-size:12px;opacity:0.85;margin-top:2px;">${numberPrefix}-${escapeHtml(data.number)}</div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;gap:24px;padding:22px 4px 6px;flex-wrap:wrap;">
        ${customerBlock}
        <table style="border-collapse:collapse;margin-left:auto;">
          ${metaRows.join('')}
        </table>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-top:14px;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <thead>
          <tr style="background:${accent};color:#ffffff;">
            <th style="padding:11px 12px;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;text-align:left;">Item</th>
            <th style="padding:11px 12px;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;text-align:center;">Qty</th>
            <th style="padding:11px 12px;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;text-align:right;">Unit</th>
            <th style="padding:11px 12px;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <table style="width:100%;border-collapse:collapse;margin-top:10px;">
        <tbody>
          <tr>
            <td style="width:55%;"></td>
            <td style="width:45%;">
              <table style="width:100%;border-collapse:collapse;">${totalsRows.join('')}</table>
            </td>
          </tr>
        </tbody>
      </table>

      ${noteBlock}

      <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:11px;letter-spacing:0.04em;">
        Made with <span style="color:${accentDark};font-weight:700;">Trackr</span>
      </div>
    </div>
  </body>
</html>`;
}

function metaRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:2px 12px 2px 0;font-size:12px;color:#94a3b8;text-align:right;white-space:nowrap;">${label}</td>
    <td style="padding:2px 0;font-size:13px;color:#0f172a;font-weight:600;text-align:right;white-space:nowrap;">${value}</td>
  </tr>`;
}

function totalRow(label: string, value: string, color: string, strong = false): string {
  return `<tr>
    <td style="padding:4px 0;font-size:13px;color:#64748b;text-align:left;">${label}</td>
    <td style="padding:4px 0;font-size:${strong ? '15px' : '13px'};font-weight:${strong ? 700 : 500};color:${color};text-align:right;white-space:nowrap;">${value}</td>
  </tr>`;
}

function friendlyError(action: string, error: unknown): void {
  void alertAsync({ title: `Couldn't ${action}`, message: toUserMessage(error) });
}

/** Collapse anything the OS filesystem dislikes into hyphens (no slashes, colons, etc.). */
function safeFileName(value: string): string {
  return value
    .replace(/[/\\?%*:|"<>\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Human-friendly PDF name, e.g. `Trackr-invoice-0012-2026-07-21.pdf`.
 * expo-print writes the PDF to a temp cache path with a random UUID name, so we
 * copy it to this basename before sharing — most share sheets show the file's
 * basename, so this is what the user sees when saving/emailing.
 */
function receiptFileName(data: ReceiptData): string {
  const date = dayjs().format('YYYY-MM-DD');
  return `${safeFileName(`Trackr-${data.kind}-${data.number}-${date}`)}.pdf`;
}

/** Generate a PDF and open the OS share sheet. Falls back gracefully if sharing is unavailable. */
export async function shareReceipt(data: ReceiptData): Promise<void> {
  try {
    const { uri } = await Print.printToFileAsync({ html: buildReceiptHtml(data) });

    // expo-print names the PDF with a random UUID; re-home it under a friendly
    // basename so the share sheet / saved file shows a clear name, not a UUID.
    const out = new File(Paths.cache, receiptFileName(data));
    if (out.exists) out.delete();
    new File(uri).move(out);

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      void alertAsync({
        title: 'Sharing unavailable',
        message: `Sharing isn't available on this device. The ${data.kind} was saved as a PDF instead.`,
      });
      return;
    }
    await Sharing.shareAsync(out.uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: data.kind === 'invoice' ? 'Send invoice' : 'Share receipt',
    });
  } catch (error) {
    friendlyError(data.kind === 'invoice' ? 'send the invoice' : 'share the receipt', error);
  }
}

/** Send the document straight to the native print dialog (AirPrint / Android print). */
export async function printReceipt(data: ReceiptData): Promise<void> {
  try {
    await Print.printAsync({ html: buildReceiptHtml(data) });
  } catch (error) {
    friendlyError('print', error);
  }
}

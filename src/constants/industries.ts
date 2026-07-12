import type { IconName } from '@/components/ui';
import type { AllocationBucket } from '@/db/types';

/** Ordered dashboard widgets. Rendered top-to-bottom by the DashboardRenderer. */
export type WidgetKey =
  | 'hero'
  | 'quickActions'
  | 'profit'
  | 'stats'
  | 'pipeline'
  | 'appointments'
  | 'lowStock'
  | 'production'
  | 'bestSellers'
  | 'clients'
  | 'debts'
  | 'reminders'
  | 'expenses'
  | 'ledger';

export type QuickActionKey = 'sale' | 'expense' | 'order' | 'product' | 'customer' | 'profit' | 'reminder' | 'recipe';

export interface IndustryTerms {
  item: string;
  items: string;
  sale: string;
  sales: string;
  order: string;
  orders: string;
  customer: string;
  customers: string;
  inventoryLabel: string;
  productionLabel: string;
}

export interface IndustryConfig {
  id: string;
  name: string;
  tagline: string;
  icon: IconName;
  accent: string;
  terms: IndustryTerms;
  widgets: WidgetKey[];
  quickActions: QuickActionKey[];
  defaultAllocation: AllocationBucket[];
  modules: { inventory: boolean; production: boolean; orders: boolean; customers: boolean };
}

// ---- Reusable profit-allocation templates (all editable by the user later) ----
const ALLOC_BAKERY: AllocationBucket[] = [
  { name: 'Back into business', percent: 50 },
  { name: 'Savings', percent: 20 },
  { name: 'Emergency funds', percent: 10 },
  { name: 'Tithes', percent: 10 },
  { name: 'My gain', percent: 10 },
];
const ALLOC_PRODUCT: AllocationBucket[] = [
  { name: 'Reinvest in stock', percent: 40 },
  { name: 'Savings', percent: 25 },
  { name: 'Emergency funds', percent: 15 },
  { name: 'Owner pay', percent: 20 },
];
const ALLOC_SERVICE: AllocationBucket[] = [
  { name: 'Owner pay', percent: 50 },
  { name: 'Savings', percent: 25 },
  { name: 'Taxes', percent: 15 },
  { name: 'Tools & growth', percent: 10 },
];
const ALLOC_GENERAL: AllocationBucket[] = [
  { name: 'Reinvest', percent: 40 },
  { name: 'Savings', percent: 30 },
  { name: 'Emergency funds', percent: 15 },
  { name: 'Personal', percent: 15 },
];

const T = (over: Partial<IndustryTerms>): IndustryTerms => ({
  item: 'Product',
  items: 'Products',
  sale: 'Sale',
  sales: 'Sales',
  order: 'Order',
  orders: 'Orders',
  customer: 'Customer',
  customers: 'Customers',
  inventoryLabel: 'Inventory',
  productionLabel: 'Recipes',
  ...over,
});

export const INDUSTRIES: IndustryConfig[] = [
  {
    id: 'bakery',
    name: 'Bakery & Pastry',
    tagline: 'Cakes, bread and sweet treats',
    icon: 'cafe',
    accent: '#EC4899',
    terms: T({ inventoryLabel: 'Inventory', productionLabel: 'Recipes' }),
    widgets: ['hero', 'quickActions', 'profit', 'stats', 'production', 'lowStock', 'bestSellers', 'reminders'],
    quickActions: ['sale', 'expense', 'recipe', 'profit'],
    defaultAllocation: ALLOC_BAKERY,
    modules: { inventory: true, production: true, orders: true, customers: true },
  },
  {
    id: 'catering',
    name: 'Catering',
    tagline: 'Events, packages and headcounts',
    icon: 'restaurant',
    accent: '#F59E0B',
    terms: T({ item: 'Package', items: 'Packages', order: 'Event', orders: 'Events', customer: 'Client', customers: 'Clients', inventoryLabel: 'Supplies', productionLabel: 'Menus' }),
    widgets: ['hero', 'quickActions', 'profit', 'pipeline', 'appointments', 'clients', 'debts', 'reminders'],
    quickActions: ['order', 'sale', 'expense', 'customer'],
    defaultAllocation: ALLOC_PRODUCT,
    modules: { inventory: true, production: true, orders: true, customers: true },
  },
  {
    id: 'restaurant',
    name: 'Restaurant & Chef',
    tagline: 'Menus, dishes and daily covers',
    icon: 'fast-food',
    accent: '#EF4444',
    terms: T({ item: 'Dish', items: 'Dishes', inventoryLabel: 'Menu', productionLabel: 'Recipes' }),
    widgets: ['hero', 'quickActions', 'profit', 'stats', 'bestSellers', 'lowStock', 'expenses', 'reminders'],
    quickActions: ['sale', 'expense', 'recipe', 'profit'],
    defaultAllocation: ALLOC_PRODUCT,
    modules: { inventory: true, production: true, orders: true, customers: true },
  },
  {
    id: 'fashion',
    name: 'Fashion & Tailoring',
    tagline: 'Garments, clients and fittings',
    icon: 'shirt',
    accent: '#8B5CF6',
    terms: T({ item: 'Garment', items: 'Garments', order: 'Job', orders: 'Jobs', customer: 'Client', customers: 'Clients', inventoryLabel: 'Materials', productionLabel: 'Patterns' }),
    widgets: ['hero', 'quickActions', 'pipeline', 'appointments', 'clients', 'debts', 'expenses', 'reminders'],
    quickActions: ['order', 'expense', 'customer', 'profit'],
    defaultAllocation: ALLOC_SERVICE,
    modules: { inventory: true, production: false, orders: true, customers: true },
  },
  {
    id: 'salon',
    name: 'Beauty, Salon & Barber',
    tagline: 'Services, appointments and regulars',
    icon: 'cut',
    accent: '#D946EF',
    terms: T({ item: 'Service', items: 'Services', order: 'Appointment', orders: 'Appointments', customer: 'Client', customers: 'Clients', inventoryLabel: 'Products', productionLabel: 'Services' }),
    widgets: ['hero', 'quickActions', 'appointments', 'stats', 'clients', 'bestSellers', 'reminders'],
    quickActions: ['sale', 'order', 'expense', 'customer'],
    defaultAllocation: ALLOC_SERVICE,
    modules: { inventory: true, production: false, orders: true, customers: true },
  },
  {
    id: 'retail',
    name: 'Retail & Provisions',
    tagline: 'Stock, fast movers and margins',
    icon: 'cart',
    accent: '#0EA5E9',
    terms: T({ inventoryLabel: 'Inventory', productionLabel: 'Stock' }),
    widgets: ['hero', 'quickActions', 'profit', 'stats', 'lowStock', 'bestSellers', 'debts', 'reminders'],
    quickActions: ['sale', 'expense', 'product', 'profit'],
    defaultAllocation: ALLOC_PRODUCT,
    modules: { inventory: true, production: false, orders: true, customers: true },
  },
  {
    id: 'photography',
    name: 'Photography & Creatives',
    tagline: 'Projects, deposits and deliverables',
    icon: 'camera',
    accent: '#14B8A6',
    terms: T({ item: 'Package', items: 'Packages', order: 'Project', orders: 'Projects', customer: 'Client', customers: 'Clients', inventoryLabel: 'Gear', productionLabel: 'Shoots' }),
    widgets: ['hero', 'quickActions', 'pipeline', 'appointments', 'clients', 'debts', 'expenses', 'reminders'],
    quickActions: ['order', 'expense', 'customer', 'profit'],
    defaultAllocation: ALLOC_SERVICE,
    modules: { inventory: false, production: false, orders: true, customers: true },
  },
  {
    id: 'freelancer',
    name: 'Freelancer & Services',
    tagline: 'Clients, projects and invoices',
    icon: 'laptop',
    accent: '#6366F1',
    terms: T({ item: 'Service', items: 'Services', order: 'Project', orders: 'Projects', customer: 'Client', customers: 'Clients', inventoryLabel: 'Services', productionLabel: 'Deliverables' }),
    widgets: ['hero', 'quickActions', 'pipeline', 'clients', 'expenses', 'debts', 'reminders'],
    quickActions: ['order', 'sale', 'expense', 'profit'],
    defaultAllocation: ALLOC_SERVICE,
    modules: { inventory: false, production: false, orders: true, customers: true },
  },
  {
    id: 'farming',
    name: 'Farming & Agriculture',
    tagline: 'Produce, harvests and inputs',
    icon: 'leaf',
    accent: '#22C55E',
    terms: T({ item: 'Produce', items: 'Produce', customer: 'Buyer', customers: 'Buyers', inventoryLabel: 'Harvest', productionLabel: 'Crops' }),
    widgets: ['hero', 'quickActions', 'profit', 'stats', 'lowStock', 'expenses', 'reminders'],
    quickActions: ['sale', 'expense', 'product', 'profit'],
    defaultAllocation: ALLOC_PRODUCT,
    modules: { inventory: true, production: false, orders: true, customers: true },
  },
  {
    id: 'drinks',
    name: 'Drinks & Beverages',
    tagline: 'Smoothies, juice and batches',
    icon: 'wine',
    accent: '#F97316',
    terms: T({ item: 'Drink', items: 'Drinks', inventoryLabel: 'Stock', productionLabel: 'Batches' }),
    widgets: ['hero', 'quickActions', 'profit', 'stats', 'production', 'lowStock', 'bestSellers', 'reminders'],
    quickActions: ['sale', 'expense', 'recipe', 'profit'],
    defaultAllocation: ALLOC_PRODUCT,
    modules: { inventory: true, production: true, orders: true, customers: true },
  },
  {
    id: 'fitness',
    name: 'Fitness & Coaching',
    tagline: 'Clients, sessions and plans',
    icon: 'barbell',
    accent: '#10B981',
    terms: T({ item: 'Plan', items: 'Plans', order: 'Session', orders: 'Sessions', customer: 'Client', customers: 'Clients', inventoryLabel: 'Equipment', productionLabel: 'Programs' }),
    widgets: ['hero', 'quickActions', 'appointments', 'clients', 'stats', 'debts', 'reminders'],
    quickActions: ['order', 'sale', 'expense', 'customer'],
    defaultAllocation: ALLOC_SERVICE,
    modules: { inventory: false, production: false, orders: true, customers: true },
  },
  {
    id: 'events',
    name: 'Events & Rentals',
    tagline: 'Bookings, deposits and assets',
    icon: 'sparkles',
    accent: '#A855F7',
    terms: T({ item: 'Package', items: 'Packages', order: 'Booking', orders: 'Bookings', customer: 'Client', customers: 'Clients', inventoryLabel: 'Rentals', productionLabel: 'Setups' }),
    widgets: ['hero', 'quickActions', 'pipeline', 'appointments', 'clients', 'debts', 'reminders'],
    quickActions: ['order', 'expense', 'customer', 'profit'],
    defaultAllocation: ALLOC_PRODUCT,
    modules: { inventory: true, production: false, orders: true, customers: true },
  },
  {
    id: 'crafts',
    name: 'Handmade Crafts',
    tagline: 'Soap, candles, jewelry and more',
    icon: 'color-palette',
    accent: '#F43F5E',
    terms: T({ item: 'Item', items: 'Items', inventoryLabel: 'Materials', productionLabel: 'Batches' }),
    widgets: ['hero', 'quickActions', 'profit', 'stats', 'production', 'lowStock', 'bestSellers', 'reminders'],
    quickActions: ['sale', 'expense', 'recipe', 'profit'],
    defaultAllocation: ALLOC_PRODUCT,
    modules: { inventory: true, production: true, orders: true, customers: true },
  },
  {
    id: 'consulting',
    name: 'Consulting & Professional',
    tagline: 'Engagements, retainers and clients',
    icon: 'briefcase',
    accent: '#3B82F6',
    terms: T({ item: 'Service', items: 'Services', order: 'Engagement', orders: 'Engagements', customer: 'Client', customers: 'Clients', inventoryLabel: 'Services', productionLabel: 'Deliverables' }),
    widgets: ['hero', 'quickActions', 'pipeline', 'clients', 'expenses', 'debts', 'reminders'],
    quickActions: ['order', 'sale', 'expense', 'profit'],
    defaultAllocation: ALLOC_SERVICE,
    modules: { inventory: false, production: false, orders: true, customers: true },
  },
  {
    id: 'general',
    name: 'General Bookkeeping',
    tagline: 'A simple record-keeping book',
    icon: 'book',
    accent: '#2563EB',
    terms: T({ item: 'Item', items: 'Items', customer: 'Contact', customers: 'Contacts', inventoryLabel: 'Items', productionLabel: 'Records' }),
    widgets: ['hero', 'quickActions', 'ledger', 'stats', 'expenses', 'reminders'],
    quickActions: ['sale', 'expense', 'customer', 'profit'],
    defaultAllocation: ALLOC_GENERAL,
    modules: { inventory: true, production: false, orders: true, customers: true },
  },
];

export const DEFAULT_INDUSTRY_ID = 'general';

export function getIndustry(id: string | null | undefined): IndustryConfig {
  return INDUSTRIES.find((i) => i.id === id) ?? INDUSTRIES.find((i) => i.id === DEFAULT_INDUSTRY_ID)!;
}

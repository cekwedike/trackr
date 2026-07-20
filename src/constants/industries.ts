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

export type QuickActionKey = 'sale' | 'expense' | 'order' | 'product' | 'customer' | 'profit' | 'reminder' | 'recipe' | 'note';

/**
 * Which entity screens surface as bottom-tab destinations for an industry.
 * Keep this to at most 2 entries per industry: the tab bar shows Home + up to
 * two of these + a "More" entry, for a maximum of 4 destinations.
 */
export type NavTabKey = 'sales' | 'orders' | 'inventory' | 'customers';

export interface IndustryTerms {
  item: string;
  items: string;
  sale: string;
  sales: string;
  order: string;
  orders: string;
  customer: string;
  customers: string;
  ingredient: string;
  ingredients: string;
  inventoryLabel: string;
  productionLabel: string;
}

/**
 * Feature modules gate what navigation and actions an industry sees.
 * - inventory: a stock / product catalogue (Inventory tab, product screens)
 * - ingredients: raw materials distinct from finished products
 * - recipes: production costing per batch
 * - orders: jobs / appointments / bookings pipeline
 * - customers: a client / contact book
 * - sales: a point-of-sale income log
 */
export interface IndustryModules {
  sales: boolean;
  inventory: boolean;
  ingredients: boolean;
  recipes: boolean;
  orders: boolean;
  customers: boolean;
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
  navTabs: NavTabKey[];
  defaultAllocation: AllocationBucket[];
  modules: IndustryModules;
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
  ingredient: 'Ingredient',
  ingredients: 'Ingredients',
  inventoryLabel: 'Inventory',
  productionLabel: 'Recipes',
  ...over,
});

const M = (over: Partial<IndustryModules>): IndustryModules => ({
  sales: true,
  inventory: true,
  ingredients: false,
  recipes: false,
  orders: true,
  customers: true,
  ...over,
});

export const INDUSTRIES: IndustryConfig[] = [
  {
    id: 'bakery',
    name: 'Bakery & Pastry',
    tagline: 'Cakes, bread and sweet treats',
    icon: 'cafe',
    accent: '#EC4899',
    terms: T({ item: 'Product', items: 'Products', ingredient: 'Ingredient', ingredients: 'Ingredients', inventoryLabel: 'Inventory', productionLabel: 'Recipes' }),
    widgets: ['hero', 'quickActions', 'profit', 'stats', 'production', 'lowStock', 'bestSellers', 'reminders'],
    quickActions: ['sale', 'expense', 'recipe', 'note'],
    navTabs: ['sales', 'inventory'],
    defaultAllocation: ALLOC_BAKERY,
    modules: M({ ingredients: true, recipes: true }),
  },
  {
    id: 'catering',
    name: 'Catering',
    tagline: 'Events, packages and headcounts',
    icon: 'restaurant',
    accent: '#F59E0B',
    terms: T({ item: 'Package', items: 'Packages', order: 'Event', orders: 'Events', customer: 'Client', customers: 'Clients', ingredient: 'Supply', ingredients: 'Supplies', inventoryLabel: 'Supplies', productionLabel: 'Menus' }),
    widgets: ['hero', 'quickActions', 'profit', 'pipeline', 'appointments', 'clients', 'debts', 'reminders'],
    quickActions: ['order', 'sale', 'expense', 'note'],
    navTabs: ['orders', 'customers'],
    defaultAllocation: ALLOC_PRODUCT,
    modules: M({ ingredients: true, recipes: true }),
  },
  {
    id: 'restaurant',
    name: 'Restaurant & Chef',
    tagline: 'Menus, dishes and daily covers',
    icon: 'fast-food',
    accent: '#EF4444',
    terms: T({ item: 'Dish', items: 'Dishes', ingredient: 'Ingredient', ingredients: 'Ingredients', inventoryLabel: 'Menu', productionLabel: 'Recipes' }),
    widgets: ['hero', 'quickActions', 'profit', 'stats', 'bestSellers', 'lowStock', 'expenses', 'reminders'],
    quickActions: ['sale', 'expense', 'recipe', 'note'],
    navTabs: ['sales', 'inventory'],
    defaultAllocation: ALLOC_PRODUCT,
    modules: M({ ingredients: true, recipes: true }),
  },
  {
    id: 'fashion',
    name: 'Fashion & Tailoring',
    tagline: 'Garments, clients and fittings',
    icon: 'shirt',
    accent: '#8B5CF6',
    terms: T({ item: 'Garment', items: 'Garments', order: 'Job', orders: 'Jobs', customer: 'Client', customers: 'Clients', ingredient: 'Material', ingredients: 'Materials', inventoryLabel: 'Materials', productionLabel: 'Patterns' }),
    widgets: ['hero', 'quickActions', 'pipeline', 'appointments', 'clients', 'debts', 'expenses', 'reminders'],
    quickActions: ['order', 'expense', 'customer', 'note'],
    navTabs: ['orders', 'customers'],
    defaultAllocation: ALLOC_SERVICE,
    modules: M({ inventory: true, ingredients: false, recipes: false }),
  },
  {
    id: 'salon',
    name: 'Beauty, Salon & Barber',
    tagline: 'Services, appointments and regulars',
    icon: 'cut',
    accent: '#D946EF',
    terms: T({ item: 'Service', items: 'Services', order: 'Appointment', orders: 'Appointments', customer: 'Client', customers: 'Clients', ingredient: 'Product', ingredients: 'Products', inventoryLabel: 'Products', productionLabel: 'Services' }),
    widgets: ['hero', 'quickActions', 'appointments', 'stats', 'clients', 'bestSellers', 'reminders'],
    quickActions: ['sale', 'order', 'expense', 'note'],
    navTabs: ['orders', 'customers'],
    defaultAllocation: ALLOC_SERVICE,
    modules: M({ inventory: true, ingredients: false, recipes: false }),
  },
  {
    id: 'retail',
    name: 'Retail & Provisions',
    tagline: 'Stock, fast movers and margins',
    icon: 'cart',
    accent: '#0EA5E9',
    terms: T({ inventoryLabel: 'Inventory', productionLabel: 'Stock' }),
    widgets: ['hero', 'quickActions', 'profit', 'stats', 'lowStock', 'bestSellers', 'debts', 'reminders'],
    quickActions: ['sale', 'expense', 'product', 'note'],
    navTabs: ['sales', 'inventory'],
    defaultAllocation: ALLOC_PRODUCT,
    modules: M({ inventory: true }),
  },
  {
    id: 'photography',
    name: 'Photography & Creatives',
    tagline: 'Projects, deposits and deliverables',
    icon: 'camera',
    accent: '#14B8A6',
    terms: T({ item: 'Package', items: 'Packages', order: 'Project', orders: 'Projects', customer: 'Client', customers: 'Clients', inventoryLabel: 'Gear', productionLabel: 'Shoots' }),
    widgets: ['hero', 'quickActions', 'pipeline', 'appointments', 'clients', 'debts', 'expenses', 'reminders'],
    quickActions: ['order', 'expense', 'customer', 'note'],
    navTabs: ['orders', 'customers'],
    defaultAllocation: ALLOC_SERVICE,
    modules: M({ inventory: false }),
  },
  {
    id: 'freelancer',
    name: 'Freelancer & Services',
    tagline: 'Clients, projects and invoices',
    icon: 'laptop',
    accent: '#6366F1',
    terms: T({ item: 'Service', items: 'Services', order: 'Project', orders: 'Projects', customer: 'Client', customers: 'Clients', inventoryLabel: 'Services', productionLabel: 'Deliverables' }),
    widgets: ['hero', 'quickActions', 'pipeline', 'clients', 'expenses', 'debts', 'reminders'],
    quickActions: ['order', 'sale', 'expense', 'note'],
    navTabs: ['orders', 'customers'],
    defaultAllocation: ALLOC_SERVICE,
    modules: M({ inventory: false }),
  },
  {
    id: 'farming',
    name: 'Farming & Agriculture',
    tagline: 'Produce, harvests and inputs',
    icon: 'leaf',
    accent: '#22C55E',
    terms: T({ item: 'Produce', items: 'Produce', customer: 'Buyer', customers: 'Buyers', ingredient: 'Input', ingredients: 'Inputs', inventoryLabel: 'Harvest', productionLabel: 'Crops' }),
    widgets: ['hero', 'quickActions', 'profit', 'stats', 'lowStock', 'expenses', 'reminders'],
    quickActions: ['sale', 'expense', 'product', 'note'],
    navTabs: ['sales', 'inventory'],
    defaultAllocation: ALLOC_PRODUCT,
    modules: M({ inventory: true }),
  },
  {
    id: 'drinks',
    name: 'Drinks & Beverages',
    tagline: 'Smoothies, juice and batches',
    icon: 'wine',
    accent: '#F97316',
    terms: T({ item: 'Drink', items: 'Drinks', ingredient: 'Ingredient', ingredients: 'Ingredients', inventoryLabel: 'Stock', productionLabel: 'Batches' }),
    widgets: ['hero', 'quickActions', 'profit', 'stats', 'production', 'lowStock', 'bestSellers', 'reminders'],
    quickActions: ['sale', 'expense', 'recipe', 'note'],
    navTabs: ['sales', 'inventory'],
    defaultAllocation: ALLOC_PRODUCT,
    modules: M({ ingredients: true, recipes: true }),
  },
  {
    id: 'fitness',
    name: 'Fitness & Coaching',
    tagline: 'Clients, sessions and plans',
    icon: 'barbell',
    accent: '#10B981',
    terms: T({ item: 'Plan', items: 'Plans', order: 'Session', orders: 'Sessions', customer: 'Client', customers: 'Clients', inventoryLabel: 'Equipment', productionLabel: 'Programs' }),
    widgets: ['hero', 'quickActions', 'appointments', 'clients', 'stats', 'debts', 'reminders'],
    quickActions: ['order', 'sale', 'expense', 'note'],
    navTabs: ['orders', 'customers'],
    defaultAllocation: ALLOC_SERVICE,
    modules: M({ inventory: false }),
  },
  {
    id: 'events',
    name: 'Events & Rentals',
    tagline: 'Bookings, deposits and assets',
    icon: 'sparkles',
    accent: '#A855F7',
    terms: T({ item: 'Package', items: 'Packages', order: 'Booking', orders: 'Bookings', customer: 'Client', customers: 'Clients', ingredient: 'Asset', ingredients: 'Assets', inventoryLabel: 'Rentals', productionLabel: 'Setups' }),
    widgets: ['hero', 'quickActions', 'pipeline', 'appointments', 'clients', 'debts', 'reminders'],
    quickActions: ['order', 'expense', 'customer', 'note'],
    navTabs: ['orders', 'customers'],
    defaultAllocation: ALLOC_PRODUCT,
    modules: M({ inventory: true, ingredients: false, recipes: false }),
  },
  {
    id: 'crafts',
    name: 'Handmade Crafts',
    tagline: 'Soap, candles, jewelry and more',
    icon: 'color-palette',
    accent: '#F43F5E',
    terms: T({ item: 'Item', items: 'Items', ingredient: 'Material', ingredients: 'Materials', inventoryLabel: 'Materials', productionLabel: 'Batches' }),
    widgets: ['hero', 'quickActions', 'profit', 'stats', 'production', 'lowStock', 'bestSellers', 'reminders'],
    quickActions: ['sale', 'expense', 'recipe', 'note'],
    navTabs: ['sales', 'inventory'],
    defaultAllocation: ALLOC_PRODUCT,
    modules: M({ ingredients: true, recipes: true }),
  },
  {
    id: 'consulting',
    name: 'Consulting & Professional',
    tagline: 'Engagements, retainers and clients',
    icon: 'briefcase',
    accent: '#3B82F6',
    terms: T({ item: 'Service', items: 'Services', order: 'Engagement', orders: 'Engagements', customer: 'Client', customers: 'Clients', inventoryLabel: 'Services', productionLabel: 'Deliverables' }),
    widgets: ['hero', 'quickActions', 'pipeline', 'clients', 'expenses', 'debts', 'reminders'],
    quickActions: ['order', 'sale', 'expense', 'note'],
    navTabs: ['orders', 'customers'],
    defaultAllocation: ALLOC_SERVICE,
    modules: M({ inventory: false }),
  },
  {
    id: 'cleaning',
    name: 'Cleaning Services',
    tagline: 'Jobs, crews and recurring clients',
    icon: 'water',
    accent: '#06B6D4',
    terms: T({ item: 'Service', items: 'Services', order: 'Job', orders: 'Jobs', customer: 'Client', customers: 'Clients', ingredient: 'Supply', ingredients: 'Supplies', inventoryLabel: 'Supplies', productionLabel: 'Checklists' }),
    widgets: ['hero', 'quickActions', 'appointments', 'pipeline', 'clients', 'debts', 'expenses', 'reminders'],
    quickActions: ['order', 'customer', 'expense', 'note'],
    navTabs: ['orders', 'customers'],
    defaultAllocation: ALLOC_SERVICE,
    modules: M({ inventory: false }),
  },
  {
    id: 'laundry',
    name: 'Laundry & Dry Cleaning',
    tagline: 'Tickets, pickups and turnaround',
    icon: 'shirt',
    accent: '#38BDF8',
    terms: T({ item: 'Item', items: 'Items', order: 'Ticket', orders: 'Tickets', customer: 'Customer', customers: 'Customers', ingredient: 'Supply', ingredients: 'Supplies', inventoryLabel: 'Supplies', productionLabel: 'Services' }),
    widgets: ['hero', 'quickActions', 'pipeline', 'appointments', 'clients', 'debts', 'expenses', 'reminders'],
    quickActions: ['order', 'sale', 'customer', 'note'],
    navTabs: ['orders', 'customers'],
    defaultAllocation: ALLOC_SERVICE,
    modules: M({ inventory: false }),
  },
  {
    id: 'home_services',
    name: 'Home Services & Handyman',
    tagline: 'Plumbing, electrical and repairs',
    icon: 'construct',
    accent: '#EA580C',
    terms: T({ item: 'Service', items: 'Services', order: 'Job', orders: 'Jobs', customer: 'Client', customers: 'Clients', ingredient: 'Material', ingredients: 'Materials', inventoryLabel: 'Materials', productionLabel: 'Services' }),
    widgets: ['hero', 'quickActions', 'pipeline', 'appointments', 'clients', 'debts', 'expenses', 'reminders'],
    quickActions: ['order', 'customer', 'expense', 'note'],
    navTabs: ['orders', 'customers'],
    defaultAllocation: ALLOC_SERVICE,
    modules: M({ inventory: false }),
  },
  {
    id: 'tutoring',
    name: 'Tutoring & Education',
    tagline: 'Students, sessions and courses',
    icon: 'school',
    accent: '#4F46E5',
    terms: T({ item: 'Course', items: 'Courses', order: 'Session', orders: 'Sessions', customer: 'Student', customers: 'Students', inventoryLabel: 'Materials', productionLabel: 'Curriculum' }),
    widgets: ['hero', 'quickActions', 'appointments', 'clients', 'stats', 'debts', 'reminders'],
    quickActions: ['order', 'customer', 'expense', 'note'],
    navTabs: ['orders', 'customers'],
    defaultAllocation: ALLOC_SERVICE,
    modules: M({ inventory: false }),
  },
  {
    id: 'real_estate',
    name: 'Real Estate & Rentals',
    tagline: 'Properties, tenants and leases',
    icon: 'business',
    accent: '#0D9488',
    terms: T({ item: 'Property', items: 'Properties', order: 'Lease', orders: 'Leases', customer: 'Tenant', customers: 'Tenants', inventoryLabel: 'Properties', productionLabel: 'Listings' }),
    widgets: ['hero', 'quickActions', 'pipeline', 'clients', 'debts', 'expenses', 'reminders'],
    quickActions: ['order', 'customer', 'expense', 'note'],
    navTabs: ['orders', 'customers'],
    defaultAllocation: ALLOC_SERVICE,
    modules: M({ inventory: false }),
  },
  {
    id: 'transport',
    name: 'Transport & Logistics',
    tagline: 'Trips, deliveries and fleet',
    icon: 'car',
    accent: '#CA8A04',
    terms: T({ item: 'Trip', items: 'Trips', order: 'Delivery', orders: 'Deliveries', customer: 'Client', customers: 'Clients', inventoryLabel: 'Fleet', productionLabel: 'Routes' }),
    widgets: ['hero', 'quickActions', 'pipeline', 'appointments', 'clients', 'expenses', 'reminders'],
    quickActions: ['order', 'sale', 'expense', 'note'],
    navTabs: ['orders', 'customers'],
    defaultAllocation: ALLOC_SERVICE,
    modules: M({ inventory: false }),
  },
  {
    id: 'auto_repair',
    name: 'Auto Mechanic & Repair',
    tagline: 'Repairs, parts and estimates',
    icon: 'car-sport',
    accent: '#B91C1C',
    terms: T({ item: 'Part', items: 'Parts', order: 'Job', orders: 'Jobs', customer: 'Customer', customers: 'Customers', ingredient: 'Part', ingredients: 'Parts', inventoryLabel: 'Parts', productionLabel: 'Services' }),
    widgets: ['hero', 'quickActions', 'pipeline', 'lowStock', 'clients', 'debts', 'expenses', 'reminders'],
    quickActions: ['order', 'sale', 'product', 'note'],
    navTabs: ['orders', 'inventory'],
    defaultAllocation: ALLOC_PRODUCT,
    modules: M({ inventory: true }),
  },
  {
    id: 'printing',
    name: 'Printing & Branding',
    tagline: 'Jobs, designs and print runs',
    icon: 'print',
    accent: '#9333EA',
    terms: T({ item: 'Product', items: 'Products', order: 'Job', orders: 'Jobs', customer: 'Client', customers: 'Clients', ingredient: 'Material', ingredients: 'Materials', inventoryLabel: 'Materials', productionLabel: 'Designs' }),
    widgets: ['hero', 'quickActions', 'pipeline', 'clients', 'debts', 'expenses', 'reminders'],
    quickActions: ['order', 'sale', 'customer', 'note'],
    navTabs: ['orders', 'customers'],
    defaultAllocation: ALLOC_SERVICE,
    modules: M({ inventory: false }),
  },
  {
    id: 'tech_repair',
    name: 'Tech & Phone Repair',
    tagline: 'Repairs, parts and diagnostics',
    icon: 'phone-portrait',
    accent: '#0E7490',
    terms: T({ item: 'Part', items: 'Parts', order: 'Repair', orders: 'Repairs', customer: 'Customer', customers: 'Customers', ingredient: 'Part', ingredients: 'Parts', inventoryLabel: 'Parts', productionLabel: 'Services' }),
    widgets: ['hero', 'quickActions', 'pipeline', 'lowStock', 'clients', 'debts', 'expenses', 'reminders'],
    quickActions: ['order', 'sale', 'product', 'note'],
    navTabs: ['orders', 'inventory'],
    defaultAllocation: ALLOC_PRODUCT,
    modules: M({ inventory: true }),
  },
  {
    id: 'clinic',
    name: 'Clinic & Wellness',
    tagline: 'Patients, appointments and care',
    icon: 'medkit',
    accent: '#059669',
    terms: T({ item: 'Service', items: 'Services', order: 'Appointment', orders: 'Appointments', customer: 'Patient', customers: 'Patients', ingredient: 'Supply', ingredients: 'Supplies', inventoryLabel: 'Supplies', productionLabel: 'Services' }),
    widgets: ['hero', 'quickActions', 'appointments', 'clients', 'stats', 'debts', 'reminders'],
    quickActions: ['order', 'customer', 'expense', 'note'],
    navTabs: ['orders', 'customers'],
    defaultAllocation: ALLOC_SERVICE,
    modules: M({ inventory: false }),
  },
  {
    id: 'general',
    name: 'General Bookkeeping',
    tagline: 'A simple record-keeping book',
    icon: 'book',
    accent: '#2563EB',
    terms: T({ item: 'Item', items: 'Items', customer: 'Contact', customers: 'Contacts', inventoryLabel: 'Items', productionLabel: 'Records' }),
    widgets: ['hero', 'quickActions', 'ledger', 'stats', 'expenses', 'reminders'],
    quickActions: ['sale', 'expense', 'customer', 'note'],
    navTabs: ['sales', 'inventory'],
    defaultAllocation: ALLOC_GENERAL,
    modules: M({ inventory: true }),
  },
];

export const DEFAULT_INDUSTRY_ID = 'general';

export function getIndustry(id: string | null | undefined): IndustryConfig {
  return INDUSTRIES.find((i) => i.id === id) ?? INDUSTRIES.find((i) => i.id === DEFAULT_INDUSTRY_ID)!;
}

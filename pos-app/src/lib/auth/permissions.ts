export const PERMISSIONS = [
  { key: "products.view", module: "products", description: "View products and catalog" },
  { key: "products.manage", module: "products", description: "Create, edit, and delete products" },
  { key: "inventory.view", module: "inventory", description: "View stock levels and batches" },
  { key: "inventory.adjust", module: "inventory", description: "Create manual stock adjustments" },
  { key: "grn.manage", module: "grn", description: "Create and manage goods received notes" },
  { key: "grn.return", module: "grn", description: "Return stock to a supplier" },
  { key: "sales.create", module: "sales", description: "Ring up sales at checkout" },
  { key: "sales.void", module: "sales", description: "Void a line item or an entire sale" },
  { key: "sales.refund", module: "sales", description: "Process a customer return/refund" },
  { key: "discounts.apply", module: "discounts", description: "Apply manual discounts within policy limits" },
  { key: "discounts.override_limit", module: "discounts", description: "Apply manual discounts above the normal limit" },
  { key: "promotions.manage", module: "promotions", description: "Create and manage promotions" },
  { key: "coupons.manage", module: "coupons", description: "Generate and manage coupons/vouchers" },
  { key: "customers.view", module: "customers", description: "View customer records" },
  { key: "customers.manage", module: "customers", description: "Create and edit customers" },
  { key: "customers.manage_credit", module: "customers", description: "Manage credit limits and record credit payments" },
  { key: "shifts.open_close", module: "shifts", description: "Open and close cashier shifts" },
  { key: "shifts.override_cash", module: "shifts", description: "Override or approve cash variance at shift close" },
  { key: "reports.view", module: "reports", description: "View and export reports" },
  { key: "settings.manage", module: "settings", description: "Manage business settings" },
  { key: "roles.manage", module: "roles", description: "Create and edit roles and permissions" },
  { key: "users.manage", module: "users", description: "Create and edit staff user accounts" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const PERMISSION_KEYS: readonly PermissionKey[] = PERMISSIONS.map((p) => p.key);

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value);
}

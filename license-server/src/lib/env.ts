/** Centralised, typed access to environment configuration. */
export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  databaseSsl: process.env.DATABASE_SSL ?? "",

  adminUser: process.env.ADMIN_USER ?? "admin",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  adminApiToken: process.env.ADMIN_API_TOKEN ?? "",

  signingPrivateKey: process.env.LICENSE_SIGNING_PRIVATE_KEY ?? "",
  signingPublicKey: process.env.LICENSE_SIGNING_PUBLIC_KEY ?? "",

  tokenTtlDays: Number.parseInt(process.env.LICENSE_TOKEN_TTL_DAYS ?? "30", 10) || 30,
};

export function assertSigningConfigured() {
  if (!env.signingPrivateKey) {
    throw new Error(
      "LICENSE_SIGNING_PRIVATE_KEY is not set. Run `npm run keypair` and add it to the environment.",
    );
  }
}

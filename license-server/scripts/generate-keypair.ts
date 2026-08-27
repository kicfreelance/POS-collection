import crypto from "node:crypto";

/**
 * One-time: generate the Ed25519 signing pair for entitlement tokens.
 *
 *   npm run keypair
 *
 * - LICENSE_SIGNING_PRIVATE_KEY  -> license-server env (Railway). Never ships.
 * - LICENSE_SIGNING_PUBLIC_KEY   -> embed in pos-app and POS-DUALSCREEN builds.
 */
const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");

const priv = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
const pub = publicKey.export({ format: "der", type: "spki" }).toString("base64");

console.log("LICENSE_SIGNING_PRIVATE_KEY=" + priv);
console.log("LICENSE_SIGNING_PUBLIC_KEY=" + pub);
console.log("");
console.log("-> PRIVATE key: set in the license-server environment only.");
console.log("-> PUBLIC key : embed in the desktop apps to verify tokens offline.");

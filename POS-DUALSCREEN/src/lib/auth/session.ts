import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "pos_session";
export const SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  userId: string;
  roleId: string;
  roleName: string;
  isSuperAdmin: boolean;
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export interface ApprovalPayload {
  approverId: string;
  approverName: string;
  permission: string;
}

const APPROVAL_TOKEN_TTL_SECONDS = 5 * 60;

export async function createApprovalToken(payload: ApprovalPayload): Promise<string> {
  return new SignJWT({ ...payload, kind: "approval" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${APPROVAL_TOKEN_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyApprovalToken(
  token: string,
  requiredPermission: string,
): Promise<ApprovalPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.kind !== "approval" || payload.permission !== requiredPermission) return null;
    return payload as unknown as ApprovalPayload;
  } catch {
    return null;
  }
}

import { decodeJwt } from "jose";

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
}

export function decodeToken(authHeader: string | null): AuthPayload | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    const payload = decodeJwt(token);
    return {
      userId: payload.sub as string,
      email: payload.email as string,
      role: (payload.role as string) || "USER",
    };
  } catch {
    return null;
  }
}

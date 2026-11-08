import "server-only";
import type { AuthInfo } from "@modelcontextprotocol/server";
import type { VerifiedToken } from "@/server/tokens/service";

/** The authenticated caller of an MCP request (one personal access token). */
export interface Principal {
  tokenId: string;
  userId: string;
  email: string;
  scopes: string[];
}

/** VerifiedToken → MCP AuthInfo (what `withMcpAuth` attaches to the request). */
export function toAuthInfo(token: string, verified: VerifiedToken): AuthInfo {
  return {
    token,
    clientId: verified.tokenId,
    scopes: verified.scopes,
    extra: { userId: verified.userId, email: verified.email },
  };
}

/** MCP AuthInfo → Principal. Returns undefined when the shape is not ours. */
export function principalFromAuthInfo(authInfo: AuthInfo | undefined): Principal | undefined {
  if (!authInfo) return undefined;
  const userId = authInfo.extra?.userId;
  const email = authInfo.extra?.email;
  if (typeof userId !== "string" || typeof email !== "string" || !authInfo.clientId) {
    return undefined;
  }
  return { tokenId: authInfo.clientId, userId, email, scopes: [...authInfo.scopes] };
}

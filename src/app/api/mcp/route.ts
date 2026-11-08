import { getDb } from "@/server/db/client";
import { createStandardsMcpHandler } from "@/server/mcp/http";

/**
 * Remote MCP endpoint (Streamable HTTP, stateless). Only adapts HTTP to
 * `src/server/mcp` — auth, rate limiting and tools live there.
 *
 * No `runtime`/`dynamic` exports: with `cacheComponents` enabled Next.js rejects
 * them; route handlers run on Node.js and are dynamic by default (they read the request).
 */

const handler = createStandardsMcpHandler({ getDb });

export { handler as DELETE, handler as GET, handler as POST };

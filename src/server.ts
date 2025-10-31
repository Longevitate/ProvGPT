import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { triageRouter } from "./routes/triage.js";
import { searchFacilitiesRouter } from "./routes/searchFacilities.js";
import { availabilityRouter } from "./routes/availability.js";
import { bookRouter } from "./routes/book.js";
import { mcpRouter } from "./routes/mcp.js";
import { randomUUID } from "crypto";

dotenv.config();

export const app = express();
app.use(cors());
// Correlation ID middleware
app.use((req, _res, next) => {
  const existing = req.headers["x-correlation-id"];
  (req as any).correlationId = String(existing || randomUUID());
  next();
});
// Entry logging to verify platform routing reaches Node
app.use((req, _res, next) => {
  const cid = (req as any).correlationId;
  const len = req.headers["content-length"];
  console.info("[entry] cid=%s %s %s len=%s", cid, req.method, req.url, len ?? "-");
  next();
});

// Mount MCP early with tolerant body handling to avoid strict JSON parse failures
app.use("/mcp", express.text({ type: ["application/json", "text/*", "application/*+json", "*/*"], limit: "1mb" }));
app.use("/mcp", mcpRouter);
// Prefer native JSON and urlencoded parsing first for standard clients
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Fallback: accept text bodies (including JSON sent with text/* or application/*+json)
app.use(
  express.text({
    type: ["text/*", "application/*+json"],
    limit: "1mb"
  })
);
app.use((req, _res, next) => {
  if (typeof req.body === "string") {
    const trimmed = req.body.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        req.body = JSON.parse(trimmed);
      } catch {
        // keep as string for downstream handlers to decide how to handle
      }
    }
  }
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Canary route: dependency-free health of app instance
app.get("/api/triage_canary", (_req, res) => {
  res.setHeader("content-type", "application/json");
  return res.status(200).json({
    ok: true,
    version: process.env.BUILD_SHA || "dev",
    time: new Date().toISOString(),
  });
});

// Correlation ID middleware
app.use((req, _res, next) => {
  // propagate or assign a correlation id early
  const existing = req.headers["x-correlation-id"];
  (req as any).correlationId = String(existing || randomUUID());
  next();
});

// Entry logging to verify platform routing reaches Node
app.use((req, _res, next) => {
  const cid = (req as any).correlationId;
  const len = req.headers["content-length"];
  console.info("[entry] cid=%s %s %s len=%s", cid, req.method, req.url, len ?? "-");
  next();
});

app.use("/api/triage", triageRouter);
app.use("/api/search-facilities", searchFacilitiesRouter);
app.use("/api/availability", availabilityRouter);
app.use("/api/book", bookRouter);
// mcp is mounted earlier

// Global error handler for JSON parse errors (structured response)
app.use((err: any, req: any, res: any, next: any) => {
  if (err && (err.type === "entity.parse.failed" || err instanceof SyntaxError)) {
    const cid = req?.correlationId || randomUUID();
    console.warn("[error] bad_json cid=%s url=%s", cid, req?.url);
    return res.status(400).json({
      error: { code: "BAD_JSON", message: "Invalid JSON body", correlationId: cid },
    });
  }
  return next(err);
});

// Serve static assets if needed (placeholder)
app.use("/public", express.static(path.join(process.cwd(), "public")));

const PORT = Number(process.env.PORT || 8080);
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}



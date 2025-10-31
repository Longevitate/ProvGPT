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

app.use("/api/triage", triageRouter);
app.use("/api/search-facilities", searchFacilitiesRouter);
app.use("/api/availability", availabilityRouter);
app.use("/api/book", bookRouter);
app.use("/mcp", mcpRouter);

// Serve static assets if needed (placeholder)
app.use("/public", express.static(path.join(process.cwd(), "public")));

const PORT = Number(process.env.PORT || 8080);
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}



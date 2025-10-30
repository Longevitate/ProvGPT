import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { triageRouter } from "./routes/triage.js";
import { searchFacilitiesRouter } from "./routes/searchFacilities.js";
import { availabilityRouter } from "./routes/availability.js";
import { bookRouter } from "./routes/book.js";
import { mcpRouter } from "./routes/mcp.js";

dotenv.config();

const app = express();
app.use(cors());
// Prefer native JSON and urlencoded parsing first for standard clients
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Fallback: accept arbitrary text and coerce JSON-looking strings into objects
app.use(express.text({ type: "*/*" }));
app.use((req, _res, next) => {
  if (req.headers["content-type"] && String(req.headers["content-type"]).includes("application/json")) {
    // If JSON was expected but not parsed, try to coerce
    if (typeof req.body === "string" && req.body.trim().length > 0) {
      try {
        req.body = JSON.parse(req.body);
      } catch {
        // keep as string
      }
    }
  } else if (typeof req.body === "string") {
    const t = req.body.trim();
    if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
      try {
        req.body = JSON.parse(t);
      } catch {
        // keep as string
      }
    }
  }
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/triage", triageRouter);
app.use("/api/search-facilities", searchFacilitiesRouter);
app.use("/api/availability", availabilityRouter);
app.use("/api/book", bookRouter);
app.use("/mcp", mcpRouter);

// Serve static assets if needed (placeholder)
app.use("/public", express.static(path.join(process.cwd(), "public")));

const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});



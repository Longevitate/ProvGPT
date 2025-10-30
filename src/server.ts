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
// Be tolerant to various Content-Types from external callers (ChatGPT tools, etc.)
// Parse text bodies for any type, then JSON-parse if possible. This avoids 400s from strict JSON parser.
app.use(express.text({ type: "*/*" }));
app.use((req, _res, next) => {
  if (typeof req.body === "string" && req.body.length > 0) {
    try {
      req.body = JSON.parse(req.body);
    } catch {
      // leave as string if not JSON
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



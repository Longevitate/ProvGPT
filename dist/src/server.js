import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { triageRouter } from "./routes/triage.js";
import { searchFacilitiesRouter } from "./routes/searchFacilities.js";
import { availabilityRouter } from "./routes/availability.js";
import { bookRouter } from "./routes/book.js";
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.get("/health", (_req, res) => {
    res.json({ ok: true });
});
app.use("/api/triage", triageRouter);
app.use("/api/search-facilities", searchFacilitiesRouter);
app.use("/api/availability", availabilityRouter);
app.use("/api/book", bookRouter);
// Serve static assets if needed (placeholder)
app.use("/public", express.static(path.join(process.cwd(), "public")));
const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
});

import { triage_v1, search_facilities_v1, get_availability_v1, book_appointment_v1 } from "./tools.js";

export default {
  id: "find-care-demo",
  name: "Find Care",
  version: "0.1.0",
  description: "Care navigation assistant (demo).",
  systemPrompt:
    "You are a care navigation assistant for a demo health system. You never diagnose. You recommend the care venue and help book. If red flags are present (e.g., chest pain, stroke signs, severe trauma, anaphylaxis, uncontrolled bleeding), immediately advise 911/ER and return ER locations first. Prefer our facilities. Always show insurance acceptance status and the soonest slot.",
  tools: [
    { ...triage_v1, handler: { endpoint: "/api/triage", method: "POST" } },
    { ...search_facilities_v1, handler: { endpoint: "/api/search-facilities", method: "POST" } },
    { ...get_availability_v1, handler: { endpoint: "/api/availability", method: "POST" } },
    { ...book_appointment_v1, handler: { endpoint: "/api/book", method: "POST" } }
  ],
  component: {
    source: "./apps/find-care/component.tsx"
  }
};



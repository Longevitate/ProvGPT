// apps/find-care/tools.ts
import { z } from "zod";

export const triage_v1 = {
  name: "triage_v1",
  description: "Suggest care venue (ER/urgent/primary/virtual) & urgency based on symptoms and age.",
  parameters: z.object({
    symptoms: z.string(),
    age: z.number().int().min(0).max(120),
    pregnancyStatus: z.enum(["unknown","pregnant","not_pregnant"]).default("unknown"),
    durationHours: z.number().int().min(0).max(10000).optional()
  })
};

export const search_facilities_v1 = {
  name: "search_facilities_v1",
  description: "Find Providence care options near a location with filters.",
  parameters: z.object({
    lat: z.number(),
    lon: z.number(),
    radiusMiles: z.number().default(15),
    venue: z.enum(["urgent_care","er","primary_care","virtual"]),
    acceptsInsurancePlanId: z.string().optional(),
    openNow: z.boolean().optional(),
    pediatricFriendly: z.boolean().optional()
  })
};

export const get_availability_v1 = {
  name: "get_availability_v1",
  description: "Fetch next available appointment slots for a facility/service.",
  parameters: z.object({
    facilityId: z.string(),
    serviceCode: z.string().default("urgent-care"),
    days: z.number().int().min(1).max(14).default(7)
  })
};

export const book_appointment_v1 = {
  name: "book_appointment_v1",
  description: "Book appointment or generate deep link to MyChart flow (mock).",
  parameters: z.object({
    facilityId: z.string(),
    slotId: z.string(),
    patientContextToken: z.string().describe("Opaque short-lived token; no PHI.")
  })
};



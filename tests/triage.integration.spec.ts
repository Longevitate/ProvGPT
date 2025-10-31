import { beforeAll, afterAll, describe, expect, it } from "vitest";
import http from "http";
import { app } from "../src/server.js";

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") {
        baseUrl = `http://${address.address}:${address.port}`;
      } else {
        baseUrl = `http://127.0.0.1:0`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("/api/triage", () => {
  it("returns 200 and correlationId for valid payload", async () => {
    const res = await fetch(`${baseUrl}/api/triage`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-correlation-id": "test-cid-123" },
      body: JSON.stringify({ symptoms: "earache", age: 14 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.correlationId).toBeDefined();
    expect(body.venue).toBeDefined();
    expect(typeof body.redFlag).toBe("boolean");
  });

  it("returns structured error for bad request", async () => {
    const res = await fetch(`${baseUrl}/api/triage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symptoms: "", age: -1 }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error?.code).toBe("BAD_REQUEST");
    expect(body.error?.correlationId).toBeDefined();
  });
});

describe("/api/triage_canary", () => {
  it("returns ok payload", async () => {
    const res = await fetch(`${baseUrl}/api/triage_canary`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.ok).toBe(true);
    expect(body.version).toBeDefined();
    expect(body.time).toBeDefined();
  });
});



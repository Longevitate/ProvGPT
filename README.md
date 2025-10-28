## Find Care ChatGPT Demo (Providence)

Minimal demo ChatGPT App to help a user choose the right care venue, find nearby Providence locations, see availability, and book via a mock flow. TypeScript everywhere, Express backend, Apps SDK stubs, Docker, and Azure App Service CI/CD.

### Features
- Triage with red-flag escalation to ER (no diagnosis)
- Search facilities near a location with filters
- Generate appointment availability (mock, deterministic)
- Mock booking returning a deep link
- Compact UI component spec for Apps SDK with list + map + slot picker

### Quickstart
1. Clone and install
```bash
npm i
```
2. Create `.env` in project root:
```
PORT=8080
APP_BASE_URL=http://localhost:8080
OPENAI_API_KEY=
```
3. Dev server
```bash
npm run dev
```
4. Build and run
```bash
npm run build && npm start
```
5. Test
```bash
npm test
```

### API Endpoints
- `GET /health`
- `POST /api/triage`
  - Body: `{ symptoms: string, age: number, pregnancyStatus?: "unknown"|"pregnant"|"not_pregnant", durationHours?: number }`
  - Returns: `{ venue: "urgent_care"|"er"|"primary_care"|"virtual", rationale: string, redFlag: boolean }`
- `POST /api/search-facilities`
  - Body: `{ lat: number, lon: number, radiusMiles?: number, venue: "urgent_care"|"er"|"primary_care"|"virtual", acceptsInsurancePlanId?: string, openNow?: boolean, pediatricFriendly?: boolean }`
  - Returns: Array of facilities with distance and `openNow`.
- `POST /api/availability`
  - Body: `{ facilityId: string, serviceCode?: string, days?: number }`
  - Returns: `{ facilityId, serviceCode, slots: string[] }` ISO strings within open hours.
- `POST /api/book`
  - Body: `{ facilityId: string, slotId: string, patientContextToken: string }`
  - Returns: `{ deepLink: string }`

### Apps SDK
- See files under `apps/find-care/`. These include tool schemas, app config, and a lightweight TSX component. They are stubs suitable for integration with the ChatGPT Apps SDK.

### Data
- Mock JSON in `data/` (Anchorage and Seattle). You can also pull data from `https://providencekyruus.azurewebsites.net/api/searchlocationsbyservices`.

### Docker
```bash
docker compose up --build
```
App listens on `0.0.0.0:${PORT}`.

### Azure Deployment (App Service, container)
1. Create resources (example)
```bash
az group create -n <RG> -l westus
az webapp create --resource-group <RG> --plan <ASP> --name <APP> --deployment-container-image-name ghcr.io/<owner>/<repo>:latest
```
2. Configure App Settings (PORT=8080, APP_BASE_URL, OPENAI_API_KEY)
3. Set up GitHub OIDC and repository secrets:
   - `AZURE_CREDENTIALS` (OIDC JSON)
   - `AZURE_WEBAPP_NAME`, `AZURE_RESOURCE_GROUP`
   - `CONTAINER_REGISTRY` (e.g., `ghcr.io/<owner>/<repo>`)
4. Push to `main` to build/push container and deploy via workflow.

### Notes
- Safety: Hard-coded escalation for red flags (chest pain, stroke signs, severe trauma, anaphylaxis, uncontrolled bleeding, severe burns, pregnancy with heavy bleeding, suicidal ideation). No diagnosis. No PHI stored.
- Time zones: Facilities include `timeZone` and hours; availability and `openNow` respect local hours.



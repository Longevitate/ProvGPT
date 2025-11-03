/* Lightweight TSX UI for ChatGPT Apps SDK rendering. This file is not compiled by the server build. */

type FacilityCard = {
  id: string;
  name: string;
  distance: number;
  lat: number;
  lon: number;
  openNow: boolean;
  address: { line1: string; city: string; state: string; zip: string };
  insurancePlanIds?: string[];
};

type Props = {
  query: string;
  lat: number;
  lon: number;
  venue: "urgent_care" | "er" | "primary_care" | "virtual";
  acceptsInsurancePlanId?: string;
  results: FacilityCard[];
  getAvailability: (facilityId: string) => Promise<string[]>;
  onBook: (facilityId: string, slotId: string) => Promise<{ deepLink: string }>;
  // UI rendering support
  ui?: string;
  uiProps?: any;
  fallback_markdown?: string;
};

// Allowlisted UI URIs for security
const ALLOWED_UI_URIS = new Set([
  "ui://find-care/widget.html",
  "ui://find-care/confirmation.html"
]);

function renderUIWidget(uri: string, widgetProps: any, fallbackMarkdown: string): JSX.Element {
  // Check if URI is allowlisted
  if (!ALLOWED_UI_URIS.has(uri)) {
    return renderFallback(fallbackMarkdown, `Unrecognized UI URI: ${uri}`);
  }

  try {
    // For now, render as iframe. In production, this could be component-based
    const iframeSrc = `/public/find-care-test.html?props=${encodeURIComponent(JSON.stringify(widgetProps))}`;

    return (
      <div className="ui-widget-container">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Interactive Care Finder</span>
          <details className="text-xs">
            <summary className="cursor-pointer px-2 py-1 rounded bg-slate-100 hover:bg-slate-200">
              Options
            </summary>
            <div className="mt-1 p-2 bg-white border rounded shadow-sm">
              <button
                className="block w-full text-left text-xs px-2 py-1 rounded hover:bg-slate-50"
                onClick={() => {
                  // Simple toggle - replace widget with fallback
                  const container = document.querySelector('.ui-widget-container');
                  if (container) {
                    const fallbackDiv = document.createElement('div');
                    fallbackDiv.className = 'fallback-container';
                    fallbackDiv.innerHTML = `
                      <div class="flex items-center justify-between mb-2">
                        <span class="text-sm font-medium">Text View</span>
                        <button class="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200"
                                onclick="location.reload()">Show Widget</button>
                      </div>
                      <pre class="text-sm whitespace-pre-wrap font-mono">${fallbackMarkdown}</pre>
                    `;
                    container.parentNode?.replaceChild(fallbackDiv, container);
                  }
                }}
              >
                Show as Text
              </button>
            </div>
          </details>
        </div>
        <iframe
          src={iframeSrc}
          className="w-full h-96 border rounded"
          title="Care Finder Widget"
          sandbox="allow-scripts allow-same-origin"
        />
        <div className="mt-2 text-xs text-slate-500">
          Widget: {uri}
        </div>
      </div>
    );
  } catch (error) {
    return renderFallback(fallbackMarkdown, `Widget rendering failed: ${error}`);
  }
}

function renderFallback(markdown: string, error?: string): JSX.Element {
  const content = error ? `${error}\n\n${markdown}` : markdown;

  return (
    <div className="fallback-container">
      {error && (
        <div className="mb-2 p-2 rounded bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}
      <pre className="text-sm whitespace-pre-wrap font-mono">{content}</pre>
    </div>
  );
}

export default async function FindCareComponent(props: Props): Promise<JSX.Element> {
  // Check if we should render a UI widget
  if (props.ui && props.ui.startsWith("ui://")) {
    // If uiProps contains the traditional structure (query + results), use it directly
    const widgetData = props.uiProps && props.uiProps.query && props.uiProps.results
      ? props.uiProps
      : { results: props.results, query: { zip: props.query, venue: props.venue } };

    return renderUIWidget(props.ui, widgetData, props.fallback_markdown || "No fallback content available");
  }

  // Original rendering logic
  const top = props.results.slice(0, 2);
  const nextSlotsMap: Record<string, string[]> = {};
  for (const f of top) {
    try {
      nextSlotsMap[f.id] = await props.getAvailability(f.id);
    } catch {
      nextSlotsMap[f.id] = [];
    }
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="px-2 py-1 rounded bg-slate-100">Location: {props.results[0]?.address.city ?? `${props.lat.toFixed(3)},${props.lon.toFixed(3)}`}</span>
        <span className="px-2 py-1 rounded bg-emerald-100 capitalize">{props.venue.replace("_", " ")}</span>
        {props.acceptsInsurancePlanId && (
          <span className="px-2 py-1 rounded bg-indigo-100">Plan: {props.acceptsInsurancePlanId}</span>
        )}
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="flex flex-col gap-3">
          {props.results.map((f) => (
            <div key={f.id} className="border rounded p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="font-medium">{f.name}</div>
                <div className="text-xs text-slate-600">{f.distance.toFixed(1)} mi</div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className={"px-2 py-0.5 rounded " + (f.openNow ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700")}>{f.openNow ? "Open now" : "Closed"}</span>
                {props.acceptsInsurancePlanId && (
                  <span className={"px-2 py-0.5 rounded " + ((f.insurancePlanIds||[]).includes(props.acceptsInsurancePlanId) ? "bg-indigo-100 text-indigo-800" : "bg-red-100 text-red-800") }>
                    {(f.insurancePlanIds||[]).includes(props.acceptsInsurancePlanId) ? "In-network" : "Out-of-network"}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-700">{f.address.line1}, {f.address.city}, {f.address.state} {f.address.zip}</div>
              <div className="text-xs text-slate-600">Why: {(f.openNow ? "Open now" : "Closed")}, {f.distance.toFixed(1)} mi{props.acceptsInsurancePlanId ? 
                (((f.insurancePlanIds||[]).includes(props.acceptsInsurancePlanId)) ? ", in-network" : ", out-of-network") : ""}
                {nextSlotsMap[f.id] && nextSlotsMap[f.id][0] ? ", soonest " + new Date(nextSlotsMap[f.id][0]).toLocaleString() : ""}
              </div>
              {nextSlotsMap[f.id] && nextSlotsMap[f.id].length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">Soonest:</span>
                  <span className="text-xs">{new Date(nextSlotsMap[f.id][0]).toLocaleString()}</span>
                </div>
              )}
              <details>
                <summary className="text-sm cursor-pointer">Select</summary>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(await props.getAvailability(f.id)).map((slot) => (
                    <button
                      key={slot}
                      className="px-2 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={async () => {
                        const { deepLink } = await props.onBook(f.id, slot);
                        // In ChatGPT UI this would render a link/confirmation
                        console.log("Booked:", deepLink);
                      }}
                    >
                      {new Date(slot).toLocaleString()}
                    </button>
                  ))}
                </div>
              </details>
            </div>
          ))}
        </div>
        <div>
          <iframe
            title="map"
            className="w-full h-96 rounded border"
            src={`https://maps.google.com/?q=${props.lat},${props.lon}`}
          />
        </div>
      </div>
    </div>
  );
}

// minimal intrinsic JSX namespace to avoid bringing React types
declare global {
  namespace JSX {
    type Element = any;
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}



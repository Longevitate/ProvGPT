export function coerceJsonBody(raw) {
    if (typeof raw !== "string")
        return raw;
    const trimmed = raw.trim();
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
        try {
            return JSON.parse(trimmed);
        }
        catch (_a) {
            return raw;
        }
    }
    return raw;
}

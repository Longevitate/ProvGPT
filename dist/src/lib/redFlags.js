export function detectRedFlags(symptoms, context) {
    const text = symptoms.toLowerCase();
    const flags = [
        /chest\s*pain/,
        /(shortness\s*of\s*breath).*cyanosis|blue\s*lips|turning\s*blue/,
        /(one[-\s]*sided\s*weakness|slurred\s*speech|face\s*droop)/,
        /(severe|uncontrolled)\s*bleeding/,
        /anaphylaxis|throat\s*closing|can\'?t\s*breathe/,
        /(high[-\s]*energy|major)\s*trauma|hit\s*by\s*car|fall\s*from/,
        /severe\s*burns?/,
        /(pregnan(t|cy)).*(heavy\s*bleeding)/,
        /suicidal|suicide|harm\s*myself/
    ];
    for (const re of flags) {
        if (re.test(text))
            return true;
    }
    return false;
}
export function recommendVenue(symptoms, _context) {
    const s = symptoms.toLowerCase();
    if (/sore\s*throat|ear\s*pain|pink\s*eye|minor\s*injury|sprain/.test(s))
        return "urgent_care";
    if (/medication\s*refill|chronic|routine|follow\s*up/.test(s))
        return "primary_care";
    if (/rash|mild\s*cough|cold|questions/.test(s))
        return "virtual";
    return "urgent_care";
}

function getLocalYMDHM(date, timeZone) {
    const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    });
    const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
    const yyyy = Number(parts.year);
    const mm = Number(parts.month);
    const dd = Number(parts.day);
    const hh = Number(parts.hour);
    const min = Number(parts.minute);
    // 0=Sunday..6=Saturday in local timezone: derive by creating a Date in that tz string.
    // Intl doesn't expose weekday numeric; approximate by rebuilding a string and using Date.
    const localStr = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00`;
    const weekday = new Date(localStr).getUTCDay();
    return { yyyy, mm, dd, hh, min, weekday };
}
function weekdayKey(weekday) {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][weekday];
}
function toMinutes(t) {
    const [h, m] = t.split(":").map((x) => Number(x));
    return h * 60 + m;
}
export function isOpenNow(timeZone, weeklyHours, now = new Date()) {
    const { hh, min, weekday } = getLocalYMDHM(now, timeZone);
    const mins = hh * 60 + min;
    const intervals = weeklyHours[weekdayKey(weekday)] || [];
    for (const interval of intervals) {
        const start = toMinutes(interval.open);
        const end = toMinutes(interval.close);
        if (mins >= start && mins < end)
            return true;
    }
    return false;
}
export function nextSlotsWithinDays(timeZone, weeklyHours, start, days, countMin = 3, countMax = 6, rand = Math.random) {
    const slots = [];
    const target = countMin + Math.floor(rand() * (countMax - countMin + 1));
    let d = new Date(start);
    for (let i = 0; i < days && slots.length < target; i++) {
        const { yyyy, mm, dd, weekday } = getLocalYMDHM(d, timeZone);
        const dayIntervals = weeklyHours[weekdayKey(weekday)] || [];
        for (const interval of dayIntervals) {
            const [openH, openM] = interval.open.split(":").map(Number);
            const [closeH, closeM] = interval.close.split(":").map(Number);
            const totalMinutes = (closeH * 60 + closeM) - (openH * 60 + openM);
            if (totalMinutes <= 0)
                continue;
            // Generate 1-3 slots per interval
            const n = 1 + Math.floor(rand() * 3);
            for (let k = 0; k < n && slots.length < target; k++) {
                const offset = Math.floor(rand() * (totalMinutes - 15));
                const slotMin = openH * 60 + openM + offset;
                const sh = Math.floor(slotMin / 60);
                const sm = slotMin % 60;
                const mmStr = String(mm).padStart(2, "0");
                const ddStr = String(dd).padStart(2, "0");
                const shStr = String(sh).padStart(2, "0");
                const smStr = String(sm).padStart(2, "0");
                const iso = new Date(`${yyyy}-${mmStr}-${ddStr}T${shStr}:${smStr}:00`).toISOString();
                slots.push(iso);
            }
        }
        d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    }
    return slots.sort();
}

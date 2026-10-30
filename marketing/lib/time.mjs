/**
 * Timezone handling without a dependency.
 *
 * A post planned for "Tuesday" is planned for a local time in the audience's
 * timezone, not in UTC and not in the server's timezone. Getting this wrong
 * means a Greek-couple post published at 03:00.
 */

function tzOffsetMs(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = {};
  for (const part of formatter.formatToParts(date)) parts[part.type] = part.value;
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUTC - date.getTime();
}

/**
 * Turns a local wall-clock time in a timezone into the UTC instant.
 * `dateStr` is YYYY-MM-DD, `hour` and `minute` are local time.
 */
export function zonedToUtc(dateStr, hour, minute, timeZone) {
  const [year, month, day] = String(dateStr).split('-').map(Number);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, 0);
  // Two passes: the first offset is taken at the approximate instant, the
  // second at the corrected one. This handles the offset changing either
  // side of a daylight-saving boundary.
  let instant = wallClock - tzOffsetMs(new Date(wallClock), timeZone);
  instant = wallClock - tzOffsetMs(new Date(instant), timeZone);
  return new Date(instant);
}

/** The local date and time of an instant, for display. */
export function formatInZone(date, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date instanceof Date ? date : new Date(date));
}

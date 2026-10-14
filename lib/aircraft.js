const OPENFLIGHTS_AIRCRAFT_URL =
  "https://raw.githubusercontent.com/jpatokal/openflights/master/data/planes.dat";

const FALLBACK_AIRCRAFT = new Map([
  ["A20N", "Airbus A320neo"],
  ["A21N", "Airbus A321neo"],
  ["A319", "Airbus A319"],
  ["A320", "Airbus A320"],
  ["A321", "Airbus A321"],
  ["A359", "Airbus A350-900"],
  ["B38M", "Boeing 737 MAX 8"],
  ["B39M", "Boeing 737 MAX 9"],
  ["B737", "Boeing 737-700"],
  ["B738", "Boeing 737-800"],
  ["B739", "Boeing 737-900"],
  ["B77W", "Boeing 777-300ER"],
  ["B788", "Boeing 787-8"],
  ["B789", "Boeing 787-9"],
  ["CRJ9", "Bombardier CRJ-900"],
  ["E170", "Embraer E170"],
  ["E175", "Embraer E175"],
]);

function parseCsvRow(line) {
  const values = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += character;
    }
  }

  values.push(current);
  return values;
}

export function parseAircraftData(data) {
  const aircraft = new Map(FALLBACK_AIRCRAFT);

  for (const line of data.split(/\r?\n/)) {
    if (!line) continue;
    const row = parseCsvRow(line);
    if (row.length < 3) continue;

    const name = row[0]?.trim();
    const iata = row[1]?.trim().toUpperCase();
    const icao = row[2]?.trim().toUpperCase();

    if (name && iata && iata !== "\\N") aircraft.set(iata, name);
    if (name && icao && icao !== "\\N") aircraft.set(icao, name);
  }

  return aircraft;
}

export async function getAircraftMapping() {
  try {
    const response = await fetch(OPENFLIGHTS_AIRCRAFT_URL, {
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) throw new Error(`OpenFlights returned ${response.status}`);
    return parseAircraftData(await response.text());
  } catch (error) {
    console.warn("Using built-in aircraft names", error);
    return new Map(FALLBACK_AIRCRAFT);
  }
}

export function resolveAircraftName(code, aircraft) {
  if (!code) return null;
  const normalizedCode = String(code).trim().toUpperCase();
  return aircraft?.get(normalizedCode) || normalizedCode;
}

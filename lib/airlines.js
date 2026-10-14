const OPENFLIGHTS_AIRLINES_URL =
  "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat";

const FALLBACK_AIRLINES = new Map([
  ["ACA", "Air Canada"],
  ["AC", "Air Canada"],
  ["AAL", "American Airlines"],
  ["AA", "American Airlines"],
  ["ASA", "Alaska Airlines"],
  ["AS", "Alaska Airlines"],
  ["BAW", "British Airways"],
  ["BA", "British Airways"],
  ["CPA", "Cathay Pacific"],
  ["CX", "Cathay Pacific"],
  ["DAL", "Delta Air Lines"],
  ["DL", "Delta Air Lines"],
  ["EVA", "EVA Air"],
  ["BR", "EVA Air"],
  ["JBU", "JetBlue Airways"],
  ["B6", "JetBlue Airways"],
  ["SIA", "Singapore Airlines"],
  ["SQ", "Singapore Airlines"],
  ["SKW", "SkyWest Airlines"],
  ["SWA", "Southwest Airlines"],
  ["WN", "Southwest Airlines"],
  ["UAL", "United Airlines"],
  ["UA", "United Airlines"],
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

export function parseAirlineData(data) {
  const airlines = new Map(FALLBACK_AIRLINES);

  for (const line of data.split(/\r?\n/)) {
    if (!line) continue;
    const row = parseCsvRow(line);
    if (row.length < 5) continue;

    const name = row[1]?.trim();
    const iata = row[3]?.trim().toUpperCase();
    const icao = row[4]?.trim().toUpperCase();

    if (name && iata && iata !== "\\N") airlines.set(iata, name);
    if (name && icao && icao !== "\\N") airlines.set(icao, name);
  }

  return airlines;
}

export async function getAirlineMapping() {
  try {
    const response = await fetch(OPENFLIGHTS_AIRLINES_URL, {
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) throw new Error(`OpenFlights returned ${response.status}`);
    return parseAirlineData(await response.text());
  } catch (error) {
    console.warn("Using built-in airline names", error);
    return new Map(FALLBACK_AIRLINES);
  }
}

export function inferAirlineName(codeOrIdent, airlines) {
  if (!codeOrIdent) return null;
  const token = String(codeOrIdent).trim().toUpperCase().split(/\s+/)[0];

  for (const candidate of [token, token.slice(0, 3), token.slice(0, 2)]) {
    if (airlines.has(candidate)) return airlines.get(candidate);
  }

  return null;
}

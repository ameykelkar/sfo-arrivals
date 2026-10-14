const OPENFLIGHTS_AIRPORTS_URL =
  "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat";

const FALLBACK_AIRPORT_COUNTRIES = new Map([
  ["AMS", "Netherlands"],
  ["CDG", "France"],
  ["FRA", "Germany"],
  ["HKG", "Hong Kong"],
  ["ICN", "South Korea"],
  ["LHR", "United Kingdom"],
  ["MEX", "Mexico"],
  ["NRT", "Japan"],
  ["SIN", "Singapore"],
  ["SYD", "Australia"],
  ["TPE", "Taiwan"],
  ["YVR", "Canada"],
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

export function parseAirportData(data) {
  const countries = new Map(FALLBACK_AIRPORT_COUNTRIES);

  for (const line of data.split(/\r?\n/)) {
    if (!line) continue;
    const row = parseCsvRow(line);
    if (row.length < 6) continue;

    const country = row[3]?.trim();
    const iata = row[4]?.trim().toUpperCase();
    const icao = row[5]?.trim().toUpperCase();

    if (country && iata && iata !== "\\N") countries.set(iata, country);
    if (country && icao && icao !== "\\N") countries.set(icao, country);
  }

  return countries;
}

export async function getAirportCountryMapping() {
  try {
    const response = await fetch(OPENFLIGHTS_AIRPORTS_URL, {
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) throw new Error(`OpenFlights returned ${response.status}`);
    return parseAirportData(await response.text());
  } catch (error) {
    console.warn("Using built-in airport countries", error);
    return new Map(FALLBACK_AIRPORT_COUNTRIES);
  }
}

export function findAirportCountry(reference, countries) {
  if (!reference || !countries) return null;

  for (const code of [
    reference.code_iata,
    reference.code_icao,
    reference.code,
    reference.code_lid,
  ]) {
    const country = countries.get(String(code || "").toUpperCase());
    if (country) return country;
  }

  return null;
}

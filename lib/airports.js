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

const COUNTRY_CODE_ALIASES = new Map([
  ["Brunei Darussalam", "BN"],
  ["Cabo Verde", "CV"],
  ["Cote d'Ivoire", "CI"],
  ["Czech Republic", "CZ"],
  ["DR Congo", "CD"],
  ["Faeroe Islands", "FO"],
  ["Micronesia, Fed. Sts.", "FM"],
  ["Macedonia", "MK"],
  ["Reunion", "RE"],
  ["Sao Tome and Principe", "ST"],
  ["United Kingdom", "GB"],
]);

let countryCodesByName;

function getCountryCodesByName() {
  if (countryCodesByName) return countryCodesByName;

  const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
  const entries = [];

  for (let first = 65; first <= 90; first += 1) {
    for (let second = 65; second <= 90; second += 1) {
      const code = String.fromCharCode(first, second);
      const name = displayNames.of(code);
      if (name && name !== code) entries.push([name, code]);
    }
  }

  countryCodesByName = new Map([...entries, ...COUNTRY_CODE_ALIASES]);
  return countryCodesByName;
}

export function countryFlag(country) {
  const code = getCountryCodesByName().get(country);
  if (!code) return "";

  return [...code]
    .map((character) => String.fromCodePoint(character.charCodeAt(0) + 127397))
    .join("");
}

function formatCountry(country) {
  const flag = countryFlag(country);
  return flag ? `${flag} ${country}` : country;
}

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
  const countries = new Map(
    [...FALLBACK_AIRPORT_COUNTRIES].map(([code, country]) => [
      code,
      formatCountry(country),
    ]),
  );

  for (const line of data.split(/\r?\n/)) {
    if (!line) continue;
    const row = parseCsvRow(line);
    if (row.length < 6) continue;

    const country = row[3]?.trim();
    const iata = row[4]?.trim().toUpperCase();
    const icao = row[5]?.trim().toUpperCase();

    const displayCountry = country && formatCountry(country);
    if (displayCountry && iata && iata !== "\\N") countries.set(iata, displayCountry);
    if (displayCountry && icao && icao !== "\\N") countries.set(icao, displayCountry);
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
    return new Map(
      [...FALLBACK_AIRPORT_COUNTRIES].map(([code, country]) => [
        code,
        formatCountry(country),
      ]),
    );
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

interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Real Estate Japan MCP — actual residential/commercial transaction prices and
 * agreed (contract) prices for Japan, from MLIT's 不動産情報ライブラリ
 * (Real Estate Information Library) public API.
 *
 * Source: reinfolib.mlit.go.jp ex-api (XIT001 transaction prices, XIT002 the
 * municipality-code lookup). Auth: a personal subscription key in the
 * `Ocp-Apim-Subscription-Key` header. Pipeworx holds the shared key
 * (PLATFORM_MLIT_KEY, injected as _apiKey); users may pass their own.
 *
 * Tools:
 * - realestate_transactions:  reported transaction/contract prices by area + period
 * - realestate_municipalities: city/ward codes within a prefecture (for the above)
 */


const BASE = 'https://www.reinfolib.mlit.go.jp/ex-api/external';

// Prefecture name (en + common romanization) -> 2-digit MLIT/JIS area code.
const PREFECTURES: Record<string, string> = {
  hokkaido: '01', aomori: '02', iwate: '03', miyagi: '04', akita: '05', yamagata: '06', fukushima: '07',
  ibaraki: '08', tochigi: '09', gunma: '10', saitama: '11', chiba: '12', tokyo: '13', kanagawa: '14',
  niigata: '15', toyama: '16', ishikawa: '17', fukui: '18', yamanashi: '19', nagano: '20', gifu: '21',
  shizuoka: '22', aichi: '23', mie: '24', shiga: '25', kyoto: '26', osaka: '27', hyogo: '28', nara: '29',
  wakayama: '30', tottori: '31', shimane: '32', okayama: '33', hiroshima: '34', yamaguchi: '35',
  tokushima: '36', kagawa: '37', ehime: '38', kochi: '39', fukuoka: '40', saga: '41', nagasaki: '42',
  kumamoto: '43', oita: '44', miyazaki: '45', kagoshima: '46', okinawa: '47',
};

const API_KEY_PROP = {
  type: 'string' as const,
  description: 'Optional — your own free MLIT reinfolib subscription key. Omit to use the shared Pipeworx key.',
};

const tools: McpToolExport['tools'] = [
  {
    name: 'realestate_transactions',
    description:
      "Real, reported Japanese real-estate transaction prices (and 2021+ agreed/contract prices) from MLIT's 不動産情報ライブラリ. PREFER OVER WEB SEARCH for \"property/land prices in Tokyo/Osaka/<Japanese city>\", \"what did homes sell for in <ward>\", Japan housing-market data. Filter by prefecture (name or code), and/or city code, and/or station code, for a given year + quarter. Returns each transaction's type, district, trade price, area, price-per-unit, building year, structure, and use. Coverage: transactions 2005-Q3 onward, agreed prices 2021-Q1 onward.",
    inputSchema: {
      type: 'object' as const,
      properties: {
        prefecture: { type: 'string', description: 'Prefecture name (e.g. "Tokyo", "Osaka") or 2-digit code (01-47). Use this OR city OR station.' },
        city: { type: 'string', description: 'Optional 5-digit municipality code (from realestate_municipalities), e.g. "13102" (Chuo-ku, Tokyo). Narrows within the prefecture.' },
        station: { type: 'string', description: 'Optional 6-digit rail station code to filter by nearest station.' },
        year: { type: 'number', description: 'Year (YYYY). Transactions 2005+; agreed prices 2021+. Required.' },
        quarter: { type: 'number', description: 'Quarter 1-4. Required.' },
        price_type: { type: 'string', description: 'Which prices: "transaction" (reported sales), "agreed" (contract prices, 2021+), or omit for both.', enum: ['transaction', 'agreed', 'both'] },
        limit: { type: 'number', description: 'Max records to return (1-200, default 50).' },
        _apiKey: API_KEY_PROP,
      },
      required: ['year', 'quarter'],
    },
  },
  {
    name: 'realestate_municipalities',
    description:
      "List the cities/wards (and their 5-digit municipality codes) within a Japanese prefecture, from MLIT's 不動産情報ライブラリ. Use to resolve a city code for realestate_transactions (e.g. find that Chuo-ku, Tokyo = 13102). Pass a prefecture name (e.g. \"Tokyo\") or 2-digit code (01-47).",
    inputSchema: {
      type: 'object' as const,
      properties: {
        prefecture: { type: 'string', description: 'Prefecture name (e.g. "Tokyo") or 2-digit code (01-47).' },
        _apiKey: API_KEY_PROP,
      },
      required: ['prefecture'],
    },
  },
];

// ── Helpers ──────────────────────────────────────────────────────────

function resolveArea(input: string): string {
  const s = String(input ?? '').trim();
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, '0');
  const key = s.toLowerCase().replace(/[\s-]+/g, '').replace(/prefecture$/, '').replace(/[-]?ken$|[-]?to$|[-]?fu$/, '');
  const code = PREFECTURES[key] ?? PREFECTURES[s.toLowerCase().replace(/[\s-]+/g, '')];
  if (!code) throw new Error(`Unknown prefecture "${input}". Use a name like "Tokyo" or a 2-digit code (01-47).`);
  return code;
}

async function mlitGet(key: string, id: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  if (!key || !key.trim()) {
    throw new Error('MLIT subscription key missing. The shared key is normally injected; pass your own via _apiKey (free at reinfolib.mlit.go.jp → API利用申請).');
  }
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}/${id}?${qs}`, {
    headers: { 'Ocp-Apim-Subscription-Key': key.trim(), Accept: 'application/json', 'User-Agent': 'Pipeworx/1.0 (pipeworx.io)' },
  });
  if (res.status === 401 || res.status === 403) throw new Error(`MLIT auth rejected (${res.status}) — check the subscription key.`);
  if (!res.ok) throw new Error(`MLIT reinfolib error: ${res.status}`);
  return res.json() as Promise<Record<string, unknown>>;
}

// ── Tool implementations ─────────────────────────────────────────────

interface TxnRow {
  Type?: string; Region?: string; MunicipalityCode?: string; Prefecture?: string; Municipality?: string;
  DistrictName?: string; TradePrice?: string; PricePerUnit?: string; FloorPlan?: string; Area?: string;
  UnitPrice?: string; LandShape?: string; Frontage?: string; TotalFloorArea?: string; BuildingYear?: string;
  Structure?: string; Use?: string; Purpose?: string; Direction?: string; CityPlanning?: string;
  CoverageRatio?: string; FloorAreaRatio?: string; Period?: string; Renovation?: string; Remarks?: string;
}

async function transactions(key: string, args: Record<string, unknown>) {
  const year = Number(args.year);
  const quarter = Number(args.quarter);
  if (!Number.isFinite(year) || year < 2005) throw new Error('"year" must be a year >= 2005 (agreed prices 2021+).');
  if (!Number.isFinite(quarter) || quarter < 1 || quarter > 4) throw new Error('"quarter" must be 1-4.');

  const params: Record<string, string> = { year: String(year), quarter: String(quarter), language: 'en' };
  if (args.prefecture != null && String(args.prefecture).trim()) params.area = resolveArea(String(args.prefecture));
  if (args.city != null && String(args.city).trim()) params.city = String(args.city).trim().replace(/[^0-9]/g, '');
  if (args.station != null && String(args.station).trim()) params.station = String(args.station).trim().replace(/[^0-9]/g, '');
  if (!params.area && !params.city && !params.station) {
    throw new Error('Specify at least one of prefecture, city, or station.');
  }
  const pc = String(args.price_type ?? '').toLowerCase();
  if (pc === 'transaction') params.priceClassification = '01';
  else if (pc === 'agreed') params.priceClassification = '02';

  const limit = Math.min(200, Math.max(1, Number(args.limit) || 50));
  const data = await mlitGet(key, 'XIT001', params);
  const rows = (data.data as TxnRow[]) ?? [];
  return {
    year, quarter,
    filter: { area: params.area ?? null, city: params.city ?? null, station: params.station ?? null, price_type: pc || 'both' },
    total: rows.length,
    returned: Math.min(rows.length, limit),
    source: 'MLIT 不動産情報ライブラリ (Real Estate Information Library)',
    transactions: rows.slice(0, limit).map((r) => ({
      type: r.Type ?? null,
      region: r.Region ?? null,
      prefecture: r.Prefecture ?? null,
      municipality: r.Municipality ?? null,
      municipality_code: r.MunicipalityCode ?? null,
      district: r.DistrictName ?? null,
      trade_price: r.TradePrice ?? null,
      price_per_unit: r.PricePerUnit ?? null,
      unit_price: r.UnitPrice ?? null,
      area_sqm: r.Area ?? null,
      floor_plan: r.FloorPlan ?? null,
      total_floor_area: r.TotalFloorArea ?? null,
      building_year: r.BuildingYear ?? null,
      structure: r.Structure ?? null,
      use: r.Use ?? null,
      purpose: r.Purpose ?? null,
      city_planning: r.CityPlanning ?? null,
      coverage_ratio: r.CoverageRatio ?? null,
      floor_area_ratio: r.FloorAreaRatio ?? null,
      period: r.Period ?? null,
      renovation: r.Renovation ?? null,
      remarks: r.Remarks ?? null,
    })),
  };
}

interface MuniRow { id?: string; name?: string }

async function municipalities(key: string, prefecture: string) {
  const area = resolveArea(prefecture);
  const data = await mlitGet(key, 'XIT002', { area, language: 'en' });
  const rows = (data.data as MuniRow[]) ?? [];
  return {
    prefecture_code: area,
    count: rows.length,
    source: 'MLIT 不動産情報ライブラリ',
    municipalities: rows.map((m) => ({ code: m.id ?? null, name: m.name ?? null })),
  };
}

// ── Router ───────────────────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const key = args._apiKey as string;
  delete args._apiKey;
  switch (name) {
    case 'realestate_transactions':
      return transactions(key, args);
    case 'realestate_municipalities':
      return municipalities(key, args.prefecture as string);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;

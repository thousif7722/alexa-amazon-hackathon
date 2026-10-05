import fs from 'fs';
import path from 'path';
import { Booking } from '@actionos/types';
import seedServicesJson from './services.seed.json';

export interface ServiceItem {
  id: string;
  name: string;
  category: string;
  description: string;
  price?: number;
  active?: boolean;
}

// ─── Static Seed Data ──────────────────────────────────────────────────────
const SEED_SERVICES: ServiceItem[] = (seedServicesJson as ServiceItem[]).filter((s) => s.active !== false);

// ─── Phone / address masking ───────────────────────────────────────────────
function maskPhone(phone: string): string {
  return phone.replace(/(\+?\d{2,3})\s?\d{3,5}(\s?\d{3,5})?(\s?\d{2,5})/, (_, p1) => `${p1} ••• ••${phone.slice(-3)}`);
}

function maskAddress(addr: string): string {
  const parts = addr.split(',');
  if (parts.length <= 1) return addr;
  return `••• ${parts.slice(1).join(',').trim()}`;
}

// ─── Persistence helpers ───────────────────────────────────────────────────
function getDataFilePath(): string {
  const dataDir = process.env.MOCK_DATA_DIR
    ? path.resolve(process.env.MOCK_DATA_DIR)
    : path.resolve(process.cwd(), 'data');

  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (_) {}
  }
  return path.join(dataDir, 'bookings.json');
}

function loadBookings(): Map<string, Booking> {
  const filePath = getDataFilePath();
  try {
    if (!fs.existsSync(filePath)) {
      const seed: Booking = {
        bookingId: 'OWF-1001',
        customerName: 'Rahul Sharma',
        phone: '+91 98765 43210',
        service: 'AC Repair & Deep Service',
        address: '123 MG Road, Koramangala, Bengaluru',
        preferredTime: '2026-10-06 10:00 AM',
        notes: 'AC is not cooling properly',
        status: 'confirmed',
        source: 'OneWayFix Demo',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const initial: Record<string, Booking> = { 'OWF-1001': seed };
      fs.writeFileSync(filePath, JSON.stringify(initial, null, 2), 'utf8');
      return new Map(Object.entries(initial));
    }
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, Booking>;
    return new Map(Object.entries(raw));
  } catch (_) {
    return new Map();
  }
}

function saveBookings(map: Map<string, Booking>) {
  const filePath = getDataFilePath();
  try {
    const obj: Record<string, Booking> = {};
    map.forEach((v, k) => { obj[k] = v; });
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf8');
  } catch (_) {}
}

// ─── Client class ──────────────────────────────────────────────────────────
export class OneWayFixClient {
  private apiUrl: string;
  private apiKey: string;
  private isMock: boolean;

  // 5-min in-memory services cache
  private static servicesCache: { data: ServiceItem[]; timestamp: number } | null = null;
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(apiUrl?: string, apiKey?: string) {
    this.apiUrl = apiUrl || process.env.ONEWAYFIX_API_URL || 'https://api.onewayfix.com/v1';
    this.apiKey = apiKey || process.env.ONEWAYFIX_API_KEY || '';
    const mockEnv = process.env.ONEWAYFIX_MOCK;
    this.isMock = mockEnv === 'true' || mockEnv === '1' || !this.apiKey;
  }

  public getIsMock(): boolean { return this.isMock; }

  private getHeaders(): Record<string, string> {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` };
  }

  // ── Services ────────────────────────────────────────────────────────────
  public async listServices(category?: string, query?: string): Promise<ServiceItem[]> {
    const now = Date.now();
    if (
      OneWayFixClient.servicesCache &&
      now - OneWayFixClient.servicesCache.timestamp < OneWayFixClient.CACHE_TTL_MS
    ) {
      return this._filter(OneWayFixClient.servicesCache.data, category, query);
    }

    if (this.isMock) {
      OneWayFixClient.servicesCache = { data: SEED_SERVICES, timestamp: now };
      return this._filter(SEED_SERVICES, category, query);
    }

    // Live mode: try /api/alexa/services first
    try {
      const res = await fetch(`${this.apiUrl}/api/alexa/services`, { headers: this.getHeaders() });
      if (res.ok) {
        const raw = (await res.json()) as ServiceItem[];
        const active = raw.filter((s) => s.active !== false);
        OneWayFixClient.servicesCache = { data: active, timestamp: now };
        return this._filter(active, category, query);
      }
    } catch (_) { /* fall through */ }

    try {
      const url = new URL(`${this.apiUrl}/services`);
      if (category) url.searchParams.append('category', category);
      if (query) url.searchParams.append('q', query);
      const res = await fetch(url.toString(), { headers: this.getHeaders() });
      if (res.ok) {
        const data = (await res.json()) as ServiceItem[];
        OneWayFixClient.servicesCache = { data, timestamp: now };
        return this._filter(data, category, query);
      }
    } catch (_) { /* fall through */ }

    // Fallback to static seed
    OneWayFixClient.servicesCache = { data: SEED_SERVICES, timestamp: now };
    return this._filter(SEED_SERVICES, category, query);
  }

  private _filter(services: ServiceItem[], category?: string, query?: string): ServiceItem[] {
    let result = services;
    if (category) result = result.filter((s) => s.category.toLowerCase().includes(category.toLowerCase()));
    if (query) {
      const q = query.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
    }
    return result;
  }

  // Tiered fuzzy matching algorithm: exact -> substring -> token score -> category fallback
  public async matchService(serviceQuery: string): Promise<ServiceItem | undefined> {
    const services = await this.listServices();
    const q = serviceQuery.trim().toLowerCase();

    // 1. Exact match by name or ID
    const exact = services.find((s) => s.name.toLowerCase() === q || s.id.toLowerCase() === q);
    if (exact) return exact;

    // 2. Substring match
    const sub = services.find((s) => s.name.toLowerCase().includes(q) || q.includes(s.name.toLowerCase()));
    if (sub) return sub;

    // 3. Token-score match (excluding generic stop words)
    const stopWords = new Set(['and', '&', 'or', 'the', 'for', 'in', 'of', 'with', 'fix', 'repair', 'service']);
    const qTokens = q.split(/\s+/).filter((t) => t.length > 2 && !stopWords.has(t));

    let bestMatch: ServiceItem | undefined;
    let maxScore = 0;

    for (const s of services) {
      const n = s.name.toLowerCase();
      let score = 0;
      for (const t of qTokens) {
        if (n.includes(t)) score++;
      }
      if (score > maxScore) {
        maxScore = score;
        bestMatch = s;
      }
    }

    if (bestMatch && maxScore > 0) return bestMatch;

    // 4. Fallback: category match
    return services.find((s) => s.category.toLowerCase().includes(q));
  }

  // ── Bookings ─────────────────────────────────────────────────────────────
  public async createBooking(params: {
    customerName: string; phone: string; service: string;
    address: string; preferredTime: string; notes?: string; source?: string;
  }): Promise<Booking> {
    if (this.isMock) {
      const store = loadBookings();
      const bookingId = `OWF-${Math.floor(1000 + Math.random() * 9000)}`;
      const newBooking: Booking = {
        bookingId,
        customerName: params.customerName,
        phone: params.phone,
        service: params.service,
        address: params.address,
        preferredTime: params.preferredTime,
        notes: params.notes || '',
        status: 'pending',
        source: params.source || 'OneWayFix API',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      store.set(bookingId, newBooking);
      saveBookings(store);
      return newBooking;
    }

    const res = await fetch(`${this.apiUrl}/bookings`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });

    if (!res.ok) throw new Error(`OneWayFix API Error (${res.status}): ${await res.text()}`);
    return (await res.json()) as Booking;
  }

  public async getBookingStatus(bookingId: string): Promise<Booking> {
    if (this.isMock) {
      const store = loadBookings();
      const booking = store.get(bookingId);
      if (!booking) {
        throw new Error(`Booking '${bookingId}' not found. Please check your Booking ID.`);
      }
      return booking;
    }

    const res = await fetch(`${this.apiUrl}/bookings/${encodeURIComponent(bookingId)}`, {
      headers: this.getHeaders(),
    });

    if (!res.ok) throw new Error(`OneWayFix API Error (${res.status}): ${await res.text()}`);
    return (await res.json()) as Booking;
  }

  public async cancelBooking(bookingId: string, reason?: string): Promise<Booking> {
    if (this.isMock) {
      const store = loadBookings();
      const booking = store.get(bookingId);
      if (!booking) throw new Error(`Booking '${bookingId}' not found.`);

      if (booking.status === 'completed') {
        throw new Error(`Cannot cancel booking '${bookingId}' because it is already marked as completed.`);
      }

      booking.status = 'cancelled';
      booking.notes = reason ? `${booking.notes || ''} [Cancelled: ${reason}]`.trim() : booking.notes;
      booking.updatedAt = new Date().toISOString();

      store.set(bookingId, booking);
      saveBookings(store);
      return booking;
    }

    const res = await fetch(`${this.apiUrl}/bookings/${encodeURIComponent(bookingId)}/cancel`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ reason }),
    });

    if (!res.ok) throw new Error(`OneWayFix API Error (${res.status}): ${await res.text()}`);
    return (await res.json()) as Booking;
  }

  // ── Owner Portal Methods ──────────────────────────────────────────────────
  public async getAllBookingsForOwner(): Promise<Booking[]> {
    if (this.isMock) {
      const store = loadBookings();
      return Array.from(store.values()).sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
    }

    const res = await fetch(`${this.apiUrl}/owner/bookings`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error(`OneWayFix Owner API Error (${res.status}): ${await res.text()}`);
    return (await res.json()) as Booking[];
  }

  public async listAllBookings(): Promise<Booking[]> {
    return this.getAllBookingsForOwner();
  }

  public async updateBookingStatus(bookingId: string, status: 'confirmed' | 'completed' | 'cancelled'): Promise<Booking> {
    if (this.isMock) {
      const store = loadBookings();
      const booking = store.get(bookingId);
      if (!booking) throw new Error(`Booking '${bookingId}' not found.`);

      booking.status = status;
      booking.updatedAt = new Date().toISOString();

      store.set(bookingId, booking);
      saveBookings(store);
      return booking;
    }

    const res = await fetch(`${this.apiUrl}/owner/bookings/${encodeURIComponent(bookingId)}/status`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ status }),
    });

    if (!res.ok) throw new Error(`OneWayFix Owner API Error (${res.status}): ${await res.text()}`);
    return (await res.json()) as Booking;
  }

  public maskBooking(booking: Booking): Booking {
    return {
      ...booking,
      phone: maskPhone(booking.phone),
      address: maskAddress(booking.address),
    };
  }
}

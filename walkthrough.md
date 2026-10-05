# OneWayFix API Integration Walkthrough

We have successfully integrated the **OneWayFix API tools** into the ActionOS pnpm TypeScript monorepo with zero breaking changes.

## Key Changes Made

### 1. Types (`packages/types`)
- **[booking.ts](file:///d:/hachathon%202026/packages/types/src/booking.ts)**: Defined the `Booking` interface containing:
  - `bookingId: string`
  - `customerName: string`
  - `phone: string`
  - `service: string`
  - `address: string`
  - `preferredTime: string`
  - `notes?: string`
  - `status: 'pending' | 'confirmed' | 'completed' | 'cancelled'`
  - `source: string`
- **[risk.ts](file:///d:/hachathon%202026/packages/types/src/risk.ts)**: Expanded `RiskLevel` type to support `'MEDIUM'` risk classification alongside existing levels.

### 2. Validation (`packages/validation`)
- **[booking.ts](file:///d:/hachathon%202026/packages/validation/src/booking.ts)**: Created Zod validation schemas for all booking structures and tool inputs (`BookingSchema`, `CreateBookingInputSchema`, `GetBookingStatusInputSchema`, `CancelBookingInputSchema`, `ListServicesInputSchema`).
- **[tools.ts](file:///d:/hachathon%202026/packages/validation/src/tools.ts)**: Updated `RiskLevelSchema` to include `'MEDIUM'`.

### 3. OneWayFix Client & Tools (`packages/tools`)
- **[client.ts](file:///d:/hachathon%202026/packages/tools/src/onewayfix/client.ts)**: Built `OneWayFixClient` supporting environment variables (`ONEWAYFIX_API_URL`, `ONEWAYFIX_API_KEY` sent via Bearer token) and a full in-memory mock mode when `ONEWAYFIX_MOCK=true` or credentials are unset.
- **[audit.ts](file:///d:/hachathon%202026/packages/tools/src/onewayfix/audit.ts)**: Added `AuditLogger` to log structured `AuditEvent` records for all tool operations.
- **[tools.ts](file:///d:/hachathon%202026/packages/tools/src/onewayfix/tools.ts)**: Implemented 4 tools:
  1. `list_services`: `category: 'services'`, `riskLevel: 'READ'`
  2. `create_booking_request`: `category: 'booking'`, `riskLevel: 'MEDIUM'` (prompts user for confirmation unless `context.isConfirmed === true`)
  3. `get_booking_status`: `category: 'booking'`, `riskLevel: 'READ'`
  4. `cancel_booking`: `category: 'booking'`, `riskLevel: 'MEDIUM'` (prompts user for confirmation unless `context.isConfirmed === true`)

### 4. MCP Server Registration (`apps/mcp-server`)
- **[index.ts](file:///d:/hachathon%202026/apps/mcp-server/src/index.ts)**: Implemented a Streamable HTTP server listening at `/mcp` (default port `3001`).
  - `GET /mcp`: Returns available MCP tools (`tools/list`).
  - `POST /mcp`: Handles tool execution requests (`tools/call`) with session context and confirmation state.

---

## Verification Results

Executed `node test-onewayfix.mjs` verifying mock execution, medium risk confirmation guards, status tracking, cancellation, and audit logging:

```text
🧪 VERIFYING ONEWAYFIX TOOLS & RISK CONFIRMATION LOGIC
1️⃣ list_services: Fetched 4 available services (AC Repair, Plumbing, Electrical, Washing Machine)
2️⃣ create_booking_request UNCONFIRMED: Caught by MEDIUM risk guard -> returned requiresConfirmation: true
3️⃣ create_booking_request CONFIRMED: Created booking OWF-1397 (status: pending)
4️⃣ get_booking_status: Retrieved booking OWF-1397
5️⃣ cancel_booking UNCONFIRMED: Caught by MEDIUM risk guard -> returned requiresConfirmation: true
6️⃣ cancel_booking CONFIRMED: Cancelled booking OWF-1397 (status: cancelled)
📋 Audit Log Summary: Recorded 14 structured audit events
✅ ALL VERIFICATION CHECKS PASSED!
```

---

## How to Run and Test

### 1. Build the Monorepo
To compile all packages in workspace order:
```bash
npx pnpm run build
```
*(or `pnpm build` if `pnpm` is installed globally)*

### 2. Run the Verification Script (Mock Mode)
To test all 4 tools, medium-risk confirmation guards, and audit logs locally:
```bash
node test-onewayfix.mjs
```

### 3. Start the MCP Server
To launch the Streamable HTTP MCP Server:
```bash
# In mock mode (default if no API key is provided)
ONEWAYFIX_MOCK=true MCP_PORT=3001 npx pnpm --filter @actionos/mcp-server dev

# In live mode with real API endpoints
ONEWAYFIX_API_URL="https://api.onewayfix.com/v1" ONEWAYFIX_API_KEY="your-secret-key" MCP_PORT=3001 npx pnpm --filter @actionos/mcp-server dev
```

### 4. Test MCP HTTP Endpoint via Curl

**List available tools:**
```bash
curl -X GET http://localhost:3001/mcp
```

**Call `create_booking_request` via MCP (triggers risk confirmation request):**
```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tools/call",
    "params": {
      "name": "create_booking_request",
      "arguments": {
        "customerName": "Rahul Sharma",
        "phone": "+91 98765 43210",
        "service": "AC Repair & Service",
        "address": "123 MG Road, Bengaluru",
        "preferredTime": "2026-10-06 10:00 AM"
      },
      "isConfirmed": false
    }
  }'
```

**Execute `create_booking_request` after user confirmation:**
```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "2",
    "method": "tools/call",
    "params": {
      "name": "create_booking_request",
      "arguments": {
        "customerName": "Rahul Sharma",
        "phone": "+91 98765 43210",
        "service": "AC Repair & Service",
        "address": "123 MG Road, Bengaluru",
        "preferredTime": "2026-10-06 10:00 AM"
      },
      "isConfirmed": true
    }
  }'
```

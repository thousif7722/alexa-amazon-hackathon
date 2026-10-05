import { OneWayFixClient, createBookingRequestTool, cancelBookingTool } from '../packages/tools/dist/index.js';
import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('🧪 ActionOS OneWayFix Comprehensive Test Suite');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName, extraInfo = '') {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] Test ${totalTests}: ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] Test ${totalTests}: ${testName}`);
    if (extraInfo) console.error(`   Details: ${extraInfo}`);
  }
}

async function runTests() {
  const client = new OneWayFixClient();

  // Test 1: Service catalog loading (21 services)
  console.log('--- 1. Service Catalog Verification ---');
  const services = await client.listServices();
  assert(services.length === 21, 'Catalog loads 21 active OneWayFix services', `Found ${services.length} services`);

  const acService = services.find((s) => s.name === 'AC Repair & Deep Service');
  assert(!!acService, 'AC Repair & Deep Service exists in catalog');

  // Test 2: Service matching & validation
  console.log('\n--- 2. Service Matching & Validation ---');
  const matched = await client.matchService('ac repair');
  assert(matched?.name === 'AC Repair & Deep Service', 'Fuzzy match "ac repair" resolves to exact service name');

  const invalidMatch = await client.matchService('rocket propulsion maintenance');
  assert(invalidMatch === undefined, 'Invalid service query returns undefined');

  // Test 3: Security Guard - Unconfirmed booking returns confirmation requirement
  console.log('\n--- 3. Confirmation Guard Security Check ---');
  const toolResult = await createBookingRequestTool.execute({
    customerName: 'Test Customer',
    phone: '+91 99999 88888',
    service: 'Plumbing Leak Inspection & Repair',
    address: '456 Residency Road, Bengaluru',
    preferredTime: 'Tomorrow 2 PM',
    confirmed: true, // Attempt model bypass (must be ignored by security guard)
  }, { sessionId: 'test-session-1', userId: 'user-1' });

  assert(toolResult.requiresConfirmation === true, 'Security Guard strips model confirmed=true and forces confirmation card');
  assert(toolResult.pendingAction?.arguments?.service === 'Plumbing Leak Inspection & Repair', 'Pending action arguments captured accurately', JSON.stringify(toolResult.pendingAction?.arguments));

  // Test 4: Confirmed booking creation via UI context
  console.log('\n--- 4. Finalizing Booking with UI Context ---');
  const confirmedResult = await createBookingRequestTool.execute({
    customerName: 'Test Customer',
    phone: '+91 99999 88888',
    service: 'Plumbing Leak Inspection & Repair',
    address: '456 Residency Road, Bengaluru',
    preferredTime: 'Tomorrow 2 PM',
  }, { sessionId: 'test-session-1', userId: 'user-1', isConfirmed: true });

  assert(confirmedResult.success === true, 'Booking created successfully with isConfirmed=true in context');
  const createdBooking = confirmedResult.data?.booking;
  assert(!!createdBooking?.bookingId, `Booking ID generated: ${createdBooking?.bookingId}`);
  assert(createdBooking?.status === 'pending', 'Initial booking status is pending');

  // Test 5: Status lookup
  console.log('\n--- 5. Booking Status Lookup ---');
  const fetched = await client.getBookingStatus(createdBooking.bookingId);
  assert(fetched.customerName === 'Test Customer', 'Fetched booking details match created customer');

  // Test 6: Phone and address privacy masking
  console.log('\n--- 6. Phone & Address Privacy Masking ---');
  const masked = client.maskBooking(createdBooking);
  assert(masked.phone.includes('•••'), 'Phone number is properly masked for public output', `Masked: ${masked.phone}`);
  assert(masked.address.includes('•••'), 'Address is properly masked for public output', `Masked: ${masked.address}`);

  // Test 7: Owner Status Update (Pending -> Confirmed -> Completed)
  console.log('\n--- 7. Owner Portal Booking Workflow ---');
  const confirmedByOwner = await client.updateBookingStatus(createdBooking.bookingId, 'confirmed');
  assert(confirmedByOwner.status === 'confirmed', 'Owner successfully updated status to confirmed');

  const completedByOwner = await client.updateBookingStatus(createdBooking.bookingId, 'completed');
  assert(completedByOwner.status === 'completed', 'Owner successfully updated status to completed');

  // Test 8: Cancellation Rules Verification
  console.log('\n--- 8. Cancellation Rules Validation ---');
  let cancelErrorOccurred = false;
  try {
    await client.cancelBooking(createdBooking.bookingId, 'Changed mind');
  } catch (err) {
    cancelErrorOccurred = true;
  }
  assert(cancelErrorOccurred === true, 'Cannot cancel a booking that is already completed');

  // Test 9: File Persistence Verification
  console.log('\n--- 9. Data Persistence Verification ---');
  const dataDir = path.resolve(process.cwd(), 'data');
  const bookingsFile = path.join(dataDir, 'bookings.json');
  assert(fs.existsSync(bookingsFile), 'bookings.json file exists on disk in ./data');
  
  const diskData = JSON.parse(fs.readFileSync(bookingsFile, 'utf8'));
  assert(!!diskData[createdBooking.bookingId], 'Created booking is persisted to disk JSON file');

  console.log('\n================================================================');
  console.log(`📊 Test Summary: ${passedTests}/${totalTests} tests passed`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

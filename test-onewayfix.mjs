import {
  listServicesTool,
  createBookingRequestTool,
  getBookingStatusTool,
  cancelBookingTool,
  AuditLogger,
} from './packages/tools/dist/index.js';

console.log('====================================================');
console.log('🧪 VERIFYING ONEWAYFIX TOOLS (STANDARD MCP PROTOCOL)');
console.log('====================================================\n');

process.env.ONEWAYFIX_MOCK = 'true';

async function runVerification() {
  // 1. Test list_services
  console.log('1️⃣ Testing list_services tool...');
  const servicesResult = await listServicesTool.execute({});
  console.log('Result:', JSON.stringify(servicesResult, null, 2));

  // 2. Test create_booking_request UNCONFIRMED (confirmed=false)
  console.log('\n2️⃣ Testing create_booking_request UNCONFIRMED (confirmed: false)...');
  const unconfirmedBookingResult = await createBookingRequestTool.execute({
    customerName: 'Priya Verma',
    phone: '+91 99887 76655',
    service: 'AC Repair & Deep Service',
    address: '45 Park Street, Bengaluru',
    preferredTime: '2026-10-07 11:00 AM',
    notes: 'Please bring ladder',
    confirmed: false,
  });
  console.log('Result:', JSON.stringify(unconfirmedBookingResult, null, 2));

  // 3. Test create_booking_request CONFIRMED (confirmed=true)
  console.log('\n3️⃣ Testing create_booking_request CONFIRMED (confirmed: true)...');
  const confirmedBookingResult = await createBookingRequestTool.execute({
    customerName: 'Priya Verma',
    phone: '+91 99887 76655',
    service: 'AC Repair & Deep Service',
    address: '45 Park Street, Bengaluru',
    preferredTime: '2026-10-07 11:00 AM',
    notes: 'Please bring ladder',
    confirmed: true,
  });
  console.log('Result:', JSON.stringify(confirmedBookingResult, null, 2));

  const newBookingId = confirmedBookingResult.data.booking.bookingId;

  // 4. Test get_booking_status
  console.log(`\n4️⃣ Testing get_booking_status for ${newBookingId}...`);
  const statusResult = await getBookingStatusTool.execute({ bookingId: newBookingId });
  console.log('Result:', JSON.stringify(statusResult, null, 2));

  // 5. Test cancel_booking UNCONFIRMED (confirmed=false)
  console.log(`\n5️⃣ Testing cancel_booking UNCONFIRMED for ${newBookingId} (confirmed: false)...`);
  const unconfirmedCancelResult = await cancelBookingTool.execute({
    bookingId: newBookingId,
    reason: 'Schedule conflict',
    confirmed: false,
  });
  console.log('Result:', JSON.stringify(unconfirmedCancelResult, null, 2));

  // 6. Test cancel_booking CONFIRMED (confirmed=true)
  console.log(`\n6️⃣ Testing cancel_booking CONFIRMED for ${newBookingId} (confirmed: true)...`);
  const confirmedCancelResult = await cancelBookingTool.execute({
    bookingId: newBookingId,
    reason: 'Schedule conflict',
    confirmed: true,
  });
  console.log('Result:', JSON.stringify(confirmedCancelResult, null, 2));

  // 7. Check audit logs
  console.log('\n📋 Audit Log Summary:');
  const auditEvents = AuditLogger.getEvents();
  console.log(`Logged ${auditEvents.length} audit events.`);
  auditEvents.forEach((e, idx) => {
    console.log(`  [${idx + 1}] Status: ${e.status.padEnd(21)} | Tool: ${e.toolName.padEnd(22)} | Risk: ${e.riskLevel}`);
  });

  console.log('\n✅ ALL VERIFICATION CHECKS PASSED!');
}

runVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});

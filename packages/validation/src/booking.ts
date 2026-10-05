import { z } from 'zod';

export const OneWayFixBookingStatusSchema = z.enum(['pending', 'confirmed', 'completed', 'cancelled']);

export const BookingSchema = z.object({
  bookingId: z.string().min(1),
  customerName: z.string().min(1),
  phone: z.string().min(1),
  service: z.string().min(1),
  address: z.string().min(1),
  preferredTime: z.string().min(1),
  notes: z.string().optional(),
  status: OneWayFixBookingStatusSchema,
  source: z.string().min(1),
});

export const ListServicesInputSchema = z.object({
  category: z.string().optional(),
  query: z.string().optional(),
});

export const CreateBookingInputSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required'),
  phone: z.string().min(1, 'Phone number is required'),
  service: z.string().min(1, 'Service name is required'),
  address: z.string().min(1, 'Address is required'),
  preferredTime: z.string().min(1, 'Preferred time is required'),
  notes: z.string().optional(),
  source: z.string().optional().default('OneWayFix API'),
  confirmed: z.boolean().optional().default(false),
});

export const GetBookingStatusInputSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
});

export const CancelBookingInputSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  reason: z.string().optional(),
  confirmed: z.boolean().optional().default(false),
});


export type BookingZodType = z.infer<typeof BookingSchema>;
export type CreateBookingInput = z.infer<typeof CreateBookingInputSchema>;
export type GetBookingStatusInput = z.infer<typeof GetBookingStatusInputSchema>;
export type CancelBookingInput = z.infer<typeof CancelBookingInputSchema>;
export type ListServicesInput = z.infer<typeof ListServicesInputSchema>;

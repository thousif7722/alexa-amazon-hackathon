export type BookingItemType = 'hotel' | 'flight' | 'tour' | 'service';

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'FAILED';

export interface BookingDetails {
  id: string;
  itemType: BookingItemType;
  itemId: string;
  title: string;
  customerName: string;
  customerContact?: string;
  startDate: string;
  endDate?: string;
  amountINR: number;
  status: BookingStatus;
  confirmationCode?: string;
  createdAt: string;
  updatedAt: string;
}

export type OneWayFixBookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface Booking {
  bookingId: string;
  customerName: string;
  phone: string;
  service: string;
  address: string;
  preferredTime: string;
  notes?: string;
  status: OneWayFixBookingStatus;
  source: string;
  createdAt?: string;
  updatedAt?: string;
}


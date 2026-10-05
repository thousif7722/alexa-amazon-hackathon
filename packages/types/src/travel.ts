import { LocationPoint, RouteData } from './location.js';

export interface Destination {
  id: string;
  name: string;
  country: string;
  region: string;
  description: string;
  popularFor: string[];
  imageUrl?: string;
  bestTimeToVisit?: string;
}

export interface Attraction {
  id: string;
  name: string;
  destinationId: string;
  category: string;
  description: string;
  rating: number;
  estimatedHours: number;
  entryFeeINR?: number;
}

export interface Hotel {
  id: string;
  name: string;
  destinationId: string;
  destinationName: string;
  rating: number;
  pricePerNightINR: number;
  amenities: string[];
  address: string;
  availableRooms: number;
}

export interface Flight {
  id: string;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  priceINR: number;
  availableSeats: number;
}

export interface DayItinerary {
  dayNumber: number;
  title: string;
  location: string;
  activities: Array<{
    time: string;
    title: string;
    description: string;
    attractionId?: string;
  }>;
  hotelRecommendation?: Hotel;
  routeSummary?: RouteData;
}

export interface TripItinerary {
  id: string;
  title: string;
  destination: string;
  durationDays: number;
  days: DayItinerary[];
  totalEstimatedCostINR: number;
  createdAt: string;
}

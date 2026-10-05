export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationPoint {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  coordinates?: Coordinates;
}

export interface RouteStep {
  instruction: string;
  distanceKm: number;
  durationMinutes: number;
}

export interface RouteData {
  origin: LocationPoint;
  destination: LocationPoint;
  distanceKm: number;
  durationMinutes: number;
  steps: RouteStep[];
  mode: 'driving' | 'transit' | 'walking' | 'flight';
}

export interface MapData {
  center: Coordinates;
  zoom: number;
  markers: Array<{
    id: string;
    title: string;
    coordinates: Coordinates;
    type: 'origin' | 'destination' | 'attraction' | 'hotel' | 'service';
  }>;
  routePolyline?: string;
}

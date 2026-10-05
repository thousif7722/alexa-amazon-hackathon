export type ServiceCategory = 'AC Repair' | 'Plumbing' | 'Cleaning' | 'Electrical' | 'Appliance Repair';

export interface ServiceDiagnosis {
  issueDescription: string;
  category: ServiceCategory;
  possibleCauses: string[];
  recommendedAction: string;
  estimatedCostINR: { min: number; max: number };
  urgency: 'low' | 'medium' | 'high';
}

export interface ServiceProvider {
  id: string;
  name: string;
  category: ServiceCategory;
  rating: number;
  completedJobs: number;
  contactPhone: string;
  visitingFeeINR: number;
  availableSlots: string[];
}

export interface ServiceBooking {
  id: string;
  providerId: string;
  providerName: string;
  category: ServiceCategory;
  issueDescription: string;
  slot: string;
  address: string;
  status: 'PENDING' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  estimatedCostINR: number;
  createdAt: string;
}

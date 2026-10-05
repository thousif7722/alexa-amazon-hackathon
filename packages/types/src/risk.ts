export type RiskLevel = 'READ' | 'WRITE' | 'SENSITIVE' | 'LOW' | 'MEDIUM' | 'HIGH';


export type ConfirmationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface PendingAction {
  id: string;
  sessionId: string;
  toolName: string;
  riskLevel: RiskLevel;
  arguments: Record<string, unknown>;
  description: string;
  createdAt: string;
  expiresAt: string;
  status: ConfirmationStatus;
}

export interface RiskAssessment {
  toolName: string;
  riskLevel: RiskLevel;
  requiresConfirmation: boolean;
  requiresAuthorization: boolean;
  reason: string;
}

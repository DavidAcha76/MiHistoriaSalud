export type User = { id: string; email: string; fullName: string };
export type HealthProfile = {
  id: string;
  displayName?: string;
  display_name?: string;
  birthDate?: string | null;
  birth_date?: string | null;
  relationship: 'SELF' | 'CHILD' | 'PARENT' | 'OTHER';
  notes?: string | null;
};
export type EventType = 'ANTECEDENT' | 'CONSULTATION' | 'DIAGNOSIS' | 'TREATMENT' | 'MEDICATION' | 'ALLERGY' | 'VACCINE' | 'SURGERY' | 'LAB_RESULT' | 'OTHER';
export type HealthEvent = {
  id: string;
  profileId?: string;
  profile_id?: string;
  eventType?: EventType;
  event_type?: EventType;
  title: string;
  description?: string | null;
  eventDate?: string;
  event_date?: string;
  source?: string | null;
  notes?: string | null;
  details?: Record<string, unknown> | null;
  documents?: ClinicalDocument[];
};
export type ClinicalDocument = {
  id: string;
  eventId?: string | null;
  originalName?: string;
  original_name?: string;
  mimeType?: string;
  mime_type?: string;
  sizeBytes?: number;
  size_bytes?: number;
  createdAt?: string;
  created_at?: string;
};
export type PagedEvents = { items: HealthEvent[]; page: number; pageSize: number; total: number; totalPages: number };
export type AiResult = {
  id: string;
  provider: string;
  model: string;
  summary: string;
  incompleteData: string[];
  contradictions: string[];
  questions: string[];
  disclaimer: string;
};

export type RaceStatus = 'coming_soon' | 'open' | 'paused' | 'closed';
export type RegStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled';

export interface EventRow {
  id: string;
  slug: string;
  code_prefix: string;
  name: string;
  tagline: string | null;
  description: string | null;
  event_date: string | null;
  venue: string | null;
  start_point: string | null;
  reporting_time: string | null;
  bib_collection: string | null;
  hydration: string | null;
  medical: string | null;
  guidelines: string | null;
  parking: string | null;
  baggage: string | null;
  race_kit: string | null;
  awards: string | null;
  registration_closes_at: string | null;
  published: boolean;
}

export interface RaceRow {
  id: string;
  event_id: string;
  code: string;
  name: string;
  positioning: string | null;
  audience: string | null;
  distance_label: string | null;
  is_kids: boolean;
  fee_paise: number | null;
  capacity: number | null;
  status: RaceStatus;
  flag_off: string | null;
  cut_off: string | null;
  min_age: number | null;
  max_age: number | null;
  route_map_url: string | null;
  elevation: string | null;
  start_finish: string | null;
  sort: number;
}

export interface FaqRow {
  id: string;
  question: string;
  answer: string;
  sort: number;
  published: boolean;
}

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string | null;
  published: boolean;
  created_at: string;
}

export interface SponsorRow {
  id: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  tier: string;
  sort: number;
  published: boolean;
}

export interface RegistrationRow {
  id: string;
  reg_code: string | null;
  event_id: string;
  race_id: string;
  status: RegStatus;
  full_name: string;
  dob: string;
  gender: string;
  email: string;
  mobile: string;
  city: string;
  tshirt_size: string;
  running_club: string | null;
  emergency_name: string;
  emergency_mobile: string;
  medical_info: string | null;
  medical_consent: boolean;
  guardian_name: string | null;
  guardian_relation: string | null;
  accepted_terms: boolean;
  accepted_waiver: boolean;
  accepted_privacy: boolean;
  guardian_consent: boolean;
  photo_consent: boolean;
  whatsapp_opt_in: boolean;
  amount_paise: number;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  payment_method: string | null;
  failure_reason: string | null;
  paid_at: string | null;
  confirmation_sent_at: string | null;
  admin_notes: string | null;
  created_at: string;
}

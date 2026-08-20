export type Listing = {
  id: string;
  name: string;
  tagline: string;
  url: string;
  logo_url: string | null;
  bid_cents: number;
  clicks: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

// Generated from the Supabase schema (generate_typescript_types), trimmed to
// the Database type plus row aliases. Regenerate after schema changes.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Enums = {
  inv_event_type: "private" | "business";
  inv_invitee_status: "pending" | "sent" | "opened" | "confirmed" | "declined";
  inv_message_channel: "email" | "whatsapp";
  inv_message_kind: "invitation" | "reminder" | "nudge" | "test";
  inv_message_status: "sent" | "failed";
  inv_registration_source: "invite_link" | "public_link" | "manual";
};

type EventRowT = {
  address: string | null;
  allow_public_link: boolean;
  created_at: string;
  created_by: string | null;
  date_time: string;
  description: string | null;
  event_type: Enums["inv_event_type"];
  gift_link_url: string | null;
  id: string;
  invitation_message: string | null;
  is_active: boolean;
  lat: number | null;
  lng: number | null;
  max_guests: number | null;
  media_url: string | null;
  primary_color: string | null;
  reminder_offset_hours: number;
  reminder_sent_at: string | null;
  rsvp_deadline: string | null;
  slug: string;
  template_id: string;
  title: string;
  updated_at: string;
  venue_name: string | null;
};

type InviteeRowT = {
  created_at: string;
  email: string | null;
  event_id: string;
  expected_guests: number;
  first_sent_at: string | null;
  full_name: string;
  group_name: string | null;
  id: string;
  last_sent_at: string | null;
  opened_at: string | null;
  phone: string | null;
  responded_at: string | null;
  status: Enums["inv_invitee_status"];
  token: string;
  updated_at: string;
};

type RegistrationRowT = {
  attending: boolean;
  created_at: string;
  email: string | null;
  event_id: string;
  full_name: string;
  guest_count: number;
  guest_names: Json;
  id: string;
  invitee_id: string | null;
  notes: string | null;
  phone: string;
  source: Enums["inv_registration_source"];
  updated_at: string;
};

type MessageLogRowT = {
  channel: Enums["inv_message_channel"];
  created_at: string;
  created_by: string | null;
  error: string | null;
  event_id: string;
  id: string;
  invitee_id: string | null;
  kind: Enums["inv_message_kind"];
  registration_id: string | null;
  status: Enums["inv_message_status"];
  to_address: string;
};

type StaffRowT = {
  created_at: string;
  display_name: string | null;
  email: string;
  user_id: string;
};

// Columns with a database default are optional on insert.
type InsertOf<Row, Required extends keyof Row> = Partial<Row> & Pick<Row, Required>;

type Rel = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      inv_events: {
        Row: EventRowT;
        Insert: InsertOf<EventRowT, "date_time" | "slug" | "title">;
        Update: Partial<EventRowT>;
        Relationships: [];
      };
      inv_invitees: {
        Row: InviteeRowT;
        Insert: InsertOf<InviteeRowT, "event_id" | "full_name">;
        Update: Partial<InviteeRowT>;
        Relationships: [
          { foreignKeyName: "inv_invitees_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "inv_events"; referencedColumns: ["id"] },
        ];
      };
      inv_registrations: {
        Row: RegistrationRowT;
        Insert: InsertOf<RegistrationRowT, "event_id" | "full_name" | "phone">;
        Update: Partial<RegistrationRowT>;
        Relationships: [
          { foreignKeyName: "inv_registrations_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "inv_events"; referencedColumns: ["id"] },
          { foreignKeyName: "inv_registrations_invitee_id_fkey"; columns: ["invitee_id"]; isOneToOne: false; referencedRelation: "inv_invitees"; referencedColumns: ["id"] },
        ];
      };
      inv_message_log: {
        Row: MessageLogRowT;
        Insert: InsertOf<MessageLogRowT, "channel" | "event_id" | "kind" | "status" | "to_address">;
        Update: Partial<MessageLogRowT>;
        Relationships: Rel[];
      };
      inv_staff: {
        Row: StaffRowT;
        Insert: InsertOf<StaffRowT, "email" | "user_id">;
        Update: Partial<StaffRowT>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      inv_add_staff: { Args: { p_display_name?: string; p_email: string }; Returns: string };
      inv_is_staff: { Args: never; Returns: boolean };
      inv_public_event: { Args: { p_slug: string }; Returns: Json };
      inv_invite: { Args: { p_token: string }; Returns: Json };
      inv_mark_invite_opened: { Args: { p_token: string }; Returns: undefined };
      inv_register: {
        Args: {
          p_slug: string | null;
          p_token: string | null;
          p_full_name: string;
          p_phone: string;
          p_email: string | null;
          p_attending: boolean;
          p_guest_count: number;
          p_guest_names: Json;
          p_notes: string | null;
        };
        Returns: Json;
      };
    };
    Enums: Enums;
    CompositeTypes: { [_ in never]: never };
  };
};

export type EventRow = EventRowT;
export type EventType = Enums["inv_event_type"];
export type EventInsert = Database["public"]["Tables"]["inv_events"]["Insert"];
export type InviteeRow = InviteeRowT;
export type InviteeInsert = Database["public"]["Tables"]["inv_invitees"]["Insert"];
export type InviteeStatus = Enums["inv_invitee_status"];
export type RegistrationRow = RegistrationRowT;
export type MessageLogRow = MessageLogRowT;

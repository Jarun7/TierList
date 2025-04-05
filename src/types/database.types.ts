export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[]

export interface Database {
  public: {
    Tables: {
      // Templates Table
      templates: {
        Row: {
          id: string
          name: string
          created_at: string
          is_public?: boolean // Flag for public browsing
          // Consider adding user_id if templates are user-specific
          // user_id?: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          is_public?: boolean
          // user_id?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          is_public?: boolean
          // user_id?: string
        }
      }

      // Items Table
      items: {
        Row: {
          id: string
          template_id: string // Foreign key to templates table
          content: string // e.g., image URL or text
          created_at: string
        }
        Insert: {
          id?: string
          template_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          template_id?: string
          content?: string
          created_at?: string
        }
      }

      // Tier Lists Table (Saved Arrangements)
      tier_lists: {
        Row: {
          id: string // UUID
          user_id: string // Foreign key to auth.users
          template_id: string // Foreign key to templates
          name: string | null // Optional user-given name
          // JSON object storing the arrangement, e.g., { "tier-s": ["item-1"], "tier-a": ["item-3"] }
          data: Json
          is_public?: boolean // Flag for public browsing
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          template_id: string
          name?: string | null
          data: Json
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          // user_id?: string // Should not change owner
          // template_id?: string // Should not change template
          name?: string | null
          data?: Json
          is_public?: boolean
          updated_at?: string // Should likely auto-update
        }
      }
    } // End Tables
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
  } // End public
} // End Database
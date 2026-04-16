// AUTO-GENERATED from supabase/migrations — do not edit manually.
// Regenerate: pnpm gen:types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      campaigns: {
        Row: {
          id: string
          name: string
          system: string | null
          description: string | null
          cover_image_url: string | null
          status: 'Active' | 'Hiatus' | 'Complete'
          dm_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          system?: string | null
          description?: string | null
          cover_image_url?: string | null
          status?: 'Active' | 'Hiatus' | 'Complete'
          dm_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          system?: string | null
          description?: string | null
          cover_image_url?: string | null
          status?: 'Active' | 'Hiatus' | 'Complete'
          dm_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      campaign_members: {
        Row: {
          campaign_id: string
          user_id: string
          role: 'dm' | 'player'
          joined_at: string
        }
        Insert: {
          campaign_id: string
          user_id: string
          role: 'dm' | 'player'
          joined_at?: string
        }
        Update: {
          campaign_id?: string
          user_id?: string
          role?: 'dm' | 'player'
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          }
        ]
      }
      sessions: {
        Row: {
          id: string
          campaign_id: string
          session_number: number
          title: string | null
          date_played: string | null
          summary: string | null
          highlights: string[] | null
          xp_awarded: number | null
          visibility: 'private' | 'public' | 'revealed'
          revealed_to: string[] | null
          dm_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          session_number?: number
          title?: string | null
          date_played?: string | null
          summary?: string | null
          highlights?: string[] | null
          xp_awarded?: number | null
          visibility?: 'private' | 'public' | 'revealed'
          revealed_to?: string[] | null
          dm_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          session_number?: number
          title?: string | null
          date_played?: string | null
          summary?: string | null
          highlights?: string[] | null
          xp_awarded?: number | null
          visibility?: 'private' | 'public' | 'revealed'
          revealed_to?: string[] | null
          dm_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          }
        ]
      }
      characters: {
        Row: {
          id: string
          campaign_id: string
          name: string
          player_name: string | null
          race_species: string | null
          class: string | null
          level_tier: number | null
          backstory: string | null
          appearance: string | null
          personality: string | null
          goals_bonds: string | null
          character_sheet_url: string | null
          journal: string | null
          visibility: 'private' | 'public' | 'revealed'
          revealed_to: string[] | null
          dm_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          name: string
          player_name?: string | null
          race_species?: string | null
          class?: string | null
          level_tier?: number | null
          backstory?: string | null
          appearance?: string | null
          personality?: string | null
          goals_bonds?: string | null
          character_sheet_url?: string | null
          journal?: string | null
          visibility?: 'private' | 'public' | 'revealed'
          revealed_to?: string[] | null
          dm_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          name?: string
          player_name?: string | null
          race_species?: string | null
          class?: string | null
          level_tier?: number | null
          backstory?: string | null
          appearance?: string | null
          personality?: string | null
          goals_bonds?: string | null
          character_sheet_url?: string | null
          journal?: string | null
          visibility?: 'private' | 'public' | 'revealed'
          revealed_to?: string[] | null
          dm_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "characters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          }
        ]
      }
      factions: {
        Row: {
          id: string
          campaign_id: string
          name: string
          description: string | null
          goals: string | null
          alignment_tone: string | null
          visibility: 'private' | 'public' | 'revealed'
          revealed_to: string[] | null
          dm_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          name: string
          description?: string | null
          goals?: string | null
          alignment_tone?: string | null
          visibility?: 'private' | 'public' | 'revealed'
          revealed_to?: string[] | null
          dm_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          name?: string
          description?: string | null
          goals?: string | null
          alignment_tone?: string | null
          visibility?: 'private' | 'public' | 'revealed'
          revealed_to?: string[] | null
          dm_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "factions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          }
        ]
      }
      npcs: {
        Row: {
          id: string
          campaign_id: string
          name: string
          role_title: string | null
          alignment: string | null
          appearance: string | null
          personality: string | null
          relationships: string | null
          status: 'alive' | 'dead' | 'unknown'
          first_appeared_session_id: string | null
          faction_id: string | null
          visibility: 'private' | 'public' | 'revealed'
          revealed_to: string[] | null
          dm_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          name: string
          role_title?: string | null
          alignment?: string | null
          appearance?: string | null
          personality?: string | null
          relationships?: string | null
          status?: 'alive' | 'dead' | 'unknown'
          first_appeared_session_id?: string | null
          faction_id?: string | null
          visibility?: 'private' | 'public' | 'revealed'
          revealed_to?: string[] | null
          dm_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          name?: string
          role_title?: string | null
          alignment?: string | null
          appearance?: string | null
          personality?: string | null
          relationships?: string | null
          status?: 'alive' | 'dead' | 'unknown'
          first_appeared_session_id?: string | null
          faction_id?: string | null
          visibility?: 'private' | 'public' | 'revealed'
          revealed_to?: string[] | null
          dm_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "npcs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "npcs_first_appeared_session_id_fkey"
            columns: ["first_appeared_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "npcs_faction_id_fkey"
            columns: ["faction_id"]
            isOneToOne: false
            referencedRelation: "factions"
            referencedColumns: ["id"]
          }
        ]
      }
      locations: {
        Row: {
          id: string
          campaign_id: string
          name: string
          type: string | null
          description: string | null
          history: string | null
          map_image_url: string | null
          parent_location_id: string | null
          visibility: 'private' | 'public' | 'revealed'
          revealed_to: string[] | null
          dm_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          name: string
          type?: string | null
          description?: string | null
          history?: string | null
          map_image_url?: string | null
          parent_location_id?: string | null
          visibility?: 'private' | 'public' | 'revealed'
          revealed_to?: string[] | null
          dm_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          name?: string
          type?: string | null
          description?: string | null
          history?: string | null
          map_image_url?: string | null
          parent_location_id?: string | null
          visibility?: 'private' | 'public' | 'revealed'
          revealed_to?: string[] | null
          dm_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_parent_location_id_fkey"
            columns: ["parent_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          }
        ]
      }
      lore: {
        Row: {
          id: string
          campaign_id: string
          title: string
          category: 'history' | 'magic' | 'religion' | 'politics' | 'other'
          content: string | null
          visibility: 'private' | 'public' | 'revealed'
          revealed_to: string[] | null
          dm_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          title: string
          category: 'history' | 'magic' | 'religion' | 'politics' | 'other'
          content?: string | null
          visibility?: 'private' | 'public' | 'revealed'
          revealed_to?: string[] | null
          dm_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          title?: string
          category?: 'history' | 'magic' | 'religion' | 'politics' | 'other'
          content?: string | null
          visibility?: 'private' | 'public' | 'revealed'
          revealed_to?: string[] | null
          dm_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lore_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          }
        ]
      }
      session_npcs: {
        Row: {
          session_id: string
          npc_id: string
        }
        Insert: {
          session_id: string
          npc_id: string
        }
        Update: {
          session_id?: string
          npc_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_npcs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_npcs_npc_id_fkey"
            columns: ["npc_id"]
            isOneToOne: false
            referencedRelation: "npcs"
            referencedColumns: ["id"]
          }
        ]
      }
      session_locations: {
        Row: {
          session_id: string
          location_id: string
        }
        Insert: {
          session_id: string
          location_id: string
        }
        Update: {
          session_id?: string
          location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_locations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          }
        ]
      }
      faction_members: {
        Row: {
          faction_id: string
          npc_id: string
          role: string | null
        }
        Insert: {
          faction_id: string
          npc_id: string
          role?: string | null
        }
        Update: {
          faction_id?: string
          npc_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "faction_members_faction_id_fkey"
            columns: ["faction_id"]
            isOneToOne: false
            referencedRelation: "factions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faction_members_npc_id_fkey"
            columns: ["npc_id"]
            isOneToOne: false
            referencedRelation: "npcs"
            referencedColumns: ["id"]
          }
        ]
      }
      faction_relationships: {
        Row: {
          faction_id: string
          related_faction_id: string
          relationship_type: string
          dm_notes: string | null
        }
        Insert: {
          faction_id: string
          related_faction_id: string
          relationship_type: string
          dm_notes?: string | null
        }
        Update: {
          faction_id?: string
          related_faction_id?: string
          relationship_type?: string
          dm_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "faction_relationships_faction_id_fkey"
            columns: ["faction_id"]
            isOneToOne: false
            referencedRelation: "factions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faction_relationships_related_faction_id_fkey"
            columns: ["related_faction_id"]
            isOneToOne: false
            referencedRelation: "factions"
            referencedColumns: ["id"]
          }
        ]
      }
      lore_references: {
        Row: {
          lore_id: string
          entity_type: 'campaign' | 'session' | 'character' | 'npc' | 'location' | 'faction'
          entity_id: string
        }
        Insert: {
          lore_id: string
          entity_type: 'campaign' | 'session' | 'character' | 'npc' | 'location' | 'faction'
          entity_id: string
        }
        Update: {
          lore_id?: string
          entity_type?: 'campaign' | 'session' | 'character' | 'npc' | 'location' | 'faction'
          entity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lore_references_lore_id_fkey"
            columns: ["lore_id"]
            isOneToOne: false
            referencedRelation: "lore"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          id: string
          email: string
          display_name: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          display_name?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

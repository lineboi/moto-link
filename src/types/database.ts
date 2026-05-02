export type Language = 'rw' | 'en'

export type SessionStatus = 'CONFIRMED' | 'REJECTED' | 'ABANDONED' | 'PIVOTED'

export type QaErrorType = 'SYSTEM_MISCLASSIFICATION' | 'USER_MISPRONUNCIATION'

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      vernacular_landmarks: {
        Row: {
          id: string
          raw_phrase: string
          language: Language
          target_lat: number
          target_lng: number
          confidence_score: number
          successful_routes: number
          is_qa_flagged: boolean
          created_at: string
          last_updated: string
        }
        Insert: {
          id?: string
          raw_phrase: string
          language: Language
          target_lat: number
          target_lng: number
          confidence_score?: number
          successful_routes?: number
          is_qa_flagged?: boolean
          created_at?: string
          last_updated?: string
        }
        Update: {
          id?: string
          raw_phrase?: string
          language?: Language
          target_lat?: number
          target_lng?: number
          confidence_score?: number
          successful_routes?: number
          is_qa_flagged?: boolean
          created_at?: string
          last_updated?: string
        }
        Relationships: []
      }
      navigation_sessions: {
        Row: {
          id: string
          landmark_id: string | null
          driver_id: string | null
          start_lat: number | null
          start_lng: number | null
          actual_arrival_lat: number | null
          actual_arrival_lng: number | null
          status: SessionStatus
          search_attempts: number
          completed_at: string
        }
        Insert: {
          id?: string
          landmark_id?: string | null
          driver_id?: string | null
          start_lat?: number | null
          start_lng?: number | null
          actual_arrival_lat?: number | null
          actual_arrival_lng?: number | null
          status: SessionStatus
          search_attempts?: number
          completed_at?: string
        }
        Update: {
          id?: string
          landmark_id?: string | null
          driver_id?: string | null
          start_lat?: number | null
          start_lng?: number | null
          actual_arrival_lat?: number | null
          actual_arrival_lng?: number | null
          status?: SessionStatus
          search_attempts?: number
          completed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'navigation_sessions_landmark_id_fkey'
            columns: ['landmark_id']
            referencedRelation: 'vernacular_landmarks'
            referencedColumns: ['id']
          },
        ]
      }
      qa_flag_logs: {
        Row: {
          id: string
          session_id: string | null
          landmark_id: string | null
          error_type: QaErrorType | null
          user_audio_transcript: string | null
          resolved: boolean
          logged_at: string
        }
        Insert: {
          id?: string
          session_id?: string | null
          landmark_id?: string | null
          error_type?: QaErrorType | null
          user_audio_transcript?: string | null
          resolved?: boolean
          logged_at?: string
        }
        Update: {
          id?: string
          session_id?: string | null
          landmark_id?: string | null
          error_type?: QaErrorType | null
          user_audio_transcript?: string | null
          resolved?: boolean
          logged_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'qa_flag_logs_session_id_fkey'
            columns: ['session_id']
            referencedRelation: 'navigation_sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'qa_flag_logs_landmark_id_fkey'
            columns: ['landmark_id']
            referencedRelation: 'vernacular_landmarks'
            referencedColumns: ['id']
          },
        ]
      }
      reinforcement_dataset: {
        Row: {
          id: string
          raw_transcript: string
          extracted_landmark: string | null
          target_lat: number | null
          target_lng: number | null
          is_accurate: boolean
          created_at: string
        }
        Insert: {
          id?: string
          raw_transcript: string
          extracted_landmark?: string | null
          target_lat?: number | null
          target_lng?: number | null
          is_accurate: boolean
          created_at?: string
        }
        Update: {
          id?: string
          raw_transcript?: string
          extracted_landmark?: string | null
          target_lat?: number | null
          target_lng?: number | null
          is_accurate?: boolean
          created_at?: string
        }
        Relationships: []
      }
      known_osm_landmarks: {
        Row: {
          id: string
          formal_name: string | null
          road_sign: string | null
          lat: number | null
          lng: number | null
        }
        Insert: {
          id?: string
          formal_name?: string | null
          road_sign?: string | null
          lat?: number | null
          lng?: number | null
        }
        Update: {
          id?: string
          formal_name?: string | null
          road_sign?: string | null
          lat?: number | null
          lng?: number | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      update_landmark_confidence: {
        Args: Record<string, never>
        Returns: unknown
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type TableInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert']
export type TableUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update']

export type VernacularLandmark = Tables<'vernacular_landmarks'>
export type VernacularLandmarkInsert = TableInsert<'vernacular_landmarks'>
export type VernacularLandmarkUpdate = TableUpdate<'vernacular_landmarks'>

export type NavigationSession = Tables<'navigation_sessions'>
export type NavigationSessionInsert = TableInsert<'navigation_sessions'>
export type NavigationSessionUpdate = TableUpdate<'navigation_sessions'>

export type QaFlagLog = Tables<'qa_flag_logs'>
export type QaFlagLogInsert = TableInsert<'qa_flag_logs'>
export type QaFlagLogUpdate = TableUpdate<'qa_flag_logs'>

export type ReinforcementDatum = Tables<'reinforcement_dataset'>
export type ReinforcementDatumInsert = TableInsert<'reinforcement_dataset'>

export type KnownOsmLandmark = Tables<'known_osm_landmarks'>
export type KnownOsmLandmarkInsert = TableInsert<'known_osm_landmarks'>

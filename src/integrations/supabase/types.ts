export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      budget_simulations: {
        Row: {
          created_at: string
          created_by: string | null
          fixed_cost_total: number
          hours: number
          id: string
          name: string
          professionals: Json
          profit_pct: number
          suggested_price: number
          tax_pct: number
          total_cost: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fixed_cost_total?: number
          hours?: number
          id?: string
          name: string
          professionals?: Json
          profit_pct?: number
          suggested_price?: number
          tax_pct?: number
          total_cost?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fixed_cost_total?: number
          hours?: number
          id?: string
          name?: string
          professionals?: Json
          profit_pct?: number
          suggested_price?: number
          tax_pct?: number
          total_cost?: number
        }
        Relationships: []
      }
      clients: {
        Row: {
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dashboard_widgets: {
        Row: {
          config: Json
          created_at: string
          id: string
          position: number
          size: string
          updated_at: string
          user_id: string
          widget_key: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          position?: number
          size?: string
          updated_at?: string
          user_id: string
          widget_key: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          position?: number
          size?: string
          updated_at?: string
          user_id?: string
          widget_key?: string
        }
        Relationships: []
      }
      equipments: {
        Row: {
          acquisition_date: string
          acquisition_value: number
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          depreciation_pct_year: number
          id: string
          name: string
          notes: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          acquisition_date?: string
          acquisition_value?: number
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          depreciation_pct_year?: number
          id?: string
          name: string
          notes?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          acquisition_date?: string
          acquisition_value?: number
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          depreciation_pct_year?: number
          id?: string
          name?: string
          notes?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      financial_entries: {
        Row: {
          amount: number
          category: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string
          entry_date: string
          id: string
          kind: string
          project_id: string | null
          receipt_path: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          entry_date?: string
          id?: string
          kind: string
          project_id?: string | null
          receipt_path?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          entry_date?: string
          id?: string
          kind?: string
          project_id?: string | null
          receipt_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_settings: {
        Row: {
          currency: string
          default_commission_pct: number
          id: boolean
          tax_pct: number
          updated_at: string
        }
        Insert: {
          currency?: string
          default_commission_pct?: number
          id?: boolean
          tax_pct?: number
          updated_at?: string
        }
        Update: {
          currency?: string
          default_commission_pct?: number
          id?: boolean
          tax_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      fixed_costs: {
        Row: {
          active: boolean
          amount: number
          category: string | null
          created_at: string
          due_day: number | null
          id: string
          name: string
          notes: string | null
          recurrence: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount?: number
          category?: string | null
          created_at?: string
          due_day?: number | null
          id?: string
          name: string
          notes?: string | null
          recurrence?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          category?: string | null
          created_at?: string
          due_day?: number | null
          id?: string
          name?: string
          notes?: string | null
          recurrence?: string
          updated_at?: string
        }
        Relationships: []
      }
      media_types: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      priorities: {
        Row: {
          color: string
          created_at: string
          id: string
          level: number
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          level?: number
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          level?: number
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          commission_pct: number
          created_at: string
          full_name: string
          hourly_cost: number
          id: string
          job_title: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          commission_pct?: number
          created_at?: string
          full_name?: string
          hourly_cost?: number
          id: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          commission_pct?: number
          created_at?: string
          full_name?: string
          hourly_cost?: number
          id?: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_assignees: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assignees_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignees_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "project_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          project_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          project_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          project_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      project_transitions: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status_id: string | null
          id: string
          project_id: string
          reason: string | null
          to_status_id: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status_id?: string | null
          id?: string
          project_id: string
          reason?: string | null
          to_status_id?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status_id?: string | null
          id?: string
          project_id?: string
          reason?: string | null
          to_status_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_transitions_from_status_id_fkey"
            columns: ["from_status_id"]
            isOneToOne: false
            referencedRelation: "workflow_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_transitions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_transitions_to_status_id_fkey"
            columns: ["to_status_id"]
            isOneToOne: false
            referencedRelation: "workflow_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          assigned_to: string | null
          budget: number | null
          client_decided_at: string | null
          client_decision: string | null
          client_feedback: string | null
          client_id: string | null
          client_name: string | null
          client_token: string | null
          created_at: string
          created_by: string | null
          deliverable_path: string | null
          description: string | null
          due_date: string | null
          has_reference: boolean
          id: string
          media_type: Database["public"]["Enums"]["media_type"] | null
          media_type_id: string | null
          notes: string | null
          post_date: string | null
          priority: Database["public"]["Enums"]["project_priority"]
          priority_id: string | null
          reference_links: string[]
          service_type: Database["public"]["Enums"]["service_type"] | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          status_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          budget?: number | null
          client_decided_at?: string | null
          client_decision?: string | null
          client_feedback?: string | null
          client_id?: string | null
          client_name?: string | null
          client_token?: string | null
          created_at?: string
          created_by?: string | null
          deliverable_path?: string | null
          description?: string | null
          due_date?: string | null
          has_reference?: boolean
          id?: string
          media_type?: Database["public"]["Enums"]["media_type"] | null
          media_type_id?: string | null
          notes?: string | null
          post_date?: string | null
          priority?: Database["public"]["Enums"]["project_priority"]
          priority_id?: string | null
          reference_links?: string[]
          service_type?: Database["public"]["Enums"]["service_type"] | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          status_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          budget?: number | null
          client_decided_at?: string | null
          client_decision?: string | null
          client_feedback?: string | null
          client_id?: string | null
          client_name?: string | null
          client_token?: string | null
          created_at?: string
          created_by?: string | null
          deliverable_path?: string | null
          description?: string | null
          due_date?: string | null
          has_reference?: boolean
          id?: string
          media_type?: Database["public"]["Enums"]["media_type"] | null
          media_type_id?: string | null
          notes?: string | null
          post_date?: string | null
          priority?: Database["public"]["Enums"]["project_priority"]
          priority_id?: string | null
          reference_links?: string[]
          service_type?: Database["public"]["Enums"]["service_type"] | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          status_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_media_type_id_fkey"
            columns: ["media_type_id"]
            isOneToOne: false
            referencedRelation: "media_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_priority_id_fkey"
            columns: ["priority_id"]
            isOneToOne: false
            referencedRelation: "priorities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "workflow_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_incomes: {
        Row: {
          active: boolean
          amount: number
          client_id: string | null
          created_at: string
          description: string
          id: string
          next_due: string | null
          notes: string | null
          recurrence: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount?: number
          client_id?: string | null
          created_at?: string
          description: string
          id?: string
          next_due?: string | null
          notes?: string | null
          recurrence?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          client_id?: string | null
          created_at?: string
          description?: string
          id?: string
          next_due?: string | null
          notes?: string | null
          recurrence?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_incomes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          action: string
          created_at: string
          id: string
          resource: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          resource: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          resource?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      text_snippets: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          title: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workflow_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          is_client_validation: boolean
          is_final: boolean
          is_review: boolean
          name: string
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_client_validation?: boolean
          is_final?: boolean
          is_review?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_client_validation?: boolean
          is_final?: boolean
          is_review?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_project_by_token: {
        Args: { _token: string }
        Returns: {
          client_decided_at: string
          client_decision: string
          client_feedback: string
          client_name: string
          deliverable_path: string
          description: string
          id: string
          media_type_name: string
          notes: string
          status_name: string
          title: string
        }[]
      }
      has_permission: {
        Args: { _action: string; _resource: string; _uid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_manager: { Args: { _uid: string }; Returns: boolean }
      submit_client_decision: {
        Args: { _decision: string; _feedback: string; _token: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "gerente" | "membro"
      media_type:
        | "post"
        | "story"
        | "reels"
        | "video"
        | "banner"
        | "logo"
        | "site"
        | "impresso"
        | "outro"
      project_priority: "baixa" | "media" | "alta" | "urgente"
      project_status: "a_fazer" | "em_andamento" | "em_revisao" | "concluido"
      service_type:
        | "design_grafico"
        | "social_media"
        | "video"
        | "fotografia"
        | "web"
        | "branding"
        | "copywriting"
        | "outro"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "gerente", "membro"],
      media_type: [
        "post",
        "story",
        "reels",
        "video",
        "banner",
        "logo",
        "site",
        "impresso",
        "outro",
      ],
      project_priority: ["baixa", "media", "alta", "urgente"],
      project_status: ["a_fazer", "em_andamento", "em_revisao", "concluido"],
      service_type: [
        "design_grafico",
        "social_media",
        "video",
        "fotografia",
        "web",
        "branding",
        "copywriting",
        "outro",
      ],
    },
  },
} as const

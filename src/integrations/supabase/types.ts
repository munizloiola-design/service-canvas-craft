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
      app_branding: {
        Row: {
          accent_color: string
          background_image: string | null
          brand_name: string
          button_color: string | null
          contact_email: string | null
          contact_phone: string | null
          favicon_url: string | null
          id: boolean
          login_agency_desc: string | null
          login_agency_label: string | null
          login_box_position: string | null
          login_client_desc: string | null
          login_client_label: string | null
          logo_url: string | null
          primary_color: string
          sidebar_color: string | null
          suggestions: string | null
          theme_json: Json
          updated_at: string
          welcome_subtitle: string | null
          welcome_title: string | null
          whatsapp: string | null
        }
        Insert: {
          accent_color?: string
          background_image?: string | null
          brand_name?: string
          button_color?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          favicon_url?: string | null
          id?: boolean
          login_agency_desc?: string | null
          login_agency_label?: string | null
          login_box_position?: string | null
          login_client_desc?: string | null
          login_client_label?: string | null
          logo_url?: string | null
          primary_color?: string
          sidebar_color?: string | null
          suggestions?: string | null
          theme_json?: Json
          updated_at?: string
          welcome_subtitle?: string | null
          welcome_title?: string | null
          whatsapp?: string | null
        }
        Update: {
          accent_color?: string
          background_image?: string | null
          brand_name?: string
          button_color?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          favicon_url?: string | null
          id?: boolean
          login_agency_desc?: string | null
          login_agency_label?: string | null
          login_box_position?: string | null
          login_client_desc?: string | null
          login_client_label?: string | null
          logo_url?: string | null
          primary_color?: string
          sidebar_color?: string | null
          suggestions?: string | null
          theme_json?: Json
          updated_at?: string
          welcome_subtitle?: string | null
          welcome_title?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      area_menu_visibility: {
        Row: {
          area_id: string
          created_at: string
          menu_key: string
        }
        Insert: {
          area_id: string
          created_at?: string
          menu_key: string
        }
        Update: {
          area_id?: string
          created_at?: string
          menu_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "area_menu_visibility_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "provider_areas"
            referencedColumns: ["id"]
          },
        ]
      }
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
      client_briefings: {
        Row: {
          analise_redes: string | null
          arquetipo: string | null
          canais: string | null
          client_id: string
          concorrencia: string | null
          created_at: string
          historia: string | null
          id: string
          indicadores: Json
          materiais: Json
          missao: string | null
          objecoes: string | null
          objetivos_mes: string | null
          persona: string | null
          publico_alvo: string | null
          referencias: string | null
          swot_ameacas: string | null
          swot_forcas: string | null
          swot_fraquezas: string | null
          swot_oportunidades: string | null
          tom_de_voz: string | null
          updated_at: string
          valores: string | null
          visao: string | null
        }
        Insert: {
          analise_redes?: string | null
          arquetipo?: string | null
          canais?: string | null
          client_id: string
          concorrencia?: string | null
          created_at?: string
          historia?: string | null
          id?: string
          indicadores?: Json
          materiais?: Json
          missao?: string | null
          objecoes?: string | null
          objetivos_mes?: string | null
          persona?: string | null
          publico_alvo?: string | null
          referencias?: string | null
          swot_ameacas?: string | null
          swot_forcas?: string | null
          swot_fraquezas?: string | null
          swot_oportunidades?: string | null
          tom_de_voz?: string | null
          updated_at?: string
          valores?: string | null
          visao?: string | null
        }
        Update: {
          analise_redes?: string | null
          arquetipo?: string | null
          canais?: string | null
          client_id?: string
          concorrencia?: string | null
          created_at?: string
          historia?: string | null
          id?: string
          indicadores?: Json
          materiais?: Json
          missao?: string | null
          objecoes?: string | null
          objetivos_mes?: string | null
          persona?: string | null
          publico_alvo?: string | null
          referencias?: string | null
          swot_ameacas?: string | null
          swot_forcas?: string | null
          swot_fraquezas?: string | null
          swot_oportunidades?: string | null
          tom_de_voz?: string | null
          updated_at?: string
          valores?: string | null
          visao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_briefings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_team_members: {
        Row: {
          created_at: string
          id: string
          role_hint: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_hint?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role_hint?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "client_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      client_teams: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_teams_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_users: {
        Row: {
          client_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
          prospect_next_action: string | null
          prospect_next_action_at: string | null
          prospect_stage: string | null
          prospect_value: number | null
          status: string
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
          prospect_next_action?: string | null
          prospect_next_action_at?: string | null
          prospect_stage?: string | null
          prospect_value?: number | null
          status?: string
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
          prospect_next_action?: string | null
          prospect_next_action_at?: string | null
          prospect_stage?: string | null
          prospect_value?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      collaborator_functions: {
        Row: {
          created_at: string
          id: string
          key: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      contact_categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      crm_stages: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_lost: boolean
          is_won: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name?: string
          sort_order?: number
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
      diguinho_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_html: string
          id: string
          key: string
          subject: string
          updated_at: string
        }
        Insert: {
          body_html: string
          id?: string
          key: string
          subject: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          id?: string
          key?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
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
          depreciation_per_use: number | null
          id: string
          name: string
          notes: string | null
          type: string | null
          updated_at: string
          useful_life_months: number | null
        }
        Insert: {
          acquisition_date?: string
          acquisition_value?: number
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          depreciation_pct_year?: number
          depreciation_per_use?: number | null
          id?: string
          name: string
          notes?: string | null
          type?: string | null
          updated_at?: string
          useful_life_months?: number | null
        }
        Update: {
          acquisition_date?: string
          acquisition_value?: number
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          depreciation_pct_year?: number
          depreciation_per_use?: number | null
          id?: string
          name?: string
          notes?: string | null
          type?: string | null
          updated_at?: string
          useful_life_months?: number | null
        }
        Relationships: []
      }
      facebook_insights_cache: {
        Row: {
          ad_account_id: string
          date_preset: string
          fetched_at: string
          id: string
          payload: Json
        }
        Insert: {
          ad_account_id: string
          date_preset: string
          fetched_at?: string
          id?: string
          payload: Json
        }
        Update: {
          ad_account_id?: string
          date_preset?: string
          fetched_at?: string
          id?: string
          payload?: Json
        }
        Relationships: []
      }
      financial_categories: {
        Row: {
          created_at: string
          id: string
          is_fixed: boolean
          kind: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_fixed?: boolean
          kind: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_fixed?: boolean
          kind?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      financial_entries: {
        Row: {
          amount: number
          category: string | null
          category_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string
          entry_date: string
          id: string
          kind: string
          project_id: string | null
          receipt_path: string | null
          source_id: string | null
          source_type: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string | null
          category_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          entry_date?: string
          id?: string
          kind: string
          project_id?: string | null
          receipt_path?: string | null
          source_id?: string | null
          source_type?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          category_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          entry_date?: string
          id?: string
          kind?: string
          project_id?: string | null
          receipt_path?: string | null
          source_id?: string | null
          source_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
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
      financial_entry_requests: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_entry_id: string | null
          description: string
          entry_date: string
          id: string
          kind: string
          receipt_path: string | null
          requester_email: string
          requester_name: string
          requester_notes: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_entry_id?: string | null
          description: string
          entry_date: string
          id?: string
          kind: string
          receipt_path?: string | null
          requester_email: string
          requester_name: string
          requester_notes?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_entry_id?: string | null
          description?: string
          entry_date?: string
          id?: string
          kind?: string
          receipt_path?: string | null
          requester_email?: string
          requester_name?: string
          requester_notes?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_entry_requests_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entry_requests_created_entry_id_fkey"
            columns: ["created_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
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
          category_id: string | null
          commission_pct: number
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
          category_id?: string | null
          commission_pct?: number
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
          category_id?: string | null
          commission_pct?: number
          created_at?: string
          due_day?: number | null
          id?: string
          name?: string
          notes?: string | null
          recurrence?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_costs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      function_field_visibility: {
        Row: {
          field_key: string
          function_id: string
          id: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          field_key: string
          function_id: string
          id?: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          field_key?: string
          function_id?: string
          id?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "function_field_visibility_function_id_fkey"
            columns: ["function_id"]
            isOneToOne: false
            referencedRelation: "collaborator_functions"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_meta: {
        Row: {
          access_token: string
          ad_account_id: string
          connected_at: string
          display_name: string | null
          page_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          ad_account_id: string
          connected_at?: string
          display_name?: string | null
          page_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          ad_account_id?: string
          connected_at?: string
          display_name?: string | null
          page_id?: string | null
          updated_at?: string
          user_id?: string
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
      partner_contacts: {
        Row: {
          category_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          profession: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          profession?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          profession?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_contacts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "contact_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_registrations: {
        Row: {
          company_name: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          rejection_reason: string | null
          requested_role: Database["public"]["Enums"]["app_role"] | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          type: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          rejection_reason?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"] | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          type: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          rejection_reason?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"] | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          type?: string
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
          address: string | null
          avatar_url: string | null
          birth_date: string | null
          commission_pct: number
          contract_type: string | null
          created_at: string
          document: string | null
          emergency_contact: string | null
          full_name: string
          hourly_cost: number
          id: string
          job_title: string | null
          password_setup_expires_at: string | null
          password_setup_link: string | null
          phone: string | null
          start_date: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          commission_pct?: number
          contract_type?: string | null
          created_at?: string
          document?: string | null
          emergency_contact?: string | null
          full_name?: string
          hourly_cost?: number
          id: string
          job_title?: string | null
          password_setup_expires_at?: string | null
          password_setup_link?: string | null
          phone?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          commission_pct?: number
          contract_type?: string | null
          created_at?: string
          document?: string | null
          emergency_contact?: string | null
          full_name?: string
          hourly_cost?: number
          id?: string
          job_title?: string | null
          password_setup_expires_at?: string | null
          password_setup_link?: string | null
          phone?: string | null
          start_date?: string | null
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
      project_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          project_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          project_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_comments_project_id_fkey"
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
          caption: string | null
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
          description_cards: Json
          due_date: string | null
          final_link: string | null
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
          team_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          budget?: number | null
          caption?: string | null
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
          description_cards?: Json
          due_date?: string | null
          final_link?: string | null
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
          team_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          budget?: number | null
          caption?: string | null
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
          description_cards?: Json
          due_date?: string | null
          final_link?: string | null
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
          team_id?: string | null
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
          {
            foreignKeyName: "projects_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_areas: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      provider_specialties: {
        Row: {
          area_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          area_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          area_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_specialties_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "provider_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_incomes: {
        Row: {
          active: boolean
          amount: number
          category_id: string | null
          client_id: string | null
          commission_pct: number
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
          category_id?: string | null
          client_id?: string | null
          commission_pct?: number
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
          category_id?: string | null
          client_id?: string | null
          commission_pct?: number
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
            foreignKeyName: "recurring_incomes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_incomes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      specialty_field_visibility: {
        Row: {
          can_edit: boolean
          can_view: boolean
          created_at: string
          field_key: string
          specialty_id: string
          updated_at: string
        }
        Insert: {
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          field_key: string
          specialty_id: string
          updated_at?: string
        }
        Update: {
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          field_key?: string
          specialty_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "specialty_field_visibility_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "provider_specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "internal_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_private_notes: {
        Row: {
          content: string
          id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          content?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          content?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
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
      ticket_requests: {
        Row: {
          attachments: Json
          company: string | null
          created_at: string
          created_project_id: string | null
          description: string
          desired_due_date: string | null
          id: string
          internal_notes: string | null
          media_type_id: string | null
          reference_links: string[]
          requester_email: string
          requester_name: string
          requester_phone: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          title: string
        }
        Insert: {
          attachments?: Json
          company?: string | null
          created_at?: string
          created_project_id?: string | null
          description: string
          desired_due_date?: string | null
          id?: string
          internal_notes?: string | null
          media_type_id?: string | null
          reference_links?: string[]
          requester_email: string
          requester_name: string
          requester_phone?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title: string
        }
        Update: {
          attachments?: Json
          company?: string | null
          created_at?: string
          created_project_id?: string | null
          description?: string
          desired_due_date?: string | null
          id?: string
          internal_notes?: string | null
          media_type_id?: string | null
          reference_links?: string[]
          requester_email?: string
          requester_name?: string
          requester_phone?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_requests_created_project_id_fkey"
            columns: ["created_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_requests_media_type_id_fkey"
            columns: ["media_type_id"]
            isOneToOne: false
            referencedRelation: "media_types"
            referencedColumns: ["id"]
          },
        ]
      }
      time_logs: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          project_id: string
          started_at: string
          status_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          project_id: string
          started_at?: string
          status_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          project_id?: string
          started_at?: string
          status_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_logs_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "workflow_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_functions: {
        Row: {
          created_at: string
          function_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          function_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          function_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_functions_function_id_fkey"
            columns: ["function_id"]
            isOneToOne: false
            referencedRelation: "collaborator_functions"
            referencedColumns: ["id"]
          },
        ]
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
      user_specialties: {
        Row: {
          created_at: string
          specialty_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          specialty_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          specialty_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_specialties_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "provider_specialties"
            referencedColumns: ["id"]
          },
        ]
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
      internal_profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          birth_date: string | null
          commission_pct: number | null
          contract_type: string | null
          created_at: string | null
          document: string | null
          emergency_contact: string | null
          full_name: string | null
          hourly_cost: number | null
          id: string | null
          job_title: string | null
          password_setup_expires_at: string | null
          password_setup_link: string | null
          phone: string | null
          start_date: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          commission_pct?: number | null
          contract_type?: string | null
          created_at?: string | null
          document?: string | null
          emergency_contact?: string | null
          full_name?: string | null
          hourly_cost?: number | null
          id?: string | null
          job_title?: string | null
          password_setup_expires_at?: string | null
          password_setup_link?: string | null
          phone?: string | null
          start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          commission_pct?: number | null
          contract_type?: string | null
          created_at?: string | null
          document?: string | null
          emergency_contact?: string | null
          full_name?: string | null
          hourly_cost?: number | null
          id?: string | null
          job_title?: string | null
          password_setup_expires_at?: string | null
          password_setup_link?: string | null
          phone?: string | null
          start_date?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      time_logs_with_duration: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string | null
          project_id: string | null
          started_at: string | null
          status_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: never
          ended_at?: string | null
          id?: string | null
          project_id?: string | null
          started_at?: string | null
          status_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          duration_seconds?: never
          ended_at?: string | null
          id?: string | null
          project_id?: string | null
          started_at?: string | null
          status_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_logs_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "workflow_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_manage_user_role: {
        Args: {
          _actor: string
          _role: Database["public"]["Enums"]["app_role"]
          _target: string
        }
        Returns: boolean
      }
      can_view_project: {
        Args: { _project_id: string; _uid: string }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
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
      has_client_access: {
        Args: { _client_id: string; _uid: string }
        Returns: boolean
      }
      has_menu_access: {
        Args: { _menu_key: string; _uid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_client_profile: { Args: { _uid: string }; Returns: boolean }
      is_client_user: { Args: { _uid: string }; Returns: boolean }
      is_manager: { Args: { _uid: string }; Returns: boolean }
      is_master: { Args: { _uid: string }; Returns: boolean }
      is_project_assignee: {
        Args: { _project_id: string; _uid: string }
        Returns: boolean
      }
      month_floor: { Args: { _d: string }; Returns: string }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      role_rank: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: number
      }
      slugify: { Args: { _t: string }; Returns: string }
      submit_client_decision: {
        Args: { _decision: string; _feedback: string; _token: string }
        Returns: boolean
      }
      submit_client_decision_authed: {
        Args: { _decision: string; _feedback: string; _project_id: string }
        Returns: boolean
      }
      unaccent_safe: { Args: { _t: string }; Returns: string }
      update_project_schedule: {
        Args: {
          _clear_due?: boolean
          _clear_post?: boolean
          _due_date?: string
          _id: string
          _post_date?: string
          _status_id?: string
        }
        Returns: undefined
      }
      user_max_rank: { Args: { _uid: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "gerente" | "membro" | "cliente" | "admin_master"
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
      app_role: ["admin", "gerente", "membro", "cliente", "admin_master"],
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

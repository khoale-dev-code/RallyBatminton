// Tự sinh từ schema Rally (supabase/sql/00 + 01). KHÔNG sửa tay.
// Tạo lại sau khi đổi schema:  npx supabase gen types typescript --project-id <id> --schema public > src/lib/supabase/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12.2"
  }
  public: {
    Tables: {
      amenities: {
        Row: {
          code: string
          label: string
          icon: string | null
          sort_order: number
        }
        Insert: {
          code: string
          label: string
          icon?: string | null
          sort_order?: number
        }
        Update: {
          code?: string
          label?: string
          icon?: string | null
          sort_order?: number
        }
        Relationships: [
        ]
      }
      attendance_fix_requests: {
        Row: {
          id: string
          shift_id: string
          employee_id: string
          branch_id: string
          kind: string
          claimed_at: string
          recorded_at: string | null
          reason: string
          status: string
          created_at: string
          decided_by: string | null
          decided_at: string | null
          decision_note: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          shift_id: string
          employee_id: string
          branch_id: string
          kind: string
          claimed_at: string
          recorded_at?: string | null
          reason: string
          status?: string
          created_at?: string
          decided_by?: string | null
          decided_at?: string | null
          decision_note?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          shift_id?: string
          employee_id?: string
          branch_id?: string
          kind?: string
          claimed_at?: string
          recorded_at?: string | null
          reason?: string
          status?: string
          created_at?: string
          decided_by?: string | null
          decided_at?: string | null
          decision_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_fix_requests_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_fix_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_fix_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_kiosks: {
        Row: {
          id: string
          branch_id: string
          name: string
          token_hash: string
          created_by: string | null
          created_at: string
          last_seen_at: string | null
          revoked_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          branch_id: string
          name: string
          token_hash: string
          created_by?: string | null
          created_at?: string
          last_seen_at?: string | null
          revoked_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          branch_id?: string
          name?: string
          token_hash?: string
          created_by?: string | null
          created_at?: string
          last_seen_at?: string | null
          revoked_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_kiosks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_qr_tokens: {
        Row: {
          token_hash: string
          branch_id: string
          expires_at: string
          created_by: string | null
          created_at: string
          kiosk_id: string | null
        }
        Insert: {
          token_hash: string
          branch_id: string
          expires_at: string
          created_by?: string | null
          created_at?: string
          kiosk_id?: string | null
        }
        Update: {
          token_hash?: string
          branch_id?: string
          expires_at?: string
          created_by?: string | null
          created_at?: string
          kiosk_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_qr_tokens_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_settings: {
        Row: {
          id: boolean
          late_grace_minutes: number
          late_out_review_minutes: number
          fix_request_hours: number
          forgot_warn_count: number
          qr_ttl_seconds: number
          auto_close_forgotten: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          late_grace_minutes?: number
          late_out_review_minutes?: number
          fix_request_hours?: number
          forgot_warn_count?: number
          qr_ttl_seconds?: number
          auto_close_forgotten?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          late_grace_minutes?: number
          late_out_review_minutes?: number
          fix_request_hours?: number
          forgot_warn_count?: number
          qr_ttl_seconds?: number
          auto_close_forgotten?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          id: number
          occurred_at: string
          actor_id: string | null
          actor_role: string | null
          branch_id: string | null
          table_name: string
          record_id: string
          action: string
          reason: string | null
          old_data: Json | null
          new_data: Json | null
        }
        Insert: {
          id?: never
          occurred_at?: string
          actor_id?: string | null
          actor_role?: string | null
          branch_id?: string | null
          table_name: string
          record_id: string
          action: string
          reason?: string | null
          old_data?: Json | null
          new_data?: Json | null
        }
        Update: {
          id?: never
          occurred_at?: string
          actor_id?: string | null
          actor_role?: string | null
          branch_id?: string | null
          table_name?: string
          record_id?: string
          action?: string
          reason?: string | null
          old_data?: Json | null
          new_data?: Json | null
        }
        Relationships: [
        ]
      }
      bank_transactions: {
        Row: {
          id: string
          provider: string
          provider_txn_id: string
          gateway: string | null
          account_number: string | null
          transfer_type: string
          amount: number
          content: string | null
          payment_code: string | null
          reference_code: string | null
          transaction_at: string
          status: string
          status_note: string | null
          branch_id: string | null
          booking_id: string | null
          payment_id: string | null
          raw: Json
          resolved_by: string | null
          resolved_at: string | null
          created_at: string
          alerted_at: string | null
          sale_id: string | null
        }
        Insert: {
          id?: string
          provider?: string
          provider_txn_id: string
          gateway?: string | null
          account_number?: string | null
          transfer_type: string
          amount: number
          content?: string | null
          payment_code?: string | null
          reference_code?: string | null
          transaction_at?: string
          status: string
          status_note?: string | null
          branch_id?: string | null
          booking_id?: string | null
          payment_id?: string | null
          raw?: Json
          resolved_by?: string | null
          resolved_at?: string | null
          created_at?: string
          alerted_at?: string | null
          sale_id?: string | null
        }
        Update: {
          id?: string
          provider?: string
          provider_txn_id?: string
          gateway?: string | null
          account_number?: string | null
          transfer_type?: string
          amount?: number
          content?: string | null
          payment_code?: string | null
          reference_code?: string | null
          transaction_at?: string
          status?: string
          status_note?: string | null
          branch_id?: string | null
          booking_id?: string | null
          payment_id?: string | null
          raw?: Json
          resolved_by?: string | null
          resolved_at?: string | null
          created_at?: string
          alerted_at?: string | null
          sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          id: string
          code: string
          branch_id: string
          court_id: string
          kind: Database["public"]["Enums"]["booking_kind"]
          source: Database["public"]["Enums"]["booking_source"]
          status: Database["public"]["Enums"]["booking_status"]
          during: string
          customer_id: string | null
          contact_name: string | null
          hold_expires_at: string | null
          subtotal_amount: number
          discount_amount: number
          total_amount: number | null
          deposit_amount: number
          price_snapshot: Json
          member_user_id: string | null
          refund_entitlement: number | null
          recurring_series_id: string | null
          customer_note: string | null
          internal_note: string | null
          status_reason: string | null
          idempotency_key: string | null
          created_by: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          checked_in_at: string | null
          checked_in_by: string | null
          completed_at: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          status_changed_at: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          code?: string
          branch_id: string
          court_id: string
          kind?: Database["public"]["Enums"]["booking_kind"]
          source: Database["public"]["Enums"]["booking_source"]
          status?: Database["public"]["Enums"]["booking_status"]
          during: string
          customer_id?: string | null
          contact_name?: string | null
          hold_expires_at?: string | null
          subtotal_amount?: number
          discount_amount?: number
          total_amount?: never
          deposit_amount?: number
          price_snapshot?: Json
          member_user_id?: string | null
          refund_entitlement?: number | null
          recurring_series_id?: string | null
          customer_note?: string | null
          internal_note?: string | null
          status_reason?: string | null
          idempotency_key?: string | null
          created_by?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          completed_at?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          status_changed_at?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          code?: string
          branch_id?: string
          court_id?: string
          kind?: Database["public"]["Enums"]["booking_kind"]
          source?: Database["public"]["Enums"]["booking_source"]
          status?: Database["public"]["Enums"]["booking_status"]
          during?: string
          customer_id?: string | null
          contact_name?: string | null
          hold_expires_at?: string | null
          subtotal_amount?: number
          discount_amount?: number
          total_amount?: never
          deposit_amount?: number
          price_snapshot?: Json
          member_user_id?: string | null
          refund_entitlement?: number | null
          recurring_series_id?: string | null
          customer_note?: string | null
          internal_note?: string | null
          status_reason?: string | null
          idempotency_key?: string | null
          created_by?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          completed_at?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          status_changed_at?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_court_fk"
            columns: ["court_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id", "branch_id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_recurring_series_id_fkey"
            columns: ["recurring_series_id"]
            isOneToOne: false
            referencedRelation: "recurring_series"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_amenities: {
        Row: {
          branch_id: string
          amenity_code: string
        }
        Insert: {
          branch_id: string
          amenity_code: string
        }
        Update: {
          branch_id?: string
          amenity_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_amenities_amenity_code_fkey"
            columns: ["amenity_code"]
            isOneToOne: false
            referencedRelation: "amenities"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "branch_amenities_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          id: string
          slug: string
          name: string
          address_line: string
          ward: string | null
          district: string | null
          city: string
          phone: string | null
          latitude: number | null
          longitude: number | null
          map_url: string | null
          map_embed_url: string | null
          timezone: string
          opens_at: string
          closes_at: string
          slot_minutes: number
          hold_minutes: number
          min_booking_minutes: number
          max_booking_minutes: number
          booking_window_days: number
          deposit_percent: number
          free_cancel_hours: number
          partial_refund_hours: number
          partial_refund_percent: number
          description: string | null
          parking_info: string | null
          house_rules: string | null
          cover_image_path: string | null
          status: Database["public"]["Enums"]["branch_status"]
          published_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          bank_code: string | null
          bank_account_no: string | null
          bank_account_name: string | null
          transfer_memo_prefix: string | null
        }
        Insert: {
          id?: string
          slug: string
          name: string
          address_line?: string
          ward?: string | null
          district?: string | null
          city?: string
          phone?: string | null
          latitude?: number | null
          longitude?: number | null
          map_url?: string | null
          map_embed_url?: string | null
          timezone?: string
          opens_at?: string
          closes_at?: string
          slot_minutes?: number
          hold_minutes?: number
          min_booking_minutes?: number
          max_booking_minutes?: number
          booking_window_days?: number
          deposit_percent?: number
          free_cancel_hours?: number
          partial_refund_hours?: number
          partial_refund_percent?: number
          description?: string | null
          parking_info?: string | null
          house_rules?: string | null
          cover_image_path?: string | null
          status?: Database["public"]["Enums"]["branch_status"]
          published_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          bank_code?: string | null
          bank_account_no?: string | null
          bank_account_name?: string | null
          transfer_memo_prefix?: string | null
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          address_line?: string
          ward?: string | null
          district?: string | null
          city?: string
          phone?: string | null
          latitude?: number | null
          longitude?: number | null
          map_url?: string | null
          map_embed_url?: string | null
          timezone?: string
          opens_at?: string
          closes_at?: string
          slot_minutes?: number
          hold_minutes?: number
          min_booking_minutes?: number
          max_booking_minutes?: number
          booking_window_days?: number
          deposit_percent?: number
          free_cancel_hours?: number
          partial_refund_hours?: number
          partial_refund_percent?: number
          description?: string | null
          parking_info?: string | null
          house_rules?: string | null
          cover_image_path?: string | null
          status?: Database["public"]["Enums"]["branch_status"]
          published_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          bank_code?: string | null
          bank_account_no?: string | null
          bank_account_name?: string | null
          transfer_memo_prefix?: string | null
        }
        Relationships: [
        ]
      }
      brand_settings: {
        Row: {
          id: boolean
          name: string
          hotline: string | null
          email: string | null
          website_url: string | null
          facebook_url: string | null
          zalo_url: string | null
          updated_at: string
          payment_instructions: string | null
          address_line: string | null
          tax_method: string
          default_vat_rate: number
          tax_code: string | null
          bank_code: string | null
          bank_account_no: string | null
          bank_account_name: string | null
          transfer_auto_confirm: boolean
          transfer_memo_prefix: string | null
          legal_name: string | null
          legal_address: string | null
          privacy_email: string | null
          privacy_contact: string | null
        }
        Insert: {
          id?: boolean
          name: string
          hotline?: string | null
          email?: string | null
          website_url?: string | null
          facebook_url?: string | null
          zalo_url?: string | null
          updated_at?: string
          payment_instructions?: string | null
          address_line?: string | null
          tax_method?: string
          default_vat_rate?: number
          tax_code?: string | null
          bank_code?: string | null
          bank_account_no?: string | null
          bank_account_name?: string | null
          transfer_auto_confirm?: boolean
          transfer_memo_prefix?: string | null
          legal_name?: string | null
          legal_address?: string | null
          privacy_email?: string | null
          privacy_contact?: string | null
        }
        Update: {
          id?: boolean
          name?: string
          hotline?: string | null
          email?: string | null
          website_url?: string | null
          facebook_url?: string | null
          zalo_url?: string | null
          updated_at?: string
          payment_instructions?: string | null
          address_line?: string | null
          tax_method?: string
          default_vat_rate?: number
          tax_code?: string | null
          bank_code?: string | null
          bank_account_no?: string | null
          bank_account_name?: string | null
          transfer_auto_confirm?: boolean
          transfer_memo_prefix?: string | null
          legal_name?: string | null
          legal_address?: string | null
          privacy_email?: string | null
          privacy_contact?: string | null
        }
        Relationships: [
        ]
      }
      bundle_components: {
        Row: {
          bundle_product_id: string
          component_variant_id: string
          quantity: number
        }
        Insert: {
          bundle_product_id: string
          component_variant_id: string
          quantity: number
        }
        Update: {
          bundle_product_id?: string
          component_variant_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "bundle_components_bundle_product_id_fkey"
            columns: ["bundle_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_components_component_variant_id_fkey"
            columns: ["component_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      court_photos: {
        Row: {
          id: string
          court_id: string
          storage_path: string
          alt_text: string | null
          sort_order: number
          is_cover: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          court_id: string
          storage_path: string
          alt_text?: string | null
          sort_order?: number
          is_cover?: boolean
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          court_id?: string
          storage_path?: string
          alt_text?: string | null
          sort_order?: number
          is_cover?: boolean
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "court_photos_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      court_surfaces: {
        Row: {
          code: string
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          label?: string
          sort_order?: number
        }
        Relationships: [
        ]
      }
      courts: {
        Row: {
          id: string
          branch_id: string
          name: string
          surface_code: string | null
          is_indoor: boolean
          status: Database["public"]["Enums"]["court_status"]
          sort_order: number
          description: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          branch_id: string
          name: string
          surface_code?: string | null
          is_indoor?: boolean
          status?: Database["public"]["Enums"]["court_status"]
          sort_order?: number
          description?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          branch_id?: string
          name?: string
          surface_code?: string | null
          is_indoor?: boolean
          status?: Database["public"]["Enums"]["court_status"]
          sort_order?: number
          description?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courts_surface_code_fkey"
            columns: ["surface_code"]
            isOneToOne: false
            referencedRelation: "court_surfaces"
            referencedColumns: ["code"]
          },
        ]
      }
      customers: {
        Row: {
          id: string
          phone: string
          full_name: string
          email: string | null
          auth_user_id: string | null
          staff_note: string | null
          marketing_opt_in: boolean
          created_at: string
          updated_at: string
          anonymized_at: string | null
        }
        Insert: {
          id?: string
          phone: string
          full_name: string
          email?: string | null
          auth_user_id?: string | null
          staff_note?: string | null
          marketing_opt_in?: boolean
          created_at?: string
          updated_at?: string
          anonymized_at?: string | null
        }
        Update: {
          id?: string
          phone?: string
          full_name?: string
          email?: string | null
          auth_user_id?: string | null
          staff_note?: string | null
          marketing_opt_in?: boolean
          created_at?: string
          updated_at?: string
          anonymized_at?: string | null
        }
        Relationships: [
        ]
      }
      member_profiles: {
        Row: {
          user_id: string
          full_name: string
          phone: string | null
          login_kind: Database["public"]["Enums"]["member_login_kind"]
          points: number
          lifetime_points: number
          tier: Database["public"]["Enums"]["member_tier"]
          is_locked: boolean
          must_change_password: boolean
          marketing_opt_in: boolean
          staff_note: string | null
          last_seen_at: string | null
          created_at: string
          updated_at: string
          anonymized_at: string | null
        }
        Insert: {
          user_id: string
          full_name: string
          phone?: string | null
          login_kind: Database["public"]["Enums"]["member_login_kind"]
          points?: number
          lifetime_points?: number
          tier?: Database["public"]["Enums"]["member_tier"]
          is_locked?: boolean
          must_change_password?: boolean
          marketing_opt_in?: boolean
          staff_note?: string | null
          last_seen_at?: string | null
          created_at?: string
          updated_at?: string
          anonymized_at?: string | null
        }
        Update: {
          user_id?: string
          full_name?: string
          phone?: string | null
          login_kind?: Database["public"]["Enums"]["member_login_kind"]
          points?: number
          lifetime_points?: number
          tier?: Database["public"]["Enums"]["member_tier"]
          is_locked?: boolean
          must_change_password?: boolean
          marketing_opt_in?: boolean
          staff_note?: string | null
          last_seen_at?: string | null
          created_at?: string
          updated_at?: string
          anonymized_at?: string | null
        }
        Relationships: [
        ]
      }
      member_point_ledger: {
        Row: {
          id: number
          user_id: string
          kind: string
          delta: number
          reason: string
          booking_id: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: never
          user_id: string
          kind: string
          delta: number
          reason: string
          booking_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: never
          user_id?: string
          kind?: string
          delta?: number
          reason?: string
          booking_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
        ]
      }
      employee_pay_rates: {
        Row: {
          id: string
          employee_id: string
          pay_type: Database["public"]["Enums"]["pay_type"]
          hourly_rate: number | null
          daily_rate: number | null
          standard_day_minutes: number
          effective_from: string
          note: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          pay_type: Database["public"]["Enums"]["pay_type"]
          hourly_rate?: number | null
          daily_rate?: number | null
          standard_day_minutes?: number
          effective_from: string
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          pay_type?: Database["public"]["Enums"]["pay_type"]
          hourly_rate?: number | null
          daily_rate?: number | null
          standard_day_minutes?: number
          effective_from?: string
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_pay_rates_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          id: string
          code: string
          full_name: string
          phone: string | null
          email: string | null
          home_branch_id: string
          employment_type: Database["public"]["Enums"]["employment_type"]
          status: Database["public"]["Enums"]["employee_status"]
          hired_on: string | null
          terminated_on: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          full_name: string
          phone?: string | null
          email?: string | null
          home_branch_id: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          status?: Database["public"]["Enums"]["employee_status"]
          hired_on?: string | null
          terminated_on?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          full_name?: string
          phone?: string | null
          email?: string | null
          home_branch_id?: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          status?: Database["public"]["Enums"]["employee_status"]
          hired_on?: string | null
          terminated_on?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_home_branch_id_fkey"
            columns: ["home_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_levels: {
        Row: {
          branch_id: string
          variant_id: string
          on_hand: number
          reorder_level: number
          is_listed: boolean
          updated_at: string
        }
        Insert: {
          branch_id: string
          variant_id: string
          on_hand?: number
          reorder_level?: number
          is_listed?: boolean
          updated_at?: string
        }
        Update: {
          branch_id?: string
          variant_id?: string
          on_hand?: number
          reorder_level?: number
          is_listed?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_levels_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_levels_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          id: boolean
          alert_emails: string[]
          alert_on_review: boolean
          alert_on_unmatched: boolean
          updated_at: string
        }
        Insert: {
          id?: boolean
          alert_emails?: string[]
          alert_on_review?: boolean
          alert_on_unmatched?: boolean
          updated_at?: string
        }
        Update: {
          id?: boolean
          alert_emails?: string[]
          alert_on_review?: boolean
          alert_on_unmatched?: boolean
          updated_at?: string
        }
        Relationships: [
        ]
      }
      reconcile_runs: {
        Row: {
          id: string
          source: string
          started_at: string
          finished_at: string | null
          fetched: number
          new_count: number
          error: string | null
        }
        Insert: {
          id?: string
          source: string
          started_at?: string
          finished_at?: string | null
          fetched?: number
          new_count?: number
          error?: string | null
        }
        Update: {
          id?: string
          source?: string
          started_at?: string
          finished_at?: string | null
          fetched?: number
          new_count?: number
          error?: string | null
        }
        Relationships: [
        ]
      }
      payments: {
        Row: {
          id: string
          branch_id: string
          booking_id: string | null
          sale_id: string | null
          rental_id: string | null
          kind: Database["public"]["Enums"]["payment_kind"]
          method: Database["public"]["Enums"]["payment_method"]
          status: Database["public"]["Enums"]["payment_status"]
          amount: number
          reference: string | null
          provider: string | null
          provider_txn_id: string | null
          provider_payload: Json | null
          idempotency_key: string
          note: string | null
          received_at: string
          recorded_by: string | null
          voided_at: string | null
          voided_by: string | null
          void_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          branch_id: string
          booking_id?: string | null
          sale_id?: string | null
          rental_id?: string | null
          kind?: Database["public"]["Enums"]["payment_kind"]
          method: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["payment_status"]
          amount: number
          reference?: string | null
          provider?: string | null
          provider_txn_id?: string | null
          provider_payload?: Json | null
          idempotency_key: string
          note?: string | null
          received_at?: string
          recorded_by?: string | null
          voided_at?: string | null
          voided_by?: string | null
          void_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          branch_id?: string
          booking_id?: string | null
          sale_id?: string | null
          rental_id?: string | null
          kind?: Database["public"]["Enums"]["payment_kind"]
          method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["payment_status"]
          amount?: number
          reference?: string | null
          provider?: string | null
          provider_txn_id?: string | null
          provider_payload?: Json | null
          idempotency_key?: string
          note?: string | null
          received_at?: string
          recorded_by?: string | null
          voided_at?: string | null
          voided_by?: string | null
          void_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_adjustments: {
        Row: {
          id: string
          employee_id: string
          month: string
          amount: number
          reason: string
          created_by: string | null
          created_at: string
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          id?: string
          employee_id: string
          month: string
          amount: number
          reason: string
          created_by?: string | null
          created_at?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          id?: string
          employee_id?: string
          month?: string
          amount?: number
          reason?: string
          created_by?: string | null
          created_at?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_adjustments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_lines: {
        Row: {
          period_id: string
          employee_id: string
          employee_code: string
          employee_name: string
          branch_id: string
          shifts_count: number
          paid_minutes: number
          base_pay: number
          adjustments_total: number
          net_pay: number | null
          overtime_minutes: number
          overtime_pay: number
        }
        Insert: {
          period_id: string
          employee_id: string
          employee_code: string
          employee_name: string
          branch_id: string
          shifts_count: number
          paid_minutes: number
          base_pay: number
          adjustments_total: number
          net_pay?: never
          overtime_minutes?: number
          overtime_pay?: number
        }
        Update: {
          period_id?: string
          employee_id?: string
          employee_code?: string
          employee_name?: string
          branch_id?: string
          shifts_count?: number
          paid_minutes?: number
          base_pay?: number
          adjustments_total?: number
          net_pay?: never
          overtime_minutes?: number
          overtime_pay?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_lines_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_lines_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_lines_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_periods: {
        Row: {
          id: string
          month: string
          closed_at: string
          closed_by: string
          note: string | null
        }
        Insert: {
          id?: string
          month: string
          closed_at?: string
          closed_by: string
          note?: string | null
        }
        Update: {
          id?: string
          month?: string
          closed_at?: string
          closed_by?: string
          note?: string | null
        }
        Relationships: [
        ]
      }
      price_rules: {
        Row: {
          id: string
          branch_id: string
          court_id: string | null
          label: string | null
          days_mask: number
          starts_at: string
          ends_at: string
          price_per_hour: number
          priority: number
          valid_from: string | null
          valid_until: string | null
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          branch_id: string
          court_id?: string | null
          label?: string | null
          days_mask: number
          starts_at: string
          ends_at: string
          price_per_hour: number
          priority?: number
          valid_from?: string | null
          valid_until?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          branch_id?: string
          court_id?: string | null
          label?: string | null
          days_mask?: number
          starts_at?: string
          ends_at?: string
          price_per_hour?: number
          priority?: number
          valid_from?: string | null
          valid_until?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_rules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_rules_court_fk"
            columns: ["court_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id", "branch_id"]
          },
        ]
      }
      product_categories: {
        Row: {
          id: string
          slug: string
          name: string
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
        ]
      }
      product_photos: {
        Row: {
          id: string
          product_id: string
          storage_path: string
          alt_text: string | null
          sort_order: number
          is_cover: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          storage_path: string
          alt_text?: string | null
          sort_order?: number
          is_cover?: boolean
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          storage_path?: string
          alt_text?: string | null
          sort_order?: number
          is_cover?: boolean
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_photos_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_units: {
        Row: {
          id: string
          product_id: string
          name: string
          conversion: number
          price: number | null
          barcode: string | null
          sort_order: number
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          product_id: string
          name: string
          conversion: number
          price?: number | null
          barcode?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          product_id?: string
          name?: string
          conversion?: number
          price?: number | null
          barcode?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_units_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          id: string
          product_id: string
          sku: string
          size_label: string | null
          color_label: string | null
          price_override: number | null
          is_default: boolean
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
          deleted_at: string | null
          cost_price: number | null
          barcode: string | null
        }
        Insert: {
          id?: string
          product_id: string
          sku: string
          size_label?: string | null
          color_label?: string | null
          price_override?: number | null
          is_default?: boolean
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          cost_price?: number | null
          barcode?: string | null
        }
        Update: {
          id?: string
          product_id?: string
          sku?: string
          size_label?: string | null
          color_label?: string | null
          price_override?: number | null
          is_default?: boolean
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          cost_price?: number | null
          barcode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          id: string
          kind: Database["public"]["Enums"]["product_kind"]
          category_id: string | null
          name: string
          slug: string | null
          description: string | null
          brand_name: string | null
          base_price: number | null
          compare_at_price: number | null
          is_bundle: boolean
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          excerpt: string | null
          unit_label: string | null
          tags: string[]
          seo_title: string | null
          seo_description: string | null
          show_on_website: boolean
          show_on_pos: boolean
          invoice_name: string | null
          taxable: boolean
          tax_industry: string | null
          vat_use_default: boolean
          vat_rate: number | null
          option1_name: string | null
          option2_name: string | null
        }
        Insert: {
          id?: string
          kind: Database["public"]["Enums"]["product_kind"]
          category_id?: string | null
          name: string
          slug?: string | null
          description?: string | null
          brand_name?: string | null
          base_price?: number | null
          compare_at_price?: number | null
          is_bundle?: boolean
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          excerpt?: string | null
          unit_label?: string | null
          tags?: string[]
          seo_title?: string | null
          seo_description?: string | null
          show_on_website?: boolean
          show_on_pos?: boolean
          invoice_name?: string | null
          taxable?: boolean
          tax_industry?: string | null
          vat_use_default?: boolean
          vat_rate?: number | null
          option1_name?: string | null
          option2_name?: string | null
        }
        Update: {
          id?: string
          kind?: Database["public"]["Enums"]["product_kind"]
          category_id?: string | null
          name?: string
          slug?: string | null
          description?: string | null
          brand_name?: string | null
          base_price?: number | null
          compare_at_price?: number | null
          is_bundle?: boolean
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          excerpt?: string | null
          unit_label?: string | null
          tags?: string[]
          seo_title?: string | null
          seo_description?: string | null
          show_on_website?: boolean
          show_on_pos?: boolean
          invoice_name?: string | null
          taxable?: boolean
          tax_industry?: string | null
          vat_use_default?: boolean
          vat_rate?: number | null
          option1_name?: string | null
          option2_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_series: {
        Row: {
          id: string
          branch_id: string
          court_id: string
          customer_id: string
          iso_dow: number
          starts_at: string
          ends_at: string
          valid_from: string
          valid_until: string
          status: Database["public"]["Enums"]["recurring_status"]
          note: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          branch_id: string
          court_id: string
          customer_id: string
          iso_dow: number
          starts_at: string
          ends_at: string
          valid_from: string
          valid_until: string
          status?: Database["public"]["Enums"]["recurring_status"]
          note?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          branch_id?: string
          court_id?: string
          customer_id?: string
          iso_dow?: number
          starts_at?: string
          ends_at?: string
          valid_from?: string
          valid_until?: string
          status?: Database["public"]["Enums"]["recurring_status"]
          note?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_court_fk"
            columns: ["court_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id", "branch_id"]
          },
          {
            foreignKeyName: "recurring_series_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_lines: {
        Row: {
          id: string
          rental_id: string
          variant_id: string
          quantity: number
          returned_quantity: number
          damaged_quantity: number
          lost_quantity: number
        }
        Insert: {
          id?: string
          rental_id: string
          variant_id: string
          quantity: number
          returned_quantity?: number
          damaged_quantity?: number
          lost_quantity?: number
        }
        Update: {
          id?: string
          rental_id?: string
          variant_id?: string
          quantity?: number
          returned_quantity?: number
          damaged_quantity?: number
          lost_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "rental_lines_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_lines_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_rates: {
        Row: {
          id: string
          product_id: string
          label: string
          duration_minutes: number
          price: number
          is_active: boolean
          usage: Database["public"]["Enums"]["rental_usage"]
          billing: Database["public"]["Enums"]["rental_billing"]
          grace_minutes: number
          overtime_block_minutes: number
          overtime_block_price: number | null
          overtime_cap: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          label: string
          duration_minutes: number
          price: number
          is_active?: boolean
          usage?: Database["public"]["Enums"]["rental_usage"]
          billing?: Database["public"]["Enums"]["rental_billing"]
          grace_minutes?: number
          overtime_block_minutes?: number
          overtime_block_price?: number | null
          overtime_cap?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          label?: string
          duration_minutes?: number
          price?: number
          is_active?: boolean
          usage?: Database["public"]["Enums"]["rental_usage"]
          billing?: Database["public"]["Enums"]["rental_billing"]
          grace_minutes?: number
          overtime_block_minutes?: number
          overtime_block_price?: number | null
          overtime_cap?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_rates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      rentals: {
        Row: {
          id: string
          code: string
          branch_id: string
          customer_id: string
          product_id: string
          rate_label: string
          duration_minutes: number
          unit_price: number
          quantity: number
          rental_fee: number | null
          late_fee: number
          damage_fee: number
          status: Database["public"]["Enums"]["rental_status"]
          starts_at: string
          due_at: string
          returned_at: string | null
          note: string | null
          idempotency_key: string | null
          created_by: string | null
          returned_by: string | null
          created_at: string
          usage: Database["public"]["Enums"]["rental_usage"]
          billing: Database["public"]["Enums"]["rental_billing"]
          booking_id: string | null
          collateral: string | null
          grace_minutes: number
          overtime_block_minutes: number
          overtime_block_price: number
          overtime_cap: number | null
          late_minutes: number | null
          late_fee_auto: number
          late_fee_reason: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          code?: string
          branch_id: string
          customer_id: string
          product_id: string
          rate_label: string
          duration_minutes: number
          unit_price: number
          quantity: number
          rental_fee?: never
          late_fee?: number
          damage_fee?: number
          status?: Database["public"]["Enums"]["rental_status"]
          starts_at?: string
          due_at: string
          returned_at?: string | null
          note?: string | null
          idempotency_key?: string | null
          created_by?: string | null
          returned_by?: string | null
          created_at?: string
          usage?: Database["public"]["Enums"]["rental_usage"]
          billing?: Database["public"]["Enums"]["rental_billing"]
          booking_id?: string | null
          collateral?: string | null
          grace_minutes?: number
          overtime_block_minutes?: number
          overtime_block_price?: number
          overtime_cap?: number | null
          late_minutes?: number | null
          late_fee_auto?: number
          late_fee_reason?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          branch_id?: string
          customer_id?: string
          product_id?: string
          rate_label?: string
          duration_minutes?: number
          unit_price?: number
          quantity?: number
          rental_fee?: never
          late_fee?: number
          damage_fee?: number
          status?: Database["public"]["Enums"]["rental_status"]
          starts_at?: string
          due_at?: string
          returned_at?: string | null
          note?: string | null
          idempotency_key?: string | null
          created_by?: string | null
          returned_by?: string | null
          created_at?: string
          usage?: Database["public"]["Enums"]["rental_usage"]
          billing?: Database["public"]["Enums"]["rental_billing"]
          booking_id?: string | null
          collateral?: string | null
          grace_minutes?: number
          overtime_block_minutes?: number
          overtime_block_price?: number
          overtime_cap?: number | null
          late_minutes?: number | null
          late_fee_auto?: number
          late_fee_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rentals_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_lines: {
        Row: {
          id: string
          sale_id: string
          variant_id: string
          product_name: string
          variant_label: string | null
          quantity: number
          unit_price: number
          line_total: number | null
          tax_method: string | null
          vat_rate: number | null
          vat_amount: number
          pit_rate: number | null
          pit_amount: number
          unit_id: string | null
          unit_name: string | null
          unit_conversion: number
        }
        Insert: {
          id?: string
          sale_id: string
          variant_id: string
          product_name: string
          variant_label?: string | null
          quantity: number
          unit_price: number
          line_total?: never
          tax_method?: string | null
          vat_rate?: number | null
          vat_amount?: number
          pit_rate?: number | null
          pit_amount?: number
          unit_id?: string | null
          unit_name?: string | null
          unit_conversion?: number
        }
        Update: {
          id?: string
          sale_id?: string
          variant_id?: string
          product_name?: string
          variant_label?: string | null
          quantity?: number
          unit_price?: number
          line_total?: never
          tax_method?: string | null
          vat_rate?: number | null
          vat_amount?: number
          pit_rate?: number | null
          pit_amount?: number
          unit_id?: string | null
          unit_name?: string | null
          unit_conversion?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_lines_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_lines_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "product_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_lines_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          id: string
          code: string
          branch_id: string
          customer_id: string | null
          status: Database["public"]["Enums"]["sale_status"]
          subtotal_amount: number
          discount_amount: number
          total_amount: number | null
          note: string | null
          idempotency_key: string | null
          sold_by: string | null
          sold_at: string
          voided_at: string | null
          voided_by: string | null
          void_reason: string | null
        }
        Insert: {
          id?: string
          code?: string
          branch_id: string
          customer_id?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal_amount: number
          discount_amount?: number
          total_amount?: never
          note?: string | null
          idempotency_key?: string | null
          sold_by?: string | null
          sold_at?: string
          voided_at?: string | null
          voided_by?: string | null
          void_reason?: string | null
        }
        Update: {
          id?: string
          code?: string
          branch_id?: string
          customer_id?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal_amount?: number
          discount_amount?: number
          total_amount?: never
          note?: string | null
          idempotency_key?: string | null
          sold_by?: string | null
          sold_at?: string
          voided_at?: string | null
          voided_by?: string | null
          void_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_overtime: {
        Row: {
          id: string
          shift_id: string
          employee_id: string
          branch_id: string
          minutes: number
          hourly_rate: number
          reason: string
          status: string
          consent: string | null
          requested_by: string | null
          requested_at: string
          responded_by: string | null
          responded_at: string | null
          response_note: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          shift_id: string
          employee_id: string
          branch_id: string
          minutes: number
          hourly_rate: number
          reason: string
          status?: string
          consent?: string | null
          requested_by?: string | null
          requested_at?: string
          responded_by?: string | null
          responded_at?: string | null
          response_note?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          shift_id?: string
          employee_id?: string
          branch_id?: string
          minutes?: number
          hourly_rate?: number
          reason?: string
          status?: string
          consent?: string | null
          requested_by?: string | null
          requested_at?: string
          responded_by?: string | null
          responded_at?: string | null
          response_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_overtime_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_overtime_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          id: string
          employee_id: string
          branch_id: string
          work_date: string
          scheduled_start: string
          scheduled_end: string
          scheduled_range: string | null
          break_minutes: number
          status: Database["public"]["Enums"]["attendance_status"]
          checked_in_at: string | null
          checked_out_at: string | null
          actual_break_minutes: number
          paid_minutes: number
          scanned_in_at: string | null
          scanned_out_at: string | null
          in_source: string | null
          out_source: string | null
          actual_time_decision: string | null
          note: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          employee_id: string
          branch_id: string
          work_date: string
          scheduled_start: string
          scheduled_end: string
          scheduled_range?: never
          break_minutes?: number
          status?: Database["public"]["Enums"]["attendance_status"]
          checked_in_at?: string | null
          checked_out_at?: string | null
          actual_break_minutes?: number
          paid_minutes?: number
          scanned_in_at?: string | null
          scanned_out_at?: string | null
          in_source?: string | null
          out_source?: string | null
          actual_time_decision?: string | null
          note?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          employee_id?: string
          branch_id?: string
          work_date?: string
          scheduled_start?: string
          scheduled_end?: string
          scheduled_range?: never
          break_minutes?: number
          status?: Database["public"]["Enums"]["attendance_status"]
          checked_in_at?: string | null
          checked_out_at?: string | null
          actual_break_minutes?: number
          paid_minutes?: number
          scanned_in_at?: string | null
          scanned_out_at?: string | null
          in_source?: string | null
          out_source?: string | null
          actual_time_decision?: string | null
          note?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_accounts: {
        Row: {
          user_id: string
          role: Database["public"]["Enums"]["app_role"]
          employee_id: string | null
          display_name: string
          login_phone: string | null
          is_active: boolean
          must_change_password: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          role?: Database["public"]["Enums"]["app_role"]
          employee_id?: string | null
          display_name: string
          login_phone?: string | null
          is_active?: boolean
          must_change_password?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          employee_id?: string | null
          display_name?: string
          login_phone?: string | null
          is_active?: boolean
          must_change_password?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_accounts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_branch_permissions: {
        Row: {
          user_id: string
          branch_id: string
          permission: Database["public"]["Enums"]["app_permission"]
          granted_by: string | null
          granted_at: string
        }
        Insert: {
          user_id: string
          branch_id: string
          permission: Database["public"]["Enums"]["app_permission"]
          granted_by?: string | null
          granted_at?: string
        }
        Update: {
          user_id?: string
          branch_id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          granted_by?: string | null
          granted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_branch_permissions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_branch_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["user_id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          id: number
          branch_id: string
          variant_id: string
          quantity_delta: number
          balance_after: number
          reason: Database["public"]["Enums"]["stock_reason"]
          sale_line_id: string | null
          rental_line_id: string | null
          note: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: never
          branch_id: string
          variant_id: string
          quantity_delta: number
          balance_after?: number
          reason: Database["public"]["Enums"]["stock_reason"]
          sale_line_id?: string | null
          rental_line_id?: string | null
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: never
          branch_id?: string
          variant_id?: string
          quantity_delta?: number
          balance_after?: number
          reason?: Database["public"]["Enums"]["stock_reason"]
          sale_line_id?: string | null
          rental_line_id?: string | null
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_level_fk"
            columns: ["branch_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "inventory_levels"
            referencedColumns: ["branch_id", "variant_id"]
          },
          {
            foreignKeyName: "stock_movements_rental_line_id_fkey"
            columns: ["rental_line_id"]
            isOneToOne: false
            referencedRelation: "rental_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_sale_line_id_fkey"
            columns: ["sale_line_id"]
            isOneToOne: false
            referencedRelation: "sale_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          id: string
          code: string
          version: number
          title: string
          summary: string | null
          body: string
          change_note: string | null
          effective_at: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          version: number
          title: string
          summary?: string | null
          body: string
          change_note?: string | null
          effective_at?: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          version?: number
          title?: string
          summary?: string | null
          body?: string
          change_note?: string | null
          effective_at?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      privacy_consents: {
        Row: {
          id: string
          customer_id: string | null
          auth_user_id: string | null
          booking_id: string | null
          purpose: string
          granted: boolean
          privacy_doc_id: string | null
          terms_doc_id: string | null
          source: string
          wording: string
          ip_hash: string | null
          user_agent: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          customer_id?: string | null
          auth_user_id?: string | null
          booking_id?: string | null
          purpose: string
          granted: boolean
          privacy_doc_id?: string | null
          terms_doc_id?: string | null
          source: string
          wording: string
          ip_hash?: string | null
          user_agent?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          customer_id?: string | null
          auth_user_id?: string | null
          booking_id?: string | null
          purpose?: string
          granted?: boolean
          privacy_doc_id?: string | null
          terms_doc_id?: string | null
          source?: string
          wording?: string
          ip_hash?: string | null
          user_agent?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: 'privacy_consents_privacy_doc_id_fkey'; columns: ['privacy_doc_id']; isOneToOne: false; referencedRelation: 'legal_documents'; referencedColumns: ['id'] },
          { foreignKeyName: 'privacy_consents_terms_doc_id_fkey'; columns: ['terms_doc_id']; isOneToOne: false; referencedRelation: 'legal_documents'; referencedColumns: ['id'] },
          { foreignKeyName: 'privacy_consents_booking_id_fkey'; columns: ['booking_id']; isOneToOne: false; referencedRelation: 'bookings'; referencedColumns: ['id'] },
          { foreignKeyName: 'privacy_consents_customer_id_fkey'; columns: ['customer_id']; isOneToOne: false; referencedRelation: 'customers'; referencedColumns: ['id'] },
        ]
      }
      data_subject_requests: {
        Row: {
          id: string
          code: string
          kind: string
          status: string
          requester_name: string
          phone: string | null
          email: string | null
          auth_user_id: string | null
          customer_id: string | null
          booking_code: string | null
          verified: boolean
          verification_note: string | null
          details: string
          channel: string
          received_at: string
          ack_due_at: string
          due_at: string
          extended_due_at: string | null
          extension_reason: string | null
          acknowledged_at: string | null
          resolved_at: string | null
          resolution_note: string | null
          handled_by: string | null
          ip_hash: string | null
          redacted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code?: string
          kind: string
          status?: string
          requester_name: string
          phone?: string | null
          email?: string | null
          auth_user_id?: string | null
          customer_id?: string | null
          booking_code?: string | null
          verified?: boolean
          verification_note?: string | null
          details: string
          channel?: string
          received_at?: string
          ack_due_at: string
          due_at: string
          extended_due_at?: string | null
          extension_reason?: string | null
          acknowledged_at?: string | null
          resolved_at?: string | null
          resolution_note?: string | null
          handled_by?: string | null
          ip_hash?: string | null
          redacted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          kind?: string
          status?: string
          requester_name?: string
          phone?: string | null
          email?: string | null
          auth_user_id?: string | null
          customer_id?: string | null
          booking_code?: string | null
          verified?: boolean
          verification_note?: string | null
          details?: string
          channel?: string
          received_at?: string
          ack_due_at?: string
          due_at?: string
          extended_due_at?: string | null
          extension_reason?: string | null
          acknowledged_at?: string | null
          resolved_at?: string | null
          resolution_note?: string | null
          handled_by?: string | null
          ip_hash?: string | null
          redacted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'data_subject_requests_customer_id_fkey'; columns: ['customer_id']; isOneToOne: false; referencedRelation: 'customers'; referencedColumns: ['id'] },
        ]
      }
      data_retention_policies: {
        Row: {
          code: string
          label: string
          data_scope: string
          retention_days: number
          action: string
          basis: string
          is_automatic: boolean
          sort_order: number
          last_run_at: string | null
          last_run_count: number | null
          updated_at: string
        }
        Insert: {
          code: string
          label: string
          data_scope: string
          retention_days: number
          action: string
          basis: string
          is_automatic?: boolean
          sort_order?: number
          last_run_at?: string | null
          last_run_count?: number | null
          updated_at?: string
        }
        Update: {
          code?: string
          label?: string
          data_scope?: string
          retention_days?: number
          action?: string
          basis?: string
          is_automatic?: boolean
          sort_order?: number
          last_run_at?: string | null
          last_run_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_webhook_events: {
        Row: {
          id: number
          provider: string
          received_at: string
          auth_result: string
          auth_method: string | null
          provider_txn_id: string | null
          http_status: number
          outcome: string | null
          body_sha256: string | null
          payload: Json | null
          ip_hash: string | null
        }
        Insert: {
          id?: number
          provider?: string
          received_at?: string
          auth_result: string
          auth_method?: string | null
          provider_txn_id?: string | null
          http_status: number
          outcome?: string | null
          body_sha256?: string | null
          payload?: Json | null
          ip_hash?: string | null
        }
        Update: {
          id?: number
          provider?: string
          received_at?: string
          auth_result?: string
          auth_method?: string | null
          provider_txn_id?: string | null
          http_status?: number
          outcome?: string | null
          body_sha256?: string | null
          payload?: Json | null
          ip_hash?: string | null
        }
        Relationships: []
      }
      security_settings: {
        Row: {
          id: boolean
          online_booking_paused: boolean
          pause_message: string | null
          paused_at: string | null
          require_owner_mfa: boolean
          require_staff_mfa: boolean
          client_max_active_holds: number
          client_max_holds_per_hour: number
          client_max_phones_per_day: number
          abandon_window_days: number
          phone_elevated_after: number
          phone_block_after: number
          elevated_hold_minutes: number
          hold_cap_per_court: number
          hold_cap_min: number
          login_max_failures: number
          login_lock_minutes: number
          login_ip_max_failures: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          online_booking_paused?: boolean
          pause_message?: string | null
          paused_at?: string | null
          require_owner_mfa?: boolean
          require_staff_mfa?: boolean
          client_max_active_holds?: number
          client_max_holds_per_hour?: number
          client_max_phones_per_day?: number
          abandon_window_days?: number
          phone_elevated_after?: number
          phone_block_after?: number
          elevated_hold_minutes?: number
          hold_cap_per_court?: number
          hold_cap_min?: number
          login_max_failures?: number
          login_lock_minutes?: number
          login_ip_max_failures?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          online_booking_paused?: boolean
          pause_message?: string | null
          paused_at?: string | null
          require_owner_mfa?: boolean
          require_staff_mfa?: boolean
          client_max_active_holds?: number
          client_max_holds_per_hour?: number
          client_max_phones_per_day?: number
          abandon_window_days?: number
          phone_elevated_after?: number
          phone_block_after?: number
          elevated_hold_minutes?: number
          hold_cap_per_court?: number
          hold_cap_min?: number
          login_max_failures?: number
          login_lock_minutes?: number
          login_ip_max_failures?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      security_events: {
        Row: {
          id: string
          kind: string
          severity: string
          branch_id: string | null
          subject: string | null
          subject_key: string | null
          occurrences: number
          details: Json
          first_seen_at: string
          last_seen_at: string
          alerted_at: string | null
          acknowledged_at: string | null
          acknowledged_by: string | null
        }
        Insert: {
          id?: string
          kind: string
          severity: string
          branch_id?: string | null
          subject?: string | null
          subject_key?: string | null
          occurrences?: number
          details?: Json
          first_seen_at?: string
          last_seen_at?: string
          alerted_at?: string | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
        }
        Update: {
          id?: string
          kind?: string
          severity?: string
          branch_id?: string | null
          subject?: string | null
          subject_key?: string | null
          occurrences?: number
          details?: Json
          first_seen_at?: string
          last_seen_at?: string
          alerted_at?: string | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'security_events_branch_id_fkey'
            columns: ['branch_id']
            isOneToOne: false
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
        ]
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth_secret: string
          device_label: string | null
          created_at: string
          last_seen_at: string
          last_sent_at: string | null
          failed_count: number
          last_error: string | null
          disabled_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          p256dh: string
          auth_secret: string
          device_label?: string | null
          created_at?: string
          last_seen_at?: string
          last_sent_at?: string | null
          failed_count?: number
          last_error?: string | null
          disabled_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          p256dh?: string
          auth_secret?: string
          device_label?: string | null
          created_at?: string
          last_seen_at?: string
          last_sent_at?: string | null
          failed_count?: number
          last_error?: string | null
          disabled_at?: string | null
        }
        Relationships: []
      }
      cash_drawer_events: {
        Row: {
          id: number
          occurred_at: string
          branch_id: string
          user_id: string | null
          trigger: string
          ref_code: string | null
          device_label: string | null
        }
        Insert: {
          id?: never
          occurred_at?: string
          branch_id: string
          user_id?: string | null
          trigger: string
          ref_code?: string | null
          device_label?: string | null
        }
        Update: {
          id?: never
          occurred_at?: string
          branch_id?: string
          user_id?: string | null
          trigger?: string
          ref_code?: string | null
          device_label?: string | null
        }
        Relationships: []
      }
      push_preferences: {
        Row: {
          user_id: string
          booking_new: boolean
          deposit_paid: boolean
          payment_review: boolean
          security: boolean
          updated_at: string
        }
        Insert: {
          user_id: string
          booking_new?: boolean
          deposit_paid?: boolean
          payment_review?: boolean
          security?: boolean
          updated_at?: string
        }
        Update: {
          user_id?: string
          booking_new?: boolean
          deposit_paid?: boolean
          payment_review?: boolean
          security?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      customer_hold_policies: {
        Row: {
          customer_id: string
          policy: string
          note: string
          until_at: string | null
          set_by: string | null
          updated_at: string
        }
        Insert: {
          customer_id: string
          policy: string
          note: string
          until_at?: string | null
          set_by?: string | null
          updated_at?: string
        }
        Update: {
          customer_id?: string
          policy?: string
          note?: string
          until_at?: string | null
          set_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      booking_balances: {
        Row: {
          booking_id: string | null
          branch_id: string | null
          total_amount: number | null
          deposit_amount: number | null
          paid_amount: number | null
          refunded_amount: number | null
          balance_due: number | null
        }
        Relationships: [
        ]
      }
    }
    Functions: {
      anonymize_customer: { Args: { p_customer_id: string; p_reason?: string | null; p_request_id?: string | null }; Returns: Json }
      apply_retention: { Args: { p_dry_run?: boolean }; Returns: Json }
      create_guest_booking_hold_v2: {
        Args: {
          p_contact_name: string
          p_court_id: string
          p_customer_note: string | null
          p_ends_at: string
          p_idempotency_key: string
          p_ip_hash: string | null
          p_marketing: boolean
          p_marketing_wording: string | null
          p_phone: string
          p_starts_at: string
          p_terms_wording: string
          p_user_agent: string | null
        }
        Returns: Json
      }
      customer_data_export: { Args: { p_customer_id: string; p_request_id?: string | null }; Returns: Json }
      data_request_counts: { Args: never; Returns: Json }
      member_set_marketing: { Args: { p_granted: boolean; p_user_agent?: string | null; p_wording: string }; Returns: Json }
      my_data_export: { Args: never; Returns: Json }
      publish_legal_document: {
        Args: {
          p_body: string
          p_change_note: string
          p_code: string
          p_effective_at?: string | null
          p_summary: string | null
          p_title: string
        }
        Returns: Json
      }
      service_apply_retention: { Args: never; Returns: Json }
      service_log_webhook_event: {
        Args: {
          p_auth_method: string | null
          p_auth_result: string
          p_body_sha256: string | null
          p_http_status: number
          p_ip_hash: string | null
          p_outcome: string | null
          p_payload: Json | null
          p_provider: string
          p_txn_id: string | null
        }
        Returns: undefined
      }
      register_push_subscription: {
        Args: { p_auth: string; p_endpoint: string; p_label?: string | null; p_p256dh: string }
        Returns: string
      }
      unregister_push_subscription: { Args: { p_endpoint: string }; Returns: undefined }
      save_push_preferences: {
        Args: { p_booking_new: boolean; p_deposit_paid: boolean; p_payment_review: boolean; p_security: boolean }
        Returns: undefined
      }
      send_test_push: { Args: never; Returns: number }
      log_cash_drawer_open: {
        Args: { p_branch_id: string; p_trigger: string; p_ref_code?: string | null; p_device?: string | null }
        Returns: number
      }
      service_claim_push: { Args: { p_limit?: number }; Returns: Json }
      service_push_done: { Args: { p_outbox_ids: number[]; p_results: Json }; Returns: undefined }
      service_push_maintenance: { Args: never; Returns: Json }
      acknowledge_security_event: { Args: { p_event_id: string }; Returns: undefined }
      acknowledge_all_security_events: { Args: never; Returns: number }
      service_record_security_event: {
        Args: { p_details?: Json; p_kind: string; p_severity: string; p_subject: string | null; p_subject_key: string | null }
        Returns: string
      }
      set_customer_hold_policy: {
        Args: { p_customer_id: string; p_note: string | null; p_policy: string; p_until?: string | null }
        Returns: Json
      }
      customer_hold_status: { Args: { p_customer_id: string }; Returns: Json }
      restricted_customers: { Args: never; Returns: Json }
      service_note_hold_rejection: {
        Args: { p_code: string; p_court_id: string; p_ip_hash: string | null; p_phone: string }
        Returns: undefined
      }
      online_booking_status: { Args: never; Returns: Json }
      service_login_check: { Args: { p_ip_hash: string | null; p_login: string; p_scope: string }; Returns: number }
      service_login_record: {
        Args: { p_ip_hash: string | null; p_login: string; p_scope: string; p_success: boolean }
        Returns: undefined
      }
      update_security_settings: {
        Args: { p: Json }
        Returns: Database['public']['Tables']['security_settings']['Row']
      }
      service_pending_security_alerts: { Args: { p_limit?: number }; Returns: Json }
      service_mark_security_alerted: { Args: { p_ids: string[] }; Returns: number }
      service_security_maintenance: { Args: never; Returns: Json }
      service_record_member_consents: {
        Args: {
          p_ip_hash: string | null
          p_marketing: boolean
          p_marketing_wording: string | null
          p_terms_wording: string
          p_user_agent: string | null
          p_user_id: string
        }
        Returns: undefined
      }
      service_submit_data_request: {
        Args: {
          p_booking_code: string | null
          p_details: string
          p_email: string | null
          p_ip_hash: string | null
          p_kind: string
          p_name: string
          p_phone: string | null
          p_user_id: string | null
        }
        Returns: Json
      }
      update_data_request: {
        Args: { p_extension_reason?: string | null; p_id: string; p_note?: string | null; p_status: string; p_verified?: boolean | null }
        Returns: Json
      }
      update_retention_policy: { Args: { p_automatic: boolean; p_code: string; p_days: number }; Returns: undefined }
      reveal_guest_booking: {
        Args: {
          p_booking_id: string
          p_client?: string
          p_name: string
          p_phone: string
        }
        Returns: Json
      }
      service_register_member: {
        Args: {
          p_user_id: string
          p_full_name: string
          p_phone: string | null
          p_login_kind: Database["public"]["Enums"]["member_login_kind"]
        }
        Returns: Json
      }
      service_member_phone_taken: {
        Args: { p_phone: string }
        Returns: boolean
      }
      resolve_member_login: {
        Args: { p_login: string }
        Returns: string | null
      }
      service_attach_member_booking: {
        Args: { p_booking_id: string; p_user_id: string }
        Returns: boolean
      }
      service_set_member_password_flag: {
        Args: { p_user_id: string; p_must_change: boolean }
        Returns: undefined
      }
      ensure_member_profile: {
        Args: never
        Returns: Json
      }
      my_member_profile: {
        Args: never
        Returns: Json
      }
      update_my_member_profile: {
        Args: { p_full_name: string; p_phone: string | null; p_marketing_opt_in?: boolean }
        Returns: Json
      }
      my_member_bookings: {
        Args: { p_limit?: number }
        Returns: Json
      }
      my_member_booking: {
        Args: { p_code: string }
        Returns: Json
      }
      member_claim_booking: {
        Args: { p_code: string; p_phone: string }
        Returns: Json
      }
      member_cancel_booking: {
        Args: { p_code: string }
        Returns: Json
      }
      admin_list_members: {
        Args: { p_query?: string | null; p_filter?: string; p_limit?: number; p_offset?: number }
        Returns: Json
      }
      admin_get_member: {
        Args: { p_user_id: string }
        Returns: Json
      }
      admin_update_member: {
        Args: { p_user_id: string; p_full_name: string; p_phone: string | null; p_staff_note?: string | null }
        Returns: Json
      }
      admin_adjust_member_points: {
        Args: { p_user_id: string; p_delta: number; p_reason: string }
        Returns: Json
      }
      admin_set_member_locked: {
        Args: { p_user_id: string; p_locked: boolean }
        Returns: Json
      }
      adjust_stock: {
        Args: {
          p_branch_id: string
          p_variant_id: string
          p_quantity_delta: number
          p_reason: Database["public"]["Enums"]["stock_reason"]
          p_note: string
        }
        Returns: Json
      }
      branch_publish_checklist: {
        Args: {
          p_branch_id: string
        }
        Returns: string[]
      }
      cancel_booking: {
        Args: {
          p_booking_id: string
          p_reason: string
          p_waive_policy?: boolean
        }
        Returns: Json
      }
      cancel_guest_booking: {
        Args: {
          p_code: string
          p_phone: string
          p_reason?: string
        }
        Returns: Json
      }
      check_in_booking: {
        Args: {
          p_booking_id: string
        }
        Returns: Json
      }
      checkout_rental: {
        Args: {
          p_branch_id: string
          p_product_id: string
          p_rate_id: string
          p_quantity: number
          p_customer_phone: string
          p_customer_name: string
          p_variant_id?: string
          p_collect_payment?: boolean
          p_payment_method?: Database["public"]["Enums"]["payment_method"]
          p_payment_reference?: string
          p_note?: string
          p_idempotency_key?: string
          p_booking_id?: string
          p_collateral?: string
        }
        Returns: Json
      }
      close_payroll_month: {
        Args: {
          p_month: string
        }
        Returns: string
      }
      complete_finished_bookings: {
        Args: never
        Returns: number
      }
      confirm_booking: {
        Args: {
          p_booking_id: string
        }
        Returns: Json
      }
      create_counter_booking: {
        Args: {
          p_court_id: string
          p_starts_at: string
          p_ends_at: string
          p_phone: string
          p_contact_name: string
          p_internal_note?: string
          p_discount_amount?: number
          p_hold_only?: boolean
          p_idempotency_key?: string
        }
        Returns: Json
      }
      create_court_block: {
        Args: {
          p_court_id: string
          p_starts_at: string
          p_ends_at: string
          p_reason: string
        }
        Returns: Json
      }
      create_guest_booking_hold: {
        Args: {
          p_court_id: string
          p_starts_at: string
          p_ends_at: string
          p_contact_name: string
          p_phone: string
          p_customer_note?: string
          p_idempotency_key?: string
        }
        Returns: Json
      }
      create_product: {
        Args: {
          p_kind: Database["public"]["Enums"]["product_kind"]
          p_name: string
          p_sku: string
          p_category_id?: string
          p_base_price?: number
          p_description?: string
          p_brand_name?: string
          p_is_bundle?: boolean
        }
        Returns: string
      }
      create_product_full: {
        Args: {
          p: Json
        }
        Returns: string
      }
      expire_stale_holds: {
        Args: never
        Returns: number
      }
      get_branch_busy_slots: {
        Args: {
          p_branch_id: string
          p_from: string
          p_to: string
        }
        Returns: {
          court_id: string
          starts_at: string
          ends_at: string
        }[]
      }
      get_variant_costs: {
        Args: {
          p_product_id: string
        }
        Returns: {
          variant_id: string
          cost_price: number
        }[]
      }
      issue_attendance_qr: {
        Args: {
          p_branch_id: string
          p_token_hash: string
        }
        Returns: Json
      }
      list_catalog: {
        Args: {
          p_kind: Database["public"]["Enums"]["product_kind"]
          p_category_slug?: string
          p_branch_id?: string
          p_search?: string
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          id: string
          name: string
          slug: string
          kind: Database["public"]["Enums"]["product_kind"]
          is_bundle: boolean
          brand_name: string
          description: string
          category_name: string
          category_slug: string
          min_price: number
          max_price: number
          compare_at_price: number
          cover_path: string
          available_quantity: number
          total_count: number
        }[]
      }
      list_published_branches: {
        Args: never
        Returns: {
          id: string
          slug: string
          name: string
          address_line: string
          district: string
          city: string
          opens_at: string
          closes_at: string
          cover_image_path: string
          active_court_count: number
          min_price_per_hour: number
        }[]
      }
      admin_dashboard: {
        Args: {
          p_branch_id?: string
          p_days?: number
        }
        Returns: Json
      }
      dismiss_bank_transaction: {
        Args: {
          p_note: string
          p_txn_id: string
        }
        Returns: Json
      }
      match_bank_transaction: {
        Args: {
          p_booking_code: string
          p_txn_id: string
        }
        Returns: Json
      }
      service_alert_recipients: {
        Args: never
        Returns: string[]
      }
      service_pending_alerts: {
        Args: {
          p_limit?: number
        }
        Returns: Json
      }
      service_mark_alerted: {
        Args: {
          p_ids: string[]
        }
        Returns: number
      }
      service_bank_accounts: {
        Args: never
        Returns: string[]
      }
      service_reconcile_start: {
        Args: {
          p_source: string
        }
        Returns: Json
      }
      service_reconcile_finish: {
        Args: {
          p_run_id: string
          p_fetched: number
          p_new: number
          p_error?: string | null
        }
        Returns: undefined
      }
      record_sepay_transaction: {
        Args: {
          p_payload: Json
        }
        Returns: Json
      }
      lookup_guest_booking: {
        Args: {
          p_code: string
          p_phone: string
        }
        Returns: Json
      }
      lookup_guest_bookings_by_phone: {
        Args: {
          p_client?: string
          p_phone: string
        }
        Returns: Json
      }
      mark_booking_no_show: {
        Args: {
          p_booking_id: string
          p_reason?: string
        }
        Returns: Json
      }
      my_staff_context: {
        Args: never
        Returns: Json
      }
      owner_adjust_attendance: {
        Args: {
          p_shift_id: string
          p_status: Database["public"]["Enums"]["attendance_status"]
          p_reason: string
          p_checked_in_at?: string
          p_checked_out_at?: string
          p_actual_break_minutes?: number
        }
        Returns: Json
      }
      court_extend_options: {
        Args: {
          p_booking_id: string
        }
        Returns: Json
      }
      extend_booking: {
        Args: {
          p_booking_id: string
          p_new_end: string
          p_note?: string | null
        }
        Returns: Json
      }
      attendance_review_counts: { Args: never; Returns: Json }
      attendance_review_queue: { Args: never; Returns: Json }
      cancel_attendance_fix: { Args: { p_request_id: string }; Returns: undefined }
      close_forgotten_shifts: { Args: never; Returns: Json }
      create_attendance_kiosk: { Args: { p_branch_id: string; p_name: string; p_token_hash: string }; Returns: string }
      decide_actual_time: { Args: { p_decision: string | null; p_reason: string; p_shift_id: string }; Returns: Json }
      decide_attendance_fix: { Args: { p_approve: boolean; p_note?: string | null; p_request_id: string }; Returns: Json }
      kiosk_issue_qr: { Args: { p_device_token: string; p_token_hash: string }; Returns: Json }
      request_attendance_fix: {
        Args: { p_claimed_at: string; p_kind: string; p_reason: string; p_shift_id: string }
        Returns: Json
      }
      revoke_attendance_kiosk: { Args: { p_kiosk_id: string }; Returns: undefined }
      service_close_forgotten_shifts: { Args: never; Returns: Json }
      update_attendance_settings: {
        Args: {
          p_auto_close_forgotten: boolean
          p_fix_request_hours: number
          p_forgot_warn_count: number
          p_late_grace_minutes: number
          p_late_out_review_minutes: number
          p_qr_ttl_seconds: number
        }
        Returns: Json
      }
      shift_people: {
        Args: {
          p_branch_id: string
          p_from: string
          p_to: string
        }
        Returns: {
          employee_id: string
          code: string
          full_name: string
        }[]
      }
      my_month_summary: {
        Args: {
          p_month: string
        }
        Returns: Json
      }
      sale_transfer_status: {
        Args: {
          p_sale_id: string
        }
        Returns: Json
      }
      settle_pending_sale: {
        Args: {
          p_sale_id: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_reference?: string | null
          p_idempotency_key?: string | null
        }
        Returns: Json
      }
      cancel_pending_sale: {
        Args: {
          p_sale_id: string
          p_reason: string
        }
        Returns: Json
      }
      offer_overtime: {
        Args: {
          p_shift_id: string
          p_minutes: number
          p_hourly_rate: number
          p_reason: string
          p_agreed_in_person?: boolean
        }
        Returns: Json
      }
      respond_overtime: {
        Args: {
          p_offer_id: string
          p_accept: boolean
          p_note?: string | null
        }
        Returns: Json
      }
      cancel_overtime: {
        Args: {
          p_offer_id: string
          p_reason: string
        }
        Returns: Json
      }
      preview_payroll_month: {
        Args: {
          p_month: string
        }
        Returns: {
          employee_id: string
          employee_code: string
          employee_name: string
          shifts_count: number
          paid_minutes: number
          base_pay: number
          adjustments_total: number
          net_pay: number
          unresolved_shifts: number
          missing_rate_shifts: number
          overtime_minutes: number
          overtime_pay: number
          pending_overtime: number
        }[]
      }
      quote_booking: {
        Args: {
          p_court_id: string
          p_starts_at: string
          p_ends_at: string
        }
        Returns: Json
      }
      record_booking_payment: {
        Args: {
          p_booking_id: string
          p_amount: number
          p_method: Database["public"]["Enums"]["payment_method"]
          p_reference?: string
          p_note?: string
          p_idempotency_key?: string
        }
        Returns: Json
      }
      record_booking_refund: {
        Args: {
          p_booking_id: string
          p_amount: number
          p_method: Database["public"]["Enums"]["payment_method"]
          p_reason: string
          p_reference?: string
          p_idempotency_key?: string
        }
        Returns: Json
      }
      record_rental_payment: {
        Args: {
          p_rental_id: string
          p_amount: number
          p_method: Database["public"]["Enums"]["payment_method"]
          p_reference?: string
          p_note?: string
          p_idempotency_key?: string
        }
        Returns: Json
      }
      record_sale: {
        Args: {
          p_branch_id: string
          p_lines: Json
          p_payment_method: Database["public"]["Enums"]["payment_method"]
          p_payment_reference?: string
          p_discount_amount?: number
          p_customer_phone?: string
          p_customer_name?: string
          p_note?: string
          p_idempotency_key?: string
        }
        Returns: Json
      }
      record_stock_count: {
        Args: {
          p_branch_id: string
          p_variant_id: string
          p_counted_quantity: number
          p_note: string
        }
        Returns: Json
      }
      reschedule_booking: {
        Args: {
          p_booking_id: string
          p_court_id: string
          p_starts_at: string
          p_ends_at: string
          p_reason: string
        }
        Returns: Json
      }
      resolve_staff_login: {
        Args: {
          p_login: string
        }
        Returns: string
      }
      return_rental: {
        Args: {
          p_rental_id: string
          p_lines?: Json
          p_late_fee?: number
          p_damage_fee?: number
          p_note?: string
          p_late_fee_reason?: string
        }
        Returns: Json
      }
      rental_overtime_preview: {
        Args: {
          p_rental_id: string
          p_at?: string
        }
        Returns: Json
      }
      scan_attendance_qr: {
        Args: {
          p_token: string
          p_event: string
        }
        Returns: Json
      }
      service_mark_password_changed: {
        Args: {
          p_user_id: string
        }
        Returns: undefined
      }
      set_staff_permissions: {
        Args: {
          p_user_id: string
          p_branch_id: string
          p_permissions: Database["public"]["Enums"]["app_permission"][]
        }
        Returns: Database["public"]["Enums"]["app_permission"][]
      }
      update_product_full: {
        Args: {
          p_id: string
          p: Json
        }
        Returns: undefined
      }
      void_payment: {
        Args: {
          p_payment_id: string
          p_reason: string
        }
        Returns: Json
      }
      void_sale: {
        Args: {
          p_sale_id: string
          p_reason: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_permission: "booking.view" | "booking.confirm" | "booking.operate" | "payment.record" | "catalog.view" | "catalog.edit" | "inventory.adjust" | "sale.record" | "rental.operate" | "shift.view_branch"
      app_role: "owner" | "staff"
      attendance_status: "scheduled" | "present" | "absent" | "leave" | "cancelled"
      booking_kind: "customer" | "block"
      booking_source: "online" | "counter" | "recurring" | "system"
      booking_status: "held" | "confirmed" | "checked_in" | "completed" | "cancelled" | "expired" | "no_show"
      branch_status: "draft" | "published" | "paused" | "archived"
      court_status: "active" | "maintenance" | "retired"
      employee_status: "active" | "inactive"
      employment_type: "full_time" | "part_time"
      member_login_kind: "phone" | "email" | "google"
      member_tier: "member" | "silver" | "gold" | "diamond"
      pay_type: "hourly" | "daily"
      payment_kind: "charge" | "refund"
      payment_method: "cash" | "bank_transfer" | "card" | "e_wallet" | "gateway"
      payment_status: "pending" | "succeeded" | "failed" | "voided"
      product_kind: "sale" | "rental"
      recurring_status: "active" | "ended" | "cancelled"
      rental_billing: "duration" | "session"
      rental_status: "out" | "returned" | "voided"
      rental_usage: "on_site" | "take_out"
      sale_status: "completed" | "voided"
      stock_reason: "opening" | "purchase" | "sale" | "sale_void" | "rental_out" | "rental_return" | "adjustment" | "damage" | "loss" | "count_correction"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
export type RpcArgs<T extends keyof PublicSchema["Functions"]> = PublicSchema["Functions"][T]["Args"]
export type RpcReturns<T extends keyof PublicSchema["Functions"]> = PublicSchema["Functions"][T]["Returns"]

export const Constants = {
  public: {
    Enums: {
      app_permission: ["booking.view", "booking.confirm", "booking.operate", "payment.record", "catalog.view", "catalog.edit", "inventory.adjust", "sale.record", "rental.operate", "shift.view_branch"],
      app_role: ["owner", "staff"],
      attendance_status: ["scheduled", "present", "absent", "leave", "cancelled"],
      booking_kind: ["customer", "block"],
      booking_source: ["online", "counter", "recurring", "system"],
      booking_status: ["held", "confirmed", "checked_in", "completed", "cancelled", "expired", "no_show"],
      branch_status: ["draft", "published", "paused", "archived"],
      court_status: ["active", "maintenance", "retired"],
      employee_status: ["active", "inactive"],
      employment_type: ["full_time", "part_time"],
      member_login_kind: ["phone", "email", "google"],
      member_tier: ["member", "silver", "gold", "diamond"],
      pay_type: ["hourly", "daily"],
      payment_kind: ["charge", "refund"],
      payment_method: ["cash", "bank_transfer", "card", "e_wallet", "gateway"],
      payment_status: ["pending", "succeeded", "failed", "voided"],
      product_kind: ["sale", "rental"],
      recurring_status: ["active", "ended", "cancelled"],
      rental_billing: ["duration", "session"],
      rental_status: ["out", "returned", "voided"],
      rental_usage: ["on_site", "take_out"],
      sale_status: ["completed", "voided"],
      stock_reason: ["opening", "purchase", "sale", "sale_void", "rental_out", "rental_return", "adjustment", "damage", "loss", "count_correction"],
    },
  },
} as const

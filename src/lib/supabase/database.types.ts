export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      calendar_event_crew: {
        Row: {
          calendar_event_id: string;
          company_id: string;
          created_at: string;
          is_seed: boolean;
          position: number;
          staff_id: string;
        };
        Insert: {
          calendar_event_id: string;
          company_id?: string;
          created_at?: string;
          is_seed?: boolean;
          position?: number;
          staff_id: string;
        };
        Update: {
          calendar_event_id?: string;
          company_id?: string;
          created_at?: string;
          is_seed?: boolean;
          position?: number;
          staff_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_event_crew_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calendar_event_crew_event_fkey";
            columns: ["company_id", "calendar_event_id"];
            isOneToOne: false;
            referencedRelation: "calendar_events";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "calendar_event_crew_staff_fkey";
            columns: ["company_id", "staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      calendar_events: {
        Row: {
          address_line: string | null;
          all_day: boolean;
          client_id: string | null;
          code: string;
          company_id: string;
          created_at: string;
          ends_at: string | null;
          entity_type: string;
          estimator_id: string | null;
          id: string;
          is_seed: boolean;
          notes: string | null;
          series_id: string | null;
          starts_at: string;
          status: string | null;
          storage_agreement_id: string | null;
          title: string;
          updated_at: string;
          warehouse_location_id: string | null;
        };
        Insert: {
          address_line?: string | null;
          all_day?: boolean;
          client_id?: string | null;
          code: string;
          company_id?: string;
          created_at?: string;
          ends_at?: string | null;
          entity_type: string;
          estimator_id?: string | null;
          id?: string;
          is_seed?: boolean;
          notes?: string | null;
          series_id?: string | null;
          starts_at: string;
          status?: string | null;
          storage_agreement_id?: string | null;
          title: string;
          updated_at?: string;
          warehouse_location_id?: string | null;
        };
        Update: {
          address_line?: string | null;
          all_day?: boolean;
          client_id?: string | null;
          code?: string;
          company_id?: string;
          created_at?: string;
          ends_at?: string | null;
          entity_type?: string;
          estimator_id?: string | null;
          id?: string;
          is_seed?: boolean;
          notes?: string | null;
          series_id?: string | null;
          starts_at?: string;
          status?: string | null;
          storage_agreement_id?: string | null;
          title?: string;
          updated_at?: string;
          warehouse_location_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_events_client_id_fkey";
            columns: ["company_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "calendar_events_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calendar_events_estimator_id_fkey";
            columns: ["company_id", "estimator_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "calendar_events_storage_agreement_id_fkey";
            columns: ["company_id", "storage_agreement_id"];
            isOneToOne: false;
            referencedRelation: "storage_agreements";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "calendar_events_warehouse_location_id_fkey";
            columns: ["company_id", "warehouse_location_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      clients: {
        Row: {
          account_owner_staff_id: string | null;
          billing_city: string;
          billing_state: string;
          billing_street: string;
          billing_zip: string;
          code: string;
          company_id: string;
          created_at: string;
          created_date: string;
          destination_city: string | null;
          destination_state: string | null;
          destination_street: string | null;
          destination_zip: string | null;
          email: string;
          id: string;
          is_seed: boolean;
          last_activity_date: string;
          name: string;
          notes: string | null;
          origin_city: string | null;
          origin_state: string | null;
          origin_street: string | null;
          origin_zip: string | null;
          phone: string;
          primary_contact_name: string;
          status: string;
          type: string;
          updated_at: string;
        };
        Insert: {
          account_owner_staff_id?: string | null;
          billing_city: string;
          billing_state: string;
          billing_street: string;
          billing_zip: string;
          code: string;
          company_id?: string;
          created_at?: string;
          created_date: string;
          destination_city?: string | null;
          destination_state?: string | null;
          destination_street?: string | null;
          destination_zip?: string | null;
          email: string;
          id?: string;
          is_seed?: boolean;
          last_activity_date: string;
          name: string;
          notes?: string | null;
          origin_city?: string | null;
          origin_state?: string | null;
          origin_street?: string | null;
          origin_zip?: string | null;
          phone: string;
          primary_contact_name: string;
          status: string;
          type: string;
          updated_at?: string;
        };
        Update: {
          account_owner_staff_id?: string | null;
          billing_city?: string;
          billing_state?: string;
          billing_street?: string;
          billing_zip?: string;
          code?: string;
          company_id?: string;
          created_at?: string;
          created_date?: string;
          destination_city?: string | null;
          destination_state?: string | null;
          destination_street?: string | null;
          destination_zip?: string | null;
          email?: string;
          id?: string;
          is_seed?: boolean;
          last_activity_date?: string;
          name?: string;
          notes?: string | null;
          origin_city?: string | null;
          origin_state?: string | null;
          origin_street?: string | null;
          origin_zip?: string | null;
          phone?: string;
          primary_contact_name?: string;
          status?: string;
          type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clients_account_owner_staff_id_fkey";
            columns: ["company_id", "account_owner_staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "clients_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      companies: {
        Row: {
          created_at: string;
          id: string;
          invoice_prefix: string;
          is_seed: boolean;
          name: string;
          quote_prefix: string;
          slug: string;
          status: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          invoice_prefix?: string;
          is_seed?: boolean;
          name: string;
          quote_prefix?: string;
          slug: string;
          status?: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          invoice_prefix?: string;
          is_seed?: boolean;
          name?: string;
          quote_prefix?: string;
          slug?: string;
          status?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      company_billing_profile: {
        Row: {
          address_line1: string;
          address_line2: string;
          company_id: string;
          email: string;
          is_seed: boolean;
          name: string;
          payment_account_name: string;
          phone: string;
          routing_number: string;
          tax_id: string;
          updated_at: string;
          website: string;
        };
        Insert: {
          address_line1?: string;
          address_line2?: string;
          company_id?: string;
          email?: string;
          is_seed?: boolean;
          name?: string;
          payment_account_name?: string;
          phone?: string;
          routing_number?: string;
          tax_id?: string;
          updated_at?: string;
          website?: string;
        };
        Update: {
          address_line1?: string;
          address_line2?: string;
          company_id?: string;
          email?: string;
          is_seed?: boolean;
          name?: string;
          payment_account_name?: string;
          phone?: string;
          routing_number?: string;
          tax_id?: string;
          updated_at?: string;
          website?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_billing_profile_company_fkey";
            columns: ["company_id"];
            isOneToOne: true;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      crew_rates: {
        Row: {
          company_id: string;
          created_at: string;
          crew_size: number;
          hourly_rate_per_mover: number;
          id: string;
          is_seed: boolean;
          min_hours: number;
          ot_multiplier: number;
          ot_threshold_hours: number;
          rate_card_id: string;
        };
        Insert: {
          company_id?: string;
          created_at?: string;
          crew_size: number;
          hourly_rate_per_mover: number;
          id?: string;
          is_seed?: boolean;
          min_hours?: number;
          ot_multiplier?: number;
          ot_threshold_hours?: number;
          rate_card_id: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          crew_size?: number;
          hourly_rate_per_mover?: number;
          id?: string;
          is_seed?: boolean;
          min_hours?: number;
          ot_multiplier?: number;
          ot_threshold_hours?: number;
          rate_card_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crew_rates_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crew_rates_rate_card_id_fkey";
            columns: ["company_id", "rate_card_id"];
            isOneToOne: false;
            referencedRelation: "rate_cards";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      deals: {
        Row: {
          accepted_quote_id: string | null;
          board_position: number;
          client_id: string | null;
          client_name: string;
          code: string;
          company_id: string;
          created_at: string;
          destination_city: string | null;
          estimated_value: number;
          estimated_value_source: string;
          id: string;
          is_seed: boolean;
          move_date: string | null;
          origin_city: string | null;
          owner_staff_id: string | null;
          priority: string;
          stage: string;
          updated_at: string;
        };
        Insert: {
          accepted_quote_id?: string | null;
          board_position?: number;
          client_id?: string | null;
          client_name: string;
          code: string;
          company_id?: string;
          created_at?: string;
          destination_city?: string | null;
          estimated_value?: number;
          estimated_value_source?: string;
          id?: string;
          is_seed?: boolean;
          move_date?: string | null;
          origin_city?: string | null;
          owner_staff_id?: string | null;
          priority?: string;
          stage?: string;
          updated_at?: string;
        };
        Update: {
          accepted_quote_id?: string | null;
          board_position?: number;
          client_id?: string | null;
          client_name?: string;
          code?: string;
          company_id?: string;
          created_at?: string;
          destination_city?: string | null;
          estimated_value?: number;
          estimated_value_source?: string;
          id?: string;
          is_seed?: boolean;
          move_date?: string | null;
          origin_city?: string | null;
          owner_staff_id?: string | null;
          priority?: string;
          stage?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deals_accepted_quote_id_fkey";
            columns: ["company_id", "accepted_quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "deals_client_id_fkey";
            columns: ["company_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "deals_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deals_owner_staff_id_fkey";
            columns: ["company_id", "owner_staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      document_folders: {
        Row: {
          company_id: string;
          created_at: string;
          id: string;
          is_seed: boolean;
          name: string;
          position: number;
          slug: string;
          updated_at: string;
        };
        Insert: {
          company_id?: string;
          created_at?: string;
          id?: string;
          is_seed?: boolean;
          name: string;
          position?: number;
          slug: string;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          id?: string;
          is_seed?: boolean;
          name?: string;
          position?: number;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_folders_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      document_stars: {
        Row: {
          company_id: string;
          created_at: string;
          document_id: string;
          staff_id: string;
        };
        Insert: {
          company_id?: string;
          created_at?: string;
          document_id: string;
          staff_id: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          document_id?: string;
          staff_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_stars_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_stars_document_id_fkey";
            columns: ["company_id", "document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "document_stars_staff_id_fkey";
            columns: ["company_id", "staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      documents: {
        Row: {
          client_id: string | null;
          company_id: string;
          created_at: string;
          deal_id: string | null;
          deleted_at: string | null;
          external_ref: string | null;
          folder_id: string | null;
          id: string;
          is_seed: boolean;
          job_event_id: string | null;
          kind: string;
          mime_type: string;
          name: string;
          owner_staff_id: string | null;
          signature_status: string;
          signed_at: string | null;
          staff_id: string | null;
          storage_bucket: string;
          storage_path: string;
          updated_at: string;
          visibility: string;
        };
        Insert: {
          client_id?: string | null;
          company_id?: string;
          created_at?: string;
          deal_id?: string | null;
          deleted_at?: string | null;
          external_ref?: string | null;
          folder_id?: string | null;
          id?: string;
          is_seed?: boolean;
          job_event_id?: string | null;
          kind: string;
          mime_type: string;
          name: string;
          owner_staff_id?: string | null;
          signature_status?: string;
          signed_at?: string | null;
          staff_id?: string | null;
          storage_bucket?: string;
          storage_path: string;
          updated_at?: string;
          visibility?: string;
        };
        Update: {
          client_id?: string | null;
          company_id?: string;
          created_at?: string;
          deal_id?: string | null;
          deleted_at?: string | null;
          external_ref?: string | null;
          folder_id?: string | null;
          id?: string;
          is_seed?: boolean;
          job_event_id?: string | null;
          kind?: string;
          mime_type?: string;
          name?: string;
          owner_staff_id?: string | null;
          signature_status?: string;
          signed_at?: string | null;
          staff_id?: string | null;
          storage_bucket?: string;
          storage_path?: string;
          updated_at?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_client_id_fkey";
            columns: ["company_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "documents_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_deal_id_fkey";
            columns: ["company_id", "deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "documents_folder_id_fkey";
            columns: ["company_id", "folder_id"];
            isOneToOne: false;
            referencedRelation: "document_folders";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "documents_job_event_id_fkey";
            columns: ["company_id", "job_event_id"];
            isOneToOne: false;
            referencedRelation: "calendar_events";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "documents_owner_staff_id_fkey";
            columns: ["company_id", "owner_staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "documents_staff_id_fkey";
            columns: ["company_id", "staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      fee_catalog: {
        Row: {
          category: string;
          code: string;
          company_id: string;
          created_at: string;
          default_rate: number;
          id: string;
          is_active: boolean;
          is_seed: boolean;
          name: string;
          pricing_mode: string;
          sort_order: number;
          taxable: boolean;
          unit_label: string | null;
        };
        Insert: {
          category: string;
          code: string;
          company_id?: string;
          created_at?: string;
          default_rate?: number;
          id?: string;
          is_active?: boolean;
          is_seed?: boolean;
          name: string;
          pricing_mode: string;
          sort_order?: number;
          taxable?: boolean;
          unit_label?: string | null;
        };
        Update: {
          category?: string;
          code?: string;
          company_id?: string;
          created_at?: string;
          default_rate?: number;
          id?: string;
          is_active?: boolean;
          is_seed?: boolean;
          name?: string;
          pricing_mode?: string;
          sort_order?: number;
          taxable?: boolean;
          unit_label?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fee_catalog_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      invoice_line_items: {
        Row: {
          amount: number;
          company_id: string;
          created_at: string;
          description: string;
          external_key: string | null;
          id: string;
          invoice_id: string;
          is_seed: boolean;
          position: number;
          quantity: number;
          source_quote_line_item_id: string | null;
          taxable: boolean;
          unit_price: number;
        };
        Insert: {
          amount?: number;
          company_id?: string;
          created_at?: string;
          description: string;
          external_key?: string | null;
          id?: string;
          invoice_id: string;
          is_seed?: boolean;
          position?: number;
          quantity?: number;
          source_quote_line_item_id?: string | null;
          taxable?: boolean;
          unit_price?: number;
        };
        Update: {
          amount?: number;
          company_id?: string;
          created_at?: string;
          description?: string;
          external_key?: string | null;
          id?: string;
          invoice_id?: string;
          is_seed?: boolean;
          position?: number;
          quantity?: number;
          source_quote_line_item_id?: string | null;
          taxable?: boolean;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey";
            columns: ["company_id", "invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "invoice_line_items_source_fkey";
            columns: ["company_id", "source_quote_line_item_id"];
            isOneToOne: false;
            referencedRelation: "quote_line_items";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      invoices: {
        Row: {
          amount_paid: number;
          balance_due: number;
          bill_to_address_line1: string | null;
          bill_to_address_line2: string | null;
          bill_to_email: string | null;
          bill_to_name: string;
          client_id: string;
          code: string;
          company_id: string;
          created_at: string;
          customer_tax_id: string | null;
          deal_id: string | null;
          discount_amount: number;
          discount_type: string;
          discount_value: number;
          id: string;
          is_seed: boolean;
          issued_by_staff_id: string | null;
          issued_date: string;
          notes: string | null;
          payment_due_date: string;
          quote_id: string | null;
          status: string;
          subtotal: number;
          tax_amount: number;
          tax_rate_id: string | null;
          tax_rate_percent: number;
          total_amount: number;
          updated_at: string;
        };
        Insert: {
          amount_paid?: number;
          balance_due?: number;
          bill_to_address_line1?: string | null;
          bill_to_address_line2?: string | null;
          bill_to_email?: string | null;
          bill_to_name: string;
          client_id: string;
          code: string;
          company_id?: string;
          created_at?: string;
          customer_tax_id?: string | null;
          deal_id?: string | null;
          discount_amount?: number;
          discount_type?: string;
          discount_value?: number;
          id?: string;
          is_seed?: boolean;
          issued_by_staff_id?: string | null;
          issued_date?: string;
          notes?: string | null;
          payment_due_date: string;
          quote_id?: string | null;
          status?: string;
          subtotal?: number;
          tax_amount?: number;
          tax_rate_id?: string | null;
          tax_rate_percent?: number;
          total_amount?: number;
          updated_at?: string;
        };
        Update: {
          amount_paid?: number;
          balance_due?: number;
          bill_to_address_line1?: string | null;
          bill_to_address_line2?: string | null;
          bill_to_email?: string | null;
          bill_to_name?: string;
          client_id?: string;
          code?: string;
          company_id?: string;
          created_at?: string;
          customer_tax_id?: string | null;
          deal_id?: string | null;
          discount_amount?: number;
          discount_type?: string;
          discount_value?: number;
          id?: string;
          is_seed?: boolean;
          issued_by_staff_id?: string | null;
          issued_date?: string;
          notes?: string | null;
          payment_due_date?: string;
          quote_id?: string | null;
          status?: string;
          subtotal?: number;
          tax_amount?: number;
          tax_rate_id?: string | null;
          tax_rate_percent?: number;
          total_amount?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey";
            columns: ["company_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "invoices_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_deal_id_fkey";
            columns: ["company_id", "deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "invoices_issued_by_staff_id_fkey";
            columns: ["company_id", "issued_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "invoices_quote_id_fkey";
            columns: ["company_id", "quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "invoices_tax_rate_id_fkey";
            columns: ["company_id", "tax_rate_id"];
            isOneToOne: false;
            referencedRelation: "tax_rates";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      permission_sets: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_seed: boolean;
          name: string;
          slug: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_seed?: boolean;
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_seed?: boolean;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      quote_line_items: {
        Row: {
          amount: number;
          company_id: string;
          created_at: string;
          description: string;
          external_key: string | null;
          fee_catalog_id: string | null;
          id: string;
          is_seed: boolean;
          kind: string;
          position: number;
          pricing_mode: string;
          quantity: number;
          quote_id: string;
          taxable: boolean;
          unit_price: number;
        };
        Insert: {
          amount?: number;
          company_id?: string;
          created_at?: string;
          description: string;
          external_key?: string | null;
          fee_catalog_id?: string | null;
          id?: string;
          is_seed?: boolean;
          kind: string;
          position?: number;
          pricing_mode?: string;
          quantity?: number;
          quote_id: string;
          taxable?: boolean;
          unit_price?: number;
        };
        Update: {
          amount?: number;
          company_id?: string;
          created_at?: string;
          description?: string;
          external_key?: string | null;
          fee_catalog_id?: string | null;
          id?: string;
          is_seed?: boolean;
          kind?: string;
          position?: number;
          pricing_mode?: string;
          quantity?: number;
          quote_id?: string;
          taxable?: boolean;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "quote_line_items_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quote_line_items_fee_catalog_id_fkey";
            columns: ["company_id", "fee_catalog_id"];
            isOneToOne: false;
            referencedRelation: "fee_catalog";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "quote_line_items_quote_id_fkey";
            columns: ["company_id", "quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      quotes: {
        Row: {
          accessorials_total: number;
          client_id: string | null;
          client_name: string;
          code: string;
          company_id: string;
          created_at: string;
          crew_size: number;
          deal_id: string | null;
          decided_at: string | null;
          deposit_amount: number;
          deposit_type: string;
          deposit_value: number;
          destination_city: string | null;
          destination_state: string | null;
          destination_street: string | null;
          destination_zip: string | null;
          discount_amount: number;
          discount_type: string;
          discount_value: number;
          estimated_hours: number;
          hourly_rate_per_mover: number;
          id: string;
          is_seed: boolean;
          issued_on: string;
          labor_taxable: boolean;
          labor_total: number;
          min_hours: number;
          move_date: string | null;
          notes: string | null;
          origin_city: string | null;
          origin_state: string | null;
          origin_street: string | null;
          origin_zip: string | null;
          ot_multiplier: number;
          ot_threshold_hours: number;
          owner_staff_id: string | null;
          prepared_by_staff_id: string | null;
          rate_card_id: string | null;
          sent_at: string | null;
          status: string;
          subtotal: number;
          tax_amount: number;
          tax_rate_id: string | null;
          tax_rate_percent: number;
          terms: string | null;
          total_amount: number;
          updated_at: string;
          valid_until: string | null;
          valuation_fee: number;
          valuation_taxable: boolean;
          valuation_type: string;
          viewed_at: string | null;
        };
        Insert: {
          accessorials_total?: number;
          client_id?: string | null;
          client_name: string;
          code: string;
          company_id?: string;
          created_at?: string;
          crew_size: number;
          deal_id?: string | null;
          decided_at?: string | null;
          deposit_amount?: number;
          deposit_type?: string;
          deposit_value?: number;
          destination_city?: string | null;
          destination_state?: string | null;
          destination_street?: string | null;
          destination_zip?: string | null;
          discount_amount?: number;
          discount_type?: string;
          discount_value?: number;
          estimated_hours?: number;
          hourly_rate_per_mover: number;
          id?: string;
          is_seed?: boolean;
          issued_on?: string;
          labor_taxable?: boolean;
          labor_total?: number;
          min_hours?: number;
          move_date?: string | null;
          notes?: string | null;
          origin_city?: string | null;
          origin_state?: string | null;
          origin_street?: string | null;
          origin_zip?: string | null;
          ot_multiplier?: number;
          ot_threshold_hours?: number;
          owner_staff_id?: string | null;
          prepared_by_staff_id?: string | null;
          rate_card_id?: string | null;
          sent_at?: string | null;
          status?: string;
          subtotal?: number;
          tax_amount?: number;
          tax_rate_id?: string | null;
          tax_rate_percent?: number;
          terms?: string | null;
          total_amount?: number;
          updated_at?: string;
          valid_until?: string | null;
          valuation_fee?: number;
          valuation_taxable?: boolean;
          valuation_type?: string;
          viewed_at?: string | null;
        };
        Update: {
          accessorials_total?: number;
          client_id?: string | null;
          client_name?: string;
          code?: string;
          company_id?: string;
          created_at?: string;
          crew_size?: number;
          deal_id?: string | null;
          decided_at?: string | null;
          deposit_amount?: number;
          deposit_type?: string;
          deposit_value?: number;
          destination_city?: string | null;
          destination_state?: string | null;
          destination_street?: string | null;
          destination_zip?: string | null;
          discount_amount?: number;
          discount_type?: string;
          discount_value?: number;
          estimated_hours?: number;
          hourly_rate_per_mover?: number;
          id?: string;
          is_seed?: boolean;
          issued_on?: string;
          labor_taxable?: boolean;
          labor_total?: number;
          min_hours?: number;
          move_date?: string | null;
          notes?: string | null;
          origin_city?: string | null;
          origin_state?: string | null;
          origin_street?: string | null;
          origin_zip?: string | null;
          ot_multiplier?: number;
          ot_threshold_hours?: number;
          owner_staff_id?: string | null;
          prepared_by_staff_id?: string | null;
          rate_card_id?: string | null;
          sent_at?: string | null;
          status?: string;
          subtotal?: number;
          tax_amount?: number;
          tax_rate_id?: string | null;
          tax_rate_percent?: number;
          terms?: string | null;
          total_amount?: number;
          updated_at?: string;
          valid_until?: string | null;
          valuation_fee?: number;
          valuation_taxable?: boolean;
          valuation_type?: string;
          viewed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey";
            columns: ["company_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "quotes_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_deal_id_fkey";
            columns: ["company_id", "deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "quotes_owner_staff_id_fkey";
            columns: ["company_id", "owner_staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "quotes_prepared_by_staff_id_fkey";
            columns: ["company_id", "prepared_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "quotes_rate_card_id_fkey";
            columns: ["company_id", "rate_card_id"];
            isOneToOne: false;
            referencedRelation: "rate_cards";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "quotes_tax_rate_id_fkey";
            columns: ["company_id", "tax_rate_id"];
            isOneToOne: false;
            referencedRelation: "tax_rates";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      rate_cards: {
        Row: {
          code: string;
          company_id: string;
          created_at: string;
          effective_from: string;
          effective_to: string | null;
          id: string;
          is_default: boolean;
          is_seed: boolean;
          name: string;
        };
        Insert: {
          code: string;
          company_id?: string;
          created_at?: string;
          effective_from: string;
          effective_to?: string | null;
          id?: string;
          is_default?: boolean;
          is_seed?: boolean;
          name: string;
        };
        Update: {
          code?: string;
          company_id?: string;
          created_at?: string;
          effective_from?: string;
          effective_to?: string | null;
          id?: string;
          is_default?: boolean;
          is_seed?: boolean;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rate_cards_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      role_permission_sets: {
        Row: {
          company_id: string;
          is_seed: boolean;
          permission_set_id: string;
          position: number;
          role_id: string;
        };
        Insert: {
          company_id?: string;
          is_seed?: boolean;
          permission_set_id: string;
          position?: number;
          role_id: string;
        };
        Update: {
          company_id?: string;
          is_seed?: boolean;
          permission_set_id?: string;
          position?: number;
          role_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "role_permission_sets_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "role_permission_sets_permission_set_id_fkey";
            columns: ["permission_set_id"];
            isOneToOne: false;
            referencedRelation: "permission_sets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "role_permission_sets_role_id_fkey";
            columns: ["company_id", "role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      roles: {
        Row: {
          access_level: string;
          archived_at: string | null;
          company_id: string;
          created_at: string;
          group_label: string;
          id: string;
          is_seed: boolean;
          is_system: boolean;
          last_reviewed_on: string | null;
          name: string;
          owner_staff_id: string | null;
          slug: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          access_level: string;
          archived_at?: string | null;
          company_id?: string;
          created_at?: string;
          group_label?: string;
          id?: string;
          is_seed?: boolean;
          is_system?: boolean;
          last_reviewed_on?: string | null;
          name: string;
          owner_staff_id?: string | null;
          slug: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          access_level?: string;
          archived_at?: string | null;
          company_id?: string;
          created_at?: string;
          group_label?: string;
          id?: string;
          is_seed?: boolean;
          is_system?: boolean;
          last_reviewed_on?: string | null;
          name?: string;
          owner_staff_id?: string | null;
          slug?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "roles_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roles_owner_staff_id_fkey";
            columns: ["company_id", "owner_staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      staff: {
        Row: {
          auth_user_id: string | null;
          avatar_url: string | null;
          company_id: string;
          created_at: string;
          full_name: string;
          id: string;
          is_seed: boolean;
          joined_at: string;
          last_active_at: string | null;
          role_id: string;
          status: string;
          team: string;
          updated_at: string;
          work_email: string;
        };
        Insert: {
          auth_user_id?: string | null;
          avatar_url?: string | null;
          company_id?: string;
          created_at?: string;
          full_name: string;
          id?: string;
          is_seed?: boolean;
          joined_at: string;
          last_active_at?: string | null;
          role_id: string;
          status?: string;
          team: string;
          updated_at?: string;
          work_email: string;
        };
        Update: {
          auth_user_id?: string | null;
          avatar_url?: string | null;
          company_id?: string;
          created_at?: string;
          full_name?: string;
          id?: string;
          is_seed?: boolean;
          joined_at?: string;
          last_active_at?: string | null;
          role_id?: string;
          status?: string;
          team?: string;
          updated_at?: string;
          work_email?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_role_id_fkey";
            columns: ["company_id", "role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      staff_locations: {
        Row: {
          company_id: string;
          is_seed: boolean;
          position: number;
          staff_id: string;
          warehouse_location_id: string;
        };
        Insert: {
          company_id?: string;
          is_seed?: boolean;
          position?: number;
          staff_id: string;
          warehouse_location_id: string;
        };
        Update: {
          company_id?: string;
          is_seed?: boolean;
          position?: number;
          staff_id?: string;
          warehouse_location_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_locations_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_locations_staff_id_fkey";
            columns: ["company_id", "staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "staff_locations_warehouse_location_id_fkey";
            columns: ["company_id", "warehouse_location_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      staff_profiles: {
        Row: {
          annual_leave_days: number | null;
          bio: string | null;
          carried_over_leave_days: number;
          company_id: string;
          contracting_entity: string | null;
          created_at: string;
          current_project: string | null;
          department: string | null;
          employee_ref: string | null;
          employment_type: string | null;
          is_seed: boolean;
          job_level: string | null;
          job_title: string | null;
          last_working_day: string | null;
          leave_policy: string | null;
          leave_year_end: string | null;
          leave_year_start: string | null;
          legal_name: string | null;
          manager_staff_id: string | null;
          next_leave_end: string | null;
          next_leave_start: string | null;
          notice_period_days: number | null;
          pending_leave_requests: number;
          preferred_name: string | null;
          primary_location_id: string | null;
          pronouns: string | null;
          remaining_leave_days: number | null;
          scheduled_leave_days: number;
          staff_id: string;
          time_zone: string;
          updated_at: string;
          updated_by_staff_id: string | null;
          used_leave_days: number;
          weekly_hours: number | null;
          work_arrangement: string | null;
          work_days: number[] | null;
          work_end_time: string | null;
          work_phone: string | null;
          work_start_time: string | null;
        };
        Insert: {
          annual_leave_days?: number | null;
          bio?: string | null;
          carried_over_leave_days?: number;
          company_id?: string;
          contracting_entity?: string | null;
          created_at?: string;
          current_project?: string | null;
          department?: string | null;
          employee_ref?: string | null;
          employment_type?: string | null;
          is_seed?: boolean;
          job_level?: string | null;
          job_title?: string | null;
          last_working_day?: string | null;
          leave_policy?: string | null;
          leave_year_end?: string | null;
          leave_year_start?: string | null;
          legal_name?: string | null;
          manager_staff_id?: string | null;
          next_leave_end?: string | null;
          next_leave_start?: string | null;
          notice_period_days?: number | null;
          pending_leave_requests?: number;
          preferred_name?: string | null;
          primary_location_id?: string | null;
          pronouns?: string | null;
          remaining_leave_days?: number | null;
          scheduled_leave_days?: number;
          staff_id: string;
          time_zone?: string;
          updated_at?: string;
          updated_by_staff_id?: string | null;
          used_leave_days?: number;
          weekly_hours?: number | null;
          work_arrangement?: string | null;
          work_days?: number[] | null;
          work_end_time?: string | null;
          work_phone?: string | null;
          work_start_time?: string | null;
        };
        Update: {
          annual_leave_days?: number | null;
          bio?: string | null;
          carried_over_leave_days?: number;
          company_id?: string;
          contracting_entity?: string | null;
          created_at?: string;
          current_project?: string | null;
          department?: string | null;
          employee_ref?: string | null;
          employment_type?: string | null;
          is_seed?: boolean;
          job_level?: string | null;
          job_title?: string | null;
          last_working_day?: string | null;
          leave_policy?: string | null;
          leave_year_end?: string | null;
          leave_year_start?: string | null;
          legal_name?: string | null;
          manager_staff_id?: string | null;
          next_leave_end?: string | null;
          next_leave_start?: string | null;
          notice_period_days?: number | null;
          pending_leave_requests?: number;
          preferred_name?: string | null;
          primary_location_id?: string | null;
          pronouns?: string | null;
          remaining_leave_days?: number | null;
          scheduled_leave_days?: number;
          staff_id?: string;
          time_zone?: string;
          updated_at?: string;
          updated_by_staff_id?: string | null;
          used_leave_days?: number;
          weekly_hours?: number | null;
          work_arrangement?: string | null;
          work_days?: number[] | null;
          work_end_time?: string | null;
          work_phone?: string | null;
          work_start_time?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "staff_profiles_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_profiles_manager_staff_id_fkey";
            columns: ["company_id", "manager_staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "staff_profiles_primary_location_id_fkey";
            columns: ["company_id", "primary_location_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "staff_profiles_staff_id_fkey";
            columns: ["company_id", "staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "staff_profiles_updated_by_staff_id_fkey";
            columns: ["company_id", "updated_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      staff_profiles_sensitive: {
        Row: {
          company_id: string;
          created_at: string;
          date_of_birth: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          emergency_contact_relationship: string | null;
          home_address: string | null;
          is_seed: boolean;
          personal_email: string | null;
          staff_id: string;
          updated_at: string;
        };
        Insert: {
          company_id?: string;
          created_at?: string;
          date_of_birth?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          emergency_contact_relationship?: string | null;
          home_address?: string | null;
          is_seed?: boolean;
          personal_email?: string | null;
          staff_id: string;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          date_of_birth?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          emergency_contact_relationship?: string | null;
          home_address?: string | null;
          is_seed?: boolean;
          personal_email?: string | null;
          staff_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_profiles_sensitive_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_profiles_sensitive_staff_id_fkey";
            columns: ["company_id", "staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      storage_agreements: {
        Row: {
          client_id: string;
          code: string;
          company_id: string;
          created_at: string;
          id: string;
          is_seed: boolean;
          monthly_rate: number;
          move_in_date: string;
          next_billing_date: string | null;
          status: string;
          updated_at: string;
          warehouse_location_id: string;
        };
        Insert: {
          client_id: string;
          code: string;
          company_id?: string;
          created_at?: string;
          id?: string;
          is_seed?: boolean;
          monthly_rate?: number;
          move_in_date: string;
          next_billing_date?: string | null;
          status: string;
          updated_at?: string;
          warehouse_location_id: string;
        };
        Update: {
          client_id?: string;
          code?: string;
          company_id?: string;
          created_at?: string;
          id?: string;
          is_seed?: boolean;
          monthly_rate?: number;
          move_in_date?: string;
          next_billing_date?: string | null;
          status?: string;
          updated_at?: string;
          warehouse_location_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "storage_agreements_client_id_fkey";
            columns: ["company_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "storage_agreements_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "storage_agreements_warehouse_location_id_fkey";
            columns: ["company_id", "warehouse_location_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      tax_rates: {
        Row: {
          code: string;
          company_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          is_default: boolean;
          is_seed: boolean;
          name: string;
          rate_percent: number;
        };
        Insert: {
          code: string;
          company_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          is_seed?: boolean;
          name: string;
          rate_percent?: number;
        };
        Update: {
          code?: string;
          company_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          is_seed?: boolean;
          name?: string;
          rate_percent?: number;
        };
        Relationships: [
          {
            foreignKeyName: "tax_rates_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      user_active_company: {
        Row: {
          auth_user_id: string;
          company_id: string;
          updated_at: string;
        };
        Insert: {
          auth_user_id: string;
          company_id: string;
          updated_at?: string;
        };
        Update: {
          auth_user_id?: string;
          company_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_active_company_company_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      vaults: {
        Row: {
          capacity_cubic_ft: number;
          code: string;
          company_id: string;
          created_at: string;
          id: string;
          is_seed: boolean;
          last_inspection_date: string;
          occupancy_percent: number | null;
          occupied_cubic_ft: number;
          rack: string;
          status: string;
          storage_agreement_id: string | null;
          updated_at: string;
          warehouse_location_id: string;
        };
        Insert: {
          capacity_cubic_ft: number;
          code: string;
          company_id?: string;
          created_at?: string;
          id?: string;
          is_seed?: boolean;
          last_inspection_date: string;
          occupancy_percent?: number | null;
          occupied_cubic_ft?: number;
          rack: string;
          status: string;
          storage_agreement_id?: string | null;
          updated_at?: string;
          warehouse_location_id: string;
        };
        Update: {
          capacity_cubic_ft?: number;
          code?: string;
          company_id?: string;
          created_at?: string;
          id?: string;
          is_seed?: boolean;
          last_inspection_date?: string;
          occupancy_percent?: number | null;
          occupied_cubic_ft?: number;
          rack?: string;
          status?: string;
          storage_agreement_id?: string | null;
          updated_at?: string;
          warehouse_location_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vaults_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vaults_storage_agreement_id_fkey";
            columns: ["company_id", "storage_agreement_id"];
            isOneToOne: false;
            referencedRelation: "storage_agreements";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "vaults_warehouse_location_id_fkey";
            columns: ["company_id", "warehouse_location_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      warehouse_locations: {
        Row: {
          company_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          is_seed: boolean;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          company_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_seed?: boolean;
          name: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_seed?: boolean;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "warehouse_locations_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      calendar_events_expanded: {
        Row: {
          address_line: string | null;
          all_day: boolean | null;
          client_code: string | null;
          client_id: string | null;
          client_name: string | null;
          code: string | null;
          created_at: string | null;
          crew: string[] | null;
          ends_at: string | null;
          entity_type: string | null;
          estimator_id: string | null;
          estimator_name: string | null;
          id: string | null;
          is_seed: boolean | null;
          notes: string | null;
          series_id: string | null;
          starts_at: string | null;
          status: string | null;
          storage_agreement_code: string | null;
          storage_agreement_id: string | null;
          title: string | null;
          updated_at: string | null;
          warehouse_location_id: string | null;
          warehouse_location_name: string | null;
        };
        Relationships: [];
      };
      roles_expanded: {
        Row: {
          access_level: string | null;
          archived_at: string | null;
          created_at: string | null;
          group_label: string | null;
          id: string | null;
          is_seed: boolean | null;
          is_system: boolean | null;
          last_reviewed_on: string | null;
          name: string | null;
          owner_name: string | null;
          owner_staff_id: string | null;
          permission_set_names: string[] | null;
          permission_set_slugs: string[] | null;
          slug: string | null;
          staff_count: number | null;
          status: string | null;
          updated_at: string | null;
        };
        Relationships: [];
      };
      storage_agreements_expanded: {
        Row: {
          client_code: string | null;
          client_id: string | null;
          client_name: string | null;
          code: string | null;
          created_at: string | null;
          id: string | null;
          is_seed: boolean | null;
          monthly_rate: number | null;
          move_in_date: string | null;
          next_billing_date: string | null;
          status: string | null;
          updated_at: string | null;
          vault_codes: string[] | null;
          vault_count: number | null;
          warehouse_location_id: string | null;
          warehouse_location_name: string | null;
        };
        Relationships: [];
      };
      vaults_expanded: {
        Row: {
          capacity_cubic_ft: number | null;
          client_code: string | null;
          client_id: string | null;
          code: string | null;
          created_at: string | null;
          customer_name: string | null;
          group_label: string | null;
          id: string | null;
          is_seed: boolean | null;
          last_inspection_date: string | null;
          occupancy_percent: number | null;
          occupied_cubic_ft: number | null;
          rack: string | null;
          status: string | null;
          storage_agreement_code: string | null;
          storage_agreement_id: string | null;
          updated_at: string | null;
          warehouse_location_id: string | null;
          warehouse_location_name: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      admin_create_staff: {
        Args: {
          p_avatar_url?: string;
          p_full_name: string;
          p_joined_at?: string;
          p_role_slug: string;
          p_status?: string;
          p_team: string;
          p_work_email: string;
        };
        Returns: string;
      };
      admin_invite_staff: {
        Args: {
          p_full_name: string;
          p_role_slug: string;
          p_team: string;
          p_work_email: string;
        };
        Returns: string;
      };
      admin_set_staff_role: {
        Args: { p_role_slug: string; p_staff_id: string };
        Returns: undefined;
      };
      admin_set_staff_status: {
        Args: { p_staff_id: string; p_status: string };
        Returns: undefined;
      };
      admin_update_staff: {
        Args: {
          p_avatar_url?: string;
          p_full_name?: string;
          p_staff_id: string;
          p_team?: string;
          p_work_email?: string;
        };
        Returns: undefined;
      };
      claim_staff_for_current_user: { Args: never; Returns: string };
      create_company: {
        Args: {
          p_name: string;
          p_owner_email: string;
          p_owner_name: string;
          p_slug: string;
        };
        Returns: string;
      };
      current_company_state: {
        Args: never;
        Returns: {
          company_id: string;
          company_name: string;
          state: string;
        }[];
      };
      next_client_code: { Args: never; Returns: string };
      next_deal_code: { Args: never; Returns: string };
      next_event_code: { Args: { p_kind: string }; Returns: string };
      next_invoice_code: { Args: never; Returns: string };
      next_quote_code: { Args: never; Returns: string };
      next_storage_code: { Args: never; Returns: string };
      next_vault_code: { Args: never; Returns: string };
      signup_create_company: {
        Args: { p_name: string; p_slug: string };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;

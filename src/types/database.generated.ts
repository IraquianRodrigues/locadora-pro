export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      additional_services: {
        Row: {
          active: boolean;
          amount: number;
          archived_at: string | null;
          created_at: string;
          id: string;
          name: string;
          public_enabled: boolean;
          unit: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          amount: number;
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          public_enabled?: boolean;
          unit: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          amount?: number;
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          public_enabled?: boolean;
          unit?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          correlation_id: string;
          created_at: string;
          domain: string;
          entity_id: string;
          entity_type: string;
          id: string;
          safe_changes: Json;
          updated_at: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          correlation_id?: string;
          created_at?: string;
          domain: string;
          entity_id: string;
          entity_type: string;
          id?: string;
          safe_changes: Json;
          updated_at?: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          correlation_id?: string;
          created_at?: string;
          domain?: string;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          safe_changes?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      branches: {
        Row: {
          active: boolean;
          address: Json;
          archived_at: string | null;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          address: Json;
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          address?: Json;
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      charge_adjustments: {
        Row: {
          actor_id: string;
          amount: number;
          charge_id: string;
          created_at: string;
          id: string;
          kind: string;
          reason: string;
          updated_at: string;
        };
        Insert: {
          actor_id: string;
          amount: number;
          charge_id: string;
          created_at?: string;
          id?: string;
          kind: string;
          reason: string;
          updated_at?: string;
        };
        Update: {
          actor_id?: string;
          amount?: number;
          charge_id?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          reason?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "charge_adjustments_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "charge_adjustments_charge_id_fkey";
            columns: ["charge_id"];
            isOneToOne: false;
            referencedRelation: "charges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "charge_adjustments_charge_id_fkey";
            columns: ["charge_id"];
            isOneToOne: false;
            referencedRelation: "finance_charge_balances";
            referencedColumns: ["id"];
          },
        ];
      };
      charges: {
        Row: {
          amount: number;
          competence_at: string | null;
          created_at: string;
          customer_id: string;
          damage_id: string | null;
          description: string;
          due_at: string;
          id: string;
          kind: string;
          rental_id: string | null;
          updated_at: string;
        };
        Insert: {
          amount: number;
          competence_at?: string | null;
          created_at?: string;
          customer_id: string;
          damage_id?: string | null;
          description: string;
          due_at: string;
          id?: string;
          kind: string;
          rental_id?: string | null;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          competence_at?: string | null;
          created_at?: string;
          customer_id?: string;
          damage_id?: string | null;
          description?: string;
          due_at?: string;
          id?: string;
          kind?: string;
          rental_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "charges_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "charges_damage_id_fkey";
            columns: ["damage_id"];
            isOneToOne: false;
            referencedRelation: "damages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "charges_rental_id_customer_id_fkey";
            columns: ["rental_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "rentals";
            referencedColumns: ["id", "customer_id"];
          },
        ];
      };
      company_settings: {
        Row: {
          contact: Json;
          created_at: string;
          currency: string;
          id: string;
          legal_name: string;
          singleton: boolean;
          tax_document: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          contact?: Json;
          created_at?: string;
          currency?: string;
          id?: string;
          legal_name: string;
          singleton?: boolean;
          tax_document: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          contact?: Json;
          created_at?: string;
          currency?: string;
          id?: string;
          legal_name?: string;
          singleton?: boolean;
          tax_document?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      contract_templates: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          review_status: string;
          template_key: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          review_status?: string;
          template_key: string;
          updated_at?: string;
          version: number;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          review_status?: string;
          template_key?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      contracts: {
        Row: {
          attempts: number;
          available_at: string;
          created_at: string;
          generation_status: string;
          id: string;
          last_error_code: string | null;
          lease_token: string | null;
          locked_until: string | null;
          rental_id: string;
          sha256: string | null;
          snapshot: Json;
          storage_path: string | null;
          template_id: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          attempts?: number;
          available_at?: string;
          created_at?: string;
          generation_status?: string;
          id?: string;
          last_error_code?: string | null;
          lease_token?: string | null;
          locked_until?: string | null;
          rental_id: string;
          sha256?: string | null;
          snapshot: Json;
          storage_path?: string | null;
          template_id: string;
          updated_at?: string;
          version: number;
        };
        Update: {
          attempts?: number;
          available_at?: string;
          created_at?: string;
          generation_status?: string;
          id?: string;
          last_error_code?: string | null;
          lease_token?: string | null;
          locked_until?: string | null;
          rental_id?: string;
          sha256?: string | null;
          snapshot?: Json;
          storage_path?: string | null;
          template_id?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "contracts_rental_id_fkey";
            columns: ["rental_id"];
            isOneToOne: false;
            referencedRelation: "rentals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "contract_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_documents: {
        Row: {
          created_at: string;
          customer_id: string;
          document_type: string;
          id: string;
          storage_path: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          document_type: string;
          id?: string;
          storage_path: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          document_type?: string;
          id?: string;
          storage_path?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_documents_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_notes: {
        Row: {
          author_id: string;
          created_at: string;
          customer_id: string;
          id: string;
          note: string;
          updated_at: string;
        };
        Insert: {
          author_id?: string;
          created_at?: string;
          customer_id: string;
          id?: string;
          note: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          created_at?: string;
          customer_id?: string;
          id?: string;
          note?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_notes_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_notes_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          address: Json;
          archived_at: string | null;
          birth_date: string | null;
          created_at: string;
          email: string;
          id: string;
          name: string;
          notes: string | null;
          person_type: string;
          phone: string;
          tax_document: string;
          updated_at: string;
        };
        Insert: {
          address: Json;
          archived_at?: string | null;
          birth_date?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          name: string;
          notes?: string | null;
          person_type: string;
          phone: string;
          tax_document: string;
          updated_at?: string;
        };
        Update: {
          address?: Json;
          archived_at?: string | null;
          birth_date?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          person_type?: string;
          phone?: string;
          tax_document?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      damages: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          inspection_id: string;
          status: string;
          updated_at: string;
          vehicle_id: string;
        };
        Insert: {
          created_at?: string;
          description: string;
          id?: string;
          inspection_id: string;
          status?: string;
          updated_at?: string;
          vehicle_id: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          inspection_id?: string;
          status?: string;
          updated_at?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "damages_inspection_id_fkey";
            columns: ["inspection_id"];
            isOneToOne: false;
            referencedRelation: "inspections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "damages_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      deposit_application_reversals: {
        Row: {
          actor_id: string;
          amount: number;
          application_id: string;
          created_at: string;
          id: string;
          reason: string;
          updated_at: string;
        };
        Insert: {
          actor_id: string;
          amount: number;
          application_id: string;
          created_at?: string;
          id?: string;
          reason: string;
          updated_at?: string;
        };
        Update: {
          actor_id?: string;
          amount?: number;
          application_id?: string;
          created_at?: string;
          id?: string;
          reason?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deposit_application_reversals_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deposit_application_reversals_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "deposits";
            referencedColumns: ["id"];
          },
        ];
      };
      deposits: {
        Row: {
          amount: number;
          applied_charge_id: string | null;
          confirmed_by: string;
          created_at: string;
          id: string;
          kind: string;
          original_deposit_id: string | null;
          payment_method_id: string | null;
          reason: string | null;
          rental_id: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          applied_charge_id?: string | null;
          confirmed_by: string;
          created_at?: string;
          id?: string;
          kind: string;
          original_deposit_id?: string | null;
          payment_method_id?: string | null;
          reason?: string | null;
          rental_id: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          applied_charge_id?: string | null;
          confirmed_by?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          original_deposit_id?: string | null;
          payment_method_id?: string | null;
          reason?: string | null;
          rental_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deposits_applied_charge_id_fkey";
            columns: ["applied_charge_id"];
            isOneToOne: false;
            referencedRelation: "charges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deposits_applied_charge_id_fkey";
            columns: ["applied_charge_id"];
            isOneToOne: false;
            referencedRelation: "finance_charge_balances";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deposits_confirmed_by_fkey";
            columns: ["confirmed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deposits_original_deposit_id_fkey";
            columns: ["original_deposit_id"];
            isOneToOne: false;
            referencedRelation: "deposits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deposits_payment_method_id_fkey";
            columns: ["payment_method_id"];
            isOneToOne: false;
            referencedRelation: "payment_methods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deposits_rental_id_fkey";
            columns: ["rental_id"];
            isOneToOne: false;
            referencedRelation: "rentals";
            referencedColumns: ["id"];
          },
        ];
      };
      drivers: {
        Row: {
          archived_at: string | null;
          cpf: string;
          created_at: string;
          customer_id: string;
          document_path: string | null;
          id: string;
          license_category: string;
          license_expires_on: string;
          license_number: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          cpf: string;
          created_at?: string;
          customer_id: string;
          document_path?: string | null;
          id?: string;
          license_category: string;
          license_expires_on: string;
          license_number: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          cpf?: string;
          created_at?: string;
          customer_id?: string;
          document_path?: string | null;
          id?: string;
          license_category?: string;
          license_expires_on?: string;
          license_number?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "drivers_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      expense_reversals: {
        Row: {
          actor_id: string;
          amount: number;
          created_at: string;
          expense_id: string;
          id: string;
          reason: string;
          updated_at: string;
        };
        Insert: {
          actor_id: string;
          amount: number;
          created_at?: string;
          expense_id: string;
          id?: string;
          reason: string;
          updated_at?: string;
        };
        Update: {
          actor_id?: string;
          amount?: number;
          created_at?: string;
          expense_id?: string;
          id?: string;
          reason?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expense_reversals_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expense_reversals_expense_id_fkey";
            columns: ["expense_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          amount: number;
          created_at: string;
          description: string;
          id: string;
          maintenance_record_id: string | null;
          occurred_at: string;
          payment_method_id: string | null;
          updated_at: string;
          vehicle_id: string | null;
        };
        Insert: {
          amount: number;
          created_at?: string;
          description: string;
          id?: string;
          maintenance_record_id?: string | null;
          occurred_at: string;
          payment_method_id?: string | null;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          description?: string;
          id?: string;
          maintenance_record_id?: string | null;
          occurred_at?: string;
          payment_method_id?: string | null;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_maintenance_record_id_vehicle_id_fkey";
            columns: ["maintenance_record_id", "vehicle_id"];
            isOneToOne: false;
            referencedRelation: "maintenance_records";
            referencedColumns: ["id", "vehicle_id"];
          },
          {
            foreignKeyName: "expenses_payment_method_id_fkey";
            columns: ["payment_method_id"];
            isOneToOne: false;
            referencedRelation: "payment_methods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      idempotency_keys: {
        Row: {
          actor_id: string | null;
          created_at: string;
          expires_at: string;
          id: string;
          key: string;
          operation: string;
          request_hash: string;
          safe_response: Json | null;
          updated_at: string;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          expires_at: string;
          id?: string;
          key: string;
          operation: string;
          request_hash: string;
          safe_response?: Json | null;
          updated_at?: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          key?: string;
          operation?: string;
          request_hash?: string;
          safe_response?: Json | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "idempotency_keys_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      inspection_items: {
        Row: {
          condition: string;
          created_at: string;
          id: string;
          inspection_id: string;
          item_key: string;
          notes: string | null;
          updated_at: string;
        };
        Insert: {
          condition: string;
          created_at?: string;
          id?: string;
          inspection_id: string;
          item_key: string;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          condition?: string;
          created_at?: string;
          id?: string;
          inspection_id?: string;
          item_key?: string;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inspection_items_inspection_id_fkey";
            columns: ["inspection_id"];
            isOneToOne: false;
            referencedRelation: "inspections";
            referencedColumns: ["id"];
          },
        ];
      };
      inspection_photos: {
        Row: {
          byte_size: number | null;
          created_at: string;
          id: string;
          inspection_id: string;
          item_id: string | null;
          sha256: string;
          status: string;
          storage_path: string;
          updated_at: string;
        };
        Insert: {
          byte_size?: number | null;
          created_at?: string;
          id?: string;
          inspection_id: string;
          item_id?: string | null;
          sha256: string;
          status?: string;
          storage_path: string;
          updated_at?: string;
        };
        Update: {
          byte_size?: number | null;
          created_at?: string;
          id?: string;
          inspection_id?: string;
          item_id?: string | null;
          sha256?: string;
          status?: string;
          storage_path?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inspection_photos_inspection_id_fkey";
            columns: ["inspection_id"];
            isOneToOne: false;
            referencedRelation: "inspections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_photos_item_id_inspection_id_fkey";
            columns: ["item_id", "inspection_id"];
            isOneToOne: false;
            referencedRelation: "inspection_items";
            referencedColumns: ["id", "inspection_id"];
          },
        ];
      };
      inspection_templates: {
        Row: {
          active: boolean;
          checklist: Json;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          active?: boolean;
          checklist: Json;
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
          version: number;
        };
        Update: {
          active?: boolean;
          checklist?: Json;
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      inspections: {
        Row: {
          checklist_snapshot: Json;
          completed_at: string | null;
          created_at: string;
          fuel: number;
          id: string;
          inspector_id: string;
          kind: string;
          mileage: number;
          notes: string | null;
          rental_id: string;
          template_id: string;
          updated_at: string;
        };
        Insert: {
          checklist_snapshot: Json;
          completed_at?: string | null;
          created_at?: string;
          fuel: number;
          id?: string;
          inspector_id: string;
          kind: string;
          mileage: number;
          notes?: string | null;
          rental_id: string;
          template_id: string;
          updated_at?: string;
        };
        Update: {
          checklist_snapshot?: Json;
          completed_at?: string | null;
          created_at?: string;
          fuel?: number;
          id?: string;
          inspector_id?: string;
          kind?: string;
          mileage?: number;
          notes?: string | null;
          rental_id?: string;
          template_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inspections_inspector_id_fkey";
            columns: ["inspector_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspections_rental_id_fkey";
            columns: ["rental_id"];
            isOneToOne: false;
            referencedRelation: "rentals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspections_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "inspection_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      maintenance_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          detail: Json;
          event_type: string;
          id: string;
          maintenance_id: string;
          updated_at: string;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          detail?: Json;
          event_type: string;
          id?: string;
          maintenance_id: string;
          updated_at?: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          detail?: Json;
          event_type?: string;
          id?: string;
          maintenance_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "maintenance_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_events_maintenance_id_fkey";
            columns: ["maintenance_id"];
            isOneToOne: false;
            referencedRelation: "maintenance_records";
            referencedColumns: ["id"];
          },
        ];
      };
      maintenance_records: {
        Row: {
          actual_end_at: string | null;
          actual_start_at: string | null;
          blocks_availability: boolean;
          created_at: string;
          description: string;
          end_at: string;
          id: string;
          kind: string;
          mileage: number;
          next_due_mileage: number | null;
          next_due_on: string | null;
          responsible_id: string;
          start_at: string;
          status: string;
          updated_at: string;
          vehicle_id: string;
          version: number;
        };
        Insert: {
          actual_end_at?: string | null;
          actual_start_at?: string | null;
          blocks_availability?: boolean;
          created_at?: string;
          description: string;
          end_at: string;
          id?: string;
          kind: string;
          mileage: number;
          next_due_mileage?: number | null;
          next_due_on?: string | null;
          responsible_id: string;
          start_at: string;
          status?: string;
          updated_at?: string;
          vehicle_id: string;
          version?: number;
        };
        Update: {
          actual_end_at?: string | null;
          actual_start_at?: string | null;
          blocks_availability?: boolean;
          created_at?: string;
          description?: string;
          end_at?: string;
          id?: string;
          kind?: string;
          mileage?: number;
          next_due_mileage?: number | null;
          next_due_on?: string | null;
          responsible_id?: string;
          start_at?: string;
          status?: string;
          updated_at?: string;
          vehicle_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "maintenance_records_responsible_id_fkey";
            columns: ["responsible_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_records_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_routes: {
        Row: {
          channel: string;
          created_at: string;
          enabled: boolean;
          event_type: string;
          id: string;
          target: string;
          template_id: string;
          updated_at: string;
        };
        Insert: {
          channel: string;
          created_at?: string;
          enabled?: boolean;
          event_type: string;
          id?: string;
          target: string;
          template_id: string;
          updated_at?: string;
        };
        Update: {
          channel?: string;
          created_at?: string;
          enabled?: boolean;
          event_type?: string;
          id?: string;
          target?: string;
          template_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_routes_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "notification_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_templates: {
        Row: {
          body: string;
          channel: string;
          created_at: string;
          id: string;
          subject: string;
          template_key: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          body: string;
          channel: string;
          created_at?: string;
          id?: string;
          subject?: string;
          template_key: string;
          updated_at?: string;
          version: number;
        };
        Update: {
          body?: string;
          channel?: string;
          created_at?: string;
          id?: string;
          subject?: string;
          template_key?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          attempts: number;
          available_at: string;
          body_snapshot: string | null;
          channel: string;
          created_at: string;
          first_attempt_at: string | null;
          id: string;
          last_error_code: string | null;
          lease_token: string | null;
          locked_until: string | null;
          outbox_event_id: string | null;
          provider_id: string | null;
          read_at: string | null;
          recipient_email: string | null;
          recipient_profile_id: string | null;
          required_permission: string | null;
          resource_id: string | null;
          sender_snapshot: string | null;
          status: string;
          subject_snapshot: string | null;
          template_id: string | null;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          available_at?: string;
          body_snapshot?: string | null;
          channel: string;
          created_at?: string;
          first_attempt_at?: string | null;
          id?: string;
          last_error_code?: string | null;
          lease_token?: string | null;
          locked_until?: string | null;
          outbox_event_id?: string | null;
          provider_id?: string | null;
          read_at?: string | null;
          recipient_email?: string | null;
          recipient_profile_id?: string | null;
          required_permission?: string | null;
          resource_id?: string | null;
          sender_snapshot?: string | null;
          status?: string;
          subject_snapshot?: string | null;
          template_id?: string | null;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          available_at?: string;
          body_snapshot?: string | null;
          channel?: string;
          created_at?: string;
          first_attempt_at?: string | null;
          id?: string;
          last_error_code?: string | null;
          lease_token?: string | null;
          locked_until?: string | null;
          outbox_event_id?: string | null;
          provider_id?: string | null;
          read_at?: string | null;
          recipient_email?: string | null;
          recipient_profile_id?: string | null;
          required_permission?: string | null;
          resource_id?: string | null;
          sender_snapshot?: string | null;
          status?: string;
          subject_snapshot?: string | null;
          template_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_outbox_event_id_fkey";
            columns: ["outbox_event_id"];
            isOneToOne: false;
            referencedRelation: "outbox_events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_recipient_profile_id_fkey";
            columns: ["recipient_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "notification_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      outbox_events: {
        Row: {
          attempts: number;
          available_at: string;
          created_at: string;
          deduplication_key: string;
          event_type: string;
          id: string;
          last_error_code: string | null;
          locked_until: string | null;
          payload: Json;
          status: string;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          available_at?: string;
          created_at?: string;
          deduplication_key: string;
          event_type: string;
          id?: string;
          last_error_code?: string | null;
          locked_until?: string | null;
          payload: Json;
          status?: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          available_at?: string;
          created_at?: string;
          deduplication_key?: string;
          event_type?: string;
          id?: string;
          last_error_code?: string | null;
          locked_until?: string | null;
          payload?: Json;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payment_allocations: {
        Row: {
          amount: number;
          charge_id: string;
          created_at: string;
          customer_id: string;
          id: string;
          payment_id: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          charge_id: string;
          created_at?: string;
          customer_id: string;
          id?: string;
          payment_id: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          charge_id?: string;
          created_at?: string;
          customer_id?: string;
          id?: string;
          payment_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_allocations_charge_id_customer_id_fkey";
            columns: ["charge_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "charges";
            referencedColumns: ["id", "customer_id"];
          },
          {
            foreignKeyName: "payment_allocations_charge_id_customer_id_fkey";
            columns: ["charge_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "finance_charge_balances";
            referencedColumns: ["id", "customer_id"];
          },
          {
            foreignKeyName: "payment_allocations_payment_id_customer_id_fkey";
            columns: ["payment_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id", "customer_id"];
          },
        ];
      };
      payment_methods: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount: number;
          confirmed_at: string;
          confirmed_by: string;
          created_at: string;
          customer_id: string;
          id: string;
          idempotency_key: string;
          payment_method_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          confirmed_at: string;
          confirmed_by: string;
          created_at?: string;
          customer_id: string;
          id?: string;
          idempotency_key: string;
          payment_method_id: string;
          status: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          confirmed_at?: string;
          confirmed_by?: string;
          created_at?: string;
          customer_id?: string;
          id?: string;
          idempotency_key?: string;
          payment_method_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_confirmed_by_fkey";
            columns: ["confirmed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_payment_method_id_fkey";
            columns: ["payment_method_id"];
            isOneToOne: false;
            referencedRelation: "payment_methods";
            referencedColumns: ["id"];
          },
        ];
      };
      permissions: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pricing_rules: {
        Row: {
          created_at: string;
          id: string;
          parameters: Json;
          priority: number;
          rate_plan_id: string;
          rule_type: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          parameters: Json;
          priority?: number;
          rate_plan_id: string;
          rule_type: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          parameters?: Json;
          priority?: number;
          rate_plan_id?: string;
          rule_type?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "pricing_rules_rate_plan_id_fkey";
            columns: ["rate_plan_id"];
            isOneToOne: false;
            referencedRelation: "rate_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          active: boolean;
          created_at: string;
          display_name: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          display_name: string;
          id: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          display_name?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      public_booking_operations: {
        Row: {
          created_at: string;
          id: string;
          key: string;
          operation: string;
          quote_id: string;
          request_hash: string;
          reservation_id: string | null;
          updated_at: string;
          visitor_hash: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          key: string;
          operation: string;
          quote_id: string;
          request_hash: string;
          reservation_id?: string | null;
          updated_at?: string;
          visitor_hash: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          key?: string;
          operation?: string;
          quote_id?: string;
          request_hash?: string;
          reservation_id?: string | null;
          updated_at?: string;
          visitor_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "public_booking_operations_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "public_booking_operations_reservation_id_fkey";
            columns: ["reservation_id"];
            isOneToOne: false;
            referencedRelation: "reservations";
            referencedColumns: ["id"];
          },
        ];
      };
      public_reservation_submissions: {
        Row: {
          accepted_at: string;
          created_at: string;
          customer_data: Json;
          id: string;
          reservation_id: string;
          terms_snapshot: Json;
          terms_version: string;
          updated_at: string;
        };
        Insert: {
          accepted_at?: string;
          created_at?: string;
          customer_data: Json;
          id?: string;
          reservation_id: string;
          terms_snapshot: Json;
          terms_version: string;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string;
          created_at?: string;
          customer_data?: Json;
          id?: string;
          reservation_id?: string;
          terms_snapshot?: Json;
          terms_version?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "public_reservation_submissions_reservation_id_fkey";
            columns: ["reservation_id"];
            isOneToOne: true;
            referencedRelation: "reservations";
            referencedColumns: ["id"];
          },
        ];
      };
      quote_items: {
        Row: {
          additional_service_id: string | null;
          created_at: string;
          description: string;
          id: string;
          kind: string;
          quantity: number;
          quote_id: string;
          snapshot: Json;
          total: number;
          unit_amount: number;
          updated_at: string;
        };
        Insert: {
          additional_service_id?: string | null;
          created_at?: string;
          description: string;
          id?: string;
          kind: string;
          quantity: number;
          quote_id: string;
          snapshot: Json;
          total: number;
          unit_amount: number;
          updated_at?: string;
        };
        Update: {
          additional_service_id?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          kind?: string;
          quantity?: number;
          quote_id?: string;
          snapshot?: Json;
          total?: number;
          unit_amount?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quote_items_additional_service_id_fkey";
            columns: ["additional_service_id"];
            isOneToOne: false;
            referencedRelation: "additional_services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
        ];
      };
      quotes: {
        Row: {
          created_at: string;
          currency: string;
          customer_id: string | null;
          deposit: number;
          end_at: string;
          expires_at: string;
          id: string;
          locked_at: string | null;
          rate_plan_id: string;
          rules_snapshot: Json;
          start_at: string;
          total: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          customer_id?: string | null;
          deposit?: number;
          end_at: string;
          expires_at: string;
          id?: string;
          locked_at?: string | null;
          rate_plan_id: string;
          rules_snapshot: Json;
          start_at: string;
          total: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          customer_id?: string | null;
          deposit?: number;
          end_at?: string;
          expires_at?: string;
          id?: string;
          locked_at?: string | null;
          rate_plan_id?: string;
          rules_snapshot?: Json;
          start_at?: string;
          total?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_rate_plan_id_fkey";
            columns: ["rate_plan_id"];
            isOneToOne: false;
            referencedRelation: "rate_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_limit_buckets: {
        Row: {
          count: number;
          created_at: string;
          expires_at: string;
          id: string;
          scope_key_hash: string;
          updated_at: string;
          window_start: string;
        };
        Insert: {
          count: number;
          created_at?: string;
          expires_at: string;
          id?: string;
          scope_key_hash: string;
          updated_at?: string;
          window_start: string;
        };
        Update: {
          count?: number;
          created_at?: string;
          expires_at?: string;
          id?: string;
          scope_key_hash?: string;
          updated_at?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      rate_plan_prices: {
        Row: {
          amount: number;
          archived_at: string | null;
          category_id: string | null;
          created_at: string;
          id: string;
          name: string;
          rate_plan_id: string;
          updated_at: string;
          valid_from: string | null;
          valid_to: string | null;
          validity: unknown;
          vehicle_id: string | null;
        };
        Insert: {
          amount: number;
          archived_at?: string | null;
          category_id?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          rate_plan_id: string;
          updated_at?: string;
          valid_from?: string | null;
          valid_to?: string | null;
          validity: unknown;
          vehicle_id?: string | null;
        };
        Update: {
          amount?: number;
          archived_at?: string | null;
          category_id?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          rate_plan_id?: string;
          updated_at?: string;
          valid_from?: string | null;
          valid_to?: string | null;
          validity?: unknown;
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "rate_plan_prices_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "vehicle_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rate_plan_prices_rate_plan_id_fkey";
            columns: ["rate_plan_id"];
            isOneToOne: false;
            referencedRelation: "rate_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rate_plan_prices_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_plans: {
        Row: {
          active: boolean;
          archived_at: string | null;
          commercial_month_days: number | null;
          created_at: string;
          id: string;
          month_mode: string | null;
          name: string;
          period_unit: string;
          policy: Json;
          public_enabled: boolean;
          updated_at: string;
          version: number;
        };
        Insert: {
          active?: boolean;
          archived_at?: string | null;
          commercial_month_days?: number | null;
          created_at?: string;
          id?: string;
          month_mode?: string | null;
          name: string;
          period_unit: string;
          policy: Json;
          public_enabled?: boolean;
          updated_at?: string;
          version?: number;
        };
        Update: {
          active?: boolean;
          archived_at?: string | null;
          commercial_month_days?: number | null;
          created_at?: string;
          id?: string;
          month_mode?: string | null;
          name?: string;
          period_unit?: string;
          policy?: Json;
          public_enabled?: boolean;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      refunds: {
        Row: {
          amount: number;
          confirmed_by: string;
          created_at: string;
          deposit_id: string | null;
          id: string;
          payment_allocation_id: string | null;
          payment_id: string | null;
          payment_method_id: string | null;
          reason: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          confirmed_by: string;
          created_at?: string;
          deposit_id?: string | null;
          id?: string;
          payment_allocation_id?: string | null;
          payment_id?: string | null;
          payment_method_id?: string | null;
          reason: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          confirmed_by?: string;
          created_at?: string;
          deposit_id?: string | null;
          id?: string;
          payment_allocation_id?: string | null;
          payment_id?: string | null;
          payment_method_id?: string | null;
          reason?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "refunds_confirmed_by_fkey";
            columns: ["confirmed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refunds_deposit_id_fkey";
            columns: ["deposit_id"];
            isOneToOne: false;
            referencedRelation: "deposits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refunds_payment_allocation_id_payment_id_fkey";
            columns: ["payment_allocation_id", "payment_id"];
            isOneToOne: false;
            referencedRelation: "payment_allocations";
            referencedColumns: ["id", "payment_id"];
          },
          {
            foreignKeyName: "refunds_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refunds_payment_method_id_fkey";
            columns: ["payment_method_id"];
            isOneToOne: false;
            referencedRelation: "payment_methods";
            referencedColumns: ["id"];
          },
        ];
      };
      registry_files: {
        Row: {
          bucket: string;
          byte_size: number;
          category_id: string | null;
          created_at: string;
          customer_id: string | null;
          driver_id: string | null;
          id: string;
          kind: string;
          label: string;
          media_type: string;
          public_visible: boolean;
          sha256: string;
          status: string;
          storage_path: string;
          updated_at: string;
          uploaded_by: string;
          vehicle_id: string | null;
        };
        Insert: {
          bucket: string;
          byte_size: number;
          category_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          driver_id?: string | null;
          id?: string;
          kind: string;
          label: string;
          media_type: string;
          public_visible?: boolean;
          sha256: string;
          status?: string;
          storage_path: string;
          updated_at?: string;
          uploaded_by: string;
          vehicle_id?: string | null;
        };
        Update: {
          bucket?: string;
          byte_size?: number;
          category_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          driver_id?: string | null;
          id?: string;
          kind?: string;
          label?: string;
          media_type?: string;
          public_visible?: boolean;
          sha256?: string;
          status?: string;
          storage_path?: string;
          updated_at?: string;
          uploaded_by?: string;
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "registry_files_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "vehicle_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "registry_files_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "registry_files_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "registry_files_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "registry_files_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      rental_charge_cancellations: {
        Row: {
          actor_id: string;
          charge_id: string;
          created_at: string;
          id: string;
          reason: string;
          rental_id: string;
          updated_at: string;
        };
        Insert: {
          actor_id: string;
          charge_id: string;
          created_at?: string;
          id?: string;
          reason: string;
          rental_id: string;
          updated_at?: string;
        };
        Update: {
          actor_id?: string;
          charge_id?: string;
          created_at?: string;
          id?: string;
          reason?: string;
          rental_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rental_charge_cancellations_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rental_charge_cancellations_charge_id_fkey";
            columns: ["charge_id"];
            isOneToOne: true;
            referencedRelation: "charges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rental_charge_cancellations_charge_id_fkey";
            columns: ["charge_id"];
            isOneToOne: true;
            referencedRelation: "finance_charge_balances";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rental_charge_cancellations_rental_id_fkey";
            columns: ["rental_id"];
            isOneToOne: false;
            referencedRelation: "rentals";
            referencedColumns: ["id"];
          },
        ];
      };
      rental_drivers: {
        Row: {
          created_at: string;
          customer_id: string;
          driver_id: string;
          driver_snapshot: Json;
          id: string;
          rental_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          driver_id: string;
          driver_snapshot: Json;
          id?: string;
          rental_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          driver_id?: string;
          driver_snapshot?: Json;
          id?: string;
          rental_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rental_drivers_driver_id_customer_id_fkey";
            columns: ["driver_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["id", "customer_id"];
          },
          {
            foreignKeyName: "rental_drivers_rental_id_customer_id_fkey";
            columns: ["rental_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "rentals";
            referencedColumns: ["id", "customer_id"];
          },
        ];
      };
      rental_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          detail: Json;
          event_type: string;
          id: string;
          rental_id: string;
          updated_at: string;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          detail?: Json;
          event_type: string;
          id?: string;
          rental_id: string;
          updated_at?: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          detail?: Json;
          event_type?: string;
          id?: string;
          rental_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rental_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rental_events_rental_id_fkey";
            columns: ["rental_id"];
            isOneToOne: false;
            referencedRelation: "rentals";
            referencedColumns: ["id"];
          },
        ];
      };
      rental_extensions: {
        Row: {
          approved_by: string;
          created_at: string;
          id: string;
          new_end_at: string;
          previous_end_at: string;
          quote_id: string;
          rental_id: string;
          updated_at: string;
        };
        Insert: {
          approved_by: string;
          created_at?: string;
          id?: string;
          new_end_at: string;
          previous_end_at: string;
          quote_id: string;
          rental_id: string;
          updated_at?: string;
        };
        Update: {
          approved_by?: string;
          created_at?: string;
          id?: string;
          new_end_at?: string;
          previous_end_at?: string;
          quote_id?: string;
          rental_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rental_extensions_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rental_extensions_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rental_extensions_rental_id_fkey";
            columns: ["rental_id"];
            isOneToOne: false;
            referencedRelation: "rentals";
            referencedColumns: ["id"];
          },
        ];
      };
      rental_locations: {
        Row: {
          address_snapshot: Json;
          branch_id: string | null;
          created_at: string;
          direction: string;
          fee: number;
          id: string;
          instructions: string | null;
          mode: string;
          notes: string | null;
          performed_at: string | null;
          rental_id: string;
          responsible_id: string | null;
          scheduled_at: string;
          updated_at: string;
        };
        Insert: {
          address_snapshot: Json;
          branch_id?: string | null;
          created_at?: string;
          direction: string;
          fee: number;
          id?: string;
          instructions?: string | null;
          mode: string;
          notes?: string | null;
          performed_at?: string | null;
          rental_id: string;
          responsible_id?: string | null;
          scheduled_at: string;
          updated_at?: string;
        };
        Update: {
          address_snapshot?: Json;
          branch_id?: string | null;
          created_at?: string;
          direction?: string;
          fee?: number;
          id?: string;
          instructions?: string | null;
          mode?: string;
          notes?: string | null;
          performed_at?: string | null;
          rental_id?: string;
          responsible_id?: string | null;
          scheduled_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rental_locations_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rental_locations_rental_id_fkey";
            columns: ["rental_id"];
            isOneToOne: false;
            referencedRelation: "rentals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rental_locations_responsible_id_fkey";
            columns: ["responsible_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      rentals: {
        Row: {
          actual_end_at: string | null;
          actual_start_at: string | null;
          branch_id: string;
          commercial_snapshot: Json;
          created_at: string;
          customer_id: string;
          end_at: string;
          final_fuel: number | null;
          final_mileage: number | null;
          id: string;
          initial_fuel: number | null;
          initial_mileage: number | null;
          quote_id: string;
          reservation_id: string | null;
          responsible_id: string;
          start_at: string;
          status: string;
          updated_at: string;
          vehicle_id: string;
          version: number;
        };
        Insert: {
          actual_end_at?: string | null;
          actual_start_at?: string | null;
          branch_id: string;
          commercial_snapshot: Json;
          created_at?: string;
          customer_id: string;
          end_at: string;
          final_fuel?: number | null;
          final_mileage?: number | null;
          id?: string;
          initial_fuel?: number | null;
          initial_mileage?: number | null;
          quote_id: string;
          reservation_id?: string | null;
          responsible_id: string;
          start_at: string;
          status?: string;
          updated_at?: string;
          vehicle_id: string;
          version?: number;
        };
        Update: {
          actual_end_at?: string | null;
          actual_start_at?: string | null;
          branch_id?: string;
          commercial_snapshot?: Json;
          created_at?: string;
          customer_id?: string;
          end_at?: string;
          final_fuel?: number | null;
          final_mileage?: number | null;
          id?: string;
          initial_fuel?: number | null;
          initial_mileage?: number | null;
          quote_id?: string;
          reservation_id?: string | null;
          responsible_id?: string;
          start_at?: string;
          status?: string;
          updated_at?: string;
          vehicle_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "rentals_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rentals_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rentals_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rentals_reservation_id_fkey";
            columns: ["reservation_id"];
            isOneToOne: true;
            referencedRelation: "reservations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rentals_responsible_id_fkey";
            columns: ["responsible_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rentals_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      reservation_items: {
        Row: {
          category_id: string | null;
          created_at: string;
          id: string;
          reservation_id: string;
          updated_at: string;
          vehicle_id: string | null;
        };
        Insert: {
          category_id?: string | null;
          created_at?: string;
          id?: string;
          reservation_id: string;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Update: {
          category_id?: string | null;
          created_at?: string;
          id?: string;
          reservation_id?: string;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reservation_items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "vehicle_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservation_items_reservation_id_fkey";
            columns: ["reservation_id"];
            isOneToOne: true;
            referencedRelation: "reservations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservation_items_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      reservation_locations: {
        Row: {
          address_snapshot: Json;
          branch_id: string | null;
          created_at: string;
          direction: string;
          fee: number;
          id: string;
          instructions: string | null;
          mode: string;
          reservation_id: string;
          scheduled_at: string;
          updated_at: string;
        };
        Insert: {
          address_snapshot: Json;
          branch_id?: string | null;
          created_at?: string;
          direction: string;
          fee: number;
          id?: string;
          instructions?: string | null;
          mode: string;
          reservation_id: string;
          scheduled_at: string;
          updated_at?: string;
        };
        Update: {
          address_snapshot?: Json;
          branch_id?: string | null;
          created_at?: string;
          direction?: string;
          fee?: number;
          id?: string;
          instructions?: string | null;
          mode?: string;
          reservation_id?: string;
          scheduled_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reservation_locations_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservation_locations_reservation_id_fkey";
            columns: ["reservation_id"];
            isOneToOne: false;
            referencedRelation: "reservations";
            referencedColumns: ["id"];
          },
        ];
      };
      reservation_status_history: {
        Row: {
          actor_id: string | null;
          created_at: string;
          from_status: string | null;
          id: string;
          reason: string | null;
          reservation_id: string;
          to_status: string;
          updated_at: string;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          from_status?: string | null;
          id?: string;
          reason?: string | null;
          reservation_id: string;
          to_status: string;
          updated_at?: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          from_status?: string | null;
          id?: string;
          reason?: string | null;
          reservation_id?: string;
          to_status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reservation_status_history_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservation_status_history_reservation_id_fkey";
            columns: ["reservation_id"];
            isOneToOne: false;
            referencedRelation: "reservations";
            referencedColumns: ["id"];
          },
        ];
      };
      reservations: {
        Row: {
          approved_by: string | null;
          branch_id: string;
          created_at: string;
          customer_id: string;
          end_at: string;
          expires_at: string | null;
          id: string;
          lookup_expires_at: string;
          lookup_token_hash: string;
          quote_id: string;
          source_quote_id: string;
          start_at: string;
          status: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          approved_by?: string | null;
          branch_id: string;
          created_at?: string;
          customer_id: string;
          end_at: string;
          expires_at?: string | null;
          id?: string;
          lookup_expires_at: string;
          lookup_token_hash: string;
          quote_id: string;
          source_quote_id: string;
          start_at: string;
          status?: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          approved_by?: string | null;
          branch_id?: string;
          created_at?: string;
          customer_id?: string;
          end_at?: string;
          expires_at?: string | null;
          id?: string;
          lookup_expires_at?: string;
          lookup_token_hash?: string;
          quote_id?: string;
          source_quote_id?: string;
          start_at?: string;
          status?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "reservations_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservations_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservations_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservations_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: true;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservations_source_quote_id_fkey";
            columns: ["source_quote_id"];
            isOneToOne: true;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
        ];
      };
      role_permissions: {
        Row: {
          created_at: string;
          id: string;
          permission_id: string;
          role_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          permission_id: string;
          role_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          permission_id?: string;
          role_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey";
            columns: ["permission_id"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      roles: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      system_settings: {
        Row: {
          created_at: string;
          id: string;
          key: string;
          updated_at: string;
          value: Json;
          version: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          key: string;
          updated_at?: string;
          value: Json;
          version?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          key?: string;
          updated_at?: string;
          value?: Json;
          version?: number;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicle_allocations: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          kind: string;
          maintenance_record_id: string | null;
          period: unknown;
          released_at: string | null;
          rental_id: string | null;
          reservation_id: string | null;
          updated_at: string;
          vehicle_block_id: string | null;
          vehicle_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          kind: string;
          maintenance_record_id?: string | null;
          period: unknown;
          released_at?: string | null;
          rental_id?: string | null;
          reservation_id?: string | null;
          updated_at?: string;
          vehicle_block_id?: string | null;
          vehicle_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          kind?: string;
          maintenance_record_id?: string | null;
          period?: unknown;
          released_at?: string | null;
          rental_id?: string | null;
          reservation_id?: string | null;
          updated_at?: string;
          vehicle_block_id?: string | null;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_allocations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vehicle_allocations_maintenance_record_id_fkey";
            columns: ["maintenance_record_id"];
            isOneToOne: false;
            referencedRelation: "maintenance_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vehicle_allocations_rental_id_fkey";
            columns: ["rental_id"];
            isOneToOne: false;
            referencedRelation: "rentals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vehicle_allocations_reservation_id_fkey";
            columns: ["reservation_id"];
            isOneToOne: false;
            referencedRelation: "reservations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vehicle_allocations_vehicle_block_id_fkey";
            columns: ["vehicle_block_id"];
            isOneToOne: false;
            referencedRelation: "vehicle_blocks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vehicle_allocations_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicle_blocks: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string;
          end_at: string;
          id: string;
          reason: string;
          start_at: string;
          updated_at: string;
          vehicle_id: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by: string;
          end_at: string;
          id?: string;
          reason: string;
          start_at: string;
          updated_at?: string;
          vehicle_id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string;
          end_at?: string;
          id?: string;
          reason?: string;
          start_at?: string;
          updated_at?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_blocks_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vehicle_blocks_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicle_categories: {
        Row: {
          active: boolean;
          archived_at: string | null;
          capacity: number;
          created_at: string;
          description: string;
          features: Json;
          id: string;
          image_path: string | null;
          name: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          archived_at?: string | null;
          capacity: number;
          created_at?: string;
          description?: string;
          features?: Json;
          id?: string;
          image_path?: string | null;
          name: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          archived_at?: string | null;
          capacity?: number;
          created_at?: string;
          description?: string;
          features?: Json;
          id?: string;
          image_path?: string | null;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vehicle_documents: {
        Row: {
          created_at: string;
          document_type: string;
          id: string;
          storage_path: string;
          updated_at: string;
          vehicle_id: string;
        };
        Insert: {
          created_at?: string;
          document_type: string;
          id?: string;
          storage_path: string;
          updated_at?: string;
          vehicle_id: string;
        };
        Update: {
          created_at?: string;
          document_type?: string;
          id?: string;
          storage_path?: string;
          updated_at?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_documents_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicle_images: {
        Row: {
          alt_text: string;
          created_at: string;
          id: string;
          sort_order: number;
          storage_path: string;
          updated_at: string;
          vehicle_id: string;
        };
        Insert: {
          alt_text: string;
          created_at?: string;
          id?: string;
          sort_order?: number;
          storage_path: string;
          updated_at?: string;
          vehicle_id: string;
        };
        Update: {
          alt_text?: string;
          created_at?: string;
          id?: string;
          sort_order?: number;
          storage_path?: string;
          updated_at?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_images_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicle_status_events: {
        Row: {
          archived: boolean;
          baseline: boolean;
          created_at: string;
          id: string;
          operational_status: string;
          recorded_at: string;
          updated_at: string;
          vehicle_id: string;
        };
        Insert: {
          archived: boolean;
          baseline?: boolean;
          created_at?: string;
          id?: string;
          operational_status: string;
          recorded_at?: string;
          updated_at?: string;
          vehicle_id: string;
        };
        Update: {
          archived?: boolean;
          baseline?: boolean;
          created_at?: string;
          id?: string;
          operational_status?: string;
          recorded_at?: string;
          updated_at?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_status_events_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicles: {
        Row: {
          acquired_on: string | null;
          archived_at: string | null;
          branch_id: string;
          category_id: string;
          chassis: string | null;
          color: string;
          created_at: string;
          description: string;
          doors: number;
          features: Json;
          fuel: string;
          id: string;
          internal_notes: string | null;
          make: string;
          manufacture_year: number;
          mileage: number;
          model: string;
          model_year: number;
          operational_status: string;
          passengers: number;
          plate: string;
          renavam: string | null;
          transmission: string;
          updated_at: string;
          version: string;
        };
        Insert: {
          acquired_on?: string | null;
          archived_at?: string | null;
          branch_id: string;
          category_id: string;
          chassis?: string | null;
          color: string;
          created_at?: string;
          description?: string;
          doors: number;
          features?: Json;
          fuel: string;
          id?: string;
          internal_notes?: string | null;
          make: string;
          manufacture_year: number;
          mileage?: number;
          model: string;
          model_year: number;
          operational_status?: string;
          passengers: number;
          plate: string;
          renavam?: string | null;
          transmission: string;
          updated_at?: string;
          version?: string;
        };
        Update: {
          acquired_on?: string | null;
          archived_at?: string | null;
          branch_id?: string;
          category_id?: string;
          chassis?: string | null;
          color?: string;
          created_at?: string;
          description?: string;
          doors?: number;
          features?: Json;
          fuel?: string;
          id?: string;
          internal_notes?: string | null;
          make?: string;
          manufacture_year?: number;
          mileage?: number;
          model?: string;
          model_year?: number;
          operational_status?: string;
          passengers?: number;
          plate?: string;
          renavam?: string | null;
          transmission?: string;
          updated_at?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicles_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vehicles_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "vehicle_categories";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      finance_charge_balances: {
        Row: {
          amount: number | null;
          balance: number | null;
          customer_id: string | null;
          due_at: string | null;
          id: string | null;
          rental_id: string | null;
        };
        Insert: {
          amount?: number | null;
          balance?: never;
          customer_id?: string | null;
          due_at?: string | null;
          id?: string | null;
          rental_id?: string | null;
        };
        Update: {
          amount?: number | null;
          balance?: never;
          customer_id?: string | null;
          due_at?: string | null;
          id?: string | null;
          rental_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "charges_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "charges_rental_id_customer_id_fkey";
            columns: ["rental_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "rentals";
            referencedColumns: ["id", "customer_id"];
          },
        ];
      };
      finance_contracts: {
        Row: {
          contracted_total: string | null;
          customer_id: string | null;
          generation_status: string | null;
          id: string | null;
          rental_id: string | null;
          version: number | null;
        };
        Relationships: [];
      };
      finance_customers: {
        Row: {
          id: string | null;
          name: string | null;
          person_type: string | null;
        };
        Relationships: [];
      };
      finance_reservations: {
        Row: {
          customer_id: string | null;
          end_at: string | null;
          id: string | null;
          quote_id: string | null;
          start_at: string | null;
          status: string | null;
        };
        Relationships: [];
      };
      finance_vehicles: {
        Row: {
          category_id: string | null;
          id: string | null;
          make: string | null;
          model: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      approve_reservation: {
        Args: { idempotency_key: string; reservation_id: string };
        Returns: Json;
      };
      archive_registry_file: { Args: { file_id: string }; Returns: undefined };
      audit_report_export: {
        Args: {
          from_at: string;
          page: number;
          report_kind: string;
          row_count: number;
          to_at: string;
        };
        Returns: undefined;
      };
      business_dashboard: {
        Args: { from_at: string; to_at: string };
        Returns: Json;
      };
      business_report: {
        Args: {
          from_at: string;
          page?: number;
          page_size?: number;
          report_kind: string;
          to_at: string;
        };
        Returns: Json;
      };
      cancel_settled_rental: {
        Args: { idempotency_key: string; input: Json };
        Returns: Json;
      };
      catalog_categories: {
        Args: never;
        Returns: {
          capacity: number;
          description: string;
          features: Json;
          id: string;
          name: string;
        }[];
      };
      catalog_vehicles: {
        Args: {
          page?: number;
          page_size?: number;
          requested_category_id?: string;
        };
        Returns: {
          category_id: string;
          description: string;
          doors: number;
          features: Json;
          fuel: string;
          id: string;
          make: string;
          model: string;
          model_year: number;
          passengers: number;
          transmission: string;
          version: string;
        }[];
      };
      claim_contract_jobs: {
        Args: { batch_size: number };
        Returns: {
          attempts: number;
          available_at: string;
          created_at: string;
          generation_status: string;
          id: string;
          last_error_code: string | null;
          lease_token: string | null;
          locked_until: string | null;
          rental_id: string;
          sha256: string | null;
          snapshot: Json;
          storage_path: string | null;
          template_id: string;
          updated_at: string;
          version: number;
        }[];
        SetofOptions: {
          from: "*";
          to: "contracts";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      claim_email_notifications: {
        Args: { batch_size: number; sender: string };
        Returns: {
          attempts: number;
          available_at: string;
          body_snapshot: string | null;
          channel: string;
          created_at: string;
          first_attempt_at: string | null;
          id: string;
          last_error_code: string | null;
          lease_token: string | null;
          locked_until: string | null;
          outbox_event_id: string | null;
          provider_id: string | null;
          read_at: string | null;
          recipient_email: string | null;
          recipient_profile_id: string | null;
          required_permission: string | null;
          resource_id: string | null;
          sender_snapshot: string | null;
          status: string;
          subject_snapshot: string | null;
          template_id: string | null;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "notifications";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      confirm_charge_payment: {
        Args: {
          amount: number;
          charge_id: string;
          idempotency_key: string;
          payment_method_id: string;
          received: boolean;
        };
        Returns: Json;
      };
      consume_auth_limit: {
        Args: {
          key_hash: string;
          max_attempts: number;
          window_seconds: number;
        };
        Returns: boolean;
      };
      create_rental: {
        Args: { idempotency_key: string; input: Json };
        Returns: Json;
      };
      create_vehicle_block: {
        Args: {
          end_at: string;
          idempotency_key: string;
          reason: string;
          start_at: string;
          vehicle_id: string;
        };
        Returns: Json;
      };
      decide_staff_reservation: {
        Args: {
          expected_version: number;
          idempotency_key: string;
          reason: string;
          reservation_id: string;
          target_status: string;
        };
        Returns: Json;
      };
      dispatch_notification_events: {
        Args: { batch_size: number };
        Returns: Json;
      };
      expire_pending_reservations: {
        Args: { batch_size?: number };
        Returns: number;
      };
      extend_rental: {
        Args: { idempotency_key: string; quote_id: string; rental_id: string };
        Returns: Json;
      };
      finance_command: {
        Args: { idempotency_key: string; input: Json };
        Returns: Json;
      };
      finance_configuration: {
        Args: { idempotency_key: string; input: Json };
        Returns: Json;
      };
      finance_options: { Args: { search?: string }; Returns: Json };
      finance_register: {
        Args: {
          customer?: string;
          kind: string;
          page?: number;
          rental?: string;
        };
        Returns: Json;
      };
      find_public_operation: {
        Args: {
          idempotency_key: string;
          operation: string;
          payload: Json;
          visitor_hash: string;
        };
        Returns: Json;
      };
      find_staff_quote_operation: {
        Args: { idempotency_key: string; input: Json };
        Returns: Json;
      };
      finish_contract_job: {
        Args: {
          contract_id: string;
          file_hash: string;
          lease: string;
          path: string;
        };
        Returns: boolean;
      };
      finish_email_notification: {
        Args: {
          error_code: string;
          lease: string;
          notification_id: string;
          permanent: boolean;
          provider_message_id: string;
        };
        Returns: boolean;
      };
      finish_inspection_photo: {
        Args: { photo_id: string; success: boolean };
        Returns: undefined;
      };
      has_permission: { Args: { permission_code: string }; Returns: boolean };
      maintenance_alerts: { Args: never; Returns: Json };
      maintenance_command: {
        Args: { idempotency_key: string; input: Json };
        Returns: Json;
      };
      mark_overdue_rentals: { Args: { batch_size: number }; Returns: number };
      notification_job_status: { Args: never; Returns: Json };
      notification_setup: {
        Args: { idempotency_key: string; input: Json };
        Returns: Json;
      };
      operational_readiness: { Args: never; Returns: Json };
      persist_public_quote: {
        Args: {
          calculation: Json;
          expected_fingerprint: string;
          idempotency_key: string;
          input: Json;
          visitor_hash: string;
        };
        Returns: Json;
      };
      persist_staff_quote: {
        Args: {
          actor_id: string;
          calculation: Json;
          expected_fingerprint: string;
          idempotency_key: string;
          input: Json;
          session_id: string;
        };
        Returns: Json;
      };
      prepare_inspection_photo: { Args: { input: Json }; Returns: Json };
      public_booking_options: { Args: never; Returns: Json };
      public_catalog: {
        Args: { filters: Json; vehicle_id?: string };
        Returns: Json;
      };
      public_image_path: { Args: { file_id: string }; Returns: string };
      public_pricing_context: { Args: { input: Json }; Returns: Json };
      public_quote_owned: {
        Args: { quote_id: string; visitor_hash: string };
        Returns: Json;
      };
      public_quote_stock: {
        Args: { quote_id: string; visitor_hash: string };
        Returns: number;
      };
      public_site: { Args: never; Returns: Json };
      publish_catalog_image: {
        Args: { file_id: string; published: boolean };
        Returns: undefined;
      };
      queue_maintenance_alerts: {
        Args: { batch_size: number };
        Returns: number;
      };
      read_notification: {
        Args: { notification_id: string };
        Returns: undefined;
      };
      record_auth_event: { Args: { event_code: string }; Returns: undefined };
      rental_command: {
        Args: { idempotency_key: string; input: Json };
        Returns: Json;
      };
      rental_setup: {
        Args: { idempotency_key: string; input: Json };
        Returns: Json;
      };
      request_public_reservation: {
        Args: {
          customer_data: Json;
          idempotency_key: string;
          quote_id: string;
          terms_version: string;
          token_hash: string;
          visitor_hash: string;
        };
        Returns: Json;
      };
      request_staff_reservation: {
        Args: {
          customer_id: string;
          idempotency_key: string;
          quote_id: string;
          token_hash: string;
        };
        Returns: Json;
      };
      reservation_status_by_token: {
        Args: { reservation_id: string; token_hash: string };
        Returns: Json;
      };
      retry_notification: {
        Args: { idempotency_key: string; input: Json };
        Returns: Json;
      };
      set_public_site: {
        Args: { expected_version: number; input: Json };
        Returns: number;
      };
      set_staff_access: {
        Args: { active: boolean; role_code: string; user_id: string };
        Returns: undefined;
      };
      staff_availability: { Args: { input: Json }; Returns: Json };
      staff_context: { Args: never; Returns: Json };
      staff_pricing_context: { Args: { input: Json }; Returns: Json };
      transition_reservation: {
        Args: {
          idempotency_key: string;
          reason: string;
          reservation_id: string;
          target_status: string;
        };
        Returns: Json;
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

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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

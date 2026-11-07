// Tipos TypeScript para Supabase / Postgres generados y mantenidos a mano
// según el esquema baseline de migraciones (0001_private_helpers..0008_immutability_triggers).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: "owner" | "cashier";
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          role?: "owner" | "cashier";
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          role?: "owner" | "cashier";
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      business_settings: {
        Row: {
          id: number;
          name: string;
          legal_name: string | null;
          currency_code: string;
          currency_symbol: string;
          logo_url: string | null;
          allow_negative_stock: boolean;
          low_stock_default: number;
          cashier_can_discount: boolean;
          cashier_max_discount_cents: number;
          operating_mode: "micromarket" | "restaurant";
          enable_held_sales: boolean;
          order_charge_timing: "on_order" | "on_consumption";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name?: string;
          legal_name?: string | null;
          currency_code?: string;
          currency_symbol?: string;
          logo_url?: string | null;
          allow_negative_stock?: boolean;
          low_stock_default?: number;
          cashier_can_discount?: boolean;
          cashier_max_discount_cents?: number;
          operating_mode?: "micromarket" | "restaurant";
          enable_held_sales?: boolean;
          order_charge_timing?: "on_order" | "on_consumption";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          legal_name?: string | null;
          currency_code?: string;
          currency_symbol?: string;
          logo_url?: string | null;
          allow_negative_stock?: boolean;
          low_stock_default?: number;
          cashier_can_discount?: boolean;
          cashier_max_discount_cents?: number;
          operating_mode?: "micromarket" | "restaurant";
          enable_held_sales?: boolean;
          order_charge_timing?: "on_order" | "on_consumption";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          sort_order: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          sort_order?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          sort_order?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          name: string;
          barcode: string | null;
          internal_code: string | null;
          category_id: string | null;
          unit_label: string;
          price_cents: number;
          cost_cents: number | null;
          stock_qty: number;
          min_stock: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          barcode?: string | null;
          internal_code?: string | null;
          category_id?: string | null;
          unit_label?: string;
          price_cents: number;
          cost_cents?: number | null;
          stock_qty?: number;
          min_stock?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          barcode?: string | null;
          internal_code?: string | null;
          category_id?: string | null;
          unit_label?: string;
          price_cents?: number;
          cost_cents?: number | null;
          stock_qty?: number;
          min_stock?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      cash_sessions: {
        Row: {
          id: string;
          opened_by: string;
          opened_at: string;
          opening_cents: number;
          closed_by: string | null;
          closed_at: string | null;
          expected_cash_cents: number | null;
          counted_cash_cents: number | null;
          difference_cents: number | null;
          status: "open" | "closed";
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          opened_by: string;
          opened_at?: string;
          opening_cents: number;
          closed_by?: string | null;
          closed_at?: string | null;
          expected_cash_cents?: number | null;
          counted_cash_cents?: number | null;
          difference_cents?: number | null;
          status?: "open" | "closed";
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          opened_by?: string;
          opened_at?: string;
          opening_cents?: number;
          closed_by?: string | null;
          closed_at?: string | null;
          expected_cash_cents?: number | null;
          counted_cash_cents?: number | null;
          difference_cents?: number | null;
          status?: "open" | "closed";
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cash_sessions_opened_by_fkey";
            columns: ["opened_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cash_sessions_closed_by_fkey";
            columns: ["closed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      cash_movements: {
        Row: {
          id: string;
          session_id: string;
          kind: "in" | "out";
          amount_cents: number;
          reason: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          kind: "in" | "out";
          amount_cents: number;
          reason: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          kind?: "in" | "out";
          amount_cents?: number;
          reason?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cash_movements_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "cash_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cash_movements_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      sales: {
        Row: {
          id: string;
          number: number;
          session_id: string;
          cashier_id: string;
          status: "paid" | "voided";
          subtotal_cents: number;
          discount_cents: number;
          total_cents: number;
          payment_method: "cash" | "qr" | "card";
          cash_received_cents: number | null;
          client_request_id: string;
          voided_by: string | null;
          voided_at: string | null;
          void_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          number?: never;
          session_id: string;
          cashier_id: string;
          status?: "paid" | "voided";
          subtotal_cents: number;
          discount_cents?: number;
          total_cents: number;
          payment_method: "cash" | "qr" | "card";
          cash_received_cents?: number | null;
          client_request_id: string;
          voided_by?: string | null;
          voided_at?: string | null;
          void_reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          number?: never;
          session_id?: string;
          cashier_id?: string;
          status?: "paid" | "voided";
          subtotal_cents?: number;
          discount_cents?: number;
          total_cents?: number;
          payment_method?: "cash" | "qr" | "card";
          cash_received_cents?: number | null;
          client_request_id?: string;
          voided_by?: string | null;
          voided_at?: string | null;
          void_reason?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sales_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "cash_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_cashier_id_fkey";
            columns: ["cashier_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_voided_by_fkey";
            columns: ["voided_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      sale_items: {
        Row: {
          id: string;
          sale_id: string;
          product_id: string | null;
          name_snapshot: string;
          unit_price_cents: number;
          quantity: number;
          line_total_cents: number;
        };
        Insert: {
          id?: string;
          sale_id: string;
          product_id?: string | null;
          name_snapshot: string;
          unit_price_cents: number;
          quantity: number;
          line_total_cents: number;
        };
        Update: {
          id?: string;
          sale_id?: string;
          product_id?: string | null;
          name_snapshot?: string;
          unit_price_cents?: number;
          quantity?: number;
          line_total_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      held_sales: {
        Row: {
          id: string;
          cashier_id: string;
          label: string;
          items: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cashier_id: string;
          label: string;
          items?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cashier_id?: string;
          label?: string;
          items?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "held_sales_cashier_id_fkey";
            columns: ["cashier_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          order_number: number;
          session_id: string;
          created_by: string;
          status: "pendiente" | "en_preparacion" | "listo" | "entregado" | "cancelado";
          payment_status: "pendiente" | "pagado";
          sale_id: string | null;
          subtotal_cents: number;
          discount_cents: number;
          total_cents: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
          preparing_at: string | null;
          ready_at: string | null;
          delivered_at: string | null;
          cancelled_at: string | null;
        };
        Insert: {
          id?: string;
          order_number?: never;
          session_id: string;
          created_by?: string;
          status?: "pendiente" | "en_preparacion" | "listo" | "entregado" | "cancelado";
          payment_status?: "pendiente" | "pagado";
          sale_id?: string | null;
          subtotal_cents: number;
          discount_cents?: number;
          total_cents: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          preparing_at?: string | null;
          ready_at?: string | null;
          delivered_at?: string | null;
          cancelled_at?: string | null;
        };
        Update: {
          id?: string;
          order_number?: never;
          session_id?: string;
          created_by?: string;
          status?: "pendiente" | "en_preparacion" | "listo" | "entregado" | "cancelado";
          payment_status?: "pendiente" | "pagado";
          sale_id?: string | null;
          subtotal_cents?: number;
          discount_cents?: number;
          total_cents?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          preparing_at?: string | null;
          ready_at?: string | null;
          delivered_at?: string | null;
          cancelled_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "orders_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "cash_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          name_snapshot: string;
          unit_price_cents: number;
          quantity: number;
          line_total_cents: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          name_snapshot: string;
          unit_price_cents: number;
          quantity: number;
          line_total_cents: number;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string | null;
          name_snapshot?: string;
          unit_price_cents?: number;
          quantity?: number;
          line_total_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_movements: {
        Row: {
          id: string;
          product_id: string;
          kind: "sale" | "purchase" | "adjustment" | "waste" | "void_return";
          delta: number;
          reason: string | null;
          ref_type: "sale" | "purchase" | "adjustment" | "manual" | null;
          ref_id: string | null;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          kind: "sale" | "purchase" | "adjustment" | "waste" | "void_return";
          delta: number;
          reason?: string | null;
          ref_type?: "sale" | "purchase" | "adjustment" | "manual" | null;
          ref_id?: string | null;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          kind?: "sale" | "purchase" | "adjustment" | "waste" | "void_return";
          delta?: number;
          reason?: string | null;
          ref_type?: "sale" | "purchase" | "adjustment" | "manual" | null;
          ref_id?: string | null;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      suppliers: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          notes: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone?: string | null;
          notes?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string | null;
          notes?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      purchases: {
        Row: {
          id: string;
          supplier_id: string | null;
          status: "draft" | "ordered" | "partial" | "received" | "cancelled";
          notes: string | null;
          total_cents: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id?: string | null;
          status?: "draft" | "ordered" | "partial" | "received" | "cancelled";
          notes?: string | null;
          total_cents?: number;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          supplier_id?: string | null;
          status?: "draft" | "ordered" | "partial" | "received" | "cancelled";
          notes?: string | null;
          total_cents?: number;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchases_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchases_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_items: {
        Row: {
          id: string;
          purchase_id: string;
          product_id: string;
          qty_ordered: number;
          qty_received: number;
          unit_cost_cents: number;
        };
        Insert: {
          id?: string;
          purchase_id: string;
          product_id: string;
          qty_ordered: number;
          qty_received?: number;
          unit_cost_cents: number;
        };
        Update: {
          id?: string;
          purchase_id?: string;
          product_id?: string;
          qty_ordered?: number;
          qty_received?: number;
          unit_cost_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_items_purchase_id_fkey";
            columns: ["purchase_id"];
            isOneToOne: false;
            referencedRelation: "purchases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          id: string;
          at: string;
          user_id: string;
          action: string;
          entity: string;
          entity_id: string | null;
          summary: Json;
          reason: string | null;
        };
        Insert: {
          id?: string;
          at?: string;
          user_id: string;
          action: string;
          entity: string;
          entity_id?: string | null;
          summary?: Json;
          reason?: string | null;
        };
        Update: {
          id?: string;
          at?: string;
          user_id?: string;
          action?: string;
          entity?: string;
          entity_id?: string | null;
          summary?: Json;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      products_pos: {
        Row: {
          id: string;
          name: string;
          barcode: string | null;
          internal_code: string | null;
          category_id: string | null;
          unit_label: string;
          price_cents: number;
          stock_qty: number;
          min_stock: number;
          active: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      get_business_public: {
        Args: Record<PropertyKey, never>;
        Returns: {
          name: string;
          legal_name: string | null;
          currency_code: string;
          currency_symbol: string;
          logo_url: string | null;
          allow_negative_stock: boolean;
          low_stock_default: number;
          cashier_can_discount: boolean;
          cashier_max_discount_cents: number;
          operating_mode: "micromarket" | "restaurant";
          enable_held_sales: boolean;
          order_charge_timing: "on_order" | "on_consumption";
        }[];
      };
      products_with_cost: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          name: string;
          barcode: string | null;
          internal_code: string | null;
          category_id: string | null;
          unit_label: string;
          price_cents: number;
          cost_cents: number | null;
          stock_qty: number;
          min_stock: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        }[];
      };
      write_audit_log: {
        Args: {
          p_action: string;
          p_entity: string;
          p_entity_id?: string | null;
          p_summary?: Json;
          p_reason?: string | null;
        };
        Returns: string;
      };
      open_cash_session: {
        Args: {
          p_opening_cents: number;
          p_notes?: string | null;
        };
        Returns: string;
      };
      add_cash_movement: {
        Args: {
          p_session_id: string;
          p_kind: string;
          p_amount_cents: number;
          p_reason: string;
        };
        Returns: string;
      };
      close_cash_session: {
        Args: {
          p_session_id: string;
          p_counted_cents: number;
          p_notes?: string | null;
        };
        Returns: string;
      };
      get_open_cash_session_public: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          opened_at: string;
          opened_by: string;
          opened_by_name: string;
        }[];
      };
      confirm_sale: {
        Args: {
          p_session_id: string;
          p_payment_method: string;
          p_client_request_id: string;
          p_items: Json;
          p_discount_cents?: number;
          p_cash_received_cents?: number | null;
        };
        Returns: string;
      };
      void_sale: {
        Args: {
          p_sale_id: string;
          p_reason: string;
        };
        Returns: string;
      };
      adjust_stock: {
        Args: {
          p_product_id: string;
          p_delta: number;
          p_kind: string;
          p_reason: string;
        };
        Returns: number;
      };
      receive_purchase: {
        Args: {
          p_purchase_id: string;
          p_items: Json;
          p_update_cost?: boolean;
        };
        Returns: string;
      };
      create_order: {
        Args: {
          p_session_id: string;
          p_items: Json;
          p_discount_cents?: number;
          p_notes?: string | null;
        };
        Returns: string;
      };
      charge_order: {
        Args: {
          p_order_id: string;
          p_payment_method: string;
          p_client_request_id: string;
          p_cash_received_cents?: number | null;
        };
        Returns: string;
      };
    };
    Enums: {
      user_role: "owner" | "cashier";
      cash_session_status: "open" | "closed";
      cash_movement_kind: "in" | "out";
      sale_status: "paid" | "voided";
      payment_method: "cash" | "qr" | "card";
      stock_movement_kind: "sale" | "purchase" | "adjustment" | "waste" | "void_return";
      purchase_status: "draft" | "ordered" | "partial" | "received" | "cancelled";
      order_status: "pendiente" | "en_preparacion" | "listo" | "entregado" | "cancelado";
      order_payment_status: "pendiente" | "pagado";
      operating_mode: "micromarket" | "restaurant";
      order_charge_timing: "on_order" | "on_consumption";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Helpers para inferir tipos de fila, inserción y actualización
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Views<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"];

export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];

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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      absences: {
        Row: {
          absence_type: string | null
          ai_validated_at: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          document_ai_check: Json | null
          document_url: string | null
          document_validated: boolean | null
          employee_id: string
          end_date: string
          id: string
          reason: string | null
          rejection_reason: string | null
          start_date: string
          status: string | null
          total_days: number | null
          type: string
          updated_at: string | null
        }
        Insert: {
          absence_type?: string | null
          ai_validated_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          document_ai_check?: Json | null
          document_url?: string | null
          document_validated?: boolean | null
          employee_id: string
          end_date: string
          id?: string
          reason?: string | null
          rejection_reason?: string | null
          start_date: string
          status?: string | null
          total_days?: number | null
          type: string
          updated_at?: string | null
        }
        Update: {
          absence_type?: string | null
          ai_validated_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          document_ai_check?: Json | null
          document_url?: string | null
          document_validated?: boolean | null
          employee_id?: string
          end_date?: string
          id?: string
          reason?: string | null
          rejection_reason?: string | null
          start_date?: string
          status?: string | null
          total_days?: number | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "absences_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          created_at: string
          id: string
          message: string
          related_of_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          related_of_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          related_of_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_related_of_id_fkey"
            columns: ["related_of_id"]
            isOneToOne: false
            referencedRelation: "fabrication_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string | null
          date: string
          employee_id: string
          id: string
          notes: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string | null
          date: string
          employee_id: string
          id?: string
          notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string | null
          date?: string
          employee_id?: string
          id?: string
          notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          created_at: string | null
          document_name: string | null
          document_type: string
          employee_id: string
          expiry_date: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          issue_date: string | null
          required: boolean | null
          status: string | null
          updated_at: string | null
          uploaded_by: string | null
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string | null
          document_name?: string | null
          document_type: string
          employee_id: string
          expiry_date?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          issue_date?: string | null
          required?: boolean | null
          status?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string | null
          document_name?: string | null
          document_type?: string
          employee_id?: string
          expiry_date?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          issue_date?: string | null
          required?: boolean | null
          status?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean | null
          contract_type: string
          created_at: string | null
          department: string
          dni: string
          email: string
          employee_code: string
          full_name: string
          hire_date: string
          id: string
          phone: string | null
          position: string
          termination_date: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          contract_type: string
          created_at?: string | null
          department: string
          dni: string
          email: string
          employee_code: string
          full_name: string
          hire_date: string
          id?: string
          phone?: string | null
          position: string
          termination_date?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          contract_type?: string
          created_at?: string | null
          department?: string
          dni?: string
          email?: string
          employee_code?: string
          full_name?: string
          hire_date?: string
          id?: string
          phone?: string | null
          position?: string
          termination_date?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ett_employees: {
        Row: {
          active: boolean | null
          agency: string
          contract_end: string | null
          contract_start: string
          created_at: string | null
          employee_id: string
          hourly_rate: number
          id: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          agency: string
          contract_end?: string | null
          contract_start: string
          created_at?: string | null
          employee_id: string
          hourly_rate: number
          id?: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          agency?: string
          contract_end?: string | null
          contract_start?: string
          created_at?: string | null
          employee_id?: string
          hourly_rate?: number
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ett_employees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      ett_invoices: {
        Row: {
          agency: string
          created_at: string | null
          discrepancies: Json | null
          extracted_data: Json | null
          file_size: number | null
          file_url: string
          id: string
          invoice_date: string
          invoice_number: string
          period_end: string
          period_start: string
          total_amount: number
          updated_at: string | null
          validated: boolean | null
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          agency: string
          created_at?: string | null
          discrepancies?: Json | null
          extracted_data?: Json | null
          file_size?: number | null
          file_url: string
          id?: string
          invoice_date: string
          invoice_number: string
          period_end: string
          period_start: string
          total_amount: number
          updated_at?: string | null
          validated?: boolean | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          agency?: string
          created_at?: string | null
          discrepancies?: Json | null
          extracted_data?: Json | null
          file_size?: number | null
          file_url?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          period_end?: string
          period_start?: string
          total_amount?: number
          updated_at?: string | null
          validated?: boolean | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: []
      }
      fabrication_orders: {
        Row: {
          assignee_id: string | null
          completed_at: string | null
          created_at: string
          customer: string
          id: string
          line_id: string | null
          priority: number | null
          sap_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["of_status"]
          supervisor_id: string | null
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          customer: string
          id?: string
          line_id?: string | null
          priority?: number | null
          sap_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["of_status"]
          supervisor_id?: string | null
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          customer?: string
          id?: string
          line_id?: string | null
          priority?: number | null
          sap_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["of_status"]
          supervisor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fabrication_orders_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "production_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll: {
        Row: {
          advisor_data: Json | null
          base_salary: number | null
          bonuses: number | null
          created_at: string | null
          deductions: number | null
          discrepancies: Json | null
          employee_id: string
          extras: number | null
          gross_salary: number | null
          has_discrepancies: boolean | null
          id: string
          internal_data: Json | null
          net_salary: number | null
          period: string
          status: string | null
          updated_at: string | null
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          advisor_data?: Json | null
          base_salary?: number | null
          bonuses?: number | null
          created_at?: string | null
          deductions?: number | null
          discrepancies?: Json | null
          employee_id: string
          extras?: number | null
          gross_salary?: number | null
          has_discrepancies?: boolean | null
          id?: string
          internal_data?: Json | null
          net_salary?: number | null
          period: string
          status?: string | null
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          advisor_data?: Json | null
          base_salary?: number | null
          bonuses?: number | null
          created_at?: string | null
          deductions?: number | null
          discrepancies?: Json | null
          employee_id?: string
          extras?: number | null
          gross_salary?: number | null
          has_discrepancies?: boolean | null
          id?: string
          internal_data?: Json | null
          net_salary?: number | null
          period?: string
          status?: string | null
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      production_lines: {
        Row: {
          capacity: number
          created_at: string
          id: string
          name: string
          status: Database["public"]["Enums"]["line_status"]
          updated_at: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["line_status"]
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["line_status"]
          updated_at?: string
        }
        Relationships: []
      }
      production_steps: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          data_json: Json | null
          id: string
          of_id: string
          photos: string[] | null
          started_at: string | null
          status: Database["public"]["Enums"]["step_status"]
          step_name: string
          step_number: number
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          data_json?: Json | null
          id?: string
          of_id: string
          photos?: string[] | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["step_status"]
          step_name: string
          step_number: number
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          data_json?: Json | null
          id?: string
          of_id?: string
          photos?: string[] | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["step_status"]
          step_name?: string
          step_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_steps_of_id_fkey"
            columns: ["of_id"]
            isOneToOne: false
            referencedRelation: "fabrication_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          departamento: Database["public"]["Enums"]["departamento"] | null
          email: string
          id: string
          line_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          departamento?: Database["public"]["Enums"]["departamento"] | null
          email: string
          id: string
          line_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          departamento?: Database["public"]["Enums"]["departamento"] | null
          email?: string
          id?: string
          line_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      shifts: {
        Row: {
          created_at: string | null
          date: string
          employee_id: string
          end_time: string
          id: string
          shift_type: string
          start_time: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          employee_id: string
          end_time: string
          id?: string
          shift_type: string
          start_time: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          employee_id?: string
          end_time?: string
          id?: string
          shift_type?: string
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      alert_severity: "info" | "warning" | "critical"
      app_role:
        | "admin_global"
        | "admin_departamento"
        | "supervisor"
        | "operario"
        | "quality"
      departamento:
        | "produccion"
        | "logistica"
        | "compras"
        | "rrhh"
        | "comercial"
        | "administrativo"
      line_status: "active" | "paused" | "error"
      of_status:
        | "pendiente"
        | "en_proceso"
        | "completada"
        | "validada"
        | "albarana"
      step_status: "pendiente" | "en_proceso" | "completado" | "error"
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
      alert_severity: ["info", "warning", "critical"],
      app_role: [
        "admin_global",
        "admin_departamento",
        "supervisor",
        "operario",
        "quality",
      ],
      departamento: [
        "produccion",
        "logistica",
        "compras",
        "rrhh",
        "comercial",
        "administrativo",
      ],
      line_status: ["active", "paused", "error"],
      of_status: [
        "pendiente",
        "en_proceso",
        "completada",
        "validada",
        "albarana",
      ],
      step_status: ["pendiente", "en_proceso", "completado", "error"],
    },
  },
} as const

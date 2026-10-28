import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type {
  SettingsRepo,
  BusinessSettings,
  BusinessSettingsUpdate,
  BusinessPublicSettings,
  UserContext,
} from "../types";

export class SupabaseSettingsRepo implements SettingsRepo {
  constructor(
    private supabase: SupabaseClient<Database>,
    private _user: UserContext,
  ) {}

  async getSettings(): Promise<BusinessSettings> {
    const { data, error } = await this.supabase
      .from("business_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async updateSettings(data: BusinessSettingsUpdate): Promise<BusinessSettings> {
    const { data: updated, error } = await this.supabase
      .from("business_settings")
      .update(data)
      .eq("id", 1)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return updated;
  }

  async getPublicSettings(): Promise<BusinessPublicSettings> {
    const { data, error } = await this.supabase.rpc("get_business_public");
    if (error) throw new Error(error.message);
    const row = data?.[0];
    if (!row) {
      throw new Error("No se pudo obtener la configuración pública del negocio.");
    }
    return row;
  }
}

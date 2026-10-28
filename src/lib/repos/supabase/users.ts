import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { UsersRepo, Profile, ProfileUpdate, UserContext } from "../types";

export class SupabaseUsersRepo implements UsersRepo {
  constructor(
    private supabase: SupabaseClient<Database>,
    private _user: UserContext,
  ) {}

  async getProfile(id: string): Promise<Profile | null> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  }

  async listProfiles(): Promise<Profile[]> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("*")
      .order("full_name", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  }

  async updateProfile(id: string, data: ProfileUpdate): Promise<Profile> {
    const { data: updated, error } = await this.supabase
      .from("profiles")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return updated;
  }
}

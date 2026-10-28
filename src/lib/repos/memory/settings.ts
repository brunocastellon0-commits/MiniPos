import type {
  SettingsRepo,
  BusinessSettings,
  BusinessSettingsUpdate,
  BusinessPublicSettings,
  UserContext,
} from "../types";
import type { MemoryStore } from "./memory-store";

export class MemorySettingsRepo implements SettingsRepo {
  constructor(
    private store: MemoryStore,
    private user: UserContext,
  ) {}

  async getSettings(): Promise<BusinessSettings> {
    if (this.user.role !== "owner") {
      throw new Error(
        "Acceso denegado: solo el propietario puede consultar la configuración completa del negocio.",
      );
    }
    return { ...this.store.businessSettings };
  }

  async updateSettings(data: BusinessSettingsUpdate): Promise<BusinessSettings> {
    if (this.user.role !== "owner") {
      throw new Error(
        "Acceso denegado: solo el propietario puede modificar la configuración del negocio.",
      );
    }

    const updated: BusinessSettings = {
      ...this.store.businessSettings,
      ...data,
      id: 1, // Singleton
      updated_at: new Date().toISOString(),
    };

    this.store.businessSettings = updated;
    return { ...updated };
  }

  async getPublicSettings(): Promise<BusinessPublicSettings> {
    const s = this.store.businessSettings;
    return {
      name: s.name,
      legal_name: s.legal_name,
      currency_code: s.currency_code,
      currency_symbol: s.currency_symbol,
      logo_url: s.logo_url,
      allow_negative_stock: s.allow_negative_stock,
      low_stock_default: s.low_stock_default,
    };
  }
}

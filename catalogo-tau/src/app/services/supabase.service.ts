import { Injectable } from '@angular/core';
import {
  createClient,
  PostgrestError,
  SupabaseClient,
} from '@supabase/supabase-js';

const supabaseUrl = 'https://ijuzsnvjzuumxcxseths.supabase.co';
const supabasePublishableKey = 'sb_publishable_3Q083tSBxvEvWN1WPpZfbQ_WKB63ISo';

export interface Producto {
  id?: number | string;
  categoria?: string | null;
  imagen_url?: string | null;
  marca?: string | null;
  modelo?: string | null;
  procesador?: string | null;
  memoria_ram?: string | null;
  disco?: string | null;
  gpu?: string | null;
  bateria?: string | null;
  detalles_extras?: string | null;
  pulgadas?: number | string | null;
  precio?: number | string | null;
  stock?: number | null;
}

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient = createClient(
    supabaseUrl,
    supabasePublishableKey,
  );

  async getProductos(): Promise<Producto[]> {
    const { data, error } = await this.client.from('productos').select('*');

    if (error) {
      throw error;
    }

    return data;
  }

  async subirProducto(producto: Producto): Promise<{
    data: Producto[] | null;
    error: PostgrestError | null;
  }> {
    const { data, error } = await this.client
      .from('productos')
      .insert(producto)
      .select();

    return { data, error };
  }

  async subirImagen(file: File): Promise<string> {
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    const { error } = await this.client.storage
      .from('productos-images')
      .upload(fileName, file, { upsert: false });

    if (error) {
      throw error;
    }

    const { data } = this.client.storage
      .from('productos-images')
      .getPublicUrl(fileName);

    return data.publicUrl;
  }
}

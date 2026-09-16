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

  async getCategorias(): Promise<any[]> {
    const { data, error } = await this.client.from('categorias').select('*');

    if (error) {
      throw error;
    }

    return data;
  }

  async agregarCategoria(nombre: string): Promise<void> {
    const { error } = await this.client
      .from('categorias')
      .insert([{ nombre }]);

    if (error) {
      throw error;
    }
  }

  async actualizarCategoria(id: string | number, nombre: string): Promise<void> {
    const { error } = await this.client
      .from('categorias')
      .update({ nombre: nombre.trim() })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  async actualizarVisibilidadCategoria(id: string | number, visible: boolean): Promise<void> {
    const { error } = await this.client
      .from('categorias')
      .update({ visible })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  async eliminarCategoria(id: string | number): Promise<void> {
    const { error } = await this.client
      .from('categorias')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  async getAdministradores(): Promise<any[]> {
    const { data, error } = await this.client
      .from('admins')
      .select('id, email, fecha_alta')
      .order('fecha_alta', { ascending: false });

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async esAdministradorAutorizado(email: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('admins')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (error) {
      throw error;
    }

    return Boolean(data);
  }

  async agregarAdministrador(email: string): Promise<void> {
    const { error } = await this.client
      .from('admins')
      .insert([{ email: email.trim(), fecha_alta: new Date().toISOString() }]);

    if (error) {
      throw error;
    }
  }

  async eliminarAdministrador(id: string | number): Promise<void> {
    const { error } = await this.client
      .from('admins')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  async enviarRecuperacionPassword(email: string, redirectTo: string): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    if (error) {
      throw error;
    }
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

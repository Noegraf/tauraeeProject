import { Component, OnInit, inject } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Producto, SupabaseService } from '../services/supabase.service';

@Component({
  imports: [FormsModule, ReactiveFormsModule],
  selector: 'app-admin',
  styleUrl: './admin.scss',
  templateUrl: './admin.html',
})
export class Admin implements OnInit {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly supabase = inject(SupabaseService);

  public email = '';
  public password = '';
  public sesionActiva = false;

  public readonly productoForm = this.formBuilder.group({
    categoria: ['', Validators.required],
    marca: ['', Validators.required],
    modelo: ['', Validators.required],
    procesador: ['', Validators.required],
    memoria_ram: ['', Validators.required],
    disco: ['', Validators.required],
    gpu: ['', Validators.required],
    bateria: ['', Validators.required],
    detalles_extras: [''],
    pulgadas: [0, [Validators.required, Validators.min(1)]],
    precio: [0, [Validators.required, Validators.min(0)]],
    stock: [0, [Validators.required, Validators.min(0)]],
  });

  public archivoImagen: File | null = null;
  public guardando = false;
  public mensaje = '';
  public error = '';

  async ngOnInit(): Promise<void> {
    const { data, error } = await this.supabase.client.auth.getSession();

    if (error) {
      console.error('Error al comprobar la sesión:', error);
      return;
    }

    this.sesionActiva = Boolean(data.session);
  }

  async login(): Promise<void> {
    const { error } = await this.supabase.client.auth.signInWithPassword({
      email: this.email,
      password: this.password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    this.sesionActiva = true;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.archivoImagen = input.files?.[0] ?? null;
  }

  async onSubmit(fileInput: HTMLInputElement): Promise<void> {
    if (this.productoForm.invalid || this.guardando) {
      this.productoForm.markAllAsTouched();
      return;
    }

    if (!this.archivoImagen) {
      this.error = 'Seleccioná una imagen para el producto.';
      return;
    }

    this.guardando = true;
    this.mensaje = '';
    this.error = '';

    try {
      const imagenUrl = await this.supabase.subirImagen(this.archivoImagen);
      const producto: Producto = {
        ...this.productoForm.getRawValue(),
        imagen_url: imagenUrl,
      };
      const respuesta = await this.supabase.subirProducto(producto);

      if (respuesta.error) {
        console.error('Error al guardar el producto:', respuesta.error);
        this.error = 'No se pudo guardar el producto. Revisá los datos e intentá nuevamente.';
        return;
      }

      this.productoForm.reset({
        categoria: '',
        marca: '',
        modelo: '',
        procesador: '',
        memoria_ram: '',
        disco: '',
        gpu: '',
        bateria: '',
        detalles_extras: '',
        pulgadas: 0,
        precio: 0,
        stock: 0,
      });
      this.archivoImagen = null;
      fileInput.value = '';
      this.mensaje = 'Producto guardado correctamente.';
      alert('Producto guardado');
    } catch (error) {
      console.error('Error al subir el producto o la imagen:', error);
      this.error = 'No se pudo guardar el producto. Revisá los datos e intentá nuevamente.';
    } finally {
      this.guardando = false;
    }
  }
}

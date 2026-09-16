import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { Producto, SupabaseService } from '../services/supabase.service';
import { UpperCasePipe } from '@angular/common';

@Component({
  imports: [UpperCasePipe],
  selector: 'app-catalogo',
  styleUrl: './catalogo.scss',
  templateUrl: './catalogo.html',
})
export class Catalogo implements OnInit {
  public productos: Producto[] = [];
  public categorias = ['todas', 'notebook', 'desktop', 'tablet', 'smartphone', 'accesorios'];
  public categoriaSeleccionada = 'todas';
  public productosFiltrados: Producto[] = [];
  public cargando = true;
  public error = '';

  private readonly supabase = inject(SupabaseService);
  // 👇 1. Inyectamos la herramienta para forzar el dibujo en pantalla
  private readonly cdr = inject(ChangeDetectorRef); 

  async ngOnInit(): Promise<void> {
    console.log('Iniciando carga...');

    try {
      this.productos = await this.supabase.getProductos();
      console.log('Productos obtenidos:', this.productos);
      this.productosFiltrados = [...this.productos];
      
      // 👇 2. Le avisamos a Angular que los datos ya están y debe redibujar
      this.cdr.detectChanges(); 
      
    } catch {
      this.error = 'No se pudieron cargar los productos.';
    } finally {
      this.cargando = false;
    }
  }

  filtrarPorCategoria(categoria: string): void {
    this.categoriaSeleccionada = categoria;

    if (categoria === 'todas') {
      this.productosFiltrados = [...this.productos];
    } else {
      this.productosFiltrados = this.productos.filter(
        (producto) => producto.categoria === categoria,
      );
    }

    this.cdr.detectChanges();
  }
}
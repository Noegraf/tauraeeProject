import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Producto, SupabaseService } from '../services/supabase.service';

@Component({
  imports: [DatePipe, DecimalPipe, FormsModule, ReactiveFormsModule],
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
  public listaProductos: Producto[] = [];
  public productoEditandoId: string | null = null;
  public vistaInventario: 'grilla' | 'lista' = 'lista';
  public busqueda = '';
  public categoriaFiltro = 'todas';
  public stockFiltro = 'todos';
  public ordenProductos = 'recientes';
  public sidebarAbierto = false;
  public seccionActiva: string = 'productos';
  public productoPendienteEliminar: Producto | null = null;
  public categoriaPendienteEliminar: any | null = null;
  public productoSeleccionado: Producto | null = null;
  public listaCategorias: any[] = [];
  public nuevaCategoriaNombre = '';
  public categoriaEditandoId: string | number | null = null;
  public categoriaEditandoNombre = '';
  public listaAdministradores: any[] = [];
  public nuevoAdminEmail = '';
  public adminPendienteEliminar: any | null = null;

  public readonly productoForm = this.formBuilder.group({
    categoria: ['', Validators.required],
    marca: ['', Validators.required],
    modelo: ['', Validators.required],
    procesador: [''],
    memoria_ram: [''],
    disco: [''],
    gpu: [''],
    bateria: [''],
    detalles_extras: [''],
    pulgadas: [0, [Validators.required, Validators.min(0)]],
    precio: [0, [Validators.required, Validators.min(0)]],
    stock: [0, [Validators.required, Validators.min(0)]],
  });

  public archivoImagen: File | null = null;
  private imagenProductoEditando: string | null = null;
  public vistaPreviaImagen: string | null = null;
  public guardando = false;
  public mensaje = '';
  public error = '';
  private notificationTimer?: ReturnType<typeof setTimeout>;

  async ngOnInit(): Promise<void> {
    const { data, error } = await this.supabase.client.auth.getSession();

    if (error) {
      console.error('Error al comprobar la sesión:', error);
      return;
    }

    this.sesionActiva = Boolean(data.session);

    if (this.sesionActiva) {
      const email = data.session?.user.email;
      if (!email || !(await this.supabase.esAdministradorAutorizado(email))) {
        await this.supabase.client.auth.signOut();
        this.sesionActiva = false;
        this.mostrarError('Tu usuario no está autorizado para acceder al panel.');
        return;
      }

      await this.cargarProductosAdmin();
      this.listaCategorias = await this.supabase.getCategorias();
      await this.cargarAdministradores();
    }
  }

  async login(): Promise<void> {
    if (!this.email || !this.password) {
      this.mostrarError('Completá el email y la contraseña.');
      return;
    }

    const { error } = await this.supabase.client.auth.signInWithPassword({
      email: this.email,
      password: this.password,
    });

    if (error) {
      this.mostrarError(error.message);
      return;
    }

    if (!(await this.supabase.esAdministradorAutorizado(this.email))) {
      await this.supabase.client.auth.signOut();
      this.mostrarError('Tu usuario no está autorizado para acceder al panel.');
      return;
    }

    this.sesionActiva = true;
    await this.cargarProductosAdmin();
    await this.cargarCategoriasAdmin();
    await this.cargarAdministradores();
  }

  async cerrarSesion(): Promise<void> {
    await this.supabase.client.auth.signOut();
    this.sesionActiva = false;
    this.email = '';
    this.password = '';
    this.listaProductos = [];
    this.productoPendienteEliminar = null;
    this.categoriaPendienteEliminar = null;
    this.adminPendienteEliminar = null;
    this.listaAdministradores = [];
    this.productoSeleccionado = null;
    this.sidebarAbierto = false;
    this.seccionActiva = 'productos';
    this.cancelarEdicion();
    this.cerrarNotificacion();
  }

  cambiarSeccion(seccion: string): void {
    this.seccionActiva = seccion;
    this.sidebarAbierto = false;
  }

  async cargarProductosAdmin(): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('productos')
      .select('*');

    if (error) {
      console.error('Error al cargar los productos:', error);
      this.mostrarError('No se pudieron cargar los productos.');
      return;
    }

    this.listaProductos = data ?? [];
  }

  async cargarCategoriasAdmin(): Promise<void> {
    try {
      this.listaCategorias = await this.supabase.getCategorias();
    } catch (error) {
      console.error('Error al cargar las categorías:', error);
      this.mostrarError('No se pudieron cargar las categorías.');
    }
  }

  async cargarAdministradores(): Promise<void> {
    try {
      this.listaAdministradores = await this.supabase.getAdministradores();
    } catch (error) {
      console.error('Error al cargar los administradores:', error);
      this.mostrarError('No se pudieron cargar los administradores autorizados.');
    }
  }

  async guardarNuevoAdministrador(): Promise<void> {
    const email = this.nuevoAdminEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      this.mostrarError('Ingresá un email válido.');
      return;
    }

    try {
      await this.supabase.agregarAdministrador(email);
      this.nuevoAdminEmail = '';
      await this.cargarAdministradores();
      this.mostrarExito('Administrador autorizado correctamente.');
    } catch (error) {
      console.error('Error al agregar el administrador:', error);
      this.mostrarError('No se pudo autorizar el administrador.');
    }
  }

  solicitarEliminacionAdministrador(admin: any): void {
    this.adminPendienteEliminar = admin;
  }

  cancelarEliminacionAdministrador(): void {
    this.adminPendienteEliminar = null;
  }

  async confirmarEliminacionAdministrador(): Promise<void> {
    const admin = this.adminPendienteEliminar;
    if (!admin?.id) {
      return;
    }

    try {
      await this.supabase.eliminarAdministrador(admin.id);
      this.adminPendienteEliminar = null;
      await this.cargarAdministradores();
      this.mostrarExito('Acceso eliminado correctamente.');
    } catch (error) {
      console.error('Error al eliminar el administrador:', error);
      this.mostrarError('No se pudo eliminar el acceso.');
    }
  }

  async enviarRecuperacionAdministrador(admin: any): Promise<void> {
    try {
      await this.supabase.enviarRecuperacionPassword(
        admin.email,
        window.location.origin,
      );
      this.mostrarExito(`Enlace de recuperación enviado a ${admin.email}.`);
    } catch (error) {
      console.error('Error al enviar la recuperación de contraseña:', error);
      this.mostrarError('No se pudo enviar el enlace de recuperación.');
    }
  }

  async guardarNuevaCategoria(): Promise<void> {
    const nombre = this.nuevaCategoriaNombre.trim();
    if (!nombre) {
      this.mostrarError('Ingresá un nombre para la categoría.');
      return;
    }

    try {
      await this.supabase.agregarCategoria(nombre);
      this.listaCategorias = await this.supabase.getCategorias();
      this.nuevaCategoriaNombre = '';
      this.mostrarExito('Categoría agregada correctamente.');
    } catch (error) {
      console.error('Error al agregar la categoría:', error);
      this.mostrarError('No se pudo agregar la categoría.');
    }
  }

  iniciarEdicionCategoria(categoria: any): void {
    this.categoriaEditandoId = categoria.id;
    this.categoriaEditandoNombre = categoria.nombre ?? '';
  }

  cancelarEdicionCategoria(): void {
    this.categoriaEditandoId = null;
    this.categoriaEditandoNombre = '';
  }

  async guardarEdicionCategoria(): Promise<void> {
    if (this.categoriaEditandoId === null || !this.categoriaEditandoNombre.trim()) {
      this.mostrarError('Ingresá un nombre para la categoría.');
      return;
    }

    try {
      await this.supabase.actualizarCategoria(this.categoriaEditandoId, this.categoriaEditandoNombre);
      this.cancelarEdicionCategoria();
      await this.cargarCategoriasAdmin();
      this.mostrarExito('Categoría actualizada correctamente.');
    } catch (error) {
      console.error('Error al actualizar la categoría:', error);
      this.mostrarError('No se pudo actualizar la categoría.');
    }
  }

  async alternarVisibilidadCategoria(categoria: any): Promise<void> {
    const visible = categoria.visible === false;

    try {
      await this.supabase.actualizarVisibilidadCategoria(categoria.id, visible);
      await this.cargarCategoriasAdmin();
      this.mostrarExito(visible ? 'Categoría visible en el catálogo.' : 'Categoría oculta del catálogo.');
    } catch (error) {
      console.error('Error al cambiar la visibilidad:', error);
      this.mostrarError('No se pudo cambiar la visibilidad.');
    }
  }

  borrarCategoria(id: string | number): void {
    this.categoriaPendienteEliminar = this.listaCategorias.find(
      (categoria) => String(categoria.id) === String(id),
    ) ?? { id, nombre: 'esta categoría' };
  }

  cancelarEliminacionCategoria(): void {
    this.categoriaPendienteEliminar = null;
  }

  async confirmarEliminacionCategoria(): Promise<void> {
    const categoria = this.categoriaPendienteEliminar;
    if (!categoria?.id) {
      return;
    }

    try {
      await this.supabase.eliminarCategoria(categoria.id);
      this.categoriaPendienteEliminar = null;
      await this.cargarCategoriasAdmin();
      this.mostrarExito('Categoría eliminada correctamente.');
    } catch (error) {
      console.error('Error al eliminar la categoría:', error);
      this.mostrarError('No se pudo eliminar la categoría.');
    }
  }

  get categoriasDisponibles(): string[] {
    return this.listaCategorias
      .filter((categoria) => categoria.visible !== false)
      .map((categoria) => categoria.nombre)
      .filter((nombre): nombre is string => Boolean(nombre))
      .sort();
  }

  get productosFiltrados(): Producto[] {
    const busqueda = this.busqueda.trim().toLowerCase();
    const filtrados = this.listaProductos.filter((producto) => {
      const coincideBusqueda = !busqueda || [producto.marca, producto.modelo, producto.categoria]
        .some((valor) => valor?.toLowerCase().includes(busqueda));
      const coincideCategoria = this.categoriaFiltro === 'todas' || producto.categoria === this.categoriaFiltro;
      const coincideStock = this.stockFiltro === 'todos'
        || (this.stockFiltro === 'disponible' && this.estadoStock(producto) === 'disponible')
        || (this.stockFiltro === 'bajo' && this.estadoStock(producto) === 'bajo')
        || (this.stockFiltro === 'sin' && this.estadoStock(producto) === 'sin');

      return coincideBusqueda && coincideCategoria && coincideStock;
    });

    return [...filtrados].sort((primero, segundo) => {
      if (this.ordenProductos === 'precio-asc') return Number(primero.precio ?? 0) - Number(segundo.precio ?? 0);
      if (this.ordenProductos === 'precio-desc') return Number(segundo.precio ?? 0) - Number(primero.precio ?? 0);
      if (this.ordenProductos === 'stock-asc') return Number(primero.stock ?? 0) - Number(segundo.stock ?? 0);
      return Number(segundo.id ?? 0) - Number(primero.id ?? 0);
    });
  }

  get totalDisponibles(): number {
    return this.listaProductos.filter((producto) => this.estadoStock(producto) === 'disponible').length;
  }

  get totalProductos(): number {
    return this.listaProductos.length;
  }

  get productosBajoStock(): number {
    return this.listaProductos.filter((producto) => {
      const stock = Number(producto.stock ?? 0);
      return stock > 0 && stock <= 3;
    }).length;
  }

  get productosSinStock(): number {
    return this.listaProductos.filter((producto) => Number(producto.stock ?? 0) === 0).length;
  }

  get totalValorizado(): number {
    return this.listaProductos.reduce(
      (total, producto) => {
        const precio = Number(producto.precio);
        const stock = Number(producto.stock);
        return total + (Number.isFinite(precio) && Number.isFinite(stock) ? precio * stock : 0);
      },
      0,
    );
  }

  get productosConAnomalias(): Producto[] {
    return this.listaProductos
      .filter((producto) => this.productoAnomalias(producto).length > 0);
  }

  productoAnomalias(producto: Producto): string[] {
    const anomalias: string[] = [];
    const categoria = producto.categoria?.trim().toLowerCase();
    const categoriasRegistradas = this.listaCategorias.map((item) => String(item.nombre ?? '').trim().toLowerCase());
    const precio = Number(producto.precio);
    const stockValue: unknown = producto.stock;
    const stock = Number(stockValue);

    if (!categoria || !categoriasRegistradas.includes(categoria)) {
      anomalias.push('Categoría inexistente o no asignada');
    }
    if (!producto.marca?.trim()) {
      anomalias.push('Falta marca');
    }
    if (!producto.modelo?.trim()) {
      anomalias.push('Falta modelo');
    }
    if (producto.precio === null || producto.precio === undefined || producto.precio === '' || !Number.isFinite(precio) || precio <= 0) {
      anomalias.push('Precio inválido');
    } else if (precio > 100_000_000) {
      anomalias.push('Precio hiperinflado');
    }
    if (stockValue === null || stockValue === undefined || stockValue === '' || !Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock)) {
      anomalias.push('Stock mal cargado');
    }

    return anomalias;
  }

  corregirProducto(producto: Producto): void {
    this.seccionActiva = 'productos';
    this.prepararEdicion(producto);
    setTimeout(() => this.irAlFormulario(), 0);
  }

  async actualizarValorInventario(
    producto: Producto,
    campo: 'precio' | 'stock',
    event: Event,
  ): Promise<void> {
    const input = event.target as HTMLInputElement;
    const valor = Number(input.value);

    if (!Number.isFinite(valor) || valor < 0 || (campo === 'stock' && !Number.isInteger(valor))) {
      this.mostrarError(campo === 'precio' ? 'Ingresá un precio válido.' : 'Ingresá un stock entero y no negativo.');
      input.value = String(producto[campo] ?? 0);
      return;
    }

    const { error } = await this.supabase.client
      .from('productos')
      .update({ [campo]: valor })
      .eq('id', String(producto.id));

    if (error) {
      console.error(`Error al actualizar ${campo}:`, error);
      this.mostrarError('No se pudo actualizar el inventario.');
      return;
    }

    producto[campo] = valor;
    this.mostrarExito('Inventario actualizado correctamente.');
  }

  get totalBajoStock(): number {
    return this.listaProductos.filter((producto) => this.estadoStock(producto) === 'bajo').length;
  }

  get totalSinStock(): number {
    return this.listaProductos.filter((producto) => this.estadoStock(producto) === 'sin').length;
  }

  get hayFiltrosActivos(): boolean {
    return Boolean(this.busqueda || this.categoriaFiltro !== 'todas' || this.stockFiltro !== 'todos' || this.ordenProductos !== 'recientes');
  }

  estadoStock(producto: Producto): 'disponible' | 'bajo' | 'sin' {
    const stock = Number(producto.stock ?? 0);
    return stock === 0 ? 'sin' : stock <= 3 ? 'bajo' : 'disponible';
  }

  etiquetaStock(producto: Producto): string {
    return { disponible: 'Disponible', bajo: 'Bajo stock', sin: 'Sin stock' }[this.estadoStock(producto)];
  }

  limpiarFiltros(): void {
    this.busqueda = '';
    this.categoriaFiltro = 'todas';
    this.stockFiltro = 'todos';
    this.ordenProductos = 'recientes';
  }

  filtrarPorStock(filtro: string): void {
    this.stockFiltro = this.stockFiltro === filtro ? 'todos' : filtro;
  }

  irAlFormulario(): void {
    document.getElementById('formulario-producto')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async eliminarProducto(id: string): Promise<void> {
    const producto = this.listaProductos.find((item) => String(item.id) === id);
    if (!producto) {
      return;
    }

    this.productoPendienteEliminar = producto;
  }

  cancelarEliminacion(): void {
    this.productoPendienteEliminar = null;
  }

  async confirmarEliminacion(): Promise<void> {
    const producto = this.productoPendienteEliminar;
    if (!producto?.id) {
      return;
    }

    const { error } = await this.supabase.client
      .from('productos')
      .delete()
      .eq('id', String(producto.id));

    if (error) {
      console.error('Error al eliminar el producto:', error);
      this.mostrarError('No se pudo eliminar el producto.');
      return;
    }

    this.productoPendienteEliminar = null;
    await this.cargarProductosAdmin();
    this.mostrarExito('Producto eliminado correctamente.');
  }

  verProducto(producto: Producto): void {
    this.productoSeleccionado = producto;
  }

  cerrarDetalle(): void {
    this.productoSeleccionado = null;
  }

  prepararEdicion(producto: Producto): void {
    this.productoEditandoId = producto.id !== undefined ? String(producto.id) : null;
    this.imagenProductoEditando = producto.imagen_url ?? null;
    this.vistaPreviaImagen = producto.imagen_url ?? null;
    this.productoForm.patchValue({
      categoria: producto.categoria ?? '',
      marca: producto.marca ?? '',
      modelo: producto.modelo ?? '',
      procesador: producto.procesador ?? '',
      memoria_ram: producto.memoria_ram ?? '',
      disco: producto.disco ?? '',
      gpu: producto.gpu ?? '',
      bateria: producto.bateria ?? '',
      detalles_extras: producto.detalles_extras ?? '',
      pulgadas: Number(producto.pulgadas ?? 0),
      precio: Number(producto.precio ?? 0),
      stock: producto.stock ?? 0,
    });
    this.mensaje = '';
    this.error = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicion(fileInput?: HTMLInputElement): void {
    this.productoEditandoId = null;
    this.imagenProductoEditando = null;
    this.archivoImagen = null;
    this.vistaPreviaImagen = null;
    this.resetFormulario(fileInput);
    this.mensaje = '';
    this.error = '';
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.archivoImagen = input.files?.[0] ?? null;
    if (this.vistaPreviaImagen?.startsWith('blob:')) {
      URL.revokeObjectURL(this.vistaPreviaImagen);
    }
    this.vistaPreviaImagen = this.archivoImagen ? URL.createObjectURL(this.archivoImagen) : this.imagenProductoEditando;
  }

  duplicarProducto(producto: Producto): void {
    this.productoEditandoId = null;
    this.imagenProductoEditando = producto.imagen_url ?? null;
    this.vistaPreviaImagen = producto.imagen_url ?? null;
    this.archivoImagen = null;
    this.productoForm.patchValue({
      categoria: producto.categoria ?? '',
      marca: producto.marca ?? '',
      modelo: `${producto.modelo ?? ''} (copia)`,
      procesador: producto.procesador ?? '',
      memoria_ram: producto.memoria_ram ?? '',
      disco: producto.disco ?? '',
      gpu: producto.gpu ?? '',
      bateria: producto.bateria ?? '',
      detalles_extras: producto.detalles_extras ?? '',
      pulgadas: Number(producto.pulgadas ?? 0),
      precio: Number(producto.precio ?? 0),
      stock: Number(producto.stock ?? 0),
    });
    this.mensaje = '';
    this.error = '';
    this.irAlFormulario();
  }

  async onSubmit(fileInput: HTMLInputElement): Promise<void> {
    if (this.productoForm.invalid || this.guardando) {
      this.productoForm.markAllAsTouched();
      return;
    }

    if (!this.archivoImagen && !this.imagenProductoEditando && !this.productoEditandoId) {
      this.mostrarError('Seleccioná una imagen para el producto.');
      return;
    }

    this.guardando = true;
    this.mensaje = '';
    this.error = '';
    const esEdicion = Boolean(this.productoEditandoId);

    try {
      const imagenUrl = this.archivoImagen
        ? await this.supabase.subirImagen(this.archivoImagen)
        : this.imagenProductoEditando;
      const producto: Producto = {
        ...this.productoForm.getRawValue(),
        imagen_url: imagenUrl,
      };
      const respuesta = this.productoEditandoId
        ? await this.supabase.client
            .from('productos')
            .update(producto)
            .eq('id', this.productoEditandoId)
            .select()
        : await this.supabase.subirProducto(producto);

      if (respuesta.error) {
        console.error('Error al guardar el producto:', respuesta.error);
        this.mostrarError('No se pudo guardar el producto. Revisá los datos e intentá nuevamente.');
        return;
      }

      await this.cargarProductosAdmin();
      this.resetFormulario(fileInput);
      this.productoEditandoId = null;
      this.imagenProductoEditando = null;
      this.archivoImagen = null;
      this.vistaPreviaImagen = null;
      this.mostrarExito(esEdicion ? 'Producto actualizado correctamente.' : 'Producto guardado correctamente.');
    } catch (error) {
      console.error('Error al subir el producto o la imagen:', error);
      this.mostrarError('No se pudo guardar el producto. Revisá los datos e intentá nuevamente.');
    } finally {
      this.guardando = false;
    }
  }

  private resetFormulario(fileInput?: HTMLInputElement): void {
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

    if (fileInput) {
      fileInput.value = '';
    }
  }

  cerrarNotificacion(): void {
    this.mensaje = '';
    this.error = '';
    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer);
    }
  }

  private mostrarExito(mensaje: string): void {
    this.error = '';
    this.mensaje = mensaje;
    this.programarCierreNotificacion();
  }

  private mostrarError(error: string): void {
    this.mensaje = '';
    this.error = error;
    this.programarCierreNotificacion();
  }

  private programarCierreNotificacion(): void {
    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer);
    }

    this.notificationTimer = setTimeout(() => {
      this.mensaje = '';
      this.error = '';
    }, 5000);
  }
}

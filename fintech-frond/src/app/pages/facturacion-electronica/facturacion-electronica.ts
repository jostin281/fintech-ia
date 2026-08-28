import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser, DecimalPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  PerfilTributarioApiService,
  FirmaElectronicaApiService,
  ClientesFacturacionApiService,
  ProductosServiciosApiService,
  FacturasApiService,
  RetencionesRecibidasApiService,
  type PerfilTributarioApi,
  type GuardarPerfilTributarioResultadoApi,
  type FirmaElectronicaApi,
  type ClienteFacturacionApi,
  type ProductoServicioApi,
  type FacturaApi,
  type RetencionRecibidaApi,
  type TipoIdentificacionSriApi,
  type TarifaIvaProductoApi,
  type TipoContribuyenteApi,
  type RegimenTributarioApi,
  type TipoIdentificacionPerfilApi,
} from '../../services/api/facturacion.api';
import {
  ComprobantesRecibidosApiService,
  type ComprobanteRecibidoResumenApi,
  type DesgloseComprobanteApi,
} from '../../services/api/comprobantes-recibidos.api';
import { UserDataService } from '../../services/user-data';
import { mensajeDeError } from '../../services/http-error';

type Tab = 'facturas' | 'clientes' | 'productos' | 'retenciones' | 'comprobantes-recibidos' | 'perfil';

interface CorreccionCategoriaLinea {
  recordar: boolean;
  palabraClave: string;
}

@Component({
  selector: 'app-facturacion-electronica',
  imports: [RouterLink, DecimalPipe, DatePipe],
  templateUrl: './facturacion-electronica.html',
  styleUrl: './facturacion-electronica.css',
})
export class FacturacionElectronica implements AfterViewInit, OnDestroy {
  @ViewChild('neuralCanvas') private canvasRef?: ElementRef<HTMLCanvasElement>;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly route = inject(ActivatedRoute);
  private readonly perfilApi = inject(PerfilTributarioApiService);
  private readonly firmaApi = inject(FirmaElectronicaApiService);
  private readonly clientesApi = inject(ClientesFacturacionApiService);
  private readonly productosApi = inject(ProductosServiciosApiService);
  private readonly facturasApi = inject(FacturasApiService);
  private readonly retencionesApi = inject(RetencionesRecibidasApiService);
  private readonly comprobantesApi = inject(ComprobantesRecibidosApiService);
  protected readonly userData = inject(UserDataService);

  private animationFrameId?: number;
  private resizeHandler?: () => void;

  readonly tab = signal<Tab>('facturas');
  readonly toastMessage = signal<string | null>(null);
  readonly showTipWidget = signal(true);
  readonly cargando = signal(true);
  readonly guardando = signal(false);

  readonly perfil = signal<PerfilTributarioApi | null>(null);
  readonly firma = signal<FirmaElectronicaApi | null>(null);
  readonly clientes = signal<ClienteFacturacionApi[]>([]);
  readonly productos = signal<ProductoServicioApi[]>([]);
  readonly facturas = signal<FacturaApi[]>([]);
  readonly retenciones = signal<RetencionRecibidaApi[]>([]);
  readonly comprobantesRecibidos = signal<ComprobanteRecibidoResumenApi[]>([]);
  readonly comprobantesBusqueda = signal('');

  readonly comprobantesRecibidosFiltrados = computed(() => {
    const query = this.comprobantesBusqueda().toLowerCase().trim();
    if (!query) return this.comprobantesRecibidos();
    return this.comprobantesRecibidos().filter(
      (c) =>
        c.razonSocialEmisor.toLowerCase().includes(query) ||
        c.rucEmisor.includes(query) ||
        c.numero.toLowerCase().includes(query),
    );
  });

  readonly listoParaEmitir = computed(() => !!this.perfil() && !!this.firma());

  readonly totalFacturado = computed(() =>
    this.facturas()
      .filter((f) => f.estado === 'AUTORIZADA')
      .reduce((acc, f) => acc + Number(f.totales.importeTotal), 0),
  );
  readonly totalIvaGenerado = computed(() =>
    this.facturas()
      .filter((f) => f.estado === 'AUTORIZADA')
      .reduce((acc, f) => acc + Number(f.totales.iva), 0),
  );

  readonly facturasAutorizadas = computed(() =>
    this.facturas().filter((f) => f.estado === 'AUTORIZADA').length
  );

  /* ── Formularios ── */
  readonly perfilForm = signal({
    tipoIdentificacion: 'RUC' as TipoIdentificacionPerfilApi,
    ruc: '',
    razonSocial: '',
    nombreComercial: '',
    direccionMatriz: '',
    tipoContribuyente: 'PERSONA_NATURAL' as TipoContribuyenteApi,
    regimenTributario: 'RIMPE_EMPRENDEDOR' as RegimenTributarioApi,
    ambienteSri: 'PRUEBAS' as 'PRUEBAS' | 'PRODUCCION',
  });

  readonly showFirmaModal = signal(false);
  readonly firmaArchivo = signal<File | null>(null);
  readonly firmaClave = signal('');

  readonly showClienteModal = signal(false);
  readonly clienteForm = signal({
    tipoIdentificacion: 'CEDULA' as TipoIdentificacionSriApi,
    identificacion: '',
    razonSocial: '',
    correo: '',
  });

  readonly showProductoModal = signal(false);
  readonly productoForm = signal({
    codigoPrincipal: '',
    descripcion: '',
    precioUnitario: '',
    tarifaIva: 'QUINCE' as TarifaIvaProductoApi,
  });

  readonly showFacturaModal = signal(false);
  readonly facturaClienteId = signal<number | null>(null);
  readonly facturaProductoId = signal<number | null>(null);
  readonly facturaCantidad = signal('1');

  readonly showRetencionModal = signal(false);
  readonly retencionForm = signal({
    tipo: 'RENTA' as 'RENTA' | 'IVA',
    emisorIdentificacion: '',
    numeroComprobante: '',
    fechaEmision: new Date().toISOString().slice(0, 10),
    baseImponible: '',
    porcentaje: '',
    valor: '',
  });

  /* ── Comprobantes recibidos (facturas de compra/gasto importadas del SRI) ── */
  readonly showImportComprobantesModal = signal(false);
  readonly importComprobantesArchivos = signal<File[]>([]);
  readonly importandoComprobantes = signal(false);

  readonly showXmlModal = signal(false);
  readonly xmlComprobanteId = signal<number | null>(null);
  readonly xmlContenido = signal<string | null>(null);
  readonly cargandoXml = signal(false);

  readonly showDesgloseModal = signal(false);
  readonly desglose = signal<DesgloseComprobanteApi | null>(null);
  readonly cargandoDesglose = signal(false);
  readonly actualizandoDetalleId = signal<number | null>(null);
  readonly correccionExtra = signal<Record<number, CorreccionCategoriaLinea>>({});

  ngAfterViewInit(): void {
    const tabInicial = this.route.snapshot.queryParamMap.get('tab');
    if (
      tabInicial === 'facturas' ||
      tabInicial === 'clientes' ||
      tabInicial === 'productos' ||
      tabInicial === 'retenciones' ||
      tabInicial === 'comprobantes-recibidos'
    ) {
      this.tab.set(tabInicial);
    }

    if (this.isBrowser) {
      this.initNeuralCanvas();
      void this.cargarTodo();
    }
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== undefined) cancelAnimationFrame(this.animationFrameId);
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
  }

  setTab(t: Tab) {
    this.tab.set(t);
  }

  private async cargarTodo(): Promise<void> {
    this.cargando.set(true);
    try {
      const perfil = await this.perfilApi.obtener();
      this.perfil.set(perfil);

      const [firma, clientes, productos, facturas, retenciones, comprobantesRecibidos] =
        await Promise.all([
          perfil ? this.firmaApi.obtenerEstado() : Promise.resolve(null),
          this.clientesApi.listar().catch(() => []),
          this.productosApi.listar().catch(() => []),
          this.facturasApi.listar().catch(() => []),
          this.retencionesApi.listar().catch(() => []),
          this.comprobantesApi.listar().catch(() => []),
        ]);
      this.firma.set(firma);
      this.clientes.set(clientes);
      this.productos.set(productos);
      this.facturas.set(facturas);
      this.retenciones.set(retenciones);
      this.comprobantesRecibidos.set(comprobantesRecibidos);
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo cargar la información de facturación.'));
    } finally {
      this.cargando.set(false);
    }
  }

  /* ── Perfil tributario ── */
  openPerfilForm() {
    const actual = this.perfil();
    if (actual) {
      this.perfilForm.set({
        // El backend siempre guarda el RUC completo de trece dígitos, sin
        // importar si se ingresó como RUC o como cédula; al editar un perfil
        // ya existente se muestra en modo RUC.
        tipoIdentificacion: 'RUC',
        ruc: actual.ruc,
        razonSocial: actual.razonSocial,
        nombreComercial: actual.nombreComercial ?? '',
        direccionMatriz: actual.direccionMatriz,
        tipoContribuyente: actual.tipoContribuyente,
        regimenTributario: actual.regimenTributario,
        ambienteSri: (actual.ambienteSri ?? 'PRUEBAS') as 'PRUEBAS' | 'PRODUCCION',
      });
    }
    this.setTab('perfil');
  }

  updatePerfilForm<K extends keyof ReturnType<typeof this.perfilForm>>(campo: K, valor: string) {
    this.perfilForm.update((f) => ({ ...f, [campo]: valor }));
  }

  /**
   * Cambia entre RUC y cédula, limpiando el campo para evitar mezclar
   * dígitos de un formato con otro. La cédula solo es válida para persona
   * natural (así lo exige el backend), así que al elegirla se fuerza ese
   * tipo de contribuyente.
   */
  setTipoIdentificacionPerfil(tipo: TipoIdentificacionPerfilApi) {
    this.perfilForm.update((f) => ({
      ...f,
      tipoIdentificacion: tipo,
      ruc: '',
      tipoContribuyente: tipo === 'CEDULA' ? 'PERSONA_NATURAL' : f.tipoContribuyente,
    }));
  }

  async guardarPerfil() {
    const f = this.perfilForm();
    const esCedula = f.tipoIdentificacion === 'CEDULA';
    const identificacionValida = esCedula ? /^\d{10}$/.test(f.ruc) : /^\d{13}$/.test(f.ruc);

    if (!identificacionValida || !f.razonSocial.trim() || !f.direccionMatriz.trim()) {
      this.triggerToast(
        esCedula
          ? 'Completa la cédula (10 dígitos), razón social y dirección matriz.'
          : 'Completa RUC (13 dígitos), razón social y dirección matriz.',
      );
      return;
    }

    this.guardando.set(true);
    try {
      const dto = {
        tipoIdentificacion: f.tipoIdentificacion,
        ruc: f.ruc,
        razonSocial: f.razonSocial.trim(),
        nombreComercial: f.nombreComercial.trim() || undefined,
        direccionMatriz: f.direccionMatriz.trim(),
        tipoContribuyente: f.tipoContribuyente,
        regimenTributario: f.regimenTributario,
        ambienteSri: f.ambienteSri,
      };
      const resultado: GuardarPerfilTributarioResultadoApi = this.perfil()
        ? await this.perfilApi.actualizar(dto)
        : await this.perfilApi.crear(dto);
      this.perfil.set(resultado.perfilTributario);
      if (resultado.advertenciaSri) {
        // El perfil sí se guardó; esto solo avisa que el SRI no confirmó el RUC.
        this.triggerToast(`⚠️ Perfil guardado. ${resultado.advertenciaSri}`, 9000);
      } else {
        this.triggerToast('✅ Perfil tributario guardado correctamente.');
      }
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo guardar el perfil tributario.'));
    } finally {
      this.guardando.set(false);
    }
  }

  /* ── Firma electrónica ── */
  openFirmaModal() {
    this.firmaArchivo.set(null);
    this.firmaClave.set('');
    this.showFirmaModal.set(true);
  }

  closeFirmaModal() {
    this.showFirmaModal.set(false);
  }

  onFirmaArchivoSeleccionado(event: Event) {
    const input = event.target as HTMLInputElement;
    this.firmaArchivo.set(input.files?.[0] ?? null);
  }

  async guardarFirma() {
    const archivo = this.firmaArchivo();
    if (!archivo || !this.firmaClave().trim()) {
      this.triggerToast('Selecciona el archivo .p12/.pfx e ingresa su contraseña.');
      return;
    }

    this.guardando.set(true);
    try {
      const firma = await this.firmaApi.guardar(archivo, this.firmaClave());
      this.firma.set(firma);
      this.triggerToast('✅ Firma electrónica cargada y cifrada correctamente.');
      this.closeFirmaModal();
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo guardar la firma electrónica.'));
    } finally {
      this.guardando.set(false);
    }
  }

  async desactivarFirma() {
    try {
      await this.firmaApi.desactivar();
      this.firma.set(null);
      this.triggerToast('Firma electrónica desactivada.');
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo desactivar la firma.'));
    }
  }

  /* ── Clientes ── */
  openClienteModal() {
    this.clienteForm.set({ tipoIdentificacion: 'CEDULA', identificacion: '', razonSocial: '', correo: '' });
    this.showClienteModal.set(true);
  }

  closeClienteModal() {
    this.showClienteModal.set(false);
  }

  updateClienteForm<K extends keyof ReturnType<typeof this.clienteForm>>(campo: K, valor: string) {
    this.clienteForm.update((f) => ({ ...f, [campo]: valor }));
  }

  async guardarCliente() {
    const f = this.clienteForm();
    if (!f.identificacion.trim() || !f.razonSocial.trim()) {
      this.triggerToast('Ingresa identificación y razón social del cliente.');
      return;
    }

    this.guardando.set(true);
    try {
      const cliente = await this.clientesApi.crear({
        tipoIdentificacion: f.tipoIdentificacion,
        identificacion: f.identificacion.trim(),
        razonSocial: f.razonSocial.trim(),
        correo: f.correo.trim() || undefined,
      });
      this.clientes.update((lista) => [cliente, ...lista]);
      this.triggerToast('✅ Cliente registrado.');
      this.closeClienteModal();
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo registrar el cliente.'));
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminarCliente(id: number) {
    try {
      await this.clientesApi.eliminar(id);
      this.clientes.update((lista) => lista.filter((c) => c.id !== id));
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo eliminar el cliente.'));
    }
  }

  /* ── Productos y servicios ── */
  openProductoModal() {
    this.productoForm.set({ codigoPrincipal: '', descripcion: '', precioUnitario: '', tarifaIva: 'QUINCE' });
    this.showProductoModal.set(true);
  }

  closeProductoModal() {
    this.showProductoModal.set(false);
  }

  updateProductoForm<K extends keyof ReturnType<typeof this.productoForm>>(campo: K, valor: string) {
    this.productoForm.update((f) => ({ ...f, [campo]: valor }));
  }

  async guardarProducto() {
    const f = this.productoForm();
    if (!f.codigoPrincipal.trim() || !f.descripcion.trim() || !f.precioUnitario.trim()) {
      this.triggerToast('Completa código, descripción y precio.');
      return;
    }

    this.guardando.set(true);
    try {
      const producto = await this.productosApi.crear({
        codigoPrincipal: f.codigoPrincipal.trim(),
        descripcion: f.descripcion.trim(),
        precioUnitario: f.precioUnitario.trim(),
        tarifaIva: f.tarifaIva,
      });
      this.productos.update((lista) => [producto, ...lista]);
      this.triggerToast('✅ Producto/servicio registrado.');
      this.closeProductoModal();
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo registrar el producto.'));
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminarProducto(id: number) {
    try {
      await this.productosApi.eliminar(id);
      this.productos.update((lista) => lista.filter((p) => p.id !== id));
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo eliminar el producto.'));
    }
  }

  /* ── Facturas ── */
  openFacturaModal() {
    this.facturaClienteId.set(this.clientes()[0]?.id ?? null);
    this.facturaProductoId.set(this.productos()[0]?.id ?? null);
    this.facturaCantidad.set('1');
    this.showFacturaModal.set(true);
  }

  closeFacturaModal() {
    this.showFacturaModal.set(false);
  }

  async crearFactura() {
    const clienteId = this.facturaClienteId();
    const productoServicioId = this.facturaProductoId();
    if (!clienteId || !productoServicioId || !this.facturaCantidad().trim()) {
      this.triggerToast('Selecciona cliente, producto y cantidad.');
      return;
    }

    this.guardando.set(true);
    try {
      const factura = await this.facturasApi.crear({
        clienteId,
        detalles: [{ productoServicioId, cantidad: this.facturaCantidad().trim() }],
      });
      this.facturas.update((lista) => [factura, ...lista]);
      this.triggerToast('✅ Borrador de factura creado. Ya puedes emitirlo al SRI.');
      this.closeFacturaModal();
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo crear el borrador de factura.'));
    } finally {
      this.guardando.set(false);
    }
  }

  async emitirFactura(id: number) {
    this.guardando.set(true);
    try {
      await this.facturasApi.emitir(id);
      const actualizada = await this.facturasApi.obtenerUna(id);
      this.facturas.update((lista) => lista.map((f) => (f.id === id ? actualizada : f)));
      this.triggerToast(
        actualizada.estado === 'AUTORIZADA'
          ? `✅ Factura ${actualizada.numero} autorizada por el SRI.`
          : `Factura enviada al SRI. Estado actual: ${actualizada.estado}.`,
      );
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'El SRI no pudo procesar la factura.'));
    } finally {
      this.guardando.set(false);
    }
  }

  async anularBorrador(id: number) {
    try {
      await this.facturasApi.anularBorrador(id);
      this.facturas.update((lista) => lista.filter((f) => f.id !== id));
      this.triggerToast('Borrador anulado.');
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo anular el borrador.'));
    }
  }

  async descargarRide(id: number) {
    try {
      const blob = await this.facturasApi.descargarRide(id);
      descargarBlob(blob, `factura-${id}-ride.pdf`);
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo generar el RIDE.'));
    }
  }

  async descargarXml(id: number) {
    try {
      const blob = await this.facturasApi.descargarXml(id);
      descargarBlob(blob, `factura-${id}.xml`);
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo descargar el XML.'));
    }
  }

  /* ── Retenciones recibidas (comprobantes que tus clientes te entregan) ── */
  openRetencionModal() {
    this.retencionForm.set({
      tipo: 'RENTA',
      emisorIdentificacion: '',
      numeroComprobante: '',
      fechaEmision: new Date().toISOString().slice(0, 10),
      baseImponible: '',
      porcentaje: '',
      valor: '',
    });
    this.showRetencionModal.set(true);
  }

  closeRetencionModal() {
    this.showRetencionModal.set(false);
  }

  updateRetencionForm<K extends keyof ReturnType<typeof this.retencionForm>>(campo: K, valor: string) {
    this.retencionForm.update((f) => ({ ...f, [campo]: valor }));
  }

  async guardarRetencion() {
    const f = this.retencionForm();
    if (!f.emisorIdentificacion.trim() || !f.numeroComprobante.trim() || !f.baseImponible || !f.porcentaje || !f.valor) {
      this.triggerToast('Completa todos los campos de la retención.');
      return;
    }

    this.guardando.set(true);
    try {
      const retencion = await this.retencionesApi.crear(f);
      this.retenciones.update((lista) => [retencion, ...lista]);
      this.triggerToast('✅ Retención registrada.');
      this.closeRetencionModal();
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo registrar la retención.'));
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminarRetencion(id: number) {
    try {
      await this.retencionesApi.eliminar(id);
      this.retenciones.update((lista) => lista.filter((r) => r.id !== id));
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo eliminar la retención.'));
    }
  }

  /* ── Comprobantes recibidos: importación ── */
  openImportComprobantesModal() {
    this.importComprobantesArchivos.set([]);
    this.showImportComprobantesModal.set(true);
  }

  closeImportComprobantesModal() {
    if (this.importandoComprobantes()) return;
    this.showImportComprobantesModal.set(false);
  }

  onImportComprobantesFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.importComprobantesArchivos.set(input.files ? Array.from(input.files) : []);
  }

  async confirmarImportacionComprobantes() {
    const archivos = this.importComprobantesArchivos();
    if (archivos.length === 0) return;

    this.importandoComprobantes.set(true);
    try {
      const resumen = await this.comprobantesApi.importar(archivos);
      this.triggerToast(resumen.mensaje);
      this.comprobantesRecibidos.set(await this.comprobantesApi.listar());
      this.showImportComprobantesModal.set(false);
      // Algunas líneas ya quedan categorizadas automáticamente al importar
      // (por las reglas de categorización): refresca Movimientos y
      // Presupuestos ya mismo, no solo cuando el usuario corrija una línea.
      void this.userData.cargarTodo();
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo importar los archivos XML.'));
    } finally {
      this.importandoComprobantes.set(false);
    }
  }

  /* ── Comprobantes recibidos: visor de XML original (solo lectura) ── */
  async verXml(id: number) {
    this.xmlComprobanteId.set(id);
    this.xmlContenido.set(null);
    this.cargandoXml.set(true);
    this.showXmlModal.set(true);
    try {
      const blob = await this.comprobantesApi.obtenerXml(id);
      this.xmlContenido.set(await blob.text());
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo cargar el XML original.'));
      this.showXmlModal.set(false);
    } finally {
      this.cargandoXml.set(false);
    }
  }

  closeXmlModal() {
    this.showXmlModal.set(false);
    this.xmlContenido.set(null);
    this.xmlComprobanteId.set(null);
  }

  async copiarXml() {
    const contenido = this.xmlContenido();
    if (!contenido) return;
    try {
      await navigator.clipboard.writeText(contenido);
      this.triggerToast('XML copiado al portapapeles.');
    } catch {
      this.triggerToast('No se pudo copiar el XML. Cópialo manualmente.');
    }
  }

  async descargarXmlComprobante(id: number) {
    try {
      const blob = await this.comprobantesApi.obtenerXml(id);
      descargarBlob(blob, `comprobante-${id}.xml`);
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo descargar el XML.'));
    }
  }

  /* ── Comprobantes recibidos: desglose y corrección de categoría por línea ── */
  async verDesglose(id: number) {
    this.desglose.set(null);
    this.correccionExtra.set({});
    this.cargandoDesglose.set(true);
    this.showDesgloseModal.set(true);
    try {
      this.desglose.set(await this.comprobantesApi.obtenerDesglose(id));
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo cargar el desglose del comprobante.'));
      this.showDesgloseModal.set(false);
    } finally {
      this.cargandoDesglose.set(false);
    }
  }

  closeDesgloseModal() {
    this.showDesgloseModal.set(false);
    this.desglose.set(null);
  }

  correccionDeLinea(detalleId: number): CorreccionCategoriaLinea {
    return this.correccionExtra()[detalleId] ?? { recordar: false, palabraClave: '' };
  }

  toggleRecordarCorreccion(detalleId: number, descripcionSugerida: string) {
    this.correccionExtra.update((mapa) => {
      const actual = mapa[detalleId] ?? {
        recordar: false,
        palabraClave: descripcionSugerida.trim().slice(0, 60),
      };
      return { ...mapa, [detalleId]: { ...actual, recordar: !actual.recordar } };
    });
  }

  actualizarPalabraClaveCorreccion(detalleId: number, valor: string) {
    this.correccionExtra.update((mapa) => ({
      ...mapa,
      [detalleId]: { recordar: mapa[detalleId]?.recordar ?? false, palabraClave: valor },
    }));
  }

  async actualizarCategoriaLinea(detalleId: number, categoriaIdTexto: string) {
    const desgloseActual = this.desglose();
    const categoriaId = Number(categoriaIdTexto);
    if (!desgloseActual || !categoriaId) return;

    const extra = this.correccionExtra()[detalleId];
    if (extra?.recordar && !extra.palabraClave.trim()) {
      this.triggerToast('Ingresa una palabra clave para recordar esta corrección.');
      return;
    }

    this.actualizandoDetalleId.set(detalleId);
    try {
      await this.comprobantesApi.actualizarCategoriaDetalle(desgloseActual.comprobante.id, detalleId, {
        categoriaId,
        crearRegla: extra?.recordar ?? false,
        palabraClave: extra?.recordar ? extra.palabraClave.trim() : undefined,
      });
      this.desglose.set(await this.comprobantesApi.obtenerDesglose(desgloseActual.comprobante.id));
      this.comprobantesRecibidos.set(await this.comprobantesApi.listar());
      this.triggerToast('✅ Categoría actualizada correctamente.');
      // Esto es lo que crea/actualiza el Movimiento en el backend: refresca
      // Movimientos y Presupuestos ya mismo para que el gasto se sume solo.
      void this.userData.cargarTodo();
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo actualizar la categoría de la línea.'));
    } finally {
      this.actualizandoDetalleId.set(null);
    }
  }

  private triggerToast(msg: string, duracionMs = 4500) {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(null), duracionMs);
  }

  private initNeuralCanvas(): void {
    // Fondo estático y limpio
  }
}

function descargarBlob(blob: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nombreArchivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

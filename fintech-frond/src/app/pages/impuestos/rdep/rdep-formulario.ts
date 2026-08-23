import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS, MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  type CatalogosRdepApi,
  type FormularioRdepApi,
  type HistorialFormularioRdepApi,
  type PlantillaRdepApi,
  type ResultadoValidacionRdepApi,
  RdepApiService,
} from '../../../services/api/rdep.api';
import { mensajeDeError } from '../../../services/http-error';

/**
 * Formulario reactivo (Angular ReactiveFormsModule) para capturar la
 * información de un Formulario 107 / Anexo RDEP de un período fiscal. La
 * interfaz es propia de FINTECH (no copia el diseño visual del SRI): los
 * nombres de campo, catálogos y casilleros que sí deben respetarse
 * literalmente para la presentación oficial se muestran como referencia
 * junto a cada control, y se validan/transmiten sin alterarlos en el
 * backend (ver rdep.controller.ts / anexo-rdep-excel.service.ts).
 */
@Component({
  selector: 'app-rdep-formulario',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  templateUrl: './rdep-formulario.html',
  styleUrl: './rdep-formulario.css',
  providers: [
    // Formulario más compacto: no reserva espacio vacío bajo cada campo
    // cuando no hay hint/error que mostrar (mismo look visual, menos alto).
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { subscriptSizing: 'dynamic' } },
  ],
})
export class RdepFormulario implements OnInit {
  @Input() formularioId: number | null = null;
  @Output() guardado = new EventEmitter<void>();
  @Output() cancelado = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly rdepApi = inject(RdepApiService);

  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly validando = signal(false);
  readonly generando = signal(false);
  readonly exportando = signal(false);
  readonly cargandoPlantilla = signal(false);
  readonly mensaje = signal<string | null>(null);
  readonly mensajeEsError = signal(false);

  readonly catalogos = signal<CatalogosRdepApi | null>(null);
  readonly formularioActual = signal<FormularioRdepApi | null>(null);
  readonly resultadoValidacion = signal<ResultadoValidacionRdepApi | null>(null);
  readonly historial = signal<HistorialFormularioRdepApi[]>([]);
  readonly mostrarHistorial = signal(false);

  readonly esNuevo = computed(() => this.formularioId === null);
  readonly estado = computed(() => this.formularioActual()?.estado ?? 'BORRADOR');
  readonly esSoloLectura = computed(() => this.estado() === 'GENERADO');
  readonly puedeGenerar = computed(() => this.estado() === 'VALIDADO');
  readonly puedeDescargarAnexo = computed(() => this.estado() === 'GENERADO');

  readonly form = this.fb.nonNullable.group({
    periodoFiscal: [new Date().getFullYear() - 1, [Validators.required, Validators.min(2006)]],
    tipoEmpleador: ['PRIVADO_MIXTO', Validators.required],
    enteSeguridadSocial: ['IESS', Validators.required],

    tipoIdentificacionTrabajador: ['CEDULA', Validators.required],
    numeroIdentificacionTrabajador: ['', Validators.required],
    apellidosTrabajador: ['', Validators.required],
    nombresTrabajador: ['', Validators.required],
    codigoEstablecimiento: ['001', Validators.required],
    residenciaTrabajador: ['LOCAL', Validators.required],
    paisResidenciaTrabajador: ['593', Validators.required],
    aplicaConvenioDobleImposicion: ['NO_APLICA', Validators.required],
    condicionDiscapacidad: ['NO_APLICA', Validators.required],
    porcentajeDiscapacidad: [null as number | null],
    beneficioGalapagos: [false],
    enfermedadCatastrofica: [false],
    cargasFamiliares: [0, [Validators.min(0), Validators.max(5)]],

    sueldosSalariosIngresosGravados: [0, [Validators.required, Validators.min(0)]],
    otrosIngresosGravados: [0, [Validators.min(0)]],
    participacionUtilidades: [0, [Validators.min(0)]],
    ingresosOtrosEmpleadores: [0, [Validators.min(0)]],
    decimoTercerSueldo: [0, [Validators.min(0)]],
    decimoCuartoSueldo: [0, [Validators.min(0)]],
    fondoReserva: [0, [Validators.min(0)]],
    otrosIngresosNoGravados: [0, [Validators.min(0)]],
    impuestoRentaAsumidoEmpleador: [0, [Validators.min(0)]],

    sistemaSalarioNeto: ['SIN_SISTEMA', Validators.required],
    aportePersonalEsteEmpleador: [0, [Validators.min(0)]],
    aportePersonalOtrosEmpleadores: [0, [Validators.min(0)]],
    gastoVivienda: [0, [Validators.min(0)]],
    gastoSalud: [0, [Validators.min(0)]],
    gastoEducacion: [0, [Validators.min(0)]],
    gastoAlimentacion: [0, [Validators.min(0)]],
    gastoVestimenta: [0, [Validators.min(0)]],
    gastoTurismo: [0, [Validators.min(0)]],
    exoneracionDiscapacidad: [0, [Validators.min(0)]],
    exoneracionTerceraEdad: [0, [Validators.min(0)]],
    impuestoRetenidoAsumidoOtrosEmpleadores: [0, [Validators.min(0)]],
    impuestoAsumidoEsteEmpleador: [0, [Validators.min(0)]],

    canastaBasicaMensual: [0, [Validators.required, Validators.min(0.01)]],
  });

  async ngOnInit(): Promise<void> {
    this.cargando.set(true);
    try {
      this.catalogos.set(await this.rdepApi.obtenerCatalogos());
      if (this.formularioId !== null) {
        await this.cargarFormulario(this.formularioId);
      }
    } catch (error) {
      this.mostrarMensaje(mensajeDeError(error, 'No se pudieron cargar los catálogos del RDEP.'), true);
    } finally {
      this.cargando.set(false);
    }
  }

  private async cargarFormulario(id: number): Promise<void> {
    const formulario = await this.rdepApi.obtener(id);
    this.formularioActual.set(formulario);
    this.form.patchValue({
      periodoFiscal: formulario.periodoFiscal,
      tipoEmpleador: formulario.tipoEmpleador,
      enteSeguridadSocial: formulario.enteSeguridadSocial,
      tipoIdentificacionTrabajador: formulario.tipoIdentificacionTrabajador,
      numeroIdentificacionTrabajador: formulario.numeroIdentificacionTrabajador,
      apellidosTrabajador: formulario.apellidosTrabajador,
      nombresTrabajador: formulario.nombresTrabajador,
      codigoEstablecimiento: formulario.codigoEstablecimiento,
      residenciaTrabajador: formulario.residenciaTrabajador,
      paisResidenciaTrabajador: formulario.paisResidenciaTrabajador,
      aplicaConvenioDobleImposicion: formulario.aplicaConvenioDobleImposicion,
      condicionDiscapacidad: formulario.condicionDiscapacidad,
      porcentajeDiscapacidad: formulario.porcentajeDiscapacidad,
      beneficioGalapagos: formulario.beneficioGalapagos,
      enfermedadCatastrofica: formulario.enfermedadCatastrofica,
      cargasFamiliares: formulario.cargasFamiliares,
      sueldosSalariosIngresosGravados: Number(formulario.sueldosSalariosIngresosGravados),
      otrosIngresosGravados: Number(formulario.otrosIngresosGravados),
      participacionUtilidades: Number(formulario.participacionUtilidades),
      ingresosOtrosEmpleadores: Number(formulario.ingresosOtrosEmpleadores),
      decimoTercerSueldo: Number(formulario.decimoTercerSueldo),
      decimoCuartoSueldo: Number(formulario.decimoCuartoSueldo),
      fondoReserva: Number(formulario.fondoReserva),
      otrosIngresosNoGravados: Number(formulario.otrosIngresosNoGravados),
      impuestoRentaAsumidoEmpleador: Number(formulario.impuestoRentaAsumidoEmpleador),
      sistemaSalarioNeto: formulario.sistemaSalarioNeto,
      aportePersonalEsteEmpleador: Number(formulario.aportePersonalEsteEmpleador),
      aportePersonalOtrosEmpleadores: Number(formulario.aportePersonalOtrosEmpleadores),
      gastoVivienda: Number(formulario.gastoVivienda),
      gastoSalud: Number(formulario.gastoSalud),
      gastoEducacion: Number(formulario.gastoEducacion),
      gastoAlimentacion: Number(formulario.gastoAlimentacion),
      gastoVestimenta: Number(formulario.gastoVestimenta),
      gastoTurismo: Number(formulario.gastoTurismo),
      exoneracionDiscapacidad: Number(formulario.exoneracionDiscapacidad),
      exoneracionTerceraEdad: Number(formulario.exoneracionTerceraEdad),
      impuestoRetenidoAsumidoOtrosEmpleadores: Number(
        formulario.impuestoRetenidoAsumidoOtrosEmpleadores,
      ),
      impuestoAsumidoEsteEmpleador: Number(formulario.impuestoAsumidoEsteEmpleador),
      canastaBasicaMensual: Number(formulario.canastaBasicaMensual),
    });

    if (formulario.estado === 'GENERADO') {
      this.form.disable();
    }
  }

  /**
   * Prellena el formulario nuevo con los datos del último período fiscal ya
   * registrado (identidad del trabajador, sueldos, gastos personales,
   * etc.), para no tener que volver a escribirlos cada año. No toca
   * periodoFiscal: ese lo define el propio usuario. Solo aplica a
   * formularios nuevos (esNuevo()).
   */
  async cargarUltimoPeriodo(): Promise<void> {
    if (!this.esNuevo()) return;

    this.cargandoPlantilla.set(true);
    try {
      const respuesta: PlantillaRdepApi = await this.rdepApi.obtenerPlantilla();
      if (!respuesta.encontrado) {
        this.mostrarMensaje('Todavía no tienes ningún Formulario 107 anterior para copiar.', true);
        return;
      }
      this.form.patchValue(respuesta.plantilla);
      this.mostrarMensaje(
        `Datos copiados del período fiscal ${respuesta.periodoFiscalOrigen}. Revisa y corrige lo que haya cambiado (sueldos, cargas familiares, gastos personales, etc.) antes de guardar.`,
        false,
      );
    } catch (error) {
      this.mostrarMensaje(
        mensajeDeError(error, 'No se pudo cargar el período anterior.'),
        true,
      );
    } finally {
      this.cargandoPlantilla.set(false);
    }
  }

  async guardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.mostrarMensaje('Revisa los campos obligatorios marcados en rojo.', true);
      return;
    }

    this.guardando.set(true);
    this.resultadoValidacion.set(null);
    try {
      const valores = this.form.getRawValue();
      if (this.formularioId === null) {
        const respuesta = await this.rdepApi.crear(valores);
        this.formularioId = respuesta.formulario.id;
        this.formularioActual.set(respuesta.formulario);
        this.mostrarMensaje('Borrador creado correctamente.', false);
      } else {
        const respuesta = await this.rdepApi.actualizar(this.formularioId, valores);
        this.formularioActual.set(respuesta.formulario);
        this.mostrarMensaje('Borrador actualizado correctamente.', false);
      }
      this.guardado.emit();
    } catch (error) {
      this.mostrarMensaje(mensajeDeError(error, 'No se pudo guardar el formulario.'), true);
    } finally {
      this.guardando.set(false);
    }
  }

  async validar(): Promise<void> {
    if (this.formularioId === null) {
      this.mostrarMensaje('Primero guarda el borrador antes de validarlo.', true);
      return;
    }

    this.validando.set(true);
    try {
      const resultado = await this.rdepApi.validar(this.formularioId);
      this.resultadoValidacion.set(resultado);
      const formulario = await this.rdepApi.obtener(this.formularioId);
      this.formularioActual.set(formulario);

      if (resultado.valido) {
        this.mostrarMensaje('✅ El formulario pasó todas las validaciones. Ya puedes generarlo.', false);
      } else {
        this.mostrarMensaje(
          `Se encontraron ${resultado.totalErrores} error(es). Revisa el detalle debajo del formulario.`,
          true,
        );
      }
    } catch (error) {
      this.mostrarMensaje(mensajeDeError(error, 'No se pudo validar el formulario.'), true);
    } finally {
      this.validando.set(false);
    }
  }

  async generar(): Promise<void> {
    if (this.formularioId === null) return;

    this.generando.set(true);
    try {
      const respuesta = await this.rdepApi.generar(this.formularioId);
      this.formularioActual.set(respuesta.formulario);
      this.form.disable();
      this.mostrarMensaje('✨ Formulario generado. Ya puedes descargar el PDF y el anexo Excel oficial.', false);
    } catch (error) {
      this.mostrarMensaje(mensajeDeError(error, 'No se pudo generar el formulario.'), true);
    } finally {
      this.generando.set(false);
    }
  }

  async descargarPdf(): Promise<void> {
    if (this.formularioId === null) return;
    this.exportando.set(true);
    try {
      await this.rdepApi.descargarPdf(this.formularioId, this.form.getRawValue().periodoFiscal);
      this.mostrarMensaje('PDF descargado.', false);
    } catch (error) {
      this.mostrarMensaje(mensajeDeError(error, 'No se pudo descargar el PDF.'), true);
    } finally {
      this.exportando.set(false);
    }
  }

  async descargarAnexoExcel(): Promise<void> {
    if (this.formularioId === null) return;
    this.exportando.set(true);
    try {
      await this.rdepApi.descargarAnexoExcel(this.formularioId, this.form.getRawValue().periodoFiscal);
      this.mostrarMensaje('Anexo Excel oficial descargado.', false);
    } catch (error) {
      this.mostrarMensaje(mensajeDeError(error, 'No se pudo descargar el anexo Excel.'), true);
    } finally {
      this.exportando.set(false);
    }
  }

  async alternarHistorial(): Promise<void> {
    this.mostrarHistorial.set(!this.mostrarHistorial());
    if (this.mostrarHistorial() && this.formularioId !== null) {
      const resultado = await this.rdepApi.obtenerHistorial(this.formularioId);
      this.historial.set(resultado.historial);
    }
  }

  cancelar(): void {
    this.cancelado.emit();
  }

  private mostrarMensaje(texto: string, esError: boolean): void {
    this.mensaje.set(texto);
    this.mensajeEsError.set(esError);
    setTimeout(() => {
      if (this.mensaje() === texto) this.mensaje.set(null);
    }, 6000);
  }
}

import { Component, EventEmitter, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { type FormularioRdepApi, RdepApiService } from '../../../services/api/rdep.api';
import { mensajeDeError } from '../../../services/http-error';

/** Tabla de periodos fiscales del Formulario 107 / RDEP del usuario. */
@Component({
  selector: 'app-rdep-listado',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './rdep-listado.html',
  styleUrl: './rdep-listado.css',
})
export class RdepListado implements OnInit {
  @Output() editar = new EventEmitter<number>();
  @Output() nuevo = new EventEmitter<void>();

  private readonly rdepApi = inject(RdepApiService);

  readonly cargando = signal(false);
  readonly formularios = signal<FormularioRdepApi[]>([]);
  readonly mensaje = signal<string | null>(null);

  readonly columnas = [
    'periodoFiscal',
    'estado',
    'baseImponibleGravada',
    'impuestoRetenido',
    'generadoEn',
    'acciones',
  ];

  async ngOnInit(): Promise<void> {
    await this.recargar();
  }

  async recargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const resultado = await this.rdepApi.listar();
      this.formularios.set(resultado.formularios);
    } catch (error) {
      this.mensaje.set(mensajeDeError(error, 'No se pudieron cargar tus formularios RDEP.'));
    } finally {
      this.cargando.set(false);
    }
  }

  async eliminar(formulario: FormularioRdepApi): Promise<void> {
    if (formulario.estado !== 'BORRADOR') return;
    if (!confirm(`¿Eliminar el borrador del período ${formulario.periodoFiscal}?`)) return;

    try {
      await this.rdepApi.eliminar(formulario.id);
      await this.recargar();
    } catch (error) {
      this.mensaje.set(mensajeDeError(error, 'No se pudo eliminar el borrador.'));
    }
  }

  async descargarPdf(formulario: FormularioRdepApi): Promise<void> {
    try {
      await this.rdepApi.descargarPdf(formulario.id, formulario.periodoFiscal);
    } catch (error) {
      this.mensaje.set(mensajeDeError(error, 'No se pudo descargar el PDF.'));
    }
  }

  async descargarAnexoExcel(formulario: FormularioRdepApi): Promise<void> {
    try {
      await this.rdepApi.descargarAnexoExcel(formulario.id, formulario.periodoFiscal);
    } catch (error) {
      this.mensaje.set(mensajeDeError(error, 'No se pudo descargar el anexo Excel.'));
    }
  }
}

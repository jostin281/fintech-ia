import { Injectable, inject } from '@angular/core';
import { UserDataService } from './user-data';

/**
 * ═══════════════════════════════════════════════════════════════════════
 * BankingService — capa de conexión para las Acciones Rápidas del Dashboard.
 *
 * Estado real de cada acción tras conectar el backend (fintech-back):
 *  - createGoal: 100% real → POST /api/metas-ahorro (vía UserDataService).
 *  - issueInvoice: el backend SÍ tiene emisión real de facturas SRI, pero
 *    exige perfil tributario + firma .p12 + cliente + producto ya creados
 *    (ver /api/facturacion/*). Esta acción rápida no alcanza para armar todo
 *    eso, así que solo informa y remite a la pantalla de Facturación
 *    Electrónica en vez de inventar un comprobante falso.
 *  - transfer / payService: el backend NO tiene endpoints de transferencias
 *    ni pagos de servicios (no existe convenio bancario ni con planillas).
 *    Se mantienen como simulación local, claramente indicada en el mensaje
 *    de respuesta, para no fingir una operación bancaria real.
 * ═══════════════════════════════════════════════════════════════════════
 */

export interface TransferRequest {
  bank: string;
  accountType: string;
  recipientIdNumber: string;
  recipientName: string;
  amountUsd: number;
}

export interface TransferResponse {
  success: boolean;
  reference: string;
  message: string;
}

export interface PayServiceRequest {
  entity: string;
  contractRef: string;
  amountUsd: number;
}

export interface PayServiceResponse {
  success: boolean;
  reference: string;
  message: string;
}

export interface IssueInvoiceRequest {
  clientName: string;
  clientRuc: string;
  amountUsd: number;
}

export interface IssueInvoiceResponse {
  success: boolean;
  secuencial: string;
  claveAcceso: string;
  message: string;
}

export interface CreateGoalRequest {
  category: string;
  customName: string;
  targetUsd: number;
  initialUsd: number;
}

export interface CreateGoalResponse {
  success: boolean;
  goalId: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class BankingService {
  private readonly userData = inject(UserDataService);

  /**
   * Sin endpoint en el backend (no hay convenio SPI-BCE / Open Banking).
   * Simulación local explícita: no mueve dinero real.
   */
  async transfer(req: TransferRequest): Promise<TransferResponse> {
    await simulateLatency();

    if (!req.amountUsd || req.amountUsd <= 0) {
      return { success: false, reference: '', message: 'Monto inválido.' };
    }

    const reference = 'SIM-' + Date.now().toString().slice(-10);

    return {
      success: true,
      reference,
      message: `Simulación local: transferencia de $${req.amountUsd.toLocaleString()} USD a ${req.recipientName} (${req.bank}) registrada. Esta acción no está conectada a un banco real todavía. 🇪🇨`,
    };
  }

  /**
   * Sin endpoint en el backend (no hay convenio de recaudación con EEQ, CNT, IESS, etc.).
   * Simulación local explícita.
   */
  async payService(req: PayServiceRequest): Promise<PayServiceResponse> {
    await simulateLatency();

    if (!req.amountUsd || req.amountUsd <= 0) {
      return { success: false, reference: '', message: 'Monto inválido.' };
    }

    const reference = 'SIM-' + Date.now().toString().slice(-10);

    return {
      success: true,
      reference,
      message: `Simulación local: pago de $${req.amountUsd.toLocaleString()} USD a ${req.entity} registrado. Esta acción no está conectada a una entidad recaudadora real todavía. 🇪🇨`,
    };
  }

  /**
   * El backend SÍ emite facturas electrónicas reales al SRI, pero requiere
   * perfil tributario, firma .p12, cliente y producto previamente creados
   * (ver Facturación Electrónica). Este acceso rápido no reúne esos datos,
   * así que no finge una emisión: solo remite al flujo real.
   */
  async issueInvoice(_req: IssueInvoiceRequest): Promise<IssueInvoiceResponse> {
    return {
      success: false,
      secuencial: '',
      claveAcceso: '',
      message:
        'Para emitir una factura electrónica válida ante el SRI necesitas completar primero tu perfil tributario, firma electrónica, cliente y producto en "Facturación Electrónica". Ahí puedes emitirla de verdad.',
    };
  }

  /** 100% real: POST /api/metas-ahorro a través de UserDataService. */
  async createGoal(req: CreateGoalRequest): Promise<CreateGoalResponse> {
    if (!req.targetUsd || req.targetUsd <= 0) {
      return { success: false, goalId: '', message: 'Monto objetivo inválido.' };
    }

    const finalName = req.customName ? `${req.category} - ${req.customName}` : req.category;
    const anio = new Date().getFullYear();

    try {
      await this.userData.addSavingGoal({
        name: finalName,
        target: req.targetUsd,
        deadline: `${anio}-12-31`,
        initial: Math.min(req.initialUsd || 0, req.targetUsd),
      });

      return {
        success: true,
        goalId: finalName,
        message: `¡Meta "${finalName}" creada por $${req.targetUsd.toLocaleString()} USD! 🇪🇨⭐`,
      };
    } catch (error: unknown) {
      const detalle = error instanceof Error ? error.message : 'No se pudo crear la meta.';
      return { success: false, goalId: '', message: detalle };
    }
  }
}

/** Simula la latencia de una llamada de red real (300-600ms). */
function simulateLatency(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 300));
}

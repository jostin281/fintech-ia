import { Injectable, inject } from '@angular/core';
import { UserDataService } from './user-data';

/**
 * ═══════════════════════════════════════════════════════════════════════
 * BankingService — capa de conexión para las Acciones Rápidas del Dashboard.
 *
 * Solo expone acciones que de verdad se pueden completar:
 *  - createGoal: 100% real → POST /api/metas-ahorro (vía UserDataService).
 *
 * "Transferir" y "Pagar" se eliminaron de aquí (y del Dashboard) porque el
 * backend no tiene convenio bancario ni de recaudación de servicios: no hay
 * forma honesta de ejecutarlas, solo de simularlas, y este servicio ya no
 * finge operaciones bancarias. "Facturar" también se quitó como modal rápido:
 * el backend SÍ emite facturas electrónicas reales al SRI, pero exige perfil
 * tributario + firma .p12 + cliente + producto ya creados (ver
 * /api/facturacion/*), así que en el Dashboard ahora es un enlace directo a
 * la pantalla de Facturación Electrónica, donde sí se puede completar de
 * verdad, en vez de un modal que nunca podría terminar la operación.
 * ═══════════════════════════════════════════════════════════════════════
 */

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

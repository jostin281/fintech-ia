import { Injectable, computed, inject } from '@angular/core';

import { LanguageService } from './language';
import { UserDataService } from './user-data';

export interface Tip {
  icon: string;
  title: string;
  body: string;
}

/**
 * Genera los "consejos" (tarjetas flotantes) que se muestran en Dashboard,
 * Metas de Ahorro, Movimientos, Presupuestos y Reportes, a partir de los
 * datos financieros reales del usuario (UserDataService) — nunca de un
 * texto fijo igual para todos.
 *
 * Cada método devuelve un consejo distinto según lo que de verdad está
 * pasando en la cuenta de esa persona (sus ingresos, gastos y metas), y
 * cae en un mensaje genérico y honesto (sin inventar cifras) solo cuando
 * todavía no hay suficientes datos para personalizarlo — por ejemplo, un
 * usuario nuevo sin movimientos registrados.
 *
 * Se genera el texto directamente en español o inglés según
 * LanguageService.lang() (en vez de dejar que DomTranslatorService lo
 * traduzca después): estas frases mezclan números y nombres reales en
 * medio de la oración, así que una traducción por diccionario de texto ya
 * renderizado no las cubre de forma confiable.
 */
@Injectable({ providedIn: 'root' })
export class TipsService {
  private readonly userData = inject(UserDataService);
  private readonly languageService = inject(LanguageService);

  /* ── Dashboard: la alerta más relevante en este momento ── */
  readonly tipDashboard = computed<Tip>(() => {
    const en = this.languageService.lang() === 'en';

    const presupuestoCritico = this.presupuestoMasUsado();
    if (presupuestoCritico && presupuestoCritico.porcentaje >= 90) {
      const { category, spent, limit, porcentaje } = presupuestoCritico;
      return en
        ? {
            icon: '⚠️',
            title: 'Budget running low',
            body:
              `Your <strong>${category}</strong> budget already used ${porcentaje}% ` +
              `(${formatMonto(spent)} of ${formatMonto(limit)}). Keep an eye on it for the rest of the month.`,
          }
        : {
            icon: '⚠️',
            title: 'Presupuesto por agotarse',
            body:
              `Tu presupuesto de <strong>${category}</strong> ya usó el ${porcentaje}% ` +
              `(${formatMonto(spent)} de ${formatMonto(limit)}). Cuídalo en lo que resta del mes.`,
          };
    }

    const ingreso = this.userData.monthlyIncome();
    const gasto = this.userData.monthlyExpenses();

    if (ingreso <= 0 && gasto <= 0) {
      return en
        ? {
            icon: '💡',
            title: '50/30/20 Savings Tip',
            body:
              "You haven't logged any transactions yet this month — once you do, this tip will " +
              'match your real numbers. In the meantime, a general guideline: 50% of your income ' +
              'for essentials, 30% for lifestyle, and 20% for savings.',
          }
        : {
            icon: '💡',
            title: 'Consejo de Ahorro 50/30/20',
            body:
              'Todavía no registras movimientos este mes: en cuanto lo hagas, este consejo se ' +
              'ajusta a tus números reales. Mientras tanto, una referencia general: destina 50% ' +
              'de tus ingresos a necesidades básicas, 30% a estilo de vida y 20% a tu ahorro.',
          };
    }

    const tasa = this.userData.savingsRate();
    if (ingreso > 0 && tasa < 20) {
      const faltante = Math.max(0, ingreso * 0.2 - (ingreso - gasto));
      const ahorrado = Math.max(0, ingreso - gasto);
      return en
        ? {
            icon: '💡',
            title: 'Below your savings target',
            body:
              `This month you saved ${tasa}% of your income (${formatMonto(ahorrado)} of ` +
              `${formatMonto(ingreso)}). The classic benchmark is 20% — you'd need ` +
              `${formatMonto(faltante)} more to get there.`,
          }
        : {
            icon: '💡',
            title: 'Por debajo de tu meta de ahorro',
            body:
              `Este mes ahorraste el ${tasa}% de tus ingresos (${formatMonto(ahorrado)} ` +
              `de ${formatMonto(ingreso)}). La referencia clásica es 20%: te faltarían ` +
              `${formatMonto(faltante)} más para llegar.`,
          };
    }

    return en
      ? {
          icon: '✅',
          title: "You're on track this month",
          body:
            `You saved ${tasa}% of your income this month (${formatMonto(ingreso - gasto)} of ` +
            `${formatMonto(ingreso)}), above the 20% benchmark. Keep it up.`,
        }
      : {
          icon: '✅',
          title: 'Vas bien este mes',
          body:
            `Ahorraste el ${tasa}% de tus ingresos este mes (${formatMonto(ingreso - gasto)} de ` +
            `${formatMonto(ingreso)}), por encima del 20% de referencia. Sigue así.`,
        };
  });

  /* ── Metas de ahorro: la meta más cerca de completarse ── */
  readonly tipMetas = computed<Tip>(() => {
    const en = this.languageService.lang() === 'en';
    const metas = this.userData.savingsGoals();
    const activas = metas.filter((m) => m.current < m.target);

    if (metas.length === 0) {
      return en
        ? {
            icon: '🎯',
            title: "You don't have any goals yet",
            body:
              'Create your first savings goal (with an amount and, if you want, a date) and this ' +
              "tip will calculate how much you have left and how much you'd need to contribute each month.",
          }
        : {
            icon: '🎯',
            title: 'Todavía no tienes metas',
            body:
              'Crea tu primera meta de ahorro (con un monto y, si quieres, una fecha) y este ' +
              'consejo va a calcular cuánto te falta y cuánto conviene aportar cada mes.',
          };
    }

    if (activas.length === 0) {
      return en
        ? {
            icon: '✅',
            title: 'All your goals are complete!',
            body: `You completed ${metas.length === 1 ? 'your goal' : `all ${metas.length} goals`} you set. Good time to create the next one.`,
          }
        : {
            icon: '✅',
            title: '¡Todas tus metas están completas!',
            body: `Completaste ${metas.length === 1 ? 'tu meta' : `las ${metas.length} metas`} que registraste. Buen momento para crear la siguiente.`,
          };
    }

    const masCercana = [...activas].sort(
      (a, b) => b.current / b.target - a.current / a.target,
    )[0];
    const porcentaje = Math.round((masCercana.current / masCercana.target) * 1000) / 10;
    const restante = masCercana.target - masCercana.current;

    const mesesRestantes = masCercana.deadline ? mesesHasta(masCercana.deadline) : null;
    if (mesesRestantes && mesesRestantes > 0) {
      const aportarMensual = restante / mesesRestantes;
      return en
        ? {
            icon: '🎯',
            title: 'Savings Hack',
            body:
              `You're at ${porcentaje}% of "<strong>${masCercana.name}</strong>". You have ` +
              `${formatMonto(restante)} left, and based on your target date, contributing ` +
              `${formatMonto(aportarMensual)} a month gets you there on time.`,
          }
        : {
            icon: '🎯',
            title: 'Hack de Ahorro',
            body:
              `Estás al ${porcentaje}% de "<strong>${masCercana.name}</strong>". Te faltan ` +
              `${formatMonto(restante)} y, según tu fecha objetivo, con ${formatMonto(aportarMensual)} ` +
              `al mes la completas a tiempo.`,
          };
    }

    return en
      ? {
          icon: '🎯',
          title: 'Savings Hack',
          body:
            `You're at ${porcentaje}% of "<strong>${masCercana.name}</strong>". You have ` +
            `${formatMonto(restante)} left to complete it — any extra contribution gets you closer.`,
        }
      : {
          icon: '🎯',
          title: 'Hack de Ahorro',
          body:
            `Estás al ${porcentaje}% de "<strong>${masCercana.name}</strong>". Te faltan ` +
            `${formatMonto(restante)} para completarla — cualquier abono extra la acerca.`,
        };
  });

  /* ── Movimientos: la categoría donde más gastaste este mes ── */
  readonly tipMovimientos = computed<Tip>(() => {
    const en = this.languageService.lang() === 'en';
    const gastoTotal = this.userData.monthlyExpenses();

    if (gastoTotal <= 0) {
      return en
        ? {
            icon: '💸',
            title: 'No expenses yet this month',
            body:
              "As soon as you log your first expenses this month, you'll see which category is " +
              'costing you the most.',
          }
        : {
            icon: '💸',
            title: 'Sin gastos este mes todavía',
            body:
              'En cuanto registres tus primeros gastos del mes, aquí vas a ver cuál categoría ' +
              'te está costando más.',
          };
    }

    const categoria = this.categoriaConMasGastoEsteMes();
    if (!categoria) {
      return en
        ? { icon: '💸', title: 'Expense Detector', body: `So far this month you've logged ${formatMonto(gastoTotal)} in expenses.` }
        : { icon: '💸', title: 'Detector de Gastos', body: `Este mes llevas ${formatMonto(gastoTotal)} en gastos registrados.` };
    }

    const porcentaje = Math.round((categoria.monto / gastoTotal) * 1000) / 10;
    return en
      ? {
          icon: '💸',
          title: 'Your top spending category',
          body:
            `"<strong>${categoria.nombre}</strong>" accounts for ${formatMonto(categoria.monto)} this month, ` +
            `${porcentaje}% of your ${formatMonto(gastoTotal)} in total expenses.`,
        }
      : {
          icon: '💸',
          title: 'Tu categoría con más gasto',
          body:
            `"<strong>${categoria.nombre}</strong>" se lleva ${formatMonto(categoria.monto)} este mes, ` +
            `el ${porcentaje}% de tus ${formatMonto(gastoTotal)} en gastos totales.`,
        };
  });

  /* ── Presupuestos: el que está más cerca de su límite ── */
  readonly tipPresupuestos = computed<Tip>(() => {
    const en = this.languageService.lang() === 'en';
    const presupuestos = this.userData.budgets();

    if (presupuestos.length === 0) {
      return en
        ? {
            icon: '💡',
            title: "You don't have any budgets yet",
            body:
              'Create a budget by category (like "Food" or "Transport") and this tip will show ' +
              "you which one is closest to running out.",
          }
        : {
            icon: '💡',
            title: 'Todavía no tienes presupuestos',
            body:
              'Crea un presupuesto por categoría (por ejemplo, "Comida" o "Transporte") y aquí ' +
              'vas a ver cuál está más cerca de agotarse.',
          };
    }

    const critico = this.presupuestoMasUsado();
    if (!critico) {
      return en
        ? { icon: '✅', title: 'Budgets under control', body: "None of your budgets have crossed 50% of their limit this month." }
        : { icon: '✅', title: 'Presupuestos bajo control', body: 'Ninguno de tus presupuestos ha superado el 50% de su límite este mes.' };
    }

    if (critico.porcentaje >= 100) {
      return en
        ? {
            icon: '⚠️',
            title: 'Budget exceeded',
            body:
              `"<strong>${critico.category}</strong>" already went over its limit: you spent ` +
              `${formatMonto(critico.spent)} of ${formatMonto(critico.limit)} (${critico.porcentaje}%).`,
          }
        : {
            icon: '⚠️',
            title: 'Presupuesto excedido',
            body:
              `"<strong>${critico.category}</strong>" ya superó su límite: gastaste ` +
              `${formatMonto(critico.spent)} de ${formatMonto(critico.limit)} (${critico.porcentaje}%).`,
          };
    }

    return en
      ? {
          icon: '💡',
          title: 'Budget to watch',
          body:
            `"<strong>${critico.category}</strong>" is at ${critico.porcentaje}% of its limit ` +
            `(${formatMonto(critico.spent)} of ${formatMonto(critico.limit)}).`,
        }
      : {
          icon: '💡',
          title: 'Presupuesto por vigilar',
          body:
            `"<strong>${critico.category}</strong>" lleva el ${critico.porcentaje}% de su límite ` +
            `(${formatMonto(critico.spent)} de ${formatMonto(critico.limit)}).`,
        };
  });

  /* ── Reportes: cómo va el flujo neto de este mes contra el anterior ── */
  readonly tipReportes = computed<Tip>(() => {
    const en = this.languageService.lang() === 'en';
    const variacion = this.userData.balanceChangePercent();
    const ingreso = this.userData.monthlyIncome();
    const gasto = this.userData.monthlyExpenses();

    if (variacion === null) {
      if (ingreso <= 0 && gasto <= 0) {
        return en
          ? {
              icon: '📊',
              title: 'Not enough data yet',
              body:
                'You need transactions from at least two months so this tip can compare your net ' +
                'flow (income - expenses) month over month.',
            }
          : {
              icon: '📊',
              title: 'Sin datos suficientes todavía',
              body:
                'Necesitas movimientos de al menos dos meses para que este consejo compare tu ' +
                'flujo neto (ingresos - gastos) mes a mes.',
            };
      }
      return en
        ? {
            icon: '📊',
            title: 'This month',
            body:
              `Your net flow this month is ${formatMonto(ingreso - gasto)} (${formatMonto(ingreso)} ` +
              `in income, ${formatMonto(gasto)} in expenses). There's no data from last month to compare against.`,
          }
        : {
            icon: '📊',
            title: 'Este mes',
            body:
              `Tu flujo neto de este mes es ${formatMonto(ingreso - gasto)} (${formatMonto(ingreso)} ` +
              `en ingresos, ${formatMonto(gasto)} en gastos). El mes pasado no tienes movimientos para comparar.`,
          };
    }

    const mejor = variacion >= 0;
    return en
      ? {
          icon: '📊',
          title: mejor ? 'Your net flow improved' : 'Your net flow dropped',
          body:
            `Your net flow (income - expenses) this month is ${Math.abs(variacion)}% ` +
            `${mejor ? 'better' : 'worse'} than last month.`,
        }
      : {
          icon: '📊',
          title: mejor ? 'Mejoraste tu flujo neto' : 'Tu flujo neto bajó',
          body:
            `Tu flujo neto (ingresos - gastos) de este mes es ${Math.abs(variacion)}% ` +
            `${mejor ? 'mejor' : 'peor'} que el mes pasado.`,
        };
  });

  /* ── Utilidades internas (sin idioma: son cálculos, no texto) ── */

  private presupuestoMasUsado(): { category: string; spent: number; limit: number; porcentaje: number } | null {
    const presupuestos = this.userData
      .budgets()
      .filter((p) => p.limit > 0)
      .map((p) => ({
        category: p.category,
        spent: p.spent,
        limit: p.limit,
        porcentaje: Math.round((p.spent / p.limit) * 1000) / 10,
      }))
      .sort((a, b) => b.porcentaje - a.porcentaje);

    const primero = presupuestos[0];
    if (!primero || primero.porcentaje < 50) return null;
    return primero;
  }

  private categoriaConMasGastoEsteMes(): { nombre: string; monto: number } | null {
    const porCategoria = new Map<string, number>();
    for (const t of this.userData.transactions()) {
      if (t.type !== 'egreso') continue;
      if (!estaEnMesActual(t.fechaIso)) continue;
      porCategoria.set(t.category, (porCategoria.get(t.category) ?? 0) + Math.abs(t.amount));
    }

    let mejor: { nombre: string; monto: number } | null = null;
    for (const [nombre, monto] of porCategoria) {
      if (!mejor || monto > mejor.monto) mejor = { nombre, monto };
    }
    return mejor;
  }
}

function formatMonto(valor: number): string {
  const signo = valor < 0 ? '-' : '';
  return `${signo}$${Math.abs(valor).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function estaEnMesActual(iso: string): boolean {
  const fecha = new Date(iso);
  const ahora = new Date();
  return fecha.getFullYear() === ahora.getFullYear() && fecha.getMonth() === ahora.getMonth();
}

/** Meses de calendario (redondeados hacia arriba) entre hoy y una fecha límite ISO. */
function mesesHasta(fechaIso: string): number | null {
  const limite = new Date(fechaIso);
  if (Number.isNaN(limite.getTime())) return null;
  const ahora = new Date();
  const meses =
    (limite.getFullYear() - ahora.getFullYear()) * 12 + (limite.getMonth() - ahora.getMonth());
  return Math.max(1, meses);
}

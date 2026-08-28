import { Injectable, Logger } from '@nestjs/common';

/**
 * Datos que el SRI devuelve para un RUC a través del servicio que usa su
 * propia página pública de "Consulta de RUC"
 * (https://srienlinea.sri.gob.ec/sri-en-linea/SriRucWeb/ConsultaRuc/Consultas/consultaRuc).
 * Es información abierta del padrón de contribuyentes: no requiere usuario
 * ni clave del SRI.
 *
 * ADVERTENCIA: esto NO es una API documentada ni oficial del SRI, es el
 * mismo endpoint interno que usa su sitio web para pintar los resultados.
 * El SRI puede cambiarlo, moverlo o bloquearlo sin aviso, y esta consulta
 * no se pudo probar contra el sitio real (esta sesión no tiene salida de
 * red hacia sri.gob.ec). Por eso nunca debe ser la única fuente de verdad
 * ni bloquear el uso de la app si el servicio falla — ver la política de
 * tolerancia a fallos en PerfilTributarioService.
 */
export interface InfoRucSri {
  numeroRuc: string;
  razonSocial: string;
  estado: string | null;
  tipoContribuyente: string | null;
  obligadoLlevarContabilidad: boolean | null;
  agenteRetencion: boolean | null;
  contribuyenteEspecial: boolean | null;
}

export type ResultadoConsultaRucSri =
  | { tipo: 'ENCONTRADO'; info: InfoRucSri }
  | { tipo: 'NO_EXISTE' }
  | { tipo: 'SERVICIO_NO_DISPONIBLE'; motivo: string };

const URL_CONSOLIDADO_CONTRIBUYENTE =
  'https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/ConsolidadoContribuyente/obtenerPorNumerosRuc';

const TIEMPO_LIMITE_MS = 8000;

@Injectable()
export class ConsultaRucSriService {
  private readonly logger = new Logger(ConsultaRucSriService.name);

  /**
   * Consulta el RUC en el padrón público del SRI. Nunca lanza una
   * excepción por problemas de red o de formato de la respuesta: en esos
   * casos devuelve SERVICIO_NO_DISPONIBLE para que quien llama decida qué
   * hacer (normalmente: no bloquear al usuario, solo avisar).
   */
  async consultar(ruc: string): Promise<ResultadoConsultaRucSri> {
    const controlador = new AbortController();
    const temporizador = setTimeout(
      () => controlador.abort(),
      TIEMPO_LIMITE_MS,
    );

    try {
      const respuesta = await fetch(
        `${URL_CONSOLIDADO_CONTRIBUYENTE}?ruc=${encodeURIComponent(ruc)}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json, text/plain, */*',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            Referer:
              'https://srienlinea.sri.gob.ec/sri-en-linea/SriRucWeb/ConsultaRuc/Consultas/consultaRuc',
          },
          signal: controlador.signal,
        },
      );

      if (!respuesta.ok) {
        this.logger.warn(
          `El servicio de RUC del SRI respondió con estado ${respuesta.status} para el RUC ${ruc}`,
        );
        return {
          tipo: 'SERVICIO_NO_DISPONIBLE',
          motivo: `El SRI respondió con estado HTTP ${respuesta.status}`,
        };
      }

      let cuerpo: unknown;
      try {
        cuerpo = await respuesta.json();
      } catch {
        this.logger.warn(
          `La respuesta del SRI para el RUC ${ruc} no fue JSON válido`,
        );
        return {
          tipo: 'SERVICIO_NO_DISPONIBLE',
          motivo: 'La respuesta del SRI no se pudo interpretar',
        };
      }

      const registro = this.extraerPrimerRegistro(cuerpo);

      if (!registro) {
        return { tipo: 'NO_EXISTE' };
      }

      return { tipo: 'ENCONTRADO', info: this.normalizar(registro) };
    } catch (error: unknown) {
      const motivo =
        error instanceof Error ? error.message : 'error desconocido';
      this.logger.warn(
        `No se pudo consultar el RUC ${ruc} en el SRI: ${motivo}`,
      );
      return { tipo: 'SERVICIO_NO_DISPONIBLE', motivo };
    } finally {
      clearTimeout(temporizador);
    }
  }

  private extraerPrimerRegistro(
    cuerpo: unknown,
  ): Record<string, unknown> | null {
    if (Array.isArray(cuerpo)) {
      const primero: unknown = cuerpo[0];
      return this.esObjeto(primero) ? primero : null;
    }

    return this.esObjeto(cuerpo) ? cuerpo : null;
  }

  private esObjeto(valor: unknown): valor is Record<string, unknown> {
    return typeof valor === 'object' && valor !== null;
  }

  private normalizar(registro: Record<string, unknown>): InfoRucSri {
    const texto = (clave: string): string | null => {
      const valor = registro[clave];
      return typeof valor === 'string' && valor.trim().length > 0
        ? valor.trim()
        : null;
    };

    const booleanoSiNo = (clave: string): boolean | null => {
      const valor = registro[clave];
      if (typeof valor === 'boolean') {
        return valor;
      }
      if (typeof valor === 'string') {
        return valor.trim().toUpperCase() === 'SI';
      }
      return null;
    };

    return {
      numeroRuc: texto('numeroRuc') ?? texto('ruc') ?? '',
      razonSocial: texto('razonSocial') ?? '',
      estado: texto('estadoContribuyenteRuc') ?? texto('estado'),
      tipoContribuyente: texto('tipoContribuyente'),
      obligadoLlevarContabilidad: booleanoSiNo('obligadoLlevarContabilidad'),
      agenteRetencion: booleanoSiNo('agenteRetencion'),
      contribuyenteEspecial: booleanoSiNo('contribuyenteEspecial'),
    };
  }
}

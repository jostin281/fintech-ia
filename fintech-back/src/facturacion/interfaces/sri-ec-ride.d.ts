// Compatibilidad para proyectos NestJS CommonJS que todavía usan
// `moduleResolution: "node"`. El paquete sri-ec publica este submódulo mediante
// `exports`, una característica que TypeScript resuelve de forma nativa con
// Node16/NodeNext, pero no con el resolvedor heredado.
declare module 'sri-ec/ride' {
  import type { Comprobante } from 'sri-ec';

  export interface AutorizacionRide {
    numero: string;
    fecha: string;
  }

  export interface RideOptions<T extends Comprobante = Comprobante> {
    documento: T;
    claveAcceso: string;
    autorizacion?: AutorizacionRide;
    logo?: Uint8Array;
    opciones?: {
      tamano?: 'A4' | 'LETTER';
      codigoBarras?: boolean;
      incluirQr?: boolean;
    };
  }

  export function generarRide(
    opciones: RideOptions<Comprobante>,
  ): Promise<Uint8Array>;
}

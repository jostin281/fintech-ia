import { SetMetadata } from '@nestjs/common';

// Clave utilizada por el guard para reconocer rutas bloqueadas en modo demo.
export const CLAVE_BLOQUEADO_EN_DEMO = 'bloqueadoEnDemo';

// Marca un controlador o endpoint como no disponible para cuentas demo
// (usadas por el botón "Usar demo" del login). Se usa en las áreas que
// tocan integraciones reales o generan documentos tributarios reales:
// SRI en Línea, firma electrónica, facturación y RDEP.
export const BloqueadoEnDemo = () => SetMetadata(CLAVE_BLOQUEADO_EN_DEMO, true);

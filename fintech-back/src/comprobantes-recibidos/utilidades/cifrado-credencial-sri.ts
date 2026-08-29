// Cifra/descifra el usuario y clave de SRI en Línea que un usuario decide
// guardar para la descarga automática de comprobantes recibidos.
//
// Reutiliza el mismo mecanismo (AES-256-GCM) y la misma clave de entorno
// que la firma electrónica (FACTURACION_FIRMA_ENCRYPTION_KEY), pero con un
// "AAD" (datos adicionales autenticados) distinto, para que un texto
// cifrado de un contexto no pueda reutilizarse ni descifrarse como si
// fuera del otro.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { InternalServerErrorException } from '@nestjs/common';

const ALGORITMO = 'aes-256-gcm';
const LONGITUD_VECTOR_BYTES = 12;
const DATOS_ADICIONALES = Buffer.from('sri-credenciales-v1', 'utf8');

export interface CredencialSriCifrada {
  contenido: Uint8Array<ArrayBuffer>;
  vectorInicializacion: Uint8Array<ArrayBuffer>;
  etiquetaAutenticacion: Uint8Array<ArrayBuffer>;
}

export interface CredencialSriEnClaro {
  usuarioSri: string;
  claveSri: string;
}

export function cifrarClaveSri(
  claveSri: string,
  clave: Buffer,
): CredencialSriCifrada {
  const vectorInicializacion = randomBytes(LONGITUD_VECTOR_BYTES);
  const cifrador = createCipheriv(ALGORITMO, clave, vectorInicializacion);
  cifrador.setAAD(DATOS_ADICIONALES);

  const contenido = Buffer.concat([
    cifrador.update(claveSri, 'utf8'),
    cifrador.final(),
  ]);

  return {
    contenido: copiarBytes(contenido),
    vectorInicializacion: copiarBytes(vectorInicializacion),
    etiquetaAutenticacion: copiarBytes(cifrador.getAuthTag()),
  };
}

export function descifrarClaveSri(
  contenido: Uint8Array,
  vectorInicializacion: Uint8Array,
  etiquetaAutenticacion: Uint8Array,
  clave: Buffer,
): string {
  try {
    const descifrador = createDecipheriv(
      ALGORITMO,
      clave,
      Buffer.from(vectorInicializacion),
    );
    descifrador.setAAD(DATOS_ADICIONALES);
    descifrador.setAuthTag(Buffer.from(etiquetaAutenticacion));

    return Buffer.concat([
      descifrador.update(Buffer.from(contenido)),
      descifrador.final(),
    ]).toString('utf8');
  } catch {
    throw new InternalServerErrorException(
      'No se pudo descifrar la clave del SRI almacenada',
    );
  }
}

function copiarBytes(datos: Uint8Array): Uint8Array<ArrayBuffer> {
  const copia = new Uint8Array(datos.byteLength);
  copia.set(datos);
  return copia;
}

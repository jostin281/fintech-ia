import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { InternalServerErrorException } from '@nestjs/common';
import type { Certificate } from 'sri-ec';

const ALGORITMO = 'aes-256-gcm';
const LONGITUD_CLAVE_BYTES = 32;
const LONGITUD_VECTOR_BYTES = 12;
const DATOS_ADICIONALES = Buffer.from('facturacion-firma-v1', 'utf8');

export interface CredencialCifrada {
  contenido: Uint8Array<ArrayBuffer>;
  vectorInicializacion: Uint8Array<ArrayBuffer>;
  etiquetaAutenticacion: Uint8Array<ArrayBuffer>;
}

export function obtenerClaveCifrado(claveBase64: string | undefined): Buffer {
  if (!claveBase64) {
    throw new InternalServerErrorException(
      'Falta configurar FACTURACION_FIRMA_ENCRYPTION_KEY',
    );
  }

  const clave = Buffer.from(claveBase64, 'base64');

  if (clave.length !== LONGITUD_CLAVE_BYTES) {
    throw new InternalServerErrorException(
      'FACTURACION_FIRMA_ENCRYPTION_KEY debe contener 32 bytes en Base64',
    );
  }

  return clave;
}

export function cifrarCertificado(
  certificado: Certificate,
  clave: Buffer,
): CredencialCifrada {
  const vectorInicializacion = randomBytes(LONGITUD_VECTOR_BYTES);
  const cifrador = createCipheriv(ALGORITMO, clave, vectorInicializacion);
  cifrador.setAAD(DATOS_ADICIONALES);

  const texto = JSON.stringify(certificado);
  const contenido = Buffer.concat([
    cifrador.update(texto, 'utf8'),
    cifrador.final(),
  ]);

  return {
    // Prisma 7 tipa Bytes como Uint8Array<ArrayBuffer>. Se crea una copia
    // para no conservar el ArrayBufferLike genérico que utiliza Buffer.
    contenido: copiarBytes(contenido),
    vectorInicializacion: copiarBytes(vectorInicializacion),
    etiquetaAutenticacion: copiarBytes(cifrador.getAuthTag()),
  };
}

export function descifrarCertificado(
  contenido: Uint8Array,
  vectorInicializacion: Uint8Array,
  etiquetaAutenticacion: Uint8Array,
  clave: Buffer,
): Certificate {
  try {
    const descifrador = createDecipheriv(
      ALGORITMO,
      clave,
      Buffer.from(vectorInicializacion),
    );
    descifrador.setAAD(DATOS_ADICIONALES);
    descifrador.setAuthTag(Buffer.from(etiquetaAutenticacion));

    const texto = Buffer.concat([
      descifrador.update(Buffer.from(contenido)),
      descifrador.final(),
    ]).toString('utf8');

    const valor: unknown = JSON.parse(texto);

    if (!esCertificado(valor)) {
      throw new Error('La credencial descifrada no tiene el formato esperado');
    }

    return valor;
  } catch {
    throw new InternalServerErrorException(
      'No se pudo descifrar la firma electrónica almacenada',
    );
  }
}

function esCertificado(valor: unknown): valor is Certificate {
  if (typeof valor !== 'object' || valor === null) {
    return false;
  }

  return (
    'certPem' in valor &&
    typeof valor.certPem === 'string' &&
    'privateKeyPem' in valor &&
    typeof valor.privateKeyPem === 'string' &&
    'extraCerts' in valor &&
    Array.isArray(valor.extraCerts) &&
    valor.extraCerts.every((certificado) => typeof certificado === 'string')
  );
}

function copiarBytes(datos: Uint8Array): Uint8Array<ArrayBuffer> {
  const copia = new Uint8Array(datos.byteLength);
  copia.set(datos);
  return copia;
}

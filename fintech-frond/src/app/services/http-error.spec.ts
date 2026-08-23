import { HttpErrorResponse } from '@angular/common/http';

import { mensajeDeError } from './http-error';

describe('mensajeDeError', () => {
  it('usa el mensaje de validación del backend cuando viene como texto', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { message: 'El correo ya está registrado' },
    });

    expect(mensajeDeError(error, 'fallback')).toBe('El correo ya está registrado');
  });

  it('une los mensajes de class-validator cuando vienen como arreglo', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { message: ['El nombre es obligatorio', 'El correo no es válido'] },
    });

    expect(mensajeDeError(error, 'fallback')).toBe('El nombre es obligatorio El correo no es válido');
  });

  it('devuelve un mensaje claro de conexión cuando el backend no responde (status 0)', () => {
    const error = new HttpErrorResponse({ status: 0, error: null });

    expect(mensajeDeError(error, 'fallback')).toBe(
      'No se pudo conectar con el servidor. Verifica que el backend esté corriendo.',
    );
  });

  it('usa el mensaje de reserva si el error HTTP no trae cuerpo reconocible', () => {
    const error = new HttpErrorResponse({ status: 500, error: {} });

    expect(mensajeDeError(error, 'Ocurrió un error inesperado.')).toBe('Ocurrió un error inesperado.');
  });

  it('usa el mensaje de reserva si el error no es un HttpErrorResponse', () => {
    expect(mensajeDeError(new Error('algo raro'), 'fallback')).toBe('fallback');
    expect(mensajeDeError('texto plano', 'fallback')).toBe('fallback');
  });
});

import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import Decimal from 'decimal.js';

import { PrismaService } from '../../prisma/prisma.service';
import { ComprobantesRecibidosService } from '../comprobantes-recibidos.service';
import type { FacturaSriRecibida } from '../interfaces/factura-sri-recibida.interface';
import { parsearFacturaSriRecibida } from '../utilidades/parser-factura-sri-recibida';

// El parser ya tiene sus propias pruebas (parser-factura-sri-recibida.test.ts);
// aquí se simula para poder controlar exactamente qué "XML" recibe el
// servicio sin tener que construir un archivo real en cada caso.
jest.mock('../utilidades/parser-factura-sri-recibida', () => ({
  parsearFacturaSriRecibida: jest.fn(),
}));

const parsearFacturaSriRecibidaMock = parsearFacturaSriRecibida as jest.Mock;

// Estas pruebas cubren los tres comportamientos más sensibles del pipeline
// de ingesta: que nunca se duplique un comprobante ya importado (la
// restricción real vive en la base de datos, pero el servicio debe
// consultarla antes de crear nada), que el proveedor se cree o reutilice
// con upsert (nunca duplicados por RUC), y que el Movimiento espejo de una
// línea se cree de forma diferida solo cuando recibe categoría — nunca antes.
describe('ComprobantesRecibidosService', () => {
  let service: ComprobantesRecibidosService;
  let prismaService: {
    comprobanteRecibido: Record<string, jest.Mock>;
    detalleComprobanteRecibido: Record<string, jest.Mock>;
    proveedor: Record<string, jest.Mock>;
    movimiento: Record<string, jest.Mock>;
    reglaCategorizacion: Record<string, jest.Mock>;
    categoria: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };

  const construirFactura = (
    overrides: Partial<FacturaSriRecibida> = {},
  ): FacturaSriRecibida => ({
    claveAcceso: '1234567890123456789012345678901234567890123456789'.slice(
      0,
      49,
    ),
    rucEmisor: '1790012345001',
    razonSocialEmisor: 'Comercial Andina S.A.',
    nombreComercialEmisor: null,
    establecimiento: '001',
    puntoEmision: '001',
    secuencial: '000000123',
    fechaEmision: new Date('2026-08-10T00:00:00.000-05:00'),
    subtotalSinImpuestos: '10.00',
    totalDescuento: '0.00',
    iva: '1.50',
    importeTotal: '11.50',
    detalles: [
      {
        codigoPrincipal: 'A1',
        descripcion: 'Arroz superior',
        cantidad: '1.000000',
        precioUnitario: '10.000000',
        descuento: '0.00',
        precioTotalSinImpuesto: '10.00',
        impuestos: [
          {
            codigo: '2',
            codigoPorcentaje: '4',
            tarifa: '15.00',
            baseImponible: '10.00',
            valor: '1.50',
          },
        ],
      },
    ],
    advertencia: null,
    ...overrides,
  });

  beforeEach(async () => {
    prismaService = {
      comprobanteRecibido: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      detalleComprobanteRecibido: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
      proveedor: { upsert: jest.fn() },
      movimiento: { create: jest.fn(), update: jest.fn() },
      reglaCategorizacion: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      categoria: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    // El cliente "transaccional" que recibe el callback es el mismo mock:
    // como en las pruebas no existe una BD real, no hace falta distinguirlo.
    prismaService.$transaction.mockImplementation(
      (callback: (transaccion: unknown) => unknown) => callback(prismaService),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComprobantesRecibidosService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get(ComprobantesRecibidosService);
    parsearFacturaSriRecibidaMock.mockReset();
  });

  describe('importar', () => {
    it('detecta un comprobante duplicado por (usuarioId, claveAcceso) y no crea proveedor ni comprobante', async () => {
      const factura = construirFactura();
      parsearFacturaSriRecibidaMock.mockReturnValue({ ok: true, factura });
      prismaService.comprobanteRecibido.findUnique.mockResolvedValue({
        id: 55,
      });

      const resumen = await service.importar(1, [
        {
          originalname: 'factura.xml',
          buffer: Buffer.from('<factura/>'),
        } as any,
      ]);

      expect(resumen.duplicados).toBe(1);
      expect(resumen.procesados).toBe(0);
      expect(resumen.resultados[0]).toMatchObject({
        estado: 'DUPLICADO',
        comprobanteId: 55,
      });
      expect(prismaService.comprobanteRecibido.findUnique).toHaveBeenCalledWith(
        {
          where: {
            usuarioId_claveAcceso: {
              usuarioId: 1,
              claveAcceso: factura.claveAcceso,
            },
          },
          select: { id: true },
        },
      );
      expect(prismaService.proveedor.upsert).not.toHaveBeenCalled();
      expect(prismaService.comprobanteRecibido.create).not.toHaveBeenCalled();
    });

    it('crea o reutiliza el proveedor con upsert (nunca duplicados por RUC) al importar un comprobante nuevo', async () => {
      const factura = construirFactura();
      parsearFacturaSriRecibidaMock.mockReturnValue({ ok: true, factura });
      prismaService.comprobanteRecibido.findUnique.mockResolvedValue(null);
      prismaService.proveedor.upsert.mockResolvedValue({
        id: 9,
        ruc: factura.rucEmisor,
        razonSocial: factura.razonSocialEmisor,
      });
      prismaService.comprobanteRecibido.create.mockResolvedValue({ id: 200 });
      prismaService.detalleComprobanteRecibido.create.mockResolvedValue({
        id: 300,
        total: new Decimal('11.50'),
      });

      const resumen = await service.importar(1, [
        {
          originalname: 'factura.xml',
          buffer: Buffer.from('<factura/>'),
        } as any,
      ]);

      expect(resumen.procesados).toBe(1);
      expect(prismaService.proveedor.upsert).toHaveBeenCalledWith({
        where: { usuarioId_ruc: { usuarioId: 1, ruc: factura.rucEmisor } },
        update: {
          razonSocial: factura.razonSocialEmisor,
          nombreComercial: factura.nombreComercialEmisor,
        },
        create: {
          usuarioId: 1,
          ruc: factura.rucEmisor,
          razonSocial: factura.razonSocialEmisor,
          nombreComercial: factura.nombreComercialEmisor,
        },
      });
      expect(prismaService.comprobanteRecibido.create).toHaveBeenCalledTimes(1);
      // Sin reglas de categorización activas, la línea no debe generar un
      // Movimiento espejo todavía (se crea de forma diferida, ver más abajo).
      expect(prismaService.movimiento.create).not.toHaveBeenCalled();
    });
  });

  describe('actualizarCategoriaDetalle', () => {
    const comprobanteExistente = {
      id: 10,
      usuarioId: 1,
      razonSocialEmisor: 'Comercial Andina S.A.',
      fechaEmision: new Date('2026-08-10T00:00:00.000-05:00'),
    };

    beforeEach(() => {
      prismaService.comprobanteRecibido.findFirst.mockResolvedValue(
        comprobanteExistente,
      );
      prismaService.categoria.findUnique.mockResolvedValue({
        tipo: 'GASTO',
        activa: true,
      });
      prismaService.detalleComprobanteRecibido.update.mockResolvedValue({
        id: 77,
        categoriaId: 3,
        cantidad: new Decimal('1.000000'),
      });
    });

    it('crea el Movimiento de forma diferida cuando la línea todavía no tenía uno asignado', async () => {
      prismaService.detalleComprobanteRecibido.findFirst.mockResolvedValue({
        id: 77,
        comprobanteRecibidoId: 10,
        descripcion: 'Arroz superior',
        total: new Decimal('11.50'),
        movimientoId: null,
      });
      prismaService.comprobanteRecibido.findUniqueOrThrow.mockResolvedValue(
        comprobanteExistente,
      );
      prismaService.movimiento.create.mockResolvedValue({ id: 900 });

      await service.actualizarCategoriaDetalle(1, 10, 77, { categoriaId: 3 });

      expect(prismaService.movimiento.create).toHaveBeenCalledTimes(1);
      const datosMovimientoCreado = (
        prismaService.movimiento.create.mock.calls[0] as [
          { data: Record<string, unknown> },
        ]
      )[0].data;
      expect(datosMovimientoCreado.tipo).toBe('GASTO');
      expect(datosMovimientoCreado.categoriaId).toBe(3);
      expect(datosMovimientoCreado.usuarioId).toBe(1);
      expect(datosMovimientoCreado.origen).toBe('SRI');
      expect(prismaService.movimiento.update).not.toHaveBeenCalled();
      // La línea se enlaza con el Movimiento recién creado.
      expect(
        prismaService.detalleComprobanteRecibido.update,
      ).toHaveBeenCalledWith({
        where: { id: 77 },
        data: { movimientoId: 900 },
      });
    });

    it('actualiza el Movimiento existente en vez de crear uno nuevo cuando la línea ya tenía uno asignado', async () => {
      prismaService.detalleComprobanteRecibido.findFirst.mockResolvedValue({
        id: 77,
        comprobanteRecibidoId: 10,
        descripcion: 'Arroz superior',
        total: new Decimal('11.50'),
        movimientoId: 500,
      });

      await service.actualizarCategoriaDetalle(1, 10, 77, { categoriaId: 3 });

      expect(prismaService.movimiento.update).toHaveBeenCalledWith({
        where: { id: 500 },
        data: { categoriaId: 3 },
      });
      expect(prismaService.movimiento.create).not.toHaveBeenCalled();
      expect(
        prismaService.comprobanteRecibido.findUniqueOrThrow,
      ).not.toHaveBeenCalled();
    });

    it('rechaza corregir una línea de un comprobante que no pertenece al usuario autenticado', async () => {
      prismaService.comprobanteRecibido.findFirst.mockResolvedValue(null);

      await expect(
        service.actualizarCategoriaDetalle(2, 10, 77, { categoriaId: 3 }),
      ).rejects.toThrow(NotFoundException);

      expect(
        prismaService.detalleComprobanteRecibido.findFirst,
      ).not.toHaveBeenCalled();
      expect(prismaService.movimiento.create).not.toHaveBeenCalled();
    });
  });
});

-- CreateEnum
CREATE TYPE "TipoComprobanteRecibido" AS ENUM ('FACTURA');

-- CreateEnum
CREATE TYPE "EstadoComprobanteRecibido" AS ENUM ('PENDIENTE', 'PROCESANDO', 'PROCESADO', 'ERROR_XML');

-- CreateEnum
CREATE TYPE "OrigenMovimiento" AS ENUM ('MANUAL', 'SRI', 'VENTA', 'COMPRA');

-- CreateEnum
CREATE TYPE "MetodoClasificacionDetalle" AS ENUM ('REGLA', 'MANUAL', 'IA', 'PROVEEDOR');

-- CreateEnum
CREATE TYPE "OrigenReglaCategorizacion" AS ENUM ('MANUAL', 'CORRECCION');

-- AlterTable
ALTER TABLE "movimientos" ADD COLUMN "origen" "OrigenMovimiento" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "proveedores" (
    "id" SERIAL NOT NULL,
    "ruc" VARCHAR(13) NOT NULL,
    "razon_social" VARCHAR(300) NOT NULL,
    "nombre_comercial" VARCHAR(300),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "usuario_id" INTEGER NOT NULL,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprobantes_recibidos" (
    "id" SERIAL NOT NULL,
    "tipo_comprobante" "TipoComprobanteRecibido" NOT NULL DEFAULT 'FACTURA',
    "estado" "EstadoComprobanteRecibido" NOT NULL DEFAULT 'PENDIENTE',
    "clave_acceso" VARCHAR(49) NOT NULL,
    "ruc_emisor" VARCHAR(13) NOT NULL,
    "razon_social_emisor" VARCHAR(300) NOT NULL,
    "nombre_comercial_emisor" VARCHAR(300),
    "establecimiento" VARCHAR(3) NOT NULL,
    "punto_emision" VARCHAR(3) NOT NULL,
    "secuencial" VARCHAR(9) NOT NULL,
    "fecha_emision" TIMESTAMP(3) NOT NULL,
    "subtotal_sin_impuestos" DECIMAL(12,2) NOT NULL,
    "total_descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "iva" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "importe_total" DECIMAL(12,2) NOT NULL,
    "xml_original" TEXT NOT NULL,
    "archivo_nombre" VARCHAR(255),
    "mensaje_error" TEXT,
    "descargado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "procesado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "proveedor_id" INTEGER NOT NULL,

    CONSTRAINT "comprobantes_recibidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detalles_comprobantes_recibidos" (
    "id" SERIAL NOT NULL,
    "codigo_principal" VARCHAR(25),
    "descripcion" VARCHAR(300) NOT NULL,
    "cantidad" DECIMAL(14,6) NOT NULL,
    "precio_unitario" DECIMAL(14,6) NOT NULL,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "base_imponible" DECIMAL(12,2) NOT NULL,
    "tarifa_codigo" VARCHAR(4) NOT NULL,
    "tarifa_porcentaje" DECIMAL(5,2) NOT NULL,
    "valor_iva" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "metodo_clasificacion" "MetodoClasificacionDetalle",
    "confianza" DECIMAL(5,2),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "comprobante_recibido_id" INTEGER NOT NULL,
    "categoria_id" INTEGER,
    "regla_categorizacion_id" INTEGER,
    "movimiento_id" INTEGER,

    CONSTRAINT "detalles_comprobantes_recibidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reglas_categorizacion" (
    "id" SERIAL NOT NULL,
    "palabra_clave" VARCHAR(150) NOT NULL,
    "prioridad" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "origen" "OrigenReglaCategorizacion" NOT NULL DEFAULT 'MANUAL',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "usuario_id" INTEGER,
    "categoria_id" INTEGER NOT NULL,

    CONSTRAINT "reglas_categorizacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proveedores_usuario_id_ruc_key" ON "proveedores"("usuario_id", "ruc");

-- CreateIndex
CREATE INDEX "proveedores_usuario_id_activo_razon_social_idx" ON "proveedores"("usuario_id", "activo", "razon_social");

-- CreateIndex
CREATE UNIQUE INDEX "comprobantes_recibidos_usuario_id_clave_acceso_key" ON "comprobantes_recibidos"("usuario_id", "clave_acceso");

-- CreateIndex
CREATE INDEX "comprobantes_recibidos_usuario_id_estado_fecha_emision_idx" ON "comprobantes_recibidos"("usuario_id", "estado", "fecha_emision");

-- CreateIndex
CREATE INDEX "comprobantes_recibidos_proveedor_id_idx" ON "comprobantes_recibidos"("proveedor_id");

-- CreateIndex
CREATE INDEX "detalles_comprobantes_recibidos_comprobante_recibido_id_idx" ON "detalles_comprobantes_recibidos"("comprobante_recibido_id");

-- CreateIndex
CREATE INDEX "detalles_comprobantes_recibidos_categoria_id_idx" ON "detalles_comprobantes_recibidos"("categoria_id");

-- CreateIndex
CREATE UNIQUE INDEX "detalles_comprobantes_recibidos_movimiento_id_key" ON "detalles_comprobantes_recibidos"("movimiento_id");

-- CreateIndex
CREATE INDEX "reglas_categorizacion_usuario_id_activa_prioridad_idx" ON "reglas_categorizacion"("usuario_id", "activa", "prioridad");

-- CreateIndex
CREATE INDEX "reglas_categorizacion_categoria_id_idx" ON "reglas_categorizacion"("categoria_id");

-- AddForeignKey
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes_recibidos" ADD CONSTRAINT "comprobantes_recibidos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes_recibidos" ADD CONSTRAINT "comprobantes_recibidos_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalles_comprobantes_recibidos" ADD CONSTRAINT "detalles_comprobantes_recibidos_comprobante_recibido_id_fkey" FOREIGN KEY ("comprobante_recibido_id") REFERENCES "comprobantes_recibidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalles_comprobantes_recibidos" ADD CONSTRAINT "detalles_comprobantes_recibidos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalles_comprobantes_recibidos" ADD CONSTRAINT "detalles_comprobantes_recibidos_regla_categorizacion_id_fkey" FOREIGN KEY ("regla_categorizacion_id") REFERENCES "reglas_categorizacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalles_comprobantes_recibidos" ADD CONSTRAINT "detalles_comprobantes_recibidos_movimiento_id_fkey" FOREIGN KEY ("movimiento_id") REFERENCES "movimientos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglas_categorizacion" ADD CONSTRAINT "reglas_categorizacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglas_categorizacion" ADD CONSTRAINT "reglas_categorizacion_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

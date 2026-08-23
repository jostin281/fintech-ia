-- CreateEnum
CREATE TYPE "TipoIdentificacionSri" AS ENUM ('RUC', 'CEDULA', 'PASAPORTE', 'CONSUMIDOR_FINAL', 'IDENTIFICACION_EXTERIOR');

-- CreateEnum
CREATE TYPE "TarifaIvaProducto" AS ENUM ('CERO', 'QUINCE');

-- CreateEnum
CREATE TYPE "EstadoFactura" AS ENUM ('BORRADOR', 'FIRMADA', 'RECIBIDA', 'AUTORIZADA', 'DEVUELTA', 'NO_AUTORIZADA', 'ANULADA_LOCAL', 'ERROR');

-- CreateEnum
CREATE TYPE "TratamientoTributarioMovimiento" AS ENUM ('INGRESO_GRAVADO', 'INGRESO_EXENTO', 'COSTO_GASTO_DEDUCIBLE', 'GASTO_PERSONAL', 'NO_DEDUCIBLE', 'IGNORAR');

-- CreateEnum
CREATE TYPE "CategoriaGastoPersonal" AS ENUM ('VIVIENDA', 'ALIMENTACION', 'SALUD', 'EDUCACION_ARTE_CULTURA', 'VESTIMENTA', 'TURISMO');

-- CreateEnum
CREATE TYPE "TipoRetencionRecibida" AS ENUM ('RENTA', 'IVA');

-- CreateTable
CREATE TABLE "firmas_electronicas" (
    "id" SERIAL NOT NULL,
    "credencial_cifrada" BYTEA NOT NULL,
    "vector_inicializacion" BYTEA NOT NULL,
    "etiqueta_autenticacion" BYTEA NOT NULL,
    "nombre_archivo" VARCHAR(255) NOT NULL,
    "numero_serie" VARCHAR(200) NOT NULL,
    "emisor_certificado" VARCHAR(500) NOT NULL,
    "tipo_clave" VARCHAR(10) NOT NULL,
    "valido_hasta" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "perfil_tributario_id" INTEGER NOT NULL,

    CONSTRAINT "firmas_electronicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes_facturacion" (
    "id" SERIAL NOT NULL,
    "tipo_identificacion" "TipoIdentificacionSri" NOT NULL,
    "identificacion" VARCHAR(20) NOT NULL,
    "razon_social" VARCHAR(300) NOT NULL,
    "correo" VARCHAR(150),
    "direccion" VARCHAR(300),
    "telefono" VARCHAR(30),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "perfil_tributario_id" INTEGER NOT NULL,

    CONSTRAINT "clientes_facturacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos_servicios_facturacion" (
    "id" SERIAL NOT NULL,
    "codigo_principal" VARCHAR(25) NOT NULL,
    "descripcion" VARCHAR(300) NOT NULL,
    "precio_unitario" DECIMAL(14,6) NOT NULL,
    "tarifa_iva" "TarifaIvaProducto" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "perfil_tributario_id" INTEGER NOT NULL,

    CONSTRAINT "productos_servicios_facturacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturas_electronicas" (
    "id" SERIAL NOT NULL,
    "estado" "EstadoFactura" NOT NULL DEFAULT 'BORRADOR',
    "establecimiento" VARCHAR(3) NOT NULL,
    "punto_emision" VARCHAR(3) NOT NULL,
    "secuencial" INTEGER,
    "clave_acceso" VARCHAR(49),
    "fecha_emision" TIMESTAMP(3) NOT NULL,
    "forma_pago" VARCHAR(2) NOT NULL DEFAULT '20',
    "observacion" VARCHAR(300),
    "emisor_ruc" VARCHAR(13) NOT NULL,
    "emisor_razon_social" VARCHAR(300) NOT NULL,
    "emisor_nombre_comercial" VARCHAR(300),
    "emisor_direccion_matriz" VARCHAR(300) NOT NULL,
    "emisor_regimen_tributario" "RegimenTributario" NOT NULL,
    "emisor_obligado_contabilidad" BOOLEAN NOT NULL,
    "emisor_codigo_contribuyente_especial" VARCHAR(20),
    "emisor_codigo_agente_retencion" VARCHAR(20),
    "emisor_ambiente_sri" "AmbienteSri" NOT NULL,
    "comprador_tipo_identificacion" "TipoIdentificacionSri" NOT NULL,
    "comprador_identificacion" VARCHAR(20) NOT NULL,
    "comprador_razon_social" VARCHAR(300) NOT NULL,
    "comprador_correo" VARCHAR(150),
    "comprador_direccion" VARCHAR(300),
    "subtotal_cero" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "subtotal_quince" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_sin_impuestos" DECIMAL(14,2) NOT NULL,
    "total_descuento" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "iva" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "importe_total" DECIMAL(14,2) NOT NULL,
    "xml_firmado" TEXT,
    "xml_autorizado" TEXT,
    "numero_autorizacion" VARCHAR(49),
    "fecha_autorizacion" TIMESTAMP(3),
    "mensajes_sri" JSONB,
    "ultimo_intento_sri" TIMESTAMP(3),
    "eliminado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "perfil_tributario_id" INTEGER NOT NULL,
    "cliente_id" INTEGER NOT NULL,

    CONSTRAINT "facturas_electronicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detalles_facturas_electronicas" (
    "id" SERIAL NOT NULL,
    "codigo_principal" VARCHAR(25) NOT NULL,
    "descripcion" VARCHAR(300) NOT NULL,
    "cantidad" DECIMAL(14,6) NOT NULL,
    "precio_unitario" DECIMAL(14,6) NOT NULL,
    "descuento" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tarifa_iva" "TarifaIvaProducto" NOT NULL,
    "base_imponible" DECIMAL(14,2) NOT NULL,
    "valor_iva" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "factura_id" INTEGER NOT NULL,
    "producto_servicio_id" INTEGER NOT NULL,

    CONSTRAINT "detalles_facturas_electronicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secuencias_comprobantes" (
    "id" SERIAL NOT NULL,
    "codigo_documento" VARCHAR(2) NOT NULL,
    "establecimiento" VARCHAR(3) NOT NULL,
    "punto_emision" VARCHAR(3) NOT NULL,
    "siguiente_secuencial" INTEGER NOT NULL DEFAULT 1,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "perfil_tributario_id" INTEGER NOT NULL,

    CONSTRAINT "secuencias_comprobantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuraciones_categorias_tributarias" (
    "id" SERIAL NOT NULL,
    "categoria_id" INTEGER NOT NULL,
    "tratamiento" "TratamientoTributarioMovimiento" NOT NULL,
    "categoria_gasto_personal" "CategoriaGastoPersonal",
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "perfil_tributario_id" INTEGER NOT NULL,

    CONSTRAINT "configuraciones_categorias_tributarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retenciones_recibidas" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoRetencionRecibida" NOT NULL,
    "emisor_identificacion" VARCHAR(20) NOT NULL,
    "numero_comprobante" VARCHAR(50) NOT NULL,
    "fecha_emision" TIMESTAMP(3) NOT NULL,
    "base_imponible" DECIMAL(14,2) NOT NULL,
    "porcentaje" DECIMAL(7,4) NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "observacion" VARCHAR(300),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "perfil_tributario_id" INTEGER NOT NULL,
    "factura_id" INTEGER,

    CONSTRAINT "retenciones_recibidas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "firmas_electronicas_perfil_tributario_id_key" ON "firmas_electronicas"("perfil_tributario_id");

-- CreateIndex
CREATE INDEX "clientes_facturacion_perfil_tributario_id_activo_razon_soci_idx" ON "clientes_facturacion"("perfil_tributario_id", "activo", "razon_social");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_facturacion_perfil_tributario_id_identificacion_key" ON "clientes_facturacion"("perfil_tributario_id", "identificacion");

-- CreateIndex
CREATE INDEX "productos_servicios_facturacion_perfil_tributario_id_activo_idx" ON "productos_servicios_facturacion"("perfil_tributario_id", "activo", "descripcion");

-- CreateIndex
CREATE UNIQUE INDEX "productos_servicios_facturacion_perfil_tributario_id_codigo_key" ON "productos_servicios_facturacion"("perfil_tributario_id", "codigo_principal");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_electronicas_clave_acceso_key" ON "facturas_electronicas"("clave_acceso");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_electronicas_numero_autorizacion_key" ON "facturas_electronicas"("numero_autorizacion");

-- CreateIndex
CREATE INDEX "facturas_electronicas_perfil_tributario_id_estado_fecha_emi_idx" ON "facturas_electronicas"("perfil_tributario_id", "estado", "fecha_emision");

-- CreateIndex
CREATE INDEX "facturas_electronicas_cliente_id_idx" ON "facturas_electronicas"("cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_electronicas_perfil_tributario_id_establecimiento__key" ON "facturas_electronicas"("perfil_tributario_id", "establecimiento", "punto_emision", "secuencial");

-- CreateIndex
CREATE INDEX "detalles_facturas_electronicas_factura_id_idx" ON "detalles_facturas_electronicas"("factura_id");

-- CreateIndex
CREATE INDEX "detalles_facturas_electronicas_producto_servicio_id_idx" ON "detalles_facturas_electronicas"("producto_servicio_id");

-- CreateIndex
CREATE UNIQUE INDEX "secuencias_comprobantes_perfil_tributario_id_codigo_documen_key" ON "secuencias_comprobantes"("perfil_tributario_id", "codigo_documento", "establecimiento", "punto_emision");

-- CreateIndex
CREATE INDEX "configuraciones_categorias_tributarias_perfil_tributario_id_idx" ON "configuraciones_categorias_tributarias"("perfil_tributario_id", "tratamiento");

-- CreateIndex
CREATE UNIQUE INDEX "configuraciones_categorias_tributarias_perfil_tributario_id_key" ON "configuraciones_categorias_tributarias"("perfil_tributario_id", "categoria_id");

-- CreateIndex
CREATE INDEX "retenciones_recibidas_perfil_tributario_id_tipo_fecha_emisi_idx" ON "retenciones_recibidas"("perfil_tributario_id", "tipo", "fecha_emision", "activo");

-- CreateIndex
CREATE INDEX "retenciones_recibidas_factura_id_idx" ON "retenciones_recibidas"("factura_id");

-- CreateIndex
CREATE UNIQUE INDEX "retenciones_recibidas_perfil_tributario_id_emisor_identific_key" ON "retenciones_recibidas"("perfil_tributario_id", "emisor_identificacion", "numero_comprobante");

-- AddForeignKey
ALTER TABLE "firmas_electronicas" ADD CONSTRAINT "firmas_electronicas_perfil_tributario_id_fkey" FOREIGN KEY ("perfil_tributario_id") REFERENCES "perfiles_tributarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes_facturacion" ADD CONSTRAINT "clientes_facturacion_perfil_tributario_id_fkey" FOREIGN KEY ("perfil_tributario_id") REFERENCES "perfiles_tributarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos_servicios_facturacion" ADD CONSTRAINT "productos_servicios_facturacion_perfil_tributario_id_fkey" FOREIGN KEY ("perfil_tributario_id") REFERENCES "perfiles_tributarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_electronicas" ADD CONSTRAINT "facturas_electronicas_perfil_tributario_id_fkey" FOREIGN KEY ("perfil_tributario_id") REFERENCES "perfiles_tributarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_electronicas" ADD CONSTRAINT "facturas_electronicas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes_facturacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalles_facturas_electronicas" ADD CONSTRAINT "detalles_facturas_electronicas_factura_id_fkey" FOREIGN KEY ("factura_id") REFERENCES "facturas_electronicas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalles_facturas_electronicas" ADD CONSTRAINT "detalles_facturas_electronicas_producto_servicio_id_fkey" FOREIGN KEY ("producto_servicio_id") REFERENCES "productos_servicios_facturacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secuencias_comprobantes" ADD CONSTRAINT "secuencias_comprobantes_perfil_tributario_id_fkey" FOREIGN KEY ("perfil_tributario_id") REFERENCES "perfiles_tributarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuraciones_categorias_tributarias" ADD CONSTRAINT "configuraciones_categorias_tributarias_perfil_tributario_i_fkey" FOREIGN KEY ("perfil_tributario_id") REFERENCES "perfiles_tributarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retenciones_recibidas" ADD CONSTRAINT "retenciones_recibidas_perfil_tributario_id_fkey" FOREIGN KEY ("perfil_tributario_id") REFERENCES "perfiles_tributarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retenciones_recibidas" ADD CONSTRAINT "retenciones_recibidas_factura_id_fkey" FOREIGN KEY ("factura_id") REFERENCES "facturas_electronicas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "TipoContribuyente" AS ENUM ('PERSONA_NATURAL', 'SOCIEDAD');

-- CreateEnum
CREATE TYPE "RegimenTributario" AS ENUM ('GENERAL', 'RIMPE_NEGOCIO_POPULAR', 'RIMPE_EMPRENDEDOR');

-- CreateEnum
CREATE TYPE "AmbienteSri" AS ENUM ('PRUEBAS', 'PRODUCCION');

-- CreateTable
CREATE TABLE "perfiles_tributarios" (
    "id" SERIAL NOT NULL,
    "ruc" VARCHAR(13) NOT NULL,
    "razon_social" VARCHAR(300) NOT NULL,
    "nombre_comercial" VARCHAR(300),
    "direccion_matriz" VARCHAR(300) NOT NULL,
    "tipo_contribuyente" "TipoContribuyente" NOT NULL,
    "regimen_tributario" "RegimenTributario" NOT NULL DEFAULT 'GENERAL',
    "obligado_contabilidad" BOOLEAN NOT NULL DEFAULT false,
    "codigo_contribuyente_especial" VARCHAR(20),
    "codigo_agente_retencion" VARCHAR(20),
    "establecimiento" VARCHAR(3) NOT NULL DEFAULT '001',
    "punto_emision" VARCHAR(3) NOT NULL DEFAULT '001',
    "ambiente_sri" "AmbienteSri" NOT NULL DEFAULT 'PRUEBAS',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "usuario_id" INTEGER NOT NULL,

    CONSTRAINT "perfiles_tributarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "perfiles_tributarios_ruc_key" ON "perfiles_tributarios"("ruc");

-- CreateIndex
CREATE UNIQUE INDEX "perfiles_tributarios_usuario_id_key" ON "perfiles_tributarios"("usuario_id");

-- AddForeignKey
ALTER TABLE "perfiles_tributarios" ADD CONSTRAINT "perfiles_tributarios_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

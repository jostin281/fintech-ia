-- CreateEnum
CREATE TYPE "TipoIdentificacionTrabajadorRdep" AS ENUM ('CEDULA', 'IDENTIFICACION_EXTERIOR', 'PASAPORTE');

-- CreateEnum
CREATE TYPE "ResidenciaTrabajadorRdep" AS ENUM ('LOCAL', 'EXTERIOR');

-- CreateEnum
CREATE TYPE "CondicionDiscapacidadRdep" AS ENUM ('NO_APLICA', 'CON_DISCAPACIDAD', 'SUSTITUTO');

-- CreateEnum
CREATE TYPE "AplicaConvenioDobleImposicionRdep" AS ENUM ('SI', 'NO', 'NO_APLICA');

-- CreateEnum
CREATE TYPE "SistemaSalarioNetoRdep" AS ENUM ('SIN_SISTEMA', 'CON_SISTEMA');

-- CreateEnum
CREATE TYPE "TipoEmpleadorRdep" AS ENUM ('PRIVADO_MIXTO', 'PUBLICO');

-- CreateEnum
CREATE TYPE "EnteSeguridadSocialRdep" AS ENUM ('IESS', 'ISSFA_ISSPOL');

-- CreateEnum
CREATE TYPE "EstadoFormularioRdep" AS ENUM ('BORRADOR', 'VALIDADO', 'GENERADO');

-- CreateEnum
CREATE TYPE "AccionHistorialRdep" AS ENUM ('CREACION', 'ACTUALIZACION', 'VALIDACION_EXITOSA', 'VALIDACION_CON_ERRORES', 'GENERACION_PDF', 'GENERACION_ANEXO_EXCEL', 'CAMBIO_ESTADO', 'ELIMINACION');

-- CreateTable
CREATE TABLE "formularios_rdep" (
    "id" SERIAL NOT NULL,
    "periodo_fiscal" INTEGER NOT NULL,
    "estado" "EstadoFormularioRdep" NOT NULL DEFAULT 'BORRADOR',
    "tipo_empleador" "TipoEmpleadorRdep" NOT NULL,
    "ente_seguridad_social" "EnteSeguridadSocialRdep" NOT NULL,
    "tipo_identificacion_trabajador" "TipoIdentificacionTrabajadorRdep" NOT NULL,
    "numero_identificacion_trabajador" VARCHAR(13) NOT NULL,
    "apellidos_trabajador" VARCHAR(100) NOT NULL,
    "nombres_trabajador" VARCHAR(100) NOT NULL,
    "codigo_establecimiento" VARCHAR(3) NOT NULL DEFAULT '001',
    "residencia_trabajador" "ResidenciaTrabajadorRdep" NOT NULL DEFAULT 'LOCAL',
    "pais_residencia_trabajador" VARCHAR(3) NOT NULL DEFAULT '593',
    "aplica_convenio_doble_imposicion" "AplicaConvenioDobleImposicionRdep" NOT NULL DEFAULT 'NO_APLICA',
    "condicion_discapacidad" "CondicionDiscapacidadRdep" NOT NULL DEFAULT 'NO_APLICA',
    "porcentaje_discapacidad" INTEGER,
    "beneficio_galapagos" BOOLEAN NOT NULL DEFAULT false,
    "enfermedad_catastrofica" BOOLEAN NOT NULL DEFAULT false,
    "cargas_familiares" INTEGER NOT NULL DEFAULT 0,
    "sueldos_salarios_ingresos_gravados" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otros_ingresos_gravados" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "participacion_utilidades" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ingresos_otros_empleadores" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "decimo_tercer_sueldo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "decimo_cuarto_sueldo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fondo_reserva" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otros_ingresos_no_gravados" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "impuesto_renta_asumido_empleador" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sistema_salario_neto" "SistemaSalarioNetoRdep" NOT NULL DEFAULT 'SIN_SISTEMA',
    "aporte_personal_este_empleador" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "aporte_personal_otros_empleadores" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gasto_vivienda" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gasto_salud" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gasto_educacion" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gasto_alimentacion" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gasto_vestimenta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gasto_turismo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "exoneracion_discapacidad" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "exoneracion_tercera_edad" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "impuesto_retenido_asumido_otros_empleadores" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "impuesto_asumido_este_empleador" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "canasta_basica_mensual" DECIMAL(10,2) NOT NULL,
    "base_imponible_gravada" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "impuesto_renta_causado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "rebaja_gastos_personales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "impuesto_renta_causado_despues_rebaja" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "impuesto_retenido_trabajador_este_empleador" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "validado_en" TIMESTAMP(3),
    "generado_en" TIMESTAMP(3),
    "usuario_generador_id" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "perfil_tributario_id" INTEGER NOT NULL,

    CONSTRAINT "formularios_rdep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_formularios_rdep" (
    "id" SERIAL NOT NULL,
    "accion" "AccionHistorialRdep" NOT NULL,
    "detalle" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "formulario_rdep_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,

    CONSTRAINT "historial_formularios_rdep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "formularios_rdep_usuario_id_estado_periodo_fiscal_idx" ON "formularios_rdep"("usuario_id", "estado", "periodo_fiscal");

-- CreateIndex
CREATE UNIQUE INDEX "formularios_rdep_usuario_id_periodo_fiscal_key" ON "formularios_rdep"("usuario_id", "periodo_fiscal");

-- CreateIndex
CREATE INDEX "historial_formularios_rdep_formulario_rdep_id_creado_en_idx" ON "historial_formularios_rdep"("formulario_rdep_id", "creado_en");

-- AddForeignKey
ALTER TABLE "formularios_rdep" ADD CONSTRAINT "formularios_rdep_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formularios_rdep" ADD CONSTRAINT "formularios_rdep_perfil_tributario_id_fkey" FOREIGN KEY ("perfil_tributario_id") REFERENCES "perfiles_tributarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_formularios_rdep" ADD CONSTRAINT "historial_formularios_rdep_formulario_rdep_id_fkey" FOREIGN KEY ("formulario_rdep_id") REFERENCES "formularios_rdep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_formularios_rdep" ADD CONSTRAINT "historial_formularios_rdep_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('ALERTA_PRESUPUESTO', 'META_AHORRO', 'RECORDATORIO_PAGO', 'RECORDATORIO_MOVIMIENTO', 'RECOMENDACION_IA', 'SISTEMA');

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" SERIAL NOT NULL,
    "titulo" VARCHAR(120) NOT NULL,
    "mensaje" VARCHAR(500) NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "referencia" VARCHAR(150),
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "leida_en" TIMESTAMP(3),
    "eliminado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_id" INTEGER NOT NULL,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notificaciones_usuario_id_eliminado_en_creado_en_idx" ON "notificaciones"("usuario_id", "eliminado_en", "creado_en");

-- CreateIndex
CREATE INDEX "notificaciones_usuario_id_leida_eliminado_en_idx" ON "notificaciones"("usuario_id", "leida", "eliminado_en");

-- CreateIndex
CREATE UNIQUE INDEX "notificaciones_usuario_id_referencia_key" ON "notificaciones"("usuario_id", "referencia");

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

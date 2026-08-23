-- CreateEnum
CREATE TYPE "RolMensajeAsistente" AS ENUM ('USUARIO', 'ASISTENTE');

-- CreateEnum
CREATE TYPE "OrigenRespuestaAsistente" AS ENUM ('GEMINI', 'MOTOR_REGLAS');

-- CreateTable
CREATE TABLE "conversaciones_asistente" (
    "id" SERIAL NOT NULL,
    "titulo" VARCHAR(120) NOT NULL,
    "eliminado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "usuario_id" INTEGER NOT NULL,

    CONSTRAINT "conversaciones_asistente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensajes_asistente" (
    "id" SERIAL NOT NULL,
    "rol" "RolMensajeAsistente" NOT NULL,
    "contenido" TEXT NOT NULL,
    "origen_respuesta" "OrigenRespuestaAsistente",
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversacion_id" INTEGER NOT NULL,

    CONSTRAINT "mensajes_asistente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversaciones_asistente_usuario_id_eliminado_en_actualizad_idx" ON "conversaciones_asistente"("usuario_id", "eliminado_en", "actualizado_en");

-- CreateIndex
CREATE INDEX "mensajes_asistente_conversacion_id_creado_en_idx" ON "mensajes_asistente"("conversacion_id", "creado_en");

-- AddForeignKey
ALTER TABLE "conversaciones_asistente" ADD CONSTRAINT "conversaciones_asistente_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensajes_asistente" ADD CONSTRAINT "mensajes_asistente_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "conversaciones_asistente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

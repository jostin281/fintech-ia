-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "demo_expira_en" TIMESTAMP(3),
ADD COLUMN     "es_demo" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "credenciales_sri" (
    "id" SERIAL NOT NULL,
    "usuario_sri" VARCHAR(50) NOT NULL,
    "ci_adicional_sri" VARCHAR(50),
    "clave_cifrada" BYTEA NOT NULL,
    "vector_inicializacion" BYTEA NOT NULL,
    "etiqueta_autenticacion" BYTEA NOT NULL,
    "auto_descarga_habilitada" BOOLEAN NOT NULL DEFAULT false,
    "ultima_ejecucion_en" TIMESTAMP(3),
    "ultimo_resultado" VARCHAR(20),
    "ultimo_mensaje" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "usuario_id" INTEGER NOT NULL,

    CONSTRAINT "credenciales_sri_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credenciales_sri_usuario_id_key" ON "credenciales_sri"("usuario_id");

-- AddForeignKey
ALTER TABLE "credenciales_sri" ADD CONSTRAINT "credenciales_sri_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

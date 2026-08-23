-- CreateTable
CREATE TABLE "metas_ahorro" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "monto_objetivo" DECIMAL(12,2) NOT NULL,
    "fecha_objetivo" DATE NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "usuario_id" INTEGER NOT NULL,

    CONSTRAINT "metas_ahorro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aportes_meta" (
    "id" SERIAL NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eliminado_en" TIMESTAMP(3),
    "meta_ahorro_id" INTEGER NOT NULL,

    CONSTRAINT "aportes_meta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "metas_ahorro_usuario_id_activo_fecha_objetivo_idx" ON "metas_ahorro"("usuario_id", "activo", "fecha_objetivo");

-- CreateIndex
CREATE INDEX "aportes_meta_meta_ahorro_id_eliminado_en_creado_en_idx" ON "aportes_meta"("meta_ahorro_id", "eliminado_en", "creado_en");

-- AddForeignKey
ALTER TABLE "metas_ahorro" ADD CONSTRAINT "metas_ahorro_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aportes_meta" ADD CONSTRAINT "aportes_meta_meta_ahorro_id_fkey" FOREIGN KEY ("meta_ahorro_id") REFERENCES "metas_ahorro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

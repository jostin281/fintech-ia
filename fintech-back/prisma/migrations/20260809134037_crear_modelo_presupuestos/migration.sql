-- CreateTable
CREATE TABLE "presupuestos" (
    "id" SERIAL NOT NULL,
    "monto_limite" DECIMAL(12,2) NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "porcentaje_alerta" INTEGER NOT NULL DEFAULT 80,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "categoria_id" INTEGER NOT NULL,

    CONSTRAINT "presupuestos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "presupuestos_usuario_id_anio_mes_activo_idx" ON "presupuestos"("usuario_id", "anio", "mes", "activo");

-- CreateIndex
CREATE INDEX "presupuestos_categoria_id_idx" ON "presupuestos"("categoria_id");

-- CreateIndex
CREATE UNIQUE INDEX "presupuestos_usuario_id_categoria_id_anio_mes_key" ON "presupuestos"("usuario_id", "categoria_id", "anio", "mes");

-- AddForeignKey
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

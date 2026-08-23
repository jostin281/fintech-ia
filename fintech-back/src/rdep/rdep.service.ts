import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import {
  esCedulaEcuadorValida,
  esRucEcuadorValido,
} from '../facturacion/utilidades/identificacion-ecuador';
import {
  ActualizarFormularioRdepDto,
  CrearFormularioRdepDto,
} from './dto/crear-formulario-rdep.dto';
import {
  RdepValidacionService,
  type FormularioRdepCompleto,
} from './rdep-validacion.service';
import { mapearFormularioRdepCompleto } from './utilidades/rdep-mapeo';
import {
  calcularResumenImpositivoRdep,
  verificarTablaImpuestoRentaDisponible,
} from './utilidades/rdep-calculo';

const CAMPOS_CON_VALOR_POR_DEFECTO = {
  codigoEstablecimiento: '001',
  residenciaTrabajador: 'LOCAL' as const,
  paisResidenciaTrabajador: '593',
  aplicaConvenioDobleImposicion: 'NO_APLICA' as const,
  condicionDiscapacidad: 'NO_APLICA' as const,
  beneficioGalapagos: false,
  enfermedadCatastrofica: false,
  cargasFamiliares: 0,
  sistemaSalarioNeto: 'SIN_SISTEMA' as const,
  sueldosSalariosIngresosGravados: 0,
  otrosIngresosGravados: 0,
  participacionUtilidades: 0,
  ingresosOtrosEmpleadores: 0,
  decimoTercerSueldo: 0,
  decimoCuartoSueldo: 0,
  fondoReserva: 0,
  otrosIngresosNoGravados: 0,
  impuestoRentaAsumidoEmpleador: 0,
  aportePersonalEsteEmpleador: 0,
  aportePersonalOtrosEmpleadores: 0,
  gastoVivienda: 0,
  gastoSalud: 0,
  gastoEducacion: 0,
  gastoAlimentacion: 0,
  gastoVestimenta: 0,
  gastoTurismo: 0,
  exoneracionDiscapacidad: 0,
  exoneracionTerceraEdad: 0,
  impuestoRetenidoAsumidoOtrosEmpleadores: 0,
  impuestoAsumidoEsteEmpleador: 0,
};

@Injectable()
export class RdepService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly rdepValidacionService: RdepValidacionService,
  ) {}

  async crear(usuarioId: number, dto: CrearFormularioRdepDto) {
    const perfil = await this.obtenerPerfilActivo(usuarioId);
    this.validarIdentificacionBasica(dto);
    verificarTablaImpuestoRentaDisponible(dto.periodoFiscal);

    const existente = await this.prismaService.formularioRdep.findUnique({
      where: {
        usuarioId_periodoFiscal: { usuarioId, periodoFiscal: dto.periodoFiscal },
      },
      select: { id: true },
    });

    if (existente) {
      throw new ConflictException(
        `Ya existe un Formulario 107 / RDEP para el período ${dto.periodoFiscal}. Usa PATCH /rdep/${existente.id} para editarlo.`,
      );
    }

    const datos = this.datosParaCalculo(dto);
    const calculo = calcularResumenImpositivoRdep(datos);

    const formulario = await this.prismaService.formularioRdep.create({
      data: {
        ...this.datosParaGuardar(dto),
        usuarioId,
        perfilTributarioId: perfil.id,
        baseImponibleGravada: calculo.baseImponibleGravada,
        impuestoRentaCausado: calculo.impuestoRentaCausado,
        rebajaGastosPersonales: calculo.rebajaGastosPersonales,
        impuestoRentaCausadoDespuesRebaja:
          calculo.impuestoRentaCausadoDespuesRebaja,
        impuestoRetenidoTrabajadorEsteEmpleador:
          calculo.impuestoRetenidoTrabajadorEsteEmpleador,
      },
    });

    await this.registrarHistorial(
      formulario.id,
      usuarioId,
      'CREACION',
      `Formulario creado para el período fiscal ${dto.periodoFiscal}.`,
    );

    return { mensaje: 'Formulario 107 / RDEP creado como borrador', formulario };
  }

  /**
   * Plantilla para prellenar un Formulario 107 / RDEP nuevo con los datos
   * del período fiscal más reciente que el usuario ya registró (identidad
   * del trabajador, tipo de empleador, sueldos, gastos personales, etc.):
   * ese tipo de dato normalmente se repite de un año a otro, así que el
   * usuario solo tiene que corregir lo que cambió en vez de escribir todo
   * de nuevo. No incluye periodoFiscal: ese lo define el propio usuario al
   * crear el nuevo período.
   */
  async obtenerPlantillaUltimoPeriodo(usuarioId: number) {
    const ultimo = await this.prismaService.formularioRdep.findFirst({
      where: { usuarioId },
      orderBy: { periodoFiscal: 'desc' },
    });

    if (!ultimo) {
      return { encontrado: false as const };
    }

    return {
      encontrado: true as const,
      periodoFiscalOrigen: ultimo.periodoFiscal,
      plantilla: {
        tipoEmpleador: ultimo.tipoEmpleador,
        enteSeguridadSocial: ultimo.enteSeguridadSocial,
        tipoIdentificacionTrabajador: ultimo.tipoIdentificacionTrabajador,
        numeroIdentificacionTrabajador: ultimo.numeroIdentificacionTrabajador,
        apellidosTrabajador: ultimo.apellidosTrabajador,
        nombresTrabajador: ultimo.nombresTrabajador,
        codigoEstablecimiento: ultimo.codigoEstablecimiento,
        residenciaTrabajador: ultimo.residenciaTrabajador,
        paisResidenciaTrabajador: ultimo.paisResidenciaTrabajador,
        aplicaConvenioDobleImposicion: ultimo.aplicaConvenioDobleImposicion,
        condicionDiscapacidad: ultimo.condicionDiscapacidad,
        porcentajeDiscapacidad: ultimo.porcentajeDiscapacidad,
        beneficioGalapagos: ultimo.beneficioGalapagos,
        enfermedadCatastrofica: ultimo.enfermedadCatastrofica,
        cargasFamiliares: ultimo.cargasFamiliares,
        sueldosSalariosIngresosGravados: Number(ultimo.sueldosSalariosIngresosGravados),
        otrosIngresosGravados: Number(ultimo.otrosIngresosGravados),
        participacionUtilidades: Number(ultimo.participacionUtilidades),
        ingresosOtrosEmpleadores: Number(ultimo.ingresosOtrosEmpleadores),
        decimoTercerSueldo: Number(ultimo.decimoTercerSueldo),
        decimoCuartoSueldo: Number(ultimo.decimoCuartoSueldo),
        fondoReserva: Number(ultimo.fondoReserva),
        otrosIngresosNoGravados: Number(ultimo.otrosIngresosNoGravados),
        impuestoRentaAsumidoEmpleador: Number(ultimo.impuestoRentaAsumidoEmpleador),
        sistemaSalarioNeto: ultimo.sistemaSalarioNeto,
        aportePersonalEsteEmpleador: Number(ultimo.aportePersonalEsteEmpleador),
        aportePersonalOtrosEmpleadores: Number(ultimo.aportePersonalOtrosEmpleadores),
        gastoVivienda: Number(ultimo.gastoVivienda),
        gastoSalud: Number(ultimo.gastoSalud),
        gastoEducacion: Number(ultimo.gastoEducacion),
        gastoAlimentacion: Number(ultimo.gastoAlimentacion),
        gastoVestimenta: Number(ultimo.gastoVestimenta),
        gastoTurismo: Number(ultimo.gastoTurismo),
        exoneracionDiscapacidad: Number(ultimo.exoneracionDiscapacidad),
        exoneracionTerceraEdad: Number(ultimo.exoneracionTerceraEdad),
        impuestoRetenidoAsumidoOtrosEmpleadores: Number(
          ultimo.impuestoRetenidoAsumidoOtrosEmpleadores,
        ),
        impuestoAsumidoEsteEmpleador: Number(ultimo.impuestoAsumidoEsteEmpleador),
        canastaBasicaMensual: Number(ultimo.canastaBasicaMensual),
      },
    };
  }

  async listar(usuarioId: number, periodoFiscal?: number) {
    const formularios = await this.prismaService.formularioRdep.findMany({
      where: { usuarioId, ...(periodoFiscal ? { periodoFiscal } : {}) },
      orderBy: { periodoFiscal: 'desc' },
    });

    return { total: formularios.length, formularios };
  }

  async obtener(usuarioId: number, id: number) {
    return this.obtenerPropio(usuarioId, id);
  }

  async actualizar(usuarioId: number, id: number, dto: ActualizarFormularioRdepDto) {
    const actual = await this.obtenerPropio(usuarioId, id);

    if (actual.estado === 'GENERADO') {
      throw new ConflictException(
        'Este formulario ya fue generado y queda de solo lectura. Si necesitas corregirlo, crea un nuevo período o contacta a un administrador.',
      );
    }

    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Debe enviar al menos un dato para actualizar');
    }

    const periodoFiscal = dto.periodoFiscal ?? actual.periodoFiscal;

    if (periodoFiscal !== actual.periodoFiscal) {
      const existente = await this.prismaService.formularioRdep.findUnique({
        where: { usuarioId_periodoFiscal: { usuarioId, periodoFiscal } },
        select: { id: true },
      });
      if (existente) {
        throw new ConflictException(
          `Ya existe un Formulario 107 / RDEP para el período ${periodoFiscal}.`,
        );
      }
    }

    verificarTablaImpuestoRentaDisponible(periodoFiscal);

    const fusionado = this.fusionarConExistente(actual, dto);
    const datos = this.datosParaCalculo(fusionado);
    const calculo = calcularResumenImpositivoRdep(datos);

    const formulario = await this.prismaService.formularioRdep.update({
      where: { id },
      data: {
        ...this.datosParaGuardar(fusionado),
        baseImponibleGravada: calculo.baseImponibleGravada,
        impuestoRentaCausado: calculo.impuestoRentaCausado,
        rebajaGastosPersonales: calculo.rebajaGastosPersonales,
        impuestoRentaCausadoDespuesRebaja:
          calculo.impuestoRentaCausadoDespuesRebaja,
        impuestoRetenidoTrabajadorEsteEmpleador:
          calculo.impuestoRetenidoTrabajadorEsteEmpleador,
        // Cualquier edición obliga a validar de nuevo antes de poder generar.
        estado: 'BORRADOR',
        validadoEn: null,
      },
    });

    await this.registrarHistorial(
      id,
      usuarioId,
      'ACTUALIZACION',
      `Campos actualizados: ${Object.keys(dto).join(', ')}.`,
    );

    return { mensaje: 'Formulario actualizado', formulario };
  }

  async eliminar(usuarioId: number, id: number) {
    const actual = await this.obtenerPropio(usuarioId, id);

    if (actual.estado !== 'BORRADOR') {
      throw new ConflictException(
        'Solo se puede eliminar un formulario en estado BORRADOR. Un formulario validado o generado se conserva por trazabilidad.',
      );
    }

    await this.prismaService.formularioRdep.delete({ where: { id } });

    return { mensaje: 'Borrador eliminado correctamente' };
  }

  async validar(usuarioId: number, id: number) {
    const formulario = await this.obtenerPropio(usuarioId, id);
    const perfil = await this.obtenerPerfilActivo(usuarioId);
    const errores = this.rdepValidacionService.validar(
      mapearFormularioRdepCompleto(formulario),
    );

    if (!esRucEcuadorValido(perfil.ruc)) {
      errores.push({
        campo: 'ruc',
        valorIngresado: perfil.ruc,
        motivo: 'El RUC del perfil tributario (empleador) no es válido.',
        comoCorregirlo:
          'Corrige el RUC en Facturación Electrónica → Perfil Tributario antes de generar el anexo.',
      });
    }

    const valido = errores.length === 0;

    await this.prismaService.formularioRdep.update({
      where: { id },
      data: valido
        ? { estado: 'VALIDADO', validadoEn: new Date() }
        : { estado: 'BORRADOR', validadoEn: null },
    });

    await this.registrarHistorial(
      id,
      usuarioId,
      valido ? 'VALIDACION_EXITOSA' : 'VALIDACION_CON_ERRORES',
      valido
        ? 'El formulario pasó todas las validaciones.'
        : `Se encontraron ${errores.length} error(es): ${JSON.stringify(errores)}`,
    );

    return { valido, totalErrores: errores.length, errores };
  }

  async generar(usuarioId: number, id: number) {
    const formulario = await this.obtenerPropio(usuarioId, id);

    if (formulario.estado !== 'VALIDADO') {
      throw new ConflictException(
        'Debes validar el formulario (POST /rdep/:id/validar) sin errores antes de poder generarlo.',
      );
    }

    // Segunda comprobación defensiva: revalida justo antes de generar, por
    // si algo cambió entre la validación y este momento.
    const resultadoValidacion = await this.validar(usuarioId, id);
    if (!resultadoValidacion.valido) {
      throw new ConflictException({
        mensaje:
          'El formulario dejó de cumplir las validaciones; revisa los errores antes de generar.',
        errores: resultadoValidacion.errores,
      });
    }

    const actualizado = await this.prismaService.formularioRdep.update({
      where: { id },
      data: {
        estado: 'GENERADO',
        generadoEn: new Date(),
        usuarioGeneradorId: usuarioId,
      },
    });

    await this.registrarHistorial(
      id,
      usuarioId,
      'CAMBIO_ESTADO',
      'Formulario marcado como GENERADO. Ya se pueden descargar el PDF final y el anexo Excel oficial.',
    );

    return {
      mensaje:
        'Formulario generado correctamente. Descarga el PDF (GET /rdep/:id/pdf) y el anexo Excel oficial (GET /rdep/:id/anexo-excel).',
      formulario: actualizado,
    };
  }

  async obtenerHistorial(usuarioId: number, id: number) {
    await this.obtenerPropio(usuarioId, id);
    const historial = await this.prismaService.historialFormularioRdep.findMany({
      where: { formularioRdepId: id },
      orderBy: { creadoEn: 'desc' },
    });
    return { total: historial.length, historial };
  }

  /** Usado por los controladores de PDF/Excel: formulario + datos del empleador. */
  async obtenerParaExportar(usuarioId: number, id: number) {
    const formulario = await this.obtenerPropio(usuarioId, id);
    const perfil = await this.obtenerPerfilActivo(usuarioId);

    await this.registrarHistorial(
      id,
      usuarioId,
      'GENERACION_PDF',
      `Vista previa/PDF solicitado (estado del formulario en ese momento: ${formulario.estado}).`,
    );

    return { formulario, perfil };
  }

  async obtenerParaAnexoExcel(usuarioId: number, id: number) {
    const formulario = await this.obtenerPropio(usuarioId, id);

    if (formulario.estado !== 'GENERADO') {
      throw new ConflictException(
        'El anexo Excel oficial solo se puede descargar después de generar el formulario (POST /rdep/:id/generar).',
      );
    }

    const perfil = await this.obtenerPerfilActivo(usuarioId);

    await this.registrarHistorial(
      id,
      usuarioId,
      'GENERACION_ANEXO_EXCEL',
      'Anexo RDEP oficial (.xlsx) descargado.',
    );

    return { formulario, perfil };
  }

  // ────────────────────────── privados ──────────────────────────

  private async obtenerPerfilActivo(usuarioId: number) {
    const perfil = await this.prismaService.perfilTributario.findFirst({
      where: { usuarioId, activo: true },
    });

    if (!perfil) {
      throw new NotFoundException(
        'Primero debes crear tu perfil tributario (Facturación Electrónica → Perfil Tributario): el RDEP necesita tu RUC y razón social como empleador.',
      );
    }

    return perfil;
  }

  private async obtenerPropio(usuarioId: number, id: number) {
    const formulario = await this.prismaService.formularioRdep.findUnique({
      where: { id },
    });

    if (!formulario) {
      throw new NotFoundException('El formulario RDEP no existe');
    }

    if (formulario.usuarioId !== usuarioId) {
      throw new ForbiddenException('Este formulario no te pertenece');
    }

    return formulario;
  }

  private validarIdentificacionBasica(dto: CrearFormularioRdepDto): void {
    if (
      dto.tipoIdentificacionTrabajador === 'CEDULA' &&
      !esCedulaEcuadorValida(dto.numeroIdentificacionTrabajador)
    ) {
      throw new BadRequestException(
        'El número de identificación no es una cédula ecuatoriana válida',
      );
    }
  }

  private async registrarHistorial(
    formularioRdepId: number,
    usuarioId: number,
    accion:
      | 'CREACION'
      | 'ACTUALIZACION'
      | 'VALIDACION_EXITOSA'
      | 'VALIDACION_CON_ERRORES'
      | 'GENERACION_PDF'
      | 'GENERACION_ANEXO_EXCEL'
      | 'CAMBIO_ESTADO'
      | 'ELIMINACION',
    detalle: string,
  ): Promise<void> {
    await this.prismaService.historialFormularioRdep.create({
      data: { formularioRdepId, usuarioId, accion, detalle },
    });
  }

  /** Aplica los valores por defecto de la Ficha Técnica RDEP a un DTO de creación. */
  private datosParaGuardar(dto: CrearFormularioRdepDto) {
    return {
      periodoFiscal: dto.periodoFiscal,
      tipoEmpleador: dto.tipoEmpleador,
      enteSeguridadSocial: dto.enteSeguridadSocial,
      tipoIdentificacionTrabajador: dto.tipoIdentificacionTrabajador,
      numeroIdentificacionTrabajador: dto.numeroIdentificacionTrabajador,
      apellidosTrabajador: dto.apellidosTrabajador,
      nombresTrabajador: dto.nombresTrabajador,
      codigoEstablecimiento:
        dto.codigoEstablecimiento ?? CAMPOS_CON_VALOR_POR_DEFECTO.codigoEstablecimiento,
      residenciaTrabajador:
        dto.residenciaTrabajador ?? CAMPOS_CON_VALOR_POR_DEFECTO.residenciaTrabajador,
      paisResidenciaTrabajador:
        dto.paisResidenciaTrabajador ??
        CAMPOS_CON_VALOR_POR_DEFECTO.paisResidenciaTrabajador,
      aplicaConvenioDobleImposicion:
        dto.aplicaConvenioDobleImposicion ??
        CAMPOS_CON_VALOR_POR_DEFECTO.aplicaConvenioDobleImposicion,
      condicionDiscapacidad:
        dto.condicionDiscapacidad ?? CAMPOS_CON_VALOR_POR_DEFECTO.condicionDiscapacidad,
      porcentajeDiscapacidad: dto.porcentajeDiscapacidad ?? null,
      beneficioGalapagos:
        dto.beneficioGalapagos ?? CAMPOS_CON_VALOR_POR_DEFECTO.beneficioGalapagos,
      enfermedadCatastrofica:
        dto.enfermedadCatastrofica ?? CAMPOS_CON_VALOR_POR_DEFECTO.enfermedadCatastrofica,
      cargasFamiliares:
        dto.cargasFamiliares ?? CAMPOS_CON_VALOR_POR_DEFECTO.cargasFamiliares,
      sueldosSalariosIngresosGravados:
        dto.sueldosSalariosIngresosGravados ??
        CAMPOS_CON_VALOR_POR_DEFECTO.sueldosSalariosIngresosGravados,
      otrosIngresosGravados:
        dto.otrosIngresosGravados ?? CAMPOS_CON_VALOR_POR_DEFECTO.otrosIngresosGravados,
      participacionUtilidades:
        dto.participacionUtilidades ?? CAMPOS_CON_VALOR_POR_DEFECTO.participacionUtilidades,
      ingresosOtrosEmpleadores:
        dto.ingresosOtrosEmpleadores ??
        CAMPOS_CON_VALOR_POR_DEFECTO.ingresosOtrosEmpleadores,
      decimoTercerSueldo:
        dto.decimoTercerSueldo ?? CAMPOS_CON_VALOR_POR_DEFECTO.decimoTercerSueldo,
      decimoCuartoSueldo:
        dto.decimoCuartoSueldo ?? CAMPOS_CON_VALOR_POR_DEFECTO.decimoCuartoSueldo,
      fondoReserva: dto.fondoReserva ?? CAMPOS_CON_VALOR_POR_DEFECTO.fondoReserva,
      otrosIngresosNoGravados:
        dto.otrosIngresosNoGravados ??
        CAMPOS_CON_VALOR_POR_DEFECTO.otrosIngresosNoGravados,
      impuestoRentaAsumidoEmpleador:
        dto.impuestoRentaAsumidoEmpleador ??
        CAMPOS_CON_VALOR_POR_DEFECTO.impuestoRentaAsumidoEmpleador,
      sistemaSalarioNeto:
        dto.sistemaSalarioNeto ?? CAMPOS_CON_VALOR_POR_DEFECTO.sistemaSalarioNeto,
      aportePersonalEsteEmpleador:
        dto.aportePersonalEsteEmpleador ??
        CAMPOS_CON_VALOR_POR_DEFECTO.aportePersonalEsteEmpleador,
      aportePersonalOtrosEmpleadores:
        dto.aportePersonalOtrosEmpleadores ??
        CAMPOS_CON_VALOR_POR_DEFECTO.aportePersonalOtrosEmpleadores,
      gastoVivienda: dto.gastoVivienda ?? CAMPOS_CON_VALOR_POR_DEFECTO.gastoVivienda,
      gastoSalud: dto.gastoSalud ?? CAMPOS_CON_VALOR_POR_DEFECTO.gastoSalud,
      gastoEducacion: dto.gastoEducacion ?? CAMPOS_CON_VALOR_POR_DEFECTO.gastoEducacion,
      gastoAlimentacion:
        dto.gastoAlimentacion ?? CAMPOS_CON_VALOR_POR_DEFECTO.gastoAlimentacion,
      gastoVestimenta:
        dto.gastoVestimenta ?? CAMPOS_CON_VALOR_POR_DEFECTO.gastoVestimenta,
      gastoTurismo: dto.gastoTurismo ?? CAMPOS_CON_VALOR_POR_DEFECTO.gastoTurismo,
      exoneracionDiscapacidad:
        dto.exoneracionDiscapacidad ??
        CAMPOS_CON_VALOR_POR_DEFECTO.exoneracionDiscapacidad,
      exoneracionTerceraEdad:
        dto.exoneracionTerceraEdad ??
        CAMPOS_CON_VALOR_POR_DEFECTO.exoneracionTerceraEdad,
      impuestoRetenidoAsumidoOtrosEmpleadores:
        dto.impuestoRetenidoAsumidoOtrosEmpleadores ??
        CAMPOS_CON_VALOR_POR_DEFECTO.impuestoRetenidoAsumidoOtrosEmpleadores,
      impuestoAsumidoEsteEmpleador:
        dto.impuestoAsumidoEsteEmpleador ??
        CAMPOS_CON_VALOR_POR_DEFECTO.impuestoAsumidoEsteEmpleador,
      canastaBasicaMensual: dto.canastaBasicaMensual,
    };
  }

  private datosParaCalculo(dto: CrearFormularioRdepDto) {
    const guardado = this.datosParaGuardar(dto);
    return {
      periodoFiscal: guardado.periodoFiscal,
      sueldosSalariosIngresosGravados: guardado.sueldosSalariosIngresosGravados,
      otrosIngresosGravados: guardado.otrosIngresosGravados,
      participacionUtilidades: guardado.participacionUtilidades,
      ingresosOtrosEmpleadores: guardado.ingresosOtrosEmpleadores,
      impuestoRentaAsumidoEmpleador: guardado.impuestoRentaAsumidoEmpleador,
      aportePersonalEsteEmpleador: guardado.aportePersonalEsteEmpleador,
      aportePersonalOtrosEmpleadores: guardado.aportePersonalOtrosEmpleadores,
      gastoVivienda: guardado.gastoVivienda,
      gastoSalud: guardado.gastoSalud,
      gastoEducacion: guardado.gastoEducacion,
      gastoAlimentacion: guardado.gastoAlimentacion,
      gastoVestimenta: guardado.gastoVestimenta,
      gastoTurismo: guardado.gastoTurismo,
      exoneracionDiscapacidad: guardado.exoneracionDiscapacidad,
      exoneracionTerceraEdad: guardado.exoneracionTerceraEdad,
      impuestoRetenidoAsumidoOtrosEmpleadores:
        guardado.impuestoRetenidoAsumidoOtrosEmpleadores,
      impuestoAsumidoEsteEmpleador: guardado.impuestoAsumidoEsteEmpleador,
      canastaBasicaMensual: guardado.canastaBasicaMensual,
      cargasFamiliares: guardado.cargasFamiliares,
      enfermedadCatastrofica: guardado.enfermedadCatastrofica,
    };
  }

  /** Combina un formulario ya guardado con los campos que llegan en el PATCH. */
  private fusionarConExistente(
    actual: Awaited<ReturnType<RdepService['obtenerPropio']>>,
    dto: ActualizarFormularioRdepDto,
  ): CrearFormularioRdepDto {
    return {
      periodoFiscal: dto.periodoFiscal ?? actual.periodoFiscal,
      tipoEmpleador: dto.tipoEmpleador ?? actual.tipoEmpleador,
      enteSeguridadSocial: dto.enteSeguridadSocial ?? actual.enteSeguridadSocial,
      tipoIdentificacionTrabajador:
        dto.tipoIdentificacionTrabajador ?? actual.tipoIdentificacionTrabajador,
      numeroIdentificacionTrabajador:
        dto.numeroIdentificacionTrabajador ?? actual.numeroIdentificacionTrabajador,
      apellidosTrabajador: dto.apellidosTrabajador ?? actual.apellidosTrabajador,
      nombresTrabajador: dto.nombresTrabajador ?? actual.nombresTrabajador,
      codigoEstablecimiento: dto.codigoEstablecimiento ?? actual.codigoEstablecimiento,
      residenciaTrabajador: dto.residenciaTrabajador ?? actual.residenciaTrabajador,
      paisResidenciaTrabajador:
        dto.paisResidenciaTrabajador ?? actual.paisResidenciaTrabajador,
      aplicaConvenioDobleImposicion:
        dto.aplicaConvenioDobleImposicion ?? actual.aplicaConvenioDobleImposicion,
      condicionDiscapacidad: dto.condicionDiscapacidad ?? actual.condicionDiscapacidad,
      porcentajeDiscapacidad:
        dto.porcentajeDiscapacidad ?? actual.porcentajeDiscapacidad ?? undefined,
      beneficioGalapagos: dto.beneficioGalapagos ?? actual.beneficioGalapagos,
      enfermedadCatastrofica:
        dto.enfermedadCatastrofica ?? actual.enfermedadCatastrofica,
      cargasFamiliares: dto.cargasFamiliares ?? actual.cargasFamiliares,
      sueldosSalariosIngresosGravados:
        dto.sueldosSalariosIngresosGravados ??
        Number(actual.sueldosSalariosIngresosGravados),
      otrosIngresosGravados:
        dto.otrosIngresosGravados ?? Number(actual.otrosIngresosGravados),
      participacionUtilidades:
        dto.participacionUtilidades ?? Number(actual.participacionUtilidades),
      ingresosOtrosEmpleadores:
        dto.ingresosOtrosEmpleadores ?? Number(actual.ingresosOtrosEmpleadores),
      decimoTercerSueldo: dto.decimoTercerSueldo ?? Number(actual.decimoTercerSueldo),
      decimoCuartoSueldo: dto.decimoCuartoSueldo ?? Number(actual.decimoCuartoSueldo),
      fondoReserva: dto.fondoReserva ?? Number(actual.fondoReserva),
      otrosIngresosNoGravados:
        dto.otrosIngresosNoGravados ?? Number(actual.otrosIngresosNoGravados),
      impuestoRentaAsumidoEmpleador:
        dto.impuestoRentaAsumidoEmpleador ??
        Number(actual.impuestoRentaAsumidoEmpleador),
      sistemaSalarioNeto: dto.sistemaSalarioNeto ?? actual.sistemaSalarioNeto,
      aportePersonalEsteEmpleador:
        dto.aportePersonalEsteEmpleador ?? Number(actual.aportePersonalEsteEmpleador),
      aportePersonalOtrosEmpleadores:
        dto.aportePersonalOtrosEmpleadores ??
        Number(actual.aportePersonalOtrosEmpleadores),
      gastoVivienda: dto.gastoVivienda ?? Number(actual.gastoVivienda),
      gastoSalud: dto.gastoSalud ?? Number(actual.gastoSalud),
      gastoEducacion: dto.gastoEducacion ?? Number(actual.gastoEducacion),
      gastoAlimentacion: dto.gastoAlimentacion ?? Number(actual.gastoAlimentacion),
      gastoVestimenta: dto.gastoVestimenta ?? Number(actual.gastoVestimenta),
      gastoTurismo: dto.gastoTurismo ?? Number(actual.gastoTurismo),
      exoneracionDiscapacidad:
        dto.exoneracionDiscapacidad ?? Number(actual.exoneracionDiscapacidad),
      exoneracionTerceraEdad:
        dto.exoneracionTerceraEdad ?? Number(actual.exoneracionTerceraEdad),
      impuestoRetenidoAsumidoOtrosEmpleadores:
        dto.impuestoRetenidoAsumidoOtrosEmpleadores ??
        Number(actual.impuestoRetenidoAsumidoOtrosEmpleadores),
      impuestoAsumidoEsteEmpleador:
        dto.impuestoAsumidoEsteEmpleador ?? Number(actual.impuestoAsumidoEsteEmpleador),
      canastaBasicaMensual:
        dto.canastaBasicaMensual ?? Number(actual.canastaBasicaMensual),
    };
  }

}

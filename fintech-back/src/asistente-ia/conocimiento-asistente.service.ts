import { Injectable } from '@nestjs/common';

const FECHA_REVISION_SRI = '13 de agosto de 2026';

const URL_SRI_IVA = 'https://www.sri.gob.ec/impuesto-al-valor-agregado-iva';
const URL_SRI_FACTURACION = 'https://www.sri.gob.ec/facturacion-electronica';
const URL_SRI_FORMULARIOS =
  'https://www.sri.gob.ec/web/intersri/formularios-e-instructivos';

@Injectable()
export class ConocimientoAsistenteService {
  // Devuelve una guía verificada cuando la pregunta no requiere datos financieros.
  generarRespuesta(pregunta: string): string | null {
    const preguntaNormalizada = this.normalizarTexto(pregunta);

    if (this.preguntaPorCapacidades(preguntaNormalizada)) {
      return this.responderCapacidades();
    }

    if (this.preguntaPorClaveAcceso(preguntaNormalizada)) {
      return this.responderClaveAcceso();
    }

    if (this.preguntaPorIva(preguntaNormalizada)) {
      return this.responderIva();
    }

    if (this.preguntaPorFormularios(preguntaNormalizada)) {
      return this.responderFormularios();
    }

    if (this.preguntaPorIdentificacionSri(preguntaNormalizada)) {
      return this.responderIdentificacionSri();
    }

    if (this.preguntaPorFacturacion(preguntaNormalizada)) {
      return this.responderFacturacionElectronica();
    }

    if (this.preguntaPorExportarReporte(preguntaNormalizada)) {
      return this.responderExportarReporte();
    }

    if (this.preguntaPorRegistrarMovimiento(preguntaNormalizada)) {
      return this.responderRegistrarMovimiento();
    }

    if (this.preguntaPorPantalla(preguntaNormalizada, 'dashboard')) {
      return this.responderDashboard();
    }

    if (this.preguntaPorPantalla(preguntaNormalizada, 'movimiento')) {
      return this.responderPantallaMovimientos();
    }

    if (this.preguntaPorPantalla(preguntaNormalizada, 'presupuesto')) {
      return this.responderPantallaPresupuestos();
    }

    if (
      this.preguntaPorPantalla(preguntaNormalizada, 'meta') ||
      this.preguntaPorPantalla(preguntaNormalizada, 'ahorro')
    ) {
      return this.responderPantallaMetas();
    }

    if (this.preguntaPorPantalla(preguntaNormalizada, 'reporte')) {
      return this.responderPantallaReportes();
    }

    if (
      this.preguntaPorPantalla(preguntaNormalizada, 'configuracion') ||
      this.preguntaPorPantalla(preguntaNormalizada, 'ajuste')
    ) {
      return this.responderPantallaConfiguracion();
    }

    if (this.preguntaGeneralSri(preguntaNormalizada)) {
      return this.responderSri();
    }

    return null;
  }

  private preguntaPorCapacidades(pregunta: string): boolean {
    return this.contieneAlguna(pregunta, [
      'que puedes hacer',
      'en que puedes ayudar',
      'como puedes ayudar',
      'ayuda del asistente',
      'funciones del asistente',
    ]);
  }

  private preguntaPorClaveAcceso(pregunta: string): boolean {
    return this.contieneAlguna(pregunta, [
      'clave de acceso',
      '49 digitos',
      'digito verificador',
      'modulo 11',
    ]);
  }

  private preguntaPorIva(pregunta: string): boolean {
    return this.contienePalabra(pregunta, 'iva');
  }

  private preguntaPorFormularios(pregunta: string): boolean {
    const mencionaFormulario = this.contieneAlguna(pregunta, [
      'formulario',
      'formularios',
    ]);

    const mencionaCodigo = this.contieneAlguna(pregunta, [
      '101',
      '102',
      '103',
      '104',
    ]);

    return mencionaFormulario || (mencionaCodigo && pregunta.includes('sri'));
  }

  private preguntaPorIdentificacionSri(pregunta: string): boolean {
    const mencionaIdentificacion = this.contieneAlguna(pregunta, [
      'ruc',
      'cedula',
      'identificacion tributaria',
    ]);

    return mencionaIdentificacion && !pregunta.includes('mi ruc');
  }

  /*
   * Reconoce distintas maneras naturales de consultar sobre facturación.
   * No depende de que las palabras aparezcan exactamente juntas.
   */
  private preguntaPorFacturacion(pregunta: string): boolean {
    const mencionaFacturacion =
      pregunta.includes('factur') ||
      pregunta.includes('comprobante electronico');

    const solicitaOrientacion = this.contieneAlguna(pregunta, [
      'como',
      'que es',
      'quiero saber',
      'informacion',
      'explica',
      'ayuda',
      'requisito',
      'paso',
      'proceso',
      'funciona',
      'emit',
      'gener',
      'crear',
      'hacer',
      'realizar',
      'sacar',
      'enviar',
      'autoriza',
      'firma',
      'xml',
      'clave de acceso',
      'certificacion',
      'produccion',
      'sri',
    ]);

    return mencionaFacturacion && solicitaOrientacion;
  }

  private preguntaPorExportarReporte(pregunta: string): boolean {
    const mencionaReporte = this.contieneAlguna(pregunta, [
      'reporte',
      'reportes',
      'informe',
    ]);

    const solicitaExportacion = this.contieneAlguna(pregunta, [
      'exportar',
      'descargar',
      'pdf',
      'excel',
    ]);

    return mencionaReporte && solicitaExportacion;
  }

  private preguntaPorRegistrarMovimiento(pregunta: string): boolean {
    const mencionaMovimiento = this.contieneAlguna(pregunta, [
      'movimiento',
      'ingreso',
      'gasto',
    ]);

    const solicitaRegistro = this.contieneAlguna(pregunta, [
      'registrar',
      'registro',
      'crear',
      'agregar',
      'anadir',
      'anoto',
      'guardar',
    ]);

    return mencionaMovimiento && solicitaRegistro;
  }

  private preguntaPorPantalla(pregunta: string, palabra: string): boolean {
    if (!pregunta.includes(palabra)) {
      return false;
    }

    return this.contieneAlguna(pregunta, [
      'como uso',
      'como crear',
      'como funciona',
      'donde encuentro',
      'para que sirve',
      'pantalla',
      'seccion',
      'guia',
      'ayudame a usar',
    ]);
  }

  /*
   * Las preguntas específicas sobre IVA, formularios, identificación
   * y facturación se procesan primero. Si no coincide ninguna, cualquier
   * mención general del SRI recibe una explicación introductoria.
   */
  private preguntaGeneralSri(pregunta: string): boolean {
    return this.contienePalabra(pregunta, 'sri');
  }

  private responderCapacidades(): string {
    return [
      'Puedo analizar tus ingresos, gastos, saldo, categoría de mayor gasto, presupuestos y metas de ahorro usando únicamente tus datos registrados.',
      'También puedo explicarte cómo usar las secciones de Fintech, cómo registrar movimientos y cómo exportar reportes.',
      'Puedo brindar información educativa sobre el SRI, el IVA, los formularios y la facturación electrónica.',
      'No puedo transferir dinero, registrar operaciones por ti, emitir facturas ni sustituir la asesoría financiera o tributaria profesional.',
    ].join(' ');
  }

  private responderClaveAcceso(): string {
    return [
      'La clave de acceso identifica de forma única cada comprobante electrónico del SRI y contiene 49 dígitos numéricos.',
      'Incluye la fecha de emisión, el tipo de comprobante, el RUC, el ambiente, la serie, el secuencial, un código numérico, el tipo de emisión y un dígito verificador calculado con módulo 11.',
      'La debe generar automáticamente el sistema de facturación; no es recomendable escribirla manualmente.',
      `Fuente oficial consultada el ${FECHA_REVISION_SRI}: ${URL_SRI_FACTURACION}`,
    ].join(' ');
  }

  private responderIva(): string {
    return [
      'El IVA es el Impuesto al Valor Agregado que se aplica a transferencias e importaciones de bienes y a determinados servicios.',
      `Según la página oficial del SRI consultada el ${FECHA_REVISION_SRI}, las tarifas vigentes son 0 % y 13 % para bienes y servicios, y 5 % para la transferencia de materiales de construcción.`,
      'La tarifa aplicable depende del bien, servicio, fecha y situación tributaria; por eso no debe asignarse automáticamente sin revisar el caso.',
      `Consulta la información vigente en: ${URL_SRI_IVA}`,
    ].join(' ');
  }

  private responderFormularios(): string {
    return [
      'De forma general, el formulario 101 corresponde a la declaración del Impuesto a la Renta de sociedades; el 102, a personas naturales y sucesiones indivisas; el 103, a retenciones en la fuente del Impuesto a la Renta; y el 104, a la declaración del IVA.',
      'La obligación y el formulario aplicable dependen del tipo de contribuyente, régimen y período fiscal.',
      `Verifica siempre la versión e instructivo vigentes en: ${URL_SRI_FORMULARIOS}`,
    ].join(' ');
  }

  private responderIdentificacionSri(): string {
    return [
      'La cédula identifica a una persona natural. El RUC identifica a una persona natural o sociedad inscrita como contribuyente y se relaciona con sus actividades y obligaciones tributarias.',
      'En un comprobante electrónico puede utilizarse RUC, cédula, pasaporte u otro tipo de identificación permitido, según el receptor y la transacción.',
      'No compartas números reales de identificación dentro de una pregunta al asistente.',
    ].join(' ');
  }

  private responderFacturacionElectronica(): string {
    return [
      'La emisión real de facturas todavía no está habilitada en esta etapa de Fintech; el asistente solo puede orientarte.',
      'El proceso oficial requiere una firma electrónica vigente, software que genere comprobantes, conexión a Internet y acceso a SRI en Línea.',
      'Una implementación debe generar el XML conforme a los esquemas del SRI, crear la clave de acceso de 49 dígitos, firmar el comprobante, enviarlo para validación y consultar su autorización.',
      'Primero debe probarse en el ambiente de certificación, cuyos comprobantes no tienen validez tributaria; después se utiliza producción, donde los comprobantes autorizados sí tienen validez.',
      `Fuente oficial consultada el ${FECHA_REVISION_SRI}: ${URL_SRI_FACTURACION}`,
    ].join(' ');
  }

  private responderExportarReporte(): string {
    return [
      'Para exportar un reporte en Fintech:',
      '1. Abre la sección Reportes.',
      '2. Elige el período diario, semanal, mensual o anual.',
      '3. Selecciona la fecha de referencia.',
      '4. Escoge PDF o Excel.',
      '5. Pulsa Exportar o Descargar y guarda el archivo generado.',
    ].join(' ');
  }

  private responderRegistrarMovimiento(): string {
    return [
      'Para registrar un movimiento en Fintech:',
      '1. Abre Movimientos y selecciona la opción para crear uno nuevo.',
      '2. Elige si es INGRESO o GASTO.',
      '3. Selecciona una categoría activa del mismo tipo.',
      '4. Ingresa un monto mayor que cero.',
      '5. Añade una descripción y fecha si lo necesitas.',
      '6. Guarda el movimiento. Este se incluirá en tus totales, presupuestos y reportes.',
    ].join(' ');
  }

  private responderDashboard(): string {
    return 'El Dashboard presenta un resumen de tu situación financiera. Allí puedes consultar ingresos, gastos, saldo y accesos a presupuestos, metas y reportes. Sus valores se calculan a partir de los movimientos que hayas registrado.';
  }

  private responderPantallaMovimientos(): string {
    return 'La sección Movimientos sirve para registrar y consultar ingresos y gastos. Cada movimiento necesita un tipo, una categoría compatible y un monto mayor que cero; la descripción y la fecha pueden ser opcionales.';
  }

  private responderPantallaPresupuestos(): string {
    return 'La sección Presupuestos permite definir un límite mensual para una categoría de gasto. Fintech compara ese límite con tus movimientos del mes y muestra cuánto has utilizado, cuánto queda y si el presupuesto está dentro del límite, en alerta o excedido.';
  }

  private responderPantallaMetas(): string {
    return 'La sección Metas de ahorro permite definir un nombre, un monto objetivo y una fecha. Los aportes aumentan el monto ahorrado y Fintech calcula el valor restante, el porcentaje de avance y el estado de la meta.';
  }

  private responderPantallaReportes(): string {
    return 'La sección Reportes resume tus ingresos, gastos y saldo por período. Puedes consultar reportes diarios, semanales, mensuales o anuales y exportarlos en PDF o Excel.';
  }

  private responderPantallaConfiguracion(): string {
    return 'La sección Configuración está destinada a las preferencias y datos de la cuenta. El asistente puede explicarte una opción visible, pero no puede cambiar contraseñas, permisos ni datos sensibles por ti.';
  }

  private responderSri(): string {
    return [
      'El Servicio de Rentas Internas, SRI, administra los impuestos nacionales en Ecuador y ofrece servicios para contribuyentes, declaraciones y comprobantes electrónicos.',
      'Puedo explicar conceptos generales sobre el IVA, RUC, cédula, formularios 101 al 104, claves de acceso y facturación electrónica.',
      'No puedo consultar deudas u obligaciones particulares del contribuyente ni reemplazar la revisión de la normativa vigente o de un profesional.',
      'Sitio oficial: https://www.sri.gob.ec/',
    ].join(' ');
  }

  private contieneAlguna(texto: string, expresiones: string[]): boolean {
    return expresiones.some((expresion) => texto.includes(expresion));
  }

  private contienePalabra(texto: string, palabra: string): boolean {
    return new RegExp(`\\b${palabra}\\b`, 'u').test(texto);
  }

  private normalizarTexto(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

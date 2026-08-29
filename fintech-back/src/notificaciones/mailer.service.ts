import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface AdjuntoCorreo {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface EnviarCorreoOpciones {
  para: string;
  asunto: string;
  textoPlano: string;
  html?: string;
  adjuntos?: AdjuntoCorreo[];
}

/**
 * Envío de correo saliente (SMTP) genérico, usado hoy para enviarle al
 * cliente el RIDE de una factura electrónica ya autorizada.
 *
 * Requiere variables de entorno SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 * (y opcionalmente SMTP_SECURE y SMTP_FROM) configuradas en fintech-back/.env.
 * Si no están configuradas, se lanza un error claro en vez de fallar en
 * silencio: mejor avisar que "no se pudo enviar" que perder el correo.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transportador: nodemailer.Transporter | null = null;
  private intentoInicializar = false;

  constructor(private readonly configService: ConfigService) {}

  estaConfigurado(): boolean {
    return Boolean(
      this.configService.get<string>('SMTP_HOST') &&
        this.configService.get<string>('SMTP_USER') &&
        this.configService.get<string>('SMTP_PASS'),
    );
  }

  private obtenerTransportador(): nodemailer.Transporter {
    if (this.transportador) {
      return this.transportador;
    }

    if (this.intentoInicializar || !this.estaConfigurado()) {
      throw new ServiceUnavailableException(
        'El envío de correo no está configurado en este servidor (faltan las variables SMTP_HOST/SMTP_USER/SMTP_PASS).',
      );
    }

    this.intentoInicializar = true;

    const host = this.configService.get<string>('SMTP_HOST')!;
    const port = Number(this.configService.get<string>('SMTP_PORT') ?? '587');
    const secure =
      (this.configService.get<string>('SMTP_SECURE') ?? 'false') === 'true';

    this.transportador = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });

    return this.transportador;
  }

  async enviar(opciones: EnviarCorreoOpciones): Promise<void> {
    const transportador = this.obtenerTransportador();
    const remitente =
      this.configService.get<string>('SMTP_FROM') ??
      this.configService.get<string>('SMTP_USER')!;

    try {
      await transportador.sendMail({
        from: remitente,
        to: opciones.para,
        subject: opciones.asunto,
        text: opciones.textoPlano,
        html: opciones.html,
        attachments: opciones.adjuntos?.map((adjunto) => ({
          filename: adjunto.filename,
          content: adjunto.content,
          contentType: adjunto.contentType,
        })),
      });
    } catch (error: unknown) {
      const detalle =
        error instanceof Error ? error.message : 'error desconocido';
      this.logger.error(`No se pudo enviar el correo a ${opciones.para}: ${detalle}`);
      throw new ServiceUnavailableException(
        'No se pudo enviar el correo. Verifica la configuración SMTP o inténtalo más tarde.',
      );
    }
  }
}

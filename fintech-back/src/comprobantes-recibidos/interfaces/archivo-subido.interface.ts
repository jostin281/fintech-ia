// Forma mínima de un archivo recibido por Multer (FilesInterceptor) que
// realmente se usa aquí. Mismo shape que ArchivoXmlSri en el módulo
// movimientos, que este módulo reemplaza.
export interface ArchivoComprobanteSubido {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

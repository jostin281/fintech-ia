import { IsOptional, IsString, MaxLength } from 'class-validator';

// Permite guardar o borrar (enviando null) la clave personal de Gemini.
export class ActualizarClaveGeminiDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  geminiApiKey?: string | null;
}

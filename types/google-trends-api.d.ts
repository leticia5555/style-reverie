/**
 * google-trends-api no publica tipos. Se declara solo lo que se usa: el
 * paquete raspa el endpoint público de Google y devuelve JSON como string.
 */
declare module "google-trends-api" {
  export function interestOverTime(options: {
    keyword: string;
    geo?: string;
    startTime?: Date;
    endTime?: Date;
  }): Promise<string>;
}

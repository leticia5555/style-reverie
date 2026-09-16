# Fotos curadas por tendencia

Un archivo por tendencia, con el id de la tendencia como nombre:
`content/trends/<trend-id>.json`.

Lo que se ponga aquí **gana** sobre la foto que saque el feed editorial.

```json
{
  "imageUrl": "https://assets.vogue.com/photos/ejemplo.jpg",
  "credit": "Vogue México",
  "creditUrl": "https://www.vogue.mx/articulo-original",
  "alt": {
    "es": "Pantalón satinado en la pasarela de otoño",
    "en": "Satin trousers on the autumn runway"
  }
}
```

- `imageUrl`, `credit` y `creditUrl` son **obligatorios**. Si falta cualquiera
  de los tres el archivo se ignora y la tendencia cae al feed o al placeholder:
  una foto sin crédito y sin enlace al original no se enseña.
- El host de `imageUrl` tiene que estar en `IMAGE_HOSTS`
  (`lib/editorial-image.ts`), o `next/image` no la carga.
- **Nunca de Pinterest ni de Google Imágenes.** Solo de medios que publican la
  foto, con su crédito y su enlace.
- `alt` es opcional: si falta se usa el nombre de la tendencia.

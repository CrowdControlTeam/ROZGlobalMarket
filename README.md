# ROZ Global Market

Mercado para la comunidad de Ragnarok Zero, con login por Discord.

> Este proyecto parte de [ROGuildMarket](https://github.com/CrowdControlTeam/ROGuildMarket) a partir de la **v0.2.0**, del que se separa para evolucionar de forma independiente. La especificación funcional de aquel proyecto (el «plan original» al que hacen referencia algunos comentarios del código) pertenece a ROGuildMarket, no a este repositorio.

## Requisitos

- Node.js 20+
- Docker (para la base de datos local)

## Puesta en marcha

1. Crea los dos archivos de entorno a partir de `.env.example` (ninguno se sube al repo):
   - `.env` → solo `DATABASE_URL` y `DIRECT_URL` (lo lee el CLI de Prisma, que no ve `.env.local`).
   - `.env.local` → el resto: credenciales de Discord (`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_GUILD_ID`), `AUTH_SECRET`, `APP_URL` y, opcionalmente, `GEMINI_API_KEY`.
2. Levanta la base de datos local:
   ```bash
   docker compose up -d db
   ```
3. Instala dependencias y aplica las migraciones:
   ```bash
   npm install
   npx prisma migrate dev
   ```
4. Arranca el servidor de desarrollo:
   ```bash
   npm run dev
   ```

En local, `DATABASE_URL`/`DIRECT_URL` apuntan al Postgres de `docker-compose.yml` (puerto 5434). El webhook de Discord ya no es una variable de entorno: se configura desde `/admin`.

## Despliegue

Objetivo de despliegue: **Cloudflare** (Workers, vía OpenNext) con **Neon** como base de datos Postgres serverless. En producción, `DATABASE_URL` usa el endpoint *pooled* de Neon y `DIRECT_URL` el directo (este último para `prisma migrate`). La configuración del adaptador de Cloudflare está pendiente y se añadirá más adelante.

## Prisma

- Esquema: `prisma/schema.prisma`
- Tras cualquier cambio de esquema: `npx prisma migrate dev --name <descripcion>`
- Explorar los datos: `npx prisma studio`

## Catálogo de items

El catálogo de items se genera con una herramienta externa aparte (no incluida
en este repositorio). Es un proceso manual y puntual (sin cron); tras
ejecutarlo hay que copiar a mano los iconos generados a `public/icons/items/`
en este repo.

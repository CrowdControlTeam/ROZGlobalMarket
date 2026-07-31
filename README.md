# ROZ Global Market

Mercado para la comunidad de Ragnarok Zero, con login por Discord.

> Este proyecto parte del código de [ROGuildMarket](https://github.com/CrowdControlTeam/ROGuildMarket) tal como estaba en su **v0.2.0**, del que se separa para evolucionar de forma independiente con **su propio versionado**. La especificación funcional de aquel proyecto (el «plan original» al que hacen referencia algunos comentarios del código) pertenece a ROGuildMarket, no a este repositorio.

## Versionado

Se sigue [SemVer](https://semver.org/lang/es/). La **última tag publicada** (`vX.Y.Z`) es la fuente de verdad de lo que hay en producción; `package.json` guarda la versión que se **muestra** en la web (al fondo del menú de usuario) y de la que se taggea al publicar.

- **`main`** lleva la versión publicada (`X.Y.Z`).
- **`develop`** lleva la **siguiente minor con sufijo `-dev`** (`X.(Y+1).0-dev`): es la versión «en desarrollo» y es lo que muestra el Worker de dev.

### Publicar una release (desde `develop`)

1. Lanza el workflow **Prepare release** (Actions → *Run workflow*) y elige el salto: `minor` (por defecto) o `major` — o una versión exacta en `exact_version` para forzarla. La versión se calcula desde **la última tag + el salto**.
2. El workflow crea una rama `release/<version>` **desde `develop`**, fija esa versión en `package.json` y abre una PR a `main`.
3. Al mergear esa PR a `main`: se despliega a producción (`ci.yml`) y se crea el tag `v<version>` + Release (`release.yml`).
4. `release.yml` abre **automáticamente** una PR `chore/next-dev-* → develop` que adelanta `develop` a la siguiente `-dev`. Solo cambia el número de versión: **nunca se mergea `main` en `develop`** (develop ya tiene el código; la release salió de ahí).

### Hotfix (parche sobre producción)

1. Lanza **Prepare release** con `patch`: crea una rama `release/<version>` **desde `main`** (`X.Y.Z+1`) y abre la PR a `main`.
2. Empuja el arreglo a esa rama y mergéala: se despliega y se taggea.
3. Lleva el arreglo a `develop` con un **cherry-pick** del commit del fix (no mergees `main` en `develop`). La versión de `develop` no cambia.

> Regla de oro: a `develop` solo llegan cambios por ramas **cortadas de `develop`** (el bump de versión lo escribe el workflow; el hotfix lo cherry-pickeas). Nunca se mergea la rama o historia de `main` dentro de `develop`, para no arrastrar su ceremonia de versionado.

### Arranque en un repo nuevo

Sin tags, **Prepare release** parte de `v0.0.0`, así que el primer `minor` publica `0.1.0`. El único paso de _bootstrap_ es dejar `develop` con su `-dev` inicial (`0.1.0-dev`).

> Los pasos que abren PRs desde Actions (`prepare-release.yml` y el `sync-develop` de `release.yml`) requieren activar **Settings → Actions → General → «Allow GitHub Actions to create and approve pull requests»**.

## Requisitos

- Node.js 20+
- Docker (para la base de datos local)

## Puesta en marcha

1. Crea los dos archivos de entorno a partir de `.env.example` (ninguno se sube al repo):
   - `.env` → solo `DATABASE_URL` y `DIRECT_URL` (lo lee el CLI de Prisma, que no ve `.env.local`).
   - `.env.local` → el resto: credenciales de Discord (`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_GUILD_ID`), `AUTH_SECRET`, `APP_URL` y, opcionalmente, `DISCORD_ADMIN_IDS` y `GEMINI_API_KEY`.
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

## Despliegue (Cloudflare Workers + Neon)

La app se despliega en **Cloudflare Workers** vía [OpenNext](https://opennext.js.org/cloudflare), con **Neon** como Postgres serverless. Config: `wrangler.jsonc` y `open-next.config.ts`.

### Base de datos (Neon)

1. Crea un proyecto en Neon y copia las dos cadenas de conexión:
   - `DATABASE_URL` → endpoint **pooled** (host con `-pooler`).
   - `DIRECT_URL` → endpoint **directo** (sin `-pooler`), para `prisma migrate`.
2. Aplica las migraciones contra Neon:
   ```bash
   npx prisma migrate deploy
   ```

En Workers, [prisma.ts](src/lib/prisma.ts) detecta el host de Neon (`neon.tech`) y usa el driver serverless (`@prisma/adapter-neon`, WebSocket) en vez de una conexión TCP; en local se sigue usando el cliente estándar contra el Postgres de docker.

### Secretos en Cloudflare

Configúralos con `wrangler secret put <NOMBRE>` (o desde el dashboard): `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_GUILD_ID`, `APP_URL` (dominio del Worker) y, opcionalmente, `DISCORD_ADMIN_IDS` (IDs de usuario con acceso a `/admin`, separados por comas), `DISCORD_BOT_TOKEN` y `GEMINI_API_KEY`.

### Build y deploy

```bash
npm run cf:build     # genera el Worker en .open-next/
npm run cf:preview   # prueba local del Worker (workerd)
npm run cf:deploy    # despliega a Cloudflare (requiere `wrangler login`)
```

> **Nota (Windows):** `cf:build` crea symlinks que en Windows requieren el **Modo Desarrollador** activado (o ejecutar como administrador); si no, falla con `EPERM: symlink`. En Linux, macOS y CI compila sin más — el deploy real suele hacerse desde CI/Linux.

### Automatizado (Cloudflare Workers Builds)

El deploy lo hace la integración Git nativa de Cloudflare (**Workers Builds**), no GitHub Actions. Se usan **dos conexiones**, una por entorno, cada una vigilando su rama y con secretos/BD aislados:

| Worker | Production branch | Deploy command |
|--------|-------------------|----------------|
| `roz-global-market` (producción) | `main` | `npx opennextjs-cloudflare deploy` |
| `roz-global-market-dev` | `develop` | `npx opennextjs-cloudflare deploy --env dev` |

En ambas: build command `npx opennextjs-cloudflare build`, *"Builds for non-production branches"* **desactivado** (cada conexión solo despliega su rama de producción), y los secretos de runtime se ponen a nivel de cada Worker. El `env.dev` de `wrangler.jsonc` es lo que resuelve el `--env dev`. Al construirse en Linux, no aplica el problema de symlinks de Windows.

El deploy de Cloudflare es independiente del tag/Release de GitHub (ver [Versionado](#versionado)): Cloudflare despliega al hacer push a la rama, y `release.yml` solo taggea.

## Prisma

- Esquema: `prisma/schema.prisma`
- Tras cualquier cambio de esquema: `npx prisma migrate dev --name <descripcion>`
- Explorar los datos: `npx prisma studio`

## Catálogo de items

El catálogo de items se genera con una herramienta externa aparte (no incluida
en este repositorio). Es un proceso manual y puntual (sin cron); tras
ejecutarlo hay que copiar a mano los iconos generados a `public/icons/items/`
en este repo.

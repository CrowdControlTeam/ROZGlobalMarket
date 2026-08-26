# ROZ Global Market

Mercado para la comunidad de Ragnarok Zero, con login por Discord.

> Este proyecto parte del código de [ROGuildMarket](https://github.com/CrowdControlTeam/ROGuildMarket) tal como estaba en su **v0.2.0**, del que se separa para evolucionar de forma independiente con **su propio versionado**. La especificación funcional de aquel proyecto (el «plan original» al que hacen referencia algunos comentarios del código) pertenece a ROGuildMarket, no a este repositorio.

## Versionado

Se sigue [SemVer](https://semver.org/lang/es/). La **última tag publicada** (`vX.Y.Z`) es la fuente de verdad de lo que hay en producción; `package.json` guarda la versión que se **muestra** en la web (al fondo del menú de usuario) y de la que se taggea al publicar.

- **`main`** lleva la versión publicada (`X.Y.Z`).
- **`develop`** lleva la **siguiente minor con sufijo `-dev`** (`X.(Y+1).0-dev`): es la versión «en desarrollo» y es lo que muestra el Worker de dev.

### Publicar una release (desde `develop`)

Todas las releases salen de `develop`. El salto es solo el paso de SemVer, no un flujo distinto:

- **`patch`** — release de solo correcciones (bugs acumulados, sin features nuevas).
- **`minor`** — features nuevas (**por defecto**).
- **`major`** — cambios incompatibles.

1. Lanza el workflow **Prepare release** (Actions → *Run workflow*) y elige el salto (o una versión exacta en `exact_version` para forzarla). La versión se calcula desde **la última tag + el salto**.
2. El workflow crea una rama `release/<version>` **desde `develop`**, fija esa versión en `package.json` y abre una PR a `main`.
3. Al mergear esa PR a `main`: se despliega a producción (`ci.yml`) y se crea el tag `v<version>` + Release (`release.yml`).
4. `release.yml` abre y **auto-mergea** (squash) una PR `chore/next-dev-* → develop` que adelanta `develop` a la siguiente `-dev`. Como solo cambia el número de versión, se mergea sola: **nunca se mergea `main` en `develop`** (develop ya tiene el código; la release salió de ahí).

### Hotfix urgente (desde `main`)

Solo si producción está rota y no puede esperar al ciclo de `develop`. Es un flujo **manual** (no usa *Prepare release*, que siempre parte de `develop`):

1. `git switch -c hotfix/<desc> main`, aplica el arreglo y bumpea a patch: `npm version patch --no-git-tag-version`.
2. Abre PR a `main` y mergéala: se despliega y se taggea `vX.Y.Z+1`.
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
   - `.env` → solo `DATABASE_URL` (la leen drizzle-kit y los scripts de seed, que no ven `.env.local`).
   - `.env.local` → el resto: credenciales de Discord (`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_GUILD_ID`), `AUTH_SECRET`, `APP_URL` y, opcionalmente, `DISCORD_ADMIN_IDS` y `GEMINI_API_KEY`.
2. Levanta la base de datos local:
   ```bash
   docker compose up -d db
   ```
3. Instala dependencias y aplica las migraciones:
   ```bash
   npm install
   npm run db:migrate
   ```
4. (Opcional) Siembra los datos base y de ejemplo:
   ```bash
   npm run seed:config && npm run seed:magical && npm run seed:options && npm run seed:bis
   npm run import:items   # catálogo de items (requiere el JSON del extractor)
   npm run seed:examples  # datos de prueba (solo local)
   ```
5. Arranca el servidor de desarrollo:
   ```bash
   npm run dev
   ```

En local, `DATABASE_URL` apunta al Postgres de `docker-compose.yml` (puerto 5434). El webhook de Discord ya no es una variable de entorno: se configura desde `/admin`.

## Despliegue (Cloudflare Workers + Neon)

La app se despliega en **Cloudflare Workers** vía [OpenNext](https://opennext.js.org/cloudflare), con **Neon** como Postgres serverless. Config: `wrangler.jsonc` y `open-next.config.ts`.

### Base de datos (Neon)

1. Crea un proyecto en Neon y copia la cadena de conexión:
   - `DATABASE_URL` → endpoint **pooled** (host con `-pooler`) para la app.
   - Para migrar usa el endpoint **directo** (sin `-pooler`).
2. Aplica las migraciones contra Neon (con el endpoint directo en `DATABASE_URL`):
   ```bash
   npx dotenvx run -f .env.production -- npm run db:migrate
   ```

En Workers, [src/db/index.ts](src/db/index.ts) detecta el host de Neon (`neon.tech`) y usa el driver serverless de Neon (`@neondatabase/serverless`, WebSocket) en vez de una conexión TCP; en local se usa node-postgres contra el Postgres de docker.

### Secretos en Cloudflare

Configúralos con `wrangler secret put <NOMBRE>` (o desde el dashboard): `DATABASE_URL`, `AUTH_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_GUILD_ID`, `APP_URL` (dominio del Worker) y, opcionalmente, `DISCORD_ADMIN_IDS` (IDs de usuario con acceso a `/admin`, separados por comas), `DISCORD_BOT_TOKEN` y `GEMINI_API_KEY`.

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

## Base de datos (Drizzle)

- ORM: [Drizzle](https://orm.drizzle.team). Esquema: [src/db/schema.ts](src/db/schema.ts) (tablas) y [src/db/relations.ts](src/db/relations.ts) (relaciones); cliente en [src/db/index.ts](src/db/index.ts).
- Tras cualquier cambio de esquema, genera y aplica la migración:
  ```bash
  npm run db:generate -- --name <descripcion>
  npm run db:migrate
  ```
  Las migraciones se aplican **a mano** por entorno (el CI no las corre): local con `.env`, y dev/prod con dotenvx (`npx dotenvx run -f .env.dev -- npm run db:migrate`), usando el endpoint **directo** de Neon.
- Explorar los datos: `npm run db:studio`
- Datos base / seed: scripts `npm run seed:*` e `import:items` (ver [src/db/seed/](src/db/seed)).

## Catálogo de items

El catálogo de items se genera con una herramienta externa aparte (no incluida
en este repositorio). Es un proceso manual y puntual (sin cron); tras
ejecutarlo hay que copiar a mano los iconos generados a `public/icons/items/`
en este repo.

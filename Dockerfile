# Imagen de la aplicación web.
#   docker build --platform linux/amd64 -t einvoice-web .
# Las pruebas no corren aquí: las ejecuta el CI antes de construir la imagen. La configuración
# (API_BASE_URL, APP_BASE_URL, SESSION_SECRET, API_TIMEOUT_MS) se lee al arrancar, no al construir:
# la misma imagen sirve en cualquier entorno. Despliegue en Google Cloud Run: docs/13-deployment.md
# del repositorio de la API. Se construye igual con BuildKit que con el constructor clásico de
# Docker, que es el que usa Cloud Build: nada de RUN --mount.

# Las dos etapas usan la plataforma de destino: la salida autocontenida copia dependencias con
# binarios nativos, que deben ser los de la máquina donde se ejecuta la imagen.
FROM node:24-alpine AS build
WORKDIR /src
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
# Las dependencias van en una capa propia, que solo se rehace cuando cambian package.json o
# package-lock.json.
RUN npm ci
COPY . .
# Salida autocontenida: solo lo que el servidor necesita para ejecutarse.
RUN NEXT_OUTPUT=standalone npm run build

FROM node:24-alpine
# El servidor escucha en PORT (Cloud Run lo define; 3000 si no) y en todas las interfaces.
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /src/.next/standalone ./
COPY --from=build --chown=node:node /src/.next/static ./.next/static
# Usuario sin privilegios que ya trae la imagen.
USER node
EXPOSE 3000
# Node es el proceso 1: el servidor de Next atiende SIGTERM y termina enseguida.
CMD ["node", "server.js"]

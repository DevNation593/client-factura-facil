# Imagen de la aplicación web.
#   docker build -t einvoice-web frontend
# Las pruebas no corren aquí: las ejecuta el CI antes de construir la imagen. La configuración
# (API_BASE_URL, APP_BASE_URL, OIDC_*, SESSION_SECRET) se lee al arrancar, no al construir.

FROM node:24-alpine AS build
WORKDIR /src
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Salida autocontenida: solo lo que el servidor necesita para ejecutarse.
RUN NEXT_OUTPUT=standalone npm run build

FROM node:24-alpine
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /src/.next/standalone ./
COPY --from=build --chown=node:node /src/.next/static ./.next/static
# Usuario sin privilegios que ya trae la imagen.
USER node
EXPOSE 3000
CMD ["node", "server.js"]

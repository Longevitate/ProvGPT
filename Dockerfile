FROM node:20-slim AS base
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

FROM node:20-slim AS build
WORKDIR /app
COPY . .
RUN npm install && npm run build

FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/data ./data
COPY --from=build /app/public ./public
COPY --from=build /app/apps ./apps
COPY package.json ./
EXPOSE 8080
CMD ["node", "dist/server.js"]



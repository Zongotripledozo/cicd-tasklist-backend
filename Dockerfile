FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci
RUN npm run prisma:generate

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

RUN apk update && apk upgrade --no-cache

COPY package*.json ./
RUN npm ci --omit=dev && rm -rf node_modules/prisma

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

USER appuser

EXPOSE 3001

CMD ["node", "dist/server.js"]
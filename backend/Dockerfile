FROM node:22-alpine AS dependencies
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate && npm run build

FROM dependencies AS development
ENV NODE_ENV=development
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate
EXPOSE 3001
CMD ["npm", "run", "start:dev"]

FROM dependencies AS migration
COPY prisma ./prisma
CMD ["npx", "prisma", "migrate", "deploy"]

FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache openssl \
  && addgroup -S appgroup \
  && adduser -S appuser -G appgroup
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev --omit=optional && npm cache clean --force
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/dist ./dist
USER appuser
EXPOSE 3001
CMD ["node", "dist/src/main.js"]

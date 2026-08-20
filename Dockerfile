# First build TypeScript
FROM node:22-alpine as builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npm run build

# Now for production image
FROM node:22-alpine as runner

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY src/public ./src/public

EXPOSE 3000

CMD ["node", "dist/api/server.js"]
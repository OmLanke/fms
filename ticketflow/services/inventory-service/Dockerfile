FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY package.json ./
COPY prisma ./prisma/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run generate
RUN pnpm run build
EXPOSE 3004
CMD ["node", "dist/src/index.js"]

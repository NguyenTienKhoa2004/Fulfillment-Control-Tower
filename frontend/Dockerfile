FROM node:24-bookworm-slim
RUN npm install --global pnpm@10.34.9
WORKDIR /app
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
EXPOSE 5173
CMD ["pnpm", "dev"]

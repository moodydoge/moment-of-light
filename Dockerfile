# 备选：容器部署（CloudBase 云托管容器型 / 任意容器平台）
# 要求：Node >= 22（node:sqlite）；单实例 + 持久卷挂载 /app/data
FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080
ENV MOL_HOST=0.0.0.0
ENV MOL_COMPANION_DB=/app/data/companion.sqlite

EXPOSE 8080
VOLUME ["/app/data"]

CMD ["npm", "run", "start"]

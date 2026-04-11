FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.js ./
COPY src ./src
COPY README.md ./

RUN mkdir -p /app/bases

EXPOSE 9503

CMD ["node", "index.js"]

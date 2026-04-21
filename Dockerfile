FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.js ./
COPY agent ./agent
COPY cli ./cli
COPY server ./server
COPY README.md ./

EXPOSE 9500

CMD ["node", "index.js"]

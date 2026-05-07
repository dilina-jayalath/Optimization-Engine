FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production \
    PORT=4000

COPY package.json ./
RUN npm install --omit=dev

COPY backend ./backend
COPY dashboard ./dashboard
COPY data ./data

EXPOSE 4000

CMD ["node", "backend/api.js"]

FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --omit=dev

COPY ecosystem.config.js ./
COPY src ./src

EXPOSE 3002

CMD ["npm", "start"]

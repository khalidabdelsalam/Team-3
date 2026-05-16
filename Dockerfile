

FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev

COPY ecosystem.config.js ./
COPY src ./src

EXPOSE 3001

CMD ["./node_modules/.bin/pm2-runtime", "ecosystem.config.js", "--env", "production"]

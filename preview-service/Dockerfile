FROM node:20-alpine

RUN apk add --no-cache vips-dev fftw-dev gcc g++ make python3

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src/ ./src/

EXPOSE 3001

CMD ["node", "src/app.js"]

FROM node:18-alpine

# Install PM2 globally
RUN npm install pm2 -g

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 3001

# Use pm2-runtime for Docker
CMD ["pm2-runtime", "start", "ecosystem.config.js"]

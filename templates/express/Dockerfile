FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN {{buildCommand}}

COPY . .

EXPOSE 3000

CMD {{startCommand}}
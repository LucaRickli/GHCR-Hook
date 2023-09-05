FROM node:alpine

WORKDIR /home

COPY ./dist/index.js .
COPY ./package.json .
COPY ./package-lock.json .

RUN apk update && \
    npm ci --omit=dev

EXPOSE 8000

ENV NODE_ENV=production

CMD [ "node", "index.js" ]

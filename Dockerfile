FROM node:lts-alpine

WORKDIR /build

COPY ./ ./

RUN apk update && \
    npm i && \
    npm run build

WORKDIR /home

RUN mv /build/dist/index.js . && \
    mv /build/package.json . && \
    mv /build/package-lock.json . && \
    rm -fr /build && \
    npm ci --omit=dev

EXPOSE 8000

CMD [ "npm", "run", "start:docker" ]

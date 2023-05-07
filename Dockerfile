FROM node:alpine

WORKDIR /build

COPY ./ ./

RUN npm i && \
    npm run build

WORKDIR /home

RUN mv /build/dist/index.js . && \
    mv /build/package.json . && \
    mv /build/package-lock.json . && \
    # npm i --omit=dev && \
    npm ci

USER node

CMD [ "npm", "run", "start:docker" ]

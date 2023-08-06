FROM node:alpine as build
WORKDIR /home

COPY ./ ./

RUN apk update && \
    npm i && \
    npm run build


FROM node:alpine
WORKDIR /home

COPY --from=build /home/dist/index.js .
COPY --from=build /home/package.json .
COPY --from=build /home/package-lock.json .

RUN apk update && \
    npm ci --omit=dev

EXPOSE 8000

ENV NODE_ENV=production

CMD [ "node", "index.js" ]

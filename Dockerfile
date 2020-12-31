FROM node:current-alpine3.12

RUN apk --no-cache -U upgrade

COPY . /
RUN yarn install

ENV NODE_ENV production

ENTRYPOINT ["node", "index.js"]

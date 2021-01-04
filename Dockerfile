FROM node:current-alpine3.12

RUN apk --no-cache -U upgrade

ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.7.3/wait /bin/wait
RUN chmod +x /bin/wait

RUN mkdir wiv
WORKDIR /wiv
COPY . /wiv

RUN yarn install

ENV NODE_ENV production

CMD /bin/wait && node /wiv/index.js

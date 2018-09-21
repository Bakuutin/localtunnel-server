FROM node:9.2.1

WORKDIR /app

RUN git clone https://github.com/Bakuutin/localtunnel-server.git /app

RUN yarn install --production && yarn cache clean

ENV NODE_ENV production

ENTRYPOINT ["node", "-r", "esm", "./bin/server"]

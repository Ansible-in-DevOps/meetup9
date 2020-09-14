## Example Hello World app
## AiDO 2020

FROM node:14

RUN mkdir /app
COPY ./app/* /app/
RUN chmod u+x /app/start.sh
RUN chown -R node:node /app

WORKDIR /app
USER node

RUN npm install 

CMD /app/start.sh
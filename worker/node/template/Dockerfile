FROM node:11-alpine
ADD .  /
#ADD server.sh  /server.sh
#ADD index.js  /index.js
WORKDIR /
# RUN chmod 777 ./server.sh
RUN apk add bash
EXPOSE 81
CMD ["sh", "-c", "tail -f /dev/null"]
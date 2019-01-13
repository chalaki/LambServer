FROM golang
ADD .  /
#ADD server.sh  /server.sh
#ADD index.js  /index.js
WORKDIR /
# RUN chmod 777 ./server.sh
# RUN apk add bash
EXPOSE 82
RUN go get github.com/go-chi/chi
CMD ["/bin/bash", "-c", "tail -f /dev/null"]
FROM sundarigari/node.11-alpine.exp.redis.kctl:latest
USER root
RUN npm install winston-daily-rotate-file
ADD .  /
CMD [ "ash", "-c", "node lambda_server.js"]
FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node . /app/
USER node
ENV NODE_ENV=production PULSE_HOST=0.0.0.0 PULSE_PORT=4173
EXPOSE 4173
HEALTHCHECK --interval=15s --timeout=4s --retries=3 CMD node healthcheck.mjs
CMD ["node","serve.mjs"]

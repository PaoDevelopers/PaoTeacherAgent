ARG IMAGE_TAG=v5.0.1
FROM onyxdotapp/onyx-backend:${IMAGE_TAG}
COPY --chown=onyx:onyx onyx /app/onyx

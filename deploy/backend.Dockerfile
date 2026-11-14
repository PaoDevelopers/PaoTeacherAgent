# Our backend = upstream release image + this fork's Python code. Avoids rebuilding all
# dependencies (and the Debian mirrors the full build needs).
ARG IMAGE_TAG=v5.0.1
FROM onyxdotapp/onyx-backend:${IMAGE_TAG} AS runtime
COPY --chown=onyx:onyx backend/onyx /app/onyx

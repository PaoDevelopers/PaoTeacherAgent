ARG IMAGE_TAG=v5.0.1
FROM onyxdotapp/onyx-backend:${IMAGE_TAG}
# The base image ships upstream's code, Enterprise Edition included, and COPY
# only overlays. Clear what this repo replaces so the image holds exactly its
# code, and drop the reporting clients nothing imports any more.
RUN rm -rf /app/ee /app/onyx /app/shared_configs /app/alembic /app/alembic_tenants \
        /app/alembic.ini /app/scripts \
    && python -m pip uninstall -y sentry-sdk posthog monotonic
COPY --chown=onyx:onyx onyx /app/onyx
COPY --chown=onyx:onyx shared_configs /app/shared_configs
COPY --chown=onyx:onyx alembic /app/alembic
COPY --chown=onyx:onyx alembic_tenants /app/alembic_tenants
COPY --chown=onyx:onyx alembic.ini /app/alembic.ini
COPY --chown=onyx:onyx scripts/debugging /app/scripts/debugging
COPY --chown=onyx:onyx --chmod=755 scripts/supervisord_entrypoint.sh /app/scripts/
COPY --chown=onyx:onyx scripts/force_delete_connector_by_id.py scripts/reencrypt_secrets.py \
    scripts/rotate_llm_provider_keys.py /app/scripts/

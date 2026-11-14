from typing import cast

from celery import Celery
from redis.lock import Lock as RedisLock
from sqlalchemy.orm import Session

from onyx.configs.constants import (
    OnyxRedisConstants,
)
from onyx.redis.redis_object_helper import RedisObjectHelper
from onyx.redis.tenant_redis_client import TenantRedisClient


class RedisUserGroup(RedisObjectHelper):
    PREFIX = "usergroup"
    FENCE_PREFIX = PREFIX + "_fence"
    FENCE_TTL = 7 * 24 * 60 * 60  # 7 days - defensive TTL to prevent memory leaks
    TASKSET_PREFIX = PREFIX + "_taskset"
    TASKSET_TTL = FENCE_TTL

    def __init__(self, tenant_id: str, id: int) -> None:
        super().__init__(tenant_id, str(id))

    @property
    def fenced(self) -> bool:
        if self.redis.exists(self.fence_key):
            return True

        return False

    def set_fence(self, payload: int | None) -> None:
        if payload is None:
            self.redis.srem(OnyxRedisConstants.ACTIVE_FENCES, self.fence_key)
            self.redis.delete(self.fence_key)
            return

        self.redis.set(self.fence_key, payload, ex=self.FENCE_TTL)
        self.redis.sadd(OnyxRedisConstants.ACTIVE_FENCES, self.fence_key)

    @property
    def payload(self) -> int | None:
        bytes = self.redis.get(self.fence_key)
        if bytes is None:
            return None

        progress = int(cast(int, bytes))
        return progress

    def generate_tasks(
        self,
        max_tasks: int,  # noqa: ARG002
        celery_app: Celery,  # noqa: ARG002
        db_session: Session,  # noqa: ARG002
        redis_client: TenantRedisClient,  # noqa: ARG002
        lock: RedisLock,  # noqa: ARG002
        tenant_id: str,  # noqa: ARG002
    ) -> tuple[int, int] | None:
        """Max tasks is ignored for now until we can build the logic to mark the
        user group up to date over multiple batches.
        """
        return 0, 0

    def reset(self) -> None:
        self.redis.srem(OnyxRedisConstants.ACTIVE_FENCES, self.fence_key)
        self.redis.delete(self.taskset_key)
        self.redis.delete(self.fence_key)

    @staticmethod
    def reset_all(r: TenantRedisClient) -> None:
        for key in r.scan_iter(RedisUserGroup.TASKSET_PREFIX + "*"):
            r.delete(key)

        for key in r.scan_iter(RedisUserGroup.FENCE_PREFIX + "*"):
            r.delete(key)

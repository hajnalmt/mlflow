from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from mlflow.protos.service_pb2 import GetExperimentRunDataKeys as ProtoGetExperimentRunDataKeys


@dataclass(frozen=True)
class RunDataKeys:
    """
    The distinct metric and param keys that are logged on a set of runs, without their values.

    Args:
        metric_keys: Sorted, distinct keys of the (latest) metrics.
        param_keys: Sorted, distinct keys of the params.
        metric_keys_truncated: Whether more metric keys matched than are listed in
            ``metric_keys``.
        param_keys_truncated: Whether more param keys matched than are listed in ``param_keys``.
    """

    metric_keys: tuple[str, ...] = ()
    param_keys: tuple[str, ...] = ()
    metric_keys_truncated: bool = False
    param_keys_truncated: bool = False

    def __post_init__(self):
        object.__setattr__(self, "metric_keys", tuple(sorted(set(self.metric_keys))))
        object.__setattr__(self, "param_keys", tuple(sorted(set(self.param_keys))))

    @classmethod
    def from_keys(
        cls,
        metric_keys: Iterable[str],
        param_keys: Iterable[str],
        search: str | None = None,
        max_results: int | None = None,
    ) -> RunDataKeys:
        """
        Builds the keys from complete collections of metric and param keys, applying the same
        ``search`` (case-insensitive substring match) and ``max_results`` semantics as the
        tracking store queries.
        """

        def _select(keys):
            keys = sorted(set(keys))
            if search:
                keys = [k for k in keys if search.lower() in k.lower()]
            truncated = max_results is not None and len(keys) > max_results
            return (keys[:max_results] if truncated else keys), truncated

        metric_keys, metrics_truncated = _select(metric_keys)
        param_keys, params_truncated = _select(param_keys)
        return cls(metric_keys, param_keys, metrics_truncated, params_truncated)

    def to_proto(self) -> ProtoGetExperimentRunDataKeys.Response:
        return ProtoGetExperimentRunDataKeys.Response(
            metric_keys=self.metric_keys,
            param_keys=self.param_keys,
            metric_keys_truncated=self.metric_keys_truncated,
            param_keys_truncated=self.param_keys_truncated,
        )

    @classmethod
    def from_proto(cls, proto: ProtoGetExperimentRunDataKeys.Response) -> RunDataKeys:
        return cls(
            metric_keys=tuple(proto.metric_keys),
            param_keys=tuple(proto.param_keys),
            metric_keys_truncated=proto.metric_keys_truncated,
            param_keys_truncated=proto.param_keys_truncated,
        )

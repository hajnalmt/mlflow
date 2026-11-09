from __future__ import annotations

from dataclasses import dataclass

from mlflow.protos.service_pb2 import GetExperimentRunDataKeys as ProtoGetExperimentRunDataKeys


@dataclass(frozen=True)
class RunDataKeys:
    """
    The distinct metric and param keys that are logged on a set of runs, without their values.

    Args:
        metric_keys: Sorted, distinct keys of the (latest) metrics.
        param_keys: Sorted, distinct keys of the params.
    """

    metric_keys: tuple[str, ...] = ()
    param_keys: tuple[str, ...] = ()

    def __post_init__(self):
        object.__setattr__(self, "metric_keys", tuple(sorted(set(self.metric_keys))))
        object.__setattr__(self, "param_keys", tuple(sorted(set(self.param_keys))))

    def to_proto(self) -> ProtoGetExperimentRunDataKeys.Response:
        return ProtoGetExperimentRunDataKeys.Response(
            metric_keys=self.metric_keys, param_keys=self.param_keys
        )

    @classmethod
    def from_proto(cls, proto: ProtoGetExperimentRunDataKeys.Response) -> RunDataKeys:
        return cls(metric_keys=tuple(proto.metric_keys), param_keys=tuple(proto.param_keys))

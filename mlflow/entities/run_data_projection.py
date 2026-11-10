from __future__ import annotations

from dataclasses import dataclass

from mlflow.entities.metric import Metric
from mlflow.entities.param import Param
from mlflow.entities.run import Run
from mlflow.entities.run_data import RunData
from mlflow.entities.run_tag import RunTag
from mlflow.protos.service_pb2 import SearchRuns as ProtoSearchRuns


@dataclass(frozen=True)
class RunDataProjection:
    """
    Restricts the metrics and params that are returned for each run by a run search.

    When a projection is applied, only the metrics and params whose keys are listed are returned,
    so empty key lists mean that no metrics or no params are returned. Tags are never projected.
    A projection only limits the returned data: it does not affect which runs match a search
    filter or how they are ordered.

    Args:
        metric_keys: Keys of the (latest) metrics to return for each run.
        param_keys: Keys of the params to return for each run.
    """

    metric_keys: tuple[str, ...] = ()
    param_keys: tuple[str, ...] = ()

    def __post_init__(self):
        # Deduplicate while preserving order and accept any iterable of keys.
        object.__setattr__(self, "metric_keys", tuple(dict.fromkeys(self.metric_keys)))
        object.__setattr__(self, "param_keys", tuple(dict.fromkeys(self.param_keys)))

    def apply(self, run: Run) -> Run:
        """
        Returns a copy of the given run that only holds the projected metrics and params.
        """
        metric_keys = set(self.metric_keys)
        param_keys = set(self.param_keys)
        # Use the original list of metric objects, not the key -> value mapping, in order to keep
        # the full metric (timestamp, step, ...) intact.
        metrics: list[Metric] = [m for m in run.data._metric_objs if m.key in metric_keys]
        params = [Param(k, v) for k, v in run.data.params.items() if k in param_keys]
        tags = [RunTag(k, v) for k, v in run.data.tags.items()]
        return Run(
            run_info=run.info,
            run_data=RunData(metrics=metrics, params=params, tags=tags),
            run_inputs=run.inputs,
            run_outputs=run.outputs,
        )

    def to_proto(self) -> ProtoSearchRuns.DataProjection:
        return ProtoSearchRuns.DataProjection(
            metric_keys=self.metric_keys, param_keys=self.param_keys
        )

    @classmethod
    def from_proto(cls, proto: ProtoSearchRuns.DataProjection) -> RunDataProjection:
        return cls(metric_keys=tuple(proto.metric_keys), param_keys=tuple(proto.param_keys))

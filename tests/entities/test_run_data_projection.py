from mlflow.entities import Metric, Param, Run, RunData, RunInfo, RunTag
from mlflow.entities.run_data_projection import RunDataProjection
from mlflow.protos.service_pb2 import SearchRuns


def _make_run():
    info = RunInfo(
        run_id="run-1",
        experiment_id="0",
        user_id="user",
        status="FINISHED",
        start_time=0,
        end_time=1,
        lifecycle_stage="active",
    )
    data = RunData(
        metrics=[Metric("m1", 1.0, 10, 2), Metric("m2", 2.0, 20, 3), Metric("m3", 3.0, 30, 4)],
        params=[Param("p1", "a"), Param("p2", "b")],
        tags=[RunTag("t1", "x")],
    )
    return Run(info, data)


def test_apply_keeps_only_projected_metrics_and_params():
    run = _make_run()
    projected = RunDataProjection(metric_keys=["m1", "m3"], param_keys=["p2"]).apply(run)

    assert projected.info is run.info
    assert projected.data.metrics == {"m1": 1.0, "m3": 3.0}
    assert projected.data.params == {"p2": "b"}
    # Tags are never projected
    assert projected.data.tags == {"t1": "x"}
    # The full metric (timestamp and step), not just its value, is kept
    assert [(m.key, m.timestamp, m.step) for m in projected.data._metric_objs] == [
        ("m1", 10, 2),
        ("m3", 30, 4),
    ]


def test_apply_with_empty_projection_returns_no_metrics_and_params():
    projected = RunDataProjection().apply(_make_run())

    assert projected.data.metrics == {}
    assert projected.data.params == {}
    assert projected.data.tags == {"t1": "x"}


def test_apply_ignores_unknown_keys_and_does_not_mutate_the_run():
    run = _make_run()
    projected = RunDataProjection(metric_keys=["missing"], param_keys=["p1", "missing"]).apply(run)

    assert projected.data.metrics == {}
    assert projected.data.params == {"p1": "a"}
    assert run.data.metrics == {"m1": 1.0, "m2": 2.0, "m3": 3.0}
    assert run.data.params == {"p1": "a", "p2": "b"}


def test_keys_are_deduplicated_preserving_order():
    projection = RunDataProjection(metric_keys=["b", "a", "b"], param_keys=iter(["c", "c"]))

    assert projection.metric_keys == ("b", "a")
    assert projection.param_keys == ("c",)


def test_proto_round_trip():
    projection = RunDataProjection(metric_keys=["m1", "m2"], param_keys=["p1"])
    proto = projection.to_proto()

    assert isinstance(proto, SearchRuns.DataProjection)
    assert list(proto.metric_keys) == ["m1", "m2"]
    assert list(proto.param_keys) == ["p1"]
    assert RunDataProjection.from_proto(proto) == projection

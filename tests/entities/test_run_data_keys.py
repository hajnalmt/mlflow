from mlflow.entities.run_data_keys import RunDataKeys
from mlflow.protos.service_pb2 import GetExperimentRunDataKeys


def test_keys_are_sorted_and_deduplicated():
    keys = RunDataKeys(metric_keys=["b", "a", "b"], param_keys=iter(["z", "y", "z"]))

    assert keys.metric_keys == ("a", "b")
    assert keys.param_keys == ("y", "z")


def test_defaults_to_no_keys():
    keys = RunDataKeys()

    assert keys.metric_keys == ()
    assert keys.param_keys == ()


def test_proto_round_trip():
    keys = RunDataKeys(metric_keys=["m2", "m1"], param_keys=["p1"])
    proto = keys.to_proto()

    assert isinstance(proto, GetExperimentRunDataKeys.Response)
    assert list(proto.metric_keys) == ["m1", "m2"]
    assert list(proto.param_keys) == ["p1"]
    assert RunDataKeys.from_proto(proto) == keys


def test_from_keys_applies_search_and_limit():
    keys = RunDataKeys.from_keys(
        metric_keys=["b/Loss", "a/loss", "a/acc", "c/loss"],
        param_keys=["lr", "LOSS_weight"],
        search="LOSS",
        max_results=2,
    )

    # The search is case-insensitive, keys are sorted, and the limit is applied per type
    assert keys.metric_keys == ("a/loss", "b/Loss")
    assert keys.metric_keys_truncated is True
    assert keys.param_keys == ("LOSS_weight",)
    assert keys.param_keys_truncated is False


def test_from_keys_without_limit_is_never_truncated():
    keys = RunDataKeys.from_keys(["b", "a"], ["c"])

    assert keys == RunDataKeys(metric_keys=("a", "b"), param_keys=("c",))
    assert not keys.metric_keys_truncated
    assert not keys.param_keys_truncated


def test_proto_round_trip_keeps_truncation_flags():
    keys = RunDataKeys(metric_keys=["m"], metric_keys_truncated=True, param_keys_truncated=False)

    assert RunDataKeys.from_proto(keys.to_proto()) == keys

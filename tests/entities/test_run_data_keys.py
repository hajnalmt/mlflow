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

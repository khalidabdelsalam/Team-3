const state = {
  kafkaConnected: false
};

export function getRuntimeState() {
  return state;
}

export function setKafkaConnected(value) {
  state.kafkaConnected = value;
}

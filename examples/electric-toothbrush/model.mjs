export const OSC_PER_MIN = 8800;
export const OSC_HZ = OSC_PER_MIN / 60;
export const AMPLITUDE_DEG = 20;
export const BATTERY_V = 3.7;
export const BATTERY_MAH = 800;
export const CHARGE_W = 1.2;
export const PRESSURE_TRIP_N = 2.5;
export const TUFTS = 28;
export const IP = "IPX7";
export const MOTOR_RPM = 8800;
export const CHARGE_KHZ = 50;

export function oscAngle(time, running, pressureN) {
  if (!running || pressureN >= PRESSURE_TRIP_N) return 0;
  return AMPLITUDE_DEG * Math.sin(time * OSC_HZ * Math.PI * 2);
}

export function frequencyHz(running, pressureN) {
  if (!running || pressureN >= PRESSURE_TRIP_N) return 0;
  return OSC_HZ;
}

export function readoutOf({ running, pressureN, selected, say, moving, apart }) {
  if (selected && say) return say;
  if (moving) return apart ? "拆开" : "合拢";
  if (pressureN >= PRESSURE_TRIP_N) return `过压保护 · ${PRESSURE_TRIP_N.toFixed(1)} N`;
  if (running) return `${OSC_PER_MIN} 次/min · ${OSC_HZ.toFixed(1)} Hz`;
  if (apart) return "拆开 · 10 个组件";
  return `${BATTERY_V.toFixed(1)} V · ${BATTERY_MAH} mAh · 静止`;
}

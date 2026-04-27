// Simulated Artemis II trajectory data (free return trajectory around the Moon)
// Time in hours from launch, distance in km, speed in km/s

export interface TrajectoryPoint {
  t: number; // hours
  x: number; // km (Earth-centered)
  y: number;
  z: number;
  distance: number; // cumulative km traveled
  speed: number; // km/s
  acceleration: number; // m/s^2
  altitude: number; // km from Earth surface
  phase: string;
}

const EARTH_RADIUS = 6371;
const MOON_DISTANCE = 384400;

function generateTrajectory(): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [];
  const totalHours = 240; // 10 day mission
  const steps = 480;
  let cumulativeDistance = 0;
  let prevSpeed = 0;

  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * totalHours;
    // Mission profile: launch (0-2h), TLI burn (~3h), coast to moon (3-80h),
    // lunar flyby (~88h), return coast (88-220h), reentry (~235h)
    const progress = t / totalHours;

    // Smooth bell-shaped path approximating a free return loop in 3D
    const angle = progress * Math.PI * 2.2;
    const lunarPhase = Math.sin(progress * Math.PI); // 0 -> 1 -> 0

    const r = EARTH_RADIUS + lunarPhase * MOON_DISTANCE * 1.02;
    const x = Math.cos(angle * 0.5) * r * (1 - 0.15 * Math.sin(angle));
    const y = Math.sin(angle * 0.5) * r * (1 + 0.1 * Math.cos(angle * 0.7));
    const z = Math.sin(progress * Math.PI * 1.5) * r * 0.18;

    // Speed profile: high at launch, drops at apogee (lunar), rises on return
    let speed: number;
    if (t < 2) speed = 7.8 + t * 1.2; // ascent
    else if (t < 4) speed = 10.8 - (t - 2) * 0.2; // post-TLI
    else {
      // Vis-viva-like: faster near earth, slower at moon distance
      const dist = Math.sqrt(x * x + y * y + z * z);
      speed = Math.max(0.4, 11.2 * Math.sqrt(EARTH_RADIUS * 2 / dist));
      // Boost near reentry
      if (t > 230) speed += (t - 230) * 0.8;
    }
    speed += Math.sin(t * 0.3) * 0.05; // tiny noise

    const acceleration = i === 0 ? 0 : ((speed - prevSpeed) * 1000) / ((totalHours / steps) * 3600);
    prevSpeed = speed;

    if (i > 0) {
      const prev = points[i - 1];
      const dx = x - prev.x, dy = y - prev.y, dz = z - prev.z;
      cumulativeDistance += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    let phase = 'Coast';
    if (t < 0.5) phase = 'Launch';
    else if (t < 3) phase = 'Ascent';
    else if (t < 4) phase = 'TLI Burn';
    else if (t > 85 && t < 95) phase = 'Lunar Flyby';
    else if (t > 232) phase = 'Reentry';

    points.push({
      t,
      x,
      y,
      z,
      distance: cumulativeDistance,
      speed,
      acceleration,
      altitude: Math.sqrt(x * x + y * y + z * z) - EARTH_RADIUS,
      phase,
    });
  }
  return points;
}

export const trajectoryData = generateTrajectory();

export const missionMetrics = (() => {
  const speeds = trajectoryData.map(p => p.speed);
  const maxSpeed = Math.max(...speeds);
  const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const totalDistance = trajectoryData[trajectoryData.length - 1].distance;
  const duration = trajectoryData[trajectoryData.length - 1].t;
  const maxAlt = Math.max(...trajectoryData.map(p => p.altitude));
  return {
    totalDistance, // km
    maxSpeed, // km/s
    avgSpeed, // km/s
    duration, // hours
    maxAltitude: maxAlt,
  };
})();

export const missionEvents = [
  { t: 0, label: 'Launch', detail: 'SLS liftoff from LC-39B', type: 'critical' as const },
  { t: 1.6, label: 'MECO', detail: 'Main engine cutoff', type: 'info' as const },
  { t: 3.2, label: 'TLI Burn', detail: 'Trans-Lunar Injection complete', type: 'critical' as const },
  { t: 24, label: 'Day 1 Checkout', detail: 'Spacecraft systems nominal', type: 'info' as const },
  { t: 88, label: 'Lunar Flyby', detail: 'Closest approach: 9,200 km', type: 'highlight' as const },
  { t: 120, label: 'Apogee', detail: 'Maximum distance from Earth', type: 'info' as const },
  { t: 200, label: 'Course Correction', detail: 'Final trajectory burn', type: 'info' as const },
  { t: 235, label: 'Reentry Interface', detail: 'Atmospheric entry begins', type: 'critical' as const },
  { t: 240, label: 'Splashdown', detail: 'Pacific Ocean recovery', type: 'highlight' as const },
];
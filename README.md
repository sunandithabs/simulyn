# SPECTER
Sensor-Poisoning & Estimation-Corruption Test Rig — F1TENTH

Simulation-only attack + defense demo against localization on the
`f1tenth_gym` simulator. Injects bounded, timed drift into LiDAR/odometry
during a vehicle's re-localization window, measures the effect on
trajectory and lap behavior, and ships a lightweight residual-based
detector that flags the injected drift.

## Structure
- `specter/attack.py`      — bounded-budget drift injector (attacker module)
- `specter/detector.py`    — residual-based drift detector (defense module)
- `specter/runner.py`      — drives a lap in f1tenth_gym with attack/detector toggled
- `specter/metrics.py`     — trajectory deviation, collision rate, detection rate
- `tests/`                 — pytest suite: attack bounds, detector false-positive rate, end-to-end runs
- `docs/results.md`        — logged runs across budget levels + plots

## Status
Work in progress — see docs/results.md for current test coverage.

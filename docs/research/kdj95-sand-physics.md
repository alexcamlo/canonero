# KDJ95 driving physics on sand and dunes

Researched 2026-10-11; game inspected at `da0f5a8`. Research and implementation recommendations only; no physics changes or driving experiments in this task. Exact vehicle references and market differences: [KDJ95 reference](kdj95-reference.md).

## Main recommendation

Product requirement, clarified after this research: one permanent sand setup with automatic gearing. Tyre pressure and transfer range must not require player management. The initial preset uses the existing aired-down tyre calibration and short gearing; it does not implement the physics recommendations below. The code observations later in this report describe the original `da0f5a8` baseline.

Keep Rapier, the fixed 60 Hz step, procedural dunes, and simple driving controls. Improve the relationship between wheel load, tyre footprint, slip, and sand resistance before adding more driving features. The player should feel a heavy diesel 4x4: useful low-speed torque, a cost for scrubbing the front tyres sideways, loss of momentum uphill, and a clear difference between controlled traction and digging holes.

This is an engineering recommendation from the sources below, not a validated KDJ95 simulation. Toyota supplies vehicle specifications; tyre makers and vehicle manufacturers supply practical observations; terramechanics research supplies mechanisms. None of those alone supplies measured handling parameters for this particular vehicle on this game's sand.

## Vehicle identity matters

Use the five-door 90-series D-4D as the reference. The UK 2001 specification gives 343 Nm at 1,600 rpm, 120 kW at 3,400 rpm, and a 2.675 m wheelbase. Japanese engine calibration differs. [Toyota UK](https://media.toyota.co.uk/more-power-and-torque-for-less/), [Toyota Japan](https://global.toyota/en/detail/12464177).

The [reference note](kdj95-reference.md) separates confirmed dimensions, suspension and transmission ratios from uncertain transfer gearing and trim equipment. Do not combine a later Prado's engine curve/electronics with this car. Keeping automatic shifting is a reasonable game choice; choose the actual manual or automatic specification before implementing gearing.

## What sand changes

### 1. Traction and resistance are separate

Tyres must generate forward thrust while also deforming and displacing sand. Net pull is thrust minus motion resistance. Wheel load, footprint, slip, inflation and sinkage all matter; one friction multiplier cannot describe the entire interaction. Mason et al. model powered, towed and braked wheels using experimental sand data. [Mason et al., 2018, introduction and model](https://www.cavs.msstate.edu/publications/docs/2018/05/15870Mason_et_al._2018_traction_wheel_sand_Terramechanics.pdf).

**Game implication:** retain separate traction and drag, but make both depend on the contact's load and soil state. Excess engine torque can create slip and more resistance without producing more useful acceleration. Avoid an asphalt tyre curve with a single smaller grip coefficient as the whole sand model.

### 2. Sinkage needs a support equilibrium

The Bekker pressure–sinkage relation used in Project Chrono's soil contact model is:

```text
p = (kc / b + kphi) * z^n
```

Here `p` is contact pressure, `z` sinkage, `b` the smaller footprint dimension, and the remaining values are fitted soil parameters. This relates deformation to pressure; it does not prescribe a constant sinking rate whenever the vehicle is stopped. Chrono also distinguishes elastic and plastic deformation. [Chrono terrain models](https://api.projectchrono.org/development/vehicle_terrain.html#vehicle_terrain_scm), [SCM node state](https://api.projectchrono.org/9.0.0/structchrono_1_1vehicle_1_1_s_c_m_terrain_1_1_node_info.html).

**Proposed approximation:** approach a load/footprint-dependent resting depth, then add excavation caused by slip. A stationary, unpowered tyre on stable sand should settle rather than inevitably progress to maximum burial. When the tyre leaves a hole, its own contact depth changes; the hole does not travel with it. Soil coefficients require calibration, so published rover constants are not KDJ95 constants.

### 3. Momentum helps; speed is not a universal lift force

Isuzu's sand-driving guidance recommends smooth momentum, avoiding excessive wheelspin, and backing along existing compacted tracks when progress deteriorates. It warns that adding throttle once the tyres dig in can deepen the problem. [Isuzu sand driving](https://www.isuzuute.com.au/discover/featured-stories/master-the-art-of-sand-driving).

**Derived physical explanation:** kinetic energy carries the vehicle through a short region where resistance exceeds available drive. Uphill, it also pays the gravitational energy cost. A vehicle can still spin while moving quickly, and controlled low-speed movement need not mean wheelspin. The present linear speed-based sinkage reduction is a game heuristic, not a measured flotation law. NASA's pneumatic-wheel and rover comparison illustrates wheel-specific traction modelling and calibration; it does not establish a universal speed threshold for flotation. [NASA wheel-performance study](https://ntrs.nasa.gov/citations/20090008502).

### 4. Airing down changes footprint and compliance

BFGoodrich describes increased footprint and flotation at reduced pressure, with pressure choice depending on vehicle load and tyre construction. [BFGoodrich pressure guide](https://www.bfgoodrich.com.au/auto/help-and-advice/off-road-tyre-pressure-chart).

Published practical recommendations differ: Isuzu's article suggests 16 psi for its vehicles; BFGoodrich Australia's guide says to reduce in steps, stay at or above 20 psi, and limit speed to 25 km/h at that pressure. These are different manufacturers' guidance, not a verified pressure prescription for a KDJ95. [Isuzu](https://www.isuzuute.com.au/discover/featured-stories/master-the-art-of-sand-driving), [BFGoodrich sand guidance](https://www.bfgoodrich.com.au/auto/help-and-advice/faq-4wd-tips).

**Proposed approximation:** map the existing pressure control to a bounded footprint/compliance change, then let that reduce ground pressure and sinkage. Keep steering response softer at reduced pressure, but do not assume a universal proportional loss of lateral grip. `footprint area ≈ wheel load / effective contact pressure` is a useful first estimate, not an exact pneumatic tyre model: the carcass also carries load. A physical pressure display needs a chosen tyre/load baseline; the present percentage is not psi.

### 5. Turning consumes momentum and can plough

BFGoodrich describes sharp steering producing understeer and warns that tyres cutting into sand can contribute to tipping. Isuzu recommends keeping steering straight and distinguishes high range on long flatter sections from low range in very soft sections. [BFGoodrich](https://www.bfgoodrich.com.au/auto/help-and-advice/faq-4wd-tips), [Isuzu loose surfaces](https://www.isuzuute.com.au/discover/featured-stories/loose-surfaces).

Lateral interaction is more than reduced sideways friction: a tyre moving across its rolling direction displaces soil. Pavlov and Johnson explicitly model longitudinal slip, lateral slip, sidewall forces and sinkage, tested with two wheels in sand. The experiments are not full-size Land Cruiser calibration. [Pavlov & Johnson, 2024](https://www.sciencedirect.com/science/article/pii/S0022489823000691).

**Game implication:** front-wheel steering angle relative to actual contact velocity should matter. Full lock on soft sand should scrub speed and can push the nose straight ahead. Steering back and forth must not award free reductions in burial; any recovery benefit should require contact with supporting soil or movement out of the rut.

### 6. Low range and differential locks do different jobs

Low range multiplies torque and reduces speed for a given engine rpm. It does not increase engine power or the sand's bearing strength. More wheel torque can worsen digging when traction is already saturated. Manufacturer guidance supports choosing range for conditions rather than treating low range as an automatic sand advantage. [Isuzu loose surfaces](https://www.isuzuute.com.au/discover/featured-stories/loose-surfaces).

A differential lock constrains relative shaft speeds. It does not mandate an equal torque split: ground reactions determine how the available torque is used. An ideal symmetric open differential supplies equal output torque and is limited by its weaker side. Eaton describes the locking action as forcing paired axle shafts to rotate together. [Eaton locking differential operation](https://automotive.eaton.com/us/en-us/products/differentials-traction-control/locking-differentials.html).

**Game implication:** equal independent drive force at all four wheels models neither an open nor a locked drivetrain correctly. A centre lock couples the axles; it does not lock left to right. If drivetrain simulation is added, implement the verified configuration rather than a generic four-wheel grip bonus. Confirm rear-lock availability and transfer controls for the chosen market using the [reference note](kdj95-reference.md).

### 7. Dunes affect contact, clearance and stability

The NPS describes the familiar shallow windward slope, crest, and steeper lee face. That supports the current asymmetric dune shape, but does not prove that every bowl is soft or every windward patch firm. [NPS dune landforms](https://www.nps.gov/subjects/geology/aeolian-landforms.htm).

**Modeling judgment:** keep shape-driven softness as a readable terrain prior. Treat uniform softness rules, pale colouring and any exact slope thresholds as art/calibration choices. A crest can unload the wheels or support the underbody; a hollow can compress the suspension. Those outcomes should arise from geometry, speed and forces.

NHTSA defines static stability factor as track width divided by twice the centre-of-gravity height. It also distinguishes this geometric measure from dynamic rollover testing. It is not a safe side-slope angle for a moving vehicle on yielding sand. [NHTSA rollover presentation, pp. 6–9](https://www.nhtsa.gov/document/progress-report-development-dynamic-rollover-rating-test).

**Derived checks:** longitudinal load transfer on level ground is approximately `m * acceleration * CG_height / wheelbase`; braking loads the front, acceleration loads the rear. On a crest, the required centripetal acceleration changes support load. Therefore grip, suspension motion and rollover should depend on wheel loads and actual contacts, rather than pitch angle alone. Rapier already supplies rigid-body gravity/inertia; do not add them again as separate driving forces.

## What the current game does, and what to change

These observations are from local source, not external claims.

| Area | Current behavior | Recommended change |
| --- | --- | --- |
| Vehicle scale, `src/truck.ts` | 2,000 kg; 2.8 m wheelbase; 1.64 m track; 0.4 m tyre radius | Align geometry with the selected Toyota variant; use loaded mass intentionally. Measure settled clearance and CG height above ground, not just the local `centerOfMassY` offset. |
| Engine, `src/gearbox.ts` | Four equal speed bands, arbitrary force ratios, rpm from speed band | Use real gear ratios and an explicitly approximate torque curve through published engine points; include a launch/torque-converter approximation if choosing the automatic. |
| Wheelspin, `src/truck.ts` | One value for all wheels; throttle counts as spin below 2 m/s and cannot count above it | Use contact-level demand versus delivered traction as a first approximation; actual wheel-speed slip requires an independent rotational state. |
| Burial, `src/sinkage.ts` | Every stopped wheel accumulates sinkage towards a softness cap, even without throttle | Separate load-supported settling from slip-driven digging. Unloaded wheels must not excavate. |
| Momentum, `src/sinkage.ts` | Speed subtracts linearly from sinking rate | Let drive, resistance and gravity determine loss of momentum; calibrate any remaining velocity effect separately. |
| Recovery, `src/sinkage.ts` | Direction changes instantly subtract 0.4 burial; steering rate subtracts front burial | Require real displacement and soil support; repeated control changes alone must not improve ground state. |
| Terrain memory, `src/tracks.ts` | Visual tracks fade after 15 s; burial is attached to wheels | For physical rut recovery, store bounded local compaction/excavation state tied to terrain coordinates. Visual fade must not erase physics. |
| Braking, `src/truck.ts` | Hard brake + nose-down pitch increases front burial and removes up to 85% of rear grip | Base resistance and available grip on contact load, slip and soil. Do not assume hard pedal input proves rear-wheel lock. |
| Drag direction, `src/truck.ts` | Removes chassis-up velocity, then applies isotropic drag at contact | Project onto the ground contact plane and resolve rolling/lateral directions there. Chassis-up and ground-normal differ at brinks and during body motion. |
| Drivetrain | Same engine-force command to every wheel; no shaft coupling | Add the chosen centre/axle differential behavior after per-wheel traction works. |
| Suspension | Four identical independent ray springs; one cuboid chassis | First tune static sag, bump/rebound and body response; add front/rear differences and rear-axle coupling only as needed to represent the real layout. |

Existing `src/sinkage.test.ts` deliberately asserts the steering and rocking bonuses. Those tests must change with the model; preserving them would preserve the behavior this research questions. `src/gearbox.test.ts` encodes equal speed-band shifts. Geometry changes also reach `src/truckModel.ts` and its tests; state/interface changes reach `src/hud.ts`, `src/main.ts` and related tests. Keep touch input behavior intact.

The historical [dune-driving notes](dune-driving.md) mix field advice with proposed mechanics. Their claims that momentum literally lifts tyres, concavity implies soft ground, low range prevents spin, and the existing model already covers realistic recovery need the qualifications above. [Asymmetric-dunes validation](asymmetric-dunes-validation.md) records useful regression scenarios, not evidence that those mechanics match a real vehicle.

## Smallest credible implementation path

### First: load and resistance

Keep the stock vehicle controller. Read each contact's suspension force, normal and point velocity; use those to estimate support pressure and directional sand resistance. Replace automatic burial-at-rest with bounded settling plus a traction-demand-based digging estimate. Remove steering/reversal burial rewards only together with a working recovery replacement, so current escape routes do not disappear without an alternative.

A per-wheel excess-demand estimate is a useful intermediate approximation, but is **not measured wheel slip**. Airborne state, braking, lateral sliding and stale contact data need explicit treatment. Apply soil resistance once and keep Rapier's own traction limits in the accounting.

### Second: engine and drivetrain

Use this dimensional relationship as the starting point:

```text
total wheel torque = engine torque(rpm, throttle) * gear * transfer * final drive * efficiency
total drive force  = total wheel torque / loaded tyre radius
engine rpm        ≈ wheel angular speed * gear * transfer * final drive * 60 / (2*pi)
```

The rpm relation assumes coupled shafts; converter/clutch slip needs separate treatment at launch. Efficiency, loaded radius and the torque curve between published points are calibration assumptions. Do not invent a complete measured curve from one torque peak. Verify transfer and final-drive ratios before inserting commonly repeated internet values.

For real spin and locking behavior, evolve wheel angular speed from applied torque and tyre reaction, with stable handling near zero speed. A regularized slip measure can compare `radius * angularSpeed` with rolling-direction contact velocity; document the driving/braking convention. Do not calculate physical slip by differentiating a wheel animation.

### Third: handling and terrain memory

Calibrate load transfer, lateral scrub, bump response, crest unloading and belly contact together. Add a small terrain-local rut store if repeated-track recovery is part of the target. Full deformable meshes, particle sand and a new physics engine are unnecessary for this first pass. A finite area around the vehicle is enough to test whether physical rut recovery improves driving before expanding the terrain system.

**Rapier constraints:** the installed `@dimforge/rapier3d-compat` 0.21 API exposes `wheelSuspensionForce`, `wheelContactNormal`, `wheelForwardImpulse` and `wheelSideImpulse`. It defines wheel braking as an impulse cap, whereas engine input is a force: convert a desired braking force using the physics timestep. The upstream controller derives wheel animation rotation from contact motion, so it is not an independently torque-driven wheel. Match upstream behavior to the installed version before changing internals. [Rapier API](https://rapier.rs/javascript3d/classes/DynamicRayCastVehicleController.html), [upstream implementation](https://github.com/dimforge/rapier/blob/master/src/control/ray_cast_vehicle_controller.rs). Local API checked in `node_modules/@dimforge/rapier3d-compat/dist/control/ray_cast_vehicle_controller.d.ts`.

Keeping Rapier's suspension with a separate physical tyre model is a later option. If doing that, explicitly disable or replace the overlapping stock drive/friction contribution; adding both would double-count forces.

## Verification targets for implementation

These are proposed behavioral checks, not experiments performed in this research.

1. **Rest:** stationary truck on level stable sand converges to finite depth; extra load increases equilibrium depth under otherwise equivalent support conditions.
2. **Slip:** controlled drive pulls away in a recoverable soft patch; excessive slip excavates more. Crawling at low speed does not automatically count as spinning.
3. **Pressure:** under the same load and soil, the aired-down footprint has lower support pressure and less sinkage within the selected operating range.
4. **Turning:** steady large steering on soft sand costs more momentum than a straight run; sawing in place never grants free recovery.
5. **Recovery:** reversing through a lightly compacted track can help; returning through a deeply excavated rut can hurt. Pedal toggling without displacement provides no reward.
6. **Slope/gearing:** an uphill start requires more net pull than the same flat start. Low range increases wheel torque at matched engine conditions, but cannot bypass traction limits or create engine power.
7. **Contact/differentials:** no airborne digging; wheel lift limits an open axle as expected; centre locking does not eliminate left/right differential behavior.
8. **Descent/crest:** straight symmetric descents do not receive artificial yaw; off-line instability responds to load and soil interaction. A faster crest crossing unloads contacts naturally; belly support can cause high-centering.
9. **Numerics:** resistance does not add mechanical energy; idle inputs do not self-propel; force/impulse conversions remain consistent when timestep changes. Use fixed seeds and short targeted cases before broad driving runs.

Log speed, engine rpm, wheel loads, traction demand/delivery, slip estimate, depth and resistance during calibration. Preserve phone-stick constraints in scripted runs, as the earlier dune validation already did. Real-vehicle driving feel still needs owner feedback or instrumented reference footage; no sources found here establish exact KDJ95 sand acceleration, CG, spring/damper rates or tyre–sand coefficients.

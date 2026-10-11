# Toyota KDJ95 reference for driving physics

Researched 2026-10-11. Companion to [KDJ95 sand physics](kdj95-sand-physics.md). Manufacturer specifications below are separated from modelling deductions and unverified parameters.

## Pick one vehicle before tuning

Use a **UK-market 2001 five-door Colorado D-4D GX, manual** as the provisional reference. This is a reproducible baseline, not a claim about the user's own vehicle. Toyota's 2002 service-tool identification table maps **KDJ95 to 1KD-FTV**, with **R150F manual / A343F automatic**; **KZJ95 uses 1KZ-TE**. These engines must not share an assumed torque curve. [Toyota Europe, vehicle identification table, printed p.10](https://www.toyota-tech.eu/SST/2002/Introduction.pdf)

Access note: Toyota Europe's PDF redirected to a sign-in page during the final source check; the identification table remained available as indexed PDF text.

Japan introduced its D-4D in July 2000 with **125 kW at 3,400 rpm and 352 Nm from 1,800–3,400 rpm**. That is a different calibration from the UK figures below. The Japanese release also describes an intercooled variable-nozzle turbo. [Toyota Japan, 31 July 2000](https://global.toyota/en/detail/12464177)

Australian contemporary diesel information is also easy to misapply: Toyota's March 2000 launch specifies **96 kW at 3,600 rpm / 343 Nm at 2,000 rpm**, rather than the UK D-4D outputs. [Toyota Australia, 2000 Prado turbo-diesel launch](https://pressroom.toyota.com.au/PressKit?pk-code=12108615-69a2-4a5f-89ac-5474de55487e)

## Confirmed UK D-4D numbers

The UK launch began February 2001. Wide-body five-door GX/VX values unless stated; kerb mass excludes added occupants/cargo. [Toyota UK, 24 January 2001, technical specifications](https://media.toyota.co.uk/more-power-and-torque-for-less/)

| Parameter | Published value |
| --- | --- |
| Displacement | 2,982 cc |
| Power | 120 kW / 161 bhp at 3,400 rpm |
| Torque | 343 Nm at 1,600 rpm |
| Kerb mass | 2,060 kg; narrow-body FX 2,020 kg |
| Wheelbase | 2.675 m |
| Track, front / rear | 1.505 / 1.510 m |
| Length / width | 4.755 / 1.820 m |
| Height | GX 1.875 m; VX 1.915 m |
| Tyres | 265/70R16; FX 215/80R16 |
| Fuel capacity | 90 litres |
| Manual forward ratios | 3.830, 2.062, 1.436, 1.000, 0.838 |
| Automatic forward ratios | 2.804, 1.531, 1.000, 0.753 |
| Reverse, manual / automatic | 4.220 / 2.393 |

The source's 10.4/11.4 m turning figures are labelled *radius*, an apparent ambiguity; do not calibrate steering from that label without corroboration. It publishes a torque peak, not a complete UK torque curve.

## Chassis and driveline

The 90-series uses independent double-wishbone **coil-spring front suspension** and a **four-link coil-spring rear arrangement with a lateral rod**. Toyota's history also distinguishes the 90-series full-time 4WD from the earlier Prado's part-time arrangement. The **Torsen centre differential and electronic rear air suspension described for the 120-series belong to its 2002 successor**, so do not import them into this baseline. [Toyota global model history, 1996 and 2002 sections](https://global.toyota/en/mobility/toyota-brand/features/landcruiser/history/evolution/light-duty.html)

The UK 1996 Colorado launch pack explicitly describes a full-time transfer with a **lockable centre differential** and a **dashboard-operated rear differential lock**. It also specifies independent front/four-link rear suspension and all-round discs. This establishes actual period hardware, but is not proof that every later KDJ95 market/trim received the same rear differential or controls. [Toyota UK 1996 launch pack, printed p.11](https://media.toyota.co.uk/wp-content/uploads/sites/5/pdf/LC-Colorado-UK-launch-pack-1996.pdf)

For simulation, keep three different ideas separate:

- **Low range** changes mechanical reduction. It does not create extra engine power or inherently prevent wheelspin.
- **Centre lock** constrains relative front/rear driveline speed. It does not lock the left/right wheels on each axle.
- **Rear axle lock** constrains relative left/right rear-wheel speed. This permits the wheel with useful grip to carry more driving torque, and means the tyres must accommodate differing turn-path lengths through slip when the lock remains engaged.

These are mechanical deductions from the layout. A locked differential imposes a speed constraint, not a universal equal-tractive-force allocation. An open differential permits different wheel speeds but its usable torque is limited by the low-traction side. [Eaton, differential operation](https://www.eaton.com/us/en-us/support/eaton-answers/limited-slip-differentials-and-electric-vehicles.html), [Eaton, locking differentials](https://origin-edge.eaton.com/us/en-us/products/differentials-traction-control/locking-differentials.html)

## Useful deductions, not measured Toyota data

- Nominal unloaded tyre radius from 265/70R16 geometry is `(16 × 0.0254 + 2 × 0.265 × 0.70) / 2 = 0.3887 m`. Effective rolling radius changes with load, pressure and tyre construction; this is a starting geometry only.
- Power and torque must agree: `P = T × rpm × 2π / 60`. The UK power rating implies about **337 Nm at 3,400 rpm**, assuming the published rounded peak values are consistent. Interpolation between that point and the published torque peak is a modelling choice, not a measured dyno trace.
- Five-door wheelbase and axle track should set contact positions before spring and steering tuning. A visibly correct body over the wrong contact geometry changes breakover, pitch response and rollover behaviour.
- Use total running mass when adding passengers, fuel changes or equipment; do not compensate for extra weight solely by raising tyre grip.
- Manual and automatic need different launch models. Applying the manual's rigid gear relation to an automatic without torque-converter slip will misrepresent low-speed response. Converter characteristics were not recovered here.

## Unverified: leave explicit rather than inventing precision

The sources above do not establish the selected vehicle's **final-drive ratio, exact transfer reduction, transfer-lever/centre-lock interlocks, rear differential fitment, loaded centre-of-gravity location, moments of inertia, axle weight distribution, wheel travel, spring rates, damping curves, bump stops, engine braking, turbo transient, idle/redline or full torque map**.

The frequently repeated **2.566:1 low range** was not confirmed against a period KDJ95 primary technical document in this research; do not present it as verified. Later Prado specifications do not close that gap. Obtain the selected market's owner's/repair manual, vehicle identification/axle code, and suspension/tyre measurements before claiming faithful reproduction. In the meantime, any such parameter is a documented game calibration.

No game code changed or physical-vehicle measurements performed.

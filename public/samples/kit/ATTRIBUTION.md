# Sampled kit

Seven one-shots — two kicks, two snares, two closed hats and an open hat —
from the [Versilian Community Sample Library](https://github.com/sgossner/VCSL)
by Versilian Studios, released **CC0**.

## What was changed

These are concert instruments, not a drum kit: the bass drum rings for over a
second and a half. Lofi drums are made rather than found, so each was shaped
locally with ffmpeg:

| | source | change |
| --- | --- | --- |
| kick | Bass Drum 1, v2 and v3 | trimmed to 0.42s with a fade from 0.30, lowpass 2.6 kHz, highpass 35 Hz |
| snare | Snare Drum Modern 1, HitNS | trimmed to 0.34s with a fade from 0.22, bandpassed 140 Hz – 7 kHz |
| hat | Hi-Hat Cymbal, closed | trimmed to 0.13s with a fade from 0.06, highpass 400 Hz |
| open hat | Hi-Hat Cymbal, HitC v1 | trimmed to 0.40s with a fade from 0.18, highpass 400 Hz |

All were downmixed to mono and levelled to a −6 dBFS peak, as the rest of the
sample library is, so the engine's own per-role balance is the only thing
deciding how loud each sits.

Two of each of kick, snare and closed hat are kept so repeated hits alternate
rather than being identical — the same round-robin the source library uses.

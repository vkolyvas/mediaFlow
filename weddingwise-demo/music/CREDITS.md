# Music credits

Background beds for the WeddingWise demo videos. Every track is a **public
domain** ragtime piano recording from Wikimedia Commons — no attribution is
required, but the list is kept here so the provenance of each video is on
record.

The music is deliberately mixed **very low**: the bed sits roughly 18 dB below
the narration and is ducked further under speech with ffmpeg's `sidechaincompress`,
so it only surfaces in the gaps between lines.

## Tracks

| Track | Composer | Year | Licence | Used in |
| --- | --- | --- | --- | --- |
| Ragtime Skedaddle | George Rosey | 1899 | Public domain | `weddingwise-public` |
| That Rag | Ted Browne | 1907 | Public domain | `weddingwise-overview` |
| The Oyster Rag | Tom Lyle | 1910 | Public domain | `weddingwise-couples` |
| Ragtime Oriole | James Scott | 1911 | Public domain | `weddingwise-vendors` |
| Firefly Rag | Joseph F. Lamb | 1912 | Public domain | `weddingwise-planners` |

Source files and their Commons pages:

- <https://commons.wikimedia.org/wiki/File:%22Ragtime_Skedaddle%22_(1899),_by_George_Rosey.oga>
- <https://commons.wikimedia.org/wiki/File:That_Rag_by_Ted_Browne_(1907,_Ragtime_piano_solo).opus>
- <https://commons.wikimedia.org/wiki/File:%22The_Oyster_Rag%22,_by_Tom_Lyle_(1910,_Ragtime_piano).opus>
- <https://commons.wikimedia.org/wiki/File:James_Scott_-_Ragtime_Oriole_(1911).ogg>
- <https://commons.wikimedia.org/wiki/File:Joseph_F._Lamb_-_%22Firefly_Rag%22_(Ragtime_Piano).opus>

## Reproducing the mix

```bash
cd weddingwise-demo/music
node fetch-music.mjs     # download the sources into src/ (not committed)
node mix.mjs             # mix the bed under each rendered video
```

`mix.mjs` re-encodes only the audio (video is copied) and archives the
previous render in the project's `out/archive/` folder, so a re-mix is never
destructive.

Tuning lives in `manifest.json` under `defaults`:

| Key | Meaning |
| --- | --- |
| `bedGainDb` | level of the bed before ducking (`-10` ≈ 18 dB under the voice) |
| `duckThreshold` | sidechain level that starts the duck (`0.05` ≈ -26 dBFS) |
| `duckRatio` | how hard the bed is pushed down under speech (`8:1`) |
| `duckAttackMs` / `duckReleaseMs` | how fast the duck reacts and recovers |
| `fadeInSec` / `fadeOutSec` | music fades at the start and end of the video |
| `targetLufs` | loudness the source recording is normalised to before the bed gain |

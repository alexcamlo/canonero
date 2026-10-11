# Radio music

All three tracks are by **TAD (Tad)**, from [lofi Compilation on OpenGameArt](https://opengameart.org/content/lofi-compilation).
The source page lists **[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)** for the collection and its attached tracks (verified 2026-10-11).
CC0 permits copying, modification, redistribution and public performance, including commercial use, without per-play fees or attribution requirements. Credit is retained here for the artist.

| Title | Artist | Local file | Source page | Original download | Licence |
| --- | --- | --- | --- | --- | --- |
| Countryside | TAD | `countryside.m4a` | [OpenGameArt](https://opengameart.org/content/lofi-compilation) | [MP3](https://opengameart.org/sites/default/files/Countryside_0.mp3) | CC0 1.0 |
| Oceanside | TAD | `oceanside.m4a` | [OpenGameArt](https://opengameart.org/content/lofi-compilation) | [MP3](https://opengameart.org/sites/default/files/Oceanside_0.mp3) | CC0 1.0 |
| Florist | TAD | `florist.m4a` | [OpenGameArt](https://opengameart.org/content/lofi-compilation) | [MP3](https://opengameart.org/sites/default/files/Florist_0.mp3) | CC0 1.0 |

Full tracks, re-encoded from MP3 to stereo AAC-LC M4A at approximately 96 kbps; metadata removed and the MP4 index moved to the start for streaming. No musical edits.

```sh
ffmpeg -i input.mp3 -vn -map_metadata -1 -c:a aac -b:a 96k -movflags +faststart output.m4a
```

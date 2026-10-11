# Radio music

All tracks are from [OpenGameArt](https://opengameart.org) and released under **[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)** (licence checked on each page, 2026-10-11).
CC0 permits copying, modification and redistribution, including commercial use, with no attribution requirement. Credit is kept here for the artists.

| Title | Artist | Local file | Source page | Licence |
| --- | --- | --- | --- | --- |
| Chill Jungle | Alex McCulloch (pro-sensory) | `jungle.m4a` | [OpenGameArt](https://opengameart.org/content/chill-jungle) | CC0 1.0 |
| Empty Stretch | Zane Little | `stretch.m4a` | [OpenGameArt](https://opengameart.org/content/empty-stretch) | CC0 1.0 |
| Hypnotic Chill (Extended 4 minute mix) | cynicmusic | `hypnotic.m4a` | [OpenGameArt](https://opengameart.org/content/hypnotic-chill-extended-4-minute-mix) | CC0 1.0 |
| Desert Loop (Lo-Fi Remaster) | iamoneabe | `desert.m4a` | [OpenGameArt](https://opengameart.org/content/desert-loop-lo-fi-remaster) | CC0 1.0 |
| Chill Jungle 2 | Alex McCulloch (pro-sensory) | `jungle2.m4a` | [OpenGameArt](https://opengameart.org/content/chill-jungle-2) | CC0 1.0 |
| Old Broken Radio (Lo-fi chiptune glitch D'n'B) | Gichco | `radio.m4a` | [OpenGameArt](https://opengameart.org/content/lo-fi-chiptune-glitch-dnb) | CC0 1.0 |

Full tracks, re-encoded from the MP3 downloads to AAC-LC M4A at ~96 kbps; metadata removed, MP4 index moved to the start for streaming. No musical edits.

```sh
ffmpeg -i input.mp3 -vn -map_metadata -1 -c:a aac -b:a 96k -movflags +faststart output.m4a
```

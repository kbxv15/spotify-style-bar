# Spotify-Style Player Bar for YouTube Music

Rearranges YouTube Music's bottom player bar into Spotify's layout, with Spotify's measurements:

- **Left**: 56px album art, then the title (14px) and the artist line (12px) with the rest of the space to themselves
- **Centre (40%, max 722px)**: shuffle · previous · white round play button · next · repeat, with the seek bar underneath and the elapsed/total times on either side
- **Right**: like · dislike · ⋮ (and buttons other extensions add there) · Lyrics · Queue · volume icon · 93px volume bar · open player page. Both sides are kept the same width (at least 30%) so the controls stay centred.
- 72px black bar, 4px grey tracks that turn green with a knob on hover, green for liked songs and active repeat
- **Song details**: click the title or artist in the bar for a card with the full title, artists, album, exact plays/views and likes, length, release date, and an "About the artist" section (photo, profile picture, subscribers, monthly audience, bio) with View artist / Open on YouTube / Copy link

## Immersive video (player page)

- The **Song/Video switch** moves to the top bar, next to search.
- **Videos fill the whole player page**, edge to edge between the top bar and the player bar, with no black bars: if the video's shape doesn't match the page, the page background shows around it. Songs without a video keep YouTube Music's normal album-art layout.
- The **Up next / Lyrics / Comments / Related sidebar folds away to the right** with the handle on its edge, and stays folded or unfolded across songs and reloads.
- **Sidebar floats over the video** (default) with a blurred dark background, or switch it off so the video shrinks to the space beside the sidebar.

## Install

1. Unzip, and keep the `spotify-style-bar` folder somewhere permanent.
2. Go to `chrome://extensions`, switch on **Developer mode** (top right).
3. Click **Load unpacked** and pick the `spotify-style-bar` folder.
4. Reload any open YouTube Music tabs.

## Options (click the extension's toolbar icon)

- **Spotify layout**: turn off to get YouTube Music's own bar back instantly
- **Black bar & green accents**
- **Spotify's real size at any zoom**: if YouTube Music is zoomed in or out in Chrome, the bar still measures 72px on screen, like Spotify. Sizes are scaled directly, so the seek and volume sliders track the pointer exactly at any zoom.
- **Song details on title click** (on by default; turn off to get YouTube Music's own title and artist links back)
- **Player page opens only from album art** (on by default): clicking empty parts of the bar does nothing; click the album art or the arrow button to open or close the player page
- **Show dislike button** (off by default; Spotify has only one button there)
- **Show ⋮ menu button** (on by default, for Add to playlist etc.)

## Notes

- **Lyrics** and **Queue** open YouTube Music's player page on the Lyrics or Up next tab; click again to close it.
- Song details come from YouTube Music's player and artist pages, and the exact like count from YouTube's own page for the song. Links in the card open pages inside YouTube Music, so the music keeps playing. Close the card with Esc or by clicking anywhere else.
- YouTube Music's shuffle shuffles the queue once rather than staying on, so it doesn't get Spotify's green "on" dot. Repeat does.
- YouTube Music has no Connect or mini-player buttons, so those two Spotify icons aren't there.
- The hover time bubble over the seek bar is gone, as in Spotify.
- In fullscreen video the extension steps aside and YouTube Music's own fullscreen bar is used.
- To change the styling, edit `src/spotbar.template.css` and run `python3 src/build.py`.

## Updating

Unzip the new version over the old `spotify-style-bar` folder, click the reload icon on the extension's card in `chrome://extensions`, then reload YouTube Music.

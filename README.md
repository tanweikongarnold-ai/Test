# The Big Board

A 3D Cold War command game in the browser. It is October 1962 and you are Chief of Staff of the US Army, holding joint command in the Pentagon war room for the thirteen days of the crisis. From the plotting table you:

- **Strike** Soviet ICBM sites, bomber bases, submarine pens, IRBM brigades, supply hubs and the Cuban missile sites with Atlas, Titan, Minuteman, Thor, Jupiter, Polaris and B-52 forces (each with real range, flight time and reliability).
- **Coordinate ground troops**: hold six West German cities against Warsaw Pact armies, airlift divisions across the Atlantic, and send the 82nd Airborne and the Marines into Cuba to seize missile sites intact.
- **Run safety efforts at home**: fallout shelters, evacuations, Nike Hercules batteries, Nike Zeus, the CONELRAD alert, and National Guard relief after a strike.

The game ends when Moscow sues for peace, when you negotiate over the red telephone, after day 13, or when you lose (25 million US casualties, or five of six German cities fallen). The after-action report scores you from *Relieved of Command* to *General of the Army*.

## Play

Serve the folder over HTTP (ES modules don't load from `file://`):

```sh
npx serve .        # or: python3 -m http.server
```

Then open the printed address. Controls: drag to pan, right-drag to tilt, scroll to zoom, click markers to select, click the map to move a selected unit or submarine. Space pauses, 1–4 change speed, Esc deselects.

## The Google map

On the title screen choose **Google satellite map** and paste a Google Maps Platform API key with the **Map Tiles API** enabled. Restrict the key to your site's address in the Google Cloud console.

To keep your Google credits safe, the game requests the map once per visit: one session request plus 24 high-DPI tiles at zoom 3, stitched into a single texture. Nothing else is requested while you play, the session token is reused until it expires, and the browser's HTTP cache serves repeat visits. Without a key, the game uses its own War Room plotting map drawn from Natural Earth data (`data/countries-50m.json`, from the `world-atlas` package).

## In-game budget

The defense budget earns about $8B a day. If it falls under $3B, Congress passes an emergency supplemental (+$12B, once a day), so you can never get stuck without funds before the game ends.

## Files

- `index.html`: layout and styles
- `js/main.js`: boot, game loop, input, wall boards
- `js/game.js`: simulation (missiles, ground combat, civil defense, scoring)
- `js/scene.js`: Three.js war room, markers, missile arcs, explosions
- `js/ui.js`: HUD panels, labels, teletype, dossiers
- `js/geo.js`: Mercator projection, map texture, Google Map Tiles loader
- `js/data.js`: 1962 order of battle and targets
- `js/audio.js`: synthesized sound effects

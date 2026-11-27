# Handoff: embed the Nimble player reference

## What to integrate

Add a subpage such as `/nimble/` using the host site's normal layout, header,
and navigation. Embed [Nimble-Spellbook-Offline.html](./Nimble-Spellbook-Offline.html)
as a separate HTML document in an iframe. The `embed=1` query parameter hides
the app's visible page title but leaves its own **Spells**, **Conditions**, and
**My Character** tabs and PDF-version footer intact. The iframe keeps the app's
styles, IDs, and hash routing separate from the host site's.

## Integration steps

1. Copy the latest built HTML from this workspace into the host site's static
   assets, for example at `/nimble/Nimble-Spellbook-Offline.html`. Serve it as
   `text/html`, not as a download or a route that returns the host app's HTML.
   The build is self-contained: do not copy source PDFs, SQLite, or the Python
   server. Do not use a GitHub file preview as the iframe URL.
2. In the host subpage body, beneath its own header, add an iframe like this.
   Adjust the URL for the actual deployment base path and use the host layout's
   available height so the embedded view can scroll.

   ```html
   <iframe
     class="nimble-reference"
     src="./Nimble-Spellbook-Offline.html?embed=1#spells"
     title="Nimble player reference"
   ></iframe>
   ```

   ```css
   .nimble-reference {
     display: block;
     width: 100%;
     min-height: 65vh;
     height: 80dvh;
     border: 0;
   }
   ```

3. Keep the iframe mounted when visitors switch tabs. The app owns the frame's
   `#spells`, `#conditions`, and `#character` hashes; they do not change the
   host URL. Change the initial hash to open a different tab by default.
   The same HTML without `?embed=1` is still the standalone edition and can
   be linked separately if the host offers an “Open standalone” link.

## Deployment constraints

- Prefer serving the iframe document on the host site's origin. The app saves
  character profiles to browser local storage; profiles saved in the downloaded
  `file://` copy do not automatically appear on the website. Cross-site frames
  may have partitioned or blocked storage depending on browser settings.
- The iframe must be allowed to load and run scripts. Check the host page's
  `frame-src` policy and the document's response headers (`frame-ancestors`,
  `X-Frame-Options`, and script/style CSP). The standalone bundle contains
  inline scripts and styles. Do not loosen security headers site-wide; handle
  any policy conflict for this asset specifically. If framing is not permitted,
  link to the standalone page instead.
- Confirm publication rights for the destination before exposing the player
  build publicly. The offline build omits GM-only spells and original PDFs.

## Acceptance checks

- The host header is visible, the app title does not duplicate it, and all
  three reference tabs work without navigating the host page.
- Spell search and filters, Conditions, and class/level and spell choices in
  My Character still work inside the iframe.
- Save a temporary character on the hosted origin and reload the subpage to
  verify profile storage. Check a narrow viewport and keyboard tab navigation.
- Open the HTML directly without `?embed=1` and confirm the standalone title
  and tabs still appear.

For future updates, rebuild with `py -B build_offline.py` in the Nimble
workspace and replace the hosted HTML asset. The embed-capable build was
prepared locally; it is not in the previously published GitHub version.

## Tavern integration

The Library's **Nimble** view is `/tavern/library?view=nimble`. The site serves
this folder's built HTML through an authenticated, non-cached route rather
than exposing a public static copy. Keep `NimbleApp/Nimble-Spellbook-Offline.html`
in the deployment's source tree. If Vercel's Root Directory is
`adorable-accretion`, enable **Include source files outside of the Root Directory
in the Build Step**. Confirm publication rights before deploying.

The authenticated reference route adds `connect-src 'self'` to the offline
page's Content Security Policy so the iframe can reach the same-origin
profiles API. The downloaded copy retains its offline policy.

The hosted **Create character** button stores the initial profile in the
Tavern's existing Upstash Redis database, scoped to the signed-in account.
Further edits (including renames) save automatically, with note titles and
body text saved on blur. **Delete character** removes the profile and all
its notes after confirmation. No new
environment variables or database migration are needed. The standalone
download still uses local browser storage, and its profiles are not
automatically imported into Tavern accounts.

Unlike the fixed-height example above, the Tavern iframe grows and shrinks
with the reference so users scroll the Library page, not the iframe. The
frame is borderless and transparent so the Library supplies the background.
Keep the iframe element's `color-scheme` in sync with the embedded document
so the browser does not paint an opaque background in dark mode.
Nimble follows the Tavern's light/dark toggle while preserving distinct school
colors in dark mode. When testing updates, switch tabs, filter the spell
list, and expand notes to check that the frame resizes in both directions.

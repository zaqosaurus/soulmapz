# NEXT — what the survey should do after v0.7

*Written 2026-11-15 at the close of v0.7 (PLAN_V07 Phases 0–5), for the next collaborator.
Read [HANDOFF.md](HANDOFF.md) first for state, rules and commands; this file is opinion —
where the work should go and why. The maintainer decides; argue with it.*

---

## 1. The diagnosis

v0.7 made the map wide (27 layers, 10 on the world sheet) and honest (pre-stated findings,
a ledger of what was not found, every gate named). Three weaknesses remain, in order of how
much they cost a reader:

1. **The map is heavier on wounds than on light.** War, police killings, COVID, evictions,
   overdoses, suicide, crashes, poison — against languages, dark skies, gifts, love counted.
   This is structural, not a choice: harm is *administratively recorded* (death certificates,
   court filings, incident reports) and joy is not. A survey of the soul that only measures
   wounds is not complete, and NOTES_V07 §8 already says so.
2. **The map is hard to read precisely.** Tints have no numeric legend; arcs have no hover;
   plate numbers are typed by hand and drift. A reader sees light and dark but cannot say what
   "dark" means. The findings are rigorous; the map they sit on is impressionistic.
3. **Every finding stands alone.** The survey's core gesture is laying one layer on another,
   but two county tints just overlap into mud. The one shipped round-2 card (connectedness ×
   COVID) cannot be *seen* on the map — only read.

## 2. What I'd ask Fable to do (v0.8, "The Light Side")

In this order. Each item ships on its own and leaves the branch green.

### A. Make the map legible (engine, no new data) — first, because it multiplies everything else
1. **Legends that count** — a slim ramp on every sequential tint: min, median, max, the unit,
   and the vmin/vmax actually used, generated from the payload so it cannot drift (NOTES §7.1).
2. **Computed plate stats** — `plateStats` entries that name a function over the payload
   (`max`, `median`, `count`, `share`) instead of literal strings (NOTES §7.4). Then a smoke
   check that every remaining literal number is found in staging (§7.21).
3. **Arc hover** for flows — origin, destination, count. The Uprooted deserves it most (§7.3).
4. **Bivariate counties** — a 3×3 scheme for two county layers, used first to *show* the
   shipped card (connectedness × COVID) and, honestly, where it fails (§7.2).

### B. Acquire the light that is reachable today (www2.census.gov is open)
5. **Where people gather** — County Business Patterns (CBP, `www2.census.gov/programs-surveys/cbp/`):
   establishment counts per 10,000 residents for civic and social organizations (NAICS 813410),
   religious organizations (813110), drinking places (722410), performing arts and museums
   (711, 712), fitness and recreation (7139). One county layer with a lens by kind. It is the
   honest partial answer to the gated Commons — paid and member places, not public ones — and
   the plate must say so. It also finally builds "bars vs. churches" from the v0.5 wantlist.
6. **Languages at home** (ACS B16001) — the U.S. half of The Last Speakers; a light layer
   about how many tongues a county holds, not about loss.
7. **Where America was born** (ACS B05006) — world → county flows into the U.S., the partner
   to The Uprooted.

### C. One more round of findings — fewer, sharper
8. **Test the shipped card's biggest confound now**: ACS median age (B01002) is reachable.
   Pre-state H32 — connectedness × COVID deaths with median age *and* income held — and let
   the card live or die by it. If it dies, it becomes a LESSON card. That is the survey
   working, not failing.
9. **Gathering places × connectedness** (pre-stated as a cousin of H25): do counties with
   more civic organizations have more cross-class friendship?
10. Rule for the round: no more than six pairs, each with a reason to expect a link written
    beside it. Round 2 tested thirteen and found one; most were reasonable but unmotivated.

### D. Process
11. **CI**: build + smoke on every PR push (NOTES §7.19), so a restarting worker is never
    the only witness.
12. Merge PR #2 by squash; tag `v0.7.0`; then branch for v0.8.

### What I would *not* do next
- Chase the gated hosts again without the maintainer's word that the gateway changed.
- Add more harm layers (rent burden, child poverty, long commutes) before the light ones.
  They are reachable and true, but they deepen weakness 1.
- Reorder or rename anything in `HASH_ORDER` — old links must keep working.

### A goal Fable could be given
> /goal v0.8 "The Light Side": (A) legends that count, computed plate stats, arc hover,
> bivariate county view showing the connectedness × COVID card; (B) ship "Where People Gather"
> (CBP) and "Languages at Home" (ACS B16001) through the §4 loop; (C) pre-state ≤ 6 pairs in a
> `v09` block including H32 (the card's age confound) and run them; (D) CI smoke on PRs.
> Done when every item is shipped **or recorded as blocked with its gate on file**, smoke is
> green, the atlas is reviewed page by page, NOTES/HANDOFF/PLAN status are updated, and
> everything is pushed.

(The "or recorded as blocked" clause matters: round 2's goal could not be met because two
layers were behind a gateway, and the stop hook looped until the goal was cleared.)

## 3. If there were magic

**A county-level, non-surveillant record of kindness.** Every wound on this map exists because
a government counts it at the place where it happens — a death certificate names a county, a
court filing names an address. Nothing counts the meal brought to a neighbour, the stranger
helped, the song sung together, the afternoon in a library. If one magic thing could happen, it
would be a public, privacy-respecting measure of everyday generosity and gathering, at the same
resolution as the overdose map. Then the survey could do what it was built to do: lay the light
over the dark and see where they meet.

The closest real shadows of that, worth an investigation before any build:
- AmeriCorps / Census **Volunteering and Civic Life** (CPS civic-engagement supplement) —
  state and metro volunteering and "helping neighbours" rates. Coarse, but a *real* Kindness
  slot. Check its host and terms first.
- **IMLS Public Libraries Survey** — every public library outlet with coordinates and visits;
  public domain. The truest commons in America. Host `www.imls.gov` needs allowing.
- **NEA arts participation** (SPPA) — state level.

**The practical magic, if the first is too much:** a survey that keeps itself current. Every
layer has a staging script; give them one `pipeline/refresh.py <id>` (NOTES §7.22) and a
monthly scheduled run that re-downloads, re-validates, and opens a PR titled *What changed in
the soul this month* — the diff in counts, every correction in public. The living log becomes a
living survey.

## 4. What I'd keep exactly as it is

The pre-stated bars. The ledger of what was not found. PENDING slots instead of substitutes.
Reading the render as a test. Checking every number in every sentence against the data.
These are why a reader can trust the one card that passed.

---

## 5. From far away — what would make this something everyone gets something from

*Added at the maintainer's request: step back from the code and ask what would turn the survey
from something worth seeing once into something people return to, and that no reader could say
gave them nothing.*

### What it is today, seen from a distance
A beautiful, honest atlas **about everyone and addressed to no one**. You arrive, you're
impressed, you toggle a few layers, you leave. Three things are missing, and they are the three
reasons people come back to anything:

- **It is not about me.** Aggregates of millions are true and numbing. Nobody returns to a map
  of "us"; people return to a mirror.
- **Nothing changes when I'm gone.** A finished atlas is seen once. Things people revisit
  either move (news, seasons) or remember them (their streak, their places, their people).
- **It doesn't ask me anything.** The survey has a beautiful method — say what you expect, then
  check — but it does all of that itself. The reader only watches.

And one tonal problem: **it leaves people heavier than it found them.** Seven layers of loss for
every four of light. People come back to what leaves them a little better.

### The transformation, in four moves (in order of importance)

**1. Begin with you — the portrait of a place.** The front door asks one question:
*where are you from?* (and, if you like, *where do you live now?*). The answer is not a
dashboard; it's a **letter** — a page of honest sentences about that place across every layer:
what's unusually bright there, what's unusually dark, how it compares with places like it, who
the world remembers from within 50 km, what the survey *cannot see* there, and the arc between
the two places you gave (your own migration, laid on the Great Sorting). Rates become human
scale ("in your county, about one person every eleven days"). With the portrait comes a
**soul fingerprint**: a single generated glyph, unique to each county and country, drawn from
its 27 readings — art you can hold, compare with your mother's hometown, put on a wall. Everyone
has a place. Everyone gets something. It stays in the browser: nothing about the reader is sent
anywhere, which keeps the zero-network rule.

**2. Guess before you look — the method becomes the game.** One question a day, the same for
everyone: *Which county gives the largest share of its income away? Where do the most
languages live? Do the lonely die younger?* You answer **before** the map reveals — tap where
you think, or pick a number — then the map answers, and the card says what the survey knows and
doesn't. Over weeks, the page shows a reader their own blind spots ("you expect more harm in
cities than there is"). This is the survey's ethic — pre-state, then check — handed to every
reader as a daily habit. It is the strongest return mechanic there is, and the most
educational one: what everyone gets out of it is a calibrated sense of their own country.
*Care rule:* never score guesses about deaths. Grief is not a game; those questions are asked,
answered, and left unscored.

**3. The exceptions — the hopeful half of every pattern.** For every pattern on the map, show
the places that break it: the counties poor and unconnected on paper with low overdose rates;
the towns that should be dark and aren't. This is still "where, not why" — the survey only
points — but it is where the light lives, and where readers' attention turns into curiosity
instead of dread. And it opens a door: **the people who live in the exceptions know things the
data doesn't.** A simple, moderated way to say "here is what we do here" (an issue form, no
server) turns readers into correspondents — the first light-side data the survey gathers itself,
cited like everything else.

**4. The survey keeps watch — the living record.** Every month the sources move: new overdose
quarters, refugee mid-year counts, new data centers. A scheduled refresh opens a PR, and the page
carries a dispatch — *What changed in the soul this month* — plus, for a returning reader, "since
your last visit, here is what changed in **your** places." The world moved; the map noticed; the
reader has a reason to look again.

### If only one: build the portrait
The portrait is the universal hook and the platform for the rest: the daily question can be about
your place, the exceptions can be your neighbours, the monthly dispatch can be your county's. It
uses only data the survey already has. Done honestly — uncertainty in every sentence, no
"worst county in America" framing, the gaps named — it is the moment a stranger stops reading
about "us" and starts reading about home.

### What must not change while doing any of this
The portrait must not become a horoscope: every sentence traces to a layer and says how sure it
is. The game must never trivialize the dead. Contributions are moderated and cited, never
anonymous claims presented as data. And the light is never manufactured to balance the dark — it
is looked for, harder.

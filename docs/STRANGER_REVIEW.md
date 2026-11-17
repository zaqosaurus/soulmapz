# A stranger's review

*Written 2026-11-16 by a reviewer who opened the built page cold, on desktop and phone, before
reading the roadmap. It deliberately does not follow NEXT.md. It is opinion; argue with it.*

## The one thing

**The map shows where people live. The soul is in what's left after you subtract that.**

I entered the survey, toggled layers, and saw the same picture each time: the Northeast
corridor, Chicago, Texas triangle, the California coast. So I measured it. On a one-degree grid
of the conterminous U.S. (863 populated cells, population from `data/ref/us_places.csv`):

| Layer | Rank correlation with population | Share of its points in the 10% most populated cells |
|---|---|---|
| Every Fatal Crash | 0.91 | 47% |
| The Sky Is Watching Back | 0.90 | 53% |
| Where the Remembered Were Born | 0.77 | 74% |
| What We Buried | 0.67 | 52% |
| Where the Cloud Touches Ground | 0.54 | 66% |
| The Thrones of Capital | 0.52 | 89% |
| The Fulfillment Bloodstream | 0.51 | 83% |
| Devil's Land, Angel's Land | 0.15 | 15% |
| *(population itself)* | — | 71% |

*How the table was made, so it can be redone:* each layer's `data/staging/<id>.json` records
inside 24–50° N, 125–66° W were counted per one-degree cell; population per cell is the sum of
`pop` over the city points in `us_places.csv` (21,783 places — incorporated places only, so
rural population is undercounted). Spearman rank correlation with averaged ties, over cells
with population above zero. The script was not kept. This is a rough check that shows the
direction, not a finding to publish; redo it on county population before quoting a number.

Two consequences.

**"Density becomes elevation; overlap becomes light" mostly redraws the census.** The founding
visual idea, as built, makes cities glow. Stacking layers adds brightness, not meaning.

**The real stories are already in that table, and the map hides them.** Crashes put 47% of
their points where 71% of people live: death on the road is rural. Corporate headquarters put
89% there: capital is more concentrated than people. Place names ignore population entirely.
Each of those is a finding. None is visible, because raw density buries it.

So the change I would make before any other: **every layer is drawn as surprise — the gap
between what a place has and what a place of its size would be expected to have.** More than
expected glows; less than expected is a visible hollow. Then overlap means something (a place
that is strange in three ways at once), and a place's identity becomes its pattern of
surprises. The county layers that already ship as rates are halfway there. The point layers
are not.

## What else a stranger notices

**The oldest findings spend the trust the newest ones earn.** "Half the Dying Happens Near the
Network" says more than half of fatal crashes fall within 50 km of an Amazon facility, then
adds "the corridors that promise tomorrow's package collect today's toll." Amazon builds where
people are; crashes happen where people are. "The Cloud Landed Nowhere New" is the same
artifact. The later cards (connectedness × COVID, with its partial correlation and its stated
confounds) are careful work. A numerate reader meets the weak ones first, at positions 3 and 4,
and stops believing the rest. The prose also breaks the page's own rule: "where, not why" sits
above sentences that imply why.

**The best thing here is not the map.** It is the list of 19 hypotheses that were tested and
failed, the bars written down before the run, and the card labelled spurious on purpose. I have
not seen a data-visualisation project publish its misses. That is the rare asset, and it is
in a dropdown.

**One voice, 27 times.** The Year Without Goodbyes. The Quiet Hours. The Empty Chair. The Last
Dark. Each title is good. Together they are a single sustained minor chord, and by the tenth
layer I stopped feeling it. The roadmap's answer is "the light side" — libraries, volunteering,
giving. That is still solemn; it is virtue, not joy. A soul also eats, sings, bets, flirts,
names its dog, supports a team, argues about barbecue. The only layer that made me laugh was
the search-term one, and it is the weakest data on the page (29 terms, state level).

**That same layer is the first thing a new visitor sees.** The orientation tour puts explicit
search phrases across the map within seconds of entering. The repo ships a CLASSROOM.md.
Decide which of those two you mean.

**The title claims the world; the depth is American.** 17 of 27 layers are U.S.-only. "The
collective soul" over a map of the conterminous U.S. reads as an oversight. Naming it for what
it is would cost nothing and read as confidence.

**On a phone it does not work.** The toolbar takes the top third of the screen, the map is a
thumbnail, and the default layer renders as a solid yellow shape with state labels stacked on
top. Most first visits to a shared link are on a phone.

**It has never met a reader.** Fifty commits, two pull requests, 146 KB of planning documents
against 159 KB of application code, 92 smoke checks, a rule protecting old share links — and no
trace that anyone outside the build loop has used it. The link-preview text still says "fifteen
real datasets." The project has been optimised for internal correctness. It has not yet been
tested against a person.

**There are twelve toolbar buttons and thirteen shipped features.** Audio, constellations, a
tour recorder, pins, an embed kit, a random plunge, a print atlas. Each is reasonable. None was
asked for by anyone. They are the cost of "adding before polishing" with no reader in the room.

## What needs to go

- **Raw-density rendering as the default** for point layers. Keep it as a toggle.
- **Findings that are population in disguise**, or rewrite them against a population baseline
  and let them live or die. Apply the v0.7 standard backwards.
- **Sentences that imply cause** on any card that claims not to.
- **PENDING slots in the reader's layer list.** Honest inside the repo; to a visitor they read
  as broken.
- **Most of the toolbar.** Four controls: place search, layers, findings, about. Everything
  else moves behind "more."
- **The planning archive from the front of the repo.** PLAN_V07, WORKPLAN, NOTES_V07 are
  history. One short state file is enough for the next session, and cheaper to load.
- **Either the search-term layer's place in the opening tour, or the classroom packet.**

## What's missing

- **A baseline.** Population first; later, a plain expected-value model per layer. Without it
  nothing on the map can be called unusual.
- **A reader.** Five strangers, watched, before the next layer is acquired. Where they stop is
  the roadmap.
- **Appetite and play.** Food, music, sport, baby names, pets, festivals. Not as balance for
  the grief — as the other half of the subject.
- **A reason to cite it.** The single sealed file is a real strength that is being treated as
  an engineering rule. A self-contained page that renders offline forever is an *edition*.
  Deposit each one (Zenodo, Internet Archive), give it a DOI and a date, and the survey becomes
  a thing a journalist or teacher can reference and a thing next year's edition can be compared
  against.
- **An honest name for its scope.**

## What this could be

Not a bigger atlas. **The instrument that tells you what is actually unusual about a place —
and shows its work.**

Almost every map of America online is a population map with a different title. One that
subtracts the obvious and shows the remainder, with every claim pre-stated and every miss
published, is a different kind of object. It answers the question people really bring to a map
of themselves: *what is different about here?* The roadmap's "portrait of a place" is the right
front door, but built on today's layers it would tell each county what percentile it sits in.
Built on surprise, it tells each county what it is.

And it can be dated. A survey is something you run again. *The Soul Survey, 2026* — sealed,
archived, citable — beside *2027*, is worth more each year it continues. That is where the
compounding value is, and it is nearly free given the pipeline that already exists.

## A plan, cheapest first

1. **Show it to five people. Change nothing first.** Watch on their phones. *(zero credits)*
2. **Truth pass on what exists.** Re-run the four oldest findings against a population
   baseline; rewrite or move them to the not-found ledger. Fix the link preview. Hide PENDING
   slots. Take the search-term layer out of the opening tour. *(small)*
3. **Surprise rendering.** A population surface in `data/ref/`; a registry flag per layer for
   `raw | per-capita | residual`; the engine draws excess and deficit. Point layers first.
   This is the one real engineering item, and it changes every screenshot. *(medium)*
4. **Make the phone the primary canvas** and cut the toolbar to four. *(medium)*
5. **Move the method to the front.** The entry screen leads with the claim no one else makes:
   every pattern here was predicted before it was checked, and here are the ones that failed.
   *(small)*
6. **Seal and deposit the 2026 edition** with a DOI. Rename for scope. *(small)*
7. **Only then** new layers — and choose them for appetite and play, not for virtue.

Steps 1, 2, 5 and 6 are a few hours and need almost no code. Step 3 is the one that turns the
project into something else.

## What I would not touch

The pre-stated bars. The ledger of misses. The provenance sidecars. The rule against naming the
private dead. The typography and the dark sheet — it is beautiful, and that is not a small
thing. The single file.

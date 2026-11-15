# The Soul Survey: A Teacher's Guide

For high school or intro college statistics, civics, and journalism. Three lessons of about 20 to 30 minutes each, plus a set of guided readings you can use as warm-ups or homework.

## What the survey is, and the one rule

The Soul Survey is a single-page map of real, sourced data: where the notable dead were born, where the data centers hum, where overdoses and COVID deaths were recorded, where friendships cross class lines. Layers can be stacked, so you can see where two things overlap. The survey has one rule, and it is the rule these lessons teach: **where, not why.** The map is descriptive, not causal. It can show that two things sit in the same places. It cannot tell you that one caused the other, and it says so on its own findings page, in cards that were included on purpose to show how easy it is to be fooled.

## Opening it in class

Open `dist/index.html` from the repository, or use the web copy at https://zaqosaurus.github.io/soulmapz/. The page is one self-contained file and makes no network calls once it is open, so it works offline once you have the file. Good for a classroom with bad wifi.

Two keys do most of the work:

- **R** opens and closes the Readings menu (short guided tours of the map).
- **F** opens and closes the Findings menu (the correlation cards, plus the ledger of "Tested and not found").

Other keys: **U** and **W** switch between the US and world sheets, **/** opens the search index, **E** turns all layers on, **N** turns all off. Run through the keys yourself once before class.

---

## Lesson 1: The meaningless correlation

**Card:** "The Strongest Correlation Here Is Meaningless" (id `spurious`). Layers: UFO sightings and data centers.

**Sequence**

1. Press **F**, open the card, and let students read the headline number before you say anything: r = 0.31, for "UFO sightings × data centers."
2. Switch on both layers (`wonder-ufos` and `power-datacenters`) and look at the map. Ask students to predict, before reading the body text, what the card will say.
3. Read the card's body together. It says sightings correlate with data centers more strongly than memory does, because both simply follow people. Read the method line too: 0.25-degree US cells, log-log Pearson across 9,484 cells.
4. Ask students to say, in their own words, what a "cell" is and why comparing cells (not single points) is how the number was made.

**Discussion questions**

1. Neither UFO sightings nor data centers cause the other. What do they both depend on? (The card's answer: people.)
2. If you wanted to test whether UFO sightings really track data centers, what would you need to hold constant first?
3. The card says it is "the warning label for every other card on this page." What does it mean to put a warning label on your own data?
4. Why might the authors have included a result they knew was meaningless?
5. Find another card on the findings page. What is the first thing you would check before believing it?

**Takeaway:** Everything follows people. Where there are more people there are more sightings, more servers, more crashes, more of nearly everything. Geography correlates everything with everything. The survey shows where. It never proves why.

---

## Lesson 2: The confounder

**Card:** "The Altar That Was Really a Map" (id `lutheran-confound`). Layers: religious tradition (`faith-altar`) and overdose deaths (`despair-overdoses`). The card carries the tag "CONFOUNDED — SHOWN ON PURPOSE."

**Sequence**

1. Open the card. Start with only the headline: "3.8× → 1.3×", the Lutheran gap nationwide versus inside the same states. Ask what the arrow is doing.
2. Read the first half of the body without the second: counties whose largest tradition is Lutheran average 6.2 overdose deaths per 100k; non-denominational counties average 23.8. Ask students to write the headline a newspaper would run.
3. Now read the turn: compare counties inside the same states and the gap nearly closes, 5.7 against 7.4.
4. Use the card's own method note for the counts: Lutheran 6.2 (n=163), Baptist 19.6 (n=1,047), non-denominational 23.8 (n=311). Ask what n tells you about how much to trust each average.
5. Zoom to the Upper Midwest (the card frames this region) and note where the Lutheran counties sit.

**Discussion questions**

1. Write the newspaper headline from step 2. Then rewrite it after seeing the within-state numbers. What changed?
2. The card says "Lutheran counties are Upper Midwest counties." What is the confounder, and how does it affect both variables?
3. Why does comparing counties inside the same states help? What does it hold fixed?
4. The method note says the adherence rate itself against overdose is r = −0.19 nationwide and −0.10 within states, and that this was "rejected as a finding." Why would the authors reject a result that points in the direction people might expect?
5. Name a headline you have seen that compares two groups and might be a map in disguise.

**Takeaway:** Everything follows region. When two groups differ, check whether they live in different places first. The within-state comparison is the simplest tool for it. The first lesson warns that everything follows people; this one warns that everything follows region.

---

## Lesson 3: What was not found

**Where:** Press **F** and open the section titled "Tested and not found." It is a ledger of questions the survey asked and did not answer with a finding, each with its result.

**Part A: Three failed hypotheses.** Give students these three entries and ask them to explain what happened in each.

- **The thrones.** "Are the thrones exhaling? (Fortune 500 counties losing households)": 65% vs 58% of size-matched counties; the gap was mostly size.
- **The price per head.** "Is corruption costlier per head in small towns?": $270 vs $141 per resident, 1.9× against a 5× bar. The log notes the early 70× "died on careful denominators."
- **War × languages.** "Do the deepest war reds sit where languages fall silent?": Spearman −0.09 over 157 countries, not found, and the war essay now says so.

**Questions**

1. In the corruption entry, what is a "bar," and why does it matter that it was set at 5× before the result was known?
2. What does it mean that "the early 70× died on careful denominators"? What is a denominator, and what happens to a per-head number when you change it?
3. If the thrones comparison had not been size-matched, what would the researchers have concluded? Why would that have been wrong?
4. Most sources show only what worked. What do you lose as a reader when the failures are hidden?
5. One entry reports r = 0.19 against a 0.20 bar and logs it as "a near miss, logged as a miss." Is that fair? What would the temptation be, and what is the cost of giving in to it?

**Why pre-stating a bar matters.** If you decide what counts as a finding after you see the data, you can always find something. A bar written down beforehand means a result either clears it or does not.

**Part B: The one that passed.** Now open the round-2 card "The Goodbyes Fell Hardest Where Classes Kept Apart" (id `covid-connectedness`).

Read the headline: 543 vs 332 COVID deaths per 100,000, in the least versus most connected fifth of counties. The method line says it was "Pre-stated as H23 in correlate.py v08, with its bar, before it was run," across 3,004 counties, with Pearson r = −0.44.

**Task:** Ask students to list every confounder or limit the card names for itself. They should find these:

- Once income is accounted for, the link shrinks by more than half (partial r = −0.20).
- The age of a county's people, its vaccination rate, and its politics are not on this map, and any of them could carry the rest.
- The rates are crude, not age-adjusted.
- The card says explicitly that it does not say friendship protected anyone.

Then ask: what does the card do to earn the right to be called a finding? (It holds inside states, with a mean within-state r of −0.39, and in all four population bands, −0.33 to −0.62.) And what does it still not claim?

---

## Guided readings

Press **R** to open the Readings menu. Titles below are exact.

1. **The Capital of the Internet.** Notice how tightly the data centers cluster in Northern Virginia. *Question: what does the text list as the reasons for the clustering, and could the map prove any of them?*
2. **The Corridor of Grief.** Notice that the fulfillment network and crash deaths both follow the interstates. *Question: does the map show that one causes the other, or that both follow the roads?*
3. **Where Memory Pools.** Notice that five thousand years of remembered births pool in a small triangle of Europe, with Paris alone at 28,055. *Question: what does "remembered" tell you about who is on this map, and who is not?*
4. **The Last Speakers.** Notice the contrast across one strait: Papua New Guinea holds 849 languages, and of Australia's 369, 227 are extinct. *Question: what would you need to know to say why the two sides differ?*
5. **What Powers the Cloud.** Notice the ghost plant: Porcheville, closed in May 2017 but still listed in a database frozen in 2021. *Question: how old can a dataset be before a map of it misleads?*
6. **The Price of Staying.** Notice that Maryland holds 15 of the 50 highest eviction-threat rates because of how its rent courts work. *Question: when a number comes from a legal process, what is it really measuring?*

---

## A note on sensitive material

Some layers concern deaths: overdoses, COVID, police killings, war. The survey shows rates for places. It names nobody who is not notable. Suicide data is kept out of every correlation, as a safe-messaging practice, and that layer carries a crisis-line notice (call or text 988) rather than points for people. Even so, students may have lost someone, so **preview the layers and cards you plan to use before class**, tell students in advance which ones you will open, and give them the option to sit one out. Lessons 1 and 2 use the UFO and data center layers and the religion layer. Lesson 2 does touch overdose deaths, so the preview matters most there. Lesson 3 Part B uses COVID deaths.

## Licensing and removal

The survey is non-commercial. Every source is credited in `DATA_LICENSES.md`. To request removal of anything, use the repository's removal-request issue form, or write privately to issue@soupmap.org.

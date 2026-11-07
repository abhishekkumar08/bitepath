# BitePath — Design

Status: approved in brainstorm 2026-10-30 · awaiting written-spec review
Owner: Abhishek · Local only, not pushed

## Problem and audience

Health-focused people know *what* they eat but not *what happens to it*. BitePath
shows, in 3D and backed by cited science, the journey a food or a meal takes through
a realistic male or female body.

Primary user: a health-curious adult comparing everyday Indian and global foods.
The value is understanding, not a verdict: the app explains, it does not score.

## Goals

1. Pick a sex (male/female), then a single food or a meal.
2. Watch a cinematic journey through a realistic, rotatable, layer-peelable body
   (skin → muscle → skeleton → organs), in the style of zygotebody.com.
3. Narrated captions explain each step; every claim traces to a cited source.
4. Any food in the catalogue produces a journey; star foods get richer scripted moments.

## Non-goals (v1)

- Graphs, health scores, good/bad verdicts.
- Personalisation beyond sex (age, weight, conditions such as diabetes).
- Food logging, accounts, saved meals.
- A native mobile app (web only, desktop-first).
- Medical advice. A visible "educational, not medical advice" note ships with v1.

## Chosen approach

**X-ray cutaway body (B) + organ-station narration (C) + endoscope dives for star foods (A).**

| Layer | What it does |
|---|---|
| Visual (B) | Full body stays on screen; skin and muscle fade to translucent; each food shows as its own coloured mass moving along the digestive tract; camera orbits and zooms to the active organ. |
| Story (C) | The journey is a fixed sequence of stations: mouth → oesophagus → stomach → small intestine → liver → bloodstream → large intestine. At each station the narration says what that organ does to everything on the plate. |
| Special (A) | For star foods only, a scripted first-person dive inside an organ (e.g. alcohol in the stomach, fibre in the intestine). |

Chosen over: endoscope everywhere (needs inner organ surfaces no model has; meals
get confusing), cutaway only (textbook feel), stations only (no journey feel).

## Components

| Unit | Purpose | Depends on |
|---|---|---|
| Body scene | Loads the male or female model, layer peel, x-ray fade, camera moves to a station | 3D models |
| Food catalogue | Merged foods from IFCT 2017 (Indian) and USDA FoodData Central (global), normalised per 100 g to carbs, sugar, starch, fibre, protein, fat, alcohol, plus micronutrients used by star moments (iron, caffeine) | Nothing at runtime (built offline into a static file) |
| Nutrient engine | Turns a food or meal plus sex into a journey: per station, which components are acted on, relative timings, and caption facts | Catalogue, science rules |
| Science rules | A cited table of facts, e.g. fat and fibre slow stomach emptying; sex-specific rules (alcohol first-pass metabolism, iron absorption, calorie context) | Sources list |
| Star-food scripts | Hand-authored extra moments and dives keyed to specific foods | Body scene, engine output |
| Narration player | Shows captions in sync with the camera; play/pause and next/prev station | Engine output |
| Picker UI | Choose sex, then a single food or a meal (several foods with portions) | Catalogue |

Each unit is testable alone. The engine is pure (food + sex in, journey out), so it
is tested without any 3D.

## Data flow

Picker → (sex, foods + portions) → nutrient engine (catalogue + science rules) →
journey (ordered stations, each with: active organ, food streams, captions, optional
star script) → body scene + narration player play it station by station.

## Male vs female

Both sexes get a full realistic, layered body. Science differences come from the
rules table, not the geometry: alcohol, iron and calorie context differ by sex; most
foods differ only mildly, and the narration says so instead of inventing differences.

## Error handling

- Food missing a nutrient value: treat as 0 and do not emit a caption that depends on it.
- Model fails to load: show the error and a retry, never a blank canvas.
- Meal with zero portions: block "Play" until at least one food has a portion.

## Testing

- Engine: unit tests on fixed foods (white rice, dal, samosa, chai, alcohol) asserting
  station order, which streams are present, and sex-specific captions.
- Catalogue build: a check that every row has the macro fields and a source id.
- Every caption fact has a source id in the rules table (a test fails on uncited facts).
- 3D scene: visual check in the browser of each station for both sexes.

## Assumptions and risks

1. **Body models (resolved in planning, 2026-10-30).** Zygote's models are commercial.
   BitePath uses the HuBMAP Human Reference Atlas "united" Visible Human bodies, male
   and female, CC BY 4.0, for skin, mouth, liver, gallbladder, pancreas, intestines,
   heart, vessels, brain, pelvis and spine. BodyParts3D (CC BY 4.0) supplies the stomach,
   oesophagus, rest of the skeleton and muscles, fitted to each body. In the female body
   those BodyParts3D parts come from the male reference; the credits panel says so.
   Z-Anatomy was dropped because it contains non-commercial parts.
2. Sex differences come from verified studies: alcohol first-pass metabolism (Frezza 1990),
   iron needs (Hurrell & Egli 2010), and slower stomach emptying (+17 min) and colon
   transit (+1¾ h) in women (Wang 2015, 215 adults). Per-sex calorie context was dropped
   because no per-sex energy source was verified.
3. Narration states only facts its cited source supports. A stop with no cited caption
   is skipped (for example plain rice has no bloodstream stop).
4. Star moments trigger on nutrient thresholds, not food names: alcohol, caffeine ≥ 30 mg,
   fat ≥ 15 g, fibre ≥ 6 g, iron ≥ 3 mg, sugar ≥ 20 g with fibre < 2 g.
5. IFCT lists ingredients, not dishes, so common dishes (chai, samosa, dal…) are
   hand-written recipes of IFCT/USDA ingredients.


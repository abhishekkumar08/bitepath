# TODOS

## Female-specific stomach, oesophagus, skeleton and muscles

- **What:** Replace the male BodyParts3D stomach, oesophagus, skeleton (except pelvis and spine) and muscles in the female body with a female anatomy source.
- **Why:** Today the female body uses the male reference, fitted to the female HuBMAP body and disclosed on the credits panel. Proportions (shoulders, rib cage, muscle mass) are male.
- **Pros:** A truly female body throughout, matching the "both bodies realistic" goal.
- **Cons:** Costs money (~$50–300 for a licensed model). The licence must allow modified use in this app. The new parts must pass the same placement checks.
- **Context:** No free female source for these parts existed on 2026-10-30. HuBMAP covers female skin, mouth, liver, gallbladder, pancreas, intestines, heart, vessels, brain, pelvis and spine. Plug-in point: `BP3D_PARTS` and the per-sex fit in `scripts/build-models.ts`. Keep the `boxInside` / `boxGap` checks.
- **Depends on:** Task 6 of the implementation plan being built.

## Per-sex calorie context in the narration

- **What:** Add a cited caption giving a food's or meal's share of a typical man's or woman's daily energy.
- **Why:** It is a common health-user question, and it is one more real sex difference in the journey.
- **Pros:** Concrete, relatable numbers.
- **Cons:** Needs a verified source. "Typical" depends on age and activity, so the caption needs care to avoid reading as advice.
- **Context:** Dropped during planning because no per-sex energy value was verified. Candidate source: ICMR-NIN RDA 2024 (https://www.nin.res.in/RDA_Full_Report_2024.html). Read the exact values from that report before writing the rule, then add them to `src/engine/sources.ts` and `src/engine/rules.ts` with a test.
- **Depends on:** Tasks 2–3 of the implementation plan.

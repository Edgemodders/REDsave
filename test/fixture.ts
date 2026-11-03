// Made-up save metadata for the tests: never a real player's save.

/** A metadata file in the shape game 2.5 writes (metadata.9.json), with made-up values. */
export function metadataJson(over: Record<string, unknown> = {}) {
  return {
    RootType: "saveMetadataContainer",
    Data: {
      metadata: {
        trackedQuestEntry: "quests/minor_quest/mq062_clampdown/mq062_hook/mq062_hook_objective_01",
        trackedQuest: "LocKey#98600",
        mainQuest: "LocKey#9860",
        locationName: "LocKey#10963",
        playTime: 7200.5,
        lifePath: "Corporate",
        bodyGender: "Female",
        brainGender: "Male",
        level: 12.0,
        streetCred: 9.0,
        strength: 5.0,
        intelligence: 6.0,
        reflexes: 7.0,
        technicalAbility: 8.0,
        cool: 9.0,
        finishedQuests: "q000 q001 q003 ",
        playthroughID: "aaaa1111",
        buildPatch: "2.5",
        difficulty: "Hard",
        facts: ["q003_anthony_won=1", "player_drunk=0"],
        gameVersion: 2500,
        saveVersion: 277,
        timestampString: "18:03:12, 3.11.2026",
        name: "ManualSave-1",
        fileSize: 6053063,
        isPointOfNoReturn: false,
        isEndGameSave: false,
        isModded: true,
        additionalContentIds: ["EP1"],
        ...over,
      },
    },
  };
}

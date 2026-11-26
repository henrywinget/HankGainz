// Synthetic fixtures only. Never real exports (CLAUDE.md rule 1).

export const STRONG_CSV = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
2026-03-02 18:00:00,"Push A",1h 5m,"Bench Press (Barbell)",W,95.0,10.0,0,0.0,"","",
2026-03-02 18:00:00,"Push A",1h 5m,"Bench Press (Barbell)",1,135.0,8.0,0,0.0,"","",
2026-03-02 18:00:00,"Push A",1h 5m,"Bench Press (Barbell)",Rest Timer,0,0.0,0,120.0,,,
2026-03-02 18:00:00,"Push A",1h 5m,"Bench Press (Barbell)",2,135.0,8.0,0,0.0,,,
2026-03-02 18:00:00,"Push A",1h 5m,"Pull Up",1,25.0,6.0,0,0.0,,,
2026-03-02 18:00:00,"Push A",1h 5m,"Farmer’s Carry",1,50.0,1.0,0,0.0,,,
2026-03-02 18:00:00,"Push A",1h 5m,"Stair master ",1,0,0.0,0,1200.0,,,
2026-03-05 18:00:00,"Push B",40m,"Bench Press (Barbell)",1,140.0,8.0,0,0.0,,,
2026-03-05 18:00:00,"Push B",40m,"Bench Press (Barbell)",2,1400.0,8.0,0,0.0,"typo","",
2026-03-05 18:00:00,"Push B",40m,"Bench Press (Barbell)",3,140.0,7.0,0,0.0,,,
`;

export const MFP_NUTRITION_CSV = `Date,Meal,Calories,Fat (g),Saturated Fat,Polyunsaturated Fat,Monounsaturated Fat,Trans Fat,Cholesterol,Sodium (mg),Potassium,Carbohydrates (g),Fiber,Sugar,Protein (g),Vitamin A,Vitamin C,Calcium,Iron,Note
2026-03-01,Breakfast,500.0,20.0,5.0,0,0,0,100,400,300,40.0,5.0,10.0,40.0,0,0,0,0,
2026-03-01,Dinner,800.0,30.0,10.0,0,0,0,100,400,300,80.0,8.0,5.0,60.0,0,0,0,0,
2026-03-01,Dinner,200.0,5.0,1.0,0,0,0,0,100,50,30.0,2.0,15.0,10.0,0,0,0,0,
2026-03-02,Breakfast,0.0,0.0,0.0,0,0,0,0,0,0,0.0,0.0,0.0,0.0,0,0,0,0,
`;

export const MFP_MEASUREMENT_CSV = `Date,Weight
2026-03-01,160.0
2026-03-02,161.0
`;

export const MFP_EXERCISE_CSV = `Date,Exercise,Type,Exercise Calories,Exercise Minutes,Sets,Reps Per Set,Kilograms,Steps,Note
2026-03-01,Walking,Cardio,200,30,,,,,
`;

/** MFP strength rows (pre-Strong) mixed with cardio/calorie rows; 2026-03-02 overlaps a Strong workout. */
export const MFP_EXERCISE_STRENGTH_CSV = `Date,Exercise,Type,Exercise Calories,Exercise Minutes,Sets,Reps Per Set,Pounds,Steps,Note
2026-02-20,MFP iOS calorie adjustment,Cardio,0.0,1,,,,2323,
2026-02-20,Bench Press (Barbell),Strength,,,3,8,125,,
2026-02-20,Squat (Barbell),Strength,,,2,5,185,,
2026-02-20,Bench Press (Barbell),Strength,,,1,6,135,,
2026-03-02,Bench Press (Barbell),Strength,,,3,8,130,,
2026-02-22,Mystery Machine Press,Strength,,,2,10,90,,
`;

export const APPLE_HEALTH_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE HealthData [
<!ELEMENT HealthData (ExportDate,Me,(Record|Workout)*)>
]>
<HealthData locale="en_US">
 <ExportDate value="2026-03-03 10:00:00 -0600"/>
 <Me HKCharacteristicTypeIdentifierDateOfBirth=""/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Test Phone" unit="count" startDate="2026-03-01 08:00:00 -0600" endDate="2026-03-01 08:10:00 -0600" value="1200"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Test Phone" unit="count" startDate="2026-03-01 23:55:00 -0600" endDate="2026-03-02 00:05:00 -0600" value="300"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Test Phone" unit="count" startDate="2026-03-02 09:00:00 -0600" endDate="2026-03-02 09:30:00 -0600" value="4000">
  <MetadataEntry key="HKMetadataKeyWasUserEntered" value="0"/>
 </Record>
 <Record type="HKQuantityTypeIdentifierDietaryEnergyConsumed" sourceName="MyFitnessPal" unit="Cal" startDate="2026-03-01 12:00:00 -0600" endDate="2026-03-01 12:00:00 -0600" value="999"/>
 <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="MyFitnessPal" unit="lb" startDate="2026-03-01 07:00:00 -0600" endDate="2026-03-01 07:00:00 -0600" value="160"/>
</HealthData>
`;

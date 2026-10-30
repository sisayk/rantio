// The listing editor's amenity checklist, in categories. Keys are the guest site's
// filter keys (catalog.ts, labels in messages `catalog.features`) plus editor-only ones
// (labels in `listings.amenities.names`). The backend accepts exactly these
// (backend/owners/listings.py FILTER_KEYS and EDITOR_KEYS); keep the three lists the same.
import type { FeatureKey } from "./catalog";

export const EDITOR_AMENITIES = [
  "airConditioning", "bedLinen", "towels", "parking", "fishingGear", "firepit", "barbecue", "firewood",
  "toys", "stairGates", "playground", "terrace", "balcony", "garden", "outdoorDining", "privateParking",
  "stepFree", "accessibleBathroom", "accessibleParking", "smokeAlarm", "coAlarm", "fireExtinguisher", "firstAid",
] as const;
export type EditorAmenity = (typeof EDITOR_AMENITIES)[number];
export type AmenityKey = FeatureKey | EditorAmenity;

export const AMENITY_GROUPS: { id: string; keys: AmenityKey[] }[] = [
  {
    id: "essentials",
    keys: ["internet", "heatPump", "airConditioning", "fireplace", "washingMachine", "tumbleDryer", "dryingCabinet",
      "bedLinen", "towels", "shower", "indoorWc", "outdoorWc", "tv", "parking"],
  },
  {
    id: "nordic",
    keys: ["woodSauna", "electricSauna", "smokeSauna", "lake", "sea", "river", "pond", "privateShore", "sharedShore", "shoreAccess", "waterAccess",
      "jetty", "boat", "canoe", "fishingGear", "hotTub", "jacuzzi", "outdoorJacuzzi", "firepit", "grillHut", "barbecue", "firewood", "nearSki"],
  },
  { id: "kitchen", keys: ["cooking", "stove", "oven", "microwave", "fridge", "freezer", "dishwasher", "coffeeMaker"] },
  { id: "family", keys: ["babyBed", "highChair", "toys", "stairGates", "playground"] },
  { id: "outdoor", keys: ["terrace", "balcony", "garden", "outdoorDining", "evCharging", "privateParking", "pool"] },
  { id: "offgrid", keys: ["solarPower", "noElectricity", "carriedWater", "loft"] },
  { id: "accessibility", keys: ["wheelchair", "stepFree", "accessibleBathroom", "accessibleParking"] },
  { id: "safety", keys: ["smokeAlarm", "coAlarm", "fireExtinguisher", "firstAid"] },
];

export const isEditorAmenity = (k: string): k is EditorAmenity => (EDITOR_AMENITIES as readonly string[]).includes(k);

/** The name of an amenity in the page's language, from whichever messages hold it. */
export function amenityName(
  key: string,
  features: Record<string, string>,
  editorNames: Record<EditorAmenity, string>,
): string {
  return isEditorAmenity(key) ? editorNames[key] : (features[key] ?? key);
}

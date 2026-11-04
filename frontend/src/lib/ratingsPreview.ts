import type { ReviewsText } from "@/i18n/messages/reviews";
import type { ExternalRating, Ratings } from "@/lib/ownerApi";

/** The owner's preview of the ratings box before the first review: made-up reviews, shown only
 *  to the owner and marked "Example", never on a guest's page. Scores from other sites are real. */
export function previewRatings(t: ReviewsText, external: ExternalRating[], today = new Date()): Ratings {
  const month = (back: number) => {
    const d = new Date(today.getFullYear(), today.getMonth() - back, 15);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const [a, b, reply] = t.owner.sample;
  const row = (id: number, name: string, rating: number, comment: string, back: number, r = "") => ({
    id, name, rating, cleanliness: rating, location: 5, value: rating, comment, language: "", stayed: month(back), reply: r, created_at: "",
  });
  return {
    count: 3,
    average: 4.7,
    categories: { cleanliness: 4.7, location: 5, value: 4.7 },
    reviews: [row(-1, "Laura", 5, a, 1, reply), row(-2, "Jonas", 4, b, 2), row(-3, "Mika", 5, "", 3)],
    external,
  };
}

/** No reviews yet: the ratings box shows "New on Rantio". */
export const NO_RATINGS: Ratings = { count: 0, average: null, categories: null, reviews: [], external: [] };

import os
import pandas as pd

BASE_DIR = os.path.dirname(__file__)
DATASET_PATH = os.path.join(BASE_DIR, "dataset.csv")
OUTPUT_PATH = os.path.join(BASE_DIR, "labeled_unknowns.csv")

CATEGORY_MAP = {
    "1": "Productive",
    "2": "Distraction",
    "3": "Neutral",
}


def load_progress():
    if os.path.exists(OUTPUT_PATH) and os.path.getsize(OUTPUT_PATH) > 0:
        done = pd.read_csv(OUTPUT_PATH)
        return done, set(done["window_title"])
    return pd.DataFrame(columns=["app_name", "window_title", "category"]), set()


def main():
    df = pd.read_csv(DATASET_PATH)
    unknowns = df[df["site"] == "Other website"].drop_duplicates(subset=["window_title"])

    labeled_df, done_titles = load_progress()
    remaining = unknowns[~unknowns["window_title"].isin(done_titles)]

    print(f"{len(remaining)} titles left to label (of {len(unknowns)} total unknowns)\n")

    rows = []
    try:
        for _, row in remaining.iterrows():
            print(f"\nApp: {row['app_name']}")
            print(f"Title: {row['window_title']}")
            choice = input("1=Productive  2=Distraction  3=Neutral  s=skip  q=quit: ").strip().lower()

            if choice == "q":
                break
            if choice == "s":
                continue
            if choice not in CATEGORY_MAP:
                print("Invalid input, skipping.")
                continue

            rows.append({
                "app_name": row["app_name"],
                "window_title": row["window_title"],
                "category": CATEGORY_MAP[choice],
            })
    finally:
        if rows:
            new_df = pd.DataFrame(rows)
            combined = pd.concat([labeled_df, new_df], ignore_index=True)
            combined.to_csv(OUTPUT_PATH, index=False)
            print(f"\nSaved {len(combined)} total labeled rows to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
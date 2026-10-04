import os
import sys
import pandas as pd
from pymongo import MongoClient
from dotenv import load_dotenv

# NOTE: the labels come from the frozen, OUTDATED rules in ../core/processor.py, not from the
# backend's current classifier (see ml-service/README.md before training anything on this).
# lets us import classify_activity from ../core/processor.py
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from core.processor import classify_activity

load_dotenv()

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/aura")


def get_collection():
    client = MongoClient(MONGO_URI)
    db = client.get_default_database()
    return db["activities"]


def build_dataset():
    collection = get_collection()

    # projection: only fetch the two fields we need, not the whole document
    cursor = collection.find({}, {"app_name": 1, "window_title": 1, "_id": 0})
    df = pd.DataFrame(list(cursor))
    print(f"Total raw rows: {len(df)}")

    df = df.dropna(subset=["app_name"])
    df["window_title"] = df["window_title"].fillna("")

    df = df.drop_duplicates(subset=["app_name", "window_title"])
    print(f"Unique (app_name, window_title) pairs: {len(df)}")

    labels = df.apply(
        lambda r: classify_activity(r["app_name"], r["window_title"]), axis=1
    )
    df["site"] = labels.apply(lambda p: p[0])
    df["category"] = labels.apply(lambda p: p[1])

    out_path = os.path.join(os.path.dirname(__file__), "dataset.csv")
    df.to_csv(out_path, index=False)
    print(f"Saved to {out_path}")

    print("\nCategory breakdown:")
    print(df["category"].value_counts())


if __name__ == "__main__":
    build_dataset()
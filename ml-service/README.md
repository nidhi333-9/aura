# ML service: experimental, not used by Aura

**Status:** nothing in Aura calls this service any more. The focus score, the site labels and every chart are
computed by the backend (`backend/services/classify.js`, `focus.js`, `rollups.js`; see
[docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)). This folder is kept for experiments, not for the product, and its
Render service (`aura-ml`) is suspended. To use it again: in Render, open the `aura-ml` service, press Resume, and set `ML_SHARED_SECRET` and `MONGO_URI` again (they were removed).

Despite the name, there is **no trained model** in here. `core/processor.py` holds keyword rules and a `pandas`
calculation, the same kind of logic the backend now does faster and in one place.

## What is inside

| Path | What it is |
| --- | --- |
| `api.py` | A FastAPI app (`/analytics`, `/hourly-trend`). Every request needs the `X-Aura-Secret` header. Nothing calls it. |
| `core/processor.py` | `pandas` statistics over one person's activity, plus a **frozen, outdated copy** of the site rules (`classify_activity`). |
| `actions/youtube_api.py` | An old YouTube helper. Unused: the backend has its own. |
| `training/build_dataset.py` | Exports window titles with their rule-based labels to `training/dataset.csv`. |
| `training/label_unknowns.py` | A terminal tool for labelling unknown titles by hand. |

## Read this before using it

* **The rules here are out of date.** `core/processor.py` was frozen on 4 Oct 2026. The real classifier is
  `backend/services/classify.js`: it also knows website domains, Windows app names and cleans window titles, and it has
  many more sites. A dataset built here is labelled with the *old* rules, so its labels will disagree with what the
  dashboard shows. Port the current rules (or export the labels the backend already stored) before training anything.
* **Old titles are deleted.** The database now deletes samples, and so their window titles, after 30 days. Build a
  dataset before they expire, or restore from a backup (`backend/scripts/backup.js`).
* **The data is personal.** `training/*.csv` holds real window titles and is git-ignored. Never commit it.
* **Most of the original reason is gone.** The Mac sensor now sends the website's name, which already recognises
  pages whose titles name no site. What a model could still add: Firefox and Windows, where no website name is sent.

## Run it locally (optional)

```bash
cd ml-service
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env.local            # then edit: a local MongoDB and any shared secret
uvicorn api:app --reload
```

Use a **read-only** database user: this service never writes, and the backend is the only writer.

## Bringing it back into the product

The backend stopped calling it on 4 Oct 2026. Its old route is in git history (`backend/routes/analytics.js`). Before
reconnecting it, update the rules as described above, and decide what it would do that the backend does not.

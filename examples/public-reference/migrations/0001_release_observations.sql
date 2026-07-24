CREATE TABLE release_observations (
  id INTEGER PRIMARY KEY,
  commit_sha TEXT NOT NULL,
  artifact_sha256 TEXT NOT NULL,
  observed_at TEXT NOT NULL
);

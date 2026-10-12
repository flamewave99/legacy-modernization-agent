-- One row per chunk per embedding model, so several models can be indexed side by side and
-- compared by the eval (Phase 6). The embedding column has no fixed dimension for the same
-- reason; with a few hundred chunks an exact scan is instant, so no ANN index is needed.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS chunks (
  id         bigserial PRIMARY KEY,
  model      text   NOT NULL,
  path       text   NOT NULL,
  kind       text   NOT NULL,
  symbol     text,
  start_line int    NOT NULL,
  end_line   int    NOT NULL,
  content    text   NOT NULL,
  embedding  vector NOT NULL
);

CREATE INDEX IF NOT EXISTS chunks_model_idx ON chunks (model);

-- One private digital copy per document. New uploads use this column while
-- older local/S3 rows remain readable through their recorded driver.
ALTER TABLE clinical_documents
  ADD COLUMN content_blob LONGBLOB NULL AFTER storage_key;

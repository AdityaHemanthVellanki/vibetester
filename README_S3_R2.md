Cloudflare R2 Integration

Setup
- Cloudflare dashboard → R2 → Create bucket.
- R2 → Access Keys → Create Access Key (Object Read & Write permission).
- Set `S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com` using your account id or bucket endpoint.

.env snippet
```
S3_PROVIDER=cloudflare
S3_BUCKET=your-r2-bucket-name
S3_REGION=auto
S3_ACCESS_KEY_ID=changeme-r2-access-key
S3_SECRET_ACCESS_KEY=changeme-r2-secret
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_FORCE_PATH_STYLE=true
```

Notes
- R2 is S3-compatible; AWS SDK v3 presigned URLs work.
- Default signed URL expiry is 3600s (1 hour).
- Configure CORS if you plan browser direct downloads.
# Implementation decisions

## 2026-08-26

- The employee and Department Head endpoints return Oracle records under a `rows` property. The employee response also includes `metaData`; the integration ignores it.
- The employer mapping response stores company rows under `results[].formDataIds[].data.dataGrid`; each row's `dataGrid1` may contain more than one `EMPLOYER` field/value. Every distinct non-blank value maps to that row's `org_Name`. Blank entries are ignored. Missing or ambiguous cross-company matches return `Unable to Resolve DUG/KBU` rather than guessing.
- The application has no runtime Oracle fixture mode and seeds no employee-specific RoleCategory mappings. Test Login accepts any eligible employee returned by the configured live employee endpoint. Automated tests inject fictional Oracle responses from files under `backend/test`; the normal server cannot enable those records through configuration.
- Playwright's Chromium build needs system libraries that are absent from the development image. The browser runner uses an ignored `.browser-libs` directory when those libraries are downloaded and extracted locally. This changes no host packages and adds no deployment work.
- The configured live smoke passed on 2026-08-26 using the raw token value from the ignored `.env`: 940 eligible employees, 184 Department Head records, and 16 usable employer mappings. The command printed counts only.

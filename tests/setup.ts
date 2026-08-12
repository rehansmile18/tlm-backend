import { installMockUpstreamsFetch } from "./mockUpstreams";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
process.env.PUNCH_PROCESSOR_SERVICE_ACCOUNT_EMAIL = "svc-tlm-backend@internal";
process.env.PUNCH_PROCESSOR_SERVICE_ACCOUNT_PASSWORD = "test-service-password";
process.env.PUNCH_INGEST_API_KEY = "test-ingest-key";

installMockUpstreamsFetch();

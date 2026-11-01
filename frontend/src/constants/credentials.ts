// Client-side hints for the bring-your-own-credentials form. The server is the authority; these only give
// quick feedback. Limits mirror CredentialsInput in the OpenAPI contract.

export const AZURE_ENDPOINT_SUFFIXES = [".openai.azure.com", ".cognitiveservices.azure.com", ".services.ai.azure.com"] as const;
export const ENDPOINT_PLACEHOLDER = "https://<resource>.openai.azure.com";
export const REQUIRED_PROTOCOL = "https:";

export const DEPLOYMENT_PATTERN = /^[A-Za-z0-9._-]+$/;
export const API_VERSION_PATTERN = /^(\d{4}-\d{2}-\d{2}(-preview)?|v\d+)$/;

export const CREDENTIAL_LIMITS = {
  ENDPOINT_MAX: 200,
  API_KEY_MIN: 8,
  API_KEY_MAX: 512,
  DEPLOYMENT_MAX: 64,
  API_VERSION_MAX: 40,
} as const;

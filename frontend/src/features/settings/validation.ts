// Quick feedback for the credentials form. These checks only spare the user a round trip: the server
// re-validates everything and decides whether the endpoint, key and deployments actually work.
import type { CredentialsInput } from "../../api/types";
import {
  API_VERSION_PATTERN,
  AZURE_ENDPOINT_SUFFIXES,
  CREDENTIAL_LIMITS,
  DEPLOYMENT_PATTERN,
  REQUIRED_PROTOCOL,
} from "../../constants/credentials";
import type { MessageKey } from "../../i18n/messages";
import type { TranslationVars } from "../../i18n/translate";

export interface CredentialsFormValues {
  endpoint: string;
  apiKey: string;
  reasoningDeployment: string;
  fastDeployment: string;
  apiVersion: string;
}

export const EMPTY_CREDENTIALS: CredentialsFormValues = {
  endpoint: "",
  apiKey: "",
  reasoningDeployment: "",
  fastDeployment: "",
  apiVersion: "",
};

export interface FieldProblem {
  key: MessageKey;
  vars?: TranslationVars;
}

export type CredentialsProblems = Partial<Record<keyof CredentialsFormValues, FieldProblem>>;

function isAzureEndpoint(text: string): boolean {
  try {
    const url = new URL(text);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === REQUIRED_PROTOCOL &&
      text.length <= CREDENTIAL_LIMITS.ENDPOINT_MAX &&
      AZURE_ENDPOINT_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length)
    );
  } catch {
    return false;
  }
}

const isDeploymentName = (text: string) => text.length <= CREDENTIAL_LIMITS.DEPLOYMENT_MAX && DEPLOYMENT_PATTERN.test(text);

export function validateCredentials(values: CredentialsFormValues): CredentialsProblems {
  const problems: CredentialsProblems = {};
  const endpoint = values.endpoint.trim();
  const apiKey = values.apiKey.trim();
  const reasoning = values.reasoningDeployment.trim();
  const fast = values.fastDeployment.trim();
  const apiVersion = values.apiVersion.trim();

  if (!isAzureEndpoint(endpoint)) problems.endpoint = { key: "settings.invalid.endpoint" };
  if (apiKey.length < CREDENTIAL_LIMITS.API_KEY_MIN || apiKey.length > CREDENTIAL_LIMITS.API_KEY_MAX) {
    problems.apiKey = { key: "settings.invalid.apiKey", vars: { min: CREDENTIAL_LIMITS.API_KEY_MIN } };
  }
  if (!reasoning) problems.reasoningDeployment = { key: "settings.invalid.deploymentRequired" };
  else if (!isDeploymentName(reasoning)) {
    problems.reasoningDeployment = { key: "settings.invalid.deployment", vars: { max: CREDENTIAL_LIMITS.DEPLOYMENT_MAX } };
  }
  if (fast && !isDeploymentName(fast)) {
    problems.fastDeployment = { key: "settings.invalid.deployment", vars: { max: CREDENTIAL_LIMITS.DEPLOYMENT_MAX } };
  }
  if (apiVersion && !(apiVersion.length <= CREDENTIAL_LIMITS.API_VERSION_MAX && API_VERSION_PATTERN.test(apiVersion))) {
    problems.apiVersion = { key: "settings.invalid.apiVersion" };
  }
  return problems;
}

/** The request body: trimmed, with the optional fields left out when blank. */
export function toCredentialsInput(values: CredentialsFormValues): CredentialsInput {
  const fast = values.fastDeployment.trim();
  const apiVersion = values.apiVersion.trim();
  return {
    endpoint: values.endpoint.trim(),
    api_key: values.apiKey.trim(),
    reasoning_deployment: values.reasoningDeployment.trim(),
    ...(fast && { fast_deployment: fast }),
    ...(apiVersion && { api_version: apiVersion }),
  };
}

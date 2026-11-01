// Every API type is an alias of the generated OpenAPI types (`npm run gen:api`). Nothing is hand-written here.
import type { components, operations } from "./api-types";

type Schemas = components["schemas"];

// --- enums (string unions in the contract) ---
export type Language = Schemas["Language"];
export type Verdict = Schemas["Verdict"];
export type Confidence = Schemas["Confidence"];
export type CitationRole = Schemas["CitationRole"];
export type DocKind = Schemas["DocKind"];
export type VersionStatus = Schemas["VersionStatus"];
export type Outcome = Schemas["Outcome"];
export type Intent = Schemas["Intent"];
export type ModelTier = Schemas["ModelTier"];
export type BreakerState = Schemas["BreakerState"];
export type ErrorCode = Schemas["ErrorCode"];
export type CredentialSource = Schemas["CredentialSource"];
export type GuardCode = Schemas["GuardCode"];
export type GuardName = Schemas["GuardName"];
export type GuardStage = Schemas["GuardStage"];
export type ToolName = Schemas["ToolName"];
export type SkillName = Schemas["SkillName"];
export type ReasoningEffort = Schemas["ReasoningEffort"];
export type OpenAiAuth = Schemas["OpenAiAuth"];
export type Rating = Schemas["Rating"];
export type FeedbackFilter = Schemas["FeedbackFilter"];

// --- public API ---
export type ContractPublic = Schemas["ContractPublic"];
export type DocumentPublic = Schemas["DocumentPublic"];
export type Example = Schemas["Example"];
export type AnalyzeRequest = Schemas["AnalyzeRequest"];
export type AssessmentResponse = Schemas["AssessmentResponse"];
export type ReplyResponse = Schemas["ReplyResponse"];
export type AnalyzeResponse = operations["analyze_api_analyze_post"]["responses"][200]["content"]["application/json"];
export type ResultKind = AnalyzeResponse["kind"];
export type EvidenceItem = Schemas["EvidenceItem"];
export type DocumentUsed = Schemas["DocumentUsed"];
export type FeedbackInput = Schemas["FeedbackInput"];
export type Feedback = Schemas["Feedback"];

// --- session (bring-your-own credentials) ---
export type SessionStatus = Schemas["SessionStatus"];
export type CredentialsInput = Schemas["CredentialsInput"];

// --- admin: sign-in and conversations ---
export type AdminLogin = Schemas["AdminLogin"];
export type AdminSessionStatus = Schemas["AdminSessionStatus"];
export type ConversationSummary = Schemas["ConversationSummary"];
export type ConversationDetail = Schemas["ConversationDetail"];
export type ConversationPage = Schemas["ConversationPage"];
export type FeedbackStats = Schemas["FeedbackStats"];

// --- admin: catalogue ---
export type Catalog = Schemas["Catalog"];
export type ContractAdmin = Schemas["Contract"];
export type DocumentAdmin = Schemas["Document"];
export type DocumentVersion = Schemas["DocumentVersion"];
export type ChangeSummary = Schemas["ChangeSummary"];
export type Chunk = Schemas["Chunk"];
export type CreateContract = Schemas["CreateContract"];
export type CreateDocument = Schemas["CreateDocument"];
export type UploadFields = Schemas["Body_upload_version_api_admin_documents__document_id__versions_post"];
/** The contract only says "array of free-form objects" for the audit log. */
export type AuditRecord = operations["audit_api_admin_audit_get"]["responses"][200]["content"]["application/json"][number];

// --- admin: governance ---
export type GovernanceSummary = Schemas["GovernanceSummary"];
export type AiEvent = Schemas["AiEvent"];
export type GovernancePolicy = Schemas["GovernancePolicy"];
export type TierPolicy = Schemas["TierPolicy"];
export type SkillPolicy = Schemas["SkillPolicy"];
export type ToolPolicy = Schemas["ToolPolicy"];
export type GuardPolicy = Schemas["GuardPolicy"];
export type LimitPolicy = Schemas["LimitPolicy"];
export type SecretsPosture = Schemas["SecretsPosture"];

// --- errors ---
export type ErrorBody = Schemas["ErrorBody"];
export type ValidationError = Schemas["ValidationError"];
